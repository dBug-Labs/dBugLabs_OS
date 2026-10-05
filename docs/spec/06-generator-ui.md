# 06 · Generator UI

Every screen in Phase 2: the generator, the certificate log, and the public
verify page. The login page and admin shell are in [03 Auth](03-auth.md#login-page-login).

Owner: [Web frontend](../teams/web-frontend.md). Visual design:
[Creatives](../teams/creatives.md). Copy: [PR](../teams/pr.md).

---

## Visual language

Same identity as the dBug Labs recruitment site.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08050a` | Page background (with soft red and purple radial glows) |
| `--panel` | `rgba(18,11,22,.78)` | Cards and panels |
| `--text` | `#f4eef6` | Body text |
| `--muted` | `#a99bad` | Secondary text |
| `--dim` | `#76697a` | Hints |
| `--red` / `--red-soft` | `#ff2d4f` / `#ff5a72` | Accent, errors, credential IDs |
| `--purple` / `--purple-soft` | `#8b3dff` / `#b06bff` | Accent, focus rings, links |
| `--grad` | `linear-gradient(95deg,#f2334f,#8b3dff)` | Primary buttons, step numbers, progress |
| `--grad-text` | `linear-gradient(100deg,#f4304c,#e02a63 30%,#a92fb4 62%,#7c3aed 90%)` | Page headings |
| Display font | Anton, uppercase | Page headings |
| Heading font | Oswald | Buttons, labels, step titles, nav |
| Body font | Barlow | Everything else |
| Mono | Consolas / Courier New | Credential IDs, codes, colours |

Dark only. The certificates themselves are whatever the template is; the UI
theme never touches them.

Breakpoints: below 960 px the generator becomes one column with the preview
on top; below 560 px the top bar wraps and tables scroll sideways. Nothing
scrolls the page horizontally at 360 px wide.

---

## The generator (`/admin/certificates`)

### Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ MODULE 01                                                                 │
│ CERTIFICATE GENERATOR                               [ Certificate log → ] │
│ Design once, issue to everyone, with a QR that proves each one is real.   │
├──────────────────────────────┬────────────────────────────────────────────┤
│ ① Template                   │ LIVE PREVIEW            Placing: Name      │
│ ② Recipients  [CSV|Single]   │ ┌────────────────────────────────────────┐ │
│ ③ Details                    │ │                                        │ │
│ ④ Name style                 │ │        template with Sample Name,      │ │
│ ⑤ Placement  [Name|QR|ID]    │ │        sample credential ID and QR     │ │
│                              │ │        (click to place)                │ │
│ [progress, during a run]     │ │                                        │ │
│ [ GENERATE, DOWNLOAD & EMAIL ]│ └────────────────────────────────────────┘ │
└──────────────────────────────┴────────────────────────────────────────────┘
```

Left column 320–400 px wide; the preview fills the rest and stays in view
(sticky) while the controls scroll.

### Step 1: Template

| Item | Rule |
|---|---|
| Input | File picker accepting `image/png`, `image/jpeg`, `image/webp` |
| Load | `new Image()` with `src = URL.createObjectURL(file)`. Use `naturalWidth` / `naturalHeight` everywhere. Revoke the previous object URL when a new template is chosen. |
| Unreadable file | Error notice: "That file could not be read as an image." |
| Shown | File name, and `W × H px` under it |
| Recommended | Landscape A4 at 150–300 dpi (3508 × 2480 px at 300 dpi). Shown as the placeholder text. |
| On load | Reset the layout to defaults scaled to the image (below), so a new template never inherits pixel positions from an old one of a different size |

Default layout for a template of width `w` and height `h`:

| Item | Default |
|---|---|
| Name position | centre: `(w/2, h/2)` |
| Name size | `round(w / 22)` px |
| QR size | `round(min(w, h) × 0.13)` px |
| QR position (top-left corner) | `(w − qr − 0.05w, h − qr − 0.06h)`, bottom right |
| Credential ID position | `(0.05w, 0.94h)`, bottom left |
| Credential ID size | `max(10, round(w / 95))` px |
| Name colour | `#111111` |
| Font | Playfair Display |

### Step 2: Recipients

A two-way switch: **CSV upload** or **Single person**.

**CSV mode**

| Item | Rule |
|---|---|
| Parser | PapaParse, `header: true`, `skipEmptyLines: 'greedy'` |
| Header matching | Case-insensitive, trimmed, against these aliases (first non-empty match wins): |
| | name: `name`, `full name`, `fullname`, `full_name` |
| | email: `email`, `mail`, `email address`, `email_address` |
| | code: `code`, `team code`, `teamcode`, `team_code`, `team`, `event code`, `event_code`, `event` |
| Checks per row | name present; email matches `^[^\s@]+@[^\s@]+\.[^\s@]+$`; code present. First failure per row only. |
| Row numbers | Spreadsheet rows: the first data row is **row 2** |
| No data rows | Issue: "The CSV has no data rows." |
| All good | Green hint: "N recipients loaded" |
| Problems | Amber box: "N rows need fixing", first 8 listed. *Generate* stays disabled until a clean CSV is loaded. |
| Help | "`code` is a team or event code (e.g. `WS`) and becomes part of the credential ID. Don't add an ID column." plus a **Download a sample CSV** link |
| Sample CSV | `name,email,code` header and two example rows with `example.com` addresses |
| Duplicates | Not blocked in v1 (one person can legitimately receive two certificates). Phase 3 may warn. |

**Single person mode**: three inputs (full name, email, code). Code is
upper-cased as it is typed.

### Step 3: Details

| Field | Rule |
|---|---|
| Type | Select: Participation, Completion, Appreciation, Custom |
| Title | Required. Placeholder "Title (e.g. Git & GitHub Workshop)" |
| Description | Optional |
| Drive folder link | Optional, `type="url"`. Hint: "The Drive link goes in every email as a fallback. Create the folder and paste its link before generating, because mail is sent in the same run." |

### Step 4: Name style

| Control | Values |
|---|---|
| Font | Playfair Display, Great Vibes (script), Anton, Oswald, Barlow, Georgia, Times New Roman, Arial |
| Size | Number input, 8–400 px |
| Bold, Italic | Toggle buttons |
| Colour | Colour picker with the hex shown next to it |

#### Fonts

A canvas can only draw with a font the page has **already loaded**. If it is
not loaded, the canvas silently uses a fallback, and every certificate in the
batch comes out in the wrong font. This was SQAC bug #4.

Rules:

1. Every font in the picker is either loaded through `next/font/google` in `app/layout.jsx` (and exposed as a CSS variable), or is a system font available on Windows and macOS.
2. To draw, read the real family name from the CSS variable at draw time: `getComputedStyle(document.documentElement).getPropertyValue('--font-playfair')`. `next/font` generates the family name, so it cannot be hard-coded.
3. The canvas font string is `"<italic|normal> <bold|normal> <size>px <family>"`.
4. Whenever the font, weight or style changes, call `document.fonts.load(fontString, sampleText)` and redraw the preview when it resolves.
5. Before rendering a batch, `await document.fonts.load(...)` again.

### Step 5: Placement

| Control | Behaviour |
|---|---|
| Mode switch | Name, QR code, Credential ID |
| Click on the preview | Moves the selected item. Convert the click from screen pixels to template pixels with `canvas.width / rect.width`. Name and ID: the click is the anchor point. QR: the click is the **centre** of the QR. |
| X, Y inputs | Exact values in template pixels for the selected item. Name: centre point. QR: top-left corner. ID: left end of the text's middle line. |
| Center horizontally / vertically | Centres the selected item on the template |
| QR size slider | 60–600 px (QR mode only) |
| ID size slider | 8–64 px (ID mode only) |
| Print credential ID | Checkbox (ID mode only), on by default |

The preview header shows "Placing: <item>". The canvas cursor is a crosshair.

### The preview

Drawn by the same `paint()` function as the real certificates, so what you
see is what gets issued.

| Element | Preview value |
|---|---|
| Name | Manual name, else the first CSV name, else "Sample Name" |
| Credential ID | `DBUG-<first code or "CODE">-<YY>-0001` (shaped like a real one so the admin can judge the space) |
| QR | A real QR for `<origin>/verify/SAMPLE` at the chosen size |

The QR is generated **once per size change** into an off-screen canvas
(`QRCode.toCanvas`) and kept in state. The paint function draws it
synchronously. Never draw a QR from inside an image `onload` callback; that is
SQAC bug #5. A cancelled-flag in the effect stops an older QR from replacing a
newer one.

The preview redraws when the template, any style value, the preview name, the
QR or a font load changes. It must stay smooth on a 3508 × 2480 template on a
mid-range laptop. If it doesn't, throttle redraws to animation frames.

### `paint(ctx, template, style, { name, credentialId, qr })`

In this order:

1. Size the canvas to the template's natural size and draw the template at (0, 0).
2. Name: font from step 4, `fillStyle` = colour, `textAlign = 'center'`, `textBaseline = 'middle'`, at the name point.
3. Credential ID (if shown): `<credSize>px monospace`, same colour, `textAlign = 'left'`, at the ID point.
4. QR: with `imageSmoothingEnabled = false` (keeps the modules crisp), draw at the QR corner, `qrSize × qrSize`, then switch smoothing back on.

Names are never wrapped or shrunk automatically in v1. A very long name that
runs off the design is visible in the preview using the longest CSV name (see
WEB-F-06's stretch goal).

### Rendering a certificate

```
render({ name, credentialId, verifyUrl }):
  qr      = QRCode.toCanvas(verifyUrl, width = qrSize, margin = 1, ECC = 'M')
  canvas  = paint(...)
  png     = canvas.toDataURL('image/png')            → goes in the ZIP
  mail    = png
  for quality in [0.92, 0.80, 0.65]:
     if length(mail) ≤ 3,400,000 chars: break
     mail = canvas.toDataURL('image/jpeg', quality)  → goes in the email
  return { png, mail, mailMime }
```

- The QR **must** encode `verifyUrl` from the `/batch` response. Never build it from `window.location`. Production QR codes must point at production, whatever URL the admin happened to open.
- The ZIP always holds the lossless PNG. Only the mail copy may be JPEG. This fixes SQAC bug #6.
- ZIP entry name: `<name with non-word characters replaced by _>_<credentialId>.png`.

### Pressing Generate

*Generate* is enabled only when there is a template, a title, and either a
clean CSV with at least one row or all three single-person fields. Its label
includes the count when there is more than one recipient:
"Generate, download & email (120)".

```
1. Validate (template, title, recipients, every recipient has name/email/code).
2. Clear the previous run's notice, failure report and in-memory images.
3. Progress: "Reserving credential IDs…"
4. await document.fonts.load(current name font)
5. POST /api/certificates/batch
     401 → stop: "Your session expired. Sign in again."
     400 with invalid[] → stop and show each "Row N: reason"
6. For each issued certificate, in order:
     render → add PNG to ZIP → keep { credentialId, name, email, mail, mailMime } in memory
     progress "Rendering certificates…  i / n"
7. Progress "Building the ZIP…", generate the blob, download
     dBugLabs_Certificates_<batchId>.zip
8. Progress "Sending emails…  0 / n · 0 accepted"
9. Split the kept entries into chunks: a new chunk starts when the current one
   has 3 items, or adding the next would pass 3,400,000 chars of base64.
10. POST each chunk to /api/certificates/send, one at a time.
     ok     → add `sent`; every item in failed[] and dead[] becomes a failure
     not ok → every item in the chunk becomes a failure with the error text
     401    → every item fails with "Your session expired. Sign in again, then use Resend."
     network error → every item fails with the error message
     progress "Sending emails…  done / n · S accepted · F failed"
11. No failures → green notice "All n certificates generated, downloaded and emailed."
    Failures   → the resend modal
```

The browser tab must stay open until step 7 finishes. During steps 3–10 the
page warns before unloading (`beforeunload`) with "Certificates are still being
generated."

### Progress box

Shown above the Generate button during a run.

| Phase | Label | Counter |
|---|---|---|
| reserving | Reserving credential IDs… | 0 / n |
| rendering | Rendering certificates… | i / n |
| zipping | Building the ZIP… | n / n |
| mailing | Sending emails… | done / n, then "S accepted · F failed" |

A gradient bar shows `done / total`. The Generate button reads "Working…" and
is disabled.

### Resend modal

Opens automatically after a run if any mail failed. The admin is **asked**;
they never have to go looking for failures.

```
┌──────────────────────────────────────────────┐
│  3 emails didn't go out                       │
│  117 of 120 were accepted by the mail server. │
│  The certificates are safe in your ZIP; only  │
│  the delivery failed.                         │
│ ┌──────────────────────────────────────────┐ │
│ │ rohan@exmaple.com      DBUG-WS-26-0002   │ │
│ │ 550 5.1.1 No such user                   │ │
│ │ …                                        │ │
│ └──────────────────────────────────────────┘ │
│        [ Later ]        [ Resend these ]      │
│  You can also retry later from the            │
│  Certificate log.                             │
└──────────────────────────────────────────────┘
```

*Resend these*:

1. If every failed certificate's mail copy is still in memory, post them again through `/send` (this also refreshes the server's spooled copy).
2. Otherwise (the page was reloaded), call `/batch/<batchId>/resend` with their IDs, which uses the server's spool.
3. All accepted → close the modal, green notice. Some still failing → update the list and counts.

*Later* closes the modal. The failures are still in the certificate log.

### Notices

One notice area under the page heading: error (red), success (green) or info
(blue), dismissible with ×, `white-space: pre-line` so row lists show one per
line, `role="status"`.

---

## Certificate log (`/admin/certificates/logs`)

### Layout

Page heading "Certificate Log" with "Every batch issued, and whether the mail
actually went out." Buttons: *Refresh*, *New batch*.

One card per batch, newest first (up to 30):

```
┌───────────────────────────────────────────────────────────────────────┐
│ Git & GitHub Workshop                             117    3      0    ⌄ │
│ 5 Oct 2026, 2:17 pm · 120 certificates · PARTICIPATION                 │
│ [WS]                                          Accepted Failed Queued   │
└───────────────────────────────────────────────────────────────────────┘
```

| Number | Source |
|---|---|
| Accepted | `emailed` (stays right after outbox rows expire) |
| Failed | `mail.failed + mail.dead` (red when > 0) |
| Queued | `mail.queued + mail.sending` (blue when > 0) |
| Revoked | Shown after the type when > 0: "· 2 revoked" |

### Expanded batch

Loads `/api/certificates/batch/<id>`. Above the table: "Failed mail can be
resent for 48h after sending. After that, regenerate the certificate." The
Drive link if set. Buttons: *Export failures (CSV)* and *Resend all failed*
(disabled when nothing failed).

Table (min-width 760 px, scrolls sideways on phones):

| Column | Content |
|---|---|
| Recipient | Name, email under it |
| Code | Code tag |
| Credential ID | Link to `/verify/<id>` in a new tab; red "REVOKED" tag if revoked |
| Mail | Status chip (Accepted, Queued, Sending, Retrying, Failed, Not emailed); "N tries" when attempts > 1 |
| Detail | Accepted: time. Otherwise the raw error, truncated with the full text on hover. For failed/dead rows: "retryable · 31h left" (amber) or "retry window expired, regenerate" (red). |
| Actions | *Resend* (failed/dead, window not expired) · *Revoke* or *Restore* |

Status chip colours: Accepted green, Queued/Sending blue, Retrying amber,
Failed red, Not emailed grey.

Under the table: "'Accepted' means the mail server took the message. It is not
proof it reached the inbox: SMTP gives no delivery receipt."

### Actions

| Action | Behaviour |
|---|---|
| Resend (row) | `POST /batch/<id>/resend` with that one ID. Toast with the result, then reload the batch and the list. |
| Resend all failed | Same without IDs. Toast: "S accepted · P still queued · D permanently failed · M past the retry window, regenerate those" (only the non-zero parts). If `requeued` is 0, show the API's `message`. |
| Revoke | Prompt for a reason (default "Issued in error"; this text is public). Cancel does nothing. Then `PATCH …/revoke`. |
| Restore | Confirm "Restore <id>? It will verify as valid again." Then `PATCH …/revoke` with `undo: true`. |
| Export failures | Downloads `failed_<batchId>.csv` with columns `name,email,code,credentialId,status,error`, every cell quoted with `"` doubled, for rows that are failed, dead or not emailed. |
| Any 401 | Send the admin to `/login?next=/admin/certificates/logs` |

States: loading spinner; error notice; empty state "No certificates have been
issued yet." with *Issue the first batch*.

---

## Verify page (`/verify/<credentialId>`)

Public, server-rendered (`dynamic = 'force-dynamic'`), reads the record
directly. Must look trustworthy on a phone, because most people arrive by
scanning a QR.

```
┌──────────────────────────────────────────────┐
│ [logo] DBUG LABS                              │
│        CREDENTIAL VERIFICATION                │
│ ┌──────────────────────────────────────────┐ │
│ │ ✓ Valid certificate, issued by dBug Labs  │ │
│ └──────────────────────────────────────────┘ │
│ ISSUED TO                                     │
│ Asha Rao                         (Playfair)   │
│ FOR                                           │
│ Git & GitHub Workshop                         │
│ Hands-on session, 4 October 2026              │
│ TYPE  PARTICIPATION    ISSUED ON  5 Oct 2026  │
│ CREDENTIAL ID  DBUG-WS-26-0007                │
│ RECIPIENT EMAIL  as••@example.com             │
└──────────────────────────────────────────────┘
```

| State | Banner | Body |
|---|---|---|
| Valid | Green "✓ Valid certificate, issued by dBug Labs" | All fields |
| Revoked | Red "✕ This certificate has been revoked" | All fields, plus "Revoked" with the date and reason |
| Not found | Red "✕ No certificate exists with this credential ID" | "Checked <id>. If you scanned this from a certificate, it was not issued by dBug Labs." |
| Database error | Red "Verification is unavailable right now. Try again in a minute." | Nothing else. Never say "not found" when the truth is "couldn't check". |

| Rule | Detail |
|---|---|
| Decoding | Next.js already decodes the path parameter. Decode again only inside `try`, so a stray `%` never causes a 500. |
| Escaping | All values are rendered as text by React. Never use `dangerouslySetInnerHTML` here. |
| Title | `Verify <id> · dBug Labs OS` |
| Indexing | `noindex` (inherited from the root layout) |
| Dates | `en-IN` long form: "5 October 2026" |

Copy for the banners and the not-found line: [PR PR-03](../teams/pr.md).

---

## Accessibility

| Rule | Where |
|---|---|
| Every input has a visible label or an `aria-label` | All forms |
| Focus is always visible (2 px purple outline) | Everywhere |
| Notices use `role="status"`; the login error uses `role="alert"` | Notices |
| The resend modal is `role="dialog"`, `aria-modal`, labelled by its heading | Modal |
| Colour is never the only signal: chips have text, the verify banner has ✓ / ✕ and words | Log, verify |
| Text contrast at least 4.5:1 against its background | Creatives checks in CRE-01 |
| The generator is keyboard-usable except clicking the canvas, which has the X/Y inputs as the keyboard alternative | Generator |
