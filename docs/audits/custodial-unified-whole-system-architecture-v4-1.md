# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.1

**Status:** Complete whole-system replan for independent architecture audit; implementation is not authorized  
**Revision:** 4.1  
**Prepared:** 2026-08-04  
**Research branch:** `agent/custodial-unified-whole-system-v4-20260803`  
**Supersedes as top-level architecture:** `custodial-unified-whole-system-architecture-v4-draft.md`  
**Imports as subsystem specification:** Canonical Ownership Foundation Architecture v3.1  
**Rollback baseline:** Custodial Build 22

---

## 1. Purpose

The Memphis Zoo Custodial Program is one connected operational system for assigning responsibility, performing and proving work, reporting exceptions, preserving coverage, inspecting with context, communicating, learning from history and recovering safely from failure.

The system must provide one defensible answer to each of these questions:

- What service is required at this location and time?
- Who is responsible, under which published revision, and why?
- Who is actively cleaning and who actually completed the work?
- What physical tag/location evidence was received?
- What services, supplies, fixtures, issues and notes were recorded?
- Which service occurrence is due, overdue, in progress, completed or not required?
- Is the location inspection-ready, ready with follow-up, blocked or awaiting inspection?
- What schedule, event, operating-policy, contractor or manager action changed the day?
- Who was notified, what reached the device, what was presented and what was acknowledged?
- What is visible to Employee, Full Access Manager, Read Only, Marketing, contractor, AI and diagnostics actors?
- Can every authoritative fact be rebuilt, audited, migrated, rolled back and proven on the actual phones?

Ownership v3.1 remains the canonical responsibility subsystem. Architecture v4.1 makes it one compatible domain inside a complete operating system rather than the foundation of an unfinished collection of applications.

---

## 2. Authorization

This document authorizes only:

- continued source, production, field and physical research;
- fixture and non-mutating test-plan design;
- internal and independent architecture audit;
- architecture replan.

It does not authorize:

- schema DDL;
- backend/frontend/native implementation;
- production-data writes;
- migration or cutover;
- workflow/build execution;
- APK generation or installation;
- phone or Fully Kiosk changes;
- fleet rollout or release.

A future architecture GO authorizes isolated design only. It does not authorize implementation.

---

## 3. Governing principles

1. One canonical authority for every fact.
2. Static normal policy before exceptions.
3. Minimal changes to affected locations/intervals only.
4. Individual location is the final assignment and service unit.
5. Source facts, commands, compiler outputs, operational evidence, projections and presentation evidence are different classes.
6. Read paths never generate or mutate operational authority.
7. Published facts and accepted evidence are immutable; corrections append history.
8. Valid time and recorded time are both preserved.
9. Missing data is not a hidden state.
10. `OPEN` and `not_required` are explicit and different.
11. Responsible owner, active cleaner and actual cleaner are separate.
12. Work requests do not transfer ownership.
13. Determinism and idempotency are required at every mutable boundary.
14. Publication and downstream outbox creation are atomic.
15. Every client product has one lifecycle/navigation/security owner.
16. Employee presentation uses plain action language; diagnostics are separate.
17. Physical behavior is a release-blocking architectural contract.
18. Shadow/compatibility mechanisms are temporary, bounded and retired.
19. Whole authority sets roll back together.
20. Tests and artifacts, not claims, control gates.

---

## 4. Evidence and capability authority

Controlling evidence:

- Final Report v17, all 26 pages and images;
- current explicit decisions and field-workflow invariants;
- actual Engine and backend frozen commits;
- SELECT-only production truth;
- capability canon v1;
- authority register v1;
- research/decision gate registry v1;
- independent audits.

The capability canon is mandatory traceability input. Every retained/rebuilt capability maps to:

- actor/product;
- canonical fact/command;
- writer/resolver;
- projection/UI;
- security boundary;
- retention class;
- migration/rollback;
- automated and physical proof.

Obsolete behavior is prohibited from remaining reachable, packaged, executable or treated as a test requirement.

---

## 5. Operational authority set

### 5.1 Purpose

The program has interdependent truth domains that must be compatible. A protected **operational authority set** binds those domain versions so ownership cannot cut over while status, notifications, clients or AI still interpret incompatible models.

### 5.2 Required references

An authority set references:

- identity/workforce model version;
- location registry/classification version;
- static schedule and operating-policy contract version;
- ownership compiler/resolver version;
- workload/route model version;
- service taxonomy and frequency policy version;
- operational occurrence/status/readiness model version;
- issue/ticket/inspection rubric versions;
- event and notification contract versions;
- API/schema fingerprint;
- minimum compatible employee/manager/Read Only/backend release tuple;
- retention/security policy versions;
- migration/rollback target.

### 5.3 Lifecycle

```text
draft
→ validated
→ independently_audited
→ published
→ retired

published → rolled_back
```

The set stores canonical compatibility hashes and validation evidence. Equal inputs use a versioned canonical serialization contract.

