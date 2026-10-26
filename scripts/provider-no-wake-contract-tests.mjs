import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {noWakePins,validateNoWakePins,withoutProviderNoWake} from './provider-no-wake-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
let checks=0;const check=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const current=readFileSync(new URL('../memphis-device-reminders.js',import.meta.url),'utf8');
check(sha(current),noWakePins.current_sha256,'complete actual successor hash');
const prior=withoutProviderNoWake('memphis-device-reminders.js',current);
check(sha(prior),noWakePins.prior_sha256,'whole frozen predecessor reconstructed without Git');
check(withoutProviderNoWake('memphis-device-reminders.js',prior),prior,'exact predecessor remains idempotent');
assert.doesNotMatch(current,/\.turnScreenOn\s*(?:\?\.)?\s*\(|\.bringToForeground\s*(?:\?\.)?\s*\(/);checks++;
check((prior.match(/\.turnScreenOn/g)||[]).length,3,'fail-before contains the two wake calls plus the legacy capability check');
check((prior.match(/\.bringToForeground/g)||[]).length,3,'fail-before contains both foreground calls and legacy check');
for(const changed of [current+'\n// unowned',current.slice(1),current.replace(noWakePins.hunks[0].after[0],noWakePins.hunks[0].after[0]+' ')]){assert.throws(()=>withoutProviderNoWake('memphis-device-reminders.js',changed));checks++;}
for(const change of [v=>v.extra=true,v=>v.current_sha256='a'.repeat(64),v=>v.prior_sha256='b'.repeat(64),v=>v.hunks.reverse(),v=>v.hunks.pop(),v=>v.hunks[0].before[0]+=' ']){
 const mutated=structuredClone(noWakePins);change(mutated);assert.throws(()=>validateNoWakePins(mutated));checks++;
}
check(withoutProviderNoWake('unrelated.js','unchanged bytes'),'unchanged bytes','no unrelated normalization');
console.log(JSON.stringify({status:'NO_WAKE_WHOLE_SOURCE_BOUNDARY_PASS',checks,physical:false}));
