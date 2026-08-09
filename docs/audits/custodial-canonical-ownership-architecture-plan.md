# Memphis Zoo Custodial System — Canonical Ownership Foundation Architecture

**Status:** Architecture plan for independent audit; implementation is not authorized  
**Plan revision:** 2.0 — revised after internal adversarial review  
**Prepared:** 2026-08-03  
**Frontend repository:** `lasrevinu333-design/Engine`  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Backend repository reviewed:** `lasrevinu333-design/memphis-zoo-mcp`  
**Backend source reviewed:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Production verification:** read-only Supabase queries and deployed function inspection  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Purpose

The system needs one defensible answer to:

> Who is responsible for this exact location at this exact time?

That answer must be identical on the employee Schedule, manager Schedule, Dashboard, due/overdue delivery, guest routing, Memphis AI, analytics, and historical review.

The current program contains strong scheduling, device, notification, session, and audit components, but responsibility is split among competing group templates, Sunday location templates, mutable daily rows, reader-local inheritance, all-day notification joins, and separate alert pipelines.

This plan replaces that split authority with one versioned, location-level responsibility foundation while preserving the original program's proven operating model:

- a premade static weekly schedule is the normal authority;
- employees choose the practical order in which they clean their current areas;
- 9:45 changes restroom ownership without needlessly moving non-restroom work;
- lunch temporarily transfers responsibility and then ends automatically;
- areas transfer when employees leave;
- exceptions are minimal, explainable, reversible, and audited;
- actual cleaning evidence remains distinct from responsibility;
- no employee is blamed from a schedule they did not actually own.

---

## 2. Non-negotiable design principles

1. **One authority.** Every consumer reads the same effective-ownership result.
2. **Static-first.** A published static schedule is normal policy, not a suggestion for daily optimization.
3. **Exception-only change.** Absence, CoverAll, lunch, shift end, operating-hours changes, and manager overrides alter only affected responsibility intervals.
4. **Location-level truth.** Groups are authoring and display tools; the authoritative responsibility unit is an individual operational location.
5. **Immutable publication.** Published static versions, daily baselines, transition events, and historical ownership revisions are not rewritten by reads.
6. **No overlap.** One location cannot have two active effective owners for the same instant.
7. **Explicit OPEN.** When nobody is eligible, the system records OPEN rather than inventing an owner.
8. **Performer is not owner.** The employee who cleans a location may differ from the employee responsible for it.
9. **Read paths never write.** Opening Schedule, Dashboard, Messenger, AI, or a report cannot generate or alter the schedule.
10. **Determinism.** Identical approved inputs produce identical ownership output and the same input fingerprint.
11. **Idempotency.** Replaying an exception or notification event cannot create duplicate responsibility or delivery.
12. **Fail closed.** Compiler conflicts block publication and require manager review; they are not silently resolved by row order.
13. **No permanent compatibility patch.** Shadow comparison is permitted during migration, but the final system has one authority and retires competing paths.

---

## 3. Required terminology

### 3.1 Static schedule version

An immutable, approved weekly policy containing shifts, lunches, normal morning assignments, 9:45 ownership, restrictions, and authoring metadata.

### 3.2 Daily baseline

The location-level schedule produced once from the applicable static version for one service date before day-specific exceptions.

### 3.3 Day-specific adjustment

A reviewed replacement caused by an absence, CoverAll capacity, employee eligibility change, event impact, or other date-specific condition.

### 3.4 Ownership transition event

An append-only event that changes responsibility for selected locations and a defined interval, such as lunch, shift-end inheritance, explicit transfer, emergency override, or OPEN.

### 3.5 Effective ownership interval

The compiled, non-overlapping interval stating who owns one location, why, and under which published revision.

### 3.6 Effective owner

The one employee or contractor responsible for the location at the resolved time.

### 3.7 Active cleaner

The employee currently checked into the NFC cleaning session. This is performance evidence, not an automatic ownership transfer.

### 3.8 Last cleaner

The employee attached to the latest acknowledged completed cleaning session.

### 3.9 OPEN

A manager-visible interval during which coverage is required but no eligible owner exists.

