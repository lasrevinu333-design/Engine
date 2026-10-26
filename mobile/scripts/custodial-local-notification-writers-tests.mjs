import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,readdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {prepareCustodialNotificationWriterSources,injectCustodialNotificationWriterOverlay} from './custodial-local-notification-writers.mjs';
const here=fileURLToPath(new URL('../../',import.meta.url));
const actual=process.env.CUSTODIAL_NOTIFICATION_ORIGINAL_ROOT||here;
// This Source-only test's original baseline is pinned below by the production
// verifier, NOT accepted from arbitrary current dependency bytes.
const sha=x=>createHash('sha256').update(x).digest('hex');
const output=mkdtempSync(join(tmpdir(),'custodial-notification-source-check-'));
let ordinal=0;const results=[];
function fixture(){
 const root=join(output,String(++ordinal));mkdirSync(root);mkdirSync(join(root,'mobile/android'),{recursive:true});
 const vendor=join(root,'node_modules/@capacitor/local-notifications');mkdirSync(vendor,{recursive:true});
 cpSync(join(actual,'node_modules/@capacitor/local-notifications/android/src/main'),join(vendor,'android/src/main'),{recursive:true});
 cpSync(join(actual,'node_modules/@capacitor/local-notifications/package.json'),join(vendor,'package.json'));
 cpSync(join(actual,'package-lock.json'),join(root,'package-lock.json'));
 const local='mobile/plugins/custodial-native-vault/android/src/vendor/local-notifications-8.2.1';
 cpSync(join(here,local),join(root,local),{recursive:true});
 return {root,mobile:join(root,'mobile'),vendor,local:join(root,local),generated:join(root,'mobile/android/.custodial-local-notifications-java')};
}
const prepare=f=>prepareCustodialNotificationWriterSources({repositoryRoot:f.root,mobileRoot:f.mobile});
async function test(name,operation){await operation();results.push({name,status:'PASS'});}
await test('actual complete normal vendor source stages exact one class family and repeat verifies read-only',async()=>{
 const f=fixture(),result=await prepare(f),before=Object.fromEntries(readdirSync(f.generated).map(n=>[n,sha(readFileSync(join(f.generated,n)))]));
 assert.equal(result.native_receipt_authority,false);assert.equal(result.version,'8.2.1');
 assert.deepEqual(result.class_files_sha256,before);assert.deepEqual(await prepare(f),result);
 assert.deepEqual(Object.fromEntries(readdirSync(f.generated).map(n=>[n,sha(readFileSync(join(f.generated,n)))])),before);
});
for(const [name,mutate]of[
 ['changed original writer',f=>writeFileSync(join(f.vendor,'android/src/main/java/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.java'),'changed')],
 ['extra original class',f=>writeFileSync(join(f.vendor,'android/src/main/java/com/capacitorjs/plugins/localnotifications/Unknown.java'),'class Unknown {}')],
 ['wrong receiver process/manifest',f=>writeFileSync(join(f.vendor,'android/src/main/AndroidManifest.xml'),'<manifest/>')],
 ['wrong installed version',f=>{let p=JSON.parse(readFileSync(join(f.vendor,'package.json')));p.version='8.2.2';writeFileSync(join(f.vendor,'package.json'),JSON.stringify(p));}],
 ['wrong locked integrity',f=>{let p=JSON.parse(readFileSync(join(f.root,'package-lock.json')));p.packages['node_modules/@capacitor/local-notifications'].integrity='wrong';writeFileSync(join(f.root,'package-lock.json'),JSON.stringify(p));}],
 ['changed reviewed postimage',f=>writeFileSync(join(f.local,'NotificationStorage.java'),'changed')],
 ['unknown patched class',f=>writeFileSync(join(f.local,'Unknown.java'),'class Unknown {}')],
 ['unknown retained generated source',f=>{mkdirSync(f.generated);writeFileSync(join(f.generated,'UNKNOWN.java'),'preserve');}],
 ['symlinked generated source',f=>{let target=join(f.root,'foreign');mkdirSync(target);writeFileSync(join(target,'preserve'),'original');symlinkSync(target,f.generated);}],
])await test(name+' refuses without replacing retained input',async()=>{
 const f=fixture();mutate(f);let before;
 try{before=readFileSync(join(f.generated,'UNKNOWN.java'),'utf8');}catch{}
 await assert.rejects(()=>prepare(f));if(before)assert.equal(readFileSync(join(f.generated,'UNKNOWN.java'),'utf8'),before);
 if(name==='symlinked generated source')assert.equal(readFileSync(join(f.root,'foreign/preserve'),'utf8'),'original');
});
await test('normal overlay adds exactly one fixed line and refuses duplicate',async()=>{
 const source='android { /* ordinary source */ }\n',after=injectCustodialNotificationWriterOverlay(source);
 assert.equal(after,source.trimEnd()+"\n\napply from: rootProject.file('../scripts/custodial-local-notification-writers.gradle')\n");
 assert.equal(injectCustodialNotificationWriterOverlay(after),after);
 assert.throws(()=>injectCustodialNotificationWriterOverlay(after+after));
});
const result={status:'PASS_SOURCE_STAGING_ONLY',groups:results.length,owned_fixture_root:output,results,normal_Gradle_build:false,JVM:false,OS_settlement:false,receipt_authority:false};
console.log(JSON.stringify(result));
