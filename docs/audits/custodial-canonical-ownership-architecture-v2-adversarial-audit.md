# Memphis Zoo Custodial System — Canonical Ownership Architecture v2 Adversarial Audit

**Status:** Read-only architecture audit; no product or database implementation authorized  
**Prepared:** 2026-08-03  
**Plan audited:** `docs/audits/custodial-canonical-ownership-architecture-plan.md`, revision 2.0  
**Frontend repository:** `lasrevinu333-design/Engine`  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Backend repository reviewed:** `lasrevinu333-design/memphis-zoo-mcp`  
**Backend source reviewed:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Production verification:** SELECT-only Supabase queries and deployed function inspection  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Verdict

### **CONDITIONAL GO FOR A FOUNDATION REPLAN**

### **NO-GO FOR DATABASE, BACKEND, EMPLOYEE-APP, OR RELEASE IMPLEMENTATION**

Revision 2.0 correctly rejects the current split ownership system and establishes the right broad direction:

- one location-level authority;
- static schedules as normal policy;
- exception-only changes;
- exclusive lunch coverage;
- persisted shift-end inheritance;
- explicit OPEN intervals;
- one due/overdue pipeline;
- contractor identity separate from employee identity;
- actual cleaner separate from responsible owner;
- read paths that never write;
- temporary shadow comparison rather than a permanent compatibility patch.

However, the plan still contains several structural ambiguities that could re-create split authority inside the replacement system. These are design defects, not minor wording issues. Revision 3 must correct them before the plan is sent to the independent model auditors.

---

## 2. Audit method

The plan was challenged against:

1. the approved custodial operating model;
2. the original and current employee workflows;
3. live static shift and coverage templates;
4. the Sunday location-template authority;
5. mixed restroom/exhibit groups;
6. absence and CoverAll publication behavior;
7. current lunch and shift-end behavior;
8. due/overdue Messenger and native-push paths;
9. scan-event completion and manager-escalation behavior;
10. current retention settings and database size;
11. manager, employee, viewer, contractor, and device security boundaries;
12. concurrency, publication, rollback, and historical reproducibility.

No source, database row, phone, workflow, build, or APK was changed by this audit.

---

## 3. Production evidence added during this audit

### 3.1 Sunday static authority is an older divergent fork

Read-only production evidence:

- `coverage_templates`: 339 active rows, all seven weekdays, nine employee identities;
- `location_coverage_templates`: 135 active rows, Sunday only, 45 locations, four employee identities;
- all Sunday location rows were created together on 2026-04-28;
- the current group schedule was imported later on 2026-06-28 and updated afterward;
- all 135 Sunday rows reference a source location group;
- only 43 rows exactly match the current group template;
- 46 rows differ by owner;
- 32 rows have no overlapping current group-template interval;
- remaining rows differ by time, purpose, or owner type.

This does not prove what the April author originally intended. It does prove that the Sunday rows cannot remain an independent current authority.

### 3.2 Mixed groups require location-level compilation

Seven active groups contain both exhibit/non-restroom and restroom locations:

- China;
- East Admin;
- Event Center;
- Expo;
- Teton;
- West Admin;
- Zambezi.

The current post-9:45 group rows assign the complete group. They cannot preserve the non-restroom owner while moving only the restroom members. The revision-2 location-level requirement is therefore confirmed.

### 3.3 CoverAll is currently modeled as an employee and rewrites the day

Current production/source behavior:

- `COVERALL_01` through `COVERALL_04` are rows in `employees`;
- publishing CoverAll slots writes them into `daily_work_roster`;
- default publication calls forced whole-day generation;
- it then restores static owners, load-balances assignments, rebalances restrooms, reapplies lunch, and marks the 9:45 process complete;
- moved rows receive `owner_type='EMPLOYEE'` and `source_type='coverall_manual_balance'`.

Revision 2 correctly rejects this as the permanent model.

### 3.4 Any scan event currently clears legacy scan alerts

The live trigger `trg_sch_clear_scan_alerts_after_scan_event` fires after every insert into `scan_events` and clears all active scan-alert log rows for that location.

The application writes scan events for receipt, start, finish-to-form, and completion-related states. Therefore a tap or cleaning start can deactivate an overdue alert before an acknowledged completion and prevent its manager escalation.

