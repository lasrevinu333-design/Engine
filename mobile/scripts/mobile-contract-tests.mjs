import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = async (path) => readFile(new URL(path, root), 'utf8');
const [
  config, packageJson, buildScript, chatBuildScript, managerHtml, managerJs, bridge,
  moxieHtml, moxieJs, accessHtml, accessJs, viewerHtml, viewerJs,
  chatHtml, chatJsx, chatTheme,
] = await Promise.all([
  files('capacitor.config.ts'), files('package.json'), files('scripts/build.mjs'), files('scripts/build-chatscope.mjs'),
  files('src/manager/index.html'), files('src/manager/app.js'), files('src/shared/mobile-bridge.js'),
  files('src/manager/moxie.html'), files('src/manager/moxie.js'), files('src/manager/manager-access.html'), files('src/manager/manager-access.js'),
  files('src/viewer/index.html'), files('src/viewer/app.js'), files('../messages-chatscope.html'), files('src/chatscope/app.jsx'), files('src/chatscope/theme.css'),
]);
assert.match(config, /org\.memphiszoo\.ops/);
assert.match(config, /org\.memphiszoo\.viewer/);
assert.match(config, /capacitor/);
assert.match(buildScript, /build-chatscope\.mjs/);
assert.match(buildScript, /memphis-mobile-bridge\.js/);
assert.match(buildScript, /manager-access-mobile\.js/);
for (const module of ['Dashboard','Messenger','ChatScope Messenger','Scheduler','Events','Guest Issues','Moxie','Feedback','Gemini Console','Manager Access','Device Security']) assert.ok(managerHtml.includes(module), `manager app missing ${module}`);
assert.match(managerJs, /mobile-auth-api\/enroll/);
assert.match(managerJs, /SecureStorage/);
assert.match(managerJs, /roles\.includes\('CUSTODIAL_MANAGER'\)/);
assert.match(managerJs, /Annie Feist/);
assert.match(managerHtml, /id="manager-access-tile"/);
assert.match(managerHtml, /id="device-security-tile"/);
assert.match(bridge, /Authorization: `Bearer/);
assert.match(moxieHtml, /Private work assistant/);
assert.match(moxieJs, /moxie-mobile-api/);
assert.match(accessHtml, /single-use personal code/i);
assert.match(accessJs, /leadership-api\/managers\/.*enrollment-code/);
assert.doesNotMatch(accessJs, /auth-api\/ops\/managers/);
assert.doesNotMatch(viewerHtml, /Messenger|Moxie|Scheduler|Device Security|Manager Access/);
for (const module of ['Dashboard','Events','Feedback']) assert.ok(viewerHtml.includes(module), `viewer app missing ${module}`);
assert.match(viewerJs, /viewer-api\/dashboard/);
assert.match(viewerJs, /viewer-api\/events/);
assert.match(viewerJs, /feedback-api\/submit/);
assert.match(viewerJs, /device_id:\s*''/);

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
