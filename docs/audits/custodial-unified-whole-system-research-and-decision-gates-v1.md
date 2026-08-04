# Memphis Zoo Custodial Program — Research and Decision Gates v1

**Status:** Active gate registry; no implementation authorization  
**Prepared:** 2026-08-04

---

## 1. Rule

Do not ask Eric to decide a fact that can be established from source, production data, field observation, existing policy records or physical-device testing.

Do not let builders guess a genuine policy decision merely because asking is inconvenient.

Each gate has one class:

- **SRC:** repository/backend source research;
- **DBS:** production schema/function/grant research;
- **DBD:** production data/provenance research;
- **OPS:** operational field observation;
- **PHY:** Moto G/Fully Kiosk physical research;
- **POL:** genuine Eric/management policy decision;
- **AUD:** independent architecture/security/migration audit.

A gate is closed only by recorded evidence, not optimistic prose.

---

## 2. Static schedule and workforce gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-SCH-001 | DBD/POL | What is the approved static schedule source for every weekday? | 339 active group rows; source approval incomplete | Approved artifact and digest for all seven days | Static version, baseline, compiler |
| G-SCH-002 | DBD/POL | What is authoritative Sunday policy? | 135 Sunday location rows conflict heavily with group expansion | Named approval of normalized Sunday source; old rows classified migration-only | Static publication and migration |
| G-SCH-003 | SRC/DBS | Enumerate every schedule writer and trigger | Generator, absence trigger and AI message trigger confirmed; inventory incomplete | Complete writer graph with retirement disposition | Whole-system architecture and migration |
| G-SCH-004 | SRC/DBS | Enumerate every current owner resolver/read fallback | Three conflicting resolver paths confirmed | Complete consumer/resolver graph | Authority register and cutover |
| G-SCH-005 | DBD/OPS/POL | Which rules belong to stable positions versus intentionally named people? | Current templates directly reference employees; hard-coded employee behavior exists | Reviewed mapping with explicit person-bound exceptions | Identity and schedule schema |
| G-SCH-006 | POL | May any normal weekly rule remain permanently person-bound? | Not decided | Exact allowed cases and reason, or position-only policy | Static schedule design |
| G-SCH-007 | DBS/OPS | How are vacancies represented and escalated today? | Historical employees kept active; no canonical vacancy | Production/field evidence and target vacancy workflow | Workforce model |
| G-SCH-008 | POL | What is the required action when a position is vacant? | Architecture says solve or `OPEN`; escalation details incomplete | Approved default and manager workflow | Compiler and manager UX |
| G-SCH-009 | OPS/POL | What are the exact 9:45 operating rules? | Current code hard-codes 9:45; intended restroom-only phase known | Approved location-level fixture set | Static phases and notifications |
| G-SCH-010 | OPS/POL | What are lunch start/end and restoration rules, including 9:45/shift-end collisions? | Conceptual architecture exists | Approved scenario matrix | Compiler and employee Schedule |
| G-SCH-011 | OPS/POL | What are late-day inheritance tie-breakers? | Current read uses weighted dynamic candidates and `All Locations` | Field-reviewed geography/workload rules | Compiler |
| G-SCH-012 | POL | How quickly and to whom must `OPEN` escalate? | Manager escalation legacy default 30 minutes; not canonical | Approved chain, grace, acknowledgement and closure | Status/notification/manager product |

---

## 3. Workload and geography gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-WRK-001 | OPS/DBD | Per-location/per-purpose expected minutes/load | Only sparse group manual values | Field measurement and manager-approved profiles with confidence | Compiler design and analytics |
| G-WRK-002 | OPS/POL | Required service frequency by location/purpose/window | Timers mostly form-type defaults | Approved frequency matrix | Requirement/status model |
| G-WRK-003 | OPS/DBD | Difficulty and priority by location/purpose | Optional mutable fields; no active group scoring | Reviewed versioned profile | Compiler and analytics |
| G-WRK-004 | OPS/DBD | Exact zones and route anchors | Group zones exist; no location zones | Reviewed location-level zone map | Route model |
| G-WRK-005 | OPS/DBD | Walking-time/adjacency evidence | Complete group graph, not location-level/versioned | Versioned location/route edges with source/confidence | Compiler determinism |
| G-WRK-006 | POL | Which optimization dimensions and ordering are binding? | Static preservation/minimal movement already fixed; lower priorities not fully weighted | Approved hard/soft objective order | Compiler implementation |
| G-WRK-007 | OPS | How should mixed groups be displayed while locations remain authoritative? | Seven mixed groups confirmed | Manager/employee display rule without restoring group authority | Product contracts |

