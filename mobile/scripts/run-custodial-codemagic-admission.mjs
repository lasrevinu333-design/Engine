#!/home/eric/.cache/codex-toolchains/node-v22.23.1/bin/node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  chmodSync,
  copyFileSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptsRoot = dirname(scriptPath);
const mobileRoot = resolve(scriptsRoot, '..');
const repositoryRoot = resolve(mobileRoot, '..');
const hostToolsModulePath = join(scriptsRoot, 'custodial-linux-admission-host-tools.mjs');
const hostToolsModuleUrl = pathToFileURL(hostToolsModulePath).href;
const hostToolsPolicyPath = join(mobileRoot, 'release-policies', 'custodial-linux-admission-host-tools.json');
const admissionScriptPath = join(scriptsRoot, 'admit-custodial-codemagic-build.mjs');

const EXPECTED_GITHUB_REPOSITORY = 'lasrevinu333-design/Engine';
const EXPECTED_ORIGIN_URL = `https://github.com/${EXPECTED_GITHUB_REPOSITORY}.git`;
const LIVE_MAIN_URL = `https://api.github.com/repos/${EXPECTED_GITHUB_REPOSITORY}/git/ref/heads/main`;
const BUILD_ID = /^[a-f0-9]{24}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const TOKEN_MINIMUM_BYTES = 16;
const TOKEN_MAXIMUM_BYTES = 2_048;
const NPM_TIMEOUT_MS = 15 * 60 * 1_000;
const ADMISSION_TIMEOUT_MS = 45 * 60 * 1_000;
const CHILD_OUTPUT_LIMIT_BYTES = 64 * 1_024 * 1_024;
const GIT_OUTPUT_LIMIT_BYTES = 4 * 1_024 * 1_024;
const GIT_TIMEOUT_MS = 2 * 60 * 1_000;
const GITHUB_RESPONSE_LIMIT_BYTES = 256 * 1_024;
const GITHUB_TIMEOUT_MS = 30_000;
const TEMPORARY_PARENT = '/home/eric/.cache';
const TEMPORARY_PREFIX = 'memphis-zoo-custodial-admission-bootstrap-';
const BOOTSTRAP_MARKER_NAME = 'MZ_CUSTODIAL_CODEMAGIC_ADMISSION_BOOTSTRAP';
const EXPECTED_HOST_TOOLS_MODULE_SHA256 = '8caff02b940e85474b6a6b14243ef8152fe9c09370d202bebd176e96012ff57d';
const EXPECTED_HOST_TOOLS_POLICY_SHA256 = '318295d2cabc18531bc085f831004852d3577d1bde25cd647630a58b3f7530a3';
const snapshotPathspecs = Object.freeze([
  'codemagic.yaml',
  'package.json',
  'package-lock.json',
  'mobile/package.json',
  'mobile/release-policies',
  'mobile/scripts',
]);
const requiredSnapshotPaths = Object.freeze([
  'codemagic.yaml',
  'package.json',
  'package-lock.json',
  'mobile/package.json',
  'mobile/release-policies/custodial-codemagic.json',
  'mobile/release-policies/custodial-codemagic-forward-recovery.json',
  'mobile/release-policies/custodial-linux-admission-host-tools.json',
  'mobile/scripts/admit-custodial-codemagic-build.mjs',
  'mobile/scripts/custodial-codemagic-admission.schema.json',
  'mobile/scripts/custodial-linux-admission-host-tools.mjs',
  'mobile/scripts/run-custodial-codemagic-admission.mjs',
  'mobile/scripts/verify-custodial-android-release.mjs',
]);

const inheritedHostEnvironmentKeys = Object.freeze([
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'CI',
  'COREPACK_ENABLE_PROJECT_SPEC',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_NOSYSTEM',
  'GIT_TERMINAL_PROMPT',
  'HOME',
  'JAVA_HOME',
  'LANG',
  'LC_ALL',
  'NO_COLOR',
  'NPM_CONFIG_AUDIT',
  'NPM_CONFIG_COLOR',
  'NPM_CONFIG_ENGINE_STRICT',
  'NPM_CONFIG_FUND',
  'NPM_CONFIG_PROGRESS',
  'NPM_CONFIG_UPDATE_NOTIFIER',
  'PATH',
  'TZ',
]);

function fail(message) {
  throw new Error(message);
}

function hasOwn(value, name) {
  return Object.prototype.hasOwnProperty.call(value, name);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sortedValue(value) {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((name) => [name, sortedValue(value[name])]));
}

function canonicalJson(value) {
  return JSON.stringify(sortedValue(value));
}

function exactObjectKeys(value, expected, label) {
  assertPlainObject(value, label);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} fields differ from the pinned bootstrap contract`);
  }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be one object`);
  }
}

function assertEnvironmentValue(value, label) {
  if (typeof value !== 'string' || value.length === 0 || /[\0\r\n]/.test(value)) {
    fail(`${label} is malformed`);
  }
  return value;
}

function assertCanonicalRealDirectory(path, label) {
  const value = assertEnvironmentValue(path, label);
  if (!value.startsWith('/') || resolve(value) !== value || realpathSync(value) !== value) {
    fail(`${label} must be an absolute canonical real path`);
  }
  const stat = lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`${label} must be one real directory`);
  }
  return value;
}

