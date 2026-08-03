from pathlib import Path
import subprocess

RELEASE = 'release-2026.07.19.custodial-v3.12'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def update(path: str, transform) -> None:
    file = Path(path)
    source = file.read_text()
    result = transform(source)
    if result == source:
        raise SystemExit(f'{path}: transform made no change')
    file.write_text(result)


# Fix the real secondary-page runtime exception and keep native employee Back
# query-free while returning to the canonical employee Home.
def repair_memphis_ui(source: str) -> str:
    return replace_once(
        source,
        '  function canonicalBackTarget(context = resolvedContext()) {\n    const target = new URL(',
        '  function canonicalBackTarget(context = resolvedContext()) {\n    const nativeCustodialHome = context === "employee" && isNativeCustodialAuthority();\n    const target = new URL(',
        'native employee Back authority',
    )


update('memphis-ui.js', repair_memphis_ui)


# Preserve the approved confirmation-free employee deletion while restoring the
# pre-existing manager prompts and diagnostics outside employee mode.
def repair_messenger(source: str) -> str:
    source = replace_once(
        source,
        "      setNotice(employeeSafeError(error, { sending: true }), 'error');",
        "      setNotice(EMPLOYEE_CONTEXT ? employeeSafeError(error, { sending: true }) : `Message queued for retry: ${safe(error)}`, 'error');",
        'manager send failure detail',
    )
    source = replace_once(
        source,
        "    if (!thread || thread.shared) return;\n    const previousThreads = threadsRef.current;",
        "    if (!thread || thread.shared) return;\n    if (!EMPLOYEE_CONTEXT) {\n      const prompt = isMemphis(thread)\n        ? 'Delete this Memphis conversation from your Messenger? Your next Memphis message will start a clean conversation.'\n        : `Delete “${thread.title}” from your Messenger? Other participants keep their copy.`;\n      if (!confirm(prompt)) return;\n    }\n    const previousThreads = threadsRef.current;",
        'manager-only delete prompt',
    )
    source = replace_once(
        source,
        "      setNotice('Deleted.', 'ok');",
        "      setNotice(EMPLOYEE_CONTEXT ? 'Deleted.' : 'Conversation removed from your Messenger.', 'ok');",
        'mode-specific delete success',
    )
    source = replace_once(
        source,
        "      setNotice(employeeSafeError(error), 'error');\n    }\n  }, [currentDeviceId, loadThreads, messages, setNotice]);",
        "      setNotice(EMPLOYEE_CONTEXT ? employeeSafeError(error) : safe(error), 'error');\n    }\n  }, [currentDeviceId, loadThreads, messages, setNotice]);",
        'mode-specific delete failure',
    )
    source = replace_once(
        source,
        "      message: row.failed ? `${row.body}  · Saved` : String(row.body || ''),",
        "      message: row.failed ? `${row.body}  ${EMPLOYEE_CONTEXT ? '· Saved' : '[queued]'}` : String(row.body || ''),",
        'mode-specific queued message label',
    )
    return source


update('mobile/src/chatscope/app.jsx', repair_messenger)


def version_employee_page(source: str) -> str:
    source = source.replace("url('./dashboard-bg_optimized.webp')", f"url('./dashboard-bg_optimized.webp?v={RELEASE}')")
    for asset in ['memphis-ui.css', 'memphis-ui.js', 'memphis-auth.js', 'memphis-device-identity.js', 'memphis-scan-sync.js', 'memphis-device-reminders.js']:
        source = source.replace(f'./{asset}"', f'./{asset}?v={RELEASE}"')
    return source


for page in ['employee-hub.html', 'employee-events.html', 'employee-feedback.html']:
    update(page, version_employee_page)


# Current route shape rather than the retired native-index employee Home.
update('scripts/annie-origin-return-link-tests.mjs', lambda source: replace_once(
    source,
    "contains('ChatScope app returns employee sessions to the employee Hub', pages.messengerApp, \"EMPLOYEE_CONTEXT ? './employee-hub.html' : './start_page1.html'\");",
    "contains('ChatScope app returns employee sessions to the employee Hub', pages.messengerApp, \"EMPLOYEE_CONTEXT ? './employee-hub.html' : (nativeApp ? './index.html' : './start_page1.html')\");",
    'Annie employee route contract',
))


