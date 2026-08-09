# Memphis Zoo Custodial System — Canonical Operations Architecture Plan

**Status:** Foundation architecture v1; implementation is not authorized  
**Prepared:** 2026-08-03  
**Frontend repository:** `lasrevinu333-design/Engine`  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Frontend source point before this document:** `71052572074d1e2578fc9db3b8bbbe46472720df`  
**Backend repository:** `lasrevinu333-design/memphis-zoo-mcp`  
**Backend source reviewed:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Live database:** Memphis Zoo Custodial Tracking System  
**Database access used:** read-only SQL and deployed-function inspection  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Purpose

This plan defines the foundation required to keep the Memphis Zoo Custodial System aligned with its actual purpose:

> Give every operational location one clear responsible party at every required moment, let employees perform the work in a practical order, preserve reliable evidence of what happened, and present each user only the information and controls necessary for their role.

The original program is a strong behavioral baseline. Its proven operations, scheduling concepts, cleaning evidence, notifications, analytics, security and device-management ideas should be preserved. Existing behavior is not accepted merely because it is old, deployed or documented in the Final Report. Every capability must still satisfy the real operating model.

This is not a compatibility-patch plan. The final system must have one coherent authority for identity, schedule, ownership, notifications, cleaning sessions and release admission. Temporary shadow comparison is permitted only as a migration-verification method and must be removed after cutover.

---

## 2. Non-negotiable operating truths

### 2.1 Static schedules are normal authority

A manager-approved premade weekly schedule is the normal source for:

- employee shifts;
- lunch windows;
- morning cleaning ownership;
- the 9:45 AM restroom phase;
- continuing non-restroom ownership;
- normal late-day ownership transitions;
- recurring schedule-only reminders.

Opening a page, asking Memphis a question, polling an API or starting the application must never regenerate or rewrite the schedule.

### 2.2 Dynamic scheduling is exception-only

A day may differ from the approved static schedule only because of an explicit operational input, including:

- absence or callout;
- CoverAll capacity;
- employee activation/inactivation;
- manager override;
- emergency transfer;
- changed operating hours;
- newly published static schedule version;
- an approved event-specific operational exception.

An exception solver may rebalance work, but it must minimize unnecessary movement. It may not repartition the entire day simply because another mathematically valid schedule exists.

### 2.3 Responsibility is location-specific

The canonical responsibility unit is the individual operational location because:

- NFC tags identify individual locations;
- cleaning sessions are location-specific;
- due and overdue state is location-specific;
- guest reports are location-specific;
- GPS accountability is location-specific;
- mixed groups contain different kinds of locations;
- the 9:45 transition may change restrooms while preserving exhibits or buildings.

Location groups remain authoring, display, route and workload tools. They are not the final ownership authority.

### 2.4 Employees choose practical work order

Ownership means responsibility, not a prescribed walking route. Employee Schedule may sort restrooms first for opening or upkeep priority, but it must not command a generic “next stop” or invent a route.

### 2.5 Identity is durable; eligibility changes

Employee records are never renamed to represent replacements and are not deleted merely because employment ends. The system must separately represent:

- permanent employee identity;
- current employment status;
- schedule eligibility;
- device eligibility;
- Messenger eligibility;
- historical records;
- vacant schedule positions;
- controlled test/build identities.

Michael McWright and Daniel Morgan remain unchanged until the Custodial Manager explicitly changes their operational status.

### 2.6 Actual cleaner is not automatically the owner

The effective owner is responsible for the location. The active or last cleaner is the person who performed work. They may differ because of help, manager direction, emergency response or cross-coverage. The system must preserve both facts rather than rewriting history.

### 2.7 No fabricated coverage

When no eligible employee or contractor remains, the correct answer is explicit `OPEN`, with a manager-visible reason and interval. The system must not create `All Locations`, retain a departed employee, or assign an ineligible person merely to avoid an uncovered state.

