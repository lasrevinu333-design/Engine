#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectCustodialCapacitorRuntime,
  parseDeterministicJson,
} from './custodial-capacitor-runtime-policy.mjs';
import { custodialNativeVaultSourceDigest } from './custodial-native-vault-source.mjs';
import {readReviewedProviderRelease,configureProviderManifest} from './custodial-provider-release-policy.mjs';
import {readCustodialBuildScope,isCleaningScope,prepareNewProducerScopeSources,configureCleaningScopeManifest,scopeBuildRecord} from './custodial-new-producer-scope-policy.mjs';
import { inspectForwardTransitionSourceAdmission } from './custodial-forward-transition-admission-adapter.mjs';
import {resolveCustodialForwardEvidenceFiles} from './provision-custodial-forward-build-inputs.mjs';
import {prepareCustodialNotificationWriterSources,injectCustodialNotificationWriterOverlay} from './custodial-local-notification-writers.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const repositoryRoot = resolve(mobileRoot, '..');
const androidVersionOverlayLine = "apply from: rootProject.file('../scripts/native-version.gradle')";
const androidSigningOverlayLine = "apply from: rootProject.file('../scripts/codemagic-release.gradle')";
const gradleDistributionUrl = 'https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip';
const gradleDistributionSha256 = 'ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c';
const gradleWrapperJarSha256 = '7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172';
const custodialReleasePolicyPath = join(
  mobileRoot,
  'release-policies',
  'custodial-android.json',
);
const requiredCustodialRollbackCapabilities = Object.freeze([
  'getOfflineAuthorityState',
  'beginRollbackFence',
  'clearRollbackFence',
  'authorizeOfflineNewWork',
  'attestOfflineStart',
]);

const editions = {
  manager: {
    appIdentifier: 'org.memphiszoo.ops',
    androidVerificationMetadataSha256: '8c6aef56d60cadd1f20b094f4a383f8c81e2b6100529f8bacd0beb1d918c0d7d',
    swiftPins: {
      'capacitor-swift-pm': ['8.4.3', '89e0d8ec2321025f549ddb19259a717467943b97'],
      'firebase-ios-sdk': ['12.7.0', '45210bd1ea695779e6de016ab00fea8c0b7eb2ef'],
      googledatatransport: ['10.1.0', '617af071af9aa1d6a091d59a202910ac482128f9'],
      googleutilities: ['8.1.0', '60da361632d0de02786f709bdc0c4df340f7613e'],
      'keychain-swift': ['21.0.0', '265806607b45687a3d646e4c9837c31c90f202e8'],
      nanopb: ['2.30910.0', 'b7e1104502eca3a213b46303391ca4d3bc8ddec1'],
      promises: ['2.4.0', '540318ecedd63d883069ae7f1ed811a2df00b6ac'],
    },
  },
  custodial: {
    appIdentifier: 'org.memphiszoo.custodial',
    androidVerificationMetadataSha256: '287c945fdce44b2c01e68644629b39d1c1429ac56b40423a3d964d09eb503d0e',
  },
  viewer: {
    appIdentifier: 'org.memphiszoo.viewer',
    androidVerificationMetadataSha256: '01ee0a4e6d388e9f3abc34ff92be969c8891baa6def3b9666481de6933c10044',
    swiftPins: {
      'capacitor-swift-pm': ['8.4.3', '89e0d8ec2321025f549ddb19259a717467943b97'],
    },
  },
};

function loadCustodialAndroidReleasePolicy() {
  const bytes = readFileSync(custodialReleasePolicyPath);
  const policy = JSON.parse(bytes);
  if (
    policy?.schema_version !== 3
    || policy.package_name !== editions.custodial.appIdentifier
    || !Number.isSafeInteger(policy.highest_fleet_version_code)
    || policy.highest_fleet_version_code < 1
    || policy.minimum_next_version_code !== policy.highest_fleet_version_code + 1
    || !/^[a-f0-9]{64}$/.test(policy.fleet_signer_sha256 || '')
    || !/^[a-f0-9]{64}$/.test(policy.fleet_signer_public_key_sha256 || '')
    || !/^[a-f0-9]{64}$/.test(policy.fleet_baseline_apk_sha256 || '')
    || policy.historical_fleet_baseline_manifest !== 'custodial-build22-rollback.json'
    || policy.candidate_manifest !== 'custodial-build27-candidate.json'
    || policy.rollback_strategy !== 'forward_versioned_recovery_apk'
    || !Number.isSafeInteger(policy.rollback_recovery_version_code)
    || policy.rollback_recovery_version_code <= policy.minimum_next_version_code
    || policy.maximum_candidate_version_code_for_staged_recovery !== policy.rollback_recovery_version_code - 1
    || policy.maximum_candidate_version_code_for_staged_recovery < policy.minimum_next_version_code
    || policy.required_rollback_contract !== 'scan.v4.snapshot-bound-authority'
    || typeof policy.advancement_rule !== 'string'
    || !policy.advancement_rule.trim()
  ) {
    throw new Error('Custodial Android release policy is malformed or internally inconsistent');
  }
  const rollbackBaseline = loadCustodialRollbackBaseline(policy);
  return Object.freeze({
    ...policy,
    sha256: sha256(bytes),
    rollback_baseline_sha256: rollbackBaseline?.sha256 ?? null,
  });
}

