import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import {
  lstat,
  mkdtemp,
  open,
  realpath,
  rename,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const SAFE_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIRECTORY_PERMISSIONS = 0o700n;
const QUARANTINE_ATTEMPTS = 8;

function identity(stat) {
  return Object.freeze({
    dev: stat.dev,
    ino: stat.ino,
    uid: stat.uid,
    gid: stat.gid,
    mode: stat.mode,
    birthtimeNs: stat.birthtimeNs ?? 0n,
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.uid === right.uid
    && left.gid === right.gid
    && left.mode === right.mode
    && left.birthtimeNs === right.birthtimeNs;
}

function assertSafePrefix(prefix) {
  const value = String(prefix || '');
  if (!SAFE_PREFIX.test(value) || basename(value) !== value || value === '.' || value === '..') {
    throw new Error('Canonical temporary fixture prefix is unsafe');
  }
  return value;
}

function assertRealDirectory(stat, label) {
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be one real directory`);
  }
}

function assertOwnedProtectedDirectory(stat, expectedUid, label) {
  assertRealDirectory(stat, label);
  if (stat.uid !== expectedUid || (stat.mode & 0o777n) !== DIRECTORY_PERMISSIONS) {
    throw new Error(`${label} must be owner-only`);
  }
}

function assertOwnedDirectory(stat, expectedUid, label) {
  assertRealDirectory(stat, label);
  if (stat.uid !== expectedUid) throw new Error(`${label} must be owned by the current user`);
}

function directoryOpenFlags() {
  for (const [name, value] of [
    ['O_DIRECTORY', constants.O_DIRECTORY],
    ['O_NOFOLLOW', constants.O_NOFOLLOW],
  ]) {
    if (!Number.isInteger(value)) {
      throw new Error(`Canonical temporary fixtures require ${name} support`);
    }
  }
  return constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function assertAbsent(path) {
  if (await pathExists(path)) {
    throw new Error('Canonical temporary fixture remained after disposal');
  }
}

async function assertDirectoryPath({
  path,
  expectedIdentity,
  expectedUid = null,
  expectedParent = null,
  label,
}) {
  if (await realpath(path) !== path) throw new Error(`${label} path identity changed`);
  if (expectedParent !== null && dirname(path) !== expectedParent) {
    throw new Error(`${label} escaped its expected parent`);
  }
  const pathStat = await lstat(path, { bigint: true });
  assertRealDirectory(pathStat, label);
  if (!sameIdentity(identity(pathStat), expectedIdentity)) {
    throw new Error(`${label} identity changed`);
  }
  if (expectedUid !== null) {
    assertOwnedProtectedDirectory(pathStat, expectedUid, label);
  }
  return pathStat;
}

async function assertPinnedDirectory(options) {
  const { handle, expectedIdentity, expectedUid = null, label } = options;
  await assertDirectoryPath(options);
  const handleStat = await handle.stat({ bigint: true });
  assertRealDirectory(handleStat, label);
  if (!sameIdentity(identity(handleStat), expectedIdentity)) {
    throw new Error(`${label} handle identity changed`);
  }
  if (expectedUid !== null) {
    assertOwnedProtectedDirectory(handleStat, expectedUid, label);
  }
}

async function unusedQuarantinePath(canonicalParent, rootName) {
  for (let attempt = 0; attempt < QUARANTINE_ATTEMPTS; attempt += 1) {
    const candidate = join(
      canonicalParent,
      `.${rootName}.disposing-${randomBytes(16).toString('hex')}`,
    );
    if (!await pathExists(candidate)) return candidate;
  }
  throw new Error('Could not reserve a unique temporary-fixture quarantine path');
}

async function removePinnedDirectory({
  canonicalParent,
  parentHandle,
  parentIdentity,
  root,
  rootHandle,
  rootIdentity,
  expectedUid,
}) {
  // This is test-fixture cleanup for a trusted, isolated CI process. Retained
  // handles, a random quarantine name, and identity checks prevent stale or
  // accidental path substitution. Node does not expose fd-relative unlinkat,
  // so an actively hostile same-UID process racing the final path-based rm is
  // outside this helper's threat model; such a process could already mutate
  // the checkout and toolchain under test.
  const parentAssertion = {
    path: canonicalParent,
    expectedIdentity: parentIdentity,
    label: 'Canonical temporary fixture parent',
  };
  if (parentHandle) {
    await assertPinnedDirectory({ handle: parentHandle, ...parentAssertion });
  } else {
    await assertDirectoryPath(parentAssertion);
  }
  await assertPinnedDirectory({
    handle: rootHandle,
    path: root,
    expectedIdentity: rootIdentity,
    expectedUid,
    expectedParent: canonicalParent,
    label: 'Canonical temporary fixture',
  });

  const quarantine = await unusedQuarantinePath(canonicalParent, basename(root));
  await rename(root, quarantine);
  const replacementAppeared = await pathExists(root);
  await assertPinnedDirectory({
    handle: rootHandle,
    path: quarantine,
    expectedIdentity: rootIdentity,
    expectedUid,
    expectedParent: canonicalParent,
    label: 'Quarantined temporary fixture',
  });
  await rm(quarantine, { recursive: true, force: false });
  await assertAbsent(quarantine);
  const pinnedAfterRemoval = await rootHandle.stat({ bigint: true });
  if (!sameIdentity(identity(pinnedAfterRemoval), rootIdentity)) {
    throw new Error('Pinned temporary fixture identity changed during disposal');
  }
  if (replacementAppeared) {
    throw new Error('A replacement appeared at the temporary fixture path during disposal');
  }
}

async function closeHandles(handles, operationError = null) {
  const errors = operationError ? [operationError] : [];
  for (const handle of handles) {
    if (!handle) continue;
    try {
      await handle.close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Temporary fixture operation and handle cleanup failed');
  }
}

export async function createCanonicalTemporaryFixture(
  prefix,
  { temporaryParent = tmpdir() } = {},
) {
  if (typeof process.getuid !== 'function') {
    throw new Error('Canonical temporary fixtures require a POSIX host identity');
  }
  if ((process.umask() & 0o700) !== 0) {
    throw new Error('Canonical temporary fixtures require owner-accessible process umask permissions');
  }
  const safePrefix = assertSafePrefix(prefix);
  const canonicalParent = await realpath(String(temporaryParent || ''));
  const expectedUid = BigInt(process.getuid());
  let parentHandle = null;
  let reserveHandle = null;
  let rootHandle = null;
  let root = null;
  let parentIdentity = null;
  let rootIdentity = null;

  try {
    parentHandle = await open(canonicalParent, directoryOpenFlags());
    const parentHandleStat = await parentHandle.stat({ bigint: true });
    assertRealDirectory(parentHandleStat, 'Canonical temporary fixture parent');
    parentIdentity = identity(parentHandleStat);
    await assertPinnedDirectory({
      handle: parentHandle,
      path: canonicalParent,
      expectedIdentity: parentIdentity,
      label: 'Canonical temporary fixture parent',
    });
    reserveHandle = await open(canonicalParent, directoryOpenFlags());
    await assertPinnedDirectory({
      handle: reserveHandle,
      path: canonicalParent,
      expectedIdentity: parentIdentity,
      label: 'Canonical temporary fixture reserve',
    });

    const created = await mkdtemp(join(canonicalParent, safePrefix));
    root = created;
    try {
      rootHandle = await open(root, directoryOpenFlags());
    } catch (error) {
      if (!['EMFILE', 'ENFILE'].includes(error?.code)) throw error;
      await reserveHandle.close();
      reserveHandle = null;
      rootHandle = await open(root, directoryOpenFlags());
    }
    const initialRootStat = await rootHandle.stat({ bigint: true });
    assertOwnedDirectory(initialRootStat, expectedUid, 'Canonical temporary fixture');
    rootIdentity = identity(initialRootStat);
    await rootHandle.chmod(Number(DIRECTORY_PERMISSIONS));
    const protectedRootStat = await rootHandle.stat({ bigint: true });
    assertOwnedProtectedDirectory(protectedRootStat, expectedUid, 'Canonical temporary fixture');
    rootIdentity = identity(protectedRootStat);
    if (reserveHandle) {
      await reserveHandle.close();
      reserveHandle = null;
    }
    root = await realpath(root);
    const rootName = basename(root);
    if (
      root !== created
      || dirname(root) !== canonicalParent
      || !rootName.startsWith(safePrefix)
      || rootName.length !== safePrefix.length + 6
    ) throw new Error('Canonical temporary fixture escaped its expected parent');
    await assertPinnedDirectory({
      handle: rootHandle,
      path: root,
      expectedIdentity: rootIdentity,
      expectedUid,
      expectedParent: canonicalParent,
      label: 'Canonical temporary fixture',
    });
    await assertPinnedDirectory({
      handle: parentHandle,
      path: canonicalParent,
      expectedIdentity: parentIdentity,
      label: 'Canonical temporary fixture parent',
    });
  } catch (error) {
    let cleanupError = error;
    if (root && rootHandle && rootIdentity && parentIdentity) {
      try {
        await removePinnedDirectory({
          canonicalParent,
          parentHandle,
          parentIdentity,
          root,
          rootHandle,
          rootIdentity,
          expectedUid,
        });
      } catch (nextError) {
        cleanupError = new AggregateError(
          [error, nextError],
          'Temporary fixture creation and identity-bound cleanup failed',
        );
      }
    } else if (root) {
      cleanupError = new AggregateError(
        [
          error,
          new Error(`Unpinned temporary fixture was intentionally left in place: ${basename(root)}`),
        ],
        'Temporary fixture creation failed before identity-bound cleanup was possible',
      );
    }
    await closeHandles([reserveHandle, rootHandle, parentHandle], cleanupError);
  }

  let lifecycle = 'active';
  const dispose = async () => {
    if (lifecycle !== 'active') {
      throw new Error(`Canonical temporary fixture is not active (${lifecycle})`);
    }
    lifecycle = 'disposing';
    let operationError = null;
    try {
      await removePinnedDirectory({
        canonicalParent,
        parentHandle,
        parentIdentity,
        root,
        rootHandle,
        rootIdentity,
        expectedUid,
      });
    } catch (error) {
      operationError = error;
    }
    try {
      await closeHandles([rootHandle, parentHandle], operationError);
      lifecycle = 'disposed';
    } catch (error) {
      lifecycle = 'failed';
      throw error;
    }
  };

  return Object.freeze({ root, dispose });
}
