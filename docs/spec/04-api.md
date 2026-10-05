# 04 · API Reference

Every HTTP endpoint, with requests, responses and errors. This file is the
contract between the Web backend and Web frontend tracks: the frontend builds
against it (with mocks if needed), the backend implements it, and QA tests it.
Change it in the same pull request as any API change.

---

## Conventions

| Rule | Detail |
|---|---|
| Base path | `/api` |
| Format | JSON in, JSON out. Every response body is an object. |
| Request content type | Every `POST` and `PATCH` must send `Content-Type: application/json`. Anything else gets `415 {"error":"Content-Type must be application/json"}`. This also blocks cross-site HTML form posts. |
| Errors | `{ "error": "<human sentence>" }`, plus extra fields where listed. The sentence is safe to show to the admin as-is. |
| Auth | **admin** = valid `dbos_session` cookie, else `401 {"error":"Not signed in"}`. **public** = no auth. **cron** = `CRON_SECRET` header. |
| Caching | Every `/api/*` response has `Cache-Control: no-store, max-age=0`. |
| Dates | ISO 8601 strings in UTC, e.g. `"2026-10-05T08:47:26.224Z"` |
| IDs in paths | URL-encode them. Unknown IDs give `404`. |
| Server errors | `500 {"error":"<what failed>"}`. The real error goes to the server log only, never to the client. |
| Time budget | `maxDuration = 60` on `/send`, `/resend` and `/outbox/drain` |

### Status codes used

| Code | Meaning here |
|---|---|
| 200 | OK |
| 201 | Batch created |
| 400 | Request is invalid (details in `error` and sometimes `invalid`) |
| 401 | Not signed in, wrong password, or wrong cron secret |
| 404 | No such batch or certificate |
| 413 | Too many items in one `/send` |
| 415 | Wrong content type |
| 429 | Too many login attempts |
| 500 | Server or database failure |
| 503 | Server not configured (e.g. `CRON_SECRET` missing) |

---

## Endpoint summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Sign in |
| POST | `/api/auth/logout` | public | Sign out |
| POST | `/api/certificates/batch` | admin | Validate recipients, reserve IDs, create records |
| POST | `/api/certificates/send` | admin | Queue and send mail for ≤5 rendered certificates |
| POST | `/api/certificates/batch/:batchId/resend` | admin | Requeue failed mail and send the first few |
| GET | `/api/certificates/batches` | admin | Certificate log: one row per batch |
| GET | `/api/certificates/batch/:batchId` | admin | One batch, per recipient, with mail status |
| PATCH | `/api/certificates/:credentialId/revoke` | admin | Revoke or restore one certificate |
| GET | `/api/certificates/verify/:credentialId` | public | Public view of one certificate |
| GET, POST | `/api/certificates/outbox/drain` | cron | Send mail that is due |

