import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

// Changed-input SOURCE comparison only. This cannot certify Android startup,
// preference I/O, class loading, real NFC or physical clock qualification.
const directory='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const base='df36d32368b6f0ecf5e2e04f433ba2d831ff3053';
const read=name=>readFileSync(directory+name,'utf8');
// Immutable packet reviewers may supply its manifest-bound exact baseline;
// normal repository execution reads the same frozen commit directly.
const prior=name=>process.argv[2] ? readFileSync(join(process.argv[2],name),'utf8')
  : execFileSync('git',['show',base+':'+directory+name],{encoding:'utf8'});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0;const comparisons=[];
function unchangedAfterRemovingAddition(name,from,to){
  const current=read(name),before=prior(name),start=current.indexOf(from),end=current.indexOf(to,start);
  assert.ok(start>=0&&end>start,'exact addition delimiters '+name);checks++;
  assert.equal(current.slice(0,start)+current.slice(end),before,'ALL earlier code byte-identical outside provider addition '+name);checks++;
  comparisons.push({name,baseline_sha256:sha(before),current_sha256:sha(current),removed_addition_sha256:sha(current.slice(start,end))});
}
unchangedAfterRemovingAddition('OfflineAuthorityTime.java','    /** Read-only provider clock observation.','    synchronized void authorizeNewWork(');
unchangedAfterRemovingAddition('VaultEngine.java','    /** Internal typed provider registration/status,','    synchronized Map<String, Object> attestOfflineStart(');
unchangedAfterRemovingAddition('RequestPolicy.java','        // Native-only provider operations','        if (CREDENTIAL_MANAGEMENT_PREFIXES');
const all=readdirSync(directory).filter(name=>name.endsWith('.java')).map(name=>[name,read(name)]);
for(const method of ['registerNativeProvider','sendNativeProviderEvents','recoverNativeProviderInventory']){
  const uses=all.flatMap(([name,source])=>[...source.matchAll(new RegExp('\\b'+method+'\\s*\\(','g'))].map(()=>name));
  assert.deepEqual(uses,['VaultEngine.java'],'new provider effect has no production caller: '+method);checks++;
}
const observationUsers=all.filter(([,source])=>/\.providerObservation\s*\(/.test(source)).map(([name])=>name);
assert.deepEqual(observationUsers,['VaultEngine.java'],'provider observation is reached only by uncalled provider method');checks++;
const manifest=readFileSync('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml','utf8');
assert.doesNotMatch(manifest,/NativeProvider|JobService|MESSAGING_EVENT/,'new provider service is not registered by the vault manifest');checks++;
assert.doesNotMatch(read('CustodialNativeRuntime.java'),/new AndroidProviderStore|new NativeProviderJournal|AndroidProviderCipher/,
  'cleaning startup must not access the deferred provider preference/key namespace');checks++;
for(const name of ['NativeCompletionJournal.java','AndroidOfflineAuthorityTimeStore.java','NativeNfcScanHandoff.java','NativeNfcScanAuthority.java']){
  assert.equal(read(name),prior(name),'existing physical handoff/receipt/store implementation unchanged '+name);checks++;
}
console.log(JSON.stringify({status:'PASS_CLEANING_PROVIDER_SOURCE_ISOLATION',checks,baseline:base,comparisons,
  limits:'source comparison only; shared runtime constructor and Android/manifest merger behavior still require review and runtime proof'},null,2));
