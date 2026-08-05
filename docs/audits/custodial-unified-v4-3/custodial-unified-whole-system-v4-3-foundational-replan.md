# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.3 Foundational Replan

**Status:** Controlling plan for producing the standalone v4.3 architecture candidate  
**Input:** v4.2 six-report final reconciliation  
**Method:** Foundation-first; no patching or compatibility authority  
**Implementation authorization:** NONE

---

## 1. Objective

Produce a standalone Unified Whole-System Architecture v4.3 that retains v4.2's validated product and operational doctrine while replacing incomplete control-plane promises with complete normative architecture artifacts.

V4.3 succeeds only when an isolated schema, backend, native, manager, Messenger, Event, notification, migration or release designer can derive the required design without inventing:

- record identity or ordering;
- actor or service-principal identity;
- write authority;
- authority-set compatibility or activation;
- original-actor offline semantics;
- occurrence or location-transition behavior;
- legacy retirement;
- rollback or restore ordering;
- stage authorization.

---

## 2. Non-goals

This cycle does not:

- implement frontend, backend, native or database code;
- design production DDL;
- import the candidate workbook;
- execute generated seed SQL;
- mutate Supabase or Render;
- build or install an APK;
- change phones or Fully Kiosk;
- replace the validated employee product doctrine;
- generalize Custodial into the future zoo-wide platform before Custodial ships.

Reusable capabilities are recorded as future Operations Core candidates only after the Custodial contract is settled. They do not expand current scope.

---

## 3. V4.3 package architecture

The standalone package shall contain these controlling artifacts.

### 3.1 Package manifest and stage state

**Artifact:** `custodial-unified-v4-3-package-manifest.json`

Required fields:

- package ID and revision;
- source repository, branch and exact commit;
- artifact path, content digest, type, status and precedence;
- supersedes/superseded-by;
- evidence sensitivity;
- dependent gates;
- invalidation conditions;
- package lifecycle state;
- authorization matrix;
- generated timestamp and generator version.

The manifest is the only machine authority for package identity and stage authorization.

**Finite package states:**

- `DRAFT_REPLAN`;
- `REPLAN_AUDIT_READY`;
- `REPLAN_CORRECTION_REQUIRED`;
- `ARCHITECTURE_BUILD_READY`;
- `ARCHITECTURE_AUDIT_READY`;
- `ARCHITECTURE_CORRECTION_REQUIRED`;
- `ARCHITECTURE_ACCEPTED_FOR_ISOLATED_DESIGN`;
- `SUPERSEDED`;
- `QUARANTINED`.

A prose document cannot open a stage.

### 3.2 Architecture-object registry

**Artifact:** `custodial-unified-v4-3-architecture-object-registry.json`

Every normative object receives a stable ID and fields for:

- object name and class;
- owning domain;
- legitimate users and operational purpose;
- CAP IDs;
- record types and commands;
- allowed writers and resolvers;
- projections/APIs/products;
- principal/grant requirements;
- sensitivity and retention;
- migration/rollback disposition;
- failure behavior;
- automated proof;
- physical proof;
- gate dependencies;
- lifecycle status.

Object classes include:

- aggregate;
- command;
- fact/event/evidence/correction;
- record registry;
- principal/credential/grant;
- service principal;
- projection/API;
- worker/job/outbox;
- policy revision;
- compatibility adapter;
- migration/retirement item;
- release/restore assertion;
- physical fixture.

Orphan objects fail lint.

### 3.3 Complete joined capability trace

**Artifacts:**

- `custodial-unified-whole-system-capability-trace-v3.json`;
- generated Markdown projection;
- generated CSV projection.

Each CAP-001 through CAP-252 row contains separately inspectable fields:

1. capability ID and description;
2. disposition;
3. legitimate operational purpose;
4. actor and product;
5. exact canonical authority/command;
6. record type and version;
7. writer;
8. resolver;
9. API/projection/UI;
10. security boundary and exact grant;
11. sensitivity;
12. retention class;
13. migration class;
14. rollback class;
15. automated-proof IDs;
16. physical-proof IDs;
17. failure behavior;
18. gate IDs and design-impact class;
19. architecture section;
20. object-registry IDs;
21. evidence IDs.

The existing v2 trace is imported as source evidence, not edited into false completeness.

### 3.4 Reverse registry

Generated from the object registry and joined trace:

```text
object ID
→ CAP IDs
→ legitimate users
→ purpose
→ authority/records
→ failure behavior
→ disposition
→ automated proof
→ physical proof
→ gates
```

No separate hand-maintained reverse table may drift from the source registries.

### 3.5 Gate registry and design-impact matrix

**Artifact:** `custodial-unified-v4-3-gate-registry.json`

