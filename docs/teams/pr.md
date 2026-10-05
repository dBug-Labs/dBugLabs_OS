# Team: PR

**Lead:** _to be assigned_ · **Members:** _to be assigned_ (1–2 recommended)

You write every word a participant reads: the certificate email, the verify
page, the LinkedIn sharing, the announcement that certificates are out, and
the answers to "I didn't get mine". Good words here cut the support load
after every event.

**Read first:** [07 The email](../spec/07-email-and-outbox.md#the-email),
[06 Verify page](../spec/06-generator-ui.md#verify-page-verifycredentialid),
and the [runbooks](../spec/10-deployment-and-ops.md#runbook-someone-did-not-receive-their-certificate).

**Style:** plain, warm, short. One idea per sentence. No hype words. Clean
English (no Hinglish) in everything participants see.

---

## Tasks

| ID | Task | Milestone | Depends on | Estimate |
|---|---|---|---|---|
| PR-01 | Certificate email copy | M2 | — | 0.5 day |
| PR-02 | Login and admin UI copy review | M1 / M3 | CRE-01 | 0.5 day |
| PR-03 | Verify page copy | M3 | — | 0.5 day |
| PR-04 | LinkedIn setup | M2 | — | 0.5 day |
| PR-05 | Announcement templates | M5 | — | 0.5 day |
| PR-06 | Participant FAQ | M5 | — | 0.5 day |

---

## PR-01 · Certificate email copy

Write, for each certificate type (participation, completion, appreciation):

- The **subject line**. Current placeholder: `dBug Labs: your certificate for <title>`. Must work for any title length, read well in a phone's inbox list (first 40 characters matter most), and avoid spam-trigger words ("free", "winner!!!", "claim").
- The heading and sub-line.
- The line above the name ("Issued to") and below it ("for").
- The button labels (verify, LinkedIn, Drive folder).
- The note under the image and the footer line about verification.

Deliver as a table (field → text) in a pull request editing
[07](../spec/07-email-and-outbox.md#body-top-to-bottom). Web backend
implements it in WEB-B-07.

## PR-02 · UI copy review

Read every label, hint, error, notice and empty state in
[03 Login page](../spec/03-auth.md#login-page-login) and
[06](../spec/06-generator-ui.md) as if you were a first-time organiser.
Suggest changes in a pull request. Errors must say what happened and what to
do next.

## PR-03 · Verify page copy

Final text for the four verify states (valid, revoked, not found,
unavailable) in [06 Verify page](../spec/06-generator-ui.md#verify-page-verifycredentialid).
The not-found message must be firm but not accusatory: a typo in a hand-typed
ID also lands there.

Also one line under a valid certificate explaining what verification means,
e.g. that the details shown are dBug Labs' record and should match the
certificate.

## PR-04 · LinkedIn setup

- Find dBug Labs' LinkedIn company page ID. With it, the *Add to LinkedIn* button can use `organizationId` so certificates show the club's logo on profiles ([07 LinkedIn button](../spec/07-email-and-outbox.md#linkedin-button)).
- Check the pre-filled form looks right with a real test certificate.
- Write a suggested post text participants can use when sharing, tagging dBug Labs.

## PR-05 · Announcement templates

Templates for when certificates go out after an event, for the club's
WhatsApp groups, Instagram story and LinkedIn:

- Certificates have been emailed; check spam and Promotions.
- How to verify, and how to add it to LinkedIn.
- Who to contact if theirs is missing or has a wrong name (link the FAQ).

Plus a one-time launch post introducing verifiable dBug Labs certificates.

## PR-06 · Participant FAQ

A short public FAQ (can live in `docs/faq.md` and be pasted wherever needed):

- I didn't receive my certificate.
- My name is spelled wrong.
- How do I verify a certificate?
- The verify page says "revoked". What does that mean?
- Can I get a printed copy?

Answers must match the [runbooks](../spec/10-deployment-and-ops.md).

---

## Interfaces with other teams

| You give | To | When |
|---|---|---|
| Email copy (PR-01) | Web backend, Creatives | Mid M2 |
| UI copy (PR-02) | Web frontend | M1, M3 |
| Verify copy (PR-03) | Web frontend | Mid M3 |
| LinkedIn org ID (PR-04) | Web backend | M2 |
| Announcement templates (PR-05) | Events | M5 |
