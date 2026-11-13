import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function validateFirstAudioPins(value){assert.equal(sha(JSON.stringify(value)),'0143eb00d105ed0bcf1204b888ec3197d018750399be7766bd7276fdc6cde8f9','exact complete first-audio source delta');return value;}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const firstAudioPins=freeze(validateFirstAudioPins(JSON.parse(readFileSync(new URL('./fixtures/native-first-audio-byte-delta.json',import.meta.url),'utf8'))));
export function withoutFirstAudio(name,source){
 source=normalizeCurrentNativeAudioSequence(name,source);
 const row=firstAudioPins.files.find(x=>x.name===name||x.path===name);if(!row)return source;
 if(sha(source)===row.prior_sha256)return source;assert.equal(sha(source),row.current_sha256,'whole exact first-audio successor');
 const lines=source.split('\n');for(const h of [...row.hunks].reverse()){
  const start=h.new_count===0?h.new_start:h.new_start-1;assert.deepEqual(lines.slice(start,start+h.new_count),h.after);lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'all prior bytes outside first-acquisition delta preserved');return prior;
}
/** Historical compositors normalize this delta ONLY when its whole successor
 * matches. Earlier and unknown bytes remain subject to their own unchanged
 * complete hash guard. This is comparison, never runtime/admission authority. */
export function normalizeCurrentFirstAudio(name,source){
 source=normalizeCurrentNativeAudioSequence(name,source);
 const row=firstAudioPins.files.find(x=>x.name===name||x.path===name);
 return row&&sha(source)===row.current_sha256?withoutFirstAudio(name,source):source;
}
