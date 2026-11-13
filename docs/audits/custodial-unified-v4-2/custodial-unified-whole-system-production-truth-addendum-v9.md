# Memphis Zoo Custodial Program — Production Truth Addendum v9

**Subject:** Live schedule/Messenger triggers, cron authority, function search-path posture, sampled RLS/FORCE RLS and extension placement  
**Research date:** 2026-08-04  
**Method:** SELECT-only inspection of Supabase project `rqquvtjdmugpigbndmne`  
**Safety:** No function was invoked, no row/object/policy was changed, and no migration was applied

---

## 1. Why this research was performed

The independent v4.1 audits agreed that the target architecture needs a machine-enforced retirement manifest rather than a prose instruction to “turn off legacy writers.” GPT-5.6 Pro also identified current mutable function search paths and extension placement as migration/security hazards requiring object-by-object disposition.

This addendum independently verifies selected live objects needed for the v4.2 retirement, security and activation architecture.

---

## 2. Live schedule and communication triggers

The following non-internal triggers were observed.

| Table | Trigger | Function | Operational significance |
|---|---|---|---|
| `coverage_templates` | `trg_sch_guard_operational_coverage_template` | `sch_guard_operational_coverage_template()` | Current mutable group-template guard/policy path |
| `coverage_templates` | `trg_sch_guard_restricted_coverage_template` | `sch_guard_restricted_coverage_template()` | Person/restriction guard path requiring classification |
| `daily_absence_overrides` | `daily_absence_overrides_regenerate_schedule` | `sch_daily_absence_override_regenerate_trigger()` | Absence row mutation can regenerate schedule state |
| `daily_schedule_assignments` | `trg_sch_apply_default_coverage_purpose` | `sch_apply_default_coverage_purpose()` | Current daily-row policy mutation |
| `daily_schedule_assignments` | `trg_sch_guard_operational_daily_assignment` | `sch_guard_operational_daily_assignment()` | Legacy daily-assignment guard |
| `daily_schedule_assignments` | `trg_sch_guard_restricted_daily_assignment` | `sch_guard_restricted_daily_assignment()` | Current person/restriction rule enforcement |
| `employee_planned_time_off` | `employee_planned_time_off_sync_absences` | `sch_pto_absence_sync_trigger()` | PTO mutation feeds absence/schedule mutation |
| `employee_pto` | `employee_pto_sync_absences` | `sch_pto_absence_sync_trigger()` | Second PTO source feeds same schedule path |
| `location_coverage_templates` | `trg_sch_guard_restricted_location_coverage_template` | `sch_guard_restricted_location_coverage_template()` | Sunday/location-template person restriction path |
| `msg_messages` | `trg_msg_enqueue_background_work` | `msg_enqueue_background_work()` | Messenger insertion creates background work |
| `msg_messages` | `trg_msg_memphis_pre_generate_schedule` | `msg_memphis_pre_generate_schedule()` | Messenger/read-question activity can generate schedule state |
| `msg_messages` | `trg_msg_message_immutable_audit` | `msg_audit_persisted_message()` | Legitimate audit trigger candidate to retain/rebuild |
| `msg_threads` | `trg_msg_threads_set_updated_at` | `msg_set_updated_at()` | Ordinary metadata trigger |
| `msg_users` | `trg_msg_users_set_updated_at` | `msg_set_updated_at()` | Ordinary metadata trigger |
| `scan_events` | `trg_sch_clear_scan_alerts_after_scan_event` | `sch_clear_scan_alerts_after_scan_event()` | Any inserted scan event currently participates in clearing alerts |

### Architectural conclusion

A UI route removal cannot retire these authorities. The v4.2 retirement manifest must include exact trigger identity, function signature/digest, grants, callers, replacement, disable/revoke action, rollback treatment and proof.

The Messenger pre-generation trigger and scan-alert-clear trigger are particularly incompatible with target doctrine:

- reads/messages cannot generate schedule authority;
- scan/start cannot resolve service work or overdue state.

---

## 3. Live cron jobs

Two relevant active cron jobs were observed:

| Job ID | Schedule | Command | Significance |
|---:|---|---|---|
| 24 | `*/30 * * * *` | `select public.sch_ensure_schedule_window(public.sch_service_date(now()), 14, 'scheduled_rolling_window_readiness');` | Active rolling schedule-window writer/ensurer |
| 38 | `18 * * * *` | `select public.msg_purge_deleted_content(now(),1000);` | Active Messenger content purge and retention behavior |

### Architectural conclusion

