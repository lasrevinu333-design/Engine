# Memphis Zoo Custodial System — Canonical Ownership Architecture Plan Audit

**Status:** Internal adversarial architecture audit; read-only research phase  
**Prepared:** 2026-08-03  
**Plan audited:** `docs/audits/custodial-canonical-ownership-architecture-plan.md`, revision 2.0  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Backend source reviewed:** `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7`  
**Production verification:** read-only Supabase queries and deployed-function inspection  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Verdict

### **CONDITIONAL GO FOR EXTERNAL PLAN AUDIT**

### **NO-GO FOR IMPLEMENTATION**

The plan is coherent enough to submit to the three independent specialist auditors, but it is not yet authorized for schema, backend, frontend, build, database, APK, or phone implementation.

The architecture correctly removes the current root problem—multiple competing definitions of responsibility—and does not rely on compatibility patches as the final design.

Implementation remains blocked by five evidence gates:

1. approved static source reconciliation, especially Sunday;
2. late-day inheritance fixture approval;
3. versioned operating-hours policy;
4. CoverAll identity policy;
5. manager “ownership transfer” versus “one cleaning task” semantics.

---

## 2. Audit method

The audit attempted to falsify the plan against:

- the original operational intent and Final Report v17 framing;
- the employee application requirements;
- the current static schedule and shift templates;
- deployed schedule and ownership functions;
- production group/location membership;
- production Sunday location-template data;
- current absence, lunch, late-coverage, CoverAll, and 9:45 mechanisms;
- direct and legacy notification pipelines;
- cleaning-session and GPS boundaries;
- employee/device lifecycle;
- historical accountability and anti-misuse requirements;
- migration, rollback, and physical acceptance.

No passing conclusion was accepted merely because a similar current component exists. Each requirement was evaluated against the target architecture itself.

---

## 3. Production evidence that shaped the replan

### 3.1 Sunday templates are derived and conflicting

Read-only production inspection established:

- 135 active `location_coverage_templates` rows;
- all are Sunday-only;
- all were created and last updated together on April 28, 2026;
- all reference a source location group;
- notes repeatedly state “Seeded from group schedule”;
- current group templates were imported later from the uploaded static PDF schedule;
- only 43 of 135 location rows exactly match the current group template;
- 46 closest overlapping comparisons differ by owner;
- 32 rows have no overlapping current group interval.

Audit conclusion:

> Sunday location templates cannot be treated as an independent approved authority merely because they are more granular.

The plan correctly keeps them as migration evidence and requires source reconciliation before retirement.

### 3.2 Mixed groups prove group-level ownership is insufficient

Production has seven active groups containing both restrooms and a non-restroom location:

- China
- East Admin
- Event Center
- Expo
- Teton
- West Admin
- Zambezi

Audit conclusion:

> A group-level 9:45 transfer can move an exhibit/building together with its restrooms unless the compiler expands to locations first.

The plan correctly makes individual locations authoritative and snapshots group membership per static version.

### 3.3 CoverAll currently causes full-day mutation

Current backend behavior can:

- insert CoverAll pseudo-employees into the daily roster;
- force `sch_generate_daily_schedule(..., p_force=true)`;
- restore static owners;
- rebalance CoverAll assignments;
- rebalance restrooms;
- reapply lunch coverage;
- mark 9:45 automation complete.

The current load balancer can move whole group rows and writes `owner_type='EMPLOYEE'` for a CoverAll slot.

Audit conclusion:

> This is not an exception overlay. It is a full-day reconstruction with a contractor disguised as an employee.

The plan correctly creates contractor identities and publishes only reviewed location-level exception intervals.

### 3.4 Any scan event can clear legacy overdue escalation

The deployed trigger calls `sch_clear_scan_alerts_for_location` after any inserted `scan_events` row with a location code.

That can clear an active due/overdue alert after:

- scan receipt;
- session start;
- another non-completion event.

It does not require acknowledged cleaning completion.

Audit conclusion:

