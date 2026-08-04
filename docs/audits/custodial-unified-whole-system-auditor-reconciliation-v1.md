# Memphis Zoo Custodial Program — Independent Auditor Reconciliation v1

**Status:** Source-backed reconciliation; no implementation authorization  
**Prepared:** 2026-08-04  
**Research branch:** `agent/custodial-unified-whole-system-v4-20260803`

---

## 1. Purpose

This document reconciles the available independent audits against primary evidence. It does not average model verdicts, count votes or accept a finding because another model stated it confidently.

Each material finding is classified as:

- independently corroborated;
- correct direction but incomplete;
- correct symptom, wrong-sized repair;
- unsupported by the available evidence;
- contradicted by primary evidence;
- superseded by a later explicit decision;
- historical evidence only;
- research or policy gate still open.

The controlling question is not whether an auditor sounds persuasive. It is whether the finding survives the PDF, source, backend, production-schema, operational and physical-evidence hierarchy.

---

## 2. Audits reviewed

### 2.1 GPT-5.3 Spark

Scope:

- mechanical architecture;
- compiler and schema inputs;
- route authority;
- NFC/session linkage;
- deterministic and migration evidence.

Verdict:

- `CONDITIONAL GO` for Canonical Ownership Foundation Architecture v3.1 as a basis for continued adversarial validation;
- explicit statement that the foundation was not safe to implement until critical gaps closed.

Principal findings:

- missing workload and geography truth;
- backend writer/reader authority not completely proven;
- NFC → session → ownership chain incomplete;
- inspection-readiness derivation undefined;
- missing overlap/completeness constraints and compiler fixtures;
- migration and rollback evidence incomplete.

### 2.2 GPT-5.5 Pro

Scope:

- actual custodial operation;
- Karen usability;
- manager workflows;
- whole-program capability completeness;
- PDF image and source comparison.

Verdict:

- `CONDITIONAL GO` for the ownership foundation as a planning subsystem;
- `NO-GO` for whole-program architecture;
- `NO-GO` for database/product implementation and release.

Principal findings:

- v3.1 does not fully define employee, manager, Messenger, Events, Feedback, Read Only, phone lifecycle or physical acceptance;
- employee Home and wording are not guaranteed;
- notification cadence and route language conflict with current decisions;
- forms and Messenger remain too complex for Karen;
- manager schedule changes require exact diff/publication;
- physical Moto G acceptance remains a blocker.

### 2.3 GPT-5.5 Instant

Scope:

- complete evidence reconstruction;
- 26-page PDF and screenshot ledger;
- hidden capabilities;
- whole-program authority and architecture completeness;
- security, retention, migration and release breadth.

Verdict:

- ownership v3.1: conditional retention as a subsystem specification;
- whole-program architecture: `NO-GO`;
- schema, implementation, migration, APK, phone and release: `NO-GO`.

Principal blockers:

1. no unified whole-program architecture;
2. no canonical inspection-readiness model;
3. schema unsafe to freeze;
4. employee runtime has multiple conceptual owners;
5. employee and position lifecycles are conflated;
6. workload and route truth are not authoritative;
7. event information and operational authority are not fully separated;
8. notification, acknowledgement, work status and escalation are not fully unified;
9. retention and historical truth are incompletely classified;
10. no whole-program migration and atomic-cutover plan.

### 2.4 Earlier GPT-5.6 Pro employee-app audit

Scope:

- employee Android candidate at commit `5ea4508de9b6c1fde73c78b514b7753bbda24062`;
- package/runtime, NFC, notifications, schedule display, Messenger, tests and release admission.

Verdict:

- `NO-GO` for that specific employee-app candidate.

Use in this reconciliation:

- historical implementation evidence only;
- not a current independent whole-system architecture verdict;
- its runtime, NFC, notification, packaging and physical-test failures remain attack cases that the new architecture must prevent.

---

## 3. Reconciled verdict matrix

| Scope | Reconciled verdict |
|---|---|
| Ownership principles in v3.1 | **Retain** |
| v3.1 as ownership subsystem specification | **Conditional GO for replan input and independent review** |
| v3.1 as whole-program architecture | **NO-GO** |
| Existing schema design | **NO-GO; full replan required** |
| Isolated component implementation | **NO-GO pending unified architecture and closed gates** |
| Whole-program migration | **NO-GO** |
| APK or phone work | **NO-GO** |
| Release | **NO-GO** |

The different headline wording from Spark and the two 5.5 audits is not a substantive contradiction. Spark judged whether the ownership foundation was structurally useful. The 5.5 audits judged whether that foundation described the complete program. Both answers can be true:

> The ownership foundation is worth retaining. The complete architecture does not yet exist.

---