export function loadCustodialRollbackBaseline(policy, baselineBytes = null) {
  if (!policy.rollback_eligible) {
    if (
      policy.rollback_baseline_manifest !== null
      || typeof policy.rollback_blocker !== 'string'
      || !policy.rollback_blocker.trim()
    ) {
      throw new Error('Ineligible Custodial rollback policy must retain an explicit blocker and no active baseline');
    }
    return null;
  }

  const expectedManifest = `custodial-build${policy.highest_fleet_version_code}-rollback.json`;
  if (
    policy.rollback_baseline_manifest !== expectedManifest
    || policy.rollback_blocker !== null
  ) {
    throw new Error('Eligible Custodial rollback policy must bind the exact active baseline and clear its staging blocker');
  }
  const path = join(mobileRoot, 'release-policies', expectedManifest);
  const bytes = baselineBytes ?? readFileSync(path);
  const baseline = JSON.parse(bytes);
  const physical = baseline.physical_preflight || {};
  const recovery = baseline.forward_recovery || {};
  const recoverySource = recovery.source || {};
  const recoveryBuild = recovery.build || {};
  const recoveryArtifact = recovery.artifact || {};
  const recoveryProvenance = recovery.provenance_artifact || {};
  const recoveryCompatibility = recovery.compatibility_evidence || {};
  const rollbackDrill = baseline.physical_rollback_drill || {};
  const finalGate = baseline.final_gate || {};
  const candidateDrillComplete = finalGate.candidate_to_recovery_rollback_drill_complete === true;
  const expectedDrillCandidateVersion = candidateDrillComplete
    ? policy.maximum_candidate_version_code_for_staged_recovery
    : baseline.version_code;
  const expectedRecoveryRef = new RegExp(
    `^refs/heads/release/custodial-build${baseline.version_code}-recovery-v${recovery.package_version_code}-implementation-[0-9]{8}$`,
  );
  if (
    baseline?.schema_version !== 7
    || baseline.status !== 'staged_canary_forward_recovery'
    || baseline.package_name !== policy.package_name
    || baseline.version_name !== '1.0.0'
    || baseline.version_code !== policy.highest_fleet_version_code
    || baseline.signer_certificate_sha256 !== policy.fleet_signer_sha256
    || baseline.signer_public_key_sha256 !== policy.fleet_signer_public_key_sha256
    || baseline.source?.repository !== 'lasrevinu333-design/Engine'
    || baseline.source?.ref !== 'refs/heads/main'
    || !/^[a-f0-9]{40}$/.test(baseline.source?.commit || '')
    || !/^[a-f0-9]{40}$/.test(baseline.source?.tree || '')
    || baseline.source?.commit_exact !== true
    || baseline.build?.authority !== 'codemagic'
    || baseline.build?.workflow !== 'custodial-android'
    || !/^[a-f0-9]{24}$/.test(baseline.build?.build_id || '')
    || baseline.build?.build_number !== baseline.version_code
    || baseline.build?.first_attempt_passed !== true
    || baseline.build?.accepted !== true
    || baseline.artifact?.authority !== 'private_draft_github_release_asset'
    || baseline.artifact?.repository !== 'lasrevinu333-design/memphis-zoo-kiosk-control'
    || !Number.isSafeInteger(baseline.artifact?.release_id)
    || baseline.artifact?.release_is_draft !== true
    || !Number.isSafeInteger(baseline.artifact?.asset_id)
    || baseline.artifact?.asset_name !== `memphis-zoo-custodial-build${baseline.version_code}.apk`
    || baseline.artifact?.asset_sha256 !== policy.fleet_baseline_apk_sha256
    || baseline.artifact?.asset_digest_api !== `sha256:${policy.fleet_baseline_apk_sha256}`
    || recovery.strategy !== policy.rollback_strategy
    || recovery.source_capability_version_code !== baseline.version_code
    || recovery.package_version_code !== policy.rollback_recovery_version_code
    || recovery.signer_certificate_sha256 !== policy.fleet_signer_sha256
    || recovery.signer_public_key_sha256 !== policy.fleet_signer_public_key_sha256
    || recovery.candidate_minimum_version_code !== policy.minimum_next_version_code
    || recovery.candidate_maximum_version_code !== policy.maximum_candidate_version_code_for_staged_recovery
    || recovery.direct_version_downgrade_supported !== false
    || recovery.install_mode !== 'adb install -r --enable-rollback 2 without uninstall or data clear'
    || recovery.platform_restore_mode !== 'adb shell pm rollback-app org.memphiszoo.custodial'
    || recoverySource.repository !== 'lasrevinu333-design/Engine'
    || !expectedRecoveryRef.test(recoverySource.ref || '')
    || !/^[a-f0-9]{40}$/.test(recoverySource.commit || '')
    || !/^[a-f0-9]{40}$/.test(recoverySource.tree || '')
    || recoverySource.runtime_source_commit !== baseline.source?.commit
    || recoverySource.runtime_source_tree !== baseline.source?.tree
    || recoverySource.commit_exact !== true
    || recoveryBuild.authority !== 'codemagic'
    || recoveryBuild.workflow !== 'custodial-android'
    || !/^[a-f0-9]{24}$/.test(recoveryBuild.build_id || '')
    || recoveryBuild.build_number !== recovery.package_version_code
    || recoveryBuild.first_attempt_passed !== true
    || recoveryBuild.accepted !== true
    || recoveryArtifact.authority !== 'private_draft_github_release_asset'
    || recoveryArtifact.repository !== 'lasrevinu333-design/memphis-zoo-kiosk-control'
    || recoveryArtifact.release_id !== baseline.artifact?.release_id
    || recoveryArtifact.release_tag !== baseline.artifact?.release_tag
    || recoveryArtifact.release_is_draft !== true
    || !Number.isSafeInteger(recoveryArtifact.asset_id)
    || recoveryArtifact.asset_name !== `memphis-zoo-custodial-build${recovery.package_version_code}-recovery.apk`
    || !Number.isSafeInteger(recoveryArtifact.asset_size_bytes)
    || recoveryArtifact.asset_size_bytes < 1
    || !/^[a-f0-9]{64}$/.test(recoveryArtifact.asset_sha256 || '')
    || recoveryArtifact.asset_digest_api !== `sha256:${recoveryArtifact.asset_sha256}`
    || !Number.isSafeInteger(recoveryProvenance.asset_id)
    || recoveryProvenance.asset_name !== `Engine_${recovery.package_version_code}_artifacts.zip`
    || !Number.isSafeInteger(recoveryProvenance.asset_size_bytes)
    || recoveryProvenance.asset_size_bytes < 1
    || !/^[a-f0-9]{64}$/.test(recoveryProvenance.asset_sha256 || '')
    || recoveryProvenance.asset_digest_api !== `sha256:${recoveryProvenance.asset_sha256}`
    || recoveryCompatibility.package_name_matches !== true
    || recoveryCompatibility.signer_matches_fleet !== true
    || recoveryCompatibility.runtime_executables_match_baseline_except_build_identity !== true
    || recoveryCompatibility.native_vault_source_matches_baseline !== true
    || !/^[a-f0-9]{64}$/.test(recoveryCompatibility.native_vault_source_sha256 || '')
    || recoveryCompatibility.embedded_schema_sha256 !== baseline.compatibility_evidence?.embedded_schema_sha256
    || baseline.compatibility_evidence?.artifact_scan_contract !== policy.required_rollback_contract
    || baseline.compatibility_evidence?.required_scan_contract !== policy.required_rollback_contract
    || !/^[a-f0-9]{64}$/.test(baseline.compatibility_evidence?.embedded_schema_sha256 || '')
    || baseline.compatibility_evidence?.artifact_has_native_offline_authority !== true
    || baseline.compatibility_evidence?.artifact_has_durable_rollback_fence !== true
    || JSON.stringify(baseline.compatibility_evidence?.required_native_capabilities) !== JSON.stringify(requiredCustodialRollbackCapabilities)
    || baseline.compatibility_evidence?.required_native_capabilities_verified !== true
    || baseline.compatibility_evidence?.canary_release_eligible !== true
    || !Number.isSafeInteger(physical.in_place_upgrade_from_version_code)
    || physical.in_place_upgrade_from_version_code >= baseline.version_code
    || physical.first_install_time_preserved !== true
    || physical.enrollment_preserved !== true
    || physical.employee_identity_preserved !== true
    || physical.schedule_identity_preserved !== true
    || physical.process_recreation_passed !== true
    || physical.offline_reconnect_passed !== true
    || physical.device_reboot_passed !== true
    || physical.device_owner_preserved !== true
    || Object.values(physical.evidence_sha256 || {}).length < 6
    || Object.values(physical.evidence_sha256 || {}).some((digest) => !/^[a-f0-9]{64}$/.test(digest))
    || baseline.rollback?.target_source_version_code !== baseline.version_code
    || baseline.rollback?.recovery_package_version_code !== recovery.package_version_code
    || baseline.rollback?.eligible_candidate_minimum_version_code !== policy.minimum_next_version_code
    || baseline.rollback?.eligible_candidate_maximum_version_code !== policy.maximum_candidate_version_code_for_staged_recovery
    || baseline.rollback?.direct_downgrade_supported !== false
    || baseline.rollback?.preserve_enrollment_and_protected_state !== true
    || rollbackDrill.device_identifier !== physical.device_identifier
    || rollbackDrill.candidate_version_code !== expectedDrillCandidateVersion
    || !/^[a-f0-9]{64}$/.test(rollbackDrill.candidate_apk_sha256 || '')
    || !/^[a-f0-9]{40}$/.test(rollbackDrill.candidate_source_commit || '')
    || !/^[a-f0-9]{40}$/.test(rollbackDrill.candidate_source_tree || '')
    || (!candidateDrillComplete && rollbackDrill.candidate_apk_sha256 !== baseline.artifact?.asset_sha256)
    || (!candidateDrillComplete && rollbackDrill.candidate_source_commit !== baseline.source?.commit)
    || (!candidateDrillComplete && rollbackDrill.candidate_source_tree !== baseline.source?.tree)
    || rollbackDrill.recovery_version_code !== recovery.package_version_code
    || rollbackDrill.recovery_apk_sha256 !== recoveryArtifact.asset_sha256
    || rollbackDrill.direct_downgrade_rejected !== true
    || rollbackDrill.forward_recovery_install_passed !== true
    || rollbackDrill.android_retain_data_rollback_available !== true
    || rollbackDrill.android_retain_data_rollback_committed !== true
    || rollbackDrill.candidate_restored_exactly !== true
    || rollbackDrill.first_install_time_preserved !== true
    || rollbackDrill.enrollment_preserved !== true
    || rollbackDrill.employee_identity_preserved !== true
    || rollbackDrill.schedule_identity_preserved !== true
    || rollbackDrill.device_owner_preserved !== true
    || rollbackDrill.uninstall_or_data_clear_used !== false
    || Object.values(rollbackDrill.evidence_sha256 || {}).length < 6
    || Object.values(rollbackDrill.evidence_sha256 || {}).some((digest) => !/^[a-f0-9]{64}$/.test(digest))
    || finalGate.recovery_preflight_complete !== true
    || typeof finalGate.candidate_to_recovery_rollback_drill_complete !== 'boolean'
    || finalGate.physical_nfc_workflow_complete !== false
    || finalGate.required_before_production_candidate_acceptance !== true
    || finalGate.fleet_authorized !== false
  ) {
    throw new Error('Custodial active rollback baseline is malformed or overclaims physical acceptance');
  }
  return Object.freeze({ manifest: baseline, sha256: sha256(bytes) });
}

