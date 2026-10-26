import assert from 'node:assert/strict';
import {fixture,payload,key,id} from './employee-schedule-convergence-race-tests.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const results=[];
async function test(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
function legacy(){const date=zooServiceDate(),d=payload(30,false,date);delete d.recurring_delivery;d.schedule_delivery_mode='LEGACY_REGISTERED';d.stale=false;
 d.home_facts={service_date:date,employee_id:id(2),publication_id:id(4),projection_id:id(5),projection_status:'current',shift:d.shift};return d;}
async function withHome(work){
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const memory=new Map(),events=new Map(),nodes=new Map(),timers=new Set(),writes=[];let timerId=0;
  const el=k=>{if(!nodes.has(k)){let text='';nodes.set(k,{get textContent(){return text;},set textContent(v){text=v;writes.push([k,v]);},innerHTML:'',dataset:{}});}return nodes.get(k);};
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture',credential_id:id(3),assignment_epoch:7};
  const healthy=()=>({ready:true,available:true,quarantined:false}),security={native:true,getStatus:healthy,mutateProtectedWork:async fn=>fn()};
  const mobile={principalIdentity:()=> 'v11-dom',profileMatchesPrincipal:()=>true},access={profile:()=>profile,device:()=> 'KIOSK_08',request:async()=>legacy()};
  globalThis.window={addEventListener:(n,f)=>events.set(n,f),MemphisMobile:mobile};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.setInterval=()=>{const n=++timerId;timers.add(n);return n;};globalThis.clearInterval=n=>timers.delete(n);globalThis.fetch=async()=>{throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>access.profile(),getDeviceId:()=>access.device(),isVisible:()=>true,security,requestJson:(...args)=>access.request(...args)});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(timers.size,1);
  await work({app,el,events,security,mobile,access,healthy,memory,timers,writes,profile,key:'mz_employee_schedule_snapshot:v11-dom',availabilityKey:'mz_employee_schedule_snapshot:availability:v11-dom'});
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
for(const which of ['key','availabilityKey'])await test('V10-01A Home third capture nested exact '+which,()=>withHome(async f=>{
 let reads=0,nested=0;const start=f.writes.length;
 Object.defineProperty(f.security,'native',{configurable:true,get(){if(++reads===3){nested++;f.events.get('storage')({key:f[which]});assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');}return true;}});
 f.events.get('storage')({key:f[which]});assert.equal(nested,1);
 assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(f.timers.size,1);
 assert.ok(!f.writes.slice(start).some(([k,v])=>k==='home-shift'&&v==='Schedule unavailable'),'no stale clear after nested success');
}));
for(const absent of [null,undefined])await test('V10-01B Home superseded profile '+String(absent),()=>withHome(async f=>{
 let armed=true,nested=0;f.access.request=()=>new Promise(()=>{});
 f.access.profile=()=>{if(armed){armed=false;nested++;f.events.get('memphis:custodial-security-state')({detail:f.healthy()});assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');return absent;}return f.profile;};
 f.events.get('memphis:custodial-security-state')({detail:f.healthy()});assert.equal(nested,1);
 assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(f.timers.size,1);
}));
for(const at of [1,2,4,5])await test('V10-01 Home nested success at adjacent native capture '+at,()=>withHome(async f=>{
 let reads=0,nested=0;
 Object.defineProperty(f.security,'native',{configurable:true,get(){if(++reads===at){nested++;f.events.get('storage')({key:f.key});}return true;}});
 f.events.get('storage')({key:f.key});assert.equal(nested,1,'hostile capture reached');
 assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(f.timers.size,1);
}));
await test('V10-01C Home abort reentrancy retains exact newer owner and timer',()=>withHome(async f=>{
 let reachedResolve;const reached=new Promise(resolve=>reachedResolve=resolve);let nested=0;
 globalThis.fetch=(_path,{signal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>{
  if(!nested){nested++;f.events.get('memphis:custodial-security-state')({detail:f.healthy()});}reject(Error('old request aborted'));
 },{once:true});reachedResolve();});
 const pending=f.app.update(true);await reached;
 // Hold informational requests while the actual schedule request completes.
 // Do not rewrite a fence to manufacture available authority.
 const deadline=Date.now()+1000;
 while(JSON.parse(f.memory.get(f.availabilityKey)).state!=='AVAILABLE'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,1));
 assert.equal(JSON.parse(f.memory.get(f.availabilityKey)).state,'AVAILABLE');
 globalThis.fetch=async()=>{throw Error('external facts offline');};
 f.access.request=()=>new Promise(()=>{});
 f.events.get('memphis:custodial-security-state')({detail:f.healthy()});
 assert.equal(nested,1);assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM');assert.equal(f.timers.size,1,'exactly one newer timer survives');
 f.events.get('storage')({key:f.key});assert.equal(f.el('home-shift').textContent,'7:00 AM–4:00 PM','new owner remains reachable for redraw');
 await pending;
}));
for(const blocked of [true,false])for(const eventKey of [key,'mz_employee_schedule_snapshot:availability:race-principal'])await test('V10-01D Schedule '+(blocked?'terminal':'regular')+' nested commit '+eventKey,async()=>{
 const f=fixture();try{
  f.next=payload(40,blocked);await f.load();assert.equal(f.node(blocked?'notice':'content').hidden,false);
  const node=f.node(blocked?'notice':'areas'),prop=blocked?'textContent':'innerHTML';let value=node[prop],armed=false,nested=0;
  Object.defineProperty(node,prop,{configurable:true,get:()=>value,set(v){value=v;if(v)armed=true;}});
  const security=f.context.window.MemphisCustodialSecurity,getStatus=security.getStatus;
  security.getStatus=()=>{if(armed&&!nested){armed=false;nested++;f.events.get('storage')({key:eventKey});assert.equal(f.node(blocked?'notice':'content').hidden,false);}return getStatus();};
  f.context.fetch=()=>new Promise(()=>{});
  f.events.get('storage')({key:eventKey});
  assert.equal(nested,1);assert.equal(f.node(blocked?'notice':'content').hidden,false,'newer verified display survives outer commit');
  assert.notEqual(f.node('state-text').textContent,'Schedule changed during display. Updating…');
  assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0);
  let reads=0;security.getStatus=()=>{reads++;throw Error('unreadable');};f.events.get('storage')({key:key+'-wrong'});assert.equal(reads,0,'newer displayed binding retained');
 }finally{f.events.get('pagehide')();}
});
// Exercise every synchronous protected-status capture in the SAME exact-key
// redraw, not only the final commit. This remains the same supersession owner.
for(const blocked of [true,false]){
 const probe=fixture();let count=0;
 try{probe.next=payload(40,blocked);await probe.load();probe.context.fetch=()=>new Promise(()=>{});
  const security=probe.context.window.MemphisCustodialSecurity,getStatus=security.getStatus;
  security.getStatus=()=>{count++;return getStatus();};probe.events.get('storage')({key});
 }finally{probe.events.get('pagehide')();}
 assert.ok(count>0&&count<30,'bounded synchronous capture inventory');
 for(let at=1;at<=count;at++)await test('V10-01 Schedule '+(blocked?'terminal':'regular')+' nested success capture '+at+'/'+count,async()=>{
  const f=fixture();try{f.next=payload(40,blocked);await f.load();f.context.fetch=()=>new Promise(()=>{});
   const security=f.context.window.MemphisCustodialSecurity,getStatus=security.getStatus;let reads=0,nested=0;
   security.getStatus=()=>{if(++reads===at){nested++;f.events.get('storage')({key});}return getStatus();};
   f.events.get('storage')({key});assert.equal(nested,1,'hostile capture reached');
   assert.equal(f.node(blocked?'notice':'content').hidden,false,'newer verified presentation must survive every older capture');
   assert.equal(f.calls.filter(x=>x.endsWith('application-receipt')).length,0);
  }finally{f.events.get('pagehide')();}
 });
}
console.log(JSON.stringify({scope:'V10-01 actual Home/Schedule owners; synthetic getter/event/abort seams only',passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