---

## 4. Operating-window and event gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-OPS-001 | DBD/POL | Normal zoo open/close policy by effective date | `operating_hours` empty; 6 PM fallback | Approved effective-dated source | Requirement compiler |
| G-OPS-002 | POL | Exact September 14 transition | Not configured | Approved date/time fixture and source | Requirement/status tests |
| G-OPS-003 | OPS/POL | Location-specific and split windows, including Splash Pad | Conceptual need and operating notes | Approved location policy matrix | Requirement compiler |
| G-OPS-004 | OPS/POL | After-hours and event service requirements | Under-specified | Approved event/after-hours scenarios | Events and requirement inputs |
| G-OPS-005 | POL | Cross-midnight service-date semantics | Current schema prohibits end before start | Approved day-offset/time-range convention | Schema and compiler |
| G-EVT-001 | SRC/DBS | Complete event writer/parser/import/cancel graph | Broad source exists; production coupling research incomplete | Full graph and trigger retirement list | Event architecture |
| G-EVT-002 | POL | Which events appear to employees? | Current board shows broad published events | All versus owned-area/shift relevance rule | Employee Events projection |
| G-EVT-003 | POL | May employees see attendance counts? | Historical/current screens include attendance | Approved employee/manager/Read Only field matrix | Event products |
| G-EVT-004 | POL | Who may approve event custodial impact and ownership change? | Named manager requirement direction | Role and confirmation policy | Event/ownership integration |
| G-EVT-005 | AUD | Prove event save/import/edit/cancel cannot mutate schedule | Current AI message trigger demonstrates read-side mutation elsewhere | Source and later integration tests | Architecture GO |

---

## 5. Operational status and inspection-readiness gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-STS-001 | OPS/POL | What exact conditions mean `inspection_ready`? | v17 purpose clear; current `okay` insufficient | Approved state truth table | Status/readiness schema and Dashboard |
| G-STS-002 | POL | Which issue severities block readiness? | Not canonical | Severity matrix | Completion/issues/readiness |
| G-STS-003 | POL | Does a minor open maintenance issue permit readiness with follow-up? | Not decided | Approved rule and manager wording | Readiness projection |
| G-STS-004 | POL | When is a manager inspection required versus optional spot check? | Inspection policy mode `manager_spot_check`; target 0 | Approved inspection policy | Inspection queue and analytics |
| G-STS-005 | OPS/POL | Freshness windows by location/purpose/season | Current restroom/exhibit defaults only | Approved versioned status policy | Status episodes |
| G-STS-006 | SRC/DBS | Complete status/alert/clear/reopen writer graph | Scan-trigger clear confirmed; graph incomplete | Full graph and retirement plan | Status architecture/migration |
| G-STS-007 | POL | Who may correct/reopen historical status and when is second approval required? | Architecture proposes second approval for disciplinary impact | Approved authority policy | Bitemporal correction |

---

