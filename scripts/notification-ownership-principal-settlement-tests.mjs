import assert from 'node:assert/strict';
import {fixture,principal,data,turn} from './native-notification-arrival-boundary-tests.mjs';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {NATIVE_NOTIFICATION_RECEIPT_SCHEMA} from '../mobile/src/custodial/notification-receipts.js';
import {createNotificationPresenter} from '../mobile/src/custodial/notification-presentation.js';
const actions=f=>[...f.memory.values()].map(JSON.parse).filter(r=>r.schema_version===NATIVE_NOTIFICATION_RECEIPT_SCHEMA).map(r=>r.action);
let checks=0;
const lane=process.env.NOTIFICATION_CHALLENGE;
if(!lane||lane==='principal'){
 for(const version of [1,2])for(const completed of [false,true]){
  const a=version===1?principal:{schema_version:'custodial-protected-principal.v2',device_id:principal.device_id,
   employee_id:principal.employee_id,credential_id:principal.credential_id,assignment_epoch:7,
   activation_operation_id:principal.credential_operation_id,activation_receipt_sha256:'a'.repeat(64),
   legacy_binding_id:'00000000-0000-4000-8000-000000000005',legacy_binding_kind:'authenticated_legacy_installation_observation',
   installation_binding_sha256:'b'.repeat(64),installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at};
  const b={...a,installation_seal:'different-installation-seal-0002',enrolled_at:'2026-08-01T12:00:00.000Z'};
  assert.notEqual(principalIdentity(a),principalIdentity(b));
  const f=await fixture({display:'denied',initialPrincipal:a});
  if(completed)f.fullBrowser();
  await f.emit('firebase','notificationReceived',{notification:{title:'A exact title',body:'A body',data}});
  const before=[...f.memory];
  const g=await fixture({display:'denied',initialPrincipal:b,memory:new Map(before)}),ui=g.fullBrowser();
  await ui.poll();await turn();assert.equal(ui.presented,0,`v${version} foreign principal must not restore A payload`);
  for(const [key,value] of before.filter(([key])=>key.startsWith('receipt:presentation:')))
   assert.equal(g.memory.get(key),value,'old protected presentation records preserved unchanged');
  await g.emit('firebase','notificationReceived',{notification:{title:'B exact title',body:'B body',data}});
  assert.equal(ui.presented,1,'A completed or pending ownership cannot suppress B exact arrival');
  assert.equal(ui.card.querySelector('.mz-reminder-title').textContent,'B exact title');checks+=4;
 }
 const old={schema_version:'native-notification-presentation.v1',scope:JSON.stringify([
  principal.device_id,principal.credential_id,principal.employee_id,principal.assignment_epoch]),key:data.notification_key,
  event:{notification:{title:'Old reduced scope',data}},owner:null,receiptRecorded:false};
 const legacyMemory=new Map([['receipt:presentation:old-v1',JSON.stringify(old)]]);
 const legacy=await fixture({display:'denied',memory:legacyMemory}),legacyUi=legacy.fullBrowser();
 await legacyUi.poll();assert.equal(legacyUi.presented,0);assert.equal(legacyMemory.get('receipt:presentation:old-v1'),JSON.stringify(old));checks+=2;
 const native=await fixture();await native.emit('firebase','notificationReceived',{notification:{data}});
 const shown=native.scheduled[0].notifications[0];assert.equal(shown.extra.native_presentation_principal,principalIdentity(principal));
 native.setPrincipal({...principal,installation_seal:'different-installation-seal-0002'});
 await native.emit('local','localNotificationActionPerformed',{actionId:'acknowledge',notification:shown});
 assert.equal(actions(native).includes('acknowledged'),false);checks+=2;
 console.log('PASS full V1/V2 principal separation');
}
if(!lane||lane==='poll'){
 for(const kind of ['employee_location_status','employee_lunch_coverage'])for(const closedFirst of [false,true]){
  const f=await fixture({display:'denied'}),key=`poll:${kind}:${closedFirst}`;
  const ui=f.fullBrowser({rows:[{notification_key:key,location_code:'Aquarium',status_code:'due_soon'}]});
  await ui.poll();assert.equal(ui.presented,1);const old=ui.card;
  if(closedFirst)await old.querySelector('.mz-reminder-dismiss').listeners.click();
  const incoming={notification:{title:'Exact accepted title',body:'Exact accepted body',data:{...data,kind,notification_key:key}}};
  await f.emit('firebase','notificationReceived',incoming);
  if(!closedFirst){
   assert.equal(actions(f).includes('displayed'),false,'bare poll card cannot count as exact protected display');
   assert.equal(ui.card,old,'unverifiable existing poll owner is not relabelled');
   await old.querySelector('.mz-reminder-dismiss').listeners.click();
  }
  await ui.finishTimers();await f.mobile.retryNotificationPresentation();await turn();
  assert.equal(ui.active,true,'accepted payload is presented after unrelated poll closes, even if same key is seen');
  assert.equal(ui.card.querySelector('.mz-reminder-title').textContent,incoming.notification.title);
  assert.equal(ui.card.querySelector('.mz-reminder-body').textContent,incoming.notification.body);
  assert.equal(f.scheduled.length,0);assert.equal(actions(f).filter(x=>x==='displayed').length,1);
  const legacyCount=ui.httpActions.length;
  await ui.card.querySelector('.mz-reminder-dismiss').listeners.click();await turn();
  assert.equal(ui.httpActions.length,legacyCount,'protected dismissal must stay local, never legacy HTTP');
  assert.equal(actions(f).includes('dismissed'),false);checks+=9;
 }
 console.log('PASS untyped poll/accepted ownership and dismissal');
 const original={notification:{title:'Exact title',body:'Exact body',data}};
 for(const change of [e=>e.notification.data.kind='employee_location_status',e=>e.notification.data.receipt_job_id='00000000-0000-4000-8000-000000000099',e=>e.notification.title='Other title',e=>e.notification.body='Other body']){
  const saved=[];const coordinator=createNotificationPresenter({identity:()=>principalIdentity(principal),nativeMode:()=>false,
   nativePresent:async()=>false,save:async e=>saved.push(structuredClone(e)),load:async()=>[],displayed:async()=>true,action:async()=>true});
  await coordinator.accept(original);const changed=structuredClone(original);change(changed);
  await assert.rejects(()=>coordinator.accept(changed),/Conflicting notification presentation binding/);
  assert.equal(saved.at(-1).event.notification.title,'Exact title');checks+=2;
 }
}
if(!lane||lane==='settlement'){
 for(const kind of ['explicit','token','online','resume','visibilitychange','network'])for(let depth=1;depth<=8;depth++){
  const f=await fixture();const before=f.registerCalls;let newer,triggered=false;
  f.onMode(state=>{if(state?.registered!==true||triggered)return;triggered=true;
   let job=()=>{if(kind==='explicit'){f.setDisplay('prompt');newer=f.mobile.ensurePushRegistration({requestPermission:true});}else f.trigger(kind);};
   for(let i=0;i<depth;i++){const next=job;job=()=>queueMicrotask(next);}job();
  });
  await f.mobile.ensurePushRegistration();await turn();await turn();if(newer)assert.equal((await newer).registered,true);
  assert.equal(triggered,true);assert.equal(f.registerCalls-before,2,`${kind} settlement depth ${depth} cannot strand generation`);
  assert.equal(f.mobile.nativeNotifications,true,`${kind} latest readiness must be truthful`);
  if(kind==='explicit')assert.equal(f.permissionRequests,1);checks+=3;
 }
 console.log('PASS actual callback registration settlement sweep');
}
console.log(JSON.stringify({ok:true,checks,physical:false,scope:'A1/A2/B1 changed inputs, actual bridge and full reminder'}));
