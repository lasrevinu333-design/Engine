import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [config, bridge] = await Promise.all([
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8'),
]);

assert.match(config, /const custodialPlugins = \[[^\]]*'@capacitor-firebase\/messaging'[^\]]*'@capacitor\/local-notifications'/);
assert.doesNotMatch(config, /@capacitor\/barcode-scanner/);
assert.match(config, /\.\.\.\(custodial \? \{\} : \{\s*ios:/);
assert.match(config, /viewer \? \{\} : \{ FirebaseMessaging:/);
assert.match(bridge, /\/employee-notifications-api\/register/);
assert.match(bridge, /\/employee-notifications-api\/opened/);
for (const channel of ['employee-events', 'employee-messages', 'employee-due-soon', 'employee-overdue']) {
  assert.ok(bridge.includes(`'${channel}'`), `missing native employee channel ${channel}`);
}
for (const route of ['events.html', 'messages.html', 'employee-schedule.html']) {
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
