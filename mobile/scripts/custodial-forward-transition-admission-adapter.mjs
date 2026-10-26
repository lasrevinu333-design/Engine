const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const MAX_VERSION_CODE = 2_100_000_000;
const PACKAGE = 'org.memphiszoo.custodial';

const SOURCE_KEYS = ['ref', 'commit', 'tree'];
const DESCRIPTOR_KEYS = ['version_code', 'package_name', 'signer_certificate_sha256', 'signer_public_key_sha256', 'source', 'artifact_sha256', 'schema_sha256', 'native_sha256', 'runtime_sha256'];
const STORE_KEYS = ['status', 'schema', 'provenance_sha256', 'source'];
const RETAINED_KEYS = ['schema_version', 'source_pair', 'enrollment', 'protected_pending', 'history', 'crypto', 'reset_or_downgrade_forbidden'];
const EVIDENCE_KEYS = ['baseline_receipt_sha256', 'candidate_source_receipt_sha256', 'recovery_source_receipt_sha256', 'retained_data_plan_sha256'];
const CONTRACT_KEYS = ['schema_version', 'policy_generation', 'purpose', 'fleet_promotion', 'scope', 'target_id', 'installed_target', 'candidate', 'recovery', 'retained_store_compatibility', 'evidence_refs'];
const PIN_KEYS = ['schema_version', 'policy_generation', 'target_id', 'package_name', 'signer_certificate_sha256', 'signer_public_key_sha256', 'installed_target', 'candidate', 'recovery', 'retained_store_compatibility', 'evidence_refs', 'legacy_policy'];

export const FORWARD_TRANSITION_ADMISSION_ENTRYPOINT_CONTRACT = Object.freeze({
  schema: 'custodial.forward-transition-admission-entrypoint.v1',
  module_export: 'inspectForwardTransitionSourceAdmission(input, externalTrustedPins)',
  seam: 'mobile/scripts/configure-native-release.mjs',
  seam_status: 'main_owned_source_mounted_inactive',
  order: ['normal_verifier_loads_external_trusted_pins', 'adapter_checks_source_shape_and_bindings', 'normal_verifier_decides_admission', 'activation_remains_separate'],
  effects: { source_ready: 'shape_and_external_binding_only', qualified_artifact: false, operationally_qualified: false, admitted: false, install_ready: false, physical_recovery_proven: false },
});

function fail(reason, details = {}) { return { accepted: false, reason, ...details, source_ready: false, qualified_artifact: false, operationally_qualified: false, admitted: false, install_ready: false, physical_recovery_proven: false }; }
function ok(reason, legacy) { return { accepted: true, reason, legacy_policy_disposition: legacy, source_ready: true, qualified_artifact: false, operationally_qualified: false, admitted: false, install_ready: false, physical_recovery_proven: false }; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys, label) { if (!object(value)) return `${label}_not_object`; const unknown = Object.keys(value).filter((key) => !keys.includes(key)); if (unknown.length) return `${label}_unknown_field_${unknown[0]}`; const missing = keys.filter((key) => !Object.hasOwn(value, key)); return missing.length ? `${label}_missing_field_${missing[0]}` : null; }
function exactHash(value, length = 64) { return (length === 40 ? HEX40 : HEX64).test(typeof value === 'string' ? value : ''); }
function positiveVersion(value) { return Number.isSafeInteger(value) && value >= 1 && value <= MAX_VERSION_CODE; }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function sourceError(source, label) {
  const e = exactKeys(source, SOURCE_KEYS, label);
  if (e) return e;
  if (typeof source.ref !== 'string' || !/^refs\/(heads|tags)\/[A-Za-z0-9._/-]+$/.test(source.ref) || !exactHash(source.commit, 40) || !exactHash(source.tree, 40)) return `${label}_identity_invalid`;
  return null;
}

function descriptorError(value, label, prebuild = false) {
  const e = exactKeys(value, DESCRIPTOR_KEYS, label);
  if (e) return e;
  if (!positiveVersion(value.version_code)) return `${label}_version_invalid`;
  if (typeof value.package_name !== 'string' || !value.package_name) return `${label}_package_invalid`;
  if (!exactHash(value.signer_certificate_sha256) || !exactHash(value.signer_public_key_sha256)) return `${label}_signer_invalid`;
  const se = sourceError(value.source, `${label}_source`); if (se) return se;
  for (const key of ['artifact_sha256', 'schema_sha256', 'native_sha256', 'runtime_sha256']) {
    if (prebuild && ['artifact_sha256', 'runtime_sha256'].includes(key) && value[key] === null) continue;
    if (!exactHash(value[key])) return `${label}_${key}_invalid`;
  }
  return null;
}

function retainedError(value) {
  let e = exactKeys(value, RETAINED_KEYS, 'retained_store_compatibility'); if (e) return e;
  if (value.schema_version !== 1 || value.reset_or_downgrade_forbidden !== true) return 'retained_store_policy_invalid';
  e = exactKeys(value.source_pair, ['frontend_commit', 'frontend_tree', 'backend_commit', 'backend_tree'], 'retained_source_pair'); if (e) return e;
  for (const key of ['frontend_commit', 'backend_commit']) if (!exactHash(value.source_pair[key], 40)) return `retained_source_pair_${key}_invalid`;
  for (const key of ['frontend_tree', 'backend_tree']) if (!exactHash(value.source_pair[key], 40)) return `retained_source_pair_${key}_invalid`;
  for (const key of ['enrollment', 'protected_pending', 'history', 'crypto']) {
    e = exactKeys(value[key], STORE_KEYS, `retained_${key}`); if (e) return e;
    if (value[key].status !== 'compatible' || typeof value[key].schema !== 'string' || !value[key].schema || !exactHash(value[key].provenance_sha256)) return `retained_${key}_provenance_invalid`;
    e = sourceError(value[key].source, `retained_${key}_source`); if (e) return e;
  }
  return null;
}

