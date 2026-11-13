import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../mobile/src/custodial/native-recurring-application.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
// Actual private native document-start implementation. Owner callbacks below
// are EXPLICIT synthetic ports, not the separate normal four-factory proof,
// native token, OS settlement, WORK writer exclusion or receipt authority.
async function fixture({deferReminder=false,observeFailure=false}={}) {
  const listeners=new Map(),posts=[];
  const context=vm.createContext({console,URL,deferReminder,observeFailure,document:{readyState:'complete',addEventListener(){}},
    location:{href:'https://localhost/employee-schedule.html'},addEventListener:(key,fn)=>listeners.set(key,fn),
    custodialRecurringScheduleApplication:{postMessage:raw=>posts.push(JSON.parse(raw)),
      addEventListener:(key,fn)=>listeners.set('port:'+key,fn)}});
 // Explicit synthetic native retirement port, never Java/Engine/receipt proof.
 context.syntheticNativeAbortCalls=0;
 context.custodialRecurringOriginalWriterAbort=Object.freeze({abort(grant,reply){
  assert.equal(grant,'a'.repeat(64));assert.equal(reply,'b'.repeat(64));context.syntheticNativeAbortCalls++;return true;
 }});
  vm.runInContext('globalThis.top=globalThis;globalThis.window=globalThis;globalThis.calls=0;',context);
  const bridge=new vm.SourceTextModule(`export function installCustodialBridge({nativeApplicationSource:s}) {
    const present=()=>{};
    s.bindNotificationOwners({presenter:{registerBrowser(){},observeNativeSourceData:()=>({schema:'custodial.native-presenter-raw-data.v1',receipt_eligible:false})},
      scheduler:{observeNativeSourceData:()=>({schema:'custodial.native-scheduler-raw-data.v1',receipt_eligible:false})},security:{},principal:()=>''});
    s.bindEmployeeOwner({current:()=>null,snapshot:()=>null,observeNativeSourceData:()=>({schema:'custodial.native-employee-raw-data.v1',receipt_eligible:false})});
    const bindReminder=()=>s.bindReminderOwner({present,provider:{show:present,stopAndReadback(){}},snapshot:()=>{
      if(globalThis.observeFailure)throw Error('explicit synthetic observation failure');
      return {schema:'custodial.native-browser-reminder-state-data.v1',receipt_eligible:false};}});
    globalThis.bindActualReminder=bindReminder;if(!globalThis.deferReminder)bindReminder();
    globalThis.syncWriter=s.wrapNativeWriter(function(value){calls++;return value;});
    globalThis.originalPromise=new Promise((yes,no)=>{globalThis.resolveOriginal=yes;globalThis.rejectOriginal=no;});
    globalThis.asyncWriter=s.wrapNativeWriter(function(){calls++;return originalPromise;},true);
    globalThis.originalError=Error('explicit synthetic original failure');
    globalThis.throwWriter=s.wrapNativeWriter(function(){calls++;throw originalError;});
    globalThis.unknownResult={then(){globalThis.thenCalls++;}};globalThis.thenCalls=0;
    globalThis.thenableWriter=s.wrapNativeWriter(()=>unknownResult,true);
  }`,{context,identifier:'explicit-synthetic-callback-owner-ports'});
  await bridge.link(()=>{});await bridge.evaluate();
  const entry=new vm.SourceTextModule(script,{context,identifier:'actual-private-native-source',
    importModuleDynamically:async spec=>{assert.equal(spec,'./bridge.js');return bridge;}});
  await entry.link(()=>{});await entry.evaluate();
  entry.namespace.installNativeRecurringApplication({grantToken:'a'.repeat(64),replyToken:'b'.repeat(64)});
  await turn();await turn();
  let phase=1;
  return {context,posts,retire:()=>listeners.get('pagehide')(),
    command(command,holdPhase){const nonce=(phase++).toString(16).padStart(64,'0'),before=posts.length;
      listeners.get('port:message')({data:JSON.stringify({schema:'custodial.native-recurring-document-command.v1',
        grant_token:'a'.repeat(64),phase:nonce,command,...(holdPhase?{hold_phase:holdPhase}:{})})});
      return {phase:nonce,reply:posts.length===before?null:posts.at(-1)};}};
}
{
 const f=await fixture();
 check(f.context.syncWriter(17),17,'Actual sync return is unchanged');
 const held=f.command('HOLD_CALLBACK_WRITERS');
 check(held.reply?.schema,'custodial.native-recurring-callback-held-data.v1','Private Source acquires only idle callback hold');
 check(held.reply.receipt_eligible,false,'Held DATA is never a receipt/effect/currentness grant');
 const before=f.context.calls;
 check(f.context.syncWriter(18),18,'Held sync original keeps its return after native denial barrier');
 check(f.context.calls,before+1,'Held new sync original executes exactly once');
 check(f.context.syntheticNativeAbortCalls,1,'One private native abort');
 check(f.command('OBSERVE_HELD_CALLBACK_WRITERS',held.phase).reply,null,'Retired original hold cannot produce DATA');
 f.command('RELEASE_CALLBACK_WRITERS','f'.repeat(64));
 check(f.context.syncWriter(19),19,'Later genuine ordinary original is not replayed');
 f.command('RELEASE_CALLBACK_WRITERS',held.phase);
 check(f.context.calls,before+2,'Release creates no synthetic replay');
 check(f.context.syncWriter(20),20,'A new ordinary call remains normal');
 check(f.command('HOLD_CALLBACK_WRITERS').reply,null,'Retired Source never revives from old failure history');
}
{
 const f=await fixture(),original=f.context.originalPromise,pending=f.context.asyncWriter();
 assert.strictEqual(pending,original,'Observer must return exact original Promise');checks++;
 check(f.command('HOLD_CALLBACK_WRITERS').reply?.kind,'WRITERS_ACTIVE','Unresolved original async attempt has fixed negative terminal');
 f.context.resolveOriginal(21);check(await pending,21,'Actual original completion is unchanged');await turn();
 const held=f.command('HOLD_CALLBACK_WRITERS');assert(held.reply);checks++;
 const before=f.context.calls,exact=f.context.asyncWriter();
 assert.strictEqual(exact,original,'Held original returns exact already-settled Promise');checks++;
 check(await exact,21,'Held original resolved value preserved');
 check(f.context.calls,before+1,'New async original starts exactly one body');
 check(f.context.syntheticNativeAbortCalls,1,'Async new original denies old evidence once');
 check(f.command('OBSERVE_HELD_CALLBACK_WRITERS',held.phase).reply,null,'Old async hold permanently retired');
 f.command('RELEASE_CALLBACK_WRITERS',held.phase);
}
{
 const f=await fixture(),pending=f.context.asyncWriter();f.context.rejectOriginal(f.context.originalError);
 await assert.rejects(pending,error=>error===f.context.originalError);checks++;await turn();
 const failed=f.command('HOLD_CALLBACK_WRITERS').reply;assert(failed);checks++;
 check(failed.failed_callback_terminals.at(-1).kind,'PROMISE_REJECTED','Observed rejection remains FAILED terminal DATA, not successful effects');
 check(failed.receipt_eligible,false,'Terminated failed callback is never an effect/currentness receipt');
}
{
 const f=await fixture();assert.throws(()=>f.context.throwWriter(),error=>error===f.context.originalError);checks++;
 const failed=f.command('HOLD_CALLBACK_WRITERS').reply;assert(failed);checks++;
 check(failed.failed_callback_terminals.at(-1).kind,'SYNC_THROW','Observed throw terminates the callback but preserves its failure classification');
 check(failed.receipt_eligible,false,'Known failed terminal does not erase external UNKNOWN');
}
{
 const f=await fixture();assert.strictEqual(f.context.thenableWriter(),f.context.unknownResult);checks++;
 check(f.context.thenCalls,0,'Unknown thenable is never assimilated or invoked');
 check(f.command('HOLD_CALLBACK_WRITERS').reply?.kind,'WRITER_UNKNOWN','Non-intrinsic async result remains UNKNOWN/active');
}
{
 const f=await fixture();vm.runInContext(`globalThis.constructorReads=0;
   Object.defineProperty(originalPromise,'constructor',{configurable:true,get(){constructorReads++;throw Error('hostile constructor');}});`,f.context);
 assert.strictEqual(f.context.asyncWriter(),f.context.originalPromise);checks++;
 check(f.context.constructorReads,0,'Completion observation never invokes changed constructor getter');
 check(f.command('HOLD_CALLBACK_WRITERS').reply?.kind,'WRITER_UNKNOWN','Constructor accessor cannot provide terminal evidence');
 vm.runInContext('delete originalPromise.constructor;resolveOriginal(true);',f.context);await f.context.originalPromise;
}
{
 const f=await fixture();vm.runInContext(`globalThis.speciesReads=0;globalThis.oldSpecies=Object.getOwnPropertyDescriptor(Promise,Symbol.species);
   Object.defineProperty(Promise,Symbol.species,{configurable:true,get(){speciesReads++;throw Error('hostile species');}});`,f.context);
 assert.strictEqual(f.context.asyncWriter(),f.context.originalPromise);checks++;
 check(f.context.speciesReads,0,'Completion observation never invokes changed Symbol.species getter');
 check(f.command('HOLD_CALLBACK_WRITERS').reply?.kind,'WRITER_UNKNOWN','Changed species cannot provide terminal evidence');
 vm.runInContext('Object.defineProperty(Promise,Symbol.species,oldSpecies);resolveOriginal(true);',f.context);await f.context.originalPromise;
}
{
 const f=await fixture();f.context.top={};
 check(f.context.syncWriter(22),22,'Source mismatch retires observations and still runs ordinary app body');
 check(f.command('HOLD_CALLBACK_WRITERS').reply,null,'Mismatched Source never revives into a hold');
}
{
 const f=await fixture(),held=f.command('HOLD_CALLBACK_WRITERS');assert(held.reply);checks++;
 f.retire();check(f.context.syncWriter(23),23,'Retired Source delegates ordinary writer without suppression');
 check(f.command('OBSERVE_HELD_CALLBACK_WRITERS',held.phase).reply,null,'Retirement permanently destroys old hold');
}
{
 const f=await fixture();
 const first=f.command('OBSERVE_CALLBACK_WRITERS').reply;
 check(first.schema,'custodial.native-recurring-writer-state-data.v1','Passive actual private writer state has finite schema');
 check([first.active_writer_count,first.writer_unknown,first.hold_active,first.snapshot_owners_ready],[0,false,false,true],'Actual synthetic ports are quiescent and complete');
 check(first.receipt_eligible,false,'Passive state is never authority');
 const pending=f.context.asyncWriter();
 check(f.command('OBSERVE_CALLBACK_WRITERS').reply.active_writer_count,1,'Actual pending writer remains active');
 const busy=f.command('HOLD_CALLBACK_WRITERS');check(busy.reply.kind,'WRITERS_ACTIVE','Busy HOLD returns a negative');
 check(busy.reply.phase,busy.phase,'Negative terminal keeps original request nonce');
 check(busy.reply.hold_phase,busy.phase,'Initial negative retains actual requested hold phase');
 check(busy.reply.receipt_eligible,false,'Negative never becomes held DATA');
 f.context.resolveOriginal(true);await pending;await turn();
 const after=f.command('OBSERVE_CALLBACK_WRITERS').reply;
 check(after.active_writer_count,0,'Actual terminal transition is observed without state reset');
 assert(after.writer_epoch>first.writer_epoch);checks++;
 const held=f.command('HOLD_CALLBACK_WRITERS');
 check(f.command('HOLD_CALLBACK_WRITERS').reply.kind,'HOLD_ALREADY_ACTIVE','Existing hold is not replaced');
 f.command('RELEASE_CALLBACK_WRITERS',held.phase);
}
{
 const f=await fixture({deferReminder:true});
 check(f.posts.filter(x=>x.schema==='custodial.native-recurring-normal-birth.v1').length,0,'Incomplete reminder/renderer cannot publish actual normal birth');
 f.context.bindActualReminder();
 check(f.posts.filter(x=>x.schema==='custodial.native-recurring-normal-birth.v1').length,1,'All actual synthetic snapshot owners trigger authentic birth');
 check(f.command('OBSERVE_CALLBACK_WRITERS').reply.snapshot_owners_ready,true,'Snapshot owner completeness is actual state');
}
{
 const f=await fixture({observeFailure:true}),request=f.command('HOLD_CALLBACK_WRITERS');
 check(request.reply.kind,'OBSERVATION_FAILED','Actual passive owner exception is distinct from active/UNKNOWN guard');
 check(request.reply.phase,request.phase,'Observation exception returns same original phase');
 assert(!JSON.stringify(request.reply).includes('explicit synthetic observation failure'));checks++;
 check(f.command('OBSERVE_CALLBACK_WRITERS').reply.hold_active,true,'Failed observation does not silently release/reset held attempt');
 f.command('RELEASE_CALLBACK_WRITERS',request.phase);
}
console.log(JSON.stringify({status:'PASS_PRIVATE_CALLBACK_HOLD_BOUNDARY_ONLY',checks,
  receipt:false,native_holder:false,WORK_exclusion:false,OS_settlement:false,
  scope:'Actual private JS Source with explicit synthetic owner ports; normal factory participation is separately qualified.'}));
