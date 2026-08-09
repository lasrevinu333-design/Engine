# Memphis Zoo Custodial Scheduler — Static and Exception Foundation Audit

**Status:** Read-only production/source audit; no scheduler changes authorized  
**Prepared:** 2026-08-03  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Frontend source point before this document:** `685910df81f07a3191276cea60172595ffec22a3`  
**Backend source reviewed:** `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7`  
**Live Supabase project:** Memphis Zoo Custodial Tracking System  
**Database access used:** SELECT and function-definition inspection only

---

## 1. Fixed operating requirement

The normal daily schedule is not an AI-generated optimization problem.

The normal authority is a premade static weekly schedule:

```text
approved static weekly schedule
        ↓
create one daily baseline
        ↓
use that baseline unchanged
```

Dynamic scheduling is allowed only when a real exception requires it:

- approved PTO;
- same-day absence/callout;
- a CoverAll addition;
- varied employee start/end times requiring coverage transfer;
- lunch coverage;
- the approved 9:45 restroom rebalance;
- an employee becoming operationally unavailable;
- a newly hired employee being introduced through an approved schedule change;
- an explicit manager reassignment;
- an event/emergency that genuinely changes coverage;
- a seasonal operating-hours change;
- a newly approved static schedule version becoming effective.

The exception engine must begin from the static schedule and change the minimum necessary work. It must not casually invent a new schedule for everybody.

---

## 2. Live production snapshot reviewed

The following is a read-only snapshot, not a request to alter production.

### 2.1 Static data currently in production

- 45 active employee shift templates
- 339 active coverage templates
- 0 active `employee_primary_group_assignments`
- 0 active `employee_location_group_assignments`

Conclusion: the current effective static schedule is primarily encoded directly in `employee_shift_templates` and `coverage_templates`.

### 2.2 Current service-date schedule

For service date 2026-08-03:

- 6 active roster employees
- 123 daily assignment rows
- 123 assigned rows
- 0 open rows
- 6 distinct daily owners
- all rows shared the same generation/update timestamp

The high row count is not itself a defect. Area ownership legitimately overlaps in time, and lunch processing splits normal ownership into before/after segments while adding temporary lunch rows.

### 2.3 Departed employees are still operationally active

Michael McWright and Daniel Morgan currently remain:

- active employee records;
- assigned to active employee phones;
- eligible for schedule generation.

This matches Eric's temporary instruction to keep their names available during the build. It does **not** match current real staffing if they have left employment.

On 2026-08-03, Michael is in the live roster from 9:00 AM to 6:00 PM. The scheduler therefore treats him as the final-hour owner and cannot expose the real 5:00–6:00 PM staffing gap Eric described.

This is a data-model issue, not an instruction to remove either employee now:

> Historical retention, build/test availability, employment status, schedule eligibility, phone eligibility, and vacancy representation are currently conflated through a single `employees.active` flag.

### 2.4 Seasonal close time is not currently represented

The live `operating_hours` table contained no active rows from 2026-08-01 through 2026-09-30.

The deployed `sch_get_schedule_close_time(date)` function therefore returns its hard default of 6:00 PM for every date in that period.

The September 14 change from 6:00 PM closing to 5:00 PM is not currently encoded in the live seasonal-hours data reviewed.

---

## 3. Live static schedule schema

### 3.1 Employee shift templates

`employee_shift_templates` contains:

- employee
- day of week
- shift start/end
- lunch start/end
- active flag
- color
- notes
- created/updated timestamps

It does not contain:

- static schedule version ID;
- effective start/end date;
- draft/approved/published status;
- import source hash;
- previous version relationship.

### 3.2 Coverage templates

`coverage_templates` contains:

- location group
- day of week
- segment number
- assigned employee
- owner type
- coverage start/end
- coverage purpose
- active flag
- notes
- created/updated timestamps

It does not contain:

- static schedule version ID;
- effective date;
- draft/preview/published state;
- replacement employee or vacant-position abstraction;
- source workbook/import identity.

### 3.3 Daily schedule rows

