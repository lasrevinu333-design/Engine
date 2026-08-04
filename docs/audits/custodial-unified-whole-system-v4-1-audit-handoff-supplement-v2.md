# Memphis Zoo Custodial Program — v4.1 Independent Audit Handoff Supplement v2

**Applies to:** `docs/custodial-unified-whole-system-independent-audit-handoff.md` and all four v4.1 auditor prompts

Before completing an independent first pass, also read:

- `docs/audits/custodial-unified-whole-system-production-truth-addendum-v8.md`
- `docs/audits/custodial-unified-whole-system-research-and-decision-gates-update-v2.md`

If the connected Files library is available, inspect read-only:

- `Memphis_Zoo_Static_Custodial_Schedule_COMPLETE_v2_OPEN.xlsx`

The workbook is a candidate seven-day source artifact, not approved policy.

Mandatory attacks:

1. Verify the architecture treats the workbook as immutable source evidence and does not import it directly into production.
2. Reconcile workbook shift conflicts:
   - Michael McWright: workbook 3:00 PM–12:00 AM versus production 9:00 AM–6:00 PM;
   - Markiesha Warren: workbook 8:30 AM–5:30 PM versus production 8:00 AM–5:00 PM.
3. Verify a future source-publication workflow requires provenance, named approval and effective dates rather than choosing whichever source looks newer.
4. Attack the workbook's 6:00 PM assumption against the empty production operating-hours table, September 14 policy and location/event windows.
5. Verify explicit workbook `OPEN` gaps remain truthful candidate evidence rather than being filled by a synthetic employee.
6. Verify lunch remains a named open policy gate rather than silently copied from production functions or omitted from final coverage.
7. Resolve workbook family inventory against production orphan reminder groups and inactive Elephant Trunk restroom locations.
8. Verify all employee-bound workbook rows are mapped to stable positions or explicitly approved person-bound rules before static publication.
9. Confirm family rows expand through a versioned membership snapshot to individual location intervals.
10. Require a complete seven-day candidate preview with location-level non-overlap, `OPEN`, operating windows, lunch and transition fixtures before architecture/design GO.

Do not treat the workbook filename `COMPLETE` as proof that its policy is approved or operationally complete.