import {normalizeCurrentNativeScheduleWire} from './native-schedule-wire-source-boundary.mjs';
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function validateNativeAudioSequencePins(value){assert.equal(sha(JSON.stringify(value)),'80a1a106221034d16d660b0848b055305444f7193ce94175aee2f45308124949','exact complete native-audio sequence and retained wake-observer delta');return value;}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const nativeAudioSequencePins=freeze(validateNativeAudioSequencePins(JSON.parse(readFileSync(new URL('./fixtures/native-audio-sequence-byte-delta.json',import.meta.url),'utf8'))));
export function withoutNativeAudioSequence(name,source){
 const row=nativeAudioSequencePins.files.find(x=>x.name===name||x.path===name||name.endsWith('/'+x.name));if(!row)return source;
 if(sha(source)===row.prior_sha256)return source;assert.equal(sha(source),row.current_sha256,'whole exact native-audio successor '+name);
 const lines=source.split('\n');for(const h of [...row.hunks].reverse()){
  const start=h.new_count===0?h.new_start:h.new_start-1;assert.deepEqual(lines.slice(start,start+h.new_count),h.after);lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'all prior bytes outside native-audio delta preserved');return prior;
}
// Comparison only, never a product/review/clock or installation permission.
export function normalizeCurrentNativeAudioSequence(name,source){
 source=normalizeCurrentNativeScheduleWire(name,source);
 const row=nativeAudioSequencePins.files.find(x=>x.name===name||x.path===name||name.endsWith('/'+x.name));
 return row&&sha(source)===row.current_sha256?withoutNativeAudioSequence(name,source):source;
}
