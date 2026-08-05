# Memphis Zoo Custodial Program — V4.2 Six-Report Final Reconciliation

**Status:** Controlling disposition of the v4.2 independent-audit cycle  
**Prepared:** 2026-08-05  
**Frozen architecture target:** `lasrevinu333-design/Engine@be01c7b382da14e0e98375ee7a03e88c26ee598c`  
**Actual-program target:** `lasrevinu333-design/Engine@8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Backend target:** `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7`  
**Authorization:** Architecture reconciliation and bounded replan only

---

## 1. Evidence set

| ID | Report | SHA-256 | Role |
|---|---|---|---|
| R-53 | GPT-5.3 Spark v4.2 audit | `d270a8d57c4b0ab086c1a20a87437b934a9596acc8ca2ce999f0c665718317cd` | Mechanical/security/concurrency attack |
| R-55I | GPT-5.5 Instant v4.2 audit | `9bb2b4eda4e51e4e0e0cf8cd9455b3d30c04e15282a8eaa6e91ac02b630c0249` | Capability, evidence and omission attack |
| R-55P | GPT-5.5 Pro v4.2 audit | `25215148ec99a5bac51243923f261368de47d479fb878de366f405e720609f3d` | Operations, Karen, manager and contractor attack |
| R-56P | GPT-5.6 Pro v4.2 audit | `54574863a0f893513d9300708e11e30b9b25ba9f6df9c3e4f900ab28305dcad4` | Integrated architecture, security, migration and recovery attack |
| R-MECH | Mechanical preflight | `aa990dbd1d3bee60009a588ceef83ce8884d219d2d00e74a3418a765b516d3f2` | Deterministic CAP/path/hash/section/gate validation |
| R-14D | Provisional two-week delivery map | `2b6751878d53d76cdcba275c4bcbf9a66517bb42fac10d06153c3cc249d2ce36` | Dependency, parallelism and canary sequence |

The browser reports and Codex reports independently observed the same frozen architecture, actual program, backend, 26-page PDF and candidate workbook.

---

## 2. Reconciliation method

Findings are not accepted by vote.

Disposition follows:

1. Eric's fixed product and operating decisions;
2. field-workflow invariants;
3. exact frozen source and read-only production truth;
4. deterministic mechanical checks;
5. independently supported architecture reasoning;
6. inferences clearly separated from proven facts.

A narrower deterministic test controls the exact mechanical question it measured. It does not overrule broader semantic findings outside that measured scope.

---

## 3. Final verdict

> **V4.2 is retained as the correct whole-system and product direction but receives NO-GO as the final design-authorizing architecture. A bounded standalone v4.3 foundational rebuild is required.**

This is not a whole-program restart.

### Authorization matrix

| Activity | Result |
|---|---|
| Read-only evidence/source/schema/field research | **GO** |
| Bounded v4.3 architecture replan | **GO** |
| Replan audit and correction | **GO** |
| Final architecture approval | **NO-GO** |
| Schema design | **NO-GO** |
| Component design | **NO-GO** |
| Frontend/backend/native implementation | **NO-GO** |
| Database writes, shadow writes or migration | **NO-GO** |
| APK build/sign/install | **NO-GO** |
| Phone/Fully Kiosk/canary/fleet/release | **NO-GO** |
| Build 22 retirement | **NO-GO** |

GPT-5.5 Pro's `CONDITIONAL GO — architecture candidate only` is consistent with this result: it retains v4.2 for reconciliation while prohibiting every downstream stage. GPT-5.3 Spark, GPT-5.5 Instant and GPT-5.6 Pro use `NO-GO` because the question was whether final architecture or downstream design could begin.

---

## 4. Mechanical findings — controlling disposition

The mechanical preflight proved:

- 252 main-trace rows;
- CAP-001 through CAP-252 each appears exactly once in that main table;
- no missing, duplicate or extra main-table CAP ID;
- all shorthand resolves through the code registry;
- all referenced architecture sections exist;
- all referenced gates exist;
- all 13 v4.2 package paths resolve;
- all 13 working blob hashes match the manifest;
- every one of the 13 broad reverse-registry rows maps to CAP IDs;
- all frozen commits resolve;
- the audit branch and frozen commit are identical.

### Rejected mechanical claims

| Claim | Disposition | Reason |
|---|---|---|
| Spark B1: CAP trace contains duplicate CAP IDs | **REJECTED** | Spark counted all textual CAP references, including ranges and reverse-registry references, rather than only the main trace rows. |
| CAP numbering is unproven | **SUPERSEDED** | R-MECH supplies deterministic proof. |
| Section, shorthand and gate references are unproven | **SUPERSEDED** | R-MECH supplies deterministic proof. |
| Package paths or listed hashes are broken | **REJECTED** | R-MECH found zero path or hash failures. |
| CAP lint requires physical proof | **REJECTED** | Documentation lint is automated evidence. Physical fixtures are required only for device-dependent capabilities referenced by the trace. |

### Mechanical proof does not close semantic trace completeness

The current trace remains an eight-column architecture index. Architecture §3.3 requires separately inspectable fields such as legitimate purpose, actor, exact command/authority, record type/version, writer, resolver, API/projection/UI, grant, rollback, separate automated proof, separate physical proof and failure behavior.

Likewise, the 13-row reverse table proves broad domain-to-CAP coverage; it does not enumerate every normative record type, command, state, principal, service, projection, adapter, worker, tool, compatibility mechanism, rollback element and physical fixture.

Therefore:

- **mechanical integrity: PASS**;
- **full normative joined trace: INCOMPLETE**;
- **complete object-by-object reverse registry: INCOMPLETE**.

---

## 5. Strengths retained without redesign

All reports materially support retaining these doctrines:

1. one connected operational evidence system rather than a screen collection;
2. individual location/effective interval as final ownership unit;
3. static schedule as normal authority and dynamic behavior as exception-only;
4. separate responsible owner, active cleaner and actual cleaner;
5. service occurrence as root for due, overdue, satisfaction, correction and reopen;
6. private Android employee product;
7. four-button Employee Home: Schedule, Messages, Events, Feedback;
8. enrolled-device employee identity;
9. ambient NFC and no normal Scanner/QR workflow;
10. assigned areas rather than phone-directed walking routes;
11. plain Karen-safe wording and no hidden technical interpretation;
12. Event information separated from approved operational impact;
13. contractor capacity separated from employee identity;
14. Read Only as a separate Dashboard/Events projection;
15. notification interaction separated from work resolution;
16. exact two-cycle audio and already-visible stale cancellation;
17. confidence-, context- and dispute-aware analytics;
18. immutable correction/history doctrine;
19. source-to-APK provenance and signer controls already present;
20. physical Moto G/Fully Kiosk/NFC/offline/audio evidence as a release gate;
21. Build 22 retained until later rollback evidence is accepted.

---

## 6. Accepted architecture BLOCKER findings

### V43-B01 — Architecture governance, joined trace and reverse object registry

**Accepted from:** R-55I, R-56P; partially supported by R-53.  
**Mechanical correction:** main CAP numbering, paths, hashes, sections and gate references already pass.

Required foundational rebuild:

- one protected package manifest as the identity/status/supersession authority;
- one finite stage-state enum with one meaning per state;
- one stable architecture-object registry;
- one complete joined CAP-001–CAP-252 trace satisfying §3.3;
- one complete object-to-CAP reverse registry;
- one linter that rejects missing fields, orphan objects, contradictory authorization and stale evidence.

Independent prose documents may describe state but may not independently authorize stages.

### V43-B02 — Cross-domain record-type and transaction registry

**Accepted from:** R-56P, R-55I.

V4.2 defines a useful common envelope but lacks the complete controlling registry of:

- record type and version;
- class and aggregate;
- owner;
- allowed producers and consumers;
- ordering and concurrency;
- canonical serialization;
- idempotency namespace;
- compatibility range;
- replay behavior;
- migration adapter;
- retention/sensitivity;
- retirement;
- schema and tests.

A shared base table or decorative `record_type` field is not sufficient.

### V43-B03 — Distributed authority-set control plane

**Accepted from:** R-56P.

V4.2's doctrine is correct but must be completed with:

- immutable dependency graph;
- producer/consumer compatibility matrix;
- exact activation commands and records;
- fencing-token owner and transaction;
- prior-set acceptance limits;
- stale-client admission matrix;
- worker lease drain/transfer rules;
- mixed-generation quarantine;
- partial-deployment decision table;
- rollback ordering across schema, backend, workers, configuration, Firebase, clients and protected local stores.

Adding an `authority_set_id` column without these semantics is prohibited.

### V43-B04 — Principal, service-principal and executable-tool authority

**Accepted from:** R-56P, R-53.

Frozen backend source defaults tokenless `/mcp` access to a full non-read-only connector session and exposes real GitHub/Supabase writers. Whether live Render overrides that unsafe default remains unproven.

The rebuild must:

- retire anonymous full write mode;
- preserve convenient anonymous/connected read access only through a bounded read-only plane;
- give every worker/tool class a named, revocable service principal;
- bind exact capability, resource, authority set and actor propagation;
- separate application runtime, migration, database-owner, backup, release, Device Security and manager authority;
- remove generic application-runtime arbitrary SQL authority;
- prove production configuration and external endpoint behavior.

A one-variable toggle is containment evidence, not the final foundation.

### V43-B05 — Original-actor offline operation and completion acceptance

**Accepted from:** R-56P.

`commit_cleaning_workflow(...)` can create a first server session during later synchronization and resolve the employee from the phone's current assignee. The queued operation does not require the original assignment epoch, original authority set, original ownership revision, occurrence or immutable actor snapshot.

The protected local operation must carry and bind:

- original employee principal;
- credential and assignment epoch;
- device identity;
- session identity;
- location and tag revision;
- ownership revision;
- occurrence candidate/identity;
- authority set;
- trusted-time/boot evidence;
- payload digest and idempotency keys.

Server outcomes are limited to valid original-actor acceptance, duplicate, bounded retry, terminal rejection or explicit conflict/quarantine. Attribution to the current later assignee is impossible.

### V43-B06 — Complete legacy authority retirement

**Accepted from:** all four auditors.

A complete source/schema/runtime inventory is required for:

- tables, views and projections;
- functions and overloads;
- SECURITY DEFINER settings and search paths;
- grants and callers;
- triggers;
- cron jobs;
- backend routes and workers;
- frontend/native direct writers;
- MCP/AI/diagnostic tools;
- workflow and repair scripts;
- rollback writers and compatibility readers.

Every object receives one signed disposition: `RETAIN`, `REBUILD`, `RETIRE`, `MIGRATION-ONLY`, `ROLLBACK-ONLY`, `FUTURE` or `QUARANTINED`.

Cutover admission fails on any unregistered writer or resolver.

### V43-B07 — Executable whole-system rollback and restore

**Accepted from:** R-56P; supported by R-53.

Build 22 possession is not yet proof of a safe rollback after a higher-version installation with active or queued work. Current restore tooling can commit database state before object replay completes.

V4.3 must define:

- one self-contained signed restore bundle;
- exact source, migration ledger, schema fingerprint, authority set, extensions, configuration, release tuple, keys and provider reconciliation state;
- staged database/object restoration before service activation;
- purge/hold reconciliation;
- queue/lease and external side-effect reconciliation;
- interrupted-restore retry/rollback;
- Android/local-store/Device Owner/Fully Kiosk rollback handling;
- measured RPO/RTO and physical rollback proof.

Build 22 remains retained but unproven as executable rollback.

---

## 7. Accepted HIGH architecture findings

| ID | Finding | Required v4.3 closure |
|---|---|---|
| V43-H01 | Service-occurrence model not complete as executable command/state contract | Full command taxonomy, expected sequence, concurrency, satisfaction, correction/reopen and exactly-one next occurrence |
| V43-H02 | Location transition is prose rather than one cross-domain transaction | Rename/close/retire/split/merge/tag/in-flight/offline/rollback state model |
| V43-H03 | Gate state and design impact are ambiguous | Finite state vocabulary plus value/component/schema/migration/physical impact matrix |
| V43-H04 | NFC failure recovery is under-specified | Manager-supported constrained recovery command; no normal Scanner or QR product; evidence marker and physical matrix |
| V43-H05 | Notification provider and presentation lifecycle is incomplete | Exactly-once intent, duplicate-tolerant presentation, provider reconciliation, child/group semantics, visible stale replacement, accessibility equivalent |
| V43-H06 | GPS is not enforceably active-session-only in current implementation | Session-bound acquisition and storage; deny absent/closed/wrong-device/wrong-location/cross-set requests |
| V43-H07 | Messenger hide/delete/reappearance/hold/restore semantics incomplete | Participant-scoped visibility, external push, reappearance, purge, legal hold and restore rules |
| V43-H08 | Event revision/impact/cancellation needs complete concurrency contract | Expected revision, candidate/notice/proposal/approval/impact/reversal, no read/save-side mutation |
| V43-H09 | Contractor failure lifecycle incomplete | Reject, partial accept, abandon, substitute, link loss, named worker vs accountable slot, OPEN consequences |
| V43-H10 | Operational communications lack one classification matrix | Direct message, broadcast, Event notice, operational alert, escalation and emergency instruction taxonomy |
| V43-H11 | Notification hearing-accessible equivalent not normative | Equivalent content, timing, priority, acknowledgement and physical acceptance |
| V43-H12 | Restore-purge reconciliation lacks canonical ledger | Durable purge/redaction/hold ledger included in restore admission |
| V43-H13 | Readiness/inspection/reopen structure remains policy-dependent | Approved truth table and correction consequences before relevant design |
| V43-H14 | Read Only product and current employee shell require structural separation | Dedicated projections/assets/APIs; retire weather, attendance, Scanner, route and technical wording from employee build |
| V43-H15 | Search-path/grant/service-role hardening requires complete inventory | Object-level ownership, search-path and grant registry with negative tests |

---

## 8. Implementation and physical findings retained as later gates

These are not reasons to reject the retained product architecture; they are absolute later release gates:

- current employee shell conflicts with the four-button Home;
- current source still exposes Scanner/QR/route/weather/attendance/technical wording;
- ambient NFC is not yet physically proven across lock, all screens, active work, offline, reboot and process death;
- active timer/form/draft persistence is not physically proven;
- exact chime/speech/chime/speech/silence behavior is not physically proven;
- stale visible alert replacement is not physically proven;
- one native notification owner is not yet proven;
- Read Only field/route/asset isolation is not implemented/proven;
- manager Event, contractor and scheduling workflows are not implemented under the new contracts;
- candidate workbook remains non-authoritative;
- physical rollback with pending local work is unproven.

---

## 9. Policy and research findings

### Engineering obligations — Eric does not design these

- record envelope/registry mechanics;
- authority-set fencing and activation;
- principal/service-principal model;
- idempotency and transaction boundaries;
- original-actor offline identity;
- occurrence concurrency;
- location-transition mechanics;
- writer/resolver inventory;
- secure search paths and grants;
- notification provider reconciliation;
- restore-bundle mechanics;
- trace/object lint;
- release-tuple validation.

### Genuine Eric/management decisions after research

- approved static schedule source/effective date;
- Sunday and disputed shifts;
- positions versus approved person-bound rules;
- lunch and 9:45 restoration behavior;
- normal, seasonal, split and cross-midnight hours;
- `OPEN` response/escalation;
- workload, frequency and route values after field evidence;
- readiness, severity, inspection and reopen policy;
- contractor named worker versus accountable slot and acceptance requirement;
- manager capability tiers and dual control;
- Messenger archive/reappearance/Memphis semantics;
- GPS purpose, retention, dispute and personnel-use limits;
- retention, holds, exports and analytics personnel use;
- SLO/RPO/RTO and budget tradeoffs;
- physical/Karen pass thresholds;
- guest activation, AI write authority and Moxie disposition;
- Build 22 retirement.

---

## 10. Report-by-report disposition

### GPT-5.3 Spark

- Verdict scope retained: final architecture and design are NO-GO.
- MCP and legacy-writer findings accepted.
- CAP-duplicate blocker rejected.
- Physical proof requirement for CAP lint rejected.
- Search-path, rollback and false-confidence concerns retained subject to exact inventory.

### GPT-5.5 Instant

- Incomplete joined trace and object-level reverse registry accepted.
- Gate-state inconsistency, NFC recovery, retirement inventory, contractor lifecycle, accessibility, purge ledger and communication classification accepted.
- Claims that CAP numbering/sections/gates lacked machine proof are superseded by R-MECH.
- Broad domain coverage and valid v17 preservation accepted.

### GPT-5.5 Pro

- `CONDITIONAL GO — candidate only` accepted as compatible with final NO-GO.
- Product doctrine, Karen model and operational-strength findings retained.
- Workbook, current shell, physical NFC/session, legacy writer, notification and contractor/OPEN blockers retained at their proper stages.
- Existing source defects are not automatically architecture defects where v4.2 already orders rebuild/retirement, but they remain release blockers.

### GPT-5.6 Pro

- Bounded foundational rebuild accepted.
- Evidence/control plane, MCP, offline identity, authority set, record registry and rollback blockers accepted.
- Service-principal, occurrence, location, GPS, notification, Messenger, Event and recovery findings accepted.
- No claim is made that live Render currently lacks a safety override; source-default risk and absent frozen deployment proof remain accepted.

### Mechanical preflight

- Controlling for CAP-row count, code/section/gate resolution, package paths, hashes, broad reverse-row mappings and frozen commit equality.
- Does not certify full semantic trace/object completeness.

### Two-week delivery map

- Dependency ordering and safe parallel workstreams retained.
- Five-human-engineer estimate is planning opinion, not an architecture gate.
- The two-week target is retained as a controlled one-phone canary objective using isolated AI worktrees and one serialized owner for shared contracts/migrations.

---

## 11. Prioritized next sequence

1. Create the bounded v4.3 artifact contracts and single stage-state authority.
2. Build complete architecture-object, CAP, record, principal/tool and authority-set registries.
3. Complete writer/resolver/tool/trigger/cron/grant inventory and retirement manifest.
4. Close offline original-actor, occurrence, location-transition and recovery contracts.
5. Close NFC recovery, communication, contractor, accessibility and purge-ledger contracts.
6. Classify every open gate by design impact and obtain only the structure-changing decisions needed before design.
7. Run machine lint.
8. Perform an adversarial replan audit.
9. Correct the replan.
10. Build a standalone v4.3 architecture.
11. Internally audit, freeze and perform targeted independent v4.3 audits.
12. Open schema/component design only after explicit final architecture GO.
13. Begin the controlled fourteen-day canary implementation sequence.

---

## 12. No-change statement

This reconciliation changes documentation only on an isolated branch.

It does not change product source, database objects or rows, workflows, deployments, APKs, phones, Fully Kiosk configuration, credentials, schedules, Events, employees or production behavior.