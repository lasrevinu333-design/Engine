# Memphis Zoo Custodial System — Canonical Database Schema Design

**Status:** Component-level schema design v1; not a migration  
**Prepared:** 2026-08-03  
**Architecture basis:** Canonical Operations Architecture v2  
**Live database inspected:** PostgreSQL 17.6 through read-only Supabase SQL  
**Implementation authorization:** none

---

## 1. Purpose

This document translates the approved architecture direction into an enforceable PostgreSQL design.

The database—not individual pages, backend routes or AI tools—must reject contradictory responsibility states. Application code may preview and explain a schedule, but it may not create a second ownership authority.

This is a design specification only. No SQL in this document has been applied to production.

---

## 2. Existing database facts that affect the design

Read-only production inspection confirmed:

- PostgreSQL 17.6;
- `pgcrypto`, `uuid-ossp` and `pg_cron` installed;
- `btree_gist` available but not installed;
- current employee, device, session, schedule and notification tables use UUID primary keys;
- current schedule rows are group-level and use mutable unique keys;
- current `daily_schedule_assignments` permits one row per group/segment but does not prevent location-level ownership contradictions;
- current sessions retain employee, device and location foreign keys;
- current operational notification jobs have a durable lease/retry foundation;
- current RLS/service-role patterns can be retained and strengthened.

The new schema should use `extensions.btree_gist` or an equivalent reviewed extension placement to enforce non-overlapping temporal assertions.

---

## 3. Naming and deployment rules

New canonical objects use the `custodial_` prefix until legacy authorities are retired.

Rules:

- migration is source-controlled and reviewed;
- all tables use UUID primary keys unless a sequence is semantically required;
- all timestamps are `timestamptz`;
- all operational intervals are half-open `[start,end)`;
- published records are immutable;
- revisions append and supersede;
- direct table access is revoked from `public`, `anon` and `authenticated` unless explicitly justified;
- service/manager/employee access is exposed through reviewed functions or backend APIs;
- RLS is enabled and forced on protected operational tables;
- every write path carries an actor, operation ID and correlation ID;
- no trigger may silently regenerate a complete day because a row was read or one exception changed.

---

## 4. Required extension

Migration preflight:

```sql
select name, default_version, installed_version
from pg_available_extensions
where name = 'btree_gist';
```

Source-controlled migration requirement:

```sql
create extension if not exists btree_gist with schema extensions;
```

The migration must verify the installed extension schema and version before creating exclusion constraints.

---

## 5. Operating-policy schema

## 5.1 `custodial_operating_policy_versions`

Purpose: immutable version header for operating hours, transitions, alert thresholds and GPS rules.

Core columns:

```sql
id uuid primary key default gen_random_uuid(),
version_number integer not null unique,
status text not null,
effective_start_date date not null,
effective_end_date date null,
timezone text not null default 'America/Chicago',
default_open_time time not null,
default_close_time time not null,
restroom_phase_time time not null default time '09:45',
raw_gps_retention_days integer null,
policy_json jsonb not null default '{}'::jsonb,
source_hash text not null,
created_by text not null,
approved_by text null,
published_by text null,
created_at timestamptz not null default now(),
approved_at timestamptz null,
published_at timestamptz null,
retired_at timestamptz null,
previous_version_id uuid null references custodial_operating_policy_versions(id)
```

Checks:

- status in `draft`, `validated`, `approved`, `published`, `retired`;
- close after open for same-day default window;
- effective end not before start;
- published rows require approval/publication actor and timestamps;
- source hash is one lowercase SHA-256 digest;
- raw GPS retention remains null until explicitly approved; publication requiring GPS accountability must reject null.

Only one published version may cover a service date. Enforce with a date-range exclusion constraint or publication function guard.

## 5.2 `custodial_location_window_rules`

Purpose: location-specific, seasonal, event, maintenance and emergency operating windows.

Core columns:

