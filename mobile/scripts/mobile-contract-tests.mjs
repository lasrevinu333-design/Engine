import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = async (path) => readFile(new URL(path, root), 'utf8');
const [config, buildScript, managerHtml, managerJs, bridge, moxieHtml, moxieJs, accessHtml, accessJs, viewerHtml, viewerJs] = await Promise.all([
  files('capacitor.config.ts'), files('scripts/build.mjs'), files('src/manager/index.html'), files('src/manager/app.js'),
  files('src/shared/mobile-bridge.js'), files('src/manager/moxie.html'), files('src/manager/moxie.js'),
  files('src/manager/manager-access.html'), files('src/manager/manager-access.js'), files('src/viewer/index.html'), files('src/viewer/app.js'),
]);
assert.match(config, /org\.memphiszoo\.ops/);
assert.match(config, /org\.memphiszoo\.viewer/);
assert.match(config, /capacitor/);
assert.match(buildScript, /memphis-mobile-bridge\.js/);
assert.match(buildScript, /manager-access-mobile\.js/);
for (const module of ['Dashboard','Messenger','Scheduler','Events','Guest Issues','Moxie','Feedback','Manager Access','Device Security']) assert.ok(managerHtml.includes(module), `manager app missing ${module}`);
assert.match(managerJs, /mobile-auth-api\/enroll/);
assert.match(managerJs, /SecureStorage/);
assert.match(bridge, /Authorization: `Bearer/);
assert.match(moxieHtml, /Private work assistant/);
assert.match(moxieJs, /moxie-mobile-api/);
assert.match(accessHtml, /single-use personal code/i);
assert.match(accessJs, /enrollment-codes/);
assert.doesNotMatch(viewerHtml, /Messenger|Moxie|Scheduler|Device Security|Manager Access/);
for (const module of ['Dashboard','Events','Feedback']) assert.ok(viewerHtml.includes(module), `viewer app missing ${module}`);
assert.match(viewerJs, /viewer-api\/dashboard/);
assert.match(viewerJs, /viewer-api\/events/);
assert.match(viewerJs, /feedback-api\/submit/);
console.log('MOBILE_EDITION_CONTRACT_PASS');
