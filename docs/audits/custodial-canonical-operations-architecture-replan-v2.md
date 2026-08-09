# Memphis Zoo Custodial System — Canonical Operations Architecture Replan v2

**Status:** Authoritative replan supplement; implementation remains unauthorized  
**Prepared:** 2026-08-03  
**Foundation plan:** `docs/audits/custodial-canonical-operations-architecture-plan.md`  
**Pass-1 audit:** `docs/audits/custodial-canonical-operations-architecture-plan-audit.md`  
**Pass-1 verdict:** accepted direction; replan required

---

## 1. Purpose and authority

This document repairs every gap identified in the pass-1 adversarial audit.

The foundation plan plus this replan constitute **Canonical Operations Architecture v2**. Where this document is more specific, it supersedes the corresponding general rule in the foundation plan.

The architecture remains documentation only. No product, database, build, APK or phone change is authorized.

---

## 2. Deterministic event ordering and collision rules

Every compiler input that can affect ownership has:

- `event_id`;
- `event_family_id` for revisions of the same logical event;
- `effective_start` and optional `effective_end`;
- `recorded_at`;
- `published_at`;
- `authority_class`;
- `publication_sequence` within its family;
- `supersedes_event_id` when replacing a prior revision;
- stable idempotency key.

### 2.1 Processing stages

For each location and service date, the compiler processes in this exact order:

1. **Operational requirement boundary**  
   Determine whether the location is `required`, `not_required` or closed for the interval.

2. **Published static phase**  
   Apply the approved location-level baseline, including morning and normal 9:45 ownership.

3. **Eligibility invalidation**  
   Remove owners made ineligible by absence, employment state, restriction, contractor-slot state or shift window.

4. **Published capacity exceptions**  
   Add approved CoverAll/contractor capacity and solve newly uncovered work using the minimal-change solver.

5. **Scheduled temporary transitions**  
   Apply exclusive lunch transfers and their restoration rules.

6. **Shift-end inheritance**  
   Close departing ownership and solve exact locations for remaining eligible capacity.

7. **Ordinary manager transfer**  
   Apply an explicitly published manager reassignment for the exact interval.

8. **Emergency override**  
   Apply an authorized emergency override for the exact interval.

9. **Explicit correction assertion**  
   Record a retroactive correction in historical truth without silently changing what users previously saw.

### 2.2 Same-time collisions

- Different stages use the stage order above.
- Revisions in the same event family use the highest valid publication sequence that explicitly supersedes the prior revision.
- Two active events of the same stage, same location and overlapping interval are a conflict unless one explicitly supersedes the other.
- A conflict blocks publication and identifies both event IDs. There is no arbitrary “latest row wins.”
- Stable event ID is used only for deterministic output ordering after all semantic comparisons are equal; it never grants authority.

### 2.3 Boundary convention

All effective intervals use half-open time ranges:

```text
[start, end)
```

An interval ending at 12:00 and another beginning at 12:00 do not overlap.

---

## 3. Bitemporal correction and historical truth

The system maintains two time axes:

- **valid time:** when the responsibility was operationally true;
- **recorded time:** when the system stored or corrected the assertion.

Every published ownership assertion includes:

- `valid_start`;
- `valid_end`;
- `recorded_start`;
- `recorded_end` or open-ended current assertion;
- assertion revision;
- superseded assertion ID;
- correction reason;
- correcting actor and approval.

Historical queries support two explicit modes:

1. **As-known-at-the-time**  
   What the system showed or believed at a specified recorded timestamp.

2. **Corrected operational truth**  
   The latest approved assertion about who was responsible at the specified valid timestamp.

A correction appends a new assertion and closes the prior assertion’s recorded-time range. It never deletes or overwrites the earlier record.

Retroactive correction requires Full Access Manager authority, reason, exact affected interval and an explicit warning that history is being corrected. A second authorized approval is required when the correction changes responsibility used in performance or disciplinary analytics.

---

## 4. Active cleaning session versus ownership transition

A cleaning session binds at start to:

- protected device credential ID;
- canonical device ID;
- assignment epoch;
- actual employee identity;
- location;
- session start time;
- ownership version resolved at start;
- effective owner at start;
- whether cleaner and owner matched;
- manager/help reason when they did not match.

