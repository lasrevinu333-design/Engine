# Memphis Zoo Custodial Program — Whole-System Capability Canon v1

**Status:** Provisional canon for architecture; no implementation authorization  
**Prepared:** 2026-08-04  
**Evidence:** Final Report v17, actual frontend/native/backend, SELECT-only production research, current operating decisions and independent audits

---

## 1. Purpose

This canon prevents legitimate program capability from disappearing because it was omitted from one report or hidden in current source. It also prevents obsolete behavior from surviving merely because it is deployed or appears in a historical screenshot.

Every capability must receive one explicit disposition and one architectural home. This version is a controlled starting point for Unified Whole-System Architecture v4 and remains subject to source, field, physical and policy verification.

### Dispositions

- **RETAIN:** legitimate capability with a sound enough principle to preserve.
- **REBUILD:** legitimate capability requiring the unified foundation.
- **PARTIAL:** useful pieces exist, but end-to-end truth is not proven.
- **MISSING:** required capability has no complete implementation or architecture.
- **CONTRADICTORY:** current behavior conflicts with current authority or another system layer.
- **RETIRE:** obsolete or harmful behavior.
- **OPTIONAL:** approval-gated, not current core release.
- **FUTURE:** deliberately outside current release.
- **PHYSICAL:** source cannot establish final result.
- **RESEARCH:** evidence must be collected before design freezes.
- **DECISION:** genuine Eric policy decision remains.

### Evidence codes

- **V17:** Final Report v17 text or screenshot.
- **DEC:** current explicit product/operating decision.
- **SRC:** frontend/native/backend source.
- **DB:** deployed schema/function/data evidence.
- **OPS:** field operating practice or manager policy.
- **PHY:** real Moto G/Fully Kiosk evidence required.
- **AUD:** independent audit finding corroborated by primary evidence.

---

## 2. Operating purpose and product boundaries

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-001 | Remove uncertainty from custodial operations | V17, OPS | Valid top-level purpose | RETAIN | Chapter 1 purpose and measurable outcomes |
| CAP-002 | Distinguish not reached from poorly cleaned | V17 | Under-defined in current status | REBUILD | Status/readiness truth model |
| CAP-003 | One connected daily operating record | V17, SRC | Fragmented across domains | REBUILD | Cross-domain event and evidence contracts |
| CAP-004 | Full Access Manager product | V17, SRC, DEC | Broad surfaces, no single final contract | REBUILD | Manager product contract |
| CAP-005 | Custodial Employee Android product | DEC, SRC | Hybrid runtime and conflicting UI | REBUILD | Employee product and native runtime contracts |
| CAP-006 | Private Read Only product | DEC, SRC | Existing Viewer includes prohibited Feedback/public framing | REBUILD | Dashboard/Events-only projection and redaction |
| CAP-007 | Guest public product | V17, SRC, DEC | Feature-gated and dormant | OPTIONAL | Public intake/Marketing/privacy architecture |
| CAP-008 | Contractor product | SRC, OPS | Secure links exist; pseudo-employee authority remains | REBUILD | Contractor engagement, assignment and acceptance |
| CAP-009 | AI/MCP/diagnostic products | SRC | Capability exists with fragmented authority | REBUILD | Privileged tool registry and isolation |
| CAP-010 | Product-specific route/asset allowlists | SRC | Partial strong controls | RETAIN/REBUILD | Build graph and field-level projection tests |

---

