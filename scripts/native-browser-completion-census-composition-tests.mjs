import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {captureProtectedBrowserWork,closeCapturedProtectedBrowserWork,inspectCapturedOriginalCompletionCensus,
 readCapturedOriginalCompletionCensusArguments} from '../mobile/src/custodial/protected-browser-inventory.js';
const source=fs.readFileSync(new URL('./protected-browser-inventory-tests.mjs',import.meta.url),'utf8');
const factory=source.slice(source.indexOf('function storage('),source.indexOf('const call='));
assert.ok(factory.startsWith('function storage(')&&factory.includes('function idb('));
const fixtures=vm.runInNewContext(factory+'\n({storage,idb})',{assert,queueMicrotask,setTimeout});
const cp=process.env.CUSTODIAL_CENSUS_COMPOSITION_CLASSPATH;assert.ok(cp,'explicit own compiled classpath');
function native(mode,list=[]) {
 const r=spawnSync('/usr/bin/java',['-Xmx256m','-cp',cp,'org.memphiszoo.custodial.vault.NativeBrowserCompletionCensusProbe',mode],
  {input:mode==='observe'?JSON.stringify({arguments_base64:list.map(v=>Buffer.from(v).toString('base64'))}):'',encoding:'utf8',timeout:8000,maxBuffer:1048576});
 assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim());
}
const args=native('fixture'),outcomes=[];
const row=(payload,id)=>({id,type:'commit_workflow',schema_version:6,operation_id:'70000000-0000-4000-8000-'+String(id).padStart(12,'0'),
 completion_client_id:payload.p_client_completion_id,payload:structuredClone(payload)});
for(const kind of['mixed-original-and-foreign','duplicate-legacy-original','changed-legacy-original']) {
 const first=structuredClone(args[0]),second=structuredClone(args[1]);
 if(kind==='changed-legacy-original')first.p_response_json.note='changed original answers';
 const rows=[{key:1,value:row(first,1)},{key:2,value:row(second,2)}];
 if(kind==='mixed-original-and-foreign'){const foreign=structuredClone(first);foreign.p_device_id='OTHER';rows.push({key:3,value:row(foreign,3)});}
 if(kind==='duplicate-legacy-original')rows.push({key:3,value:row(first,3)});
 const definitions={mz_scan_queue:{version:4,stores:{actions:rows}},unknown_original_domain:{version:1,stores:{old:[{key:'raw',value:new Uint8Array([1,2])}],empty:[]}}};
 const db=fixtures.idb(definitions),storage=fixtures.storage({'unknown-old-local':'retained original malformed {'}),before=JSON.stringify(definitions);
 const capture=await captureProtectedBrowserWork({storage,indexedDb:db,cryptoApi:webcrypto});
 let list=[];
 try {
  const census=await inspectCapturedOriginalCompletionCensus(capture);assert.equal(census.record_count,rows.length+2);
  assert.equal(census.argument_candidate_count,rows.length);assert.equal(census.unresolved_record_count,census.record_count);
  list=await readCapturedOriginalCompletionCensusArguments(capture,census);assert.equal(list.length,rows.length);
  const result=native('observe',list),matches=kind==='mixed-original-and-foreign'?2:1,unresolvedCandidates=kind==='duplicate-legacy-original'?2:1;
  assert.equal(result.matched_completion_count,matches);assert.equal(result.completion_joined_record_count,matches*3);
  assert.equal(result.argument_candidate_count,list.length);assert.equal(result.unresolved_argument_candidate_count,unresolvedCandidates);
  assert.equal(result.records.length,result.record_count);assert.ok(result.unresolved_record_count>0);
  assert.deepEqual(result.argument_candidates.map(v=>v.argument_values_sha256),list.map(v=>createHash('sha256').update(v).digest('hex')));
  for(const key of['browser_source_authenticated','complete_namespace_inventory','current_server_readback','cutoff_eligible','work_accepted',
   'inventory_acknowledged','key_removal','phone_released'])assert.equal(result[key],false);
  assert.equal(result.native_semantic_inventory_state,'UNKNOWN');assert.equal(result.browser_inventory_state,'UNKNOWN');
  assert.ok(!JSON.stringify(census).includes('services_performed'));assert.ok(!JSON.stringify(result).includes('services_performed'));
  assert.equal(JSON.stringify(definitions),before);
  outcomes.push({case:kind,status:'PASS',browser_whole_capture_rows:census.record_count,argument_rows:list.length,
   native_original_receipt_session_matches:matches,unresolved_candidates:unresolvedCandidates,all_acceptance_authority:false});
 }finally{for(const bytes of list)bytes.fill(0);closeCapturedProtectedBrowserWork(capture);
  assert.equal(db.state.opens,db.state.closes);assert.ok(db.state.modes.every(v=>v==='readonly'));assert.equal(db.state.created,0);}
 console.log('PASS NEW browser-to-native whole census '+kind);
}
console.log(JSON.stringify({schema:'custodial.browser-native-whole-census-source-composition.v1',new_groups:outcomes.length,failed:0,skipped:0,outcomes,
 scope:'ACTUAL_WHOLE_CAPTURE_PRIVATE_LIST_MEMORY_STDIN_TO_ACTUAL_ORIGINAL_NATIVE_HMAC_FROZEN_ENCRYPTED_V2_V3_SESSION_CENSUS_SYNTHETIC_ONLY',
 old_unchanged_groups_not_rerun:true,actual_browser_Android_SQL_runtime_fsync_all_namespace_semantics_ACK_key_or_physical:false}));
