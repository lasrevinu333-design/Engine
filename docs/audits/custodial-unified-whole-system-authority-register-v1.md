# Memphis Zoo Custodial Program — Canonical Authority Register v1

**Status:** Provisional whole-system authority map; no implementation authorization  
**Prepared:** 2026-08-04

---

## 1. Purpose

Every operational fact must have:

- one authoritative source or writer;
- one canonical resolver or projection contract;
- named authorized actors;
- append-only correction/history behavior;
- retention and privacy classification;
- migration and retirement plan;
- automated and physical proof.

A screen, query, AI response, report or notification cannot invent its own fallback truth.

### Authority classes

- **Source fact:** approved external or manager-entered fact.
- **Command:** authorized intent to change state.
- **Compiled fact:** deterministic result from versioned source facts and commands.
- **Operational event:** accepted real-world action/evidence.
- **Projection:** read-only role-specific rendering of canonical facts.
- **Presentation evidence:** notification/display/UI lifecycle, never operational truth by itself.

---

## 2. Identity and actor facts

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| Permanent employee identity | `employees` record plus aliases and Messenger identity | Permanent employee registry | Named manager onboarding service | All products through scoped APIs | Never rename into replacement; append aliases/status | Stop treating `active` as identity existence |
| Employment state | `employees.active` | Effective-dated employment status | Named manager/HR-authorized backend | Scheduler eligibility, admin, analytics | Append status history | Retire overloaded Boolean semantics |
| Schedule eligibility | Employee active, shift roster and ad hoc restrictions | Effective eligibility interval with reason | Approved workforce/manager inputs | Ownership compiler | Append/cancel/supersede | Remove local consumer eligibility logic |
| Messenger eligibility | `msg_users.is_active`, employee active | Separate messaging status | Manager/admin messaging service | Messenger APIs | Append audit | Do not derive from employment alone |
| Phone eligibility | Employee/device active flags | Separate phone-assignment eligibility | Device admin service | Enrollment/assignment APIs | Append history | Do not derive from employment alone |
| Schedule position | Named employee embedded in templates | Stable position registry | Schedule-policy publication | Static schedule and compiler | Version/effective-date history | Stop inferring role from old employee name |
| Position occupant | Employee in static rule or current roster | Non-overlapping effective position assignment | Named manager | Compiler, manager schedule | Append assignment history | Do not rewrite past occupant |
| Vacancy | Missing/inactive employee ambiguity | Explicit vacant position | Position assignment service/compiler input | Manager exception/OPEN views | Durable interval | Never hide vacancy through historical active identity |
| Contractor engagement | `COVERALL_01..04` employee rows | Vendor/engagement/slot registry | Named manager/vendor admin | Compiler, secure-link service | Versioned engagement history | Retire pseudo-employees |
| Contractor worker/slot identity | CoverAll placeholder name | Named worker when known, accountable slot when policy permits | Manager/vendor workflow | Contractor view, actual-work evidence | Durable assignment/acceptance | Do not confuse slot with worker |
| Canonical device identity | KIOSK ID, aliases, browser/local IDs | Device registry primary identity | Device admin/enrollment | Employee transport and manager security | Append aliases/history | No competing client-supplied identity |
| Device assignment epoch | Device row and history | Monotonic assignment epoch | Transactional assignment service | Every employee-scoped request and push | Durable history | Reject stale epoch work/alerts |
| Named manager actor | Manager sessions, Messenger manager, string labels | Canonical manager identity and credential session | Manager access service | Every privileged command/audit | Permanent audit | Retire string-only actors such as `Dashboard` |
| System/automation actor | Function/worker names | Registered system actor and capability | Deployment/config authority | Audit and event log | Immutable | No anonymous privileged automation |
| AI actor | Memphis/MCP/Gemini tools | Registered AI tool actor with invoking user | Tool gateway only | Audit and command service | Immutable request/action chain | AI never inherits caller authority implicitly |

---

