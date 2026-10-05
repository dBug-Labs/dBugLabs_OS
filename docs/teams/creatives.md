# Team: Creatives

**Lead:** _to be assigned_ · **Members:** _to be assigned_ (1–2 recommended)

You decide how the tool and its output look: the admin screens, the
certificate templates every event will use, and the certificate email. The
certificate is the thing participants keep and post on LinkedIn, so it is the
most visible thing this project makes.

**Read first:** [06 Generator UI](../spec/06-generator-ui.md) (especially
*Visual language*, *Default layout* and the screen sketches), and
[07 The email](../spec/07-email-and-outbox.md#the-email).

---

## Tasks

| ID | Task | Milestone | Depends on | Estimate |
|---|---|---|---|---|
| CRE-01 | Screen designs | M1 (login) / M3 (rest) | — | 2 days |
| CRE-02 | Certificate templates | M1 | EVT-01 | 2 days |
| CRE-03 | Brand assets | M0 | — | 0.5 day |
| CRE-04 | Email design | M2 | PR-01 | 1 day |
| CRE-05 | Template guide for future events | M4 | CRE-02 | 0.5 day |

---

## CRE-01 · Screen designs

Design in Figma, in the recruitment site's visual language (palette and fonts
in [06 Visual language](../spec/06-generator-ui.md#visual-language)), at
desktop (1440 px) and phone (375 px) widths:

1. Login page.
2. Admin top bar.
3. Generator: empty state, with a template loaded, CSV with issues, during a run (each progress phase), the resend modal, the success notice.
4. Certificate log: list, expanded batch with every status chip, empty state.
5. Verify page: valid, revoked, not found, unavailable. **Phone first.** Most people arrive here by scanning a QR on their phone.

Rules:
- Every state listed in [06](../spec/06-generator-ui.md) needs a design, including errors and empty states, not just the happy path.
- Text contrast at least 4.5:1. Status is never shown by colour alone.
- Do not add elements the spec does not have. If you think something is missing, open a spec change.

**Acceptance**
- [ ] Figma link in the M1 pull request (login) and M3 pull request (rest).
- [ ] Web frontend lead has walked through it and confirmed it is buildable.

## CRE-02 · Certificate templates

Three templates: **Participation**, **Completion**, **Appreciation**. Each one
is a background image that the generator writes onto.

| Spec | Value |
|---|---|
| Size | 3508 × 2480 px (A4 landscape at 300 dpi), PNG, sRGB |
| File size | Under 2.5 MB if possible (helps the rendered email copy stay PNG instead of falling back to JPEG) |
| Name area | Left **blank**: the generator writes the name. Leave a horizontal band at least 2,400 px wide and 300 px tall, so a long name in 110 px type fits. |
| QR area | A plain, light, square area at least 450 × 450 px (about 3.8 cm printed), with no pattern behind it. A QR on a busy or dark background will not scan. |
| Credential ID area | A plain strip at least 1,000 × 80 px for small monospace text |
| Title | Either baked into the template per event, or left as a generic heading ("Certificate of Participation") with the event named in the email and on the verify page. Agree with Events (EVT-01). |
| Signatures | Real signatures only with the signatory's permission. |
| Background | Light. Dark certificates print badly. |

Deliver with a short spec per template: the pixel coordinates of the name
centre, the QR top-left corner and size, and the ID start point, so the
organiser can type them into the X/Y inputs instead of clicking.

**Acceptance**
- [ ] Printed on an office printer, the QR scans from 30 cm with an ordinary phone camera.
- [ ] With a 40-character name in 110 px type, nothing overlaps.
- [ ] QA has them as fixtures (QA-02).

## CRE-03 · Brand assets

- `logo.png`, square, at least 256 × 256, transparent background (used at 30–56 px in the UI).
- `icon.png` (favicon), 512 × 512.
- A text wordmark treatment for the email header (emails cannot rely on web fonts or SVG).

## CRE-04 · Email design

Design the certificate email ([07 Body, top to bottom](../spec/07-email-and-outbox.md#body-top-to-bottom))
with PR's copy.

Constraints that are easy to miss:
- Maximum width 600 px. Inline styles only. No web fonts (fall back to system sans-serif). No background images.
- Gmail on phones can force a light or dark theme. Design so it reads correctly either way. If the dark card does not survive, use a light card.
- Buttons must be real links styled as buttons, at least 44 px tall.

**Acceptance**
- [ ] Reviewed in MAIL-T01 to T03 with QA, in light and dark mode.

## CRE-05 · Template guide

A one-page guide in `docs/` for anyone designing a template for a future
event: the size, the blank areas, the QR rules, and how to measure the
coordinates. Based on what you learned in CRE-02.

---

## Interfaces with other teams

| You give | To | When |
|---|---|---|
| Login design (CRE-01) | Web frontend | Start of M1 |
| Remaining screen designs (CRE-01) | Web frontend | Start of M3 |
| Templates (CRE-02) | QA, Web frontend, Events | Start of M1 |
| Email design (CRE-04) | Web backend | Mid M2 |

| You need | From | When |
|---|---|---|
| Event types and what each certificate should say (EVT-01) | Events | M0 |
| Email and page copy (PR-01, PR-03) | PR | Mid M2 |
