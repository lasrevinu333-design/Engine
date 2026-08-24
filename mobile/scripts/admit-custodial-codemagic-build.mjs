#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  CUSTODIAL_ANDROID_RELEASE_POLICY,
  CUSTODIAL_CODEMAGIC_WORKFLOW,
  CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS,
  CUSTODIAL_FORWARD_RECOVERY_BRANCH,
  CUSTODIAL_FORWARD_RECOVERY_REF,
  CUSTODIAL_PACKAGE_NAME,
  CUSTODIAL_VERSION_NAME,
  assertCustodialAcceptanceSchema,
} from './verify-custodial-android-release.mjs';
import {
  custodialAndroidToolchainPolicyForPlatform,
} from './custodial-android-toolchain-policy.mjs';
import { parseDeterministicJson } from './custodial-capacitor-runtime-policy.mjs';
import {
  androidBackupDomains,
  dataExtractionRules,
  legacyBackupRules,
} from './configure-android-backup.mjs';
import {
  custodialFileProviderPaths,
  custodialNetworkSecurityConfig,
} from './custodial-android-manifest-security.mjs';
import { verifyCustodialLinuxAdmissionHostTools } from './custodial-linux-admission-host-tools.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const repositoryRoot = resolve(mobileRoot, '..');
const policyPath = fileURLToPath(new URL('../release-policies/custodial-codemagic.json', import.meta.url));
const forwardRecoveryPolicyPath = fileURLToPath(new URL(
  '../release-policies/custodial-codemagic-forward-recovery.json',
  import.meta.url,
));
const releaseVerifierPath = fileURLToPath(new URL('./verify-custodial-android-release.mjs', import.meta.url));
const admissionSchemaPath = fileURLToPath(new URL('./custodial-codemagic-admission.schema.json', import.meta.url));
const hostToolPolicyPath = fileURLToPath(new URL('../release-policies/custodial-linux-admission-host-tools.json', import.meta.url));
const bootstrapPath = fileURLToPath(new URL('./run-custodial-codemagic-admission.mjs', import.meta.url));

export const CUSTODIAL_CODEMAGIC_ADMISSION_VERSION = '1.0.0';

const API_RESPONSE_LIMIT = 2 * 1024 * 1024;
const APK_SIZE_LIMIT = 250 * 1024 * 1024;
const BUNDLE_SIZE_LIMIT = 25 * 1024 * 1024;
const HTTP_TIMEOUT_MS = 30_000;
const ZIP_ENTRY_SIZE_LIMIT = 512 * 1024;
const ZIP_TOTAL_SIZE_LIMIT = 2 * 1024 * 1024;
const RUNTIME_FILE_SIZE_LIMIT = 32 * 1024 * 1024;
const RUNTIME_TOTAL_SIZE_LIMIT = 128 * 1024 * 1024;
const RUNTIME_ENTRY_LIMIT = 2_048;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const BUILD_ID = /^[a-f0-9]{24}$/;
const BOOTSTRAP_MARKER_NAME = 'MZ_CUSTODIAL_CODEMAGIC_ADMISSION_BOOTSTRAP';
const BOOTSTRAP_ROOT_PREFIX = 'memphis-zoo-custodial-admission-bootstrap-';

