# Memphis Zoo Custodial Program — Production Truth Research v1

**Status:** SELECT-only production reconstruction; no implementation authorization  
**Prepared:** 2026-08-04  
**Supabase project:** Memphis Zoo Custodial Tracking System  
**Database engine:** PostgreSQL 17  
**Backend source reference:** `lasrevinu333-design/memphis-zoo-mcp@0fff8c2cadea132902df22c99593f1ce348411a7`  
**Frontend/architecture reference:** `lasrevinu333-design/Engine@92cc7a95c6c0beb211db27ac510fa725aa3c23c0`

---

## 1. Scope and safety

This report records deployed database structure, function definitions and aggregate data inspected through SELECT-only queries.

No function with operational side effects was invoked. No row, schema object, policy, role, setting, schedule, employee, device, notification, credential or production behavior was changed.

Sensitive values are intentionally excluded. This report records architecture-relevant patterns, counts and function behavior rather than credentials, raw coordinates, message content, private notes or current employee/device telemetry.

---

## 2. Executive findings

Production confirms the central architecture diagnosis:

1. The program contains broad, legitimate capability far beyond scheduling.
2. Current ownership authority is split among group templates, Sunday location templates, mutable daily rows and multiple resolver functions.
3. Read or communication activity can generate schedules.
4. Absence changes can force whole-day deletion and regeneration.
5. One remaining employee can be presented as `All Locations`, and a named employee code is hard-coded into late-coverage behavior.
6. Any inserted scan event clears active legacy scan alerts for that location.
7. Dashboard `okay` is a time-since-completion status, not a complete inspection-readiness determination.
8. Employee identity, employment, scheduling eligibility, phone eligibility and Messenger eligibility are conflated around one `active` Boolean.
9. CoverAll remains represented by active staff pseudo-employees.
10. Workload and geography data are incomplete at the authoritative location level and are not versioned.
11. The operating-hours table is empty; schedule close falls back to 6:00 PM, so the September 14 seasonal transition is not authoritative.
12. RLS and privileged-function boundaries are generally strong and should be preserved.

These are foundation defects. They are not candidates for another collection of local patches.

---

## 3. Deployed capability breadth

The public schema contains production objects for:

- schedules, coverage templates, absence, PTO, lunch and rebalance;
- employees, aliases, devices, assignment history and enrollment;
- sessions, scan events, completion responses and GPS proximity;
- maintenance tickets, inspections and performance views;
- Messenger users, threads, messages, receipts, deletion/hide and retention;
- employee and manager notifications, push registration and acknowledgement;
- events, event history, venues, reminders and push instances;
- guest cleanliness reports and contact redaction;
- system feedback and image backups;
- manager trusted devices and device security;
- release manifests, validation runs, schema identity and recovery tooling.

This confirms that the whole-program architecture must explicitly include these domains. They cannot remain hidden implementation details behind an ownership compiler.

---

## 4. Employee lifecycle is structurally conflated

### 4.1 Current `employees` table

The deployed employee entity contains:

- permanent UUID;
- employee code;
- display name;
- one `active` Boolean;
- role;
- notes;
- timestamps.

It does not separately represent:

- employment state;
- scheduling eligibility;
- schedule-position occupancy;
- phone eligibility;
- Messenger eligibility;
- leave/absence state;
- vacancy;
- historical-only identity;
- test-fixture state.

### 4.2 Current data pattern

Production currently includes four active `COVERALL_01` through `COVERALL_04` records with staff role and no assigned employee phone. Real employees and contractor placeholders therefore share the same employee identity table and active-state mechanism.

Michael McWright and Daniel Morgan remain active employee records with device assignments. Their history must remain intact, but future staffing must not depend on keeping a departed identity operationally active.

### 4.3 Architecture consequence

The unified model must separate:

```text
permanent employee identity
employment state
schedule eligibility
Messenger eligibility
phone eligibility
schedule position
position occupancy
absence/PTO
vacancy
contractor engagement
historical/test-fixture state
```

A replacement employee receives a new identity. A vacant position remains vacant. CoverAll is not migrated as an employee.

