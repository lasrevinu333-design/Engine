import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {webcrypto} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
// Actual private native bootstrap and actual normal presenter/scheduler
// factories. Employee/renderer/WORK/OS ports here are declared synthetic;
// the separately maintained full normal module fixture covers all factories.
// No synthetic port or held-data reply is a native receipt authority.
async function fixture() {
 const listeners=new Map(),posts=[];
 const context=vm.createContext({console,URL,crypto:webcrypto,document:{readyState:'complete',addEventListener(){}},
  location:{href:'https://localhost/employee-schedule.html'},addEventListener:(key,fn)=>listeners.set(key,fn),
  custodialRecurringScheduleApplication:{postMessage:raw=>posts.push(JSON.parse(raw)),addEventListener:(key,fn)=>listeners.set('port:'+key,fn)}});
 // Explicit synthetic native retirement port, never Java/Engine/receipt proof.
 context.syntheticNativeAbortCalls=0;
 context.custodialRecurringOriginalWriterAbort=Object.freeze({abort(grant,reply){
  assert.equal(grant,'a'.repeat(64));assert.equal(reply,'b'.repeat(64));context.syntheticNativeAbortCalls++;return true;
 }});
 vm.runInContext('globalThis.top=globalThis;globalThis.window=globalThis;',context);
 const modules=new Map();
 async function moduleAt(path) {
  if(modules.has(path))return modules.get(path);
  const mod=new vm.SourceTextModule(readFileSync(path,'utf8'),{context,identifier:pathToFileURL(path).href});modules.set(path,mod);
  await mod.link((spec,from)=>moduleAt(resolve(dirname(fileURLToPath(from.identifier)),spec)));return mod;
 }
 const bridge=new vm.SourceTextModule(`
 import {createNotificationPresenter} from './notification-presentation.js';
 import {createPrincipalNotificationScheduler} from './notification-schedule.js';
 export function installCustodialBridge({nativeApplicationSource:s}) {
  globalThis.saved=[];globalThis.retireCalls=0;globalThis.osCalls=0;globalThis.actionCalls=0;
  const memory=new Map(),pending=new Map(),saveTokens=new WeakMap(),presentationRows=new Map();globalThis.rawStorage=memory;globalThis.originalCurrent=true;
  const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,
    setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const scheduler=createPrincipalNotificationScheduler({nativeApplicationSource:s,requireNativeOwner:false,
   identity:()=> 'explicit-synthetic-owner',storage,prefix:'mz_native_notification_outbox:schedule:',mutate:async work=>work(),
   plugin:{getPending:async()=>({notifications:[...pending.values()]}),getDeliveredNotifications:async()=>({notifications:[]}),
    cancel:async({notifications})=>{for(const n of notifications)pending.delete(n.id);},removeDeliveredNotifications:async()=>{},
    schedule:async({notifications})=>{osCalls++;for(const n of notifications)pending.set(n.id,n);
      if(globalThis.deferOS)await new Promise(yes=>{globalThis.releaseOS=yes;});}}});
  const presenter=createNotificationPresenter({nativeApplicationSource:s,requireNativeOwner:false,
    readSavedNativeData:(scope,key)=>presentationRows.get(JSON.stringify([scope,key]))??null,returnedSaveNativeData:entry=>saveTokens.get(entry)??null,
    identity:()=> 'explicit-synthetic-owner',nativeMode:()=>false,nativePresent:async()=>false,
    isCurrent:()=>originalCurrent,load:async()=>[],save:async entry=>{entry.queueOrdinal||=1;
      if(globalThis.deferSave)await new Promise(yes=>{globalThis.releaseSave=yes;});saved.push(JSON.parse(JSON.stringify(entry)));const raw=JSON.stringify(entry);presentationRows.set(JSON.stringify([entry.scope,entry.key]),raw);saveTokens.set(entry,raw);},
    displayed:async()=>true,action:async()=>{actionCalls++;return true;}});
  const present=(_event,action)=>{globalThis.boundAction=action;action.onRetire(()=>{retireCalls++;return true;});return true;};
  s.bindNotificationOwners({presenter,scheduler,security:{},principal:()=> 'explicit-synthetic-owner'});
  s.bindEmployeeOwner({current:()=>null,snapshot:()=>null,observeNativeSourceData:()=>({schema:'custodial.native-employee-raw-data.v1',receipt_eligible:false,original_typed_render:{principal_identity:'explicit-synthetic-owner',service_date:'2026-10-21',original_source:{recurring_delivery:{intentId:'11111111-1111-4111-8111-111111111111',targetDigest:'a'.repeat(64)}}}})});
  s.bindReminderOwner({present,provider:{show:present,stopAndReadback(){}},snapshot:()=>({schema:'custodial.native-browser-reminder-state-data.v1',receipt_eligible:false}),ordinarySnapshot:selector=>({schema:'custodial.native-reminder-ordinary-target-data.v1',receipt_eligible:false,selector})});
  globalThis.presenter=presenter;globalThis.scheduler=scheduler;globalThis.presentationRows=presentationRows;
 }`,{context,identifier:pathToFileURL(resolve(root,'mobile/src/custodial/explicit-test-owner-ports.js')).href});
 await bridge.link((spec,from)=>moduleAt(resolve(dirname(fileURLToPath(from.identifier)),spec)));await bridge.evaluate();
 const source=resolve(root,'mobile/src/custodial/native-recurring-application.js');
 const entry=new vm.SourceTextModule(readFileSync(source,'utf8'),{context,identifier:pathToFileURL(source).href,
  importModuleDynamically:async spec=>{assert.equal(spec,'./bridge.js');return bridge;}});
 await entry.link(()=>{});await entry.evaluate();
 entry.namespace.installNativeRecurringApplication({grantToken:'a'.repeat(64),replyToken:'b'.repeat(64)});await turn();await turn();
 let phase=1;
 return {context,posts,command(command,holdPhase){const nonce=(phase++).toString(16).padStart(64,'0'),before=posts.length;
   listeners.get('port:message')({data:JSON.stringify({schema:'custodial.native-recurring-document-command.v1',command,
     grant_token:'a'.repeat(64),phase:nonce,...(holdPhase?{hold_phase:holdPhase}:{})})});
   return {phase:nonce,reply:posts.length===before?null:posts.at(-1)};}};
}
// The normal factories above are real; native/status/storage/plugin/employee
// and renderer ports are explicit synthetic fixtures, never native authority.
const f=await fixture(),scope='explicit-synthetic-owner',day='2026-10-21';
await f.context.presenter.accept({notification:{title:'Actual retained factory event',body:'Synthetic body',data:{kind:'employee_location_status',notification_key:'same-day-original',service_date:day}}});await turn();
await f.context.presenter.accept({notification:{title:'Unrelated messenger history',body:'Synthetic body',data:{kind:'messenger_message',notification_key:'unrelated-message'}}});await turn();
const before=f.context.saved.length;
const initial=f.command('HOLD_ORDINARY_DELIVERY_WRITERS');assert.equal(initial.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');checks++;
const presenter=initial.reply.data.presenter;check(presenter.entries.length,1,'Only genuine current principal/day schedule entry is exported');
check(presenter.unrelated.entries,1,'Unrelated non-schedule history is preserved separately');
const entry=presenter.entries[0];check(entry.opaque_fields.saving.unknown_type,'opaque_object','Settled normal saving Promise stays opaque DATA');
check(entry.opaque_fields.retireBrowser.unknown_type,'function','Retained real retirement callback stays opaque DATA');
check(entry.last_verified_save.raw,entry.current_raw,'Exact same normal returned save token matches current raw fixture row');
check(f.context.saved.length,before,'Passive typed observation performs no normal save');
check(initial.reply.receipt_eligible,false,'Same actual factory DATA is not a receipt');
const terminal=f.command('OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS',initial.phase);check(terminal.reply.data,initial.reply.data,'Initial and terminal SAME actual owner observations match');
f.command('RELEASE_CALLBACK_WRITERS',initial.phase);
const notification={title:'Real normal scheduler',body:'Synthetic original',extra:{kind:'employee_lunch_coverage',notification_key:'same-day-alarm',service_date:day}};
check(await f.context.scheduler.present(notification,scope),true,'Actual normal scheduler dispatch returns normally');await turn();
const stored=[...f.context.rawStorage.values()].find(raw=>JSON.parse(raw).schema_version==='native-notification-schedule.v1');assert(stored);checks++;
f.context.rawStorage.set('mz_native_notification_outbox:schedule:unrelated-opaque',JSON.stringify({scope:'other-principal',unavailable_original:'preserved'}));
const scheduled=f.command('HOLD_ORDINARY_DELIVERY_WRITERS');assert.equal(scheduled.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');checks++;
check(scheduled.reply.data.scheduler.raw.length,1,'Known unrelated opaque history does not require global empty raw schedule');
check(scheduled.reply.data.scheduler.unrelated.rows,1,'Unrelated raw row is explicitly accounted for');
check(scheduled.reply.data.scheduler.last_verified_saves[0][1],stored,'Actual normal readback bytes remain tied to returned schedule save');
f.command('RELEASE_CALLBACK_WRITERS',scheduled.phase);
check(JSON.parse(f.context.rawStorage.get('mz_native_notification_outbox:schedule:unrelated-opaque')).unavailable_original,'preserved','No reconciliation/cancellation/retiming erases unrelated original');
// Known-ID ambiguity must never classify a relevant UNKNOWN guard away.
const originalSchedule=JSON.parse(stored),id=originalSchedule.id,prefix='mz_native_notification_outbox:schedule:';
f.context.rawStorage.set(prefix+'malformed-alias',JSON.stringify({...originalSchedule,scope:'other-principal'}));
f.context.rawStorage.set(prefix+'unconfirmed:'+id,JSON.stringify({schema_version:'native-notification-schedule-guard.v1',id,scope}));
const ambiguous=f.command('HOLD_ORDINARY_DELIVERY_WRITERS');assert.equal(ambiguous.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');checks++;
check(ambiguous.reply.data.scheduler.raw.some(pair=>pair[0]===prefix+'unconfirmed:'+id),true,'Duplicate malformed-key ID cannot hide same-principal UNKNOWN guard');
f.command('RELEASE_CALLBACK_WRITERS',ambiguous.phase);
// Fresh actual owner isolates new original execution from the preserved
// relevant malformed/UNKNOWN rows above. No guard is cleared or reset.
const originalWork=await fixture();
const ownHold=originalWork.command('HOLD_ORDINARY_DELIVERY_WRITERS');assert.equal(ownHold.reply?.schema,'custodial.native-recurring-ordinary-held-data.v1');checks++;
const originalNotification={title:'Exact new original',body:'Exact body',extra:{kind:'employee_lunch_coverage',notification_key:'new-ordinary-original',service_date:day}};
check(await originalWork.context.scheduler.present(originalNotification,scope),true,'New scheduler original returns actual success after evidence retirement');
check(originalWork.context.osCalls,1,'Exactly one actual normal scheduler dispatch with synthetic SDK');
check(originalWork.context.syntheticNativeAbortCalls,1,'One native denial port call');
check(originalWork.command('OBSERVE_ORDINARY_HELD_CALLBACK_WRITERS',ownHold.phase).reply,null,'Original ordinary evidence cannot revive after writer abort');
// Exact actual renderer continuation function, with explicitly synthetic
// state/DOM/bridge ports. Stop at the real active-object assignment boundary:
// this checks origin identity transfer, not completed display/audio or native
// ownership. No Source constructor/private authority is substituted.
const reminderSource=readFileSync(resolve(root,'mobile/src/custodial/device-reminders-runtime.js'),'utf8');
const rendererStart=reminderSource.indexOf('  function showAlert(alert, owned = false) {');
const rendererEnd=reminderSource.indexOf('  function showAcceptedNotification(',rendererStart);
assert(rendererStart>=0&&rendererEnd>rendererStart);const actualShow=reminderSource.slice(rendererStart,rendererEnd).trim();
for(const withOrigin of [true,false]){
 const originalAlert={id:'synthetic-poll-original',notificationKey:'synthetic-poll-original',linkedIds:[]};
 const origins=new WeakMap(),origin=Object.freeze({producer:'EXPLICIT_SYNTHETIC_ORIGIN_DATA_ONLY'}),stop=Object.freeze({stage:'ACTUAL_ACTIVE_ASSIGNMENT'});
 if(withOrigin)origins.set(originalAlert,origin);
 let assigned=null,bridgeCalls=0;const release=()=>{};
 const state={detached:false,activeSequencePromise:null,activeSpeechPromise:null,deviceId:'KIOSK_08'};
 Object.defineProperty(state,'activeAlert',{get:()=>null,set:value=>{assigned=value;throw stop;}});
 const show=vm.runInNewContext('('+actualShow+')',{state,ordinaryAlertOrigins:origins,nativeApplicationSource:{},
  document:{hidden:false,querySelector:()=>null},window:{MemphisMobile:{nativeNotifications:false,presentBrowserNotification(_key,callback){bridgeCalls++;return callback(release);}}},
  alertCurrent:()=>true,hasSeenId:()=>false,captureReminderWriterAuthority:()=>({current:()=>true}),sessionStorage:{getItem:()=>null},CONFIG:{ALERT_LOCK_KEY:'synthetic'}});
 assert.throws(()=>show(originalAlert),error=>error===stop);checks++;
 check(bridgeCalls,1,'Actual browser fallback continuation runs once');
 assert.notStrictEqual(assigned,originalAlert);checks++;
 assert.strictEqual(assigned.releasePresentation,release);checks++;
 assert.strictEqual(origins.get(assigned),withOrigin?origin:undefined,'Only existing exact weak origin reaches actual normal clone');checks++;
}
console.log(JSON.stringify({status:'PASS_ACTUAL_NORMAL_ORDINARY_OWNER_DATA_ONLY',checks,receipt:false,native_holder:false,OS_settlement:false,
 scope:'Actual private Source and actual presenter/scheduler factories; explicit synthetic status/storage/employee/renderer/vendor ports. Separate full-normal graph fixture covers real module births.'}));