function assertExpectedRepository() {
  if (
    realpathSync(repositoryRoot) !== repositoryRoot
    || realpathSync(scriptPath) !== scriptPath
    || realpathSync(admissionScriptPath) !== admissionScriptPath
  ) {
    fail('Custodial Codemagic admission bootstrap is outside its reviewed repository');
  }
  for (const [path, label, expectDirectory] of [
    [repositoryRoot, 'repository root', true],
    [mobileRoot, 'mobile root', true],
    [scriptPath, 'bootstrap script', false],
    [admissionScriptPath, 'admission script', false],
  ]) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (expectDirectory ? !stat.isDirectory() : !stat.isFile())) {
      fail(`Custodial Codemagic ${label} has an unsafe file type`);
    }
  }
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function readPinnedBootstrapFile(path, expectedSha256, label, maximumBytes) {
  const beforePath = lstatSync(path, { bigint: true });
  if (
    !beforePath.isFile()
    || beforePath.isSymbolicLink()
    || realpathSync(path) !== path
    || beforePath.size < 1n
    || beforePath.size > BigInt(maximumBytes)
    || Number(beforePath.uid) !== process.getuid()
    || (beforePath.mode & 0o0002n) !== 0n
  ) fail(`Custodial admission ${label} is outside its pinned bootstrap identity`);
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!sameFileIdentity(beforePath, before)) {
      fail(`Custodial admission ${label} changed before secure open`);
    }
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count === 0) fail(`Custodial admission ${label} ended before its pinned size`);
      offset += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameFileIdentity(before, after) || sha256(bytes) !== expectedSha256) {
      fail(`Custodial admission ${label} differs from its pinned bootstrap identity`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function expectedHostIdentityFromPinnedPolicy(policy) {
  exactObjectKeys(policy, [
    'android_sdk', 'architecture', 'git', 'java', 'node', 'npm',
    'platform', 'schema_version', 'trusted_path', 'unzip',
  ], 'Pinned Custodial host policy');
  const environment = {
    PATH: policy.trusted_path,
    JAVA_HOME: policy.java.home_path,
    ANDROID_HOME: policy.android_sdk.path,
    ANDROID_SDK_ROOT: policy.android_sdk.path,
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    HOME: '/nonexistent/custodial-admission',
    XDG_CONFIG_HOME: '/nonexistent/custodial-admission/config',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    NPM_CONFIG_USERCONFIG: '/nonexistent/custodial-admission/npmrc-user',
    NPM_CONFIG_GLOBALCONFIG: '/nonexistent/custodial-admission/npmrc-global',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NPM_CONFIG_FUND: 'false',
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_ENGINE_STRICT: 'true',
    NPM_CONFIG_COLOR: 'false',
    NPM_CONFIG_PROGRESS: 'false',
    COREPACK_ENABLE_PROJECT_SPEC: '0',
    CI: 'true',
    NO_COLOR: '1',
  };
  const proof = {
    schema_id: 'urn:memphis-zoo:custodial-linux-admission-host-tools:v1',
    schema_version: 1,
    policy_sha256: EXPECTED_HOST_TOOLS_POLICY_SHA256,
    platform: policy.platform,
    architecture: policy.architecture,
    pristine_entrypoint: true,
    node: {
      path: policy.node.path,
      version: policy.node.version_stdout,
      sha256: policy.node.sha256,
    },
    npm: {
      cli_path: policy.npm.cli_path,
      version: policy.npm.version_stdout,
      tree_sha256: policy.npm.tree.sha256,
    },
    java: {
      home_path: policy.java.home_path,
      path: policy.java.path,
      version: policy.java.version_stderr.split('\n')[0],
      executable_sha256: policy.java.sha256,
      runtime_tree_sha256: policy.java.runtime_tree.sha256,
    },
    git: {
      path: policy.git.path,
      version: policy.git.version_stdout,
      sha256: policy.git.sha256,
    },
    unzip: {
      path: policy.unzip.path,
      version: policy.unzip.version_stdout,
      sha256: policy.unzip.sha256,
    },
    android_sdk: {
      root_path: policy.android_sdk.path,
      build_tools_directory: policy.android_sdk.build_tools_directory,
    },
  };
  return deepFreeze({
    schema_version: 1,
    policy_path: hostToolsPolicyPath,
    policy_sha256: EXPECTED_HOST_TOOLS_POLICY_SHA256,
    platform: policy.platform,
    architecture: policy.architecture,
    paths: {
      node: policy.node.path,
      npm_cli: policy.npm.cli_path,
      java: policy.java.path,
      java_home: policy.java.home_path,
      android_sdk_root: policy.android_sdk.path,
      android_build_tools_directory: policy.android_sdk.build_tools_directory,
      git: policy.git.path,
      unzip: policy.unzip.path,
    },
    npm_command: {
      executable: policy.node.path,
      arguments_prefix: [policy.npm.cli_path],
    },
    trusted_path: policy.trusted_path,
    environment,
    npm_tree: policy.npm.tree,
    java_runtime_tree: policy.java.runtime_tree,
    proof,
  });
}

function assertPinnedHostVerifierRootOfTrust() {
  const pinnedBytes = new Map();
  for (const [path, expectedSha256, label, maximumBytes] of [
    [hostToolsModulePath, EXPECTED_HOST_TOOLS_MODULE_SHA256, 'host verifier', 128 * 1_024],
    [hostToolsPolicyPath, EXPECTED_HOST_TOOLS_POLICY_SHA256, 'host policy', 64 * 1_024],
  ]) {
    pinnedBytes.set(path, readPinnedBootstrapFile(path, expectedSha256, label, maximumBytes));
  }
  let policy;
  try {
    policy = JSON.parse(pinnedBytes.get(hostToolsPolicyPath));
  } catch {
    fail('Pinned Custodial host policy is not valid JSON');
  }
  return expectedHostIdentityFromPinnedPolicy(policy);
}

export function parseCustodialCodemagicAdmissionBootstrapArguments(args) {
  if (!Array.isArray(args) || args.length !== 2 || args[0] !== '--build-id') {
    fail('Usage: run-custodial-codemagic-admission.mjs --build-id <Codemagic build ID>');
  }
  if (typeof args[1] !== 'string' || !BUILD_ID.test(args[1])) {
    fail('Codemagic build ID must be exactly 24 lowercase hexadecimal characters');
  }
  return args[1];
}

function validatedToken(environment) {
  assertPlainObject(environment, 'Bootstrap source environment');
  const token = environment.CODEMAGIC_API_TOKEN;
  if (
    typeof token !== 'string'
    || Buffer.byteLength(token) < TOKEN_MINIMUM_BYTES
    || Buffer.byteLength(token) > TOKEN_MAXIMUM_BYTES
    || /\s|\0/.test(token)
  ) {
    fail('CODEMAGIC_API_TOKEN is missing or malformed');
  }
  return token;
}

function assertVerifiedHost(verifiedHost, createHostEnvironment, expectedIdentity) {
  assertPlainObject(verifiedHost, 'Verified Custodial admission host');
  assertPlainObject(expectedIdentity, 'Pinned Custodial admission host identity');
  if (typeof createHostEnvironment !== 'function') {
    fail('Custodial admission host environment factory is unavailable');
  }
  const identityKeys = [
    'schema_version', 'policy_path', 'policy_sha256', 'platform', 'architecture',
    'paths', 'npm_command', 'trusted_path', 'environment', 'npm_tree',
    'java_runtime_tree', 'proof',
  ];
  exactObjectKeys(verifiedHost, identityKeys, 'Verified Custodial admission host');
  exactObjectKeys(expectedIdentity, identityKeys, 'Pinned Custodial admission host identity');
  if (canonicalJson(verifiedHost) !== canonicalJson(expectedIdentity)) {
    fail('Verified Custodial admission host differs from the pinned bootstrap identity');
  }
  assertPlainObject(verifiedHost.paths, 'Verified Custodial admission host paths');
  assertPlainObject(verifiedHost.npm_command, 'Verified Custodial npm command');
  const nodePath = assertEnvironmentValue(verifiedHost.paths.node, 'Verified Node path');
  const npmCli = assertEnvironmentValue(verifiedHost.paths.npm_cli, 'Verified npm CLI path');
  const gitPath = assertEnvironmentValue(verifiedHost.paths.git, 'Verified Git path');
  const javaHome = assertCanonicalRealDirectory(
    verifiedHost.paths.java_home,
    'Verified Java home',
  );
  if (
    verifiedHost.npm_command.executable !== nodePath
    || !Array.isArray(verifiedHost.npm_command.arguments_prefix)
    || verifiedHost.npm_command.arguments_prefix.length !== 1
    || verifiedHost.npm_command.arguments_prefix[0] !== npmCli
  ) {
    fail('Verified Custodial npm command differs from pinned Node/npm paths');
  }
  if (realpathSync(process.execPath) !== nodePath) {
    fail('Custodial admission bootstrap must itself run under the verified pinned Node');
  }
  if (realpathSync(gitPath) !== gitPath) {
    fail('Verified Git path must be one canonical real path');
  }
  return { gitPath, javaHome, nodePath, npmCli };
}

function minimalHostEnvironment(baseEnvironment) {
  assertPlainObject(baseEnvironment, 'Verified Custodial admission environment');
  const environment = {};
  for (const name of inheritedHostEnvironmentKeys) {
    if (hasOwn(baseEnvironment, name)) {
      environment[name] = assertEnvironmentValue(
        baseEnvironment[name],
        `Verified host environment ${name}`,
      );
    }
  }
  for (const name of ['PATH', 'LANG', 'LC_ALL', 'HOME', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL']) {
    if (!environment[name]) fail(`Verified host environment lacks ${name}`);
  }
  return environment;
}

function runCaptured(spawn, executable, arguments_, {
  cwd,
  environment,
  acceptedStatuses = [0],
  label,
  timeout = GIT_TIMEOUT_MS,
}) {
  const result = spawn(executable, arguments_, {
    cwd,
    env: environment,
    encoding: null,
    input: Buffer.alloc(0),
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
    shell: false,
    timeout,
    windowsHide: true,
  });
  assertPlainObject(result, `${label} result`);
  if (result.error || result.signal || !acceptedStatuses.includes(result.status)) {
    fail(`${label} failed`);
  }
  const stdout = Buffer.from(result.stdout || Buffer.alloc(0));
  const stderr = Buffer.from(result.stderr || Buffer.alloc(0));
  if (stderr.length !== 0) fail(`${label} wrote unexpected diagnostic output`);
  return Object.freeze({ status: result.status, stdout });
}

function gitArguments(repository, args) {
  return [
    '-c', 'core.fsmonitor=false',
    '-c', 'core.untrackedCache=false',
    '-c', 'advice.detachedHead=false',
    '-C', repository,
    ...args,
  ];
}

function gitCapture(spawn, gitPath, repository, args, environment, options = {}) {
  return runCaptured(
    spawn,
    gitPath,
    gitArguments(repository, args),
    {
      cwd: '/',
      environment,
      label: options.label || 'Pinned Git source check',
      acceptedStatuses: options.acceptedStatuses,
      timeout: options.timeout,
    },
  );
}

function oneLine(bytes, pattern, label) {
  const source = bytes.toString('utf8');
  if (!source.endsWith('\n') || source.slice(0, -1).includes('\n')) {
    fail(`${label} did not return exactly one line`);
  }
  const value = source.slice(0, -1);
  if (!pattern.test(value)) fail(`${label} is malformed`);
  return value;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function snapshotReviewedSource(spawn, gitPath, checkoutRoot, environment) {
  const tracked = gitCapture(
    spawn,
    gitPath,
    checkoutRoot,
    ['ls-files', '-z', '--', ...snapshotPathspecs],
    environment,
    { label: 'Pinned Git reviewed-source enumeration' },
  ).stdout;
  if (tracked.length === 0 || tracked.at(-1) !== 0) {
    fail('Reviewed-source enumeration is empty or malformed');
  }
  const paths = tracked.subarray(0, -1).toString('utf8').split('\0');
  if (paths.length !== new Set(paths).size || JSON.stringify(paths) !== JSON.stringify([...paths].sort())) {
    fail('Reviewed-source enumeration is duplicated or non-canonical');
  }
  for (const required of requiredSnapshotPaths) {
    if (!paths.includes(required)) fail(`Reviewed-source snapshot omits ${required}`);
  }
  const records = [];
  for (const relativePath of paths) {
    if (
      !relativePath
      || relativePath.startsWith('/')
      || relativePath.includes('\\')
      || relativePath.split('/').some((part) => !part || part === '.' || part === '..')
    ) fail('Reviewed-source enumeration contains an unsafe path');
    const path = resolve(checkoutRoot, relativePath);
    if (relative(checkoutRoot, path).startsWith('..')) fail('Reviewed-source path escapes the checkout');
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1_024 * 1_024) {
      fail(`Reviewed-source file is unsafe: ${relativePath}`);
    }
    const bytes = readFileSync(path);
    if (bytes.length !== stat.size) fail(`Reviewed-source file changed while read: ${relativePath}`);
    records.push([relativePath, bytes.length, sha256(bytes)]);
  }
  return Object.freeze(records.map((record) => Object.freeze(record)));
}

function assertCleanAuthenticatedSource({
  spawn,
  gitPath,
  checkoutRoot,
  environment,
  expectedCommit,
}) {
  const top = oneLine(
    gitCapture(spawn, gitPath, checkoutRoot, ['rev-parse', '--show-toplevel'], environment).stdout,
    /^\/.+/,
    'Pinned Git checkout root',
  );
  if (realpathSync(top) !== checkoutRoot) fail('Pinned Git checkout root differs from the reviewed path');
  const origin = oneLine(
    gitCapture(spawn, gitPath, checkoutRoot, ['remote', 'get-url', 'origin'], environment).stdout,
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/,
    'Pinned Git origin',
  );
  if (origin !== EXPECTED_ORIGIN_URL) fail('Pinned Git origin differs from the reviewed repository');
  const commit = oneLine(
    gitCapture(spawn, gitPath, checkoutRoot, ['rev-parse', 'HEAD^{commit}'], environment).stdout,
    COMMIT,
    'Pinned Git HEAD',
  );
  const remoteMain = oneLine(
    gitCapture(
      spawn,
      gitPath,
      checkoutRoot,
      ['rev-parse', 'refs/remotes/origin/main^{commit}'],
      environment,
    ).stdout,
    COMMIT,
    'Pinned Git origin/main',
  );
  if (commit !== expectedCommit || remoteMain !== expectedCommit) {
    fail('Pinned Git checkout does not equal authenticated live main');
  }
  const status = gitCapture(
    spawn,
    gitPath,
    checkoutRoot,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', '.'],
    environment,
    { label: 'Pinned Git clean-source check' },
  ).stdout;
  if (status.length !== 0) fail('Custodial admission requires a completely clean source checkout');
  return Object.freeze({
    commit,
    snapshot: snapshotReviewedSource(spawn, gitPath, checkoutRoot, environment),
  });
}

async function boundedResponseBytes(response, maximum, label) {
  const declared = response.headers?.get?.('content-length');
  if (declared != null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) {
    try { await response.body?.cancel?.(); } catch {}
    fail(`${label} exceeds its response-size policy`);
  }
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximum) fail(`${label} exceeds its response-size policy`);
    return bytes;
  }
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      fail(`${label} exceeds its response-size policy`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

async function authenticatedLiveMain(fetchImpl) {
  let response;
  try {
    response = await fetchImpl(LIVE_MAIN_URL, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'memphis-zoo-custodial-admission-bootstrap/1',
        'x-github-api-version': '2022-11-28',
      },
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });
  } catch (error) {
    fail(`Authenticated GitHub main lookup failed (${error?.name || 'network error'})`);
  }
  if (
    response.status !== 200
    || response.url !== LIVE_MAIN_URL
    || !String(response.headers?.get?.('content-type') || '').toLowerCase().startsWith('application/json')
  ) {
    try { await response.body?.cancel?.(); } catch {}
    fail('Authenticated GitHub main lookup returned an invalid response');
  }
  const bytes = await boundedResponseBytes(response, GITHUB_RESPONSE_LIMIT_BYTES, 'GitHub main response');
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    fail('Authenticated GitHub main response is not valid JSON');
  }
  if (
    !value
    || typeof value !== 'object'
    || value.ref !== 'refs/heads/main'
    || !value.object
    || value.object.type !== 'commit'
    || !COMMIT.test(String(value.object.sha || ''))
  ) fail('Authenticated GitHub main response is malformed');
  return value.object.sha;
}

