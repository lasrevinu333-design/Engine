import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateProviderRetainedSchedulePins(value){
 assert.equal(sha(JSON.stringify(value)),'00b3325f10e766e8125a94e05db94ef3fdb2801b86cd471eb99103db70ad725a',
  'exact complete retained-schedule delta; no added fields, paths or hunks');
 return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const providerRetainedSchedulePins=freeze(validateProviderRetainedSchedulePins(JSON.parse(
 readFileSync(new URL('./fixtures/provider-retained-schedule-byte-deltas.json',import.meta.url),'utf8'))));
// Only this exact reviewed predecessor may pass unchanged. The owning current
// source test separately rejects a removed correction, even when it is an
// exact predecessor. No Git object database is needed by this portable guard.
export function withoutProviderRetainedSchedule(name,source){
 const row=providerRetainedSchedulePins;if(name!==row.path)return source;
 if(sha(source)===row.prior_sha256)return source;
 assert.equal(sha(source),row.current_sha256,'exact full retained-schedule source');
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.after.length,h.new_count);assert.equal(h.before.length,h.old_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact retained-schedule reverse hunk');
  lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),row.prior_sha256,'every byte outside retained-schedule delta preserved');return prior;
}
