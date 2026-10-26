import assert from 'node:assert/strict';
import {fixture,payload,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const results=[],tick=()=>new Promise(r=>setImmediate(r));
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
async function until(predicate){const deadline=Date.now()+2000;while(Date.now()<deadline){if(predicate())return;await new Promise(r=>setTimeout(r,5));}assert.ok(predicate(),'bounded operation reached');}
const availabilityKey='mz_employee_schedule_snapshot:availability:race-principal';
function legacy(){const date=zooServiceDate(),d=payload(40,false,date);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.home_facts={service_date:date,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:d.shift};return d;}
async function homeStoppedRecovery(site,throwOld,hide){
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const events=new Map(),nodes=new Map(),memory=new Map(),timers=new Set();let seq=0,nested=0,armed=false,schedules=0,infos=0;
  const el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const hook=name=>{if(armed&&!nested&&name===site){nested++;globalThis.document.hidden=hide;events.get('pagehide')();if(throwOld)throw Error('retired callback');}};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const healthy=()=>({ready:true,available:true,quarantined:false});
  const security={get native(){hook('native');return true;},getStatus(){hook('status');return healthy();},mutateProtectedWork:async fn=>fn()};
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=>{hook('principal');return'v15-dom';},profileMatchesPrincipal:()=>{hook('matches');return true;}}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>{const n=++seq;timers.add(n);return n;};globalThis.clearInterval=n=>timers.delete(n);
  globalThis.fetch=async()=>{infos++;throw Error('informational offline');};
  app=installHomeFacts({getProfile:()=>{hook('profile');return profile;},getDeviceId:()=>{hook('device');return'KIOSK_08';},isVisible:()=>true,security,
   requestJson:async()=>{schedules++;return legacy();}});
  await app.update(true);assert.equal(schedules,1);assert.equal(infos,3);assert.equal(timers.size,1);
  const detail={};for(const field of ['ready','available','quarantined'])Object.defineProperty(detail,field,{get(){hook('detail.'+field);return field!=='quarantined';}});
  armed=true;events.get('memphis:custodial-security-state')({detail});await tick();await tick();
  assert.equal(nested,1);assert.equal(schedules,1,'pagehide must not be undone by older positive security recovery');assert.equal(infos,3);assert.equal(timers.size,0);
  assert.equal(el('home-shift').textContent,'Schedule unavailable');
  armed=false;globalThis.document.hidden=false;events.get('memphis:custodial-security-state')({detail:healthy()});await until(()=>schedules===2);await tick();
  assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(timers.size,1,'fresh positive recovery remains usable');
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
for(const site of ['detail.ready','detail.available','detail.quarantined','native','profile','device','status','matches','principal'])
 for(const throwOld of [false,true])for(const hide of [false,true])await test('V14-01A '+site+(throwOld?' throws':' returns')+(hide?' hidden':''),()=>homeStoppedRecovery(site,throwOld,hide));

for(const event of ['online','memphis:schedule-refresh','memphis:native-notification-received'])for(const throwOld of [false,true])await test('V14-01B retired cancellation '+event+(throwOld?' throws':' returns'),async()=>{
 const f=fixture();try{
  await f.load();let fetching=false,retiredCaptures=0,inLock=false,retired=false;const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus;
  const target=f.context.window.MemphisRecurringScheduleTarget;
  f.context.window.MemphisRecurringScheduleTarget={...target,withScheduleLock:(principal,operation)=>target.withScheduleLock(principal,()=>{
   inLock=true;try{return operation();}finally{inLock=false;}
  })};
  const actualFetch=f.context.fetch;f.context.fetch=()=>{fetching=true;return new Promise(()=>{});};
  const old=f.load();await until(()=>fetching);assert.equal(JSON.parse(f.stored.get(availabilityKey)).state,'READING');
  security.getStatus=()=>{if(retired&&inLock){retiredCaptures++;if(throwOld)throw Error('retired status failure');}return original();};
  f.next=payload(21);f.context.fetch=actualFetch;retired=true;f.events.get(event)();await old;retired=false;await until(()=>f.cache()?.recurring_target.target.authorityRevision===21||f.node('state-text').textContent==='This phone needs a manager.');
  await tick();assert.equal(f.cache().recurring_target.target.authorityRevision,21);assert.equal(JSON.parse(f.stored.get(availabilityKey)).state,'AVAILABLE');
  assert.equal(retiredCaptures,0,'retired cleanup must not even capture successor status');
  assert.equal(f.node('content').hidden,false);assert.equal(f.node('state-text').textContent,'');
 }finally{f.events.get('pagehide')();await tick();}
});

for(const event of ['online','memphis:schedule-refresh','memphis:native-notification-received'])for(const site of ['native','atomic'])for(const throwOld of [false,true])await test('V14-01B retired '+site+' handoff '+event+(throwOld?' throws':' returns'),async()=>{
 const f=fixture();try{
  await f.load();let armed=true,nested=0,requestsAt,mutationsAt,mutations=0,inLock=false;const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus,mutate=security.mutateProtectedWork;
  const target=f.context.window.MemphisRecurringScheduleTarget;
  f.context.window.MemphisRecurringScheduleTarget={...target,withScheduleLock:(principal,operation)=>target.withScheduleLock(principal,()=>{
   inLock=true;try{return operation();}finally{inLock=false;}
  })};
  security.mutateProtectedWork=fn=>{mutations++;return mutate(fn);};
  security.getStatus=()=>{const value=original(),stack=new Error().stack;
   if(armed&&!nested&&(site==='native'?stack.includes('at native ('):inLock)){
    nested++;requestsAt=f.calls.length;mutationsAt=mutations;f.context.window.MemphisMobile.ready=new Promise(()=>{});f.events.get(event)();if(throwOld)throw Error('retired status failure');
   }return value;};
  f.next=payload(21);await f.load();await tick();assert.equal(nested,1,'actual owning bridge capture reached');
  assert.equal(f.calls.length,requestsAt,'no retired auth/fetch dispatch');assert.equal(mutations,mutationsAt,'no retired native mutation entry');
  assert.equal(f.cache().recurring_target.target.authorityRevision,19);assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0);
 }finally{f.events.get('pagehide')();await tick();}
});
async function statusCaptureCount(){const f=fixture();try{await f.load();let count=0;const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus;
 security.getStatus=()=>{count++;return original();};f.next=payload(21);await f.load();assert.ok(count>10&&count<100);return count;
 }finally{f.events.get('pagehide')();}}
