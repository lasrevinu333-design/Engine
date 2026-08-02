#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  assertCustodialLinuxAdmissionHostPolicy,
  canonicalHostToolPolicyJson,
  computeBoundedJavaRuntimeDigest,
  computeBoundedNpmTreeDigest,
  createCustodialAdmissionHostEnvironment,
  custodialLinuxAdmissionHostToolInternals,
  verifyCustodialLinuxAdmissionHostTools,
} from './custodial-linux-admission-host-tools.mjs';
import { CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF } from './admit-custodial-codemagic-build.mjs';

const nodePath = '/home/eric/.cache/codex-toolchains/node-v22.23.1/bin/node';
const secureTemporaryParent = '/home/eric/.cache/codex-toolchains';
const helperPath = custodialLinuxAdmissionHostToolInternals.policyPath.replace(
  '/release-policies/custodial-linux-admission-host-tools.json',
  '/scripts/custodial-linux-admission-host-tools.mjs',
);
const realPolicy = JSON.parse(readFileSync(custodialLinuxAdmissionHostToolInternals.policyPath, 'utf8'));

assert.equal(canonicalHostToolPolicyJson(realPolicy), readFileSync(
  custodialLinuxAdmissionHostToolInternals.policyPath,
  'utf8',
));
assert.equal(assertCustodialLinuxAdmissionHostPolicy(realPolicy), true);

for (const mutate of [
  (value) => { value.extra = true; },
  (value) => { value.platform = 'darwin'; },
  (value) => { value.architecture = 'arm64'; },
  (value) => { value.android_sdk.path = '/opt/android-sdk'; },
  (value) => { value.android_sdk.mode_octal = '0775'; },
  (value) => { value.android_sdk.build_tools_directory += '-other'; },
  (value) => { value.trusted_path = '/usr/bin'; },
  (value) => { value.node.path = '/usr/bin/node'; },
  (value) => { value.node.resolved_path += '.elsewhere'; },
  (value) => { value.node.sha256 = '0'.repeat(63); },
  (value) => { value.node.mode_octal = '0775'; },
  (value) => { value.node.version_stdout = 'v22.23.2'; },
  (value) => { value.npm.root_path += '-other'; },
  (value) => { value.npm.version_stdout = '11.16.0'; },
  (value) => { value.npm.tree.sha256 = 'g'.repeat(64); },
  (value) => { value.npm.tree.entry_count += 1; },
  (value) => { delete value.npm.tree.file_count; },
  (value) => { value.java.home_path = '/usr/lib/jvm/default-java'; },
  (value) => { value.java.path = '/usr/bin/java'; },
  (value) => { value.java.version_stderr = 'openjdk version "21"'; },
  (value) => { value.java.runtime_tree.sha256 = 'g'.repeat(64); },
  (value) => { value.java.runtime_tree.entry_count += 1; },
  (value) => { value.git.uid = -1; },
  (value) => { value.unzip.size_bytes = 0; },
]) {
  const candidate = structuredClone(realPolicy);
  mutate(candidate);
  assert.throws(() => assertCustodialLinuxAdmissionHostPolicy(candidate));
}

const verified = await verifyCustodialLinuxAdmissionHostTools();
assert.equal(verified.paths.node, nodePath);
assert.equal(verified.paths.git, '/usr/bin/git');
assert.equal(verified.paths.unzip, '/usr/bin/unzip');
assert.equal(verified.paths.java, '/usr/lib/jvm/java-21-openjdk-amd64/bin/java');
assert.equal(verified.paths.java_home, '/usr/lib/jvm/java-21-openjdk-amd64');
assert.equal(verified.paths.android_sdk_root, '/home/eric/Android/Sdk');
assert.equal(verified.paths.android_build_tools_directory, '/home/eric/Android/Sdk/build-tools/35.0.1');
assert.equal(verified.npm_tree.sha256, realPolicy.npm.tree.sha256);
assert.equal(verified.java_runtime_tree.sha256, realPolicy.java.runtime_tree.sha256);
assert.equal(verified.proof.policy_sha256, verified.policy_sha256);
assert.equal(verified.proof.node.sha256, realPolicy.node.sha256);
assert.equal(verified.proof.npm.tree_sha256, realPolicy.npm.tree.sha256);
assert.equal(verified.proof.java.runtime_tree_sha256, realPolicy.java.runtime_tree.sha256);
assert.deepEqual(verified.proof, CUSTODIAL_CODEMAGIC_EXPECTED_HOST_PROOF);
assert.ok(Object.isFrozen(verified.proof));
assert.equal(verified.npm_command.executable, nodePath);
assert.deepEqual(verified.npm_command.arguments_prefix, [realPolicy.npm.cli_path]);
assert.ok(Object.isFrozen(verified));
assert.ok(Object.isFrozen(verified.environment));
assert.equal(verified.environment.NODE_OPTIONS, undefined);
assert.equal(verified.environment.NODE_PATH, undefined);
assert.equal(verified.environment.LD_PRELOAD, undefined);
assert.equal(verified.environment.NPM_CONFIG_REGISTRY, undefined);
assert.equal(verified.environment.GIT_CONFIG, undefined);
assert.equal(verified.environment.PATH, realPolicy.trusted_path);
assert.equal(verified.environment.JAVA_HOME, realPolicy.java.home_path);
assert.equal(verified.environment.ANDROID_HOME, realPolicy.android_sdk.path);
assert.equal(verified.environment.ANDROID_SDK_ROOT, realPolicy.android_sdk.path);