---

## 3. Current foundation findings that shape the target

### 3.1 Sunday location templates are stale derived material, not a valid independent authority

Production contains:

- 135 active `location_coverage_templates` rows;
- all for Sunday;
- all created and last updated together on 2026-04-28;
- all linked to a source location group;
- notes beginning with “Seeded from group schedule” and later Sunday refinements.

Production also contains 339 active group `coverage_templates` rows for all seven weekdays. Those were created on 2026-06-28 and updated through 2026-07-14 from the uploaded static PDF schedule.

The deployed `sch_seed_location_coverage_templates_from_groups` function proves that location rows are derived by expanding group templates and converting mixed-group member purposes. The current Sunday location rows no longer match the newer group schedule reliably:

- 43 of 135 are exact or equivalent;
- 46 have a different nearest overlapping owner;
- 32 have no overlapping current group row;
- 8 differ in time;
- 6 differ in purpose.

Yet `sch_get_location_schedule_owner` gives the derived Sunday rows priority over the current group schedule.

**Architecture decision:** Sunday location templates will be exported for reconciliation and retired as an independent runtime authority. A versioned compiler will perform location expansion deterministically from one approved static schedule version.

### 3.2 Mixed groups require member-scoped compilation

Current mixed groups include:

- China;
- East Admin;
- Event Center;
- Expo;
- Teton;
- West Admin;
- Zambezi.

Each contains one non-restroom location and two or more restrooms. The current dynamic restroom rebalancer selects an entire group if any member is a restroom and then updates the group assignment. It can therefore move an exhibit or building while claiming to move only restroom responsibility.

**Architecture decision:** static authoring rows must declare member scope, and the compiler must expand them to individual locations before any 9:45 or exception operation.

### 3.3 A scan event is not proof of resolution

Production currently clears active scan-alert records after any inserted `scan_events` row with a location code. That includes:

- scan received;
- session start;
- session finish transition;
- pending-completion resume;
- GPS position check.

A live `work_position_check` showing a phone approximately 3.7 km away from the target location therefore qualifies to clear the alert under the present trigger.

**Architecture decision:** only authoritative cleaning completion or an explicit manager resolution can resolve a due/overdue operational event. Session start may mark the event `in_progress` and pause escalation, but it cannot mark the location clean.

### 3.4 CoverAll is contractor capacity, not an ordinary employee phone identity

Production contains four stable CoverAll slots but no employee devices or push registrations for them. Secure assignment links and printable schedules already exist.

**Architecture decision:** CoverAll slots remain stable contractor identities for scheduling and history, but effective ownership uses `owner_type=contractor`. Contractor communication uses secure assignment links or printed schedules. Employee-device notification requirements do not apply to a CoverAll slot. The manager remains the accountable escalation recipient.

---

## 4. Authoritative system layers

```text
Versioned operating policy
        +
Versioned static weekly schedule
        +
Durable employee/contractor eligibility
        ↓
Immutable daily baseline compilation
        ↓
Explicit exception and transition ledger
        ↓
Deterministic location-level ownership compiler
        ↓
Non-overlapping effective ownership intervals
        ↓
Canonical current/historical resolver
        ↓
Schedule / Dashboard / notifications / AI / guest routing / analytics

NFC tag + protected device identity
        ↓
Authoritative cleaning session
        ↓
Native active-session GPS lifecycle
        ↓
Durable completion evidence
        ↓
Location status and operational-event resolution
```

No employee, manager, AI, notification or analytics consumer may implement a private ownership precedence rule after cutover.

---

## 5. Versioned operating policy

A versioned operating policy defines when ownership is required and how recurring transitions behave.

Minimum fields:

- immutable policy version ID;
- draft/approved/published/retired state;
- effective start and end dates;
- Memphis timezone;
- public opening and closing rules;
- seasonal date ranges;
- special-date overrides;
- 9:45 phase time;
- default lunch duration rules;
- due-soon and overdue thresholds;
- manager escalation grace;
- GPS evidence thresholds;
- actor, approval and publication history;
- previous-version reference;
- source/import hash.