function chooseAndroidSdkRoot(verifiedHost, sourceEnvironment) {
  const verifiedSdk = verifiedHost.paths.android_sdk_root;
  if (verifiedSdk != null) {
    const sdk = assertCanonicalRealDirectory(verifiedSdk, 'Verified Android SDK root');
    for (const name of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) {
      const hostValue = verifiedHost.environment?.[name];
      if (hostValue != null && hostValue !== sdk) {
        fail(`Verified host ${name} differs from its Android SDK root`);
      }
    }
    return sdk;
  }

  const sdkRoot = sourceEnvironment.ANDROID_SDK_ROOT;
  const androidHome = sourceEnvironment.ANDROID_HOME;
  if (sdkRoot && androidHome && sdkRoot !== androidHome) {
    fail('ANDROID_HOME and ANDROID_SDK_ROOT must identify the same SDK');
  }
  return assertCanonicalRealDirectory(
    sdkRoot || androidHome,
    'Android SDK root',
  );
}

function assertPrivateDirectory(path, expectedParent = null) {
  if (expectedParent && dirname(path) !== expectedParent) {
    fail('Custodial bootstrap private directory has an unexpected parent');
  }
  const stat = lstatSync(path, { bigint: true });
  if (
    !stat.isDirectory()
    || stat.isSymbolicLink()
    || Number(stat.uid) !== process.getuid()
    || (stat.mode & 0o077n) !== 0n
    || realpathSync(path) !== path
  ) {
    fail('Custodial bootstrap private directory is unsafe');
  }
  return stat;
}

