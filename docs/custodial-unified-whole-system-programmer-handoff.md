# Memphis Zoo Custodial Program — Unified Whole-System Programmer Handoff

**Status:** Architecture candidate ready for four independent audits; implementation remains blocked  
**Branch:** `agent/custodial-unified-whole-system-v4-20260803`  
**Draft PR:** Engine PR #126  
**Base ownership architecture:** `92cc7a95c6c0beb211db27ac510fa725aa3c23c0`  
**Actual-program evidence:** `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Backend evidence:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Rollback:** Custodial Build 22

---

## 1. What has been completed

1. Reconciled GPT-5.3 Spark, GPT-5.5 Pro and GPT-5.5 Instant whole-program audits against primary evidence.
2. Retained Canonical Ownership Foundation Architecture v3.1 as a subsystem specification rather than discarding it.
3. Performed additional SELECT-only production reconstruction.
4. Created a 252-capability whole-system canon.
5. Created a canonical authority register covering identity, location, schedules, ownership, sessions, status/readiness, Messenger, notifications, Events, guest, contractor, security, retention and release facts.
6. Separated source/data/field/physical research from genuine Eric policy decisions.
7. Wrote Unified Whole-System Architecture v4 draft.1.
8. Adversarially audited draft.1 and rejected it as a final candidate.
9. Replanned the architecture as standalone v4.1, including every draft blocker.
10. Completed final internal v4.1 audit.
11. Prepared a four-model independent-audit handoff and prompt pack.
12. Opened draft PR #126. No merge is authorized.

---

## 2. Current architecture disposition

### Retain

- location-level responsibility;
- static-first/exception-only minimal change;
- explicit `OPEN` and `not_required`;
- position identity separate from employee identity;
- contractor capacity separate from employee identity;
- owner/active cleaner/actual cleaner separation;
- immutable/bitemporal history;
- deterministic compiler and atomic publication;
- one compatible operational authority set;
- no permanent dual read/write;
- complete rollback;
- strong RLS/native-vault/signer/admission controls.

### Rebuild on the unified foundation

- employee runtime, Home, NFC, sessions, offline and GPS;
- static schedule publication and exception compiler;
- service occurrences, status and inspection readiness;
- completion taxonomies and corrections;
- issues/supplies/tickets/W.O. Submitted;
- Manager, Read Only, Messenger and notification products;
- Events and approved operational impact;
- guest/Marketing workflow;
- employee feedback/help;
- contractor engagement/acceptance;
- AI/MCP/Moxie/diagnostics authority;
- retention, disaster recovery, migration, release and physical acceptance.

### Retire

- Sunday location rows as independent authority;
- group-level final ownership;
- CoverAll pseudo-employees;
- read-side inheritance and `All Locations`;
- hard-coded employee scheduling rules;
- AI/message/read-triggered schedule generation;
- forced whole-day regeneration for ordinary exceptions;
- scan-event alert clearing;
- competing browser/native alert authorities;
- employee Scanner/QR/name selection/technical Home controls;
- permanent compatibility/dual authority.

---

## 3. Production facts the next programmer must understand

Read the production truth reports before touching design:

- group and Sunday location templates disagree materially;
- active Sunday location rows contain 92 rows not in current group expansion, while 51 expanded group rows are absent from location templates;
- mixed restroom/non-restroom groups make group authority unusable for 9:45;
- employee schedule read code currently computes ownership/inheritance and can emit `All Locations`;
- a named employee code is hard-coded in late-coverage presentation;
- absence changes and scheduled rolling-window jobs can regenerate mutable daily schedules;
- a schedule-related Memphis message can generate schedules;
- every scan event currently clears active legacy location alerts;
- operating hours are empty and close defaults to 6:00 PM;
- current Dashboard `okay` is timer status, not inspection readiness;
- employee active state and CoverAll pseudo-employees conflate identity/eligibility;
- location-level workload/route calibration is incomplete and unversioned;
- message/event retention physically purges short-lived content/history;
- current GPS is sparse latest-status evidence, not a calibrated history;
- security boundaries sampled in production are strong and must not be weakened.

---

## 4. Current gate matrix

| Gate | Status |
|---|---|
| Four independent v4.1 architecture audits | READY TO BEGIN |
| Final architecture approval | BLOCKED pending audits/replan |
| Schema/component design | NO-GO |
| Implementation | NO-GO |
| Shadow migration | NO-GO |
| APK/phone work | NO-GO |
| Release | NO-GO |

Do not interpret the internal “GO for independent audit” as permission to build.

---

## 5. Immediate next sequence

1. Run separate independent first-pass audits using the prompt pack:
   - GPT-5.3 Spark;
   - GPT-5.5 Instant;
   - GPT-5.5 Pro;
   - GPT-5.6 Pro.
2. Do not show one new report to another auditor before its first pass is fixed.
3. Collect complete reports without modifying this branch.
4. Reconcile each finding against primary source and production evidence.
5. Research source/field/physical facts before asking Eric to decide.
6. Present genuine policy decisions with recommended defaults and consequences.
7. Rebuild architecture chapters with any confirmed blocker/high finding.
8. Internally reaudit the new revision.
9. Send the revision back through the four auditors.
10. Only after architecture GO and closed gates begin isolated schema/component design.

---

## 6. Required reading

1. `docs/custodial-unified-whole-system-independent-audit-handoff.md`
2. `docs/audits/custodial-unified-whole-system-architecture-v4-1.md`
3. `docs/audits/custodial-unified-whole-system-architecture-v4-1-final-internal-audit.md`
4. `docs/audits/custodial-unified-whole-system-capability-canon-v1.md`
5. `docs/audits/custodial-unified-whole-system-authority-register-v1.md`
6. `docs/audits/custodial-unified-whole-system-research-and-decision-gates-v1.md`
7. `docs/audits/custodial-unified-whole-system-production-truth-research-v1.md`
8. `docs/audits/custodial-unified-whole-system-production-truth-addendum-v2.md`
9. `docs/audits/custodial-unified-whole-system-auditor-reconciliation-v1.md`
10. `docs/audits/custodial-unified-whole-system-v4-1-auditor-prompt-pack.md`

---

## 7. Safety

The work on PR #126 is documentation and read-only production research. It changed no product source, backend source, database object/row, workflow, build, APK, phone, Fully Kiosk configuration, deployment or production behavior.

Keep PR #126 draft and unmerged until the independent architecture/replan cycle is complete.