The September 14 change from 6:00 PM to 5:00 PM must be represented by an effective-date policy rule, not by a hidden default or one-off daily row.

The policy compiler returns one explicit operational window for each location/date. Outside that window the result is `not_required`, not `OPEN`.

---

## 6. Versioned static weekly schedule

### 6.1 Static schedule version

Each static schedule version contains:

- immutable version ID;
- source document/import hash;
- draft/validated/approved/published/retired state;
- effective start and optional end date;
- previous-version reference;
- created by, approved by and published by;
- complete seven-day shift set;
- complete seven-day assignment set;
- restrictions and capability requirements;
- import warnings and resolution history.

### 6.2 Shift rows

Each shift row contains:

- employee or vacant-position identity;
- weekday;
- shift start and end;
- lunch start and end;
- schedule eligibility requirements;
- optional operational role/capability;
- source row reference.

### 6.3 Assignment authoring rows

Each assignment row contains:

- weekday;
- phase or effective time range;
- location group or explicit location set;
- member scope:
  - `all_members`;
  - `restroom_members`;
  - `non_restroom_members`;
  - explicit location IDs;
- static owner or vacant position;
- purpose:
  - morning deep clean;
  - restroom upkeep;
  - area ownership;
  - schedule-only reminder;
  - other approved purpose;
- load points;
- route/zone metadata;
- restrictions;
- source row reference.

### 6.4 Import, preview and publication

```text
Import new schedule
→ resolve employee and location identities
→ expand mixed groups
→ preview all seven days
→ validate coverage, shifts, restrictions, workloads and geography
→ compare with current published version
→ manager review
→ approve
→ publish with effective date
```

Publication never rewrites history. A previously published version remains queryable and may be selected for rollback.

---

## 7. Immutable daily baseline

For each service date, the compiler creates one immutable baseline from:

- published operating-policy version;
- published static-schedule version;
- employee eligibility snapshot;
- contractor slot configuration;
- location membership snapshot.

The baseline contains location-level intervals before day-specific exceptions.

Minimum baseline fields:

- baseline ID and version;
- service date;
- location ID/code;
- group ID/code for display context;
- effective start and end;
- baseline owner identity or `OPEN`;
- owner type;
- responsibility purpose;
- static schedule version;
- operating-policy version;
- source assignment ID;
- compiler version;
- input fingerprint;
- compilation timestamp.

### 7.1 Daily identity and idempotency

A daily compilation fingerprint includes:

- schedule version;
- operating-policy version;
- service date;
- active location membership version;
- employee eligibility snapshot;
- contractor slot configuration.

The same inputs must reproduce byte-equivalent baseline output. A normal read never invokes this compiler.

### 7.2 Baseline immutability

Once published, baseline rows are never updated in place. Corrections create a new baseline revision with an audit link to the superseded revision. Historical consumers retain the revision that was effective at the time.

---

## 8. Explicit exception and transition ledger

Every deviation from the baseline is a durable event.

Examples:

- absence;
- CoverAll slot added or removed;
- manager reassignment;
- emergency transfer;
- lunch start;
- lunch end;
- shift-end inheritance;
- employee activation/inactivation;
- operating-hours exception;
- event-specific operational exception;
- explicit correction.

Minimum fields:

- event ID;
- stable idempotency key;
- service date;
- event type and reason code;
- effective start and optional end;
- affected location IDs;
- previous owner;
- requested new owner, contractor or `OPEN`;
- source and actor;
- schedule version;
- baseline revision;
- status: proposed/validated/published/superseded/cancelled;
- input payload and audit metadata;
- created, validated, published and superseded timestamps.

Exception publication requires preview, validation and exact diff. The published output must equal the approved preview.

---

