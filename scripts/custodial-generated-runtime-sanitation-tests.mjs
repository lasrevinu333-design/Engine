// Synthetic byte readers call the actual exported artifact-verifier function.
// No APK, generated distribution, build, native tools or verifier CLI is used.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { assertEmbeddedRuntimeAssets } from '../mobile/scripts/verify-custodial-android-release.mjs';
import { inspectSourceRuntimeRecords } from './lib/runtime-sanitation-policy.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let checks = 0;
const failures = [];
function test(name, run) {
  checks += 1;
  try { run(); } catch { failures.push(name); }
}
function fixture(entries = [['app.js', 'const value="ordinary employee app";']], extraManifest = {}) {
  const data = new Map(entries.map(([path, bytes]) => ['assets/public/' + path, Buffer.from(bytes)]));
  const manifest = { schema_version: 1, asset_count: entries.length,
    asset_hashes_sha256: Object.fromEntries(entries.map(([path]) => [path, sha(data.get('assets/public/' + path))])
      .sort(([left], [right]) => left.localeCompare(right))), ...extraManifest };
  data.set('assets/public/runtime-asset-manifest.json', Buffer.from(JSON.stringify(manifest)));
  data.set('assets/public/cordova.js', Buffer.alloc(0));
  data.set('assets/public/cordova_plugins.js', Buffer.alloc(0));
  const calls = new Map();
  return { data, calls, manifest, arguments: { runtimeAssetManifest: manifest,
    zipEntries: [...data.keys()].sort(), readEntry(path) {
      calls.set(path, (calls.get(path) || 0) + 1);
      if (!data.has(path)) throw new Error('Unknown synthetic entry');
      return data.get(path);
    } } };
}
function verify(value) { return assertEmbeddedRuntimeAssets(value.arguments); }
function prohibited(name, entries, expected, extraManifest) {
  test(name, () => {
    const value = fixture(entries, extraManifest);
    let failure;
    try { verify(value); } catch (error) { failure = error; }
    assert.ok(failure, 'Correctly hashed prohibited bytes must reject');
    const findings = JSON.parse(failure.message);
    assert.ok(findings.some(row => row.rule === expected));
    for (const row of findings) {
      assert.deepEqual(Object.keys(row).sort(), ['path', 'rule', 'sha256']);
      assert.equal(row.sha256, sha(value.data.get('assets/public/' + row.path)));
    }
    assert.equal(failure.message.includes('DO_NOT_LOG_CANARY'), false);
    assert.equal(failure.message.includes('BEGIN PRIVATE KEY'), false);
  });
}

test('ordinary asset preserves exact success shape', () => {
  const value = fixture();
  assert.deepEqual(verify(value), { runtime_asset_count: 1, runtime_assets_verified: true,
    capacitor_generated_assets_sha256: { 'cordova.js': sha(Buffer.alloc(0)), 'cordova_plugins.js': sha(Buffer.alloc(0)) } });
});
prohibited('valid-hash nested MOXIE URL', [['nested/app.js', 'fetch("/moxie/health")']], 'retired-moxie-source-surface');
prohibited('valid-hash retired filename', [['moxie.html', '<p>retired</p>']], 'retired-moxie-source-path');
prohibited('valid-hash fixture path', [['nested/fixtures/sample.json', '{}']], 'test-artifact-runtime-path');
prohibited('valid-hash private marker', [['app.js', '"-----BEGIN PRIVATE KEY----- DO_NOT_LOG_CANARY"']], 'literal-private-key-marker');
prohibited('raw manifest marker', undefined, 'literal-private-key-marker', { synthetic: '-----BEGIN PRIVATE KEY----- DO_NOT_LOG_CANARY' });
test('hash mismatch remains rejected', () => {
  const value = fixture(); value.data.set('assets/public/app.js', Buffer.from('changed'));
  assert.throws(() => verify(value), /runtime asset hash differs/);
});
test('nonempty Cordova remains rejected', () => {
  const value = fixture(); value.data.set('assets/public/cordova.js', Buffer.from('changed'));
  assert.throws(() => verify(value), /placeholder must be exactly empty/);
});
test('missing public entry remains rejected', () => {
  const value = fixture(); value.arguments.zipEntries.pop();
  assert.throws(() => verify(value), /runtime graph differs/);
});
test('extra public entry remains rejected', () => {
  const value = fixture(); value.arguments.zipEntries.push('assets/public/extra.js');
  assert.throws(() => verify(value), /runtime graph differs/);
});
test('duplicate public entry remains rejected', () => {
  const value = fixture(); value.arguments.zipEntries.push('assets/public/app.js');
  assert.throws(() => verify(value), /2 times/);
});

