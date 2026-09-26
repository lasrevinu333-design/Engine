# Memphis Zoo Custodial Program — Unified Whole-System Architecture v4.2

**Status:** Standalone architecture-closure replan for internal and independent audit; implementation is not authorized  
**Revision:** 4.2  
**Prepared:** 2026-08-04  
**Clean branch:** `agent/custodial-unified-whole-system-v4-2-20260804`  
**Branch base:** frozen actual-program commit `8cdbe2fbe98fd31ab11483d96c12b6c1270fc148`  
**Supersedes as top-level architecture candidate:** Unified Whole-System Architecture v4.1  
**Imports:** accepted ownership v3.1 doctrine and accepted v4.1 whole-system doctrine  
**Rollback baseline:** Custodial Build 22

---

## 1. Purpose

The Memphis Zoo Custodial Program is one connected operational evidence system for:

- defining required service;
- assigning responsibility;
- preserving coverage through real exceptions;
- performing and proving work;
- reporting issues and follow-up;
- inspecting with context;
- communicating clearly;
- learning from trustworthy history;
- protecting employee, guest and operational data;
- recovering from outage, migration, device and release failure.

The system shall provide one defensible answer to each of these questions:

1. What service is required at this exact location and time?
2. Which approved policy and revision created that requirement?
3. Who is responsible, why, and under which publication?
4. Is responsibility assigned to an employee, contractor, `OPEN`, or `not_required`?
5. Who is actively cleaning and who actually completed the work?
6. What tag, device, session, GPS and form evidence exists?
7. Which service occurrence is due, overdue, in progress, satisfied, corrected, reopened or cancelled?
8. Is the location ready, ready with follow-up, blocked, awaiting inspection or not required?
9. What issue, ticket or work-order handoff exists?
10. What Event, schedule, operating-policy, contractor or manager command changed the day?
11. Who was notified, what reached which device, what was presented, and what was acknowledged?
12. What may each product and actor see or change?
13. Can the authoritative history be rebuilt, audited, migrated, rolled back and proven on the actual phones?

V4.2 is not an application design, schema design or implementation plan. It is the complete normative architecture that those later designs must obey.

---

## 2. Authorization and stage gates

This document authorizes only:

- source, database, field and physical research;
- architecture artifacts and fixtures;
- non-authoritative prototypes;
- threat models and test plans;
- internal architecture audit;
- independent architecture audit;
- architecture replan.

It does not authorize:

- schema DDL;
- API or component design that fixes open policy by assumption;
- frontend, backend or native implementation;
- production data writes;
- shadow writes;
- migration or cutover;
- workflow or build execution;
- APK creation or installation;
- phone or Fully Kiosk changes;
- canary, fleet rollout or release.

A future architecture GO authorizes isolated schema/component design only. Each later gate requires its own evidence and audit.

---

## 3. Evidence, precedence and capability trace

### 3.1 Controlling manifest

All evidence shall be registered in:

`custodial-unified-whole-system-evidence-manifest-v1.md`

Unregistered evidence cannot authorize architecture, migration or release decisions.

### 3.2 Precedence

When evidence conflicts:

1. current explicit product/operating decisions;
2. approved operational policy and field invariants;
3. independently accepted architecture and decision records;
4. valid v17 outcomes and screenshot evidence;
5. frozen source and read-only production truth;
6. tests that exercise the correct path and requirement;
7. physical Moto G/Fully Kiosk behavior for device-dependent facts.

Historical screenshots preserve capabilities, not obsolete interface authority.

### 3.3 Capability trace

Every CAP-001 through CAP-252 capability shall have one joined trace row containing:

- capability and disposition;
- legitimate operational purpose;
- actor/product;
- canonical authority or command;
- record type/version;
- writer/resolver;
- projection/API/UI;
- security boundary and capability grant;
- sensitivity and retention class;
- migration and rollback class;
- automated proof;
- physical proof;
- open gate;
- architecture section.

Every architecture object shall reverse-map to one or more CAP IDs. An object with no legitimate capability is rejected.

**Gate:** `G-TRACE-001`.

---

## 4. Governing principles

1. One canonical authority for every fact.
2. One common compatibility envelope for cross-domain authoritative records.
3. One distributed operational authority-set protocol.
4. One canonical principal/grant/authorization-decision model.
5. Static normal policy before exceptions.
6. Minimal changes to affected locations and intervals only.
7. Individual location is the final assignment and service unit.
8. Source facts, commands, compiler outputs, operational evidence, corrections, projections and presentation evidence are distinct.
9. Read paths never create or mutate operational authority.
10. Published facts and accepted evidence are immutable; corrections append.
11. Valid time and recorded time are both preserved.
12. Missing data is explicit; it is never inferred into a convenient owner or status.
13. `OPEN` and `not_required` are explicit and different.
14. Responsible owner, active cleaner and actual cleaner are separate.
15. Work requests do not transfer ownership.
16. Determinism and idempotency are required at every mutable boundary.
17. Publication and downstream outbox creation are atomic.
18. Every client product has one lifecycle, navigation, security and presentation owner.
19. Employee presentation uses plain action language; diagnostics are separate.
20. Physical behavior is release-blocking architecture evidence.
21. Compatibility mechanisms are temporary, bounded, observable, reversible and retired.
22. Whole authority sets roll back together.
23. No unregistered writer, resolver, privileged function or tool survives cutover.
24. Tests and exact artifacts, not labels or claims, control gates.
25. Low-confidence evidence cannot silently become personnel judgment.

---

## 5. Canonical cross-domain record contract

### 5.1 Purpose

Canonical JSON controls bytes. This section controls meaning.

Every authoritative command, fact, event, correction, outbox intent, worker attempt, authorization decision, migration assertion and release assertion shall use a registered record type and inherit one common compatibility envelope.

### 5.2 Mandatory envelope

Every registered record contains or inherits:

- `record_id` — globally unique immutable ID;
- `record_class` — command, fact, event, evidence, correction, projection checkpoint, outbox intent, worker attempt, authorization decision, migration assertion or release assertion;
- `record_type` and `schema_version`;
- `authority_set_id` and monotonic `authority_set_generation`;
- source domain and source contract revision;
- aggregate/entity type and ID;
- aggregate sequence or declared ordering rule;
- valid-time interval or instant;
- recorded timestamp;
- occurred/issued timestamp;
- operation/idempotency ID;
- correlation and causation IDs;
- canonical principal ID;
- authorization-decision ID for privileged commands;
- credential, session, device and assignment-epoch context where applicable;
- source artifact/revision and source confidence where applicable;
- supersedes, corrects, voids or derives-from references;
- sensitivity class;
- retention class;
- canonical payload digest;
- producer implementation/release version;
- replay/projection compatibility behavior;
- unknown-version fail-closed behavior.

