#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTODIAL_CODEMAGIC_ADMISSION_POLICY,
  CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY,
  CUSTODIAL_CODEMAGIC_ADMISSION_SOURCE_SHA256,
  CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF,
  assertProducerConsumerAcceptanceMatch,
  assertCustodialCodemagicAdmissionSchema,
  createPrivateAdmissionPendingDirectory,
  downloadCodemagicArtifact,
  fetchCodemagicV3BuildResponse,
  inspectCodemagicV3BuildResponse,
  inspectCodemagicProvenanceZip,
  normalizeCustodialAdmissionSourceRef,
  verifyCodemagicProvenanceBundle,
  verifyRuntimeLedgerDirectory,
} from './admit-custodial-codemagic-build.mjs';
import {
  CUSTODIAL_ANDROID_RELEASE_POLICY,
  CUSTODIAL_FORWARD_RECOVERY_BRANCH,
  CUSTODIAL_FORWARD_RECOVERY_REF,
  assertCustodialAcceptanceSchema,
  normalizeCustodialSourceRef,
} from './verify-custodial-android-release.mjs';
import { custodialAndroidToolchainPolicyForPlatform } from './custodial-android-toolchain-policy.mjs';
import {
  androidBackupDomains,
  dataExtractionRules,
  legacyBackupRules,
} from './configure-android-backup.mjs';
import {
  custodialFileProviderPaths,
  custodialNetworkSecurityConfig,
} from './custodial-android-manifest-security.mjs';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { createCanonicalTemporaryFixture } from '../../scripts/canonical-temporary-fixture.mjs';

const BUILD_ID = '1234567890abcdef12345678';
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const VERSION_CODE = 26;
const PLATFORM_INDEX = 35;
const API_TOKEN = 'codemagic-api-secret-that-must-never-leak';
const ARTIFACT_SECRET = 'short-lived-artifact-secret';
const SENSITIVE_CONFIG = 'unreviewed-build-config-secret';
const API_LIMIT = 2 * 1024 * 1024;
const HASH = 'a'.repeat(64);
const SOURCE_TREE = '89abcdef0123456789abcdef0123456789abcdef';
const STORAGE_OBJECT_ID = '11111111-2222-3333-4444-555555555555';
const STORAGE_BUILD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const STORAGE_GOOGLE_ACCESS_ID = 'fixture-builder%40fixture.iam.gserviceaccount.com';
const STORAGE_SIGNATURE = `${'A'.repeat(340)}%2Bw%3D%3D`;

test('admits only protected main or the exact Build 29 recovery source ref', () => {
  assert.equal(normalizeCustodialSourceRef('main'), 'refs/heads/main');
  assert.equal(normalizeCustodialSourceRef(CUSTODIAL_FORWARD_RECOVERY_BRANCH), CUSTODIAL_FORWARD_RECOVERY_REF);
  assert.equal(
    normalizeCustodialAdmissionSourceRef(CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch),
    CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.ref,
  );
  assert.throws(
    () => normalizeCustodialAdmissionSourceRef('release/custodial-build29-recovery-v35-implementation-20260824'),
    /exact approved recovery source branch/,
  );
  assert.throws(
    () => normalizeCustodialSourceRef('release/custodial-build29-recovery-v33-implementation-20260815'),
    /exact Build 29 recovery branch/,
  );
});

function artifactCapabilityUrl(discriminator) {
  const prefix = `${ARTIFACT_SECRET}_${discriminator}_`;
  const body = `${prefix}${'A'.repeat(320 - prefix.length)}`;
  return `https://api.codemagic.io//artifacts/.${body}.${'s'.repeat(27)}`;
}

function storageArtifactUrl(name) {
  return `https://storage.googleapis.com/codemagic-build-artifacts/${STORAGE_BUILD_ID}/${STORAGE_OBJECT_ID}/${name}?Expires=1999999999&GoogleAccessId=${STORAGE_GOOGLE_ACCESS_ID}&Signature=${STORAGE_SIGNATURE}`;
}

