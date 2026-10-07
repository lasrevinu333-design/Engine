import assert from 'node:assert/strict';
import {scheduleLocks} from './synthetic-schedule-locks.mjs';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const helper=readFileSync(new URL('../memphis-recurring-schedule-target.js',import.meta.url),'utf8');
const id=n=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=s=>createHash('sha256').update(s).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const day='2026-09-28',principal={deviceId:id(1),employeeId:id(2),credentialId:id(3),assignmentEpoch:7};
const nativePrincipal={employee_id:principal.employeeId,credential_id:principal.credentialId,assignment_epoch:7};
const identity='synthetic-protected-principal',key='mz_employee_schedule_snapshot:'+encodeURIComponent(identity);
function payload(revision,blocked=false){
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:principal.employeeId,
  employee_name:'Synthetic Employee',publication_id:id(4),projection_id:id(5),projection_status:'current',full_day:true,
  shift:{start:'07:00',end:'16:00'},raw_items:[{name:'Synthetic Restroom',coverage_start:'07:00',coverage_end:'16:00'}]};
 const target={schema:blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1',
  targetType:blocked?'BLOCKED_RECURRING_AUTHORITY':'SCHEDULE',operationId:id(6),publicationId:id(4),serviceDate:day,
  authorityRevision:revision,...principal,...(blocked?{invalidationId:id(7),reasonCode:'ROSTER_DEPENDENCY_CHANGED'}:
   {projectionId:id(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))})};
 const delivery={intentId:id(revision),target,targetDigest:sha(flat(target)),applicationStatus:'PENDING',
  ...(blocked?{replacementCoverageReady:false}:{view,viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest})};
 return{...(blocked?{service_date:day,employee_id:principal.employeeId,employee_name:'Synthetic Employee',projection_status:'blocked_recurring_authority',full_day:true,raw_items:[],shift:null}:view),
  canonical_device_id:'KIOSK_08',canonical_device_pk:principal.deviceId,credential_id:principal.credentialId,assignment_epoch:7,
  schedule_delivery_mode:blocked?'RECURRING_TERMINAL':'RECURRING_SCHEDULE',recurring_delivery:delivery,schedule_application:null};
}
const now=Date.parse(day+'T17:00:00Z'),FixedDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
const elements=new Map(),events=new Map(),stored=new Map([['protected-cleaning-draft','do not touch'],['native-journal-reference','do not touch']]),calls=[];
const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',hidden:false,addEventListener(){}});return elements.get(id);};
let next=payload(19),mutationHook=()=>{},fetchCount=0;
next.raw_items=[{name:'Unbound duplicate payload',coverage_start:'07:00',coverage_end:'16:00'}];
const context={Date:FixedDate,Intl,URL,console,crypto:webcrypto,TextEncoder,AbortController,
 document:{getElementById:element,addEventListener(){},hidden:false},
 localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)},
 fetch:async()=>{fetchCount++;return{ok:true,json:async()=>({ok:true,data:structuredClone(next)})};},
 setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){}};
context.window={navigator:{locks:scheduleLocks},crypto:webcrypto,addEventListener:(name,fn)=>events.set(name,fn),
 MemphisCustodialSecurity:{native:true,getStatus:()=>({deviceId:'KIOSK_08',principal:nativePrincipal,ready:true,available:true,quarantined:false}),
  mutateProtectedWork:async fn=>{mutationHook();return fn();}},
 MemphisMobile:{ready:Promise.resolve(),deviceId:()=> 'KIOSK_08',principalIdentity:()=>identity,
  profileMatchesPrincipal:d=>d.employee_id===principal.employeeId&&d.credential_id===principal.credentialId&&d.assignment_epoch===7,
  requestJson:async(path,options)=>{calls.push({path,options});return{};}}};
const waitFor=async(predicate,label)=>{const end=Date.now()+2000;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,10));assert.ok(predicate(),label);};
vm.createContext(context);vm.runInContext(helper,context);vm.runInContext(inline,context);
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const cache=()=>JSON.parse(stored.get(key)||'null');
await waitFor(()=>cache()?.recurring_target?.target.authorityRevision===19,'schedule cache persisted');
check(cache().recurring_target.viewJsonText,next.recurring_delivery.viewJsonText,'exact SQL text persisted');
check(element('areas').innerHTML.includes('Synthetic Restroom'),true,'actual page rendered verified schedule');
check(calls.some(x=>x.path.endsWith('delivery-receipt')),false,'notification cleanup still pending: no fabricated complete-phone ACK');
next=payload(20,true);events.get('online')();
await waitFor(()=>cache()?.recurring_target?.blocked===true,'terminal cache persisted');
check(element('content').hidden,true);check(element('areas').innerHTML,'');check(element('lunch-areas').innerHTML,'');
check(element('notice').textContent.includes('saved cleaning work is preserved'),true);
next=payload(19);events.get('online')();
// A successfully received but rejected authority response does not restore the
// pre-request cache's availability. The durable read-ahead fence remains closed
// until a current valid response wins; the terminal high-water is still retained.
await waitFor(()=>fetchCount===3&&element('state-text').textContent==='Schedule could not update.','delayed response handled fail-closed');
check(element('content').hidden,true,'rejected stale authority leaves schedule unavailable');
check(context.window.MemphisRecurringScheduleTarget.availability(context.localStorage,identity,day).state,'READING','rejected response cannot clear durable uncertainty');
check(cache().recurring_target.target.authorityRevision,20,'delayed schedule cannot overwrite blocked revision');
check(element('areas').innerHTML,'','delayed schedule cannot rerender old duties');
// A different page wins AFTER async prepare but BEFORE protected save.
const newer=payload(22,true),prepared=await context.window.MemphisRecurringScheduleTarget.prepare({delivery:newer.recurring_delivery,
 expectedPrincipal:principal,serviceDate:day});
mutationHook=()=>{stored.set(key,JSON.stringify({schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal:identity,
 data:newer,recurring_target:prepared}));mutationHook=()=>{};};
next=payload(21);events.get('online')();
await waitFor(()=>fetchCount===4&&cache()?.recurring_target.target.authorityRevision===22,'concurrent cache winner observed');
check(cache().recurring_target.blocked,true,'barrier rechecks actual latest cache');
check(element('areas').innerHTML,'','losing response cannot render after barrier rejection');
check(stored.get('protected-cleaning-draft'),'do not touch');check(stored.get('native-journal-reference'),'do not touch');
check(calls.some(x=>x.path.endsWith('delivery-receipt')||x.path.endsWith('application-receipt')),false,'typed rendering never impersonates full notification application');
console.log(JSON.stringify({status:'PASS',checks,scope:'actual employee-page synthetic DOM protected cache/render, terminal precedence, delayed response and barrier race; typed ACK intentionally pending native/browser notification integration'}));