Domain payloads remain domain-specific. The envelope is common.

### 5.3 Record registry

A protected registry defines for each record type/version:

- owning domain;
- schema and compatibility range;
- allowed producers and consumers;
- aggregate ordering rule;
- sensitivity/retention class;
- replay behavior;
- migration adapter if any;
- retirement status;
- required tests.

A producer may not emit an unregistered type. A consumer encountering an unknown incompatible type rejects or quarantines it; it may not guess.

### 5.4 Canonical serialization

`canonical-json.v1` requires:

- UTF-8 and Unicode NFC;
- lexicographic object-key order;
- stable semantic array order;
- UTC RFC 3339 timestamps with fixed precision;
- America/Chicago service-date/day-offset rules through one time authority;
- canonical non-exponent decimals;
- distinct null, missing and empty values;
- source-byte hash plus normalized-content hash;
- SHA-256 with algorithm/version stored.

### 5.5 Conformance

Architecture and later design gates require:

- schema conformance tests for every registered record;
- deterministic replay;
- correlation graph integrity;
- valid-time/recorded-time ordering;
- idempotency collision tests;
- retention enforcement;
- projection rebuild from immutable records;
- mixed/unknown-version rejection.

**Gate:** `G-RECORD-001`.

---

## 6. Operational authority-set distributed protocol

### 6.1 Purpose

An operational authority set binds compatible versions of:

- identity/workforce/principal model;
- location registry and lifecycle model;
- static schedule and operating policy;
- workload/route/frequency/restriction models;
- ownership compiler/resolver;
- service occurrence/status/readiness model;
- completion, issue, ticket and inspection contracts;
- Messenger, Events, Feedback, guest and contractor contracts;
- notification contract;
- API/schema and worker contracts;
- employee, manager and Read Only client compatibility;
- security/retention policy;
- migration/rollback target;
- release and configuration identity.

### 6.2 Immutable dependency graph

Each authority set contains a complete dependency graph and digests. No domain version may be activated outside that graph.

### 6.3 Lifecycle

```text
draft
→ validated
→ independently_audited
→ shadow_ready
→ activating
→ active

active → degraded
active/degraded → rollback_pending → rolled_back
active/rolled_back → retired
```

Only one generation is active. Generation numbers are monotonic and protected by a fencing token.

### 6.4 Pinning

Every request, session, local snapshot, queue item, worker lease, outbox intent, projection checkpoint and migration assertion is pinned to one authority-set ID/generation.

It is either:

- valid under that exact set;
- explicitly translated through a registered bounded compatibility adapter;
- quarantined for manager recovery;
- rejected fail-closed.

No consumer-local fallback chooses another authority set.

### 6.5 Activation protocol

Activation requires:

1. complete validated manifest;
2. schema/API/backend/worker/client compatibility proof;
3. registered record types;
4. backup/restore and rollback proof;
5. legacy writer drain/fencing plan;
6. old-client inventory and compatibility policy;
7. shadow comparison acceptance;
8. current health quorum;
9. independent approval;
10. protected activation lease.

During `activating`:

- new long-lived operations do not start unless pinned to the candidate set;
- old workers drain or fence;
- claimable outbox work remains generation-bound;
- mixed-set detection is monitored;
- failure returns to the prior complete set.

### 6.6 Old clients and in-flight work

The protocol defines:

- active session begun under the prior set;
- offline completion uploaded after activation;
- old notification acknowledgement;
- old APK waking after cutover;
- assignment-epoch change during cutover;
- new-set pending work during rollback;
- maximum prior-set evidence acceptance window;
- immutable interpretation under originating set;
- translation, quarantine and rejection rules;
- prohibition on translated completion mutating current ownership;
- manager recovery and retirement of prior-set acceptance.

### 6.7 Compatibility adapters

An adapter is allowed only when it has:

- exact source/target contracts;
- non-authoritative status;
- owner;
- metrics and alerts;
- rollback;
- expiration and retirement gate;
- tests proving it cannot broaden authority.

### 6.8 Rollback

Rollback restores one complete compatible set including schema, pointer, backend, workers, policy, notification contract, object storage, release tuple, keys/configuration and device-local compatibility.

It does not:

- restore only daily rows;
- discard pending work;
- blindly replay provider notifications;
- resurrect an unregistered writer;
- rewrite accepted evidence.

**Gate:** `G-AUTHSET-001`.

---

## 7. Canonical principal, credential, grant and authorization model

### 7.1 Principal types

Registered principals include:

- employee human;
- manager human;
- Marketing reviewer;
- contractor named worker;
- accountable contractor slot;
- system worker/service principal;
- AI/MCP tool service;
- diagnostic/repair worker;
- manager-access administrator;
- Device Security administrator;
- database owner/migration operator;
- backup operator;
- release operator;
- synthetic test principal.

Free-text actor names are display snapshots only and cannot authorize commands.

### 7.2 Credentials and sessions

Registered credential/session types include:

- employee native-vault credential;
- device assignment epoch;
- manager trusted-device credential/session;
- short-lived enrollment or second-factor session;
- contractor expiring link credential;
- service credential;
- migration/release credential;
- break-glass session.

Credentials are never treated as the human principal itself.

### 7.3 Capability grants

A grant contains:

- principal;
- capability;
- resource scope;
- temporal scope;
- conditions;
- required credential/session/device trust;
- approval count;
- delegability, default false;
- issuer and policy revision;
- effective and revocation times.

The system is deny-by-default.

### 7.4 Authorization decision

Every privileged command references an immutable authorization decision recording:

- principal and immutable actor snapshot;
- credential/session/device context;
- grant and capability;
- resource/temporal scope;
- policy revision;
- confirmation and second approval where required;
- decision result/reason;
- correlation/causation.

### 7.5 Revocation and break-glass

Revocation propagates to active sessions, workers and pending privileged operations according to capability-specific rules. Break-glass is separately granted, time-bounded, audited and reviewed.

### 7.6 Separation of high-risk principals

Full Access Manager does not imply:

- Device Security;
- access administration;
- controlled repair;
- database ownership;
- backup/restore;
- rollback/release.

Those require separate capabilities and, where approved, dual control.

### 7.7 Confidential accommodation/restriction boundary

The workforce model separates:

- neutral operational effect, such as location restriction, paired-work requirement or time restriction;
- confidential justification.

The compiler reads only the approved operational effect. Employee Schedule, ordinary explanations, AI, analytics and general exports cannot access the justification. Access, review, expiration, correction, migration and retention are separately authorized.

**Gates:** `G-PRINCIPAL-001`, `G-PRIV-ACCOMMODATION`.

---

## 8. Products and trust boundaries

