import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const PROFILE_SHA='4fa6d575c134afb3ebe0d48c70e11f7da33bd1d5791e457b752c55b876740599';
export function validateApprovedPreservationComparisonPins(value){
 assert.equal(sha(JSON.stringify(value)),PROFILE_SHA,'Exact new approved-preservation comparison profile; historical pin tables remain unchanged');
 assert.equal(value.schema,'custodial.approved-local-preservation-source-comparison.v1');
 for(const key of ['runtime_admission','release_admission','native_authority','hardware_acceptance','historical_pins_rewritten'])assert.equal(value[key],false);
 assert.equal(value.files.filter(row=>row.kind==='modified').length,13);assert.equal(value.files.filter(row=>row.kind==='added').length,7);
 assert.equal(new Set(value.current_java_inventory.map(row=>row.path)).size,value.current_java_inventory.length);
 return value;
}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const approvedPreservationComparisonPins=freeze(validateApprovedPreservationComparisonPins(JSON.parse(readFileSync(new URL('./fixtures/current-approved-preservation-source-deltas.json',import.meta.url),'utf8'))));
// TEST COMPARISON ONLY. This exact approved delta is outside the older provider
// proofs, just as the existing audio/wire normalizers are. It cannot recover a
// private owner, restore a key, approve a build or grant runtime admission.
// The separate owning contract binds ALL current Java bytes, including additions.
export function normalizeCurrentApprovedPreservation(name,source,{requireKnown=false}={}){
 assert.equal(typeof name,'string');assert.equal(typeof source,'string');assert.equal(typeof requireKnown,'boolean');
 const row=approvedPreservationComparisonPins.files.find(row=>row.path===name||row.name===name||name.endsWith('/'+row.name));
 if(!row)return source;
 const actual=sha(source);
 if(row.kind==='added'){
  if(requireKnown)assert.equal(actual,row.current_sha256,'Exact added current implementation source required');
  return source; // Never invent absent/predecessor bytes for an added type.
 }
 if(actual===row.prior_sha256)return source;
 if(actual!==row.current_sha256){assert.equal(requireKnown,false,'Unknown preservation source cannot be compared as a qualified context');return source;}
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.before.length,h.old_count);assert.equal(h.after.length,h.new_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'Exact approved-preservation reverse hunk');lines.splice(start,h.new_count,...h.before);
 }
 const previous=lines.join('\n');assert.equal(Buffer.byteLength(previous),row.prior_bytes);assert.equal(sha(previous),row.prior_sha256,'Every genuine predecessor byte outside the approved delta is preserved');return previous;
}