> A tap can suppress escalation before the work is done.

The plan correctly distinguishes `work_started` from operational resolution and allows only authoritative completion/status change to resolve the episode.

### 3.5 Native location pushes are not revalidated against work state

The current worker revalidates device credential and assignment epoch before FCM. It does not revalidate:

- whether the location remains due/overdue;
- whether the employee remains the effective owner;
- whether a completion superseded the pending event.

Audit conclusion:

> Strong recipient authentication does not make stale operational content correct.

The plan correctly requires both ownership and status revalidation immediately before delivery.

### 3.6 Existing daily rows encode mutations rather than events

Observed daily source types include:

- `coverage_template`
- `coverage_template:lunch_split_before`
- `coverage_template:lunch_split_after`
- `lunch_coverage`
- `late_coverage`
- `coverage_template_unavailable:auto_reassigned`
- `restroom_rebalance_0945`
- `coverage_template:static_owner_restored`
- `restored_scan_lunch_coverage`

Audit conclusion:

> The current system writes the result of successive mutations into schedule rows without one immutable transition ledger.

The plan correctly separates baseline, events, compilation runs, and effective intervals.

---

## 4. Plan defects found and corrected before revision 2.0

### 4.1 Static phase and exception precedence were initially blurred

A naive precedence list treated 9:45 as though it were always a dynamic exception.

Correction incorporated:

- normal morning/post-9:45 phases belong to the published static version;
- dynamic 9:45 solving occurs only for a real exception;
- phase selection happens before temporary event precedence.

### 4.2 Override expiration could have restored a stale owner

A simplistic “return to previous owner” model fails when the prior owner has since gone to lunch, left for the day, become absent, or been inactivated.

Correction incorporated:

- when an override ends, the compiler resolves the currently valid lower layer at that timestamp;
- `previous_owner` remains audit evidence, not unconditional restoration authority.

### 4.3 Group membership history was initially under-specified

If a group is edited later, historical location expansion could change retroactively.

Correction incorporated:

- every static version snapshots the group-to-location membership used at publication.

### 4.4 OPEN and “not required” were initially too easy to conflate

An uncovered hour before close is operationally different from the period after close.

Correction incorporated:

- `open` means coverage is required and no eligible owner exists;
- `not_required` means the operational window has ended.

### 4.5 CoverAll initially risked retaining pseudo-employee semantics

Reusing the existing CoverAll employee IDs would preserve the wrong long-term model.

Correction incorporated:

- contractor organization, slot/engagement, optional named worker, and contractor assignment are separate from employees;
- current pseudo-employees are migration aliases only.

### 4.6 Notification resolution initially lacked completion semantics

A generic “scan clears alert” rule would repeat the current defect.

Correction incorporated:

- start may suppress repeated employee reminders temporarily;
- only server-authoritative completion/status resolution closes the operational episode;
- manager escalation remains independent from employee display/dismissal.

### 4.7 Employee lifecycle was initially too dependent on `active`

One Boolean cannot safely represent historical identity, current employment, scheduling, phone access, and Messenger access.

Correction incorporated:

- distinct lifecycle and eligibility states are required;
- departure never rewrites history or renames an old identity.

### 4.8 Retention initially lacked a clear boundary

Without an explicit statement, ownership history could accidentally inherit the 14-day event/message policy.

Correction incorporated:

- ownership and schedule audit history are durable operational records;
- no unsupported legal retention duration is invented.

---

## 5. Requirement traceability audit

