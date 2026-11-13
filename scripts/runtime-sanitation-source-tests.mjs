import assert from 'node:assert/strict';
import { readFileSync, lstatSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import vm from 'node:vm';
import { discoverRuntimeFiles } from './refresh-frontend-release-manifest.mjs';
import { assertSourceRuntimeSanitation, inspectSourceRuntimeRecords } from './lib/runtime-sanitation-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
function check(value, expected, message) { assert.deepEqual(value, expected, message); checks += 1; }
const rec = (path, value = '', scope = 'runtime-source') => ({ path, bytes: Buffer.from(value), scope });
const rules = records => inspectSourceRuntimeRecords(records).map(row => row.rule);
function rejected(record, rule) {
  const findings = inspectSourceRuntimeRecords([record]);
  check(findings.some(row => row.rule === rule), true, rule);
  assert.throws(() => assertSourceRuntimeSanitation([record])); checks += 1;
  for (const finding of findings) {
    check(Object.keys(finding).sort(), ['path', 'rule', 'sha256']);
    check(finding.sha256, createHash('sha256').update(record.bytes).digest('hex'));
  }
}

// Real fail-before coverage demonstration: run the unchanged old finite checker
// against an in-memory source overlay. A new runtime asset outside its named
// files is invisible to it; the new actual-graph policy must reject that record.
const oldPath = resolve(root, 'scripts/moxie-decommission-tests.mjs');
const oldSource = readFileSync(oldPath, 'utf8');
const oldBody = oldSource.replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(new URL('../scripts/moxie-decommission-tests.mjs', import.meta.url).href));
check((oldSource.match(/^import /gm) || []).length, 2, 'exact inherited checker imports');
const resurrection = rec('nested/new-runtime.js', 'fetch("/moxie/health")');
let legacyPassed = false;
vm.runInNewContext(oldBody, {
  assert, URL,
  existsSync: value => fileURLToPath(value) === resolve(root, resurrection.path) || existsSync(value),
  readFileSync: (value, encoding) => fileURLToPath(value) === resolve(root, resurrection.path)
    ? resurrection.bytes.toString(encoding) : readFileSync(value, encoding),
  console: { log: value => { legacyPassed = value === 'MOXIE_DECOMMISSION_FRONTEND_PASS'; } },
}, { timeout: 1000 });
check(legacyPassed, true, 'old finite source checker misses new runtime asset');
rejected(resurrection, 'retired-moxie-source-surface');
rejected(rec('nested/encoded%2ejs', '/moxie/health'), 'retired-moxie-source-surface');

for (const source of ['/moxie/', '/moxie?x=1', '/moxie-mobile-api/health', 'moxie-link',
  'ANNIE_RETURN_URL', 'createMoxieRouter', 'installAnnieMoxieRoutes', 'Moxie_Owl_Icon_ui.webp',
  String.raw`\/moxie\/health`, '%2fmoxie%2fhealth', '%252fmoxie%252fhealth',
  String.raw`\u002fmoxie\u002fhealth`, '&#x2f;moxie&#47;health']) {
  rejected(rec('nested/shipping.js', source), 'retired-moxie-source-surface');
}
for (const path of ['moxie.html', 'mobile/src/manager/moxie.js', 'moxie-assets/owl.webp',
  'Moxie_Owl_Icon_ui.webp', 'nested/%6doxie.html']) {
  rejected(rec(path), 'retired-moxie-source-path');
}
for (const path of ['tests/runtime.js', 'nested/fixtures/phone.json', 'page.spec.js', 'bundle.js.map']) {
  rejected(rec(path), 'test-artifact-runtime-path');
}
for (const path of ['.env', 'nested/.env.production', 'private.key', 'release.jks',
  'service-account.json', 'firebase-adminsdk-worker.json']) {
  rejected(rec(path), 'private-material-runtime-path');
}
for (const type of ['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY', 'OPENSSH PRIVATE KEY',
  'ENCRYPTED PRIVATE KEY', 'PGP PRIVATE KEY BLOCK']) {
  rejected(rec('app.js', `const value="-----BEGIN ${type}-----\\nSYNTHETIC_ONLY_DO_NOT_LOG";`),
    'literal-private-key-marker');
}
const sensitiveFixture = rec('app.json', JSON.stringify({ private_key: '-----BEGIN PRIVATE KEY-----\nDO_NOT_LOG_CANARY' }));
let failure = '';
try { assertSourceRuntimeSanitation([sensitiveFixture]); } catch (error) { failure = error.message; }
check(failure.includes('DO_NOT_LOG_CANARY'), false, 'no raw material diagnostics');
check(failure.includes('BEGIN PRIVATE KEY'), false, 'no marker snippet diagnostics');
check(Object.keys(JSON.parse(failure)[0]).sort(), ['path', 'rule', 'sha256']);