test('allocates private admission staging with fixed hexadecimal entropy and collision retry', async () => {
  // Darwin exposes its temporary root through /var even though the canonical
  // filesystem path is /private/var. Use the shared identity-bound fixture so
  // the positive case has the same canonical, private parent on every host.
  const fixture = await createCanonicalTemporaryFixture('custodial-admission-pending-test-');
  const temporary = fixture.root;
  try {
    const aliasedParent = join(temporary, 'aliased-parent');
    symlinkSync(temporary, aliasedParent, 'dir');
    assert.throws(
      () => createPrivateAdmissionPendingDirectory(
        aliasedParent,
        BUILD_ID,
        () => Buffer.from('010203', 'hex'),
      ),
      /pending parent must remain private and owned/,
    );
    const first = createPrivateAdmissionPendingDirectory(
      temporary,
      BUILD_ID,
      () => Buffer.from('aabbcc', 'hex'),
    );
    const entropy = [Buffer.from('aabbcc', 'hex'), Buffer.from('ddeeff', 'hex')];
    const second = createPrivateAdmissionPendingDirectory(
      temporary,
      BUILD_ID,
      () => entropy.shift(),
    );
    assert.equal(basename(first), `.pending-${BUILD_ID}-aabbcc`);
    assert.equal(basename(second), `.pending-${BUILD_ID}-ddeeff`);
    assert.notEqual(first, second);
    for (const path of [first, second]) {
      const stat = lstatSync(path);
      assert(stat.isDirectory() && !stat.isSymbolicLink());
      assert.equal(stat.mode & 0o077, 0);
    }
    assert.throws(
      () => createPrivateAdmissionPendingDirectory(temporary, BUILD_ID, () => Buffer.alloc(2)),
      /entropy must be exactly three bytes/,
    );
  } finally {
    await fixture.dispose();
  }
});
const ZIP_FILES = [
  'build/',
  'build/provenance/',
  'build/provenance/custodial-android-backup-security.json',
  'build/provenance/custodial-android-configuration.json',
  'build/provenance/custodial-android-release-acceptance.json',
  'build/provenance/custodial-android-toolchain.json',
  'build/provenance/custodial-build.json',
  'build/provenance/custodial-firebase-android.json',
  'build/provenance/custodial-native.sha256',
  'build/provenance/custodial-source-attestation.json',
  'build/provenance/custodial-web.sha256',
];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFixture({ contents = new Map(), gapAfterFirst = Buffer.alloc(0), symlinkName = null } = {}) {
  const locals = [];
  const central = [];
  let localOffset = 0;
  for (const [index, name] of ZIP_FILES.entries()) {
    const nameBytes = Buffer.from(name);
    const isDirectory = name.endsWith('/');
    const data = isDirectory ? Buffer.alloc(0) : Buffer.from(contents.get(name) || '{}\n');
    const method = isDirectory ? 0 : 8;
    const compressed = method === 8 ? deflateRawSync(data, { level: 9 }) : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, compressed);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(0x033f, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(method, 10);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(nameBytes.length, 28);
    const mode = name === symlinkName ? 0o120777 : (isDirectory ? 0o040755 : 0o100644);
    record.writeUInt32LE(((mode << 16) | (isDirectory ? 0x10 : 0)) >>> 0, 38);
    record.writeUInt32LE(localOffset, 42);
    central.push(record, nameBytes);
    localOffset += local.length + nameBytes.length + compressed.length;
    if (index === 0 && gapAfterFirst.length > 0) {
      locals.push(gapAfterFirst);
      localOffset += gapAfterFirst.length;
    }
  }
  const localBytes = Buffer.concat(locals);
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(ZIP_FILES.length, 8);
  end.writeUInt16LE(ZIP_FILES.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(localBytes.length, 16);
  return Buffer.concat([localBytes, centralBytes, end]);
}

const clone = (value) => structuredClone(value);
const jsonBytes = (value) => Buffer.from(JSON.stringify(value));
const canonicalJsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const digest = (value) => createHash('sha256').update(value).digest('hex');

const acceptanceSchema = JSON.parse(readFileSync(new URL(
  './custodial-android-release-acceptance.schema.json',
  import.meta.url,
)));

function mergeFixture(left, right) {
  if (
    left && right
    && typeof left === 'object' && typeof right === 'object'
    && !Array.isArray(left) && !Array.isArray(right)
  ) {
    const result = clone(left);
    for (const [name, value] of Object.entries(right)) {
      result[name] = Object.hasOwn(result, name) ? mergeFixture(result[name], value) : clone(value);
    }
    return result;
  }
  return clone(right);
}

function schemaFixture(node) {
  if (node.$ref) {
    const path = node.$ref.replace(/^#\//, '').split('/');
    let referenced = acceptanceSchema;
    for (const part of path) referenced = referenced[part];
    return schemaFixture(referenced);
  }
  if (Array.isArray(node.allOf)) {
    return node.allOf.reduce((value, part) => mergeFixture(value, schemaFixture(part)), {});
  }
  if (Object.hasOwn(node, 'const')) return clone(node.const);
  if (Array.isArray(node.enum)) return clone(node.enum[0]);
  if (node.type === 'object') {
    return Object.fromEntries((node.required || []).map((name) => [
      name,
      schemaFixture(node.properties[name]),
    ]));
  }
  if (node.type === 'array') {
    if (Array.isArray(node.prefixItems)) return node.prefixItems.map(schemaFixture);
    if (node.contains) return [schemaFixture(node.contains)];
    return Array.from({ length: node.minItems || 0 }, () => schemaFixture(node.items));
  }
  if (node.type === 'integer' || node.type === 'number') return node.minimum ?? 1;
  if (node.type === 'boolean') return false;
  if (node.type === 'string') {
    if (node.format === 'date-time') return '2026-08-02T01:12:03.000Z';
    const pattern = String(node.pattern || '');
    if (pattern.includes('{64}')) return HASH;
    if (pattern.includes('{40,64}')) return COMMIT;
    if (pattern.includes('classes')) return 'classes.dex';
    if (pattern.startsWith('^0x')) return '0x7f010001';
    if (pattern.startsWith('^xml/')) return 'xml/fixture';
    if (pattern.startsWith('^res/')) return 'res/xml/fixture.xml';
    if (pattern.startsWith('^[A-Za-z0-9]')) return BUILD_ID;
    return 'fixture';
  }
  throw new Error(`Unsupported acceptance schema fixture node: ${JSON.stringify(node)}`);
}

function platformToolEvidence(policy, prefix) {
  const tool = (relativePath, version) => ({
    path: `${prefix}/${relativePath}`,
    version,
    sha256: policy.installed_files_sha256[relativePath],
  });
  return {
    android_build_tools_version: policy.android_build_tools_version,
    android_build_tools_platform: policy.platform,
    aapt2: tool('aapt2', 'aapt2 35.0.1'),
    apksigner: tool('apksigner', '0.9'),
    apksigner_jar: tool('lib/apksigner.jar', '0.9'),
    source_properties: tool('source.properties', 'Pkg.Revision=35.0.1'),
    zipalign: tool('zipalign', 'Android Build Tools 35.0.1'),
    unzip: { path: '/usr/bin/unzip', version: 'UnZip 6.00', sha256: HASH },
    node: { path: `${prefix}/node`, version: 'v22.23.1', sha256: HASH },
  };
}

function realisticProducerBundleFixture(
  apkBytes,
  { mutateAcceptance, mutateBuild, mutateRuntime, mutateSourceAttestation } = {},
) {
  const macPolicy = custodialAndroidToolchainPolicyForPlatform('darwin');
  const acceptance = schemaFixture(acceptanceSchema);
  const runtime = new Map([
    ['build.json', Buffer.from('{"fixture":"build"}\n')],
    ['index.html', Buffer.from('<!doctype html><title>Custodial fixture</title>\n')],
    ['memphis-build-identity.js', Buffer.from('globalThis.__MZ_BUILD__ = "fixture";\n')],
    ['runtime-asset-manifest.json', Buffer.from('{"fixture":"manifest"}\n')],
  ]);
  if (mutateRuntime !== undefined) {
    assert.equal(typeof mutateRuntime, 'function');
    mutateRuntime(runtime);
  }
  const emptyCapacitorAssetSha256 = digest(Buffer.alloc(0));

  acceptance.artifact = {
    file_name: 'app-release.apk',
    apk_sha256: digest(apkBytes),
    size_bytes: apkBytes.length,
  };
  acceptance.application.version_code = VERSION_CODE;
  Object.assign(acceptance.embedded_provenance, {
    source_commit: COMMIT,
    source_tree: SOURCE_TREE,
    custodial_native_vault_source_sha256: 'b'.repeat(64),
    release_id: 'custodial-1.0.0',
    build_id: `custodial-1.0.0-${COMMIT.slice(0, 12)}-${VERSION_CODE}`,
    native_build_number: VERSION_CODE,
    runtime_asset_count: runtime.size - 1,
    build_json_sha256: digest(runtime.get('build.json')),
    runtime_asset_manifest_sha256: digest(runtime.get('runtime-asset-manifest.json')),
    build_identity_js_sha256: digest(runtime.get('memphis-build-identity.js')),
    capacitor_generated_assets_sha256: {
      'cordova.js': emptyCapacitorAssetSha256,
      'cordova_plugins.js': emptyCapacitorAssetSha256,
    },
  });
  Object.assign(acceptance.source, { commit: COMMIT, tree: SOURCE_TREE });
  Object.assign(acceptance.build, {
    run_id: BUILD_ID,
    number: VERSION_CODE,
    highest_fleet_version_code: CUSTODIAL_ANDROID_RELEASE_POLICY.highest_fleet_version_code,
    minimum_next_version_code: CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code,
  });
  acceptance.backup.legacy_resource.logical_name = 'xml/memphis_zoo_backup_rules';
  acceptance.backup.data_extraction_resource.logical_name =
    'xml/memphis_zoo_data_extraction_rules';
  acceptance.native_security.webview_executable_count = 3;
  acceptance.native_security.webview_executable_sha256 = {
    'assets/public/index.html': digest(runtime.get('index.html')),
    'assets/public/cordova.js': emptyCapacitorAssetSha256,
    'assets/public/cordova_plugins.js': emptyCapacitorAssetSha256,
  };
  acceptance.native_security.dex_sha256 = { 'classes.dex': 'c'.repeat(64) };
  acceptance.native_security.plugin_manifest_sha256 = 'd'.repeat(64);
  acceptance.tools = platformToolEvidence(macPolicy, '/Applications/android-sdk/build-tools/35.0.1');
  acceptance.verifier.release_policy_sha256 = CUSTODIAL_ANDROID_RELEASE_POLICY.sha256;
  acceptance.verifier.toolchain_policy_sha256 = macPolicy.sha256;
  if (mutateAcceptance !== undefined) {
    assert.equal(typeof mutateAcceptance, 'function');
    mutateAcceptance(acceptance);
  }
  assertCustodialAcceptanceSchema(acceptance);

  const configuration = {
    schema_version: 1,
    edition: 'custodial',
    platform: 'android',
    app_identifier: 'org.memphiszoo.custodial',
    release_version: '1.0.0',
    build_number: VERSION_CODE,
    build_number_source: 'PROJECT_BUILD_NUMBER',
    source_commit: COMMIT,
    source_tree: SOURCE_TREE,
    source_commit_exact: true,
    signing_configured: true,
    signing_keystore_sha256: HASH,
    generated_build_gradle_sha256: HASH,
    version_overlay_sha256: HASH,
    release_overlay_sha256: HASH,
    gradle_wrapper_properties_sha256: HASH,
    gradle_wrapper_jar_sha256: HASH,
    gradle_distribution_sha256: HASH,
    gradle_verification_metadata_sha256: HASH,
    generated_variables_gradle_sha256: HASH,
    custodial_release_policy_sha256: acceptance.verifier.release_policy_sha256,
    custodial_highest_fleet_version_code: acceptance.build.highest_fleet_version_code,
    custodial_minimum_next_version_code: acceptance.build.minimum_next_version_code,
    custodial_native_vault_source_sha256:
      acceptance.embedded_provenance.custodial_native_vault_source_sha256,
    generated_capacitor_plugins_sha256: acceptance.native_security.plugin_manifest_sha256,
    generated_capacitor_config_sha256: acceptance.native_security.capacitor_config_sha256,
    custodial_capacitor_plugin_count: acceptance.native_security.plugin_count,
    custodial_capacitor_plugin_graph_sha256: acceptance.native_security.plugin_graph_sha256,
    custodial_capacitor_config_policy_sha256:
      acceptance.native_security.capacitor_config_policy_sha256,
    custodial_capacitor_include_plugins_match_manifest: true,
  };
  const build = {
    edition: 'custodial',
    release_id: acceptance.embedded_provenance.release_id,
    source_commit: COMMIT,
    source_tree: SOURCE_TREE,
    source_commit_exact: true,
    build_id: acceptance.embedded_provenance.build_id,
    custodial_native_vault_source_sha256:
      acceptance.embedded_provenance.custodial_native_vault_source_sha256,
    native_build_number: VERSION_CODE,
    messenger: 'chatscope',
    node: 'v22.23.1',
    npm: '11.17.0',
    dependency_install_policy: 'npm-ci-ignore-scripts-v1',
    firebase_util_postinstall_sha256:
      '56e40adf04426e6b07df5d1ca7d4142a5b2c91ea9df5800589e357f9a2433252',
    codemagic_build_id: BUILD_ID,
  };
  if (mutateBuild) mutateBuild(build);
  const toolchain = {
    schema_version: 1,
    codemagic_xcode_image: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.runner_xcode_image,
    android_build_tools_version: macPolicy.android_build_tools_version,
    toolchain_policy_sha256: macPolicy.sha256,
    files_sha256: clone(macPolicy.installed_files_sha256),
  };
  const firebaseLock = readFileSync(new URL(
    '../native-locks/firebase/custodial-android.sha256',
    import.meta.url,
  ), 'utf8').trim().split(/\s+/)[0];
  const firebase = {
    schema_version: 1,
    edition: 'custodial',
    platform: 'android',
    app_identifier: 'org.memphiszoo.custodial',
    sha256: firebaseLock,
    bytes: 1,
    source: 'environment-raw',
  };
  const backup = {
    schema_version: 1,
    edition: 'custodial',
    policy: acceptance.backup.policy,
    allow_backup: acceptance.backup.allow_backup,
    full_backup_content: '@xml/memphis_zoo_backup_rules',
    data_extraction_rules: '@xml/memphis_zoo_data_extraction_rules',
    excluded_domains: androidBackupDomains,
    legacy_rules_sha256: digest(legacyBackupRules),
    data_extraction_rules_sha256: digest(dataExtractionRules),
    uses_cleartext_traffic: false,
    required_compiled_extract_native_libs: false,
    network_security_config: '@xml/memphis_zoo_network_security_config',
    network_security_config_sha256: digest(custodialNetworkSecurityConfig),
    file_provider_policy: 'app-external-files-pictures-only',
    file_provider_paths_sha256: digest(custodialFileProviderPaths),
  };
  const sourceAttestation = {
    schema_version: 1,
    source_commit: COMMIT,
    source_tree: SOURCE_TREE,
    source_ref: 'main',
    tracked_worktree_clean: true,
    untracked_nonignored_files_absent: true,
  };
  if (mutateSourceAttestation !== undefined) {
    assert.equal(typeof mutateSourceAttestation, 'function');
    mutateSourceAttestation(sourceAttestation);
  }
  const webLedger = [...runtime]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, bytes]) => `${digest(bytes)}  ${path}`)
    .join('\n');
  const evidence = new Map([
    ['build/provenance/custodial-android-backup-security.json', canonicalJsonBytes(backup)],
    ['build/provenance/custodial-android-configuration.json', canonicalJsonBytes(configuration)],
    ['build/provenance/custodial-android-release-acceptance.json', canonicalJsonBytes(acceptance)],
    ['build/provenance/custodial-android-toolchain.json', canonicalJsonBytes(toolchain)],
    ['build/provenance/custodial-build.json', canonicalJsonBytes(build)],
    ['build/provenance/custodial-firebase-android.json', canonicalJsonBytes(firebase)],
    ['build/provenance/custodial-source-attestation.json', canonicalJsonBytes(sourceAttestation)],
    ['build/provenance/custodial-web.sha256', Buffer.from(`${webLedger}\n`)],
  ]);
  const apkPath = 'mobile/android/app/build/outputs/apk/release/app-release.apk';
  const nativeLedger = [
    ...[...evidence].map(([path, bytes]) => [path, digest(bytes)]),
    [apkPath, digest(apkBytes)],
  ]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, sha256]) => `${sha256}  ${path}`)
    .join('\n');
  evidence.set('build/provenance/custodial-native.sha256', Buffer.from(`${nativeLedger}\n`));
  return { acceptance, contents: evidence, runtime };
}