```sql
id uuid primary key default gen_random_uuid(),
policy_version_id uuid not null references custodial_operating_policy_versions(id),
authority_class text not null,
location_id uuid null references locations(id),
event_id uuid null references events_app_events(id),
effective_dates daterange not null,
day_of_week integer null,
window_start time null,
window_end time null,
requirement_state text not null,
reason_code text not null,
source_ref text null,
revision integer not null default 1,
supersedes_rule_id uuid null references custodial_location_window_rules(id),
created_by text not null,
created_at timestamptz not null default now()
```

Checks:

- authority class in `zoo_default`, `location_normal`, `seasonal`, `event`, `dated_override`, `emergency_shutdown`;
- requirement state in `required`, `not_required`;
- weekday 0–6 when present;
- both window times present or both absent;
- location required for every non-zoo-default rule;
- event ID required only for event authority;
- revision positive.

Equal-authority overlapping rules for the same location/date/weekday are rejected unless one explicitly supersedes the other.

---

## 6. Employee eligibility and schedule positions

## 6.1 `custodial_employee_eligibility_assertions`

Purpose: retain permanent employee identity while versioning operational eligibility.

Core columns:

```sql
id uuid primary key default gen_random_uuid(),
employee_id uuid not null references employees(id) on delete restrict,
valid_start timestamptz not null,
valid_end timestamptz not null,
recorded_start timestamptz not null default now(),
recorded_end timestamptz not null default 'infinity',
employment_status text not null,
schedule_eligible boolean not null,
device_eligible boolean not null,
messaging_eligible boolean not null,
absence_eligible boolean not null default true,
capabilities_json jsonb not null default '{}'::jsonb,
restrictions_json jsonb not null default '{}'::jsonb,
reason_code text not null,
assertion_revision integer not null,
supersedes_assertion_id uuid null references custodial_employee_eligibility_assertions(id),
actor text not null,
operation_id uuid not null,
created_at timestamptz not null default now(),
valid_range tstzrange generated always as (tstzrange(valid_start,valid_end,'[)')) stored,
recorded_range tstzrange generated always as (tstzrange(recorded_start,recorded_end,'[)')) stored
```

Checks:

- valid end after start;
- recorded end after recorded start;
- employment status in `employed`, `departing`, `inactive`, `historical`, `test_only`;
- revision positive;
- one current assertion family revision per operation.

Exclusion:

```sql
exclude using gist (
  employee_id with =,
  valid_range with &&,
  recorded_range with &&
)
```

This allows corrected historical assertions while preventing two simultaneous current truths.

## 6.2 `custodial_schedule_positions`

Purpose: stable schedule identity independent of the current employee occupant.

Core columns:

```sql
id uuid primary key default gen_random_uuid(),
position_code text not null unique,
display_name text not null,
required_capabilities jsonb not null default '{}'::jsonb,
restrictions_json jsonb not null default '{}'::jsonb,
active boolean not null default true,
created_at timestamptz not null default now(),
retired_at timestamptz null
```

## 6.3 `custodial_schedule_position_occupants`

Core columns:

```sql
id uuid primary key default gen_random_uuid(),
position_id uuid not null references custodial_schedule_positions(id) on delete restrict,
employee_id uuid not null references employees(id) on delete restrict,
valid_start date not null,
valid_end date not null,
recorded_start timestamptz not null default now(),
recorded_end timestamptz not null default 'infinity',
reason_code text not null,
operation_id uuid not null,
valid_range daterange generated always as (daterange(valid_start,valid_end,'[)')) stored,
recorded_range tstzrange generated always as (tstzrange(recorded_start,recorded_end,'[)')) stored
```

Exclusion prevents overlapping occupants for the same position across overlapping recorded truth. A person may occupy only one position at one time unless an explicit reviewed multi-position rule exists.

---

## 7. Static schedule schema

## 7.1 `custodial_schedule_versions`

Core columns:

```sql
id uuid primary key default gen_random_uuid(),
version_number integer not null unique,
status text not null,
effective_start_date date not null,
effective_end_date date null,
source_name text not null,
source_hash text not null,
import_fingerprint text not null,
previous_version_id uuid null references custodial_schedule_versions(id),
created_by text not null,
approved_by text null,
published_by text null,
created_at timestamptz not null default now(),
approved_at timestamptz null,
published_at timestamptz null,
retired_at timestamptz null,
validation_report jsonb not null default '{}'::jsonb
```

Checks parallel operating-policy publication checks. One published version may cover a service date.

## 7.2 `custodial_schedule_shift_rows`

```sql
id uuid primary key default gen_random_uuid(),
schedule_version_id uuid not null references custodial_schedule_versions(id) on delete restrict,
position_id uuid not null references custodial_schedule_positions(id) on delete restrict,
day_of_week integer not null,
shift_start time not null,
shift_end time not null,
lunch_start time null,
lunch_end time null,
source_row_ref text null,
notes text null,
unique(schedule_version_id,position_id,day_of_week)
```

Checks:

- weekday 0–6;
- shift end after start;
- lunch start/end both present or absent;
- lunch fully inside shift.

## 7.3 `custodial_schedule_assignment_rows`

```sql
id uuid primary key default gen_random_uuid(),
schedule_version_id uuid not null references custodial_schedule_versions(id) on delete restrict,
position_id uuid null references custodial_schedule_positions(id) on delete restrict,
day_of_week integer not null,
phase_code text not null,
coverage_start time not null,
coverage_end time not null,
target_kind text not null,
location_group_id uuid null references location_groups(id) on delete restrict,
member_scope text not null,
coverage_purpose text not null,
load_points numeric(8,2) not null,
source_row_ref text null,
notes text null,
sequence_number integer not null,
unique(schedule_version_id,day_of_week,sequence_number)
```

Checks:

- weekday 0–6;
- end after start;
- target kind in `group`, `explicit_locations`;
- group ID present only for group target;
- member scope in `all_members`, `restroom_members`, `non_restroom_members`, `explicit_locations`;
- explicit target requires explicit scope;
- position may be null only for a planned vacant/open assignment;
- purpose in approved policy-controlled values;
- load points positive.

## 7.4 `custodial_schedule_assignment_locations`

```sql
assignment_row_id uuid not null references custodial_schedule_assignment_rows(id) on delete cascade,
location_id uuid not null references locations(id) on delete restrict,
primary key(assignment_row_id,location_id)
```

Publication validation enforces:

- explicit targets contain at least one location;
- group targets do not contain explicit child rows;
- mixed-group scopes expand deterministically;
- every active NFC location is covered or deliberately open during required windows;
- restrictions and shifts are valid.

---

## 8. Immutable daily baseline schema

## 8.1 `custodial_daily_baselines`

```sql
id uuid primary key default gen_random_uuid(),
service_date date not null,
revision integer not null,
status text not null,
schedule_version_id uuid not null references custodial_schedule_versions(id),
policy_version_id uuid not null references custodial_operating_policy_versions(id),
input_fingerprint text not null,
output_hash text null,
compiler_version text not null,
supersedes_baseline_id uuid null references custodial_daily_baselines(id),
created_at timestamptz not null default now(),
validated_at timestamptz null,
published_at timestamptz null,
published_by text null,
validation_report jsonb not null default '{}'::jsonb,
unique(service_date,revision),
unique(service_date,input_fingerprint)
```

Only one current published baseline per service date:

```sql
create unique index ...
on custodial_daily_baselines(service_date)
where status='published';
```

A superseding publication transaction first retires the prior current publication and publishes the new revision atomically.

## 8.2 `custodial_daily_baseline_intervals`

```sql
id uuid primary key default gen_random_uuid(),
baseline_id uuid not null references custodial_daily_baselines(id) on delete restrict,
location_id uuid not null references locations(id) on delete restrict,
location_group_id uuid null references location_groups(id) on delete restrict,
valid_start timestamptz not null,
valid_end timestamptz not null,
requirement_state text not null,
owner_type text not null,
position_id uuid null references custodial_schedule_positions(id),
employee_id uuid null references employees(id),
contractor_slot_id uuid null,
coverage_purpose text not null,
source_assignment_row_id uuid null references custodial_schedule_assignment_rows(id),
reason_code text not null,
load_points numeric(8,2) not null,
valid_range tstzrange generated always as (tstzrange(valid_start,valid_end,'[)')) stored
```