## 9. Deterministic exception solver

### 9.1 Hard constraints

No candidate may receive responsibility outside:

- active employment/schedule eligibility;
- active shift;
- location restrictions;
- required capability;
- operational location window;
- approved contractor slot window.

No output may contain overlapping active owners for one location.

### 9.2 Lexicographic optimization

The solver optimizes in this order:

1. cover every required location or return explicit `OPEN`;
2. satisfy all hard constraints;
3. preserve unaffected static ownership;
4. minimize the number of changed locations and employees;
5. keep assignments geographically coherent;
6. balance total effective workload;
7. minimize split groups and handoff complexity;
8. provide deterministic tie-breaking.

A lower-priority objective can never justify violating a higher-priority objective.

### 9.3 Absence

An absence invalidates only intervals owned by the absent employee. The solver may move additional work only when required to produce a materially safer or fairer result, and every additional move must be shown in preview with a reason.

### 9.4 CoverAll

CoverAll capacity is added as one or more contractor slots with explicit shift windows. The solver first assigns work made uncovered by the exception. It may make the minimum additional moves needed to preserve route coherence and fair workload. It must not force-regenerate the day.

### 9.5 9:45 restroom phase

The normal 9:45 ownership set is part of the static schedule version. An exception-day 9:45 adjustment may alter only restroom location intervals. Non-restroom members of China, East Admin, Event Center, Expo, Teton, West Admin and Zambezi remain with their separately compiled owner unless an independent exception affects them.

### 9.6 Lunch

Lunch is an exclusive temporary transfer:

- close or suspend the original effective interval for covered locations;
- open equivalent intervals for the coverer;
- remove those locations from the original owner’s current Schedule;
- at lunch end, restore the original owner only if still eligible;
- otherwise continue through absence or shift-end rules.

### 9.7 Shift end

At shift end:

- close every effective interval held by the departing employee;
- assign each exact location to an eligible remaining employee or contractor using the approved solver;
- preserve explicit location names;
- notify only recipients whose responsibility changed;
- return `OPEN` when nobody eligible remains.

This rule applies before, at or after 9:45. It is not gated by the restroom phase.

### 9.8 Manual and emergency override

An active, validated manual/emergency override supersedes automated ownership for its exact locations and interval. It records previous owner, actor, reason and restoration behavior. Expiration triggers deterministic restoration or re-solve.

---

## 10. Effective ownership intervals

The compiler materializes non-overlapping intervals for every required location.

Minimum fields:

- ownership interval ID;
- service date;
- location ID and code;
- display group ID and code;
- effective start and end;
- responsibility status: assigned/open/not_required;
- owner type: employee/contractor/open;
- employee ID or contractor slot ID;
- device assignment epoch when applicable;
- purpose;
- reason code;
- baseline assignment ID;
- transition event ID;
- previous owner;
- schedule version;
- operating-policy version;
- ownership version;
- compiler version;
- published timestamp.

### 10.1 Database constraints

The database must reject:

- overlapping active intervals for the same location;
- assigned rows without a valid owner identity;
- employee ownership outside eligibility/shift unless an audited emergency rule permits it;
- contractor ownership outside slot window;
- end at or before start;
- silent `OPEN` without a reason;
- mutation of a published historical row.

A compiler conflict blocks publication. It never guesses.

---

## 11. Canonical ownership resolver

All current and historical consumers use one resolver or authoritative view.

Conceptual contract:

```json
{
  "service_date": "2026-08-03",
  "resolved_at": "2026-08-03T14:30:00-05:00",
  "location_id": "uuid",
  "location_code": "BREM",
  "location_name": "Breezeway Men's Restroom",
  "group_code": "BREEZEWAY_RESTROOMS",
  "responsibility_status": "assigned",
  "effective_owner": {
    "owner_type": "employee",
    "employee_id": "uuid",
    "employee_name": "Name",
    "device_identifier": "KIOSK_08",
    "assignment_epoch": 2
  },
  "effective_start": "2026-08-03T14:00:00-05:00",
  "effective_end": "2026-08-03T15:00:00-05:00",
  "purpose": "restroom_upkeep",
  "reason_code": "shift_end_inheritance",
  "baseline_owner_id": "uuid",
  "transition_event_id": "uuid",
  "schedule_version": "uuid",
  "ownership_version": "uuid"
}
```

