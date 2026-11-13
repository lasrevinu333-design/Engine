// Source selectors and their refusal cases; never Android/device acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readReviewedProviderRelease,parseReviewedProviderReleases,compiledReviewedProviderReleases,selectReviewedProviderRelease} from '../mobile/scripts/custodial-provider-release-policy.mjs';
import {providerClockProfileFingerprint,compiledReviewedProviderAudioReleases} from '../mobile/scripts/custodial-provider-audio-release-policy.mjs';
const root=new URL('../mobile/plugins/custodial-native-vault/',import.meta.url);
const bytes=readFileSync(new URL('android/src/provider-reviewed-releases.json',root));
const audio=readFileSync(new URL('android/src/provider-reviewed-audio-releases.json',root));
const policy=parseReviewedProviderReleases(bytes),r=policy.releases[0];
assert.equal(policy.releases.length,1);assert.equal(r.version_code,80);assert.equal(r.version_name,'1.0.0');
assert.equal(r.profile.timing_model,'android-elapsed-best-effort.v1');
assert.deepEqual(Object.keys(r.profile).sort(),['id','api','build','device','timing_model','evidence_sha256'].sort());
assert.equal(providerClockProfileFingerprint(r.profile),createHash('sha256').update([r.profile.id,r.profile.api,r.profile.build,r.profile.device,r.profile.timing_model,r.profile.evidence_sha256].join('\n')).digest('hex'));
const admitted=readReviewedProviderRelease(root.pathname,{versionCode:80,versionName:'1.0.0',required:true});
assert.equal(admitted.profileCount,1);assert.equal(admitted.audioProfileCount,1);
for(const [code,name]of[[79,'1.0.0'],[81,'1.0.0'],[80,'wrong']])assert.throws(()=>readReviewedProviderRelease(root.pathname,{versionCode:code,versionName:name,required:true}),/qualified provider release inputs absent/);
let negatives=0;
for(const mutate of [p=>p.quantization_nanos=0,p=>p.rate_ppm=0,p=>p.max_age_nanos=1,p=>p.timing_model='unknown',p=>p.evidence_sha256='invalid',p=>p.id='',p=>p.api='\nwrong']){
 const v=structuredClone(policy);mutate(v.releases[0].profile);assert.throws(()=>parseReviewedProviderReleases(JSON.stringify(v)));negatives++;
}
const input={policyBytes:bytes,compiledSource:compiledReviewedProviderReleases(bytes),audioPolicyBytes:audio,audioCompiledSource:compiledReviewedProviderAudioReleases(audio),versionCode:80,versionName:'1.0.0',required:true};
for(const key of ['backend_protocol_evidence_sha256','composition_evidence_sha256']){
 const v=JSON.parse(audio);v.releases[0][key]='f'.repeat(64);const changed=JSON.stringify(v);
 assert.throws(()=>selectReviewedProviderRelease({...input,audioPolicyBytes:changed,audioCompiledSource:compiledReviewedProviderAudioReleases(changed)}),/paired audio release inputs absent/);negatives++;
}
console.log(JSON.stringify({status:'PASS_BEST_EFFORT_RELEASE_INPUTS',negative_controls:negatives,version_code:80,profile_count:1,build:false,installed:false,physical_audio:false}));
