# Guest Cleanliness Reporting Rollout

## Files added
- `guest-report.html` — guest-facing QR landing page
- `guest-issues.html` — staff/ops issue list page
- `guest-report-config.js` — deploy-time config for API/Supabase values
- `guest-qr-links.example.csv` — sample QR URL export format

## Backend endpoints required
- `GET /guest-api/health`
- `GET /guest-api/locations/:locationCode`
- `POST /guest-api/report-cleanliness`
- `GET /dashboard-api/guest-cleanliness-issues`

## Recommended deployment model
Use the backend API as the system of record:
- guest browser -> `memphis-zoo-mcp` API -> Supabase
- hub browser -> `memphis-zoo-mcp` API -> Supabase

This keeps the service-role key off the client and preserves notification logic on the server.

## Frontend config
Edit `guest-report-config.js`:
- `API_BASE`
- optionally `SUPABASE_URL`
- optionally `SUPABASE_PUBLISHABLE_KEY`
- `ENABLE_SUPABASE_REALTIME`

Current pages only require `API_BASE`.

## QR format
Each location QR should point to:

`/guest-report.html?location_code=<LOCATION_CODE>`

Example:

`/guest-report.html?location_code=TETM`

## Open questions to verify before deployment
1. Does `public.locations` always contain every guest-reportable location?
2. Does `public.sch_get_current_owner(location_code, now())` always return a messaging user id for the assigned employee?
3. Are ops managers consistently identifiable via `msg_users.role` values?
4. Should guest reports also create or sync to the existing maintenance ticket table/view?
5. Should the guest issue list auto-hide resolved items by default?

## Strong recommendation
Move schema creation out of request handling and into a proper migration before production rollout.
