import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateReleaseAdmissionPins(value){
 assert.equal(sha(JSON.stringify(value)),'340ef3e097776a6e8240483af1504f66c60adbb441a58283736b81cc165d6333','exact runtime/test delta and compiled-input source pin');return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const releaseAdmissionPins=freeze(validateReleaseAdmissionPins(JSON.parse(readFileSync(new URL('./fixtures/provider-release-admission-byte-deltas.json',import.meta.url),'utf8'))));
export function withoutReleaseAdmission(name,source){
 source=normalizeCurrentNativeAudioSequence(name,source);
 const row=releaseAdmissionPins.files.find(value=>value.name===name||value.path===name);if(!row)return source;
 if(sha(source)===row.prior_sha256)return source;
 assert.equal(sha(source),row.current_sha256,'exact whole qualified release seam: '+name);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.before.length,h.old_count);assert.equal(h.after.length,h.new_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after);lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'every byte outside release admission restored');return prior;
}