const statusCaptures=await statusCaptureCount();
const display=f=>JSON.stringify(['employee','date','areas','content','state-text','notice'].map(k=>{const n=f.node(k);return[n.textContent,n.innerHTML,n.hidden];}));
for(const event of ['online','memphis:schedule-refresh','memphis:native-notification-received'])for(let at=1;at<=statusCaptures;at++)for(const throwOld of [false,true])await test('V14-01B full status handoff '+event+' #'+at+(throwOld?' throws':' returns'),async()=>{
 const f=fixture();try{
  await f.load();let calls=0,nested=0,oldRow,oldAvailability,oldDisplay,oldRequests,oldMutations,mutations=0;
  const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus,mutate=security.mutateProtectedWork;
  security.mutateProtectedWork=fn=>{mutations++;return mutate(fn);};
  security.getStatus=()=>{const value=original();if(++calls===at){nested++;
   oldRow=f.stored.get(key);oldAvailability=f.stored.get(availabilityKey);oldDisplay=display(f);oldRequests=f.calls.length;oldMutations=mutations;
   f.context.window.MemphisMobile.ready=new Promise(()=>{});f.events.get(event)();if(throwOld)throw Error('retired status capture');
  }return value;};
  f.next=payload(21);await f.load();await tick();assert.equal(nested,1);
  assert.equal(f.stored.get(key),oldRow);assert.equal(f.stored.get(availabilityKey),oldAvailability);assert.equal(display(f),oldDisplay);
  assert.equal(f.calls.length,oldRequests);assert.equal(mutations,oldMutations);
 }finally{f.events.get('pagehide')();await tick();}
});
for(const field of ['ready','available','quarantined'])for(const throwOld of [false,true])await test('Schedule positive security detail preserves later pagehide '+field+(throwOld?' throws':' returns'),async()=>{
 const f=fixture();try{await f.load();const requests=f.calls.length;let nested=0;const detail={ready:true,available:true,quarantined:false};
  Object.defineProperty(detail,field,{get(){nested++;f.events.get('pagehide')();if(throwOld)throw Error('retired detail');return field!=='quarantined';}});
  f.events.get('memphis:custodial-security-state')({detail});await tick();assert.equal(nested,1);assert.equal(f.calls.length,requests);
  assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
  f.events.get('pageshow')();f.events.get('memphis:custodial-security-state')({detail:{ready:true,available:true,quarantined:false}});await tick();await tick();
  await until(()=>f.node('content').hidden===false);assert.ok(f.calls.length>requests);
 }finally{f.events.get('pagehide')();await tick();}
});
console.log(JSON.stringify({scope:'V14-01 actual Home public-stop/security and actual Schedule retired cleanup/native/protected handoffs; synthetic only',statusCaptures,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
