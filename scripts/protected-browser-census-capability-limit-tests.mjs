import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {captureProtectedBrowserWork,closeCapturedProtectedBrowserWork,inspectCapturedOriginalCompletionCensus,
 readCapturedOriginalCompletionCensusArguments} from '../mobile/src/custodial/protected-browser-inventory.js';
const source=fs.readFileSync(new URL('./protected-browser-inventory-tests.mjs',import.meta.url),'utf8');
const factory=source.slice(source.indexOf('function storage('),source.indexOf('const call='));
assert.ok(factory.startsWith('function storage(')&&factory.includes('function idb('));
const fixtures=vm.runInNewContext(factory+'\n({storage,idb})',{assert,queueMicrotask,setTimeout});
const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
const args={p_device_id:'KIOSK_08',p_client_session_id:id(1),p_client_completion_id:id(2),p_native_finish_scan_entry_id:id(3),original:'PRIVATE synthetic'};
function definitions(){return{mz_scan_queue:{version:6,stores:{actions:[{key:1,value:{id:1,type:'commit_workflow',schema_version:6,
 operation_id:id(4),completion_client_id:id(2),payload:structuredClone(args)}}]}}};}
async function read(c,r){const values=await readCapturedOriginalCompletionCensusArguments(c,r);try{assert.equal(values.length,1);
 assert.deepEqual(JSON.parse(new TextDecoder().decode(values[0])),args);}finally{values.forEach(v=>v.fill(0));}}
const outcomes=[];
for(const kind of['sequential-retention-limit','concurrent-publication-limit']) {
 const db=fixtures.idb(definitions()),storage=fixtures.storage({});let armed=false,waiting=[];
 const cryptoApi={subtle:{async digest(...values){if(armed){await new Promise(resolve=>{waiting.push(resolve);if(waiting.length===2){armed=false;waiting.forEach(v=>v());}});}
  return webcrypto.subtle.digest(...values);}}};
 const c=await captureProtectedBrowserWork({storage,indexedDb:db,cryptoApi});
 try {
  if(kind==='sequential-retention-limit'){const r=await inspectCapturedOriginalCompletionCensus(c);
   await assert.rejects(inspectCapturedOriginalCompletionCensus(c),/census_already_retained/);await read(c,r);}
  else {armed=true;const results=await Promise.allSettled([inspectCapturedOriginalCompletionCensus(c),inspectCapturedOriginalCompletionCensus(c)]);
   assert.equal(results.filter(v=>v.status==='fulfilled').length,1);const rejected=results.find(v=>v.status==='rejected');
   assert.match(rejected.reason.message,/census_already_retained/);await read(c,results.find(v=>v.status==='fulfilled').value);}
  outcomes.push({case:kind,status:'PASS',maximum_private_censuses_per_capture:1,all_acceptance_authority:false});
 }finally{closeCapturedProtectedBrowserWork(c);assert.equal(db.state.opens,db.state.closes);assert.ok(db.state.modes.every(v=>v==='readonly'));assert.equal(db.state.created,0);}
 console.log('PASS NEW browser census capability '+kind);
}
console.log(JSON.stringify({schema:'custodial.browser-census-private-retention-guard-source-proof.v1',new_guard_groups:outcomes.length,failed:0,skipped:0,outcomes,
 prior_19_browser_and3_native_composition_groups_not_rerun:true,real_browser_all_realm_durable_freeze_ABA_SQL_native_runtime_or_semantic_ACK_key_or_phone:false}));