### 3.10 No ownership required

A location is outside its active operational window, such as after public closing. This is not OPEN and must not create an employee exception.

---

## 4. Authoritative data model

The names below are conceptual. Exact migration names remain subject to implementation review.

### 4.1 `custodial_schedule_versions`

One immutable weekly policy version.

Required fields:

- `schedule_version_id`
- human-readable version label
- source artifact reference and SHA-256
- normalized import fingerprint
- effective start date
- optional effective end date
- state: `draft`, `validated`, `approved`, `published`, `retired`
- Memphis timezone
- previous version ID
- created by / validated by / approved by / published by
- corresponding timestamps
- policy notes

Rules:

- published rows are immutable;
- effective date ranges cannot ambiguously select two published versions;
- changing the normal schedule creates a new version;
- historical dates retain their original version.

### 4.2 `custodial_schedule_shift_rules`

Version-bound normal employee shift and lunch policy.

Required fields:

- schedule version
- employee or position identity
- weekday
- shift start/end
- lunch start/end
- schedule eligibility requirement
- restrictions/capabilities
- source row reference

A future position-based schedule may be supported, but a new employee must receive a new permanent identity. Historical Michael or Daniel records must never be renamed into another person.

### 4.3 `custodial_schedule_coverage_rules`

Version-bound normal ownership authoring rules.

Required fields:

- schedule version
- weekday
- authoring scope: group or individual location
- group/location ID
- phase: morning, post-9:45, or other approved static phase
- coverage start/end
- responsibility purpose
- normal owner subject
- workload points
- restrictions
- source row reference
- notes

Groups remain convenient for schedule authoring, but publication expands them into individual locations.

### 4.4 `custodial_schedule_membership_snapshots`

A published schedule version must snapshot the group-to-location membership it used.

This prevents a later group-membership edit from silently rewriting historical responsibility.

Required fields:

- schedule version
- group ID/code/name
- location ID/code/name
- location type/form type
- membership source
- snapshot hash

### 4.5 `custodial_daily_baselines`

One immutable compiled baseline per service date and static version.

Required fields:

- baseline ID
- service date
- schedule version
- compiler version
- input fingerprint
- publication state
- created/published actor and timestamp
- validation summary

Normal generation is **create-if-absent**. It must not update an already published day.

### 4.6 `custodial_daily_baseline_intervals`

Location-level baseline intervals before day-specific changes.

Required fields:

- baseline interval ID
- baseline ID
- service date
- location and display group
- start/end timestamps
- employee owner or OPEN
- owner type
- responsibility purpose
- source coverage rule
- load points
- operational-window status

### 4.7 `custodial_ownership_events`

Append-only, idempotent, day-specific responsibility changes.

Required fields:

- event ID
- stable idempotency key
- service date
- event type
- effective start
- optional effective end
- affected location IDs
- prior owner subject when known
- new owner subject or OPEN
- reason code
- actor/source
- source record ID
- schedule version and baseline ID
- supersedes/superseded-by relationship
- state: `draft`, `validated`, `published`, `cancelled`, `superseded`
- created/published timestamps
- audit metadata

Supported event types include:

- absence adjustment
- CoverAll/contractor assignment
- 9:45 location adjustment when the static version does not already encode it
- lunch transfer
- lunch end
- shift-end inheritance
- explicit manager transfer
- emergency override
- operating-hours change
- employee eligibility change
- explicit correction
- OPEN interval

### 4.8 `custodial_ownership_compilation_runs`

A reproducible compilation record.

Required fields:

- compilation/ownership revision ID
- service date
- static version and baseline
- compiler version
- canonical input hash
- prior ownership revision
- status
- conflict count
- OPEN count
- exact diff summary
- validation result
- created/published actor and timestamps

### 4.9 `custodial_effective_ownership_intervals`

The single operational authority.

Required fields:

- ownership revision
- service date
- location ID/code/name
- display group ID/code/name
- `[effective_start, effective_end)` timestamp range
- responsibility status: `assigned_employee`, `assigned_contractor`, `open`, `not_required`
- employee ID or contractor assignment ID
- owner display name
- responsibility purpose
- static baseline interval ID
- controlling transition event ID
- previous owner subject
- reason code
- schedule version
- compiler version
- published timestamp