### 5.4 Activation

One protected pointer activates the current operational authority set after:

- schema and API health checks;
- consumer compatibility proof;
- backup/rollback proof;
- shadow difference acceptance;
- independent approval.

Daily ownership/status/event data revisions remain dynamic inside the active compatible set. Domain-model cutover is atomic at the authority-set boundary.

No consumer has an independent model-version flag.

---

## 6. Canonical serialization and integrity

### 6.1 `canonical-json.v1`

All hashes and deterministic input snapshots use a versioned canonical representation:

- UTF-8;
- Unicode normalized to NFC;
- object keys lexicographically ordered;
- arrays retain defined semantic order or are explicitly sorted by stable key before serialization;
- timestamps use UTC RFC 3339 with fixed precision;
- local schedule rules retain America/Chicago date/time/day-offset fields and are converted through one time authority;
- dates use `YYYY-MM-DD`;
- decimals use a canonical non-exponent string representation;
- null, missing and empty values remain distinct according to schema;
- source bytes are hashed directly in addition to normalized content;
- SHA-256 with algorithm/version stored beside the digest.

Any future serialization/hash change creates a new contract version and cannot silently alter historical fingerprints.

### 6.2 Correlation and causation

Every command, compilation, operational event, outbox intent, worker attempt, correction and migration record uses stable IDs and correlation/causation links.

---

## 7. Actors and products

### 7.1 Custodial Employee

Private Android-only product. May see current areas, scan/complete work, use Messages, read relevant Events, use app/phone Feedback and respond to authorized work/issue context. No manager, device-admin, QR, diagnostics or schedule-write authority.

### 7.2 Full Access Manager

Private named-manager product for Dashboard, Schedule, Messenger, Events, inspections, issues/tickets, analytics, employee/phone administration, security, approved guest workflow, feedback triage and explicitly authorized AI/diagnostic tools.

### 7.3 Read Only

Private Dashboard and Events only. Default projection is fail-closed:

- no employee names unless separately approved;
- no device identity;
- no raw GPS;
- no private notes/contact data;
- no detailed route/current-area history;
- no Messenger, Feedback, schedule administration, phone controls, AI or diagnostics;
- no writes.

Any additional field requires explicit policy revision and security audit.

### 7.4 Marketing

Exists only for approved guest-report review. Cannot assign ownership.

### 7.5 Contractor

Receives one limited assignment revision through an expiring secure channel. No employee/manager authority.

### 7.6 AI/MCP/Moxie/diagnostics

Separate registered tools with explicit read/propose/write authority, confirmation, audit and rollback. No inherited implicit authority.

### 7.7 System workers

Registered system actor and capability version required for every automated write.

---

## 8. Canonical location registry and lifecycle

### 8.1 Stable location identity

A location has a permanent ID independent of display name, group membership, tag, route coordinates or form type.

Versioned/effective-dated attributes include:

- code and aliases;
- display name and pronunciation/localization;
- operational type and form type;
- public/staff-only/Read Only eligibility;
- schedule/status/guest/event eligibility;
- parent/related location where applicable;
- active, temporarily closed or retired state;
- operating-policy assignment;
- workload/route classification.

### 8.2 Rename

Rename changes display metadata only. Historical sessions, ownership, tickets and inspections retain the stable location and the display snapshot/revision used at the time.

### 8.3 Split/merge

A physical/operational split or merge creates new location identities and explicit lineage:

- predecessor/successor relation;
- effective timestamp;
- migration reason;
- tag and policy reassignment;
- historical analytics boundary.

History is not rewritten into the new identity.

### 8.4 Temporary closure versus retirement

Temporary closure is an operating-policy override and may yield `not_required`. Retirement ends future eligibility while preserving history.

### 8.5 Tags

One location may have multiple active tags. A tag belongs to one location at a time through an effective-dated registry. Moving a tag requires revocation/reissue evidence.

### 8.6 Signage removal

Decommission/replace workflows include physical NFC/QR signage removal confirmation where applicable.

---

## 9. Identity, workforce and device lifecycle

### 9.1 Permanent identity

Employee identity is never renamed into a replacement. Michael McWright and Daniel Morgan remain attached to their original history.

### 9.2 Separate states

Effective-dated records separately represent:

- employment;
- schedule eligibility;
- Messenger eligibility;
- phone eligibility;
- training/restriction capability;
- position occupancy;
- absence/PTO;
- historical/test-fixture-only state.

### 9.3 Positions and person-bound rules

Normal policy references a stable position. A named employee may be referenced only by an explicitly approved person-bound rule with reason and effective dates.

Position assignments are non-overlapping. Vacancy is explicit and becomes a compiler input.

### 9.4 Contractor identity

Contractor engagement, capacity slot, named worker and accountable vendor slot are different facts. Production `COVERALL_*` employee identities are migration evidence, not target identities.

### 9.5 Device and epoch

Device registry maintains canonical KIOSK identity, aliases, credential, assignment epoch, employee assignment, security state, push registration, last accepted use and history.