const requiredBundleFiles = Object.freeze([
  'build/provenance/custodial-android-backup-security.json',
  'build/provenance/custodial-android-configuration.json',
  'build/provenance/custodial-android-release-acceptance.json',
  'build/provenance/custodial-android-toolchain.json',
  'build/provenance/custodial-build.json',
  'build/provenance/custodial-firebase-android.json',
  'build/provenance/custodial-native.sha256',
  'build/provenance/custodial-source-attestation.json',
  'build/provenance/custodial-web.sha256',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const admissionSchemaBytes = readFileSync(admissionSchemaPath);
const hostToolPolicyBytes = readFileSync(hostToolPolicyPath);
const hostToolPolicy = parseDeterministicJson(hostToolPolicyBytes, 'Custodial Linux admission host policy');
const admissionSchema = parseDeterministicJson(admissionSchemaBytes, 'Custodial Codemagic admission schema');
const admissionSchemaCompiler = new Ajv2020({ allErrors: true, strict: true });
addFormats(admissionSchemaCompiler);
const validateAdmissionSchema = admissionSchemaCompiler.compile(admissionSchema);

export function assertCustodialCodemagicAdmissionSchema(value) {
  if (!validateAdmissionSchema(value)) {
    const detail = (validateAdmissionSchema.errors || [])
      .map((error) => `${error.instancePath || '/'} ${error.message || 'is invalid'}`)
      .join('; ');
    throw new Error(`Custodial Codemagic admission schema rejected evidence: ${detail}`);
  }
  if (value.provenance_bundle.name !== `Engine_${value.platform_index}_artifacts.zip`) {
    throw new Error('Custodial Codemagic admission bundle name and platform index differ');
  }
  if (
    value.app_id !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.app_id
    || value.branch !== CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch
    || value.commit !== CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.commit
    || value.version_code !== CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code
    || value.artifact_source_policy_sha256 !== CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.sha256
    || value.admission_policy_sha256 !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.sha256
    || value.admission_schema_sha256 !== sha256(admissionSchemaBytes)
    || value.verifier_version !== CUSTODIAL_CODEMAGIC_ADMISSION_VERSION
    || value.verifier_source_sha256 !== CUSTODIAL_CODEMAGIC_ADMISSION_SOURCE_SHA256
    || JSON.stringify(value.local_host) !== JSON.stringify(CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF)
  ) throw new Error('Custodial Codemagic admission provenance differs from active policy and verifier code');
  return true;
}

function admissionVerifierSourceDigest() {
  const sources = [
    ['admit-custodial-codemagic-build.mjs', scriptPath],
    ['configure-android-backup.mjs', fileURLToPath(new URL('./configure-android-backup.mjs', import.meta.url))],
    ['custodial-android-manifest-security.mjs', fileURLToPath(new URL('./custodial-android-manifest-security.mjs', import.meta.url))],
    ['custodial-android-toolchain-policy.mjs', fileURLToPath(new URL('./custodial-android-toolchain-policy.mjs', import.meta.url))],
    ['custodial-capacitor-runtime-policy.mjs', fileURLToPath(new URL('./custodial-capacitor-runtime-policy.mjs', import.meta.url))],
    ['custodial-codemagic-admission.schema.json', admissionSchemaPath],
    ['custodial-codemagic.json', policyPath],
    ['custodial-codemagic-forward-recovery.json', forwardRecoveryPolicyPath],
    ['custodial-linux-admission-host-tools.json', hostToolPolicyPath],
    ['custodial-linux-admission-host-tools.mjs', fileURLToPath(new URL('./custodial-linux-admission-host-tools.mjs', import.meta.url))],
    ['run-custodial-codemagic-admission.mjs', bootstrapPath],
    ['verify-custodial-android-release.mjs', releaseVerifierPath],
  ].sort(([left], [right]) => left.localeCompare(right));
  const digest = createHash('sha256');
  for (const [name, path] of sources) {
    const bytes = readFileSync(path);
    digest.update(`${name.length}:${name}:${bytes.length}:`);
    digest.update(bytes);
  }
  return digest.digest('hex');
}

export const CUSTODIAL_CODEMAGIC_ADMISSION_SOURCE_SHA256 = admissionVerifierSourceDigest();

export const CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF = deepFreeze({
  schema_id: 'urn:memphis-zoo:custodial-linux-admission-host-tools:v1',
  schema_version: 1,
  policy_sha256: sha256(hostToolPolicyBytes),
  platform: hostToolPolicy.platform,
  architecture: hostToolPolicy.architecture,
  pristine_entrypoint: true,
  node: {
    path: hostToolPolicy.node.path,
    version: hostToolPolicy.node.version_stdout,
    sha256: hostToolPolicy.node.sha256,
  },
  npm: {
    cli_path: hostToolPolicy.npm.cli_path,
    version: hostToolPolicy.npm.version_stdout,
    tree_sha256: hostToolPolicy.npm.tree.sha256,
  },
  java: {
    home_path: hostToolPolicy.java.home_path,
    path: hostToolPolicy.java.path,
    version: hostToolPolicy.java.version_stderr.split('\n')[0],
    executable_sha256: hostToolPolicy.java.sha256,
    runtime_tree_sha256: hostToolPolicy.java.runtime_tree.sha256,
  },
  git: {
    path: hostToolPolicy.git.path,
    version: hostToolPolicy.git.version_stdout,
    sha256: hostToolPolicy.git.sha256,
  },
  unzip: {
    path: hostToolPolicy.unzip.path,
    version: hostToolPolicy.unzip.version_stdout,
    sha256: hostToolPolicy.unzip.sha256,
  },
  android_sdk: {
    root_path: hostToolPolicy.android_sdk.path,
    build_tools_directory: hostToolPolicy.android_sdk.build_tools_directory,
  },
});

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be one object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} fields differ from the reviewed API contract`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function positiveInteger(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`${label} must be a positive integer`);
  const number = Number(text);
  if (!Number.isSafeInteger(number)) throw new Error(`${label} must be a safe integer`);
  return number;
}

function normalizedBuildId(value) {
  const buildId = String(value || '').trim().toLowerCase();
  if (!BUILD_ID.test(buildId)) throw new Error('Codemagic build ID must be one full 24-character ID');
  return buildId;
}

function normalizedCommit(value) {
  const commit = String(value || '').trim().toLowerCase();
  if (!COMMIT.test(commit)) throw new Error('Expected source commit must be one full Git commit');
  return commit;
}

function assertRawUrlPathIsCanonical(raw, label) {
  const pathSource = raw.split(/[?#]/, 1)[0];
  if (
    /[\u0000-\u0020\u007f]/.test(raw)
    || pathSource.includes('\\')
    || pathSource.startsWith('//')
    || /%(?:2e|2f|5c)/i.test(pathSource)
    || pathSource.split('/').some((segment) => segment === '.' || segment === '..')
  ) throw new Error(`${label} violates the reviewed HTTPS origin policy`);
}

function isReviewedCodemagicArtifactPath(pathname) {
  return /^\/\/artifacts\/\.[A-Za-z0-9_-]{256,512}\.[A-Za-z0-9_-]{27}$/.test(pathname);
}

function isReviewedStorageArtifactPath(pathname, expectedArtifactName) {
  const match = pathname.match(
    /^\/codemagic-build-artifacts\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([A-Za-z0-9._-]+)$/,
  );
  return Boolean(match && match[3] === expectedArtifactName);
}

function hasReviewedStorageQuery(url, raw) {
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0 || raw.indexOf('?', queryIndex + 1) >= 0 || raw.includes('#')) return false;
  const rawQuery = raw.slice(queryIndex + 1);
  const match = rawQuery.match(
    /^Expires=([1-9]\d*)&GoogleAccessId=((?:[A-Za-z0-9._~!$'()*+,;=:@\/-]|%[0-9A-F]{2})+)&Signature=((?:[A-Za-z0-9._~!$'()*+,;=:@\/-]|%[0-9A-F]{2})+)$/,
  );
  if (!match || url.search !== `?${rawQuery}`) return false;
  const expires = Number(match[1]);
  if (!Number.isSafeInteger(expires) || expires < 1) return false;
  let googleAccessId;
  let signature;
  try {
    googleAccessId = decodeURIComponent(match[2]);
    signature = decodeURIComponent(match[3]);
  } catch {
    return false;
  }
  if (
    encodeURIComponent(googleAccessId) !== match[2]
    || encodeURIComponent(signature) !== match[3]
    || googleAccessId.length > 320
    || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(googleAccessId)
    || signature.length > 2048
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(signature)
    || Buffer.from(signature, 'base64').toString('base64') !== signature
  ) return false;
  const entries = [...url.searchParams.entries()];
  return JSON.stringify(entries) === JSON.stringify([
    ['Expires', match[1]],
    ['GoogleAccessId', googleAccessId],
    ['Signature', signature],
  ]);
}

function reviewedArtifactName(artifactType, value) {
  if (typeof value !== 'string') throw new Error('Codemagic expected artifact name is malformed');
  if (artifactType === 'apk') {
    if (value !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.apk_artifact_name) {
      throw new Error('Codemagic expected APK name differs from policy');
    }
    return value;
  }
  const match = value.match(/^Engine_([1-9]\d*)_artifacts\.zip$/);
  if (!match || !Number.isSafeInteger(Number(match[1]))) {
    throw new Error('Codemagic expected provenance bundle name is malformed');
  }
  return value;
}

function assertDiscardedCommitMetadata(commit) {
  for (const field of ['author_email', 'author_name', 'message']) {
    if (typeof commit[field] !== 'string') {
      throw new Error(`Codemagic commit ${field} type differs from the reviewed API contract`);
    }
  }
  const raw = commit.avatar_url;
  if (typeof raw !== 'string') {
    throw new Error('Codemagic commit avatar_url type differs from the reviewed API contract');
  }
  assertRawUrlPathIsCanonical(raw, 'Codemagic commit avatar URL');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Codemagic commit avatar URL is malformed');
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || raw.includes('#')
    || (raw.includes('?') && !url.search)
    || url.port
    || url.href !== raw
    || !url.pathname.startsWith('/')
    || url.pathname.startsWith('//')
    || url.pathname.includes('//')
  ) throw new Error('Codemagic commit avatar URL violates the reviewed HTTPS policy');
}

function safeArtifactUrl(value, expectedOrigin) {
  const raw = value instanceof URL ? value.href : value;
  if (typeof raw !== 'string' || !raw || raw.includes('?') || raw.includes('#')) {
    throw new Error('Codemagic artifact URL violates the reviewed HTTPS origin policy');
  }
  assertRawUrlPathIsCanonical(raw, 'Codemagic artifact URL');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Codemagic artifact URL is malformed');
  }
  if (
    url.protocol !== 'https:'
    || url.origin !== expectedOrigin
    || url.username
    || url.password
    || url.hash
    || url.port
    || url.search
    || url.href !== raw
    || !isReviewedCodemagicArtifactPath(url.pathname)
    || /%(?:2e|2f|5c)/i.test(url.pathname)
  ) throw new Error('Codemagic artifact URL violates the reviewed HTTPS origin policy');
  return url;
}

function loadPolicy() {
  const bytes = readFileSync(policyPath);
  const policy = parseDeterministicJson(bytes, 'Custodial Codemagic admission policy');
  exactKeys(policy, [
    'schema_version',
    'provider',
    'api_origin',
    'artifact_origin',
    'artifact_redirect_origins',
    'app_id',
    'repository',
    'runtime_api_base',
    'workflow',
    'instance_type',
    'runner_xcode_image',
    'branch',
    'package_name',
    'apk_artifact_name',
    'bundle_artifact_name_template',
    'version_name',
  ], 'Custodial Codemagic admission policy');
  exactKeys(policy.workflow, ['id', 'name', 'source'], 'Custodial Codemagic workflow policy');
  if (
    policy.schema_version !== 1
    || policy.provider !== 'codemagic'
    || policy.api_origin !== 'https://codemagic.io'
    || policy.artifact_origin !== 'https://api.codemagic.io'
    || JSON.stringify(policy.artifact_redirect_origins) !== JSON.stringify([
      'https://api.codemagic.io',
      'https://storage.googleapis.com',
    ])
    || policy.app_id !== '6a6d4421515324b1cc5709c9'
    || policy.repository !== 'lasrevinu333-design/Engine'
    || policy.runtime_api_base !== 'https://memphis-zoo-mcp.onrender.com'
    || policy.workflow.id !== CUSTODIAL_CODEMAGIC_WORKFLOW
    || policy.workflow.name !== 'Memphis Zoo Custodial - Private Android APK'
    || policy.workflow.source !== 'file'
    || policy.instance_type !== 'mac_mini_m2'
    || policy.runner_xcode_image !== '26.2'
    || policy.branch !== 'main'
    || policy.package_name !== CUSTODIAL_PACKAGE_NAME
    || policy.apk_artifact_name !== 'app-release.apk'
    || policy.bundle_artifact_name_template !== 'Engine_{platform_index}_artifacts.zip'
    || policy.version_name !== CUSTODIAL_VERSION_NAME
  ) throw new Error('Custodial Codemagic admission policy identity is malformed');
  return deepFreeze({ ...policy, sha256: sha256(bytes) });
}

export const CUSTODIAL_CODEMAGIC_ADMISSION_POLICY = loadPolicy();

function loadForwardRecoveryPolicy() {
  const bytes = readFileSync(forwardRecoveryPolicyPath);
  const policy = parseDeterministicJson(bytes, 'Custodial Codemagic forward-recovery policy');
  const recoveryBranchMatch = /^release\/custodial-build[1-9][0-9]*-recovery-v([1-9][0-9]*)-implementation-[0-9]{8}$/.exec(
    policy.branch || '',
  );
  exactKeys(policy, [
    'schema_version',
    'status',
    'repository',
    'control_branch',
    'branch',
    'ref',
    'commit',
    'tree',
    'version_code',
  ], 'Custodial Codemagic forward-recovery policy');
  if (
    policy.schema_version !== 1
    || policy.status !== 'source_pinned_for_prebuild_audit'
    || policy.repository !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.repository
    || policy.control_branch !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.branch
    || !recoveryBranchMatch
    || policy.ref !== `refs/heads/${policy.branch}`
    || !COMMIT.test(policy.commit)
    || !COMMIT.test(policy.tree)
    || !Number.isSafeInteger(policy.version_code)
    || policy.version_code < 1
    || Number(recoveryBranchMatch[1]) !== policy.version_code
    || admissionSchema?.properties?.branch?.const !== policy.branch
    || admissionSchema?.properties?.commit?.const !== policy.commit
    || admissionSchema?.properties?.version_code?.const !== policy.version_code
  ) throw new Error('Custodial Codemagic forward-recovery policy identity is malformed');
  return deepFreeze({ ...policy, sha256: sha256(bytes) });
}

export const CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY = loadForwardRecoveryPolicy();

// Producing the next higher recovery package and admitting the last produced
// package are two distinct phases. Keep both refs exact while the control
// branch advances its post-build policy to the newly known commit and tree.
export function normalizeCustodialAdmissionSourceRef(value) {
  const sourceRef = String(value || '').trim();
  if (sourceRef === 'main' || sourceRef === 'refs/heads/main') return 'refs/heads/main';
  if (
    sourceRef === CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch
    || sourceRef === CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.ref
  ) return CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.ref;
  if (sourceRef === CUSTODIAL_FORWARD_RECOVERY_BRANCH || sourceRef === CUSTODIAL_FORWARD_RECOVERY_REF) {
    return CUSTODIAL_FORWARD_RECOVERY_REF;
  }
  throw new Error('Custodial artifact inspection requires protected main or an exact approved recovery source branch');
}

function inspectedArtifact(value, expected) {
  exactKeys(
    value,
    ['name', 'short_lived_download_url', 'size_in_bytes', 'type', 'version_code', 'version_name'],
    `Codemagic ${expected.type} artifact`,
  );
  const size = value.size_in_bytes;
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new Error(`Codemagic ${expected.type} artifact size must be a positive safe integer`);
  }
  if (size > expected.sizeLimit) throw new Error(`Codemagic ${expected.type} artifact exceeds its size policy`);
  if (
    value.name !== expected.name
    || value.type !== expected.type
    || value.version_code !== expected.versionCode
    || value.version_name !== expected.versionName
  ) throw new Error(`Codemagic ${expected.type} artifact identity differs from policy`);
  const url = safeArtifactUrl(value.short_lived_download_url, CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.artifact_origin);
  return {
    sanitized: Object.freeze({
      name: value.name,
      type: value.type,
      size_bytes: size,
      version_code: value.version_code,
      version_name: value.version_name,
    }),
    url,
  };
}

export function inspectCodemagicV3BuildResponse(input, {
  expectedBuildId,
  expectedCommit,
  expectedBranch = CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.branch,
  expectedVersionCode = null,
  minimumVersionCode,
} = {}) {
  const buildId = normalizedBuildId(expectedBuildId);
  const commit = normalizedCommit(expectedCommit);
  const sourceRef = normalizeCustodialAdmissionSourceRef(expectedBranch);
  const branch = sourceRef.slice('refs/heads/'.length);
  const minimum = positiveInteger(minimumVersionCode, 'Minimum Custodial versionCode');
  const parsed = parseDeterministicJson(input, 'Codemagic v3 build response');
  exactKeys(parsed, ['data'], 'Codemagic v3 response');
  const data = parsed.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Codemagic v3 response data is missing');
  }
  exactKeys(data, [
    'app_id',
    'app_store_connect_status',
    'artifacts',
    'branch',
    'build_inputs',
    'commit',
    'config',
    'created_at',
    'finished_at',
    'id',
    'index',
    'instance_type',
    'labels',
    'pull_request',
    'release_notes',
    'remote_access_enabled',
    'started_at',
    'status',
    'tag',
    'workflow',
  ], 'Codemagic build');
  exactKeys(data.workflow, ['id', 'name', 'source'], 'Codemagic workflow');
  exactKeys(
    data.commit,
    ['author_email', 'author_name', 'avatar_url', 'hash', 'message', 'url'],
    'Codemagic commit',
  );
  assertDiscardedCommitMetadata(data.commit);
  const expectedCommitUrl = `https://github.com/${CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.repository}/commit/${commit}`;
  if (
    data.id !== buildId
    || data.app_id !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.app_id
    || data.status !== 'finished'
    || data.branch !== branch
    || data.tag !== null
    || data.pull_request !== null
    || data.workflow.id !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.workflow.id
    || data.workflow.name !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.workflow.name
    || data.workflow.source !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.workflow.source
    || data.instance_type !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.instance_type
    || data.remote_access_enabled !== false
    || data.app_store_connect_status !== null
    || data.commit.hash !== commit
    || data.commit.url !== expectedCommitUrl
  ) throw new Error('Codemagic build identity is not release-admissible');
  const index = positiveInteger(data.index, 'Codemagic platform build index');
  const timestamps = ['created_at', 'started_at', 'finished_at'].map((field) => {
    const value = String(data[field] || '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
      throw new Error(`Codemagic ${field} is missing or malformed`);
    }
    return { field, value, milliseconds: Date.parse(value) };
  });
  if (timestamps[0].milliseconds > timestamps[1].milliseconds || timestamps[1].milliseconds > timestamps[2].milliseconds) {
    throw new Error('Codemagic build timestamps are out of order');
  }
  const finishedAt = timestamps[2].value;
  if (!Array.isArray(data.artifacts) || data.artifacts.length !== 2) {
    throw new Error('Codemagic Custodial build must expose exactly one APK and one provenance bundle');
  }
  const apkValues = data.artifacts.filter((artifact) => artifact?.type === 'apk');
  const bundleValues = data.artifacts.filter((artifact) => artifact?.type === 'bundle');
  if (apkValues.length !== 1 || bundleValues.length !== 1) {
    throw new Error('Codemagic Custodial artifact types differ from policy');
  }
  const versionCode = positiveInteger(
    apkValues[0].version_code,
    'Codemagic Custodial APK versionCode',
  );
  if (versionCode < minimum) {
    throw new Error('Codemagic Custodial APK versionCode is below the protected release floor');
  }
  if (expectedVersionCode != null && versionCode !== positiveInteger(
    expectedVersionCode,
    'Expected Custodial versionCode',
  )) throw new Error('Codemagic Custodial APK versionCode differs from exact source policy');
  const apk = inspectedArtifact(apkValues[0], {
    name: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.apk_artifact_name,
    type: 'apk',
    versionCode: String(versionCode),
    versionName: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.version_name,
    sizeLimit: APK_SIZE_LIMIT,
  });
  const bundleName = CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.bundle_artifact_name_template
    .replace('{platform_index}', String(index));
  const bundle = inspectedArtifact(bundleValues[0], {
    name: bundleName,
    type: 'bundle',
    versionCode: null,
    versionName: null,
    sizeLimit: BUNDLE_SIZE_LIMIT,
  });
  const metadata = Object.freeze({
    provider: 'codemagic',
    app_id: data.app_id,
    build_id: data.id,
    status: data.status,
    platform_index: index,
    version_code: versionCode,
    branch: data.branch,
    tag: null,
    pull_request: null,
    workflow: Object.freeze({ ...CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.workflow }),
    commit,
    finished_at: finishedAt,
    artifacts: Object.freeze([apk.sanitized, bundle.sanitized]),
  });
  return Object.freeze({
    metadata,
    metadata_sha256: sha256(Buffer.from(JSON.stringify(metadata))),
    artifactUrls: new Map([
      [apk.sanitized.name, apk.url],
      [bundle.sanitized.name, bundle.url],
    ]),
  });
}

