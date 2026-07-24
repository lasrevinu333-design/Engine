# Memphis Zoo Operations Whole-System Test Plan

**Document status:** Living release-control specification  
**Scope:** Operations Manager app, Custodial employee app, Viewer app, shared web modules, Android packaging, Render backend, Supabase/Postgres, Firebase messaging, NFC and device integrations  
**Quality objective:** A coherent, stable system in which every visible action, stored fact, identity transition, deployment artifact, and failure mode agrees with the rest of the program.

---

## 1. Quality doctrine

The program is not considered correct merely because each page works in isolation. It is correct only when the complete operational loop remains internally consistent:

1. A person has the correct identity and authority.
2. A phone represents the correct employee or manager.
3. A user action creates one authoritative state transition.
4. Every dependent view reflects that transition without contradiction.
5. Offline, retry, wake, reinstall, reassignment, and deployment boundaries do not duplicate or lose work.
6. The visual interface remains readable, reachable, and spatially predictable on the actual devices used at the zoo.
7. Production evidence proves that the release running on phones, GitHub Pages, Render, Supabase, and Firebase is the release that was tested.

Testing therefore uses overlapping evidence rather than one giant brittle end-to-end script. Unit, property, contract, database, browser, Android, security, performance, deployment, and human field tests each examine the same invariants from a different angle.

No finite test suite can enumerate every theoretical program state. This plan approaches whole-system coverage through explicit invariants, model-based state transitions, mutation testing, combinatorial parameter coverage, change-impact analysis, production verification, and manual field observation.

---

## 2. System boundary

### 2.1 User-facing applications

| Application | Primary users | Core responsibilities |
|---|---|---|
| Operations Manager | Custodial Manager and authorized leadership | Dashboard, scheduling, Messenger, phone assignments, events, notifications, feedback, Moxie/Gemini, access control |
| Custodial Employee | Assigned custodians | Assigned areas, NFC scan/start/finish cleaning, Messenger, schedule, events, issue reporting |
| Operations Viewer | Read-only operational viewers | Current operational state without mutation authority |

### 2.2 Shared clients

- Memphis authentication and named-manager sessions.
- Canonical device identity and credential handling.
- Durable scan synchronization and offline outbox handling.
- Unified Memphis custom Messenger with cursor long polling and a durable local outbox.
- Shared visual tokens, navigation, safe-area rules, focus states, and interaction feedback.
- Release and deployment manifests.

### 2.3 Services and persistence

- Render-hosted Node backend and operational workers.
- Supabase/Postgres schema, functions, permissions, histories, queues, and business rules.
- Firebase Cloud Messaging device registration and delivery.
- GitHub Pages frontend deployment.
- GitHub Actions build, security, database rebuild, APK, and live-acceptance workflows.

### 2.4 Physical and operating-system integrations

- Samsung and other Android phones.
- NFC tags and Android deep links/intents.
- Lock screen, wake, background, foreground, keyboard, system navigation, cutouts, rotation, battery restrictions, and network transitions.
- Real-world zoo Wi-Fi and cellular dead zones.

---

## 3. Selected testing toolchain

The toolchain favors mature, scriptable tools that produce durable evidence and fit the existing JavaScript, Capacitor, Android, Render, Supabase, and GitHub Actions architecture.