export const CUSTODIAL_ANDROID_RELEASE_POLICY = loadCustodialAndroidReleasePolicy();

// The digest is supplied separately by the release owner, never read from the
// input record. This is explicit build preparation, not device/fleet admission.
const reviewedForwardBuilds = new WeakSet();
const forwardFlagNames = ['--forward-source-input', '--forward-trusted-pins', '--forward-trusted-pins-sha256', '--forward-role'];

export function parseForwardBuildArguments(args) {
  if (!args.length) return null;
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]; const value = args[i + 1];
    if (!forwardFlagNames.includes(name) || !value || value.startsWith('--') || Object.hasOwn(flags, name)) throw new Error(`Unknown, repeated or incomplete forward build argument: ${name}`);
    flags[name] = value;
  }
  if (forwardFlagNames.some((name) => !Object.hasOwn(flags, name))) throw new Error('Forward build requires source input, trusted pins, an independently reviewed SHA-256, and candidate/recovery role');
  if (!/^[a-f0-9]{64}$/.test(flags['--forward-trusted-pins-sha256'])) throw new Error('Forward trusted-pins SHA-256 is invalid');
  if (!['candidate', 'recovery'].includes(flags['--forward-role'])) throw new Error('Forward build role must be candidate or recovery');
  return flags;
}

function freezeForwardBuild(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeForwardBuild(child); Object.freeze(value); }
  return value;
}

async function readReviewedForwardBuildInputs(flags, { buildNumber } = {}) {
  if (!flags) return null;
  // Validate callers of the exported loader just as strictly as CLI callers.
  flags = parseForwardBuildArguments(Object.entries(flags).flat());
  const inputPath = flags['--forward-source-input']; const pinsPath = flags['--forward-trusted-pins'];
  if (inputPath === pinsPath) throw new Error('Forward source input and reviewed pins must be distinct');
  const pinsEnvelope = parseDeterministicJson(await readForwardSourceBytes(pinsPath, 'Reviewed forward pins', flags['--forward-trusted-pins-sha256']), 'Reviewed forward pins');
  const inputEnvelope = parseDeterministicJson(await readForwardSourceBytes(inputPath, 'Forward build source input'), 'Forward build source input');
  if (Object.keys(inputEnvelope).sort().join(',') !== ['schema_version','kind','source_only','activation','adapter_input'].sort().join(',') || inputEnvelope.schema_version !== 1 || inputEnvelope.kind !== 'custodial.forward-source-admission-input.v1' || inputEnvelope.source_only !== true || inputEnvelope.activation !== false) throw new Error('Forward build input must use the inactive G30 envelope');
  if (Object.keys(pinsEnvelope).sort().join(',') !== ['schema_version','kind','external_trusted_pins','evidence_files'].sort().join(',') || pinsEnvelope.schema_version !== 1 || pinsEnvelope.kind !== 'custodial.forward-build-reviewed-pins.v1') throw new Error('Forward build requires the reviewed G30 build pins envelope');
  const input = inputEnvelope.adapter_input; const pins = pinsEnvelope.external_trusted_pins;
  const inspection = inspectForwardTransitionSourceAdmission(input, pins);
  if (!inspection.accepted || input.purpose !== 'build_preparation') throw new Error(`Forward build contract rejected: ${inspection.reason}`);
  if (pins.package_name !== CUSTODIAL_ANDROID_RELEASE_POLICY.package_name || pins.signer_certificate_sha256 !== CUSTODIAL_ANDROID_RELEASE_POLICY.fleet_signer_sha256 || pins.signer_public_key_sha256 !== CUSTODIAL_ANDROID_RELEASE_POLICY.fleet_signer_public_key_sha256) throw new Error('Forward build signer/package differs from the public fleet pins');
  for (const key of ['highest_fleet_version_code','minimum_next_version_code','maximum_candidate_version_code_for_staged_recovery']) if (pins.legacy_policy[key] !== CUSTODIAL_ANDROID_RELEASE_POLICY[key]) throw new Error('Forward build cannot replace the legacy fleet policy');
  const evidence = pinsEnvelope.evidence_files;
  const stores = ['enrollment', 'protected_pending', 'history', 'crypto'];
  if (!evidence || Object.keys(evidence).sort().join(',') !== [...Object.keys(pins.evidence_refs), ...stores].sort().join(',')) throw new Error('Forward build requires all reviewed baseline/source/retained-plan and per-store evidence files');
  const evidencePaths = resolveCustodialForwardEvidenceFiles(pinsPath, evidence);
  for (const [name, path] of Object.entries(evidencePaths)) {
    const expectedHash = pins.evidence_refs[name] ?? pins.retained_store_compatibility[name].provenance_sha256;
    const bytes = await readForwardSourceBytes(path, name, expectedHash);
    if (name === 'retained_data_plan_sha256' && JSON.stringify(parseDeterministicJson(bytes, 'Reviewed retained-data plan')) !== JSON.stringify(pins.retained_store_compatibility)) throw new Error('Retained-data plan bytes differ from the exact reviewed compatibility record');
  }
  const role = flags['--forward-role']; const descriptor = pins[role];
  if (buildNumber !== undefined && buildNumber !== descriptor.version_code) throw new Error('Forward build number differs from the exact reviewed role');
  if (pins.candidate.source.ref !== 'refs/heads/main' || pins.recovery.source.ref === pins.candidate.source.ref || !pins.recovery.source.ref.startsWith('refs/heads/')) throw new Error('Forward candidate must use protected main and recovery a distinct reviewed branch');
  if (pins.retained_store_compatibility.source_pair.frontend_commit !== pins.candidate.source.commit || pins.retained_store_compatibility.source_pair.frontend_tree !== pins.candidate.source.tree) throw new Error('Retained-data compatibility plan is bound to another candidate source');
  return freezeForwardBuild({ input, pins, role, descriptor, trusted_pins_sha256: flags['--forward-trusted-pins-sha256'] });
}