async function boundedResponseBytes(response, maximum, label) {
  const declared = response.headers?.get?.('content-length');
  if (declared != null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) {
    try { await response.body?.cancel?.(); } catch {}
    throw new Error(`${label} exceeds its response-size policy`);
  }
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximum) throw new Error(`${label} exceeds its response-size policy`);
    return bytes;
  }
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error(`${label} exceeds its response-size policy`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

export async function fetchCodemagicV3BuildResponse(buildId, token, fetchImpl = fetch) {
  const normalizedId = normalizedBuildId(buildId);
  const secret = String(token || '');
  if (secret.length < 16 || secret.length > 2048 || /\s/.test(secret)) {
    throw new Error('CODEMAGIC_API_TOKEN is missing or malformed');
  }
  const endpoint = `${CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.api_origin}/api/v3/builds/${normalizedId}`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { accept: 'application/json', 'x-auth-token': secret },
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Codemagic API request failed (${error?.name || 'network error'})`);
  }
  if (response.status !== 200) {
    try { await response.body?.cancel?.(); } catch {}
    throw new Error(`Codemagic API request failed with HTTP ${response.status}`);
  }
  const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    try { await response.body?.cancel?.(); } catch {}
    throw new Error('Codemagic API returned a non-JSON response');
  }
  return boundedResponseBytes(response, API_RESPONSE_LIMIT, 'Codemagic API response');
}

function safeRedirectUrl(value, expectedArtifactName) {
  const raw = value;
  if (typeof raw !== 'string' || !raw || raw.includes('#')) {
    throw new Error('Codemagic artifact redirect violates HTTPS policy');
  }
  try {
    assertRawUrlPathIsCanonical(raw, 'Codemagic artifact redirect');
  } catch {
    throw new Error('Codemagic artifact redirect violates HTTPS policy');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Codemagic artifact redirect is malformed');
  }
  const reviewedApiRedirect = url.origin === CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.artifact_origin
    && !raw.includes('?')
    && isReviewedCodemagicArtifactPath(url.pathname);
  const reviewedStorageRedirect = url.origin === 'https://storage.googleapis.com'
    && isReviewedStorageArtifactPath(url.pathname, expectedArtifactName)
    && hasReviewedStorageQuery(url, raw);
  if (
    url.protocol !== 'https:'
    || !CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.artifact_redirect_origins.includes(url.origin)
    || url.username
    || url.password
    || url.hash
    || url.port
    || url.href !== raw
    || /%(?:2e|2f|5c)/i.test(url.pathname)
    || (!reviewedApiRedirect && !reviewedStorageRedirect)
  ) {
    throw new Error('Codemagic artifact redirect violates HTTPS policy');
  }
  return url;
}

export async function downloadCodemagicArtifact(
  url,
  expectedSize,
  artifactType,
  expectedArtifactName,
  fetchImpl = fetch,
) {
  if (!['apk', 'bundle'].includes(artifactType)) throw new Error('Codemagic artifact type is unsupported');
  const artifactName = reviewedArtifactName(artifactType, expectedArtifactName);
  let current = safeArtifactUrl(url, CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.artifact_origin);
  const size = positiveInteger(expectedSize, 'Codemagic artifact expected size');
  const maximum = artifactType === 'apk' ? APK_SIZE_LIMIT : BUNDLE_SIZE_LIMIT;
  if (size > maximum) throw new Error('Codemagic artifact expected size exceeds policy');
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    let response;
    try {
      response = await fetchImpl(current, {
        method: 'GET',
        headers: { accept: 'application/octet-stream' },
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Codemagic artifact download failed (${error?.name || 'network error'})`);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers?.get?.('location');
      try { await response.body?.cancel?.(); } catch {}
      if (redirects === 4) throw new Error('Codemagic artifact download exceeded redirect policy');
      current = safeRedirectUrl(location, artifactName);
      continue;
    }
    if (response.status !== 200) {
      try { await response.body?.cancel?.(); } catch {}
      throw new Error(`Codemagic artifact download failed with HTTP ${response.status}`);
    }
    const bytes = await boundedResponseBytes(response, maximum, 'Codemagic artifact');
    if (bytes.length !== size) throw new Error('Codemagic artifact byte count differs from API metadata');
    return bytes;
  }
  throw new Error('Codemagic artifact download did not terminate');
}

function run(file, args, {
  baseEnvironment = process.env,
  cwd = repositoryRoot,
  encoding = 'utf8',
  environment: environmentOverrides = {},
  maxBuffer = 16 * 1024 * 1024,
  timeout = 180_000,
} = {}) {
  const environment = {};
  for (const name of [
    'ANDROID_HOME',
    'ANDROID_SDK_ROOT',
    'CI',
    'COREPACK_ENABLE_PROJECT_SPEC',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_NOSYSTEM',
    'GIT_TERMINAL_PROMPT',
    'HOME',
    'JAVA_HOME',
    'LANG',
    'LC_ALL',
    'NO_COLOR',
    'NPM_CONFIG_AUDIT',
    'NPM_CONFIG_COLOR',
    'NPM_CONFIG_ENGINE_STRICT',
    'NPM_CONFIG_FUND',
    'NPM_CONFIG_GLOBALCONFIG',
    'NPM_CONFIG_PROGRESS',
    'NPM_CONFIG_UPDATE_NOTIFIER',
    'NPM_CONFIG_USERCONFIG',
    'PATH',
    'TMPDIR',
    'TZ',
    'XDG_CACHE_HOME',
    'XDG_CONFIG_HOME',
  ]) {
    if (baseEnvironment[name]) environment[name] = baseEnvironment[name];
  }
  const allowedOverrides = new Set([
    'CI',
    'CM_BRANCH',
    'CM_COMMIT',
    'MZ_API_BASE',
    'MZ_APP_EDITION',
    'MZ_MOBILE_DIST',
    'MZ_RELEASE_VERSION',
    'MZ_SHELL_START',
    'PROJECT_BUILD_NUMBER',
  ]);
  for (const [name, value] of Object.entries(environmentOverrides)) {
    if (!allowedOverrides.has(name) || typeof value !== 'string' || !value) {
      throw new Error('Release evidence command environment override is malformed');
    }
    environment[name] = value;
  }
  const result = spawnSync(file, args, {
    cwd,
    encoding,
    maxBuffer,
    timeout,
    windowsHide: true,
    env: environment,
    shell: false,
  });
  if (result.error || result.status !== 0) throw new Error(`Release evidence command failed: ${basename(file)}`);
  return result.stdout;
}

function zipEntryBytes(unzip, bundlePath, entry, commandEnvironment) {
  return Buffer.from(run(unzip, ['-p', bundlePath, entry], {
    baseEnvironment: commandEnvironment,
    cwd: '/',
    encoding: null,
    maxBuffer: ZIP_ENTRY_SIZE_LIMIT,
  }));
}

