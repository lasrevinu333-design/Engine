import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scheduleWirePins,normalizeCurrentNativeScheduleWire} from './native-schedule-wire-source-boundary.mjs';
import {normalizeCurrentLocationCueWording} from './location-cue-wording-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');let checks=0;
for(const row of scheduleWirePins.files){
 const current=readFileSync(row.path,'utf8');assert.equal(sha(normalizeCurrentLocationCueWording(row.path,current)),row.current_sha256);checks++;
 const prior=normalizeCurrentNativeScheduleWire(row.path,current);assert.equal(sha(prior),row.prior_sha256);checks++;
 assert.equal(normalizeCurrentNativeScheduleWire(row.path,prior),prior);checks++;
 assert.equal(Object.isFrozen(row.hunks),true);checks++;
 for(const changed of [current+'\n// unknown\n',current.slice(1)]){assert.equal(normalizeCurrentNativeScheduleWire(row.path,changed),changed);checks++;}
}
const dir='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
for(const path of ['NativeProviderReviewedReleases.java','NativeProviderReviewedAudioReleases.java']){
 assert.match(readFileSync(dir+path,'utf8'),path==='NativeProviderReviewedReleases.java'?/return new NativeProviderReleaseAdmission\.Release\[0\]/:/return new NativeProviderAudioAdmission\.Entry\[0\]/);checks++;
}
assert.doesNotMatch(readFileSync(dir+'NativeProviderRuntimeOwner.java','utf8'),/new NativeProviderTime.Profile\(/);checks++;
console.log(JSON.stringify({status:'PASS',checks,exact_source_delta_only:true,old_production_parser_bytes_preserved:true,profiles_added:0,actual_browser_or_phone:false}));