Database requirements:

- no overlapping published ranges for the same location and ownership revision;
- exactly one published current revision per service date;
- assigned rows require exactly one eligible owner subject;
- OPEN and not-required rows prohibit an owner subject;
- range start must precede range end;
- a compilation cannot publish while validation conflicts remain.

### 4.10 Contractor/CoverAll identities

CoverAll is not an employee merely because the database needs an ID.

Required concepts:

- contractor organization
- reusable contractor slot/capacity identity
- date-specific contractor engagement
- optional named worker identity
- shift/capacity window
- secure assignment-link authority
- location-level contractor assignment
- contractor device identity only when a dedicated managed device exists

The current `COVERALL_01` through `COVERALL_04` pseudo-employees may be preserved as migration aliases, but they must not remain the permanent employee model or appear as ordinary employee history.

---

## 5. Employee lifecycle foundation

The current single `employees.active` flag conflates historical identity with operational eligibility.

The final lifecycle must distinguish:

- identity retained
- currently employed
- schedule eligible
- phone eligible
- Messenger eligible
- active effective date
- inactive effective date
- departure reason
- historical-only/test identity

Rules:

- departed employees are inactivated, not deleted;
- historical sessions, schedules, inspections, analytics, messages subject to retention, and phone assignments retain the original employee ID;
- a replacement hire receives a new employee ID;
- changing phone assignment rotates the device assignment epoch and notification authority;
- the audit does not change Michael McWright or Daniel Morgan. They remain exactly as currently configured until the Custodial Manager explicitly changes them.

---

## 6. Static schedule publication lifecycle

The manager workflow must be:

```text
Import or enter schedule
→ resolve employees, contractor slots, groups, and locations
→ snapshot group membership
→ expand to individual locations
→ preview all seven days
→ audit coverage, restrictions, workload, proximity, mixed groups, lunches, and closing times
→ compare with current published version
→ approve
→ publish with effective date
```

Publication rules:

- a new schedule does not rewrite old days;
- the prior version remains recoverable;
- the system identifies future days affected by the new effective date;
- manager preview and publication use identical normalized inputs;
- unchanged input cannot produce a different result;
- opening Schedule or asking Memphis a question performs no write;
- ordinary daily baseline generation occurs once and is create-if-absent.

The current Sunday `location_coverage_templates` are migration evidence, not an approved parallel authority. Read-only production analysis found:

- all 135 active rows are Sunday-only;
- all were created together on April 28, before the current group templates;
- their notes say they were seeded from the group schedule;
- only 43 exactly match the present group template;
- at least 46 differ by owner;
- some contain Sunday-specific read-time inheritance and scan-timer ownership.

They must be reconciled against the approved source schedule and retired as an independent resolver before cutover.

---

## 7. Location expansion and mixed-group rules

The compiler expands group authoring rules into locations before applying responsibility transitions.

Production currently contains seven mixed groups that combine a non-restroom location with restrooms:

- China
- East Admin
- Event Center
- Expo
- Teton
- West Admin
- Zambezi

Rules:

- 9:45 restroom changes affect only restroom members;
- non-restroom members retain their applicable phase owner unless another explicit event changes them;
- CoverAll and absence solvers may move individual locations or an explicitly validated bundle, never blindly move a mixed group;
- employee display may regroup adjacent locations after ownership is resolved;
- due/overdue status, NFC, guest reporting, GPS evidence, and analytics always remain location-specific.

---

## 8. Deterministic compilation pipeline

### 8.1 Inputs

A compilation uses only versioned or explicit inputs:

- published static schedule version
- snapshotted location membership
- service date
- operating-hours policy revision
- employee/contractor eligibility state effective for the date
- published absences/PTO
- published CoverAll engagements
- manager locks/transfers/overrides
- approved event impacts
- prior published ownership revision when recompiling an exception

### 8.2 Phase baseline

The static version determines the applicable normal phase by timestamp:

- morning/deep-clean phase;
- post-9:45 area ownership;
- post-9:45 restroom ownership;
- other explicitly approved static phases.

The phase selector is not a dynamic optimizer.

### 8.3 Hard eligibility gate

Before accepting any owner, the compiler verifies:

- schedule eligibility;
- active employment/contract engagement;
- shift coverage for the interval;
- restrictions and required capabilities;
- no conflicting explicit exclusion.

Ineligibility invalidates the candidate; it is not merely a lower score.

### 8.4 Day-specific capacity adjustment

Absences and CoverAll alter only locations made invalid, uncovered, or explicitly selected for contractor help.

Replacement ranking must prioritize:

1. hard eligibility;
2. preservation of unaffected static ownership;
3. minimal number of moved locations;
4. geographic proximity/route coherence;
5. workload balance;
6. deterministic tie-breaker.

Workload balance cannot justify wholesale redistribution when the static schedule remains valid.

### 8.5 Effective precedence

For one location and instant, the compiler resolves the highest active valid layer:

1. emergency manager override;
2. explicit manager ownership transfer;
3. active lunch transfer;
4. active shift-end inheritance;
5. published day-specific absence/contractor adjustment for the applicable static phase;
6. published static phase owner;
7. OPEN;
8. not-required outside the operational window.

Additional rules:

- employee ineligibility is a hard gate at every layer;
- operating hours clip responsibility intervals rather than inventing owners;
- active cleaning does not change ownership;
- notification recipient and phone state never participate in ownership precedence;
- an expired override restores whatever lower layer is valid at that later time, not a stale owner captured when the override began.

### 8.6 Lunch semantics

At lunch start:

- close/suspend effective intervals for the locations being covered;
- create exclusive temporary intervals for the coverer;
- notify the coverer once;
- remove those locations from the employee on lunch.

At lunch end:

- close the temporary intervals;
- resolve the next lower valid layer at that timestamp;
- restore the original owner only if still eligible and still the lower-layer result;
- otherwise continue an absence, contractor, shift-end, override, or OPEN state;
- notify only employees whose responsibility changed.

Lunch coverage cannot coexist with the base owner for the same location.

### 8.7 9:45 semantics

At 9:45:

- switch to the published post-9:45 phase;
- alter only the locations whose static phase owner changes;
- preserve non-restroom ownership in mixed groups;
- publish the exact location-level diff;
- notify only employees whose current responsibility changes.

A normal published 9:45 phase should not be recalculated every day. A dynamic 9:45 solver is reserved for a real exception and must publish a reviewed event/revision.

### 8.8 Shift-end semantics

At an employee's shift end:

- close all effective intervals owned by that employee;
- assign each still-required location to an eligible remaining employee or contractor using the approved minimal-change/proximity/workload policy;
- publish explicit individual locations;
- never replace the list with `All Locations`;
- notify receiving employees;
- create OPEN intervals when no eligible owner remains.

If shift end occurs during lunch, lunch end resolves against the then-current lower layers; it must not restore the departed employee.

### 8.9 End of staffing

When all eligible staff have left before public close:

- required locations become explicit OPEN;
- the manager receives an uncovered-coverage exception;
- employee phones do not receive irrelevant assignments after shift end;
- public closing ends the required interval according to versioned operating-hours policy.

---

## 9. CoverAll exception design

The useful current concepts to preserve are:

- up to four added-capacity slots;
- secure, expiring, no-store assignment links;
- printable English and Spanish instructions;
- shift windows;
- audited manager creation/revocation.

The current destructive behavior must be retired:

- CoverAll publication cannot call forced whole-day generation;
- it cannot restore and rewrite all static rows;
- it cannot move entire mixed groups by load spread alone;
- it cannot set a contractor pseudo-employee to ordinary `owner_type='EMPLOYEE'`;
- it cannot silently mark the 9:45 process complete after unrelated regeneration.

Target flow:

```text
Manager adds CoverAll engagement
→ select shift/capacity and optional named worker
→ preview only proposed moved locations
→ score eligibility, minimal change, proximity, then workload
→ approve exact location-level contractor intervals
→ publish one exception revision
→ issue secure contractor schedule link
```

