import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scheduleLocks} from './synthetic-schedule-locks.mjs';
const html=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1]
 .replace("void load('launch');","globalThis.testPage={load,snapshot};");
const helper=readFileSync(new URL('../memphis-recurring-schedule-target.js',import.meta.url),'utf8');
const id=n=>`95000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=s=>createHash('sha256').update(s).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const day='2026-09-28',principal={deviceId:id(1),employeeId:id(2),credentialId:id(3),assignmentEpoch:7};
const key='mz_employee_schedule_snapshot:race-principal';
function payload(revision,blocked=false,date=day){
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:date,employee_id:id(2),employee_name:'Fixture',
  publication_id:id(4),projection_id:id(5),projection_status:'current',full_day:true,shift:{start:'07:00',end:'16:00'},
  raw_items:[{name:'Old Area',coverage_start:'07:00',coverage_end:'16:00'}]};
 const target={schema:blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1',
  targetType:blocked?'BLOCKED_RECURRING_AUTHORITY':'SCHEDULE',operationId:id(6),publicationId:id(4),serviceDate:date,authorityRevision:revision,
  ...principal,...(blocked?{invalidationId:id(7),reasonCode:'ROSTER_DEPENDENCY_CHANGED'}:{projectionId:id(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))})};
 return {...view,canonical_device_id:'KIOSK_08',canonical_device_pk:id(1),credential_id:id(3),assignment_epoch:7,
  ...(blocked?{projection_status:'blocked_recurring_authority',raw_items:[],shift:null}:{}),
  schedule_delivery_mode:blocked?'RECURRING_TERMINAL':'RECURRING_SCHEDULE',recurring_delivery:{intentId:id(revision),target,targetDigest:sha(flat(target)),
   applicationStatus:'PENDING',...(blocked?{replacementCoverageReady:false}:{view,viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest})}};
}
function fixture(){
 const stored=new Map(),nodes=new Map(),events=new Map(),calls=[];let readFails=false,writeFails=false,after=()=>{},next=payload(19),status={ready:true,available:true,quarantined:false};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',hidden:false,addEventListener(){}});return nodes.get(id);};
 const now=Date.parse(day+'T17:00:00Z'),FixedDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 const context=vm.createContext({Date:FixedDate,Intl,URL,console,crypto:webcrypto,TextEncoder,AbortController,
  document:{getElementById:node,addEventListener(){},hidden:false},setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){},
  localStorage:{getItem:k=>{if(readFails)throw Error('unreadable storage');return stored.get(k)??null;},setItem:(k,v)=>{if(writeFails)throw Error('failed storage');stored.set(k,v);}},
  fetch:async()=>{calls.push('GET');return{ok:true,json:async()=>({ok:true,data:structuredClone(next)})};}});
 context.window={navigator:{locks:scheduleLocks},crypto:webcrypto,addEventListener:(name,fn)=>events.set(name,fn),MemphisCustodialSecurity:{native:true,
  getStatus:()=>({...status,deviceId:'KIOSK_08',principal:{employee_id:id(2),credential_id:id(3),assignment_epoch:7}}),
  mutateProtectedWork:async fn=>{const result=fn();after();return result;}},
  MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',principalIdentity:()=> 'race-principal',
   profileMatchesPrincipal:d=>d.employee_id===id(2)&&d.credential_id===id(3)&&d.assignment_epoch===7,
   requestJson:async(path)=>{calls.push(path);return{};}}};
 vm.runInContext(helper,context);vm.runInContext(inline,context);
 const put=async(data)=>{const prepared=await context.window.MemphisRecurringScheduleTarget.prepare({delivery:data.recurring_delivery,expectedPrincipal:principal,serviceDate:data.service_date});
  stored.set(key,JSON.stringify({schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal:'race-principal',data,recurring_target:prepared}));};
 return{context,stored,node,events,calls,put,load:()=>context.testPage.load(),cache:()=>JSON.parse(stored.get(key)||'null'),
  set next(v){next=v;},set readFails(v){readFails=v;},set writeFails(v){writeFails=v;},set after(v){after=v;},set status(v){status=v;}};
}
const results=[];
async function test(name,work){try{await work();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
await test('storage read failure cannot overwrite terminal',async()=>{const f=fixture();await f.put(payload(20,true));f.readFails=true;await f.load();f.readFails=false;assert.equal(f.cache().recurring_target.target.authorityRevision,20);assert.equal(f.node('content').hidden,true);});
await test('corrupt cache is not absence authority',async()=>{const f=fixture();f.stored.set(key,'broken-json');await f.load();assert.equal(f.stored.get(key),'broken-json');assert.equal(f.node('content').hidden,true);});
await test('failed terminal save remains a live revision floor',async()=>{const f=fixture();await f.load();f.next=payload(20,true);const fetch=f.context.fetch;f.context.fetch=async()=>{const result=await fetch();f.writeFails=true;return result;};await f.load();f.context.fetch=fetch;f.writeFails=false;f.next=payload(19);await f.load();assert.equal(f.node('content').hidden,true);assert.equal(f.node('areas').innerHTML,'');});
await test('prior-day response cannot replace current terminal',async()=>{const f=fixture();await f.put(payload(20,true));f.next=payload(19,false,'2026-09-27');await f.load();assert.equal(f.cache().recurring_target.target.authorityRevision,20);assert.equal(f.node('content').hidden,true);});
await test('post-callback newer stored winner must be rendered',async()=>{const f=fixture();await f.load();const staged=fixture();await staged.put(payload(22,true));const row=staged.stored.get(key);
 f.after=()=>f.stored.set(key,row);f.next=payload(21);await f.load();assert.equal(f.cache().recurring_target.target.authorityRevision,22);assert.equal(f.node('content').hidden,true);});
await test('losing legacy result cannot render or ACK after terminal wins',async()=>{const f=fixture(),staged=fixture();await staged.put(payload(22,true));
 const legacy=payload(21);delete legacy.schedule_delivery_mode;delete legacy.recurring_delivery;
 legacy.schedule_application={application_status:'PENDING',intent_id:id(21),authority_revision:21,publication_id:id(4),projection_id:id(5),lunch_document_identity:'a'.repeat(64)};
 f.after=()=>f.stored.set(key,staged.stored.get(key));f.next=legacy;await f.load();
 assert.equal(f.node('content').hidden,true);assert.ok(!f.calls.some(x=>x.endsWith('application-receipt')));});
await test('browser Schedule preserves terminal floor without native storage',async()=>{const f=fixture();f.context.window.MemphisCustodialSecurity.native=false;
 f.next=payload(20,true);await f.load();f.next=payload(19);await f.load();assert.equal(f.node('content').hidden,true);assert.equal(f.stored.size,0);});
await test('quarantine during target preparation cannot write',async()=>{const f=fixture();await f.load();const api=f.context.window.MemphisRecurringScheduleTarget,prepare=api.prepare;
 f.context.window.MemphisRecurringScheduleTarget={...api,prepare:async args=>{const result=await prepare(args);f.status={ready:false,available:false,quarantined:true};f.events.get('memphis:custodial-security-state')({detail:{ready:false,available:false,quarantined:true}});return result;}};
 f.next=payload(21);await f.load();assert.equal(f.cache().recurring_target.target.authorityRevision,19);assert.equal(f.node('content').hidden,true);});
await test('refresh event during preparation queues latest read',async()=>{const f=fixture();await f.load();const api=f.context.window.MemphisRecurringScheduleTarget,prepare=api.prepare;let first=true;
 f.context.window.MemphisRecurringScheduleTarget={...api,prepare:async args=>{const result=await prepare(args);if(first){first=false;f.next=payload(22,true);f.events.get('memphis:schedule-refresh')();}return result;}};
 f.next=payload(21);await f.load();const end=Date.now()+1500;
 while(f.cache()?.recurring_target.target.authorityRevision!==22&&Date.now()<end)await new Promise(r=>setTimeout(r,5));
 assert.equal(f.cache().recurring_target.target.authorityRevision,22);assert.equal(f.node('content').hidden,true);});
console.log(JSON.stringify({scope:'actual Schedule page with synthetic storage, native mutation, invalidation and transport races',passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results},null,2));
process.exitCode=results.some(x=>!x.passed)?1:0;
export {fixture,payload,day,key,id,principal};