Required fields:

- gate ID;
- gate class;
- finite status;
- owner;
- required evidence;
- design impact: `VALUE_ONLY`, `COMPONENT_STRUCTURAL`, `SCHEMA_STRUCTURAL`, `MIGRATION_STRUCTURAL`, `PHYSICAL_ONLY`, or combinations;
- blocks stages;
- closure record;
- invalidation conditions.

A structure-changing gate must close before the affected design. “Structurally bounded” is not accepted without explicit proof that every remaining alternative maps to the same design structure.

### 3.6 V17 screenshot disposition ledger

**Artifact:** `custodial-unified-v4-3-v17-screenshot-disposition-ledger.md/json`

For every visible capability or UI element on pages 5–15:

- source page/plate;
- operational outcome;
- `RETAIN`, `REBUILD`, `RETIRE`, `OPTIONAL`, `FUTURE` or `HISTORICAL_ONLY`;
- current v4.3 product/domain;
- rationale and controlling CAP/object IDs.

This prevents historical UI from becoming accidental design authority.

---

## 4. Cross-domain record foundation

### 4.1 Record-type registry

**Artifact:** `custodial-unified-v4-3-record-type-registry.json`

Each record type/version specifies:

- stable type ID and semantic version;
- record class;
- aggregate and aggregate-sequence rules;
- authority-set binding;
- producer and consumer allowlists;
- canonical actor snapshot;
- idempotency namespace and collision behavior;
- canonical serialization and digest;
- compatibility and unknown-version behavior;
- correction/supersession rules;
- sensitivity/retention/hold;
- migration adapter and retirement;
- schema/fixture/projection rebuild tests.

The initial registry shall cover at minimum:

- workforce/position/device facts;
- static schedule source/publication;
- operating policy revisions;
- ownership compilation/publication;
- service occurrences;
- sessions and offline operations;
- completions/corrections;
- issues/tickets/work requests;
- readiness/inspection;
- Messenger;
- operational notifications;
- Events and impacts;
- contractor engagement/assignment/acceptance;
- Feedback/attachments;
- authorization decisions;
- worker/outbox attempts;
- migration/retirement assertions;
- release/restore/physical assertions.

### 4.2 Common envelope

V4.2's envelope doctrine is retained and made enforceable through the registry. Mandatory envelope fields include stable record type/version, record/aggregate identity, aggregate sequence, authority-set ID/generation, occurred/effective/recorded time, actor snapshot, authorization-decision ID, idempotency key, causation/correlation, producer version, sensitivity/retention and correction/supersession lineage.

### 4.3 Unknown and incompatible records

Unknown/incompatible records:

- never receive a local consumer interpretation;
- are preserved without destructive conversion;
- are quarantined with manager/operator evidence;
- cannot mutate authority or projections;
- remain recoverable after adapter admission or rollback.

---

## 5. Principal, credential, grant and tool foundation

### 5.1 Principal registry

**Artifact:** `custodial-unified-v4-3-principal-registry.json`

Principal types include:

- employee human;
- manager human;
- Read Only human;
- Marketing human/integration;
- contractor named worker;
- accountable contractor slot;
- device installation;
- backend worker classes;
- notification provider worker;
- AI/MCP/diagnostic tool service;
- migration operator;
- database owner;
- backup operator;
- restore operator;
- release operator;
- Device Security/access administrator;
- synthetic test principal.

Every service principal is independently revocable and has no implicit role inheritance from a shared service secret.

### 5.2 Grant and authorization-decision registry

Each privileged command requires:

- named principal;
- credential/session;
- exact capability and resource scope;
- authority-set admission;
- effective/expiration/revocation times;
- confirmation and second approval where required;
- immutable authorization-decision record;
- actor snapshot propagated to all resulting records.

### 5.3 MCP and executable tools

Target planes:

#### Compatibility/read plane

- anonymous or ordinary connected access only when approved;
- read-only registered tools;
- no GitHub writers;
- no generic SQL;
- no migration;
- no repair/production action;
- bounded data and response limits.

#### Privileged automation plane

- named Athanor/runner service principal;
- authenticated and independently revocable;
- exact repository/project/tool scope;
- reversible writes by default;
- protected spending and irreversible destruction;
- complete audit receipt;
- no model-inferred authority.

Anonymous full mode is `RETIRE`.

Generic application-runtime arbitrary SQL is `RETIRE` or isolated behind an admitted migration principal and release process.

A staged connection-preserving transition is required; production is not changed by the architecture cycle.

---

## 6. Operational authority-set protocol

**Artifacts:**

- `custodial-unified-v4-3-authority-set-registry.json`;
- `custodial-unified-v4-3-authority-set-transition-model.md/json`;
- producer/consumer compatibility matrix;
- activation/rollback fault matrix.

