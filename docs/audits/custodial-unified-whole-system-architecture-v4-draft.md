# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4 Draft

**Status:** Internal architecture draft; implementation is not authorized  
**Draft revision:** 4.0-draft.1  
**Prepared:** 2026-08-04  
**Research branch:** `agent/custodial-unified-whole-system-v4-20260803`  
**Imports:** Canonical Ownership Foundation Architecture v3.1 as the ownership subsystem specification  
**Rollback baseline:** Custodial Build 22

---

## 1. Purpose

The Memphis Zoo Custodial Program exists to remove operational uncertainty without turning custodians into data-entry clerks or making managers reconstruct the day from radio calls, memory and disconnected screens.

The complete program must answer, from one coherent system:

1. What work is required at this location and time?
2. Who is responsible for it and why?
3. Who is actually performing or performed it?
4. Was physical location interaction recorded?
5. What services were completed?
6. What issue, supply need or out-of-order condition was found?
7. Is the location ready for inspection, ready with follow-up, blocked or overdue?
8. What changed in schedule, staffing, events, ownership or operating policy?
9. Who was notified, what did the device present and what did the user acknowledge?
10. What evidence is retained for inspection, coaching, maintenance, staffing, audit, recovery and release?
11. Which product and actor may read or change each fact?
12. Can the complete system be rebuilt, migrated, rolled back and proven on the actual Moto G/Fully Kiosk fleet?

This architecture treats ownership as one chapter of a larger operating system. It does not place unrelated applications around an ownership database and hope they agree later.

---

## 2. Architecture status and authorization

This draft is documentation only.

It authorizes:

- source and production research;
- architecture modeling;
- internal and independent audit;
- fixture and test-plan design that cannot mutate production.

It does not authorize:

- schema DDL;
- backend implementation;
- frontend implementation;
- migration;
- workflow/build execution;
- APK production;
- phone or Fully Kiosk changes;
- production-data changes;
- release.

Architecture v4 must be internally audited, replanned and independently audited before isolated schema or component design begins.

---

## 3. Governing principles

1. **One authority per fact.** Every operational fact has one canonical writer/resolver and role-specific projections.
2. **Static first.** Published normal policy is not re-optimized on an ordinary day.
3. **Exception only.** Absence, contractor capacity, lunch, departure, event impact and manager action alter only affected locations and intervals.
4. **Location-level truth.** Groups never become final responsibility authority.
5. **Source facts, commands, compiled facts and presentation are different classes.** They are never collapsed into one mutable row.
6. **Read paths never write.** Schedule, Dashboard, Messenger, AI, event display and reports cannot generate or mutate operational authority.
7. **Immutable publication and history.** Published policy, accepted evidence and historical assertions are appended or superseded, not silently rewritten.
8. **Bitemporal correction.** The system can answer what it believed at the time and the later corrected operational truth.
9. **Explicit states.** `OPEN`, `not_required`, conflict, unavailable and unknown are represented; missing rows are not meaning.
10. **Owner is not cleaner.** Responsibility, active performer and actual performer remain separate.
11. **Work request is not transfer.** One-time requested work does not silently change ownership.
12. **Deterministic and idempotent.** Identical canonical inputs produce identical logical output; repeated operations do not duplicate effects.
13. **Atomic publication.** No consumer sees half of a revision or a partially changed truth domain.
14. **One lifecycle owner per client product.** NFC, navigation, notifications, security, active work and local durability have named owners.
15. **Security before convenience.** Role, field, credential and tool authority are explicit before APIs are built.
16. **Employee-safe presentation.** Technical details remain in diagnostics, not Karen's primary interface.
17. **Physical behavior is architecture.** NFC, wake, audio, GPS, Fully Kiosk and performance are not deferred polish.
18. **No permanent bridge.** Temporary shadow or compatibility mechanisms have bounded scope and retirement conditions.
19. **Complete rollback.** Rollback returns an indivisible authority set, not a random mixture of endpoints.
20. **No release by narrative.** Source, schema, artifact and physical evidence control every gate.

---

## 4. Capability canon and disposition

The controlling capability inventory is `custodial-unified-whole-system-capability-canon-v1.md`.

Architecture v4 must provide an explicit home for every retained or rebuilt capability. Optional and future capabilities must have a bounded extension seam and cannot weaken the current core product.

Obsolete behavior in the canon is prohibited from reappearing through compatibility pages, hidden routes, packaged assets, tests or backend fallbacks.

---

## 5. Actors and product boundaries

### 5.1 Custodial Employee

May:

- see current assigned areas;
- scan NFC and perform assigned or authorized help work;
- preserve and complete field work offline;
- send and receive authorized messages;
- read relevant event notices;
- report app/phone help and approved operational exceptions;
- receive operational notifications.

May not:

- choose or alter employee identity;
- edit schedules or ownership;
- see manager controls, credentials, device IDs, raw GPS or diagnostics;
- use employee QR as normal workflow;
- remove enrollment;
- access manager triage, Read Only administration or AI repair tools.

### 5.2 Full Access Manager

May, subject to role capability:

- review operational status and inspection readiness;
- inspect completed work;
- manage static schedule versions and exception inputs;
- preview exact ownership changes and publish approved revisions;
- create work requests and transfers as separate actions;
- manage events and proposed custodial impacts;
- communicate directly, in groups and by broadcast;
- review issues, tickets, feedback and approved guest reports;
- manage employees, positions, phones and enrollment;
- use approved AI, Moxie and diagnostics tools;
- perform named corrections and controlled recovery.