Owner check:

- employee owner requires employee ID and no contractor ID;
- contractor owner requires contractor ID and no employee ID;
- open/not_required has neither;
- requirement state `not_required` requires owner type `none`;
- requirement state `required` permits employee/contractor/open.

Exclusion within a baseline:

```sql
exclude using gist (
  baseline_id with =,
  location_id with =,
  valid_range with &&
)
```

---

## 9. Exception and transition ledger

## 9.1 `custodial_ownership_event_families`

```sql
id uuid primary key default gen_random_uuid(),
logical_key text not null unique,
service_date date not null,
event_type text not null,
created_by text not null,
created_at timestamptz not null default now()
```

## 9.2 `custodial_ownership_events`

```sql
id uuid primary key default gen_random_uuid(),
family_id uuid not null references custodial_ownership_event_families(id) on delete restrict,
revision integer not null,
status text not null,
authority_stage integer not null,
effective_start timestamptz not null,
effective_end timestamptz not null,
recorded_at timestamptz not null default now(),
reason_code text not null,
requested_owner_type text not null,
requested_employee_id uuid null references employees(id),
requested_contractor_slot_id uuid null,
supersedes_event_id uuid null references custodial_ownership_events(id),
source_type text not null,
source_ref text null,
actor text not null,
operation_id uuid not null,
correlation_id text null,
payload_json jsonb not null default '{}'::jsonb,
validation_report jsonb not null default '{}'::jsonb,
published_at timestamptz null,
unique(family_id,revision),
unique(operation_id)
```

Checks:

- end after start;
- authority stage restricted to architecture-defined stage numbers;
- proposed/validated/published/superseded/cancelled states;
- requested owner fields match owner type;
- superseding revision belongs to same family;
- published event requires validation success.

## 9.3 `custodial_ownership_event_locations`

```sql
event_id uuid not null references custodial_ownership_events(id) on delete cascade,
location_id uuid not null references locations(id) on delete restrict,
primary key(event_id,location_id)
```

A publication function acquires a service-date advisory lock, rejects equal-stage overlapping conflicts and records exact preview hash.

---

## 10. Compiler run and publication schema

## 10.1 `custodial_ownership_compile_runs`

```sql
id uuid primary key default gen_random_uuid(),
service_date date not null,
baseline_id uuid not null references custodial_daily_baselines(id),
compiler_version text not null,
input_fingerprint text not null,
events_fingerprint text not null,
status text not null,
requested_by text not null,
started_at timestamptz not null default now(),
completed_at timestamptz null,
preview_hash text null,
output_hash text null,
conflicts_json jsonb not null default '[]'::jsonb,
diff_json jsonb not null default '{}'::jsonb,
metrics_json jsonb not null default '{}'::jsonb,
unique(service_date,input_fingerprint,events_fingerprint,compiler_version)
```

Status: `running`, `preview_ready`, `blocked`, `approved`, `published`, `failed`.

## 10.2 `custodial_ownership_publications`

```sql
id uuid primary key default gen_random_uuid(),
service_date date not null,
revision integer not null,
compile_run_id uuid not null unique references custodial_ownership_compile_runs(id),
status text not null,
output_hash text not null,
supersedes_publication_id uuid null references custodial_ownership_publications(id),
published_by text not null,
published_at timestamptz not null,
retired_at timestamptz null,
unique(service_date,revision)
```

Only one current publication per service date through a partial unique index.

---

## 11. Bitemporal effective ownership assertions

## 11.1 `custodial_effective_ownership_assertions`

