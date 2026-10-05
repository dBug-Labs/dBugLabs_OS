# Team: Web Development — Backend track

**Lead:** _to be assigned_ · **Members:** _to be assigned_ (2–3 recommended)

You own the server: project setup, login, the database, every API route, the
mail outbox, deployment and backups. The frontend track builds against the
contract in [04 API](../spec/04-api.md); your job is to make that contract
true.

**Read first:** [02 Architecture](../spec/02-architecture.md),
[03 Auth](../spec/03-auth.md), [04 API](../spec/04-api.md),
[05 Data model](../spec/05-data-model.md),
[07 Email and outbox](../spec/07-email-and-outbox.md),
[08 Security](../spec/08-security.md).

**You own these paths:** `lib/`, `app/api/`, `proxy.js`, `next.config.mjs`,
`vercel.json`, `.env.example`, `package.json`.

---

## Tasks

| ID | Task | Milestone | Depends on | Estimate |
|---|---|---|---|---|
| WEB-B-01 | Project scaffold and infrastructure | M0 | — | 1 day |
| WEB-B-02 | Session library, login and logout API | M1 | 01 | 1 day |
| WEB-B-03 | Page gate, route guard, security headers | M1 | 02 | 0.5 day |
| WEB-B-04 | Certificates library and `POST /batch` | M2 | 01, SEC-03 decision | 1.5 days |
| WEB-B-07 | Mailer and email template | M2 | 01, PR-01, CRE-04 | 1 day |
| WEB-B-08 | Outbox library and drain endpoint | M2 | 07 | 1.5 days |
| WEB-B-05 | `POST /send` | M2 | 04, 08 | 0.5 day |
| WEB-B-09 | `POST /batch/:id/resend` | M2 | 08 | 0.5 day |
| WEB-B-06 | `GET /batches`, `GET /batch/:id` | M2 | 04, 08 | 0.5 day |
| WEB-B-10 | Revoke, verify API, verify rate limit | M2 | 04 | 0.5 day |
| WEB-B-11 | Request hygiene: content type, sizes, error messages | M2 | 02–10 | 0.5 day |
| WEB-B-12 | Backups | M4 | 04 | 0.5 day |
| WEB-B-13 | Production deploy, scheduler, deliverability | M4 | all | 1 day |

Order within M2: 04 → 07 → 08 → 05 → 09 → 06 → 10 → 11. Tell the frontend
track as each route lands so they can drop the mock for it.

---

## WEB-B-01 · Project scaffold and infrastructure

Create the Next.js 16 app in the repo root, matching `dbug-labs-recruitment`.

