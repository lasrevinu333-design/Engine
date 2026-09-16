# Memphis Zoo Custodial Program — V4.2 Capability Trace Code Registry v1

**Status:** Controlling shorthand registry for `custodial-unified-whole-system-capability-trace-v2.md`  
**Prepared:** 2026-08-04

This registry controls all shorthand used in the v4.2 capability trace. Where the trace’s introductory legend omits a code, this complete registry controls.

## Authority codes

- `A-PURPOSE` — operating purpose and outcomes
- `A-PRODUCT` — product/projection contract
- `A-RECORD` — canonical cross-domain record envelope and type registry
- `A-AUTHSET` — operational authority-set manifest, generation, activation and rollback
- `A-PRINCIPAL` — principal, credential, grant and authorization decision
- `A-DEVICE` — canonical device, credential and assignment epoch
- `A-LOCATION` — location registry, lifecycle and tag relation
- `A-STATIC` — approved static source, version and baseline
- `A-OPERATING` — operating/time policy
- `A-WORKLOAD` — workload, frequency, route and restriction revision
- `A-OWNERSHIP` — compiler, publication and resolver
- `A-OCCURRENCE` — service occurrence aggregate
- `A-SESSION` — cleaning session aggregate
- `A-LOCAL` — protected local store, queue and snapshot
- `A-NFC` — native NFC/tag intake
- `A-GPS` — active-session GPS evidence
- `A-COMPLETION` — accepted completion and correction
- `A-ISSUE` — issue, supply, ticket and work-request domains
- `A-STATUS` — operational status/readiness projection
- `A-INSPECTION` — inspection aggregate and rubric
- `A-MSG` — Messenger users, threads, messages and visibility
- `A-NOTIF` — operational episode, recipient intent, presentation and escalation
- `A-EVENT` — Event revision, audience and impact
- `A-GUEST` — guest intake, Marketing review and dispatch
- `A-FEEDBACK` — employee help, manager triage and attachments
- `A-CONTRACTOR` — engagement, slot, assignment and acceptance
- `A-TOOL` — AI, MCP, Moxie and diagnostic registry
- `A-ANALYTICS` — confidence-qualified analytical facts and approved projections
- `A-SECURITY` — security policies and manifests
- `A-RETENTION` — information-class policy, hold and export
- `A-DR` — backup, restore and availability/SLO
- `A-MIGRATION` — migration, retirement and confidence
- `A-RELEASE` — release tuple and admission
- `A-PHYSICAL` — bound physical acceptance evidence

## Security boundary codes

- `B-EMP` — employee managed phone
- `B-MGR` — Full Access Manager or specifically granted manager capability
- `B-RO` — Read Only
- `B-PUBLIC` — public guest
- `B-MKT` — Marketing reviewer
- `B-CONTRACTOR` — contractor channel
- `B-TOOL` — AI/MCP/Moxie/diagnostic
- `B-SYSTEM` — backend worker/service
- `B-HIGH` — database, backup, release or security administrator
- `B-ALL` — multiple role-specific projections
- `B-NA` — no user projection

## Retention codes

- `R-DURABLE` — durable operational/historical evidence
- `R-OP` — operational retention by approved policy
- `R-PRESENT` — short presentation/content retention
- `R-PRIVATE` — sensitive/private restricted retention
- `R-GPSRAW` — short raw-GPS retention plus hold
- `R-SECURITY` — security/authorization evidence
- `R-RELEASE` — migration/release/admission evidence
- `R-NONE` — no retained operational record beyond audit metadata

## Migration/disposition codes

- `M-RETAIN` — preserve validated principle/mechanism
- `M-REBUILD` — rebuild behind v4.2 authority
- `M-RETIRE` — remove as target authority or reachable product behavior
- `M-ENFORCE` — preserve the rule as a hard negative/constraint while retiring violating behavior
- `M-OPTIONAL` — approval-gated
- `M-FUTURE` — deliberately outside current release
- `M-PHYSICAL` — final proof depends on bound physical evidence

Composite forms such as `M-RETIRE/M-REBUILD` or `M-REBUILD/M-PHYSICAL` are valid and mean both requirements apply.

## Validation rule

Before the v4.2 audit freeze, an automated documentation check must:

1. extract every shorthand token used by the capability trace;
2. confirm the token exists in this registry;
3. confirm CAP-001 through CAP-252 occur exactly once in the main trace table;
4. reject duplicate or missing CAP IDs;
5. reject architecture section or gate references that do not resolve.