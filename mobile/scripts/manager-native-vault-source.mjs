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

export function managerNativeVaultSourceDigest(rootDirectory) {
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
      entries.push(`${sha256(readFileSync(path))}  ${relativePath}`);
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
  entries.sort((left, right) => left.localeCompare(right));
  return sha256(Buffer.from(`${entries.join('\n')}\n`));
}
