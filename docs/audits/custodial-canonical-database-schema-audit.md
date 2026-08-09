# Memphis Zoo Custodial System — Canonical Database Schema Audit

**Status:** Internal adversarial schema audit, pass 1  
**Prepared:** 2026-08-03  
**Schema design audited:** `docs/audits/custodial-canonical-database-schema-design.md`  
**Implementation authorization:** none

---

## 1. Verdict

### **NO-GO FOR SCHEMA FREEZE OR MIGRATION DDL**

### **FOUNDATION IS SOUND; SCHEMA REPLAN REQUIRED**

The schema design correctly moves authority into immutable versions, explicit events, location-level intervals and a bitemporal resolver. It also correctly uses database constraints rather than trusting every consumer.

The first pass is not yet migration-safe. Several important truths are represented only in prose, and several tables would permit ambiguous or incomplete states unless the design is tightened.

---

## 2. Findings

## BLOCKER 1 — Workload truth is still group-level and cannot be copied safely to locations

The architecture makes individual locations the ownership unit, but the schema places `load_points` directly on assignment and interval rows without defining an authoritative location/purpose workload source.

Current production workload settings are group-level. Mixed groups contain one exhibit/building plus multiple restrooms. Copying one group load to every member would multiply workload. Dividing evenly would falsely treat different locations as equal.

**Required replan:** add versioned location workload profiles by location and purpose, including expected minutes, load points, service frequency and source confidence. Group workload may remain an authoring fallback but must compile through an explicit allocation rule and validation report.

## BLOCKER 2 — Route/proximity truth is not versioned with the schedule inputs

The solver depends on geography, but the schema does not version:

- zones;
- location-to-zone assignment;
- adjacency;
- walking time;
- missing-route fallback.

A route edit could change the result of replaying an old exception even if schedule and policy versions remain unchanged.

**Required replan:** add a route-model version referenced by every baseline and compile run, or snapshot the exact route inputs into the compiler fingerprint.

## BLOCKER 3 — Published version date ranges are not enforced

The design says only one operating-policy and one static-schedule version may cover a date, but it provides no exact exclusion constraint or publication table for those valid ranges.

A partial unique index on status cannot prevent two published versions with overlapping effective date ranges.

**Required replan:** add generated date ranges and `btree_gist` exclusion constraints for published/current version assertions, with bitemporal correction if historical publication state is corrected.

## BLOCKER 4 — Overnight and midnight boundaries are not representable consistently

The current design requires `shift_end > shift_start` and same-day time ranges. Existing Events already support overnight spans, and emergency/event work may cross midnight.

A schedule or operating window ending at midnight cannot be represented reliably by `time` columns alone.

**Required replan:** add explicit day offsets or compile from local date + time + offset to `timestamptz`. Define service-date ownership across midnight.

## BLOCKER 5 — Bitemporal corrections conflict with “published rows never update”

The design says published assertions are immutable but also says a correction function closes `recorded_end` on the prior assertion. That is a controlled update and must be stated as the sole permitted mutation.

Without an exact correction transaction, a correction can briefly create overlapping recorded truth or leave the old assertion open.

**Required replan:** define one security-definer correction function that locks the assertion family, closes only `recorded_end`, inserts the successor and validates the exclusion constraint atomically. All other columns remain immutable.

## BLOCKER 6 — Operational-event state would lose transition history

`custodial_operational_events` stores a mutable current `state`. A revision number does not preserve the actual sequence from due soon to overdue to in progress to resolved.

This would weaken manager escalation, audit and dispute reconstruction.

**Required replan:** add append-only operational-event state transitions and use a projection/current-state table or view.

## BLOCKER 7 — Atomic all-consumer cutover has no database object

The architecture requires one protected read-version pointer, but the schema does not define it.

Without one object and one resolver indirection, consumers may still be switched independently.

**Required replan:** add a singleton protected authority-version table and resolver facade whose version can change only through an audited transaction.

---

## HIGH 1 — Position occupancy constraints are incomplete

The schema prevents two occupants in one position but does not prevent one employee occupying multiple ordinary positions simultaneously.

**Required replan:** add a second bitemporal exclusion on employee occupancy, with an explicit reviewed exception mechanism for legitimate multi-position assignments.

## HIGH 2 — Planned open assignment semantics are ambiguous

`position_id` is nullable for planned open work. That can represent either:

- a deliberately unowned location; or
- a vacant position awaiting an occupant.

Those are operationally different.

**Required replan:** require one of `position_id`, `contractor_slot_id` or explicit planned-open reason. Vacant position work references its stable position even when no occupant exists.

## HIGH 3 — Device reassignment cannot represent unassignment

`to_employee_id` is mandatory. Phones must also be releasable, quarantined or held unassigned.

**Required replan:** add operation type and nullable target with constraints for assign, reassign, unassign and quarantine.