### 4.1 Ownership changes while a session is active

An ownership transition does not cancel valid work already in progress.

The session becomes one of:

- `owner_cleaning` — cleaner remains current owner;
- `cross_ownership_active` — ownership changed while the original cleaner continues;
- `manager_directed_help` — cleaner was never the owner but work was authorized;
- `ownership_conflict_review` — offline/stale evidence cannot be reconciled automatically.

The new owner remains responsible for the location after the transition, but the original cleaner may complete the active session. Completion records the actual cleaner and the ownership transition context.

### 4.2 Lunch begins during a session

- ownership transfers to the lunch coverer at the scheduled boundary;
- the existing cleaner may finish the session;
- the session is marked `cross_ownership_active`;
- due/overdue state may be `in_progress` but responsibility after the boundary belongs to the coverer;
- no second session may start at the same location.

### 4.3 Shift ends during a session

- effective ownership transfers or becomes `OPEN` at shift end;
- the active session remains valid for a bounded manager-configured grace period;
- the manager sees an active-session-after-shift exception;
- completion remains attributable to the actual cleaner;
- the session does not extend ownership or shift eligibility.

### 4.4 Manager transfer during a session

The override specifies whether it:

- changes future responsibility only while allowing current work to finish; or
- requires immediate session stop for safety/security.

Immediate stop is an emergency action and records actor, reason and session disposition.

### 4.5 Device reassignment during active work

Ordinary reassignment is blocked while the device has:

- an active session;
- a completion form pending;
- durable offline work;
- unreconciled protected queue items.

Emergency reassignment creates a protected recovery operation, quarantines ordinary use and requires manager reconciliation. It never silently transfers old work to the new employee.

---

## 5. Offline ownership snapshot and reconciliation

Before permitting an offline provisional start, the phone must possess a recent protected ownership snapshot containing:

- device ID and assignment epoch;
- employee ID;
- location ID;
- ownership version;
- effective interval;
- snapshot issued-at and expires-at;
- server signature or protected integrity proof;
- operating-policy and schedule versions.

### 5.1 Offline start rules

An offline start is allowed only when:

- protected enrollment is healthy;
- the snapshot covers the current time and location;
- no local active session exists;
- the tag resolves to the snapshot location;
- the snapshot is within the approved offline age.

If no valid snapshot exists, the employee sees:

> This phone needs a manager.

The system does not guess ownership.

### 5.2 Server reconciliation outcomes

On reconnect, the server returns one of:

- `accepted_owner_work`;
- `accepted_help_work`;
- `accepted_with_ownership_change`;
- `duplicate_replay`;
- `conflict_manager_review`;
- `rejected_invalid_identity`;
- `cancelled_terminal`.

Valid cleaning evidence may be retained even when the employee was no longer the owner. Acceptance of work never retroactively changes effective ownership.

### 5.3 Conflict handling

A conflict preserves:

- local session evidence;
- completion form;
- GPS summary;
- tag/location evidence;
- ownership snapshot;
- server conflict reason.

The phone returns to usable state only through deterministic reconciliation or manager-controlled recovery. It does not retry a terminal conflict forever.

---

## 6. Versioned location operational windows

General zoo hours are only the default.

Each location may have versioned rules for:

- normal public hours;
- split operating windows;
- staff-only coverage;
- exhibit-specific opening/closing;
- seasonal closure;
- maintenance closure;
- event closure or extended hours;
- emergency shutdown;
- temporary public inaccessibility.

### 6.1 Precedence

For a location/date:

1. emergency shutdown;
2. explicit dated location override;
3. approved event-specific window;
4. seasonal location rule;
5. normal location rule;
6. general zoo operating policy.

Conflicting equal-authority rules block publication.

### 6.2 Ownership result

- Inside a required window: one owner, contractor or explicit `OPEN`.
- Outside a required window: `not_required`.
- An active cleaning session may continue through a close boundary under the session rules, but it does not keep the location operationally required.

Splash Pad split hours and the September 14 seasonal closing change must be represented explicitly in this layer.

---

## 7. CoverAll assignment revision and secure-link lifecycle

