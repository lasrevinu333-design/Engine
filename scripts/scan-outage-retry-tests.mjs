import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute owning queue settlement with synthetic transaction/storage boundaries.
// No browser, phone, production request or claim of actual IndexedDB durability.
const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const start=source.indexOf('  function finishClaim('),end=source.indexOf('  function parseRetryAfter(',start);
assert.ok(start>=0&&end>start);
const owning=source.slice(start,end);
const clock=1780000000000;
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
async function settle({count=49,automaticRetry=true,permanent=false,wrongLease=false,wrongOwner=false,succeeded=false,terminal=false,retryAfterMs=0}={}){
  const original={id:7,type:'commit_workflow',operation_id:'completion-immutable',logical_key:'session-immutable',
    semantic_fingerprint:'a'.repeat(64),payload:{p_answers:{work_result:'details',note:'Actual work'}},
    retry_count:count,lease_owner:wrongOwner?'other-worker':'worker',lease_token:'lease',security_generation:4};
  let saved=null,deleted=null,mutationOptions=null;
  const context=vm.createContext({CONFIG:{STORE_NAME:'actions',MAX_RETRIES:50},now:()=>clock,safeText:x=>String(x||''),
    state:{workerId:'worker',db:{transaction(){const tx={};const request={result:original};
      tx.objectStore=()=>({get:()=>request,put:row=>{saved=structuredClone(row);},delete:id=>{deleted=id;}});
      queueMicrotask(()=>{request.onsuccess();tx.oncomplete();});return tx;}}},
    mutateProtectedQueue:(operation,options)=>{mutationOptions=options;return operation();},
    storageRecord:x=>x,isTerminalReconciliation:()=>terminal,applyProcessResult(){},
    Math:Object.assign(Object.create(Math),{random:()=>0})});
  vm.runInContext(owning,context);
  const changed=await context.finishClaim({...original,lease_token:wrongLease?'old-lease':'lease'},
    {succeeded,result:terminal?{status:'quarantined',reason:'manager_required'}:{status:'closed'},
      permanent,automaticRetry,retryAfterMs,error:'Temporary outage'});
  check(mutationOptions.expectedGeneration,4,'original security generation stays fenced');
  return {original,saved,deleted,changed};
}
for(const count of [49,50,51,500,Number.MAX_SAFE_INTEGER]){
  const f=await settle({count});
  check(f.saved.dead_letter,false,'confirmed outage never exhausts automatic recovery at '+count);
  check(f.saved.state,'retrying','pending work remains eligible');
  check(f.saved.operation_id,f.original.operation_id,'operation identity unchanged');
  check(f.saved.semantic_fingerprint,f.original.semantic_fingerprint,'semantic binding unchanged');
  check(f.saved.payload,f.original.payload,'answers unchanged');
  check(f.deleted,null,'outage never deletes work');
  check(f.saved.next_attempt_at>clock&&f.saved.next_attempt_at<=clock+900000,true,'bounded nonbusy retry delay');
  check(Number.isSafeInteger(f.saved.retry_count),true,'retry counter stays finite and exact');
}
for(const options of [{permanent:true},{automaticRetry:false}]){
  const f=await settle(options);check(f.saved.dead_letter,true,'permanent/unknown exhausted failure still held');
  check(f.deleted,null,'held work retained');
}
for(const options of [{wrongLease:true},{wrongOwner:true}]){
  const f=await settle(options);check(f.changed,false,'stale owner cannot settle');check(f.saved,null,'stale owner cannot rewrite');
}
const rateLimited=await settle({retryAfterMs:1800000});
check(rateLimited.saved.next_attempt_at,clock+1800000,'server Retry-After preserved');
const accepted=await settle({succeeded:true});check(accepted.deleted,7,'accepted completion still retires exact queue item');
const held=await settle({succeeded:true,terminal:true});check(held.saved.state,'quarantined','terminal reconciliation remains quarantined');
check(held.deleted,null,'terminal reconciliation retains evidence');

const classificationStart=source.indexOf('  function isAutomaticOutageRetry(');
assert.ok(classificationStart>=0,'explicit owning outage classification exists');
const classificationEnd=source.indexOf('  function parseRetryAfter(',classificationStart);
const context=vm.createContext({});vm.runInContext(source.slice(classificationStart,classificationEnd),context);
for(const status of [408,429,500,502,503,504,599])check(context.isAutomaticOutageRetry({httpStatus:status}),true,'transient HTTP '+status);
for(const status of [0,200,400,401,403,404,409,410,422,600])check(context.isAutomaticOutageRetry({httpStatus:status}),false,'non-outage HTTP '+status);
check(context.isAutomaticOutageRetry({code:'custodial_native_network_unavailable'}),true,'typed native outage');
check(context.isAutomaticOutageRetry({scanTransportFailure:true}),true,'browser fetch rejection');
for(const code of ['custodial_restore_quarantine','custodial_device_not_enrolled','custodial_native_vault_required'])
  for(const extra of [{},{httpStatus:503},{scanTransportFailure:true}])
    check(context.isAutomaticOutageRetry({code,...extra}),false,'no security bypass '+code);
check(context.isAutomaticOutageRetry(new TypeError('programming error')),false,'arbitrary TypeError is not an outage');

const rpcStart=source.indexOf('  async function rpc('),rpcEnd=source.indexOf('  async function persistServerCompletionReceipt(',rpcStart);
assert.ok(rpcStart>=0&&rpcEnd>rpcStart);
async function rpcFailure(fetch,expected,args={}){
  const rpcContext=vm.createContext({state:{deviceId:'assigned-device'},CONFIG:{API_URL:'https://synthetic.invalid/rpc'},
    safeText:x=>String(x||''),fetch});
  vm.runInContext(source.slice(rpcStart,rpcEnd),rpcContext);
  let failure;
  try{await rpcContext.rpc('synthetic_test',args);}catch(error){failure=error;}
  assert.ok(failure,'fixture rejects');checks++;
  check(context.isAutomaticOutageRetry(failure),expected,'actual RPC failure classified at owning boundary');
  return failure;
}
const browserError=new TypeError('Failed to fetch');Object.freeze(browserError);
const marked=await rpcFailure(async()=>{throw browserError;},true);
check(marked.cause,browserError,'frozen original transport error retained as cause');
const nativeError=Object.assign(new Error('offline'),{code:'custodial_native_network_unavailable'});
check(await rpcFailure(async()=>{throw nativeError;},true),nativeError,'typed native error preserved');
const identityError=Object.assign(new TypeError('identity fence'),{code:'custodial_device_not_enrolled'});
check(await rpcFailure(async()=>{throw identityError;},false),identityError,'typed security error preserved');
for(const status of [200,401,403,422,429,503]){
  const error=await rpcFailure(async()=>({ok:status===200,status,headers:{get:()=>''},
    json:async()=>{throw new SyntaxError('broken body');}}),status===429||status===503);
  check(error.httpStatus,status,'response status preserved despite malformed JSON');
}
const circular={};circular.self=circular;let fetchCalled=false;
await rpcFailure(async()=>{fetchCalled=true;},false,circular);
check(fetchCalled,false,'serialization failure never enters the transport boundary');
assert.match(source,/automaticRetry:\s*isAutomaticOutageRetry\(error\)/,'worker wires the classifier');checks++;
console.log(JSON.stringify({status:'PASS_SCAN_OUTAGE_RETRY_SETTLEMENT',checks,
  limits:'actual settlement/classifier; synthetic transaction, not browser/native/Wi-Fi/dashboard or independent acceptance'}));