export function inspectCodemagicProvenanceZip(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 22 || bytes.length > BUNDLE_SIZE_LIMIT) {
    throw new Error('Codemagic provenance ZIP size is outside policy');
  }
  let endOffset = -1;
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== 0x06054b50) continue;
    if (offset + 22 + bytes.readUInt16LE(offset + 20) !== bytes.length) continue;
    endOffset = offset;
    break;
  }
  if (endOffset < 0) throw new Error('Codemagic provenance ZIP end record is missing');
  const disk = bytes.readUInt16LE(endOffset + 4);
  const directoryDisk = bytes.readUInt16LE(endOffset + 6);
  const diskEntries = bytes.readUInt16LE(endOffset + 8);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const directorySize = bytes.readUInt32LE(endOffset + 12);
  const directoryOffset = bytes.readUInt32LE(endOffset + 16);
  const commentLength = bytes.readUInt16LE(endOffset + 20);
  if (
    disk !== 0
    || directoryDisk !== 0
    || diskEntries !== entryCount
    || entryCount !== requiredBundleFiles.length + 2
    || commentLength !== 0
    || directoryOffset + directorySize !== endOffset
    || directoryOffset >= endOffset
  ) throw new Error('Codemagic provenance ZIP directory geometry differs from policy');

  const expectedEntries = ['build/', 'build/provenance/', ...requiredBundleFiles].sort();
  const entries = [];
  const compressedRanges = [];
  const localOffsets = new Set();
  let totalUncompressed = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > endOffset || bytes.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Codemagic provenance ZIP central entry is malformed');
    }
    const versionMadeBy = bytes.readUInt16LE(cursor + 4);
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const entryCommentLength = bytes.readUInt16LE(cursor + 32);
    const startDisk = bytes.readUInt16LE(cursor + 34);
    const externalAttributes = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const entryEnd = cursor + 46 + nameLength + extraLength + entryCommentLength;
    if (
      entryEnd > endOffset
      || nameLength < 1
      || entryCommentLength !== 0
      || startDisk !== 0
      || flags !== 0
      || ![0, 8].includes(method)
      || [compressedSize, uncompressedSize, localOffset].includes(0xffffffff)
      || (versionMadeBy >>> 8) !== 3
    ) throw new Error('Codemagic provenance ZIP entry policy is malformed');
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString('utf8');
    if (!Buffer.from(name, 'utf8').equals(nameBytes) || !/^[\x20-\x7e]+$/.test(name)) {
      throw new Error('Codemagic provenance ZIP entry name is not canonical ASCII');
    }
    if (extraLength !== 0) {
      const extra = bytes.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength);
      if (
        extra.length !== 36
        || extra.readUInt16LE(0) !== 0x000a
        || extra.readUInt16LE(2) !== 32
        || extra.readUInt32LE(4) !== 0
        || extra.readUInt16LE(8) !== 0x0001
        || extra.readUInt16LE(10) !== 24
        || [12, 20, 28].some((offset) => extra.readBigUInt64LE(offset) === 0n)
      ) throw new Error('Codemagic provenance ZIP central extra field differs from policy');
    }
    const isDirectory = name.endsWith('/');
    const fileType = (externalAttributes >>> 16) & 0o170000;
    if (
      (isDirectory && (fileType !== 0o040000 || uncompressedSize !== 0 || compressedSize !== 0 || method !== 0))
      || (!isDirectory && (fileType !== 0o100000 || uncompressedSize < 1))
      || uncompressedSize > ZIP_ENTRY_SIZE_LIMIT
    ) throw new Error('Codemagic provenance ZIP entry type or size differs from policy');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > ZIP_TOTAL_SIZE_LIMIT) {
      throw new Error('Codemagic provenance ZIP aggregate uncompressed size exceeds policy');
    }
    if (localOffsets.has(localOffset) || localOffset + 30 > directoryOffset) {
      throw new Error('Codemagic provenance ZIP local entry offset is malformed');
    }
    localOffsets.add(localOffset);
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error('Codemagic provenance ZIP local header is missing');
    }
    const localFlags = bytes.readUInt16LE(localOffset + 6);
    const localMethod = bytes.readUInt16LE(localOffset + 8);
    const localCrc = bytes.readUInt32LE(localOffset + 14);
    const localCompressedSize = bytes.readUInt32LE(localOffset + 18);
    const localUncompressedSize = bytes.readUInt32LE(localOffset + 22);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + compressedSize;
    if (
      localFlags !== flags
      || localMethod !== method
      || localCrc !== crc
      || localCompressedSize !== compressedSize
      || localUncompressedSize !== uncompressedSize
      || localNameLength !== nameLength
      || localExtraLength !== 0
      || dataOffset > directoryOffset
      || dataEnd > directoryOffset
      || !bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).equals(nameBytes)
    ) throw new Error('Codemagic provenance ZIP local and central records differ');
    compressedRanges.push([localOffset, dataEnd]);
    entries.push(Object.freeze({ name, compressed_size: compressedSize, uncompressed_size: uncompressedSize }));
    cursor = entryEnd;
  }
  if (cursor !== endOffset || JSON.stringify(entries.map(({ name }) => name)) !== JSON.stringify(expectedEntries)) {
    throw new Error('Codemagic provenance ZIP entry graph differs from policy');
  }
  compressedRanges.sort(([left], [right]) => left - right);
  if (compressedRanges[0]?.[0] !== 0) {
    throw new Error('Codemagic provenance ZIP contains unreferenced bytes before its local records');
  }
  for (let index = 1; index < compressedRanges.length; index += 1) {
    if (compressedRanges[index][0] !== compressedRanges[index - 1][1]) {
      throw new Error('Codemagic provenance ZIP local records are not contiguous');
    }
  }
  if (compressedRanges.at(-1)?.[1] !== directoryOffset) {
    throw new Error('Codemagic provenance ZIP contains unreferenced bytes before its central directory');
  }
  return Object.freeze({ entries: Object.freeze(entries), total_uncompressed_bytes: totalUncompressed });
}

function evidenceJson(evidence, path, label, keys) {
  const value = parseDeterministicJson(evidence.get(path), label);
  exactKeys(value, keys, label);
  return value;
}

function assertShaFields(value, names, label) {
  for (const name of names) {
    if (!SHA256.test(String(value[name] || ''))) throw new Error(`${label} ${name} is not one SHA-256 digest`);
  }
}

