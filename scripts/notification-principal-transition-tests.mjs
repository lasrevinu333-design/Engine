import assert from 'node:assert/strict';
import {fixture,principal,data,turn} from './native-notification-arrival-boundary-tests.mjs';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {NATIVE_NOTIFICATION_RECEIPT_SCHEMA} from '../mobile/src/custodial/notification-receipts.js';
const actions=f=>[...f.memory.values()].map(JSON.parse).filter(r=>r.schema_version===NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(r=>r.action);
let checks=0;const lane=process.env.NOTIFICATION_TRANSITION;
for(const version of [1,2]){
 const a=version===1?principal:{schema_version:'custodial-protected-principal.v2',device_id:principal.device_id,
  employee_id:principal.employee_id,credential_id:principal.credential_id,assignment_epoch:7,
  activation_operation_id:principal.credential_operation_id,activation_receipt_sha256:'a'.repeat(64),
  legacy_binding_id:'00000000-0000-4000-8000-000000000005',legacy_binding_kind:'authenticated_legacy_installation_observation',
  installation_binding_sha256:'b'.repeat(64),installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at};
 const b={...a,installation_seal:'different-installation-seal-0002',enrolled_at:'2026-08-01T12:00:00.000Z'};
 assert.notEqual(principalIdentity(a),principalIdentity(b));
 if(!lane||lane==='provider'){
  for(const restart of [false,true]){
   let f=await fixture({initialPrincipal:a});
   await f.emit('firebase','notificationReceived',{notification:{data:{...data,route:'employee-schedule.html'}}});
   if(restart)f=await fixture({initialPrincipal:b,memory:new Map(f.memory)});else f.setPrincipal(b);
   const effectCount=f.effects.length;
   await f.emit('firebase','notificationActionPerformed',{actionId:'tap',notification:{data:{...data,route:'employee-schedule.html'}}});
   assert.equal(actions(f).includes('opened'),false,`v${version} unscoped provider action cannot adopt current principal`);
   assert.equal(f.effects.slice(effectCount).some(x=>x.startsWith('route:')),false);checks+=2;
  }
 }
 if(!lane||lane==='schedule'){
  const f=await fixture({initialPrincipal:a});let release;f.holdSchedule(new Promise(resolve=>{release=resolve;}));
  await f.emit('firebase','notificationReceived',{notification:{data}});f.setPrincipal(b);release();await turn();await turn();
  assert.equal(f.scheduled.length,0,`v${version} schedule completing after transition must be cancelled`);
  assert.equal(actions(f).includes('displayed'),false);checks+=2;
 }
 if(!lane||lane==='browser'){
  const f=await fixture({initialPrincipal:a,display:'denied'}),ui=f.fullBrowser();
  ui.setHref('https://localhost/messages.html?hub=employee&device=KIOSK_08');
  await f.emit('firebase','notificationReceived',{notification:{data}});const card=ui.card;
  f.setPrincipal(b);await turn();
  assert.equal(ui.active,false,`v${version} stale browser card must retire on principal transition`);
  const open=card.querySelector('.mz-reminder-open').listeners.click();await turn();await ui.finishTimers();await open;
  assert.match(ui.href,/\/messages\.html/);assert.equal(actions(f).includes('opened'),false);checks+=3;
  await f.emit('firebase','notificationReceived',{notification:{title:'B exact card',data}});
  const current=ui.card;assert.ok(current);checks++;
  await card.querySelector('.mz-reminder-dismiss').listeners.click();
  assert.equal(ui.card,current,'retired A callback must not dismiss B card');checks++;
  await current.querySelector('.mz-reminder-dismiss').listeners.click();
  assert.equal(ui.active,false);assert.equal(actions(f).includes('dismissed'),false);checks+=2;
  for(const phase of ['receipt-await','audio-await']){
   const g=await fixture({initialPrincipal:a,display:'denied'}),view=g.fullBrowser();
   view.setHref('https://localhost/messages.html?hub=employee&device=KIOSK_08');
   await g.emit('firebase','notificationReceived',{notification:{data}});
   let release;
   if(phase==='receipt-await')g.holdNextMutation(new Promise(resolve=>{release=resolve;}));
   const pending=view.card.querySelector('.mz-reminder-open').listeners.click();await turn();
   g.setPrincipal(b);if(release)release();await turn();await view.finishTimers();await pending;
   assert.equal(view.active,false);assert.match(view.href,/\/messages\.html/);checks+=2;
   if(phase==='receipt-await'){assert.equal(actions(g).includes('opened'),false);checks++;}
  }
 }
}
console.log(JSON.stringify({ok:true,checks,scope:'A1 full-principal provider action, native schedule and browser transition',physical:false}));