Every employee request and notification is revalidated against current credential and epoch.

### 9.6 Reassignment blockers

Ordinary device reassignment is blocked by active session, completion draft, offline queue, unresolved conflict or enrollment/removal operation. Emergency recovery quarantines and creates a reconciliation case.

---

## 10. Static schedule and canonical ownership

This chapter incorporates Ownership Architecture v3.1.

### 10.1 Source publication

```text
approved source artifact
→ normalized candidate
→ unresolved mapping review
→ position/person/location validation
→ seven-day preview
→ effective-date and conflict approval
→ immutable static version
→ membership/policy snapshot
→ immutable location-level daily baseline
```

Importer, validator and publisher identities are recorded. A second approval is required for retroactive publication or high-risk/wide policy change according to an approved threshold. Unresolved mappings cannot self-approve.

### 10.2 Final unit and states

Individual location and half-open interval `[start,end)` resolve to:

- employee;
- contractor;
- `OPEN`;
- `not_required`.

Groups are authoring/display/workload aids only.

### 10.3 Inputs

Append-only date-specific inputs:

- position occupancy/eligibility;
- absence/PTO/callout;
- contractor engagement/capacity/acceptance state as policy requires;
- approved event/after-hours requirement;
- operating/location override;
- transfer;
- emergency override;
- correction/cancellation.

### 10.4 Compiler order

1. Requirement occurrences/windows.
2. Static location phases.
3. Position occupant and hard eligibility.
4. Absence and approved contractor capacity with minimal movement.
5. Exclusive lunch transfer/restoration.
6. departure/shift-end inheritance.
7. ordinary manager transfer.
8. emergency override.
9. validation, exact diff, notification consequences.
10. atomic publication.

### 10.5 Objective order

1. hard requirement/eligibility;
2. preserve unaffected static ownership;
3. minimize moved locations/time boundaries;
4. preserve required related-location constraints;
5. geography/route coherence;
6. workload fairness;
7. stable reviewed tie-breaker.

### 10.6 Resolver

Every consumer gets location, interval, owner/state, purpose, reason, controlling source/transition, ownership revision, authority-set ID and freshness. No fallback resolver remains after cutover.

### 10.7 Publication and rollback

Candidate intervals, validation, transition evidence, grouped notification intents, prior/new pointer and audit publish in one transaction. Rollback restores a complete prior publication inside the compatible authority set.

### 10.8 Bitemporal correction

Valid-time and recorded-time assertions are preserved. A correction appends and closes prior recorded range. Second approval is required when retroactive responsibility changes feed disciplinary analytics.

---

## 11. Workload, route, frequency and restrictions

### 11.1 Versioned location/purpose profile

Contains:

- expected minutes/load points;
- service frequency/occurrence rules;
- difficulty/priority;
- season/window applicability;
- restrictions/capabilities;
- source and confidence;
- effective revision.

Unknown remains unknown and blocks unsupported optimization.

### 11.2 Versioned route model

Contains location-level zones, anchors, adjacency, walking time, access constraints, source/confidence and effective revision.

### 11.3 Research and approval

Field timing, walking-path observation and manager review are required. Group values are not mechanically divided or copied.

### 11.4 Historical determinism

Every compiler run fingerprints exact workload/route/restriction revisions.

### 11.5 Employee behavior

These facts improve schedule ownership. They never create a phone-directed route.

---

## 12. Operating policy and service occurrences

### 12.1 Policy precedence

1. emergency shutdown;
2. dated location override;
3. approved event/after-hours window;
4. seasonal location policy;
5. normal location policy;
6. general zoo policy.

Equal-authority conflicts block publication.

### 12.2 Time model

America/Chicago valid-time rules use explicit service date and day offset/timestamp range, supporting cross-midnight intervals and DST through one time authority.

### 12.3 Service occurrence identity

A **service occurrence** is one required instance of a location/purpose service under a policy revision.

Required fields:

- occurrence ID;
- location and purpose;
- requirement/policy revision;
- requirement interval;
- activation/due/overdue timestamps;
- prior completion basis if recurring;
- satisfying completion ID when accepted;
- cancellation/not-required/reopen/correction state;
- next occurrence relation.

### 12.4 Creation rules

Occurrences are generated deterministically from:

- requirement intervals;
- service frequency rule;
- accepted prior completion;
- event/after-hours approved requirement;
- manager-approved urgent requirement.

A recurring occurrence retains one ID through due-soon→overdue→in-progress→resolved. Accepted completion satisfies the current occurrence and deterministically creates/schedules the next one according to the same policy. Split windows create separate occurrences when policy says they are independently required.

### 12.5 Close/cancel/reopen

- Outside required window: occurrence becomes `not_required`/cancelled according to reason.
- Policy correction appends new occurrence assertion.
- Reopen creates a state event against the same occurrence or a linked corrective occurrence according to policy; it never deletes the accepted completion.

### 12.6 Urgent guest/manager issue

