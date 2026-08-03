# Memphis Zoo Custodial System — Canonical Ownership Foundation Architecture v3.1 Final Internal Audit

**Status:** Final internal architecture audit before independent model review  
**Prepared:** 2026-08-03  
**Plan audited:** `docs/audits/custodial-canonical-ownership-foundation-architecture-v3.md`, revision 3.1  
**Audit mode:** read-only architecture, source, and production-evidence review  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Verdict

### **GO FOR INDEPENDENT ARCHITECTURE AUDITS**

### **NO-GO FOR SCHEMA, BACKEND, FRONTEND, APK, PHONE, OR PRODUCTION IMPLEMENTATION**

The final internal pass found no unresolved structural contradiction in revision 3.1.

The plan now defines one coherent foundation instead of another collection of cooperating patches. It is sufficiently complete to freeze and challenge independently with the GPT-5.3 mechanical auditor, GPT-5.5 Pro operational/Karen auditor, and GPT-5.6 Pro integrated architecture/security auditor.

This GO authorizes only independent review of the plan. It does not authorize a database branch, migration, compiler build, consumer cutover, Codemagic run, APK installation, or phone change.

---

## 2. Closure of prior internal findings

### 2.1 Input facts versus derived transitions — CLOSED

Revision 3.1 separates:

- append-only authoritative date-specific inputs; from
- compiler-generated requirement and transition evidence.

Generated transitions cannot silently become inputs to the next compile.

### 2.2 Static policy versus current employee — CLOSED

The immutable baseline stores a schedule subject and normal policy, not the current replacement employee.

Effective position assignments, eligibility, absence, contractor capacity, and manager changes belong to the ownership compilation snapshot. A replacement hire can therefore change responsibility without rewriting historical static policy or renaming Michael/Daniel history.

### 2.3 Operational requirement versus OPEN — CLOSED

Final operational requirement intervals are compiler output. The canonical resolver must return exactly one state for every queried active location/timestamp under a published revision:

- assigned employee;
- assigned contractor;
- OPEN;
- not required.

Consumers cannot invent meaning from a missing row.

### 2.4 Atomic publication — CLOSED

One transaction writes:

- candidate intervals;
- validation evidence;
- transition records;
- superseding/new notification intents;
- the current publication pointer.

Delivery work cannot be claimed before commit. Fault-injection proof is explicitly required after every publication step.

### 2.5 Security boundary — CLOSED AT ARCHITECTURE LEVEL

Revision 3.1 requires forced RLS, revoked public execution, locked security-definer search paths, manager-scoped write authority, employee identity-scoped reads, Viewer read-only limits, and date/slot-scoped contractor links.

Implementation must prove these controls; the plan no longer omits them.

### 2.6 Position/vacancy/replacement lifecycle — CLOSED

The plan separates:

- permanent employee identity;
- timeless schedule position;
- effective-dated position assignment;
- contractor engagement;
- OPEN.

A vacant position cannot silently resolve to a departed employee.

### 2.7 Status episode versus notification delivery — CLOSED

A durable status episode is operational truth. Notification intents are recipient/delivery evidence.

A scan receipt or session start cannot resolve overdue. Only an accepted completion that changes authoritative location status—or a named manager correction—can resolve the episode.

### 2.8 One-time task versus ownership transfer — CLOSED

`custodial_work_requests` represents “clean this once” without changing responsibility. A separate explicit transfer input is required to change ownership.

### 2.9 Retention — CLOSED AT ARCHITECTURE LEVEL

Ownership versions, baselines, inputs, transitions, publications, sessions, inspections, tickets, and status-resolution evidence are durable operational history and are excluded from the 14-day communication policy and generic short schedule-window cleanup.

A later archive duration remains an explicit policy gate rather than an invented number.

---

## 3. Adversarial scenario review

### Normal static day

**Pass.** Baseline is create-if-absent, reads perform zero writes, and identical complete inputs reuse the same logical revision.

### Lunch spanning 9:45

**Pass.** The lower static phase changes at 9:45 while lunch remains the exclusive upper layer. Lunch end resolves to the post-9:45 owner rather than a captured stale owner.

### Absence

**Pass.** Only ineligible/uncovered locations are reconsidered. Unaffected static ownership is protected before proximity/workload optimization.

### CoverAll

**Pass.** Contractor capacity is a date-specific engagement and reviewed location-level exception. It cannot force a whole-day regeneration.

