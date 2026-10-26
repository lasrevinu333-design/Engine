import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fixture,payload,day,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const results=[],pause=()=>new Promise(r=>setTimeout(r,50));
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
function legacy(date=day){const d=payload(30);delete d.recurring_delivery;d.service_date=date;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.schedule_application={authority_revision:30,application_status:'PENDING',intent_id:id(71),publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 d.home_facts={service_date:date,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:d.shift};return d;}
async function withHome(work){
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const memory=new Map(),events=new Map(),nodes=new Map(),el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const healthy=()=>({ready:true,available:true,quarantined:false}),security={native:true,getStatus:healthy,mutateProtectedWork:async fn=>fn()};
  const mobile={principalIdentity:()=> 'v9-dom',profileMatchesPrincipal:()=>true},access={profile:()=>profile,device:()=> 'KIOSK_08'};
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:mobile};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.fetch=async()=>{throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>access.profile(),getDeviceId:()=>access.device(),isVisible:()=>true,security,requestJson:async()=>legacy(zooServiceDate())});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
  await work({app,el,events,security,mobile,access,healthy,key:'mz_employee_schedule_snapshot:v9-dom'});
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
const fail=()=>{throw Error('synthetic identity read failure');};
function inject(security,mobile,kind,access){
 if(kind==='native second read'){let n=0;Object.defineProperty(security,'native',{configurable:true,get(){if(++n===2)fail();return true;}});return()=>Object.defineProperty(security,'native',{configurable:true,writable:true,value:true});}
 const object=kind==='profile reader'||kind==='device reader'?access:mobile;
 const field={'principal bridge':'principalIdentity','profile matcher':'profileMatchesPrincipal','profile reader':'profile','device reader':'device','device bridge':'deviceId'}[kind];
 const old=object[field];object[field]=fail;return()=>object[field]=old;
}
for(const kind of ['native second read','principal bridge','profile matcher','device bridge'])await test('V8-01 Schedule complete envelope '+kind,async()=>{
 const f=fixture();await f.load();const security=f.context.window.MemphisCustodialSecurity,mobile=f.context.window.MemphisMobile;
 const restore=inject(security,mobile,kind);let escaped;
 try{f.events.get('storage')({key});}catch(e){escaped=e;}restore();
 assert.equal(escaped,undefined,'identity failures cannot escape callback');assert.equal(f.node('content').hidden,true,'clear immediately');
 await pause();await f.load();assert.equal(f.node('content').hidden,true,'healthy calls alone cannot recover');
 f.events.get('memphis:custodial-security-state')({detail:security.getStatus()});await pause();assert.equal(f.node('content').hidden,false,'separate healthy positive event recovers');
});
for(const kind of ['native second read','principal bridge','profile matcher','profile reader','device reader'])await test('V8-01 Home complete envelope '+kind,()=>withHome(async f=>{
 const restore=inject(f.security,f.mobile,kind,f.access);let escaped;try{f.events.get('storage')({key:f.key});}catch(e){escaped=e;}restore();
 assert.equal(escaped,undefined,'identity failure cannot escape callback');assert.equal(f.el('home-shift').textContent,'Schedule unavailable');
 await f.app.update(true);assert.equal(f.el('home-shift').textContent,'Schedule unavailable','getter recovery is not a positive event');
 f.events.get('memphis:custodial-security-state')({detail:f.healthy()});await pause();await f.app.update(true);assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');
}));
for(const consumer of ['Schedule','Home'])await test('V8-02 '+consumer+' nested failure dominates outer positive recovery',async()=>{
 const work=async f=>{
  const healthy=f.security.getStatus;let phase=0;
  f.security.getStatus=()=>{if(phase===1){phase=2;throw Error('nested failed read');}if(phase===0){phase=1;return Object.defineProperty({...healthy()},'ready',{get(){f.events.get('storage')({key:f.key});return true;}});}return healthy();};
  f.events.get('memphis:custodial-security-state')({detail:healthy()});await pause();f.security.getStatus=healthy;
  assert.equal(f.hidden(),true,'outer positive event cannot overwrite nested failed sample');await f.load();assert.equal(f.hidden(),true);
  f.events.get('memphis:custodial-security-state')({detail:healthy()});await pause();await f.load();assert.equal(f.hidden(),false);
 };
 if(consumer==='Home')await withHome(f=>work({...f,hidden:()=>f.el('home-shift').textContent==='Schedule unavailable',load:()=>f.app.update(true)}));
 else{const f=fixture();await f.load();await work({...f,security:f.context.window.MemphisCustodialSecurity,key,hidden:()=>f.node('content').hidden});}
});
for(const prefix of ['mz_employee_schedule_snapshot:','mz_employee_schedule_snapshot:availability:'])for(const kind of ['throw','quarantine','property'])await test('V8-03 Home unrelated '+prefix+' '+kind+' is inert',()=>withHome(async f=>{
 let calls=0;f.security.getStatus=()=>{if(++calls===2){if(kind==='throw')throw Error('second read');if(kind==='quarantine')return {ready:false,available:false,quarantined:true};return Object.defineProperty(f.healthy(),'ready',{get:fail});}return f.healthy();};
 f.events.get('storage')({key:prefix+'someone-else'});assert.equal(calls,0,'unrelated key cannot consume live identity samples');
 assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');
 f.events.get('storage')({key:f.key});assert.equal(f.el('home-shift').textContent,'Schedule unavailable','same hostile source fails closed for exact key');
}));
for(const interrupted of [true,false])await test('V8-04 '+(interrupted?'actual Home begin/cancel cannot ACK rejected render':'stable successful render sends exactly one receipt'),async()=>{
 const f=fixture();f.next=legacy();
 const who={deviceId:'KIOSK_08',employeeId:id(2),employeeName:'Fixture',credentialId:id(3),assignmentEpoch:7,protectedBinding:'race-principal'};
 // There is no overlapping holder here. Immediate Web Locks model permits
 // the other actual cooperative owner to run at the exact synchronous seam.
 // This is deterministic source-interleaving evidence, not browser proof.
 const oldLocks=globalThis.navigator.locks,immediate={request:(_name,_options,work)=>Promise.resolve(work())};
 Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:immediate});f.context.window.navigator.locks=immediate;
 const owner=createScheduleHomeConvergence({identity:()=>who,storage:f.context.localStorage,mutate:f.context.window.MemphisCustodialSecurity.mutateProtectedWork,matches:()=>true,now:()=>Date.parse(day+'T17:00:00Z')});
 let armed=false,began=null,cancelled=false;
 try{
  if(interrupted){const api=f.context.window.MemphisRecurringScheduleTarget;
   f.after=()=>{if(f.stored.has(key)&&api.availability(f.context.localStorage,who.protectedBinding,day)?.state==='AVAILABLE')armed=true;};
   f.context.window.MemphisRecurringScheduleTarget={...api,assertAvailability(...args){const result=api.assertAvailability(...args);if(armed){armed=false;f.after=()=>{};began=owner.begin(who);}return result;}};
   f.context.crypto={subtle:{digest:async(...args)=>{if(began&&!cancelled){cancelled=true;await owner.cancel(who,await began);}return webcrypto.subtle.digest(...args);}}};
  }
  await f.load();await pause();
  if(interrupted){assert.ok(began,'actual cooperative Home reader started');assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
   if(!cancelled){cancelled=true;await owner.cancel(who,await began);}assert.equal(JSON.parse(f.stored.get('mz_employee_schedule_snapshot:availability:race-principal')).state,'AVAILABLE');}
  assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,interrupted?0:1,'receipt requires exact successful render');
 }finally{Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:oldLocks});f.events.get('pagehide')();}
});
console.log(JSON.stringify({scope:'V8-01..04 actual Home/Schedule owners; synthetic identity/event/Web Locks/transport seams only',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