function createPrivateBootstrapTree() {
  const parentStat = lstatSync(TEMPORARY_PARENT);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || realpathSync(TEMPORARY_PARENT) !== TEMPORARY_PARENT) {
    fail('Custodial bootstrap temporary parent is unsafe');
  }
  const root = mkdtempSync(join(
    TEMPORARY_PARENT,
    `${TEMPORARY_PREFIX}${process.getuid()}-`,
  ));
  chmodSync(root, 0o700);
  const rootIdentity = assertPrivateDirectory(root, TEMPORARY_PARENT);
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
    assertPrivateDirectory(path, root);
    directories[name] = path;
  }
  return Object.freeze({
    root,
    rootIdentity,
    checkout: join(root, 'checkout'),
    ...directories,
  });
}

function sameDirectoryIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid;
}

function removePrivateBootstrapTreeAt(tree, temporaryParent, expectedNamePrefix) {
  if (!tree) return;
  const expectedPrefix = join(temporaryParent, expectedNamePrefix);
  if (
    typeof tree.root !== 'string'
    || !tree.root.startsWith(expectedPrefix)
    || dirname(tree.root) !== temporaryParent
    || resolve(tree.root) !== tree.root
  ) {
    fail('Refusing to clean an untrusted Custodial bootstrap path');
  }
  let actual;
  try {
    actual = lstatSync(tree.root, { bigint: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (
    !actual.isDirectory()
    || actual.isSymbolicLink()
    || !sameDirectoryIdentity(actual, tree.rootIdentity)
    || realpathSync(tree.root) !== tree.root
  ) {
    fail('Refusing to clean a replaced Custodial bootstrap directory');
  }
  const admissionParent = join(
    tree.checkout,
    'build',
    'custodial-codemagic-admission',
  );
  if (existsSync(admissionParent)) {
    const parent = lstatSync(admissionParent);
    if (
      !parent.isDirectory()
      || parent.isSymbolicLink()
      || Number(parent.uid) !== process.getuid()
      || realpathSync(admissionParent) !== admissionParent
    ) fail('Refusing to clean an unsafe disposable admission directory');
    chmodSync(admissionParent, 0o700);
    for (const name of readdirSync(admissionParent)) {
      const child = join(admissionParent, name);
      const stat = lstatSync(child);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        if (Number(stat.uid) !== process.getuid() || realpathSync(child) !== child) {
          fail('Refusing to clean replaced disposable admission evidence');
        }
        chmodSync(child, 0o700);
      }
    }
  }
  rmSync(tree.root, { recursive: true, force: false });
}

function removePrivateBootstrapTree(tree) {
  return removePrivateBootstrapTreeAt(
    tree,
    TEMPORARY_PARENT,
    `${TEMPORARY_PREFIX}${process.getuid()}-`,
  );
}

function createDisposableCheckout({
  spawn,
  gitPath,
  environment,
  checkoutRoot,
  commit,
}) {
  runCaptured(
    spawn,
    gitPath,
    [
      '-c', 'core.fsmonitor=false',
      '-c', 'core.untrackedCache=false',
      '-c', 'init.templateDir=',
      'clone',
      '--no-checkout',
      '--single-branch',
      '--branch', 'main',
      '--no-tags',
      '--depth', '1',
      '--quiet',
      '--',
      EXPECTED_ORIGIN_URL,
      checkoutRoot,
    ],
    {
      cwd: '/',
      environment,
      label: 'Pinned Git disposable checkout creation',
      timeout: 5 * 60 * 1_000,
    },
  );
  assertCanonicalRealDirectory(checkoutRoot, 'Disposable Custodial checkout');
  gitCapture(
    spawn,
    gitPath,
    checkoutRoot,
    ['checkout', '--detach', '--quiet', commit],
    environment,
    { label: 'Pinned Git disposable commit checkout' },
  );
}

function assertSafeExportDirectory(path, mode) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || Number(stat.uid) !== process.getuid()) {
    fail('Custodial admission export directory is unsafe');
  }
  chmodSync(path, mode);
}

