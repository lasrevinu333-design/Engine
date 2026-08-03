#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../employee-hub.html', import.meta.url), 'utf8');
const reminders = await readFile(new URL('../memphis-device-reminders.js', import.meta.url), 'utf8');
const routes = await readFile(new URL('../mobile/src/shell/roles/custodial/routes.ts', import.meta.url), 'utf8');

for (const label of ['Schedule', 'Messages', 'Events', 'Feedback']) {
  assert.match(home, new RegExp(`>${label}<`), `home must include ${label}`);
}
for (const forbidden of [
  'KIOSK ID', 'Remove Enrollment', 'Enrolled Device', 'Scan NFC Tag',
  'QR', 'Refresh', 'Today’s Assigned Areas', 'Today Assigned Areas',
]) {
  assert.ok(!home.includes(forbidden), `employee home must not expose ${forbidden}`);
}
assert.match(home, /dashboard-bg_optimized\.webp/, 'stone-path background must remain');
assert.match(home, /memphis-scan-sync\.js/, 'ambient NFC bridge must load on home');
assert.match(home, /memphis-device-reminders\.js/, 'persistent reminders must load on home');
assert.ok(!home.includes('bottom-nav'), 'employee home must not use bottom navigation');
assert.match(routes, /homeRouteId:\s*'custodial\.today'/);
assert.match(routes, /legacyTarget:\s*'\.\/employee-hub\.html/);

assert.match(reminders, /RINGTONE_REPEAT_COUNT:\s*2/);
assert.match(reminders, /VOICE_REPEAT_COUNT:\s*2/);
assert.match(reminders, /for \(let cycle = 0; cycle < cycles; cycle \+= 1\)/);
assert.match(reminders, /you received a message from \$\{senderName\}/);
assert.match(reminders, /you received a message from Memphis/);
assert.match(reminders, /\$\{locationName\} is due soon\./);
assert.match(reminders, /\$\{locationName\} is overdue\./);
assert.match(reminders, /persistent card remains[\s\S]*Open or Dismiss/);
assert.match(reminders, /acknowledgeAlert\(alert, 'displayed'\)/);
assert.match(reminders, /acknowledgeAlert\(alert, 'dismissed'\)/);
assert.match(reminders, /acknowledgeAlert\(alert, 'opened'\)/);

console.log('custodial simple v23 contracts: PASS');