No manager screen may bypass backend authority by writing database tables directly.

### 5.3 Read Only

Private product containing only:

- Dashboard projection;
- Events projection.

It has no write actions and receives no employee route detail, device identity, raw GPS, private notes, Messenger, feedback, schedule administration, phone controls, AI tools or diagnostics.

### 5.4 Marketing reviewer

Exists only if guest reporting is approved. May review public guest submissions and approve/reject operational dispatch. Marketing review does not define ownership.

### 5.5 Contractor

Receives a limited, expiring assignment revision through an approved secure channel. Has no employee or manager product authority.

### 5.6 AI/MCP/Moxie/diagnostic actors

Each tool is registered with:

- product and role availability;
- data source and freshness;
- read/propose/write class;
- required confirmation or second approval;
- idempotency and audit behavior;
- rollback and failure behavior;
- field-level redaction.

AI never receives write authority merely because the invoking user could perform the action manually.

### 5.7 Service and worker actors

Every automated writer uses a registered system actor, exact capability, version and correlation ID. Anonymous strings such as `Dashboard` are not sufficient actor identity.

---

## 6. Common fact and event contract

All authoritative facts, commands, compiled outputs and operational events share a common envelope.

Required fields:

- stable event/fact/command ID;
- domain and type;
- schema version;
- idempotency key where mutable effect is possible;
- actor type and canonical actor ID;
- source artifact or source record;
- valid-time start/end when applicable;
- recorded/published time;
- correlation and causation IDs;
- supersedes/superseded-by IDs;
- authority class;
- reason code and human explanation where required;
- policy/compiler/release version;
- data-class and retention class;
- integrity hash or canonical payload digest where required.

### 6.1 Fact classes

- source artifact/fact;
- manager/public/contractor command;
- compiler output;
- operational evidence;
- status transition;
- projection snapshot;
- notification intent and presentation evidence;
- administrative correction;
- migration/release evidence.

### 6.2 Transactional outbox rule

Any transaction that changes authoritative state and requires downstream delivery writes the authoritative event and outbox intent in the same transaction. No worker may claim an uncommitted job.

### 6.3 Projection rule

Projections are disposable and rebuildable from authoritative facts. A projection may cache or aggregate; it may not become a competing writer.

---

## 7. Identity and workforce architecture

### 7.1 Permanent employee identity

Employee identity remains permanent even after employment ends. Historical sessions, messages, inspections, tickets and ownership remain linked to the original employee.

### 7.2 Separate effective states

The system stores separate effective-dated states for:

- employment;
- schedule eligibility;
- Messenger eligibility;
- phone eligibility;
- training/restriction capability;
- leave/absence;
- position occupancy.

A single Boolean cannot control all meanings.

### 7.3 Schedule positions

Normal schedule rules reference a stable position unless an explicitly reviewed rule is intentionally person-bound.

A position has:

- stable ID/code/label;
- normal role/shift context;
- capability and restriction requirements;
- effective status;
- current occupant through an effective-dated assignment;
- occupancy history.

A vacancy is explicit and becomes a compiler input. A future hire receives a new employee identity and may occupy the prior position.

### 7.4 Device identity and assignment

Each employee phone has:

- canonical device ID;
- protected credential;
- assignment epoch;
- current employee assignment;
- enrollment/recovery state;
- push-registration state;
- last accepted use and security health;
- assignment history.

Every employee-scoped request is authorized against the current credential and assignment epoch. A stale phone or queue item cannot attribute work to a new employee after reassignment.

### 7.5 Active-work reassignment guard

Ordinary phone reassignment is blocked while the device has:

- an active session;
- unfinished completion form;
- durable offline work;
- unresolved queue conflict;
- pending enrollment/removal operation.

Emergency recovery quarantines normal use and creates a manager reconciliation case.

---

## 8. Static schedule and ownership foundation

This chapter imports the validated principles of Canonical Ownership Foundation Architecture v3.1.

### 8.1 Source and publication

```text
approved source artifact
→ normalized unresolved preview
→ reviewed position/person/location mapping
→ immutable static schedule version
→ membership and policy snapshots
→ immutable location-level daily baseline
```

Publication freezes:

- source digest;
- schedule rules;
- positions/person-bound rules;
- shifts/lunches/phases;
- group membership snapshot;
- applicable operating-policy revision;
- location metadata needed for baseline expansion.

### 8.2 Authoritative units

- Schedule groups: authoring/display/workload convenience.
- Individual locations: final responsibility unit.
- Schedule subjects: position, intentionally person-bound employee or contractor engagement.
- `OPEN` and `not_required`: responsibility states, not fake subjects.

### 8.3 Date-specific inputs

Append-only inputs include:

- position occupancy/eligibility changes;
- absence/PTO/callout;
- contractor capacity/engagement;
- approved event/after-hours requirement;
- location/operating-policy override;
- explicit transfer;
- emergency override;
- correction/cancellation.

### 8.4 Compiler stages

For every service date and location:

1. Resolve operational requirement intervals.
2. Expand published static policy to individual locations.
3. Resolve position occupants and hard eligibility.
4. Apply absence/PTO and approved contractor capacity, preserving unaffected ownership.
5. Apply exclusive lunch transfer and restoration.
6. Apply shift-end/departure inheritance.
7. Apply ordinary manager transfer.
8. Apply emergency override.
9. Validate completeness/non-overlap/conflicts.
10. Calculate exact diff and grouped employee/manager consequences.
11. Publish atomically with notification intents and authority pointer.