test('legitimate public/config/native/recovery bytes stay permitted', () => {
  const value = fixture([
    ['app.js', 'const private_key=config.private_key; const name="MOXIE_WEB_PASSWORD"; fetch("https://localhost/employee-schedule.html"); request("/memphis/thread");'],
    ['ca.pem', '-----BEGIN CERTIFICATE-----\nSYNTHETIC_PUBLIC'],
    ['public-release-key.pem', '-----BEGIN PUBLIC KEY-----\nSYNTHETIC_PUBLIC'],
    ['google-services.json', '{"client_info":{"mobilesdk_app_id":"public-app-identity"}}'],
    ['manager-ux.css', '.shared-style{color:green}'],
    ['recovery.js', 'preserveProtectedWorkAndHistoricalAttachments();'],
  ]);
  assert.equal(verify(value).runtime_asset_count, 6);
});
test('each public entry read exactly once by this function', () => {
  const value = fixture(), reader = value.arguments.readEntry;
  value.arguments.readEntry = path => {
    assert.equal(value.calls.has(path), false, 'no post-hash second read');
    return reader(path);
  };
  verify(value);
  assert.deepEqual([...value.calls.keys()].sort(), [...value.data.keys()].sort());
});
function copiedBytesCase(verifier) {
  const value = fixture([['a.js', 'fetch("/moxie/health")'], ['b.js', 'ordinary()']]);
  const reader = value.arguments.readEntry;
  value.arguments.readEntry = path => {
    if (path === 'assets/public/b.js') value.data.get('assets/public/a.js').fill(32);
    return reader(path);
  };
  assert.throws(() => verifier(value.arguments), /retired-moxie-source-surface/,
    'later reader mutation must not replace bytes that passed the hash check');
}
test('verified byte copies survive later reader-buffer mutation', () => copiedBytesCase(assertEmbeddedRuntimeAssets));
test('caller cannot select source-owner or skip sanitation', () => {
  const value = fixture([['fixtures/sample.json', '{}']]);
  assert.throws(() => assertEmbeddedRuntimeAssets({ ...value.arguments, scope: 'source-owner',
    skipSanitation: true, sanitationFindings: [] }), /test-artifact-runtime-path/);
});
for (const [name, mutate, pattern] of [
  ['case collision', value => value.arguments.zipEntries.push('assets/public/APP.js'), /collide by case/],
  ['backslash entry', value => value.arguments.zipEntries.push('assets\\public\\extra.js'), /backslash-qualified/],
  ['unsafe ledger path', value => { value.manifest.asset_hashes_sha256 = { '../app.js': sha(Buffer.alloc(0)) }; }, /unsafe asset path/],
  ['count mismatch', value => { value.manifest.asset_count += 1; }, /asset count/],
  ['schema mismatch', value => { value.manifest.schema_version = 2; }, /schema is unsupported/],
  ['missing reader', value => { delete value.arguments.readEntry; }, /requires an entry reader/],
]) test(name + ' unchanged gate', () => { const value = fixture(); mutate(value); assert.throws(() => verify(value), pattern); });
test('sanitation byte bound is still enforced', () => {
  const value = fixture([['app.js', 'x'.repeat(16 * 1024 * 1024 + 1)]]);
  assert.throws(() => verify(value), /byte bound exceeded/);
});
test('no invented native-resource scanning outside public scope', () => {
  const value = fixture(); value.arguments.zipEntries.push('assets/nonpublic.bin', 'classes.dex');
  assert.equal(verify(value).runtime_assets_verified, true);
  assert.equal(value.calls.has('assets/nonpublic.bin') || value.calls.has('classes.dex'), false);
});

