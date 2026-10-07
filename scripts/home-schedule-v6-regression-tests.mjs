import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture,payload,day,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {homeBinding,homeIdentity,zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const cases=[];const pause=()=>new Promise(r=>setTimeout(r,35));
async function test(name,run){try{await run();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:e.message.slice(0,650)});}}
const legacy=(revision=30)=>{const d=payload(revision);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';
 d.schedule_application={application_status:'DEVICE_REPORTED_APPLIED',received_at:day+'T17:00:00Z',authority_revision:revision,
  intent_id:id(71),publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 d.home_facts={service_date:day,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:{start:'07:00',end:'16:00'}};return d;};
const who={deviceId:'KIOSK_08',employeeId:id(2),employeeName:'Fixture',credentialId:id(3),assignmentEpoch:7,protectedBinding:'race-principal'};
function home(memory=new Map()){
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const owner=createScheduleHomeConvergence({identity:()=>who,storage,mutate:async fn=>fn(),matches:d=>d.employee_id===who.employeeId,
  now:()=>Date.parse(day+'T17:00:00Z')});return{owner,memory,storage};
}
for(const value of [false,0,'',null])await test('H01 explicit falsy typed marker '+JSON.stringify(value),async()=>{
 const f=fixture();f.next=legacy();await f.load();const r=f.cache();r.recurring_target=value;f.stored.set(key,JSON.stringify(r));
 assert.throws(()=>f.context.testPage.snapshot());
});
await test('H02 typed notice never changes visible authenticated presentation',async()=>{
 const f=fixture(),d=payload(30);d.notice='UNBOUND A';f.next=d;await f.load();assert.equal(f.node('notice').textContent,'');
 d.notice='UNBOUND B';f.next=d;await f.load();assert.equal(f.node('notice').textContent,'');
});
function emptyTyped(){
 const d=payload(30),view={...d.recurring_delivery.view,employee_name:'',raw_items:[]};
 const sha=s=>createHash('sha256').update(s).digest('hex');
 d.recurring_delivery.view=view;d.recurring_delivery.viewJsonText=JSON.stringify(view);
 d.recurring_delivery.viewDigest=d.recurring_delivery.target.viewDigest=sha(JSON.stringify(view));
 const t=d.recurring_delivery.target;d.recurring_delivery.targetDigest=sha('{'+Object.keys(t).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(t[k])).join(', ')+'}');
 return{...d,...view,employee:{display_name:'UNBOUND EMPLOYEE'},schedule_status:'off'};
}
await test('H02 typed empty view ignores unbound off status and name fallback',async()=>{
 const f=fixture(),d=emptyTyped();f.next=d;await f.load();assert.equal(f.node('employee').textContent,'Employee');
 assert.match(f.node('areas').innerHTML,/No regular areas/);const before=f.node('areas').innerHTML;
 d.schedule_status='on';d.employee.display_name='OTHER UNBOUND';f.next=d;await f.load();assert.equal(f.node('areas').innerHTML,before);assert.equal(f.node('employee').textContent,'Employee');
});
for(const field of ['notice','schedule_status','employee_name','employee','projection_status','stale'])await test('H02 legacy same authority binds '+field,async()=>{
 const f=fixture(),d=legacy();d.notice='A';d.schedule_status='on';d.employee={display_name:'Fixture'};f.next=d;await f.load();f.calls.length=0;
 const changed=structuredClone(d);changed[field]=field==='employee'?{display_name:'UNBOUND'}:field==='stale'?true:'CHANGED';
 f.next=changed;await f.load();await pause();assert.deepEqual(f.cache().data,d);assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));
});
await test('H02 cached terminal forbids alternate usable current_items',async()=>{
 const f=fixture();await f.put(payload(30,true));const r=f.cache();r.data.current_items=[{name:'UNBOUND'}];f.stored.set(key,JSON.stringify(r));assert.throws(()=>f.context.testPage.snapshot());
});
await test('H02 terminal response clears all usable item aliases',async()=>{
 const f=fixture(),d=payload(30,true);d.current_items=[{name:'UNBOUND'}];f.next=d;await f.load();assert.deepEqual(f.cache().data.current_items,[]);assert.equal(f.node('content').hidden,true);
});
for(const positive of [false,true])await test('H04 Schedule throwing status during '+(positive?'positive':'negative')+' event latches',async()=>{
 const f=fixture();await f.load();let broken=true;const get=f.context.window.MemphisCustodialSecurity.getStatus;
 f.context.window.MemphisCustodialSecurity.getStatus=()=>{if(broken)throw Error('synthetic status failure');return get();};
 assert.doesNotThrow(()=>f.events.get('memphis:custodial-security-state')({detail:{ready:positive,available:positive,quarantined:!positive}}));
 assert.equal(f.node('content').hidden,true);broken=false;f.events.get('storage')({key});await f.load();assert.equal(f.node('content').hidden,true);
 f.events.get('memphis:custodial-security-state')({detail:{ready:true,available:true,quarantined:false}});await pause();assert.equal(f.node('content').hidden,false);
});
await test('H05 Schedule unavailable survives a new page and offline load',async()=>{
 const f=fixture();await f.load();const original=f.stored.get(key);f.next={...payload(20),schedule_delivery_mode:'UNAVAILABLE'};await f.load();
 assert.equal(f.stored.get(key),original,'last exact snapshot retained, availability is a separate fence');
 const next=fixture();for(const [k,v]of f.stored)next.stored.set(k,v);next.context.fetch=async()=>{throw Error('offline');};
 next.events.get('storage')({key});await next.load();await pause();assert.equal(next.node('content').hidden,true);
});
await test('H05 Home unavailable survives new consumer',async()=>{
 const f=home();await f.owner.accept(legacy(),who);await f.owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},who);
 assert.equal(home(f.memory).owner.resolve(who,null).shift,null);
});
await test('H05 Home unavailable fences actual Schedule consumer',async()=>{
 const f=fixture(),h=home(f.stored);await h.owner.accept(legacy(),who);await h.owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},who);
 f.context.fetch=async()=>{throw Error('offline');};f.events.get('storage')({key});await f.load();await pause();assert.equal(f.node('content').hidden,true);
});
await test('H05 Schedule unavailable fences new Home consumer',async()=>{
 const f=fixture();f.next=legacy();await f.load();f.next={...legacy(),schedule_delivery_mode:'UNAVAILABLE'};await f.load();
 assert.equal(home(f.stored).owner.resolve(who,null).shift,null);
});
await test('H05 later validated current response durably recovers both consumers',async()=>{
 const f=home();await f.owner.accept(legacy(),who);await f.owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},who);
 const fresh=home(f.memory);await fresh.owner.accept(legacy(31),who);assert.equal(home(f.memory).owner.resolve(who,null).shift.start,'07:00');
 const page=fixture();for(const [k,v]of f.memory)page.stored.set(k,v);page.context.fetch=async()=>{throw Error('offline');};page.events.get('storage')({key});await page.load();assert.equal(page.node('content').hidden,false);
});
await test('H05 older in-flight Home response cannot clear another consumer fence',async()=>{
 const f=home();await f.owner.accept(legacy(),who);const observedAvailability=f.owner.capture?.(who)??null;
 await home(f.memory).owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},who);
 await assert.rejects(()=>f.owner.accept(legacy(31),who,{observedAvailability}),e=>e.code==='schedule_request_invalidated');
 assert.equal(home(f.memory).owner.resolve(who,null).shift,null);
});
await test('H05 AVAILABLE retains stamp, preventing unavailable/recovered ABA',async()=>{
 const f=home();await f.owner.accept(legacy(),who);const observedAvailability=f.owner.capture?.(who)??null;
 await f.owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},who);await home(f.memory).owner.accept(legacy(31),who);
 await assert.rejects(()=>f.owner.accept(legacy(32),who,{observedAvailability}),e=>e.code==='schedule_request_invalidated');
});

