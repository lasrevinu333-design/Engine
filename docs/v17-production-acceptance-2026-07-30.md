# Memphis Zoo Custodial Program v17 Production Acceptance

Date: 2026-07-30  
Governing specification: `Memphis_Zoo_Custodial_System_Final_Report_v17_optional_marketing.pdf`  
Frontend: `https://lasrevinu333-design.github.io/Engine/`  
Backend: `https://memphis-zoo-mcp.onrender.com/`

This matrix covers the entire custodial program. Phone-specific physical acceptance is tracked as one required subsystem and is being executed separately to avoid colliding with the active phone repair job.

## Acceptance matrix

| v17 capability | Automated/live evidence | Current disposition |
| --- | --- | --- |
| Manager hub and role separation | Manager, custodian, and viewer shells; route recovery; authentication; desktop/mobile browser acceptance | Pass |
| Operations dashboard | Dashboard contracts, recent activity, attendance freshness, active-session and ticket presentation | Pass |
| Scheduling and coverage | Schedule v2 contracts, source-type handling, employee views, rebalance route, 96 current-day assignments, zero display duplicates, zero uncovered absences | Pass |
| Events input and upcoming events | Parser, venue taxonomy, privacy, admin/mobile browser tests; 16 future scheduled events and zero events awaiting review | Pass |
| Memphis Messenger and Memphis AI | Messaging v5 contracts, ChatScope browser tests, durable outbox, idempotency, long polling, authority separation; live health 200 | Pass |
| Guest issue workflow | Approval-gated contracts and browser tests; no open guest reports | Optional feature correctly dormant pending Marketing approval |
| NFC/scan workflow | Scan v2, exact identifiers, duplicate suppression, offline queue, wake recovery, completion routing, GPS freshness and replay tests | Software pass; physical tag/phone pass required from phone job |
| Restroom and exhibit completion | Required-service validation, issue capture, out-of-order details, exact session close, saved drafts, offline retry | Pass |
| Inspection readiness and history | Session-bound idempotent inspection browser tests and analytics contracts | Software pass; first real inspection is a launch-day operational acceptance item |
| Operational analytics and trends | Analytics contracts and responsive insights browser tests | Pass |
| Notifications | Manager and employee notification contracts, durable outbox leasing/recovery, zero current backlog/dead letters | Server pass; employee-device delivery requires phone enrollment results |
| Backup and recovery | Encrypted production backup, local decrypt/checksum verification, PostgreSQL 17 restore drill; 165 tables/40,015 rows/3 buckets/1 object | Pass |
| Empty rebuild and concurrency | 44 migrations rebuilt on disposable Supabase PostgreSQL; exact finish, GPS, outbox, Moxie, and manager-identity concurrency invariants | Pass |
| Release identity | Frontend manifest and backend semantic version are v3.12; all shipped legacy-page cache/version stamps normalized to v3.12 | Pass after deployment |
| Availability | Dependency-aware `/health`, graceful SIGTERM drain, live responses under 0.4 seconds, ten-minute four-second-budget monitor | Bridge deployed; paid always-on Render instance remains required for production SLA |

## Current phone-fleet facts

- KIOSK_02 and KIOSK_03 were healthy at inventory time.
- KIOSK_04, KIOSK_07, KIOSK_08, and KIOSK_09 were stale.
- KIOSK_05, KIOSK_06, and KIOSK_10 were offline for multiple days.
- Device-auth policy remains `observe`; no active custodial device credentials were recorded at inventory time.
- Employee native-push registrations were absent at inventory time.
- The attached phone showed an unlicensed Fully Kiosk installation. Licensing and direct device repair belong to the active phone job and require its final evidence here.

The custodial device-auth policy must not move from `observe` to `enforce` until every in-service phone has a confirmed credential and a tested recovery path. Doing so earlier would lock working phones out of scan, schedule, and Messenger workflows.

## Release evidence

- Frontend browser acceptance: 78/78 passed at desktop and Samsung mobile sizes.
- Frontend source contracts: every `scripts/*.mjs` contract passed.
- Backend focused production contracts: 20 selected live/source suites passed.
- Backend disposable database rebuild: 44/44 migrations applied and all concurrency invariants passed.
- Supabase production backup/restore workflow: <https://github.com/lasrevinu333-design/memphis-zoo-mcp/actions/runs/30572092107>

## Remaining production gates

1. Import the phone job's evidence for all in-service phones: Fully license state, assignment, NFC scan, wake/lock, audio/notification, offline/reconnect, and sub-four-second response initiation.
2. Enroll each active custodial phone, confirm last use, then change device-auth from `observe` to `enforce` through the supported manager workflow.
3. Move the Render backend from Free to an always-on paid instance; the scheduled probe is monitoring and a temporary warm bridge, not a substitute for production hosting.
4. Run the final live canary after frontend deployment and record one manager inspection against a real completed cleaning session.

No production-ready declaration is permitted until all four gates are closed.