const wrongNode = spawnSync('/usr/bin/node', [
  helperPath,
], { encoding: 'utf8', env: { PATH: '/usr/bin', LANG: 'C', LC_ALL: 'C' } });
assert.notEqual(wrongNode.status, 0);
assert.match(wrongNode.stderr, /must start under the pinned Node executable/);
const flaggedNode = spawnSync(nodePath, ['--no-warnings', helperPath], {
  encoding: 'utf8',
  env: { PATH: '/usr/bin', LANG: 'C', LC_ALL: 'C' },
});
assert.notEqual(flaggedNode.status, 0);
assert.match(flaggedNode.stderr, /rejects Node CLI runtime flags/);
const optionInjectedNode = spawnSync(nodePath, [helperPath], {
  encoding: 'utf8',
  env: {
    PATH: '/usr/bin',
    LANG: 'C',
    LC_ALL: 'C',
    NODE_OPTIONS: '--trace-warnings',
  },
});
assert.notEqual(optionInjectedNode.status, 0);
assert.match(optionInjectedNode.stderr, /rejects inherited runtime environment: NODE_OPTIONS/);

assert.throws(
  () => createCustodialAdmissionHostEnvironment(Object.freeze({ policy_path: verified.policy_path })),
  /verified Custodial admission host result/,
);
assert.throws(
  () => createCustodialAdmissionHostEnvironment(verified, { NODE_OPTIONS: '--require=/tmp/evil.js' }),
  /not allowed/,
);
assert.throws(
  () => createCustodialAdmissionHostEnvironment(verified, { CODEMAGIC_API_TOKEN: 'token\nleak' }),
  /malformed/,
);
const secretEnvironment = createCustodialAdmissionHostEnvironment(verified, {
  CODEMAGIC_API_TOKEN: 'test-token-not-a-real-secret',
});
assert.equal(secretEnvironment.CODEMAGIC_API_TOKEN, 'test-token-not-a-real-secret');
assert.equal(secretEnvironment.PATH, realPolicy.trusted_path);
assert.ok(Object.isFrozen(secretEnvironment));