// Source selection is not an acceptance context. It supplies only the exact
// independently hash-pinned ref to the normal private checkout preparation;
// the existing loader must subsequently observe that checkout and mint its
// private brand before any verifier may use it.
export async function readReviewedForwardBuildSourceSelection(flags) {
  const declared = await readReviewedForwardBuildInputs(flags);
  if (declared === null) return null;
  return freezeForwardBuild({ ...declared.descriptor.source, version_code: declared.descriptor.version_code, artifact_sha256: declared.descriptor.artifact_sha256, runtime_sha256: declared.descriptor.runtime_sha256 });
}

export async function loadReviewedForwardBuild(flags, { buildNumber, repositoryDirectory = repositoryRoot } = {}) {
  if (!flags) return null;
  const context = await readReviewedForwardBuildInputs(flags, { buildNumber });
  const { input, pins, role, descriptor } = context;
  if (buildNumber !== descriptor.version_code) throw new Error('Forward build number differs from the exact reviewed role');
  const git = (args) => { const result = spawnSync('git', ['-C', repositoryDirectory, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 }); if (result.status !== 0 || result.error) throw new Error(`Unable to inspect forward build source: ${result.error?.code ?? String(result.stderr).trim()}`); return result.stdout.trim(); };
  const commit = git(['rev-parse','HEAD']); const tree = git(['rev-parse','HEAD^{tree}']); const ref = git(['symbolic-ref','HEAD']);
  if (commit !== descriptor.source.commit || tree !== descriptor.source.tree || ref !== descriptor.source.ref || git(['status','--porcelain=v1','--untracked-files=all'])) throw new Error('Forward build requires the exact clean reviewed source commit/tree/ref');
  if (sha256(await readFile(join(repositoryDirectory,'mobile/scripts/custodial-android-release-acceptance.schema.json'))) !== descriptor.schema_sha256 || custodialNativeVaultSourceDigest(join(repositoryDirectory,'mobile/plugins/custodial-native-vault')) !== descriptor.native_sha256) throw new Error('Forward build schema or native source differs from reviewed pins');
  reviewedForwardBuilds.add(context);
  return context;
}

export function assertReviewedForwardBuild(context, { buildNumber, sourceCommit, sourceTree, sourceRef } = {}) {
  if (!reviewedForwardBuilds.has(context)) throw new Error('Forward build context was not loaded from independently pinned reviewed bytes');
  const d = context.descriptor;
  if (buildNumber !== d.version_code || (sourceCommit !== undefined && sourceCommit !== d.source.commit) || (sourceTree !== undefined && sourceTree !== d.source.tree) || (sourceRef !== undefined && sourceRef !== d.source.ref)) throw new Error('Forward build facts differ from the reviewed role/source');
  return d;
}

export function forwardBuildProvenance(context) {
  assertReviewedForwardBuild(context, { buildNumber: context.descriptor.version_code });
  return { target_id: context.input.target_id, policy_generation: context.input.policy_generation, trusted_pins_sha256: context.trusted_pins_sha256, role: context.role, installed_version_code: context.pins.installed_target.version_code, candidate_version_code: context.pins.candidate.version_code, recovery_version_code: context.pins.recovery.version_code, source_ref: context.descriptor.source.ref, fleet_promotion: false, installation_admitted: false, physical_verified: false };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function requireExactCount(source, pattern, expected, label) {
  const count = countMatches(source, pattern);
  if (count !== expected) {
    throw new Error(`${label} must occur exactly ${expected} time(s); found ${count}`);
  }
}

function parseXmlAttributes(source, label) {
  const attributes = {};
  const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g;
  for (const match of source.matchAll(pattern)) {
    const [, name, value] = match;
    if (Object.hasOwn(attributes, name)) {
      throw new Error(`${label} repeats the "${name}" attribute`);
    }
    attributes[name] = value;
  }
  if (source.replace(pattern, '').trim()) {
    throw new Error(`${label} contains malformed or unsupported attributes`);
  }
  return attributes;
}

export function inspectGradleVerificationMetadata(bytes, edition) {
  if (!editions[edition]) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const source = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  if (!source.includes('https://schema.gradle.org/dependency-verification/dependency-verification-1.3.xsd')) {
    throw new Error(`${edition} Gradle verification metadata does not use the reviewed 1.3 schema`);
  }

  const artifacts = new Map();
  const componentKeys = new Set();
  const componentPattern = /<component\s+([^>]+)>([\s\S]*?)<\/component>/g;
  const components = [...source.matchAll(componentPattern)];
  if (components.length === 0 || components.length !== countMatches(source, /<component\b/g)) {
    throw new Error(`${edition} Gradle verification metadata contains a malformed component graph`);
  }

  for (const [, rawComponentAttributes, body] of components) {
    const component = parseXmlAttributes(rawComponentAttributes, `${edition} Gradle component`);
    const componentAttributeNames = Object.keys(component).sort();
    if (
      JSON.stringify(componentAttributeNames) !== JSON.stringify(['group', 'name', 'version'])
      || !component.group
      || !component.name
      || !component.version
    ) {
      throw new Error(`${edition} Gradle component must declare exactly group, name, and version`);
    }
    const componentKey = `${component.group}:${component.name}:${component.version}`;
    if (componentKeys.has(componentKey)) {
      throw new Error(`${edition} Gradle verification metadata repeats component ${componentKey}`);
    }
    componentKeys.add(componentKey);

    const artifactPattern = /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/g;
    const componentArtifacts = [...body.matchAll(artifactPattern)];
    if (
      componentArtifacts.length === 0
      || componentArtifacts.length !== countMatches(body, /<artifact\b/g)
      || body.replace(artifactPattern, '').trim()
    ) {
      throw new Error(`${edition} Gradle component ${componentKey} contains malformed artifact metadata`);
    }

    for (const [, rawArtifactAttributes, artifactBody] of componentArtifacts) {
      const artifact = parseXmlAttributes(
        rawArtifactAttributes,
        `${edition} Gradle artifact in ${componentKey}`,
      );
      if (Object.keys(artifact).length !== 1 || !artifact.name) {
        throw new Error(`${edition} Gradle artifact in ${componentKey} must declare exactly one name`);
      }
      const artifactKey = `${componentKey}/${artifact.name}`;
      if (artifacts.has(artifactKey)) {
        throw new Error(`${edition} Gradle verification metadata repeats artifact ${artifactKey}`);
      }
      const checksumPattern = /<sha256\s+([^>]+)\/>/g;
      const checksums = [...artifactBody.matchAll(checksumPattern)];
      if (checksums.length !== 1 || artifactBody.replace(checksumPattern, '').trim()) {
        throw new Error(`${edition} Gradle artifact ${artifactKey} must have exactly one SHA-256`);
      }
      const checksum = parseXmlAttributes(
        checksums[0][1],
        `${edition} Gradle checksum for ${artifactKey}`,
      );
      if (
        Object.keys(checksum).sort().join(',') !== 'origin,value'
        || !/^[a-f0-9]{64}$/.test(checksum.value || '')
        || !['Generated by Gradle', 'Google Maven SHA-256'].includes(checksum.origin)
      ) {
        throw new Error(`${edition} Gradle artifact ${artifactKey} has an invalid SHA-256 record`);
      }
      artifacts.set(artifactKey, checksum.value);
    }
  }

  for (const required of [
    'com.google.guava:guava-parent:33.3.1-jre/guava-parent-33.3.1-jre.pom',
    'org.junit:junit-bom:5.10.2/junit-bom-5.10.2.module',
    'org.junit:junit-bom:5.10.2/junit-bom-5.10.2.pom',
  ]) {
    if (!artifacts.has(required)) {
      throw new Error(`${edition} Gradle verification metadata is missing required artifact ${required}`);
    }
  }

  return {
    componentCount: componentKeys.size,
    artifactCount: artifacts.size,
    artifacts,
  };
}

export function configureAndroidVariablesSource(source, edition) {
  if (!editions[edition]) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  if (edition !== 'custodial') return source;
  const minSdkPattern = /^(\s*minSdkVersion\s*=\s*)\d+(\s*)$/gm;
  requireExactCount(source, minSdkPattern, 1, 'Android minimum SDK declaration');
  return source.replace(minSdkPattern, (_match, prefix, suffix) => `${prefix}26${suffix}`);
}

function insertBefore(source, marker, insertion, label) {
  const first = source.indexOf(marker);
  if (first < 0 || source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`${label} marker must occur exactly once`);
  }
  return `${source.slice(0, first)}${insertion}${source.slice(first)}`;
}

