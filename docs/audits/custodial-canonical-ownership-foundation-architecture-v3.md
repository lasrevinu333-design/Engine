# Memphis Zoo Custodial System — Canonical Ownership Foundation Architecture v3

**Status:** Complete foundation replan for independent audit; implementation is not authorized  
**Plan revision:** 3.0  
**Prepared:** 2026-08-03  
**Supersedes for future planning:** `custodial-canonical-ownership-architecture-plan.md` revision 2.0  
**Companion audit:** `custodial-canonical-ownership-architecture-v2-adversarial-audit.md`  
**Frontend repository:** `lasrevinu333-design/Engine`  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Backend repository reviewed:** `lasrevinu333-design/memphis-zoo-mcp`  
**Backend source reviewed:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Production verification:** SELECT-only Supabase queries and deployed-function inspection  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Purpose

The complete custodial system needs one defensible answer to:

> Who is responsible for this exact location at this exact time, and why?

That answer must be identical wherever it is used:

- employee Schedule;
- manager Schedule;
- Dashboard;
- due-soon and overdue delivery;
- guest issue routing;
- Memphis AI;
- workload and accountability analytics;
- historical review;
- future manager map overlays.

The original program has a strong operating concept, but current responsibility is split among static group templates, Sunday-only location templates, mutable daily rows, local employee-page inheritance, all-day push joins, and duplicate alert pipelines.

Revision 3 replaces those competing authorities from the foundation. It preserves the real operating intent:

- a premade static weekly schedule is normal policy;
- a normal day is not re-optimized simply because software can produce a different answer;
- employees choose their own practical cleaning order;
- 9:45 changes the approved restroom responsibility without needlessly moving non-restroom work;
- lunch coverage is exclusive and temporary;
- areas transfer as employees leave;
- absence and CoverAll changes are minimal, explainable and reviewed;
- actual cleaning performance remains separate from responsibility;
- no employee is blamed from a schedule they did not actually own;
- every release remains reversible and evidence-based.

---

## 2. Current truth that the replacement must correct

Read-only research established the following.

### 2.1 Competing static authorities

- 339 active group coverage-template rows cover all seven weekdays.
- 135 active location-template rows cover Sunday only.
- the Sunday rows predate the current PDF-imported group schedule;
- only 43 exactly match the current group template;
- dozens differ by owner, time or purpose.

The Sunday location rows are migration evidence. They cannot remain an independent resolver.

### 2.2 Group-level truth is insufficient

Seven active groups contain both non-restroom and restroom locations:

- China;
- East Admin;
- Event Center;
- Expo;
- Teton;
- West Admin;
- Zambezi.

A group row cannot move only restrooms at 9:45 while preserving exhibit/building ownership. The authoritative unit must be an individual operational location.

### 2.3 Lunch and inheritance are currently contradictory

- lunch coverage is added beside the original owner instead of replacing it;
- shift-end inheritance is calculated only inside one employee read function;
- other consumers can report OPEN while an employee phone reports ownership;
- one remaining employee can receive the synthetic label `All Locations` instead of the actual locations.

### 2.4 Current CoverAll publication is destructive

The current system models `COVERALL_01` through `COVERALL_04` as employees and can force whole-day regeneration, restore static owners, rebalance assignments, rebalance restrooms and rebuild lunch coverage.

CoverAll must become a date-specific contractor-capacity exception, not a trigger to reinvent the complete day.

### 2.5 Current alert resolution can be false

Any inserted `scan_events` row currently clears active legacy scan-alert rows for that location. A tap or cleaning start can therefore suppress manager escalation before completion.

Only an authoritative acknowledged completion that changes the location status may resolve an episode.

### 2.6 Current native location pushes can be stale

The native worker revalidates device credentials and assignment epoch before provider delivery, but it does not revalidate the current location status and canonical effective owner immediately before sending.

The replacement must revalidate both.

---

## 3. Non-negotiable principles

1. **One authority.** Every consumer reads the same published effective-ownership revision.
2. **Static first.** A published static schedule is normal policy.
3. **Exception only.** Absence, contractor capacity, lunch, departure and manager action alter only affected locations and intervals.
4. **Location-level truth.** Groups are authoring/display tools, never the final responsibility unit.
5. **Input facts are not compiler output.** Authoritative changes and derived transitions are separate records.
6. **Immutable history.** Published policy, baselines, inputs, transitions and ownership revisions are never rewritten by reads.
7. **No overlap.** One location cannot have two published effective owners at the same instant.
8. **Explicit OPEN.** Required coverage without an eligible owner is OPEN, not a fabricated assignment.
9. **Not required is different from OPEN.** Outside an approved operational-requirement interval, no owner is required.
10. **Performer is not owner.** Cleaning evidence never silently changes responsibility.
11. **Read paths never write.** Schedule, Dashboard, Messenger, AI and reporting reads cannot generate or mutate ownership.
12. **Determinism.** Identical canonical inputs produce the identical logical result and input hash.
13. **Idempotency.** Repeating an approved input cannot create duplicate responsibility, transitions or delivery.
14. **Atomic publication.** Consumers never see a half-published ownership revision.
15. **Security by boundary.** Employee, viewer, contractor and public clients never receive direct schedule-write authority.
16. **Fail closed.** Conflicts block publication; row order never decides responsibility.
17. **No permanent compatibility patch.** Shadow comparison is temporary; the final system retires competing authorities.
18. **No irreversible release leap.** Build 22 remains rollback until a later source, APK and field release is admitted.