| Test concern | Selected software | Role in this program | Status |
|---|---|---|---|
| Source and domain tests | Node test runner and existing contract scripts; Vitest where module-level mocking and coverage are useful | Fast deterministic logic, source contracts, branch and assertion coverage | Partly implemented |
| Browser end-to-end | Playwright | Manager, employee, and viewer journeys; network interception; concurrency; trace capture | Implemented |
| Visual regression | Playwright `toHaveScreenshot()` | Pixel and geometry comparison at controlled viewports | Planned |
| Web accessibility | `@axe-core/playwright` plus manual keyboard/screen-reader checks | Automated WCAG A/AA detection and human validation | Planned |
| Property and model testing | fast-check | Generated edge cases, state-machine commands, race ordering, shrinking | Planned |
| Mutation testing | StrykerJS | Measures whether tests actually detect altered logic rather than merely execute it | Planned |
| Consumer/provider contracts | Pact | Prevents frontend/backend request and response drift | Planned |
| Schema-driven API fuzzing | Schemathesis against OpenAPI | Generates invalid, boundary, and stateful API sequences | Planned after OpenAPI completion |
| Database unit and policy tests | pgTAP through Supabase CLI | Constraints, functions, grants, RLS, negative permissions, migration behavior | Planned; disposable rebuild acceptance already exists |
| Disposable integration environment | Existing Docker Postgres rebuild; Testcontainers where service composition is needed | Fresh schema, isolated data, repeatable backend integration | Partly implemented |
| Android in-app UI | Espresso, including accessibility checks | Deterministic interactions inside the native app and WebView shell | Planned |
| Android system interaction | UI Automator | Lock screen, intents, NFC/deep-link entry, system navigation, permissions, background/wake | Planned |
| Device diversity | Firebase Test Lab instrumentation and Robo matrices | Physical and virtual device/OS/locale/orientation coverage | Planned |
| Android performance | Macrobenchmark and Baseline Profiles | Startup, frame timing, jank, critical user journey performance | Planned |
| API load and reliability | Grafana k6 | Threshold-based latency, error, throughput, soak, and burst tests | Planned |
| Static security | GitHub CodeQL, dependency review, npm audit, secret scanning | Code/data-flow vulnerabilities, dependency changes, exposed secrets | Partly implemented |
| Dynamic security | OWASP ZAP automation | Authentication, headers, input handling, common web vulnerabilities | Planned |
| Combinatorial coverage | NIST ACTS or generated covering arrays | Pairwise through variable-strength interaction coverage | Planned |
| Production verification | GitHub Actions, curl probes, Render/Supabase health checks | Confirms the deployed release and its external dependencies | Implemented and expanding |
| Human field testing | Structured device checklist and screenshot review | Lighting, gloves, interruptions, NFC placement, human comprehension | Required for every release |

### 3.1 Primary references

- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright traces: https://playwright.dev/docs/trace-viewer-intro
- Playwright and axe accessibility: https://playwright.dev/docs/accessibility-testing
- fast-check property-based testing: https://fast-check.dev/docs/introduction/what-is-property-based-testing/
- Stryker mutation testing: https://stryker-mutator.io/docs/
- Pact contract testing: https://docs.pact.io/
- Schemathesis: https://schemathesis.readthedocs.io/en/stable/
- Supabase database testing and pgTAP: https://supabase.com/docs/guides/local-development/testing/overview
- Android Espresso: https://developer.android.com/training/testing/espresso
- Android UI Automator: https://developer.android.com/training/testing/other-components/ui-automator
- Firebase Test Lab: https://firebase.google.com/docs/test-lab
- Android Macrobenchmark: https://developer.android.com/topic/performance/benchmarking/benchmarking-overview
- Grafana k6 thresholds: https://grafana.com/docs/k6/latest/using-k6/thresholds/
- GitHub CodeQL: https://docs.github.com/en/code-security/concepts/code-scanning/codeql
- OWASP ZAP automation API: https://www.zaproxy.org/docs/api/
- NIST ACTS combinatorial tools: https://csrc.nist.gov/projects/automated-combinatorial-testing-for-software/downloadable-tools

---

## 4. Test architecture: concentric quality rings

Every important rule is tested in more than one ring.

### Ring 0 — Requirements and invariants

Before code changes, write the behavior as an invariant, state transition, contract example, or measurable visual/performance rule. Ambiguous requirements are defects in waiting.

### Ring 1 — Static and source contracts

- Syntax and type checks.
- Dependency and import architecture.
- Required files, release IDs, scripts, routes, and cache-busting values.
- Forbidden strings and privileged-storage patterns.
- Security analysis and dependency review.
- Test-plan and impact-map validation.

### Ring 2 — Unit, property, and mutation tests

- Pure transformation and validation functions.
- Time, status, sorting, identity, schedule scoring, deduplication, and retry logic.
- Generated values at boundaries and invalid combinations.
- State-machine command sequences.
- Mutation scores for critical logic.

### Ring 3 — Database and backend integration

- Rebuild every migration into a clean database.
- Test constraints, functions, histories, grants, RLS, and transactions.
- Exercise service code against the disposable database.
- Verify idempotency and concurrent requests.
- Test migration from the previous production schema as well as rebuild from zero.

### Ring 4 — Consumer/provider contracts

- The exact frontend API client generates the contract.
- The backend verifies every active consumer contract.
- Additional OpenAPI schema fuzzing probes undocumented and invalid states.

### Ring 5 — Browser functional and visual tests

- Complete manager, employee, and viewer journeys.
- Desktop, narrow phone, tall phone, landscape, keyboard-open, and reduced-motion modes.
- Visual snapshots and geometry assertions.
- Automated accessibility scans and keyboard navigation.
- Network interruption, delayed responses, duplicate responses, and concurrency.

### Ring 6 — Native Android tests

- Capacitor bridge, SecureStorage, status bar, notifications, app links, and NFC entry.
- Espresso interactions within the app.
- UI Automator interactions across the Android system boundary.
- Upgrade, reinstall, wake, background, permissions, and process-death recovery.