### 8.5 Compiler objective order

Hard order:

1. operational requirement and hard eligibility;
2. preserve unaffected static ownership;
3. minimize moved locations and interval churn;
4. preserve required related-location constraints;
5. route/geographic coherence;
6. workload fairness;
7. deterministic reviewed tie-breaker.

No lower priority may move valid static ownership merely to create a prettier score.

### 8.6 Current-owner result

Every query returns exactly one of:

- employee owner;
- contractor owner;
- `OPEN`;
- `not_required`;
- explicit conflict/error before publication.

Result includes:

- location;
- effective interval;
- owner/state;
- responsibility purpose;
- reason and controlling input/transition;
- publication revision;
- source/static version;
- data freshness.

No consumer applies fallback precedence.

### 8.7 Historical truth

Ownership assertions are bitemporal:

- valid time: when responsibility applied;
- recorded time: when assertion was stored/corrected.

A correction appends a new assertion and closes recorded time for the prior assertion. It never erases what users previously saw.

---

## 9. Workload, route and restriction architecture

### 9.1 Versioned workload profile

Per location, purpose and applicable season/window:

- expected minutes/load points;
- service frequency;
- difficulty and priority;
- restriction/capability requirements;
- source and confidence;
- effective revision.

Unknown values remain unknown and block lower-confidence optimization. They are not created by dividing group totals.

### 9.2 Versioned route model

Contains:

- location coordinates or route anchors;
- zones/clusters;
- adjacency and walking time;
- access restrictions;
- source/confidence;
- effective revision.

Historical compiler runs fingerprint the exact route/workload revisions.

### 9.3 Field research

Values are approved only after:

- actual walking-path observation;
- representative service timing;
- manager review;
- seasonal/event consideration;
- outlier/confidence documentation.

### 9.4 Employee presentation

Route data affects schedule quality and manager explanation. It never creates an employee turn-by-turn route.

---

## 10. Operating requirement architecture

### 10.1 Versioned policy layers

Precedence for a location/date:

1. emergency closure/shutdown;
2. explicit dated location override;
3. approved event/after-hours rule;
4. seasonal location policy;
5. normal location policy;
6. general zoo policy.

Equal-authority conflicts block publication.

### 10.2 Required versus not required

- Inside approved service requirement: one employee/contractor or explicit `OPEN`.
- Outside requirement: `not_required`.
- Active work may continue across close under session policy without extending the requirement interval.

### 10.3 Time semantics

All intervals are half-open `[start,end)` in America/Chicago and stored with an explicit service date and day offset or timestamp range supporting cross-midnight work.

The architecture must include approved fixtures for September 14, Splash Pad split windows, after-hours events and closure overrides before schema design.

---

## 11. Employee application contract

### 11.1 One product and one normal Home

Normal Home contains only:

- `Memphis Zoo Custodial`;
- employee name;
- Schedule;
- Messages;
- Events;
- Feedback.

A deliberately separate full-screen recovery state may replace Home only when protected identity/security is not usable. It says what the employee should do, not why the software failed.

### 11.2 Navigation

- One application/router owns employee navigation.
- Schedule, Messages, Events and Feedback return to the same Home.
- NFC may interrupt any ordinary screen and opens the scanned workflow.
- Completing/cancelling the scan workflow returns to the appropriate employee context.
- Android Back cannot escape to obsolete pages or manager/setup controls.

### 11.3 Schedule presentation

Employee Schedule answers one question:

> What areas are mine right now?

Allowed sections:

- `Your areas now`;
- `Temporary lunch coverage until [time]`;
- `Added to you`;
- a short changed/removed notice when needed.

Public restrooms display first. No Current/Next/route-step language, full-day generated itinerary or synthetic `All Locations` appears.

### 11.4 Messages

Employee mode supports direct-recipient messaging through large person rows. New → tap person → conversation. Group and broadcast creation are manager-only unless later approved.

### 11.5 Events

Employee Events shows relevant published notices:

- event;
- where;
- when;
- area/restroom impact;
- plain instruction.

No backend, parser, attendance or data-board terminology appears unless specifically approved.

### 11.6 Feedback and help

Employee Feedback is limited to app/phone help. Operational issues use their proper domains:

- app help;
- phone/NFC help;
- maintenance issue;
- supply need;
- guest cleanliness follow-up if enabled;
- one-time work request;
- emergency assistance.

### 11.7 Employee copy contract

Banned ordinary-user terms include raw HTTP, queue, retry count, credential, epoch, device ID, backend, thread, GPS accuracy and protected recovery.

Approved examples:

- `This phone needs a manager.`
- `Saved. It will send when connected.`
- `Tag not recognized. Tell a manager.`
- `Wait a moment. The phone will try again.`
- `Finish the cleaning already open.`
- `Return to [location].`
- `No current areas. Contact the Custodial Manager.`

Technical details go to structured diagnostics.

---

## 12. Native employee runtime and Fully Kiosk

### 12.1 Single lifecycle owner

The Android native shell is authoritative for:

- app lifecycle;
- protected identity/vault;
- NFC intent acquisition and normalization;
- notification intake and presentation orchestration;
- foreground/background/wake/reboot handling;
- active-session GPS lifecycle;
- protected local operation store;
- lock-task/Fully Kiosk containment;
- handoff to the single employee UI application.