---

## 4. Required terminology

### 4.1 Source artifact

The exact approved schedule, policy or manager input from which normalized records are created, stored with a digest and provenance.

### 4.2 Static schedule version

An immutable approved weekly policy containing shifts, lunches, phases, normal coverage, restrictions and source provenance.

### 4.3 Schedule subject

A stable responsibility target that may be:

- a schedule position;
- a permanent employee identity for an explicitly person-bound rule;
- a contractor engagement;
- OPEN.

### 4.4 Schedule position

A timeless staffing slot in the static schedule. An effective-dated staffing assignment resolves that position to the current employee. A departed employee's history is never renamed into a replacement hire.

### 4.5 Operational requirement interval

A location-specific interval during which responsibility is required. It may begin before public opening, extend for an approved event or after-hours task, or end at an approved closure.

### 4.6 Daily baseline

The immutable location-level schedule compiled once from the applicable static version and operational requirement policy before date-specific changes.

### 4.7 Authoritative change input

An append-only fact or manager command that can affect a date, such as:

- absence/PTO;
- contractor engagement;
- employee eligibility change;
- event impact;
- operating-policy revision;
- ownership transfer;
- emergency override;
- explicit correction.

### 4.8 Derived transition record

A deterministic compiler output explaining a responsibility boundary, such as:

- static phase change at 9:45;
- lunch start/end;
- shift-end inheritance;
- restoration after an override;
- OPEN or not-required transition.

Derived transitions are evidence from one compilation revision. They are not hidden inputs to later compilation.

### 4.9 Effective ownership interval

The non-overlapping published interval stating who owns one location, for what purpose, under which revision and controlling input/transition.

### 4.10 Active cleaner

The employee currently checked into the NFC cleaning session. This may differ from the effective owner.

### 4.11 Status episode

One durable due-soon/overdue lifecycle for a location, based on a specific accepted completion state and resolved only by a later authoritative completion or explicit administrative correction.

### 4.12 Notification intent

A durable recipient-specific delivery instruction created from a schedule change, message, event or status episode. It is transport evidence, not operational truth.

---

## 5. Authoritative architecture

```text
Versioned source artifacts
        ↓
Published static schedule version
        ↓
Location-specific operational requirement intervals
        ↓
Immutable location-level daily baseline
        ↓
Append-only authoritative change inputs
        ↓
Deterministic candidate compilation
        ↓
Derived transition records
        ↓
Validated effective ownership intervals
        ↓
Atomic publication pointer + transactional outbox
        ↓
Canonical read APIs and one delivery pipeline
```

Actual cleaning sessions, GPS observations, notifications and device registrations attach to this foundation but never redefine it.

---

## 6. Authoritative data model

Names are conceptual until schema review. The semantic boundaries are mandatory.

### 6.1 `custodial_source_artifacts`

Stores provenance for imported schedules and policy sources.

Required fields:

- artifact ID;
- artifact type;
- human label;
- source location/reference;
- SHA-256;
- normalized content fingerprint;
- uploaded/imported actor;
- created timestamp;
- notes.

The actual source bytes remain in the approved private evidence store or repository according to policy.

### 6.2 `custodial_schedule_versions`

One immutable weekly policy version.

Required fields:

- schedule version ID;
- version label;
- source artifact ID;
- effective start/end dates;
- Memphis timezone;
- previous version ID;
- state: `draft`, `validated`, `approved`, `published`, `retired`;
- created/validated/approved/published actors and timestamps;
- normalized input hash;
- policy notes.

Requirements:

- two published versions cannot ambiguously apply to the same service date;
- publication freezes the normalized rules and membership snapshot;
- changing normal policy creates a new version;
- historical dates retain their original version.

### 6.3 `custodial_workforce_subjects`

Stable subject registry.

Subject types:

- `position`;
- `employee`;
- `contractor_engagement`.

Required fields:

- subject ID/type;
- stable subject code;
- display label;
- active/effective interval;
- source identity reference;
- audit metadata.