## 6. Employee runtime, NFC, offline and GPS gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-APP-001 | SRC | Exact current Custodial packaged asset/runtime graph | Existing inventories show hybrid graph | Complete source-to-mobile-dist route/owner graph | Employee architecture |
| G-APP-002 | POL | Confirm four-button Home remains exact normal design | Current explicit decision says yes | Written confirmation only if changed; otherwise treated closed | Employee product |
| G-APP-003 | SRC/PHY | Exact deployed NFC NDEF payloads and Android handling | Build 22 vibration/no-open history; URLs in location table | Payload inventory and reproduced controlled test | NFC design |
| G-APP-004 | PHY | NFC from lock, Home, Schedule, Messages, Events, Feedback, cold/warm, wake, reboot, offline | Not proven | Recorded physical matrix | Physical GO |
| G-APP-005 | SRC/PHY | Active timer and draft restoration after process death | Browser/source protections exist | Instrumented Android and Moto G proof | Employee release |
| G-APP-006 | SRC/PHY | Exactly-once offline session/completion reconciliation | Queue protections exist; terminal model incomplete | Fault and physical test evidence | Component/physical GO |
| G-APP-007 | POL | Maximum offline ownership-snapshot age | Architecture requires bounded age | Approved duration by risk/operations | Offline architecture |
| G-APP-008 | POL | May work continue when GPS permission/accuracy fails? | Proposed default continue work + manager exception | Approved policy | GPS/session behavior |
| G-GPS-001 | OPS/PHY | Per-location GPS calibration/accuracy and false-exit rate | Sparse location calibration | Field trials and versioned calibration | GPS implementation |
| G-GPS-002 | POL | Raw GPS retention period | Not approved | Exact duration, holds and access | Retention/schema |
| G-GPS-003 | POL | Permitted manager/AI use of GPS evidence | Active-session-only collection fixed; interpretation policy incomplete | Role/use matrix | Dashboard/analytics/AI |
| G-UX-001 | PHY/POL | Karen acceptance threshold | Suggested 95% success, zero lost work/wrong-recipient frames | Approved pass/fail standard | Release GO |

---

## 7. Messenger and notification gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-MSG-001 | SRC/DBS | Complete Messenger identity/thread/outbox/delete/purge graph | Broad source/DB objects exist | Full graph and contract | Messenger architecture |
| G-MSG-002 | POL | Messenger archive requirement beyond 14-day presentation retention | 14-day current setting | Approved archive/redaction policy | Retention/schema |
| G-MSG-003 | POL | May employees create group messages? | Current decision suggests manager-only | Confirm manager-only or exact exceptions | Messenger product |
| G-MSG-004 | PHY | Zero stale-recipient frame and thread-open performance | Source guards partial | Throttled and Moto G frame/timing evidence | Physical GO |
| G-NOT-001 | SRC/DBS | Complete alert producer/transport/presentation/ack/escalation graph | Multiple pipelines confirmed | Full graph and one target pipeline | Notification architecture |
| G-NOT-002 | POL | Exact wording for each employee alert class | Core cadence fixed; copy not all final | Approved copy dictionary | Employee notification contract |
| G-NOT-003 | PHY | Exact two-cycle audio, no duplicate OS sound, overlay persistence/queue | Not proven | Recorded audio/screen evidence | Physical GO |
| G-NOT-004 | SRC/DBS/PHY | Durable acknowledgement retry and reconciliation | Device ack table exists; local loss risk | Fault and physical proof | Component GO |
| G-NOT-005 | POL | Manager escalation chain by alert type | Legacy single-manager selection and grace | Approved role/recipient matrix | Notification/status architecture |

---

## 8. Issues, feedback, guest and contractor gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-ISS-001 | OPS/POL | Employee reporting taxonomy | Current feedback is mixed; v17 forms rich | Approved App Help, Phone/NFC Help, Maintenance, Supply, Guest Follow-up, Work Request, Emergency split | Employee product and issue schema |
| G-ISS-002 | OPS/POL | Ticket versus W.O. Submitted versus closure semantics | Operational doctrine partly known | Approved lifecycle and actors | Issue/ticket architecture |
| G-GST-001 | POL | Whether/when guest reporting may activate | Current setting false; Marketing required | Explicit later approval | Guest implementation/activation |
| G-GST-002 | POL | Guest data allowed: free text, contact, photos, anonymous | Not decided | Data-minimization policy | Guest schema/privacy |
| G-GST-003 | SRC/DBS | Full guest approval/routing/redaction/retention graph | Partial source and settings | Complete graph and security audit | Guest architecture |
| G-FBK-001 | SRC/DBS | Attachment validation/storage/access/retention | Capability exists | Full security and retention contract | Feedback architecture |
| G-CON-001 | POL | Named contractor worker required or vendor slot allowed | Not decided | Approved policy | Contractor schema |
| G-CON-002 | POL | Is assignment considered covered before acknowledgement? | Architecture says not automatically; exact rule open | Approved delivery/acceptance rule | Ownership compiler/OPEN |
| G-CON-003 | OPS | How CoverAll actually receives and confirms work | Secure link exists; field practice unknown | Observed workflow | Contractor product |
| G-CON-004 | POL | English/Spanish and acknowledgement wording | Architecture direction | Approved content | Contractor view |

