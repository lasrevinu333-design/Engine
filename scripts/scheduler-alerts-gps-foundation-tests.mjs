import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const read = (name) => fs.readFileSync(path.resolve(root, name), 'utf8');

const gpsPath = path.resolve(root, 'memphis-gps.js');
const require = createRequire(import.meta.url);
const gps = require(gpsPath);

const offsite = gps.evaluate(
  { latitude: 35.02, longitude: -90.15, accuracy_m: 20 },
  { campus_latitude: 35.1506, campus_longitude: -89.9944, campus_radius_meters: 900, max_accuracy_meters: 100 }
);
assert.equal(offsite.result, 'offsite_outside_zoo_campus');
assert.equal(offsite.badgeKind, 'alert');
assert.match(offsite.badge, /OFFSITE/);

const onsiteUncalibrated = gps.evaluate(
  { latitude: 35.1506, longitude: -89.9944, accuracy_m: 15 },
  { campus_latitude: 35.1506, campus_longitude: -89.9944, campus_radius_meters: 900, max_accuracy_meters: 100, location_configured: false }
);
assert.equal(onsiteUncalibrated.result, 'onsite_location_unverified');
assert.equal(onsiteUncalibrated.badgeKind, 'warn');

const exact = gps.evaluate(
  { latitude: 35.15061, longitude: -89.99441, accuracy_m: 10 },
  {
    campus_latitude: 35.1506,
    campus_longitude: -89.9944,
    campus_radius_meters: 900,
    max_accuracy_meters: 100,
    location_configured: true,
    location_latitude: 35.1506,
    location_longitude: -89.9944,
    location_radius_meters: 80,
  }
);
assert.equal(exact.result, 'inside_scanned_location');
assert.equal(exact.badgeKind, 'ok');

const nowMs = Date.parse('2026-07-19T12:00:00.000Z');
const hardenedFence = {
  campus_latitude: 35.1495,
  campus_longitude: -90.0490,
  campus_radius_meters: 5000,
  max_accuracy_meters: 100,
  max_observation_age_seconds: 120,
  future_tolerance_seconds: 30,
  boundary_hysteresis_meters: 15,
  max_human_speed_mps: 12,
  location_configured: true,
  location_latitude: 35.1495,
  location_longitude: -90.0490,
  location_radius_meters: 175,
  now_ms: nowMs,
};
assert.equal(gps.evaluate({ latitude: 35.1495, longitude: -90.0490, accuracy_m: 8, timestamp: nowMs - 600000 }, hardenedFence).result, 'gps_stale');
assert.equal(gps.evaluate({ latitude: 35.1495, longitude: -90.0490, accuracy_m: 8, timestamp: nowMs + 60000 }, hardenedFence).result, 'gps_future_clock');
assert.equal(gps.evaluate({ latitude: 35.15107, longitude: -90.0490, accuracy_m: 8, timestamp: nowMs }, hardenedFence).result, 'gps_boundary_uncertain');
assert.equal(gps.evaluate(
  { latitude: 35.1695, longitude: -90.0490, accuracy_m: 8, timestamp: nowMs },
  hardenedFence,
  { latitude: 35.1495, longitude: -90.0490, accuracy_m: 8, timestamp: nowMs - 1000 },
).result, 'gps_implausible_jump');
assert.notEqual(gps.evaluate(
  { latitude: 35.14965, longitude: -90.0490, accuracy_m: 10, timestamp: nowMs },
  hardenedFence,
  { latitude: 35.1495, longitude: -90.0490, accuracy_m: 10, timestamp: nowMs - 1000 },
).result, 'gps_implausible_jump', 'ordinary jitter inside the combined GPS accuracy radius must not be classified as impossible motion');

const identitySource = read('memphis-device-identity.js');
const identityContext = {
  URL,
  navigator: { userAgent: 'FullyKiosk' },
  localStorage: { setItem() {}, getItem() { return ''; } },
  window: {
    location: { href: 'https://example.test/employee-schedule.html?device=KIOSK_01' },
    fully: {
      getDeviceId: () => 'a7b69ce3-dc662d3d',
      getSerialNumber: () => '',
      getMacAddress: () => '',
      getDeviceName: () => 'KIOSK_08',
    },
  },
};
identityContext.window.window = identityContext.window;
vm.runInNewContext(identitySource, identityContext, { filename: 'memphis-device-identity.js' });
const identity = identityContext.window.MemphisDeviceIdentity.resolve({ url: new URL(identityContext.window.location.href) });
assert.equal(identity.deviceId, 'KIOSK_08');
assert.equal(identity.source, 'fully_device_name');