Contractor notifications:

- a contractor without a managed employee phone receives the secure schedule view, not employee push or Messenger identity;
- a dedicated managed contractor device, when intentionally configured, receives only its contractor assignment intents;
- manager due/overdue visibility remains active regardless of contractor device capability.

---

## 10. Canonical resolver contracts

### 10.1 Current location owner

One read-only resolver accepts location and timestamp and returns:

- service date and resolved timestamp;
- location and display group;
- responsibility status;
- effective owner subject;
- effective start/end;
- responsibility purpose;
- reason code;
- static version;
- baseline ID;
- transition event ID;
- ownership revision;
- current device assignment epoch when relevant.

### 10.2 Historical location owner

The same model resolves responsibility as-of a past timestamp without being changed by later schedule versions.

### 10.3 Employee current schedule

Returns only locations owned by the enrolled employee at the requested time, plus clearly separated temporary categories such as lunch or inherited areas.

It does not calculate inheritance locally and does not mutate the schedule.

### 10.4 Manager day view

Returns:

- static baseline owner;
- current/future effective owner;
- transition reason;
- OPEN intervals;
- actual cleaner and latest cleaner separately;
- exact ownership revision.

### 10.5 Read-only guarantee

All resolver and display APIs are `STABLE`/read-only in behavior. No resolver may call generation, upsert, publication, or notification creation.

---

## 11. Notification and escalation foundation

### 11.1 One durable intent

Every message, event, due-soon, overdue, schedule change, lunch start/end, inheritance, transfer, or emergency reassignment creates one durable logical notification intent.

Required fields include:

- stable logical key;
- event type and source event;
- employee/contractor recipient;
- device assignment epoch when applicable;
- ownership revision;
- location and status episode where applicable;
- route;
- display copy;
- speech copy;
- received/displayed/first-cycle/second-cycle/opened/dismissed/acknowledged states;
- superseded/resolved state;
- retry and terminal classification.

### 11.2 Ownership and status revalidation

For due/overdue delivery:

1. resolve the effective owner when the status episode begins;
2. create one logical intent;
3. immediately before delivery, revalidate:
   - location remains due/overdue;
   - ownership revision still assigns the recipient;
   - device assignment epoch is current;
4. cancel or reroute when superseded;
5. deliver once through the native employee coordinator;
6. preserve manager escalation independently of employee display or dismissal.

### 11.3 Correct completion semantics

An NFC tap, scan receipt, or cleaning start does **not** resolve an overdue condition.

Current production legacy behavior clears active scan-alert logs after any inserted `scan_events` row. That can suppress escalation before cleaning completion.

Target behavior:

- scan/start may record `work_started` and suppress redundant employee repeats for a bounded period;
- only an authoritative acknowledged cleaning completion that changes the location status resolves the due/overdue episode;
- completion cancels pending employee jobs and active escalation timers idempotently;
- a failed or abandoned session does not falsely resolve the episode.

### 11.4 One employee presentation owner

The native coordinator owns employee alert presentation:

```text
chime
→ personalized spoken announcement
→ chime
→ identical personalized spoken announcement
→ silence
```

The overlay remains until Open or Dismiss. The OS transport cannot add a separate default ding, duplicate overlay, or third repetition.

Due/overdue is not copied into Messenger merely to generate a second push. A readable operational alert history comes from the canonical notification log.

---

## 12. GPS and cleaning-session relationship

Current release scope tracks location only during an active cleaning session.

Rules:

- server-authoritative session start activates native location observation;
- tracking remains active through screen off, background, and process recovery as permitted by the approved Android design;
- server-authoritative completion/cancellation stops tracking;
- observations attach to the session, device, employee performer, location, and timestamp;
- GPS does not redefine effective ownership;
- departure requires stable evidence, adequate accuracy, hysteresis, and multiple readings or dwell;
- a single inaccurate point cannot establish that an employee left;
- return-to-area state is recorded;
- manager visibility distinguishes unavailable, unreliable, near, away, and returned.