```sql
id uuid primary key default gen_random_uuid(),
publication_id uuid not null references custodial_ownership_publications(id) on delete restrict,
service_date date not null,
location_id uuid not null references locations(id) on delete restrict,
location_group_id uuid null references location_groups(id),
valid_start timestamptz not null,
valid_end timestamptz not null,
recorded_start timestamptz not null default now(),
recorded_end timestamptz not null default 'infinity',
requirement_state text not null,
owner_type text not null,
position_id uuid null references custodial_schedule_positions(id),
employee_id uuid null references employees(id),
contractor_slot_id uuid null,
device_assignment_epoch bigint null,
coverage_purpose text not null,
reason_code text not null,
baseline_interval_id uuid null references custodial_daily_baseline_intervals(id),
transition_event_id uuid null references custodial_ownership_events(id),
previous_assertion_id uuid null references custodial_effective_ownership_assertions(id),
assertion_revision integer not null,
load_points numeric(8,2) not null,
valid_range tstzrange generated always as (tstzrange(valid_start,valid_end,'[)')) stored,
recorded_range tstzrange generated always as (tstzrange(recorded_start,recorded_end,'[)')) stored
```

Checks mirror baseline owner validity plus:

- device epoch only for employee owner;
- publication service date matches assertion service date;
- assertion revision positive;
- recorded end after start.

Bitemporal exclusion:

```sql
exclude using gist (
  location_id with =,
  valid_range with &&,
  recorded_range with &&
)
```

This prevents two simultaneously recorded truths for overlapping valid time while allowing a correction to close the prior recorded range and append a new assertion.

## 11.2 Publication immutability trigger

After publication:

- assertions may not be updated or deleted;
- a correction transaction closes `recorded_end` through a protected security-definer function and inserts the successor assertion in one transaction;
- direct mutation is revoked.

---

## 12. Canonical resolver functions

## 12.1 Current/historical owner

```sql
custodial_resolve_location_owner(
  p_location_code text,
  p_valid_at timestamptz default now(),
  p_as_known_at timestamptz default now()
) returns jsonb
```

Guarantees:

- one row or explicit not-found/error;
- no writes;
- uses valid and recorded ranges;
- includes employee/contractor/open/not_required state;
- includes schedule, policy, publication and event versions;
- includes device epoch only when valid.

## 12.2 Employee current Schedule

```sql
custodial_employee_current_schedule(
  p_employee_id uuid,
  p_at timestamptz default now()
) returns jsonb
```

Reads effective assertions only. It never computes inheritance.

## 12.3 Manager baseline/effective comparison

```sql
custodial_schedule_comparison(
  p_service_date date,
  p_as_of timestamptz default now()
) returns jsonb
```

Returns baseline, effective ownership, exact changes and open intervals.

## 12.4 Consistency report

```sql
custodial_ownership_consistency_report(
  p_service_date date,
  p_sample_times timestamptz[]
) returns jsonb
```

Compares resolver outputs used by all consumers and fails admission on disagreement.

All functions are `STABLE`/read-only where appropriate and use a fixed `search_path`.

---

## 13. Contractor schema

## 13.1 `custodial_contractor_slots`

```sql
id uuid primary key default gen_random_uuid(),
slot_code text not null unique,
display_name text not null,
contractor_name text not null,
active boolean not null default true,
created_at timestamptz not null default now(),
retired_at timestamptz null
```

Existing CoverAll synthetic employee rows are migration inputs, not permanent owner authority.

## 13.2 `custodial_contractor_assignment_revisions`

```sql
id uuid primary key default gen_random_uuid(),
service_date date not null,
contractor_slot_id uuid not null references custodial_contractor_slots(id),
revision integer not null,
status text not null,
shift_start timestamptz not null,
shift_end timestamptz not null,
ownership_publication_id uuid null references custodial_ownership_publications(id),
supersedes_revision_id uuid null references custodial_contractor_assignment_revisions(id),
published_by text null,
published_at timestamptz null,
superseded_at timestamptz null,
notes text null,
unique(service_date,contractor_slot_id,revision)
```

## 13.3 `custodial_contractor_assignment_locations`