## 3. Static schedule and ownership facts

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| Schedule source artifact | PDF/import data, mutable rows | Immutable source artifact with digest/provenance | Authorized importer | Schedule publication and audit | Never overwrite | Retain source bytes privately per policy |
| Static weekly policy | Mutable `coverage_templates`, employee-bound shifts | Published immutable schedule version | Named manager after validation | Baseline compiler | New version for change | Disable in-place policy mutation |
| Group membership for a schedule | Current mutable membership | Schedule-version membership snapshot | Static publication | Baseline compiler/historical review | Immutable per version | Stop historical expansion through current membership |
| Normal shift/lunch rule | Employee-bound mutable templates | Version-bound subject/position rule | Static publication | Baseline/compiler | New version | Retire employee identity as normal staffing slot |
| Normal coverage rule | Group template or Sunday location template | Version-bound rule expanded to locations | Static publication | Baseline compiler | New version | Sunday rows become migration evidence only |
| Operating policy | Empty dated table plus 6 PM fallback | Published effective-dated zoo/location policy | Named manager/approved source | Requirement compiler | New revision, no fallback history rewrite | Retire unconfigured constant as authority |
| Operational requirement interval | Implied by schedule/status/close time | Compiled location-level `[start,end)` interval | Deterministic compiler | Ownership, status, alerts, Dashboard | Revisioned output | No missing-row meaning |
| Daily normal baseline | Mutable daily assignments | Immutable location-level baseline | Create-if-absent compiler | Ownership compilation | Never update; supersede by new static identity | Read paths never generate/update |
| Absence/PTO | PTO tables and daily overrides/trigger | Append-only effective workforce input | Approved manager/HR source | Ownership compiler | Cancel/supersede; preserve original | Stop trigger-driven full-day regeneration |
| Contractor capacity | CoverAll activation and pseudo-employee | Published engagement/capacity input | Named manager | Ownership compiler | Versioned/cancelled | Activation does not prove acceptance |
| Lunch transition | Added rows and employee read logic | Deterministic exclusive compiled transition | Compiler from static shift policy | All consumers | Revision evidence | Original owner cannot remain concurrent |
| 9:45 transition | Group rebalance and display threshold | Static location-level phase plus exception rules | Static publication/compiler | All consumers | Revision evidence | No group move of exhibit with restroom |
| Shift-end inheritance | Employee-page read computation | Compiled exact-location transition | Ownership compiler | All consumers | Revision evidence | No read-side inheritance |
| Manager ownership transfer | Ad hoc schedule mutation | Append-only exact interval command | Full Access Manager | Compiler and audit | Cancel/supersede/correct | No direct row update |
| Emergency override | Ad hoc/manual behavior | Bounded emergency command | Authorized manager | Compiler/session/notification services | Append and auto-expire/review | No indefinite emergency state |
| Work request | Could be confused with assignment | Separate task/request object | Manager | Employee/manager task projections | Complete/cancel history | Never changes ownership automatically |
| Effective owner | Group schedule, location templates, employee phase, alert resolver | Published non-overlapping location interval | Atomic compiler publication | Employee/manager Schedule, Dashboard, alerts, guest, AI, analytics | Bitemporal assertion/correction | Retire all fallback resolvers |
| Ownership state | `EMPLOYEE`, `OPEN`, missing row | Employee, contractor, `OPEN`, `not_required` | Compiler | All consumers | Revisioned | Missing row is error, not state |
| Ownership reason/revision | Notes/source strings | Structured controlling input/transition and revision | Compiler | Every consumer | Immutable per publication | No client-derived reason |
| Ownership publication pointer | Independent legacy tables/consumers | One protected authority version | Publication transaction | All ownership consumers | Pointer history and rollback | No per-consumer flag |

---

## 4. Workload, route and restrictions

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| Expected workload | Sparse group manual points, optional location fields | Versioned location/purpose/window profile | Reviewed field research/manager approval | Compiler and analytics | New revision; source/confidence retained | Never divide/copy group values mechanically |
| Service frequency | Implied timers/schedule | Versioned location/purpose requirement profile | Manager policy | Requirement compiler/status | New revision | Do not infer solely from form type |
| Difficulty/priority | Mutable fields/group data | Versioned profile | Reviewed manager research | Compiler/analytics | New revision | No unversioned historical replay |
| Zone/cluster | Mutable group zone | Versioned location route model | Reviewed map/field research | Compiler | New revision | Group is not final location geography |
| Walking time/adjacency | Complete group graph, sparse location facts | Versioned location/route edges with source/confidence | Reviewed field/map research | Compiler/explanation | New revision | No mutable route truth in old history |
| Restriction/capability | Several guards/preferences | One effective eligibility/restriction model | Named manager/approved policy | Compiler | Append/effective date | No hidden special-case employee code |
| Optimization objective | Weighted route/load functions | Ordered hard/soft objective contract | Architecture/compiler version | Compiler/explanation | Versioned | Static preservation outranks cosmetic rebalance |