OPEN and not-required are responsibility statuses, not reusable person records.

### 6.4 `custodial_schedule_positions`

Timeless positions used by the normal schedule where appropriate.

Required fields:

- position ID/code/name;
- normal shift/role context;
- required capabilities/restrictions;
- active/effective interval;
- notes.

The initial migration may create reviewed positions from the current named schedule. It must not silently infer permanent role names from historical employee names.

### 6.5 `custodial_position_assignments`

Effective-dated position-to-employee assignments.

Required fields:

- position ID;
- employee ID;
- effective start/end;
- state;
- assignment actor/source;
- reason;
- audit timestamps.

Rules:

- no overlapping active employee assignment for one position;
- a replacement receives a new employee ID;
- a vacant position remains vacant and triggers reviewed exception/Open handling;
- historical Michael or Daniel records remain attached to their original work.

### 6.6 `custodial_schedule_shift_rules`

Version-bound normal shift and lunch policy.

Required fields:

- schedule version;
- weekday;
- schedule subject;
- shift start/end;
- lunch start/end;
- capability/restriction requirements;
- source row reference;
- notes.

### 6.7 `custodial_schedule_coverage_rules`

Version-bound normal responsibility authoring.

Required fields:

- schedule version;
- weekday;
- authoring scope: group or location;
- group/location ID;
- static phase;
- coverage start/end;
- normal schedule subject;
- responsibility purpose;
- load points;
- restrictions;
- source row reference;
- notes.

Groups are expanded before publication.

### 6.8 `custodial_schedule_membership_snapshots`

Version-bound snapshot of group-to-location membership and relevant location metadata.

Required fields:

- schedule version;
- group ID/code/name;
- location ID/code/name;
- location type/form type;
- active/eligibility state at publication;
- snapshot hash;
- source reference.

Later membership edits cannot rewrite historical responsibility.

### 6.9 `custodial_operating_policy_versions`

Versioned date-range policy for public hours, closures and default coverage boundaries.

Required fields:

- operating policy revision;
- effective date range;
- weekday/date rules;
- open/close times;
- closure exceptions;
- actor/source;
- state and timestamps.

The September 14 seasonal closing change must be represented by an authoritative policy revision and fixture, not an unconfigured fallback.

### 6.10 `custodial_operational_requirement_intervals`

Location-level intervals during which an owner is required.

Sources may include:

- morning static coverage before public opening;
- public operating policy;
- approved event impact;
- explicit after-hours task;
- closure/maintenance exception;
- manager requirement.

Required fields:

- service date;
- location;
- required start/end;
- reason/source;
- operating-policy revision;
- event/manager input reference;
- compilation revision.

Outside these intervals the state is `not_required`. Inside them, no eligible owner means `open`.

### 6.11 `custodial_daily_baselines`

One immutable baseline per service date and full normalized input identity.

Required fields:

- baseline ID;
- service date;
- schedule version;
- membership snapshot hash;
- operating-policy revision;
- location-metadata snapshot hash;
- schedule-subject resolution policy version;
- compiler version;
- canonical input hash;
- state;
- validation summary;
- created/published actor and timestamp.

Normal baseline generation is create-if-absent. A read never updates an existing baseline.

### 6.12 `custodial_daily_baseline_intervals`

Location-level normal policy before date-specific change inputs.

Required fields:

- baseline interval ID;
- baseline ID;
- location/display group;
- `[start,end)` range;
- schedule subject;
- resolved employee when valid;
- responsibility purpose;
- source coverage rule;
- load points;
- requirement status;
- source snapshots.

The baseline may contain multiple non-overlapping static phases for a location, including a 9:45 boundary.

### 6.13 `custodial_ownership_change_inputs`

Append-only authoritative facts and commands.

Input types:

- absence/PTO;
- contractor engagement/capacity;
- employee or position eligibility change;
- approved event impact;
- operating-requirement change;
- explicit ownership transfer;
- emergency override;
- explicit correction/cancellation.

Required fields:

- input ID;
- stable idempotency key;
- service date/effective range;
- affected subject and locations;
- prior/new owner when explicitly commanded;
- source record and source type;
- reason code;
- actor/manager identity;
- state: `draft`, `validated`, `published`, `cancelled`, `superseded`;
- supersedes/superseded-by;
- created/published timestamps;
- audit metadata.

Lunch and ordinary shift end are not duplicated as manager inputs when they are already deterministic static policy.

### 6.14 `custodial_ownership_compilation_runs`

One candidate or published ownership revision.

Required fields:

- revision ID;
- service date;
- baseline ID;
- prior published revision;
- compiler version;
- canonical input snapshot/hash;
- state: `building`, `validated`, `rejected`, `published`, `superseded`, `rolled_back`;
- conflict/OPEN counts;
- exact diff summary;
- validation result;
- created/published actor and timestamps.

### 6.15 `custodial_ownership_transition_records`

Compiler-generated immutable transition evidence.

Transition types include:

- static phase activation;
- lunch transfer start/end;
- absence replacement result;
- contractor assignment result;
- shift-end inheritance;
- override start/end restoration;
- OPEN start/end;
- not-required boundary;
- correction/supersession.

Required fields:

- deterministic transition key;
- revision;
- timestamp/range;
- location;
- prior/new responsibility state;
- controlling change input when applicable;
- reason code;
- compiler evidence.

These rows are outputs only and never become implicit inputs.

### 6.16 `custodial_effective_ownership_intervals`

The single operational responsibility authority.

Required fields:

- revision ID;
- service date;
- location and display group;
- `tstzrange` `[effective_start,effective_end)`;
- status: `assigned_employee`, `assigned_contractor`, `open`, `not_required`;
- owner subject;
- resolved employee or contractor engagement;
- display snapshot;
- responsibility purpose;
- baseline interval;
- controlling input;
- derived transition;
- previous owner;
- reason code;
- schedule/operating/compiler versions;
- published timestamp.

Database rules:

- no overlapping published ranges for one location/revision;
- assigned rows require exactly one eligible owner;
- OPEN/not-required rows prohibit owner identity;
- every required location instant resolves assigned or OPEN;
- every non-required instant resolves not-required or has no interval by the versioned contract;
- range start precedes end;
- a revision with conflicts cannot publish.

### 6.17 `custodial_ownership_publications`

Atomic current-revision pointer and publication audit.

Required fields:

- service date primary identity;
- current revision ID;
- prior revision ID;
- publication transaction/input hash;
- published actor/time;
- rollback/supersession state;
- exact diff digest.

Only one current publication may exist per service date.

### 6.18 `custodial_location_status_episodes`

Durable due-soon/overdue operational episode.

Required fields:

- episode ID/logical key;
- location;
- completion basis;
- due-soon and overdue timestamps;
- current status;
- ownership revision at each routing decision;
- work-started timestamp and bounded suppression state;
- authoritative resolving completion;
- resolved/superseded timestamps and reason;
- employee and manager intent references;
- audit metadata.

A scan receipt or start cannot resolve the episode.

### 6.19 `custodial_notification_intents` and outbox

Recipient-specific delivery instructions created from operational events.

Required fields:

- stable logical intent key;
- root source event/episode;
- recipient subject;
- employee/device assignment epoch when applicable;
- ownership revision;
- route;
- display/speech copy;
- delivery channel;
- state and retry classification;
- received/displayed/first-cycle/second-cycle/opened/dismissed/acknowledged timestamps;
- superseded/resolved reason;
- provider evidence;
- audit metadata.

One root episode may supersede one recipient intent and create another after ownership changes. The root operational episode remains one event.

### 6.20 Contractor/CoverAll model

Required concepts:

- contractor organization;
- reusable capacity slot;
- date-specific engagement;
- optional named worker;
- shift/capacity window;
- secure expiring assignment-link authority;
- exact location-level contractor intervals;
- optional dedicated managed contractor device.

Current pseudo-employees may be retained only as migration aliases. They do not remain ordinary employee identities.

---

## 7. Security and authorization model

### 7.1 Database controls

All new authority tables require:

- RLS enabled and forced;
- no direct privileges for `anon` or ordinary `authenticated` roles;
- direct mutation limited to controlled server/service functions;
- immutable published rows protected from update/delete outside explicit supersession/rollback functions;
- public execute revoked on security-definer functions;
- locked `search_path`;
- stable idempotency and actor metadata for every write.

### 7.2 Manager authority

Named manager write authorization is required to:

- import/validate/approve/publish schedule versions;
- publish absences/contractor engagements;
- issue ownership transfers or emergency overrides;
- publish/rollback ownership revisions;
- issue/revoke contractor links.

Preview and publish are distinct actions. No confirmation theater is added to ordinary employee work; manager publication remains an intentional controlled action.

### 7.3 Employee device authority

An employee device may read only:

- the enrolled employee identity;
- that employee's current/future necessary schedule;
- relevant notifications and acknowledgement endpoints;
- its own active cleaning/GPS state.

It cannot read credentials, mutate static policy, publish ownership or remove enrollment.

### 7.4 Viewer authority

Read Only remains limited to approved Dashboard and Events data. It has no schedule mutation, employee administration or Messenger authority.

### 7.5 Contractor authority

A contractor assignment link is:

- scoped to one date and slot/engagement;
- expiring and revocable;
- no-store/no-referrer;
- read-only;
- unable to enumerate employees or other slots;
- unable to mutate ownership.

---

## 8. Time and interval semantics

- schedule policy is authored in `America/Chicago` local date/time;
- publication converts validated local boundaries to `timestamptz`;
- all ranges are half-open `[start,end)`;
- nonexistent or ambiguous daylight-saving local times fail validation unless an explicit policy resolves them;
- service date is stored separately from timestamps;
- cross-midnight approved intervals retain the originating service-date contract;
- operating and event policy can extend requirement beyond public close when explicitly approved;
- identical normalized local policy and timezone version produce the same input hash.

---

## 9. Deterministic compiler and publication

### 9.1 Publication lock and snapshot

For one service date:

1. acquire a transaction/advisory lock;
2. select the applicable published schedule and operating-policy versions;
3. freeze a canonical input snapshot;
4. return the existing revision when the input hash already has a valid publication.

### 9.2 Stage 0 — operational requirement

Compile where responsibility is required for each location.

Outside a required interval: `not_required`.

Inside a required interval without an eligible owner: `open`.

### 9.3 Stage 1 — static location baseline

- expand approved group rules through the versioned membership snapshot;
- preserve individual-location rules;
- split static phases, including the approved 9:45 boundary;
- resolve schedule positions through effective staffing assignments;
- retain exact source references.

The phase selector is not a daily optimizer.

### 9.4 Stage 2 — hard eligibility

For every candidate interval verify:

- employee/contractor subject is effective;
- schedule eligibility;
- shift covers the interval;
- restrictions/capabilities;
- position assignment is valid;
- no explicit exclusion.

Ineligible candidates are removed, not merely penalized.

### 9.5 Stage 3 — date-specific capacity adjustment

Apply published absence, PTO, contractor and eligibility inputs.

Replacement order:

1. hard eligibility;
2. preserve all unaffected static ownership;
3. minimum moved locations;
4. route/proximity coherence;
5. workload balance;
6. deterministic reviewed tie-breaker.

The solver changes only invalid/uncovered or explicitly selected locations. It never regenerates the entire normal day merely because CoverAll was added.

### 9.6 Stage 4 — bounded scheduled transfers

Apply lunch and other approved bounded temporary coverage.

A lunch transfer is exclusive. The employee on lunch does not remain a simultaneous current owner.

At the end, resolve the then-current lower layer rather than restoring a captured stale owner.

### 9.7 Stage 5 — shift-end inheritance

At an owner's departure:

- close that owner's required intervals;
- assign exact remaining locations to eligible remaining staff/contractor or OPEN;
- use minimum movement, proximity and workload policy;
- never emit `All Locations`;
- preserve all unaffected owners.

If shift end occurs during lunch, lunch end resolves to inheritance/OPEN rather than the departed owner.

### 9.8 Stage 6 — explicit manager/emergency ownership overrides

Apply valid explicit ownership commands last.

An override expiration resolves the current lower layer at that later timestamp.

A one-time request to perform one cleaning is not an ownership override and is represented as a work request/task instead.

### 9.9 Normalize and validate

- merge adjacent identical intervals only when provenance remains reconstructable;
- reject overlaps;
- reject uncovered required intervals without explicit OPEN;
- reject invalid owner subjects;
- validate mixed-group location behavior;
- calculate exact old-to-new diff;
- produce deterministic transition records.

### 9.10 Atomic publish and transactional outbox

Within one transaction:

1. store candidate compilation and intervals;
2. store validation evidence and transition records;
3. create/supersede notification intents from the exact diff;
4. atomically advance the service-date publication pointer;
5. mark prior revision superseded;
6. commit.

Delivery workers can claim outbox work only after commit. Any pre-commit failure exposes none of the candidate revision.

---

## 10. Required scenario semantics

### 10.1 Normal day

- create the baseline once;
- publish the same effective result when no change input exists;
- page opens and API reads perform zero writes;
- unchanged inputs return the existing revision.

### 10.2 9:45 and lunch overlap

Example: lunch is active from 9:00–10:00.

- the lower static phase changes at 9:45;
- lunch remains the active upper layer until 10:00;
- at 10:00 responsibility resolves to the post-9:45 owner;
- no duplicate owner exists.

### 10.3 Absence

- affected position/employee becomes ineligible for the interval;
- only their invalid/uncovered locations are reassigned;
- all unaffected static ownership remains unchanged;
- preview and publish show exact moves and OPEN outcomes.

### 10.4 CoverAll

```text
Manager creates date-specific engagement
→ selects capacity/shift and optional named worker
→ system previews exact location moves
→ manager approves the exact location-level exception
→ ownership revision publishes atomically
→ secure contractor assignment link is issued
```