A guest report or work request does not automatically become the normal recurring occurrence. After approval, it creates an issue/request and may create a separately identified urgent service occurrence only through an authorized rule or manager command.

### 12.7 Required fixtures

September 14, Splash Pad split windows, after-hours events and cross-midnight cases must be approved before schema design.

---

## 13. Employee application contract

### 13.1 Normal Home

Only:

- Memphis Zoo Custodial;
- employee name;
- Schedule;
- Messages;
- Events;
- Feedback.

No weather, attendance, device ID, QR, Scanner, enrollment, diagnostics, permanent Refresh or bottom navigation.

### 13.2 Recovery state

When protected identity/security cannot support work, a separate full-screen state says `This phone needs a manager.` It does not expose credentials or diagnostics.

### 13.3 Schedule

Answers `What areas are mine right now?`

Allowed sections:

- Your areas now;
- Temporary lunch coverage until [time];
- Added to you;
- brief removed/changed notice.

Restrooms first. Exact locations only. No route, Current/Next, full-day itinerary or `All Locations`.

### 13.4 Messages

Employee mode is direct-recipient only: New → tap person → conversation. Manager group/broadcast controls do not ship in employee UI.

### 13.5 Events

Shows relevant published event, where, when and plain work impact/instruction. Attendance is included only if employee policy approves it.

### 13.6 Feedback and operational reporting access

No additional Home destinations are added.

- App/phone/NFC problem: Feedback.
- Maintenance, supply and out-of-order condition: location completion workflow; a standalone follow-up may open only from the relevant active location/message.
- Emergency/immediate manager assistance: Messages and existing radio policy.
- Guest cleanliness follow-up: approved notification/message-linked action if guest feature is enabled.
- One-time work request: created by manager and received through current-work/message/notification context.

Feedback is not a generic maintenance/supply/work-request bucket.

### 13.7 Copy and accessibility

Employee errors map to a small approved vocabulary. Technical metadata remains in diagnostics. All actions meet touch, text scaling, contrast, non-drag and non-audio alternatives. Name/location pronunciation overrides support spoken alerts.

---

## 14. Single native employee runtime

### 14.1 Ownership

Android native shell owns:

- lifecycle;
- vault/security;
- NFC acquisition;
- notification intake/presentation;
- protected local store;
- active-session GPS;
- wake/reboot/process restore;
- Fully Kiosk containment;
- handoff to one employee UI application/router.

Historical pages are extracted audited components only; none remains an independent lifecycle owner.

### 14.2 Protected local store

Versioned store contains security/epoch, active session, draft, operation queue, ownership snapshots, notification presentation/ack state and migration metadata.

### 14.3 Local-state schema upgrades

Every app release defines:

- forward migration;
- backup/checkpoint before migration;
- idempotent resume after interruption;
- validation/quarantine on corruption;
- downgrade/rollback compatibility or an explicit reconciliation/export process before downgrade.

Build 22 rollback cannot silently discard pending work created by a newer schema. Pending work is reconciled or exported into a controlled manager recovery record before downgrade.

### 14.4 Recovery order

1. complete/reconcile enrollment/removal/local-store migration;
2. restore active session/draft;
3. restore active alert overlay;
4. process pending transient/terminal reconciliation;
5. otherwise Home.

---

## 15. NFC and tag contract

Versioned tag registry stores tag identity/hash, payload format, location, issue/install/revoke/replace state and lineage.

Native intake supports cold/warm, lock, wake, reboot, offline and duplicate delivery. It accepts only approved formats and resolves the registry before UI.

Outcomes:

- valid: location confirmation and Start/Continue/Finish action;
- unknown/revoked: `Tag not recognized. Tell a manager.`;
- duplicate: idempotent continuation;
- different location during active work: preserve work and instruct return/manager action;
- hardware/permission failure: manager-supported logged fallback only.

Scan receipt is physical-context evidence, not completion/readiness/ownership.

---

## 16. Cleaning session, offline and outage behavior

### 16.1 Binding

Session binds protected device credential, device, epoch, employee, location/tag evidence, start time, ownership revision/owner, owner-cleaner relation, work-request/help reason, authority set and release.

### 16.2 State machine

```text
proposed → active → finish_requested → completion_draft
→ submitted_pending_acceptance → accepted_closed
```

Branches: cancelled, duplicate, conflict review, rejected identity, terminal cancelled.

### 16.3 Active ownership transition

Relations: owner cleaning, cross-ownership active, manager-directed help, conflict review. Ownership may change while valid work continues; work never extends ownership.

### 16.4 Offline snapshot

Protected signed snapshot includes device/epoch/employee/location, ownership revision/interval, operating/schedule/authority-set versions, issued/expiry and server time reference.

### 16.5 Trusted time and clock skew

Offline eligibility uses server-issued time reference plus monotonic device elapsed time. Excessive wall-clock change or expired confidence blocks a new provisional start and requests manager help; existing work is preserved.

