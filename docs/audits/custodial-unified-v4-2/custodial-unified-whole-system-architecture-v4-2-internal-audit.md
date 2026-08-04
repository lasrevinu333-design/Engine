# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.2 Internal Adversarial Audit

**Status:** Internal architecture audit complete  
**Prepared:** 2026-08-04  
**Architecture audited:** `custodial-unified-whole-system-architecture-v4-2.md`  
**Working branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Branch base:** actual-program commit `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Internal verdict:** **GO for four independent architecture audits only**  
**All later gates:** **NO-GO**

---

## 1. Audit purpose

This audit attempts to falsify whether v4.2 is a standalone, coherent whole-system architecture or merely another document that names the right domains while leaving incompatible semantics for later designers to invent.

It tests whether v4.2:

- closes the accepted findings from all four independent v4.1 audits;
- preserves valid v4.1 and ownership-v3.1 foundations;
- separates technical architecture decisions from open operating-policy values;
- contains a home for all 252 capabilities;
- defines cross-domain compatibility, authority, identity, concurrency, correction and rollback;
- makes legacy retirement and security review enforceable rather than ceremonial;
- remains foundation-first rather than patch-first;
- can be independently audited without implying that implementation is authorized.

This is an internal audit. It is not independent proof and cannot authorize schema or implementation.

---

## 2. Exact evidence set

The audit used:

- actual Engine evidence `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`;
- ownership v3.1 evidence `92cc7a95c6c0beb211db27ac510fa725aa3c23c0`;
- frozen v4.1 package `7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc`;
- backend `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7`;
- all 26 pages/images of the v17 PDF;
- candidate static-schedule workbook, treated as candidate evidence only;
- quarantined generated schedule-seed SQL;
- v4.1 production-truth research/addenda;
- read-only live Supabase trigger, cron, function, RLS and extension inspection recorded in production-truth addendum v9;
- all four independent v4.1 reports;
- the four-auditor final reconciliation;
- v4.2 evidence manifest, architecture, capability trace, code registry and gate registry.

No product source, schema, row, workflow, build, APK, phone, configuration or deployment was changed.

---

## 3. Clean provenance result

**PASS.**

The v4.2 branch begins directly from the frozen actual-program commit rather than inheriting the divergent v4.1 architecture branch history.

This provides a clean statement:

- the branch contains actual program source exactly as frozen at `8cdbe2f...`;
- v4.2 changes documentation only;
- v4.2 is not represented as implemented source;
- prior v4.1/v3.1 artifacts remain exact external evidence pinned by commit.

This closes the provenance ambiguity noted by GPT-5.6 Pro.

---

## 4. Four-auditor reconciliation check

**PASS.**

The reconciliation:

- identifies each report by file and SHA-256;
- records the shared CONDITIONAL GO accurately;
- does not promote consensus into proof;
- retains v4.1 direction without treating it as final;
- separates accepted technical architecture findings from policy/research gates;
- requires one standalone v4.2 architecture rather than a chain of final addenda;
- leaves every schema, design, implementation, migration, APK, phone and release gate closed.

No finding from GPT-5.6 Pro was omitted merely because it was more demanding than the first three reports.

---

## 5. V4.1 BLOCKER closure matrix

### 5.1 Cross-domain record envelope

**V4.1 finding:** canonical JSON and correlation language did not define a common semantic envelope.

**V4.2 closure:** §5 defines:

- common record classes;
- mandatory identity/version/authority/aggregate/time/idempotency/correlation/actor/authorization/source/correction/sensitivity/retention/digest/producer fields;
- protected record-type registry;
- producer and consumer compatibility;
- unknown-version fail-closed behavior;
- replay/conformance tests.

**Result:** **CLOSED ARCHITECTURALLY.**

The exact schema remains later isolated design, as intended.

### 5.2 Distributed authority-set activation

**V4.1 finding:** one pointer was not a distributed activation protocol.

**V4.2 closure:** §6 defines:

- immutable dependency graph;
- monotonic generation and fencing;
- complete lifecycle including activating/degraded/rollback-pending;
- request/session/snapshot/queue/worker pinning;
- old-client and in-flight-work policy;
- bounded adapters;
- worker drain;
- mixed-set detection;
- rollback of one complete compatible set.

**Result:** **CLOSED ARCHITECTURALLY.**

Implementation and fault-injection proof remain later gates.

### 5.3 Principal/grant/authorization-decision model

**V4.1 finding:** role strings and separate identity systems could create inconsistent privilege.

**V4.2 closure:** §§7–8 define:

- principal and credential types;
- scoped capability grants;
- deny-by-default;
- immutable authorization decisions and actor snapshots;
- approval counts and break-glass;
- revocation propagation;
- separate high-risk administrators;
- product-specific trust boundaries;
- confidential restriction-effect separation.

**Result:** **CLOSED ARCHITECTURALLY.**

Exact manager tiers remain a policy gate rather than hidden design choice.

### 5.4 Service-occurrence concurrency and correction cascade

**V4.1 finding:** occurrence identity existed without sufficient concurrency, satisfaction and correction semantics.

**V4.2 closure:** §15 defines:

- aggregate sequence/fencing;
- registered commands;
- authoritative satisfaction decision;
- partial/full and explicit multi-occurrence policy;
- urgent/regular overlap;
- duplicate/concurrent completion;
- cross-midnight/closure conflict;
- exactly-once next occurrence;
- correction cascade through status, notifications, escalation and analytics;
- no silent deletion of an already-created next occurrence.

**Result:** **CLOSED ARCHITECTURALLY.**

Exact readiness/severity values remain policy gates.

### 5.5 Location split/merge transition

**V4.1 finding:** lineage did not govern active sessions, occurrences, ownership, tags, tickets and offline work at effective time.

**V4.2 closure:** §9 defines one effective-dated transition command/publication covering:

- predecessor/successor identities;
- active-session grandfathering;
- delayed/offline completion attribution;
- occurrence and ownership transitions;
- issues/tickets/inspections;
- policy/route/workload replacement;
- tag and signage evidence;
- rollback.

**Result:** **CLOSED ARCHITECTURALLY.**

### 5.6 Machine-enforced legacy retirement

**V4.1 finding:** “retire old writers” was not an enforceable contract.

**V4.2 closure:** §36 defines a signed per-object retirement manifest with identity, digest, classification, callers, grants, triggers, cron, APIs/tools, replacement, disable action, authority-set generation, rollback, owner/deadline and proof. Release admission fails on unexpected authority.

Production-truth addendum v9 records live examples, including:

- absence regeneration trigger;
- PTO synchronization triggers;
- Messenger schedule-generation trigger;
- scan-event alert-clear trigger;
- active rolling schedule-window cron;
- Messenger purge cron;
- sampled RLS/FORCE RLS and extension placement.

**Result:** **CLOSED AS ARCHITECTURE CONTRACT.**

The complete object inventory remains a schema/migration prerequisite and cannot be claimed complete today.

---

## 6. GPT-5.5 Instant unique-finding closure

| Finding | V4.2 closure | Result |
|---|---|---|
| Complete 252-capability trace missing | Capability trace v2 maps CAP-001–CAP-252 plus reverse registry | Closed architecturally; lint gate open |
| Attendance Context omitted | §8.6 defines manager-only source/freshness/privacy/no-schedule-effect | Closed |
| Confidential accommodation boundary | §§7.7 and 10 separate neutral effect from justification | Closed |
| Cross-authority-set offline/in-flight work | §§6.4–6.8 and 17 define pin/translate/quarantine/rollback | Closed |
| P0 preemption versus fixed audio | §26.6 prohibits speech preemption by default | Closed; optional policy gate remains |
| External generated SQL not governed | Manifest quarantines seed; §36.4 prohibits unadmitted production execution | Closed |
| Evidence precedence manifest missing | Evidence manifest v1 created and controls status/supersession | Closed; freeze digest pending |
| Event employee wording ambiguous | §§23.4 and 27.4 state information is not instruction | Closed |
| Acknowledgement epoch binding weak | §26.4 binds intent/occurrence/employee/device/credential/epoch/set | Closed |
| Validation invalidation implicit | §37.2 makes material tuple changes invalidate evidence | Closed |
| Weather disposition unresolved | §8.7 disabled by default; manager-only optional | Closed |

---

## 7. GPT-5.6 HIGH-finding closure

### 7.1 Already-visible stale alert

§26.7 requires durable supersession/cancellation, old-device closure/replacement, retained presentation evidence and independent new-recipient intent.

**Closed architecturally.**

### 7.2 Grouped notification child semantics

§26.2 separates child intents/occurrences/escalations from the human presentation group.

**Closed architecturally.**

### 7.3 Offline reboot time

§17.3 includes server offset, monotonic time, boot generation, reboot detection, wall-clock tamper and post-reboot confidence.

**Closed architecturally.**

### 7.4 Key/lost-phone lifecycle

§17.4 defines key generation/rotation/revocation, quarantine/wipe, returning lost phone, backup interaction and storage recovery.

**Closed architecturally.**

### 7.5 Mid-session revocation/reassignment

§§10.6–10.7 and 16.4 preserve legitimate work, close future authority and prevent cross-employee attribution.

**Closed architecturally.**

### 7.6 Active-session GPS

§19 defines acquisition, sampling, battery, calibration, permission/unavailable behavior, privacy, retention and dispute. Exact policy and physical values remain gated.

**Closed as architecture seam/gate.**

### 7.7 Messenger visibility and reappearance

§25 makes visibility user-scoped and requires versioned direct/group/Memphis/reappearance/archive policy.

**Closed architecturally; exact policy gate remains.**

### 7.8 Event cancellation and impact reversal

§27.3 requires explicit superseding operational commands and preserves historical work/responsibility.

**Closed architecturally.**

### 7.9 Feedback offline/attachments

§29 defines protected outbox, encryption, validation, restart/idempotency, local deletion after acknowledgement, retention and lost-phone protection.

**Closed architecturally.**

### 7.10 Executable tool registry

§31 defines stable server-enforced tool identities, schemas, grants, authority-set compatibility, confirmation, audit and rollback. Model text cannot broaden scope.

**Closed architecturally.**

### 7.11 Retention and hold propagation

§34 defines class-based policy and propagation across database, object storage, exports and backups, including restored-data reconciliation.

**Closed architecturally; exact periods remain policy gates.**

### 7.12 Structural analytics anti-misuse

§32 requires approved views to enforce context/sample/confidence exclusions and prohibits automatic discipline/rankings.

**Closed architecturally; exact thresholds/use policy remain gated.**

### 7.13 Complete restore bundle

§35 binds database, objects, migrations, authority set, release, keys, queues, push, devices, retention and external effects.

**Closed architecturally; RPO/RTO and drill remain gated.**

### 7.14 Confidential restriction architecture

Closed under §7.7 as above.

---

## 8. Product and operational completeness check

### 8.1 Employee

**PASS ON ARCHITECTURE.**

V4.2 explicitly defines:

- four-button Home;
- device-derived identity;
- one router/native owner;
- ambient NFC;
- current-area Schedule rather than route;
- low-tech wording;
- progressive completion;
- session/draft/offline recovery;
- direct-recipient Messages;
- approved Event states;
- app/phone/NFC Feedback;
- exact alert behavior;
- physical/Karen gate.

No prohibited employee product behavior is restored.

### 8.2 Manager

**PASS ON ARCHITECTURE.**

Manager capabilities are gated by the canonical grant model and include exact schedule publication, Dashboard/readiness, inspection, analytics, Events/impact approval, communications, workforce/device lifecycle, guest/Feedback and privileged tools.

Full Access does not imply database, backup, release, Device Security or repair authority.

### 8.3 Read Only

**PASS ON ARCHITECTURE.**

Separate private Dashboard/Events projection with fail-closed fields and no visual-only redaction.

### 8.4 Contractor, guest, Marketing, AI and diagnostics

**PASS ON ARCHITECTURE.**

Each has a separate principal/product boundary and cannot inherit employee/manager authority. Guest and high-risk AI/write capabilities remain disabled until policy/security gates close.

---

## 9. Foundation-first check

**PASS.**

V4.2 does not prescribe legacy-table patching as the target. It defines:

- isolated later design;
- complete record/principal/authority-set foundations;
- migration confidence;
- shadow comparison;
- machine-enforced retirement;
- complete rollback;
- release and physical proof.

Validated legacy algorithms/security mechanisms may survive only behind new contracts. Current hybrid runtime and duplicate authorities are not permanent compatibility.

The trace, manifest, gate registry and production addendum are supporting architecture artifacts, not corrective runtime addenda.

---

## 10. Internal adversarial findings remaining

### MEDIUM-1 — Trace lint has not been machine-executed

The capability trace and code registry declare CAP-001–CAP-252 and the validation contract, but this documentation-only session did not execute a repository lint tool.

**Consequence:** a duplicate, missing shorthand or stale section/gate reference could survive manual review.

**Required before freeze:** perform source-level verification or have every independent auditor test:

- CAP-001 through CAP-252 exactly once;
- all shorthand registered;
- all gates resolve;
- all architecture sections resolve;
- reverse registry covers every architecture object.

**Disposition:** Does not block independent architecture audit; blocks final architecture GO if unresolved.

### MEDIUM-2 — Retirement inventory is deliberately incomplete

Production-truth addendum v9 confirms important triggers, cron jobs and functions, but it is not the final complete writer/resolver/security inventory.

**Consequence:** schema/migration designers cannot yet claim every old authority is known.

**Disposition:** Correctly held by `G-RETIRE-001`; no schema/migration authorization.

### MEDIUM-3 — Evidence manifest working blob identities will change before freeze

The manifest records working blob SHAs. Additional audit/handoff/prompt files will advance the branch.

**Disposition:** The immutable freeze commit must replace working-branch identity as package authority. This is normal and explicitly stated.

### MEDIUM-4 — Policy gates remain numerous

Static source, shifts, lunch, hours, workload, readiness, contractor, GPS, retention, analytics, manager tiers, AI, SLO and physical thresholds remain open.

**Disposition:** Correct. The architecture defines authority/fail-closed behavior without inventing values. Component/schema design remains blocked where those values change structure.

### LOW-1 — Supporting registries must be mandatory audit reading

The capability trace’s complete shorthand control is in a separate code registry and the complete open-gate control is in the gate registry.

**Required:** v4.2 audit handoff/prompt pack must require both before architecture reading.

### LOW-2 — Current production security findings require exact future classification

RLS/FORCE RLS, no-policy tables, service-role mediation, `pg_net` placement and function search paths cannot be reduced to a generic “secure/insecure” label.

**Disposition:** Correctly deferred to exact schema/security design and independent audit.

No new architecture BLOCKER or HIGH finding was discovered internally.

---

## 11. Gate classification check

**PASS.**

The v4.2 gate registry separates:

- technical architecture obligations;
- source/schema/data research;
- field/physical research;
- genuine Eric policy decisions;
- stage authorization.

Technical matters such as event envelopes, fencing, idempotency, search-path hardening and retirement-manifest mechanics are not dumped on Eric.

Policy values are not guessed by architecture.

---

## 12. Security and privacy check

**PASS FOR ARCHITECTURE AUDIT.**

The architecture now provides normative homes for:

- principals, credentials, sessions, grants and authorization decisions;
- service/database/backup/release principals;
- least privilege and dual control;
- product-specific projections;
- confidential accommodation separation;
- AI confused-deputy containment;
- public/Marketing/contractor isolation;
- class-based retention and holds;
- actor propagation and privileged-function manifest.

Exact RLS/grant/function policies remain later independently audited design work.

---

## 13. Migration and rollback check

**PASS FOR ARCHITECTURE AUDIT.**

V4.2 no longer treats atomicity as one database pointer or rollback as daily assignment restoration. It defines:

- distributed authority-set state/fencing;
- pinned operations and queues;
- bounded adapters;
- old-client handling;
- complete restore set;
- retirement manifest;
- historical confidence;
- external artifact quarantine;
- validation invalidation;
- Build 22 compatibility and pending-work treatment.

No migration execution is authorized.

---

## 14. Release and physical check

**PASS FOR ARCHITECTURE AUDIT.**

V4.2 binds release proof to source, dependencies, assets, backend, migrations, schema, authority set, APK, signer, versionCode, Firebase, Fully Kiosk, OS, tag revision, local store/key versions, device/fixture/operator evidence and rollback.

Physical matrices remain release-blocking and are not falsely claimed complete.

---

## 15. Internal verdict matrix

| Gate | Internal result |
|---|---|
| Retain v4.1/v3.1 validated foundations | GO |
| Standalone v4.2 architecture | GO for independent audit candidate |
| Internal architecture closure | PASS with MEDIUM/LOW audit tasks |
| Four independent v4.2 audits | GO to prepare and launch after freeze validation |
| Final architecture approval | NO-GO |
| Schema design | NO-GO |
| Component design | NO-GO |
| Implementation | NO-GO |
| Shadow writes/migration | NO-GO |
| APK/build | NO-GO |
| Phone/Fully Kiosk/canary | NO-GO |
| Fleet/release | NO-GO |

---

## 16. Required pre-freeze actions

Before the immutable v4.2 audit branch is created:

1. create package index;
2. create independent audit handoff;
3. create four model-specific prompt boxes;
4. require architecture, evidence manifest, trace, code registry, gate registry, production addendum v9 and this internal audit in the correct independence order;
5. verify every path exists;
6. verify or explicitly task independent auditors with CAP/code/gate/section lint;
7. update the evidence manifest package list;
8. create one immutable freeze branch and record exact SHA;
9. open a draft documentation-only PR from the clean v4.2 branch;
10. keep all downstream gates closed.

---

## 17. Final internal disposition

Unified Whole-System Architecture v4.2 is a coherent, standalone whole-program architecture candidate.

It closes the accepted technical architecture gaps in v4.1 without inventing unresolved zoo policy and without preserving legacy patchwork as the target.

**Internal verdict:**

> **GO for four independent architecture audits only.**

It is not final architecture approval and authorizes no schema, component, implementation, migration, APK, phone or release work.

---

## 18. No-change statement

This architecture cycle changed documentation only on a clean branch.

It did not change:

- product/frontend/native/backend source;
- database schema, functions, triggers, cron, policies, grants, extensions or rows;
- employees, identities, devices, credentials, assignments or schedules;
- Events, guest settings, Feedback, tickets or inspections;
- workflows, builds, APKs, phones or Fully Kiosk;
- Render, Firebase, GitHub Pages or production deployment.

Read-only Supabase queries were used solely to inspect current truth.