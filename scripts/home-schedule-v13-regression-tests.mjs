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
  const access={request:async()=>legacy()};globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=> 'v13-dom',profileMatchesPrincipal:()=>true}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>{const n=++timerId;timers.add(n);return n;};globalThis.clearInterval=n=>timers.delete(n);globalThis.fetch=async()=>{throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,requestJson:(...args)=>access.request(...args)});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
  await work({app,el,events,access,healthy,memory,timers,availabilityKey:'mz_employee_schedule_snapshot:availability:v13-dom'});
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
for(const event of ['online','memphis:schedule-refresh','memphis:native-notification-received'])await test('V12-01A same-owner abort reentry '+event,()=>withHome(async f=>{
 let nested=0,infoCalls=0,afterRequests=0,armed=false,postInfo=0;const writes=[],setItem=globalThis.localStorage.setItem;
 globalThis.localStorage.setItem=(k,v)=>{setItem(k,v);if(armed&&k===f.availabilityKey)writes.push(JSON.parse(v).state);};
 globalThis.fetch=(_path,{signal})=>{infoCalls++;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{
  if(armed&&!nested){nested++;postInfo=infoCalls;globalThis.fetch=async()=>{infoCalls++;throw Error('external facts offline');};
   f.access.request=async()=>{afterRequests++;return afterRequests===1?legacy():{...legacy(),schedule_delivery_mode:'UNAVAILABLE'};};
   f.events.get(event)();
  }reject(Error('old informational request aborted'));
 },{once:true}));};
 const old=f.app.update(true);await until(()=>infoCalls===3&&JSON.parse(f.memory.get(f.availabilityKey)).state==='AVAILABLE');
 armed=true;await f.app.update(true);await old;await until(()=>afterRequests>=1);await tick();await tick();
 assert.equal(nested,1);assert.equal(afterRequests,1,'one replacement schedule request; trace '+JSON.stringify(writes));
 assert.equal(infoCalls-postInfo,3);assert.equal(JSON.parse(f.memory.get(f.availabilityKey)).state,'AVAILABLE');
 assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(f.timers.size,1);
}));
const availabilityKey='mz_employee_schedule_snapshot:availability:race-principal';
for(const eventKey of [key,availabilityKey])await test('V12-01B cancel await cannot adopt newer failure '+eventKey,async()=>{
 const f=fixture();try{
  f.next=payload(40);await f.load();let nested=0,nestedState='',armed=false;const sequence=[],setItem=f.context.localStorage.setItem;
  f.context.localStorage.setItem=(k,v)=>{setItem(k,v);if(k===availabilityKey){const state=JSON.parse(v).state;sequence.push(state);
   if(armed&&state==='AVAILABLE'&&!nested){nested++;f.status={ready:false,available:false,quarantined:true};
    f.events.get('storage')({key:eventKey});nestedState=f.node('state-text').textContent;f.status={ready:true,available:true,quarantined:false};}
  }};
  f.context.fetch=async()=>{armed=true;throw Error('network offline');};await f.load();
  assert.deepEqual(sequence.slice(0,2),['READING','AVAILABLE']);assert.equal(nested,1);
  assert.equal(nestedState,'Phone identity must be verified.');assert.equal(f.node('state-text').textContent,nestedState);
  assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
 }finally{f.events.get('pagehide')();}
});
function trackTimers(f){const timers=new Map(),intervals=new Set();let seq=10;
 f.context.setTimeout=(callback,delay)=>{const token=++seq;timers.set(token,{callback,delay});return token;};f.context.clearTimeout=token=>timers.delete(token);
 f.context.setInterval=()=>{const token=++seq;intervals.add(token);return token;};f.context.clearInterval=token=>intervals.delete(token);
 return{timers,intervals,boundary(){const item=[...timers.values()].find(x=>x.delay>15000);assert.ok(item,'actual boundary');return item.callback;}};}
async function captureCount(kind){const f=fixture();try{
 const clock=trackTimers(f);await f.load();let armed=kind==='boundary',reads=0;
 const original=f.context.window.MemphisCustodialSecurity.getStatus,setItem=f.context.localStorage.setItem;
 f.context.window.MemphisCustodialSecurity.getStatus=()=>{if(armed)reads++;return original();};
 f.context.localStorage.setItem=(k,v)=>{setItem(k,v);if(k===availabilityKey&&JSON.parse(v).state==='AVAILABLE')armed=true;};
 if(kind==='boundary'){f.context.window.MemphisMobile.ready=new Promise(()=>{});clock.boundary()();}
 else{f.context.fetch=async()=>{f.context.window.MemphisMobile.ready=new Promise(()=>{});throw Error('offline');};await f.load();}
 assert.ok(reads>=4&&reads<40);return reads;
 }finally{f.events.get('pagehide')();}}
const captureCounts={boundary:await captureCount('boundary'),recovery:await captureCount('recovery')};
for(const resume of [false,true])for(const kind of ['boundary','recovery'])for(let at=1;at<=captureCounts[kind];at++)await test('V12-01C '+kind+' pagehide'+(resume?'/pageshow':'')+' at capture '+at,async()=>{
 const f=fixture();try{
  const clock=trackTimers(f);f.next=payload(40);await f.load();const callback=clock.boundary();let armed=kind==='boundary',reads=0,nested=0;
  const original=f.context.window.MemphisCustodialSecurity.getStatus,setItem=f.context.localStorage.setItem;
  f.context.localStorage.setItem=(k,v)=>{setItem(k,v);if(k===availabilityKey&&JSON.parse(v).state==='AVAILABLE')armed=true;};
  f.context.window.MemphisCustodialSecurity.getStatus=()=>{const status=original();if(armed&&++reads===at){nested++;f.events.get('pagehide')();
   if(resume){f.context.window.MemphisMobile.ready=new Promise(()=>{});f.events.get('pageshow')();}}
   return status;};
  if(kind==='boundary'){f.context.window.MemphisMobile.ready=new Promise(()=>{});callback();}
  else{f.context.fetch=async()=>{throw Error('offline');};await f.load();}
  assert.equal(nested,1);assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
  assert.equal([...clock.timers.values()].filter(x=>x.delay>15000).length,0,'no boundary recreated while paused');
  if(resume)assert.equal(clock.intervals.size,1,'new page owns exactly one polling timer');
  assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0);
 }finally{f.events.get('pagehide')();}
});
await test('Home synchronous informational dispatch reentry retires remaining outer dispatches',()=>withHome(async f=>{
 let nested=0,infoCalls=0,afterNested=0;
 f.access.request=async()=>legacy();
 globalThis.fetch=async()=>{infoCalls++;
  if(!nested){nested++;globalThis.fetch=async()=>{afterNested++;throw Error('offline info');};f.events.get('online')();}
  throw Error('outer offline info');
 };
 await f.app.update(true);await tick();await tick();
 assert.equal(infoCalls,1);assert.equal(afterNested,3,'only newest three informational calls');assert.equal(f.timers.size,1);
 assert.equal(JSON.parse(f.memory.get(f.availabilityKey)).state,'AVAILABLE');assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');
}));
console.log(JSON.stringify({scope:'V12-01 actual mounted Home and actual Schedule; natural availability transitions; synthetic reentrant native/DOM events',captureCounts,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
