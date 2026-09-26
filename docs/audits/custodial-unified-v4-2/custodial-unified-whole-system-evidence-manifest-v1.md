# Memphis Zoo Custodial Program — Unified Whole-System Evidence Manifest v1

**Status:** Controlling evidence and precedence registry for the v4.2 architecture cycle  
**Prepared:** 2026-08-04  
**Branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Branch base:** `lasrevinu333-design/Engine@8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Authorization:** Evidence governance and architecture audit only; no schema or implementation authorization

---

## 1. Manifest rule

No architecture, schema, component, migration or release decision may rely on an unregistered evidence artifact.

Every item has a stable identity, digest or exact Git commit/path, evidence type/status, precedence/supersession, confidence, permitted/prohibited use and related gates.

Repository items are ultimately bound by repository, immutable audit-freeze commit and path. Working-branch blob SHAs below are drift checks before freeze. External files use SHA-256 of original bytes.

---

## 2. Evidence precedence

When evidence conflicts:

1. Eric’s current explicit product and operating decisions.
2. Approved Memphis Zoo operating policy and field-workflow invariants.
3. Final independently accepted architecture and approved decision records.
4. Valid v17 outcomes and screenshots.
5. Frozen frontend/native/backend source and read-only production truth.
6. Tests proven to exercise the correct path and requirement.
7. Bound Moto G/Fully Kiosk behavior for device-dependent facts.

Lower-precedence evidence may expose a missing capability or defect. It cannot silently override higher-precedence authority.

---

## 3. Frozen repositories and production evidence

| ID | Identity | Status | Permitted use | Prohibited use |
|---|---|---|---|---|
| E-CODE-001 | `lasrevinu333-design/Engine@8cdbe2fbe98fd31ab11483d96c12b6c1270fc148` | Frozen actual frontend/native program | Discover current capabilities, defects, tests and release controls | Claim v4.2 is implemented |
| E-CODE-002 | `lasrevinu333-design/Engine@92cc7a95c6c0beb211db27ac510fa725aa3c23c0` | Ownership v3.1 subsystem evidence | Import supported ownership doctrine | Treat as complete program architecture |
| E-CODE-003 | `lasrevinu333-design/Engine@7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc` | Frozen v4.1 audited predecessor | Direct source and immutable audit history | Treat as final architecture or implementation |
| E-CODE-004 | `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7` | Frozen backend evidence | Discover current routes, workers, security and release behavior | Treat current backend as target doctrine |
| E-DB-001 | Supabase `rqquvtjdmugpigbndmne` | Live SELECT-only evidence; time-sensitive | Verify definitions, counts, grants/advisors and contradictions | Mutate or treat snapshot counts as invariants |

Every later live query used for design preserves query, timestamp, result digest and sensitivity classification.

---

## 4. External documents and candidate artifacts

| ID | Artifact | SHA-256 | Status | Permitted use | Prohibited use |
|---|---|---|---|---|---|
| E-DOC-001 | `Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing.pdf` | `45301cf19ff6155181ce80cea6b8334cbf716be5cda87ee8433a1109bc1dd6df` | Valid requirements/screenshot evidence; 26 pages/images | Preserve valid operational outcomes and historical screen evidence | Treat old UI, price or claim as current authority |
| E-SCHED-001 | `Memphis_Zoo_Static_Custodial_Schedule_COMPLETE_v2_OPEN.xlsx` | `f9eba54e274cd1b792545770de6fb17e9e25fee989aca18f65250d433f599e40` | Candidate source evidence only; 16 tabs observed | Research schedule families, OPEN intervals, assumptions and conflicts | Import, seed, publish or infer approval from filename |
| E-SCHED-002 | `memphis_zoo_scheduler_static_seed_first_pass.sql` | `ee455a52fbbc86a55e2c4306ae6e76b648bf4b8d9b64a3d4494381e8d462b93f` | **QUARANTINED — NON-ADMITTED EXECUTABLE ARTIFACT** | Historical evidence of generated assumptions and migration risk | Execute against production or admit as migration |

Unresolved workbook facts include disputed shifts, close/September 14, lunch, late OPEN intervals, Elephant Trunk, orphan reminders, position/person-bound rows and individual-location expansion approval.

---

## 5. V4.1 research package

All paths below are pinned to `lasrevinu333-design/Engine@7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc`.

| Package item | Status/precedence |
|---|---|
| Research charter | Imported foundation-first doctrine unless v4.2 tightens it |
| Production truth v1 and addenda v2–v8 | Cumulative; later domain-specific addendum controls earlier summary |
| Capability canon v1 | Provisional CAP-001–CAP-252 source; traced by v4.2 |
| Authority register v1 | Historical/provisional; superseded where v4.2 differs |
| Gate registry v1 and update v2 | Historical gate source; superseded by v4.2 gate registry |
| V4 draft and internal audit | Superseded audit history |
| V4.1 architecture | Audited predecessor; superseded as top-level candidate by internally audited v4.2 |
| V4.1 final internal audit | Historical internal result; four independent reports control disposition |
| V4.1 prompts, supplements, handoffs, index and checkpoint | Historical launch/evidence material |

---

## 6. Independent v4.1 audits

| ID | Auditor/file | SHA-256 | Status |
|---|---|---|---|
| E-AUD-001 | GPT-5.3 Spark — `Pasted text(208).txt` | `0a8870fb9d87bcccf282bab554c6f7db2b0491c535e3c2f6fd8ccb1f7b51eb13` | Independent v4.1 first pass |
| E-AUD-002 | GPT-5.5 Pro — `Pasted text (2)(6).txt` | `d962ad98f791bc39336679b32ab377c4d9bfb7ba2cfc991f6151f8f873c68028` | Independent v4.1 first pass |
| E-AUD-003 | GPT-5.5 Instant — `Pasted text (3)(4).txt` | `86f871a9323b6b0a55a84f10a1cc0bfecc688b8e9877dd97297b4b0ec4073ec0` | Independent v4.1 first pass |
| E-AUD-004 | GPT-5.6 Pro — `Pasted text(210).txt` | `55b0a030efecfc50b1fcb1ebaf30518a43cc5595e27bf3b8c2b5cdf282d4370d` | Independent v4.1 first pass; read-only live Supabase inspection |

The controlling consolidated disposition is the v4.1 four-auditor final reconciliation.

---

## 7. Complete v4.2 working package

Blob SHAs are pre-freeze drift identities. The later immutable freeze SHA controls the package.

| ID | Path | Working blob SHA | Status |
|---|---|---|---|
| E-V42-INDEX-001 | `docs/audits/custodial-unified-v4-2/README.md` | `044389018f4a0d30ed91071544e857c5f09463dc` | Package index |
| E-V42-HANDOFF-PROG | `.../custodial-unified-whole-system-v4-2-programmer-handoff.md` | `64ced32f0567676d07d509967f3698ecc079087d` | Programmer handoff |
| E-V42-REC-001 | `.../custodial-unified-whole-system-v4-1-four-auditor-final-reconciliation.md` | `6bbaa15d441d8c566e6d15a40f5ffb4077adc78e` | Controlling v4.1 disposition |
| E-V42-MAN-001 | `.../custodial-unified-whole-system-evidence-manifest-v1.md` | self; freeze commit controls | This manifest |
| E-V42-CODE-001 | `.../custodial-unified-whole-system-trace-code-registry-v1.md` | `72b1413ed7b8807774889c94e25bc0778c9766a5` | Controlling shorthand registry |
| E-V42-TRACE-001 | `.../custodial-unified-whole-system-capability-trace-v2.md` | `43e9612f8e5d40512441d17d3a9a22cd3851e75e` | CAP-001–CAP-252 trace; independent lint required |
| E-V42-GATE-001 | `.../custodial-unified-whole-system-v4-2-gate-registry-v1.md` | `d13e6eacba475e061ff2ec324b6247f5a453b6e0` | Controlling gate state |
| E-V42-PROD-009 | `.../custodial-unified-whole-system-production-truth-addendum-v9.md` | `2b792c9b06989eb482db149b2bcc18a18d927884` | Active SELECT-only production evidence |
| E-V42-ARCH-001 | `.../custodial-unified-whole-system-architecture-v4-2.md` | `8001ba9f6148a509285c3455075ccfd00d9e6a9f` | Standalone candidate |
| E-V42-AUD-001 | `.../custodial-unified-whole-system-architecture-v4-2-internal-audit.md` | `38b9fa64005232cc7a75d153fe4eb306bb84704d` | Internal audit; not independent proof |
| E-V42-HANDOFF-AUD | `.../custodial-unified-whole-system-v4-2-independent-audit-handoff.md` | `c08f66c875f2afbdecd5f1cf1d441b3ad39c2042` | Independent audit contract |
| E-V42-PROMPT-001 | `.../custodial-unified-whole-system-v4-2-auditor-prompt-pack.md` | `57150962707ddac602b1c80754e2cb73c55e9c47` | Four model-specific prompts |
| E-V42-CHECKPOINT | `.../custodial-unified-whole-system-v4-2-checkpoint-2026-08-04.md` | `12332dcd5356fe3d067ad37a71771d37250a9740` | Architecture checkpoint |

`.../` means `docs/audits/custodial-unified-v4-2/`.

---

## 8. Supersession rules

1. Internally audited v4.2 supersedes v4.1 as top-level audit candidate, not as approved architecture.
2. V4.1 remains immutable audit history.
3. V3.1 remains imported ownership-subsystem evidence, not competing top-level authority.
4. Later domain-specific production addenda control earlier summaries in the same domain.
5. Candidate workbook never supersedes approved policy.
6. Quarantined seed SQL never becomes authority through convenience, age or filename.
7. Material bound-artifact changes invalidate prior green evidence.
8. Physical evidence is bound to exact release tuple, device, OS, Fully Kiosk, tag revision and fixture.

---

## 9. Freeze validation

Before immutable v4.2 audit freeze:

- every package path resolves;
- the freeze branch equals the recorded exact commit;
- external SHA-256 values match;
- candidate/approved/superseded/quarantined states are current;
- CAP-001–CAP-252 occur exactly once;
- all trace shorthand, architecture sections and gates resolve;
- every architecture object reverse-maps to capabilities;
- no external executable artifact is unclassified;
- prompt pack enforces independent first passes;
- internal audit is excluded from first-pass reading.

Any later evidence change invalidates dependent audit conclusions until reconciled.

---

## 10. Safety

This package changes documentation only. It does not authorize or perform schema design, DDL, product/backend/native code, shadow/production writes, migration, build, APK, phone, Fully Kiosk, deployment or release.