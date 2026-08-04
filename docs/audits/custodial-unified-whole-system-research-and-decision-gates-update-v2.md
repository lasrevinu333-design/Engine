# Memphis Zoo Custodial Program — Research and Decision Gate Update v2

**Status:** Updates specific gates in `custodial-unified-whole-system-research-and-decision-gates-v1.md`  
**Prepared:** 2026-08-04  
**Evidence:** candidate seven-day static schedule workbook and SELECT-only production comparison

---

## 1. Superseding gate entries

The following rows supersede the corresponding current-evidence text in gate registry v1. All other gates remain unchanged.

| Gate | Class | Question/evidence required | Updated current evidence | Closure condition | Blocks |
|---|---|---|---|---|---|
| G-SCH-001 | DBD/POL | What is the approved static schedule source for every weekday? | A complete seven-day candidate workbook with 175 family-day rows, roster, assumptions, `OPEN` gaps and audit sheets was located. It explicitly says it is seed data and not final schema. Provenance/approval remain unverified. | Preserve/hash exact workbook; record creator/source/revision; resolve all conflicts; named-manager approval and effective date for all seven days | Static version, baseline, compiler |
| G-SCH-002 | DBD/POL | What is authoritative Sunday policy? | Candidate workbook provides one Sunday schedule, while 135 production Sunday location rows disagree materially with current group expansion. Workbook Sunday has not been approved against source/handoff. | Named review/approval of normalized Sunday candidate; production location rows classified as migration evidence only | Static publication and migration |
| G-SCH-005 | DBD/OPS/POL | Which rules belong to stable positions versus intentionally named people? | Candidate workbook names all current employees directly. Production has free-text preferences and named Alijah/Kathy/EMP002 logic. No position mapping exists. | Reviewed mapping from every workbook row and accepted restriction to position/person-bound structured rule | Identity and schedule schema |
| G-SCH-013 | DBD/POL | Which shift-time source is authoritative for Michael McWright? | Candidate workbook: 3:00 PM–12:00 AM, lunch 7:00–8:00 PM. Production shift templates: 9:00 AM–6:00 PM, lunch 1:00–2:00 PM. Work days agree. | Approved current shift/effective date and historical transition; source recorded | Operating windows, inheritance, static schedule, employee Schedule |
| G-SCH-014 | DBD/POL | Which shift-time source is authoritative for Markiesha Warren? | Candidate workbook: 8:30 AM–5:30 PM. Production shift templates: 8:00 AM–5:00 PM. Lunch/work days agree. | Approved current shift/effective date and historical transition; source recorded | Late coverage, `OPEN`, static schedule |
| G-SCH-015 | OPS/DBD/POL | Are Elephant Trunk Restrooms currently in scope? | Candidate workbook includes two restrooms. Production contains both location records inactive; active group has no members/templates. | Physical/manager confirmation, canonical naming/tags/operating/service/owner policy; explicit activate or exclude decision | Location registry, static source and tags |
| G-SCH-016 | DBD/OPS/POL | What do orphan reminder groups represent? | Bamboo/Elephant Trunk/Trading Post gift shops and East End Break Room are active groups with no active locations; production has reminder rows. Candidate ownership workbook excludes them. | Classify each as real location/service occurrence, related-area reminder/work request, missing membership or obsolete rule | Location registry, service occurrences, static policy |
| G-SCH-017 | OPS/POL | What lunch-coverage source/policy applies to the candidate schedule? | Workbook intentionally does not fabricate lunch coverage. Production has lunch templates/functions but current authority is fragmented. | Approved employee-by-employee scenario matrix including 9:45, departure, restoration and `OPEN` | Complete static/exception publication |
| G-OPS-001 | DBD/POL | Normal zoo open/close policy by effective date | Candidate workbook assumes 6:00 PM; production operating-hours table is empty and code falls back to 6:00 PM. Neither establishes approved policy. | Approved effective-dated zoo/location source including September 14 | Requirement compiler |

---

## 2. Gate interpretation

The candidate workbook is a substantial research advance, not an architecture or implementation GO.

Updated status:

- complete all-week candidate schedule: **FOUND**;
- authoritative approval/provenance: **OPEN**;
- roster shift conflicts: **OPEN**;
- operating/lunch/location/reminder conflicts: **OPEN**;
- canonical static schedule publication: **BLOCKED**.

No production row or workbook was changed.