Revision 2 correctly states that only an authoritative completed cleaning may resolve the status episode.

### 3.5 Direct native due/overdue delivery lacks final location revalidation

The current native location worker:

- selects recipients from all daily group assignments attached to the employee;
- does not require the assignment interval to be active at delivery time;
- does not use canonical effective ownership;
- retires a pending job when device authority is invalid or an acknowledgement exists;
- does not retire it merely because the location was cleaned or ownership changed.

The employee push delivery worker revalidates credential, device assignment, and assignment epoch immediately before provider send. The backend installation does not supply a location-status/current-ownership final-delivery hook.

Revision 2 requires this revalidation, but revision 3 must make the atomic status-episode and outbox design explicit.

### 3.6 Existing retention configuration does not justify deleting ownership history

The live database retention report showed:

- database size approximately 126 MB;
- operational history mode `preserve`;
- 14-day message and event settings;
- a 45-day schedule-window setting;
- the broad free-tier retention cron disabled;
- legacy retention functions explicitly changed to preserve operational history.

The 14-day communication policy must not be applied to responsibility history. New ownership records must also be explicitly excluded from any future generic schedule-window purge.

---

## 4. Findings

## BLOCKER 1 — Input facts and derived transitions are conflated

Revision 2 places all of the following in `custodial_ownership_events`:

- absence adjustment;
- CoverAll assignment;
- 9:45 adjustment;
- lunch start/end;
- shift-end inheritance;
- operating-hours change;
- manager override;
- OPEN interval.

These are not one kind of thing.

Some are authoritative source inputs:

- an employee is absent;
- a contractor engagement exists;
- a manager issued an override;
- a date-range operating policy changed.

Others are deterministic compiler outputs:

- the 9:45 phase became active;
- a bounded lunch transfer started or ended;
- a departing owner's locations were inherited;
- a location became OPEN because no eligible owner remained.

If generated transitions are fed back as source inputs, repeated compilation can become self-referential, duplicate events, or preserve an old derived result after its lower-level inputs changed.

### Required revision

Separate:

1. **authoritative change inputs** — append-only facts and manager commands; and
2. **compiled transition records** — deterministic evidence generated from one exact input set and tied to one ownership revision.

A compiler rerun may reproduce transition records with stable deterministic keys, but generated records must never become hidden inputs to the next run.

---

## BLOCKER 2 — Atomic publication and transactional outbox are underspecified

Revision 2 requires one published revision but does not fully specify how a candidate becomes current while notifications are created.

Without an atomic publication boundary, the system could expose:

- employee Schedule on revision N+1;
- Dashboard on revision N;
- due/overdue jobs created from N;
- schedule-change notifications created from an incomplete diff;
- two current revision pointers during concurrent publication.

### Required revision

Publication must:

1. acquire a per-service-date advisory/transaction lock;
2. load one immutable canonical input snapshot;
3. compile a candidate revision without changing current reads;
4. validate all invariants;
5. write candidate intervals and transition records;
6. compute the exact old-to-new diff;
7. write notification/outbox intents from that same diff;
8. atomically advance one current-publication pointer;
9. commit once;
10. release delivery workers only after commit.

A failure before commit must expose none of the candidate revision.

---

## BLOCKER 3 — The replacement authority lacks an explicit security model

The current production scheduling tables are RLS-enabled and forced, with direct table privileges limited to `postgres` and `service_role`. Revision 2 does not state equivalent requirements for the new tables, compiler, resolver, or publication functions.

A canonical responsibility system is a high-value authority. It must not become directly writable from an employee WebView, contractor link, public page, generic authenticated role, or an unrestricted SQL function.

### Required revision

Revision 3 must define:

- forced RLS on all new tables;
- no direct `anon` or ordinary `authenticated` grants;
- server-controlled writes only;
- named manager write authorization for draft/approve/publish actions;
- employee-device reads limited to that device's assigned employee and current necessary schedule;
- Viewer reads limited to approved Dashboard data;
- contractor-link reads limited to one slot/date and no ownership mutation;
- `SECURITY DEFINER` functions with locked `search_path` where required;
- public execute grants revoked;
- immutable publication rows protected from update/delete by function boundary and database enforcement;
- audit actor, manager identity, device assignment epoch, and idempotency key on every mutation.

