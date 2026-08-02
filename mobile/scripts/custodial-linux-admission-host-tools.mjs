import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  readlinkSync,
  statSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsRoot = dirname(fileURLToPath(import.meta.url));
const policyPath = resolve(
  scriptsRoot,
  '..',
  'release-policies',
  'custodial-linux-admission-host-tools.json',
);

const TREE_FORMAT = 'memphis-zoo-custodial-npm-installation-tree-v1';
const JAVA_TREE_FORMAT = 'memphis-zoo-custodial-java-runtime-tree-v1';
const TREE_LIMITS = Object.freeze({
  maxEntries: 5_000,
  maxFileBytes: 1_048_576,
  maxTotalFileBytes: 20_000_000,
  maxDepth: 32,
});
const JAVA_TREE_LIMITS = Object.freeze({
  maxEntries: 1_000,
  maxFileBytes: 160_000_000,
  maxTotalFileBytes: 400_000_000,
  maxDepth: 16,
});
const POLICY_MAX_BYTES = 32_768;
const HASH_BUFFER_BYTES = 1_048_576;
const TOOL_TIMEOUT_MS = 10_000;
const TOOL_MAX_OUTPUT_BYTES = 1_048_576;
const verifiedHostResults = new WeakSet();
const forbiddenEntrypointEnvironment = Object.freeze([
  'ALL_PROXY',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'LD_LIBRARY_PATH',
  'LD_PRELOAD',
  'NODE_EXTRA_CA_CERTS',
  'NODE_OPTIONS',
  'NODE_PATH',
  'NODE_TLS_REJECT_UNAUTHORIZED',
  'NO_PROXY',
  'OPENSSL_CONF',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'all_proxy',
  'http_proxy',
  'https_proxy',
  'no_proxy',
]);

const expectedIdentity = Object.freeze({
  schema_version: 1,
  platform: 'linux',
  architecture: 'x64',
  nodePath: '/home/eric/.cache/codex-toolchains/node-v22.23.1/bin/node',
  nodeVersion: 'v22.23.1',
  npmRoot: '/home/eric/.cache/codex-toolchains/node-v22.23.1/lib/node_modules/npm',
  npmCli: '/home/eric/.cache/codex-toolchains/node-v22.23.1/lib/node_modules/npm/bin/npm-cli.js',
  npmVersion: '11.17.0',
  javaHome: '/usr/lib/jvm/java-21-openjdk-amd64',
  javaPath: '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
  javaVersion: [
    'openjdk version "21.0.11" 2026-04-21',
    'OpenJDK Runtime Environment (build 21.0.11+10-1-24.04.2-Ubuntu)',
    'OpenJDK 64-Bit Server VM (build 21.0.11+10-1-24.04.2-Ubuntu, mixed mode, sharing)',
  ].join('\n'),
  androidSdkRoot: '/home/eric/Android/Sdk',
  androidBuildToolsDirectory: '/home/eric/Android/Sdk/build-tools/35.0.1',
  gitPath: '/usr/bin/git',
  gitVersion: 'git version 2.43.0',
  unzipPath: '/usr/bin/unzip',
  unzipVersion: 'UnZip 6.00 of 20 April 2009, by Debian. Original by Info-ZIP.',
  path: '/home/eric/.cache/codex-toolchains/node-v22.23.1/bin:/usr/lib/jvm/java-21-openjdk-amd64/bin:/usr/bin',
});

function hasExactKeys(value, keys) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function sortedValue(value) {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortedValue(value[key])]),
  );
}

