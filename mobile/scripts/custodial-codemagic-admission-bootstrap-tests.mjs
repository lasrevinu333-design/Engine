#!/home/eric/.cache/codex-toolchains/node-v22.23.4/bin/node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  custodialCodemagicAdmissionForwardArguments,
  runCustodialCodemagicAdmissionBootstrap,
} from './run-custodial-codemagic-admission.mjs';

const BUILD_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const COMMIT = '68bf6d7d9863376ad41b27ec4eb99071d48b6864';
const HOST_POLICY_SHA256 = 'b'.repeat(64);
const TOKEN = 'test-token-never-print-0123456789';
const PRODUCTION_PINNED_NODE = '/home/eric/.cache/codex-toolchains/node-v22.23.4/bin/node';
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
  'mobile/release-policies/custodial-codemagic-forward-recovery.json',
  'mobile/release-policies/custodial-codemagic.json',
  'mobile/release-policies/custodial-linux-admission-host-tools.json',
  'mobile/scripts/admit-custodial-codemagic-build.mjs',
  'mobile/scripts/custodial-codemagic-admission.schema.json',
  'mobile/scripts/custodial-linux-admission-host-tools.mjs',
  'mobile/scripts/run-custodial-codemagic-admission.mjs',
  'mobile/scripts/verify-custodial-android-release.mjs',
  'scripts/lib/runtime-sanitation-policy.mjs',
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

