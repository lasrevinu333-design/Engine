import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {providerEventDecisionPins as pins,validateProviderEventDecisionPins,withoutProviderEventDecisions} from './provider-event-decisions-source-boundary.mjs';
import {withoutProviderDecisionWire} from './provider-event-decision-wire-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');let checks=0;
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;},reject=fn=>{assert.throws(fn);checks++;};
equal(pins.base,'6b013c48f1d430f4a229cf5d812fb6926c095111','exact integrated predecessor');
equal(pins.files.map(row=>row.name),['NativeProviderEventReceipts.java','NativeProviderHttp.java','NativeProviderJournal.java','NativeProviderRuntimeOwner.java','VaultEngine.java'],'five existing provider-only source deltas');
function requireCurrent(row,source){assert.equal(sha(source),row.current_sha256,'current caller required, predecessor is not acceptance');return withoutProviderEventDecisions(row.name,source);}
for(const row of pins.files){
 const current=readFileSync(row.path,'utf8'),prior=requireCurrent(row,current);checks++;
 equal(sha(prior),row.prior_sha256,'all original bytes restored: '+row.name);
 equal(withoutProviderEventDecisions(row.name,prior),prior,'exact predecessor normalization idempotent');
 reject(()=>requireCurrent(row,prior));
 for(const changed of [current+'\n// unknown delta',current.slice(1),prior+' ',current.replace(row.hunks[0].after[0],row.hunks[0].after[0]+' ')])reject(()=>withoutProviderEventDecisions(row.name,changed));
}
equal(pins.pinned.length,6,'one new class, four focused tests and one owning runner');
for(const row of pins.pinned)equal(sha(withoutProviderDecisionWire(row.path,readFileSync(row.path,'utf8'))),row.sha256,'exact new class/test/runner after separately pinned test-only wire delta: '+row.path);
for(const mutate of [p=>p.extra=true,p=>p.base='0'.repeat(40),p=>p.files.pop(),p=>p.files.reverse(),p=>p.files.push(p.files[0]),
 p=>p.files[0].path='other',p=>p.files[0].prior_sha256='0'.repeat(64),p=>p.files[0].current_sha256='0'.repeat(64),
 p=>p.files[0].hunks=[],p=>p.files[0].hunks.push(p.files[0].hunks[0]),p=>p.files[0].hunks[0].extra=true,
 p=>p.files[0].hunks[0].new_start++,p=>p.files[0].hunks[0].old_count++,p=>p.files[0].hunks[0].after.push(''),
 p=>p.files[0].hunks[0].before.push(''),p=>p.pinned.pop(),p=>p.pinned[0].sha256='0'.repeat(64)]){
 const value=structuredClone(pins);mutate(value);reject(()=>validateProviderEventDecisionPins(value));
}
for(const value of [null,{},[],{files:[]},'unknown'])reject(()=>validateProviderEventDecisionPins(value));
equal(Object.isFrozen(pins)&&Object.isFrozen(pins.files)&&Object.isFrozen(pins.files[0].hunks[0].after),true,'immutable pinned delta');
equal(sha(readFileSync('scripts/provider-event-decisions-source-boundary.mjs')),'d55e4bf5ee7c760150aba952be38d1b7e00d38cfb3e91ff89940d09e6145eda3','exact portable owning helper');
for(const [name,hash] of Object.entries({
 'classification':'f382e593a1d70866f4a7e429379961e98210ee099c08524811e033752a031360',
 'maintenance':'6b42cc547adee79ca266743485567195a624700dc65796fbb374450e088f4bbc',
 'interval':'45eef127d2db84f7ef8433e1aeadbd27a5485a6f76c642da965b559b45c06eea',
 'retained-schedule':'056332f452878da155222cf8554d2c2a9e45caf226903dfd23513fa76b995d67',
}))equal(sha(readFileSync('scripts/fixtures/provider-'+name+'-byte-deltas.json')),hash,'historical pins unchanged: '+name);
const java='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/';
const read=name=>readFileSync(java+name,'utf8');
equal(sha(read('NativeProviderClockExchange.java')),'d2fbc56a8818a459a8c4d29d31d63408fc5430de445e14e54facdfb28fb836b8','decision is not a clock-authorizing route');
const typed=read('NativeProviderEventDecisions.java'),engine=read('VaultEngine.java'),journal=read('NativeProviderJournal.java'),owner=read('NativeProviderRuntimeOwner.java');
assert.match(typed,/"ORIGINAL_ACCEPTED"/);assert.match(typed,/"UNRESOLVED"/);assert.doesNotMatch(typed,/PERMANENTLY_DENIED|clockOwner|\.put\("admission_bounds"/);checks+=3;
assert.match(typed,/query.bodySha256.equals\(exchange.bodySha256\)/);assert.match(typed,/exchange.requestId.equals\(data.get\("native_request_id"\)\)/);checks+=2;
assert.match(typed,/ProviderWireJson.same\(query.requester\(\), data.getJSONObject\("requester"\)\)/);checks++;
assert.match(journal,/decisionRemaining\(snapshot, current, query.batch\);[\s\S]*settleEvents\(current, query.batch, receipts\)/);checks++;
assert.match(engine,/finally \{ VaultValidation.wipe\(credential\); if \(query != null\) query.close\(\); \}/);checks++;
assert.match(owner,/lookupNativeProviderEventDecisions\(batch,principals,legacy,journal,delivery.http,invocation.attempt\);\}\s*if\(!batch.events.isEmpty\(\)\)\{requireDelivery\(\);engine.sendNativeProviderEvents/);checks++;
const runner=readFileSync('mobile/scripts/custodial-provider-storage-tests.mjs','utf8');
equal(runner.match(/tests.push\('NativeProviderEventDecisionsTest'\)/g)?.length,1,'mandatory focused JVM inclusion exactly once');
console.log(JSON.stringify({status:'PROVIDER_EVENT_DECISIONS_SOURCE_PASS',checks,scope:'exact native original-acceptance caller and hostile portable byte guards; no permanent disposition, qualification or activation'}));
