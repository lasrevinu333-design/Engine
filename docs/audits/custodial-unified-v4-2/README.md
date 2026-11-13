# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.2 Package

**Branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Base:** actual-program commit `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Status:** Standalone v4.2 architecture internally audited and being prepared for four independent audits  
**Implementation authorization:** NONE

---

## Read first

1. [`custodial-unified-whole-system-v4-2-programmer-handoff.md`](custodial-unified-whole-system-v4-2-programmer-handoff.md)
2. [`custodial-unified-whole-system-v4-2-independent-audit-handoff.md`](custodial-unified-whole-system-v4-2-independent-audit-handoff.md)
3. [`custodial-unified-whole-system-evidence-manifest-v1.md`](custodial-unified-whole-system-evidence-manifest-v1.md)
4. [`custodial-unified-whole-system-trace-code-registry-v1.md`](custodial-unified-whole-system-trace-code-registry-v1.md)
5. [`custodial-unified-whole-system-capability-trace-v2.md`](custodial-unified-whole-system-capability-trace-v2.md)
6. [`custodial-unified-whole-system-v4-2-gate-registry-v1.md`](custodial-unified-whole-system-v4-2-gate-registry-v1.md)
7. [`custodial-unified-whole-system-production-truth-addendum-v9.md`](custodial-unified-whole-system-production-truth-addendum-v9.md)
8. [`custodial-unified-whole-system-architecture-v4-2.md`](custodial-unified-whole-system-architecture-v4-2.md)
9. [`custodial-unified-whole-system-architecture-v4-2-internal-audit.md`](custodial-unified-whole-system-architecture-v4-2-internal-audit.md)

---

## Reconciliation and evidence

| Document | Purpose | Status |
|---|---|---|
| [`custodial-unified-whole-system-v4-1-four-auditor-final-reconciliation.md`](custodial-unified-whole-system-v4-1-four-auditor-final-reconciliation.md) | Reconciles GPT-5.3 Spark, GPT-5.5 Instant, GPT-5.5 Pro and GPT-5.6 Pro v4.1 audits | Controlling v4.1 disposition |
| [`custodial-unified-whole-system-evidence-manifest-v1.md`](custodial-unified-whole-system-evidence-manifest-v1.md) | Evidence identity, hashes, status, precedence and supersession | Controlling manifest |
| [`custodial-unified-whole-system-production-truth-addendum-v9.md`](custodial-unified-whole-system-production-truth-addendum-v9.md) | Live read-only trigger, cron, function, RLS and extension evidence | Active production evidence |

Registered v4.1 production research remains available at frozen commit `7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc` and is not recopied onto this clean branch.

---

## Architecture contracts

| Document | Purpose | Status |
|---|---|---|
| [`custodial-unified-whole-system-architecture-v4-2.md`](custodial-unified-whole-system-architecture-v4-2.md) | Standalone whole-system architecture closing accepted v4.1 findings | Current candidate |
| [`custodial-unified-whole-system-capability-trace-v2.md`](custodial-unified-whole-system-capability-trace-v2.md) | CAP-001–CAP-252 authority/security/retention/migration/proof trace | Current trace; independent validation required |
| [`custodial-unified-whole-system-trace-code-registry-v1.md`](custodial-unified-whole-system-trace-code-registry-v1.md) | Complete shorthand registry and trace validation rules | Controlling registry |
| [`custodial-unified-whole-system-v4-2-gate-registry-v1.md`](custodial-unified-whole-system-v4-2-gate-registry-v1.md) | Technical, source, schema, data, field, physical, policy and stage gates | Controlling gate state |

---

## Audit materials

| Document | Purpose | Status |
|---|---|---|
| [`custodial-unified-whole-system-architecture-v4-2-internal-audit.md`](custodial-unified-whole-system-architecture-v4-2-internal-audit.md) | Adversarial internal audit | GO for independent audits only |
| [`custodial-unified-whole-system-v4-2-independent-audit-handoff.md`](custodial-unified-whole-system-v4-2-independent-audit-handoff.md) | Read order, access recovery, independence and common attack contract | Ready |
| [`custodial-unified-whole-system-v4-2-auditor-prompt-pack.md`](custodial-unified-whole-system-v4-2-auditor-prompt-pack.md) | Four model-specific copy/paste prompts | Ready |

---

## Architectural additions over v4.1

V4.2 adds or makes normative:

- a common cross-domain record envelope and type registry;
- a distributed authority-set generation/fencing/pinning/activation/rollback protocol;
- canonical principal, credential, grant and authorization-decision contracts;
- confidential accommodation effect versus private justification;
- effective-time location split/merge/in-flight transaction;
- serialized service-occurrence satisfaction, concurrency, correction and next-cycle rules;
- reboot-aware offline time and protected key/lost-phone lifecycle;
- user-scoped Messenger visibility/reappearance policy seam;
- notification child/group/epoch-bound acknowledgement and already-visible stale cancellation;
- explicit no-speech-preemption default;
- Event cancellation/operational-impact reversal;
- offline/attachment-safe Feedback;
- executable AI/MCP/Moxie/diagnostic tool registry;
- structural analytics anti-misuse;
- cross-store retention/holds and complete restore bundle;
- machine-enforced legacy writer/resolver retirement manifest;
- quarantine of external generated SQL/data artifacts;
- exact validation invalidation;
- complete capability trace and evidence precedence.

---

## Current gates

| Gate | Status |
|---|---|
| V4.2 internal architecture audit | Complete |
| V4.2 independent audits | Ready after immutable freeze validation |
| Final architecture approval | NO-GO |
| Static schedule publication | NO-GO; source/policy gates open |
| Schema/component design | NO-GO |
| Implementation | NO-GO |
| Migration/shadow/cutover | NO-GO |
| APK/phone/Fully Kiosk | NO-GO |
| Fleet/release | NO-GO |

---

## Safety

This package changes documentation only on a clean branch based on the frozen actual program.

No product source, database object/row, workflow, build, APK, phone, Fully Kiosk configuration, deployment or production behavior was changed.