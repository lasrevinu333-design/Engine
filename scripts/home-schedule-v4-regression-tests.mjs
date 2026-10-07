import assert from 'node:assert/strict';
import {fixture,payload,day,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
const cases=[];
async function test(name,run){try{await run();cases.push({name,passed:true});}catch(error){cases.push({name,passed:false,error:error.message.slice(0,400)});}}
const legacy=(revision,letter='A')=>{
 const value=payload(revision);delete value.recurring_delivery;value.schedule_delivery_mode='LEGACY_REGISTERED';
 value.raw_items=[{name:'Legacy '+letter,coverage_start:'07:00',coverage_end:'16:00'}];
 value.schedule_application={application_status:'PENDING',authority_revision:revision,intent_id:id(letter==='A'?71:72),
  publication_id:id(4),projection_id:id(letter==='A'?5:6),lunch_document_identity:'a'.repeat(64)};
 value.projection_id=value.schedule_application.projection_id;
 value.home_facts={service_date:day,employee_id:id(2),publication_id:id(4),projection_id:value.projection_id,projection_status:'current',shift:{start:letter==='A'?'07:00':'08:00',end:'16:00'}};
 return value;
};
for(const value of ['null','false','0','""'])await test('falsy JSON '+value,async()=>{
 const f=fixture();f.stored.set(key,value);await f.load();assert.equal(f.stored.get(key),value);assert.equal(f.node('content').hidden,true);
});
await test('Schedule observed disk winner survives cache deletion',async()=>{
 const f=fixture();await f.load();await f.put(payload(22,true));f.context.testPage.snapshot();f.stored.delete(key);
 f.next=payload(21);await f.load();assert.equal(f.node('content').hidden,true);assert.notEqual(f.cache()?.recurring_target?.target?.authorityRevision,21);
});
await test('Schedule equal revision different legacy target cannot render or ACK',async()=>{
 const f=fixture();f.next=legacy(30);await f.load();await new Promise(r=>setTimeout(r,10));f.calls.length=0;
 f.next=legacy(30,'B');await f.load();await new Promise(r=>setTimeout(r,10));
 assert.ok(!f.node('areas').innerHTML.includes('Legacy B'));assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));
});
await test('Schedule quarantine persists through storage and online paths',async()=>{
 const f=fixture();await f.load();f.status={ready:false,available:false,quarantined:true};
 f.events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});
 f.events.get('storage')({key});await f.load();assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
});
await test('Schedule UNAVAILABLE does not render duplicate old areas',async()=>{
 const f=fixture();f.next={...legacy(30),schedule_delivery_mode:'UNAVAILABLE'};await f.load();
 assert.equal(f.node('content').hidden,true);assert.ok(!f.node('areas').innerHTML.includes('Legacy'));
});
await test('Schedule unknown typed mode is not persisted',async()=>{
 const f=fixture();f.next={...payload(30),schedule_delivery_mode:'RECURRING_GARBAGE'};await f.load();assert.equal(f.cache(),null);assert.ok([...f.stored].every(([k,v])=>k.startsWith('mz_employee_schedule_snapshot:availability:')&&JSON.parse(v).state==='READING'));assert.equal(f.node('content').hidden,true);
});
await test('Schedule unavailable stays unavailable through storage/failed refresh',async()=>{
 const f=fixture();await f.load();f.next={...payload(30),schedule_delivery_mode:'UNAVAILABLE'};await f.load();
 f.events.get('storage')({key});await f.load();assert.equal(f.node('content').hidden,true);
 f.next=payload(31);await f.load();const end=Date.now()+1500;
 while(f.node('content').hidden&&Date.now()<end)await new Promise(r=>setTimeout(r,5));assert.equal(f.node('content').hidden,false);
});
await test('Schedule same legacy target may advance only receipt status',async()=>{
 const f=fixture();f.next=legacy(30);await f.load();const same=legacy(30);same.schedule_application.application_status='DEVICE_REPORTED_APPLIED';
 f.next=same;await f.load();assert.ok(f.node('areas').innerHTML.includes('Legacy A'));
});
await test('Schedule legacy render bytes cannot change at same revision',async()=>{
 const f=fixture();f.next=legacy(30);await f.load();const changed=legacy(30);changed.raw_items[0].name='Wrong';f.next=changed;await f.load();
 assert.ok(!f.node('areas').innerHTML.includes('Wrong'));
});
function homeFixture(){
 const memory=new Map();const who={deviceId:'KIOSK_08',employeeId:id(2),credentialId:id(3),assignmentEpoch:7,employeeName:'Synthetic',protectedBinding:'home-v4'};
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const owner=createScheduleHomeConvergence({identity:()=>who,storage,mutate:async fn=>fn(),matches:()=>true,now:()=>Date.parse(day+'T17:00:00Z')});
 return {owner,memory,who,storage,key:'mz_employee_schedule_snapshot:home-v4'};
}
await test('Home observed disk winner survives cache deletion',async()=>{
 const f=homeFixture();await f.owner.accept(payload(21),f.who);
 const other=homeFixture();await other.owner.accept(payload(22,true),other.who);f.memory.set(f.key,other.memory.get(other.key));
 assert.equal(f.owner.resolve(f.who,null).projection_status,'blocked_recurring_authority');f.memory.delete(f.key);
 assert.equal(f.owner.resolve(f.who,null).projection_status,'blocked_recurring_authority');
 await assert.rejects(()=>f.owner.accept(payload(21),f.who));
});
await test('Home lower legacy response cannot replace shared higher legacy',async()=>{
 const f=homeFixture();f.memory.set(f.key,JSON.stringify({schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal:'home-v4',data:legacy(30)}));
 await assert.rejects(()=>f.owner.accept(legacy(29,'B'),f.who));
 assert.equal(f.owner.resolve(f.who,null)?.shift?.start,'07:00');
});
await test('Home equal revision changed legacy identity is rejected',async()=>{
 const f=homeFixture();await f.owner.accept(legacy(30),f.who);await assert.rejects(()=>f.owner.accept(legacy(30,'B'),f.who));
});
await test('Home UNAVAILABLE rejects duplicate facts',async()=>{
 const f=homeFixture();const result=await f.owner.accept({...legacy(30),schedule_delivery_mode:'UNAVAILABLE'},f.who);
 assert.equal(result.shift,null);assert.equal(result.stale,true);
});
await test('Home unknown recurring mode rejected without persistence',async()=>{
 const f=homeFixture();await assert.rejects(()=>f.owner.accept({...payload(30),schedule_delivery_mode:'RECURRING_GARBAGE'},f.who));assert.equal(f.memory.size,0);
});
await test('Home higher legacy winner survives storage deletion',async()=>{
 const f=homeFixture();await f.owner.accept(legacy(29,'B'),f.who);
 f.memory.set(f.key,JSON.stringify({schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal:'home-v4',data:legacy(30)}));
 assert.equal(f.owner.resolve(f.who,null).shift.start,'07:00');f.memory.delete(f.key);
 assert.equal(f.owner.resolve(f.who,null).shift.start,'07:00');
});
await test('Home legacy mutated while waiting cannot change accepted bytes',async()=>{
 const f=homeFixture(),next=legacy(30);let release;
 const held=new Promise(r=>{release=r;});
 const owner=createScheduleHomeConvergence({identity:()=>f.who,storage:f.storage,matches:()=>true,
  now:()=>Date.parse(day+'T17:00:00Z'),mutate:async fn=>{await held;return fn();}});
 const reading=owner.accept(next,f.who);next.raw_items[0].name='Injected';release();await reading;
 assert.equal(JSON.parse(f.memory.get(f.key)).data.raw_items[0].name,'Legacy A');
});
console.log(JSON.stringify({scope:'V3 five owning findings; actual Schedule inline and Home convergence; synthetic storage/auth/time',passed:cases.filter(x=>x.passed).length,failed:cases.filter(x=>!x.passed).length,cases},null,2));
if(cases.some(x=>!x.passed))process.exitCode=1;
