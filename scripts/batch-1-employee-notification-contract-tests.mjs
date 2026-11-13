import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {custodialNewProducerAdmissionsEnabled,requireCustodialNewProducerAdmission} from '../mobile/src/custodial/new-producer-scope.js';
import {createPrincipalNotificationScheduler} from '../mobile/src/custodial/notification-schedule.js';

const [config, bridge, reminders, messages, scheduler, eventReceipts] = await Promise.all([
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/bridge.js', import.meta.url), 'utf8'),
  readFile(new URL('../memphis-device-reminders.js', import.meta.url), 'utf8'),
  readFile(new URL('../messages.html', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/notification-schedule.js', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/custodial/event-notification-receipts.js', import.meta.url), 'utf8'),
]);

assert.match(config, /const custodialPlugins = \[[^\]]*'@capacitor-firebase\/messaging'[^\]]*'@capacitor\/local-notifications'/);
assert.doesNotMatch(config, /@capacitor\/barcode-scanner/);
assert.match(config, /\.\.\.\(custodial \? \{\} : \{\s*ios:/);
assert.match(config, /viewer \? \{\} : \{ FirebaseMessaging:/);
assert.match(bridge, /\/employee-notifications-api\/register/);
assert.match(eventReceipts, /path:'\/employee-notifications-api\/opened',method:'POST'/);
assert.match(bridge, /import \{ createEventNotificationOpenOutbox \} from '\.\/event-notification-receipts\.js'/);
assert.match(bridge, /const eventOpenOutbox=createEventNotificationOpenOutbox\(\{storage:localStorage,mutate:security\.mutateProtectedWork,/);
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
const presentBegin=scheduler.indexOf('present(notification,scope){return owned(async checkpoint=>{');
assert.ok(presentBegin>=0,'actual scheduler present owner');
const presentSource=scheduler.slice(presentBegin);
const orderedEffects=[
  'requireCustodialNewProducerAdmission();',
  'save(row,checkpoint);',
  'beginConfirmation(row,checkpoint);',
  'await plugin.schedule({notifications:[owned]});',
  "save({...row,state:'scheduled'},checkpoint);",
  'storage.removeItem(unconfirmedPrefix+row.id);',
];
let previous=-1;
for(const operation of orderedEffects){const at=presentSource.indexOf(operation);assert.ok(at>previous,'missing/reordered scheduler operation: '+operation);previous=at;}
assert.match(presentSource,/if\(unconfirmed\(row\)\)throw Error\('Notification schedule confirmation guard retirement failed\.'\)/);
assert.match(scheduler, /const current=\(notification,scope\)=>scope===identity\(\)&&isCurrent\(notification,scope\)===true/);
assert.match(scheduler, /!current\(owned,scope\)\)\{await cancel\(row,checkpoint\);checkpoint\(\);return false/);
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
assert.match(reminders, /if \(!alreadyPresented\|\|alert\.boundReceiptAction\?\.providerMirror===true\) fullyKioskNudge\(alert\);/);

if(custodialNewProducerAdmissionsEnabled()){
  await import('./notification-schedule-ownership-tests.mjs');
  await import('./notification-schedule-authority-tests.mjs');
  await import('./notification-browser-authority-tests.mjs');
  await import('./notification-schedule-cache-authority-tests.mjs');
}else{
  assert.throws(()=>requireCustodialNewProducerAdmission(),error=>error.code==='custodial_new_producer_scope_deferred');
  const memory=new Map(),effects=[];
  const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i]??null,
    getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
  const owner=createPrincipalNotificationScheduler({identity:()=>'explicit-synthetic-browser-scope',
    mutate:operation=>operation(),storage,prefix:'deferred-scope-fixture:',
    plugin:{getPending:async()=>({notifications:[]}),getDeliveredNotifications:async()=>({notifications:[]}),
      schedule:async()=>effects.push('schedule'),cancel:async()=>effects.push('cancel'),removeDeliveredNotifications:async()=>effects.push('remove')},
    isCurrent:()=>true});
  await assert.rejects(owner.present({title:'Synthetic new intent',extra:{notification_key:'new-deferred-fixture'}},'explicit-synthetic-browser-scope'),
    error=>error.code==='custodial_new_producer_scope_deferred');
  assert.equal(memory.size,0,'deferred new producer cannot persist intent');
  assert.deepEqual(effects,[],'deferred new producer cannot schedule/cancel/remove');
}
console.log('Batch 1 employee notification client contracts passed.');