```sql
revision_id uuid not null references custodial_contractor_assignment_revisions(id) on delete cascade,
location_id uuid not null references locations(id),
valid_start timestamptz not null,
valid_end timestamptz not null,
primary key(revision_id,location_id,valid_start)
```

## 13.4 Secure links

Existing `coverall_assignment_links` should gain or be replaced by a revision-bound foreign key. One active link per revision/language may exist. Superseding the revision revokes all prior links in the same transaction.

---

## 14. Operational event and notification schema

## 14.1 `custodial_operational_events`

Purpose: due/overdue and other work state independent of presentation.

```sql
id uuid primary key default gen_random_uuid(),
logical_key text not null unique,
event_type text not null,
location_id uuid null references locations(id),
service_date date not null,
ownership_assertion_id uuid null references custodial_effective_ownership_assertions(id),
state text not null,
state_revision integer not null,
due_at timestamptz null,
overdue_at timestamptz null,
in_progress_session_id uuid null references sessions(id),
resolved_session_id uuid null references sessions(id),
resolved_by text null,
resolved_at timestamptz null,
resolution_reason text null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

State check: `normal`, `due_soon`, `overdue`, `in_progress`, `resolved`, `reopened`, `manager_resolved`, `cancelled_not_required`.

Only protected transition functions may change state. A generic scan-event trigger is prohibited.

## 14.2 `custodial_notification_intents`

```sql
id uuid primary key default gen_random_uuid(),
logical_key text not null unique,
intent_type text not null,
source_event_id uuid null references custodial_operational_events(id),
ownership_publication_id uuid null references custodial_ownership_publications(id),
ownership_revision_key text null,
recipient_type text not null,
employee_id uuid null references employees(id),
manager_id uuid null,
contractor_slot_id uuid null references custodial_contractor_slots(id),
device_id uuid null references devices(id),
assignment_epoch bigint null,
route text not null,
display_title text not null,
display_body text not null,
speech_text text not null,
state text not null,
available_at timestamptz not null,
supersedes_intent_id uuid null references custodial_notification_intents(id),
created_at timestamptz not null default now(),
superseded_at timestamptz null
```

Recipient check ensures one appropriate recipient identity. State: `pending`, `transported`, `received`, `displayed`, `cycle1_complete`, `cycle2_complete`, `opened`, `dismissed`, `cancelled`, `dead`.

## 14.3 `custodial_notification_state_events`

Append-only presentation/acknowledgement history:

```sql
id uuid primary key default gen_random_uuid(),
intent_id uuid not null references custodial_notification_intents(id),
state_type text not null,
state_value text not null,
operation_id uuid not null unique,
recorded_at timestamptz not null default now(),
device_id uuid null references devices(id),
assignment_epoch bigint null,
metadata_json jsonb not null default '{}'::jsonb
```

## 14.4 `custodial_manager_escalations`

Separate from employee presentation:

```sql
id uuid primary key default gen_random_uuid(),
operational_event_id uuid not null references custodial_operational_events(id),
ownership_assertion_id uuid null references custodial_effective_ownership_assertions(id),
state text not null,
scheduled_for timestamptz not null,
sent_at timestamptz null,
cancelled_at timestamptz null,
manager_intent_id uuid null references custodial_notification_intents(id),
reason_code text not null,
unique(operational_event_id,ownership_assertion_id)
```

---

## 15. Session integration

Existing `sessions` remains the cleaning evidence root. Add or companion-map:

- `ownership_assertion_id_at_start`;
- `ownership_publication_id_at_start`;
- `device_assignment_epoch_at_start`;
- `effective_owner_employee_id_at_start`;
- `cleaner_matches_owner`;
- `ownership_context_state`;
- `offline_snapshot_id`;
- `manager_authorization_ref`;
- `reconciliation_state`.

## 15.1 `custodial_session_ownership_transitions`

```sql
id uuid primary key default gen_random_uuid(),
session_id uuid not null references sessions(id) on delete restrict,
previous_assertion_id uuid null references custodial_effective_ownership_assertions(id),
new_assertion_id uuid null references custodial_effective_ownership_assertions(id),
transition_event_id uuid null references custodial_ownership_events(id),
transition_type text not null,
effective_at timestamptz not null,
session_context_state text not null,
recorded_at timestamptz not null default now()
```

The session may complete under a new owner without changing its cleaner attribution.

## 15.2 `custodial_offline_ownership_snapshots`

Protected server-issued snapshots store:

- snapshot ID;
- device/employee/epoch;
- ownership publication/version;
- exact location intervals;
- issued/expires timestamps;
- integrity hash/signature metadata;
- revoked/superseded state.

The phone stores the protected serialized snapshot; the server stores identity and hash, not necessarily a duplicate credential-bearing payload.

---

## 16. Native GPS data schema

## 16.1 `custodial_location_calibrations`

```sql
id uuid primary key default gen_random_uuid(),
location_id uuid not null references locations(id),
revision integer not null,
status text not null,
latitude numeric(10,7) not null,
longitude numeric(10,7) not null,
radius_m numeric(8,2) not null,
hysteresis_m numeric(8,2) not null,
max_accuracy_m numeric(8,2) not null,
sample_count integer not null,
sample_set_hash text not null,
confidence text not null,
source_method text not null,
effective_start timestamptz not null,
effective_end timestamptz not null default 'infinity',
supersedes_calibration_id uuid null references custodial_location_calibrations(id),
collected_by text not null,
approved_by text null,
created_at timestamptz not null default now(),
published_at timestamptz null,
unique(location_id,revision)
```

Current published calibration ranges may not overlap per location.

## 16.2 `custodial_session_location_observations`

Raw short-retention points:

```sql
id uuid primary key default gen_random_uuid(),
session_id uuid not null references sessions(id) on delete restrict,
operation_id uuid not null unique,
observed_at timestamptz not null,
latitude numeric(10,7) not null,
longitude numeric(10,7) not null,
accuracy_m numeric(8,2) null,
distance_m numeric(10,2) null,
classification text not null,
calibration_id uuid null references custodial_location_calibrations(id),
metadata_json jsonb not null default '{}'::jsonb,
received_at timestamptz not null default now()
```

## 16.3 `custodial_session_location_excursions`

```sql
id uuid primary key default gen_random_uuid(),
session_id uuid not null references sessions(id),
excursion_number integer not null,
state text not null,
first_away_at timestamptz not null,
confirmed_away_at timestamptz null,
returned_at timestamptz null,
max_distance_m numeric(10,2) null,
best_accuracy_m numeric(8,2) null,
evidence_count integer not null,
manager_review_state text not null,
unique(session_id,excursion_number)
```

## 16.4 `custodial_session_location_summaries`

Durable summary:

- session ID unique;
- tracking start/stop;
- permission/location health;
- observation counts;
- confirmed excursion count;
- final inside/outside/unverified result;
- raw-point purge status;
- incident hold status;
- generated and reviewed timestamps.

---

## 17. Device reassignment schema

## 17.1 `custodial_device_reassignment_operations`

```sql
id uuid primary key default gen_random_uuid(),
operation_id uuid not null unique,
device_id uuid not null references devices(id),
from_employee_id uuid null references employees(id),
to_employee_id uuid not null references employees(id),
from_assignment_epoch bigint not null,
to_assignment_epoch bigint null,
state text not null,
preflight_json jsonb not null,
reason_code text not null,
requested_by text not null,
requested_at timestamptz not null default now(),
committed_at timestamptz null,
reconciled_at timestamptz null,
last_error text null
```

State: `prepared`, `blocked`, `committing`, `committed_pending_client`, `complete`, `quarantined`, `failed`.

A security-definer transaction rotates authoritative device assignment/epoch and revokes old credential/push/message delivery authority atomically.

---

## 18. Publication and mutation functions

Only reviewed functions may publish or correct canonical data.

Minimum functions:

- `custodial_import_schedule_version(...)`;
- `custodial_validate_schedule_version(...)`;
- `custodial_publish_schedule_version(...)`;
- `custodial_compile_daily_baseline(...)`;
- `custodial_preview_ownership_publication(...)`;
- `custodial_publish_ownership_revision(...)`;
- `custodial_correct_ownership_assertion(...)`;
- `custodial_publish_manager_override(...)`;
- `custodial_activate_contractor_revision(...)`;
- `custodial_transition_operational_event(...)`;
- `custodial_record_notification_state(...)`;
- `custodial_prepare_device_reassignment(...)`;
- `custodial_commit_device_reassignment(...)`;
- `custodial_publish_location_calibration(...)`.

Every publication function:

1. validates named manager/authorized automation identity;
2. obtains advisory lock for service date or device/location family;
3. validates idempotency key;
4. verifies preview hash where applicable;
5. re-runs hard constraints;
6. writes all rows transactionally;
7. records audit and output hash;
8. returns exact published identity;
9. never commits partial output.

---

## 19. RLS and privileges

For all canonical protected tables:

```sql
alter table ... enable row level security;
alter table ... force row level security;
revoke all on ... from public, anon, authenticated;
```

Access model:

- service role/database owner: controlled backend functions;
- Full Access Manager: authenticated API/functions with write authorization;
- Read Only: approved resolver/dashboard/event reads only;
- employee device: own current Schedule, own notification/session functions and protected scan calls;
- CoverAll link: exact published contractor revision through token-bound backend route;
- AI/MCP: role-scoped tools, never direct table mutation.

Security-definer functions use a fixed `search_path`, validate actor context and revoke public execute by default.

---

## 20. Legacy coexistence and retirement

During shadow phase:

- canonical tables are isolated;
- no production consumer reads them as authority;
- no canonical output writes legacy ownership rows;
- comparison tools read both independently.

After cutover:

- one read-version pointer selects canonical resolver for all consumers;
- legacy ownership writers are disabled;
- current legacy tables remain read-only for historical reconciliation until retirement approval;
- no permanent trigger mirrors canonical rows into `daily_schedule_assignments` or `location_coverage_templates`;
- Sunday location templates are archived/exported and removed from runtime precedence.

---

## 21. Schema admission tests

A source-controlled migration test must prove:

1. extension preflight succeeds;
2. every table/constraint/index/function is created deterministically;
3. migration is transaction-safe;
4. RLS and grants are exact;
5. published rows cannot be directly mutated;
6. overlapping baseline intervals are rejected;
7. overlapping bitemporal assertions are rejected;
8. corrected recorded-time assertions are accepted without erasing history;
9. invalid owner field combinations are rejected;
10. duplicate event revisions and operation IDs are rejected;
11. equal-authority collisions block publication;
12. same inputs create identical fingerprints/hashes;
13. employee Schedule resolver performs zero writes;
14. contractor revisions revoke old links;
15. scan receipt/GPS events cannot resolve operational events;
16. notification dismissal cannot resolve work;
17. device reassignment is atomic;
18. raw GPS purge preserves summary/hold data;
19. rollback preserves canonical history;
20. empty-database reconstruction creates the same schema.

---

## 22. Open items before schema freeze

The schema direction is complete, but exact migration DDL must still resolve:

- approved schema for manager identities referenced by override/audit rows;
- whether contractor slots reuse existing CoverAll UUIDs as migration aliases or receive new canonical IDs;
- approved raw GPS retention duration;
- exact current publication partial-index/retirement transaction implementation;
- exact bitemporal correction function permissions;
- static source reconciliation and initial version contents;
- API contract field names and JSON schema;
- compiler scoring types and output hash canonicalization.

These are design tasks, not permission to alter production.

---

## 23. Schema design status

This design provides a database-enforced path to one canonical operational truth. It deliberately avoids patching existing group schedule tables into another precedence layer.

Next work:

1. adversarially audit this schema design;
2. design deterministic compiler/resolver contracts;
3. design the native Android component graph;
4. design migration and rollback SQL;
5. freeze only after cross-document consistency passes.

No SQL was applied and no production data was changed.