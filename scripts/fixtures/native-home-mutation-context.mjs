// Test-only native admission model for historical Home regression fixtures.
// The real consumer, cache, race cases and assertions remain under test.
import assert from 'node:assert/strict';
import {principalIdentity} from '../../mobile/src/custodial/protected-principal.js';
export function createSyntheticNativeHome(namespace,{employeeId=null,credentialId=null}={}) {
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const state={generation:7,deviceId:'KIOSK_08',principal:{schema_version:'custodial-protected-principal.v1',
  device_id:'KIOSK_08',employee_id:employeeId||id(2),credential_id:credentialId||id(3),assignment_epoch:7,
  credential_operation_id:id(8),installation_seal:'synthetic-home-'+namespace+'-installation-seal',enrolled_at:'2026-09-21T00:00:00.000Z'}};
 const binding=principalIdentity(state.principal);assert.ok(binding);
 const status=()=>({ready:true,available:true,quarantined:false,...state});
 const mutate=async(operation,options)=>{
  const generation=state.generation,deviceId=state.deviceId,principal=JSON.stringify(state.principal);let open=true;
  assert.equal(options.requireEnrollment,true);assert.equal(options.expectedGeneration,generation);
  const context={generation,deviceId,assertCurrent(){assert.equal(open,true,'closed synthetic native context');
   assert.equal(state.generation,generation);assert.equal(state.deviceId,deviceId);assert.equal(JSON.stringify(state.principal),principal);}};
  context.assertCurrent();try{return await operation(context);}finally{open=false;}
 };
 return {state,binding,status,mutate};
}