- `create-next-app` with App Router, JavaScript, ESLint, **no** Tailwind, no `src/`. Import alias `@/*`.
- Dependencies: `mongodb@7`, `nodemailer`, `papaparse`, `jszip`, `qrcode`. Use the latest versions at the time.
- `eslint.config.mjs` with `eslint-config-next/core-web-vitals` (Next 16 dropped `next lint`; run `eslint` directly).
- `.gitignore`: ignore `.env*` but keep `!.env.example`.
- `.env.example` with every variable from [10 Ops](../spec/10-deployment-and-ops.md#environment-variables), values empty.
- Infrastructure from [10 Ops one-time setup](../spec/10-deployment-and-ops.md#one-time-setup-m0-task-web-b-01): Atlas project and users, Gmail app password, Vercel project in `bom1`, env vars, Deployment Protection.
- Folder layout from [02 Architecture](../spec/02-architecture.md#folder-layout), with empty route files returning `501` so the frontend sees the shape.

**Acceptance**
- [ ] `npm run dev`, `npm run lint`, `npm run build` all succeed on a fresh clone.
- [ ] A Vercel Preview deploys from a pull request.
- [ ] `vercel env pull` gives a working `.env.local`.
- [ ] Nobody's personal account owns the Atlas project, Vercel project or sending address.

---

## WEB-B-02 · Session library, login and logout API

Implement [03 Auth](../spec/03-auth.md) exactly.

- `lib/session.js`: `createSessionToken()`, `verifySessionToken(token)`, `passwordMatches(candidate)`, `SESSION_COOKIE`, `sessionCookieOptions`. Web Crypto only.
- `lib/ratelimit.js`: `checkRateLimit(key, { limit, windowSeconds })`, `resetRateLimit(key)`, `getClientIp(request)`.
- `app/api/auth/login/route.js` and `logout/route.js` with the responses in [03 Endpoints](../spec/03-auth.md#endpoints).

**Acceptance**
- [ ] AUTH-T03 to T05, T08 to T14 pass.
- [ ] Unit check: a token signed with one `ADMIN_PASSWORD` fails to verify after it changes.
- [ ] Missing `ADMIN_PASSWORD` → every login 401. Short `SESSION_SECRET` → the app refuses to sign.
- [ ] Reviewed by Cybersecurity (SEC-02).

## WEB-B-03 · Page gate, route guard, security headers

- `proxy.js` with the matcher and rules in [03 Page gate](../spec/03-auth.md#page-gate-proxyjs).
- `lib/auth.js`: `isAdmin()`, `requireAdmin()` returning the 401 response or `null`.
- `next.config.mjs` headers from [SEC-08](../spec/08-security.md#sec-08-http-headers).
- Root metadata `robots: { index: false, follow: false }`.

**Acceptance**
- [ ] AUTH-T01, T02, T06, T07 pass.
- [ ] `curl -I` on any page shows every SEC-08 header.

---

## WEB-B-04 · Certificates library and `POST /batch`

- `lib/db.js`: lazy MongoClient singleton (create on first use, so `next build` works without a database; cache on `global` in development; clear the cached promise if connecting fails).
- `lib/certificates.js`: `certificatesCollection()` (creates indexes once per process), `normaliseCode`, `isEmail`, `normaliseLink`, `maskEmail`, `portalUrl`, `verifyUrlFor`, `createBatch`, `findPublicCertificate`, `markEmailed`.
- `createBatch` follows [04 API](../spec/04-api.md#post-apicertificatesbatch) validation order and [05 Reserving credential IDs](../spec/05-data-model.md#reserving-credential-ids): one `$inc` per code, one `insertMany`, `deleteMany({ batchId })` on failure.
- Implement the credential ID format decided in SEC-03.

**Acceptance**
- [ ] BAT-T01 to T13 pass, including the concurrency test (T12) and the rollback test (T13).
- [ ] An invalid CSV leaves every counter unchanged.
- [ ] No code outside `lib/certificates.js` builds or parses a credential ID.

## WEB-B-07 · Mailer and email template

- `lib/mailer.js`: pooled transport per [07 Transport](../spec/07-email-and-outbox.md#transport), created lazily. `sendMail({ to, subject, html, attachments })` throws on failure.
- `lib/email-template.js`: `certificateIssuedEmail({...})` and `linkedInAddUrl({...})` per [07 The email](../spec/07-email-and-outbox.md#the-email), using PR-01 copy and the CRE-04 design. Escape every value.

**Acceptance**
- [ ] SND-T09 and SND-T10 pass against the captured mail.
- [ ] The template renders correctly in MAIL-T01 to T03 (with QA).

## WEB-B-08 · Outbox library and drain endpoint

- `lib/outbox.js`: `outboxCollection()` (creates the three indexes, including TTL), `queueMail`, `claimDue` (atomic, with orphan reclaim), `drainOutbox`, `requeue`, `batchSummary`, `dueCount`, `classifyError`, constants `MAX_ATTEMPTS = 5`, `RETRY_WINDOW_HOURS = 48`, backoff `[1, 5, 15, 60, 180]` minutes, stuck threshold 3 minutes.
- `requeue` must check whether the attachment exists **without** reading its bytes (use a `$type` projection).
- `app/api/certificates/outbox/drain/route.js` (GET and POST) per [04 drain](../spec/04-api.md#get--post-apicertificatesoutboxdrainlimit20), `maxDuration = 60`.
- `vercel.json` daily cron.

**Acceptance**
- [ ] DRN-T01 to T04 pass. DRN-T04 (two concurrent drains) sends every row exactly once.
- [ ] A row left in `sending` with `lastAttemptAt` 4 minutes ago is reclaimed by the next drain.
- [ ] A certificate row with no attachment becomes `dead` and nothing is sent.

## WEB-B-05 · `POST /send`

Per [04 send](../spec/04-api.md#post-apicertificatessend). Queue, then drain
exactly the queued IDs, then `markEmailed(sent)`. `maxDuration = 60`.

**Acceptance**
- [ ] SND-T01 to T08 and T11 pass.

## WEB-B-09 · `POST /batch/:batchId/resend`

Per [04 resend](../spec/04-api.md#post-apicertificatesbatchbatchidresend).

**Acceptance**
- [ ] RES-T01 to T03 pass.

## WEB-B-06 · Log endpoints

`GET /batches` (aggregation by `batchId`, newest first, with
`batchSummary` per batch) and `GET /batch/:batchId` (records joined with
outbox rows, falling back to `emailedAt` when the row has expired, never
returning spooled bytes).

**Acceptance**
- [ ] LOG-T01 to T04 pass.
- [ ] `/batches` with 100 batches of 300 responds in under 1 s on Atlas M0. If not, add a `{ batchId, status }` index on the outbox and batch the summaries into one aggregation.

## WEB-B-10 · Revoke, verify API, verify rate limit

- `PATCH /[credentialId]/revoke` per [04](../spec/04-api.md#patch-apicertificatescredentialidrevoke).
- `GET /verify/[credentialId]` per [04](../spec/04-api.md#get-apicertificatesverifycredentialid), using `findPublicCertificate` (masked email, safe fields only).
- The 60-per-minute per-IP limit from [SEC-04](../spec/08-security.md#sec-04-verify-rate-limit) on the API and on the verify page.

**Acceptance**
- [ ] REV-T01 to T04, VER-T01, T02, T06 pass.

## WEB-B-11 · Request hygiene

- Every `POST` and `PATCH` route rejects a non-JSON content type with 415 (one shared helper).
- Length limits from [04](../spec/04-api.md) (title 150, description 500, name 120, reason 300).
- Every `catch` logs the real error with `console.error('<route> error:', err)` and returns only the generic message.
- `grep -r "dangerouslySetInnerHTML" app` returns nothing.

**Acceptance**
- [ ] AUTH-T15 passes. A 10,000-character title gets 400, not a stored record.

---

## WEB-B-12 · Backups

The `mongodump` procedure in [10 Backups](../spec/10-deployment-and-ops.md#backups-web-b-12), written as
`scripts/backup.mjs` or a documented command, run after every event batch.

**Acceptance**
- [ ] A backup restored into a scratch database verifies the same IDs as production.

## WEB-B-13 · Production deploy, scheduler, deliverability

- Production domain, `PORTAL_URL`, all Production env vars set.
- External scheduler every 5 minutes with alerting ([10](../spec/10-deployment-and-ops.md#scheduled-mail-drain)).
- The [deliverability checklist](../spec/07-email-and-outbox.md#deliverability-checklist).

**Acceptance**
- [ ] Every item in the [pilot checklist](../spec/10-deployment-and-ops.md#pilot-checklist-m5) that belongs to Web is ticked.

---

## Interfaces with other teams

| You give | To | When |
|---|---|---|
| Route stubs returning 501 | Web frontend | End of M0 |
| Each finished route, announced in the team channel | Web frontend, QA | As they land in M2 |
| A Preview URL with a seeded test database | QA, Events | M2 and M3 |
| Production deploy | Events | M5 |

| You need | From | When |
|---|---|---|
| Credential ID format decision (SEC-03) | Cybersecurity | Start of M2 |
| Email copy (PR-01) | PR | Mid M2 |
| Email design (CRE-04) | Creatives | Mid M2 |
| Anonymised sample CSV (EVT-03) | Events | Start of M2 |
| Auth review (SEC-02) | Cybersecurity | Before M1 merges |
