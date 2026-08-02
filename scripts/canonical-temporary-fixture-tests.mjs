import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalTemporaryFixture } from './canonical-temporary-fixture.mjs';

for (const unsafePrefix of ['', '.', '..', '../escape-', 'bad/prefix-', ' bad-', `bad\0prefix-`, 'a'.repeat(129)]) {
  await assert.rejects(
    createCanonicalTemporaryFixture(unsafePrefix),
    /prefix is unsafe/,
  );
}

const outerFixture = await createCanonicalTemporaryFixture('canonical-fixture-contract-');
try {
  const realTemporaryParent = join(outerFixture.root, 'real-parent');
  const aliasedTemporaryParent = join(outerFixture.root, 'aliased-parent');
  await mkdir(realTemporaryParent, { mode: 0o700 });
  await symlink(realTemporaryParent, aliasedTemporaryParent, 'dir');
  assert.notEqual(
    aliasedTemporaryParent,
    await realpath(aliasedTemporaryParent),
    'the regression parent must exercise a genuinely aliased path',
  );

  const aliasedFixture = await createCanonicalTemporaryFixture(
    'canonical-child-',
    { temporaryParent: aliasedTemporaryParent },
  );
  assert.equal(dirname(aliasedFixture.root), realTemporaryParent);
  assert.equal(await realpath(aliasedFixture.root), aliasedFixture.root);
  const aliasedFixtureStat = await lstat(aliasedFixture.root, { bigint: true });
  assert.equal(aliasedFixtureStat.mode & 0o777n, 0o700n);
  assert.equal(aliasedFixtureStat.uid, BigInt(process.getuid()));

  const outsideSentinel = join(outerFixture.root, 'outside-sentinel.txt');
  await writeFile(outsideSentinel, 'must survive fixture disposal\n');
  await symlink(outsideSentinel, join(aliasedFixture.root, 'outside-link'));
  await aliasedFixture.dispose();
  assert.equal(await readFile(outsideSentinel, 'utf8'), 'must survive fixture disposal\n');
  await assert.rejects(aliasedFixture.dispose(), /not active \(disposed\)/);

  const replacedFixture = await createCanonicalTemporaryFixture(
    'replace-child-',
    { temporaryParent: aliasedTemporaryParent },
  );
  const originalRoot = `${replacedFixture.root}.original`;
  await rename(replacedFixture.root, originalRoot);
  await mkdir(replacedFixture.root, { mode: 0o700 });
  const replacementMarker = join(replacedFixture.root, 'replacement-marker.txt');
  await writeFile(replacementMarker, 'must not be removed\n');
  await assert.rejects(replacedFixture.dispose(), /identity changed/);
  assert.equal(await readFile(replacementMarker, 'utf8'), 'must not be removed\n');
  await rm(replacedFixture.root, { recursive: true, force: false });
  await rm(originalRoot, { recursive: true, force: false });

  const reusedInodeFixture = await createCanonicalTemporaryFixture(
    'reused-inode-child-',
    { temporaryParent: aliasedTemporaryParent },
  );
  await rm(reusedInodeFixture.root, { recursive: true, force: false });
  await mkdir(reusedInodeFixture.root, { mode: 0o700 });
  const reusedInodeMarker = join(reusedInodeFixture.root, 'replacement-marker.txt');
  await writeFile(reusedInodeMarker, 'inode-reuse replacement must not be removed\n');
  await assert.rejects(reusedInodeFixture.dispose(), /identity changed/);
  assert.equal(
    await readFile(reusedInodeMarker, 'utf8'),
    'inode-reuse replacement must not be removed\n',
  );
  await rm(reusedInodeFixture.root, { recursive: true, force: false });

  const symlinkReplacementFixture = await createCanonicalTemporaryFixture(
    'symlink-replacement-child-',
    { temporaryParent: aliasedTemporaryParent },
  );
  const symlinkReplacementTarget = join(outerFixture.root, 'symlink-replacement-target');
  await mkdir(symlinkReplacementTarget, { mode: 0o700 });
  const symlinkReplacementMarker = join(symlinkReplacementTarget, 'marker.txt');
  await writeFile(symlinkReplacementMarker, 'symlink target must not be removed\n');
  await rm(symlinkReplacementFixture.root, { recursive: true, force: false });
  await symlink(symlinkReplacementTarget, symlinkReplacementFixture.root, 'dir');
  await assert.rejects(symlinkReplacementFixture.dispose(), /path identity changed/);
  assert.equal(
    await readFile(symlinkReplacementMarker, 'utf8'),
    'symlink target must not be removed\n',
  );
  await unlink(symlinkReplacementFixture.root);

  const concurrentDisposeFixture = await createCanonicalTemporaryFixture(
    'concurrent-dispose-child-',
    { temporaryParent: aliasedTemporaryParent },
  );
  await writeFile(join(concurrentDisposeFixture.root, 'fixture.txt'), 'fixture\n');
  const concurrentResults = await Promise.allSettled([
    concurrentDisposeFixture.dispose(),
    concurrentDisposeFixture.dispose(),
  ]);
  assert.deepEqual(
    concurrentResults.map(({ status }) => status).sort(),
    ['fulfilled', 'rejected'],
  );
  assert.match(
    concurrentResults.find(({ status }) => status === 'rejected').reason.message,
    /not active \(disposing\)/,
  );

  const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
  for (const [script, marker] of [
    ['immutable-file-snapshot-tests.mjs', 'Immutable file snapshot tests passed.'],
    ['custodial-runtime-source-verifier-tests.mjs', 'Custodial clean runtime-source verifier tests passed.'],
  ]) {
    const output = execFileSync(
      process.execPath,
      [fileURLToPath(new URL(`./${script}`, import.meta.url))],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_DISABLE_COMPILE_CACHE: '1',
          TMPDIR: aliasedTemporaryParent,
        },
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
      },
    );
    assert.match(output, new RegExp(marker.replaceAll('.', '\\.')));
    assert.deepEqual(
      await readdir(realTemporaryParent),
      [],
      `${script} must not leave a temporary fixture behind`,
    );
  }

  const descriptorOutput = execFileSync(
    '/bin/bash',
    [
      '-c',
      'ulimit -n 64\nexec "$1" "$2"',
      'canonical-fixture-fd-regression',
      process.execPath,
      fileURLToPath(new URL('./test-support/canonical-temporary-fixture-fd-inner.mjs', import.meta.url)),
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_DISABLE_COMPILE_CACHE: '1',
        TMPDIR: aliasedTemporaryParent,
      },
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
    },
  );
  assert.match(
    descriptorOutput,
    /Canonical temporary fixture FD exhaustion tests passed\./,
  );
  assert.deepEqual(
    await readdir(realTemporaryParent),
    [],
    'FD exhaustion regressions must not leave a temporary fixture behind',
  );

  const umaskOutput = execFileSync(
    '/bin/bash',
    [
      '-c',
      'umask 0777\nexec "$1" "$2"',
      'canonical-fixture-umask-regression',
      process.execPath,
      fileURLToPath(new URL('./test-support/canonical-temporary-fixture-umask-inner.mjs', import.meta.url)),
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_DISABLE_COMPILE_CACHE: '1',
        TMPDIR: aliasedTemporaryParent,
      },
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
    },
  );
  assert.match(
    umaskOutput,
    /Canonical temporary fixture restrictive-umask tests passed\./,
  );
  assert.deepEqual(
    await readdir(realTemporaryParent),
    [],
    'restrictive-umask regression must not leave a temporary fixture behind',
  );
} finally {
  await outerFixture.dispose();
}

console.log('Canonical temporary fixture tests passed.');
