#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertManagerNativeSecurityBoundary } from './verify-manager-android-release.mjs';

function unzip(args, encoding = 'utf8') {
  return execFileSync('unzip', args, {
    encoding,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
}

export function verifyManagerNativeBoundaryApk(apkPath) {
  const apk = resolve(String(apkPath || ''));
  if (!apkPath || !existsSync(apk) || !lstatSync(apk).isFile() || lstatSync(apk).isSymbolicLink()) {
    throw new Error('Usage: verify-manager-native-boundary-apk.mjs <regular-apk-path>');
  }
  const entries = String(unzip(['-Z1', apk])).trim().split(/\r?\n/).filter(Boolean);
  const readEntry = (name) => {
    const count = entries.filter((entry) => entry === name).length;
    if (count !== 1) throw new Error(`Manager APK must contain ${name} exactly once; found ${count}`);
    return unzip(['-p', apk, name], null);
  };
  const pluginManifest = readEntry('assets/capacitor.plugins.json');
  const build = readEntry('assets/public/build.json');
  const proof = assertManagerNativeSecurityBoundary({
    pluginManifest: JSON.parse(pluginManifest.toString('utf8')),
    dexEntries: entries
      .filter((name) => /^classes(?:\d+)?[.]dex$/.test(name))
      .sort()
      .map((name) => ({ name, bytes: readEntry(name) })),
    runtimeExecutableEntries: entries
      .filter((name) => /^assets\/public\/.+[.](?:html|js|mjs)$/.test(name))
      .sort()
      .map((name) => ({ name, bytes: readEntry(name) })),
    build: JSON.parse(build.toString('utf8')),
  });
  return {
    ok: true,
    apk_sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
    plugin_manifest_sha256: createHash('sha256').update(pluginManifest).digest('hex'),
    ...proof,
  };
}

const scriptPath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] || '') === scriptPath) {
  process.stdout.write(`${JSON.stringify(verifyManagerNativeBoundaryApk(process.argv[2]), null, 2)}\n`);
}