function evidenceError(value) {
  const e = exactKeys(value, EVIDENCE_KEYS, 'evidence_refs'); if (e) return e;
  for (const key of EVIDENCE_KEYS) if (!exactHash(value[key])) return `evidence_${key}_invalid`;
  return null;
}

function pinsError(value, prebuild = false) {
  const e = exactKeys(value, PIN_KEYS, 'external_trusted_pins'); if (e) return e;
  if (value.schema_version !== 1 || typeof value.policy_generation !== 'string' || !value.policy_generation.trim()) return 'external_trusted_pins_header_invalid';
  if (typeof value.target_id !== 'string' || !value.target_id) return 'external_trusted_target_invalid';
  if (value.package_name !== PACKAGE || !exactHash(value.signer_certificate_sha256) || !exactHash(value.signer_public_key_sha256)) return 'external_trusted_package_or_signer_invalid';
  for (const key of ['installed_target', 'candidate', 'recovery']) { const de = descriptorError(value[key], `trusted_${key}`, prebuild && key !== 'installed_target'); if (de) return de; }
  const re = retainedError(value.retained_store_compatibility); if (re) return re;
  const ee = evidenceError(value.evidence_refs); if (ee) return ee;
  if (!object(value.legacy_policy) || exactKeys(value.legacy_policy, ['highest_fleet_version_code', 'minimum_next_version_code', 'maximum_candidate_version_code_for_staged_recovery'], 'legacy_policy')) return 'trusted_legacy_policy_invalid';
  if (![value.legacy_policy.highest_fleet_version_code, value.legacy_policy.minimum_next_version_code, value.legacy_policy.maximum_candidate_version_code_for_staged_recovery].every(positiveVersion)) return 'trusted_legacy_policy_versions_invalid';
  return null;
}

export function legacyCandidateDisposition(version, policy) {
  if (!policy || !Number.isSafeInteger(version)) return 'reject';
  return version >= policy.minimum_next_version_code && version <= policy.maximum_candidate_version_code_for_staged_recovery ? 'allow' : 'reject';
}

export function inspectForwardTransitionSourceAdmission(input, externalTrustedPins) {
  if (!object(input) || !object(externalTrustedPins)) return fail('missing_external_trusted_inputs');
  let e = exactKeys(input, CONTRACT_KEYS, 'input'); if (e) return fail(e);
  const prebuild = input.purpose === 'build_preparation';
  e = pinsError(externalTrustedPins, prebuild); if (e) return fail(e);
  if (input.schema_version !== 1 || input.policy_generation !== externalTrustedPins.policy_generation) return fail('policy_generation_mismatch');
  if (!['source_compatibility_diagnostic', 'operational_release', 'build_preparation'].includes(input.purpose)) return fail('purpose_invalid');
  if (input.fleet_promotion !== false) return fail('fleet_promotion_must_be_exact_false');
  if (input.scope !== 'one_explicit_target_only' || typeof input.target_id !== 'string' || !input.target_id) return fail('target_scope_invalid');
  if (input.target_id !== externalTrustedPins.target_id) return fail('target_binding_mismatch');
  for (const key of ['installed_target', 'candidate', 'recovery']) { e = descriptorError(input[key], key, prebuild && key !== 'installed_target'); if (e) return fail(e); }
  if (input.installed_target.version_code !== externalTrustedPins.installed_target.version_code) return fail('installed_target_version_mismatch');
  if (!same(input.installed_target, externalTrustedPins.installed_target)) return fail('installed_target_trusted_binding_mismatch');
  if (!same(input.candidate, externalTrustedPins.candidate)) return fail('candidate_trusted_binding_mismatch');
  if (!same(input.recovery, externalTrustedPins.recovery)) return fail('recovery_trusted_binding_mismatch');
  if ([input.installed_target, input.candidate, input.recovery].some((d) => d.package_name !== PACKAGE)) return fail('candidate_or_recovery_package_invalid');
  if (input.installed_target.signer_certificate_sha256 !== externalTrustedPins.signer_certificate_sha256 || input.installed_target.signer_public_key_sha256 !== externalTrustedPins.signer_public_key_sha256) return fail('installed_target_signer_mismatch');
  if (input.candidate.signer_certificate_sha256 !== externalTrustedPins.signer_certificate_sha256 || input.recovery.signer_certificate_sha256 !== externalTrustedPins.signer_certificate_sha256 || input.candidate.signer_public_key_sha256 !== externalTrustedPins.signer_public_key_sha256 || input.recovery.signer_public_key_sha256 !== externalTrustedPins.signer_public_key_sha256) return fail('candidate_or_recovery_signer_mismatch');
  if (input.candidate.version_code <= input.installed_target.version_code) return fail('candidate_not_forward_of_observed_installed');
  if (input.recovery.version_code <= input.candidate.version_code) return fail('recovery_not_strictly_higher_than_candidate');
  e = retainedError(input.retained_store_compatibility); if (e) return fail(e);
  if (!same(input.retained_store_compatibility, externalTrustedPins.retained_store_compatibility)) return fail('retained_store_trusted_binding_mismatch');
  e = evidenceError(input.evidence_refs); if (e) return fail(e);
  if (!same(input.evidence_refs, externalTrustedPins.evidence_refs)) return fail('evidence_trusted_binding_mismatch');
  return ok('source_contract_shape_and_external_bindings_valid_only', legacyCandidateDisposition(input.candidate.version_code, externalTrustedPins.legacy_policy));
}

export function integrationContract() { return structuredClone(FORWARD_TRANSITION_ADMISSION_ENTRYPOINT_CONTRACT); }