| Requirement | Plan mechanism | Audit result |
|---|---|---|
| Static schedules remain normal authority | Immutable published static versions and create-if-absent daily baseline | PASS |
| Manager can publish a replacement static schedule | Import/preview/audit/approve/effective-date lifecycle | PASS |
| Reads never regenerate schedules | Read-only resolver contract | PASS |
| Exceptions modify only necessary work | Location-level append-only events and minimal-change compiler | PASS, fixture weights pending |
| 9:45 changes restrooms without moving exhibits | Expand mixed groups to locations before phase resolution | PASS |
| Lunch temporarily transfers and then ends | Exclusive lunch intervals and lower-layer resolution at end | PASS |
| Shift-end ownership is explicit | Published inheritance events/intervals | PASS |
| One or two remaining employees receive actual locations | Location intervals; `All Locations` prohibited | PASS |
| No remaining employee before close | Explicit OPEN and manager exception | PASS |
| Seasonal closing is authoritative | Versioned operating-hours input and interval clipping | CONDITIONAL — source policy pending |
| Absence is date-specific | Day-specific eligibility/capacity event | PASS |
| CoverAll is added capacity, not an employee | Contractor engagement/assignment model | PASS, worker-identity policy pending |
| Employees choose work order | Ownership does not prescribe route order | PASS |
| Actual cleaner is separate from owner | Active/last cleaner fields remain independent | PASS |
| Due/overdue reaches current owner only | Resolve and revalidate ownership revision before delivery | PASS |
| A mere scan cannot falsely resolve overdue | Completion-driven operational resolution | PASS |
| One notification, no Messenger duplicate | Canonical intent and native presentation owner | PASS |
| GPS only during active cleaning session | Native session-bound tracking | PASS at architecture level |
| Historical responsibility remains queryable | Immutable events and effective revisions | PASS |
| Analytics does not infer unfair fault | Performer/owner separation and historical context | PASS |
| Michael and Daniel remain untouched now | Explicit no-mutation constraint | PASS |
| New hires receive new identities | Employee lifecycle model | PASS |
| Future whole-fleet map remains possible | Device position independent from ownership | PASS |
| No permanent patch layer | Temporary shadow comparison followed by atomic cutover and retirement | PASS |

---

## 6. Adversarial scenario audit

### 6.1 Normal Monday, no exceptions

Expected:

- applicable static version creates one immutable baseline;
- morning assignments apply until phase transition;
- published post-9:45 owners take effect;
- no optimizer runs merely because the day is opened.

Result: **PASS**.

### 6.2 Employee absence before day generation

Expected:

- baseline remains historical normal policy;
- only invalid/uncovered locations receive date-specific replacement events;
- unaffected owners remain unchanged.

Result: **PASS**, subject to solver fixture approval.

### 6.3 Absence reported after the day was published

Expected:

- append a new exception;
- compile a new ownership revision;
- preserve the prior revision;
- notify only employees whose responsibility changes.

Result: **PASS**.

### 6.4 Lunch begins while employee owns mixed-group locations

Expected:

- exact locations selected for lunch coverage transfer exclusively;
- no duplicate base-owner claim;
- mixed-group exhibit/restroom behavior follows the published coverage selection, not the group name.

Result: **PASS**.

### 6.5 Employee's shift ends during lunch

Expected:

- departing employee cannot be restored at lunch end;
- lower-layer resolution selects inheritance/contractor/OPEN at that later timestamp.

Result: **PASS** after revision 2 correction.

### 6.6 Employee leaves before 9:45

Expected:

- shift-end/absence adjustment applies immediately;
- 9:45 later resolves from the valid adjusted phase, not the departed employee.

Result: **PASS**.

### 6.7 Two employees remain

Expected:

- each inherited location is explicitly assigned;
- solver preserves existing areas, minimizes moves, then applies proximity/workload;
- both employee and manager consumers read the same revision.

Result: **CONDITIONAL** — exact scoring fixture must be approved.

### 6.8 One employee remains

Expected:

- actual individual locations listed;
- no `All Locations` label;
- OPEN used for locations the remaining employee cannot validly cover.

Result: **PASS**.

### 6.9 No employees remain before public closing

Expected:

- required locations become OPEN;
- manager alerted;
- no fabricated employee owner;
- after public close, intervals become not-required.

Result: **PASS**, operating-hours source pending.

### 6.10 CoverAll added to a normal day

Expected:

- no forced day regeneration;
- manager previews exact moved locations;
- contractor assignment is location-level;
- existing employee assignments move only when approved;
- secure bilingual schedule link retained.

