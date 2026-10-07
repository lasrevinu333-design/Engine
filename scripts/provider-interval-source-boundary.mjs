import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutProviderComposition} from './provider-composition-source-boundary.mjs';

// Portable exact reverse deltas for this owned source slice. Each FULL input
// and restored FULL baseline is SHA-pinned. No permissive section omission,
// unpublished Git object, or qualification inference exists in this helper.
export const providerIntervalBytePins=JSON.parse(readFileSync(new URL('./fixtures/provider-interval-byte-deltas.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
export function withoutProviderInterval(name,source){
 source=withoutProviderComposition(name,source);
 const row=providerIntervalBytePins.find(x=>x.name===name&&x.origin);if(!row)return source;
 const digest=sha(source);if(digest===row.base_sha256)return source;
 assert.equal(digest,row.current_sha256,'exact owned interval source bytes: '+name);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact interval reverse delta: '+name);
  lines.splice(start,h.new_count,...h.before);
 }
 const restored=lines.join('\n');assert.equal(sha(restored),row.base_sha256,'exact unchanged baseline outside interval delta: '+name);return restored;
}
export function assertNewProviderIntervalSource(name,source){
 const row=providerIntervalBytePins.find(x=>x.name===name&&!x.origin);assert.ok(row,'explicit new provider source '+name);
 assert.equal(sha(source),row.current_sha256,'exact new conditional provider source '+name);
}
