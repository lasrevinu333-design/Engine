# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.1 Final Internal Audit

**Status:** Internal architecture audit complete  
**Prepared:** 2026-08-04  
**Architecture audited:** `custodial-unified-whole-system-architecture-v4-1.md`  
**Verdict:** GO for four independent architecture audits; NO-GO for schema, implementation, migration, APK, phone or release

---

## 1. Audit purpose

This pass verifies whether v4.1 is a coherent whole-program architecture candidate rather than another ownership-centered document with disconnected application appendices.

The audit checks:

- coverage of the capability canon;
- one authority per fact;
- consistency with current operating decisions;
- incorporation of production-truth defects;
- cross-domain state and transaction boundaries;
- identity/location/session/status/event/notification lifecycles;
- security, retention, migration, release and physical acceptance;
- explicit handling of research and policy unknowns;
- absence of patch-first or permanent compatibility doctrine.

This internal result is not independent proof and cannot authorize implementation.

---

## 2. Evidence set

The architecture was checked against:

- all 26 pages and images of Final Report v17;
- `custodial-field-workflow-invariants.md`;
- actual Engine commit `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`;
- ownership architecture commit `92cc7a95c6c0beb211db27ac510fa725aa3c23c0`;
- backend commit `0fff8c2cadea132902df22c99593f1ce348411a7`;
- SELECT-only production truth research;
- capability canon v1;
- authority register v1;
- research and decision gates v1;
- GPT-5.3 Spark, GPT-5.5 Pro and GPT-5.5 Instant audits;
- historical GPT-5.6 Pro employee-app audit as implementation evidence;
- v4 draft.1 internal audit and every required replan item.

---

## 3. Replan closure check

### 3.1 Operational authority set

**Closed architecturally.**

v4.1 defines a protected authority-set manifest binding compatible identity, location, schedule, ownership, workload, service, status, event, notification, API/schema and client release contracts. One protected pointer activates/rolls back the compatible model set. This prevents domain-model cutover through independent consumer flags.

### 3.2 Location identity and lifecycle

**Closed architecturally.**

v4.1 defines stable location identity, effective attributes, rename, temporary closure, retirement, split/merge lineage, tag movement and signage removal. Historical work is not rewritten after a location changes.

### 3.3 Service occurrence and status episode creation

**Closed architecturally.**

v4.1 defines one service occurrence per required instance under a frequency/policy revision, stable through due-soon/overdue/in-progress/resolution, with deterministic next-occurrence creation, split-window and urgent-occurrence rules.

### 3.4 Ticket and work-order doctrine

**Closed architecturally.**

Custodial ticket truth is `OPEN → W.O. Submitted`, where `W.O. Submitted` is the current custodial terminal handoff state and does not claim Facilities completed repair. Future external work-order status is separate.

### 3.5 Employee operational reporting within four-button Home

**Closed architecturally.**

No new Home destinations are introduced. Maintenance/supply/out-of-order originate from location completion; app/phone/NFC help uses Feedback; urgent help uses Messages/radio; manager-created work requests and approved guest follow-up arrive through current-work/message/notification context.

### 3.6 Alerts during active work

**Closed architecturally.**

Open/Dismiss cannot destroy active session/draft. Opening a notice uses a session-safe module/overlay and returns to exact work state. Ownership changes apply independently from presentation choice. Priority, grouping, coalescing and queue behavior are defined.

### 3.7 Offline/outage/local-state lifecycle

**Closed architecturally.**

v4.1 defines protected signed snapshots, trusted time/clock skew, allowed offline operations, quotas/storage exhaustion, transient/terminal outcomes, prolonged outage procedure, protected-store upgrades and rollback with pending work.

### 3.8 Historical migration confidence

**Closed architecturally.**

Migrated assertions are source-proven, deterministic, inferred with confidence, conflicting/unresolved or intentionally unreconstructed. Low-confidence responsibility is excluded from disciplinary analytics by default.

### 3.9 Availability and hosting

**Closed architecturally.**

v4.1 requires approved SLOs, dependency timeout/circuit-breaker behavior, cold-start constraints, graceful degradation and monitoring. Free/paid hosting is a budget/deployment decision subordinate to the SLO.

### 3.10 Test-data governance

**Closed architecturally.**

Production data cannot be mutable test fixtures. Synthetic identities are non-production and separate from eligibility. Fixtures bind policy/model revisions. Physical test phones/accounts have cleanup/recovery rules.

### 3.11 Canonical serialization and integrity

**Closed architecturally.**

`canonical-json.v1` defines normalization, ordering, time/decimal/null behavior, SHA-256 and versioning.

### 3.12 Inspection/completion correction

**Closed architecturally.**

Accepted evidence is immutable. Named-manager correction/void is append-only with original evidence preserved and second approval where disciplinary analytics are materially affected.

### 3.13 Notification grouping and escalation roles

**Closed architecturally.**

Grouped employee notices prevent alert floods. Manager escalation resolves effective capability/shift/on-call policy rather than a hard-coded name/device.

### 3.14 Exports and rollback with local work

**Closed architecturally.**

Exports are purpose-bound, redacted, watermarked and audited. Local-store migration and pending-work reconciliation are part of release admission; downgrade cannot silently discard work.

