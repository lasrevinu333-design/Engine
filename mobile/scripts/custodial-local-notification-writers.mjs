import {createHash} from 'node:crypto';
import {readFile,readdir,lstat,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {compiledScopeSource,readCustodialBuildScope} from './custodial-new-producer-scope-policy.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const FAMILY='com/capacitorjs/plugins/localnotifications';
const OVERLAY="apply from: rootProject.file('../scripts/custodial-local-notification-writers.gradle')";
const assert=(ok,message)=>{if(!ok)throw Error('Custodial native notification Source refused: '+message);};
async function regular(path){const st=await lstat(path);assert(st.isFile()&&!st.isSymbolicLink(),'nonregular input '+path);return readFile(path);}
async function names(path){const list=await readdir(path,{withFileTypes:true});assert(list.every(x=>x.isFile()&&!x.isSymbolicLink()),'unknown source entry '+path);return list.map(x=>x.name).sort();}
export function injectCustodialNotificationWriterOverlay(source){
 const lines=source.split('\n'),count=lines.filter(x=>x===OVERLAY).length;assert(count<=1,'duplicate normal vendor overlay');
 return count?source:source.trimEnd()+'\n\n'+OVERLAY+'\n';
}
/** Existing normal configure-native-release owns this call. It stages ONE
 * exact same vendor class family; it never edits installed dependency Source. */
export async function prepareCustodialNotificationWriterSources({repositoryRoot,mobileRoot,scopeTicket=readCustodialBuildScope(mobileRoot)}) {
 const vendor=join(repositoryRoot,'node_modules/@capacitor/local-notifications');
 const patched=join(mobileRoot,'plugins/custodial-native-vault/android/src/vendor/local-notifications-8.2.1');
 const spec=JSON.parse((await regular(join(patched,'SOURCE_BINDING.json'))).toString('utf8'));
 assert(spec.schema==='custodial.normal-local-notifications-writers-source.v1'&&spec.version==='8.2.1'
  &&spec.package==='@capacitor/local-notifications'&&spec.native_receipt_authority===false,'source binding');
 const lock=JSON.parse((await regular(join(repositoryRoot,'package-lock.json'))).toString('utf8'));
 const packageEntry=lock.packages?.['node_modules/@capacitor/local-notifications'];
 assert(packageEntry?.version===spec.version&&packageEntry.integrity===spec.npm_integrity,'normal exact dependency lock');
 const pkg=JSON.parse((await regular(join(vendor,'package.json'))).toString('utf8'));
 assert(pkg.name===spec.package&&pkg.version===spec.version,'installed vendor version');
 assert(sha(await regular(join(vendor,'android/src/main/AndroidManifest.xml')))===spec.original_manifest_sha256,'normal receiver manifest differs');
 const original=join(vendor,'android/src/main/java',FAMILY),expected=Object.keys(spec.java_files).sort();
 assert(JSON.stringify(await names(original))===JSON.stringify(expected),'complete original Java census differs');
 const replacements=expected.filter(x=>spec.java_files[x].modified);
 assert(JSON.stringify(await names(patched))===JSON.stringify([...replacements,'SOURCE_BINDING.json'].sort()),'patched Java census differs');
 const bytes=new Map();
 for(const name of expected){
  assert(/^[A-Za-z][A-Za-z0-9]*\.java$/.test(name),'fixed normal class name');
  const binding=spec.java_files[name],raw=await regular(join(original,name));
  assert(sha(raw)===binding.original_sha256,'original vendor bytes changed '+name);
  const source=binding.modified?await regular(join(patched,name)):raw;
  assert(sha(source)===binding.patched_sha256,'reviewed patched bytes changed '+name);bytes.set(name,source);
 }
 bytes.set('CustodialNewProducerScope.java',Buffer.from(compiledScopeSource('com.capacitorjs.plugins.localnotifications',scopeTicket)));
 const generatedExpected=[...expected,'CustodialNewProducerScope.java'].sort();
 const generated=join(mobileRoot,'android','.custodial-local-notifications-java');
 // Preserve any unknown prior output. Exact already-staged bytes may be read,
 // but no file is overwritten or an unrecognized directory cleared/adopted.
 let existed=false;try{const info=await lstat(generated);assert(info.isDirectory()&&!info.isSymbolicLink(),'unsafe existing generated source');existed=true;}
 catch(e){if(e.code!=='ENOENT')throw e;}
 if(!existed){await mkdir(generated,{recursive:false});for(const[name,raw]of bytes)await writeFile(join(generated,name),raw,{flag:'wx'});}
 assert(JSON.stringify(await names(generated))===JSON.stringify(generatedExpected),'generated exact class census differs');
 for(const[name,raw]of bytes)assert(sha(await regular(join(generated,name)))===sha(raw),'generated class readback differs '+name);
 return Object.freeze({schema:'custodial.normal-local-notifications-writers-configured.v1',version:spec.version,
  generated_source_root:resolve(generated),source_binding_sha256:sha(await regular(join(patched,'SOURCE_BINDING.json'))),
  class_files_sha256:Object.fromEntries([...bytes].map(([name,raw])=>[name,sha(raw)])),native_receipt_authority:false});
}