No forced whole-day regeneration occurs.

### 10.5 Employee departure before 9:45

- morning intervals close at departure;
- remaining morning locations inherit or become OPEN;
- at 9:45 the approved static phase is resolved against current eligibility;
- departed employee is never restored.

### 10.6 Two, one or zero employees remain

- exact locations are assigned to eligible remaining employees;
- one employee still receives individual locations, never `All Locations`;
- when nobody eligible remains during a required interval, OPEN is published;
- employee phones receive no post-shift ownership assignment;
- manager receives uncovered-coverage evidence.

### 10.7 Seasonal close and after-hours events

- versioned operating policy defines normal public boundaries;
- static pre-open work remains required according to schedule;
- approved event/after-hours inputs may extend requirement for affected locations;
- closure or end of event changes the requirement interval;
- no unconfigured 6:00 PM fallback silently overrides September 14 policy.

### 10.8 Employee lifecycle

- departure inactivates operational eligibility, not identity history;
- replacement creates a new employee;
- position assignment changes effective-dated staffing;
- phone assignment changes separately and rotates assignment epoch;
- the static schedule version changes only when normal policy changes, not merely to rename history.

The audit itself does not change Michael McWright or Daniel Morgan.

---

## 11. Canonical resolver/API contracts

All contracts are versioned and read-only.

### 11.1 Location current/historical resolver

Input:

- location ID/code;
- timestamp or service date/time;
- optional requested publication revision for audited replay.

Output:

- service date/resolved timestamp;
- location/display group;
- requirement state;
- responsibility status;
- effective owner subject and display snapshot;
- effective start/end;
- purpose/reason;
- schedule, operating, baseline and ownership revisions;
- controlling input/transition;
- device assignment epoch when relevant.

### 11.2 Employee Schedule

Returns only locations currently owned by the enrolled employee, grouped for readability after resolution.

Optional display categories:

- normal areas;
- lunch coverage;
- inherited areas;
- manager transfer.

It never calculates inheritance locally, shows another employee's ownership, or mutates schedule state.

### 11.3 Manager day view

Shows separately:

- static normal owner/position;
- effective current/future owner;
- transition reason;
- OPEN intervals;
- active cleaner;
- last cleaner/completion;
- current ownership revision;
- preview/rollback evidence.

### 11.4 Dashboard

Separate fields:

- Current owner;
- Responsibility reason;
- Cleaning now by;
- Last cleaned by;
- Last completed at;
- Due/overdue state;
- Ticket state.

### 11.5 AI and analytics

- current-owner questions use the canonical resolver;
- historical responsibility uses historical revision data;
- planned/static questions explicitly use the baseline;
- performer and owner remain separate;
- no coaching conclusion derives solely from a static planned owner.

---

## 12. Status episodes, notifications and escalation

### 12.1 One operational status episode

Due soon and overdue are states of one location episode, not independent messages.

The episode key is tied to:

- location;
- accepted completion basis;
- threshold policy revision.

### 12.2 Routing

When an episode needs employee delivery:

1. resolve the effective owner and revision;
2. create one active recipient intent;
3. immediately before provider delivery revalidate:
   - episode remains active;
   - current status still requires delivery;
   - ownership revision still assigns that employee;
   - device assignment epoch remains current;
4. supersede and reroute when ownership changes;
5. send once through the native coordinator.

### 12.3 Work start and resolution

- NFC receipt does not resolve an episode;
- session start may mark `work_started` and pause redundant employee repeats for a bounded reviewed interval;
- failed/abandoned work does not resolve overdue;
- only an acknowledged completion that changes the authoritative location state resolves the episode;
- completion cancels active employee intents and escalation timers idempotently;
- an administrative correction requires named manager audit evidence.

### 12.4 Manager escalation

- manager escalation is rooted in the episode;
- employee Open/Dismiss affects presentation acknowledgement only;
- dismissal cannot declare work resolved;
- ownership change updates employee routing without erasing the episode history;
- completion during grace closes the escalation before send;
- final-delivery revalidation prevents a stale escalation after resolution.

### 12.5 Employee presentation

The native employee coordinator is the only presentation owner:

```text
chime
→ personalized spoken announcement
→ chime
→ identical personalized spoken announcement
→ silence
```

The overlay remains until Open or Dismiss. The operating system cannot add a separate default ding, duplicate overlay or third repetition.

Due/overdue is not copied into Messenger merely to generate a second push.

---

## 13. Messages, events and schedule-change intents

### Direct messages

- speech announces sender only;
- private message body is not spoken;
- one message ID maps to one logical notification root;
- thread deletion remains per-user hide, not destruction of another participant's history.

### Events

