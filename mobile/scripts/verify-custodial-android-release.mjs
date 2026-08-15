#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  delimiter,
  dirname,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  ANDROID_BACKUP_VERIFIER_VERSION,
  parseCompiledAndroidManifestMetadata,
  verifyAndroidApkBackupSecurity,
} from './verify-android-apk-backup.mjs';
import {
  CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION as PINNED_CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION,
  custodialAndroidToolchainPolicyForPlatform,
} from './custodial-android-toolchain-policy.mjs';
import {
  CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256,
  CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256,
  CUSTODIAL_CAPACITOR_PLUGIN_PAIRS,
  CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION,
  CUSTODIAL_NATIVE_VAULT_CLASS,
  CUSTODIAL_NATIVE_VAULT_PACKAGE,
  inspectCustodialCapacitorRuntime,
} from './custodial-capacitor-runtime-policy.mjs';
import {
  assertImmutableFileSnapshot,
  createImmutableFileSnapshot,
  disposeImmutableFileSnapshot,
} from './immutable-file-snapshot.mjs';
import {
  CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION,
  CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS,
  CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  inspectCustodialNativeVaultDexSemantics,
} from './verify-custodial-dex-semantics.mjs';
import {
  CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION,
  verifyCustodialAndroidManifestSecurity,
} from './custodial-android-manifest-security.mjs';
import { custodialNativeVaultSourceDigest } from './custodial-native-vault-source.mjs';
import { assertCustodialRuntimeMatchesCleanSource } from './verify-custodial-runtime-source.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const repositoryRoot = resolve(mobileRoot, '..');
const schemaPath = fileURLToPath(new URL('./custodial-android-release-acceptance.schema.json', import.meta.url));
const backupVerifierPath = fileURLToPath(new URL('./verify-android-apk-backup.mjs', import.meta.url));
const capacitorRuntimePolicyPath = fileURLToPath(new URL('./custodial-capacitor-runtime-policy.mjs', import.meta.url));
const dexSemanticVerifierPath = fileURLToPath(new URL('./verify-custodial-dex-semantics.mjs', import.meta.url));
const immutableSnapshotVerifierPath = fileURLToPath(new URL('./immutable-file-snapshot.mjs', import.meta.url));
const runtimeSourceVerifierPath = fileURLToPath(new URL('./verify-custodial-runtime-source.mjs', import.meta.url));
const androidManifestSecurityVerifierPath = fileURLToPath(new URL('./custodial-android-manifest-security.mjs', import.meta.url));
const toolchainPolicyVerifierPath = fileURLToPath(new URL('./custodial-android-toolchain-policy.mjs', import.meta.url));
const releasePolicyPath = fileURLToPath(new URL('../release-policies/custodial-android.json', import.meta.url));

export const CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION = '6.0.0';
export const CUSTODIAL_ACCEPTANCE_SCHEMA_ID = 'urn:memphis-zoo:custodial-android-release-acceptance:v6';
export const CUSTODIAL_PACKAGE_NAME = 'org.memphiszoo.custodial';
export const CUSTODIAL_VERSION_NAME = '1.0.0';
export const CUSTODIAL_MIN_SDK_VERSION = 26;
export const CUSTODIAL_TARGET_SDK_VERSION = 36;
export const CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION = PINNED_CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION;
export const CUSTODIAL_NODE_VERSION = 'v22.23.1';
export const CUSTODIAL_CODEMAGIC_WORKFLOW = 'custodial-android';
export {
  CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION,
  CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION,
  CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS,
  CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256,
  CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256,
  CUSTODIAL_CAPACITOR_PLUGIN_PAIRS,
  CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION,
  CUSTODIAL_NATIVE_VAULT_CLASS,
  CUSTODIAL_NATIVE_VAULT_PACKAGE,
};
export const CUSTODIAL_OLD_SECURE_STORAGE_PACKAGE = '@aparajita/capacitor-secure-storage';
export const CUSTODIAL_OLD_SECURE_STORAGE_CLASS = 'com.aparajita.capacitor.securestorage.SecureStorage';
export const CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS = Object.freeze([
  'assets/public/cordova.js',
  'assets/public/cordova_plugins.js',
]);
export const CUSTODIAL_SIGNER_SHA256 = 'dd2e0b44abee02b4d9e1be74edaa05587a93f5e4c502716df99639bc96e7a0bf';
export const CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256 = '5bbf30c71444534f189f75cfa3e65779285a4e8e25ff3fd7cbfa1cbc86de1d4c';
export const CUSTODIAL_RELEASE_BACKUP_DOMAINS = Object.freeze([
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
]);
const requiredCustodialRollbackCapabilities = Object.freeze([
  'getOfflineAuthorityState',
  'beginRollbackFence',
  'clearRollbackFence',
  'authorizeOfflineNewWork',
  'attestOfflineStart',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function loadAcceptanceSchema() {
  const schema = JSON.parse(readFileSync(schemaPath));
  if (
    schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema'
    || schema.$id !== CUSTODIAL_ACCEPTANCE_SCHEMA_ID
  ) {
    throw new Error('Custodial Android acceptance schema identity is malformed');
  }
  return deepFreeze(schema);
}

const custodialAcceptanceSchema = loadAcceptanceSchema();
const acceptanceSchemaCompiler = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
addFormats(acceptanceSchemaCompiler, ['date-time']);
const validateCustodialAcceptance = acceptanceSchemaCompiler.compile(custodialAcceptanceSchema);

export function assertCustodialAcceptanceSchema(value) {
  if (!validateCustodialAcceptance(value)) {
    const failures = (validateCustodialAcceptance.errors || [])
      .map((error) => `${error.instancePath || '/'} ${error.message || error.keyword}`)
      .join('; ');
    throw new Error(`Custodial acceptance does not satisfy its committed schema: ${failures}`);
  }
  return true;
}

function loadReleasePolicies() {
  const releaseBytes = readFileSync(releasePolicyPath);
  const release = JSON.parse(releaseBytes);
  if (
    release?.schema_version !== 3
    || release.package_name !== CUSTODIAL_PACKAGE_NAME
    || !Number.isSafeInteger(release.highest_fleet_version_code)
    || release.highest_fleet_version_code < 1
    || release.minimum_next_version_code !== release.highest_fleet_version_code + 1
    || release.fleet_signer_sha256 !== CUSTODIAL_SIGNER_SHA256
    || release.fleet_signer_public_key_sha256 !== CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256
    || !/^[a-f0-9]{64}$/.test(release.fleet_baseline_apk_sha256 || '')
    || release.historical_fleet_baseline_manifest !== 'custodial-build22-rollback.json'
    || release.candidate_manifest !== 'custodial-build27-candidate.json'
    || release.rollback_strategy !== 'forward_versioned_recovery_apk'
    || !Number.isSafeInteger(release.rollback_recovery_version_code)
    || release.rollback_recovery_version_code <= release.minimum_next_version_code
    || release.maximum_candidate_version_code_for_staged_recovery !== release.rollback_recovery_version_code - 1
    || release.maximum_candidate_version_code_for_staged_recovery < release.minimum_next_version_code
    || release.required_rollback_contract !== 'scan.v4.snapshot-bound-authority'
  ) {
    throw new Error('Custodial Android protected release policy is malformed');
  }

  const rollbackBaseline = loadCustodialRollbackBaseline(release);

  return {
    release: deepFreeze({
      ...release,
      sha256: sha256(releaseBytes),
      rollback_baseline_sha256: rollbackBaseline?.sha256 ?? null,
    }),
    toolchain: custodialAndroidToolchainPolicyForPlatform(),
  };
}

function loadCustodialRollbackBaseline(release) {
  if (!release.rollback_eligible) {
    if (
      release.rollback_baseline_manifest !== null
      || typeof release.rollback_blocker !== 'string'
      || !release.rollback_blocker.trim()
    ) {
      throw new Error('Ineligible Custodial rollback policy must retain an explicit blocker and no active baseline');
    }
    return null;
  }

  const expectedManifest = `custodial-build${release.highest_fleet_version_code}-rollback.json`;
  if (
    release.rollback_baseline_manifest !== expectedManifest
    || release.rollback_blocker !== null
  ) {
    throw new Error('Eligible Custodial rollback policy must bind the exact active baseline and clear its staging blocker');
  }
  const path = join(dirname(releasePolicyPath), expectedManifest);
  const bytes = readFileSync(path);
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
  if (
    baseline?.schema_version !== 6
    || baseline.status !== 'staged_canary_forward_recovery'
    || baseline.package_name !== release.package_name
    || baseline.version_name !== CUSTODIAL_VERSION_NAME
    || baseline.version_code !== release.highest_fleet_version_code
    || baseline.signer_certificate_sha256 !== release.fleet_signer_sha256
    || baseline.signer_public_key_sha256 !== release.fleet_signer_public_key_sha256
    || baseline.source?.repository !== 'lasrevinu333-design/Engine'
    || baseline.source?.ref !== 'refs/heads/main'
    || !/^[a-f0-9]{40}$/.test(baseline.source?.commit || '')
    || !/^[a-f0-9]{40}$/.test(baseline.source?.tree || '')
    || baseline.source?.commit_exact !== true
    || baseline.build?.authority !== 'codemagic'
    || baseline.build?.workflow !== CUSTODIAL_CODEMAGIC_WORKFLOW
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
    || baseline.artifact?.asset_sha256 !== release.fleet_baseline_apk_sha256
    || baseline.artifact?.asset_digest_api !== `sha256:${release.fleet_baseline_apk_sha256}`
    || recovery.strategy !== release.rollback_strategy
    || recovery.source_capability_version_code !== baseline.version_code
    || recovery.package_version_code !== release.rollback_recovery_version_code
    || recovery.signer_certificate_sha256 !== release.fleet_signer_sha256
    || recovery.signer_public_key_sha256 !== release.fleet_signer_public_key_sha256
    || recovery.candidate_minimum_version_code !== release.minimum_next_version_code
    || recovery.candidate_maximum_version_code !== release.maximum_candidate_version_code_for_staged_recovery
    || recovery.direct_version_downgrade_supported !== false
    || recovery.install_mode !== 'adb install -r --enable-rollback 2 without uninstall or data clear'
    || recovery.platform_restore_mode !== 'adb shell pm rollback-app org.memphiszoo.custodial'
    || recoverySource.repository !== 'lasrevinu333-design/Engine'
    || recoverySource.ref !== 'refs/heads/release/custodial-build25-recovery-v28-implementation-20260815'
    || !/^[a-f0-9]{40}$/.test(recoverySource.commit || '')
    || !/^[a-f0-9]{40}$/.test(recoverySource.tree || '')
    || recoverySource.runtime_source_commit !== baseline.source?.commit
    || recoverySource.runtime_source_tree !== baseline.source?.tree
    || recoverySource.commit_exact !== true
    || recoveryBuild.authority !== 'codemagic'
    || recoveryBuild.workflow !== CUSTODIAL_CODEMAGIC_WORKFLOW
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
    || recoveryCompatibility.runtime_executables_match_build25_except_build_identity !== true
    || recoveryCompatibility.native_vault_source_matches_build25 !== true
    || !/^[a-f0-9]{64}$/.test(recoveryCompatibility.native_vault_source_sha256 || '')
    || recoveryCompatibility.embedded_schema_sha256 !== baseline.compatibility_evidence?.embedded_schema_sha256
    || baseline.compatibility_evidence?.artifact_scan_contract !== release.required_rollback_contract
    || baseline.compatibility_evidence?.required_scan_contract !== release.required_rollback_contract
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
    || baseline.rollback?.eligible_candidate_minimum_version_code !== release.minimum_next_version_code
    || baseline.rollback?.eligible_candidate_maximum_version_code !== release.maximum_candidate_version_code_for_staged_recovery
    || baseline.rollback?.direct_downgrade_supported !== false
    || baseline.rollback?.preserve_enrollment_and_protected_state !== true
    || rollbackDrill.device_identifier !== physical.device_identifier
    || rollbackDrill.candidate_version_code !== release.maximum_candidate_version_code_for_staged_recovery
    || !/^[a-f0-9]{64}$/.test(rollbackDrill.candidate_apk_sha256 || '')
    || !/^[a-f0-9]{40}$/.test(rollbackDrill.candidate_source_commit || '')
    || !/^[a-f0-9]{40}$/.test(rollbackDrill.candidate_source_tree || '')
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
    || finalGate.candidate_to_baseline_rollback_drill_complete !== true
    || finalGate.physical_nfc_workflow_complete !== false
    || finalGate.required_before_production_candidate_acceptance !== true
    || finalGate.fleet_authorized !== false
  ) {
    throw new Error('Custodial active rollback baseline is malformed or overclaims physical acceptance');
  }
  return deepFreeze({ manifest: baseline, sha256: sha256(bytes) });
}

const loadedPolicies = loadReleasePolicies();
export const CUSTODIAL_ANDROID_RELEASE_POLICY = loadedPolicies.release;
export const CUSTODIAL_ANDROID_TOOLCHAIN_POLICY = loadedPolicies.toolchain;
export const CUSTODIAL_INSTALLED_VERSION_CODE = CUSTODIAL_ANDROID_RELEASE_POLICY.highest_fleet_version_code;

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function releaseAcceptanceSourceDigest() {
  const sources = [
    ['custodial-android-manifest-security.mjs', androidManifestSecurityVerifierPath],
    ['custodial-android-toolchain-policy.mjs', toolchainPolicyVerifierPath],
    ['custodial-capacitor-runtime-policy.mjs', capacitorRuntimePolicyPath],
    ['immutable-file-snapshot.mjs', immutableSnapshotVerifierPath],
    ['verify-android-apk-backup.mjs', backupVerifierPath],
    ['verify-custodial-android-release.mjs', scriptPath],
    ['verify-custodial-dex-semantics.mjs', dexSemanticVerifierPath],
    ['verify-custodial-runtime-source.mjs', runtimeSourceVerifierPath],
  ];
  const canonical = sources.map(([name, path]) => {
    const bytes = readFileSync(path);
    return `${name}\0${bytes.length}\0${sha256(bytes)}`;
  });
  return sha256(Buffer.from(`${canonical.join('\n')}\n`));
}

function normalizedSha256(value, label) {
  const digest = String(value || '').trim().toLowerCase().replaceAll(':', '');
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`${label} must be one SHA-256 digest`);
  return digest;
}

function positiveInteger(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`${label} must be a positive integer`);
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number > 2_100_000_000) {
    throw new Error(`${label} must be a safe integer no greater than 2100000000`);
  }
  return number;
}