Each contractor slot activation creates a `contractor_assignment_revision` containing:

- service date;
- slot identity;
- revision number;
- effective shift;
- exact locations and intervals;
- source exception IDs;
- published ownership version;
- manager actor;
- status;
- created/published/superseded timestamps.

A secure link is bound to exactly one assignment revision.

### 7.1 Revision behavior

When assignments change:

- create a new revision;
- atomically supersede the prior revision;
- revoke prior active links;
- issue a new link only after publication;
- ensure the old URL cannot display the new or old assignment after revocation;
- retain issuance/revocation audit history.

### 7.2 Contractor communication

The secure view is:

- read-only;
- no-store/no-cache;
- English/Spanish as approved;
- exact current locations and times;
- free of employee-only controls;
- independent of employee push registration.

If the contractor cannot be reached or the link cannot be delivered, affected ownership remains `OPEN` or is reassigned through an explicit manager action. Merely activating a slot does not prove that a contractor accepted work.

---

## 8. Four separate notification-related state machines

### 8.1 Presentation lifecycle

```text
created
→ transported
→ received_on_device
→ displayed
→ first_cycle_complete
→ second_cycle_complete
→ opened or dismissed
```

### 8.2 Acknowledgement lifecycle

```text
local_ack_pending
→ server_acknowledged

or
local_ack_pending
→ retrying
→ reconciliation_required
```

### 8.3 Operational work lifecycle

```text
normal
→ due_soon
→ overdue
→ in_progress
→ resolved

Possible branches:
reopened
manager_resolved
cancelled_not_required
```

### 8.4 Manager escalation lifecycle

```text
not_scheduled
→ scheduled
→ sent
→ acknowledged

or
scheduled
→ cancelled_resolved
scheduled
→ rerouted_owner_changed
```

### 8.5 Prohibited implications

- `displayed` does not mean employee acknowledged.
- `opened` does not mean work started.
- `dismissed` does not mean work resolved.
- `in_progress` does not mean location clean.
- employee dismissal does not cancel manager escalation.
- authoritative completion may resolve work but does not erase delivery history.

All four state machines share stable event and notification-intent IDs without collapsing their meanings.

---

## 9. GPS privacy, retention and permission behavior

### 9.1 Collection boundary

GPS collection begins only after an authoritative or valid offline-provisional cleaning session starts and stops after close/cancel/reconciliation termination.

No continuous off-session employee tracking is part of this release.

### 9.2 Minimum data

Collect only what is required for session accountability:

- observed time;
- latitude/longitude;
- accuracy;
- distance from calibrated target;
- evidence classification;
- session/device/location IDs;
- motion/staleness diagnostics required to reject bad evidence.

### 9.3 Role access

- ordinary employees see only actionable current-session messages;
- Full Access managers may see active exception evidence and approved history;
- Read Only does not receive raw employee coordinate history unless explicitly authorized in a later policy;
- AI may summarize evidence only through approved manager tools and may not expose raw coordinates to employee contexts.

### 9.4 Retention

- raw high-frequency points use a separately approved short retention setting;
- excursion start/end, return status, permission failure and session summary remain linked to durable session history;
- raw points under an active incident/inspection hold are preserved until the hold ends;
- no raw coordinate data is retained indefinitely by default;
- purge creates an audit summary and never removes the durable session/excursion conclusion.

The exact raw-point retention duration is a policy calibration item that must be approved before implementation admission; it is not silently inherited from event or Messenger retention.

### 9.5 Permission failure

If precise location or required services become unavailable:

- preserve the cleaning workflow;
- create a manager-visible GPS-health exception;
- show the employee only `This phone needs a manager.` when action is required;
- do not fabricate inside/outside evidence;
- do not resolve due/overdue state from missing GPS.

Whether an unverified session may continue is an operating-policy setting, defaulting to continue work while escalating device health rather than discarding valid cleaning evidence.

---

## 10. Override authorization and separation of duties

### 10.1 Roles

- **Full Access Manager:** may create ordinary transfers and emergency overrides.
- **Read Only:** may view Dashboard and Events only; no ownership writes.
- **Employee:** no schedule/ownership administrative controls.
- **System automation:** may publish only pre-authorized deterministic transition types.

