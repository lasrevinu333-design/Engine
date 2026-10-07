import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {providerRetainedSchedulePins as pins,validateProviderRetainedSchedulePins,withoutProviderRetainedSchedule} from './provider-retained-schedule-source-boundary.mjs';
import {withoutProviderClassification} from './provider-classification-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');let checks=0;
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const reject=fn=>{assert.throws(fn);checks++;};
equal(pins.path,'mobile/src/custodial/bridge.js','one owning source path');
equal(pins.finding,'F-BRIDGE-001','exact independently reported changed-input finding');
equal(pins.base,'9ab56e00a77d026308616030b0d833b3dfecb7a7','frozen current source base');
equal(pins.prior_origin,'d743857db917f881f2e80523320c3bc02358144e','earlier capability correction remains distinct');
equal(pins.prior_sha256,'04195aaf8c725da5fba681e3e1604bf1b3941e256c4f30dd831a5218b1179188','full d743 predecessor');
equal(pins.current_sha256,'f19bef25304276cb3872b1340cd96f6188d119bb89f8171225896f8d23893175','full corrected bridge');
equal(pins.hunks.length,1,'one bounded reconciliation hunk');
equal([pins.hunks[0].old_start,pins.hunks[0].old_count,pins.hunks[0].new_start,pins.hunks[0].new_count],
 [1916,2,1916,8],'no shifted or additional source ownership');
const current=readFileSync(pins.path,'utf8');
function requireCurrent(source){
 assert.equal(sha(source),pins.current_sha256,'owning source must include this correction');
 return withoutProviderRetainedSchedule(pins.path,source);
}
const prior=requireCurrent(current);checks++;
equal(sha(prior),pins.prior_sha256,'reverse hunk restores every exact prior byte');
equal(withoutProviderRetainedSchedule(pins.path,prior),prior,'composition may pass the exact predecessor');
equal(sha(withoutProviderClassification(pins.path,current)),
 '429c336d07a481b9b548cf432e6fd1917ec24715d15b76fb9d1c9d8770b680f3','both distinct deltas restore frozen574 bridge');
reject(()=>requireCurrent(prior)); // An exact reversal is NOT current source acceptance.
for(const source of [
 current+'\n// outside-hunk mutation',current.slice(1),
 current.replace('notificationPresentation.snapshot().capable\n      ?nativeNotificationScheduler.reconcile()',
  'notificationPresentation.native\n      ?nativeNotificationScheduler.reconcile()'),
 current.replace('?nativeNotificationScheduler.reconcile():Promise.resolve(false);',
  '?nativeNotificationScheduler.reconcile():nativeNotificationScheduler.reconcile();'),
 current.replace('&&results[0].value!==false',''),
 current.replace('[nativeReconciliation,notificationPresenter?.retry()]','[nativeReconciliation]'),
 current.replace('  function notificationChannel(', '  function changedNotificationChannel('),
 prior+'\n// prior-hash mismatch',
])reject(()=>withoutProviderRetainedSchedule(pins.path,source));
for(const mutate of [
 value=>value.extra=true,value=>value.path='other.js',value=>value.base='0'.repeat(40),
 value=>value.prior_sha256='0'.repeat(64),value=>value.current_sha256='0'.repeat(64),
 value=>value.hunks=[],value=>value.hunks.push(value.hunks[0]),
 value=>value.hunks[0].extra=true,value=>value.hunks[0].new_start++,value=>value.hunks[0].old_count++,
 value=>value.hunks[0].after.push(''),value=>value.hunks[0].before.reverse(),
 value=>value.hunks[0].after[0]+=' ',value=>value.hunks[0].before[0]+=' ',
]){const mutated=structuredClone(pins);mutate(mutated);reject(()=>validateProviderRetainedSchedulePins(mutated));}
for(const value of [null,[],{},'untrusted'])reject(()=>validateProviderRetainedSchedulePins(value));
equal(Object.isFrozen(pins)&&Object.isFrozen(pins.hunks)&&Object.isFrozen(pins.hunks[0].after),true,'immutable exact pin ownership');
equal(sha(readFileSync('scripts/provider-retained-schedule-source-boundary.mjs')),
 '9c6d179c3d34898cf9818a3f7b01a12e31425f50307a40c2e61c0431370325d4','exact new guard helper');
equal(sha(readFileSync('scripts/native-notification-arrival-boundary-tests.mjs')),
 'fa3efe4598cc4327d0ae82110f9cacadb311b9880d96da342f58e5c14047a90c','exact actual-bridge retained/lifecycle regression');
equal(sha(readFileSync('scripts/fixtures/provider-classification-byte-deltas.json')),
 'f382e593a1d70866f4a7e429379961e98210ee099c08524811e033752a031360','old classification and d743 pins never rewritten');
console.log(JSON.stringify({status:'PROVIDER_RETAINED_SCHEDULE_BOUNDARY_PASS',checks,
 scope:'exact F-BRIDGE-001 reverse delta and hostile pin/source mutations; no runtime activation or policy change'}));
