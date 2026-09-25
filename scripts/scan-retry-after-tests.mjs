import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Actual worker/parser/settlement/scheduler; synthetic clock, queue and timers.
// No browser, production service, native process or real IndexedDB is used.
const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const slice=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const clock=Date.parse('2026-09-24T12:00:00.000Z');
let checks=0;const failures=[];
const check=(actual,expected,label)=>{checks++;try{assert.deepEqual(actual,expected,label);}catch(error){failures.push({label,actual,expected});}};
function fixture(){
  let time=clock,claimed=false,saved=null,applied=0,deleted=0;
  const row={id:7,type:'commit_workflow',payload:{p_answers:{work_result:'check_only',services_performed:[]}},
    operation_id:'same-operation',semantic_fingerprint:'same-binding',security_generation:4,
    lease_owner:'worker',lease_token:'lease',retry_count:49,dead_letter:false,state:'processing'};
  const timers=new Map();let timerId=0;const schedules=[];
  const context=vm.createContext({navigator:{onLine:true},
    CONFIG:{STORE_NAME:'actions',MAX_RETRIES:50,POLL_MS:30000},Date,Math:Object.assign(Object.create(Math),{random:()=>0}),
    now:()=>time,safeText:value=>String(value??'').trim(),
    state:{workerId:'worker',deviceId:'device',startupRecoveryPending:false,db:{transaction(){
      const tx={},request={result:row};tx.objectStore=()=>({get:()=>request,put:value=>{saved=structuredClone(value);},delete:()=>{deleted++;}});
      queueMicrotask(()=>{request.onsuccess();tx.oncomplete();});return tx;
    }}},
    window:{setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay,due:time+delay});schedules.push(delay);return id;},clearTimeout:id=>timers.delete(id)},
    observeSync:promise=>promise,sync:async()=>{},securityPause:async()=>null,custodialSecurity:()=>null,
    securityErrorIsPause:()=>false,dispatchSecurityPause(){},dispatchStatus(){},
    recoverOrphanedClaims:async()=>{},verifyWorkerBackendCompatibility:async()=>true,
    claimNextAction:async()=>{if(claimed)return null;claimed=true;return row;},
    processAction:async()=>{throw Object.assign(new Error('temporary'),{httpStatus:503,retryAfter:'120'});},
    mutateProtectedQueue:async(fn,options)=>{check(options.expectedGeneration,4,'security generation preserved');return fn();},
    storageRecord:value=>value,isTerminalReconciliation:()=>false,applyProcessResult:()=>{applied++;},
    listActions:async()=>saved?[saved]:[],hasUnresolvedReconciliationWork:()=>false,reportDeviceSyncStatus:async()=>{},
  });
  vm.runInContext(slice('  function scheduleSync(','  function releaseStartupRecoveryGate(')+
    slice('  function actionCanRun(','  function nextRecoveryAction(')+
    slice('  function finishClaim(','  function latestQueueError(')+
    slice('  async function runWorker(','  async function reconcileStartupRecovery('),context);
  return {context,row,timers,schedules,get saved(){return saved;},get deleted(){return deleted;},
    get applied(){return applied;},setTime:value=>{time=value;}};
}

for(const status of [408,429,500,502,503,504,599]){
  const f=fixture();f.context.processAction=async()=>{throw Object.assign(new Error('temporary'),{httpStatus:status,retryAfter:'1800'});};
  await f.context.runWorker();
  check(f.saved.next_attempt_at,clock+1800000,'actual worker honors server not-before for HTTP '+status);
  check(f.saved.dead_letter,false,'outage remains automatic for HTTP '+status);
  check(f.saved.operation_id,f.row.operation_id,'same operation');check(f.saved.payload,f.row.payload,'same answers');
  check(f.deleted,0,'no saved work deletion');
}
for(const status of [408,429,503]){
  const f=fixture();f.row.retry_count=0;
  f.context.processAction=async()=>{throw Object.assign(new Error('temporary'),{httpStatus:status,retryAfter:'120'});};
  await f.context.runWorker();check(f.saved.next_attempt_at,clock+120000,'exact auditor worker reproduction '+status);
}
const invalid=['','-1','-120','1.5','1e3','+1','Infinity','NaN','1,23','12 seconds','2026-09-25','9'.repeat(400),String(Number.MAX_SAFE_INTEGER),'8640000000000'];
for(const value of invalid){
  const f=fixture(),delay=f.context.parseRetryAfter(value);
  check(delay,0,'invalid/out-of-range header rejected: '+value.slice(0,30));
  await f.context.finishClaim(f.row,{succeeded:false,automaticRetry:true,retryAfterMs:delay});
  check(f.saved.next_attempt_at,clock+900000,'invalid header uses finite backoff');
  check(f.saved.dead_letter,false,'invalid header does not hold work');
}
for(const value of [Infinity,-Infinity,NaN,-1,Number.MAX_SAFE_INTEGER]){
  const f=fixture();await f.context.finishClaim(f.row,{succeeded:false,automaticRetry:true,retryAfterMs:value});
  check(f.saved.next_attempt_at,clock+900000,'settlement independently rejects invalid interval '+value);
}
const future=clock+120000;
for(const value of ['120',' 000120 ',new Date(future).toUTCString(),'Thursday, 24-Sep-26 12:02:00 GMT','Thu Sep 24 12:02:00 2026']){
  const f=fixture();check(f.context.parseRetryAfter(value),120000,'valid seconds/HTTP-date '+value);
}
check(fixture().context.parseRetryAfter('0'),0,'zero retained');
check(fixture().context.parseRetryAfter(new Date(clock-1000).toUTCString()),0,'past HTTP-date does not delay');
// Independent review R1-02A: exercise calendar semantics, not just wire shape.
for(const value of ['Wed, 31 Feb 2027 12:00:00 GMT','Fri, 24 Sep 2026 12:02:00 GMT',
  'Thu, 24 Sep 2026 12:02:61 GMT','Thu, 24 Sep 2026 24:00:00 GMT',
  'Thu, 24 Sep 2026 12:60:00 GMT','Thu Sep 31 12:02:00 2026',
  'Thursday, 00-Sep-26 12:02:00 GMT']) {
  check(fixture().context.parseRetryAfter(value),0,'semantically invalid HTTP-date: '+value);
}
check(fixture().context.parseRetryAfter('Tuesday, 24-Sep-75 12:02:00 GMT'),
  Date.UTC(2075,8,24,12,2)-clock,'RFC850 future year inside 50-year window');
