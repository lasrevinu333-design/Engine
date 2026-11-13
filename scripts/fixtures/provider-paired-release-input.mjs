// Explicit synthetic unit-test records only. No release/runtime admission.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {providerClockProfileFingerprint,compiledReviewedProviderAudioReleases} from '../../mobile/scripts/custodial-provider-audio-release-policy.mjs';
export function syntheticProviderAudioInputs(records){
 const tone=createHash('sha256').update(readFileSync(new URL('../../memphis-alert-tone.wav',import.meta.url))).digest('hex');
 const bytes=JSON.stringify({schema:'custodial.native-provider-reviewed-audio-releases.v1',package_name:'org.memphiszoo.custodial',releases:records.map(r=>({
  version_code:r.version_code,version_name:r.version_name,clock_fingerprint:providerClockProfileFingerprint(r.profile),
  backend_protocol_evidence_sha256:r.backend_protocol_evidence_sha256,composition_evidence_sha256:r.composition_evidence_sha256,
  policy:{engine:'synthetic.local.engine',voice:'SYNTHETIC_ONLY',rate_milli:900,tone_sha256:tone,evidence_sha256:'e'.repeat(64)}
 }))});
 return {audioPolicyBytes:bytes,audioCompiledSource:compiledReviewedProviderAudioReleases(bytes)};
}
