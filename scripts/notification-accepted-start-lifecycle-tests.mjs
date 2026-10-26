import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scheduleLocks} from './synthetic-schedule-locks.mjs';
import {createScheduleNotificationAuthority} from '../mobile/src/custodial/notification-schedule-authority.js';
import {createNotificationPresenter} from '../mobile/src/custodial/notification-presentation.js';
import {createPrincipalNotificationScheduler} from '../mobile/src/custodial/notification-schedule.js';
import {principalIdentity,profileMatchesPrincipal,protectedPrincipal} from '../mobile/src/custodial/protected-principal.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';

// Only new affected cases. Actual product validators/presenter/scheduler and
// complete renderer execute; no prior test module or bridge body is executed.
globalThis.crypto ||= webcrypto;
const id=n=>`ad000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=v=>createHash('sha256').update(v).digest('hex');
const flat=v=>'{'+Object.keys(v).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(k=>JSON.stringify(k)+': '+JSON.stringify(v[k])).join(', ')+'}';
const deviceId='KIOSK_08',time=Date.parse('2026-10-11T17:00:00.000Z'),day=zooServiceDate(time);
const principal={schema_version:'custodial-protected-principal.v1',device_id:deviceId,employee_id:id(1),credential_id:id(2),assignment_epoch:7,credential_operation_id:id(3),installation_seal:'fixture-installation-seal-0001',enrolled_at:'2026-07-01T12:00:00.000Z'};
const scope=principalIdentity(principal),locationId=id(20),projectionId=id(1010);
function storage(){const memory=new Map();return {memory,get length(){return memory.size;},key:i=>[...memory.keys()][i]??null,getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};}
function schedule(revision=10,items=[]){const view={schema:'static-weekly.recurring-render-view.v1',service_date:day,employee_id:id(1),employee_name:'Synthetic',publication_id:id(10),projection_id:projectionId,projection_status:'current',full_day:true,shift:{start:'07:00',end:'16:00'},raw_items:items};const target={schema:'static-weekly.recurring-application-target.v1',targetType:'SCHEDULE',operationId:id(20+revision),publicationId:id(10),serviceDate:day,authorityRevision:revision,deviceId:id(1),employeeId:id(1),credentialId:id(2),assignmentEpoch:7,projectionId,lunchDocumentIdentity:'a'.repeat(64),viewDigest:sha(JSON.stringify(view))};return {canonical_device_id:deviceId,employee_id:id(1),credential_id:id(2),assignment_epoch:7,...view,canonical_device_pk:id(1),schedule_delivery_mode:'RECURRING_SCHEDULE',recurring_delivery:{intentId:id(30+revision),target,targetDigest:sha(flat(target)),applicationStatus:'PENDING',viewJsonText:JSON.stringify(view),viewDigest:target.viewDigest}};}
const session={service_date:day,device_id:deviceId,employee_id:id(1),assignment_epoch:7,location_id:locationId,projection_id:projectionId,open_session_uuid:id(40),open_session_status:'active',open_session_started_at:'2026-10-11T15:00:00.000001Z',open_session_device_identifier:deviceId,credential_id:id(2),schedule_authority_revision:'10'};
const key=(stamp='20261011145959000000',status='overdue',repeat='0')=>`location-visit:${day}:${locationId}:${status}:${stamp}:${repeat}:projection:${projectionId}`;
const data=(notification_key=key())=>({kind:'employee_location_status',service_date:day,projection_id:projectionId,location_id:locationId,notification_key,receipt_device_id:deviceId,receipt_employee_id:id(1),receipt_credential_id:id(2),receipt_assignment_epoch:'7',route:'employee-schedule.html?hub=employee'});
const event=d=>({notification:{title:'Synthetic reminder',body:'Synthetic location needs cleaning.',data:d}});
function make(now=()=>time){const disk=storage();const authority=createScheduleNotificationAuthority({identity:()=>scope,principal:()=>principal,status:()=>({ready:true,available:true,generation:10}),storage:disk,now});return {authority,disk};}
const results=[],remainingSourceLimits=[];
async function check(name,fn){if(process.env.ACCEPTED_START_ORIGIN_CASE&&name!==`ORIGIN ${process.env.ACCEPTED_START_ORIGIN_CASE}`)return;if(process.env.ACCEPTED_START_READ_CASE&&name!==`READ ${process.env.ACCEPTED_START_READ_CASE}`)return;if(process.argv.includes('--ordinary-lunch-cutoff-race-only')&&!name.startsWith('CUTOFF lunch deadline-race'))return;if(process.argv.includes('--ordinary-lunch-cutoff-only')&&!name.startsWith('CUTOFF lunch '))return;if(process.argv.includes('--schedule-window-boundaries-only')&&!['PAGE lunch actual boundary','PAGE lunch accepted-window'].some(prefix=>name.startsWith(prefix)))return;if(process.argv.includes('--schedule-boundary-delay-only')&&!name.startsWith('PAGE lunch boundary-delay'))return;if(process.argv.includes('--schedule-admission-only')&&!name.startsWith('PAGE lunch accepted-window'))return;if(process.argv.includes('--schedule-navigation-only')&&!name.startsWith('PAGE lunch navigation'))return;if(process.argv.includes('--schedule-page-only')&&!name.startsWith('PAGE lunch '))return;if(process.argv.includes('--lunch-renderer-only')&&!name.startsWith('RENDERER lunch '))return;if(process.argv.includes('--main-mount-only')&&!name.startsWith('MAIN '))return;if(process.argv.includes('--lunch-only')&&!name.startsWith('LUNCH '))return;if(process.argv.includes('--lunch-scheduler-only')&&!name.startsWith('LUNCH scheduler '))return;await fn();results.push(name);}

await check('canonical accepted START retires old/equal cycle but not next microsecond',async()=>{
 const {authority:a}=make();assert.equal(await a.observe(schedule()),true);
 assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);
 for(const stamp of ['20261011145959000000','20261011150000000001'])assert.equal(a.isCurrent(data(key(stamp)),scope),false);
 assert.equal(a.isCurrent(data(key('20261011150000000002')),scope),true);
 assert.equal(a.isLocationReminderRetired(data(key('20261011150000000002')),scope),false);
 assert.equal(a.isLocationReminderRetired(data(),scope),true);
});
await check('missing observer and unaccepted local marker preserve schedule-only eligibility',async()=>{
 const {authority:a}=make();assert.equal(await a.observe(schedule()),true);
 assert.equal(a.isCurrent({...data(),open_session_status:'native_started_server_unaccepted'},scope),true);
 assert.equal(a.observeAcceptedLocationSession({...session,open_session_status:'native_started_server_unaccepted'},scope,a.beginAcceptedLocationSessionRead(scope)),false);
 assert.equal(a.isLocationReminderRetired(data(),scope),false);
});
await check('malformed/rolled-over/unbound keys cannot blanket-retire legacy notices',async()=>{
 const {authority:a}=make();await a.observe(schedule());assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);
 for(const value of ['legacy-location:old',key('20260230140000000000'),key('20261011240000000000'),key('20261011140000000000','due_soon','1'),key('20261011140000000000','overdue','01'),key('20261011140000000000','overdue','9223372036854775808'),key().replace(locationId,id(99)),key().replace(projectionId,id(99))]){
  assert.equal(a.isCurrent(data(value),scope),true,value);assert.equal(a.isLocationReminderRetired(data(value),scope),false,value);
 }
 assert.equal(a.isCurrent({...data(),location_id:undefined},scope),true);
});
await check('accepted-session admission requires exact current protected tuple/projection/day/time',async()=>{
 for(const change of [{device_id:'KIOSK_09'},{employee_id:id(99)},{assignment_epoch:8},{projection_id:id(99)},{schedule_authority_revision:9},{service_date:'2026-10-10'},{open_session_started_at:'2026-10-10T15:00:00Z'},{open_session_started_at:'2026-10-11T17:00:00.000001Z'},{open_session_started_at:'2026-02-30T15:00:00Z'},{open_session_started_at:null},{open_session_uuid:null},{open_session_device_identifier:'KIOSK_09'},{open_session_status:'completed'}]){
  const {authority:a}=make();await a.observe(schedule());assert.equal(a.observeAcceptedLocationSession({...session,...change},scope,a.beginAcceptedLocationSessionRead(scope)),false,JSON.stringify(change));assert.equal(a.isCurrent(data(),scope),true);
 }
 const {authority:a}=make();await a.observe(schedule());assert.equal(a.observeAcceptedLocationSession(session,'foreign-scope',a.beginAcceptedLocationSessionRead(scope)),false);
});
await check('no validated schedule or unavailable response cannot seed accepted START',async()=>{
 const {authority:a}=make();assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),false);
 await a.observe(schedule());await a.unavailable(scope);assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),false);
 assert.equal(a.isLocationReminderRetired(data(),scope),false,'unknown schedule is not affirmative accepted-START evidence');
});
await check('monotonic snapshots reject older/conflicting sessions and retain later-cycle eligibility',async()=>{
 const {authority:a}=make();await a.observe(schedule());assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);
 assert.equal(a.observeAcceptedLocationSession({...session,open_session_started_at:'2026-10-11T14:00:00Z',open_session_uuid:id(41)},scope,a.beginAcceptedLocationSessionRead(scope)),false);
 assert.equal(a.observeAcceptedLocationSession({...session,open_session_uuid:id(41)},scope,a.beginAcceptedLocationSessionRead(scope)),false);
 assert.equal(a.observeAcceptedLocationSession({...session,open_session_started_at:'2026-10-11T15:00:00.000001+00:00',open_session_status:'pending_submit'},scope,a.beginAcceptedLocationSessionRead(scope)),true);
 assert.equal(a.observeAcceptedLocationSession(null,scope,a.beginAcceptedLocationSessionRead(scope)),false);assert.equal(a.isCurrent(data(),scope),false);
 assert.equal(a.isCurrent(data(key('20261011150000000002')),scope),true);
});
await check('accepted evidence cannot cross schedule revision even under same projection UUID',async()=>{
 const {authority:a}=make();await a.observe(schedule());assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);
 assert.equal(await a.observe(schedule(11)),true);assert.equal(a.isCurrent({...data(),schedule_authority_revision:11},scope),true);
 assert.equal(a.isCurrent({...data(),schedule_authority_revision:10},scope),false);
 assert.equal(a.observeAcceptedLocationSession({...session,schedule_authority_revision:10},scope,a.beginAcceptedLocationSessionRead(scope)),false);
});
await check('foreign location cannot retire original location and lunch identity remains guarded',async()=>{
 const {authority:a}=make();await a.observe(schedule());assert.equal(a.observeAcceptedLocationSession({...session,location_id:id(90)},scope,a.beginAcceptedLocationSessionRead(scope)),true);
 assert.equal(a.isCurrent(data(),scope),true);
 const lunch={...data(),kind:'employee_lunch_coverage',document_identity:'a'.repeat(64)};
 assert.equal(a.isCurrent(lunch,scope),true);assert.equal(a.isCurrent({...lunch,document_identity:'b'.repeat(64)},scope),false);
 assert.equal(a.isLocationReminderRetired(lunch,scope),false);
});

const fixtureSource=readFileSync(new URL('./native-notification-arrival-boundary-tests.mjs',import.meta.url),'utf8');
const constructorText=fixtureSource.slice(fixtureSource.indexOf('function fullBrowserFixture('),fixtureSource.indexOf('async function fixture(')).trim();
assert.ok(constructorText.startsWith('function fullBrowserFixture(')&&constructorText.endsWith('}'));
const reminderSource=readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8'),turn=()=>new Promise(resolve=>setImmediate(resolve));
const fullBrowserFixture=vm.runInNewContext('('+constructorText+')',{vm,reminderSource,assert,turn,deviceId,Buffer,queueMicrotask,URL,Uint8Array,DataView,Float32Array});
function renderer(a,{native=false,observer=true,lunchObserver=true,dateClass=Date}={}){
 const warnings=[],saves=[],actions=[],events=new Map();let show;
 const presenter=createNotificationPresenter({identity:()=>scope,nativeMode:()=>false,nativePresent:async()=>false,save:async row=>saves.push(structuredClone(row)),load:async()=>[],displayed:async()=>true,action:async(e,kind)=>{actions.push(kind);return true;},isCurrent:(e,s)=>a.isCurrent(e.notification.data,s)});
 const context=vm.createContext({console:{warn:(...args)=>warnings.push(args),log(){},error(){}},document:{addEventListener(){},hidden:false},window:{addEventListener:(name,fn)=>events.set(name,fn),MemphisMobile:{releaseCapabilities:{messenger:false},nativeNotifications:native,principalIdentity:()=>scope,registerNotificationFallback:fn=>{show=fn;presenter.registerBrowser(fn);},...(observer?{isLocationReminderRetired:(d,s)=>a.isLocationReminderRetired(d,s)}:{}),retryNotificationPresentation:()=>presenter.retry(),presentBrowserNotification:(k,fn)=>presenter.presentBrowser(k,fn)}},localStorage:storage(),Date:dateClass,JSON,Number,Math,Promise});
 if(lunchObserver)context.window.MemphisMobile.isLunchNotificationCurrent=(d,s)=>s===scope&&a.isCurrent(d,s);
 const browser=fullBrowserFixture(context,{manualAudio:true,browserSpeech:true,observedAudio:true});
 return {browser,context,presenter,saves,actions,warnings,events,show:(...args)=>show(...args)};
}
function mirrorAction(){const actions=[];const fn=async kind=>{actions.push(kind);return true;};Object.assign(fn,{providerMirror:true,isCurrent:()=>true,playAudio:true,beginAudio:async()=>true,finishAudio:async()=>true,presentationState:()=>({freshness:'CURRENT'}),onRetire(){},onOpen(){},onState(){},retire(){},recheck:async()=>true});return {fn,actions};}
await check('actual presenter/renderer old popup/audio retires without receipt action; next cycle renders',async()=>{
 const {authority:a}=make();await a.observe(schedule());const r=renderer(a);assert.equal(await r.presenter.accept(event(data())),true);await turn();
 assert.equal(r.browser.active,true);assert.equal(r.browser.tones.length,1);assert.equal(r.browser.tones[0].paused,false);
 const oldCard=r.browser.card;assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);
 r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();await r.presenter.retry();await turn();
 assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);assert.equal(r.browser.state.activeAudioAlert,null);
 await oldCard.querySelector('.mz-reminder-open').click();await oldCard.querySelector('.mz-reminder-dismiss').click();assert.deepEqual(r.actions,[]);assert.equal(r.browser.httpActions.length,0);
 assert.ok(r.saves.length>0,'protected accepted history remains');
 assert.equal(await r.presenter.accept(event(data(key('20261011150000000002')))),true);assert.equal(r.browser.active,true);
 assert.equal(r.browser.card.querySelector('.mz-reminder-dismiss').textContent,'Dismiss');
 r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(r.browser.active,true);
});
await check('native-mode provider mirror observes affirmative old-cycle retirement, not poll absence',async()=>{
 const {authority:a}=make();await a.observe(schedule());const r=renderer(a,{native:true}),m=mirrorAction();
 assert.equal(r.show(event(data()),m.fn),true);await turn();assert.equal(r.browser.active,true);assert.equal(r.browser.tones[0].paused,false);
 assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);await r.browser.poll();await turn();
 assert.equal(r.browser.fetches,0,'native mode does not poll legacy candidates');assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);assert.deepEqual(m.actions,[]);
 assert.equal(r.show(event(data(key('20261011150000000002'))),mirrorAction().fn),true);assert.equal(r.browser.active,true);
});
await check('native legacy/no-observer and unavailable observation retain provider-owned notice',async()=>{
 const {authority:a}=make();await a.observe(schedule());const r=renderer(a,{native:true,observer:false});assert.equal(r.show(event(data('legacy:key')),mirrorAction().fn),true);await turn();await r.browser.poll();assert.equal(r.browser.active,true);assert.deepEqual(r.warnings,[]);
 const r2=renderer(a,{native:true});assert.equal(r2.show(event(data()),mirrorAction().fn),true);await turn();await a.unavailable(scope);assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),false);await r2.browser.poll();assert.equal(r2.browser.active,true);assert.deepEqual(r2.warnings,[]);
});
await check('actual native scheduler cancels exact owned old ID, keeps cancelled history, and schedules next cycle',async()=>{
 const {authority:a}=make();await a.observe(schedule());const disk=storage(),pending=new Map(),delivered=new Map(),effects=[];
 const scheduler=createPrincipalNotificationScheduler({identity:()=>scope,mutate:async fn=>fn(),storage:disk,prefix:'test-owned:',isCurrent:(n,s)=>a.isCurrent(n.extra,s),plugin:{getPending:async()=>({notifications:[...pending.values()]}),getDeliveredNotifications:async()=>({notifications:[...delivered.values()]}),schedule:async({notifications})=>{for(const n of notifications)pending.set(n.id,n);},cancel:async({notifications})=>{effects.push('cancel');for(const n of notifications)pending.delete(n.id);},removeDeliveredNotifications:async({notifications})=>{effects.push('removeDelivered');for(const n of notifications)delivered.delete(n.id);}}});
 assert.equal(await scheduler.present({title:'Synthetic',extra:data()},scope),true);const old=[...pending.values()][0];delivered.set(old.id,{id:old.id,group:old.group});assert.equal(scheduler.ownsAction(old),true);
 assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);await scheduler.reconcile();assert.deepEqual(effects,['cancel','removeDelivered']);assert.equal(scheduler.ownsAction(old),false);assert.equal(JSON.parse(disk.getItem('test-owned:'+old.id)).state,'cancelled');assert.notEqual(disk.getItem('test-owned:unconfirmed:'+old.id),null);
 assert.equal(await scheduler.present({title:'Synthetic',extra:data(key('20261011150000000002'))},scope),true);assert.equal([...pending.values()][0].id,old.id+1);
});
await check('MAIN actual bridge accepted-session intake is private, single-flight and current-principal-bound',async()=>{
 const {authority:a}=make();await a.observe(schedule());
 const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const begin=bridge.indexOf('  let acceptedLocationSessionRead=null;'),end=bridge.indexOf('  async function reconcileScheduleNotifications(){',begin);
 assert.ok(begin>=0&&end>begin);
 let calls=0,resolve,current=principal,currentScope=scope;
 const pending=new Promise(done=>{resolve=done;});
 const context=vm.createContext({AbortSignal,JSON,encodeURIComponent,
  currentPrincipalIdentity:()=>currentScope,currentPrincipal:()=>current,
  security:{getStatus:()=>({ready:true,available:true,generation:10})},scheduleNotificationAuthority:a,
  requestEnvelope:async path=>{calls++;assert.match(path,/accepted_sessions=1$/);return pending;}});
 vm.runInContext(bridge.slice(begin,end)+';globalThis.read=refreshAcceptedLocationSessions;',context);
 const first=context.read(),join=context.read();assert.equal(calls,1);
 resolve({meta:{accepted_location_sessions:[session]}});assert.equal(await first,true);assert.equal(await join,true);
 assert.equal(a.isLocationReminderRetired(data(),scope),true);
 assert.equal(a.isLocationReminderRetired(data(key('20261011150000000002')),scope),false);
 const other=make();await other.authority.observe(schedule());let later;
 const wait=new Promise(done=>{later=done;});
 const fresh=vm.createContext({AbortSignal,JSON,encodeURIComponent,
  currentPrincipalIdentity:()=>currentScope,currentPrincipal:()=>current,
  security:{getStatus:()=>({ready:true,available:true,generation:10})},scheduleNotificationAuthority:other.authority,
  requestEnvelope:async()=>wait});
 vm.runInContext(bridge.slice(begin,end)+';globalThis.read=refreshAcceptedLocationSessions;',fresh);
 const held=fresh.read();current={...principal,assignment_epoch:8};currentScope='different-current-principal';
 later({meta:{accepted_location_sessions:[session]}});assert.equal(await held,false);
 assert.equal(other.authority.isLocationReminderRetired(data(),scope),false);
 assert.doesNotMatch(bridge.slice(bridge.indexOf('window.MemphisMobile = Object.freeze({')),/observeAcceptedLocationSession\s*\(/,'caller/DOM intake is not public');
});
async function acceptedReadFixture(){
 let current=principal,currentScope=scope,generation=10,release,calls=[];
 const disk=storage(),health=()=>({ready:true,available:true,generation});
 const a=createScheduleNotificationAuthority({identity:()=>currentScope,principal:()=>current,status:health,storage:disk,now:()=>time});
 assert.equal(await a.observe(schedule()),true);
 const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const begin=bridge.indexOf('  let acceptedLocationSessionRead=null;'),end=bridge.indexOf('  async function reconcileScheduleNotifications(){',begin);
 assert.ok(begin>=0&&end>begin);
 const context=vm.createContext({AbortSignal,JSON,Number,encodeURIComponent,currentPrincipalIdentity:()=>currentScope,currentPrincipal:()=>current,
  security:{getStatus:health},scheduleNotificationAuthority:a,requestEnvelope:async(path,options)=>{calls.push({path,options});return new Promise(done=>{release=done;});}});
 vm.runInContext(bridge.slice(begin,end)+';globalThis.read=refreshAcceptedLocationSessions;',context);
 return {a,disk,context,calls,get generation(){return generation;},advance(){generation++;},switchAway(){current={...principal,employee_id:id(90),credential_id:id(91),assignment_epoch:8};currentScope=principalIdentity(current);generation++;},
  restore(){current=principal;currentScope=scope;generation++;},get release(){return release;}};
}
await check('READ singleflight-current-owner',async()=>{
 // Actual bridge function and private token ownership seam only. Empty
 // replies grant NO accepted START, notification retirement or native rights.
 const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const begin=bridge.indexOf('  let acceptedLocationSessionRead=null;'),end=bridge.indexOf('  async function reconcileScheduleNotifications(){',begin);
 assert.ok(begin>=0&&end>begin);
 for(const change of ['generation','principal','schedule']){
  let generation=10,revision=1,currentScope=scope,currentPrincipalValue={...principal},healthy=true;
  const calls=[],finished=[],tokens=new WeakMap();let serial=0,observations=0;
  const snapshot=()=>JSON.stringify([generation,revision,currentScope,currentPrincipalValue,healthy]);
  const authority={
   beginAcceptedLocationSessionRead(){const token={};tokens.set(token,{stamp:snapshot(),serial:++serial});return token;},
   acceptedLocationSessionReadCurrent:token=>healthy&&tokens.get(token)?.stamp===snapshot(),
   finishAcceptedLocationSessionRead(token){finished.push(tokens.get(token)?.serial);tokens.delete(token);},
   observeAcceptedLocationSession(){observations++;throw Error('No accepted START in empty-read fixture');},
  };
  const context=vm.createContext({AbortSignal,JSON,Number,Object,encodeURIComponent,
   currentPrincipalIdentity:()=>currentScope,currentPrincipal:()=>currentPrincipalValue,
   security:{getStatus:()=>({ready:healthy,available:healthy,quarantined:false,generation})},
   scheduleNotificationAuthority:authority,
   requestEnvelope:(path,options)=>new Promise(resolve=>calls.push({path,options,resolve})),
  });
  vm.runInContext(bridge.slice(begin,end)+';globalThis.read=refreshAcceptedLocationSessions;',context);
  const first=context.read(),sameOriginal=context.read();assert.equal(calls.length,1);
  if(change==='generation')generation++;
  if(change==='principal'){currentPrincipalValue={...principal,employee_id:id(90),credential_id:id(91),assignment_epoch:8};currentScope=principalIdentity(currentPrincipalValue);}
  if(change==='schedule')revision++;
  const replacement=context.read(),sameReplacement=context.read();
  assert.equal(calls.length,2,'newly current '+change+' owner cannot join the old flight');
  assert.equal(calls[1].options.expectedGeneration,generation);
  assert.match(calls[1].path,/accepted_sessions=1$/);
  // Old finally must neither clear nor finish the newer token/flight.
  calls[0].resolve({meta:{accepted_location_sessions:[]}});
  assert.equal(await first,false);assert.equal(await sameOriginal,false);assert.deepEqual(finished,[1]);
  const afterOldFinally=context.read();assert.equal(calls.length,2,'old cleanup must retain current single flight');
  healthy=false;assert.equal(await context.read(),false,'unavailable callers do not join a pending result');healthy=true;
  calls[1].resolve({meta:{accepted_location_sessions:[]}});
  assert.equal(await replacement,true);assert.equal(await sameReplacement,true);assert.equal(await afterOldFinally,true);
  assert.deepEqual(finished,[1,2]);assert.equal(observations,0);
 }
});
await check('READ aba-response',async()=>{
 const f=await acceptedReadFixture(),work=f.context.read();assert.equal(f.calls.length,1);
 f.switchAway();f.restore();f.release({meta:{accepted_location_sessions:[session]}});
 assert.equal(await work,false,'A→B→A original read generation must not accept stale START');assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
});
await check('READ missing-dispatch-generation',async()=>{
 const f=await acceptedReadFixture(),work=f.context.read();assert.equal(f.calls[0].options.expectedGeneration,10,'original generation must reach existing credential FIFO');
 f.release({meta:{accepted_location_sessions:[]}});assert.equal(await work,true);
});
await check('READ revision-changed-inflight',async()=>{
 const f=await acceptedReadFixture(),work=f.context.read();await f.a.observe(schedule(11));
 f.release({meta:{accepted_location_sessions:[session]}});assert.equal(await work,false,'current same-UUID revision cannot adopt an older read');
 assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
});
const acceptedReadSession={...session,credential_id:principal.credential_id,schedule_authority_revision:'10'};
await check('READ original-start-cancels-only-original-cycle',async()=>{
 const f=await acceptedReadFixture(),r=renderer(f.a),d=data();
 await turn();
 assert.equal(await r.presenter.accept(event(d)),true,JSON.stringify({authorityCurrent:f.a.isCurrent(d,scope),warnings:r.warnings}));await turn();const old=r.browser.card;
 const work=f.context.read(),join=f.context.read();assert.equal(f.calls.length,1);
 f.release({meta:{accepted_location_sessions:[acceptedReadSession]}});assert.equal(await work,true);assert.equal(await join,true);
 r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();await r.presenter.retry();await turn();
 assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);
 await old.querySelector('.mz-reminder-open').click();await old.querySelector('.mz-reminder-dismiss').click();assert.deepEqual(r.actions,[]);
 assert.equal(await r.presenter.accept(event(data(key('20261011150000000002')))),true);assert.equal(r.browser.active,true);
 assert.equal(r.browser.card.querySelector('.mz-reminder-dismiss').textContent,'Dismiss');
});
await check('READ missing-or-foreign-source-bindings',async()=>{
 for(const changed of [{credential_id:undefined},{credential_id:id(90)},{schedule_authority_revision:undefined},{schedule_authority_revision:'11'},
   {schedule_authority_revision:'010'},{schedule_authority_revision:true},{assignment_epoch:8},{employee_id:id(90)},
   {projection_id:id(90)},{service_date:'2026-10-10'},{open_session_status:'native_started_server_unaccepted'}]){
  const f=await acceptedReadFixture(),work=f.context.read();f.release({meta:{accepted_location_sessions:[{...acceptedReadSession,...changed}]}});
  assert.equal(await work,false,JSON.stringify(changed));assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
 }
});
await check('READ unavailable-and-successor-read',async()=>{
 const f=await acceptedReadFixture(),work=f.context.read();
 f.release({meta:{accepted_location_sessions:null}});assert.equal(await work,false);assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
 const second=f.context.read();f.release({meta:{accepted_location_sessions:[acceptedReadSession]}});
 assert.equal(await second,true);assert.equal(f.calls.length,2);assert.equal(f.a.isLocationReminderRetired(data(),scope),true);
});
await check('READ schedule-unavailable-inflight',async()=>{
 const f=await acceptedReadFixture(),work=f.context.read();await f.a.unavailable(scope);
 f.release({meta:{accepted_location_sessions:[acceptedReadSession]}});assert.equal(await work,false);assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
 assert.equal(await f.context.read(),false);assert.equal(f.calls.length,1,'unavailable schedule cannot dispatch another accepted read');
});
await check('READ opaque-superseded-or-finished-ticket',async()=>{
 const f=await acceptedReadFixture(),first=f.a.beginAcceptedLocationSessionRead(scope),second=f.a.beginAcceptedLocationSessionRead(scope);
 assert.ok(first&&second);assert.equal(f.a.observeAcceptedLocationSession(acceptedReadSession,scope,{}),false);
 assert.equal(f.a.observeAcceptedLocationSession(acceptedReadSession,scope,first),false);
 assert.equal(f.a.finishAcceptedLocationSessionRead(second),true);assert.equal(f.a.observeAcceptedLocationSession(acceptedReadSession,scope,second),false);
 assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
});
await check('READ retained-observation-generation-expiry',async()=>{
 const f=await acceptedReadFixture(),work=f.context.read();f.release({meta:{accepted_location_sessions:[acceptedReadSession]}});assert.equal(await work,true);
 assert.equal(f.a.isLocationReminderRetired(data(),scope),true);f.switchAway();f.restore();assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
 assert.equal(f.a.isCurrent(data(),scope),true,'old accepted observation cannot retire a current new-generation card');
 const next=f.context.read();f.release({meta:{accepted_location_sessions:[acceptedReadSession]}});assert.equal(await next,true);assert.equal(f.a.isLocationReminderRetired(data(),scope),true);
});
await check('READ original-retained-map-counterexample',async()=>{
 const source=readFileSync(new URL('../before/notification-schedule-authority.js',import.meta.url),'utf8');
 const resolved=source.replace("'../../../memphis-recurring-schedule-target.js'",JSON.stringify(new URL('../memphis-recurring-schedule-target.js',import.meta.url).href))
  .replace("'./protected-principal.js'",JSON.stringify(new URL('../mobile/src/custodial/protected-principal.js',import.meta.url).href))
  .replace("'./home-facts.js'",JSON.stringify(new URL('../mobile/src/custodial/home-facts.js',import.meta.url).href));
 const {createScheduleNotificationAuthority:before}=await import('data:text/javascript,'+encodeURIComponent(resolved));
 let generation=10;const a=before({identity:()=>scope,principal:()=>principal,status:()=>({ready:true,available:true,generation}),storage:storage(),now:()=>time});
 await a.observe(schedule());assert.equal(a.observeAcceptedLocationSession(acceptedReadSession,scope),true);
 generation+=2;assert.equal(a.isLocationReminderRetired(data(),scope),true,'pinned original stored observation survives generation ABA incorrectly');
 const f=await acceptedReadFixture(),read=f.context.read();f.release({meta:{accepted_location_sessions:[acceptedReadSession]}});assert.equal(await read,true);
 f.advance();f.advance();assert.equal(f.a.isLocationReminderRetired(data(),scope),false,'changed actual owner rejects previous-generation retirement');
});
async function nativeAcceptedReadFixture({assertDispatchUnlocked=true}={}){
 const {getCustodialBridgeSecurityRuntime}=await import('../mobile/src/custodial/security-runtime.js');
 const {createRawStorageAdapter}=await import('../mobile/src/custodial/storage-firewall.js');
 const keys=await import('../mobile/src/custodial/credential-store.js');
 const policy=await import('../mobile/src/custodial/transport-policy.js');
 const memory=new Map(),secure=new Map();let lock=false,release,sent=[];
 class Storage{get length(){return memory.size;}key(i){return [...memory.keys()][i]??null;}getItem(k){return memory.get(k)??null;}
  setItem(k,v){memory.set(k,String(v));}removeItem(k){memory.delete(k);}clear(){memory.clear();}}
 const disk=new Storage(),raw=createRawStorageAdapter(disk),record=p=>JSON.stringify({schema_version:1,credential:'SYNTHETIC_NOT_DEVICE_CREDENTIAL',
  device_id:deviceId,installation_seal:principal.installation_seal,enrolled_at:principal.enrolled_at,principal:p});
 for(const key of keys.CUSTODIAL_DEVICE_KEYS)raw.setItem(key,deviceId);raw.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,principal.installation_seal);
 secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,record(principal));
 const runtime=getCustodialBridgeSecurityRuntime({storage:disk,cryptoApi:webcrypto,indexedDb:{databases:async()=>[]},
  locks:{async request(name,options,work){assert.equal(lock,false);lock=true;try{return await work({name,mode:options.mode});}finally{lock=false;}}},
  secureStorage:{get:async k=>secure.get(k)??null,set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)}});
 await runtime.security.ready;const security=runtime.security,store=runtime.credentialStore;
 const a=createScheduleNotificationAuthority({identity:()=>principalIdentity(store.getStatus().principal),principal:()=>store.getStatus().principal,
  status:store.getStatus,storage:disk,mutate:security.mutateProtectedWork,now:()=>time});assert.equal(await a.observe(schedule()),true);
 const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const slice=(start,end)=>{const i=bridge.indexOf(start),j=bridge.indexOf(end,i);assert.ok(i>=0&&j>i);return bridge.slice(i,j);};
 const program=slice('  function target(','  function safeEnrollmentTerminalMessage(')
  +slice('  function currentPrincipal(','  function homeCacheKey(')
  +slice('  async function requireRecoveryForRejectedCredential(','  function publicUnauthenticatedRoute(')
  +slice('  function publicUnauthenticatedRoute(','  async function confirmPendingEnrollment(')
  +slice('  let acceptedLocationSessionRead=null;','  async function reconcileScheduleNotifications(){')+';globalThis.read=refreshAcceptedLocationSessions;';
 const context=vm.createContext({...policy,principalIdentity,protectedPrincipal,credentialStore:store,security,scheduleNotificationAuthority:a,
  API:'https://memphis-zoo-mcp.onrender.com',API_ORIGIN:'https://memphis-zoo-mcp.onrender.com',nativeVault:true,browserTestBuild:false,browserCredentialTransport:null,
  localStorage:disk,location:{href:'https://synthetic.invalid/employee-schedule.html'},rawFetch:()=>{throw Error('no raw fetch');},confirmPendingEnrollment:()=>{throw Error('unrelated confirmation');},
  nativeCustodialAuthorizedFetch:({resolvedUrl,deviceId,init})=>{if(assertDispatchUnlocked)assert.equal(lock,false);sent.push({path:resolvedUrl.pathname,deviceId,generation:store.getGeneration(),method:init.method,admissionLockObserved:lock});
   return new Promise(done=>{release=(rows=[acceptedReadSession])=>done(new Response(JSON.stringify({ok:true,data:[],meta:{accepted_location_sessions:rows}}),{status:200}));});},
  URL,Request,Headers,Response,FormData,Blob,AbortSignal,JSON,Number,Promise,encodeURIComponent});
 vm.runInContext(program,context);
 return {a,context,store,raw,get sent(){return sent;},get release(){return release;},settled:()=>assert.equal(lock,false),
  async actor(p){secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,record(p));await store.ensureSecurityState();}};
}
await check('READ native-current-schedule-replacement',async()=>{
 // New changed join: actual SecurityRuntime/credential FIFO/bridge request
 // boundary, with recording synthetic native HTTP and EMPTY accepted rows.
 // No accepted START/provider cancellation or real native authority is minted.
 // This changed schedule fixture observes the browser admission lock rather
 // than asserting native-port lock timing. Historical members keep their
 // original dispatch-unlocked assertion; this member proves only read-owner
 // replacement/FIFO completion and terminal cleanup, not native network locks.
 const f=await nativeAcceptedReadFixture({assertDispatchUnlocked:false}),failures=[],ownedRequest=f.context.requestEnvelope;
 f.context.requestEnvelope=async(...args)=>{try{return await ownedRequest(...args);}catch(error){failures.push({code:error?.code,message:error?.message});throw error;}};
 const first=f.context.read();
 for(let i=0;i<30&&f.sent.length<1;i++)await turn();
 if(!f.sent.length){const h=f.store.getStatus();console.error(JSON.stringify({case:'NEW_NATIVE_REPLACEMENT_PREREQUISITE',failures,
   ready:h.ready,available:h.available,quarantined:h.quarantined,generation:h.generation,
   identityMatches:vm.runInContext('currentPrincipalIdentity()',f.context)===scope,originalResult:await first}));}
 assert.equal(f.sent.length,1);
 const originalReply=f.release;
 assert.equal(await f.a.observe(schedule(11)),true,'new admitted schedule observation must be current first');
 const replacement=f.context.read();
 for(let i=0;i<30&&f.sent.length<2;i++)await turn();assert.equal(f.sent.length,2,'current schedule must acquire its own authenticated FIFO read');
 const currentReply=f.release;
 assert.notEqual(originalReply,currentReply);assert.equal(f.sent[1].generation,f.store.getGeneration());
 originalReply([]);assert.equal(await first,false,'old authenticated read remains stale after schedule replacement');
 const joined=f.context.read();await turn();assert.equal(f.sent.length,2,'old finally cannot clear the current flight');
 currentReply([]);assert.equal(await replacement,true);assert.equal(await joined,true);
 assert.equal(f.a.isLocationReminderRetired(data(),scope),false,'an empty current read is not accepted scan-in evidence');f.settled();
});
await check('READ native-current-accepted-start-retirement',async()=>{
 // Newly affected owning producer join, not the old direct-observer cases:
 // actual bridge reconciliation -> actual credential FIFO/read token ->
 // accepted-session consumer -> actual browser presenter/audio retirement.
 // Native HTTP, DOM/audio and accepted SQL response are declared fixtures.
 const f=await nativeAcceptedReadFixture({assertDispatchUnlocked:false});
 assert.equal(await f.a.observe(schedule(11)),true);
 class FixtureDate extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const r=renderer(f.a,{dateClass:FixtureDate});
 // Complete the actual asynchronous device-read initialization; never
 // replace its renderer registration or inject a private presentation hook.
 for(let i=0;i<20&&!r.context.window.MemphisDeviceReminders;i++)await turn();
 assert.equal(typeof r.context.window.MemphisDeviceReminders?.reconcileScheduleAuthority,'function');
 const displayed=await r.presenter.accept(event(data()));
 if(!displayed)console.error(JSON.stringify({case:'NEW_ACCEPTED_READ_POPUP_PREREQUISITE',current:f.a.isCurrent(data(),scope),warnings:r.warnings,
   rendered:r.browser.active,saves:r.saves.map(x=>({owner:x.owner,visualState:x.visualState,audioState:x.audioState}))}));
 assert.equal(displayed,true);await turn();
 assert.equal(r.browser.active,true);assert.equal(r.browser.tones[0].paused,false);
 const originalCard=r.browser.card;
 Object.assign(f.context,{window:{MemphisDeviceReminders:r.context.window.MemphisDeviceReminders},
   notificationPresentation:{snapshot:()=>({capable:false})},notificationPresenter:r.presenter,
   nativeNotificationScheduler:{reconcile:()=>assert.fail('Incapable native port must remain unused')}});
 const source=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const start=source.indexOf('  async function reconcileScheduleNotifications(){');
 const end=source.indexOf('  const nativeNotificationScheduler =',start);
 assert.ok(start>=0&&end>start);
 vm.runInContext(source.slice(start,end)+';globalThis.reconcileAcceptedStart=reconcileScheduleNotifications;',f.context);
 const pending=f.context.reconcileAcceptedStart();
 for(let i=0;i<40&&!f.release;i++)await turn();assert.equal(f.sent.length,1);
 f.release([{...acceptedReadSession,schedule_authority_revision:'11'}]);
 assert.equal(await pending,false,'Skipped native cleanup is not a native cancellation ACK');
 await turn();f.settled();
 assert.equal(f.a.isLocationReminderRetired(data(),scope),true);
 assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);
 assert.equal(r.browser.state.activeAudioAlert,null);
 await originalCard.querySelector('.mz-reminder-open').click();
 await originalCard.querySelector('.mz-reminder-dismiss').click();
 assert.deepEqual(r.actions,[]);assert.equal(r.browser.httpActions.length,0,'No receipt/send action from a retired popup');
 assert.equal(f.a.isLocationReminderRetired(data(key('20261011150000000002')),scope),false);
 assert.equal(await r.presenter.accept(event(data(key('20261011150000000002')))),true);
 assert.equal(r.browser.active,true,'The next exact microsecond occurrence remains eligible');
});
await check('READ native-original-dispatch',async()=>{
 const f=await nativeAcceptedReadFixture(),generation=f.store.getGeneration(),work=f.context.read();
 for(let i=0;i<30&&!f.release;i++)await turn();assert.equal(f.sent.length,1);assert.equal(f.sent[0].generation,generation);
 f.release();assert.equal(await work,true);assert.equal(f.a.isLocationReminderRetired(data(),scope),true);f.settled();
});
await check('READ native-before-dispatch-generation',async()=>{
 const f=await nativeAcceptedReadFixture(),generation=f.store.getGeneration();
 f.raw.setItem('mz_native_notification_outbox:synthetic-existing-history',JSON.stringify({device_id:deviceId,schema_version:'native-notification-outbox.v2'}));
 const advancing=f.store.ensureSecurityState(),work=f.context.read();await advancing;
 assert.ok(f.store.getGeneration()>generation);assert.equal(await work,false);assert.equal(f.sent.length,0);
 assert.equal(f.a.isLocationReminderRetired(data(),scope),false);f.settled();
});
await check('READ native-await-aba',async()=>{
 const f=await nativeAcceptedReadFixture(),generation=f.store.getGeneration(),work=f.context.read();
 for(let i=0;i<30&&!f.release;i++)await turn();assert.equal(f.sent.length,1);
 await f.actor({...principal,employee_id:id(90),credential_id:id(91),assignment_epoch:8});await f.actor(principal);
 assert.ok(f.store.getGeneration()>generation);assert.equal(principalIdentity(f.store.getStatus().principal),scope);
 f.release();assert.equal(await work,false);assert.equal(f.a.isLocationReminderRetired(data(),scope),false);f.settled();
});
await check('ORIGIN legacy-null-or-missing-is-not-origin-proof',async()=>{
 const f=await acceptedReadFixture(),row=structuredClone(acceptedReadSession);
 // Exact CURRENT-only producer DTO. No hidden old actor or genuine original
 // START proof is invented here: this row cannot qualify originating proof.
 assert.equal(Object.hasOwn(row,'original_start'),false);
 const work=f.context.read();f.release({meta:{accepted_location_sessions:[row]}});
 const accepted=await work,retired=f.a.isLocationReminderRetired(data(),scope);
 // Main explicitly retains this narrow legacy presentation path. The earlier
 // missing-origin failure remains evidence of NON-origin qualification, not
 // permission to dead-hold legitimate current server open work.
 assert.equal(accepted,true);assert.equal(retired,true);
 const second=f.context.read();f.release({meta:{accepted_location_sessions:[{...row,original_start:null}]}});
 assert.equal(await second,true);assert.equal(f.a.isCurrent(data(key('20261011150000000002')),scope),true);
});
const originSample=(changes={})=>({schema:'custodial.accepted-start-origin.v1',source_kind:'native_offline_context',
 context_id:id(60),occurrence_id:id(61),client_session_id:session.open_session_uuid,employee_id:principal.employee_id,
 device_id:id(1),credential_id:principal.credential_id,assignment_epoch:'7',location_id:locationId,
 native_scan_entry_id:id(62),occurrence_fingerprint:'b'.repeat(64),started_at:session.open_session_started_at,
 context_status:'activated',proof_state:'issued',...changes});
const originRow=(origin,changes={})=>({...acceptedReadSession,original_start:origin,...changes});
await check('ORIGIN old-credential-epoch-source-counterexample',async()=>{
 const originalCode=readFileSync(new URL('../before/notification-schedule-authority.js',import.meta.url),'utf8');
 const resolved=originalCode.replace("'../../../memphis-recurring-schedule-target.js'",JSON.stringify(new URL('../memphis-recurring-schedule-target.js',import.meta.url).href))
  .replace("'./protected-principal.js'",JSON.stringify(new URL('../mobile/src/custodial/protected-principal.js',import.meta.url).href))
  .replace("'./home-facts.js'",JSON.stringify(new URL('../mobile/src/custodial/home-facts.js',import.meta.url).href));
 const {createScheduleNotificationAuthority:before}=await import('data:text/javascript,'+encodeURIComponent(resolved));
 const a=before({identity:()=>scope,principal:()=>principal,status:()=>({ready:true,available:true,generation:10}),storage:storage(),now:()=>time});
 await a.observe(schedule());const originalRead=a.beginAcceptedLocationSessionRead(scope),wrong=originRow(originSample({credential_id:id(90),assignment_epoch:'6'}));
 assert.equal(a.observeAcceptedLocationSession(wrong,scope,originalRead),true,'sealed current-only callback ignores exported old originating actor');
 assert.equal(a.isLocationReminderRetired(data(),scope),true);
 const f=await acceptedReadFixture(),read=f.context.read();f.release({meta:{accepted_location_sessions:[wrong]}});
 assert.equal(await read,false);assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
});
await check('ORIGIN bad-supplied-origin-cannot-reuse-legacy-retirement',async()=>{
 const f=await acceptedReadFixture(),first=f.context.read();f.release({meta:{accepted_location_sessions:[acceptedReadSession]}});
 assert.equal(await first,true);assert.equal(f.a.isLocationReminderRetired(data(),scope),true);
 const later=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample({credential_id:id(90),assignment_epoch:'6'}))]}});
 assert.equal(await later,false);assert.equal(f.a.isLocationReminderRetired(data(),scope),false,'bad supplied source must not fall back to cached READ-only retirement');
});
await check('ORIGIN native-original-and-canonical-distinct-client-ids',async()=>{
 for(const [origin,changes] of [[originSample(),{}],
  [originSample({source_kind:'session',client_session_id:'actual-source-client-id-not-server-uuid',context_status:'committed',proof_state:'consumed'}),{open_session_status:'pending_submit'}],
  [originSample({source_kind:'session',client_session_id:'another-source-client-id'}),{}],
  [originSample({client_session_id:'native-client-text-id'}),{open_session_uuid:'native-client-text-id'}]]){
  const f=await acceptedReadFixture(),read=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(origin,changes)]}});
  assert.equal(await read,true);assert.equal(f.a.isLocationReminderRetired(data(),scope),true);assert.equal(f.a.isCurrent(data(key('20261011150000000002')),scope),true);
 }
});
await check('ORIGIN same-context-cannot-rebind-scan-or-fingerprint',async()=>{
 const f=await acceptedReadFixture(),first=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample())]}});assert.equal(await first,true);
 const next=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample({native_scan_entry_id:id(63),occurrence_fingerprint:'c'.repeat(64)}))]}});
 assert.equal(await next,false,'same context/client/start cannot silently replace its original scan/fingerprint');assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
});
await check('ORIGIN same-original-native-to-canonical-transition',async()=>{
 const f=await acceptedReadFixture(),first=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample())]}});assert.equal(await first,true);
 const next=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample({source_kind:'session',context_status:'committed',proof_state:'consumed'}),
  {open_session_uuid:id(80),open_session_status:'pending_submit'})]}});
 assert.equal(await next,true,'fixed canonical DB linkage may use a different server session UUID for the SAME immutable original');
 assert.equal(f.a.isLocationReminderRetired(data(),scope),true);assert.equal(f.a.isCurrent(data(key('20261011150000000002')),scope),true);
});
await check('ORIGIN malformed-or-foreign-object-never-falls-back',async()=>{
 const bad=[]; // null is tested only by the explicitly retained legacy case.
 bad.push(true,{}, {...originSample(),extra:true},originSample({schema:'unknown'}),originSample({source_kind:'unknown'}),
  originSample({context_id:null}),originSample({occurrence_id:'bad'}),originSample({native_scan_entry_id:null}),
  originSample({employee_id:id(90)}),originSample({credential_id:id(90)}),originSample({assignment_epoch:'6'}),originSample({assignment_epoch:7}),
  originSample({device_id:deviceId}),originSample({location_id:id(90)}),originSample({occurrence_fingerprint:'bad'}),
  originSample({started_at:'2026-10-11T15:00:00.000002Z'}),originSample({started_at:'2026-02-30T15:00:00.000001Z'}),
  originSample({context_status:'activated',proof_state:'consumed'}),originSample({context_status:'committed',proof_state:'issued'}),
  originSample({context_status:'committed',proof_state:'consumed'}),originSample({client_session_id:'different-native-client'}),originSample({client_session_id:'x'.repeat(201)}));
 for(const original of bad){const f=await acceptedReadFixture(),read=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(original)]}});
  assert.equal(await read,false);assert.equal(f.a.isLocationReminderRetired(data(),scope),false);}
});
await check('ORIGIN missing-origin-cannot-erase-same-cycle-binding',async()=>{
 const f=await acceptedReadFixture(),first=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample())]}});assert.equal(await first,true);
 const legacy=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(null)]}});assert.equal(await legacy,true);
 const changed=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample({context_id:id(70),occurrence_id:id(71)}))]}});
 assert.equal(await changed,false,'a missing optional object cannot allow re-binding the previously observed same cycle');
 assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
});
await check('ORIGIN canonical-phase-cannot-roll-back-to-native',async()=>{
 const f=await acceptedReadFixture(),first=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample({source_kind:'session',context_status:'committed',proof_state:'consumed'}),
  {open_session_uuid:id(80),open_session_status:'pending_submit'})]}});assert.equal(await first,true);
 const rollback=f.context.read();f.release({meta:{accepted_location_sessions:[originRow(originSample())]}});
 assert.equal(await rollback,false);assert.equal(f.a.isLocationReminderRetired(data(),scope),false);
});
await check('ORIGIN source-client-text-character-bound',async()=>{
 for(const [client,accepted] of [['\u{1f9f9}'.repeat(200),true],['\u{1f9f9}'.repeat(201),false],[' original-client ',false]]){
  const f=await acceptedReadFixture(),read=f.context.read();
  f.release({meta:{accepted_location_sessions:[originRow(originSample({client_session_id:client}),{open_session_uuid:client})]}});
  assert.equal(await read,accepted,'source TEXT is bounded by characters, never clipped/renamed or restricted to UUID/200 bytes');
  assert.equal(f.a.isLocationReminderRetired(data(),scope),accepted);
 }
});
const loan='c'.repeat(64);
const responsibility=(overrides={})=>({coverage_purpose:'lunch_coverage',loan_id:loan,service_date:day,projection_id:projectionId,coverer_person_id:id(1),normal_owner_person_id:id(99),coverage_start:'11:30:00',coverage_end:'12:15:00',name:'Synthetic borrowed restroom',...overrides});
const lunchData=(overrides={})=>({...data('d'.repeat(64)),kind:'employee_lunch_coverage',loan_id:loan,document_identity:'a'.repeat(64),event:'start',scheduled_time:'11:30',scheduled_at:'2026-10-11T16:30:00.000000Z',valid_until:'2026-10-11T17:15:00.000000Z',coverer_slot_id:'synthetic-coverer',...overrides});
await check('LUNCH digest alone cannot authorize before start or at/after actual coverage end',async()=>{
 let clock=Date.parse('2026-10-11T16:29:59Z');const {authority:a}=make(()=>clock);await a.observe(schedule(10,[responsibility()]));
 assert.equal(a.isCurrent(lunchData(),scope),false,'matching digest alone before start');clock=Date.parse('2026-10-11T16:30:00Z');assert.equal(a.isCurrent(lunchData(),scope),true);
 clock=Date.parse('2026-10-11T17:15:00Z');assert.equal(a.isCurrent(lunchData(),scope),false,'coverage end is exclusive');
});
await check('LUNCH exact loan/recipient/projection rows are required; regular duties are not lunch evidence',async()=>{
 for(const item of [responsibility({coverer_person_id:id(90)}),responsibility({loan_id:'e'.repeat(64)}),responsibility({projection_id:id(90)}),responsibility({service_date:'2026-10-10'}),responsibility({coverage_purpose:'area_owner'}),responsibility({coverage_start:'bad'})]){
  const {authority:a}=make();await a.observe(schedule(10,[item]));assert.equal(a.isCurrent(lunchData(),scope),false);
 }
 const {authority:a}=make();await a.observe(schedule());assert.equal(a.isCurrent(lunchData(),scope),false,'no accepted responsibility');
});
await check('LUNCH original finite end cue survives coverage expiry only until its own cutoff',async()=>{
 let clock=Date.parse('2026-10-11T17:14:59Z');const {authority:a}=make(()=>clock);await a.observe(schedule(10,[responsibility()]));
 const end=lunchData({event:'end',scheduled_time:'12:15',scheduled_at:'2026-10-11T17:15:00.000000Z',valid_until:'2026-10-11T17:25:00.000000Z'});
 assert.equal(a.isCurrent(end,scope),false);clock=Date.parse('2026-10-11T17:15:00Z');assert.equal(a.isCurrent(end,scope),true);
 clock=Date.parse('2026-10-11T17:25:00Z');assert.equal(a.isCurrent(end,scope),false);assert.equal(a.isCurrent({...end,valid_until:undefined},scope),false,'no invented end-cue lifetime');
});
await check('LUNCH malformed/original-time/cutoff/principal/digest inputs cannot authorize a popup',async()=>{
 const {authority:a}=make();await a.observe(schedule(10,[responsibility()]));
 for(const bad of [{loan_id:undefined},{event:'unknown'},{scheduled_time:'12:00'},{scheduled_at:'2026-02-30T17:00:00Z'},{scheduled_at:'2026-10-10T17:00:00Z'},{valid_until:null},{valid_until:'2026-10-11T16:00:00Z'},{receipt_employee_id:id(80)},{document_identity:'e'.repeat(64)},{schedule_authority_revision:9}])assert.equal(a.isCurrent(lunchData(bad),scope),false,JSON.stringify(bad));
});
await check('LUNCH accepted 11:30/12:00/12:30 starts use actual 45-minute windows not a default hour',async()=>{
 for(const [start,end,utc] of [['11:30:00','12:15:00','16:30'],['12:00:00','12:45:00','17:00'],['12:30:00','13:15:00','17:30']]){
  let clock=Date.parse(`2026-10-11T${utc}:00Z`);const {authority:a}=make(()=>clock);await a.observe(schedule(10,[responsibility({coverage_start:start,coverage_end:end})]));const d=lunchData({scheduled_time:start.slice(0,5),scheduled_at:new Date(clock).toISOString(),valid_until:new Date(clock+45*60000).toISOString()});
  assert.equal(a.isCurrent(d,scope),true);clock+=45*60000;assert.equal(a.isCurrent(d,scope),false);
 }
});
await check('LUNCH actual presenter/renderer retires expired episode without action; overlap remains independently eligible',async()=>{
 let clock=time;const {authority:a}=make(()=>clock);const otherLoan='e'.repeat(64);await a.observe(schedule(10,[responsibility(),responsibility({loan_id:otherLoan,coverage_start:'12:00:00',coverage_end:'13:00:00'})]));
 const r=renderer(a);assert.equal(await r.presenter.accept(event(lunchData())),true);await turn();const old=r.browser.card;
 assert.equal(old.querySelector('.mz-reminder-dismiss').textContent,'Dismiss');clock=Date.parse('2026-10-11T17:15:00Z');await r.presenter.retry();await turn();assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);
 await old.querySelector('.mz-reminder-open').click();assert.deepEqual(r.actions,[]);
 const next=lunchData({loan_id:otherLoan,notification_key:'f'.repeat(64),scheduled_time:'12:00',scheduled_at:'2026-10-11T17:00:00Z',valid_until:'2026-10-11T18:00:00Z'});
 assert.equal(a.isCurrent(next,scope),true);assert.equal(await r.presenter.accept(event(next)),true);assert.equal(r.browser.active,true);assert.ok(r.saves.length>0,'original history retained');
});
await check('LUNCH scheduler expiry cancels only original episode and retains overlap/location identities',async()=>{
 let clock=time;const {authority:a}=make(()=>clock),otherLoan='e'.repeat(64);await a.observe(schedule(10,[responsibility(),responsibility({loan_id:otherLoan,coverage_start:'12:00:00',coverage_end:'13:00:00'})]));
 const disk=storage(),pending=new Map(),delivered=new Map(),cancelled=[];
 const scheduler=createPrincipalNotificationScheduler({identity:()=>scope,mutate:async fn=>fn(),storage:disk,prefix:'lunch-owned:',isCurrent:(n,s)=>a.isCurrent(n.extra,s),plugin:{getPending:async()=>({notifications:[...pending.values()]}),getDeliveredNotifications:async()=>({notifications:[...delivered.values()]}),schedule:async({notifications})=>{for(const n of notifications)pending.set(n.id,n);},cancel:async({notifications})=>{for(const n of notifications){cancelled.push(n.id);pending.delete(n.id);}},removeDeliveredNotifications:async({notifications})=>{for(const n of notifications)delivered.delete(n.id);}}});
 assert.equal(await scheduler.present({title:'First accepted lunch',extra:lunchData()},scope),true);const first=[...pending.values()][0];
 assert.equal(await scheduler.present({title:'Overlapping accepted lunch',extra:lunchData({loan_id:otherLoan,notification_key:'f'.repeat(64),scheduled_time:'12:00',scheduled_at:'2026-10-11T17:00:00Z',valid_until:'2026-10-11T18:00:00Z'})},scope),true);
 assert.equal(await scheduler.present({title:'Original overdue episode',extra:data(key('20261011145959000000','overdue','1'))},scope),true);
 delivered.set(first.id,{id:first.id,group:first.group});clock=Date.parse('2026-10-11T17:15:00Z');assert.equal(scheduler.ownsAction(first),false);await scheduler.reconcile();
 assert.deepEqual(cancelled,[first.id]);assert.equal(delivered.size,0);assert.equal(pending.size,2);assert.equal(JSON.parse(disk.getItem('lunch-owned:'+first.id)).state,'cancelled');
 assert.equal([...pending.values()].every(n=>scheduler.ownsAction(n)),true);assert.equal([...pending.values()].some(n=>n.extra.notification_key===key('20261011145959000000','overdue','1')),true);
});
function ordinaryAction(){const value=mirrorAction();value.fn.providerMirror=false;return value;}
await check('RENDERER lunch ordinary card uses immutable original payload/scope; expiry retires only its own episode',async()=>{
 let clock=time;const {authority:a}=make(()=>clock),otherLoan='e'.repeat(64);await a.observe(schedule(10,[responsibility(),responsibility({loan_id:otherLoan,coverage_start:'12:00:00',coverage_end:'13:00:00'})]));
 const r=renderer(a),m=ordinaryAction(),source=lunchData(),saved=structuredClone(source),seen=[];
 r.context.window.MemphisMobile.isLunchNotificationCurrent=(d,s)=>{seen.push({d,s});return s===scope&&a.isCurrent(d,s);};
 assert.equal(r.show(event(source),m.fn),true);await turn();assert.ok(seen.length>0,'renderer must consult the ordinary lunch capability');
 assert.deepEqual(JSON.parse(JSON.stringify(seen[0].d)),saved);assert.equal(seen[0].s,scope);assert.equal(Object.isFrozen(seen[0].d),true);
 const original=seen[0].d,old=r.browser.card;source.loan_id='f'.repeat(64);source.valid_until='2026-10-11T19:00:00Z';
 r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(r.browser.active,true,'caller mutation cannot rebind the accepted episode');assert.ok(seen.every(v=>v.d===original&&v.s===scope));
 clock=Date.parse('2026-10-11T17:15:00Z');r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();await turn();
 assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);await old.querySelector('.mz-reminder-open').click();await old.querySelector('.mz-reminder-dismiss').click();assert.deepEqual(m.actions,[]);assert.equal(r.browser.httpActions.length,0);
 const overlap=lunchData({loan_id:otherLoan,notification_key:'f'.repeat(64),scheduled_time:'12:00',scheduled_at:'2026-10-11T17:00:00Z',valid_until:'2026-10-11T18:00:00Z'}),next=ordinaryAction();
 assert.equal(r.show(event(overlap),next.fn),true);r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(r.browser.active,true);assert.equal(r.browser.card.querySelector('.mz-reminder-dismiss').textContent,'Dismiss');
 const overdue=renderer(a),n=ordinaryAction();assert.equal(overdue.show(event(data(key('20261011145959000000','overdue','1'))),n.fn),true);overdue.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(overdue.browser.active,true);
});
await check('RENDERER lunch ordinary currentness changes fence actions without accepting a new principal or revision',async()=>{
 for(const change of ['revision','unavailable','principal']){
  const {authority:a}=make();await a.observe(schedule(10,[responsibility()]));const r=renderer(a),m=ordinaryAction();
  let currentScope=scope;r.context.window.MemphisMobile.principalIdentity=()=>currentScope;
  r.context.window.MemphisMobile.isLunchNotificationCurrent=(d,s)=>s===currentScope&&a.isCurrent(d,s);
  assert.equal(r.show(event(lunchData({schedule_authority_revision:10})),m.fn),true);await turn();const old=r.browser.card;
  if(change==='revision')await a.observe(schedule(11,[responsibility()]));else if(change==='unavailable')await a.unavailable(scope);else currentScope='foreign-current-principal';
  await old.querySelector('.mz-reminder-open').click();await turn();assert.equal(r.browser.active,false,change);assert.deepEqual(m.actions,[],change);assert.equal(r.browser.httpActions.length,0);
 }
});
await check('RENDERER lunch ordinary missing/unavailable/nonboolean callback is unconfirmed at admission and reconciliation',async()=>{
 for(const callback of [null,()=>undefined,()=>false,()=>({current:true}),()=>{throw Error('unavailable');}]){
  const {authority:a}=make();await a.observe(schedule(10,[responsibility()]));const r=renderer(a,{lunchObserver:false}),m=ordinaryAction();
  if(callback)r.context.window.MemphisMobile.isLunchNotificationCurrent=callback;
  assert.equal(r.show(event(lunchData()),m.fn),false);assert.equal(r.browser.active,false);assert.deepEqual(m.actions,[]);assert.equal(r.browser.tones.length,0);
 }
 const {authority:a}=make();await a.observe(schedule(10,[responsibility()]));const r=renderer(a),m=ordinaryAction();assert.equal(r.show(event(lunchData()),m.fn),true);await turn();delete r.context.window.MemphisMobile.isLunchNotificationCurrent;r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);assert.deepEqual(m.actions,[]);
});
await check('RENDERER lunch native provider mirror ignores ordinary JS denial and retains original action lifetime',async()=>{
 const {authority:a}=make();await a.observe(schedule(10,[responsibility()]));const r=renderer(a,{native:true}),m=mirrorAction();let calls=0,live=true;
 r.context.window.MemphisMobile.isLunchNotificationCurrent=()=>{calls++;throw Error('ordinary JS source unavailable');};m.fn.isCurrent=()=>live;
 assert.equal(r.show(event(lunchData()),m.fn),true);await turn();await a.unavailable(scope);r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();await r.browser.poll();
 assert.equal(calls,0);assert.equal(r.browser.active,true);assert.equal(r.browser.tones[0].paused,false);assert.deepEqual(m.actions,[]);assert.equal(r.browser.fetches,0);
 live=false;r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);assert.equal(calls,0);assert.deepEqual(m.actions,[]);
});
const pageHTML=readFileSync(new URL('../employee-schedule.html',import.meta.url),'utf8');
const pageInline=[...pageHTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const committedBridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
function mountActualPage(r,a,disk,clock){
 const c=r.context,nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',hidden:true,addEventListener(){}});return nodes.get(id);};
 let next=schedule(10,[responsibility()]),offline=false,rejected=false,activeScope=scope,activePrincipal=principal;const reads=[],reconciles=new Set();
 c.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock()]));}static now(){return clock();}};
 Object.assign(c,{Intl,crypto:webcrypto,TextEncoder,AbortController,clearInterval(){},localStorage:disk});
 c.document.getElementById=node;
 c.window.navigator={locks:scheduleLocks};
 c.window.MemphisRecurringScheduleTarget=globalThis.MemphisRecurringScheduleTarget;
 c.window.addEventListener=(name,fn)=>{const prior=r.events.get(name);r.events.set(name,event=>{prior?.(event);fn(event);});};
 c.window.MemphisCustodialSecurity={native:true,getStatus:()=>({ready:true,available:true,quarantined:false,deviceId,principal:activePrincipal}),mutateProtectedWork:async fn=>fn()};
 Object.assign(c.window.MemphisMobile,{ready:Promise.resolve(),deviceId:()=>deviceId,principalIdentity:()=>activeScope,
  profileMatchesPrincipal:d=>profileMatchesPrincipal(d,activePrincipal),requestJson:async path=>{reads.push(path);return{};}});
 Object.assign(c,{currentPrincipal:()=>activePrincipal,currentPrincipalIdentity:()=>activeScope,scheduleNotificationAuthority:a,
  refreshAcceptedLocationSessions:async()=>false,notificationPresentation:{snapshot:()=>({capable:false})},notificationPresenter:r.presenter});
 const getterStart=committedBridge.indexOf('    isLunchNotificationCurrent(data,scope) {'),getterEnd=committedBridge.indexOf('    isScheduleReminderCurrent(',getterStart);
 const retryStart=committedBridge.indexOf('  async function reconcileScheduleNotifications(){'),retryEnd=committedBridge.indexOf('  const nativeNotificationScheduler',retryStart);
 assert.ok(getterStart>=0&&getterEnd>getterStart&&retryStart>=0&&retryEnd>retryStart);
 // Execute the actual public getter/reconciliation bodies. Only transport,
 // incapable native scheduling and protected principal are synthetic seams.
 vm.runInContext('globalThis.pageLunchGetter=({'+committedBridge.slice(getterStart,getterEnd)+'}).isLunchNotificationCurrent;'+committedBridge.slice(retryStart,retryEnd),c);
 c.window.MemphisMobile.isLunchNotificationCurrent=c.pageLunchGetter;
 c.window.MemphisMobile.retryNotificationPresentation=()=>{const pending=c.reconcileScheduleNotifications();reconciles.add(pending);pending.finally(()=>reconciles.delete(pending));return pending;};
 c.fetch=async()=>{reads.push('source GET');const ticket=await a.beginResponse(scope);
  if(offline)throw Error('ordinary offline');
  if(rejected){await a.unavailable(scope,ticket);return{ok:false,status:503,json:async()=>({ok:false})};}
  const response=structuredClone(next);assert.equal(await a.observe(response,scope,ticket),true);return{ok:true,json:async()=>({ok:true,data:response})};};
 const observation="globalThis.schedulePage={load,isIdle:()=>!loading&&!queued};";
 vm.runInContext(pageInline.replace("void load('launch');",observation),c,{filename:'actual-Schedule-inline.js'});
 const settle=async()=>{const deadline=Date.now()+2000;do{await turn();if(c.schedulePage.isIdle()&&reconciles.size===0)return;}while(Date.now()<deadline);assert.fail('new Schedule/renderer composition did not settle');};
 return{node,reads,load:async()=>{await c.schedulePage.load();await settle();},settle,
  dispatch:(name,event={})=>r.events.get(name)?.(event),
  set next(value){next=value;},set offline(value){offline=value;},set rejected(value){rejected=value;},set principal(value){activePrincipal=value;activeScope=principalIdentity(value);}};
}
await check('PAGE lunch actual boundary removes expired original card/audio and preserves overlapping accepted duty',async()=>{
 let clock=time;const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock),otherLoan='e'.repeat(64);
 p.next=schedule(10,[responsibility(),responsibility({loan_id:otherLoan,coverage_start:'12:00:00',coverage_end:'13:00:00'})]);
 disk.setItem('protected-cleaning-draft','unchanged synthetic original');
 try{await p.load();await a.refresh();assert.equal(p.node('lunch-content').hidden,false);const m=ordinaryAction();assert.equal(r.show(event(lunchData()),m.fn),true);await turn();const old=r.browser.card;
  clock=Date.parse('2026-10-11T17:15:00Z');p.offline=true;r.browser.runTimer(15*60000);await p.settle();
  assert.equal(p.node('lunch-content').hidden,false,'overlapping accepted duty remains');assert.equal(p.node('lunch-areas').innerHTML.includes('11:30 AM'),false);
  assert.equal(r.browser.active,false,'page boundary must immediately reconcile the old card');assert.equal(r.browser.tones[0].paused,true);await old.querySelector('.mz-reminder-open').click();assert.deepEqual(m.actions,[]);assert.equal(r.browser.httpActions.length,0);
  assert.equal(disk.getItem('protected-cleaning-draft'),'unchanged synthetic original');
  const overlapping=lunchData({loan_id:otherLoan,notification_key:'f'.repeat(64),scheduled_time:'12:00',scheduled_at:'2026-10-11T17:00:00Z',valid_until:'2026-10-11T18:00:00Z'});
  assert.equal(r.show(event(overlapping),ordinaryAction().fn),true);assert.equal(r.browser.card.querySelector('.mz-reminder-dismiss').textContent,'Dismiss');
 }finally{p.dispatch('pagehide');await p.settle();}
});
await check('PAGE lunch accepted replacement and unavailable source immediately reconcile ordinary presentation',async()=>{
 for(const outcome of ['accepted replacement','unavailable']){
  const {authority:a,disk}=make(),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>time);
  try{await p.load();await a.refresh();const m=ordinaryAction();assert.equal(r.show(event(lunchData({schedule_authority_revision:10})),m.fn),true);await turn();
   if(outcome==='accepted replacement')p.next=schedule(11,[]);else p.rejected=true;
   await p.load();assert.equal(r.browser.active,false,outcome);assert.equal(r.browser.tones[0].paused,true);assert.deepEqual(m.actions,[]);assert.deepEqual(r.warnings,[]);assert.equal(r.browser.httpActions.length,0);
   assert.equal(r.show(event(lunchData()),ordinaryAction().fn),false,'old episode cannot revive');
  }finally{p.dispatch('pagehide');await p.settle();}
 }
});
await check('PAGE lunch original accepted scan/cycle currentness is reconciled by render without withdrawing next cycle',async()=>{
 const {authority:a,disk}=make(),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>time);
 try{await p.load();await a.refresh();const m=ordinaryAction();assert.equal(r.show(event(data()),m.fn),true);await turn();assert.equal(a.observeAcceptedLocationSession(session,scope,a.beginAcceptedLocationSessionRead(scope)),true);
  await p.load();assert.equal(r.browser.active,false,'same original old cycle retired after page application');assert.equal(r.browser.tones[0].paused,true);assert.deepEqual(m.actions,[]);
  assert.equal(r.show(event(data(key('20261011150000000002'))),ordinaryAction().fn),true);await p.load();assert.equal(r.browser.active,true,'later cycle remains eligible');
 }finally{p.dispatch('pagehide');await p.settle();}
});
await check('PAGE lunch navigation/principal change does not revive old popup and source PENDING adds no speech authority',async()=>{
 let clock=time;const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock);
 try{await p.load();await a.refresh();const m=ordinaryAction();assert.equal(r.show(event(lunchData()),m.fn),true);await turn();p.dispatch('pagehide');await p.settle();assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);
  p.principal={...principal,assignment_epoch:8};p.dispatch('pageshow');await p.settle();assert.equal(r.show(event(lunchData()),ordinaryAction().fn),false);assert.equal(p.node('lunch-content').hidden,true);assert.deepEqual(m.actions,[]);
  p.dispatch('pagehide');p.principal=principal;clock=Date.parse('2026-10-11T17:15:00Z');p.dispatch('pageshow');await p.settle();assert.equal(r.show(event(lunchData()),ordinaryAction().fn),false);assert.equal(r.browser.active,false);
  assert.equal(p.reads.some(path=>path.endsWith('application-receipt')||path.endsWith('delivery-receipt')),false,'typed source PENDING is not complete-phone ACK');assert.equal(r.browser.httpActions.length,0);assert.deepEqual(r.warnings,[]);
 }finally{p.dispatch('pagehide');await p.settle();}
});
await check('PAGE lunch accepted-window activation and original finite end cutoff remain distinct on offline page lifecycle',async()=>{
 let clock=time;const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock);
 const start=lunchData({scheduled_time:'12:30',scheduled_at:'2026-10-11T17:30:00Z',valid_until:'2026-10-11T18:15:00Z'});
 const end=lunchData({event:'end',notification_key:'f'.repeat(64),scheduled_time:'13:15',scheduled_at:'2026-10-11T18:15:00Z',valid_until:'2026-10-11T18:25:00Z'});
 p.next=schedule(10,[responsibility({coverage_start:'12:30:00',coverage_end:'13:15:00'}),{name:'Regular duty',coverage_start:'07:00:00',coverage_end:'16:00:00'}]);
 try{await p.load();await a.refresh();assert.equal(p.node('lunch-content').hidden,true);assert.equal(p.node('areas').innerHTML.includes('Regular duty'),true);
  assert.equal(r.show(event(start),ordinaryAction().fn),false);assert.equal(r.show(event(end),ordinaryAction().fn),false);assert.equal(r.browser.tones.length,0);
  p.offline=true;clock=Date.parse('2026-10-11T17:30:00Z');r.browser.runTimer(30*60000);await p.settle();assert.equal(p.node('lunch-content').hidden,false);const m=ordinaryAction();assert.equal(r.show(event(start),m.fn),true);await turn();
  clock=Date.parse('2026-10-11T18:15:00Z');r.browser.runTimer(45*60000);await p.settle();assert.equal(p.node('lunch-content').hidden,true);assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);assert.deepEqual(m.actions,[]);
  assert.equal(r.show(event(end),ordinaryAction().fn),true,'finite end cue is not borrowed responsibility');await turn();clock=Date.parse('2026-10-11T18:25:00Z');
  assert.equal(a.isCurrent(end,scope),false,'original cutoff has expired');r.browser.runTimer(10*60000);assert.equal(r.browser.active,false,'original finite cutoff timer retires its ordinary card');
  await p.load();assert.equal(r.browser.active,false);assert.equal(r.browser.tones.at(-1).paused,true);assert.equal(r.browser.httpActions.length,0);assert.deepEqual(r.warnings,[]);
 }finally{p.dispatch('pagehide');await p.settle();}
});
await check('PAGE lunch boundary-delay expires ordinary card before pending accepted-session read; native lease remains separate',async()=>{
 let clock=time,release;const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock);
 const pending=new Promise(resolve=>{release=resolve;});
 try{await p.load();await a.refresh();assert.equal(r.show(event(lunchData()),ordinaryAction().fn),true);await turn();
  r.context.refreshAcceptedLocationSessions=()=>pending;clock=Date.parse('2026-10-11T17:15:00Z');p.offline=true;r.browser.runTimer(15*60000);
  assert.equal(r.browser.active,false,'source boundary must not wait for an unrelated pending session read');assert.equal(r.browser.tones[0].paused,true);
  const native=mirrorAction();assert.equal(r.show(event(lunchData()),native.fn),true,'ordinary expired guard does not replace native claim authority');
  r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(r.browser.active,true);assert.deepEqual(native.actions,[]);
 }finally{release(false);p.dispatch('pagehide');await p.settle();}
});
const cutoffEnd=(extra={})=>lunchData({event:'end',notification_key:'f'.repeat(64),scheduled_time:'12:15',scheduled_at:'2026-10-11T17:15:00Z',valid_until:'2026-10-11T17:25:00Z',...extra});
await check('CUTOFF lunch original END deadline stops its own card/audio without polling, action or renewed payload',async()=>{
 let clock=Date.parse('2026-10-11T17:15:00Z');const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock),m=ordinaryAction(),source=cutoffEnd();
 try{await p.load();await a.refresh();disk.setItem('protected-original','retained');const seen=[],getter=r.context.window.MemphisMobile.isLunchNotificationCurrent;
  r.context.window.MemphisMobile.isLunchNotificationCurrent=(d,s)=>{seen.push({d,s});return getter(d,s);};
  assert.equal(r.show(event(source),m.fn),true);await turn();const old=r.browser.card,original=seen[0].d;assert.equal(Object.isFrozen(original),true);
  source.valid_until='2026-10-11T19:00:00Z';source.loan_id='e'.repeat(64);clock=Date.parse('2026-10-11T17:25:00Z');r.browser.runTimer(10*60000);await turn();
  assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,true);assert.equal(r.browser.state.activeAudioAlert,null);assert.ok(seen.every(v=>v.d===original&&v.s===scope));assert.equal(original.valid_until,'2026-10-11T17:25:00Z');
  await old.querySelector('.mz-reminder-open').click();await old.querySelector('.mz-reminder-dismiss').click();assert.deepEqual(m.actions,[]);assert.equal(r.browser.httpActions.length,0);assert.equal(disk.getItem('protected-original'),'retained');assert.deepEqual(r.warnings,[]);
 }finally{p.dispatch('pagehide');await p.settle();}
});
await check('CUTOFF lunch Dismiss preserves current audio but original cutoff stops that hidden episode',async()=>{
 let clock=Date.parse('2026-10-11T17:15:00Z');const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock),m=ordinaryAction();
 try{await p.load();await a.refresh();assert.equal(r.show(event(cutoffEnd()),m.fn),true);await turn();const old=r.browser.card;assert.equal(old.querySelector('.mz-reminder-dismiss').textContent,'Dismiss');await old.querySelector('.mz-reminder-dismiss').click();
  assert.equal(r.browser.active,false);assert.equal(r.browser.tones[0].paused,false,'normal Dismiss must not stop current sentence');assert.notEqual(r.browser.state.activeAudioAlert,null);
  clock=Date.parse('2026-10-11T17:25:00Z');r.browser.runTimer(10*60000);await turn();assert.equal(r.browser.tones[0].paused,true);assert.equal(r.browser.state.activeAudioAlert,null);assert.deepEqual(m.actions,['dismissed']);assert.equal(r.browser.httpActions.length,0);
 }finally{p.dispatch('pagehide');await p.settle();}
});
await check('CUTOFF lunch old timer cannot remove successor/overdue or govern native provider mirror',async()=>{
 let clock=Date.parse('2026-10-11T17:15:00Z'),oldTick;const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock),otherLoan='e'.repeat(64);
 p.next=schedule(10,[responsibility(),responsibility({loan_id:otherLoan,coverage_start:'12:00:00',coverage_end:'13:00:00'})]);
 try{await p.load();await a.refresh();const set=r.context.window.setTimeout;r.context.window.setTimeout=(fn,delay)=>{if(delay===10*60000)oldTick=fn;return set(fn,delay);};
  assert.equal(r.show(event(cutoffEnd()),ordinaryAction().fn),true);await turn();assert.equal(typeof oldTick,'function');clock=Date.parse('2026-10-11T17:25:00Z');r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();await turn();assert.equal(r.browser.active,false);
  const next=lunchData({loan_id:otherLoan,notification_key:'e'.repeat(64),scheduled_time:'12:00',scheduled_at:'2026-10-11T17:00:00Z',valid_until:'2026-10-11T18:00:00Z'});assert.equal(r.show(event(next),ordinaryAction().fn),true);await turn();const current=r.browser.card,tone=r.browser.tones.at(-1);oldTick();assert.equal(r.browser.card,current);assert.equal(tone.paused,false,'obsolete timer cannot stop successor audio');
 }finally{p.dispatch('pagehide');await p.settle();}
 const {authority:b,disk:other}=make(()=>clock),native=renderer(b,{native:true}),page=mountActualPage(native,b,other,()=>clock),lease=mirrorAction();let jsCalls=0,cutoffTimers=0;
 try{await page.load();await b.refresh();const set=native.context.window.setTimeout;native.context.window.setTimeout=(fn,delay)=>{if(delay===10*60000)cutoffTimers++;return set(fn,delay);};native.context.window.MemphisMobile.isLunchNotificationCurrent=()=>{jsCalls++;throw Error('unavailable JS currentness');};
  assert.equal(native.show(event(cutoffEnd()),lease.fn),true);await turn();native.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(native.browser.active,true);assert.equal(native.browser.tones[0].paused,false);assert.equal(jsCalls,0);assert.equal(cutoffTimers,0);assert.deepEqual(lease.actions,[]);
 }finally{page.dispatch('pagehide');await page.settle();}
 const {authority:b2,disk:d2}=make(()=>clock),overdue=renderer(b2,{native:true}),page2=mountActualPage(overdue,b2,d2,()=>clock);
 try{await page2.load();await b2.refresh();assert.equal(overdue.show(event(data(key('20261011145959000000','overdue','1'))),ordinaryAction().fn),true);await turn();clock+=60000;overdue.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(overdue.browser.active,true);assert.equal(overdue.browser.httpActions.length,0);
 }finally{page2.dispatch('pagehide');await page2.settle();}
});
await check('CUTOFF lunch timer rechecks original clock after backward shift and preserves microsecond cutoff',async()=>{
 let clock=Date.parse('2026-10-11T17:15:00Z');const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock);
 try{await p.load();await a.refresh();assert.equal(r.show(event(cutoffEnd()),ordinaryAction().fn),true);await turn();clock=Date.parse('2026-10-11T17:16:00Z');r.browser.runTimer(10*60000);await turn();assert.equal(r.browser.active,true);assert.equal(r.browser.tones.length,1,'recheck cannot replay audio');clock=Date.parse('2026-10-11T17:25:00Z');r.browser.runTimer(9*60000);await turn();assert.equal(r.browser.active,false);
 }finally{p.dispatch('pagehide');await p.settle();}
 clock=Date.parse('2026-10-11T17:15:00Z');const {authority:b,disk:other}=make(()=>clock),micro=renderer(b,{native:true}),page=mountActualPage(micro,b,other,()=>clock);
 try{await page.load();await b.refresh();assert.equal(micro.show(event(cutoffEnd({valid_until:'2026-10-11T17:25:00.000001Z'})),ordinaryAction().fn),true);await turn();clock=Date.parse('2026-10-11T17:25:00.000Z');micro.browser.runTimer(600001);assert.equal(micro.browser.active,true,'submillisecond original cutoff is not truncated into early revocation');clock+=1;micro.browser.runTimer(1);assert.equal(micro.browser.active,false);
 }finally{page.dispatch('pagehide');await page.settle();}
});
await check('CUTOFF lunch wake/currentness recheck stops original expired/unknown episode before pending source reads',async()=>{
 for(const outcome of ['forward clock','missing currentness']){
  let clock=Date.parse('2026-10-11T17:15:00Z'),release;const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock),pending=new Promise(resolve=>{release=resolve;});
  try{await p.load();await a.refresh();assert.equal(r.show(event(cutoffEnd()),ordinaryAction().fn),true);await turn();r.context.refreshAcceptedLocationSessions=()=>pending;
   if(outcome==='forward clock')clock=Date.parse('2026-10-11T17:30:00Z');else delete r.context.window.MemphisMobile.isLunchNotificationCurrent;
   p.dispatch('pageshow');assert.equal(r.browser.active,false,outcome);assert.equal(r.browser.tones[0].paused,true);assert.deepEqual(r.warnings,[]);assert.equal(r.browser.httpActions.length,0);
  }finally{release(false);p.dispatch('pagehide');await p.settle();}
 }
});
await check('CUTOFF lunch deadline-race rechecks original predicate when expiry crosses during timer rearm',async()=>{
 let clock=Date.parse('2026-10-11T17:15:00Z');const {authority:a,disk}=make(()=>clock),r=renderer(a,{native:true}),p=mountActualPage(r,a,disk,()=>clock),now=r.context.Date.now,m=ordinaryAction();
 try{await p.load();await a.refresh();assert.equal(r.show(event(cutoffEnd()),m.fn),true);await turn();clock=Date.parse('2026-10-11T17:24:59.999Z');
  r.context.Date.now=()=>{clock=Date.parse('2026-10-11T17:25:00Z');return clock;};r.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();
  assert.equal(r.browser.active,false,'crossed cutoff must not merely clear timer and leave stale card');assert.equal(r.browser.tones[0].paused,true);assert.deepEqual(m.actions,[]);assert.equal(r.browser.httpActions.length,0);
 }finally{r.context.Date.now=now;p.dispatch('pagehide');await p.settle();}
});
console.log(JSON.stringify({ok:true,cases:results.length,results,remainingSourceLimits,sourceOnly:true,authSQLTransportPhonePhysical:'NOT_RUN',fixtureConstructorSHA256:sha(constructorText),providerLease:'recording intended public action seam, not native auth proof'}));