## 3. Identity, workforce and device lifecycle

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-011 | Permanent employee identity | DEC, DB | Valid UUID history; overloaded eligibility | RETAIN principle | Immutable identity entity |
| CAP-012 | Employment state | DB, AUD | One `active` Boolean conflates meanings | REBUILD | Effective-dated employment lifecycle |
| CAP-013 | Schedule eligibility | DB | Derived from `employees.active` and roster | REBUILD | Separate eligibility facts |
| CAP-014 | Messenger eligibility | SRC, DB | Coupled to employee/user active state | REBUILD | Separate messaging lifecycle |
| CAP-015 | Phone eligibility | SRC, DB | Coupled to employee/device state | REBUILD | Separate device assignment policy |
| CAP-016 | Stable schedule position | DEC, architecture v3.1 | Conceptual only | RETAIN/REBUILD | Position registry |
| CAP-017 | Effective position occupancy | DEC | Missing canonical production object | REBUILD | Non-overlapping position assignments |
| CAP-018 | Vacancy as first-class state | DEC, AUD | Missing; historical employees remain active | REBUILD | Vacancy/compiler input |
| CAP-019 | Named person-bound schedule rule | DEC | Policy unresolved | DECISION/RESEARCH | Explicit reviewed exception to position model |
| CAP-020 | Employee onboarding | SRC, DB | Creation and phone assignment exist, incomplete workflow | REBUILD | Identity → eligibility → Messenger → position → phone admission |
| CAP-021 | Employee offboarding | SRC, DB | Active Boolean and device release insufficient | REBUILD | Historical preservation and eligibility closure |
| CAP-022 | Replacement employee | DEC | Current model risks identity reuse | REBUILD | New identity occupying prior position |
| CAP-023 | Canonical device identity | SRC, DB | Strong KIOSK identity foundation | RETAIN | Device registry |
| CAP-024 | Device aliases | SRC, DB | Useful migration/recovery mechanism | RETAIN with restriction | Alias cannot become competing identity |
| CAP-025 | Device assignment epoch | SRC, DB | Valid current capability | RETAIN | Every device-scoped write/read binds epoch |
| CAP-026 | Phone assign/reassign/unassign | SRC, DB | Manager capability exists; active-work rules incomplete | REBUILD | Transactional lifecycle and protected blockers |
| CAP-027 | Phone quarantine/recovery | SRC, DB | Partial strong security mechanisms | REBUILD | One recovery state machine |
| CAP-028 | Native credential vault | SRC | Strong boundary | RETAIN | First-party protected storage and no JS exposure |
| CAP-029 | Employee enrollment | SRC, DB | Valid manager-assisted flow | REBUILD | Idempotent prepare/commit/confirm lifecycle |
| CAP-030 | Enrollment cancellation/resume | SRC, DB | Exists, final product contract incomplete | REBUILD | Protected operation lifecycle |
| CAP-031 | Credential revocation/removal | SRC, DB | Exists; active work/offline queue handling incomplete | REBUILD | Reconciliation before identity release |
| CAP-032 | Named manager identity | SRC, DB | Valid manager access exists | RETAIN/REBUILD | Canonical actor identity and authority tiers |
| CAP-033 | Manager trusted-device enrollment | SRC, DB | Valid | RETAIN | Expiring single-use codes and audit |
| CAP-034 | Manager device rename/revoke | SRC, DB | Valid | RETAIN | Named actor, recovery and self-revocation rules |
| CAP-035 | Manager authority tiers | DEC, AUD | Beyond Full Access/Read Only unresolved | DECISION | Role/capability matrix |
| CAP-036 | CoverAll contractor identity | DEC, DB | Four pseudo-employees in production | RETIRE/REBUILD | Contractor engagement, not employee rows |
| CAP-037 | Contractor named worker versus vendor slot | OPS, AUD | Policy unresolved | DECISION | Architecture supports both; acceptance rules explicit |

---

