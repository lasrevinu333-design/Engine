import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {captureProtectedBrowserWork,observeProtectedBrowserWork,closeCapturedProtectedBrowserWork,
 inspectCapturedOriginalCompletion,readCapturedOriginalCompletionArguments,
 inspectCapturedOriginalCompletionCensus,readCapturedOriginalCompletionCensusArguments} from '../mobile/src/custodial/protected-browser-inventory.js';
// Factories only. Do NOT execute the previous observation/one-completion suites.
const source=fs.readFileSync(new URL('./protected-browser-inventory-tests.mjs',import.meta.url),'utf8');
const factory=source.slice(source.indexOf('function storage('),source.indexOf('const call='));
assert.ok(factory.startsWith('function storage(')&&factory.includes('function idb('));
const fixtures=vm.runInNewContext(factory+'\n({storage,idb})',{assert,queueMicrotask,setTimeout});
const uuid=n=>'60000000-0000-4000-8000-'+String(n).padStart(12,'0');
const args=(n=1,device='KIOSK_08')=>({p_device_id:device,p_client_session_id:uuid(n),p_client_completion_id:uuid(n+100),
 p_native_finish_scan_entry_id:uuid(n+200),p_response_json:{note:'original PRIVATE synthetic answer '+n},
 p_native_completion_attestation:'a'.repeat(64),p_client_started_at:'2026-09-26T12:00:00.000Z',p_client_ended_at:'2026-09-26T12:20:00.000Z'});
const row=(payload=args(),id=1)=>({id,type:'commit_workflow',schema_version:6,operation_id:uuid(id+300),completion_client_id:payload.p_client_completion_id,payload});
function setup(rows=[{key:1,value:row()}],extra={},local={'unknown-local':'original historical {'},options={}) {
 const definitions={mz_scan_queue:{version:6,stores:{actions:rows}},...extra};
 return{local:fixtures.storage(local),db:fixtures.idb(definitions,options),definitions};
}
const capture=(f,cryptoApi=webcrypto,timeoutMs=3000)=>captureProtectedBrowserWork({storage:f.local,indexedDb:f.db,cryptoApi,timeoutMs});
const inspect=c=>inspectCapturedOriginalCompletionCensus(c,{timeoutMs:3000});
function flags(value){assert.equal(value.browser_inventory_state,'UNKNOWN');assert.equal(value.native_semantic_inventory_state,'UNKNOWN');
 for(const field of['native_authority','source_authenticated','frozen','complete_namespace_inventory','current_server_readback','cutoff_eligible',
  'acknowledged','work_accepted','key_removal','phone_released'])assert.equal(value[field],false);
 assert.ok(!JSON.stringify(value).includes('original PRIVATE'));assert.ok(Object.isFrozen(value));assert.ok(value.records.every(Object.isFrozen));
 assert.ok(Object.isFrozen(value.records));assert.ok(value.domains.every(Object.isFrozen));assert.equal(value.unresolved_record_count,value.record_count);}
function resources(f){assert.equal(f.db.state.opens,f.db.state.closes);assert.equal(f.db.state.created,0);assert.ok(f.db.state.modes.every(v=>v==='readonly'));}
const wipe=list=>list.forEach(bytes=>bytes.fill(0));
let passed=0;const outcomes=[];async function test(name,run){await run();passed++;outcomes.push({case:name,status:'PASS'});console.log('PASS NEW browser census '+name);}
async function withCapture(f,run){const before=JSON.stringify(f.definitions),c=await capture(f);assert.equal(c.state,'OBSERVED_NOT_FROZEN');
 try{await run(c);}finally{closeCapturedProtectedBrowserWork(c);resources(f);assert.equal(JSON.stringify(f.definitions),before);}}

