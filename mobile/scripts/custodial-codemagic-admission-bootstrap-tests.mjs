#!/home/eric/.cache/codex-toolchains/node-v22.23.1/bin/node

import assert from 'node:assert/strict';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  custodialCodemagicAdmissionBootstrapInternals,
  parseCustodialCodemagicAdmissionBootstrapArguments,
  runCustodialCodemagicAdmissionBootstrap,
} from './run-custodial-codemagic-admission.mjs';

const BUILD_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const COMMIT = '68bf6d7d9863376ad41b27ec4eb99071d48b6864';
const HOST_POLICY_SHA256 = 'b'.repeat(64);
const TOKEN = 'test-token-never-print-0123456789';
const PRODUCTION_PINNED_NODE = '/home/eric/.cache/codex-toolchains/node-v22.23.1/bin/node';
const PINNED_NODE = realpathSync(process.execPath);
const SDK_ROOT = realpathSync(custodialCodemagicAdmissionBootstrapInternals.repositoryRoot);
const JAVA_HOME = dirname(PINNED_NODE);
const NPM_CLI = join(dirname(PINNED_NODE), 'npm-cli-fixture.js');
const GIT = realpathSync(fileURLToPath(new URL('./run-custodial-codemagic-admission.mjs', import.meta.url)));
const ORIGIN = 'https://github.com/lasrevinu333-design/Engine.git';
const TRUSTED_PATH = [
  dirname(PINNED_NODE),
  JAVA_HOME,
].join(':');
const SNAPSHOT_PATHS = [
  'codemagic.yaml',
  'package-lock.json',
  'package.json',
  'mobile/package.json',
  'mobile/release-policies/custodial-codemagic.json',
  'mobile/release-policies/custodial-linux-admission-host-tools.json',
  'mobile/scripts/admit-custodial-codemagic-build.mjs',
  'mobile/scripts/custodial-codemagic-admission.schema.json',
  'mobile/scripts/custodial-linux-admission-host-tools.mjs',
  'mobile/scripts/run-custodial-codemagic-admission.mjs',
  'mobile/scripts/verify-custodial-android-release.mjs',
].sort();

function createCanonicalTemporaryDirectory(prefix, temporaryParent = tmpdir()) {
  const canonicalParent = realpathSync(temporaryParent);
  return realpathSync(mkdtempSync(join(canonicalParent, prefix)));
}

function captureStream() {
  const chunks = [];
  return {
    write(value) {
      chunks.push(Buffer.from(value));
      return true;
    },
    text() {
      return Buffer.concat(chunks).toString('utf8');
    },
  };
}

function fakeHostTools({ sdkRoot = SDK_ROOT } = {}) {
  const verified = Object.freeze({
    schema_version: 1,
    policy_path: fileURLToPath(new URL('../release-policies/custodial-linux-admission-host-tools.json', import.meta.url)),
    policy_sha256: HOST_POLICY_SHA256,
    platform: process.platform,
    architecture: process.arch,
    paths: Object.freeze({
      node: PINNED_NODE,
      npm_cli: NPM_CLI,
      java: PINNED_NODE,
      java_home: JAVA_HOME,
      android_sdk_root: sdkRoot,
      android_build_tools_directory: sdkRoot,
      git: GIT,
      unzip: GIT,
    }),
    npm_command: Object.freeze({
      executable: PINNED_NODE,
      arguments_prefix: Object.freeze([NPM_CLI]),
    }),
    environment: Object.freeze({
      PATH: TRUSTED_PATH,
      JAVA_HOME,
      ANDROID_HOME: sdkRoot,
      ANDROID_SDK_ROOT: sdkRoot,
      LANG: 'C',
      LC_ALL: 'C',
      TZ: 'UTC',
      HOME: '/nonexistent/custodial-admission',
      CI: 'true',
      NO_COLOR: '1',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      NPM_CONFIG_UPDATE_NOTIFIER: 'false',
      NPM_CONFIG_FUND: 'false',
      NPM_CONFIG_AUDIT: 'false',
      NPM_CONFIG_ENGINE_STRICT: 'true',
      NPM_CONFIG_COLOR: 'false',
      NPM_CONFIG_PROGRESS: 'false',
      COREPACK_ENABLE_PROJECT_SPEC: '0',
    }),
    trusted_path: TRUSTED_PATH,
    npm_tree: Object.freeze({ algorithm: 'test', sha256: 'c'.repeat(64) }),
    java_runtime_tree: Object.freeze({ algorithm: 'test', sha256: 'd'.repeat(64) }),
    proof: Object.freeze({ schema_version: 1, policy_sha256: HOST_POLICY_SHA256 }),
  });
  return {
    expectedVerifiedHostIdentity: verified,
    async verifyCustodialLinuxAdmissionHostTools() {
      return verified;
    },
    createCustodialAdmissionHostEnvironment(candidate, additions) {
      assert.equal(candidate, verified);
      assert.equal(
        Object.keys(additions).every((name) => name === 'TMPDIR'),
        true,
      );
      return Object.freeze({ ...verified.environment, ...additions });
    },
  };
}

