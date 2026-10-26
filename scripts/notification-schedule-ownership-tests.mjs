import assert from 'node:assert/strict';
import {schedulerForFixtureProfile} from './native-notification-arrival-boundary-tests.mjs';
import {CLEANING_SCOPE} from '../mobile/scripts/custodial-new-producer-scope-policy.mjs';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
const nativeWriterOnly=process.argv.includes('--notification-os-original-writer-only');
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const notification=key=>({title:'Exact '+key,body:'Exact body',extra:{kind:'employee_lunch_coverage',notification_key:key}});
// Exact Android Local Notifications 8.2.1 delivered inventory does NOT return
// the scheduled JS extra; its group comes from Notification.getGroup().
const vendorDelivered=n=>({id:n.id,tag:null,title:n.title,body:n.body,group:n.group??null,groupSummary:false,
 data:{'android.title':n.title,'android.text':n.body}});
function fixture({memory=new Map(),active=new Map(),scopeProfile='full-system'}={}){
 let scope='full-principal-A',tail=Promise.resolve(),calls=0,cancelFailure=false,scheduleFailure=false,
  writeFailure=false,afterInventory=()=>{},afterSchedule=()=>{};
 const cancelled=[],delivered=new Map([[1,{id:1,extra:{unrelated:true}}]]);let ignoreCancel=false,ignoreDeliveredRemoval=false;
 const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,
  setItem:(k,v)=>{if(writeFailure)throw Error('journal unavailable');memory.set(k,v);},removeItem:k=>memory.delete(k)};
 const options={identity:()=>scope,storage,prefix:'owned:',mutate:fn=>{
  const result=tail.then(fn,fn);tail=result.catch(()=>{});return result;
 },plugin:{getPending:async()=>{afterInventory();return {notifications:[...active.values()]};},
  getDeliveredNotifications:async()=>({notifications:[...delivered.values()]}),
  removeDeliveredNotifications:async({notifications})=>{if(!ignoreDeliveredRemoval)for(const n of notifications)delivered.delete(n.id);},
  cancel:async({notifications})=>{if(cancelFailure)throw Error('cancel unavailable');for(const n of notifications){cancelled.push(n.id);if(!ignoreCancel)active.delete(n.id);}},
  schedule:async({notifications})=>{calls++;for(const n of notifications)active.set(n.id,structuredClone(n));afterSchedule();if(scheduleFailure)throw Error('uncertain schedule');}
 }};
 const createPrincipalNotificationScheduler=schedulerForFixtureProfile(scopeProfile);
 let scheduler=createPrincipalNotificationScheduler(options);
 return {memory,active,delivered,cancelled,options,get calls(){return calls;},get scheduler(){return scheduler;},scope:s=>{scope=s;},
  ignoreCancel:v=>{ignoreCancel=v;},ignoreDeliveredRemoval:v=>{ignoreDeliveredRemoval=v;},
  restart:()=>{scheduler=createPrincipalNotificationScheduler(options);},
  failCancel:v=>{cancelFailure=v;},failSchedule:v=>{scheduleFailure=v;},failWrite:v=>{writeFailure=v;},
  afterInventory:fn=>{afterInventory=fn;},afterSchedule:fn=>{afterSchedule=fn;}};
}
if(!nativeWriterOnly){
{
 const deferred=fixture({scopeProfile:CLEANING_SCOPE}),before=[...deferred.memory],originalDelivered=[...deferred.delivered];
 await assert.rejects(deferred.scheduler.present(notification('cleaning-new-admission'),'full-principal-A'),error=>error.code==='custodial_new_producer_scope_deferred');
 check(deferred.calls,0,'cleaning scope refuses new OS scheduling');
 check([...deferred.memory],before,'cleaning refusal preserves raw original records');
 check([...deferred.delivered],originalDelivered,'cleaning refusal preserves unrelated delivered inventory');
}
const f=fixture();
check(await f.scheduler.present(notification('one'),'full-principal-A'),true,'valid schedule');
const first=[...f.active.values()][0];check(first.id,2,'unrelated pending/delivered ID is avoided');
check(f.scheduler.ownsAction(first),true,'exact scheduled owner action');
check(f.scheduler.ownsAction({...first,extra:{...first.extra,notification_key:'forged'}}),false,'different payload rejected');
check(f.scheduler.ownsAction({...first,extra:{...first.extra,native_presentation_principal:undefined}}),false,'unscoped callback rejected');
f.restart();await f.scheduler.reconcile();
check(f.active.size,1,'same-principal restart retains exact completed schedule');
check(f.scheduler.ownsAction(first),true,'same-principal cold action remains usable');
f.active.clear();f.restart();await f.scheduler.reconcile();
check(f.scheduler.ownsAction(first),true,'Android removes OS notification before cold-start action; exact confirmed callback still works');
check(await f.scheduler.present(notification('one'),'full-principal-A'),true,'same accepted payload restart recovers ownership');
check(f.calls,1,'already scheduled payload not re-dispatched');
f.scope('full-principal-B');f.restart();await f.scheduler.reconcile();
check(f.active.size,0,'foreign completed schedule cancelled at restart');
check(f.scheduler.ownsAction(first),false,'old complete binding cannot act under B');
check(JSON.parse(f.memory.get('owned:2')).state,'cancelled','history retained');
await f.scheduler.present(notification('one'),'full-principal-B');
check([...f.active.keys()],[3],'retained old ID cannot cancel successor');
check(f.scheduler.ownsAction([...f.active.values()][0]),true,'new owner can act');
await f.scheduler.reconcile();check([...f.active.keys()],[3],'repeat cleanup leaves current owner intact');

const before=fixture();before.afterInventory(()=>before.scope('full-principal-B'));
check(await before.scheduler.present(notification('before'),'full-principal-A'),false,'principal transition before dispatch');
check(before.calls,0,'no stale dispatch');check(before.memory.size,0,'no invented intent');
const during=fixture();during.afterSchedule(()=>during.scope('full-principal-B'));
check(await during.scheduler.present(notification('during'),'full-principal-A'),false,'transition at completion does not claim success');
check(during.active.size,0,'exact compensating cancellation');
check(JSON.parse([...during.memory.values()][0]).state,'cancelled','cancel completion durable');

const uncertain=fixture();uncertain.failSchedule(true);uncertain.failCancel(true);
await assert.rejects(()=>uncertain.scheduler.present(notification('uncertain'),'full-principal-A'),/cancel unavailable/);checks++;
check(uncertain.active.size,1,'uncertain external effect is not fabricated away');
check(JSON.parse([...uncertain.memory.values()][0]).state,'intent','uncertain intent retained for restart');
check(uncertain.scheduler.ownsAction([...uncertain.active.values()][0]),false,'uncertain schedule cannot authorize action');
uncertain.restart();await assert.rejects(()=>uncertain.scheduler.reconcile(),/cancel unavailable/);checks++;
check(JSON.parse([...uncertain.memory.values()][0]).state,'intent','failed cleanup cannot retire ownership');
uncertain.failCancel(false);uncertain.failSchedule(false);await uncertain.scheduler.reconcile();
check(uncertain.active.size,0,'restart cleanup removes exact uncertain schedule');
await uncertain.scheduler.present(notification('uncertain'),'full-principal-A');
check([...uncertain.active.keys()],[3],'retry uses a separately owned ID');

const failedWrite=fixture();failedWrite.failWrite(true);
await assert.rejects(()=>failedWrite.scheduler.present(notification('no-store'),'full-principal-A'),/journal unavailable/);checks++;
check(failedWrite.calls,0,'no OS dispatch before durable intent');
const collision=fixture();
check(await Promise.all(['one','two','three'].map(k=>collision.scheduler.present(notification(k),'full-principal-A'))),[true,true,true],'serialized concurrent schedules');
check([...collision.active.keys()],[2,3,4],'unique owned IDs across concurrent operations');
check(collision.cancelled,[],'no cancellation of another current notification');
await collision.scheduler.present({...notification('one'),body:'Different exact content'},'full-principal-A');
check(collision.active.size,4,'different content never adopts earlier display proof');

const displayed=fixture();await displayed.scheduler.present(notification('already-delivered'),'full-principal-A');
const shown=[...displayed.active.values()][0];displayed.active.delete(shown.id);displayed.delivered.set(shown.id,vendorDelivered(shown));
displayed.scope('full-principal-B');await displayed.scheduler.reconcile();
check(displayed.delivered.has(shown.id),false,'retired owned notification actually removed from delivered OS inventory');
check(displayed.delivered.has(1),true,'unrelated delivered notification untouched');
for(const failure of ['ignoreCancel','ignoreDeliveredRemoval']){
 const stale=fixture();await stale.scheduler.present(notification(failure),'full-principal-A');const old=[...stale.active.values()][0];
 if(failure==='ignoreDeliveredRemoval'){stale.active.delete(old.id);stale.delivered.set(old.id,vendorDelivered(old));}
 stale[failure](true);stale.scope('full-principal-B');
 await assert.rejects(()=>stale.scheduler.reconcile(),/cancellation unconfirmed/);checks++;
 check(JSON.parse(stale.memory.get('owned:'+old.id)).state,'scheduled','unconfirmed cancellation never marked retired');
 check(stale.memory.has('owned:unconfirmed:'+old.id),true,'durable action barrier survives uncertain cancel');
 stale.restart();stale[failure](false);await stale.scheduler.reconcile();
 check(JSON.parse(stale.memory.get('owned:'+old.id)).state,'cancelled','restart completes exact owned cancellation');
}
{
 const f=fixture();await f.scheduler.present(notification('ownership-conflict'),'full-principal-A');
 const id=[...f.active.keys()][0];f.active.set(id,{id,extra:{unrelated:true}});f.scope('full-principal-B');
 await assert.rejects(()=>f.scheduler.reconcile(),/ownership conflict/);checks++;
 check(f.cancelled,[],'conflicting OS payload never cancelled by numeric ID alone');check(f.active.size,1,'unrelated payload preserved');
}
{
 const f=fixture();await f.scheduler.present(notification('delivered-conflict'),'full-principal-A');const old=[...f.active.values()][0];
 f.active.delete(old.id);f.delivered.set(old.id,{...vendorDelivered(old),group:'unrelated-owner'});f.scope('full-principal-B');
 await assert.rejects(()=>f.scheduler.reconcile(),/ownership conflict/);checks++;
 check(f.delivered.has(old.id),true,'same numeric ID with conflicting delivered ownership is retained');
 check(f.cancelled,[],'conflict cannot trigger numeric-only cancellation');
}
{
 const f=fixture();await f.scheduler.present(notification('old-no-marker'),'full-principal-A');const first=[...f.active.values()][0];
 const historical=JSON.parse(f.memory.get('owned:'+first.id));delete historical.delivery_ownership_group;delete historical.notification.group;
 f.memory.set('owned:'+first.id,JSON.stringify(historical));f.active.delete(first.id);f.delivered.set(first.id,vendorDelivered(historical.notification));
 await f.scheduler.present(notification('new-provable'),'full-principal-A');const second=[...f.active.values()][0];
 f.active.delete(second.id);f.delivered.set(second.id,vendorDelivered(second));f.scope('full-principal-B');
 await assert.rejects(()=>f.scheduler.reconcile(),/ownership conflict/);checks++;
 check(f.delivered.has(first.id),true,'unprovable historical delivered ownership remains unresolved, not erased');
 check(f.delivered.has(second.id),false,'failed historical row does not block later provable cleanup');
 check(JSON.parse(f.memory.get('owned:'+second.id)).state,'cancelled','successful independent retirement journaled');
}
console.log(JSON.stringify({ok:true,checks,scope:'actual scheduler source; serialized storage and synthetic exact vendor delivered shape; restart, failure, ID, action ownership and exact pending/delivered cancellation readback',physical:false}));
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function nativeWriterFixture(){
 const f=fixture(),id=n=>`bf000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 let generation=11,p={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
  assignment_epoch:7,credential_operation_id:id(3),installation_seal:'synthetic-notification-installation',enrolled_at:'2026-07-01T12:00:00.000Z'},ready=true,open=false;
 const hooks={admit:null,settle:null,missingCheckpoint:false,contextGeneration:null,contextDevice:null};
 const stats={callbacks:0,checkpoints:0,options:[]};
 const nativeStatus=()=>({ready,available:true,quarantined:false,generation,deviceId:p.device_id,principal:{...p}});
 Object.assign(f.options,{identity:()=>principalIdentity(p),requireNativeOwner:true,nativeStatus,
  mutate:async(operation,options={})=>{
   stats.options.push({...options});if(hooks.admit)await hooks.admit();
   if(options.expectedGeneration!=null&&options.expectedGeneration!==generation)throw Error('synthetic native generation refused');
   const original=generation;let result;open=true;
   const context={deviceId:hooks.contextDevice??p.device_id,generation:hooks.contextGeneration??generation};
   if(!hooks.missingCheckpoint)context.assertCurrent=()=>{
    assert.equal(open,true,'no closed checkpoint after native callback settlement');stats.checkpoints++;
    if(original!==generation||!ready)throw Error('synthetic native checkpoint refused');
   };
   try{stats.callbacks++;result=await operation(Object.freeze(context));}finally{open=false;}
   if(hooks.settle)await hooks.settle();return result;
  }});
 f.restart();
 return Object.assign(f,{hooks,stats,nativeStatus,currentScope:()=>principalIdentity(p),
  changeGeneration:()=>{generation++;},changePrincipal:()=>{p={...p,installation_seal:'synthetic-other-installation'};},
  withdraw:()=>{ready=false;}});
}
if(nativeWriterOnly){
 const results=[];
 const run=async(name,body)=>{try{await body();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.stack});}};
 await run('NOTIFICATION_OS_WRITER_NEW: queued same-principal generation cannot dispatch',async()=>{
  const f=nativeWriterFixture(),entered=deferred(),release=deferred(),scope=f.currentScope();
  f.hooks.admit=async()=>{entered.resolve();await release.promise;};
  const pending=f.scheduler.present(notification('queued'),scope);await entered.promise;
  f.changeGeneration();release.resolve();
  await assert.rejects(pending);assert.equal(f.calls,0);assert.equal(f.memory.size,0);
 });
 await run('NOTIFICATION_OS_WRITER_NEW: queued full principal cannot be adopted with unchanged native generation',async()=>{
  const f=nativeWriterFixture(),entered=deferred(),release=deferred(),scope=f.currentScope();
  f.hooks.admit=async()=>{entered.resolve();await release.promise;};
  const pending=f.scheduler.present(notification('principal-queued'),scope);await entered.promise;
  f.changePrincipal();release.resolve();await assert.rejects(pending);
  assert.equal(f.calls,0);assert.equal(f.memory.size,0);
 });
 await run('NOTIFICATION_OS_WRITER_NEW: explicit native mode refuses absent status or callback proof',async()=>{
  for(const configure of [
   f=>{delete f.options.nativeStatus;},
   f=>{f.options.nativeStatus=()=>({ready:true,available:true,quarantined:false});},
   f=>{f.options.nativeStatus=()=>{throw Error('synthetic status unavailable');};},
   f=>{f.hooks.missingCheckpoint=true;},
   f=>{f.hooks.contextGeneration=12;},
   f=>{f.hooks.contextDevice='KIOSK_09';}
  ]){
   const f=nativeWriterFixture(),scope=f.currentScope();configure(f);f.restart();
   await assert.rejects(f.scheduler.present(notification('unsupported'),scope));
   await assert.rejects(f.scheduler.reconcile());assert.equal(f.calls,0);assert.equal(f.memory.size,0);
   assert.equal(f.scheduler.ownsAction({id:2,extra:{native_presentation_principal:scope,native_presentation_id:'2'}}),false);
  }
 });
 await run('NOTIFICATION_OS_WRITER_NEW: current native owner confirms exact intent and never uses closed context',async()=>{
  const f=nativeWriterFixture(),scope=f.currentScope();
  assert.equal(await f.scheduler.present(notification('normal'),scope),true);
  assert.deepEqual(f.stats.options,[{requireEnrollment:true,expectedGeneration:11}]);
  assert.ok(f.stats.checkpoints>0);assert.equal(f.calls,1);
  const original=[...f.active.values()][0],raw=f.memory.get('owned:'+original.id);
  assert.equal(JSON.parse(raw).state,'scheduled');assert.equal(f.memory.has('owned:unconfirmed:'+original.id),false);
  assert.equal(f.scheduler.ownsAction(original),true);
  assert.equal(await f.scheduler.present(notification('normal'),scope),true);
  assert.equal(f.calls,1,'same exact confirmed notification not dispatched again');
  assert.equal(f.memory.get('owned:'+original.id),raw);
 });
 await run('NOTIFICATION_OS_WRITER_NEW: native inventory awaits cannot resume into successor effects',async()=>{
  for(const method of ['getPending','getDeliveredNotifications']){
   const f=nativeWriterFixture(),entered=deferred(),release=deferred(),scope=f.currentScope(),original=f.options.plugin[method];
   f.options.plugin[method]=async(...args)=>{const value=await original(...args);entered.resolve();await release.promise;return value;};
   const pending=f.scheduler.present(notification(method),scope);await entered.promise;
   if(method==='getPending')f.changeGeneration();else f.changePrincipal();
   release.resolve();await assert.rejects(pending);assert.equal(f.calls,0);assert.equal(f.memory.size,0);
   assert.deepEqual(f.cancelled,[]);
  }
 });
 await run('NOTIFICATION_OS_WRITER_NEW: schedule await withdrawal retains exact pending original for current-owner cleanup',async()=>{
  const f=nativeWriterFixture(),entered=deferred(),release=deferred(),scope=f.currentScope(),schedule=f.options.plugin.schedule;
  f.options.plugin.schedule=async args=>{await schedule(args);entered.resolve();await release.promise;};
  const pending=f.scheduler.present(notification('schedule-pending'),scope);await entered.promise;
  const original=[...f.active.values()][0],raw=f.memory.get('owned:'+original.id),guard=f.memory.get('owned:unconfirmed:'+original.id);
  f.changeGeneration();release.resolve();await assert.rejects(pending);
  assert.equal(f.memory.get('owned:'+original.id),raw);assert.equal(f.memory.get('owned:unconfirmed:'+original.id),guard);
  assert.equal(JSON.parse(raw).state,'intent');assert.deepEqual(f.cancelled,[]);assert.equal(f.calls,1);
  assert.equal(f.scheduler.ownsAction(original),false);
  await f.scheduler.reconcile();
  const retired=JSON.parse(f.memory.get('owned:'+original.id));
  assert.equal(retired.state,'cancelled');assert.deepEqual(retired.notification,original);
  assert.equal(retired.delivery_ownership_group,original.group);assert.equal(f.calls,1);
  assert.equal(f.memory.get('owned:unconfirmed:'+original.id),guard,'cleanup preserves original guard');
 });
 await run('NOTIFICATION_OS_WRITER_NEW: current owner may cancel exact stale-recipient pending and delivered rows only',async()=>{
  for(const delivered of [false,true]){
   const f=nativeWriterFixture();await f.scheduler.present(notification('stale-recipient'),f.currentScope());
   const original=[...f.active.values()][0],raw=f.memory.get('owned:'+original.id);
   if(delivered){f.active.delete(original.id);f.delivered.set(original.id,vendorDelivered(original));}
   f.changePrincipal();assert.notEqual(f.currentScope(),JSON.parse(raw).scope);
   await f.scheduler.reconcile();
   assert.equal(f.active.has(original.id),false);assert.equal(f.delivered.has(original.id),false);
   assert.equal(f.delivered.has(1),true,'unrelated delivered ID untouched');
   const retired=JSON.parse(f.memory.get('owned:'+original.id));
   assert.equal(retired.state,'cancelled');assert.equal(retired.scope,JSON.parse(raw).scope);
   assert.deepEqual(retired.notification,original);assert.equal(f.calls,1);
  }
 });
 await run('NOTIFICATION_OS_WRITER_NEW: cancellation await cannot continue or retire after original owner loss',async()=>{
  for(const method of ['cancel','removeDeliveredNotifications']){
   const f=nativeWriterFixture();await f.scheduler.present(notification(method),f.currentScope());
   const original=[...f.active.values()][0],raw=f.memory.get('owned:'+original.id);
   if(method==='removeDeliveredNotifications'){f.active.delete(original.id);f.delivered.set(original.id,vendorDelivered(original));}
   f.changePrincipal();
   const entered=deferred(),release=deferred(),effect=f.options.plugin[method];
   f.options.plugin[method]=async args=>{await effect(args);entered.resolve();await release.promise;};
   const pending=f.scheduler.reconcile();await entered.promise;f.changeGeneration();release.resolve();
   await assert.rejects(pending);assert.equal(f.memory.get('owned:'+original.id),raw);
   assert.equal(f.memory.has('owned:unconfirmed:'+original.id),true);assert.equal(f.calls,1);
  }
 });
 await run('NOTIFICATION_OS_WRITER_NEW: native cleanup keeps unconfirmed foreign IDs and groups held',async()=>{
  for(const delivered of [false,true]){
   const f=nativeWriterFixture();await f.scheduler.present(notification('foreign'),f.currentScope());
   const original=[...f.active.values()][0],raw=f.memory.get('owned:'+original.id);
   if(delivered){f.active.delete(original.id);f.delivered.set(original.id,{...vendorDelivered(original),group:'foreign-group'});}
   else f.active.set(original.id,{id:original.id,extra:{unrelated:true}});
   f.changePrincipal();await assert.rejects(f.scheduler.reconcile(),/ownership conflict/);
   assert.deepEqual(f.cancelled,[]);assert.equal(f.memory.get('owned:'+original.id),raw);
   assert.equal(f.memory.has('owned:unconfirmed:'+original.id),true);
  }
 });
 await run('NOTIFICATION_OS_WRITER_NEW: storage or settlement owner loss never reports accepted successor',async()=>{
  for(const phase of ['intent-write','guard-write','scheduled-write','guard-remove','settle']){
   const f=nativeWriterFixture(),scope=f.currentScope(),set=f.options.storage.setItem,remove=f.options.storage.removeItem;
   f.options.storage.setItem=(key,value)=>{
    set(key,value);
    if(phase==='intent-write'&&JSON.parse(value).state==='intent'
      ||phase==='guard-write'&&key.startsWith('owned:unconfirmed:')
      ||phase==='scheduled-write'&&JSON.parse(value).state==='scheduled')f.changeGeneration();
   };
   f.options.storage.removeItem=key=>{remove(key);if(phase==='guard-remove')f.changeGeneration();};
   if(phase==='settle')f.hooks.settle=()=>f.changeGeneration();
   await assert.rejects(f.scheduler.present(notification(phase),scope));
   assert.equal(f.memory.has('owned:2'),true,'original row is not erased');
   const row=JSON.parse(f.memory.get('owned:2'));
   assert.equal(row.state,['scheduled-write','guard-remove','settle'].includes(phase)?'scheduled':'intent',
    'a completed synchronous write is retained even when its subsequent checkpoint refuses');
   assert.equal(f.memory.has('owned:unconfirmed:2'),phase!=='intent-write'&&phase!=='guard-remove'&&phase!=='settle');
   assert.equal(f.calls,phase==='intent-write'||phase==='guard-write'?0:1);
   assert.deepEqual(f.cancelled,[],'stale invocation cannot compensate under successor');
  }
 });
 await run('NOTIFICATION_OS_WRITER_NEW: explicit nonnative mode keeps ordinary control compatibility',async()=>{
  const f=fixture();assert.equal(f.options.requireNativeOwner,undefined);
  assert.equal(await f.scheduler.present(notification('ordinary-control'),'full-principal-A'),true);
  const original=[...f.active.values()][0];assert.equal(f.scheduler.ownsAction(original),true);
  f.scope('full-principal-B');await f.scheduler.reconcile();
  assert.equal(JSON.parse(f.memory.get('owned:'+original.id)).state,'cancelled');
 });
 console.log(JSON.stringify({scope:'actual OS scheduler, synthetic storage/native FIFO/LocalNotifications ports only',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results,physical:false},null,2));
 if(results.some(r=>!r.pass))process.exitCode=1;
}
