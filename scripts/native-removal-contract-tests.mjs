import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withoutRemovalTransport} from './native-removal-source-boundary.mjs';
import {assertNativeBaseline,sourceSha256} from './native-source-baselines.mjs';
import {withoutProviderInterval} from './provider-interval-source-boundary.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const base='df679151ac0384fb6974c6eab2aba07a210d7b9f';
const path='mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/VaultEngine.java';
const engine=readFileSync(new URL('../'+path,import.meta.url),'utf8');
if (process.argv.includes('--new-removal-preflight-only')) {
 const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
 const security=readFileSync(new URL('../mobile/src/custodial/native-security.js',import.meta.url),'utf8');
 const plugin=readFileSync(new URL('../mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNativeVaultPlugin.java',import.meta.url),'utf8');
 const start=bridge.indexOf('  async function removeEnrollment() {'),end=bridge.indexOf('  async function cancelPendingEnrollment()',start);
 assert(start>=0&&end>start);
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('credentialStore','nativeVault','nativeCustodialRemovalPreflight',
   'nativeCustodialRemoveEnrollment','browserCredentialTransport','responseError',
   'let removalInFlight=null;'+bridge.slice(start,end)+'return removeEnrollment();');
 let intents=0,effects=0;const error=Object.assign(Error('Original admission required'),{code:'custodial_native_removal_inventory_admission_required'});
 await assert.rejects(run({removeEnrollment(){intents++;}},true,async()=>{throw error},async()=>{effects++},null,()=>{}),e=>e===error);
 assert.equal(intents,0);assert.equal(effects,0);
 const wrapperStart=security.indexOf('export async function nativeCustodialRemovalPreflight() {'),wrapperEnd=security.indexOf('export async function nativeCustodialRemoveEnrollment(',wrapperStart);
 assert(wrapperStart>=0&&wrapperEnd>wrapperStart);
 const wrapper=new AsyncFunction('isCustodialNativeVaultPlatform','CustodialNativeVault','securityError',
   security.slice(wrapperStart,wrapperEnd).replace('export ','')+'return nativeCustodialRemovalPreflight();');
 const failure=code=>Object.assign(Error(code),{code});
 await assert.rejects(wrapper(()=>true,{},failure),e=>e.code===error.code);
 await assert.rejects(wrapper(()=>false,{},failure),e=>e.code==='custodial_native_vault_required');
 await assert.rejects(wrapper(()=>true,{checkRemovalAdmission:async()=>{throw error}},failure),e=>e===error);
 const native=plugin.slice(plugin.indexOf('public void checkRemovalAdmission('),plugin.indexOf('public void removeEnrollment('));
 assert.match(native,/engine\.requireOriginalRemovalAdmission\(\);[\s\S]*resolve\(call/);
 assert.doesNotMatch(native,/getState\(|recoverLegacy\(|transport\.|gate\.confirm|persistence\.|cipher\./);
 console.log(JSON.stringify({scope:'New exact source bridge/wrapper rejection lifecycle and plugin wiring, not compiled native/manager/physical admission',
   passed:5,failed:0,local_removal_intents:0,removal_effects:0,old_groups_replayed:0,whole_A2_ready:false}));
 process.exit(0);
}
let checks=0;
assertNativeBaseline(base,path,withoutRemovalTransport(withoutProviderInterval('VaultEngine.java',engine)),'removal');checks++;
// Frozen section rejects either a safety mutation or new unreviewed bytes;
// all other engine bytes (including finalization and Start) remain compared.
for(const [from,to] of [
 ['if (Thread.holdsLock(this)) throw concurrent();',''],
 ['if (REMOVAL_FLIGHTS.containsKey(expected)) throw concurrent();',''],
 ['if (!state.equals(persistence.load())) throw concurrent();',''],
 ['if (!latest.equals(state)) throw concurrent();',''],
 ['if (latest.equals(tombstone))','if (latest.removalOperationId.equals(requested))'],
 ['VaultValidation.wipe(credential);','/* omitted */'],
]) {
 const at=engine.indexOf('    /** Removal-only capture/send/settle boundary.');
 assert.ok(engine.slice(at).includes(from));
 assert.throws(()=>withoutRemovalTransport(engine.slice(0,at)+engine.slice(at).replace(from,to)));checks++;
}
for(const [from,to] of [['cipher.destroyKey();','/* no finalization wipe */'],['recoverExpiry(recoverLegacy())','recoverLegacy()']]){
 assert.ok(engine.includes(from));assert.throws(()=>assertNativeBaseline(base,path,withoutRemovalTransport(withoutProviderInterval('VaultEngine.java',engine.replace(from,to))),'removal'));checks++;
}
assert.throws(()=>assertNativeBaseline('unknown',path,engine));checks++;
// Real portable execution of all affected source suites. PATH is empty: a
// local Git-object dependency fails instead of silently using this worktree.
const portable=[];
for(const script of ['native-readiness-observation-tests.mjs','provider-local-owner-contract-tests.mjs',
 'provider-runtime-construction-tests.mjs','provider-registration-contract-tests.mjs','provider-component-contract-tests.mjs','cleaning-provider-isolation-tests.mjs']){
 const output=execFileSync(process.execPath,['scripts/'+script],{cwd:root,env:{...process.env,PATH:''},encoding:'utf8'});
 assert.match(output,/PASS/);portable.push(script);checks++;
}
console.log(JSON.stringify({status:'NATIVE_REMOVAL_SOURCE_PORTABILITY_PASS',checks,base,
 engine_sha256:sourceSha256(engine),portable,limits:'Bounded source and synthetic concurrency proof only; no policy or provider activation.'}));
