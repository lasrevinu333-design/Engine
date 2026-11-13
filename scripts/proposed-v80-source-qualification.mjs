// UNREVIEWED PROPOSAL. Not imported by owning gates. Never grants release,
// runtime, native authority or hardware acceptance. Historical validators stay intact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PROFILE_SHA='c23504018e73adf56be595a800893f50718eabf1f8791b75b1546aa9845f7300';
const hash=b=>createHash('sha256').update(b).digest('hex');
const preserved=new Map([
 ['scripts/fixtures/current-gps-source-qualification.json','b74eefca2dc5bb540f1feea835c874b58519193f23236a893a05cc99a3c793f6'],
 ['scripts/fixtures/current-schedule-diagnostic-source-qualification.json','2fa7deada8380d282b0c46a0da98c0499b2750e8a6d3e8a74566ffdeeebc6d26'],
 ['scripts/current-gps-qualification-source-boundary.mjs','3bf6378b38e4e919382e3aaa567f1de1e811d6cd78a1268175ffc1996a0a2ae4']
]);
function regular(path){
 assert.equal(typeof path,'string');assert.ok(!isAbsolute(path));
 const parts=path.split('/');assert.ok(parts.every(p=>p&&p!=='.'&&p!=='..'));
 let p=root;assert.ok(!lstatSync(p).isSymbolicLink());
 for(const [i,part]of parts.entries()){
  p=resolve(p,part);const stat=lstatSync(p);assert.ok(!stat.isSymbolicLink(),path);
  assert.ok(i===parts.length-1?stat.isFile():stat.isDirectory(),path);
 }return readFileSync(p);
}
function javaRows(folder){
 const rows=[];
 function walk(path){
  const stat=lstatSync(path);assert.ok(!stat.isSymbolicLink());
  if(stat.isDirectory())for(const n of readdirSync(path).sort())walk(resolve(path,n));
  else if(path.endsWith('.java')){assert.ok(stat.isFile());const b=readFileSync(path);rows.push({path:relative(root,path),bytes:b.length,sha256:hash(b)});}
 }
 // Validate every directory ancestor, even when the Java leaves are ordinary files.
 let p=root;for(const part of folder.split('/')){p=resolve(p,part);const s=lstatSync(p);assert.ok(s.isDirectory()&&!s.isSymbolicLink());}
 walk(p);return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export function inspectProposedV80Identity(){
 const bytes=regular('scripts/fixtures/proposed-v80-presentation-source-qualification.json');assert.equal(hash(bytes),PROFILE_SHA);
 const p=JSON.parse(bytes);assert.equal(p.schema,'custodial.v80-presentation-source-qualification.proposed.v1');assert.equal(p.review_status,'UNREVIEWED');
 for(const key of ['runtime_admission','release_admission','native_authority','hardware_acceptance','historical_pins_rewritten'])assert.equal(p[key],false);
 for(const [path,sha]of preserved)assert.equal(hash(regular(path)),sha,'Historical pin unchanged');
 assert.equal(new Set(p.sources.map(r=>r.path)).size,p.sources.length);
 for(const row of p.sources){const b=regular(row.path);assert.equal(b.length,row.bytes,row.path);assert.equal(hash(b),row.sha256,row.path);}
 for(const [key,part]of [['main_java','main'],['test_java','test']])assert.deepEqual(javaRows(`mobile/plugins/custodial-native-vault/android/src/${part}/java`),p[key]);
 const prefix='scripts/v80-correction-tests/';
 assert.deepEqual(readdirSync(resolve(root,prefix)).sort(),p.sources.filter(r=>r.path.startsWith(prefix)).map(r=>r.path.slice(prefix.length)).sort());
 assert.deepEqual(p.deltas.map(r=>r.path).sort(),['mobile/scripts/configure-native-links.mjs','mobile/src/custodial/app.js','mobile/src/custodial/employee-schedule-runtime.js'].sort());
 for(const delta of p.deltas){const row=p.sources.find(r=>r.path===delta.path);assert.ok(row);assert.equal(row.sha256,delta.candidate_sha256);assert.equal(row.bytes,delta.candidate_bytes);}
 return {status:'PROPOSED_IDENTITY_MATCH_ONLY',sources:p.sources.length,runtime_admission:false,release_admission:false,reviewed:false};
}
