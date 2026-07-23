import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const [configScript, brandingScript, workflow, codemagic, capacitorConfig, mobilePackage] = await Promise.all([
  readFile(new URL('../mobile/scripts/configure-firebase.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-branding.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/android-test-apks.yml', import.meta.url), 'utf8'),
  readFile(new URL('../codemagic.yaml', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/package.json', import.meta.url), 'utf8'),
]);
assert.match(configScript, /manager-notifications-api\/client-config/);
assert.match(configScript, /edition !== 'manager'/);
assert.doesNotMatch(configScript, /FIREBASE_SERVICE_ACCOUNT_JSON|private_key|client_email/);
for (const text of ['manager','custodial','viewer','org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer','assembleDebug']) assert.ok(workflow.includes(text), `Android APK workflow missing ${text}`);
assert.match(
  workflow,
  /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\s+#\s+v4/,
  'Android APK workflow must use the verified upload-artifact v4 commit',
);
for (const artifact of ['memphis-zoo-ops-debug','memphis-zoo-custodial-debug','memphis-zoo-viewer-debug']) assert.match(workflow, new RegExp(artifact));
assert.match(workflow, /configure-branding\.mjs/);
assert.match(workflow, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(workflow, /retention-days: 30/);
assert.doesNotMatch(workflow, /FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_SERVICES_JSON_B64|private_key/);
assert.match(brandingScript, /ic_launcher_foreground/);
assert.match(brandingScript, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(codemagic, /MZ_API_BASE: https:\/\/memphis-zoo-mcp\.onrender\.com/);
assert.doesNotMatch(codemagic, /firebase_credentials/);
for (const id of ['org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer']) assert.match(capacitorConfig, new RegExp(id.replaceAll('.', '\\.')));
assert.match(mobilePackage, /build:custodial/);
assert.match(mobilePackage, /"@capacitor\/android": "8\.4\.2"/);
console.log('NATIVE_MOBILE_BUILD_CONTRACT_PASS');