### 8.1 Custodial Employee

Private Android-only product. May:

- see current exact areas;
- use ambient NFC;
- perform and complete own work;
- use direct Messages;
- read relevant Events;
- submit app/phone/NFC Feedback;
- acknowledge presentation.

It may not access manager, device-admin, QR, analytics, diagnostics, credentials or schedule-write functions.

### 8.2 Full Access Manager

Private named-manager product. Each action is capability-gated. Product areas may include Dashboard, Schedule, Messenger, Events, inspections, issues/tickets, analytics, employee/phone administration, approved guest workflow, feedback triage and approved AI/diagnostics.

### 8.3 Read Only

Private Dashboard and Events only. Fail-closed default excludes:

- employee names unless separately approved;
- device identity;
- raw GPS;
- private notes/contact data;
- detailed ownership reason/history;
- Messenger and Feedback;
- schedule/phone/security administration;
- AI and diagnostics;
- writes.

A dedicated API/projection and asset graph are required; visual hiding is insufficient.

### 8.4 Marketing

May review approved guest submissions and public wording. It cannot assign ownership or manage employees/devices.

### 8.5 Contractor

Receives one exact assignment revision through a scoped expiring channel. It cannot view unrelated employee or schedule data.

### 8.6 Attendance Context

Attendance is manager-only informational context unless a future separately approved command uses it as source evidence.

The contract defines:

- source and cache identity;
- freshness and stale/unavailable state;
- allowed fields and privacy;
- retention;
- AI access;
- explicit prohibition on silent schedule mutation.

“Attendance” for employees and expected guest attendance for Events use distinct canonical names.

### 8.7 Weather Context

Weather is excluded from Employee Home. It is disabled by default as an operational authority. If retained, it is optional manager-only informational context with source/freshness and no silent schedule effect.

### 8.8 AI, Moxie and diagnostics

These are separate registered products/tools. Failure or removal cannot block ordinary employee work.

---

## 9. Canonical location registry and lifecycle transaction

### 9.1 Stable identity

A location has a permanent ID independent of:

- code/display name;
- group membership;
- tag;
- route coordinates;
- form type;
- current active state.

Effective attributes include aliases, display/pronunciation, operational/form type, visibility eligibility, operating policy, workload/route classification and active/closed/retired state.

### 9.2 Rename

Rename changes display metadata only. Historical records preserve stable ID and display snapshot/revision.

### 9.3 Temporary closure and retirement

Temporary closure is a dated operating-policy override and may produce `not_required`. Retirement ends future eligibility and preserves history.

### 9.4 Split/merge transition command

A split or merge is one effective-dated command and publication transaction containing:

- predecessor/successor identities and lineage;
- effective cut;
- tag revoke/replace plan;
- operating/workload/route/policy replacement;
- ownership transition;
- occurrence closure/new occurrence creation;
- issue/ticket/inspection continuity;
- guest/Event relation handling;
- active-session grandfathering;
- delayed/offline completion attribution;
- public signage removal/installation evidence;
- rollback behavior.

### 9.5 In-flight rules

Work begun before the cut remains attributed to the predecessor context unless an explicit transition rule says otherwise. A delayed completion may satisfy only the occurrence relation declared by the transition transaction. Alias or redirect alone cannot decide this.

### 9.6 Tags

A tag belongs to one location at a time through an effective-dated registry. Old/revoked tags fail safely and produce manager-visible evidence. Physical signage removal is part of retirement proof.

**Gate:** `G-LOC-TRANS-001`.

---

## 10. Identity, workforce, positions, contractors and devices

### 10.1 Permanent employee identity

A departed employee is never renamed into a replacement. Michael McWright and Daniel Morgan remain attached to their historical evidence.

### 10.2 Separate lifecycle facts

Effective records separately represent:

- employment;
- schedule eligibility;
- Messenger eligibility;
- phone eligibility;
- training/capability/restriction effect;
- position occupancy;
- absence/PTO;
- test-only state.

### 10.3 Positions and vacancies

Normal schedule policy references stable positions. Position occupancy is non-overlapping. Vacancy is explicit and becomes a compiler input.

A person-bound rule requires named approval, reason category, effective dates, review/expiration and privacy treatment.

### 10.4 Contractor identity

Contractor engagement, capacity slot, named worker and accountable vendor slot are distinct. `COVERALL_*` employee rows are migration evidence only.

### 10.5 Device identity and assignment epoch

A canonical device registry maintains identity, aliases, credential, assignment epoch, employee assignment, push registration, security state and history.

Every employee mutation and acknowledgement binds current credential and assignment epoch.

### 10.6 Reassignment

Ordinary reassignment is blocked by active session, draft, offline queue, unresolved conflict or enrollment operation. Emergency quarantine creates a reconciliation case and prevents cross-employee attribution.

### 10.7 Mid-session revocation

The session contract defines employee departure, credential revocation, device reassignment, lost-phone quarantine and manager-directed takeover. Future authority closes without erasing legitimate prior work or changing actual cleaner.

---

## 11. Static schedule source publication

```text
approved source artifact
→ original-byte preservation and digest
→ normalized candidate
→ unresolved mapping review
→ position/person/location validation
→ seven-day individual-location preview
→ policy/conflict approval
→ effective-date publication
→ immutable static version
→ membership/policy snapshot
→ immutable daily baseline
```

Importer, validator, approver and publisher identities are distinct capabilities where policy requires.

Unresolved mappings cannot self-approve. Filename `COMPLETE` has no authority.

Open gates include source provenance, Sunday, disputed shifts, positions/person rules, lunch, operating hours, Elephant Trunk and reminder groups.

**Gates:** `G-SCHED-SOURCE`, `G-SUNDAY`, `G-SHIFTS`, `G-POSITION`.

---

## 12. Workload, service frequency, route and restrictions

### 12.1 Location/purpose profile

Versioned profile contains:

- expected minutes/load points;
- service frequency and occurrence rules;
- difficulty/priority;
- season/window applicability;
- approved operational restrictions;
- source and confidence;
- effective revision.

Unknown remains unknown and blocks unsupported optimization.

### 12.2 Route model

Versioned location-level model contains zones, anchors, adjacency, walking time, access constraints, source and confidence.

Group values are not copied or divided into individual-location truth.

### 12.3 Objective order

1. hard requirement and eligibility;
2. preserve unaffected static ownership;
3. minimize moved locations/time boundaries;
4. required related-location constraints;
5. geography/route coherence;
6. workload fairness;
7. stable reviewed tie-breaker.

These facts never create a phone-directed route.

**Gates:** `G-WORKLOAD`, `G-FREQUENCY`, `G-ROUTE`, `G-RESTRICTIONS`.

---

## 13. Operating policy and time authority