### 10.2 Ordinary transfer

Requires:

- exact locations;
- start/end;
- new owner or `OPEN`;
- reason;
- preview and conflict validation;
- authenticated named manager;
- publication audit.

### 10.3 Emergency override

Requires:

- emergency reason;
- immediate effective time;
- bounded duration or explicit review deadline;
- named manager;
- affected sessions and notifications shown before confirmation;
- automatic restoration/re-solve at expiration.

### 10.4 Retroactive correction

Requires:

- exact valid-time interval;
- correction reason;
- evidence reference;
- named manager;
- second authorized approval when responsibility analytics or disciplinary records are affected;
- bitemporal append-only history.

---

## 11. Atomic consumer cutover and rollback

### 11.1 Shadow phase

Legacy consumers continue reading legacy authority while the canonical compiler writes shadow output. Shadow data is never presented as production truth until accepted.

### 11.2 Acceptance freeze

Before cutover:

- freeze one source commit;
- freeze one schema/migration set;
- freeze schedule and policy versions;
- complete cross-consumer comparison;
- resolve every unexplained difference;
- pass independent architecture and migration audits.

### 11.3 Atomic read cutover

All ownership consumers reference one versioned resolver contract. Cutover changes one protected system read-version pointer in a transaction after schema and resolver health checks pass.

No consumer receives an independent feature flag.

### 11.4 Write authority

After accepted cutover:

- new ownership writes go only to canonical baseline/exception/compiler tables;
- legacy ownership writers are disabled;
- there is no permanent dual-write compatibility layer.

### 11.5 Rollback

Rollback switches all consumers to one complete prior read model and disables canonical publication until the fault is understood. It does not selectively revert endpoints.

New canonical events created after cutover remain preserved for reconciliation. Rollback never deletes them.

---

## 12. First-class vacant positions

Static schedules may reference a stable `schedule_position_id` rather than a permanent employee.

A position contains:

- stable position ID and label;
- required capabilities/restrictions;
- normal shift/lunch pattern;
- current occupant and effective dates;
- vacant/filled state;
- previous occupants for audit.

At compilation:

- a filled eligible position resolves to its occupant;
- an unfilled position becomes an explicit uncovered input for the exception solver;
- a new employee occupies the position without inheriting another employee’s identity or history.

Michael and Daniel remain their own identities. Future hires receive new identities and may occupy the positions previously filled by them.

---

## 13. Grouped schedule-change notification contract

One ownership publication can change many locations. The server creates one revision-level employee notification intent per affected employee, not one spoken alert per location.

Payload includes:

- ownership revision;
- effective time;
- added locations;
- removed locations;
- temporary lunch locations;
- inherited locations;
- restoration/end time where applicable;
- route to Schedule.

Voice examples remain concise:

- “Tammy, your restroom assignments have changed.”
- “Tammy, lunch coverage has been assigned.”
- “Tammy, your lunch coverage has ended.”
- “Tammy, additional areas have been assigned to you.”

The overlay and Schedule page show exact locations. Location-specific due/overdue events remain separate operational intents.

Multiple changes in one publication are grouped by employee and ownership revision. Later revisions supersede undelivered prior revision notices.

---

## 14. Event notice versus workload and ownership exception

Events have three distinct effects:

1. **Event notice**  
   Information that may affect work but does not alter responsibility.

2. **Event workload exception**  
   Additional work/load points that influence an exception preview but do not transfer ownership by themselves.

3. **Event ownership transition**  
   An explicitly reviewed transfer of exact locations/intervals, published through the exception ledger.

Saving an event never silently regenerates a schedule. Only an approved workload/ownership exception enters the compiler.

Employee Events displays the notice and operational instruction. Employee Schedule changes only when an ownership transition is published.

---

## 15. Transactional device reassignment

One protected reassignment operation handles:

- preflight active/pending work;
- old assignment epoch;
- new employee assignment;
- native credential revocation/recovery;
- push registration revocation;
- Messenger device mapping;
- pending notification cancellation/reroute;
- offline queue ownership;
- new assignment epoch;
- completion proof.

### 15.1 Ordinary preconditions

