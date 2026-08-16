import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CUSTODIAL_CREDENTIAL_KEY,
  CUSTODIAL_DEVICE_KEYS,
  CUSTODIAL_ENROLLMENT_OPERATION_KEY,
  CUSTODIAL_INSTALLATION_MARKER_KEY,
  CUSTODIAL_INSTALLATION_RECORD_KEY,
  CUSTODIAL_INSTALLATION_SEAL_KEY,
  CUSTODIAL_RECOVERY_RECORD_KEY,
  CUSTODIAL_REMOVAL_OPERATION_KEY,
  CUSTODIAL_RESTORE_QUARANTINE_KEY,
  CustodialEnrollmentOperationError,
  CustodialPendingWorkError,
  CustodialRecoveryError,
  CustodialSecurityTransitionError,
  createCustodialCredentialStore,
} from '../src/custodial/credential-store.js';
import {
  getCustodialBridgeSecurityRuntime,
  getCustodialShellSecurityFacade,
} from '../src/custodial/security-runtime.js';
import {
  ENROLLMENT_CONFIRMATION_REQUIRED_CODE,
  reconcileEnrollmentConfirmationRequired,
} from '../src/custodial/transport-policy.js';

const root = new URL('../', import.meta.url);
const files = async (path) => readFile(new URL(path, root), 'utf8');
const [
  config, packageJson, buildScript, managerHtml, managerJs, managerBridge, nativeLayout, interaction,
  moxieHtml, moxieJs, accessHtml, accessJs, viewerHtml, viewerJs,
  messengerHtml, messengerApp, retiredChatScope, notificationHtml, notificationJs,
  notificationClient, firebaseConfig, brandingConfig, nativeLinks, codemagic, feedbackHtml, phoneAssignmentsHtml, phoneAssignmentsJs,
  insightsHtml, insightsJs, insightsNativeAuth, custodialHtml, custodialJs, custodialBridge, custodialShellAuth,
  custodialCredentialStore, custodialSecurityRuntime, custodialStorageFirewall, custodialNativeSecurity, custodialNativeStatus,
] = await Promise.all([
  files('capacitor.config.ts'), files('package.json'), files('scripts/build.mjs'), files('src/manager/index.html'), files('src/manager/app.js'),
  files('src/shared/mobile-bridge.js'), files('src/shared/native-layout.js'), files('src/shared/interaction-feedback.js'),
  files('src/manager/moxie.html'), files('src/manager/moxie.js'), files('src/manager/manager-access.html'), files('src/manager/manager-access.js'),
  files('src/viewer/index.html'), files('src/viewer/app.js'), files('../messages.html'), files('src/chatscope/app.jsx'), files('../messages-chatscope.html'),
  files('src/manager/notifications.html'), files('src/manager/notifications.js'), files('src/manager/notifications-client.js'),
  files('scripts/configure-firebase.mjs'), files('scripts/configure-branding.mjs'), files('scripts/configure-native-links.mjs'),
  files('../codemagic.yaml'), files('../system-feedback.html'),
  files('../phone-assignments.html'), files('../phone-assignments.js'), files('../operational-insights.html'), files('../operational-insights.js'),
  files('../operational-insights-native-auth.js'), files('src/custodial/index.html'), files('src/custodial/app.js'), files('src/custodial/bridge.js'),
  files('src/shell/runtime/custodial-auth.ts'), files('src/custodial/credential-store.js'), files('src/custodial/security-runtime.js'), files('src/custodial/storage-firewall.js'),
  files('src/custodial/native-security.js'),
  files('src/custodial/native-status.js'),
]);
const custodialScanTarget = await files('src/custodial/scan-target.ts');

for (const id of ['org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer']) assert.match(config, new RegExp(id.replaceAll('.', '\\.')));
assert.match(config, /custodialPlugins/);
assert.match(config, /@memphis-zoo\/custodial-native-vault/);
assert.ok(
  /const custodialPlugins = \[[^\]]*@memphis-zoo\/custodial-native-vault[^\]]*\]/s.test(config),
  'Custodial must include the first-party native vault',
);
assert.ok(
  !/const custodialPlugins = \[[^\]]*@aparajita\/capacitor-secure-storage[^\]]*\]/s.test(config),
  'Custodial must not register the JavaScript-readable SecureStorage plugin',
);
assert.match(config, /@capacitor-firebase\/messaging/);
assert.doesNotMatch(config, /@capacitor\/barcode-scanner/);
assert.match(config, /@capacitor\/local-notifications/);
assert.match(config, /loggingBehavior: 'debug'/, 'release builds must not log native bridge response payloads');
assert.doesNotMatch(config, /loggingBehavior: 'production'/, 'production logging exposes SecureStorage and push-token results');
assert.match(config, /webContentsDebuggingEnabled: false/, 'Android WebView debugging must remain disabled');
assert.match(packageJson, /build:custodial/);
const mobilePackage = JSON.parse(packageJson);
assert.equal(Object.hasOwn(mobilePackage.dependencies, '@capacitor/barcode-scanner'), false);
assert.match(mobilePackage.scripts['cap:sync:android:custodial'], /cap sync android/);
assert.match(mobilePackage.scripts['cap:sync:manager'], /cap sync(?:\s|$)/);
assert.doesNotMatch(mobilePackage.scripts['cap:sync:manager'], /cap sync android/);
assert.match(mobilePackage.scripts['cap:sync:viewer'], /cap sync(?:\s|$)/);
assert.doesNotMatch(mobilePackage.scripts['cap:sync:viewer'], /cap sync android/);
assert.match(mobilePackage.scripts['cap:sync:ios:manager'], /cap sync ios/);
assert.match(mobilePackage.scripts['cap:sync:ios:viewer'], /cap sync ios/);
assert.match(mobilePackage.scripts['cap:add:ios:manager'], /MZ_APP_EDITION=manager npx cap add ios/);
assert.match(mobilePackage.scripts['cap:add:ios:viewer'], /MZ_APP_EDITION=viewer npx cap add ios/);
assert.equal(Object.hasOwn(mobilePackage.scripts, 'cap:add:ios:custodial'), false);
assert.match(firebaseConfig, /Custodial app and its Firebase configuration are Android-only/);
assert.match(buildScript, /scan\.html/);
assert.match(buildScript, /memphis-custodial-bridge\.js/);
assert.match(buildScript, /memphis-native-layout\.js/);
assert.match(buildScript, /edition === 'custodial'/);
assert.match(buildScript, /globalThis\.MemphisMobileBuild=/);
assert.match(buildScript, /memphis-build-identity\.js/);
assert.match(buildScript, /native_build_number: nativeBuildNumber \? Number\(nativeBuildNumber\) : null/);