`daily_schedule_assignments` contains current published rows, source type, purpose, status, employee, times and load points.

It does not directly identify:

- the approved static schedule version that produced the row;
- the daily baseline fingerprint;
- the exception set that changed it;
- the prior effective owner;
- the ownership-change event that employees were notified about.

### 3.4 SCH2 preview/publish schema

The database does include:

- `schedule_generation_runs` with input hashes;
- candidate scores;
- work items;
- preview solution assignments;
- publish audit;
- previous/published row snapshots;
- dry-run support;
- stale-preview detection;
- rollback.

This is a useful audited daily-solution framework. It is not a versioning system for the underlying static weekly schedule.

---

## 4. Current daily generation behavior

Live function inspected:

```text
public.sch_generate_daily_schedule(date, boolean)
```

### 4.1 Force false

With `p_force = false`, the function does not delete the daily schedule first. It still:

1. upserts the daily roster from shift templates;
2. applies shift overrides;
3. applies absences;
4. upserts daily assignments from active coverage templates;
5. updates matching existing daily rows on conflict;
6. assigns template rows whose static owner is unavailable;
7. applies lunch coverage.

Important consequence:

> `force = false` is not a strictly read-through “create only if absent” operation.

If called against an existing day, matching rows can be rewritten from current templates. That can overwrite or partially revert manager, exception or SCH2-published state sharing the same keys.

Normal callers may guard against this by checking whether rows already exist. That protection currently lives in caller behavior rather than in the database function's own contract.

### 4.2 Force true

With `p_force = true`, the function:

1. deletes all daily assignments for the date;
2. deletes the daily roster for the date;
3. reconstructs both from current templates and overrides;
4. redistributes unavailable static owners;
5. reapplies lunch coverage.

This is a complete-day rebuild.

A complete rebuild may be appropriate for:

- explicitly publishing a newly approved static schedule;
- a controlled recovery from a corrupted day;
- a manager-approved full-day replan after preview.

It is not the correct default mechanism for every absence, CoverAll edit or employee return.

---

## 5. Current absence behavior

### 5.1 Preview

`sch_absence_preview(date, uuid[])`:

- locates the absent employees' published rows;
- scores available employees using workload, familiarity, proximity and shift coverage;
- simulates additional load while distributing rows;
- reports reassigned and still-open work.

The preview itself warns that publish regenerates the schedule and final choices may differ from the preview.

That is a foundational defect in preview semantics:

> An approved preview should be the exact proposed transaction, not an approximate advisory guess followed by another solver run.

### 5.2 Publish

`sch_absence_publish(date, uuid[])`:

- deactivates the day's prior manual absence overrides;
- inserts the supplied absence set;
- calls `sch_generate_daily_schedule(date, true)`;
- reports assigned/open counts.

Therefore an absence publication reconstructs the whole day from templates rather than applying a minimal exception overlay to the existing baseline.

This directly explains why the scheduler can appear to ignore or reshuffle static schedules.

---

## 6. Current CoverAll behavior

The backend helper `publishCoverAllSlotsForDate()` defaults to:

```text
regenerate = true
restoreStatic = true
rebalance = true
```

Its normal path can therefore:

- alter the contractor roster;
- force-regenerate the day;
- restore static owners;
- rebalance CoverAll work;
- rebalance restrooms;
- rebuild lunch coverage.

A CoverAll addition may legitimately make broader balancing useful, but it should not implicitly authorize a complete new schedule every time.

Correct target:

- add the CoverAll capacity;
- preview exactly which assignments would move;
- preserve unaffected static owners;
- publish the exact reviewed changes;
- leave everything else untouched.

---

## 7. Current SCH2 optimizer

### 7.1 Strengths

SCH2 provides:

- deterministic input hash of current daily rows, roster, absences and manual locks;
- preview reuse for identical input;
- zero-work and zero-candidate guards;
- hard-rule auditing;
- route and dynamic workload scoring;
- current-versus-preview diff;
- stale-preview rejection;
- service-role publish guard;
- advisory locking;
- previous-row snapshots;
- transactional publish;
- row-count verification;
- rollback.

