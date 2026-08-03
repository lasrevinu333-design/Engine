import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { resolveBuildIdentity } from '../../scripts/refresh-frontend-release-manifest.mjs';
import {
  managerNativeVaultSourceDigest,
  managerNativeVaultTrackedHeadState,
} from './manager-native-vault-source.mjs';

const SOURCE_FIXTURE = {
  'package.json': '{"name":"fixture"}\n',
  'dist/esm/index.js': 'export const ManagerNativeVault = {};\n',
  'dist/esm/index.d.ts': 'export declare const ManagerNativeVault: object;\n',
  'dist/plugin.cjs': 'exports.ManagerNativeVault = {};\n',
  'android/build.gradle': 'apply plugin: "com.android.library"\n',
  'android/gradle.properties': 'android.useAndroidX=true\n',
  'android/settings.gradle': 'rootProject.name = "fixture"\n',
  'android/src/main/AndroidManifest.xml': '<manifest package="fixture"/>\n',
  'android/src/main/java/ManagerNativeVaultPlugin.java': 'final class ManagerNativeVaultPlugin {}\n',
  'Package.swift': '// swift-tools-version: 6.2\n',
  'Package.resolved': '{"version":3,"pins":[]}\n',
  'Sources/ManagerNativeVault/ManagerNativeVaultPlugin.swift': 'public final class ManagerNativeVaultPlugin {}\n',
  'Tests/ManagerNativeVaultIOSTests/ManagerNativeVaultTests.swift': 'import Testing\n',
};

const root = mkdtempSync(join(tmpdir(), 'manager-native-source-contract-'));
function write(relativePath, value) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, { mode: 0o600 });
}

try {
  for (const [path, value] of Object.entries(SOURCE_FIXTURE)) write(path, value);

  const baseline = managerNativeVaultSourceDigest(root);
  for (const [path, value] of Object.entries({
    '.build/debug/generated.o': 'generated swift object',
    '.swiftpm/configuration/registries.json': 'generated swiftpm config',
    '.idea/workspace.xml': 'generated ide state',
    '.vscode/settings.json': 'generated editor state',
    'DerivedData/Build/result': 'generated xcode output',
    'android/.gradle/cache.bin': 'generated gradle cache',
    'android/build/generated/source.java': 'generated android source',
    'android/local.properties': 'sdk.dir=/host-specific/path',
    'Sources/ManagerNativeVault/.build/cache': 'nested generated output',
  })) write(path, value);
  assert.equal(managerNativeVaultSourceDigest(root), baseline, 'generated host state must not affect provenance');

  write('Sources/ManagerNativeVault/ManagerNativeVaultPlugin.swift', 'public final class ManagerNativeVaultPlugin { public init() {} }\n');
  const swiftMutation = managerNativeVaultSourceDigest(root);
  assert.notEqual(swiftMutation, baseline, 'real Swift source must affect provenance');
  write('android/src/main/java/ManagerNativeVaultPlugin.java', 'final class ManagerNativeVaultPlugin { int version = 2; }\n');
  const javaMutation = managerNativeVaultSourceDigest(root);
  assert.notEqual(javaMutation, swiftMutation, 'real Java source must affect provenance');
  write('package.json', '{"name":"fixture","version":"2"}\n');
  assert.notEqual(managerNativeVaultSourceDigest(root), javaMutation, 'package metadata must affect provenance');

  write('unclassified.txt', 'must fail closed');
  assert.throws(() => managerNativeVaultSourceDigest(root), /unclassified source entry/);
  rmSync(join(root, 'unclassified.txt'));
  symlinkSync(join(root, 'package.json'), join(root, 'Sources', 'ManagerNativeVault', 'linked-source'));
  assert.throws(() => managerNativeVaultSourceDigest(root), /may not contain symlinks/);
} finally {
  rmSync(root, { force: true, recursive: true });
}

const repository = mkdtempSync(join(tmpdir(), 'manager-native-source-git-contract-'));
const trackedPlugin = resolve(repository, 'mobile/plugins/manager-native-vault');
function repositoryWrite(relativePath, value) {
  const path = resolve(repository, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, { mode: 0o600 });
}
function git(args) {
  return String(execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })).trim();
}

try {
  repositoryWrite('.gitignore', '*.java\n*.swift\n');
  repositoryWrite('frontend-release-manifest.json', '{"release_id":"release-test","asset_hashes_sha256":{}}\n');
  for (const [path, value] of Object.entries(SOURCE_FIXTURE)) {
    repositoryWrite(`mobile/plugins/manager-native-vault/${path}`, value);
  }
  git(['init', '--quiet']);
  git(['config', 'user.name', 'Manager Source Contract']);
  git(['config', 'user.email', 'manager-source-contract@example.invalid']);
  git(['add', '-f', '.']);
  git(['commit', '--quiet', '-m', 'fixture']);
  const commit = git(['rev-parse', 'HEAD']);
  const baseline = managerNativeVaultTrackedHeadState(trackedPlugin, {
    repositoryRoot: repository,
    revision: commit,
  });
  assert.equal(baseline.tracked_head_exact, true, 'committed canonical native source must bind to HEAD');

  repositoryWrite(
    'mobile/plugins/manager-native-vault/android/src/main/java/IgnoredAuthority.java',
    'final class IgnoredAuthority {}\n',
  );
  repositoryWrite(
    'mobile/plugins/manager-native-vault/Sources/ManagerNativeVault/IgnoredAuthority.swift',
    'final class IgnoredAuthority {}\n',
  );
  assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all']), '', 'fixture must reproduce ignored-source gap');
  const ignored = managerNativeVaultTrackedHeadState(trackedPlugin, {
    repositoryRoot: repository,
    revision: commit,
  });
  assert.equal(ignored.tracked_head_exact, false, 'ignored native source must not bind to HEAD');
  assert.deepEqual(ignored.untracked_source_paths, [
    'mobile/plugins/manager-native-vault/android/src/main/java/IgnoredAuthority.java',
    'mobile/plugins/manager-native-vault/Sources/ManagerNativeVault/IgnoredAuthority.swift',
  ]);
  const identity = resolveBuildIdentity({
    rootDirectory: repository,
    edition: 'manager',
    environment: { MZ_RELEASE_ID: 'release-test', MZ_SOURCE_COMMIT: commit },
  });
  assert.equal(identity.source_commit_exact, false, 'ignored native source must make Manager build identity dirty');
  assert.equal(identity.build_id, `release-test.manager.${commit.slice(0, 12)}.dirty`);
} finally {
  rmSync(repository, { force: true, recursive: true });
}

console.log('Manager native vault source provenance tests passed.');
