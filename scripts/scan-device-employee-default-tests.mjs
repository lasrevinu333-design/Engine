import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)\n\s*<\/script>/);
assert.ok(scriptMatch, 'scan page inline script should be extractable');
let script = scriptMatch[1];
const startupInvocation = /\n\s*guardedStart\(\)\.catch\(\(err\)=>\{console\.error\(err\);renderMessageCard\("title-red","Could Not Open","",employeeActionError\(err,"open"\)\);updateDebugPanel\(\)\}\);/;
assert.match(script, startupInvocation, 'scan page startup invocation should be isolated by the unit harness');
script = script.replace(startupInvocation, '\n    // guardedStart() disabled for unit harness');
assert.doesNotMatch(script, startupInvocation, 'scan page startup must not execute inside the unit harness');
const attestationSeed = 'currentScanEntryAttestation=null';
assert.match(script, new RegExp(attestationSeed), 'assigned employee fixture must locate the scan attestation state');
script = script.replace(
  attestationSeed,
  'currentScanEntryAttestation={entry_id:"00000000-0000-4000-8000-000000000001",entry_source:"native-nfc"}'
);

const appNode = { innerHTML: '' };
const syncNode = { textContent: '', addEventListener() {} };
const debugNode = { innerHTML: '' };
const formNode = { addEventListener() {} };
const storage = new Map();
const locationState = {
  href: 'https://example.test/Engine/index.html?device=kiosk_02&code=AQUARIUM',
  search: '?device=kiosk_02&code=AQUARIUM',
  pathname: '/Engine/index.html',
  hostname: 'example.test'
};

const context = {
  console,
  URL,
  URLSearchParams,
  setInterval() {},
  setTimeout(fn) { return fn(); },
  navigator: { onLine: true },
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    key: (index) => Array.from(storage.keys())[index] || null,
    get length() { return storage.size; }
  },
  sessionStorage: {
    getItem: () => null,
    setItem() {}
  },
  location: locationState,
  window: {
    location: locationState,
    history: {
      replaceState(_state, _title, url) {
        locationState.href = `https://example.test${url}`;
        locationState.search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
      }
    },
    addEventListener() {}
  },
  document: {
    body: { style: { setProperty() {} } },
    getElementById(id) {
      if (id === 'app') return appNode;
      if (id === 'sync-badge') return syncNode;
      if (id === 'debug-panel') return debugNode;
      if (id === 'start-form') return formNode;
      return { addEventListener() {}, innerHTML: '', textContent: '' };
    }
  },
  fetch: async (_url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : {};
    if (body.fn === 'tool_list_active_employees') {
      return { ok: true, json: async () => ({ ok: true, data: [
        { display_name: 'Alijah Collins' },
        { display_name: 'Tammy Miller' },
        { display_name: 'Kinnaye Peete' },
        { display_name: 'Example Person - Example Title' }
      ] }) };
    }
    throw new Error(`unexpected fetch in test: ${body.fn || _url}`);
  }
};
context.window.window = context.window;
context.window.document = context.document;
context.window.localStorage = context.localStorage;
context.window.sessionStorage = context.sessionStorage;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(script, context, { filename: 'index.html' });

assert.equal(context.normalizeDeviceIdentifier('kiosk_02'), 'KIOSK_02');
assert.equal(context.normalizeDeviceIdentifier('kiosk-5'), 'KIOSK_05');
assert.equal(context.normalizeDeviceIdentifier('KIOSK_10'), 'KIOSK_10');
assert.equal(context.normalizeDeviceIdentifier('1e74fe4c-dc20b3b9'), '1e74fe4c-dc20b3b9');
assert.equal(context.normalizeScanLocationCode('TETON'), 'TETX');
assert.equal(context.normalizeScanLocationCode('teton_rr'), 'TETM');
assert.equal(context.normalizeScanLocationCode('TETON_MENS_RESTROOM'), 'TETM');
assert.equal(context.normalizeScanLocationCode('AQUARIUM'), 'AQUARIUM');
assert.equal(context.scanEmployeeNameOnly('Example Person - Example Title'), 'Example Person');
assert.equal(context.scanEmployeeNameOnly('Second Example – Another Title'), 'Second Example');
assert.equal(context.scanEmployeeNameOnly('Kinnaye Peete'), 'Kinnaye Peete');
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_01'), false);
assert.equal(context.isReadonlyScanEmployeeDevice('kiosk_02'), true);
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_09'), true);
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_10'), true);
assert.equal(context.isReadonlyScanEmployeeDevice('KIOSK_11'), false);

locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=kiosk_01';
locationState.search = '?code=AQUARIUM&device=kiosk_01';
storage.clear();
assert.equal(context.resolveDeviceId(), 'KIOSK_01', 'startup should resolve and normalize the explicit scan device before lock/init work');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_01');
assert.equal(storage.get('memphisAssignedDeviceId'), 'KIOSK_01');

locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=KIOSK_05';
locationState.search = '?code=AQUARIUM&device=KIOSK_05';
context.window.fully = { getDeviceName: () => 'kiosk_05', getDeviceId: () => '9df6e8a3-9df6e8a3' };
context.fully = context.window.fully;
assert.equal(context.shouldUseKioskLockScreen(), false, 'NFC scan URLs must not auto-cover the scan workflow with the mock lock overlay');
assert.equal(context.shouldUseKioskLockScreen({ allowScanIntentWakeLock: true }), false, 'screen-off/wake prewarm must not re-cover physical scan URLs with the Scan App mock lock overlay');
locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=KIOSK_05&lock=1';
locationState.search = '?code=AQUARIUM&device=KIOSK_05&lock=1';
assert.equal(context.shouldUseKioskLockScreen(), false, 'physical scan URLs must ignore lock=1 so a bad/stale NFC tag cannot cover the scan workflow');
locationState.href = 'https://example.test/Engine/index.html?device=KIOSK_05&lock=1';
locationState.search = '?device=KIOSK_05&lock=1';
assert.equal(context.shouldUseKioskLockScreen(), true, 'explicit lock=1 can still force the scan-page overlay only when no real scan code/session is present');
locationState.href = 'https://example.test/Engine/index.html?code=AQUARIUM&device=KIOSK_05&lock=0';
locationState.search = '?code=AQUARIUM&device=KIOSK_05&lock=0';
assert.equal(context.shouldUseKioskLockScreen(), false, 'explicit lock=0 should still suppress the scan-page overlay');
delete context.window.fully;
delete context.fully;
locationState.href = 'https://example.test/Engine/index.html?device=kiosk_02&code=AQUARIUM';
locationState.search = '?device=kiosk_02&code=AQUARIUM';

const resolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(resolvedDevice, 'KIOSK_02');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_02');
assert.equal(storage.get('mz_employee_hub_device_id'), 'KIOSK_02');
assert.equal(storage.get('memphisAssignedDeviceId'), 'KIOSK_02');
assert.match(locationState.search, /device=KIOSK_02/);

storage.clear();
locationState.href = 'https://lasrevinu333-design.github.io/Engine/?code=TETM&device=';
locationState.search = '?code=TETM&device=';
locationState.pathname = '/Engine/';
locationState.hostname = 'lasrevinu333-design.github.io';
const fullyStub = { getDeviceId: () => '9df6e8a3-9df6e8a3', getDeviceName: () => 'kiosk_05' };
context.window.fully = fullyStub;
context.fully = fullyStub;
storage.set('mz_scan_device_id', 'KIOSK_01');
const blankDeviceScanResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(blankDeviceScanResolvedDevice, 'KIOSK_05');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_05');
assert.match(locationState.search, /device=KIOSK_05/);
assert.doesNotMatch(locationState.search, /device=(?:&|$)/);

delete context.window.fully;
delete context.fully;
locationState.hostname = 'example.test';
locationState.pathname = '/Engine/index.html';

locationState.href = 'https://example.test/Engine/index.html?code=TETON_MENS_RESTROOM';
locationState.search = '?code=TETON_MENS_RESTROOM';
storage.clear();
storage.set('mz_scan_device_id', 'KIOSK_05');
const storedScanResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(storedScanResolvedDevice, 'KIOSK_05');
assert.match(locationState.search, /device=KIOSK_05/);

locationState.href = 'https://example.test/Engine/index.html?code=TETON_MENS_RESTROOM';
locationState.search = '?code=TETON_MENS_RESTROOM';
storage.clear();
context.window.fully = { getDeviceName: () => 'kiosk_05', getDeviceId: () => '9df6e8a3-9df6e8a3' };
context.fully = context.window.fully;
const fullyNameResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(fullyNameResolvedDevice, 'KIOSK_05');
assert.equal(storage.get('mz_scan_device_id'), 'KIOSK_05');
assert.match(locationState.search, /device=KIOSK_05/);

