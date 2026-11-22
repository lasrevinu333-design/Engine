import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  compiledReviewedProviderReleases,
  selectReviewedProviderRelease,
} from '../mobile/scripts/custodial-provider-release-policy.mjs';
import { compiledReviewedProviderAudioReleases } from '../mobile/scripts/custodial-provider-audio-release-policy.mjs';

const providerRoot = new URL('../mobile/plugins/custodial-native-vault/android/src/', import.meta.url);
const emptyPolicy = name => {
  const policy = JSON.parse(readFileSync(new URL(name, providerRoot), 'utf8'));
  return Buffer.from(JSON.stringify({ ...policy, releases: [] }) + '\n');
};
const policyBytes = emptyPolicy('provider-reviewed-releases.json');
const audioPolicyBytes = emptyPolicy('provider-reviewed-audio-releases.json');
const compiledSource = compiledReviewedProviderReleases(policyBytes);
const audioCompiledSource = compiledReviewedProviderAudioReleases(audioPolicyBytes);

assert.match(compiledSource, /return new NativeProviderReleaseAdmission\.Release\[0\]/);
assert.match(audioCompiledSource, /return new NativeProviderAudioAdmission\.Entry\[0\]/);
const fixture = {
  policyBytes, compiledSource, audioPolicyBytes, audioCompiledSource,
  versionCode: 1, versionName: '1.0.0',
};
assert.equal(selectReviewedProviderRelease(fixture), null);
assert.throws(
  () => selectReviewedProviderRelease({ ...fixture, required: true }),
  /qualified provider release inputs absent/,
);

const owner = new URL('main/java/org/memphiszoo/custodial/vault/NativeProviderRuntimeOwner.java', providerRoot);
assert.doesNotMatch(readFileSync(owner, 'utf8'), /new NativeProviderTime\.Profile\(/);
console.log(JSON.stringify({ status: 'PASS', checks: 5, scope: 'empty policy fixture and production runtime source' }));
