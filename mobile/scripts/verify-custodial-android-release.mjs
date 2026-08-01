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
import {
  ANDROID_BACKUP_VERIFIER_VERSION,
  parseCompiledAndroidManifestMetadata,
  verifyAndroidApkBackupSecurity,
} from './verify-android-apk-backup.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const schemaPath = fileURLToPath(new URL('./custodial-android-release-acceptance.schema.json', import.meta.url));
const backupVerifierPath = fileURLToPath(new URL('./verify-android-apk-backup.mjs', import.meta.url));
const releasePolicyPath = fileURLToPath(new URL('../release-policies/custodial-android.json', import.meta.url));
const toolchainPolicyPath = fileURLToPath(new URL('../release-policies/custodial-android-build-tools-35.0.1-macos.json', import.meta.url));

export const CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION = '2.0.2';
export const CUSTODIAL_ACCEPTANCE_SCHEMA_ID = 'urn:memphis-zoo:custodial-android-release-acceptance:v2';
export const CUSTODIAL_PACKAGE_NAME = 'org.memphiszoo.custodial';
export const CUSTODIAL_VERSION_NAME = '1.0.0';
export const CUSTODIAL_MIN_SDK_VERSION = 26;
export const CUSTODIAL_TARGET_SDK_VERSION = 36;
export const CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION = '35.0.1';
export const CUSTODIAL_NODE_VERSION = 'v22.23.1';
export const CUSTODIAL_CODEMAGIC_WORKFLOW = 'custodial-android';
export const CUSTODIAL_SIGNER_SHA256 = 'dd2e0b44abee02b4d9e1be74edaa05587a93f5e4c502716df99639bc96e7a0bf';
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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function loadReleasePolicies() {
  const releaseBytes = readFileSync(releasePolicyPath);
  const release = JSON.parse(releaseBytes);
  if (
    release?.schema_version !== 1
    || release.package_name !== CUSTODIAL_PACKAGE_NAME
    || !Number.isSafeInteger(release.highest_fleet_version_code)
    || release.highest_fleet_version_code < 1
    || release.minimum_next_version_code !== release.highest_fleet_version_code + 1
    || release.fleet_signer_sha256 !== CUSTODIAL_SIGNER_SHA256
    || !/^[a-f0-9]{64}$/.test(release.fleet_baseline_apk_sha256 || '')
  ) {
    throw new Error('Custodial Android protected release policy is malformed');
  }

  const toolchainBytes = readFileSync(toolchainPolicyPath);
  const toolchain = JSON.parse(toolchainBytes);
  const expectedFileNames = [
    'aapt2',
    'apksigner',
    'lib/apksigner.jar',
    'source.properties',
    'zipalign',
  ];
  if (
    toolchain?.schema_version !== 1
    || toolchain.platform !== 'macosx'
    || toolchain.android_build_tools_version !== CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION
    || toolchain.archive?.url !== 'https://dl.google.com/android/repository/build-tools_r35.0.1_macosx.zip'
    || toolchain.archive?.size_bytes !== 76_857_925
    || !/^[a-f0-9]{40}$/.test(toolchain.archive?.sha1 || '')
    || !/^[a-f0-9]{64}$/.test(toolchain.archive?.sha256 || '')
    || JSON.stringify(Object.keys(toolchain.installed_files_sha256 || {}).sort()) !== JSON.stringify(expectedFileNames.sort())
    || Object.values(toolchain.installed_files_sha256 || {}).some((digest) => !/^[a-f0-9]{64}$/.test(digest))
  ) {
    throw new Error('Custodial Android Build Tools policy is malformed');
  }
  return {
    release: deepFreeze({ ...release, sha256: sha256(releaseBytes) }),
    toolchain: deepFreeze({ ...toolchain, sha256: sha256(toolchainBytes) }),
  };
}

const loadedPolicies = loadReleasePolicies();
export const CUSTODIAL_ANDROID_RELEASE_POLICY = loadedPolicies.release;
export const CUSTODIAL_ANDROID_TOOLCHAIN_POLICY = loadedPolicies.toolchain;
export const CUSTODIAL_INSTALLED_VERSION_CODE = CUSTODIAL_ANDROID_RELEASE_POLICY.highest_fleet_version_code;