---

## HIGH 1 — Operational requirement windows are too narrowly described as public operating hours

Custodial responsibility begins before public opening during morning cleaning and may continue for approved after-hours events or assigned work.

A global public-open/public-close boundary is therefore not enough.

### Required revision

Create location/date-specific **operational requirement intervals** derived from:

- published static coverage;
- public operating-hours policy;
- approved event impacts;
- explicit after-hours work;
- closures and manager exceptions.

The outer rule is:

- outside a required interval: `not_required`;
- inside a required interval with no eligible owner: `OPEN`.

`not_required` is not the lowest owner-precedence fallback. It is an outer eligibility gate.

---

## HIGH 2 — The precedence list can be misread around `OPEN` and `not_required`

Revision 2 lists OPEN before not-required. Elsewhere it says operating hours clip intervals, but the ordered list is still ambiguous.

### Required revision

Use compiler stages rather than one overloaded precedence list:

0. determine operational requirement intervals;
1. expand the published static phase to locations;
2. apply hard eligibility and date-specific absence/contractor capacity;
3. apply bounded scheduled transfers such as lunch;
4. derive shift-end inheritance;
5. apply explicit manager/emergency overrides last;
6. emit one assigned, OPEN, or not-required interval.

This also clarifies the 9:45/lunch case: the 9:45 static phase changes first; an active lunch transfer then temporarily supersedes it.

---

## HIGH 3 — Baseline identity omits several inputs required for historical reproducibility

The baseline section emphasizes service date and static version but does not require identity for:

- group-membership snapshot;
- operating-requirement policy revision;
- source timezone conversion rules;
- location active/type snapshot;
- schedule-subject resolution policy.

### Required revision

The baseline and compilation fingerprints must include every normalized input that can change output. Historical resolution must use saved snapshots, not today's mutable location/group/employee records.

---

## HIGH 4 — Schedule subject, employee identity, vacancy, and replacement-hire semantics are not fully resolved

Revision 2 allows an employee or future position identity but does not choose a complete subject model.

Directly binding the timeless static schedule to Michael or Daniel creates ambiguity after departure. Renaming their records is prohibited, but leaving them schedule-eligible creates false coverage.

### Required revision

Define an ownership-subject abstraction that can represent:

- permanent employee identity;
- schedule position/slot;
- contractor engagement;
- OPEN.

A static rule may target a position. An effective-dated staffing assignment resolves that position to a person. A vacant position compiles to an exception/OPEN or reviewed replacement; it never silently resolves to the departed historical employee.

The current audit still must not alter Michael or Daniel until the Custodial Manager explicitly authorizes their lifecycle changes.

---

## HIGH 5 — Due/overdue status episodes need their own durable identity

Revision 2 refers to a status episode but does not define its authority.

Using only a generated notification key based on current status and latest completion is insufficient for:

- due-soon becoming overdue;
- cleaning starting but not completing;
- ownership changing while overdue;
- completion during escalation grace;
- a new overdue episode after a later cleaning;
- idempotent cancellation of all employee and manager delivery work.

### Required revision

Define one durable location-status episode with:

- stable episode ID;
- location;
- status transition timestamps;
- latest completion basis;
- current due/overdue state;
- started-work state and bounded suppression;
- resolved completion ID/time;
- active ownership revision;
- employee intent IDs;
- manager escalation state;
- superseded/resolved reason.

Notifications are delivery records for the episode, not the episode itself.

---

## HIGH 6 — Time semantics and concurrent recompilation require stronger definition

The plan uses half-open intervals but does not fully specify conversion from Memphis-local schedule dates/times to timestamps, daylight-saving boundaries, or concurrent changes to the same service date.

### Required revision

- author in `America/Chicago` local date/time;
- compile to `tstzrange` with explicit timezone conversion;
- use `[start,end)` consistently;
- reject nonexistent/ambiguous local times unless an explicit policy resolves them;
- serialize publication per service date;
- ensure repeated input hashes return the existing revision instead of publishing another.

---

## MEDIUM 1 — Retention needs explicit technical protection

The plan correctly refuses to invent a legal duration, but it must state that new ownership tables are outside generic communication and short schedule-window purge functions.

Archive may be added later; deletion must not break historical interpretation of sessions, inspections, alerts, or analytics.

