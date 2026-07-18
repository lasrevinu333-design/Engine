#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'frontend-release-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

manifest.asset_hashes_sha256 = Object.fromEntries(
  Object.keys(manifest.asset_hashes_sha256 || {}).sort().map((file) => [
    file,
    createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex'),
  ]),
);

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, release_id: manifest.release_id, asset_count: Object.keys(manifest.asset_hashes_sha256).length }, null, 2));