Ordinary reassignment requires:

- no active session;
- no pending completion;
- zero unreconciled protected queue items;
- manager-authenticated target employee;
- target employee device eligibility.

### 15.2 Atomic outcome

The server transaction either:

- completes all authoritative assignment/epoch/revocation changes; or
- completes none.

Client enrollment then binds to the new epoch. Old credentials and push tokens cannot authorize new work.

### 15.3 Emergency path

Emergency reassignment quarantines the phone, preserves pending evidence and requires manager recovery. It does not attribute old work to the new employee.

---

## 16. GPS coordinate calibration publication

Each NFC location receives a versioned calibration record.

Workflow:

```text
Select location
→ collect repeated field samples at the actual tag/work area
→ reject poor-accuracy/outlier samples
→ calculate reviewed center/shape and uncertainty
→ choose permitted radius and hysteresis
→ preview against neighboring locations
→ manager approve
→ publish with effective date
```

Record includes:

- location and tag identity;
- sample set hash;
- calculated coordinate;
- accuracy distribution;
- radius;
- hysteresis;
- source method;
- confidence;
- collected by;
- reviewed/published by;
- effective dates;
- previous calibration;
- rollback reason.

Group coordinates remain route-planning data and cannot satisfy location-accountability acceptance.

---

## 17. Central employee recovery vocabulary

Every employee subsystem maps technical states to this restricted vocabulary:

| Condition | Employee text |
|---|---|
| Work safely stored offline | `Saved. It will send when connected.` |
| Protected identity, storage, permission or terminal queue problem | `This phone needs a manager.` |
| Unknown/invalid NFC tag | `Tag not recognized. Tell a manager.` |
| Temporary backend delay | `Wait a moment. The phone will try again.` |
| Another session already open on this phone | `Finish the cleaning already open.` |
| Confirmed departure from active location | `Return to [location].` |
| No current published responsibility | `No current areas. Contact the Custodial Manager.` |
| Submission accepted | `Saved.` |

Employee pages never display:

- HTTP status;
- schema/RPC names;
- device ID;
- assignment epoch;
- queue/retry count;
- GPS accuracy/distance;
- credential or enrollment terminology;
- raw backend errors.

Managers retain detailed diagnostics in protected views.

---

## 18. Replan invariants

The complete v2 architecture now requires:

1. one location-level effective responsibility result per required instant;
2. half-open non-overlapping intervals;
3. deterministic stage ordering and conflict rejection;
4. bitemporal correction history;
5. active sessions preserved without extending ownership;
6. offline work reconciled without rewriting ownership;
7. location-specific operational windows;
8. contractor assignment revisions and revocable links;
9. separate presentation, acknowledgement, work and escalation states;
10. active-session-only GPS with approved privacy/retention;
11. named-role override authorization;
12. atomic all-consumer cutover and complete rollback;
13. first-class vacant schedule positions;
14. revision-grouped schedule notifications;
15. explicit event notice/workload/ownership semantics;
16. transactional device reassignment;
17. versioned direct-location GPS calibration;
18. one employee recovery vocabulary.

---

## 19. Replan test additions

Add fixtures for:

- lunch start exactly at shift end;
- manager override exactly at 9:45;
- competing equal-authority events;
- retroactive ownership correction;
- active session across lunch;
- active session across shift end;
- offline start with superseded ownership snapshot;
- device reassignment with pending completion;
- CoverAll revision after link issuance;
- dismissed alert that remains overdue;
- event notice without schedule mutation;
- event ownership exception with explicit publication;
- location-specific split hours;
- GPS permission revoked mid-session;
- direct-coordinate calibration rollback;
- full atomic read-model cutover and rollback.

---

## 20. Replan status

All pass-1 architecture gaps now have explicit target rules.

This does not authorize implementation. Remaining work before independent architecture audit includes:

- reconciling the actual approved static schedule source;
- confirming location-specific operating-window policy;
- approving raw GPS retention duration;
- validating the event and contractor workflows with manager fixtures;
- producing schema-level and migration-level designs;
- running a second internal adversarial audit against the combined v2 documents.

No product, database, build, APK or phone change is authorized by this replan.