### Ring 7 — Device matrix, performance, and resilience

- Firebase Test Lab physical and virtual devices.
- Startup, frame timing, memory, network, and battery-sensitive journeys.
- API load, burst, soak, and worker-backlog behavior.
- Failure injection for Render, Supabase, Firebase, network, clock, and storage.

### Ring 8 — Deployed release and field acceptance

- GitHub Pages asset hashes.
- Render commit and dependency health.
- Supabase schema fingerprint and grants.
- Firebase project/package identity.
- APK package name, icon, edition, and embedded assets.
- Screenshots from the actual zoo phones.
- Structured employee and manager field acceptance.

---

## 5. Test environments and data

### 5.1 Environments

| Environment | Purpose | Data policy |
|---|---|---|
| Local pure test | Unit, property, source, mutation | Generated synthetic data only |
| Local disposable database | Migrations, functions, integration, concurrency | Recreated for each suite; transaction rollback or unique namespaces |
| Browser intercepted backend | UI logic and deterministic failures | Mocked envelopes and explicit state machines |
| Staging/preview deployment | Contract, API fuzz, ZAP, performance smoke | Synthetic identities, devices, locations, and messages |
| Firebase Test Lab | Android instrumentation and Robo | Synthetic accounts and resettable device data |
| Production read-only verification | Health, version, permissions, schema, asset identity | No destructive writes unless the probe is explicitly designed and self-cleaning |
| Production field acceptance | Actual phone behavior | Controlled test location/device and clearly labeled test records |

### 5.2 Test-data rules

- Every test creates unique IDs or runs inside a rollback transaction.
- No test depends on execution order.
- No test reuses a real employee name for a mutable scenario.
- Fixed clocks are used for deterministic unit and browser tests.
- Timezone cases include America/Chicago, daylight-saving spring-forward, fall-back, midnight service-date boundaries, and device clock skew.
- Sensitive production values are never copied into test artifacts.
- Attachments use generated images with known dimensions, MIME types, sizes, and malicious filename cases.
- Test devices have explicit labels such as `TEST_KIOSK_04`, never ambiguous production aliases.

---

## 6. Global invariants

The machine-readable source is `quality/system-impact-map.json`. The following are release-blocking:

1. **Authoritative success:** no UI says completed, sent, assigned, deleted, or saved before the authoritative layer confirms it.
2. **Exactly-once effect:** retries may occur, but one logical operation creates one durable effect.
3. **Identity integrity:** the person, Messenger user, employee record, device, credential, and aliases agree.
4. **Historical integrity:** reassignment never rewrites who performed earlier work.
5. **Authority separation:** manager, employee, viewer, service, anonymous, and retired identities cannot borrow one another's privileges.
6. **State-machine validity:** cleaning, messages, events, schedules, assignments, notifications, and deletions follow legal transitions only.
7. **Offline honesty:** pending work is shown as pending, not falsely complete.
8. **Visual predictability:** common controls have common geometry and placement.
9. **Reachability:** no Android bar, keyboard, cutout, modal, or sticky element covers the final control.
10. **Accessible meaning:** color is not the only signal; every control has a name, focus state, and adequate target.
11. **Cross-view consistency:** manager, employee, dashboard, schedule, Messenger, and database views resolve the same source fact consistently.
12. **Release identity:** frontend, backend, schema, mobile packages, and Firebase configuration form one traceable release.
13. **Failure containment:** one failed dependency cannot corrupt unrelated state.
14. **Auditability:** high-risk changes record actor, time, source, prior value, new value, and reason.
15. **Secret containment:** credentials, tokens, one-time codes, and private content do not enter logs, screenshots, artifacts, or ordinary local storage.

---

## 7. Change-impact analysis and the “single variable” problem

### 7.1 Purpose

A change to one variable can cross many subsystem boundaries. The system therefore maintains an explicit dependency graph rather than guessing which tests to run.

Examples:

- `employee.active` affects phone release, Messenger availability, schedule eligibility, current identity, and manager lists.
- `devices.assigned_employee_id` affects device identity, Messenger user mapping, schedule lookup, scan attribution, notification targeting, and app header copy.
- `location.status_code` affects dashboard order, status chip, visible fields, alerts, filters, and manager decisions.
- `thread.viewer_can_send` affects composer state, message API authorization, deletion controls, and read receipts.
- `release_id` affects cache busting, asset hashes, live deployment checks, backend compatibility, and mobile build evidence.

### 7.2 Required method for every change

