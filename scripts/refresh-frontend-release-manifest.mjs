#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRONTEND_MANIFEST_NAME = 'frontend-release-manifest.json';
export const FRONTEND_DEPLOYMENT_MANIFEST_NAME = 'frontend-deployment-manifest.json';
export const RUNTIME_ASSET_MANIFEST_NAME = 'runtime-asset-manifest.json';
export const FRONTEND_HASH_EXCLUDED_FILES = [
  FRONTEND_DEPLOYMENT_MANIFEST_NAME,
  FRONTEND_MANIFEST_NAME,
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const PARSEABLE_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.svg']);
const RUNTIME_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.png',
  '.svg',
  '.ttf',
  '.wav',
  '.webp',
  '.woff',
  '.woff2',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableObject(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => comparePaths(left, right)));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function assertCaseInsensitivePathUniqueness(paths, label = 'Runtime paths') {
  const pathsByCaseFold = new Map();
  for (const path of [...new Set(paths)].sort(comparePaths)) {
    const caseFoldedPath = path.normalize('NFC').toLowerCase();
    const matches = pathsByCaseFold.get(caseFoldedPath) || [];
    matches.push(path);
    pathsByCaseFold.set(caseFoldedPath, matches);
  }
  const collisions = [...pathsByCaseFold.values()].filter((matches) => matches.length > 1);
  if (collisions.length) {
    throw new Error(
      `${label} contain case-insensitive path collisions: ${collisions
        .map((matches) => matches.join(' <> '))
        .join('; ')}`,
    );
  }
}

function isInsideRoot(root, path) {
  return path === root || path.startsWith(`${root}${sep}`);
}