Result: **PASS** at architecture level.

### 6.11 Manager asks Tammy to clean one restroom without transferring ownership

Expected:

- cleaning session records Tammy as performer;
- owner remains unchanged unless manager explicitly chooses “transfer ownership.”

Result: **CONDITIONAL** — UI/policy distinction must be approved.

### 6.12 Due-soon becomes overdue during an ownership transfer

Expected:

- one operational episode;
- old recipient intent superseded;
- new owner re-resolved;
- manager escalation remains attached to the episode;
- no duplicate Messenger alert.

Result: **PASS**.

### 6.13 Employee starts cleaning and leaves the area

Expected:

- GPS evidence belongs to active session and performer;
- departure does not rewrite ownership;
- scan start does not resolve overdue;
- completion resolves only when server acknowledged.

Result: **PASS**.

### 6.14 Static schedule changes next month

Expected:

- new version with effective date;
- old historical dates unchanged;
- future baselines use new version;
- pending exceptions revalidated against the applicable version.

Result: **PASS**.

---

## 7. Security and authorization audit

### 7.1 Ownership authority

Only authenticated manager publication, approved automation, or controlled system events may publish ownership changes.

Employee pages remain read-only for ownership.

Result: **PASS in plan**.

### 7.2 Device assignment

Device assignment epoch remains a notification-transport authorization boundary. It does not become ownership truth.

Result: **PASS**.

### 7.3 CoverAll links

Secure expiring links remain no-store and scoped to one date/slot/engagement. They do not grant manager or employee API authority.

Result: **PASS**.

### 7.4 History integrity

Published versions/events/revisions are append-only or superseded, not silently edited.

Result: **PASS**.

### 7.5 Fail-closed publication

Overlap, missing required coverage, invalid owner subject, ambiguous static version, or unresolved location membership blocks publication.

Result: **PASS**.

---

## 8. Migration audit

### Strengths

- shadow compilation avoids cutting consumers over blindly;
- current conflicting rows are evidence, not automatically accepted truth;
- every mismatch is classified;
- historical rows are retained;
- old functions are not dropped before acceptance;
- rollback does not delete audit evidence.

### Remaining migration risks

1. The approved source schedule artifact must be identified for Sunday.
2. Existing mutation-derived rows may not map cleanly to one event type.
3. Current historical data may contain overlapping lunch/base rows that cannot be labeled “effective ownership” without reconstruction uncertainty.
4. The migration must distinguish “known effective,” “reconstructed,” and “unknown/conflicted” historical confidence.
5. Current CoverAll pseudo-employee history requires an alias mapping to contractor engagements without rewriting old sessions.

Required adjustment at implementation time:

- add historical confidence/source classification to backfilled ownership history;
- do not fabricate certainty for dates where the evidence conflicts.

Result: **CONDITIONAL PASS**.

---

## 9. Retention audit

The plan correctly avoids applying the 14-day event/message policy to ownership history.

Required retention classes:

- static versions and publish audit: durable;
- daily baseline and ownership transitions: durable;
- effective historical ownership: durable;
- cleaning sessions, inspections, and tickets: durable;
- notification presentation content: approved shorter retention may apply;
- push token/device credential material: security lifecycle policy;
- GPS observations: requires a separate minimized operational retention policy before implementation.

Open issue:

- GPS retention duration is not established by current source material and must not be guessed.

Result: **PASS with one explicit policy gate**.

---

## 10. Performance and reliability audit

The architecture can scale adequately for the current zoo scope because:

- only dozens of operational locations are compiled per service date;
- intervals are published by revision rather than recomputed by every read;
- current owner resolution can use indexed location/range queries;
- employee Schedule can read one current revision and employee filter;
- notifications reference stable ownership revisions.

Required implementation proof:

- one-day compilation under a defined threshold;
- resolver p95 latency target;
- transactional publication;
- concurrent manager publication conflict test;
- deterministic retry after interrupted compilation;
- bounded notification and ownership-event workers.