function insertAfter(source, marker, insertion, label) {
  const first = source.indexOf(marker);
  if (first < 0 || source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`${label} marker must occur exactly once`);
  }
  const offset = first + marker.length;
  return `${source.slice(0, offset)}${insertion}${source.slice(offset)}`;
}

export function resolveBuildNumber(environment = process.env) {
  const candidates = [
    ['PROJECT_BUILD_NUMBER', environment.PROJECT_BUILD_NUMBER],
    ['BUILD_NUMBER', environment.BUILD_NUMBER],
    ['MZ_BUILD_NUMBER', environment.MZ_BUILD_NUMBER],
  ];
  const [source, raw] = candidates.find(([, value]) => String(value || '').trim()) || [];
  const value = String(raw || '').trim();
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('PROJECT_BUILD_NUMBER, BUILD_NUMBER, or MZ_BUILD_NUMBER must provide a positive integer');
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric > 2_100_000_000) {
    throw new Error('Native build number must be a safe integer no greater than 2100000000');
  }
  return { value, numeric, source };
}

export function resolveReleaseVersion(environment = process.env) {
  const value = String(environment.MZ_RELEASE_VERSION || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error('MZ_RELEASE_VERSION must contain three numeric components');
  }
  return value;
}

export function assertEditionBuildFloor(edition, buildNumber) {
  const numeric = Number(buildNumber);
  if (!Number.isSafeInteger(numeric) || numeric < 1) {
    throw new Error('Native build number must be a positive safe integer');
  }
  if (
    edition === 'custodial'
    && numeric < CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code
  ) {
    throw new Error(
      `Custodial Android versionCode must be at least protected release floor ${CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code}`,
    );
  }
  return numeric;
}

export function injectAndroidOverlay(source, { includeSigning = true } = {}) {
  let configured = source.trimEnd();
  for (const [line, required, label] of [
    [androidVersionOverlayLine, true, 'native Android version overlay'],
    [androidSigningOverlayLine, includeSigning, 'Codemagic Android signing overlay'],
  ]) {
    const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = countMatches(configured, new RegExp(`^${escaped}$`, 'gm'));
    if (count > 1) throw new Error(`${label} is applied more than once`);
    if (required && count === 0) configured = `${configured}\n\n${line}`;
    if (!required && count !== 0) throw new Error(`${label} leaked into a non-signing Android build`);
  }
  return `${configured}\n`;
}