# QR is prohibited in the Custodial edition and employee event notifications now
# open the employee-only Events page.
def repair_batch1(source: str) -> str:
    source = replace_once(
        source,
        "assert.match(config, /const custodialPlugins = \\[[^\\]]*'@capacitor\\/barcode-scanner'/);",
        "assert.doesNotMatch(config, /const custodialPlugins = \\[[^\\]]*'@capacitor\\/barcode-scanner'/);",
        'no QR plugin contract',
    )
    source = replace_once(
        source,
        "for (const route of ['events.html', 'messages.html', 'employee-schedule.html']) {",
        "for (const route of ['employee-events.html', 'messages.html', 'employee-schedule.html']) {",
        'employee event notification route',
    )
    return source


update('scripts/batch-1-employee-notification-contract-tests.mjs', repair_batch1)


# Employee deletion remains immediate; manager confirmation remains outside the
# employee branch.
def repair_employee_messenger_contract(source: str) -> str:
    source = replace_once(
        source,
        "assert.doesNotMatch(deleteBlock, /confirm\\(/, 'employee deletion must not ask for a second confirmation');",
        "assert.match(deleteBlock, /if \\(!EMPLOYEE_CONTEXT\\)[\\s\\S]*confirm\\(prompt\\)/, 'manager confirmation must be isolated outside employee mode');",
        'mode-specific confirmation contract',
    )
    source = replace_once(
        source,
        "assert.doesNotMatch(app, /Message queued for retry: \\\$\\{safe\\(error\\)\\}/, 'employee send failures must not expose raw technical errors');",
        "assert.match(app, /EMPLOYEE_CONTEXT \\? employeeSafeError\\(error, \\{ sending: true \\}\\) : `Message queued for retry:/, 'manager diagnostics must remain outside employee-safe copy');",
        'mode-specific send failure contract',
    )
    return source


update('scripts/custodial-employee-messenger-v23-contract-tests.mjs', repair_employee_messenger_contract)


# The employee Home no longer owns assignments or a browser mock lock. It is the
# four-button native single-app Home approved for novice employees.
Path('scripts/employee-hub-kiosk-lock-screen-tests.mjs').write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../employee-hub.html', import.meta.url), 'utf8');
const release = 'release-2026.07.19.custodial-v3.12';

