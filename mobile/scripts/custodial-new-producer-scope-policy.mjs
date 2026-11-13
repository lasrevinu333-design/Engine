import assert from 'node:assert/strict';
import {readFileSync,lstatSync,existsSync} from 'node:fs';
import {mkdir,writeFile,readdir,lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseDeterministicJson} from './custodial-capacitor-runtime-policy.mjs';
import {parseAaptXmlTree} from './verify-android-apk-backup.mjs';
import {custodialPackagedRealmContainment,cleaningFirstDeferredPage,CLEANING_FIRST_DEFERRED_PAGES} from './custodial-initial-release-pages.mjs';
import {inspectCustodialNewProducerScopeDexSemantics} from './verify-custodial-dex-semantics.mjs';
import {compareCustodialCallbackDexContinuity,isActualCallbackDexContinuityComparison} from './custodial-callback-dex-continuity.mjs';
import {assertCustodialCallbackReference,custodialCallbackReferenceDexEntries,custodialCallbackReferenceEvidence} from './custodial-callback-reference-admission.mjs';
export const CLEANING_SCOPE='cleaning-first-retained-continuity-v1';
export const SCOPE_MARKER='org.memphiszoo.custodial.NEW_PRODUCER_SCOPE';
export const SCOPE_ASSET='custodial-new-producer-scope.json';
const tickets=new WeakSet(),proofs=new WeakSet();
const sha=b=>createHash('sha256').update(b).digest('hex');
const exact=(v,keys)=>assert.deepEqual(Object.keys(v).sort(),[...keys].sort());
function regular(p){const s=lstatSync(p);assert.ok(s.isFile()&&!s.isSymbolicLink());return readFileSync(p);}
export function scopeModule(profile){
 assert.ok(['full-system',CLEANING_SCOPE].includes(profile));
 return `// Immutable Source-owned release scope; no caller, URL, preference or environment switch.\nexport const CUSTODIAL_NEW_PRODUCER_SCOPE = ${JSON.stringify(profile)};\nexport function custodialNewProducerAdmissionsEnabled() {\n  return CUSTODIAL_NEW_PRODUCER_SCOPE === 'full-system';\n}\nexport function requireCustodialNewProducerAdmission() {\n  if (!custodialNewProducerAdmissionsEnabled()) throw Object.assign(new Error('New admissions are deferred in this release scope.'), {code:'custodial_new_producer_scope_deferred'});\n}\n`;
}
export function readCustodialBuildScope(mobileRoot){
 const p=join(mobileRoot,'src/custodial/new-producer-scope.profile.json');
 // Existing full-system trees retain their default. A present Source marker is
 // never optional or recovered from generated outputs/caller configuration.
 const bytes=existsSync(p)?regular(p):Buffer.from('{"schema":"custodial.new-producer-scope.v1","profile":"full-system"}\n');
 const v=parseDeterministicJson(bytes,'Source new-producer scope');exact(v,['schema','profile']);
 assert.equal(v.schema,'custodial.new-producer-scope.v1');assert.ok(['full-system',CLEANING_SCOPE].includes(v.profile));
 const module=join(mobileRoot,'src/custodial/new-producer-scope.js');
 if(existsSync(module))assert.equal(regular(module).toString('utf8'),scopeModule(v.profile),'JS Source scope differs from selected profile');
 else assert.equal(v.profile,'full-system','cleaning scope requires its actual JS module');
 const t=Object.freeze({profile:v.profile,policy_sha256:sha(bytes),module_sha256:sha(scopeModule(v.profile))});tickets.add(t);return t;
}
export function isCleaningScope(t){assert.ok(tickets.has(t),'unbound Source scope');return t.profile===CLEANING_SCOPE;}
export function compiledScopeSource(pkg,t){
 assert.ok(tickets.has(t));assert.ok(['org.memphiszoo.custodial.vault','com.capacitorjs.plugins.localnotifications','io.capawesome.capacitorjs.plugins.firebase.messaging'].includes(pkg));
 return `package ${pkg};\n\n// Deterministic compiled Source counterpart; no mutable fields or runtime input.\nfinal class CustodialNewProducerScope {\n    static String profile() { return ${JSON.stringify(t.profile)}; }\n    static String sourcePolicySha256() { return ${JSON.stringify(t.policy_sha256)}; }\n    static boolean enabled() { return ${t.profile==='full-system'?'true':'false'}; }\n    private CustodialNewProducerScope() {}\n}\n`;
}
export function configureCleaningScopeManifest(source,t){
 assert.ok(isCleaningScope(t),'positive cleaning Source scope required');
 assert.doesNotMatch(source,/<!DOCTYPE|<!ENTITY|MESSAGING_EVENT|qualified native provider owner|CustodialProviderMessagingService/);
 const block=`        <meta-data android:name="${SCOPE_MARKER}" android:value="${CLEANING_SCOPE}" />\n`;
 assert.equal((source.match(/<application\b/g)||[]).length,1);assert.equal((source.match(/<\/application>/g)||[]).length,1);
 if(source.includes(SCOPE_MARKER)){assert.equal((source.match(new RegExp(SCOPE_MARKER.replaceAll('.','\\.'),'g'))||[]).length,1);assert.ok(source.includes(block));return source;}
 return source.replace(/(?=\s*<\/application>)/,block);
}
export function assertCleaningScopeManifest(dump,t){
 assert.ok(isCleaningScope(t));const root=parseAaptXmlTree(dump);assert.equal(root.attributes.package,'org.memphiszoo.custodial');
 const apps=root.children.filter(x=>x.name==='application');assert.equal(apps.length,1);
 const marked=apps[0].children.filter(x=>x.name==='meta-data'&&x.attributes['android:name']===SCOPE_MARKER);
 assert.equal(marked.length,1);assert.deepEqual(marked[0],{name:'meta-data',attributes:{'android:name':SCOPE_MARKER,'android:value':CLEANING_SCOPE},text:[],children:[]});
 const services=apps[0].children.filter(x=>x.name==='service');
 assert.ok(!services.some(x=>x.attributes['android:name']==='org.memphiszoo.custodial.vault.CustodialProviderMessagingService'));
 for(const name of ['com.google.firebase.messaging.FirebaseMessagingService','io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService'])assert.equal(services.filter(x=>x.attributes['android:name']===name).length,1);
}
export function scopeBuildRecord(t,bridgeBytes){
 assert.ok(isCleaningScope(t));return {schema:'custodial.compiled-new-producer-scope.v1',profile:t.profile,policy_sha256:t.policy_sha256,module_sha256:t.module_sha256,bridge_sha256:sha(bridgeBytes),new_admissions:false,existing_callbacks:'UNCHANGED_CONDITIONAL_GUARDS',install_admission:null};
}
async function fixedDirectory(path,values){
 let present=false;try{const st=await lstat(path);assert.ok(st.isDirectory()&&!st.isSymbolicLink());present=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!present){await mkdir(path,{recursive:false});for(const[n,b]of values)await writeFile(join(path,n),b,{flag:'wx'});}
 const entries=await readdir(path,{withFileTypes:true});assert.ok(entries.every(x=>x.isFile()&&!x.isSymbolicLink()));assert.deepEqual(entries.map(x=>x.name).sort(),[...values.keys()].sort());
 for(const[n,b]of values)assert.equal(sha(await readFile(join(path,n))),sha(b),'existing generated scope/source changed');
}
export async function prepareNewProducerScopeSources({repositoryRoot,mobileRoot,ticket}){
 assert.ok(tickets.has(ticket));
 const original=join(repositoryRoot,'node_modules/@capacitor-firebase/messaging');
 const patch=join(mobileRoot,'plugins/custodial-native-vault/android/src/vendor/firebase-messaging-8.3.0');
 const spec=parseDeterministicJson(regular(join(patch,'SOURCE_BINDING.json')),'reviewed Firebase Source binding');
 exact(spec,['schema','package','version','integrity','original_manifest_sha256','java_files']);assert.equal(spec.schema,'custodial.firebase-new-producer-scope-source.v1');
 const lock=parseDeterministicJson(regular(join(repositoryRoot,'package-lock.json')),'root dependency lock');const entry=lock.packages?.['node_modules/@capacitor-firebase/messaging'];
 assert.equal(entry?.version,'8.3.0');assert.equal(entry.integrity,spec.integrity);assert.equal(spec.package,'@capacitor-firebase/messaging');assert.equal(spec.version,'8.3.0');
 const pkg=JSON.parse(regular(join(original,'package.json')));assert.equal(pkg.name,spec.package);assert.equal(pkg.version,spec.version);
 assert.equal(sha(regular(join(original,'android/src/main/AndroidManifest.xml'))),spec.original_manifest_sha256);
 const source=join(original,'android/src/main/java/io/capawesome/capacitorjs/plugins/firebase/messaging');
 const entries=await readdir(source,{withFileTypes:true});assert.ok(entries.every(x=>x.isFile()&&!x.isSymbolicLink()));assert.deepEqual(entries.map(x=>x.name).sort(),Object.keys(spec.java_files).sort());
 const values=new Map();for(const[n,v]of Object.entries(spec.java_files)){const raw=regular(join(source,n));assert.equal(sha(raw),v.original_sha256);const bytes=v.modified?regular(join(patch,n)):raw;assert.equal(sha(bytes),v.patched_sha256);values.set(n,bytes);}
 values.set('CustodialNewProducerScope.java',Buffer.from(compiledScopeSource('io.capawesome.capacitorjs.plugins.firebase.messaging',ticket)));
 const android=join(mobileRoot,'android');await fixedDirectory(join(android,'.custodial-firebase-messaging-java'),values);
 await fixedDirectory(join(android,'.custodial-new-producer-scope-java'),new Map([['CustodialNewProducerScope.java',Buffer.from(compiledScopeSource('org.memphiszoo.custodial.vault',ticket))]]));
 return {profile:ticket.profile,policy_sha256:ticket.policy_sha256,firebase_source_sha256:Object.fromEntries([...values].map(([n,b])=>[n,sha(b)]))};
}
export function inspectCompiledCleaningScope({ticket,manifestDump,buildJson,buildIdentity,readEntry,dexEntries,callbackReferenceTicket,candidateSourceCommit,versionCode}){
 assert.ok(isCleaningScope(ticket));assertCleaningScopeManifest(manifestDump,ticket);
 const bytes=readEntry('assets/public/'+SCOPE_ASSET),v=parseDeterministicJson(bytes,'packaged Source scope');
 const expected=scopeBuildRecord(ticket,readEntry('assets/public/memphis-custodial-bridge.js'));assert.deepEqual(v,expected);assert.deepEqual(buildJson.cleaning_first_scope,v);assert.deepEqual(buildIdentity.cleaning_first_scope,v);
 const moduleBytes=readEntry('assets/public/custodial-new-producer-scope-source.txt');assert.equal(moduleBytes.toString('utf8'),scopeModule(ticket.profile));assert.equal(sha(moduleBytes),ticket.module_sha256);
 const deferred=Buffer.from(custodialPackagedRealmContainment(cleaningFirstDeferredPage()));
 for(const page of CLEANING_FIRST_DEFERRED_PAGES)assert.deepEqual(readEntry('assets/public/'+page),deferred,'Deferred feature page differs: '+page);
 const home=readEntry('assets/public/index.html').toString('utf8');
 for(const path of ['employee-schedule.html','messages.html','events.html','employee-feedback.html'])assert.ok(!new RegExp('<a[^>]+class=[\"\']homeButton[\"\'][^>]+href=[\"\']\\./'+path.replaceAll('.','\\.')+'(?:[?\"\'])').test(home),'Deferred feature remains a Home admission');
 const dex=inspectCustodialNewProducerScopeDexSemantics(dexEntries,{profile:ticket.profile,policySha256:ticket.policy_sha256});
 assertCustodialCallbackReference(callbackReferenceTicket,{profile:ticket.profile,policySha256:ticket.policy_sha256,candidateSourceCommit,versionCode});
 const referenceEntries=[...custodialCallbackReferenceDexEntries(callbackReferenceTicket)].map(([name,bytes])=>({name,bytes})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 const comparison=compareCustodialCallbackDexContinuity(dexEntries,referenceEntries,{profile:ticket.profile,policySha256:ticket.policy_sha256});
 assert.ok(isActualCallbackDexContinuityComparison(comparison),'Actual compiled comparison required');
 const continuity=Object.freeze({...comparison,source_reference_admission:custodialCallbackReferenceEvidence(callbackReferenceTicket)});
 const proof=Object.freeze({schema:'custodial.cleaning-first-new-admissions-artifact.v1',profile:ticket.profile,policy_sha256:ticket.policy_sha256,module_sha256:ticket.module_sha256,bridge_sha256:v.bridge_sha256,manifest_matched:true,native_scope_matched:true,new_entry_guards_verified:true,conditional_callbacks_preserved:isActualCallbackDexContinuityComparison(comparison)&&comparison.conditional_callbacks_preserved===true,callback_continuity:continuity,full_system_qualification_unchanged:true,install_admission:null,dex});proofs.add(proof);return proof;
}
export function isCompiledCleaningScopeProof(p){return !!p&&proofs.has(p);}