---

## 5. NFC, session, offline and GPS facts

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| NFC tag identity | URL fields/tag payloads without full lifecycle | Versioned tag registry | Manager/tag admin | Native NFC resolver | Issue/revoke/replace history | No generic URL as untracked authority |
| Scanned location | Intent URL and page parameters | Native-verified tag resolution | Native runtime | Session service and UI | Durable scan receipt | Client cannot substitute arbitrary location |
| Scan receipt | `scan_events` | Physical interaction evidence only | Native/backend scan service | Session/audit | Immutable | Never means completed or ready |
| Cleaning session identity | Local state, server session, queue item | One stable session/operation identity | Session service with protected device | Employee runtime, Dashboard, history | Append state events | No cross-employee adoption after phone move |
| Actual cleaner | Enrolled employee/session row | Protected device assignment epoch at start | Session service | Completion, analytics, Dashboard | Immutable; correction audited | Never inferred from planned owner |
| Owner at session start | Various schedule lookups | Canonical ownership resolver + revision snapshot | Session service read | Session history | Immutable snapshot | No stale unversioned lookup |
| Session relation to ownership | Implicit | `owner_cleaning`, `cross_ownership_active`, `manager_directed_help`, conflict | Reconciliation/session service | Manager/analytics | Append events | Work acceptance does not alter ownership |
| Active timer/state | Browser local/server | Native-owned protected local mirror + server state | Employee runtime/session service | Employee UI/manager status | Event history | One lifecycle owner |
| Completion draft | Web storage/queue | Protected local durable draft | Employee runtime | Employee UI/reconciliation | Preserve until accepted/cancelled | No silent loss on wake/process death |
| Offline ownership snapshot | Not exact | Protected signed snapshot with expiry/revision/epoch | Backend to enrolled phone | Offline start/reconciliation | Retained with session evidence | No ownership guessing offline |
| Offline action queue | IndexedDB generations and native protections | One durable operation log with stable IDs | Employee runtime | Reconciliation service | Terminal/poison history | No infinite retry of domain rejection |
| Completion acceptance | Session/completion functions | Atomic authoritative acceptance event | Backend service | Status, Dashboard, history | Immutable; correction separate | No partial accepted state |
| GPS observation | Web/backend proximity | Active-session-only native observation evidence | Native runtime | Session exception/manager evidence | Raw short retention, durable summary | No off-session tracking |
| GPS calibration | Group/location settings | Versioned per-location calibration | Field research/manager approval | Proximity evaluator | New revision | No disciplinary claim from low-confidence data |
| GPS excursion/return | Device proximity status | Session-linked event/summary | GPS service | Manager/status/analytics with limits | Durable summary | Missing GPS does not fabricate outside/inside |

---

## 6. Operational status, readiness, issue and inspection facts

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| Service requirement episode | Dashboard timers and schedule | Durable episode rooted in accepted completion/requirement | Status service/compiler | Alerts, Dashboard, history | Immutable event chain | No stateless recalculation as sole truth |
| Due-soon/overdue state | `v_location_dashboard_status` time calculation | Episode state derived from policy/version | Status service | All consumers | State transitions retained | One episode persists through due→overdue |
| In-progress state | Open session view | Session-linked status without resolution | Session/status service | Dashboard/alerts | State event | In progress ≠ clean/ready |
| Accepted completion | Latest completion response | Canonical completion event | Completion service | Status, inspections, analytics | Immutable | Only accepted completion can advance status |
| Maintenance observation | Form JSON/tickets | Structured observation linked to completion | Completion service | Issue/ticket/readiness | Immutable source | Do not lose in generic notes |
| Supply observation | Form strings | Structured supply issue | Completion service | Supply workflow/analytics | Immutable source | Separate from maintenance |
| Issue severity | Ad hoc text/category | Versioned severity policy and issue state | Backend/manager correction | Readiness, escalation | Append transitions | No UI-only severity |
| Out-of-order impact | Checkbox/ticket | Structured fixture state and readiness effect | Completion/manager service | Readiness/Dashboard | Durable until closure/correction | Completion does not hide condition |
| Ticket/work-order state | Ticket table/status | Canonical issue→ticket→W.O. Submitted/closure chain | Backend/manager | Manager/analytics | Append transitions | No deletion of source observation |
| Inspection | Inspection row | Session-bound named-manager assessment | Manager inspection service | Dashboard/analytics | Append/correct with audit | No orphan generic score |
| Inspection readiness | `okay`/completion/issue interpretations | Canonical resolver over requirement, completion, issues and inspection policy | Status/readiness service | Dashboard, manager inspection queue, AI | Versioned derivation and correction | `okay` timer is not readiness |
| Readiness reason | UI inference | Structured reasons/blockers/freshness | Resolver | Manager/Read Only projection | Retained with source revision | No black-box Boolean |
| Reopen/manager correction | Ad hoc close/repair | Named-manager event with reason/evidence | Authorized manager | Status/history | Append-only | Never overwrite prior assertion |