function ensureSafeExportDirectory(path, mode) {
  if (!existsSync(path)) mkdirSync(path, { mode });
  assertSafeExportDirectory(path, mode);
}

function assertAdmissionSourceIdentity(source, expected) {
  const actual = lstatSync(source);
  if (
    !actual.isDirectory()
    || actual.isSymbolicLink()
    || actual.dev !== expected.dev
    || actual.ino !== expected.ino
    || Number(actual.uid) !== process.getuid()
    || realpathSync(source) !== source
  ) fail('Successful admission evidence source changed during export');
  return actual;
}

function assertAtomicAdmissionExportHost(
  platform = process.platform,
  architecture = process.arch,
) {
  // Darwin refuses to rename a write-disabled directory, including a
  // same-parent rename. The reviewed Linux/x64 admission host permits the
  // directory to be sealed before its atomic final-name publication.
  if (platform !== 'linux' || architecture !== 'x64') {
    fail(
      `Custodial admission atomic evidence export requires linux/x64, received ${platform}/${architecture}`,
    );
  }
  return true;
}

function exportAcceptedAdmission(checkoutRoot, buildId, options = {}) {
  assertPlainObject(options, 'Custodial admission export options');
  exactObjectKeys(options, Object.keys(options).filter((name) => ['exportRoot', 'beforeCommit'].includes(name)), 'Custodial admission export options');
  if (Object.keys(options).some((name) => !['exportRoot', 'beforeCommit'].includes(name))) {
    fail('Custodial admission export options contain an unsupported field');
  }
  if (options.beforeCommit != null && typeof options.beforeCommit !== 'function') {
    fail('Custodial admission export pre-commit hook is malformed');
  }
  if (!BUILD_ID.test(String(buildId || ''))) fail('Custodial admission export build ID is malformed');
  const exportRoot = assertCanonicalRealDirectory(
    options.exportRoot || repositoryRoot,
    'Custodial admission export root',
  );
  const exportRootStat = lstatSync(exportRoot);
  if (Number(exportRootStat.uid) !== process.getuid() || (exportRootStat.mode & 0o002) !== 0) {
    fail('Custodial admission export root is not owned and protected');
  }
  const source = join(checkoutRoot, 'build', 'custodial-codemagic-admission', buildId);
  if (
    !existsSync(source)
    || realpathSync(source) !== source
    || dirname(source) !== join(checkoutRoot, 'build', 'custodial-codemagic-admission')
  ) fail('Successful admission did not produce its exact evidence directory');
  const sourceStat = lstatSync(source);
  if (
    !sourceStat.isDirectory()
    || sourceStat.isSymbolicLink()
    || Number(sourceStat.uid) !== process.getuid()
    || (sourceStat.mode & 0o077) !== 0
  ) {
    fail('Successful admission evidence directory is unsafe');
  }
  const files = readdirSync(source).sort();
  const fixedFiles = new Set([
    'app-release.apk',
    'custodial-codemagic-admission.json',
    'custodial-linux-consumer-acceptance.json',
  ]);
  const bundleNames = files.filter((name) => /^Engine_[1-9][0-9]*_artifacts\.zip$/.test(name));
  if (
    files.length !== 4
    || bundleNames.length !== 1
    || [...fixedFiles].some((name) => !files.includes(name))
  ) fail('Successful admission evidence file graph is malformed');

  const buildRoot = join(exportRoot, 'build');
  const exportParent = join(buildRoot, 'custodial-codemagic-admission');
  ensureSafeExportDirectory(buildRoot, 0o755);
  ensureSafeExportDirectory(exportParent, 0o700);
  const finalDirectory = join(exportParent, buildId);
  if (existsSync(finalDirectory)) fail('Custodial build already has exported admission evidence');
  const staging = mkdtempSync(join(exportParent, `.bootstrap-export-${buildId}-`));
  chmodSync(staging, 0o700);
  try {
    for (const name of files) {
      if (basename(name) !== name) fail('Admission evidence file name is unsafe');
      const sourcePath = join(source, name);
      const destinationPath = join(staging, name);
      const before = lstatSync(sourcePath);
      if (
        !before.isFile()
        || before.isSymbolicLink()
        || Number(before.uid) !== process.getuid()
        || (before.mode & 0o077) !== 0
        || before.size <= 0
        || before.size > 300 * 1_024 * 1_024
      ) {
        fail(`Admission evidence file is unsafe: ${name}`);
      }
      const beforeDigest = sha256(readFileSync(sourcePath));
      copyFileSync(sourcePath, destinationPath, constants.COPYFILE_EXCL);
      chmodSync(destinationPath, 0o400);
      const destinationStat = lstatSync(destinationPath);
      if (
        !destinationStat.isFile()
        || destinationStat.isSymbolicLink()
        || destinationStat.size !== before.size
        || sha256(readFileSync(destinationPath)) !== beforeDigest
        || sha256(readFileSync(sourcePath)) !== beforeDigest
      ) fail(`Admission evidence changed during export: ${name}`);
    }
    options.beforeCommit?.(Object.freeze({ source, staging, finalDirectory }));
    assertAdmissionSourceIdentity(source, sourceStat);
    assertAtomicAdmissionExportHost();
    chmodSync(staging, 0o500);
    renameSync(staging, finalDirectory);
  } catch (error) {
    if (existsSync(staging)) {
      chmodSync(staging, 0o700);
      rmSync(staging, { recursive: true, force: false });
    }
    throw error;
  } finally {
    assertAdmissionSourceIdentity(source, sourceStat);
    // The accepted source is a disposable exact-main checkout. Restore owner
    // write only after the immutable 0400/0500 export has committed so the
    // private checkout can be removed without weakening exported evidence.
    chmodSync(source, 0o700);
  }
}

