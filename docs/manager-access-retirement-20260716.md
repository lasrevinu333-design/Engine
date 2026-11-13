# Manager access retirement — 2026-07-16

Release contract: `release-2026.07.16.manager-access-repair.1`

- The read-only Ops Manager entry is retired.
- The only active manager entry is the full-access Ops Manager Hub.
- Gemini Console remains hidden until both full-access Ops authorization and Gemini password authentication succeed.
- Canceling or failing Gemini authentication leaves the console locked.
- Gemini Back navigation returns explicitly to the full-access Ops Manager entry.