function parseRuntimeLedger(bytes, acceptance) {
  const source = Buffer.from(bytes).toString('utf8');
  if (!source.endsWith('\n') || source.includes('\r') || source.includes('\0')) {
    throw new Error('Codemagic web evidence ledger has invalid encoding');
  }
  const lines = source.slice(0, -1).split('\n');
  if (lines.length < 1 || lines.length > RUNTIME_ENTRY_LIMIT) {
    throw new Error('Codemagic web evidence ledger entry count is outside policy');
  }
  const ledger = new Map();
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._/-]*)$/);
    if (
      !match
      || match[2].length > 512
      || match[2].split('/').length > 32
      || ledger.has(match[2])
      || match[2].includes('\\')
      || match[2].startsWith('/')
      || match[2].split('/').some((part) => !part || part === '.' || part === '..')
    ) throw new Error('Codemagic web evidence ledger is malformed');
    ledger.set(match[2], match[1]);
  }
  if (JSON.stringify([...ledger.keys()]) !== JSON.stringify([...ledger.keys()].sort())) {
    throw new Error('Codemagic web evidence ledger paths are not canonical');
  }
  if (ledger.size !== acceptance.embedded_provenance.runtime_asset_count + 1) {
    throw new Error('Codemagic web evidence ledger count differs from compiled runtime provenance');
  }
  for (const [path, expected] of [
    ['build.json', acceptance.embedded_provenance.build_json_sha256],
    ['runtime-asset-manifest.json', acceptance.embedded_provenance.runtime_asset_manifest_sha256],
    ['memphis-build-identity.js', acceptance.embedded_provenance.build_identity_js_sha256],
  ]) {
    if (ledger.get(path) !== expected) throw new Error(`Codemagic web evidence does not bind ${path}`);
  }
  const generatedPaths = new Set(CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS);
  const generatedHashes = acceptance.embedded_provenance.capacitor_generated_assets_sha256;
  const generatedNames = [...generatedPaths].map((path) => path.replace(/^assets\/public\//, '')).sort();
  if (JSON.stringify(Object.keys(generatedHashes).sort()) !== JSON.stringify(generatedNames)) {
    throw new Error('Codemagic generated Capacitor hash keys differ from policy');
  }
  const compiledExecutables = Object.entries(acceptance.native_security.webview_executable_sha256);
  if (acceptance.native_security.webview_executable_count !== compiledExecutables.length) {
    throw new Error('Codemagic compiled executable count differs from its hash map');
  }
  for (const apkPath of generatedPaths) {
    const name = apkPath.replace(/^assets\/public\//, '');
    if (
      name === apkPath
      || ledger.has(name)
      || acceptance.native_security.webview_executable_sha256[apkPath] !== generatedHashes[name]
    ) {
      throw new Error(`Codemagic compiled Capacitor executable does not bind ${basename(apkPath)}`);
    }
  }
  for (const [apkPath, digest] of compiledExecutables) {
    if (generatedPaths.has(apkPath)) continue;
    const path = apkPath.replace(/^assets\/public\//, '');
    if (path === apkPath || ledger.get(path) !== digest) {
      throw new Error(`Codemagic web evidence does not bind compiled executable ${basename(apkPath)}`);
    }
  }
  return ledger;
}

function assertBundleProvenanceRecords({ evidence, acceptance, metadata, commit, versionCode }) {
  const tree = acceptance.source.tree;
  const configuration = evidenceJson(
    evidence,
    'build/provenance/custodial-android-configuration.json',
    'Codemagic Custodial Android configuration',
    [
      'schema_version', 'edition', 'platform', 'app_identifier', 'release_version', 'build_number',
      'build_number_source', 'source_commit', 'source_tree', 'source_commit_exact', 'signing_configured',
      'signing_keystore_sha256', 'generated_build_gradle_sha256', 'version_overlay_sha256',
      'release_overlay_sha256', 'gradle_wrapper_properties_sha256', 'gradle_wrapper_jar_sha256',
      'gradle_distribution_sha256', 'gradle_verification_metadata_sha256',
      'generated_variables_gradle_sha256', 'custodial_release_policy_sha256',
      'custodial_highest_fleet_version_code', 'custodial_minimum_next_version_code',
      'custodial_native_vault_source_sha256', 'generated_capacitor_plugins_sha256',
      'generated_capacitor_config_sha256', 'custodial_capacitor_plugin_count',
      'custodial_capacitor_plugin_graph_sha256', 'custodial_capacitor_config_policy_sha256',
      'custodial_capacitor_include_plugins_match_manifest',
    ],
  );
  assertShaFields(configuration, [
    'signing_keystore_sha256', 'generated_build_gradle_sha256', 'version_overlay_sha256',
    'release_overlay_sha256', 'gradle_wrapper_properties_sha256', 'gradle_wrapper_jar_sha256',
    'gradle_distribution_sha256', 'gradle_verification_metadata_sha256',
    'generated_variables_gradle_sha256', 'custodial_release_policy_sha256',
    'custodial_native_vault_source_sha256', 'generated_capacitor_plugins_sha256',
    'generated_capacitor_config_sha256', 'custodial_capacitor_plugin_graph_sha256',
    'custodial_capacitor_config_policy_sha256',
  ], 'Codemagic Custodial Android configuration');
  if (
    configuration.schema_version !== 1
    || configuration.edition !== 'custodial'
    || configuration.platform !== 'android'
    || configuration.app_identifier !== CUSTODIAL_PACKAGE_NAME
    || configuration.release_version !== CUSTODIAL_VERSION_NAME
    || configuration.build_number !== versionCode
    || configuration.build_number_source !== 'PROJECT_BUILD_NUMBER'
    || configuration.source_commit !== commit
    || configuration.source_tree !== tree
    || configuration.source_commit_exact !== true
    || configuration.signing_configured !== true
    || configuration.custodial_release_policy_sha256 !== acceptance.verifier.release_policy_sha256
    || configuration.custodial_highest_fleet_version_code !== acceptance.build.highest_fleet_version_code
    || configuration.custodial_minimum_next_version_code !== acceptance.build.minimum_next_version_code
    || configuration.custodial_native_vault_source_sha256 !== acceptance.embedded_provenance.custodial_native_vault_source_sha256
    || configuration.generated_capacitor_plugins_sha256 !== acceptance.native_security.plugin_manifest_sha256
    || configuration.generated_capacitor_config_sha256 !== acceptance.native_security.capacitor_config_sha256
    || configuration.custodial_capacitor_plugin_count !== acceptance.native_security.plugin_count
    || configuration.custodial_capacitor_plugin_graph_sha256 !== acceptance.native_security.plugin_graph_sha256
    || configuration.custodial_capacitor_config_policy_sha256 !== acceptance.native_security.capacitor_config_policy_sha256
    || configuration.custodial_capacitor_include_plugins_match_manifest !== true
  ) throw new Error('Codemagic Custodial Android configuration differs from compiled acceptance');

  const build = evidenceJson(
    evidence,
    'build/provenance/custodial-build.json',
    'Codemagic Custodial build record',
    [
      'edition', 'release_id', 'source_commit', 'source_tree', 'source_commit_exact', 'build_id',
      'custodial_native_vault_source_sha256', 'native_build_number', 'messenger', 'node', 'npm',
      'dependency_install_policy', 'firebase_util_postinstall_sha256', 'codemagic_build_id',
    ],
  );
  if (
    build.edition !== 'custodial'
    || build.release_id !== acceptance.embedded_provenance.release_id
    || build.source_commit !== commit
    || build.source_tree !== tree
    || build.source_commit_exact !== true
    || build.build_id !== acceptance.embedded_provenance.build_id
    || build.custodial_native_vault_source_sha256 !== acceptance.embedded_provenance.custodial_native_vault_source_sha256
    || build.native_build_number !== versionCode
    || build.messenger !== 'chatscope'
    || build.node !== 'v22.23.1'
    || build.npm !== '11.17.0'
    || build.dependency_install_policy !== 'npm-ci-ignore-scripts-v1'
    || build.firebase_util_postinstall_sha256 !== '56e40adf04426e6b07df5d1ca7d4142a5b2c91ea9df5800589e357f9a2433252'
    || build.codemagic_build_id !== metadata.build_id
  ) throw new Error('Codemagic Custodial build record differs from compiled acceptance');

  const toolchain = evidenceJson(
    evidence,
    'build/provenance/custodial-android-toolchain.json',
    'Codemagic Custodial Android toolchain',
    ['schema_version', 'codemagic_xcode_image', 'android_build_tools_version', 'toolchain_policy_sha256', 'files_sha256'],
  );
  exactKeys(toolchain.files_sha256, ['aapt2', 'apksigner', 'lib/apksigner.jar', 'source.properties', 'zipalign'], 'Codemagic Android toolchain files');
  assertShaFields(toolchain.files_sha256, Object.keys(toolchain.files_sha256), 'Codemagic Android toolchain files');
  const macPolicy = custodialAndroidToolchainPolicyForPlatform('darwin');
  if (
    toolchain.schema_version !== 1
    || toolchain.codemagic_xcode_image !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.runner_xcode_image
    || toolchain.android_build_tools_version !== macPolicy.android_build_tools_version
    || toolchain.toolchain_policy_sha256 !== macPolicy.sha256
    || JSON.stringify(toolchain.files_sha256) !== JSON.stringify(macPolicy.installed_files_sha256)
    || acceptance.verifier.toolchain_policy_sha256 !== macPolicy.sha256
  ) throw new Error('Codemagic Android toolchain record differs from the pinned macOS policy');

  const firebase = evidenceJson(
    evidence,
    'build/provenance/custodial-firebase-android.json',
    'Codemagic Custodial Firebase record',
    ['schema_version', 'edition', 'platform', 'app_identifier', 'sha256', 'bytes', 'source'],
  );
  const firebaseLock = readFileSync(join(mobileRoot, 'native-locks', 'firebase', 'custodial-android.sha256'), 'utf8').trim().split(/\s+/)[0];
  if (
    firebase.schema_version !== 1
    || firebase.edition !== 'custodial'
    || firebase.platform !== 'android'
    || firebase.app_identifier !== CUSTODIAL_PACKAGE_NAME
    || firebase.sha256 !== firebaseLock
    || !Number.isSafeInteger(firebase.bytes)
    || firebase.bytes < 1
    || firebase.bytes > 1024 * 1024
    || !['client-config-endpoint', 'environment-raw', 'environment-base64'].includes(firebase.source)
  ) throw new Error('Codemagic Custodial Firebase record differs from its pinned Android policy');

  const backup = evidenceJson(
    evidence,
    'build/provenance/custodial-android-backup-security.json',
    'Codemagic Custodial Android backup record',
    [
      'schema_version', 'edition', 'policy', 'allow_backup', 'full_backup_content',
      'data_extraction_rules', 'excluded_domains', 'legacy_rules_sha256',
      'data_extraction_rules_sha256', 'uses_cleartext_traffic', 'required_compiled_extract_native_libs',
      'network_security_config', 'network_security_config_sha256', 'file_provider_policy',
      'file_provider_paths_sha256',
    ],
  );
  if (
    backup.schema_version !== 1
    || backup.edition !== 'custodial'
    || backup.policy !== acceptance.backup.policy
    || backup.allow_backup !== acceptance.backup.allow_backup
    || backup.full_backup_content !== '@xml/memphis_zoo_backup_rules'
    || backup.data_extraction_rules !== '@xml/memphis_zoo_data_extraction_rules'
    || JSON.stringify(backup.excluded_domains) !== JSON.stringify(androidBackupDomains)
    || backup.legacy_rules_sha256 !== sha256(legacyBackupRules)
    || backup.data_extraction_rules_sha256 !== sha256(dataExtractionRules)
    || backup.uses_cleartext_traffic !== false
    || backup.required_compiled_extract_native_libs !== false
    || backup.network_security_config !== '@xml/memphis_zoo_network_security_config'
    || backup.network_security_config_sha256 !== sha256(custodialNetworkSecurityConfig)
    || backup.file_provider_policy !== 'app-external-files-pictures-only'
    || backup.file_provider_paths_sha256 !== sha256(custodialFileProviderPaths)
    || acceptance.android_manifest_security.uses_cleartext_traffic !== false
    || acceptance.android_manifest_security.extract_native_libs !== false
  ) throw new Error('Codemagic Custodial backup record differs from compiled security acceptance');

  return parseRuntimeLedger(evidence.get('build/provenance/custodial-web.sha256'), acceptance);
}

export function verifyRuntimeLedgerDirectory(directory, ledger) {
  const root = resolve(directory);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Custodial runtime proof must be one real directory');
  if (!(ledger instanceof Map) || ledger.size < 1 || ledger.size > RUNTIME_ENTRY_LIMIT) {
    throw new Error('Custodial runtime ledger entry count is outside policy');
  }
  const permittedDirectories = new Set(['']);
  for (const [path, digest] of ledger) {
    if (
      typeof path !== 'string'
      || !path
      || path.startsWith('/')
      || path.includes('\\')
      || path.length > 512
      || path.split('/').length > 32
      || path.split('/').some((part) => !part || part === '.' || part === '..')
      || !SHA256.test(String(digest || ''))
    ) throw new Error('Custodial runtime ledger contains an unsafe entry');
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      permittedDirectories.add(parts.slice(0, index).join('/'));
    }
  }
  const actual = new Map();
  let totalBytes = 0;
  const walk = (path) => {
    for (const name of readdirSync(path).sort()) {
      const file = join(path, name);
      const stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Custodial runtime proof contains a symlink');
      const relativePath = file.slice(root.length + 1).replaceAll('\\', '/');
      if (stat.isDirectory()) {
        if (!permittedDirectories.has(relativePath)) {
          throw new Error('Custodial runtime proof contains an unledgered directory');
        }
        walk(file);
      }
      else if (stat.isFile()) {
        if (!ledger.has(relativePath)) throw new Error('Custodial runtime proof contains an unledgered file');
        if (stat.size > RUNTIME_FILE_SIZE_LIMIT) throw new Error('Custodial runtime proof file exceeds policy');
        totalBytes += stat.size;
        if (totalBytes > RUNTIME_TOTAL_SIZE_LIMIT) throw new Error('Custodial runtime proof exceeds aggregate byte policy');
        const bytes = readFileSync(file);
        const after = lstatSync(file);
        if (
          bytes.length !== stat.size
          || after.size !== stat.size
          || after.ino !== stat.ino
          || after.dev !== stat.dev
          || after.mtimeMs !== stat.mtimeMs
        ) throw new Error('Custodial runtime proof changed while it was inspected');
        actual.set(relativePath, sha256(bytes));
        if (actual.size > ledger.size) throw new Error('Custodial runtime proof entry count differs from its ledger');
      } else throw new Error('Custodial runtime proof contains a non-file entry');
    }
  };
  walk(root);
  const sortedEntries = (value) => [...value].sort(([left], [right]) => (
    left < right ? -1 : (left > right ? 1 : 0)
  ));
  if (JSON.stringify(sortedEntries(actual)) !== JSON.stringify(sortedEntries(ledger))) {
    throw new Error('Locally rebuilt Custodial runtime differs from Codemagic web provenance');
  }
  return true;
}

function assertTrustedAdmissionExecutable(path, expectedSha256, label) {
  if (
    typeof path !== 'string'
    || !path.startsWith('/')
    || resolve(path) !== path
    || typeof expectedSha256 !== 'string'
    || !SHA256.test(expectedSha256)
  ) throw new Error(`${label} identity is malformed`);
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || realpathSync(path) !== path) {
    throw new Error(`${label} must be one canonical regular executable`);
  }
  accessSync(path, constants.X_OK);
  const bytes = readFileSync(path);
  const after = lstatSync(path);
  if (
    bytes.length !== before.size
    || after.dev !== before.dev
    || after.ino !== before.ino
    || after.size !== before.size
    || after.mtimeMs !== before.mtimeMs
    || sha256(bytes) !== expectedSha256
  ) throw new Error(`${label} differs from its verified host identity`);
  return path;
}

export function verifyCodemagicProvenanceBundle({
  bundlePath,
  apkBytes,
  metadata,
  expectedCommit,
  expectedSourceRef = 'main',
  expectedVersionCode,
  unzipPath,
  expectedUnzipSha256,
  commandEnvironment,
}) {
  const bundle = resolve(bundlePath);
  if (!existsSync(bundle) || !lstatSync(bundle).isFile() || lstatSync(bundle).isSymbolicLink()) {
    throw new Error('Codemagic provenance bundle must be one regular file');
  }
  const inspectedZip = inspectCodemagicProvenanceZip(readFileSync(bundle));
  const unzip = assertTrustedAdmissionExecutable(unzipPath, expectedUnzipSha256, 'Custodial admission unzip');
  const entries = String(run(unzip, ['-Z1', bundle], {
    baseEnvironment: commandEnvironment,
    cwd: '/',
  })).split(/\r?\n/).filter(Boolean);
  if (JSON.stringify(entries) !== JSON.stringify(inspectedZip.entries.map(({ name }) => name))) {
    throw new Error('Codemagic provenance ZIP parser and extractor entry graphs differ');
  }
  if (entries.length !== new Set(entries).size) throw new Error('Codemagic provenance bundle repeats an entry');
  for (const entry of entries) {
    const parts = entry.replace(/\/$/, '').split('/');
    if (
      entry.includes('\\')
      || entry.startsWith('/')
      || parts.some((part) => !part || part === '.' || part === '..')
    ) {
      throw new Error('Codemagic provenance bundle contains an unsafe path');
    }
  }
  const expectedEntries = ['build/', 'build/provenance/', ...requiredBundleFiles].sort();
  if (JSON.stringify([...entries].sort()) !== JSON.stringify(expectedEntries)) {
    throw new Error('Codemagic provenance bundle entry graph differs from policy');
  }
  const zipSizes = new Map(inspectedZip.entries.map((entry) => [entry.name, entry.uncompressed_size]));
  const evidence = new Map();
  let extractedTotal = 0;
  for (const entry of requiredBundleFiles) {
    const bytes = zipEntryBytes(unzip, bundle, entry, commandEnvironment);
    if (bytes.length !== zipSizes.get(entry)) throw new Error(`Codemagic ZIP extraction size differs: ${basename(entry)}`);
    extractedTotal += bytes.length;
    if (extractedTotal > ZIP_TOTAL_SIZE_LIMIT) throw new Error('Codemagic extracted evidence exceeds aggregate policy');
    evidence.set(entry, bytes);
  }
  assertTrustedAdmissionExecutable(unzipPath, expectedUnzipSha256, 'Custodial admission unzip');
  const ledgerPath = 'build/provenance/custodial-native.sha256';
  const ledgerBytes = evidence.get(ledgerPath);
  const ledgerSource = ledgerBytes.toString('utf8');
  if (!ledgerSource.endsWith('\n') || ledgerSource.includes('\r') || ledgerSource.includes('\0')) {
    throw new Error('Codemagic native evidence ledger has invalid encoding');
  }
  const ledgerLines = ledgerSource.slice(0, -1).split('\n');
  const ledger = new Map();
  for (const line of ledgerLines) {
    const match = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9._/-]+)$/);
    if (
      !match
      || ledger.has(match[2])
      || match[2].includes('\\')
      || match[2].startsWith('/')
      || match[2].split('/').some((part) => !part || part === '.' || part === '..')
    ) {
      throw new Error('Codemagic native evidence ledger is malformed');
    }
    ledger.set(match[2], match[1]);
  }
  const expectedLedgerPaths = [
    ...requiredBundleFiles.filter((entry) => entry !== ledgerPath),
    'mobile/android/app/build/outputs/apk/release/app-release.apk',
  ].sort();
  if (JSON.stringify([...ledger.keys()].sort()) !== JSON.stringify(expectedLedgerPaths)) {
    throw new Error('Codemagic native evidence ledger path graph differs from policy');
  }
  if (JSON.stringify([...ledger.keys()]) !== JSON.stringify(expectedLedgerPaths)) {
    throw new Error('Codemagic native evidence ledger paths are not canonical');
  }
  for (const [entry, bytes] of evidence) {
    if (entry === ledgerPath) continue;
    if (ledger.get(entry) !== sha256(bytes)) throw new Error(`Codemagic evidence ledger mismatch: ${basename(entry)}`);
  }
  const apkHash = sha256(apkBytes);
  if (ledger.get('mobile/android/app/build/outputs/apk/release/app-release.apk') !== apkHash) {
    throw new Error('Codemagic evidence ledger does not bind the downloaded APK');
  }
  const acceptancePath = 'build/provenance/custodial-android-release-acceptance.json';
  const acceptanceBytes = evidence.get(acceptancePath);
  const acceptance = parseDeterministicJson(acceptanceBytes, 'Codemagic producer acceptance');
  assertCustodialAcceptanceSchema(acceptance);
  const versionCode = positiveInteger(expectedVersionCode, 'Expected Custodial versionCode');
  const commit = normalizedCommit(expectedCommit);
  const sourceRef = normalizeCustodialAdmissionSourceRef(expectedSourceRef);
  const sourceBranch = sourceRef.slice('refs/heads/'.length);
  if (
    acceptance.artifact.file_name !== CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.apk_artifact_name
    || acceptance.artifact.apk_sha256 !== apkHash
    || acceptance.artifact.size_bytes !== apkBytes.length
    || acceptance.application.package_name !== CUSTODIAL_PACKAGE_NAME
    || acceptance.application.version_code !== versionCode
    || acceptance.application.version_name !== CUSTODIAL_VERSION_NAME
    || acceptance.source.commit !== commit
    || acceptance.source.ref !== sourceRef
    || acceptance.build.run_id !== metadata.build_id
    || acceptance.build.workflow !== metadata.workflow.id
    || acceptance.build.number !== versionCode
    || acceptance.tools.android_build_tools_platform !== 'macosx'
    || acceptance.verifier.toolchain_policy_sha256 !== custodialAndroidToolchainPolicyForPlatform('darwin').sha256
  ) throw new Error('Codemagic producer acceptance does not bind API and APK facts');
  const sourceAttestation = evidenceJson(
    evidence,
    'build/provenance/custodial-source-attestation.json',
    'Codemagic source attestation',
    [
      'schema_version', 'source_commit', 'source_tree', 'source_ref',
      'tracked_worktree_clean', 'untracked_nonignored_files_absent',
    ],
  );
  if (
    sourceAttestation.schema_version !== 1
    || sourceAttestation.source_commit !== commit
    || sourceAttestation.source_tree !== acceptance.source.tree
    || sourceAttestation.source_ref !== sourceBranch
    || sourceAttestation.tracked_worktree_clean !== true
    || sourceAttestation.untracked_nonignored_files_absent !== true
  ) throw new Error('Codemagic source attestation does not bind the exact clean source commit');
  const webLedger = assertBundleProvenanceRecords({
    evidence,
    acceptance,
    metadata,
    commit,
    versionCode,
  });
  return Object.freeze({
    acceptance,
    acceptance_sha256: sha256(acceptanceBytes),
    ledger_sha256: sha256(ledgerBytes),
    apk_sha256: apkHash,
    web_ledger: webLedger,
    web_ledger_sha256: sha256(evidence.get('build/provenance/custodial-web.sha256')),
  });
}

