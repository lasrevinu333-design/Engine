// Source selectors and their refusal cases; never Android/device acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readReviewedProviderRelease,parseReviewedProviderReleases,compiledReviewedProviderReleases,selectReviewedProviderRelease} from '../mobile/scripts/custodial-provider-release-policy.mjs';
import {providerClockProfileFingerprint,compiledReviewedProviderAudioReleases} from '../mobile/scripts/custodial-provider-audio-release-policy.mjs';
const root=new URL('../mobile/plugins/custodial-native-vault/',import.meta.url);
const bytes=readFileSync(new URL('android/src/provider-reviewed-releases.json',root));
const audio=readFileSync(new URL('android/src/provider-reviewed-audio-releases.json',root));
const policy=parseReviewedProviderReleases(bytes),r=policy.releases.at(-1);
assert.deepEqual(policy.releases.map(({version_code,version_name})=>[version_code,version_name]),[[81,'1.0.0'],[82,'1.0.0'],[83,'1.0.0'],[84,'1.0.0'],[85,'1.0.0'],[86,'1.0.0']]);
const sha=value=>createHash('sha256').update(value).digest('hex');
for(const entry of policy.releases){
 const evidence=new URL('../mobile/release-evidence/',import.meta.url);
 assert.equal(entry.backend_protocol_evidence_sha256,sha(readFileSync(new URL('provider-v81-protocol.json',evidence))));
 assert.equal(entry.composition_evidence_sha256,sha(readFileSync(new URL(`provider-v${entry.version_code}-composition.json`,evidence))));
 const admitted=readReviewedProviderRelease(root.pathname,{versionCode:entry.version_code,versionName:entry.version_name,required:true});
 assert.equal(admitted.profileCount,1);
 assert.equal(admitted.audioProfileCount,1);
}
const installedComposition=JSON.parse(readFileSync(new URL('../mobile/release-evidence/provider-v85-composition.json',import.meta.url)));
const composition=JSON.parse(readFileSync(new URL('../mobile/release-evidence/provider-v86-composition.json',import.meta.url)));
assert.equal(composition.candidate_version_for_validation,86);
assert.equal(composition.version_allocated,true);
assert.equal(composition.release_independent_sources.length,192);
assert.equal(new Set(composition.release_independent_sources.map(entry=>entry.path)).size,192);
for(const entry of composition.release_independent_sources){
 assert.match(entry.path,/^mobile\/plugins\/custodial-native-vault\/android\/src\/main\/java\/org\/memphiszoo\/custodial\/vault\/[A-Za-z0-9]+\.java$/);
 assert.equal(sha(readFileSync(new URL('../'+entry.path,import.meta.url))),entry.sha256,entry.path);
}
assert.deepEqual(
  composition.release_independent_sources.map(({path})=>path),
  installedComposition.release_independent_sources.map(({path})=>path),
);
const changed=composition.release_independent_sources.flatMap((entry,index)=>{
 const prior=installedComposition.release_independent_sources[index];
 return entry.sha256===prior.sha256?[]:[{path:entry.path,prior_sha256:prior.sha256,current_sha256:entry.sha256}];
});
assert.deepEqual(changed,composition.repair.source_changes);
assert.deepEqual(changed.map(row=>row.path.split('/').at(-1)),['CustodialNativeRuntime.java','CustodialNativeVaultPlugin.java','NativeProviderNotificationPolicy.java','NativeProviderRuntimeOwner.java']);
assert.deepEqual([composition.repair.message_wire_changed,composition.repair.audio_sequence_changed,composition.repair.notification_body_changed],[false,false,false]);
for(const entry of policy.releases)assert.deepEqual(r.profile,entry.profile,'The forward version retains the measured best-effort clock profile');
assert.equal(r.profile.timing_model,'android-elapsed-best-effort.v1');
assert.deepEqual(Object.keys(r.profile).sort(),['id','api','build','device','timing_model','evidence_sha256'].sort());
assert.equal(providerClockProfileFingerprint(r.profile),createHash('sha256').update([r.profile.id,r.profile.api,r.profile.build,r.profile.device,r.profile.timing_model,r.profile.evidence_sha256].join('\n')).digest('hex'));
for(const [code,name]of[[80,'1.0.0'],[87,'1.0.0'],[86,'wrong']])assert.throws(()=>readReviewedProviderRelease(root.pathname,{versionCode:code,versionName:name,required:true}),/qualified provider release inputs absent/);
let negatives=0;
for(const mutate of [p=>p.quantization_nanos=0,p=>p.rate_ppm=0,p=>p.max_age_nanos=1,p=>p.timing_model='unknown',p=>p.evidence_sha256='invalid',p=>p.id='',p=>p.api='\nwrong']){
 const v=structuredClone(policy);mutate(v.releases[1].profile);assert.throws(()=>parseReviewedProviderReleases(JSON.stringify(v)));negatives++;
}
const input={policyBytes:bytes,compiledSource:compiledReviewedProviderReleases(bytes),audioPolicyBytes:audio,audioCompiledSource:compiledReviewedProviderAudioReleases(audio),versionCode:86,versionName:'1.0.0',required:true};
for(const key of ['backend_protocol_evidence_sha256','composition_evidence_sha256']){
 const v=JSON.parse(audio);v.releases.at(-1)[key]='f'.repeat(64);const changed=JSON.stringify(v);
 assert.throws(()=>selectReviewedProviderRelease({...input,audioPolicyBytes:changed,audioCompiledSource:compiledReviewedProviderAudioReleases(changed)}),/paired audio release inputs absent/);negatives++;
}
console.log(JSON.stringify({status:'PASS_BEST_EFFORT_RELEASE_INPUTS',negative_controls:negatives,version_code:86,retained_versions:[81,82,83,84,85],profile_count:1,build:false,installed:false,physical_audio:false}));