1. Identify directly changed components from file patterns.
2. Expand downstream dependents through `quality/system-impact-map.json`.
3. Collect all required suites and invariants.
4. Add a regression test for the defect or requirement.
5. Run targeted tests during development.
6. Run the full-system gate before release.
7. Compare production evidence after deployment.

`tools/plan-change-impact.mjs` produces a machine-readable impact report. Unmapped production files are warnings during initial adoption and become release failures once the map reaches full coverage.

### 7.3 Variable propagation test format

Every critical variable receives a table with these fields:

| Field | Meaning |
|---|---|
| Source of truth | Authoritative table, function, service, or device API |
| Allowed values | Valid domain and nullability |
| Writers | Every code path that may change it |
| Readers | Every view, worker, API, and rule that consumes it |
| Derived values | Cached, displayed, or calculated forms |
| Invariants | What must remain true before and after change |
| Negative cases | Unauthorized, stale, conflicting, duplicated, and malformed attempts |
| Concurrency cases | Competing changes and expected winner/rollback behavior |
| Recovery cases | Offline replay, process death, deploy, and rollback behavior |
| Evidence | Tests, audit rows, logs, screenshots, traces, and database queries |

### 7.4 Mutation and model-based verification

- Stryker changes conditions, operators, constants, and returns. A surviving mutation means the suite does not actually protect the rule.
- fast-check generates command sequences against a simplified reference model. The real system and model must end in equivalent observable states.
- High-value models include cleaning sessions, phone reassignment, Messenger send/delete/read, event lifecycle, schedule reassignment, and notification acknowledgement.
- Failed generated cases retain the seed and minimized counterexample.

### 7.5 Combinatorial interaction coverage

Full Cartesian testing is wasteful and often impossible. NIST ACTS covering arrays will generate pairwise by default and stronger 3-way to 6-way coverage for critical variables.

Initial parameter set:

- App edition: manager, custodial, viewer.
- Authority: valid, expired, revoked, wrong role, missing.
- Device: canonical, alias, unassigned, inactive, credential missing, credential stale.
- Network: online, offline, intermittent, slow, duplicated response, timeout.
- App lifecycle: cold start, warm start, background, killed, wake, upgrade.
- Viewport: narrow portrait, tall portrait, landscape, keyboard open, large text.
- Data state: empty, normal, maximum expected, stale, conflicting, deleted.
- Time: normal day, midnight boundary, DST change, clock behind, clock ahead.
- Operation: first attempt, retry, concurrent duplicate, concurrent conflict.
- Dependency: healthy, Render degraded, Supabase unavailable, Firebase unavailable.

Constraints prevent impossible combinations; variable-strength coverage raises interaction depth around identity, offline replay, and reassignment.

---

## 8. Visual placement and interaction testing

### 8.1 Canonical geometry contracts

Release-blocking geometry rules:

- Canonical Back control: 116 by 52 CSS pixels in controlled browser tests and equivalent density-independent dimensions in Android.
- Same label, arrow, radius, visual hierarchy, and upper-left anchor on every secondary page.
- Minimum touch target: 44 by 44 CSS pixels; native targets follow Android accessibility guidance.
- Interactive content remains above the Android navigation guard and above the on-screen keyboard.
- No critical horizontal overflow at supported widths.
- Final buttons, links, status text, build data, and advanced scheduler controls remain scroll-reachable.
- Sticky navigation and composers never obscure the focused control.

### 8.2 Viewport matrix

At minimum:

- 320 × 568 narrow legacy phone.
- 360 × 800 common Android.
- 390 × 844 modern narrow phone.
- 412 × 915 tall Android.
- 480 × 960 large phone.
- 667 × 390 landscape.
- 1280 × 720 and 1440 × 900 desktop/Chromebook.
- Each phone size with browser text scaling at 100%, 130%, and 200% where technically possible.
- Reduced-motion, high-contrast preference, and keyboard-only modes.

### 8.3 Visual snapshot policy

- Baselines are generated in a pinned Linux container with pinned browser version, fonts, timezone, locale, and device scale factor.
- Dynamic timestamps, random IDs, animation, caret, and network data are frozen or masked.
- Snapshots cover empty, loading, normal, error, offline, long-copy, large-list, and destructive-confirmation states.
- A changed snapshot requires human review; baseline updates cannot be merged blindly.
- Geometry assertions remain even when a snapshot is approved, preventing a visually similar but functionally covered control.

### 8.4 Screenshot-after-implementation audit

For every major implementation batch:

1. Capture all pages at Samsung-sized portrait and landscape viewports.
2. Capture top, middle, and bottom scroll positions.
3. Capture open keyboard, modal, dropdown, error, loading, and offline states.
4. Compare safe-area clearance, alignment, typography, contrast, truncation, and page identity.
5. Record defects by screenshot coordinate and component.
6. Fix and recapture before release.

---

## 9. Accessibility and human comprehension

### 9.1 Automated web checks

- axe WCAG A/AA scan for each stable page state.
- Accessible name and role for every interactive element.
- No duplicate IDs.
- Contrast checks for text, statuses, disabled controls, and background imagery.
- Heading hierarchy and landmark checks.
- Form labels, error associations, and live-region announcements.
- Keyboard order, focus trapping, escape behavior, and focus restoration.

### 9.2 Android checks

- Espresso AccessibilityChecks on every instrumented interaction.
- UI Automator inspection of system-visible semantics.
- TalkBack traversal and action labels.
- Switch Access and external keyboard smoke tests.
- Large text, display zoom, color correction, and magnification.
- Haptic/audio alerts must have equivalent visual meaning.

### 9.3 Operational comprehension

- Status wording is explicit: `NOT CLEANED`, `CLEANING IN PROGRESS`, `DUE SOON`, `OVERDUE`, `CLEANED`.
- Color reinforces meaning but never replaces text or iconography.
- Destructive actions explain what changes and what history remains.
- Error messages describe the user action required; raw `HTTP 404` is not acceptable user copy.
- The employee app prioritizes the work the employee can do now, not administrative implementation detail.

---

## 10. Functional journey catalog

### 10.1 Operations Manager critical journeys

1. First enrollment with a valid personal code.
2. Invalid, expired, reused, and wrong-role enrollment codes.
3. Session refresh, expiry, revocation, and phone removal.
4. Open dashboard and observe all status classes.
5. Confirm NOT CLEANED rows omit empty detail fields.
6. Filter, sort, refresh, and inspect open tickets.
7. Open schedule, mark absences, configure CoverAll, reassign day, and compare employee views.
8. Reach the advanced scheduler control at the bottom without system-nav obstruction.
9. Open Messenger, converse with Memphis AI, direct-message an employee, create a group, receive a message, retry offline, and delete an eligible conversation.
10. Confirm retired Operations Leadership room is absent.
11. Create an employee, assign a phone, move a phone, unassign a phone, mark an employee inactive, reactivate an employee, and verify history.
12. Confirm reassigned phone wakes as the new employee without reinstall and prior work attribution remains unchanged.
13. Create/edit/view events and validate notifications.
14. Configure notifications and receive foreground/background test messages.
15. Submit feedback with and without an image, cancel with unsaved work, and retry after network failure.
16. Use Moxie Chat, Notes, Reminders, and Contacts without cross-tab or cross-user leakage.
17. Open diagnostics and read-only tools with correct role restrictions.

### 10.2 Custodial Employee critical journeys

1. Enroll an assigned phone with a valid single-use code.
2. Reject wrong kiosk, invalid origin, expired code, and unassigned phone.
3. Cold-start, wake, and background recovery retain correct employee identity.
4. See the correct assigned areas and no other employee's private assignment.
5. Tap an NFC tag from foreground, background, and permitted lock-screen state.
6. Start cleaning, navigate away, return, finish, and observe authoritative completion.
7. Start or finish while offline; see pending state; restore network; reconcile once.
8. Attempt duplicate start, duplicate finish, conflicting location, stale session, and cancelled session.
9. Observe GPS verified, unverified, inaccurate, stale, and offsite states without false certainty.
10. Open Messenger without manager authentication, converse with Memphis AI, send to a manager, create a group, receive an alert, and retry offline.
11. Read schedule and compare it with the manager schedule for the same service date.
12. Read events and submit maintenance/app feedback.
13. Have the phone reassigned; verify the next wake shows the new employee and no prior employee's private state.

### 10.3 Viewer journeys

- Open without mutation controls.
- View status data consistent with the manager dashboard.
- Confirm every write endpoint and hidden control remains inaccessible.
- Confirm viewer package identity, icon, and start page.

---

## 11. Domain and cross-system test matrices

### 11.1 Cleaning state machine

States: none, provisional offline, starting, active server session, finishing, pending sync, completed, cancelled, expired.

Transitions to test:

- Legal forward transitions.
- Duplicate same-operation transitions.
- Illegal backward transitions.
- Concurrent starts from aliases or two windows.
- Finish after cancellation or expiry.
- Process death between local save and server response.
- Server success with lost response.
- Client success display only after reconciliation.
- Dashboard, schedule, scan history, and employee attribution convergence.

### 11.2 Phone assignment state machine