---

## 7. Messenger and notification facts

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| Messenger user identity | Employee, manager, device mapping | Role-scoped messaging identity linked to canonical actor | Messaging admin | Messenger API | Status/history | No client-selected identity |
| Thread identity | Client state/API | Server thread ID plus participant authorization | Messaging service | Messenger clients | Immutable membership/revisions | Clear stale UI on selection |
| Message send | Client optimistic + RPC | Stable client message ID and server idempotency | Authorized user/device | Thread participants | Audit/delivery history | No duplicate retry |
| Outbox state | Local storage | Protected local operation state | Messenger client | Reconciliation | Retry/terminal history | Poison item does not block later messages |
| Conversation hide/delete | Per-device hide/deletion tables | Viewer-specific hide plus retention policy | Authorized participant | Own conversation list | Operation audit | Immediate local hide with rollback on failure |
| Memphis response | AI/backend | Tool-bounded answer with evidence/freshness | Memphis service | Requesting authorized user | Request/response/tool audit | Asking a question never generates schedule |
| Operational status episode | Legacy alert log/status view | Status service | Completion/status events | Notification planner | Durable work history | Separate from chat message |
| Notification intent | Several push/alert records | Recipient-specific intent with event key | Notification planner | Delivery workers/audit | Supersede/reroute history | No duplicate pipeline |
| Intended recipient | Schedule join/current device | Canonical owner revision and role policy | Planner | Delivery worker | Retained | Revalidate immediately before send |
| Delivery job/provider result | Operational jobs/push queues | Leased durable transport job | Worker | Audit/monitoring | Attempts/terminal outcome | Transport failure ≠ work state |
| Device presentation | Browser reminders/native coordinator/OS | One native presentation orchestrator | Employee app | Employee and acknowledgement service | Persisted queue/active state | Retire competing browser authority |
| Exact audio | Conflicting one/two cycle code | One cadence contract | Native orchestrator | Employee | Presentation evidence | No OS duplicate or third replay |
| Acknowledgement | Local seen + server ack | Local pending→server acknowledged | Employee action/runtime | Manager delivery history | Retry/reconciliation | Ack failure cannot silently disappear |
| Manager escalation | Legacy scan alert messages/jobs | Episode-aware escalation lifecycle | Planner/manager policy | Manager | Send/cancel/reroute/ack history | Dismissal does not cancel |
| Work resolution | Scan clearing/alert active flag | Accepted completion or manager correction | Status service | All consumers | Durable | Never presentation action |

---