## 4. Static schedule, requirements and ownership

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-038 | Approved static weekly schedule source | V17, DEC | Source truth incomplete by weekday | RESEARCH/REBUILD | Source artifact and immutable schedule version |
| CAP-039 | Static schedule import/normalization | SRC | Existing import and mutable templates | REBUILD | Preview, unresolved mapping and digest |
| CAP-040 | Static schedule versions/effective dates | architecture, AUD | Missing production authority | REBUILD | Immutable publication lifecycle |
| CAP-041 | Group membership snapshot | DB, architecture | Current membership mutable | REBUILD | Schedule-version snapshot |
| CAP-042 | Schedule groups as authoring/display aids | DEC, DB | Current groups still authoritative | RETAIN with reduced authority | Expand before publication |
| CAP-043 | Individual location as final assignment unit | DEC, DB | Not universal; mixed groups prove need | REBUILD | Canonical location intervals |
| CAP-044 | Daily immutable normal baseline | architecture | Missing production object | REBUILD | Create-if-absent static baseline |
| CAP-045 | Operational requirement interval | V17, architecture | Under-specified in production | REBUILD | `required` versus `not_required` truth |
| CAP-046 | General zoo operating policy | OPS, DB | Empty operating-hours table; 6 PM fallback | REBUILD | Effective-dated policy version |
| CAP-047 | Location-specific/split operating windows | OPS | Missing canonical model | REBUILD | Location policy precedence |
| CAP-048 | September 14 seasonal close | OPS, DB | Not configured | RESEARCH/REBUILD | Explicit policy fixture |
| CAP-049 | After-hours/event operational window | V17, OPS | Under-specified | REBUILD | Approved requirement input |
| CAP-050 | Cross-midnight service semantics | AUD, DB | Current time constraints prohibit | RESEARCH/REBUILD | Service date plus day-offset/time range |
| CAP-051 | Static 9:45 restroom phase | V17, DEC | Current group/mutable implementation | RETAIN/REBUILD | Baseline location-level phase |
| CAP-052 | Preserve unaffected non-restroom ownership at 9:45 | DEC, mixed groups | Not guaranteed | REBUILD | Location-level diff invariant |
| CAP-053 | PTO/absence input | V17, SRC, DB | Current trigger regenerates day | REBUILD | Append-only input and minimal solver |
| CAP-054 | Callout input | OPS, SRC | Current Reassign Day flow broad | REBUILD | Exact effective input and diff |
| CAP-055 | Contractor capacity exception | OPS, SRC | Current pseudo-employee + regeneration | REBUILD | Date/shift capacity input |
| CAP-056 | Exclusive lunch coverage | V17, DEC | Current duplicate/derived behavior | REBUILD | Exclusive temporary ownership interval |
| CAP-057 | Lunch restoration | OPS, architecture | Partial | REBUILD | Deterministic boundary, no departed-owner restore |
| CAP-058 | Lunch spanning 9:45 | OPS, architecture | Not proven | REBUILD | Deterministic precedence fixture |
| CAP-059 | Shift-end inheritance | V17, OPS, DB | Computed in employee read | REBUILD | Compiler transition used by every consumer |
| CAP-060 | Departure before 9:45 | OPS | Current gap risk | REBUILD | Immediate transfer plus later static phase resolution |
| CAP-061 | Two/one/zero employees remaining | OPS, DB | `All Locations` synthetic and gaps | REBUILD | Exact locations or `OPEN` |
| CAP-062 | Explicit `OPEN` | architecture | Concept strong; fragmented implementation | RETAIN/REBUILD | Required interval with no eligible owner |
| CAP-063 | Explicit `not_required` | architecture | Missing production authority | RETAIN/REBUILD | Outside requirement window |
| CAP-064 | One-time work request | DEC, architecture | Concept only | RETAIN/REBUILD | Separate task object, no ownership mutation |
| CAP-065 | Ordinary ownership transfer | architecture | Concept only | RETAIN/REBUILD | Exact locations/interval/reason/actor/publication |
| CAP-066 | Emergency override | architecture | Concept only | RETAIN/REBUILD | Bounded override with restoration/review |
| CAP-067 | Retroactive correction | architecture | Conceptual bitemporal design | REBUILD | Append-only assertion and second approval where needed |
| CAP-068 | Deterministic compiler | architecture, AUD | No accepted schema/implementation | RETAIN/REBUILD | Canonical input snapshot and stable output |
| CAP-069 | Minimal-change objective | DEC, architecture | Current auto-balancing can move broad work | RETAIN/REBUILD | Hard optimization priority |
| CAP-070 | Exact preview/diff/explanation | OPS, architecture | Product contract missing | REBUILD | Manager review before publication |
| CAP-071 | Atomic ownership publication | architecture | Missing production object | RETAIN/REBUILD | One transaction and outbox |
| CAP-072 | One read-authority pointer | architecture | Missing | RETAIN/REBUILD | All-consumer cutover/rollback |
| CAP-073 | Immutable historical ownership | V17, architecture | Current mutable schedules insufficient | REBUILD | Valid-time and recorded-time assertions |
| CAP-074 | Current owner resolver | SRC, DB | Multiple resolvers disagree | RETIRE/REBUILD | One canonical resolver |
| CAP-075 | Owner reason and revision | architecture | Missing universal projection | REBUILD | Every resolver result includes why/version |

---

## 5. Workload, route and restrictions

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-076 | Location/purpose expected workload | V17, AUD, DB | Sparse group points; no full location model | RESEARCH/REBUILD | Versioned profile with source/confidence |
| CAP-077 | Service frequency by purpose/window | V17, OPS | Not canonical | RESEARCH/REBUILD | Requirement and workload input |
| CAP-078 | Difficulty/priority | V17, DB | Optional/mutable and group-biased | RESEARCH/REBUILD | Versioned per-location profile |
| CAP-079 | Zones/clusters | SRC, DB | Group-level and mutable | RESEARCH/REBUILD | Versioned route model |
| CAP-080 | Adjacency/walking time | SRC, DB | Complete group graph, no location-level authority/version | RESEARCH/REBUILD | Versioned location/route evidence |
| CAP-081 | Restrictions/capabilities | SRC, DB | Multiple guards and preferences | REBUILD | One authoritative eligibility model |
| CAP-082 | Route coherence in scheduling | DEC, OPS | Current weighted solver broad | RETAIN/REBUILD | Lower priority than static preservation |
| CAP-083 | No phone-directed walking route | DEC | Some current wording says route | RETAIN/ENFORCE | Employee copy and UX contract |
| CAP-084 | Fair workload analytics | V17 | Depends on missing canonical facts | REBUILD | Historical owner/cleaner/workload confidence |

---

