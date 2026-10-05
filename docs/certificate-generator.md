# Certificate Generator

The certificate generator is the first module of dBugLabs_OS. It will be a
port of the generator in the SQAC Portal, rebuilt as a standalone Next.js app
behind a single admin password.

Build order: **Phase 1** is the password login, **Phase 2** is the certificate
generator.

This document covers three things:

1. [How the SQAC generator works](#1-how-the-sqac-generator-works) (the source we ported)
2. [What we changed in the port, and why](#2-what-changed-in-the-port)
3. [The dBugLabs_OS build spec](#3-dbuglabs_os-build-spec) (login, API, data model, env, operations)

---

## 1. How the SQAC generator works

### Where the code lives

| Part | Location | Notes |
|---|---|---|
| Frontend (React + Vite) | `SQAC_Portal/Frontend/src/Pages/admin/CertGenerator.jsx`, `CertificateLogs.jsx`, `Pages/Verify.jsx` | GitHub: `SQAC-Tech/SQAC_Portal` |
| Backend, current | `sqac-api-gateway/SQAC_Portal/Backend/src/` (`controllers/certificate.controller.js`, `lib/outbox.js`, `models/Certificate.js`, `models/MailOutbox.js`, `models/Counter.js`) | Local only. The repo's remote (`SQAC-Tech/sqac-api-gateway`) returns *Repository not found*. |
| Backend, stale | `SQAC_Portal/Backend/src/` | Still has the old single-endpoint `upload-generated` flow with Supabase image storage. The frontend no longer calls it. |

> The frontend in `SQAC_Portal` calls `/batch`, `/send` and `/batch/:id/resend`, and those endpoints exist only in the gateway copy. Anyone who clones `SQAC_Portal` alone gets a generator that cannot work.

### The core idea: a certificate is a record, not a file

SQAC never stores certificate images. The PNG is drawn in the admin's browser,
downloaded as a ZIP and attached to the email. The only durable artefact is a
document in MongoDB. The QR code on the certificate points at
`/verify/<credentialId>`, which renders that record. That gives two benefits:

- **Verification means something.** An image only proves that someone made a picture. The verify page answers "did the club actually issue this?" and can say no.
- **Certificates can be revoked.** There is no public PNG URL to keep alive forever.

### Credential IDs

Format: `SQAC-<TEAM>-<YY>-<NNNN>`, for example `SQAC-TECH-26-0042`.

- `TEAM` is the team code from the CSV row, upper-cased with non-alphanumerics stripped.
- The sequence comes from an atomic counter document (`Counter`, `_id: "CERT-TECH-26"`, `$inc: { seq: 1 }`), so two admins generating at the same time never collide.

### The generation flow (four phases)

```
Admin browser                                   Server (Express on Vercel)          MongoDB
─────────────                                   ──────────────────────────          ───────
upload template PNG/JPG
upload CSV (name, email, teamCode) or 1 manual row
place name / QR / credential ID on the canvas
        │
        │ 1. POST /api/certificate/batch  { recipients, type, title, description, driveLink }
        ├──────────────────────────────────────▶ validate every row, reject whole batch if any bad
        │                                        for each row: nextSequence() → credentialId ──▶ Certificate.create
        │◀────────────────────────────────────── { batchId, issued: [{credentialId, name, email, verifyUrl}] }
        │
        │ 2. render each certificate on an offscreen canvas
        │    (name text + credential ID text + QR of verifyUrl)
        │
        │ 3. ZIP all PNGs and download it  ◀── happens before any mail, so a mail failure never costs the certificates
        │
        │ 4. POST /api/certificate/send  { batchId, items: [{credentialId, imageBase64}] }  ×N chunks
        ├──────────────────────────────────────▶ queueMail() per item (upsert on batchId+refId) ───────▶ MailOutbox
        │                                        drainOutbox(): claim → SMTP send → mark sent/failed/dead
        │◀────────────────────────────────────── { sent, failed[], dead[] }
        │
        ▼
if anything failed: modal lists each failure with its SMTP error and a "Resend these" button
```

Why the order matters:

- **IDs before rendering.** The QR encodes the verify URL, and the URL contains the credential ID, so the server must hand out IDs before the browser can draw anything.
- **ZIP before mail.** The download is the deliverable. Mail is best-effort on top of it.
- **Chunked sends.** Vercel rejects any function request body over 4.5 MB, and base64 adds a third to a PNG. The client sends at most 3 certificates or 3 MB per request. The server refuses more than 5 per request, because SMTP takes about a second per message and the function has 60 s.

### The mail outbox

Every certificate mail goes through a `MailOutbox` collection instead of a
fire-and-forget `sendMail().catch(console.error)`.

| Field | Purpose |
|---|---|
| `batchId` + `refId` (credential ID) | Unique together, so queuing the same recipient twice updates the row instead of double-sending. |
| `status` | `queued` → `sending` → `sent`, or `failed` (transient, retried with backoff) or `dead` (permanent, or out of attempts). |
| `attempts`, `nextRetryAt` | Backoff of 1, 5, 15, 60 and 180 minutes, 5 attempts max. |
| `attachment.contentBase64` | The PNG, spooled so a retry works after the admin closes the tab. Removed with `$unset` the moment SMTP accepts the mail. |
| `expiresAt` | TTL index. Mongo deletes the whole row after 48 h, spooled bytes included. After that a failed certificate must be regenerated. |

Rules the outbox enforces:

- **Atomic claims.** Each row is claimed with its own `findOneAndUpdate` that flips it to `sending`, so the admin's browser and the cron drain can run at the same time without double-sending.
- **Orphan reclaim.** A row stuck in `sending` for more than 3 minutes is assumed to belong to a function that timed out, and becomes claimable again.
- **Error classification.** SMTP 5xx and nodemailer `EENVELOPE`/`EMESSAGE` are permanent (`dead`). SMTP 4xx and network errors are transient (`failed`, retried).
- **No attachment, no mail.** A certificate row whose attachment has expired is marked `dead` instead of sending an email with a broken image.
- **"Accepted", not "Delivered".** SMTP gives no delivery receipt, so the UI never claims inbox delivery.

### Other endpoints

| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/certificate/verify/:credentialId` | public | Record for the verify page. Email is masked (`ab•••@gmail.com`). |
| `POST /api/certificate/batch/:batchId/resend` | `GENERATE_CERT` | Requeue `failed` and `dead` rows (optionally a selection), then send the first 5 immediately. |
| `PATCH /api/certificate/:credentialId/revoke` | `GENERATE_CERT` | Revoke or un-revoke (`{ undo: true }`). |
| `GET /api/certificate/batches` | `VIEW_CERT_LOGS` | Certificate log: one row per batch with mail counts. |
| `GET /api/certificate/batch/:batchId` | `VIEW_CERT_LOGS` | Per-recipient record + mail status + retry deadline. |
| `GET\|POST /api/certificate/outbox/drain` | `CRON_SECRET` | Scheduler entry point. Sends up to 20 due mails per call. |
| `GET /api/certificate/my`, `/user/:userId` | session | Member-facing lists. These need member accounts. |

### Issues found while reading the SQAC code

The dBugLabs_OS port must fix these (section 2). They are also worth fixing in SQAC.

1. **Split repos.** The working backend lives only in a local folder whose GitHub remote is gone. `SQAC_Portal/Backend` is stale.
2. **HTML injection in the certificate email.** `name`, `title` and `teamCode` from the CSV are interpolated into the email HTML unescaped.
3. **Partial batches.** `createBatch` creates records one by one. If row 40 of 100 fails to write, rows 1 to 39 exist and the sequence has a hole, but the client gets a 500.
4. **Canvas fonts may silently fall back.** The font picker offers Inter and Roboto, but the page never loads them for the canvas, so names can render in a fallback font with no warning.
5. **Preview QR race.** The preview draws the QR inside an `onload` callback. Fast changes can paint a stale QR over a newer frame.
6. **Large templates break mailing.** A 300 dpi A4 template renders a PNG of several MB. A single certificate over about 3.3 MB exceeds Vercel's 4.5 MB body cap after base64, so that recipient can never be mailed.

---

## 2. What changes in the port

| Area | SQAC | dBugLabs_OS |
|---|---|---|
| Auth | Member accounts, roles, `GENERATE_CERT` / `VIEW_CERT_LOGS` permissions | One admin password (`ADMIN_PASSWORD`). A signed, httpOnly session cookie, valid 12 h. |
| Stack | React + Vite frontend, Express backend, Mongoose | One Next.js 16 app (App Router), native `mongodb` driver, matching `dbug-labs-recruitment` |
| Credential ID | `SQAC-<TEAM>-<YY>-<NNNN>` | `DBUG-<CODE>-<YY>-<NNNN>`. `CODE` is a team or event code, for example `WS` for a workshop. |
| ID reservation | One counter `$inc` and one insert per row | One `$inc: n` reserves the whole range, then a single `insertMany`. No partial batches. |
| Issued by | The logged-in user | Always "dBug Labs", since there are no individual accounts |
| Member pages | `/my`, `/user/:id` | Dropped (no member accounts) |
| Email HTML | Unescaped | Every interpolated value is HTML-escaped |
| Canvas fonts | Inter/Roboto, not loaded | Brand fonts (Anton, Oswald, Barlow) plus Playfair Display and Great Vibes, loaded through `next/font`. Rendering waits on `document.fonts.load()`. |
| Preview QR | Drawn in an `onload` callback | Decoded once into an `Image`, then drawn synchronously |
| Oversized PNGs | Unmailable | The ZIP always holds the PNG. If the mail copy is over 2.5 MB, it is re-encoded as JPEG for the attachment only. |
| Placement | Click to place | Click to place, plus exact X/Y inputs |

Everything else carries over as-is: the four-phase flow, the outbox, backoff,
error classification, the 48 h spool, resend from memory with server-spool
fallback, the certificate log, revoke, masked verify page, and CSV header
aliases.

---

## 3. dBugLabs_OS build spec

### Routes

| Path | Who | What |
|---|---|---|
| `/login` | public | Password form |
| `/admin/certificates` | admin | Generator |
| `/admin/certificates/logs` | admin | Certificate log, resend, revoke, failure CSV |
| `/verify/<credentialId>` | public | Verification page (server-rendered from the record) |

### Phase 1: Login

- One shared password in `ADMIN_PASSWORD`. No user accounts.
- `POST /api/auth/login` compares the password in constant time and sets an httpOnly, `SameSite=Lax` cookie holding `<expiry>.<HMAC-SHA256 signature>`, valid 12 h.
- The signing key mixes `SESSION_SECRET` with `ADMIN_PASSWORD`, so changing the password signs everyone out without a session store.
- Login is rate-limited to 5 wrong attempts per 15 minutes per IP.
- `proxy.js` redirects signed-out visitors on `/admin/*` to `/login?next=…`, and signed-in visitors on `/login` to the generator. Every admin API route also checks the session itself and answers 401, so the proxy is never the only gate.

### Phase 2: Certificate generator

### API

All JSON. All under `/api`.

| Method + path | Auth | Body / response |
|---|---|---|
| `POST /auth/login` | public, rate-limited (5 per 15 min per IP) | `{ password }` → sets `dbos_session` cookie |
| `POST /auth/logout` | any | clears the cookie |
| `POST /certificates/batch` | admin | `{ recipients: [{name,email,code}], type, title, description?, driveLink? }` → `{ batchId, issued: [{credentialId,name,email,code,verifyUrl}] }`. Returns `400 { invalid: [{row, reason}] }` if any row is bad. |
| `POST /certificates/send` | admin | `{ batchId, items: [{credentialId, imageBase64, mimeType?}] }` (max 5) → `{ queued, sent, failed[], dead[] }` |
| `POST /certificates/batch/:batchId/resend` | admin | `{ credentialIds? }` → `{ requeued, sent, failed[], dead[], missingAttachment[], stillPending }` |
| `GET /certificates/batches` | admin | `{ batches: [{ batchId, title, type, issuedAt, total, emailed, revoked, codes, mail }] }` |
| `GET /certificates/batch/:batchId` | admin | Batch header + `rows[]` with mail status and `retryableUntil` |
| `PATCH /certificates/:credentialId/revoke` | admin | `{ reason?, undo? }` |
| `GET /certificates/verify/:credentialId` | public | Masked record |
| `GET\|POST /certificates/outbox/drain` | `Authorization: Bearer <CRON_SECRET>` or `X-Cron-Secret` | `{ sent, failed, dead, remaining }` |

### Collections

**`certificates`**

```js
{
  credentialId: "DBUG-WS-26-0007",   // unique
  batchId: "BATCH-1759650000000-a1b2c3",
  code: "WS",
  issuedToName: "Asha Rao",
  issuedToEmail: "asha@example.com",
  issuedBy: "dBug Labs",
  type: "participation" | "completion" | "appreciation" | "custom",
  title: "Git & GitHub Workshop",
  description: "…",
  driveLink: null,
  issuedAt: Date,
  revoked: false, revokedAt: null, revokedReason: null,
  emailedAt: null                    // set when SMTP accepts the mail
}
```

Indexes: `credentialId` unique, `{ batchId: 1, issuedAt: -1 }`.

**`mail_outbox`**: same shape as SQAC's `MailOutbox`. Indexes: `{ batchId, refId }` unique, `{ status, nextRetryAt }`, TTL on `expiresAt`.

**`counters`**: `{ _id: "CERT-WS-26", seq: 7 }`

Create indexes on first use (once per process), so there is no migration step.

### CSV format

Header names are matched case-insensitively, and common variants are accepted.

| Field | Accepted headers |
|---|---|
| name | `name`, `full name`, `fullname`, `full_name` |
| email | `email`, `mail`, `email address`, `email_address` |
| code | `code`, `team code`, `teamcode`, `team_code`, `team`, `event code`, `event` |

Do not include a credential ID column. The server assigns IDs.

```csv
name,email,code
Asha Rao,asha@example.com,WS
Rohan Mehta,rohan@example.com,WS
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | yes | The login password. Changing it logs everyone out. |
| `SESSION_SECRET` | yes | 32+ random characters. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MONGODB_URI` | yes | Atlas connection string |
| `MONGODB_DB` | yes | e.g. `dbuglabs_os` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | yes, for mail | Gmail: `smtp.gmail.com`, `465`, an app password |
| `MAIL_FROM` | no | Defaults to `"dBug Labs" <SMTP_USER>` |
| `SMTP_MAX_CONNECTIONS`, `SMTP_RATE_LIMIT` | no | Pool size (3) and messages per second (5) |
| `PORTAL_URL` | yes, in production | Origin baked into every QR code, e.g. `https://os.dbuglabs.tech`. Must be the production origin: a printed QR is permanent. |
| `CRON_SECRET` | yes, in production | Guards the outbox drain |

### Operations

- **Mail drain.** `vercel.json` schedules a daily drain (the Hobby plan allows daily crons only). For faster retries, point an external scheduler such as cron-job.org at `GET /api/certificates/outbox/drain` every 5 minutes with `Authorization: Bearer <CRON_SECRET>`.
- **Gmail limits.** A normal Gmail account sends about 500 mails a day, and Workspace about 2,000. A 300-person workshop fits in one run. Larger events should be split across days or moved to a transactional provider.
- **Spool size.** A typical certificate PNG is 0.5 to 2 MB, so a 300-person batch spools up to about 600 MB in `mail_outbox` until each mail is accepted. Accepted rows drop their bytes immediately, so in practice only failures stay. The Atlas free tier has 512 MB, so do not leave hundreds of failures sitting for the full 48 h.
- **Revoking.** Use the Certificate Log. The verify page then shows the certificate as revoked, with the reason.