## 4. Findings independently corroborated by primary evidence

### 4.1 One canonical owner is required

Corroborated by:

- v17 operating purpose;
- employee and manager schedule requirements;
- current frontend consumers;
- backend schedule and alert routes;
- production definitions showing multiple current-owner paths;
- all three current whole-program audits.

Production currently contains at least:

- group schedule resolution;
- Sunday location-template resolution;
- daily assignments;
- employee-page phase/inheritance logic;
- alert-specific ownership resolution.

Disposition:

- v3.1 location-level, non-overlapping, published effective ownership remains mandatory.

### 4.2 Inspection readiness is a separate missing authority

Corroborated by:

- v17 pages 1, 2, 7, 13, 17 and 18;
- current dashboard derivation;
- current completion, ticket and inspection records;
- Spark and both 5.5 audits.

Current dashboard status primarily derives `okay`, `due_soon`, `overdue`, `not_cleaned` and `in_progress` from session/completion age. It does not canonically resolve accepted completion, issue severity, out-of-order impact, follow-up, inspection state and readiness as separate facts.

Disposition:

- create a first-class operational status and readiness architecture before schema freeze.

### 4.3 Workload and geography are not authoritative enough for compilation

Corroborated by:

- group-level workload data;
- seven mixed restroom/non-restroom groups;
- sparse location-level calibration;
- mutable, unversioned route/zone data;
- Spark and 5.5 Instant findings.

Disposition:

- research and version per-location/per-purpose workload, service frequency, restrictions, zones, adjacency and walking time before compiler design is admitted.

### 4.4 Employee runtime ownership is fragmented

Corroborated by:

- Capacitor shell;
- role shell;
- protected setup;
- legacy employee pages;
- scan runtime;
- injected native bridge;
- browser reminders;
- native notification coordinator;
- old GPT-5.6 employee-app audit;
- 5.5 Instant blocker.

Disposition:

- define one permanent employee lifecycle owner, navigation owner, NFC owner, notification owner and durable local state authority.

### 4.5 Employee identity, employment, position and device eligibility are conflated

Corroborated by:

- production `employees` schema containing one `active` Boolean;
- scheduler joins that use `employees.active` as eligibility;
- phone and Messenger behavior tied to the same record;
- active CoverAll pseudo-employees;
- named employee history requirements.

Disposition:

- separate permanent employee identity, employment state, schedule eligibility, Messenger eligibility, phone eligibility, schedule position, position occupancy, absence, vacancy and test fixture state.

### 4.6 Scan insertion incorrectly resolves legacy alerts

Corroborated by:

- deployed trigger on `scan_events`;
- deployed `sch_clear_scan_alerts_after_scan_event` and `sch_clear_scan_alerts_for_location` definitions;
- v3.1 research;
- 5.5 Instant and GPT-5.6 historical audit concerns.

Disposition:

- retire scan-triggered operational resolution. Only accepted completion or an audited manager correction resolves the status episode.

### 4.7 Events and AI reads can mutate schedules

Corroborated by:

- current event/schedule coupling risk;
- deployed `msg_memphis_pre_generate_schedule` trigger, which invokes daily schedule generation when a Memphis message contains schedule-related terms;
- current decision that reads and event save/import/edit/cancel must not mutate ownership.

Disposition:

- separate event facts, notices, impact proposals, approved requirement changes and ownership inputs;
- prohibit AI/read-side generation or schedule mutation.

### 4.8 Absence changes can destructively regenerate a day

Corroborated by:

- deployed `daily_absence_overrides` trigger;
- deployed `sch_regenerate_existing_schedules_for_absence_range`;
- deployed `sch_absence_publish`, which calls forced daily generation;
- deployed generator deleting daily rows when forced;
- architecture research and all current audits.

Disposition:

- replace whole-day regeneration with append-only exception input, deterministic minimal-change compilation, exact diff and atomic publication.

### 4.9 Notification state machines remain incomplete

Corroborated by:

- separate legacy scan-alert log, operational notification jobs, employee push jobs, device acknowledgement, browser reminder state and native overlay state;
- exact two-cycle requirement;
- scan-triggered alert clearing;
- acknowledgement durability concerns;
- all audits.

Disposition:

- one architecture must link but not collapse operational episode, recipient intent, transport, device receipt, presentation, acknowledgement and manager escalation.

### 4.10 Retention is feature-by-feature rather than one information-class model

Corroborated by:

- 14-day message and event-notice settings;
- durable scan, maintenance and guest history settings;
- separate guest-contact redaction;
- disabled legacy retention function;
- missing explicit raw-GPS policy;
- all whole-program audits.

Disposition:

- create a data-class retention, archive, hold, purge and redaction matrix before schema design.