Production has effective coordinate coverage for all active locations, but most locations use group-level coordinates. Group coordinates may support broad-area evidence; they must not be presented as proof of presence at a specific restroom or exhibit. Critical locations require direct field calibration and measured radii.

The future live zoo map is an extension point, not a current release requirement.

---

## 13. Consumer cutover requirements

### Employee Schedule

- effective intervals only;
- no local inheritance;
- no additive lunch duplication;
- actual locations, never `All Locations`;
- automatic refresh on ownership revision/lifecycle events;
- no permanent Refresh button.

### Manager Schedule

- baseline and effective ownership shown separately;
- OPEN and transition reasons visible;
- preview and rollback evidence available.

### Dashboard

Separate:

- current owner;
- responsibility reason;
- cleaning now by;
- last cleaned by;
- latest completion;
- due/overdue state;
- ticket state.

### Native notifications

- canonical owner only;
- active ownership interval only;
- one stable key;
- status and ownership revalidation before delivery;
- no duplicate Messenger scan alert.

### Guest reports

- resolve effective owner at dispatch;
- retain manager recipient;
- record ownership revision;
- reroute/cancel employee delivery when ownership changes.

### Memphis AI

- current-owner questions use canonical resolver;
- historical responsibility uses historical resolver;
- planned/static schedule is used only when explicitly asked;
- response field names are versioned and tested;
- OPEN is stated accurately.

### Analytics

- actual performer and effective owner remain separate;
- responsibility history may contextualize workload and alerts;
- no coaching or fault inference solely from static planned ownership.

---

## 14. Migration and shadow verification

Implementation must not trust current conflicting rows as approved truth.

Required sequence:

1. export current static templates, location templates, group membership, roster, restrictions, operating hours, daily rows, alerts, and session history;
2. identify the approved static source artifact for each weekday;
3. import it into a draft version and snapshot membership;
4. compile immutable shadow baselines;
5. translate existing absences, CoverAll, lunch, 9:45, late coverage, and overrides into candidate events;
6. compile shadow effective intervals;
7. compare every old consumer with the shadow resolver for representative dates/times;
8. classify each mismatch as:
   - old defect;
   - source ambiguity;
   - policy decision;
   - compiler defect;
9. resolve through reviewed rules and fixtures;
10. independently audit the schema, compiler, resolver, and migration;
11. cut every consumer over in one controlled release boundary;
12. retire competing owner functions, Sunday location authority, reader-local inheritance, and duplicate alert paths.

Shadow operation is temporary diagnostic evidence. It is not a permanent dual-authority compatibility layer.

---

## 15. Rollback

Rollback must preserve both old and new evidence.

Requirements:

- ownership cutover is versioned and feature-gated at one service boundary;
- the prior consumer release remains available;
- published new ownership rows are never deleted to “undo” them;
- rollback marks the candidate revision inactive for current reads while retaining audit history;
- no old function is dropped until the new system passes independent and field acceptance;
- Build 22 remains the employee APK rollback baseline until a later build is admitted.

---

## 16. Retention and privacy

Ownership history is operational accountability and schedule history, not disposable notification content.

Policy:

- published schedule versions, baseline rows, ownership events, effective intervals, publish/rollback audits, sessions, inspections, and tickets are durable records;
- the existing 14-day event/message deletion policy does not apply to responsibility history;
- no automatic destructive purge is authorized by this plan;
- personally identifying payloads are minimized to stable IDs and necessary display snapshots;
- a future organizational retention duration should archive records while preserving the ability to interpret sessions, alerts, and analytics historically;
- notification presentation content may follow its approved shorter retention independently from the underlying operational event.

This plan does not invent a legal retention period that the source materials do not establish.

---

## 17. Required automated proof

### 17.1 Static publication

- published versions are immutable;
- effective date selection is unambiguous;
- import fingerprint is stable;
- preview and publish are identical;
- normal reads perform zero writes;
- create-if-absent never changes a published day.

### 17.2 Ownership invariants

- no overlapping published intervals per location;
- every required location/time has one owner or OPEN;
- not-required begins at correct operating boundary;
- mixed groups expand correctly;
- repeated compilation is byte/logically identical;
- historical resolver remains stable after future changes.