delete context.window.fully;
delete context.fully;
locationState.href = 'https://example.test/Engine/index.html?code=TETON_MENS_RESTROOM';
locationState.search = '?code=TETON_MENS_RESTROOM';
storage.clear();
storage.set('memphisAssignedDeviceId', 'device-random-stale');
const blankScanResolvedDevice = await context.ensureDeviceIdInUrl();
assert.equal(blankScanResolvedDevice, '');
assert.doesNotMatch(locationState.search, /device=/);

assert.match(html, /\.scanEmployeeDisplay\{[^}]*text-align:center/, 'assigned scan employee display should be centered by CSS');
assert.match(
  html,
  /@media \(max-width:640px\)\{html\{font-size:(1[6-8])px\}/,
  'phone scan viewport should use a compact mobile font size instead of scaling larger than desktop'
);

for (let kioskNumber = 2; kioskNumber <= 10; kioskNumber += 1) {
  const kioskId = `KIOSK_${String(kioskNumber).padStart(2, '0')}`;
  const assignedName = `Assigned Employee ${kioskNumber}`;
  await context.renderEmployeeSelect({
    location_code: 'AQUARIUM',
    location_name: 'Aquarium Restrooms',
    assigned_device_employee_name: assignedName
  }, kioskId);
  assert.ok(
    appNode.innerHTML.includes(`<div class="location">Aquarium Restrooms</div><div class="employeeLine scanEmployeeDisplay">${assignedName}</div>`),
    `${kioskId} should center the assigned employee name directly below the location`
  );
  assert.ok(
    appNode.innerHTML.includes(`<input type="hidden" name="employee" value="${assignedName}" />`),
    `${kioskId} should preserve scan submit through a hidden employee field`
  );
  assert.doesNotMatch(appNode.innerHTML, /<select name="employee"/, `${kioskId} assigned scan page should not render an employee dropdown`);
  assert.doesNotMatch(appNode.innerHTML, /selected disabled>Select Employee Name/);
}

await context.renderEmployeeSelect({
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms',
  assigned_device_employee_name: 'Example Person - Example Title'
}, 'KIOSK_03');
assert.ok(
  appNode.innerHTML.includes('<div class="location">Aquarium Restrooms</div><div class="employeeLine scanEmployeeDisplay">Example Person</div>'),
  'staff scan page should display only the employee name when the assigned-device label includes a title'
);
assert.ok(
  appNode.innerHTML.includes('<input type="hidden" name="employee" value="Example Person" />'),
  'staff scan submit should pass only the employee name, not the display title'
);
assert.doesNotMatch(appNode.innerHTML, /Example Title/, 'scan page must not show or submit title text');

await context.renderEmployeeSelect({
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms',
  assigned_device_employee_name: 'Manager Should Not Be Locked'
}, 'KIOSK_01');
assert.match(appNode.innerHTML, /<select name="employee" required>/, 'KIOSK_01 should keep the employee dropdown for manager/control use');
assert.match(appNode.innerHTML, /<option value="" selected disabled>Select Employee Name<\/option>/, 'KIOSK_01 should keep no employee preselected');
assert.doesNotMatch(appNode.innerHTML, /Example Title/, 'manager/control scan dropdown should also strip titles from employee choices');
assert.doesNotMatch(appNode.innerHTML, /scanEmployeeDisplay/, 'KIOSK_01 should not render the read-only assigned employee display');
assert.doesNotMatch(appNode.innerHTML, /<input type="hidden" name="employee"/, 'KIOSK_01 should not submit a hidden preselected employee');

await context.renderEmployeeSelect({
  location_code: 'AQUARIUM',
  location_name: 'Aquarium Restrooms'
}, 'unassigned-phone');
assert.match(appNode.innerHTML, /<option value="" selected disabled>Select Employee Name<\/option>/);
assert.match(appNode.innerHTML, /Choose the employee\./);
assert.doesNotMatch(appNode.innerHTML, /Manager\/shared device|device id|technical/i);

console.log('scan-device-employee-default-tests passed');
