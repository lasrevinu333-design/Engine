import assert from 'node:assert/strict';
import './synthetic-schedule-locks.mjs';
import {createHash,webcrypto} from 'node:crypto';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
const id=n=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=s=>createHash('sha256').update(s).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const day=zooServiceDate(),principal={deviceId:id(1),employeeId:id(2),credentialId:id(3),assignmentEpoch:7};
const binding='synthetic-protected-principal',key='mz_employee_schedule_snapshot:'+encodeURIComponent(binding);
const profile={authenticated:true,canonical_device_id:'KIOSK_08',employee_id:id(2),employee_name:'Fixture Custodian',credential_id:id(3),assignment_epoch:7};
function payload(revision,blocked=false){
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:id(2),employee_name:profile.employee_name,
  publication_id:id(4),projection_id:id(5),projection_status:'current',full_day:true,
  shift:{start:'07:00',end:'16:00'},raw_items:[]};
 const target={schema:blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1',
  targetType:blocked?'BLOCKED_RECURRING_AUTHORITY':'SCHEDULE',operationId:id(6),publicationId:id(4),serviceDate:day,
  authorityRevision:revision,...principal,...(blocked?{invalidationId:id(7),reasonCode:'ROSTER_DEPENDENCY_CHANGED'}:
   {projectionId:id(5),lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))})};
 return {...profile,...view,canonical_device_pk:id(1),schedule_delivery_mode:blocked?'RECURRING_TERMINAL':'RECURRING_SCHEDULE',
  recurring_delivery:{intentId:id(revision),target,targetDigest:sha(flat(target)),applicationStatus:'PENDING',
   ...(blocked?{replacementCoverageReady:false}:{viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest})},
  ...(blocked?{projection_status:'blocked_recurring_authority',shift:null}:{}),
  home_facts:{service_date:day,employee_id:id(2),employee_name:profile.employee_name,projection_status:'current',projection_id:id(5),publication_id:id(4),
   shift:{start:'07:00',end:'16:00'},lunch:{start:'12:00',end:'13:00'}}};
}
const original=Object.fromEntries(['window','document','localStorage','fetch','setInterval','clearInterval','crypto'].map(k=>[k,globalThis[k]]));
const elements=new Map(),events=new Map(),stored=new Map([['protected-cleaning-draft','keep'],['native-journal-reference','keep']]);
const element=name=>{if(!elements.has(name))elements.set(name,{textContent:'',innerHTML:'',dataset:{}});return elements.get(name);};
let next=payload(19),currentBinding=binding,failWrite=false,offline=false,mutationHook=()=>{},app,requestCount=0,currentProfile=profile,requestHook=null,
 securityStatus={ready:true,available:true,quarantined:false};
