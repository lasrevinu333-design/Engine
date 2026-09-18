import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const text=fs.readFileSync(process.argv[2]+'/memphis-scan-sync.js','utf8');
const source=text.slice(text.indexOf('  async function verifiedServerCompletionReceipt('),text.indexOf('  function isTerminalReconciliation('));
const S='10000000-0000-4000-8000-000000000001',C='20000000-0000-4000-8000-000000000001',E='30000000-0000-4000-8000-000000000001';
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const canonical=v=>JSON.stringify(sort(v));function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
async function run(authenticated){
 const counts={rpc:0,ack:0,draftDeletion:0};
 const result={status:'closed',client_session_id:S,client_completion_id:C};
 const payload={p_device_id:'KIOSK_08',p_location_code:'NOCX',p_client_session_id:S,p_client_completion_id:C,
   p_client_started_at:'2026-09-18T12:00:00.000Z',p_client_ended_at:'2026-09-18T12:20:00.000Z',
   p_native_finish_scan_entry_id:E,p_native_completion_attestation_version:'custodial-native-completion.v2',
   p_native_completion_attestation:'a'.repeat(64),p_response_json:{services_performed:['Full cleaning services']},p_scan_evidence:[]};
 const item={type:'commit_workflow',operation_id:C,logical_key:'commit:'+C,semantic_fingerprint:'unchanged',payload};
 const fake={schema_version:'server-completion-receipt.v1',operation_id:C,logical_key:item.logical_key,semantic_fingerprint:'unchanged',result};
 item.server_completion_receipt={...fake,integrity_sha256:sha256(canonical(fake))};
 const safeText=v=>String(v??'').trim(),isUuid=v=>/^[a-f0-9-]{36}$/.test(v);
 const ctx={safeText,isUuid,sha256,canonicalJson:canonical,exactSessionForPayload:()=>null,
   replayBindingFor:()=>({client_session_id:S,client_completion_id:C,snapshot_id:''}),
   rpc:async()=>{counts.rpc++;throw Error('No authentic server response');},
   persistClaimPayload:async()=>true,persistServerCompletionReceipt:async()=>{},
   deleteCompletionDraft:async()=>{counts.draftDeletion++;},mutateProtectedQueue:async fn=>fn(),
   localStorage:{removeItem(){},getItem:()=>null},storageFailure:(_,e)=>e,
   window:{MemphisMobile:{getAuthenticatedCompletion:async()=>authenticated?{found:true,result}:{found:false},
     acknowledgeOfflineCompletion:async()=>{counts.ack++;return {acknowledged:true};}}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);let returned=null,error=null;
 try{returned=await ctx.processAction(item);}catch(e){error=e.message;}
 return {counts,returned,error};
}
const forged=await run(false),authentic=await run(true);const tests=[];
for(const [name,fn] of [
 ['editable receipt cannot bypass server/native authority',()=>{assert.equal(forged.returned,null);assert.equal(forged.counts.rpc,1);}],
 ['editable receipt cannot trigger native cleanup',()=>assert.equal(forged.counts.ack,0)],
 ['editable receipt cannot retire required answers',()=>assert.equal(forged.counts.draftDeletion,0)],
 ['native-authenticated recovery permits exact cleanup without another HTTP call',()=>{assert.equal(authentic.returned?.status,'closed');assert.equal(authentic.counts.rpc,0);assert.equal(authentic.counts.ack,1);assert.equal(authentic.counts.draftDeletion,1);}]
]){try{fn();tests.push({name,passed:true});}catch(e){tests.push({name,passed:false,error:e.message});}}
console.log(JSON.stringify({scope:'Actual source receipt/worker functions with hostile browser row and stubbed native/HTTP boundaries; native journal separately unit-tested',passed:tests.filter(x=>x.passed).length,failed:tests.filter(x=>!x.passed).length,forged,authentic,tests},null,2));
process.exitCode=tests.some(x=>!x.passed)?1:0;
