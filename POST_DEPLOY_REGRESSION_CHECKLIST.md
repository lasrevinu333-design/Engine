# Memphis Zoo Custodial Tracking System
## Post-Deploy Regression Checklist

Use this checklist after any change to SQL, `memphis-zoo-mcp`, `Engine`, or kiosk configuration.

## Deploy order
1. Apply SQL migration(s)
2. Deploy `memphis-zoo-mcp`
3. Deploy `Engine`
4. Refresh scan device and dashboard device
5. Run canary and smoke checks below

## 1) Backend health and version
- [ ] Open `https://memphis-zoo-mcp.onrender.com/version`
- [ ] Confirm response is `ok: true`
- [ ] Confirm backend version is current
- [ ] Confirm contracts show:
  - [ ] `scan.v1`
  - [ ] `dashboard.v1`

## 2) Canary check
- [ ] Open `https://memphis-zoo-mcp.onrender.com/dashboard-api/canary`
- [ ] Confirm HTTP status is `200`
- [ ] Confirm canary result is `ok: true`
- [ ] Confirm restroom canary passes
- [ ] Confirm exhibit canary passes
- [ ] Confirm dashboard summary check passes

## 3) Scan page build and cache sanity
On the scan device:
- [ ] Load the scan page fresh
- [ ] Confirm the debug panel shows the expected **front** build
- [ ] Confirm the debug panel shows the expected **back** build
- [ ] Confirm the device ID is present
- [ ] Confirm queue count is visible
- [ ] Confirm the page does not loop refresh repeatedly

## 4) Dashboard build and cache sanity
On the dashboard device:
- [ ] Load the dashboard fresh
- [ ] Confirm the build stamp is visible
- [ ] Confirm the displayed frontend build is current
- [ ] Confirm the displayed backend build is current
- [ ] Confirm the page does not loop refresh repeatedly

## 5) Restroom routing smoke test
Use a known restroom code, such as `TETM`.
- [ ] Start a restroom cleaning session
- [ ] Finish the restroom session
- [ ] Open the completion form
- [ ] Confirm the form title says **Restroom Completion Form**
- [ ] Confirm restroom maintenance issues are shown
- [ ] Submit successfully

## 6) Exhibit routing smoke test
Use a known exhibit code, such as `TETX`.
- [ ] Start an exhibit cleaning session
- [ ] Finish the exhibit session
- [ ] Open the completion form
- [ ] Confirm the form title says **Exhibit Completion Form**
- [ ] Confirm exhibit maintenance issues are shown
- [ ] Submit successfully

## 7) Active session dashboard test
- [ ] Start one live cleaning session
- [ ] Open the dashboard
- [ ] Confirm the location shows **Cleaning In Progress** in Status
- [ ] Confirm the Employee Name column shows the actual employee name
- [ ] Confirm the employee name is not replaced by placeholder text

## 8) Ticket test
- [ ] Create or confirm one open maintenance ticket exists
- [ ] Confirm it appears on the dashboard
- [ ] Close it from the dashboard
- [ ] Confirm it disappears from the dashboard after refresh

## 9) Offline / queue test
On the scan device:
- [ ] Disconnect network or simulate no signal
- [ ] Start and finish one session
- [ ] Confirm the flow still works normally
- [ ] Confirm queue count increases while offline
- [ ] Reconnect network
- [ ] Confirm queued actions clear
- [ ] Confirm queue count returns to zero

## 10) Final sanity review
- [ ] No unexpected errors on scan page
- [ ] No unexpected errors on dashboard
- [ ] Canary still passes after smoke tests
- [ ] Latest scan time updates on dashboard
- [ ] Restroom and exhibit rows appear in the correct sections

## Failure handling
If any item fails:
1. Stop further rollout
2. Re-check SQL migration status
3. Re-check backend version at `/version`
4. Re-check canary at `/dashboard-api/canary`
5. Refresh device cache and verify build stamps
6. Roll back the latest change if needed

## Notes
- `Not Cleaned` means the location has not been cleaned yet today
- `Overdue` means the location was cleaned earlier today, but enough time has passed that it now needs to be cleaned again
- The canary endpoint is the fastest single health check, but it does **not** replace the restroom/exhibit smoke tests
