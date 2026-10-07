import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import './synthetic-schedule-locks.mjs';
import {createScheduleHomeConvergence} from '../mobile/src/custodial/schedule-home-convergence.js';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
import {fixture,principal,data,turn} from './native-notification-arrival-boundary-tests.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const flat=x=>'{'+Object.keys(x).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(x[k])).join(', ')+'}';
const id=n=>`ad000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope=principalIdentity(principal),key='mz_employee_schedule_snapshot:'+encodeURIComponent(scope),day=zooServiceDate();
const profile={canonical_device_id:'KIOSK_08',employee_id:principal.employee_id,credential_id:principal.credential_id,assignment_epoch:7};
function payload(revision,blocked=false){
 const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:principal.employee_id,
  employee_name:'Synthetic Custodian',publication_id:id(revision),projection_id:id(revision+1000),projection_status:'current',
  full_day:true,shift:{start:'07:00',end:'16:00'},raw_items:[]};
 const target={schema:blocked?'static-weekly.recurring-terminal-target.v1':'static-weekly.recurring-application-target.v1',
  targetType:blocked?'BLOCKED_RECURRING_AUTHORITY':'SCHEDULE',operationId:id(revision+2000),publicationId:view.publication_id,
  serviceDate:day,authorityRevision:revision,deviceId:id(1),employeeId:principal.employee_id,credentialId:principal.credential_id,assignmentEpoch:7,
  ...(blocked?{invalidationId:id(2),reasonCode:'ROSTER_DEPENDENCY_CHANGED'}:
   {projectionId:view.projection_id,lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))})};
 return {...profile,...view,canonical_device_pk:id(1),schedule_delivery_mode:blocked?'RECURRING_TERMINAL':'RECURRING_SCHEDULE',
  recurring_delivery:{intentId:id(revision+3000),target,targetDigest:sha(flat(target)),applicationStatus:'PENDING',
   ...(blocked?{replacementCoverageReady:false}:{viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest})}};
}
const event=(revision,keySuffix='')=>({notification:{title:'Synthetic lunch',body:'Synthetic current coverage',data:{...data,
 notification_key:`lunch:${revision}:${keySuffix}`,service_date:day,projection_id:id(revision+1000),document_identity:'a'.repeat(64)}}});
const row=async p=>{const prepared=await globalThis.MemphisRecurringScheduleTarget.prepare({delivery:p.recurring_delivery,serviceDate:day,expectedPrincipal:p.recurring_delivery.target});
 return {schema_version:'employee-schedule-snapshot.v2',device_id:'KIOSK_08',principal:scope,
 data:{...p,...(prepared.blocked?{projection_status:'blocked_recurring_authority',raw_items:[],full_day:true,shift:null}:prepared.view)},recurring_target:prepared};};
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
{
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};let security={ready:true,available:true},binding=scope;
 const owner=createScheduleNotificationAuthority({identity:()=>binding,principal:()=>principal,status:()=>{if(security instanceof Error)throw security;return security;},storage});
 check(owner.isCurrent(event(1).notification.data,scope),false,'unknown schedule never grants display');
 check(await owner.observe(payload(10)),true,'authenticated full typed response accepted');
 check(owner.isCurrent(event(10).notification.data,scope),true,'same exact lunch projection/document eligible');
 check(owner.isCurrent(event(9).notification.data,scope),false,'old projection denied');
 check(owner.isCurrent({...event(10).notification.data,document_identity:'b'.repeat(64)},scope),false,'changed lunch denied');
 check(owner.isCurrent({...event(10).notification.data,service_date:'2026-01-01'},scope),false,'other date denied');
 check(owner.isCurrent({...event(10).notification.data,receipt_credential_id:id(88)},scope),false,'wrong credential denied');
 check(owner.isCurrent({...event(10).notification.data,kind:'employee_location_status',projection_id:undefined},scope),false,'unbound location hint denied, never inferred');
 check(owner.isCurrent({...event(10).notification.data,kind:'employee_location_status'},scope),true,'explicit same-projection location eligible');
 check(await owner.observe({...payload(11,true),current_items:[{name:'Unbound stale duplicated area'}]}),true,'authenticated terminal drops unbound alternate items before validation');
 check(owner.isCurrent(event(10).notification.data,scope),false,'observed terminal denies before cache write');
 await assert.rejects(owner.observe(payload(10)));checks++;
 check(owner.isCurrent(event(10).notification.data,scope),false,'older response cannot revive');
 await owner.observe(payload(12));check(owner.isCurrent(event(12).notification.data,scope),true,'explicit newer replacement');
 memory.set(key,'null');check(owner.isCurrent(event(12).notification.data,scope),false,'falsy cache fails closed');memory.delete(key);
 check(owner.isCurrent(event(12).notification.data,scope),true,'known live high-water survives missing key');
 memory.set(key,JSON.stringify(await row(payload(13,true))));
 check(owner.isCurrent(event(12).notification.data,scope),false,'disk terminal vetoes before asynchronous validation');
 await owner.refresh();memory.delete(key);
 check(owner.isCurrent(event(12).notification.data,scope),false,'observed disk winner survives deletion');
 await owner.observe(payload(14));await owner.unavailable();
 check(owner.isCurrent(event(14).notification.data,scope),false,'unavailable latches');
 await owner.refresh();check(owner.isCurrent(event(14).notification.data,scope),false,'cache refresh cannot clear server unavailability');
 await owner.observe(payload(14));
 check(owner.isCurrent(event(14).notification.data,scope),false,'response alone cannot clear durable unavailable before exact UI application');
 await applyPage(payload(14),storage);await owner.refresh();
 check(owner.isCurrent(event(14).notification.data,scope),true,'validated same current response plus actual page commit recovers');
 security={ready:false,available:false};check(owner.isCurrent(event(14).notification.data,scope),false,'actual security status checked');
 security={ready:true,available:true};owner.securityChanged({});check(owner.isCurrent(event(14).notification.data,scope),false,'empty security event latches');
 owner.securityChanged(security);check(owner.isCurrent(event(14).notification.data,scope),true,'explicit good status and event recover');
 security={ready:false,available:false,quarantined:true};owner.securityChanged(security);
 owner.securityChanged({ready:true,available:true,quarantined:false});security={ready:true,available:true,quarantined:false};
 check(owner.isCurrent(event(14).notification.data,scope),false,'positive event while live status quarantined cannot clear latch');
 owner.securityChanged(security);check(owner.isCurrent(event(14).notification.data,scope),true,'matching later positive event can recover');
 const late=owner.observe(payload(15));owner.securityChanged({});owner.securityChanged(security);check(await late,false,'security ABA fences in-flight hash');
 security=new Error('synthetic protected status unavailable');
 check(owner.isCurrent(event(14).notification.data,scope),false,'throwing live status denies action');
 security={ready:true,available:true,quarantined:false};
 check(owner.isCurrent(event(14).notification.data,scope),false,'status recovery alone cannot clear a thrown-status quarantine');
 owner.securityChanged(security);
 check(owner.isCurrent(event(14).notification.data,scope),true,'new corroborated positive event clears thrown-status quarantine');
 binding='different';check(owner.isCurrent(event(14).notification.data,scope),false,'principal substitution denied');
}
{
 const f=await fixture({scheduleAuthorityFactory:createScheduleNotificationAuthority});
 await f.scheduleAuthority.observe(payload(20));await f.emit('firebase','notificationReceived',event(20));
 check(f.scheduled.length,1,'actual bridge mounts schedule guard for local OS owner');
 const old=structuredClone(f.scheduled[0].notifications[0]);
 await f.scheduleAuthority.observe(payload(21,true));await f.mobile.retryNotificationPresentation();
 check(f.scheduled.length,0,'terminal cancels exact OS notification');
 await f.emit('local','localNotificationActionPerformed',{notification:old,actionId:'tap'});
 check(f.effects.some(v=>v.startsWith('route:')),false,'late OS action denied');
 await f.emit('firebase','notificationReceived',event(20,'late'));
 check(f.scheduled.length,0,'late old arrival cannot re-schedule');
 check([...f.memory.values()].map(JSON.parse).some(r=>r.action==='received'),true,'receipt evidence retained');
}
{
 const source=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const begin=source.indexOf('  async function bridgeFetch('),end=source.indexOf('  async function requestEnvelope(',begin);
 let next=payload(40),responseStatus=200,binding=scope,reconciles=0;
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const owner=createScheduleNotificationAuthority({identity:()=>binding,principal:()=>principal,
  status:()=>({ready:true,available:true}),storage});
 const context={URL,Request,Response,JSON,API_ORIGIN:'https://fixture.invalid',nativeVault:true,
  target:input=>new URL(input),currentPrincipalIdentity:()=>binding,
  credentialStore:{dispatchAuthorizedTransport:async()=>({generation:1,completion:Promise.resolve(new Response(JSON.stringify({ok:responseStatus===200,data:next}),{status:responseStatus}))}),
    waitForStableState:async()=>{}},responsePayload:r=>r.clone().json(),scheduleNotificationAuthority:owner,
  reconcileScheduleNotifications:async()=>{reconciles++;}};
 vm.createContext(context);vm.runInContext(source.slice(begin,end),context);
 await context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary?device_id=KIOSK_08');
 check(owner.isCurrent(event(40).notification.data,scope),true,'actual authenticated transport observes before returning');
 await applyPage(next,storage);await owner.refresh();
 next=payload(41,true);await context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary');
 check(owner.isCurrent(event(40).notification.data,scope),false,'actual transport terminal suppresses without cache write');
 next=payload(42);await context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary');
 responseStatus=503;await context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary');
 check(owner.isCurrent(event(42).notification.data,scope),false,'schedule503 fences old alert');
 responseStatus=200;await context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary');await applyPage(next,storage);await owner.refresh();
 next={...payload(43),employee_id:id(999)};await context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary');
 check(owner.isCurrent(event(42).notification.data,scope),false,'wrong-principal response never leaves old display eligible');
 next=payload(44);await context.bridgeFetch('https://fixture.invalid/schedule-api/my-day-summary');await applyPage(next,storage);await owner.refresh();
 responseStatus=503;await context.bridgeFetch('https://fixture.invalid/unrelated-read');
 check(owner.isCurrent(event(44).notification.data,scope),true,'unrelated service failure does not invalidate schedule');
 check(reconciles,7,'only owning authenticated schedule responses trigger reconciliation');
}
{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority}),ui=f.fullBrowser();
 await f.scheduleAuthority.observe(payload(30));await f.emit('firebase','notificationReceived',event(30));
 check(ui.active,true,'actual bridge mounts browser presentation guard');
 const card=ui.card;await f.scheduleAuthority.observe(payload(31,true));await f.mobile.retryNotificationPresentation();
 check(ui.active,false,'terminal retires exact browser card');
 await card.querySelector('.mz-reminder-open').listeners.click();await turn();
 check(f.effects.some(v=>v.startsWith('route:')),false,'old browser action cannot navigate');
 check([...f.memory.keys()].some(k=>k.includes('schedule-application')),false,'notification fence invents no full-phone ACK');
}
{
 const memory=new Map(),f=await fixture({display:'denied',memory,scheduleAuthorityFactory:createScheduleNotificationAuthority});
 await f.emit('firebase','notificationReceived',event(50));
 check(f.scheduled.length,0,'unknown schedule retains accepted arrival without showing');
 const restarted=await fixture({display:'denied',memory,scheduleAuthorityFactory:createScheduleNotificationAuthority}),ui=restarted.fullBrowser();
 await restarted.scheduleAuthority.observe(payload(50));await restarted.mobile.retryNotificationPresentation();
 check(ui.active,true,'restored pending presentation retries after authenticated authority arrives');
}
{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority});
 const rows=[{notification_key:'poll:60',employee_id:principal.employee_id,service_date:day,projection_id:id(1060),location_code:'FIXTURE',status_code:'due_soon'}];
 const ui=f.fullBrowser({rows});await f.scheduleAuthority.observe(payload(60));await ui.poll();
 check(ui.active,true,'authenticated poll row with explicit current projection may present');
 const old=ui.card;ui.setHref('https://localhost/index.html');
 await f.scheduleAuthority.observe(payload(61,true));await f.mobile.retryNotificationPresentation();
 check(ui.active,false,'terminal retires poll-owned card through shared reconciliation');
 check(ui.audioStops>0,true,'terminal stops exact poll-owned audio');
 const actions=ui.httpActions.length;await old.querySelector('.mz-reminder-open').listeners.click();
 check(ui.href,'https://localhost/index.html','retired poll Open cannot navigate');
 check(ui.httpActions.length,actions,'retired poll does not record a stale employee action');
 await f.scheduleAuthority.observe(payload(62));await ui.poll();check(ui.active,false,'late old poll row cannot revive with new projection');
 rows[0]={...rows[0],notification_key:'poll:62',projection_id:id(1062)};await ui.poll();check(ui.active,true,'fresh replacement poll row may present');
 await ui.card.querySelector('.mz-reminder-dismiss').listeners.click();const stopped=ui.audioStops;
 await f.scheduleAuthority.observe(payload(63,true));await f.mobile.retryNotificationPresentation();
 check(ui.audioStops>stopped,true,'terminal also stops poll audio after visual Dismiss');
}
{
 const f=await fixture({display:'denied',scheduleAuthorityFactory:createScheduleNotificationAuthority});await f.scheduleAuthority.observe(payload(70));
 const ui=f.fullBrowser({rows:[{notification_key:'unbound-poll',employee_id:principal.employee_id,service_date:day,location_code:'FIXTURE',status_code:'due_soon'}]});
 await ui.poll();check(ui.active,false,'missing producer projection is refused rather than inferred');
 check(ui.httpActions.length,0,'unbound poll has no fabricated display receipt');
}
console.log(JSON.stringify({ok:true,checks,scope:'mounted bridge OS/browser/poll plus real schedule reader; synthetic transport/OS/DOM, not native provider or phone acceptance'}));
export {payload,event,row,scope,day,id};
async function applyPage(data,storage){
 const who={deviceId:principal.device_id,employeeId:principal.employee_id,employeeName:'Synthetic Custodian',credentialId:principal.credential_id,assignmentEpoch:principal.assignment_epoch,protectedBinding:scope};
 const page=createScheduleHomeConvergence({identity:()=>who,storage,mutate:fn=>fn(),matches:()=>true});
 await page.accept(data,who); // Actual shared Home writer, no invented ACK.
}