const storedIdentityContext = {
  URL,
  navigator: { userAgent: 'FullyKiosk' },
  localStorage: {
    values: new Map([['mz_scan_device_id', 'KIOSK_06']]),
    setItem(key, value) { this.values.set(key, value); },
    getItem(key) { return this.values.get(key) || ''; },
  },
  window: {
    location: { href: 'https://example.test/employee-schedule.html' },
    fully: {
      getDeviceId: () => 'unknownhw-identifier01',
      getSerialNumber: () => '',
      getMacAddress: () => '',
      getDeviceName: () => 'Custodial Phone',
    },
  },
};
storedIdentityContext.window.window = storedIdentityContext.window;
vm.runInNewContext(identitySource, storedIdentityContext, { filename: 'memphis-device-identity.js' });
const storedIdentity = storedIdentityContext.window.MemphisDeviceIdentity.resolve({ url: new URL(storedIdentityContext.window.location.href) });
assert.equal(storedIdentity.deviceId, 'KIOSK_06');
assert.equal(storedIdentity.source, 'storage_canonical');

const schedule = read('employee-schedule.html');
assert.match(schedule, /window\.MemphisMobile\?\.deviceId/);
assert.match(schedule, /window\.MemphisCustodialSecurity\.mutateProtectedWork/);
assert.match(schedule, /\/my-day-summary\?device_id=/);
assert.doesNotMatch(schedule, /visitor-/);
assert.match(schedule, /This phone needs a manager/);
assert.match(schedule, /You are not scheduled now/);
assert.match(schedule, /Your areas now/);
assert.match(schedule, /current_items/);
assert.doesNotMatch(schedule, /display_sections|consolidateDisplayItems|>Now<\/span>/);

const scan = read('index.html');
const startupSequence = scan.match(/async function start\(\)\{[\s\S]*?startSyncLoop\(\)\}/)?.[0] || '';
assert.ok(startupSequence.indexOf('await syncQueue()') >= 0
  && startupSequence.indexOf('await syncQueue()') < startupSequence.indexOf('await bootstrap()'),
  'Startup must drain protected queued work before rendering the workflow');
assert.doesNotMatch(startupSequence, /refreshScanAuthoritySnapshot/,
  'Startup must not refresh or replace durable offline authority before the employee starts new work');
const admissionSequence = scan.match(/async function admitNewScanWork\(deviceId\)\{[\s\S]*?return snapshot\}/)?.[0] || '';
assert.ok(admissionSequence.indexOf('await drain(async()=>{') >= 0
  && admissionSequence.indexOf('await drain(async()=>{') < admissionSequence.indexOf('refreshScanAuthoritySnapshot'),
  'New-work admission must perform credential-sensitive snapshot refresh inside the exact queue admission callback');