### 13.1 Precedence

1. emergency shutdown;
2. dated location override;
3. approved Event/after-hours window;
4. seasonal location policy;
5. normal location policy;
6. general zoo policy.

Equal-authority conflicts block publication.

### 13.2 Time model

America/Chicago valid time uses explicit service date and day offset/timestamp range. One time authority handles DST and cross-midnight behavior.

### 13.3 Required policy fixtures

- normal close;
- September 14 seasonal close;
- split windows including Splash Pad-type windows;
- after-hours work;
- overnight/cross-midnight work;
- temporary closure;
- event override;
- `not_required` reason.

**Gates:** `G-HOURS`, `G-SEPT14`, `G-SPLIT-WINDOWS`, `G-CROSS-MIDNIGHT`.

---

## 14. Canonical ownership compiler and resolver

### 14.1 Final states

Each required location interval resolves to exactly one:

- employee;
- contractor;
- `OPEN`;
- `not_required`.

Groups are authoring/display/workload aids only.

### 14.2 Inputs

Append-only inputs include:

- static baseline;
- position occupancy and eligibility;
- absence/PTO/callout;
- contractor engagement/capacity/acceptance as policy requires;
- approved Event/after-hours requirement;
- operating/location override;
- ownership transfer;
- emergency override;
- correction/cancellation.

### 14.3 Compiler order

1. requirement occurrences/windows;
2. static location phases;
3. position occupant and hard eligibility;
4. absence and approved contractor capacity with minimal movement;
5. exclusive lunch transfer/restoration;
6. departure/shift-end inheritance;
7. ordinary manager transfer;
8. emergency override;
9. validation, exact diff and notification consequences;
10. atomic publication.

### 14.4 Required scenarios

- 9:44:59 → 9:45;
- no 9:45 change;
- lunch spanning 9:45;
- lunch spanning shift end;
- departure before 9:45;
- return;
- two, one and zero employees;
- CoverAll added/removed/unaccepted;
- event/closure/cross-midnight;
- emergency transfer;
- retroactive correction.

### 14.5 Resolver

Every consumer receives:

- location and interval;
- owner/state;
- purpose;
- reason;
- controlling source/transition;
- ownership revision;
- authority-set ID/generation;
- freshness/confidence.

No fallback resolver remains after cutover.

### 14.6 Publication

Candidate intervals, validation, transitions, grouped notification child intents, prior/new pointer and audit publish atomically. No outbox work is claimable before commit.

### 14.7 `OPEN`

Truthful required `OPEN` may publish. It triggers approved manager action; it is not automatically a publication failure.

**Gates:** `G-LUNCH`, `G-OPEN`, `G-LATE-INHERITANCE`.

---

## 15. Service occurrence aggregate

### 15.1 Identity

A service occurrence is one required instance of a location/purpose service under one policy revision. It retains one ID through due-soon, overdue, in-progress, satisfaction, correction and reopen.

### 15.2 Aggregate sequence

Every occurrence has an optimistic/serialized aggregate sequence. Commands require expected sequence or an equivalent serialization fence.

### 15.3 Commands

Registered commands include:

- create/activate;
- mark due/overdue;
- attach session activity;
- submit satisfaction decision;
- mark partial;
- satisfy;
- cancel/not-required;
- reopen;
- correct/void;
- create urgent linked occurrence;
- create next occurrence;
- enter conflict review.

### 15.4 Satisfaction decision

One transaction decides whether an accepted completion:

- fully satisfies one occurrence;
- partially satisfies one occurrence;
- satisfies multiple occurrences only under an explicit versioned multi-occurrence policy;
- satisfies neither and remains evidence;
- conflicts and requires review.

The decision records policy revision and reasoning. It never relies on latest-completion timestamp alone.

### 15.5 Concurrency

The aggregate handles:

- two active sessions;
- concurrent completions;
- duplicate offline completion;
- urgent/regular overlap;
- partial/full combination;
- completion after closure;
- cross-midnight completion;
- manager correction while jobs are leased.

Exactly one authoritative satisfaction result emerges.

### 15.6 Next occurrence

Next-occurrence creation uses a stable idempotency key derived from the satisfied occurrence and policy. Exactly one next occurrence may be created.

### 15.7 Correction cascade

Correction never deletes original completion or occurrence history. It appends transitions and deterministically updates:

- satisfaction state;
- next-occurrence relation;
- status/readiness;
- notification supersession/cancellation;
- escalation;
- analytics confidence;
- manager wording.

A correction after the next occurrence exists does not silently delete that next occurrence; policy chooses retain, adjust, link corrective occurrence or conflict review.

**Gates:** `G-OCC-001`, `G-READINESS`, `G-SEVERITY`, `G-REOPEN`.

---

## 16. Employee session and active-work aggregate

### 16.1 Session identity

Session start binds:

- employee principal;
- canonical device/credential/assignment epoch;
- location/tag;
- ownership revision and owner relation;
- service occurrence candidate/context;
- authority set/generation;
- employee release/local-store version;
- operation ID;
- start evidence.

### 16.2 State

```text
requested
→ active
→ finish_requested
→ completion_draft
→ submitted
→ accepted | conflict_review | rejected_terminal

active/draft → cancelled_by_employee_or_manager
```

Cancellation does not erase evidence.

### 16.3 Ownership transition during work

The active cleaner may continue valid work after responsibility changes. Current owner changes independently. Completion records both start and completion ownership context.

### 16.4 Revocation/reassignment

Capability-specific rules decide whether existing work may complete after departure, revocation or quarantine. Future GPS, messages and new work stop as required. Actual cleaner is preserved.

### 16.5 Alert navigation

Open/Dismiss or module navigation cannot destroy timer, session or draft. A session-safe overlay/router returns to the exact prior work state.

---

## 17. Protected local store, offline time and reconciliation

### 17.1 Local owner

The native employee runtime owns one protected local store for session, draft, queue, notification presentation and recovery state.

### 17.2 Operation envelope

Every local mutation includes the canonical record envelope, authority-set pin, employee/device/epoch, stable operation ID, snapshot revision and trusted-time evidence.

### 17.3 Trusted time

Offline age uses:

- server-issued time/offset;
- monotonic elapsed time within one boot;
- boot ID/generation;
- reboot detection;
- wall-clock tamper detection;
- post-reboot confidence rule.

Monotonic time is never assumed to survive reboot.

### 17.4 Keys and lost-phone lifecycle

The architecture defines:

- encryption-key generation and rotation;
- snapshot-signing key version;
- revocation and quarantine;
- secure wipe where possible;
- lost phone returning offline;
- backup/restore interaction;
- compromised-device recovery;
- storage exhaustion export/recovery.

### 17.5 Queue outcomes

