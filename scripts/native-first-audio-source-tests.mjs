import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {firstAudioPins,validateFirstAudioPins,withoutFirstAudio,normalizeCurrentFirstAudio} from './native-first-audio-source-boundary.mjs';
import {normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');let checks=0;
for(const row of firstAudioPins.files){
 const current=normalizeCurrentNativeAudioSequence(row.path,readFileSync(new URL('../'+row.path,import.meta.url),'utf8'));assert.equal(sha(current),row.current_sha256);checks++;
 const prior=withoutFirstAudio(row.name,current);assert.equal(sha(prior),row.prior_sha256);checks++;
 assert.equal(withoutFirstAudio(row.name,prior),prior);checks++;
 assert.equal(normalizeCurrentFirstAudio(row.name,current),prior);checks++;
 for(const bad of [current+' ',current.slice(1),current.replace(row.hunks[0].after[0],row.hunks[0].after[0]+' ')]){
  assert.throws(()=>withoutFirstAudio(row.name,bad));checks++;assert.equal(normalizeCurrentFirstAudio(row.name,bad),bad);checks++;
 }
}
for(const edit of [x=>x.extra=true,x=>x.files.reverse(),x=>x.files.pop(),x=>x.files[0].current_sha256='a'.repeat(64),x=>x.files[0].hunks.pop()]){const bad=structuredClone(firstAudioPins);edit(bad);assert.throws(()=>validateFirstAudioPins(bad));checks++;}
const journal=readFileSync(new URL('../'+firstAudioPins.files[0].path,import.meta.url),'utf8'),claims=readFileSync(new URL('../'+firstAudioPins.files[1].path,import.meta.url),'utf8');
assert.match(journal,/commit\(snapshot, writes\); return true;/);checks++;
assert.match(journal,/"IN_PROGRESS"\.equals\(state\) \|\| "COMPLETED"\.equals\(state\)\) return false/);checks++;
assert.match(claims,/if \(!journal.tryStartAudio/);checks++;
assert.match(claims,/custodial_provider_audio_already_owned/);checks++;
console.log(JSON.stringify({status:'NATIVE_FIRST_AUDIO_FULL_SOURCE_PASS',checks,native_playback:false,production:false}));
