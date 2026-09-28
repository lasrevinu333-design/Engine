import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import './synthetic-schedule-locks.mjs';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
const id=n=>`af000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
 assignment_epoch:7,credential_operation_id:id(3),installation_seal:'synthetic-f02-installation',enrolled_at:'2026-07-01T12:00:00.000Z'};
const scope=principalIdentity(principal),day='2026-09-28',now=()=>Date.parse(day+'T15:00:00Z');
const identity={deviceId:principal.device_id,employeeId:principal.employee_id,employeeName:'Synthetic F02',credentialId:principal.credential_id,
 assignmentEpoch:7,protectedBinding:scope};
const api=globalThis.MemphisRecurringScheduleTarget;
const payload=revision=>({canonical_device_id:principal.device_id,employee_id:principal.employee_id,credential_id:principal.credential_id,assignment_epoch:7,
 service_date:day,schedule_delivery_mode:'LEGACY_REGISTERED',projection_status:'current',projection_id:id(revision+100),publication_id:id(revision+200),
 projection_authority_revision:revision,employee_name:'Synthetic F02',full_day:true,shift:{start:'07:00',end:'16:00'},raw_items:[]});
const event=revision=>({kind:'employee_location_status',service_date:day,projection_id:id(revision+100),
 receipt_device_id:principal.device_id,receipt_employee_id:principal.employee_id,receipt_credential_id:principal.credential_id,receipt_assignment_epoch:'7'});
const results=[];
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
function fixture(){
 const memory=new Map();let failUnavailable=false;
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{
  if(failUnavailable&&k===api.availabilityKey(scope)&&JSON.parse(v).state==='UNAVAILABLE')throw Error('synthetic unavailable-write failure');memory.set(k,v);}};
 const owner=()=>createScheduleNotificationAuthority({identity:()=>scope,principal:()=>principal,status:()=>({ready:true,available:true,quarantined:false}),storage,now});
 const page=()=>createScheduleHomeConvergence({identity:()=>identity,storage,mutate:fn=>fn(),matches:()=>true,now});
 const notification=owner(),home=page();
 const fence=()=>api.availability(storage,scope,day);
 const apply=async(revision,observedAvailability)=>home.accept(payload(revision),identity,{observedAvailability});
 const seed=async()=>{await apply(10,await home.begin(identity));assert.equal(await notification.refresh(),true);assert.equal(notification.isCurrent(event(10),scope),true);};
 return{storage,memory,owner,page,notification,home,fence,apply,seed,failUnavailable:value=>{failUnavailable=value;}};
}
await test('F02 older in-flight observation cannot clear later authenticated unavailable',async()=>{
 const f=fixture();await f.seed();const late=f.notification.observe(payload(11),scope);
 const denied=f.notification.unavailable(scope);assert.equal(await late,false);await denied;
 assert.equal(f.notification.isCurrent(event(11),scope),false);assert.equal(f.fence().state,'UNAVAILABLE');
});
await test('F02 newer503 invalidates an older response ticket',async()=>{
 const f=fixture();await f.seed();const old=await f.notification.beginResponse(scope),newer=await f.notification.beginResponse(scope);
 await f.notification.unavailable(scope,newer);assert.equal(await f.notification.observe(payload(11),scope,old),false);
 assert.equal(f.notification.isCurrent(event(10),scope),false);assert.equal(f.fence().state,'UNAVAILABLE');
});
await test('F02 actual page cancellation and restart cannot revive503 cache',async()=>{
 const f=fixture();await f.seed();const pageTicket=await f.home.begin(identity),ticket=await f.notification.beginResponse(scope);
 assert.equal(ticket.fence.stamp,pageTicket.stamp,'notification joins actual page read ticket');
 await f.notification.unavailable(scope,ticket);await assert.rejects(f.home.cancel(identity,pageTicket),e=>e.code==='schedule_request_invalidated');
 const restarted=f.owner();assert.equal(await restarted.refresh(),false);assert.equal(restarted.isCurrent(event(10),scope),false);
 assert.equal(f.page().resolve(identity).projection_status,'unavailable');assert.equal(f.fence().state,'UNAVAILABLE');
});
await test('F02 failed unavailable persistence retains unresolved read across restart',async()=>{
 const f=fixture();await f.seed();const ticket=await f.notification.beginResponse(scope);f.failUnavailable(true);
 assert.equal(await f.notification.unavailable(scope,ticket),false);assert.equal(f.fence().state,'READING');
 const restarted=f.owner();assert.equal(await restarted.refresh(),false);assert.equal(restarted.isCurrent(event(10),scope),false);
 assert.equal(f.page().resolve(identity).projection_status,'unavailable');
});
await test('F02 validated recovery needs actual page application of exact subsequent response',async()=>{
 const f=fixture();await f.seed();await f.notification.unavailable(scope,await f.notification.beginResponse(scope));
 const pageTicket=await f.home.begin(identity),ticket=await f.notification.beginResponse(scope);
 assert.equal(await f.notification.observe(payload(11),scope,ticket),true);
 assert.equal(f.notification.isCurrent(event(11),scope),false,'prior unavailable cannot be cleared by response alone');
 await f.apply(11,pageTicket);assert.equal(await f.notification.refresh(),true);assert.equal(f.notification.isCurrent(event(11),scope),true);
 const restarted=f.owner();assert.equal(await restarted.refresh(),true);assert.equal(restarted.isCurrent(event(11),scope),true);
});
await test('F02 delayed older503 cannot poison newer accepted schedule',async()=>{
 const f=fixture();await f.seed();const old=await f.notification.beginResponse(scope);
 const pageTicket=await f.home.begin(identity),fresh=await f.notification.beginResponse(scope);
 assert.equal(await f.notification.observe(payload(11),scope,fresh),true);await f.apply(11,pageTicket);await f.notification.refresh();
 const stamp=f.fence().stamp;assert.equal(await f.notification.unavailable(scope,old),false);assert.equal(f.fence().stamp,stamp);
 assert.equal(f.notification.isCurrent(event(11),scope),true);
});
await test('F02 security transition invalidates response ticket despite identity ABA',async()=>{
 const f=fixture();await f.seed();const ticket=await f.notification.beginResponse(scope);
 f.notification.securityChanged({});f.notification.securityChanged({ready:true,available:true,quarantined:false});
 assert.equal(await f.notification.observe(payload(11),scope,ticket),false);assert.equal(f.notification.isCurrent(event(11),scope),false);
});
await test('F02 actual bridge persists503 before returning to page and protects process restart',async()=>{
 const f=fixture();await f.seed();const source=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const start=source.indexOf('  async function bridgeFetch('),end=source.indexOf('  async function requestEnvelope(',start);assert.ok(start>=0&&end>start);
 const pending=[];let reconciles=0;
 const context={URL,Request,Response,JSON,API_ORIGIN:'https://fixture.invalid',nativeVault:true,target:input=>new URL(input),currentPrincipalIdentity:()=>scope,
  credentialStore:{dispatchAuthorizedTransport:async()=>{let resolve;const completion=new Promise(r=>resolve=r);pending.push(resolve);return{generation:1,completion};},waitForStableState:async()=>{}},
  responsePayload:r=>r.clone().json(),scheduleNotificationAuthority:f.notification,reconcileScheduleNotifications:async()=>{reconciles++;}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const request=context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary');
 for(let n=0;n<30&&!pending.length;n++)await new Promise(r=>setImmediate(r));assert.equal(pending.length,1);
 assert.equal(f.fence().state,'READING','marker exists before authenticated transport completes');
 pending[0](new Response(JSON.stringify({ok:false}),{status:503}));assert.equal((await request).status,503);
 assert.equal(f.fence().state,'UNAVAILABLE');const restarted=f.owner();assert.equal(await restarted.refresh(),false);assert.equal(restarted.isCurrent(event(10),scope),false);assert.equal(reconciles,1);
});
await test('F02 missing shared lock prevents transport admission',async()=>{
 const f=fixture(),descriptor=Object.getOwnPropertyDescriptor(navigator,'locks');
 try{Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});await assert.rejects(f.notification.beginResponse(scope),e=>e.code==='schedule_atomic_storage_unavailable');}
 finally{Object.defineProperty(navigator,'locks',descriptor);}
 assert.equal(f.notification.isCurrent(event(10),scope),false);
});
console.log(JSON.stringify({scope:'F02 actual notification/Home/bridge owners; synthetic storage/FIFO locks/transport, no native or physical acceptance',passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
