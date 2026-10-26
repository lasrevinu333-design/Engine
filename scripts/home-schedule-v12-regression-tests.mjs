import assert from 'node:assert/strict';
import {fixture,payload,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const results=[];
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
const tick=()=>new Promise(r=>setImmediate(r));
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.ok(predicate(),'bounded operation reached');}
function legacy(){const date=zooServiceDate(),d=payload(40,false,date);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.home_facts={service_date:date,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:d.shift};return d;}
async function withHome(work){
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const memory=new Map(),events=new Map(),nodes=new Map(),timers=new Set();let timerId=0;
  const el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const healthy=()=>({ready:true,available:true,quarantined:false}),security={native:true,getStatus:healthy,mutateProtectedWork:async fn=>fn()};
  const access={request:async()=>legacy()};globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=> 'v12-dom',profileMatchesPrincipal:()=>true}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>{const n=++timerId;timers.add(n);return n;};globalThis.clearInterval=n=>timers.delete(n);globalThis.fetch=async()=>{throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,requestJson:(...args)=>access.request(...args)});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
  await work({app,el,events,access,healthy,memory,timers,availabilityKey:'mz_employee_schedule_snapshot:availability:v12-dom'});
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
await test('V11-01A disposed force-abort frame launches zero replacement work',()=>withHome(async f=>{
 let nested=0,infoCalls=0,afterRequests=0,armed=false,nestedShift='',postInfo=0;
 globalThis.fetch=(_path,{signal})=>{infoCalls++;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{
  if(armed&&!nested){nested++;postInfo=infoCalls;globalThis.fetch=async()=>{infoCalls++;throw Error('external facts offline');};
   f.access.request=async()=>{afterRequests++;return afterRequests===1?legacy():{...legacy(),schedule_delivery_mode:'UNAVAILABLE'};};
   f.events.get('memphis:custodial-security-state')({detail:f.healthy()});nestedShift=f.el('home-shift').textContent;
  }reject(Error('old informational request aborted'));
 },{once:true}));};
 const old=f.app.update(true);await until(()=>infoCalls===3&&JSON.parse(f.memory.get(f.availabilityKey)).state==='AVAILABLE');
 armed=true;await f.app.update(true);await old;await until(()=>afterRequests>=1);await tick();await tick();
 assert.equal(nested,1);assert.equal(nestedShift,'7:00 AM–4:00 PM','nested owner has a real verified view');
 assert.equal(afterRequests,1,'only replacement owner issues a schedule request');
 assert.equal(infoCalls-postInfo,3,'only replacement owner issues informational requests');
 assert.equal(JSON.parse(f.memory.get(f.availabilityKey)).state,'AVAILABLE');
 assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(f.timers.size,1);
}));

function trackBoundary(f){const timers=new Map();let seq=10;f.context.setTimeout=(callback,delay)=>{const token=++seq;timers.set(token,{callback,delay});return token;};f.context.clearTimeout=token=>timers.delete(token);
 return()=>{const found=[...timers.values()].find(x=>x.delay>15000);assert.ok(found,'actual boundary timer exists');return found.callback;};}