for(const value of ['Thu, 31 Dec 2026 23:59:60 GMT','Thursday, 31-Dec-26 23:59:60 GMT','Thu Dec 31 23:59:60 2026']) {
  check(fixture().context.parseRetryAfter(value),Date.UTC(2027,0,1)-clock,'leap second maps to next UTC second: '+value);
}
for(const at of [Date.UTC(2026,8,24,12),Date.UTC(2090,8,24,12)]) {
  const f=fixture();f.setTime(at);
  const fifty=new Date(at);fifty.setUTCFullYear(fifty.getUTCFullYear()+50);
  const wire=date=>date.toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'})+', '+
    date.toUTCString().slice(5,11).replace(' ','-')+'-'+String(date.getUTCFullYear()).slice(-2)+' '+date.toUTCString().slice(17);
  check(f.context.parseRetryAfter(wire(fifty)),fifty.getTime()-at,'exact 50-year timestamp remains future');
  const priorCentury=new Date(fifty.getTime()+1000);priorCentury.setUTCFullYear(priorCentury.getUTCFullYear()-100);
  check(f.context.parseRetryAfter(wire(priorCentury)),0,'more than 50 years maps to matching past year');
  const invalidWeekday=wire(new Date(fifty.getTime()+1000));
  check(f.context.parseRetryAfter(invalidWeekday),0,'weekday must match interpreted past century');
}
for(const seconds of [2147484,4000000,Math.floor((8640000000000000-clock)/1000)]){
  const f=fixture();const interval=seconds*1000;
  f.context.processAction=async()=>{throw Object.assign(new Error('temporary'),{httpStatus:503,retryAfter:String(seconds)});};
  await f.context.runWorker();
  check(f.saved.next_attempt_at,clock+interval,'long finite server not-before retained');
  check(Number.isSafeInteger(f.saved.next_attempt_at),true,'persisted eligibility is a finite exact integer');
  check(f.schedules.length,1,'one timer scheduled');
  check(f.schedules[0],2147483647,'long delay uses timer-safe chunk');
  check(f.context.actionCanRun(f.saved,clock+interval-1),false,'not eligible before server deadline');
  check(f.context.actionCanRun(f.saved,clock+interval),true,'eligible at server deadline');
  f.saved.lease_until=clock+interval+1;check(f.context.actionCanRun(f.saved,clock+interval),false,'live lease still prevents action');
  const next=[...f.timers.values()][0];f.timers.clear();f.setTime(next.due);next.fn();
  await f.context.runWorker();
  check(f.timers.size,1,'chunk wake re-arms one next timer');
  check([...f.timers.values()][0].delay,Math.max(50,Math.min(2147483647,interval-2147483647)),'chunk wake recomputes remaining deadline');
}
{
  const f=fixture();const first=f.context.scheduleSync(4000000000);
  for(let index=0;index<20;index++)f.context.scheduleSync(4000000000);
  check(f.timers.size,1,'periodic worker does not accumulate distant timers');
  check(f.context.scheduleSync(4000000000),first,'reuse earliest timer');
  f.context.scheduleSync(50);check(f.timers.size,1,'earlier online work replaces distant timer');
  const entry=[...f.timers.values()][0];check(entry.delay,50,'new immediate work not postponed');
  f.timers.clear();entry.fn();check(f.context.state.scheduledSyncTimer,null,'timer ownership released on firing');
  f.context.state.startupRecoveryPending=true;check(f.context.scheduleSync(0),null,'startup recovery gate remains closed');
  check(f.timers.size,0,'no timer while startup gated');
}
{
  const f=fixture();f.context.mutateProtectedQueue=async()=>{throw Object.assign(new Error('generation changed'),{code:'custodial_security_generation_changed'});};
  await assert.rejects(f.context.finishClaim(f.row,{succeeded:false,automaticRetry:true,retryAfterMs:120000}),{code:'custodial_security_generation_changed'});checks++;
  check(f.saved,null,'changed generation cannot rewrite retry deadline');check(f.deleted,0,'changed generation retains saved work');
}
console.log(JSON.stringify({status:failures.length?'FAIL_SCAN_RETRY_AFTER':'PASS_SCAN_RETRY_AFTER',checks,failures,
  limits:'actual worker/parser/settlement/scheduler with synthetic queue and timers; not runtime or physical acceptance'},null,2));
if(failures.length)process.exitCode=1;
