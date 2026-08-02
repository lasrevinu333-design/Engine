#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCompiledAndroidManifestMetadata,
  resolveAapt2,
  verifyAndroidApkBackupSecurity,
} from './verify-android-apk-backup.mjs';
import { managerNativeVaultSourceDigest } from './manager-native-vault-source.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const policyPath = resolve(mobileRoot, 'release-policies/manager-android.json');
const pluginRoot = resolve(mobileRoot, 'plugins/manager-native-vault');
const PACKAGE = 'org.memphiszoo.ops';
const MINIMUM_V2_ANDROID_API = 31;
const PLUGIN_PACKAGE = '@memphis-zoo/manager-native-vault';
const PLUGIN_CLASS = 'org.memphiszoo.manager.vault.ManagerNativeVaultPlugin';
const OLD_SECURE_STORAGE_PACKAGE = '@aparajita/capacitor-secure-storage';
const OLD_SECURE_STORAGE_CLASS = 'com.aparajita.capacitor.securestorage.SecureStorage';

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function command(binary, args, encoding = 'utf8') {
  return execFileSync(binary, args, {
    encoding,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function sdkTool(name) {
  const root = String(process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '').trim();
  const buildTools = root ? join(root, 'build-tools') : '';
  if (buildTools && existsSync(buildTools)) {
    for (const version of readdirSync(buildTools, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const candidate = join(buildTools, version, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  for (const directory of String(process.env.PATH || '').split(delimiter)) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Unable to locate ${name} for Manager APK verification`);
}

function regularApk(path) {
  const apk = resolve(String(path || ''));
  if (!path || !existsSync(apk) || !lstatSync(apk).isFile() || lstatSync(apk).isSymbolicLink()) {
    throw new Error('Manager APK verifier requires one regular APK path');
  }
  return apk;
}

function zipInventory(apk) {
  const names = String(command('unzip', ['-Z1', apk])).trim().split(/\r?\n/).filter(Boolean);
  const read = (name) => {
    const count = names.filter((candidate) => candidate === name).length;
    if (count !== 1) throw new Error(`Manager APK must contain ${name} exactly once; found ${count}`);
    return command('unzip', ['-p', apk, name], null);
  };
  return { names, read };
}

export function assertManagerNativeSecurityBoundary({
  pluginManifest,
  dexEntries,
  runtimeExecutableEntries,
  build,
} = {}) {
  const plugins = Array.isArray(pluginManifest) ? pluginManifest : pluginManifest?.plugins;
  if (!Array.isArray(plugins)) throw new Error('Manager APK Capacitor plugin manifest is malformed');
  const manager = plugins.filter((entry) => entry?.pkg === PLUGIN_PACKAGE && entry?.classpath === PLUGIN_CLASS);
  if (manager.length !== 1) throw new Error(`Manager APK must register ${PLUGIN_CLASS} exactly once`);
  if (plugins.some((entry) => entry?.pkg === OLD_SECURE_STORAGE_PACKAGE || entry?.classpath === OLD_SECURE_STORAGE_CLASS)) {
    throw new Error('Manager APK still registers the JavaScript-readable SecureStorage plugin');
  }
  const dex = Array.isArray(dexEntries) ? dexEntries : [];
  if (!dex.length) throw new Error('Manager APK has no DEX payload');
  const hasDexBytes = (needle) => dex.some((entry) => entry?.bytes?.includes(Buffer.from(needle)));
  if (!hasDexBytes(PLUGIN_CLASS.replaceAll('.', '/'))) throw new Error('Manager APK DEX does not contain the first-party native vault');
  if (hasDexBytes(OLD_SECURE_STORAGE_CLASS.replaceAll('.', '/'))) throw new Error('Manager APK DEX contains retired SecureStorage code');

  const runtime = Array.isArray(runtimeExecutableEntries) ? runtimeExecutableEntries : [];
  if (!runtime.length) throw new Error('Manager APK has no executable WebView runtime');
  const joined = runtime.map((entry) => entry.bytes.toString('utf8')).join('\n');
  if (!joined.includes('ManagerNativeVault')) throw new Error('Manager runtime does not invoke ManagerNativeVault');
  const prohibitedPatterns = [
    ['JavaScript-readable SecureStorage call', /SecureStorage[.](?:get|set|remove)\s*\(/],
    ['credential reader', /readDeviceCredential|readCredential\s*\(/],
    ['direct bearer construction', /Authorization\s*:\s*`Bearer|Authorization\s*:\s*["']Bearer|session[.]token/],
    ['direct device-credential header mutation', /headers[.](?:set|append)\s*\(\s*["']X-(?:Memphis-)?Device-Credential/i],
    ['plaintext auth storage', /(?:localStorage|sessionStorage)[.](?:getItem|setItem)\s*\([^)]*(?:credential|csrf|session_token|access_token)/i],
  ];
  for (const entry of runtime) {
    const source = entry.bytes.toString('utf8');
    for (const [label, pattern] of prohibitedPatterns) {
      if (pattern.test(source)) throw new Error(`Manager WebView runtime contains prohibited ${label} in ${entry.name}`);
    }
  }

  const expectedVaultHash = managerNativeVaultSourceDigest(pluginRoot);
  if (
    build?.edition !== 'manager'
    || build.manager_native_vault_source_sha256 !== expectedVaultHash
    || !/^[a-f0-9]{40}$/.test(String(build.source_commit || ''))
    || !/^[a-f0-9]{40}$/.test(String(build.source_tree || ''))
    || !String(build.build_id || '').includes(`.manager.${build.source_commit.slice(0, 12)}`)
    || !['manager-device-auth.v1.compatibility', 'manager-device-auth.v2'].includes(build.manager_native_auth_contract)
    || typeof build.manager_app_attestation_verified !== 'boolean'
  ) throw new Error('Manager APK build provenance does not match the exact native vault/source shape');
  return {
    plugin_class: PLUGIN_CLASS,
    native_vault_source_sha256: expectedVaultHash,
    source_commit: build.source_commit,
    source_tree: build.source_tree,
    source_commit_exact: build.source_commit_exact === true,
    build_id: build.build_id,
    native_build_number: build.native_build_number,
    manager_native_auth_contract: build.manager_native_auth_contract,
    manager_app_attestation_verified: build.manager_app_attestation_verified === true,
    runtime_executable_count: runtime.length,
  };
}

function assertNativeBoundary(apk) {
  const zip = zipInventory(apk);
  return assertManagerNativeSecurityBoundary({
    pluginManifest: JSON.parse(zip.read('assets/capacitor.plugins.json').toString('utf8')),
    dexEntries: zip.names
      .filter((name) => /^classes(?:\d+)?[.]dex$/.test(name))
      .map((name) => ({ name, bytes: zip.read(name) })),
    runtimeExecutableEntries: zip.names
      .filter((name) => /^assets\/public\/.+[.](?:html|js|mjs)$/.test(name))
      .sort()
      .map((name) => ({ name, bytes: zip.read(name) })),
    build: JSON.parse(zip.read('assets/public/build.json').toString('utf8')),
  });
}

function releasePolicy() {
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (policy?.schema_version !== 1 || policy.package_name !== PACKAGE) throw new Error('Manager Android release policy is malformed');
  const initialized = policy.status === 'initialized'
    && Number.isSafeInteger(policy.highest_fleet_version_code)
    && policy.minimum_next_version_code === policy.highest_fleet_version_code + 1
    && /^[a-f0-9]{64}$/.test(policy.fleet_signer_sha256 || '')
    && /^[a-f0-9]{64}$/.test(policy.fleet_signer_public_key_sha256 || '')
    && /^[a-f0-9]{64}$/.test(policy.fleet_baseline_apk_sha256 || '');
  return { policy, initialized };
}

function signerProof(apk) {
  const output = String(command(sdkTool('apksigner'), ['verify', '--verbose', '--print-certs', apk]));
  const certificate = output.match(/Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})/i)?.[1]?.toLowerCase();
  const publicKey = output.match(/Signer #1 public key SHA-256 digest:\s*([a-f0-9]{64})/i)?.[1]?.toLowerCase();
  if (!certificate || !publicKey || /DOES NOT VERIFY/i.test(output)) throw new Error('Manager APK signature proof is incomplete');
  return { certificate_sha256: certificate, public_key_sha256: publicKey };
}

export function verifyManagerAndroidRelease(apkPath, { structureOnly = false } = {}) {
  const apk = regularApk(apkPath);
  const aapt2 = resolveAapt2();
  const manifestDump = command(aapt2, ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml']);
  const metadata = parseCompiledAndroidManifestMetadata(manifestDump);
  if (
    metadata.package_name !== PACKAGE
    || metadata.debuggable
    || metadata.test_only
    || metadata.min_sdk_version < MINIMUM_V2_ANDROID_API
    || metadata.target_sdk_version !== 36
  ) {
    throw new Error('Manager APK package/debug/test/target-SDK policy failed');
  }
  command(sdkTool('zipalign'), ['-c', '4', apk]);
  const signature = signerProof(apk);
  const backup = verifyAndroidApkBackupSecurity(apk, { aapt2Path: aapt2 });
  const boundary = assertNativeBoundary(apk);
  if (!boundary.source_commit_exact || String(boundary.build_id).endsWith('.dirty')) {
    throw new Error('Manager release APK was not built from an exact clean source commit');
  }
  if (!Number.isSafeInteger(boundary.native_build_number) || boundary.native_build_number !== metadata.version_code) {
    throw new Error('Manager release APK native build provenance does not match versionCode');
  }
  const { policy, initialized } = releasePolicy();
  const attestationReady = policy.app_attestation?.status === 'initialized'
    && Boolean(policy.app_attestation.android_key_attestation)
    && Boolean(policy.app_attestation.play_integrity_policy_id)
    && boundary.manager_app_attestation_verified;
  const nativeAuthReady = boundary.manager_native_auth_contract === policy.required_native_auth_contract;
  const structural = {
    ok: true,
    apk_sha256: sha256(readFileSync(apk)),
    metadata,
    signature,
    backup_policy: backup.policy,
    ...boundary,
    production_release_gate_ready: initialized && attestationReady && nativeAuthReady,
    native_auth_contract_ready: nativeAuthReady,
    app_attestation_ready: attestationReady,
  };
  if (structureOnly) return structural;
  if (!nativeAuthReady) {
    throw new Error('MANAGER_NATIVE_AUTH_V2_REQUIRED: the APK still embeds the non-release v1 compatibility contract');
  }
  if (
    !attestationReady
  ) {
    throw new Error('MANAGER_APP_ATTESTATION_UNINITIALIZED: verified Android key attestation and Play Integrity policy are mandatory before Manager release');
  }
  if (!initialized) {
    throw new Error('MANAGER_PRODUCTION_BASELINE_UNINITIALIZED: independently verify and record the real Manager production signer and accepted baseline APK before release acceptance');
  }
  if (metadata.version_code < policy.minimum_next_version_code) throw new Error('Manager APK violates the anti-rollback version floor');
  if (signature.certificate_sha256 !== policy.fleet_signer_sha256 || signature.public_key_sha256 !== policy.fleet_signer_public_key_sha256) {
    throw new Error('Manager APK signer does not match the protected fleet signer policy');
  }
  return { ...structural, production_release_gate_ready: true, minimum_next_version_code: policy.minimum_next_version_code };
}

if (resolve(process.argv[1] || '') === scriptPath) {
  const structureOnly = process.argv.includes('--structure-only');
  const apk = process.argv.slice(2).find((value) => value !== '--structure-only');
  process.stdout.write(`${JSON.stringify(verifyManagerAndroidRelease(apk, { structureOnly }), null, 2)}\n`);
}
