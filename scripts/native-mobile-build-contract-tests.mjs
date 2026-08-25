import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CUSTODIAL_ANDROID_RELEASE_POLICY as CONFIGURE_CUSTODIAL_ANDROID_RELEASE_POLICY,
  assertEditionBuildFloor,
  configureGradleWrapperSource,
  configureAndroidVariablesSource,
  configureIosProjectSource,
  injectAndroidOverlay,
  inspectGradleVerificationMetadata,
  loadCustodialRollbackBaseline,
  resolveBuildNumber,
  resolveReleaseVersion,
  validateGradleVerificationMetadata,
  validateGradleWrapperJar,
  validateSwiftLock,
} from '../mobile/scripts/configure-native-release.mjs';
import {
  configureAndroidMainActivitySource,
  configureAndroidManifestSource,
  configureIosInfoPlistSource,
} from '../mobile/scripts/configure-native-links.mjs';
import {
  androidBackupDomains,
  assertAndroidBackupManifestSecurity,
  assertAndroidBackupRulesSecurity,
  configureAndroidBackupManifestSource,
  dataExtractionRules,
  legacyBackupRules,
} from '../mobile/scripts/configure-android-backup.mjs';
import {
  ANDROID_BACKUP_VERIFIER_VERSION,
  assertCompiledAndroidBackupSecurity,
} from '../mobile/scripts/verify-android-apk-backup.mjs';
import {
  CUSTODIAL_ACCEPTANCE_SCHEMA_ID,
  CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION,
  CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION,
  CUSTODIAL_ANDROID_RELEASE_POLICY,
  CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION,
  CUSTODIAL_ANDROID_TOOLCHAIN_POLICY,
  CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256,
  CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256,
  CUSTODIAL_CAPACITOR_PLUGIN_PAIRS,
  CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION,
  CUSTODIAL_CODEMAGIC_WORKFLOW,
  CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION,
  CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS,
  CUSTODIAL_FORWARD_RECOVERY_BRANCH,
  CUSTODIAL_FORWARD_RECOVERY_REF,
  CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE,
  CUSTODIAL_NODE_VERSION,
  CUSTODIAL_NATIVE_VAULT_CLASS,
  CUSTODIAL_NATIVE_VAULT_PACKAGE,
  CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS,
  CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  CUSTODIAL_OLD_SECURE_STORAGE_CLASS,
  CUSTODIAL_PACKAGE_NAME,
  CUSTODIAL_RELEASE_BACKUP_DOMAINS,
  CUSTODIAL_SIGNER_SHA256,
  CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256,
  CUSTODIAL_TARGET_SDK_VERSION,
  assertCustodialAcceptanceSchema,
  assertCustodialReleaseManifest,
  assertCustodialNativeSecurityBoundary,
  assertEmbeddedCustodialProvenance,
  assertEmbeddedRuntimeAssets,
  assertZipalignVerification,
  createCustodialAndroidReleaseAcceptance,
  normalizeCustodialSourceRef,
  parseEmbeddedBuildIdentity,
  requiresCustodialStagedRecoveryCeiling,
  resolveCustodialRuntimeDirectory,
  singleApkEntry,
  successfulToolVersion,
} from '../mobile/scripts/verify-custodial-android-release.mjs';
import {
  CUSTODIAL_CAPACITOR_CONFIG,
} from '../mobile/scripts/custodial-capacitor-runtime-policy.mjs';
import { custodialAndroidToolchainPolicyForPlatform } from '../mobile/scripts/custodial-android-toolchain-policy.mjs';
import { custodialNativeVaultSourceDigest } from '../mobile/scripts/custodial-native-vault-source.mjs';
import { unzip as unzipApkEntry } from '../mobile/scripts/verify-custodial-native-boundary-apk.mjs';
import './canonical-temporary-fixture-tests.mjs';
import './custodial-dex-semantic-verifier-tests.mjs';
import './custodial-runtime-source-verifier-tests.mjs';
import './immutable-file-snapshot-tests.mjs';
import {
  custodialAndroidManifestSecurityProofFixture,
} from './custodial-android-manifest-security-contract-tests.mjs';

function uleb128(value) {
  const bytes = [];
  let remaining = value;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  return Buffer.from(bytes);
}

function dexFixture(classDescriptors) {
  const descriptors = [...new Set(classDescriptors.map(String))];
  const headerSize = 112;
  const stringIdsOffset = headerSize;
  const typeIdsOffset = stringIdsOffset + (descriptors.length * 4);
  const classDefsOffset = typeIdsOffset + (descriptors.length * 4);
  const stringDataOffset = classDefsOffset + (descriptors.length * 32);
  const stringData = descriptors.map((descriptor) => Buffer.concat([
    uleb128(descriptor.length),
    Buffer.from(descriptor, 'utf8'),
    Buffer.from([0]),
  ]));
  const totalSize = stringDataOffset + stringData.reduce((sum, bytes) => sum + bytes.length, 0);
  const dex = Buffer.alloc(totalSize);
  dex.write('dex\n035\0', 0, 'latin1');
  dex.writeUInt32LE(totalSize, 32);
  dex.writeUInt32LE(headerSize, 36);
  dex.writeUInt32LE(0x12345678, 40);
  dex.writeUInt32LE(descriptors.length, 56);
  dex.writeUInt32LE(stringIdsOffset, 60);
  dex.writeUInt32LE(descriptors.length, 64);
  dex.writeUInt32LE(typeIdsOffset, 68);
  dex.writeUInt32LE(descriptors.length, 96);
  dex.writeUInt32LE(classDefsOffset, 100);
  dex.writeUInt32LE(totalSize - stringDataOffset, 104);
  dex.writeUInt32LE(stringDataOffset, 108);
  let cursor = stringDataOffset;
  for (let index = 0; index < descriptors.length; index += 1) {
    dex.writeUInt32LE(cursor, stringIdsOffset + (index * 4));
    dex.writeUInt32LE(index, typeIdsOffset + (index * 4));
    dex.writeUInt32LE(index, classDefsOffset + (index * 32));
    stringData[index].copy(dex, cursor);
    cursor += stringData[index].length;
  }
  return dex;
}

const nonUtf8ArchiveBytes = Buffer.from([0x64, 0x65, 0x78, 0x0a, 0xff, 0xfe, 0x00, 0x80]);
let observedBinaryEncoding = 'not-called';
const binaryArchiveOutput = unzipApkEntry(
  ['-p', 'fixture.apk', 'classes.dex'],
  { encoding: null },
  (command, args, options) => {
    assert.equal(command, 'unzip');
    assert.deepEqual(args, ['-p', 'fixture.apk', 'classes.dex']);
    observedBinaryEncoding = options.encoding;
    return options.encoding === null
      ? Buffer.from(nonUtf8ArchiveBytes)
      : nonUtf8ArchiveBytes.toString(options.encoding);
  },
);
assert.equal(observedBinaryEncoding, null, 'explicit null must reach execFileSync unchanged');
assert.ok(Buffer.isBuffer(binaryArchiveOutput), 'binary unzip output must remain a Buffer');
assert.deepEqual(binaryArchiveOutput, nonUtf8ArchiveBytes, 'non-UTF8 archive bytes must remain exact');
let observedTextEncoding = null;
assert.equal(
  unzipApkEntry(['-Z1', 'fixture.apk'], {}, (_command, _args, options) => {
    observedTextEncoding = options.encoding;
    return 'classes.dex\n';
  }),
  'classes.dex\n',
);
assert.equal(observedTextEncoding, 'utf8', 'omitted encoding must retain the text default');

const vaultDigestFixtureRoot = await mkdtemp(join(tmpdir(), 'custodial-vault-source-'));
try {
  await mkdir(join(vaultDigestFixtureRoot, 'dist', 'esm'), { recursive: true });
  await mkdir(join(vaultDigestFixtureRoot, 'android', 'src', 'main'), { recursive: true });
  for (const [path, bytes] of [
    ['package.json', '{"name":"fixture"}\n'],
    ['dist/esm/index.js', 'export const vault = true;\n'],
    ['dist/esm/index.d.ts', 'export declare const vault: boolean;\n'],
    ['dist/plugin.cjs', 'exports.vault = true;\n'],
    ['android/build.gradle', 'apply plugin: "com.android.library"\n'],
    ['android/gradle.properties', 'org.gradle.jvmargs=-Xmx512m\n'],
    ['android/settings.gradle', 'rootProject.name = "fixture"\n'],
    ['android/src/main/AndroidManifest.xml', '<manifest />\n'],
    ['android/src/main/Vault.java', 'final class Vault {}\n'],
  ]) await writeFile(join(vaultDigestFixtureRoot, path), bytes);
  const sourceDigest = custodialNativeVaultSourceDigest(vaultDigestFixtureRoot);
  await mkdir(join(vaultDigestFixtureRoot, 'android', 'build', 'generated'), { recursive: true });
  await mkdir(join(vaultDigestFixtureRoot, 'android', '.gradle'), { recursive: true });
  await writeFile(join(vaultDigestFixtureRoot, 'android', 'build', 'generated', 'intermediate.bin'), 'generated');
  await writeFile(join(vaultDigestFixtureRoot, 'android', '.gradle', 'cache.bin'), 'generated');
  assert.equal(
    custodialNativeVaultSourceDigest(vaultDigestFixtureRoot),
    sourceDigest,
    'Gradle intermediates must not change native-vault source provenance',
  );
  await writeFile(join(vaultDigestFixtureRoot, 'android', 'src', 'main', 'Vault.java'), 'final class Vault { int changed; }\n');
  assert.notEqual(
    custodialNativeVaultSourceDigest(vaultDigestFixtureRoot),
    sourceDigest,
    'A native source change must change native-vault provenance',
  );
} finally {
  await rm(vaultDigestFixtureRoot, { recursive: true, force: true });
}

const runtimeDirectoryFixtureRoot = await realpath(await mkdtemp(join(tmpdir(), 'custodial-runtime-directory-')));
try {
  const runtimeDirectory = join(runtimeDirectoryFixtureRoot, 'runtime');
  const runtimeSymlink = join(runtimeDirectoryFixtureRoot, 'runtime-link');
  const runtimeFile = join(runtimeDirectoryFixtureRoot, 'runtime-file');
  const realParent = join(runtimeDirectoryFixtureRoot, 'real-parent');
  const parentSymlink = join(runtimeDirectoryFixtureRoot, 'parent-link');
  await mkdir(runtimeDirectory);
  await mkdir(join(realParent, 'runtime'), { recursive: true });
  await writeFile(runtimeFile, 'not a directory\n');
  await symlink(runtimeDirectory, runtimeSymlink, 'dir');
  await symlink(realParent, parentSymlink, 'dir');
  assert.ok(
    resolveCustodialRuntimeDirectory(runtimeDirectory).endsWith('/runtime'),
    'the verifier must accept an existing real runtime directory',
  );
  assert.throws(
    () => resolveCustodialRuntimeDirectory(runtimeSymlink),
    /real non-symlink directory/,
    'the verifier must reject a symlink substituted for its clean runtime',
  );
  assert.throws(
    () => resolveCustodialRuntimeDirectory(runtimeFile),
    /real non-symlink directory/,
    'the verifier must reject a regular file substituted for its clean runtime',
  );
  assert.throws(
    () => resolveCustodialRuntimeDirectory(join(parentSymlink, 'runtime')),
    /must not traverse a symlink/,
    'the verifier must reject a runtime reached through a symlinked parent',
  );
  assert.throws(
    () => resolveCustodialRuntimeDirectory(join(runtimeDirectoryFixtureRoot, 'missing')),
    /must exist/,
    'the verifier must reject a missing clean runtime',
  );
} finally {
  await rm(runtimeDirectoryFixtureRoot, { recursive: true, force: true });
}

