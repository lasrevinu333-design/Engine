import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = async (path) => readFile(new URL(path, root), 'utf8');

const [
  config, packageJson, buildScript, managerHtml, managerJs, bridge, interaction,
  moxieHtml, moxieJs, accessHtml, accessJs, viewerHtml, viewerJs,
  messengerHtml, messengerJs, retiredChatScope, notificationHtml, notificationJs,
  notificationClient, firebaseConfig, codemagic, feedbackHtml,
] = await Promise.all([
  files('capacitor.config.ts'),
  files('package.json'),
  files('scripts/build.mjs'),
  files('src/manager/index.html'),
  files('src/manager/app.js'),
  files('src/shared/mobile-bridge.js'),
  files('src/shared/interaction-feedback.js'),
  files('src/manager/moxie.html'),
  files('src/manager/moxie.js'),
  files('src/manager/manager-access.html'),
  files('src/manager/manager-access.js'),
  files('src/viewer/index.html'),
  files('src/viewer/app.js'),
  files('../messages.html'),
  files('../messages-app.js'),
  files('../messages-chatscope.html'),
  files('src/manager/notifications.html'),
  files('src/manager/notifications.js'),
  files('src/manager/notifications-client.js'),
  files('scripts/configure-firebase.mjs'),
  files('../codemagic.yaml'),
  files('../system-feedback.html'),
]);

assert.match(config, /org\.memphiszoo\.ops/);
assert.match(config, /org\.memphiszoo\.viewer/);
assert.match(config, /capacitor/);
assert.match(config, /includePlugins:\s*viewer\s*\?\s*viewerPlugins\s*:\s*managerPlugins/);
assert.match(config, /'@capacitor-firebase\/messaging'/);
assert.match(buildScript, /memphis-mobile-bridge\.js/);
assert.match(buildScript, /memphis-interaction-feedback\.js/);
assert.doesNotMatch(buildScript, /build-chatscope\.mjs/);

for (const module of ['Dashboard','Messenger','Schedule','Events','Guest Issues','Moxie','Feedback','Notifications','Gemini Console','Manager Access','Device Security']) {
  assert.ok(managerHtml.includes(module), `manager app missing ${module}`);
}
assert.doesNotMatch(managerHtml, /ChatScope Messenger/);
assert.match(managerHtml, /What needs attention, communication, or a decision/);
assert.match(managerHtml, /id="manager-access-tile"/);
assert.match(managerHtml, /id="device-security-tile"/);
assert.match(managerHtml, /id="boot"/);
assert.match(managerHtml, /id="enrollment" class="card" hidden/);
assert.match(managerHtml, /class="appNav"/);

