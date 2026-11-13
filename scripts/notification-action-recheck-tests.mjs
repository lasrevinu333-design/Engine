import assert from 'node:assert/strict';
import {fixture,principal,data,turn} from './native-notification-arrival-boundary-tests.mjs';
import {createPrincipalNotificationScheduler} from '../mobile/src/custodial/notification-schedule.js';
import {NATIVE_NOTIFICATION_RECEIPT_SCHEMA} from '../mobile/src/custodial/notification-receipts.js';

let checks=0;const failures=[];
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const probe=async(name,fn)=>{try{await fn();}catch(error){failures.push({name,error:error.message});}};
const receipts=f=>[...f.memory.values()].map(JSON.parse).filter(r=>r.schema_version===NATIVE_NOTIFICATION_RECEIPT_SCHEMA&&r.action==='opened');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const v2={schema_version:'custodial-protected-principal.v2',device_id:principal.device_id,
 employee_id:principal.employee_id,credential_id:principal.credential_id,assignment_epoch:7,
 activation_operation_id:principal.credential_operation_id,activation_receipt_sha256:'a'.repeat(64),
 legacy_binding_id:'00000000-0000-4000-8000-000000000005',legacy_binding_kind:'authenticated_legacy_installation_observation',
 installation_binding_sha256:'b'.repeat(64),installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at};

for(const [version,a] of [[1,principal],[2,v2]]){
 for(const [name,change] of Object.entries({missing:n=>{delete n.id;},wrong:n=>{n.id++;},string:n=>{n.id=String(n.id);},
  title:n=>{n.title='Altered';},body:n=>{n.body='Altered';},extra:n=>{n.extra.route='messages.html';},
  data:n=>{n.data={...n.extra,route:'messages.html'};},channel:n=>{n.channelId='different';}})){
  await probe(`v${version} callback ${name}`,async()=>{
   const f=await fixture({initialPrincipal:a});
   await f.emit('firebase','notificationReceived',{notification:{title:'Exact',body:'Exact body',data:{...data,route:'employee-schedule.html'}}});
   const payload=structuredClone(f.scheduled[0].notifications[0]);change(payload);f.effects.length=0;
   await f.emit('local','localNotificationActionPerformed',{actionId:'tap',notification:payload});
   check(receipts(f).length,0,'altered full callback must not persist opened');
   check(f.effects.some(x=>x.startsWith('route:')),false,'altered full callback must not navigate');
  });
 }
 await probe(`v${version} browser receipt retry`,async()=>{
  const f=await fixture({initialPrincipal:a,display:'denied'}),ui=f.fullBrowser();
  ui.setHref('https://localhost/messages.html');
  await f.emit('firebase','notificationReceived',{notification:{data}});
  const card=ui.card,open=card.querySelector('.mz-reminder-open'),dismiss=card.querySelector('.mz-reminder-dismiss');
  const hold=deferred();f.holdNextMutation(hold.promise);
  const first=open.listeners.click();hold.reject(Error('one transient protected mutation failure'));
  await first;
  check(ui.card,card,'exact card stays available');check(open.disabled,false,'Open restored after rejection');
  check(dismiss.disabled,false,'Dismiss restored after rejection');check(receipts(f).length,0,'no false receipt');
  const retry=open.listeners.click();await turn();await ui.finishTimers();await retry;
  check(receipts(f).length,1,'retry persists one exact opened receipt');check(ui.active,false,'retry closes its card');
  assert.match(ui.href,/employee-schedule\.html/);checks++;
 });
 for(const unavailable of [false,true])for(const phase of ['receipt','audio'])await probe(`v${version} old ${phase} A-${unavailable?'null':'B'}-A`,async()=>{
  const f=await fixture({initialPrincipal:a,display:'denied'}),ui=f.fullBrowser();ui.setHref('https://localhost/messages.html');
  await f.emit('firebase','notificationReceived',{notification:{data}});
  const old=ui.card,hold=deferred();if(phase==='receipt')f.holdNextMutation(hold.promise);
  const pending=old.querySelector('.mz-reminder-open').listeners.click();await turn();
  f.setPrincipal(unavailable?null:{...a,installation_seal:'other-seal',enrolled_at:'2026-08-01T12:00:00.000Z'});
  await turn();check(ui.active,false,'old card retires');f.setPrincipal(a);await turn();
  await f.emit('firebase','notificationReceived',{notification:{title:'Successor',data:{...data,notification_key:data.notification_key+':successor'}}});
  const successor=ui.card;assert.ok(successor);assert.notEqual(successor,old);checks+=2;
  if(phase==='receipt')hold.resolve();await turn();await ui.finishTimers();await pending;
  check(ui.card,successor,'retired pending Open cannot close successor');check(ui.href,'https://localhost/messages.html','retired pending Open cannot navigate');
  check(receipts(f).some(r=>r.notification_key===data.notification_key+':successor'),false,'no invented successor receipt');
  if(phase==='receipt')check(receipts(f).length,0,'retired receipt lease cannot revive when exact principal returns');
  await old.querySelector('.mz-reminder-open').listeners.click();check(ui.card,successor,'retired callback cannot re-enter');
 });
}