await test('H05 unavailable write failure then restart and failed fetch cannot revive old Schedule',async()=>{
 const f=fixture();await f.load();f.next={...payload(20),schedule_delivery_mode:'UNAVAILABLE'};
 const fetch=f.context.fetch;f.context.fetch=async()=>{const result=await fetch();f.writeFails=true;return result;};await f.load();
 assert.equal(f.node('content').hidden,true);f.writeFails=false;
 const fresh=fixture();for(const [k,v]of f.stored)fresh.stored.set(k,v);fresh.context.fetch=async()=>{throw Error('offline');};
 await fresh.load();assert.equal(fresh.node('content').hidden,true);assert.equal(fresh.cache().recurring_target.target.authorityRevision,19);
});
await test('H05 durable read fence survives process death before response',async()=>{
 const f=fixture();await f.load();f.context.fetch=()=>new Promise(()=>{});void f.load();await pause();
 const fresh=fixture();for(const [k,v]of f.stored)fresh.stored.set(k,v);fresh.context.fetch=async()=>{throw Error('offline');};
 await fresh.load();assert.equal(fresh.node('content').hidden,true);
 f.events.get('pagehide')();await pause();
});
await test('H05 failed read-ahead with prior snapshot does not issue an unfenced request',async()=>{
 const f=fixture();await f.load();f.calls.length=0;f.writeFails=true;await f.load();assert.equal(f.calls.includes('GET'),false);assert.equal(f.node('content').hidden,true);
});
await test('H05 delayed Schedule response cannot erase newer Home unavailable',async()=>{
 const f=fixture();f.next=legacy();await f.load();let finish;f.context.fetch=()=>new Promise(resolve=>{finish=resolve;});const pending=f.load();await pause();
 await home(f.stored).owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},who);
 finish({ok:true,json:async()=>({ok:true,data:legacy(31)})});await pending;
 assert.equal(f.node('content').hidden,true);assert.equal(home(f.stored).owner.resolve(who,null).shift,null);
});