The authority set binds:

- schema and migration ledger;
- record registry;
- principal/grant/tool registry;
- policy revisions;
- ownership/occurrence/session contracts;
- backend/API/workers;
- notification/Messenger/Event contracts;
- employee/manager/Read Only client compatibility;
- native local-store format;
- Firebase/provider configuration;
- release tuple;
- rollback/restore target.

Required transition states:

- `DRAFT`;
- `VALIDATING`;
- `ADMITTED`;
- `ACTIVATING`;
- `ACTIVE`;
- `DEGRADED`;
- `ROLLBACK_PENDING`;
- `ROLLING_BACK`;
- `ROLLED_BACK`;
- `RETIRED`;
- `QUARANTINED`.

Required semantics:

- one fencing-token owner;
- no worker claims candidate-set work before activation commit;
- each request/session/queue/job/outbox/projection/migration assertion is pinned;
- old-client and old-work acceptance has explicit limits;
- adapters are bounded, observable and retirement-dated;
- mixed generations quarantine rather than guess;
- worker draining is lease-aware;
- full rollback restores one compatible set including local-work handling;
- material tuple changes invalidate prior green evidence.

---

## 7. Original-actor offline and session contract

### 7.1 Protected local operation

Every local operation captures at creation:

- operation/session/completion IDs;
- original employee principal snapshot;
- device installation and credential IDs;
- assignment epoch;
- authority set;
- location/tag revision;
- ownership revision;
- service occurrence identity/candidate;
- boot generation and trusted-time evidence;
- payload digest;
- idempotency and correlation IDs;
- local schema version.

### 7.2 Reconciliation outcomes

Server outcomes:

- `ACCEPTED_ORIGINAL_ACTOR`;
- `DUPLICATE`;
- `RETRYABLE`;
- `TERMINAL_REJECTED`;
- `CONFLICT_QUARANTINED`;
- `MANAGER_RECOVERY_REQUIRED`.

Current assignee substitution is prohibited.

### 7.3 Device reassignment/revocation

Reassignment, departure, credential rotation, lost-phone quarantine and manager takeover inspect active sessions, drafts and queues before future authority changes. Legitimate historical work remains bound to the original actor. New authority cannot rewrite old work.

---

## 8. Service occurrence and location transition

### 8.1 Service occurrence

V4.3 shall provide a complete command/state table for:

- create requirement occurrence;
- start/attach session;
- partial/full satisfaction;
- concurrent duplicate work;
- urgent overlap;
- accept/reject completion;
- correct/void/reopen;
- create corrective occurrence;
- create exactly one next occurrence;
- notification supersession;
- readiness/inspection consequences.

### 8.2 Location lifecycle

V4.3 shall define one effective-time aggregate for:

- rename;
- temporary closure/reopen;
- retirement;
- split;
- merge;
- tag replacement/revocation;
- active sessions;
- queued offline operations;
- ownership/occurrences;
- issues/tickets/inspections;
- Event/guest relations;
- analytics/history;
- rollback.

Aliases cannot determine historical satisfaction or silently redirect delayed work.

---

## 9. Legacy authority retirement

**Artifact:** `custodial-unified-v4-3-legacy-authority-retirement-manifest.json`

Inventory generation covers:

- repository/source writers and readers;
- database objects/definitions/owners/grants/callers;
- triggers and cron;
- direct browser/native database paths;
- backend routes and workers;
- MCP/AI/diagnostic tools;
- repair and release workflows;
- external providers;
- rollback and compatibility paths.

Each entry includes:

- stable object ID;
- exact identity/digest;
- domain and effect;
- current callers;
- target authority;
- disposition;
- disable/fence sequence;
- rollback role;
- negative tests;
- removal evidence;
- retirement gate.

No unregistered writer, resolver or side-effecting reader is allowed at cutover.

---

## 10. Recovery, retention and release

### 10.1 Restore bundle

The restore bundle binds:

- source and migration history;
- schema/catalog fingerprint;
- database snapshot;
- object storage and metadata;
- authority set;
- principal/tool/record registries;
- configuration/key references;
- queues, leases and outbox reconciliation;
- retention, purge, redaction and hold ledgers;
- release tuple and signer;
- provider reconciliation state;
- physical/fleet state.

### 10.2 Activation after restore

Service remains unavailable until:

- database and objects reconcile;
- required keys/configuration are present;
- purge/hold reconciliation passes;
- queue/lease/provider reconciliation passes;
- admitted authority set activates;
- clients can safely reconcile or quarantine local work.

### 10.3 Build 22

