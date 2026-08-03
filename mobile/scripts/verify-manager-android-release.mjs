#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCompiledAndroidApplicationMetadata,
  parseCompiledAndroidManifestMetadata,
  resolveAapt2,
  verifyAndroidApkBackupSecurity,
} from './verify-android-apk-backup.mjs';
import {
  managerNativeVaultSourceDigest,
  managerNativeVaultTrackedHeadState,
} from './manager-native-vault-source.mjs';
import { inspectManagerNativeVaultDexSemantics } from './verify-manager-dex-semantics.mjs';
import {
  MANAGER_PLAY_INTEGRITY_METADATA_NAME,
  MANAGER_PLAY_INTEGRITY_METADATA_PREFIX,
  canonicalManagerPlayIntegrityProjectNumber,
} from './configure-android-backup.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const repositoryRoot = resolve(mobileRoot, '..');
const policyPath = resolve(mobileRoot, 'release-policies/manager-android.json');
const pluginRoot = resolve(mobileRoot, 'plugins/manager-native-vault');
const PACKAGE = 'org.memphiszoo.ops';
const MINIMUM_V2_ANDROID_API = 31;
const PLUGIN_PACKAGE = '@memphis-zoo/manager-native-vault';
const PLUGIN_CLASS = 'org.memphiszoo.manager.vault.ManagerNativeVaultPlugin';
const OLD_SECURE_STORAGE_PACKAGE = '@aparajita/capacitor-secure-storage';
const OLD_SECURE_STORAGE_CLASS = 'com.aparajita.capacitor.securestorage.SecureStorage';
const BUNDLETOOL_VERSION = '1.18.1';
const BUNDLETOOL_SHA256 = '675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c';
const MANAGER_OWNED_RUNTIME = /^(?:assets\/public\/)?(?:memphis-mobile-bridge|mobile-manager|notifications-mobile|manager-access-mobile|moxie-mobile)[.]js$|^(?:assets\/public\/)?shell-assets\/manager-/;

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function command(binary, args, encoding = 'utf8', input = undefined) {
  return execFileSync(binary, args, {
    encoding,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    input,
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

function regularAndroidArtifact(path, expectedExtension) {
  const artifact = resolve(String(path || ''));
  if (!path || !existsSync(artifact) || !lstatSync(artifact).isFile() || lstatSync(artifact).isSymbolicLink()) {
    throw new Error(`Manager Android verifier requires one regular ${expectedExtension.toUpperCase()} path`);
  }
  if (extname(artifact).toLowerCase() !== expectedExtension) {
    throw new Error(`Manager Android verifier expected a ${expectedExtension} artifact`);
  }
  return artifact;
}

function zipInventory(artifact) {
  const names = String(command('unzip', ['-Z1', artifact])).trim().split(/\r?\n/).filter(Boolean);
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  if (duplicates.length) throw new Error(`Manager Android artifact contains duplicate ZIP entries: ${duplicates.join(', ')}`);
  const read = (name) => {
    const count = names.filter((candidate) => candidate === name).length;
    if (count !== 1) throw new Error(`Manager Android artifact must contain ${name} exactly once; found ${count}`);
    return command('unzip', ['-p', artifact, name], null);
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
  const dexSemantics = inspectManagerNativeVaultDexSemantics(dex);
  const hasDexBytes = (needle) => dex.some((entry) => entry?.bytes?.includes(Buffer.from(needle)));
  if (hasDexBytes(OLD_SECURE_STORAGE_CLASS.replaceAll('.', '/'))) {
    throw new Error('Manager APK DEX contains a retired SecureStorage class reference');
  }
  for (const marker of [
    '/mobile-auth-api/',
    '/manager-device-auth/enroll',
    '/manager-device-auth/recover',
    '/manager-device-auth/remove',
  ]) {
    if (hasDexBytes(marker)) throw new Error(`Manager APK DEX contains retired v1 native-auth route ${marker}`);
  }

  const runtime = Array.isArray(runtimeExecutableEntries) ? runtimeExecutableEntries : [];
  if (!runtime.length) throw new Error('Manager APK has no executable WebView runtime');
  const joined = runtime.map((entry) => entry.bytes.toString('utf8')).join('\n');
  if (!joined.includes('ManagerNativeVault')) throw new Error('Manager runtime does not invoke ManagerNativeVault');
  const globalProhibitedPatterns = [
    ['retired SecureStorage package', /@aparajita\/capacitor-secure-storage/],
    ['JavaScript-readable SecureStorage call', /SecureStorage[.](?:get|set|remove)\s*\(/],
    ['credential reader', /readDeviceCredential|readCredential\s*\(/],
    ['direct device-credential header mutation', /headers[.](?:set|append)\s*\(\s*["']X-(?:Memphis-)?Device-Credential/i],
    ['v1 Manager mobile-auth route', /\/mobile-auth-api\//],
    ['retired plaintext Manager credential key', /memphis_zoo_ops_device_credential/],
    ['retired WebView Manager session key', /mz_native_(?:session|device_credential_runtime)/],
    ['plaintext auth storage', /(?:localStorage|sessionStorage)[.](?:getItem|setItem)\s*\([^)]*(?:credential|csrf|session_token|access_token)/i],
  ];
  for (const entry of runtime) {
    const source = entry.bytes.toString('utf8');
    for (const [label, pattern] of globalProhibitedPatterns) {
      if (pattern.test(source)) throw new Error(`Manager WebView runtime contains prohibited ${label} in ${entry.name}`);
    }
    if (MANAGER_OWNED_RUNTIME.test(entry.name)
        && (/Authorization\s*:\s*[`"']Bearer/.test(source) || /session[.]token/.test(source))) {
      throw new Error(`Manager-owned WebView runtime constructs a bearer token in ${entry.name}`);
    }
  }
  const managerRuntime = runtime
    .filter((entry) => MANAGER_OWNED_RUNTIME.test(entry.name))
    .map((entry) => entry.bytes.toString('utf8')).join('\n');
  for (const marker of ['ManagerNativeVault', 'authorizedRequest', 'manager-device-auth.v2']) {
    if (!managerRuntime.includes(marker)) throw new Error(`Manager WebView native boundary marker is missing: ${marker}`);
  }

  const expectedVaultHash = managerNativeVaultSourceDigest(pluginRoot);
  const configuredProjectNumber = build?.manager_play_integrity_cloud_project_number == null
    ? null
    : canonicalManagerPlayIntegrityProjectNumber(
      build.manager_play_integrity_cloud_project_number,
    );
  if (
    build?.edition !== 'manager'
    || build.manager_native_vault_source_sha256 !== expectedVaultHash
    || !/^[a-f0-9]{40}$/.test(String(build.source_commit || ''))
    || !/^[a-f0-9]{40}$/.test(String(build.source_tree || ''))
    || !String(build.build_id || '').includes(`.manager.${build.source_commit.slice(0, 12)}`)
    || build.manager_native_auth_contract !== 'manager-device-auth.v2'
    || typeof build.manager_play_integrity_configuration_embedded !== 'boolean'
    || build.manager_play_integrity_configuration_embedded !== (configuredProjectNumber !== null)
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
    manager_play_integrity_cloud_project_number: configuredProjectNumber,
    manager_play_integrity_configuration_embedded:
      build.manager_play_integrity_configuration_embedded === true,
    runtime_executable_count: runtime.length,
    ...dexSemantics,
  };
}

function assertNativeBoundary(artifact, prefix = '', dexDirectory = '') {
  const zip = zipInventory(artifact);
  const entry = (name) => `${prefix}${name}`;
  const dexPrefix = `${prefix}${dexDirectory}`;
  return assertManagerNativeSecurityBoundary({
    pluginManifest: JSON.parse(zip.read(entry('assets/capacitor.plugins.json')).toString('utf8')),
    dexEntries: zip.names
      .filter((name) => name.startsWith(dexPrefix) && /^classes(?:\d+)?[.]dex$/.test(name.slice(dexPrefix.length)))
      .sort()
      .map((name) => ({ name: name.slice(dexPrefix.length), bytes: zip.read(name) })),
    runtimeExecutableEntries: zip.names
      .filter((name) => name.startsWith(prefix) && /^assets\/public\/.+[.](?:html|js|mjs)$/.test(name.slice(prefix.length)))
      .sort()
      .map((name) => ({ name: name.slice(prefix.length), bytes: zip.read(name) })),
    build: JSON.parse(zip.read(entry('assets/public/build.json')).toString('utf8')),
  });
}

function releasePolicy() {
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (policy?.schema_version !== 1 || policy.package_name !== PACKAGE) throw new Error('Manager Android release policy is malformed');
  const versionInitialized = Number.isSafeInteger(policy.highest_fleet_version_code)
    && policy.minimum_next_version_code === policy.highest_fleet_version_code + 1
    && policy.highest_fleet_version_code >= 1;
  const fleetSignerInitialized = /^[a-f0-9]{64}$/.test(policy.fleet_signer_sha256 || '')
    && /^[a-f0-9]{64}$/.test(policy.fleet_signer_public_key_sha256 || '')
    && /^[a-f0-9]{64}$/.test(policy.fleet_baseline_apk_sha256 || '');
  const uploadSignerInitialized = /^[a-f0-9]{64}$/.test(policy.play_upload_signer_sha256 || '')
    && /^[a-f0-9]{64}$/.test(policy.play_upload_signer_public_key_sha256 || '')
    && /^[a-f0-9]{64}$/.test(policy.play_baseline_aab_sha256 || '');
  const initialized = policy.status === 'initialized'
    && versionInitialized
    && fleetSignerInitialized
    && uploadSignerInitialized;
  return { policy, initialized, versionInitialized, fleetSignerInitialized, uploadSignerInitialized };
}

function signerProof(apk) {
  const output = String(command(sdkTool('apksigner'), ['verify', '--verbose', '--print-certs', apk]));
  const certificate = output.match(/Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})/i)?.[1]?.toLowerCase();
  const publicKey = output.match(/Signer #1 public key SHA-256 digest:\s*([a-f0-9]{64})/i)?.[1]?.toLowerCase();
  if (!certificate || !publicKey || /DOES NOT VERIFY/i.test(output)) throw new Error('Manager APK signature proof is incomplete');
  return { certificate_sha256: certificate, public_key_sha256: publicKey };
}

export function resolvePinnedBundletool() {
  const configured = String(process.env.BUNDLETOOL_JAR || '').trim();
  if (!configured) {
    throw new Error(`BUNDLETOOL_JAR must name the independently provisioned bundletool ${BUNDLETOOL_VERSION} standalone JAR`);
  }
  const bundletool = resolve(configured);
  if (!existsSync(bundletool) || !lstatSync(bundletool).isFile() || lstatSync(bundletool).isSymbolicLink()) {
    throw new Error('BUNDLETOOL_JAR must be a regular non-symlink file');
  }
  const digest = sha256(readFileSync(bundletool));
  if (digest !== BUNDLETOOL_SHA256) {
    throw new Error(`BUNDLETOOL_JAR SHA-256 mismatch: expected ${BUNDLETOOL_SHA256}, received ${digest}`);
  }
  const version = String(command('java', ['-jar', bundletool, 'version'])).trim();
  if (version !== BUNDLETOOL_VERSION) {
    throw new Error(`BUNDLETOOL_JAR version mismatch: expected ${BUNDLETOOL_VERSION}, received ${version || '<empty>'}`);
  }
  return { path: bundletool, version, sha256: digest };
}

function bundleSignerProof(aab) {
  const zip = zipInventory(aab);
  const signerBlocks = zip.names.filter((name) => /^META-INF\/[^/]+[.](?:RSA|DSA|EC)$/.test(name));
  if (signerBlocks.length !== 1) {
    throw new Error(`Manager AAB must contain exactly one JAR signer block; found ${signerBlocks.length}`);
  }
  const verification = String(command('jarsigner', ['-verify', '-verbose', '-certs', aab]));
  if (!/\bjar verified[.]\s*$/im.test(verification)
      || /jar is unsigned|unsigned entries|signature-related files are not signed/i.test(verification)) {
    throw new Error('Manager AAB JAR signature proof is incomplete');
  }
  const certificateDump = String(command(
    'openssl',
    ['pkcs7', '-inform', 'DER', '-print_certs'],
    'utf8',
    zip.read(signerBlocks[0]),
  ));
  const certificates = certificateDump.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  if (!certificates.length) throw new Error('Manager AAB signer block contains no X.509 certificate');
  const certificate = new X509Certificate(certificates[0]);
  const publicKey = certificate.publicKey.export({ format: 'der', type: 'spki' });
  return {
    certificate_sha256: sha256(certificate.raw),
    public_key_sha256: sha256(publicKey),
    certificate_chain_length: certificates.length,
    signature_block: signerBlocks[0],
  };
}

function withUniversalApk(aab, callback) {
  const bundletool = resolvePinnedBundletool();
  const work = mkdtempSync(join(tmpdir(), 'memphis-manager-aab-verify-'));
  const keystore = join(work, 'temporary-verifier.p12');
  const apks = join(work, 'universal.apks');
  const apk = join(work, 'universal.apk');
  const password = randomBytes(32).toString('hex');
  try {
    command('keytool', [
      '-genkeypair',
      '-keystore', keystore,
      '-storetype', 'PKCS12',
      '-storepass', password,
      '-keypass', password,
      '-alias', 'temporary-verifier',
      '-keyalg', 'RSA',
      '-keysize', '3072',
      '-validity', '2',
      '-dname', 'CN=Temporary Manager AAB Verifier',
      '-noprompt',
    ]);
    command('java', [
      '-jar', bundletool.path,
      'build-apks',
      `--bundle=${aab}`,
      `--output=${apks}`,
      '--mode=universal',
      `--ks=${keystore}`,
      '--ks-key-alias=temporary-verifier',
      `--ks-pass=pass:${password}`,
      `--key-pass=pass:${password}`,
    ]);
    const archive = zipInventory(apks);
    writeFileSync(apk, archive.read('universal.apk'), { mode: 0o600 });
    return { result: callback(apk), bundletool };
  } finally {
    rmSync(work, { force: true, recursive: true });
  }
}

function inspectCompiledApk(apk, label) {
  const aapt2 = resolveAapt2();
  const manifestDump = command(aapt2, ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml']);
  const metadata = {
    ...parseCompiledAndroidManifestMetadata(manifestDump),
    application_metadata: parseCompiledAndroidApplicationMetadata(manifestDump),
  };
  if (
    metadata.package_name !== PACKAGE
    || metadata.debuggable
    || metadata.test_only
    || metadata.min_sdk_version < MINIMUM_V2_ANDROID_API
    || metadata.target_sdk_version !== 36
  ) {
    throw new Error(`Manager ${label} package/debug/test/target-SDK policy failed`);
  }
  command(sdkTool('zipalign'), ['-c', '4', apk]);
  const backup = verifyAndroidApkBackupSecurity(apk, { aapt2Path: aapt2 });
  return { metadata, backup };
}

export function managerPlayIntegrityManifestProof({ metadata, boundary, policy } = {}) {
  let policyProjectNumber = null;
  try {
    if (policy?.app_attestation?.play_integrity_cloud_project_number != null) {
      policyProjectNumber = canonicalManagerPlayIntegrityProjectNumber(
        policy.app_attestation.play_integrity_cloud_project_number,
      );
    }
  } catch {
    policyProjectNumber = null;
  }
  const compiledProjectMetadata = String(
    metadata?.application_metadata?.[MANAGER_PLAY_INTEGRITY_METADATA_NAME] || '',
  );
  const ready = policyProjectNumber !== null
    && boundary?.manager_play_integrity_configuration_embedded === true
    && boundary?.manager_play_integrity_cloud_project_number === policyProjectNumber
    && compiledProjectMetadata
      === `${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${policyProjectNumber}`;
  return Object.freeze({
    ready,
    policy_project_number: policyProjectNumber,
    compiled_metadata: compiledProjectMetadata,
  });
}

function finalizeReleaseProof({ artifact, artifactType, metadata, signature, backup, boundary, bundletool }, structureOnly) {
  if (!boundary.source_commit_exact || String(boundary.build_id).endsWith('.dirty')) {
    throw new Error(`Manager release ${artifactType.toUpperCase()} was not built from an exact clean source commit`);
  }
  if (!Number.isSafeInteger(boundary.native_build_number) || boundary.native_build_number !== metadata.version_code) {
    throw new Error(`Manager release ${artifactType.toUpperCase()} native build provenance does not match versionCode`);
  }
  const nativeSourceState = managerNativeVaultTrackedHeadState(pluginRoot, {
    repositoryRoot,
    revision: boundary.source_commit,
  });
  if (!nativeSourceState.tracked_head_exact) {
    throw new Error(
      `Manager release ${artifactType.toUpperCase()} native source inventory is not the exact tracked source at ${boundary.source_commit}`,
    );
  }
  const {
    policy,
    initialized,
    versionInitialized,
    fleetSignerInitialized,
    uploadSignerInitialized,
  } = releasePolicy();
  const playIntegrityManifest = managerPlayIntegrityManifestProof({
    metadata, boundary, policy,
  });
  const playIntegrityManifestReady = playIntegrityManifest.ready;
  const attestationReady = policy.app_attestation?.status === 'initialized'
    && Boolean(policy.app_attestation.android_hardware_backed_keyinfo_policy)
    && playIntegrityManifestReady
    && Boolean(policy.app_attestation.play_integrity_policy_id)
    && boundary.manager_play_integrity_configuration_embedded;
  const nativeAuthReady = boundary.manager_native_auth_contract === policy.required_native_auth_contract;
  const structural = {
    ok: true,
    artifact_type: artifactType,
    artifact_sha256: sha256(readFileSync(artifact)),
    ...(artifactType === 'apk'
      ? { apk_sha256: sha256(readFileSync(artifact)) }
      : { aab_sha256: sha256(readFileSync(artifact)) }),
    metadata,
    signature,
    backup_policy: backup.policy,
    ...boundary,
    ...(bundletool ? {
      bundletool_version: bundletool.version,
      bundletool_sha256: bundletool.sha256,
    } : {}),
    production_release_gate_ready: initialized && attestationReady && nativeAuthReady,
    native_auth_contract_ready: nativeAuthReady,
    app_attestation_ready: attestationReady,
    play_integrity_manifest_metadata_ready: playIntegrityManifestReady,
    compiled_play_integrity_metadata: playIntegrityManifest.compiled_metadata,
    version_policy_ready: versionInitialized,
    fleet_signer_policy_ready: fleetSignerInitialized,
    play_upload_signer_policy_ready: uploadSignerInitialized,
  };
  if (structureOnly) return structural;
  if (!nativeAuthReady) {
    throw new Error('MANAGER_NATIVE_AUTH_V2_REQUIRED: the APK still embeds the non-release v1 compatibility contract');
  }
  if (
    !attestationReady
  ) {
    throw new Error('MANAGER_APP_ATTESTATION_UNINITIALIZED: locally enforced AndroidKeyStore hardware-backing policy and Play Integrity policy are mandatory before Manager release');
  }
  if (!initialized) {
    throw new Error('MANAGER_PRODUCTION_BASELINE_UNINITIALIZED: independently verify and record the Play app-signing signer, Play upload signer, accepted baseline APK/AAB, and version floor before release acceptance');
  }
  if (metadata.version_code < policy.minimum_next_version_code) throw new Error(`Manager ${artifactType.toUpperCase()} violates the anti-rollback version floor`);
  const expectedSigner = artifactType === 'aab'
    ? {
      certificate_sha256: policy.play_upload_signer_sha256,
      public_key_sha256: policy.play_upload_signer_public_key_sha256,
      label: 'Play upload',
    }
    : {
      certificate_sha256: policy.fleet_signer_sha256,
      public_key_sha256: policy.fleet_signer_public_key_sha256,
      label: 'fleet app-signing',
    };
  if (signature.certificate_sha256 !== expectedSigner.certificate_sha256
      || signature.public_key_sha256 !== expectedSigner.public_key_sha256) {
    throw new Error(`Manager ${artifactType.toUpperCase()} signer does not match the protected ${expectedSigner.label} signer policy`);
  }
  return { ...structural, production_release_gate_ready: true, minimum_next_version_code: policy.minimum_next_version_code };
}

export function verifyManagerAndroidRelease(apkPath, { structureOnly = false } = {}) {
  const apk = regularAndroidArtifact(apkPath, '.apk');
  const { metadata, backup } = inspectCompiledApk(apk, 'APK');
  return finalizeReleaseProof({
    artifact: apk,
    artifactType: 'apk',
    metadata,
    signature: signerProof(apk),
    backup,
    boundary: assertNativeBoundary(apk),
  }, structureOnly);
}

export function verifyManagerAndroidBundle(aabPath, { structureOnly = false } = {}) {
  const aab = regularAndroidArtifact(aabPath, '.aab');
  const boundary = assertNativeBoundary(aab, 'base/', 'dex/');
  const signature = bundleSignerProof(aab);
  const universal = withUniversalApk(aab, (apk) => {
    const compiled = inspectCompiledApk(apk, 'AAB universal APK');
    const derivedBoundary = assertNativeBoundary(apk);
    for (const key of [
      'source_commit',
      'source_tree',
      'build_id',
      'native_build_number',
      'native_vault_source_sha256',
      'manager_native_auth_contract',
    ]) {
      if (derivedBoundary[key] !== boundary[key]) {
        throw new Error(`Manager AAB universal APK boundary differs from the base module: ${key}`);
      }
    }
    return compiled;
  });
  return finalizeReleaseProof({
    artifact: aab,
    artifactType: 'aab',
    metadata: universal.result.metadata,
    signature,
    backup: universal.result.backup,
    boundary,
    bundletool: universal.bundletool,
  }, structureOnly);
}

if (resolve(process.argv[1] || '') === scriptPath) {
  const structureOnly = process.argv.includes('--structure-only');
  const artifact = process.argv.slice(2).find((value) => value !== '--structure-only');
  const verifier = extname(String(artifact || '')).toLowerCase() === '.aab'
    ? verifyManagerAndroidBundle
    : verifyManagerAndroidRelease;
  process.stdout.write(`${JSON.stringify(verifier(artifact, { structureOnly }), null, 2)}\n`);
}
