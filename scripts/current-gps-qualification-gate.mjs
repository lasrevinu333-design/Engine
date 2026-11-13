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
for(const script of ['scripts/schedule-diagnostic-discovery-tests.mjs','scripts/schedule-diagnostic-qualification-tests.mjs','scripts/current-gps-source-qualification-tests.mjs','scripts/current-provider-comparison-source-tests.mjs','scripts/current-gps-native-lifecycle-tests.mjs',
 'scripts/custodial-dex-semantic-verifier-tests.mjs','scripts/custodial-android-manifest-security-contract-tests.mjs',
 'scripts/native-mobile-build-contract-tests.mjs',
 'scripts/assigned-phone-location-dashboard-tests.mjs','scripts/gps-native-history-renderer-tests.mjs',
 'scripts/current-gps-historical-preservation-tests.mjs','scripts/custodial-core-release-gate-tests.mjs'])node(script);
node('scripts/custodial-employee-experience-contract-tests.mjs');
node('scripts/provider-best-effort-release-tests.mjs');
// Proposed v80 correction coverage. This is additional to every original suite.
// The validator/profile must independently qualify these exact source identities.
const correctionInvocations = [["recurring-regression.mjs","--native-runtime"],["test-bad-status.mjs","--native-runtime"],["test-changing-status.mjs","--native-runtime"],["test-http.mjs","--native-runtime"],["test-status.mjs","--native-runtime"],["test-throwing-status.mjs","--native-runtime"],["test-transport.mjs","--native-runtime"],["response-test.mjs","--native-runtime","--case=1"],["response-test.mjs","--native-runtime","--case=2"],["response-test.mjs","--native-runtime","--case=3"],["response-test.mjs","--native-runtime","--case=unknown"],["response-test.mjs","--native-runtime","--case=getter"],["response-test.mjs","--native-runtime","--case=changing"],["response-test.mjs","--native-runtime","--case=object"],["response-test.mjs","--native-runtime","--case=inherited"],["response-test.mjs","--native-runtime","--case=prefix"],["response-test.mjs","--native-runtime","--case=unknown-fields"],["response-test.mjs","--native-runtime","--case=code-getter"],["response-test.mjs","--native-runtime","--case=readiness-getter"],["response-test.mjs","--native-runtime","--case=projection-getter"],["response-test.mjs","--native-runtime","--case=code0"],["response-test.mjs","--native-runtime","--case=code1"],["response-test.mjs","--native-runtime","--case=code2"],["response-test.mjs","--native-runtime","--case=code3"],["response-test.mjs","--native-runtime","--case=code4"],["response-test.mjs","--native-runtime","--case=code5"],["response-test.mjs","--native-runtime","--case=code6"],["response-test.mjs","--native-runtime","--case=code7"],["response-test.mjs","--native-runtime","--case=code8"],["response-test.mjs","--native-runtime","--case=code9"],["response-test.mjs","--native-runtime","--case=code10"],["response-test.mjs","--native-runtime","--case=code11"],["response-test.mjs","--native-runtime","--case=ready0"],["response-test.mjs","--native-runtime","--case=ready1"],["response-test.mjs","--native-runtime","--case=ready2"],["response-test.mjs","--native-runtime","--case=ready3"],["response-test.mjs","--native-runtime","--case=ready4"],["response-test.mjs","--native-runtime","--case=ready5"],["response-test.mjs","--native-runtime","--case=ready6"],["phone-lock-tests.mjs"],["navigation-tests.mjs"],["response-test.mjs","--native-runtime","--case=proxy-descriptor"],["response-test.mjs","--native-runtime","--case=retire-proxy"],["response-test.mjs","--native-runtime","--case=retire-ok"]];
assert.equal(correctionInvocations.length,44);
for (const argv of correctionInvocations) {
 assertCurrentGpsInventory();
 const result=spawnSync(process.execPath,argv,{cwd:resolve(root,'scripts/v80-correction-tests'),encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,env:coreChildEnvironment()});
 if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 assert.equal(result.status,0,'v80 correction failed: '+argv.join(' ')+' '+(result.error?.message||result.signal||result.status));
 assertCurrentGpsInventory();
}
// This reads the CURRENT full compiled source fixture, not projected classes.
const cp=readCoreNativeFixtureClasspath();
const junit=spawnSync('/usr/bin/java',['-Xmx256m','-cp',cp,'org.junit.runner.JUnitCore','org.memphiszoo.custodial.vault.RequestPolicyTest'],{cwd:root,encoding:'utf8',timeout:60000,env:coreChildEnvironment()});
assert.equal(junit.status,0,junit.stdout+junit.stderr);assert.match(junit.stdout,/OK \(9 tests\)/);process.stdout.write(junit.stdout);
const reminder=spawnSync('/usr/bin/java',['-Xmx256m','-cp',cp,'org.junit.runner.JUnitCore','org.memphiszoo.custodial.vault.NativeProviderBestEffortTest'],{cwd:root,encoding:'utf8',timeout:60000,env:coreChildEnvironment()});
assert.equal(reminder.status,0,reminder.stdout+reminder.stderr);assert.match(reminder.stdout,/OK \(6 tests\)/);process.stdout.write(reminder.stdout);
node('scripts/custodial-core-release-gate.mjs',660000);assertCurrentGpsInventory();
console.log(JSON.stringify({status:'PASS_CURRENT_GPS_OWNING_AND_FULL_CORE_SOURCE_SYNTHETIC',core_suites:79,original_dispatcher_unchanged:true,historical_proofs_separate:true,runtime_admission:false,release_admission:false,physical_phone:false}));
