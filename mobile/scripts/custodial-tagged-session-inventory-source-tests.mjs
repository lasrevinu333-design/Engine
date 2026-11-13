import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Explicit host source lane; no Gradle/APK, network, key provider or phone access.
const here=path.dirname(fileURLToPath(import.meta.url));
const options=new Map(process.argv.slice(2).map(value=>{
  const match=value.match(/^--(android-jar|json-jar|junit)=(.+)$/);
  if(!match)throw new Error('Expected explicit existing compile dependency paths');
  return [match[1],path.resolve(match[2])];
}));
for(const name of ['android-jar','json-jar']){
  const value=options.get(name);assert.ok(value,`--${name} is required`);
  const st=fs.lstatSync(value);assert.ok(st.isFile()&&!st.isSymbolicLink(),`Invalid ${name}`);
}
const main=path.resolve(here,'../plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault');
const sources=fs.readdirSync(main).filter(name=>name.endsWith('.java')).sort().map(name=>path.join(main,name))
  .filter(file=>!/^import (?:android\.|androidx\.|com\.getcapacitor\.)/m.test(fs.readFileSync(file,'utf8')));
sources.push(...['AndroidOfflineAuthorityTimeStore.java','AndroidProtectedWorkPreferences.java','AndroidReadOnlyPreferences.java','AndroidKeystoreCipher.java'].map(name=>path.join(main,name)),
  path.resolve(here,'../plugins/custodial-native-vault/android/src/test/java/org/memphiszoo/custodial/vault/NativeTaggedSessionInventorySourceProbe.java'),
  path.join(here,'fixtures/shared-key-source/android/util/Base64.java'));
const classes=fs.mkdtempSync(path.join(os.tmpdir(),'mz-tagged-session-regression-'));fs.chmodSync(classes,0o700);
const st=fs.lstatSync(classes),identity={path:classes,dev:st.dev,ino:st.ino,uid:st.uid,gid:st.gid,mode:st.mode&0o777};
console.log('Owned source-test classes '+JSON.stringify({...identity,cleanup:'Remove only exact custody-proven new directory on success/failure'}));
let result=null,passed=[],failure=null;const started=performance.now();
try{
  const cp=options.get('json-jar')+':'+options.get('android-jar');
  for(const [command,args,timeout] of [['javac',['-J-Xmx256m','-proc:none','-cp',cp,'-d',classes,...sources],16000],
    ['java',['-Xmx128m','-cp',classes+':'+cp,'org.memphiszoo.custodial.vault.NativeTaggedSessionInventorySourceProbe'],6000]]){
    const run=spawnSync(command,args,{encoding:'utf8',timeout,maxBuffer:524288});process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
    if(run.error||run.signal||run.status!==0)throw new Error(command+' source check failed');
    if(command==='java'){
      passed=(run.stdout??'').split('\n').filter(line=>line.startsWith('PASS ')).map(line=>line.slice(5));
      result=JSON.parse((run.stdout??'').split('\n').find(line=>line.startsWith('RESULT ')).slice(7));
      assert.equal(passed.length,12);assert.equal(new Set(passed).size,12);
      assert.deepEqual(result,{cases:12,pass:12,mismatches:0,actual_current_writer_and_reader:true,synthetic_memory_only_storage_and_cipher:true,physical_tag_proof:false,server_acceptance_proof:false});
    }
  }
}catch(error){failure=error;process.exitCode=1;}
finally{
  const after=fs.lstatSync(classes);assert.ok(after.isDirectory()&&!after.isSymbolicLink());
  for(const key of ['dev','ino','uid','gid'])assert.equal(after[key],identity[key]);assert.equal(after.mode&0o777,0o700);
  fs.rmSync(classes,{recursive:true,force:false});assert.equal(fs.existsSync(classes),false);console.log('Owned source-test classes absent '+JSON.stringify(identity));
  if(options.has('junit')){
    const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
    const rows=passed.map(name=>`<testcase classname="NativeTaggedSessionInventorySourceProbe" name="${escape(name)}"/>`);
    if(failure)rows.push('<testcase classname="NativeTaggedSessionInventorySourceProbe" name="source_lane_failure"><failure message="Compilation or assertion failed; see bounded output"/></testcase>');
    fs.writeFileSync(options.get('junit'),`<?xml version="1.0" encoding="UTF-8"?>\n<testsuites><testsuite name="tagged-session-inventory-source" tests="${rows.length}" failures="${failure?1:0}" errors="0" skipped="0" time="${((performance.now()-started)/1000).toFixed(6)}">\n${rows.join('\n')}\n</testsuite></testsuites>\n`,{flag:'wx',mode:0o600});
  }
}
if(failure)throw failure;
console.log(JSON.stringify({...result,classes_absent:true,app_build:false,independent_review:false}));
