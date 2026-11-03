import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Offline javac/JUnit against the actual installed Android SDK API stubs.
// No APK, Gradle, emulator, AndroidKeyStore instrumentation or network proof.
const required = ['JUNIT_JAR', 'HAMCREST_JAR', 'JSON_JAR', 'ANDROID_API_JAR'];
const jars = required.map(name => {
  if (!process.env[name]) throw new Error(`${name} must identify an existing local JAR`);
  const path = resolve(process.env[name]);
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) throw new Error(`${name} does not identify an existing local JAR: ${path}`);
  return path;
});
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../plugins/custodial-native-vault/android/src');
const main = join(root, 'main/java/org/memphiszoo/custodial/vault');
const test = join(root, 'test/java/org/memphiszoo/custodial/vault');
const androidOwners = new Set(['AndroidProviderClockReadings.java', 'AndroidProviderCipher.java', 'AndroidProviderStore.java', 'AndroidProviderAppIdentity.java', 'AndroidProviderNotifications.java', 'AndroidProviderJobs.java', 'AndroidProviderActionIntent.java', 'AndroidKeystoreCipher.java']);
androidOwners.add('AndroidReadOnlyPreferences.java');
androidOwners.add('AndroidProtectedWorkPreferences.java');
androidOwners.add('AndroidOfflineAuthorityTimeStore.java');
androidOwners.add('AndroidProviderPlatform.java');
const sources = readdirSync(main).filter(name => name.endsWith('.java'))
  .filter(name => androidOwners.has(name) || !/^import (?:android\.|androidx\.|com\.getcapacitor\.)/m.test(readFileSync(join(main, name), 'utf8')))
  .map(name => join(main, name));
const tests = ['ProviderEnvelopeCryptoTest', 'ProviderRecordStoreTest', 'AndroidProviderAdapterTest', 'NativeProviderJournalTest',
  'NativeProviderClockExchangeTest', 'NativeProviderRequestPolicyTest', 'RequestPolicyTest', 'NativeProviderAppIdentityTest', 'ProviderWireJsonTest', 'NativeProviderRegistrationReceiptTest', 'NativeProviderPayloadTest', 'NativeProviderIngressTest', 'OfflineAuthorityTimeTest', 'NativeProviderHttpTest', 'NativeProviderEventReceiptsTest', 'NativeProviderInventoryTest', 'NativeProviderPresentationTest', 'NativeProviderDisplayDriverTest', 'NativeProviderJobBudgetTest', 'NativeProviderCompactionTest', 'NativeProviderJobLifecycleTest', 'NativeProviderActionIntentTest', 'NativeProviderRegistrationCoordinatorTest', 'NativeProviderFirebaseDispatchTest'];
