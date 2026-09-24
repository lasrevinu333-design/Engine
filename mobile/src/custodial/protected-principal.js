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
