# Memphis Zoo Custodial System — Canonical Effective Ownership Audit

**Status:** Read-only production/source audit; no product or database changes authorized  
**Prepared:** 2026-08-03  
**Frontend repository:** `lasrevinu333-design/Engine`  
**Frontend branch:** `agent/custodial-moto-g-simple-v23-20260802`  
**Frontend source point before this document:** `3d94fb3445176c3896fea87e286d38c96d86b8c5`  
**Backend repository:** `lasrevinu333-design/memphis-zoo-mcp`  
**Backend source reviewed:** `0fff8c2cadea132902df22c99593f1ce348411a7`  
**Live database:** Memphis Zoo Custodial Tracking System  
**Database access used:** SELECT and deployed-function-definition inspection only  
**Accepted employee rollback baseline:** Custodial Build 22

---

## 1. Executive finding

The current system does not have one canonical answer to:

> Who is responsible for this location right now?

Instead, different parts of the program derive ownership from different sources:

- static group templates;
- Sunday-only location templates;
- published daily schedule rows;
- employee-page dynamic inheritance;
- current-owner helper functions;
- scan-alert owner functions;
- Messenger schedule views;
- direct native push assignment joins;
- actual cleaning sessions.

Those sources are not equivalent. They can disagree, overlap, omit the inherited owner, identify multiple employees, or return OPEN while an employee screen says the area belongs to someone.

This is a **BLOCKER-level foundation defect** because ownership drives:

- employee Schedule;
- 9:45 restroom reassignment;
- lunch transfer;
- shift-end inheritance;
- due-soon and overdue alerts;
- guest issue routing;
- Memphis AI answers;
- manager visibility;
- escalation messages;
- workload and accountability analysis.

The correct target is not to choose one of the existing inconsistent functions and call it authoritative. The correct target is to construct one persisted, non-overlapping, versioned effective-ownership model and require every consumer to use it.

---

## 2. Required terminology

The current program often uses one employee field to mean several different things. The final architecture must keep these concepts separate.

### 2.1 Static baseline owner

The employee or contractor assigned by the approved premade schedule before day-specific exceptions.

### 2.2 Planned daily owner

The owner stored in the published daily schedule before evaluating a particular point-in-time transfer.

### 2.3 Effective owner

The one person or contractor responsible for a specific location at a specific time after applying:

- the approved static baseline;
- absences;
- CoverAll additions;
- 9:45 restroom rebalance;
- lunch transfers;
- shift-end inheritance;
- manager/emergency overrides;
- operating-hours policy.

### 2.4 Active cleaner

The employee currently checked into an NFC cleaning session. The active cleaner may be the effective owner, a manager-directed substitute, or someone helping another employee.

### 2.5 Last cleaner

The employee associated with the latest completed cleaning session.

### 2.6 Notification recipient

The currently valid device registration for the effective owner. Notification delivery is a transport concern and must not redefine ownership.

### 2.7 OPEN / uncovered

An explicit operational exception stating that no eligible employee currently owns the location. The system must never fabricate an owner merely to avoid OPEN.

---

## 3. Non-negotiable ownership invariant

For each operational location and each instant while ownership is required, the system must return exactly one of:

1. one effective employee owner;
2. one effective contractor/CoverAll owner;
3. explicit OPEN with manager-visible reason;
4. no ownership required because the location is outside its active operational window.

It must never return:

- two employees as simultaneous current owners;
- the static owner and lunch coverer at the same time;
- the departed employee and inheriting employee at the same time;
- `All Locations` instead of the actual locations;
- an owner whose shift has ended;
- a notification recipient who does not own the location;
- a different owner depending on which screen or API is asked.

---

## 4. Evidence method

This audit compared:

1. the intended operational model;
2. the employee Schedule implementation;
3. manager schedule routes;
4. Dashboard implementation;
5. native and web due/overdue delivery;
6. legacy scan-alert Messenger delivery;
7. guest-report routing;
8. Memphis AI owner lookup;
9. deployed production functions and views;
10. deterministic read-only replays of the live schedule for selected Memphis times.

The historical/as-of replays do not claim an employee physically performed or ignored work. They test what each deployed ownership function would have answered for the same service date and timestamp.

---

## 5. Current ownership authorities

### 5.1 Group static templates

Production contains active `coverage_templates` for all weekdays.

These rows define:

- location group;
- weekday;
- employee;
- coverage start/end;
- coverage purpose;
- segment number.

They are the primary source for `sch_generate_daily_schedule`.

### 5.2 Location static templates

Production also contains active `location_coverage_templates`.

Observed production state:

- 135 active location-template rows;
- 45 distinct locations;
- every active row is for weekday `0` / Sunday;
- no active location-template rows exist for Monday through Saturday.

`sch_get_location_schedule_owner` gives these Sunday location templates priority over the group daily schedule.

Therefore scan-alert ownership uses one authority on Sunday and another authority on the rest of the week.

### 5.3 Published daily assignments

`daily_schedule_assignments` stores group-level rows with:

- service date;
- location group;
- segment;
- assigned employee;
- owner type;
- start/end;
- purpose;
- status;
- source type;
- load points.

The table prevents exact key duplication, but it does not prevent overlapping intervals for the same group with different employees.

The deployed table has:

- a unique key on `(service_date, location_group_id, segment_number)`;
- no exclusion constraint preventing overlapping owner intervals;
- no canonical ownership version;
- no transition-event reference;
- no baseline-assignment reference;
- no explicit previous owner;
- no effective-ownership reason code.

### 5.4 Employee-page dynamic ownership claims

`sch_employee_my_schedule_phase_v1` builds employee-visible current items from daily rows and then dynamically adds locations whose planned owners are no longer active.

This produces shift-end inheritance only at read time. It does not persist the transfer.

It also retains base-owner rows during lunch while displaying lunch coverage to another employee, producing simultaneous ownership claims.

### 5.5 General current-owner helper

`sch_get_current_owner(location_code, at)` reads the published daily schedule for the location's group and returns one current planned row.

It does not apply the employee-page shift-end inheritance overlay.

### 5.6 Scan-alert owner helpers

`sch_get_location_schedule_owner` and `sch_get_scan_alert_owner` choose:

1. an active location template, when one exists for the weekday/time;
2. otherwise a group daily-schedule row.

They do not use the employee-page dynamic inheritance result.

### 5.7 AI and schedule views

The following views are direct projections of `daily_schedule_assignments`:

- `v_memphis_area_schedule`;
- `v_memphis_employee_schedule`;
- `v_memphis_open_segments`;
- `v_memphis_employee_load_summary`.

They do not apply current inheritance or establish one effective location owner.

---

## 6. Consumer trace matrix

| Consumer | Current source | What it currently means | Foundation result |
|---|---|---|---|
| Employee Schedule | `sch_employee_my_schedule_page` → `sch_employee_my_schedule_phase_v1` | Employee-visible claims plus dynamic inheritance | Contradictory during lunch; inheritance is not persisted |
| Manager Schedule `/today` and `/day` | `sch_get_daily_schedule_with_purpose` | Published planned group rows | Does not show employee-page inherited ownership |
| Dashboard | `v_location_dashboard_status` | Last cleaner or active-session cleaner | Does not expose current responsibility |
| Native due/overdue push | `mz_enqueue_employee_location_pushes` | Every location assigned to an employee anywhere in the day | Not current-window ownership; can target multiple/off-shift employees |
| Web due/overdue reminders | `/device-location-status-reminders` | Every planned group assigned to the device's employee | Shift-suppressed, but still not current-window ownership |
| Legacy scan-alert Messenger | `sch_queue_due_scan_alerts` → `sch_get_scan_alert_owner` | Sunday location template first; otherwise planned group schedule | Separate competing owner and delivery path |
| Guest report dispatch | `sch_get_current_owner` | Current planned group row | Misses dynamic inherited owner |
| Memphis AI owner questions | `sch_get_current_owner` and schedule views | Planned owner | Misses inherited owner and contains response-field mismatch |
| Operational analytics | planned schedule views plus actual sessions | Planned load and actual work | Cannot reconstruct effective responsibility history |
| Inspection history | actual cleaning session | Who performed work | Correct for performer, not current owner |

---

## 7. Production evidence — employee Schedule does not perform a true lunch transfer

A lunch transfer should temporarily remove responsibility from the employee on lunch and assign it to the coverer.

The production employee-page function instead exposes both employees as current owners for the same group during lunch.

Deterministic replay for Monday, 2026-08-03:

| Memphis time | Claimed groups | Groups shown to more than one employee | Percentage |
|---|---:|---:|---:|
| 8:30 AM | 20 | 0 | 0.0% |
| 9:30 AM | 24 | 0 | 0.0% |
| 10:30 AM | 24 | 4 | 16.7% |
| 11:30 AM | 24 | 4 | 16.7% |
| 12:30 PM | 24 | 7 | 29.2% |
| 1:30 PM | 24 | 3 | 12.5% |
| 2:30 PM | 24 | 0 | 0.0% |
| 3:30 PM | 24 | 0 | 0.0% |

