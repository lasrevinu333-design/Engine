import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {retainedNativeBridgePins as p,validateRetainedNativeBridgePins,withoutRetainedNativeBridge} from './retained-native-bridge-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');let checks=0;
const current=readFileSync(new URL('../'+p.path,import.meta.url),'utf8');assert.equal(sha(current),p.current_sha256);checks++;
const prior=withoutRetainedNativeBridge(p.path,current);assert.equal(sha(prior),p.prior_sha256);checks++;
assert.equal(withoutRetainedNativeBridge(p.path,prior),prior);checks++;
assert.match(current,/\['employee-events.html', 'events.html'\]/);checks++;
assert.match(current,/if \(!current\(\)\) \{ removeGpsListener\(resume\); return; \}/);checks++;
assert.match(current,/activeGpsSuspended = true;activeGpsGeneration\+\+/);checks++;
assert.match(current,/if\(event.persisted && activeGpsSuspended\)/);checks++;
for(const hostile of [current+' ',current.slice(1),current.replace('activeGpsSuspended = true;activeGpsGeneration++','activeGpsSuspended = false;activeGpsGeneration++')]){assert.throws(()=>withoutRetainedNativeBridge(p.path,hostile));checks++;}
for(const mutate of [x=>x.extra=true,x=>x.hunks.pop(),x=>x.hunks.reverse(),x=>x.current_sha256='a'.repeat(64),x=>x.prior_sha256='b'.repeat(64)]){const hostile=structuredClone(p);mutate(hostile);assert.throws(()=>validateRetainedNativeBridgePins(hostile));checks++;}
console.log(JSON.stringify({status:'RETAINED_NATIVE_BRIDGE_SOURCE_PASS',checks,phone:false,whole_ci:false}));
