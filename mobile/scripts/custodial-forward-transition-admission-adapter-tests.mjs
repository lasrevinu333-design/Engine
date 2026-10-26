import assert from 'node:assert/strict';
import test from 'node:test';
import { FORWARD_TRANSITION_ADMISSION_ENTRYPOINT_CONTRACT, inspectForwardTransitionSourceAdmission, integrationContract, legacyCandidateDisposition } from './custodial-forward-transition-admission-adapter.mjs';

const H = 'a'.repeat(64); const C = 'b'.repeat(40); const T = 'c'.repeat(40); const packageName = 'org.memphiszoo.custodial';
const source = (ref = 'refs/heads/synthetic-reviewed') => ({ ref, commit: C, tree: T });
const descriptor = (version, ref) => ({ version_code: version, package_name: packageName, signer_certificate_sha256: H, signer_public_key_sha256: H, source: source(ref), artifact_sha256: H, schema_sha256: H, native_sha256: H, runtime_sha256: H });
const store = (name) => ({ status: 'compatible', schema: `custodial.${name}.v2`, provenance_sha256: H, source: source('refs/heads/retained-source') });
const retained = { schema_version: 1, source_pair: { frontend_commit: C, frontend_tree: T, backend_commit: C, backend_tree: T }, enrollment: store('enrollment'), protected_pending: store('protected-pending'), history: store('history'), crypto: store('crypto'), reset_or_downgrade_forbidden: true };
const pins = { schema_version: 1, policy_generation: 'post56-v2-reviewed', target_id: 'target-installed-56', package_name: packageName, signer_certificate_sha256: H, signer_public_key_sha256: H, installed_target: descriptor(56, 'refs/tags/installed-56-source'), candidate: descriptor(57, 'refs/heads/candidate-source'), recovery: descriptor(58, 'refs/heads/recovery-source'), retained_store_compatibility: retained, evidence_refs: { baseline_receipt_sha256: H, candidate_source_receipt_sha256: H, recovery_source_receipt_sha256: H, retained_data_plan_sha256: H }, legacy_policy: { highest_fleet_version_code: 29, minimum_next_version_code: 30, maximum_candidate_version_code_for_staged_recovery: 31 } };
const fixture = (changes = {}) => ({ schema_version: 1, policy_generation: pins.policy_generation, purpose: 'source_compatibility_diagnostic', fleet_promotion: false, scope: 'one_explicit_target_only', target_id: pins.target_id, installed_target: structuredClone(pins.installed_target), candidate: structuredClone(pins.candidate), recovery: structuredClone(pins.recovery), retained_store_compatibility: structuredClone(pins.retained_store_compatibility), evidence_refs: structuredClone(pins.evidence_refs), ...changes });

test('forward source contract accepts external pins but never admits', () => { const r = inspectForwardTransitionSourceAdmission(fixture(), pins); assert.equal(r.accepted, true); assert.equal(r.source_ready, true); assert.equal(r.legacy_policy_disposition, 'reject'); for (const k of ['qualified_artifact','operationally_qualified','admitted','install_ready','physical_recovery_proven']) assert.equal(r[k], false); });
test('legacy policy remains 29 to 30/31 and rejects 32', () => { assert.equal(legacyCandidateDisposition(30, pins.legacy_policy), 'allow'); assert.equal(legacyCandidateDisposition(31, pins.legacy_policy), 'allow'); assert.equal(legacyCandidateDisposition(32, pins.legacy_policy), 'reject'); });
test('normal entrypoint contract is explicit and activation remains separate', () => { assert.equal(FORWARD_TRANSITION_ADMISSION_ENTRYPOINT_CONTRACT.seam_status, 'main_owned_source_mounted_inactive'); assert.deepEqual(integrationContract(), FORWARD_TRANSITION_ADMISSION_ENTRYPOINT_CONTRACT); assert.equal(FORWARD_TRANSITION_ADMISSION_ENTRYPOINT_CONTRACT.effects.admitted, false); });

const negatives = [
  ['unknown input field', () => ({ extra: true }), 'input_unknown_field_extra'],
  ['null fleet flag', () => ({ fleet_promotion: null }), 'fleet_promotion_must_be_exact_false'],
  ['candidate at installed baseline', () => ({ candidate: { ...pins.candidate, version_code: 56 } }), 'candidate_not_forward_of_observed_installed'],
  ['recovery not higher', () => ({ recovery: { ...pins.recovery, version_code: 57 } }), 'recovery_not_strictly_higher_than_candidate'],
  ['candidate source copied but not externally trusted', () => ({ candidate: { ...pins.candidate, source: source('refs/heads/other') } }), 'candidate_trusted_binding_mismatch'],
  ['recovery signer differs', () => ({ recovery: { ...pins.recovery, signer_public_key_sha256: 'd'.repeat(64) } }), 'recovery_trusted_binding_mismatch'],
  ['separate recovery source absent', () => ({ recovery: { ...pins.recovery, source: pins.candidate.source } }), 'recovery_trusted_binding_mismatch'],
  ['retained enrollment provenance missing', () => ({ retained_store_compatibility: { ...pins.retained_store_compatibility, enrollment: { ...pins.retained_store_compatibility.enrollment, provenance_sha256: undefined } } }), 'retained_enrollment_provenance_invalid'],
  ['retained crypto source mismatched', () => ({ retained_store_compatibility: { ...pins.retained_store_compatibility, crypto: { ...pins.retained_store_compatibility.crypto, source: source('refs/heads/wrong') } } }), 'retained_store_trusted_binding_mismatch'],
  ['evidence digest alone cannot replace trusted evidence', () => ({ evidence_refs: { ...pins.evidence_refs, candidate_source_receipt_sha256: 'e'.repeat(64) } }), 'evidence_trusted_binding_mismatch'],
  ['reset/downgrade shortcut', () => ({ retained_store_compatibility: { ...pins.retained_store_compatibility, reset_or_downgrade_forbidden: false } }), 'retained_store_policy_invalid'],
  ['operational purpose stays unqualified', () => ({ purpose: 'operational_release' }), null],
];
test('fails closed: unknown external pin field', () => { const r = inspectForwardTransitionSourceAdmission(fixture(), { ...pins, extra: true }); assert.equal(r.accepted, false); assert.equal(r.reason, 'external_trusted_pins_unknown_field_extra'); });
test('fails closed: trusted public signer pin differs', () => { const r = inspectForwardTransitionSourceAdmission(fixture(), { ...pins, signer_public_key_sha256: 'd'.repeat(64) }); assert.equal(r.accepted, false); assert.equal(r.reason, 'candidate_or_recovery_signer_mismatch'); });
for (const [name, change, expected] of negatives) test(`fails closed: ${name}`, () => { const inputChange = change(); let pinArg = pins; if (name === 'candidate at installed baseline') pinArg = { ...pins, candidate: inputChange.candidate }; if (name === 'recovery not higher') pinArg = { ...pins, recovery: inputChange.recovery }; const r = inspectForwardTransitionSourceAdmission(fixture(inputChange), pinArg); if (name === 'operational purpose stays unqualified') { assert.equal(r.accepted, true); assert.equal(r.operationally_qualified, false); } else { assert.equal(r.accepted, false); assert.equal(r.reason, expected); } });

console.log(JSON.stringify({ result: 'PASS', scope: 'G30 forward-transition adapter affected pure boundaries only', cases: 17, source_runtime_sql_physical: 'not tested' }));