export function assertProducerConsumerAcceptanceMatch(producer, consumer) {
  assertCustodialAcceptanceSchema(producer);
  assertCustodialAcceptanceSchema(consumer);
  for (const field of [
    'artifact',
    'application',
    'embedded_provenance',
    'source',
    'build',
    'signing',
    'alignment',
    'backup',
    'android_manifest_security',
    'native_security',
  ]) {
    if (JSON.stringify(producer[field]) !== JSON.stringify(consumer[field])) {
      throw new Error(`Codemagic producer and Linux consumer acceptance differ: ${field}`);
    }
  }
  const producerPolicy = custodialAndroidToolchainPolicyForPlatform('darwin');
  const consumerPolicy = custodialAndroidToolchainPolicyForPlatform('linux');
  const assertTools = (acceptance, policy, label) => {
    const tools = acceptance.tools;
    const installed = policy.installed_files_sha256;
    if (
      tools.android_build_tools_platform !== policy.platform
      || tools.android_build_tools_version !== policy.android_build_tools_version
      || tools.aapt2.sha256 !== installed.aapt2
      || tools.apksigner.sha256 !== installed.apksigner
      || tools.apksigner_jar.sha256 !== installed['lib/apksigner.jar']
      || tools.source_properties.sha256 !== installed['source.properties']
      || tools.zipalign.sha256 !== installed.zipalign
      || acceptance.verifier.toolchain_policy_sha256 !== policy.sha256
    ) throw new Error(`${label} Android toolchain provenance differs from its platform policy`);
  };
  assertTools(producer, producerPolicy, 'Codemagic producer');
  assertTools(consumer, consumerPolicy, 'Linux consumer');
  const producerVerifierKeys = Object.keys(producer.verifier).sort();
  const consumerVerifierKeys = Object.keys(consumer.verifier).sort();
  if (JSON.stringify(producerVerifierKeys) !== JSON.stringify(consumerVerifierKeys)) {
    throw new Error('Codemagic producer/Linux consumer verifier fields differ');
  }
  for (const name of producerVerifierKeys) {
    if (name === 'toolchain_policy_sha256') continue;
    if (producer.verifier[name] !== consumer.verifier[name]) {
      throw new Error(`Codemagic producer/Linux consumer verifier provenance differs: ${name}`);
    }
  }
  return true;
}

function assertPrivateAdmissionChildEnvironment(verifiedHost) {
  const root = dirname(repositoryRoot);
  const rootName = basename(root);
  const expectedRootPrefix = `${BOOTSTRAP_ROOT_PREFIX}${process.getuid()}-`;
  const checkoutStat = lstatSync(repositoryRoot);
  if (
    basename(repositoryRoot) !== 'checkout'
    || dirname(root) !== '/home/eric/.cache'
    || !rootName.startsWith(expectedRootPrefix)
    || !/^[A-Za-z0-9]{6}$/.test(rootName.slice(expectedRootPrefix.length))
    || realpathSync(repositoryRoot) !== repositoryRoot
    || !checkoutStat.isDirectory()
    || checkoutStat.isSymbolicLink()
    || Number(checkoutStat.uid) !== process.getuid()
    || (checkoutStat.mode & 0o077) !== 0
    || process.env[BOOTSTRAP_MARKER_NAME] !== verifiedHost.policy_sha256
  ) throw new Error('Custodial admission was not started by its verified private bootstrap');
  const rootStat = lstatSync(root);
  if (
    !rootStat.isDirectory()
    || rootStat.isSymbolicLink()
    || Number(rootStat.uid) !== process.getuid()
    || (rootStat.mode & 0o077) !== 0
    || realpathSync(root) !== root
  ) throw new Error('Custodial admission bootstrap root is not private');

  const privatePaths = {
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'xdg-config'),
    XDG_CACHE_HOME: join(root, 'xdg-cache'),
    TMPDIR: join(root, 'tmp'),
    NPM_CONFIG_CACHE: join(root, 'npm-cache'),
    NPM_CONFIG_USERCONFIG: join(root, 'npm-user-config'),
    NPM_CONFIG_GLOBALCONFIG: join(root, 'npm-global-config'),
  };
  for (const [name, path] of Object.entries(privatePaths)) {
    if (process.env[name] !== path) throw new Error(`Custodial admission private environment differs: ${name}`);
    if (['NPM_CONFIG_USERCONFIG', 'NPM_CONFIG_GLOBALCONFIG'].includes(name)) continue;
    const stat = lstatSync(path);
    if (
      !stat.isDirectory()
      || stat.isSymbolicLink()
      || Number(stat.uid) !== process.getuid()
      || (stat.mode & 0o077) !== 0
      || realpathSync(path) !== path
    ) throw new Error(`Custodial admission private directory is unsafe: ${name}`);
  }
  for (const name of [
    'ANDROID_HOME',
    'ANDROID_SDK_ROOT',
    'CI',
    'COREPACK_ENABLE_PROJECT_SPEC',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_NOSYSTEM',
    'GIT_TERMINAL_PROMPT',
    'JAVA_HOME',
    'LANG',
    'LC_ALL',
    'NO_COLOR',
    'NPM_CONFIG_AUDIT',
    'NPM_CONFIG_COLOR',
    'NPM_CONFIG_ENGINE_STRICT',
    'NPM_CONFIG_FUND',
    'NPM_CONFIG_PROGRESS',
    'NPM_CONFIG_UPDATE_NOTIFIER',
    'PATH',
    'TZ',
  ]) {
    if (process.env[name] !== verifiedHost.environment[name]) {
      throw new Error(`Custodial admission verified host environment differs: ${name}`);
    }
  }
  return Object.freeze(Object.fromEntries([
    ...Object.entries(verifiedHost.environment),
    ...Object.entries(privatePaths),
  ]));
}