### 16.6 Allowed offline operations

Subject to valid security and snapshot:

- view last-known current areas with visible stale status where appropriate;
- start/continue/finish a covered session;
- preserve completion draft;
- queue completion and approved messages/feedback.

Schedule publication, ownership transfer, manager corrections, enrollment and high-risk administration require online authoritative service.

### 16.7 Queue behavior

- stable operation IDs;
- exactly-once server effects;
- lease/lock per logical operation;
- transient versus terminal classification;
- exponential bounded retry;
- poison isolation/dead-letter reconciliation;
- per-domain quotas and storage monitoring;
- no silent eviction of accepted/pending work.

### 16.8 Prolonged outage

The architecture defines manager-visible outage state, last-known freshness, local capacity warnings and a documented manual continuity procedure. Employee work remains locally durable. When storage/confidence limit is reached, new unsupported actions fail closed with plain guidance while existing work remains recoverable.

### 16.9 Reconnect outcomes

Accepted owner work, accepted help work, accepted with ownership change, duplicate, conflict review, rejected identity or terminal cancelled. Work acceptance does not retroactively alter ownership.

---

## 17. Completion evidence and correction

### 17.1 Versioned taxonomy

Per area/form type: full-clean services, individual services, supplies, issue/fixture categories, out-of-order fields, notes, validation, readiness consequences and taxonomy version.

### 17.2 Low-tech flow

Normal completion stays within three primary decisions where practical:

1. full cleaning completed;
2. report exceptions/add specific services if needed;
3. review/submit.

Restroom and exhibit remain distinct.

### 17.3 Atomic acceptance

Verifies identity/session/idempotency, stores immutable completion, creates structured observations/issues, transitions session/status occurrence, writes downstream intents and returns reconciliation result in one transaction.

### 17.4 Correction/void

Accepted evidence is never overwritten. A named manager may append:

- correction annotation;
- void reason;
- corrected structured value;
- resulting status/readiness event;
- evidence reference.

Second approval is required when correction materially changes disciplinary analytics according to policy. Historical queries show original and correction.

---

## 18. Active-session GPS

Active-session-only collection. Minimum observation fields, staleness/accuracy/impossible-speed rejection, calibrated distance and evidence class.

Low confidence never becomes disciplinary proof. Missing GPS does not fabricate inside/outside. Work-continuation policy and manager exception are explicit.

Raw points use short approved retention; durable summary, permission failure, excursion/return and incident hold remain.

---

## 19. Status and inspection-readiness architecture

### 19.1 Separate dimensions

- requirement: required/not_required/cancelled;
- timing: not_due/due_soon/overdue;
- work: not_started/in_progress/submitted/accepted;
- issue: severity and open/closed;
- follow-up: none/required/completed;
- inspection: not_requested/pending/passed/failed/follow_up;
- readiness: ready/ready_with_follow_up/blocked_incomplete/blocked_issue/blocked_inspection/not_required;
- freshness/confidence.

### 19.2 Resolver inputs

Service occurrence, accepted completion/taxonomy, issue/out-of-order severity policy, follow-up, inspection rubric/policy, operating window, freshness and corrections.

### 19.3 Resolution

Scan/start/presentation action never resolves. Accepted completion transitions according to policy. Named-manager correction appends. Reasons are structured and visible to manager.

### 19.4 Inspection rubric

Every inspection stores rubric version, component scores/findings, pass threshold, critical failure, follow-up, named inspector and exact session/location/cleaner/ownership context.

Reinspection, correction and void are append-only events. Original assessment remains visible. Second approval applies when changing evidence used for discipline according to policy.

---

## 20. Issues, custodial tickets and external work orders

### 20.1 Entities

- observation;
- normalized issue and severity;
- supply need;
- out-of-order fixture state;
- custodial ticket;
- one-time work request;
- optional external Facilities work-order reference;
- follow-up/readiness state;
- recurring pattern.

### 20.2 Current custodial ticket doctrine

Current custodial responsibility states are:

```text
OPEN → W.O. Submitted
```

`W.O. Submitted` is the current terminal custodial ticket state. It means the issue was handed to the work-order process; it does not assert Facilities completed the repair.

Administrative exceptional states such as duplicate, void/corrected or not-an-issue are separately named and audited.

### 20.3 External work-order integration

If a future authoritative Facilities source is integrated, its external status is stored separately. Custodial ticket truth is not rewritten to claim external completion.

### 20.4 Readiness/follow-up

Issue severity policy decides ready, ready-with-follow-up or blocked. W.O. Submitted alone does not necessarily clear readiness block; manager verification or external evidence may be required according to policy.

---

## 21. Full Access Manager product

### 21.1 Hub

Daily operations first; administrative/security/diagnostic tools separated.

### 21.2 Dashboard

Location, service occurrence/status, current owner/reason, active cleaner, last accepted cleaner/time, services, issues/ticket/W.O. Submitted, readiness reasons, inspection, freshness/confidence and allowed actions.

