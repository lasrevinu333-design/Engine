# Memphis Zoo Custodial System — Canonical Operations Architecture Audit, Pass 2

**Status:** Internal adversarial audit of Architecture v2  
**Prepared:** 2026-08-03  
**Documents audited:**

1. `docs/audits/custodial-canonical-operations-architecture-plan.md`
2. `docs/audits/custodial-canonical-operations-architecture-plan-audit.md`
3. `docs/audits/custodial-canonical-operations-architecture-replan-v2.md`

**Implementation authorization:** none

---

## 1. Pass-2 verdict

### **CONDITIONAL GO FOR COMPONENT-LEVEL DESIGN**

### **NO-GO FOR IMPLEMENTATION OR INDEPENDENT FINAL ARCHITECTURE FREEZE**

The v2 architecture now resolves every ambiguity identified in the first internal audit. A consumer no longer needs to invent the winner for simultaneous events, historical correction, active-session ownership changes, offline reconciliation, contractor revisions, notification dismissal, device reassignment or cutover.

The architecture is coherent enough to proceed into schema and native-component design.

It is not yet ready to give the three external auditors as a frozen final architecture because several requirements still exist only as high-level contracts. The next design phase must prove that the contracts can be implemented with exact database constraints, APIs and Android components without reintroducing duplicate authorities.

---

## 2. Pass-1 finding reconciliation

| Pass-1 finding | v2 disposition | Result |
|---|---|---|
| Simultaneous transition ordering | Exact stages, authority rules, half-open intervals and conflict rejection defined | PASS |
| Bitemporal correction | Valid-time and recorded-time assertions defined | PASS |
| Active session across ownership change | Session binding and cross-ownership states defined | PASS |
| Offline ownership reconciliation | Protected ownership snapshot and server outcomes defined | PASS |
| Location operational windows | Versioned location rules and precedence defined | PASS |
| CoverAll link lifecycle | Assignment revisions and automatic link revocation defined | PASS |
| Notification dismissal versus resolution | Four independent state machines defined | PASS |
| GPS privacy/retention | Collection, access, summary retention and permission behavior defined | PASS, policy duration pending |
| Override authority | Full Access/Read Only/employee roles and retroactive controls defined | PASS |
| Atomic cutover/rollback | One read-version pointer and no permanent dual writes defined | PASS |
| Vacant positions | First-class position identity defined | PASS |
| Schedule-change notification grouping | One employee/revision intent with exact change sections defined | PASS |
| Event interaction | Notice, workload exception and ownership transition separated | PASS |
| Device reassignment | Protected transactional operation defined | PASS |
| GPS calibration | Versioned field-calibration publication defined | PASS |
| Recovery vocabulary | Central approved employee text defined | PASS |

---

## 3. Requirements challenged again

### Static schedule remains normal authority

**Pass.** The 9:45 normal phase is part of the published static schedule. Dynamic behavior is triggered only by published exceptions or deterministic transitions.

### Absence and CoverAll do not rewrite unrelated work

**Pass in architecture.** Hard constraints and lexicographic objectives preserve unaffected static ownership before route and load optimization.

### Mixed groups do not move exhibits during restroom rebalance

**Pass.** Member-scoped authoring expands to location intervals before any transition or solver operation.

### Lunch is exclusive

**Pass.** Base intervals close/suspend while cover intervals are active, and restoration is conditional on continuing eligibility.

### Shift-end inheritance works before 9:45

**Pass.** Shift-end is an independent chronological stage.

### One employee remaining

**Pass.** Exact locations are transferred; `All Locations` is prohibited.

### No employees remaining

**Pass.** Required locations become explicit `OPEN`; outside operational windows they become `not_required`.

### Employee replacement does not rewrite history

**Pass.** Vacant positions and permanent employee identities are separate.

### CoverAll has no employee phone

**Pass.** Contractor slot ownership and secure assignment revisions are independent of employee push registration.

### Active work survives ownership change

**Pass.** Session remains valid without extending ownership, and the manager receives the cross-ownership context.

### Offline work does not fabricate ownership