function gitOutputAt(gitPath, commandEnvironment, root, args) {
  return String(run(gitPath, ['-C', root, ...args], {
    baseEnvironment: commandEnvironment,
    cwd: '/',
  })).trim();
}

function gitOutput(gitPath, commandEnvironment, args) {
  return gitOutputAt(gitPath, commandEnvironment, repositoryRoot, args);
}

function liveMainCommit(gitPath, commandEnvironment) {
  const repository = CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.repository;
  const output = gitOutput(gitPath, commandEnvironment, [
    'ls-remote',
    '--refs',
    `https://github.com/${repository}.git`,
    'refs/heads/main',
  ]);
  const match = output.match(/^([a-f0-9]{40})\trefs\/heads\/main$/);
  if (!match) throw new Error('Unable to resolve one exact live GitHub main commit');
  return normalizedCommit(match[1]);
}

function assertCleanMainSource(gitPath, commandEnvironment) {
  const repository = CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.repository;
  const origin = gitOutput(gitPath, commandEnvironment, ['remote', 'get-url', 'origin']);
  if (![
    `https://github.com/${repository}`,
    `https://github.com/${repository}.git`,
    `git@github.com:${repository}`,
    `git@github.com:${repository}.git`,
  ].includes(origin)) throw new Error('Codemagic admission repository origin differs from policy');
  const commit = normalizedCommit(gitOutput(gitPath, commandEnvironment, ['rev-parse', 'HEAD']));
  const remoteMain = normalizedCommit(gitOutput(gitPath, commandEnvironment, ['rev-parse', 'refs/remotes/origin/main']));
  const status = gitOutput(gitPath, commandEnvironment, ['status', '--porcelain=v1', '--untracked-files=all', '--', '.']);
  const liveMain = liveMainCommit(gitPath, commandEnvironment);
  if (commit !== remoteMain || commit !== liveMain || status) {
    throw new Error('Codemagic admission requires an exact clean checkout of origin/main');
  }
  return commit;
}

function exactRemoteBranchCommit(gitPath, commandEnvironment, branch) {
  const repository = CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.repository;
  const output = gitOutput(gitPath, commandEnvironment, [
    'ls-remote',
    '--refs',
    `https://github.com/${repository}.git`,
    `refs/heads/${branch}`,
  ]);
  const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`^([a-f0-9]{40})\\trefs/heads/${escaped}$`));
  if (!match) throw new Error('Unable to resolve the exact live Custodial recovery branch');
  return normalizedCommit(match[1]);
}

function assertExactForwardRecoverySource(gitPath, commandEnvironment, artifactSourceRoot) {
  const policy = CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY;
  const privateRoot = dirname(repositoryRoot);
  const expectedRoot = join(privateRoot, 'artifact-source');
  if (artifactSourceRoot !== expectedRoot || !existsSync(artifactSourceRoot)) {
    throw new Error('Custodial recovery source is outside the private admission root');
  }
  const stat = lstatSync(artifactSourceRoot);
  if (
    !stat.isDirectory()
    || stat.isSymbolicLink()
    || realpathSync(artifactSourceRoot) !== artifactSourceRoot
    || Number(stat.uid) !== process.getuid()
    || (stat.mode & 0o077) !== 0
  ) throw new Error('Custodial recovery source checkout is unsafe');
  const origin = gitOutputAt(gitPath, commandEnvironment, artifactSourceRoot, ['remote', 'get-url', 'origin']);
  if (origin !== `https://github.com/${policy.repository}.git`) {
    throw new Error('Custodial recovery source origin differs from policy');
  }
  const commit = normalizedCommit(gitOutputAt(
    gitPath,
    commandEnvironment,
    artifactSourceRoot,
    ['rev-parse', 'HEAD^{commit}'],
  ));
  const tree = normalizedCommit(gitOutputAt(
    gitPath,
    commandEnvironment,
    artifactSourceRoot,
    ['rev-parse', 'HEAD^{tree}'],
  ));
  const remote = normalizedCommit(gitOutput(
    gitPath,
    commandEnvironment,
    ['rev-parse', `refs/remotes/origin/${policy.branch}^{commit}`],
  ));
  const live = exactRemoteBranchCommit(gitPath, commandEnvironment, policy.branch);
  const status = gitOutputAt(
    gitPath,
    commandEnvironment,
    artifactSourceRoot,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', '.'],
  );
  if (
    commit !== policy.commit
    || tree !== policy.tree
    || remote !== policy.commit
    || live !== policy.commit
    || status
  ) throw new Error('Custodial recovery source differs from its exact branch/commit/tree policy');
  return Object.freeze({ root: artifactSourceRoot, commit, tree, branch: policy.branch, ref: policy.ref });
}

function prepareExactForwardRecoverySource(verifiedHost, commandEnvironment) {
  const policy = CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY;
  const artifactSourceRoot = join(dirname(repositoryRoot), 'artifact-source');
  if (existsSync(artifactSourceRoot)) throw new Error('Custodial recovery source path already exists');
  run(verifiedHost.paths.git, [
    '-C', repositoryRoot,
    'fetch', '--no-tags', '--depth=1', 'origin',
    `+refs/heads/${policy.branch}:refs/remotes/origin/${policy.branch}`,
  ], {
    baseEnvironment: commandEnvironment,
    cwd: '/',
    timeout: 5 * 60 * 1_000,
  });
  if (exactRemoteBranchCommit(verifiedHost.paths.git, commandEnvironment, policy.branch) !== policy.commit) {
    throw new Error('Live Custodial recovery branch moved away from the exact admitted commit');
  }
  run(verifiedHost.paths.git, [
    '-C', repositoryRoot,
    'worktree', 'add', '--detach', '--quiet', artifactSourceRoot, policy.commit,
  ], {
    baseEnvironment: commandEnvironment,
    cwd: '/',
    timeout: 5 * 60 * 1_000,
  });
  chmodSync(artifactSourceRoot, 0o700);
  let source = assertExactForwardRecoverySource(
    verifiedHost.paths.git,
    commandEnvironment,
    artifactSourceRoot,
  );
  run(verifiedHost.paths.node, [
    verifiedHost.paths.npm_cli,
    'ci', '--ignore-scripts', '--no-audit', '--no-fund',
  ], {
    baseEnvironment: commandEnvironment,
    cwd: artifactSourceRoot,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 15 * 60 * 1_000,
  });
  source = assertExactForwardRecoverySource(
    verifiedHost.paths.git,
    commandEnvironment,
    artifactSourceRoot,
  );
  return source;
}

