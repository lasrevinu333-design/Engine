# Memphis Zoo Custodial Program — Production Truth Addendum v8

**Status:** Candidate static-schedule artifact research; no approval or production change  
**Prepared:** 2026-08-04  
**Candidate workbook:** `Memphis_Zoo_Static_Custodial_Schedule_COMPLETE_v2_OPEN.xlsx`

---

## 1. Scope and safety

A 12-sheet workbook was located in the connected file library and inspected read-only. It was not modified, uploaded to the repository, imported into production or treated as approved policy.

The workbook contains:

- Assumptions;
- Employee Roster;
- Location Families;
- Static Weekly Schedule;
- Sunday through Saturday views;
- Workload Snapshot;
- Summary;
- Coverage Audit.

It is valuable source evidence. Its own notes say it is seed data, not final app schema, and flag unresolved decisions.

---

## 2. Why this artifact matters

Unlike the mutable production schedule tables, the workbook presents one explicit seven-day family-level schedule artifact with:

- 25 route families/bundles;
- 49 raw locations in its inventory;
- 175 day-family rows;
- employee shifts and working days;
- segmented ownership clipped to shifts;
- explicit `OPEN` gaps rather than invented coverage;
- coverage audit and caveats;
- source/assumption notes.

This substantially narrows the static-source research gate. The project no longer lacks any seven-day candidate artifact. It still lacks formal approval/provenance and contains material conflicts that prevent treating the workbook as canonical.

---

## 3. Workbook assumptions and flagged caveats

The Assumptions sheet explicitly states:

- seed data was rebuilt from a static schedule handoff, uploaded image and prior workbook;
- schedule rows are grouped by named family/bundle and can later explode to individual locations;
- zoo close is assumed to be 6:00 PM because the workbook was built under a prior close-time assumption;
- `OPEN` is allowed when no employee is available;
- lunch coverage is not silently assigned and remains for a later explicit rule;
- Herpetarium restriction/person-bound exception needs confirmation;
- Primate `Pavillion` spelling is retained from source and needs canonical confirmation;
- Elephant Trunk Restrooms appear in uploaded inventory but were not shown by the earlier live database audit;
- the workbook is not the final app/database schema.

These notes are evidence of honest uncertainty. They are also reasons publication is blocked.

---

## 4. Roster largely matches production but two shift-time policies conflict

The workbook roster and production shift templates agree on working-day patterns and most employee shift/lunch times.

Material conflicts:

### Michael McWright

- workbook: 3:00 PM–12:00 AM, lunch 7:00–8:00 PM;
- production shift templates: 9:00 AM–6:00 PM, lunch 1:00–2:00 PM.

### Markiesha Warren

- workbook: 8:30 AM–5:30 PM, lunch 12:00–1:00 PM;
- production shift templates: 8:00 AM–5:00 PM, lunch 12:00–1:00 PM.

These are foundational staffing facts, not cosmetic differences. They change:

- opening/late coverage;
- Wednesday/Thursday `OPEN` gaps;
- shift-end inheritance;
- employee Schedule;
- notifications;
- workload fairness;
- after-hours/cross-midnight modeling.

The approved source must identify which shift policy is current and its effective date. Neither the workbook nor production row wins by existence alone.

---

## 5. The workbook uses a 6:00 PM close and exposes truthful gaps

The workbook's day sheets assume 6:00 PM close.

Under its roster:

- Wednesday and Thursday produce 25 `OPEN` family gaps from 5:30–6:00 PM because Michael is off and Markiesha ends at 5:30;
- all other days are marked fully covered through 6:00 PM;
- the workbook does not invent an employee owner for the uncovered interval.

This is conceptually correct: truthful `OPEN` is better than fabricated ownership.

It is not current authoritative coverage because:

- production operating-hours data is empty and falls back to 6:00 PM;
- September 14 seasonal closing is not represented;
- Markiesha's production shift ends at 5:00 PM, not 5:30;
- location-specific/split/event windows are not modeled;
- family-level coverage is not final location-level authority.

The canonical compiler must evaluate approved operating policy and shifts, then publish exact location `OPEN` intervals.

---

## 6. Candidate family inventory differs intentionally from current active groups

The workbook defines 25 operational route families. Production has 29 active location groups.

The four production groups absent from workbook route families are:

- Bamboo Gift Shop;
- East End Break Room;
- Elephant Trunk Gift Shop;
- Trading Post Gift Shop.

