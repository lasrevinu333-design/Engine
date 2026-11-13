// Exact CURRENT GPS source binding and explicit historical comparison only.
// This is not runtime authority, release admission, or physical-phone proof.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,relative,dirname,basename,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PROFILE_SHA='5b2d3aad3c8b8de8407a34ceec154bcddbfa14a832fd95dee48ab31fda8592c9';
const DIAGNOSTIC_PROFILE_SHA='3babce12abdf25ee017b5ea03d886ca307a554dad04cbe48720d8ff96b93977f';
const PRESENTATION_PROFILE_SHA='80edd54a897086075c8c07107b11d1a2880056aa323550ece1216b4e31487bc7';
const TERRACOTTA_PROFILE_SHA='a6c9588bc591a676792ceb4376944dd34b01c367cd8519a25a0e8b46ad49c740';
const TIMING_PROFILE_SHA='3ecfd3bcaead83f945fbd86bacc7999097c0f0d7c9d4b117d3cd06651e21a1a7';
const WEB_READINESS_PROFILE_SHA='0d6119a7233ea85307599991e191e61477be292a1bfa9bae4ae3325359a89edf';
const sha=value=>createHash('sha256').update(value).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export function validateCurrentGpsQualification(value){
 assert.ok([PROFILE_SHA,DIAGNOSTIC_PROFILE_SHA,PRESENTATION_PROFILE_SHA,TERRACOTTA_PROFILE_SHA,TIMING_PROFILE_SHA,WEB_READINESS_PROFILE_SHA].includes(sha(JSON.stringify(value))),'Exact separately reviewed GPS or additive diagnostic profile');
 assert.equal(value.schema,'custodial.current-gps-source-qualification.v1');
 for(const key of ['runtime_admission','release_admission','native_authority','hardware_acceptance','historical_pins_rewritten'])assert.equal(value[key],false);
 for(const rows of [value.main_java,value.test_java,value.auxiliary,value.legacy_proofs,value.core_sources,...(value.presentation_sources?[value.presentation_sources]:[])]){
  assert.equal(new Set(rows.map(row=>row.path)).size,rows.length,'No duplicate source identity');
  for(const row of rows){assert.ok(!isAbsolute(row.path)&&!row.path.split('/').some(x=>!x||x==='.'||x==='..'));
   assert.match(row.sha256,/^[0-9a-f]{64}$/);assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>0);}
 }
 assert.equal(value.main_java.length,194);assert.equal(value.test_java.length,[TIMING_PROFILE_SHA,WEB_READINESS_PROFILE_SHA].includes(sha(JSON.stringify(value)))?209:208);
 assert.equal(value.deltas.filter(row=>row.kind==='added'&&row.path.endsWith('.java')).length,[TIMING_PROFILE_SHA,WEB_READINESS_PROFILE_SHA].includes(sha(JSON.stringify(value)))?2:1);
 return value;
}
const originalProfile=JSON.parse(readFileSync(new URL('./fixtures/current-gps-source-qualification.json',import.meta.url),'utf8'));
assert.equal(sha(JSON.stringify(originalProfile)),PROFILE_SHA,'Original v78 qualification pin preserved');
const diagnosticProfile=JSON.parse(readFileSync(new URL('./fixtures/current-schedule-diagnostic-source-qualification.json',import.meta.url),'utf8'));
assert.equal(sha(JSON.stringify(diagnosticProfile)),DIAGNOSTIC_PROFILE_SHA,'Only exact separately reviewed diagnostic candidate is current');
const presentationProfile=JSON.parse(readFileSync(new URL('./fixtures/current-v80-presentation-source-qualification.json',import.meta.url),'utf8'));
assert.equal(sha(JSON.stringify(presentationProfile)),PRESENTATION_PROFILE_SHA,'Exact separately reviewed v80 profile required');
const terracottaProfile=JSON.parse(readFileSync(new URL('./fixtures/current-terracotta-departure-source-qualification.json',import.meta.url),'utf8'));
assert.equal(sha(JSON.stringify(terracottaProfile)),TERRACOTTA_PROFILE_SHA,'Exact Terracotta/departure source candidate required');
const timingProfile=JSON.parse(readFileSync(new URL('./fixtures/current-reminder-timing-source-qualification.json',import.meta.url),'utf8'));
assert.equal(sha(JSON.stringify(timingProfile)),TIMING_PROFILE_SHA,'Exact reminder successor inputs');
const webReadinessProfile=JSON.parse(readFileSync(new URL('./fixtures/current-web-readiness-source-qualification.json',import.meta.url),'utf8'));
assert.equal(sha(JSON.stringify(webReadinessProfile)),WEB_READINESS_PROFILE_SHA,'Exact website-readiness successor inputs');
export const currentGpsQualification=freeze(validateCurrentGpsQualification(webReadinessProfile));
const all=[...currentGpsQualification.main_java,...currentGpsQualification.test_java,...currentGpsQualification.auxiliary,...currentGpsQualification.core_sources,...(currentGpsQualification.presentation_sources||[])];
const byPath=new Map(all.map(row=>[row.path,row]));
const aliases=new Map(Object.entries(currentGpsQualification.basename_aliases));
function canonical(name){
 assert.equal(typeof name,'string');assert.ok(!isAbsolute(name)&&!name.split('/').some(x=>!x||x==='.'||x==='..'),'Canonical source path or explicit unique basename required');
 if(byPath.has(name))return name;
 if(!name.includes('/')&&aliases.has(name)){assert.ok(aliases.get(name),'Ambiguous source basename');return aliases.get(name);}
 if(name.includes('/')&&aliases.has(basename(name)))throw Error('Unregistered source suffix alias');
 return null;
}
function bytesAt(base,path){
 let p=base;const parts=path.split('/');for(const [i,part]of parts.entries()){
  p=resolve(p,part);const stat=lstatSync(p);assert.equal(stat.isSymbolicLink(),false,'No source symlinks: '+path);
  assert.equal(i===parts.length-1?stat.isFile():stat.isDirectory(),true,'Regular source ownership: '+path);
 }return readFileSync(p);
}
function observeJava(base,folder){
 let checked=base;
 for(const part of ['',...folder.split('/')]){
  if(part)checked=resolve(checked,part);const metadata=lstatSync(checked);
  assert.equal(metadata.isSymbolicLink(),false,'No Java traversal-root or ancestor symlink');
  assert.equal(metadata.isDirectory(),true,'Regular Java traversal directory');
 }
 const rows=[];
 function walk(dir){for(const name of readdirSync(dir).sort()){
  const p=resolve(dir,name),info=lstatSync(p);assert.equal(info.isSymbolicLink(),false,'Unknown/symlink Java input');
  if(info.isDirectory())walk(p);else if(name.endsWith('.java')){assert.equal(info.isFile(),true);const bytes=readFileSync(p);rows.push({path:relative(base,p),bytes:bytes.length,sha256:sha(bytes)});}
 }}walk(resolve(base,folder));return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export function assertCurrentGpsInventory(){
 // Deliberately re-read/hash at every owning acceptance. No boolean acceptance
 // cache can conceal a later filesystem mutation or newly added caller.
 for(const [key,folder]of [['main_java','main'],['test_java','test']]){
  assert.deepEqual(observeJava(root,`mobile/plugins/custodial-native-vault/android/src/${folder}/java`),currentGpsQualification[key],'Complete actual GPS Java set, including new callers: '+key);
 }
 assert.deepEqual(observeJava(root,'scripts/fixtures/current-gps-lifecycle'),currentGpsQualification.auxiliary.filter(row=>row.path.startsWith('scripts/fixtures/current-gps-lifecycle/')&&row.path.endsWith('.java')),'Exact lifecycle fixture Java closure; no unlisted stubs');
 for(const row of [...currentGpsQualification.auxiliary,...currentGpsQualification.legacy_proofs,...currentGpsQualification.core_sources,...(currentGpsQualification.presentation_sources||[])]){
  const bytes=bytesAt(root,row.path);assert.equal(bytes.length,row.bytes,'Bound source length: '+row.path);assert.equal(sha(bytes),row.sha256,'Bound source hash: '+row.path);
 }
 for(const folder of currentGpsQualification.presentation_namespace_roots||[]){
  const observed=[];function walk(dir){for(const name of readdirSync(dir).sort()){
   const path=resolve(dir,name),stat=lstatSync(path);assert.equal(stat.isSymbolicLink(),false,'No presentation symlink');
   if(stat.isDirectory())walk(path);else{assert.equal(stat.isFile(),true);observed.push(relative(root,path));}
  }}
  const base=resolve(root,folder);assert.equal(lstatSync(base).isSymbolicLink(),false);walk(base);
  assert.deepEqual(observed.sort(),currentGpsQualification.presentation_sources.filter(r=>r.path.startsWith(folder+'/')).map(r=>r.path).sort(),'Complete presentation namespace, no unknown asset');
 }
 return {main:currentGpsQualification.main_java.length,tests:currentGpsQualification.test_java.length,auxiliary:currentGpsQualification.auxiliary.length};
}
export function assertBoundCurrentGpsSource(name,source){
 const path=canonical(name);assert.ok(path,'Known current GPS source required');assertCurrentGpsInventory();
 const row=byPath.get(path);assert.equal(Buffer.byteLength(source),row.bytes);assert.equal(sha(source),row.sha256,'Actual current bytes required; predecessor is comparison only');return source;
}
export function normalizeCurrentGpsForHistoricalComparison(name,source){
 const path=canonical(name);if(!path)return source;
 const row=currentGpsQualification.deltas.find(row=>row.path===path);if(!row)return source;
 if(row.kind==='added'){
  assert.equal(sha(source),row.current_sha256,'New GPS type must remain actual; never invent an absent predecessor');return source;
 }
 if(sha(source)!==row.current_sha256)return source; // Unknown bytes remain unknown to unchanged historical guards.
 assertCurrentGpsInventory();return reverseGps(row,source);
}
function reverseGps(row,source){
 assert.equal(sha(source),row.current_sha256);
 const lines=source.split('\n');
 for(const h of [...row.hunks].reverse()){
  assert.equal(h.before.length,h.old_count);assert.equal(h.after.length,h.new_count);
  const start=h.new_count===0?h.new_start:h.new_start-1;
  assert.deepEqual(lines.slice(start,start+h.new_count),h.after,'Exact GPS reverse hunk');lines.splice(start,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(Buffer.byteLength(prior),row.prior_bytes);assert.equal(sha(prior),row.prior_sha256,'Every genuine pre-GPS byte preserved');return prior;
}
export function assertGpsHistoricalInventoryProjection(oldMain,oldTests,oldAuxiliary){
 assertCurrentGpsInventory();
 function projected(rows){return rows.filter(row=>!currentGpsQualification.deltas.some(d=>d.path===row.path&&d.kind==='added')).map(row=>{
  const delta=currentGpsQualification.deltas.find(d=>d.path===row.path);
  if(!delta)return row;
  const source=bytesAt(root,row.path).toString('utf8');
  const prior=reverseGps(delta,source);
  return {path:row.path,bytes:Buffer.byteLength(prior),sha256:sha(prior)};
 });}
 assert.deepEqual(projected(currentGpsQualification.main_java),oldMain,'Explicit historical main inventory, not actual current count');
 assert.deepEqual(projected(currentGpsQualification.test_java),oldTests,'Explicit historical test inventory');
 const oldPaths=new Set(oldAuxiliary.map(row=>row.path));
 assert.deepEqual(projected(currentGpsQualification.auxiliary.filter(row=>oldPaths.has(row.path))).sort((a,b)=>a.path.localeCompare(b.path)),oldAuxiliary.map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>a.path.localeCompare(b.path)),'Explicit historical auxiliary inventory');
 return {actual_main:194,historical_main:oldMain.length,historical_projection_only:true};
}
