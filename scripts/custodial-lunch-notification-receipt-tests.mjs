import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  NATIVE_NOTIFICATION_RECEIPT_SCHEMA,
  createNativeNotificationReceipt,
  nativeNotificationReceiptRequest,
  normalizeNativeNotificationReceipt,
} from '../mobile/src/custodial/notification-receipts.js';

const DEVICE = 'KIOSK_08';
const KEY = 'lunch:2026-09-22:loan-a:helper-b:start';
const data = { kind: 'employee_lunch_coverage', notification_key: KEY };

const displayed = createNativeNotificationReceipt({
  data,
  action: 'displayed',
  deviceId: DEVICE,
  createdAt: '2026-09-22T09:00:00.000Z',
});
assert.equal(displayed.schema_version, NATIVE_NOTIFICATION_RECEIPT_SCHEMA);
assert.equal(displayed.notification_type, 'lunch_coverage');
assert.equal(displayed.action, 'displayed');
assert.equal(displayed.id, `employee_lunch_coverage:displayed:${KEY}`);
assert.equal(displayed.device_id, DEVICE);

const opened = createNativeNotificationReceipt({ data, action: 'opened', deviceId: DEVICE });
assert.equal(opened.notification_type, 'lunch_coverage');
assert.notEqual(opened.id, displayed.id, 'displayed and opened receipts must remain independently idempotent');

const request = nativeNotificationReceiptRequest(displayed);
assert.deepEqual(request, {
  path: '/messaging-api/device-notifications/ack',
  headers: { 'Idempotency-Key': displayed.id },
  body: {
    device_id: DEVICE,
    notification_key: KEY,
    notification_type: 'lunch_coverage',
    action: 'displayed',
    metadata: { source: 'native_notification_received', kind: 'employee_lunch_coverage' },
  },
});

const legacy = normalizeNativeNotificationReceipt({
  schema_version: 'native-notification-outbox.v1',
  id: 'employee_location_status:legacy',
  kind: 'employee_location_status',
  notification_key: 'legacy',
  device_id: 'kiosk_08',
  created_at: '2026-09-21T10:00:00.000Z',
  attempts: 2,
});
assert.equal(legacy.notification_type, 'location_status');
assert.equal(legacy.action, 'opened');
assert.equal(legacy.device_id, DEVICE);
assert.equal(createNativeNotificationReceipt({ data: { kind: 'employee_event', notification_key: 'x' }, action: 'opened', deviceId: DEVICE }), null);
assert.equal(createNativeNotificationReceipt({ data, action: 'acknowledged', deviceId: DEVICE }), null);

const bridge = await readFile(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8');
assert.match(bridge, /employee_lunch_coverage/);
assert.match(bridge, /employee-lunch-coverage/);
assert.doesNotMatch(bridge, /persistDisplayedNotification/);
assert.match(bridge, /presentForegroundNotification\(event\)\.then\(async \(\) => \{/);
assert.match(bridge, /await persistDeviceNotificationReceipt\(data, 'displayed'\)/);
assert.match(bridge, /persistDeviceNotificationReceipt\(data, 'opened'\)/);
assert.match(bridge, /nativeNotificationReceiptRequest\(row\)/);
assert.match(bridge, /notificationReceived', \(event\)/);
assert.doesNotMatch(bridge, /employee_lunch_coverage[^\n]{0,200}acknowledged/);

console.log('Custodial lunch notification receipt tests passed.');