function controlledEnvironment({
  baseEnvironment,
  tree,
  javaHome,
  androidSdkRoot,
  token,
  includeToken,
  bootstrapMarker,
}) {
  assertPlainObject(baseEnvironment, 'Verified Custodial admission environment');
  const environment = {};
  for (const name of inheritedHostEnvironmentKeys) {
    if (hasOwn(baseEnvironment, name)) {
      environment[name] = assertEnvironmentValue(
        baseEnvironment[name],
        `Verified host environment ${name}`,
      );
    }
  }
  if (!environment.PATH || environment.JAVA_HOME !== javaHome) {
    fail('Verified host environment does not bind its pinned PATH and Java home');
  }
  environment.ANDROID_HOME = androidSdkRoot;
  environment.ANDROID_SDK_ROOT = androidSdkRoot;
  environment.HOME = tree.home;
  environment.XDG_CONFIG_HOME = tree.xdgConfig;
  environment.XDG_CACHE_HOME = tree.xdgCache;
  environment.TMPDIR = tree.temporary;
  environment.NPM_CONFIG_CACHE = tree.npmCache;
  environment.NPM_CONFIG_USERCONFIG = join(tree.root, 'npm-user-config');
  environment.NPM_CONFIG_GLOBALCONFIG = join(tree.root, 'npm-global-config');
  environment.NPM_CONFIG_IGNORE_SCRIPTS = 'true';
  if (includeToken) {
    environment.CODEMAGIC_API_TOKEN = token;
    if (!/^[a-f0-9]{64}$/.test(String(bootstrapMarker || ''))) {
      fail('Verified host policy digest is malformed');
    }
    environment[BOOTSTRAP_MARKER_NAME] = bootstrapMarker;
  }
  return Object.freeze(environment);
}

