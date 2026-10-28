#!/usr/bin/env node
// Explicit owner-test artifact. This never issues production/install admission.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyAndroidApkBackupSecurity} from './verify-android-apk-backup.mjs';
import {assertCustodialReleaseManifest,resolveCustodialAndroidTools} from './verify-custodial-android-release.mjs';
import {readCustodialBuildScope} from './custodial-new-producer-scope-policy.mjs';
const mobile=resolve(fileURLToPath(new URL('..',import.meta.url))),root=resolve(mobile,'..');
const env={...process.env,MZ_APP_EDITION:'custodial',MZ_SHELL_START:'1'};
assert.match(env.MZ_BUILD_NUMBER||'',/^[1-9]\d*$/,'Set the explicitly allocated MZ_BUILD_NUMBER');
assert.equal(env.MZ_RELEASE_VERSION,'1.0.0','Use the maintained Custodial versionName');
assert.ok(!env.PROJECT_BUILD_NUMBER&&!env.BUILD_NUMBER,'Use only MZ_BUILD_NUMBER for this test artifact');
assert.ok(!env.MZ_CUSTODIAL_BROWSER_TEST,'Native test artifacts cannot use browser test fixtures');
assert.equal(readCustodialBuildScope(mobile).profile,'full-system');
function run(command,args,cwd=mobile,capture=false){return execFileSync(command,args,{cwd,env,stdio:capture?['ignore','pipe','pipe']:'inherit',encoding:capture?'utf8':undefined,maxBuffer:32*1024*1024});}
function node(script,args=[]){return run(process.execPath,[join(mobile,'scripts',script),...args]);}
const sourceCommit=run('git',['rev-parse','HEAD'],root,true).trim();
const sourceTree=run('git',['rev-parse','HEAD^{tree}'],root,true).trim();
assert.equal(run('git',['status','--porcelain','--untracked-files=normal'],root,true).trim(),'','Commit source and refresh its normal manifest before building');
run(process.execPath,['scripts/refresh-frontend-release-manifest.mjs','--check'],root);
node('build.mjs');
const cap=join(root,'node_modules/@capacitor/cli/bin/capacitor');
if(!existsSync(join(mobile,'android')))run(process.execPath,[cap,'add','android']);
run(process.execPath,[cap,'sync','android']);
node('configure-firebase.mjs',['android']);
node('configure-branding.mjs');
node('configure-native-links.mjs',['android']);
node('configure-android-backup.mjs');
node('configure-native-release.mjs',['android-version']);
const manifestPath=join(mobile,'android/app/src/main/AndroidManifest.xml');
let manifest=readFileSync(manifestPath,'utf8');
assert.equal((manifest.match(/<application\b/g)||[]).length,1);
assert.doesNotMatch(manifest,/android:testOnly|org\.memphiszoo\.custodial\.TEST_ARTIFACT/,'Start with a newly generated Android project for every test build');
manifest=manifest.replace('<application','<application android:testOnly="true"').replace('</application>','    <meta-data android:name="org.memphiszoo.custodial.TEST_ARTIFACT" android:value="owner-first-test-v1" />\n    </application>');
writeFileSync(manifestPath,manifest);
const stringsPath=join(mobile,'android/app/src/main/res/values/strings.xml');
writeFileSync(stringsPath,readFileSync(stringsPath,'utf8').replace(/(<string name="(?:app_name|title_activity_main)">)[^<]*(<\/string>)/g,'$1Memphis Zoo Custodial TEST$2'));
const sdk=env.ANDROID_HOME||env.ANDROID_SDK_ROOT;assert.ok(sdk,'ANDROID_HOME is required');
const tools=resolveCustodialAndroidTools(join(sdk,'build-tools/35.0.1'));
const tool=(name)=>tools[name];
run(join(mobile,'android/gradlew'),['--no-daemon','--max-workers=2','--dependency-verification=strict',':app:assembleRelease'],join(mobile,'android'));
const output=join(root,'build/first-test');mkdirSync(output,{recursive:true});
const unsigned=join(output,`custodial-first-test-${env.MZ_BUILD_NUMBER}-unsigned.apk`);
copyFileSync(join(mobile,'android/app/build/outputs/apk/release/app-release-unsigned.apk'),unsigned);
let artifact=unsigned,signer=null;
const signingKeys=['CM_KEYSTORE_PATH','CM_KEYSTORE_PASSWORD','CM_KEY_ALIAS','CM_KEY_PASSWORD'];
if(signingKeys.some(k=>env[k])){
 assert.ok(signingKeys.every(k=>env[k]),'Existing fleet keystore signing inputs must be complete');
 artifact=join(output,`custodial-first-test-${env.MZ_BUILD_NUMBER}.apk`);
 run(tool('zipalign'),['-f','-p','4',unsigned,artifact]);
 run(tool('apksigner'),['sign','--ks',env.CM_KEYSTORE_PATH,'--ks-key-alias',env.CM_KEY_ALIAS,'--ks-pass','env:CM_KEYSTORE_PASSWORD','--key-pass','env:CM_KEY_PASSWORD',artifact]);
 const signature=run(tool('apksigner'),['verify','--verbose','--print-certs',artifact],mobile,true);
 signer=signature.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/)?.[1];
 assert.equal(signer,JSON.parse(readFileSync(join(mobile,'release-policies/custodial-android.json'))).fleet_signer_sha256,'TEST update must use the existing fleet signer');
}
const badging=run(tool('aapt2'),['dump','badging',artifact],mobile,true);
const xml=run(tool('aapt2'),['dump','xmltree',artifact,'--file','AndroidManifest.xml'],mobile,true);
assert.match(badging,new RegExp(`package: name='org.memphiszoo.custodial' versionCode='${env.MZ_BUILD_NUMBER}'`));
assert.match(xml,/android:testOnly[^\n]*(?:true|0xffffffff)/);
assert.match(xml,/org\.memphiszoo\.custodial\.TEST_ARTIFACT/);
assert.match(badging,/Memphis Zoo Custodial TEST/);
assert.doesNotMatch(badging,/application-debuggable/);
const readAsset=name=>run('unzip',['-p',artifact,'assets/public/'+name],mobile,true);
for(const name of ['employee-schedule.html','messages.html','events.html','employee-feedback.html']){
 const html=readAsset(name);assert.ok(html.length>1000,name+' missing');assert.doesNotMatch(html,/New admissions are deferred|available in a later release/i,name+' is deferred');
}
const build=JSON.parse(readAsset('build.json'));assert.equal(build.source_commit,sourceCommit);assert.equal(build.source_tree,sourceTree);
assert.ok(!build.cleaning_first_scope);
const backup=verifyAndroidApkBackupSecurity(artifact,{aapt2Path:tool('aapt2')});
// Exercise production refusal independently of the old fleet ceiling.
// aapt2 badging may omit testOnly; the compiled manifest remains authoritative.
// This is a negative check only, never a production admission.
assert.throws(()=>assertCustodialReleaseManifest({manifestDump:xml,badgingDump:badging,expectedBuildNumber:Number(env.MZ_BUILD_NUMBER),enforceStagedRecoveryCeiling:false}),/must not be testOnly|Compiled Android manifest and aapt2 badging metadata differ/);
const bytes=readFileSync(artifact);
const receipt={schema:'custodial.owner-first-test-artifact.v1',purpose:'OWNER_TEST_ONLY',production_admission:false,physical_acceptance:false,install_performed:false,source_commit:sourceCommit,source_tree:sourceTree,package_name:'org.memphiszoo.custodial',version_code:Number(env.MZ_BUILD_NUMBER),version_name:env.MZ_RELEASE_VERSION,scope:'full-system',test_only:true,debuggable:false,production_verifier_rejected:true,backup_policy:backup.policy,artifact,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signer_sha256:signer,retained_data_update_signer_verified:!!signer,clock_audio_qualification:'NOT_CREATED_BY_TEST_BUILD',limitations:['Physical testing is owner work.','Production release admission remains separate.','Native clock/audio qualification is not fabricated by this route.']};
writeFileSync(join(output,'artifact.json'),JSON.stringify(receipt,null,2)+'\n');
writeFileSync(join(output,'manifest.txt'),xml);writeFileSync(join(output,'badging.txt'),badging);
console.log(JSON.stringify(receipt,null,2));