function pinnedUnzipIsAvailable() {
  const { path, sha256 } = CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF.unzip;
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink() && digest(readFileSync(path)) === sha256;
  } catch {
    return false;
  }
}

function validBuildResponse() {
  return {
    data: {
      app_id: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.app_id,
      app_store_connect_status: null,
      artifacts: [
        {
          name: 'app-release.apk',
          short_lived_download_url: artifactCapabilityUrl('apk'),
          size_in_bytes: 4,
          type: 'apk',
          version_code: String(VERSION_CODE),
          version_name: '1.0.0',
        },
        {
          name: `Engine_${PLATFORM_INDEX}_artifacts.zip`,
          short_lived_download_url: artifactCapabilityUrl('bundle'),
          size_in_bytes: 3,
          type: 'bundle',
          version_code: null,
          version_name: null,
        },
      ],
      branch: 'main',
      build_inputs: { environment: { variables: { secret: `${SENSITIVE_CONFIG}:${API_TOKEN}` } } },
      commit: {
        author_email: 'builder@example.invalid',
        author_name: 'Release Builder',
        avatar_url: 'https://avatars.githubusercontent.com/u/274282025?v=4',
        hash: COMMIT,
        message: `Build fixture ${SENSITIVE_CONFIG}`,
        url: `https://github.com/${CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.repository}/commit/${COMMIT}`,
      },
      config: { environment: { groups: [`${SENSITIVE_CONFIG}:${API_TOKEN}`] } },
      created_at: '2026-08-02T01:02:03.000Z',
      finished_at: '2026-08-02T01:12:03.000Z',
      id: BUILD_ID,
      index: PLATFORM_INDEX,
      instance_type: 'mac_mini_m2',
      labels: [],
      pull_request: null,
      release_notes: null,
      remote_access_enabled: false,
      started_at: '2026-08-02T01:03:03.000Z',
      status: 'finished',
      tag: null,
      workflow: {
        id: 'custodial-android',
        name: 'Memphis Zoo Custodial - Private Android APK',
        source: 'file',
      },
    },
  };
}

function validAdmission() {
  const schemaSha256 = createHash('sha256')
    .update(readFileSync(new URL('./custodial-codemagic-admission.schema.json', import.meta.url)))
    .digest('hex');
  return {
    schema_id: 'urn:memphis-zoo:custodial-codemagic-admission:v1',
    schema_version: 1,
    accepted: true,
    generated_at: '2026-08-02T01:13:03.000Z',
    provider: 'codemagic',
    app_id: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.app_id,
    build_id: BUILD_ID,
    workflow: 'custodial-android',
    status: 'finished',
    branch: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch,
    commit: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.commit,
    control_source: { branch: 'main', commit: COMMIT, tree: SOURCE_TREE },
    artifact_source_policy_sha256: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.sha256,
    platform_index: PLATFORM_INDEX,
    finished_at: '2026-08-02T01:12:03.000Z',
    version_code: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code,
    apk: { name: 'app-release.apk', size_bytes: 4, sha256: HASH },
    provenance_bundle: { name: `Engine_${PLATFORM_INDEX}_artifacts.zip`, size_bytes: 3, sha256: HASH },
    producer_acceptance_sha256: HASH,
    consumer_acceptance_sha256: HASH,
    native_ledger_sha256: HASH,
    web_ledger_sha256: HASH,
    stable_metadata_sha256: HASH,
    admission_policy_sha256: CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.sha256,
    admission_schema_sha256: schemaSha256,
    verifier_version: '1.0.0',
    verifier_source_sha256: CUSTODIAL_CODEMAGIC_ADMISSION_SOURCE_SHA256,
    local_host: structuredClone(CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF),
  };
}

function inspect(response = validBuildResponse()) {
  return inspectCodemagicV3BuildResponse(jsonBytes(response), {
    expectedBuildId: BUILD_ID,
    expectedCommit: COMMIT,
    minimumVersionCode: VERSION_CODE,
  });
}

function response(body, {
  status = 200,
  headers = { 'content-type': 'application/json' },
} = {}) {
  return new Response(body, { status, headers });
}

