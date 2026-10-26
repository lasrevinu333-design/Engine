import assert from 'node:assert/strict';
import {fixture as scheduleFixture} from './employee-schedule-convergence-race-tests.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
const api=globalThis.MemphisRecurringScheduleTarget,id=n=>`af000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),assignment_epoch:7,
 credential_operation_id:id(3),installation_seal:'synthetic-f02-installation',enrolled_at:'2026-07-01T12:00:00.000Z'};
const scope=principalIdentity(principal),results=[];
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
await test('F02 Home503 failed unavailable-write must not cancel read fence or revive after restart',async()=>{
 const names=['window','document','localStorage','fetch','setInterval','clearInterval'],saved=names.map(k=>[k,globalThis[k]]);let app;
 try{
  const nodes=new Map(),memory=new Map(),el=k=>{if(!nodes.has(k))nodes.set(k,{textContent:'',innerHTML:'',dataset:{}});return nodes.get(k);};
  let responseFails=false,writeFails=false;
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(1),employee_name:'Synthetic',credential_id:id(2),assignment_epoch:7};
  const data={...profile,service_date:zooServiceDate(),schedule_delivery_mode:'LEGACY_REGISTERED',projection_status:'current',projection_id:id(10),publication_id:id(20),
   projection_authority_revision:10,full_day:true,shift:{start:'07:00',end:'16:00'},raw_items:[]};
  const healthy=()=>({ready:true,available:true,quarantined:false}),security={native:true,getStatus:healthy,mutateProtectedWork:async fn=>fn()};
  const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(writeFails&&k===api.availabilityKey(scope)&&JSON.parse(v).state==='UNAVAILABLE')throw Error('transient U-write failure');memory.set(k,v);}};
  const makeOwner=()=>createScheduleNotificationAuthority({identity:()=>scope,principal:()=>principal,status:healthy,storage}),owner=makeOwner();
  globalThis.window={addEventListener(){},MemphisMobile:{principalIdentity:()=>scope,profileMatchesPrincipal:()=>true}};
  globalThis.document={getElementById:el,addEventListener(){},hidden:false};globalThis.localStorage=storage;
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.fetch=async()=>{throw Error('external facts offline');};
  app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,security,requestJson:async()=>{
   if(!responseFails)return structuredClone(data);
   const ticket=await owner.beginResponse(scope);writeFails=true;assert.equal(await owner.unavailable(scope,ticket),false);writeFails=false;
   throw Object.assign(new Error('HTTP503'),{status:503});
  }});
  await app.update(true);assert.equal(el('home-shift').textContent,'7:00 AM–4:00 PM');await owner.refresh();
  responseFails=true;await app.update(true);assert.equal(api.availability(storage,scope,zooServiceDate()).state,'READING');
  assert.equal(el('home-shift').textContent,'Schedule unavailable');const restarted=makeOwner();assert.equal(await restarted.refresh(),false);
 }finally{app?.stop();for(const[k,v]of saved){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
for(const kind of ['HTTP503','malformed response'])await test('F02 actual Schedule '+kind+' cannot restore old AVAILABLE',async()=>{
 const f=scheduleFixture();await f.load();assert.equal(f.node('content').hidden,false);
 f.context.fetch=async()=>({ok:kind!=='HTTP503',status:kind==='HTTP503'?503:200,json:async()=>{if(kind==='malformed response')throw SyntaxError('synthetic bad JSON');return{ok:false};}});
 await f.load();assert.equal(f.node('content').hidden,true);
 const entry=[...f.stored].find(([key])=>key.startsWith('mz_employee_schedule_snapshot:availability:'));
 assert.equal(JSON.parse(entry[1]).state,'READING');
});
console.log(JSON.stringify({scope:'actual page error handlers after observed HTTP response; synthetic DOM/storage/transport, no physical evidence',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
