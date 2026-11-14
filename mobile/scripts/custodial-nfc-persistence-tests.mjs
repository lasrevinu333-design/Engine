// Uses the exact full native source fixture; no APK or device work.
// Prerequisite: node scripts/prepare-core-native-fixture.mjs [--offline].
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readCoreNativeFixtureClasspath} from '../../scripts/core-native-fixture.mjs';
assert.equal(process.argv.length,2);
const classpath=readCoreNativeFixtureClasspath();
const result=spawnSync('java',['-Xmx256m','-cp',classpath,'org.junit.runner.JUnitCore',
 'org.memphiszoo.custodial.vault.NfcHandoffPersistenceTest',
 'org.memphiszoo.custodial.vault.PhysicalTagOccurrenceTest'],{stdio:'inherit',timeout:120000});
if(result.error)throw result.error;
assert.equal(result.signal,null,'Native persistence tests must actually finish');
process.exitCode=result.status===0?0:result.status||1;
