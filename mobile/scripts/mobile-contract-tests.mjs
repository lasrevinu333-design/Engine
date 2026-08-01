import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = async (path) => readFile(new URL(path, root), 'utf8');
const [
  config, packageJson, buildScript, managerHtml, managerJs, managerBridge, nativeLayout, interaction,
  moxieHtml, moxieJs, accessHtml, accessJs, viewerHtml, viewerJs,
  messengerHtml, messengerApp, retiredChatScope, notificationHtml, notificationJs,
  notificationClient, firebaseConfig, brandingConfig, nativeLinks, codemagic, feedbackHtml, phoneAssignmentsHtml, phoneAssignmentsJs,
  insightsHtml, insightsJs, insightsNativeAuth, custodialHtml, custodialJs, custodialBridge,
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
]);

for (const id of ['org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer']) assert.match(config, new RegExp(id.replaceAll('.', '\\.')));
assert.match(config, /custodialPlugins/);
assert.match(config, /@capacitor-firebase\/messaging/);
assert.match(config, /@capacitor\/barcode-scanner/);
assert.match(config, /@capacitor\/local-notifications/);
assert.match(packageJson, /build:custodial/);
assert.match(packageJson, /cap:sync:custodial/);
assert.match(buildScript, /scan\.html/);
assert.match(buildScript, /memphis-custodial-bridge\.js/);
assert.match(buildScript, /memphis-native-layout\.js/);
assert.match(buildScript, /edition === 'custodial'/);

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
assert.match(nativeLinks, /memphiszoo\.custodial\.NFC_SCAN/);
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
assert.match(custodialHtml, /Scan Location QR/);
assert.match(custodialHtml, /NFC is always ready/);
assert.match(custodialHtml, /memphis-custodial-bridge\.js/);
assert.doesNotMatch(custodialHtml, />Scanner</);
assert.match(custodialJs, /custodial-device-auth\/enroll/);
assert.match(custodialJs, /ensurePhoneNotifications/);
assert.match(custodialJs, /register\(\{ requestPermission: true \}\)/);
assert.match(custodialJs, /showHome\(\); await loadAreas\(\); await ensurePhoneNotifications\(\)/);
assert.match(custodialJs, /Phone enrolled and notifications ready/);
assert.match(custodialJs, /appUrlOpen/);
assert.match(custodialJs, /scan\.html/);
assert.match(custodialJs, /CapacitorBarcodeScanner\.scanBarcode/);
assert.match(custodialJs, /CapacitorBarcodeScannerTypeHint\.QR_CODE/);
assert.match(custodialJs, /CapacitorBarcodeScannerAndroidScanningLibrary\.ZXING/);
assert.match(custodialJs, /That QR code is not a Memphis Zoo location code/);
assert.match(custodialJs, /incoming\.hostname === 'lasrevinu333-design\.github\.io'/);
assert.match(custodialJs, /if \(!customScan && !webScan\) return null/);
assert.match(custodialBridge, /X-Memphis-App-Edition/);
assert.match(custodialBridge, /X-Device-Credential/);
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

console.log('MOBILE_EDITION_CONTRACT_PASS');
