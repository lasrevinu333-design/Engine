import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withoutSdkRegistration,sdkAdmissionDelta} from './provider-sdk-registration-source-boundary.mjs';
import {createHash} from 'node:crypto';
import {normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
import {syntheticProviderAudioInputs} from './fixtures/provider-paired-release-input.mjs';
import {
  parseReviewedProviderReleases,compiledReviewedProviderReleases,selectReviewedProviderRelease,
  configureProviderManifest,inspectCompiledProviderOwner,PROVIDER_MANIFEST_BLOCK,
  PROVIDER_SERVICE,LEGACY_PROVIDER_SERVICES,isQualifiedProviderRelease,
} from '../mobile/scripts/custodial-provider-release-policy.mjs';

const read=path=>normalizeCurrentNativeAudioSequence(path,readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const plugin='mobile/plugins/custodial-native-vault/';
const policy=read(plugin+'android/src/provider-reviewed-releases.json');
const compiled=read(plugin+'android/src/main/java/org/memphiszoo/custodial/vault/NativeProviderReviewedReleases.java');
const java=read(plugin+'android/src/main/java/org/memphiszoo/custodial/vault/NativeProviderReleaseAdmission.java');
let checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
const rejects=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};
equal(parseReviewedProviderReleases(policy).releases,[]);equal(compiled,compiledReviewedProviderReleases(policy));
assert.match(java,/REVIEWED_RELEASES = NativeProviderReviewedReleases.entries\(\);/);checks++;
const priorAdmission=withoutSdkRegistration(sdkAdmissionDelta.name,java);
equal(createHash('sha256').update(priorAdmission).digest('hex'),sdkAdmissionDelta.prior);
equal(withoutSdkRegistration(sdkAdmissionDelta.name,priorAdmission),priorAdmission);
for(const bad of [java+' ',java.slice(1),java.replace('entries();','entries( );'),priorAdmission+' '])rejects(()=>withoutSdkRegistration(sdkAdmissionDelta.name,bad));
const originalManifest='<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application android:label="unchanged" />\n</manifest>\n'.replace(' />','></application>');
equal(selectReviewedProviderRelease({policyBytes:policy,compiledSource:compiled,versionCode:999,versionName:'synthetic'}),null);
rejects(()=>selectReviewedProviderRelease({policyBytes:policy,compiledSource:compiled,versionCode:999,versionName:'synthetic',required:true}),/absent/);
equal(configureProviderManifest(originalManifest,null),originalManifest);
// Explicit synthetic reviewed-record grammar, not a real release qualification.
const record={version_code:999,version_name:'synthetic',backend_protocol_evidence_sha256:'a'.repeat(64),composition_evidence_sha256:'b'.repeat(64),
  profile:{id:'synthetic-fixture',api:'fixture-api',build:'fixture-build',device:'fixture-device',quantization_nanos:1,rate_ppm:1,max_age_nanos:1000000,evidence_sha256:'c'.repeat(64)}};
const json=records=>JSON.stringify({schema:'custodial.native-provider-reviewed-releases.v1',package_name:'org.memphiszoo.custodial',releases:records});
const choose=bytes=>selectReviewedProviderRelease({policyBytes:bytes,compiledSource:compiledReviewedProviderReleases(bytes),...syntheticProviderAudioInputs(JSON.parse(bytes).releases),versionCode:999,versionName:'synthetic',required:true});
const bytes=json([record]),ticket=choose(bytes);
equal(isQualifiedProviderRelease(ticket),true);equal(isQualifiedProviderRelease({...ticket}),false);
equal(ticket.profileCount,1);
rejects(()=>configureProviderManifest(originalManifest,{...ticket}),/unbound/);
rejects(()=>selectReviewedProviderRelease({policyBytes:bytes,compiledSource:compiled,versionCode:999,versionName:'synthetic',required:true}),/differ/);
for(const [versionCode,versionName] of [[998,'synthetic'],[999,'wrong']])rejects(()=>selectReviewedProviderRelease({policyBytes:bytes,compiledSource:compiledReviewedProviderReleases(bytes),versionCode,versionName,required:true}),/absent/);
for(const mutate of [r=>r.extra=true,r=>r.version_code=0,r=>r.version_name=' x',r=>r.profile.rate_ppm=1000000,
  r=>r.profile.max_age_nanos=0,r=>r.profile.quantization_nanos=-1,r=>r.profile.extra=true,r=>r.profile.api='unsafe\\u000a',
  r=>r.profile.evidence_sha256='not-proof',r=>r.backend_protocol_evidence_sha256='',r=>r.composition_evidence_sha256=12]){
  const r=structuredClone(record);mutate(r);rejects(()=>choose(json([r])));
}
rejects(()=>choose(json([record,record])),/duplicate/);
rejects(()=>choose(bytes.replace('"releases":','"releases":[],"releases":')),/repeats the JSON key/);
rejects(()=>choose(bytes.replace('org.memphiszoo.custodial','org.memphiszoo.ops')));
const configured=configureProviderManifest(originalManifest,ticket);
equal(configured.includes(PROVIDER_MANIFEST_BLOCK),true);equal(configureProviderManifest(configured,ticket),configured);
equal(configured.replace(PROVIDER_MANIFEST_BLOCK,'').replace(' xmlns:tools="http://schemas.android.com/tools"',''),originalManifest);
rejects(()=>configureProviderManifest(configured,null),/downgrade/);
for(const fragment of [PROVIDER_MANIFEST_BLOCK+PROVIDER_MANIFEST_BLOCK,PROVIDER_MANIFEST_BLOCK.replace('exported="false"','exported="true"'),'<service android:name="'+LEGACY_PROVIDER_SERVICES[0]+'" />']){
  rejects(()=>configureProviderManifest(originalManifest.replace('</application>',fragment+'</application>'),ticket));
}
const manifest=(services)=>`E: manifest
  A: package="org.memphiszoo.custodial"
  A: android:versionCode=999
  A: android:versionName="synthetic"
  E: application
${services}`;
const service=(name=PROVIDER_SERVICE,extra='')=>`    E: service
      A: android:name="${name}"
      A: android:exported="false"
${extra}      E: intent-filter
        E: action
          A: android:name="com.google.firebase.MESSAGING_EVENT"
`;
const exact=manifest(service());equal(inspectCompiledProviderOwner(exact,ticket).owner,PROVIDER_SERVICE);
// Actual predecessor graph: two FCM services, no qualified native owner.
rejects(()=>inspectCompiledProviderOwner(manifest(LEGACY_PROVIDER_SERVICES.map(v=>service(v)).join('')),ticket),/legacy owner/);
for(const hostile of [manifest(''),manifest(service()+service()),manifest(service('foreign.Service')),
  manifest(service()+service('foreign.Service')),manifest(service()+service(LEGACY_PROVIDER_SERVICES[0])),
  exact.replace('exported="false"','exported="true"'),manifest(service(PROVIDER_SERVICE,'      A: android:directBootAware="true"\n')),
  exact.replace('versionCode=999','versionCode=998'),exact.replace('versionName="synthetic"','versionName="wrong"'),
  exact.replace('package="org.memphiszoo.custodial"','package="org.memphiszoo.ops"'),
  exact.replace('        E: action','        E: category\n          A: android:name="unexpected"\n        E: action')])rejects(()=>inspectCompiledProviderOwner(hostile,ticket));
rejects(()=>inspectCompiledProviderOwner(exact,null));rejects(()=>inspectCompiledProviderOwner(exact,{...ticket}));
const configure=read('mobile/scripts/configure-native-release.mjs'),verify=read('mobile/scripts/verify-custodial-android-release.mjs');
assert.match(configure,/readReviewedProviderRelease[\s\S]*required: signing/);checks++;
assert.match(configure,/configureProviderManifest\(appManifest,providerRelease\)/);checks++;
assert.match(verify,/versionCode: application.version_code, versionName: application.version_name, required: true/);checks++;
assert.match(verify,/verifyCustodialAndroidManifestSecurity\(apk, \{ aapt2Path: tools.aapt2, providerRelease, cleaningScope \}\)/);checks++;
assert.doesNotMatch(read('mobile/scripts/custodial-provider-release-policy.mjs'),/process.env|execSync|spawn|writeFile/);checks++;
const nativeManifest=read(plugin+'android/src/main/AndroidManifest.xml');
assert.doesNotMatch(nativeManifest,/MESSAGING_EVENT/);checks++;
console.log(JSON.stringify({status:'QUALIFIED_SDK_REGISTRATION_SOURCE_PASS',checks,realProfiles:0,synthetic:true,apk:false,activation:false}));