assert.match(html, /<body data-memphis-context="employee">/);
assert.match(html, /dashboard-bg_optimized\.webp\?v=release-2026\.07\.19\.custodial-v3\.12/);
assert.match(html, /<h1>Memphis Zoo Custodial<\/h1>/);
assert.match(html, /id="employee-name">Loading…<\/div>/);
for (const [label, page] of [
  ['Schedule', 'employee-schedule.html'],
  ['Messages', 'messages.html'],
  ['Events', 'employee-events.html'],
  ['Feedback', 'employee-feedback.html'],
]) {
  assert.match(html, new RegExp(`class="home-button" href="\\./${page.replace('.', '\\.') }\\?hub=employee">${label}<`));
}
assert.equal((html.match(/class="home-button"/g) || []).length, 4, 'Home must expose exactly four employee actions');
assert.doesNotMatch(html, /Assigned Areas|SCHEDULE_ME_URL|kiosk-lock-screen|Swipe up to unlock|Enrollment|Scan Location QR|Scanner|device id/i);
assert.doesNotMatch(html, /bottomNav|bottom-nav|fixedNav/i);
for (const asset of ['memphis-ui.css', 'memphis-auth.js', 'memphis-device-identity.js', 'memphis-scan-sync.js', 'memphis-device-reminders.js']) {
  assert.ok(html.includes(`./${asset}?v=${release}`), `${asset} must be cache-busted`);
}
assert.match(html, /fetch\(`\$\{API_BASE\}\/me\/by-device\?device_id=/);
assert.match(html, /visibilitychange/);
assert.match(html, /window\.addEventListener\('online'/);
assert.match(html, /memphis:mobile-ready/);
assert.match(html, /memphis:custodial-security-state/);
assert.match(html, /This phone needs a manager\./);

console.log('employee four-button Home contracts passed');
''')


Path('scripts/kiosk-lockscreen-contract-tests.mjs').write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => fs.readFileSync(path.resolve(scriptDir, `../${name}`), 'utf8');
const employeeHome = load('employee-hub.html');
const setup = load('mobile/src/custodial/index.html');
const bridge = load('mobile/src/custodial/bridge.js');
const managerHub = load('start_page1.html');
const managerController = load('ops-hub.js');

assert.doesNotMatch(employeeHome, /kiosk-lock-screen|lock-unlock-btn|Swipe up to unlock|kiosk-locked/i, 'employee Home must not emulate a second browser lock screen');
assert.match(employeeHome, /<body data-memphis-context="employee">/);
assert.equal((employeeHome.match(/class="home-button"/g) || []).length, 4);
assert.match(setup, /Custodial Phone Setup/);
assert.match(setup, /manager-assisted enrollment and recovery only/);
assert.doesNotMatch(setup, /Assigned Areas|Scan Location QR|NFC is always ready/i);
assert.match(bridge, /handleNfcIntent|nfc|location_code/i, 'native bridge must own ambient NFC');
assert.match(bridge, /employee-hub\.html/);
assert.doesNotMatch(managerHub, /id="kiosk-lock-screen"|lock-unlock-btn|Swipe up to unlock/i);
assert.doesNotMatch(managerController, /isFullyKioskRuntime|unlockKioskScreen/i);
assert.match(managerController, /requireOpsManagerSession/);
assert.match(managerController, /Named manager enrollment required/);
assert.match(managerController, /ops-manager-hub\.html/);

console.log(JSON.stringify({ ok: true, checked: ['employee_native_single_app_home', 'provisioning_only_setup', 'ambient_native_nfc', 'manager_named_enrollment_gate'] }, null, 2));
''')


# Native employee Back returns to employee-hub.html without importing URL identity.
def repair_native_navigation_contract(source: str) -> str:
    source = replace_once(
        source,
        "assert.equal(nativeTarget.toString(), 'https://localhost/index.html',\n  'native employee modules must return directly to the protected Custodial home');",
        "assert.equal(nativeTarget.toString(), 'https://localhost/employee-hub.html',\n  'native employee modules must return directly to the protected employee Home');",
        'native Home target contract',
    )
    source = replace_once(
        source,
        "for (const page of ['employee-schedule.html', 'events.html', 'system-feedback.html']) {",
        "for (const page of ['employee-schedule.html', 'employee-events.html', 'employee-feedback.html']) {",
        'employee secondary page list',
    )
    return source


update('scripts/native-custodial-navigation-contract-tests.mjs', repair_native_navigation_contract)


# Manager access tests should inspect the provisioning page and canonical employee
# Home separately rather than expecting the retired native Assigned Areas page.
def repair_manager_open(source: str) -> str:
    source = replace_once(
        source,
        "const custodialMobile=fs.readFileSync('mobile/src/custodial/index.html','utf8');",
        "const custodialMobile=fs.readFileSync('mobile/src/custodial/index.html','utf8');\nconst employeeHome=fs.readFileSync('employee-hub.html','utf8');",
        'manager test employee Home fixture',
    )
    source = replace_once(
        source,
        "assert.match(custodialMobile,/Assigned Areas/);\nassert.doesNotMatch(custodialMobile,/>Scanner</);",
        "assert.match(custodialMobile,/Custodial Phone Setup/);\nassert.match(custodialMobile,/manager-assisted enrollment and recovery only/);\nassert.doesNotMatch(custodialMobile,/Assigned Areas|>Scanner|Scan Location QR/);\nfor (const label of ['Schedule','Messages','Events','Feedback']) assert.match(employeeHome,new RegExp(`>${label}<`));",
        'manager test Custodial page split',
    )
    return source


update('scripts/manager-open-auth-contract-tests.mjs', repair_manager_open)


def repair_native_manager_ui(source: str) -> str:
    source = replace_once(
        source,
        "const [eventsAdmin, messages, chatCss, mobileOverrides, nativeLayout, notifications, moxie, feedback, phoneAssignments, phoneAssignmentsJs, managerHtml, custodialHtml] = await Promise.all([",
        "const [eventsAdmin, messages, chatCss, mobileOverrides, nativeLayout, notifications, moxie, feedback, phoneAssignments, phoneAssignmentsJs, managerHtml, custodialHtml, employeeHome, custodialBridge] = await Promise.all([",
        'native UI fixture list',
    )
    source = replace_once(
        source,
        "  readFile('mobile/src/custodial/index.html', 'utf8'),\n]);",
        "  readFile('mobile/src/custodial/index.html', 'utf8'),\n  readFile('employee-hub.html', 'utf8'),\n  readFile('mobile/src/custodial/bridge.js', 'utf8'),\n]);",
        'native UI employee fixtures',
    )
    source = replace_once(
        source,
        "assert.match(custodialHtml, /Assigned Areas/);\nassert.match(custodialHtml, /id=\"scan-location-qr\"[^>]*>Scan Location QR</);\nassert.match(custodialHtml, /id=\"scan-status\"[^>]*aria-live=\"polite\"/);\nassert.match(custodialHtml, /NFC is always ready/);\nassert.doesNotMatch(custodialHtml, />Scanner</);",
        "assert.match(custodialHtml, /Custodial Phone Setup/);\nassert.match(custodialHtml, /manager-assisted enrollment and recovery only/);\nassert.doesNotMatch(custodialHtml, /Assigned Areas|Scan Location QR|NFC is always ready|>Scanner</);\nfor (const label of ['Schedule','Messages','Events','Feedback']) assert.match(employeeHome,new RegExp(`>${label}<`));\nassert.match(custodialBridge, /handleNfcIntent|nfc|location_code/i);\nassert.doesNotMatch(custodialBridge, /barcode-scanner|BarcodeScanner/);",
        'native UI current Custodial split',
    )
    return source


update('scripts/native-manager-ui-regression-tests.mjs', repair_native_manager_ui)


def repair_operational_insights(source: str) -> str:
    source = replace_once(
        source,
        "const custodialClient = read('mobile/src/custodial/app.js');",
        "const custodialClient = read('mobile/src/custodial/app.js');\nconst custodialBridge = read('mobile/src/custodial/bridge.js');\nconst employeeHome = read('employee-hub.html');\nconst employeeSchedule = read('employee-schedule.html');",
        'operational current employee fixtures',
    )
    source = replace_once(
        source,
        "assert.match(custodialPage, /Assigned Areas/);\nassert.match(custodialPage, /You choose the practical cleaning order/);\nassert.doesNotMatch(custodialPage, />\\s*Scanner\\s*</i);\nassert.match(custodialClient, /handleNfcIntent|NFC|location_code/i);\nassert.doesNotMatch(custodialClient, /current assignment|next assignment/i);",
        "assert.match(custodialPage, /Custodial Phone Setup/);\nassert.match(custodialPage, /manager-assisted enrollment and recovery only/);\nassert.doesNotMatch(custodialPage, /Assigned Areas|You choose the practical cleaning order|>\\s*Scanner\\s*</i);\nassert.equal((employeeHome.match(/class=\"home-button\"/g)||[]).length,4);\nassert.doesNotMatch(employeeHome,/Assigned Areas|device[_ -]?id/i);\nassert.match(employeeSchedule,/Your areas now/);\nassert.match(custodialBridge, /handleNfcIntent|NFC|location_code/i);\nassert.doesNotMatch(custodialClient, /current assignment|next assignment/i);",
        'operational current employee intent',
    )
    return source


update('scripts/operational-insights-contract-tests.mjs', repair_operational_insights)


# Update the scan unit harness and the intentionally shorter novice copy.
def repair_scan_default_test(source: str) -> str:
    source = replace_once(
        source,
        "    body: { style: { setProperty() {} } },",
        "    body: { style: { setProperty() {} }, classList: { add() {}, remove() {} } },",
        'scan harness body class list',
    )
    source = source.replace('Select Employee Name', 'Select Employee')
    source = replace_once(
        source,
        "assert.match(appNode.innerHTML, /Manager\\/shared device: select the employee name\\./);",
        "assert.doesNotMatch(appNode.innerHTML, /Manager\\/shared device|assigned to this kiosk|device:/i);\nassert.match(appNode.innerHTML, />Start Cleaning</);",
        'unassigned scan novice language',
    )
    return source


update('scripts/scan-device-employee-default-tests.mjs', repair_scan_default_test)


update('scripts/scheduler-alerts-gps-foundation-tests.mjs', lambda source: replace_once(
    source,
    "assert.match(schedule, /This phone has no verified device identity/);",
    "assert.match(schedule, /This phone needs a manager\\./);",
    'employee-safe schedule identity copy',
))


update('scripts/static-browser-security-contract-tests.mjs', lambda source: replace_once(
    source,
    '  assert.match(source, /<meta name="referrer" content="no-referrer">/i, `${file} is missing its referrer policy`);',
    '  assert.match(source, /<meta name="referrer" content="no-referrer"\\s*\\/?>/i, `${file} is missing its referrer policy`);',
    'self-closing referrer policy contract',
))


# Regenerate the committed Messenger bundle and coordinated frontend hashes only
# after all source and contract repairs are present.
subprocess.run(['npm', 'run', '--silent', 'build:chatscope'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)

Path(__file__).unlink()
print('Applied source-complete Custodial v23 audit repairs.')
