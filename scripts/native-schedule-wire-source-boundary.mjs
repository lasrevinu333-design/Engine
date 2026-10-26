import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {normalizeCurrentLocationCueWording} from './location-cue-wording-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export const scheduleWirePins=freeze(JSON.parse(readFileSync(new URL('./fixtures/native-schedule-wire-byte-delta.json',import.meta.url),'utf8')));
assert.equal(sha(JSON.stringify(scheduleWirePins)),'9a174b9ee52092628fd256374622fb5ddb1d3462b3c86e401954ed7ace2348bd','exact complete five-file SCHEDULE delta; no unknown source is normalized');
// TEST-COMPARISON ONLY. Runtime never imports this or restores old protocols.
export function normalizeCurrentNativeScheduleWire(name,source){
 source=normalizeCurrentLocationCueWording(name,source);
 const r=scheduleWirePins.files.find(x=>x.path===name||x.name===name||name.endsWith('/'+x.name));
 if(!r||sha(source)!==r.current_sha256)return source;
 const lines=source.split('\n');for(const h of [...r.hunks].reverse()){
  const start=h.new_count===0?h.new_start:h.new_start-1;assert.deepEqual(lines.slice(start,start+h.new_count),h.after);lines.splice(start,h.new_count,...h.before);
 }const prior=lines.join('\n');assert.equal(sha(prior),r.prior_sha256);return prior;
}