function normalizedSourceCommit(value) {
  const commit = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error('Source commit must be one full hexadecimal commit ID');
  return commit;
}

export function normalizeCustodialSourceRef(value) {
  const sourceRef = String(value || '').trim();
  if (sourceRef === 'main' || sourceRef === 'refs/heads/main') return 'refs/heads/main';
  throw new Error('Custodial production release source ref must be protected main');
}

export function resolveCustodialRuntimeDirectory(value) {
  const requested = String(value || '').trim();
  if (!requested) throw new Error('Custodial runtime directory is required');
  const directory = resolve(requested);
  let stat;
  try {
    stat = lstatSync(directory);
  } catch {
    throw new Error(`Custodial runtime directory must exist: ${directory}`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Custodial runtime directory must be one real non-symlink directory: ${directory}`);
  }
  const realDirectory = realpathSync(directory);
  if (realDirectory !== directory) {
    throw new Error(`Custodial runtime directory path must not traverse a symlink: ${directory}`);
  }
  return realDirectory;
}

function normalizedBuildRun(value) {
  const run = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(run)) {
    throw new Error('Build run ID is missing or contains unsupported characters');
  }
  return run;
}

export function parseApksignerVerification(
  output,
  {
    expectedSignerSha256 = CUSTODIAL_SIGNER_SHA256,
    expectedSignerPublicKeySha256 = CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256,
  } = {},
) {
  const source = String(output || '').replaceAll('\r\n', '\n');
  if (/\bDOES NOT VERIFY\b/i.test(source)) throw new Error('apksigner reports that the APK does not verify');

  const countMatches = [...source.matchAll(/^Number of signers:\s*(\d+)\s*$/gim)];
  if (countMatches.length !== 1) throw new Error('apksigner must report the signer count exactly once');
  const signerCount = Number(countMatches[0][1]);
  if (signerCount !== 1) throw new Error(`Custodial APK must have exactly one signer; found ${signerCount}`);

  const signerDigests = [...source.matchAll(
    /^Signer\s+#(\d+)\s+certificate SHA-256 digest:\s*([a-f0-9:]+)\s*$/gim,
  )];
  if (signerDigests.length !== 1 || signerDigests[0][1] !== '1') {
    throw new Error(`Custodial APK must expose exactly one signer certificate digest; found ${signerDigests.length}`);
  }
  const actualDigest = normalizedSha256(signerDigests[0][2], 'Signer certificate');
  const expectedDigest = normalizedSha256(expectedSignerSha256, 'Expected signer certificate');
  if (actualDigest !== expectedDigest) throw new Error('Custodial APK signer does not match the installed fleet identity');

  const signerPublicKeyDigests = [...source.matchAll(
    /^Signer\s+#(\d+)\s+public key SHA-256 digest:\s*([a-f0-9:]+)\s*$/gim,
  )];
  if (signerPublicKeyDigests.length !== 1 || signerPublicKeyDigests[0][1] !== '1') {
    throw new Error(
      `Custodial APK must expose exactly one signer public-key digest; found ${signerPublicKeyDigests.length}`,
    );
  }
  const actualPublicKeyDigest = normalizedSha256(
    signerPublicKeyDigests[0][2],
    'Signer public key',
  );
  const expectedPublicKeyDigest = normalizedSha256(
    expectedSignerPublicKeySha256,
    'Expected signer public key',
  );
  if (actualPublicKeyDigest !== expectedPublicKeyDigest) {
    throw new Error('Custodial APK signer public key does not match the installed fleet identity');
  }

  const schemeMatches = [...source.matchAll(
    /^Verified using v(\d+(?:\.\d+)?) scheme(?:\s+\([^\n]*\))?:\s*(true|false)\s*$/gim,
  )];
  if (!schemeMatches.length) throw new Error('apksigner did not report APK signature schemes');
  const schemeResults = new Map();
  for (const match of schemeMatches) {
    const version = Number(match[1]);
    if (!Number.isFinite(version) || version < 1) {
      throw new Error(`apksigner reports an unsupported signature scheme version: ${match[1]}`);
    }
    if (schemeResults.has(version)) {
      throw new Error(`apksigner reports signature scheme v${version} more than once`);
    }
    schemeResults.set(version, match[2].toLowerCase() === 'true');
  }
  const verifiedSchemes = [...schemeResults]
    .filter(([, verified]) => verified)
    .map(([version]) => version)
    .sort((left, right) => left - right);
  if (!verifiedSchemes.includes(2)) {
    throw new Error('Custodial APK must verify with APK Signature Scheme v2 for the fleet minimum SDK');
  }

  return {
    signer_count: signerCount,
    signer_sha256: actualDigest,
    signer_public_key_sha256: actualPublicKeyDigest,
    verified_schemes: verifiedSchemes.filter((version) => version >= 2),
    v2_or_newer: true,
  };
}

function quotedBadgingAttributes(source, label) {
  const attributes = {};
  const pattern = /([A-Za-z][A-Za-z0-9]*)='([^']*)'/g;
  for (const match of String(source || '').matchAll(pattern)) {
    if (Object.hasOwn(attributes, match[1])) throw new Error(`${label} repeats ${match[1]}`);
    attributes[match[1]] = match[2];
  }
  return attributes;
}

export function parseAaptBadgingPackage(output) {
  const lines = String(output || '').replaceAll('\r\n', '\n').split('\n');
  const packages = lines.filter((line) => line.startsWith('package: '));
  if (packages.length !== 1) throw new Error(`aapt2 badging must report exactly one package; found ${packages.length}`);
  const attributes = quotedBadgingAttributes(packages[0].slice('package: '.length), 'aapt2 package');
  const versionCode = positiveInteger(attributes.versionCode, 'aapt2 package versionCode');
  const packageName = String(attributes.name || '').trim();
  const versionName = String(attributes.versionName || '').trim();
  if (!packageName || !versionName) throw new Error('aapt2 badging package identity is incomplete');
  const sdkLines = lines.filter((line) => /^(?:sdkVersion|minSdkVersion):'\d+'$/.test(line));
  const targetLines = lines.filter((line) => /^targetSdkVersion:'\d+'$/.test(line));
  if (sdkLines.length !== 1 || targetLines.length !== 1) {
    throw new Error('aapt2 badging must report exactly one minimum and target SDK');
  }
  const minSdkVersion = positiveInteger(sdkLines[0].match(/'(\d+)'$/)?.[1], 'aapt2 minimum SDK');
  const targetSdkVersion = positiveInteger(targetLines[0].slice(18, -1), 'aapt2 target SDK');
  const debuggable = lines.some((line) => line.trim() === 'application-debuggable');
  const testOnly = attributes.testOnly === 'true';
  if (attributes.testOnly && !['true', 'false'].includes(attributes.testOnly)) {
    throw new Error('aapt2 badging reports an unsupported testOnly value');
  }
  return {
    package_name: packageName,
    version_code: versionCode,
    version_name: versionName,
    min_sdk_version: minSdkVersion,
    target_sdk_version: targetSdkVersion,
    debuggable,
    test_only: testOnly,
  };
}

export function assertCustodialReleaseManifest({
  manifestDump,
  badgingDump,
  expectedBuildNumber,
}) {
  const buildNumber = positiveInteger(expectedBuildNumber, 'Expected Custodial build number');
  if (buildNumber < CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code) {
    throw new Error(`Custodial versionCode must be at least protected release floor ${CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code}`);
  }
  if (buildNumber > CUSTODIAL_ANDROID_RELEASE_POLICY.maximum_candidate_version_code_for_staged_recovery) {
    throw new Error(`Custodial versionCode must not outrun staged recovery ${CUSTODIAL_ANDROID_RELEASE_POLICY.rollback_recovery_version_code}`);
  }
  const metadata = parseCompiledAndroidManifestMetadata(manifestDump);
  const badging = parseAaptBadgingPackage(badgingDump);
  if (JSON.stringify(metadata) !== JSON.stringify(badging)) {
    throw new Error('Compiled Android manifest and aapt2 badging metadata differ');
  }
  if (metadata.package_name !== CUSTODIAL_PACKAGE_NAME) {
    throw new Error(`Custodial APK package must be ${CUSTODIAL_PACKAGE_NAME}`);
  }
  if (metadata.version_code < CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code) {
    throw new Error(`Compiled Custodial versionCode must be at least protected release floor ${CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code}`);
  }
  if (metadata.version_code > CUSTODIAL_ANDROID_RELEASE_POLICY.maximum_candidate_version_code_for_staged_recovery) {
    throw new Error(`Compiled Custodial versionCode must not outrun staged recovery ${CUSTODIAL_ANDROID_RELEASE_POLICY.rollback_recovery_version_code}`);
  }
  if (metadata.version_code !== buildNumber) {
    throw new Error(`Compiled Custodial versionCode ${metadata.version_code} does not match build ${buildNumber}`);
  }
  if (metadata.version_name !== CUSTODIAL_VERSION_NAME) {
    throw new Error(`Compiled Custodial versionName must be ${CUSTODIAL_VERSION_NAME}`);
  }
  if (metadata.min_sdk_version !== CUSTODIAL_MIN_SDK_VERSION) {
    throw new Error(`Compiled Custodial minSdkVersion must be ${CUSTODIAL_MIN_SDK_VERSION}`);
  }
  if (metadata.target_sdk_version !== CUSTODIAL_TARGET_SDK_VERSION) {
    throw new Error(`Compiled Custodial targetSdkVersion must be ${CUSTODIAL_TARGET_SDK_VERSION}`);
  }
  if (metadata.debuggable) throw new Error('Custodial production APK must not be debuggable');
  if (metadata.test_only) throw new Error('Custodial production APK must not be testOnly');
  return metadata;
}

function jsonObject(bytes, label) {
  let value;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must contain one JSON object`);
  return value;
}

function normalizedRuntimeAssetPath(value) {
  const path = String(value || '');
  if (
    !path
    || path.startsWith('/')
    || path.endsWith('/')
    || path.includes('\\')
    || path.includes('\0')
    || path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(`Embedded runtime manifest contains an unsafe asset path: ${path || '(empty)'}`);
  }
  return path;
}

export function assertEmbeddedRuntimeAssets({
  runtimeAssetManifest,
  zipEntries,
  readEntry,
}) {
  if (!runtimeAssetManifest || typeof runtimeAssetManifest !== 'object' || Array.isArray(runtimeAssetManifest)) {
    throw new Error('Embedded runtime asset manifest must be one object');
  }
  const hashes = runtimeAssetManifest.asset_hashes_sha256;
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) {
    throw new Error('Embedded runtime asset manifest hashes must be one object');
  }
  const paths = Object.keys(hashes);
  if (!Number.isSafeInteger(runtimeAssetManifest.asset_count) || runtimeAssetManifest.asset_count !== paths.length) {
    throw new Error('Embedded runtime asset count does not match its hash ledger');
  }
  if (runtimeAssetManifest.schema_version !== 1) throw new Error('Embedded runtime asset manifest schema is unsupported');
  if (JSON.stringify(paths) !== JSON.stringify([...paths].sort())) {
    throw new Error('Embedded runtime asset paths must be sorted');
  }
  const lowerPaths = new Set();
  for (const path of paths) {
    normalizedRuntimeAssetPath(path);
    const lower = path.toLowerCase();
    if (lowerPaths.has(lower)) throw new Error(`Embedded runtime asset paths collide by case: ${path}`);
    lowerPaths.add(lower);
    normalizedSha256(hashes[path], `Embedded runtime asset ${path}`);
  }

  const entries = Array.isArray(zipEntries) ? zipEntries.map(String) : [];
  if (entries.some((entry) => entry.includes('\\') && entry.toLowerCase().startsWith('assets'))) {
    throw new Error('APK contains a backslash-qualified asset entry');
  }
  const publicFiles = entries.filter((entry) => entry.startsWith('assets/public/') && !entry.endsWith('/'));
  const publicCounts = new Map();
  for (const entry of publicFiles) publicCounts.set(entry, Number(publicCounts.get(entry) || 0) + 1);
  for (const [entry, count] of publicCounts) {
    if (count !== 1) throw new Error(`APK contains ${entry} ${count} times`);
  }
  const publicCaseFolded = new Set();
  for (const entry of publicCounts.keys()) {
    const lower = entry.toLowerCase();
    if (publicCaseFolded.has(lower)) throw new Error(`APK public assets collide by case: ${entry}`);
    publicCaseFolded.add(lower);
  }

  const generated = ['cordova.js', 'cordova_plugins.js'];
  const expectedEntries = [
    ...paths.map((path) => `assets/public/${path}`),
    'assets/public/runtime-asset-manifest.json',
    ...generated.map((path) => `assets/public/${path}`),
  ].sort();
  const actualEntries = [...publicCounts.keys()].sort();
  if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
    const expected = new Set(expectedEntries);
    const actual = new Set(actualEntries);
    const missing = expectedEntries.filter((entry) => !actual.has(entry));
    const unexpected = actualEntries.filter((entry) => !expected.has(entry));
    throw new Error(`APK public runtime graph differs from its manifest (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'})`);
  }
  if (typeof readEntry !== 'function') throw new Error('APK runtime verification requires an entry reader');
  for (const path of paths) {
    const actual = sha256(readEntry(`assets/public/${path}`));
    if (actual !== String(hashes[path]).toLowerCase()) {
      throw new Error(`APK runtime asset hash differs from its manifest: ${path}`);
    }
  }
  const generatedHashes = {};
  for (const path of generated) {
    const entry = `assets/public/${path}`;
    const bytes = Buffer.from(readEntry(entry) || []);
    if (bytes.length !== 0) {
      throw new Error(`Custodial Capacitor placeholder must be exactly empty: ${entry}`);
    }
    generatedHashes[path] = sha256(bytes);
  }
  return {
    runtime_asset_count: paths.length,
    runtime_assets_verified: true,
    capacitor_generated_assets_sha256: generatedHashes,
  };
}