- employee event contract contains Memphis-local start/end, affected locations, exact employee instruction, revision/cancellation and route;
- event impact may extend operational requirement intervals only after approval;
- event notification and event page use the same route/contract.

### Schedule changes

Publishing a changed ownership revision generates durable recipient intents from the exact diff:

- 9:45 change;
- lunch assignment/end;
- inherited areas;
- transferred/removed areas;
- manager/emergency reassignment;
- uncovered manager exception.

The employee page does not invent schedule notifications by comparing browser snapshots.

---

## 14. GPS relationship

Current release GPS scope is active cleaning sessions only.

- server-authoritative session start activates the native session-location owner;
- tracking survives screen off/background/process recovery according to the approved Android design;
- completion/cancellation stops tracking;
- observations attach to session, device, employee performer, location and timestamp;
- GPS never changes ownership;
- departure requires adequate accuracy, hysteresis and repeated/dwell evidence;
- one noisy point cannot establish departure;
- return is recorded;
- manager states distinguish unavailable, unreliable, near, away and returned.

Group coordinates may support broad-area evidence but cannot prove presence at a specific restroom/exhibit. Critical locations require direct field calibration.

The future all-phone zoo map is outside the current release.

---

## 15. Retention and privacy

Ownership history is durable operational evidence.

- schedule versions;
- source provenance;
- membership snapshots;
- baselines;
- change inputs;
- compilation runs;
- transition records;
- effective intervals;
- publication/rollback audits;
- sessions;
- inspections;
- tickets;
- status episode resolution evidence

must not be deleted by the 14-day communication policy or generic short schedule-window cleanup.

No legal duration is invented. A future policy may archive older records, but it must preserve historical interpretation of work, alerts and accountability.

Notification presentation text may follow a shorter approved retention while retaining stable episode/intent audit references.

Personal data is minimized to stable IDs and necessary display snapshots. Contractor links never expose unrelated workforce information.

---

## 16. Performance and observability

### Indexing

At minimum index for:

- current publication by service date;
- revision/date/location/range;
- revision/date/owner/range;
- controlling input/transition;
- active status episode by location;
- active intent by recipient/episode;
- input hash and idempotency key.

### Read architecture

- employee and manager views read precompiled published intervals;
- no solver executes on ordinary page load;
- APIs return bounded location sets;
- query plans are captured in regression evidence;
- measured backend and field budgets are defined before release.

### Internal/manager health

Expose:

- current revision and input hash by service date;
- compiler version;
- conflict/OPEN counts;
- stale publication age;
- shadow mismatch counts by consumer;
- pending/superseded intents;
- unresolved status episodes;
- employee device revision lag;
- contractor engagement/link state;
- rollback/cutover state.

Employees do not see technical diagnostics.

---

## 17. Migration and shadow verification

No production migration begins before independent architecture approval.

Required sequence:

1. create an isolated Supabase development branch or equivalent isolated test database;
2. export current templates, memberships, restrictions, operating policy, daily rows, absences, CoverAll, alerts and sessions for fixtures;
3. identify the approved source artifact for each weekday;
4. import a draft static version and reviewed schedule subjects/positions;
5. treat Sunday location templates as conflict evidence, never silent precedence;
6. compile location-level shadow baselines;
7. translate date-specific facts into change inputs;
8. compile shadow ownership revisions and status episodes;
9. compare employee Schedule, manager Schedule, Dashboard, alerts, guest routing, AI and analytics;
10. classify every mismatch as old defect, source ambiguity, policy decision or compiler defect;
11. resolve through fixtures and reviewed rules;
12. independently audit schema, compiler, security, data migration and rollback;
13. deploy shadow reads for diagnostics only;
14. cut every consumer over at one controlled release boundary;
15. retire competing functions, Sunday resolver precedence, local inheritance and duplicate alert paths.

Shadow comparison is temporary evidence, not a dual-authority production design.

---

## 18. Rollback

- publication and consumer cutover are versioned;
- prior ownership evidence remains immutable;
- rollback atomically selects the prior admitted revision/consumer contract;
- candidate rows are retained and marked superseded/rolled back;
- old functions are not dropped until new source, field and rollback acceptance passes;
- Build 22 remains employee APK rollback until a later build is admitted;
- rollback never deletes evidence to make the candidate appear absent.

---

## 19. Required automated proof

### Static/source proof

- published schedule versions are immutable;
- effective ranges are unambiguous;
- source digests and normalized fingerprints are stable;
- membership snapshots freeze historical expansion;
- preview equals publication;
- normal reads perform zero writes;
- create-if-absent never changes a published baseline.

### Compiler property proof

- no overlap per location;
- every required instant is assigned or OPEN;
- outside requirement is not-required;
- identical input produces identical revision output;
- input events are never generated outputs;
- generated transitions are deterministic;
- failed validation exposes no current revision change;
- concurrent publication yields one winner/current pointer;
- historical resolver remains stable after future versions.