The employee UI is one application presentation layer. Historical HTML pages may be used only as audited extracted components behind explicit interfaces, not independent lifecycle owners.

### 12.2 Protected local state

A first-party protected store contains:

- assignment epoch and security state;
- current session mirror;
- completion draft;
- offline operation log;
- ownership snapshots;
- active/pending notification presentation state;
- acknowledgement outbox;
- schema and app-format version.

Ordinary browser localStorage is not authoritative for credentials or critical state in the APK.

### 12.3 Recovery priority

On launch/wake/restore:

1. reconcile security/enrollment operation;
2. restore active session or unfinished completion;
3. restore active notification overlay;
4. process pending terminal/transient reconciliation;
5. otherwise open normal Home.

An active workflow does not disappear behind Home or lock state.

### 12.4 Fully Kiosk containment

Architecture requires proof for:

- one allowed app;
- Home/Recents blocked;
- reboot return;
- no settings/launcher escape;
- NFC from kiosk lock;
- no employee access to enrollment removal;
- upgrade and rollback preserving approved security state.

---

## 13. NFC and tag architecture

### 13.1 Tag registry

Each tag has:

- stable tag ID;
- encoded payload identity/hash;
- location ID;
- issued/installed/revoked/replaced state;
- effective interval;
- source/installer;
- expected platform route;
- audit history.

### 13.2 Intake

Native intake supports:

- cold start;
- already-running new intent;
- Fully Kiosk lock state;
- screen wake;
- offline state;
- dedupe of repeated intent delivery.

The native layer accepts only approved payload formats and resolves the registry before employee presentation.

### 13.3 Employee outcome

- Valid tag: confirm location and show Start Cleaning or active-session continuation.
- Unknown/revoked tag: `Tag not recognized. Tell a manager.`
- Different location while active: preserve active work and instruct return/manager action.
- Duplicate scan: idempotent continuation, no duplicate session.
- NFC unavailable: logged manager-supported fallback only.

A scan receipt proves tag interaction context. It does not prove completion, quality or ownership.

---

## 14. Cleaning session architecture

### 14.1 Session binding at start

Session binds to:

- session and client operation ID;
- device credential/device ID/assignment epoch;
- permanent employee identity;
- location/tag evidence;
- start timestamp;
- ownership revision and owner at start;
- owner/cleaner relation;
- approved help/work-request reason if different;
- offline snapshot when applicable;
- app/release version.

### 14.2 State machine

```text
proposed
→ active
→ finish_requested
→ completion_draft
→ submitted_pending_acceptance
→ accepted_closed
```

Branches:

```text
active → cancelled
active/completion → conflict_manager_review
pending → duplicate_replay
pending → rejected_invalid_identity
pending → terminal_cancelled
```

### 14.3 Ownership transition during active work

Ownership change does not erase valid work.

Relations:

- `owner_cleaning`;
- `cross_ownership_active`;
- `manager_directed_help`;
- `ownership_conflict_review`.

The new owner remains responsible after the boundary. The original cleaner may finish unless an emergency action requires stop.

### 14.4 Concurrency

- one active session per location;
- one active field session per employee/device unless explicitly supported later;
- stable operation IDs prevent duplicate starts/finishes/completions;
- conflicting requests fail closed and preserve evidence.

### 14.5 Offline

Offline start requires a recent protected ownership snapshot covering the location/time/epoch. Reconnect outcomes are deterministic and terminal failures do not retry forever.

Acceptance of work never retroactively changes ownership.

---

## 15. Completion evidence architecture

### 15.1 Versioned service taxonomy

Each area/form type has a versioned taxonomy of:

- common full-clean services;
- individual service details;
- supply checks;
- issue/fixture categories;
- out-of-order details;
- required notes/confirmation;
- readiness/status consequences.

Accepted completion retains the taxonomy version used.

### 15.2 Low-tech interaction

Normal path:

1. confirm full cleaning completed;
2. optionally add specific services/exceptions;
3. report a problem when present;
4. review and submit.

Rich evidence remains available through progressive disclosure. The employee does not traverse a wall of descriptions for an ordinary full clean.

### 15.3 Restroom and exhibit distinction

Restroom and exhibit evidence remain separate. Generic area forms may be added only through explicit form-type contracts.

### 15.4 Atomic acceptance

Completion acceptance atomically:

- verifies identity/session/operation ID;
- stores the completion evidence;
- creates structured observations/issues/tickets as required;
- closes or transitions session;
- advances the operational status episode;
- writes notification cancellation/escalation consequences;
- writes analytics facts/outbox intents;
- returns accepted state and reconciliation result.

No client-side success is shown until local durable state or server acceptance guarantees recovery.

---

## 16. Active-session GPS architecture

### 16.1 Scope

GPS starts only after session start and stops after accepted close, cancel or terminal reconciliation. No continuous off-session tracking is part of this release.

### 16.2 Evidence

Collect minimum required fields:

- observed time;
- coordinate and accuracy;
- calibrated distance;
- staleness/motion validation;
- evidence classification;
- session/location/device identity.

### 16.3 Quality and discipline limits

- Low-accuracy, stale, impossible-speed or missing observations become unverified evidence.
- No disciplinary conclusion is based on one point or uncalibrated location.
- Work can remain valid even when GPS is unavailable, subject to approved policy and manager-visible exception.

### 16.4 Retention

Raw points have short policy-controlled retention. Durable session summary, excursion boundaries, permission failure and incident hold remain linked to session history.

---

## 17. Operational status and inspection readiness