---

## 5. Competing static schedule authorities

### 5.1 Group templates

Production contains:

- 824 total group coverage-template rows;
- 339 active rows across all seven weekdays;
- 25–28 active groups per weekday;
- 4–8 active employee identities represented per weekday;
- purposes including `deep_clean`, `area_owner`, `restroom_upkeep` and `reminder`.

Active row counts by weekday are:

| Day-of-week value | Active group rows |
|---:|---:|
| 0 | 49 |
| 1 | 52 |
| 2 | 49 |
| 3 | 46 |
| 4 | 48 |
| 5 | 49 |
| 6 | 46 |

These rows are mutable in place and directly reference employee identities. They have no immutable schedule version or effective-date publication boundary.

### 5.2 Sunday location templates

Production also contains:

- 135 active location-level template rows;
- all on day-of-week 0;
- 45 locations;
- 4 assigned employee identities;
- purposes `deep_clean`, `area_owner`, `restroom_upkeep` and `late_coverage`.

No location-level template rows exist for the other six weekdays.

### 5.3 Exact Sunday comparison

Expanding active Sunday group templates through current active group membership produces:

- 94 location-level rows;
- 47 distinct locations;
- 48 source group-template rows;
- 24 source groups.

A multiset comparison against the 135 active Sunday location templates found:

- 43 exact matches;
- 51 rows present only in the group expansion;
- 92 rows present only in the location templates.

By purpose:

| Purpose | Exact | Group-only | Location-only |
|---|---:|---:|---:|
| `area_owner` | 6 | 27 | 9 |
| `deep_clean` | 29 | 18 | 16 |
| `late_coverage` | 0 | 0 | 45 |
| `restroom_upkeep` | 8 | 6 | 22 |

The location rows are not a faithful materialization of the current group schedule. They are competing historical authority.

### 5.4 Orphan schedule rule

One active Sunday group template references East End Break Room as a reminder but has no active location-group membership. The schedule can therefore contain an active authoring rule that expands to no operational location.

### 5.5 Architecture consequence

- Group and location templates cannot remain competing current resolvers.
- Imported static policy must be immutable, effective-dated and source-provenanced.
- Group membership must be snapshotted per schedule version.
- Publication must expand to individual locations and reject orphan authoring rows.
- Historical Sunday rows remain migration evidence only.

---

## 6. Mixed groups prove group-level ownership is inadequate

Seven active groups combine restroom and non-restroom locations:

- China;
- East Admin;
- Event Center;
- Expo;
- Teton;
- West Admin;
- Zambezi.

Examples include one exhibit/building plus two restrooms; West Admin contains one building plus four restrooms.

A group-level 9:45 reassignment cannot move only restroom responsibility while preserving the exhibit/building owner. Location-level authority is mandatory.

---

## 7. Current resolver functions disagree by design

### 7.1 `sch_get_current_owner`

This resolver:

- finds the first active group membership for a location;
- reads the group daily schedule;
- selects one active segment;
- returns `OPEN` when no group row is found.

It does not consider Sunday location templates.

### 7.2 `sch_get_location_schedule_owner`

This resolver:

- reads location-level templates first;
- falls back to group daily schedule;
- assigns purpose ranks;
- selects the first ranked row;
- joins Messenger user/device identity.

Location-template rows therefore outrank group rows when present.

### 7.3 `sch_get_scan_alert_owner`

This is a wrapper over `sch_get_location_schedule_owner`, so alert routing uses a different ownership path from `sch_get_current_owner`.

### 7.4 Architecture consequence

The same location and timestamp can be interpreted through different static authorities and precedence rules depending on the caller. A single published resolver contract and ownership revision must replace all three paths.

No consumer is permitted to apply independent fallback or purpose precedence.

---

## 8. Employee Schedule currently contains hidden ownership logic

### 8.1 `sch_employee_my_schedule_page`

The employee page function:

- requires `employees.active = true`;
- reads mutable daily schedule assignments;
- returns current items plus the entire day;
- emits technical/manager language such as missing generated assignments and contacting an Ops Manager;
- depends on a separate phase function for current behavior.

