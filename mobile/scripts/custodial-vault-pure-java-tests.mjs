import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Offline pure-Java lane: no Gradle, Android app build, emulator or download.
// Supply the three existing dependency JAR paths explicitly.
const jars = ['JUNIT_JAR', 'HAMCREST_JAR', 'JSON_JAR'].map(name => {
  if (!process.env[name]) throw new Error(`${name} must name an existing local dependency JAR`);
  return resolve(process.env[name]);
});
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../plugins/custodial-native-vault/android/src');
const main = join(root, 'main/java/org/memphiszoo/custodial/vault');
const test = join(root, 'test/java/org/memphiszoo/custodial/vault');
const sources = readdirSync(main).filter(name => name.endsWith('.java'))
  .map(name => join(main, name))
  .filter(path => !/^import (?:android\.|androidx\.|com\.getcapacitor\.)/m.test(readFileSync(path, 'utf8')));
const selected = process.argv.slice(2);
const tests = selected.length ? selected : ['VaultEngineTest', 'VaultSnapshotCodecTest'];
for (const name of tests) if (!/^[A-Za-z][A-Za-z0-9]*Test$/.test(name)) throw new Error('Invalid test class');
const temporary = mkdtempSync(join(tmpdir(), 'custodial-vault-pure-java-'));
console.log(`Owned temporary classes: ${temporary}; cleanup: remove exact directory on completion/failure`);
try {
  const classpath = jars.join(':');
  for (const [command, args] of [
    ['javac', ['-cp', classpath, '-d', temporary, ...sources, join(test, 'VaultTestDoubles.java'), ...tests.map(name => join(test, `${name}.java`))]],
    ['java', ['-cp', `${temporary}:${classpath}`, 'org.junit.runner.JUnitCore', ...tests.map(name => `org.memphiszoo.custodial.vault.${name}`)]],
  ]) {
    const result = spawnSync(command, args, { stdio: 'inherit', timeout: 120000 });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status || 1; break; }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
  console.log(`Removed owned temporary classes: ${temporary}`);
}
