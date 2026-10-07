import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withoutProviderRegistration } from './provider-clock-source-boundary.mjs';
import { withoutLocalProviderLifecycle, assertLocalProviderBoundary } from './provider-local-owner-source-boundary.mjs';
import {withoutReadinessObservation} from './native-readiness-source-boundary.mjs';
import {assertNativeBaseline} from './native-source-baselines.mjs';
import {withoutProviderInterval} from './provider-interval-source-boundary.mjs';

// Owning source wiring and exact current-base preservation; not Android dispatch proof.
const base = 'bd0113e5be9567ab4d4220ad61603f7eac9cf487';
const directory = 'mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read = (name) => readFileSync(directory + name, 'utf8');
for (const name of ['OfflineAuthorityTime.java', 'AndroidOfflineAuthorityTimeStore.java',
  'NativeCompletionJournal.java', 'NativeNfcScanHandoff.java', 'NativeNfcScanAuthority.java',
  'NativeProviderJobLifecycle.java', 'CustodialNativeVaultPlugin.java']) {
  const normalize = name === 'CustodialNativeVaultPlugin.java' ? withoutLocalProviderLifecycle : source => withoutReadinessObservation(name,withoutProviderInterval(name,source));
  assertNativeBaseline(base,directory+name,normalize(read(name)));
}
assertNativeBaseline(base,directory+'VaultEngine.java',withoutProviderRegistration(read('VaultEngine.java')),'provider-registration-removal');
const runtime = read('CustodialNativeRuntime.java');
assert.match(runtime, /static NativeProviderComponentRuntime providerComponents\(Context context\)\s*\{\s*return NativeProviderComponentRuntime\.SUSPENDED;\s*\}/);
assertLocalProviderBoundary(runtime);
const service = read('CustodialProviderSyncJobService.java');
assert.match(service, /extends JobService/);
assert.match(service, /lifecycle\.begin\(parameters, SystemClock::elapsedRealtime\)/);
assert.match(service, /parameters\.getJobId\(\) != NativeProviderJobSchedule\.ID/);
assert.match(service, /lifecycle\.stop\(run\.parameters,/);
assert.match(service, /postDelayed\(run\.deadline, NativeProviderJobBudget\.MAX_MILLIS\)/);
assert.match(service, /run\.future\.cancel\(true\)/);
assert.match(service, /run\.executor\.shutdownNow\(\)/);
assert.match(service, /main\.post\(\(\) -> lifecycle\.complete\(invocation, completion\)\)/);
assert.match(service, /lifecycle\.destroy\(\)/);
assert.doesNotMatch(service, /startActivity|startForeground|sendNativeProviderEvents|registerNativeProvider/);
const activity = read('ProviderNotificationOpenActivity.java');
assert.match(activity, /runtime\.applyAction\(action\);[\s\S]*runtime\.openCommitted\(action,/);
assert.match(activity, /setClassName\(this, NativeProviderActionIntent\.PACKAGE \+ "\.MainActivity"\)/);
assert.doesNotMatch(activity, /setData|putExtra|ACTION_VIEW|startLockTask|stopLockTask|NEW_TASK|CLEAR_TASK/);
const receiver = read('ProviderNotificationActionReceiver.java');
assert.match(receiver, /AndroidProviderActionIntent\.read\(context, intent, false\)/);
assert.match(receiver, /goAsync\(\)/);
assert.match(receiver, /finally \{ pending\.finish\(\); \}/);
assert.doesNotMatch(receiver, /startActivity|startService|startForeground|NotificationManager|NativeProviderHttp/);
const manifest = readFileSync('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml', 'utf8');
for (const [type, name] of [['activity', 'ProviderNotificationOpenActivity'], ['service', 'CustodialProviderSyncJobService'], ['receiver', 'ProviderNotificationActionReceiver']]) {
  const tag = manifest.match(new RegExp(`<${type}\\s+android:name="org\\.memphiszoo\\.custodial\\.vault\\.${name}"[^>]*?/>`))?.[0];
  assert.ok(tag, name); assert.match(tag, /android:exported="false"/);
  if (type === 'service') assert.match(tag, /android:permission="android\.permission\.BIND_JOB_SERVICE"/);
}
console.log('PROVIDER_COMPONENT_SOURCE_CONTRACT_PASS; 6 original native owners byte-identical and plugin exact outside approved local lifecycle against ' + base + '; engine outside owned registration exact; no effect activation');
