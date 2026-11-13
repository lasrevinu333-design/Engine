import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateRetainedNativeBridgePins(value){assert.equal(sha(JSON.stringify(value)),'23f8e29ae696270e457c4cdd6ba29fd176f9316d86a1066fcabb9d638607c202','exact retained native bridge source and reverse hunks');return value;}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const retainedNativeBridgePins=freeze(validateRetainedNativeBridgePins(JSON.parse(readFileSync(new URL('./fixtures/retained-native-bridge-byte-delta.json',import.meta.url),'utf8'))));
/** Preserve the final23dfef13 single Events route and GPS lifecycle fixes. This
 * helper is historical source comparison only; not a runtime or admission API. */
export function withoutRetainedNativeBridge(path,source){
 const p=retainedNativeBridgePins;if(path!==p.path)return source;
 if(sha(source)===p.prior_sha256)return source;
 assert.equal(sha(source),p.current_sha256,'complete retained native bridge source');
 const lines=source.split('\n');for(const h of [...p.hunks].reverse()){
  const index=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(index,index+h.new_count),h.after);lines.splice(index,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),p.prior_sha256,'all prior bridge bytes restored without removing actual repairs');return prior;
}
