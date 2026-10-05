# 07 · Email and the Mail Outbox

What the certificate email says and looks like, how it is sent, and how
failures are retried. Data shapes are in [05 Data model](05-data-model.md#mail_outbox).

Owners: [Web backend](../teams/web-backend.md) (WEB-B-07, WEB-B-08). Design:
[Creatives CRE-04](../teams/creatives.md). Copy: [PR PR-01](../teams/pr.md).

---

## The email

### Envelope

| Field | Value |
|---|---|
| From | `MAIL_FROM` if set, else `"dBug Labs" <SMTP_USER>` |
| To | The recipient's email (lower-cased) |
| Subject | `dBug Labs: your certificate for <title>` (final wording from PR-01) |
| Body | HTML only, inline styles (mail clients strip `<style>` blocks) |
| Attachment | The certificate image, `<Name>_Certificate.png` (or `.jpg`) |

### Body, top to bottom

1. "DBUG LABS" wordmark.
2. Heading "Certificate Issued", sub-line "Congratulations on your achievement".
3. A card: "Issued to", the **name**, "for", the **title**, then the credential ID and code as small pills.
4. The certificate image, inline (`<img src="cid:certificate">`), with "Your certificate is attached to this email." under it.
5. **Verify this certificate** button → `verifyUrl`.
6. **Add to LinkedIn** button → LinkedIn's add-certification URL (below).
7. If the batch has a Drive link: **Open the Drive folder** button, with "A copy of this batch also lives here, in case the attachment goes missing."
8. Footer: "Anyone can confirm this certificate is genuine at" and the verify URL as plain text.

Max width 600 px, dark background `#0c0710`, the dBug red→purple gradient on
the main button. Must also read correctly when the client forces a light
theme (Gmail mobile does): test it, and if the dark card turns unreadable,
switch to a light card design (Creatives' call in CRE-04).

### The attachment

```js
{
  filename: 'Asha_Rao_Certificate.png',   // non-word characters → _
  content: Buffer.from(base64, 'base64'),
  contentType: 'image/png',               // or image/jpeg
  cid: 'certificate',                     // for the inline <img>
  contentDisposition: 'attachment',       // REQUIRED, see below
}
```

`contentDisposition: 'attachment'` is required. A part that is referenced by
`cid` is otherwise treated as inline-only: Gmail shows the picture in the body
and offers **no** paperclip, so the recipient has nothing to download. With
it, the picture shows inline and the file is downloadable.

### LinkedIn button

```
https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME
  &name=<title>
  &organizationName=dBug Labs
  &issueYear=<YYYY>&issueMonth=<M>
  &certId=<credentialId>
  &certUrl=<verifyUrl>
```

Build it with `URLSearchParams` so every value is encoded. If dBug Labs has a
LinkedIn company page, use `organizationId=<id>` instead of
`organizationName` so the certificate shows the club's logo (PR-04 finds the
ID).

### Escaping

Every value placed in the HTML comes from a CSV someone typed. All of it is
escaped:

```js
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
```

This applies to name, title, code, credential ID, and every URL placed in an
`href` (the Drive link is already restricted to `http(s)` by the API). This
fixes SQAC bug #2, where a CSV name like `<a href="…">Claim prize</a>` would
have become a live link in a mail sent from the club's address.

The subject line is plain text (not HTML), so it is not HTML-escaped.
Nodemailer encodes it.

---

## Sending

### Transport

One pooled nodemailer SMTP transport per server instance, created on first
use (so a missing variable fails the send, and gets recorded, rather than
crashing the import).

| Setting | Value |
|---|---|
| Host / port | `SMTP_HOST` (default `smtp.gmail.com`) / `SMTP_PORT` (default 465) |
| TLS | `secure: true` when the port is 465; STARTTLS otherwise |
| Auth | `SMTP_USER` / `SMTP_PASS` (a Gmail **app password**, never the account password) |
| Pool | `pool: true`, `maxConnections` = `SMTP_MAX_CONNECTIONS` or 3, `maxMessages: 50` |
| Rate | `rateDelta: 1000`, `rateLimit` = `SMTP_RATE_LIMIT` or 5 messages per second |
| Timeouts | Connection 10 s, greeting 10 s, socket 20 s |

Pooling matters: without it every message opens a new TLS connection, which
Gmail throttles hard and which costs about 300 ms of the request's time
budget each.

### Who sends

Nothing sends mail directly from a request. Every mail is queued in
`mail_outbox`, then a **drain** sends it. There are three drains:

| Drain | Triggered by | Sends |
|---|---|---|
| `/send` | The generator, during a run | Exactly the rows it just queued (≤5) |
| `/batch/:id/resend` | The admin pressing Resend | The first 5 requeued rows |
| `/outbox/drain` | Vercel Cron (daily) and an external scheduler (every 5 min) | Up to 20 due rows from any batch |

They can all run at the same time safely, because of how rows are claimed.

### Claiming rows

```js
for (let i = 0; i < limit; i++) {
  const row = await outbox.findOneAndUpdate(
    {
      ...(batchId && { batchId }),
      ...(only && { refId: { $in: only } }),
      $or: [
        { status: { $in: ['queued', 'failed'] }, nextRetryAt: { $lte: now } },
        { status: 'sending', lastAttemptAt: { $lte: now − 3 min } },   // orphan reclaim
      ],
    },
    { $set: { status: 'sending', lastAttemptAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { nextRetryAt: 1 }, returnDocument: 'after' },
  )
  if (!row) break
  claimed.push(row)
}
```

Each claim is one atomic operation. When two drains race for the same row,
only one flips it to `sending`; the other moves on. A function that times out
mid-send leaves its rows in `sending`; after 3 minutes any drain may reclaim
them.

### Sending one row

```
if kind == 'certificate' and no attachment:
    status = dead, lastError = "Attachment expired. Regenerate the certificate and send again."
    (never send a certificate mail with a broken image)
else:
    sendMail(row)
    on success:  status = sent, sentAt = now, lastError = null, $unset attachment
                 → certificates.emailedAt = now
    on error:    classify (below)
                 transient and attempts < 5 → status = failed, nextRetryAt = backoff
                 permanent or attempts ≥ 5   → status = dead
                 lastError = error message (≤500 chars; "(gave up after 5 attempts)" appended when out of attempts)
```

### Classifying failures

| Signal | Class | Examples |
|---|---|---|
| SMTP response code 500–599 | permanent | `550 No such user`, `552 Mailbox full`, `554 Rejected as spam` |
| SMTP response code 400–499 | transient | `421 Too many connections`, `450 Mailbox busy`, `451 Try later` |
| nodemailer `EENVELOPE`, `EMESSAGE` | permanent | Malformed address, message could not be built |
| `ETIMEDOUT`, `ECONNECTION`, `ESOCKET`, `ECONNRESET`, `EDNS`, `EAUTH` | transient | Network trouble, a briefly rejected login |
| Anything else | transient | Five attempts stop it looping |

Retrying a permanent failure burns sending reputation and buries the real
transient failures, so the classification matters.

`EAUTH` is classed as transient but **always** means someone should check
`SMTP_PASS`: if every row in a run fails with `EAUTH`, see
[10 Ops runbook](10-deployment-and-ops.md#runbook-every-mail-fails-with-eauth).

### Resend

Admin-triggered. Moves `failed` **and** `dead` rows back to `queued` with
`attempts = 0`, `nextRetryAt = now`, `lastError = null`, but only rows whose
attachment is still spooled. Rows whose spool has expired are reported as
`missingAttachment` and left alone. `sent` rows are never touched.

---

## Gmail limits and capacity

| Account | Daily sending limit (approx.) | One batch of… |
|---|---|---|
| Personal Gmail | 500 recipients per day | ≤450, leaving headroom for normal club mail |
| Google Workspace | 2,000 per day | ≤1,000 (the API's batch cap) |

Rough timings at 5 messages per second:

| Batch | Rendering (browser) | Mailing |
|---|---|---|
| 50 | 10–20 s | about 20 s |
| 300 | 1–2 min | 2–3 min |
| 1,000 | 4–6 min | 7–10 min |

For events above the daily limit: issue in two runs on two days (same title,
codes continue the sequence), or move to a transactional mail provider (a
Phase 3 decision with cost in [10 Ops](10-deployment-and-ops.md#if-we-outgrow-gmail)).

### Deliverability checklist

Owned by Web backend, checked before the pilot (WEB-B-13):

- [ ] Sending from the club's own Gmail or Workspace address, not a personal account.
- [ ] If sending from a custom domain: SPF, DKIM and DMARC records set and passing (check with mail-tester.com).
- [ ] A test mail lands in the inbox, not spam, at Gmail, Outlook and a college (`@srmist.edu.in`) address.
- [ ] The attachment is downloadable in Gmail web, Gmail Android, Gmail iOS and Outlook web.
- [ ] Every button works on a phone.