The resolver is:

- read-only;
- timestamp-aware;
- service-date aware;
- location-specific;
- stable and idempotent;
- explicit about `OPEN` and `not_required`;
- independent of the requesting screen;
- usable for historical responsibility lookup.

---

## 12. Employee and contractor lifecycle

### 12.1 Employee state

A durable employee record is separate from operational eligibility.

Recommended state fields:

- employment status;
- active start/end dates;
- schedule eligible;
- device eligible;
- Messenger eligible;
- absence eligibility;
- capabilities/restrictions;
- historical-only flag;
- vacant-position replacement relationship.

Changing eligibility generates a future-schedule impact preview. It never deletes history.

### 12.2 New employee workflow

```text
Create permanent identity
→ assign employee code and capabilities
→ add to draft static schedule or vacant position
→ preview future schedule impact
→ assign employee phone
→ create Messenger identity
→ activate with effective date
```

### 12.3 Departing employee workflow

```text
Set future operational end date
→ preview affected static and published days
→ assign replacement or create explicit vacant/open position
→ revoke future device and Messenger eligibility at effective time
→ preserve all history
```

### 12.4 CoverAll workflow

```text
Activate contractor slot for service date and shift
→ preview exact assignments
→ publish minimal exception
→ issue secure bilingual assignment link or printable schedule
→ retain manager escalation responsibility
→ close slot at shift end
```

CoverAll does not require a Memphis employee phone or employee push registration.

---

## 13. Cleaning session architecture

### 13.1 Authoritative identity and location

- protected enrolled device supplies employee identity;
- NFC tag supplies location identity;
- employee never selects their name;
- no QR path exists in employee mode;
- server validates device, assignment and location;
- one device, employee and location may not hold conflicting open sessions.

### 13.2 Session states

Minimum state machine:

```text
start_requested
→ active
→ finish_requested
→ completion_form_pending
→ completion_submitted
→ closed

Alternate states:
offline_provisional
pending_sync
reconciliation_required
cancelled
```

Every transition has a stable operation ID and is idempotent.

### 13.3 Owner versus cleaner

Starting a valid session records:

- effective owner at start;
- actual cleaner;
- whether they match;
- manager-directed/help reason when they do not;
- ownership version used.

The session does not silently transfer ownership.

### 13.4 Due/overdue resolution

- NFC receipt does not resolve an alert;
- session start may mark the operational event `in_progress` and pause escalation;
- authoritative closed completion resolves the event;
- manager resolution may close it with reason;
- cancelled or rejected work does not resolve it;
- GPS observations never resolve it.

---

## 14. Native active-session GPS

GPS is required only while a cleaning session is active in the current release.

### 14.1 Native owner

A native Android location coordinator—not a page timer—owns observation from confirmed session start through confirmed close/cancel.

It must survive:

- page navigation;
- screen off;
- Fully Kiosk lock state;
- application background;
- WebView recreation;
- process restart where Android permits restoration;
- temporary network loss.

### 14.2 Evidence rules

A departure finding requires stable evidence:

- precise-location permission and location services available;
- fresh timestamp;
- acceptable accuracy;
- target direct coordinate and radius;
- hysteresis/uncertainty band;
- rejection of impossible motion;
- multiple consecutive away readings or configured dwell time;
- one durable away event per excursion;
- one durable returned event after stable re-entry.

A single noisy point is not a violation.

### 14.3 Coordinate policy

