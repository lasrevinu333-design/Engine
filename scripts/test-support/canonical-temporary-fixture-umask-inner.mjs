import assert from 'node:assert/strict';
import { readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createCanonicalTemporaryFixture } from '../canonical-temporary-fixture.mjs';

assert.notEqual(process.umask() & 0o700, 0, 'umask regression requires masked owner permissions');
await assert.rejects(
  createCanonicalTemporaryFixture('masked-umask-child-'),
  /owner-accessible process umask permissions/,
);
assert.deepEqual(
  await readdir(await realpath(tmpdir())),
  [],
  'an unsafe inherited umask must fail before creating a fixture',
);

console.log('Canonical temporary fixture restrictive-umask tests passed.');