## 6. Employee application and native runtime

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-085 | Four-button employee Home | DEC | Historical/branch conflict | REBUILD | Exact packaged normal Home contract |
| CAP-086 | Employee name from enrolled phone | DEC, SRC | Partial strong identity path | RETAIN/REBUILD | Assignment epoch and protected identity |
| CAP-087 | Employee Back/navigation | AUD, SRC | Multiple conceptual homes | REBUILD | One navigation owner |
| CAP-088 | Protected setup/recovery before Home | SRC | Valid but hybrid | REBUILD | Separate manager-assisted gate |
| CAP-089 | Fully Kiosk lock-state entry | DEC, PHY | Final behavior unproven | REBUILD/PHYSICAL | Native lifecycle and containment |
| CAP-090 | Ambient NFC from all ordinary screens | DEC, PHY | Source partial, field defect history | REBUILD/PHYSICAL | One native NFC owner |
| CAP-091 | NFC tag registry and location mapping | SRC, DB | URLs and location records exist; no versioned tag lifecycle | REBUILD | Tag identity, revocation and audit |
| CAP-092 | NFC cold-start and warm-intent handling | PHY, AUD | Not proven | REBUILD/PHYSICAL | Android intent state machine |
| CAP-093 | Invalid/revoked/duplicate tag handling | SRC | Partial | REBUILD | Deterministic employee-safe outcomes |
| CAP-094 | Manual location fallback | DEC | Exception-only policy | OPTIONAL recovery | Logged manager-supported path; no permanent tab |
| CAP-095 | Direct Start Cleaning after valid scan | DEC, V17 | Partial | REBUILD/PHYSICAL | Location confirmation then one action |
| CAP-096 | Cleaning-session state machine | V17, SRC | Valid pieces, no unified runtime owner | REBUILD | Start/active/finish/form/accepted/cancel/conflict |
| CAP-097 | Active timer | V17, SRC, PHY | Source partial, physical proof missing | REBUILD/PHYSICAL | Durable local/server session identity |
| CAP-098 | Screen-off/wake restoration | DEC, PHY | Physical-only | REBUILD/PHYSICAL | Same workflow and timer |
| CAP-099 | Process/WebView restoration | PHY | Unproven | REBUILD/PHYSICAL | Protected state restore |
| CAP-100 | Completion-form draft persistence | V17, SRC | Partial | REBUILD/PHYSICAL | Durable local draft and reconciliation |
| CAP-101 | Offline provisional work | SRC, architecture | Partial | REBUILD/PHYSICAL | Protected ownership snapshot and bounded age |
| CAP-102 | Exactly-once offline reconciliation | SRC, AUD | Queue protection exists; terminal contract incomplete | REBUILD | Stable operation IDs and poison handling |
| CAP-103 | Cross-ownership active session | architecture | Conceptual | REBUILD | Actual cleaner preserved; current owner remains responsible |
| CAP-104 | Device reassignment blocked by active/offline work | architecture | Partial | REBUILD | Transactional guard/recovery |
| CAP-105 | Employee-safe error vocabulary | DEC, AUD | Current technical leakage | REBUILD | Domain error map and hidden diagnostics |
| CAP-106 | 48dp/glove-friendly controls | OPS, AUD, PHY | Inconsistent | REBUILD/PHYSICAL | Shared employee component contract |
| CAP-107 | Large text/long name/keyboard handling | PHY | Incomplete | REBUILD/PHYSICAL | Geometry and accessibility matrix |
| CAP-108 | Performance budgets | AUD, PHY | Unmeasured | REBUILD/PHYSICAL | Instrumented launch/route/thread/NFC timings |
| CAP-109 | Karen no-rescue acceptance | OPS, PHY | Not completed | RELEASE BLOCKER | Observed task matrix |

---

## 7. Completion evidence, issues and status

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-110 | Restroom completion evidence | V17, SRC | Rich checklist, incomplete low-tech contract | REBUILD | Versioned taxonomy and progressive disclosure |
| CAP-111 | Exhibit completion evidence | V17, SRC | Rich checklist, incomplete low-tech contract | REBUILD | Distinct taxonomy and progressive disclosure |
| CAP-112 | Other area-type evidence | SRC | Not fully classified | RESEARCH/REBUILD | Form type registry |
| CAP-113 | Full-clean shortcut | OPS, AUD | Missing final contract | REBUILD | Common path plus exceptions |
| CAP-114 | Services-performed taxonomy | V17, SRC | Scattered strings | REBUILD | Versioned canonical vocabulary |
| CAP-115 | Cleaning notes | V17, SRC | Valid | RETAIN/REBUILD | Bounded, role-appropriate evidence |
| CAP-116 | Maintenance observation | V17, SRC | Partial | REBUILD | Observation → issue lifecycle |
| CAP-117 | Supply shortage | V17, SRC | Under-modeled | REBUILD | Separate supply domain |
| CAP-118 | Out-of-order fixture | V17, SRC | Capture exists; operational effect incomplete | REBUILD | Severity, readiness and closure rules |
| CAP-119 | Maintenance ticket | V17, DB | Valid capability | RETAIN/REBUILD | Issue-to-ticket linkage and immutable source |
| CAP-120 | Work-order-submitted end state | OPS | Operational doctrine exists | RETAIN/REBUILD | Ticket status vocabulary and evidence |
| CAP-121 | Ticket closure/correction | SRC, DB | Exists; actor semantics need unification | REBUILD | Named actor, reason and audit |
| CAP-122 | Recurring issue/pattern detection | V17, SRC, DB | Valid analytics | RETAIN/REBUILD | Evidence thresholds and false-duplicate rules |
| CAP-123 | Canonical service requirement | V17 | Fragmented | REBUILD | Operational episode root |
| CAP-124 | Due-soon/overdue episode | V17, DB | Current time-based view and legacy alerts | REBUILD | Durable episode identity |
| CAP-125 | In-progress state | V17, DB | Current status suppresses urgency but not truthfully integrated | REBUILD | Work state separate from readiness |
| CAP-126 | Accepted completion | V17, SRC, DB | Valid evidence | RETAIN/REBUILD | Atomic acceptance and status transition |
| CAP-127 | Issue/follow-up state | V17 | Not canonical | REBUILD | Severity and readiness rules |
| CAP-128 | Inspection readiness | V17, AUD | Core outcome undefined | BLOCKER/REBUILD | Canonical readiness resolver |
| CAP-129 | Manager correction/reopen/cancel-not-required | architecture | Conceptual | REBUILD | Append-only status events |
| CAP-130 | Scan/start never resolves overdue | DEC, DB | Current trigger violates | RETIRE/ENFORCE | Completion/correction-only resolution |