for (const module of ['Dashboard','Messenger','Schedule','Events','Insights &amp; Inspections','Guest Issues','Moxie','Feedback','Notifications','Phone Assignments','Gemini Console','Manager Access','Device Security']) assert.ok(managerHtml.includes(module), `manager app missing ${module}`);
assert.doesNotMatch(managerHtml, /ChatScope Messenger/);
assert.doesNotMatch(managerHtml, /href="\.\/dashboard\.html#locations"/);
for (const label of ['Home','Messages','Schedule','Status','More']) assert.match(managerHtml, new RegExp(`navLabel">${label}<`));
assert.match(managerHtml, /mz-native-android/);
assert.match(managerJs, /mobile-auth-api\/enroll/);
assert.match(managerJs, /SecureStorage/);
assert.match(managerJs, /Existing phone access was kept/);
assert.match(managerJs, /els\.insights\.hidden = !custodialAdmin/);
assert.doesNotMatch(managerJs, /catch \(error\) \{\s*await secureRemove\(\)/, 'transient refresh errors must not erase native enrollment');
assert.match(managerBridge, /AUTHENTICATED_API_PREFIXES/);
assert.match(managerBridge, /window\.fetch = \(input, init\) => bridgeFetch/);
assert.match(nativeLayout, /mz-native-android/);
assert.match(interaction, /navigator\.vibrate/);

assert.match(messengerHtml, /chatscope-messenger\.js/);
assert.doesNotMatch(messengerHtml, /messenger-runtime-patch\.js/);
assert.doesNotMatch(messengerHtml, /messages-app\.js|messenger-app\.css/);
assert.match(messengerApp, /ops_manager_shared_chat_v1/);
assert.match(messengerApp, /Memphis AI/);
assert.match(messengerApp, /filter\(\(row\) => !isRetiredThread\(row\)\)/);
assert.doesNotMatch(messengerApp, /window\.fetch\s*=|MutationObserver/);
assert.match(retiredChatScope, /messages\.html/);

assert.match(moxieHtml, /Private workspace/);
assert.match(moxieHtml, /New Chat/);
assert.match(moxieHtml, /Clear Chat/);
for (const tab of ['Chat','Notes','Reminders','Contacts']) assert.match(moxieHtml, new RegExp(`>${tab}<`));
assert.match(moxieJs, /savedChats/);
assert.match(accessHtml, /single-use personal code/i);
assert.match(accessJs, /leadership-api\/managers\/.*enrollment-code/);

assert.doesNotMatch(viewerHtml, /Messenger|Moxie|Scheduler|Device Security|Manager Access|Notifications/);
for (const module of ['Dashboard','Events','Feedback']) assert.ok(viewerHtml.includes(module), `viewer app missing ${module}`);
assert.match(viewerJs, /viewer-api\/dashboard/);

assert.match(notificationHtml, /Send a Test Notification/);
assert.match(notificationJs, /memphis:notification-received/);
assert.match(notificationClient, /notificationReceived/);
assert.match(notificationClient, /app_version: '1\.0\.0'/);
assert.match(firebaseConfig, /org\.memphiszoo\.custodial/);
assert.match(firebaseConfig, /app_identifier/);
assert.doesNotMatch(firebaseConfig, /FIREBASE_SERVICE_ACCOUNT_JSON|private_key|client_email/);
assert.match(brandingConfig, /ic_launcher_foreground/);
assert.doesNotMatch(nativeLinks, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(nativeLinks, /android\.nfc\.action\.NDEF_DISCOVERED/);
assert.match(nativeLinks, /NfcAdapter\.ReaderCallback/);
assert.match(nativeLinks, /recordPhysicalNfcHandoff/);
assert.match(nativeLinks, /NativeNfcScanHandoff\.recordPhysicalRead/);
assert.match(nativeLinks, /appendQueryParameter\(NativeNfcScanHandoff\.QUERY_PARAMETER/);
assert.match(nativeLinks, /Ndef\.get\(tag\)/);
assert.doesNotMatch(nativeLinks, /VERIFIED_NFC_SCAN|EXTRA_NDEF_MESSAGES/);
assert.match(nativeLinks, /getParcelableExtra\(NfcAdapter\.EXTRA_TAG\)/);
assert.match(nativeLinks, /readPhysicalNfcUrl\(intent\.getParcelableExtra/);
assert.match(nativeLinks, /CFBundleURLTypes/);
assert.match(codemagic, /MZ_API_BASE: https:\/\/memphis-zoo-mcp\.onrender\.com/);

assert.doesNotMatch(feedbackHtml, /context-pill|Resolving context|device id/i);
assert.match(feedbackHtml, /Technical details are recorded automatically/);
assert.match(phoneAssignmentsHtml, /Phone Assignments/);
assert.match(phoneAssignmentsJs, /Generate App Code/);
assert.match(phoneAssignmentsJs, /enrollment-code/);
assert.match(insightsHtml, /Insights & Inspections/);
for (const endpoint of ['cleaning-performance','session-facts','ticket-trends','inspections']) assert.match(insightsJs, new RegExp(endpoint));
assert.match(insightsJs, /Idempotency-Key/);
assert.match(insightsNativeAuth, /analytics-api/);
assert.match(insightsNativeAuth, /mobile\.authHeaders/);

assert.match(custodialHtml, /Assigned Areas/);
assert.match(custodialHtml, /You choose the practical cleaning order/);
assert.doesNotMatch(custodialHtml, /NFC Tag Unavailable|scan-location-qr/);
assert.match(custodialHtml, /NFC is always ready/);
assert.match(custodialHtml, /memphis-custodial-bridge\.js/);
for (const id of ['enrollment-eyebrow', 'enrollment-title', 'enrollment-lead', 'enroll-submit']) assert.match(custodialHtml, new RegExp(`id="${id}"`));
assert.doesNotMatch(custodialHtml, />Scanner</);
assert.match(custodialBridge, /custodial-device-auth\/enroll/);
assert.match(custodialBridge, /custodial-device-auth\/recover/);
assert.match(custodialBridge, /custodial-device-auth\/remove/);
assert.doesNotMatch(custodialBridge, /device-auth\/logout/);
assert.doesNotMatch(custodialBridge, /@aparajita\/capacitor-secure-storage/);
assert.doesNotMatch(custodialShellAuth, /@aparajita\/capacitor-secure-storage/);
assert.match(custodialBridge, /nativeCustodialAuthorizedFetch/);
assert.match(custodialBridge, /nativeCustodialEnroll/);
assert.match(custodialBridge, /nativeCustodialRemoveEnrollment/);
assert.match(custodialShellAuth, /createCustodialNativeStatusFacade/);
assert.doesNotMatch(custodialShellAuth, /getCustodialProtectedStorage|getCustodialShellSecurityFacade/);
assert.match(custodialNativeSecurity, /CustodialNativeVault/);
assert.match(custodialNativeSecurity, /authorizedRequest/);
assert.match(custodialNativeSecurity, /attestOfflineStart/);
assert.match(custodialNativeSecurity, /attestOfflineCompletion/);
assert.match(custodialNativeSecurity, /acknowledgeOfflineCompletion/);
assert.match(custodialNativeSecurity, /captureOfflineCompletionTime/);
assert.match(custodialNativeSecurity, /anchorOfflineAuthoritySnapshot/);
assert.match(custodialNativeSecurity, /loadOfflineAuthoritySnapshot/);
assert.match(custodialNativeSecurity, /authorizeOfflineNewWork/);
assert.match(custodialNativeSecurity, /beginRollbackFence/);
assert.match(custodialNativeSecurity, /clearRollbackFence/);
assert.match(custodialNativeSecurity, /X-Memphis-Native-Request-Attestation/);
assert.match(custodialNativeSecurity, /error\?\.data\?\.status/);
assert.match(custodialBridge, /nativeCustodialHttpStatus/);
assert.match(custodialNativeSecurity, /completeLocalBinding/);
assert.match(custodialNativeSecurity, /completeLegacyBinding/);
assert.match(custodialNativeSecurity, /active_enrollment_flow/);
assert.match(custodialNativeSecurity, /removalCompletionRecord/);
assert.match(custodialNativeSecurity, /finalizeRemoval/);
assert.match(custodialNativeSecurity, /X-Memphis-App-Edition/);
assert.match(custodialBridge, /Idempotency-Key/);
assert.match(custodialBridge, /operation_id/);
assert.match(custodialBridge, /\/confirm/);
assert.match(custodialJs, /ensurePhoneNotifications/);
assert.match(custodialJs, /register\(\{ requestPermission: true \}\)/);
assert.match(custodialJs, /showHome\(\); await loadAreas\(\); await ensurePhoneNotifications\(\)/);
assert.match(custodialJs, /Array\.isArray\(data\?\.all_items\)/, 'Assigned Areas must consume the canonical full-day weekly projection');
assert.match(custodialJs, /segment\?\.included_locations/, 'Assigned Areas must prefer projection-owned included locations');
assert.match(custodialJs, /segment\?\.location_name \|\| segment\?\.group_name/, 'one-location weekly occurrences must remain visible on the phone');
assert.match(custodialJs, /Phone enrolled and notifications ready/);
assert.deepEqual(
  [...custodialHtml.matchAll(/class="navLabel">([^<]+)</g)].map((match) => match[1]),
  ['Schedule', 'Messages', 'Events', 'Feedback'],
  'the employee navigation must expose only the fixed operational modules',
);
assert.doesNotMatch(custodialHtml, /remove-enrollment|Remove Enrollment From This Phone/);
assert.doesNotMatch(custodialJs, /function removeEnrollment|els\.remove/);
assert.match(custodialHtml, /<span>Feedback<\/span>/);
assert.doesNotMatch(custodialHtml, /<span>Report<\/span>/);
assert.match(custodialBridge, /App\.addListener\('appUrlOpen'/);
assert.match(custodialBridge, /status\.state !== 'enrolled'/);
assert.match(custodialScanTarget, /scan\.html/);
assert.match(custodialBridge, /resolveCustodialScanTarget/);
assert.match(custodialBridge, /status\.state !== 'enrolled'/);
assert.match(custodialBridge, /attestNativeCustodialScanIntent/);
assert.match(custodialBridge, /createOfflineStartAttestation/);
assert.match(custodialBridge, /acknowledgeOfflineCompletion/);
assert.match(custodialBridge, /createOfflineCompletionAttestation/);
assert.match(custodialBridge, /captureOfflineCompletionTime/);
assert.match(custodialBridge, /nativeOfflineTimeAuthority: Boolean\(nativeVault\)/);
assert.doesNotMatch(custodialBridge, /attestNativeCustodialQrScan|prepareManualQrScanTarget/);
assert.doesNotMatch(custodialNativeSecurity, /attestQrScan/);
assert.match(custodialBridge, /consumeScanEntryAttestation/);
assert.match(custodialNativeSecurity, /consumeNativeCustodialScanEntry/);
assert.match(custodialBridge, /snapshot\.snapshot_id/);
assert.match(custodialBridge, /snapshot\.credential_id/);
assert.match(custodialBridge, /loadOfflineAuthoritySnapshot/);
assert.match(custodialBridge, /authorizeOfflineNewWork/);
assert.match(custodialBridge, /beginRollbackFence/);
assert.match(custodialBridge, /clearRollbackFence/);
assert.doesNotMatch(custodialJs, /tool_get_offline_scan_authority_snapshot/, 'Home must not refresh offline authority outside the scan workflow');
assert.match(custodialBridge, /native-notification-outbox\.v1/);
assert.match(custodialBridge, /persistOpenedNotification\(data\)/);
assert.match(custodialBridge, /await persistOpenedNotification\(data\)/);
assert.match(custodialBridge, /flushNativeNotificationOutbox/);
assert.match(custodialBridge, /Idempotency-Key/);
assert.doesNotMatch(custodialJs, /prepareNativeNfcScanTarget/, 'The page-facing app may not manufacture native NFC provenance');
assert.match(custodialScanTarget, /parseUrlWithHierarchicalCustomSchemes/);
assert.match(custodialScanTarget, /CUSTOM_SCAN_SCHEMES\.has\(protocol\)/);
assert.doesNotMatch(custodialJs, /CapacitorBarcodeScanner|scan-location-qr|prepareManualQrScanTarget/);
assert.match(custodialBridge, /requireManagerRecovery/);
assert.match(custodialJs, /function pendingEnrollmentOperation\(\)/);
assert.match(custodialJs, /els\.device\.value = pending\.device_id/);
assert.match(custodialJs, /flow: pending\?\.flow \|\| \(recovery \? 'recovery' : 'enrollment'\)/);
assert.match(custodialJs, /local_committed_pending_server_confirmation/);
assert.match(custodialJs, /Recovery is locked to/);
assert.doesNotMatch(custodialJs, /localStorage\.(?:setItem|removeItem)/, 'Custodial enrollment UI must mutate protected state only through the serialized store');
assert.match(custodialScanTarget, /incoming\.hostname === 'lasrevinu333-design\.github\.io'/);
assert.match(custodialScanTarget, /if \(!customScan && !webScan\) return null/);
assert.match(custodialBridge, /X-Memphis-App-Edition/);
assert.doesNotMatch(custodialShellAuth, /X-Memphis-App-Edition/);
assert.match(custodialBridge, /X-Device-Credential/);
assert.doesNotMatch(custodialBridge, /window\.MemphisMobile\s*=\s*[^;]*(?:authHeaders|readCredential)/);
assert.doesNotMatch(custodialJs, /readCredential|X-Device-Credential|X-Memphis-Device-Credential/);
assert.doesNotMatch(custodialShellAuth, /readCredential|X-Device-Credential|X-Memphis-Device-Credential/);
assert.match(custodialBridge, /app_version: '1\.0\.0'/);
for (const channel of ['employee-events', 'employee-messages', 'employee-due-soon', 'employee-overdue']) {
  assert.ok(custodialBridge.includes(channel), `Custodial native bridge is missing ${channel}`);
}
assert.match(custodialBridge, /employee_location_status/);
assert.match(custodialBridge, /presentForegroundNotification/);
assert.match(custodialBridge, /LocalNotifications\.schedule/);
assert.match(custodialBridge, /localNotificationActionPerformed/);
assert.match(custodialBridge, /nativeNotifications: true/);
assert.match(await files('../memphis-device-reminders.js'), /MemphisMobile\?\.nativeNotifications === true/);
for (const source of [custodialJs, custodialBridge, custodialShellAuth]) {
  assert.doesNotMatch(source, /localStorage\.getItem\([^)]*credential/i, 'Custodial credentials must never be read from WebView storage');
  assert.doesNotMatch(source, /localStorage\.setItem\([^)]*credential/i, 'Custodial credentials must never be written to WebView storage');
}
assert.match(custodialJs, /window\.MemphisCustodialSecurity/);
assert.match(custodialBridge, /getCustodialBridgeSecurityRuntime/);
assert.match(custodialBridge, /edition: 'custodial'/);
assert.match(custodialBridge, /security\.subscribe\(routeProtectedRecovery\)/);
assert.match(custodialShellAuth, /state: 'quarantined'/);
assert.match(custodialShellAuth, /state: 'unavailable'/);
assert.match(custodialSecurityRuntime, /createRawStorageAdapter/);
assert.match(custodialSecurityRuntime, /installCustodialStorageFirewall/);
assert.match(custodialSecurityRuntime, /MemphisCustodialSecurity/);
assert.ok(
  custodialSecurityRuntime.indexOf('installCustodialStorageFirewall') < custodialSecurityRuntime.indexOf('const initialCheck'),
  'The localStorage firewall must be installed before asynchronous security reconciliation begins',
);
assert.match(custodialStorageFirewall, /status\?\.ready !== true/);
assert.match(custodialStorageFirewall, /memphis_zoo_custodial_device_credential/);
assert.match(custodialStorageFirewall, /memphisZooCustodialRemovalCompletionV1/);
assert.match(custodialNativeStatus, /plugin\.getState/);
assert.doesNotMatch(custodialNativeStatus, /completeLocalBinding|completeLegacyBinding|authorizedRequest|removeEnrollment|finalizeRemoval/);
assert.doesNotMatch(custodialShellAuth, /credentialStore|readCredential|dispatchAuthorizedTransport|removeEnrollment|completeLocalBinding|completeLegacyBinding|finalizeRemoval/);
for (const source of [custodialCredentialStore, custodialSecurityRuntime, custodialStorageFirewall]) {
  assert.doesNotMatch(source, /Symbol\.for\(['"]org\.memphiszoo\.custodial\./, 'Custodial security singletons must remain module-local');
}

function failureMatches(rule, context) {
  if (!rule) return false;
  if (typeof rule === 'function') return rule(context) === true;
  if (Array.isArray(rule)) return rule.includes(context.key);
  return rule === true || rule === context.key;
}

function memoryStorage(initial = {}, { failures = {} } = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  const operations = [];
  const counts = { get: 0, set: 0, remove: 0, key: 0 };
  return {
    operations,
    get length() { return values.size; },
    key(index) {
      counts.key += 1;
      operations.push(['key', index]);
      return Array.from(values.keys())[index] ?? null;
    },
    getItem(key) {
      counts.get += 1;
      operations.push(['get', key]);
      if (failureMatches(failures.get, { operation: 'get', key, count: counts.get })) throw new Error('local read failed');
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      counts.set += 1;
      operations.push(['set', key, String(value)]);
      if (failureMatches(failures.set, { operation: 'set', key, count: counts.set })) throw new Error('local write failed');
      values.set(key, String(value));
    },
    removeItem(key) {
      counts.remove += 1;
      operations.push(['remove', key]);
      if (failureMatches(failures.remove, { operation: 'remove', key, count: counts.remove })) throw new Error('local removal failed');
      values.delete(key);
    },
    value(key) { return values.get(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

class RuntimeStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
    this.readFailures = new Set();
  }

  get length() { return this.values.size; }
  key(index) { return Array.from(this.values.keys())[index] ?? null; }
  getItem(key) {
    if (this.readFailures.has(String(key))) throw new Error(`local read failed for ${String(key)}`);
    return this.values.has(String(key)) ? this.values.get(String(key)) : null;
  }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
  value(key) { return this.values.get(String(key)); }
}

function memorySecure(initial = {}, { failures = {}, hooks = {} } = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  const operations = [];
  const counts = { get: 0, set: 0, remove: 0 };
  async function before(operation, key, value) {
    counts[operation] += 1;
    operations.push(value === undefined ? [operation, key] : [operation, key, String(value)]);
    if (typeof hooks[operation] === 'function') await hooks[operation]({ key, value, count: counts[operation] });
    if (failureMatches(failures[operation], { operation, key, value, count: counts[operation] })) {
      throw new Error(`secure ${operation} failed`);
    }
  }
  return {
    operations,
    async get(key) { await before('get', key); return values.get(key); },
    async set(key, value) { await before('set', key, value); values.set(key, String(value)); },
    async remove(key) { await before('remove', key); values.delete(key); },
    value(key) { return values.get(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

function memoryIndexedDb(records = [], { exists = records.length > 0 } = {}) {
  const rows = records.map((record) => structuredClone(record));
  const operations = [];
  return {
    operations,
    records: rows,
    async databases() {
      operations.push(['databases']);
      return exists ? [{ name: 'mz_scan_queue', version: 4 }] : [];
    },
    open(name) {
      operations.push(['open', name]);
      const request = {};
      queueMicrotask(() => {
        const database = {
          objectStoreNames: { contains: (storeName) => storeName === 'actions' },
          close() { operations.push(['close']); },
          transaction(storeName, mode) {
            operations.push(['transaction', storeName, mode]);
            const transaction = {
              error: null,
              objectStore(requestedStore) {
                assert.equal(requestedStore, 'actions');
                return {
                  getAll() {
                    operations.push(['getAll']);
                    const all = {};
                    queueMicrotask(() => {
                      all.result = rows.map((record) => structuredClone(record));
                      all.onsuccess?.();
                      queueMicrotask(() => transaction.oncomplete?.());
                    });
                    return all;
                  },
                };
              },
            };
            return transaction;
          },
        };
        request.result = database;
        request.onsuccess?.();
      });
      return request;
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function oneShotGate(operation, key) {
  const entered = deferred();
  const release = deferred();
  let used = false;
  return {
    entered: entered.promise,
    release: release.resolve,
    hooks: {
      [operation]: async (event) => {
        if (used || event.key !== key) return;
        used = true;
        entered.resolve();
        await release.promise;
      },
    },
  };
}

function deterministicCrypto(prefix = 'seal') {
  let sequence = 0;
  // Both installation seals and enrollment/removal operation IDs are generated
  // from the injected crypto implementation. Keep test UUIDs standards-valid so
  // the journal parser exercises the same validation as production.
  const seed = Array.from(String(prefix)).reduce((value, character) => (
    ((value * 33) ^ character.charCodeAt(0)) >>> 0
  ), 5381).toString(16).padStart(8, '0').slice(-8);
  return {
    randomUUID: () => {
      sequence += 1;
      return `${seed}-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`;
    },
  };
}

function enrolledFixture({ deviceId = 'KIOSK_06', credential = 'credential-old', seal = 'seal-old' } = {}) {
  const record = JSON.stringify({
    schema_version: 1,
    credential,
    device_id: deviceId,
    installation_seal: seal,
    enrolled_at: '2026-08-01T00:00:00.000Z',
    migrated_from_credential_only_state: false,
  });
  return {
    secure: { [CUSTODIAL_INSTALLATION_RECORD_KEY]: record },
    local: {
      ...Object.fromEntries(CUSTODIAL_DEVICE_KEYS.map((key) => [key, deviceId])),
      [CUSTODIAL_INSTALLATION_MARKER_KEY]: seal,
    },
  };
}

function parsed(value) { return JSON.parse(value); }

async function successfulRemoteRemoval({ phase, checkpoint }) {
  assert.ok(
    ['pending_server_removal', 'pending_push_unregister', 'push_unregistered', 'server_logged_out'].includes(phase),
    `unexpected durable removal phase ${phase}`,
  );
  if (phase !== 'server_logged_out') await checkpoint('server_logged_out');
}

// The bridge may hold the privileged credential capability in its own module
// closure, but neither a known registry symbol nor global symbol enumeration may
// recover it (or the raw Storage methods that bypass the public firewall).
{
  const secret = 'module-private-device-credential';
  const fixture = enrolledFixture({ deviceId: 'KIOSK_08', credential: secret, seal: 'module-private-seal' });
  const storage = new RuntimeStorage(fixture.local);
  const secureStorage = memorySecure(fixture.secure);
  const globalSymbolsBefore = new Set(Object.getOwnPropertySymbols(globalThis));
  const storageSymbolsBefore = new Set(Object.getOwnPropertySymbols(Object.getPrototypeOf(storage)));

  const bridgeRuntime = getCustodialBridgeSecurityRuntime({
    secureStorage,
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('private-runtime'),
  });
  const repeatedBridgeRuntime = getCustodialBridgeSecurityRuntime({
    secureStorage: memorySecure(),
    storage: new RuntimeStorage(),
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('ignored-runtime'),
  });
  const shellSecurity = getCustodialShellSecurityFacade({
    secureStorage: memorySecure(),
    storage: new RuntimeStorage(),
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('ignored-shell'),
  });
  await bridgeRuntime.security.ready;

  assert.equal(repeatedBridgeRuntime, bridgeRuntime, 'the bridge runtime must be a module-local singleton');
  assert.equal(globalThis.MemphisCustodialSecurity, bridgeRuntime.security);
  assert.deepEqual(
    Object.keys(shellSecurity).sort(),
    ['ensureSecurityState', 'getStatus', 'waitForStableState'],
    'the shell must receive only status and readiness capabilities',
  );
  for (const forbidden of [
    'credentialStore',
    'store',
    'rawStorage',
    'readCredential',
    'dispatchAuthorizedTransport',
    'setEnrollment',
    'recoverEnrollment',
    'prepareEnrollmentOperation',
    'commitEnrollmentOperation',
    'confirmEnrollmentOperation',
    'removeEnrollment',
    'removeCredential',
  ]) {
    assert.equal(forbidden in shellSecurity, false, `shell security must not expose ${forbidden}`);
    assert.equal(forbidden in globalThis.MemphisCustodialSecurity, false, `public security must not expose ${forbidden}`);
  }
  assert.equal('rawStorage' in bridgeRuntime, false, 'even the bridge handle must not expose raw Storage');
  assert.doesNotMatch(JSON.stringify(globalThis.MemphisCustodialSecurity.getStatus()), new RegExp(secret));
  const mutationContext = await globalThis.MemphisCustodialSecurity.mutateProtectedWork((context) => ({ ...context }));
  assert.deepEqual(Object.keys(mutationContext).sort(), ['deviceId', 'generation', 'state']);
  assert.equal(Object.values(mutationContext).includes(secret), false);

  const knownGlobalSymbols = [
    Symbol.for('org.memphiszoo.custodial.credential-store'),
    Symbol.for('org.memphiszoo.custodial.security-runtime'),
  ];
  for (const symbol of knownGlobalSymbols) assert.equal(globalThis[symbol], undefined);
  const globalSymbolsAfter = Object.getOwnPropertySymbols(globalThis);
  assert.deepEqual(
    globalSymbolsAfter.filter((symbol) => !globalSymbolsBefore.has(symbol)),
    [],
    'initializing Custodial security must not publish a symbol-keyed global capability',
  );
  assert.deepEqual(
    Object.getOwnPropertySymbols(Object.getPrototypeOf(storage)).filter((symbol) => !storageSymbolsBefore.has(symbol)),
    [],
    'installing the firewall must not publish its state on the Storage prototype',
  );
  assert.throws(
    () => storage.setItem('memphisAssignedDeviceId', 'KIOSK_02'),
    /cannot change/,
    'global callers must not obtain a raw Storage bypass for store-owned identity state',
  );
  assert.equal(storage.value('memphisAssignedDeviceId'), 'KIOSK_08');
  for (const method of ['setItem', 'removeItem', 'clear']) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(storage), method);
    assert.equal(descriptor?.configurable, false, `${method} firewall wrapper must not be replaceable`);
    assert.equal(descriptor?.writable, false, `${method} firewall wrapper must not be writable`);
  }

  // Web Storage named properties and same-origin realms can bypass prototype
  // wrappers. Model that raw mutation directly and prove the protected
  // capability checks its SecureStorage-backed binding before dispatch.
  storage.values.set('memphisAssignedDeviceId', 'KIOSK_02');
  let unauthorizedMutationDispatched = false;
  await assert.rejects(
    bridgeRuntime.security.mutateProtectedWork(() => {
      unauthorizedMutationDispatched = true;
    }),
    (error) => error instanceof CustodialSecurityTransitionError
      && error.code === 'custodial_security_state_unavailable',
  );
  assert.equal(unauthorizedMutationDispatched, false, 'identity tamper must fail before protected mutation');
  assert.equal(bridgeRuntime.security.getStatus().state, 'unavailable');
  assert.equal(bridgeRuntime.security.getStatus().deviceId, '');

  // Restoring the untrusted compatibility binding cannot revive the cached
  // credential. A complete SecureStorage-backed inspection must run first.
  storage.values.set('memphisAssignedDeviceId', 'KIOSK_08');
  await bridgeRuntime.security.ensureSecurityState();
  assert.equal(bridgeRuntime.security.getStatus().state, 'enrolled');
  assert.equal(bridgeRuntime.security.getStatus().deviceId, 'KIOSK_08');

  storage.values.set(CUSTODIAL_INSTALLATION_MARKER_KEY, 'wrong-installation-seal');
  let unauthorizedTransportDispatched = false;
  await assert.rejects(
    bridgeRuntime.credentialStore.dispatchAuthorizedTransport(() => {
      unauthorizedTransportDispatched = true;
    }),
    (error) => error instanceof CustodialSecurityTransitionError
      && error.code === 'custodial_security_state_unavailable',
  );
  assert.equal(unauthorizedTransportDispatched, false, 'installation-seal tamper must fail before transport dispatch');
  assert.deepEqual(
    {
      state: bridgeRuntime.security.getStatus().state,
      ready: bridgeRuntime.security.getStatus().ready,
      available: bridgeRuntime.security.getStatus().available,
      deviceId: bridgeRuntime.security.getStatus().deviceId,
    },
    { state: 'unavailable', ready: false, available: false, deviceId: '' },
  );
  assert.doesNotMatch(JSON.stringify(bridgeRuntime.security.getStatus()), new RegExp(secret));
  await assert.rejects(bridgeRuntime.security.ensureSecurityState(), /does not match this phone/i);
  assert.equal(bridgeRuntime.security.getStatus().quarantined, true);
  assert.equal(bridgeRuntime.security.getStatus().reason, 'installation_binding_mismatch');
}

// Every untrusted local binding field fails closed if it is changed, removed,
// or unreadable after protected enrollment is active. Restoring Web Storage
// alone cannot revive the cached credential; a full protected inspection must
// complete first.
for (const mutation of [
  ...CUSTODIAL_DEVICE_KEYS.flatMap((key) => [
    { key, label: `${key} changed`, apply: (storage) => storage.values.set(key, 'KIOSK-08') },
    { key, label: `${key} removed`, apply: (storage) => storage.values.delete(key) },
  ]),
  {
    key: CUSTODIAL_INSTALLATION_MARKER_KEY,
    label: 'installation marker changed',
    apply: (storage) => storage.values.set(CUSTODIAL_INSTALLATION_MARKER_KEY, 'changed-seal'),
  },
  {
    key: CUSTODIAL_INSTALLATION_MARKER_KEY,
    label: 'installation marker removed',
    apply: (storage) => storage.values.delete(CUSTODIAL_INSTALLATION_MARKER_KEY),
  },
]) {
  const secret = `matrix-secret-${mutation.label.replaceAll(' ', '-')}`;
  const fixture = enrolledFixture({ deviceId: 'KIOSK_08', credential: secret, seal: 'matrix-seal' });
  const storage = new RuntimeStorage(fixture.local);
  const store = createCustodialCredentialStore({
    secureStorage: memorySecure(fixture.secure),
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
  });
  await store.ensureSecurityState();
  const generationBeforeTamper = store.getGeneration();
  mutation.apply(storage);
  let callbackRan = false;
  await assert.rejects(
    store.dispatchAuthorizedTransport(() => { callbackRan = true; }),
    (error) => error instanceof CustodialSecurityTransitionError
      && error.code === 'custodial_security_state_unavailable',
    mutation.label,
  );
  assert.equal(callbackRan, false, `${mutation.label} must reject before credential handoff`);
  assert.equal(store.getGeneration(), generationBeforeTamper + 1, `${mutation.label} must publish one fail-closed transition`);
  assert.equal(store.getStatus().deviceId, '', `${mutation.label} must clear the presented identity`);
  assert.doesNotMatch(JSON.stringify(store.getStatus()), new RegExp(secret));

  const failedGeneration = store.getGeneration();
  await assert.rejects(store.dispatchAuthorizedTransport(() => { callbackRan = true; }), CustodialSecurityTransitionError);
  assert.equal(store.getGeneration(), failedGeneration, `${mutation.label} repeated rejection must not republish`);

  storage.values.set(mutation.key, fixture.local[mutation.key]);
  await assert.rejects(
    store.dispatchAuthorizedTransport(() => { callbackRan = true; }),
    CustodialSecurityTransitionError,
    `${mutation.label} restoration must not reactivate the cached credential`,
  );
  assert.equal(callbackRan, false);
  assert.equal(store.getGeneration(), failedGeneration);
  await store.ensureSecurityState();
  assert.equal(store.getStatus().state, 'enrolled');
  assert.equal(store.getStatus().deviceId, 'KIOSK_08');
}

for (const key of [...CUSTODIAL_DEVICE_KEYS, CUSTODIAL_INSTALLATION_MARKER_KEY]) {
  const secret = `read-failure-secret-${key}`;
  const fixture = enrolledFixture({ deviceId: 'KIOSK_08', credential: secret, seal: 'read-failure-seal' });
  const storage = new RuntimeStorage(fixture.local);
  const store = createCustodialCredentialStore({
    secureStorage: memorySecure(fixture.secure),
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
  });
  await store.ensureSecurityState();
  storage.readFailures.add(key);
  let callbackRan = false;
  await assert.rejects(
    store.dispatchAuthorizedTransport(() => { callbackRan = true; }),
    (error) => error instanceof CustodialSecurityTransitionError
      && error.code === 'custodial_security_state_unavailable',
  );
  assert.equal(callbackRan, false, `${key} read failure must reject before credential handoff`);
  assert.equal(store.getStatus().state, 'unavailable');
  assert.doesNotMatch(JSON.stringify(store.getStatus()), new RegExp(secret));
  storage.readFailures.delete(key);
  await assert.rejects(store.dispatchAuthorizedTransport(() => { callbackRan = true; }), CustodialSecurityTransitionError);
  await store.ensureSecurityState();
  assert.equal(store.getStatus().state, 'enrolled');
}

// A queued credential dispatch revalidates after earlier asynchronous protected
// work releases the FIFO; it cannot inherit that earlier operation's check.
{
  const fixture = enrolledFixture({ deviceId: 'KIOSK_08', credential: 'queued-dispatch-secret', seal: 'queued-dispatch-seal' });
  const storage = new RuntimeStorage(fixture.local);
  const store = createCustodialCredentialStore({
    secureStorage: memorySecure(fixture.secure),
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
  });
  await store.ensureSecurityState();
  const entered = deferred();
  const release = deferred();
  const blockingMutation = store.runWhenReady(async () => {
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  let transportRan = false;
  const queuedTransport = store.dispatchAuthorizedTransport(() => { transportRan = true; });
  storage.values.set('mz_employee_hub_device_id', 'KIOSK_02');
  release.resolve();
  await blockingMutation;
  await assert.rejects(queuedTransport, CustodialSecurityTransitionError);
  assert.equal(transportRan, false);
}

// Enrollment removal performs a second synchronous binding check immediately
// before handing the credential to its remote cleanup callback. This closes a
// mutation race during the preceding SecureStorage await.
{
  const fixture = enrolledFixture({ deviceId: 'KIOSK_08', credential: 'removal-race-secret', seal: 'removal-race-seal' });
  const storage = new RuntimeStorage(fixture.local);
  const secureReadEntered = deferred();
  const releaseSecureRead = deferred();
  let armRemovalRead = false;
  const secureStorage = memorySecure(fixture.secure, {
    hooks: {
      get: async ({ key }) => {
        if (!armRemovalRead || key !== CUSTODIAL_INSTALLATION_RECORD_KEY) return;
        armRemovalRead = false;
        secureReadEntered.resolve();
        await releaseSecureRead.promise;
      },
    },
  });
  const store = createCustodialCredentialStore({
    secureStorage,
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('removal-race'),
  });
  await store.ensureSecurityState();
  armRemovalRead = true;
  let remoteRemovalRan = false;
  const removal = store.removeEnrollment({
    beforeRemove: async () => { remoteRemovalRan = true; },
  });
  await secureReadEntered.promise;
  storage.values.set(CUSTODIAL_INSTALLATION_MARKER_KEY, 'raced-seal');
  releaseSecureRead.resolve();
  await assert.rejects(removal, /does not match this phone/i);
  assert.equal(remoteRemovalRan, false);
  assert.equal(store.getStatus().quarantined, true);
  assert.equal(store.getStatus().reason, 'installation_binding_changed_during_removal');
}

// Plaintext fallback credentials are removed without ever being read.
const plaintextStorage = memoryStorage({ [CUSTODIAL_CREDENTIAL_KEY]: 'plaintext-must-not-be-used' });
const plaintextStore = createCustodialCredentialStore({
  secureStorage: memorySecure(),
  storage: plaintextStorage,
  indexedDb: memoryIndexedDb([], { exists: false }),
});
assert.equal(plaintextStore.getStatus().ready, false, 'security must fail closed before its first full inspection');
assert.equal(await plaintextStore.readCredential(), '');
assert.equal(plaintextStore.getStatus().ready, true);
assert.equal(plaintextStorage.value(CUSTODIAL_CREDENTIAL_KEY), undefined, 'legacy plaintext credential must be purged');
assert.equal(
  plaintextStorage.operations.some(([operation, key]) => operation === 'get' && key === CUSTODIAL_CREDENTIAL_KEY),
  false,
  'legacy plaintext credential must never be read',
);

// Production's SecureStorage credential-only shape migrates once, binds the
// canonical identity, and leaves the real IndexedDB queue byte-for-byte intact.
const legacyQueue = memoryIndexedDb([{
  id: 17,
  type: 'start_session',
  payload: { p_client_session_id: 'legacy-session', p_device_id: 'KIOSK_04' },
  state: 'pending',
  retry_count: 3,
}]);
const legacyQueueBefore = structuredClone(legacyQueue.records);
const legacyStorage = memoryStorage({ memphisAssignedDeviceId: 'KIOSK_04' });
const legacySecure = memorySecure({ [CUSTODIAL_CREDENTIAL_KEY]: 'secure-credential' });
const legacyStore = createCustodialCredentialStore({
  secureStorage: legacySecure,
  storage: legacyStorage,
  indexedDb: legacyQueue,
  cryptoApi: deterministicCrypto('migration-seal'),
  now: () => '2026-08-01T01:00:00.000Z',
});
assert.deepEqual(await Promise.all([legacyStore.readCredential(), legacyStore.readCredential()]), ['secure-credential', 'secure-credential']);
const migrated = parsed(legacySecure.value(CUSTODIAL_INSTALLATION_RECORD_KEY));
assert.equal(migrated.schema_version, 1);
assert.equal(migrated.device_id, 'KIOSK_04');
assert.equal(migrated.credential, 'secure-credential');
assert.equal(migrated.migrated_from_credential_only_state, true);
assert.equal(legacySecure.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
assert.equal(legacySecure.value(CUSTODIAL_INSTALLATION_SEAL_KEY), undefined);
for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(legacyStorage.value(key), 'KIOSK_04');
assert.equal(legacyStorage.value(CUSTODIAL_INSTALLATION_MARKER_KEY), migrated.installation_seal);
assert.deepEqual(legacyQueue.records, legacyQueueBefore, 'migration must not claim, rewrite, or delete scan actions');
assert.equal(
  legacySecure.operations.filter(([operation, key]) => operation === 'set' && key === CUSTODIAL_INSTALLATION_RECORD_KEY).length,
  1,
  'serialized concurrent reads must migrate the protected record exactly once',
);

// Queue-only restored state is enough to quarantine even when it contains no
// device ID. Both durable records retain the original queue count.
const queueOnlyIndexedDb = memoryIndexedDb([{
  id: 22,
  type: 'record_scan_event',
  payload: { p_location_code: 'TETM', p_event_type: 'work_position_check' },
  state: 'pending',
  retry_count: 0,
}]);
const queueOnlyStorage = memoryStorage();
const queueOnlyStore = createCustodialCredentialStore({
  secureStorage: memorySecure(),
  storage: queueOnlyStorage,
  indexedDb: queueOnlyIndexedDb,
  cryptoApi: deterministicCrypto('queue-recovery'),
});
await assert.rejects(() => queueOnlyStore.ensureSecurityState(), /Preserve its offline work/);
const queueOnlyQuarantine = parsed(queueOnlyStorage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY));
const queueOnlyRecovery = parsed(queueOnlyStorage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
assert.equal(queueOnlyQuarantine.active, true);
assert.equal(queueOnlyQuarantine.preserved_counts.scan_queue, 1);
assert.equal(queueOnlyRecovery.status, 'pending_manager_recovery');
assert.equal(queueOnlyRecovery.preserved_counts.total_pending, 1);
assert.deepEqual(queueOnlyRecovery.original_identities, []);
assert.deepEqual(queueOnlyIndexedDb.records[0].payload, { p_location_code: 'TETM', p_event_type: 'work_position_check' });
assert.equal(queueOnlyStore.getStatus().quarantined, true);
assert.equal(queueOnlyStore.getStatus().ready, false);
assert.equal(queueOnlyStore.getStatus().reason, 'preserved_state_without_protected_enrollment');

// Explicit removal can resolve a zero-work quarantine, but the recovery record is
// retained as resolved provenance so a later inspection does not reconstruct it.
const zeroWorkStorage = memoryStorage({ memphisAssignedDeviceId: 'KIOSK_07' });
const zeroWorkStore = createCustodialCredentialStore({
  secureStorage: memorySecure(),
  storage: zeroWorkStorage,
  indexedDb: memoryIndexedDb([], { exists: false }),
  cryptoApi: deterministicCrypto('zero-work-recovery'),
  now: () => '2026-08-01T01:30:00.000Z',
});
await assert.rejects(() => zeroWorkStore.ensureSecurityState(), /Preserve its offline work/);
await zeroWorkStore.removeEnrollment();
const removedRecovery = parsed(zeroWorkStorage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
assert.equal(removedRecovery.status, 'resolved');
assert.equal(removedRecovery.resolution.method, 'explicit_enrollment_removal');
assert.equal(removedRecovery.resolution.preserved_work_count, 0);
assert.equal(zeroWorkStorage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
assert.equal((await zeroWorkStore.ensureSecurityState()).state, 'unenrolled');
assert.equal(zeroWorkStore.getStatus().quarantined, false);

// All identity and work surfaces are inventoried, recorded, and preserved.
const preservedEntries = {
  memphisAssignedDeviceId: 'KIOSK_06',
  'session:session-1': JSON.stringify({ session_uuid: 'session-1', device_id: 'KIOSK_06', status: 'pending_submit' }),
  'mz_messenger_v2_outbox:message-1': JSON.stringify({ id: 'message-1', device_id: 'KIOSK_06' }),
  'mz_chatscope_outbox:message-2': JSON.stringify({ id: 'message-2', device_id: 'KIOSK_06' }),
};
const preservedStorage = memoryStorage(preservedEntries);
const preservedQueue = memoryIndexedDb([{ id: 31, payload: { p_device_id: 'KIOSK_06' }, state: 'pending' }]);
const preservedSecure = memorySecure();
const preservedStore = createCustodialCredentialStore({
  secureStorage: preservedSecure,
  storage: preservedStorage,
  indexedDb: preservedQueue,
  cryptoApi: deterministicCrypto('preserved-recovery'),
});
await assert.rejects(() => preservedStore.readCredential(), /Protected enrollment state does not match this phone/);
const preservedRecovery = parsed(preservedStorage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
assert.deepEqual(preservedRecovery.preserved_counts, {
  sessions: 1,
  messenger_outbox: 1,
  chatscope_outbox: 1,
  messenger_drafts: 0,
  scan_completion_drafts: 0,
  work_position_evidence: 0,
  scan_resume_records: 0,
  scan_queue: 1,
  total_pending: 4,
});
assert.deepEqual(preservedRecovery.original_device_keys, { memphisAssignedDeviceId: 'KIOSK_06' });
assert.deepEqual(preservedRecovery.original_identities.map((identity) => identity.canonical_device_id), ['KIOSK_06']);
for (const [key, value] of Object.entries(preservedEntries)) assert.equal(preservedStorage.value(key), value);
assert.equal(preservedQueue.records.length, 1);

// Recovery refuses mismatched selection before the manager verifier is called.
let mismatchVerifierCalls = 0;
await assert.rejects(
  () => preservedStore.recoverEnrollment({
    deviceId: 'KIOSK_07',
    managerCode: '12345678',
    credential: 'replacement',
    verifyManagerCode: async () => { mismatchVerifierCalls += 1; return true; },
  }),
  (error) => error instanceof CustodialRecoveryError && error.reason === 'selected_identity_mismatch',
);
assert.equal(mismatchVerifierCalls, 0);

// A second preserved identity makes recovery ambiguous, regardless of manager code.
preservedStorage.setItem('mz_scan_device_id', 'KIOSK_07');
await assert.rejects(
  () => preservedStore.recoverEnrollment({
    deviceId: 'KIOSK_06',
    managerCode: '12345678',
    credential: 'replacement',
    verifyManagerCode: async () => true,
  }),
  (error) => error instanceof CustodialRecoveryError && error.reason === 'ambiguous_preserved_identity',
);
preservedStorage.removeItem('mz_scan_device_id');

// Matching single-identity manager recovery binds all identity keys while keeping
// sessions, both outboxes, and the scan action unchanged.
const recoveryResult = await preservedStore.recoverEnrollment({
  deviceId: 'KIOSK_06',
  managerCode: '12345678',
  verifyManagerCode: async ({ managerCode, deviceId, recovery }) => ({
    authorized: managerCode === '12345678' && deviceId === 'KIOSK_06' && recovery.preserved_counts.total_pending === 4,
    device_credential: 'recovered-credential',
  }),
});
assert.equal(recoveryResult.deviceId, 'KIOSK_06');
assert.equal(preservedStorage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
assert.equal(parsed(preservedStorage.value(CUSTODIAL_RECOVERY_RECORD_KEY)).status, 'resolved');
for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(preservedStorage.value(key), 'KIOSK_06');
for (const [key, value] of Object.entries(preservedEntries)) {
  if (!CUSTODIAL_DEVICE_KEYS.includes(key)) assert.equal(preservedStorage.value(key), value);
}
assert.equal(await preservedStore.readCredential(), 'recovered-credential');
assert.equal(preservedStore.getStatus().ready, true);

// Removal refuses every preserved work surface and always invalidates generation.
const generationBeforeRefusal = preservedStore.getGeneration();
await assert.rejects(
  () => preservedStore.removeEnrollment(),
  (error) => error instanceof CustodialPendingWorkError && error.preservedCounts.total_pending === 4,
);
assert.ok(preservedStore.getGeneration() > generationBeforeRefusal);
assert.equal(await preservedStore.readCredential(), 'recovered-credential');
for (const [key, value] of Object.entries(preservedEntries)) {
  if (!CUSTODIAL_DEVICE_KEYS.includes(key)) assert.equal(preservedStorage.value(key), value);
}

// A server-side credential rejection transitions the still-valid local record into
// manager recovery instead of trying to delete it around pending offline work.
const rejectedRecordBefore = preservedSecure.value(CUSTODIAL_INSTALLATION_RECORD_KEY);
await assert.rejects(
  () => preservedStore.requireManagerRecovery(),
  (error) => error.code === 'custodial_restore_quarantine' && error.reason === 'server_credential_rejected',
);
assert.equal(preservedSecure.value(CUSTODIAL_INSTALLATION_RECORD_KEY), rejectedRecordBefore);
assert.equal(preservedStore.getStatus().quarantined, true);
assert.equal(preservedStore.getStatus().ready, false);
const serverRejectionRecovery = parsed(preservedStorage.value(CUSTODIAL_RECOVERY_RECORD_KEY));
assert.equal(serverRejectionRecovery.history.at(-1).status, 'resolved', 'a later recovery incident must retain earlier resolution provenance');
for (const [key, value] of Object.entries(preservedEntries)) {
  if (!CUSTODIAL_DEVICE_KEYS.includes(key)) assert.equal(preservedStorage.value(key), value);
}
await preservedStore.recoverEnrollment({
  deviceId: 'KIOSK_06',
  managerCode: '87654321',
  verifyManagerCode: async () => ({ authorized: true, device_credential: 'server-replacement-credential' }),
});
assert.equal(await preservedStore.readCredential(), 'server-replacement-credential');
assert.equal(preservedQueue.records.length, 1);

// A mismatched installation marker enters durable quarantine without exposing the credential.
const mismatchFixture = enrolledFixture({ deviceId: 'KIOSK_04', credential: 'sealed-secret', seal: 'secure-seal' });
const mismatchStorage = memoryStorage({ ...mismatchFixture.local, [CUSTODIAL_INSTALLATION_MARKER_KEY]: 'restored-seal' });
const mismatchStore = createCustodialCredentialStore({
  secureStorage: memorySecure(mismatchFixture.secure),
  storage: mismatchStorage,
  indexedDb: memoryIndexedDb([], { exists: false }),
  cryptoApi: deterministicCrypto('mismatch-recovery'),
});
await assert.rejects(() => mismatchStore.readCredential(), /Protected enrollment state does not match this phone/);
assert.equal(mismatchStore.getStatus().reason, 'installation_binding_mismatch');
assert.equal(mismatchStore.getQuarantine().active, true);

// Local binding failure rolls both protected and local state back to the exact
// previous enrollment and never falls back to plaintext.
const rollbackFixture = enrolledFixture({ deviceId: 'KIOSK_06', credential: 'old-secret', seal: 'old-seal' });
let failIdentityWriteOnce = true;
const rollbackStorage = memoryStorage(rollbackFixture.local, {
  failures: {
    set: ({ key }) => {
      if (key !== 'mz_scan_device_id' || !failIdentityWriteOnce) return false;
      failIdentityWriteOnce = false;
      return true;
    },
  },
});
const rollbackSecure = memorySecure(rollbackFixture.secure);
const rollbackStore = createCustodialCredentialStore({
  secureStorage: rollbackSecure,
  storage: rollbackStorage,
  indexedDb: memoryIndexedDb([], { exists: false }),
  cryptoApi: deterministicCrypto('rollback-seal'),
});
const rollbackLocalBefore = rollbackStorage.snapshot();
const rollbackSecureBefore = rollbackSecure.snapshot();
await assert.rejects(
  () => rollbackStore.setEnrollment({ credential: 'new-secret', deviceId: 'KIOSK_06' }),
  /Protected phone state could not be verified/,
);
assert.deepEqual(rollbackStorage.snapshot(), rollbackLocalBefore);
assert.deepEqual(rollbackSecure.snapshot(), rollbackSecureBefore);
assert.equal(rollbackStorage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);
assert.equal(rollbackStore.getStatus().ready, false);

// SecureStorage get/set failures fail closed and do not leave partial bindings.
const getFailureFixture = enrolledFixture();
const getFailureStore = createCustodialCredentialStore({
  secureStorage: memorySecure(getFailureFixture.secure, { failures: { get: CUSTODIAL_INSTALLATION_RECORD_KEY } }),
  storage: memoryStorage(getFailureFixture.local),
  indexedDb: memoryIndexedDb([], { exists: false }),
});
await assert.rejects(() => getFailureStore.readCredential(), /Protected credential storage is unavailable/);
assert.equal(getFailureStore.getStatus().available, false);
assert.equal(getFailureStore.getStatus().ready, false);
assert.ok(getFailureStore.getGeneration() > 0);

const setFailureStorage = memoryStorage({ [CUSTODIAL_CREDENTIAL_KEY]: 'plaintext-never-read' });
const setFailureSecure = memorySecure({}, { failures: { set: CUSTODIAL_INSTALLATION_RECORD_KEY } });
const setFailureStore = createCustodialCredentialStore({
  secureStorage: setFailureSecure,
  storage: setFailureStorage,
  indexedDb: memoryIndexedDb([], { exists: false }),
  cryptoApi: deterministicCrypto('failed-set-seal'),
});
await assert.rejects(
  () => setFailureStore.setEnrollment({ credential: 'new-secret', deviceId: 'KIOSK_08' }),
  /Protected credential storage is unavailable/,
);
assert.equal(setFailureSecure.value(CUSTODIAL_INSTALLATION_RECORD_KEY), undefined);
assert.equal(setFailureStorage.value('memphisAssignedDeviceId'), undefined);
assert.equal(setFailureStorage.value(CUSTODIAL_CREDENTIAL_KEY), undefined);

// If active quarantine persistence fails after the durable recovery journal is
// written, the protected record remains unchanged and the next ensure rolls the
// journal forward into active quarantine.
const forcedRecoveryFixture = enrolledFixture({ deviceId: 'KIOSK_09', credential: 'still-protected', seal: 'forced-recovery-seal' });
let failActiveQuarantineOnce = true;
const forcedRecoveryStorage = memoryStorage(forcedRecoveryFixture.local, {
  failures: {
    set: ({ key }) => {
      if (key !== CUSTODIAL_RESTORE_QUARANTINE_KEY || !failActiveQuarantineOnce) return false;
      failActiveQuarantineOnce = false;
      return true;
    },
  },
});
const forcedRecoverySecure = memorySecure(forcedRecoveryFixture.secure);
const forcedRecoveryStore = createCustodialCredentialStore({
  secureStorage: forcedRecoverySecure,
  storage: forcedRecoveryStorage,
  indexedDb: memoryIndexedDb([], { exists: false }),
  cryptoApi: deterministicCrypto('forced-recovery'),
});
await assert.rejects(
  () => forcedRecoveryStore.requireManagerRecovery('server_credential_rejected'),
  /Protected phone state could not be verified/,
);
assert.deepEqual(forcedRecoverySecure.snapshot(), forcedRecoveryFixture.secure);
assert.equal(parsed(forcedRecoveryStorage.value(CUSTODIAL_RECOVERY_RECORD_KEY)).status, 'pending_manager_recovery');
assert.equal(forcedRecoveryStorage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY), undefined);
assert.equal(forcedRecoveryStore.getStatus().quarantined, true);
await assert.rejects(() => forcedRecoveryStore.ensureSecurityState(), /Preserve its offline work/);
assert.equal(parsed(forcedRecoveryStorage.value(CUSTODIAL_RESTORE_QUARANTINE_KEY)).active, true);
assert.deepEqual(forcedRecoverySecure.snapshot(), forcedRecoveryFixture.secure);

// Once the server credential is revoked, removal is forward-only. A protected
// cleanup failure restores the compatibility state and exact terminal journal,
// never the already-revoked active credential, and the same operation resumes.
const removalFixture = enrolledFixture({ deviceId: 'KIOSK_08', credential: 'remove-secret', seal: 'remove-seal' });
let failLegacyRemoveOnce = true;
const removalSecure = memorySecure(removalFixture.secure, {
  failures: {
    remove: ({ key }) => {
      if (key !== CUSTODIAL_CREDENTIAL_KEY || !failLegacyRemoveOnce) return false;
      failLegacyRemoveOnce = false;
      return true;
    },
  },
});
const removalStorage = memoryStorage(removalFixture.local);
const removalStore = createCustodialCredentialStore({
  secureStorage: removalSecure,
  storage: removalStorage,
  indexedDb: memoryIndexedDb([], { exists: false }),
  cryptoApi: deterministicCrypto('removal'),
});
await removalStore.ensureSecurityState();
const removalGeneration = removalStore.getGeneration();
let removalNotifications = 0;
removalStore.subscribe(() => { removalNotifications += 1; });
await assert.rejects(
  () => removalStore.removeCredential({ beforeRemove: successfulRemoteRemoval }),
  /Protected credential storage is unavailable/,
);
assert.equal(
  removalSecure.value(CUSTODIAL_INSTALLATION_RECORD_KEY),
  undefined,
  'a server-revoked credential must never be restored after protected cleanup begins',
);
for (const [key, value] of Object.entries(removalFixture.local)) assert.equal(removalStorage.value(key), value);
assert.equal(parsed(removalStorage.value(CUSTODIAL_REMOVAL_OPERATION_KEY)).phase, 'server_logged_out');
assert.ok(removalStore.getGeneration() > removalGeneration);
assert.ok(removalNotifications >= 1);
assert.equal(removalStore.getStatus().ready, false);
await removalStore.removeCredential({ beforeRemove: successfulRemoteRemoval });
assert.deepEqual(removalSecure.snapshot(), {});
assert.equal(removalStorage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);

// Every asynchronous public operation shares one FIFO exclusive queue. Delayed
// SecureStorage calls prove that reads, sets, and removals cannot cross each other.
{
  const fixture = enrolledFixture({ credential: 'read-remove-old' });
  const gate = oneShotGate('get', CUSTODIAL_INSTALLATION_RECORD_KEY);
  const secure = memorySecure(fixture.secure, { hooks: gate.hooks });
  const storage = memoryStorage(fixture.local);
  const store = createCustodialCredentialStore({
    secureStorage: secure,
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('read-remove'),
  });
  const read = store.readCredential();
  await gate.entered;
  assert.equal(store.getStatus().ready, false, 'security must stay fail-closed throughout a read reconciliation');
  const removal = store.removeEnrollment({ beforeRemove: successfulRemoteRemoval });
  assert.equal(secure.operations.some(([operation]) => operation === 'remove'), false, 'remove must wait for the in-flight read');
  gate.release();
  assert.equal(await read, 'read-remove-old');
  await removal;
  assert.equal(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY), undefined);
}

{
  const fixture = enrolledFixture({ credential: 'read-set-old' });
  const gate = oneShotGate('get', CUSTODIAL_INSTALLATION_RECORD_KEY);
  const secure = memorySecure(fixture.secure, { hooks: gate.hooks });
  const store = createCustodialCredentialStore({ secureStorage: secure, storage: memoryStorage(fixture.local), indexedDb: memoryIndexedDb([], { exists: false }), cryptoApi: deterministicCrypto('read-set') });
  const read = store.readCredential();
  await gate.entered;
  const set = store.setEnrollment({ credential: 'read-set-new', deviceId: 'KIOSK_06' });
  assert.equal(secure.operations.some(([operation]) => operation === 'set'), false, 'set must wait for the in-flight read');
  gate.release();
  assert.equal(await read, 'read-set-old');
  await set;
  assert.equal(parsed(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY)).credential, 'read-set-new');
}

{
  const gate = oneShotGate('set', CUSTODIAL_INSTALLATION_RECORD_KEY);
  const secure = memorySecure({}, { hooks: gate.hooks });
  const storage = memoryStorage();
  const store = createCustodialCredentialStore({ secureStorage: secure, storage, indexedDb: memoryIndexedDb([], { exists: false }), cryptoApi: deterministicCrypto('set-remove') });
  const set = store.setEnrollment({ credential: 'set-before-remove', deviceId: 'KIOSK_09' });
  await gate.entered;
  assert.equal(store.getStatus().ready, false, 'security must stay fail-closed throughout an enrollment commit');
  const removal = store.removeEnrollment({ beforeRemove: successfulRemoteRemoval });
  assert.equal(secure.operations.some(([operation]) => operation === 'remove'), false, 'remove must wait for the in-flight set');
  gate.release();
  await set;
  await removal;
  assert.equal(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY), undefined);
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
}

{
  const gate = oneShotGate('set', CUSTODIAL_INSTALLATION_RECORD_KEY);
  const secure = memorySecure({}, { hooks: gate.hooks });
  const store = createCustodialCredentialStore({ secureStorage: secure, storage: memoryStorage(), indexedDb: memoryIndexedDb([], { exists: false }), cryptoApi: deterministicCrypto('two-sets') });
  const first = store.setEnrollment({ credential: 'first-set', deviceId: 'KIOSK_10' });
  await gate.entered;
  const second = store.setEnrollment({ credential: 'second-set', deviceId: 'KIOSK_10' });
  assert.equal(secure.operations.filter(([operation]) => operation === 'set').length, 1, 'second set must wait for the first commit');
  gate.release();
  await Promise.all([first, second]);
  assert.equal(parsed(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY)).credential, 'second-set');
}

// Enrollment is one resumable operation across the backend response and the
// native SecureStorage commit. A lost response or duplicate submit reuses the
// same UUID, and a failed native write leaves a secret-free journal that can be
// retried without minting another active credential.
{
  let failFirstProtectedCommit = true;
  const secure = memorySecure({}, {
    failures: {
      set: ({ key }) => {
        if (key !== CUSTODIAL_INSTALLATION_RECORD_KEY || !failFirstProtectedCommit) return false;
        failFirstProtectedCommit = false;
        return true;
      },
    },
  });
  const storage = memoryStorage();
  const store = createCustodialCredentialStore({
    secureStorage: secure,
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('resumable-enrollment'),
    now: () => '2026-08-01T03:00:00.000Z',
  });

  const [first, duplicate] = await Promise.all([
    store.prepareEnrollmentOperation({ deviceId: 'KIOSK_08', flow: 'enrollment' }),
    store.prepareEnrollmentOperation({ deviceId: 'KIOSK_08', flow: 'enrollment' }),
  ]);
  assert.equal(first.operation_id, duplicate.operation_id, 'concurrent duplicate enrollment must share one operation ID');
  assert.match(first.operation_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(
    storage.operations.filter(([operation, key]) => operation === 'set' && key === CUSTODIAL_ENROLLMENT_OPERATION_KEY).length,
    1,
    'response-loss retry must not create another enrollment journal',
  );
  assert.doesNotMatch(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), /server-device-secret/);
  await assert.rejects(
    () => store.prepareEnrollmentOperation({ deviceId: 'KIOSK_09', flow: 'enrollment' }),
    (error) => error instanceof CustodialEnrollmentOperationError && error.reason === 'enrollment_operation_conflict',
  );

  await assert.rejects(
    () => store.commitEnrollmentOperation({
      operationId: first.operation_id,
      credential: 'server-device-secret',
      deviceId: 'KIOSK_08',
      credentialId: 'credential-row-1',
      resumeExpiresAt: '2026-08-01T03:30:00.000Z',
    }),
    /Protected credential storage is unavailable/,
  );
  assert.equal(parsed(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY)).status, 'pending_server');
  assert.doesNotMatch(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), /server-device-secret/);
  assert.equal((await store.prepareEnrollmentOperation({ deviceId: 'KIOSK_08', flow: 'enrollment' })).operation_id, first.operation_id);

  const commits = await Promise.all([
    store.commitEnrollmentOperation({
      operationId: first.operation_id,
      credential: 'server-device-secret',
      deviceId: 'KIOSK_08',
      credentialId: 'credential-row-1',
      resumeExpiresAt: '2026-08-01T03:30:00.000Z',
    }),
    store.commitEnrollmentOperation({
      operationId: first.operation_id,
      credential: 'server-device-secret',
      deviceId: 'KIOSK_08',
      credentialId: 'credential-row-1',
      resumeExpiresAt: '2026-08-01T03:30:00.000Z',
    }),
  ]);
  assert.deepEqual(commits.map((result) => result.resumed), [false, true]);
  assert.equal(parsed(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY)).credential, 'server-device-secret');
  assert.equal(parsed(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY)).status, 'local_committed_pending_server_confirmation');

  let ordinaryCalls = 0;
  await assert.rejects(
    () => store.dispatchAuthorizedTransport(() => { ordinaryCalls += 1; }),
    (error) => error instanceof CustodialSecurityTransitionError
      && error.code === 'custodial_enrollment_confirmation_pending',
  );
  assert.equal(ordinaryCalls, 0, 'ordinary API traffic must not reach transport before enrollment confirmation');

  let confirmationCalls = 0;
  const confirmationDispatch = await store.dispatchAuthorizedTransport(({ credential, deviceId }) => {
    confirmationCalls += 1;
    assert.equal(credential, 'server-device-secret');
    assert.equal(deviceId, 'KIOSK_08');
  }, {
    allowPendingEnrollmentConfirmation: true,
    expectedEnrollmentOperationId: first.operation_id,
  });
  await confirmationDispatch.completion;
  assert.equal(confirmationCalls, 1, 'only the exact confirmation operation may use the pending credential');
  await store.confirmEnrollmentOperation(first.operation_id);
  const ordinaryDispatch = await store.dispatchAuthorizedTransport(() => { ordinaryCalls += 1; });
  await ordinaryDispatch.completion;
  assert.equal(ordinaryCalls, 1);
  assert.equal(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY), undefined);
}

// If both the local commit and its compensation encounter failures, the exact
// operation remains resumable. Replaying its server result repairs the binding,
// resolves quarantine, and still produces one protected credential record.
{
  let failIdentityWriteOnce = true;
  let failProtectedRollbackOnce = true;
  const storage = memoryStorage({}, {
    failures: {
      set: ({ key }) => {
        if (key !== 'mz_scan_device_id' || !failIdentityWriteOnce) return false;
        failIdentityWriteOnce = false;
        return true;
      },
    },
  });
  const secure = memorySecure({}, {
    failures: {
      remove: ({ key }) => {
        if (key !== CUSTODIAL_INSTALLATION_RECORD_KEY || !failProtectedRollbackOnce) return false;
        failProtectedRollbackOnce = false;
        return true;
      },
    },
  });
  const store = createCustodialCredentialStore({
    secureStorage: secure,
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('rollback-resume'),
    now: () => '2026-08-01T03:15:00.000Z',
  });
  const operation = await store.prepareEnrollmentOperation({ deviceId: 'KIOSK_09', flow: 'enrollment' });
  await assert.rejects(
    () => store.commitEnrollmentOperation({
      operationId: operation.operation_id,
      credential: 'rollback-replay-secret',
      deviceId: 'KIOSK_09',
    }),
    (error) => error.code === 'custodial_restore_quarantine' && error.reason === 'enrollment_commit_rollback_failed',
  );
  assert.equal(parsed(storage.value(CUSTODIAL_ENROLLMENT_OPERATION_KEY)).status, 'pending_server');
  assert.equal(store.getStatus().quarantined, true);
  assert.equal((await store.prepareEnrollmentOperation({ deviceId: 'KIOSK_09', flow: 'enrollment' })).operation_id, operation.operation_id);
  await store.commitEnrollmentOperation({
    operationId: operation.operation_id,
    credential: 'rollback-replay-secret',
    deviceId: 'KIOSK_09',
  });
  assert.equal(store.getStatus().quarantined, false);
  assert.equal(parsed(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY)).credential, 'rollback-replay-secret');
  assert.equal(parsed(storage.value(CUSTODIAL_RECOVERY_RECORD_KEY)).resolution.method, 'resumed_enrollment_after_local_commit_failure');
}

// Protected-work writes and security transitions use the same FIFO. Recovery
// cannot invalidate identity midway through a mutation, and a mutation queued
// after recovery begins never executes.
{
  const fixture = enrolledFixture({ deviceId: 'KIOSK_07', credential: 'serialized-secret' });
  const storage = memoryStorage(fixture.local);
  const store = createCustodialCredentialStore({
    secureStorage: memorySecure(fixture.secure),
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('serialized-work'),
  });
  await store.ensureSecurityState();
  const entered = deferred();
  const release = deferred();
  const mutation = store.runWhenReady(async ({ deviceId }) => {
    assert.equal(deviceId, 'KIOSK_07');
    entered.resolve();
    await release.promise;
    storage.setItem('mz_messenger_v2_draft:serialized', JSON.stringify({ device_id: deviceId }));
  }, { requireEnrollment: true });
  await entered.promise;
  const recovery = store.requireManagerRecovery('serialized_rejection');
  await Promise.resolve();
  assert.equal(store.getStatus().ready, true, 'recovery must wait until the protected mutation commits');
  release.resolve();
  await mutation;
  await assert.rejects(recovery, (error) => error.code === 'custodial_restore_quarantine');
  let lateMutationCalls = 0;
  await assert.rejects(
    () => store.runWhenReady(() => { lateMutationCalls += 1; }, { requireEnrollment: true }),
    (error) => error instanceof CustodialSecurityTransitionError && store.getStatus().quarantined === true,
  );
  assert.equal(lateMutationCalls, 0);
}

// Dispatch holds the security FIFO only through the synchronous fetch start.
// Long-poll completion cannot delay recovery/removal, and stale responses fail
// the generation postcheck instead of mutating a later security state.
{
  const fixture = enrolledFixture({ deviceId: 'KIOSK_06', credential: 'deferred-transport-secret' });
  const store = createCustodialCredentialStore({
    secureStorage: memorySecure(fixture.secure),
    storage: memoryStorage(fixture.local),
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('deferred-transport'),
  });
  await store.ensureSecurityState();
  const response = deferred();
  let dispatchCalls = 0;
  const dispatched = await store.dispatchAuthorizedTransport(({ credential }) => {
    dispatchCalls += 1;
    assert.equal(credential, 'deferred-transport-secret');
    return response.promise;
  });
  assert.equal(dispatchCalls, 1, 'transport must dispatch synchronously under the security FIFO');
  let responseSettled = false;
  void dispatched.completion.then(() => { responseSettled = true; });
  await assert.rejects(
    store.requireManagerRecovery('recovery_after_transport_dispatch'),
    (error) => error.code === 'custodial_restore_quarantine',
  );
  assert.equal(responseSettled, false, 'recovery must not wait for a long-poll response');
  response.resolve({ ok: true });
  assert.deepEqual(await dispatched.completion, { ok: true });
  await assert.rejects(
    () => store.waitForStableState({ requireEnrollment: true, expectedGeneration: dispatched.generation }),
    (error) => error instanceof CustodialSecurityTransitionError,
  );
  let lateDispatchCalls = 0;
  await assert.rejects(
    () => store.dispatchAuthorizedTransport(() => { lateDispatchCalls += 1; }),
    (error) => error instanceof CustodialSecurityTransitionError,
  );
  assert.equal(lateDispatchCalls, 0, 'transport queued after recovery must never dispatch');
}

// Local enrollment is erased only after the backend's single atomic removal
// operation has durably completed. A failed call reuses the same operation UUID;
// legacy split-operation journals remain restart-compatible across upgrades.
{
  const fixture = enrolledFixture({ deviceId: 'KIOSK_07', credential: 'remove-after-dispatch-secret' });
  const secure = memorySecure(fixture.secure);
  const store = createCustodialCredentialStore({
    secureStorage: secure,
    storage: memoryStorage(fixture.local),
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('remove-after-dispatch'),
  });
  await store.ensureSecurityState();
  const response = deferred();
  const dispatched = await store.dispatchAuthorizedTransport(() => response.promise);
  await store.removeEnrollment({ beforeRemove: successfulRemoteRemoval });
  assert.equal(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY), undefined, 'removal must enter after request dispatch without waiting for its response');
  response.resolve({ ok: true });
  await dispatched.completion;
  await assert.rejects(
    () => store.waitForStableState({ requireEnrollment: true, expectedGeneration: dispatched.generation }),
    (error) => error instanceof CustodialSecurityTransitionError,
  );
}

{
  const fixture = enrolledFixture({ deviceId: 'KIOSK_10', credential: 'remove-workflow-secret' });
  const secure = memorySecure(fixture.secure);
  const storage = memoryStorage(fixture.local);
  const store = createCustodialCredentialStore({
    secureStorage: secure,
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto('durable-removal'),
  });
  await store.ensureSecurityState();
  const remoteCalls = [];
  await assert.rejects(
    () => store.removeEnrollment({
      beforeRemove: async ({ phase, operationId }) => {
        remoteCalls.push(`remove:${phase}:${operationId}`);
        throw new Error('removal service offline');
      },
    }),
    /removal service offline/,
  );
  const pendingRemoval = parsed(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY));
  assert.equal(pendingRemoval.phase, 'pending_server_removal');
  assert.equal(parsed(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY)).credential, 'remove-workflow-secret');

  await store.removeEnrollment({
    beforeRemove: async ({ phase, operationId, checkpoint }) => {
      assert.equal(phase, 'pending_server_removal');
      assert.equal(operationId, pendingRemoval.operation_id, 'retry must reuse the durable removal UUID');
      remoteCalls.push(`remove:success:${operationId}`);
      await checkpoint('server_logged_out');
    },
  });
  assert.deepEqual(remoteCalls, [
    `remove:pending_server_removal:${pendingRemoval.operation_id}`,
    `remove:success:${pendingRemoval.operation_id}`,
  ]);
  assert.equal(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY), undefined);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
  for (const key of CUSTODIAL_DEVICE_KEYS) assert.equal(storage.value(key), undefined);
}

for (const legacyPhase of ['pending_push_unregister', 'push_unregistered']) {
  const fixture = enrolledFixture({ deviceId: 'KIOSK_07', credential: `legacy-removal-${legacyPhase}` });
  const legacyOperation = {
    schema_version: 1,
    operation_id: `11223344-5566-4777-8888-${legacyPhase === 'pending_push_unregister' ? '000000000001' : '000000000002'}`,
    device_id: 'KIOSK_07',
    phase: legacyPhase,
    created_at: '2026-07-31T23:59:00.000Z',
    updated_at: '2026-07-31T23:59:00.000Z',
  };
  const storage = memoryStorage({
    ...fixture.local,
    [CUSTODIAL_REMOVAL_OPERATION_KEY]: JSON.stringify(legacyOperation),
  });
  const secure = memorySecure(fixture.secure);
  const store = createCustodialCredentialStore({
    secureStorage: secure,
    storage,
    indexedDb: memoryIndexedDb([], { exists: false }),
    cryptoApi: deterministicCrypto(`legacy-${legacyPhase}`),
  });
  await store.removeEnrollment({
    beforeRemove: async ({ phase, operationId, checkpoint }) => {
      assert.equal(phase, legacyPhase);
      assert.equal(operationId, legacyOperation.operation_id);
      await checkpoint('server_logged_out');
    },
  });
  assert.equal(secure.value(CUSTODIAL_INSTALLATION_RECORD_KEY), undefined);
  assert.equal(storage.value(CUSTODIAL_REMOVAL_OPERATION_KEY), undefined);
}

// The backend's exact pre-confirmation 409 is bounded: a valid local journal
// confirms and retries once, while a missing journal enters manager recovery
// without polling or replaying ordinary traffic.
{
  const response = { ok: true, source: 'single-retry' };
  const calls = [];
  const resumed = await reconcileEnrollmentConfirmationRequired({
    status: 409,
    payload: { code: ENROLLMENT_CONFIRMATION_REQUIRED_CODE },
    pendingOperation: { status: 'local_committed_pending_server_confirmation' },
    confirm: async () => { calls.push('confirm'); },
    retry: async () => { calls.push('retry'); return response; },
    requireManagerRecovery: async () => { calls.push('recovery'); },
  });
  assert.equal(resumed.handled, true);
  assert.equal(resumed.response, response);
  assert.deepEqual(calls, ['confirm', 'retry']);

  const missingCalls = [];
  await assert.rejects(
    () => reconcileEnrollmentConfirmationRequired({
      status: 409,
      payload: { code: ENROLLMENT_CONFIRMATION_REQUIRED_CODE },
      pendingOperation: null,
      confirm: async () => { missingCalls.push('confirm'); },
      retry: async () => { missingCalls.push('retry'); },
      requireManagerRecovery: async (reason) => { missingCalls.push(`recovery:${reason}`); },
    }),
    (error) => error.code === ENROLLMENT_CONFIRMATION_REQUIRED_CODE,
  );
  assert.deepEqual(missingCalls, [`recovery:${ENROLLMENT_CONFIRMATION_REQUIRED_CODE}`]);

  const boundedCalls = [];
  await assert.rejects(
    () => reconcileEnrollmentConfirmationRequired({
      status: 409,
      payload: { code: ENROLLMENT_CONFIRMATION_REQUIRED_CODE },
      pendingOperation: { status: 'local_committed_pending_server_confirmation' },
      confirmationRetry: true,
      confirm: async () => { boundedCalls.push('confirm'); },
      retry: async () => { boundedCalls.push('retry'); },
      requireManagerRecovery: async () => { boundedCalls.push('recovery'); },
    }),
    (error) => error.code === ENROLLMENT_CONFIRMATION_REQUIRED_CODE,
  );
  assert.deepEqual(boundedCalls, ['recovery']);
}

console.log('MOBILE_EDITION_CONTRACT_PASS');
