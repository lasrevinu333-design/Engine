import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withoutLocalProviderLifecycle, assertLocalProviderBoundary} from './provider-local-owner-source-boundary.mjs';
import {withoutReadinessObservation} from './native-readiness-source-boundary.mjs';
import {withoutRemovalTransport} from './native-removal-source-boundary.mjs';
import {assertNativeBaseline} from './native-source-baselines.mjs';
import {withoutProviderInterval} from './provider-interval-source-boundary.mjs';
import {withoutProviderComposition} from './provider-composition-source-boundary.mjs';

const base = '02fbd55569565b98763283d10426136f7863d4e4';
const directory = 'mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read = name => readFileSync(directory + name, 'utf8');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const runtime = read('CustodialNativeRuntime.java'), plugin = read('CustodialNativeVaultPlugin.java');
assertLocalProviderBoundary(runtime); checks++;
assertNativeBaseline(base, directory+'CustodialNativeVaultPlugin.java', withoutLocalProviderLifecycle(plugin)); checks++;
for (const name of ['VaultEngine.java', 'RemovalCoordinator.java', 'NativeProviderJournal.java', 'OfflineAuthorityTime.java',
  'AndroidOfflineAuthorityTimeStore.java', 'NativeNfcScanHandoff.java', 'NativeNfcScanAuthority.java', 'NativeProviderClaims.java']) {
  const normalized=withoutReadinessObservation(name,withoutProviderInterval(name,read(name)));
  assertNativeBaseline(base,directory+name,name==='VaultEngine.java'?withoutRemovalTransport(normalized):normalized,name==='VaultEngine.java'?'removal':'raw'); checks++;
}
for (const change of [
  runtime.replace('this.application = application;', 'this.application = application; new AndroidProviderStore(application);'),
  runtime.replace('localProviderOwner == null && AndroidProviderStore.hasRetainedState(application)', 'localProviderOwner == null'),
  runtime.replace('owner.reconcile(); // This exact durable fence may NEVER be ignored.', '/* fence omitted */'),
  runtime + '\n new NativeProviderRegistrationCoordinator();',
]) { assert.throws(() => assertLocalProviderBoundary(change)); checks++; }
const unsafePlugin = plugin.replace('return CustodialNavigationPolicy.shouldBlock(url == null ? null : url.toString());', 'return false;');
assert.throws(()=>assertNativeBaseline(base,directory+'CustodialNativeVaultPlugin.java',withoutLocalProviderLifecycle(unsafePlugin))); checks++;
const removal = read('NativeProviderRemovalCoordinator.java');
check(/fence\.reconcile\(\);\s*return engine\.finalizeRemoval\(operationId\)/.test(removal), 'durable fence precedes enrollment-only key deletion');
check(/finally \{ reconcileFinally\(original\); \}/.test(removal) && /original\.addSuppressed\(failure\)/.test(removal), 'every result retains its original failure and final reconciliation');
const local = withoutProviderComposition('NativeProviderRuntimeOwner.java',read('NativeProviderRuntimeOwner.java'));
check(/synchronized \(engine\) \{ synchronized \(coordinator\)/.test(local), 'one explicit engine-before-provider lock order');
check(/reconcileLocked\(\); display\.cancelPending\(32\)/.test(local), 'bounded exact cleanup only after identity reconciliation');
check(!/\.display\(|\.applyPresentationAction\(|\.register\(|\.send\(|\.captureToken\(|Instant|currentTimeMillis|providerObservation/.test(local), 'local lifecycle cannot admit time or create provider effects');
check(/value\.put\("state", "SUSPENDED"\)/.test(local), 'local owner never reports qualified readiness');
check(/authority\.reconcile\(\)/.test(read('NativeProviderRegistrationCoordinator.java')), 'registration uses same authority interpretation');
check(/Thread\.holdsLock\(engine\)/.test(read('NativeProviderAuthority.java')) && /Thread\.holdsLock\(coordinator\)/.test(read('NativeProviderAuthority.java')), 'shared authority requires both owners');
const presence = read('AndroidProviderStore.java').match(/static boolean hasRetainedState\([^]*?\n    \}/)?.[0];
check(Boolean(presence) && /getAll\(\)\.isEmpty\(\)/.test(presence) && !/\.edit\(|\.commit\(|new AndroidProviderCipher/.test(presence), 'presence is namespace read only, never key recreation');
console.log(JSON.stringify({status:'PROVIDER_LOCAL_OWNER_SOURCE_CONTRACT_PASS',checks,base,
  limits:'Original retained-state/removal scope preserved outside separately hash-pinned conditional composition. Qualification, production activation and in-app bridge remain absent.'}));