### 17.3 Exception fixtures

At minimum:

1. normal static day;
2. one absence;
3. multiple absences;
4. one CoverAll slot;
5. multiple contractor slots;
6. overlapping lunches;
7. 9:45 before lunch;
8. lunch overlapping shift end;
9. employee leaves before 9:45;
10. two employees remain;
11. one employee remains;
12. no employee remains before close;
13. seasonal close changes to 5:00 PM;
14. manager override starts/ends;
15. employee inactivated mid-day;
16. phone reassigned mid-day;
17. ownership changes while due/overdue intent is pending;
18. cleaning begins but is not completed;
19. cleaning completes during escalation grace;
20. repeated exception submission.

### 17.4 Cross-consumer contract

For the same location and timestamp, assert identical responsibility identity and revision from:

- canonical resolver;
- employee Schedule;
- manager Schedule;
- Dashboard current-owner field;
- native due/overdue intent;
- guest routing;
- Memphis AI;
- analytics responsibility query.

### 17.5 Notification proof

- one operational episode creates one logical intent;
- ownership/status revalidated before delivery;
- pending intent cancelled or rerouted after transfer;
- scan/start does not resolve overdue;
- acknowledged completion resolves exactly once;
- manager escalation remains truthful;
- exact two-cycle audio sequence;
- displayed/opened/dismissed evidence survives offline/process death.

---

## 18. Physical acceptance proof

Before release:

- lunch areas appear only on the coverer's phone and disappear at end;
- 9:45 moves only intended restroom locations;
- inherited locations appear individually;
- ownership updates without a manual Refresh control;
- sleeping/offline phones reconcile to the latest ownership revision;
- no alert is spoken after the responsibility interval ends;
- active-session GPS survives screen off and reports stable departure/return evidence;
- Karen completes the field workflow repeatedly without manager explanation beyond initial NFC training;
- every employee KIOSK is individually enrolled, push-tested, NFC-tested, queue-clean, and rollback-verified.

---

## 19. Policy gates still requiring fixture evidence

These are not invitations to guess. They are explicit gates before implementation approval.

1. **Late-day inheritance scoring.** The approved order is eligibility → preserve unaffected ownership → minimum moves → proximity → workload. Exact weights and tie-break fixtures must be approved against real zoo geography and schedules.
2. **Operating-hours source.** A versioned date-range policy must replace per-day gaps/defaults. The September 14 seasonal change requires an authoritative source and test fixture.
3. **CoverAll worker identity.** Decide whether a slot may remain organization/slot-only or whether named workers are required for each engagement. The architecture supports both without pretending the slot is an employee.
4. **Manager action semantics.** The UI must distinguish “assign ownership” from “ask another employee to perform one cleaning.” Only the former creates an ownership transition.
5. **Approved static source reconciliation.** Sunday derived location rows and the later PDF-imported group schedule conflict. The approved source artifact must be identified before migration publication.

No production implementation should start until these gates are resolved through evidence and independent plan audit.

---

## 20. Implementation sequence — not authorized yet

1. independently audit this architecture plan;
2. resolve policy gates with fixtures;
3. revise and re-audit the plan;
4. create schema and compiler tests in an isolated development database;
5. build the deterministic compiler and resolver;
6. perform shadow backfill/comparison;
7. audit source, data migration, security, and rollback;
8. cut over backend consumers;
9. rebuild employee UI/runtime against the canonical contracts;
10. run source-complete specialist audits;
11. build and independently verify one frozen APK;
12. conduct Moto G/Karen/fleet acceptance;
13. admit a release only after all evidence agrees.

---

## 21. Architecture verdict

### **CONDITIONAL GO FOR INDEPENDENT PLAN AUDIT**

### **NO-GO FOR PRODUCT OR DATABASE IMPLEMENTATION**

The architecture now separates static policy, date-specific exceptions, effective responsibility, actual cleaning, notification transport, and device identity. It also removes the foundational causes of the current contradictions rather than selecting one defective legacy function as the winner.

Implementation remains blocked until the companion plan audit, independent model audits, and unresolved policy fixtures are complete.