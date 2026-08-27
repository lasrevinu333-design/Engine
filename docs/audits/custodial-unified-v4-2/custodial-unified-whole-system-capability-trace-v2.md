# Memphis Zoo Custodial Program — Capability / Authority / Contract / Proof Trace v2

**Status:** Complete CAP-001–CAP-252 architecture trace for Unified Whole-System Architecture v4.2  
**Prepared:** 2026-08-04  
**Source canon:** `custodial-unified-whole-system-capability-canon-v1.md` at `7d3e30d7ab6deb9dfa70224a9f6c3a3dab6292fc`  
**Architecture:** `custodial-unified-whole-system-architecture-v4-2.md`  
**Authorization:** Traceability only; no schema or implementation authorization

---

## 1. Codes

### Authorities / canonical objects

- `A-PURPOSE` — operating purpose/outcomes
- `A-PRODUCT` — product/projection contract
- `A-PRINCIPAL` — principal, grant, authorization decision
- `A-DEVICE` — device/credential/assignment epoch
- `A-LOCATION` — location registry/lifecycle/tag relation
- `A-STATIC` — approved static source/version/baseline
- `A-OPERATING` — operating/time policy
- `A-WORKLOAD` — workload/frequency/route/restriction revision
- `A-OWNERSHIP` — compiler/publication/resolver
- `A-OCCURRENCE` — service occurrence aggregate
- `A-SESSION` — cleaning session aggregate
- `A-LOCAL` — protected local store/queue/snapshot
- `A-NFC` — native NFC/tag intake
- `A-GPS` — active-session GPS evidence
- `A-COMPLETION` — accepted completion/correction
- `A-ISSUE` — issue/supply/ticket/work-request domains
- `A-STATUS` — status/readiness projection
- `A-INSPECTION` — inspection aggregate/rubric
- `A-MSG` — Messenger users/threads/messages/visibility
- `A-NOTIF` — operational episode/intent/presentation/escalation
- `A-EVENT` — Event revision/audience/impact
- `A-GUEST` — guest/Marketing/dispatch
- `A-FEEDBACK` — employee help/manager triage/attachments
- `A-CONTRACTOR` — engagement/slot/assignment/acceptance
- `A-TOOL` — AI/MCP/Moxie/diagnostic registry
- `A-SECURITY` — security policies/manifests
- `A-RETENTION` — information-class policy/hold/export
- `A-DR` — backup/restore/SLO
- `A-MIGRATION` — migration/retirement/confidence
- `A-RELEASE` — release tuple/admission
- `A-PHYSICAL` — bound physical acceptance evidence

### Security boundaries

- `B-EMP` employee managed phone
- `B-MGR` Full Access Manager or specifically granted manager capability
- `B-RO` Read Only
- `B-PUBLIC` public guest
- `B-MKT` Marketing reviewer
- `B-CONTRACTOR` contractor channel
- `B-TOOL` AI/MCP/Moxie/diagnostic
- `B-SYSTEM` backend worker/service
- `B-HIGH` database/backup/release/security administrator
- `B-ALL` multiple role-specific projections
- `B-NA` no user projection

### Retention classes

- `R-DURABLE` durable operational/historical evidence
- `R-OP` operational retention by approved policy
- `R-PRESENT` short presentation/content retention
- `R-PRIVATE` sensitive/private restricted retention
- `R-GPSRAW` short raw-GPS retention plus hold
- `R-SECURITY` security/authorization evidence
- `R-RELEASE` migration/release/admission evidence
- `R-NONE` no retained operational record beyond audit metadata

### Migration disposition

- `M-RETAIN`, `M-REBUILD`, `M-RETIRE`, `M-OPTIONAL`, `M-FUTURE`, `M-PHYSICAL`.

Every row remains subject to the evidence manifest, open gates and architecture audit.

---

## 2. Complete trace

