import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {providerDecisionCurrent219Pins as pins,validateProviderDecisionCurrent219Pins,withoutProviderDecisionCurrent219} from './provider-event-decision-current219-source-boundary.mjs';

// Called by the mandatory owning wire contract. Only the exact bounded pure
// function is evaluated; storage-runner JAR checks/process/JVM are not run.
export function runProviderDecisionCurrent219ContractTests(){
 const sha=x=>createHash('sha256').update(x).digest('hex');let checks=0;
 const check=(name,fn)=>{fn();checks++;console.log('PASS CURRENT219',name);};
 const current=readFileSync(pins.path,'utf8'),prior=withoutProviderDecisionCurrent219(pins.path,current);
 check('actual source exact and prior complete runner preserved',()=>{assert.equal(pins.base,'de9246596a4eae802c60946d7603910a13390978');assert.equal(sha(current),pins.current_sha256);assert.equal(sha(prior),'3b9c9f6e8ad88bd686f65d830f9ff6cbddbd29b4a18da913553827fc783eca9e');assert.equal(withoutProviderDecisionCurrent219(pins.path,prior),prior);});
 check('both old JSON authorities untouched',()=>{assert.equal(sha(readFileSync('scripts/fixtures/provider-event-decision-wire-byte-deltas.json')),'4ec48c4024fca21ed44aa57e311c8b97df55a0322fa08ad5f58bb142a782013d');assert.equal(sha(readFileSync('scripts/fixtures/provider-event-decisions-byte-deltas.json')),'904a8e1caf413dc7b22189bc3772599b6d394faf4763fe7e726cdd149694e3f8');});
 const manifest=pins.migration_manifest,historical=manifest.filter(row=>row.file!=='20261003121757_employee_message_source_admission.sql');
 check('portable manifest is exact source-derived219 not observed engine acceptance',()=>{assert.equal(pins.backend_source.commit,'08e27b65c6b62111a09a089a7447376ebb937b6a');assert.equal(pins.backend_source.tree,'6d3d3ef9685075f6befa7d28e3b9b0a9777d2b5b');assert.equal(sha(JSON.stringify(manifest)),pins.migration_manifest_sha256);assert.equal(pins.migration_manifest_sha256,'4795b9525622e1512005f85ae1c5994971dccc3d54a987a743bdcfef8bf9ce32');assert.equal(sha(JSON.stringify(historical)),'24503cfe852d7668ac94744b2f9ed21d8d2556906b917c7016e0f6c2d3b8d7a1');});
 const matches=[...current.matchAll(/\/\/ BEGIN exact event-decision migration authority[^\n]*\n([\s\S]*?)\/\/ END exact event-decision migration authority\./g)];
 assert.equal(matches.length,1);const block=matches[0][1];
 assert.doesNotMatch(block,/readFile|process\.|exec|spawn|require\(|import |fetch|new Function/);
 const evaluate=runInNewContext(`(json,profile,useDefault)=>{${block};const rows=JSON.parse(json);return JSON.stringify(useDefault?assertProviderDecisionSqlManifest(rows):assertProviderDecisionSqlManifest(rows,JSON.parse(profile)));}`,{assert,sha});
 const validate=(rows,...profile)=>JSON.parse(evaluate(JSON.stringify(rows),JSON.stringify(profile[0]),profile.length===0));
 check('actual pure consumer gate accepts exact current219 by explicit/default profile',()=>{for(const value of [validate(manifest),validate(manifest,'CURRENT_219')])assert.deepEqual(value,{profile:'CURRENT_219',migration_count:219,manifest_sha256:pins.migration_manifest_sha256});});
 check('historical218 remains explicit and cannot satisfy current consumption',()=>{assert.deepEqual(validate(historical,'HISTORICAL_218'),{profile:'HISTORICAL_218',migration_count:218,manifest_sha256:'24503cfe852d7668ac94744b2f9ed21d8d2556906b917c7016e0f6c2d3b8d7a1'});assert.throws(()=>validate(historical));assert.throws(()=>validate(historical,'CURRENT_219'));assert.throws(()=>validate(manifest,'HISTORICAL_218'));});
 const oldAssertion=prior.match(/    assert\.equal\(sha\(JSON\.stringify\(proof\.migration_manifest\)\), '24503cfe[^\n]+/g);
 check('exact prior consumption assertion reproduces current219 rejection',()=>{assert.equal(oldAssertion.length,1);const old=runInNewContext(`json=>{const proof=JSON.parse(json);${oldAssertion[0]}}`,{assert,sha});old(JSON.stringify({migration_manifest:historical}));assert.throws(()=>old(JSON.stringify({migration_manifest:manifest})));});
 for(const profile of [null,'',218,219,'AUTO','CURRENT_220',{},[]])check('unknown profile refused',()=>assert.throws(()=>validate(manifest,profile)));
 for(const [profile,rows] of [['CURRENT_219',manifest],['HISTORICAL_218',historical]]){
  for(const [name,mutate] of [
   ['missing',x=>x.pop()],['extra',x=>x.push({file:'20261005000000_unowned.sql',sha256:'a'.repeat(64)})],['reversed',x=>x.reverse()],
   ['duplicate',x=>x[4]={...x[5]}],['old-byte drift',x=>x[30].sha256='0'.repeat(64)],['null hash',x=>x[0].sha256=null],
   ['extra field',x=>x[0].extra=true],['malformed',x=>x[0]=null],['unsafe file',x=>x[0].file='../source.sql'],
   ['owning hash',x=>x.at(-1).sha256='0'.repeat(64)],['owning file',x=>x.at(-1).file='20261004000001_unowned.sql'],
   ['owning order',x=>[x[x.length-2],x[x.length-1]]=[x[x.length-1],x[x.length-2]]],
  ])check(profile+' '+name+' fails closed',()=>{const bad=structuredClone(rows);mutate(bad);assert.throws(()=>validate(bad,profile));});
 }
 for(const mutate of [x=>x.splice(205,1),x=>x.push({...x[205]}),x=>x[205].sha256='0'.repeat(64),x=>x[205].file='20261003121758_employee_message_source_admission.sql',x=>x[205].extra=true])
  check('only exact MESSAGE row can be subtracted',()=>{const bad=structuredClone(manifest);mutate(bad);assert.throws(()=>validate(bad));});
 check('live consumption invokes current profile before native allocation and retains exact provenance',()=>{assert.equal((current.match(/assertProviderDecisionSqlManifest\(proof\.migration_manifest, 'CURRENT_219'\)/g)||[]).length,1);assert.ok(current.indexOf("assertProviderDecisionSqlManifest(proof.migration_manifest, 'CURRENT_219')")<current.indexOf('const owned = mkdtempSync'));for(const text of ["proof.migration_manifest_sha256, sha(JSON.stringify(proof.migration_manifest)+'\\n')","proof.owning_migration, proof.migration_manifest.at(-1)","value.native_input.frontend, frontendBinding","frontendBinding.jars","NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256"])assert.ok(current.includes(text),text);});
 for(const changed of [current+'\n// extra',current.slice(1),prior+' ',current.replace('Xmx256m','Xmx512m'),current.replace('timeout: 120000','timeout: 240000'),current.replace("proof.migration_manifest, 'CURRENT_219'","proof.migration_manifest, 'HISTORICAL_218'")])
  check('outside or unauthorized in-hunk source mutation rejected',()=>assert.throws(()=>withoutProviderDecisionCurrent219(pins.path,changed)));
 for(const mutate of [x=>x.extra=true,x=>x.base='0'.repeat(40),x=>x.path='../other',x=>x.prior_sha256='0'.repeat(64),x=>x.current_sha256='0'.repeat(64),
  x=>x.hunks.pop(),x=>x.hunks.reverse(),x=>x.hunks.push(x.hunks[0]),x=>x.hunks[0].extra=true,x=>x.hunks[0].old_start++,x=>x.hunks[0].new_start++,
  x=>x.hunks[0].old_count++,x=>x.hunks[0].new_count++,x=>x.hunks[0].after.push(''),x=>x.hunks[0].before.push(''),
  x=>x.migration_manifest.pop(),x=>x.migration_manifest.reverse(),x=>x.migration_manifest[0].sha256='0'.repeat(64),x=>x.backend_source.commit='0'.repeat(40)])
  check('malformed extra or reordered finite metadata refuses normalization',()=>{const bad=structuredClone(pins);mutate(bad);assert.throws(()=>validateProviderDecisionCurrent219Pins(bad));});
 for(const bad of [null,{},[],{hunks:[]},'other'])check('unknown pin container rejected',()=>assert.throws(()=>validateProviderDecisionCurrent219Pins(bad)));
 return {status:'PASS',checks,scope:'current219 manifest actual pure consumer and finite reverse source delta only',jvm:false,sql:false,browser:false};
}