### 8.2 `sch_employee_my_schedule_phase_v1`

The deployed phase function:

- hard-codes the 9:45 boundary;
- falls back to 6:00 PM close;
- dynamically calculates current active employees and load;
- synthesizes shift-end inheritance inside the read;
- calls the weighted coverage-candidate solver during the read;
- may present the one remaining employee as `All Locations` rather than exact locations;
- contains a hard-coded `EMP002` condition to label late coverage;
- can therefore show ownership not persisted as universal system truth.

### 8.3 `sch_employee_my_schedule_summary`

The older summary function reads static group templates and emits phrases including `normal route`.

### 8.4 Architecture consequence

- Employee Schedule must be a projection of canonical published ownership, not a local scheduler.
- No employee-specific read may invent inheritance or use a special employee code.
- Exact locations replace `All Locations`.
- Employee wording uses current areas, not route terminology.

---

## 9. Schedule generation is destructive and broadly optimizing

### 9.1 `sch_generate_daily_schedule`

When called with force:

- deletes all daily schedule assignments for the date;
- deletes the daily work roster for the date;
- rebuilds roster from employee-bound templates and `employees.active`;
- applies overrides and absences;
- upserts group assignments from mutable coverage templates;
- falls back to legacy daily group assignments;
- automatically reassigns open rows through weighted coverage candidates;
- applies lunch coverage;
- updates rows in place.

The uniqueness key is group/date/segment, not a versioned location-level interval and purpose.

### 9.2 Absence publication

`sch_absence_publish`:

- replaces active manual absence rows;
- writes the new absence set;
- calls forced daily generation.

A trigger on every insert/update/delete of `daily_absence_overrides` calls `sch_regenerate_existing_schedules_for_absence_range`, which calls forced generation for existing days.

### 9.3 Architecture consequence

An absence or CoverAll change can reconstruct the full day and overwrite reviewed state. The replacement must use:

```text
append-only exception fact
→ deterministic candidate revision
→ exact affected-location diff
→ conflict and OPEN validation
→ named-manager approval
→ atomic publication
```

Unaffected static ownership must remain unchanged.

---

## 10. Communication reads can generate schedules

The deployed `msg_memphis_pre_generate_schedule` trigger runs after a message is inserted in the Memphis channel. When the message contains scheduling, staffing, cleaning, coverage or location keywords, it invokes `sch_generate_daily_schedule` for today, tomorrow or a week range.

Consequences:

- asking Memphis a schedule question can write operational schedule state;
- an AI/read interaction is not read-only;
- exceptions are swallowed as warnings, making mutation failure opaque;
- the trigger can invoke the destructive generator.

This path must be retired. AI, Messenger, Schedule, Dashboard and report reads never generate or mutate operational authority.

---

## 11. Any scan event clears legacy alerts

Production has an `AFTER INSERT` trigger on `scan_events` that calls `sch_clear_scan_alerts_after_scan_event`.

That function clears all active scan-alert log rows for the location regardless of event type. Current scan events include at least:

- `scan_received`;
- `scan_start`;
- `scan_resume_pending`;
- `scan_finish`;
- `work_position_check`.

A receipt, start, resume or GPS/work-position event can therefore suppress due/overdue escalation before accepted completion.

The replacement operational episode is resolved only by:

- authoritative accepted completion that advances location status; or
- explicit named-manager correction.

Presentation dismissal and scan receipt remain separate evidence.

---

## 12. Dashboard status is not inspection readiness

### 12.1 `v_location_dashboard_status`

The current status projection returns:

- `in_progress` when a session is active or pending submit;
- `not_cleaned` when no current-day completion exists;
- `due_soon` and `overdue` from time since latest completion;
- otherwise `okay`.

Restroom defaults are 90 minutes due soon and 120 minutes overdue. Exhibit defaults are 195 and 240 minutes.

The `okay` result does not incorporate:

- unresolved maintenance issue severity;
- out-of-order fixture impact;
- required follow-up;
- inspection result;
- manager correction;
- location closure/not-required state;
- owner responsibility;
- evidence confidence.