---

## MEDIUM 2 — Performance and indexing requirements are missing

The new resolver will become a dependency for employee Schedule, Dashboard, notification creation, guest dispatch, AI, and analytics.

Revision 3 should require:

- indexes for current revision/date/location/employee/range lookup;
- precompiled intervals rather than recomputing the solver on every read;
- measured API budgets for employee and manager views;
- bounded notification/status queries;
- query-plan regression tests.

No arbitrary performance number is invented by this audit; the project must set and measure budgets before release.

---

## MEDIUM 3 — Observability and reconciliation gates are incomplete

Revision 3 should expose manager/internal health for:

- current ownership revision by date;
- compiler input hash and version;
- OPEN/conflict counts;
- stale publication age;
- shadow mismatch counts by consumer;
- pending/superseded notification intents;
- status episodes awaiting resolution;
- employee device revision lag;
- contractor link state;
- rollback/cutover state.

Employees should not see these diagnostics.

---

## MEDIUM 4 — Manager action semantics require a separate one-time work request

Revision 2 notes the policy gate but the data model should make it structural.

“Please clean Teton once” is not the same as “You own Teton from 2:00–5:00.”

A one-time work request may create a task/notification and cleaning evidence without changing canonical ownership. Only an explicit ownership-transfer command changes responsibility intervals.

---

## 5. Requirements that passed the adversarial audit

The following revision-2 decisions remain correct and should be preserved:

- static schedule versioning;
- immutable daily baseline;
- snapshotting group membership;
- location-level effective intervals;
- no overlapping owners;
- explicit OPEN;
- no `All Locations` shortcut;
- normal 9:45 phase is static, not re-optimized daily;
- dynamic solver is exception-only;
- eligibility → preserve unaffected ownership → minimum moves → proximity → workload;
- lunch is exclusive and bounded;
- lunch end resolves current lower layers rather than restoring a stale employee;
- shift-end inheritance publishes actual locations;
- all consumers use one resolver;
- current and historical ownership are both queryable;
- CoverAll is a contractor concept, not an employee shortcut;
- scan/start does not resolve overdue;
- acknowledged completion resolves status exactly once;
- employee dismissal does not cancel manager escalation;
- one native employee alert presentation owner;
- active-session GPS does not redefine ownership;
- shadow comparison is temporary diagnostic evidence;
- Build 22 remains rollback until a later APK is admitted.

---

## 6. Required revision-3 structure

Revision 3 should contain these authoritative layers:

```text
Versioned source artifacts and static policy
        ↓
Operational requirement intervals
        ↓
Immutable location-level daily baseline
        ↓
Authoritative change inputs
        ↓
Deterministic compiler candidate
        ↓
Derived transition records
        ↓
Validated effective ownership intervals
        ↓
Atomic publication pointer + transactional outbox
        ↓
Canonical read APIs and one notification pipeline
```

Required new distinctions:

- input fact vs derived transition;
- operational requirement vs OPEN;
- schedule position vs employee identity;
- status episode vs notification delivery;
- ownership transfer vs one-time work request;
- candidate revision vs current published revision;
- employee display state vs manager/internal diagnostics.

---

## 7. Required pre-implementation gates

Before isolated schema/compiler implementation:

1. publish revision 3 of the architecture;
2. independently audit revision 3 with the three model-specific auditors;
3. resolve the approved static source conflict for Sunday;
4. define the operating-hours/after-hours event policy fixture, including September 14;
5. define schedule-position and replacement-hire fixtures;
6. define contractor slot/named-worker policy;
7. approve late-day inheritance tie-break fixtures;
8. define manager ownership-transfer versus one-time-work-request UX;
9. define retention/archive policy boundaries;
10. prove the migration can run first in an isolated Supabase development branch without production writes.

---

## 8. Final audit disposition

Revision 2 is a strong correction to the current system and is not rejected wholesale.

It is not yet sufficiently precise to become the schema and compiler specification. The missing distinctions around source inputs, derived transitions, atomic publication, security, operational requirement windows, schedule subjects, and status episodes are exactly where another split authority or unfair accountability conclusion could be born.

The correct next step is a complete revision 3 architecture, followed by an independent plan audit.

No product, database, build, workflow, APK, or phone change was made during this audit.