export function canonicalHostToolPolicyJson(value) {
  return `${JSON.stringify(sortedValue(value), null, 2)}\n`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function modeOctal(stat) {
  return (stat.mode & 0o7777n).toString(8).padStart(4, '0');
}

function sameOpenFile(before, after) {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mode === after.mode
    && before.uid === after.uid
    && before.gid === after.gid
    && before.mtimeNs === after.mtimeNs
    && before.ctimeNs === after.ctimeNs;
}

function assertAbsoluteCanonicalPath(path, label) {
  if (typeof path !== 'string' || !isAbsolute(path) || resolve(path) !== path || path.includes('\0')) {
    throw new Error(`${label} must be an absolute canonical path`);
  }
}

function assertPristineEntrypoint() {
  if (process.execArgv.length !== 0) {
    throw new Error('Custodial local admission rejects Node CLI runtime flags');
  }
  for (const name of forbiddenEntrypointEnvironment) {
    if (Object.hasOwn(process.env, name)) {
      throw new Error(`Custodial local admission rejects inherited runtime environment: ${name}`);
    }
  }
}

function assertSafeParentChain(path, { includeLeaf = false } = {}) {
  assertAbsoluteCanonicalPath(path, 'Trusted host path');
  const segments = path.split(sep).filter(Boolean);
  const stop = includeLeaf ? segments.length : segments.length - 1;
  let cursor = sep;
  for (let index = 0; index < stop; index += 1) {
    cursor = join(cursor, segments[index]);
    const stat = lstatSync(cursor, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Trusted host path has a non-directory or symbolic-link component: ${cursor}`);
    }
    if ((stat.mode & 0o0022n) !== 0n) {
      throw new Error(`Trusted host path has a group/world-writable directory: ${cursor}`);
    }
  }
}

function hashOpenRegularFile(path, { executable = false } = {}) {
  const beforePath = lstatSync(path, { bigint: true });
  if (!beforePath.isFile() || beforePath.isSymbolicLink()) {
    throw new Error(`Trusted host file is not a regular non-symlink: ${path}`);
  }
  if ((beforePath.mode & 0o0022n) !== 0n) {
    throw new Error(`Trusted host file is group/world-writable: ${path}`);
  }
  if (beforePath.nlink !== 1n) {
    throw new Error(`Trusted host file has an unsafe hard-link count: ${path}`);
  }
  if (executable && (beforePath.mode & 0o0111n) === 0n) {
    throw new Error(`Trusted host executable lacks an execute bit: ${path}`);
  }

  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!sameOpenFile(beforePath, before)) {
      throw new Error(`Trusted host file changed before it was opened: ${path}`);
    }
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
    let position = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, position);
      if (count === 0) break;
      digest.update(buffer.subarray(0, count));
      position += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameOpenFile(before, after) || BigInt(position) !== before.size) {
      throw new Error(`Trusted host file changed while it was hashed: ${path}`);
    }
    return Object.freeze({
      path,
      size_bytes: Number(before.size),
      sha256: digest.digest('hex'),
      uid: Number(before.uid),
      gid: Number(before.gid),
      mode_octal: modeOctal(before),
    });
  } finally {
    closeSync(descriptor);
  }
}

function hashRunningNodeExecutable(expectedPath) {
  const procExecutable = '/proc/self/exe';
  const procTarget = readlinkSync(procExecutable);
  if (procTarget !== expectedPath) {
    throw new Error('Running Node executable target does not match policy');
  }
  const pathStat = lstatSync(expectedPath, { bigint: true });
  const procStat = statSync(procExecutable, { bigint: true });
  if (
    !pathStat.isFile()
    || pathStat.isSymbolicLink()
    || !procStat.isFile()
    || pathStat.dev !== procStat.dev
    || pathStat.ino !== procStat.ino
  ) throw new Error('Running Node executable inode does not match its pinned path');

  const descriptor = openSync(procExecutable, constants.O_RDONLY);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!sameOpenFile(procStat, before)) {
      throw new Error('Running Node executable changed before inspection');
    }
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
    let position = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, position);
      if (count === 0) break;
      digest.update(buffer.subarray(0, count));
      position += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameOpenFile(before, after) || BigInt(position) !== before.size) {
      throw new Error('Running Node executable changed while it was hashed');
    }
    return Object.freeze({
      path: expectedPath,
      size_bytes: Number(before.size),
      sha256: digest.digest('hex'),
      uid: Number(before.uid),
      gid: Number(before.gid),
      mode_octal: modeOctal(before),
    });
  } finally {
    closeSync(descriptor);
  }
}

function assertFileIdentity(actual, expected, label) {
  if (!hasExactKeys(expected, [
    'path',
    'resolved_path',
    'size_bytes',
    'sha256',
    'uid',
    'gid',
    'mode_octal',
    'version_stdout',
  ])) throw new Error(`${label} policy has unexpected fields`);
  assertAbsoluteCanonicalPath(expected.path, `${label} path`);
  if (expected.resolved_path !== expected.path) {
    throw new Error(`${label} policy must resolve to the same non-symlink path`);
  }
  if (
    actual.path !== expected.path
    || actual.size_bytes !== expected.size_bytes
    || actual.sha256 !== expected.sha256
    || actual.uid !== expected.uid
    || actual.gid !== expected.gid
    || actual.mode_octal !== expected.mode_octal
  ) throw new Error(`${label} file identity does not match policy`);
}

function runVersion(executable, arguments_, environment, { output = 'stdout' } = {}) {
  const result = spawnSync(executable, arguments_, {
    cwd: '/',
    env: environment,
    encoding: 'utf8',
    timeout: TOOL_TIMEOUT_MS,
    maxBuffer: TOOL_MAX_OUTPUT_BYTES,
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.signal || result.status !== 0) {
    const reason = result.error?.code || result.signal || `status ${result.status}`;
    throw new Error(`Trusted host version command failed (${reason}): ${executable}`);
  }
  if (!['stdout', 'stderr'].includes(output)) throw new Error('Trusted host version output selection is invalid');
  const otherOutput = output === 'stdout' ? result.stderr : result.stdout;
  if (otherOutput !== '') {
    throw new Error(`Trusted host version command wrote to its unexpected stream: ${executable}`);
  }
  return result[output].replace(/\r\n/g, '\n').trimEnd();
}

function bytewiseNameSort(left, right) {
  return Buffer.compare(Buffer.from(left.name), Buffer.from(right.name));
}

function safeRelativePath(root, absolutePath) {
  const candidate = relative(root, absolutePath).split(sep).join('/');
  if (
    !candidate
    || candidate === '.'
    || candidate.startsWith('../')
    || candidate.includes('/../')
    || candidate.startsWith('/')
  ) throw new Error(`npm tree path escapes its root: ${absolutePath}`);
  return candidate;
}

function updateManifestDigest(digest, record) {
  const encoded = Buffer.from(JSON.stringify(record));
  digest.update(String(encoded.length));
  digest.update(':');
  digest.update(encoded);
  digest.update('\n');
}

export function computeBoundedNpmTreeDigest(root, limits = TREE_LIMITS) {
  assertAbsoluteCanonicalPath(root, 'npm installation root');
  assertSafeParentChain(root, { includeLeaf: true });
  if (realpathSync(root) !== root) throw new Error('npm installation root must not resolve through a symlink');
  if (!hasExactKeys(limits, ['maxEntries', 'maxFileBytes', 'maxTotalFileBytes', 'maxDepth'])) {
    throw new Error('npm tree limits have unexpected fields');
  }
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`npm tree limit is invalid: ${name}`);
  }

  const digest = createHash('sha256');
  digest.update(`${TREE_FORMAT}\n`);
  const counts = { files: 0, directories: 0, symlinks: 0, entries: 0, contentBytes: 0 };
  const stack = [{ absolute: root, relative: '.', depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    const stat = lstatSync(current.absolute, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`npm tree directory changed type: ${current.absolute}`);
    }
    if ((stat.mode & 0o0022n) !== 0n) {
      throw new Error(`npm tree directory is group/world-writable: ${current.absolute}`);
    }
    counts.directories += 1;
    counts.entries += 1;
    if (counts.entries > limits.maxEntries) throw new Error('npm tree exceeds the entry limit');
    updateManifestDigest(digest, ['directory', current.relative, modeOctal(stat), Number(stat.uid), Number(stat.gid)]);

    const children = readdirSync(current.absolute, { withFileTypes: true }).sort(bytewiseNameSort);
    const pendingDirectories = [];
    for (const child of children) {
      const absolute = join(current.absolute, child.name);
      const relativePath = safeRelativePath(root, absolute);
      const depth = relativePath.split('/').length;
      if (depth > limits.maxDepth) throw new Error(`npm tree exceeds the depth limit: ${relativePath}`);
      const childStat = lstatSync(absolute, { bigint: true });

      if (childStat.isDirectory() && !childStat.isSymbolicLink()) {
        pendingDirectories.push({ absolute, relative: relativePath, depth });
        continue;
      }

      counts.entries += 1;
      if (counts.entries > limits.maxEntries) throw new Error('npm tree exceeds the entry limit');
      if (childStat.isFile() && !childStat.isSymbolicLink()) {
        if ((childStat.mode & 0o0022n) !== 0n) {
          throw new Error(`npm tree file is group/world-writable: ${relativePath}`);
        }
        if (childStat.nlink !== 1n) throw new Error(`npm tree file has an unsafe hard-link count: ${relativePath}`);
        const size = Number(childStat.size);
        if (size > limits.maxFileBytes) throw new Error(`npm tree file exceeds the size limit: ${relativePath}`);
        counts.contentBytes += size;
        if (counts.contentBytes > limits.maxTotalFileBytes) throw new Error('npm tree exceeds the total byte limit');
        const file = hashOpenRegularFile(absolute);
        if (
          file.size_bytes !== size
          || file.uid !== Number(childStat.uid)
          || file.gid !== Number(childStat.gid)
          || file.mode_octal !== modeOctal(childStat)
        ) throw new Error(`npm tree file changed during inspection: ${relativePath}`);
        counts.files += 1;
        updateManifestDigest(digest, [
          'file',
          relativePath,
          file.mode_octal,
          file.uid,
          file.gid,
          file.size_bytes,
          file.sha256,
        ]);
        continue;
      }

      if (childStat.isSymbolicLink()) {
        const target = readlinkSync(absolute);
        if (isAbsolute(target) || target.includes('\0')) {
          throw new Error(`npm tree symlink target is unsafe: ${relativePath}`);
        }
        const resolvedTarget = resolve(dirname(absolute), target);
        const targetRelative = relative(root, resolvedTarget);
        if (!targetRelative || targetRelative === '..' || targetRelative.startsWith(`..${sep}`)) {
          throw new Error(`npm tree symlink escapes its root: ${relativePath}`);
        }
        const resolvedStat = lstatSync(resolvedTarget, { bigint: true });
        if (!resolvedStat.isFile() || resolvedStat.isSymbolicLink()) {
          throw new Error(`npm tree symlink does not point directly to a regular file: ${relativePath}`);
        }
        counts.symlinks += 1;
        updateManifestDigest(digest, [
          'symlink',
          relativePath,
          Number(childStat.uid),
          Number(childStat.gid),
          target,
        ]);
        continue;
      }
      throw new Error(`npm tree contains an unsupported filesystem entry: ${relativePath}`);
    }
    for (let index = pendingDirectories.length - 1; index >= 0; index -= 1) {
      stack.push(pendingDirectories[index]);
    }
  }

  return Object.freeze({
    algorithm: TREE_FORMAT,
    entry_count: counts.entries,
    file_count: counts.files,
    directory_count: counts.directories,
    symlink_count: counts.symlinks,
    content_bytes: counts.contentBytes,
    sha256: digest.digest('hex'),
  });
}

export function computeBoundedJavaRuntimeDigest(root, limits = JAVA_TREE_LIMITS) {
  assertAbsoluteCanonicalPath(root, 'Java runtime root');
  assertSafeParentChain(root, { includeLeaf: true });
  if (realpathSync(root) !== root) throw new Error('Java runtime root must not resolve through a symlink');
  if (!hasExactKeys(limits, ['maxEntries', 'maxFileBytes', 'maxTotalFileBytes', 'maxDepth'])) {
    throw new Error('Java runtime limits have unexpected fields');
  }
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Java runtime limit is invalid: ${name}`);
  }

  const digest = createHash('sha256');
  digest.update(`${JAVA_TREE_FORMAT}\n`);
  const counts = { files: 0, directories: 0, symlinks: 0, entries: 0, contentBytes: 0 };
  const stack = [{ absolute: root, relative: '.', depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    const stat = lstatSync(current.absolute, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Java runtime directory changed type: ${current.absolute}`);
    }
    if ((stat.mode & 0o0022n) !== 0n) {
      throw new Error(`Java runtime directory is group/world-writable: ${current.absolute}`);
    }
    counts.directories += 1;
    counts.entries += 1;
    if (counts.entries > limits.maxEntries) throw new Error('Java runtime exceeds the entry limit');
    updateManifestDigest(digest, ['directory', current.relative, modeOctal(stat), Number(stat.uid), Number(stat.gid)]);

    const children = readdirSync(current.absolute, { withFileTypes: true }).sort(bytewiseNameSort);
    const pendingDirectories = [];
    for (const child of children) {
      const absolute = join(current.absolute, child.name);
      const relativePath = safeRelativePath(root, absolute);
      const depth = relativePath.split('/').length;
      if (depth > limits.maxDepth) throw new Error(`Java runtime exceeds the depth limit: ${relativePath}`);
      const childStat = lstatSync(absolute, { bigint: true });

      if (childStat.isDirectory() && !childStat.isSymbolicLink()) {
        pendingDirectories.push({ absolute, relative: relativePath, depth });
        continue;
      }

      counts.entries += 1;
      if (counts.entries > limits.maxEntries) throw new Error('Java runtime exceeds the entry limit');
      if (childStat.isFile() && !childStat.isSymbolicLink()) {
        if ((childStat.mode & 0o0022n) !== 0n) {
          throw new Error(`Java runtime file is group/world-writable: ${relativePath}`);
        }
        if (childStat.nlink !== 1n) throw new Error(`Java runtime file has an unsafe hard-link count: ${relativePath}`);
        const size = Number(childStat.size);
        if (size > limits.maxFileBytes) throw new Error(`Java runtime file exceeds the size limit: ${relativePath}`);
        counts.contentBytes += size;
        if (counts.contentBytes > limits.maxTotalFileBytes) throw new Error('Java runtime exceeds the total byte limit');
        const file = hashOpenRegularFile(absolute);
        counts.files += 1;
        updateManifestDigest(digest, [
          'file',
          relativePath,
          file.mode_octal,
          file.uid,
          file.gid,
          file.size_bytes,
          file.sha256,
        ]);
        continue;
      }

      if (childStat.isSymbolicLink()) {
        const target = readlinkSync(absolute);
        if (target.includes('\0')) throw new Error(`Java runtime symlink target is unsafe: ${relativePath}`);
        const lexicalTarget = resolve(dirname(absolute), target);
        assertSafeParentChain(lexicalTarget);
        let targetRecord;
        try {
          const targetStat = lstatSync(lexicalTarget, { bigint: true });
          if (targetStat.isSymbolicLink()) {
            if (relativePath !== 'lib/src.zip') {
              throw new Error(`Java runtime symlink has a chained target: ${relativePath}`);
            }
            targetRecord = [
              'known-source-archive-link',
              lexicalTarget,
              Number(targetStat.uid),
              Number(targetStat.gid),
              readlinkSync(lexicalTarget),
            ];
          } else if (targetStat.isFile()) {
            const file = hashOpenRegularFile(lexicalTarget);
            counts.contentBytes += file.size_bytes;
            if (file.size_bytes > limits.maxFileBytes) {
              throw new Error(`Java runtime symlink target exceeds the size limit: ${relativePath}`);
            }
            if (counts.contentBytes > limits.maxTotalFileBytes) {
              throw new Error('Java runtime exceeds the total byte limit');
            }
            targetRecord = [
              'file',
              lexicalTarget,
              file.mode_octal,
              file.uid,
              file.gid,
              file.size_bytes,
              file.sha256,
            ];
          } else if (targetStat.isDirectory() && relativePath === 'docs') {
            assertSafeParentChain(lexicalTarget, { includeLeaf: true });
            targetRecord = [
              'non-runtime-documentation-directory',
              lexicalTarget,
              modeOctal(targetStat),
              Number(targetStat.uid),
              Number(targetStat.gid),
            ];
          } else {
            throw new Error(`Java runtime symlink has an unsupported target: ${relativePath}`);
          }
        } catch (error) {
          if (error?.code === 'ENOENT' && relativePath === 'lib/src.zip') {
            targetRecord = ['known-missing-source-archive', lexicalTarget];
          } else {
            throw error;
          }
        }
        counts.symlinks += 1;
        updateManifestDigest(digest, [
          'symlink',
          relativePath,
          Number(childStat.uid),
          Number(childStat.gid),
          target,
          targetRecord,
        ]);
        continue;
      }
      throw new Error(`Java runtime contains an unsupported filesystem entry: ${relativePath}`);
    }
    for (let index = pendingDirectories.length - 1; index >= 0; index -= 1) {
      stack.push(pendingDirectories[index]);
    }
  }

  return Object.freeze({
    algorithm: JAVA_TREE_FORMAT,
    entry_count: counts.entries,
    file_count: counts.files,
    directory_count: counts.directories,
    symlink_count: counts.symlinks,
    content_bytes: counts.contentBytes,
    sha256: digest.digest('hex'),
  });
}

function assertTreeIdentity(actual, expected, label) {
  if (!hasExactKeys(expected, [
    'algorithm',
    'entry_count',
    'file_count',
    'directory_count',
    'symlink_count',
    'content_bytes',
    'sha256',
  ])) throw new Error(`${label} policy has unexpected fields`);
  if (canonicalHostToolPolicyJson(actual) !== canonicalHostToolPolicyJson(expected)) {
    throw new Error(`${label} identity does not match policy`);
  }
}

export function assertCustodialLinuxAdmissionHostPolicy(policy) {
  if (!hasExactKeys(policy, [
    'android_sdk',
    'schema_version',
    'platform',
    'architecture',
    'node',
    'npm',
    'java',
    'git',
    'unzip',
    'trusted_path',
  ])) throw new Error('Custodial Linux admission host policy has unexpected fields');
  if (
    policy.schema_version !== expectedIdentity.schema_version
    || policy.platform !== expectedIdentity.platform
    || policy.architecture !== expectedIdentity.architecture
    || policy.trusted_path !== expectedIdentity.path
  ) throw new Error('Custodial Linux admission host policy identity is malformed');

  for (const [label, tool, expectedPath, expectedVersion] of [
    ['Node', policy.node, expectedIdentity.nodePath, expectedIdentity.nodeVersion],
    ['Git', policy.git, expectedIdentity.gitPath, expectedIdentity.gitVersion],
    ['unzip', policy.unzip, expectedIdentity.unzipPath, expectedIdentity.unzipVersion],
  ]) {
    if (!hasExactKeys(tool, [
      'path',
      'resolved_path',
      'size_bytes',
      'sha256',
      'uid',
      'gid',
      'mode_octal',
      'version_stdout',
    ])) throw new Error(`${label} policy has unexpected fields`);
    if (
      tool.path !== expectedPath
      || tool.resolved_path !== expectedPath
      || tool.version_stdout !== expectedVersion
      || !Number.isSafeInteger(tool.size_bytes)
      || tool.size_bytes <= 0
      || !/^[a-f0-9]{64}$/.test(tool.sha256)
      || !Number.isSafeInteger(tool.uid)
      || tool.uid < 0
      || !Number.isSafeInteger(tool.gid)
      || tool.gid < 0
      || !/^[0-7]{4}$/.test(tool.mode_octal)
      || (Number.parseInt(tool.mode_octal, 8) & 0o022) !== 0
      || (Number.parseInt(tool.mode_octal, 8) & 0o111) === 0
    ) throw new Error(`${label} policy identity is malformed`);
  }

  if (!hasExactKeys(policy.npm, ['root_path', 'cli_path', 'version_stdout', 'tree'])) {
    throw new Error('npm policy has unexpected fields');
  }
  if (
    policy.npm.root_path !== expectedIdentity.npmRoot
    || policy.npm.cli_path !== expectedIdentity.npmCli
    || policy.npm.version_stdout !== expectedIdentity.npmVersion
  ) throw new Error('npm policy identity is malformed');
  if (!hasExactKeys(policy.npm.tree, [
    'algorithm',
    'entry_count',
    'file_count',
    'directory_count',
    'symlink_count',
    'content_bytes',
    'sha256',
  ])) throw new Error('npm tree policy has unexpected fields');
  if (
    policy.npm.tree.algorithm !== TREE_FORMAT
    || !Number.isSafeInteger(policy.npm.tree.entry_count)
    || policy.npm.tree.entry_count <= 0
    || policy.npm.tree.entry_count > TREE_LIMITS.maxEntries
    || !Number.isSafeInteger(policy.npm.tree.file_count)
    || policy.npm.tree.file_count <= 0
    || !Number.isSafeInteger(policy.npm.tree.directory_count)
    || policy.npm.tree.directory_count <= 0
    || !Number.isSafeInteger(policy.npm.tree.symlink_count)
    || policy.npm.tree.symlink_count < 0
    || !Number.isSafeInteger(policy.npm.tree.content_bytes)
    || policy.npm.tree.content_bytes <= 0
    || policy.npm.tree.content_bytes > TREE_LIMITS.maxTotalFileBytes
    || !/^[a-f0-9]{64}$/.test(policy.npm.tree.sha256)
    || policy.npm.tree.file_count + policy.npm.tree.directory_count + policy.npm.tree.symlink_count
      !== policy.npm.tree.entry_count
  ) throw new Error('npm tree policy identity is malformed');

  if (!hasExactKeys(policy.java, [
    'home_path',
    'path',
    'resolved_path',
    'size_bytes',
    'sha256',
    'uid',
    'gid',
    'mode_octal',
    'version_stderr',
    'runtime_tree',
  ])) throw new Error('Java policy has unexpected fields');
  if (
    policy.java.home_path !== expectedIdentity.javaHome
    || policy.java.path !== expectedIdentity.javaPath
    || policy.java.resolved_path !== expectedIdentity.javaPath
    || policy.java.version_stderr !== expectedIdentity.javaVersion
    || !Number.isSafeInteger(policy.java.size_bytes)
    || policy.java.size_bytes <= 0
    || !/^[a-f0-9]{64}$/.test(policy.java.sha256)
    || !Number.isSafeInteger(policy.java.uid)
    || policy.java.uid < 0
    || !Number.isSafeInteger(policy.java.gid)
    || policy.java.gid < 0
    || !/^[0-7]{4}$/.test(policy.java.mode_octal)
    || (Number.parseInt(policy.java.mode_octal, 8) & 0o022) !== 0
    || (Number.parseInt(policy.java.mode_octal, 8) & 0o111) === 0
  ) throw new Error('Java policy identity is malformed');
  if (!hasExactKeys(policy.java.runtime_tree, [
    'algorithm',
    'entry_count',
    'file_count',
    'directory_count',
    'symlink_count',
    'content_bytes',
    'sha256',
  ])) throw new Error('Java runtime tree policy has unexpected fields');
  if (
    policy.java.runtime_tree.algorithm !== JAVA_TREE_FORMAT
    || !Number.isSafeInteger(policy.java.runtime_tree.entry_count)
    || policy.java.runtime_tree.entry_count <= 0
    || policy.java.runtime_tree.entry_count > JAVA_TREE_LIMITS.maxEntries
    || !Number.isSafeInteger(policy.java.runtime_tree.file_count)
    || policy.java.runtime_tree.file_count <= 0
    || !Number.isSafeInteger(policy.java.runtime_tree.directory_count)
    || policy.java.runtime_tree.directory_count <= 0
    || !Number.isSafeInteger(policy.java.runtime_tree.symlink_count)
    || policy.java.runtime_tree.symlink_count < 0
    || !Number.isSafeInteger(policy.java.runtime_tree.content_bytes)
    || policy.java.runtime_tree.content_bytes <= 0
    || policy.java.runtime_tree.content_bytes > JAVA_TREE_LIMITS.maxTotalFileBytes
    || !/^[a-f0-9]{64}$/.test(policy.java.runtime_tree.sha256)
    || policy.java.runtime_tree.file_count
      + policy.java.runtime_tree.directory_count
      + policy.java.runtime_tree.symlink_count !== policy.java.runtime_tree.entry_count
  ) throw new Error('Java runtime tree policy identity is malformed');

  if (!hasExactKeys(policy.android_sdk, [
    'path',
    'resolved_path',
    'build_tools_directory',
    'uid',
    'gid',
    'mode_octal',
  ])) throw new Error('Android SDK policy has unexpected fields');
  if (
    policy.android_sdk.path !== expectedIdentity.androidSdkRoot
    || policy.android_sdk.resolved_path !== expectedIdentity.androidSdkRoot
    || policy.android_sdk.build_tools_directory !== expectedIdentity.androidBuildToolsDirectory
    || !Number.isSafeInteger(policy.android_sdk.uid)
    || policy.android_sdk.uid < 0
    || !Number.isSafeInteger(policy.android_sdk.gid)
    || policy.android_sdk.gid < 0
    || !/^[0-7]{4}$/.test(policy.android_sdk.mode_octal)
    || (Number.parseInt(policy.android_sdk.mode_octal, 8) & 0o022) !== 0
  ) throw new Error('Android SDK policy identity is malformed');
  return true;
}

function pristineVersionEnvironment(policy) {
  return Object.freeze({
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
  });
}

function loadCanonicalPolicy() {
  const stat = lstatSync(policyPath, { bigint: true });
  // Git checkouts on this single-user host use umask 0002. The clean-HEAD
  // bootstrap binds repository source; reject public write here while the
  // separately pinned host tools and installation trees reject group write.
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o0002n) !== 0n) {
    throw new Error('Custodial Linux admission host policy must be a protected regular file');
  }
  if (stat.size <= 0n || stat.size > BigInt(POLICY_MAX_BYTES)) {
    throw new Error('Custodial Linux admission host policy has an invalid size');
  }
  const bytes = readFileSync(policyPath);
  let policy;
  try {
    policy = JSON.parse(bytes);
  } catch {
    throw new Error('Custodial Linux admission host policy is not valid JSON');
  }
  if (!Buffer.from(canonicalHostToolPolicyJson(policy)).equals(bytes)) {
    throw new Error('Custodial Linux admission host policy is not canonical JSON');
  }
  assertCustodialLinuxAdmissionHostPolicy(policy);
  return { policy, sha256: sha256Bytes(bytes) };
}

export async function verifyCustodialLinuxAdmissionHostTools() {
  assertPristineEntrypoint();
  if (process.platform !== expectedIdentity.platform || process.arch !== expectedIdentity.architecture) {
    throw new Error(`Custodial local admission host requires linux/x64, received ${process.platform}/${process.arch}`);
  }
  if (realpathSync(process.execPath) !== expectedIdentity.nodePath) {
    throw new Error('Custodial local admission must start under the pinned Node executable');
  }
  const loaded = loadCanonicalPolicy();
  const { policy } = loaded;
  assertFileIdentity(hashRunningNodeExecutable(policy.node.path), policy.node, 'Running Node');
  const environment = pristineVersionEnvironment(policy);

  const tools = {};
  for (const [label, definition, executable, versionArguments] of [
    ['Node', policy.node, true, ['--version']],
    ['Git', policy.git, true, ['--version']],
    ['unzip', policy.unzip, true, ['-v']],
  ]) {
    assertSafeParentChain(definition.path);
    if (realpathSync(definition.path) !== definition.resolved_path) {
      throw new Error(`${label} executable resolves outside policy`);
    }
    const firstIdentity = hashOpenRegularFile(definition.path, { executable });
    assertFileIdentity(firstIdentity, definition, label);
    const versionOutput = runVersion(definition.path, versionArguments, environment);
    const selectedVersion = label === 'unzip' ? versionOutput.split('\n')[0] : versionOutput;
    if (selectedVersion !== definition.version_stdout) throw new Error(`${label} version does not match policy`);
    const secondIdentity = hashOpenRegularFile(definition.path, { executable });
    assertFileIdentity(secondIdentity, definition, label);
    tools[label.toLowerCase()] = definition.path;
  }

  assertSafeParentChain(policy.java.home_path, { includeLeaf: true });
  assertSafeParentChain(policy.java.path);
  if (
    realpathSync(policy.java.home_path) !== policy.java.home_path
    || realpathSync(policy.java.path) !== policy.java.resolved_path
  ) throw new Error('Java runtime resolves outside policy');
  const assertJavaExecutable = (actual) => {
    for (const name of ['path', 'size_bytes', 'sha256', 'uid', 'gid', 'mode_octal']) {
      if (actual[name] !== policy.java[name]) throw new Error('Java executable identity does not match policy');
    }
  };
  const firstJavaExecutable = hashOpenRegularFile(policy.java.path, { executable: true });
  assertJavaExecutable(firstJavaExecutable);
  const firstJavaTree = computeBoundedJavaRuntimeDigest(policy.java.home_path);
  assertTreeIdentity(firstJavaTree, policy.java.runtime_tree, 'Java runtime tree');
  const javaVersion = runVersion(policy.java.path, ['-version'], environment, { output: 'stderr' });
  if (javaVersion !== policy.java.version_stderr) throw new Error('Java version does not match policy');
  const secondJavaExecutable = hashOpenRegularFile(policy.java.path, { executable: true });
  assertJavaExecutable(secondJavaExecutable);
  const secondJavaTree = computeBoundedJavaRuntimeDigest(policy.java.home_path);
  assertTreeIdentity(secondJavaTree, policy.java.runtime_tree, 'Java runtime tree');
  tools.java = policy.java.path;

  assertSafeParentChain(policy.android_sdk.path, { includeLeaf: true });
  assertSafeParentChain(policy.android_sdk.build_tools_directory, { includeLeaf: true });
  if (
    realpathSync(policy.android_sdk.path) !== policy.android_sdk.resolved_path
    || realpathSync(policy.android_sdk.build_tools_directory) !== policy.android_sdk.build_tools_directory
  ) throw new Error('Android SDK resolves outside policy');
  const androidSdkStat = lstatSync(policy.android_sdk.path, { bigint: true });
  if (
    !androidSdkStat.isDirectory()
    || androidSdkStat.isSymbolicLink()
    || Number(androidSdkStat.uid) !== policy.android_sdk.uid
    || Number(androidSdkStat.gid) !== policy.android_sdk.gid
    || modeOctal(androidSdkStat) !== policy.android_sdk.mode_octal
  ) throw new Error('Android SDK root identity does not match policy');

  assertSafeParentChain(policy.npm.root_path, { includeLeaf: true });
  assertSafeParentChain(policy.npm.cli_path);
  if (realpathSync(policy.npm.root_path) !== policy.npm.root_path) {
    throw new Error('npm installation root resolves through a symlink');
  }
  if (realpathSync(policy.npm.cli_path) !== policy.npm.cli_path) {
    throw new Error('npm CLI resolves through a symlink');
  }
  const firstTree = computeBoundedNpmTreeDigest(policy.npm.root_path);
  assertTreeIdentity(firstTree, policy.npm.tree, 'npm installation tree');
  const npmVersion = runVersion(policy.node.path, [policy.npm.cli_path, '--version'], environment);
  if (npmVersion !== policy.npm.version_stdout) throw new Error('npm version does not match policy');
  const secondTree = computeBoundedNpmTreeDigest(policy.npm.root_path);
  assertTreeIdentity(secondTree, policy.npm.tree, 'npm installation tree');

  const result = {
    schema_version: 1,
    policy_path: policyPath,
    policy_sha256: loaded.sha256,
    platform: process.platform,
    architecture: process.arch,
    paths: {
      node: tools.node,
      npm_cli: policy.npm.cli_path,
      java: tools.java,
      java_home: policy.java.home_path,
      android_sdk_root: policy.android_sdk.path,
      android_build_tools_directory: policy.android_sdk.build_tools_directory,
      git: tools.git,
      unzip: tools.unzip,
    },
    npm_command: {
      executable: tools.node,
      arguments_prefix: [policy.npm.cli_path],
    },
    trusted_path: policy.trusted_path,
    environment,
    npm_tree: secondTree,
    java_runtime_tree: secondJavaTree,
    proof: {
      schema_id: 'urn:memphis-zoo:custodial-linux-admission-host-tools:v1',
      schema_version: 1,
      policy_sha256: loaded.sha256,
      platform: process.platform,
      architecture: process.arch,
      pristine_entrypoint: true,
      node: {
        path: policy.node.path,
        version: policy.node.version_stdout,
        sha256: policy.node.sha256,
      },
      npm: {
        cli_path: policy.npm.cli_path,
        version: policy.npm.version_stdout,
        tree_sha256: secondTree.sha256,
      },
      java: {
        home_path: policy.java.home_path,
        path: policy.java.path,
        version: policy.java.version_stderr.split('\n')[0],
        executable_sha256: policy.java.sha256,
        runtime_tree_sha256: secondJavaTree.sha256,
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
    },
  };
  const frozenResult = deepFreeze(result);
  verifiedHostResults.add(frozenResult);
  return frozenResult;
}

export function createCustodialAdmissionHostEnvironment(verifiedHost, additions = {}) {
  if (!verifiedHostResults.has(verifiedHost)) {
    throw new Error('A verified Custodial admission host result is required');
  }
  if (!additions || typeof additions !== 'object' || Array.isArray(additions)) {
    throw new Error('Custodial admission environment additions must be an object');
  }
  const allowedAdditionNames = new Set(['CODEMAGIC_API_TOKEN', 'TMPDIR']);
  for (const [name, value] of Object.entries(additions)) {
    if (!allowedAdditionNames.has(name)) throw new Error(`Custodial admission environment addition is not allowed: ${name}`);
    if (typeof value !== 'string' || value.length === 0 || value.length > 8_192 || /[\0\r\n]/.test(value)) {
      throw new Error(`Custodial admission environment addition is malformed: ${name}`);
    }
    if (name === 'TMPDIR' && (!isAbsolute(value) || resolve(value) !== value)) {
      throw new Error('Custodial admission TMPDIR must be an absolute canonical path');
    }
    if (name === 'TMPDIR') {
      const stat = lstatSync(value, { bigint: true });
      if (
        !stat.isDirectory()
        || stat.isSymbolicLink()
        || realpathSync(value) !== value
        || Number(stat.uid) !== process.getuid()
        || (stat.mode & 0o0077n) !== 0n
      ) {
        throw new Error('Custodial admission TMPDIR must be a protected directory owned by this user');
      }
    }
  }
  return deepFreeze({ ...verifiedHost.environment, ...additions });
}

export const custodialLinuxAdmissionHostToolInternals = Object.freeze({
  expectedIdentity,
  policyPath,
  treeLimits: TREE_LIMITS,
  javaTreeLimits: JAVA_TREE_LIMITS,
  hashOpenRegularFile,
  hashRunningNodeExecutable,
  assertPristineEntrypoint,
  forbiddenEntrypointEnvironment,
  pristineVersionEnvironment,
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verified = await verifyCustodialLinuxAdmissionHostTools();
  process.stdout.write(`${JSON.stringify({
    schema_version: verified.schema_version,
    policy_sha256: verified.policy_sha256,
    platform: verified.platform,
    architecture: verified.architecture,
    node: verified.paths.node,
    npm_cli: verified.paths.npm_cli,
    java: verified.paths.java,
    java_home: verified.paths.java_home,
    android_sdk_root: verified.paths.android_sdk_root,
    android_build_tools_directory: verified.paths.android_build_tools_directory,
    git: verified.paths.git,
    unzip: verified.paths.unzip,
    npm_tree_sha256: verified.npm_tree.sha256,
    java_runtime_tree_sha256: verified.java_runtime_tree.sha256,
  })}\n`);
}
