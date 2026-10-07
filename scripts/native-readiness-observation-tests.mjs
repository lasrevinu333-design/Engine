import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {validateNativeReadinessObservation} from '../mobile/src/custodial/native-readiness-observation.js';
import {principalIdentity} from '../mobile/src/custodial/protected-principal.js';
import {withoutReadinessObservation} from './native-readiness-source-boundary.mjs';
import {withoutRemovalTransport} from './native-removal-source-boundary.mjs';
import {assertNativeBaseline} from './native-source-baselines.mjs';
import {withoutProviderInterval} from './provider-interval-source-boundary.mjs';
import {CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS} from '../mobile/scripts/verify-custodial-dex-semantics.mjs';
import {custodialNativeVaultSourceDigest} from '../mobile/scripts/custodial-native-vault-source.mjs';

let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const principal={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:id(1),credential_id:id(2),
 credential_operation_id:id(3),assignment_epoch:4,installation_seal:'original-fixture-seal-0001',enrolled_at:'2026-07-01T12:00:00.000Z'};
const identity=principalIdentity(principal);
const positive={schema:'custodial.phone-readiness-observation.v1',canonical_device_id:'KIOSK_08',principal_identity:identity,
 snapshot_id:'a'.repeat(64),observed_boot_count:7,observed_elapsed_realtime_ms:2000,pending_occurrences:false,unfinished_occurrence:false,
 rollback_fence_active:false,observation:'CONFIRMED',reason:'current_native_snapshot_observed',native_clock_continuity:'CONFIRMED',protected_work_admission:'CLEAR',read_only:true};
assert.deepEqual(validateNativeReadinessObservation(positive,'KIOSK_08',identity),positive);checks++;
check(Object.isFrozen(validateNativeReadinessObservation(positive,'KIOSK_08',identity)),'result immutable');
const bad=[{...positive,credential:'secret'}, {...positive,read_only:false}, {...positive,snapshot_id:null}, {...positive,principal_identity:null},
 {...positive,canonical_device_id:'KIOSK_09'}, {...positive,principal_identity:principalIdentity({...principal,assignment_epoch:5})},
 {...positive,reason:'invented'}, {...positive,observation:'READY'}, {...positive,observed_boot_count:-1}, {...positive,observed_elapsed_realtime_ms:NaN},
 {...positive,observed_elapsed_realtime_ms:Number.MAX_SAFE_INTEGER+1}, {...positive,observed_boot_count:null}, {...positive,pending_occurrences:null},
 {...positive,pending_occurrences:true}, {...positive,unfinished_occurrence:true}, {...positive,rollback_fence_active:true},
 {...positive,native_clock_continuity:'UNVERIFIED'}, {...positive,protected_work_admission:'PENDING'}, {...positive,reason:'original_finish_pending'}];
for(const value of bad){assert.throws(()=>validateNativeReadinessObservation(value,'KIOSK_08',identity),/observation_invalid/);checks++;}
const unknown={...positive,canonical_device_id:null,principal_identity:null,snapshot_id:null,observed_boot_count:null,observed_elapsed_realtime_ms:null,
 pending_occurrences:null,unfinished_occurrence:null,rollback_fence_active:null,observation:'UNKNOWN',reason:'observation_unavailable',native_clock_continuity:'UNVERIFIED',protected_work_admission:'UNKNOWN'};
