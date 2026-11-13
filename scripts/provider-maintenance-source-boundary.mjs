import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutProviderClassification} from './provider-classification-source-boundary.mjs';
export const providerMaintenancePins=JSON.parse(readFileSync(new URL('./fixtures/provider-maintenance-byte-deltas.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
// Restore only exact pinned maintenance deltas before older accepted mirror,
// composition, interval and cleaning guards. No Git object required at runtime.
export function withoutProviderMaintenance(name,source){
 const row=providerMaintenancePins.files.find(value=>value.name===name&&value.origin);
 if(row&&sha(source)===row.base_sha256)return source;
 source=withoutProviderClassification(name,source);if(!row)return source;
 assert.equal(sha(source),row.current_sha256,'exact bounded maintenance source: '+name);
 if(row.action_freshness_delta){
  assert.equal(name,'NativeProviderJournal.java','freshness delta owns only Journal');
  const delta=row.action_freshness_delta,added=delta.added_lines.join('\n')+'\n';
  assert.equal(source.split(added).length,2,'exact unique new-action freshness delta');
  source=source.replace(added,'');
  assert.equal(sha(source),delta.prior_sha256,'every prior maintenance byte restored before existing hunks');
 }
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'exact maintenance delta: '+name);
  lines.splice(start,h.new_count,...h.before);
 }
 const restored=lines.join('\n');assert.equal(sha(restored),row.base_sha256,'exact prior source outside maintenance: '+name);return restored;
}
