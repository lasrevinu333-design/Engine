from pathlib import Path
import runpy


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    source = file.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    file.write_text(source.replace(old, new, 1))


# Correct one over-escaped matcher in the first deterministic repair script.
repair = Path('scripts/repair-custodial-v23-audit-findings.py')
source = repair.read_text()
anchor = source.index("'mode-specific confirmation contract'")
start = source.index('    source = replace_once(', anchor)
end = source.index('    return source', start)
replacement = '''    old_line = next(
        line for line in source.splitlines()
        if line.startswith("assert.doesNotMatch(app, /Message queued for retry:")
    )
    source = source.replace(
        old_line,
        "assert.match(app, /EMPLOYEE_CONTEXT \\? employeeSafeError\\(error, \\{ sending: true \\}\\) : `Message queued for retry:/, 'manager diagnostics must remain outside employee-safe copy');",
        1,
    )
'''
repair.write_text(source[:start] + replacement + source[end:])
runpy.run_path(str(repair), run_name='__main__')

# Notification channel IDs are stable, versioned semantic identifiers. Routes
# are verified independently so a filename change cannot silently rename a
# system notification channel.
Path('scripts/batch-1-employee-notification-contract-tests.mjs').write_text(r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [config, bridge] = await Promise.all([
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8'),
]);

assert.match(config, /const custodialPlugins = \[[^\]]*'@capacitor-firebase\/messaging'[^\]]*'@capacitor\/local-notifications'/);
assert.doesNotMatch(config, /const custodialPlugins = \[[^\]]*'@capacitor\/barcode-scanner'/);
assert.match(config, /\.\.\.\(custodial \? \{\} : \{\s*ios:/);
assert.match(config, /viewer \? \{\} : \{ FirebaseMessaging:/);
assert.match(bridge, /\/employee-notifications-api\/register/);
assert.match(bridge, /\/employee-notifications-api\/opened/);
for (const channel of ['employee-events-v23', 'employee-messages-v23', 'employee-due-soon-v23', 'employee-overdue-v23']) {
  assert.ok(bridge.includes(`'${channel}'`), `missing native employee channel ${channel}`);
}
for (const route of ['./employee-events.html', './messages.html', './employee-schedule.html']) {
  assert.ok(bridge.includes(`'${route}'`), `missing safe native employee route ${route}`);
}
assert.match(bridge, /notificationActionPerformed/);
assert.match(bridge, /LocalNotifications\.schedule/);
assert.match(bridge, /localNotificationActionPerformed/);
assert.match(bridge, /notification_key/);
assert.match(bridge, /employee_location_status/);
assert.match(bridge, /nativeNotifications: true/);
assert.doesNotMatch(bridge, /requestEnvelope\(['"]\/messaging-api\/[^'"]*event|requestEnvelope\(['"]\/events-api\/[^'"]*message/i);

console.log('Batch 1 employee notification client contracts passed.');
''')

# The employee Messenger uses row-level swipe deletion. The handler still owns
# manager-only confirmation and the user-scoped delete endpoint.
replace_once(
    'scripts/batch-2-event-messenger-cutover-contract-tests.mjs',
    "assert.match(messengerApp, /\\{!selectedThread\\.shared && <button[^>]+onClick=\\{deleteThread\\}>Delete<\\/button>\\}/);",
    "assert.match(messengerApp, /onDelete=\\{\\(\\) => deleteThread\\(thread\\.id\\)\\}/);\nassert.match(messengerApp, /if \\(!EMPLOYEE_CONTEXT\\)[\\s\\S]*confirm\\(prompt\\)/);\nassert.match(messengerApp, /\\/thread\\/\\$\\{encodeURIComponent\\(thread\\.id\\)\\}\\/delete/);",
    'row-level Messenger deletion contract',
)

# Visible employee Home copy must not expose technical identifiers. Internal
# identity variables are allowed and are required for authenticated requests.
replace_once(
    'scripts/operational-insights-contract-tests.mjs',
    "assert.doesNotMatch(employeeHome,/Assigned Areas|device[_ -]?id/i);",
    "assert.doesNotMatch(employeeHome,/>Assigned Areas<|>Device ID<|id=\"device-name\"/i);",
    'visible-only employee Home identifier contract',
)

# Current ownership uses direct novice-safe empty states.
replace_once(
    'scripts/scheduler-alerts-gps-foundation-tests.mjs',
    "assert.match(schedule, /Not scheduled to work today\\./);",
    "assert.match(schedule, /You are not scheduled today\\./);\nassert.match(schedule, /No areas are assigned right now\\. Tell a manager\\./);",
    'current ownership empty-state contract',
)

# Complete the VM DOM harness so its retired lock helper cannot emit a false
# TypeError while the scan behavior itself is being tested.
replace_once(
    'scripts/scan-device-employee-default-tests.mjs',
    "    body: { style: { setProperty() {} }, classList: { add() {}, remove() {} } },",
    "    body: { style: { setProperty() {} }, classList: { add() {}, remove() {} } },\n    documentElement: { classList: { add() {}, remove() {} } },",
    'scan harness document element',
)
replace_once(
    'scripts/scan-device-employee-default-tests.mjs',
    "      return { addEventListener() {}, innerHTML: '', textContent: '' };",
    "      return { addEventListener() {}, innerHTML: '', textContent: '', hidden: false, style: {}, classList: { add() {}, remove() {} } };",
    'scan harness generic node',
)

# Remove temporary repair carriers and trigger markers from the verified branch.
for temporary in [
    'scripts/run-custodial-v23-audit-repair.py',
    'requests/custodial-v23-audit-repair.trigger',
    'requests/custodial-v23-audit-repair-rerun.trigger',
]:
    Path(temporary).unlink(missing_ok=True)

print('Completed source-complete Custodial v23 audit contract alignment.')