### 17.1 Root episode

Each required service cycle has one durable episode with:

- location and requirement interval;
- policy/service-frequency revision;
- prior accepted completion basis;
- due and overdue boundaries;
- current state;
- accepted completion linkage;
- issue/follow-up/inspection linkage;
- correction/reopen history.

### 17.2 State dimensions

Do not force all truth into one status code. Store separate dimensions:

- requirement: `required`, `not_required`, `cancelled`;
- timing: `not_due`, `due_soon`, `overdue`;
- work: `not_started`, `in_progress`, `submitted`, `accepted`;
- issue: none/minor/major/critical plus open/closed;
- follow-up: none/required/completed;
- inspection: not_requested/pending/passed/failed/follow_up;
- readiness: ready, ready_with_follow_up, blocked_issue, blocked_incomplete, blocked_inspection, not_required;
- evidence confidence/freshness.

### 17.3 Readiness resolver

The resolver uses:

- accepted completion;
- required service/taxonomy evidence;
- issue severity/out-of-order policy;
- follow-up state;
- inspection policy/result;
- freshness/operational window;
- manager correction.

It returns readiness plus structured reasons. It never infers readiness from a green color alone.

### 17.4 Resolution rules

- Scan receipt/start: never resolves.
- In progress: may suppress redundant employee reminder presentation but does not mark ready.
- Accepted completion: transitions episode according to issue/inspection policy.
- Manager correction: named, reasoned and audited.
- Dismiss/open notification: presentation evidence only.

---

## 18. Issues, supplies, tickets and work orders

### 18.1 Separate entities

- observation: what employee/guest/manager saw;
- issue: normalized operational problem and severity;
- supply need: stock/service shortage;
- out-of-order fixture state;
- ticket: manager/maintenance follow-up record;
- work request: one-time requested action;
- work order submitted: operational terminal handoff state;
- closure/correction;
- recurring pattern/hotspot.

### 18.2 Source preservation

Every issue/ticket retains source completion, guest report, feedback or manager observation. Closing a ticket does not erase source evidence.

### 18.3 Readiness effects

Versioned policy defines which severity/out-of-order states:

- permit ready;
- permit ready with follow-up;
- block readiness;
- require immediate manager escalation.

### 18.4 Duplicate/pattern logic

Recurring analysis uses normalized location, fixture, category and time windows while preserving separate real incidents. Similar text alone is not sufficient duplicate identity.

---

## 19. Full Access Manager product

### 19.1 Home/Hub

Provides current conditions and direct access to:

- Dashboard;
- Messenger/Memphis;
- Schedule;
- Events;
- Insights & Inspections;
- approved guest issues;
- feedback triage;
- phone/employee administration;
- notifications;
- access/security;
- approved Moxie/diagnostics tools.

Administrative/diagnostic controls remain separated from the ordinary daily workflow.

### 19.2 Dashboard

Required fields are explicit:

- location;
- requirement/current status;
- current responsible owner and reason;
- active cleaner;
- last accepted cleaner/time;
- services performed;
- open issue/ticket/follow-up;
- readiness and reasons;
- latest inspection;
- data freshness/confidence;
- manager actions allowed by role.

### 19.3 Schedule workflow

Static publication:

```text
import source
→ resolve names/positions/locations
→ preview all seven days
→ validate conflicts/orphans
→ approve effective dates
→ publish immutable version
```

Exception publication:

```text
record fact/command
→ compile candidate
→ show exact affected-location/time diff
→ show unchanged ownership guarantee
→ show OPEN/conflict/notification consequences
→ named-manager confirm
→ atomic publish
```

The UI never exposes a broad “reassign day and hope” action.

### 19.4 Inspections and analytics

Manager inspection is tied to the exact session, actual cleaner, location, duration, services, issues and ownership context.

Analytics require:

- minimum samples;
- inspection coverage/context;
- workload and route revision;
- owner/cleaner/transfer distinction;
- offline/GPS confidence;
- exclusion/warning rules;
- anti-disciplinary misuse presentation.

---

## 20. Read Only product

Only two modules:

### Dashboard projection

May include approved aggregate/current location status. Excludes:

- device identity;
- raw GPS;
- employee route/current-area detail beyond approved display;
- private notes/contact data;
- Messenger;
- feedback;
- schedule admin;
- manager actions;
- diagnostics.

### Events projection

Includes approved published event fields only.

Read Only has no writes, no hidden writable APIs and a dedicated route/asset/API allowlist.

---

## 21. Messenger architecture

### 21.1 Identity and authorization

Server derives employee identity from protected device credential/epoch and manager identity from named session. Clients cannot supply an arbitrary sender/viewer.

### 21.2 Thread state

Selecting a thread immediately clears prior message presentation, binds loading to the new thread ID and rejects stale responses. Zero frames may display prior-recipient content under a new header.

### 21.3 Employee mode

- conversation list;
- New opens direct-recipient list;
- tap person opens direct conversation;
- Memphis thread if approved;
- no group builder, checkboxes or role jargon.

### 21.4 Manager mode

Supports direct, group and broadcast with explicit recipient review.

### 21.5 Outbox

Stable client message ID, immediate local representation, protected durable queue, exactly-once server effect, terminal/transient classification and poison isolation.

### 21.6 Hide/delete and retention

Employee hide/delete removes the conversation from that employee immediately and does not delete another participant's history. Failure restores/reconciles predictably. Presentation retention and required archive/history are separate policy classes.