assert.deepEqual(validateNativeReadinessObservation(unknown,'KIOSK_08',identity),unknown);checks++;
for(const field of Object.keys(positive)){const missing={...positive};delete missing[field];assert.throws(()=>validateNativeReadinessObservation(missing,'KIOSK_08',identity));checks++;}
const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
for(const name of ['VaultEngine.java','OfflineAuthorityTime.java','AndroidProtectedWorkPreferences.java','AndroidOfflineAuthorityTimeStore.java','CustodialNativeVaultPlugin.java']){
 const current=readFileSync(dir+name,'utf8'), normalized=withoutReadinessObservation(name,withoutProviderInterval(name,current));
 assertNativeBaseline('4ba67278a8758bb9e73dd063e6da163ea927eca5',dir+name,name==='VaultEngine.java'?withoutRemovalTransport(normalized):normalized,name==='VaultEngine.java'?'removal':'raw');checks++;
 assert.throws(()=>withoutReadinessObservation(name,current.replace(name==='VaultEngine.java'?'return publicState(persistence.load());':name==='OfflineAuthorityTime.java'?'return new OfflineAuthorityTime(frozen, clock);':name==='AndroidProtectedWorkPreferences.java'?'original.frozen == frozen()':name==='AndroidOfflineAuthorityTimeStore.java'?'original.frozen || uncertain':'if (!scanJournalReady ||',name==='CustodialNativeVaultPlugin.java'?'if (false ||':'UNSAFE_MUTATION')));checks++;
}
const observer=readFileSync(dir+'NativeReadinessObservation.java','utf8');
check(!/\.getState\(|\.requireActiveDevice\(|\.authorizeNewWork\(|\.acceptSnapshot\(|\.beginOccurrence\(|\.providerObservation\(|\.register\(|\.save[A-Z]|\.delete[A-Z]|\.commit\(|transport\./.test(observer),'observer never calls mutating authority/transport');
check(/snapshot\.stable\.unchanged\(\)/.test(observer)&&/Snapshot latest=source\.capture\(\)/.test(observer),'full snapshot and current principal rechecked');
const plugin=readFileSync(dir+'CustodialNativeVaultPlugin.java','utf8');
assert.deepEqual([...plugin.matchAll(/@PluginMethod\s+public void (\w+)\s*\(/g)].map(m=>m[1]).sort(),CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS);checks++;
const schema=JSON.parse(readFileSync('mobile/scripts/custodial-android-release-acceptance.schema.json','utf8'));
const arrays=[];const walk=o=>{if(!o||typeof o!=='object')return;if(o.plugin_method_names)arrays.push(o.plugin_method_names);for(const v of Object.values(o))walk(v);};walk(schema);
check(arrays.some(v=>v.minItems===36&&v.maxItems===36&&JSON.stringify(v.prefixItems.map(x=>x.const))===JSON.stringify(CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS)),'exact artifact allowlist includes additive provider methods, no wildcard');

// Execute actual additive wrapper. No status refresh or old mutating getter may
// be called as a diagnostic fallback; unsupported old binary remains rejected.
const security=readFileSync('mobile/src/custodial/native-security.js','utf8');
const method=security.match(/export async function getNativeCustodialReadinessObservation\([^]*?\n\}/)?.[0];check(Boolean(method),'actual wrapper present');
let native=true, calls=0, response=positive, request;
const api={getCustodialReadinessObservation:async args=>{calls++;request=args;return response;}};
const context={CustodialNativeVault:api,isCustodialNativeVaultPlatform:()=>native,securityError:code=>new Error(code),canonicalDeviceId:x=>x,validateNativeReadinessObservation};
vm.createContext(context);vm.runInContext(method.replace('export ',''),context);
assert.deepEqual(await context.getNativeCustodialReadinessObservation('KIOSK_08',identity),positive);checks++;
assert.equal(JSON.stringify(request),JSON.stringify({device_id:'KIOSK_08',expected_principal_identity:identity}));checks++;
response={...positive,pending_occurrences:true};await assert.rejects(context.getNativeCustodialReadinessObservation('KIOSK_08',identity),/observation_invalid/);checks++;
native=false;await assert.rejects(context.getNativeCustodialReadinessObservation('KIOSK_08',identity),/vault_required/);checks++;assert.equal(calls,2);checks++;
native=true;delete api.getCustodialReadinessObservation;await assert.rejects(context.getNativeCustodialReadinessObservation('KIOSK_08',identity),/capability_missing/);checks++;
// Exercise the ACTUAL canonical package, not just a synthetic digest fixture.
// Documentation stays outside its strict production-source entry whitelist.
const actualTreeDigest=custodialNativeVaultSourceDigest('mobile/plugins/custodial-native-vault');
check(/^[a-f0-9]{64}$/.test(actualTreeDigest),'actual package source admitted by unchanged strict digest');
for(const name of ['PROVIDER_CLOCK_TRANSPORT_STAGE.md','PROVIDER_EVENTS_STAGE.md','PROVIDER_LOCAL_OWNER_STAGE.md','PROVIDER_LOCATION_RESERVATION_STAGE.md','PROVIDER_REGISTRATION_STAGE.md']){
 const old='mobile/plugins/custodial-native-vault/'+name;
 assertNativeBaseline('4ba67278a8758bb9e73dd063e6da163ea927eca5',old,readFileSync('docs/native-provider/'+name,'utf8'));checks++;
 check(!existsSync(old),'only old misplaced documentation path removed: '+name);
}
console.log(JSON.stringify({status:'NATIVE_READONLY_READINESS_SOURCE_WIRE_PASS',checks,actualTreeDigest,limits:'Point-in-time observation only, no Start grant or whole Home/phone acceptance.'}));
