import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {currentProviderComparisonContext as context,validateCurrentProviderComparisonContext,assertCurrentProviderComparisonInventory,assertBoundCurrentProviderSource,normalizeBoundProviderComparison} from './current-provider-comparison-source-boundary.mjs';
import {currentGpsQualification,assertCurrentGpsInventory,assertGpsHistoricalInventoryProjection} from './current-gps-qualification-source-boundary.mjs';
import {approvedPreservationComparisonPins} from './current-approved-preservation-source-boundary.mjs';
import {normalizeCurrentFirstAudio} from './native-first-audio-source-boundary.mjs';
import {withoutReleaseAdmission} from './provider-release-admission-source-boundary.mjs';
import {withoutProviderDecisionWire} from './provider-event-decision-wire-source-boundary.mjs';
import {withoutRetainedNativeBridge} from './retained-native-bridge-source-boundary.mjs';
import {withoutQualifiedProviderSchema} from './qualified-provider-schema-source-boundary.mjs';
import {withoutRequiredKinds} from './provider-required-kind-source-boundary.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const f6=JSON.parse(readFileSync(new URL('./fixtures/provider-event-decisions-byte-deltas.json',import.meta.url)));
let checks=0;
const currentInventory=assertCurrentGpsInventory();
assert.equal(currentInventory.main,194);
assert.equal(currentGpsQualification.main_java.length,currentInventory.main);
assert.equal(assertCurrentProviderComparisonInventory(),currentInventory.main);
const historicalInventory=assertGpsHistoricalInventoryProjection(approvedPreservationComparisonPins.current_java_inventory,context.current_test_java_inventory,context.current_auxiliary_inventory);
assert.equal(historicalInventory.actual_main,currentInventory.main);
assert.equal(historicalInventory.historical_main,193);
assert.equal(currentInventory.main-historicalInventory.historical_main,1);
// The historical projections above stay fixed. Keep the complete additions
// check in sync with the approved web, perimeter and notification sources.
const expectedAdditions=[
 'manager-test-record-archive-preview.mjs',
 'manager-ux.css',
 'memphis-zoo-perimeter.js',
 'mobile/plugins/custodial-native-vault/android/src/main/java/org/memphiszoo/custodial/vault/CustodialPhoneLocationService.java',
 'mobile/plugins/custodial-native-vault/android/src/test/java/org/memphiszoo/custodial/vault/NativeProviderBestEffortTest.java',
 'mobile/release-evidence/provider-v81-composition.json',
 'mobile/release-evidence/provider-v81-protocol.json',
 'mobile/release-evidence/provider-v82-composition.json',
 'mobile/release-evidence/provider-v83-composition.json',
 'mobile/release-evidence/provider-v84-composition.json',
 'mobile/release-evidence/provider-v85-composition.json',
 'mobile/release-evidence/provider-v86-composition.json',
 'mobile/release-evidence/provider-v87-composition.json',
 'mobile/scripts/custodial-native-observation-regression-tests.mjs',
 'mobile/scripts/custodial-provider-foreground-wake-tests.mjs',
 'operations-dashboard-data.js',
 'operations-dashboard.js',
 'ops-hub.css',
 'scripts/css-distribution-reference-tests.mjs',
 'scripts/dashboard-loading-state-tests.mjs',
 'scripts/dashboard-map-web-fit-tests.mjs',
 'scripts/fixtures/dashboard-map-current-context-pins-v3.json',
 'scripts/fixtures/dashboard-map-current-context-pins-v4.json',
 'scripts/fixtures/provider-notification-posting-byte-deltas.json',
 'scripts/fixtures/quiet-offline-v80-current-controls-v4.json',
 'scripts/fixtures/runtime-sanitation-predecessor/moxie-decommission-tests.mjs',
 'scripts/insights-session-withdrawal-tests.mjs',
 'scripts/manager-phone-perimeter-rendered-tests.mjs',
 'scripts/messenger-direct-create-lifecycle-tests.mjs',
 'scripts/messenger-direct-mounted-tests.mjs',
 'scripts/messenger-selection-race-tests.mjs',
 'scripts/messenger-session-renewal-browser-tests.mjs',
 'scripts/operations-dashboard-rendered-browser-tests.mjs',
 'scripts/operations-motion-controls-tests.mjs',
 'scripts/operations-next-rendered-tests.mjs',
 'scripts/operations-next-scheduled-tests.mjs',
 'scripts/provider-best-effort-release-tests.mjs',
 'scripts/provider-notification-posting-source-boundary.mjs',
 'scripts/provider-notification-posting-source-tests.mjs',
 'scripts/test-record-archive-preview-tests.mjs',
 'scripts/zoo-perimeter-phone-coverage-tests.mjs',
 'vendor/LICENSE.sheetjs',
 'vendor/xlsx-0.20.3.full.min.js',
];
assert.deepEqual(currentGpsQualification.deltas.filter(row=>row.kind==='added').map(row=>row.path).sort(),expectedAdditions);
assert.ok(currentGpsQualification.main_java.some(row=>row.path.endsWith('/CustodialPhoneLocationService.java')));
assert.ok(!approvedPreservationComparisonPins.current_java_inventory.some(row=>row.path.endsWith('/CustodialPhoneLocationService.java')));
checks+=9;
for(const row of context.files){
 const actual=readFileSync(new URL('../'+row.current_path,import.meta.url),'utf8');
 assert.equal(assertBoundCurrentProviderSource(row.current_path,actual),actual);checks++;
 const historical=normalizeBoundProviderComparison(row.current_path,actual);assert.equal(sha(historical),row.comparison_sha256);checks++;
 const normalized=withoutRequiredKinds(row.current_path,withoutProviderDecisionWire(row.current_path,withoutReleaseAdmission(row.current_path,withoutQualifiedProviderSchema(row.current_path,withoutRetainedNativeBridge(row.current_path,normalizeCurrentFirstAudio(row.current_path,actual))))));
 assert.equal(sha(normalized),row.final_reference_sha256);checks++;
 for(const changed of [actual+'\n// unknown current caller\n',actual.slice(1),actual.replace(/\S/,'#')]){
  assert.notEqual(changed,actual);assert.throws(()=>assertBoundCurrentProviderSource(row.current_path,changed));
  assert.equal(normalizeBoundProviderComparison(row.current_path,changed),changed,'Unknown source cannot obtain a historical view');checks+=3;
 }
 assert.throws(()=>assertBoundCurrentProviderSource(row.current_path,historical),'Removed actual current caller cannot be accepted as the current owner');checks++;
}
for(const mutate of [v=>v.runtime_admission=true,v=>v.files.pop(),v=>v.files[0].comparison_path='other',v=>v.files[0].comparison_sha256='0'.repeat(64),v=>v.current_inventory_sha256='0'.repeat(64)]){
 const value=structuredClone(context);mutate(value);assert.throws(()=>validateCurrentProviderComparisonContext(value));checks++;
}
assert.equal(normalizeBoundProviderComparison('unrelated.java','unknown'),'unknown');checks++;
console.log(JSON.stringify({status:'CURRENT_BOUND_HISTORICAL_PROVIDER_COMPARISON_PASS',checks,current_java_files:currentInventory.main,current_test_java_files:currentInventory.tests,historical_java_files:historicalInventory.historical_main,historical_files:context.files.length,historical_pins_rewritten:false,runtime_admission:false,release_admission:false,hardware_acceptance:false}));
