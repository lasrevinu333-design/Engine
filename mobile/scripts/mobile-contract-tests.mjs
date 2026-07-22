import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = async (path) => readFile(new URL(path, root), 'utf8');
const [
  config, packageJson, buildScript, chatBuildScript, managerHtml, managerJs, bridge,
  moxieHtml, moxieJs, accessHtml, accessJs, viewerHtml, viewerJs,
  chatHtml, chatJsx, chatTheme, notificationHtml, notificationJs, notificationClient, firebaseConfig, codemagic,
] = await Promise.all([
  files('capacitor.config.ts'), files('package.json'), files('scripts/build.mjs'), files('scripts/build-chatscope.mjs'),
  files('src/manager/index.html'), files('src/manager/app.js'), files('src/shared/mobile-bridge.js'),
  files('src/manager/moxie.html'), files('src/manager/moxie.js'), files('src/manager/manager-access.html'), files('src/manager/manager-access.js'),
  files('src/viewer/index.html'), files('src/viewer/app.js'), files('../messages-chatscope.html'), files('src/chatscope/app.jsx'), files('src/chatscope/theme.css'),
  files('src/manager/notifications.html'), files('src/manager/notifications.js'), files('src/manager/notifications-client.js'), files('scripts/configure-firebase.mjs'), files('../codemagic.yaml'),
]);
assert.match(config, /org\.memphiszoo\.ops/);
assert.match(config, /org\.memphiszoo\.viewer/);
assert.match(config, /capacitor/);
assert.match(config, /includePlugins:\s*viewer\s*\?\s*viewerPlugins\s*:\s*managerPlugins/);
assert.match(config, /'@capacitor-firebase\/messaging'/);
assert.match(config, /const viewerPlugins = \['@capacitor\/network', '@capacitor\/status-bar'\]/);
assert.match(config, /packageOptions/);
assert.match(config, /symlink:\s*true/);
assert.match(buildScript, /build-chatscope\.mjs/);
assert.match(buildScript, /memphis-mobile-bridge\.js/);
assert.match(buildScript, /manager-access-mobile\.js/);
for (const module of ['Dashboard','Messenger','ChatScope Messenger','Scheduler','Events','Guest Issues','Moxie','Feedback','Notifications','Gemini Console','Manager Access','Device Security']) assert.ok(managerHtml.includes(module), `manager app missing ${module}`);
assert.match(managerJs, /mobile-auth-api\/enroll/);
assert.match(managerJs, /SecureStorage/);
assert.match(managerJs, /roles\.includes\('CUSTODIAL_MANAGER'\)/);
assert.match(managerJs, /Annie Feist/);
assert.match(managerJs, /ensurePushRegistration/);
assert.match(managerHtml, /id="manager-access-tile"/);
assert.match(managerHtml, /id="device-security-tile"/);
assert.match(bridge, /Authorization: `Bearer/);
assert.match(moxieHtml, /Private work assistant/);
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
assert.match(notificationHtml, /Message alerts/);
assert.match(notificationHtml, /Daily event digest/);
assert.match(notificationHtml, /Due-soon locations/);
assert.match(notificationHtml, /Overdue locations/);
assert.match(notificationJs, /event_reminder_weekdays/);
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

assert.match(packageJson, /@chatscope\/chat-ui-kit-react/);
assert.match(packageJson, /"react": "18\.3\.1"/);
assert.match(chatBuildScript, /bundle: true/);
assert.match(chatBuildScript, /format: 'iife'/);
assert.match(chatHtml, /chatscope-messenger\.js/);
assert.doesNotMatch(chatHtml, /unpkg|jsdelivr|esm\.sh|cdn/i, 'ChatScope must be bundled locally');
assert.match(chatJsx, /@chatscope\/chat-ui-kit-react/);
assert.match(chatJsx, /\/messaging-api/);
assert.match(chatJsx, /\/me\/by-device/);
assert.match(chatJsx, /\/threads\/updates/);
assert.match(chatJsx, /\/thread\/\$\{encodeURIComponent\(selectedId\)\}\/updates/);
assert.match(chatJsx, /\/memphis\/message/);
assert.match(chatJsx, /\/thread\/direct/);
assert.match(chatJsx, /\/thread\/group/);
assert.match(chatJsx, /mz_chatscope_outbox/);
assert.match(chatTheme, /--mz-green/);
assert.match(chatTheme, /cs-message--outgoing/);
console.log('MOBILE_EDITION_CONTRACT_PASS');
