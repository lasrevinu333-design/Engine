import {normalizeCurrentNativeScheduleWire} from './native-schedule-wire-source-boundary.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutProviderNoWake} from './provider-no-wake-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateRequiredKindPins(value){
 assert.equal(sha(JSON.stringify(value)),'081eb75bc714294248b190ce9e8724d253ee6ffb602d028834f5bc9287eb04e9','exact four-file required-kind source inventory and reverse hunks');
 return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const requiredKindPins=freeze(validateRequiredKindPins(JSON.parse(readFileSync(new URL('./fixtures/provider-required-kind-byte-deltas.json',import.meta.url),'utf8'))));
export function withoutRequiredKinds(name,source){
 source=normalizeCurrentNativeScheduleWire(name,source);
 const row=requiredKindPins.files.find(value=>value.name===name);if(!row)return source;
 if(sha(source)===row.prior_sha256)return source;
 // An exact already-normalized historical predecessor is handled above.
 // Only current successor bytes enter the newer, separately pinned delta.
 source=withoutProviderNoWake(name,source);
 assert.equal(sha(source),row.current_sha256,'exact whole required-kind source: '+name);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.before.length,h.old_count);assert.equal(h.after.length,h.new_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact required-kind reverse hunk');
  lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'all prior bytes outside required-kind delta preserved');return prior;
}