Examples:

### 10:30 AM

- Courtyard Restrooms:
  - Alijah Collins — `lunch_coverage`
  - Kinnaye Peete — `restroom_upkeep`
- East Admin:
  - Karen Robinson — `lunch_coverage`
  - Kinnaye Peete — `area_owner`
- Education:
  - Markiesha Warren — `lunch_coverage`
  - Kinnaye Peete — `area_owner`
- West Admin:
  - Markiesha Warren — `lunch_coverage`
  - Kinnaye Peete — `area_owner`

### 12:30 PM

- Aquarium:
  - Michael McWright — `lunch_coverage`
  - Markiesha Warren — `area_owner`
- East End Restrooms:
  - Karen Robinson — `lunch_coverage`
  - Sherita Wilbon — `restroom_upkeep`
- MemMex Restrooms:
  - Michael McWright — `lunch_coverage`
  - Markiesha Warren — `restroom_upkeep`
- Teton:
  - Kinnaye Peete — `lunch_coverage`
  - Sherita Wilbon — `area_owner`

Conclusion:

> The current lunch model adds a coverer but does not establish exclusive temporary ownership.

That contradicts the stated system purpose and Final Report language that areas transfer to the coverer and return to the original owner after lunch.

---

## 8. Production evidence — shift-end inheritance exists only inside one employee view

At 2:30 PM on Monday, 2026-08-03, the employee-page function dynamically assigned Michael:

- Breezeway Restrooms;
- Komodos;
- Tropical Birds;
- Zambezi;
- other inherited areas.

However, the published current schedule contained no active row assigning those four groups to Michael at that time.

For representative locations, `sch_get_current_owner` returned OPEN:

- Breezeway Men's Restroom;
- Komodos;
- Tropical Birds;
- Zambezi exhibit and restrooms.

Therefore:

- the employee Schedule could say Michael owns the location;
- guest-report routing could find no owner;
- Memphis AI could report no current owner;
- planned schedule views could show no active owner;
- responsibility analytics could remain blank.

At 5:30 PM, when one employee remained in the replay, the employee-page function replaced the individual location list with:

```text
All Locations
```

That destroys location-level responsibility detail exactly when inherited coverage is most important.

---

## 9. Production evidence — native due/overdue recipient selection is not current ownership

`mz_enqueue_employee_location_pushes` joins each active employee registration to every schedule group assigned to that employee anywhere during the service date.

It does not require:

- the schedule row to be active at `p_now`;
- the employee to be on shift;
- the employee to be the exclusive lunch owner;
- the employee to be the dynamic inherited owner;
- the selected row to supersede competing purposes.

A read-only comparison between employee-visible claims and active employees eligible under the native all-day assignment join produced:

| Memphis time | Groups compared | Matching recipient sets | Mismatched recipient sets | Mismatch |
|---|---:|---:|---:|---:|
| 8:30 AM | 25 | 4 | 21 | 84.0% |
| 10:30 AM | 24 | 4 | 20 | 83.3% |
| 2:30 PM | 24 | 5 | 19 | 79.2% |
| 3:30 PM | 24 | 6 | 18 | 75.0% |

Neither side of this comparison is accepted as canonical. The purpose of the replay is to prove that the two production consumers do not agree.

Examples at 2:30 PM:

- Aquarium:
  - employee-visible owner claim: Markiesha
  - native assignment recipients: Markiesha and Michael
- Breezeway Restrooms:
  - employee-visible owner claim: Michael
  - native assignment recipients: Alijah and Kinnaye
- Expo:
  - employee-visible owner claim: Alijah
  - native assignment recipients: Alijah, Michael, and Sherita
- MemMex Restrooms:
  - employee-visible owner claim: Markiesha
  - native assignment recipients: Kinnaye, Markiesha, and Michael
- Tropical Birds:
  - employee-visible owner claim: Michael
  - native assignment recipients: Alijah and Markiesha
- Zambezi:
  - employee-visible owner claim: Michael
  - native assignment recipients: Markiesha and Michael

The production job log also contains a real completed location-status push sent to Karen's phone for East Admin Men's Restroom at approximately 11:26 PM Memphis time on 2026-07-31.

That demonstrates the native location-push path can deliver outside the employee's scheduled shift.

---

## 10. Production evidence — Sunday uses a competing static authority

All active `location_coverage_templates` are Sunday rows.

On Sunday, `sch_get_location_schedule_owner` chooses location templates before the published group schedule.

Read-only replay for Sunday, 2026-08-02:

| Memphis time | Active locations | Location-template owner selected | Group-schedule owner selected | Chosen owner disagreed with group owner |
|---|---:|---:|---:|---:|
| 10:30 AM | 47 | 45 | 2 | 25 locations / 53.2% |
| 2:30 PM | 47 | 45 | 2 | 25 locations / 53.2% |

Examples included:

- Aquarium:
  - location-template owner: Alijah
  - group-schedule owner: Daniel
- Bonobos Restrooms:
  - location-template owner: Daniel
  - group-schedule owner: Michael
- Breezeway Restrooms:
  - location-template owner: Sherita
  - group-schedule owner: Alijah
- Event Center:
  - location-template owner: Alijah
  - group-schedule owner: Daniel
- Zambezi:
  - location-template owner: Alijah
  - group-schedule owner: Michael

This is not a minor fallback discrepancy. The weekday determines which ownership system answers the same question.

---

## 11. Duplicate due/overdue delivery paths

At least three active paths can surface location-status alerts.

### 11.1 Direct native location push

`mz_enqueue_employee_location_pushes` creates an `employee_native_push` job with:

- notification type `location_status`;
- due-soon or overdue channel;
- location-specific key;
- direct device registration.

### 11.2 Legacy scan-alert Messenger message

The Events maintenance controller calls `sch_queue_due_scan_alerts`.

That path:

1. reads due/overdue Dashboard rows;
2. calls `sch_get_scan_alert_owner`;
3. writes a system message into Messenger;
4. writes a scan-alert log row;
5. later escalates unhandled overdue messages to a manager.

The inserted Messenger message triggers the employee message-push pipeline.

Therefore the same operational state can arrive as:

- a direct location-status push;
- a Memphis Messenger system message;
- a native message push generated from that Messenger insert.

### 11.3 Web reminder polling

`memphis-device-reminders.js` and `/device-location-status-reminders` can separately discover due/overdue state from planned assignment groups.

### 11.4 Dedupe keys do not unify these paths

Direct location status uses a location/status/completion key.

Messenger delivery uses a message ID key.

They are not the same logical event key, so client deduplication cannot reliably collapse them.

### 11.5 Misleading maintenance metadata

The Events maintenance controller labels its result:

- `delivery: native_employee_push_only`
- `messenger_coupling: false`

while it also queues scan-alert Messenger messages.

That metadata does not describe the actual execution path.

---

## 12. Guest report routing defect

Approved guest reports resolve the recipient using:

```text
sch_get_current_owner(location_code, now())
```

That helper reads the current planned daily row, not employee-page inherited ownership.

Consequences:

- an inherited location may route to no employee;
- a lunch-covered location may route to the base owner;
- a Sunday report may disagree with scan-alert ownership;
- the manager receives the report, but the employee who currently sees the area may not.

Guest reporting is approval-gated and optional, but when enabled it must use the same effective owner as Schedule and notifications.

---

## 13. Memphis AI ownership defects

Memphis AI uses:

- `sch_get_current_owner`;
- `v_memphis_area_schedule`;
- `v_memphis_employee_schedule`;
- `v_memphis_open_segments`;
- `v_memphis_employee_load_summary`.

All are planned-row sources and omit dynamic inheritance.

There is also a response-contract mismatch:

- deployed `sch_get_current_owner` returns `assigned_employee_name`;
- deterministic AI summaries check `owner_display_name` or `employee_name`.

Therefore Memphis AI may fail to state an owner even when the database function returned one.

Fixing the field name alone would not solve the foundation problem; it would merely make AI confidently report the wrong ownership model more consistently.

---

## 14. Dashboard semantics

The Dashboard's Employee Name column means:

- active-session cleaner while a session is open;
- otherwise the latest completed cleaner.

It does not mean current owner.

Those are useful inspection-readiness facts, but the label is semantically incomplete.

The final Manager Dashboard should distinguish:

- **Current owner**
- **Cleaning now by**
- **Last cleaned by**
- **Last completed at**
- **Current status**

A location can legitimately be owned by one employee and last cleaned by another. The interface must not blur those facts.

---

## 15. Analytics and accountability gap

Actual cleaning sessions correctly establish who performed work.

Planned schedule rows establish intended baseline or published assignment.

What is missing is a persisted record of who was responsible at each moment after temporary transfers and inheritance.

Without that record, analytics cannot reliably answer:

- who was responsible when the location became due;
- who inherited it when another employee left;
- who temporarily covered it during lunch;
- whether an overdue condition belongs to the original owner or coverer;
- whether an employee's workload was actually fair at that time;
- whether a coaching conclusion is based on responsibility or merely performance history.

