#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  home,
  setupHtml,
  setupJs,
  bridge,
  ui,
  messenger,
  routes,
  build,
] = await Promise.all([
  read('employee-hub.html'),
  read('mobile/src/custodial/index.html'),
  read('mobile/src/custodial/app.js'),
  read('mobile/src/custodial/bridge.js'),
  read('memphis-ui.js'),
  read('mobile/src/chatscope/app.jsx'),
  read('mobile/src/shell/roles/custodial/routes.ts'),
  read('mobile/scripts/build.mjs'),
]);

for (const label of ['Schedule', 'Messages', 'Events', 'Feedback']) {
  assert.match(home, new RegExp(`>${label}<`), `home must include ${label}`);
}
for (const forbidden of [
  'KIOSK ID', 'Remove Enrollment', 'Enrolled Device', 'Scan NFC Tag',
  'QR', 'Refresh', 'Assigned Areas', 'bottom-nav', 'appNav',
]) {
  assert.ok(!home.includes(forbidden), `employee home must not expose ${forbidden}`);
}
assert.match(home, /dashboard-bg_optimized\.webp/, 'stone-path background must remain');
assert.match(home, /memphis-device-reminders\.js/, 'employee notification UI must load on home');

assert.match(routes, /homeRouteId:\s*'custodial\.home'/);
assert.match(routes, /id:\s*'custodial\.home'[\s\S]*legacyTarget:\s*'\.\/employee-hub\.html\?hub=employee'/);
assert.match(routes, /id:\s*'custodial\.setup'[\s\S]*legacyTarget:\s*'\.\/index\.html\?setup=1'/);
assert.ok(!routes.includes('employee-home-simple.html'), 'duplicate prototype home must not be routed');
assert.match(build, /'employee-hub\.html'/, 'canonical employee home must be packaged');

for (const forbidden of [
  'Assigned Areas', 'Scan Location QR', 'Refresh Areas', 'Remove Enrollment',
  'NFC is always ready', 'employeeNav',
]) {
  assert.ok(!setupHtml.includes(forbidden), `protected setup must not expose ordinary employee control: ${forbidden}`);
}
assert.match(setupHtml, /manager-assisted enrollment and recovery only/i);
assert.match(setupJs, /location\.replace\(employeeHomeUrl\(\)\)/, 'enrolled setup must hand off to employee home');
assert.ok(!setupJs.includes('CapacitorBarcodeScanner'), 'employee APK setup must not include QR scanner code');
assert.ok(!setupJs.includes('removeEnrollment'), 'ordinary setup runtime must not expose enrollment removal');

assert.match(bridge, /import \{ App \} from '@capacitor\/app'/, 'shared bridge must own native app URL events');
assert.match(bridge, /App\.addListener\('appUrlOpen'/, 'shared bridge must listen for warm NFC/deep links');
assert.match(bridge, /App\.getLaunchUrl\(\)/, 'shared bridge must process cold-start NFC/deep links');
assert.match(bridge, /new URL\('\.\/scan\.html'/, 'native NFC must route to packaged scan runtime');
assert.match(bridge, /installNativeScanRouting\(\)/, 'native scan routing must install on every employee page');

assert.match(ui, /if \(session\) \{[\s\S]*new URL\("\.\/scan\.html"/, 'active cleaning wake must target scan.html');
assert.match(ui, /context === "employee" \? EMPLOYEE_HUB : OPS_HUB/, 'employee Back must use canonical employee home');
assert.match(messenger, /EMPLOYEE_CONTEXT \? '\.\/employee-hub\.html'/, 'Messenger Back must use employee home');
assert.match(messenger, /messageLoadSequence = useRef\(0\)/, 'Messenger must sequence recipient loads');
assert.match(messenger, /setMessages\(\[\]\);[\s\S]*setLoadingMessages\(true\);[\s\S]*setSelectedId\(id\)/, 'recipient switch must clear stale messages synchronously');

console.log('custodial simple v23 graph and native routing contracts: PASS');
