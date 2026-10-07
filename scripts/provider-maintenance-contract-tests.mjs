import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {providerMaintenancePins as pins,withoutProviderMaintenance} from './provider-maintenance-source-boundary.mjs';
import {withoutProviderClassification} from './provider-classification-source-boundary.mjs';
import './provider-classification-contract-tests.mjs';
import {withoutProviderEventDecisions} from './provider-event-decisions-source-boundary.mjs';
const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read=name=>withoutProviderEventDecisions(name,readFileSync(dir+name,'utf8')),sha=v=>createHash('sha256').update(v).digest('hex');let checks=0;
for(const row of pins.files){
 const source=withoutProviderClassification(row.name,readFileSync(row.path,'utf8'));assert.equal(sha(source),row.current_sha256);checks++;
 if(row.origin){assert.equal(sha(withoutProviderMaintenance(row.name,source)),row.base_sha256);checks++;
  assert.throws(()=>withoutProviderMaintenance(row.name,source+'\n// unowned change'));checks++;}
}
for(const name of ['VaultEngine.java','OfflineAuthorityTime.java','NativeNfcScanHandoff.java','CustodialNativeVaultPlugin.java','CustodialNativeRuntime.java']){
 assert.equal(sha(read(name)),pins.preserved[name],'whole protected source unchanged: '+name);checks++;
}
assert.equal(sha(readFileSync('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml')),pins.preserved.manifest);checks++;
const journal=read('NativeProviderJournal.java'),owner=read('NativeProviderRuntimeOwner.java'),failure=read('NativeProviderFailureDisposition.java');
const freshness=pins.files.find(row=>row.name==='NativeProviderJournal.java').action_freshness_delta;
assert.deepEqual(Object.keys(freshness).sort(),['added_lines','prior_sha256']);checks++;
assert.deepEqual(freshness.added_lines,[
 '                // PC02 gates a NEW action, not replay of an already durable original event.',
 '                requireLive(expected.payload, observation);',
]);checks++;
const freshnessText=freshness.added_lines.join('\n')+'\n';
assert.equal(sha(journal.replace(freshnessText,'')),freshness.prior_sha256);checks++;
assert.match(journal,/if \(!record.isNull\(action \+ "_event_id"\)\) return null;\s*\/\/ PC02 gates a NEW action, not replay of an already durable original event\.\s*requireLive\(expected.payload, observation\);\s*appendPresentationEvent/);checks++;
for(const mutant of [
 journal.replace(freshnessText,''),
 journal.replace('                requireLive(expected.payload, observation);\n',''),
 journal.replace(freshnessText,freshnessText+freshnessText),
 journal.replace('if (!record.isNull(action + "_event_id")) return null;','if (false) return null;'),
]){assert.throws(()=>withoutProviderMaintenance('NativeProviderJournal.java',mutant));checks++;}
const compact=s=>s.slice(s.indexOf('    int compactSettledRecords('),s.indexOf('    private static JSONObject requiredTombstone'));
assert.equal(sha(compact(journal)),pins.preserved.compaction_method_sha256,'every existing compaction predicate unchanged');checks++;
assert.match(owner,/cleanup=clock.observe\(\);\s*if\(cleanup.bounds!=null\)journal.compactSettledRecords\(current.principal,cleanup,16\)/);checks++;
assert.match(owner,/recordMaintenanceFailure\(current.principal,current.revision,maintenance,NativeProviderFailureDisposition.of\(failure\)\)/);checks++;
assert.match(owner,/failure.addSuppressed\(unavailable\)/);checks++;
assert.match(owner,/throw failure;\s*\} finally \{ synchronizing.set\(false\); publishMirrorHint\(\); \}/);checks++;
assert.match(journal,/!current.same\(expected.principal\)\|\|engineRevision!=expected.engineRevision/);checks++;
assert.match(journal,/number\(meta,"invalidation_epoch"\)!=expected.epoch\|\|!expected.binding.equals/);checks++;
assert.match(journal,/NATIVE_INVOCATION_ONLY/);checks++;
assert.doesNotMatch(failure,/REVOKED\(|ACCEPTED\(|SETTLED\(|JSONObject|response.status|401|403/);checks++;
assert.doesNotMatch(failure,/failure.getMessage\(|failure.toString\(/);checks++;
const runner=readFileSync('mobile/scripts/custodial-provider-storage-tests.mjs','utf8');
for(const name of ['NativeProviderMaintenanceTest','NativeProviderFailureDispositionTest']){assert.ok(runner.includes("tests.push('"+name+"')"));checks++;}
// Existing scope checks really execute with no Git or unpublished worker object DB.
const proof=execFileSync(process.execPath,['scripts/provider-mirror-contract-tests.mjs'],{encoding:'utf8',env:{...process.env,PATH:''},maxBuffer:1024*1024});
assert.match(proof,/PROVIDER_MIRROR_SOURCE_CONTRACT_PASS/);checks++;
console.log(JSON.stringify({status:'PROVIDER_MAINTENANCE_SOURCE_PASS',checks,base:pins.base,compactionPredicates:'byte-identical',remotePermanentDenial:'not supported by current response contract',factories:'SUSPENDED'}));
