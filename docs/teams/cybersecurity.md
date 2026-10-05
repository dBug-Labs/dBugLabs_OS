# Team: Cybersecurity

**Lead:** _to be assigned_ · **Members:** _to be assigned_ (1–2 recommended)

You make sure only the right people can issue certificates, that a forged
certificate never verifies, and that participants' data does not leak. You
make the security decisions, review the code that implements them, and sign
off before launch. The code changes themselves are done by Web backend.

**Read first:** [08 Security](../spec/08-security.md) (your main spec),
[03 Auth](../spec/03-auth.md), [04 API](../spec/04-api.md).

---

## Tasks

| ID | Task | Milestone | Depends on | Estimate |
|---|---|---|---|---|
| SEC-01 | Password policy and access list (with SEC-12) | M0 | — | 0.5 day |
| SEC-03 | Decide the credential ID format | M0 → start of M2 | Events input | 0.5 day |
| SEC-02 | Review the Phase 1 auth pull request | M1 | WEB-B-02, 03 | 0.5 day |
| SEC-04–10 | Review each control as its pull request lands | M2 | Web backend | 1 day total |
| SEC-11 | Pre-launch security review on production | M4 | WEB-B-13 | 1 day |
| SEC-13 | Participant data retention rule | M5 | Events | 0.5 day |

---

## SEC-01 · Password policy and access list

- Agree the rules in [SEC-01](../spec/08-security.md#sec-01-password-policy) with the Secretary.
- Decide **who** gets the admin password (SEC-12): at most 4 people. Write the list (roles, not just names) in the club's private notes, not in this repo.
- Set up the shared entry in the club password manager. Generate the Production and Preview passwords there.

**Acceptance**
- [ ] Access list agreed and recorded privately.
- [ ] Passwords generated in the manager; nobody has had them sent over chat.

## SEC-03 · Credential ID format

Run the decision in [SEC-03](../spec/08-security.md#sec-03-credential-id-enumeration).
Talk to the Events lead: they read IDs aloud and print them, so length and
look-alike characters matter.

**Acceptance**
- [ ] Decision recorded in 08 Security and 05 Data model in one pull request, before WEB-B-04 starts.

## SEC-02 · Phase 1 review

Review the WEB-B-02 and WEB-B-03 pull requests against the
[SEC-02 checklist](../spec/08-security.md#sec-02-login-and-session-review). Try
to break it: edit cookies by hand in DevTools, replay an old cookie after
logout, try `?next=` tricks, script the login.

**Acceptance**
- [ ] Every checklist item ticked in the pull request review, or an issue opened.

## SEC-04 to SEC-10 · Control reviews

Be a required reviewer on these pull requests and check each against its
control:

| Control | Pull request |
|---|---|
| SEC-04 verify rate limit | WEB-B-10 |
| SEC-05 personal data in the verify response | WEB-B-10 |
| SEC-06 output escaping | WEB-B-07, WEB-F-08 |
| SEC-07 CSV export safety | WEB-F-07 |
| SEC-08 headers | WEB-B-03 |
| SEC-09 secrets handling | WEB-B-01, every PR touching env |
| SEC-10 drain endpoint | WEB-B-08 |

## SEC-11 · Pre-launch review

Run the [SEC-11 checklist](../spec/08-security.md#pre-launch-security-review-sec-11)
on production before M4 closes. Include a `gitleaks detect` over the repo
history. Record the results in the M4 pull request.

**Acceptance**
- [ ] Every item passes, or has an accepted, written exception from the Secretary.

## SEC-13 · Data retention

With Events, decide how long participant CSVs are kept and where. Write the
rule into the [event runbook](../spec/10-deployment-and-ops.md#runbook-issuing-certificates-for-an-event).

---

## Interfaces with other teams

| You give | To | When |
|---|---|---|
| SEC-03 decision | Web backend | Start of M2 |
| Review approvals | Web teams | As PRs land |
| Launch sign-off | Everyone | End of M4 |

| You need | From | When |
|---|---|---|
| Input on ID readability | Events | Before SEC-03 |
| Access to Vercel and Atlas settings (read-only is enough) | Web backend | M4 |
