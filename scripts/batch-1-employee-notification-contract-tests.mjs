import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [config, bridge, reminders, messages, scheduler] = await Promise.all([
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8'),
  readFile(new URL('../memphis-device-reminders.js', import.meta.url), 'utf8'),
  readFile(new URL('../messages.html', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/notification-schedule.js', import.meta.url), 'utf8'),
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
for (const route of ['events.html', 'employee-events.html', 'messages.html', 'employee-schedule.html', 'employee-feedback.html']) {
  assert.ok(bridge.includes(`'${route}'`), `missing safe native employee route ${route}`);
}
assert.match(bridge, /notificationActionPerformed/);
assert.match(bridge, /createPrincipalNotificationScheduler/);
assert.match(bridge, /plugin:LocalNotifications/);
assert.match(bridge, /await nativeNotificationScheduler\.present/);
assert.match(scheduler, /save\(row\);[\s\S]*await plugin\.schedule/);
assert.match(scheduler, /scope!==identity\(\).*await cancel\(row\);return false/);
assert.match(bridge, /localNotificationActionPerformed/);
assert.match(bridge, /notification_key/);
assert.match(bridge, /employee_location_status/);
assert.match(bridge, /get nativeNotifications\(\) \{ return notificationPresentation.native; \}/);
assert.match(bridge, /createNotificationPresentationMode/);
assert.match(reminders, /memphis:notification-mode-changed/);
assert.match(bridge, /memphis:native-notification-received/);
assert.doesNotMatch(bridge, /requestEnvelope\(['"]\/messaging-api\/[^'"]*event|requestEnvelope\(['"]\/events-api\/[^'"]*message/i);
assert.equal((messages.match(/memphis-device-reminders\.js/g) || []).length, 1);
assert.match(reminders, /function isEmployeeNotificationContext\(\)/);
assert.match(reminders, /if \(!isEmployeeNotificationContext\(\)\) return;/);
assert.match(reminders, /if \(!alreadyPresented\) fullyKioskNudge\(alert\);/);

console.log('Batch 1 employee notification client contracts passed.');