// A real committed write followed by a failed immediate readback, unlike the
// older fixture that dropped the write itself. Pending OS effects are retained
// across scheduler instances and cancellation failure, just as at process death.
for(const cancelFails of [false,true])for(const laterWritesFail of [false,true])await probe(`final readback cancel=${cancelFails} laterWrites=${laterWritesFail}`,async()=>{
 const memory=new Map(),active=new Map();let loseRead=null,failed=false;
 const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],
  getItem:k=>{if(k===loseRead){loseRead=null;failed=true;return null;}return memory.get(k)??null;},
  setItem:(k,v)=>{if(failed&&laterWritesFail)throw Error('persistent write failure');memory.set(k,v);if(JSON.parse(v).state==='scheduled'&&!failed)loseRead=k;},
  removeItem:k=>{if(failed&&laterWritesFail)throw Error('persistent write failure');memory.delete(k);}};
 let badCancel=cancelFails;
 const options={identity:()=> 'A',mutate:fn=>Promise.resolve().then(fn),storage,prefix:'owned:',plugin:{
  getPending:async()=>({notifications:[...active.values()]}),getDeliveredNotifications:async()=>({notifications:[]}),
  schedule:async({notifications})=>notifications.forEach(n=>active.set(n.id,structuredClone(n))),
  cancel:async({notifications})=>{if(badCancel)throw Error('cancel failed');notifications.forEach(n=>active.delete(n.id));}}};
 let scheduler=createPrincipalNotificationScheduler(options);
 await assert.rejects(()=>scheduler.present({title:'Owned',body:'Body',extra:{notification_key:'exact'}},'A'));checks++;
 const row=[...memory.values()].map(JSON.parse).find(r=>r.schema_version==='native-notification-schedule.v1'),notification=row.notification;
 check(scheduler.ownsAction(notification),false,'uncertain committed scheduled row cannot authorize action');
 scheduler=createPrincipalNotificationScheduler(options);
 check(scheduler.ownsAction(notification),false,'uncertainty remains non-authoritative at same-principal restart before reconciliation');
 try{await scheduler.reconcile();}catch(error){assert.match(error.message,/cancel failed|persistent write failure/);}
 check(scheduler.ownsAction(notification),false,'failed reconciliation cannot promote uncertainty');
 if(cancelFails){check(active.size,1,'uncertain OS side effect remains honestly reported');badCancel=false;}
 try{await scheduler.reconcile();}catch(error){assert.match(error.message,/persistent write failure/);}
 check(active.size,0,'exact uncertain OS effect eventually cancelled');
 check(scheduler.ownsAction(notification),false,'retired uncertain callback never becomes authority');
});
console.log(JSON.stringify({ok:failures.length===0,checks,failures,scope:'full callback, committed/readback-failed journal, real browser retry and retired lease',physical:false}));
if(failures.length)process.exitCode=1;