// Mutation checks operate on function source in memory only. Normal functional
// cases above import/call the real exported verifier, never a reimplementation.
const verifierSource = readFileSync(new URL('../mobile/scripts/verify-custodial-android-release.mjs', import.meta.url), 'utf8');
const admissionSource = readFileSync(new URL('../mobile/scripts/admit-custodial-codemagic-build.mjs', import.meta.url), 'utf8');
const bootstrapSource = readFileSync(new URL('../mobile/scripts/run-custodial-codemagic-admission.mjs', import.meta.url), 'utf8');
function between(source, begin, end) {
  const start = source.indexOf(begin), finish = source.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && finish > start && source.indexOf(begin, start + 1) < 0, 'exact source boundary');
  return source.slice(start, finish);
}
const functionSource = between(verifierSource, 'export function assertEmbeddedRuntimeAssets(', '\nexport function assertCustodialNativeSecurityBoundary(');
const helpers = between(verifierSource, 'function normalizedRuntimeAssetPath(', '\nexport function assertEmbeddedRuntimeAssets(')
  + between(verifierSource, 'function normalizedSha256(', '\nfunction positiveInteger(');
function changedOnce(source, from, to) {
  assert.equal(source.includes(from), true, 'mutation input exists');
  return source.replace(from, to);
}
function compiled(source) {
  return vm.runInNewContext(helpers + '\n' + source.replace('export function', 'function')
    + '\nassertEmbeddedRuntimeAssets;', { Buffer, sha256: sha, inspectSourceRuntimeRecords }, { timeout: 1000 });
}
function assertionSample(verifier, kind) {
  if (kind === 'copy') return copiedBytesCase(verifier);
  if (kind === 'second-read') {
    const value = fixture(), reader = value.arguments.readEntry;
    value.arguments.readEntry = path => { assert.equal(value.calls.has(path), false); return reader(path); };
    verifier(value.arguments); return;
  }
  const value = kind === 'manifest' ? fixture(undefined, { synthetic: '-----BEGIN PRIVATE KEY----- DO_NOT_LOG_CANARY' })
    : kind === 'fixture' ? fixture([['fixtures/data.json', '{}']])
      : fixture([['app.js', '"/moxie/health"; "DO_NOT_LOG_CANARY";']]);
  let error;
  try { verifier(value.arguments); } catch (failure) { error = failure; }
  assert.ok(error, 'sanitation must reject');
  assert.equal(error.message.includes('DO_NOT_LOG_CANARY'), false);
  const findings = JSON.parse(error.message);
  assert.ok(findings.length > 0);
  for (const row of findings) assert.deepEqual(Object.keys(row).sort(), ['path', 'rule', 'sha256']);
}
const mutations = [
  ['omit policy invocation', 'const sanitationFindings = inspectSourceRuntimeRecords(sanitationRecords);', 'const sanitationFindings = [];', 'route'],
  ['omit enforcement', 'if (sanitationFindings.length) throw new Error(JSON.stringify(sanitationFindings));', '', 'route'],
  ['omit asset record', "sanitationRecords.push({ path, bytes, scope: 'runtime-source' });", '', 'route'],
  ['weaken scope', "scope: 'runtime-source'", "scope: 'source-owner'", 'fixture'],
  ['second-read substitution', "sanitationRecords.push({ path, bytes, scope: 'runtime-source' });", "sanitationRecords.push({ path, bytes: Buffer.from(readEntry(`assets/public/${path}`)), scope: 'runtime-source' });", 'second-read'],
  ['omit byte copy', 'const bytes = Buffer.from(readEntry(`assets/public/${path}`));', 'const bytes = readEntry(`assets/public/${path}`);', 'copy'],
  ['leaky diagnostics', 'JSON.stringify(sanitationFindings)', 'sanitationRecords.map(record => record.bytes.toString()).join("\\n")', 'route'],
  ['omit raw manifest', "sanitationRecords.push({ path: 'runtime-asset-manifest.json',\n    bytes: Buffer.from(readEntry('assets/public/runtime-asset-manifest.json')), scope: 'runtime-source' });", '', 'manifest'],
];
for (const [name, from, to, kind] of mutations) test('kills ' + name, () => {
  assertionSample(compiled(functionSource), kind);
  assert.throws(() => assertionSample(compiled(changedOnce(functionSource, from, to)), kind));
});