States: assigned active employee, assigned inactive employee, unassigned, moved, credential missing, credential valid, enrollment pending.

Test:

- Atomic move between employees.
- Atomic move of an employee between phones.
- Release on inactivation.
- Credential preservation.
- Alias reassignment.
- Messenger identity update.
- Schedule and scan attribution after wake.
- Competing manager writes and audit history.
- Rollback when any dependent write fails.

### 11.3 Messenger state machine

States: no thread, direct/group/bot thread, read-only, draft, queued, sent, failed, retried, read, deleted, archived/retired.

Test:

- Stable client IDs and idempotency.
- Out-of-order updates and cursor progression.
- Duplicate long-poll responses.
- Current-user exclusion from recipient picker.
- Participant authorization.
- Manager and employee authority paths.
- Memphis bot routing.
- Read receipt and unread badge convergence.
- Conversation deletion and message deletion authority.
- Retired system room filtering at backend and client.

### 11.4 Schedule state machine

- Baseline schedule generation.
- Absence preview and publish.
- CoverAll activation, time changes, and clearing.
- Reassignment balance and restricted-area rules.
- Lunch coverage and overlap.
- Repeated regeneration idempotency.
- Concurrent schedule edits.
- Manager/employee rendering agreement.
- Service-date and DST boundaries.

### 11.5 Event and notification state machine

- Draft/create/update/cancel/archive event.
- Event history references survive event changes.
- Notification jobs use valid kinds and targets.
- Dedupe, retry, acknowledgement, expiry, and revoked-token behavior.
- Foreground, background, killed-app, and device-reboot delivery.

---

## 12. API and database verification

### 12.1 API contracts

Every endpoint records:

- Authentication modes and required roles.
- Required headers, query parameters, and body schema.
- Success envelope and all expected error envelopes.
- Idempotency behavior.
- Pagination/cursor behavior.
- Rate limits and retry guidance.
- Side effects and transaction boundary.
- Audit records and emitted jobs.

Pact protects consumer assumptions. OpenAPI plus Schemathesis probes schema boundaries and stateful sequences. Direct backend tests protect provider business behavior.

### 12.2 Database tests

For every table/function/policy touched:

- Existence, columns, types, defaults, nullability, constraints, indexes, and foreign keys.
- Positive and negative permissions for anon, authenticated, service role, manager roles, and device authority.
- Security-definer search path and grants.
- History-row creation and immutable attribution.
- Transaction rollback when any dependent statement fails.
- Advisory-lock and concurrency behavior.
- Rebuild from zero and upgrade from prior production schema.
- Schema fingerprint and production-drift query.
- Backup/restore compatibility.

### 12.3 Data consistency probes

Automated queries detect:

- More than one active employee per phone.
- More than one active phone per employee.
- Active Messenger device assignment to an inactive employee.
- Device alias pointing to a different Messenger user than its canonical device.
- Completed session without employee, location, start, finish, or required response.
- Dashboard status inconsistent with latest authoritative session.
- Orphaned event history, message participants, acknowledgements, or audit rows.
- Duplicate idempotency keys with different payloads.
- Queue jobs stuck beyond threshold.

---

## 13. Security and privacy plan

### 13.1 Static security

- CodeQL for JavaScript/TypeScript, Java/Kotlin, and GitHub Actions.
- npm audit and dependency review on every dependency change.
- Secret scanning and explicit forbidden patterns.
- Android manifest review for exported activities, intents, cleartext traffic, backups, and permissions.
- Database function search paths, grants, RLS, and service-role-only boundaries.

### 13.2 Dynamic security

- ZAP baseline on public pages and authenticated contexts.
- Authorization matrix for every mutation endpoint.
- CSRF, CORS, origin, cookie, token replay, and session fixation tests.
- Input injection, stored content, filename, MIME, oversized payload, and Unicode confusable cases.
- Rate-limit and brute-force tests for enrollment and unlock codes.
- Device credential theft, reuse, revocation, and wrong-edition tests.
- Sensitive information review of logs, traces, screenshots, crash reports, and artifacts.

### 13.3 Mobile security field checks

- No privileged secrets in WebView local storage, screenshots, clipboard, notifications, recents preview, or logcat.
- SecureStorage survives expected upgrade but is removed on explicit enrollment removal.
- Lost phone revocation takes effect without physical access.
- App links and NFC intents cannot silently invoke privileged manager operations.

---

## 14. Performance, capacity, and resource use

### 14.1 Web/client budgets