---

## 22. Notification architecture

### 22.1 Separate state machines

1. operational episode;
2. recipient intent;
3. transport job/provider attempt;
4. device receipt/presentation;
5. acknowledgement;
6. manager escalation.

They share IDs but not meanings.

### 22.2 Intent generation

Intents arise from:

- direct/group/broadcast message;
- schedule/ownership change;
- lunch start/end;
- inherited/removed areas;
- due-soon/overdue episode;
- event notice;
- approved guest issue;
- device/security action where appropriate.

### 22.3 Final send validation

Immediately before provider send:

- event/episode still active;
- location still due/overdue when applicable;
- intended employee remains effective owner under current revision;
- device assignment epoch and credential remain current;
- role/product authorization remains valid;
- intent not superseded/cancelled/acknowledged as defined.

### 22.4 Native presentation

One orchestrator handles foreground/background-open/local fallback and produces exactly:

```text
chime
→ complete personalized speech
→ chime
→ identical complete speech
→ silence
```

One overlay persists until Open/Dismiss. Later alerts queue FIFO. OS/browser duplicate audio is prohibited.

### 22.5 Acknowledgement and escalation

- displayed/opened/dismissed are durable presentation facts;
- local acknowledgement retries until server acknowledgement or reconciliation;
- dismissal never resolves work;
- escalation cancels on authoritative resolution, reroutes on owner change and remains independent from dismissal.

---

## 23. Events architecture

### 23.1 Event lifecycle

```text
source/import
→ parsed candidate
→ manager-reviewed event revision
→ published notice
→ updated/superseded/cancelled revision
```

Parser/import output cannot publish by itself.

### 23.2 Separate operational layers

```text
published event notice
→ optional custodial impact proposal
→ named-manager approval/rejection
→ approved operational requirement input
→ optional separate ownership compilation/publication
```

Event save/import/edit/cancel never directly writes schedule/ownership tables.

### 23.3 Projections

- manager: full event source, venue, attendance, notes, service proposals and state;
- employee: relevant event, place, time and instruction;
- Read Only: approved published fields;
- notification planner: approved reminder instance only.

---

## 24. Guest reporting architecture

Dormant by default.

Activation requires:

- explicit approval and policy version;
- Marketing role and workflow;
- location-specific QR/tag signage approval;
- rate limit/abuse protection;
- data-minimization and contact/photo policy;
- secure storage and redaction;
- current-owner routing through canonical resolver;
- closure and recurring-pattern rules;
- physical/public acceptance.

Flow:

```text
public location-bound report
→ Marketing pending review
→ reject or approve
→ operations issue/dispatch
→ reroute if ownership changes
→ resolve/close
→ redact contact by policy
```

Guest reporting has no relationship to employee NFC/QR workflow.

---

## 25. Feedback and help architecture

### 25.1 Product feedback

Employee or manager reports app/program confusion or failure. The system captures context and optional attachment without exposing technical classifications to the employee.

### 25.2 Operational reports

Maintenance, supply, guest follow-up, one-time request and emergency assistance are separate domain actions with their own fields and routing.

### 25.3 Manager triage

Feedback inbox is manager-only. Attachments are validated, private, access-audited and retained by policy. Employee APK does not package manager triage code or routes.

---

## 26. Contractor architecture

### 26.1 Engagement and assignment

Separate:

- vendor/engagement;
- capacity slot;
- named worker when known;
- assignment revision;
- secure-link delivery;
- acknowledgement/acceptance;
- actual work evidence.

### 26.2 Ownership

A contractor becomes canonical owner only under approved policy and published assignment. Assignment creation alone does not necessarily prove receipt or acceptance.

If coverage cannot be confirmed under policy, affected intervals remain `OPEN` or are explicitly reassigned.

### 26.3 Secure view

- exact current revision only;
- shift and exact locations/times;
- English/Spanish as approved;
- read-only;
- no-store/no-cache;
- expiring and revocable;
- no employee or manager controls;
- old link cannot display superseded assignment.

---

## 27. AI, MCP, Moxie and diagnostics architecture

### 27.1 Tool registry

Each tool declares:

- name/version/domain;
- allowed actor roles/products;
- data sources and freshness;
- read/propose/write class;
- parameters/output schema;
- confirmation/second approval;
- idempotency;
- audit/correlation;
- privacy/redaction;
- failure/rollback;
- physical or production limitations.

### 27.2 Default authority

AI defaults to read and propose. It may not:

- generate schedules on read;
- publish ownership;
- close work/tickets;
- modify employees/devices;
- enable guest reporting;
- change security/retention;
- trigger builds/deployments

unless the exact tool/action is separately authorized and confirmed.

### 27.3 Memphis AI

Answers from approved canonical APIs and returns source/freshness context. It never treats a projection or stale legacy schedule as canonical.

### 27.4 Moxie

Moxie's final role remains a policy gate. If retained in production, it is a separate private manager workspace with explicit tool authority and no hidden schedule writes.

### 27.5 Diagnostics and repair

Controlled diagnostics is an isolated privileged product. Repair actions require exact diff, backup/recovery evidence, named actor, confirmation, idempotency and rollback. Ordinary managers do not receive unrestricted service-role power.

---

## 28. Analytics architecture

### 28.1 Canonical fact model

Analytics joins:

- actual cleaner/session/completion;
- effective owner over valid time;
- workload and route revision;
- service taxonomy and requirement;
- issue/ticket/inspection result;
- offline/GPS evidence confidence;
- event/closure/exception context.

