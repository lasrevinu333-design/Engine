import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const sdkAdmissionDelta=Object.freeze({
  name:'NativeProviderReleaseAdmission.java',
  prior:'e4813fe5c6a4b42ec52dae0fa9e24163dfeebd8504c041f7bfa133d4f0ddf91e',
  current:'75a93193c9499385028b315d018a75eb771a15ad531963d83e4d389fc9921cf7',
  before:'    private static final Release[] REVIEWED_RELEASES = new Release[0];',
  after:'    private static final Release[] REVIEWED_RELEASES = NativeProviderReviewedReleases.entries();',
});
export function withoutSdkRegistration(name,source){
  source=normalizeCurrentNativeAudioSequence(name,source);
  if(name!==sdkAdmissionDelta.name&&!name.endsWith('/'+sdkAdmissionDelta.name))return source;
  if(sha(source)===sdkAdmissionDelta.prior)return source;
  assert.equal(sha(source),sdkAdmissionDelta.current,'only exact compiled-source table binding');
  assert.equal(source.split(sdkAdmissionDelta.after).length,2);
  const prior=source.replace(sdkAdmissionDelta.after,sdkAdmissionDelta.before);
  assert.equal(sha(prior),sdkAdmissionDelta.prior,'all predecessor bytes preserved');return prior;
}