### Employee leaves before 9:45

**Pass.** Morning responsibility closes/inherits or becomes OPEN. The 9:45 phase resolves against current eligibility and never restores the departed employee.

### Two, one, or zero employees remain

**Pass.** Exact locations remain explicit. `All Locations` is prohibited. Required coverage without an eligible owner becomes manager-visible OPEN.

### Seasonal close and after-hours event

**Pass at architecture level.** Versioned operating policy and approved event inputs determine requirement intervals; pre-open custodial work is not confused with public opening.

The actual September 14 fixture still requires policy/source approval.

### Employee replacement

**Pass.** A new employee receives a new identity and effective position assignment. Historical employee records and prior ownership remain intact.

### Due/overdue owner changes before delivery

**Pass.** Episode, current ownership revision, device assignment epoch, and current status are revalidated immediately before send. A stale recipient intent is superseded and rerouted.

### Scan starts but work is not completed

**Pass.** Work-start state may suppress redundant employee repeats for a reviewed bounded period, but the episode remains unresolved and manager escalation remains operationally independent.

### Completion during escalation grace

**Pass.** Accepted completion resolves the episode and cancels employee/escalation delivery idempotently before provider send.

### Concurrent publication or failure mid-transaction

**Pass at architecture level.** Per-date locking, one current pointer, one transaction, and mandatory fault injection prevent mixed revisions and orphan delivery.

### Offline/sleeping employee phone

**Pass at architecture level.** Server truth is revision-based; the phone reconciles after wake/reconnect. The phone does not become an ownership authority.

---

## 4. Enforcement notes for independent auditors

These are not unresolved plan defects, but independent auditors should attempt to falsify them:

1. a normal static coverage rule must not silently bind to a date-specific CoverAll engagement;
2. position definitions/capabilities used by a schedule version must be immutable or included in its normalized snapshot/fingerprint;
3. mutable present-day employee/location records must not alter historical resolver results;
4. a superseded notification already visible on the old owner's phone must receive a durable cancellation/supersession state;
5. no generic missing-row fallback may exist outside the canonical resolver;
6. the shadow phase must not become permanent dual-write or dual-read authority;
7. employee Schedule must show current exact locations without imposing a route;
8. manager work requests must not mutate ownership unless a separate transfer input exists;
9. the no-cost isolated database route should be used unless the user explicitly approves any paid Supabase branch cost;
10. current Michael McWright and Daniel Morgan production identities must remain unchanged during the audit phase.

---

## 5. Remaining policy/evidence gates

The following are not guessed by revision 3.1 and remain required before isolated implementation:

1. approved static source artifact for Sunday and every weekday;
2. reviewed mapping from the current named schedule to schedule positions/person-bound rules;
3. late-day inheritance tie-break fixtures using actual zoo proximity and workload;
4. versioned operating-hours and after-hours policy, including September 14;
5. whether CoverAll engagements require a named worker or may remain slot-only;
6. manager UX distinction between ownership transfer and one-time work request;
7. archive/retention policy boundaries that preserve responsibility history.

An independent auditor may discover more. These seven gates are already known and must not be treated as coding details.

---

## 6. Independent audit requirements

Each auditor receives the same frozen plan commit and backend source commit but a distinct mission.

### GPT-5.3

Attempt to break:

- data-model constraints;
- compiler determinism;
- interval edge cases;
- atomic publication;
- idempotency;
- notification/status race handling;
- migration and rollback proof;
- test sufficiency.

### GPT-5.5 Pro

Attempt to break:

- actual static-schedule doctrine;
- absence/CoverAll behavior;
- 9:45/lunch/shift-end semantics;
- employee lifecycle;
- Karen comprehension;
- manager operational burden;
- fairness/accountability interpretation.

### GPT-5.6 Pro

Attempt to break:

- integrated architecture;
- security and authorization;
- production-data migration;
- canonical consumer cutover;
- notifications/NFC/GPS boundaries;
- release/rollback chain;
- shared blind spots across the plan and other auditors.

No auditor receives another auditor's report before completing its independent first pass.

---

## 7. Final internal disposition

Revision 3.1 is frozen conceptually for independent architecture audit.

### Internal architecture result: **GO FOR INDEPENDENT AUDIT**

### Implementation result: **NO-GO**

No product source, database object, workflow, build, APK, phone, or production data was changed by this audit.