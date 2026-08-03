import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REQUIRED_ANDROID_FILES = Object.freeze([
  'package.json',
  'dist/esm/index.js',
  'dist/esm/index.d.ts',
  'dist/plugin.cjs',
  'android/build.gradle',
  'android/gradle.properties',
  'android/settings.gradle',
  'android/src/main/AndroidManifest.xml',
]);
const ROOT_SOURCE_ENTRIES = new Set([
  '.gitignore',
  'Package.resolved',
  'Package.swift',
  'Sources',
  'Tests',
  'android',
  'dist',
  'package.json',
]);
const GENERATED_ENTRY_NAMES = new Set([
  '.DS_Store',
  '.build',
  '.gradle',
  '.idea',
  '.swiftpm',
  '.vscode',
  'DerivedData',
  'build',
  'local.properties',
  'xcuserdata',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function managerNativeVaultSourceInventory(rootDirectory) {
  const root = resolve(rootDirectory);
  for (const relativePath of REQUIRED_ANDROID_FILES) {
    const path = join(root, relativePath);
    if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
      throw new Error(`Manager native vault source file is missing or invalid: ${relativePath}`);
    }
  }
  const hasIosSource = ['Package.swift', 'Package.resolved', 'Sources', 'Tests']
    .some((name) => existsSync(join(root, name)));
  if (hasIosSource) {
    for (const relativePath of ['Package.swift', 'Sources']) {
      const path = join(root, relativePath);
      if (!existsSync(path) || lstatSync(path).isSymbolicLink()
          || (relativePath === 'Sources' ? !lstatSync(path).isDirectory() : !lstatSync(path).isFile())) {
        throw new Error(`Manager native vault iOS source is missing or invalid: ${relativePath}`);
      }
    }
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!ROOT_SOURCE_ENTRIES.has(entry.name) && !GENERATED_ENTRY_NAMES.has(entry.name)) {
      throw new Error(`Manager native vault contains an unclassified source entry: ${entry.name}`);
    }
  }

  const entries = [];
  function walk(path) {
    const metadata = lstatSync(path);
    const relativePath = relative(root, path).replaceAll('\\', '/');
    if (metadata.isSymbolicLink()) throw new Error(`Manager native vault source may not contain symlinks: ${relativePath}`);
    if (metadata.isFile()) {
      entries.push({ path: relativePath, sha256: sha256(readFileSync(path)) });
      return;
    }
    if (!metadata.isDirectory()) throw new Error(`Manager native vault source contains an unsupported entry: ${relativePath}`);
    for (const entry of readdirSync(path, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (GENERATED_ENTRY_NAMES.has(entry.name)) continue;
      walk(join(path, entry.name));
    }
  }

  for (const name of [...ROOT_SOURCE_ENTRIES].sort()) {
    if (name === '.gitignore' || !existsSync(join(root, name))) continue;
    walk(join(root, name));
  }
  if (!entries.length) throw new Error('Manager native vault canonical source tree is empty');
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return entries;
}

export function managerNativeVaultSourceDigest(rootDirectory) {
  const entries = managerNativeVaultSourceInventory(rootDirectory)
    .map((entry) => `${entry.sha256}  ${entry.path}`)
    .sort((left, right) => left.localeCompare(right));
  return sha256(Buffer.from(`${entries.join('\n')}\n`));
}

function git(root, args, executeGit) {
  try {
    return {
      ok: true,
      output: executeGit('git', args, {
        cwd: root,
        encoding: args.includes('-z') ? null : 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    };
  } catch {
    return { ok: false, output: '' };
  }
}

/**
 * Bind every canonical native-vault input present on disk to a tracked blob in
 * one exact commit. This closes the gap where git status intentionally omits an
 * ignored Java or Swift file even though the native compiler can consume it.
 */
export function managerNativeVaultTrackedHeadState(rootDirectory, {
  repositoryRoot,
  revision = 'HEAD',
  executeGit = execFileSync,
} = {}) {
  const root = resolve(rootDirectory);
  const repository = resolve(repositoryRoot || join(root, '..', '..', '..'));
  let inventory;
  try {
    inventory = managerNativeVaultSourceInventory(root);
  } catch (error) {
    return {
      tracked_head_exact: false,
      resolved_revision: null,
      untracked_source_paths: [],
      reason: error instanceof Error ? error.message : 'manager_native_source_inventory_failed',
    };
  }

  const top = git(repository, ['rev-parse', '--show-toplevel'], executeGit);
  const resolvedRevision = git(repository, ['rev-parse', '--verify', `${revision}^{commit}`], executeGit);
  const repositoryTop = top.ok ? resolve(String(top.output).trim()) : '';
  const commit = resolvedRevision.ok ? String(resolvedRevision.output).trim().toLowerCase() : '';
  const pluginRelative = relative(repository, root).replaceAll('\\', '/');
  const repositoryMatches = repositoryTop === repository
    && pluginRelative
    && pluginRelative !== '..'
    && !pluginRelative.startsWith('../');
  const tree = repositoryMatches && /^[a-f0-9]{40,64}$/.test(commit)
    ? git(repository, ['ls-tree', '-r', '--name-only', '-z', commit, '--', pluginRelative], executeGit)
    : { ok: false, output: '' };
  const trackedPaths = tree.ok
    ? new Set(Buffer.from(tree.output).toString('utf8').split('\0').filter(Boolean))
    : new Set();
  const inventoryPaths = inventory.map((entry) => `${pluginRelative}/${entry.path}`);
  const untrackedSourcePaths = inventoryPaths.filter((path) => !trackedPaths.has(path));
  const worktree = repositoryMatches && /^[a-f0-9]{40,64}$/.test(commit)
    ? git(repository, ['diff', '--quiet', commit, '--', pluginRelative], executeGit)
    : { ok: false, output: '' };

  return {
    tracked_head_exact: Boolean(
      repositoryMatches
      && tree.ok
      && worktree.ok
      && untrackedSourcePaths.length === 0
    ),
    resolved_revision: /^[a-f0-9]{40,64}$/.test(commit) ? commit : null,
    untracked_source_paths: untrackedSourcePaths,
    canonical_source_count: inventory.length,
    tracked_tree_source_count: trackedPaths.size,
    worktree_matches_revision: worktree.ok,
    reason: repositoryMatches ? null : 'manager_native_source_repository_mismatch',
  };
}
