import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';

const MAX_RUNTIME_FILES = 10_000;
const MAX_RUNTIME_BYTES = 512 * 1024 * 1024;
const READ_BUFFER_SIZE = 1024 * 1024;
const FILE_TYPE_MASK = 0o170000;
const REGULAR_FILE_TYPE = 0o100000;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function identity(stat) {
  return {
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    nlink: stat.nlink,
    uid: stat.uid,
    gid: stat.gid,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  };
}
function sameIdentity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function regularFile(stat) {
  return (stat.mode & BigInt(FILE_TYPE_MASK)) === BigInt(REGULAR_FILE_TYPE);
}

function normalizedPath(value) {
  const path = String(value || '');
  if (
    !path
    || path.startsWith('/')
    || path.endsWith('/')
    || path.includes('\\')
    || path.includes('\0')
    || path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) throw new Error(`Clean Custodial runtime contains an unsafe path: ${path || '(empty)'}`);
  return path;
}

function stableRegularFile(path, label) {
  if (!Number.isInteger(constants.O_NOFOLLOW)) {
    throw new Error('Clean Custodial runtime verification requires O_NOFOLLOW support');
  }
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    const pathBefore = lstatSync(path, { bigint: true });
    if (!regularFile(before) || !sameIdentity(identity(before), identity(pathBefore))) {
      throw new Error(`Clean Custodial runtime file is not one stable regular file: ${label}`);
    }
    if (before.size > BigInt(MAX_RUNTIME_BYTES)) {
      throw new Error(`Clean Custodial runtime file is unreasonably large: ${label}`);
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const buffer = Buffer.allocUnsafe(READ_BUFFER_SIZE);
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      chunks.push(buffer.subarray(0, count));
      total += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(path, { bigint: true });
    if (
      !sameIdentity(identity(before), identity(after))
      || !sameIdentity(identity(after), identity(pathAfter))
      || BigInt(total) !== before.size
    ) throw new Error(`Clean Custodial runtime file changed while it was read: ${label}`);
    return Buffer.concat(chunks, total);
  } finally {
    closeSync(descriptor);
  }
}

function cleanRuntimeFiles(sourceDirectory) {
  const root = resolve(String(sourceDirectory || ''));
  if (realpathSync(root) !== root) throw new Error('Clean Custodial runtime root may not be a symlink');
  const rootStat = lstatSync(root, { bigint: true });
  if (!rootStat.isDirectory()) throw new Error('Clean Custodial runtime root must be one directory');
  const directoryIdentities = new Map();
  const paths = [];
  const lowerPaths = new Set();
  const walk = (directory) => {
    const before = lstatSync(directory, { bigint: true });
    if (!before.isDirectory()) throw new Error('Clean Custodial runtime traversal reached a non-directory');
    directoryIdentities.set(directory, identity(before));
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const metadata = lstatSync(path, { bigint: true });
      const runtimePath = normalizedPath(relative(root, path).replaceAll('\\', '/'));
      if (metadata.isSymbolicLink()) {
        throw new Error(`Clean Custodial runtime may not contain symlinks: ${runtimePath}`);
      }
      if (metadata.isDirectory()) {
        walk(path);
      } else if (regularFile(metadata)) {
        const lower = runtimePath.toLowerCase();
        if (lowerPaths.has(lower)) {
          throw new Error(`Clean Custodial runtime paths collide by case: ${runtimePath}`);
        }
        lowerPaths.add(lower);
        paths.push(runtimePath);
        if (paths.length > MAX_RUNTIME_FILES) {
          throw new Error('Clean Custodial runtime contains too many files');
        }
      } else {
        throw new Error(`Clean Custodial runtime contains an unsupported entry: ${runtimePath}`);
      }
    }
  };
  walk(root);
  return { root, paths: paths.sort(), directoryIdentities };
}

