import {normalizeCurrentNativeScheduleWire} from './native-schedule-wire-source-boundary.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function validateNoWakePins(value){
 assert.equal(sha(JSON.stringify(value)),'ca0a0261a0f9d6a410038c99b86edbafd9f630c46e2e0fe37d7ca14c38bcf8b7','exact whole no-wake inventory');return value;
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const noWakePins=freeze(validateNoWakePins(JSON.parse(readFileSync(new URL('./fixtures/provider-no-wake-byte-delta.json',import.meta.url),'utf8'))));
/** Normalize only this complete pinned four-line wake removal before older
 * accepted source guards. No arbitrary new bytes, historical pin rewrite or
 * unknown delta is accepted. Actual changed renderer has its own VM proof. */
export function withoutProviderNoWake(name,source){
 source=normalizeCurrentNativeScheduleWire(name,source);
 if(name!==noWakePins.name)return source;
 if(sha(source)===noWakePins.prior_sha256)return source;
 assert.equal(sha(source),noWakePins.current_sha256,'exact whole no-wake successor source');
 const lines=source.split('\n');
 for(const h of [...noWakePins.hunks].reverse()){
  assert.deepEqual(lines.slice(h.start,h.start+h.after.length),h.after,'exact bounded no-wake reverse hunk');
  lines.splice(h.start,h.after.length,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),noWakePins.prior_sha256,'all prior bytes outside wake removal preserved');return prior;
}