### Scenario fixtures

At minimum:

1. normal static day;
2. one absence;
3. multiple absences;
4. one CoverAll engagement;
5. multiple contractor slots;
6. overlapping lunches;
7. lunch spanning 9:45;
8. lunch overlapping shift end;
9. employee leaves before 9:45;
10. two employees remain;
11. one employee remains;
12. nobody remains before requirement end;
13. September 14 seasonal close change;
14. after-hours event extension;
15. manager ownership transfer start/end;
16. one-time work request without ownership change;
17. employee inactivation/vacancy;
18. replacement position assignment;
19. phone reassignment during the day;
20. ownership changes while due/overdue delivery is pending;
21. cleaning starts but does not complete;
22. completion during escalation grace;
23. repeated input submission;
24. rollback to prior revision;
25. daylight-saving boundary validation.

### Cross-consumer proof

For the same location/timestamp, assert identical responsibility and revision from:

- canonical resolver;
- employee Schedule;
- manager Schedule;
- Dashboard current owner;
- due/overdue routing;
- guest dispatch;
- Memphis AI;
- analytics.

### Security proof

- employee/Viewer/contractor/public clients cannot mutate ownership;
- employee reads are identity-scoped;
- manager publication requires named write authority;
- RLS is forced;
- public execute is revoked;
- security-definer search paths are locked;
- published rows cannot be silently updated/deleted;
- contractor tokens are scoped, expiring and non-enumerable.

### Status/notification proof

- one status episode survives due-soon to overdue;
- one active recipient intent at a time;
- owner/status revalidated before send;
- reroute supersedes stale intent;
- scan/start does not resolve;
- accepted completion resolves once;
- manager escalation remains truthful;
- exact two-cycle alert;
- acknowledgement survives offline/process death;
- OS adds no extra sound.

### Performance proof

- indexes and query plans are verified;
- employee/manager endpoints meet approved measured budgets;
- compilation time is bounded for current and expanded location counts;
- no ordinary read invokes compiler/generator code.

---

## 20. Physical acceptance

Before release:

- lunch areas appear only on the coverer's phone and disappear automatically;
- a lunch spanning 9:45 resolves to the new post-9:45 owner at lunch end;
- 9:45 changes only intended restroom locations;
- inherited locations appear individually;
- no Refresh button is required;
- sleeping/offline phones reconcile to the current revision;
- no employee alert is spoken after responsibility ends;
- NFC works from every employee page, lock/wake, cold start and offline state;
- active-session GPS survives screen off and records stable away/return evidence;
- Karen completes repeated workflows without manager explanation beyond initial NFC training;
- KIOSK_02 through KIOSK_10 are individually enrolled, push-tested, NFC-tested, queue-clean and rollback-verified.

---

## 21. Policy gates before isolated implementation

1. identify and approve the static source artifact for Sunday and every weekday;
2. approve location/position mapping for the static schedule;
3. approve late-day inheritance tie-break fixtures against real zoo geography;
4. approve versioned operating/after-hours policy, including September 14;
5. decide whether each CoverAll engagement requires a named worker or may remain slot-only;
6. approve ownership-transfer versus one-time-work-request manager semantics;
7. approve archive/retention boundaries without deleting responsibility history;
8. audit revision 3 independently with GPT-5.3, GPT-5.5 Pro and GPT-5.6 Pro.

No production implementation begins while these gates are unresolved.

---

## 22. Implementation sequence — not yet authorized

1. independent model audits of revision 3;
2. policy-gate fixture resolution;
3. revision and re-audit until architecture is accepted;
4. isolated schema and compiler tests;
5. deterministic compiler/resolver build;
6. isolated security audit;
7. shadow migration and cross-consumer comparison;
8. independent source/data/rollback audit;
9. controlled backend consumer cutover;
10. employee app rebuild against canonical contracts;
11. source-complete specialist audits;
12. one frozen signed APK build and independent verification;
13. Moto G/Karen/fleet acceptance;
14. release admission only when all evidence agrees.

---

## 23. Revision-3 verdict

### **CONDITIONAL GO FOR COMPANION RE-AUDIT AND INDEPENDENT PLAN AUDITS**

### **NO-GO FOR PRODUCT OR DATABASE IMPLEMENTATION**

Revision 3 separates source facts from generated transitions, defines location-specific requirement windows, introduces a complete workforce subject/vacancy model, makes publication atomic, adds a transactional outbox, creates durable status episodes, establishes explicit security boundaries, and protects historical responsibility from short retention.

It is now coherent enough to audit as one architecture. It is not permission to build or migrate production.