import {coreChildEnvironment} from './custodial-core-release-gate.mjs';
// Actual service source executed against deterministic Android/runtime stubs.
// No production transport, real Android, GPS measurement or phone admission.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assertCurrentGpsInventory,assertBoundCurrentGpsSource} from './current-gps-qualification-source-boundary.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourcePath='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialPhoneLocationService.java';
const original=assertBoundCurrentGpsSource(sourcePath,readFileSync(join(root,sourcePath),'utf8'));
const fixtures=join(root,'scripts/fixtures/current-gps-lifecycle'),stubs=[];
function walk(p){for(const name of readdirSync(p,{withFileTypes:true})){const child=join(p,name.name);if(name.isDirectory())walk(child);else if(name.name.endsWith('.java'))stubs.push(child);}}walk(join(fixtures,'stubs'));stubs.sort();
const temporary=mkdtempSync(join(tmpdir(),'custodial-gps-lifecycle-'));
function run(name,source,wantSuccess){
 const dir=join(temporary,name);mkdirSync(dir);const file=join(dir,'CustodialPhoneLocationService.java'),classes=join(dir,'classes');mkdirSync(classes);writeFileSync(file,source);
 const compile=spawnSync('/usr/bin/javac',['-encoding','UTF-8','-d',classes,...stubs,file,join(fixtures,'LifecycleHarness.java')],{encoding:'utf8',timeout:30000,env:coreChildEnvironment()});
 assert.equal(compile.status,0,compile.stderr||compile.error?.message);
 const result=spawnSync('/usr/bin/java',['-cp',classes,'org.memphiszoo.custodial.vault.LifecycleHarness'],{encoding:'utf8',timeout:30000,env:coreChildEnvironment()});
 assert.equal(result.signal,null);assert.equal(!!result.error,false);assert.equal(result.status===0,wantSuccess,result.stdout+result.stderr);
 if(wantSuccess){assert.match(result.stdout,/RESULT passed=21 failed=0/);process.stdout.write(result.stdout);}
 else{assert.match(result.stdout,/FAIL /);console.log('NEGATIVE_DETECTED',name);}
}
try{
 run('actual',original,true);
 for(const [name,before,after]of [
  ['api26-overload','if(Build.VERSION.SDK_INT>=29)startForeground','if(true)startForeground'],
  ['stale-stop','synchronized(lock){if(stream!=owned)return;stream=null;startId=owned.startId;}','synchronized(lock){stream=null;startId=owned.startId;}'],
 ]){assert.equal(original.split(before).length,2);run(name,original.replace(before,after),false);}
 assert.equal(readFileSync(join(root,sourcePath),'utf8'),original);assertCurrentGpsInventory();
 console.log(JSON.stringify({status:'PASS_CURRENT_GPS_SERVICE_SYNTHETIC',passed:21,negative_controls:2,android_runtime:false,physical_phone:false,release_admission:false}));
}finally{rmSync(temporary,{recursive:true,force:false});}