---

## 9. AI, security, retention and recovery gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-AI-001 | SRC/DBS | Complete Memphis/MCP/Moxie/Gemini tool and mutation graph | Schedule-generating Memphis trigger confirmed | Tool registry with read/write/action classification | AI architecture |
| G-AI-002 | POL | Which actions may AI execute versus only propose? | Unresolved | Capability-specific confirmation/second approval policy | Tool implementation |
| G-AI-003 | POL | Final production role of Moxie and controlled diagnostics | Exists; role unresolved | Production/private-admin/internal-only decision | Product/security architecture |
| G-SEC-001 | DBS/AUD | Complete RLS/grant/SECURITY DEFINER/search-path audit | Sampled controls strong | Full target-domain matrix | Schema GO |
| G-SEC-002 | AUD | Threat model across employee, manager, Read Only, public, contractor, AI and service role | Not complete | Independent security audit | Architecture GO |
| G-RET-001 | POL/DBS | Complete data-class retention matrix | Feature settings fragmented | Approved matrix and FK/purge design | Schema GO |
| G-RET-002 | POL | Legal/incident hold authority and scope | Missing | Approved hold workflow | Retention/schema |
| G-DR-001 | SRC/AUD | Verify encrypted backup, clean rebuild and restore drill | Tools/evidence reported | Reproducible independent evidence and RPO/RTO | Release architecture |
| G-DR-002 | POL | Required RPO/RTO | Not approved | Exact objectives | Recovery/release |

---

## 10. Migration, release and physical gates

| Gate | Class | Question/evidence required | Current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-MIG-001 | SRC/DBS | Complete writer/reader/worker/queue/consumer graph | Partial inventories | Reviewed full graph | Migration design |
| G-MIG-002 | AUD | Schema and historical migration plan | Existing schema audit NO-GO | Independent migration audit | Schema/migration GO |
| G-MIG-003 | AUD | Shadow comparison and unexplained-difference process | Conceptual | Approved fixtures, metrics and review | Cutover |
| G-MIG-004 | AUD | One all-consumer authority pointer and complete rollback | Conceptual | Fault-tested design | Migration GO |
| G-REL-001 | SRC/AUD | Source→asset→APK provenance and admission | Strong current controls | Frozen-commit producer/consumer proof | APK GO |
| G-REL-002 | PHY | Production-signed upgrade over Build 22 preserves vault/enrollment/work | Not proven | Controlled canary evidence | Physical GO |
| G-REL-003 | PHY | Fully Kiosk containment, reboot and escape prevention | Not proven | Recorded matrix | Physical GO |
| G-REL-004 | PHY | Performance/accessibility/keyboard/gloves/large text | Not proven | Moto G matrix | Physical GO |
| G-REL-005 | AUD | Final release evidence and rollback review | Not reached | Independent release audit | Release GO |

---

## 11. Eric decisions currently required

The following are genuine policy choices after research narrows the options:

1. Named-person rules versus replaceable schedule positions.
2. Vacancy/default `OPEN` escalation policy.
3. Contractor named worker versus accountable vendor slot.
4. Contractor assignment delivery/acceptance requirement.
5. Exact inspection-readiness and issue-severity rules.
6. Inspection requirement/spot-check policy.
7. Employee event relevance and attendance visibility.
8. Manager authority tiers.
9. AI/MCP/Moxie/Gemini permitted actions and approval.
10. Raw GPS retention and evidence use.
11. Messenger archive policy beyond employee presentation retention.
12. Guest data collection if feature is later activated.
13. Moxie/diagnostics production versus internal-only role.
14. RPO/RTO and legal/incident holds.
15. Binding Karen acceptance threshold.
16. Any change to Read Only beyond Dashboard and Events; current decision permits none.

Do not interrupt current research to ask these prematurely. Present each decision with source evidence, operational consequences, recommended default and alternatives after source/field research is complete.

---

## 12. Gate status summary

- Source and production research: **active**.
- Major policy gates: **open**.
- Whole-system architecture: **drafting not yet approved**.
- Schema/component design: **blocked**.
- Implementation: **blocked**.
- Migration/APK/phone/release: **blocked**.