## HIGH 4 — Manager identities are unresolved

Several tables use free-text actors or nullable manager UUIDs without one authoritative manager identity foreign key.

**Required replan:** select the existing named manager identity table or create a canonical actor reference model before schema freeze.

## HIGH 5 — Notification projection can disagree with state-event history

`custodial_notification_intents.state` duplicates append-only `custodial_notification_state_events`. Direct updates can make them disagree.

**Required replan:** make state changes occur only through one transition function, or derive current state from the event log with a protected projection maintained transactionally.

## HIGH 6 — Offline snapshot schema is not exact enough

The design describes snapshots but omits exact tables, location entries, revocation and expiry constraints.

**Required replan:** define snapshot header and interval rows, one current snapshot per device/epoch, content hash, expiry and server reconciliation references.

## HIGH 7 — Location calibration current-version constraints are incomplete

The schema says current calibrations cannot overlap but does not supply the exclusion constraint. It also permits published calibration with no approval timestamp.

**Required replan:** add exact valid-range exclusion and publication checks.

## HIGH 8 — Event/notification foreign keys can create retention conflicts

Notification and operational rows reference event, ownership and session records with default delete behavior not always stated. Event notices currently have a 14-day purge.

**Required replan:** durable operational facts must not be deleted when a presentation/event notice is purged. Use restricted references to durable event identity or detached immutable source keys, not cascading from ephemeral notice tables.

---

## MEDIUM 1 — Static assignment target checks require exact enforcement

The design relies on publication validation to ensure group versus explicit target consistency. Direct malformed rows would still exist in drafts.

**Required replan:** add constraint triggers that enforce target/member-scope/child-row combinations before a version can reach validated state.

## MEDIUM 2 — Purpose values need versioned policy or stable reference table

Free-text checks copied into multiple tables will drift.

**Required replan:** define stable purpose codes in one reference table or immutable policy contract and reference them consistently.

## MEDIUM 3 — Timezone and DST conversion must be deterministic

Local date/time compilation into `timestamptz` must define behavior for nonexistent or repeated local times, even if ordinary zoo hours rarely encounter them.

**Required replan:** use one reviewed conversion function and record timezone database/version assumptions in the compiler fingerprint.

## MEDIUM 4 — Source and output hash canonicalization is not defined

A JSON object can serialize differently while containing the same values.

**Required replan:** define canonical ordered serialization, numeric normalization and hash algorithm for all fingerprints and preview/publish equality.

## MEDIUM 5 — Raw GPS data needs partition/purge design

High-frequency observations can become the largest table.

**Required replan:** define monthly/date partitioning or another bounded storage design, purge locks, incident holds and summary-preservation transaction.

## MEDIUM 6 — Existing session status constraint needs migration treatment

Cross-ownership and reconciliation are companion states, not current `sessions.status` values. The schema must state whether to add columns, companion tables or new statuses without breaking existing completion functions.

**Required replan:** define exact migration-compatible session extension.

## MEDIUM 7 — Contractor foreign-key order and migration aliases need resolution

Baseline/event tables reference contractor slots before that table appears in the design. More importantly, existing CoverAll employee UUIDs need a deterministic migration mapping.

**Required replan:** define creation order and alias table without treating synthetic contractor employees as future employee identities.

---

## 3. Accepted schema decisions

These remain approved:

- location-level baseline and effective intervals;
- `btree_gist` exclusion constraints;
- half-open intervals;
- bitemporal ownership assertions;
- stable schedule positions;
- immutable version headers;
- explicit event families/revisions;
- deterministic compile run and publication identities;
- contractor ownership separate from employee push identity;
- operational work separate from notification presentation;
- session binding to start-time ownership and device epoch;
- versioned direct GPS calibration;
- protected transactional publication functions;
- forced RLS and revoked direct access;
- shadow-only coexistence without permanent dual writes.

---

## 4. Replan requirements

The schema v2 must add or correct:

1. versioned location workload profiles;
2. versioned route/proximity model;
3. exact effective-range exclusion for policy and schedule versions;
4. overnight/day-offset semantics;
5. atomic bitemporal correction function contract;
6. append-only operational state events;
7. singleton authority/read-version pointer;
8. employee multi-position exclusion;
9. explicit vacant versus deliberate-open targets;
10. assign/reassign/unassign/quarantine device operations;
11. canonical actor/manager identity;
12. transactional notification projection;
13. exact offline snapshot tables;
14. exact calibration exclusion/publication checks;
15. retention-safe durable source references;
16. target-scope constraint triggers;
17. one purpose-code authority;
18. deterministic timezone and hash rules;
19. GPS storage/purge design;
20. exact existing-session extension;
21. CoverAll alias and object-creation order.

---

## 5. Disposition

The schema design is not approved for migration authoring yet.

A v2 schema replan may proceed. Product implementation, production migration, build work and phone changes remain prohibited.