function fileSha256(path) {
  return sha256(readFileSync(path));
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

function normalizedBuildRun(value) {
  const run = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(run)) {
    throw new Error('Build run ID is missing or contains unsupported characters');
  }
  return run;
}

export function parseApksignerVerification(
  output,
  { expectedSignerSha256 = CUSTODIAL_SIGNER_SHA256 } = {},
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

  const schemeMatches = [...source.matchAll(
    /^Verified using v(\d+(?:\.\d+)?) scheme(?:\s+\([^\n]*\))?:\s*(true|false)\s*$/gim,
  )];
  if (!schemeMatches.length) throw new Error('apksigner did not report APK signature schemes');
  const verifiedSchemes = schemeMatches
    .filter((match) => match[2].toLowerCase() === 'true')
    .map((match) => Number(match[1]))
    .filter((version, index, versions) => versions.indexOf(version) === index)
    .sort((left, right) => left - right);
  if (!verifiedSchemes.includes(2)) {
    throw new Error('Custodial APK must verify with APK Signature Scheme v2 for the fleet minimum SDK');
  }

  return {
    signer_count: signerCount,
    signer_sha256: actualDigest,
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
  return {
    runtime_asset_count: paths.length,
    runtime_assets_verified: true,
    capacitor_generated_assets_sha256: Object.fromEntries(
      generated.map((path) => [path, sha256(readEntry(`assets/public/${path}`))]),
    ),
  };
}

export function assertEmbeddedCustodialProvenance({
  buildJson,
  runtimeAssetManifest,
  buildIdentity,
  expectedBuildNumber,
  expectedSourceCommit,
}) {
  const buildNumber = positiveInteger(expectedBuildNumber, 'Expected Custodial build number');
  const sourceCommit = normalizedSourceCommit(expectedSourceCommit);
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
  sourceRef,
  buildRun,
  buildWorkflow,
  buildNumber,
  signing,
  alignment,
  backup,
  tools,
  verifier,
}) {
  const commit = normalizedSourceCommit(sourceCommit);
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
    || !String(embeddedProvenance.release_id || '').trim()
    || !String(embeddedProvenance.build_id || '').trim()
  ) {
    throw new Error('Embedded Custodial build provenance does not bind to the release build');
  }
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
  normalizedSha256(artifact.apk_sha256, 'Custodial APK');
  if (
    !String(artifact.file_name || '').endsWith('.apk')
    || basename(artifact.file_name) !== artifact.file_name
    || !Number.isSafeInteger(artifact.size_bytes)
    || artifact.size_bytes < 1
  ) {
    throw new Error('Custodial APK artifact metadata is incomplete');
  }
  if (tools?.android_build_tools_version !== CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION) {
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
      throw new Error(`${descriptor} does not match the reviewed official macOS Build Tools package`);
    }
  }
  if (tools.node.version !== CUSTODIAL_NODE_VERSION) throw new Error(`Node tool provenance must be ${CUSTODIAL_NODE_VERSION}`);
  const requiredVerifierFields = [
    'release_acceptance_version',
    'release_acceptance_source_sha256',
    'backup_verifier_version',
    'backup_verifier_source_sha256',
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
    || verifier.release_policy_sha256 !== CUSTODIAL_ANDROID_RELEASE_POLICY.sha256
    || verifier.toolchain_policy_sha256 !== CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.sha256
  ) {
    throw new Error('Custodial verifier version provenance does not match the active verifier code');
  }
  for (const [name, value] of Object.entries(verifier)) {
    if (name.endsWith('_sha256')) normalizedSha256(value, name);
    else if (!String(value || '').trim()) throw new Error(`${name} verifier provenance is missing`);
  }

  return {
    schema_id: CUSTODIAL_ACCEPTANCE_SCHEMA_ID,
    schema_version: 2,
    accepted: true,
    generated_at: timestamp,
    artifact,
    application,
    embedded_provenance: embeddedProvenance,
    source: { commit, ref },
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
    tools,
    verifier,
  };
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
      throw new Error(`Android Build Tools file does not match the reviewed official macOS package: ${relativePath}`);
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

