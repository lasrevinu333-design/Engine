#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCustodialNativeSecurityBoundary } from './verify-custodial-android-release.mjs';

export function unzip(args, options = {}, execute = execFileSync) {
  return execute('unzip', args, {
    // execFileSync uses null to request a Buffer. Nullish coalescing would replace that
    // explicit binary request with UTF-8 and irreversibly corrupt DEX bytes.
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function verifyCustodialNativeBoundaryApk(apkPath) {
  const apk = resolve(apkPath || '');
  if (!apkPath || !existsSync(apk) || !lstatSync(apk).isFile() || lstatSync(apk).isSymbolicLink()) {
    throw new Error('Usage: verify-custodial-native-boundary-apk.mjs <regular-apk-path>');
  }

  const entries = unzip(['-Z1', apk]).trim().split(/\r?\n/).filter(Boolean);
  const readEntry = (name) => {
    const count = entries.filter((entry) => entry === name).length;
    if (count !== 1) throw new Error(`APK must contain ${name} exactly once; found ${count}`);
    return unzip(['-p', apk, name], { encoding: null });
  };
  const pluginManifestBytes = readEntry('assets/capacitor.plugins.json');
  const dexNames = entries.filter((entry) => /^classes(?:\d+)?\.dex$/.test(entry)).sort();
  const runtimeExecutableNames = entries.filter((entry) => /^assets\/public\/.+\.(?:html|js|mjs)$/.test(entry)).sort();
  const proof = assertCustodialNativeSecurityBoundary({
    pluginManifest: JSON.parse(pluginManifestBytes.toString('utf8')),
    dexEntries: dexNames.map((name) => ({ name, bytes: readEntry(name) })),
    runtimeBridgeBytes: readEntry('assets/public/memphis-custodial-bridge.js'),
    runtimeExecutableEntries: runtimeExecutableNames.map((name) => ({ name, bytes: readEntry(name) })),
  });

  return {
    ok: true,
    apk_sha256: sha256(readFileSync(apk)),
    plugin_manifest_sha256: sha256(pluginManifestBytes),
    ...proof,
  };
}

const scriptPath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] || '') === scriptPath) {
  process.stdout.write(`${JSON.stringify(verifyCustodialNativeBoundaryApk(process.argv[2]), null, 2)}\n`);
}
