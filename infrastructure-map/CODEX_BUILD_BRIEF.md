# Codex Build Brief — Standalone Infrastructure Map

Primary specification: GitHub issue **#177**.

## First instruction

Work only inside this isolated `infrastructure-map/` project until the standalone repository is created. Do not change production pages, the existing mobile editions, the Custodial application, or backend/database code.

## Non-negotiable boundary

This is the Memphis Zoo **Infrastructure & Equipment Map**, not a Custodial module.

- App ID: `org.memphiszoo.infrastructure`
- Storage namespace: `memphis-zoo-infrastructure-map-v1`
- No imports from any Custodial path
- No calls to the Custodial backend
- No Custodial tables, employee/device records, schedules, scans, forms, or Messenger data
- Keep all infrastructure data and releases independent
- The future Custodial map will be built as a separate product

Run `npm test` frequently. The separation check must stay green.

## Category behavior

Equipment categories own the default pin color.

Required starting mappings:

- Generator → red `#D32F2F`
- Water Quality Pump → blue `#1976D2`

Add a visible legend and category filtering. A pin should store both `category_id` and its resolved published `pin_color`. Changing a category later must not silently recolor an already approved publication.

## Immediate implementation order

1. Inspect the current editor v1.2 and clean map asset available in the user's Downloads/conversation files.
2. Build a responsive read-only viewer using the domain and calibration modules already scaffolded here.
3. Add category legend, department filter, search, pin detail sheet, Google Maps, directions, copy coordinates, and native share.
4. Build legacy JSON import and a versioned local publication file.
5. Add an offline cache abstraction and data-version display.
6. Add Capacitor dependencies and generate isolated Android/iOS projects.
7. Add browser tests for desktop, iPhone portrait/landscape, and Android portrait/landscape.
8. Produce an Android debug APK and document the iOS/TestFlight cloud build path.
9. Report evidence: tests, screenshots, build artifacts, changed files, and remaining blockers.

Do not deploy, merge, or touch production automatically.