function decodeReference(value) {
  return String(value || '')
    .trim()
    .replaceAll('&amp;', '&')
    .replace(/^['"]|['"]$/g, '');
}

function referenceCandidates(source) {
  const values = [];
  const collect = (regex, group = 1, required = true) => {
    for (const match of source.matchAll(regex)) values.push({ value: match[group], required });
  };

  collect(/\b(?:href|poster|src|data-src)\s*=\s*["']([^"']+)["']/gi);
  collect(/\bsrcset\s*=\s*["']([^"']+)["']/gi);
  collect(/\burl\(\s*["']?([^"')]+)["']?\s*\)/gi);
  collect(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gi);
  collect(/\bnew\s+URL\(\s*["'`]([^"'`]+)["'`]/gi);
  collect(/\b(?:fetch|importScripts|import)\(\s*["'`]([^"'`]+)["'`]/gi);
  collect(/\b(?:location(?:\.href)?|window\.location(?:\.href)?|\.src|\.href)\s*=\s*["'`]([^"'`]+)["'`]/gi);
  // Bare string literals are a discovery aid for assets inserted later by
  // application code, but are not on their own proof of a runtime reference.
  collect(
    /["'`]((?:\.\/)?[^"'`\s?#]+\.(?:css|html|ico|jpeg|jpg|js|png|svg|ttf|wav|webp|woff2?))(?:[?#][^"'`]*)?["'`]/gi,
    1,
    false,
  );

  return values.flatMap(({ value, required }) => {
    if (!String(value).includes(',')) return [{ value, required }];
    return String(value)
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean)
      .map((part) => ({ value: part, required }));
  });
}

function normalizeReference(root, sourcePath, rawReference, required) {
  let reference = decodeReference(rawReference);
  if (
    !reference
    || reference.startsWith('#')
    || reference.startsWith('//')
    || reference.includes('${')
    || /^[a-z][a-z0-9+.-]*:/i.test(reference)
  ) {
    return null;
  }

  reference = reference.split('#', 1)[0].split('?', 1)[0];
  if (!reference) return null;

  try {
    reference = decodeURIComponent(reference);
  } catch {
    return null;
  }

  const normalizedSource = sourcePath.split(sep).join('/');
  const sourceDirectory = posix.dirname(normalizedSource);
  const browserReference = reference.replaceAll('\\', '/');
  if (browserReference.startsWith('//')) return null;
  const normalized = posix.normalize(
    browserReference.startsWith('/')
      ? browserReference.replace(/^\/+/, '')
      : posix.join(sourceDirectory, browserReference),
  );
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || posix.isAbsolute(normalized)) {
    return null;
  }

  const extension = extname(normalized).toLowerCase();
  if (!RUNTIME_EXTENSIONS.has(extension)) return null;

  const absolute = resolve(root, normalized);
  if (!isInsideRoot(root, absolute)) return null;

  let metadata;
  try {
    metadata = statSync(absolute);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      if (!required) return null;
      throw new Error(`Missing local runtime reference "${normalized}" from "${sourcePath}".`);
    }
    throw error;
  }
  if (!metadata.isFile()) {
    throw new Error(`Local runtime reference "${normalized}" from "${sourcePath}" is not a regular file.`);
  }
  return normalized;
}

function localReferences(root, sourcePath) {
  if (FRONTEND_HASH_EXCLUDED_FILES.includes(sourcePath)) return [];
  const extension = extname(sourcePath).toLowerCase();
  if (!PARSEABLE_EXTENSIONS.has(extension)) return [];
  const source = readFileSync(resolve(root, sourcePath), 'utf8');
  const references = new Set();

  for (const candidate of referenceCandidates(source)) {
    const normalized = normalizeReference(root, sourcePath, candidate.value, candidate.required);
    if (!normalized) continue;
    references.add(normalized);
  }

  return [...references].sort(comparePaths);
}

export function discoverRuntimeFiles(rootDirectory = DEFAULT_ROOT) {
  const root = resolve(rootDirectory);
  const entrypoints = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
    .map((entry) => entry.name);

  for (const publicManifest of FRONTEND_HASH_EXCLUDED_FILES) {
    try {
      if (statSync(resolve(root, publicManifest)).isFile()) entrypoints.push(publicManifest);
    } catch {
      // A missing optional deployment manifest is not a runtime entrypoint.
    }
  }

  const discovered = new Set(entrypoints.sort(comparePaths));
  const pending = [...discovered];

  while (pending.length) {
    const sourcePath = pending.shift();
    for (const referencedPath of localReferences(root, sourcePath)) {
      if (discovered.has(referencedPath)) continue;
      discovered.add(referencedPath);
      pending.push(referencedPath);
      pending.sort(comparePaths);
    }
  }

  const runtimeFiles = [...discovered].sort(comparePaths);
  assertCaseInsensitivePathUniqueness(runtimeFiles, 'Discovered frontend runtime paths');
  return runtimeFiles;
}

export function buildAssetHashes(rootDirectory, files, excludedFiles = []) {
  const root = resolve(rootDirectory);
  const excluded = new Set(excludedFiles);
  const entries = [];
  assertCaseInsensitivePathUniqueness(files, 'Runtime asset paths');

  for (const file of [...new Set(files)].sort(comparePaths)) {
    if (excluded.has(file)) continue;
    const absolute = resolve(root, file);
    if (!isInsideRoot(root, absolute)) throw new Error(`Runtime path escapes root: ${file}`);
    const metadata = lstatSync(absolute);
    if (metadata.isSymbolicLink()) throw new Error(`Runtime assets may not be symbolic links: ${file}`);
    if (!metadata.isFile()) throw new Error(`Runtime asset is not a regular file: ${file}`);
    entries.push([file, sha256(readFileSync(absolute))]);
  }

  return stableObject(entries);
}

function manifestDifference(expectedHashes, actualHashes) {
  const expectedFiles = Object.keys(expectedHashes);
  const actualFiles = Object.keys(actualHashes || {});
  const expected = new Set(expectedFiles);
  const actual = new Set(actualFiles);
  const missing = expectedFiles.filter((file) => !actual.has(file));
  const unexpected = actualFiles.filter((file) => !expected.has(file));
  const hashMismatches = expectedFiles
    .filter((file) => actual.has(file) && actualHashes[file] !== expectedHashes[file])
    .map((file) => ({ file, expected: expectedHashes[file], actual: actualHashes[file] }));
  const sorted = actualFiles.every((file, index) => index === 0 || comparePaths(actualFiles[index - 1], file) <= 0);
  return { missing, unexpected, hash_mismatches: hashMismatches, sorted };
}

export function verifyFrontendReleaseManifest(rootDirectory = DEFAULT_ROOT) {
  const root = resolve(rootDirectory);
  const manifestPath = resolve(root, FRONTEND_MANIFEST_NAME);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const runtimeFiles = discoverRuntimeFiles(root);
  const expectedHashes = buildAssetHashes(root, runtimeFiles, FRONTEND_HASH_EXCLUDED_FILES);
  const difference = manifestDifference(expectedHashes, manifest.asset_hashes_sha256);
  const ok = difference.missing.length === 0
    && difference.unexpected.length === 0
    && difference.hash_mismatches.length === 0
    && difference.sorted;

  return {
    ok,
    manifest,
    runtime_files: runtimeFiles,
    asset_hashes_sha256: expectedHashes,
    difference,
  };
}

export function writeFrontendReleaseManifest(rootDirectory = DEFAULT_ROOT) {
  const root = resolve(rootDirectory);
  const manifestPath = resolve(root, FRONTEND_MANIFEST_NAME);
  const current = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const runtimeFiles = discoverRuntimeFiles(root);
  const assetHashes = buildAssetHashes(root, runtimeFiles, FRONTEND_HASH_EXCLUDED_FILES);
  const next = { ...current, asset_hashes_sha256: assetHashes };
  writeFileSync(manifestPath, stableJson(next));
  return verifyFrontendReleaseManifest(root);
}

function normalizedCommit(value) {
  const commit = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{40,64}$/.test(commit) ? commit : '';
}

export function resolveBuildIdentity({
  rootDirectory = DEFAULT_ROOT,
  edition,
  environment = process.env,
} = {}) {
  const root = resolve(rootDirectory);
  const manifest = JSON.parse(readFileSync(resolve(root, FRONTEND_MANIFEST_NAME), 'utf8'));
  const environmentCommit = environment.MZ_SOURCE_COMMIT
    || environment.GITHUB_SHA
    || environment.CM_COMMIT
    || environment.CI_COMMIT_SHA;
  let sourceCommit = normalizedCommit(environmentCommit);

  if (!sourceCommit) {
    try {
      sourceCommit = normalizedCommit(execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }));
    } catch {
      sourceCommit = '';
    }
  }
  if (!sourceCommit) throw new Error('A full source commit is required through git or MZ_SOURCE_COMMIT/GITHUB_SHA/CM_COMMIT/CI_COMMIT_SHA.');

  const releaseId = String(environment.MZ_RELEASE_ID || manifest.release_id || '').trim();
  if (!releaseId) throw new Error('A release id is required in frontend-release-manifest.json or MZ_RELEASE_ID.');
  const normalizedEdition = String(edition || '').trim().toLowerCase();
  if (!normalizedEdition) throw new Error('An edition is required to build deterministic identity.');

  return {
    release_id: releaseId,
    source_commit: sourceCommit,
    build_id: `${releaseId}.${normalizedEdition}.${sourceCommit.slice(0, 12)}`,
  };
}

export function resolveAppEdition(value) {
  const requested = String(value ?? '').trim().toLowerCase();
  if (!requested) return 'manager';
  if (['manager', 'custodial', 'viewer'].includes(requested)) return requested;
  throw new Error(`Unknown MZ_APP_EDITION "${String(value)}". Expected manager, custodial, or viewer.`);
}

function walkFiles(root, directory = root) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => comparePaths(left.name, right.name))) {
    const absolute = resolve(directory, entry.name);
    const runtimePath = relative(root, absolute).split(sep).join('/');
    if (entry.isSymbolicLink()) throw new Error(`Runtime distribution may not contain symbolic links: ${runtimePath}`);
    if (entry.isDirectory()) files.push(...walkFiles(root, absolute));
    else if (entry.isFile()) files.push(runtimePath);
  }
  return files.sort(comparePaths);
}

export function createRuntimeAssetManifest({
  directory,
  edition,
  identity,
} = {}) {
  const root = resolve(directory);
  const distributionFiles = walkFiles(root);
  assertCaseInsensitivePathUniqueness(distributionFiles, 'Built distribution paths');
  const files = distributionFiles.filter((file) => file !== RUNTIME_ASSET_MANIFEST_NAME);
  const assetHashes = buildAssetHashes(root, files);
  return {
    schema_version: 1,
    edition,
    release_id: identity.release_id,
    source_commit: identity.source_commit,
    build_id: identity.build_id,
    asset_count: Object.keys(assetHashes).length,
    asset_hashes_sha256: assetHashes,
  };
}

export function writeRuntimeAssetManifest(options) {
  const manifest = createRuntimeAssetManifest(options);
  writeFileSync(resolve(options.directory, RUNTIME_ASSET_MANIFEST_NAME), stableJson(manifest));
  return manifest;
}

function formatFailure(result) {
  return [
    result.difference.missing.length ? `missing: ${result.difference.missing.join(', ')}` : '',
    result.difference.unexpected.length ? `unexpected: ${result.difference.unexpected.join(', ')}` : '',
    result.difference.hash_mismatches.length
      ? `hash mismatches: ${result.difference.hash_mismatches.map(({ file }) => file).join(', ')}`
      : '',
    result.difference.sorted ? '' : 'manifest asset keys are not sorted',
  ].filter(Boolean).join('; ');
}

function runCli() {
  const modes = process.argv.slice(2);
  if (modes.length > 1 || (modes[0] && !['--check', '--write'].includes(modes[0]))) {
    throw new Error('Usage: node scripts/refresh-frontend-release-manifest.mjs [--check|--write]');
  }
  const mode = modes[0] || '--check';
  const result = mode === '--write'
    ? writeFrontendReleaseManifest(DEFAULT_ROOT)
    : verifyFrontendReleaseManifest(DEFAULT_ROOT);
  if (!result.ok) throw new Error(`Frontend release manifest verification failed: ${formatFailure(result)}`);
  console.log(JSON.stringify({
    ok: true,
    mode: mode.slice(2),
    release_id: result.manifest.release_id,
    runtime_file_count: result.runtime_files.length,
    asset_count: Object.keys(result.asset_hashes_sha256).length,
    hash_excluded: FRONTEND_HASH_EXCLUDED_FILES,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
