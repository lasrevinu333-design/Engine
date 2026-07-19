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
assert.match(schedule, /window\.MemphisDeviceIdentity\?\.resolve/);
assert.match(schedule, /\/my-day-summary\?device_id=/);
assert.doesNotMatch(schedule, /visitor-/);
assert.match(schedule, /This phone has no verified device identity/);
assert.match(schedule, /Not scheduled to work today\./);
assert.match(schedule, /Now<\/span>/);

const scan = read('index.html');
assert.match(scan, /memphis-gps\.js/);
assert.match(scan, /window\.MemphisGps\?\.evaluate/);
assert.match(scan, /tool_evaluate_location_proximity/, 'Scan page must use the server-authoritative GPS evaluator');
assert.match(scan, /tool_commit_cleaning_workflow/);
assert.match(scan, /status:"pending_sync"/);
assert.doesNotMatch(scan, /status:"closed"[^\n]{0,500}offline:true/);
assert.doesNotMatch(scan, /SYNC_MAX_RETRIES:3/);

const dashboard = read('dashboard.html');
assert.match(dashboard, /inside_scanned_location/);
assert.match(dashboard, /result\.includes\("offsite"\).*result\.includes\("outside"\).*result\.includes\("away"\)/s);
assert.doesNotMatch(dashboard, /gps[^\n]{0,120}\?\s*"green"\s*:\s*"green"/i);

const reminders = read('memphis-device-reminders.js');
assert.match(reminders, /RINGTONE_REPEAT_COUNT:\s*1/);
assert.match(reminders, /VOICE_REPEAT_COUNT:\s*1/);
assert.match(reminders, /acknowledgeAlert\(alert, 'dismissed'\)/);
assert.match(reminders, /closeActiveAlert\(\{ stopSpeech: false \}\)/);
assert.match(reminders, /await waitForActiveAlertSpeech\(\)/, 'Opening an alert must wait for its spoken sentence before navigation');
assert.match(reminders, /state\.activeSpeechPromise = speakOnce/);
assert.match(reminders, /state\.activeSequencePromise \|\| state\.activeSpeechPromise/, 'A new alert must not interrupt a dismissed alert that is still speaking');
assert.match(reminders, /Math\.min\(45000/, 'Fully Kiosk speech estimate must allow longer event announcements');
assert.doesNotMatch(reminders, /stopTextToSpeech[^\n]*setTimeout/);

const sharedSync = read('memphis-scan-sync.js');
assert.match(sharedSync, /tool_report_device_sync_status/, 'The single shared scan queue must report durable queue health to the backend');
assert.match(sharedSync, /commit_workflow/);
assert.match(sharedSync, /evaluate_location_proximity/);
assert.match(sharedSync, /tool_report_device_sync_status/);
assert.match(sharedSync, /next_attempt_at/);
assert.match(sharedSync, /Math\.random/);
assert.match(sharedSync, /MAX_RETRIES:\s*50/);
assert.match(sharedSync, /status >= 400 && status < 500 && !\[408, 429\]\.includes\(status\)/);
assert.doesNotMatch(sharedSync, /retry_count\s*>?=\s*3/);
assert.match(sharedSync, /discard_local_workflow/, 'Shared sync worker must remove terminal cancelled workflows from device storage');
assert.match(sharedSync, /safeText\(result\?\.status\)\.toLowerCase\(\) === 'cancelled'/);
assert.match(scan, /reconcileOpenLocalSessions/, 'Scan page must reconcile phone-saved sessions with server authority before blocking a new scan');
assert.match(scan, /session_cancelled_without_authoritative_completion|discard_local_workflow/);
assert.match(scan, /Session Cancelled/);

assert.match(read('schedule.html'), /REQUIRED_CONTRACT:"schedule\.v2"/);
assert.match(read('employee-schedule.html'), /display_sections/);
assert.match(read('employee-schedule.html'), /consolidateDisplayItems/);
assert.match(read('thread.html'), /isMemphisConversation/);
assert.match(read('thread.html'), /client_message_id:clientMessageId/);
assert.match(read('employee-schedule.html'), /release-2026\.07\.18\.custodial-v3\.10/);
assert.match(read('thread.html'), /release-2026\.07\.18\.custodial-v3\.10/);
assert.match(sharedSync, /release-2026\.07\.18\.custodial-v3\.10/);

for (const page of ['employee-hub.html','employee-schedule.html','events.html','messages.html','thread.html','dashboard.html']) {
  const pageSource = read(page);
  assert.match(pageSource, /memphis-scan-sync\.js/, `${page} must keep processing scan outbox work after navigation`);
}

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
  ],
}, null, 2));