export function configureGradleWrapperSource(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  requireExactCount(
    normalized,
    /^distributionUrl=.*$/gm,
    1,
    'Gradle wrapper distribution URL',
  );
  requireExactCount(
    normalized,
    new RegExp(`^distributionUrl=${gradleDistributionUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm'),
    1,
    'approved Gradle wrapper distribution URL',
  );
  const checksumLines = normalized.match(/^distributionSha256Sum=.*$/gm) || [];
  if (checksumLines.length > 1) {
    throw new Error(`Gradle wrapper distribution checksum must occur at most once; found ${checksumLines.length}`);
  }
  if (
    checksumLines.length === 1
    && checksumLines[0] !== `distributionSha256Sum=${gradleDistributionSha256}`
  ) {
    throw new Error('Gradle wrapper distribution checksum does not match the approved Gradle 8.14.3 all-distribution');
  }
  const configured = checksumLines.length === 1
    ? normalized
    : normalized.replace(
      /^distributionUrl=.*$/m,
      `distributionSha256Sum=${gradleDistributionSha256}\n$&`,
    );
  requireExactCount(
    configured,
    new RegExp(`^distributionSha256Sum=${gradleDistributionSha256}$`, 'gm'),
    1,
    'approved Gradle wrapper distribution checksum',
  );
  return configured;
}

export function validateGradleWrapperJar(bytes) {
  const actual = sha256(bytes);
  if (actual !== gradleWrapperJarSha256) {
    throw new Error(`Gradle wrapper JAR does not match the approved Gradle 8.14.3 wrapper (${actual})`);
  }
  return actual;
}

export function validateGradleVerificationMetadata(bytes, edition) {
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const source = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  const actual = sha256(bytes);
  if (actual !== definition.androidVerificationMetadataSha256) {
    throw new Error(`${edition} Gradle verification metadata does not match the reviewed dependency graph (${actual})`);
  }
  requireExactCount(source, /<verify-metadata>true<\/verify-metadata>/g, 1, 'Gradle metadata verification policy');
  requireExactCount(source, /<verify-signatures>false<\/verify-signatures>/g, 1, 'Gradle signature verification policy');
  if (!/<components>[\s\S]*<component [^>]+>[\s\S]*<sha256 value="[a-f0-9]{64}"/.test(source)) {
    throw new Error(`${edition} Gradle verification metadata does not contain a checksum-locked component graph`);
  }
  if (/<(?:trusted-artifacts|ignored-keys|sha1|md5)\b/.test(source)) {
    throw new Error(`${edition} Gradle verification metadata contains an unapproved trust bypass or weak digest`);
  }
  inspectGradleVerificationMetadata(bytes, edition);
  return actual;
}

export function configureIosProjectSource(source, {
  appIdentifier,
  buildNumber,
  releaseVersion,
  includeFirebase,
}) {
  const normalized = source.replace(/\n\s*VERSIONING_SYSTEM = apple-generic;/g, '');
  requireExactCount(
    normalized,
    new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${appIdentifier.replaceAll('.', '\\.')};`, 'g'),
    2,
    'iOS application identifier',
  );
  requireExactCount(normalized, /CURRENT_PROJECT_VERSION = [^;]+;/g, 2, 'iOS target build number');
  requireExactCount(normalized, /MARKETING_VERSION = [^;]+;/g, 2, 'iOS target release version');
  let configured = normalized
    .replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${buildNumber};\n\t\t\t\tVERSIONING_SYSTEM = apple-generic;`,
    )
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${releaseVersion};`);

  if (includeFirebase) {
    if (!configured.includes('GoogleService-Info.plist')) {
      configured = insertBefore(
        configured,
        '/* End PBXBuildFile section */',
        '\t\t4D5A46424346470000000001 /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = 4D5A46424346470000000002 /* GoogleService-Info.plist */; };\n',
        'PBXBuildFile end',
      );
      configured = insertBefore(
        configured,
        '/* End PBXFileReference section */',
        '\t\t4D5A46424346470000000002 /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };\n',
        'PBXFileReference end',
      );
      configured = insertAfter(
        configured,
        '\t\t504EC3061FED79650016851F /* App */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n',
        '\t\t\t\t4D5A46424346470000000002 /* GoogleService-Info.plist */,\n',
        'App PBXGroup children',
      );
      configured = insertAfter(
        configured,
        '\t\t504EC3021FED79650016851F /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n',
        '\t\t\t\t4D5A46424346470000000001 /* GoogleService-Info.plist in Resources */,\n',
        'App resources build phase',
      );
    }
    requireExactCount(configured, /GoogleService-Info\.plist in Resources/g, 2, 'Firebase iOS resource');
    requireExactCount(
      configured,
      /4D5A46424346470000000002 \/\* GoogleService-Info\.plist \*\//g,
      3,
      'Firebase iOS file reference',
    );
  } else if (configured.includes('GoogleService-Info.plist')) {
    throw new Error('Firebase iOS configuration leaked into a non-Manager edition');
  }

  requireExactCount(
    configured,
    new RegExp(`CURRENT_PROJECT_VERSION = ${buildNumber};`, 'g'),
    2,
    'configured iOS target build number',
  );
  requireExactCount(
    configured,
    new RegExp(`MARKETING_VERSION = ${releaseVersion.replaceAll('.', '\\.')};`, 'g'),
    2,
    'configured iOS target release version',
  );
  requireExactCount(configured, /VERSIONING_SYSTEM = apple-generic;/g, 2, 'iOS versioning system');
  return configured;
}

export function validateSwiftLock(lock, edition) {
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  if (edition === 'custodial') {
    throw new Error('Custodial is Android-only and must not have an iOS Swift package lock');
  }
  if (lock.version !== 2 || !Array.isArray(lock.pins)) {
    throw new Error(`${edition} Swift package lock must use Package.resolved schema version 2`);
  }
  const actual = Object.fromEntries(lock.pins.map((pin) => [
    pin.identity,
    [pin?.state?.version, pin?.state?.revision],
  ]));
  if (JSON.stringify(actual) !== JSON.stringify(definition.swiftPins)) {
    throw new Error(`${edition} Swift package lock does not match the approved dependency graph`);
  }
}

