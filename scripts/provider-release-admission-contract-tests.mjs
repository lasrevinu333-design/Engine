import assert from 'node:assert/strict';
import './provider-sdk-registration-contract-tests.mjs';
import {withoutSdkRegistration} from './provider-sdk-registration-source-boundary.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {releaseAdmissionPins as pins,validateReleaseAdmissionPins,withoutReleaseAdmission} from './provider-release-admission-source-boundary.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const read=path=>withoutSdkRegistration(path,readFileSync(new URL('../'+path,import.meta.url),'utf8'));
let checks=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
equal(pins.base,'dffd34ca2691a0a6fc7d2fa6bda8387c55328beb','exact393 consumer predecessor');
equal(pins.production_profile,false,'no manufactured release admission');
equal(pins.files.map(r=>r.name),['CustodialNativeRuntime.java','NativeProviderCompositionTest.java'],'one existing runtime and one actually invoked test owner');
for(const row of pins.files){
 const current=read(row.path),prior=withoutReleaseAdmission(row.name,current);
 equal(sha(current),row.current_sha256,'whole current source');equal(sha(prior),row.prior_sha256,'every original byte restored');
 equal(withoutReleaseAdmission(row.name,prior),prior,'exact prior idempotent');
 for(const hostile of [current+'\n// extra',current.slice(1),current.replace(row.hunks[0].after[0],row.hunks[0].after[0]+' '),prior+' ']){
  assert.throws(()=>withoutReleaseAdmission(row.name,hostile));checks++;
 }
}
for(const mutate of [p=>p.extra=true,p=>p.production_profile=true,p=>p.files.pop(),p=>p.files.reverse(),p=>p.files.push(p.files[0]),
 p=>p.files[0].current_sha256='0'.repeat(64),p=>p.files[0].hunks[0].old_count++,p=>p.files[0].hunks[0].after.push(''),p=>p.pinned.pop()]){
 const hostile=structuredClone(pins);mutate(hostile);assert.throws(()=>validateReleaseAdmissionPins(hostile));checks++;
}
equal(pins.pinned.length,1,'one new immutable compiled admission class');
for(const row of pins.pinned)equal(sha(read(row.path)),row.sha256,'compiled source exact');
const runtime=read(pins.files[0].path),admission=read(pins.pinned[0].path),test=read(pins.files[1].path);
function route(source){
 assert.match(source,/Selected admitted = qualifiedRelease\(context\);[\s\S]*NativeProviderReleaseAdmission.open\(admitted, profiles -> \{\s*CustodialNativeRuntime runtime = get\(context\);/);
 for(const type of ['NativeProviderComponentRuntime','NativeProviderIngressRuntime'])
  assert.match(source,new RegExp('return owner == null \\? '+type+'\\.SUSPENDED : owner;'));
 assert.match(source,/if \(!NativeProviderReleaseAdmission.hasCompiledInputs\(\)\) return null;/);
 assert.match(source,/compiled\(AndroidProviderPlatform.read\(\), AndroidProviderAppIdentity.read\(context\)\)/);
 assert.match(source,/synchronized \(runtime.engine\) \{ synchronized \(runtime.providerCoordinator\)/);
 assert.match(source,/localProviderOwner == null && \(admitted \|\| AndroidProviderStore.hasRetainedState\(application\)\)/);
}
route(runtime);checks++;
assert.throws(()=>route(withoutReleaseAdmission('CustodialNativeRuntime.java',runtime)));checks++; // actual predecessor fail-before source route
for(const mutate of [s=>s.replace('get(context)','get(null)'),s=>s.replace('profiles -> {','profiles -> { unsafe();'),
 s=>s.replace('if (!NativeProviderReleaseAdmission.hasCompiledInputs()) return null;',''),
 s=>s.replace('admitted || AndroidProviderStore.hasRetainedState(application)','true')]){
 assert.throws(()=>withoutReleaseAdmission('CustodialNativeRuntime.java',mutate(runtime)));checks++;
}
assert.match(admission,/private static final Release\[\] REVIEWED_RELEASES = new Release\[0\];/);checks++;
assert.match(admission,/if \(selected == null\) return null;[\s\S]*factory.create\(selected.profiles\(\)\)/);checks++;
assert.match(admission,/app.versionCode == versionCode && app.versionName.equals\(versionName\)/);checks++;
assert.match(admission,/profile.matches\(platform\)/);checks++;
assert.match(admission,/if \(match != null\) return null;/);checks++;
assert.doesNotMatch(admission,/System.getenv|SharedPreferences|JSONObject|PluginMethod|setAccessible|Class.forName|https?:\/\//);checks++;
assert.doesNotMatch(admission,/new NativeProviderTime.Profile\(/);checks++;
for(const method of ['missingWrongAmbiguousOrUnpackagedInputsNeverConstructOwner','immutableSelectedProfileDoesNotFollowCallerArrayAndStillChecksActualPlatform',
 'selectedFixtureOwnsActualIngressInventoryMirrorAndOriginalOpenAckForBothRequiredKinds','absentProfileOwnerRefusesRequiredIngressWithoutStoreNetworkOrEffects']){
 assert.match(test,new RegExp('@Test public void '+method+'\\('));checks++;
}
assert.doesNotMatch(test,/@Ignore|Assume\.|@Disabled/);checks++;
assert.match(read('mobile/scripts/custodial-provider-storage-tests.mjs'),/tests.push\('NativeProviderCompositionTest'\);/);checks++;
const manifest=read('mobile/plugins/custodial-native-vault/android/src/main/AndroidManifest.xml');
equal(sha(manifest),'5714fc43190e46dfe043749b8a5b9bf2903bed60cd2bc86ef2077875248c854a','SDK manifest not silently activated');
assert.doesNotMatch(manifest,/MESSAGING_EVENT/);checks++;
console.log(JSON.stringify({status:'QUALIFIED_RELEASE_ROUTE_SOURCE_PASS',checks,compiled_real_profiles:0,synthetic_only:true,manifest_registered:false,jvm:false,activation:false}));