### 21.3 Schedule publication

Static and exception flows use preview, exact diff, unchanged guarantee, conflicts/OPEN, downstream notifications and named confirmation. Broad Reassign Day without exact evidence is prohibited.

### 21.4 Escalation/on-call resolution

Manager recipients derive from effective role/capability/shift/on-call policy with ordered fallback and no hard-coded display name/device. Unresolved recipient becomes a monitored delivery failure, not silent selection.

### 21.5 Inspection/analytics

Session-bound rubric and evidence thresholds; no unsupported comparison.

### 21.6 Exports

Manager exports require capability, purpose, date range, field redaction, generated-at/source/authority-set watermark and audit. Sensitive exports receive tighter retention and access.

---

## 22. Read Only

Dedicated product/API projections, Dashboard and Events only, fail-closed fields and no writes. Employee names/current owner reasons/private issue text are excluded by default until explicit approval. Automated route/asset/API and runtime tests prove the boundary.

---

## 23. Messenger

Server derives employee/manager identity. Thread selection clears prior content immediately, binds requests to thread key and rejects stale responses.

Employee direct-recipient mode only. Manager group/broadcast separate.

Protected durable outbox, stable client IDs, exactly-once effects, poison isolation and plain offline wording.

Per-user/device hide/delete is immediate with deterministic rollback; another participant's history is unaffected. Presentation retention and required archive are separate policy classes.

Message body is never spoken in employee alerts; approved speech identifies sender/type only.

---

## 24. Notifications and active-session behavior

### 24.1 State machines

Operational episode, recipient intent, transport, device receipt/presentation, acknowledgement and manager escalation remain separate.

### 24.2 Priority classes

- P0: safety/security/emergency;
- P1: overdue, ownership loss/addition requiring immediate awareness;
- P2: direct message, lunch/schedule change;
- P3: event/informational.

One active presentation remains. Higher priority may reorder queued alerts. Only an explicitly approved P0 safety policy may interrupt active speech; interruption and resumed/discarded behavior are audited.

### 24.3 Grouping/coalescing

One publication produces one grouped human notification per employee where practical, not one alert per location. Body summarizes added/removed/temporary areas and opens current Schedule. Superseded queued intents are cancelled before presentation.

### 24.4 Final revalidation

Episode active, status current, owner revision, recipient role and device epoch/credential immediately before send.

### 24.5 Native cadence

Chime → complete personalized speech → chime → identical speech → silence. No message body, duplicate OS sound or third replay.

### 24.6 Active cleaning/draft

Notification presentation cannot destroy or replace active session/draft.

- Open uses a session-safe overlay/module and preserves exact state;
- returning restores the same timer/form;
- ownership updates occur independently of whether notice is opened/dismissed;
- urgent location change may display while work continues but does not cancel session;
- employee can finish work under cross-ownership rules;
- overlay cannot trap the employee from required completion action.

### 24.7 Acknowledgement/escalation

Local pending acknowledgement persists and retries until server acknowledgement or manager reconciliation. Dismissal never resolves work or cancels escalation. Resolution cancels/reroutes escalation by stable episode ID.

---

## 25. Events

Immutable source/import and event revisions. Parser/import creates candidates only. Manager publishes notice; updates/cancellations supersede with notification consequences.

Separate lifecycle:

```text
published event notice
→ optional custodial impact proposal
→ named-manager approval
→ approved requirement input
→ optional separate ownership compilation/publication
```

No event save/import/edit/cancel or AI read writes schedule.

Role projections: full manager, relevant plain employee, approved Read Only.

---

## 26. Guest reporting

Disabled by default. Activation requires approved data policy, Marketing workflow, rate/abuse controls, signage, privacy, current-owner routing, closure/redaction, retention and physical acceptance.

Public submission → Marketing review → reject/approve → operations issue/dispatch → owner-change reroute → resolve → contact redaction.

No employee QR workflow.

---

## 27. Feedback and help

Feedback handles app/phone/NFC confusion/failure with simple categories and optional private attachment. It is not maintenance/supply/work request.

Operational reports use location completion or linked manager/message context. Manager triage is a manager-only asset/API. Attachments are type/size validated, malware/content checked as applicable, private, audited and retained by policy.

---

## 28. Contractor operations

Separate engagement, slot, named worker, assignment revision, secure-link delivery, acknowledgement/acceptance and actual work.

Target history states exactly what is known:

- named worker when verified;
- accountable vendor slot when policy allows and person unknown;
- never fabricate an individual.

Assignment does not equal delivered or accepted. If policy requires acceptance and it is absent, coverage remains `OPEN` or manager explicitly reassigns.

Secure view is revision-bound, expiring, revocable, no-store, read-only and approved English/Spanish. Translation versions and approval are stored.

---

## 29. AI, MCP, Moxie and diagnostics

Versioned tool registry: actor/product/role, source/freshness, read/propose/write, confirmation/second approval, idempotency, audit, privacy, rollback and failure.

