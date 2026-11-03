import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {chmodSync,copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Source/synthetic prerequisite only. No APK, key creation, device, provider,
// release admission or physical acceptance is produced by this compilation.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(process.argv.length===2||(process.argv.length===3&&process.argv[2]==='--offline'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).sort();
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceRows=tracked.map(path=>{const p=resolve(root,path);assert.ok(p.startsWith(root+'/'));assert.ok(lstatSync(p).isFile()&&!lstatSync(p).isSymbolicLink());return {path,bytes:lstatSync(p).size,sha256:sha(p)};});
const workspace=realpathSync(mkdtempSync(join(tmpdir(),'custodial-core-native-fixture-')));
chmodSync(workspace,0o700);
const snapshot=join(workspace,'source');
for(const row of sourceRows){const target=join(snapshot,row.path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,row.path),target);chmodSync(target,lstatSync(join(root,row.path)).mode&0o777);}
const native=join(snapshot,'mobile/plugins/custodial-native-vault/android');
const lock=join(root,'mobile/native-locks/android/custodial/verification-metadata.xml');
for(const base of [workspace,native]){mkdirSync(join(base,'gradle'),{recursive:true});copyFileSync(lock,join(base,'gradle/verification-metadata.xml'));}
const template=join(root,'node_modules/@capacitor/cli/assets/android-template.tar.gz');
execFileSync('tar',['-xzf',template,'-C',workspace,'gradlew','gradle/wrapper/gradle-wrapper.jar','gradle/wrapper/gradle-wrapper.properties']);
chmodSync(join(workspace,'gradlew'),0o700);
const quote=value=>JSON.stringify(value).replaceAll('$','\\$');
const capacitor=join(root,'node_modules/@capacitor/android/capacitor');
const firebase=join(root,'node_modules/@capacitor-firebase/messaging/android');
for(const p of [capacitor,firebase])assert.ok(existsSync(join(p,'build.gradle')));
writeFileSync(join(workspace,'settings.gradle'),`pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.PREFER_PROJECT); repositories { google(); mavenCentral() } }
rootProject.name='custodial-native-vault'
rootProject.projectDir=file(${quote(native)})
include ':capacitor-android', ':capacitor-firebase-messaging'
project(':capacitor-android').projectDir=file(${quote(capacitor)})
project(':capacitor-firebase-messaging').projectDir=file(${quote(firebase)})
`);
writeFileSync(join(workspace,'fixture.init.gradle'),`gradle.beforeProject { p -> p.layout.buildDirectory.set(new File(${quote(workspace)}+'/build/'+p.name)) }
gradle.projectsEvaluated {
 def p=gradle.rootProject
 def unit=p.tasks.named('testDebugUnitTest',org.gradle.api.tasks.testing.Test).get()
 p.tasks.register('exportSourceJoinClasspath') {
  dependsOn p.tasks.named('compileDebugUnitTestJavaWithJavac')
  dependsOn unit.classpath
  doLast { new File(${quote(workspace)}+'/classpath.txt').setText(unit.classpath.files.collect { it.canonicalPath }.join(File.pathSeparator),'UTF-8') }
 }
}
`);
const args=['--no-daemon','--max-workers=2','--dependency-verification','strict','-Pandroid.useAndroidX=true','-Dorg.gradle.jvmargs=-Xmx768m -XX:MaxMetaspaceSize=512m','--project-cache-dir',join(workspace,'project-cache'),'-p',native,'--settings-file',join(workspace,'settings.gradle'),'-I',join(workspace,'fixture.init.gradle'),'exportSourceJoinClasspath'];
if(process.argv.includes('--offline'))args.unshift('--offline');
const result=spawnSync(join(workspace,'gradlew'),args,{cwd:root,env:process.env,stdio:'inherit',timeout:300000});
assert.equal(result.error,undefined,result.error?.message);assert.equal(result.signal,null);assert.equal(result.status,0,'Current synthetic fixture must actually compile');
for(const row of sourceRows){assert.equal(sha(join(root,row.path)),row.sha256,'Source changed during fixture preparation');assert.equal(sha(join(snapshot,row.path)),row.sha256,'Compiled source snapshot differs');}
const entries=readFileSync(join(workspace,'classpath.txt'),'utf8').split(delimiter).filter(existsSync).map(p=>realpathSync(p));
const artifacts=[];
function inventory(path){const st=lstatSync(path);assert.ok(!st.isSymbolicLink());if(st.isDirectory()){for(const n of readdirSync(path).sort())inventory(join(path,n));}else{assert.ok(st.isFile());artifacts.push({path,bytes:st.size,sha256:sha(path)});}}
for(const path of entries)inventory(path);
const probe=JSON.parse(execFileSync('/usr/bin/java',['-Xmx256m','-cp',entries.join(delimiter),'org.memphiszoo.custodial.vault.NativeCompletionArgumentStdinProbe','fixture'],{encoding:'utf8',timeout:10000,maxBuffer:1048576}));
assert.ok(probe.p_client_completion_id&&probe.p_device_id);
const metadata={schema:'custodial.core-native-source-fixture.v1',source_commit:git('rev-parse','HEAD'),source_files:sourceRows,classpath:entries,artifacts,workspace,verification_metadata_sha256:sha(lock),compile_exit:0,synthetic:true,production:false,release_admission:false,physical_acceptance:false,hardware_keystore:false};
const output=join(root,'build/core-native-fixture');mkdirSync(output,{recursive:true,mode:0o700});
writeFileSync(join(output,'manifest.json'),JSON.stringify(metadata,null,2)+'\n',{mode:0o600});
mkdirSync(join(root,'build/provenance'),{recursive:true});
writeFileSync(join(root,'build/provenance/core-native-fixture.json'),JSON.stringify(metadata,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({status:'SOURCE_SYNTHETIC_FIXTURE_COMPILED',source_files:sourceRows.length,classpath_entries:entries.length,artifact_files:artifacts.length,manifest_sha256:sha(join(output,'manifest.json')),physical_acceptance:false,release_admission:false}));