This is an anti-misuse requirement. Performance analytics must never infer fault from a planned schedule that the employee no longer owned.

---

## 16. Findings by severity

### BLOCKER 1 — No canonical effective owner

Different production consumers return different owners for the same location and timestamp.

**Required foundation:** one persisted resolver and one non-overlapping effective-ownership dataset.

### BLOCKER 2 — Lunch coverage is additive, not exclusive

The employee Schedule can show the base owner and lunch coverer simultaneously.

**Required foundation:** lunch coverage must close or supersede the base-owner interval for exactly the lunch window, then restore the original owner afterward.

### BLOCKER 3 — Native due/overdue delivery is not current-window scoped

The native worker uses all-day assignment membership and does not enforce current shift or current ownership.

**Required foundation:** due/overdue events must resolve one effective owner at event creation and revalidate ownership immediately before delivery.

### BLOCKER 4 — Competing Sunday location templates

Sunday scan-alert ownership is selected from a separate location-template system that disagrees with the group schedule for more than half the sampled locations.

**Required foundation:** one versioned static schedule compiler; no weekday-specific competing owner authority.

### BLOCKER 5 — Multiple independent alert pipelines

Direct location push, Messenger scan alerts, and web reminder polling can represent the same due/overdue condition with unrelated keys.

**Required foundation:** one canonical notification intent per operational event and one authoritative employee presentation pipeline.

### HIGH 1 — Shift-end inheritance is ephemeral

Inheritance exists only inside an employee-page function and is not available to other consumers.

### HIGH 2 — `All Locations` destroys explicit responsibility

The final employee receives a synthetic label rather than the actual location list.

### HIGH 3 — Guest reports can miss the displayed owner

Guest routing uses planned current rows, not effective ownership.

### HIGH 4 — Memphis AI can return stale, OPEN, or blank ownership

AI uses planned views and checks incompatible response field names.

### HIGH 5 — Manager schedule and employee schedule disagree

Manager schedule routes read planned rows while employees receive dynamic overlays.

### HIGH 6 — No effective-responsibility history

The program cannot safely connect overdue state to the responsible person at that time.

### MEDIUM 1 — Dashboard employee label is ambiguous

It displays cleaner identity without identifying the field as active or last cleaner.

### MEDIUM 2 — Notification worker health contract is incomplete

The employee notification health list does not include schedule-change types that the approved app requires.

### MEDIUM 3 — Events maintenance metadata misstates delivery coupling

The controller says Messenger coupling is false while invoking a Messenger-producing scan-alert function.

---

## 17. Root causes

The defects are not one bad SQL query. They arise from the current data architecture.

### 17.1 Planned work and effective responsibility share the same rows

The system lacks a separate authoritative layer for real-time transfers.

### 17.2 Temporary transfers are represented as overlapping additions

Lunch coverage is added beside the base row rather than replacing it for the interval.

### 17.3 Shift-end inheritance is calculated independently by a reader

No transition is published for other consumers.

### 17.4 Static ownership exists at two granularities

Group templates and Sunday location templates can disagree.

### 17.5 Consumers implement their own precedence

Each function chooses among purpose, group, location, timing, and employee state differently.

### 17.6 Notification generation is coupled to multiple delivery systems

Location state is converted both into operational pushes and Messenger messages.

### 17.7 The schema does not reject overlap

The database accepts conflicting employee intervals for the same location group.

---

## 18. Correct responsibility unit

The canonical responsibility unit must be the **individual operational location**, not merely the display group.

Reasons:

- due/overdue state is location-specific;
- NFC tags resolve individual locations;
- completion sessions are location-specific;
- guest reports are location-specific;
- a group may contain both an exhibit and restrooms;
- 9:45 rebalance can move restroom responsibility while non-restroom ownership remains unchanged.

Location groups remain useful for:

- static schedule authoring;
- proximity and workload calculation;
- employee display grouping;
- event planning;
- manager summaries.

The compiler may expand one approved group assignment into multiple location-level ownership intervals. Employee screens can group them again for readability only after the source of truth is resolved.

The current production database has no active location assigned to more than one active group, which provides a clean migration assumption. That assumption must become an audited constraint or explicit conflict rule.

---

## 19. Target ownership architecture

```text
Versioned static weekly schedule
        ↓
Immutable daily baseline assignments
        ↓
Explicit exception and transfer events
        ↓
Deterministic ownership compiler
        ↓
Non-overlapping effective location intervals
        ↓
Canonical ownership resolver
        ↓
Schedule / Dashboard / alerts / guest reports / AI / analytics
```

### 19.1 Static schedule versions

A static schedule version must contain:

