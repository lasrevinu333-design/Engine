import {fixture as currentScheduleFixture,payload as currentSchedulePayload,key as currentScheduleKey,id as scheduleId} from './employee-schedule-convergence-race-tests.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const source=p=>readFileSync(new URL(p,base),'utf8');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',C='20000000-0000-4000-8000-000000000001';
const now=Date.parse('2026-10-06T15:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const settle=async()=>{for(let n=0;n<16;n++)await new Promise(resolve=>setImmediate(resolve));};
function environment(fetchImpl,initial={}){
 const nodes=new Map(),events=new Map(),stores=new Map(Object.entries(initial)),timers=new Map();let id=0;
 const node=name=>{if(!nodes.has(name))nodes.set(name,{hidden:false,textContent:'',innerHTML:'',dataset:{},addEventListener(){},setAttribute(){},classList:{add(){},remove(){},toggle(){}}});return nodes.get(name);};
 const document={hidden:false,getElementById:node,addEventListener:(e,fn)=>events.set('document:'+e,fn),documentElement:{classList:{add(){}}}};
 const storage={getItem:k=>stores.get(k)??null,setItem:(k,v)=>stores.set(k,String(v)),removeItem:k=>stores.delete(k)};
 const window={document,fetch:fetchImpl,location:{href:'https://localhost/employee-schedule.html',pathname:'/employee-schedule.html',search:'',hash:'',replace(){},assign(){}},addEventListener:(e,fn)=>events.set(e,fn)};
 const context=vm.createContext({window,document,navigator:{platform:'fixture',userAgent:'fixture'},localStorage:storage,sessionStorage:storage,console,URL,URLSearchParams,Headers,Request,Response,Blob,FormData,AbortSignal,AbortController,Date:Clock,Intl,Promise,structuredClone,queueMicrotask,
 setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key),setInterval:()=>++id,clearInterval(){},fetch:(...args)=>window.fetch(...args),StatusBar:{hide:async()=>{}}});
 return {window,context,node,events,stores,timers};
}
// The old owner:{device,employee,...} cache predated the complete protected
// principal/typed recurring snapshot. Reuse the actual current page fixture;
// keep transport failure distinct from an observed rejecting HTTP response.
async function mountedSchedule(){const f=currentScheduleFixture();await f.load();await f.settle();return f;}
for(const status of[401,403,404,503])test('observed schedule '+status+' withdraws current display and retains original cache bytes',async()=>{
 const f=await mountedSchedule(),before=f.stored.get(currentScheduleKey);
 f.context.fetch=async()=>({ok:false,status,json:async()=>({ok:false})});await f.load();await f.settle();
 assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');assert.equal(f.stored.get(currentScheduleKey),before);
});
test('current online response renders and records the exact typed v2 snapshot',async()=>{
 const f=await mountedSchedule(),row=f.cache();assert.equal(f.node('content').hidden,false);assert.equal(f.node('employee').textContent,'Fixture');
 assert.equal(row.schema_version,'employee-schedule-snapshot.v2');assert.equal(row.device_id,'KIOSK_08');assert.equal(row.principal,'race-principal');
 assert.equal(row.recurring_target.target.authorityRevision,19);assert.equal(row.data.employee_id,scheduleId(2));
});
test('ordinary disconnected transport retains verified same-principal coverage quietly',async()=>{
 const f=await mountedSchedule(),before=f.stored.get(currentScheduleKey);
 f.context.fetch=async()=>{throw new TypeError('Synthetic disconnected transport');};await f.load();await f.settle();
 assert.equal(f.node('content').hidden,false);assert.equal(f.stored.get(currentScheduleKey),before);assert.match(f.node('areas').innerHTML,/Old Area/);
 assert.equal(f.node('state-text').textContent,'');
});
for(const [name,change]of[
 ['old employee',r=>{r.data.employee_id=scheduleId(90);}],['different assignment',r=>{r.data.assignment_epoch=6;}],
 ['different credential',r=>{r.data.credential_id=scheduleId(90);}],['old day',r=>{r.data.service_date='2026-09-27';}],
 ['future day',r=>{r.data.service_date='2026-09-29';}],['v1',r=>{r.schema_version='employee-schedule-snapshot.v1';}],
 ['copied principal',r=>{r.principal='foreign-principal';}],['changed typed view',r=>{r.data.raw_items[0].name='unadmitted replacement';}]
])test('schedule rejects '+name+' snapshot without rewriting it',async()=>{
 const f=currentScheduleFixture();await f.put(currentSchedulePayload(19));const row=f.cache();change(row);const raw=JSON.stringify(row);f.stored.set(currentScheduleKey,raw);
 f.context.fetch=async()=>{throw new TypeError('Synthetic disconnected transport');};await f.load();await f.settle();
 assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');assert.equal(f.stored.get(currentScheduleKey),raw);
});
test('successful transport with wrong current employee cannot render or overwrite cache',async()=>{
 const f=await mountedSchedule(),before=f.stored.get(currentScheduleKey),wrong=currentSchedulePayload(20);wrong.employee_id=scheduleId(90);
 f.context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,data:wrong})});await f.load();await f.settle();
 assert.equal(f.node('content').hidden,true);assert.equal(f.stored.get(currentScheduleKey),before);
});
test('quarantine immediately clears the already rendered schedule',async()=>{
 const f=await mountedSchedule();f.status={ready:false,available:false,quarantined:true};
 f.events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});
 assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
});
test('late typed reply cannot cross a protected principal change',async()=>{
 const f=await mountedSchedule();let release,reads=0;const reply=()=>({ok:true,status:200,json:async()=>({ok:true,data:currentSchedulePayload(20)})});
 f.context.fetch=()=>++reads===1?new Promise(resolve=>{release=()=>resolve(reply());}):Promise.resolve(reply());
 const pending=f.load();for(let n=0;n<30&&!release;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof release,'function');
 const security=f.context.window.MemphisCustodialSecurity,original=security.getStatus(),next={...original.principal,employee_id:scheduleId(90),credential_id:scheduleId(91),assignment_epoch:8};
 security.getStatus=()=>({...original,generation:8,principal:next});
 f.context.window.MemphisMobile.principalIdentity=()=> 'different-protected-principal';
 f.context.window.MemphisMobile.profileMatchesPrincipal=d=>d.employee_id===next.employee_id&&d.credential_id===next.credential_id&&d.assignment_epoch===next.assignment_epoch;
 f.events.get('memphis:custodial-security-state')({detail:security.getStatus()});release();await pending;await f.settle();
 assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');
});
const auth=source('memphis-auth.js'),bridge=source('mobile/src/shared/mobile-bridge.js').replace("import { StatusBar } from '@capacitor/status-bar';",'');
const session={role:'ops_manager',token:'RENEWED',manager_id:A,credential_id:C,device_id:'SYNTHETIC_COHORT_BROWSER',expires_at:'2026-10-07T15:00:00Z',
 auth_mode:'custodial_leadership_pin',actor_kind:'CUSTODIAL_LEADERSHIP_COHORT',access_level:'full_access',read_only:false,owner:false,custodial_management_admin:true,
 roles:['OPS_MANAGER'],permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:false,custodialManagementAdmin:true,policyVersion:1,manage_absences:true,close_scan_tickets:true}};
