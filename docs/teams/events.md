# Team: Events

**Lead:** _to be assigned_ · **Members:** _to be assigned_

You are the people who will actually use this tool after every workshop,
hackathon and session. You bring the real requirements and real data at the
start, test it as a user before launch, run the pilot, and then own it day to
day.

**Read first:** [docs index](../README.md),
[10 Ops: issuing certificates for an event](../spec/10-deployment-and-ops.md#runbook-issuing-certificates-for-an-event),
and skim [06 Generator UI](../spec/06-generator-ui.md).

---

## Tasks

| ID | Task | Milestone | Depends on | Estimate |
|---|---|---|---|---|
| EVT-01 | Requirements: events, sizes, certificate types | M0 | — | 0.5 day |
| EVT-02 | Code registry | M0 | EVT-01 | 0.5 day |
| EVT-03 | Sample CSV and the attendance export process | M0 | — | 0.5 day |
| EVT-04 | User acceptance testing on Preview | M3 | WEB-F-05 to F-08 | 0.5 day |
| EVT-05 | Pilot event | M5 | M4 | 1 day |
| EVT-06 | Organiser handover | M5 | EVT-05 | 0.5 day |

---

## EVT-01 · Requirements

Write down, from the last year of dBug Labs events:

- Which events gave certificates, and of which type (participation, completion, winner/appreciation).
- How many people each one had (smallest, typical, largest). This sets whether Gmail's limit is enough ([07 capacity](../spec/07-email-and-outbox.md#gmail-limits-and-capacity)).
- What each certificate needs to say. Does every event need its own template, or one per type?
- Who issued them before and how long it took. This is the baseline the tool should beat.
- Anything that went wrong (wrong names, late certificates, people not receiving them).

Put the answers in a pull request adding `docs/requirements-events.md`.

**Acceptance**
- [ ] Creatives and Web leads have read it and confirmed nothing in the spec contradicts it, or opened spec changes.

## EVT-02 · Code registry

Every certificate ID contains a code (`DBUG-WS-26-0007`). Codes must be short,
consistent and never reused for something different.

Create `docs/codes.md`:

| Code | Used for | Example |
|---|---|---|
| `WS` | Workshops | Git & GitHub Workshop |
| … | … | … |

Rules: 2–6 capital letters or digits; one code per kind of event (or per
flagship event, e.g. a hackathon); agreed with the Events lead before use.

## EVT-03 · Sample CSV and attendance export

- Describe how attendance is collected today (form, sheet, scanner) and how to export it as `name,email,code`.
- Provide an **anonymised** CSV in the real shape: same columns, the same kinds of messiness (extra spaces, capitalisation, duplicate rows), but fake names and `example.com` emails. QA and Web backend test with it.

**Acceptance**
- [ ] The CSV contains no real person's data.

## EVT-04 · User acceptance testing

On the M3 Preview, issue a fake event's certificates end to end as you would
on the day, following the runbook. Note everything that confused you,
including wording. File issues tagged `ux`.

**Acceptance**
- [ ] A member who did not attend any planning meeting completes the runbook without help.

## EVT-05 · Pilot event

Issue certificates for one real, small event (under 100 people) on production
using the [runbook](../spec/10-deployment-and-ops.md#runbook-issuing-certificates-for-an-event)
and the [pilot checklist](../spec/10-deployment-and-ops.md#pilot-checklist-m5),
with a Web backend member on call.

**Acceptance**
- [ ] Accepted count matches attendance minus known bad addresses.
- [ ] Retro notes filed as issues.

## EVT-06 · Organiser handover

Teach at least two more organisers to run the tool. Keep the runbook updated
with anything that came up in the pilot.

---

## Interfaces with other teams

| You give | To | When |
|---|---|---|
| Requirements (EVT-01) | Creatives, Web | M0 |
| Code registry (EVT-02) | Everyone | M0 |
| Sample CSV (EVT-03) | QA, Web backend | M0 |
| Input on ID readability | Cybersecurity (SEC-03) | M0 |
| UAT feedback (EVT-04) | Web frontend | End of M3 |

| You need | From | When |
|---|---|---|
| Templates (CRE-02) | Creatives | Before the pilot |
| A production deploy | Web backend | M5 |
| Announcement templates (PR-05) | PR | M5 |
