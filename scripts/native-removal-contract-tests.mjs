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