---

## 8. Manager application, inspections and analytics

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-131 | Manager Hub | V17, SRC | Broad and useful, not final contract | REBUILD | Role-gated operations entry |
| CAP-132 | Dashboard live status | V17, SRC, DB | Valid but status/readiness conflated | REBUILD | Canonical projection |
| CAP-133 | Current owner and reason | DEC, architecture | Not universal | REBUILD | Ownership resolver fields |
| CAP-134 | Active cleaner | V17, DB | Available from session | RETAIN/REBUILD | Separate field |
| CAP-135 | Actual/last cleaner | V17, DB | Available | RETAIN/REBUILD | Separate historical field |
| CAP-136 | Data freshness/confidence | AUD | Incomplete | REBUILD | Explicit projection metadata |
| CAP-137 | Exact schedule preview/diff/publish | DEC, architecture | Existing Reassign Day insufficient | REBUILD | Manager publication workflow |
| CAP-138 | OPEN exceptions | architecture | Partial views | REBUILD | Manager queue and escalation |
| CAP-139 | Manager inspection | V17, SRC, DB | Valid capability | RETAIN/REBUILD | Session-bound inspection state machine |
| CAP-140 | Inspection types/scores/findings | SRC, DB | Valid | RETAIN/REBUILD | Versioned rubric and corrections |
| CAP-141 | Inspection coverage | SRC, DB | Current target setting 0; no quota policy | RESEARCH/DECISION | Manager spot-check policy |
| CAP-142 | Employee/location comparison | V17, SRC, DB | Valid but misuse risk | REBUILD | Sample/context/confidence thresholds |
| CAP-143 | Cleaning duration analysis | V17, SRC, DB | Valid but offline/transfer context missing | REBUILD | Fact model and exclusions |
| CAP-144 | Ticket trend analysis | V17, SRC, DB | Valid | RETAIN/REBUILD | Repeat/hotspot definitions |
| CAP-145 | Workload/fairness analysis | V17 | Blocked by workload/ownership truth | REBUILD | Historical versioned inputs |
| CAP-146 | Anti-disciplinary misuse protections | AUD | Missing | REBUILD | Warnings, thresholds, approvals and audit |
| CAP-147 | Attendance context | SRC, DB | Manager informational capability | RESEARCH/REBUILD | Source/freshness/privacy/no silent schedule effect |
| CAP-148 | Weather context | SRC, DEC | Manager-only optional | OPTIONAL | Informational, no employee Home |

---