export function assertCustodialNativeSecurityBoundary({
  pluginManifestBytes,
  capacitorConfigBytes,
  dexEntries,
  runtimeBridgeBytes,
  runtimeExecutableEntries,
}) {
  const capacitorRuntimeProof = inspectCustodialCapacitorRuntime({
    pluginManifestBytes,
    capacitorConfigBytes,
  });

  if (!Array.isArray(dexEntries) || !dexEntries.length) throw new Error('Compiled Custodial APK contains no DEX entries');
  const dexNames = dexEntries.map((entry) => String(entry?.name || ''));
  if (JSON.stringify(dexNames) !== JSON.stringify([...dexNames].sort())) {
    throw new Error('Compiled Custodial DEX entries must be presented in sorted order');
  }
  if (new Set(dexNames).size !== dexNames.length || dexNames.some((name) => !/^classes(?:\d+)?\.dex$/.test(name))) {
    throw new Error('Compiled Custodial DEX entry set is malformed');
  }
  const expectedDescriptor = `L${CUSTODIAL_NATIVE_VAULT_CLASS.replaceAll('.', '/')};`;
  const oldDescriptor = `L${CUSTODIAL_OLD_SECURE_STORAGE_CLASS.replaceAll('.', '/')};`;
  let expectedClassCount = 0;
  const dexSha256 = {};
  for (const entry of dexEntries) {
    const bytes = Buffer.from(entry?.bytes || []);
    if (!bytes.length) throw new Error(`Compiled Custodial DEX entry is empty: ${entry.name}`);
    dexSha256[entry.name] = sha256(bytes);
    const definitions = dexClassDefinitionCounts(bytes, [expectedDescriptor, oldDescriptor]);
    expectedClassCount += definitions[expectedDescriptor];
    if (definitions[oldDescriptor] !== 0) {
      throw new Error('Compiled Custodial DEX still contains the old SecureStorage plugin class');
    }
  }
  if (expectedClassCount !== 1) {
    throw new Error(`Compiled Custodial DEX must define the native vault class exactly once; found ${expectedClassCount} definitions`);
  }

  const runtimeBridge = Buffer.from(runtimeBridgeBytes || []).toString('utf8');
  if (!runtimeBridge.includes('CustodialNativeVault') || !runtimeBridge.includes('authorizedRequest')) {
    throw new Error('Compiled Custodial WebView bridge does not call the first-party native vault transport');
  }
  if (!Array.isArray(runtimeExecutableEntries) || !runtimeExecutableEntries.length) {
    throw new Error('Compiled Custodial WebView executable-source inventory is missing');
  }
  const executableNames = runtimeExecutableEntries.map((entry) => String(entry?.name || ''));
  if (
    JSON.stringify(executableNames) !== JSON.stringify([...executableNames].sort())
    || new Set(executableNames).size !== executableNames.length
    || executableNames.some((name) => !/^assets\/public\/.+\.(?:html|js|mjs)$/.test(name))
  ) throw new Error('Compiled Custodial WebView executable-source inventory is malformed');
  for (const placeholder of CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS) {
    const matches = runtimeExecutableEntries.filter((entry) => entry?.name === placeholder);
    if (matches.length !== 1 || Buffer.from(matches[0]?.bytes || []).length !== 0) {
      throw new Error(`Compiled Custodial Capacitor placeholder must occur once and be exactly empty: ${placeholder}`);
    }
  }
  const executableSha256 = {};
  let statusOnlyShellCount = 0;
  for (const entry of runtimeExecutableEntries) {
    const bytes = Buffer.from(entry?.bytes || []);
    const emptyCapacitorPlaceholder = CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS.includes(entry.name);
    if (!bytes.length && !emptyCapacitorPlaceholder) {
      throw new Error(`Compiled Custodial WebView executable source is empty: ${entry.name}`);
    }
    executableSha256[entry.name] = sha256(bytes);
    if (emptyCapacitorPlaceholder) continue;
    const source = bytes.toString('utf8');
    for (const prohibited of [
      CUSTODIAL_OLD_SECURE_STORAGE_PACKAGE,
      'internalGetItem',
      '.set("X-Device-Credential"',
      ".set('X-Device-Credential'",
      '.append("X-Device-Credential"',
      ".append('X-Device-Credential'",
      '.set("X-Memphis-Device-Credential"',
      ".set('X-Memphis-Device-Credential'",
      '.append("X-Memphis-Device-Credential"',
      ".append('X-Memphis-Device-Credential'",
    ]) {
      if (source.includes(prohibited)) {
        throw new Error(`Compiled Custodial WebView executable source contains a prohibited credential path in ${entry.name}: ${prohibited}`);
      }
    }
    if (/^assets\/public\/shell-assets\/custodial-app-shell-[A-Za-z0-9_-]+\.js$/.test(entry.name)) {
      statusOnlyShellCount += 1;
      if (!source.includes('CustodialNativeVault') || !source.includes('getState')) {
        throw new Error('Compiled Custodial role shell does not use the native status boundary');
      }
      for (const [label, mutation] of [
        ['enroll', /\.enroll\s*\(/],
        ['resumeEnrollment', /resumeEnrollment/],
        ['completeLocalBinding', /completeLocalBinding/],
        ['completeLegacyBinding', /completeLegacyBinding/],
        ['confirmEnrollment', /confirmEnrollment/],
        ['cancelEnrollment', /cancelEnrollment/],
        ['authorizedRequest', /authorizedRequest/],
        ['removeEnrollment', /removeEnrollment/],
        ['finalizeRemoval', /finalizeRemoval/],
      ]) {
        if (mutation.test(source)) {
          throw new Error(`Compiled Custodial role shell contains a privileged native mutation path: ${label}`);
        }
      }
    }
  }
  if (statusOnlyShellCount !== 1) {
    throw new Error(`Compiled Custodial APK must contain one status-only role shell; found ${statusOnlyShellCount}`);
  }

  return {
    ...capacitorRuntimeProof,
    plugin_package: CUSTODIAL_NATIVE_VAULT_PACKAGE,
    plugin_class: CUSTODIAL_NATIVE_VAULT_CLASS,
    plugin_registered_exactly_once: true,
    native_class_present: true,
    old_secure_storage_absent: true,
    webview_plaintext_credential_transport_absent: true,
    status_only_shell_verified: true,
    webview_executable_count: runtimeExecutableEntries.length,
    webview_executable_sha256: executableSha256,
    dex_sha256: dexSha256,
  };
}

function dexRegion(bytes, offset, count, width, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(count) || count < 0 || offset < 0) {
    throw new Error(`Compiled Custodial DEX ${label} metadata is malformed`);
  }
  const size = count * width;
  if (!Number.isSafeInteger(size) || offset + size > bytes.length) {
    throw new Error(`Compiled Custodial DEX ${label} table is out of bounds`);
  }
}

