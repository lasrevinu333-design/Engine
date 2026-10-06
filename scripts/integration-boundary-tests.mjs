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
const script=[...source('employee-schedule.html').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim())[0];
const owner={device:'KIOSK_08',employee:A,generation:2,epoch:2,credential:C};
const data={employee_name:'CURRENT EMPLOYEE',service_date:'2026-10-06',current_items:[{name:'CURRENT AREA',coverage_start:'08:00',coverage_end:'14:00'}]};
const body={ok:true,data,meta:{canonical_device_id:'KIOSK_08',employee_id:A,assignment_epoch:2,credential_id:C}};
const saved={schema_version:'employee-schedule-snapshot.v2',owner,saved_at:'2026-10-06T14:55:00Z',data};
async function schedule({status=200,snapshot=saved,payload=body,pending=null}={}){
 const e=environment(async()=>{if(pending)await pending;return{ok:status===200,status,json:async()=>structuredClone(payload)};},{'mz_employee_schedule_snapshot:KIOSK_08':JSON.stringify(snapshot)});
 let profile={employee_id:A,assignment_epoch:2,credential_id:C},security={state:'enrolled',ready:true,available:true,deviceId:'KIOSK_08',generation:2};
 e.window.MemphisAuth={getCSTDateString:()=> '2026-10-06',getChicagoMinutes:()=>600};
 e.window.MemphisMobile={ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',readCustodialHomeCache:()=>({profile})};
 e.window.MemphisCustodialSecurity={getStatus:()=>security,mutateProtectedWork:async fn=>fn()};
 e.changeProfile=x=>{profile={...profile,...x};};e.changeSecurity=x=>{security={...security,...x};};
 vm.runInContext(script,e.context,{filename:'actual-employee-schedule-inline'});await settle();return e;
}
for(const status of[401,403,404])test('schedule '+status+' withdraws current cache, not offline authority',async()=>{const e=await schedule({status});assert.equal(e.node('content').hidden,true);assert.equal(e.node('areas').innerHTML,'');assert.ok(e.stores.has('mz_employee_schedule_snapshot:KIOSK_08'));});
test('current online response renders and records bound v2 snapshot',async()=>{const e=await schedule();assert.equal(e.node('content').hidden,false);assert.equal(e.node('employee').textContent,'CURRENT EMPLOYEE');const s=JSON.parse(e.stores.get('mz_employee_schedule_snapshot:KIOSK_08'));assert.deepEqual(s.owner,owner);});
test('temporary failure retains same-assignment current coverage only',async()=>{const e=await schedule({status:503});assert.equal(e.node('content').hidden,false);assert.match(e.node('state-text').textContent,/No connection/);});
for(const [name,change]of[
 ['old employee',{owner:{...owner,employee:B}}],['different assignment',{owner:{...owner,epoch:1}}],['different credential',{owner:{...owner,credential:B}}],['old day',{data:{...data,service_date:'2026-10-05'}}],['expired area',{data:{...data,current_items:[{name:'OLD AREA',coverage_start:'08:00',coverage_end:'09:59'}]}}],['v1',{schema_version:'employee-schedule-snapshot.v1'}],['future timestamp',{saved_at:'2026-10-07T00:00:00Z'}]
])test('schedule rejects '+name+' snapshot',async()=>{const e=await schedule({status:503,snapshot:{...saved,...change}});assert.equal(e.node('content').hidden,true);assert.equal(e.node('areas').innerHTML,'');});
test('successful transport with wrong identity cannot render or overwrite cache',async()=>{const e=await schedule({payload:{...body,meta:{...body.meta,employee_id:B}}});assert.equal(e.node('content').hidden,true);assert.equal(JSON.parse(e.stores.get('mz_employee_schedule_snapshot:KIOSK_08')).saved_at,saved.saved_at);});
test('quarantine immediately clears already rendered schedule',async()=>{const e=await schedule();e.changeSecurity({ready:false,available:false,quarantined:true});e.events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});assert.equal(e.node('content').hidden,true);assert.equal(e.node('areas').innerHTML,'');});
test('late reply cannot cross reassignment',async()=>{let done;const pending=new Promise(r=>{done=r;});const e=await schedule({pending});e.changeProfile({employee_id:B,assignment_epoch:3});e.events.get('memphis:schedule-refresh')();done();await settle();assert.equal(e.node('content').hidden,true);assert.equal(e.node('areas').innerHTML,'');});
const auth=source('memphis-auth.js'),bridge=source('mobile/src/shared/mobile-bridge.js').replace("import { StatusBar } from '@capacitor/status-bar';",'');
const session={role:'ops_manager',token:'RENEWED',manager_id:A,credential_id:C,device_id:'OWNER_BROWSER',expires_at:'2026-10-07T15:00:00Z',access_level:'full_access',read_only:false,roles:['OPS_MANAGER','CUSTODIAL_MANAGER'],permissions:{schema:'custodial.manager-permissions.v1',read:true,owner:true,manage_absences:true,close_scan_tickets:true}};
function native(fetch){const e=environment(fetch);vm.runInContext(auth,e.context);vm.runInContext(bridge,e.context);return e;}
test('native helper reads the same owner session as public accessor',async()=>{const e=native(async()=>({ok:true,status:200,json:async()=>({ok:true,data:{session}})}));await e.window.MemphisMobile.refresh();assert.equal(e.window.MemphisAuth.hasPermission('owner'),true);assert.equal(e.window.MemphisAuth.hasPermission('owner',e.window.MemphisAuth.readSession()),true);});
for(const asRequest of[false,true])test('native renewal replaces explicit expired token and preserves body '+asRequest,async()=>{
 const calls=[];const e=native(async(input,options)=>{const url=typeof input==='string'?input:input.url;const path=new URL(url).pathname;const headers=new Headers(options.headers);calls.push({path,token:headers.get('Authorization'),body:options.body||(input instanceof Request?await input.clone().text():undefined)});
 if(path==='/auth-api/session')return{ok:true,status:200,json:async()=>({ok:true,data:{session}})};
 const ok=headers.get('Authorization')==='Bearer RENEWED';return{ok,status:ok?200:401,json:async()=>({ok})};});
 e.window.MemphisMobile.adoptSession({...session,token:'EXPIRED'});
 const url='https://memphis-zoo-mcp.onrender.com/schedule-api/test',body=JSON.stringify({idempotency_key:'fixture-one',value:42}),options={method:'POST',headers:{Authorization:'Bearer EXPIRED','Content-Type':'application/json'},body};
 const result=asRequest?await e.window.fetch(new Request(url,options)):await e.window.fetch(url,options);
 assert.equal(result.status,200);const writes=calls.filter(x=>x.path==='/schedule-api/test');assert.equal(writes.length,2);assert.deepEqual(writes.map(x=>x.body),[body,body]);assert.equal(writes.at(-1).token,'Bearer RENEWED');
});
test('native 403 cannot trigger renewal',async()=>{let count=0;const e=native(async()=>{count++;return{ok:false,status:403};});const r=await e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{headers:{Authorization:'Bearer TEST'}});assert.equal(r.status,403);assert.equal(count,1);});
test('unknown network result never retries a write',async()=>{let count=0;const e=native(async()=>{count++;throw new TypeError('Failed to fetch');});await assert.rejects(()=>e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{method:'POST',headers:{Authorization:'Bearer TEST'},body:'{}'}));assert.equal(count,1);});
test('native renewal repeats at most once',async()=>{let writes=0,renews=0;const e=native(async input=>{if(String(input).includes('/auth-api/session')){renews++;return{ok:true,status:200,json:async()=>({ok:true,data:{session}})};}writes++;return{ok:false,status:401};});assert.equal((await e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{headers:{Authorization:'Bearer TEST'}})).status,401);assert.equal(writes,2);assert.equal(renews,1);});
test('other origins never receive manager authority',async()=>{let headers;const e=native(async(_url,options)=>{headers=new Headers(options.headers);return{ok:true,status:200};});await e.window.fetch('https://outside.invalid/test');assert.equal(headers.has('Authorization'),false);});

test('native renewal cannot replay a write without an established original manager identity',async()=>{let writes=0;const e=native(async input=>{if(String(input).includes('/auth-api/session'))return{ok:true,status:200,json:async()=>({ok:true,data:{session}})};writes++;return{ok:false,status:401};});const response=await e.window.fetch('https://memphis-zoo-mcp.onrender.com/schedule-api/test',{method:'POST',headers:{Authorization:'Bearer UNKNOWN'},body:'{}'});assert.equal(response.status,401);assert.equal(writes,1);});