## 9. Messenger, Memphis AI and notifications

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-149 | Employee direct messages | V17, SRC | Valid; novice UX incomplete | REBUILD | Direct-recipient mode |
| CAP-150 | Manager direct/group/broadcast | V17, SRC | Valid | RETAIN/REBUILD | Role-gated modes |
| CAP-151 | Memphis AI thread | V17, SRC, DB | Valid; current message trigger mutates schedule | REBUILD | Read/propose/action authority contract |
| CAP-152 | Thread identity and stale-response rejection | SRC, AUD | Partial protections | RETAIN/REBUILD | Clear old content and bind request key |
| CAP-153 | Immediate optimistic send | SRC | Valid | RETAIN | Durable outbox and reconciliation |
| CAP-154 | Messenger offline outbox | SRC | Valid partial | RETAIN/REBUILD | Poison/terminal handling |
| CAP-155 | Incremental sync/long polling | SRC | Valid | RETAIN | Cursor and lifecycle contract |
| CAP-156 | Conversation hide/delete per user/device | SRC, DB | Partial | REBUILD | Immediate hide, server retention, failure rollback |
| CAP-157 | Accessible delete alternative | DEC, AUD | Required, incomplete | REBUILD | Swipe plus visible non-drag action |
| CAP-158 | Message retention/archive | DB, DEC | 14-day presentation/purge, archive policy unclear | RESEARCH/DECISION | Separate presentation and record retention |
| CAP-159 | Operational alerts separate from chat | V17, AUD | Current legacy alert messages use Messenger | REBUILD | Separate episode/notification pipeline |
| CAP-160 | Notification intent | architecture | Strong concept | RETAIN/REBUILD | Recipient-specific durable instruction |
| CAP-161 | Final recipient revalidation | architecture, AUD | Not complete | REBUILD | Status, owner revision and device epoch before send |
| CAP-162 | Transport/provider job | SRC, DB | Valid durable jobs | RETAIN/REBUILD | Claim/lease/terminal outcomes |
| CAP-163 | Device receipt/presentation | SRC | Partial | REBUILD | One native presentation owner |
| CAP-164 | Exact two-cycle audio | DEC, AUD, PHY | Historical conflict; physical proof missing | REBUILD/PHYSICAL | One cadence contract |
| CAP-165 | Persistent Open/Dismiss overlay | DEC, SRC, PHY | Native foundation; proof incomplete | REBUILD/PHYSICAL | One visible alert, FIFO queue |
| CAP-166 | Displayed/opened/dismissed acknowledgement | SRC, DB | Exists; durability incomplete | REBUILD | Local pending → server acknowledged |
| CAP-167 | Dismissal independent from work resolution | DEC, architecture | Correct principle | RETAIN/ENFORCE | Separate state machines |
| CAP-168 | Manager escalation | DB | Valid but legacy owner/status coupling | REBUILD | Episode-aware scheduling/reroute/cancel |
| CAP-169 | No duplicate OS/browser/native sound | DEC, PHY | Unproven | REBUILD/PHYSICAL | One presentation authority |
| CAP-170 | No replay after lifecycle events | DEC, PHY | Unproven | REBUILD/PHYSICAL | Stable event key and persisted state |

---

## 10. Events, guest reporting, feedback and contractors

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-171 | Event identity/revisions | V17, SRC, DB | Event history exists; final immutable contract incomplete | REBUILD | Revision/publication lifecycle |
| CAP-172 | Manual event form | V17, SRC | Valid | RETAIN/REBUILD | Authorized manager input |
| CAP-173 | Quick-paste parser | SRC | Valid hidden capability | RETAIN/REBUILD | Parse → validate → review; no authority |
| CAP-174 | Spreadsheet/document import | SRC | Valid hidden capability | RETAIN/REBUILD | Import preview and unresolved rows |
| CAP-175 | Event scope/venue/coverage distinction | SRC | Strong current concept | RETAIN | Separate fields and validation |
| CAP-176 | Event publish/update/cancel | SRC, DB | Valid | REBUILD | Revision and supersession |
| CAP-177 | Employee event notices | V17, SRC | Current board language not employee-safe | REBUILD | Relevant notice projection |
| CAP-178 | Event reminders | SRC, DB | Valid push capability | REBUILD | Timing/dedupe/presentation integration |
| CAP-179 | Custodial impact proposal | DEC, AUD | Missing explicit product object | REBUILD | Proposal only |
| CAP-180 | Approved operational requirement change | DEC | Under-specified | REBUILD | Separate named-manager publication |
| CAP-181 | Event save never mutates schedule | DEC, DB | Current AI/read generation violates broader principle | ENFORCE/RETIRE | No trigger/read-side mutation |
| CAP-182 | Guest QR intake | V17, SRC, DEC | Dormant/disabled | OPTIONAL | Feature gate and location binding |
| CAP-183 | Guest privacy/rate limiting | SRC, DB | Controls exist; policy incomplete | OPTIONAL/REBUILD | Data minimization and abuse controls |
| CAP-184 | Marketing review | V17, SRC, DB | Required and configured | RETAIN | Approval before operations dispatch |
| CAP-185 | Guest issue current-owner routing | V17, DEC | Depends on legacy resolver | OPTIONAL/REBUILD | Canonical owner after approval |
| CAP-186 | Guest follow-up/closure/redaction | SRC, DB | Valid partial | OPTIONAL/REBUILD | Status and contact purge |
| CAP-187 | Guest recurring-pattern analytics | V17 | Valid if activated | OPTIONAL/REBUILD | Approved operational facts only |
| CAP-188 | Employee app feedback/help | DEC, SRC | Valid but categories remain mixed | REBUILD | Plain app/phone help contract |
| CAP-189 | Maintenance/supply/work-request reporting split | DEC, AUD | Missing clean employee pathways | REBUILD | Separate domain forms/actions |
| CAP-190 | Feedback attachments | SRC, DB | Valid | RETAIN/REBUILD | Validation, private access and retention |
| CAP-191 | Manager feedback triage | SRC | Valid but shared employee asset risk | REBUILD | Manager-only product |
| CAP-192 | Contractor engagement | OPS, architecture | Conceptual | REBUILD | Vendor/slot/named-worker lifecycle |
| CAP-193 | Contractor assignment revision | architecture | Conceptual | REBUILD | Exact locations/times/version |
| CAP-194 | Secure contractor link | SRC, DB | Valid | RETAIN/REBUILD | One revision, expiry, revoke, no-store |
| CAP-195 | Contractor delivery and acknowledgement | AUD | Missing | REBUILD/DECISION | Assigned ≠ delivered ≠ accepted |
| CAP-196 | Contractor actual cleaner evidence | OPS | Policy/workflow incomplete | REBUILD | Named worker or accountable slot distinction |
| CAP-197 | Unreachable contractor leaves OPEN/requires action | DEC, architecture | Correct principle | RETAIN/ENFORCE | No fabricated coverage |

