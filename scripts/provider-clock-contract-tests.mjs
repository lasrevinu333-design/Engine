import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {assertNativeBaseline} from './native-source-baselines.mjs';
import {withoutProviderInterval,assertNewProviderIntervalSource,providerIntervalBytePins} from './provider-interval-source-boundary.mjs';
// Historical208bab17 guard compared pre-receipt/pre-local-owner bytes and required
// the superseded point clock. Current accepted source includes those separately
// preserved deltas; this guard now proves exact PC01/PC02 changed-input scope.
const base='efe0cc3f0120e18c5e53f2c025a0ce0cfa1963cd';
const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read=name=>readFileSync(dir+name,'utf8');
let checks=0;
for(const name of ['VaultEngine.java','NativeProviderJournal.java','OfflineAuthorityTime.java','AndroidOfflineAuthorityTimeStore.java',
 'CustodialNativeRuntime.java','CustodialNativeVaultPlugin.java','NativeAttestation.java','RequestPolicy.java']){
 assertNativeBaseline(base,dir+name,withoutProviderInterval(name,read(name)));checks++;
}
for(const row of providerIntervalBytePins){
 if(row.origin)withoutProviderInterval(row.name,read(row.name));else assertNewProviderIntervalSource(row.name,read(row.name));checks++;
 const changed=read(row.name)+'\n// unreviewed change';
 if(row.origin)assert.throws(()=>withoutProviderInterval(row.name,changed));else assert.throws(()=>assertNewProviderIntervalSource(row.name,changed));checks++;
}
const http=read('NativeProviderHttp.java'),owner=read('NativeProviderRegistrationCoordinator.java'),clock=read('NativeProviderClockOwner.java');
assert.match(http,/Point before = readings\.read\(\);[\s\S]*connections\.open/);checks++;
assert.match(http,/received = read\(raw, attempt\); attempt\.check\(\);\s*NativeProviderClockExchange.Point after = readings\.read\(\)/);checks++;
assert.match(http,/String requestId = requestIds.next\(\)/);checks++;
assert.match(http,/https:\/\/memphis-zoo-mcp.onrender.com/);checks++;
assert.match(owner,/prepared.confirmed && !statusOnly/);checks++;
assert.match(owner,/received.bounds != null/);checks++;
assert.doesNotMatch(clock,/OfflineAuthorityTime|providerObservation\(|currentTimeMillis|Date\.|evaluateJavascript|SharedPreferences/);checks++;
assert.match(clock,/profiles.select\(platform\)/);checks++;
assert.match(read('NativeProviderTime.java'),/Profiles NONE = actual -> null/);checks++;
assert.doesNotMatch(read('OfflineAuthorityTime.java').match(/synchronized NativeProviderJournal.Observation providerObservation\([^]*?\n    \}/)?.[0]||'',/loadAnchor|loadRollbackFence|timestampAt|authorizeNewWork/);checks++;
assert.match(read('AndroidProviderClockReadings.java'),/Settings.Global.BOOT_COUNT/);checks++;
assert.match(read('AndroidProviderClockReadings.java'),/SystemClock.elapsedRealtime\(\)/);checks++;
const java=readdirSync(dir).filter(f=>f.endsWith('.java')).map(read);
assert.equal(java.filter(s=>/new NativeProviderRegistrationCoordinator\(/.test(s)).length,1);checks++;
assert.equal(java.filter(s=>/new NativeProviderClockOwner\(/.test(s)).length,1);checks++;
assert.match(read('NativeProviderRuntimeOwner.java'),/new NativeProviderClockOwner\(engine,coordinator,journal,principals,legacy,delivery.profiles/);checks++;
assert.match(read('CustodialNativeRuntime.java'),/new NativeProviderRuntimeOwner.Delivery\(NativeProviderTime.Profiles.NONE,/);checks++;
assert.equal(java.filter(s=>/new NativeProviderTime.Profile\(/.test(s)).length,0);checks++;
for(const factory of ['NativeProviderIngressRuntime','NativeProviderComponentRuntime']){assert.match(read('CustodialNativeRuntime.java'),new RegExp('return '+factory+'\\.SUSPENDED;'));checks++;}
console.log(JSON.stringify({status:'PROVIDER_CLOCK_SOURCE_CONTRACT_PASS',checks,base,qualified:false,productionMounted:false,delivery:false}));