tests.push('NativeProviderRuntimeOwnerTest');
tests.push('NativeReadinessObservationTest');
tests.push('VaultRemovalTransportTest');
tests.push('NativeProviderTimeTest');
tests.push('NativeProviderClockOwnerTest');
tests.push('NativeProviderIntervalLifecycleTest');
tests.push('NativeProviderCompositionTest');
tests.push('NativeProviderMirrorTest');
tests.push('NativeProviderMaintenanceTest');
tests.push('NativeProviderFailureDispositionTest');
tests.push('NativeProviderEventDecisionsTest');
const fixtureSources = ['VaultTestDoubles', 'NativePrincipalJournalTest', 'NativeLegacyLineageJournalTest'];
// Cross-repository boundary runs only with an explicit actual-SQL fixture.
if (process.env.NATIVE_LOCATION_WIRE_FIXTURE) tests.push('NativeProviderSqlWireTest');
if (process.env.NATIVE_LUNCH_WIRE_FIXTURE) tests.push('NativeProviderLunchSqlWireTest');
if (process.env.NATIVE_LOCATION_INVENTORY_FIXTURE) tests.push('NativeProviderInventorySqlWireTest');
if (process.env.NATIVE_PROVIDER_EVENTS_FIXTURE) tests.push('NativeProviderEventSqlWireTest', 'NativeProviderIntervalSqlWireTest');
// Explicit three-phase test-only bridge. Default suite remains unchanged.
const prepareDecision = process.argv[2] === '--prepare-event-decision-fixture';
assert.ok(process.argv.length === 2 || (prepareDecision && process.argv.length === 4), 'only explicit bounded preparation mode is supported');
const decisionFixture = process.env.NATIVE_PROVIDER_EVENT_DECISION_FIXTURE;
assert.ok(!(prepareDecision && decisionFixture), 'preparation and consumption are separate phases');
const repo = resolve(root, '../../../../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// BEGIN exact event-decision migration authority (pure; no JAR/process access).
function assertProviderDecisionSqlManifest(rows, profile = 'CURRENT_219') {
  assert.ok(profile === 'CURRENT_219' || profile === 'HISTORICAL_218', 'explicit supported manifest profile required');
  assert.ok(Array.isArray(rows));
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ['file', 'sha256']);
    assert.match(row.file, /^\d{14}_[a-zA-Z0-9_]+\.sql$/); assert.match(row.sha256, /^[0-9a-f]{64}$/);
  }
  assert.deepEqual(rows.map(row => row.file), [...new Set(rows.map(row => row.file))].sort());
  const message = { file: '20261003121757_employee_message_source_admission.sql', sha256: '20ff06f8c0c5e82814189e1e2969b928ffa48eb1181098a73156962dc9ac1e7f' };
  let historical = rows;
  if (profile === 'CURRENT_219') {
    assert.equal(rows.length, 219);
    assert.deepEqual(rows.filter(row => row.file === message.file), [message]);
    assert.deepEqual(rows[205], message, 'exact MESSAGE insertion before13 later migrations');
    assert.equal(sha(JSON.stringify(rows)), '4795b9525622e1512005f85ae1c5994971dccc3d54a987a743bdcfef8bf9ce32');
    historical = rows.filter(row => row.file !== message.file);
  }
  assert.equal(historical.length, 218);
  assert.equal(sha(JSON.stringify(historical)), '24503cfe852d7668ac94744b2f9ed21d8d2556906b917c7016e0f6c2d3b8d7a1');
  assert.deepEqual(rows.at(-1), { file: '20261004000000_native_provider_event_decision_lookup.sql', sha256: 'ab4e6eb848bd214f8616fb52f094829786df9a9a81d2eb8d00d247b1f28e52fd' });
  return { profile, migration_count: rows.length, manifest_sha256: sha(JSON.stringify(rows)) };
}
// END exact event-decision migration authority.
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', timeout: 10000 }).trim();
const wireClass = 'NativeProviderEventDecisionSqlWireTest';
let preparationDirectory, frontendBinding;
if (prepareDecision || decisionFixture) {
  assert.equal(git('status', '--porcelain'), '', 'committed clean fixture source required');
  const files = [...sources, ...[...new Set([...fixtureSources, ...tests, wireClass])].map(name => join(test, `${name}.java`)), fileURLToPath(import.meta.url)]
    .map(path => ({ path: relative(repo, path), sha256: sha(readFileSync(path)) })).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  frontendBinding = { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), files, jars: jars.map((path,i) => ({ name: required[i], sha256: sha(readFileSync(path)) })) };
  if (prepareDecision) {
    preparationDirectory = process.argv[3]; assert.ok(isAbsolute(preparationDirectory));
    const st = lstatSync(preparationDirectory);
    assert.ok(st.isDirectory() && !st.isSymbolicLink() && st.uid === process.getuid()); assert.equal(st.mode & 0o077, 0);
    assert.equal(realpathSync(preparationDirectory), preparationDirectory); assert.ok(!preparationDirectory.startsWith(repo + '/'));
    assert.equal(readdirSync(preparationDirectory).length, 0, 'own private empty preparation directory');
  } else {
    const st = lstatSync(decisionFixture); assert.ok(st.isFile() && !st.isSymbolicLink() && st.uid === process.getuid() && st.size <= 2097152);
    assert.equal(realpathSync(decisionFixture), decisionFixture); assert.equal(st.mode & 0o077, 0);
    assert.match(process.env.NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256 || '', /^[0-9a-f]{64}$/, 'explicit actual fixture hash required');
    const raw = readFileSync(decisionFixture); assert.equal(sha(raw), process.env.NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256);
    const value = JSON.parse(raw); assert.equal(value.schema, 'custodial.native-provider-event-decision-wire-fixture.v1');
    for (const flag of ['synthetic','actual_sql','actual_http_hmac','cleanup_verified']) assert.equal(value[flag], true);
    assert.equal(value.production, false); assert.deepEqual(value.native_input.frontend, frontendBinding, 'same complete Java source/JAR inputs as query preparation');
    assert.match(value.native_input_sha256, /^[0-9a-f]{64}$/);
    assert.equal(sha(JSON.stringify(value.native_input,null,2)+'\n'),value.native_input_sha256,'included native preparation bytes retain original serialization identity');
    const proof = value.sql_fixture_provenance; assert.equal(proof.schema, 'custodial.native-actual-sql-fixture-provenance.v1');
    assert.equal(proof.synthetic, true); assert.equal(proof.production, false); assert.equal(proof.automatic_grants_absent_before_and_after_each, true);
    assertProviderDecisionSqlManifest(proof.migration_manifest, 'CURRENT_219');
    assert.equal(proof.migration_manifest_sha256, sha(JSON.stringify(proof.migration_manifest)+'\n'));
    assert.deepEqual(proof.owning_migration, proof.migration_manifest.at(-1));
    assert.equal(proof.owning_migration.file, '20261004000000_native_provider_event_decision_lookup.sql');
    for (const id of [proof.backend_commit, proof.backend_tree]) assert.match(id, /^[0-9a-f]{40}$/);
    tests.push(wireClass);
  }
}
const owned = mkdtempSync(join(tmpdir(), 'custodial-provider-storage-java-'));
console.log(`Owned temporary classes: ${owned}; cleanup: exact directory in finally`);
const priorMask = process.umask(0o077);
try {
  const classpath = jars.join(':');
  const productionClasspath = [jars[3], jars[0], jars[1]].join(':');
  for (const [command, args] of [
    // Compile production against Android's real API surface/checked JSONException,
    // not desktop org.json's extra methods or unchecked JSONException.
    ['javac', ['-cp', productionClasspath, '-d', owned, ...sources]],
    ['javac', ['-cp', `${owned}:${productionClasspath}`, '-d', owned, ...[...fixtureSources, ...tests, ...(prepareDecision ? [wireClass] : [])].map(name => join(test, `${name}.java`))]],
    ['java', ['-Xmx256m', '-cp', `${owned}:${classpath}:${join(root, 'test/resources')}`, ...(prepareDecision ? [`org.memphiszoo.custodial.vault.${wireClass}`, preparationDirectory] : ['org.junit.runner.JUnitCore', ...tests.map(name => `org.memphiszoo.custodial.vault.${name}`)])]],
  ]) {
    const golden = JSON.stringify(Object.fromEntries(Object.entries({
      z:'Español / </script> 🐘 \u2028 \u2029', a:'quote" slash\\ newline\n tab\t carriage\r back\b form\f null\0 unit\u001f',
    }).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)));
    const result = spawnSync(command, args, { stdio: 'inherit', timeout: 120000, env: {
      ...process.env, PROVIDER_WIRE_GOLDEN: golden, PROVIDER_WIRE_GOLDEN_SHA256: createHash('sha256').update(golden).digest('hex'),
    } });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status || 1; break; }
  }
  if (prepareDecision && !process.exitCode) {
    assert.equal(git('status','--porcelain'),''); assert.equal(git('rev-parse','HEAD'),frontendBinding.commit);
    for (const row of frontendBinding.files) assert.equal(sha(readFileSync(join(repo,row.path))),row.sha256);
    for (const [i,row] of frontendBinding.jars.entries()) assert.equal(sha(readFileSync(jars[i])),row.sha256);
    const value = JSON.parse(readFileSync(join(preparationDirectory, 'native-provider-event-decision-input.json'), 'utf8'));
    assert.deepEqual(Object.keys(value).sort(), ['query','seed','unresolved']);
    assert.equal(sha(Buffer.from(value.query.body_base64,'base64')), value.query.body_sha256);
    const output = { schema:'custodial.native-provider-event-decision-native-input.v1', synthetic:true, production:false, frontend:frontendBinding, ...value };
    const bytes = JSON.stringify(output,null,2)+'\n';
    writeFileSync(join(preparationDirectory,'native-provider-event-decision-prepared.json'), bytes, { flag:'wx', mode:0o600 });
    console.log(JSON.stringify({status:'NATIVE_QUERY_PREPARED',sha256:sha(bytes),sql:false,http:false,qualification:false}));
  }
} finally {
  rmSync(owned, { recursive: true, force: true });
  process.umask(priorMask);
  console.log(`Removed owned temporary classes: ${owned}`);
}