const scanSync = read('memphis-scan-sync.js');
const drainForNewWork = scanSync.match(/async function drainForNewWork\(authorize = null\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.ok(drainForNewWork.indexOf('withQueueLock') >= 0
  && drainForNewWork.indexOf('drainForNewWorkUnlocked') > drainForNewWork.indexOf('withQueueLock')
  && drainForNewWork.indexOf('await authorize()') > drainForNewWork.indexOf('drainForNewWorkUnlocked')
  && drainForNewWork.indexOf('await listActions()') > drainForNewWork.indexOf('await authorize()'),
  'New-work admission must hold one queue lock across drain, authorization, and the final zero-queue recheck');
assert.match(scan, /memphis-gps\.js/);
assert.match(scan, /window\.MemphisGps\?\.evaluate/);
assert.match(scan, /tool_evaluate_location_proximity_v2/, 'Scan page must use the motion- and staleness-aware server-authoritative GPS evaluator');
assert.match(scan, /p_observed_at/, 'Scan page must preserve the phone observation timestamp for server freshness checks');
assert.match(scan, /type:"commit_workflow"/, 'Scan page must enqueue the canonical durable completion action');
assert.match(scan, /status:"pending_sync"/);
assert.doesNotMatch(scan, /status:"closed"[^\n]{0,500}offline:true/);
assert.doesNotMatch(scan, /SYNC_MAX_RETRIES:3/);

const dashboard = read('dashboard.html');
assert.match(dashboard, /inside_scanned_location/);
assert.match(dashboard, /result\.includes\("offsite"\).*result\.includes\("outside"\).*result\.includes\("away"\)/s);
assert.doesNotMatch(dashboard, /gps[^\n]{0,120}\?\s*"green"\s*:\s*"green"/i);

const reminders = read('memphis-device-reminders.js');
assert.match(reminders, /RINGTONE_REPEAT_COUNT:\s*1/);
assert.match(reminders, /for \(let cycle = 0; cycle < 2; cycle \+= 1\)/);
assert.match(reminders, /acknowledgeAlert\(alert, 'dismissed'\)/);
assert.match(reminders, /closeActiveAlert\(\{ stopSpeech: false \}\)/);
assert.match(reminders, /await waitForActiveAlertSpeech\(\)/, 'Opening an alert must wait for its spoken sentence before navigation');
assert.match(reminders, /state\.activeSpeechPromise = speakOnce/);
assert.match(reminders, /state\.activeSequencePromise \|\| state\.activeSpeechPromise/, 'A new alert must not interrupt a dismissed alert that is still speaking');
assert.match(reminders, /Math\.min\(45000/, 'Fully Kiosk speech estimate must allow longer event announcements');
assert.doesNotMatch(reminders, /stopTextToSpeech[^\n]*setTimeout/);

const sharedSync = read('memphis-scan-sync.js');
assert.match(sharedSync, /tool_commit_cleaning_workflow/, 'The shared durable worker must execute the canonical completion RPC');
assert.match(sharedSync, /tool_report_device_sync_status/, 'The single shared scan queue must report durable queue health to the backend');
assert.match(sharedSync, /commit_workflow/);
assert.match(sharedSync, /validateProcessResult\(item, result\);[\s\S]*acknowledgeOfflineCompletion/,
  'A validated closed completion must acknowledge its exact native journal before queue cleanup');
assert.match(sharedSync, /p_native_scan_entry_id/,
  'Queued native starts must preserve their NFC entry identity');
assert.match(sharedSync, /evaluate_location_proximity/);
assert.match(sharedSync, /evaluate_location_proximity_v2/);
assert.match(sharedSync, /tool_report_device_sync_status/);
assert.match(sharedSync, /next_attempt_at/);
assert.match(sharedSync, /Math\.random/);
assert.match(sharedSync, /MAX_RETRIES:\s*50/);
assert.match(sharedSync, /status >= 400 && status < 500 && !\[401, 403, 408, 429\]\.includes\(status\)/, '401/403 must remain retryable after credentials or device authority recover');
assert.match(sharedSync, /recoverAllDeadLetters/, 'The shared worker must expose bulk recovery for stranded scan submissions');
assert.match(sharedSync, /function latestQueueError\(/, 'Durable queue telemetry must retain the newest queued failure cause');
assert.match(sharedSync, /p_last_error:\s*queueError \|\| state\.lastError/, 'A successful heartbeat must not erase the cause of queued work');
assert.match(scan, /retryStuckQueue/, 'The production scan status control must expose dead-letter recovery');
assert.match(scan, /Tap to try again/, 'The scan UI must tell employees how to recover stuck submissions');
assert.doesNotMatch(sharedSync, /retry_count\s*>?=\s*3/);
assert.match(sharedSync, /discard_local_workflow/, 'Shared sync worker must remove terminal cancelled workflows from device storage');
assert.match(sharedSync, /function isTerminalReconciliation\(/, 'Terminal cleanup must be centralized in the shared durable worker');
assert.match(sharedSync, /\['cancelled', 'quarantined', 'recovery_required'\]\.includes\(status\)/,
  'Cancelled and quarantined completions must be recognized as terminal reconciliation outcomes');
assert.match(scan, /reconcileOpenLocalSessions/, 'Scan page must reconcile phone-saved sessions with server authority before blocking a new scan');
assert.match(scan, /session_cancelled_without_authoritative_completion|discard_local_workflow/);
assert.match(scan, /Cleaning Cancelled/);

assert.match(read('schedule.html'), /REQUIRED_CONTRACT:"schedule\.v2"/);
assert.match(read('employee-schedule.html'), /current_items/);
assert.doesNotMatch(read('employee-schedule.html'), /display_sections|consolidateDisplayItems/);
const chatScope = read('mobile/src/chatscope/app.jsx');
assert.match(chatScope, /function isMemphis\(/, 'ChatScope must route Memphis AI by canonical conversation metadata');
assert.match(chatScope, /client_message_id:\s*id/, 'ChatScope sends must retain a stable client message identity');
assert.match(chatScope, /mz_chatscope_outbox:/, 'ChatScope must retain its local retry outbox');
const legacyThread = read('thread.html');
assert.match(legacyThread, /new URL\(['"]\.\/messages\.html['"],location\.href\)/);
assert.match(legacyThread, /searchParams\.set\(key,value\)/);
assert.match(legacyThread, /target\.hash=location\.hash/);
assert.match(read('employee-schedule.html'), /memphis-auth\.js/);
assert.match(read('messages.html'), /release-2026\.07\.19\.custodial-v3\.12/);
assert.match(sharedSync, /release-2026\.07\.19\.custodial-v3\.12/);

for (const page of ['employee-schedule.html','employee-events.html','employee-feedback.html','events.html','messages.html','dashboard.html']) {
  const pageSource = read(page);
  assert.match(pageSource, /memphis-scan-sync\.js/, `${page} must keep processing scan outbox work after navigation`);
}
assert.match(read('mobile/src/custodial/index.html'), /memphis-scan-sync\.js/);

console.log(JSON.stringify({
  ok: true,
  checked: [
    'offsite_apartment_is_red',
    'onsite_uncalibrated_is_yellow',
    'exact_calibrated_location_is_green',
    'fully_kiosk_canonical_name_identity',
    'stored_canonical_identity_precedes_unknown_hardware',
    'karen_schedule_device_lookup',
    'no_false_completed_offline_state',
    'durable_cross_page_scan_sync',
    'one_alert_sequence',
    'dismiss_does_not_cut_off_speech',
    'open_waits_for_spoken_sentence',
    'server_authoritative_gps',
    'durable_queue_health_reporting',
    'schedule_v2_contract',
    'chatscope_message_idempotency',
    'chatscope_offline_outbox',
  ],
}, null, 2));
