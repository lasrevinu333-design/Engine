import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutProviderMirror} from './provider-mirror-source-boundary.mjs';

// Portable exact source slice, not a broad regex omission or hidden Git object.
export const providerCompositionBytePins=JSON.parse(readFileSync(new URL('./fixtures/provider-composition-byte-deltas.json',import.meta.url),'utf8'));
const sha=v=>createHash('sha256').update(v).digest('hex');
export function withoutProviderComposition(name,source){
 source=withoutProviderMirror(name,source);
 const row=providerCompositionBytePins.find(r=>r.name===name&&r.origin);if(!row)return source;
 if(sha(source)===row.base_sha256)return source;
 assert.equal(sha(source),row.current_sha256,'exact conditional composition source: '+name);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact conditional composition delta: '+name);
  lines.splice(start,h.new_count,...h.before);
 }
 const restored=lines.join('\n');assert.equal(sha(restored),row.base_sha256,'exact preserved base outside composition: '+name);return restored;
}
export function assertNewProviderCompositionSource(name,source){
 const row=providerCompositionBytePins.find(r=>r.name===name&&!r.origin);assert.ok(row,'explicit new composition source');
 assert.equal(sha(source),row.current_sha256,'exact unqualified platform identity source');
}
