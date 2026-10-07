import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {providerClassificationPins as pins,validateProviderClassificationPins,withoutProviderClassification} from './provider-classification-source-boundary.mjs';
import {withoutProviderRetainedSchedule} from './provider-retained-schedule-source-boundary.mjs';
import './provider-retained-schedule-contract-tests.mjs';
import {withoutProviderEventDecisions} from './provider-event-decisions-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
equal(pins.files.length,7,'six owning product files plus one separately recorded inherited guard correction');
equal(pins.files.filter(row=>row.origin.kind==='visible_card_classification').length,6,'six new classification paths only');
const inherited=pins.files.filter(row=>row.origin.kind==='inherited_capability_d743');
equal(inherited.map(row=>row.path),['mobile/src/custodial/bridge.js'],'only exact previously accepted capability source');
equal(inherited[0].origin,{kind:'inherited_capability_d743',base:'5749155796d4348368bf6608f39cba39de3ffb01',commit:'d743857db917f881f2e80523320c3bc02358144e',no_product_edit_in_classification:true},'distinct inherited provenance');
equal(inherited[0].prior_sha256,'429c336d07a481b9b548cf432e6fd1917ec24715d15b76fb9d1c9d8770b680f3','exact original bridge');
equal(inherited[0].current_sha256,'04195aaf8c725da5fba681e3e1604bf1b3941e256c4f30dd831a5218b1179188','exact accepted d743 bridge');
for(const row of pins.files){
 const current=withoutProviderRetainedSchedule(row.name,withoutProviderEventDecisions(row.name,readFileSync(row.path,'utf8')));equal(sha(current),row.current_sha256,'whole current owning source '+row.name);
 const prior=withoutProviderClassification(row.name,current);equal(sha(prior),row.prior_sha256,'whole original source '+row.name);
 equal(withoutProviderClassification(row.name,prior),prior,'exact prior normalization idempotent');
 for(const mutated of [current+'\n// hostile unowned delta',current.slice(1),current.replace(row.hunks[0].after[0],row.hunks[0].after[0]+' ')]){
  assert.throws(()=>withoutProviderClassification(row.name,mutated));checks++;
 }
}
for(const mutate of [p=>p.extra=true,p=>p.files.pop(),p=>p.files.push(p.files[0]),p=>p.files.reverse(),
 p=>p.files[0].hunks.push(p.files[0].hunks[0]),p=>p.files[0].hunks[0].after.push(''),
 p=>p.files[0].hunks[0].new_count++,p=>p.files[0].hunks[0].extra=true,p=>p.files[0].prior_sha256='0'.repeat(64)]){
 const p=structuredClone(pins);mutate(p);assert.throws(()=>validateProviderClassificationPins(p));checks++;
}
const java='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
for(const [name,hash] of Object.entries({
 'NativeProviderJournal.java':'8e5b6bb867c2521e6ecb5ec231a20ecb3bd0400a0b609edc852b6add83467b9d',
 'NativeProviderTime.java':'5a204909ebf751d76d08fc20ba2a9ff3d1e714c82b2cbc85c720f6c460999f73',
 'CustodialNativeRuntime.java':'c78871f54e2a85f06f90fa89685c0e7c11f88510e50e2ffd5af05fc2c117686c',
 'VaultEngine.java':'4b9c70608bcbd98fd5c26668f1202cf7fd8014c96c5319bba00f7c1cca8c72d5',
 'OfflineAuthorityTime.java':'0ae5be7fa6c106a900a81bcf75c30c8ae87332da248fb6dd9bc9dc36b534f407',
}))equal(sha(withoutProviderEventDecisions(name,readFileSync(java+name,'utf8'))),hash,'whole unaffected authority outside exact F6 delta '+name);
equal(sha(readFileSync('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml')),'5714fc43190e46dfe043749b8a5b9bf2903bed60cd2bc86ef2077875248c854a','no manifest activation');
const claims=readFileSync(java+'NativeProviderClaims.java','utf8'),mirror=readFileSync('mobile/src/custodial/provider-mirror.js','utf8');
assert.match(claims,/NativeProviderTime\.reached\(observation.bounds, payload.validUntil\)/);checks++;
assert.doesNotMatch(mirror,/Date\.now|new Date|localStorage|speechSynthesis|fetch\(/);checks++;
assert.match(mirror,/status.freshness!=='CURRENT'&&!status.navigation_pending/);checks++;
console.log(JSON.stringify({status:'PROVIDER_CLASSIFICATION_BOUNDARY_PASS',checks,scope:'exact current/prior byte restoration and hostile pins; no timing qualification or activation'}));