Default read/propose. No schedule generation, ownership publication, ticket state, employee/device/security, guest activation, build/deployment or production mutation without exact separately approved tool.

Memphis answers from canonical APIs with source/freshness.

Moxie production role remains a policy gate; if retained, it is separate private manager workspace.

Diagnostics/repairs are isolated privileged product; exact diff, backup, named actor, confirmation, idempotency and rollback required.

---

## 30. Analytics and exports

Canonical joins actual cleaner, effective owner valid-time, workload/route/taxonomy/policy revisions, issues/tickets/inspection and evidence confidence.

Comparisons require minimum samples, inspection context, comparable purpose/window, exclusions and limitations. No result from one day, one point, one inspection or ownership not held.

Historical migration confidence is included and low-confidence reconstructed ownership is excluded from discipline unless separately reviewed.

Exports are manager-only, purpose-bound, redacted, watermarked with authority set/source/freshness and audited.

---

## 31. Security

Trust boundaries: public, Marketing, contractor, employee device, Read Only, Full Access, device admin, diagnostics, AI/MCP, workers, service role.

Requirements: forced RLS, least privilege, revoked broad execute, locked search path, backend-derived actor/device, vault isolation, epoch validation, scoped expiring tokens, rate/CSRF/origin controls, field redaction, immutable privileged audit and secrets absent from clients/logs/artifacts.

Independent threat model before schema GO covers spoofing, replay, confused deputy, public abuse, contractor enumeration, session theft, AI/diagnostic escalation, notification leakage, backup and supply-chain integrity.

---

## 32. Retention, privacy and holds

One versioned matrix per data class defines purpose, sensitivity, archive, purge/redaction, holds, roles, backup/export and FK strategy.

Classes include identity, schedule/ownership, sessions/completions, inspections, issues/tickets, Messenger, events/notices, notifications, guest/contact/photos, feedback/attachments, raw GPS/summary, device credentials, AI/diagnostics, migration/release and backups.

Fourteen-day communication presentation does not delete responsibility/session/inspection/ticket history.

Legal/incident hold is explicit, named, scoped, time-bounded/reviewed and blocks covered purge. Closing hold is audited.

---

## 33. Backup, disaster recovery, availability and hosting

### 33.1 Backup/recovery

Encrypted backups, key custody, frequency/retention, RPO/RTO, clean rebuild, schema fingerprint, object restore, drill frequency, worker drain, production restore authority and evidence.

### 33.2 Availability/SLO

Architecture records approved targets for:

- employee local tap response;
- Home and module usability;
- NFC-to-Start presentation;
- Messenger thread open;
- backend request initiation/completion;
- notification delivery/escalation;
- manager Dashboard freshness;
- backup/restore freshness.

Provisional acceptance targets may be tested during design, but policy approval controls final values.

### 33.3 Hosting

Production backend must meet approved SLO without unacceptable cold start. Free/paid vendor tier is a budget/deployment decision, not an architecture assumption. If free hosting cannot meet SLO, always-on hosting is required before release.

### 33.4 Dependency failure

Timeouts, circuit breakers, retries and graceful degradation are defined per dependency. Employee field work continues locally within offline policy; manager/Read Only show freshness/outage instead of fabricated live state.

Monitoring covers release identity, authority set, database/auth/provider health, worker queues/dead letters, device credential/push readiness, backup/restore age and response budgets.

---

## 34. Historical migration and cutover

### 34.1 Reconstruction confidence

Every migrated historical assertion is classified:

- source-proven exact;
- deterministically reconstructed;
- inferred with explicit confidence/reason;
- conflicting/unresolved;
- intentionally not reconstructed.

Legacy rows and mapping evidence remain. Low-confidence responsibility is excluded from disciplinary analytics by default.

### 34.2 Process

1. freeze source/schema/release identity;
2. read-only export and hash;
3. complete writer/reader/worker/queue graph;
4. isolated canonical schema and deterministic fixtures;
5. migrate identities/positions/locations/source/history with confidence;
6. shadow compiler/projections;
7. compare every consumer and classify differences;
8. independent schema/security/migration audit;
9. publish compatible operational authority set;
10. atomic pointer cutover;
11. disable legacy writers;
12. canary/monitoring;
13. complete rollback proof.

No per-endpoint flags or permanent dual write.

Rollback preserves canonical events for reconciliation and returns the complete prior authority set.

---

## 35. Build, test-data and rollback governance

### 35.1 Immutable build

One protected-main commit, locked toolchains/dependencies, no CI source patching/self-commit.

### 35.2 Product graph

Fail-closed asset/module/API allowlists. Employee APK excludes manager/QR/enrollment-removal/triage/diagnostics.

### 35.3 Release tuple and admission

Source commit, locks/toolchains, asset hashes, backend/API, authority-set/schema fingerprint, APK package/version/hash/signer/native graph/config and admission evidence.

Producer and independent consumer admission required.

### 35.4 Test data

