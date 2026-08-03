import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertManagerNativeSecurityBoundary,
  managerPlayIntegrityManifestProof,
  resolvePinnedBundletool,
} from './verify-manager-android-release.mjs';
import { managerDexSemanticFixture } from './manager-dex-semantic-test-fixture.mjs';
import { managerNativeVaultSourceDigest } from './manager-native-vault-source.mjs';
import {
  MANAGER_NATIVE_VAULT_PLUGIN_METHODS,
  MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS,
  MANAGER_OLD_SECURE_STORAGE_DESCRIPTOR,
  inspectManagerNativeVaultDexSemantics,
} from './verify-manager-dex-semantics.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(scriptPath, '../..');
const pluginRoot = resolve(mobileRoot, 'plugins/manager-native-vault');
const COMMIT = '1'.repeat(40);
const TREE = '2'.repeat(40);
const PLAY_INTEGRITY_PROJECT = '123456789012';
const managerPluginBuild = readFileSync(resolve(pluginRoot, 'android/build.gradle'), 'utf8');
const managerVerificationMetadata = readFileSync(
  resolve(mobileRoot, 'native-locks/android/manager/verification-metadata.xml'),
  'utf8',
);
assert.match(managerPluginBuild, /com[.]google[.]android[.]play:integrity:1[.]6[.]0/);
for (const marker of [
  'group="com.google.android.play" name="integrity" version="1.6.0"',
  'e6a0a877245b1f8c59aeccfa6c2b9bc07a7e44b551e3a372ce091533976b5188',
  'a85716bce77406e4338a6952181088be0571b31799545209c2aa0504edb08d4d',
]) assert.ok(managerVerificationMetadata.includes(marker), `missing pinned Play Integrity proof: ${marker}`);

const fixture = (overrides = {}) => ({
  pluginManifest: [{
    pkg: '@memphis-zoo/manager-native-vault',
    classpath: 'org.memphiszoo.manager.vault.ManagerNativeVaultPlugin',
  }],
  dexEntries: [{ name: 'classes.dex', bytes: managerDexSemanticFixture() }],
  runtimeExecutableEntries: [
    {
      name: 'assets/public/memphis-mobile-bridge.js',
      bytes: Buffer.from('ManagerNativeVault.authorizedRequest({}); /* manager-device-auth.v2 */'),
    },
    {
      // Shared browser assets may implement their ordinary browser session.
      // The Manager bridge strips those headers before native dispatch.
      name: 'assets/public/memphis-auth.js',
      bytes: Buffer.from('const ordinaryBrowser = session.token; const h = {Authorization:"Bearer " + ordinaryBrowser};'),
    },
  ],
  build: {
    edition: 'manager',
    manager_native_vault_source_sha256: managerNativeVaultSourceDigest(pluginRoot),
    source_commit: COMMIT,
    source_tree: TREE,
    source_commit_exact: true,
    build_id: `fixture.manager.${COMMIT.slice(0, 12)}`,
    native_build_number: 11,
    manager_native_auth_contract: 'manager-device-auth.v2',
    manager_play_integrity_cloud_project_number: PLAY_INTEGRITY_PROJECT,
    manager_play_integrity_configuration_embedded: true,
  },
  ...overrides,
});

const accepted = assertManagerNativeSecurityBoundary(fixture());
assert.equal(accepted.manager_native_auth_contract, 'manager-device-auth.v2');
assert.equal(accepted.source_commit_exact, true);
assert.equal(accepted.manager_play_integrity_configuration_embedded, true);
assert.equal(accepted.manager_play_integrity_cloud_project_number, PLAY_INTEGRITY_PROJECT);
assert.equal(accepted.native_class_closure_verified, true);
assert.equal(accepted.plugin_extends_capacitor_plugin, true);
assert.equal(accepted.plugin_methods_verified, true);
assert.equal(accepted.play_integrity_class_defined, true);
assert.equal(accepted.play_integrity_api_invocation_verified, true);

const compiledManifestProof = managerPlayIntegrityManifestProof({
  metadata: {
    application_metadata: {
      'org.memphiszoo.manager.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER':
        `play-integrity-cloud-project:${PLAY_INTEGRITY_PROJECT}`,
    },
  },
  boundary: accepted,
  policy: {
    app_attestation: {
      play_integrity_cloud_project_number: PLAY_INTEGRITY_PROJECT,
    },
  },
});
assert.equal(compiledManifestProof.ready, true);
for (const mutation of [
  (value) => { value.metadata.application_metadata = {}; },
  (value) => {
    value.metadata.application_metadata['org.memphiszoo.manager.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER'] =
      'play-integrity-cloud-project:999999';
  },
  (value) => { value.boundary.manager_play_integrity_cloud_project_number = '999999'; },
  (value) => { value.policy.app_attestation.play_integrity_cloud_project_number = null; },
]) {
  const value = structuredClone({
    metadata: {
      application_metadata: {
        'org.memphiszoo.manager.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER':
          `play-integrity-cloud-project:${PLAY_INTEGRITY_PROJECT}`,
      },
    },
    boundary: accepted,
    policy: { app_attestation: { play_integrity_cloud_project_number: PLAY_INTEGRITY_PROJECT } },
  });
  mutation(value);
  assert.equal(managerPlayIntegrityManifestProof(value).ready, false);
}

