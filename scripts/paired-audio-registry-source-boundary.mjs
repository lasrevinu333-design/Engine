// Exact new registry seam -> frozen historical audio source, comparison only.
// No production qualification, release permission or broad ignored-field rule.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const path='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/NativeProviderAudioAdmission.java';
export const pairedAudioRegistryDelta=Object.freeze({path,prior_sha256:'c7cc31cfbe367879c4de6c5ce3c6a912a943baa6516b2975e52dd09bfce0fbe1',current_sha256:'9f0f0c473ac662a54968d5181263c8ed7d14b38005e46874ad488bdd96600181',
 before:'    private static final Entry[] REVIEWED_AUDIO_RELEASES=new Entry[0];',after:'    private static final Entry[] REVIEWED_AUDIO_RELEASES=NativeProviderReviewedAudioReleases.entries();'});
export function withoutPairedAudioRegistry(name,source){
 const row=pairedAudioRegistryDelta;if(name!==row.path&&!name.endsWith('/NativeProviderAudioAdmission.java')&&name!=='NativeProviderAudioAdmission.java')return source;
 if(sha(source)===row.prior_sha256)return source;assert.equal(sha(source),row.current_sha256,'exact complete reviewed-audio registry successor');
 assert.equal(source.split(row.after).length,2);const prior=source.replace(row.after,row.before);assert.equal(sha(prior),row.prior_sha256,'every historical admission byte preserved');return prior;
}