function fakeHostDependencies(options) {
  const hostTools = fakeHostTools(options);
  return {
    loadHostTools: async () => hostTools,
    expectedVerifiedHostIdentity: hostTools.expectedVerifiedHostIdentity,
  };
}

function result(stdout = '', stderr = '', status = 0) {
  return {
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr),
    status,
    signal: null,
    error: undefined,
  };
}

function fakeGithubResponse(commit = COMMIT) {
  const bytes = Buffer.from(JSON.stringify({
    ref: 'refs/heads/main',
    object: { type: 'commit', sha: commit },
  }));
  return {
    status: 200,
    url: 'https://api.github.com/repos/lasrevinu333-design/Engine/git/ref/heads/main',
    headers: { get: (name) => (name === 'content-type' ? 'application/json; charset=utf-8' : null) },
    body: null,
    async arrayBuffer() { return bytes; },
  };
}

function copySnapshot(checkoutRoot) {
  mkdirSync(checkoutRoot, { mode: 0o700 });
  for (const relativePath of SNAPSHOT_PATHS) {
    const destination = join(checkoutRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    copyFileSync(join(custodialCodemagicAdmissionBootstrapInternals.repositoryRoot, relativePath), destination);
  }
}

function sourceGitResult(args) {
  const cIndex = args.indexOf('-C');
  assert.notEqual(cIndex, -1);
  const checkoutRoot = args[cIndex + 1];
  const command = args.slice(cIndex + 2);
  if (command[0] === 'rev-parse' && command[1] === '--show-toplevel') return result(`${checkoutRoot}\n`);
  if (command[0] === 'remote' && command[1] === 'get-url') return result(`${ORIGIN}\n`);
  if (command[0] === 'rev-parse' && ['HEAD^{commit}', 'refs/remotes/origin/main^{commit}'].includes(command[1])) {
    return result(`${COMMIT}\n`);
  }
  if (command[0] === 'status') return result();
  if (command[0] === 'ls-files') return result(`${SNAPSHOT_PATHS.join('\0')}\0`);
  if (
    (command[0] === 'remote' && command[1] === 'set-url')
    || command[0] === 'checkout'
    || command[0] === 'update-ref'
  ) return result();
  throw new Error(`Unexpected fake Git command: ${command.join(' ')}`);
}

function makeSpawn({ npmStatus = 0, admissionStatus = 0, createReadonlyEvidence = false } = {}) {
  const calls = [];
  const spawn = (file, args, options) => {
    calls.push({ file, args, options });
    if (file === GIT) {
      if (args.includes('clone')) {
        copySnapshot(args.at(-1));
        return result();
      }
      return sourceGitResult(args);
    }
    if (file === PINNED_NODE && args[0] === NPM_CLI) {
      return result('npm-clean-install\n', npmStatus ? 'npm-error\n' : '', npmStatus);
    }
    if (file === PINNED_NODE && args[0].endsWith('/mobile/scripts/admit-custodial-codemagic-build.mjs')) {
      if (createReadonlyEvidence) {
        const evidence = join(options.cwd, 'build', 'custodial-codemagic-admission', BUILD_ID);
        mkdirSync(evidence, { recursive: true, mode: 0o700 });
        writeFileSync(join(evidence, 'proof.json'), '{}\n', { mode: 0o400 });
        chmodSync(evidence, 0o500);
      }
      return result('admission-accepted\n', admissionStatus ? 'admission-error\n' : '', admissionStatus);
    }
    throw new Error(`Unexpected child: ${file} ${args.join(' ')}`);
  };
  return { calls, spawn };
}

const activeTestRoots = new Set();

function createTestPrivateTree() {
  const root = createCanonicalTemporaryDirectory('memphis-zoo-custodial-admission-bootstrap-test-');
  chmodSync(root, 0o700);
  const rootIdentity = lstatSync(root, { bigint: true });
  const directories = {};
  for (const [name, leaf] of [
    ['home', 'home'],
    ['xdgConfig', 'xdg-config'],
    ['xdgCache', 'xdg-cache'],
    ['npmCache', 'npm-cache'],
    ['temporary', 'tmp'],
  ]) {
    const path = join(root, leaf);
    mkdirSync(path, { mode: 0o700 });
    directories[name] = path;
  }
  activeTestRoots.add(root);
  return Object.freeze({ root, rootIdentity, checkout: join(root, 'checkout'), ...directories });
}

function removeTestPrivateTree(tree) {
  assert.equal(activeTestRoots.has(tree.root), true);
  const evidenceParent = join(tree.checkout, 'build', 'custodial-codemagic-admission');
  if (existsSync(evidenceParent)) {
    chmodSync(evidenceParent, 0o700);
    for (const name of readdirSync(evidenceParent)) {
      const path = join(evidenceParent, name);
      try { chmodSync(path, 0o700); } catch {}
    }
  }
  rmSync(tree.root, { recursive: true, force: false });
  activeTestRoots.delete(tree.root);
}

const testPrivateTreeHooks = Object.freeze({
  createPrivateTree: createTestPrivateTree,
  removePrivateTree: removeTestPrivateTree,
});

function bootstrapDirectories() {
  return [...activeTestRoots].sort();
}

function makeFixtureDirectoriesWritable(path) {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return;
  chmodSync(path, 0o700);
  for (const name of readdirSync(path)) makeFixtureDirectoriesWritable(join(path, name));
}

function createExportFixture({ missing, extra = false, symlink = false } = {}) {
  const root = createCanonicalTemporaryDirectory('memphis-zoo-custodial-export-test-');
  chmodSync(root, 0o700);
  const checkout = join(root, 'checkout');
  const exportRoot = join(root, 'export');
  const source = join(checkout, 'build', 'custodial-codemagic-admission', BUILD_ID);
  mkdirSync(source, { recursive: true, mode: 0o700 });
  mkdirSync(exportRoot, { mode: 0o700 });
  const files = new Map([
    ['app-release.apk', Buffer.from('signed-apk-fixture')],
    ['Engine_16_artifacts.zip', Buffer.from('provenance-bundle-fixture')],
    ['custodial-codemagic-admission.json', Buffer.from('{"accepted":true}\n')],
    ['custodial-linux-consumer-acceptance.json', Buffer.from('{"accepted":true}\n')],
  ]);
  if (missing) files.delete(missing);
  for (const [name, bytes] of files) {
    const path = join(source, name);
    if (symlink && name === 'app-release.apk') {
      const target = join(root, 'symlink-target.apk');
      writeFileSync(target, bytes, { mode: 0o400 });
      symlinkSync(target, path);
    } else {
      writeFileSync(path, bytes, { mode: 0o400 });
    }
  }
  if (extra) writeFileSync(join(source, 'unexpected.txt'), 'extra\n', { mode: 0o400 });
  chmodSync(source, 0o500);
  return Object.freeze({ root, checkout, exportRoot, source, files });
}

function removeExportFixture(fixture) {
  makeFixtureDirectoriesWritable(fixture.root);
  rmSync(fixture.root, { recursive: true, force: false });
}

assert.equal(
  parseCustodialCodemagicAdmissionBootstrapArguments(['--build-id', BUILD_ID]),
  BUILD_ID,
);
for (const args of [
  [],
  ['--build-id'],
  [BUILD_ID],
  ['--build-id', BUILD_ID, '--extra'],
  ['--build-id', BUILD_ID.toUpperCase()],
  ['--build-id', `${BUILD_ID}0`],
  ['--build', BUILD_ID],
]) assert.throws(
  () => parseCustodialCodemagicAdmissionBootstrapArguments(args),
  /Usage|24 lowercase hexadecimal/,
);

const bootstrapSource = readFileSync(fileURLToPath(new URL(
  './run-custodial-codemagic-admission.mjs',
  import.meta.url,
)), 'utf8');
assert.equal(bootstrapSource.startsWith(`#!${PRODUCTION_PINNED_NODE}\n`), true);
const staticImportSpecifiers = [...bootstrapSource.matchAll(/from\s+['"]([^'"]+)['"]/g)]
  .map((match) => match[1]);
assert.ok(staticImportSpecifiers.length >= 1);
assert.equal(staticImportSpecifiers.every((specifier) => specifier.startsWith('node:')), true);
assert.equal(bootstrapSource.includes('import(hostToolsModuleUrl)'), true);
assert.equal(bootstrapSource.includes("from 'ajv"), false);
const fileSha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(
  fileSha256(fileURLToPath(custodialCodemagicAdmissionBootstrapInternals.hostToolsModuleUrl)),
  custodialCodemagicAdmissionBootstrapInternals.expectedHostToolsModuleSha256,
);
assert.equal(
  fileSha256(fileURLToPath(new URL('../release-policies/custodial-linux-admission-host-tools.json', import.meta.url))),
  custodialCodemagicAdmissionBootstrapInternals.expectedHostToolsPolicySha256,
);
if (realpathSync(process.execPath) === PRODUCTION_PINNED_NODE) {
  const actualPinnedHost = await custodialCodemagicAdmissionBootstrapInternals
    .verifyPinnedCustodialAdmissionHostIdentity();
  assert.equal(
    actualPinnedHost.policy_sha256,
    custodialCodemagicAdmissionBootstrapInternals.expectedHostToolsPolicySha256,
  );
}

{
  const { calls, spawn } = makeSpawn({ createReadonlyEvidence: true });
  const stdout = captureStream();
  const stderr = captureStream();
  const beforeDirectories = bootstrapDirectories();
  const exports = [];
  const exitCode = await runCustodialCodemagicAdmissionBootstrap({
    ...testPrivateTreeHooks,
    args: ['--build-id', BUILD_ID],
    sourceEnvironment: {
      CODEMAGIC_API_TOKEN: TOKEN,
      HOME: '/attacker/home',
      NODE_OPTIONS: '--import=/attacker/module.mjs',
      NPM_TOKEN: 'must-not-propagate',
      JAVA_TOOL_OPTIONS: '-javaagent:/attacker.jar',
    },
    stdout,
    stderr,
    ...fakeHostDependencies(),
    spawn,
    fetchImpl: async () => fakeGithubResponse(),
    exportAdmission(checkoutRoot, buildId) {
      exports.push({ checkoutRoot, buildId });
    },
  });
  assert.equal(exitCode, 0);
  assert.equal(stdout.text(), 'npm-clean-install\nadmission-accepted\n');
  assert.equal(stderr.text(), '');
  assert.equal(exports.length, 1);
  assert.equal(exports[0].buildId, BUILD_ID);
  assert.equal(existsSync(exports[0].checkoutRoot), false);

  const npm = calls.find((call) => call.file === PINNED_NODE && call.args[0] === NPM_CLI);
  const admission = calls.find((call) => call.file === PINNED_NODE && call.args[0] !== NPM_CLI);
  assert.ok(npm);
  assert.ok(admission);
  assert.deepEqual(npm.args, [NPM_CLI, 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  assert.equal(npm.options.cwd.endsWith('/checkout'), true);
  assert.equal(admission.options.cwd, npm.options.cwd);
  assert.equal(admission.args[0], join(npm.options.cwd, 'mobile/scripts/admit-custodial-codemagic-build.mjs'));
  assert.equal(npm.options.timeout, custodialCodemagicAdmissionBootstrapInternals.npmTimeoutMs);
  assert.equal(admission.options.timeout, custodialCodemagicAdmissionBootstrapInternals.admissionTimeoutMs);
  assert.equal(npm.options.maxBuffer, custodialCodemagicAdmissionBootstrapInternals.childOutputLimitBytes);
  assert.equal(admission.options.maxBuffer, custodialCodemagicAdmissionBootstrapInternals.childOutputLimitBytes);
  assert.equal(npm.options.env.CODEMAGIC_API_TOKEN, undefined);
  assert.equal(npm.options.env[custodialCodemagicAdmissionBootstrapInternals.bootstrapMarkerName], undefined);
  assert.equal(admission.options.env.CODEMAGIC_API_TOKEN, TOKEN);
  assert.equal(
    admission.options.env[custodialCodemagicAdmissionBootstrapInternals.bootstrapMarkerName],
    HOST_POLICY_SHA256,
  );
  for (const call of calls) {
    assert.equal(call.options.shell, false);
    assert.equal(call.options.env.NODE_OPTIONS, undefined);
    assert.equal(call.options.env.NPM_TOKEN, undefined);
    assert.equal(call.options.env.JAVA_TOOL_OPTIONS, undefined);
    if (call.file === GIT || call === npm) assert.equal(call.options.env.CODEMAGIC_API_TOKEN, undefined);
  }
  assert.equal(npm.options.env.HOME.startsWith(npm.options.cwd.slice(0, -'/checkout'.length)), true);
  assert.equal(npm.options.env.NPM_CONFIG_CACHE.startsWith(npm.options.env.HOME.slice(0, -'/home'.length)), true);
  assert.equal(npm.options.env.NPM_CONFIG_IGNORE_SCRIPTS, 'true');
  assert.equal(npm.options.env.JAVA_HOME, JAVA_HOME);
  assert.equal(npm.options.env.ANDROID_SDK_ROOT, SDK_ROOT);
  assert.equal(existsSync(npm.options.env.HOME), false);
  assert.ok(calls.findIndex((call) => call.args?.includes('clone')) < calls.indexOf(npm));
  assert.ok(calls.indexOf(npm) < calls.indexOf(admission));
  assert.deepEqual(bootstrapDirectories(), beforeDirectories);
}

{
  const { calls, spawn } = makeSpawn({ npmStatus: 17 });
  const stdout = captureStream();
  const stderr = captureStream();
  let exported = false;
  const exitCode = await runCustodialCodemagicAdmissionBootstrap({
    ...testPrivateTreeHooks,
    args: ['--build-id', BUILD_ID],
    sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
    stdout,
    stderr,
    ...fakeHostDependencies(),
    spawn,
    fetchImpl: async () => fakeGithubResponse(),
    exportAdmission() { exported = true; },
  });
  assert.equal(exitCode, 17);
  assert.equal(stdout.text(), 'npm-clean-install\n');
  assert.equal(stderr.text(), 'npm-error\n');
  assert.equal(calls.some((call) => call.file === PINNED_NODE && call.args[0].endsWith('admit-custodial-codemagic-build.mjs')), false);
  assert.equal(exported, false);
}

{
  const { calls, spawn } = makeSpawn({ admissionStatus: 23 });
  const beforeDirectories = bootstrapDirectories();
  let exported = false;
  const stdout = captureStream();
  const stderr = captureStream();
  const exitCode = await runCustodialCodemagicAdmissionBootstrap({
    ...testPrivateTreeHooks,
    args: ['--build-id', BUILD_ID],
    sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
    stdout,
    stderr,
    ...fakeHostDependencies(),
    spawn,
    fetchImpl: async () => fakeGithubResponse(),
    exportAdmission() { exported = true; },
  });
  assert.equal(exitCode, 23);
  assert.equal(calls.some((call) => call.file === PINNED_NODE && call.args[0] === NPM_CLI), true);
  assert.equal(stdout.text(), 'npm-clean-install\nadmission-accepted\n');
  assert.equal(stderr.text(), 'admission-error\n');
  assert.equal(exported, false);
  assert.deepEqual(bootstrapDirectories(), beforeDirectories);
}

{
  let hostLoaded = false;
  await assert.rejects(
    runCustodialCodemagicAdmissionBootstrap({
      ...testPrivateTreeHooks,
      args: ['--build-id', 'not-a-build-id'],
      sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
      loadHostTools: async () => {
        hostLoaded = true;
        return fakeHostTools();
      },
    }),
    /24 lowercase hexadecimal/,
  );
  assert.equal(hostLoaded, false);
}

{
  const beforeDirectories = bootstrapDirectories();
  let spawnCalled = false;
  await assert.rejects(
    runCustodialCodemagicAdmissionBootstrap({
      ...testPrivateTreeHooks,
      args: ['--build-id', BUILD_ID],
      sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
      ...(() => {
        const hostTools = fakeHostTools();
        return {
          expectedVerifiedHostIdentity: hostTools.expectedVerifiedHostIdentity,
          loadHostTools: async () => ({
            ...hostTools,
            async verifyCustodialLinuxAdmissionHostTools() {
              throw new Error('injected host verification failure');
            },
          }),
        };
      })(),
      spawn() {
        spawnCalled = true;
        return result();
      },
    }),
    /injected host verification failure/,
  );
  assert.equal(spawnCalled, false);
  assert.deepEqual(bootstrapDirectories(), beforeDirectories);
}

{
  const { calls, spawn: baseSpawn } = makeSpawn();
  let npmCalled = false;
  const spawn = (file, args, options) => {
    if (file === PINNED_NODE && args[0] === NPM_CLI) npmCalled = true;
    if (file === GIT && args.includes('status')) return result(' M package-lock.json\n');
    return baseSpawn(file, args, options);
  };
  await assert.rejects(
    runCustodialCodemagicAdmissionBootstrap({
      ...testPrivateTreeHooks,
      args: ['--build-id', BUILD_ID],
      sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
      ...fakeHostDependencies(),
      spawn,
      fetchImpl: async () => fakeGithubResponse(),
    }),
    /completely clean source checkout/,
  );
  assert.equal(npmCalled, false);
  assert.equal(calls.some((call) => call.args?.includes('clone')), false);
}

{
  const hostTools = fakeHostTools();
  const altered = {
    ...hostTools.expectedVerifiedHostIdentity,
    proof: {
      ...hostTools.expectedVerifiedHostIdentity.proof,
      policy_sha256: 'e'.repeat(64),
    },
  };
  let spawnCalled = false;
  await assert.rejects(
    runCustodialCodemagicAdmissionBootstrap({
      ...testPrivateTreeHooks,
      args: ['--build-id', BUILD_ID],
      sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
      expectedVerifiedHostIdentity: hostTools.expectedVerifiedHostIdentity,
      loadHostTools: async () => ({
        ...hostTools,
        async verifyCustodialLinuxAdmissionHostTools() { return altered; },
      }),
      spawn() {
        spawnCalled = true;
        return result();
      },
    }),
    /differs from the pinned bootstrap identity/,
  );
  assert.equal(spawnCalled, false);
}

{
  const fixture = createExportFixture();
  try {
    const sourceDigests = new Map(
      [...fixture.files].map(([name]) => [name, fileSha256(join(fixture.source, name))]),
    );
    custodialCodemagicAdmissionBootstrapInternals.exportAcceptedAdmission(
      fixture.checkout,
      BUILD_ID,
      { exportRoot: fixture.exportRoot },
    );
    const output = join(
      fixture.exportRoot,
      'build',
      'custodial-codemagic-admission',
      BUILD_ID,
    );
    assert.deepEqual(readdirSync(output).sort(), [...fixture.files.keys()].sort());
    assert.equal(lstatSync(output).mode & 0o777, 0o500);
    for (const [name, digest] of sourceDigests) {
      const path = join(output, name);
      assert.equal(lstatSync(path).mode & 0o777, 0o400);
      assert.equal(fileSha256(path), digest);
    }
  } finally {
    removeExportFixture(fixture);
  }
}

for (const [label, fixtureOptions, pattern] of [
  ['missing', { missing: 'Engine_16_artifacts.zip' }, /file graph is malformed/],
  ['extra', { extra: true }, /file graph is malformed/],
  ['symlink', { symlink: true }, /evidence file is unsafe/],
]) {
  const fixture = createExportFixture(fixtureOptions);
  try {
    assert.throws(
      () => custodialCodemagicAdmissionBootstrapInternals.exportAcceptedAdmission(
        fixture.checkout,
        BUILD_ID,
        { exportRoot: fixture.exportRoot },
      ),
      pattern,
      label,
    );
    assert.equal(
      existsSync(join(fixture.exportRoot, 'build', 'custodial-codemagic-admission', BUILD_ID)),
      false,
    );
  } finally {
    removeExportFixture(fixture);
  }
}

{
  const fixture = createExportFixture();
  const movedSource = `${fixture.source}.original`;
  try {
    assert.throws(
      () => custodialCodemagicAdmissionBootstrapInternals.exportAcceptedAdmission(
        fixture.checkout,
        BUILD_ID,
        {
          exportRoot: fixture.exportRoot,
          beforeCommit({ source }) {
            renameSync(source, movedSource);
            mkdirSync(source, { mode: 0o700 });
          },
        },
      ),
      /evidence source changed during export/,
    );
    assert.equal(
      existsSync(join(fixture.exportRoot, 'build', 'custodial-codemagic-admission', BUILD_ID)),
      false,
    );
  } finally {
    removeExportFixture(fixture);
  }
}

{
  const aliasFixtureRoot = createCanonicalTemporaryDirectory(
    'memphis-zoo-custodial-temporary-alias-test-',
  );
  const realTemporaryParent = join(aliasFixtureRoot, 'real');
  const aliasedTemporaryParent = join(aliasFixtureRoot, 'alias');
  mkdirSync(realTemporaryParent, { mode: 0o700 });
  symlinkSync(realTemporaryParent, aliasedTemporaryParent, 'dir');
  const previousTemporaryParent = process.env.TMPDIR;
  let privateTree;
  let exportFixture;
  try {
    process.env.TMPDIR = aliasedTemporaryParent;
    privateTree = createTestPrivateTree();
    exportFixture = createExportFixture();
    for (const root of [privateTree.root, exportFixture.root]) {
      assert.equal(realpathSync(root), root);
      assert.equal(dirname(root), realTemporaryParent);
    }
  } finally {
    if (privateTree) removeTestPrivateTree(privateTree);
    if (exportFixture) removeExportFixture(exportFixture);
    if (previousTemporaryParent == null) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTemporaryParent;
    rmSync(aliasFixtureRoot, { recursive: true, force: false });
  }
}

{
  const tree = createTestPrivateTree();
  const admissionParent = join(tree.checkout, 'build', 'custodial-codemagic-admission');
  const evidence = join(admissionParent, BUILD_ID);
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  writeFileSync(join(evidence, 'proof.json'), '{}\n', { mode: 0o400 });
  chmodSync(evidence, 0o500);
  custodialCodemagicAdmissionBootstrapInternals.removePrivateBootstrapTreeAt(
    tree,
    realpathSync(tmpdir()),
    'memphis-zoo-custodial-admission-bootstrap-test-',
  );
  activeTestRoots.delete(tree.root);
  assert.equal(existsSync(tree.root), false);
}

assert.equal(realpathSync(process.execPath), PINNED_NODE);
assert.equal(
  custodialCodemagicAdmissionBootstrapInternals.repositoryRoot,
  resolve(fileURLToPath(new URL('../..', import.meta.url))),
);

process.stdout.write('Custodial Codemagic admission bootstrap tests passed.\n');
