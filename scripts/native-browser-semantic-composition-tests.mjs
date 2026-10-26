import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {captureProtectedBrowserWork,closeCapturedProtectedBrowserWork,inspectCapturedOriginalCompletion,
 readCapturedOriginalCompletionArguments} from '../mobile/src/custodial/protected-browser-inventory.js';
// Existing fixture factories only: neither previous observer/argument unit
// suites nor the prior JVM14 suite is executed by this new composition scope.
const source=fs.readFileSync(new URL('./protected-browser-inventory-tests.mjs',import.meta.url),'utf8');
const factory=source.slice(source.indexOf('function storage('),source.indexOf('const call='));
assert.ok(factory.startsWith('function storage(')&&factory.includes('function idb('));
const fixtures=vm.runInNewContext(factory+'\n({storage,idb})',{assert,queueMicrotask,setTimeout});
const cp=process.env.CUSTODIAL_SOURCE_COMPOSITION_CLASSPATH;assert.ok(cp,'explicit main-owned source JVM classpath');
function native(mode,kind,relation,input){
 const r=spawnSync('/usr/bin/java',['-Xmx256m','-cp',cp,'org.memphiszoo.custodial.vault.NativeBrowserCompletionCompositionProbe',mode,kind,relation],
  {input,encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim());
}
const outcomes=[];
for(const [kind,relation]of [['v2','before'],['v3','before'],['v3','equal'],['v3','after']]){
 const args=native('fixture',kind,relation),operation='50000000-0000-4000-8000-000000000099';
 const row={id:1,type:'forward-replay-fenced:commit_workflow',forward_action_type:'commit_workflow',forward_replay_contract:'scan.v4.snapshot-bound-authority',
  schema_version:6,operation_id:operation,completion_client_id:args.p_client_completion_id,payload:structuredClone(args)};
 const definitions={mz_scan_queue:{version:4,stores:{actions:[{key:1,value:row}]}},mz_scan_completion_drafts:{version:1,stores:{drafts:[]}}};
 const storage=fixtures.storage({'mz_pending:unknown':'unparseable retained original {'}),db=fixtures.idb(definitions);
 const before=JSON.stringify(definitions),capture=await captureProtectedBrowserWork({storage,indexedDb:db,cryptoApi:webcrypto,timeoutMs:500});
 try{
  const candidate=await inspectCapturedOriginalCompletion(capture,{deviceId:args.p_device_id,clientSessionId:args.p_client_session_id,clientCompletionId:args.p_client_completion_id,timeoutMs:500});
  assert.equal(candidate.state,'ONE_ORIGINAL_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED');assert.equal(candidate.queue_operation_id,operation);
  for(const field of ['native_authority','source_authenticated','frozen','acknowledged','work_accepted','key_removal','phone_released'])assert.equal(candidate[field],false);
  const bytes=await readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs:500});
  try{
   const result=native('observe',kind,relation,Buffer.from(bytes));
   assert.equal(result.argument_sha256,createHash('sha256').update(bytes).digest('hex'));
   assert.equal(result.original_completion_signature_matches,true);assert.equal(result.native_session_values_match,true);
   assert.equal(result.start_cutoff_relation,'BEFORE');assert.equal(result.finish_cutoff_relation,relation.toUpperCase());
   for(const field of ['browser_source_authenticated','historical_snapshot_principal_verified','clock_profile_qualified','cutoff_eligible','current_server_readback',
    'work_accepted','inventory_acknowledged','key_removal','phone_released'])assert.equal(result[field],false);
   for(const field of ['receipt_binding_sha256','occurrence_sha256','finish_sha256'])assert.match(result[field],/^[a-f0-9]{64}$/);
   assert.ok(!JSON.stringify(candidate).includes('services_performed'));assert.ok(!JSON.stringify(result).includes('Full cleaning services'));
   assert.equal(JSON.stringify(definitions),before);outcomes.push({case:kind+'-'+relation,status:'PASS',all_acceptance_authority:false});
  }finally{bytes.fill(0);}
 }finally{closeCapturedProtectedBrowserWork(capture);assert.equal(db.state.opens,db.state.closes);assert.equal(db.state.created,0);assert.ok(db.state.modes.every(m=>m==='readonly'));}
 console.log('PASS NEW semantic composition '+kind+' '+relation);
}
console.log(JSON.stringify({schema:'custodial.native-browser-semantic-source-composition.v1',new_groups:outcomes.length,failed:0,skipped:0,outcomes,
 scope:'ACTUAL_ESM_CAPTURE_CAPABILITY_TO_ACTUAL_ORIGINAL_HMAC_FROZEN_NATIVE_ENCRYPTED_SESSION_DECODER_OVER_MEMORY_STDIN_SYNTHETIC_ONLY',
 previous_unit_groups_not_rerun:true,real_browser_native_SQL_freeze_semantic_inventory_ACK_key_removal_or_physical_acceptance:false}));
