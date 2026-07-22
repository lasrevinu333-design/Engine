import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [configScript, workflow, codemagic, capacitorConfig, mobilePackage] = await Promise.all([
  readFile(new URL('../mobile/scripts/configure-firebase.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/android-test-apks.yml', import.meta.url), 'utf8'),
  readFile(new URL('../codemagic.yaml', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/package.json', import.meta.url), 'utf8'),
]);

assert.match(configScript, /manager-notifications-api\/client-config\/\$\{encodeURIComponent\(targetPlatform\)\}/);
assert.match(configScript, /MZ_API_BASE/);
assert.match(configScript, /google-services\.json/);
assert.match(configScript, /GoogleService-Info\.plist/);
assert.match(configScript, /org\.memphiszoo\.ops/);
assert.doesNotMatch(configScript, /FIREBASE_SERVICE_ACCOUNT_JSON|private_key|client_email/);
assert.match(configScript, /edition !== 'manager'/);

for (const text of ['manager', 'viewer', 'org.memphiszoo.ops', 'org.memphiszoo.viewer', 'assembleDebug', 'upload-artifact@v4']) {
  assert.ok(workflow.includes(text), `Android APK workflow missing ${text}`);
}
assert.match(workflow, /memphis-zoo-ops-debug/);
assert.match(workflow, /memphis-zoo-viewer-debug/);
assert.match(workflow, /retention-days: 30/);
assert.match(workflow, /unzip -t/);
assert.match(workflow, /configure-firebase\.mjs android/);
assert.doesNotMatch(workflow, /FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_SERVICES_JSON_B64|private_key/);

assert.match(codemagic, /MZ_API_BASE: https:\/\/memphis-zoo-mcp\.onrender\.com/);
assert.doesNotMatch(codemagic, /firebase_credentials/);
assert.match(capacitorConfig, /org\.memphiszoo\.ops/);
assert.match(capacitorConfig, /org\.memphiszoo\.viewer/);
assert.match(capacitorConfig, /@capacitor-firebase\/messaging/);
assert.match(mobilePackage, /"@capacitor\/android": "8\.4\.2"/);

console.log('NATIVE_MOBILE_BUILD_CONTRACT_PASS');