---

## 5. Correct findings whose proposed repair was too small

### 5.1 “Add an application layer”

GPT-5.5 Pro correctly identified missing employee, manager and product contracts. Calling the repair a v3.2 application layer risks preserving ownership-centered architecture with several appendices.

Correct repair:

- create a new Unified Whole-System Architecture;
- import v3.1 as the ownership chapter;
- define common authority, identity, events, security, retention, migration, release and physical-test contracts across all domains.

### 5.2 Simple inspection-ready formula

Spark proposed an initial formula resembling accepted completion plus no unresolved issues plus freshness. That is useful as a hypothesis, not the final state model.

Correct repair:

- define separate requirement, completion, issue, follow-up, out-of-order, inspection, freshness and correction states;
- derive role-specific readiness projections from a truth table;
- obtain the manager's operational policy for issue severity and inspection requirements.

### 5.3 Event-to-requirement “transformation layer”

Spark correctly required explicit event handling. The wording could still imply automatic mutation from saved event to schedule.

Correct repair:

```text
event revision
→ published notice
→ proposed custodial impact
→ manager-approved operational requirement input
→ optional separate ownership compilation/publication
```

Event save is not operational authorization.

### 5.4 Local employee-page repairs

The historical GPT-5.6 audit recommended fixing route targets, packaging, Back behavior, NFC and notifications. Those findings are valid for the old candidate, but the new response must not repair the hybrid graph through more route exceptions.

Correct repair:

- define one employee runtime architecture;
- extract only validated legacy algorithms behind explicit interfaces;
- rebuild the shell and lifecycle from the approved product contract.

---

## 6. Findings not accepted as final policy

### 6.1 Workload model choice

No audit can choose time-only, difficulty-only or an arbitrary hybrid without field evidence. The architecture may define required dimensions and versioning, but values and weights require research and approval.

### 6.2 Contractor named-worker requirement

The audits correctly identify the policy gap. Source cannot decide whether a vendor slot is sufficient. The architecture must support both a named worker and an accountable slot while preventing “assigned” from being confused with “received” or “accepted.” Eric must approve the operational policy after contractor workflow research.

### 6.3 Raw GPS retention

The architecture must separate raw points from durable summaries and incident holds. Exact duration remains a policy decision informed by storage, privacy, troubleshooting and field accuracy evidence.

### 6.4 Moxie final product role

Moxie exists and has operational capability. Existence does not make it a required module of the Custodial Program. Its production role, authority and isolation require a separate decision after security and use-case review.

---

## 7. Reconciled foundational blockers

The following must be closed or explicitly bounded before isolated schema/component design:

1. Complete capability canon.
2. One authority register for every operational fact.
3. Approved static schedule source for all weekdays.
4. Sunday authority conflict resolved.
5. Schedule position versus intentionally person-bound rules resolved.
6. Per-location/per-purpose workload and service-frequency research.
7. Versioned route, zone, adjacency and walking-time model.
8. Versioned operating windows, including September 14, split hours and after-hours.
9. Canonical operational status and inspection-readiness model.
10. Canonical employee/runtime lifecycle ownership.
11. Identity, position, employment and device lifecycle model.
12. Event information/approval/ownership separation.
13. Notification and escalation state-machine integration.
14. Contractor assignment, delivery and acceptance model.
15. Complete retention/privacy matrix.
16. AI/MCP/Moxie/diagnostic authority model.
17. Whole-program migration, atomic cutover and rollback model.
18. Physical Moto G/Fully Kiosk/Karen acceptance matrix.
19. Schema replan after the above domains are settled.
20. Independent re-audit with no unresolved foundational guessing.

---

## 8. Disposition of architecture v3.1

Retain:

- one location-level owner per required interval;
- static-first policy;
- exception-only minimal change;
- explicit `OPEN` and `not_required`;
- schedule positions;
- contractor capacity;
- owner/active-cleaner/actual-cleaner separation;
- work request versus ownership transfer;
- immutable source, baseline, input, transition and publication history;
- deterministic compilation;
- atomic publication and one read-authority pointer;
- no permanent dual read/write;
- complete rollback.

Do not retain as final top-level architecture:

- the assumption that connected application domains can be specified later without changing shared foundations;
- any schema design produced before the complete authority, identity, status, retention and migration models are settled.

Final classification:

> Canonical Ownership Foundation Architecture v3.1 is a retained subsystem specification and source for the Unified Whole-System Architecture. It is not implementation authorization.

---

## 9. Current next step

Complete production-truth research and the capability/authority ledgers, then write Unified Whole-System Architecture v4. Audit that architecture internally, replan it, and submit the revised architecture to all four independent audit roles before any schema or product implementation.