Current group-level coordinates are useful for route planning but are insufficient as final proof for a specific restroom or exhibit. Each active NFC location must receive a field-verified direct coordinate, confidence, radius and calibration date before GPS accountability is accepted.

### 14.4 Presentation

Employees see only actionable text such as:

> Return to East Admin Men's Restroom.

Managers may see accuracy, distance, observation age and evidence status. Technical GPS diagnostics are never shown to ordinary employees.

### 14.5 Future map

The architecture preserves device/location observations for a future manager map, but continuous all-phone tracking is outside the current release.

---

## 15. One operational notification architecture

### 15.1 Canonical notification intent

Every operational alert creates one durable intent with:

- stable logical key;
- event type;
- source event ID and revision;
- employee or manager recipient;
- device assignment epoch;
- ownership version when location-related;
- route;
- display copy;
- speech copy;
- effective and superseded timestamps;
- delivery state;
- displayed/opened/dismissed state;
- operational-resolution state.

Required employee kinds include:

- direct message;
- Memphis message;
- event notice;
- due soon;
- overdue;
- 9:45 ownership change;
- lunch coverage assigned;
- lunch coverage ended;
- inherited locations;
- removed/transferred locations;
- manager/emergency reassignment.

### 15.2 Resolve and revalidate

For a location event:

1. resolve effective owner at event creation;
2. create one intent with ownership version;
3. immediately before delivery, revalidate owner and device assignment epoch;
4. cancel, reroute or supersede if ownership changed;
5. deliver through one native presentation coordinator;
6. preserve manager escalation independently from employee dismissal.

### 15.3 Transport and presentation

- FCM transports data silently;
- Android default sound/vibration is disabled for these intents;
- backend and APK use the same versioned channel IDs;
- one native coordinator presents the overlay and audio;
- legacy polling/Messenger duplication is retired in the native APK.

Exact sequence:

```text
chime
→ personalized full announcement
→ chime
→ identical personalized full announcement
→ silence
```

The overlay remains until `Open` or `Dismiss`.

### 15.4 Durable lifecycle

Local durable state records:

```text
received
→ displayed
→ first cycle complete
→ second cycle complete
→ opened or dismissed
→ server acknowledged
```

A failed acknowledgement remains queued. The alert cannot disappear from durable evidence merely because the network request failed.

### 15.5 Manager escalation

Due/overdue escalation uses the same operational event and intent key. It does not create a second employee Messenger message. Escalation occurs only if:

- the event remains unresolved;
- the same ownership version or a valid successor is responsible;
- no accepted completion exists;
- grace time has elapsed.

---

## 16. Consumer contracts

### Employee Schedule

- reads current effective intervals for the enrolled employee;
- never synthesizes ownership locally;
- displays exact locations;
- groups for readability only after canonical resolution;
- sorts restrooms first without inventing route order;
- clearly separates normal, lunch and inherited responsibility;
- receives server-durable change notifications;
- has no permanent Refresh button.

### Manager Schedule

- displays static baseline and effective owner separately;
- shows exception reason and exact diff;
- previews future transitions;
- identifies `OPEN` intervals;
- supports versioned static schedule import/review/publication.

### Dashboard

Separate fields:

- current effective owner;
- responsibility reason;
- cleaning now by;
- last cleaned by;
- last completed at;
- due/overdue status;
- ticket state;
- GPS/session exception where applicable.

### Events

Employee Events consumes an employee-specific operational contract with:

- Memphis-local start and end timestamps;
- affected locations;
- employee impact/instruction;
- cancellation/revision;
- notification route.

It does not derive time from date-only strings or display manager-only details.

### Messenger

One ChatScope implementation remains authoritative. It requires:

- immediate recipient-specific loading isolation;
- durable outbox;
- transient versus terminal error classification;
- no stale prior thread display;
- direct employee New flow;
- immediate per-user conversation hide on Delete;
- no duplicate confirmation.

### Feedback

Employee Feedback requires:

- protected device identity;
- draft persistence;
- offline durable outbox;
- idempotent submission;
- plain employee wording;
- no trusted identity fields accepted solely from request body.

### Guest reports

When the optional guest feature is approved, dispatch resolves canonical effective owner at delivery time and records the ownership version used. Manager receipt remains independent.

### Memphis AI

- current-owner questions use canonical current resolver;
- historical responsibility uses historical resolver;
- planned schedule is returned only when explicitly requested;
- AI never substitutes planned ownership for effective responsibility.

### Analytics

Analytics may compare baseline, effective owner and actual cleaner, but it must preserve context. It may not infer fault from a static schedule after responsibility transferred.

---

## 17. Retention and audit history

### 17.1 Durable records

The following are long-term operational/audit records and are not governed by the 14-day event-notice rule:

- published static schedule versions;
- operating-policy versions;
- daily baseline revisions;
- exception and transition events;
- effective ownership intervals;
- schedule publication audits;
- cleaning sessions and completion evidence;
- manager overrides;
- employee/device assignment history;
- responsibility-linked inspection and analytics facts.

They are append-only or superseded, not silently purged.

### 17.2 Shorter-lived presentation data

The following may have bounded retention after durable facts are preserved:

- expired event notices;
- deleted Messenger content under its approved retention policy;
- notification transport attempts;
- transient queue diagnostics;
- raw high-frequency GPS points after excursion/session summaries are retained.

Any purge policy must preserve the linked durable event, ownership version, final delivery result and necessary accountability summary.

### 17.3 Explicit policy separation

The current 14-day event purge applies to event notices, not schedule/ownership audit history. The disabled broad free-tier retention function is not a substitute for a documented ownership-retention contract.

---

## 18. Migration and cutover

### 18.1 Read-only export

Export and hash:

- current static group templates;
- Sunday location templates;
- shift templates;
- restrictions;
- location/group memberships;
- operating hours;
- published daily schedules;
- absence, CoverAll and override records;
- schedule publication history.

### 18.2 Source reconciliation

Reconcile the uploaded/static schedule source against:

- current group templates;
- older Sunday derived rows;
- manager-approved later refinements;
- employee restrictions;
- actual shift changes.

Conflicts are reviewed; neither old nor new rows are trusted automatically.

### 18.3 Shadow compiler

Build the new compiler in isolated/shadow tables. For a representative date range and every transition boundary, compare:

- old employee Schedule;
- old manager Schedule;
- old alert owner;
- new canonical owner;
- approved static source.

Every difference is classified as:

- expected correction;
- intentional policy change;
- source-data conflict;
- implementation defect;
- unresolved.

### 18.4 Cutover gate

Cutover is prohibited until:

- no unexplained ownership differences remain;
- no overlapping effective intervals exist;
- all consumers pass the same owner contract fixtures;
- notification duplicate paths are retired;
- rollback and reconciliation plans are proven;
- independent audits approve the architecture and build.

### 18.5 Retirement

After accepted cutover, retire as authorities:

- Sunday location templates;
- reader-local inheritance;
- `All Locations` substitution;
- all-day native recipient joins;
- scan-alert Messenger as duplicate employee delivery;
- page-specific owner precedence;
- read-triggered schedule generation;
- force-regeneration for ordinary absence/CoverAll changes.

---

## 19. Required test architecture

### 19.1 Database invariants

- no overlapping effective ownership per location;
- one owner/contractor/OPEN/not_required result per required instant;
- immutable published baselines;
- idempotent exception replay;
- exact preview/publish equality;
- historical resolver stability;
- no read path writes;
- mixed-group location expansion correctness.

### 19.2 Required scenario fixtures