- immutable version ID;
- source/import hash;
- effective date range;
- draft/approved/published/retired state;
- shift templates;
- group/location coverage templates;
- actor and approval history;
- previous-version reference.

### 19.2 Immutable daily baseline

The daily baseline must record exactly what the approved static version produced before exceptions.

It must never be rewritten by a read request.

### 19.3 Exception and transfer events

Examples:

- absence;
- CoverAll capacity;
- 9:45 restroom rebalance;
- lunch start;
- lunch end;
- shift-end inheritance;
- manager reassignment;
- emergency transfer;
- operating-hours change;
- employee activation/inactivation;
- explicit correction.

Each event requires:

- stable idempotency key;
- effective timestamp;
- optional end timestamp;
- previous owner;
- new owner or OPEN;
- affected locations;
- reason code;
- actor/source;
- schedule version;
- status;
- audit metadata.

### 19.4 Effective ownership intervals

Each effective interval should include at least:

- service date;
- location ID and code;
- display group ID/code;
- effective start and end;
- employee/contractor owner or OPEN;
- owner type;
- responsibility purpose;
- baseline assignment ID;
- exception/transition event ID;
- previous owner;
- reason code;
- compiler version;
- schedule version;
- created/published timestamp.

### 19.5 Database constraint

The database must reject overlapping active responsibility intervals for the same location.

Conceptually:

```text
EXCLUDE overlapping [effective_start, effective_end)
for the same location
where responsibility is active
```

A compiler conflict must block publication rather than guess which owner wins.

---

## 20. Deterministic transition rules

Ownership precedence must be resolved when intervals are compiled, not independently by every reader.

The policy must be explicit and testable.

A reasonable starting hierarchy is:

1. active emergency/manual override;
2. published explicit temporary transfer;
3. active lunch coverage;
4. active shift-end inheritance;
5. published 9:45 restroom assignment;
6. absence/CoverAll-adjusted daily assignment;
7. static daily baseline;
8. OPEN.

This hierarchy is not yet authorization to implement. It must be tested against every real workflow and schedule fixture.

### 20.1 Lunch start

At lunch start:

- close/suspend the original effective intervals for covered locations;
- open equivalent intervals for the selected coverer;
- emit one ownership-change event to the coverer;
- do not show those locations to the employee on lunch as current responsibility.

### 20.2 Lunch end

At lunch end:

- close the coverer's temporary intervals;
- restore the original owner if still eligible;
- otherwise continue through shift-end/absence rules;
- notify affected employees once.

### 20.3 Shift end

At an employee's shift end:

- close every effective interval owned by that employee;
- assign each location to an eligible remaining employee using the approved minimal-change/proximity/workload policy;
- publish explicit location intervals;
- notify the receiving employee;
- preserve the actual location list;
- create OPEN exceptions when no eligible employee remains.

### 20.4 9:45 restroom rebalance

At 9:45:

- preserve non-restroom location ownership;
- replace only affected restroom intervals;
- publish exact reviewed owners;
- notify only employees whose restroom responsibility changed.

### 20.5 End of custodial staffing

When all eligible employees have left:

- no employee owner is fabricated;
- locations requiring coverage remain explicit OPEN until public closing or manager resolution;
- the manager system records the uncovered interval;
- employee phones receive no irrelevant ownership message after their shifts end.

---

## 21. Canonical resolver contract

All consumers should call one authoritative resolver or read one authoritative view.

Example conceptual response:

```json
{
  "service_date": "2026-08-03",
  "resolved_at": "2026-08-03T14:30:00-05:00",
  "location_id": "...",
  "location_code": "BREM",
  "location_name": "Breezeway Men's Restroom",
  "group_id": "...",
  "group_code": "BREEZEWAY_RESTROOMS",
  "responsibility_status": "assigned",
  "effective_owner": {
    "owner_type": "employee",
    "employee_id": "...",
    "employee_name": "...",
    "device_id": "KIOSK_...",
    "assignment_epoch": 7
  },
  "effective_start": "2026-08-03T14:00:00-05:00",
  "effective_end": "2026-08-03T15:00:00-05:00",
  "reason_code": "shift_end_inheritance",
  "baseline_owner_id": "...",
  "transition_event_id": "...",
  "schedule_version": "...",
  "ownership_version": "..."
}
```

The resolver must be:

- stable;
- read-only;
- timestamp-aware;
- service-date aware;
- idempotent;
- location-specific;
- explicit about OPEN;
- independent of the requesting screen;
- usable for historical responsibility lookup.

---

## 22. One notification architecture

### 22.1 Canonical operational notification intent