- Cold manager home interactive target.
- Messenger thread list and open-thread render target.
- Dashboard refresh target with maximum expected rows.
- No long task above the agreed threshold during normal interaction.
- Asset-size budgets for icons, page-family backgrounds, custom Messenger assets, and shared scripts.
- Memory does not grow continuously during long-polling or repeated navigation.

### 14.2 Android budgets

Macrobenchmark records:

- Time to initial and full display.
- Frame timing during home, dashboard, schedule, Messenger, and scrolling.
- Cold/warm/hot start.
- Background-to-foreground recovery.
- Memory after repeated navigation.
- Battery-sensitive GPS, polling, and notification behavior.

### 14.3 API load profiles

k6 profiles:

- Smoke: one user through each endpoint.
- Average: expected active phones and managers.
- Burst: shift start, event reminder, or network restoration.
- Soak: eight-hour operating day.
- Offline replay: several phones flush queued work together.
- Degraded database: controlled latency and connection pressure.

Initial release thresholds are measured from a stable baseline, then tightened. Error-rate and percentile thresholds fail CI; load tests never target production without explicit approval and safe limits.

---

## 15. Resilience and failure injection

Test each critical journey with failures before, during, and after the authoritative write:

- Network offline, DNS failure, TLS failure, timeout, slow response, connection reset.
- Response lost after server commit.
- Duplicate client request and duplicate server response.
- Render restart during operation.
- Supabase temporary unavailability, transaction abort, deadlock, and connection exhaustion.
- Firebase unavailable or token invalid.
- Device storage quota, corrupted cached entry, and SecureStorage read failure.
- Android process killed, device rebooted, clock changed, battery saver enabled.
- Old frontend with new backend and new frontend with minimum supported backend.

Expected outcomes:

- No false success.
- No duplicate durable effect.
- User sees a clear pending or retry state.
- Recovery is automatic where safe and explicit where human choice is required.
- Audit and health systems expose the failure.
- Unrelated modules continue operating where dependencies permit.

---

## 16. Deployment, rollback, and disaster recovery

### 16.1 Pre-merge gate

- All required impacted suites pass.
- No unexplained skipped test.
- No new high/critical dependency or CodeQL alert.
- Mutation threshold holds for changed critical logic once enabled.
- Visual diffs reviewed.
- Database rebuild and upgrade path pass for schema changes.
- APKs build for all editions.

### 16.2 Pre-release gate

- Full-system nightly workflow green on the release commit.
- Firebase device matrix green.
- Performance budgets green or explicitly approved.
- ZAP and API fuzzing show no release-blocking finding.
- Manual device checklist green.
- Release manifest and evidence bundle complete.

### 16.3 Post-deploy gate

- GitHub Pages assets match manifest hashes and deployment SHA.
- Render `/version` matches the backend release commit.
- Dependency health, queues, and workers are healthy.
- Supabase migration versions, functions, permissions, and schema fingerprint match.
- Firebase package/project identity matches the APK.
- Read-only and controlled write canaries pass.
- Screenshots from actual devices show no new layout obstruction.

### 16.4 Rollback and recovery drills

Quarterly and before major schema changes:

- Restore database backup into an isolated project and run acceptance tests.
- Redeploy previous compatible frontend and backend.
- Prove queued offline work behavior across rollback.
- Revoke a lost phone and verify access stops.
- Rotate a credential and Firebase token.
- Rebuild all APKs from the tagged commit.
- Reconstruct release evidence from repository and artifacts.

---

## 17. Manual field acceptance

Automation cannot judge every real-world condition. Every release is tested on at least one actual manager phone and one custodial phone.

### 17.1 Physical checklist

- App icon, name, and edition are unmistakable.
- Cold launch and wake are fast enough.
- Text is readable indoors, outdoors, and in dim areas.
- Controls work with one hand and imperfect taps.
- Back control is always in the same place.
- Bottom controls remain above Android navigation.
- Keyboard does not hide submit controls.
- NFC tags open the correct location on the first practical attempt.
- Wi-Fi loss and restoration are understandable.
- Audio, vibration, and visual notification agree.
- The employee can explain what the screen wants them to do without coaching.

### 17.2 Screenshot set

Capture and retain:

- Manager home, dashboard status variants, schedule top/bottom, Messenger list/thread/composer, phone assignment, notifications, feedback, Moxie tabs.
- Employee home, enrollment, assigned areas, NFC start/finish, pending offline, Messenger, schedule, report form.
- Portrait and landscape where supported.
- Keyboard open and Android navigation visible.

---

## 18. Evidence and defect discipline

Every automated run should retain, as applicable:

- Test summary and exact commit.
- Change-impact report.
- Playwright trace, screenshot, video, console, and network log for failures.
- Visual diff images.
- Coverage and mutation reports.
- Contract files and provider verification.
- Database rebuild log and pgTAP output.
- API fuzz reproduction commands.
- ZAP/CodeQL/dependency SARIF.
- k6 summary and thresholds.
- Firebase Test Lab matrix, device logs, screenshots, and video.
- APK checksums, package names, version codes, icons, and build metadata.
- Live Render/Supabase/GitHub Pages verification transcript.

Defects include:

- Smallest reproducible state.
- Expected invariant.
- Actual behavior.
- Affected release/device/role/network state.
- Screenshot or trace.
- Root cause.
- Regression test added.
- Blast-radius review through the impact map.

A defect is not closed until its regression test passes at the narrowest layer and the appropriate whole-system layer.

---

## 19. Cadence

| Cadence | Required work |
|---|---|
| Every edit | Syntax/type, focused unit/property tests |
| Every pull request | Source contracts, impacted browser tests, mobile contracts/build, dependency/security checks, change-impact report |
| Every schema/backend pull request | Disposable database rebuild, backend contracts, concurrency/idempotency, provider contracts |
| Nightly | Full browser matrix, visual/a11y, mutation sample, API fuzz, combinatorial set, Android emulator/device sample, load smoke |
| Release candidate | Full physical-device matrix, performance, dynamic security, field screenshots, all-app APK inspection |
| After deployment | Asset/commit/schema/Firebase identity and live health acceptance |
| Quarterly | Restore, rollback, lost-device revocation, credential rotation, disaster-recovery drill |

---

## 20. Release-blocking severity

| Severity | Definition | Release rule |
|---|---|---|
| Critical | Security boundary failure, data corruption/loss, wrong employee identity, duplicate completion, unusable core journey | Always block |
| High | Major journey failure, covered control, incorrect schedule/dashboard state, broken notification or Messenger | Block unless rolled back/fixed |
| Medium | Significant confusion, accessibility failure, non-core feature failure with workaround | Normally block; explicit owner decision required |
| Low | Cosmetic defect without interaction or comprehension impact | May defer with recorded issue |

Flaky tests are defects. A test is not muted without a named owner, reason, issue, and expiration date.

---

## 21. Implementation sequence

### Phase A — Foundation now

- Keep current GitHub contract, browser, database rebuild, mobile build, APK, and live-deployment gates green.
- Add this plan, the impact map, plan validation, and change-impact artifact.
- Complete canonical Back geometry and Android safe-area tests.
- Capture actual-device screenshots after the current app implementation.

### Phase B — Visual, accessibility, and generated logic

- Add Playwright screenshot baselines for every page state and viewport.
- Add axe scans and manual accessibility checklist.
- Extract critical pure domain functions where needed.
- Add fast-check properties and state-machine models.
- Add Stryker mutation thresholds for identity, status, retry, schedule, and Messenger logic.

### Phase C — Cross-repository contracts and database depth

- Publish an OpenAPI specification for active backend routes.
- Add Pact consumer/provider verification between Engine and `memphis-zoo-mcp`.
- Add Schemathesis nightly stateful fuzzing.
- Add pgTAP tests for schema, permissions, functions, and negative authority cases.
- Add automated consistency probes to Render health diagnostics.

### Phase D — Native and device laboratory

- Add Espresso tests for core WebView/native bridge journeys.
- Add UI Automator tests for launch, status/navigation bars, deep links, NFC intents, wake, background, and permissions.
- Add Firebase Test Lab matrices for selected Samsung/Pixel models and Android versions.
- Add Macrobenchmark startup/frame metrics and release budgets.

### Phase E — Reliability and recovery maturity

- Add k6 smoke, burst, replay, and soak profiles.
- Add ZAP authenticated automation.
- Add NIST ACTS covering-array generation to the nightly matrix.
- Automate backup restore and rollback drills in an isolated environment.
- Turn unmapped production files in the impact tool from warnings into failures.

---

## 22. Definition of a completed release

A release is complete only when:

- The implementation satisfies the documented invariants.
- Every affected test ring is green.
- The tests can detect representative deliberate mutations.
- Visual and accessibility evidence is reviewed.
- Manager, employee, and viewer authority remain separated.
- Database rebuild, migration, constraints, and audit histories are valid.
- APKs are inspected and tested on physical devices.
- GitHub Pages, Render, Supabase, and Firebase identities agree.
- Production health and controlled canaries pass.
- Actual-device screenshots show no covered or misplaced controls.
- A rollback path is known.
- Remaining defects are explicitly documented and below the accepted release threshold.

The desired end state is not “many tests.” It is one understandable system whose parts continuously prove that they still belong together.