1. normal static day;
2. employee absent before day begins;
3. callout after publication;
4. multiple absences;
5. CoverAll slot addition;
6. CoverAll slot removal;
7. 9:45 normal transition;
8. 9:45 exception rebalance;
9. mixed exhibit/restroom group;
10. overlapping lunch windows;
11. lunch coverer absent;
12. lunch overlapping shift end;
13. employee leaves before 9:45;
14. two employees remain;
15. one employee remains;
16. nobody remains before public close;
17. September 14 seasonal close transition;
18. emergency override;
19. employee/phone reassignment during day;
20. overdue state during ownership transfer;
21. CoverAll contractor with no phone;
22. new employee replacing a vacant position.

### 19.3 Cross-consumer ownership test

For every fixture location/timestamp, assert identical responsibility from:

- canonical resolver;
- employee Schedule;
- manager Schedule;
- Dashboard owner field;
- due/overdue intent;
- guest dispatch;
- Memphis AI;
- analytics responsibility query;
- GPS accountability lookup.

### 19.4 Session, NFC and offline tests

- native NFC cold/warm/background intake;
- protected employee identity;
- exact location resolution;
- active-session persistence;
- screen off/wake/restart;
- offline provisional start;
- offline completion;
- exactly-once reconciliation;
- terminal stale-action retirement;
- no queue retry amplification.

### 19.5 Notification tests

- one logical intent per event;
- exact two-cycle audio sequence;
- no Android default sound;
- correct route;
- durable displayed/opened/dismissed acknowledgement;
- process death at each lifecycle state;
- owner change before delivery;
- event resolution before escalation;
- no Messenger duplicate.

### 19.6 GPS tests

- direct coordinate calibration;
- accuracy and stale-reading rejection;
- boundary hysteresis;
- consecutive-away/dwell threshold;
- return event;
- screen off and background;
- process restart;
- network loss;
- stop after session close;
- no false resolution of due/overdue events.

### 19.7 Karen field acceptance

Without coaching beyond initial physical training, Karen must repeatedly:

- wake the phone;
- scan NFC;
- start and finish cleaning;
- recover after screen off;
- understand current Schedule;
- respond to a change notification;
- send and delete a conversation;
- read an event;
- send Feedback;
- recover after network loss.

The manager-explanation target is zero after initial training.

---

## 20. Release architecture

A release candidate is one frozen commit and one verified artifact.

Required chain:

```text
Approved architecture
→ coherent source implementation
→ source audit
→ independent specialist audits
→ frozen commit
→ all required CI green
→ signed APK build
→ source/runtime/APK provenance verification
→ Moto G/Fully Kiosk physical acceptance
→ independent final release audit
→ controlled fleet admission
```

Audit workflows are read-only. They never patch, commit or push product source. A failed test creates evidence; it does not authorize reactive code mutation.

Build 22 remains the rollback baseline until a later artifact completes this chain.

---

## 21. Implementation sequence — not yet authorized

1. reconcile and approve static schedule source;
2. define operating-policy and static-schedule schemas;
3. define immutable baseline, exception and ownership schemas;
4. implement overlap and immutability constraints;
5. build deterministic compiler and resolver in isolation;
6. build complete fixture suite;
7. run shadow comparison against production history;
8. independently audit architecture, schema and migration;
9. cut Schedule, Dashboard, notifications, AI, guest routing and analytics to canonical resolver;
10. retire duplicate ownership and alert authorities;
11. implement native NFC, notification and active-session GPS owners;
12. finish employee Events, Messenger and Feedback contracts;
13. audit coherent source and generated runtime;
14. build and physically accept the APK;
15. admit a new fleet release only after final independent GO.

---

## 22. Architecture status

This plan resolves the known structural contradictions without preserving competing authorities.

It is a **research architecture**, not implementation authorization. It must survive:

- internal adversarial plan audit;
- static schedule source reconciliation;
- production-data migration analysis;
- independent GPT-5.3, GPT-5.5 and GPT-5.6 Pro architecture audits;
- explicit resolution of any audit findings.

No product, database, build, APK or phone change is authorized by this document.