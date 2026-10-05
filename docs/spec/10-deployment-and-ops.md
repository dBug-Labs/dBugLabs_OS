# 10 · Deployment and Operations

How the app is hosted, configured and run, and what to do when something goes
wrong on an event day. Owners: [Web backend](../teams/web-backend.md) for
setup, [Events](../teams/events.md) for day-to-day use.

---

## Environments

| Environment | URL | Database | SMTP | Who uses it |
|---|---|---|---|---|
| Local | `http://localhost:3000` | `dbos_dev` (or in-memory) | Local catcher | Developers |
| Preview | Vercel preview URL per pull request, behind Deployment Protection | `dbos_preview` | Local catcher for automated tests; real SMTP only for MAIL-T checks to team addresses | Reviewers, QA |
| Production | e.g. `https://os.dbuglabs.tech` (final domain chosen at M0) | `dbuglabs_os` | Club Gmail / Workspace | Organisers |

Production and Preview never share a database or any secret.

---

## One-time setup (M0, task WEB-B-01)

### MongoDB Atlas

1. Use the club's Atlas organisation. Create a project `dBugLabs_OS`.
2. Cluster: free M0 tier, region **Mumbai (ap-south-1)**.
3. Database users: `dbos_prod` with `readWrite` on `dbuglabs_os` only; `dbos_preview` with `readWrite` on `dbos_preview` only.
4. Network access: allow `0.0.0.0/0` (Vercel has no fixed outbound IPs on the free plan), and rely on strong generated passwords.
5. Copy each connection string into Vercel (below). Never into the repo or a chat.

### Gmail sending account

1. Use the club's own Gmail or Workspace address, the one participants already recognise.
2. Turn on 2-Step Verification for it.
3. Create an **App password** (Google Account → Security → App passwords), named `dBugLabs_OS`.
4. `SMTP_USER` = the address, `SMTP_PASS` = the 16-character app password.

### Vercel

1. Import `dBug-Labs/dBugLabs_OS` into the club's Vercel team.
2. Framework preset: Next.js. No build settings to change.
3. Function region: **Mumbai (`bom1`)**, next to the Atlas cluster, to avoid cross-region database round trips.
4. Add the environment variables below, separately for Production and Preview.
5. Turn on Deployment Protection for Preview deployments.
6. Add the production domain and set `PORTAL_URL` to it **before** the first real batch.
7. Enable Web Analytics and Speed Insights (free) to see verify-page traffic.

### Environment variables

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `ADMIN_PASSWORD` | yes | yes (different) | ≥16 random characters |
| `SESSION_SECRET` | yes | yes (different) | ≥32 random characters |
| `MONGODB_URI` | yes | yes (different user) | |
| `MONGODB_DB` | `dbuglabs_os` | `dbos_preview` | |
| `SMTP_HOST` | `smtp.gmail.com` | test or Gmail | |
| `SMTP_PORT` | `465` | | |
| `SMTP_USER` | club address | | |
| `SMTP_PASS` | app password | | |
| `MAIL_FROM` | optional, e.g. `"dBug Labs" <club@…>` | | |
| `SMTP_MAX_CONNECTIONS` | optional (3) | | |
| `SMTP_RATE_LIMIT` | optional (5 per second) | | |
| `PORTAL_URL` | the production domain | the preview domain | **Printed into every QR code.** Wrong here means wrong forever on paper. |
| `CRON_SECRET` | yes | yes (different) | ≥32 random characters |

For local work, `vercel env pull .env.local` copies the Preview values, or copy
`.env.example` to `.env.local` and fill it in.

### Scheduled mail drain

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/certificates/outbox/drain", "schedule": "0 3 * * *" }
  ]
}
```

Vercel Cron runs in UTC (03:00 UTC = 08:30 IST) and sends
`Authorization: Bearer <CRON_SECRET>` automatically. The Hobby plan allows
daily crons only, so this is the safety net.

For retries within minutes, add a free external scheduler (e.g.
cron-job.org):

| Setting | Value |
|---|---|
| URL | `https://<production domain>/api/certificates/outbox/drain` |
| Method | GET |
| Header | `Authorization: Bearer <CRON_SECRET>` |
| Schedule | Every 5 minutes |
| Alert | Email the Web backend lead after 3 consecutive failures |

---

## Cost

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby | Free |
| MongoDB Atlas | M0 | Free |
| Gmail | Existing club account | Free (500 per day) |
| cron-job.org | Free | Free |
| Domain | Subdomain of the club's existing domain | Free |