function forwardOutput(result, stdout, stderr) {
  if (result.stdout && result.stdout.length > 0) stdout.write(result.stdout);
  if (result.stderr && result.stderr.length > 0) stderr.write(result.stderr);
}

function spawnBounded(spawn, executable, arguments_, options, streams) {
  const result = spawn(executable, arguments_, {
    cwd: options.cwd,
    env: options.environment,
    encoding: null,
    input: Buffer.alloc(0),
    maxBuffer: CHILD_OUTPUT_LIMIT_BYTES,
    shell: false,
    timeout: options.timeout,
    windowsHide: true,
  });
  assertPlainObject(result, 'Custodial bootstrap child result');
  forwardOutput(result, streams.stdout, streams.stderr);
  if (result.error) {
    const category = result.error.code === 'ETIMEDOUT' ? 'timed out' : 'could not execute';
    streams.stderr.write(`Custodial admission child ${category}.\n`);
    return 1;
  }
  if (result.signal) {
    streams.stderr.write('Custodial admission child terminated by a signal.\n');
    return 1;
  }
  if (!Number.isInteger(result.status) || result.status < 0 || result.status > 255) {
    streams.stderr.write('Custodial admission child returned an invalid status.\n');
    return 1;
  }
  return result.status;
}

async function defaultLoadHostTools() {
  return import(hostToolsModuleUrl);
}

async function verifyPinnedCustodialAdmissionHostIdentity() {
  const expectedIdentity = assertPinnedHostVerifierRootOfTrust();
  const hostTools = await defaultLoadHostTools();
  if (
    !hostTools
    || typeof hostTools.verifyCustodialLinuxAdmissionHostTools !== 'function'
    || typeof hostTools.createCustodialAdmissionHostEnvironment !== 'function'
  ) fail('Custodial Linux admission host verifier exports are unavailable');
  const verifiedHost = await hostTools.verifyCustodialLinuxAdmissionHostTools();
  assertVerifiedHost(
    verifiedHost,
    hostTools.createCustodialAdmissionHostEnvironment,
    expectedIdentity,
  );
  return verifiedHost;
}

