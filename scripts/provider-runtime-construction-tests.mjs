import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {assertLocalProviderBoundary} from './provider-local-owner-source-boundary.mjs';
const main = new URL('../mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/', import.meta.url);
const read = name => readFileSync(new URL(name,main),'utf8');
const runtime = read('CustodialNativeRuntime.java'), plugin = read('CustodialNativeVaultPlugin.java'), receiver = read('AssignedDeviceActivationReceiver.java');
const engineConstructors = readdirSync(main).filter(name=>name.endsWith('.java') && /new VaultEngine\(/.test(read(name)));
assert.deepEqual(engineConstructors,['CustodialNativeRuntime.java'],'one production engine construction, not parallel enrollment owners');
assert.match(runtime,/static synchronized CustodialNativeRuntime get\(Context context\)/);
assert.match(runtime,/new CustodialNativeRuntime\(context\.getApplicationContext\(\)\)/);
assert.doesNotMatch(runtime,/import .*Activity|PluginCall|PluginMethod|getActivity\(|destroyKey\(|finalizeRemoval\(/);
for(const source of [plugin,receiver]) assert.match(source,/CustodialNativeRuntime\.get\(/);
assert.match(plugin,/engine = runtime\.engine;[\s\S]*offlineAuthorityStore = runtime\.offlineStore;[\s\S]*offlineAuthorityTime = runtime\.offlineTime;/);
assert.match(receiver,/VaultEngine engine = runtime\.engine;[\s\S]*AndroidOfflineAuthorityTimeStore protectedStore = runtime\.offlineStore;/);
for(const gate of ['AndroidCancellationAuthorizationGate','AndroidRemovalAuthorizationGate']) assert.ok(plugin.includes(`new ${gate}(this::getActivity)`));
assert.match(plugin,/if \(engine != null && cancellation != null && removal != null\) return;/,'retain injected managed-emulator constructor seam');
assert.match(plugin,/initializeScanJournal\(\);\s*resolveScanJournalAfterManagerRecoveryIfEligible\(\);/,'preserve existing scan initialization order');
assert.match(runtime,/synchronized \(engine\)[\s\S]*engine\.getState\(\)[\s\S]*engine\.readLegacyPrincipal\(legacyJournal\) : principalJournal\.readFor\(state\)/);
// The retained-state owner may open its existing namespace after explicit
// lifecycle reconciliation, never while constructing the cleaning runtime.
// Validate the whole runtime through the exact pinned delta boundary first;
// narrowing the startup check must not admit arbitrary deferred source bytes.
assertLocalProviderBoundary(runtime);
function assertColdConstruction(source) {
 const start=source.indexOf('    private CustodialNativeRuntime(Context application) {');
 const end=source.indexOf('    NativeProviderPrincipal readProviderPrincipal()',start);
 assert.ok(start>=0 && end>start,'exact constructor and following reader delimiters exist');
 const startup=source.slice(0,end);
 assert.doesNotMatch(startup,/new NativeProviderJournal|new AndroidProviderStore|AndroidProviderCipher|final NativeProviderJournal|localOwner\s*\(|attachProviderLocal\s*\(|reconcileProviderFence\s*\(/,
  'cleaning fields and constructor never open or call the retained provider owner');
 assert.doesNotMatch(startup,/new Thread|Executor|\.start\(|\.notify\(|\.recordArrival\(|\.observeRemoved\(/,
  'cleaning construction cannot dispatch or mutate provider authority');
}
assertColdConstruction(runtime);
for(const inserted of ['new NativeProviderJournal(null, null);','new AndroidProviderStore(application);',
 'new AndroidProviderCipher(application);','localOwner();','attachProviderLocal(this);',
 'reconcileProviderFence();','new Thread().start();','executor.notify();']) {
 const changed=runtime.replace('this.application = application;',`this.application = application; ${inserted}`);
 assert.notEqual(changed,runtime,'constructor mutation actually applied');
 assert.throws(()=>assertColdConstruction(changed),'startup safety guard rejects '+inserted);
}
assert.throws(()=>assertColdConstruction(runtime.replace('    private CustodialNativeRuntime(Context application) {','    private ChangedRuntime(Context application) {')),
 'missing delimiter cannot make an empty slice pass');
assert.throws(()=>assertLocalProviderBoundary(runtime.replace('localProviderOwner == null && AndroidProviderStore.hasRetainedState(application)','localProviderOwner == null')),
 'retained-state guard remains mandatory outside construction');
assert.doesNotMatch(runtime,/new Thread|Executor|\.start\(|\.notify\(|\.recordArrival\(|\.observeRemoved\(/,'construction cannot dispatch/mutate provider authority');
console.log('PROVIDER_RUNTIME_CONSTRUCTION_SOURCE_CONTRACT_PASS (10 hostile startup/retained-state cases; source structure, not Android process proof)');