---

## 11. AI, MCP, Moxie and diagnostics

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-198 | Memphis AI operational answers | V17, SRC | Valid, source/authority incomplete | REBUILD | Approved data tools and freshness |
| CAP-199 | MCP connected access | SRC | Valid hidden capability | REBUILD | Tool registry and role scoping |
| CAP-200 | Moxie notes/reminders/contacts | SRC | Valid capability, final role unresolved | DECISION/REBUILD | Separate private workspace or internal tool |
| CAP-201 | Controlled diagnostics | SRC | Valid privileged capability | REBUILD | Isolated admin product |
| CAP-202 | Controlled repair actions | SRC | High-risk hidden write authority | REBUILD | Confirmation, idempotency, audit, backup and rollback |
| CAP-203 | AI read versus write classification | AUD | Incomplete | REBUILD | Every tool explicitly classified |
| CAP-204 | AI action confirmation/second approval | DECISION | Policy unresolved | DECISION | Capability-specific approval |
| CAP-205 | AI source citation/freshness | V17, AUD | Incomplete | REBUILD | Response evidence metadata |
| CAP-206 | AI hallucination containment | AUD | Incomplete | REBUILD | Bounded tools, no inferred mutation |
| CAP-207 | Reads never mutate schedules | DEC, DB | Current Memphis trigger violates | RETIRE/ENFORCE | Remove mutation triggers |

---

## 12. Security, privacy, retention and recovery

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-208 | Forced RLS on protected tables | DB | Strong current state | RETAIN | Schema security gate |
| CAP-209 | Revoked broad function execution | DB | Strong sampled state | RETAIN/VERIFY | Complete function audit |
| CAP-210 | Locked privileged search paths | DB, SRC | Strong sampled state | RETAIN/VERIFY | All SECURITY DEFINER functions |
| CAP-211 | Public submission controls | SRC, DB | Valid | RETAIN/REBUILD | Rate limit, schema validation and gate |
| CAP-212 | Read Only field redaction | DEC | Under-specified | REBUILD | Explicit projection and tests |
| CAP-213 | Employee privacy from manager/diagnostic data | DEC | Asset/runtime overlap risks | REBUILD | Product-specific packaging and APIs |
| CAP-214 | Raw GPS privacy | DEC, AUD | Policy incomplete | REBUILD/DECISION | Active-session only, roles, retention |
| CAP-215 | Data-class retention matrix | DB, AUD | Fragmented settings | BLOCKER/REBUILD | Archive/purge/redact/hold per class |
| CAP-216 | Message presentation retention | DB | 14 days | RETAIN as policy input | Separate from required archive decision |
| CAP-217 | Event notice retention | DB | 14 days | RETAIN as policy input | Separate source/history from notice |
| CAP-218 | Durable responsibility/session/inspection history | V17, DEC, DB | Current long retention, schedule window conflict risk | RETAIN/REBUILD | Never erased by communication cleanup |
| CAP-219 | Guest contact redaction | DB | 30-day setting and redaction functions | RETAIN/REBUILD | Approval-gated privacy contract |
| CAP-220 | Raw GPS retention | AUD | Missing exact policy | DECISION/REBUILD | Short retention plus durable summary/holds |
| CAP-221 | Encrypted production backup | SRC/AUD | Tools/evidence exist, final governance needed | RETAIN/VERIFY | Release gate |
| CAP-222 | Clean database rebuild | SRC/AUD | Valid capability | RETAIN/VERIFY | Empty Postgres rebuild gate |
| CAP-223 | Restore drill | SRC/AUD | Valid capability | RETAIN/VERIFY | RPO/RTO and periodic proof |
| CAP-224 | Schema fingerprint | SRC, DB | Valid release mechanism | RETAIN | Signed release tuple |
| CAP-225 | Graceful worker drainage/shutdown | SRC | Valid | RETAIN/VERIFY | Release/runtime gate |

---

## 13. Migration, build, APK and physical acceptance