### 28.2 Required thresholds

Every comparison defines:

- minimum cleaning count;
- minimum inspection count/coverage;
- comparable location/purpose/window;
- excluded abnormal/incident/offline cases;
- ownership/transfer context;
- confidence and date range.

### 28.3 Anti-misuse

No personnel conclusion is based solely on:

- planned static ownership;
- one duration;
- one inspection;
- one GPS point;
- work done by a helper;
- ownership the employee never held;
- incomplete/offline timing;
- location difficulty not represented.

The product displays limitations and blocks comparisons when evidence is insufficient.

---

## 29. Security architecture

### 29.1 Trust boundaries

- public guest;
- Marketing reviewer;
- contractor link;
- employee managed phone;
- Read Only;
- Full Access Manager;
- device/security administrator;
- diagnostics/repair actor;
- AI/MCP tool;
- backend worker;
- service role/database owner.

### 29.2 Requirements

- forced RLS on protected canonical tables;
- no direct public/employee schedule writes;
- least-privilege grants;
- locked `search_path` on privileged functions;
- backend-derived actor and device identity;
- native credential never exposed to JavaScript;
- assignment epoch validation;
- scoped expiring public/contractor/manager codes/tokens;
- CSRF/origin/rate-limit protections as appropriate;
- structured audit for every privileged action;
- field-level redaction per product;
- secrets absent from artifacts/logs/client storage.

### 29.3 Threat modeling

Before schema GO, independently attack:

- spoofed device/employee;
- stale epoch/offline replay;
- unauthorized schedule/ownership write;
- public/contractor enumeration;
- guest attachment abuse;
- manager-session theft;
- AI confused-deputy action;
- diagnostic privilege escalation;
- notification recipient leakage;
- backup/restore exposure;
- build/signing provenance.

---

## 30. Retention and privacy architecture

Every data class receives:

- operational purpose;
- sensitivity;
- default retention;
- archive requirement;
- purge/redaction behavior;
- legal/incident hold;
- authorized roles;
- export/backup behavior;
- FK/cascade strategy;
- purge audit evidence.

Minimum classes:

- identity and employment history;
- schedule source/policy/baseline/ownership;
- sessions/completions;
- inspections;
- issues/tickets/work orders;
- Messenger content and presentation;
- event source/revisions/notices;
- notification intents/attempts/acks;
- guest reports/contact/photos;
- feedback/attachments;
- raw GPS and durable GPS summary;
- device credentials/tokens/security history;
- diagnostics and AI tool calls;
- build/release/migration evidence;
- backups.

Fourteen-day communication presentation retention never deletes responsibility, session, inspection or ticket history.

Raw GPS is not retained indefinitely by default. Incident holds are explicit.

---

## 31. Backup, restore and disaster recovery

Architecture defines:

- encrypted backup scope and key custody;
- backup frequency/retention;
- RPO/RTO;
- clean empty-database rebuild;
- schema fingerprint verification;
- object/storage restoration;
- restore drill frequency;
- worker pause/drain and consistency point;
- production restore authorization;
- audit evidence.

A release cannot pass without current backup/restore evidence for the exact schema/release tuple.

---

## 32. Migration and cutover

### 32.1 Inventory and export

- freeze source commits and production-schema identity;
- export static templates, assignments, identities, memberships, operating settings and relevant history read-only;
- hash source evidence;
- map every current writer, reader, worker, queue and consumer.

### 32.2 Isolated build and reconciliation

- create canonical schema in an isolated project/database;
- migrate normalized identities/positions/static versions/history without changing production;
- compile deterministic fixtures;
- classify every old/new difference;
- assign confidence to historical reconstruction;
- independently audit schema/security/migration.

### 32.3 Shadow phase

Canonical compiler and projections run in shadow. Legacy remains production authority. No shadow data reaches employees/managers as truth.

Compare:

- employee and manager ownership;
- Dashboard status/readiness;
- due/overdue recipients;
- guest routing if enabled;
- Memphis AI answers;
- analytics attribution;
- notification consequences.

Every unexplained difference blocks cutover.

### 32.4 Atomic cutover

- freeze accepted source/schema/policy/release;
- confirm backup/rollback;
- switch one protected authority pointer for an indivisible truth domain;
- all consumers use canonical APIs;
- disable legacy writers;
- verify canaries and monitoring.

No independent endpoint flags and no permanent dual writes.

### 32.5 Rollback

Rollback restores the complete prior authority set and disables new publication while preserving canonical post-cutover events for reconciliation. It does not delete evidence or selectively mix legacy/canonical consumers.

---

## 33. Build, APK and release architecture

### 33.1 Frozen source

Builds use one immutable protected-main commit. CI never patches and commits runtime source during the build.

### 33.2 Product-specific artifact graph

Each edition has a fail-closed asset/module/API allowlist. Employee APK contains no manager pages, QR scanner, enrollment removal, manager triage or diagnostics.

### 33.3 Release tuple

Binds:

- source commit;
- dependency lock/toolchains;
- frontend/runtime asset hashes;
- backend minimum/exact contract versions;
- schema fingerprint and migration set;
- APK package/versionCode/hash;
- signer fingerprints;
- native plugin/DEX/manifest identity;
- configuration and policy versions;
- admission result.

### 33.4 Producer and consumer admission

Producer proves source→artifact. Independent consumer verifies artifact without trusting the producer's narrative.

### 33.5 Rollback