async function errorText(action) {
  try {
    await action();
    assert.fail('expected action to reject');
  } catch (error) {
    assert.equal(error instanceof Error, true);
    return error.message;
  }
}

test('accepts the exact reviewed Codemagic v3 build shape and emits sanitized evidence', () => {
  const first = inspect();
  const second = inspect();

  assert.equal(first.metadata.build_id, BUILD_ID);
  assert.equal(first.metadata.commit, COMMIT);
  assert.equal(first.metadata.status, 'finished');
  assert.equal(first.metadata.branch, 'main');
  assert.equal(first.metadata.platform_index, PLATFORM_INDEX);
  assert.equal(first.metadata.version_code, VERSION_CODE);
  assert.equal(first.metadata.artifacts.length, 2);
  assert.equal(first.metadata_sha256, second.metadata_sha256);
  assert.deepEqual(first.metadata, second.metadata);

  const evidence = JSON.stringify(first.metadata);
  for (const forbidden of [
    API_TOKEN,
    ARTIFACT_SECRET,
    SENSITIVE_CONFIG,
    'short_lived_download_url',
    'build_inputs',
    'config',
    'author_email',
    'avatar_url',
    'message',
  ]) assert.equal(evidence.includes(forbidden), false, `evidence leaked ${forbidden}`);

  const apkUrl = first.artifactUrls.get('app-release.apk');
  assert.equal(apkUrl instanceof URL, true);
  assert.equal(apkUrl.pathname.startsWith('//artifacts/'), true);
  assert.equal(apkUrl.pathname.includes(ARTIFACT_SECRET), true);
  assert.equal(first.artifactUrls.size, 2);
});

test('binds the forward-recovery artifact to its exact branch, commit, and version', () => {
  const fixture = validBuildResponse();
  fixture.data.branch = CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch;
  fixture.data.commit.hash = CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.commit;
  fixture.data.commit.url = `https://github.com/${CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.repository}/commit/${CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.commit}`;
  fixture.data.artifacts[0].version_code = String(CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code);
  const inspected = inspectCodemagicV3BuildResponse(jsonBytes(fixture), {
    expectedBuildId: BUILD_ID,
    expectedCommit: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.commit,
    expectedBranch: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch,
    expectedVersionCode: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code,
    minimumVersionCode: CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code,
  });
  assert.equal(inspected.metadata.branch, CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch);
  assert.equal(inspected.metadata.commit, CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.commit);
  assert.equal(inspected.metadata.version_code, CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code);

  const wrongVersion = clone(fixture);
  wrongVersion.data.artifacts[0].version_code = String(CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code - 1);
  assert.throws(
    () => inspectCodemagicV3BuildResponse(jsonBytes(wrongVersion), {
      expectedBuildId: BUILD_ID,
      expectedCommit: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.commit,
      expectedBranch: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.branch,
      expectedVersionCode: CUSTODIAL_CODEMAGIC_FORWARD_RECOVERY_POLICY.version_code,
      minimumVersionCode: CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code,
    }),
    /differs from exact source policy/,
  );
});

test('pins the current Codemagic commit avatar_url contract and rejects aliases', () => {
  assert.equal(inspect().metadata.commit, COMMIT);

  const legacyAlias = validBuildResponse();
  legacyAlias.data.commit.avatar = legacyAlias.data.commit.avatar_url;
  delete legacyAlias.data.commit.avatar_url;
  assert.throws(() => inspect(legacyAlias), /Codemagic commit fields differ/);

  const ambiguousAliases = validBuildResponse();
  ambiguousAliases.data.commit.avatar = ambiguousAliases.data.commit.avatar_url;
  assert.throws(() => inspect(ambiguousAliases), /Codemagic commit fields differ/);

  const missingAvatarUrl = validBuildResponse();
  delete missingAvatarUrl.data.commit.avatar_url;
  assert.throws(() => inspect(missingAvatarUrl), /Codemagic commit fields differ/);

  const baseline = inspect().metadata_sha256;
  const alternateDecoration = validBuildResponse();
  alternateDecoration.data.commit.avatar_url = 'https://cdn.example.invalid/avatar/user.png?v=9';
  assert.equal(inspect(alternateDecoration).metadata_sha256, baseline);

  const unsafeValues = [
    null,
    'http://avatars.githubusercontent.com/u/1?v=4',
    'https://user:password@avatars.githubusercontent.com/u/1?v=4',
    'https://avatars.githubusercontent.com:444/u/1?v=4',
    'https://avatars.githubusercontent.com:443/u/1?v=4',
    'https://@avatars.githubusercontent.com/u/1?v=4',
    'HTTPS://AVATARS.GITHUBUSERCONTENT.COM/u/1?v=4',
    'https:////avatars.githubusercontent.com/u/1?v=4',
    'https://avatars.githubusercontent.com/u/1?v=4#fragment',
    'https://avatars.githubusercontent.com/u/1?v=4#',
    'https://avatars.githubusercontent.com/u/1?',
    'https://avatars.githubusercontent.com//u/1?v=4',
    'https://avatars.githubusercontent.com/u/../private?v=4',
    'https://avatars.githubusercontent.com/u/%2e%2e/private?v=4',
    'https://avatars.githubusercontent.com/u/1%2fprivate?v=4',
    '//avatars.githubusercontent.com/u/1?v=4',
    'not a URL',
  ];
  for (const avatarUrl of unsafeValues) {
    const fixture = validBuildResponse();
    fixture.data.commit.avatar_url = avatarUrl;
    assert.throws(() => inspect(fixture), /avatar_url type differs|avatar URL (?:is malformed|violates)/);
  }

  for (const field of ['author_email', 'author_name', 'message']) {
    const fixture = validBuildResponse();
    fixture.data.commit[field] = null;
    assert.throws(() => inspect(fixture), new RegExp(`${field} type differs`));
  }
});

test('deep-freezes the admission policy and validates exact final evidence', () => {
  assert.equal(Object.isFrozen(CUSTODIAL_CODEMAGIC_ADMISSION_POLICY), true);
  assert.equal(Object.isFrozen(CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.workflow), true);
  assert.equal(Object.isFrozen(CUSTODIAL_CODEMAGIC_ADMISSION_POLICY.artifact_redirect_origins), true);
  assert.equal(assertCustodialCodemagicAdmissionSchema(validAdmission()), true);

  const extra = validAdmission();
  extra.unreviewed = true;
  assert.throws(() => assertCustodialCodemagicAdmissionSchema(extra), /schema rejected evidence/);
  const bundleMismatch = validAdmission();
  bundleMismatch.provenance_bundle.name = 'Engine_99_artifacts.zip';
  assert.throws(() => assertCustodialCodemagicAdmissionSchema(bundleMismatch), /bundle name and platform index differ/);
  const hostMismatch = validAdmission();
  hostMismatch.local_host.node.sha256 = 'b'.repeat(64);
  assert.throws(
    () => assertCustodialCodemagicAdmissionSchema(hostMismatch),
    /differs from active policy and verifier code/,
  );
});