| ID | Capability | Evidence | Current state | Canon disposition | Required architectural home / gate |
|---|---|---|---|---|---|
| CAP-226 | Complete current writer/reader graph | AUD | Incomplete | RESEARCH/REBUILD | Migration prerequisite |
| CAP-227 | Read-only export and source hashes | architecture | Required | RETAIN/REBUILD | Migration evidence |
| CAP-228 | Isolated schema/environment | doctrine | Required | RETAIN | No production DDL during design |
| CAP-229 | Shadow compilation/read comparison | architecture | Required | RETAIN/REBUILD | No production presentation |
| CAP-230 | Difference classification | architecture | Required | RETAIN | Every unexplained difference blocks cutover |
| CAP-231 | One atomic all-consumer cutover | architecture, AUD | Missing production mechanism | REBUILD | Protected authority pointer |
| CAP-232 | Legacy writer retirement | architecture | Required | RETAIN/REBUILD | No permanent dual write |
| CAP-233 | Complete rollback | architecture | Required | RETAIN/REBUILD | Authority set, not endpoint flags |
| CAP-234 | Source freeze and release tuple | SRC | Strong mechanisms | RETAIN | Frontend/backend/schema/APK identity |
| CAP-235 | Generated asset provenance | SRC, AUD | Valid but drift risk | RETAIN/REBUILD | Byte hashes and producer identity |
| CAP-236 | Custodial asset allowlist | SRC | Strong principle | RETAIN | Employee-only graph |
| CAP-237 | Production signer enforcement | SRC/AUD | Strong | RETAIN | Pinned fingerprints |
| CAP-238 | VersionCode anti-rollback | SRC/AUD | Strong | RETAIN | Build 23+ and fleet floor |
| CAP-239 | APK producer admission | SRC/AUD | Valid | RETAIN | Source→artifact proof |
| CAP-240 | APK consumer admission | SRC/AUD | Valid | RETAIN | Independent artifact verification |
| CAP-241 | Native vault/DEX/manifest proof | SRC/AUD | Strong | RETAIN | Release gate |
| CAP-242 | Build 22 rollback | DEC | Mandatory | RETAIN | Until fleet acceptance |
| CAP-243 | One-phone canary | doctrine | Required | RETAIN | Controlled production pilot |
| CAP-244 | Fully Kiosk containment | PHY | Final proof missing | PHYSICAL | Home/Recents/reboot/escape matrix |
| CAP-245 | NFC physical acceptance | PHY | Missing current final proof | PHYSICAL | Every required state |
| CAP-246 | Notification physical acceptance | PHY | Missing | PHYSICAL | Audio/overlay/queue/no duplicate sound |
| CAP-247 | Offline/reconnect physical acceptance | PHY | Missing | PHYSICAL | Exactly-once and no lost work |
| CAP-248 | GPS physical calibration | PHY | Missing | PHYSICAL | Accuracy, false exits, battery |
| CAP-249 | Messenger physical performance/privacy | PHY | Missing | PHYSICAL | Thread timing and zero stale frame |
| CAP-250 | Accessibility/Karen acceptance | PHY | Missing | RELEASE BLOCKER | Core tasks without rescue |
| CAP-251 | Controlled fleet rollout | doctrine | Not authorized | FUTURE GATE | Only after canary and rollback proof |
| CAP-252 | Final release audit | doctrine | Not reached | FUTURE GATE | Independent complete evidence review |

---

## 14. Explicit obsolete behavior register

The following are not capabilities to preserve:

1. Employee Scanner page as normal workflow.
2. Employee QR scanning as normal workflow.
3. Repeated employee-name selection on an enrolled phone.
4. Employee Home weather, attendance, device ID, build data or diagnostics.
5. Employee enrollment removal or phone administration.
6. Bottom navigation or permanent Refresh on approved employee Home.
7. Current/Next/route-step language for ordinary ownership.
8. Software-directed daily walking sequence.
9. `All Locations` synthetic ownership.
10. Group-level final responsibility.
11. Sunday location templates as parallel current authority.
12. Read-triggered schedule generation or mutation.
13. Whole-day forced regeneration for ordinary exception changes.
14. CoverAll pseudo-employees.
15. Hard-coded employee-specific scheduler behavior.
16. Original owner remaining active beside lunch coverage.
17. Employee-only read-side shift inheritance.
18. Any scan event resolving due/overdue work.
19. Dismissal/opened state resolving work.
20. Competing browser/native notification authorities.
21. One-cycle employee alert cadence.
22. Alert replay on wake/navigation/reconnect/polling.
23. Event save/import/edit/cancel silently changing ownership.
24. Guest reporting active without approval.
25. Read Only Feedback or manager/internal data.
26. Employee technical error terminology.
27. Permanent compatibility helpers, dual reads, dual writes or independent consumer cutover flags.
28. Renaming a historical employee identity into a replacement.

---

## 15. Canon acceptance gates

This canon is ready for whole-system architecture use only after:

- every entry has an accountable architecture chapter;
- source evidence is attached for current implementation claims;
- production facts are reconciled without exposing sensitive data;
- field and physical-only items are assigned research plans;
- genuine policy items are entered in the decision registry;
- duplicates are merged without losing operational meaning;
- obsolete behavior has an explicit retirement path;
- independent auditors confirm no valid capability was omitted.

No schema or product implementation is authorized by this canon.