assert.match(managerJs, /mobile-auth-api\/enroll/);
assert.match(managerJs, /SecureStorage/);
assert.match(managerJs, /roles\.includes\('CUSTODIAL_MANAGER'\)/);
assert.match(managerJs, /Annie Feist/);
assert.match(managerJs, /ensurePushRegistration/);
assert.match(managerJs, /readCachedSession/);
assert.match(managerJs, /mz_native_manager_profile/);
assert.match(managerJs, /Existing phone access was kept/);
assert.match(managerJs, /error\?\.status === 401 \|\| error\?\.status === 403/);
assert.doesNotMatch(managerJs, /catch \(error\) \{\s*await secureRemove\(\)/, 'transient refresh errors must not erase native enrollment');

assert.match(bridge, /Authorization: `Bearer/);
assert.match(bridge, /SecureStorage\.get\(SECURE_CREDENTIAL_KEY\)/);
assert.match(bridge, /mz_native_device_credential_runtime/);
assert.match(bridge, /refresh\(\{ force: true \}\)/);
assert.match(bridge, /AUTHENTICATED_API_PREFIXES/);
assert.match(bridge, /window\.fetch = \(input, init\) => bridgeFetch/);
assert.match(bridge, /requestEnvelope/);
assert.match(bridge, /isAbort\(error\)/);
assert.match(bridge, /auth\.deviceSecuritySession = deviceSecuritySession/);
assert.match(bridge, /auth\.unlockDeviceSecurity = unlockDeviceSecurity/);
assert.match(bridge, /auth\.listOpsManagerTrustedDevices = listOpsManagerTrustedDevices/);
assert.match(bridge, /credentials: 'omit'/);
assert.doesNotMatch(bridge, /mobile-auth-api\/logout/, 'module session recovery must not silently unenroll the phone');

assert.match(interaction, /navigator\.vibrate/);
assert.match(interaction, /memphis:feedback/);
assert.match(interaction, /mz_haptics_enabled/);

assert.match(messengerHtml, /Memphis AI and team conversations/);
assert.match(messengerHtml, /messages-app\.js/);
assert.match(messengerHtml, /messenger-app\.css/);
assert.match(messengerJs, /SYSTEM_THREAD_KEY = 'ops_manager_shared_chat_v1'/);
assert.match(messengerJs, /\.filter\(\(thread\) => thread\.id && !isRetiredSystemThread\(thread\)\)/);
assert.match(messengerJs, /\/messaging-api/);
assert.match(messengerJs, /\/memphis\/message/);
assert.match(messengerJs, /\/thread\/direct/);
assert.match(messengerJs, /\/thread\/group/);
assert.match(messengerJs, /Saved on this phone/);
assert.match(retiredChatScope, /messages\.html/);
assert.doesNotMatch(retiredChatScope, /chatscope-messenger\.js/);

assert.match(moxieHtml, /Private workspace/);
assert.match(moxieHtml, /New Chat/);
assert.match(moxieHtml, /Clear Chat/);
for (const tab of ['Chat','Notes','Reminders','Contacts']) assert.match(moxieHtml, new RegExp(`>${tab}<`));
assert.match(moxieJs, /savedChats/);
assert.match(moxieJs, /startNewChat/);
assert.match(moxieJs, /clearChat/);
assert.match(moxieJs, /moxie-mobile-api/);

assert.match(accessHtml, /single-use personal code/i);
assert.match(accessJs, /leadership-api\/managers\/.*enrollment-code/);
assert.doesNotMatch(accessJs, /auth-api\/ops\/managers/);

assert.doesNotMatch(viewerHtml, /Messenger|Moxie|Scheduler|Device Security|Manager Access|Notifications/);
for (const module of ['Dashboard','Events','Feedback']) assert.ok(viewerHtml.includes(module), `viewer app missing ${module}`);
assert.match(viewerJs, /viewer-api\/dashboard/);
assert.match(viewerJs, /viewer-api\/events/);
assert.match(viewerJs, /feedback-api\/submit/);
assert.match(viewerJs, /device_id:\s*''/);

assert.match(packageJson, /@capacitor-firebase\/messaging/);
assert.match(packageJson, /"firebase": "12\.16\.0"/);
assert.match(config, /FirebaseMessaging/);
assert.match(notificationHtml, /Send a Test Notification/);
assert.match(notificationHtml, /Message alerts/);
assert.match(notificationHtml, /Daily event digest/);
assert.match(notificationHtml, /Due-soon locations/);
assert.match(notificationHtml, /Overdue locations/);
assert.match(notificationJs, /event_reminder_weekdays/);
assert.match(notificationJs, /memphis:notification-received/);
assert.match(notificationClient, /notificationReceived/);
assert.match(notificationClient, /notificationActionPerformed/);
assert.match(notificationClient, /manager-notifications-api\/register/);
assert.match(notificationJs, /requestPermission: true/);
assert.match(firebaseConfig, /google-services\.json/);
assert.match(firebaseConfig, /GoogleService-Info\.plist/);
assert.match(firebaseConfig, /manager-notifications-api\/client-config/);
assert.match(firebaseConfig, /MZ_API_BASE/);
assert.doesNotMatch(firebaseConfig, /FIREBASE_SERVICE_ACCOUNT_JSON|private_key|client_email/);
assert.match(codemagic, /MZ_API_BASE: https:\/\/memphis-zoo-mcp\.onrender\.com/);
assert.doesNotMatch(codemagic, /firebase_credentials/);

assert.doesNotMatch(feedbackHtml, /context-pill|Resolving context|device id/i);
assert.match(feedbackHtml, /Technical details are recorded automatically/);
assert.match(feedbackHtml, /This is blocking work/);
assert.match(feedbackHtml, /device_id: state\.deviceId/);

console.log('MOBILE_EDITION_CONTRACT_PASS');