let checks=0;const check=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
try{
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
 globalThis.document={getElementById:element,addEventListener(){},hidden:false};
 globalThis.window={addEventListener:(name,fn)=>events.set(name,fn),MemphisMobile:{principalIdentity:()=>currentBinding,
  profileMatchesPrincipal:d=>d.employee_id===id(2)&&d.credential_id===id(3)&&d.assignment_epoch===7}};
 globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>{if(failWrite)throw Error('storage unavailable');stored.set(k,v);}};
 globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
 globalThis.fetch=async()=>{throw Error('unrelated informational provider deliberately unavailable');};
 app=installHomeFacts({getProfile:()=>currentProfile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,
  security:{native:true,getStatus:()=>securityStatus,mutateProtectedWork:async fn=>{mutationHook();return fn();}},
  requestJson:async()=>{requestCount++;if(requestHook)return requestHook();if(offline)throw Error('offline');return structuredClone(next);}});
 await app.update(true);
 check(element('home-shift').textContent,'7:00 AM–4:00 PM','current authenticated facts displayed');
 check(element('home-schedule-freshness').dataset.stale,'false','successful matched facts fresh');
 offline=true;await app.update(true);
 check(element('home-shift').textContent,'7:00 AM–4:00 PM','offline preserves known current shift');
 check(element('home-schedule-freshness').dataset.stale,'true','failed fetch cannot re-fresh shared cached schedule');
 offline=false;
 next=payload(20,true);await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','terminal never displays contradictory old home_facts');
 check(element('home-lunch').textContent,'Lunch unavailable','terminal clears old lunch only');
 check(element('home-schedule-freshness').textContent.includes('manager'),true,'terminal reason remains explicit');
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,20,'Home persists same protected schedule cache');
 next=payload(19);await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','late Home response cannot lower terminal');
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,20);
 next=payload(21);await app.update(true);
 check(element('home-shift').textContent,'7:00 AM–4:00 PM','explicit higher replacement restores current facts');
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,21);
 // Fail the actual response save AFTER its durable read-ahead fence exists.
 next=payload(22,true);requestHook=async()=>{failWrite=true;return structuredClone(next);};await app.update(true);requestHook=null;
 check(element('home-shift').textContent,'Schedule unavailable','storage failure cannot revive old same-page facts');
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,21,'failed save is not fabricated');
 failWrite=false;next=payload(21);await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','volatile terminal also rejects delayed lower reply');
 next=payload(22,true);await app.update(true);
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,22,'same target persists on retry');
 next=payload(23);next.recurring_delivery.targetDigest='f'.repeat(64);await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','bad hash cannot supply facts');
 next=payload(23);next.home_facts.projection_id=id(99);await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','supplemental facts must bind exact projection');
 next=payload(24);await app.update(true);
 check(element('home-shift').textContent,'7:00 AM–4:00 PM');
 const row=JSON.parse(stored.get(key));const terminal=payload(25,true);
 const helper=globalThis.MemphisRecurringScheduleTarget||window.MemphisRecurringScheduleTarget;
 const prepared=await helper.prepare({delivery:terminal.recurring_delivery,expectedPrincipal:principal,serviceDate:day});
 mutationHook=()=>{stored.set(key,JSON.stringify({...row,data:terminal,recurring_target:prepared}));mutationHook=()=>{};};
 next=payload(24);await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','protected barrier rereads another page winner');
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,25);
 // Schedule-page accepted cache must win immediately even before a new fetch.
 next=payload(26);await app.update(true);const currentRow=JSON.parse(stored.get(key));
 stored.set(key,JSON.stringify({...currentRow,data:terminal,recurring_target:prepared}));
 // Higher source wins only; simulate next terminal, not a lower manual cache edit.
 const higher=payload(27,true),higherPrepared=await helper.prepare({delivery:higher.recurring_delivery,expectedPrincipal:principal,serviceDate:day});
 stored.set(key,JSON.stringify({...currentRow,data:higher,recurring_target:higherPrepared}));
 const before=requestCount;events.get('storage')?.({key});
 check(element('home-shift').textContent,'Schedule unavailable','storage event redraws shared terminal without waiting for network');
 check(requestCount,before,'storage redraw itself makes no network request');
 check(stored.get('protected-cleaning-draft'),'keep');check(stored.get('native-journal-reference'),'keep');
 check([...stored.keys()].some(k=>/notification.*receipt/.test(k)),false,'Home never invents complete phone ACK');
 next=payload(28);next.home_facts.schedule_status='off';next.home_facts.shift={active:false};next.home_facts.lunch=null;await app.update(true);
 check(element('home-shift').textContent,'Not scheduled today','bound off-day facts remain truthful');
 check(element('home-lunch').textContent,'Not scheduled');
 next=payload(29);mutationHook=()=>{currentBinding='different-protected-principal';mutationHook=()=>{};};await app.update(true);
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,28,'identity change at protected barrier cannot mutate old cache');
 currentBinding=binding;
 const homeId={deviceId:'KIOSK_08',employeeId:id(2),employeeName:profile.employee_name,credentialId:id(3),assignmentEpoch:7,protectedBinding:binding};
 const aborted=new AbortController();aborted.abort();
 const converger=createScheduleHomeConvergence({identity:()=>homeId,storage:localStorage,mutate:async fn=>fn(),matches:()=>true});
 await assert.rejects(()=>converger.accept(payload(29),homeId,{signal:aborted.signal}),/schedule_target_principal/);checks++;
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,28,'disposed request never writes late');
 const delayed=new AbortController();
 const atBarrier=createScheduleHomeConvergence({identity:()=>homeId,storage:localStorage,mutate:async fn=>{delayed.abort();return fn();},matches:()=>true});
 await assert.rejects(()=>atBarrier.accept(payload(29),homeId,{signal:delayed.signal}),/schedule_target_principal/);checks++;
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,28,'abort rechecked inside protected barrier');
 const legacy=payload(29);delete legacy.schedule_delivery_mode;delete legacy.recurring_delivery;
 await assert.rejects(()=>converger.accept(legacy,homeId),/schedule_target_unverified_transition/);checks++;
 next=payload(30);next.home_facts.stale=true;await app.update(true);
 check(element('home-schedule-freshness').dataset.stale,'true','exact-bound supplemental stale flag cannot be overwritten');
 let releaseOld,reachedOld;let requestReached=new Promise(resolve=>{reachedOld=resolve;});
 requestHook=()=>new Promise(resolve=>{releaseOld=resolve;reachedOld();});
 const oldRequest=app.update(true);await requestReached;
 currentProfile=null;await app.update(true);currentProfile=profile;requestHook=null;next=payload(31,true);await app.update(true);
 releaseOld(payload(99));await oldRequest;
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,31,'A-null-A invalidates pre-transition Home request');
 check(element('home-shift').textContent,'Schedule unavailable','old request cannot render after identity returns');
 requestReached=new Promise(resolve=>{reachedOld=resolve;});requestHook=()=>new Promise(resolve=>{releaseOld=resolve;reachedOld();});const superseded=app.update(true);await requestReached;
 requestHook=null;next=payload(32,true);await app.update(true);releaseOld(payload(100));await superseded;
 check(JSON.parse(stored.get(key)).recurring_target.target.authorityRevision,32,'forced refresh replaces old in-flight generation');
 // Security revocation stays latched across all redraw entry points even if
 // the profile and protected principal string remain cached and unchanged.
 next=payload(33);await app.update(true);
 check(element('home-shift').textContent,'7:00 AM–4:00 PM','usable hours precede quarantine attack');
 securityStatus={ready:false,available:false,quarantined:true};
 events.get('memphis:custodial-security-state')({detail:securityStatus});
 events.get('online')();events.get('storage')({key});await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','quarantined Home cannot restore cached hours');
 check(element('home-schedule-freshness').dataset.stale,'true','quarantined Home never fresh');
 securityStatus={ready:true,available:true,quarantined:false};
 await app.update(true);check(element('home-shift').textContent,'Schedule unavailable','old invalid event remains latched until positive security event');
 events.get('memphis:custodial-security-state')({detail:securityStatus});next=payload(33);await app.update(true);
 check(element('home-shift').textContent,'7:00 AM–4:00 PM','verified security recovery may read current schedule');
 next={...payload(34),schedule_delivery_mode:'UNAVAILABLE'};await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','native UNAVAILABLE suppresses duplicate old facts');
 offline=true;await app.update(true);events.get('storage')({key});
 check(element('home-shift').textContent,'Schedule unavailable','outage after UNAVAILABLE cannot revive earlier usable facts');offline=false;
 app.stop();
 app=installHomeFacts({getProfile:()=>profile,getDeviceId:()=> 'KIOSK_08',isVisible:()=>true,
  security:{native:false,mutateProtectedWork:async fn=>fn()},requestJson:async()=>structuredClone(next)});
 next=payload(40,true);await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','browser typed terminal cannot use duplicate home shift');
 check(element('home-schedule-freshness').dataset.stale,'true','browser blocked facts are never fresh usable coverage');
 next=payload(39);await app.update(true);check(element('home-shift').textContent,'Schedule unavailable','browser terminal also keeps monotonic floor');
 next=payload(41);await app.update(true);check(element('home-shift').textContent,'7:00 AM–4:00 PM','browser validated later replacement is usable');
 next={...payload(42),schedule_delivery_mode:'UNAVAILABLE'};await app.update(true);
 check(element('home-shift').textContent,'Schedule unavailable','browser UNAVAILABLE follows exact shared dispatch');
 app.stop();app=null;
 console.log(JSON.stringify({status:'PASS',checks,scope:'actual Home modules with synthetic auth/network/storage; shared typed schedule monotonic cache, cross-page terminal, failure and protected data; no phone or native notification proof'}));
}finally{
 app?.stop();for(const [k,v]of Object.entries(original)){if(v===undefined)delete globalThis[k];else Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});}
}
