import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = dirname(fileURLToPath(import.meta.url));
const policyRoot = resolve(scriptsRoot, '..', 'release-policies');

export const CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION = '35.0.1';

const installedFileNames = Object.freeze([
  'aapt2',
  'apksigner',
  'lib/apksigner.jar',
  'source.properties',
  'zipalign',
]);

const platformDefinitions = Object.freeze({
  darwin: Object.freeze({
    policyFile: 'custodial-android-build-tools-35.0.1-macos.json',
    platform: 'macosx',
    archiveUrl: 'https://dl.google.com/android/repository/build-tools_r35.0.1_macosx.zip',
    archiveSize: 76_857_925,
    archiveSha1: 'f4dda6855ddf1ea1a51ee3ab6587104bd0c1d727',
    archiveSha256: 'c01e4b763da96ae5ef67e8bdf2abc94fb6cb3e73a42209581feb6a7019a51b9c',
  }),
  linux: Object.freeze({
    policyFile: 'custodial-android-build-tools-35.0.1-linux.json',
    platform: 'linux',
    archiveUrl: 'https://dl.google.com/android/repository/build-tools_r35.0.1_linux.zip',
    archiveSize: 61_959_297,
    archiveSha1: 'e009a9b188cfeb1d2b4c318ab5cb4f1ddc368861',
    archiveSha256: '5993499f3229a021b89f87088c57242aeefaa62316bf3d69da7de40bfd5350f1',
  }),
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, expected) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function assertCustodialAndroidToolchainPolicy(policy, platform = process.platform) {
  const definition = platformDefinitions[String(platform || '').trim()];
  if (!definition) throw new Error(`Custodial Android verification does not support host platform ${platform || 'missing'}`);
  if (!exactKeys(policy, [
    'schema_version',
    'platform',
    'android_build_tools_version',
    'repository_index',
    'archive',
    'installed_files_sha256',
  ])) throw new Error('Custodial Android Build Tools policy has unexpected top-level fields');
  if (
    policy.schema_version !== 1
    || policy.platform !== definition.platform
    || policy.android_build_tools_version !== CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION
    || policy.repository_index !== 'https://dl.google.com/android/repository/repository2-1.xml'
  ) throw new Error('Custodial Android Build Tools policy identity is malformed');
  if (!exactKeys(policy.archive, ['url', 'size_bytes', 'sha1', 'sha256'])) {
    throw new Error('Custodial Android Build Tools archive policy has unexpected fields');
  }
  if (
    policy.archive.url !== definition.archiveUrl
    || policy.archive.size_bytes !== definition.archiveSize
    || policy.archive.sha1 !== definition.archiveSha1
    || policy.archive.sha256 !== definition.archiveSha256
  ) throw new Error('Custodial Android Build Tools archive identity is malformed');
  if (!exactKeys(policy.installed_files_sha256, installedFileNames)) {
    throw new Error('Custodial Android Build Tools installed-file policy is incomplete');
  }
  for (const [name, digest] of Object.entries(policy.installed_files_sha256)) {
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`Custodial Android Build Tools digest is malformed: ${name}`);
    }
  }
  return true;
}

export function custodialAndroidToolchainPolicyForPlatform(platform = process.platform) {
  const normalizedPlatform = String(platform || '').trim();
  const definition = platformDefinitions[normalizedPlatform];
  if (!definition) {
    throw new Error(`Custodial Android verification does not support host platform ${normalizedPlatform || 'missing'}`);
  }
  const bytes = readFileSync(resolve(policyRoot, definition.policyFile));
  const policy = JSON.parse(bytes);
  assertCustodialAndroidToolchainPolicy(policy, normalizedPlatform);
  return deepFreeze({ ...policy, policy_file: definition.policyFile, sha256: sha256(bytes) });
}