function singleApkEntry(tools, apk, entry, listing = null) {
  const entries = listing || successfulOutput(tools.unzip, ['-Z1', apk], 'APK entry listing').split(/\r?\n/);
  const matches = entries.filter((candidate) => candidate === entry);
  if (matches.length !== 1) throw new Error(`APK must contain ${entry} exactly once; found ${matches.length}`);
  const extracted = command(tools.unzip, ['-p', apk, entry], { maxBuffer: 8 * 1024 * 1024, encoding: null });
  if (extracted.status !== 0 || !extracted.stdout?.length) throw new Error(`Unable to extract ${entry} from APK`);
  return extracted.stdout;
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/).find((line) => line.trim())?.trim() || '';
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
  const apk = resolve(args['--apk']);
  const outputPath = resolve(args['--output']);
  if (!existsSync(apk) || !lstatSync(apk).isFile() || lstatSync(apk).isSymbolicLink()) {
    throw new Error(`Custodial APK must be one regular non-symlink file: ${apk}`);
  }
  if (outputPath === apk || existsSync(outputPath)) {
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
  const tools = resolveCustodialAndroidTools(args['--build-tools-directory']);
  const apkDigestBeforeInspection = fileSha256(apk);
  const apkSizeBeforeInspection = lstatSync(apk).size;

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
  const buildBytes = readEntry('assets/public/build.json');
  const runtimeManifestBytes = readEntry('assets/public/runtime-asset-manifest.json');
  const buildIdentityBytes = readEntry('assets/public/memphis-build-identity.js');
  const runtimeAssetManifest = jsonObject(runtimeManifestBytes, 'Embedded runtime-asset-manifest.json');
  const embeddedProvenance = assertEmbeddedCustodialProvenance({
    buildJson: jsonObject(buildBytes, 'Embedded build.json'),
    runtimeAssetManifest,
    buildIdentity: parseEmbeddedBuildIdentity(buildIdentityBytes),
    expectedBuildNumber: buildNumber,
    expectedSourceCommit: sourceCommit,
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

  const aapt2Version = successfulOutput(tools.aapt2, ['version'], 'aapt2 version inspection');
  const apksignerVersion = successfulOutput(tools.apksigner, ['version'], 'apksigner version inspection');
  const unzipVersion = firstLine(successfulOutput(tools.unzip, ['-v'], 'unzip version inspection'));
  const toolProvenance = {
    android_build_tools_version: tools.version,
    aapt2: toolDescriptor(tools.aapt2, firstLine(aapt2Version)),
    apksigner: toolDescriptor(tools.apksigner, firstLine(apksignerVersion)),
    apksigner_jar: toolDescriptor(tools.apksignerJar, firstLine(apksignerVersion)),
    source_properties: toolDescriptor(tools.sourceProperties, `Pkg.Revision=${tools.version}`),
    zipalign: toolDescriptor(tools.zipalign, `Android Build Tools ${tools.version}`),
    unzip: toolDescriptor(tools.unzip, unzipVersion),
    node: toolDescriptor(realpathSync(process.execPath), process.version),
  };
  const verifier = {
    release_acceptance_version: CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION,
    release_acceptance_source_sha256: fileSha256(scriptPath),
    backup_verifier_version: ANDROID_BACKUP_VERIFIER_VERSION,
    backup_verifier_source_sha256: fileSha256(backupVerifierPath),
    acceptance_schema_sha256: fileSha256(schemaPath),
    release_policy_sha256: CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
    toolchain_policy_sha256: tools.policySha256,
  };
  const acceptance = createCustodialAndroidReleaseAcceptance({
    generatedAt: new Date().toISOString(),
    artifact: {
      file_name: basename(apk),
      apk_sha256: apkDigestBeforeInspection,
      size_bytes: apkSizeBeforeInspection,
    },
    application,
    embeddedProvenance,
    sourceCommit,
    sourceRef,
    buildRun,
    buildWorkflow,
    buildNumber,
    signing,
    alignment,
    backup,
    tools: toolProvenance,
    verifier,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(acceptance, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
  renameSync(temporaryPath, outputPath);
  console.log(JSON.stringify({ ok: true, acceptance: outputPath, apk_sha256: acceptance.artifact.apk_sha256 }));
}

if (resolve(process.argv[1] || '') === scriptPath) main();
