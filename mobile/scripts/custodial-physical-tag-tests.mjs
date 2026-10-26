import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
// Existing local dependencies only; actual Android API compile, synthetic journal fixtures.
const jars=['JUNIT_JAR','HAMCREST_JAR','JSON_JAR','ANDROID_API_JAR'].map(name=>{if(!process.env[name])throw Error(name+' required');return resolve(process.env[name]);});
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../plugins/custodial-native-vault/android/src'),main=join(root,'main/java/org/memphiszoo/custodial/vault'),test=join(root,'test/java/org/memphiszoo/custodial/vault');
const android=new Set(['AndroidReadOnlyPreferences.java','AndroidProtectedWorkPreferences.java','AndroidOfflineAuthorityTimeStore.java','AndroidKeystoreCipher.java','SharedPreferencesVaultPersistence.java','NativeNfcScanHandoff.java']);
const sources=readdirSync(main).filter(name=>name.endsWith('.java')).filter(name=>android.has(name)||!/^import (?:android\.|androidx\.|com\.getcapacitor\.)/m.test(readFileSync(join(main,name),'utf8'))).map(name=>join(main,name));
const owned=mkdtempSync(join(tmpdir(),'custodial-physical-tag-java-'));
try{
 const api=[jars[3],jars[0],jars[1]].join(':');
 for(const [command,args] of [
  ['javac',['-cp',api,'-d',owned,...sources]],
  ['javac',['-cp',`${owned}:${api}`,'-d',owned,join(root,'test/java/android/util/Base64.java'),join(test,'VaultTestDoubles.java'),join(test,'PhysicalTagOccurrenceTest.java')]],
  ['java',['-Xmx256m','-cp',`${owned}:${jars.join(':')}`,'org.junit.runner.JUnitCore','org.memphiszoo.custodial.vault.PhysicalTagOccurrenceTest']],
 ]){const result=spawnSync(command,args,{stdio:'inherit',timeout:120000});if(result.error)throw result.error;if(result.status!==0){process.exitCode=result.status||1;break;}}
}finally{rmSync(owned,{recursive:true,force:true});console.log('Removed owned temporary classes: '+owned);}