Every due-soon, overdue, ownership-change, event, or message notification should have one durable intent row with:

- one stable logical key;
- recipient ownership version;
- employee;
- device assignment epoch;
- event type;
- route;
- display copy;
- speech copy;
- created/effective/superseded timestamps;
- displayed/opened/dismissed state;
- operational resolution state.

### 22.2 Resolve at creation and revalidate at delivery

For a location-status event:

1. resolve the effective owner at event time;
2. create one notification intent;
3. immediately before delivery, revalidate the ownership version and device assignment epoch;
4. cancel or reroute if ownership changed;
5. deliver once through the native coordinator;
6. preserve manager escalation independently from employee dismissal.

### 22.3 Shift policy

A location-status notification must not be delivered to an employee whose effective responsibility interval is not active.

This is stronger and more correct than merely checking a generic roster shift.

### 22.4 Messenger separation

Due/overdue alerts should not create a second Messenger message merely to obtain a push notification.

If a readable operational alert history is desired, expose the canonical notification log. Do not convert the same alert into an unrelated Messenger message ID.

### 22.5 Dedupe

Every presentation path must share the same logical event key.

Client-side dedupe is a final protection, not a substitute for one server event.

---

## 23. Consumer migration requirements

### Employee Schedule

- read effective intervals for the enrolled employee;
- show only locations currently owned;
- separate lunch coverage and inherited areas for clarity;
- never show the same location to two employees;
- never synthesize inheritance locally;
- never show `All Locations`.

### Manager Schedule

- show static baseline and effective current owner separately;
- expose the transition reason;
- show OPEN intervals;
- preview future transitions;
- preserve exact audit history.

### Dashboard

Add separate fields:

- current owner;
- current responsibility reason;
- active cleaner;
- last cleaner;
- latest completion;
- status;
- ticket state.

### Native notifications

- use canonical effective owner;
- filter by active ownership interval;
- remove all-day assignment recipient joins;
- remove duplicate Messenger scan-alert transport;
- use one notification key.

### Guest reports

- resolve the effective owner at dispatch time;
- preserve manager recipient;
- record which ownership version was used;
- reroute if ownership changes before delivery.

### Memphis AI

- use the canonical resolver for current-owner questions;
- use historical resolver for past responsibility;
- use planned baseline only when explicitly asked about planned schedule;
- correct response-field contracts;
- state OPEN accurately.

### Analytics

- compare actual performer with effective owner only when operationally useful;
- never infer fault solely from static planned ownership;
- retain transition history for workload and coverage analysis.

---

## 24. Build-versus-buy decision for existing components

### Preserve

- static schedule authoring concepts;
- existing location groups and memberships;
- daily schedule preview/publish audit concepts;
- SCH2 stale-preview protection and rollback concepts;
- device assignment epochs;
- native notification coordinator;
- operational notification job framework;
- actual cleaning session evidence;
- Dashboard location status;
- employee/device security boundaries.

### Rebuild from the foundation

- static schedule versioning;
- daily baseline immutability;
- exclusive effective ownership intervals;
- lunch transfer semantics;
- shift-end inheritance publication;
- ownership transition events;
- one ownership resolver;
- one due/overdue event pipeline;
- responsibility-aware analytics.

### Retire or absorb

- Sunday-only `location_coverage_templates` as an independent authority;
- reader-local inheritance;
- `All Locations` substitution;
- scan-alert Messenger as a second due/overdue transport;
- consumer-specific owner precedence;
- direct all-day assignment recipient selection;
- hard-coded employee-name scheduling rules.

---

## 25. Plan self-audit

### Requirement: static schedules remain normal authority

**Pass in target plan.** Effective intervals begin with an immutable static daily baseline.

### Requirement: dynamic scheduling is exception-only

**Pass.** Ownership transitions are explicit exceptions applied to the baseline.

### Requirement: minimize unnecessary movement

**Pass, subject to solver specification.** Each transition affects only invalid or transferred intervals.

### Requirement: every location has a responsible party until staff leave

**Pass.** The compiler must produce one owner or explicit OPEN for each location/time.

### Requirement: lunch temporarily transfers ownership

**Pass.** The base interval is superseded during lunch rather than left active.

### Requirement: 9:45 only changes restroom ownership

**Pass.** Location-level compilation can preserve non-restroom locations in mixed groups.

### Requirement: shift-end inheritance is visible and not fabricated

**Pass.** It becomes persisted location intervals; no `All Locations` shortcut.

### Requirement: employees choose their own work order

**Pass.** Ownership determines responsibility, not route order.

### Requirement: notification reflects current responsibility

