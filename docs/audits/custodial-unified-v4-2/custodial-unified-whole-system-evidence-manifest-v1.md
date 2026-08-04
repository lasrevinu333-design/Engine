# Memphis Zoo Custodial Program — Unified Whole-System Evidence Manifest v1

**Status:** Controlling evidence and precedence registry for the v4.2 architecture cycle  
**Prepared:** 2026-08-04  
**Branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Branch base:** `lasrevinu333-design/Engine@8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Authorization:** Evidence governance only; no implementation authorization

---

## 1. Manifest rule

No architecture, schema, component, migration or release decision may rely on an unregistered evidence artifact.

Every evidence item has:

- stable identity;
- content digest or exact Git commit/path identity;
- evidence type;
- status;
- precedence;
- source confidence;
- supersession relation;
- permitted use;
- prohibited use;
- related gates.

For Git repository artifacts, `repository + exact commit + path` is the controlling content-addressed identity. A blob SHA may also be recorded, but the exact commit/path identity is sufficient to recover the bytes.

External files use SHA-256 of original bytes.

---

## 2. Evidence precedence

When evidence conflicts, use this order:

1. Eric’s current explicit operating and product decisions.
2. Current approved Memphis Zoo operating policy and field-workflow invariants.
3. The final independently accepted whole-system architecture and approved decision records.
4. Valid operational outcomes in v17 and its screenshots.
5. Actual frozen frontend/native/backend source and live read-only production truth.
6. Tests only after proving the test exercises the correct production path and current requirement.
7. Real Moto G/Fully Kiosk behavior for Android lifecycle, NFC, audio, GPS, permissions, performance and containment.

A lower-precedence artifact may reveal a missing capability or implementation defect. It cannot silently override a higher-precedence decision.

---

## 3. Frozen code and database evidence

| ID | Identity | Type | Status | Confidence | Permitted use | Prohibited use |
|---|---|---|---|---|---|---|
| E-CODE-001 | `lasrevinu333-design/Engine@8cdbe2fbe98fd31ab11483d96c12b6c1270fc148` | Actual frontend/native program | Frozen actual-program evidence | Source-exact | Discover current capabilities, defects, tests and release controls | Claim v4.2 is implemented |
| E-CODE-002 | `lasrevinu333-design/Engine@92cc7a95c6c0beb211db27ac510fa725aa3c23c0` | Ownership architecture v3.1 | Retained subsystem evidence | Source-exact | Import validated ownership doctrine | Treat as complete program architecture |
| E-CODE-003 | `lasrevinu333-design/Engine@7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc` | Unified architecture v4.1 package | Audited predecessor | Source-exact | Direct source for v4.2 and audit history | Treat as final approved architecture |
| E-CODE-004 | `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7` | Frozen backend | Frozen actual-program evidence | Source-exact | Discover routes, workers, security and release behavior | Treat backend as canonical target design |
| E-DB-001 | Supabase project `rqquvtjdmugpigbndmne` | Live production schema/data | Read-only research source | Time-sensitive live evidence | Verify object existence, definitions, counts, grants/advisors and current contradictions | Mutate or treat current state as target doctrine |

Live evidence must record query, timestamp and result digest in the research artifact that uses it. Live counts are snapshots, not timeless invariants.

---

## 4. V17 and external source artifacts

| ID | Artifact | SHA-256 | Status | Permitted use | Prohibited use |
|---|---|---|---|---|---|
| E-DOC-001 | `Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing.pdf` | `45301cf19ff6155181ce80cea6b8334cbf716be5cda87ee8433a1109bc1dd6df` | Valid requirements/screenshot evidence; 26 pages | Preserve valid operational outcomes and historical interface evidence | Treat every old screen, price or statement as current authority |
| E-SCHED-001 | `Memphis_Zoo_Static_Custodial_Schedule_COMPLETE_v2_OPEN.xlsx` | `f9eba54e274cd1b792545770de6fb17e9e25fee989aca18f65250d433f599e40` | Candidate source evidence only | Research schedule families, explicit OPEN, assumptions and discrepancies | Import, seed, publish or infer approval from filename |
| E-SCHED-002 | `memphis_zoo_scheduler_static_seed_first_pass.sql` | `ee455a52fbbc86a55e2c4306ae6e76b648bf4b8d9b64a3d4494381e8d462b93f` | **QUARANTINED — NON-ADMITTED EXECUTABLE ARTIFACT** | Historical evidence of generated schedule assumptions and migration risk | Execute against production or treat as admitted migration |

### Candidate workbook inventory rule

The workbook contains 16 tabs. The evidence registry must distinguish source-input tabs from generated expansion, audit and summary tabs. Any prior description calling it a twelve-sheet workbook is superseded by the observed 16-tab inventory.

### Candidate workbook unresolved facts

- Michael McWright shift conflict;
- Markiesha Warren shift conflict;
- 6:00 PM close assumption;
- September 14 policy;
- lunch not resolved into ownership;
- Wednesday/Thursday OPEN intervals;
- Elephant Trunk activation/scope;
- orphan reminder groups;
- position versus person-bound rows;
- individual-location expansion approval.

---

## 5. V4.1 repository research package

All items in this section are pinned to:

`lasrevinu333-design/Engine@7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc`

| ID | Path | Status | Supersession/precedence | Permitted use |
|---|---|---|---|---|
| E-V41-001 | `docs/audits/custodial-unified-whole-system-index.md` | Historical package index | Superseded by v4.2 index when created | Locate v4.1 evidence |
| E-V41-002 | `docs/custodial-unified-whole-system-programmer-handoff.md` | Historical programmer handoff | Superseded by v4.2 handoff | Reconstruct prior stopping point |
| E-V41-003 | `docs/custodial-unified-whole-system-independent-audit-handoff.md` | Historical v4.1 audit handoff | Superseded by v4.2 audit handoff | Audit history |
| E-V41-004 | `docs/audits/custodial-unified-whole-system-research-charter.md` | Active doctrine source | Imported unless v4.2 explicitly tightens it | Foundation-first doctrine |
| E-V41-005 | `docs/audits/custodial-unified-whole-system-auditor-reconciliation-v1.md` | Provisional pre-v4.1 reconciliation | Superseded by E-V42-REC-001 | Historical reasoning only |
| E-V41-006 | `docs/audits/custodial-unified-whole-system-production-truth-research-v1.md` | Active production evidence | Later addenda control their named domains | Current production reconstruction |
| E-V41-007 | `docs/audits/custodial-unified-whole-system-production-truth-addendum-v2.md` | Active evidence | Cumulative | Cron, retention, GPS, jobs |
| E-V41-008 | `docs/audits/custodial-unified-whole-system-production-truth-addendum-v3.md` | Active evidence | Cumulative; supersedes earlier schedule-writer/person-rule summaries | Writer families and person policy |
| E-V41-009 | `docs/audits/custodial-unified-whole-system-production-truth-addendum-v4.md` | Active evidence | Cumulative; controls SCH2 assessment | SCH2 strengths/conflicts |
| E-V41-010 | `docs/audits/custodial-unified-whole-system-production-truth-addendum-v5.md` | Active evidence | Cumulative; controls Messenger/notification findings | Messenger and alert authority |
| E-V41-011 | `docs/audits/custodial-unified-whole-system-production-truth-addendum-v6.md` | Active evidence | Cumulative; controls Events/guest/feedback findings | Events/public/feedback |
| E-V41-012 | `docs/audits/custodial-unified-whole-system-production-truth-addendum-v7.md` | Active evidence | Cumulative; controls release/migration-ledger findings | Release identity and false confidence |
| E-V41-013 | `docs/audits/custodial-unified-whole-system-production-truth-addendum-v8.md` | Active candidate-workbook evidence | Controls workbook summary | Candidate schedule artifact |
| E-V41-014 | `docs/audits/custodial-unified-whole-system-capability-canon-v1.md` | Provisional 252-capability canon | Imported and traced by v4.2; current-state prose may be superseded | Capability identity and disposition starting point |
| E-V41-015 | `docs/audits/custodial-unified-whole-system-authority-register-v1.md` | Provisional authority map | Superseded by v4.2 authority/record/principal model where conflict exists | Current/target authority inventory |
| E-V41-016 | `docs/audits/custodial-unified-whole-system-research-and-decision-gates-v1.md` | Active gate source | Updated by later gate files and v4.2 | Gate classification |
| E-V41-017 | `docs/audits/custodial-unified-whole-system-research-and-decision-gates-update-v2.md` | Active update | Controls workbook-related gate state | Schedule source conflicts |
| E-V41-018 | `docs/audits/custodial-unified-whole-system-architecture-v4-draft.md` | Superseded draft | Superseded by v4.1 and v4.2 | Audit history only |
| E-V41-019 | `docs/audits/custodial-unified-whole-system-architecture-v4-internal-audit.md` | Historical internal rejection | Findings incorporated into v4.1; not independent proof | Replan history |
| E-V41-020 | `docs/audits/custodial-unified-whole-system-architecture-v4-1.md` | Audited predecessor | Superseded as top-level by v4.2 | Direct architecture source |
| E-V41-021 | `docs/audits/custodial-unified-whole-system-architecture-v4-1-final-internal-audit.md` | Historical internal audit | Superseded by independent four-auditor result | Read only after independent first pass |
| E-V41-022 | `docs/audits/custodial-unified-whole-system-v4-1-auditor-prompt-pack.md` | Historical prompt pack | Superseded by v4.2 prompt pack | Audit history |
| E-V41-023 | `docs/audits/custodial-unified-whole-system-v4-1-auditor-supplement.md` | Historical mandatory attacks | Accepted attacks imported into v4.2 | Audit coverage |
| E-V41-024 | `docs/audits/custodial-unified-whole-system-v4-1-audit-handoff-supplement-v2.md` | Historical workbook supplement | Superseded by v4.2 manifest/gates | Audit history |
| E-V41-025 | `docs/audits/custodial-unified-whole-system-research-checkpoint-2026-08-04.md` | Historical checkpoint | Superseded by v4.2 checkpoint | Prior state record |

---

## 6. Independent v4.1 audit reports

| ID | Auditor | SHA-256 | Status | Precedence |
|---|---|---|---|---|
| E-AUD-001 | GPT-5.3 Spark | `0a8870fb9d87bcccf282bab554c6f7db2b0491c535e3c2f6fd8ccb1f7b51eb13` | Independent v4.1 first pass | Evidence; accepted findings normalized in reconciliation |
| E-AUD-002 | GPT-5.5 Pro | `d962ad98f791bc39336679b32ab377c4d9bfb7ba2cfc991f6151f8f873c68028` | Independent v4.1 first pass | Evidence; accepted findings normalized in reconciliation |
| E-AUD-003 | GPT-5.5 Instant | `86f871a9323b6b0a55a84f10a1cc0bfecc688b8e9877dd97297b4b0ec4073ec0` | Independent v4.1 first pass | Evidence; accepted findings normalized in reconciliation |
| E-AUD-004 | GPT-5.6 Pro | `55b0a030efecfc50b1fcb1ebaf30518a43cc5595e27bf3b8c2b5cdf282d4370d` | Independent v4.1 first pass with read-only live Supabase inspection | Evidence; accepted findings normalized in reconciliation |

The reports do not override source or policy. The controlling consolidated disposition is:

`docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-v4-1-four-auditor-final-reconciliation.md`

---

## 7. V4.2 evidence items

| ID | Path | Status | Rule |
|---|---|---|---|
| E-V42-REC-001 | `docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-v4-1-four-auditor-final-reconciliation.md` | Controlling four-auditor reconciliation | Supersedes prior reconciliation documents for v4.1 disposition |
| E-V42-MAN-001 | `docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-evidence-manifest-v1.md` | Controlling evidence manifest | This document |
| E-V42-ARCH-001 | `docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-architecture-v4-2.md` | Pending creation and audit | Becomes candidate only after internal audit |
| E-V42-TRACE-001 | `docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-capability-trace-v2.md` | Pending creation | Must contain all CAP-001–CAP-252 rows |
| E-V42-AUD-001 | `docs/audits/custodial-unified-v4-2/custodial-unified-whole-system-architecture-v4-2-internal-audit.md` | Pending | Internal evidence only, never independent proof |

---

## 8. Supersession rules

1. V4.2 may supersede v4.1 as top-level architecture only after it is complete and internally audited.
2. V4.1 remains immutable audit history.
3. V3.1 remains imported ownership-subsystem history and does not become a competing top-level architecture.
4. Production-truth addenda are cumulative; later domain-specific addenda control earlier summaries in the same domain.
5. The candidate workbook never supersedes approved operating policy.
6. The external seed SQL never becomes authority through age, filename, convenience or manual execution.
7. Historical green validation rows are invalidated by any material bound-artifact change.
8. Physical evidence is bound to an exact APK, device, OS, Fully Kiosk configuration, tag revision, authority set and test fixture.

---

## 9. Validation and drift control

Before a v4.2 audit freeze:

- every manifest path must resolve;
- every repository item must be pinned by exact commit;
- every external item must match SHA-256;
- every candidate/approved/superseded/quarantined status must be current;
- workbook tab inventory must be exact;
- no external executable artifact may be unclassified;
- the capability trace must reference only registered evidence IDs;
- architecture objects must reference capability IDs;
- internal audit and external reports must not be exposed to another auditor before its independent first pass.

Any evidence change creates a new manifest revision and invalidates dependent audit conclusions until reconciled.

---

## 10. Current safety state

This manifest changes documentation only.

It does not authorize or perform:

- schema design or DDL;
- product/backend/native code;
- migration or shadow writes;
- production data mutation;
- APK/build/workflow execution;
- phone or Fully Kiosk changes;
- deployment or release.