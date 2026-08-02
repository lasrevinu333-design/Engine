import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  fdatasyncSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const COPY_BUFFER_SIZE = 1024 * 1024;
const REGULAR_FILE_TYPE = 0o100000;
const FILE_TYPE_MASK = 0o170000;

function identity(stat) {
  return Object.freeze({
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    nlink: stat.nlink,
    uid: stat.uid,
    gid: stat.gid,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.uid === right.uid
    && left.gid === right.gid
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function regularFile(stat) {
  return (stat.mode & BigInt(FILE_TYPE_MASK)) === BigInt(REGULAR_FILE_TYPE);
}

function noFollowFlag() {
  if (!Number.isInteger(constants.O_NOFOLLOW)) {
    throw new Error('Immutable artifact snapshots require O_NOFOLLOW support');
  }
  return constants.O_NOFOLLOW;
}

function stableFileProof(path) {
  const descriptor = openSync(path, constants.O_RDONLY | noFollowFlag());
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!regularFile(before)) throw new Error('Immutable snapshot is not a regular file');
    if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Immutable snapshot is unreasonably large');
    const hash = createHash('sha256');
    let total = 0;
    const buffer = Buffer.allocUnsafe(COPY_BUFFER_SIZE);
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
      total += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(identity(before), identity(after)) || BigInt(total) !== before.size) {
      throw new Error('Immutable snapshot changed while it was read');
    }
    return { sizeBytes: total, sha256: hash.digest('hex') };
  } finally {
    closeSync(descriptor);
  }
}

export function createImmutableFileSnapshot(
  sourcePath,
  { prefix = 'memphis-custodial-apk-', fileName = 'artifact.apk' } = {},
) {
  const source = resolve(String(sourcePath || ''));
  const safeName = String(fileName || '');
  if (!safeName || basename(safeName) !== safeName || safeName === '.' || safeName === '..') {
    throw new Error('Immutable snapshot file name is unsafe');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(String(prefix || ''))) {
    throw new Error('Immutable snapshot prefix is unsafe');
  }
  if (realpathSync(source) !== source) {
    throw new Error('Snapshot source path may not traverse symbolic links');
  }

  const temporaryRoot = realpathSync(tmpdir());
  const directory = mkdtempSync(join(temporaryRoot, prefix));
  chmodSync(directory, 0o700);
  const destination = join(directory, safeName);
  let sourceDescriptor = null;
  let destinationDescriptor = null;
  try {
    sourceDescriptor = openSync(source, constants.O_RDONLY | noFollowFlag());
    const sourceBefore = fstatSync(sourceDescriptor, { bigint: true });
    if (!regularFile(sourceBefore) || sourceBefore.size < 1n) {
      throw new Error('Snapshot source must be one non-empty regular file');
    }
    if (sourceBefore.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Snapshot source is unreasonably large');
    }
    const pathBefore = lstatSync(source, { bigint: true });
    if (!sameIdentity(identity(sourceBefore), identity(pathBefore))) {
      throw new Error('Snapshot source path changed before copying');
    }

    destinationDescriptor = openSync(
      destination,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowFlag(),
      0o600,
    );
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(COPY_BUFFER_SIZE);
    let copied = 0n;
    while (true) {
      const count = readSync(sourceDescriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
      let written = 0;
      while (written < count) {
        const next = writeSync(destinationDescriptor, buffer, written, count - written, null);
        if (next < 1) throw new Error('Immutable snapshot write made no progress');
        written += next;
      }
      copied += BigInt(count);
    }
    fdatasyncSync(destinationDescriptor);
    const sourceAfter = fstatSync(sourceDescriptor, { bigint: true });
    const pathAfter = lstatSync(source, { bigint: true });
    if (
      !sameIdentity(identity(sourceBefore), identity(sourceAfter))
      || !sameIdentity(identity(sourceAfter), identity(pathAfter))
      || copied !== sourceBefore.size
    ) throw new Error('Snapshot source changed while it was copied');
    closeSync(sourceDescriptor);
    sourceDescriptor = null;
    closeSync(destinationDescriptor);
    destinationDescriptor = null;

    chmodSync(destination, 0o400);
    const directoryStat = lstatSync(directory, { bigint: true });
    const snapshotStat = lstatSync(destination, { bigint: true });
    if ((directoryStat.mode & 0o777n) !== 0o700n || (snapshotStat.mode & 0o777n) !== 0o400n) {
      throw new Error('Immutable snapshot permissions are malformed');
    }
    const snapshot = Object.freeze({
      directory,
      path: destination,
      source,
      prefix,
      sourceIdentity: identity(sourceAfter),
      directoryIdentity: identity(directoryStat),
      fileIdentity: identity(snapshotStat),
      sha256: hash.digest('hex'),
      sizeBytes: Number(copied),
    });
    assertImmutableFileSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (sourceDescriptor !== null) closeSync(sourceDescriptor);
    if (destinationDescriptor !== null) closeSync(destinationDescriptor);
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export function assertImmutableFileSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Immutable snapshot proof is missing');
  const directory = resolve(String(snapshot.directory || ''));
  const path = resolve(String(snapshot.path || ''));
  if (dirname(path) !== directory || realpathSync(directory) !== directory || realpathSync(path) !== path) {
    throw new Error('Immutable snapshot path identity is malformed');
  }
  const directoryStat = lstatSync(directory, { bigint: true });
  const fileStatBefore = lstatSync(path, { bigint: true });
  if (
    !directoryStat.isDirectory()
    || !regularFile(fileStatBefore)
    || (directoryStat.mode & 0o777n) !== 0o700n
    || (fileStatBefore.mode & 0o777n) !== 0o400n
    || !sameIdentity(identity(directoryStat), snapshot.directoryIdentity)
    || !sameIdentity(identity(fileStatBefore), snapshot.fileIdentity)
  ) throw new Error('Immutable snapshot metadata changed after creation');
  const proof = stableFileProof(path);
  const fileStatAfter = lstatSync(path, { bigint: true });
  if (
    !sameIdentity(identity(fileStatBefore), identity(fileStatAfter))
    || proof.sizeBytes !== snapshot.sizeBytes
    || proof.sha256 !== snapshot.sha256
  ) throw new Error('Immutable snapshot bytes changed after creation');
  return true;
}

export function disposeImmutableFileSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const directory = resolve(String(snapshot.directory || ''));
  const expectedParent = realpathSync(tmpdir());
  const prefix = String(snapshot.prefix || '');
  if (
    dirname(directory) !== expectedParent
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(prefix)
    || !basename(directory).startsWith(prefix)
  ) {
    throw new Error('Refusing to dispose an unrecognized immutable snapshot directory');
  }
  const stat = lstatSync(directory, { bigint: true });
  if (!stat.isDirectory() || !sameIdentity(identity(stat), snapshot.directoryIdentity)) {
    throw new Error('Refusing to dispose a replaced immutable snapshot directory');
  }
  rmSync(directory, { recursive: true, force: false });
}
