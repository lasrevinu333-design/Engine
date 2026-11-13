import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {approvedPreservationComparisonPins as pins,validateApprovedPreservationComparisonPins,normalizeCurrentApprovedPreservation as normalize} from './current-approved-preservation-source-boundary.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>readFileSync(resolve(root,name)),prefix='mobile/plugins/custodial-native-vault/android/src/main/java/';
const inventory=[];function walk(folder){for(const name of readdirSync(folder).sort()){const p=resolve(folder,name),s=lstatSync(p);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory())walk(p);else if(name.endsWith('.java')){const b=readFileSync(p);inventory.push({path:relative(root,p),bytes:b.length,sha256:sha(b)});}}}walk(resolve(root,prefix));inventory.sort((a,b)=>a.path<b.path?-1:1);assert.deepEqual(inventory,pins.current_java_inventory,'Every actual current Java file is bound; no unknown caller or implementation addition');
let checks=1;
for(const row of pins.files){
 const actual=read(row.path).toString('utf8');assert.equal(sha(actual),row.current_sha256);checks++;
 const result=normalize(row.path,actual,{requireKnown:true});
 if(row.kind==='modified'){
  const previous=read(row.prior_source_reference).toString('utf8');assert.equal(sha(previous),row.prior_sha256);assert.equal(result,previous);assert.equal(normalize(row.name,previous,{requireKnown:true}),previous);checks+=3;
 }else{assert.equal(result,actual);checks++;}
 assert.throws(()=>normalize(row.path,actual+'\n',{requireKnown:true}));assert.equal(normalize(row.path,actual+'\n'),actual+'\n','Unknown context stays unknown for the unchanged downstream historical guard');checks+=2;
}
for(const change of [v=>v.runtime_admission=true,v=>v.files.pop(),v=>v.files[0].current_sha256='0'.repeat(64),v=>v.files.find(x=>x.hunks.length).hunks[0].after.push('unknown'),v=>v.current_java_inventory.pop()]){const value=structuredClone(pins);change(value);assert.throws(()=>validateApprovedPreservationComparisonPins(value));checks++;}
assert.equal(inventory.find(row=>row.path.endsWith('/AndroidKeystoreCipher.java')).sha256,'04257ca59fd0b34cd896447f2445cb7b67b54597ccaf9ec5b1f17446ec9b39cb');checks++;
console.log(JSON.stringify({status:'PASS_EXACT_CURRENT_PRESERVATION_AND_HISTORICAL_COMPARISON_CONTEXT',checks,current_java_files:inventory.length,modified_predecessors:13,added_current_types:7,historical_pin_tables_changed:false,scope:'Exact source comparison and unknown-context negatives only; current dynamic native tests remain separate',runtime_admission:false,release_admission:false,native_authority:false,hardware_acceptance:false}));
