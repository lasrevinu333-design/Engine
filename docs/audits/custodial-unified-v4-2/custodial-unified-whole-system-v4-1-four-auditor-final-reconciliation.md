# Memphis Zoo Custodial Program — v4.1 Four-Auditor Final Reconciliation

**Status:** Final reconciliation of the four independent v4.1 first-pass audits  
**Prepared:** 2026-08-04  
**Clean working branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Clean branch base:** actual-program commit `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Frozen v4.1 target:** `audit/custodial-unified-v4-1-freeze-20260804` at `7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc`  
**Authorization:** Architecture reconciliation and standalone v4.2 replan only. Schema, component design, implementation, migration, APK, phone, fleet and release remain **NO-GO**.

---

## 1. Purpose

This document reconciles the four independent audits of Unified Whole-System Architecture v4.1 against the frozen architecture, actual program, backend, v17 PDF, candidate static-schedule workbook, production-truth research and read-only live database evidence.

The auditors were:

1. GPT-5.3 Spark — mechanical/schema/compiler/transaction audit;
2. GPT-5.5 Instant — whole-program breadth/capability/omission audit;
3. GPT-5.5 Pro — custodial operations/Karen/manager/fairness audit;
4. GPT-5.6 Pro — integrated authority/security/migration/release audit.

This reconciliation does not decide findings by vote. A finding is accepted only when it is supported by the architecture text, source, production truth, live read-only evidence, valid operating doctrine or a clearly bounded inference.

---

## 2. Evidence identity

### 2.1 Frozen source and architecture

| Evidence | Exact identity | Status |
|---|---|---|
| Actual Engine program | `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148` | Frozen evidence |
| Ownership subsystem v3.1 | `92cc7a95c6c0beb211db27ac510fa725aa3c23c0` | Retained subsystem evidence |
| Unified architecture v4.1 | `7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc` | Audited candidate |
| Backend | `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7` | Frozen evidence |
| v17 PDF | SHA-256 `45301cf19ff6155181ce80cea6b8334cbf716be5cda87ee8433a1109bc1dd6df` | 26 pages/images inspected |
| Candidate workbook | SHA-256 `f9eba54e274cd1b792545770de6fb17e9e25fee989aca18f65250d433f599e40` | Candidate evidence only |
| Rollback baseline | Custodial Build 22 | Retained |

### 2.2 Independent report identities

| Auditor | Source artifact | SHA-256 | Verdict |
|---|---|---|---|
| GPT-5.3 Spark | `Pasted text(208).txt` | `0a8870fb9d87bcccf282bab554c6f7db2b0491c535e3c2f6fd8ccb1f7b51eb13` | CONDITIONAL GO |
| GPT-5.5 Pro | `Pasted text (2)(6).txt` | `d962ad98f791bc39336679b32ab377c4d9bfb7ba2cfc991f6151f8f873c68028` | CONDITIONAL GO |
| GPT-5.5 Instant | `Pasted text (3)(4).txt` | `86f871a9323b6b0a55a84f10a1cc0bfecc688b8e9877dd97297b4b0ec4073ec0` | CONDITIONAL GO |
| GPT-5.6 Pro | `Pasted text(210).txt` | `55b0a030efecfc50b1fcb1ebaf30518a43cc5595e27bf3b8c2b5cdf282d4370d` | CONDITIONAL GO |

The reports are evidence, not design authority. Their accepted findings are restated normatively in the v4.2 architecture rather than left as an external pile of recommendations.

---

## 3. Verdict convergence

| Scope | Spark | 5.5 Instant | 5.5 Pro | 5.6 Pro | Reconciled result |
|---|---|---|---|---|---|
| Retain v4.1 direction | Yes | Yes | Yes | Yes | **YES** |
| Whole-system restart required | No | No | No | No | **NO** |
| Bounded standalone replan required | Yes | Yes | Yes | Yes | **YES — v4.2** |
| Final architecture approved | No | No | No | No | **NO-GO** |
| Schema/component design | NO-GO | NO-GO | NO-GO | NO-GO | **NO-GO** |
| Implementation | NO-GO | NO-GO | NO-GO | NO-GO | **NO-GO** |
| Migration | NO-GO | NO-GO | NO-GO | NO-GO | **NO-GO** |
| APK/phone/fleet/release | NO-GO | NO-GO | NO-GO | NO-GO | **NO-GO** |

### Reconciled architecture verdict

**CONDITIONAL GO for retaining v4.1 as the correct top-level direction and producing a bounded standalone v4.2 architecture.**

V4.1 is not final. It is not design-safe. It is the first architecture broad enough to survive without another whole-program reset.

---

## 4. Strengths that must survive v4.2

The four audits and primary evidence support retaining these foundations:

1. One canonical authority per fact.
2. One compatible operational authority set rather than independent consumer flags.
3. Versioned canonical serialization and source-byte hashing.
4. Source facts, commands, compiler outputs, operational evidence, corrections, projections and presentation evidence are distinct classes.
5. Stable employee identity separated from employment, eligibility, position, contractor and device assignment.
6. Stable location identity separated from display name, tag, group and route data.
7. Individual location and half-open interval as final ownership unit.
8. Static normal policy before exception compilation.
9. Minimal change to affected locations/intervals only.
10. Explicit employee, contractor, `OPEN` and `not_required` states.
11. Responsible owner, active cleaner and actual cleaner remain separate.
12. Work requests do not transfer ownership.
13. Service occurrence is the root identity for due-soon, overdue, in-progress and resolution behavior.
14. Scan/start, notification presentation and message read do not resolve work.
15. Accepted evidence is immutable; correction is append-only and bitemporal.
16. Event notice, impact proposal, approved requirement and ownership input are separate.
17. Contractor capacity, delivery, acceptance and actual worker are separate.
18. One native employee lifecycle/navigation/NFC/notification/local-state owner.
19. Guest reporting remains disabled and Marketing-gated.
20. AI defaults to read/propose; write requires explicit tool authority and human authorization.
21. Short communication retention cannot erase durable responsibility evidence.
22. Low-confidence reconstructed ownership is excluded from disciplinary analytics by default.
23. Complete rollback restores a compatible authority set, not isolated daily rows.
24. Source-to-APK provenance, signer, anti-rollback, producer/consumer admission and physical acceptance remain release gates.
25. Build 22 remains rollback until a later release is physically accepted.

---

## 5. Final architecture BLOCKER register

The following are accepted architecture blockers. They are not all policy values; several are missing normative technical contracts.

### B-01 — No normative cross-domain record envelope

**Source:** GPT-5.6 Pro; independently supported by v4.1 §§3 and 6.

V4.1 defines canonical JSON, stable IDs and correlation/causation but not one mandatory semantic envelope for commands, facts, events, corrections, outbox records, worker attempts and migration assertions.

V4.2 must define a common versioned envelope containing at least:

- record ID and class;
- schema contract/version;
- authority-set ID/generation;
- source domain/revision;
- aggregate identity and sequence rule;
- valid/recorded/occurred time;
- operation/idempotency ID;
- correlation/causation IDs;
- canonical principal and authorization-decision reference;
- credential/device/epoch context where applicable;
- source artifact/revision;
- correction/supersession links;
- sensitivity and retention class;
- payload digest;
- producer implementation version;
- replay/projection compatibility;
- unknown-version fail-closed behavior.

**Disposition:** ACCEPT. Close in v4.2.

### B-02 — Authority-set activation is not a complete distributed protocol

**Source:** GPT-5.6 Pro; corroborated by GPT-5.5 Instant cross-set work and Spark offline/rollback findings.

A database pointer cannot atomically switch independently deployed schema, backend, workers, push behavior, clients, local queues, keys and policy revisions.

V4.2 must define:

- immutable dependency graph;
- monotonic authority-set generation/fencing token;
- lifecycle states including prepared, validated, shadow-ready, activating, active, degraded, rollback-pending and retired;
- request/session/queue/worker-lease pinning;
- compatibility ranges;
- stale-client reject/translate/quarantine rules;
- bounded compatibility adapter ownership and retirement;
- worker drain and lease fencing;
- partial-deployment recovery;
- split-brain detection;
- rollback with pending local work;
- old APK/backend/schema/policy behavior.

**Disposition:** ACCEPT. Close in v4.2.

### B-03 — Canonical principal, grant and authorization-decision model is incomplete

**Source:** GPT-5.6 Pro; corroborated by Instant’s accommodation boundary and Pro’s manager-tier/escalation findings.

V4.1 lists actors and capabilities but does not define one shared authorization model connecting principal, role, grant, scope, credential, trusted device, session, approval, revocation, service principal and immutable actor snapshot.

V4.2 must define:

- principal types;
- credential/session types;
- capability grants with resource/temporal scope and constraints;
- approval counts and dual control;
- break-glass authority;
- revocation propagation;
- authorization-decision records;
- immutable actor snapshots;
- service, database-owner, backup and release principals;
- confidential accommodation effect separated from justification.

**Disposition:** ACCEPT. Close in v4.2.

### B-04 — Service-occurrence satisfaction, concurrency and correction cascade are incomplete

**Source:** Spark and GPT-5.6 Pro.

V4.1 establishes the right occurrence concept but not a complete serialized aggregate for concurrent sessions/completions, partial satisfaction, urgent/regular overlap, cross-midnight work, retroactive correction or next-occurrence idempotency.

V4.2 must define:

- aggregate sequence/version;
- allowed commands and preconditions;
- one authoritative satisfaction decision;
- completion-to-occurrence cardinality rules;
- partial/full satisfaction interface;
- urgent/regular precedence;
- exactly-once next occurrence;
- correction cascade;
- leased-notification cancellation;
- closure and cross-midnight behavior;
- deterministic conflict-review state and manager wording.

**Disposition:** ACCEPT. Close in v4.2.

### B-05 — Location split/merge lacks one cross-domain effective-time transaction

**Source:** GPT-5.6 Pro.

Stable lineage alone does not define active sessions, offline completions, occurrences, ownership, tickets, inspections, notifications, routes, tags and signage at the transition boundary.

V4.2 must define an effective-dated location-transition command with:

- predecessor/successor lineage;
- active-session grandfathering;
- delayed completion attribution;
- occurrence closure/creation;
- ownership publication;
- issue/ticket/inspection continuity;
- route/workload/policy replacement;
- tag revoke/replace;
- offline reconciliation;
- signage-removal evidence;
- rollback behavior.

**Disposition:** ACCEPT. Close in v4.2.

### B-06 — Legacy writer/resolver retirement is not machine-enforceable

**Source:** all four auditors; independently corroborated by read-only live function inventory.

Current production contains multiple generation, absence, lunch, AI, resolver, alert and SCH2 families. V4.1 requires retirement but lacks a mandatory signed, machine-enforced retirement manifest.

V4.2 must require for every object:

- exact object identity/signature/path;
- definition digest;
- writer/reader/worker/trigger/cron/API/tool classification;
- callers and grants;
- replacement authority;
- disable/revoke action;
- retirement authority set;
- rollback treatment;
- archive/delete policy;
- owner and deadline;
- automated proof;
- unexpected-object failure rule.

No unregistered writer or owner resolver may survive cutover. Surviving privileged functions require pinned search paths, exact grants, actor propagation and audit.

**Disposition:** ACCEPT. Close in v4.2.

### B-07 — Static schedule and operating-policy truth remains unapproved

**Source:** all four auditors.

Open facts include:

- approved seven-day source/provenance;
- Sunday truth;
- Michael McWright shift;
- Markiesha Warren shift;
- position versus intentionally person-bound rules;
- lunch ownership/restoration;
- normal close and September 14;
- split/after-hours/cross-midnight windows;
- Elephant Trunk scope;
- orphan reminder groups.

The candidate workbook is retained as evidence only and cannot be imported or seeded.

**Disposition:** ACCEPT as research/policy blocker. V4.2 must define the publication contract without inventing values.

### B-08 — Workload, service frequency, route and restriction truth remains unapproved

**Source:** all four auditors.

V4.2 must retain explicit gates for location/purpose workload, service frequency, difficulty, priority, zones, adjacency, walking time, source confidence and effective revision. Group values cannot be copied or divided into individual-location truth.

**Disposition:** ACCEPT as field-research/policy blocker.

### B-09 — Complete capability trace and evidence precedence are absent

**Source:** GPT-5.5 Instant; supported by GPT-5.6 record/evidence findings.

V4.2 must ship with:

- one row for each of the 252 capability IDs;
- authority, record/command, product/projection, security boundary, retention class, migration class, automated proof, physical proof and gate references;
- reverse mapping from every architecture object to legitimate capability IDs;
- a frozen evidence manifest with path, digest, status, precedence, supersession, confidence and gate linkage.

**Disposition:** ACCEPT. Close with supporting artifacts, not prose promises.

### B-10 — Attendance and confidential accommodation boundaries are incomplete

**Source:** GPT-5.5 Instant and GPT-5.6 Pro.

Attendance is a valid manager informational capability but requires source, cache, freshness, stale/unavailable, privacy, retention and no-silent-schedule-effect contracts.

Accommodation/restriction architecture must separate:

- neutral operational eligibility effect;
- confidential justification;
- authorized viewers;
- review/expiration;
- compiler audit;
- migration/redaction;
- prohibition from employee Schedule, ordinary explanations, AI, analytics and general exports.

**Disposition:** ACCEPT. Close in v4.2.

### B-11 — Retention, holds and complete restore bundle are insufficiently normative

**Source:** GPT-5.6 Pro; corroborated by Instant.

V4.2 must define cross-store hold, purge, redaction and restore behavior across database, object storage, exports, backups, keys, queues, push registrations, retention state and external side effects.

**Disposition:** ACCEPT. Close in v4.2 while exact periods remain policy gates.

### B-12 — Physical behavior and release identity remain execution gates

**Source:** GPT-5.5 Pro and GPT-5.6 Pro.

Physical evidence is not an architecture defect when the architecture explicitly gates it. However, physical research can still alter design assumptions and therefore must be planned before affected design freezes.

Required later evidence includes NFC, lifecycle restoration, exact audio, stale-alert revocation, offline/reboot, GPS, Fully Kiosk, Karen usability, release tuple and Build 22 rollback.

**Disposition:** RETAIN AS PHYSICAL/RELEASE GATES. Do not mislabel as current product proof.

---

## 6. Accepted HIGH findings for v4.2

The following findings are accepted and must become normative contracts or explicit gates:

1. **Already-visible stale alert revocation.** The old phone must receive durable supersession/cancellation and cannot suppress the new owner’s intent.
2. **Grouped notification child semantics.** Display/open/dismiss applies to presentation group separately from each child occurrence/transition and escalation state.
3. **Offline trusted time after reboot.** Snapshot age requires boot identity/generation and post-reboot confidence behavior.
4. **Protected-store key and lost-phone lifecycle.** Encryption/signing key rotation, revocation, wipe/quarantine, returning-lost-phone behavior and backup interaction must be defined.
5. **Mid-session revocation/reassignment.** Preserve actual work while ending future authority and preventing cross-employee attribution.
6. **Active-session GPS.** Acquisition, sampling, battery, calibration, permission, hysteresis, unavailable behavior, retention and dispute policy remain gated.
7. **Messenger visibility and reappearance.** User-scoped rather than device-scoped identity; offline replay, device movement, group/Memphis semantics and content purge must be explicit.
8. **Event cancellation/impact reversal.** Cancellation supersedes operational inputs; it does not erase historical responsibility or accepted work.
9. **Feedback offline and attachment handling.** Protected outbox, encryption, validation, restart, idempotency, local deletion, access audit, retention and lost-phone exposure.
10. **Executable AI/MCP/Moxie/diagnostic registry.** Tool schemas and grants are server-enforced; model text cannot broaden scope.
11. **Retention/hold propagation.** Database, objects, exports and backups stay consistent with holds and redaction.
12. **Structural analytics anti-misuse.** Approved views enforce sample/context/confidence exclusions; no automatic disciplinary conclusion.
13. **Complete restore bundle.** Database alone is not a restore.
14. **Confidential accommodation separation.** Operational effect and private justification are separate authorities.
15. **P0 notification interruption.** Default architecture prohibits speech preemption. Any emergency preemption requires a separate approved deterministic contract and physical proof.
16. **External generated migration artifacts.** Unadmitted SQL/data artifacts are inventoried and quarantined; manual production execution outside the release tuple is prohibited.
17. **Event employee wording.** Information is not instruction; proposal is not approval.
18. **Notification acknowledgement binding.** Intent, occurrence, employee, device, credential, assignment epoch and authority set are mandatory.
19. **Validation invalidation.** Material source/schema/migration/authority/config/signer/asset/backend changes invalidate prior green evidence.
20. **Weather disposition.** Excluded from employee product; optional manager-only informational context only after explicit approval.

---

## 7. Findings requiring scope correction rather than rejection

### 7.1 Physical tests

Physical Moto G/Fully Kiosk/Karen evidence cannot exist for an unimplemented v4.2 system. It is therefore not a prerequisite to write the architecture. It remains:

- a required physical-research input where it may alter design;
- a component-design constraint;
- an APK/phone/release blocker.

### 7.2 Exact policy values

V4.2 can define the data model, command model, authority and fail-closed behavior without inventing Eric’s values for hours, lunch, readiness, contractor acceptance, retention or SLOs. Those values remain explicit gates. Schema/component design remains blocked where the missing value changes structure.

### 7.3 RLS-enabled/no-policy findings

RLS enabled with no policy may intentionally deny direct roles. It neither proves a vulnerability nor proves safe service-role/API mediation. V4.2 therefore requires exact grant/function/role inventory rather than adopting either interpretation.

### 7.4 Current production defects

Legacy UI, current one-cycle alerts, mutable search paths and current schedule writers are migration evidence, not target requirements. V4.2 must not preserve them as compatibility behavior.

---

## 8. Technical architecture decisions versus Eric decisions

### 8.1 Technical decisions the architecture must make without asking Eric

- common record envelope;
- versioning and fail-closed behavior;
- authority-set fencing/pinning protocol;
- idempotency and concurrency semantics;
- queue leases and poison handling;
- canonical principal/grant/authorization-decision mechanics;
- search-path/grant hardening;
- retirement-manifest mechanics;
- migration confidence representation;
- release-admission invalidation;
- restore-bundle compatibility;
- location and occurrence transaction semantics.

### 8.2 Genuine Eric/management decisions

- approved static schedule source and effective date;
- disputed shifts;
- position versus person-bound policy;
- lunch policy;
- operating hours/September 14/split/after-hours/cross-midnight policy;
- `OPEN` response/escalation;
- workload/frequency and late-day tie-break policy after research;
- readiness/severity/inspection/reopen policy;
- contractor identity/acceptance policy;
- GPS purpose/use/retention/dispute policy;
- manager capability tiers and on-call escalation;
- Messenger archive/reappearance/Memphis behavior;
- Moxie and AI write-authority roles;
- guest activation/data/privacy;
- information-class retention and holds;
- analytics use/discipline/dispute policy;
- SLO/RPO/RTO/budget;
- sensitive export authority;
- Karen and fleet pilot thresholds;
- Build 22 retirement authority.

Research-answerable questions must be researched before being presented as policy choices.

---

## 9. Required v4.2 artifact set

The v4.2 cycle must produce, on a clean documentation branch based on the frozen actual program:

1. standalone Unified Whole-System Architecture v4.2;
2. frozen evidence-precedence manifest;
3. 252-row capability/authority/contract/proof trace;
4. reverse architecture-object capability registry;
5. canonical cross-domain record registry;
6. authority-set lifecycle/compatibility protocol;
7. principal/grant/authorization-decision matrix;
8. service-occurrence command/state/concurrency contract;
9. location-transition command/state contract;
10. legacy writer/resolver retirement-manifest contract;
11. policy/research gate registry update;
12. internal adversarial v4.2 audit;
13. four independent v4.2 re-audit prompts;
14. immutable v4.2 audit freeze branch.

These are foundation artifacts. They are not implementation.

---

## 10. Reconciled stage gates

| Gate | Status after four-auditor reconciliation |
|---|---|
| Retain v4.1 direction | GO |
| Produce standalone v4.2 | GO — REQUIRED |
| Final architecture acceptance | NO-GO |
| Schema design | NO-GO |
| Component design | NO-GO |
| Implementation | NO-GO |
| Shadow writes | NO-GO |
| Migration/cutover | NO-GO |
| APK/build | NO-GO |
| Phone/Fully Kiosk | NO-GO |
| Fleet/release | NO-GO |

---

## 11. Final disposition

V4.1 is retained as the first credible whole-system architecture and as the direct source for v4.2.

It is superseded as the final candidate because its most important cross-domain contracts remain principles rather than enforceable architecture.

The next legitimate step is a clean, standalone v4.2 replan closing the accepted technical blockers while preserving every open operational decision as an explicit gate.

No schema, component or product work is authorized by this reconciliation.