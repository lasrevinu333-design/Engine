import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { managerNativeVaultSourceDigest } from './manager-native-vault-source.mjs';

const root = mkdtempSync(join(tmpdir(), 'manager-native-source-contract-'));
function write(relativePath, value) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, { mode: 0o600 });
}

try {
  for (const [path, value] of Object.entries({
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
  })) write(path, value);

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

console.log('Manager native vault source provenance tests passed.');