async function writeProvenance(edition, platform, record) {
  const directory = join(repositoryRoot, 'build', 'provenance');
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, `${edition}-${platform}-configuration.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

async function configureAndroidWrapper(edition) {
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const wrapperPath = join(
    mobileRoot,
    'android',
    'gradle',
    'wrapper',
    'gradle-wrapper.properties',
  );
  const wrapperJarPath = join(
    mobileRoot,
    'android',
    'gradle',
    'wrapper',
    'gradle-wrapper.jar',
  );
  const source = await readFile(wrapperPath, 'utf8');
  const wrapperJar = await readFile(wrapperJarPath);
  const wrapperJarDigest = validateGradleWrapperJar(wrapperJar);
  const configured = configureGradleWrapperSource(source);
  await writeFile(wrapperPath, configured);
  const verificationLockPath = join(
    mobileRoot,
    'native-locks',
    'android',
    edition,
    'verification-metadata.xml',
  );
  const verificationBytes = await readFile(verificationLockPath);
  const verificationDigest = validateGradleVerificationMetadata(verificationBytes, edition);
  const verificationPath = join(mobileRoot, 'android', 'gradle', 'verification-metadata.xml');
  await mkdir(dirname(verificationPath), { recursive: true });
  await writeFile(verificationPath, verificationBytes);
  const variablesPath = join(mobileRoot, 'android', 'variables.gradle');
  const variablesBytes = configureAndroidVariablesSource(
    await readFile(variablesPath, 'utf8'),
    edition,
  );
  await writeFile(variablesPath, variablesBytes);
  return {
    path: wrapperPath,
    bytes: configured,
    jarPath: wrapperJarPath,
    jarDigest: wrapperJarDigest,
    verificationPath,
    verificationLockPath,
    verificationBytes,
    verificationDigest,
    variablesPath,
    variablesBytes,
  };
}

async function configureAndroid({
  edition,
  definition,
  build,
  releaseVersion,
  environment,
  signing,
  forwardBuild = null,
}) {
  if (forwardBuild) {
    if (edition !== 'custodial') throw new Error('Forward build is restricted to Custodial Android');
    assertReviewedForwardBuild(forwardBuild, { buildNumber: build.numeric });
  }
  if (signing) {
    for (const name of [
      'CM_KEYSTORE_PATH',
      'CM_KEYSTORE_PASSWORD',
      'CM_KEY_ALIAS',
      'CM_KEY_PASSWORD',
    ]) {
      if (!String(environment[name] || '').trim()) {
        throw new Error(`Missing required Android signing environment variable: ${name}`);
      }
    }
    await access(environment.CM_KEYSTORE_PATH);
  }
  const buildGradlePath = join(mobileRoot, 'android', 'app', 'build.gradle');
  const source = await readFile(buildGradlePath, 'utf8');
  requireExactCount(
    source,
    new RegExp(`applicationId "${definition.appIdentifier.replaceAll('.', '\\.')}"`, 'g'),
    1,
    'Android application identifier',
  );
  const ordinaryConfigured = injectAndroidOverlay(source, { includeSigning: signing });
  const newProducerScope=edition==='custodial'?readCustodialBuildScope(mobileRoot):null;
  if(edition==='custodial'&&isCleaningScope(newProducerScope)&&signing!==true)throw Error('Cleaning-first scope requires signed configuration');
  const scopeSource=edition==='custodial'?await prepareNewProducerScopeSources({repositoryRoot,mobileRoot,ticket:newProducerScope}):null;
  const notificationWriterSource = edition === 'custodial'
    ? await prepareCustodialNotificationWriterSources({repositoryRoot,mobileRoot,scopeTicket:newProducerScope}) : null;
  const configured = edition === 'custodial'
    ? injectCustodialNotificationWriterOverlay(ordinaryConfigured) : ordinaryConfigured;
  await writeFile(buildGradlePath, configured);
  const wrapper = await configureAndroidWrapper(edition);
  const keystoreDigest = signing ? sha256(await readFile(environment.CM_KEYSTORE_PATH)) : null;
  const embeddedBuild = JSON.parse(await readFile(join(mobileRoot, 'mobile-dist', 'build.json'), 'utf8'));
  const expectedSourceCommit = String(environment.CM_COMMIT || environment.MZ_SOURCE_COMMIT || '').trim().toLowerCase();
  if (forwardBuild) assertReviewedForwardBuild(forwardBuild, { buildNumber: build.numeric, sourceCommit: embeddedBuild.source_commit, sourceTree: embeddedBuild.source_tree });
  if (edition === 'custodial' && signing && (
    embeddedBuild.source_commit_exact !== true
    || !expectedSourceCommit
    || embeddedBuild.source_commit !== expectedSourceCommit
  )) {
    throw new Error('Custodial signing refuses a dirty or non-commit-exact web payload');
  }
  let custodialNativeVaultSourceSha256 = null;
  let custodialCapacitorRuntimeProof = null;
  if (edition === 'custodial') {
    custodialNativeVaultSourceSha256 = custodialNativeVaultSourceDigest(join(
      mobileRoot,
      'plugins',
      'custodial-native-vault',
    ));
    if (embeddedBuild.custodial_native_vault_source_sha256 !== custodialNativeVaultSourceSha256) {
      throw new Error('Custodial web payload native-vault source digest is stale');
    }
    const generatedPluginsPath = join(mobileRoot, 'android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');
    const generatedConfigPath = join(mobileRoot, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
    const [generatedPluginsBytes, generatedConfigBytes] = await Promise.all([
      readFile(generatedPluginsPath),
      readFile(generatedConfigPath),
    ]);
    const shellStartEnabled = /^(1|true|yes)$/i.test(String(environment.MZ_SHELL_START || ''));
    if (!shellStartEnabled) {
      throw new Error('Custodial Android native configuration requires MZ_SHELL_START=1');
    }
    custodialCapacitorRuntimeProof = inspectCustodialCapacitorRuntime({
      pluginManifestBytes: generatedPluginsBytes,
      capacitorConfigBytes: generatedConfigBytes,
    });
    // No environment activation switch: both compiled Java and this branch use
    // the exact reviewed source record. Empty inputs preserve debug ownership,
    // while a qualified signed release refuses absent qualification.
    const appManifestPath = join(mobileRoot,'android','app','src','main','AndroidManifest.xml');
    const appManifest = await readFile(appManifestPath,'utf8');
    let providerManifest;
    if(isCleaningScope(newProducerScope)){
      if(signing!==true)throw Error('Cleaning-first scope requires signed configuration');
      if(JSON.stringify(embeddedBuild.cleaning_first_scope)!==JSON.stringify(scopeBuildRecord(newProducerScope,await readFile(join(mobileRoot,'mobile-dist','memphis-custodial-bridge.js')))))throw Error('Embedded JS scope differs from current Source');
      if(/minifyEnabled\s+(?:true|=\s*true)/.test(source))throw Error('Scoped DEX proof requires non-shrunk exact modules');
      providerManifest=configureCleaningScopeManifest(appManifest,newProducerScope);
    }else{
      if(appManifest.includes('org.memphiszoo.custodial.NEW_PRODUCER_SCOPE'))throw Error('Full-system manifest cannot retain a cleaning scope marker');
      const providerRelease = readReviewedProviderRelease(join(mobileRoot,'plugins','custodial-native-vault'), {
        versionCode: build.numeric, versionName: releaseVersion, required: signing,
      });
      providerManifest=configureProviderManifest(appManifest,providerRelease);
    }
    if (providerManifest !== appManifest) await writeFile(appManifestPath,providerManifest);
  }
  await writeProvenance(edition, 'android', {
    schema_version: 1,
    edition,
    platform: 'android',
    app_identifier: definition.appIdentifier,
    release_version: releaseVersion,
    build_number: build.numeric,
    build_number_source: build.source,
    source_commit: embeddedBuild.source_commit || null,
    source_tree: embeddedBuild.source_tree || null,
    source_commit_exact: embeddedBuild.source_commit_exact === true,
    ...(forwardBuild ? { forward_transition: forwardBuildProvenance(forwardBuild) } : {}),
    signing_configured: signing,
    signing_keystore_sha256: keystoreDigest,
    generated_build_gradle_sha256: sha256(configured),
    custodial_notification_writer_source: notificationWriterSource,
    custodial_new_producer_scope_source: scopeSource,
    version_overlay_sha256: sha256(await readFile(join(mobileRoot, 'scripts', 'native-version.gradle'))),
    release_overlay_sha256: sha256(await readFile(join(mobileRoot, 'scripts', 'codemagic-release.gradle'))),
    gradle_wrapper_properties_sha256: sha256(wrapper.bytes),
    gradle_wrapper_jar_sha256: wrapper.jarDigest,
    gradle_distribution_sha256: gradleDistributionSha256,
    gradle_verification_metadata_sha256: wrapper.verificationDigest,
    generated_variables_gradle_sha256: sha256(wrapper.variablesBytes),
    custodial_release_policy_sha256: edition === 'custodial'
      ? CUSTODIAL_ANDROID_RELEASE_POLICY.sha256
      : null,
    custodial_highest_fleet_version_code: edition === 'custodial'
      ? CUSTODIAL_ANDROID_RELEASE_POLICY.highest_fleet_version_code
      : null,
    custodial_minimum_next_version_code: edition === 'custodial'
      ? CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code
      : null,
    custodial_native_vault_source_sha256: custodialNativeVaultSourceSha256,
    generated_capacitor_plugins_sha256:
      custodialCapacitorRuntimeProof?.plugin_manifest_sha256 || null,
    generated_capacitor_config_sha256:
      custodialCapacitorRuntimeProof?.capacitor_config_sha256 || null,
    custodial_capacitor_plugin_count:
      custodialCapacitorRuntimeProof?.plugin_count || null,
    custodial_capacitor_plugin_graph_sha256:
      custodialCapacitorRuntimeProof?.plugin_graph_sha256 || null,
    custodial_capacitor_config_policy_sha256:
      custodialCapacitorRuntimeProof?.capacitor_config_policy_sha256 || null,
    custodial_capacitor_include_plugins_match_manifest:
      edition === 'custodial'
        ? custodialCapacitorRuntimeProof?.include_plugins_match_manifest === true
        : null,
  });
}

async function configureIos({ edition, definition, build, releaseVersion, environment }) {
  if (edition === 'custodial') {
    throw new Error('Custodial is Android-only and cannot be configured for iOS');
  }
  const projectPath = join(mobileRoot, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  const firebasePath = join(mobileRoot, 'ios', 'App', 'App', 'GoogleService-Info.plist');
  if (edition === 'manager') await access(firebasePath);
  const source = await readFile(projectPath, 'utf8');
  const configured = configureIosProjectSource(source, {
    appIdentifier: definition.appIdentifier,
    buildNumber: build.value,
    releaseVersion,
    includeFirebase: edition === 'manager',
  });
  await writeFile(projectPath, configured);

  const lockPath = join(mobileRoot, 'native-locks', 'ios', edition, 'Package.resolved');
  const lockBytes = await readFile(lockPath);
  validateSwiftLock(JSON.parse(lockBytes), edition);
  const resolvedPath = join(
    mobileRoot,
    'ios',
    'App',
    'App.xcodeproj',
    'project.xcworkspace',
    'xcshareddata',
    'swiftpm',
    'Package.resolved',
  );
  await mkdir(dirname(resolvedPath), { recursive: true });
  await copyFile(lockPath, resolvedPath);
  await writeProvenance(edition, 'ios', {
    schema_version: 1,
    edition,
    platform: 'ios',
    app_identifier: definition.appIdentifier,
    release_version: releaseVersion,
    build_number: build.numeric,
    build_number_source: build.source,
    source_commit: environment.CM_COMMIT || environment.MZ_SOURCE_COMMIT || null,
    signing_configured: false,
    generated_project_sha256: sha256(configured),
    swift_package_lock_sha256: sha256(lockBytes),
  });
}

function exactObjectKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length) throw new Error(`${label} contains unsupported field ${unknown[0]}`);
}

export function parseForwardSourceArguments(args) {
  if (args.length !== 4 || args[0] !== '--source-input' || args[2] !== '--trusted-pins') {
    throw new Error(
      'Usage: node scripts/configure-native-release.mjs forward-source --source-input <absolute-json> --trusted-pins <absolute-json>',
    );
  }
  for (const [index, path] of [[1, args[1]], [3, args[3]]]) {
    if (!path || !path.startsWith('/') || resolve(path) !== path) {
      throw new Error(`Forward source input ${index === 1 ? 'source' : 'trusted-pins'} path must be canonical absolute`);
    }
  }
  if (args[1] === args[3]) throw new Error('Forward source input and trusted-pins files must be distinct');
  return { sourceInputPath: args[1], trustedPinsPath: args[3] };
}

async function readForwardSourceBytes(path, label, expectedHash = null) {
  if (typeof path !== 'string' || !path.startsWith('/') || resolve(path) !== path) throw new Error(`${label} must be a canonical absolute file`);
  const metadata = await lstat(path).catch(() => null);
  if (!metadata || !metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be an existing regular non-symlink file`);
  }
  if (await realpath(path) !== path) throw new Error(`${label} must resolve to itself without symlink indirection`);
  if (metadata.size > 4 * 1024 * 1024) throw new Error(`${label} exceeds the bounded reviewed input size`);
  const bytes = await readFile(path);
  if (expectedHash !== null && sha256(bytes) !== expectedHash) throw new Error(`${label} bytes differ from the independent reviewed pin`);
  return bytes;
}