Build 22 remains available and documented until a new release passes one-phone canary and controlled fleet acceptance.

---

## 34. Physical acceptance architecture

The architecture defines test equipment, instrumentation, fixtures, evidence and exit criteria before implementation.

### 34.1 Employee matrix

- install/upgrade/rollback;
- enrollment/vault preservation;
- Fully Kiosk lock and containment;
- cold launch/reboot/wake/process recreation;
- Home and four modules;
- NFC from all required states;
- restroom and exhibit start/finish/completion;
- active timer and draft preservation;
- offline/reconnect exactly once;
- schedule transitions at boundaries;
- exact alert cadence/overlay/queue/no duplicate sound;
- Messenger recipient isolation/outbox/delete;
- Events and Feedback;
- GPS calibration/permission/exit/return/battery;
- large text, long names, keyboard, gloves and performance;
- Karen task script.

### 34.2 Manager/Read Only/contractor matrix

- role and field boundaries;
- schedule exact diff/publish/rollback;
- Dashboard/readiness/inspection;
- device and access recovery;
- event impact separation;
- contractor link issue/revoke/ack;
- Read Only redaction/no writes;
- AI/diagnostic confirmation and audit.

### 34.3 Evidence

Preserve:

- exact source/release tuple;
- APK hash/versionCode/signer;
- device/OS/Fully Kiosk versions;
- test fixtures and operator;
- timestamps/logs/screenshots/recordings;
- pass/fail and defect IDs;
- rollback result.

---

## 35. Test and evidence architecture

Every invariant maps to one or more:

- unit test;
- schema constraint test;
- property/determinism test;
- concurrency/race test;
- fault-injection test;
- migration/replay test;
- security test;
- browser/component integration test;
- Android instrumentation test;
- built-distribution/APK inspection;
- physical Moto G test;
- observed operational/Karen acceptance.

A source-string assertion is not behavioral proof. A mock cannot prove NFC, sound, Fully Kiosk, Android lifecycle or physical GPS.

False-confidence tests are retired or relabeled rather than preserved to keep a green dashboard.

---

## 36. Observability and error architecture

### 36.1 Structured errors

Backend returns stable domain codes and diagnostic metadata. Product projections map them to role-appropriate language.

### 36.2 Correlation

Every client operation, server transaction, compiler revision, notification intent, worker attempt and correction shares traceable correlation/causation IDs without exposing sensitive internals to employees.

### 36.3 Health

Health is dependency-aware and release-identity-aware. It distinguishes:

- service process alive;
- database/auth/provider dependencies;
- queue backlog/terminal items;
- schema/release compatibility;
- canonical authority pointer;
- device fleet security/push readiness;
- backup/restore freshness.

### 36.4 Employee presentation

Employees receive action, not diagnostics. Manager views receive bounded operational explanation. Privileged diagnostics retains technical detail and audit.

---

## 37. Open foundational gates

Architecture v4 cannot be promoted to design authorization until the gate registry closes or explicitly bounds:

- all-week static schedule source and Sunday truth;
- position/person-bound policy;
- workload/service-frequency/route research;
- operating windows and September 14;
- cross-midnight semantics;
- inspection-readiness and severity policy;
- `OPEN` escalation;
- contractor identity/acceptance;
- employee runtime graph and NFC payloads;
- GPS policy/calibration/retention;
- Messenger archive and notification acknowledgement;
- guest data policy;
- manager authority and AI action policy;
- retention/holds/RPO/RTO;
- complete migration consumer graph;
- physical and Karen thresholds.

---

## 38. Required internal audit questions

The internal audit must attempt to falsify:

1. Whether every capability has an architectural home.
2. Whether any fact still has duplicate authority.
3. Whether read-side mutation can survive through AI, events, previews or compatibility paths.
4. Whether employee/runtime ownership is truly singular.
5. Whether readiness can be derived without policy guessing.
6. Whether events can accidentally change ownership.
7. Whether contractor assignment can fabricate coverage.
8. Whether notification dismissal or scan can still resolve work.
9. Whether historical truth survives retention, correction and rollback.
10. Whether migration can cut one consumer while leaving another on legacy authority.
11. Whether security roles and AI tools can become confused deputies.
12. Whether physical requirements are testable and release-blocking.
13. Whether any proposed component is a bandage around a legacy assumption rather than a foundational replacement.

---

## 39. Implementation sequence after future architecture GO

Only after independent architecture GO and closed gates:

1. isolated canonical identity/workforce design;
2. isolated static schedule/operating/workload schema design;
3. ownership compiler/resolver design;
4. operational status/readiness design;
5. session/completion/offline/GPS design;
6. notification/ack/escalation design;
7. Messenger design;
8. events/issues/guest/feedback/contractor design;
9. role/security/retention design;
10. migration/release/physical test design;
11. independent design audits;
12. isolated implementation in dependency order;
13. build audits and rebuilds;
14. adversarial tests;
15. shadow migration;
16. canary and physical acceptance;
17. final release audit.

No isolated implementation task may make up a missing policy or authority contract.

---

## 40. Draft verdict

Unified Whole-System Architecture v4 draft provides a coherent top-level home for the valid program domains and imports the strongest ownership work from v3.1.

It is not yet approved. It contains explicit research and policy gates and must undergo adversarial internal audit and replan before independent audit.

Current authorization remains:

- architecture drafting/audit: allowed;
- schema/component design: NO-GO;
- implementation/migration/APK/phone/release: NO-GO.