These are strong foundations worth preserving.

### 7.2 Wrong role if used as the normal scheduler

SCH2 ranks all required work across all eligible employees. The original owner is used only after fairness and load tie-breaks.

That makes SCH2 a full-day optimizer. It is suitable for:

- controlled full-day replan;
- static schedule design preview;
- severe absence/coverage emergency;
- audit comparison.

It is not suitable as the default daily authority when a valid static schedule exists.

### 7.3 Static changes are not part of the current input hash

`sch2_input_hash(date)` hashes:

- current daily assignments;
- current daily roster;
- absences;
- manual locks.

It does not hash the underlying shift and coverage templates when daily rows already exist.

Changing the static templates does not inherently stale an existing daily preview unless the daily baseline is regenerated first.

### 7.4 Employee-specific rule is embedded in the solver

The deployed SCH2 candidate logic includes a hard-coded `EMP002` / Michael rule restricting him to certain post-9:45 restroom/late work.

A durable scheduler must not encode a temporary operational role through a permanent person's employee code or name.

If the rule remains valid, it should be expressed as:

- a role/position rule;
- a shift capability;
- an employee-area restriction/preferences record;
- a schedule-version policy;
- or an explicit manager lock.

### 7.5 Live usage history

Production shows SCH2 preview and publish activity in June 2026, including several published days. No recent SCH2 runs were found after June 27 in the reviewed production snapshot.

The current August daily schedule was produced through the legacy/static generation path, not a recent SCH2 publication.

---

## 8. Current employee schedule projection

Live functions inspected:

```text
sch_employee_my_schedule_page(...)
sch_employee_my_schedule_phase_v1(...)
```

### 8.1 Useful current behavior

The phase function:

- identifies the active roster at the requested time;
- shows normal current ownership;
- shows lunch coverage only during its active window;
- shows late coverage during its active window;
- performs post-shift carry-forward distribution;
- considers current load and coverage candidates;
- sends no ownership to an employee who is no longer active;
- stops fabricating owners when no active roster remains.

### 8.2 Inheritance is calculated as a display overlay

The function derives inherited areas during each employee schedule request. It does not write the inherited ownership into `daily_schedule_assignments`.

This creates multiple possible truths:

- employee Schedule may show Karen as owner;
- dashboard may still show the departed employee;
- due/overdue routing may use planned ownership;
- guest issues may target another owner;
- notifications may have no stored ownership-change event;
- analytics may not know which effective owner actually held the area.

A correct architecture needs one canonical **effective ownership** result consumed everywhere.

That can be persisted rows or one canonical projection/materialization, but it cannot be reimplemented independently by every consumer.

### 8.3 Shift-end inheritance starts only after 9:45

The carry-forward block is gated by:

```text
current time >= 9:45
```

A worker leaving before 9:45 is not covered by this inheritance logic.

Every location must retain an owner whenever at least one eligible employee remains, regardless of whether the departure occurs before or after 9:45.

### 8.4 Single remaining employee becomes “All Locations”

When one active employee remains, the live function replaces the detailed list with one synthetic item:

```text
All Locations
```

That does not satisfy the employee requirement. The remaining worker needs the actual inherited locations, because:

- they must know which areas exist;
- due/overdue status is location-specific;
- NFC sessions and completion history are location-specific;
- notifications must identify added locations;
- the manager must see exact ownership.

### 8.5 Wrapper adds the full day

`sch_employee_my_schedule_page` returns both:

- current items;
- all daily items.

It also returns before-shift/after-shift notices saying the full schedule is below.

The new employee interface currently consumes the current items. The backend contract still carries a broader full-day model that can reintroduce clutter if another client uses it.

### 8.6 No canonical schedule version

The current response does not provide a durable ownership version or transition/event ID suitable for:

- exact deduplication;
- push notification generation;
- acknowledgement;
- proving which schedule the employee saw.

Frontend snapshots create local fingerprints, but the server should own the authoritative version.

---

## 9. Current notification consequence

Production notification jobs reviewed contained only:

- employee messages;
- employee events;
- due-soon alerts;
- overdue alerts.

No production job kinds were found for:

- 9:45 schedule change;
- lunch coverage assigned;
- lunch coverage ended;
- shift-end inherited areas;
- transferred/removed areas;
- emergency reassignment.

`employee-schedule.html` currently detects these changes by comparing schedule snapshots when that page refreshes.

That is not sufficient. An employee must receive the alert while using any employee screen or while a cleaning session is active.

Correct target:

> The scheduler/effective-ownership service emits one durable ownership-change event, and the notification worker delivers it independently of which page is open.

---

## 10. Employee lifecycle defect exposed by current data

The current `employees.active` flag simultaneously controls:

- whether an employee is considered active;
- whether shift templates generate roster rows;
- whether they can own schedule rows;
- whether they can be assigned a phone;
- whether Messenger identity is active.

Historical retention should not require leaving a former employee operationally active.

The target model must distinguish at least:

- historical record retained;
- currently employed;
- eligible for schedule generation;
- eligible for phone assignment;
- eligible for Messenger delivery;
- temporarily absent;
- vacant schedule position;
- build/test fixture identity, if needed.

Michael and Daniel must not be deleted. Their historical records remain permanent. Their names can remain available for controlled build/testing without causing production coverage to be falsely considered staffed.

No employee status or phone assignment was changed during this audit.

---

## 11. Seasonal operating-hours defect

Current production supports per-date operating-hour rows and otherwise defaults to 6:00 PM.

It does not currently prove a reusable seasonal rule such as:

```text
through September 13: close 6:00 PM
September 14 onward: close 5:00 PM
```

The correct foundation should support:

- effective date ranges;
- weekday/season policies;
- one-off holiday/event overrides;
- explicit opening and closing requirements;
- version/audit history;
- manager preview of coverage gaps created by an hours change.

The close-time policy must affect:

- static baseline generation;
- exception optimization;
- shift-end inheritance;
- open-coverage audit;
- due/overdue windows;
- employee display;
- event planning.

---

## 12. Foundation findings

### BLOCKER 1 — No versioned static schedule authority

The system has live in-place templates but no located version/effective-date lifecycle for replacing the approved weekly schedule.

### BLOCKER 2 — Exceptions currently rebuild the whole day

Absence publication and default CoverAll flows can force-delete and regenerate the complete daily schedule.

### BLOCKER 3 — Effective ownership is not one canonical system truth

Shift-end inheritance is computed in the employee display function rather than proven as the same owner used by dashboard, alerts, due/overdue, guest issues and analytics.

### BLOCKER 4 — Employment retention and operational eligibility are conflated

Keeping departed employees active for history/build purposes makes them real schedule owners and hides staffing gaps.

### HIGH 1 — Force-false generation can still rewrite existing days

The database function itself is not create-if-absent or immutable-after-publish.

### HIGH 2 — Absence preview is not exact publish

Publish reruns generation and may choose different assignments.

### HIGH 3 — Shift-end inheritance ignores pre-9:45 departure

The current projection begins carry-forward only after the restroom cutover.

### HIGH 4 — Single remaining employee receives a generic label

“All Locations” is not actionable or auditable location ownership.

### HIGH 5 — Seasonal hours are not configured for September 14

Production currently defaults to 6:00 PM throughout the reviewed period.

### HIGH 6 — Schedule-change push events are missing

Required ownership changes are detected locally only when the Schedule page refreshes.

### HIGH 7 — Person-specific solver rules are embedded in code

`EMP002` is treated as a permanent scheduling category.

### MEDIUM 1 — Full-day schedule remains in the backend employee contract

The target employee interface requires current responsibility, not broad day-history clutter.

### MEDIUM 2 — Multiple scheduler generations coexist

Legacy generation, absence preview/publish, CoverAll balancing, restroom balancing, lunch repair, current-page inheritance and SCH2 each own part of the result.

The target architecture must assign each responsibility once.

---

## 13. Correct target architecture

