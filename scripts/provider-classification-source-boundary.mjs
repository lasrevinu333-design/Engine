import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutProviderRetainedSchedule} from './provider-retained-schedule-source-boundary.mjs';
import {withoutProviderEventDecisions} from './provider-event-decisions-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
// Exact finite accepted source delta only; no Git object, broad omitted block,
// guessed predecessor, or unknown field/hunk is accepted in a shallow checkout.
export function validateProviderClassificationPins(value){
 assert.equal(sha(JSON.stringify(value)),'3cdbfd459f1781caacbf5125838be83ceb9cf4faec738bd0c55929b24d816de5','exact complete classification pin inventory');
 return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const providerClassificationPins=freeze(validateProviderClassificationPins(JSON.parse(readFileSync(new URL('./fixtures/provider-classification-byte-deltas.json',import.meta.url),'utf8'))));
export function withoutProviderClassification(name,source){
 const row=providerClassificationPins.files.find(value=>value.name===name);
 if(row&&sha(source)===row.prior_sha256)return source;
 source=withoutProviderEventDecisions(name,source);if(!row)return source;
 source=withoutProviderRetainedSchedule(name,source);
 assert.equal(sha(source),row.current_sha256,'exact full classification source: '+name);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.after.length,h.new_count,'exact new hunk length');assert.equal(h.before.length,h.old_count,'exact old hunk length');
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact classification delta: '+name);
  lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'every prior byte outside classification: '+name);return prior;
}
