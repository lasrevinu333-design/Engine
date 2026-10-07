import assert from 'node:assert/strict';
import {fixture,payload,day,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const results=[],pause=()=>new Promise(r=>setTimeout(r,60));
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
function legacy(){const date=zooServiceDate(),d=payload(30,false,date);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.schedule_application={authority_revision:30,application_status:'PENDING',intent_id:id(71),publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 d.home_facts={service_date:date,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:d.shift};return d;}
async function withHome(work){
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const memory=new Map(),events=new Map(),nodes=new Map(),el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const healthy=()=>({ready:true,available:true,quarantined:false}),security={native:true,getStatus:healthy,mutateProtectedWork:async fn=>fn()};
  const mobile={principalIdentity:()=> 'v10-dom',profileMatchesPrincipal:()=>true},access={profile:()=>profile,device:()=> 'KIOSK_08',request:async()=>legacy()};
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:mobile};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.fetch=async()=>{throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>access.profile(),getDeviceId:()=>access.device(),isVisible:()=>true,security,requestJson:(...args)=>access.request(...args)});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
  const who={deviceId:'KIOSK_08',employeeId:id(2),employeeName:'Fixture',credentialId:id(3),assignmentEpoch:7,protectedBinding:'v10-dom'};
  const owner=createScheduleHomeConvergence({identity:()=>who,storage:globalThis.localStorage,mutate:security.mutateProtectedWork,matches:()=>true});
  await work({app,el,events,security,mobile,access,healthy,memory,who,owner,key:'mz_employee_schedule_snapshot:v10-dom',availabilityKey:'mz_employee_schedule_snapshot:availability:v10-dom'});
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
for(const modes of [[true,false,true],[true,true,false,true],[true,true,true],[false,true,false]])await test('V9-01 exact-key durable unavailable mode sequence '+modes.join(','),()=>withHome(async f=>{
 await f.owner.accept({...legacy(),schedule_delivery_mode:'UNAVAILABLE'},f.who,{observedAvailability:await f.owner.begin(f.who)});
 assert.equal(JSON.parse(f.memory.get(f.availabilityKey)).state,'UNAVAILABLE');
 let reads=0;Object.defineProperty(f.security,'native',{configurable:true,get:()=>modes[Math.min(reads++,modes.length-1)]});
 f.events.get('storage')({key:f.availabilityKey});
 assert.equal(f.el('home-shift').textContent,'Schedule unavailable','an exact fence event must not retain an old shift after any inner mismatch');
 assert.equal(f.el('home-schedule-freshness').dataset.stale,'true');
}));
for(const consumer of ['Home','Schedule'])for(const oldThrows of [false,true])await test('V9-02 '+consumer+' newer positive supersedes old '+(oldThrows?'throwing':'healthy')+' capture',async()=>{
 const work=async f=>{
  const healthy=f.security.getStatus;let armed=true;
  f.security.getStatus=()=>{const result=healthy();if(!armed)return result;armed=false;
   return Object.defineProperty(result,'ready',{get(){f.events.get('memphis:custodial-security-state')({detail:healthy()});if(oldThrows)throw Error('superseded read');return true;}});};
  f.events.get('memphis:custodial-security-state')({detail:healthy()});await pause();
  assert.equal(f.hidden(),false,'two positive events must recover without a third');
  assert.notEqual(f.state(),'Phone identity must be verified.','older handler cannot overwrite newer success');
 };
 if(consumer==='Home')await withHome(f=>work({...f,hidden:()=>f.el('home-shift').textContent==='Schedule unavailable',state:()=>f.el('home-schedule-freshness').textContent}));
 else{const f=fixture();try{await f.load();await work({...f,security:f.context.window.MemphisCustodialSecurity,hidden:()=>f.node('content').hidden,state:()=>f.node('state-text').textContent});}finally{f.events.get('pagehide')();}}
});
for(const prefix of ['mz_employee_schedule_snapshot:','mz_employee_schedule_snapshot:availability:'])for(const failure of ['throw','quarantine','property'])await test('V9-03 cold terminal wrong key '+prefix+' '+failure,async()=>{
 const f=fixture();try{f.next=payload(40,true);await f.load();assert.equal(f.node('notice').hidden,false);const notice=f.node('notice').textContent;
  let reads=0;const healthy=f.context.window.MemphisCustodialSecurity.getStatus;
  f.context.window.MemphisCustodialSecurity.getStatus=()=>{reads++;if(failure==='throw')throw Error('bad status');if(failure==='quarantine')return{ready:false,available:false,quarantined:true};return Object.defineProperty(healthy(),'ready',{get(){throw Error('bad property');}});};
  f.events.get('storage')({key:prefix+'other-principal'});
  assert.equal(reads,0);assert.equal(f.node('notice').hidden,false);assert.equal(f.node('notice').textContent,notice);
  f.events.get('storage')({key});assert.ok(reads>0);assert.equal(f.node('notice').hidden,true,'exact-key failure clears terminal');
  assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0,'typed terminal is never legacy ACK');
 }finally{f.events.get('pagehide')();}
});
for(const kind of ['changing','stable','throwing','statusless'])await test('V9-04 Home HTTP status '+kind,()=>withHome(async f=>{
 let reads=0;const error=new Error('request failed');
 if(kind!=='statusless')Object.defineProperty(error,'status',{get(){reads++;if(kind==='throwing')throw Error('status unreadable');return kind==='changing'&&reads>1?0:503;}});
 f.access.request=async()=>{throw error;};await f.app.update(true);
 assert.equal(reads,kind==='statusless'?0:1,'capture status only once');
 assert.equal(JSON.parse(f.memory.get(f.availabilityKey)).state,kind==='statusless'?'AVAILABLE':'READING');
 assert.equal(f.el('home-shift').textContent,kind==='statusless'?'7:00 AM–4:00 PM':'Schedule unavailable');
}));
console.log(JSON.stringify({scope:'V9-01..04 actual page owners, synthetic getter/event/transport seams; no browser/phone proof',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