| ID | Capability | Canonical authority/object | Product / boundary | Retention | Migration | V4.2 home | Required proof / gate |
|---|---|---|---|---|---|---|---|
| CAP-001 | Remove uncertainty from custodial operations | A-PURPOSE | B-ALL | R-DURABLE | M-RETAIN | §1 | Outcome trace; G-TRACE-001 |
| CAP-002 | Distinguish not reached from poorly cleaned | A-OCCURRENCE + A-STATUS | B-MGR/B-RO | R-DURABLE | M-REBUILD | §§15,22 | Status truth tables; G-READINESS |
| CAP-003 | One connected daily operating record | canonical record envelope | B-ALL | R-DURABLE | M-REBUILD | §5 | Record registry/replay; G-RECORD-001 |
| CAP-004 | Full Access Manager product | A-PRODUCT + A-PRINCIPAL | B-MGR | R-OP | M-REBUILD | §§7,8,24 | Route/API/capability tests; G-MGR-TIERS |
| CAP-005 | Custodial Employee Android product | A-PRODUCT + A-DEVICE | B-EMP | R-OP | M-REBUILD | §§8,18,23 | APK graph and physical matrix |
| CAP-006 | Private Read Only product | A-PRODUCT | B-RO | R-OP | M-REBUILD | §8.3 | Dedicated field/API allowlist; G-RO-FIELDS |
| CAP-007 | Guest public product | A-GUEST | B-PUBLIC/B-MKT | R-PRIVATE | M-OPTIONAL | §28 | Disabled-by-default and abuse/privacy tests; G-GUEST |
| CAP-008 | Contractor product | A-CONTRACTOR | B-CONTRACTOR/B-MGR | R-DURABLE | M-REBUILD | §30 | Link/acceptance/OPEN tests; G-CONTRACTOR |
| CAP-009 | AI/MCP/diagnostic products | A-TOOL + A-PRINCIPAL | B-TOOL/B-HIGH | R-PRIVATE/R-SECURITY | M-REBUILD | §31 | Executable registry/confused-deputy tests |
| CAP-010 | Product-specific route/asset allowlists | A-RELEASE + A-PRODUCT | B-ALL | R-RELEASE | M-RETAIN | §§8,37 | Source-to-APK/module negative tests |
| CAP-011 | Permanent employee identity | A-PRINCIPAL | B-ALL | R-DURABLE | M-RETAIN | §10.1 | Identity history/replacement tests |
| CAP-012 | Employment state | A-PRINCIPAL workforce lifecycle | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §10.2 | Effective-state/exclusion tests |
| CAP-013 | Schedule eligibility | A-PRINCIPAL grant/restriction effect | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §§7,10 | Eligibility and historical replay |
| CAP-014 | Messenger eligibility | A-PRINCIPAL + A-MSG | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §§7,25 | Separate lifecycle tests |
| CAP-015 | Phone eligibility | A-PRINCIPAL + A-DEVICE | B-MGR/B-HIGH | R-DURABLE | M-REBUILD | §10.5 | Assignment/revocation tests |
| CAP-016 | Stable schedule position | A-STATIC workforce position | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §§10.3,11 | Position registry; G-POSITION |
| CAP-017 | Effective position occupancy | A-STATIC workforce position | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §10.3 | Non-overlap/history tests |
| CAP-018 | Vacancy as first-class state | A-STATIC + A-OWNERSHIP | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §§10.3,14 | Vacancy→OPEN fixtures |
| CAP-019 | Named person-bound schedule rule | A-STATIC + confidential restriction effect | B-MGR/B-HIGH | R-PRIVATE/R-DURABLE | M-REBUILD | §§7.7,10.3 | Approval/redaction; G-POSITION/G-PRIV-ACCOMMODATION |
| CAP-020 | Employee onboarding | A-PRINCIPAL + A-DEVICE | B-MGR/B-HIGH | R-DURABLE/R-SECURITY | M-REBUILD | §§7,10 | End-to-end admission tests |
| CAP-021 | Employee offboarding | A-PRINCIPAL + A-DEVICE | B-MGR/B-HIGH | R-DURABLE/R-SECURITY | M-REBUILD | §§7,10 | Eligibility closure/history preservation |
| CAP-022 | Replacement employee | A-PRINCIPAL + position occupancy | B-MGR | R-DURABLE | M-REBUILD | §10 | New identity/no rename tests |
| CAP-023 | Canonical device identity | A-DEVICE | B-EMP/B-MGR/B-HIGH | R-DURABLE/R-SECURITY | M-RETAIN | §10.5 | Alias/canonical identity tests |
| CAP-024 | Device aliases | A-DEVICE | B-MGR/B-HIGH | R-DURABLE | M-RETAIN | §10.5 | Alias cannot authorize tests |
| CAP-025 | Device assignment epoch | A-DEVICE | B-EMP/B-MGR/B-SYSTEM | R-DURABLE/R-SECURITY | M-RETAIN | §§10.5,26.4 | Epoch-bound mutations/acks |
| CAP-026 | Phone assign/reassign/unassign | A-DEVICE command | B-MGR/B-HIGH | R-DURABLE/R-SECURITY | M-REBUILD | §10.6 | Active-work blockers/recovery |
| CAP-027 | Phone quarantine/recovery | A-DEVICE security command | B-HIGH | R-SECURITY | M-REBUILD | §§7,10.6,17.4 | Lost-phone/recovery tests |
| CAP-028 | Native credential vault | A-DEVICE credential | B-EMP/B-HIGH | R-SECURITY | M-RETAIN | §§7.2,17 | DEX/vault/no-JS proof |
| CAP-029 | Employee enrollment | A-DEVICE + A-PRINCIPAL | B-MGR/B-HIGH/B-EMP | R-SECURITY | M-REBUILD | §§7,10 | Prepare/commit/confirm tests |
| CAP-030 | Enrollment cancellation/resume | A-DEVICE operation | B-MGR/B-HIGH | R-SECURITY | M-REBUILD | §10 | Idempotent lifecycle tests |
| CAP-031 | Credential revocation/removal | A-DEVICE security command | B-HIGH | R-SECURITY | M-REBUILD | §§7,10,16 | Pending-work/revocation tests |
| CAP-032 | Named manager identity | A-PRINCIPAL | B-MGR/B-HIGH | R-DURABLE/R-SECURITY | M-REBUILD | §7 | Canonical actor replay |
| CAP-033 | Manager trusted-device enrollment | A-PRINCIPAL credential | B-MGR/B-HIGH | R-SECURITY | M-RETAIN | §7 | Expiring code/device tests |
| CAP-034 | Manager device rename/revoke | A-PRINCIPAL credential command | B-HIGH | R-SECURITY | M-RETAIN | §7 | Revocation propagation |
| CAP-035 | Manager authority tiers | A-PRINCIPAL grant | B-MGR/B-HIGH | R-SECURITY | M-REBUILD | §§7,24 | Deny-by-default matrix; G-MGR-TIERS |
| CAP-036 | CoverAll contractor identity | A-CONTRACTOR | B-CONTRACTOR/B-MGR | R-DURABLE | M-RETIRE/M-REBUILD | §30 | Pseudo-employee migration |
| CAP-037 | Contractor named worker versus vendor slot | A-CONTRACTOR policy | B-CONTRACTOR/B-MGR | R-DURABLE | M-REBUILD | §30 | Named/slot/acceptance fixtures; G-CONTRACTOR |
| CAP-038 | Approved static weekly schedule source | A-STATIC source artifact | B-MGR | R-DURABLE | M-REBUILD | §11 | Provenance/approval; G-SCHED-SOURCE |
| CAP-039 | Static schedule import/normalization | A-STATIC command | B-MGR | R-DURABLE | M-REBUILD | §11 | Original bytes/digest/mapping tests |
| CAP-040 | Static schedule versions/effective dates | A-STATIC version | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §11 | Immutable publication/rollback |
| CAP-041 | Group membership snapshot | A-STATIC snapshot | B-SYSTEM | R-DURABLE | M-REBUILD | §11 | Historical expansion replay |
| CAP-042 | Schedule groups as authoring/display aids | A-STATIC authoring metadata | B-MGR/B-EMP projection | R-DURABLE | M-RETAIN | §§11,14 | No group final authority tests |
| CAP-043 | Individual location as final assignment unit | A-OWNERSHIP | B-ALL | R-DURABLE | M-REBUILD | §14 | Completeness/non-overlap tests |
| CAP-044 | Daily immutable normal baseline | A-STATIC baseline | B-SYSTEM | R-DURABLE | M-REBUILD | §§11,14 | Create-once/source fingerprint |
| CAP-045 | Operational requirement interval | A-OCCURRENCE + A-OPERATING | B-ALL | R-DURABLE | M-REBUILD | §§13,15 | Required/not_required truth tables |
| CAP-046 | General zoo operating policy | A-OPERATING | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §13 | Effective policy; G-HOURS |
| CAP-047 | Location-specific/split operating windows | A-OPERATING | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §13 | Split-window fixtures |
| CAP-048 | September 14 seasonal close | A-OPERATING | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §13 | 5/6 PM transition; G-SEPT14 |
| CAP-049 | After-hours/event operational window | A-OPERATING + A-EVENT | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §§13,27 | Approval/no silent mutation |
| CAP-050 | Cross-midnight service semantics | A-OPERATING + A-OCCURRENCE | B-SYSTEM | R-DURABLE | M-REBUILD | §§13,15 | Day-offset/DST fixtures |
| CAP-051 | Static 9:45 restroom phase | A-STATIC + A-OWNERSHIP | B-MGR/B-EMP | R-DURABLE | M-REBUILD | §14 | 9:44:59→9:45 fixtures |
| CAP-052 | Preserve unaffected non-restroom ownership at 9:45 | A-OWNERSHIP invariant | B-ALL | R-DURABLE | M-REBUILD | §14 | Minimal-change property tests |
| CAP-053 | PTO/absence input | A-OWNERSHIP command | B-MGR | R-DURABLE | M-REBUILD | §14 | Append-only exact-diff fixtures |
| CAP-054 | Callout input | A-OWNERSHIP command | B-MGR | R-DURABLE | M-REBUILD | §14 | Effective-time/diff tests |
| CAP-055 | Contractor capacity exception | A-CONTRACTOR + A-OWNERSHIP | B-MGR/B-CONTRACTOR | R-DURABLE | M-REBUILD | §§14,30 | Acceptance/OPEN fixtures |
| CAP-056 | Exclusive lunch coverage | A-OWNERSHIP transition | B-MGR/B-EMP | R-DURABLE | M-REBUILD | §14 | Exclusivity/boundary; G-LUNCH |
| CAP-057 | Lunch restoration | A-OWNERSHIP transition | B-MGR/B-EMP | R-DURABLE | M-REBUILD | §14 | No departed-owner restore |
| CAP-058 | Lunch spanning 9:45 | A-OWNERSHIP transition | B-MGR/B-EMP | R-DURABLE | M-REBUILD | §14 | Precedence fixtures |
| CAP-059 | Shift-end inheritance | A-OWNERSHIP transition | B-ALL | R-DURABLE | M-REBUILD | §14 | Universal resolver fixtures |
| CAP-060 | Departure before 9:45 | A-OWNERSHIP transition | B-ALL | R-DURABLE | M-REBUILD | §14 | Immediate/later phase tests |
| CAP-061 | Two/one/zero employees remaining | A-OWNERSHIP | B-MGR/B-EMP | R-DURABLE | M-REBUILD | §14 | Exact locations/OPEN fixtures |
| CAP-062 | Explicit OPEN | A-OWNERSHIP + A-OCCURRENCE | B-MGR/B-EMP projection | R-DURABLE | M-REBUILD | §14.7 | Truthful publish/escalation; G-OPEN |
| CAP-063 | Explicit not_required | A-OPERATING + A-OCCURRENCE | B-ALL | R-DURABLE | M-REBUILD | §§13,15 | Reason/policy fixtures |
| CAP-064 | One-time work request | A-ISSUE work-request command | B-MGR/B-EMP | R-DURABLE | M-REBUILD | §21.3 | No ownership mutation tests |
| CAP-065 | Ordinary ownership transfer | A-OWNERSHIP command | B-MGR | R-DURABLE | M-REBUILD | §14 | Exact location/time/reason tests |
| CAP-066 | Emergency override | A-OWNERSHIP command | B-MGR/B-HIGH | R-DURABLE/R-SECURITY | M-REBUILD | §14 | Bounded restore/review tests |
| CAP-067 | Retroactive correction | A-OWNERSHIP correction | B-MGR/B-HIGH | R-DURABLE | M-REBUILD | §§5,14 | Bitemporal/second-approval tests |
| CAP-068 | Deterministic compiler | A-OWNERSHIP | B-SYSTEM | R-DURABLE | M-REBUILD | §14 | Property/repeat/fault tests |
| CAP-069 | Minimal-change objective | A-OWNERSHIP invariant | B-SYSTEM/B-MGR | R-DURABLE | M-REBUILD | §§12.3,14 | Unaffected-owner lock tests |
| CAP-070 | Exact preview/diff/explanation | A-OWNERSHIP candidate projection | B-MGR | R-DURABLE | M-REBUILD | §§14,24 | Preview=publish tests |
| CAP-071 | Atomic ownership publication | A-OWNERSHIP transaction | B-SYSTEM | R-DURABLE | M-REBUILD | §14.6 | Fault injection/outbox atomicity |
| CAP-072 | One read-authority pointer | A-AUTHSET + A-OWNERSHIP | B-ALL | R-DURABLE | M-REBUILD | §§6,14.5 | Mixed-consumer rejection |
| CAP-073 | Immutable historical ownership | A-OWNERSHIP assertions | B-MGR/B-ALL projections | R-DURABLE | M-REBUILD | §14 | Valid/recorded-time replay |
| CAP-074 | Current owner resolver | A-OWNERSHIP resolver | B-ALL | R-OP | M-RETIRE/M-REBUILD | §14.5 | No fallback resolver |
| CAP-075 | Owner reason and revision | A-OWNERSHIP projection | B-ALL role-specific | R-DURABLE | M-REBUILD | §14.5 | Cross-consumer equality |
| CAP-076 | Location/purpose expected workload | A-WORKLOAD | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §12 | Field-source/version; G-WORKLOAD |
| CAP-077 | Service frequency by purpose/window | A-WORKLOAD + A-OCCURRENCE | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §§12,15 | Occurrence-generation fixtures |
| CAP-078 | Difficulty/priority | A-WORKLOAD | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §12 | Source/confidence tests |
| CAP-079 | Zones/clusters | A-WORKLOAD route model | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §12 | Versioned location model |
| CAP-080 | Adjacency/walking time | A-WORKLOAD route model | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §12 | Field validation; G-ROUTE |
| CAP-081 | Restrictions/capabilities | A-PRINCIPAL operational effect | B-MGR/B-HIGH/B-SYSTEM | R-PRIVATE/R-DURABLE | M-REBUILD | §§7.7,12 | Enforcement/redaction |
| CAP-082 | Route coherence in scheduling | A-WORKLOAD + A-OWNERSHIP | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §12.3 | Lower-priority objective tests |
| CAP-083 | No phone-directed walking route | A-PRODUCT copy contract | B-EMP | R-NONE | M-RETAIN | §23.2 | Banned-word/runtime tests |
| CAP-084 | Fair workload analytics | A-WORKLOAD + A-ANALYTICS | B-MGR | R-DURABLE | M-REBUILD | §32 | Context/confidence tests |
| CAP-085 | Four-button employee Home | A-PRODUCT | B-EMP | R-NONE | M-REBUILD | §23.1 | APK asset/UI physical proof |
| CAP-086 | Employee name from enrolled phone | A-DEVICE + A-PRINCIPAL | B-EMP | R-DURABLE | M-REBUILD | §§10.5,23 | No selector/epoch tests |
| CAP-087 | Employee Back/navigation | A-PRODUCT native router | B-EMP | R-NONE | M-REBUILD | §§18,23 | All Back paths/one Home |
| CAP-088 | Protected setup/recovery before Home | A-DEVICE security flow | B-MGR/B-HIGH/B-EMP | R-SECURITY | M-REBUILD | §§10,23 | Enroll/quarantine recovery |
| CAP-089 | Fully Kiosk lock-state entry | A-PHYSICAL + native runtime | B-EMP | R-RELEASE | M-PHYSICAL | §38 | Device Owner/containment matrix |
| CAP-090 | Ambient NFC from all ordinary screens | A-NFC | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §18 | Android/physical matrix |
| CAP-091 | NFC tag registry and location mapping | A-LOCATION + A-NFC | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §§9.6,18 | Tag revision/revoke/audit |
| CAP-092 | NFC cold-start and warm-intent handling | A-NFC native state machine | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §18 | Cold/new-intent tests |
| CAP-093 | Invalid/revoked/duplicate tag handling | A-NFC | B-EMP/B-MGR | R-OP | M-REBUILD | §18.3 | Deterministic safe outcomes |
| CAP-094 | Manual location fallback | A-NFC recovery command | B-MGR/B-EMP limited | R-SECURITY/R-OP | M-OPTIONAL | §18 | Logged manager-supported gate |
| CAP-095 | Direct Start Cleaning after valid scan | A-NFC + A-SESSION | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §§18,16 | NFC-to-Start timing/proof |
| CAP-096 | Cleaning-session state machine | A-SESSION | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §16 | State/command/concurrency tests |
| CAP-097 | Active timer | A-SESSION + A-LOCAL | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §§16,17 | Restore/clock tests |
| CAP-098 | Screen-off/wake restoration | A-LOCAL | B-EMP | R-OP | M-PHYSICAL | §§17,38 | Same timer/form proof |
| CAP-099 | Process/WebView restoration | A-LOCAL native owner | B-EMP | R-OP | M-PHYSICAL | §§17,38 | Process-death instrumentation |
| CAP-100 | Completion-form draft persistence | A-LOCAL + A-COMPLETION | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §§17,20 | Draft migration/recovery |
| CAP-101 | Offline provisional work | A-LOCAL + record envelope | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §17 | Snapshot/time/authority tests |
| CAP-102 | Exactly-once offline reconciliation | A-LOCAL + domain aggregate | B-EMP/B-SYSTEM | R-DURABLE | M-REBUILD | §17.5 | Idempotency/poison/conflict |
| CAP-103 | Cross-ownership active session | A-SESSION + A-OWNERSHIP | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §16.3 | Ownership transition fixtures |
| CAP-104 | Device reassignment blocked by active/offline work | A-DEVICE + A-SESSION/A-LOCAL | B-MGR/B-HIGH | R-SECURITY | M-REBUILD | §§10.6,16.4 | Reassignment/quarantine tests |
| CAP-105 | Employee-safe error vocabulary | A-PRODUCT | B-EMP | R-NONE | M-REBUILD | §23.6 | Copy lint and state tests |
| CAP-106 | 48dp/glove-friendly controls | A-PRODUCT | B-EMP | R-RELEASE | M-PHYSICAL | §§23,38 | Geometry/glove tests |
| CAP-107 | Large text/long name/keyboard handling | A-PRODUCT | B-EMP | R-RELEASE | M-PHYSICAL | §§23,38 | 200%/keyboard screenshots |
| CAP-108 | Performance budgets | A-DR/SLO + A-PHYSICAL | B-ALL | R-RELEASE | M-PHYSICAL | §§35,38 | Instrumented budgets; G-SLO |
| CAP-109 | Karen no-rescue acceptance | A-PHYSICAL | B-EMP | R-RELEASE | M-PHYSICAL | §38 | Observed task matrix; G-PHYSICAL-ACCEPTANCE |
| CAP-110 | Restroom completion evidence | A-COMPLETION | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §20 | Taxonomy/progressive/physical |
| CAP-111 | Exhibit completion evidence | A-COMPLETION | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §20 | Distinct taxonomy/physical |
| CAP-112 | Other area-type evidence | A-COMPLETION taxonomy | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §20.1 | Form registry; G-TAXONOMY |
| CAP-113 | Full-clean shortcut | A-COMPLETION command | B-EMP | R-DURABLE | M-REBUILD | §20.2 | Three-decision usability |
| CAP-114 | Services-performed taxonomy | A-COMPLETION taxonomy | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §20.1 | Version/conversion tests |
| CAP-115 | Cleaning notes | A-COMPLETION evidence | B-EMP/B-MGR | R-DURABLE/R-PRIVATE | M-REBUILD | §20 | Bounds/redaction tests |
| CAP-116 | Maintenance observation | A-ISSUE | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §21 | Observation→issue tests |
| CAP-117 | Supply shortage | A-ISSUE supply domain | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §21 | Supply lifecycle tests |
| CAP-118 | Out-of-order fixture | A-ISSUE + A-STATUS | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §§21,22 | Severity/readiness/closure |
| CAP-119 | Maintenance ticket | A-ISSUE ticket | B-MGR | R-DURABLE | M-REBUILD | §21 | Source/link/history tests |
| CAP-120 | Work-order-submitted end state | A-ISSUE ticket | B-MGR/B-RO projection | R-DURABLE | M-REBUILD | §21.2 | OPEN→W.O. Submitted tests |
| CAP-121 | Ticket closure/correction | A-ISSUE correction | B-MGR | R-DURABLE | M-REBUILD | §§5,21 | Actor/reason/append-only |
| CAP-122 | Recurring issue/pattern detection | A-ISSUE + A-ANALYTICS | B-MGR | R-DURABLE | M-REBUILD | §32 | Repeat/false-duplicate rules |
| CAP-123 | Canonical service requirement | A-OCCURRENCE + A-OPERATING | B-ALL | R-DURABLE | M-REBUILD | §§13,15 | Requirement generation tests |
| CAP-124 | Due-soon/overdue episode | A-OCCURRENCE | B-ALL | R-DURABLE | M-REBUILD | §§15,26 | Stable ID lifecycle tests |
| CAP-125 | In-progress state | A-OCCURRENCE + A-SESSION | B-ALL | R-DURABLE | M-REBUILD | §§15,16,22 | Separate work/readiness tests |
| CAP-126 | Accepted completion | A-COMPLETION + A-OCCURRENCE | B-EMP/B-MGR | R-DURABLE | M-REBUILD | §§20,15 | Atomic satisfaction tests |
| CAP-127 | Issue/follow-up state | A-ISSUE + A-STATUS | B-MGR/B-RO | R-DURABLE | M-REBUILD | §§21,22 | Severity/readiness truth tables |
| CAP-128 | Inspection readiness | A-STATUS | B-MGR/B-RO | R-DURABLE | M-REBUILD | §22 | Versioned resolver; G-READINESS |
| CAP-129 | Manager correction/reopen/cancel-not-required | A-OCCURRENCE/A-STATUS correction | B-MGR/B-HIGH | R-DURABLE | M-REBUILD | §§15.7,22 | Cascade/approval tests |
| CAP-130 | Scan/start never resolves overdue | A-OCCURRENCE invariant | B-ALL | R-DURABLE | M-RETIRE/M-ENFORCE | §§15,18 | Negative scan/start tests |
| CAP-131 | Manager Hub | A-PRODUCT | B-MGR | R-OP | M-REBUILD | §24 | Route/capability/field tests |
| CAP-132 | Dashboard live status | A-STATUS projection | B-MGR/B-RO | R-OP | M-REBUILD | §§22,24 | Cross-fact/freshness tests |
| CAP-133 | Current owner and reason | A-OWNERSHIP projection | B-MGR/B-RO policy | R-DURABLE | M-REBUILD | §§14.5,22 | Cross-consumer equality |
| CAP-134 | Active cleaner | A-SESSION projection | B-MGR/B-RO policy | R-DURABLE | M-REBUILD | §§16,22 | Distinct field tests |
| CAP-135 | Actual/last cleaner | A-COMPLETION projection | B-MGR/B-RO policy | R-DURABLE | M-REBUILD | §§20,22 | Historical performer tests |
| CAP-136 | Data freshness/confidence | record/projection metadata | B-MGR/B-RO | R-DURABLE | M-REBUILD | §§5,22 | Stale/unknown wording |
| CAP-137 | Exact schedule preview/diff/publish | A-OWNERSHIP candidate | B-MGR | R-DURABLE | M-REBUILD | §§14,24 | Preview=publish/exact diff |
| CAP-138 | OPEN exceptions | A-OWNERSHIP + A-NOTIF | B-MGR | R-DURABLE | M-REBUILD | §§14.7,26 | Queue/escalation; G-OPEN |
| CAP-139 | Manager inspection | A-INSPECTION | B-MGR | R-DURABLE | M-REBUILD | §22.3 | Rubric/actor/correction tests |
| CAP-140 | Inspection types/scores/findings | A-INSPECTION taxonomy | B-MGR | R-DURABLE | M-REBUILD | §22.3 | Versioned rubric tests |
| CAP-141 | Inspection coverage | A-INSPECTION policy | B-MGR | R-DURABLE | M-REBUILD | §22 | Spot-check policy; G-INSPECTION |
| CAP-142 | Employee/location comparison | A-ANALYTICS | B-MGR | R-DURABLE | M-REBUILD | §32 | Sample/context/confidence gate |
| CAP-143 | Cleaning duration analysis | A-ANALYTICS | B-MGR | R-DURABLE | M-REBUILD | §32 | Offline/transfer/context tests |
| CAP-144 | Ticket trend analysis | A-ANALYTICS + A-ISSUE | B-MGR | R-DURABLE | M-REBUILD | §32 | Repeat/hotspot definitions |
| CAP-145 | Workload/fairness analysis | A-ANALYTICS + A-WORKLOAD | B-MGR | R-DURABLE | M-REBUILD | §32 | Versioned workload/owner/cleaner |
| CAP-146 | Anti-disciplinary misuse protections | A-ANALYTICS policy | B-MGR/B-HIGH | R-SECURITY/R-DURABLE | M-REBUILD | §32.2 | Structural suppression/audit |
| CAP-147 | Attendance context | A-PRODUCT informational source | B-MGR | R-OP/R-PRIVATE | M-REBUILD | §8.6 | Fresh/stale/privacy/no-write; G-MGR-ATTENDANCE |
| CAP-148 | Weather context | A-PRODUCT informational source | B-MGR | R-PRESENT | M-OPTIONAL | §8.7 | Disabled default; G-WEATHER |
| CAP-149 | Employee direct messages | A-MSG | B-EMP/B-MGR | R-PRESENT/R-OP | M-REBUILD | §25 | Direct-recipient UX/auth tests |
| CAP-150 | Manager direct/group/broadcast | A-MSG + A-PRINCIPAL | B-MGR | R-PRESENT/R-OP | M-REBUILD | §25 | Capability/recipient tests |
| CAP-151 | Memphis AI thread | A-MSG + A-TOOL | B-EMP/B-MGR policy | R-PRESENT/R-PRIVATE | M-REBUILD | §§25,31 | No read mutation/source freshness |
| CAP-152 | Thread identity and stale-response rejection | A-MSG | B-EMP/B-MGR | R-OP | M-REBUILD | §25.2 | Zero wrong-frame tests |
| CAP-153 | Immediate optimistic send | A-MSG operation | B-EMP/B-MGR | R-OP | M-RETAIN | §25.3 | Local/server reconciliation |
| CAP-154 | Messenger offline outbox | A-MSG + A-LOCAL | B-EMP/B-MGR | R-OP | M-REBUILD | §25.3 | Idempotency/poison tests |
| CAP-155 | Incremental sync/long polling | A-MSG projection | B-EMP/B-MGR | R-OP | M-RETAIN | §25 | Cursor/lifecycle tests |
| CAP-156 | Conversation hide/delete per user/device | A-MSG visibility operation | B-EMP/B-MGR | R-OP/R-PRESENT | M-REBUILD | §25.4 | User-scoped/offline/device-move; G-MSG-POLICY |
| CAP-157 | Accessible delete alternative | A-PRODUCT/A-MSG | B-EMP | R-NONE | M-REBUILD | §25.4 | Swipe + visible action physical tests |
| CAP-158 | Message retention/archive | A-RETENTION + A-MSG | B-MGR/B-EMP | R-PRESENT/R-OP | M-REBUILD | §§25.4,34 | Archive/reappearance/content policy |
| CAP-159 | Operational alerts separate from chat | A-NOTIF versus A-MSG | B-ALL | R-DURABLE/R-PRESENT | M-REBUILD | §§25,26 | No chat as alert authority |
| CAP-160 | Notification intent | A-NOTIF child intent | B-SYSTEM | R-DURABLE | M-REBUILD | §26 | Stable episode/recipient tests |
| CAP-161 | Final recipient revalidation | A-NOTIF | B-SYSTEM | R-DURABLE | M-REBUILD | §26.3 | Owner/status/epoch/capability tests |
| CAP-162 | Transport/provider job | A-NOTIF worker attempt | B-SYSTEM | R-OP | M-REBUILD | §§5,26 | Lease/retry/terminal tests |
| CAP-163 | Device receipt/presentation | A-NOTIF presentation | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §26.5 | Native state/physical tests |
| CAP-164 | Exact two-cycle audio | A-NOTIF presentation | B-EMP | R-RELEASE | M-PHYSICAL | §26.6 | Recorded exact cadence; G-NOTIF-P0 |
| CAP-165 | Persistent Open/Dismiss overlay | A-NOTIF presentation group | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §26 | FIFO/persistence tests |
| CAP-166 | Displayed/opened/dismissed acknowledgement | A-NOTIF receipt | B-EMP/B-SYSTEM | R-OP | M-REBUILD | §26.4 | Employee/device/credential/epoch binding |
| CAP-167 | Dismissal independent from work resolution | A-NOTIF/A-OCCURRENCE invariant | B-ALL | R-DURABLE | M-RETAIN | §26.5 | Negative resolution tests |
| CAP-168 | Manager escalation | A-NOTIF escalation | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §26.8 | Chain/fallback/cancel tests; G-ESCALATION |
| CAP-169 | No duplicate OS/browser/native sound | A-NOTIF native owner | B-EMP | R-RELEASE | M-PHYSICAL | §§18,26 | Audio capture/asset tests |
| CAP-170 | No replay after lifecycle events | A-NOTIF presentation state | B-EMP | R-OP | M-REBUILD/M-PHYSICAL | §26.6 | Wake/reconnect/navigation tests |
| CAP-171 | Event identity/revisions | A-EVENT | B-MGR/B-EMP/B-RO | R-DURABLE | M-REBUILD | §27 | Immutable revision/supersession tests |
| CAP-172 | Manual event form | A-EVENT candidate command | B-MGR | R-DURABLE | M-REBUILD | §27 | Validation/authorization tests |
| CAP-173 | Quick-paste parser | A-EVENT candidate parser | B-MGR | R-OP | M-RETAIN/M-REBUILD | §27 | Parse→review/no authority tests |
| CAP-174 | Spreadsheet/document import | A-EVENT candidate import | B-MGR | R-OP | M-REBUILD | §27 | Preview/unresolved/no mutation |
| CAP-175 | Event scope/venue/coverage distinction | A-EVENT taxonomy | B-MGR/B-EMP projection | R-DURABLE | M-RETAIN | §27 | Field/domain validation |
| CAP-176 | Event publish/update/cancel | A-EVENT command/revision | B-MGR | R-DURABLE | M-REBUILD | §27 | Supersession/reversal transaction |
| CAP-177 | Employee event notices | A-EVENT projection | B-EMP | R-PRESENT | M-REBUILD | §§23.4,27 | Information/approved work wording |
| CAP-178 | Event reminders | A-EVENT + A-NOTIF | B-EMP/B-MGR | R-OP | M-REBUILD | §§26,27 | Timing/dedupe/current audience |
| CAP-179 | Custodial impact proposal | A-EVENT proposal | B-MGR | R-DURABLE | M-REBUILD | §27 | Proposal≠approval tests |
| CAP-180 | Approved operational requirement change | A-EVENT approved command + A-OCCURRENCE | B-MGR/B-SYSTEM | R-DURABLE | M-REBUILD | §27 | Separate approval/publication |
| CAP-181 | Event save never mutates schedule | A-EVENT invariant | B-MGR/B-SYSTEM | R-DURABLE | M-RETIRE/M-ENFORCE | §27.2 | Negative route/trigger/AI tests |
| CAP-182 | Guest QR intake | A-GUEST | B-PUBLIC | R-PRIVATE | M-OPTIONAL | §28 | Disabled gate/rate/privacy |
| CAP-183 | Guest privacy/rate limiting | A-GUEST + A-SECURITY | B-PUBLIC/B-MKT | R-PRIVATE | M-OPTIONAL | §28 | Abuse/data-minimization tests |
| CAP-184 | Marketing review | A-GUEST review command + A-PRINCIPAL | B-MKT | R-DURABLE/R-PRIVATE | M-REBUILD | §28 | Named review/negative authority |
| CAP-185 | Guest issue current-owner routing | A-GUEST + A-OWNERSHIP | B-MGR/B-EMP | R-DURABLE | M-REBUILD | §28 | Reroute after ownership change |
| CAP-186 | Guest follow-up/closure/redaction | A-GUEST status | B-MKT/B-MGR | R-PRIVATE | M-REBUILD | §28 | Closure/redaction/retention tests |
| CAP-187 | Guest recurring-pattern analytics | A-GUEST + A-ANALYTICS | B-MGR | R-DURABLE | M-OPTIONAL | §§28,32 | Approved facts/sample thresholds |
| CAP-188 | Employee app feedback/help | A-FEEDBACK | B-EMP/B-MGR | R-PRIVATE/R-OP | M-REBUILD | §29 | Plain categories/offline tests |
| CAP-189 | Maintenance/supply/work-request reporting split | A-ISSUE/A-FEEDBACK | B-EMP/B-MGR | R-DURABLE/R-PRIVATE | M-REBUILD | §§21,23.5,29 | Scenario routing tests |
| CAP-190 | Feedback attachments | A-FEEDBACK attachment | B-EMP/B-MGR | R-PRIVATE | M-REBUILD | §29 | Encryption/type/malware/hold tests |
| CAP-191 | Manager feedback triage | A-FEEDBACK triage | B-MGR | R-PRIVATE | M-REBUILD | §§24,29 | Manager-only assets/API |
| CAP-192 | Contractor engagement | A-CONTRACTOR | B-MGR/B-CONTRACTOR | R-DURABLE | M-REBUILD | §30 | Lifecycle/history tests |
| CAP-193 | Contractor assignment revision | A-CONTRACTOR | B-MGR/B-CONTRACTOR | R-DURABLE | M-REBUILD | §30 | Exact revision/diff tests |
| CAP-194 | Secure contractor link | A-CONTRACTOR credential | B-CONTRACTOR | R-SECURITY/R-DURABLE | M-REBUILD | §§7,30 | Expire/revoke/no-store tests |
| CAP-195 | Contractor delivery and acknowledgement | A-CONTRACTOR | B-CONTRACTOR/B-MGR | R-DURABLE | M-REBUILD | §30 | Assigned≠delivered≠accepted |
| CAP-196 | Contractor actual cleaner evidence | A-CONTRACTOR + A-COMPLETION | B-CONTRACTOR/B-MGR | R-DURABLE | M-REBUILD | §30 | Named/slot truth tests |
| CAP-197 | Unreachable contractor leaves OPEN/requires action | A-CONTRACTOR + A-OWNERSHIP/A-NOTIF | B-MGR | R-DURABLE | M-REBUILD | §§14,26,30 | Unreachable/OPEN/escalation |
| CAP-198 | Memphis AI operational answers | A-TOOL | B-EMP/B-MGR policy | R-PRIVATE/R-OP | M-REBUILD | §31 | Source/freshness/no invention |
| CAP-199 | MCP connected access | A-TOOL + A-PRINCIPAL | B-TOOL | R-SECURITY/R-PRIVATE | M-REBUILD | §31 | Tool schema/grant/audit tests |
| CAP-200 | Moxie notes/reminders/contacts | A-TOOL separate workspace | B-TOOL/B-MGR | R-PRIVATE | M-OPTIONAL | §31.4 | Explicit role; G-MOXIE |
| CAP-201 | Controlled diagnostics | A-TOOL | B-HIGH | R-SECURITY | M-REBUILD | §31 | Isolated product/capability tests |
| CAP-202 | Controlled repair actions | A-TOOL + A-PRINCIPAL | B-HIGH/B-SYSTEM | R-SECURITY/R-RELEASE | M-REBUILD | §31.3 | Proposal/approval/job/rollback |
| CAP-203 | AI read versus write classification | A-TOOL registry | B-TOOL | R-SECURITY | M-REBUILD | §31.1 | Server-enforced classification |
| CAP-204 | AI action confirmation/second approval | A-PRINCIPAL authorization | B-MGR/B-HIGH | R-SECURITY | M-REBUILD | §§7,31 | Human UI/dual approval; G-AI-WRITE |
| CAP-205 | AI source citation/freshness | A-TOOL result envelope | B-EMP/B-MGR | R-OP | M-REBUILD | §31 | Evidence metadata tests |
| CAP-206 | AI hallucination containment | A-TOOL registry | B-TOOL | R-SECURITY | M-REBUILD | §31 | Bounded tools/uncertainty tests |
| CAP-207 | Reads never mutate schedules | A-TOOL/A-OWNERSHIP invariant | B-ALL | R-DURABLE | M-RETIRE/M-ENFORCE | §§4,27,31 | No-read-write call graph tests |
| CAP-208 | Forced RLS on protected tables | A-SECURITY | B-SYSTEM/B-HIGH | R-SECURITY | M-REBUILD | §33 | Exact policies/roles/grants |
| CAP-209 | Revoked broad function execution | A-SECURITY manifest | B-SYSTEM/B-HIGH | R-SECURITY | M-REBUILD | §§33,36 | Function grant audit |
| CAP-210 | Locked privileged search paths | A-SECURITY manifest | B-SYSTEM/B-HIGH | R-SECURITY | M-REBUILD | §§33,36 | Search-path lint/advisor closure |
| CAP-211 | Public submission controls | A-SECURITY + A-GUEST/A-FEEDBACK | B-PUBLIC | R-PRIVATE/R-SECURITY | M-REBUILD | §§28,29,33 | Rate/schema/abuse tests |
| CAP-212 | Read Only field redaction | A-PRODUCT + A-SECURITY | B-RO | R-OP | M-REBUILD | §§8.3,33 | Dedicated field allowlist |
| CAP-213 | Employee privacy from manager/diagnostic data | A-PRODUCT + A-SECURITY | B-EMP | R-PRIVATE | M-REBUILD | §§8,23,33 | Asset/API negative tests |
| CAP-214 | Raw GPS privacy | A-GPS + A-RETENTION | B-MGR/B-HIGH | R-GPSRAW | M-REBUILD | §§19,34 | Role/use/retention tests; G-GPS |
| CAP-215 | Data-class retention matrix | A-RETENTION | B-ALL role-specific | R-DURABLE | M-REBUILD | §34 | Cross-store purge/hold; G-RETENTION |
| CAP-216 | Message presentation retention | A-RETENTION + A-MSG | B-EMP/B-MGR | R-PRESENT | M-REBUILD | §§25,34 | Content/audit split |
| CAP-217 | Event notice retention | A-RETENTION + A-EVENT | B-EMP/B-MGR/B-RO | R-PRESENT/R-DURABLE | M-REBUILD | §§27,34 | Notice/source/impact split |
| CAP-218 | Durable responsibility/session/inspection history | A-RETENTION | B-MGR/B-HIGH | R-DURABLE | M-RETAIN | §34 | No communication-purge cascade |
| CAP-219 | Guest contact redaction | A-RETENTION + A-GUEST | B-MKT/B-MGR | R-PRIVATE | M-REBUILD | §§28,34 | Redaction/purge/hold tests |
| CAP-220 | Raw GPS retention | A-RETENTION + A-GPS | B-MGR/B-HIGH | R-GPSRAW | M-REBUILD | §§19,34 | Period/hold/summary; G-GPS/G-RETENTION |
| CAP-221 | Encrypted production backup | A-DR | B-HIGH | R-RELEASE/R-PRIVATE | M-RETAIN | §35 | Hash/key custody/restore tests |
| CAP-222 | Clean database rebuild | A-DR + A-MIGRATION | B-HIGH | R-RELEASE | M-RETAIN | §§35,36 | Empty rebuild/fingerprint |
| CAP-223 | Restore drill | A-DR | B-HIGH | R-RELEASE | M-REBUILD | §35 | Complete-bundle drill; G-RESTORE |
| CAP-224 | Schema fingerprint | A-RELEASE/A-MIGRATION | B-HIGH | R-RELEASE | M-RETAIN | §§36,37 | Complete-manifest fingerprint |
| CAP-225 | Graceful worker drainage/shutdown | A-AUTHSET/A-DR | B-SYSTEM/B-HIGH | R-RELEASE | M-REBUILD | §§6,35 | Lease/drain/fault tests |
| CAP-226 | Complete current writer/reader graph | A-MIGRATION retirement inventory | B-HIGH | R-RELEASE | M-REBUILD | §36 | Source/DB/API/cron/tool inventory |
| CAP-227 | Read-only export and source hashes | A-MIGRATION evidence | B-HIGH | R-RELEASE | M-REBUILD | §36 | Digest/reproducibility tests |
| CAP-228 | Isolated schema/environment | A-MIGRATION | B-HIGH | R-RELEASE | M-RETAIN | §36 | No production writes gate |
| CAP-229 | Shadow compilation/read comparison | A-MIGRATION | B-HIGH/B-MGR review | R-RELEASE | M-REBUILD | §36 | No production presentation |
| CAP-230 | Difference classification | A-MIGRATION evidence | B-MGR/B-HIGH | R-RELEASE | M-RETAIN | §36 | Every unexplained diff blocks |
| CAP-231 | One atomic all-consumer cutover | A-AUTHSET | B-HIGH/B-SYSTEM | R-RELEASE | M-REBUILD | §6 | Distributed activation/fault tests |
| CAP-232 | Legacy writer retirement | A-MIGRATION retirement manifest | B-HIGH | R-RELEASE | M-REBUILD/M-RETIRE | §36.3 | No-unregistered-authority; G-RETIRE-001 |
| CAP-233 | Complete rollback | A-AUTHSET + A-DR | B-HIGH | R-RELEASE | M-REBUILD | §§6.8,35,36 | Pending-work/full-set restore |
| CAP-234 | Source freeze and release tuple | A-RELEASE | B-HIGH | R-RELEASE | M-RETAIN | §37 | Exact tuple verification |
| CAP-235 | Generated asset provenance | A-RELEASE | B-HIGH | R-RELEASE | M-REBUILD | §37 | Byte/producer/runtime graph |
| CAP-236 | Custodial asset allowlist | A-RELEASE + A-PRODUCT | B-EMP | R-RELEASE | M-RETAIN | §§8,37 | Prohibited asset/module tests |
| CAP-237 | Production signer enforcement | A-RELEASE | B-HIGH | R-RELEASE | M-RETAIN | §37 | Certificate/public-key proof |
| CAP-238 | VersionCode anti-rollback | A-RELEASE | B-HIGH/B-EMP | R-RELEASE | M-RETAIN | §37 | Fleet floor/admission tests |
| CAP-239 | APK producer admission | A-RELEASE | B-HIGH | R-RELEASE | M-RETAIN | §37 | Source→artifact proof |
| CAP-240 | APK consumer admission | A-RELEASE | B-HIGH | R-RELEASE | M-RETAIN | §37 | Independent artifact verification |
| CAP-241 | Native vault/DEX/manifest proof | A-RELEASE + A-DEVICE | B-HIGH/B-EMP | R-RELEASE/R-SECURITY | M-RETAIN | §37 | Native boundary proof |
| CAP-242 | Build 22 rollback | A-RELEASE/A-AUTHSET | B-HIGH/B-EMP | R-RELEASE | M-RETAIN | §§6.8,37,38 | Compatibility/pending-work tests; G-BUILD22 |
| CAP-243 | One-phone canary | A-RELEASE + A-PHYSICAL | B-HIGH/B-EMP | R-RELEASE | M-FUTURE | §§37,38 | Controlled canary/rollback |
| CAP-244 | Fully Kiosk containment | A-PHYSICAL | B-EMP | R-RELEASE | M-PHYSICAL | §38.1 | Home/Recents/reboot/escape |
| CAP-245 | NFC physical acceptance | A-PHYSICAL/A-NFC | B-EMP | R-RELEASE | M-PHYSICAL | §38.3 | Full state/tag matrix |
| CAP-246 | Notification physical acceptance | A-PHYSICAL/A-NOTIF | B-EMP | R-RELEASE | M-PHYSICAL | §38.5 | Audio/overlay/group/revoke |
| CAP-247 | Offline/reconnect physical acceptance | A-PHYSICAL/A-LOCAL | B-EMP | R-RELEASE | M-PHYSICAL | §38.4 | Exactly-once/no-loss |
| CAP-248 | GPS physical calibration | A-PHYSICAL/A-GPS | B-EMP/B-MGR | R-RELEASE/R-GPSRAW | M-PHYSICAL | §§19,38.6 | Accuracy/battery/permission |
| CAP-249 | Messenger physical performance/privacy | A-PHYSICAL/A-MSG | B-EMP | R-RELEASE | M-PHYSICAL | §38.6 | Thread timing/zero stale frame |
| CAP-250 | Accessibility/Karen acceptance | A-PHYSICAL | B-EMP | R-RELEASE | M-PHYSICAL | §§23,38.7 | No-rescue threshold |
| CAP-251 | Controlled fleet rollout | A-RELEASE | B-HIGH/B-EMP | R-RELEASE | M-FUTURE | §37 | Canary, config consistency, rollback |
| CAP-252 | Final release audit | A-RELEASE | B-HIGH | R-RELEASE | M-FUTURE | §§37–39 | Independent complete evidence review |

