import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parent = join(root, 'build', 'custodial-codemagic-admission');
function inspect(path, privateToOwner = false) {
  const stat = lstatSync(path);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Fixture path must be a real directory');
  assert.equal(realpathSync(path), path, 'Fixture path must not traverse a symlink');
  if (typeof process.getuid === 'function') assert.equal(stat.uid, process.getuid());
  if (privateToOwner) assert.equal(stat.mode & 0o077, 0);
  return stat;
}
function ensure(path, privateToOwner = false) {
  try { mkdirSync(path, { mode: 0o700 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return inspect(path, privateToOwner);
}

export function withCustodialRuntimeFixture(check) {
  assert.equal(typeof check, 'function');
  inspect(root); ensure(join(root, 'build')); ensure(parent, true);
  const pending = join(parent, `.pending-${randomBytes(12).toString('hex')}-${randomBytes(3).toString('hex')}`);
  mkdirSync(pending, { mode: 0o700 });
  const identity = inspect(pending, true);
  try {
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root,
      encoding: 'utf8', timeout: 5000, maxBuffer: 1024 }).trim();
    const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root,
      encoding: 'utf8', timeout: 5000, maxBuffer: 1024 }).trim();
    const dist = join(pending, 'mobile-dist');
    // Deliberately generate fresh exact-source output. Never reuse ignored output.
    execFileSync(process.execPath, [join(root, 'mobile/scripts/build.mjs')], {
      cwd: root, encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL',
      maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'America/Chicago',
        MZ_APP_EDITION: 'custodial', MZ_API_BASE: 'https://memphis-zoo-mcp.onrender.com',
        MZ_MOBILE_DIST: relative(root, dist).replaceAll('\\', '/'),
        MZ_SOURCE_COMMIT: sourceCommit, MZ_SHELL_START: '1', PROJECT_BUILD_NUMBER: '1' },
    });
    const manifest = JSON.parse(readFileSync(join(dist, 'runtime-asset-manifest.json'), 'utf8'));
    assert.equal(manifest.source_commit, sourceCommit);
    assert.equal(manifest.source_tree, sourceTree);
    assert.equal(manifest.source_commit_exact, true);
    assert.equal(manifest.edition, 'custodial');
    check(dist);
  } finally {
    const current = inspect(pending, true);
    assert.equal(current.dev, identity.dev);
    assert.equal(current.ino, identity.ino);
    rmSync(pending, { recursive: true, force: false });
  }
}
