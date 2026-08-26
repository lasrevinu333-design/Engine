#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const read = (path, encoding = 'utf8') => readFile(resolve(mobileRoot, path), encoding);
const editions = {
  manager: { path: '/manager/', name: 'Memphis Zoo Custodial Manager', color: '#081422' },
  viewer: { path: '/viewer/', name: 'Memphis Zoo Custodial Viewer', color: '#0b3d3a' },
};

function pngDimensions(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'icon must be PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const cachePrefixes = new Set();
for (const [edition, expected] of Object.entries(editions)) {
  const base = `src/web-install/${edition}`;
  const manifest = JSON.parse(await read(`${base}/manifest.webmanifest`));
  assert.equal(manifest.name, expected.name);
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope], [expected.path, expected.path, expected.path]);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, expected.color);
  assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ['192x192', '512x512', '512x512']);
  assert.deepEqual(pngDimensions(await read(`${base}/icons/icon-192.png`, null)), [192, 192]);
  assert.deepEqual(pngDimensions(await read(`${base}/icons/icon-512.png`, null)), [512, 512]);
  assert.deepEqual(pngDimensions(await read(`${base}/icons/icon-maskable-512.png`, null)), [512, 512]);
  assert.deepEqual(pngDimensions(await read(`${base}/icons/apple-touch-icon.png`, null)), [180, 180]);

  const worker = await read(`${base}/service-worker.js`);
  assert.equal((worker.match(/__MZ_EXACT_CACHE_ID__/g) || []).length, 1, 'worker cache must bind to the exact source tree');
  assert.match(worker, /credentials:\s*'omit'/, 'precache must not carry a browser credential');
  assert.match(worker, /request\.headers\.has\('authorization'\)/, 'authenticated requests must bypass the cache');
  assert.match(worker, /\[?'script'.*'style'.*'image'.*'font'/s, 'only static asset destinations may be runtime cached');
  assert.match(worker, /no-store\|private/, 'private and no-store responses must not be cached');
  assert.match(worker, /fetch\(event\.request\)\.catch\(\(\) => caches\.match\(absolute\('\.\/offline\.html'\)\)\)/,
    'an unverified offline launch must show the fail-closed offline page');
  assert.doesNotMatch(worker, /cache\.put\([^\n]*(?:api|auth|credential|session)/i, 'sensitive application data must never be cached');
  const prefix = worker.match(/CACHE_PREFIX\s*=\s*'([^']+)'/)?.[1];
  assert.ok(prefix);
  cachePrefixes.add(prefix);

  const html = await read(`src/${edition}/index.html`);
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png"/);
  assert.match(html, /src="\.\/pwa-register\.js"/);
  assert.match(html, /apple-mobile-web-app-capable/);
}
assert.equal(cachePrefixes.size, 2, 'Manager and Viewer cache namespaces must not overlap');

const register = await read('src/shared/pwa-register.js');
assert.match(register, /serviceWorker\.register\('\.\/service-worker\.js',\s*\{\s*scope:\s*'\.\/'\s*\}\)/);
assert.match(register, /location\.protocol === 'file:'/);
const build = await read('scripts/build.mjs');
assert.match(build, /async function installWebAppFiles\(\)/);
assert.match(build, /if \(edition === 'custodial'\) return/);
assert.match(build, /workerTemplate\.replace\('__MZ_EXACT_CACHE_ID__', cacheIdentity\)/);
assert.match(build, /await installWebAppFiles\(\);\s*\nawait buildRoleShell\(\);/);

const viewer = await read('src/viewer/app.js');
assert.doesNotMatch(viewer, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
assert.doesNotMatch(viewer, /feedback-api|manager|credential|enrollment/i);
console.log('WEB_INSTALL_CONTRACT_TESTS_PASS');
