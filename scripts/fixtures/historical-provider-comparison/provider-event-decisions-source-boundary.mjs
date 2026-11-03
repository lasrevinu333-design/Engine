import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateProviderEventDecisionPins(value){
 assert.equal(sha(JSON.stringify(value)),'c39c492e6d360a8dfbeaa84a83f5b6c7a1349ce436e850530d77b50e0b0fc4c7','exact full F6 source inventory, paths, hashes and reverse hunks');
 return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const providerEventDecisionPins=freeze(validateProviderEventDecisionPins(JSON.parse(readFileSync(new URL('./fixtures/provider-event-decisions-byte-deltas.json',import.meta.url),'utf8'))));
// A historical scope can compare exact old bytes. The owning current-source
// contract additionally requires every current hash and rejects a removed caller.
export function withoutProviderEventDecisions(name,source){
 const row=providerEventDecisionPins.files.find(value=>value.name===name);if(!row)return source;
 if(sha(source)===row.prior_sha256)return source;
 assert.equal(sha(source),row.current_sha256,'exact full event-decision source: '+name);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.after.length,h.new_count);assert.equal(h.before.length,h.old_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact event-decision reverse hunk');
  lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'every predecessor byte outside provider-only change');return prior;
}
