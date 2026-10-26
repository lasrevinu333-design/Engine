import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import './synthetic-schedule-locks.mjs';
import {fixture,payload,day,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const cases=[];const pause=()=>new Promise(r=>setTimeout(r,40));
async function test(name,run){try{await run();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:e.stack.slice(0,1200)});}}
const who={deviceId:'KIOSK_08',employeeId:id(2),employeeName:'Fixture',credentialId:id(3),assignmentEpoch:7,protectedBinding:'race-principal'};
function home(memory=new Map(),mutate=async fn=>fn()){
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const owner=createScheduleHomeConvergence({identity:()=>who,storage,mutate,matches:d=>d.employee_id===who.employeeId,now:()=>Date.parse(day+'T17:00:00Z')});
 return{owner,memory,storage};
}
const legacy=(revision=30)=>{const d=payload(revision);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.schedule_application={application_status:'DEVICE_REPORTED_APPLIED',received_at:day+'T17:00:00Z',authority_revision:revision,intent_id:id(71),publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 d.home_facts={service_date:day,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:{start:'07:00',end:'16:00'}};return d;};
const statusCases=[['throw',()=>{throw Error('status unavailable');}],['missing',undefined],['noncallable',true],['null',()=>null],['empty',()=>({})],['primitive',()=>true],
 ...['ready','available','quarantined'].map(k=>['throw-'+k,()=>Object.defineProperty({ready:true,available:true,quarantined:false},k,{get(){throw Error(k);}})])];
for(const [name,getter]of statusCases)await test('V6-03 Schedule exact storage redraw '+name,async()=>{
 const f=fixture();await f.load();assert.equal(f.node('content').hidden,false);
 const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus;security.getStatus=getter;
 assert.doesNotThrow(()=>f.events.get('storage')({key}));assert.equal(f.node('content').hidden,true);
 security.getStatus=original;await f.load();assert.equal(f.node('content').hidden,true,'healthy getter alone cannot recover');
 f.events.get('memphis:custodial-security-state')({detail:{ready:true,available:true,quarantined:false}});await pause();assert.equal(f.node('content').hidden,false);
});
for(const [name,getter]of statusCases)await test('V6-03 Home exact storage redraw '+name,async()=>{
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],old=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const nodes=new Map(),events=new Map(),memory=new Map(),el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const d=legacy();d.service_date=d.home_facts.service_date=zooServiceDate();
  const security={native:true,getStatus:()=>({ready:true,available:true,quarantined:false}),mutateProtectedWork:async fn=>fn()},original=security.getStatus;
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=> 'v7-dom',profileMatchesPrincipal:()=>true}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.fetch=async()=>{throw Error('provider offline');};
  app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,requestJson:async()=>structuredClone(d)});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');security.getStatus=getter;
  assert.doesNotThrow(()=>events.get('storage')({key:'mz_employee_schedule_snapshot:v7-dom'}));assert.equal(el('home-shift').textContent,'Schedule unavailable');
  security.getStatus=original;await app.update(true);assert.equal(el('home-shift').textContent,'Schedule unavailable');
  events.get('memphis:custodial-security-state')({detail:original()});await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
 }finally{app?.stop();for(const[k,v]of old){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
for(const stale of [undefined,false,true,'yes',{}])await test('V6-02 typed top-level stale cannot alter presentation '+JSON.stringify(stale),async()=>{
 const f=fixture(),d=payload(30);d.stale=stale;f.next=d;await f.load();assert.equal(f.node('state-text').textContent,'');
 const h=home(),good=payload(30);good.home_facts=legacy().home_facts;good.stale=stale;
 const result=await h.owner.accept(good,who);assert.equal(result.stale,false);
});
for(const stale of ['yes',{},1])await test('V6-02 legacy nonboolean stale cannot persist '+JSON.stringify(stale),async()=>{
 const f=fixture(),d=legacy();f.next=d;await f.load();const before=f.stored.get(key);f.next={...d,stale};await f.load();assert.equal(f.stored.get(key),before);
});
await test('V6-05 Schedule failed read-ahead plus unknown presence stays unavailable',async()=>{
 const f=fixture();await f.put(payload(30));f.calls.length=0;const original=f.context.localStorage.getItem;
 let failPresence=false;f.context.localStorage.setItem=()=>{failPresence=true;throw Error('write failed');};
 f.context.localStorage.getItem=k=>{if(k===key&&failPresence){failPresence=false;throw Error('presence unknown');}return original(k);};
 await f.load();assert.equal(f.calls.includes('GET'),false);assert.equal(f.node('content').hidden,true);
});
await test('V6-05 Home failed read-ahead plus unknown presence stays unavailable',async()=>{
 const h=home();await h.owner.accept(legacy(),who);h.memory.delete('mz_employee_schedule_snapshot:availability:race-principal');
 let failPresence=false;const original=h.storage.getItem;h.storage.setItem=()=>{failPresence=true;throw Error('write failed');};
 h.storage.getItem=k=>{if(k===key&&failPresence){failPresence=false;throw Error('presence unknown');}return original(k);};
 await assert.rejects(()=>h.owner.begin(who));assert.equal(h.owner.resolve(who,null).shift,null);
});
for(const changed of ['view','target'])await test('V6-01 cached '+changed+' bytes must match claimed digest before ordering',async()=>{
 const f=fixture();await f.put(payload(30));const row=f.cache();
 if(changed==='view'){
  const view=JSON.parse(row.recurring_target.viewJsonText);view.raw_items[0].name='FORGED AREA';
  row.recurring_target.view=view;row.recurring_target.viewJsonText=JSON.stringify(view);
  row.data.raw_items=view.raw_items;row.data.recurring_delivery.viewJsonText=JSON.stringify(view);
 }else{row.recurring_target.target.authorityRevision=999;row.data.recurring_delivery.target.authorityRevision=999;}
 f.stored.set(key,JSON.stringify(row));assert.throws(()=>f.context.testPage.snapshot(),/digest/);
 const h=home(f.stored);assert.equal(h.owner.resolve(who,null).shift,null);
});
await test('V6-01 exact valid cached typed control remains usable',async()=>{
 const f=fixture();await f.put(payload(30));assert.equal(f.context.testPage.snapshot().recurring_target.target.authorityRevision,30);
});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const typed=n=>({...payload(n),home_facts:legacy(n).home_facts});
const unavailable=()=>({...typed(30),schedule_delivery_mode:'UNAVAILABLE'});
for(const n of [0,1,55,56,63,64,65,119,120,127,128,129,1024,65536,1000000])await test('V6-01 SHA256 ASCII length '+n,async()=>{
 const s='a'.repeat(n);assert.equal(globalThis.MemphisRecurringScheduleTarget.sha256Text(s),createHash('sha256').update(s).digest('hex'));
});
for(const s of ['abc','Memphis 🐘 Zoo español','\u0000\ud800\udfff\ufffd','雪'.repeat(1000)])await test('V6-01 SHA256 UTF8 '+s.slice(0,25),async()=>{
 assert.equal(globalThis.MemphisRecurringScheduleTarget.sha256Text(s),createHash('sha256').update(s).digest('hex'));
});
for(const value of [null,{},'a'.repeat(4*1024*1024+1)])await test('V6-01 bounded SHA input '+typeof value,async()=>{
 assert.throws(()=>globalThis.MemphisRecurringScheduleTarget.sha256Text(value),/schedule_digest_input_invalid/);
});
for(const unavailableLock of [undefined,{}, {request:()=>Promise.reject(Error('disabled'))},Object.defineProperty({},'request',{get(){throw Error('blocked');}})])await test('V6-04 unavailable lock fails closed '+cases.length,async()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis.navigator,'locks');
 try{Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:unavailableLock});
  const h=home();await assert.rejects(()=>h.owner.begin(who),/schedule_atomic_storage_unavailable/);
  await assert.rejects(()=>h.owner.accept(typed(30),who),/schedule_atomic_storage_unavailable/);assert.equal(h.memory.size,0);
 }finally{Object.defineProperty(globalThis.navigator,'locks',saved);}
});
await test('V6-04 Schedule cannot fetch or revive cache without cross-document lock',async()=>{
 const f=fixture();await f.load();f.calls.length=0;f.context.window.navigator={};await f.load();
 assert.equal(f.calls.includes('GET'),false);assert.equal(f.node('content').hidden,true);
});
for(const action of ['UNAVAILABLE','newer snapshot','cancel'])await test('V6-04 locked winner prevents stale '+action+' interleaving',async()=>{
 const memory=new Map(),seed=home(memory);await seed.owner.accept(typed(29),who);const ticket=await seed.owner.begin(who);
 const entered=deferred(),release=deferred();let pauseOnce=true;
 const b=home(memory,async fn=>{if(pauseOnce){pauseOnce=false;entered.resolve();await release.promise;}return fn();});
 const a=home(memory),newer=action==='UNAVAILABLE'?unavailable():typed(31);
 const win=b.owner.accept(newer,who,{observedAvailability:ticket});await entered.promise;
 let settled=false;
 const stale=(action==='cancel'?a.owner.cancel(who,ticket):a.owner.accept(typed(30),who,{observedAvailability:ticket}))
  .then(()=>({ok:true}),error=>({error})).finally(()=>settled=true);
 await pause();const enteredEarly=settled;release.resolve();await win;assert.equal(enteredEarly,false,'other consumer must not enter held transaction');
 const exact=[memory.get(key),memory.get('mz_employee_schedule_snapshot:availability:race-principal')];
 const result=await stale;assert.match(result.error?.code||'',/schedule_request_invalidated/);
 assert.deepEqual([memory.get(key),memory.get('mz_employee_schedule_snapshot:availability:race-principal')],exact,'winner snapshot/fence pair unchanged');
 assert.equal(a.owner.resolve(who,null).shift?.start??null,action==='UNAVAILABLE'?null:'07:00');
});
await test('V6-04 second writer cannot enter during first snapshot write',async()=>{
 const memory=new Map(),a=home(memory),b=home(memory);await a.owner.accept(typed(29),who);const ticket=await a.owner.begin(who);
 let competing,inside=false,enteredWhileInside=false,attempted=false;
 const other=home(memory,async fn=>{if(inside)enteredWhileInside=true;return fn();});
 const original=a.storage.setItem;a.storage.setItem=(k,v)=>{if(k===key&&!attempted){attempted=true;inside=true;
  competing=other.owner.accept(unavailable(),who,{observedAvailability:ticket}).then(()=>({ok:true}),error=>({error}));
  original(k,v);inside=false;}else original(k,v);};
 await a.owner.accept(typed(30),who,{observedAvailability:ticket});assert.equal(attempted,true);assert.equal(enteredWhileInside,false);
 assert.match((await competing).error?.code||'',/schedule_request_invalidated/);
 const fresh=await b.owner.begin(who);await b.owner.accept(typed(31),who,{observedAvailability:fresh});
 assert.equal(JSON.parse(memory.get(key)).recurring_target.target.authorityRevision,31);
 assert.equal(a.owner.capture(who).state,'AVAILABLE');
});
await test('V6-06 already-open Home recovers after other consumer validates newer AVAILABLE',async()=>{
 const a=home();await a.owner.accept(typed(30),who);await a.owner.accept(unavailable(),who);assert.equal(a.owner.resolve(who,null).shift,null);
 const b=home(a.memory),ticket=await b.owner.begin(who);await b.owner.accept(typed(31),who,{observedAvailability:ticket});
 assert.equal(a.owner.resolve(who,null).shift.start,'07:00');
});
await test('V6-06 failed local UNAVAILABLE save recovers only after newer durable stamp',async()=>{
 const a=home();await a.owner.accept(typed(30),who);const old=a.owner.capture(who),set=a.storage.setItem;
 a.storage.setItem=()=>{throw Error('disk unavailable');};await assert.rejects(()=>a.owner.accept(unavailable(),who));
 a.storage.setItem=set;assert.equal(a.owner.resolve(who,null).shift,null);
 const b=home(a.memory),ticket=await b.owner.begin(who);await b.owner.accept(typed(31),who,{observedAvailability:ticket});
 assert.notEqual(b.owner.capture(who).stamp,old?.stamp);assert.equal(a.owner.resolve(who,null).shift.start,'07:00');
});
await test('V6-06 rejected stale UNAVAILABLE does not poison newer Home',async()=>{
 const a=home();await a.owner.accept(typed(30),who);const ticket=await a.owner.begin(who),b=home(a.memory);
 await b.owner.accept(typed(31),who,{observedAvailability:ticket});const exact=[...a.memory];
 await assert.rejects(()=>a.owner.accept(unavailable(),who,{observedAvailability:ticket}),/schedule_request_invalidated/);
 assert.deepEqual([...a.memory],exact);assert.equal(a.owner.resolve(who,null).shift.start,'07:00');
});
await test('V6-06 already-open Schedule redraw recovers from Home newer AVAILABLE',async()=>{
 const f=fixture();f.next=typed(30);await f.load();f.next=unavailable();await f.load();assert.equal(f.node('content').hidden,true);
 const h=home(f.stored),ticket=await h.owner.begin(who);await h.owner.accept(typed(31),who,{observedAvailability:ticket});
 f.context.fetch=async()=>{throw Error('offline');};f.events.get('storage')({key});await pause();
 assert.equal(f.node('content').hidden,false);assert.equal(f.cache().recurring_target.target.authorityRevision,31);
});
await test('V6-06 stale Schedule UNAVAILABLE cannot hide newer Home winner',async()=>{
 const f=fixture();f.next=typed(30);await f.load();const reached=deferred(),release=deferred();
 f.context.fetch=async()=>{reached.resolve();await release.promise;return{ok:true,json:async()=>({ok:true,data:unavailable()})};};
 const request=f.load();await reached.promise;const h=home(f.stored),ticket=await h.owner.begin(who);
 await h.owner.accept(typed(31),who,{observedAvailability:ticket});const exact=[...f.stored];release.resolve();await request;
 assert.deepEqual([...f.stored],exact);assert.equal(f.node('content').hidden,false);assert.equal(f.cache().recurring_target.target.authorityRevision,31);
});
console.log(JSON.stringify({scope:'V6-01 through V6-06 owning source hostile regressions; synthetic DOM/storage/FIFO Web Locks; no runtime PASS',passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,cases},null,2));
if(cases.some(c=>!c.passed))process.exitCode=1;
