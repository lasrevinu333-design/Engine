import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REQUIRED_SOURCE_FILES = Object.freeze([
  'package.json',
  'dist/esm/index.js',
  'dist/esm/index.d.ts',
  'dist/plugin.cjs',
  'android/build.gradle',
  'android/gradle.properties',
  'android/settings.gradle',
  'android/src/main/AndroidManifest.xml',
]);
const ANDROID_ALLOWED_ENTRIES = new Set([
  '.gradle',
  'build',
  'build.gradle',
  'gradle.properties',
  'proguard-rules.pro',
  'settings.gradle',
  'src',
]);
const ANDROID_GENERATED_ENTRIES = new Set(['.gradle', 'build']);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function custodialNativeVaultSourceDigest(directory) {
  const root = resolve(directory);
  for (const path of REQUIRED_SOURCE_FILES) {
    const candidate = join(root, path);
    if (!existsSync(candidate) || !lstatSync(candidate).isFile() || lstatSync(candidate).isSymbolicLink()) {
      throw new Error(`Custodial native vault source file is missing or invalid: ${path}`);
    }
  }
  const rootEntries = readdirSync(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!['.gitignore', 'android', 'dist', 'package.json'].includes(entry.name)) {
      throw new Error(`Custodial native vault contains an unclassified source entry: ${entry.name}`);
    }
  }
  for (const entry of readdirSync(join(root, 'android'), { withFileTypes: true })) {
    if (!ANDROID_ALLOWED_ENTRIES.has(entry.name)) {
      throw new Error(`Custodial native vault Android source contains an unclassified entry: ${entry.name}`);
    }
  }

  const entries = [];
  const addFile = (path) => {
    const metadata = lstatSync(path);
    const relativePath = relative(root, path).replaceAll('\\', '/');
    if (metadata.isSymbolicLink()) throw new Error(`Custodial native vault source may not contain symlinks: ${relativePath}`);
    if (!metadata.isFile()) throw new Error(`Custodial native vault source entry is not a file: ${relativePath}`);
    entries.push(`${sha256(readFileSync(path))}  ${relativePath}`);
  };
  const walk = (path) => {
    const metadata = lstatSync(path);
    const relativePath = relative(root, path).replaceAll('\\', '/');
    if (metadata.isSymbolicLink()) throw new Error(`Custodial native vault source may not contain symlinks: ${relativePath}`);
    if (metadata.isFile()) {
      addFile(path);
      return;
    }
    if (!metadata.isDirectory()) throw new Error(`Custodial native vault source contains an unsupported entry: ${relativePath}`);
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      walk(join(path, entry.name));
    }
  };

  addFile(join(root, 'package.json'));
  walk(join(root, 'dist'));
  for (const entry of readdirSync(join(root, 'android'), { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (ANDROID_GENERATED_ENTRIES.has(entry.name)) continue;
    walk(join(root, 'android', entry.name));
  }
  if (!entries.length) throw new Error('Custodial native vault canonical source tree is empty');
  entries.sort((left, right) => left.localeCompare(right));
  return sha256(Buffer.from(`${entries.join('\n')}\n`));
}