await test('all original rows and empty local database store domains represented without selector',async()=>{
 const f=setup([{key:1,value:row(args(1),1)},{key:2,value:row(args(2,'OTHER'),2)},{key:3,value:{id:3,type:'start',schema_version:6}},
  {key:4,value:'corrupt original'}],{unknown_future:{version:9,stores:{unknown:[{key:'private-key',value:{original:'PRIVATE'}}],empty:[]}},
  empty_database:{version:1,stores:{}},mz_scan_completion_drafts:{version:1,stores:{drafts:[{key:1,value:row()}]}},
  mz_scan_queue_v6_to_v4_backup:{version:1,stores:{actions:[{key:1,value:row()}]}}});
 await withCapture(f,async c=>{const result=await inspect(c);flags(result);assert.equal(result.record_count,c.record_count);assert.equal(result.record_count,8);
  assert.equal(result.primary_queue_row_count,4);assert.equal(result.argument_candidate_count,2);assert.equal(result.ambiguous_argument_candidate_count,0);
  assert.deepEqual(result.records.map(v=>[v.key_sha256,v.body_sha256]),c.records.map(v=>[v.key_sha256,v.body_sha256]));
  assert.equal(result.domains.find(v=>v.database==='empty_database').record_count,0);assert.ok(result.domains.some(v=>v.object_store==='empty'&&v.record_count===0));
  assert.ok(!JSON.stringify(result).includes('private-key'));const list=await readCapturedOriginalCompletionCensusArguments(c,result);
  try{assert.equal(list.length,2);assert.equal(JSON.parse(new TextDecoder().decode(list[1])).p_device_id,'OTHER');}finally{wipe(list);}
 });
});
await test('all six original row versions and direct or exact forward markers preserved',async()=>{
 const rows=Array.from({length:6},(_,i)=>{const value=row(args(i+1),i+1);value.schema_version=i+1;if(i%2){value.type='forward-replay-fenced:commit_workflow';
  value.forward_action_type='commit_workflow';value.forward_replay_contract='scan.v4.snapshot-bound-authority';}return{key:i+1,value};});
 await withCapture(setup(rows),async c=>{const result=await inspect(c);flags(result);assert.equal(result.argument_candidate_count,6);
  const list=await readCapturedOriginalCompletionCensusArguments(c,result);try{assert.equal(list.length,6);assert.equal(new Set(list.map(v=>new TextDecoder().decode(v))).size,6);}finally{wipe(list);}});
});
await test('identical duplicate rows stay ambiguous and both reach the complete argument list',async()=>{
 await withCapture(setup([{key:1,value:row(args(),1)},{key:2,value:row(args(),2)}]),async c=>{const result=await inspect(c);flags(result);
  assert.equal(result.ambiguous_argument_candidate_count,2);assert.ok(result.records.filter(v=>v.candidate_ordinal!=null).every(v=>v.state==='AMBIGUOUS_COMPLETION_ARGUMENT_ROWS_RETAINED'));
  const list=await readCapturedOriginalCompletionCensusArguments(c,result);try{assert.equal(list.length,2);assert.deepEqual(list[0],list[1]);assert.notEqual(list[0],list[1]);}finally{wipe(list);}});
});
await test('distinct completions borrowing one session are retained not chosen',async()=>{
 const second=args(2);second.p_client_session_id=args().p_client_session_id;
 await withCapture(setup([{key:1,value:row(args(),1)},{key:2,value:row(second,2)}]),async c=>{const r=await inspect(c);flags(r);assert.equal(r.argument_candidate_count,2);
  assert.equal(r.ambiguous_argument_candidate_count,2);assert.ok(r.records.filter(v=>v.candidate_ordinal!=null).every(v=>v.state==='AMBIGUOUS_SESSION_ARGUMENT_ROWS_RETAINED'));});
});
await test('reused queue operation across different identities remains explicit ambiguity',async()=>{
 const second=row(args(2,'OTHER'),2);second.operation_id=row().operation_id;
 await withCapture(setup([{key:1,value:row()},{key:2,value:second}]),async c=>{const r=await inspect(c);flags(r);assert.equal(r.ambiguous_argument_candidate_count,2);
  assert.ok(r.records.filter(v=>v.candidate_ordinal!=null).every(v=>v.state==='AMBIGUOUS_QUEUE_OPERATION_ROWS_RETAINED'));});
});
await test('malformed primary identities and forward contract never repaired or omitted',async()=>{
 const changes=[v=>v.id=99,v=>v.schema_version=7,v=>v.operation_id='bad',v=>v.payload.p_device_id='lower-case',v=>v.payload.p_client_session_id='bad',
  v=>v.payload.p_client_completion_id='bad',v=>v.payload.p_native_finish_scan_entry_id='bad',v=>v.completion_client_id=uuid(99),v=>v.payload=null,
  v=>{v.type='forward-replay-fenced:commit_workflow';v.forward_action_type='commit_workflow';v.forward_replay_contract='wrong';}];
 const rows=changes.map((change,i)=>{const value=row(args(i+1),i+1);change(value);return{key:i+1,value};});
 await withCapture(setup(rows),async c=>{const r=await inspect(c);flags(r);assert.equal(r.record_count,11);assert.equal(r.primary_queue_row_count,10);assert.equal(r.argument_candidate_count,0);
  assert.ok(r.records.filter(v=>v.kind==='PRIMARY_QUEUE_ORIGINAL').every(v=>v.state.startsWith('MALFORMED_')));});
});
await test('future primary versions alternate stores backups and drafts never supply originals',async()=>{
 const f=setup([],{mz_scan_queue:{version:7,stores:{actions:[{key:1,value:row()}],other:[{key:2,value:row(args(2),2)}]}},
  mz_scan_queue_backup:{version:1,stores:{actions:[{key:1,value:row()}]}},mz_scan_completion_drafts:{version:1,stores:{drafts:[{key:1,value:row()}]}}});
 await withCapture(f,async c=>{const r=await inspect(c);flags(r);assert.equal(r.argument_candidate_count,0);assert.equal(r.primary_queue_row_count,0);assert.equal(r.record_count,5);
  assert.ok(r.records.filter(v=>v.database==='mz_scan_queue').every(v=>v.state==='UNSUPPORTED_PRIMARY_DOMAIN_RETAINED_UNKNOWN'));});
});
await test('lossless tagged corrupt values retain distinct hashes with no JSON coercion',async()=>{
 const values=[undefined,null,new Date('2026-09-26T10:00:00Z'),new Uint8Array([1,2]),[,],NaN,-0,Infinity,Number.MAX_SAFE_INTEGER+1,'\ud800','\ud801'];
 await withCapture(setup(values.map((value,i)=>({key:i+1,value:row({...args(i+1),original:value},i+1)}))),async c=>{
  const r=await inspect(c);flags(r);assert.equal(r.argument_candidate_count,1);assert.equal(r.primary_queue_row_count,values.length);
  assert.equal(new Set(r.records.filter(v=>v.kind==='PRIMARY_QUEUE_ORIGINAL').map(v=>v.body_sha256)).size,values.length);
  assert.equal(r.records.filter(v=>v.state==='UNINSPECTABLE_PRIMARY_ROW_RETAINED').length,values.length-1);
 });
});
await test('exact original nested fields Unicode and transport proofs are not rewritten or leaked',async()=>{
 const payload=args();payload.p_response_json.note='original PRIVATE ñ 🦥';payload.p_native_completion_transport_attestation='b'.repeat(64);
 payload.p_response_json.items=[true,null,1.5,{original:'untouched'}];
 await withCapture(setup([{key:1,value:row(payload)}]),async c=>{const r=await inspect(c);flags(r);const list=await readCapturedOriginalCompletionCensusArguments(c,r);
  try{assert.equal(list.length,1);assert.deepEqual(JSON.parse(new TextDecoder().decode(list[0])),payload);
   assert.equal(r.records.find(v=>v.candidate_ordinal===0).argument_values_sha256,createHash('sha256').update(list[0]).digest('hex'));
   assert.ok(!JSON.stringify(r).includes('ñ'));assert.ok(!JSON.stringify(r).includes('p_native_completion_transport_attestation'));}finally{wipe(list);}});
});
await test('digest-only copied and cross-capture capabilities cannot expose private originals',async()=>{
 const f=setup(),d=await observeProtectedBrowserWork({storage:f.local,indexedDb:f.db,cryptoApi:webcrypto});
 await assert.rejects(inspect(d),/capture_required/);const c=await capture(f),other=await capture(f);
 try{const r=await inspect(c);await assert.rejects(readCapturedOriginalCompletionCensusArguments(c,{...r}),/census_required/);
  await assert.rejects(readCapturedOriginalCompletionCensusArguments(other,r),/census_required/);
  assert.throws(()=>{r.records[0].state='accepted';},TypeError);
 }finally{closeCapturedProtectedBrowserWork(c);closeCapturedProtectedBrowserWork(other);resources(f);}
});
await test('changed source before census refuses the whole observation',async()=>{
 const f=setup(),c=await capture(f);f.definitions.mz_scan_queue.stores.actions[0].value.payload.p_response_json.note='changed';
 try{await assert.rejects(inspect(c),/capture_changed/);}finally{closeCapturedProtectedBrowserWork(c);resources(f);}
});
await test('changed unknown local row during argument hashing refuses no partial capability',async()=>{
 const f=setup();let mutate=false;const cryptoApi={subtle:{digest(...values){if(mutate){mutate=false;f.local.data.set('unknown-local','changed');}return webcrypto.subtle.digest(...values);}}};
 const c=await capture(f,cryptoApi);mutate=true;try{await assert.rejects(inspect(c),/capture_changed/);}finally{closeCapturedProtectedBrowserWork(c);resources(f);}
});
await test('changed source after census refuses before any argument list is returned',async()=>{
 const f=setup(),c=await capture(f),r=await inspect(c);f.local.data.set('new-original','not in capture');
 try{await assert.rejects(readCapturedOriginalCompletionCensusArguments(c,r),/capture_changed/);}finally{closeCapturedProtectedBrowserWork(c);resources(f);}
});
await test('closing capture revokes both old narrow and new complete-list child capabilities',async()=>{
 const f=setup(),c=await capture(f),r=await inspect(c),a=args();
 const narrow=await inspectCapturedOriginalCompletion(c,{deviceId:a.p_device_id,clientSessionId:a.p_client_session_id,clientCompletionId:a.p_client_completion_id});
 closeCapturedProtectedBrowserWork(c);closeCapturedProtectedBrowserWork(c);
 await assert.rejects(readCapturedOriginalCompletionCensusArguments(c,r),/census_required/);
 await assert.rejects(readCapturedOriginalCompletionArguments(c,narrow),/candidate_required/);resources(f);
});
await test('close during digest prevents private census publication',async()=>{
 const f=setup();let close=false,c;const cryptoApi={subtle:{digest(...values){if(close){close=false;closeCapturedProtectedBrowserWork(c);}return webcrypto.subtle.digest(...values);}}};
 c=await capture(f,cryptoApi);close=true;await assert.rejects(inspect(c),/capture_required/);resources(f);
});
await test('aggregate native argument limit refuses without truncating or modifying source',async()=>{
 const rows=Array.from({length:4},(_,i)=>{const payload=args(i+1);payload.p_response_json.note='x'.repeat(2200000);return{key:i+1,value:row(payload,i+1)};});
 const f=setup(rows),before=JSON.stringify(f.definitions),c=await capture(f,webcrypto,15000);assert.equal(c.state,'OBSERVED_NOT_FROZEN');
 try{await assert.rejects(inspectCapturedOriginalCompletionCensus(c,{timeoutMs:15000}),/census_argument_limit/);assert.equal(JSON.stringify(f.definitions),before);}
 finally{closeCapturedProtectedBrowserWork(c);resources(f);}
});
await test('Unicode byte oversize row stays explicitly unresolved not replacement encoded',async()=>{
 const payload=args();payload.p_response_json.note='界'.repeat(1500000);const f=setup([{key:1,value:row(payload)}]),c=await capture(f,webcrypto,15000);
 assert.equal(c.state,'OBSERVED_NOT_FROZEN');try{const r=await inspectCapturedOriginalCompletionCensus(c,{timeoutMs:15000});flags(r);assert.equal(r.argument_candidate_count,0);
  assert.equal(r.records.find(v=>v.kind==='PRIMARY_QUEUE_ORIGINAL').state,'OVERSIZE_COMPLETION_ARGUMENTS_RETAINED');}
 finally{closeCapturedProtectedBrowserWork(c);resources(f);}
});
await test('one deadline bounds hung digest and invalid inspection budgets fail closed',async()=>{
 const f=setup();let hang=false;const cryptoApi={subtle:{digest:(...values)=>hang?new Promise(()=>{}):webcrypto.subtle.digest(...values)}};
 const c=await capture(f,cryptoApi);hang=true;try{await assert.rejects(inspectCapturedOriginalCompletionCensus(c,{timeoutMs:5}),/inspection_timeout/);
  for(const timeoutMs of[0,30001,NaN,'5'])await assert.rejects(inspectCapturedOriginalCompletionCensus(c,{timeoutMs}),/configuration_invalid/);}
 finally{closeCapturedProtectedBrowserWork(c);resources(f);}
});
await test('empty captured realm is represented but not an authenticated empty inventory',async()=>{
 const f=setup([],{},{});await withCapture(f,async c=>{const r=await inspect(c);flags(r);assert.equal(r.record_count,0);assert.equal(r.argument_candidate_count,0);
  assert.equal(r.domains.length,3);const list=await readCapturedOriginalCompletionCensusArguments(c,r);assert.deepEqual(list,[]);});
});
console.log(JSON.stringify({schema:'custodial.browser-whole-capture-completion-census-source-proof.v1',new_groups:passed,failed:0,skipped:0,outcomes,
 scope:'ACTUAL_UNMOUNTED_ESM_COMPLETE_CAPTURE_AND_PRIVATE_LIST_OVER_SYNTHETIC_STORAGE_IDB_NODE_WEBCRYPTO_ONLY',
 old_unchanged_suites_not_rerun:true,real_browser_all_realm_durable_freeze_ABA_native_SQL_current_server_semantic_ACK_key_or_physical_acceptance:false}));