export function assertCustodialRuntimeMatchesCleanSource({
  sourceDirectory,
  runtimeAssetManifest,
  runtimeAssetManifestBytes,
  readEntry,
}) {
  if (!runtimeAssetManifest || typeof runtimeAssetManifest !== 'object' || Array.isArray(runtimeAssetManifest)) {
    throw new Error('Clean Custodial runtime verification requires one asset manifest object');
  }
  if (typeof readEntry !== 'function') {
    throw new Error('Clean Custodial runtime verification requires one APK entry reader');
  }
  const hashes = runtimeAssetManifest.asset_hashes_sha256;
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) {
    throw new Error('Clean Custodial runtime asset hash ledger is malformed');
  }
  const ledgerPaths = Object.keys(hashes);
  if (
    !Number.isSafeInteger(runtimeAssetManifest.asset_count)
    || runtimeAssetManifest.asset_count !== ledgerPaths.length
    || JSON.stringify(ledgerPaths) !== JSON.stringify([...ledgerPaths].sort())
  ) throw new Error('Clean Custodial runtime asset manifest inventory is malformed');
  for (const path of ledgerPaths) normalizedPath(path);

  const inventory = cleanRuntimeFiles(sourceDirectory);
  const expectedSourcePaths = [...ledgerPaths, 'runtime-asset-manifest.json'].sort();
  if (JSON.stringify(inventory.paths) !== JSON.stringify(expectedSourcePaths)) {
    const expected = new Set(expectedSourcePaths);
    const actual = new Set(inventory.paths);
    const missing = expectedSourcePaths.filter((path) => !actual.has(path));
    const unexpected = inventory.paths.filter((path) => !expected.has(path));
    throw new Error(
      `Clean Custodial runtime graph differs from its committed build output (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'})`,
    );
  }

  let totalBytes = 0;
  const canonical = [];
  const sourceManifestBytes = stableRegularFile(
    join(inventory.root, 'runtime-asset-manifest.json'),
    'runtime-asset-manifest.json',
  );
  if (!sourceManifestBytes.equals(Buffer.from(runtimeAssetManifestBytes || []))) {
    throw new Error('APK runtime asset manifest differs byte-for-byte from the clean Custodial build output');
  }
  canonical.push(`runtime-asset-manifest.json\0${sourceManifestBytes.length}\0${sha256(sourceManifestBytes)}`);
  totalBytes += sourceManifestBytes.length;

  for (const path of ledgerPaths) {
    const sourceBytes = stableRegularFile(join(inventory.root, ...path.split('/')), path);
    const apkBytes = Buffer.from(readEntry(`assets/public/${path}`) || []);
    const expectedDigest = String(hashes[path] || '').toLowerCase();
    const sourceDigest = sha256(sourceBytes);
    if (!/^[a-f0-9]{64}$/.test(expectedDigest) || sourceDigest !== expectedDigest) {
      throw new Error(`Clean Custodial runtime asset differs from its manifest: ${path}`);
    }
    if (!sourceBytes.equals(apkBytes)) {
      throw new Error(`APK runtime asset differs byte-for-byte from the clean Custodial build output: ${path}`);
    }
    totalBytes += sourceBytes.length;
    if (totalBytes > MAX_RUNTIME_BYTES) throw new Error('Clean Custodial runtime is unreasonably large');
    canonical.push(`${path}\0${sourceBytes.length}\0${sourceDigest}`);
  }

  for (const [directory, expected] of [...inventory.directoryIdentities.entries()].reverse()) {
    const actual = lstatSync(directory, { bigint: true });
    if (!actual.isDirectory() || !sameIdentity(identity(actual), expected)) {
      throw new Error('Clean Custodial runtime directory changed while it was verified');
    }
  }
  return {
    clean_source_runtime_match: true,
    clean_source_runtime_asset_count: ledgerPaths.length,
    clean_source_runtime_tree_sha256: sha256(Buffer.from(`${canonical.join('\n')}\n`)),
  };
}
