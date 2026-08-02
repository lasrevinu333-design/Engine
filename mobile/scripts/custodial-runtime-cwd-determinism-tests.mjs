import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const repoRoot = resolve(mobileRoot, '..');
const buildRoot = join(repoRoot, 'build');
const admissionParent = join(buildRoot, 'custodial-codemagic-admission');
const buildScript = join(mobileRoot, 'scripts', 'build.mjs');
const MAX_RUNTIME_ENTRIES = 512;
const MAX_RUNTIME_BYTES = 128 * 1024 * 1024;

async function inspectDirectory(path, label, { expectedParent = null, privateToOwner = false } = {}) {
  if (expectedParent !== null) assert.equal(dirname(path), expectedParent, `${label} has an unexpected parent`);
  const stat = await lstat(path);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a real directory`);
  assert.equal(await realpath(path), path, `${label} must not traverse a symlink`);
  if (typeof process.getuid === 'function') assert.equal(stat.uid, process.getuid(), `${label} must be owned by this user`);
  if (privateToOwner) assert.equal(stat.mode & 0o077, 0, `${label} must be private to its owner`);
  return stat;
}

async function ensureAdmissionParent() {
  await inspectDirectory(repoRoot, 'repository root');
  try {
    await mkdir(buildRoot, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  await inspectDirectory(buildRoot, 'build directory', { expectedParent: repoRoot });
  try {
    await mkdir(admissionParent, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  await inspectDirectory(admissionParent, 'admission parent', {
    expectedParent: buildRoot,
    privateToOwner: true,
  });
}

async function createPrivatePendingDirectory(label) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const name = `.pending-${randomBytes(12).toString('hex')}-${randomBytes(3).toString('hex')}`;
    const path = join(admissionParent, name);
    try {
      await mkdir(path, { mode: 0o700 });
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      throw error;
    }
    const stat = await inspectDirectory(path, label, {
      expectedParent: admissionParent,
      privateToOwner: true,
    });
    return { path, identity: { dev: stat.dev, ino: stat.ino, uid: stat.uid } };
  }
  assert.fail(`Unable to allocate a unique ${label}`);
}

async function removeOwnedPendingDirectory(pending) {
  assert.equal(dirname(pending.path), admissionParent, 'Refusing to clean a non-admission path');
  assert.match(
    basename(pending.path),
    /^\.pending-[a-f0-9]{24}-[a-f0-9]{6}$/,
    'Refusing to clean an untrusted admission child',
  );
  const stat = await inspectDirectory(pending.path, 'pending cleanup directory', {
    expectedParent: admissionParent,
    privateToOwner: true,
  });
  assert.deepEqual(
    { dev: stat.dev, ino: stat.ino, uid: stat.uid },
    pending.identity,
    'Refusing to clean a replaced admission directory',
  );
  await rm(pending.path, { recursive: true, force: false });
}

async function distributionHashes(directory) {
  const hashes = new Map();
  let entryCount = 0;
  let totalBytes = 0;
  async function walk(current, prefix = '', depth = 0) {
    assert(depth <= 16, 'Runtime directory nesting exceeds its test bound');
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      entryCount += 1;
      assert(entryCount <= MAX_RUNTIME_ENTRIES, 'Runtime entry count exceeds its test bound');
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath, path, depth + 1);
      } else if (entry.isFile()) {
        const stat = await lstat(absolutePath);
        assert(stat.isFile() && !stat.isSymbolicLink(), `Runtime file changed during inspection: ${path}`);
        totalBytes += stat.size;
        assert(totalBytes <= MAX_RUNTIME_BYTES, 'Runtime byte count exceeds its test bound');
        const bytes = await readFile(absolutePath);
        assert.equal(bytes.length, stat.size, `Runtime file changed during hashing: ${path}`);
        hashes.set(path, createHash('sha256').update(bytes).digest('hex'));
      } else {
        assert.fail(`Runtime contains unsupported filesystem entry: ${path}`);
      }
    }
  }
  await walk(directory);
  return hashes;
}

const gitResult = await execute('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 1024,
  timeout: 10_000,
});
const sourceCommit = gitResult.stdout.trim().toLowerCase();
assert.match(sourceCommit, /^[a-f0-9]{40}$/);
const releaseManifest = JSON.parse(await readFile(join(repoRoot, 'frontend-release-manifest.json'), 'utf8'));
assert.equal(typeof releaseManifest.release_id, 'string');

async function buildFrom(cwd, pendingDirectory) {
  const relativeDist = relative(repoRoot, join(pendingDirectory.path, 'mobile-dist')).replaceAll('\\', '/');
  assert.match(
    relativeDist,
    /^build\/custodial-codemagic-admission\/\.pending-[a-f0-9]{24}-[a-f0-9]{6}\/mobile-dist$/,
  );
  const environment = {
    ...process.env,
    MZ_API_BASE: 'https://memphis-zoo-mcp.onrender.com',
    MZ_APP_EDITION: 'custodial',
    MZ_MOBILE_DIST: relativeDist,
    MZ_RELEASE_ID: releaseManifest.release_id,
    MZ_RELEASE_VERSION: '1.0.0',
    MZ_SHELL_START: '1',
    MZ_SOURCE_COMMIT: sourceCommit,
    PROJECT_BUILD_NUMBER: '1',
  };
  delete environment.MZ_CUSTODIAL_BROWSER_TEST;
  await execute(process.execPath, [buildScript], {
    cwd,
    env: environment,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: 180_000,
  });
  return distributionHashes(join(pendingDirectory.path, 'mobile-dist'));
}

await ensureAdmissionParent();
const pendingDirectories = [];
let rootPending;
let mobilePending;

try {
  rootPending = await createPrivatePendingDirectory('root-cwd pending directory');
  pendingDirectories.push(rootPending);
  mobilePending = await createPrivatePendingDirectory('mobile-cwd pending directory');
  pendingDirectories.push(mobilePending);
  const rootHashes = await buildFrom(repoRoot, rootPending);
  const mobileHashes = await buildFrom(mobileRoot, mobilePending);
  assert.deepEqual(
    Object.fromEntries(rootHashes),
    Object.fromEntries(mobileHashes),
    'Custodial runtime bytes must not depend on the process working directory',
  );

  const rootDist = join(rootPending.path, 'mobile-dist');
  const graph = JSON.parse(await readFile(join(rootDist, 'shell-edition-module-graph.json'), 'utf8'));
  assert(Array.isArray(graph.modules), 'Custodial module graph must contain modules');
  for (const expected of ['virtual:vite/modulepreload-polyfill.js', 'virtual:vite/preload-helper.js']) {
    assert(graph.modules.includes(expected), `Custodial provenance must retain ${expected}`);
  }
  for (const excluded of [
    'rolldown/runtime.js',
    'mobile/rolldown/runtime.js',
    'virtual:rolldown/runtime.js',
    'vite/modulepreload-polyfill.js',
    'mobile/vite/modulepreload-polyfill.js',
    'vite/preload-helper.js',
    'mobile/vite/preload-helper.js',
  ]) assert.equal(graph.modules.includes(excluded), false, `Custodial provenance must exclude ${excluded}`);

  const nativeLayout = await readFile(join(rootDist, 'memphis-native-layout.js'), 'utf8');
  const interactionFeedback = await readFile(join(rootDist, 'memphis-interaction-feedback.js'), 'utf8');
  const custodialApp = await readFile(join(rootDist, 'mobile-custodial.js'), 'utf8');
  assert.match(nativeLayout, /\/\/ src\/shared\/native-layout\.js/);
  assert.match(interactionFeedback, /\/\/ src\/shared\/interaction-feedback\.js/);
  assert.match(custodialApp, /\/\/ src\/custodial\/app\.js/);
  assert.match(custodialApp, /\/\/ \.\.\/node_modules\//);
  for (const bytes of [nativeLayout, interactionFeedback, custodialApp]) {
    assert.doesNotMatch(bytes, /\/\/ mobile\/(?:src|node_modules)\//);
  }
} finally {
  const cleanupFailures = [];
  for (const pending of pendingDirectories.reverse()) {
    try {
      await removeOwnedPendingDirectory(pending);
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
  if (cleanupFailures.length) {
    throw new AggregateError(cleanupFailures, 'Unable to safely clean Custodial determinism fixtures');
  }
}

console.log('Custodial runtime working-directory determinism tests passed.');
