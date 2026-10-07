import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {withoutProviderRegistration} from './provider-clock-source-boundary.mjs';
import {assertLocalProviderBoundary} from './provider-local-owner-source-boundary.mjs';
import {withoutReadinessObservation} from './native-readiness-source-boundary.mjs';
import {assertNativeBaseline} from './native-source-baselines.mjs';
import {withoutProviderInterval} from './provider-interval-source-boundary.mjs';

// Changed-input SOURCE comparison against the admitted current NFC core, not
// the pre-core df36d323 historical snapshot. This cannot certify Android
// startup, preference I/O, class loading, real NFC or clock qualification.
const directory='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const base='bd0113e5be9567ab4d4220ad61603f7eac9cf487';
const read=name=>readFileSync(directory+name,'utf8');
// Immutable packet reviewers may supply its manifest-bound exact baseline;
// normal execution uses tracked hashes, not local-only historical Git objects.
const verify=(name,current,normalization='raw',normalize=x=>x)=>{
  assertNativeBaseline(base,directory+name,current,normalization);
  if(process.argv[2])assert.equal(current,normalize(readFileSync(join(process.argv[2],name),'utf8')));
};
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0;const comparisons=[];
function unchanged(name){
  const current=withoutReadinessObservation(name,withoutProviderInterval(name,read(name)));
  verify(name,current);checks++;
  comparisons.push({name,baseline_sha256:sha(current),current_sha256:sha(current)});
}
unchanged('OfflineAuthorityTime.java');
verify('VaultEngine.java',withoutProviderRegistration(read('VaultEngine.java')),'provider-registration-removal',withoutProviderRegistration); checks++;
unchanged('RequestPolicy.java');
const all=readdirSync(directory).filter(name=>name.endsWith('.java')).map(name=>[name,read(name)]);
for(const method of ['registerNativeProvider','sendNativeProviderEvents','recoverNativeProviderInventory']){
  const uses=all.flatMap(([name,source])=>[...source.matchAll(new RegExp('\\b'+method+'\\s*\\(','g'))].map(()=>name));
  const expected=method==='registerNativeProvider'?['NativeProviderRegistrationCoordinator.java','VaultEngine.java']:['NativeProviderRuntimeOwner.java','VaultEngine.java'];
  assert.deepEqual(uses,expected,'typed provider effects remain restricted to the deferred native owner: '+method);checks++;
}
const observationUsers=all.filter(([,source])=>/\.providerObservation\s*\(/.test(source)).map(([name])=>name);
assert.deepEqual(observationUsers,[],'retired cleaning point adapter has no provider consumer');checks++;
const manifest=readFileSync('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml','utf8');
assert.doesNotMatch(manifest,/MESSAGING_EVENT/,'provider ingress is not activated by component registration');checks++;
assert.match(read('CustodialNativeRuntime.java'), /static NativeProviderComponentRuntime providerComponents\(Context context\)\s*\{\s*return NativeProviderComponentRuntime\.SUSPENDED;\s*\}/,
  'registered components remain fail-closed without production provider authority');checks++;
assert.match(read('CustodialNativeRuntime.java'), /static NativeProviderIngressRuntime providerIngress\(Context context\)\s*\{\s*return NativeProviderIngressRuntime\.SUSPENDED;\s*\}/,
  'SDK ingress remains hard suspended');checks++;
assert.deepEqual(all.filter(([,source])=>/new NativeProviderRegistrationCoordinator\s*\(/.test(source)).map(([name])=>name),['NativeProviderRuntimeOwner.java'],
  'conditional registration is constructed only inside the single native owner');checks++;
assert.match(read('CustodialNativeRuntime.java'),/new NativeProviderRuntimeOwner.Delivery\(NativeProviderTime.Profiles.NONE,/,
  'conditional dependencies do not select a qualified production profile');checks++;
assertLocalProviderBoundary(read('CustodialNativeRuntime.java'));checks++;
for(const name of ['NativeCompletionJournal.java','AndroidOfflineAuthorityTimeStore.java','NativeNfcScanHandoff.java','NativeNfcScanAuthority.java']){
  verify(name,withoutReadinessObservation(name,read(name)));checks++;
}
console.log(JSON.stringify({status:'PASS_CLEANING_PROVIDER_SOURCE_ISOLATION',checks,baseline:base,comparisons,
  limits:'source comparison only; shared runtime constructor and Android/manifest merger behavior still require review and runtime proof'},null,2));