const fixtureRoot = mkdtempSync(join(secureTemporaryParent, 'custodial-host-tool-test-'));
chmodSync(fixtureRoot, 0o700);
try {
  const cleanTree = join(fixtureRoot, 'clean-tree');
  mkdirSync(cleanTree, { mode: 0o700 });
  mkdirSync(join(cleanTree, 'bin'), { mode: 0o700 });
  writeFileSync(join(cleanTree, 'package.json'), '{"name":"fixture"}\n', { mode: 0o600 });
  writeFileSync(join(cleanTree, 'bin', 'cli.js'), '#!/usr/bin/env node\n', { mode: 0o700 });
  symlinkSync('bin/cli.js', join(cleanTree, 'cli'));

  const baseline = computeBoundedNpmTreeDigest(cleanTree);
  assert.equal(baseline.entry_count, 5);
  assert.equal(baseline.file_count, 2);
  assert.equal(baseline.directory_count, 2);
  assert.equal(baseline.symlink_count, 1);
  assert.equal(computeBoundedNpmTreeDigest(cleanTree).sha256, baseline.sha256);

  writeFileSync(join(cleanTree, 'package.json'), '{"name":"changed"}\n', { mode: 0o600 });
  assert.notEqual(computeBoundedNpmTreeDigest(cleanTree).sha256, baseline.sha256);
  writeFileSync(join(cleanTree, 'package.json'), '{"name":"fixture"}\n', { mode: 0o600 });
  assert.equal(computeBoundedNpmTreeDigest(cleanTree).sha256, baseline.sha256);

  chmodSync(join(cleanTree, 'package.json'), 0o620);
  assert.throws(() => computeBoundedNpmTreeDigest(cleanTree), /group\/world-writable/);
  chmodSync(join(cleanTree, 'package.json'), 0o600);

  chmodSync(join(cleanTree, 'bin'), 0o720);
  assert.throws(() => computeBoundedNpmTreeDigest(cleanTree), /group\/world-writable/);
  chmodSync(join(cleanTree, 'bin'), 0o700);

  const hardLink = join(cleanTree, 'package-hard-link.json');
  linkSync(join(cleanTree, 'package.json'), hardLink);
  assert.throws(() => computeBoundedNpmTreeDigest(cleanTree), /hard-link count/);
  rmSync(hardLink);

  const externalFile = join(fixtureRoot, 'outside.js');
  writeFileSync(externalFile, 'outside\n', { mode: 0o600 });
  const escapingLink = join(cleanTree, 'escape');
  symlinkSync('../outside.js', escapingLink);
  assert.throws(() => computeBoundedNpmTreeDigest(cleanTree), /escapes its root/);
  rmSync(escapingLink);

  const absoluteLink = join(cleanTree, 'absolute');
  symlinkSync(externalFile, absoluteLink);
  assert.throws(() => computeBoundedNpmTreeDigest(cleanTree), /target is unsafe/);
  rmSync(absoluteLink);

  assert.throws(
    () => computeBoundedNpmTreeDigest(cleanTree, {
      maxEntries: 1,
      maxFileBytes: 1_048_576,
      maxTotalFileBytes: 20_000_000,
      maxDepth: 32,
    }),
    /entry limit/,
  );
  assert.throws(
    () => computeBoundedNpmTreeDigest(cleanTree, {
      maxEntries: 100,
      maxFileBytes: 4,
      maxTotalFileBytes: 20_000_000,
      maxDepth: 32,
    }),
    /size limit/,
  );

  const javaTree = join(fixtureRoot, 'java-tree');
  mkdirSync(javaTree, { mode: 0o700 });
  mkdirSync(join(javaTree, 'bin'), { mode: 0o700 });
  writeFileSync(join(javaTree, 'bin', 'java'), 'fixture-java-runtime\n', { mode: 0o700 });
  const javaBaseline = computeBoundedJavaRuntimeDigest(javaTree);
  assert.equal(javaBaseline.entry_count, 3);
  assert.equal(javaBaseline.file_count, 1);
  assert.equal(javaBaseline.directory_count, 2);
  assert.equal(javaBaseline.symlink_count, 0);
  writeFileSync(join(javaTree, 'bin', 'java'), 'modified-java-runtime\n', { mode: 0o700 });
  assert.notEqual(computeBoundedJavaRuntimeDigest(javaTree).sha256, javaBaseline.sha256);
  chmodSync(join(javaTree, 'bin', 'java'), 0o720);
  assert.throws(() => computeBoundedJavaRuntimeDigest(javaTree), /group\/world-writable/);

  const copiedNode = join(fixtureRoot, 'node-copy');
  writeFileSync(copiedNode, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const copiedIdentity = custodialLinuxAdmissionHostToolInternals.hashOpenRegularFile(
    copiedNode,
    { executable: true },
  );
  assert.match(copiedIdentity.sha256, /^[a-f0-9]{64}$/);
  chmodSync(copiedNode, 0o720);
  assert.throws(
    () => custodialLinuxAdmissionHostToolInternals.hashOpenRegularFile(copiedNode, { executable: true }),
    /group\/world-writable/,
  );
  chmodSync(copiedNode, 0o600);
  assert.throws(
    () => custodialLinuxAdmissionHostToolInternals.hashOpenRegularFile(copiedNode, { executable: true }),
    /lacks an execute bit/,
  );
  chmodSync(copiedNode, 0o700);
  const copiedNodeLink = join(fixtureRoot, 'node-link');
  symlinkSync('node-copy', copiedNodeLink);
  assert.throws(
    () => custodialLinuxAdmissionHostToolInternals.hashOpenRegularFile(copiedNodeLink, { executable: true }),
    /regular non-symlink/,
  );

  const safeTmp = join(fixtureRoot, 'admission-tmp');
  mkdirSync(safeTmp, { mode: 0o700 });
  const tmpEnvironment = createCustodialAdmissionHostEnvironment(verified, { TMPDIR: safeTmp });
  assert.equal(tmpEnvironment.TMPDIR, safeTmp);
  chmodSync(safeTmp, 0o770);
  assert.throws(
    () => createCustodialAdmissionHostEnvironment(verified, { TMPDIR: safeTmp }),
    /protected directory/,
  );
} finally {
  assert.ok(fixtureRoot.startsWith(`${secureTemporaryParent}/custodial-host-tool-test-`));
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('Custodial Linux admission host-tool policy tests passed.');