const releaseDigestSource = between(verifierSource, 'function releaseAcceptanceSourceDigest(', '\nfunction normalizedSha256(');
const admissionDigestSource = between(admissionSource, 'function admissionVerifierSourceDigest(', '\nexport const CUSTODIAL_CODEMAGIC_ADMISSION_SOURCE_SHA256');
function digest(source, kind, changedPolicy) {
  const names = ['scriptPath', 'androidManifestSecurityVerifierPath', 'toolchainPolicyVerifierPath',
    'capacitorRuntimePolicyPath', 'immutableSnapshotVerifierPath', 'runtimeSanitationPolicyPath',
    'backupVerifierPath', 'dexSemanticVerifierPath', 'runtimeSourceVerifierPath', 'admissionSchemaPath',
    'policyPath', 'forwardRecoveryPolicyPath', 'hostToolPolicyPath', 'bootstrapPath', 'releaseVerifierPath'];
  const context = Object.fromEntries(names.map(name => [name, '/synthetic/' + name]));
  context.runtimeSanitationPolicyPath = '/synthetic/scripts/lib/runtime-sanitation-policy.mjs';
  Object.assign(context, { Buffer, URL, fileURLToPath, createHash, sha256: sha,
    readFileSync(path) { return Buffer.from(String(path).endsWith('/scripts/lib/runtime-sanitation-policy.mjs')
      ? (changedPolicy ? 'changed synthetic policy' : 'original synthetic policy') : 'unchanged:' + path); } });
  return vm.runInNewContext(source.replaceAll('import.meta.url', '"file:///synthetic/mobile/scripts/admit-custodial-codemagic-build.mjs"')
    + `\n${kind}();`, context, { timeout: 1000 });
}
for (const [source, kind] of [[releaseDigestSource, 'releaseAcceptanceSourceDigest'], [admissionDigestSource, 'admissionVerifierSourceDigest']]) {
  test(kind + ' binds policy bytes and kills omitted dependency', () => {
    assert.notEqual(digest(source, kind, false), digest(source, kind, true));
    const mutant = source.replace(/^.*\['runtime-sanitation-policy\.mjs'.*\r?\n/m, '');
    assert.notEqual(mutant, source);
    assert.equal(digest(mutant, kind, false), digest(mutant, kind, true));
  });
}
function snapshotBound(source) {
  for (const name of ['snapshotPathspecs', 'requiredSnapshotPaths']) {
    const block = source.match(new RegExp(`const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`));
    assert.ok(block);
    assert.ok(block[1].includes("'scripts/lib/runtime-sanitation-policy.mjs'"));
    assert.equal(/['"]scripts\/?['"]/.test(block[1]), false, 'no broad root scripts snapshot');
  }
}
test('exact policy snapshot and required-path suppression are guarded', () => {
  snapshotBound(bootstrapSource);
  const needle = "  'scripts/lib/runtime-sanitation-policy.mjs',\n";
  assert.equal(bootstrapSource.split(needle).length, 3);
  assert.throws(() => snapshotBound(bootstrapSource.replace(needle, '')));
  const last = bootstrapSource.lastIndexOf(needle);
  assert.throws(() => snapshotBound(bootstrapSource.slice(0, last) + bootstrapSource.slice(last + needle.length)));
});
test('accepted policy bytes remain unchanged', () => {
  assert.equal(sha(readFileSync(new URL('./lib/runtime-sanitation-policy.mjs', import.meta.url))),
    '8786e9ff5b7539aeecc1d3cd04cbc443c8b6886a95523fd2664931827b351c36');
});

console.log(JSON.stringify({ ok: failures.length === 0, checks, failed_cases: failures,
  scope: 'actual exported verifier with synthetic bytes only', artifact_verified: false }));
if (failures.length) process.exitCode = 1;
