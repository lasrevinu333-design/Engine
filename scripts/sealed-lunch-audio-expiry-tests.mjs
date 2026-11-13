import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createSyntheticScheduleSecurity} from './synthetic-schedule-security.mjs';
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
function make(now=()=>time){const disk=storage(),security=createSyntheticScheduleSecurity(principal);let binding=scope;const authority=createScheduleNotificationAuthority({identity:()=>binding,principal:()=>principal,status:()=>security.getStatus(),storage:disk,mutate:security.mutateProtectedWork,now});return {authority,disk,security,setBinding:s=>binding=s};}
const fixtureSource=readFileSync(new URL('./native-notification-arrival-boundary-tests.mjs',import.meta.url),'utf8');
const constructorText=fixtureSource.slice(fixtureSource.indexOf('function fullBrowserFixture('),fixtureSource.indexOf('async function fixture(')).trim();
const runtime=process.argv.includes('--legacy')?'../memphis-device-reminders.js':'../mobile/src/custodial/device-reminders-runtime.js';
let reminderSource=readFileSync(new URL(runtime,import.meta.url),'utf8');
if(!process.argv.includes('--legacy'))reminderSource=reminderSource.replace('export function installDeviceReminders(options) {','(function installDeviceReminders(options) {')+'\n)({});';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const fullBrowserFixture=vm.runInNewContext('('+constructorText+')',{vm,reminderSource,assert,turn,deviceId,Buffer,queueMicrotask,URL,Uint8Array,DataView,Float32Array});
const loan='c'.repeat(64),responsibility=()=>({coverage_purpose:'lunch_coverage',loan_id:loan,service_date:day,projection_id:projectionId,coverer_person_id:id(1),normal_owner_person_id:id(99),coverage_start:'11:30:00',coverage_end:'12:15:00',name:'Synthetic location'});
const lunchData=()=>({...data('d'.repeat(64)),kind:'employee_lunch_coverage',loan_id:loan,document_identity:'a'.repeat(64),event:'start',scheduled_time:'11:30',scheduled_at:'2026-10-11T16:30:00.000000Z',valid_until:'2026-10-11T17:00:30.000000Z',schedule_authority_revision:10});
async function setup(){let clock=Date.parse('2026-10-11T17:00:29.999Z');const f=make(()=>clock),a=f.authority;assert.equal(await a.observe(schedule(10,[responsibility()])),true);
 class ClockDate extends Date{static now(){return clock;}}
 const actions=[],saves=[];let show;
 const presenter=createNotificationPresenter({identity:()=>scope,nativeMode:()=>false,nativePresent:async()=>false,save:async row=>saves.push(structuredClone(row)),load:async()=>[],displayed:async()=>true,action:async(e,kind)=>{actions.push(kind);return true;},isCurrent:(e,s)=>a.isCurrent(e.notification.data,s)});
 const context=vm.createContext({console:{warn(){},log(){},error(){}},security:f.security,document:{addEventListener(){},hidden:false},window:{addEventListener(){},MemphisMobile:{releaseCapabilities:{messenger:false},nativeNotifications:false,principalIdentity:()=>scope,registerNotificationFallback:fn=>{show=fn;presenter.registerBrowser(fn);},retryNotificationPresentation:()=>presenter.retry(),presentBrowserNotification:(k,fn)=>presenter.presentBrowser(k,fn),isLunchNotificationCurrent:(d,s)=>a.isCurrent(d,s),beginLunchNotificationAudio:(d,s)=>a.beginLunchAudio?.(d,s)}},localStorage:storage(),Date:ClockDate,JSON,Number,Math,Promise});
 const browser=fullBrowserFixture(context,{manualAudio:true,browserSpeech:true,observedAudio:true});await browser.ready;
 return {...f,a,browser,context,presenter,actions,saves,clock:()=>clock,setClock:x=>clock=x,show:(...args)=>show(...args)};
}
const results=[];async function check(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(error){results.push({name,status:'FAIL',error:error.stack});}}
async function expire(f){f.setClock(Date.parse(lunchData().valid_until));f.browser.runTimer(1);await turn();await f.presenter.retry();await turn();assert.equal(f.browser.active,false);assert.equal(f.a.isCurrent(lunchData(),scope),false);assert.ok(f.browser.state.activeAudioAlert,'original audio remains owned at payload expiry');}
async function tone(f,i){f.browser.tones[i].onended();await turn();f.browser.runTimer(900);await turn();}
async function speech(f,i){f.browser.utterances[i].onend();await turn();}
for(const stage of ['first tone','first speech','cycle gap','second speech'])await check('original two-cycle audio survives expiry at '+stage,async()=>{const f=await setup();assert.equal(await f.presenter.accept(event(lunchData())),true);await turn();const old=f.browser.card;
 if(stage==='first tone')await expire(f);await tone(f,0);
 if(stage==='first speech')await expire(f);await speech(f,0);
 if(stage==='cycle gap')await expire(f);f.browser.runTimer(1200);await turn();await tone(f,1);
 if(stage==='second speech')await expire(f);await speech(f,1);await turn();
 assert.equal(f.browser.utterances.length,2);assert.equal(f.browser.utterances[0].text,f.browser.utterances[1].text);assert.equal(f.browser.tones.length,2);assert.equal(f.browser.state.activeAudioAlert,null);
 await old.querySelector('.mz-reminder-open').click();await old.querySelector('.mz-reminder-dismiss').click();assert.deepEqual(f.actions,[]);assert.equal(await f.presenter.accept(event(lunchData())),false);assert.equal(f.browser.tones.length,2);
});
await check('expired initial payload cannot play',async()=>{const f=await setup();f.setClock(Date.parse(lunchData().valid_until));assert.equal(await f.presenter.accept(event(lunchData())),false);assert.equal(f.browser.tones.length,0);assert.equal(f.a.beginLunchAudio?.(lunchData(),scope)??null,null);});
for(const change of ['principal','credential','generation','coverage'])await check('changed '+change+' stops original audio after expiry',async()=>{const f=await setup();assert.equal(await f.presenter.accept(event(lunchData())),true);await turn();await expire(f);assert.equal(f.browser.tones[0].paused,false);
 if(change==='principal')f.setBinding('changed');else if(change==='credential'){const before=f.security.getStatus();f.security.getStatus=()=>({...before,principal:{...principal,credential_id:id(90)}});}else if(change==='generation'){const before=f.security.getStatus();f.security.getStatus=()=>({...before,generation:2});}else await f.a.observe(schedule(11,[]));
 f.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(f.browser.tones[0].paused,true);assert.equal(f.browser.state.activeAudioAlert,null);
});
await check('continuation retains original payload and cannot renew after retirement',async()=>{const f=await setup(),d=lunchData(),grant=f.a.beginLunchAudio?.(d,scope);assert.ok(grant);d.receipt_employee_id=id(900);f.setClock(Date.parse(lunchData().valid_until));assert.equal(grant.isCurrent(),true);assert.equal(f.a.beginLunchAudio(lunchData(),scope),null);grant.retire();assert.equal(grant.isCurrent(),false);});
await check('actual accepted coverage end still stops ongoing audio',async()=>{const f=await setup();assert.equal(await f.presenter.accept(event(lunchData())),true);await turn();await expire(f);f.setClock(Date.parse('2026-10-11T17:15:00.000Z'));f.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(f.browser.tones[0].paused,true);assert.equal(f.browser.state.activeAudioAlert,null);});
await check('provider mirror keeps its own currentness and audio claim',async()=>{const f=await setup();let begun=0,finished=0;const action=async()=>true;Object.assign(action,{providerMirror:true,isCurrent:()=>true,playAudio:true,beginAudio:async()=>{begun++;return true;},finishAudio:async()=>{finished++;return true;},presentationState:()=>({freshness:'CURRENT'}),onRetire(){},onOpen(){},onState(){},retire(){},recheck:async()=>true});
 f.context.window.MemphisMobile.beginLunchNotificationAudio=()=>{assert.fail('provider cannot use ordinary continuation');};
 assert.equal(f.show(event(lunchData()),action),true);await turn();f.setClock(Date.parse(lunchData().valid_until));f.context.window.MemphisDeviceReminders.reconcileScheduleAuthority();assert.equal(f.browser.tones[0].paused,false);
 await tone(f,0);await speech(f,0);f.browser.runTimer(1200);await turn();await tone(f,1);await speech(f,1);assert.equal(begun,1);assert.equal(finished,1);assert.equal(f.browser.utterances.length,2);
});
console.log(JSON.stringify({owner:runtime,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,results},null,2));if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
