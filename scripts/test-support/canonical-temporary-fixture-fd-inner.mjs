import assert from 'node:assert/strict';
import {
  mkdtemp,
  open,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanonicalTemporaryFixture } from '../canonical-temporary-fixture.mjs';

const MAX_FILLER_HANDLES = 128;

async function closeAll(handles) {
  while (handles.length > 0) {
    const handle = handles.pop();
    try {
      await handle.close();
    } catch (error) {
      if (error?.code !== 'EBADF') throw error;
    }
  }
}

async function exhaustFileDescriptors() {
  const handles = [];
  while (handles.length < MAX_FILLER_HANDLES) {
    try {
      handles.push(await open('/dev/null', 'r'));
    } catch (error) {
      if (error?.code === 'EMFILE') return handles;
      throw error;
    }
  }
  await closeAll(handles);
  throw new Error('FD regression must run with a soft descriptor limit below 128');
}

async function release(handles, count) {
  for (let index = 0; index < count; index += 1) {
    assert.ok(handles.length > 0, 'FD regression exhausted too few filler handles');
    await handles.pop().close();
  }
}

const fixtureParent = await realpath(await mkdtemp(join(
  await realpath(tmpdir()),
  'canonical-fixture-fd-contract-',
)));
try {
  {
    const handles = await exhaustFileDescriptors();
    try {
      await release(handles, 1);
      await assert.rejects(
        createCanonicalTemporaryFixture('one-fd-child-', { temporaryParent: fixtureParent }),
        (error) => ['EMFILE', 'ENFILE'].includes(error?.code),
        'one available descriptor must fail before mkdtemp rather than leak a partial fixture',
      );
    } finally {
      await closeAll(handles);
    }
    assert.deepEqual(await readdir(fixtureParent), []);
  }

  {
    const handles = await exhaustFileDescriptors();
    let fixture = null;
    try {
      await release(handles, 2);
      fixture = await createCanonicalTemporaryFixture(
        'two-fd-child-',
        { temporaryParent: fixtureParent },
      );
      await release(handles, 1);
      await fixture.dispose();
      fixture = null;
    } finally {
      await closeAll(handles);
    }
    assert.equal(fixture, null, 'two available descriptors must recover and dispose cleanly');
    assert.deepEqual(await readdir(fixtureParent), []);
  }
} finally {
  await rm(fixtureParent, { recursive: true, force: false });
}

console.log('Canonical temporary fixture FD exhaustion tests passed.');