Build 22 remains retained, but rollback acceptance requires a bound test after an admitted successor is installed with active and queued work. If Android/version/local-store constraints make safe downgrade impossible, a replacement rollback strategy is researched before Eric decides Build 22 retirement.

---

## 11. Operational exception contracts

V4.3 must close these without adding ordinary employee complexity.

### NFC recovery

- no normal Scanner tab;
- manager-supported constrained fallback only under registered failure condition;
- exact location allowlist;
- employee identity remains device-derived;
- fallback evidence is recorded;
- cannot bypass active-work conflict or impersonate another employee.

### Communications

One classification matrix separates:

- ordinary direct message;
- group/Memphis message;
- manager broadcast;
- Event notice;
- operational alert;
- escalation;
- emergency instruction.

Each class has source, audience, acknowledgement, retention, audio/presentation and work-effect rules.

### Notification accessibility

A non-audio equivalent carries the same content, priority, timing and acknowledgement semantics as spoken alerts and is physically tested.

### Contractor failure

Commands/states include reject, partial accept, abandon, substitute, reassignment, link loss/expiry/revocation, unreachable and complete. The named-worker versus accountable-slot and acceptance policies remain Eric/management decisions.

### Purge/restore ledger

Every purge/redaction/hold action creates durable evidence used to prevent restored data from silently reappearing.

---

## 12. Research and policy closure

### Immediate read-only research

May proceed in parallel:

- complete writer/resolver/trigger/cron/API/tool graph;
- source route/asset/direct-write inventory;
- schema owner/grant/search-path/RLS inventory;
- migration confidence map;
- Build 22 and current native compatibility inventory;
- device/tag/Fully Kiosk observation plan;
- synthetic fixtures for authority sets, offline reassignment, occurrence concurrency, location transitions, alerts, Messenger, Events and rollback.

### Structure-changing decisions required before affected design

- approved schedule source, Sunday, shifts, positions/person-bound rules;
- lunch/9:45 restoration, operating hours, September 14, split/cross-midnight windows;
- `OPEN` response/escalation;
- readiness/severity/inspection/reopen;
- contractor identity/acceptance;
- manager capability tiers;
- Messenger archive/reappearance/Memphis semantics;
- GPS purpose/retention/dispute/personnel use;
- retention/holds/exports/analytics use;
- SLO/RPO/RTO;
- physical/Karen thresholds.

The decision ledger shall present researched options and structural consequences, not ask Eric to invent engineering mechanics.

---

## 13. Validation suite

The v4.3 architecture package is not audit-ready until automated validation proves:

1. package manifest and hashes resolve;
2. CAP-001–CAP-252 exactly once;
3. every joined trace field is nonempty or explicitly not applicable;
4. every referenced object/record/principal/gate/evidence/proof resolves;
5. every object maps to CAPs, users and purpose;
6. every CAP maps to exact authority, records, writers/resolvers and proofs;
7. no contradictory stage authorization exists;
8. no structure-changing gate is mislabeled value-only;
9. record producer/consumer compatibility is complete;
10. authority-set dependency/transition matrices are complete;
11. original-actor offline transition fixtures are complete;
12. occurrence and location state models are deterministic;
13. every legacy authority has a disposition;
14. rollback/restore sequence is complete;
15. all changed artifacts invalidate prior green evidence.

Physical-proof references must resolve to a frozen future test plan but are not executed during architecture replan.

---

## 14. Replan execution order

1. Generate package/state schema.
2. Generate architecture-object inventory from v4.2 §§5–38.
3. Build the full joined trace and reverse registry.
4. Build record-type registry.
5. Build principal/service-principal/grant/tool registry.
6. Build authority-set dependency, compatibility and transition registries.
7. Build offline/session/completion, occurrence and location state models.
8. Complete source/schema/runtime authority inventory and retirement manifest.
9. Close operational exception contracts.
10. Build gate-to-design-impact and policy decision ledgers.
11. Build rollback/restore contract.
12. Run lint and adversarial replan audit.
13. Correct the replan.
14. Write standalone Unified Architecture v4.3.
15. Internally audit, freeze and independently audit v4.3.

No later step may hide an incomplete earlier foundation behind prose.

---

## 15. Exit criteria for architecture build authorization

The replan may advance to writing standalone v4.3 only when:

- no replan BLOCKER remains;
- all controlling artifact schemas and ownership are explicit;
- all accepted v4.2 findings have an exact closure artifact;
- all rejected findings are recorded with evidence;
- every open policy gate has an impact class;
- no schema/component designer is assigned unresolved architecture work;
- the two-week canary plan remains dependency-correct.

---

## 16. No-change statement

This replan authorizes documentation, registries, read-only research, fixtures and audits only.

It authorizes no production or implementation change.