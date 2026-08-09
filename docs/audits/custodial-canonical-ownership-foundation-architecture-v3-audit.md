# Memphis Zoo Custodial System — Canonical Ownership Foundation Architecture v3 Audit

**Status:** Read-only companion architecture audit  
**Prepared:** 2026-08-03  
**Plan audited:** `custodial-canonical-ownership-foundation-architecture-v3.md`, revision 3.0  
**Audit mode:** source/production evidence review only; no product or database changes  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Verdict

### **CONDITIONAL GO AFTER A NARROW REVISION 3.1**

### **NO-GO FOR IMPLEMENTATION OR PRODUCTION MIGRATION**

Revision 3 resolves every blocker identified in the revision-2 adversarial audit:

- input facts are separated from derived transitions;
- publication is atomic and outbox-based;
- security boundaries are explicit;
- operational requirement differs from OPEN;
- workforce identity and vacancies are modeled;
- status episodes are separate from delivery;
- time, retention, performance and observability are addressed.

The architecture is now structurally sound. A second adversarial pass found four remaining ambiguities. They are narrower than the revision-2 defects, but they should be corrected before the three independent model auditors receive the plan.

---

## 2. Findings

## HIGH 1 — The daily baseline resolves employees too early

Revision 3 defines the baseline as normal static policy, but `custodial_daily_baseline_intervals` includes:

- schedule subject; and
- “resolved employee when valid.”

Position-to-employee assignment is effective-dated operational data. Resolving it inside the immutable static baseline can force a new baseline when:

- an employee leaves;
- a position becomes vacant;
- a replacement is hired;
- a position assignment changes without changing normal weekly policy.

That would blur timeless normal policy with date-specific staffing state.

### Required correction

The baseline stores only the normal schedule subject and policy evidence.

The ownership compilation input snapshot separately captures:

- effective position assignment;
- employee operational eligibility;
- employee restrictions/capabilities;
- contractor engagement;
- absence/PTO.

The compiler resolves the subject to the effective employee/contractor for that service date. A replacement hire therefore changes the ownership revision without rewriting the historical static baseline.

---

## HIGH 2 — Operational requirement intervals are described as both an upstream authority and a compiled output

The architecture diagram places location-specific requirement intervals before the daily baseline, while the data model gives them:

- event/manager input references; and
- a compilation revision.

An approved event or explicit after-hours requirement is a date-specific change input. The final requirement interval derived from it is compiler output.

### Required correction

Separate:

- operating policy, static coverage and event/manager requirement inputs; from
- compiled operational requirement intervals tied to the ownership revision.

The static baseline may contain its normal requirement policy. The final requirement intervals are compiled in Stage 0 from all authoritative inputs and then used by later stages.

---

## HIGH 3 — `not_required` representation remains optional

Revision 3 says every non-required instant resolves `not_required` **or has no interval by the versioned contract**.

Allowing both storage and absence semantics invites consumers to implement their own fallback again.

### Required correction

Choose one contract.

Revision 3.1 should require the canonical resolver to return exactly one state for every queried active location/timestamp under a published revision:

- assigned employee;
- assigned contractor;
- OPEN;
- not required.

The implementation may store explicit not-required ranges or derive them from the published requirement ranges, but that choice is fixed in the resolver contract and consumers never interpret missing rows independently.

---

## MEDIUM 1 — One-time work requests need a first-class model

Revision 3 correctly distinguishes “clean this once” from “own this interval,” but no conceptual record is defined.

### Required correction

Add `custodial_work_requests` as a separate task/evidence concept with:

- request ID and idempotency key;
- location;
- requested employee/contractor or OPEN recipient selection;
- due/effective window;
- instruction;
- manager actor;
- notification intent;
- completion/session reference;
- state and audit timestamps.

A work request never changes canonical ownership unless a separate explicit ownership-transfer input is published.

---

## MEDIUM 2 — The compilation fingerprint should name the workforce snapshot explicitly

Revision 3 requires a canonical compilation input snapshot, but the baseline field inventory can still be read as the complete identity.

### Required correction

The compilation-run hash must explicitly include normalized digests for:

- baseline ID/hash;
- final operational requirement inputs;
- effective position assignments;
- employee eligibility and restrictions;
- absences/PTO;
- contractor engagements;
- manager overrides/transfers;
- event impacts;
- compiler and policy versions.

---

## MEDIUM 3 — Publication tests should include transaction fault injection

Atomic publication is well specified, but the proof list should explicitly test failure after each publication step.

### Required correction

Fault-injection tests must prove that failures after writing candidate intervals, transitions or outbox rows—but before pointer advancement/commit—leave:

- prior revision current;
- no claimable orphan outbox work;
- no mixed consumer result;
- candidate evidence safely rejected/rolled back according to transaction semantics.

---

## 3. Requirements that passed

The audit found no new contradiction in:

- static-first/exception-only behavior;
- exact location-level responsibility;
- 9:45/lunch ordering;
- absence and CoverAll minimum-change policy;
- shift-end inheritance;
- one/two/zero employee behavior;
- seasonal and after-hours policy;
- employee lifecycle and assignment epochs;
- security and RLS boundaries;
- atomic publication architecture;
- status episode routing and resolution;
- manager escalation independence;
- exact employee alert sequence;
- active-session-only GPS scope;
- durable ownership retention;
- shadow migration and rollback;
- Karen/Moto G/fleet acceptance requirements.

---

## 4. Revision 3.1 acceptance conditions

Revision 3.1 is acceptable for independent plan audit when it:

1. removes employee resolution from the immutable baseline;
2. makes final operational requirement intervals explicit compiler output;
3. establishes one canonical missing/not-required resolver contract;
4. adds first-class one-time work requests;
5. explicitly fingerprints workforce/date-specific inputs;
6. adds transaction fault-injection proof.

---

## 5. Final disposition

Revision 3 is not rejected. It is the first version that is coherent as one foundation.

The remaining changes prevent subtle re-coupling of static policy to current employees, prevent missing-row interpretation from becoming a new split authority, and keep manager tasks separate from responsibility transfer.

After revision 3.1 and one final internal re-audit, the plan should be frozen and sent independently to GPT-5.3, GPT-5.5 Pro and GPT-5.6 Pro.

No product, database, build, workflow, APK or phone change was made during this audit.
