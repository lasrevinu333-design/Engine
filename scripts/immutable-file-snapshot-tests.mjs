import assert from 'node:assert/strict';
import {
  chmodSync,
  lstatSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertImmutableFileSnapshot,
  createImmutableFileSnapshot,
  disposeImmutableFileSnapshot,
} from '../mobile/scripts/immutable-file-snapshot.mjs';

const fixtureRoot = await mkdtemp(join(tmpdir(), 'immutable-apk-snapshot-test-'));
try {
  const source = join(fixtureRoot, 'signed-release.apk');
  const original = Buffer.concat([
    Buffer.from('signed-release-fixture\n'),
    Buffer.alloc(2 * 1024 * 1024, 0xa5),
  ]);
  await writeFile(source, original);
  const snapshot = createImmutableFileSnapshot(source);
  try {
    assert.equal(assertImmutableFileSnapshot(snapshot), true);
    assert.equal(lstatSync(snapshot.directory).mode & 0o777, 0o700);
    assert.equal(lstatSync(snapshot.path).mode & 0o777, 0o400);
    assert.deepEqual(await readFile(snapshot.path), original);

    await writeFile(source, 'replaced after snapshot');
    assert.equal(
      assertImmutableFileSnapshot(snapshot),
      true,
      'changes to the caller-controlled source path must not affect the reviewed snapshot',
    );

    chmodSync(snapshot.path, 0o600);
    assert.throws(
      () => assertImmutableFileSnapshot(snapshot),
      /metadata changed after creation/,
      'permission or ctime changes must invalidate the snapshot',
    );
  } finally {
    disposeImmutableFileSnapshot(snapshot);
  }
  assert.equal(lstatSync(fixtureRoot).isDirectory(), true);

  const symlink = join(fixtureRoot, 'symlink.apk');
  symlinkSync(source, symlink);
  assert.throws(
    () => createImmutableFileSnapshot(symlink),
    /ELOOP|symbolic|regular file/i,
    'the source must be opened with no-follow semantics',
  );

  const tamperSource = join(fixtureRoot, 'tamper.apk');
  writeFileSync(tamperSource, 'tamper fixture');
  const tampered = createImmutableFileSnapshot(tamperSource);
  try {
    chmodSync(tampered.path, 0o600);
    writeFileSync(tampered.path, 'changed bytes');
    chmodSync(tampered.path, 0o400);
    assert.throws(
      () => assertImmutableFileSnapshot(tampered),
      /metadata changed after creation|bytes changed after creation/,
    );
  } finally {
    disposeImmutableFileSnapshot(tampered);
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log('Immutable file snapshot tests passed.');

