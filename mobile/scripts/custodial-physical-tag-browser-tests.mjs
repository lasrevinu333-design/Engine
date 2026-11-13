import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const source=readFileSync(process.argv[2]||fileURLToPath(new URL('../../index.html',import.meta.url)),'utf8');
const start=source.indexOf('    async function finishSessionMaybeQueued('),end=source.indexOf('async function completeSessionMaybeQueued(',start);
assert(start>0&&end>start);
const method=source.slice(start,end);
const session='11111111-1111-4111-8111-111111111111',wrong='22222222-2222-4222-8222-222222222222',correct='33333333-3333-4333-8333-333333333333',completion='44444444-4444-4444-8444-444444444444';
const original={session_uuid:session,client_session_id:session,status:'offline-provisional',started_at:'2026-09-18T12:00:00.000Z',location_code:'NOCX',device_id:'KIOSK_08',employee_name:'Karen',server_acknowledged:false,notes:'original notes',scan_evidence:[{event_type:'scan_start'}]};
function fixture({row=original,entry=correct,refuseWrong=false,error='',errors={},endedAt='2026-09-18T12:01:00.000Z',interrupt=false}={}){
 let saved=structuredClone(row),captured=[],saves=0;
 const drafts=new Map([['draft:'+session,'original draft bytes'],['offline_queue','original pending payload bytes']]);const priorDrafts=[...drafts];
 const context={currentScanEntryAttestation:entry?{entry_id:entry}:null,currentScanState:null,isReadonlyScanEmployeeDevice:()=>true,
  getLatestLocalSessionForLocation:async()=>saved,getLocalSessionById:()=>saved,
  resolveLocationKind:()=>({locationType:'restroom',formType:'restroom'}),completionIdForSession:async()=>completion,
  saveLocalSession:async value=>{saves++;if(interrupt&&saves===2){interrupt=false;throw Object.assign(new Error('uncertain write'),{code:'storage_failure'});}saved=structuredClone(value);},
  window:{MemphisMobile:{nativeOfflineTimeAuthority:true,bindScanEntryAttestation:async()=>{throw Error("Native Finish must check identity before binding");},captureOfflineCompletionTime:async input=>{
    captured.push(input.nativeFinishScanEntryId);
    const refusal=errors[input.nativeFinishScanEntryId]||error||(refuseWrong&&input.nativeFinishScanEntryId===wrong?'custodial_native_tag_identity_mismatch':'');
    if(refusal)throw Object.assign(new Error('native refusal'),{code:refusal});
    return {p_client_ended_at:endedAt,p_native_finish_scan_entry_id:input.nativeFinishScanEntryId};
  }}},crypto:{randomUUID:()=>{throw Error('must preserve session identity');}}};
 runInNewContext(method+'globalThis.finish=finishSessionMaybeQueued;',context);
 return {context,finish:()=>context.finish('NOCX','KIOSK_08'),row:()=>saved,captured,drafts,priorDrafts};
}
let assertions=0;const equal=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const preserve=f=>{for(const key of ['session_uuid','client_session_id','started_at','employee_name','notes'])equal(f.row()[key],original[key]);equal([...f.drafts],f.priorDrafts);};
{
 const f=fixture();await f.finish();equal(f.row().status,'pending_submit');equal(f.captured,[correct]);equal(f.row().native_finish_scan_entry_id,correct);preserve(f);
}
{
 const f=fixture({entry:wrong,refuseWrong:true});await assert.rejects(f.finish(),e=>e.code==='custodial_native_tag_identity_mismatch');assertions++;
 equal(f.row().status,'offline-provisional');equal(f.row().finish_capture_pending,false);equal(f.row().native_finish_scan_entry_id,null);preserve(f);
 f.context.currentScanEntryAttestation={entry_id:correct};await f.finish();equal(f.captured,[wrong,correct]);equal(f.row().status,'pending_submit');preserve(f);
}
{
 const f=fixture({row:{...original,finish_capture_pending:true,native_finish_scan_entry_id:wrong},refuseWrong:true});await f.finish();equal(f.captured,[wrong,correct]);equal(f.row().native_finish_scan_entry_id,correct);preserve(f);
}
{
 const f=fixture({error:'custodial_native_offline_time_persistence_failed'});await assert.rejects(f.finish());assertions++;
 equal(f.row().native_finish_scan_entry_id,correct);equal(f.row().finish_capture_pending,true);equal(f.row().status,'offline-provisional');preserve(f);
}
{
 const f=fixture({error:'custodial_native_tag_identity_legacy_pending'});await assert.rejects(f.finish());assertions++;
 equal(f.row().status,'offline-provisional');equal(f.row().native_finish_scan_entry_id,null);preserve(f);
}
{
 const f=fixture({interrupt:true});await assert.rejects(f.finish());assertions++;equal(f.row().finish_capture_pending,true);
 f.context.currentScanEntryAttestation=null;await f.finish();equal(f.captured,[correct,correct]);equal(f.row().ended_at,'2026-09-18T12:01:00.000Z');preserve(f);
}
// Persisted A never reached native binding/capture before transient expiry; B is a fresh read.
{
 const f=fixture({row:{...original,finish_capture_pending:true,native_finish_scan_entry_id:wrong},errors:{[wrong]:'custodial_native_scan_entry_missing'}});
 await f.finish();equal(f.captured,[wrong,correct]);equal(f.row().native_finish_scan_entry_id,correct);equal(f.row().status,'pending_submit');preserve(f);
}
{
 const f=fixture({row:{...original,finish_capture_pending:true,native_finish_scan_entry_id:correct},entry:wrong,errors:{[correct]:'custodial_native_scan_entry_missing'},refuseWrong:true});
 await assert.rejects(f.finish(),e=>e.code==='custodial_native_tag_identity_mismatch');assertions++;
 equal(f.captured,[correct,wrong]);equal(f.row().status,'offline-provisional');equal(f.row().native_finish_scan_entry_id,null);equal(f.row().finish_capture_pending,false);preserve(f);
}
{
 const originalNativeEnd='2026-09-18T12:00:30.000Z';
 const f=fixture({row:{...original,finish_capture_pending:true,native_finish_scan_entry_id:wrong},errors:{[wrong]:'custodial_native_scan_entry_missing'},endedAt:originalNativeEnd});
 await f.finish();equal(f.captured,[wrong,correct]);equal(f.row().ended_at,originalNativeEnd);equal(f.row().native_finish_scan_entry_id,correct);preserve(f);
}
{
 // Exact durable proof A exists: native succeeds for A, so a new B is never selected.
 const f=fixture({row:{...original,finish_capture_pending:true,native_finish_scan_entry_id:wrong}});
 await f.finish();equal(f.captured,[wrong]);equal(f.row().native_finish_scan_entry_id,wrong);equal(f.row().status,'pending_submit');preserve(f);
}
{
 const f=fixture({row:{...original,finish_capture_pending:true,native_finish_scan_entry_id:wrong},entry:null,errors:{[wrong]:'custodial_native_scan_entry_missing'}});
 await assert.rejects(f.finish(),e=>e.code==='custodial_native_scan_entry_missing');assertions++;
 equal(f.captured,[wrong]);equal(f.row().native_finish_scan_entry_id,wrong);equal(f.row().finish_capture_pending,true);preserve(f);
}
console.log(JSON.stringify({status:'PASS',cases:11,assertions,scope:'Actual Finish handler with synthetic native responses and storage; no physical/readback acceptance'}));
