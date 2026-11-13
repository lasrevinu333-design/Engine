import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
assert.match(readFileSync(dir+'NativeProviderReviewedReleases.java','utf8'),/return new NativeProviderReleaseAdmission\.Release\[0\]/);
assert.match(readFileSync(dir+'NativeProviderReviewedAudioReleases.java','utf8'),/return new NativeProviderAudioAdmission\.Entry\[0\]/);
assert.doesNotMatch(readFileSync(dir+'NativeProviderRuntimeOwner.java','utf8'),/new NativeProviderTime.Profile\(/);
console.log(JSON.stringify({status:'PASS',checks:3,real_profiles_added:0,actual_audio:false,source_wire_admission:false}));
