# Team: QA Testing

**Lead:** _to be assigned_ · **Members:** _to be assigned_ (2 recommended)

You decide when each milestone is actually done. You own the test environment,
the automated API suite, the manual browser and mail checks, the load test, and
the sign-off on every milestone.

**Read first:** [09 Testing](../spec/09-testing.md) (your main spec), then
[04 API](../spec/04-api.md) and [06 Generator UI](../spec/06-generator-ui.md)
so you know what "correct" looks like.

**You own these paths:** `tests/` (suite, fixtures, SMTP catcher script).

---

## Tasks

| ID | Task | Milestone | Depends on | Estimate |
|---|---|---|---|---|
| QA-01 | Review the spec for testability | M0 | — | 0.5 day |
| QA-02 | Test environment and fixtures | M1 | WEB-B-01, EVT-03, CRE-02 | 1 day |
| QA-03 | Automated auth suite | M1 | QA-02, WEB-B-02/03 | 0.5 day |
| QA-04 | Automated API suite (batch, send, resend, log, revoke, verify, drain) | M2 | QA-02 | 1.5 days |
| QA-05 | Manual browser pass | M3 | WEB-F-03 to F-08 | 1 day |
| QA-06 | Mail client checks | M4 | WEB-B-07, WEB-B-13 | 0.5 day |
| QA-07 | Load test | M4 | QA-04, QA-05 | 0.5 day |
| QA-08 | Milestone sign-offs and regression | M1–M5 | — | ongoing |

---

## QA-01 · Review the spec for testability

Read every spec file. For each requirement you cannot write a pass/fail check
for, open an issue tagged `spec` and the owning team. Add any missing cases to
[09 Testing](../spec/09-testing.md).

**Acceptance**
- [ ] Every requirement in 03 Auth (AUTH-1 to AUTH-12) maps to at least one test case.
- [ ] Issues opened for anything ambiguous.

## QA-02 · Test environment and fixtures

- `tests/smtp-catcher.mjs`: an `smtp-server` on port 2525 with STARTTLS disabled, accepting any login, rejecting `bounce*` with 550 and `slow*` with 421, saving each accepted mail's HTML and attachment metadata to `tests/out/`.
- A documented way to run MongoDB for tests (`mongodb-memory-server`, or a local `dbos_test` database dropped before each run).
- Every fixture in [09 Test data](../spec/09-testing.md#test-data). Fake people only. The templates come from Creatives (CRE-02).
- A `tests/README.md`: how to start the catcher, the database and the app with test env vars, and how to run the suite.

**Acceptance**
- [ ] A new team member runs the whole suite from the README in under 15 minutes.

## QA-03 · Automated auth suite

`tests/api.e2e.mjs`, auth section: AUTH-T01 to T15. Plain `fetch` with
`redirect: 'manual'` and a hand-managed cookie. Prints `PASS`/`FAIL` per case
and exits non-zero on any failure.

**Acceptance**
- [ ] Green against the M1 Preview. M1 cannot close without this.

## QA-04 · Automated API suite

The rest of the automated cases: BAT, SND, RES, LOG, REV, VER, DRN. Assertions
on captured mail (SND-T09, T10) read the catcher's output files.

For BAT-T12 (concurrency), fire both requests with `Promise.all`. For DRN-T04,
queue 10 rows, start two drains together, then count captured mails.

**Acceptance**
- [ ] Whole suite runs in under a minute and is green against the M2 Preview.

## QA-05 · Manual browser pass

UI-T01 to T21 on the browsers listed in [09](../spec/09-testing.md#manual-browser-tests).
Record a results table (case × browser) in the M3 pull request, with
screenshots for anything failing.

## QA-06 · Mail client checks

MAIL-T01 to T05. Use QA members' own addresses only, from a Preview pointed at
the real SMTP account.

## QA-07 · Load test

LOAD-T01 and T02 with `clean-300.csv` and the A4 template. Record: total time
per phase, the largest request size seen, and browser memory at the end.

## QA-08 · Sign-offs and regression

- At each milestone, run its exit criteria from [09](../spec/09-testing.md#exit-criteria-per-milestone) and approve the milestone pull request only if all pass.
- After every S1/S2 fix, re-run the cases that found it plus the related section of the automated suite.
- Keep a running list of open bugs by severity in the M4 pull request.

---

## Interfaces with other teams

| You need | From | When |
|---|---|---|
| Templates for fixtures (CRE-02) | Creatives | Start of M1 |
| An anonymised real-shape CSV (EVT-03) | Events | Start of M1 |
| Preview URLs and test env vars | Web backend | Each milestone |

| You give | To | When |
|---|---|---|
| Bug reports in the [format in 09](../spec/09-testing.md#reporting-bugs) | Web teams | Continuously |
| Milestone sign-off | Everyone | M1–M4 |
