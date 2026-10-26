import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {nativeAudioSequencePins as pins,validateNativeAudioSequencePins,withoutNativeAudioSequence,normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
import {withoutPairedAudioRegistry} from './paired-audio-registry-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');let checks=0;
for(const row of pins.files){
 const current=read(row.path);assert.equal(sha(current),row.current_sha256);checks++;
 const prior=withoutNativeAudioSequence(row.path,current);assert.equal(sha(prior),row.prior_sha256);checks++;
 assert.equal(withoutNativeAudioSequence(row.path,prior),prior);checks++;
 assert.equal(normalizeCurrentNativeAudioSequence(row.name,current),prior);checks++;
 for(const bad of [current+' ',current.slice(1),current.replace(row.hunks[0].after[0],row.hunks[0].after[0]+' ')]){
  assert.notEqual(bad,current,'negative mutation actually applied');checks++;
  assert.throws(()=>withoutNativeAudioSequence(row.path,bad));checks++;
  assert.equal(normalizeCurrentNativeAudioSequence(row.name,bad),bad);checks++;
 }
}
for(const row of pins.additions){assert.equal(sha(withoutPairedAudioRegistry(row.path,read(row.path))),row.sha256);checks++;}
for(const edit of [x=>x.extra=true,x=>x.files.reverse(),x=>x.files.pop(),x=>x.files[0].current_sha256='a'.repeat(64),x=>x.additions.pop(),x=>x.files[0].hunks.pop()]){const bad=structuredClone(pins);edit(bad);assert.throws(()=>validateNativeAudioSequencePins(bad));checks++;}
const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const sdk=read(dir+'AndroidProviderAudioSurface.java'),host=read(dir+'CustodialProviderAudioService.java'),runtime=read(dir+'CustodialNativeRuntime.java'),owner=read(dir+'NativeProviderRuntimeOwner.java');
for(const regex of [/isIgnoringBatteryOptimizations\(app.getPackageName\(\)\)/,/info.getForegroundServiceType\(\)!=ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK/,/setOnUtteranceProgressListener[\s\S]*!=TextToSpeech.SUCCESS/,/requestAudioFocus\(focus\)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED/,/authority.perform\(\(\)->/,/abandonAudioFocusRequest\(focus\)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED/,/speechPending\|\|!u.equals\(utterance\)/]){assert.match(sdk,regex);checks++;}
assert.doesNotMatch(sdk,/setStreamVolume|setStreamMute|turnScreenOn|bringToForeground|requestIgnoreBatteryOptimizations|setDefaultEngine|ACTION_INSTALL_TTS_DATA/);checks++;
assert.match(host,/startForeground\(ID,notice,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK\)/);checks++;
assert.match(host,/return START_NOT_STICKY/);checks++;
assert.match(read(dir+'NativeProviderAudioAdmission.java'),/REVIEWED_AUDIO_RELEASES=NativeProviderReviewedAudioReleases.entries\(\)/);checks++;
assert.match(read(dir+'NativeProviderReviewedAudioReleases.java'),/return new NativeProviderAudioAdmission.Entry\[0\]/);checks++;
assert.match(runtime,/NativeProviderAudioAdmission.compiled\(app,clock\)==null/);checks++;
assert.match(owner,/new NativeProviderClaims\(journal,audio==null\)/);checks++;
assert.match(read(dir+'AndroidProviderNotifications.java'),/nativeAudio&&\(actual.getSound\(\)!=null\|\|actual.shouldVibrate\(\)\)/);checks++;
console.log(JSON.stringify({status:'NATIVE_AUDIO_SEQUENCE_COMPLETE_SOURCE_PASS',checks,clockProfiles:0,audioProfiles:0,actualPlayback:false,apk:false,independentReview:false}));
