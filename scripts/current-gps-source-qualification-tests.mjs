// Current-byte inventory and adversarial source controls. No runtime admission.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,symlinkSync,renameSync} from 'node:fs';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {currentGpsQualification as profile,validateCurrentGpsQualification,assertCurrentGpsInventory,assertBoundCurrentGpsSource,normalizeCurrentGpsForHistoricalComparison as normalize,assertGpsHistoricalInventoryProjection} from './current-gps-qualification-source-boundary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),sha=b=>createHash('sha256').update(b).digest('hex');
let checks=0;const pass=name=>{checks++;console.log('PASS',name);};
const counts=assertCurrentGpsInventory();assert.equal(counts.main,194);assert.equal(counts.tests,209);pass('actual current 194 main and 209 native tests bound without unknown callers');
const oldMain=JSON.parse(readFileSync(join(root,'scripts/fixtures/current-approved-preservation-source-deltas.json'))).current_java_inventory;
const oldContext=JSON.parse(readFileSync(join(root,'scripts/fixtures/current-provider-comparison-context.json')));
assert.equal(assertGpsHistoricalInventoryProjection(oldMain,oldContext.current_test_java_inventory,oldContext.current_auxiliary_inventory).historical_main,193);pass('separate complete historical projection remains exactly193, never current');
for(const row of profile.deltas){
 const actual=readFileSync(join(root,row.path),'utf8');assert.equal(assertBoundCurrentGpsSource(row.path,actual),actual);
 // A root path such as index.html is already canonical. A nested file with
 // the same basename must never borrow that root file's source identity.
 const short=basename(row.path),bound=[...profile.main_java,...profile.test_java,...profile.auxiliary,...profile.core_sources,...profile.presentation_sources];
 const shortTarget=bound.some(x=>x.path===short)?short:profile.basename_aliases[short];
 if(shortTarget===row.path)assert.equal(assertBoundCurrentGpsSource(short,actual),actual);
 else assert.throws(()=>assertBoundCurrentGpsSource(short,actual));
 assert.throws(()=>assertBoundCurrentGpsSource(row.path,actual+'\n'));
 if(row.kind==='added'){
  assert.equal(normalize(row.path,actual),actual);assert.throws(()=>normalize(row.path,''));
 }else{
  const previous=normalize(row.path,actual);assert.equal(sha(previous),row.prior_sha256);assert.equal(Buffer.byteLength(previous),row.prior_bytes);assert.throws(()=>assertBoundCurrentGpsSource(row.path,previous));
  assert.equal(normalize(row.path,actual+'\n'),actual+'\n','Unknown argument cannot acquire a historical view');
 }
 pass('current identity and exact historical delta '+basename(row.path));
}
const sample=profile.deltas.find(row=>row.kind==='modified'),bytes=readFileSync(join(root,sample.path),'utf8');
for(const bad of ['../'+sample.path,'/'+sample.path,'unregistered/'+basename(sample.path),'scripts/../'+sample.path])assert.throws(()=>assertBoundCurrentGpsSource(bad,bytes));
assert.equal(normalize('unrelated.java','unknown'),'unknown');pass('traversal,absolute and suffix aliases rejected');
for(const mutate of [v=>v.release_admission=true,v=>v.runtime_admission=true,v=>v.main_java.pop(),v=>v.test_java.push(v.test_java[0]),v=>v.auxiliary[0].sha256='0'.repeat(64),v=>v.deltas[0].current_sha256='0'.repeat(64),v=>v.deltas.find(x=>x.hunks?.length).hunks[0].after.push('unknown'),v=>v.core_sources.pop(),v=>v.legacy_proofs.pop()]){
 const value=structuredClone(profile);mutate(value);assert.throws(()=>validateCurrentGpsQualification(value));
}pass('profile flags,sets,hashes,hunks,core gates and historical proofs cannot be rewritten');
// Mutate only a newly owned temporary source tree. Reuse the same loaded
// validator after first success to expose any cached-acceptance blind spot.
const temporary=mkdtempSync(join(tmpdir(),'custodial-gps-source-negatives-'));
try{
 const paths=new Set([...profile.main_java,...profile.test_java,...profile.auxiliary,...profile.legacy_proofs,...profile.core_sources,...profile.presentation_sources].map(row=>row.path));
 // Profiles are validator inputs copied explicitly; putting the selected
 // profile in its own hashed inventory would introduce a self-hash cycle.
 paths.add('scripts/fixtures/current-program-startup-messenger-r22-source-qualification.json');paths.add('scripts/fixtures/current-program-startup-messenger-r21-source-qualification.json');paths.add('scripts/fixtures/current-program-startup-messenger-source-qualification.json');paths.add('scripts/fixtures/current-web-readiness-source-qualification.json');paths.add('scripts/fixtures/current-reminder-timing-source-qualification.json');paths.add('scripts/fixtures/current-terracotta-departure-source-qualification.json');paths.add('scripts/fixtures/current-v80-presentation-source-qualification.json');paths.add('scripts/fixtures/current-schedule-diagnostic-source-qualification.json');paths.add('scripts/current-gps-qualification-source-boundary.mjs');paths.add('scripts/fixtures/current-gps-source-qualification.json');
 for(const path of paths){const target=join(temporary,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,readFileSync(join(root,path)));}
 writeFileSync(join(temporary,'package.json'),'{"type":"module"}\n');
 const isolated=await import(pathToFileURL(join(temporary,'scripts/current-gps-qualification-source-boundary.mjs')));
 assert.equal(isolated.assertCurrentGpsInventory().main,194);
 const changeRows=[...profile.deltas,profile.main_java.find(x=>!profile.deltas.some(d=>d.path===x.path)),profile.test_java.find(x=>!profile.deltas.some(d=>d.path===x.path)),profile.auxiliary.find(x=>!profile.deltas.some(d=>d.path===x.path)),profile.legacy_proofs[0],profile.core_sources[0],profile.presentation_sources[0]];
 for(const row of changeRows){const path=join(temporary,row.path),before=readFileSync(path);writeFileSync(path,Buffer.concat([before,Buffer.from('\n')]));assert.throws(()=>isolated.assertCurrentGpsInventory());writeFileSync(path,before);assert.equal(isolated.assertCurrentGpsInventory().main,194);}
 pass('later byte changes in every delta plus unchanged main/test/aux/proof/core are rejected without cached approval');
 const main=join(temporary,profile.main_java[0].path),test=join(temporary,profile.test_java[0].path);
 const stub=join(temporary,profile.auxiliary.find(row=>row.path.startsWith('scripts/fixtures/current-gps-lifecycle/stubs/')&&row.path.endsWith('.java')).path);
 for(const original of [main,test,stub]){
  const unknown=join(dirname(original),'UnreviewedGpsCaller.java');writeFileSync(unknown,'class UnreviewedGpsCaller {}\n');assert.throws(()=>isolated.assertCurrentGpsInventory());rmSync(unknown);
  const moved=original+'.held';renameSync(original,moved);assert.throws(()=>isolated.assertCurrentGpsInventory());renameSync(moved,original);
  const before=readFileSync(original);rmSync(original);symlinkSync(moved,original);assert.throws(()=>isolated.assertCurrentGpsInventory());rmSync(original);writeFileSync(original,before);
 }
 pass('new,missing,renamed and symlink main/test/stub Java never enter qualification');
 for(const folder of profile.presentation_namespace_roots){const p=join(temporary,folder,'unlisted.css');writeFileSync(p,'body{}');assert.throws(()=>isolated.assertCurrentGpsInventory());rmSync(p);}
 pass('unlisted presentation files rejected');
 for(const relative of ['mobile/plugins/custodial-native-vault/android/src/main/java','mobile/plugins/custodial-native-vault/android/src/test/java','mobile/plugins/custodial-native-vault/android/src/main','scripts/fixtures/current-gps-lifecycle']){
  const directory=join(temporary,relative),held=directory+'.held';renameSync(directory,held);symlinkSync(held,directory,'dir');
  assert.throws(()=>isolated.assertCurrentGpsInventory());rmSync(directory);renameSync(held,directory);
 }pass('Java traversal roots and ancestors cannot be substituted by identical-directory symlinks');
 for(const row of profile.deltas.filter(x=>x.kind==='modified')){
  const original=join(temporary,row.path),actual=readFileSync(original,'utf8');writeFileSync(original,normalize(row.path,actual));assert.throws(()=>isolated.assertCurrentGpsInventory());writeFileSync(original,actual);
 }pass('genuine predecessor substitution is not actual current source');
 assert.equal(isolated.assertCurrentGpsInventory().main,194);
}finally{rmSync(temporary,{recursive:true,force:false});}
assertCurrentGpsInventory();
console.log(JSON.stringify({status:'PASS_CURRENT_GPS_SOURCE_QUALIFICATION',checks,current_main:194,current_tests:209,historical_main:193,historical_projection_only:true,runtime_admission:false,release_admission:false,physical_phone:false}));