- no mutable production data as test fixture;
- sanitized source-proven fixtures;
- synthetic identities marked non-production and separate from employment/schedule eligibility;
- fixture version binds schedule/route/workload/policy/taxonomy;
- physical test phones/accounts have cleanup/recovery rules;
- no test workflow writes production.

### 35.5 Upgrade/rollback with local work

Local-store schema migration and rollback plan is part of release admission. Before downgrade to Build 22, pending newer work is reconciled or exported to a manager recovery record. Rollback never silently deletes an active session/draft/queue.

Build 22 remains rollback until replacement fleet acceptance.

---

## 36. Physical acceptance

Exact Moto G 2025, Android and production Fully Kiosk configuration.

Employee matrix:

- install/upgrade/rollback and vault preservation;
- containment, Home/Recents, reboot, wake/process restore;
- four-button Home and all Back paths;
- NFC all screens/lock/cold/warm/offline/reconnect;
- restroom/exhibit session/forms/drafts;
- offline exactly once and prolonged outage limits;
- schedule/lunch/9:45/inheritance transitions;
- notification audio/overlay/priority/grouping/ack/no duplicate sound;
- active-session alert navigation safety;
- Messenger privacy/outbox/delete/performance;
- Events/Feedback;
- GPS calibration/permission/exit/return/battery;
- large text, names, keyboard, gloves, hearing/non-swipe alternatives;
- Karen no-rescue script.

Manager/Read Only/contractor/AI matrix tests role fields, publication/rollback, inspections, security/recovery, event separation, contractor link/acceptance, Read Only redaction and tool confirmation/audit.

Evidence binds source/release tuple, device/config, fixtures, operator, logs/recordings, result and rollback.

---

## 37. Test and evidence matrix

Every invariant maps to unit, constraint, property/determinism, concurrency/race, fault injection, migration/replay, security, component/browser, Android instrumentation, built-distribution/APK inspection, physical and operational acceptance as applicable.

Source-string and mocked tests are labeled accurately and cannot satisfy behavioral/physical gates.

Required adversarial classes include:

- overlapping/missing ownership;
- lunch/9:45/shift-end/zero staff;
- event/operating/cross-midnight collisions;
- stale epoch/offline replay/storage exhaustion/clock skew;
- active session across ownership/alert/app update;
- scan cannot resolve episode;
- notification owner change, ack failure, grouping and completion during escalation;
- Messenger rapid switching/outbox poison/delete failure;
- guest/public/contractor abuse;
- AI confused deputy;
- retention/hold/purge/FK;
- backup/restore/authority-set rollback;
- source→APK provenance and physical containment.

---

## 38. Open gates before isolated design

The gate registry remains controlling. At minimum:

- all-week source/Sunday truth;
- position/person rules and vacancy;
- workload/frequency/route research;
- operating windows/September 14/cross-midnight;
- readiness/severity/inspection/OPEN policy;
- contractor identity/acceptance;
- employee runtime graph/NFC payloads/offline age;
- GPS calibration/use/retention;
- Messenger archive and notification wording/escalation;
- guest data policy;
- manager tiers and AI/Moxie/diagnostic authority;
- retention/holds/RPO/RTO/SLO;
- complete migration consumer graph;
- physical/Karen thresholds;
- independent architecture audit.

No designer may fill an open gate with an assumption.

---

## 39. Architecture audit roles

Independent first passes:

1. GPT-5.3 Spark — mechanical schema/compiler/transaction/idempotency/migration/test falsification.
2. GPT-5.5 Instant — capability canon, hidden omissions, contradictions and whole-program breadth.
3. GPT-5.5 Pro — actual custodial operation, Karen, manager burden, fairness and field practicality.
4. GPT-5.6 Pro — integrated architecture, security, authority sets, migration, release and shared blind spots.

Each auditor receives v4.1 and primary frozen evidence. They do not see other new audit reports until first-pass findings are fixed.

---

## 40. Implementation sequence after future architecture GO

1. isolated identity/location/workforce design;
2. static schedule/operating/workload schema design;
3. ownership compiler/resolver design;
4. service occurrence/status/readiness design;
5. session/completion/offline/GPS design;
6. notification/ack/escalation design;
7. Messenger design;
8. events/issues/guest/feedback/contractor design;
9. role/security/retention/availability design;
10. migration/release/physical design;
11. independent design audits;
12. isolated implementation;
13. build audit/rebuild;
14. adversarial testing;
15. shadow migration;
16. one-phone canary and Karen acceptance;
17. fleet pilot;
18. final release audit.

---

## 41. v4.1 disposition

Architecture v4.1 is a complete top-level replan suitable for independent architecture audit.

It deliberately retains open research/policy gates rather than fabricating facts. Those gates block isolated design/implementation until closed or independently judged safely bounded.

Current verdict:

- send v4.1 for independent architecture audit: **GO**;
- schema/component design: **NO-GO**;
- implementation/migration/APK/phone/release: **NO-GO**.