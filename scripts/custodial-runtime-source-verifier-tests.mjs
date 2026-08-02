import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertCustodialRuntimeMatchesCleanSource } from '../mobile/scripts/verify-custodial-runtime-source.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const fixtureRoot = await mkdtemp(join(tmpdir(), 'custodial-runtime-source-test-'));
try {
  const appBytes = Buffer.from('console.log("custodial");\n');
  const cssBytes = Buffer.from('body{color:#fff}\n');
  await mkdir(join(fixtureRoot, 'nested'));
  await writeFile(join(fixtureRoot, 'app.js'), appBytes);
  await writeFile(join(fixtureRoot, 'nested', 'app.css'), cssBytes);
  const manifest = {
    schema_version: 1,
    asset_count: 2,
    asset_hashes_sha256: {
      'app.js': sha256(appBytes),
      'nested/app.css': sha256(cssBytes),
    },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(fixtureRoot, 'runtime-asset-manifest.json'), manifestBytes);
  const apkEntries = new Map([
    ['assets/public/app.js', appBytes],
    ['assets/public/nested/app.css', cssBytes],
  ]);
  const verify = (overrides = {}) => assertCustodialRuntimeMatchesCleanSource({
    sourceDirectory: fixtureRoot,
    runtimeAssetManifest: manifest,
    runtimeAssetManifestBytes: manifestBytes,
    readEntry: (entry) => apkEntries.get(entry),
    ...overrides,
  });

  const proof = verify();
  assert.equal(proof.clean_source_runtime_match, true);
  assert.equal(proof.clean_source_runtime_asset_count, 2);
  assert.match(proof.clean_source_runtime_tree_sha256, /^[a-f0-9]{64}$/);

  assert.throws(
    () => verify({
      readEntry: (entry) => entry === 'assets/public/app.js' ? Buffer.from('injected') : apkEntries.get(entry),
    }),
    /differs byte-for-byte.*app\.js/,
  );
  assert.throws(
    () => verify({ runtimeAssetManifestBytes: Buffer.from('{}\n') }),
    /manifest differs byte-for-byte/,
  );

  await writeFile(join(fixtureRoot, 'unmanifested.js'), 'unexpected');
  assert.throws(() => verify(), /runtime graph differs.*unexpected: unmanifested\.js/);
  await rm(join(fixtureRoot, 'unmanifested.js'));

  await writeFile(join(fixtureRoot, 'app.js'), 'changed source');
  assert.throws(() => verify(), /asset differs from its manifest: app\.js/);
  await writeFile(join(fixtureRoot, 'app.js'), appBytes);

  const symlinkPath = join(fixtureRoot, 'nested', 'linked.css');
  await symlink(join(fixtureRoot, 'nested', 'app.css'), symlinkPath);
  assert.throws(() => verify(), /may not contain symlinks: nested\/linked\.css/);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log('Custodial clean runtime-source verifier tests passed.');

