import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync,readdirSync} from 'node:fs';
import {delimiter,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function readCoreNativeFixtureClasspath(){
 const file=join(root,'build/core-native-fixture/manifest.json');
 assert.ok(lstatSync(file).isFile()&&!lstatSync(file).isSymbolicLink(),'Prepared source fixture must be a regular file');
 const m=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(m.schema,'custodial.core-native-source-fixture.v1');assert.equal(m.compile_exit,0);assert.equal(m.synthetic,true);
 for(const key of ['production','release_admission','physical_acceptance','hardware_keystore'])assert.equal(m[key],false);
 assert.equal(m.source_commit,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),'Prepared fixture must belong to this exact source commit');
 const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).sort();
 assert.deepEqual(m.source_files.map(x=>x.path),tracked);
 for(const row of m.source_files){const p=resolve(root,row.path);assert.ok(p.startsWith(root+'/'));assert.ok(lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink());assert.equal(lstatSync(p).size,row.bytes);assert.equal(sha(p),row.sha256,'Prepared fixture source mismatch: '+row.path);}
 const expected=new Map(m.artifacts.map(x=>[x.path,x]));assert.equal(expected.size,m.artifacts.length);
 const observed=new Set();
 function verify(p){const st=lstatSync(p);assert.ok(!st.isSymbolicLink());if(st.isDirectory()){for(const n of readdirSync(p).sort())verify(join(p,n));}else{const row=expected.get(p);assert.ok(st.isFile()&&row,'Unexpected fixture classpath member');assert.equal(st.size,row.bytes);assert.equal(sha(p),row.sha256);observed.add(p);}}
 assert.ok(Array.isArray(m.classpath)&&m.classpath.length>0);
 for(const p of m.classpath){assert.equal(resolve(p),p);verify(p);}
 assert.equal(observed.size,expected.size,'Fixture classpath members must remain exact');
 return m.classpath.join(delimiter);
}