v1 runs at zero cost. See [If we outgrow Gmail](#if-we-outgrow-gmail) for the
first thing that might cost money.

---

## Runbook: issuing certificates for an event

Owner on the day: Events. Takes about 20 minutes for a 300-person event.

**Before the event**

1. Creatives delivers the template (PNG, 300 dpi A4 landscape, blank name area). See [CRE-02](../teams/creatives.md).
2. Decide the code (e.g. `WS` for workshops, or an event-specific one like `HACK26`) and agree it with the Events lead. Codes become part of every ID, so keep them short and consistent.
3. Create an empty Drive folder for the batch, shared "anyone with the link can view".

**Preparing the CSV**

4. Export attendance (not registrations) to CSV with columns `name,email,code`.
5. Fix names: proper capitalisation, full names as the person wants them printed. This is the most common complaint, and it cannot be fixed after mailing without revoking and reissuing.
6. Remove duplicates and test rows.
7. Check the count matches actual attendance.

**Issuing**

8. Sign in at `/login` on a laptop (not a phone), on a stable connection, plugged in.
9. Upload the template, then the CSV. Fix any rows it flags.
10. Fill type, title (exactly as it should appear on LinkedIn), description, Drive link.
11. Place the name, QR and ID. Check the preview with the **longest** name in the CSV.
12. Issue a **test batch of one** to yourself first using *Single person*. Open the email on your phone, scan the QR, check the verify page. Revoke the test certificate afterwards from the log.
13. Switch back to CSV and press *Generate, download & email*. Keep the tab open until the ZIP has downloaded.
14. Upload the ZIP's contents to the Drive folder.
15. If the resend modal appears, read the errors: typos in addresses (`550`) need the participant's correct address; temporary errors (`421`) can just be resent.
16. Open the certificate log and confirm *Accepted* matches the attendance count, minus known bad addresses.

**After**

17. Post the announcement (PR's template in [PR-05](../teams/pr.md)).
18. Ask Web backend to run the backup (WEB-B-12).
19. Delete the participant CSV from personal laptops within 7 days unless still needed (SEC-13).

---

## Runbook: someone did not receive their certificate

1. Find them in the certificate log (search the batch).
2. Status **Accepted**: the mail reached their provider. Ask them to check spam and the Promotions tab, and send them the Drive folder link.
3. Status **Retrying**: it will go out automatically. Or press *Resend*.
4. Status **Failed** with `550`: wrong address. Get the right one, then issue a new certificate for them as *Single person* (the old one can be revoked so only one valid ID exists).
5. Status **Failed**, retry window expired: issue a new certificate as *Single person*.

## Runbook: a name is spelled wrong

1. Revoke the wrong certificate in the log, reason "Reissued with corrected name".
2. Issue a new one for that person as *Single person*.
3. The person deletes the old one from LinkedIn and adds the new one.

## Runbook: SMTP is down

Symptom: most of a run fails with timeouts or `4xx` errors.

1. Stop. Do not start further batches. The ZIP is already safe.
2. Check the club Gmail account can send a normal email.
3. Failed rows retry on their own (1, 5, 15, 60, 180 minutes) through the 5-minute scheduler.
4. When mail works again, press *Resend all failed* on the batch.
5. The spool lasts 48 hours. After that, regenerate the affected people as a new batch.
6. On the Atlas free tier, a very large fully-failed run can fill storage (see [05 Sizing](05-data-model.md#sizing)). If Atlas warns about storage, resend sooner rather than later.

## Runbook: every mail fails with `EAUTH`

The app password is wrong or was revoked (this happens if the account
password is changed).

1. Create a new app password for the club account.
2. Update `SMTP_PASS` in Vercel Production and redeploy.
3. *Resend all failed* on the affected batch.

## Runbook: rotate the admin password

1. Generate a new 16+ character password in the club password manager.
2. Update `ADMIN_PASSWORD` in Vercel Production. Redeploy (environment changes apply on the next deployment).
3. Everyone is signed out immediately. Share the new password only with the people on the access list (SEC-12).

## Runbook: verify page shows "unavailable"

The app cannot reach MongoDB.

1. Check Atlas status and that the cluster is not paused (free clusters pause after long inactivity).
2. Check `MONGODB_URI` in Vercel has not changed.
3. Printed certificates are fine; their records still exist. Verification works again as soon as the database is reachable.

---

## Backups (WEB-B-12)

After every event batch, and at least monthly:

```bash
mongodump --uri "$MONGODB_URI" --db dbuglabs_os \
  --collection certificates --out backup-$(date +%F)
mongodump --uri "$MONGODB_URI" --db dbuglabs_os \
  --collection counters --out backup-$(date +%F)
```

Zip the folder and store it in the club's restricted Drive folder
(committee-only access; it contains emails). Keep the last 12.

Restore only `certificates` with `mongorestore` and never lower a counter
below the highest number already issued ([05](05-data-model.md#backups)).

---

## Pilot checklist (M5)

- [ ] Production deploy is green; `PORTAL_URL` is the production domain.
- [ ] External scheduler is calling the drain every 5 minutes and succeeding.
- [ ] A test certificate to a committee member: mail in inbox, attachment downloadable, QR opens production verify, LinkedIn button works. Then revoked.
- [ ] Events has the template, the clean CSV and the Drive folder.
- [ ] One Web backend member is reachable during the run.
- [ ] Run the event batch using the runbook above.
- [ ] Accepted count matches attendance minus known bad addresses.
- [ ] Spot-check 5 random recipients' verify pages.
- [ ] Backup taken.
- [ ] Short retro: what confused the organiser, what to fix. Issues filed.

---

## If we outgrow Gmail

Signs: events over about 450 people, mail landing in spam, or Gmail
throttling.

Options to evaluate at that point (check current pricing then; it changes):

| Option | Notes |
|---|---|
| Google Workspace for the club | About 2,000 per day; same SMTP setup, no code change |
| A transactional mail service (e.g. Resend, Amazon SES, Brevo) | Better deliverability and bounce reports. Needs a custom domain with SPF/DKIM. Most offer SMTP, so only env vars change. |

Because the outbox only depends on `sendMail()`, switching provider is an
environment change, not a code change, as long as the provider offers SMTP.
