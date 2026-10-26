import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {captureProtectedBrowserWork,observeProtectedBrowserWork,closeCapturedProtectedBrowserWork,
 inspectCapturedOriginalCompletion,readCapturedOriginalCompletionArguments} from '../mobile/src/custodial/protected-browser-inventory.js';

// Reuse ONLY the existing synthetic Storage/IDB factories, not old test runs.
const helper=fs.readFileSync(new URL('./protected-browser-inventory-tests.mjs',import.meta.url),'utf8');
const factory=helper.slice(helper.indexOf('function storage('),helper.indexOf('const call='));
assert.ok(factory.startsWith('function storage(')&&factory.includes('function idb('));
const fixtures=vm.runInNewContext(factory+'\n({storage,idb})',{assert,queueMicrotask,setTimeout});
const javaCp=process.env.CUSTODIAL_SOURCE_JOIN_TEST_CLASSPATH;
assert.ok(javaCp,'main-owned synthetic compiled JVM classpath required');
function native(mode,input) {
 const r=spawnSync('/usr/bin/java',['-Xmx256m','-cp',javaCp,'org.memphiszoo.custodial.vault.NativeCompletionArgumentStdinProbe',mode],
  {input:input?JSON.stringify(input):'',encoding:'utf8',timeout:10000,maxBuffer:1048576});
 assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim());
}
const args=native('fixture'),selector={deviceId:args.p_device_id,clientSessionId:args.p_client_session_id,clientCompletionId:args.p_client_completion_id,timeoutMs:500};
const op='50000000-0000-4000-8000-000000000001';
const row=(payload=args,id=1)=>({id,type:'forward-replay-fenced:commit_workflow',forward_action_type:'commit_workflow',forward_replay_contract:'scan.v4.snapshot-bound-authority',
 schema_version:6,operation_id:op,completion_client_id:payload.p_client_completion_id,payload:structuredClone(payload)});
