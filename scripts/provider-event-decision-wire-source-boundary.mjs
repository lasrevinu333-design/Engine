import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutProviderDecisionCurrent219} from './provider-event-decision-current219-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateProviderDecisionWirePins(value){
 assert.equal(sha(JSON.stringify(value)),'1c111405d0e95f6d02244b7dc942edf40dac636bcd141cb29cbe92279ff71e1e','exact finite runner-only wire delta and new test identity');return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const providerDecisionWirePins=freeze(validateProviderDecisionWirePins(JSON.parse(readFileSync(new URL('./fixtures/provider-event-decision-wire-byte-deltas.json',import.meta.url),'utf8'))));
export function withoutProviderDecisionWire(path,source){
 const row=providerDecisionWirePins;if(path!==row.path)return source;
 if(sha(source)===row.prior_sha256)return source;
 source=withoutProviderDecisionCurrent219(path,source);
 assert.equal(sha(source),row.current_sha256,'exact full test runner with wire preparation');const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.after.length,h.new_count);assert.equal(h.before.length,h.old_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;assert.deepEqual(lines.slice(start,start+h.new_count),h.after);
  lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'all original owning runner bytes retained');return prior;
}