Server reconciliation returns:

- accepted;
- duplicate/already applied;
- transient retry;
- terminal rejection;
- conflict review;
- quarantined due to authority/epoch/security mismatch.

Retry is bounded. Poison work cannot block unrelated work. No local evidence is deleted before authoritative acknowledgement or manager recovery.

### 17.6 Upgrade and rollback

Local-store migration is versioned and idempotent. Pending work is checkpointed. A downgrade cannot silently discard new-format work; unreconciled work is quarantined into manager recovery.

**Gates:** `G-OFFLINE-TIME`, `G-LOCAL-KEYS`, `G-CROSS-SET-WORK`.

---

## 18. Native runtime, NFC and tag evidence

### 18.1 One native owner

The native shell owns:

- lifecycle and one employee router;
- native vault and protected store;
- NFC intake;
- notification presentation;
- active-session GPS;
- process restoration;
- Fully Kiosk containment.

Legacy pages may be extracted for validated algorithms only; they are not permanent runtime co-owners.

### 18.2 Ambient NFC

NFC is accepted from:

- Fully Kiosk lock state;
- Home;
- Schedule;
- Messages;
- Events;
- Feedback;
- active timer/form;
- cold/warm start;
- wake/reboot;
- offline/reconnect.

A valid tag resolves location and opens the correct Start Cleaning workflow. The enrolled phone supplies employee identity. No normal Scanner page or QR workflow exists.

### 18.3 Tag outcomes

- valid/current;
- duplicate delivery;
- unknown;
- revoked;
- old location-transition tag;
- conflicting active work.

Each outcome is deterministic and employee-safe. A scan receipt changes no ownership or completion state.

### 18.4 Physical proof

Source tests do not prove NFC delivery. Exact NDEF payloads, tag registry, Android intent behavior and Fully Kiosk interaction are physical gates.

---

## 19. Active-session GPS

GPS operates only during active cleaning sessions in the current release.

The architecture requires:

- one native acquisition owner;
- session start/stop lifecycle;
- sampling and battery policy;
- calibration revision;
- accuracy and hysteresis;
- indoor/unavailable/disabled/denied behavior;
- screen-off/reboot behavior;
- raw observation and durable summary separation;
- confidence;
- incident hold;
- employee review/dispute;
- no automatic discipline or work rejection from low-confidence evidence.

Work continues when GPS is unavailable unless an approved safety rule says otherwise. The system records uncertainty; it does not fabricate inside/outside.

**Gate:** `G-GPS`.

---

## 20. Completion evidence and correction

### 20.1 Taxonomy

Versioned taxonomies distinguish restroom, exhibit and other approved form types. Services, supplies, fixtures, issues and notes use canonical IDs with employee-safe labels.

### 20.2 Employee flow

Common work uses no more than three primary decisions:

1. confirm/start;
2. full clean or exceptions;
3. submit.

Progressive disclosure preserves rich evidence without dense normal-path checklists.

### 20.3 Acceptance transaction

One transaction:

- validates session/identity/epoch/authority set/idempotency;
- stores immutable completion evidence;
- creates normalized issues/tickets as required;
- performs the occurrence satisfaction decision;
- updates status/readiness projection inputs;
- creates downstream notification/escalation intents;
- returns reconciliation result.

No partial accepted state is visible.

### 20.4 Correction

Named-manager correction/void is append-only. Original evidence remains. Material retroactive changes used in personnel analytics require approved second authorization.

---

## 21. Issues, supplies, tickets, work requests and work orders

### 21.1 Separate domains

The system distinguishes:

- maintenance observation/issue;
- supply shortage;
- out-of-order condition;
- custodial ticket;
- one-time work request;
- ownership transfer;
- guest follow-up;
- emergency assistance;
- app/phone/NFC Feedback.

### 21.2 Custodial ticket doctrine

Custodial ticket state is:

```text
OPEN → W.O. Submitted
```

`W.O. Submitted` records custodial handoff. It does not claim Facilities completed repair.

External work-order integration, if approved later, has a separate lifecycle.

### 21.3 Work request

A work request assigns a task without changing location ownership unless a separate ownership-transfer command is approved.

---

## 22. Operational status, readiness and inspection

### 22.1 Separate fact dimensions

The system separates:

- requirement;
- timing/due/overdue;
- work/session/completion;
- issue/follow-up;
- inspection;
- readiness;
- freshness/confidence.

### 22.2 Readiness states

The architecture supports at least:

- ready;
- ready_with_follow_up;
- blocked_incomplete;
- blocked_issue;
- blocked_inspection;
- awaiting_inspection;
- not_required;
- unknown/conflict_review.

Exact policy values are approved through versioned readiness, severity, freshness and inspection policies.

### 22.3 Inspection

Inspection records named inspector, rubric revision, findings, result and append-only correction. No generic orphan score is authoritative.

### 22.4 Dashboard wording

Manager projections distinguish:

- current owner and reason;
- active cleaner;
- actual/last accepted cleaner;
- occurrence/status;
- last accepted completion;
- issues/tickets;
- readiness;
- inspection;
- freshness/confidence.

A timer color is never inspection readiness.

---

## 23. Employee product contract

### 23.1 Home

Normal Home contains only:

- Memphis Zoo Custodial;
- enrolled employee name;
- Schedule;
- Messages;
- Events;
- Feedback.

No weather, attendance, QR, Scanner, device ID, enrollment removal, diagnostics, permanent Refresh, bottom navigation or manager controls.

True identity/security failure uses a separate full-screen recovery state: `This phone needs a manager.`

### 23.2 Schedule

Employee Schedule answers only: `Your areas now`.

It may show:

- temporary lunch coverage until time;
- additional areas assigned;
- areas removed;
- `OPEN` only in employee-safe context if the employee needs to know;
- stale/offline freshness wording.

It does not show a walking route, “Current Assignment,” “Next Assignment,” “Next Stop,” or full-day optimization history.

### 23.3 Messages

Employee mode is direct recipient only unless explicitly approved otherwise:

`Messages → New → tap person → conversation`.

No employee group-creation complexity.

### 23.4 Events

Employee Events distinguishes:

- information only;
- manager review pending/no work instruction;
- approved work notice;
- cancelled/superseded.

Only approved requirements or ownership inputs generate imperative work language.

### 23.5 Feedback

Feedback is for app, phone and NFC confusion/failure. Operational issues use the correct location/work/message domain without adding Home buttons.

### 23.6 Error vocabulary

Employees do not see backend, HTTP, RPC, sync, retry, queue, credential, epoch, schema, release, GPS accuracy, device ID or dead-letter language.

---

## 24. Manager product contract

The Manager product includes capability-gated workflows for:

