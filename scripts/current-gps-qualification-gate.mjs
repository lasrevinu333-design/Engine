import {coreChildEnvironment} from './custodial-core-release-gate.mjs';
// Additive owning lane. The original 79-suite dispatcher and every suite run
// without subset flags. Passing remains source/synthetic, not release approval.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCurrentGpsInventory} from './current-gps-qualification-source-boundary.mjs';
import {readCoreNativeFixtureClasspath} from './core-native-fixture.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(process.argv.length,2,'GPS qualification accepts no skip/subset flags');
assertCurrentGpsInventory();
function node(script,timeout=120000){
 console.log('GPS_OWNING_SUITE',script);
 const result=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024,env:coreChildEnvironment()});
 if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 assert.equal(result.status,0,script+' failed: '+(result.error?.message||result.signal||result.status));
 assertCurrentGpsInventory();
}
for(const script of ['scripts/current-gps-source-qualification-tests.mjs','scripts/current-gps-native-lifecycle-tests.mjs',
 'scripts/custodial-dex-semantic-verifier-tests.mjs','scripts/custodial-android-manifest-security-contract-tests.mjs',
 'scripts/native-mobile-build-contract-tests.mjs',
 'scripts/assigned-phone-location-dashboard-tests.mjs','scripts/gps-native-history-renderer-tests.mjs',
 'scripts/current-gps-historical-preservation-tests.mjs','scripts/custodial-core-release-gate-tests.mjs'])node(script);
// This reads the CURRENT full compiled source fixture, not projected classes.
const cp=readCoreNativeFixtureClasspath();
const junit=spawnSync('/usr/bin/java',['-Xmx256m','-cp',cp,'org.junit.runner.JUnitCore','org.memphiszoo.custodial.vault.RequestPolicyTest'],{cwd:root,encoding:'utf8',timeout:60000,env:coreChildEnvironment()});
assert.equal(junit.status,0,junit.stdout+junit.stderr);assert.match(junit.stdout,/OK \(9 tests\)/);process.stdout.write(junit.stdout);
node('scripts/custodial-core-release-gate.mjs',660000);assertCurrentGpsInventory();
console.log(JSON.stringify({status:'PASS_CURRENT_GPS_OWNING_AND_FULL_CORE_SOURCE_SYNTHETIC',core_suites:79,original_dispatcher_unchanged:true,historical_proofs_separate:true,runtime_admission:false,release_admission:false,physical_phone:false}));