const availabilityKey='mz_employee_schedule_snapshot:availability:race-principal';
async function captureCount(kind){const f=fixture();try{
 const boundary=trackBoundary(f);await f.load();let armed=kind==='boundary',reads=0;
 const original=f.context.window.MemphisCustodialSecurity.getStatus,setItem=f.context.localStorage.setItem;
 f.context.window.MemphisCustodialSecurity.getStatus=()=>{if(armed)reads++;return original();};
 f.context.localStorage.setItem=(k,v)=>{setItem(k,v);if(k===availabilityKey&&JSON.parse(v).state==='AVAILABLE')armed=true;};
 if(kind==='boundary'){f.context.window.MemphisMobile.ready=new Promise(()=>{});boundary()();}
 else{f.context.fetch=async()=>{f.context.window.MemphisMobile.ready=new Promise(()=>{});throw Error('network offline');};await f.load();}
 assert.ok(reads>=4&&reads<40,'bounded inventory of actual synchronous captures');return reads;
}finally{f.events.get('pagehide')();}}
const boundaryCaptures=await captureCount('boundary'),recoveryCaptures=await captureCount('recovery');
for(const eventKey of [key,availabilityKey])for(let at=1;at<=boundaryCaptures;at++)await test('V11-01B boundary superseded capture '+at+' '+eventKey,async()=>{
 const f=fixture();try{
  const boundary=trackBoundary(f);f.next=payload(40);await f.load();assert.equal(f.node('content').hidden,false);const callback=boundary();
  f.context.window.MemphisMobile.ready=new Promise(()=>{});
  const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus;let reads=0,nested=0,nestedVisible=false;
  security.getStatus=()=>{if(++reads===at){nested++;f.events.get('storage')({key:eventKey});nestedVisible=!f.node('content').hidden;}return original();};
  callback();assert.equal(nested,1);assert.equal(nestedVisible,true);assert.equal(f.node('content').hidden,false);assert.match(f.node('areas').innerHTML,/Old Area/);
  assert.notEqual(f.node('state-text').textContent,'Saved schedule could not be verified.');
  assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0);
 }finally{f.events.get('pagehide')();}
});
for(const eventKey of [key,availabilityKey])for(let at=1;at<=recoveryCaptures;at++)await test('V11-01C recovery superseded capture '+at+' '+eventKey,async()=>{
 const f=fixture();try{
  f.next=payload(40);await f.load();assert.equal(f.node('content').hidden,false);
  let restored=false,reads=0,nested=0,nestedVisible=false;const sequence=[],setItem=f.context.localStorage.setItem;
  f.context.localStorage.setItem=(k,v)=>{setItem(k,v);if(k===availabilityKey){const state=JSON.parse(v).state;sequence.push(state);if(state==='AVAILABLE'&&sequence.includes('READING'))restored=true;}};
  const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus;
  security.getStatus=()=>{if(restored&&++reads===at){nested++;f.context.window.MemphisMobile.ready=new Promise(()=>{});f.events.get('storage')({key:eventKey});nestedVisible=!f.node('content').hidden;}return original();};
  f.context.fetch=async()=>{throw Error('network offline');};await f.load();
  assert.deepEqual(sequence.slice(0,2),['READING','AVAILABLE'],'transport cancellation restores actual fence');
  assert.equal(nested,1,'selected recovery capture reached');assert.equal(nestedVisible,true);
  assert.equal(f.node('content').hidden,false,'older recovery must leave the newer verified view');assert.match(f.node('areas').innerHTML,/Old Area/);
  assert.notEqual(f.node('state-text').textContent,'Schedule could not update.');assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0);
 }finally{f.events.get('pagehide')();}
});
for(const kind of ['boundary','recovery'])await test('nested newer security failure dominates '+kind,async()=>{
 const f=fixture();try{
  const boundary=trackBoundary(f);await f.load();let armed=kind==='boundary',nested=0;
  const original=f.context.window.MemphisCustodialSecurity.getStatus,setItem=f.context.localStorage.setItem;
  f.context.localStorage.setItem=(k,v)=>{setItem(k,v);if(k===availabilityKey&&JSON.parse(v).state==='AVAILABLE')armed=true;};
  f.context.window.MemphisCustodialSecurity.getStatus=()=>{const result=original();if(armed&&!nested){nested++;
   f.status={ready:false,available:false,quarantined:true};f.events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});
  }return result;};
  if(kind==='boundary'){f.context.window.MemphisMobile.ready=new Promise(()=>{});boundary()();}
  else{f.context.fetch=async()=>{throw Error('network offline');};await f.load();}
  assert.equal(nested,1);assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
  assert.equal(f.node('state-text').textContent,'Phone identity must be verified.');
 }finally{f.events.get('pagehide')();}
});
for(const failure of ['missing-principal','throw'])await test('same-generation boundary '+failure+' still clears',async()=>{
 const f=fixture();try{const boundary=trackBoundary(f);await f.load();const callback=boundary();f.context.window.MemphisMobile.ready=new Promise(()=>{});
  if(failure==='missing-principal')f.context.window.MemphisMobile.principalIdentity=()=>'';else f.readFails=true;
  callback();assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
 }finally{f.events.get('pagehide')();}
});
console.log(JSON.stringify({scope:'V11-01 actual owners; synthetic AbortSignal/boundary/recovery seams, no fabricated fences',boundaryCaptures,recoveryCaptures,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