**Pass.** Server may accept cleaning evidence while retaining an ownership conflict; work acceptance does not alter historical responsibility.

### Dismissed alert remains operationally unresolved

**Pass.** Presentation, acknowledgement, work and escalation states are independent.

### GPS only during session

**Pass.** Collection boundaries and role access are explicit.

### Historical correction remains auditable

**Pass.** Bitemporal assertions preserve what was known and corrected truth.

### Cutover cannot split consumers

**Pass.** One protected read-version pointer controls all ownership consumers.

### Karen sees minimal language

**Pass at contract level.** Employee recovery vocabulary is centralized and technical detail remains manager-only.

---

## 4. Remaining design blockers before architecture freeze

## BLOCKER A — Exact canonical database schema and constraints

The architecture names required records but does not yet supply exact schema-level design for:

- schedule versions;
- positions and occupants;
- daily baseline revisions;
- exception families/revisions;
- bitemporal ownership assertions;
- exclusion constraints for overlapping intervals;
- publication transactions;
- canonical resolver signatures;
- operational notification intents and state transitions;
- active-session GPS summaries;
- contractor assignment revisions.

The schema design must prove that invalid states are rejected by the database rather than merely discouraged by application code.

## BLOCKER B — Exact deterministic compiler contract

The architecture defines objectives and stages but still needs:

- typed compiler inputs and outputs;
- deterministic tie-breaks for candidate scoring;
- load-point source and rounding;
- route/proximity source and missing-data behavior;
- exact diff format;
- conflict report format;
- compiler version/fingerprint rules;
- replay and rollback mechanics.

## BLOCKER C — Exact native Android component graph

The architecture requires native ownership but does not yet identify the final components and lifecycle for:

- NFC intake;
- protected route dispatch;
- notification transport/presentation;
- TTS completion;
- active-session fused location;
- foreground-service behavior;
- boot/process restoration;
- Fully Kiosk handoff;
- permission health;
- durable native-to-WebView state.

A component graph must prove there is one owner, not another collection of cooperating page scripts.

## BLOCKER D — Exact APIs and consumer cutover contracts

The system still needs versioned request/response designs for:

- current/historical owner resolution;
- employee current Schedule;
- manager baseline/effective Schedule;
- schedule preview/publish;
- ownership-change notifications;
- employee operational Events;
- active-session status and GPS evidence;
- contractor assignment revisions;
- device reassignment preflight/commit;
- Feedback outbox acknowledgement.

## BLOCKER E — Source-data reconciliation

The actual approved static schedule must be reconstructed from:

- uploaded/static source;
- current group templates;
- stale Sunday derived rows;
- later approved refinements;
- restrictions;
- shift/lunch changes;
- operating-hours policy.

No schema or compiler can make conflicting source data correct automatically.

---

## 5. Empirical prerequisites that do not block component design

These remain mandatory before implementation acceptance but can be completed while component designs are audited:

- direct GPS calibration for every NFC location;
- approved raw GPS retention duration;
- confirmed location-specific operating windows;
- manager-approved CoverAll acceptance workflow;
- physical NFC behavior on Moto G 2025/Fully Kiosk;
- Android TTS/chime timing proof;
- Karen field testing;
- fleet enrollment and notification proof.

---

## 6. Next authorized work

Documentation and read-only research may continue in this order:

1. canonical database/schema design;
2. deterministic compiler and resolver specification;
3. native Android/NFC/notification/GPS component design;
4. versioned API and consumer contract design;
5. migration/shadow/rollback design;
6. source-data reconciliation report;
7. third internal integrated architecture audit;
8. only then freeze a commit for the three independent auditor tabs.

Product implementation remains paused.

---

## 7. Pass-2 conclusion

The architecture no longer contains a known conceptual contradiction. It now preserves the program’s true intent without treating the original implementation or Final Report as automatically correct.

The next risk is not conceptual direction; it is whether the exact schema, compiler, APIs and native Android component graph can enforce the architecture without loopholes.

No product, database, build, APK or phone change was made or authorized by this audit.