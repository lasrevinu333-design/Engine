import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutProviderMaintenance} from './provider-maintenance-source-boundary.mjs';
export const providerMirrorBytePins=JSON.parse(readFileSync(new URL('./fixtures/provider-mirror-byte-deltas.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
// Exact FULL current bytes and FULL archived bytes, with pinned reversible
// deltas. Works in a shallow checkout without any unpublished Git objects.
export function withoutProviderMirror(name,source){
 const known=providerMirrorBytePins.find(value=>value.name===name&&value.origin);
 if(known&&sha(source)===known.base_sha256)return source; // Already normalized exact archived bytes.
 source=withoutProviderMaintenance(name,source);
 const row=providerMirrorBytePins.find(value=>value.name===name&&value.origin);if(!row)return source;
 if(sha(source)===row.base_sha256)return source;
 assert.equal(sha(source),row.current_sha256,'exact finite mirror source: '+name);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact finite mirror delta: '+name);
  lines.splice(start,h.new_count,...h.before);
 }
 const result=lines.join('\n');assert.equal(sha(result),row.base_sha256,'exact bytes outside mirror delta: '+name);return result;
}