This is the first foundation specification. It must still be audited against all other domains before implementation.

### Layer 1 — People and positions

Separate:

- permanent employee identity/history;
- employment state;
- schedule eligibility;
- device eligibility;
- Messenger eligibility;
- schedule position/vacancy.

A departed employee record remains forever. A vacant shift/route can remain as an explicit vacancy rather than pretending the former employee still works.

### Layer 2 — Versioned static schedule

Create an approved static schedule version containing:

- weekly employee/position shifts;
- lunch windows;
- location ownership by time window;
- 9:45 planned restroom ownership;
- normal late coverage;
- applicable operating-hours policy;
- restrictions, locks and notes;
- import/source fingerprint;
- effective start/end dates;
- draft/approved/published/retired states.

### Layer 3 — Immutable daily baseline

For each service date:

- select the effective static version;
- create the daily baseline once;
- record a baseline fingerprint;
- preserve the baseline unchanged;
- do not write during ordinary reads.

### Layer 4 — Exception ledger

Store explicit exceptions:

- absence;
- CoverAll addition/removal;
- manager reassignment;
- employee status change;
- hours change;
- event/emergency;
- lunch window;
- 9:45 dynamic adjustment if required.

Each exception has:

- stable ID;
- author/source;
- effective start/end;
- before/after ownership;
- reason;
- preview version;
- publication timestamp;
- rollback state.

### Layer 5 — Minimal-change exception solver

The solver:

1. starts from the immutable baseline;
2. locks unaffected rows;
3. identifies only uncovered or invalid work;
4. scores eligible recipients by shift, restrictions, proximity, familiarity and load;
5. strongly penalizes moving unaffected static ownership;
6. produces one exact preview;
7. publishes that exact preview without rerunning a different solve;
8. remains idempotent when the same exception input is applied again.

### Layer 6 — Canonical effective ownership

One service computes or materializes:

- current owner for every location;
- effective start/end;
- source baseline and exception IDs;
- ownership version;
- added/removed change events;
- open/uncovered state.

Every consumer uses it:

- employee Schedule;
- manager Dashboard;
- due/overdue routing;
- guest issues;
- events;
- Memphis AI;
- notifications;
- analytics;
- inspection readiness.

### Layer 7 — Durable ownership-change notifications

When effective ownership changes, create durable events for:

- 9:45 restroom changes;
- lunch start;
- lunch end;
- inherited areas;
- removed/transferred areas;
- manager/emergency changes.

Events include exact before/after location sets and a stable notification key.

### Layer 8 — Audit and rollback

Preserve:

- baseline version;
- exception input fingerprint;
- exact preview;
- exact published output;
- changed versus unchanged rows;
- manager approval;
- notification delivery and acknowledgement;
- rollback.

---

## 14. Required scheduler state transitions

### Normal day

```text
static version selected
→ baseline generated once
→ repeated reads return same baseline/effective ownership
→ no row timestamps or owners change
```

### Absence

```text
absence recorded
→ affected ownership identified
→ minimal-change preview
→ manager approval if required
→ exact exception overlay published
→ affected employees notified
```

### CoverAll addition

```text
CoverAll capacity added
→ existing schedule remains default
→ optional redistribution preview
→ only approved rows move
→ exact changes published and notified
```

### Lunch

```text
lunch window begins
→ temporary ownership overlay activates
→ receiving employee notified
→ original ownership automatically returns at end
→ both employees notified as appropriate
```

### Shift end

```text
employee becomes inactive for the time window
→ all still-required locations transfer immediately
→ actual locations appear on recipient schedules
→ every change is notified
→ next departure repeats the process
→ one remaining employee sees every location explicitly
→ zero remaining employees creates manager open coverage
```

### Static schedule replacement

```text
new schedule imported
→ identities resolved
→ unresolved rows blocked
→ full weekly preview and audit
→ diff against current version
→ effective date selected
→ approved version published
→ future baselines use new version
→ historical days remain unchanged
```

---

## 15. Required tests before implementation can be accepted

### Static schedule stability