export async function runCustodialCodemagicAdmissionBootstrap({
  args = process.argv.slice(2),
  sourceEnvironment = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  loadHostTools = defaultLoadHostTools,
  spawn = spawnSync,
  fetchImpl = fetch,
  exportAdmission = exportAcceptedAdmission,
  createPrivateTree = createPrivateBootstrapTree,
  removePrivateTree = removePrivateBootstrapTree,
  expectedVerifiedHostIdentity,
} = {}) {
  const buildId = parseCustodialCodemagicAdmissionBootstrapArguments(args);
  const token = validatedToken(sourceEnvironment);
  if (
    typeof loadHostTools !== 'function'
    || typeof spawn !== 'function'
    || typeof fetchImpl !== 'function'
    || typeof exportAdmission !== 'function'
    || typeof createPrivateTree !== 'function'
    || typeof removePrivateTree !== 'function'
  ) {
    fail('Custodial admission bootstrap dependency injection is malformed');
  }

  // The host verifier is deliberately the first non-built-in module loaded. No
  // package or admission module is imported into this process.
  const pinnedHostIdentity = assertPinnedHostVerifierRootOfTrust();
  const hostTools = await loadHostTools();
  if (
    !hostTools
    || typeof hostTools.verifyCustodialLinuxAdmissionHostTools !== 'function'
    || typeof hostTools.createCustodialAdmissionHostEnvironment !== 'function'
  ) {
    fail('Custodial Linux admission host verifier exports are unavailable');
  }
  const verifiedHost = await hostTools.verifyCustodialLinuxAdmissionHostTools();
  const pinned = assertVerifiedHost(
    verifiedHost,
    hostTools.createCustodialAdmissionHostEnvironment,
    expectedVerifiedHostIdentity || pinnedHostIdentity,
  );
  assertExpectedRepository();
  const androidSdkRoot = chooseAndroidSdkRoot(verifiedHost, sourceEnvironment);
  const pristineHostEnvironment = hostTools.createCustodialAdmissionHostEnvironment(verifiedHost, {});
  const gitEnvironment = minimalHostEnvironment(pristineHostEnvironment);
  if (gitEnvironment.JAVA_HOME !== pinned.javaHome) {
    fail('Verified host environment does not bind its pinned Java home');
  }
  const liveMain = await authenticatedLiveMain(fetchImpl);
  const sourceBefore = assertCleanAuthenticatedSource({
    spawn,
    gitPath: pinned.gitPath,
    checkoutRoot: repositoryRoot,
    environment: gitEnvironment,
    expectedCommit: liveMain,
  });

  let tree;
  let primaryError;
  const previousUmask = process.umask(0o077);
  try {
    tree = createPrivateTree();
    const hostEnvironment = hostTools.createCustodialAdmissionHostEnvironment(
      verifiedHost,
      { TMPDIR: tree.temporary },
    );
    const npmEnvironment = controlledEnvironment({
      baseEnvironment: hostEnvironment,
      tree,
      javaHome: pinned.javaHome,
      androidSdkRoot,
      token,
      includeToken: false,
      bootstrapMarker: verifiedHost.policy_sha256,
    });
    createDisposableCheckout({
      spawn,
      gitPath: pinned.gitPath,
      environment: npmEnvironment,
      checkoutRoot: tree.checkout,
      commit: liveMain,
    });
    const disposableBefore = assertCleanAuthenticatedSource({
      spawn,
      gitPath: pinned.gitPath,
      checkoutRoot: tree.checkout,
      environment: npmEnvironment,
      expectedCommit: liveMain,
    });
    if (JSON.stringify(disposableBefore.snapshot) !== JSON.stringify(sourceBefore.snapshot)) {
      fail('Disposable checkout differs from the reviewed source snapshot');
    }
    const npmStatus = spawnBounded(
      spawn,
      pinned.nodePath,
      [
        pinned.npmCli,
        'ci',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
      ],
      {
        cwd: tree.checkout,
        environment: npmEnvironment,
        timeout: NPM_TIMEOUT_MS,
      },
      { stdout, stderr },
    );
    if (npmStatus !== 0) {
      return npmStatus;
    }

    const liveAfterInstall = await authenticatedLiveMain(fetchImpl);
    if (liveAfterInstall !== liveMain) fail('GitHub main changed during the clean dependency install');
    const sourceAfterInstall = assertCleanAuthenticatedSource({
      spawn,
      gitPath: pinned.gitPath,
      checkoutRoot: repositoryRoot,
      environment: gitEnvironment,
      expectedCommit: liveMain,
    });
    const disposableAfterInstall = assertCleanAuthenticatedSource({
      spawn,
      gitPath: pinned.gitPath,
      checkoutRoot: tree.checkout,
      environment: npmEnvironment,
      expectedCommit: liveMain,
    });
    if (
      JSON.stringify(sourceAfterInstall.snapshot) !== JSON.stringify(sourceBefore.snapshot)
      || JSON.stringify(disposableAfterInstall.snapshot) !== JSON.stringify(sourceBefore.snapshot)
    ) fail('Reviewed source changed during the clean dependency install');

    const admissionEnvironment = controlledEnvironment({
      baseEnvironment: hostEnvironment,
      tree,
      javaHome: pinned.javaHome,
      androidSdkRoot,
      token,
      includeToken: true,
      bootstrapMarker: verifiedHost.policy_sha256,
    });
    const admissionStatus = spawnBounded(
      spawn,
      pinned.nodePath,
      [join(tree.checkout, 'mobile', 'scripts', basename(admissionScriptPath)), '--build-id', buildId],
      {
        cwd: tree.checkout,
        environment: admissionEnvironment,
        timeout: ADMISSION_TIMEOUT_MS,
      },
      { stdout, stderr },
    );
    if (admissionStatus !== 0) return admissionStatus;

    const liveAfterAdmission = await authenticatedLiveMain(fetchImpl);
    if (liveAfterAdmission !== liveMain) fail('GitHub main changed during artifact admission');
    const disposableAfterAdmission = assertCleanAuthenticatedSource({
      spawn,
      gitPath: pinned.gitPath,
      checkoutRoot: tree.checkout,
      environment: npmEnvironment,
      expectedCommit: liveMain,
    });
    const sourceAfterAdmission = assertCleanAuthenticatedSource({
      spawn,
      gitPath: pinned.gitPath,
      checkoutRoot: repositoryRoot,
      environment: gitEnvironment,
      expectedCommit: liveMain,
    });
    if (
      JSON.stringify(disposableAfterAdmission.snapshot) !== JSON.stringify(sourceBefore.snapshot)
      || JSON.stringify(sourceAfterAdmission.snapshot) !== JSON.stringify(sourceBefore.snapshot)
    ) fail('Reviewed source changed during artifact admission');
    exportAdmission(tree.checkout, buildId);
    return 0;
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    let cleanupFailure;
    try {
      removePrivateTree(tree);
    } catch (cleanupError) {
      if (primaryError) {
        stderr.write('Custodial bootstrap temporary cleanup also failed.\n');
      } else {
        cleanupFailure = cleanupError;
      }
    }
    process.umask(previousUmask);
    if (cleanupFailure) throw cleanupFailure;
  }
}

export const custodialCodemagicAdmissionBootstrapInternals = Object.freeze({
  admissionScriptPath,
  bootstrapMarkerName: BOOTSTRAP_MARKER_NAME,
  childOutputLimitBytes: CHILD_OUTPUT_LIMIT_BYTES,
  hostToolsModuleUrl,
  expectedHostToolsModuleSha256: EXPECTED_HOST_TOOLS_MODULE_SHA256,
  expectedHostToolsPolicySha256: EXPECTED_HOST_TOOLS_POLICY_SHA256,
  assertAtomicAdmissionExportHost,
  exportAcceptedAdmission,
  removePrivateBootstrapTreeAt,
  verifyPinnedCustodialAdmissionHostIdentity,
  npmTimeoutMs: NPM_TIMEOUT_MS,
  admissionTimeoutMs: ADMISSION_TIMEOUT_MS,
  repositoryRoot,
});

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    process.exitCode = await runCustodialCodemagicAdmissionBootstrap();
  } catch (error) {
    process.stderr.write(`Custodial Codemagic admission bootstrap failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