function setup(rows=[{key:1,value:row()}],extra={}){
 const definitions={mz_scan_queue:{version:4,stores:{actions:rows}},...extra};
 return {local:fixtures.storage({'session:retained':'malformed historical {'}),db:fixtures.idb(definitions),definitions};
}
const capture=(f,cryptoApi=webcrypto)=>captureProtectedBrowserWork({storage:f.local,indexedDb:f.db,cryptoApi,timeoutMs:500});
function flags(value){for(const k of['native_authority','source_authenticated','frozen','acknowledged','work_accepted','key_removal','phone_released'])assert.equal(value[k],false);assert.equal(value.browser_inventory_state,'UNKNOWN');}
function nativeFlags(value){for(const k of['browser_source_authenticated','original_wire_recovered','cutoff_eligible','work_accepted','inventory_acknowledged','key_removal','phone_released'])assert.equal(value[k],false);}
function resources(f){assert.equal(f.db.state.opens,f.db.state.closes);assert.ok(f.db.state.modes.every(m=>m==='readonly'));assert.equal(f.db.state.created,0);}
let passed=0;async function test(name,run){await run();passed++;console.log('PASS '+name);}
async function join(payload=args,{kind='v2',fault='none'}={}) {
 const f=setup([{key:1,value:row(payload)}]),c=await capture(f);
 try{
  const candidate=await inspectCapturedOriginalCompletion(c,selector);flags(candidate);assert.equal(candidate.state,'ONE_ORIGINAL_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED');
  const bytes=await readCapturedOriginalCompletionArguments(c,candidate,{timeoutMs:500});
  try {const reply=native('join',{candidate_args_base64:Buffer.from(bytes).toString('base64'),receipt_kind:kind,fault});
   if(!reply.refused){nativeFlags(reply);assert.equal(reply.candidate_arguments_sha256,createHash('sha256').update(bytes).digest('hex'));}
   assert.ok(!JSON.stringify(candidate).includes('services_performed'));assert.equal(candidate.queue_operation_id,op);return reply;
  }finally{bytes.fill(0);}
 }finally{closeCapturedProtectedBrowserWork(c);resources(f);}
}
await test('opaque original primary queue values reach actual native frozen v2 binding reader',async()=>{const r=await join();assert.equal(r.semantic_arguments_match,true);});
await test('v3 semantic candidate match remains not original wire or inventory authority',async()=>{const r=await join(args,{kind:'v3'});assert.equal(r.semantic_arguments_match,true);});
await test('changed complete answers cannot match digest-only native v2 receipt',async()=>{const p=structuredClone(args);p.p_response_json.note='altered';assert.equal((await join(p)).semantic_arguments_match,false);});
await test('changed original completion signature cannot be substituted',async()=>{const p=structuredClone(args);p.p_native_completion_attestation='d'.repeat(64);assert.equal((await join(p)).semantic_arguments_match,false);});
await test('legitimate transport-only proof rotation preserves semantic values not wire identity',async()=>{const p=structuredClone(args);p.p_native_completion_transport_attestation_version='custodial-native-completion-transport.v1';p.p_native_completion_transport_attestation='b'.repeat(64);assert.equal((await join(p)).semantic_arguments_match,true);});
await test('duplicate matching original rows remain ambiguous even with equal contents',async()=>{const f=setup([{key:1,value:row(args,1)},{key:2,value:row(args,2)}]),c=await capture(f);try{const result=await inspectCapturedOriginalCompletion(c,selector);flags(result);assert.equal(result.state,'AMBIGUOUS_ORIGINAL_ROWS_RETAINED');assert.equal(result.matching_rows,2);await assert.rejects(readCapturedOriginalCompletionArguments(c,result),/candidate_required/);}finally{closeCapturedProtectedBrowserWork(c);resources(f);}});
await test('backup draft and foreign stores cannot silently become primary original source',async()=>{const f=setup([],{mz_scan_queue_v6_to_v4_backup:{version:1,stores:{actions:[{key:1,value:row()}],metadata:[]}},mz_scan_completion_drafts:{version:1,stores:{drafts:[{key:1,value:row()}]}}}),c=await capture(f);try{const result=await inspectCapturedOriginalCompletion(c,selector);flags(result);assert.equal(result.state,'ORIGINAL_ARGUMENTS_NOT_FOUND_UNKNOWN');assert.equal(c.record_count,3);}finally{closeCapturedProtectedBrowserWork(c);resources(f);}});
await test('primary row identity mismatch and unsupported numeric original stay retained unknown',async()=>{for(const value of[row(args,2),row({...args,unsafe:NaN})]){const f=setup([{key:1,value}]),c=await capture(f);try{const result=await inspectCapturedOriginalCompletion(c,selector);flags(result);assert.equal(result.state,'UNINSPECTABLE_PRIMARY_ROWS_RETAINED');assert.equal(f.definitions.mz_scan_queue.stores.actions.length,1);}finally{closeCapturedProtectedBrowserWork(c);resources(f);}}});
await test('digest-only observation and copied candidate cannot replace opaque owned capture',async()=>{const f=setup(),diagnostic=await observeProtectedBrowserWork({storage:f.local,indexedDb:f.db,cryptoApi:webcrypto,timeoutMs:500});await assert.rejects(inspectCapturedOriginalCompletion(diagnostic,selector),/capture_required/);const c=await capture(f);try{const result=await inspectCapturedOriginalCompletion(c,selector);await assert.rejects(readCapturedOriginalCompletionArguments(c,{...result}),/candidate_required/);}finally{closeCapturedProtectedBrowserWork(c);resources(f);}});
await test('changed source after capture is refused before argument bytes are exposed',async()=>{const f=setup(),c=await capture(f);f.definitions.mz_scan_queue.stores.actions[0].value.payload.p_response_json.note='changed-after';await assert.rejects(inspectCapturedOriginalCompletion(c,selector),/capture_changed/);closeCapturedProtectedBrowserWork(c);resources(f);});
await test('closing original capture revokes its child argument capability',async()=>{const f=setup(),c=await capture(f),result=await inspectCapturedOriginalCompletion(c,selector);closeCapturedProtectedBrowserWork(c);closeCapturedProtectedBrowserWork(c);await assert.rejects(readCapturedOriginalCompletionArguments(c,result),/candidate_required/);resources(f);});
await test('native HMAC full principal raw values revision and candidate races refuse',async()=>{for(const fault of['raw','principal','vault-race','raw-race','candidate-race']){const r=await join(args,{fault});assert.equal(r.refused,true);assert.equal(r.all_authority,false);}});
await test('new candidate digest lifetime is bounded and all read handles close',async()=>{const f=setup();let hang=false;const cryptoApi={subtle:{digest:(...v)=>hang?new Promise(()=>{}):webcrypto.subtle.digest(...v)}};const c=await capture(f,cryptoApi);hang=true;await assert.rejects(inspectCapturedOriginalCompletion(c,{...selector,timeoutMs:5}),/inspection_timeout/);closeCapturedProtectedBrowserWork(c);resources(f);});
console.log(JSON.stringify({passed,failed:0,proof:'actual private browser reader -> memory stdin -> actual owning native HMAC/frozen receipt comparator on synthetic original rows only; no browser/native runtime/SQL/auth/ACK/physical verdict'}));