test('binds a rebuilt runtime directory byte-for-byte and rejects symlinks', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'custodial-runtime-ledger-test-'));
  try {
    mkdirSync(join(temporary, 'shell-assets'));
    writeFileSync(join(temporary, 'index.html'), '<main>Custodial</main>\n');
    writeFileSync(join(temporary, 'shell-assets', 'app.js'), 'globalThis.CustodialNativeVault.getState();\n');
    const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
    const ledger = new Map([
      ['index.html', digest(join(temporary, 'index.html'))],
      ['shell-assets/app.js', digest(join(temporary, 'shell-assets', 'app.js'))],
    ]);
    assert.equal(verifyRuntimeLedgerDirectory(temporary, ledger), true);

    mkdirSync(join(temporary, 'a'));
    writeFileSync(join(temporary, 'a', 'nested.js'), 'nested\n');
    writeFileSync(join(temporary, 'a.js'), 'root\n');
    ledger.set('a.js', digest(join(temporary, 'a.js')));
    ledger.set('a/nested.js', digest(join(temporary, 'a', 'nested.js')));
    assert.equal(verifyRuntimeLedgerDirectory(temporary, ledger), true);

    const wrong = new Map(ledger);
    wrong.set('index.html', HASH);
    assert.throws(() => verifyRuntimeLedgerDirectory(temporary, wrong), /differs from Codemagic web provenance/);
    mkdirSync(join(temporary, 'unledgered'));
    assert.throws(() => verifyRuntimeLedgerDirectory(temporary, ledger), /unledgered directory/);
    rmSync(join(temporary, 'unledgered'), { recursive: true });
    symlinkSync('index.html', join(temporary, 'linked.html'));
    assert.throws(() => verifyRuntimeLedgerDirectory(temporary, ledger), /contains a symlink/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('inspects ZIP structure before extraction and rejects compressed expansion attacks', () => {
  const safe = inspectCodemagicProvenanceZip(zipFixture());
  assert.equal(safe.entries.length, ZIP_FILES.length);

  const oversized = new Map([[
    'build/provenance/custodial-android-release-acceptance.json',
    Buffer.alloc(512 * 1024 + 1, 0x41),
  ]]);
  assert.throws(
    () => inspectCodemagicProvenanceZip(zipFixture({ contents: oversized })),
    /entry type or size differs from policy/,
  );

  const aggregate = new Map(ZIP_FILES.filter((name) => !name.endsWith('/')).slice(0, 5)
    .map((name) => [name, Buffer.alloc(450 * 1024, 0x42)]));
  assert.throws(
    () => inspectCodemagicProvenanceZip(zipFixture({ contents: aggregate })),
    /aggregate uncompressed size exceeds policy/,
  );

  assert.throws(
    () => inspectCodemagicProvenanceZip(zipFixture({
      symlinkName: 'build/provenance/custodial-build.json',
    })),
    /entry type or size differs from policy/,
  );

  assert.throws(
    () => inspectCodemagicProvenanceZip(zipFixture({
      gapAfterFirst: Buffer.from('PK\u0003\u0004hidden-local-record'),
    })),
    /local records are not contiguous/,
  );
});

test(
  'cross-binds a realistic producer bundle through the actual pinned unzip executable',
  { skip: pinnedUnzipIsAvailable() ? false : 'pinned Linux admission unzip is unavailable on this runner' },
  () => {
    const apkBytes = Buffer.from('synthetic-signed-custodial-apk-fixture');
    const fixture = realisticProducerBundleFixture(apkBytes);
    const temporary = mkdtempSync(join(tmpdir(), 'custodial-provenance-bundle-test-'));
    try {
      const bundlePath = join(temporary, `Engine_${VERSION_CODE}_artifacts.zip`);
      const verifyFixture = (candidate) => {
        writeFileSync(bundlePath, zipFixture({ contents: candidate.contents }));
        return verifyCodemagicProvenanceBundle({
          bundlePath,
          apkBytes,
          metadata: inspect().metadata,
          expectedCommit: COMMIT,
          expectedVersionCode: VERSION_CODE,
          unzipPath: CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF.unzip.path,
          expectedUnzipSha256: CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF.unzip.sha256,
          commandEnvironment: { PATH: '/usr/bin', LANG: 'C', LC_ALL: 'C' },
        });
      };
      const proof = verifyFixture(fixture);
      assert.equal(JSON.stringify(proof.acceptance), JSON.stringify(fixture.acceptance));
      assert.equal(proof.apk_sha256, digest(apkBytes));
      assert.equal(proof.web_ledger.size, fixture.runtime.size);
      assert.equal(proof.acceptance_sha256, digest(canonicalJsonBytes(fixture.acceptance)));

      const recoveryFixture = realisticProducerBundleFixture(apkBytes, {
        mutateAcceptance: (acceptance) => {
          acceptance.source.ref = CUSTODIAL_FORWARD_RECOVERY_REF;
        },
        mutateSourceAttestation: (attestation) => {
          attestation.source_ref = CUSTODIAL_FORWARD_RECOVERY_BRANCH;
        },
      });
      writeFileSync(bundlePath, zipFixture({ contents: recoveryFixture.contents }));
      const recoveryProof = verifyCodemagicProvenanceBundle({
        bundlePath,
        apkBytes,
        metadata: inspect().metadata,
        expectedCommit: COMMIT,
        expectedSourceRef: CUSTODIAL_FORWARD_RECOVERY_REF,
        expectedVersionCode: VERSION_CODE,
        unzipPath: CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF.unzip.path,
        expectedUnzipSha256: CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF.unzip.sha256,
        commandEnvironment: { PATH: '/usr/bin', LANG: 'C', LC_ALL: 'C' },
      });
      assert.equal(recoveryProof.acceptance.source.ref, CUSTODIAL_FORWARD_RECOVERY_REF);

      assert.throws(() => verifyFixture(recoveryFixture), /producer acceptance does not bind API and APK facts/);

      const lifecycleEnabledProducer = realisticProducerBundleFixture(apkBytes, {
        mutateBuild: (build) => {
          build.dependency_install_policy = 'npm-ci-lifecycle-enabled';
        },
      });
      assert.throws(
        () => verifyFixture(lifecycleEnabledProducer),
        /Custodial build record differs from compiled acceptance/,
      );

      const lifecycleProbeMismatch = realisticProducerBundleFixture(apkBytes, {
        mutateBuild: (build) => {
          build.firebase_util_postinstall_sha256 = 'e'.repeat(64);
        },
      });
      assert.throws(
        () => verifyFixture(lifecycleProbeMismatch),
        /Custodial build record differs from compiled acceptance/,
      );

      const generatedHashMismatch = realisticProducerBundleFixture(apkBytes, {
        mutateAcceptance: (acceptance) => {
          acceptance.native_security.webview_executable_sha256['assets/public/cordova.js'] =
            'e'.repeat(64);
        },
      });
      assert.throws(() => verifyFixture(generatedHashMismatch), /compiled Capacitor executable does not bind cordova\.js/);

      const missingGeneratedExecutable = realisticProducerBundleFixture(apkBytes, {
        mutateAcceptance: (acceptance) => {
          delete acceptance.native_security.webview_executable_sha256['assets/public/cordova_plugins.js'];
          acceptance.native_security.webview_executable_count -= 1;
        },
      });
      assert.throws(
        () => verifyFixture(missingGeneratedExecutable),
        /compiled Capacitor executable does not bind cordova_plugins\.js/,
      );

      const countMismatch = realisticProducerBundleFixture(apkBytes, {
        mutateAcceptance: (acceptance) => {
          acceptance.native_security.webview_executable_count += 1;
        },
      });
      assert.throws(() => verifyFixture(countMismatch), /compiled executable count differs/);

      const generatedPlaceholderInSourceLedger = realisticProducerBundleFixture(apkBytes, {
        mutateRuntime: (runtime) => {
          runtime.set('cordova.js', Buffer.alloc(0));
        },
      });
      assert.throws(
        () => verifyFixture(generatedPlaceholderInSourceLedger),
        /compiled Capacitor executable does not bind cordova\.js/,
      );
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);

test('accepts only the reviewed Darwin/Linux producer-consumer difference', () => {
  const producer = realisticProducerBundleFixture(Buffer.from('producer-consumer-apk')).acceptance;
  const linuxPolicy = custodialAndroidToolchainPolicyForPlatform('linux');
  const consumer = clone(producer);
  consumer.generated_at = '2026-08-02T01:13:03.000Z';
  consumer.tools = platformToolEvidence(linuxPolicy, '/home/eric/Android/Sdk/build-tools/35.0.1');
  consumer.verifier.toolchain_policy_sha256 = linuxPolicy.sha256;
  assert.equal(assertProducerConsumerAcceptanceMatch(producer, consumer), true);

  const artifactMutation = clone(consumer);
  artifactMutation.artifact.apk_sha256 = 'e'.repeat(64);
  assert.throws(
    () => assertProducerConsumerAcceptanceMatch(producer, artifactMutation),
    /producer and Linux consumer acceptance differ: artifact/,
  );

  const semanticMutation = clone(consumer);
  semanticMutation.native_security.dex_sha256['classes.dex'] = 'e'.repeat(64);
  assert.throws(
    () => assertProducerConsumerAcceptanceMatch(producer, semanticMutation),
    /producer and Linux consumer acceptance differ: native_security/,
  );

  const verifierMutation = clone(consumer);
  verifierMutation.verifier.release_acceptance_source_sha256 = 'e'.repeat(64);
  assert.throws(
    () => assertProducerConsumerAcceptanceMatch(producer, verifierMutation),
    /producer\/Linux consumer verifier provenance differs/,
  );

  const producerToolMutation = clone(producer);
  producerToolMutation.tools.aapt2.sha256 = 'e'.repeat(64);
  assert.throws(
    () => assertProducerConsumerAcceptanceMatch(producerToolMutation, consumer),
    /Codemagic producer Android toolchain provenance differs/,
  );

  const consumerToolMutation = clone(consumer);
  consumerToolMutation.tools.zipalign.sha256 = 'e'.repeat(64);
  assert.throws(
    () => assertProducerConsumerAcceptanceMatch(producer, consumerToolMutation),
    /Linux consumer Android toolchain provenance differs/,
  );
});

test('rejects every changed build identity boundary', () => {
  const cases = [
    ['build ID', (value) => { value.data.id = 'aaaaaaaaaaaaaaaaaaaaaaaa'; }],
    ['application', (value) => { value.data.app_id = 'aaaaaaaaaaaaaaaaaaaaaaaa'; }],
    ['status', (value) => { value.data.status = 'building'; }],
    ['branch', (value) => { value.data.branch = 'release'; }],
    ['tag', (value) => { value.data.tag = 'v1.0.0'; }],
    ['pull request', (value) => { value.data.pull_request = { number: 101 }; }],
    ['commit', (value) => { value.data.commit.hash = 'f'.repeat(40); }],
    ['commit repository', (value) => { value.data.commit.url = `https://github.com/other/repository/commit/${COMMIT}`; }],
    ['workflow ID', (value) => { value.data.workflow.id = 'manager-android'; }],
    ['workflow name', (value) => { value.data.workflow.name = 'Unreviewed workflow'; }],
    ['workflow source', (value) => { value.data.workflow.source = 'ui'; }],
    ['instance type', (value) => { value.data.instance_type = 'linux_x2'; }],
    ['remote access', (value) => { value.data.remote_access_enabled = true; }],
    ['App Store state', (value) => { value.data.app_store_connect_status = {}; }],
  ];

  for (const [label, mutate] of cases) {
    const fixture = clone(validBuildResponse());
    mutate(fixture);
    assert.throws(() => inspect(fixture), /not release-admissible/, label);
  }
});

test('keeps the Codemagic platform index independent and enforces the APK release floor', () => {
  const later = validBuildResponse();
  later.data.index = PLATFORM_INDEX + 1;
  later.data.artifacts[1].name = `Engine_${PLATFORM_INDEX + 1}_artifacts.zip`;
  const inspected = inspect(later);
  assert.equal(inspected.metadata.platform_index, PLATFORM_INDEX + 1);
  assert.equal(inspected.metadata.version_code, VERSION_CODE);

  const stale = validBuildResponse();
  stale.data.artifacts[0].version_code = String(VERSION_CODE - 1);
  assert.throws(() => inspect(stale), /APK versionCode is below the protected release floor/);
});

test('rejects malformed, out-of-order, or mismatched build-index metadata', () => {
  const cases = [
    ['index/bundle mismatch', (value) => { value.data.index += 1; }, /artifact identity differs/],
    ['created timestamp', (value) => { value.data.created_at = 'not-a-date'; }, /created_at is missing or malformed/],
    ['start order', (value) => { value.data.started_at = '2026-08-02T01:13:03.000Z'; }, /timestamps are out of order/],
    ['finish order', (value) => { value.data.finished_at = '2026-08-02T01:00:03.000Z'; }, /timestamps are out of order/],
  ];
  for (const [label, mutate, pattern] of cases) {
    const fixture = clone(validBuildResponse());
    mutate(fixture);
    assert.throws(() => inspect(fixture), pattern, label);
  }
});

test('rejects missing, extra, duplicated, renamed, and mistyped artifacts', () => {
  const cases = [
    ['missing', (value) => { value.data.artifacts.pop(); }, /exactly one APK/],
    ['extra', (value) => {
      value.data.artifacts.push({
        ...value.data.artifacts[1],
        name: 'unexpected.txt',
        type: 'other',
      });
    }, /exactly one APK/],
    ['duplicate APK', (value) => {
      value.data.artifacts[1] = clone(value.data.artifacts[0]);
    }, /artifact types differ/],
    ['duplicate bundle', (value) => {
      value.data.artifacts[0] = clone(value.data.artifacts[1]);
    }, /artifact types differ/],
    ['renamed APK', (value) => {
      value.data.artifacts[0].name = 'custodial.apk';
    }, /artifact identity differs/],
    ['wrong version', (value) => {
      value.data.artifacts[0].version_code = String(VERSION_CODE - 1);
    }, /APK versionCode is below the protected release floor/],
    ['wrong type', (value) => {
      value.data.artifacts[0].type = 'aab';
    }, /artifact types differ/],
    ['legacy size alias', (value) => {
      value.data.artifacts[0].size = value.data.artifacts[0].size_in_bytes;
      delete value.data.artifacts[0].size_in_bytes;
    }, /artifact fields differ/],
    ['ambiguous size aliases', (value) => {
      value.data.artifacts[0].size = value.data.artifacts[0].size_in_bytes;
    }, /artifact fields differ/],
    ['string size', (value) => {
      value.data.artifacts[0].size_in_bytes = '4';
    }, /positive safe integer/],
    ['zero size', (value) => {
      value.data.artifacts[0].size_in_bytes = 0;
    }, /positive safe integer/],
    ['negative size', (value) => {
      value.data.artifacts[0].size_in_bytes = -1;
    }, /positive safe integer/],
    ['fractional size', (value) => {
      value.data.artifacts[0].size_in_bytes = 4.5;
    }, /positive safe integer/],
    ['boolean size', (value) => {
      value.data.artifacts[0].size_in_bytes = true;
    }, /positive safe integer/],
    ['null size', (value) => {
      value.data.artifacts[0].size_in_bytes = null;
    }, /positive safe integer/],
    ['unsafe integer size', (value) => {
      value.data.artifacts[0].size_in_bytes = Number.MAX_SAFE_INTEGER + 1;
    }, /non-deterministic JSON number|positive safe integer/],
    ['oversized APK', (value) => {
      value.data.artifacts[0].size_in_bytes = 250 * 1024 * 1024 + 1;
    }, /exceeds its size policy/],
  ];

  for (const [label, mutate, pattern] of cases) {
    const fixture = clone(validBuildResponse());
    mutate(fixture);
    assert.throws(() => inspect(fixture), pattern, label);
  }
});

test('rejects malicious or ambiguous artifact URLs', () => {
  const body = 'A'.repeat(320);
  const signature = 's'.repeat(27);
  const malicious = [
    'http://api.codemagic.io/artifact.apk',
    'https://evil.example/artifact.apk',
    'https://api.codemagic.io.evil.example/artifact.apk',
    'https://user:password@api.codemagic.io/artifact.apk',
    'https://api.codemagic.io:444/artifact.apk',
    'https://api.codemagic.io/artifact.apk#fragment',
    `https://api.codemagic.io//artifacts/.${body}.${signature}?`,
    `https://api.codemagic.io//artifacts/.${body}.${signature}#`,
    `https://api.codemagic.io:443//artifacts/.${body}.${signature}`,
    `https://@api.codemagic.io//artifacts/.${body}.${signature}`,
    `HTTPS://API.CODEMAGIC.IO//artifacts/.${body}.${signature}`,
    `https:////api.codemagic.io//artifacts/.${body}.${signature}`,
    `https://api.codemagic.io/artifacts/.${body}.${signature}`,
    `https://api.codemagic.io///artifacts/.${body}.${signature}`,
    `https://api.codemagic.io//artifacts/.${body}.${signature}/extra`,
    `https://api.codemagic.io//artifacts/.${'A'.repeat(255)}.${signature}`,
    `https://api.codemagic.io//artifacts/.${'A'.repeat(513)}.${signature}`,
    `https://api.codemagic.io//artifacts/.${body}.${'s'.repeat(26)}`,
    `https://api.codemagic.io//artifacts/.${body}.${'s'.repeat(28)}`,
    `https://api.codemagic.io//artifacts/${body}.${signature}`,
    `https://api.codemagic.io//artifacts/..${body}.${signature}`,
    `https://api.codemagic.io//artifacts/.${body}..${signature}`,
    `https://api.codemagic.io//artifacts/.${body}@.${signature}`,
    `https://api.codemagic.io//artifacts/.${body}%25.${signature}`,
    `https://api.codemagic.io//artifacts/.${body}%00.${signature}`,
    `https://api.codemagic.io//artifacts/.${body}:.${signature}`,
    `https://api.codemagic.io//artifacts/.${body};.${signature}`,
    `https://api.codemagic.io//artifacts/${BUILD_ID}/app.apk?token=query`,
    `https://api.codemagic.io/artifacts/${BUILD_ID}/app.apk`,
    `https://api.codemagic.io///artifacts/${BUILD_ID}/app.apk`,
    `https://api.codemagic.io//artifacts//${BUILD_ID}/app.apk`,
    `https://api.codemagic.io//artifacts/${BUILD_ID}//app.apk`,
    `https://api.codemagic.io//artifacts/${BUILD_ID}/app.apk/`,
    'https://api.codemagic.io/api/v3/builds/1234567890abcdef12345678',
    'https://api.codemagic.io//artifacts/%2e%2e/private',
    'https://api.codemagic.io//artifacts/name%2fother',
    'https://api.codemagic.io//artifacts/../private',
    'https://api.codemagic.io//artifacts/./private',
    'https://api.codemagic.io//artifacts\\other.apk',
    '//api.codemagic.io/artifact.apk',
    ' //api.codemagic.io/artifact.apk',
    '\t//api.codemagic.io/artifact.apk',
    '\r//api.codemagic.io/artifact.apk',
    '\n//api.codemagic.io/artifact.apk',
    '\u0000//api.codemagic.io/artifact.apk',
    '\u001f//api.codemagic.io/artifact.apk',
    '\u007f//api.codemagic.io/artifact.apk',
    'not a URL',
  ];

  for (const url of malicious) {
    const fixture = clone(validBuildResponse());
    fixture.data.artifacts[0].short_lived_download_url = url;
    assert.throws(() => inspect(fixture), /URL (?:is malformed|violates)/, url);
  }
});

test('rejects malformed, trailing, duplicate-key, and structurally incomplete JSON', () => {
  assert.throws(
    () => inspectCodemagicV3BuildResponse('{', {
      expectedBuildId: BUILD_ID,
      expectedCommit: COMMIT,
      minimumVersionCode: VERSION_CODE,
    }),
    /(?:JSON string|valid JSON)/,
  );
  assert.throws(
    () => inspectCodemagicV3BuildResponse(`${JSON.stringify(validBuildResponse())} trailing`, {
      expectedBuildId: BUILD_ID,
      expectedCommit: COMMIT,
      minimumVersionCode: VERSION_CODE,
    }),
    /trailing data/,
  );
  const duplicateStatus = JSON.stringify(validBuildResponse()).replace(
    '"status":"finished"',
    '"status":"finished","status":"failed"',
  );
  assert.throws(
    () => inspectCodemagicV3BuildResponse(duplicateStatus, {
      expectedBuildId: BUILD_ID,
      expectedCommit: COMMIT,
      minimumVersionCode: VERSION_CODE,
    }),
    /repeats the JSON key "status"/,
  );
  assert.throws(
    () => inspectCodemagicV3BuildResponse('{}', {
      expectedBuildId: BUILD_ID,
      expectedCommit: COMMIT,
      minimumVersionCode: VERSION_CODE,
    }),
    /fields differ/,
  );
});

test('API fetch sends its token only to the exact API origin and returns bounded bytes', async () => {
  const calls = [];
  const body = jsonBytes(validBuildResponse());
  const received = await fetchCodemagicV3BuildResponse(BUILD_ID, API_TOKEN, async (url, options) => {
    calls.push({ url: String(url), options });
    return response(body);
  });

  assert.deepEqual(received, body);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://codemagic.io/api/v3/builds/${BUILD_ID}`);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers['x-auth-token'], API_TOKEN);
  assert.equal(JSON.stringify(calls[0].options.headers).includes(ARTIFACT_SECRET), false);
});

test('API fetch fails closed for HTTP, media-type, network, and response-size errors', async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const message = await errorText(() => fetchCodemagicV3BuildResponse(
      BUILD_ID,
      API_TOKEN,
      async () => response(`server body ${API_TOKEN}`, { status }),
    ));
    assert.equal(message, `Codemagic API request failed with HTTP ${status}`);
    assert.equal(message.includes(API_TOKEN), false);
  }

  const mediaType = await errorText(() => fetchCodemagicV3BuildResponse(
    BUILD_ID,
    API_TOKEN,
    async () => response(API_TOKEN, { headers: { 'content-type': 'text/plain' } }),
  ));
  assert.match(mediaType, /non-JSON/);
  assert.equal(mediaType.includes(API_TOKEN), false);

  const network = await errorText(() => fetchCodemagicV3BuildResponse(
    BUILD_ID,
    API_TOKEN,
    async () => { throw new Error(`socket failed ${API_TOKEN}`); },
  ));
  assert.equal(network, 'Codemagic API request failed (Error)');
  assert.equal(network.includes(API_TOKEN), false);

  const declaredOversize = await errorText(() => fetchCodemagicV3BuildResponse(
    BUILD_ID,
    API_TOKEN,
    async () => response('{}', {
      headers: {
        'content-type': 'application/json',
        'content-length': String(API_LIMIT + 1),
      },
    }),
  ));
  assert.match(declaredOversize, /response-size policy/);
  assert.equal(declaredOversize.includes(API_TOKEN), false);

  const streamedOversize = await errorText(() => fetchCodemagicV3BuildResponse(
    BUILD_ID,
    API_TOKEN,
    async () => response(Buffer.alloc(API_LIMIT + 1), {
      headers: { 'content-type': 'application/json' },
    }),
  ));
  assert.match(streamedOversize, /response-size policy/);
  assert.equal(streamedOversize.includes(API_TOKEN), false);
});

test('artifact downloads never inherit the API token, including across redirects', async () => {
  const previousToken = process.env.CODEMAGIC_API_TOKEN;
  process.env.CODEMAGIC_API_TOKEN = API_TOKEN;
  const calls = [];
  const start = artifactCapabilityUrl('apk');
  const redirect = storageArtifactUrl('app-release.apk');
  try {
    const bytes = await downloadCodemagicArtifact(start, 4, 'apk', 'app-release.apk', async (url, options) => {
      calls.push({ url: String(url), options });
      if (calls.length === 1) {
        return response(null, {
          status: 302,
          headers: { location: redirect },
        });
      }
      return response(Buffer.from('APK!'), {
        headers: { 'content-type': 'application/octet-stream', 'content-length': '4' },
      });
    });
    assert.deepEqual(bytes, Buffer.from('APK!'));
  } finally {
    if (previousToken === undefined) delete process.env.CODEMAGIC_API_TOKEN;
    else process.env.CODEMAGIC_API_TOKEN = previousToken;
  }

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.includes(ARTIFACT_SECRET), true);
  assert.equal(calls[1].url, redirect);
  for (const call of calls) {
    const serializedOptions = JSON.stringify(call.options);
    assert.equal(call.url.includes(API_TOKEN), false);
    assert.equal(serializedOptions.includes(API_TOKEN), false);
    assert.equal(Object.hasOwn(call.options.headers, 'x-auth-token'), false);
    assert.equal(Object.hasOwn(call.options.headers, 'authorization'), false);
    assert.equal(call.options.redirect, 'manual');
  }
});

test('accepts a signed bundle redirect only for the exact expected artifact name', async () => {
  const bundleName = `Engine_${VERSION_CODE}_artifacts.zip`;
  const bundleRedirect = storageArtifactUrl(bundleName);
  let calls = 0;
  const bytes = await downloadCodemagicArtifact(
    artifactCapabilityUrl('bundle'),
    4,
    'bundle',
    bundleName,
    async () => {
      calls += 1;
      if (calls === 1) {
        return response(null, { status: 302, headers: { location: bundleRedirect } });
      }
      return response(Buffer.from('ZIP!'), {
        headers: { 'content-type': 'application/octet-stream', 'content-length': '4' },
      });
    },
  );
  assert.deepEqual(bytes, Buffer.from('ZIP!'));
  assert.equal(calls, 2);

  for (const mismatch of [
    { type: 'apk', expected: 'app-release.apk', actual: bundleName },
    { type: 'bundle', expected: bundleName, actual: 'app-release.apk' },
    { type: 'bundle', expected: bundleName, actual: 'Engine_999_artifacts.zip' },
  ]) {
    const message = await errorText(() => downloadCodemagicArtifact(
      artifactCapabilityUrl(mismatch.type),
      4,
      mismatch.type,
      mismatch.expected,
      async () => response(null, {
        status: 302,
        headers: { location: storageArtifactUrl(mismatch.actual) },
      }),
    ));
    assert.match(message, /redirect violates HTTPS policy/);
  }

  const unsafeExpectedName = await errorText(() => downloadCodemagicArtifact(
    artifactCapabilityUrl('bundle'),
    4,
    'bundle',
    `Engine_${'9'.repeat(100)}_artifacts.zip`,
    async () => assert.fail('Malformed expected artifact name must fail before download'),
  ));
  assert.match(unsafeExpectedName, /bundle name is malformed/);
});

test('artifact redirects and downloads fail closed without leaking response secrets', async () => {
  const start = artifactCapabilityUrl('apk');
  const body = 'A'.repeat(320);
  const signature = 's'.repeat(27);
  const hostileRedirects = [
    'http://storage.example/fixture',
    'https://user:password@storage.example/fixture',
    'https://storage.example:444/fixture',
    'https://storage.example/fixture#fragment',
    'https://api.codemagic.io/api/private',
    `https://api.codemagic.io//artifacts/.${body}.${signature}?`,
    `https://api.codemagic.io//artifacts/.${body}.${signature}#`,
    `https://api.codemagic.io:443//artifacts/.${body}.${signature}`,
    `https://@api.codemagic.io//artifacts/.${body}.${signature}`,
    `HTTPS://API.CODEMAGIC.IO//artifacts/.${body}.${signature}`,
    `https:////api.codemagic.io//artifacts/.${body}.${signature}`,
    `https://api.codemagic.io/artifacts/${BUILD_ID}/fixture`,
    `https://api.codemagic.io///artifacts/${BUILD_ID}/fixture`,
    `https://api.codemagic.io//artifacts//${BUILD_ID}/fixture`,
    `https://api.codemagic.io//artifacts/${BUILD_ID}//fixture`,
    'https://storage.googleapis.com/codemagic-fixture/%2e%2e/private',
    'https://storage.googleapis.com//codemagic-fixture/private',
    'https://storage.googleapis.com/codemagic-fixture//private',
    'https://storage.googleapis.com/codemagic-fixture/../private',
    'https://storage.googleapis.com/codemagic-fixture\\private',
    `${storageArtifactUrl('app-release.apk')}#`,
    storageArtifactUrl('app-release.apk').replace('https://', 'HTTPS://'),
    storageArtifactUrl('app-release.apk').replace('https://', 'https://@'),
    storageArtifactUrl('app-release.apk').replace('storage.googleapis.com', 'storage.googleapis.com:443'),
    storageArtifactUrl('app-release.apk').replace('?Expires=', '??Expires='),
    `${storageArtifactUrl('app-release.apk')}&`,
    storageArtifactUrl('app-release.apk').replace('?Expires=', '?&Expires='),
    storageArtifactUrl('app-release.apk').replace('&GoogleAccessId=', '&&GoogleAccessId='),
    storageArtifactUrl('app-release.apk').replace('Expires=', '%45xpires='),
    storageArtifactUrl('app-release.apk').replace('Expires=1999999999', 'Expires=tomorrow'),
    storageArtifactUrl('app-release.apk').replace('Expires=1999999999', 'Expires=%00'),
    storageArtifactUrl('app-release.apk').replace(STORAGE_GOOGLE_ACCESS_ID, '%00'),
    storageArtifactUrl('app-release.apk').replace(STORAGE_GOOGLE_ACCESS_ID, STORAGE_GOOGLE_ACCESS_ID.replace('f', '%66')),
    storageArtifactUrl('app-release.apk').replace(STORAGE_GOOGLE_ACCESS_ID, '%C3%A9%40fixture.invalid'),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, `+${'A'.repeat(341)}%3D%3D`),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, STORAGE_SIGNATURE.replace('%2B', '%2b')),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, STORAGE_SIGNATURE.replace('%2B', '%2G')),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, STORAGE_SIGNATURE.replace('A', '%41')),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, '%FF'),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, '%26'),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, 'AB%3D%3D'),
    storageArtifactUrl('app-release.apk').replace(STORAGE_SIGNATURE, 'AAB%3D'),
    storageArtifactUrl('app-release.apk').replace(
      `Expires=1999999999&GoogleAccessId=${STORAGE_GOOGLE_ACCESS_ID}&Signature=${STORAGE_SIGNATURE}`,
      `Signature=${STORAGE_SIGNATURE}&Expires=1999999999&GoogleAccessId=${STORAGE_GOOGLE_ACCESS_ID}`,
    ),
    storageArtifactUrl('app-release.apk').replace('Expires=1999999999', 'Expires='),
    storageArtifactUrl('app-release.apk').replace(`&Signature=${STORAGE_SIGNATURE}`, ''),
    `${storageArtifactUrl('app-release.apk')}&Unexpected=value`,
    storageArtifactUrl('app-release.apk').replace(`Signature=${STORAGE_SIGNATURE}`, 'Expires=2000000000'),
    storageArtifactUrl('app-release.apk').replace('app-release.apk', 'foreign.apk'),
    storageArtifactUrl('app-release.apk').replace(`/${STORAGE_OBJECT_ID}/`, '//'),
    '//storage.googleapis.com/codemagic-fixture/private',
    ' //storage.googleapis.com/codemagic-fixture/private',
    '\t//storage.googleapis.com/codemagic-fixture/private',
    '\r//storage.googleapis.com/codemagic-fixture/private',
    '\n//storage.googleapis.com/codemagic-fixture/private',
    '\u0000//storage.googleapis.com/codemagic-fixture/private',
    '\u001f//storage.googleapis.com/codemagic-fixture/private',
    '\u007f//storage.googleapis.com/codemagic-fixture/private',
  ];
  for (const location of hostileRedirects) {
    const message = await errorText(() => downloadCodemagicArtifact(start, 4, 'apk', 'app-release.apk', async () => (
      // Use a minimal response object so the platform Headers implementation
      // cannot trim or reject the hostile raw value before admission sees it.
      {
        status: 302,
        headers: { get: (name) => (String(name).toLowerCase() === 'location' ? location : null) },
        body: null,
      }
    )));
    assert.match(message, /redirect violates HTTPS policy/);
    assert.equal(message.includes(location), false);
    assert.equal(message.includes(API_TOKEN), false);
  }

  const missingLocation = await errorText(() => downloadCodemagicArtifact(start, 4, 'apk', 'app-release.apk', async () => ({
    status: 302,
    headers: { get: () => null },
    body: null,
  })));
  assert.match(missingLocation, /redirect violates HTTPS policy/);

  for (const status of [401, 403, 429, 500]) {
    const message = await errorText(() => downloadCodemagicArtifact(start, 4, 'apk', 'app-release.apk', async () => (
      response(`artifact failure ${API_TOKEN}`, { status })
    )));
    assert.equal(message, `Codemagic artifact download failed with HTTP ${status}`);
    assert.equal(message.includes(API_TOKEN), false);
  }

  const network = await errorText(() => downloadCodemagicArtifact(start, 4, 'apk', 'app-release.apk', async () => {
    throw new Error(`network failure ${API_TOKEN}`);
  }));
  assert.equal(network, 'Codemagic artifact download failed (Error)');
  assert.equal(network.includes(API_TOKEN), false);

  const wrongSize = await errorText(() => downloadCodemagicArtifact(start, 4, 'apk', 'app-release.apk', async () => (
    response(Buffer.from('bad'), { headers: { 'content-length': '3' } })
  )));
  assert.match(wrongSize, /byte count differs/);

  const oversize = await errorText(() => downloadCodemagicArtifact(start, 4, 'bundle', `Engine_${VERSION_CODE}_artifacts.zip`, async () => (
    response(Buffer.alloc(0), { headers: { 'content-length': String(25 * 1024 * 1024 + 1) } })
  )));
  assert.match(oversize, /response-size policy/);
  assert.equal(oversize.includes(API_TOKEN), false);

  let redirectCount = 0;
  const redirectLimit = await errorText(() => downloadCodemagicArtifact(start, 4, 'apk', 'app-release.apk', async () => {
    redirectCount += 1;
    return response(null, {
      status: 302,
      headers: { location: storageArtifactUrl('app-release.apk') },
    });
  }));
  assert.match(redirectLimit, /exceeded redirect policy/);
  assert.equal(redirectCount, 5);
});