function assertExactPrivateFile(path, expectedBytes, label) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must remain one regular file`);
  const expected = Buffer.from(expectedBytes);
  if (stat.size !== expected.length || sha256(readFileSync(path)) !== sha256(expected)) {
    throw new Error(`${label} changed during admission`);
  }
  return true;
}

function writePrivateFile(path, bytes) {
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
}

function ensureDirectory(path, mode) {
  if (!existsSync(path)) mkdirSync(path, { mode });
  const stat = lstatSync(path);
  if (
    !stat.isDirectory()
    || stat.isSymbolicLink()
    || realpathSync(path) !== path
    || Number(stat.uid) !== process.getuid()
  ) throw new Error('Codemagic admission path must be one owned real directory');
}

export function createPrivateAdmissionPendingDirectory(
  admissionParent,
  buildId,
  randomBytesImpl = randomBytes,
) {
  const normalized = normalizedBuildId(buildId);
  const parentStat = lstatSync(admissionParent);
  if (
    !parentStat.isDirectory()
    || parentStat.isSymbolicLink()
    || realpathSync(admissionParent) !== admissionParent
    || Number(parentStat.uid) !== process.getuid()
    || (parentStat.mode & 0o077) !== 0
  ) throw new Error('Codemagic admission pending parent must remain private and owned');
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const entropy = randomBytesImpl(3);
    if (!Buffer.isBuffer(entropy) || entropy.length !== 3) {
      throw new Error('Codemagic admission pending entropy must be exactly three bytes');
    }
    const stagingDirectory = join(admissionParent, `.pending-${normalized}-${entropy.toString('hex')}`);
    try {
      mkdirSync(stagingDirectory, { mode: 0o700 });
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      throw error;
    }
    const stat = lstatSync(stagingDirectory);
    if (
      dirname(stagingDirectory) !== admissionParent
      || !stat.isDirectory()
      || stat.isSymbolicLink()
      || realpathSync(stagingDirectory) !== stagingDirectory
      || Number(stat.uid) !== process.getuid()
      || (stat.mode & 0o077) !== 0
    ) throw new Error('Codemagic admission pending directory is unsafe');
    return stagingDirectory;
  }
  throw new Error('Unable to allocate a unique Codemagic admission pending directory');
}

function createPrivateStagingDirectory(buildId) {
  const buildDirectory = join(repositoryRoot, 'build');
  ensureDirectory(buildDirectory, 0o755);
  const admissionParent = join(buildDirectory, 'custodial-codemagic-admission');
  ensureDirectory(admissionParent, 0o700);
  const finalDirectory = join(admissionParent, buildId);
  if (existsSync(finalDirectory)) throw new Error('Codemagic build already has a completed local admission');
  const stagingDirectory = createPrivateAdmissionPendingDirectory(admissionParent, buildId);
  return { finalDirectory, stagingDirectory };
}

function parseCli(args) {
  if (args.length !== 2 || args[0] !== '--build-id') {
    throw new Error('Usage: admit-custodial-codemagic-build.mjs --build-id <Codemagic build ID>');
  }
  return normalizedBuildId(args[1]);
}

async function main() {
  const buildId = parseCli(process.argv.slice(2));
  const verifiedHost = await verifyCustodialLinuxAdmissionHostTools();
  if (JSON.stringify(verifiedHost.proof) !== JSON.stringify(CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF)) {
    throw new Error('Custodial admission verified host proof differs from the reviewed policy');
  }
  const commandEnvironment = assertPrivateAdmissionChildEnvironment(verifiedHost);
  const controlSourceCommit = assertCleanMainSource(verifiedHost.paths.git, commandEnvironment);
  const controlSourceTree = normalizedCommit(gitOutput(
    verifiedHost.paths.git,
    commandEnvironment,
    ['rev-parse', 'HEAD^{tree}'],
  ));
  const artifactSource = prepareExactForwardRecoverySource(verifiedHost, commandEnvironment);
  const sourceCommit = artifactSource.commit;
  const minimumVersionCode = CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code;
  const token = process.env.CODEMAGIC_API_TOKEN;
  const firstBytes = await fetchCodemagicV3BuildResponse(buildId, token);
  const first = inspectCodemagicV3BuildResponse(firstBytes, {
    expectedBuildId: buildId,
    expectedCommit: sourceCommit,
    expectedBranch: artifactSource.branch,
    expectedVersionCode: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code,
    minimumVersionCode,
  });
  const versionCode = first.metadata.version_code;
  const apkMetadata = first.metadata.artifacts.find((artifact) => artifact.type === 'apk');
  const bundleMetadata = first.metadata.artifacts.find((artifact) => artifact.type === 'bundle');
  const [apkBytes, bundleBytes] = await Promise.all([
    downloadCodemagicArtifact(
      first.artifactUrls.get(apkMetadata.name),
      apkMetadata.size_bytes,
      'apk',
      apkMetadata.name,
    ),
    downloadCodemagicArtifact(
      first.artifactUrls.get(bundleMetadata.name),
      bundleMetadata.size_bytes,
      'bundle',
      bundleMetadata.name,
    ),
  ]);

  const { finalDirectory, stagingDirectory: admissionDirectory } = createPrivateStagingDirectory(buildId);
  const apkPath = join(admissionDirectory, apkMetadata.name);
  const bundlePath = join(admissionDirectory, bundleMetadata.name);
  writePrivateFile(apkPath, apkBytes);
  writePrivateFile(bundlePath, bundleBytes);
  assertExactPrivateFile(apkPath, apkBytes, 'Downloaded Custodial APK');
  assertExactPrivateFile(bundlePath, bundleBytes, 'Downloaded Codemagic provenance bundle');

  const bundleProof = verifyCodemagicProvenanceBundle({
    bundlePath,
    apkBytes,
    metadata: first.metadata,
    expectedCommit: sourceCommit,
    expectedSourceRef: artifactSource.ref,
    expectedVersionCode: versionCode,
    unzipPath: verifiedHost.paths.unzip,
    expectedUnzipSha256: verifiedHost.proof.unzip.sha256,
    commandEnvironment,
  });
  assertExactPrivateFile(bundlePath, bundleBytes, 'Downloaded Codemagic provenance bundle');
  const artifactBuildDirectory = join(artifactSource.root, 'build');
  ensureDirectory(artifactBuildDirectory, 0o755);
  const artifactAdmissionParent = join(artifactBuildDirectory, 'custodial-codemagic-admission');
  ensureDirectory(artifactAdmissionParent, 0o700);
  const artifactRuntimeProof = createPrivateAdmissionPendingDirectory(artifactAdmissionParent, buildId);
  const runtimeDirectory = join(artifactRuntimeProof, 'mobile-dist');
  const runtimeRelativePath = runtimeDirectory.slice(artifactSource.root.length + 1).replaceAll('\\', '/');
  run(verifiedHost.paths.node, [join(artifactSource.root, 'mobile', 'scripts', 'build.mjs')], {
    baseEnvironment: commandEnvironment,
    cwd: artifactSource.root,
    environment: {
      CI: 'true',
      CM_BRANCH: artifactSource.branch,
      CM_COMMIT: sourceCommit,
      MZ_API_BASE: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.runtime_api_base,
      MZ_APP_EDITION: 'custodial',
      MZ_MOBILE_DIST: runtimeRelativePath,
      MZ_RELEASE_VERSION: CUSTODIAL_VERSION_NAME,
      MZ_SHELL_START: '1',
      PROJECT_BUILD_NUMBER: String(versionCode),
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  verifyRuntimeLedgerDirectory(runtimeDirectory, bundleProof.web_ledger);
  const buildToolsDirectory = verifiedHost.paths.android_build_tools_directory;
  const consumerAcceptancePath = join(admissionDirectory, 'custodial-linux-consumer-acceptance.json');
  run(verifiedHost.paths.node, [
    join(artifactSource.root, 'mobile', 'scripts', 'verify-custodial-android-release.mjs'),
    '--apk', apkPath,
    '--build-number', String(versionCode),
    '--source-commit', sourceCommit,
    '--source-ref', artifactSource.branch,
    '--build-run', buildId,
    '--build-workflow', CUSTODIAL_CODEMAGIC_WORKFLOW,
    '--build-tools-directory', buildToolsDirectory,
    '--runtime-directory', runtimeDirectory,
    '--output', consumerAcceptancePath,
  ], {
    baseEnvironment: commandEnvironment,
    cwd: artifactSource.root,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10 * 60 * 1_000,
  });
  const consumerBytes = readFileSync(consumerAcceptancePath);
  const consumerAcceptance = parseDeterministicJson(consumerBytes, 'Linux consumer acceptance');
  assertProducerConsumerAcceptanceMatch(bundleProof.acceptance, consumerAcceptance);
  assertExactPrivateFile(apkPath, apkBytes, 'Downloaded Custodial APK');
  assertExactPrivateFile(bundlePath, bundleBytes, 'Downloaded Codemagic provenance bundle');
  if (
    realpathSync(runtimeDirectory) !== runtimeDirectory
    || dirname(runtimeDirectory) !== artifactRuntimeProof
    || dirname(artifactRuntimeProof) !== artifactAdmissionParent
    || !lstatSync(runtimeDirectory).isDirectory()
  ) throw new Error('Refusing to remove an untrusted Custodial runtime proof path');
  rmSync(artifactRuntimeProof, { recursive: true, force: false });
  if (existsSync(artifactRuntimeProof)) throw new Error('Transient Custodial runtime proof was not removed');

  const secondBytes = await fetchCodemagicV3BuildResponse(buildId, token);
  const second = inspectCodemagicV3BuildResponse(secondBytes, {
    expectedBuildId: buildId,
    expectedCommit: sourceCommit,
    expectedBranch: artifactSource.branch,
    expectedVersionCode: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code,
    minimumVersionCode,
  });
  if (JSON.stringify(first.metadata) !== JSON.stringify(second.metadata)) {
    throw new Error('Codemagic build metadata changed during artifact admission');
  }
  if (assertCleanMainSource(verifiedHost.paths.git, commandEnvironment) !== controlSourceCommit) {
    throw new Error('Trusted control source changed during Codemagic artifact admission');
  }
  if (assertExactForwardRecoverySource(
    verifiedHost.paths.git,
    commandEnvironment,
    artifactSource.root,
  ).commit !== sourceCommit) {
    throw new Error('Exact recovery source changed during Codemagic artifact admission');
  }
  const admission = {
    schema_id: 'urn:memphis-zoo:custodial-codemagic-admission:v1',
    schema_version: 1,
    accepted: true,
    generated_at: new Date().toISOString(),
    provider: first.metadata.provider,
    app_id: first.metadata.app_id,
    build_id: first.metadata.build_id,
    workflow: first.metadata.workflow.id,
    status: first.metadata.status,
    branch: first.metadata.branch,
    commit: first.metadata.commit,
    control_source: {
      branch: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.branch,
      commit: controlSourceCommit,
      tree: controlSourceTree,
    },
    artifact_source_policy_sha256: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.sha256,
    platform_index: first.metadata.platform_index,
    finished_at: first.metadata.finished_at,
    version_code: versionCode,
    apk: {
      name: apkMetadata.name,
      size_bytes: apkBytes.length,
      sha256: bundleProof.apk_sha256,
    },
    provenance_bundle: {
      name: bundleMetadata.name,
      size_bytes: bundleBytes.length,
      sha256: sha256(bundleBytes),
    },
    producer_acceptance_sha256: bundleProof.acceptance_sha256,
    consumer_acceptance_sha256: sha256(consumerBytes),
    native_ledger_sha256: bundleProof.ledger_sha256,
    web_ledger_sha256: bundleProof.web_ledger_sha256,
    stable_metadata_sha256: first.metadata_sha256,
    admission_policy_sha256: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.sha256,
    admission_schema_sha256: sha256(admissionSchemaBytes),
    verifier_version: CUSTODIAL_CODEMAGIC_ADMISSION_VERSION,
    verifier_source_sha256: CUSTODIAL_CODEMAGIC_ADMISSION_SOURCE_SHA256,
    local_host: verifiedHost.proof,
  };
  assertCustodialCodemagicAdmissionSchema(admission);
  const admissionPath = join(admissionDirectory, 'custodial-codemagic-admission.json');
  writePrivateFile(
    admissionPath,
    Buffer.from(`${JSON.stringify(admission, null, 2)}\n`),
  );
  assertCustodialCodemagicAdmissionSchema(parseDeterministicJson(
    readFileSync(admissionPath),
    'Written Custodial Codemagic admission evidence',
  ));
  const finalFiles = [apkMetadata.name, bundleMetadata.name, basename(consumerAcceptancePath), basename(admissionPath)].sort();
  if (JSON.stringify(readdirSync(admissionDirectory).sort()) !== JSON.stringify(finalFiles)) {
    throw new Error('Custodial Codemagic final admission file graph differs from policy');
  }
  assertExactPrivateFile(apkPath, apkBytes, 'Downloaded Custodial APK');
  assertExactPrivateFile(bundlePath, bundleBytes, 'Downloaded Codemagic provenance bundle');
  const finalVerifiedHost = await verifyCustodialLinuxAdmissionHostTools();
  if (
    JSON.stringify(finalVerifiedHost.proof) !== JSON.stringify(verifiedHost.proof)
    || JSON.stringify(finalVerifiedHost.proof) !== JSON.stringify(CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF)
  ) throw new Error('Custodial admission host changed before evidence commit');
  assertPrivateAdmissionChildEnvironment(finalVerifiedHost);
  if (assertCleanMainSource(finalVerifiedHost.paths.git, commandEnvironment) !== controlSourceCommit) {
    throw new Error('Trusted control source changed before Custodial evidence commit');
  }
  if (assertExactForwardRecoverySource(
    finalVerifiedHost.paths.git,
    commandEnvironment,
    artifactSource.root,
  ).commit !== sourceCommit) {
    throw new Error('Exact recovery source changed before Custodial evidence commit');
  }
  for (const path of [apkPath, bundlePath, consumerAcceptancePath, admissionPath]) chmodSync(path, 0o400);
  chmodSync(admissionDirectory, 0o500);
  renameSync(admissionDirectory, finalDirectory);
  console.log(JSON.stringify({
    ok: true,
    build_id: buildId,
    commit: sourceCommit,
    version_code: versionCode,
    apk_sha256: admission.apk.sha256,
  }));
}

if (resolve(process.argv[1] || '') === scriptPath) await main();