No performance assumption authorizes denormalizing back into competing consumer-specific ownership.

Result: **PASS at architecture level**.

---

## 11. Low-technology employee audit

The architecture keeps technical complexity away from employee phones.

The employee should see only:

- current locations;
- clearly temporary lunch/inherited sections when useful;
- plain ownership-change alerts;
- NFC cleaning workflow;
- ordinary connection/recovery language.

The employee does not need to understand:

- static version IDs;
- ownership revisions;
- exception precedence;
- contractor scoring;
- compiler conflicts;
- device epochs;
- queue state;
- schedule hashes.

Result: **PASS**.

---

## 12. Plan findings by severity

### BLOCKER — Approved Sunday source remains unresolved

The architecture cannot publish a canonical static version until the conflicting Sunday sources are reconciled against the approved schedule artifact.

### BLOCKER — Late inheritance solver requires real fixture approval

The ranking order is correct, but exact weights/tie-breaks must be tested against zoo geography and expected two-person/one-person coverage.

### HIGH — Operating-hours policy is not yet versioned

The system needs effective date ranges, including the September 14 transition, before OPEN/not-required intervals can be trusted.

### HIGH — CoverAll named-worker policy remains undecided

The schema can support organization/slot-only and named-worker modes, but the operational requirement must be explicit.

### HIGH — Manager action semantics require separate commands

“One cleaning task” and “ownership transfer” must not share one ambiguous control.

### MEDIUM — GPS retention remains unspecified

Implementing session tracking requires an approved minimized retention rule.

### MEDIUM — Historical backfill confidence is required

Conflicting prior rows cannot be presented as certain effective ownership.

---

## 13. Required independent auditor assignments

The three external auditor tabs should remain paused until the plan freeze commit is supplied.

### GPT-5.3 Spark

Primary assignment:

- schema and invariant mechanics;
- deterministic compiler logic;
- interval overlap and restoration edge cases;
- idempotency/fingerprint rules;
- migration failure modes;
- test sufficiency.

### GPT-5.5 Pro

Primary assignment:

- true static-schedule operating model;
- absence/CoverAll practicality;
- late-day inheritance;
- Karen comprehension;
- manager workflow;
- whether the plan matches how custodial work is actually performed.

### GPT-5.6 Pro

Primary assignment:

- integrated architecture;
- security and authorization;
- historical integrity;
- cross-consumer consistency;
- notification/GPS/session boundaries;
- migration, rollback, and release-admission design.

Each auditor must work independently before seeing the other reports.

---

## 14. Exit conditions for implementation authorization

Implementation remains prohibited until:

1. the plan is frozen at an exact commit;
2. all three independent plan audits are complete;
3. every finding is dispositioned;
4. Sunday source truth is resolved;
5. inheritance fixtures are approved;
6. operating-hours versioning is specified;
7. CoverAll identity policy is specified;
8. manager transfer/task semantics are specified;
9. GPS retention is specified;
10. the revised architecture passes another self-audit and final independent audit.

Only then may work begin in an isolated development database and source branch.

---

## 15. Final audit conclusion

The revised architecture is aligned with the program's true purpose and avoids preserving defects merely because they exist in the original or current build.

It preserves the strong original concepts:

- static premade schedules;
- employee judgment over route order;
- 9:45 restroom ownership;
- lunch and shift-end coverage;
- proximity/workload-aware exceptions;
- NFC session evidence;
- manager visibility;
- durable operational history.

It rejects the weak foundations:

- competing Sunday authority;
- mutable read-time inheritance;
- additive lunch ownership;
- group-level mixed-location transfers;
- CoverAll pseudo-employees;
- forced full-day regeneration;
- any-scan alert cancellation;
- all-day notification recipients;
- duplicate Messenger alert transport;
- consumer-specific precedence.

The plan is ready for independent architecture review. It is not ready to build, motherfucker. That distinction is the entire point of doing this correctly.