Production shows these as zero-member reminder groups rather than active location ownership groups:

- each gift-shop group has one reminder template and no active location membership;
- East End Break Room has reminder rows across seven days and no active membership.

The workbook's exclusion from the primary ownership matrix is therefore plausible. It does not prove reminder/service requirements should disappear. Each item must be resolved as:

- real canonical location/service occurrence;
- related-area reminder/work request;
- missing location membership requiring repair;
- obsolete historical rule.

Orphan group reminders cannot remain executable policy with no location identity.

---

## 7. Elephant Trunk Restrooms exist as inactive production locations

The workbook includes:

- Elephant Trunk Men's Restroom;
- Elephant Trunk Women's Restroom.

Production contains both location records, currently inactive. The active `ELEPHANT_TRUNK_RESTROOMS` group has no active membership and no active coverage templates.

The workbook therefore did not invent the names, but it assumes they belong in the current static route.

Required decision/research:

- confirm the restrooms physically exist and are in custodial scope;
- confirm operational name/form/tags;
- determine whether they should be reactivated as canonical locations;
- identify approved owner/shift/service policy;
- verify signage/tag state.

Do not reactivate or schedule them merely because the workbook includes them.

---

## 8. The workbook is still employee-bound and family-level

The workbook directly names current employees in every segment and treats families/bundles as the schedule unit.

Target migration requires:

- classify each normal rule as schedule-position or intentionally person-bound;
- preserve employee names as source snapshots, not permanent staffing slots;
- expand family rows through an approved membership snapshot to individual locations;
- separate normal ownership from reminders/service occurrences;
- version shifts, operating policy, workload and route inputs;
- validate exact intervals/non-overlap/`OPEN` before publication.

The workbook is a source artifact, not the canonical table design.

---

## 9. Lunch is correctly not fabricated but remains missing

The workbook explicitly declines to assign lunch coverage without an approved rule. This is preferable to silent invented coverage.

The target schedule cannot be published as complete until lunch policy is applied and proven for:

- each employee shift;
- exact coverage start/end;
- 9:45 overlap;
- shift-end/departure collision;
- restoration/no departed-owner restore;
- current-area employee presentation;
- notification and manager `OPEN` consequences.

---

## 10. Candidate-source classification

### Source-proven within the workbook

- the workbook is a complete seven-day candidate matrix;
- its own roster/family/segment/OPEN calculations are internally explicit;
- it documents assumptions and caveats;
- it does not hide uncovered intervals;
- it identifies two inventory locations absent/inactive in production.

### Not yet proven

- who approved it and when;
- whether it is the latest manager policy;
- exact source image/handoff provenance;
- shift-time conflicts for Michael and Markiesha;
- 6:00 PM versus seasonal/location operating policy;
- lunch coverage;
- Herpetarium/Kathy/Alijah person-bound rules;
- Elephant Trunk current scope;
- reminder-only/orphan groups;
- position mapping;
- per-location workload/route/service frequency.

### Canon disposition

`CANDIDATE STATIC SOURCE ARTIFACT — RETAIN FOR REVIEW; NOT APPROVED; NOT IMPORTABLE TO PRODUCTION YET.`

---

## 11. Required static-source approval workflow

1. Hash and preserve the exact workbook as source evidence.
2. Record creator, source image/handoff and creation/revision dates.
3. Review Employee Roster against authoritative HR/manager shift policy.
4. Resolve Michael and Markiesha shift conflicts.
5. Resolve Sunday and every weekday against manager-approved normal policy.
6. Resolve gift-shop/Break Room reminder rules and missing memberships.
7. Confirm Elephant Trunk current operational scope.
8. Confirm Herpetarium/Kathy/Alijah rules and privacy classification.
9. Replace 6:00 PM assumption with approved effective operating policy.
10. Add approved lunch and transition policy.
11. Map employee-bound rows to positions/person-bound exceptions.
12. Expand through a versioned location-membership snapshot.
13. Preview all seven days and exact `OPEN` intervals.
14. Obtain named-manager approval and effective dates.
15. Publish an immutable static schedule version only after independent validation.

---

## 12. Gate update

Previous gate:

- approved static source artifact for all weekdays: missing.

Updated gate:

- complete seven-day candidate artifact: **FOUND**;
- provenance and approval: **OPEN**;
- workforce/operating/lunch/location conflicts: **OPEN**;
- canonical static publication: **BLOCKED**.

No production state was changed by this research.