const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const V1=['schema_version','device_id','employee_id','credential_id','credential_operation_id','assignment_epoch','installation_seal','enrolled_at'];
const V2=['schema_version','device_id','employee_id','assignment_epoch','credential_id','activation_operation_id',
  'activation_receipt_sha256','legacy_binding_id','legacy_binding_kind','installation_binding_sha256','installation_seal','enrolled_at'];
export function protectedPrincipal(value){
  const v2=value?.schema_version==='custodial-protected-principal.v2',keys=v2?V2:V1;
  if(!value||(!v2&&value.schema_version!=='custodial-protected-principal.v1')
    ||Object.keys(value).sort().join('|')!==[...keys].sort().join('|')
    ||!/^KIOSK_\d{2}$/.test(value.device_id||'')
    ||![value.employee_id,value.credential_id,...(v2?[value.activation_operation_id,value.legacy_binding_id]:[value.credential_operation_id])]
      .every(v=>typeof v==='string'&&UUID.test(v))
    ||(v2&&(!['confirmed_enrollment_operation','authenticated_legacy_installation_observation'].includes(value.legacy_binding_kind)
      ||![value.activation_receipt_sha256,value.installation_binding_sha256].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))))
    ||!Number.isSafeInteger(value.assignment_epoch)||value.assignment_epoch<=0
    ||!/^[-A-Za-z0-9._:]{16,256}$/.test(value.installation_seal||'')
    ||typeof value.enrolled_at!=='string'||!Number.isFinite(Date.parse(value.enrolled_at)))return null;
  return Object.freeze(Object.fromEntries(keys.map(k=>[k,value[k]])));
}
export function principalIdentity(value){const p=protectedPrincipal(value);return p?JSON.stringify(p):'';}
export function profileMatchesPrincipal(profile,value){
  const p=protectedPrincipal(value);
  return Boolean(p&&profile&&profile.employee_id===p.employee_id&&profile.credential_id===p.credential_id
    &&profile.assignment_epoch===p.assignment_epoch
    &&String(profile.canonical_device_id||profile.device_id||'').toUpperCase()===p.device_id);
}

/** Main supplies private ready/runtime/device/normal-status readers. This
 * utility fences their observations; it does not authenticate caller JSON,
 * consult presentation caches, submit feedback or grant deletion authority. */
export function createProtectedFeedbackIdentity({ready,security,currentDeviceId,refreshStatus,online}){
  if(typeof ready!=='function'||typeof security?.getStatus!=='function'||typeof security?.ensureSecurityState!=='function'
    ||typeof currentDeviceId!=='function'||typeof refreshStatus!=='function'||typeof online!=='function')
    throw new TypeError('Private protected feedback identity readers are required.');
  const unavailable=()=>Object.assign(new Error('The current protected feedback identity is unavailable.'),
    {code:'custodial_feedback_identity_unavailable'});
  const read=()=>{
    const status=security.getStatus(),device=currentDeviceId();
    if(status?.ready!==true||status.available!==true||status.quarantined!==false
      ||!Number.isSafeInteger(status.generation)||status.generation<=0
      ||typeof device!=='string'||!/^KIOSK_\d{2}$/.test(device)||status.deviceId!==device)throw unavailable();
    const principal=protectedPrincipal(status.principal);
    if((status.principal!=null&&!principal)||(principal&&principal.device_id!==device))throw unavailable();
    return {device,generation:status.generation,principal,identity:principalIdentity(principal)};
  };
  const same=(expected,actual)=>{
    if(expected.device!==actual.device||expected.generation!==actual.generation||expected.identity!==actual.identity)throw unavailable();
  };
  return async function feedbackIdentity({purpose}={}){
    if(!['save','deliver'].includes(purpose))throw unavailable();
    await ready();
    const before=read();let selected=before;
    // Existing identity is a read-only observation, including when called
    // INSIDE the normal protected-mutation FIFO. Never re-enter that FIFO
    // through ensureSecurityState; the owning mutation/transport keeps its
    // actual currentness fence. The final microtask recheck still binds us.
    if(!before.principal){
      if(purpose!=='save'||online()!==true)throw unavailable();
      // Exactly one generation-fenced normal status read, never a cached actor
      // or a refresh/retry during delivery of an existing saved operation.
      const profile=await refreshStatus({expectedGeneration:before.generation});
      const observed=read();
      if(observed.device!==before.device||observed.generation<before.generation||profile?.authenticated!==true
        ||!UUID.test(profile.employee_id||'')||!UUID.test(profile.credential_id||'')
        ||!Number.isSafeInteger(profile.assignment_epoch)||profile.assignment_epoch<=0
        ||String(profile.canonical_device_id||profile.device_id||'').toUpperCase()!==before.device)throw unavailable();
      // A first native status capture may publish the new protected principal.
      // Other generation movement with no captured principal is not adoption.
      if(observed.principal){if(!profileMatchesPrincipal(profile,observed.principal))throw unavailable();}
      else same(before,observed);
      await security.ensureSecurityState();selected=read();
      if(selected.device!==before.device||selected.generation<before.generation||!selected.principal
        ||!profileMatchesPrincipal(profile,selected.principal))throw unavailable();
      if(observed.principal)same(observed,selected);
    }
    // Recheck the complete protected principal (including installation and
    // original activation identity), not merely the public employee tuple.
    await Promise.resolve();same(selected,read());
    const p=selected.principal;
    return Object.freeze({deviceId:p.device_id,employeeId:p.employee_id,credentialId:p.credential_id,
      assignmentEpoch:String(p.assignment_epoch)});
  };
}
