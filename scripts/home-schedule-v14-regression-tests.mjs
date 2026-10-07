import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture,payload,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const results=[],tick=()=>new Promise(r=>setImmediate(r));
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.ok(predicate(),'bounded operation reached');}
function legacy(){const date=zooServiceDate(),d=payload(40,false,date);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.home_facts={service_date:date,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:d.shift};return d;}
async function homeReentry(event,site,oldFailure=false){
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const memory=new Map(),events=new Map(),nodes=new Map(),timers=new Set();let timerId=0,armed=false,nested=0,schedules=0,infos=0;
  const hook=name=>{if(armed&&!nested&&name===site){nested++;events.get(event)();if(oldFailure)throw Error('retired capture failure');}};
  const el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const security={get native(){hook('native');return true;},getStatus(){hook('status');return{ready:true,available:true,quarantined:false};},mutateProtectedWork:async fn=>fn()};
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:{principalIdentity:()=>{hook('principal');return'v14-dom';},profileMatchesPrincipal:()=>{hook('matches');return true;}}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>{const n=++timerId;timers.add(n);return n;};globalThis.clearInterval=n=>timers.delete(n);
  globalThis.fetch=async()=>{if(armed)infos++;throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>{hook('profile');return profile;},getDeviceId:()=>{hook('device');return'KIOSK_08';},isVisible:()=>true,security,
   requestJson:async()=>{if(armed)schedules++;return armed&&schedules>1?{...legacy(),schedule_delivery_mode:'UNAVAILABLE'}:legacy();}});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');
  armed=true;await app.update(true);await until(()=>schedules>0);await tick();await tick();
  assert.equal(nested,1);assert.equal(schedules,1,'only nested update may start a schedule request');assert.equal(infos,3);
  assert.equal(JSON.parse(memory.get('mz_employee_schedule_snapshot:availability:v14-dom')).state,'AVAILABLE');
  assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(timers.size,1);
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
for(const event of ['online','memphis:schedule-refresh','memphis:native-notification-received'])
 for(const site of ['native','profile','device','status','matches','principal'])
  for(const oldFailure of [false,true])await test('V13-01A '+event+' pre-runtime '+site+(oldFailure?' old throws':''),()=>homeReentry(event,site,oldFailure));

const availabilityKey='mz_employee_schedule_snapshot:availability:race-principal';
const hash=s=>createHash('sha256').update(s).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
function nextPayload(){const d=payload(21),r=d.recurring_delivery;r.view.raw_items[0].name='Superseded Area';
 r.viewJsonText=JSON.stringify(r.view);r.viewDigest=hash(r.viewJsonText);r.target.viewDigest=r.viewDigest;r.targetDigest=hash(flat(r.target));return d;}
const display=f=>JSON.stringify(['employee','date','areas','content','state-text','notice'].map(k=>{const n=f.node(k);return[n.textContent,n.innerHTML,n.hidden];}));
async function countMatches(){const f=fixture();try{await f.load();let n=0;const original=f.context.window.MemphisMobile.profileMatchesPrincipal;
 f.context.window.MemphisMobile.profileMatchesPrincipal=d=>{n++;return original(d);};f.next=nextPayload();await f.load();assert.ok(n>3&&n<60);return n;
 }finally{f.events.get('pagehide')();}}
const captures=await countMatches();
for(const event of ['online','memphis:schedule-refresh','memphis:native-notification-received'])for(let at=1;at<=captures;at++)for(const oldFailure of [false,true])await test('V13-01B '+event+' load-only matches capture '+at+(oldFailure?' old throws':''),async()=>{
 const f=fixture();try{await f.load();let reads=0,nested=0,priorRow,priorAvailability,priorDisplay;
  const mobile=f.context.window.MemphisMobile,original=mobile.profileMatchesPrincipal;
  mobile.profileMatchesPrincipal=d=>{const value=original(d);if(++reads===at){nested++;priorRow=f.stored.get(key);priorAvailability=f.stored.get(availabilityKey);priorDisplay=display(f);
   mobile.ready=new Promise(()=>{});f.events.get(event)();if(oldFailure)throw Error('retired profile failure');}return value;};
  f.next=nextPayload();await f.load();await tick();
  assert.equal(nested,1);assert.equal(f.stored.get(key),priorRow,'retired caller must not persist a newer row');
  assert.equal(f.stored.get(availabilityKey),priorAvailability,'retired caller must not advance AVAILABLE');
  assert.equal(display(f),priorDisplay,'retired caller must not alter displayed authority');
  assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0);
 }finally{f.events.get('pagehide')();await tick();}
});
console.log(JSON.stringify({scope:'V13-01 mounted Home caller and actual Schedule load-only reentry, natural authority and immutable caller predicate; synthetic seams, not physical proof',captures,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