- Dashboard and readiness;
- static schedule source/import/versioning;
- exact exception preview/diff/publication;
- PTO/callout/lunch/CoverAll/OPEN/transfer/work request;
- Events and impact approval;
- Messenger and approved AI;
- inspections and analytics;
- issues/tickets;
- employee/position/phone lifecycle;
- guest workflow when enabled;
- feedback triage;
- manager access and trusted devices;
- Device Security;
- approved diagnostics, backup, rollback and release operations.

No broad “Reassign Day” may publish without exact preserved/moved/OPEN/downstream consequences.

---

## 25. Messenger contract

### 25.1 Identity and threads

Participant identity is server-derived. Thread type and participant set are canonical and versioned.

### 25.2 Loading and privacy

Selecting a thread clears prior presentation immediately and renders a loading state keyed to the new thread. Late responses are rejected by thread key. Zero frames may show prior content under a new recipient.

### 25.3 Outbox

Every send has stable operation ID, optimistic local evidence, idempotent server effect, bounded retry and poison isolation.

### 25.4 Visibility/hide/delete

Visibility is user-scoped, not fundamentally device-scoped. Device movement does not strand the user’s operation history.

A versioned Messenger policy decides:

- new-message reappearance;
- direct/group/Memphis behavior;
- membership changes;
- content purge versus thread/audit identity;
- receipt retention.

Offline hide/delete replays idempotently and never globally deletes another participant’s copy.

### 25.5 Receipt states

Ordinary message delivered/displayed/read/acknowledged states remain separate from operational notification presentation and work resolution.

**Gate:** `G-MSG-POLICY`.

---

## 26. Operational notification contract

### 26.1 Root identity

The root is a stable service occurrence or another registered operational episode. It is not status text, latest completion, current owner name or local notification ID.

### 26.2 Child intent and presentation group

Each operational child intent retains its own:

- episode/occurrence;
- recipient reason;
- owner revision;
- lifecycle and escalation.

A human presentation group is a separate object. Display/open/dismiss of the group does not automatically acknowledge, resolve or suppress every child.

### 26.3 Final recipient validation

Immediately before send:

- episode remains active;
- current status still requires notification;
- current owner/revision is correct;
- employee is eligible;
- device credential and assignment epoch are current;
- recipient capability is valid;
- authority set is current.

### 26.4 Receipt and acknowledgement identity

Receipt/acknowledgement binds:

- intent and presentation-group IDs;
- occurrence/episode;
- employee;
- device;
- credential;
- assignment epoch;
- authority set/generation;
- displayed timestamp;
- action.

Stale acknowledgement never suppresses a new recipient.

### 26.5 Presentation states

Separate:

- transported;
- device received;
- displayed;
- audio cycle completed;
- opened;
- dismissed;
- cancelled/superseded.

No presentation state resolves work.

### 26.6 Exact audio and queue

Employee cadence is exactly:

```text
chime
→ complete personalized speech
→ chime
→ identical complete speech
→ silence
```

One overlay is visible. Later alerts queue. No replay after navigation, foreground, wake, reconnect or polling.

Default architecture prohibits speech preemption. A future P0 emergency contract requires separate approval, deterministic interruption/recovery rules and physical proof.

### 26.7 Already-visible stale alert

When ownership/status/epoch changes after display:

- server emits durable supersession/cancellation;
- old phone revalidates and closes or replaces the overlay with approved “no longer assigned” wording;
- prior displayed evidence remains;
- new recipient intent is independent;
- stale old-phone acknowledgement cannot affect new intent or work.

### 26.8 Manager escalation

Escalation is independent from employee dismissal. Recipient resolution uses approved capability/shift/on-call policy with fallback and no-recipient incident behavior.

**Gates:** `G-NOTIF-ACK-001`, `G-NOTIF-GROUP`, `G-NOTIF-VISIBLE-REVOKE`, `G-NOTIF-P0`, `G-ESCALATION`.

---

## 27. Events and approved operational impacts

### 27.1 Event lifecycle

```text
source/import
→ candidate
→ validated revision
→ audience
→ published notice
→ optional impact proposal
→ named approval
→ service-requirement input
→ optional ownership compilation/publication
→ cancellation/supersession
```

Manual form, quick paste and spreadsheet/document import create candidates only.

### 27.2 No silent schedule mutation

Event save, edit, cancel, import, parser action, read or AI question cannot mutate schedule/ownership.

### 27.3 Cancellation/impact reversal

Cancellation or material change after approved impact creates explicit superseding operational commands. It defines:

- occurrences created;
- ownership publication;
- active sessions;
- displayed notifications;
- audience/recipient change;
- historical notice/impact retention.

It never deletes historical responsibility or accepted work.

### 27.4 Employee wording

Information is not instruction. Proposal is not approval. Only approved operational input produces work language.

---

## 28. Guest reporting and Marketing

Guest reporting remains disabled until approved.

If activated, architecture requires:

- location-bound public token/QR;
- no relationship to employee QR/NFC workflow;
- rate limiting and abuse handling;
- privacy/data minimization;
- named Marketing review;
- operations dispatch;
- current-owner routing after approval;
- rerouting on owner change;
- status/closure/redaction;
- retention and pattern analysis;
- no employee/device/internal data exposure.

Previously notified employee is historical delivery evidence, not current-owner truth.

**Gate:** `G-GUEST`.

---

## 29. Feedback and attachments

Employee Feedback handles app/phone/NFC help. Manager triage is a separate product/API.

Queued Feedback uses protected local outbox, stable operation ID and idempotent server effect.

Attachments require:

- encryption in transit/at rest;
- type/signature/size validation;
- malware/content handling;
- resumable/restart behavior;
- private access audit;
- local deletion only after server acknowledgement;
- retention/hold;
- lost-phone protection.

**Gate:** `G-FEEDBACK-ATTACHMENT`.

---

## 30. Contractor operations

The contractor model distinguishes:

- engagement;
- capacity slot;
- named worker or accountable vendor slot;
- assignment revision;
- secure-link delivery;
- acknowledgement/acceptance;
- actual work evidence.

Assignment does not equal delivered, accepted or completed.

If policy requires acceptance and it is absent, coverage remains `OPEN` or a manager explicitly reassigns.

Contractor links are revision-specific, expiring, revocable, no-store and least-privilege. English/Spanish content is versioned and approved.

**Gate:** `G-CONTRACTOR`.

---

## 31. AI, MCP, Moxie and controlled diagnostics

### 31.1 Executable tool registry

Every tool has:

- stable ID/schema version;
- read/propose/write class;
- allowed principals/capabilities/scopes;
- exact input/output schema;
- authority-set compatibility;
- source/freshness requirements;
- confirmation/second approval;
- idempotency;
- audit and rollback;
- sensitivity/retention;
- outage behavior.