function dexString(bytes, offset) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= bytes.length) {
    throw new Error('Compiled Custodial DEX string offset is out of bounds');
  }
  let cursor = offset;
  let continuation = true;
  for (let index = 0; index < 5 && continuation; index += 1) {
    if (cursor >= bytes.length) throw new Error('Compiled Custodial DEX string length is truncated');
    continuation = (bytes[cursor] & 0x80) !== 0;
    cursor += 1;
  }
  if (continuation) throw new Error('Compiled Custodial DEX string length is malformed');
  const end = bytes.indexOf(0, cursor);
  if (end < 0) throw new Error('Compiled Custodial DEX string data is unterminated');
  return bytes.subarray(cursor, end).toString('utf8');
}

export function dexClassDefinitionCounts(input, wantedDescriptors) {
  const bytes = Buffer.from(input || []);
  if (
    bytes.length < 112
    || !/^dex\n0\d\d\0$/.test(bytes.subarray(0, 8).toString('latin1'))
    || bytes.readUInt32LE(32) !== bytes.length
    || bytes.readUInt32LE(36) !== 112
    || bytes.readUInt32LE(40) !== 0x12345678
  ) {
    throw new Error('Compiled Custodial DEX header is malformed');
  }
  const stringCount = bytes.readUInt32LE(56);
  const stringOffset = bytes.readUInt32LE(60);
  const typeCount = bytes.readUInt32LE(64);
  const typeOffset = bytes.readUInt32LE(68);
  const classCount = bytes.readUInt32LE(96);
  const classOffset = bytes.readUInt32LE(100);
  dexRegion(bytes, stringOffset, stringCount, 4, 'string IDs');
  dexRegion(bytes, typeOffset, typeCount, 4, 'type IDs');
  dexRegion(bytes, classOffset, classCount, 32, 'class definitions');

  const wanted = [...new Set((wantedDescriptors || []).map(String))];
  const counts = Object.fromEntries(wanted.map((descriptor) => [descriptor, 0]));
  const wantedSet = new Set(wanted);
  for (let index = 0; index < classCount; index += 1) {
    const classIndex = bytes.readUInt32LE(classOffset + (index * 32));
    if (classIndex >= typeCount) throw new Error('Compiled Custodial DEX class type index is out of bounds');
    const descriptorIndex = bytes.readUInt32LE(typeOffset + (classIndex * 4));
    if (descriptorIndex >= stringCount) throw new Error('Compiled Custodial DEX descriptor index is out of bounds');
    const stringDataOffset = bytes.readUInt32LE(stringOffset + (descriptorIndex * 4));
    const descriptor = dexString(bytes, stringDataOffset);
    if (wantedSet.has(descriptor)) counts[descriptor] += 1;
  }
  return counts;
}

