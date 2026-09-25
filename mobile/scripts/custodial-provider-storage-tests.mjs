import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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
const androidOwners = new Set(['AndroidProviderCipher.java', 'AndroidProviderStore.java', 'AndroidProviderAppIdentity.java', 'AndroidProviderNotifications.java', 'AndroidProviderJobs.java', 'AndroidKeystoreCipher.java']);
const sources = readdirSync(main).filter(name => name.endsWith('.java'))
  .filter(name => androidOwners.has(name) || !/^import (?:android\.|androidx\.|com\.getcapacitor\.)/m.test(readFileSync(join(main, name), 'utf8')))
  .map(name => join(main, name));
const tests = ['ProviderEnvelopeCryptoTest', 'ProviderRecordStoreTest', 'AndroidProviderAdapterTest', 'NativeProviderJournalTest',
  'NativeProviderRequestPolicyTest', 'RequestPolicyTest', 'NativeProviderAppIdentityTest', 'ProviderWireJsonTest', 'NativeProviderRegistrationReceiptTest', 'NativeProviderPayloadTest', 'NativeProviderIngressTest', 'OfflineAuthorityTimeTest', 'NativeProviderHttpTest', 'NativeProviderEventReceiptsTest', 'NativeProviderInventoryTest', 'NativeProviderPresentationTest', 'NativeProviderDisplayDriverTest', 'NativeProviderJobBudgetTest', 'NativeProviderCompactionTest', 'NativeProviderJobLifecycleTest'];
const fixtureSources = ['VaultTestDoubles', 'NativePrincipalJournalTest', 'NativeLegacyLineageJournalTest'];
const owned = mkdtempSync(join(tmpdir(), 'custodial-provider-storage-java-'));
console.log(`Owned temporary classes: ${owned}; cleanup: exact directory in finally`);
try {
  const classpath = jars.join(':');
  const productionClasspath = [jars[3], jars[0], jars[1]].join(':');
  for (const [command, args] of [
    // Compile production against Android's real API surface/checked JSONException,
    // not desktop org.json's extra methods or unchecked JSONException.
    ['javac', ['-cp', productionClasspath, '-d', owned, ...sources]],
    ['javac', ['-cp', `${owned}:${productionClasspath}`, '-d', owned, ...[...fixtureSources, ...tests].map(name => join(test, `${name}.java`))]],
    ['java', ['-Xmx256m', '-cp', `${owned}:${classpath}:${join(root, 'test/resources')}`, 'org.junit.runner.JUnitCore', ...tests.map(name => `org.memphiszoo.custodial.vault.${name}`)]],
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
} finally {
  rmSync(owned, { recursive: true, force: true });
  console.log(`Removed owned temporary classes: ${owned}`);
}