Tools cannot be invented dynamically. Model text cannot broaden scope.

### 31.2 Human authorization

Confirmation belongs to authenticated human UI/authorization service, not natural-language model inference. Second approval is enforced outside the model.

### 31.3 Controlled repair

Proposal generation, exact proposal hash, approval, worker execution, tests, deployment, verification and rollback are separate evidence states. Browser-supplied arbitrary commands are prohibited.

### 31.4 Moxie

Moxie remains a policy gate. If retained, it is a separate private workspace with no implicit employee operational or write authority.

**Gates:** `G-TOOL-REGISTRY`, `G-AI-WRITE`, `G-MOXIE`.

---

## 32. Analytics, fairness and exports

### 32.1 Required facts

Analytics distinguishes:

- planned static owner;
- effective owner;
- active cleaner;
- actual cleaner;
- last accepted cleaner;
- service occurrence;
- workload/route/policy revisions;
- issue/ticket;
- inspection;
- GPS confidence;
- migration confidence;
- correction/dispute state.

### 32.2 Structural anti-misuse

Approved analytical projections enforce:

- minimum samples;
- comparable purpose/window/location difficulty;
- ownership duration and transfer context;
- offline-delay handling;
- migrated-confidence exclusions;
- one-point/one-inspection suppression;
- correction/dispute annotations;
- purpose-bound access;
- export redaction.

The system does not generate automatic disciplinary conclusions or secret rankings.

### 32.3 Exports

Exports are purpose-bound, capability-gated, redacted, watermarked, time-bounded and audited. Export retention and holds are explicit.

**Gate:** `G-ANALYTICS-POLICY`.

---

## 33. Security architecture

Required outputs for later design include:

- principal/credential/session/grant registries;
- authorization-decision service;
- actor snapshots;
- service-principal registry;
- table/view/function/trigger/cron/API/tool grant manifest;
- RLS and FORCE RLS policy;
- pinned privileged search paths;
- revoked broad execution;
- service-role mediation and actor propagation;
- secrets classification and log redaction;
- backup key custody;
- break-glass and dual control;
- security-event retention;
- revocation propagation.

RLS enabled with no policy is not, by itself, proof of safety or vulnerability. Exact grants and privileged paths control the conclusion.

Every product projection is independently authorized and redacted; canonical source breadth does not broaden product access.

---

## 34. Retention, holds and privacy

A versioned information-class policy defines for each class:

- archive;
- purge/redaction;
- hold eligibility;
- authorized roles;
- export behavior;
- backup treatment;
- restore behavior;
- proof.

At minimum it covers:

- identities/lifecycle;
- schedules/ownership;
- sessions/completions;
- inspections/corrections;
- issues/tickets;
- Messenger content versus thread/operation evidence;
- notification presentation;
- Events source/revision/notice;
- guest contact/photo;
- Feedback attachments;
- raw GPS versus summary;
- AI prompts/actions;
- diagnostics;
- credentials/tokens;
- security logs;
- exports;
- backups.

Holds propagate across database, object storage, exports and backups. A restored backup containing previously purged data triggers reconciliation/redaction before service.

**Gate:** `G-RETENTION`.

---

## 35. Backup, disaster recovery and availability

### 35.1 Complete restore bundle

A restore bundle binds:

- database backup;
- object storage;
- schema/migration manifest;
- evidence and authority-set manifests;
- backend/source release;
- APK/release artifacts;
- Firebase/channel configuration;
- tag registry;
- encryption/signing key versions;
- worker queue/lease state;
- push-registration reconciliation;
- device snapshot compatibility;
- retention/hold state;
- external provider side effects;
- monitoring configuration.

Database backup alone is not restore proof.

### 35.2 Restore process

Restore requires:

- compatible bundle validation;
- dual control where policy requires;
- clean rebuild/schema fingerprint;
- authority-set activation protocol;
- queue/provider dedupe;
- device/client compatibility;
- post-restore validation and incident audit.

### 35.3 SLO and dependency policy

Before design, provisional targets exist for local response, NFC-to-Start, backend response, notification delivery, Dashboard freshness, offline capacity, RPO, RTO and restore frequency.

Each dependency has timeout, retry class, circuit breaker, fallback/freshness wording, queue behavior, alerting and recovery.

Free hosting is not a reliability contract.

**Gates:** `G-RESTORE`, `G-SLO`.

---

## 36. Migration and legacy retirement

### 36.1 Migration sequence

1. freeze source/schema/backend/release/evidence;
2. read-only export and digest;
3. approve record envelope and authority-set protocol;
4. complete writer/reader/worker/trigger/cron/API/tool graph;
5. close source/policy gates;
6. design isolated canonical foundations;
7. independently audit schema/security/migration;
8. migrate history with confidence classes;
9. build canonical projections;
10. shadow compare every consumer;
11. prepare complete authority set;
12. drain/fence legacy writers/workers;
13. activate through protected protocol;
14. verify all consumers and canaries;
15. retire compatibility through manifest;
16. preserve complete rollback.

### 36.2 Migration confidence

Historical assertions are:

- source-proven exact;
- deterministically reconstructed;
- inferred with explicit confidence/reason;
- conflicting/unresolved;
- intentionally not reconstructed.

Low-confidence responsibility is excluded from personnel use by default.

### 36.3 Machine-enforced retirement manifest

Every legacy object records:

- exact identity/signature/path;
- definition digest;
- type and authority classification;
- callers, grants, trigger/cron/API/tool links;
- replacement;
- disable/revoke action;
- retirement authority set;
- migration-only state;
- rollback treatment;
- archive/delete policy;
- owner/deadline;
- automated proof.

Release admission fails on an unexpected unregistered writer or resolver.

### 36.4 External artifacts

All generated SQL/data artifacts outside admitted repository/release sources are inventoried. Unapproved artifacts are quarantined and cannot be manually executed in production.

`memphis_zoo_scheduler_static_seed_first_pass.sql` is quarantined evidence, not migration authority.

### 36.5 Current function security

Every surviving privileged function/trigger receives explicit search path, owner, execute grants, actor propagation and audit. Current mutable search-path warnings cannot be inherited without decision.

**Gates:** `G-RETIRE-001`, `G-MIG-EXTERNAL-ARTIFACTS`.

---

## 37. Release identity and validation invalidation

### 37.1 Exact release tuple

Release identity binds:

- source commit;
- lockfiles/toolchains;
- generated assets and manifest;
- backend commit/API contract;
- migration manifest and schema fingerprint;
- authority-set ID/generation;
- Android source/native graph;
- APK hash/package/signer/versionCode;
- backup/transfer denial;
- Firebase/channel configuration;
- Fully Kiosk configuration hash;
- Android OS/build fingerprint;
- NFC tag-registry revision;
- local-store version and snapshot-key version;
- physical fixture version;
- device/KIOSK identity;
- operator, recordings/logs and rollback result.

