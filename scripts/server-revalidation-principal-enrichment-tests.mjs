import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createCustodialCredentialStore} from '../mobile/src/custodial/credential-store.js';
import {createNativeProtectedStorage} from '../mobile/src/custodial/native-security.js';
import * as keys from '../mobile/src/custodial/security-keys.js';

const id = n => `82000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function fixture({initialPrincipal = null, native = true} = {}) {
  const device = 'KIOSK_08', seal = 'synthetic-installation-seal-1234567890';
  const enrolled = '2026-08-01T01:00:00.000Z';
  const recovery = {schema_version:1,recovery_id:id(1),status:'pending_manager_recovery',
    reason:'server_credential_rejected',created_at:enrolled,
    original_device_keys:{mz_scan_device_id:device},
    original_identities:[{device_id:device,canonical_device_id:device,original_values:[device]}],
    preserved_counts:{total_pending:0},details:{requested_by:'protected_enrollment_runtime'}};
  const quarantine = {...recovery,active:true}; delete quarantine.status; delete quarantine.details;
  const entries = new Map([
    ...keys.CUSTODIAL_DEVICE_KEYS.map(key => [key,device]),
    [keys.CUSTODIAL_INSTALLATION_MARKER_KEY,seal],
    [keys.CUSTODIAL_RECOVERY_RECORD_KEY,JSON.stringify(recovery)],
    [keys.CUSTODIAL_RESTORE_QUARANTINE_KEY,JSON.stringify(quarantine)],
    ['mz_messenger_v2_draft:preserved-original','exact original draft'],
  ]);
  // The retained draft is not pending transport; it must nevertheless survive.
  const storage = {get length(){return entries.size;},key:i=>[...entries.keys()][i]??null,
    getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,String(value)),removeItem:key=>entries.delete(key)};
  const principal = {schema_version:'custodial-protected-principal.v1',device_id:device,
    employee_id:id(2),credential_id:id(3),credential_operation_id:id(4),assignment_epoch:2,
    installation_seal:seal,enrolled_at:enrolled};
  const state = {state:'ACTIVE',active:true,active_credential_id:id(3),active_enrollment_operation_id:id(4),
    installation:{schema_version:1,device_id:device,installation_seal:seal,enrolled_at:enrolled,
      enrollment_operation_id:id(4),migrated_from_credential_only_state:false},principal:initialPrincipal};
  const adapter = createNativeProtectedStorage({getState:async()=>structuredClone(state)},storage);
  const secureStorage = native ? adapter : {get:adapter.get,set:adapter.set,remove:adapter.remove};
  const owner = createCustodialCredentialStore({storage,secureStorage,cryptoApi:webcrypto,
    indexedDb:{databases:async()=>[],open(){throw Error('Unexpected fixture database creation');}}});
  const proof = {authenticated:true,deviceId:device,credentialId:id(3),employeeId:id(2),assignmentEpoch:2};
  return {state,storage,principal,owner,proof,snapshot:()=>[...entries]};
}

const successful = fixture();
const result = await successful.owner.reconcileAuthenticatedServerQuarantine(async()=>{
  successful.state.principal = successful.principal;
  return successful.proof;
});
assert.equal(result.reconciled,true,'The native status capture may enrich the same installation on its first read');
assert.deepEqual(successful.owner.getStatus().principal,successful.principal);
assert.equal(successful.storage.getItem('mz_messenger_v2_draft:preserved-original'),'exact original draft');
assert.equal(successful.storage.getItem(keys.CUSTODIAL_RESTORE_QUARANTINE_KEY),null);
console.log('PASS actual native storage adapter first-principal enrichment resolves original quarantine');

// Join the actual bridge verifier to the actual credential owner and native
// storage projection. Only HTTPS/plugin and diagnostic ports are synthetic.
const joined=fixture();
await assert.rejects(joined.owner.ensureSecurityState());
assert.equal(joined.owner.getStatus().quarantined,true);
const bridge=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
const start=bridge.indexOf('  function boundedServerRevalidationDetail(');
const end=bridge.indexOf('  async function reportProtectedRecoveryDiagnostic(',start);
assert.ok(start>=0&&end>start);
let requests=0;
const context=vm.createContext({URL,Response,nativeVault:true,credentialStore:joined.owner,
  API_ORIGIN:'https://synthetic.invalid',console:{info(){}},reportProtectedRecoveryDiagnostic:async()=>true,
  nativeCustodialAuthorizedFetch:async({deviceId,resolvedUrl,init})=>{
    requests++;assert.equal(deviceId,'KIOSK_08');assert.equal(resolvedUrl.pathname,'/device-auth/status');assert.equal(init.method,'GET');
    joined.state.principal=joined.principal;
    return Response.json({ok:true,data:{authenticated:true,canonical_device_id:'KIOSK_08',credential_id:id(3),employee_id:id(2),assignment_epoch:2}});
  }});
vm.runInContext(bridge.slice(start,end),context);
assert.equal(await context.revalidateRecoverableServerQuarantine(),true);
assert.equal(requests,1);
assert.deepEqual(joined.owner.getStatus().principal,joined.principal);
console.log('PASS actual bridge verifier carries full native principal proof into recovery in one GET');

for (const [name,change,options] of [
  ['device', x=>{x.state.installation.device_id='KIOSK_09';}],
  ['seal', x=>{x.state.installation.installation_seal='different-installation-seal-123456789';}],
  ['operation', x=>{x.state.active_enrollment_operation_id=id(9);}],
  ['enrolled time', x=>{x.state.installation.enrolled_at='2026-08-02T01:00:00.000Z';}],
  ['credential proof', x=>{x.proof.credentialId=id(9);}],
  ['employee proof', x=>{x.proof.employeeId=id(9);}],
  ['epoch proof', x=>{x.proof.assignmentEpoch=3;}],
  ['unknown principal field', x=>{x.state.principal.extra='unsupported';}],
  ['principal seal', x=>{x.state.principal.installation_seal='different-installation-seal-123456789';}],
  ['principal operation', x=>{x.state.principal.credential_operation_id=id(9);}],
  ['browser store', ()=>{}, {native:false}],
]) {
  const x=fixture(options),before=x.snapshot();
  await assert.rejects(x.owner.reconcileAuthenticatedServerQuarantine(async()=>{
    x.state.principal=structuredClone(x.principal);change(x);return x.proof;
  }),undefined,name);
  assert.deepEqual(x.snapshot(),before,name+' retains all original browser rows');
  assert.equal(x.owner.getStatus().ready,false,name+' does not grant ready');
  console.log('PASS enrichment refuses '+name);
}

const sample=fixture();
const changed=fixture({initialPrincipal:sample.principal}),before=changed.snapshot();
await assert.rejects(changed.owner.reconcileAuthenticatedServerQuarantine(async()=>{
  changed.state.principal={...changed.principal,assignment_epoch:3};changed.proof.assignmentEpoch=3;return changed.proof;
}));
assert.deepEqual(changed.snapshot(),before);
console.log('PASS existing assigned principal change remains refused');