async function readForwardSourceJson(path, label, expectedHash = null) {
  return JSON.parse(await readForwardSourceBytes(path, label, expectedHash));
}

export async function runForwardSourceAdmission(args) {
  const { sourceInputPath, trustedPinsPath } = parseForwardSourceArguments(args);
  const sourceEnvelope = await readForwardSourceJson(sourceInputPath, 'Forward source input');
  const trustedEnvelope = await readForwardSourceJson(trustedPinsPath, 'Forward trusted-pins input');
  exactObjectKeys(sourceEnvelope, ['schema_version', 'kind', 'source_only', 'activation', 'adapter_input'], 'Forward source input');
  exactObjectKeys(trustedEnvelope, ['schema_version', 'kind', 'external_trusted_pins'], 'Forward trusted-pins input');
  if (
    sourceEnvelope.schema_version !== 1
    || sourceEnvelope.kind !== 'custodial.forward-source-admission-input.v1'
    || sourceEnvelope.source_only !== true
    || sourceEnvelope.activation !== false
  ) throw new Error('Forward source input must be the exact inactive source-only envelope');
  if (
    trustedEnvelope.schema_version !== 1
    || trustedEnvelope.kind !== 'custodial.forward-source-trusted-pins.v1'
  ) throw new Error('Forward trusted-pins input must be the exact trusted-pins envelope');
  const adapter = await import('./custodial-forward-transition-admission-adapter.mjs');
  const result = adapter.inspectForwardTransitionSourceAdmission(
    sourceEnvelope.adapter_input,
    trustedEnvelope.external_trusted_pins,
  );
  console.log(JSON.stringify({
    entrypoint: adapter.FORWARD_TRANSITION_ADMISSION_ENTRYPOINT_CONTRACT,
    source_input_path: sourceInputPath,
    trusted_pins_path: trustedPinsPath,
    result,
  }, null, 2));
  if (!result.accepted) process.exitCode = 1;
}

async function main() {
  const platform = String(process.argv[2] || '').trim().toLowerCase();
  // G30 SOURCE-ONLY BRANCH START: this must remain before edition, build,
  // signing, environment, policy activation, and every write-capable path.
  if (platform === 'forward-source') {
    await runForwardSourceAdmission(process.argv.slice(3));
    return;
  }
  // G30 SOURCE-ONLY BRANCH END
  if (!['android', 'android-version', 'android-wrapper', 'ios'].includes(platform)) {
    throw new Error('Usage: node scripts/configure-native-release.mjs <android|android-version|android-wrapper|ios>');
  }
  const edition = String(process.env.MZ_APP_EDITION || '').trim().toLowerCase();
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  const forwardFlags = parseForwardBuildArguments(process.argv.slice(3));
  if (forwardFlags && (edition !== 'custodial' || !['android','android-version'].includes(platform))) throw new Error('Forward build context is restricted to Custodial Android');
  if (platform === 'ios' && edition === 'custodial') {
    throw new Error('Custodial is Android-only and cannot be configured for iOS');
  }
  if (platform === 'android-wrapper') {
    const wrapper = await configureAndroidWrapper(edition);
    console.log(`Pinned ${edition} Gradle wrapper and dependency graph (${wrapper.verificationDigest}).`);
    return;
  }
  const build = resolveBuildNumber(process.env);
  const forwardBuild = await loadReviewedForwardBuild(forwardFlags, { buildNumber: build.numeric });
  assertEditionBuildFloor(edition, build.numeric);
  const releaseVersion = resolveReleaseVersion(process.env);
  const options = { edition, definition, build, releaseVersion, environment: process.env, forwardBuild };
  if (platform === 'android') await configureAndroid({ ...options, signing: true });
  else if (platform === 'android-version') await configureAndroid({ ...options, signing: false });
  else await configureIos(options);
  console.log(`Configured ${edition} ${platform} release ${releaseVersion} (${build.numeric}).`);
}

if (resolve(process.argv[1] || '') === scriptPath) {
  await main();
}