async function homeDom({native=true,historical=false,throws=false,positive=true}){
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],old=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const nodes=new Map(),events=new Map(),memory=new Map(),el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  let broken=false;const status={ready:true,available:true,quarantined:false},d=legacy();d.service_date=d.home_facts.service_date=zooServiceDate();
  const identity={...homeIdentity(profile,'KIOSK_08'),protectedBinding:native?'v6-dom':'browser:'+homeBinding(homeIdentity(profile,'KIOSK_08'))};
  if(historical){
   // Exact persisted V4 representation: flattened mismatched supplemental P99/P98,
   // not a current target or shared snapshot. No source authority is fabricated.
   const data={...d.home_facts,canonical_device_id:'KIOSK_08',publication_id:id(99),projection_id:id(98),shift:{start:'11:00',end:'19:00'}};
   memory.set('mz_custodial_home_cache:'+encodeURIComponent(homeBinding(identity))+':facts',JSON.stringify({schema_version:'custodial-home-facts.v2-original-hub',binding:homeBinding(identity),records:{schedule:{data,received_at:new Date().toISOString()}}}));
  }
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=> 'v6-dom',profileMatchesPrincipal:()=>true}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.fetch=async()=>{throw Error('provider offline');};
  app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,
   security:{native,getStatus:()=>{if(broken)throw Error('synthetic status error');return status;},mutateProtectedWork:async fn=>fn()},
   requestJson:async()=>{if(historical)throw Error('offline');return structuredClone(d);}});
  await app.update(true);
  if(historical){assert.equal(el('home-shift').textContent,'Schedule unavailable');return;}
  assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');broken=throws;
  assert.doesNotThrow(()=>events.get('memphis:custodial-security-state')({detail:{ready:positive,available:positive,quarantined:!positive}}));
  assert.equal(el('home-shift').textContent,'Schedule unavailable');broken=false;
  await app.update(true);events.get('storage')({key:null});assert.equal(el('home-shift').textContent,'Schedule unavailable');
  events.get('memphis:custodial-security-state')({detail:status});await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
 }finally{app?.stop();for(const [k,v]of old){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
for(const native of [false,true])await test('H03 historical V4 flattened Home cache no shared row '+(native?'native':'browser'),()=>homeDom({native,historical:true}));
for(const positive of [false,true])await test('H04 Home throwing status on '+(positive?'positive':'negative')+' event',()=>homeDom({throws:true,positive}));
console.log(JSON.stringify({scope:'V5 H01-H05 actual Schedule/Home owners; synthetic storage/auth/events; no phone or runtime acceptance',passed:cases.filter(x=>x.passed).length,failed:cases.filter(x=>!x.passed).length,cases},null,2));
if(cases.some(x=>!x.passed))process.exitCode=1;