function rejects(mutator, pattern) {
  const value = fixture();
  mutator(value);
  assert.throws(() => assertManagerNativeSecurityBoundary(value), pattern);
}

rejects(
  (value) => {
    value.dexEntries[0].bytes = Buffer.from(
      MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS.join('\0'),
    );
  },
  /header is malformed/,
);
rejects(
  (value) => {
    const missing = MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS[0];
    value.dexEntries[0].bytes = managerDexSemanticFixture({
      requiredClasses: MANAGER_NATIVE_VAULT_REQUIRED_CLASS_DESCRIPTORS.slice(1),
      extraTypeDescriptors: [missing],
      extraStrings: [missing],
    });
  },
  /missing native vault class closure.*ManagerNativeVaultPlugin/,
);
rejects(
  (value) => { value.dexEntries[0].bytes = managerDexSemanticFixture({ extraStrings: ['/mobile-auth-api/session'] }); },
  /retired v1 native-auth route/,
);
rejects(
  (value) => { value.dexEntries[0].bytes = managerDexSemanticFixture({ extraClasses: [MANAGER_OLD_SECURE_STORAGE_DESCRIPTOR] }); },
  /old SecureStorage plugin class/,
);
rejects(
  (value) => { value.dexEntries[0].bytes = managerDexSemanticFixture({ pluginSuperclass: 'Ljava/lang/Object;' }); },
  /does not directly extend Capacitor Plugin/,
);
rejects(
  (value) => {
    value.dexEntries[0].bytes = managerDexSemanticFixture({
      pluginMethods: MANAGER_NATIVE_VAULT_PLUGIN_METHODS.slice(1),
    });
  },
  /WebView API differs from policy.*missing: authorizedRequest/,
);
rejects(
  (value) => { value.dexEntries[0].bytes = managerDexSemanticFixture({ includePlayIntegrityReference: false }); },
  /does not structurally reference StandardIntegrityManager[.]prepareIntegrityToken/,
);
rejects(
  (value) => {
    value.dexEntries[0].bytes = managerDexSemanticFixture({ invokePlayIntegrityReference: false });
  },
  /PlayIntegrityAttestation does not invoke StandardIntegrityManager[.]prepareIntegrityToken/,
);
rejects(
  (value) => { value.runtimeExecutableEntries[0].bytes = Buffer.from('ManagerNativeVault; manager-device-auth.v2; session.token'); },
  /Manager-owned WebView runtime constructs a bearer token/,
);
rejects(
  (value) => { value.runtimeExecutableEntries[1].bytes = Buffer.from('fetch("/mobile-auth-api/session")'); },
  /v1 Manager mobile-auth route/,
);
rejects(
  (value) => { value.build.manager_native_auth_contract = 'manager-device-auth.v1.compatibility'; },
  /build provenance/,
);
rejects(
  (value) => { value.pluginManifest.push(value.pluginManifest[0]); },
  /exactly once/,
);

assert.throws(
  () => inspectManagerNativeVaultDexSemantics([
    { name: 'classes2.dex', bytes: managerDexSemanticFixture() },
    { name: 'classes.dex', bytes: managerDexSemanticFixture() },
  ]),
  /malformed or unsorted/,
);

const previousBundletool = process.env.BUNDLETOOL_JAR;
const bundletoolFixture = mkdtempSync(join(tmpdir(), 'manager-bundletool-contract-'));
try {
  delete process.env.BUNDLETOOL_JAR;
  assert.throws(() => resolvePinnedBundletool(), /independently provisioned bundletool 1[.]18[.]1/);
  const wrongJar = join(bundletoolFixture, 'bundletool.jar');
  writeFileSync(wrongJar, 'not bundletool', { mode: 0o600 });
  process.env.BUNDLETOOL_JAR = wrongJar;
  assert.throws(() => resolvePinnedBundletool(), /SHA-256 mismatch/);
  const linkedJar = join(bundletoolFixture, 'bundletool-linked.jar');
  symlinkSync(wrongJar, linkedJar);
  process.env.BUNDLETOOL_JAR = linkedJar;
  assert.throws(() => resolvePinnedBundletool(), /regular non-symlink file/);
} finally {
  if (previousBundletool === undefined) delete process.env.BUNDLETOOL_JAR;
  else process.env.BUNDLETOOL_JAR = previousBundletool;
  rmSync(bundletoolFixture, { force: true, recursive: true });
}

console.log('Manager Android release boundary contract tests passed.');