const [
  configScript,
  brandingScript,
  nativeLinksScript,
  androidBackupScript,
  apkBackupVerifier,
  custodialReleaseVerifier,
  custodialAcceptanceSchema,
  custodialNativeVaultPlugin,
  nativeReleaseScript,
  androidVersionOverlay,
  androidReleaseOverlay,
  custodialReleasePolicy,
  custodialBuild22Rollback,
  custodialBuild25Rollback,
  custodialBuild27Rollback,
  custodialBuild29Rollback,
  custodialBuild27Candidate,
  custodialToolchainPolicy,
  workflow,
  codemagic,
  capacitorConfig,
  mobilePackage,
  managerLockBytes,
  viewerLockBytes,
  managerAndroidFirebaseDigest,
  managerIosFirebaseDigest,
  custodialAndroidFirebaseDigest,
  managerAndroidVerificationBytes,
  custodialAndroidVerificationBytes,
  viewerAndroidVerificationBytes,
] = await Promise.all([
  readFile(new URL('../mobile/scripts/configure-firebase.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-branding.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-native-links.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-android-backup.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/verify-android-apk-backup.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/verify-custodial-android-release.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/custodial-android-release-acceptance.schema.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialNativeVaultPlugin.java', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-native-release.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/native-version.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/codemagic-release.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-android.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-build22-rollback.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-build25-rollback.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-build27-rollback.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-build29-rollback.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-build27-candidate.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-android-build-tools-35.0.1-macos.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/android-test-apks.yml', import.meta.url), 'utf8'),
  readFile(new URL('../codemagic.yaml', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/package.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/manager/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/viewer/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/manager-android.sha256', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/manager-ios.sha256', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/custodial-android.sha256', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/android/manager/verification-metadata.xml', import.meta.url)),
  readFile(new URL('../mobile/native-locks/android/custodial/verification-metadata.xml', import.meta.url)),
  readFile(new URL('../mobile/native-locks/android/viewer/verification-metadata.xml', import.meta.url)),
]);
const acceptedBuild22Worker = await readFile(new URL('../tests/fixtures/build22-memphis-scan-sync.js', import.meta.url), 'utf8');
const actualNativeVaultPluginMethods = [
  ...custodialNativeVaultPlugin.matchAll(/@PluginMethod\s+public void (\w+)\s*\(/g),
].map((match) => match[1]).sort();
assert.deepEqual(
  actualNativeVaultPluginMethods,
  CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS,
  'compiled release admission must require every WebView-exposed native vault method',
);
assert.match(configScript, /manager-notifications-api\/client-config/);
assert.match(configScript, /manager: 'org\.memphiszoo\.ops'/);
assert.match(configScript, /custodial: 'org\.memphiszoo\.custodial'/);
assert.match(configScript, /if \(!appIdentifier\)/);
assert.doesNotMatch(configScript, /FIREBASE_SERVICE_ACCOUNT_JSON|private_key|client_email/);
assert.match(configScript, /MZ_REQUIRE_PINNED_FIREBASE_CONFIG/);
assert.match(configScript, /createHash\('sha256'\)/);
assert.match(configScript, /\$\{edition\}-firebase-\$\{platform\}\.json/);
assert.match(configScript, /client configuration digest mismatch/);
assert.match(managerAndroidFirebaseDigest.trim(), /^[a-f0-9]{64}\s+google-services\.json$/);
assert.match(managerIosFirebaseDigest.trim(), /^[a-f0-9]{64}\s+GoogleService-Info\.plist$/);
assert.match(custodialAndroidFirebaseDigest.trim(), /^[a-f0-9]{64}\s+google-services\.json$/);
for (const text of ['manager','custodial','viewer','org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer','assembleDebug']) assert.ok(workflow.includes(text), `Android APK workflow missing ${text}`);
assert.match(
  workflow,
  /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a\s+#\s+v7\.0\.1/,
  'Android APK workflow must use the verified upload-artifact v7.0.1 commit',
);
for (const artifact of ['memphis-zoo-ops-debug','memphis-zoo-custodial-debug','memphis-zoo-viewer-debug']) assert.match(workflow, new RegExp(artifact));
assert.match(workflow, /configure-branding\.mjs/);
assert.match(workflow, /configure-native-links\.mjs android/);
assert.match(workflow, /configure-android-backup\.mjs/);
assert.match(workflow, /verify-android-apk-backup\.mjs/);
assert.match(workflow, /native-mobile-build-contract-tests\.mjs/);
assert.match(workflow, /configure-native-release\.mjs android/);
assert.match(workflow, /configure-native-release\.mjs android-version/);
assert.match(workflow, /compiled-debug\.json/);
assert.match(workflow, /Debug APK compiled versionCode mismatch/);
assert.match(workflow, /assembleRelease bundleRelease/);
assert.match(workflow, /--dependency-verification strict assembleDebug/);
assert.match(workflow, /--dependency-verification strict assembleRelease bundleRelease/);
assert.match(workflow, /gradle-strict-debug-\$MZ_APP_EDITION/);
assert.match(workflow, /gradle-strict-release-\$MZ_APP_EDITION/);
assert.equal(
  [...workflow.matchAll(/--no-build-cache --rerun-tasks/g)].length,
  2,
  'debug and release Android proofs must bypass task and build caches',
);
assert.doesNotMatch(
  workflow,
  /--write-verification-metadata|--dependency-verification (?:lenient|off)/,
  'release workflows must never generate or weaken reviewed dependency trust metadata',
);
assert.match(workflow, /native-locks\/android\/\$MZ_APP_EDITION\/verification-metadata\.xml/);
assert.match(workflow, /7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172/);
assert.match(workflow, /apksigner.*verify --verbose --print-certs/s);
assert.match(workflow, /jarsigner -verify/);
assert.match(workflow, /test-signed-release-path\.json/);
assert.match(workflow, /EPHEMERAL-TEST-ONLY-compiled-proof\.json/);
assert.match(workflow, /production_signer_accepted: false/);
assert.match(workflow, /if \(manifest\.includes\('memphiszoo\.custodial\.NFC_SCAN'\)\)/);
assert.match(workflow, /Retired forgeable Custodial NFC compatibility action is present/);
assert.match(workflow, /MZ_SHELL_START:\s*'1'/);
assert.match(workflow, /config\.server\?\.appStartPath !== '\/app-shell\.html'/);
assert.match(workflow, /graph\.shell_proof !== true/);
assert.match(workflow, /assets\/public\/app-shell\.html/);
assert.match(workflow, /retention-days: 30/);
assert.doesNotMatch(workflow, /FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_SERVICES_JSON_B64|private_key/);
assert.match(brandingScript, /ic_launcher_foreground/);
assert.doesNotMatch(brandingScript, /memphiszoo\.custodial\.NFC_SCAN/);
assert.doesNotMatch(nativeLinksScript, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(nativeLinksScript, /android:path="\/Engine\/"/);
assert.match(nativeLinksScript, /CFBundleURLTypes/);
assert.doesNotMatch(nativeLinksScript, /android:autoVerify="true"/);
assert.match(androidBackupScript, /deny-cloud-backup-and-device-transfer/);
assert.match(apkBackupVerifier, /dump', 'xmltree'/);
assert.match(apkBackupVerifier, /dump', 'resources'/);
assert.match(apkBackupVerifier, /semantic_sha256/);
assert.match(custodialReleaseVerifier, /--build-tools-directory/);
assert.match(custodialReleaseVerifier, /--runtime-directory/);
assert.doesNotMatch(
  custodialReleaseVerifier,
  /sourceDirectory:\s*join\(mobileRoot, ['"]mobile-dist['"]\)/,
  'the compiled verifier must consume only its required explicit clean runtime directory',
);
assert.doesNotMatch(custodialReleaseVerifier, /--expected-signer|--fixture/);
assert.match(
  custodialReleaseVerifier,
  /const aapt2Version = successfulToolVersion\(tools\.aapt2, \['version'\], 'aapt2 version inspection'\)/,
  'The compiled verifier must accept the pinned aapt2 version text from its native stderr stream',
);
assert.doesNotMatch(
  custodialReleaseVerifier,
  /const aapt2Version = successfulOutput/,
  'The compiled verifier must not discard aapt2 version text written to stderr',
);
const parsedCustodialAcceptanceSchema = JSON.parse(custodialAcceptanceSchema);
assert.equal(parsedCustodialAcceptanceSchema.$id, CUSTODIAL_ACCEPTANCE_SCHEMA_ID);
assert.equal(CUSTODIAL_ACCEPTANCE_SCHEMA_ID, 'urn:memphis-zoo:custodial-android-release-acceptance:v6');
assert.equal(CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION, '6.0.0');
assert.equal(parsedCustodialAcceptanceSchema.properties.schema_version.const, 6);
assert.equal(
  parsedCustodialAcceptanceSchema.properties.native_security.properties.plugin_graph_sha256.const,
  CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256,
);
assert.equal(
  parsedCustodialAcceptanceSchema.properties.native_security.properties.capacitor_config_policy_sha256.const,
  CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256,
);
assert.equal(CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION, '35.0.1', 'Custodial acceptance must use the reviewed Codemagic Build Tools version');
assert.equal(CUSTODIAL_ANDROID_RELEASE_POLICY.highest_fleet_version_code, 29);
assert.equal(CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code, 30);
assert.equal(
  CUSTODIAL_ANDROID_RELEASE_POLICY.fleet_baseline_apk_sha256,
  '736ac2a7cb83968706fdbce52fa9664358b86b3cb7364bd10c31be41719105f9',
  'the protected rollback baseline must identify the physically restored Build 29 APK',
);
const parsedCustodialReleasePolicy = JSON.parse(custodialReleasePolicy);
const parsedBuild22Rollback = JSON.parse(custodialBuild22Rollback);
const parsedBuild25Rollback = JSON.parse(custodialBuild25Rollback);
const parsedBuild27Rollback = JSON.parse(custodialBuild27Rollback);
const parsedBuild29Rollback = JSON.parse(custodialBuild29Rollback);
const parsedBuild27Candidate = JSON.parse(custodialBuild27Candidate);
assert.equal(parsedCustodialReleasePolicy.schema_version, 3);
assert.equal(parsedCustodialReleasePolicy.historical_fleet_baseline_manifest, 'custodial-build22-rollback.json');
assert.equal(parsedCustodialReleasePolicy.rollback_baseline_manifest, 'custodial-build29-rollback.json');
assert.equal(parsedCustodialReleasePolicy.candidate_manifest, 'custodial-build27-candidate.json');
assert.equal(parsedCustodialReleasePolicy.rollback_eligible, true);
assert.equal(parsedCustodialReleasePolicy.rollback_strategy, 'forward_versioned_recovery_apk');
assert.equal(parsedCustodialReleasePolicy.rollback_recovery_version_code, 32);
assert.equal(parsedCustodialReleasePolicy.maximum_candidate_version_code_for_staged_recovery, 31);
assert.equal(parsedCustodialReleasePolicy.required_rollback_contract, 'scan.v4.snapshot-bound-authority');
assert.equal(parsedCustodialReleasePolicy.rollback_blocker, null);
assert.equal(parsedBuild22Rollback.schema_version, 4);
assert.equal(parsedBuild22Rollback.status, 'preserved_incompatible_not_rollback_eligible');
assert.equal(parsedBuild22Rollback.package_name, parsedCustodialReleasePolicy.package_name);
assert.equal(parsedBuild22Rollback.version_name, '1.0.0');
assert.equal(parsedBuild22Rollback.version_code, 22);
assert.equal(parsedBuild22Rollback.signer_certificate_sha256, parsedCustodialReleasePolicy.fleet_signer_sha256);
assert.equal(parsedBuild22Rollback.artifact.repository, 'lasrevinu333-design/memphis-zoo-kiosk-control');
assert.equal(parsedBuild22Rollback.artifact.authority, 'private_draft_github_release_asset');
assert.equal(parsedBuild22Rollback.artifact.release_id, 370354304);
assert.equal(parsedBuild22Rollback.artifact.release_tag, 'custodial-build22-rollback-baseline-20260813');
assert.equal(parsedBuild22Rollback.artifact.release_is_draft, true);
assert.equal(parsedBuild22Rollback.artifact.release_page_url, 'https://github.com/lasrevinu333-design/memphis-zoo-kiosk-control/releases/tag/untagged-a3e968e0029423b213b7');
assert.equal(parsedBuild22Rollback.artifact.asset_id, 513927837);
assert.equal(parsedBuild22Rollback.artifact.asset_name, 'Custodial_Build_22_Rollback.apk');
assert.equal(parsedBuild22Rollback.artifact.asset_size_bytes, 34931313);
assert.equal(parsedBuild22Rollback.artifact.asset_sha256, '297becf5e6ee197a8534e8878536f2e4ded6d4de98b0a3a378899a4b46172ec5');
assert.equal(parsedBuild22Rollback.artifact.asset_digest_api, `sha256:${parsedBuild22Rollback.artifact.asset_sha256}`);
assert.equal(
  parsedBuild22Rollback.artifact.asset_api_url,
  `https://api.github.com/repos/${parsedBuild22Rollback.artifact.repository}/releases/assets/${parsedBuild22Rollback.artifact.asset_id}`,
);
assert.equal(
  parsedBuild22Rollback.artifact.asset_url,
  `https://github.com/${parsedBuild22Rollback.artifact.repository}/releases/download/untagged-a3e968e0029423b213b7/${parsedBuild22Rollback.artifact.asset_name}`,
);
assert.deepEqual(parsedBuild22Rollback.compatibility_evidence, {
  artifact_scan_contract: 'scan.v2',
  required_scan_contract: 'scan.v4.snapshot-bound-authority',
  artifact_start_rpc: 'tool_start_session_v2',
  required_start_rpc: 'tool_start_offline_occurrence',
  backend_allows_artifact_start_rpc: false,
  artifact_has_native_offline_authority: false,
  artifact_has_durable_rollback_fence: false,
  embedded_worker_fixture: 'tests/fixtures/build22-memphis-scan-sync.js',
  embedded_worker_sha256: 'b9465949796be0e84d6c4236a6c01974fd74534792f8ca30b2304c8969ffe4fa',
  canary_release_eligible: false,
});
assert.equal(createHash('sha256').update(acceptedBuild22Worker).digest('hex'), parsedBuild22Rollback.compatibility_evidence.embedded_worker_sha256);
assert.match(acceptedBuild22Worker, /tool_start_session_v2/);
assert.doesNotMatch(acceptedBuild22Worker, /tool_start_offline_occurrence|beginRollbackFence|authorizeOfflineNewWork/);
assert.equal(parsedBuild22Rollback.rollback_commands.length, 0);
assert.ok(parsedBuild22Rollback.prohibited_shortcuts.includes('Do not install Build 22 as a rollback target for a scan.v4 canary.'));
assert.equal(parsedBuild22Rollback.replacement_requirement.minimum_version_code, 23);
const requiredRecoveryPluginMethods = [
  'getOfflineAuthorityState',
  'beginRollbackFence',
  'clearRollbackFence',
  'authorizeOfflineNewWork',
  'attestOfflineStart',
];
assert.deepEqual(parsedBuild22Rollback.replacement_requirement.required_native_capabilities, requiredRecoveryPluginMethods);
assert.equal(parsedBuild25Rollback.schema_version, 6);
assert.equal(parsedBuild25Rollback.status, 'staged_canary_forward_recovery');
assert.equal(parsedBuild25Rollback.package_name, parsedCustodialReleasePolicy.package_name);
assert.equal(parsedBuild25Rollback.version_name, '1.0.0');
assert.equal(parsedBuild25Rollback.version_code, 25);
assert.equal(parsedBuild25Rollback.signer_certificate_sha256, parsedCustodialReleasePolicy.fleet_signer_sha256);
assert.equal(parsedBuild25Rollback.signer_public_key_sha256, parsedCustodialReleasePolicy.fleet_signer_public_key_sha256);
assert.equal(parsedBuild25Rollback.source.repository, 'lasrevinu333-design/Engine');
assert.equal(parsedBuild25Rollback.source.ref, 'refs/heads/main');
assert.equal(parsedBuild25Rollback.source.commit, '257de53680eb305191d42b396098e42b69be5e91');
assert.equal(parsedBuild25Rollback.source.tree, '3c400f3a6087aa6ee47b35be8d7d8bdb5dba7212');
assert.equal(parsedBuild25Rollback.source.commit_exact, true);
assert.deepEqual(parsedBuild25Rollback.build, {
  authority: 'codemagic',
  workflow: 'custodial-android',
  build_id: '6a809c871715fe317c85cb09',
  build_number: 25,
  first_attempt_passed: true,
  accepted: true,
});
assert.equal(parsedBuild25Rollback.artifact.authority, 'private_draft_github_release_asset');
assert.equal(parsedBuild25Rollback.artifact.repository, 'lasrevinu333-design/memphis-zoo-kiosk-control');
assert.equal(parsedBuild25Rollback.artifact.release_id, 371126690);
assert.equal(parsedBuild25Rollback.artifact.release_tag, 'custodial-build25-rollback-baseline-20260815');
assert.equal(parsedBuild25Rollback.artifact.release_is_draft, true);
assert.equal(parsedBuild25Rollback.artifact.asset_id, 515958730);
assert.equal(parsedBuild25Rollback.artifact.asset_name, 'memphis-zoo-custodial-build25.apk');
assert.equal(parsedBuild25Rollback.artifact.asset_size_bytes, 6443005);
assert.equal(parsedBuild25Rollback.artifact.asset_sha256, 'b3b3479f88b551a6a8b8b91c123844bc9342976e3303b55b9dcca7b6b60e5687');
assert.equal(parsedBuild25Rollback.artifact.asset_digest_api, `sha256:${parsedBuild25Rollback.artifact.asset_sha256}`);
assert.equal(parsedBuild25Rollback.provenance_artifact.asset_id, 515954865);
assert.equal(parsedBuild25Rollback.provenance_artifact.asset_name, 'Engine_25_artifacts.zip');
assert.equal(parsedBuild25Rollback.provenance_artifact.asset_size_bytes, 13287);
assert.equal(parsedBuild25Rollback.provenance_artifact.asset_sha256, '3e69fa9794e9a1a0a0448d381edf73f0ab83ba0be83aa3c7612133b111241ad0');
assert.equal(parsedBuild25Rollback.forward_recovery.strategy, parsedCustodialReleasePolicy.rollback_strategy);
assert.equal(parsedBuild25Rollback.forward_recovery.source_capability_version_code, 25);
assert.equal(parsedBuild25Rollback.forward_recovery.package_version_code, 28);
assert.equal(parsedBuild25Rollback.forward_recovery.candidate_minimum_version_code, 26);
assert.equal(parsedBuild25Rollback.forward_recovery.candidate_maximum_version_code, 27);
assert.equal(parsedBuild25Rollback.forward_recovery.direct_version_downgrade_supported, false);
assert.equal(parsedBuild25Rollback.forward_recovery.source.commit, '78f8bf499829f2b2c5f240a1265ebe7282a3f82d');
assert.equal(parsedBuild25Rollback.forward_recovery.source.tree, 'bc5faf5d18b70ee9224a0238b8e4a083f5b9b532');
assert.equal(parsedBuild25Rollback.forward_recovery.source.runtime_source_commit, parsedBuild25Rollback.source.commit);
assert.equal(parsedBuild25Rollback.forward_recovery.source.runtime_source_tree, parsedBuild25Rollback.source.tree);
assert.equal(parsedBuild25Rollback.forward_recovery.build.build_id, '6a80c1ca1f1c0bae44f9a1ca');
assert.equal(parsedBuild25Rollback.forward_recovery.build.build_number, 28);
assert.equal(parsedBuild25Rollback.forward_recovery.artifact.asset_id, 516019493);
assert.equal(parsedBuild25Rollback.forward_recovery.artifact.asset_name, 'memphis-zoo-custodial-build28-recovery.apk');
assert.equal(parsedBuild25Rollback.forward_recovery.artifact.asset_sha256, '678c786e56e5f26098f799155b2fe990e4dae3d8fb38cc38f498ab3ebe221116');
assert.equal(parsedBuild25Rollback.forward_recovery.provenance_artifact.asset_id, 516019492);
assert.equal(parsedBuild25Rollback.forward_recovery.provenance_artifact.asset_sha256, '7fb3e0175777c2813a0354e7aa31d53faebf583522482f081520c3eacfe55c74');
assert.equal(parsedBuild25Rollback.forward_recovery.compatibility_evidence.runtime_executables_match_build25_except_build_identity, true);
assert.equal(parsedBuild25Rollback.forward_recovery.compatibility_evidence.native_vault_source_matches_build25, true);
assert.deepEqual(parsedBuild25Rollback.compatibility_evidence.required_native_capabilities, requiredRecoveryPluginMethods);
assert.equal(parsedBuild25Rollback.compatibility_evidence.artifact_scan_contract, parsedCustodialReleasePolicy.required_rollback_contract);
assert.equal(parsedBuild25Rollback.compatibility_evidence.required_scan_contract, parsedCustodialReleasePolicy.required_rollback_contract);
assert.equal(parsedBuild25Rollback.compatibility_evidence.artifact_has_native_offline_authority, true);
assert.equal(parsedBuild25Rollback.compatibility_evidence.artifact_has_durable_rollback_fence, true);
assert.equal(parsedBuild25Rollback.compatibility_evidence.required_native_capabilities_verified, true);
assert.equal(parsedBuild25Rollback.compatibility_evidence.canary_release_eligible, true);
assert.equal(parsedBuild25Rollback.physical_preflight.in_place_upgrade_from_version_code, 24);
for (const result of [
  'first_install_time_preserved',
  'enrollment_preserved',
  'employee_identity_preserved',
  'schedule_identity_preserved',
  'process_recreation_passed',
  'offline_reconnect_passed',
  'device_reboot_passed',
  'device_owner_preserved',
]) {
  assert.equal(parsedBuild25Rollback.physical_preflight[result], true, `Build 25 physical preflight missing ${result}`);
}
for (const digest of Object.values(parsedBuild25Rollback.physical_preflight.evidence_sha256)) {
  assert.match(digest, /^[a-f0-9]{64}$/);
}
assert.equal(parsedBuild25Rollback.rollback.target_source_version_code, 25);
assert.equal(parsedBuild25Rollback.rollback.recovery_package_version_code, 28);
assert.equal(parsedBuild25Rollback.rollback.eligible_candidate_minimum_version_code, 26);
assert.equal(parsedBuild25Rollback.rollback.eligible_candidate_maximum_version_code, 27);
assert.equal(parsedBuild25Rollback.rollback.direct_downgrade_supported, false);
assert.equal(parsedBuild25Rollback.rollback.preserve_enrollment_and_protected_state, true);
for (const result of [
  'direct_downgrade_rejected',
  'forward_recovery_install_passed',
  'android_retain_data_rollback_available',
  'android_retain_data_rollback_committed',
  'candidate_restored_exactly',
  'first_install_time_preserved',
  'enrollment_preserved',
  'employee_identity_preserved',
  'schedule_identity_preserved',
  'device_owner_preserved',
]) assert.equal(parsedBuild25Rollback.physical_rollback_drill[result], true, `physical rollback drill missing ${result}`);
assert.equal(parsedBuild25Rollback.physical_rollback_drill.uninstall_or_data_clear_used, false);
for (const digest of Object.values(parsedBuild25Rollback.physical_rollback_drill.evidence_sha256)) {
  assert.match(digest, /^[a-f0-9]{64}$/);
}
assert.deepEqual(parsedBuild25Rollback.final_gate, {
  candidate_to_baseline_rollback_drill_complete: true,
  physical_nfc_workflow_complete: false,
  required_before_production_candidate_acceptance: true,
  fleet_authorized: false,
});
assert.equal(parsedBuild27Rollback.schema_version, 7);
assert.equal(parsedBuild27Rollback.status, 'staged_canary_forward_recovery');
assert.equal(parsedBuild27Rollback.package_name, parsedCustodialReleasePolicy.package_name);
assert.equal(parsedBuild27Rollback.version_name, '1.0.0');
assert.equal(parsedBuild27Rollback.version_code, 27);
assert.equal(parsedBuild27Rollback.signer_certificate_sha256, parsedCustodialReleasePolicy.fleet_signer_sha256);
assert.equal(parsedBuild27Rollback.signer_public_key_sha256, parsedCustodialReleasePolicy.fleet_signer_public_key_sha256);
assert.deepEqual(parsedBuild27Rollback.source, {
  repository: 'lasrevinu333-design/Engine',
  ref: 'refs/heads/main',
  commit: '71fc3f8861c88a9f455b6e3cd44cfc615ebb714f',
  tree: '4da0e408f541445b077b0388c924d945742a71e3',
  commit_exact: true,
});
assert.deepEqual(parsedBuild27Rollback.build, {
  authority: 'codemagic',
  workflow: 'custodial-android',
  build_id: '6a80bd84bfdeb9f936680ab7',
  build_number: 27,
  first_attempt_passed: true,
  accepted: true,
});
assert.equal(parsedBuild27Rollback.artifact.release_id, 371161961);
assert.equal(parsedBuild27Rollback.artifact.release_tag, 'custodial-build27-rollback-baseline-20260815');
assert.equal(parsedBuild27Rollback.artifact.release_is_draft, true);
assert.equal(parsedBuild27Rollback.artifact.asset_id, 516089625);
assert.equal(parsedBuild27Rollback.artifact.asset_name, 'memphis-zoo-custodial-build27.apk');
assert.equal(parsedBuild27Rollback.artifact.asset_sha256, '3c23de0d39ddb59a62ccad41ca2f4eb15d7541bda416076afb0fd8fd2e8181f9');
assert.equal(parsedBuild27Rollback.provenance_artifact.asset_id, 516089630);
assert.equal(parsedBuild27Rollback.provenance_artifact.asset_sha256, '710ea1889b259f22bb62a202db0e483b4df1d5d50198db78e2b5e0cc3b6d24a7');
assert.equal(parsedBuild27Rollback.forward_recovery.source_capability_version_code, 27);
assert.equal(parsedBuild27Rollback.forward_recovery.package_version_code, 30);
assert.equal(parsedBuild27Rollback.forward_recovery.candidate_minimum_version_code, 28);
assert.equal(parsedBuild27Rollback.forward_recovery.candidate_maximum_version_code, 29);
assert.equal(parsedBuild27Rollback.forward_recovery.source.ref, 'refs/heads/release/custodial-build27-recovery-v30-implementation-20260815');
assert.equal(parsedBuild27Rollback.forward_recovery.source.commit, 'd72b78eb8c343c7952b8252731d50ed31988f124');
assert.equal(parsedBuild27Rollback.forward_recovery.source.tree, '7769964a2d5b3326f1abacb1429299888ec818ec');
assert.equal(parsedBuild27Rollback.forward_recovery.source.runtime_source_commit, parsedBuild27Rollback.source.commit);
assert.equal(parsedBuild27Rollback.forward_recovery.source.runtime_source_tree, parsedBuild27Rollback.source.tree);
assert.equal(parsedBuild27Rollback.forward_recovery.build.build_id, '6a80d4fde8a911e792ddef61');
assert.equal(parsedBuild27Rollback.forward_recovery.build.build_number, 30);
assert.equal(parsedBuild27Rollback.forward_recovery.artifact.asset_id, 516089628);
assert.equal(parsedBuild27Rollback.forward_recovery.artifact.asset_sha256, 'ac6c7235ba6cb97acc63136f1a4c2c48328a985ce1e0c58a5225a475bed25caa');
assert.equal(parsedBuild27Rollback.forward_recovery.provenance_artifact.asset_id, 516089629);
assert.equal(parsedBuild27Rollback.forward_recovery.provenance_artifact.asset_sha256, '5033240194ebc809b96831c00703938492486f1168378389b82ed6791d9b7632');
assert.equal(parsedBuild27Rollback.forward_recovery.compatibility_evidence.runtime_executables_match_baseline_except_build_identity, true);
assert.equal(parsedBuild27Rollback.forward_recovery.compatibility_evidence.native_vault_source_matches_baseline, true);
assert.equal(parsedBuild27Rollback.forward_recovery.compatibility_evidence.native_vault_source_sha256, '52540408e307190341f751fc5071be466d029d9b71e955cc49e60b6b0fc2a0b3');
for (const result of [
  'first_install_time_preserved',
  'enrollment_preserved',
  'employee_identity_preserved',
  'schedule_identity_preserved',
  'process_recreation_passed',
  'offline_reconnect_passed',
  'device_reboot_passed',
  'device_owner_preserved',
]) assert.equal(parsedBuild27Rollback.physical_preflight[result], true, `Build 27 physical preflight missing ${result}`);
assert.equal(parsedBuild27Rollback.physical_rollback_drill.candidate_version_code, parsedBuild27Rollback.version_code);
assert.equal(parsedBuild27Rollback.physical_rollback_drill.recovery_version_code, parsedBuild27Rollback.forward_recovery.package_version_code);
for (const result of [
  'forward_recovery_install_passed',
  'android_retain_data_rollback_available',
  'android_retain_data_rollback_committed',
  'candidate_restored_exactly',
  'first_install_time_preserved',
  'enrollment_preserved',
  'employee_identity_preserved',
  'schedule_identity_preserved',
  'device_owner_preserved',
]) assert.equal(parsedBuild27Rollback.physical_rollback_drill[result], true, `Build 30 recovery preflight missing ${result}`);
assert.equal(parsedBuild27Rollback.physical_rollback_drill.uninstall_or_data_clear_used, false);
assert.deepEqual(parsedBuild27Rollback.final_gate, {
  recovery_preflight_complete: true,
  candidate_to_recovery_rollback_drill_complete: false,
  physical_nfc_workflow_complete: false,
  required_before_production_candidate_acceptance: true,
  fleet_authorized: false,
});
assert.equal(parsedBuild29Rollback.schema_version, 7);
assert.equal(parsedBuild29Rollback.status, 'staged_canary_forward_recovery');
assert.equal(parsedBuild29Rollback.package_name, parsedCustodialReleasePolicy.package_name);
assert.equal(parsedBuild29Rollback.version_code, parsedCustodialReleasePolicy.highest_fleet_version_code);
assert.equal(parsedBuild29Rollback.source.commit, '1a0bdd44917338065ff589ef887ef4d7af58ddac');
assert.equal(parsedBuild29Rollback.source.tree, '96898b8d244b9975fccac9fd6849c1fd43c4563d');
assert.equal(parsedBuild29Rollback.build.build_id, '6a80de0e67450fa1e03a0a2f');
assert.equal(parsedBuild29Rollback.build.build_number, 29);
assert.equal(parsedBuild29Rollback.artifact.release_id, 371165701);
assert.equal(parsedBuild29Rollback.artifact.release_tag, 'custodial-build29-rollback-baseline-20260815');
assert.equal(parsedBuild29Rollback.artifact.release_is_draft, true);
assert.equal(parsedBuild29Rollback.artifact.asset_id, 516105946);
assert.equal(parsedBuild29Rollback.artifact.asset_name, 'memphis-zoo-custodial-build29.apk');
assert.equal(parsedBuild29Rollback.artifact.asset_sha256, parsedCustodialReleasePolicy.fleet_baseline_apk_sha256);
assert.equal(parsedBuild29Rollback.provenance_artifact.asset_id, 516105947);
assert.equal(parsedBuild29Rollback.provenance_artifact.asset_name, 'Engine_29_artifacts.zip');
assert.equal(parsedBuild29Rollback.provenance_artifact.asset_sha256, 'b7de584389b4b8053cd4b250d3e6375348623321b34649d24edae43adfdaf6c4');
assert.equal(parsedBuild29Rollback.forward_recovery.source_capability_version_code, 29);
assert.equal(parsedBuild29Rollback.forward_recovery.package_version_code, 32);
assert.equal(parsedBuild29Rollback.forward_recovery.candidate_minimum_version_code, 30);
assert.equal(parsedBuild29Rollback.forward_recovery.candidate_maximum_version_code, 31);
assert.equal(parsedBuild29Rollback.forward_recovery.source.ref, 'refs/heads/release/custodial-build29-recovery-v32-implementation-20260815');
assert.equal(parsedBuild29Rollback.forward_recovery.source.commit, 'e5c7cebf86645798025ed2ac228856d30b92aa55');
assert.equal(parsedBuild29Rollback.forward_recovery.source.tree, 'e3d4596b964628b9adf2c9b48d76a9e7603d43da');
assert.equal(parsedBuild29Rollback.forward_recovery.source.runtime_source_commit, parsedBuild29Rollback.source.commit);
assert.equal(parsedBuild29Rollback.forward_recovery.source.runtime_source_tree, parsedBuild29Rollback.source.tree);
assert.equal(parsedBuild29Rollback.forward_recovery.build.build_id, '6a80f3dadf66721d7ac1641c');
assert.equal(parsedBuild29Rollback.forward_recovery.build.build_number, 32);
assert.equal(parsedBuild29Rollback.forward_recovery.artifact.asset_id, 516188760);
assert.equal(parsedBuild29Rollback.forward_recovery.artifact.asset_name, 'memphis-zoo-custodial-build32-recovery.apk');
assert.equal(parsedBuild29Rollback.forward_recovery.artifact.asset_sha256, 'b0571698bfb0850ff8f0e280808fe7d27391d8d05d343ec5b0d01a35ff84bb80');
assert.equal(parsedBuild29Rollback.forward_recovery.provenance_artifact.asset_id, 516188759);
assert.equal(parsedBuild29Rollback.forward_recovery.provenance_artifact.asset_name, 'Engine_32_artifacts.zip');
assert.equal(parsedBuild29Rollback.forward_recovery.provenance_artifact.asset_sha256, 'b036f1b04e3a172ec60d725f9fe5c5652571a472c845992c3eb56e6b409139de');
assert.equal(parsedBuild29Rollback.forward_recovery.compatibility_evidence.native_vault_source_sha256, '27f131309b90703b046d5b8e8d8796a8ea965537feaafbee520e34bf8ecd0574');
for (const result of [
  'first_install_time_preserved',
  'enrollment_preserved',
  'employee_identity_preserved',
  'schedule_identity_preserved',
  'process_recreation_passed',
  'offline_reconnect_passed',
  'device_reboot_passed',
  'device_owner_preserved',
]) assert.equal(parsedBuild29Rollback.physical_preflight[result], true, `Build 29 physical preflight missing ${result}`);
assert.equal(parsedBuild29Rollback.physical_rollback_drill.candidate_version_code, parsedBuild29Rollback.version_code);
assert.equal(parsedBuild29Rollback.physical_rollback_drill.recovery_version_code, parsedBuild29Rollback.forward_recovery.package_version_code);
for (const result of [
  'direct_downgrade_rejected',
  'forward_recovery_install_passed',
  'android_retain_data_rollback_available',
  'android_retain_data_rollback_committed',
  'candidate_restored_exactly',
  'first_install_time_preserved',
  'enrollment_preserved',
  'employee_identity_preserved',
  'schedule_identity_preserved',
  'device_owner_preserved',
]) assert.equal(parsedBuild29Rollback.physical_rollback_drill[result], true, `Build 32 recovery preflight missing ${result}`);
assert.equal(parsedBuild29Rollback.physical_rollback_drill.uninstall_or_data_clear_used, false);
assert.deepEqual(parsedBuild29Rollback.final_gate, {
  recovery_preflight_complete: true,
  candidate_to_recovery_rollback_drill_complete: false,
  physical_nfc_workflow_complete: false,
  required_before_production_candidate_acceptance: true,
  fleet_authorized: false,
});
assert.equal(parsedBuild27Candidate.schema_version, 1);
assert.equal(parsedBuild27Candidate.status, 'staged_physical_candidate_nfc_pending');
assert.equal(parsedBuild27Candidate.package_name, parsedCustodialReleasePolicy.package_name);
assert.equal(parsedBuild27Candidate.version_code, parsedBuild27Rollback.version_code);
assert.equal(parsedBuild27Candidate.source.ref, 'refs/heads/main');
assert.equal(parsedBuild27Candidate.source.commit, parsedBuild25Rollback.physical_rollback_drill.candidate_source_commit);
assert.equal(parsedBuild27Candidate.source.tree, parsedBuild25Rollback.physical_rollback_drill.candidate_source_tree);
assert.equal(parsedBuild27Candidate.backend_pair.commit, 'bf1ea15ff501aa4eb51bfd5257a0a16b4a6d7f85');
assert.equal(parsedBuild27Candidate.backend_pair.tree, 'f18e906ff520f2a03e8bb6bc762182324dce44b2');
assert.equal(parsedBuild27Candidate.backend_pair.canonical_schema_sha256, parsedBuild25Rollback.compatibility_evidence.embedded_schema_sha256);
assert.equal(parsedBuild27Candidate.build.build_id, '6a80bd84bfdeb9f936680ab7');
assert.equal(parsedBuild27Candidate.build.build_number, parsedBuild27Candidate.version_code);
assert.equal(parsedBuild27Candidate.artifact.release_is_draft, true);
assert.equal(parsedBuild27Candidate.artifact.asset_id, 516023264);
assert.equal(parsedBuild27Candidate.artifact.asset_sha256, parsedBuild25Rollback.physical_rollback_drill.candidate_apk_sha256);
assert.equal(parsedBuild27Candidate.provenance_artifact.asset_id, 516023266);
assert.equal(parsedBuild27Candidate.provenance_artifact.asset_sha256, '710ea1889b259f22bb62a202db0e483b4df1d5d50198db78e2b5e0cc3b6d24a7');
assert.equal(parsedBuild27Candidate.physical_canary.forward_rollback_drill_passed, true);
assert.equal(parsedBuild27Candidate.physical_canary.restored_after_rollback, true);
assert.equal(parsedBuild27Candidate.physical_canary.real_nfc_workflow_passed, false);
assert.equal(parsedBuild27Candidate.rollback.recovery_version_code, parsedBuild25Rollback.forward_recovery.package_version_code);
assert.equal(parsedBuild27Candidate.rollback.recovery_apk_sha256, parsedBuild25Rollback.forward_recovery.artifact.asset_sha256);
assert.equal(parsedBuild27Candidate.release_contract_supersession.artifact_source_policy_is_build_time_evidence, true);
assert.match(parsedBuild27Candidate.release_contract_supersession.reason, /Android rejects direct downgrade/);
assert.equal(parsedBuild27Candidate.final_gate.software_candidate_ready, true);
assert.equal(parsedBuild27Candidate.final_gate.real_nfc_workflow_complete, false);
assert.equal(parsedBuild27Candidate.final_gate.one_phone_canary_complete, false);
assert.equal(parsedBuild27Candidate.final_gate.fleet_authorized, false);
const build29RollbackManifestSha256 = createHash('sha256').update(custodialBuild29Rollback).digest('hex');
assert.equal(CUSTODIAL_ANDROID_RELEASE_POLICY.rollback_baseline_sha256, build29RollbackManifestSha256);
assert.equal(CONFIGURE_CUSTODIAL_ANDROID_RELEASE_POLICY.rollback_baseline_sha256, build29RollbackManifestSha256);
assert.equal(
  loadCustodialRollbackBaseline(parsedCustodialReleasePolicy, Buffer.from(custodialBuild29Rollback)).sha256,
  build29RollbackManifestSha256,
);
assert.equal(loadCustodialRollbackBaseline({
  ...parsedCustodialReleasePolicy,
  rollback_eligible: false,
  rollback_baseline_manifest: null,
  rollback_blocker: 'No compatible rollback target is staged.',
}), null);
assert.throws(
  () => loadCustodialRollbackBaseline({
    ...parsedCustodialReleasePolicy,
    rollback_baseline_manifest: null,
  }, Buffer.from(custodialBuild29Rollback)),
  /bind the exact active baseline/,
);
for (const mutate of [
  (value) => { value.artifact.asset_sha256 = '0'.repeat(64); },
  (value) => { value.forward_recovery.artifact.asset_sha256 = '0'.repeat(64); },
  (value) => { value.forward_recovery.package_version_code = 27; },
  (value) => { value.compatibility_evidence.required_native_capabilities.pop(); },
  (value) => { value.physical_preflight.evidence_sha256.after_reboot = 'invalid'; },
  (value) => { value.physical_rollback_drill.candidate_restored_exactly = false; },
  (value) => { value.final_gate.recovery_preflight_complete = false; },
  (value) => { value.final_gate.fleet_authorized = true; },
]) {
  const rejected = structuredClone(parsedBuild29Rollback);
  mutate(rejected);
  assert.throws(
    () => loadCustodialRollbackBaseline(parsedCustodialReleasePolicy, Buffer.from(JSON.stringify(rejected))),
    /malformed or overclaims physical acceptance/,
  );
}
for (const method of requiredRecoveryPluginMethods) {
  assert.ok(CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS.includes(method));
}
assert.equal(
  CONFIGURE_CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
  CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
  'native configuration and compiled acceptance must consume the same protected release policy',
);
assert.equal(CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform, process.platform === 'darwin' ? 'macosx' : 'linux');
assert.equal(
  custodialAndroidToolchainPolicyForPlatform('darwin').archive.sha1,
  'f4dda6855ddf1ea1a51ee3ab6587104bd0c1d727',
);
assert.equal(parsedCustodialReleasePolicy.minimum_next_version_code, 30);
assert.equal(JSON.parse(custodialToolchainPolicy).archive.size_bytes, 76857925);
assert.equal(CUSTODIAL_NODE_VERSION, 'v22.23.1', 'Custodial acceptance must use the repository-pinned Node runtime');
assert.equal(CUSTODIAL_CODEMAGIC_WORKFLOW, 'custodial-android', 'Custodial acceptance must bind the literal Codemagic workflow key');
assert.equal(CUSTODIAL_TARGET_SDK_VERSION, 36, 'Custodial acceptance must pin the reviewed target SDK');
assert.match(codemagic, /MZ_API_BASE: https:\/\/memphis-zoo-mcp\.onrender\.com/);
assert.doesNotMatch(codemagic, /firebase_credentials/);
assert.match(codemagic, /firebase_client_config/);
assert.match(codemagic, /MZ_REQUIRE_PINNED_FIREBASE_CONFIG: '1'/);
assert.match(
  codemagic,
  /case "\$MZ_APP_EDITION" in[\s\S]*manager\)[\s\S]*expected_firebase_package='org\.memphiszoo\.ops'[\s\S]*configure-firebase\.mjs android[\s\S]*custodial\)[\s\S]*expected_firebase_package='org\.memphiszoo\.custodial'[\s\S]*configure-firebase\.mjs android[\s\S]*viewer\)[\s\S]*expected_firebase_package=''/,
  'production Android builds must configure Firebase for manager and custodial, but not viewer',
);
assert.match(codemagic, /test -s android\/app\/google-services\.json/);
assert.match(codemagic, /packages\.includes\(process\.env\.EXPECTED_FIREBASE_PACKAGE\)/);
assert.match(codemagic, /test ! -e android\/app\/google-services\.json/);
assert.match(codemagic, /cap add ios --packagemanager SPM/);
assert.doesNotMatch(codemagic, /App\.xcworkspace/, 'Capacitor 8 SPM builds must use the generated Xcode project');
assert.doesNotMatch(codemagic, /\bgem install\b|require ['"]xcodeproj['"]/, 'native release configuration must not install unpinned Ruby tooling');
assert.equal(
  [...codemagic.matchAll(/xcode-project build-ipa \\\n\s+--project "\$CM_BUILD_DIR\/mobile\/ios\/App\/App\.xcodeproj"/g)].length,
  2,
  'the two store-distributed iOS editions must archive the generated SPM Xcode project',
);
assert.match(codemagic, /-disableAutomaticPackageResolution/);
assert.match(codemagic, /-onlyUsePackageVersionsFromResolvedFile/);
assert.match(codemagic, /cmp "\$lock" "\$resolved"/);
assert.match(codemagic, /PROJECT_BUILD_NUMBER/);
assert.doesNotMatch(codemagic, /CM_BUILD_NUMBER/, 'Codemagic exports PROJECT_BUILD_NUMBER and BUILD_NUMBER, not CM_BUILD_NUMBER');
assert.equal(
  [...codemagic.matchAll(/MZ_RELEASE_VERSION: 1\.0\.0/g)].length,
  5,
  'every native release workflow must declare the same user-facing version',
);
for (const verification of ['apksigner','jarsigner','codesign --verify']) {
  assert.ok(codemagic.includes(verification), `signed artifact verification missing ${verification}`);
}
assert.match(codemagic, /configure-native-release\.mjs android/);
assert.match(codemagic, /configure-native-release\.mjs ios/);
assert.match(codemagic, /configure-native-links\.mjs android/);
assert.match(codemagic, /configure-native-links\.mjs ios/);
assert.match(codemagic, /configure-android-backup\.mjs/);
assert.match(codemagic, /verify-android-apk-backup\.mjs/);
assert.match(codemagic, /verify-custodial-android-release\.mjs/);
assert.match(codemagic, /--build-workflow custodial-android/);
assert.match(codemagic, /--build-tools-directory "\$ANDROID_SDK_ROOT\/build-tools\/35\.0\.1"/);
assert.match(codemagic, /--runtime-directory mobile\/mobile-dist/);
assert.match(codemagic, /custodial-android-release-acceptance\.json/);
assert.match(codemagic, /custodial-android-toolchain\.json/);
assert.match(codemagic, /codemagic_xcode_image: '26\.2'/);
assert.equal(
  [...codemagic.matchAll(/xcode: '26\.2'/g)].length,
  3,
  'every Android workflow must pin the reviewed Codemagic image',
);
assert.match(codemagic, /source_status="\$\(git status --porcelain=v1 --untracked-files=all\)"/);
assert.match(codemagic, /untracked_nonignored_files_absent: true/);
assert.match(codemagic, /walkEvidence\('build\/provenance'\)/);
assert.match(codemagic, /test "\$custodial_apk_count" -eq 1/);
assert.match(codemagic, /native-mobile-build-contract-tests\.mjs/);
assert.match(custodialReleaseVerifier, new RegExp(CUSTODIAL_SIGNER_SHA256));
assert.doesNotMatch(codemagic, /Signer #1 certificate SHA-256 digest|grep[^\n]+Number of signers/);
assert.equal(
  [...codemagic.matchAll(/#!\/usr\/bin\/env bash/g)].length,
  [...codemagic.matchAll(/set -euo pipefail/g)].length,
  'every strict Codemagic script must explicitly select Bash',
);
assert.doesNotMatch(
  codemagic,
  /script: \|\n\s+set -euo pipefail/,
  'Codemagic must not run Bash strict mode through the default sh interpreter',
);
assert.match(
  codemagic,
  /distributionSha256Sum=ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c/,
);
assert.equal(
  [...codemagic.matchAll(/--dependency-verification strict assembleRelease bundleRelease/g)].length,
  2,
  'both store-distributed Android workflows must build an app bundle with strict dependency verification',
);
assert.match(codemagic, /custodial-android:[\s\S]*--dependency-verification strict assembleRelease\s+\\\n/, 'the private Custodial workflow must build a strictly verified APK');
assert.doesNotMatch(codemagic, /^  custodial-ios:$/m, 'Custodial must not be distributed through Apple');
const custodialAndroid = codemagic.match(/^  custodial-android:\n(?:(?: {4,}.*|\s*)\n)*/m)?.[0] || '';
assert.doesNotMatch(custodialAndroid, /google_play_credentials|bundleRelease|\.aab|publishing:|google_play:/, 'Custodial must remain a private signed APK, never a store bundle');
assert.match(custodialAndroid, /MZ_SHELL_START: '1'/, 'Custodial Android must build the required local role shell start path');
assert.match(custodialAndroid, /PROJECT_BUILD_NUMBER: '43'/, 'Custodial recovery source must pin the protected Build 43 package');
assert.equal(
  [...codemagic.matchAll(/gradle_temp_root="\$\(cd "\$\{TMPDIR:-\/tmp\}" && pwd -P\)"/g)].length,
  3,
  'every signed Android workflow must canonicalize its temporary root outside the checkout',
);
assert.equal(
  [...codemagic.matchAll(/mktemp -d "\$gradle_temp_root\/memphis-zoo-gradle\.XXXXXX"/g)].length,
  3,
  'every signed Android workflow must create an isolated Gradle home outside the checkout',
);
assert.equal(
  [...codemagic.matchAll(/trap cleanup_gradle_user_home EXIT/g)].length,
  3,
  'every signed Android workflow must clean its isolated Gradle home at step exit',
);
assert.doesNotMatch(
  codemagic,
  /gradle_user_home="\$CM_BUILD_DIR\//,
  'Codemagic must never put the Gradle user home in the attested source checkout',
);
assert.equal(
  [...codemagic.matchAll(/--no-build-cache --rerun-tasks/g)].length,
  3,
  'every signed Android workflow must bypass task and build caches',
);
assert.doesNotMatch(
  codemagic,
  /--write-verification-metadata|--dependency-verification (?:lenient|off)/,
  'Codemagic must never generate or weaken reviewed dependency trust metadata',
);
assert.equal(
  [...codemagic.matchAll(/\.\.\/native-locks\/android\/\$MZ_APP_EDITION\/verification-metadata\.xml/g)].length,
  3,
  'every signed Android workflow must compare the restored dependency lock after building',
);
for (const variable of ['CM_KEYSTORE_PATH','CM_KEYSTORE_PASSWORD','CM_KEY_ALIAS','CM_KEY_PASSWORD']) {
  assert.ok(androidReleaseOverlay.includes(variable), `Android release overlay missing ${variable}`);
}
assert.doesNotMatch(androidReleaseOverlay, /versionCode|versionName/);
assert.match(androidVersionOverlay, /versionCode buildNumber\.intValue\(\)/);
assert.match(androidVersionOverlay, /versionName releaseVersion/);
assert.match(androidVersionOverlay, /buildToolsVersion '35\.0\.1'/);
assert.match(androidReleaseOverlay, /signingConfig signingConfigs\.release/);
assert.match(nativeReleaseScript, /signing_keystore_sha256/);
assert.match(nativeReleaseScript, /swift_package_lock_sha256/);
assert.match(nativeReleaseScript, /gradle_wrapper_jar_sha256/);
assert.match(nativeReleaseScript, /gradle_verification_metadata_sha256/);
assert.match(nativeReleaseScript, /generated_variables_gradle_sha256/);
assert.match(androidBackupScript, /configureAndroidVariablesSource/);
assert.match(androidBackupScript, /android\/variables\.gradle/);
assert.match(nativeReleaseScript, /Custodial is Android-only and cannot be configured for iOS/);
assert.match(nativeReleaseScript, /VERSIONING_SYSTEM = apple-generic/);
assert.match(nativeLinksScript, /Custodial is Android-only and cannot configure iOS native links/);
assert.match(
  nativeReleaseScript,
  /ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c/,
);
for (const id of ['org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer']) assert.match(capacitorConfig, new RegExp(id.replaceAll('.', '\\.')));
assert.doesNotMatch(capacitorConfig, /@capacitor\/barcode-scanner/);
assert.match(capacitorConfig, /loggingBehavior: 'debug'/, 'signed release apps must suppress native bridge payload logging');
assert.doesNotMatch(capacitorConfig, /loggingBehavior: 'production'/, 'signed apps must never log SecureStorage and push-token payloads');
assert.match(capacitorConfig, /webContentsDebuggingEnabled: false/, 'signed Android apps must disable WebView debugging');
assert.match(capacitorConfig, /cleartext: false, appStartPath: '\/app-shell\.html'/, 'Custodial must use only its packaged local shell over HTTPS');
assert.match(capacitorConfig, /allowMixedContent: false/, 'Custodial must explicitly disable Android mixed content');
assert.match(capacitorConfig, /useLegacyBridge: false/, 'Custodial must explicitly require the modern WebMessage bridge');
assert.match(capacitorConfig, /resolveServiceWorkerRequests: true/, 'Custodial service-worker requests must stay inside the Capacitor bridge');
assert.match(capacitorConfig, /custodial \? \{\} : \{[\s\S]*ios:/, 'Custodial must omit the unused iOS config while manager and viewer retain it');
assert.match(capacitorConfig, /viewer \|\| custodial \? \{\} : \{[\s\S]*experimental:/, 'Custodial and viewer must omit manager-only iOS package options');
assert.doesNotMatch(capacitorConfig, /\bcordova\s*:/, 'Custodial config must not add a Cordova bridge policy');
assert.match(mobilePackage, /build:custodial/);
assert.match(mobilePackage, /"@capacitor\/android": "8\.4\.2"/);
assert.doesNotMatch(mobilePackage, /@capacitor\/barcode-scanner/);
const variablesFixture = 'ext {\n    minSdkVersion = 24\n}\n';
assert.equal(
  configureAndroidVariablesSource(variablesFixture, 'custodial'),
  'ext {\n    minSdkVersion = 26\n}\n',
);
assert.equal(configureAndroidVariablesSource(variablesFixture, 'manager'), variablesFixture);
assert.throws(
  () => configureAndroidVariablesSource('ext {}\n', 'custodial'),
  /minimum SDK declaration must occur exactly 1 time/,
);

for (const [edition, bytes] of [
  ['manager', managerLockBytes],
  ['viewer', viewerLockBytes],
]) {
  validateSwiftLock(JSON.parse(bytes), edition);
}
assert.throws(
  () => validateSwiftLock({ version: 2, pins: [] }, 'custodial'),
  /Custodial is Android-only/,
);
const androidGraphs = new Map();
for (const [edition, bytes] of [
  ['manager', managerAndroidVerificationBytes],
  ['custodial', custodialAndroidVerificationBytes],
  ['viewer', viewerAndroidVerificationBytes],
]) {
  validateGradleVerificationMetadata(bytes, edition);
  androidGraphs.set(edition, inspectGradleVerificationMetadata(bytes, edition));
}
const sharedAndroidArtifacts = new Map();
for (const [edition, graph] of androidGraphs) {
  for (const [artifact, checksum] of graph.artifacts) {
    if (sharedAndroidArtifacts.has(artifact)) {
      assert.equal(
        checksum,
        sharedAndroidArtifacts.get(artifact),
        `${artifact} checksum drifted across Android editions`,
      );
    } else {
      sharedAndroidArtifacts.set(artifact, checksum);
    }
  }
}
const macosAapt2Artifact = 'com.android.tools.build:aapt2:8.13.0-13719691/aapt2-8.13.0-13719691-osx.jar';
assert.equal(
  sharedAndroidArtifacts.get(macosAapt2Artifact),
  '29213e18381a5d8c72932f8bbd06349f99131ec3b13c14e8c0ec90738b865ca1',
  'Every Android edition must trust the Google-published macOS AAPT2 artifact used by the free M2 builder',
);
assert.throws(
  () => inspectGradleVerificationMetadata(
    custodialAndroidVerificationBytes.toString('utf8').replace('origin="Google Maven SHA-256"', 'origin="Unreviewed source"'),
    'custodial',
  ),
  /invalid SHA-256 record/,
  'Gradle trust metadata must reject checksum origins outside the reviewed allowlist',
);
assert.throws(
  () => inspectGradleVerificationMetadata(
    viewerAndroidVerificationBytes.toString('utf8').replace(
      /      <component group="com\.google\.guava" name="guava-parent" version="33\.3\.1-jre">[\s\S]*?      <\/component>\n/,
      '',
    ),
    'viewer',
  ),
  /missing required artifact com\.google\.guava:guava-parent:33\.3\.1-jre/,
);
assert.throws(() => validateGradleWrapperJar(Buffer.from('not the approved wrapper')), /does not match/);
assert.deepEqual(resolveBuildNumber({ PROJECT_BUILD_NUMBER: '420' }), {
  value: '420',
  numeric: 420,
  source: 'PROJECT_BUILD_NUMBER',
});
assert.throws(() => resolveBuildNumber({ PROJECT_BUILD_NUMBER: '0' }), /positive integer/);
assert.throws(() => resolveBuildNumber({ PROJECT_BUILD_NUMBER: '2100000001' }), /no greater than/);
assert.equal(assertEditionBuildFloor('custodial', 30), 30);
assert.equal(assertEditionBuildFloor('custodial', 31), 31);
assert.equal(assertEditionBuildFloor('custodial', 32), 32);
assert.equal(assertEditionBuildFloor('custodial', 515), 515, 'debug and emulator build numbers are not production candidates');
assert.throws(() => assertEditionBuildFloor('custodial', 29), /protected release floor 30/);
assert.equal(assertEditionBuildFloor('manager', 1), 1);
assert.equal(resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0.0' }), '1.0.0');
assert.throws(() => resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0' }), /three numeric components/);

const syntheticGradle = 'android { buildTypes { release { minifyEnabled false } } }\n';
const configuredGradle = injectAndroidOverlay(syntheticGradle);
assert.match(configuredGradle, /native-version\.gradle/);
assert.match(configuredGradle, /codemagic-release\.gradle/);
assert.equal(injectAndroidOverlay(configuredGradle), configuredGradle, 'Android overlay injection must be idempotent');
const configuredUnsignedGradle = injectAndroidOverlay(syntheticGradle, { includeSigning: false });
assert.match(configuredUnsignedGradle, /native-version\.gradle/);
assert.doesNotMatch(configuredUnsignedGradle, /codemagic-release\.gradle/);

const syntheticWrapper = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
const configuredWrapper = configureGradleWrapperSource(syntheticWrapper);
assert.match(
  configuredWrapper,
  /^distributionSha256Sum=ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c$/m,
);
assert.equal(
  configureGradleWrapperSource(configuredWrapper),
  configuredWrapper,
  'Gradle wrapper checksum configuration must be idempotent',
);
assert.throws(
  () => configureGradleWrapperSource(
    syntheticWrapper.replace(
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip',
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.2-all.zip',
    ),
  ),
  /approved Gradle wrapper distribution URL/,
);
assert.throws(
  () => configureGradleWrapperSource(
    syntheticWrapper.replace(
      'distributionUrl=',
      `distributionSha256Sum=${'0'.repeat(64)}\ndistributionUrl=`,
    ),
  ),
  /checksum does not match/,
);

const syntheticProject = `/* Begin PBXBuildFile section */
/* End PBXBuildFile section */
/* Begin PBXFileReference section */
/* End PBXFileReference section */
\t\t504EC3061FED79650016851F /* App */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t);
\t\t};
\t\t504EC3021FED79650016851F /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t};
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = org.memphiszoo.ops;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = org.memphiszoo.ops;
`;
const configuredProject = configureIosProjectSource(syntheticProject, {
  appIdentifier: 'org.memphiszoo.ops',
  buildNumber: '420',
  releaseVersion: '1.0.0',
  includeFirebase: true,
});
assert.equal(
  configureIosProjectSource(configuredProject, {
    appIdentifier: 'org.memphiszoo.ops',
    buildNumber: '420',
    releaseVersion: '1.0.0',
    includeFirebase: true,
  }),
  configuredProject,
  'iOS release configuration must be idempotent',
);
assert.equal((configuredProject.match(/CURRENT_PROJECT_VERSION = 420;/g) || []).length, 2);
assert.equal((configuredProject.match(/VERSIONING_SYSTEM = apple-generic;/g) || []).length, 2);
assert.equal((configuredProject.match(/GoogleService-Info\.plist in Resources/g) || []).length, 2);

const syntheticManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <activity android:name=".MainActivity">
    </activity>
  </application>
</manifest>
`;
const generatedCustodialMainActivity = `package org.memphiszoo.custodial;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
`;
const configuredCustodialMainActivity = configureAndroidMainActivitySource(
  generatedCustodialMainActivity,
  'custodial',
);
assert.equal(
  configureAndroidMainActivitySource(configuredCustodialMainActivity, 'custodial'),
  configuredCustodialMainActivity,
  'Custodial NFC intent normalization must be idempotent',
);
for (const proof of [
  'NfcAdapter.ReaderCallback',
  'recordPhysicalNfcHandoff',
  'NativeNfcScanHandoff.recordPhysicalRead',
  'Ndef.get(tag)',
  'appendQueryParameter(NativeNfcScanHandoff.QUERY_PARAMETER',
  'setIntent(normalizeExternalIntent(getIntent()))',
  'setIntent(normalized)',
  'super.onNewIntent(normalized)',
]) assert.ok(configuredCustodialMainActivity.includes(proof), `Custodial MainActivity is missing ${proof}`);
assert.equal(
  configureAndroidMainActivitySource(generatedCustodialMainActivity, 'manager'),
  generatedCustodialMainActivity,
  'Custodial NFC normalization must not alter another edition',
);
assert.throws(
  () => configureAndroidMainActivitySource(
    generatedCustodialMainActivity.replace('{}', '{ void unreviewed() {} }'),
    'custodial',
  ),
  /differs from the reviewed Capacitor entrypoint/,
);
for (const [edition, requiredHosts, prohibitedHosts] of [
  ['manager', ['route', 'event'], ['scan']],
  ['custodial', ['route', 'event', 'scan'], []],
  ['viewer', ['route'], ['event', 'scan']],
]) {
  const configuredManifest = configureAndroidManifestSource(
    syntheticManifest,
    edition,
    { shellProof: true },
  );
  assert.equal(
    configureAndroidManifestSource(configuredManifest, edition, { shellProof: true }),
    configuredManifest,
    `${edition} Android native links must be idempotent`,
  );
  for (const host of requiredHosts) {
    assert.match(
      configuredManifest,
      new RegExp(`android:scheme="memphiszoo-${edition}" android:host="${host}"`),
    );
  }
  for (const host of prohibitedHosts) {
    assert.doesNotMatch(
      configuredManifest,
      new RegExp(`android:scheme="memphiszoo-${edition}" android:host="${host}"`),
    );
  }
  assert.doesNotMatch(configuredManifest, /memphiszoo\.custodial\.NFC_SCAN/);
  assert.equal(
    configuredManifest.includes('android.nfc.action.NDEF_DISCOVERED'),
    edition === 'custodial',
  );
  for (const other of ['manager', 'custodial', 'viewer'].filter((name) => name !== edition)) {
    assert.doesNotMatch(configuredManifest, new RegExp(`android:scheme="memphiszoo-${other}"`));
  }
  assert.doesNotMatch(configuredManifest, /android:autoVerify="true"/);
}
for (const edition of ['manager', 'viewer']) {
  assert.doesNotMatch(
    configureAndroidManifestSource(syntheticManifest, edition),
    /android:scheme="memphiszoo/,
  );
}
const productionCustodialManifest = configureAndroidManifestSource(syntheticManifest, 'custodial');
assert.match(productionCustodialManifest, /android:scheme="memphiszoo" android:host="scan"/);
assert.doesNotMatch(productionCustodialManifest, /android:scheme="memphiszoo-custodial"/);

const insecureBackupManifest = syntheticManifest.replace(
  '<application>',
  '<application android:allowBackup="true" android:fullBackupContent="@xml/legacy_default">',
);
const secureBackupManifest = configureAndroidBackupManifestSource(insecureBackupManifest);
assertAndroidBackupManifestSecurity(secureBackupManifest);
assert.equal(
  configureAndroidBackupManifestSource(secureBackupManifest),
  secureBackupManifest,
  'Android backup hardening must be idempotent',
);
assert.match(secureBackupManifest, /android:allowBackup="false"/);
assert.match(secureBackupManifest, /android:fullBackupContent="@xml\/memphis_zoo_backup_rules"/);
assert.match(secureBackupManifest, /android:dataExtractionRules="@xml\/memphis_zoo_data_extraction_rules"/);
assert.doesNotMatch(secureBackupManifest, /legacy_default|android:allowBackup="true"/);
assertAndroidBackupRulesSecurity({ legacy: legacyBackupRules, extraction: dataExtractionRules });
assert.match(dataExtractionRules, /<cloud-backup>/);
assert.match(dataExtractionRules, /<device-transfer>/);
assert.doesNotMatch(`${legacyBackupRules}\n${dataExtractionRules}`, /<include\b/);
const immutableAndroidBackupDomains = Object.freeze([
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
assert.deepEqual(androidBackupDomains, immutableAndroidBackupDomains, 'backup generator domains must match the immutable literal policy');
assert.deepEqual(CUSTODIAL_RELEASE_BACKUP_DOMAINS, immutableAndroidBackupDomains, 'release acceptance domains must match the immutable literal policy');
for (const domain of immutableAndroidBackupDomains) {
  const pattern = new RegExp(`<exclude domain="${domain}" path="\\." \\/>`, 'g');
  assert.equal([...legacyBackupRules.matchAll(pattern)].length, 1, `${domain} must be excluded from legacy backup`);
  assert.equal([...dataExtractionRules.matchAll(pattern)].length, 2, `${domain} must be excluded from cloud and D2D transfer`);
}
assert.throws(
  () => configureAndroidBackupManifestSource('<manifest><application></application><application></application></manifest>'),
  /exactly one application element/,
);
const compiledManifestProof = `
E: manifest (line=2)
  A: package="org.memphiszoo.custodial" (Raw: "org.memphiszoo.custodial")
  A: android:versionCode(0x0101021b)=(type 0x10)0x0000001f
  A: android:versionName(0x0101021c)="1.0.0" (Raw: "1.0.0")
  E: uses-sdk (line=7)
    A: android:minSdkVersion(0x0101020c)=(type 0x10)0x0000001a
    A: android:targetSdkVersion(0x01010270)=(type 0x10)0x00000024
  E: application (line=10)
    A: android:allowBackup(0x01010280)=false
    A: android:fullBackupContent(0x010103f1)=@0x7f110001
    A: android:dataExtractionRules(0x01010650)=@0x7f110002
`;
const compiledBadgingProof = `package: name='org.memphiszoo.custodial' versionCode='31' versionName='1.0.0' compileSdkVersion='36'
sdkVersion:'26'
targetSdkVersion:'36'
`;
const compiledBadgingMinSdkProof = compiledBadgingProof.replace("sdkVersion:'26'", "minSdkVersion:'26'");
const compiledResourcesProof = `
resource 0x7f110001 xml/memphis_zoo_backup_rules
  () (file) res/8K.xml type=XML
resource 0x7f0d0001 layout/activity_main
  () (file) res/7A.xml type=XML
resource 0x7f110002 xml/memphis_zoo_data_extraction_rules
  () (file) res/8L.xml type=XML
`;
const compiledExclusions = (domains, indentation) => domains.map((domain) => `${indentation}E: exclude (line=1)
${indentation}  A: domain="${domain}" (Raw: "${domain}")
${indentation}  A: path="." (Raw: ".")`).join('\n');
const compiledLegacyRulesProof = `E: full-backup-content (line=1)
${compiledExclusions(immutableAndroidBackupDomains, '  ')}
`;
const compiledExtractionRulesProof = `E: data-extraction-rules (line=1)
  E: cloud-backup (line=2)
${compiledExclusions(immutableAndroidBackupDomains, '    ')}
  E: device-transfer (line=13)
${compiledExclusions(immutableAndroidBackupDomains, '    ')}
`;
const compiledBackupProof = assertCompiledAndroidBackupSecurity({
  manifestDump: compiledManifestProof,
  resourcesDump: compiledResourcesProof,
  legacyRulesDump: compiledLegacyRulesProof,
  extractionRulesDump: compiledExtractionRulesProof,
});
assert.equal(compiledBackupProof.legacy_resource.packaged_path, 'res/8K.xml');
assert.equal(compiledBackupProof.data_extraction_resource.packaged_path, 'res/8L.xml');
assert.match(compiledBackupProof.legacy_resource.semantic_sha256, /^[a-f0-9]{64}$/);
const compiledManifestUriProof = compiledManifestProof.replaceAll(
  'android:',
  'http://schemas.android.com/apk/res/android:',
);
assert.doesNotThrow(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestUriProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  'the verifier must accept the namespace-URI attribute names emitted by real aapt2 builds',
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof.replace('=false', '=true'),
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /allowBackup=false/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof.replace('android:allowBackup', 'lookalike:allowBackup'),
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /allowBackup=false/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof.replace('@0x7f110001', '@0x7f110099'),
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /does not bind/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof.replace(
      '  () (file) res/8K.xml type=XML',
      '  () (file) res/8K.xml type=XML\n  (v31) (file) res/8M.xml type=XML',
    ),
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /exactly one default file/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: `E: full-backup-content\n${compiledExclusions(immutableAndroidBackupDomains.slice(1), '  ')}\n`,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /exactly 9 exclusions/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof.replace('E: exclude', 'E: include'),
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /only empty exclude elements/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof
      .replace('  E: cloud-backup', '  E: temporary')
      .replace('  E: device-transfer', '  E: cloud-backup')
      .replace('  E: temporary', '  E: device-transfer'),
  }),
  /exactly cloud-backup then device-transfer/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof.replace(
      '    A: path="." (Raw: ".")',
      '    A: path="." (Raw: ".")\n    T: "unexpected"',
    ),
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /only empty exclude elements/,
);

const compiledCustodialApplication = assertCustodialReleaseManifest({
  manifestDump: compiledManifestProof,
  badgingDump: compiledBadgingProof,
  expectedBuildNumber: 31,
});
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replace('0x0000001f', '0x00000020'),
    badgingDump: compiledBadgingProof.replace("versionCode='31'", "versionCode='32'"),
    expectedBuildNumber: 32,
  }),
  /must not outrun staged recovery 32/,
  'a candidate must fail closed before it reaches the staged recovery package versionCode',
);
assert.deepEqual(
  assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replace('0x0000001f', '0x00000204'),
    badgingDump: compiledBadgingProof.replace("versionCode='31'", "versionCode='516'"),
    expectedBuildNumber: 516,
    enforceStagedRecoveryCeiling: false,
  }),
  {
    ...compiledCustodialApplication,
    version_code: 516,
  },
  'an explicitly ephemeral test-signed release may use the CI run number without weakening the production recovery ceiling',
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof,
    badgingDump: compiledBadgingProof,
    expectedBuildNumber: 31,
    enforceStagedRecoveryCeiling: null,
  }),
  /ceiling enforcement must be explicitly boolean/,
  'an invalid ceiling override must fail closed',
);
assert.deepEqual(
  assertCustodialReleaseManifest({
    manifestDump: compiledManifestUriProof,
    badgingDump: compiledBadgingMinSdkProof,
    expectedBuildNumber: 31,
  }),
  compiledCustodialApplication,
  'the release verifier must accept the exact namespace and minSdk labels emitted by pinned aapt2',
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof,
    badgingDump: compiledBadgingProof.replace("targetSdkVersion:'36'", "minSdkVersion:'26'\ntargetSdkVersion:'36'"),
    expectedBuildNumber: 31,
  }),
  /exactly one minimum and target SDK/,
  'conflicting duplicate minimum SDK labels must fail closed',
);
assert.deepEqual(compiledCustodialApplication, {
  package_name: CUSTODIAL_PACKAGE_NAME,
  version_code: 31,
  version_name: '1.0.0',
  min_sdk_version: 26,
  target_sdk_version: 36,
  debuggable: false,
  test_only: false,
});
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replaceAll('org.memphiszoo.custodial', 'org.memphiszoo.attacker'),
    badgingDump: compiledBadgingProof.replaceAll('org.memphiszoo.custodial', 'org.memphiszoo.attacker'),
    expectedBuildNumber: 31,
  }),
  /package must be org\.memphiszoo\.custodial/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof,
    badgingDump: compiledBadgingProof,
    expectedBuildNumber: 29,
  }),
  /protected release floor 30/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replace('0x0000001f', '0x0000001d'),
    badgingDump: compiledBadgingProof.replace("versionCode='31'", "versionCode='29'"),
    expectedBuildNumber: 31,
  }),
  /Compiled Custodial versionCode must be at least protected release floor 30/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof,
    badgingDump: compiledBadgingProof,
    expectedBuildNumber: 30,
  }),
  /does not match build 30/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replace('0x00000024', '0x00000023'),
    badgingDump: compiledBadgingProof.replace("targetSdkVersion:'36'", "targetSdkVersion:'35'"),
    expectedBuildNumber: 31,
  }),
  /targetSdkVersion must be 36/,
);
const debuggableManifest = compiledManifestProof.replace(
  '    A: android:allowBackup',
  '    A: android:debuggable(0x0101000f)=true\n    A: android:allowBackup',
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: debuggableManifest,
    badgingDump: `${compiledBadgingProof}application-debuggable\n`,
    expectedBuildNumber: 31,
  }),
  /must not be debuggable/,
);
const testOnlyManifest = compiledManifestProof.replace(
  '    A: android:allowBackup',
  '    A: android:testOnly(0x01010272)=true\n    A: android:allowBackup',
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: testOnlyManifest,
    badgingDump: compiledBadgingProof.replace("versionName='1.0.0'", "versionName='1.0.0' testOnly='true'"),
    expectedBuildNumber: 31,
  }),
  /must not be testOnly/,
);

const acceptedSourceCommit = '0123456789abcdef0123456789abcdef01234567';
const acceptedSourceTree = '89abcdef0123456789abcdef0123456789abcdef';
const acceptedNativeVaultSourceSha256 = 'a'.repeat(64);
const embeddedBuildIdentity = {
  edition: 'custodial',
  release_id: '2026-08-01',
  source_commit: acceptedSourceCommit,
  source_tree: acceptedSourceTree,
  source_commit_exact: true,
  custodial_native_vault_source_sha256: acceptedNativeVaultSourceSha256,
  build_id: `2026-08-01.custodial.${acceptedSourceCommit.slice(0, 12)}`,
  native_build_number: 31,
};
const embeddedBuildIdentitySource = `globalThis.MemphisMobileBuild="31";globalThis.MemphisMobileBuildIdentity=${JSON.stringify(embeddedBuildIdentity)};\n`;
assert.deepEqual(parseEmbeddedBuildIdentity(embeddedBuildIdentitySource), embeddedBuildIdentity);
assert.throws(
  () => parseEmbeddedBuildIdentity(`${embeddedBuildIdentitySource}globalThis.injected=true;`),
  /unexpected or trailing content/,
);
const embeddedProvenance = assertEmbeddedCustodialProvenance({
  buildJson: embeddedBuildIdentity,
  runtimeAssetManifest: embeddedBuildIdentity,
  buildIdentity: embeddedBuildIdentity,
  expectedBuildNumber: 31,
  expectedSourceCommit: acceptedSourceCommit,
  expectedSourceTree: acceptedSourceTree,
  expectedNativeVaultSourceSha256: acceptedNativeVaultSourceSha256,
});
const runtimeBytes = new Map([
  ['assets/public/app.js', Buffer.from('console.log("custodial");\n')],
  ['assets/public/nested/app.css', Buffer.from('body{color:#fff}\n')],
  ['assets/public/cordova.js', Buffer.alloc(0)],
  ['assets/public/cordova_plugins.js', Buffer.alloc(0)],
]);
const fixtureSha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runtimeAssetFixture = {
  ...embeddedBuildIdentity,
  schema_version: 1,
  asset_count: 2,
  asset_hashes_sha256: {
    'app.js': fixtureSha256(runtimeBytes.get('assets/public/app.js')),
    'nested/app.css': fixtureSha256(runtimeBytes.get('assets/public/nested/app.css')),
  },
};
const runtimeZipEntries = [
  'assets/public/app.js',
  'assets/public/nested/app.css',
  'assets/public/runtime-asset-manifest.json',
  'assets/public/cordova.js',
  'assets/public/cordova_plugins.js',
];
const runtimeProof = assertEmbeddedRuntimeAssets({
  runtimeAssetManifest: runtimeAssetFixture,
  zipEntries: runtimeZipEntries,
  readEntry: (entry) => runtimeBytes.get(entry) || Buffer.from('manifest-bytes'),
});
assert.equal(runtimeProof.runtime_asset_count, 2);
assert.equal(runtimeProof.runtime_assets_verified, true);
assert.equal(runtimeProof.capacitor_generated_assets_sha256['cordova.js'], fixtureSha256(Buffer.alloc(0)));
assert.equal(runtimeProof.capacitor_generated_assets_sha256['cordova_plugins.js'], fixtureSha256(Buffer.alloc(0)));
assert.throws(
  () => assertEmbeddedRuntimeAssets({
    runtimeAssetManifest: runtimeAssetFixture,
    zipEntries: runtimeZipEntries,
    readEntry: (entry) => entry === 'assets/public/cordova.js'
      ? Buffer.from('unexpected generated code')
      : runtimeBytes.get(entry) || Buffer.from('manifest-bytes'),
  }),
  /Capacitor placeholder must be exactly empty/,
);
assert.throws(
  () => assertEmbeddedRuntimeAssets({
    runtimeAssetManifest: runtimeAssetFixture,
    zipEntries: runtimeZipEntries,
    readEntry: (entry) => entry === 'assets/public/app.js' ? Buffer.from('changed') : runtimeBytes.get(entry) || Buffer.from('manifest-bytes'),
  }),
  /runtime asset hash differs/,
);
assert.throws(
  () => assertEmbeddedRuntimeAssets({
    runtimeAssetManifest: runtimeAssetFixture,
    zipEntries: [...runtimeZipEntries, 'assets/public/unmanifested.js'],
    readEntry: (entry) => runtimeBytes.get(entry) || Buffer.from('manifest-bytes'),
  }),
  /runtime graph differs/,
);
for (const placeholder of CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS) {
  const extracted = singleApkEntry(
    { unzip: '/reviewed/unzip' },
    '/fixture/app.apk',
    placeholder,
    [placeholder],
    (_file, _args, options) => {
      assert.equal(options.encoding, null);
      return { status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    },
  );
  assert.ok(Buffer.isBuffer(extracted));
  assert.equal(extracted.length, 0);
}
assert.throws(
  () => singleApkEntry(
    { unzip: '/reviewed/unzip' },
    '/fixture/app.apk',
    'assets/public/empty-runtime.js',
    ['assets/public/empty-runtime.js'],
    () => ({ status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }),
  ),
  /Unable to extract assets\/public\/empty-runtime\.js/,
);
Object.assign(embeddedProvenance, {
  ...runtimeProof,
  build_json_sha256: '1'.repeat(64),
  runtime_asset_manifest_sha256: '2'.repeat(64),
  build_identity_js_sha256: '3'.repeat(64),
});
assert.throws(
  () => assertEmbeddedCustodialProvenance({
    buildJson: { ...embeddedBuildIdentity, native_build_number: null },
    runtimeAssetManifest: embeddedBuildIdentity,
    buildIdentity: embeddedBuildIdentity,
    expectedBuildNumber: 31,
    expectedSourceCommit: acceptedSourceCommit,
    expectedSourceTree: acceptedSourceTree,
    expectedNativeVaultSourceSha256: acceptedNativeVaultSourceSha256,
  }),
  /native build number/,
);
assert.equal(normalizeCustodialSourceRef('main'), 'refs/heads/main');
assert.equal(normalizeCustodialSourceRef(CUSTODIAL_FORWARD_RECOVERY_BRANCH), CUSTODIAL_FORWARD_RECOVERY_REF);
assert.equal(requiresCustodialStagedRecoveryCeiling('main'), true);
assert.equal(requiresCustodialStagedRecoveryCeiling(CUSTODIAL_FORWARD_RECOVERY_BRANCH), false);
assert.throws(
  () => requiresCustodialStagedRecoveryCeiling('release/custodial-build29-recovery-v33-implementation-20260815'),
  /exact Build 29 recovery branch/,
);
assert.throws(() => normalizeCustodialSourceRef('feature/unreviewed'), /protected main/);
const nodeVersionFixture = (source) => [
  '-e',
  source,
];
assert.equal(
  successfulToolVersion(
    process.execPath,
    nodeVersionFixture('process.stderr.write("Android Asset Packaging Tool (aapt) stderr-only\\n")'),
    'stderr-only tool version fixture',
  ),
  'Android Asset Packaging Tool (aapt) stderr-only',
  'Tool provenance must capture the real stderr-only behavior of pinned aapt2',
);
assert.equal(
  successfulToolVersion(
    process.execPath,
    nodeVersionFixture('process.stdout.write("apksigner stdout-only 0.9\\n")'),
    'stdout-only tool version fixture',
  ),
  'apksigner stdout-only 0.9',
  'Tool provenance must retain the stdout-only behavior of apksigner and unzip',
);
assert.equal(
  successfulToolVersion(
    process.execPath,
    nodeVersionFixture('process.stdout.write("stdout version\\n"); process.stderr.write("stderr warning\\n")'),
    'mixed-stream tool version fixture',
  ),
  'stdout version',
  'Tool provenance must prefer canonical stdout when a successful tool writes both streams',
);
assert.throws(
  () => successfulToolVersion(
    process.execPath,
    nodeVersionFixture('process.stdout.write("stale stdout version\\n"); process.stderr.write("version command failed\\n"); process.exit(7)'),
    'failed tool version fixture',
  ),
  /failed tool version fixture failed: version command failed/,
);
assert.throws(
  () => successfulToolVersion(
    process.execPath,
    nodeVersionFixture(''),
    'empty tool version fixture',
  ),
  /did not report a version on stdout or stderr/,
);
assert.throws(
  () => successfulToolVersion(
    process.execPath,
    nodeVersionFixture('process.stdout.write("  \\n"); process.stderr.write("\\t\\n")'),
    'whitespace-only tool version fixture',
  ),
  /did not report a version on stdout or stderr/,
);
const alignmentProof = assertZipalignVerification({ status: 0 });
assert.throws(() => assertZipalignVerification({ status: 1, output: 'Verification FAILED' }), /alignment verification failed/);
const toolProof = (path, version, sha256 = '4'.repeat(64)) => ({ path, version, sha256 });
const runtimeBridgeFixture = Buffer.from('CustodialNativeVault.authorizedRequest({});\n');
const custodialPluginManifestBytes = Buffer.from(
  `${JSON.stringify(CUSTODIAL_CAPACITOR_PLUGIN_PAIRS, null, '\t')}\n`,
);
const custodialCapacitorConfigBytes = Buffer.from(
  `${JSON.stringify(CUSTODIAL_CAPACITOR_CONFIG, null, '\t')}\n`,
);
const compareRuntimeEntryNames = (left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
const custodialRuntimeExecutables = (entries) => [
  ...CUSTODIAL_EMPTY_CAPACITOR_PLACEHOLDERS.map((name) => ({ name, bytes: Buffer.alloc(0) })),
  ...entries,
].sort(compareRuntimeEntryNames);
const nativeSecurityProof = {
  ...assertCustodialNativeSecurityBoundary({
    pluginManifestBytes: custodialPluginManifestBytes,
    capacitorConfigBytes: custodialCapacitorConfigBytes,
    dexEntries: [{
      name: 'classes.dex',
      bytes: dexFixture([`L${CUSTODIAL_NATIVE_VAULT_CLASS.replaceAll('.', '/')};`]),
    }],
    runtimeBridgeBytes: runtimeBridgeFixture,
    runtimeExecutableEntries: custodialRuntimeExecutables([
      { name: 'assets/public/memphis-custodial-bridge.js', bytes: runtimeBridgeFixture },
      {
        name: 'assets/public/shell-assets/custodial-app-shell-Fixture1.js',
        bytes: Buffer.from('CustodialNativeVault.getState();\n'),
      },
    ]),
  }),
};
Object.assign(nativeSecurityProof, {
  dex_semantic_verifier_version: CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION,
  native_class_closure_verified: true,
  plugin_extends_capacitor_plugin: true,
  plugin_annotation_verified: true,
  plugin_methods_verified: true,
  plugin_method_names: [...CUSTODIAL_NATIVE_VAULT_PLUGIN_METHODS],
  required_class_locations: Object.fromEntries(
    CUSTODIAL_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS.map((descriptor) => [descriptor, 'classes.dex']),
  ),
});
assert.equal(
  nativeSecurityProof.webview_executable_sha256['assets/public/cordova.js'],
  fixtureSha256(Buffer.alloc(0)),
);
assert.equal(
  nativeSecurityProof.webview_executable_sha256['assets/public/cordova_plugins.js'],
  fixtureSha256(Buffer.alloc(0)),
);
const nativeBoundaryFixture = (runtimeExecutableEntries) => assertCustodialNativeSecurityBoundary({
  pluginManifestBytes: custodialPluginManifestBytes,
  capacitorConfigBytes: custodialCapacitorConfigBytes,
  dexEntries: [{
    name: 'classes.dex',
    bytes: dexFixture([`L${CUSTODIAL_NATIVE_VAULT_CLASS.replaceAll('.', '/')};`]),
  }],
  runtimeBridgeBytes: runtimeBridgeFixture,
  runtimeExecutableEntries,
});
const safeRuntimeExecutableFixture = custodialRuntimeExecutables([
  { name: 'assets/public/memphis-custodial-bridge.js', bytes: runtimeBridgeFixture },
  {
    name: 'assets/public/shell-assets/custodial-app-shell-Fixture1.js',
    bytes: Buffer.from('CustodialNativeVault.getState();\n'),
  },
]);
assert.throws(
  () => nativeBoundaryFixture(
    safeRuntimeExecutableFixture.filter((entry) => entry.name !== 'assets/public/cordova_plugins.js'),
  ),
  /placeholder must occur once and be exactly empty: assets\/public\/cordova_plugins\.js/,
);
assert.throws(
  () => nativeBoundaryFixture(safeRuntimeExecutableFixture.map((entry) => (
    entry.name === 'assets/public/cordova.js'
      ? { ...entry, bytes: Buffer.from('unexpected generated code') }
      : entry
  ))),
  /placeholder must occur once and be exactly empty: assets\/public\/cordova\.js/,
);
assert.throws(
  () => nativeBoundaryFixture([
    ...safeRuntimeExecutableFixture,
    { name: 'assets/public/empty-runtime.js', bytes: Buffer.alloc(0) },
  ].sort(compareRuntimeEntryNames)),
  /executable source is empty: assets\/public\/empty-runtime\.js/,
);
assert.throws(
  () => assertCustodialNativeSecurityBoundary({
    pluginManifestBytes: custodialPluginManifestBytes,
    capacitorConfigBytes: custodialCapacitorConfigBytes,
    dexEntries: [{
      name: 'classes.dex',
      bytes: dexFixture([`L${CUSTODIAL_NATIVE_VAULT_CLASS.replaceAll('.', '/')};`]),
    }],
    runtimeBridgeBytes: runtimeBridgeFixture,
    runtimeExecutableEntries: custodialRuntimeExecutables([
      { name: 'assets/public/memphis-custodial-bridge.js', bytes: runtimeBridgeFixture },
      { name: 'assets/public/other-runtime.js', bytes: Buffer.from('headers.set("X-Device-Credential", secret);') },
      { name: 'assets/public/shell-assets/custodial-app-shell-Fixture1.js', bytes: Buffer.from('CustodialNativeVault.getState();') },
    ]),
  }),
  /prohibited credential path in .*other-runtime\.js/,
);
assert.throws(
  () => assertCustodialNativeSecurityBoundary({
    pluginManifestBytes: custodialPluginManifestBytes,
    capacitorConfigBytes: custodialCapacitorConfigBytes,
    dexEntries: [{
      name: 'classes.dex',
      bytes: dexFixture([`L${CUSTODIAL_NATIVE_VAULT_CLASS.replaceAll('.', '/')};`]),
    }],
    runtimeBridgeBytes: runtimeBridgeFixture,
    runtimeExecutableEntries: custodialRuntimeExecutables([
      { name: 'assets/public/index.html', bytes: Buffer.from('<script>headers.append("X-Device-Credential", secret)</script>') },
      { name: 'assets/public/memphis-custodial-bridge.js', bytes: runtimeBridgeFixture },
      { name: 'assets/public/shell-assets/custodial-app-shell-Fixture1.js', bytes: Buffer.from('CustodialNativeVault.getState();') },
    ]),
  }),
  /prohibited credential path in .*index\.html/,
);
assert.throws(
  () => assertCustodialNativeSecurityBoundary({
    pluginManifestBytes: custodialPluginManifestBytes,
    capacitorConfigBytes: custodialCapacitorConfigBytes,
    dexEntries: [{
      name: 'classes.dex',
      bytes: dexFixture([`L${CUSTODIAL_NATIVE_VAULT_CLASS.replaceAll('.', '/')};`]),
    }],
    runtimeBridgeBytes: runtimeBridgeFixture,
    runtimeExecutableEntries: custodialRuntimeExecutables([
      { name: 'assets/public/memphis-custodial-bridge.js', bytes: runtimeBridgeFixture },
      { name: 'assets/public/shell-assets/custodial-app-shell-Fixture1.js', bytes: Buffer.from('CustodialNativeVault.getState(); CustodialNativeVault.authorizedRequest({});') },
    ]),
  }),
  /role shell contains a privileged native mutation path/,
);
assert.throws(
  () => assertCustodialNativeSecurityBoundary({
    pluginManifestBytes: Buffer.from(JSON.stringify([{
      pkg: '@aparajita/capacitor-secure-storage',
      classpath: 'com.aparajita.capacitor.securestorage.SecureStorage',
    }])),
    capacitorConfigBytes: custodialCapacitorConfigBytes,
    dexEntries: [{ name: 'classes.dex', bytes: Buffer.from('dex') }],
    runtimeBridgeBytes: Buffer.from(''),
  }),
  /must contain exactly 6 entries/,
);
assert.throws(
  () => assertCustodialNativeSecurityBoundary({
    pluginManifestBytes: custodialPluginManifestBytes,
    capacitorConfigBytes: custodialCapacitorConfigBytes,
    dexEntries: [{
      name: 'classes.dex',
      bytes: dexFixture([
        `L${CUSTODIAL_NATIVE_VAULT_CLASS.replaceAll('.', '/')};`,
        `L${CUSTODIAL_OLD_SECURE_STORAGE_CLASS.replaceAll('.', '/')};`,
      ]),
    }],
    runtimeBridgeBytes: Buffer.from('CustodialNativeVault.authorizedRequest({});\n'),
  }),
  /old SecureStorage plugin class/,
);
const releaseAcceptanceInput = {
  generatedAt: '2026-08-01T12:00:00.000Z',
  artifact: { file_name: 'app-release.apk', apk_sha256: '5'.repeat(64), size_bytes: 123456 },
  application: compiledCustodialApplication,
  embeddedProvenance,
  sourceCommit: acceptedSourceCommit,
  sourceTree: acceptedSourceTree,
  sourceRef: 'main',
  buildRun: 'cm-build-123',
  buildWorkflow: CUSTODIAL_CODEMAGIC_WORKFLOW,
  buildNumber: 31,
  signing: {
    signer_count: 1,
    signer_sha256: CUSTODIAL_SIGNER_SHA256,
    signer_public_key_sha256: CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256,
    verified_schemes: [2, 3],
    v2_or_newer: true,
  },
  alignment: alignmentProof,
  backup: compiledBackupProof,
  androidManifestSecurity: custodialAndroidManifestSecurityProofFixture,
  nativeSecurity: nativeSecurityProof,
  tools: {
    android_build_tools_version: CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION,
    android_build_tools_platform: CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform,
    aapt2: toolProof('/reviewed/35.0.1/aapt2', 'aapt2 35.0.1', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256.aapt2),
    apksigner: toolProof('/reviewed/35.0.1/apksigner', '0.9', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256.apksigner),
    apksigner_jar: toolProof('/reviewed/35.0.1/lib/apksigner.jar', '0.9', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256['lib/apksigner.jar']),
    source_properties: toolProof('/reviewed/35.0.1/source.properties', 'Pkg.Revision=35.0.1', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256['source.properties']),
    zipalign: toolProof('/reviewed/35.0.1/zipalign', 'Android Build Tools 35.0.1', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256.zipalign),
    unzip: toolProof('/usr/bin/unzip', 'UnZip 6.00'),
    node: toolProof('/reviewed/node', CUSTODIAL_NODE_VERSION),
  },
  verifier: {
    release_acceptance_version: CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION,
    release_acceptance_source_sha256: '6'.repeat(64),
    backup_verifier_version: ANDROID_BACKUP_VERIFIER_VERSION,
    backup_verifier_source_sha256: '7'.repeat(64),
    capacitor_runtime_policy_version: CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION,
    capacitor_runtime_policy_source_sha256: '9'.repeat(64),
    android_manifest_security_verifier_version: CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION,
    android_manifest_security_verifier_source_sha256: 'a'.repeat(64),
    dex_semantic_verifier_version: CUSTODIAL_DEX_SEMANTIC_VERIFIER_VERSION,
    dex_semantic_verifier_source_sha256: 'b'.repeat(64),
    acceptance_schema_sha256: '8'.repeat(64),
    release_policy_sha256: CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
    toolchain_policy_sha256: CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.sha256,
  },
};
const releaseAcceptance = createCustodialAndroidReleaseAcceptance(releaseAcceptanceInput);
assert.equal(assertCustodialAcceptanceSchema(releaseAcceptance), true);
assert.equal(releaseAcceptance.schema_id, CUSTODIAL_ACCEPTANCE_SCHEMA_ID);
assert.equal(releaseAcceptance.accepted, true);
assert.equal(releaseAcceptance.artifact.apk_sha256, '5'.repeat(64));
assert.equal(releaseAcceptance.source.commit, acceptedSourceCommit);
assert.equal(releaseAcceptance.build.run_id, 'cm-build-123');
assert.equal(releaseAcceptance.build.highest_fleet_version_code, 29);
assert.equal(releaseAcceptance.build.minimum_next_version_code, 30);
const recoveryAcceptance = createCustodialAndroidReleaseAcceptance({
  ...releaseAcceptanceInput,
  application: {
    ...releaseAcceptanceInput.application,
    version_code: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE,
  },
  embeddedProvenance: {
    ...releaseAcceptanceInput.embeddedProvenance,
    native_build_number: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE,
  },
  sourceRef: CUSTODIAL_FORWARD_RECOVERY_BRANCH,
  buildNumber: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE,
});
assert.equal(recoveryAcceptance.source.ref, CUSTODIAL_FORWARD_RECOVERY_REF);
assert.equal(recoveryAcceptance.application.version_code, CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE);
assert.throws(
  () => createCustodialAndroidReleaseAcceptance({
    ...releaseAcceptanceInput,
    application: {
      ...releaseAcceptanceInput.application,
      version_code: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE - 1,
    },
    embeddedProvenance: {
      ...releaseAcceptanceInput.embeddedProvenance,
      native_build_number: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE - 1,
    },
    sourceRef: CUSTODIAL_FORWARD_RECOVERY_BRANCH,
    buildNumber: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE - 1,
  }),
  /recovery source must emit versionCode 43/,
);
assert.throws(
  () => createCustodialAndroidReleaseAcceptance({
    ...releaseAcceptanceInput,
    application: {
      ...releaseAcceptanceInput.application,
      version_code: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE,
    },
    embeddedProvenance: {
      ...releaseAcceptanceInput.embeddedProvenance,
      native_build_number: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE,
    },
    sourceRef: 'main',
    buildNumber: CUSTODIAL_FORWARD_RECOVERY_VERSION_CODE,
  }),
  /must not outrun staged recovery/,
);
assert.deepEqual(releaseAcceptance.backup.excluded_domains, immutableAndroidBackupDomains);
assert.equal(releaseAcceptance.android_manifest_security.uses_cleartext_traffic, false);
assert.deepEqual(
  releaseAcceptance.android_manifest_security.file_provider.roots,
  [{ type: 'external-files-path', name: 'custodial_webview_capture', path: 'Pictures/' }],
);
assert.throws(
  () => createCustodialAndroidReleaseAcceptance({
    ...releaseAcceptanceInput,
    androidManifestSecurity: {
      ...releaseAcceptanceInput.androidManifestSecurity,
      uses_cleartext_traffic: true,
    },
  }),
  /does not satisfy its committed schema.*must be equal to constant/,
  'manifest security proof mutations must fail acceptance',
);
assert.throws(
  () => createCustodialAndroidReleaseAcceptance({
    ...releaseAcceptanceInput,
    application: { ...releaseAcceptanceInput.application, unexpected_schema_field: true },
  }),
  /does not satisfy its committed schema.*additional properties/,
  'schema-invalid acceptance evidence must fail before it can be emitted',
);
assert.throws(
  () => assertCustodialAcceptanceSchema({
    ...releaseAcceptance,
    signing: { ...releaseAcceptance.signing, signer_public_key_sha256: '0'.repeat(64) },
  }),
  /does not satisfy its committed schema.*must be equal to constant/,
);
assert.throws(
  () => createCustodialAndroidReleaseAcceptance({
    ...releaseAcceptanceInput,
    tools: {
      ...releaseAcceptanceInput.tools,
      aapt2: { ...releaseAcceptanceInput.tools.aapt2, sha256: '0'.repeat(64) },
    },
  }),
  new RegExp(`reviewed official ${CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform} Build Tools package`),
);

const syntheticPlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Memphis Zoo</string>
</dict>
</plist>
`;
for (const [edition, identifier] of [
  ['manager', 'org.memphiszoo.ops'],
  ['viewer', 'org.memphiszoo.viewer'],
]) {
  const configuredPlist = configureIosInfoPlistSource(
    syntheticPlist,
    edition,
    { shellProof: true },
  );
  assert.equal(
    configureIosInfoPlistSource(configuredPlist, edition, { shellProof: true }),
    configuredPlist,
    `${edition} iOS native links must be idempotent`,
  );
  assert.match(configuredPlist, /<key>CFBundleURLTypes<\/key>/);
  assert.match(configuredPlist, new RegExp(`<string>memphiszoo-${edition}</string>`));
  assert.match(configuredPlist, new RegExp(`<string>${identifier.replaceAll('.', '\\.')}</string>`));
  for (const other of ['manager', 'custodial', 'viewer'].filter((name) => name !== edition)) {
    assert.doesNotMatch(configuredPlist, new RegExp(`<string>memphiszoo-${other}</string>`));
  }
  const productionPlist = configureIosInfoPlistSource(configuredPlist, edition);
  assert.doesNotMatch(
    productionPlist,
    new RegExp(`<string>memphiszoo-${edition}</string>`),
    `${edition} iOS proof scheme must be removed from a production reconfiguration`,
  );
  assert.equal(
    productionPlist.includes('<string>memphiszoo</string>'),
    false,
    `${edition} iOS production legacy-scheme isolation mismatch`,
  );
}
assert.equal(configureIosInfoPlistSource(syntheticPlist, 'manager'), syntheticPlist);
assert.equal(configureIosInfoPlistSource(syntheticPlist, 'viewer'), syntheticPlist);
assert.throws(
  () => configureIosInfoPlistSource(syntheticPlist, 'custodial'),
  /Custodial is Android-only/,
);
console.log('NATIVE_MOBILE_BUILD_CONTRACT_PASS');