function sessionEnvelope(){return structuredClone({ok:true,enrolled:true,csrfToken:'synthetic-current-browser-csrf',session:{managerSession:session,
 identityAssurance:'SELF_ASSERTED_NAME',registrationId:C,claimedAccount:{accountId:B},cohort:{principalId:A,policyVersion:1,permissions:['custodialManagementAdmin']}}});}
function native(fetch){const e=environment(fetch);vm.runInContext(auth,e.context);vm.runInContext(bridge,e.context);return e;}
test('native helper reads the same server cohort session without creating owner authority',async()=>{const e=native(async()=>({ok:true,status:200,json:async()=>sessionEnvelope()}));await e.window.MemphisMobile.refresh();assert.equal(e.window.MemphisAuth.hasPermission('owner'),false);assert.equal(e.window.MemphisAuth.hasPermission('owner',e.window.MemphisAuth.readSession()),false);assert.equal(e.window.MemphisAuth.isCustodialManagementAdmin(),true);assert.equal(e.window.MemphisAuth.isCustodialManagementAdmin({...e.window.MemphisAuth.readSession()}),false,'a copied client session cannot manufacture the server binding');});
for(const asRequest of[false,true])test('native renewal replaces explicit expired token and preserves body '+asRequest,async()=>{
 const calls=[];const e=native(async(input,options)=>{const url=typeof input==='string'?input:input.url;const path=new URL(url).pathname;const headers=new Headers(options.headers);calls.push({path,token:headers.get('Authorization'),body:options.body||(input instanceof Request?await input.clone().text():undefined)});
 if(path==='/custodial-leadership-api/session')return{ok:true,status:200,json:async()=>sessionEnvelope()};
 const ok=headers.get('Authorization')==='Bearer RENEWED';return{ok,status:ok?200:401,json:async()=>({ok})};});
 e.window.MemphisMobile.adoptSession({...session,token:'EXPIRED'});
 const url='https://memphis-zoo-mcp.onrender.com/schedule-api/test',body=JSON.stringify({idempotency_key:'fixture-one',value:42}),options={method:'POST',headers:{Authorization:'Bearer EXPIRED','Content-Type':'application/json','X-CSRF-Token':'synthetic-current-browser-csrf'},body};
 const result=asRequest?await e.window.fetch(new Request(url,options)):await e.window.fetch(url,options);
 assert.equal(result.status,200);const writes=calls.filter(x=>x.path==='/schedule-api/test');assert.equal(writes.length,2);assert.deepEqual(writes.map(x=>x.body),[body,body]);assert.equal(writes.at(-1).token,'Bearer RENEWED');
});
test('native 403 cannot trigger renewal',async()=>{let count=0;const e=native(async()=>{count++;return{ok:false,status:403};});const r=await e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{headers:{Authorization:'Bearer TEST'}});assert.equal(r.status,403);assert.equal(count,1);});
test('unknown network result never retries a write',async()=>{let count=0;const e=native(async()=>{count++;throw new TypeError('Failed to fetch');});await assert.rejects(()=>e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{method:'POST',headers:{Authorization:'Bearer TEST'},body:'{}'}));assert.equal(count,1);});
test('native renewal repeats at most once',async()=>{let writes=0,renews=0;const e=native(async input=>{if(String(input).includes('/custodial-leadership-api/session')){renews++;return{ok:true,status:200,json:async()=>sessionEnvelope()};}writes++;return{ok:false,status:401};});assert.equal((await e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{headers:{Authorization:'Bearer TEST'}})).status,401);assert.equal(writes,2);assert.equal(renews,1);});
test('other origins never receive manager authority',async()=>{let headers;const e=native(async(_url,options)=>{headers=new Headers(options.headers);return{ok:true,status:200};});await e.window.fetch('https://outside.invalid/test');assert.equal(headers.has('Authorization'),false);});

test('native renewal cannot replay a write without an established original manager identity',async()=>{let writes=0;const e=native(async input=>{if(String(input).includes('/custodial-leadership-api/session'))return{ok:true,status:200,json:async()=>sessionEnvelope()};writes++;return{ok:false,status:401};});const response=await e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{method:'POST',headers:{Authorization:'Bearer UNKNOWN'},body:'{}'});assert.equal(response.status,401);assert.equal(writes,1);});
