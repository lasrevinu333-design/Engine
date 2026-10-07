import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {providerCompositionBytePins,withoutProviderComposition,assertNewProviderCompositionSource} from './provider-composition-source-boundary.mjs';
import {withoutProviderMirror} from './provider-mirror-source-boundary.mjs';

const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read=name=>withoutProviderMirror(name,readFileSync(dir+name,'utf8')),sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0;
for(const row of providerCompositionBytePins){
 const source=read(row.name);assert.equal(sha(source),row.current_sha256);checks++;
 if(row.origin){assert.equal(sha(withoutProviderComposition(row.name,source)),row.base_sha256);checks++;
  assert.throws(()=>withoutProviderComposition(row.name,source+'\n// unknown delta'));checks++;
 }else{assertNewProviderCompositionSource(row.name,source);assert.throws(()=>assertNewProviderCompositionSource(row.name,source+' '));checks+=2;}
}
for(const [name,hash] of Object.entries({
 'VaultEngine.java':'4b9c70608bcbd98fd5c26668f1202cf7fd8014c96c5319bba00f7c1cca8c72d5',
 'CustodialNativeVaultPlugin.java':'8e3aa9624443dc5944dc2e1c4d011575689eb8a78bf0f713ddbf6066b21045b8',
 'OfflineAuthorityTime.java':'0ae5be7fa6c106a900a81bcf75c30c8ae87332da248fb6dd9bc9dc36b534f407',
 'NativeNfcScanHandoff.java':'674d7abe36779a7341e16f63588b6452596db23348397287a991f1138991aa77',
})){assert.equal(sha(read(name)),hash,'unchanged entire cleaning/plugin/engine source '+name);checks++;}
assert.equal(sha(readFileSync('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml')),'5714fc43190e46dfe043749b8a5b9bf2903bed60cd2bc86ef2077875248c854a');checks++;
const runtime=read('CustodialNativeRuntime.java'),owner=read('NativeProviderRuntimeOwner.java'),journal=read('NativeProviderJournal.java'),claims=read('NativeProviderClaims.java');
for(const type of ['NativeProviderIngressRuntime','NativeProviderComponentRuntime']){assert.match(runtime,new RegExp('return '+type+'\\.SUSPENDED;'));checks++;}
assert.match(runtime,/new NativeProviderRuntimeOwner.Delivery\(NativeProviderTime.Profiles.NONE,/);checks++;
assert.match(runtime,/localProviderOwner == null && AndroidProviderStore.hasRetainedState\(application\)/);checks++;
const constructor=runtime.slice(runtime.indexOf('    private CustodialNativeRuntime('),runtime.indexOf('    NativeProviderPrincipal readProviderPrincipal('));
assert.doesNotMatch(constructor,/new AndroidProviderStore|new NativeProviderJournal|AndroidProviderTokenSource|\.schedule\(/);checks++;
assert.match(owner,/if\(!supportedProfile\(\)\)return NativeProviderJobLifecycle.Result.SUSPEND;\s*if\(invocation==null\)/);checks++;
assert.match(owner,/Thread.holdsLock\(engine\)\|\|Thread.holdsLock\(coordinator\).*custodial_provider_network_lock_held/);checks++;
assert.match(owner,/synchronizing.compareAndSet\(false,true\)/);assert.match(owner,/finally \{ synchronizing.set\(false\); \}/);checks+=2;
assert.doesNotMatch(owner,/new VaultEngine\s*\(|new NativeProviderJournal\s*\(|new Thread\s*\(|Executor|System\.currentTimeMillis\s*\(|\.cancelAll\s*\(|\.startForeground\s*\(/);checks++;
assert.match(owner,/engine.recoverNativeProviderInventory\(inventory,principals,legacy,journal,delivery.http,invocation.attempt,clock\)/);checks++;
assert.match(owner,/engine.sendNativeProviderEvents\(batch,principals,legacy,journal,delivery.http,invocation.attempt\)/);checks++;
assert.match(owner,/if\(!"opened".equals\(action.action\)\)NativeProviderJobSchedule.request/);checks++;
assert.match(owner,/if\(shown==8\)break/);assert.match(owner,/display.display\(current.principal,presentation,[^\n]+\)\)shown\+\+/);checks+=2;
assert.match(owner,/journal.drainQuarantine\(current.principal,id,clock.observe\(\)\)/);checks++;
assert.match(journal,/if\(quarantine.size\(\)>256\)throw corrupt\(\)/);checks++;
assert.match(journal,/\.put\("admission_ordinal", increment\(snapshot.revision\)\)/);checks++;
assert.match(journal,/ordinal == 0 \|\| ordinal > snapshot.revision \|\| ids.put\(ordinal,key.id\) != null/);checks++;
assert.match(journal,/custodial_provider_admission_order_unavailable/);checks++;
assert.match(claims,/audioOffered = !historical && "PENDING".equals\(record.getString\("audio_state"\)\)/);checks++;
assert.match(claims,/existing.audioOffered && !existing.audioCompleted\) return null/);checks++;
assert.doesNotMatch(claims,/\.put\("audio_state"/);checks++;
assert.match(read('AndroidProviderPlatform.java'),/Build.FINGERPRINT/);assert.doesNotMatch(read('AndroidProviderPlatform.java'),/new NativeProviderTime.Profile|System.currentTimeMillis|SharedPreferences|JSONObject/);checks+=2;
const java=readdirSync(dir).filter(n=>n.endsWith('.java')).map(read);
assert.equal(java.filter(s=>/new NativeProviderTime.Profile\(/.test(s)).length,0);checks++;
// Actual execution without Git proves all composed baseline guards remain portable.
for(const script of ['native-removal-contract-tests.mjs','provider-clock-contract-tests.mjs']){
 const output=execFileSync(process.execPath,['scripts/'+script],{encoding:'utf8',env:{...process.env,PATH:''}});
 assert.match(output,/PASS/);checks++;
}
console.log(JSON.stringify({status:'PROVIDER_CONDITIONAL_COMPOSITION_SOURCE_PASS',checks,base:'033596e4e76b391ee119aa89eb69f1cc17e35ebc',qualified:false,factories:'SUSPENDED',bridgeExported:'separately pinned finite mirror delta'}));