export function assertEmbeddedCustodialProvenance({
  buildJson,
  runtimeAssetManifest,
  buildIdentity,
  expectedBuildNumber,
  expectedSourceCommit,
  expectedSourceTree,
  expectedNativeVaultSourceSha256,
}) {
  const buildNumber = positiveInteger(expectedBuildNumber, 'Expected Custodial build number');
  const sourceCommit = normalizedSourceCommit(expectedSourceCommit);
  const sourceTree = normalizedSourceCommit(expectedSourceTree);
  const nativeVaultSourceSha256 = normalizedSha256(
    expectedNativeVaultSourceSha256,
    'Custodial native vault source tree',
  );
  for (const [label, value] of [
    ['Embedded build.json', buildJson],
    ['Embedded runtime-asset-manifest.json', runtimeAssetManifest],
    ['Embedded memphis-build-identity.js', buildIdentity],
  ]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must contain one object`);
    if (value.edition !== 'custodial') throw new Error(`${label} does not identify the Custodial edition`);
    if (String(value.source_commit || '').toLowerCase() !== sourceCommit) {
      throw new Error(`${label} source commit does not match the accepted source commit`);
    }
    if (value.source_commit_exact !== true || String(value.source_tree || '').toLowerCase() !== sourceTree) {
      throw new Error(`${label} does not prove an exact clean source tree`);
    }
    if (String(value.custodial_native_vault_source_sha256 || '').toLowerCase() !== nativeVaultSourceSha256) {
      throw new Error(`${label} native vault source digest does not match the accepted source tree`);
    }
  }
  if (buildJson.native_build_number !== buildNumber) {
    throw new Error('Embedded Custodial native build number does not match compiled versionCode');
  }
  if (buildIdentity.native_build_number !== buildNumber) {
    throw new Error('Embedded Custodial JavaScript build number does not match compiled versionCode');
  }
  const releaseId = String(buildJson.release_id || '').trim();
  const buildId = String(buildJson.build_id || '').trim();
  if (!releaseId || !buildId) throw new Error('Embedded Custodial build identity is incomplete');
  if (
    runtimeAssetManifest.release_id !== releaseId
    || runtimeAssetManifest.build_id !== buildId
    || buildIdentity.release_id !== releaseId
    || buildIdentity.build_id !== buildId
  ) {
    throw new Error('Embedded Custodial build, runtime-manifest, and JavaScript identities differ');
  }
  if (!buildId.endsWith(`.custodial.${sourceCommit.slice(0, 12)}`)) {
    throw new Error('Embedded Custodial build ID is not derived from the accepted source commit');
  }
  return {
    edition: 'custodial',
    source_commit: sourceCommit,
    source_tree: sourceTree,
    source_commit_exact: true,
    custodial_native_vault_source_sha256: nativeVaultSourceSha256,
    release_id: releaseId,
    build_id: buildId,
    native_build_number: buildNumber,
  };
}

export function parseEmbeddedBuildIdentity(bytes) {
  const source = Buffer.from(bytes).toString('utf8');
  const match = source.match(
    /^globalThis\.MemphisMobileBuild=("(?:[^"\\]|\\.)*");globalThis\.MemphisMobileBuildIdentity=(\{[^\n]*\});\n?$/,
  );
  if (!match) throw new Error('Embedded memphis-build-identity.js has unexpected or trailing content');
  let nativeBuild;
  let identity;
  try {
    nativeBuild = JSON.parse(match[1]);
    identity = JSON.parse(match[2]);
  } catch (error) {
    throw new Error(`Embedded memphis-build-identity.js is invalid: ${error.message}`);
  }
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    throw new Error('Embedded memphis-build-identity.js identity must be one object');
  }
  if (String(identity.native_build_number ?? '') !== String(nativeBuild)) {
    throw new Error('Embedded MemphisMobileBuild disagrees with MemphisMobileBuildIdentity');
  }
  return identity;
}

export function assertZipalignVerification({ status, output = '' }) {
  if (status !== 0) {
    const detail = String(output).trim().split(/\r?\n/, 1)[0];
    throw new Error(`Custodial APK zip alignment verification failed${detail ? `: ${detail}` : ''}`);
  }
  return {
    verified: true,
    page_alignment_bytes: 16_384,
    zip_entry_alignment_bytes: 4,
  };
}

function assertBackupProof(backup) {
  if (
    backup?.verifier_version !== ANDROID_BACKUP_VERIFIER_VERSION
    || backup.policy !== 'deny-cloud-backup-and-device-transfer'
    || backup.allow_backup !== false
  ) {
    throw new Error('Custodial acceptance requires the compiled deny-all backup policy');
  }
  if (JSON.stringify(backup.excluded_domains) !== JSON.stringify(CUSTODIAL_RELEASE_BACKUP_DOMAINS)) {
    throw new Error('Custodial acceptance backup domains differ from the immutable nine-domain policy');
  }
  const expectedResources = {
    legacy_resource: 'xml/memphis_zoo_backup_rules',
    data_extraction_resource: 'xml/memphis_zoo_data_extraction_rules',
  };
  for (const [key, expectedLogicalName] of Object.entries(expectedResources)) {
    const resource = backup[key];
    if (!resource || !/^0x[0-9a-f]+$/.test(resource.id || '')) throw new Error(`Custodial ${key} proof is missing its resource ID`);
    if (resource.logical_name !== expectedLogicalName) throw new Error(`Custodial ${key} proof has the wrong logical name`);
    if (!/^res\/(?:[^/]+\/)*[^/]+\.xml$/.test(resource.packaged_path || '')) throw new Error(`Custodial ${key} proof is missing its packaged path`);
    normalizedSha256(resource.semantic_sha256, `Custodial ${key} semantic proof`);
  }
  if (backup.legacy_resource.id === backup.data_extraction_resource.id) {
    throw new Error('Custodial compiled backup resources must have distinct resource IDs');
  }
}

function assertToolDescriptor(tool, label) {
  if (!tool || typeof tool !== 'object') throw new Error(`${label} tool provenance is missing`);
  if (!String(tool.path || '').trim() || !String(tool.version || '').trim()) throw new Error(`${label} tool provenance is incomplete`);
  normalizedSha256(tool.sha256, `${label} tool`);
}

export function createCustodialAndroidReleaseAcceptance({
  generatedAt,
  artifact,
  application,
  embeddedProvenance,
  sourceCommit,
  sourceTree,
  sourceRef,
  buildRun,
  buildWorkflow,
  buildNumber,
  signing,
  alignment,
  backup,
  androidManifestSecurity,
  nativeSecurity,
  tools,
  verifier,
}) {
  const commit = normalizedSourceCommit(sourceCommit);
  const tree = normalizedSourceCommit(sourceTree);
  const ref = normalizeCustodialSourceRef(sourceRef);
  const runId = normalizedBuildRun(buildRun);
  const workflow = String(buildWorkflow || '').trim();
  if (workflow !== CUSTODIAL_CODEMAGIC_WORKFLOW) {
    throw new Error(`Custodial release workflow must be ${CUSTODIAL_CODEMAGIC_WORKFLOW}`);
  }
  const number = positiveInteger(buildNumber, 'Custodial build number');
  if (number < CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code) {
    throw new Error(`Custodial build number must be at least protected release floor ${CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code}`);
  }
  if (number > CUSTODIAL_ANDROID_RELEASE_POLICY.maximum_candidate_version_code_for_staged_recovery) {
    throw new Error(`Custodial build number must not outrun staged recovery ${CUSTODIAL_ANDROID_RELEASE_POLICY.rollback_recovery_version_code}`);
  }
  const timestamp = String(generatedAt || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error('Acceptance generation time must be a UTC ISO date-time with milliseconds');
  }
  if (application.package_name !== CUSTODIAL_PACKAGE_NAME
      || application.version_code !== number
      || application.version_name !== CUSTODIAL_VERSION_NAME
      || application.min_sdk_version !== CUSTODIAL_MIN_SDK_VERSION
      || application.target_sdk_version !== CUSTODIAL_TARGET_SDK_VERSION
      || application.debuggable !== false
      || application.test_only !== false) {
    throw new Error('Compiled Custodial application metadata is not release-acceptable');
  }
  if (
    embeddedProvenance.native_build_number !== number
    || embeddedProvenance.edition !== 'custodial'
    || embeddedProvenance.source_commit !== commit
    || embeddedProvenance.source_tree !== tree
    || embeddedProvenance.source_commit_exact !== true
    || !String(embeddedProvenance.release_id || '').trim()
    || !String(embeddedProvenance.build_id || '').trim()
  ) {
    throw new Error('Embedded Custodial build provenance does not bind to the release build');
  }
  normalizedSha256(
    embeddedProvenance.custodial_native_vault_source_sha256,
    'Embedded native vault source tree',
  );
  for (const field of ['build_json_sha256', 'runtime_asset_manifest_sha256', 'build_identity_js_sha256']) {
    normalizedSha256(embeddedProvenance[field], `Embedded ${field}`);
  }
  if (
    embeddedProvenance.runtime_assets_verified !== true
    || !Number.isSafeInteger(embeddedProvenance.runtime_asset_count)
    || embeddedProvenance.runtime_asset_count < 1
  ) {
    throw new Error('Embedded Custodial runtime asset proof is incomplete');
  }
  const generatedAssets = embeddedProvenance.capacitor_generated_assets_sha256;
  if (
    !generatedAssets
    || JSON.stringify(Object.keys(generatedAssets).sort()) !== JSON.stringify(['cordova.js', 'cordova_plugins.js'])
  ) {
    throw new Error('Embedded Custodial Capacitor asset proof is incomplete');
  }
  for (const [name, digest] of Object.entries(generatedAssets)) normalizedSha256(digest, `Embedded ${name}`);
  if (
    signing.signer_count !== 1
    || signing.signer_sha256 !== CUSTODIAL_SIGNER_SHA256
    || signing.signer_public_key_sha256 !== CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256
    || signing.v2_or_newer !== true
    || !Array.isArray(signing.verified_schemes)
    || !signing.verified_schemes.includes(2)
  ) {
    throw new Error('Custodial signer proof is not release-acceptable');
  }
  if (alignment.verified !== true || alignment.page_alignment_bytes !== 16_384 || alignment.zip_entry_alignment_bytes !== 4) {
    throw new Error('Custodial APK alignment proof is not release-acceptable');
  }
  assertBackupProof(backup);
  if (
    nativeSecurity?.plugin_package !== CUSTODIAL_NATIVE_VAULT_PACKAGE
    || nativeSecurity.plugin_class !== CUSTODIAL_NATIVE_VAULT_CLASS
    || nativeSecurity.plugin_registered_exactly_once !== true
    || nativeSecurity.plugin_count !== CUSTODIAL_CAPACITOR_PLUGIN_PAIRS.length
    || nativeSecurity.plugin_graph_sha256 !== CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256
    || nativeSecurity.capacitor_config_policy_sha256 !== CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256
    || nativeSecurity.include_plugins_match_manifest !== true
    || nativeSecurity.dex_semantic_verifier_version !== CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION
    || nativeSecurity.native_class_present !== true
    || nativeSecurity.native_class_closure_verified !== true
    || nativeSecurity.plugin_extends_capacitor_plugin !== true
    || nativeSecurity.plugin_annotation_verified !== true
    || nativeSecurity.plugin_methods_verified !== true
    || nativeSecurity.old_secure_storage_absent !== true
    || nativeSecurity.webview_plaintext_credential_transport_absent !== true
  ) {
    throw new Error('Custodial native security boundary proof is not release-acceptable');
  }
  normalizedSha256(nativeSecurity.plugin_manifest_sha256, 'Compiled Capacitor plugin manifest');
  normalizedSha256(nativeSecurity.capacitor_config_sha256, 'Compiled Capacitor config');
  if (JSON.stringify(nativeSecurity.plugin_method_names) !== JSON.stringify(CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS)) {
    throw new Error('Custodial native vault compiled plugin method proof differs from policy');
  }
  const requiredClassLocations = nativeSecurity.required_class_locations;
  if (
    !requiredClassLocations
    || typeof requiredClassLocations !== 'object'
    || Array.isArray(requiredClassLocations)
    || JSON.stringify(Object.keys(requiredClassLocations))
      !== JSON.stringify(CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS)
    || Object.values(requiredClassLocations).some((name) => !/^classes(?:\d+)?\.dex$/.test(name))
  ) {
    throw new Error('Custodial native vault compiled class-closure proof differs from policy');
  }
  const dexDigests = nativeSecurity.dex_sha256;
  if (
    !dexDigests
    || typeof dexDigests !== 'object'
    || Array.isArray(dexDigests)
    || !Object.keys(dexDigests).length
    || Object.keys(dexDigests).some((name) => !/^classes(?:\d+)?\.dex$/.test(name))
  ) {
    throw new Error('Custodial native security DEX proof is incomplete');
  }
  for (const [name, digest] of Object.entries(dexDigests)) normalizedSha256(digest, `Compiled ${name}`);
  normalizedSha256(artifact.apk_sha256, 'Custodial APK');
  if (
    !String(artifact.file_name || '').endsWith('.apk')
    || basename(artifact.file_name) !== artifact.file_name
    || !Number.isSafeInteger(artifact.size_bytes)
    || artifact.size_bytes < 1
  ) {
    throw new Error('Custodial APK artifact metadata is incomplete');
  }
  if (
    tools?.android_build_tools_version !== CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION
    || tools.android_build_tools_platform !== CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform
  ) {
    throw new Error(`Android Build Tools must be ${CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION}`);
  }
  for (const name of [
    'aapt2',
    'apksigner',
    'apksigner_jar',
    'source_properties',
    'zipalign',
    'unzip',
    'node',
  ]) assertToolDescriptor(tools[name], name);
  const pinnedToolDescriptors = {
    aapt2: 'aapt2',
    apksigner: 'apksigner',
    apksigner_jar: 'lib/apksigner.jar',
    source_properties: 'source.properties',
    zipalign: 'zipalign',
  };
  for (const [descriptor, relativePath] of Object.entries(pinnedToolDescriptors)) {
    if (tools[descriptor].sha256 !== CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256[relativePath]) {
      throw new Error(`${descriptor} does not match the reviewed official ${CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform} Build Tools package`);
    }
  }
  if (tools.node.version !== CUSTODIAL_NODE_VERSION) throw new Error(`Node tool provenance must be ${CUSTODIAL_NODE_VERSION}`);
  const requiredVerifierFields = [
    'release_acceptance_version',
    'release_acceptance_source_sha256',
    'backup_verifier_version',
    'backup_verifier_source_sha256',
    'capacitor_runtime_policy_version',
    'capacitor_runtime_policy_source_sha256',
    'android_manifest_security_verifier_version',
    'android_manifest_security_verifier_source_sha256',
    'dex_semantic_verifier_version',
    'dex_semantic_verifier_source_sha256',
    'acceptance_schema_sha256',
    'release_policy_sha256',
    'toolchain_policy_sha256',
  ];
  if (JSON.stringify(Object.keys(verifier || {}).sort()) !== JSON.stringify([...requiredVerifierFields].sort())) {
    throw new Error('Custodial verifier provenance fields are incomplete or unexpected');
  }
  if (
    verifier.release_acceptance_version !== CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION
    || verifier.backup_verifier_version !== ANDROID_BACKUP_VERIFIER_VERSION
    || verifier.capacitor_runtime_policy_version !== CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION
    || verifier.android_manifest_security_verifier_version !== CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION
    || verifier.dex_semantic_verifier_version !== CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION
    || verifier.release_policy_sha256 !== CUSTODIAL_ANDROID_RELEASE_POLICY.sha256
    || verifier.toolchain_policy_sha256 !== CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.sha256
  ) {
    throw new Error('Custodial verifier version provenance does not match the active verifier code');
  }
  for (const [name, value] of Object.entries(verifier)) {
    if (name.endsWith('_sha256')) normalizedSha256(value, name);
    else if (!String(value || '').trim()) throw new Error(`${name} verifier provenance is missing`);
  }

  const acceptance = {
    schema_id: CUSTODIAL_ACCEPTANCE_SCHEMA_ID,
    schema_version: 6,
    accepted: true,
    generated_at: timestamp,
    artifact,
    application,
    embedded_provenance: embeddedProvenance,
    source: { commit, tree, commit_exact: true, ref },
    build: {
      run_id: runId,
      workflow,
      number,
      highest_fleet_version_code: CUSTODIAL_ANDROID_RELEASE_POLICY.highest_fleet_version_code,
      minimum_next_version_code: CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code,
    },
    signing,
    alignment,
    backup,
    android_manifest_security: androidManifestSecurity,
    native_security: nativeSecurity,
    tools,
    verifier,
  };
  assertCustodialAcceptanceSchema(acceptance);
  return acceptance;
}

function executable(path) {
  if (!path || !existsSync(path)) return false;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathExecutable(name) {
  for (const directory of String(process.env.PATH || '').split(delimiter)) {
    const candidate = join(directory, name);
    if (executable(candidate)) return realpathSync(candidate);
  }
  return null;
}

export function resolveCustodialAndroidTools(buildToolsDirectory) {
  const configuredDirectory = String(buildToolsDirectory || '').trim();
  if (!configuredDirectory) throw new Error('Pinned Android Build Tools directory is required');
  const directory = realpathSync(resolve(configuredDirectory));
  if (basename(directory) !== CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION) {
    throw new Error(
      `Custodial releases require Android Build Tools ${CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION}; received ${basename(directory)}`,
    );
  }
  const reviewedFiles = {};
  for (const [relativePath, expectedDigest] of Object.entries(
    CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256,
  )) {
    const candidate = join(directory, ...relativePath.split('/'));
    const stat = lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(candidate) !== candidate) {
      throw new Error(`Reviewed Android Build Tools file must be one regular non-symlink file: ${relativePath}`);
    }
    const actualDigest = fileSha256(candidate);
    if (actualDigest !== expectedDigest) {
      throw new Error(`Android Build Tools file does not match the reviewed official ${CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform} package: ${relativePath}`);
    }
    reviewedFiles[relativePath] = candidate;
  }
  const aapt2 = reviewedFiles.aapt2;
  const apksigner = reviewedFiles.apksigner;
  const apksignerJar = reviewedFiles['lib/apksigner.jar'];
  const sourceProperties = reviewedFiles['source.properties'];
  const zipalign = reviewedFiles.zipalign;
  for (const [name, path] of [['aapt2', aapt2], ['apksigner', apksigner], ['zipalign', zipalign]]) {
    if (!executable(path)) throw new Error(`Unable to execute ${name}: ${path}`);
    if (dirname(path) !== directory) throw new Error(`${name} must come from the same pinned Android Build Tools directory`);
  }
  const unzip = pathExecutable('unzip');
  if (!unzip) throw new Error('Unable to locate unzip for embedded APK provenance verification');
  return {
    version: CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION,
    platform: CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform,
    policySha256: CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.sha256,
    aapt2,
    apksigner,
    apksignerJar,
    sourceProperties,
    zipalign,
    unzip,
  };
}

function command(file, args, {
  maxBuffer = 32 * 1024 * 1024,
  encoding = 'utf8',
  timeout = 120_000,
} = {}) {
  const result = spawnSync(file, args, {
    encoding,
    maxBuffer,
    timeout,
    windowsHide: true,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: encoding
      ? `${result.stdout || ''}${result.stderr || ''}`
      : Buffer.concat([result.stdout || Buffer.alloc(0), result.stderr || Buffer.alloc(0)]),
  };
}

function successfulOutput(file, args, label) {
  const result = command(file, args);
  if (result.status !== 0) throw new Error(`${label} failed: ${String(result.output).trim()}`);
  return String(result.stdout || '').trim();
}

export function singleApkEntry(tools, apk, entry, listing = null, execute = command) {
  const entries = listing || successfulOutput(tools.unzip, ['-Z1', apk], 'APK entry listing').split(/\r?\n/);
  const matches = entries.filter((candidate) => candidate === entry);
  if (matches.length !== 1) throw new Error(`APK must contain ${entry} exactly once; found ${matches.length}`);
  const extracted = execute(tools.unzip, ['-p', apk, entry], { maxBuffer: 64 * 1024 * 1024, encoding: null });
  const bytes = Buffer.from(extracted.stdout || []);
  if (
    extracted.status !== 0
    || (!bytes.length && !CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS.includes(entry))
  ) throw new Error(`Unable to extract ${entry} from APK`);
  return bytes;
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/).find((line) => line.trim())?.trim() || '';
}

export function successfulToolVersion(file, args, label, execute = command) {
  const result = execute(file, args);
  const stdoutVersion = firstLine(result?.stdout);
  const stderrVersion = firstLine(result?.stderr);
  if (result?.status !== 0) {
    const detail = stderrVersion || stdoutVersion;
    throw new Error(`${label} failed${detail ? `: ${detail}` : ' without diagnostic output'}`);
  }
  const version = stdoutVersion || stderrVersion;
  if (!version) throw new Error(`${label} did not report a version on stdout or stderr`);
  return version;
}

function toolDescriptor(path, version) {
  return { path, version, sha256: fileSha256(path) };
}

function parseArguments(argumentsList) {
  const allowed = new Set([
    '--apk',
    '--build-number',
    '--source-commit',
    '--source-ref',
    '--build-run',
    '--build-workflow',
    '--build-tools-directory',
    '--runtime-directory',
    '--output',
  ]);
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!allowed.has(name) || value === undefined || String(value).startsWith('--')) {
      throw new Error(`Unknown or incomplete Custodial release verifier argument: ${name || '(missing)'}`);
    }
    if (Object.hasOwn(values, name)) throw new Error(`Custodial release verifier argument repeats: ${name}`);
    values[name] = value;
  }
  for (const name of allowed) {
    if (!String(values[name] || '').trim()) throw new Error(`Custodial release verifier requires ${name}`);
  }
  return values;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const sourceApk = resolve(args['--apk']);
  const runtimeDirectory = resolveCustodialRuntimeDirectory(args['--runtime-directory']);
  const outputPath = resolve(args['--output']);
  if (!existsSync(sourceApk) || !lstatSync(sourceApk).isFile() || lstatSync(sourceApk).isSymbolicLink()) {
    throw new Error(`Custodial APK must be one regular non-symlink file: ${sourceApk}`);
  }
  if (outputPath === sourceApk || existsSync(outputPath)) {
    throw new Error('Custodial acceptance output must be a new path distinct from the APK');
  }
  if (process.version !== CUSTODIAL_NODE_VERSION) {
    throw new Error(`Custodial release verifier requires Node ${CUSTODIAL_NODE_VERSION}; received ${process.version}`);
  }
  const sourceCommit = normalizedSourceCommit(args['--source-commit']);
  const sourceRef = normalizeCustodialSourceRef(args['--source-ref']);
  const buildRun = normalizedBuildRun(args['--build-run']);
  const buildWorkflow = String(args['--build-workflow']).trim();
  if (buildWorkflow !== CUSTODIAL_CODEMAGIC_WORKFLOW) {
    throw new Error(`Custodial release workflow must be ${CUSTODIAL_CODEMAGIC_WORKFLOW}`);
  }
  const buildNumber = positiveInteger(args['--build-number'], 'Custodial build number');
  const git = pathExecutable('git');
  if (!git) throw new Error('Unable to locate git for exact Custodial source attestation');
  const checkedOutCommit = normalizedSourceCommit(successfulOutput(
    git,
    ['-C', repositoryRoot, 'rev-parse', 'HEAD'],
    'Custodial source commit inspection',
  ));
  const sourceTree = normalizedSourceCommit(successfulOutput(
    git,
    ['-C', repositoryRoot, 'rev-parse', 'HEAD^{tree}'],
    'Custodial source tree inspection',
  ));
  const sourceStatus = command(git, [
    '-C', repositoryRoot, 'status', '--porcelain=v1', '--untracked-files=all', '--', '.',
  ]);
  if (sourceStatus.status !== 0) throw new Error('Unable to inspect the Custodial source worktree');
  if (checkedOutCommit !== sourceCommit || String(sourceStatus.stdout || '').trim()) {
    throw new Error('Custodial release acceptance requires the exact clean source commit; dirty artifacts are quarantined');
  }
  const nativeVaultSourceSha256 = custodialNativeVaultSourceDigest(join(
    mobileRoot,
    'plugins',
    'custodial-native-vault',
  ));
  const tools = resolveCustodialAndroidTools(args['--build-tools-directory']);
  const apkSnapshot = createImmutableFileSnapshot(sourceApk);
  try {
    return verifyCustodialAndroidSnapshot({
      apkSnapshot,
      buildNumber,
      buildRun,
      buildWorkflow,
      nativeVaultSourceSha256,
      outputPath,
      runtimeDirectory,
      sourceApk,
      sourceCommit,
      sourceRef,
      sourceTree,
      tools,
    });
  } finally {
    disposeImmutableFileSnapshot(apkSnapshot);
  }
}

function verifyCustodialAndroidSnapshot({
  apkSnapshot,
  buildNumber,
  buildRun,
  buildWorkflow,
  nativeVaultSourceSha256,
  outputPath,
  runtimeDirectory,
  sourceApk,
  sourceCommit,
  sourceRef,
  sourceTree,
  tools,
}) {
  const apk = apkSnapshot.path;
  assertImmutableFileSnapshot(apkSnapshot);
  const apkDigestBeforeInspection = apkSnapshot.sha256;
  const apkSizeBeforeInspection = apkSnapshot.sizeBytes;

  const manifestDump = successfulOutput(
    tools.aapt2,
    ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml'],
    'Compiled Android manifest inspection',
  );
  const badgingDump = successfulOutput(tools.aapt2, ['dump', 'badging', apk], 'Compiled Android package inspection');
  const application = assertCustodialReleaseManifest({
    manifestDump,
    badgingDump,
    expectedBuildNumber: buildNumber,
  });
  const { apk: _apk, aapt2: _aapt2, ...backup } = verifyAndroidApkBackupSecurity(apk, { aapt2Path: tools.aapt2 });
  const {
    apk: _manifestSecurityApk,
    aapt2: _manifestSecurityAapt2,
    ...androidManifestSecurity
  } = verifyCustodialAndroidManifestSecurity(apk, { aapt2Path: tools.aapt2 });

  const signerResult = command(
    tools.apksigner,
    ['verify', '--verbose', '--print-certs', '--min-sdk-version', String(CUSTODIAL_MIN_SDK_VERSION), apk],
  );
  if (signerResult.status !== 0) throw new Error(`apksigner verification failed: ${String(signerResult.output).trim()}`);
  const signing = parseApksignerVerification(signerResult.output);
  const alignmentResult = command(tools.zipalign, ['-c', '-P', '16', '-v', '4', apk]);
  const alignment = assertZipalignVerification(alignmentResult);

  const zipEntries = successfulOutput(tools.unzip, ['-Z1', apk], 'APK entry listing').split(/\r?\n/).filter(Boolean);
  const readEntry = (entry) => singleApkEntry(tools, apk, entry, zipEntries);
  const pluginManifestBytes = readEntry('assets/capacitor.plugins.json');
  const capacitorConfigBytes = readEntry('assets/capacitor.config.json');
  const dexNames = [...new Set(zipEntries.filter((entry) => /^classes(?:\d+)?\.dex$/.test(entry)))].sort();
  const dexEntries = dexNames.map((name) => ({ name, bytes: readEntry(name) }));
  const dexSemantics = inspectCustodialNativeVaultDexSemantics(dexEntries, {
    oldSecureStorageDescriptor: `L${CUSTODIAL_OLD_SECURE_STORAGE_CLASS.replaceAll('.', '/')};`,
  });
  const runtimeBridgeBytes = readEntry('assets/public/memphis-custodial-bridge.js');
  const runtimeExecutableNames = zipEntries
    .filter((entry) => /^assets\/public\/.+\.(?:html|js|mjs)$/.test(entry))
    .sort();
  const nativeBoundary = assertCustodialNativeSecurityBoundary({
      pluginManifestBytes,
      capacitorConfigBytes,
      dexEntries,
      runtimeBridgeBytes,
      runtimeExecutableEntries: runtimeExecutableNames.map((name) => ({ name, bytes: readEntry(name) })),
    });
  if (JSON.stringify(nativeBoundary.dex_sha256) !== JSON.stringify(dexSemantics.dex_sha256)) {
    throw new Error('Custodial native vault semantic and artifact DEX proofs differ');
  }
  const nativeSecurity = { ...nativeBoundary, ...dexSemantics };
  const buildBytes = readEntry('assets/public/build.json');
  const runtimeManifestBytes = readEntry('assets/public/runtime-asset-manifest.json');
  const buildIdentityBytes = readEntry('assets/public/memphis-build-identity.js');
  const runtimeAssetManifest = jsonObject(runtimeManifestBytes, 'Embedded runtime-asset-manifest.json');
  assertCustodialRuntimeMatchesCleanSource({
    sourceDirectory: runtimeDirectory,
    runtimeAssetManifest,
    runtimeAssetManifestBytes: runtimeManifestBytes,
    readEntry,
  });
  const embeddedProvenance = assertEmbeddedCustodialProvenance({
    buildJson: jsonObject(buildBytes, 'Embedded build.json'),
    runtimeAssetManifest,
    buildIdentity: parseEmbeddedBuildIdentity(buildIdentityBytes),
    expectedBuildNumber: buildNumber,
    expectedSourceCommit: sourceCommit,
    expectedSourceTree: sourceTree,
    expectedNativeVaultSourceSha256: nativeVaultSourceSha256,
  });
  embeddedProvenance.build_json_sha256 = sha256(buildBytes);
  embeddedProvenance.runtime_asset_manifest_sha256 = sha256(runtimeManifestBytes);
  embeddedProvenance.build_identity_js_sha256 = sha256(buildIdentityBytes);
  Object.assign(embeddedProvenance, assertEmbeddedRuntimeAssets({
    runtimeAssetManifest,
    zipEntries,
    readEntry,
  }));

  const apkDigestAfterInspection = fileSha256(apk);
  const apkSizeAfterInspection = lstatSync(apk).size;
  if (
    apkDigestAfterInspection !== apkDigestBeforeInspection
    || apkSizeAfterInspection !== apkSizeBeforeInspection
  ) {
    throw new Error('Custodial APK changed while release acceptance checks were running');
  }
  assertImmutableFileSnapshot(apkSnapshot);

  const aapt2Version = successfulToolVersion(tools.aapt2, ['version'], 'aapt2 version inspection');
  const apksignerVersion = successfulToolVersion(tools.apksigner, ['version'], 'apksigner version inspection');
  const unzipVersion = successfulToolVersion(tools.unzip, ['-v'], 'unzip version inspection');
  const toolProvenance = {
    android_build_tools_version: tools.version,
    android_build_tools_platform: tools.platform,
    aapt2: toolDescriptor(tools.aapt2, aapt2Version),
    apksigner: toolDescriptor(tools.apksigner, apksignerVersion),
    apksigner_jar: toolDescriptor(tools.apksignerJar, apksignerVersion),
    source_properties: toolDescriptor(tools.sourceProperties, `Pkg.Revision=${tools.version}`),
    zipalign: toolDescriptor(tools.zipalign, `Android Build Tools ${tools.version}`),
    unzip: toolDescriptor(tools.unzip, unzipVersion),
    node: toolDescriptor(realpathSync(process.execPath), process.version),
  };
  const verifier = {
    release_acceptance_version: CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION,
    release_acceptance_source_sha256: releaseAcceptanceSourceDigest(),
    backup_verifier_version: ANDROID_BACKUP_VERIFIER_VERSION,
    backup_verifier_source_sha256: fileSha256(backupVerifierPath),
    capacitor_runtime_policy_version: CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION,
    capacitor_runtime_policy_source_sha256: fileSha256(capacitorRuntimePolicyPath),
    android_manifest_security_verifier_version: CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION,
    android_manifest_security_verifier_source_sha256: fileSha256(androidManifestSecurityVerifierPath),
    dex_semantic_verifier_version: CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION,
    dex_semantic_verifier_source_sha256: fileSha256(dexSemanticVerifierPath),
    acceptance_schema_sha256: fileSha256(schemaPath),
    release_policy_sha256: CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
    toolchain_policy_sha256: tools.policySha256,
  };
  const acceptance = createCustodialAndroidReleaseAcceptance({
    generatedAt: new Date().toISOString(),
    artifact: {
      file_name: basename(sourceApk),
      apk_sha256: apkDigestBeforeInspection,
      size_bytes: apkSizeBeforeInspection,
    },
    application,
    embeddedProvenance,
    sourceCommit,
    sourceTree,
    sourceRef,
    buildRun,
    buildWorkflow,
    buildNumber,
    signing,
    alignment,
    backup,
    androidManifestSecurity,
    nativeSecurity,
    tools: toolProvenance,
    verifier,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  assertImmutableFileSnapshot(apkSnapshot);
  writeFileSync(temporaryPath, `${JSON.stringify(acceptance, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
  renameSync(temporaryPath, outputPath);
  console.log(JSON.stringify({ ok: true, acceptance: outputPath, apk_sha256: acceptance.artifact.apk_sha256 }));
}

if (resolve(process.argv[1] || '') === scriptPath) main();
