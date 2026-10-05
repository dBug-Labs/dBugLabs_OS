# Team: Web Development — Frontend track

**Lead:** _to be assigned_ · **Members:** _to be assigned_ (2–3 recommended)

You own every screen: login, the admin shell, the generator (canvas, CSV,
ZIP, chunked sending, resend), the certificate log, and the public verify
page. You build against the contract in [04 API](../spec/04-api.md), with mocks
until each backend route lands.

**Read first:** [02 Architecture](../spec/02-architecture.md),
[03 Auth: login page and admin shell](../spec/03-auth.md#login-page-login),
[04 API](../spec/04-api.md),
[06 Generator UI](../spec/06-generator-ui.md) (your main spec).

**You own these paths:** everything under `app/` except `app/api/`. Shared:
`app/globals.css` (changes reviewed by the backend track too).

---

## Tasks

| ID | Task | Milestone | Depends on | Estimate |
|---|---|---|---|---|
| WEB-F-01 | Design system: fonts, tokens, shared components | M1 | WEB-B-01, CRE-01 | 1 day |
| WEB-F-02 | Login page and admin shell | M1 | F-01, WEB-B-02 | 1 day |
| WEB-F-03 | Generator: template, recipients, details | M3 | F-01 | 1 day |
| WEB-F-04 | Generator: canvas, preview, fonts, placement | M3 | F-03 | 1.5 days |
| WEB-F-05 | Generator: the run (batch, render, ZIP, chunked send, progress) | M3 | F-04, mocks or WEB-B-04/05 | 1.5 days |
| WEB-F-06 | Resend modal and notices | M3 | F-05 | 0.5 day |
| WEB-F-07 | Certificate log page | M3 | F-01, WEB-B-06/09/10 or mocks | 1 day |
| WEB-F-08 | Verify page | M3 | F-01, WEB-B-04 | 0.5 day |
| WEB-F-09 | Responsive and accessibility pass | M4 | all | 0.5 day |

F-03 to F-08 can start during M2 against mocks ([04 Mocking](../spec/04-api.md#mocking-for-the-frontend)).
Keep mocks behind one flag in one file so removing them is a one-line change.

---

## WEB-F-01 · Design system

- In `app/layout.jsx`, load Anton, Oswald, Barlow, Playfair Display (400, 700, normal and italic) and Great Vibes through `next/font/google`, each exposed as a CSS variable (`--font-anton`, …). The canvas depends on these variables ([06 Fonts](../spec/06-generator-ui.md#fonts)).
- `app/globals.css` with the tokens in [06 Visual language](../spec/06-generator-ui.md#visual-language), applied to the CRE-01 designs.
- Shared classes or components: buttons (primary, ghost, soft; sizes), input, select, file picker, segmented switch, toggle, notice (error, success, info), modal, status chip, tag, spinner, progress bar, panel, table.

**Acceptance**
- [ ] A scratch page shows every component in every state, matching CRE-01.
- [ ] Text contrast is at least 4.5:1 (checked with the browser's accessibility tools).

## WEB-F-02 · Login page and admin shell

Per [03 Login page](../spec/03-auth.md#login-page-login) and
[03 Admin shell](../spec/03-auth.md#admin-shell).

- `app/login/page.jsx` and `LoginForm.jsx` inside `<Suspense>`. Accept `?next=` only when it starts with a single `/`.
- After a successful login, navigate with a full page load (so the proxy sees the cookie).
- `app/admin/layout.jsx` (server: checks `isAdmin()`, redirects) and `AdminNav.jsx` (links with the active state; logout → `router.replace('/login')` and `router.refresh()`).
- `app/page.jsx` and `app/admin/page.jsx` redirect to `/admin/certificates`.

**Acceptance**
- [ ] AUTH-T16 passes.
- [ ] Wrong password shows the API's message under the field; the button shows *Checking…* while waiting.
- [ ] PR-02 copy applied.

---

## WEB-F-03 · Generator: template, recipients, details

Steps 1–3 of [06](../spec/06-generator-ui.md#step-1-template).

- Template upload with object URLs (revoke the old one), natural size, the default layout scaled to the image.
- CSV parsing with the exact aliases and checks, spreadsheet row numbers, the amber issues box, the green count, the sample CSV download.
- Single person mode with the code upper-cased as typed.
- Details: type select, title, description, Drive link with the hint.

**Acceptance**
- [ ] UI-T01 to T05 pass.

## WEB-F-04 · Generator: canvas, preview, fonts, placement

Steps 4–5 and [The preview](../spec/06-generator-ui.md#the-preview).

- A single `paint(ctx, template, style, { name, credentialId, qr })` used by the preview and the real render.
- QR preview generated once per size change with `QRCode.toCanvas` into state, with a cancelled flag. Never draw from an `onload` callback.
- Fonts: resolve the family from the CSS variable at draw time; `document.fonts.load()` on every font, weight or style change, then redraw.
- Placement: click-to-place (QR by its centre), X/Y inputs, centre buttons, size sliders, the show-ID checkbox, "Placing: …" label.

**Acceptance**
- [ ] UI-T06 to T10 pass.
- [ ] On a 3508 × 2480 template, dragging the size slider stays smooth on a mid-range laptop.

## WEB-F-05 · Generator: the run

Exactly the sequence in [06 Pressing Generate](../spec/06-generator-ui.md#pressing-generate)
and [Rendering a certificate](../spec/06-generator-ui.md#rendering-a-certificate).

- The QR encodes `verifyUrl` **from the `/batch` response**. Never `window.location`.
- ZIP before any mail. ZIP entries are always PNG; the mail copy becomes JPEG (0.92 → 0.80 → 0.65) only when it is over 3,400,000 base64 characters.
- Chunking: ≤3 items and ≤3,400,000 characters per `/send`, sent one at a time.
- Progress box with the four phases; `beforeunload` warning during the run.
- 401 handling: never navigate away mid-run; show the message, keep the ZIP.
- Generate button rules and its count label.

**Acceptance**
- [ ] UI-T11, T12, T16, T17, T18 pass.
- [ ] LOAD-T01: no request in the network tab is over 4.5 MB.

## WEB-F-06 · Resend modal and notices

[06 Resend modal](../spec/06-generator-ui.md#resend-modal) and
[Notices](../spec/06-generator-ui.md#notices).

- Opens automatically when a run has failures.
- *Resend these* reuses the in-memory images through `/send` when all are present, else falls back to `/batch/:id/resend`.
- *Later* closes it.

**Acceptance**
- [ ] UI-T13 to T15 pass.

**Stretch:** a "Preview longest name" toggle that puts the longest CSV name into
the preview, so overflow is caught before generating.

## WEB-F-07 · Certificate log page

[06 Certificate log](../spec/06-generator-ui.md#certificate-log-admincertificateslogs).

- Batch cards with counts (Accepted from `emailed`), expand to load detail.
- The table with chips, attempts, truncated errors with full text on hover, retry-window countdown, verify links.
- Resend one, resend all, revoke (prompt for a public reason), restore (confirm), export failures as CSV with formula-injection protection ([SEC-07](../spec/08-security.md#sec-07-csv-export-safety)).
- 401 → `/login?next=/admin/certificates/logs`.

**Acceptance**
- [ ] UI-T19 passes, including opening the export in Excel with `hostile.csv` data.

## WEB-F-08 · Verify page

[06 Verify page](../spec/06-generator-ui.md#verify-page-verifycredentialid).

- Server component, `dynamic = 'force-dynamic'`, reads with `findPublicCertificate`.
- Four states: valid, revoked, not found, unavailable. "Unavailable" is never shown as "not found".
- Safe decoding of the path parameter. Text only, no raw HTML.
- PR-03 copy. Must look right on a phone first.

**Acceptance**
- [ ] VER-T03 to T05 pass on desktop and Android Chrome.

## WEB-F-09 · Responsive and accessibility pass

[06 Accessibility](../spec/06-generator-ui.md#accessibility) and breakpoints.

**Acceptance**
- [ ] UI-T20 and T21 pass.
- [ ] Lighthouse accessibility score ≥ 90 on login, log and verify pages.

---

## Interfaces with other teams

| You need | From | When |
|---|---|---|
| Screen designs (CRE-01) | Creatives | Start of M1 for login; start of M3 for the rest |
| A real template (CRE-02) | Creatives | Start of M3 |
| UI and verify copy (PR-02, PR-03) | PR | Mid M3 |
| Route stubs, then real routes | Web backend | M0, then through M2 |

| You give | To | When |
|---|---|---|
| A Preview build of each screen | Creatives (design review), QA | As each lands |
| A walkthrough of the generator | Events (EVT-04) | End of M3 |