## 8. Event, guest, feedback and contractor facts

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| Event source/import | Form/parser/import | Source artifact/import row with validation | Authorized manager/importer | Event review | Preserve source | Parser output has no operational authority |
| Event revision | Mutable event plus history | Immutable event revision/publication | Manager event service | Manager/employee/Read Only projections | Supersede/cancel history | No silent row rewrite |
| Published event notice | Event board/current row | Role-specific projection of published revision | Event service | Employee/manager/Read Only | Notice lifecycle | Employee gets only relevant fields |
| Custodial impact proposal | Notes/default rules | Separate proposal object | Manager/event planning | Review UI | Revise/reject history | Event save ≠ approval |
| Approved requirement impact | Implicit schedule coupling | Named-manager published requirement input | Authorized manager | Requirement compiler | Append/cancel/supersede | No automatic ownership mutation |
| Guest feature activation | Settings | Protected approval flag plus policy revision | Authorized admin/Marketing | Public/Marketing routes | Audit | Default disabled |
| Guest submission | Public form | Bounded location-specific report | Public API | Marketing only before approval | Immutable source/contact lifecycle | No employee QR dependency |
| Marketing decision | Review route | Named reviewer approval/rejection | Marketing role | Operations dispatch/history | Audit | No automatic public→employee path |
| Guest operations dispatch | Legacy assignment joins | Approved issue routed to canonical owner revision | Dispatch service | Manager/current employee | Reroute/closure history | Owner change revalidated |
| Guest contact | Submission row | Separate sensitive field/class | Public input/Marketing | Strict role access | Redact on terminal/age | Never leak to employee/Read Only |
| Program feedback | Shared form | Product feedback item linked to actor/context | Employee/manager | Manager triage | Acknowledge/resolve | Separate from maintenance/supply work |
| Feedback attachment | Image data/storage | Private validated attachment | Authorized submitter | Manager triage | Retention/access audit | No public/raw path |
| Contractor assignment | CoverAll schedule/pseudo-employee | Published assignment revision | Named manager | Contractor/manager/compiler | Supersede/revoke history | Assignment ≠ acceptance |
| Contractor link | Secure token | One token to one assignment revision | Link service | Contractor | Issue/open/revoke audit | Old link cannot reveal superseded assignment |
| Contractor acknowledgement | Missing/implicit | Explicit receipt/acceptance policy | Contractor/manager | Manager/compiler as policy allows | Durable | Unaccepted work may remain OPEN |
| Contractor actual work | Slot identity/session | Actual worker or accountable slot evidence | Contractor/manager/completion service | History/analytics | Durable | Never rename as employee |

---

## 9. Security, retention and release facts

| Fact | Current competing/insufficient authority | Target canonical authority | Authorized writers | Canonical readers | Correction/history | Retirement requirement |
|---|---|---|---|---|---|---|
| Role/capability authorization | Per-route middleware and assumptions | Unified capability matrix | Security architecture | All APIs/tools | Versioned policy/audit | No hidden write path |
| RLS and grants | Strong but domain-specific | Forced RLS and least privilege per canonical table | Migration/service role | Database | Migration audit | No direct public schedule writes |
| Privileged function boundary | Mixed functions/config | Locked SECURITY DEFINER service functions | Migration/service role | Backend only | Definition/version audit | No broad execute |
| Employee credential | Native vault/device auth | Protected credential tied to device/epoch | Enrollment service | Native transport/backend | Issue/confirm/use/revoke history | No JS exposure |
| Data retention class | Feature settings/jobs | One matrix by information class | Approved policy | Purge/archive workers/audit | Policy version and purge evidence | No hidden cleanup exceptions |
| Legal/incident hold | Not unified | Explicit hold object | Authorized manager/admin | Purge/restore/audit | Open/close history | Hold blocks purge of covered evidence |
| Backup | Scripts/artifacts | Encrypted backup policy and evidence | Release/admin service | Recovery audit | Artifact/restore history | No release without current backup |
| Restore/clean rebuild | Tools | Defined RPO/RTO and periodic drill | Admin/release | Audit | Immutable drill record | Passing tests alone insufficient |
| Release identity | Frontend/backend/schema/APK values | Signed release tuple | Release pipeline | Admission/diagnostics | Immutable | No stale version labels |
| Source→artifact provenance | Build scripts/manifests | Exact commit/dependency/assets/signer | Producer pipeline | Consumer admission | Immutable evidence | No self-mutating build |
| Signer/versionCode/anti-rollback | Strong policies | Pinned production controls | Protected pipeline | Admission/phone | Immutable | Never weaken for feature branch |
| Build 22 rollback | Fleet baseline | Preserved known-good artifact/config | Release admin | Canary/fleet recovery | Evidence | Retain until replacement accepted |
| Physical acceptance | Ad hoc/future | Versioned test matrix and signed result | Test operator | Release gate | Immutable evidence | No source-only GO |

---

## 10. Authority acceptance test

Before a fact can be called canonical, the architecture and later implementation must prove:

1. One writer or deterministic compiler owns the fact.
2. Every consumer uses the same versioned contract.
3. Missing data is explicit error/`OPEN`/`not_required`, not inferred fallback.
4. Corrections append history rather than overwrite it.
5. Role access and field redaction are defined.
6. Retention and holds are defined.
7. Migration retires every competing writer/reader.
8. Tests include constraint, property, race, fault, integration and rollback cases.
9. Physical behavior is proven where source cannot decide.

No schema or product implementation is authorized by this register.