- Job 24 is a current schedule writer and cannot survive canonical cutover outside the signed retirement/compatibility manifest.
- Job 38 is a valid retention mechanism only after Messenger content, visibility, audit and archive policy are reconciled. Purge success is not allowed to delete durable operational evidence.

---

## 4. Selected live function configuration

Read-only `pg_proc` inspection confirmed active schedule, owner, alert and Messenger-related functions. Most sampled non-privileged functions had no function-level `proconfig`, while one sampled `SECURITY DEFINER` overload of `sch_ensure_daily_schedule` used:

`search_path=pg_catalog, public, extensions`

Observed functions included:

- `msg_memphis_pre_generate_schedule()`;
- `sch2_input_hash(date)`;
- `sch_absence_publish(date, uuid[])`;
- `sch_apply_lunch_coverage(date)`;
- `sch_clear_scan_alerts_after_scan_event()`;
- `sch_daily_absence_override_regenerate_trigger()`;
- `sch_employee_my_schedule_phase_v1(date, uuid, timestamptz)`;
- `sch_employee_my_schedule_summary(date, uuid)`;
- two overloads of `sch_ensure_daily_schedule`;
- `sch_fill_open_lunch_coverage(date)`;
- `sch_generate_daily_schedule(date, boolean)`;
- `sch_get_current_owner(text, timestamptz)`;
- `sch_get_daily_schedule(date)`;
- `sch_get_location_schedule_owner(text, timestamptz)`;
- `sch_get_scan_alert_owner(text, timestamptz)`;
- `sch_get_schedule_close_time(date)`;
- `sch_pto_absence_sync_trigger()`;
- two overloads of `sch_queue_due_scan_alerts`;
- `sch_regenerate_existing_schedules_for_absence_range(date, date)`;
- `sch_seed_location_coverage_templates_from_groups(integer)`;
- `sch_split_restored_scan_owner_rows_around_lunch(date)`;
- `sch_sync_pto_absence_overrides(date, date)`.

### Architectural conclusion

The final security design must not infer safety from function names or transaction care. Every surviving privileged function requires:

- exact owner and signature;
- pinned safe search path appropriate to its dependencies;
- exact execute grants;
- actor propagation and authorization decision;
- registered record types and authority-set generation;
- audit and release-manifest identity.

Functions retired from authority must become uncallable through grants, triggers, cron, APIs, tools and rollback paths.

---

## 5. Sampled RLS and FORCE RLS state

The following sampled public tables had both RLS and FORCE RLS enabled:

- `cleaning_inspections`;
- `completion_responses`;
- `coverage_templates`;
- `daily_schedule_assignments`;
- `devices`;
- `employees`;
- `guest_cleanliness_reports`;
- `location_coverage_templates`;
- `maintenance_tickets`;
- `msg_messages`;
- `msg_threads`;
- `msg_users`;
- `scan_events`;
- `sessions`.

Sampled policy counts:

- `cleaning_inspections`: 1;
- `maintenance_tickets`: 1;
- the other listed samples: 0.

### Interpretation

RLS/FORCE RLS with no policy may intentionally deny direct access. It does not establish the complete security result because the actual path may depend on:

- table/view grants;
- service-role bypass;
- function ownership and `SECURITY DEFINER` behavior;
- execute grants;
- backend API mediation;
- actor propagation;
- extension or trigger side effects.

The v4.2 security design therefore requires a complete principal/grant/function/API manifest rather than labeling the current schema simply “safe” or “unsafe.”

---

## 6. Extension placement

Observed extensions:

| Extension | Version | Schema |
|---|---|---|
| `pg_cron` | `1.6.4` | `pg_catalog` |
| `pg_net` | `0.20.0` | `public` |

`pg_net` in `public` is a migration/security review item. This observation alone does not prove exploitation. The canonical schema design must explicitly choose extension placement, grants and whether the capability is required.

---

## 7. V4.2 gate effects

This evidence keeps the following gates open:

- `G-RETIRE-001` — complete machine-enforced writer/resolver/trigger/cron/API/tool retirement manifest;
- `G-PRINCIPAL-001` — canonical principal/grant/authorization decision;
- `G-RECORD-001` — registered cross-domain records for every surviving writer;
- `G-AUTHSET-001` — generation/fencing for workers and cron;
- `G-MSG-POLICY` and `G-RETENTION` — content purge versus durable evidence;
- schema security audit gate for exact grants, FORCE RLS and privileged functions.

It does not block architecture audit. It blocks schema/migration/cutover until every object has a disposition and proof.

---

## 8. No-change statement

Only SELECT queries were executed. No trigger, cron job, function, grant, policy, row, schema, extension, secret or production behavior was changed.