### 37.2 Validation invalidation

Any material change to a bound item invalidates affected green evidence. Historical pass/final-gate rows are never current proof after source/schema/configuration/physical changes.

### 37.3 Existing controls to retain

- package `org.memphiszoo.custodial`;
- Build 22 rollback;
- minimum next versionCode 23;
- signer certificate/public-key pinning;
- native-vault and manifest/DEX verification;
- backup denial;
- clean-source requirement;
- runtime hashes;
- producer and independent consumer admission.

---

## 38. Physical acceptance

Physical evidence is bound to exact release tuple and configuration.

Required matrices cover:

### 38.1 Containment

Device Owner, Single App, Home/Recents blocked, launcher inaccessible, reboot return and lost-phone quarantine.

### 38.2 Home/navigation/accessibility

Only six approved Home elements, all Back paths, long names, 200% text, gloves, hearing alternative, non-swipe alternative and no QR/admin/diagnostics.

### 38.3 NFC

Lock, every employee screen, active timer/draft, cold/warm, reboot, sleep/wake, process restoration, offline/reconnect, duplicate, unknown/revoked/old tag.

### 38.4 Sessions/offline

Restroom/exhibit, ownership change, app upgrade, device reassignment, credential revoke, exactly-once offline, storage limit and conflict review.

### 38.5 Notifications

Exact two cycles, identical speech, silence, no OS duplicate, one overlay, grouping, queue, durable acknowledgement, old-owner visible cancellation and independent escalation.

### 38.6 Messenger/Events/Feedback/GPS

Recipient isolation, outbox, hide/delete/reappearance, keyboard/performance/privacy, Event cancellation, Feedback attachment/offline, GPS calibration/permission/battery/no tracking outside active session.

### 38.7 Rollback and Karen

Pending work preserved, Build 22 compatibility, complete authority set restored, no stale alerts/cross-employee attribution, realistic training, no rescue hints and approved pass threshold.

**Gate:** `G-PHYSICAL-ACCEPTANCE`.

---

## 39. Testing doctrine

Tests are classified as:

- unit;
- property/model;
- integration;
- browser;
- Android instrumentation;
- generated-runtime/APK;
- release admission;
- physical-only;
- source-string/historical.

Source-string tests cannot prove packaged behavior. Browser mocks cannot prove Fully Kiosk or NFC. A hash can prove bytes while semantics remain wrong.

Required architecture-level fixture families include:

- record envelope/version/replay;
- authority-set activation/fault injection;
- principal/grant/revocation/confused deputy;
- location rename/split/merge/tag transition;
- schedule/9:45/lunch/one-zero staff/OPEN/cross-midnight;
- occurrence concurrency/correction/next-cycle;
- session/offline/reboot/reassignment/revocation;
- notification grouping/visible supersession/ack/escalation;
- Messenger visibility/outbox/delete/reappearance;
- Event cancellation/impact reversal;
- retention/hold/restore;
- retirement-manifest and no-unregistered-authority;
- release tuple and validation invalidation.

Production people and policies are not mutable test fixtures. Synthetic identities are separately marked and ineligible for production operations.

---

## 40. Open research and policy gates

### 40.1 Source/data/field research before policy decisions

- exact schedule source and provenance;
- current roster/shifts and vacancies;
- active locations/tags/Elephant Trunk/reminder groups;
- person/code-specific functions and accommodations;
- service frequency/workload/walking time/routes;
- actual schedule writer/resolver graph and grants;
- NFC payloads and Fully Kiosk configuration;
- GPS calibration and battery;
- retention/object/backup behavior;
- manager escalation/on-call chain;
- current Messenger visibility/retention behavior;
- external seed/migration artifacts.

### 40.2 Genuine Eric/management policy gates

- approved static source/effective date and disputed shifts;
- position versus person-bound rules;
- lunch ownership;
- operating hours/September 14/split/after-hours/cross-midnight;
- `OPEN` response/escalation;
- workload/frequency/late-day policy after research;
- readiness/severity/inspection/reopen;
- contractor identity/acceptance/history;
- GPS use/retention/dispute;
- manager capability tiers and on-call;
- Messenger archive/reappearance/Memphis behavior;
- Moxie and AI write authority;
- guest activation/data/privacy;
- retention/holds and export authority;
- analytics use/discipline/dispute;
- SLO/RPO/RTO/budget;
- Karen/pilot threshold;
- Build 22 retirement authority.

---

## 41. Architecture exit gates

V4.2 may authorize isolated schema/component design only when:

1. CAP-001–CAP-252 trace is complete.
2. Evidence manifest is frozen and verified.
3. Cross-domain record registry is complete.
4. Unknown record versions fail closed.
5. Authority-set distributed protocol is complete.
6. Old/new clients, backend, schema and policy compatibility are bounded.
7. Canonical principal/grant/authorization model is complete.
8. Confidential accommodation effect and justification are separated.
9. Occurrence concurrency/correction/next-cycle semantics are deterministic.
10. Location transition active-work semantics are complete.
11. Legacy authority inventory and retirement manifest are complete.
12. Surviving privileged functions have explicit search paths and grants.
13. Static source/Sunday/shifts/positions/lunch/hours/OPEN policies are approved or structurally bounded.
14. Workload/frequency/route research is sufficient.
15. Readiness/severity/inspection policies are approved.
16. Contractor policy is approved.
17. Notification grouping, visible supersession, acknowledgement and P0 behavior are complete.
18. Offline reboot/time/key/reassignment semantics are complete.
19. Messenger/Event/Feedback policies are complete.
20. AI/MCP/Moxie/diagnostic authority is enforceable.
21. Retention/holds/analytics/restore bundle are complete.
22. RPO/RTO/SLO assumptions are approved.
23. Complete automated fixture plan exists.
24. Physical acceptance plan is frozen.
25. Internal adversarial audit closes all BLOCKER/HIGH findings.
26. Four independent architecture re-audits return no unresolved architecture blocker.
27. No later designer must invent foundational semantics.
28. Build 22 rollback remains preserved.

---

## 42. Final architecture disposition

V4.2 retains v4.1’s whole-system direction and closes its accepted cross-domain architecture gaps.

It does not declare open operating values solved. It makes them explicit, governed and fail-closed.

Current authorization remains:

- architecture replan/audit: **GO**;
- final architecture approval: **NO-GO pending audits and gates**;
- schema/component design: **NO-GO**;
- implementation: **NO-GO**;
- migration: **NO-GO**;
- APK/phone/fleet/release: **NO-GO**.