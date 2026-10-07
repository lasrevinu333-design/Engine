import assert from 'node:assert/strict';
import './synthetic-schedule-locks.mjs';
import {fixture,payload,day,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const cases=[],pause=()=>new Promise(r=>setTimeout(r,40));
async function test(name,work){try{await work();cases.push({name,pass:true});}catch(e){cases.push({name,pass:false,error:e.stack.slice(0,1200)});}}
const who={deviceId:'KIOSK_08',employeeId:id(2),employeeName:'Fixture',credentialId:id(3),assignmentEpoch:7,protectedBinding:'race-principal'};
function home(memory,mutate=async fn=>fn()){
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 return {storage,owner:createScheduleHomeConvergence({identity:()=>who,storage,mutate,matches:d=>d.employee_id===id(2),now:()=>Date.parse(day+'T17:00:00Z')})};
}
function legacy(revision=30,start='07:00'){
 const d=payload(revision);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.raw_items[0].name=start==='07:00'?'Old Area':'New Area';d.shift={start,end:'16:00'};
 d.schedule_application={authority_revision:revision,application_status:'DEVICE_REPORTED_APPLIED',received_at:day+'T17:00:00Z',intent_id:id(71),publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 d.home_facts={service_date:day,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:d.shift};return d;
}
const faults=['throw invocation','quarantine invocation','throw second property'];
function transition(kind,healthy){let calls=0,reads=0;return()=>{
 calls++;if(kind==='throw invocation'&&calls===2)throw Error('status transition');
 if(kind==='quarantine invocation'&&calls===2)return{...healthy(),ready:false,quarantined:true};
 if(kind==='throw second property')return Object.defineProperty({...healthy()},'ready',{get(){if(++reads===2)throw Error('property transition');return true;}});
 return healthy();
};}
for(const fault of faults)await test('V7-01 Schedule '+fault,async()=>{
 const f=fixture();await f.load();const security=f.context.window.MemphisCustodialSecurity,healthy=security.getStatus;
 security.getStatus=transition(fault,healthy);f.events.get('storage')({key});
 assert.equal(f.node('content').hidden,true,'failed transition immediately hides prior content');
 security.getStatus=healthy;await f.load();assert.equal(f.node('content').hidden,true,'getter recovery alone cannot reauthorize');
 f.events.get('memphis:custodial-security-state')({detail:healthy()});await pause();assert.equal(f.node('content').hidden,false);
});
for(const fault of faults)await test('V7-01 Home '+fault,async()=>{
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const nodes=new Map(),events=new Map(),memory=new Map(),el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const healthy=()=>({ready:true,available:true,quarantined:false}),security={native:true,getStatus:healthy,mutateProtectedWork:async fn=>fn()};
  const d=legacy();d.service_date=d.home_facts.service_date=zooServiceDate();
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=> 'v8-dom',profileMatchesPrincipal:()=>true}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.fetch=async()=>{throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,requestJson:async()=>structuredClone(d)});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
  security.getStatus=transition(fault,healthy);events.get('storage')({key:'mz_employee_schedule_snapshot:v8-dom'});
  assert.equal(el('home-shift').textContent,'Schedule unavailable');
  security.getStatus=healthy;await app.update(true);assert.equal(el('home-shift').textContent,'Schedule unavailable');
  events.get('memphis:custodial-security-state')({detail:healthy()});await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
for(const consumer of ['Home','Schedule'])for(const terminal of [false,true])await test('V7-02 '+consumer+' actual writer '+(terminal?'terminal':'current')+' interleaving',async()=>{
 const page=fixture(),seed=home(page.stored);await seed.owner.accept(legacy(),who);
 const ticket=await seed.owner.begin(who);let commit,entered;
 const enteredPromise=new Promise(r=>entered=r);
 const writer=home(page.stored,fn=>new Promise((resolve,reject)=>{commit=()=>{try{resolve(fn());}catch(e){reject(e);throw e;}};entered();}));
 const writing=writer.owner.accept(terminal?payload(31,true):legacy(31,'09:00'),who,{observedAvailability:ticket});writing.catch(()=>{});
 await enteredPromise;
 const reader=consumer==='Home'?home(page.stored):null,storage=reader?.storage??page.context.localStorage,original=storage.getItem;
 let fired=false;
 storage.getItem=k=>{const selected=original(k);if(k===key&&!fired){fired=true;commit();}return selected;};
 if(reader){const result=reader.owner.resolve(who,null);assert.ok(terminal?result.shift===null:result.shift===null||result.shift.start==='09:00','old row cannot borrow new fence');}
 else{page.context.fetch=()=>new Promise(()=>{});page.events.get('storage')({key});
  assert.ok(page.node('content').hidden||!page.node('areas').innerHTML.includes('Old Area'),'old area never repainted under new fence');page.events.get('pagehide')();}
 await writing;assert.equal(fired,true);assert.equal(JSON.parse(page.stored.get(key)).data.schedule_delivery_mode,terminal?'RECURRING_TERMINAL':'LEGACY_REGISTERED');
});
console.log(JSON.stringify({scope:'actual Home/Schedule V7-01/V7-02 changed-input source, synthetic security/storage interleavings only',passed:cases.filter(x=>x.pass).length,failed:cases.filter(x=>!x.pass).length,cases},null,2));
if(cases.some(x=>!x.pass))process.exitCode=1;