---

## 4. Capability coverage result

v4.1 provides an explicit architecture chapter or controlled gate for all major canon domains:

- operating purpose and product separation;
- employee/position/device/manager/contractor identity;
- location lifecycle;
- static schedule, requirements, workload, routes and ownership;
- employee Home, Schedule, Messages, Events and Feedback;
- native lifecycle, NFC, sessions, offline and GPS;
- restroom/exhibit completion and corrections;
- service occurrences, status and inspection readiness;
- issues, supplies, tickets and external work-order separation;
- manager Dashboard, Schedule, inspections, analytics and exports;
- Read Only projections;
- Messenger and notifications;
- events and approved impacts;
- guest reporting and Marketing review;
- contractor engagement/links/acceptance;
- AI, MCP, Moxie and diagnostics;
- security, retention, holds and disaster recovery;
- migration, release provenance, test-data governance and physical acceptance.

No valid v17 or actual-program domain located during current research is intentionally left to unspecified “later alignment.” Optional and future capabilities remain explicitly gated.

---

## 5. Authority consistency result

v4.1 consistently distinguishes:

- source fact versus manager/public command;
- compiler output versus operational evidence;
- owner versus active/actual cleaner;
- service occurrence versus notification intent;
- operational resolution versus displayed/opened/dismissed;
- event notice versus impact proposal versus approved requirement/ownership input;
- contractor assignment versus delivery/acceptance/actual worker;
- employee identity versus employment/position/device eligibility;
- completion evidence versus correction;
- readiness versus green timer status;
- custodial W.O. Submitted versus external maintenance completion;
- domain revision versus operational authority-set activation;
- role-specific projection versus canonical fact.

Read-side mutation is prohibited explicitly, including the deployed Memphis schedule-generation trigger pattern.

---

## 6. Foundation-first check

v4.1 does not prescribe local patches to legacy tables/pages as the final repair. It requires:

- isolated canonical design after architecture GO;
- migration confidence and legacy evidence preservation;
- shadow comparison;
- atomic authority-set cutover;
- legacy writer retirement;
- complete rollback;
- source/build/APK/physical proof.

Validated legacy algorithms and security mechanisms may be extracted and retained only behind the new contracts. Current hybrid runtime and duplicate authorities are not preserved as permanent compatibility.

---

## 7. Open gates and why they do not invalidate independent architecture review

The architecture deliberately does not invent:

- approved all-week schedule source/Sunday truth;
- exact person-bound rules;
- workload/frequency/route values;
- September 14/split/after-hours/cross-midnight policy;
- inspection-ready/severity/OPEN policy;
- contractor named-worker/acceptance policy;
- NFC payload/physical behavior;
- GPS calibration/use/retention;
- Messenger archive;
- manager tiers and AI/Moxie/diagnostic authority;
- guest data policy;
- retention holds/RPO/RTO/SLO;
- Karen acceptance threshold.

Each is classified in the gate registry by source, field, physical or policy evidence and explicitly blocks the dependent design/implementation stage. The architecture supplies the required model seam and does not require designers to guess.

Independent auditors must judge whether these gates are sufficiently bounded or reveal a remaining structural omission.

---

## 8. Known attack surfaces for independent auditors

Auditors should attempt to break:

1. authority-set compatibility and atomic rollback;
2. location split/merge/tag/history behavior;
3. service occurrence creation, next-cycle, split-window and correction;
4. overlapping/missing ownership and event/time collisions;
5. employee/position/device/contractor lifecycle races;
6. active session across ownership, shift, lunch, alerts, phone reassignment and app upgrade;
7. offline clock skew, stale snapshot, storage exhaustion and downgrade;
8. completion/issue/inspection/readiness truth tables;
9. scan/dismiss/open inability to resolve work;
10. notification grouping, recipient revalidation, ack failure and escalation;
11. Messenger stale-recipient and retention behavior;
12. event/AI/read-side mutation prohibition;
13. guest/contractor/public/AI/diagnostic privilege boundaries;
14. retention/hold/purge/FK/backup/restore;
15. migration confidence, mixed legacy/canonical consumer risk and rollback;
16. source-to-APK provenance and real Moto G/Fully Kiosk/Karen proof.

---

## 9. Internal verdict matrix

| Gate | Verdict |
|---|---|
| Send v4.1 to independent architecture auditors | **GO** |
| Treat v4.1 as approved final architecture | **NO-GO pending independent audit and replan** |
| Begin schema/component design | **NO-GO** |
| Begin implementation | **NO-GO** |
| Begin production migration/shadow writes | **NO-GO** |
| Build/install APK or change phones | **NO-GO** |
| Release | **NO-GO** |

---

## 10. Final internal conclusion

Unified Whole-System Architecture v4.1 is a coherent whole-program architecture candidate. It imports the validated ownership foundation without treating ownership as the entire product, and it addresses the v4 draft's identified structural gaps in one standalone replan.

No unresolved internal contradiction is known that should prevent independent architecture audit. This statement is deliberately narrow: it is not proof that the architecture is correct, complete or ready to implement.

**Final internal verdict:** GO for four independent first-pass architecture audits. All later gates remain closed.