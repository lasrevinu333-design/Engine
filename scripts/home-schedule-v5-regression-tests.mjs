import assert from 'node:assert/strict';
import {fixture,payload,day,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const cases=[];
async function test(name,run){try{await run();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:e.message.slice(0,600)});}}
const legacy=(revision=30)=>{
 const d=payload(revision);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';
 d.schedule_application={application_status:'PENDING',authority_revision:revision,intent_id:id(71),publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 d.home_facts={service_date:day,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:{start:'07:00',end:'16:00'}};return d;
};
const row=(data,principal='race-principal')=>({schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal,data});
const settled=()=>new Promise(r=>setTimeout(r,30));
function home(){
 const memory=new Map(),who={deviceId:'KIOSK_08',employeeId:id(2),credentialId:id(3),assignmentEpoch:7,employeeName:'Synthetic',protectedBinding:'v5-home'};
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const owner=createScheduleHomeConvergence({identity:()=>who,storage,mutate:async fn=>fn(),matches:d=>d.employee_id===who.employeeId,now:()=>Date.parse(day+'T17:00:00Z')});
 return {memory,who,owner,key:'mz_employee_schedule_snapshot:v5-home'};
}
for(const mutation of ['missing typed target','terminal paired legacy','changed render bytes','unknown cache mode','missing full-day array']){
 await test('F1 rejects '+mutation,async()=>{
  const f=fixture();await f.put(payload(30,mutation==='terminal paired legacy'));let r=f.cache();
  if(mutation==='missing typed target'){delete r.recurring_target;r.data.schedule_delivery_mode='RECURRING_TERMINAL';}
  if(mutation==='terminal paired legacy')r.data=legacy(30);
  if(mutation==='changed render bytes')r.data.raw_items[0].name='Injected Area';
  if(mutation==='unknown cache mode'){r=row(legacy(30));r.data.schedule_delivery_mode='RECURRING_GARBAGE';}
  if(mutation==='missing full-day array'){r=row(legacy(30));r.data.current_items=r.data.raw_items;delete r.data.raw_items;}
  f.stored.set(key,JSON.stringify(r));assert.throws(()=>f.context.testPage.snapshot());
  await f.load();assert.equal(f.node('content').hidden,true);assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));
 });
}
await test('F1 malformed full-day live response never writes or ACKs',async()=>{
 const f=fixture();f.next=legacy();const d=legacy();delete d.raw_items;d.current_items=[{name:'Legacy B',coverage_start:'07:00',coverage_end:'16:00'}];f.next=d;await f.load();await settled();
 assert.equal(f.cache(),null);assert.ok([...f.stored].every(([k,v])=>k.startsWith('mz_employee_schedule_snapshot:availability:')&&JSON.parse(v).state==='READING'));assert.equal(f.node('content').hidden,true);assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));
});
await test('F2 Schedule malformed service date is not expired authority',async()=>{
 const f=fixture(),d=legacy(99);d.service_date='not-a-date';f.stored.set(key,JSON.stringify(row(d)));await f.load();
 assert.equal(f.cache().data.service_date,'not-a-date');assert.equal(f.node('content').hidden,true);
});
await test('F2 Home malformed date cannot be replaced by lower authority',async()=>{
 const f=home(),d=legacy(99);d.service_date='not-a-date';f.memory.set(f.key,JSON.stringify(row(d,f.who.protectedBinding)));
 await assert.rejects(()=>f.owner.accept(legacy(1),f.who));
});
await test('F2 valid previous day may expire',async()=>{
 const f=fixture(),d=legacy(99);d.service_date='2026-09-27';f.stored.set(key,JSON.stringify(row(d)));await f.load();
 assert.equal(f.cache().data.service_date,day);assert.equal(f.node('content').hidden,false);
});
await test('F3 lower disk cannot confirm higher live, exact disk can reconfirm',async()=>{
 const f=fixture();f.next=payload(22);await f.load();const exact=f.stored.get(key);await f.put(payload(21));
 assert.equal(f.context.testPage.snapshot().cache_unconfirmed,true);
 f.stored.delete(key);assert.equal(f.context.testPage.snapshot().cache_unconfirmed,true);
 f.stored.set(key,exact);assert.notEqual(f.context.testPage.snapshot().cache_unconfirmed,true);
});
await test('F3 post-save disk rollback forbids application receipt',async()=>{
 const f=fixture();f.next=legacy(30);f.after=()=>f.stored.set(key,JSON.stringify(row(legacy(29))));await f.load();await settled();
 assert.equal(f.context.testPage.snapshot().cache_unconfirmed,true);assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));
});
await test('F3 Home lower disk is stale, exact restoration reconfirms',async()=>{
 const f=home();await f.owner.accept(legacy(30),f.who);const exact=f.memory.get(f.key);
 f.memory.set(f.key,JSON.stringify(row(legacy(29),f.who.protectedBinding)));assert.equal(f.owner.resolve(f.who,null).stale,true);
 f.memory.delete(f.key);assert.equal(f.owner.resolve(f.who,null).stale,true);
 f.memory.set(f.key,exact);assert.equal(f.owner.resolve(f.who,null).stale,false);
});
await test('F4 equal authority PENDING cannot regress receipt or duplicate ACK',async()=>{
 const f=fixture(),d=legacy();d.schedule_application.application_status='DEVICE_REPORTED_APPLIED';d.schedule_application.received_at='2026-09-28T17:00:00Z';
 f.next=d;await f.load();f.calls.length=0;f.next=legacy();await f.load();await settled();
 assert.equal(f.cache().data.schedule_application.application_status,'DEVICE_REPORTED_APPLIED');
 assert.equal(f.cache().data.schedule_application.received_at,d.schedule_application.received_at);assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));
});
await test('F4 disk advanced receipt beats stale same-revision live',async()=>{
 const f=fixture();f.next=legacy();await f.load();await settled();f.calls.length=0;
 const r=f.cache();r.data.schedule_application.application_status='DEVICE_REPORTED_APPLIED';r.data.schedule_application.received_at='2026-09-28T17:00:00Z';f.stored.set(key,JSON.stringify(r));
 assert.equal(f.context.testPage.snapshot().data.schedule_application.application_status,'DEVICE_REPORTED_APPLIED');
 f.stored.delete(key);assert.equal(f.context.testPage.snapshot().data.schedule_application.application_status,'DEVICE_REPORTED_APPLIED');
});
await test('F5 Home rejects different legacy supplemental publication/projection',async()=>{
 const f=home(),d=legacy();d.home_facts.publication_id=id(99);d.home_facts.projection_id=id(98);d.home_facts.shift={start:'11:00',end:'19:00'};
 const result=await f.owner.accept(d,f.who);assert.equal(result.shift,null);assert.equal(result.stale,true);
});
await test('F6 Schedule positive event while status blocked cannot unlock later',async()=>{
 const f=fixture();await f.load();const event=f.events.get('memphis:custodial-security-state');
 f.status={ready:false,available:false,quarantined:true};event({detail:{ready:false,available:false,quarantined:true}});
 event({detail:{ready:true,available:true,quarantined:false}});await settled();f.status={ready:true,available:true,quarantined:false};
 f.events.get('storage')({key});await f.load();await settled();assert.equal(f.node('content').hidden,true);
 event({detail:{ready:true,available:true,quarantined:false}});await settled();assert.equal(f.node('content').hidden,false);
});
await test('F7 exact UNAVAILABLE latches despite corrupt disk',async()=>{
 const f=home();await f.owner.accept(legacy(),f.who);f.memory.set(f.key,'false');
 await f.owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},f.who).catch(()=>{});f.memory.delete(f.key);
 assert.equal(f.owner.resolve(f.who,null).shift,null);await f.owner.accept(legacy(31),f.who);assert.equal(f.owner.resolve(f.who,null).shift.start,'07:00');
});
await test('F6 actual Home DOM requires positive event AND current healthy status',async()=>{
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'];const old=names.map(k=>[k,globalThis[k]]);
 let app;try{
  const nodes=new Map(),events=new Map(),storage=new Map();const el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  let status={ready:true,available:true,quarantined:false};const d=legacy();d.service_date=d.home_facts.service_date=zooServiceDate();
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=> 'v5-dom',profileMatchesPrincipal:()=>true}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.fetch=async()=>{throw Error('unrelated provider offline');};
  app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security:{native:true,getStatus:()=>status,mutateProtectedWork:async fn=>fn()},requestJson:async()=>structuredClone(d)});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
  status={ready:false,available:false,quarantined:true};events.get('memphis:custodial-security-state')({detail:status});
  events.get('memphis:custodial-security-state')({detail:{ready:true,available:true,quarantined:false}});
  status={ready:true,available:true,quarantined:false};await app.update(true);events.get('storage')({key:null});
  assert.equal(el('home-shift').textContent,'Schedule unavailable');
  events.get('memphis:custodial-security-state')({detail:status});await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
 }finally{app?.stop();for(const [k,v]of old){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
console.log(JSON.stringify({scope:'V4 seven exact owning defects; actual Schedule/Home owners with synthetic storage/auth/DOM; no runtime acceptance',passed:cases.filter(x=>x.passed).length,failed:cases.filter(x=>!x.passed).length,cases},null,2));
if(cases.some(x=>!x.passed))process.exitCode=1;
