import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  NATIVE_NOTIFICATION_RECEIPT_SCHEMA,
  createNativeNotificationReceipt,
  nativeNotificationReceiptRequest,
  normalizeNativeNotificationReceipt,
  receiveNativeNotification,
} from '../mobile/src/custodial/notification-receipts.js';

const DEVICE = 'KIOSK_08';
const KEY = 'lunch:2026-09-22:loan-a:helper-b:start';
const data = { kind: 'employee_lunch_coverage', notification_key: KEY,
 receipt_job_id:'00000000-0000-4000-8000-000000000001',receipt_credential_id:'00000000-0000-4000-8000-000000000002',
 receipt_employee_id:'00000000-0000-4000-8000-000000000003',receipt_assignment_epoch:'7',receipt_device_id:DEVICE};

const displayed = createNativeNotificationReceipt({
  data,
  action: 'displayed',
  deviceId: DEVICE,
  createdAt: '2026-09-22T09:00:00.000Z',
});
assert.equal(displayed.schema_version, NATIVE_NOTIFICATION_RECEIPT_SCHEMA);
assert.equal(displayed.notification_type, 'lunch_coverage');
assert.equal(displayed.action, 'displayed');
assert.equal(displayed.id, `${data.receipt_job_id}:${data.receipt_credential_id}:7:employee_lunch_coverage:displayed:${KEY}`);
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
    receipt_binding:displayed.receipt_binding,
    metadata: { source: 'native_notification_displayed', kind: 'employee_lunch_coverage' },
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
assert.equal(legacy.legacy_unbound,true);
assert.equal(legacy.device_id,'kiosk_08','old saved identity is not relabelled');
assert.equal(nativeNotificationReceiptRequest(legacy),null,'unbound history cannot silently adopt a new credential');
assert.equal(createNativeNotificationReceipt({ data: { kind: 'employee_event', notification_key: 'x' }, action: 'opened', deviceId: DEVICE }), null);
for(const action of ['received','displayed','opened','acknowledged']){
 const row=createNativeNotificationReceipt({data,action,deviceId:DEVICE});
 assert.equal(row.action,action);assert.equal(nativeNotificationReceiptRequest(row).body.action,action);
 assert.equal(nativeNotificationReceiptRequest(row).body.metadata.source,`native_notification_${action}`);
}
assert.equal(createNativeNotificationReceipt({data,action:'dismissed',deviceId:DEVICE}),null,'native swipe has no observable producer; do not manufacture evidence');
const historicalDismissed={...opened,action:'dismissed',id:opened.id.replace(':opened:',':dismissed:')};
assert.equal(nativeNotificationReceiptRequest(historicalDismissed).body.action,'dismissed','existing exact-bound history remains readable');
for(const mutate of [d=>delete d.receipt_credential_id,d=>d.receipt_assignment_epoch='1.5',d=>d.receipt_device_id='KIOSK_03',d=>d.receipt_job_id='fake']){
 const invalid=structuredClone(data);mutate(invalid);
 assert.equal(createNativeNotificationReceipt({data:invalid,action:'received',deviceId:DEVICE}),null);
}
const phases=[];
await assert.rejects(()=>receiveNativeNotification({event:{notification:{data}},
 persist:async(_data,action)=>{phases.push(action);return true;},dispatch:()=>phases.push('dispatch'),
 flush:async()=>phases.push('flush'),shouldPresent:true,present:async()=>{throw new Error('presentation failed');}}),/presentation failed/);
assert.deepEqual(phases,['received','dispatch','flush'],'receipt survives presentation failure; no displayed/opened/acknowledged fabrication');
phases.length=0;
await receiveNativeNotification({event:{notification:{data}},persist:async(_data,action)=>{phases.push(action);return true;},
 dispatch:()=>phases.push('dispatch'),flush:async()=>phases.push('flush'),shouldPresent:true,present:async()=>phases.push('present')});
assert.deepEqual(phases,['received','dispatch','flush','present','displayed','flush']);

const bridge = await readFile(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8');
assert.match(bridge, /employee_lunch_coverage/);
assert.match(bridge, /employee-lunch-coverage/);
assert.doesNotMatch(bridge, /persistDisplayedNotification/);
assert.match(bridge, /receiveNativeNotification\(\{event,persist:\(data,action\)=>persistDeviceNotificationReceipt\(data,action,arrivalPrincipal\)/);
assert.match(bridge, /persistDeviceNotificationReceipt\(data, 'opened'\)/);
assert.match(bridge, /nativeNotificationReceiptRequest\(row\)/);
assert.match(bridge, /notificationReceived', \(event\)/);
assert.doesNotMatch(bridge, /employee_lunch_coverage[^\n]{0,200}acknowledged/);
assert.match(bridge,/handleNativeNotificationAction\(\{notification,actionId/);
assert.match(bridge,/getPrincipal:\(\)=>expectedPrincipal === currentPrincipalIdentity\(\)/);
assert.match(bridge,/data\.native_presentation_principal === expectedPrincipal/);
assert.match(bridge,/\? currentPrincipal\(\) : null,mutate:security\.mutateProtectedWork/);
assert.match(bridge,/notificationLifecycle: NATIVE_NOTIFICATION_LIFECYCLE/);

console.log('Custodial lunch notification receipt tests passed.');