if (process.argv.includes('--ci-forward-provider-inputs-source-only') || process.argv.includes('--ci-forward-provider-inputs-dispatch-only')) {
  const sourceOnly = process.argv.includes('--ci-forward-provider-inputs-source-only');
  const yaml = readFileSync(join(SDK_ROOT, 'codemagic.yaml'), 'utf8');
  const definition = name => yaml.match(new RegExp('^    ' + name + ': &' + name + '\\n([\\s\\S]*?)(?=^    [a-z_]+: &|^workflows:)', 'm'))[1]
    .split('      script: |\n')[1].split('\n').map(line => line.startsWith('        ') ? line.slice(8) : line).join('\n');
  const scripts = ['protected_main', 'add_android', 'native_provenance'].map(definition);
  const collectors = scripts.map(script => script.match(/# BEGIN custodial_forward_arguments\n([\s\S]*?)# END custodial_forward_arguments/)[1]);
  assert.equal(collectors[0], collectors[1]); assert.equal(collectors[0], collectors[2]);
  const inputs = '    inputs:\n      custodial_forward_review_pins_sha256:\n        description: Independently reviewed forward recipe SHA256; empty retains legacy\n        type: string\n        default: \'\'\n      custodial_forward_review_role:\n        description: Reviewed forward role candidate or recovery; empty retains legacy\n        type: string\n        default: \'\'\n';
  assert.equal(yaml.split(inputs).length, 2, 'exact declared pair occurs once');
  const mappings = '        # Official workflow inputs, not inferred environment echoes or approval.\n        MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256: ${{ inputs.custodial_forward_review_pins_sha256 }}\n        MZ_CUSTODIAL_FORWARD_ROLE: ${{ inputs.custodial_forward_review_role }}\n';
  assert.equal(yaml.split(mappings).length, 2);
  const workflows = yaml.slice(yaml.indexOf('\nworkflows:\n'));
  assert.equal((workflows.match(/^    inputs:/gm) || []).length, 1);
  assert.doesNotMatch(yaml.slice(0, yaml.indexOf('\nworkflows:\n')), /\$\{\{ inputs\./, 'untrusted values are environment inputs, never interpolated shell script');
  const custodialBlock = workflows.match(/^  custodial-android:\n[\s\S]*?(?=^  [a-z][a-z-]+:\n|(?![\s\S]))/m)[0];
  assert(custodialBlock.includes(inputs) && custodialBlock.includes(mappings));
  assert.equal(createHash('sha256').update(custodialBlock.replace(inputs, '').replace(mappings, '')).digest('hex'), '3d1980ccf5ab25f461e2aae1cd2e833e3d54349c1189f55c690e48f009ea16dd', 'all prior Custodial defaults/signing/publishing preserved');
  const unaffected = { 'manager-ios': 'd5fbc826007d54771480118f90404acf37a76272e536c180b807a47766eba165', 'viewer-ios': 'fddd7701ded47417d9b47119fda157ffa329ba598a27e8d13412adcc18ccf273', 'manager-android': '1d2684673ea3b623e08548c154f3d4411bbb638f59b5ca2bba4f8d7e591d7f6a', 'viewer-android': '343cc454f02d88f44145e0fed0c6af0fa964effec86722457c70f4af242147b1' };
  for (const [name, hash] of Object.entries(unaffected)) assert.equal(createHash('sha256').update(workflows.match(new RegExp('^  ' + name + ':\\n[\\s\\S]*?(?=^  [a-z][a-z-]+:\\n|(?![\\s\\S]))', 'm'))[0]).digest('hex'), hash);
  for (const collector of collectors) {
    assert.match(collector, /Absent\/both-empty DECLARED inputs are legacy/);
    assert.match(collector, /Forward file paths require nonempty declared review inputs/);
    assert.match(collector, /test "\$custodial_forward_count" -eq 4/);
    assert.match(collector, /test "\$custodial_forward_pair_count" -eq 0 \|\| test "\$custodial_forward_pair_count" -eq 2/);
    assert.match(collector, /\^\[a-f0-9\]\{64\}\$/);
    assert.match(collector, /MZ_CUSTODIAL_FORWARD_ROLE" = candidate \|\|/);
    assert.doesNotMatch(collector, /\beval\b|forward_review_context|CM_ENV/);
  }
  const optional = '${custodial_forward_args[@]+"${custodial_forward_args[@]}"}';
  const configure = scripts[1].split('\n').find(line => line.startsWith('node scripts/configure-native-release.mjs android'));
  const start = scripts[2].indexOf('  node mobile/scripts/verify-custodial-android-release.mjs');
  const verifier = scripts[2].slice(start, scripts[2].indexOf('else\n', start)).trim();
  assert(configure.endsWith(optional) && verifier.endsWith(optional));
  assert.match(scripts[0], /loadReviewedForwardBuild\(flags, \{ buildNumber: build.numeric \}\)/);
  if (!sourceOnly) {
    // Main's permitted environment may run ONLY these new pair/default cases.
    // Task7 must not retry the already-denied Bash route to qualify them.
    const run = (collector, call, variables) => {
      const result = spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', 'set -euo pipefail\n' + collector + '\nnode() { printf \'%s\\0\' "$@"; }\ncustodial_apk=synthetic.apk\n' + call], { cwd: SDK_ROOT, env: { PATH: '/usr/bin:/bin', MZ_APP_EDITION: 'custodial', PROJECT_BUILD_NUMBER: '53', CM_BRANCH: 'main', CM_COMMIT: 'c'.repeat(40), CM_BUILD_ID: BUILD_ID, ANDROID_SDK_ROOT: '/synthetic-sdk', ...variables }, timeout: 2000, maxBuffer: 1024 * 1024 });
      if (result.error) throw result.error;
      return { status: result.status, values: result.stdout.toString().split('\0').filter(Boolean) };
    };
    const empty = { MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256: '', MZ_CUSTODIAL_FORWARD_ROLE: '' };
    const complete = { MZ_CUSTODIAL_FORWARD_SOURCE_INPUT: '/synthetic/input.json', MZ_CUSTODIAL_FORWARD_TRUSTED_PINS: '/synthetic/pins.json', MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256: 'a'.repeat(64), MZ_CUSTODIAL_FORWARD_ROLE: 'candidate' };
    for (const collector of collectors) {
      const legacy = run(collector, 'node legacy', empty); assert.equal(legacy.status, 0); assert.deepEqual(legacy.values, ['legacy']);
      for (const bad of [{ MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256: '' }, { MZ_CUSTODIAL_FORWARD_ROLE: '' }, { ...empty, MZ_CUSTODIAL_FORWARD_SOURCE_INPUT: '/synthetic/input.json' }, { ...empty, MZ_CUSTODIAL_FORWARD_TRUSTED_PINS: '' }, { ...complete, MZ_CUSTODIAL_FORWARD_ROLE: '' }, { ...complete, MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256: '' }, { ...complete, MZ_CUSTODIAL_FORWARD_ROLE: 'unknown' }, { ...complete, MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256: 'invalid' }]) {
        const result = run(collector, 'node must-not-run', bad); assert.notEqual(result.status, 0); assert.deepEqual(result.values, []);
      }
    }
    for (const role of ['candidate', 'recovery']) {
      const variables = { ...complete, MZ_CUSTODIAL_FORWARD_ROLE: role };
      const flags = ['--forward-source-input', variables.MZ_CUSTODIAL_FORWARD_SOURCE_INPUT, '--forward-trusted-pins', variables.MZ_CUSTODIAL_FORWARD_TRUSTED_PINS, '--forward-trusted-pins-sha256', variables.MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256, '--forward-role', role];
      assert.deepEqual(run(collectors[1], configure, variables).values.slice(-8), flags);
      assert.deepEqual(run(collectors[2], verifier, variables).values.slice(-8), flags);
    }
  }
  process.stdout.write(sourceOnly ? 'NEW_DECLARED_INPUTS_SOURCE_ONLY: approved YAML inputs/defaults/context mapping, identical collectors and producer tails, closed empty/partial barriers in source, preserved workflow/signing/default bytes passed. Bash behavior remains UNEXECUTED after prior EPERM; no CI/API/build effects.\n' : 'NEW_DECLARED_INPUTS_SYNTHETIC_DISPATCH: actual YAML collectors reject incomplete declared pair and preserve empty defaults; both producer calls forward matched role/digest. No real CI/API/Git/build/artifact admission.\n');
} else if (process.argv.includes('--ci-forward-workflow-only') || process.argv.includes('--ci-forward-workflow-source-only')) {
  const sourceOnly = process.argv.includes('--ci-forward-workflow-source-only');
  // Source-only invocation tests. We never run full CI scripts, signing/native
  // commands, real Git, or the previously qualified positive loader cases.
  const yaml = readFileSync(join(SDK_ROOT, 'codemagic.yaml'), 'utf8');
  const definition = (name) => {
    const match = yaml.match(new RegExp('^    ' + name + ': &' + name + '\\n([\\s\\S]*?)(?=^    [a-z_]+: &|^workflows:)', 'm'));
    assert.ok(match, 'actual YAML definition: ' + name);
    return match[1].split('      script: |\n')[1].split('\n').map(line => line.startsWith('        ') ? line.slice(8) : line).join('\n');
  };
  const scripts = ['protected_main', 'add_android', 'native_provenance'].map(definition);
  const helper = source => {
    const match = source.match(/# BEGIN custodial_forward_arguments\n([\s\S]*?)# END custodial_forward_arguments/);
    assert.ok(match, 'actual producer must collect the reviewed inputs');
    return match[1];
  };
  const helpers = scripts.map(helper);
  assert.equal(helpers[0], helpers[1]); assert.equal(helpers[0], helpers[2]);
  const configureCall = scripts[1].split('\n').find(line => line.startsWith('node scripts/configure-native-release.mjs android'));
  assert.ok(configureCall);
  const verifierStart = scripts[2].indexOf('  node mobile/scripts/verify-custodial-android-release.mjs');
  const verifierEnd = scripts[2].indexOf('else\n', verifierStart);
  assert.ok(verifierStart >= 0 && verifierEnd > verifierStart);
  const verifierCall = scripts[2].slice(verifierStart, verifierEnd).trim();
  const vars = ['MZ_CUSTODIAL_FORWARD_SOURCE_INPUT', 'MZ_CUSTODIAL_FORWARD_TRUSTED_PINS', 'MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256', 'MZ_CUSTODIAL_FORWARD_ROLE'];
  const forward = Object.fromEntries(vars.map((name, i) => [name, ['/synthetic reviewed/source-input.json', '/synthetic reviewed/owner-pins.json', 'a'.repeat(64), 'candidate'][i]]));
  const expectedFlags = ['--forward-source-input', forward[vars[0]], '--forward-trusted-pins', forward[vars[1]], '--forward-trusted-pins-sha256', forward[vars[2]], '--forward-role', 'candidate'];
  const env = {
    PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', MZ_APP_EDITION: 'custodial',
    PROJECT_BUILD_NUMBER: '53', CM_BRANCH: 'reviewed/synthetic-source', CM_COMMIT: 'c'.repeat(40),
    CM_BUILD_ID: BUILD_ID, ANDROID_SDK_ROOT: '/synthetic-sdk',
  };
  const optionalArrayExpansion = '${custodial_forward_args[@]+"${custodial_forward_args[@]}"}';
  assert.ok(configureCall.endsWith(optionalArrayExpansion));
  assert.ok(verifierCall.endsWith(optionalArrayExpansion));
  for (const name of vars) for (const collector of helpers) assert.ok(collector.includes(name));
  for (const collector of helpers) {
    assert.match(collector, /custodial_forward_count" -eq 4/);
    assert.match(collector, /MZ_APP_EDITION:-\}" = custodial/);
    assert.match(collector, /\^\[a-f0-9\]\{64\}\$/);
    assert.match(collector, /readonly -a custodial_forward_args/);
    assert.doesNotMatch(collector, /\beval\b|CM_ENV|forward_review_context/);
  }
  if (!sourceOnly) {
  const dispatch = (collector, call, additions = {}) => {
    const result = spawnSync('/bin/bash', ['--noprofile', '--norc', '-c',
      'set -euo pipefail\n' + collector +
      '\nnode() { printf \'%s\\0\' "$@"; }\ncustodial_apk=synthetic.apk\n' + call],
    {cwd: SDK_ROOT, env: {...env, ...additions}, timeout: 2000, maxBuffer: 2 * 1024 * 1024});
    if (result.error) throw result.error;
    const values = result.stdout.toString('utf8').split('\0'); if (!values.at(-1)) values.pop();
    return {status: result.status, values, stderr: result.stderr.toString('utf8')};
  };
  // Reproduce the frozen before-call's missing transport, not a release proof.
  assert.deepEqual(dispatch('', 'node scripts/configure-native-release.mjs android', forward).values, ['scripts/configure-native-release.mjs', 'android']);
  for (const role of ['candidate', 'recovery']) {
    const input = {...forward, MZ_CUSTODIAL_FORWARD_ROLE: role};
    const expected = [...expectedFlags.slice(0, -1), role];
    assert.deepEqual(dispatch(helpers[1], configureCall, input).values, ['scripts/configure-native-release.mjs', 'android', ...expected]);
    const compiled = dispatch(helpers[2], verifierCall, input);
    assert.equal(compiled.status, 0);
    assert.deepEqual(compiled.values.slice(-8), expected);
    assert.equal(compiled.values[compiled.values.indexOf('--source-ref') + 1], 'refs/heads/' + env.CM_BRANCH);
    for (const name of ['--apk', '--build-number', '--source-commit', '--build-run', '--build-workflow', '--build-tools-directory', '--runtime-directory', '--output']) assert.ok(compiled.values.includes(name), 'normal immutable artifact argument retained: ' + name);
  }
  for (const edition of ['custodial', 'manager', 'viewer']) {
    assert.deepEqual(dispatch(helpers[1], configureCall, {MZ_APP_EDITION: edition}).values, ['scripts/configure-native-release.mjs', 'android']);
  }
  const legacyArtifact = dispatch(helpers[2], verifierCall);
  assert.equal(legacyArtifact.values[legacyArtifact.values.indexOf('--source-ref') + 1], env.CM_BRANCH);
  assert.equal(legacyArtifact.values.includes('--forward-role'), false);
  const invalid = [
    ...vars.map(name => Object.fromEntries(Object.entries(forward).filter(([key]) => key !== name))),
    ...vars.map(name => ({...forward, [name]: ''})),
    {...forward, MZ_CUSTODIAL_FORWARD_ROLE: 'candidate;exit 0'},
    {...forward, MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256: 'INVALID'},
    {...forward, MZ_CUSTODIAL_FORWARD_SOURCE_INPUT: 'relative.json'},
    {...forward, MZ_CUSTODIAL_FORWARD_TRUSTED_PINS: forward.MZ_CUSTODIAL_FORWARD_SOURCE_INPUT},
    {...forward, MZ_APP_EDITION: 'manager'},
    {...forward, MZ_APP_EDITION: 'viewer'},
  ];
  for (const inputs of invalid) for (const collector of helpers) {
    const refused = dispatch(collector, 'node normal-producer-must-not-run', inputs);
    assert.notEqual(refused.status, 0); assert.deepEqual(refused.values, []);
  }
  }
  // Execute only actual preflight JavaScript and missing/unreviewed-byte
  // negatives which fail BEFORE its Git loader observation. No mock Git/ref.
  const preflight = scripts[0].match(/<<'NODE'\n([\s\S]*?)\nNODE\n/)[1];
  assert.match(preflight, /await loadReviewedForwardBuild\(flags/);
  assert.match(preflight, /assertReviewedForwardBuild\(context/);
  assert.match(preflight, /sourceCommit: process.env.CM_COMMIT/);
  assert.match(preflight, /sourceRef: 'refs\/heads\/' \+ process.env.CM_BRANCH/);
  assert.doesNotMatch(scripts[0], /git (?:checkout|reset|symbolic-ref)/);
  if (!sourceOnly) {
  const missing = spawnSync(process.execPath, ['--input-type=module', '-', ...expectedFlags], {
    cwd: SDK_ROOT, env, input: preflight, timeout: 2000, maxBuffer: 2 * 1024 * 1024,
  });
  if (missing.error) throw missing.error;
  assert.notEqual(missing.status, 0); assert.match(missing.stderr.toString(), /existing regular non-symlink file/);
  } else {
    const {loadReviewedForwardBuild, parseForwardBuildArguments} = await import('./configure-native-release.mjs');
    await assert.rejects(() => loadReviewedForwardBuild(parseForwardBuildArguments(expectedFlags), {buildNumber: 53}), /existing regular non-symlink file/);
  }
  const directory = createCanonicalTemporaryDirectory('custodial-ci-review-negative-');
  try {
    const pinsPath = join(directory, 'pins.json'); const inputPath = join(directory, 'input.json');
    writeFileSync(pinsPath, '{"SYNTHETIC_UNREVIEWED":true}'); writeFileSync(inputPath, '{}');
    if (sourceOnly) {
      const {loadReviewedForwardBuild, parseForwardBuildArguments} = await import('./configure-native-release.mjs');
      const flags = parseForwardBuildArguments(['--forward-source-input', inputPath, '--forward-trusted-pins', pinsPath, '--forward-trusted-pins-sha256', 'a'.repeat(64), '--forward-role', 'candidate']);
      await assert.rejects(() => loadReviewedForwardBuild(flags, {buildNumber: 53}), /independent reviewed pin/);
    } else {
    const refused = spawnSync(process.execPath, ['--input-type=module', '-', '--forward-source-input', inputPath, '--forward-trusted-pins', pinsPath, '--forward-trusted-pins-sha256', 'a'.repeat(64), '--forward-role', 'candidate'], {
      cwd: SDK_ROOT, env, input: preflight, timeout: 2000, maxBuffer: 2 * 1024 * 1024,
    });
    if (refused.error) throw refused.error;
    assert.notEqual(refused.status, 0); assert.match(refused.stderr.toString(), /independent reviewed pin/);
    }
  } finally { rmSync(directory, {recursive: true, force: false}); }
  // Frozen workflow blocks, defaults, store publishing and signed identities
  // are not replaced. Only shared producer script bodies changed.
  const expectedWorkflowHashes = {"manager-ios":"d5fbc826007d54771480118f90404acf37a76272e536c180b807a47766eba165","viewer-ios":"fddd7701ded47417d9b47119fda157ffa329ba598a27e8d13412adcc18ccf273","manager-android":"1d2684673ea3b623e08548c154f3d4411bbb638f59b5ca2bba4f8d7e591d7f6a","custodial-android":"3d1980ccf5ab25f461e2aae1cd2e833e3d54349c1189f55c690e48f009ea16dd","viewer-android":"343cc454f02d88f44145e0fed0c6af0fa964effec86722457c70f4af242147b1"};
  for (const [name, expected] of Object.entries(expectedWorkflowHashes)) {
    let block = yaml.match(new RegExp('^  ' + name + ':\\n[\\s\\S]*?(?=^  [a-z][a-z-]+:\\n|(?![\\s\\S]))', 'm'))[0];
    if (name === 'custodial-android') block = block.replace(/    inputs:\n[\s\S]*?(?=    max_build_duration:)/, '').replace(/        # Official workflow inputs[^\n]*\n        MZ_CUSTODIAL_FORWARD_TRUSTED_PINS_SHA256:[^\n]*\n        MZ_CUSTODIAL_FORWARD_ROLE:[^\n]*\n/, '');
    assert.equal(createHash('sha256').update(block).digest('hex'), expected, name + ' unchanged workflow/defaults');
  }
  assert.doesNotMatch(yaml, /forward_review_context|CM_ENV/);
  assert.match(scripts[0], /git fetch --no-tags --depth=1 origin/);
  assert.match(scripts[0], /refs\/remotes\/origin\/\$CM_BRANCH/);
  process.stdout.write(sourceOnly
    ? 'SOURCE_ONLY: YAML flag/preflight composition, unchanged workflow/default hashes, and in-process missing/unreviewed loader negatives passed; subprocess invocation checks HELD after EPERM, no Git/CI/API/build/sign/artifact admission.\n'
    : 'SYNTHETIC_SOURCE_ONLY: actual YAML producer argv, both roles, preflight missing/unreviewed refusal, partial/malformed input barriers, and unchanged edition/default workflows passed; no real Git/CI/API/build/sign/artifact admission.\n');
} else if (process.argv.includes('--forward-command-only')) {
  const flags = ['--forward-source-input', '/synthetic/source.json', '--forward-trusted-pins', '/synthetic/pins.json', '--forward-trusted-pins-sha256', 'a'.repeat(64), '--forward-role', 'candidate'];
  assert.equal(parseCustodialCodemagicAdmissionBootstrapArguments(['--build-id', BUILD_ID, ...flags]), BUILD_ID);
  assert.deepEqual(custodialCodemagicAdmissionForwardArguments(flags), flags);
  for (const extra of [flags.slice(0, -2), [...flags, '--forward-role', 'candidate'], [...flags.slice(0, -1), 'invalid'], ['--forward-source-input', 'relative.json', ...flags.slice(2)]]) assert.throws(() => custodialCodemagicAdmissionForwardArguments(extra), /Usage|canonical/);
  const { calls, spawn } = makeSpawn();
  const stdout = captureStream(); const stderr = captureStream();
  const before = bootstrapDirectories();
  const exitCode = await runCustodialCodemagicAdmissionBootstrap({
    ...testPrivateTreeHooks,
    args: ['--build-id', BUILD_ID, ...flags],
    sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
    stdout, stderr, ...fakeHostDependencies(), spawn,
    fetchImpl: async () => fakeGithubResponse(),
    exportAdmission() {},
  });
  assert.equal(exitCode, 0);
  const child = calls.find((call) => call.file === PINNED_NODE && call.args[0] !== NPM_CLI);
  assert.deepEqual(child.args.slice(1), ['--build-id', BUILD_ID, ...flags]);
  assert.deepEqual(bootstrapDirectories(), before);
  assert.equal(activeTestRoots.size, 0);
  process.stdout.write('SYNTHETIC_SOURCE_ONLY: forward bootstrap grammar and actual child-dispatch arguments passed; no real Git/network/artifact admission executed.\n');
} else {
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
const atomicHostGuardOffset = bootstrapSource.indexOf('    assertAtomicAdmissionExportHost();');
const atomicSealOffset = bootstrapSource.indexOf('chmodSync(staging, 0o500);');
const atomicRenameOffset = bootstrapSource.indexOf('renameSync(staging, finalDirectory);');
assert.ok(atomicHostGuardOffset >= 0);
assert.ok(atomicHostGuardOffset < atomicSealOffset);
assert.ok(atomicSealOffset < atomicRenameOffset);
assert.equal(bootstrapSource.includes('atomicExportHost'), false);
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
assert.equal(
  custodialCodemagicAdmissionBootstrapInternals.assertAtomicAdmissionExportHost('linux', 'x64'),
  true,
);
for (const [platform, architecture] of [
  ['darwin', 'arm64'],
  ['darwin', 'x64'],
  ['linux', 'arm64'],
]) {
  assert.throws(
    () => custodialCodemagicAdmissionBootstrapInternals
      .assertAtomicAdmissionExportHost(platform, architecture),
    new RegExp(`requires linux/x64, received ${platform}/${architecture}`),
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
    const sourceIdentity = lstatSync(fixture.source, { bigint: true });
    const sourceDigests = new Map(
      [...fixture.files].map(([name]) => [name, fileSha256(join(fixture.source, name))]),
    );
    const output = join(
      fixture.exportRoot,
      'build',
      'custodial-codemagic-admission',
      BUILD_ID,
    );
    if (process.platform === 'linux' && process.arch === 'x64') {
      custodialCodemagicAdmissionBootstrapInternals.exportAcceptedAdmission(
        fixture.checkout,
        BUILD_ID,
        { exportRoot: fixture.exportRoot },
      );
      assert.deepEqual(readdirSync(output).sort(), [...fixture.files.keys()].sort());
      assert.equal(lstatSync(output).mode & 0o777, 0o500);
      for (const [name, digest] of sourceDigests) {
        const path = join(output, name);
        assert.equal(lstatSync(path).mode & 0o777, 0o400);
        assert.equal(fileSha256(path), digest);
      }
    } else {
      assert.throws(
        () => custodialCodemagicAdmissionBootstrapInternals.exportAcceptedAdmission(
          fixture.checkout,
          BUILD_ID,
          { exportRoot: fixture.exportRoot },
        ),
        new RegExp(`requires linux/x64, received ${process.platform}/${process.arch}`),
      );
      assert.equal(existsSync(output), false);
      const exportParent = dirname(output);
      assert.deepEqual(
        readdirSync(exportParent).filter((name) => name.startsWith('.bootstrap-export-')),
        [],
      );
      for (const [name, digest] of sourceDigests) {
        assert.equal(fileSha256(join(fixture.source, name)), digest);
      }
    }
    const sourceAfter = lstatSync(fixture.source, { bigint: true });
    assert.equal(sourceAfter.dev, sourceIdentity.dev);
    assert.equal(sourceAfter.ino, sourceIdentity.ino);
    assert.equal(sourceAfter.uid, sourceIdentity.uid);
  } finally {
    removeExportFixture(fixture);
  }
}

{
  const fixture = createExportFixture();
  const output = join(
    fixture.exportRoot,
    'build',
    'custodial-codemagic-admission',
    BUILD_ID,
  );
  try {
    mkdirSync(output, { recursive: true, mode: 0o700 });
    const marker = join(output, 'existing-evidence-marker');
    writeFileSync(marker, 'do-not-overwrite\n', { mode: 0o400 });
    assert.throws(
      () => custodialCodemagicAdmissionBootstrapInternals.exportAcceptedAdmission(
        fixture.checkout,
        BUILD_ID,
        { exportRoot: fixture.exportRoot },
      ),
      /already has exported admission evidence/,
    );
    assert.equal(readFileSync(marker, 'utf8'), 'do-not-overwrite\n');
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
            // Darwin refuses to rename a write-disabled directory. This hook
            // models an owner-controlled source swap, so make only the test
            // fixture writable before replacing its inode.
            chmodSync(source, 0o700);
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

// The generated-runtime sanitizer is an executable admission dependency outside
// mobile/scripts. Missing enumeration or a post-install/post-admission change
// must fail without export; only disposable synthetic checkout bytes are edited.
const sanitationPolicyPath = 'scripts/lib/runtime-sanitation-policy.mjs';
{
  const { calls, spawn: baseSpawn } = makeSpawn();
  const beforeDirectories = bootstrapDirectories();
  await assert.rejects(runCustodialCodemagicAdmissionBootstrap({
    ...testPrivateTreeHooks,
    args: ['--build-id', BUILD_ID], sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
    ...fakeHostDependencies(), fetchImpl: async () => fakeGithubResponse(),
    spawn(file, args, options) {
      if (file === GIT && args.includes('ls-files')) {
        assert.ok(args.includes(sanitationPolicyPath), 'policy has an exact snapshot pathspec');
        return result(`${SNAPSHOT_PATHS.filter(path => path !== sanitationPolicyPath).join('\0')}\0`);
      }
      return baseSpawn(file, args, options);
    },
  }), /Reviewed-source snapshot omits scripts\/lib\/runtime-sanitation-policy\.mjs/);
  assert.equal(calls.some(call => call.file === PINNED_NODE), false);
  assert.deepEqual(bootstrapDirectories(), beforeDirectories);
}
for (const stage of ['install', 'admission']) {
  const { calls, spawn: baseSpawn } = makeSpawn();
  const beforeDirectories = bootstrapDirectories();
  const stdout = captureStream(), stderr = captureStream();
  let exported = false;
  await assert.rejects(runCustodialCodemagicAdmissionBootstrap({
    ...testPrivateTreeHooks,
    args: ['--build-id', BUILD_ID], sourceEnvironment: { CODEMAGIC_API_TOKEN: TOKEN },
    stdout, stderr, ...fakeHostDependencies(), fetchImpl: async () => fakeGithubResponse(),
    spawn(file, args, options) {
      const response = baseSpawn(file, args, options);
      const mutate = file === PINNED_NODE && (stage === 'install' ? args[0] === NPM_CLI
        : args[0].endsWith('/mobile/scripts/admit-custodial-codemagic-build.mjs'));
      if (mutate) {
        const path = join(options.cwd, sanitationPolicyPath);
        writeFileSync(path, `${readFileSync(path, 'utf8')}\n// synthetic changed policy\n`);
      }
      return response;
    },
    exportAdmission() { exported = true; },
  }), /reviewed source/i);
  assert.equal(exported, false);
  if (stage === 'install') assert.equal(calls.some(call => call.file === PINNED_NODE
    && call.args[0].endsWith('/mobile/scripts/admit-custodial-codemagic-build.mjs')), false);
  assert.equal(stdout.text().includes(TOKEN) || stderr.text().includes(TOKEN), false);
  assert.deepEqual(bootstrapDirectories(), beforeDirectories);
}
assert.equal(activeTestRoots.size, 0, 'all synthetic private trees are disposed');
assert.equal(
  custodialCodemagicAdmissionBootstrapInternals.repositoryRoot,
  resolve(fileURLToPath(new URL('../..', import.meta.url))),
);

process.stdout.write('Custodial Codemagic admission bootstrap tests passed.\n');
}
