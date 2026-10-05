# 09 · Testing and Acceptance

How we prove each phase works before real participants get real
certificates. Owner: [QA Testing](../teams/qa.md). Every team runs the cases
for their own pull requests; QA runs the full set at M1, M2, M3 and M4.

---

## Test environment

No test ever touches the production database or sends to a real person.

| Piece | Setup |
|---|---|
| App | `npm run build && npm start` locally, or a Vercel Preview deployment |
| Database | A separate database name, e.g. `MONGODB_DB=dbos_test`, dropped before each full run. Locally, `mongodb-memory-server` works without installing MongoDB. |
| Mail | A local SMTP catcher. Options: Mailpit (Docker), or a 30-line `smtp-server` script. Never real Gmail. |
| Bounce convention | The catcher rejects any recipient starting with `bounce` with `550 No such user`, and any starting with `slow` with `421 Try again later`. Same convention as the frontend mocks in [04 API](04-api.md#mocking-for-the-frontend). |
| STARTTLS | Disable it on the catcher (`disabledCommands: ['STARTTLS']` in `smtp-server`), or nodemailer will refuse its self-signed certificate and every send fails with "certificate has expired". |
| Env | `ADMIN_PASSWORD=test-pass-123`, `SESSION_SECRET` = 36 characters, `PORTAL_URL=http://localhost:3100`, `CRON_SECRET=cron-test`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=2525` |

### Test data

QA keeps these in `tests/fixtures/` (fake people only, never real participant
data):

| File | Contents |
|---|---|
| `clean-5.csv` | 5 valid rows, two codes |
| `clean-300.csv` | 300 valid rows (load test) |
| `headers-variant.csv` | Headers `Full Name`, `Email Address`, `Team Code` |
| `bad-rows.csv` | Missing name, bad email, missing code, empty row, row with only spaces |
| `hostile.csv` | Names `<b>Bold</b>`, `<a href="https://evil.example">Claim</a>`, `=HYPERLINK("http://x","y")`, `Ünïcødé Nâmé`, a 120-character name, an emoji name |
| `bounce.csv` | 3 normal rows, 1 `bounce@…`, 1 `slow@…` |
| `bom-crlf.csv` | Same as clean-5, saved with a UTF-8 BOM and Windows line endings |
| `template-a4-300dpi.png` | 3508 × 2480 template from Creatives |
| `template-small.jpg` | 1200 × 850 template |

---

## Automated API tests

QA writes these as a Node script (`tests/api.e2e.mjs`) using plain `fetch`
against a running app. It must run in under a minute and exit non-zero on any
failure, so it can run in CI later.

### Auth

| ID | Case | Expected |
|---|---|---|
| AUTH-T01 | `GET /admin/certificates` with no cookie | 307 to `/login?next=%2Fadmin%2Fcertificates` |
| AUTH-T02 | Any admin API with no cookie | 401 `Not signed in` |
| AUTH-T03 | Login with the wrong password | 401 `Wrong password` |
| AUTH-T04 | Login with no body / non-JSON body / `password: 123` | 401 (or 415 for the wrong content type), never 500 |
| AUTH-T05 | Login with the right password | 200; `Set-Cookie: dbos_session=…; HttpOnly; SameSite=lax; Max-Age=43200` |
| AUTH-T06 | Admin page with the cookie | 200 |
| AUTH-T07 | `/login` with the cookie | 307 to `/admin/certificates` |
| AUTH-T08 | Cookie with one character of the signature changed | 401 |
| AUTH-T09 | Cookie with the expiry changed to a later time | 401 |
| AUTH-T10 | Cookie built with an expiry in the past (correctly signed in a test helper) | 401 |
| AUTH-T11 | Restart the app with a different `ADMIN_PASSWORD`, reuse the old cookie | 401 |
| AUTH-T12 | 6 wrong logins from one IP within 15 min | 6th is 429 with `Retry-After` |
| AUTH-T13 | After 5 wrong attempts, one right attempt from another IP | 200 |
| AUTH-T14 | Logout | 200; cookie cleared (`Max-Age=0` or past `Expires`) |
| AUTH-T15 | `POST /api/certificates/batch` with `Content-Type: text/plain` and a valid cookie | 415 |
| AUTH-T16 | Login page with `?next=//evil.example` then sign in | Lands on `/admin/certificates` (browser test) |

### Batch

| ID | Case | Expected |
|---|---|---|
| BAT-T01 | Empty `recipients` | 400 |
| BAT-T02 | 1,001 recipients | 400 |
| BAT-T03 | Invalid `type` | 400 `Invalid certificate type` |
| BAT-T04 | Missing / whitespace title | 400 `Certificate title is required` |
| BAT-T05 | `driveLink: "javascript:alert(1)"` | 400 |
| BAT-T06 | `driveLink: "drive.google.com/x"` (no scheme) | 400 |
| BAT-T07 | 3 rows: valid, missing name, bad email | 400, `invalid` = rows 2 and 3 with reasons; **no** records created; counter unchanged |
| BAT-T08 | 4 valid rows, codes `ws`, `WS`, `web dev`, `WS` | 201; IDs `…WS-YY-0001`, `…0002`, `…WEBDEV-YY-0001`, `…WS-YY-0003` in input order (adjust for SEC-03 suffix) |
| BAT-T09 | Email `Asha@Example.COM` | Stored and returned as `asha@example.com` |
| BAT-T10 | Next batch with code `WS` | Continues at `0004` |
| BAT-T11 | `verifyUrl` | Equals `PORTAL_URL + /verify/ + id`, regardless of the request's host |
| BAT-T12 | Two batches of 50 `WS` rows posted at the same moment | 100 distinct IDs, no gaps or overlaps between the two ranges |
| BAT-T13 | Force an insert failure (e.g. pre-insert a document with the next ID) | 500; zero records for that `batchId` |

### Send

| ID | Case | Expected |
|---|---|---|
| SND-T01 | 6 items | 413 |
| SND-T02 | Items from another batch | 404 `No matching certificates in this batch` |
| SND-T03 | 4 items incl. one `bounce@` | 200; `sent: 3`, `dead` has the bounce with `550` in the error |
| SND-T04 | One `slow@` item | 200; it is in `failed`; outbox row `failed` with `nextRetryAt` ≈ now + 1 min |
| SND-T05 | Same item sent twice | One outbox row, not two; second send does not duplicate mail if the first was accepted |
| SND-T06 | `mimeType: image/jpeg` | Attachment filename ends `.jpg`, content type `image/jpeg` |
| SND-T07 | `imageBase64` with a `data:image/png;base64,` prefix | Accepted; prefix stripped |
| SND-T08 | Empty `imageBase64` | Row ends `dead` with "Attachment expired…" and no mail is sent |
| SND-T09 | Captured mail | Has the attachment with `Content-Disposition: attachment`, an inline `cid:certificate` image, verify link, LinkedIn link, Drive link when set |
| SND-T10 | `hostile.csv` names and a title `Git & <GitHub>` | Captured HTML contains `&lt;b&gt;`, `&amp; &lt;GitHub&gt;`; no live `<a href="https://evil.example">` |
| SND-T11 | After a successful send | Certificate `emailedAt` set; outbox row has no `attachment` |

### Resend, log, revoke, verify, drain

| ID | Case | Expected |
|---|---|---|
| RES-T01 | Resend a batch with one dead row | `requeued: 1`; it is attempted again |
| RES-T02 | Resend only an already-sent ID | `requeued: 0`, `message: "Nothing to resend."` |
| RES-T03 | Resend after removing a row's attachment (simulates 48 h expiry) | It appears in `missingAttachment`; not requeued |
| LOG-T01 | `GET /batches` after BAT/SND tests | Counts match: `emailed`, `mail.dead`, `codes` |
| LOG-T02 | `GET /batch/:id` | Rows sorted by ID; raw SMTP error present; response body does not contain any spooled base64 |
| LOG-T03 | Delete a sent row's outbox document, then `GET /batch/:id` | That row shows `status: sent` from `emailedAt` |
| LOG-T04 | Unknown batch | 404 |
| REV-T01 | Revoke with a reason | 200 `revoked: true`; verify shows revoked and the reason |
| REV-T02 | Revoke with an empty reason | Reason stored as "Revoked by dBug Labs" |
| REV-T03 | Restore | 200 `revoked: false`; verify shows valid |
| REV-T04 | Unknown ID | 404 |
| VER-T01 | Verify API for a valid ID, no cookie | 200; email masked (`rohan@…` → `ro•••@…`); no `batchId`, no full email |
| VER-T02 | Unknown ID | 404 |
| VER-T03 | Verify page for valid / revoked / unknown | Green / red / red banners with the right text |
| VER-T04 | Verify page `/verify/%25zz` | 200 "No certificate exists", never 500 |
| VER-T05 | Verify page with the database stopped | "Verification is unavailable right now", never "not found" |
| VER-T06 | 61 verify calls in a minute from one IP | 61st is 429 (SEC-04) |
| DRN-T01 | Drain without a secret / with the wrong secret | 401 |
| DRN-T02 | Drain with `CRON_SECRET` unset on the server | 503 |
| DRN-T03 | Drain with the secret, after SND-T04's retry time has passed | The `slow@` row is attempted again; `remaining` reported |
| DRN-T04 | Two drains started at once over 10 due rows | Every row sent exactly once (count captured mails) |

---

## Manual browser tests

Run on Chrome (Windows), Edge, Firefox, Safari (macOS), and Chrome on Android
for the verify page. Record results in the M3/M4 pull request.

| ID | Case | Expected |
|---|---|---|
| UI-T01 | Upload `template-a4-300dpi.png` | Preview shows it; size reads 3508 × 2480; name, QR and ID appear at the default positions |
| UI-T02 | Switch to `template-small.jpg` | Layout resets to positions scaled for the new size |
| UI-T03 | Upload `headers-variant.csv` | "5 recipients loaded" |
| UI-T04 | Upload `bad-rows.csv` | Amber box with spreadsheet row numbers; Generate disabled |
| UI-T05 | Upload `bom-crlf.csv` | Loads cleanly; first name has no stray characters |
| UI-T06 | Each font in the picker | Preview visibly changes to that face (not a fallback) within a second |
| UI-T07 | Bold and italic on Playfair Display | Applied in the preview and in the downloaded PNG |
| UI-T08 | Click-to-place in each mode | Item moves to the click point; the QR centres on the click |
| UI-T09 | Type X/Y values | Item moves exactly; values persist when switching modes |
| UI-T10 | Drag the QR size slider fast | No flicker of an older QR size |
| UI-T11 | Generate `clean-5.csv` | ZIP downloads before mail starts; 5 PNGs named `<Name>_<ID>.png`; each matches the preview |
| UI-T12 | Scan each QR in the ZIP with a phone | Opens `PORTAL_URL/verify/<that ID>`, shows the right name |
| UI-T13 | Generate `bounce.csv` | Resend modal lists the bounce (550) and slow (421) rows with errors |
| UI-T14 | Resend from the modal | Counts update; bounce stays failed |
| UI-T15 | Reload the page after a failed run, then Resend from the log | Works from the server spool |
| UI-T16 | Generate with a 3508 × 2480 template and a detailed background | Mail copy becomes JPEG; ZIP copy stays PNG |
| UI-T17 | Close the tab during "Sending emails…" | Browser asks to confirm; if closed, the drain finishes the remaining mail later |
| UI-T18 | Let the session expire (or delete the cookie) mid-run | Clear message; ZIP already downloaded; no crash |
| UI-T19 | Log page: expand, resend one row, revoke, restore, export CSV | Each works; export opens in Excel without running formulas from `hostile.csv` |
| UI-T20 | 360 px wide phone | Login, log and verify pages usable; nothing scrolls sideways except tables |
| UI-T21 | Keyboard only | Every control reachable with Tab, focus visible, Enter activates |

### Mail client checks (MAIL-T)

Send one real certificate to a QA member's own addresses (not participants),
from a **Preview** deployment pointed at the real SMTP account:

| ID | Client | Check |
|---|---|---|
| MAIL-T01 | Gmail web | Lands in inbox; image inline; paperclip present; all buttons work |
| MAIL-T02 | Gmail Android and iOS | Same; layout fits; readable in light and dark mode |
| MAIL-T03 | Outlook web | Same |
| MAIL-T04 | College mail (`@srmist.edu.in`) | Not in spam |
| MAIL-T05 | LinkedIn button | Opens LinkedIn's add-certification form pre-filled with title, issuer, ID and URL |

---

## Load test (LOAD-T)

| ID | Case | Pass |
|---|---|---|
| LOAD-T01 | `clean-300.csv` with the A4 template against the test SMTP catcher | Completes; no request over 4.5 MB (check the network tab); browser memory stays reasonable; all 300 captured |
| LOAD-T02 | Same, with the catcher failing 10 % of recipients randomly | Exactly those appear in the modal and the log; resend clears them |

---

## Exit criteria per milestone

| Milestone | Must pass |
|---|---|
| M1 | AUTH-T01 to T16 on a Preview deployment |
| M2 | Every BAT, SND, RES, LOG, REV, VER, DRN case in the automated suite |
| M3 | UI-T01 to T21 |
| M4 | Full automated suite on Preview; MAIL-T01 to T05; LOAD-T01 and T02; the SEC-11 checklist; zero open S1/S2 bugs |
| M5 | Pilot checklist in [10 Ops](10-deployment-and-ops.md#pilot-checklist-m5) |

---

## Reporting bugs

Open a GitHub issue with:

- **Title:** `[S1–S4] <what is wrong>`, e.g. `[S2] Resend modal shows success when the chunk returned 500`
- **Case ID** it was found by, if any
- **Steps**, **expected**, **actual**
- Browser and OS, or the API request and response
- Screenshot or captured email if relevant
- Never attach a real participant CSV.

Severity definitions: [docs index](../README.md#bug-severity).
