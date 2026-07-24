import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [config, bridge] = await Promise.all([
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8'),
]);

assert.match(config, /const custodialPlugins = \[[^\]]*'@capacitor-firebase\/messaging'/);
assert.match(config, /viewer \? undefined : \{ ios:/);
assert.match(config, /viewer \? \{\} : \{ FirebaseMessaging:/);
assert.match(bridge, /\/employee-notifications-api\/register/);
assert.match(bridge, /\/employee-notifications-api\/opened/);
assert.match(bridge, /id: 'employee-events'/);
assert.match(bridge, /file === 'events\.html'/);
assert.match(bridge, /notificationActionPerformed/);
assert.match(bridge, /notification_key/);
assert.match(bridge, /endEnrollment/);
assert.match(bridge, /clearCredentialCache/);
assert.match(bridge, /\/device-auth\/logout/);
assert.match(bridge, /requestPermission/);
assert.doesNotMatch(bridge, /requestEnvelope\(['"]\/messaging-api\/[^'"]*event|requestEnvelope\(['"]\/events-api\/[^'"]*message/i);

console.log('Batch 1 employee notification client contracts passed.');