**Pass.** One event resolves and revalidates the effective owner.

### Requirement: manager can inspect with correct context

**Pass.** Dashboard separates current owner from actual cleaner and latest cleaner.

### Requirement: preserve history and prevent unfair conclusions

**Pass.** Transition events make responsibility historically queryable.

### Requirement: support future live phone map

**Pass.** Location responsibility and device identity remain separable; future device position can be overlaid without redefining ownership.

### Remaining plan risks

- exact transition precedence requires fixture-based audit;
- CoverAll owner representation requires contractor-specific design;
- mixed exhibit/restroom groups require full location-expansion verification;
- migration from existing Sunday location templates requires source-of-truth reconciliation;
- current production data must be preserved without treating conflicts as approved truth.

---

## 26. Required tests before implementation acceptance

### Database tests

- no overlapping active ownership intervals per location;
- every required location/time has one owner or OPEN;
- lunch closes base interval and restores correctly;
- shift-end closes departing owner and creates exact inherited intervals;
- 9:45 changes restroom locations only;
- manager override supersedes and then restores correctly;
- repeated event application is idempotent;
- unchanged baseline and exception set reproduces identical output;
- historical resolver returns the same result after later schedule changes.

### Scenario fixtures

At minimum:

1. normal static day;
2. one absence;
3. multiple absences;
4. CoverAll addition;
5. overlapping lunch windows;
6. 9:45 rebalance before a lunch;
7. lunch overlapping shift end;
8. employee leaves before 9:45;
9. two employees remain;
10. one employee remains;
11. no employees remain before public close;
12. seasonal close changes to 5:00 PM;
13. manager emergency reassignment;
14. employee/phone reassignment during the day;
15. offline employee phone;
16. overdue status occurs during ownership transition.

### Consumer contract tests

For the same location and timestamp, assert identical owner identity from:

- employee Schedule;
- manager Schedule;
- canonical resolver;
- native due/overdue intent;
- guest report routing;
- Memphis AI tool result;
- Dashboard current-owner field;
- analytics responsibility query.

### Notification tests

- one due event creates one logical notification;
- no Messenger duplicate;
- current effective owner only;
- no off-shift delivery after interval closes;
- ownership change supersedes pending job;
- stable key survives retries;
- displayed/opened/dismissed are recorded once;
- scanning/completing the location cancels pending escalation correctly.

### Physical-phone tests

- current ownership update appears without manual Refresh;
- lunch areas appear only on coverer's phone;
- lunch areas disappear at the end;
- inherited locations appear individually;
- due/overdue alert reaches the correct phone once;
- ownership changes while a phone sleeps;
- ownership changes while offline and reconciles on reconnect;
- no notification plays after the employee's responsibility interval ends.

---

## 27. Foundation implementation sequence — not yet authorized

The correct sequence is:

1. freeze and export existing ownership data for analysis;
2. define versioned static schedule schema;
3. define immutable daily baseline schema;
4. define exception/transition event schema;
5. define effective location interval schema and overlap constraint;
6. build deterministic compiler in isolation;
7. build canonical current/historical resolver;
8. backfill a shadow ownership model from existing schedules;
9. compare every existing consumer against the shadow resolver;
10. resolve conflicts through audited rules, not automatic trust;
11. independently audit the architecture and migration;
12. cut consumers over to the canonical resolver;
13. retire duplicate authorities and alert paths;
14. build and physically test the employee APK;
15. admit a new release only after source, APK, and Moto G acceptance.

The shadow comparison is a migration safety technique, not a permanent compatibility patch. The final product must have one authority.

---

## 28. Immediate next research work

Before ownership implementation can begin:

1. reconstruct the approved static schedule source against both group and Sunday location templates;
2. identify whether Sunday location templates are obsolete, generated, or separately intended;
3. audit every mixed exhibit/restroom group at the individual-location level;
4. specify exact exception precedence with real schedule fixtures;
5. specify CoverAll effective-owner identity and notification behavior;
6. trace scan-alert completion and manager escalation cancellation;
7. define retention for ownership transitions;
8. produce the canonical ownership architecture plan for independent audit.

---

## 29. Current verdict

### Ownership foundation verdict: **NO-GO FOR IMPLEMENTATION CUTOVER**

This is not a final product verdict. It means the current ownership architecture cannot safely be used as the foundation for the completed employee app without redesign.

The system has many strong components, but ownership is currently split among several authorities. Building more Schedule, notification, AI, guest-report, or analytics behavior on those competing definitions would harden the wrong foundation.

No product, database, phone, build, or release change was made during this audit.
