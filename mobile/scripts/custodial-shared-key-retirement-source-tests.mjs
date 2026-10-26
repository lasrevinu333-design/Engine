import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Explicit host-only source lane. No Gradle, APK, Android/host keystore or network.
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
sources.push(path.join(main,'AndroidKeystoreCipher.java'),
  path.resolve(here,'../plugins/custodial-native-vault/android/src/test/java/org/memphiszoo/custodial/vault/AndroidSharedKeyRetirementSourceProbe.java'),
  path.join(here,'fixtures/shared-key-source/android/util/Base64.java'));
const classes=fs.mkdtempSync(path.join(os.tmpdir(),'mz-shared-key-regression-'));fs.chmodSync(classes,0o700);
const st=fs.lstatSync(classes),identity={path:classes,dev:st.dev,ino:st.ino,uid:st.uid,gid:st.gid,mode:st.mode&0o777};
console.log('Owned source-test classes '+JSON.stringify({...identity,cleanup:'Remove only exact custody-proven new directory on success/failure'}));
const started=performance.now();let result=null,passed=[],failure=null;
try{
  const cp=options.get('json-jar')+':'+options.get('android-jar');
  const commands=[['javac',['-J-Xmx256m','-proc:none','-cp',cp,'-d',classes,...sources],16000],
    ['java',['-Xmx128m','-cp',classes+':'+cp,'org.memphiszoo.custodial.vault.AndroidSharedKeyRetirementSourceProbe'],8000]];
  for(const [command,args,timeout] of commands){
    const run=spawnSync(command,args,{encoding:'utf8',timeout,maxBuffer:524288});
    process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
    if(run.error||run.signal||run.status!==0)throw new Error(command+' source check failed');
    if(command==='java'){
      passed=(run.stdout??'').split('\n').filter(line=>line.startsWith('PASS ')).map(line=>line.slice(5));
      result=JSON.parse((run.stdout??'').split('\n').find(line=>line.startsWith('RESULT ')).slice(7));
      assert.equal(passed.length,8);assert.equal(new Set(passed).size,8);
      assert.deepEqual(result,{cases:8,pass:8,fail:0,skip:0,actual_finalizer_executed:true,synthetic_memory_only_keystore:true,phone_proof:false});
    }
  }
}catch(error){failure=error;process.exitCode=1;}
finally{
  const after=fs.lstatSync(classes);assert.ok(after.isDirectory()&&!after.isSymbolicLink());
  for(const key of ['dev','ino','uid','gid'])assert.equal(after[key],identity[key]);assert.equal(after.mode&0o777,0o700);
  fs.rmSync(classes,{recursive:true,force:false});assert.equal(fs.existsSync(classes),false);
  console.log('Owned source-test classes absent '+JSON.stringify(identity));
  if(options.has('junit')){
    const seconds=((performance.now()-started)/1000).toFixed(6),escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
    const rows=passed.map(name=>`    <testcase classname="AndroidSharedKeyRetirementSourceProbe" name="${escape(name)}"/>`);
    if(failure)rows.push('    <testcase classname="AndroidSharedKeyRetirementSourceProbe" name="source_lane_failure"><failure message="Source compilation or assertion failed; see bounded output"/></testcase>');
    fs.writeFileSync(options.get('junit'),`<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n  <testsuite name="shared-key-retirement-source" tests="${rows.length}" failures="${failure?1:0}" errors="0" skipped="0" time="${seconds}">\n${rows.join('\n')}\n  </testsuite>\n</testsuites>\n`,{flag:'wx',mode:0o600});
  }
}
if(failure)throw failure;
console.log(JSON.stringify({...result,classes_absent:true,app_build:false,independent_review:false}));
