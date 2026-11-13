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
async function fixture({missingAbort=false,alreadyRetired=false}={}) {
 let abortCalls=0,nativeRetired=alreadyRetired;
 const listeners=new Map(),posts=[];
 const context=vm.createContext({console,URL,crypto:webcrypto,document:{readyState:'complete',addEventListener(){}},
  location:{href:'https://localhost/employee-schedule.html'},addEventListener:(key,fn)=>listeners.set(key,fn),
  custodialRecurringScheduleApplication:{postMessage:raw=>posts.push(JSON.parse(raw)),addEventListener:(key,fn)=>listeners.set('port:'+key,fn)}});
 if(!missingAbort)context.custodialRecurringOriginalWriterAbort=Object.freeze({abort(grant,reply){
  assert.equal(grant,'a'.repeat(64));assert.equal(reply,'b'.repeat(64));abortCalls++;nativeRetired=true;return true;
 }}); // Explicit synthetic native denial channel, NOT Java retirement proof.
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
 import {receiveNativeNotification} from './notification-receipts.js';
 export function installCustodialBridge({nativeApplicationSource:s}) {
  globalThis.saved=[];globalThis.retireCalls=0;globalThis.osCalls=0;globalThis.actionCalls=0;
  const memory=new Map(),pending=new Map();globalThis.originalCurrent=true;
  const storage={get length(){return memory.size;},key:i=>[...memory.keys()][i],getItem:k=>memory.get(k)??null,
    setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const scheduler=createPrincipalNotificationScheduler({nativeApplicationSource:s,requireNativeOwner:false,
   identity:()=> 'explicit-synthetic-owner',storage,prefix:'owned:',mutate:async work=>work(),
   plugin:{getPending:async()=>({notifications:[...pending.values()]}),getDeliveredNotifications:async()=>({notifications:[]}),
    cancel:async({notifications})=>{for(const n of notifications)pending.delete(n.id);},removeDeliveredNotifications:async()=>{},
    schedule:async({notifications})=>{osCalls++;for(const n of notifications)pending.set(n.id,n);
      if(globalThis.deferOS)await new Promise(yes=>{globalThis.releaseOS=yes;});}}});
  const presenter=createNotificationPresenter({nativeApplicationSource:s,requireNativeOwner:false,
    identity:()=> 'explicit-synthetic-owner',nativeMode:()=>false,nativePresent:async()=>false,
    isCurrent:()=>originalCurrent,load:async()=>[],save:async entry=>{entry.queueOrdinal||=1;
      if(globalThis.deferSave)await new Promise(yes=>{globalThis.releaseSave=yes;});saved.push(JSON.parse(JSON.stringify(entry)));},
    displayed:async()=>true,action:async()=>{actionCalls++;return true;}});
  const present=(_event,action)=>{globalThis.boundAction=action;action.onRetire(()=>{retireCalls++;return true;});return true;};
  s.bindNotificationOwners({presenter,scheduler,security:{},principal:()=> 'explicit-synthetic-owner'});
  s.bindEmployeeOwner({current:()=>null,snapshot:()=>null,observeNativeSourceData:()=>({schema:'custodial.native-employee-raw-data.v1',receipt_eligible:false})});
  s.bindReminderOwner({present,provider:{show:present,stopAndReadback(){}},snapshot:()=>({schema:'custodial.native-browser-reminder-state-data.v1',receipt_eligible:false})});
  globalThis.presenter=presenter;globalThis.scheduler=scheduler;globalThis.originalSink=s;globalThis.originalReceive=receiveNativeNotification;
 }`,{context,identifier:pathToFileURL(resolve(root,'mobile/src/custodial/explicit-test-owner-ports.js')).href});
 await bridge.link((spec,from)=>moduleAt(resolve(dirname(fileURLToPath(from.identifier)),spec)));await bridge.evaluate();
 const source=resolve(root,'mobile/src/custodial/native-recurring-application.js');
 const entry=new vm.SourceTextModule(readFileSync(source,'utf8'),{context,identifier:pathToFileURL(source).href,
  importModuleDynamically:async spec=>{assert.equal(spec,'./bridge.js');return bridge;}});
 await entry.link(()=>{});await entry.evaluate();
 entry.namespace.installNativeRecurringApplication({grantToken:'a'.repeat(64),replyToken:'b'.repeat(64)});await turn();await turn();
 let phase=1;
 return {context,posts,get abortCalls(){return abortCalls;},get nativeRetired(){return nativeRetired;},pagehide(){listeners.get('pagehide')();},command(command,holdPhase){const nonce=(phase++).toString(16).padStart(64,'0'),before=posts.length;
   listeners.get('port:message')({data:JSON.stringify({schema:'custodial.native-recurring-document-command.v1',command,
     grant_token:'a'.repeat(64),phase:nonce,...(holdPhase?{hold_phase:holdPhase}:{})})});
   return {phase:nonce,reply:posts.length===before?null:posts.at(-1)};}};
}
// Same actual source/presenter/scheduler/receiver modules as before. Native,
// persistence/DOM/employee/SDK ports remain explicit synthetic inputs. No JS
// fake abort can qualify actual Java, Engine/CAS, OS, or receipt settlement.
const hold=f=>{const h=f.command('HOLD_CALLBACK_WRITERS');assert(h.reply);checks++;return h;};
const assertRetired=f=>{check(f.abortCalls,1,'One authenticated synthetic native abort, no queue/replay');
 check(f.nativeRetired,true,'Native denial acknowledgement precedes original');
 check(f.command('OBSERVE_CALLBACK_WRITERS').reply,null,'Retired JS Source cannot produce late evidence');};
for(const phase of ['initial','terminal','native-already-retired']){
 const f=await fixture({alreadyRetired:phase==='native-already-retired'});const first=hold(f);
 if(phase==='terminal')assert(f.command('OBSERVE_HELD_CALLBACK_WRITERS',first.phase).reply);
 // Raw initial/terminal hold and explicit already-retired native model only.
 // No native pendingOrdinaryRelease state is claimed by this JS fixture.
 const exactEvent={notification:{title:'Exact one-shot title',body:'Exact one-shot body',data:{
  kind:'employee_lunch_coverage',notification_key:'one-shot:'+phase,receipt_job_id:'94000000-0000-4000-8000-000000000009'}}};
 const receiptOrder=[],dispatches=[],presentInvocations=[];
 await f.context.originalReceive({event:exactEvent,persist:async(data,action)=>{
   assert.equal(data,exactEvent.notification.data);receiptOrder.push(action);return true;
  },dispatch:event=>dispatches.push(event),flush:async()=>{},shouldPresent:true,present:event=>{
   presentInvocations.push(event);return f.context.presenter.accept(event);
  }});
 assertRetired(f);check(dispatches.length,1,'One actual receiver dispatch');assert.equal(dispatches[0],exactEvent);checks++;
 check(presentInvocations.length,1,'Original received event enters actual presenter once');assert.equal(presentInvocations[0],exactEvent);checks++;
 check(receiptOrder[0],'received','Original receiver still persists received BEFORE presentation');
 assert.ok(f.context.saved.length>0,'Actual presenter must save an owning row, never just receive');checks++;
 check(f.context.saved[0].event.notification.body,'Exact one-shot body','Exact presentation event survives hold');
 assert.ok(f.context.boundAction,'Actual original presentation/action registered');checks++;
 f.command('RELEASE_CALLBACK_WRITERS',first.phase);check(f.abortCalls,1,'Late release does not repeat original/abort');
}
// Retain the exact REAL presenter original-save exclusion from the old
// fixture. A generic pending Promise/Bridge flight is not a substitute.
{
 const f=await fixture();
 await f.context.presenter.accept({notification:{title:'Actual original audio claim',body:'Exact body',data:{notification_key:'original-audio-claim'}}});await turn();
 assert.ok(f.context.boundAction);checks++;
 f.context.deferSave=true;const claiming=f.context.boundAction.beginAudio();await turn();
 check(f.command('HOLD_CALLBACK_WRITERS').reply?.kind,'WRITERS_ACTIVE','Late actual beginAudio original persistence remains active after accept settled');
 check(f.abortCalls,0,'Refused HOLD cannot abort or replay an unresolved original save');
 f.context.deferSave=false;f.context.releaseSave();check(await claiming,true,'Actual durable audio claim completes normally');await turn();
 check(f.context.saved.at(-1).audioState,'claimed','Actual returned original save retains claim state');
 const held=hold(f);
 check(await f.context.boundAction.finishAudio(true),true,'Exact new finish callback runs after abort, no synthetic held rejection');
 check(f.context.saved.at(-1).audioState,'completed','Only the actual original finish callback records completion DATA');
 assertRetired(f);
}
// Retain the exact REAL scheduler/vendor unresolved-Promise exclusion.
{
 const f=await fixture();f.context.deferOS=true;
 const notification={title:'Exact original SDK-pending schedule',body:'Exact body',extra:{kind:'employee_lunch_coverage',notification_key:'original-sdk-pending'}};
 const scheduling=f.context.scheduler.present(notification,'explicit-synthetic-owner');await turn();
 check(f.context.osCalls,1,'One actual normal scheduler dispatch attempt');
 check(f.command('HOLD_CALLBACK_WRITERS').reply?.kind,'WRITERS_ACTIVE','Unresolved actual OS Promise prevents browser callback hold');
 check(f.abortCalls,0,'Refused HOLD never supplies fake original SDK settlement');
 f.context.deferOS=false;f.context.releaseOS();check(await scheduling,true,'Original actual scheduler completion preserved');await turn();
 const held=hold(f);check(held.reply.receipt_eligible,false,'Actual later idle DATA is still no settlement authority');
 f.command('RELEASE_CALLBACK_WRITERS',held.phase);check(f.context.osCalls,1,'Cleanup release cannot repeat original dispatch');
}
// Return values and exact thrown objects matter for synchronous owner APIs.
{
 const f=await fixture();hold(f);const receiver={mark:'same-this'},arg={mark:'same-arg'},result={mark:'same-result'};let entries=0;
 const operation=function(value){entries++;assert.equal(f.nativeRetired,true);assert.equal(this,receiver);assert.equal(value,arg);return result;};
 const wrapped=f.context.originalSink.wrapNativeWriter(operation,false,'PRESENTER_262');
 assert.equal(Reflect.apply(wrapped,receiver,[arg]),result);checks++;check(entries,1,'Synchronous original once');assertRetired(f);
}
{
 const f=await fixture();hold(f);const exactError={mark:'same-error'};let entries=0;
 const wrapped=f.context.originalSink.wrapNativeWriter(function(){entries++;throw exactError;},false,'REMINDER_1631');
 let caught;try{wrapped();}catch(error){caught=error;}assert.equal(caught,exactError);checks++;check(entries,1,'Throwing original once, error identity preserved');assertRetired(f);
}
// Async originals return their ACTUAL Promise, including rejection identity.
for(const reject of [false,true]){
 const f=await fixture();hold(f);const promise=vm.runInContext(reject?'Promise.reject(globalThis.originalError={exact:true})':'Promise.resolve(73)',f.context);let entries=0;
 const wrapped=f.context.originalSink.wrapNativeWriter(()=>{entries++;return promise;},true,'PRESENTER_236');
 assert.equal(wrapped(),promise);checks++;if(reject){let actual;try{await promise;}catch(error){actual=error;}assert.equal(actual,f.context.originalError);checks++;}else check(await promise,73,'Actual original Promise value');
 check(entries,1,'Async original once');assertRetired(f);
}
// Lifecycle retirement must abort BEFORE clearing the JS hold. A following
// ordinary listener still runs exactly once; no queue is dropped on close.
{
 const f=await fixture();hold(f);let entries=0;const wrapped=f.context.originalSink.wrapNativeWriter(()=>++entries,false,'REMINDER_1573');
 f.pagehide();assertRetired(f);check(wrapped(),1,'Original callback after pagehide still executes');check(f.abortCalls,1,'Already-closed local Source does not ask twice');
}
// A missing denial channel refuses evidence HOLD, but ordinary behavior stays
// original. This is not synthetic abort success or a generic ready fallback.
{
 const f=await fixture({missingAbort:true});check(f.command('HOLD_CALLBACK_WRITERS').reply?.kind,'WRITER_UNKNOWN','No HOLD without native barrier');
 let entries=0;const wrapped=f.context.originalSink.wrapNativeWriter(()=>++entries,false,'PRESENTER_262');check(wrapped(),1,'Normal original with missing evidence channel');check(f.abortCalls,0,'No fake native acknowledgement');
}
console.log(JSON.stringify({status:'PASS_ORIGINAL_ONE_SHOT_WORK_PRESERVED_SYNTHETIC_NATIVE_ABORT',checks,
 receipt:false,native_holder:false,WORK_exclusion:false,OS_settlement:false,
 scope:'Actual private JS Source and normal receiver/presenter/scheduler; explicit synthetic denial/persistence/DOM/employee/vendor ports. No actual Java/Engine/CAS/POST proof.'}));
