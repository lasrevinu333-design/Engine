import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// Actual worker functions, synthetic native/storage adapters. Not device proof.
const source=readFileSync(new URL('../memphis-scan-sync.js',import.meta.url),'utf8');
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end)};
const code=section('  async function verifiedServerCompletionReceipt(item){','  async function processAction(item)')+
 section('  const nativeLegacyCompletionBindings = new WeakMap();','  async function recoverLocalCompletionIntents()')+
 '\n({validateLocalCompletion,persistLocalCompletionUnlocked,recoverLocalCompletionIntentsUnlocked,localCompletionReceipt});';
const sessionId='00000000-0000-4000-8000-000000000001',completionId='00000000-0000-4000-8000-000000000002';
function fixture({accepted=true,services=['Floor'],editDuringNative=false,throwNative=false,durableEditDuringNative=false,missingLock=false,durableChange=null}={}){
 const response={services_performed:services,note:'Original unchanged saved work'};
 const session={session_uuid:sessionId,client_session_id:sessionId,client_completion_id:completionId,
  native_finish_scan_entry_id:'00000000-0000-4000-8000-000000000003',device_id:'TEST_DEVICE',location_code:'TEST_LOC',
  started_at:'2026-09-22T15:30:00.000Z',ended_at:'2026-09-22T15:35:00.000Z',response_json:structuredClone(response),status:'pending_sync'};
 const payload={p_client_session_id:sessionId,p_client_completion_id:completionId,p_device_id:session.device_id,
  p_location_code:session.location_code,p_native_finish_scan_entry_id:session.native_finish_scan_entry_id,
  p_client_started_at:session.started_at,p_client_ended_at:session.ended_at,p_response_json:structuredClone(response),p_scan_evidence:[]};
 const action={type:'commit_workflow',payload,server_completion_receipt:{result:{status:'closed'},integrity_sha256:'editable'}};
 session.completion_outbox=action;
 const stored=[session],queue=[];let nativeCalls=0,writes=0;
 const api=runInNewContext(code,{
  safeText:v=>String(v??'').trim(),canonicalJson:JSON.stringify,isUuid:v=>/^[a-f0-9-]{36}$/.test(v),
  navigator:missingLock?{}:{locks:{request(){throw new Error('unlocked-function unit harness does not exercise actual Web Locks');}}},
  storageFailure:(_area,e)=>e,state:{deviceId:'TEST_DEVICE'},allSessions:()=>structuredClone(stored),
  readSession:()=>structuredClone(stored[0]),listActions:async()=>queue,enqueueUnlocked:async a=>{queue.push(structuredClone(a));writes++},
  saveSession:s=>{stored[0]=structuredClone(s);writes++},mutateProtectedQueue:async fn=>fn(),
  validateProcessResult:(item,result)=>{assert.equal(result.client_session_id,item.payload.p_client_session_id);assert.equal(result.client_completion_id,item.payload.p_client_completion_id)},
  processResultFailure:message=>new Error(message),
  window:{MemphisMobile:{getAuthenticatedCompletion:async({completionPayload})=>{
   nativeCalls++;
   if(throwNative)throw new Error('native receipt binding mismatch');
   if(editDuringNative)completionPayload.p_response_json.note='changed while native awaited';
   if(durableEditDuringNative){
    stored[0]=structuredClone(stored[0]);
    stored[0].response_json.note='Newer durable edit must survive';
    stored[0].completion_outbox.payload.p_response_json.note='Newer durable edit must survive';
   }
   if(durableChange)durableChange(stored);
   return {found:accepted,result:{status:'closed',client_session_id:sessionId,client_completion_id:completionId}};
  }}},
 });
 return {api,session,action,stored,queue,counters:()=>({nativeCalls,writes})};
}
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS',name)};
for(const options of [{accepted:false},{throwNative:true},{editDuringNative:true},{services:['Full cleaning services','Floor']},{services:['\t']},{services:[]}]){
 await test('unverified/invalid legacy preserved '+JSON.stringify(options),async()=>{
  const f=fixture(options),before=JSON.stringify(f.stored);
  await assert.rejects(f.api.recoverLocalCompletionIntentsUnlocked());
  assert.equal(f.counters().writes,0);assert.equal(f.queue.length,0);
  if(!options.editDuringNative)assert.equal(JSON.stringify(f.stored),before);
  assert.throws(()=>f.api.validateLocalCompletion(f.session,f.action),'ephemeral authority removed even after failed validation');
 });
}
for(const services of [['Floor'],['Full cleaning services']]){
 await test('native-accepted exact legacy recovered without rewriting answers '+JSON.stringify(services),async()=>{
  const f=fixture({services}),payload=JSON.stringify(f.action.payload),response=JSON.stringify(f.session.response_json);
  await f.api.recoverLocalCompletionIntentsUnlocked();
  assert.equal(f.counters().nativeCalls,1);assert.equal(f.queue.length,1);
  assert.equal(JSON.stringify(f.queue[0].payload),payload);assert.equal(JSON.stringify(f.stored[0].response_json),response);
  assert.equal(f.stored[0].status,'saved_pending_sync');assert.equal(f.stored[0].response_json.work_result,undefined);
  assert.throws(()=>f.api.validateLocalCompletion(f.session,f.action),'fresh save cannot reuse expired private admission');
  const before=JSON.stringify(f.stored);await f.api.recoverLocalCompletionIntentsUnlocked();
  assert.equal(f.counters().nativeCalls,2);assert.equal(f.queue.length,1);assert.equal(JSON.stringify(f.stored),before);
 });
}
await test('new explicit save requires no legacy receipt',async()=>{
 const f=fixture({accepted:false});f.session.response_json.work_result='details';f.action.payload.p_response_json.work_result='details';
 await f.api.persistLocalCompletionUnlocked(f.session,f.action);assert.equal(f.counters().nativeCalls,0);assert.equal(f.queue.length,1);
});
await test('new no-key save cannot reuse editable browser receipt',async()=>{
 const f=fixture();const before=JSON.stringify(f.stored);await assert.rejects(f.api.persistLocalCompletionUnlocked(f.session,f.action));
 assert.equal(f.counters().nativeCalls,0);assert.equal(f.counters().writes,0);assert.equal(JSON.stringify(f.stored),before);
});
await test('detached recovery snapshot cannot overwrite durable edit during native await',async()=>{
 const f=fixture({durableEditDuringNative:true});
 await assert.rejects(f.api.recoverLocalCompletionIntentsUnlocked());
 assert.equal(f.counters().writes,0);assert.equal(f.queue.length,0);
 assert.equal(f.stored[0].response_json.note,'Newer durable edit must survive');
 assert.equal(f.stored[0].completion_outbox.payload.p_response_json.note,'Newer durable edit must survive');
});
for(const [name,change] of [
 ['status',s=>{s[0].status='active';}],
 ['outbox type',s=>{s[0].completion_outbox.type='start_session';}],
 ['completion identity',s=>{s[0].client_completion_id='00000000-0000-4000-8000-000000000004';}],
 ['scan evidence',s=>{s[0].completion_outbox.payload.p_scan_evidence.push({changed:true});}],
 ['other durable field',s=>{s[0].manager_recovery_note='Preserve this evidence';}],
 ['deleted record',s=>{s.splice(0,1);}],
])await test('changed durable '+name+' rejects without recovery writes',async()=>{
 let changedBytes;const f=fixture({durableChange:s=>{change(s);changedBytes=JSON.stringify(s);}});
 await assert.rejects(f.api.recoverLocalCompletionIntentsUnlocked());
 assert.equal(f.counters().writes,0);assert.equal(f.queue.length,0);assert.equal(JSON.stringify(f.stored),changedBytes);
});
await test('no real shared Web Lock means no legacy recovery or native request',async()=>{
 const f=fixture({missingLock:true}),before=JSON.stringify(f.stored);
 await assert.rejects(f.api.recoverLocalCompletionIntentsUnlocked(),/shared saved-work lock/);
 assert.deepEqual(f.counters(),{writes:0,nativeCalls:0});assert.equal(JSON.stringify(f.stored),before);
});
console.log(JSON.stringify({passed,failed:0,native_adapter:'synthetic',storage_adapter:'synthetic',physical:false}));