for (const [path, source, scope] of [
  ['app.js', 'const private_key = config.private_key; const token = response.token;', 'runtime-source'],
  ['public-release-key.pem', '-----BEGIN PUBLIC KEY-----\nSYNTHETIC_PUBLIC', 'runtime-source'],
  ['ca.pem', '-----BEGIN CERTIFICATE-----\nSYNTHETIC_PUBLIC', 'runtime-source'],
  ['google-services.json', '{"client_info":{"mobilesdk_app_id":"public-app-identity"}}', 'runtime-source'],
  ['manager-ux.css', '.manager-shared-style{color:green}', 'runtime-source'],
  ['app.js', 'fetch("https://localhost/employee-schedule.html"); request("/memphis/thread");', 'runtime-source'],
  ['recovery.js', 'restoreProtectedAttachments(); preserveOriginalActor();', 'runtime-source'],
  ['src/config/env.js', 'const password = env.MOXIE_WEB_PASSWORD;', 'source-owner'],
  ['mobile/scripts/build.mjs', 'dropLabels: ["MZ_CUSTODIAL_BROWSER_TEST"]', 'source-owner'],
]) check(rules([rec(path, source, scope)]), [], 'permitted scoped source: ' + path);
check(rules([rec('app.js'), rec('APP.js')]), ['duplicate-or-case-colliding-source-path']);
rejected(rec('%2e%2e/escape.js'), 'encoded-unsafe-source-path');
for (const path of ['../escape.js', '/absolute.js', 'app\\escape.js', 'a\n.js']) {
  assert.throws(() => inspectSourceRuntimeRecords([rec(path)]), /record shape\/path\/scope/); checks += 1;
}
assert.throws(() => inspectSourceRuntimeRecords([]), /bounded nonempty/); checks += 1;
assert.throws(() => inspectSourceRuntimeRecords([rec('safe.js', '', 'unreviewed')]), /scope/); checks += 1;
assert.throws(() => inspectSourceRuntimeRecords([{ ...rec('safe.js'), bytes: 'not bytes' }]), /shape/); checks += 1;
assert.throws(() => inspectSourceRuntimeRecords([rec('safe.js', 'x'.repeat(16 * 1024 * 1024 + 1))]), /byte bound/); checks += 1;

// This uses the existing source graph, not build output. Explicit owners cover
// additional source/build paths absent from that root HTML graph. No home/env,
// node_modules, SQL, private-key store, generated output or history traversal.
const graph = discoverRuntimeFiles(root);
const owners = ['mobile/scripts/build.mjs', 'mobile/src/manager/index.html', 'mobile/src/manager/app.js',
  'mobile/src/shell/roles/manager/routes.ts', 'mobile/src/shared/mobile-bridge.js',
  'mobile/src/chatscope/app.jsx', 'mobile/src/chatscope/home-assistant-entry.mjs',
  'mobile/src/custodial/index.html', 'mobile/src/custodial/app.js', 'mobile/src/custodial/bridge.js'];
const paths = [...graph.map(path => [path, 'runtime-source']),
  ...owners.filter(path => !graph.includes(path)).map(path => [path, 'source-owner'])];
const actual = paths.map(([path, scope]) => {
  const absolute = resolve(root, path);
  assert.ok(!relative(root, absolute).startsWith('..'), 'bounded source path');
  const stat = lstatSync(absolute);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'regular source file');
  return { path, scope, bytes: readFileSync(absolute) };
});
const result = assertSourceRuntimeSanitation(actual); checks += 1;
console.log(JSON.stringify({ ok: true, checks, source_runtime_files: graph.length,
  explicit_source_owners: owners.length, records: result.records,
  legacy_finite_checker_missed_synthetic_resurrection: legacyPassed,
  scope: result.scope, absence_of_secrets_proven: false, generated_artifact_verified: false }));
