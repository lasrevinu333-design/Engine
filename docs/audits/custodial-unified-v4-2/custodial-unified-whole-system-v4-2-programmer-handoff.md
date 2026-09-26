# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.2 Programmer Handoff

**Status:** Architecture candidate ready for immutable freeze and four independent audits; no design or implementation authorization  
**Branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Base:** actual-program commit `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Rollback:** Custodial Build 22

---

## 1. What changed in this cycle

The v4.1 audit cycle returned four independent CONDITIONAL GO verdicts. All four retained the whole-system direction and prohibited schema/component design and later work. GPT-5.6 Pro added six major cross-domain blockers that v4.1 treated as principles rather than complete contracts.

The response was not to patch v4.1. A clean branch was created directly from the frozen actual program and a standalone v4.2 architecture was written.

V4.2 adds normative contracts for:

- cross-domain record identity/version/replay;
- distributed authority-set activation and rollback;
- principal/grant/session/authorization decisions;
- location transition with active/offline work;
- service-occurrence concurrency and correction;
- machine-enforced legacy retirement;
- reboot-aware offline time and key/lost-phone lifecycle;
- grouped/stale-visible notification behavior;
- Messenger visibility/reappearance;
- Event cancellation/impact reversal;
- Feedback attachments/offline;
- AI/MCP/Moxie/diagnostic tool authority;
- retention/holds/restore bundles;
- release validation invalidation;
- complete capability and evidence traceability.

---

## 2. Read order

1. [`README.md`](README.md)
2. [`custodial-unified-whole-system-evidence-manifest-v1.md`](custodial-unified-whole-system-evidence-manifest-v1.md)
3. [`custodial-unified-whole-system-trace-code-registry-v1.md`](custodial-unified-whole-system-trace-code-registry-v1.md)
4. [`custodial-unified-whole-system-capability-trace-v2.md`](custodial-unified-whole-system-capability-trace-v2.md)
5. [`custodial-unified-whole-system-v4-2-gate-registry-v1.md`](custodial-unified-whole-system-v4-2-gate-registry-v1.md)
6. [`custodial-unified-whole-system-production-truth-addendum-v9.md`](custodial-unified-whole-system-production-truth-addendum-v9.md)
7. [`custodial-unified-whole-system-architecture-v4-2.md`](custodial-unified-whole-system-architecture-v4-2.md)
8. [`custodial-unified-whole-system-architecture-v4-2-internal-audit.md`](custodial-unified-whole-system-architecture-v4-2-internal-audit.md)
9. [`custodial-unified-whole-system-v4-2-independent-audit-handoff.md`](custodial-unified-whole-system-v4-2-independent-audit-handoff.md)
10. [`custodial-unified-whole-system-v4-2-auditor-prompt-pack.md`](custodial-unified-whole-system-v4-2-auditor-prompt-pack.md)

Prior research lives at frozen v4.1 commit `7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc` and is registered in the evidence manifest.

---

## 3. Current architectural state

### Accepted direction

- one whole operational system;
- one authority per fact;
- one common record envelope;
- one compatible authority-set protocol;
- one principal/grant/authorization model;
- one location-level ownership authority;
- one service-occurrence root for due/overdue;
- one native employee runtime;
- one notification presentation authority;
- complete history/correction/retention/migration/release treatment.

### Open facts and policies

Do not guess:

- final static schedule source and disputed shifts;
- positions/person-bound rules;
- lunch;
- operating hours and September 14;
- workload/frequency/route;
- readiness/severity/inspection/OPEN policy;
- contractor identity/acceptance;
- GPS use/retention;
- manager tiers/on-call;
- Messenger archive/reappearance;
- Moxie/AI write role;
- guest activation/privacy;
- retention/holds/analytics use;
- SLO/RPO/RTO;
- Karen/pilot threshold;
- Build 22 retirement.

The gate registry distinguishes researchable facts from genuine policy decisions.

---

## 4. Current production facts that must not be mistaken for target architecture

Read-only evidence confirms current production includes:

- multiple schedule writers/resolvers;
- absence/PTO regeneration triggers;
- rolling schedule-window cron;
- Messenger-triggered schedule generation;
- scan-event alert clearing;
- current person/restriction guard functions;
- Messenger content purge cron;
- multiple RLS/FORCE RLS tables with varied policy counts;
- mutable/no function search-path configurations in sampled current functions;
- `pg_net` in the public schema.

These are migration/security inventory facts. They are not target capabilities to preserve automatically.

---

## 5. What is authorized next

Only:

1. validate all v4.2 package paths;
2. freeze one immutable audit branch;
3. open/maintain one draft documentation PR;
4. launch four independent audits in fresh conversations;
5. reconcile reports against primary evidence;
6. replan any confirmed architecture blocker/high finding;
7. repeat independent audit if the architecture changes materially.

---

## 6. What is prohibited

Do not:

- design or create schema/DDL;
- implement frontend/backend/native code;
- alter production functions/triggers/cron/RLS/grants;
- import the workbook;
- execute the quarantined seed SQL;
- run shadow writes;
- build or install an APK;
- change phones or Fully Kiosk;
- merge the architecture PR as product code;
- treat an architecture GO as implementation or release GO.

---

## 7. Independent audit launch

Use four fresh conversations and the exact model prompt from the prompt pack:

1. GPT-5.3 Spark;
2. GPT-5.5 Instant;
3. GPT-5.5 Pro;
4. GPT-5.6 Pro.

Each auditor must freeze its first-pass findings before reading the internal audit, v4.1 reconciliation or another v4.2 report.

The immutable audit branch and exact SHA will be posted on the v4.2 draft PR after all package files are complete.

---

## 8. Current gate matrix

| Scope | Status |
|---|---|
| V4.2 architecture direction | Internally accepted for independent audit |
| Final architecture | NO-GO pending four audits |
| Schema/component design | NO-GO |
| Implementation | NO-GO |
| Migration | NO-GO |
| APK/phone/fleet/release | NO-GO |

---

## 9. No-change statement

This cycle changed documentation only on a branch based on the frozen actual-program commit.

No product source, database object/row, workflow, build, APK, phone, Fully Kiosk configuration, deployment, employee, device, schedule, Event, credential or production behavior was changed.