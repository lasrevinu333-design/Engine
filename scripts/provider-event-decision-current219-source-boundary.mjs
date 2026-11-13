import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateProviderDecisionCurrent219Pins(value){
 assert.equal(sha(JSON.stringify(value)),'5603235b96d07424a761c18e2fb250f2a37f2e1126f0a20a1bd9dedbcbf06f05','exact independent current219 source manifest and finite runner delta');return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const providerDecisionCurrent219Pins=freeze(validateProviderDecisionCurrent219Pins(JSON.parse(readFileSync(new URL('./fixtures/provider-event-decision-current219-byte-deltas.json',import.meta.url),'utf8'))));
export function withoutProviderDecisionCurrent219(path,source){
 const row=providerDecisionCurrent219Pins;if(path!==row.path)return source;
 if(sha(source)===row.prior_sha256)return source;
 assert.equal(sha(source),row.current_sha256,'exact current219 full storage runner required');const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.after.length,h.new_count);assert.equal(h.before.length,h.old_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;assert.deepEqual(lines.slice(start,start+h.new_count),h.after);
  lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'current219 reverse delta preserves complete prior wire runner');return prior;
}