### 12.2 Inspection and analytics views

Production has valid inspection and performance capability, but comparison views aggregate closed-session duration, tickets and inspection scores without canonical historical ownership, workload version, transfer context, offline timing confidence or explicit evidence thresholds.

### 12.3 Architecture consequence

The unified architecture must define separate facts for:

- requirement state;
- due/overdue episode;
- active work;
- accepted completion;
- issue/out-of-order/follow-up;
- inspection state;
- inspection readiness;
- historical responsibility;
- evidence confidence.

A Dashboard conditional cannot define truth for the rest of the system.

---

## 13. Workload and route truth is incomplete and unversioned

### 13.1 Current group-level data

Among 29 active groups:

- only 6 active group workload-setting rows exist;
- only 5 active-group rows were returned in the current workload inventory;
- active group-scoring rows: 0;
- 28 groups have active proximity records and coordinates;
- 29 have group-zone assignments;
- the active adjacency graph contains 756 directed rows with walking minutes, equivalent to a complete directed graph among 28 represented groups.

Manual workload values exist for a small set of gift-shop/reminder and light-restroom cases. They are notes and group-level points, not a full operational model.

### 13.2 Current location-level data

Among 47 active locations:

- only 3 have active location-level proximity records with coordinates;
- 0 have active location-zone assignments;
- `locations` has optional difficulty, priority and workload-note fields but no versioned per-purpose expected minutes or service frequency.

### 13.3 Missing version identity

Current group proximity, adjacency, zone and workload tables are mutable and have no published route/workload model revision tied to schedule compilation.

### 13.4 Architecture consequence

The compiler cannot be historically deterministic from mutable group geometry and sparse location workload. Required research and versioning includes:

- location and purpose;
- expected minutes/load points;
- frequency;
- difficulty;
- priority;
- restrictions;
- season/window;
- zone;
- adjacency;
- walking time;
- source and confidence;
- effective revision.

Values must come from field research, not mechanical division of group numbers.

---

## 14. Operating-hours truth is missing

The deployed `operating_hours` table is empty.

`sch_get_schedule_close_time` therefore falls back to 6:00 PM for every date unless a dated row is manually inserted. The setter assumes a default opening time of 5:00 AM.

Consequences:

- September 14 seasonal closing is not represented;
- historical replay depends on a fallback constant;
- location-specific, split-hour and after-hours requirements cannot be derived from this table;
- no immutable operating-policy revision applies to a date range.

The replacement requires versioned zoo and location operating-policy rules, explicit seasonal boundaries and approved event/closure overrides.

---

## 15. Notification and escalation authority is fragmented

Production includes:

- legacy scan-alert logs;
- due/overdue queue functions;
- manager escalation messages;
- operational notification jobs;
- employee push jobs;
- manager notification queues;
- push registrations;
- device acknowledgement records;
- browser and native local presentation state.

The legacy due/overdue queue reads `v_location_dashboard_status`, resolves a schedule owner and writes Messenger/alert evidence. Manager escalation selects one active manager Messenger identity by ordering, not a unified role/authority resolver.

The final architecture must separate and link:

```text
operational episode
recipient intent
transport job
provider result
device receipt
presentation lifecycle
local acknowledgement
server acknowledgement
manager escalation
work resolution
```

Immediately before send, the system revalidates episode status, effective owner/revision, recipient authority and device assignment epoch.

---

## 16. Retention is partially configured but not unified

Current settings include:

- messages: 14 days;
- event notices/events: 14 days;
- resolved feedback: 180 days;
- resolved guest reports: 3650 days;
- closed maintenance: 3650 days;
- scan history: 3650 days;
- schedule past/future window: 45 days;
- system logs: 30 days;
- guest contact: 30 days;
- operational-history mode: preserve.

Guest reporting is currently disabled and Marketing review is required.

The legacy free-tier retention function is disabled and reports that event/audit history is preserved. Separate purge/redaction functions still exist for messages, events and guest contact.

Missing or insufficiently defined:

- raw GPS points versus durable GPS summary;
- notification presentation attempts;
- responsibility history independent from schedule-window cleanup;
- Messenger archive versus employee presentation retention;
- event source evidence versus published notice retention;
- feedback/guest attachments;
- legal/incident holds;
- backup retention and restore evidence.

One data-class matrix must govern archive, purge, redaction, holds and foreign-key behavior.

---

## 17. Security strengths to retain

A sample of critical production tables has RLS enabled and forced. High-value service functions such as cleaning commit, native enrollment, employee/device administration and message send use `SECURITY DEFINER`, locked search paths and service-role-only execution.

The reviewed critical functions do not grant execute to `public`, `anon` or `authenticated`; service-role execution is retained.

These are strong foundations. The unified architecture must preserve:

- forced RLS;
- no direct client schedule writes;
- revoked broad execution;
- locked `search_path` for privileged functions;
- named actor attribution at the backend boundary;
- protected native credential isolation;
- device assignment epoch validation;
- fail-closed release and recovery controls.

Security strength in one path does not cure duplicate operational authority elsewhere.

---

## 18. Device-enrollment state

At the time of this read-only inspection:

- device-auth policy mode remained `observe`;
- one current active/confirmed/used employee-device credential existed;
- one active employee push registration existed.

This is not a fleet-enforcement state. The architecture and rollout plan must keep enforcement gated until every in-service phone has:

- a credential;
- confirmed use;
- assignment epoch;
- push registration where required;
- tested manager recovery;
- tested offline/active-work protection.

No policy change was made.

---

## 19. Current constraint model is insufficient for the target

Examples:

- group templates are unique by group/day/segment, preventing distinct purposes from sharing a segment but not proving temporal completeness;
- daily assignments are unique by date/group/segment, not location, time range, purpose or publication revision;
- location templates are unique by location/day/segment but have no version/effective date;
- shift templates are employee-bound and require `shift_end > shift_start`, so cross-midnight shifts are not represented;
- group membership is unique by location and mutable, with no historical schedule snapshot;
- there is no exclusion constraint preventing overlapping published effective ownership intervals because those canonical tables do not yet exist.

The new schema must be designed as one enforceable temporal/security system after the unified architecture is accepted. Adding isolated constraints to the legacy tables is not the final repair.

---

## 20. Production-truth conclusions

### Retain

- permanent source and history concepts already present;
- RLS and service-role boundaries;
- native credential and assignment-epoch foundations;
- session/completion evidence;
- inspection, analytics, event, guest, feedback and release capabilities;
- backup/rebuild/fingerprint/admission mechanisms after independent verification.

### Rebuild

- schedule source/version/publication;
- employee and position lifecycle;
- location-level ownership;
- workload and route model;
- operating requirements;
- status and inspection readiness;
- session/ownership binding and offline reconciliation;
- notification/ack/escalation;
- event approval and operational impact;
- contractor engagement/acceptance;
- retention and whole-program migration.

### Retire

- Sunday location templates as independent authority;
- CoverAll pseudo-employees;
- employee-read inheritance;
- `All Locations` synthetic ownership;
- hard-coded employee-specific scheduling;
- scan-event alert resolution;
- AI/read-triggered schedule generation;
- forced whole-day regeneration for ordinary exceptions;
- mutable fallback authority and permanent dual read/write.

---

## 21. Remaining production research

1. Complete deployed definitions of all schedule writers and duplicate function versions.
2. Exact live current-owner discrepancies across representative dates/times.
3. Source artifact and approval trail for every weekday schedule.
4. Production schedule-to-position/person-bound mapping candidates.
5. Current event-to-schedule coupling beyond the Memphis trigger.
6. Messenger hide/delete/purge and archive behavior.
7. Guest/feedback attachment storage and access policies.
8. GPS raw observation tables, volume, purge and hold behavior.
9. Notification job dedupe, recipient revalidation and terminal-failure handling.
10. Release validation, backup and restore records.
11. Current cron jobs and worker schedules.
12. Full grants/RLS/SECURITY DEFINER review for every target domain.

These remain read-only research tasks. No implementation is authorized by this report.