Auth endpoints are specified in [03 Auth](03-auth.md#endpoints).

---

## `POST /api/certificates/batch`

Phase 1 of generation: validate, reserve credential IDs, write the records.
No image data is sent here, so the body stays small for any batch size.

### Request

```json
{
  "type": "participation",
  "title": "Git & GitHub Workshop",
  "description": "Hands-on session, 4 October 2026",
  "driveLink": "https://drive.google.com/drive/folders/abc123",
  "recipients": [
    { "name": "Asha Rao", "email": "asha@example.com", "code": "WS" },
    { "name": "Rohan Mehta", "email": "Rohan@Example.com", "code": "ws" }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `type` | string | One of `participation`, `completion`, `appreciation`, `custom` |
| `title` | string | Required after trimming. Max 150 characters. |
| `description` | string | Optional. Trimmed; empty becomes `null`. Max 500 characters. |
| `driveLink` | string | Optional. Empty becomes `null`. Otherwise must parse as a URL with `http:` or `https:`. |
| `recipients` | array | 1 to 1,000 items |
| `recipients[].name` | string | Required after trimming. Max 120 characters. |
| `recipients[].email` | string | Trimmed and lower-cased, then must match `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `recipients[].code` | string | Upper-cased, everything except A–Z and 0–9 removed, cut to 12 characters. Must be non-empty after that. `"web dev"` → `WEBDEV`. |

### Validation order

1. `recipients` is a non-empty array of at most 1,000 → else `400`.
2. `type` is valid → else `400 {"error":"Invalid certificate type"}`.
3. `title` present → else `400 {"error":"Certificate title is required"}`.
4. `driveLink` valid → else `400` with a sentence explaining the expected format.
5. **Every** row checked. If any fail, nothing is written and no number is reserved:

```json
{
  "error": "2 row(s) are invalid",
  "invalid": [
    { "row": 2, "reason": "Missing name" },
    { "row": 3, "reason": "Invalid email: bad" }
  ]
}
```

`row` is 1-based over the `recipients` array (the frontend converts to
spreadsheet row numbers). At most the first 20 problems are returned. Per row,
only the first problem is reported, checked in the order name, email, code.

### Success: `201`

```json
{
  "batchId": "BATCH-1791190046224-bb7e90",
  "count": 2,
  "issued": [
    {
      "credentialId": "DBUG-WS-26-0001",
      "name": "Asha Rao",
      "email": "asha@example.com",
      "code": "WS",
      "verifyUrl": "https://os.dbuglabs.tech/verify/DBUG-WS-26-0001"
    },
    {
      "credentialId": "DBUG-WS-26-0002",
      "name": "Rohan Mehta",
      "email": "rohan@example.com",
      "code": "WS",
      "verifyUrl": "https://os.dbuglabs.tech/verify/DBUG-WS-26-0002"
    }
  ]
}
```

- `issued` is in the same order as `recipients`.
- `verifyUrl` is built from `PORTAL_URL` on the server. The frontend must encode **this** value in the QR, never its own `window.location`.
- `batchId` format: `BATCH-<Date.now()>-<3 random bytes as hex>`.
- The credential ID format is pending [SEC-03](08-security.md#sec-03-credential-id-enumeration). The frontend must treat it as an opaque string.

### Failure: `500`

`{"error":"Failed to create certificate batch"}`. Any records already inserted
for this `batchId` are deleted before responding, so a failed batch leaves no
records. Reserved numbers are not given back (a gap in the sequence is
acceptable; a half batch is not).

---

## `POST /api/certificates/send`

Phase 2: hand over rendered images, queue their mail, send immediately.

### Request

```json
{
  "batchId": "BATCH-1791190046224-bb7e90",
  "items": [
    { "credentialId": "DBUG-WS-26-0001", "imageBase64": "iVBORw0KGgo…", "mimeType": "image/png" },
    { "credentialId": "DBUG-WS-26-0002", "imageBase64": "/9j/4AAQSk…", "mimeType": "image/jpeg" }
  ]
}
```

| Field | Rules |
|---|---|
| `batchId` | Required |
| `items` | 1 to 5 items, else `413 {"error":"Send at most 5 certificates per request"}` |
| `items[].credentialId` | Must belong to `batchId`. Items that do not are silently skipped. |
| `items[].imageBase64` | Raw base64, or a `data:image/...;base64,` URL (prefix is stripped). If empty, the mail is queued **without** an attachment, and the drain marks it `dead`. |
| `items[].mimeType` | `image/png` or `image/jpeg`. Anything else is treated as `image/png`. |

The whole request body must stay under 4.5 MB (Vercel's limit). The frontend
keeps each request at ≤3 items and ≤3.4 MB of base64.

### What happens

1. Finds the certificates by `batchId` and the given IDs.
2. For each one, builds the email ([07](07-email-and-outbox.md)) and upserts an outbox row keyed by `(batchId, credentialId)`. Re-sending an ID replaces its attachment and resets nothing else.
3. Drains exactly those rows now.
4. Sets `emailedAt` on certificates whose mail was accepted.

### Success: `200`

```json
{
  "queued": 2,
  "sent": 1,
  "failed": [],
  "dead": [
    { "refId": "DBUG-WS-26-0002", "to": "rohan@example.com", "error": "550 5.1.1 No such user" }
  ]
}
```

- `failed` = transient failures. They will be retried automatically (backoff 1, 5, 15, 60, 180 min).
- `dead` = permanent failures or out of attempts. Need a human.
- `refId` is the credential ID.

### Errors

| Case | Status | Body |
|---|---|---|
| Missing `batchId` or `items` | 400 | `{"error":"batchId and items are required"}` |
| More than 5 items | 413 | `{"error":"Send at most 5 certificates per request"}` |
| No item matched the batch | 404 | `{"error":"No matching certificates in this batch"}` |
| Database failure | 500 | `{"error":"Failed to send certificates"}` |

SMTP failures are **not** HTTP errors. They come back inside `failed` / `dead`
with a `200`.

---

## `POST /api/certificates/batch/:batchId/resend`

Requeue failed and dead mail for a batch, then send the first 5 right away.
The scheduler drain sends the rest.

### Request

```json
{ "credentialIds": ["DBUG-WS-26-0002"] }
```

`credentialIds` is optional. Without it (or with an empty array), every
`failed` and `dead` row in the batch is requeued.

`dead` rows are included on purpose: the usual reason to press *Resend* is
that the cause was just fixed (a typo in the address corrected at the mail
provider, a full inbox emptied).

### Success: `200`

```json
{
  "requeued": 3,
  "sent": 2,
  "failed": [],
  "dead": [{ "refId": "DBUG-WS-26-0004", "to": "x@example.com", "error": "550 No such user" }],
  "missingAttachment": [{ "refId": "DBUG-WS-26-0009", "to": "y@example.com" }],
  "stillPending": 0
}
```

| Field | Meaning |
|---|---|
| `requeued` | Rows put back in the queue (only those whose image is still spooled) |
| `sent`, `failed`, `dead` | Results of the immediate send of up to 5 |
| `missingAttachment` | Rows that could not be requeued because the 48 h spool has expired. These must be regenerated. |
| `stillPending` | `requeued − sent − dead`. Left for the drain. |

When nothing could be requeued:

```json
{
  "requeued": 0, "sent": 0, "failed": [], "dead": [],
  "missingAttachment": [ … ],
  "message": "Nothing could be resent: the 48h retry window has expired for these recipients. Regenerate their certificates to send again."
}
```

(or `"message": "Nothing to resend."` when there was nothing failed at all).

Rows with status `sent` are never requeued, even if their ID is passed.

---

## `GET /api/certificates/batches?limit=30`

The certificate log. Newest batch first.

| Query | Rules |
|---|---|
| `limit` | Default 30, max 100 |

### `200`

```json
{
  "batches": [
    {
      "batchId": "BATCH-1791190046224-bb7e90",
      "title": "Git & GitHub Workshop",
      "type": "participation",
      "issuedAt": "2026-10-05T08:47:26.224Z",
      "driveLink": "https://drive.google.com/drive/folders/abc123",
      "total": 120,
      "emailed": 117,
      "revoked": 1,
      "codes": ["WS"],
      "mail": { "queued": 0, "sending": 0, "sent": 117, "failed": 1, "dead": 2, "total": 120, "pending": 1 }
    }
  ]
}
```

- `emailed` counts certificates with `emailedAt` set. It stays correct after outbox rows expire.
- `mail` counts outbox rows by status. After 48 h the rows are gone and these drop to zero; the UI should show `emailed` as the accepted count.
- `pending` = `queued + sending + failed`.

---

## `GET /api/certificates/batch/:batchId`

### `200`

```json
{
  "batchId": "BATCH-1791190046224-bb7e90",
  "title": "Git & GitHub Workshop",
  "type": "participation",
  "description": "Hands-on session, 4 October 2026",
  "issuedAt": "2026-10-05T08:47:26.224Z",
  "driveLink": "https://drive.google.com/drive/folders/abc123",
  "retryWindowHours": 48,
  "summary": { "queued": 0, "sending": 0, "sent": 1, "failed": 0, "dead": 1, "total": 2, "pending": 0 },
  "rows": [
    {
      "credentialId": "DBUG-WS-26-0001",
      "name": "Asha Rao",
      "email": "asha@example.com",
      "code": "WS",
      "revoked": false,
      "revokedReason": null,
      "emailedAt": "2026-10-05T08:47:30.010Z",
      "mail": { "status": "sent", "attempts": 1, "lastError": null, "lastAttemptAt": "…", "sentAt": "…", "nextRetryAt": "…", "retryableUntil": "…" }
    },
    {
      "credentialId": "DBUG-WS-26-0002",
      "name": "Rohan Mehta",
      "email": "rohan@example.com",
      "code": "WS",
      "revoked": false,
      "revokedReason": null,
      "emailedAt": null,
      "mail": { "status": "dead", "attempts": 1, "lastError": "550 5.1.1 No such user", "lastAttemptAt": "…", "sentAt": null, "nextRetryAt": "…", "retryableUntil": "2026-10-07T08:47:26.224Z" }
    }
  ]
}
```

- `rows` sorted by `credentialId`.
- `mail.status` is one of `queued`, `sending`, `sent`, `failed`, `dead`, `not_queued`.
- If the outbox row has expired: `{"status":"sent","sentAt":<emailedAt>}` when `emailedAt` is set, else `{"status":"not_queued"}`.
- `retryableUntil` = the row's `expiresAt`. After it, resend is impossible.
- The spooled image is **never** included.

`404 {"error":"Batch not found"}` for an unknown `batchId`.

---

## `PATCH /api/certificates/:credentialId/revoke`

### Request

Revoke:

```json
{ "reason": "Issued in error" }
```

Restore:

```json
{ "undo": true }
```

| Field | Rules |
|---|---|
| `reason` | Optional. Trimmed, max 300 characters. Empty becomes `"Revoked by dBug Labs"`. Shown publicly on the verify page. |
| `undo` | `true` clears `revoked`, `revokedAt` and `revokedReason` |

### `200`

```json
{ "credentialId": "DBUG-WS-26-0002", "revoked": true }
```

`404 {"error":"Certificate not found"}` for an unknown ID. Revoking an already
revoked certificate updates the reason and date; restoring a valid one is a
no-op. Both return `200`.

Revoking does **not** send any email.

---

## `GET /api/certificates/verify/:credentialId`

Public. Also rate-limited per [SEC-04](08-security.md#sec-04-verify-rate-limit).

### `200`

```json
{
  "certificate": {
    "credentialId": "DBUG-WS-26-0002",
    "issuedToName": "Rohan Mehta",
    "issuedToEmail": "ro•••@example.com",
    "code": "WS",
    "type": "participation",
    "title": "Git & GitHub Workshop",
    "description": "Hands-on session, 4 October 2026",
    "issuedAt": "2026-10-05T08:47:26.224Z",
    "issuedBy": "dBug Labs",
    "revoked": true,
    "revokedAt": "2026-10-06T10:00:00.000Z",
    "revokedReason": "Issued in error"
  }
}
```

Email masking: keep the first 2 characters of the local part, replace the rest
with one `•` per character (at least one), keep the domain.
`rohan@example.com` → `ro•••@example.com`; `a@x.com` → `a•@x.com`.

Never returned: the full email, `batchId`, `emailedAt`, `driveLink`, database
`_id`.

`404 {"error":"Certificate not found or invalid"}` for an unknown ID.

---

## `GET | POST /api/certificates/outbox/drain?limit=20`

For schedulers only.

| Header (either) | Value |
|---|---|
| `Authorization` | `Bearer <CRON_SECRET>` (what Vercel Cron sends automatically) |
| `X-Cron-Secret` | `<CRON_SECRET>` |

| Query | Rules |
|---|---|
| `limit` | Default and max 20 |

### `200`

```json
{ "sent": 14, "failed": 1, "dead": 0, "remaining": 6 }
```

`remaining` = rows still due right now across all batches. A scheduler that
sees `remaining > 0` may call again immediately.

| Case | Status | Body |
|---|---|---|
| `CRON_SECRET` not set on the server | 503 | `{"error":"CRON_SECRET is not configured"}` |
| Wrong or missing secret | 401 | `{"error":"Unauthorized"}` |
| Database failure | 500 | `{"error":"Drain failed"}` |

---

## Mocking for the frontend

Until the backend lands, the frontend can mock with these rules so the switch
is painless:

- `/batch` returns IDs `DBUG-<CODE>-26-<n>` counting from 1 per code, and `verifyUrl` = `<origin>/verify/<id>`.
- `/send` accepts everything, except that any email starting with `bounce` comes back in `dead` with `"550 No such user"`, and any starting with `slow` in `failed` with `"421 Try again later"`.
- `/batches` and `/batch/:id` return the shapes above.

QA's test mail server uses the same `bounce` convention ([09 Testing](09-testing.md#test-environment)).