---

## 3. Reverse architecture-object registry

| V4.2 object/domain | Capability IDs |
|---|---|
| Evidence manifest and capability trace | CAP-001–CAP-010, CAP-226–CAP-252 |
| Canonical record envelope/registry | CAP-003, CAP-071, CAP-073, CAP-102, CAP-124–CAP-130, CAP-160–CAP-170, CAP-227–CAP-233 |
| Authority-set protocol | CAP-071–CAP-075, CAP-102–CAP-104, CAP-160–CAP-170, CAP-225, CAP-229–CAP-233, CAP-242–CAP-252 |
| Principal/grant/authorization model | CAP-011–CAP-037, CAP-081, CAP-131, CAP-146–CAP-151, CAP-184, CAP-198–CAP-214, CAP-221–CAP-225 |
| Location registry/transition | CAP-041–CAP-050, CAP-076–CAP-080, CAP-090–CAP-095, CAP-103, CAP-116–CAP-130, CAP-171–CAP-197, CAP-245 |
| Static schedule/ownership | CAP-038–CAP-075, CAP-076–CAP-084, CAP-123–CAP-130, CAP-137–CAP-138, CAP-226–CAP-233 |
| Employee/native/offline/GPS | CAP-005, CAP-023–CAP-031, CAP-085–CAP-109, CAP-149, CAP-152–CAP-170, CAP-188–CAP-190, CAP-241–CAP-250 |
| Completion/issues/status/inspection | CAP-110–CAP-146, CAP-159–CAP-170, CAP-187, CAP-189–CAP-191 |
| Messenger/notifications | CAP-014, CAP-149–CAP-170, CAP-198, CAP-246, CAP-249 |
| Events/guest/feedback/contractors | CAP-007–CAP-008, CAP-037, CAP-049, CAP-055, CAP-171–CAP-197 |
| AI/MCP/Moxie/diagnostics | CAP-009, CAP-151, CAP-198–CAP-207 |
| Security/retention/DR | CAP-208–CAP-225, CAP-232–CAP-242 |
| Migration/release/physical | CAP-226–CAP-252 |

No v4.2 object is accepted unless it appears in this reverse registry or a later audited revision.

---

## 4. Trace acceptance

This trace is complete at CAP-ID/domain/architecture/gate level. Before schema design it must be revalidated against:

- final v4.2 internal audit;
- four independent v4.2 audits;
- updated evidence manifest digests;
- resolved policy/research gates;
- exact source/API/SQL/test references added during isolated design.

It does not authorize schema, component or implementation work.