1. Generate a normal day twice with identical input.
2. Prove row IDs, owners, times, source, fingerprints and `updated_at` remain unchanged.
3. Prove opening employee Schedule, Dashboard or Memphis AI performs no writes.
4. Prove changing a future draft static version does not alter an already-published day.

### Static version replacement

1. Import a new weekly schedule.
2. Resolve every employee/location.
3. Block unknown names and ambiguous matches.
4. Preview every weekday.
5. Compare current versus proposed version.
6. Publish with future effective date.
7. Prove prior dates retain the old version.
8. Roll back before and after effective date.

### Employee lifecycle

1. Retain a departed employee's full history.
2. Mark them schedule-ineligible without deleting them.
3. Prove they no longer appear in future roster, phone assignment or notification delivery.
4. Preserve a vacant route/position without assigning it to the departed person.
5. Add a new employee with a new permanent identity.
6. Assign static shifts, areas, Messenger identity and phone.
7. Preview before activating.

### Absence

1. One absent employee.
2. Multiple absent employees.
3. No eligible replacement.
4. Same absence input published twice.
5. Preview equals exact publish.
6. Unaffected ownership remains byte-for-byte unchanged.
7. Workload/proximity/restriction evidence is recorded.

### CoverAll

1. Add a slot without redistribution.
2. Preview optional redistribution.
3. Confirm only approved rows move.
4. Remove/revoke a slot.
5. Rerun the same input without churn.

### Lunch

1. Start boundary.
2. End boundary.
3. Overlapping lunches.
4. Recipient absent.
5. Coverage returns exactly to original owner.
6. Notifications occur once.

### 9:45

1. No change required: static owners remain unchanged and no false alert.
2. Change required: only eligible restroom rows move.
3. Non-restroom ownership remains stable.
4. Exact employee notifications are generated.

### Shift end

1. Departure before 9:45.
2. Departure after 9:45.
3. Three employees to two.
4. Two employees to one.
5. One employee to zero.
6. Every location remains explicit.
7. No synthetic “All Locations” replacement.
8. Manager open-coverage state when nobody remains.

### Operating hours

1. September 13 closes at 6:00 PM.
2. September 14 closes at 5:00 PM.
3. Holiday one-off override.
4. Event extended hours.
5. Coverage audit detects staff leaving before close.

### Cross-system truth

For every transition, prove the same owner is returned by:

- employee Schedule;
- manager Dashboard;
- due/overdue recipient lookup;
- guest issue routing;
- notification generation;
- Memphis AI;
- analytics/inspection context.

---

## 16. Decisions established by this audit

1. Static premade schedules remain the normal authority.
2. SCH2 is not the default normal-day scheduler.
3. Exception scheduling must be minimal-change.
4. Preview must equal exact publish.
5. Ordinary reads must never regenerate or rewrite schedules.
6. Employee history is retained without keeping former employees schedule-active.
7. A replacement employee receives a new identity; historical records are never renamed.
8. Static schedules require version/effective-date publishing.
9. Seasonal hours require effective policy, not a hard default alone.
10. Current ownership must be canonical across every system consumer.
11. The last employee sees explicit locations, not “All Locations.”
12. Shift-end inheritance applies before and after 9:45.
13. Ownership-change notifications are server-generated durable events.

---

## 17. Remaining scheduler research before architecture approval

- inspect every backend caller of legacy generation and SCH2;
- inspect all lunch wrapper functions and restored-scan lunch logic;
- audit current location-group load values and time normalization;
- inspect restrictions, preferences, familiarity and adjacency quality;
- trace event-triggered schedule generation and event staffing rules;
- trace manager schedule UI writes and force flags;
- identify the intended workbook/static schedule import source;
- inspect schedule audit hard rules and open-coverage exceptions;
- inspect due/overdue ownership resolution;
- inspect dashboard ownership resolution;
- inspect guest issue ownership resolution;
- decide position/vacancy model versus separate schedule-eligibility state;
- design the static version schema;
- independently audit this scheduler specification.

No production employee, phone, schedule, operating-hours row, database function or product source was changed during this audit.
