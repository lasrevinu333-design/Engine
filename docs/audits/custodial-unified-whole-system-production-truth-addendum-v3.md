# Memphis Zoo Custodial Program — Production Truth Addendum v3

**Status:** SELECT-only schedule-writer and person-bound-rule reconstruction  
**Prepared:** 2026-08-04  
**Companions:** production truth v1 and addendum v2

---

## 1. Scope and safety

This addendum inventories additional deployed functions that read or mutate schedule/workforce authority and examines person-specific preference/restriction logic.

No function was invoked for side effects and no production state was changed.

---

## 2. The deployed schedule system has multiple writer families

A function-definition scan found several independent or partially overlapping mutation paths touching daily schedules, rosters, templates, operating hours, absence and contractor behavior.

### 2.1 Legacy generation and exception writers

- `sch_generate_daily_schedule(date,boolean)`
- `sch_ensure_daily_schedule(date,text)`
- `sch_absence_publish(date,uuid[])`
- absence-regeneration trigger path
- `sch_apply_lunch_coverage_base_20260628(date)`
- `sch_fill_open_lunch_coverage(date)`
- `sch_normalize_restored_scan_lunch_load_points(date)`
- `sch_split_restored_scan_owner_rows_around_lunch(date)`
- `sch_sync_pto_absence_overrides(date,date)`
- `sch_set_schedule_close_time(date,time,text)`
- `sch_seed_location_coverage_templates_from_groups(integer)`

### 2.2 SCH2 alternative preview/publication family

- `sch2_build_work_items(date)`
- `sch2_generate_preview(date,boolean)`
- `sch2_publish_solution(uuid,boolean)`
- `sch2_rollback_publish(uuid)`
- `sch2_input_hash(date)`

These functions represent a second schedule-preview/publication architecture layered over the same mutable daily assignment foundation.

### 2.3 Automation and indirect writers

- 30-minute rolling-window cron through `sch_ensure_schedule_window`;
- Memphis message trigger through `msg_memphis_pre_generate_schedule`;
- absence table trigger/regeneration;
- employee status administration with contractor/phone side effects;
- event push enqueue functions reading mutable daily roster;
- API routes that invoke preview/publish/rebalance/generation.

### Architecture consequence

The migration writer inventory cannot be limited to `sch_generate_daily_schedule` or one backend route. Every function, trigger, cron job, API and administrative procedure receives one disposition:

- migrated to a canonical command/compiler path;
- converted to read-only projection/validation;
- isolated as shadow-only tooling;
- retired and execution revoked.

No legacy function remains callable merely because it is not linked from the final UI.

---

## 3. Multiple current schedule architectures coexist

Production contains at least:

1. mutable group templates and legacy generation;
2. Sunday-only location templates;
3. mutable daily assignment rows;
4. employee-read phase/inheritance logic;
5. route-fit 9:45 rebalance;
6. SCH2 preview/publish/rollback tables/functions;
7. cron-based rolling readiness generation;
8. AI/message-triggered generation;
9. absence-triggered forced regeneration.

This is not one scheduler with a few bugs. It is several partially overlapping authority mechanisms.

### Target disposition

Unified Architecture v4.1 correctly requires:

- immutable approved static source/version;
- location-level baseline;
- append-only exception input;
- one deterministic compiler;
- exact diff and named approval;
- one atomic publication/revision pointer;
- shadow comparison only during migration;
- legacy writer retirement.

The later schema and migration plan must enumerate and revoke every competing function/trigger/cron/API after cutover.

---

## 4. Employee area preferences currently mix soft and hard policy

Production contains 44 active employee-area preference rows across:

- 8 employees;
- 27 location groups.

Active preference types:

| Type | Active rows |
|---|---:|
| `avoid` | 14 |
| `prefer` | 29 |
| `restricted` | 1 |

### Architecture consequence

A free-form preference table currently carries several different meanings:

- soft route preference;
- hard restriction;
- operational boundary;
- named-person exception;
- possible personal circumstance documented in notes.

The unified model must separate:

- hard capability/restriction;
- reviewed accommodation;
- soft preference;
- temporary effective condition;
- position-level rule;
- intentionally person-bound rule;
- confidential/private justification versus operationally visible reason.

Compiler hard eligibility cannot depend on parsing free-text notes.

---

## 5. Alijah Herpetarium exception is partially structured but remains person-bound

`sch_is_employee_location_group_restricted` now checks employee-area preferences by stable employee ID rather than display name. That is an improvement.

For Herpetarium, it calls `sch_alijah_herpetarium_monday_exception_allowed`, whose name remains person-specific. The function permits a Monday exception only when an active allow/prefer record contains notes matching both:

- Monday;
- a personal circumstance phrase concerning the employee's husband not working.

### Problems

- the hard exception is encoded through free-text note matching;
- the function name embeds a person rather than a rule identity;
- personal justification is mixed with compiler-readable policy;
- the exception is not an effective-dated structured rule;
- a replacement employee or position cannot inherit/decline the rule coherently;
- privacy boundaries for the personal note are undefined.

### Target model

If Eric confirms the exception is genuinely person-bound, migrate it as a structured, effective-dated accommodation/restriction rule with:

- canonical employee ID;
- location/purpose/day/time scope;
- allow/restrict effect;
- approved reason code;
- private evidence reference separated from ordinary schedule explanation;
- approver and review/expiry date;
- audit history.

If it is actually a position/shift rule, migrate it to the position/static policy instead.

Do not preserve the free-text parser or person-named function.

---

## 6. Kathy east-boundary logic currently exists as a named validator

`sch_validate_kathy_east_boundary` checks whether Kathy Phelps is assigned to specified east-boundary groups and whether active restricted preferences exist.

The function appears to be validation/audit rather than the direct enforcement path, but it exposes a named-person operating assumption embedded in database code.

### Target disposition

- Research the actual operational reason and whether it is an accommodation, hard capability boundary, soft preference or historical artifact.
- Do not treat the validator name as policy evidence by itself.
- Migrate accepted rule into structured person-bound/position-bound restriction data.
- Retire person-named validation functions after equivalent generic validation exists.

---

## 7. Operational schedule validators reveal undocumented policy

`sch_validate_operational_schedule_rules` includes hard-coded gift-shop reminder timing and weekday constraints. This is operational policy encoded in validator SQL rather than an approved versioned policy source.

### Target disposition

Every such rule must be classified:

- static schedule source rule;
- service requirement/frequency policy;
- location operating policy;
- employee/position restriction;
- migration-only validation;
- obsolete fixture.

Generic validators should validate versioned policy data rather than contain the policy itself.

---

## 8. Required pre-design research

Before identity/position/restriction or compiler schema design:

1. Inventory every active employee-area preference and its operational meaning.
2. Classify hard restriction versus soft preference versus accommodation.
3. Identify private/confidential justification fields that must not appear in schedule/UI/analytics.
4. Determine whether each rule belongs to employee, position, shift, location, purpose or temporary exception.
5. Identify approval source/effective date/review/expiry.
6. Search all database/backend/frontend/tests for person-name and employee-code special cases.
7. Replace accepted rules with generic versioned structures in design; retire name-specific functions at migration.
8. Preserve historical evidence without keeping former employees operationally eligible.

---

## 9. Addendum conclusion

The current system's person-specific behavior is not solved by changing display-name comparisons to UUID comparisons. Stable IDs prevent rename breakage, but they do not answer whether the rule belongs to a person, a position, an accommodation or an obsolete historical assumption.

Likewise, the schedule foundation is not repaired by choosing SCH2 over legacy generation. The target requires one approved canonical architecture and explicit retirement of every competing writer.

No production state was changed by this research.