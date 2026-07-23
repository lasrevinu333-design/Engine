import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  configureIosProjectSource,
  injectAndroidOverlay,
  resolveBuildNumber,
  resolveReleaseVersion,
  validateSwiftLock,
} from '../mobile/scripts/configure-native-release.mjs';

const [
  configScript,
  brandingScript,
  nativeReleaseScript,
  androidReleaseOverlay,
  workflow,
  codemagic,
  capacitorConfig,
  mobilePackage,
  managerLockBytes,
  custodialLockBytes,
  viewerLockBytes,
  androidFirebaseDigest,
  iosFirebaseDigest,
] = await Promise.all([
  readFile(new URL('../mobile/scripts/configure-firebase.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-branding.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-native-release.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/codemagic-release.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/android-test-apks.yml', import.meta.url), 'utf8'),
  readFile(new URL('../codemagic.yaml', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/package.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/manager/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/custodial/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/viewer/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/manager-android.sha256', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/manager-ios.sha256', import.meta.url), 'utf8'),
]);
assert.match(configScript, /manager-notifications-api\/client-config/);
assert.match(configScript, /edition !== 'manager'/);
assert.doesNotMatch(configScript, /FIREBASE_SERVICE_ACCOUNT_JSON|private_key|client_email/);
assert.match(configScript, /MZ_REQUIRE_PINNED_FIREBASE_CONFIG/);
assert.match(configScript, /createHash\('sha256'\)/);
assert.match(configScript, /manager-firebase-\$\{platform\}\.json/);
assert.match(configScript, /client configuration digest mismatch/);
assert.match(androidFirebaseDigest.trim(), /^[a-f0-9]{64}\s+google-services\.json$/);
assert.match(iosFirebaseDigest.trim(), /^[a-f0-9]{64}\s+GoogleService-Info\.plist$/);
for (const text of ['manager','custodial','viewer','org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer','assembleDebug']) assert.ok(workflow.includes(text), `Android APK workflow missing ${text}`);
assert.match(
  workflow,
  /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\s+#\s+v4/,
  'Android APK workflow must use the verified upload-artifact v4 commit',
);
for (const artifact of ['memphis-zoo-ops-debug','memphis-zoo-custodial-debug','memphis-zoo-viewer-debug']) assert.match(workflow, new RegExp(artifact));
assert.match(workflow, /configure-branding\.mjs/);
assert.match(workflow, /configure-native-release\.mjs android/);
assert.match(workflow, /assembleRelease bundleRelease/);
assert.match(workflow, /apksigner.*verify --verbose --print-certs/s);
assert.match(workflow, /jarsigner -verify/);
assert.match(workflow, /test-signed-release-path\.json/);
assert.match(workflow, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(workflow, /retention-days: 30/);
assert.doesNotMatch(workflow, /FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_SERVICES_JSON_B64|private_key/);
assert.match(brandingScript, /ic_launcher_foreground/);
assert.match(brandingScript, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(codemagic, /MZ_API_BASE: https:\/\/memphis-zoo-mcp\.onrender\.com/);
assert.doesNotMatch(codemagic, /firebase_credentials/);
assert.match(codemagic, /firebase_client_config/);
assert.match(codemagic, /MZ_REQUIRE_PINNED_FIREBASE_CONFIG: '1'/);
assert.match(codemagic, /cap add ios --packagemanager SPM/);
assert.doesNotMatch(codemagic, /App\.xcworkspace/, 'Capacitor 8 SPM builds must use the generated Xcode project');
assert.doesNotMatch(codemagic, /\bgem install\b|require ['"]xcodeproj['"]/, 'native release configuration must not install unpinned Ruby tooling');
assert.equal(
  [...codemagic.matchAll(/xcode-project build-ipa \\\n\s+--project "\$CM_BUILD_DIR\/mobile\/ios\/App\/App\.xcodeproj"/g)].length,
  3,
  'all three iOS editions must archive the generated SPM Xcode project',
);
assert.match(codemagic, /-disableAutomaticPackageResolution/);
assert.match(codemagic, /-onlyUsePackageVersionsFromResolvedFile/);
assert.match(codemagic, /cmp "\$lock" "\$resolved"/);
assert.match(codemagic, /PROJECT_BUILD_NUMBER/);
assert.doesNotMatch(codemagic, /CM_BUILD_NUMBER/, 'Codemagic exports PROJECT_BUILD_NUMBER and BUILD_NUMBER, not CM_BUILD_NUMBER');
assert.equal(
  [...codemagic.matchAll(/MZ_RELEASE_VERSION: 1\.0\.0/g)].length,
  6,
  'every native release workflow must declare the same user-facing version',
);
for (const verification of ['apksigner','jarsigner','codesign --verify']) {
  assert.ok(codemagic.includes(verification), `signed artifact verification missing ${verification}`);
}
assert.match(codemagic, /configure-native-release\.mjs android/);
assert.match(codemagic, /configure-native-release\.mjs ios/);
for (const variable of ['CM_KEYSTORE_PATH','CM_KEYSTORE_PASSWORD','CM_KEY_ALIAS','CM_KEY_PASSWORD']) {
  assert.ok(androidReleaseOverlay.includes(variable), `Android release overlay missing ${variable}`);
}
assert.match(androidReleaseOverlay, /versionCode buildNumber\.intValue\(\)/);
assert.match(androidReleaseOverlay, /versionName releaseVersion/);
assert.match(androidReleaseOverlay, /signingConfig signingConfigs\.release/);
assert.match(nativeReleaseScript, /signing_keystore_sha256/);
assert.match(nativeReleaseScript, /swift_package_lock_sha256/);
assert.match(nativeReleaseScript, /VERSIONING_SYSTEM = apple-generic/);
for (const id of ['org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer']) assert.match(capacitorConfig, new RegExp(id.replaceAll('.', '\\.')));
assert.match(mobilePackage, /build:custodial/);
assert.match(mobilePackage, /"@capacitor\/android": "8\.4\.2"/);

for (const [edition, bytes] of [
  ['manager', managerLockBytes],
  ['custodial', custodialLockBytes],
  ['viewer', viewerLockBytes],
]) {
  validateSwiftLock(JSON.parse(bytes), edition);
}
assert.deepEqual(resolveBuildNumber({ PROJECT_BUILD_NUMBER: '420' }), {
  value: '420',
  numeric: 420,
  source: 'PROJECT_BUILD_NUMBER',
});
assert.throws(() => resolveBuildNumber({ PROJECT_BUILD_NUMBER: '0' }), /positive integer/);
assert.throws(() => resolveBuildNumber({ PROJECT_BUILD_NUMBER: '2100000001' }), /no greater than/);
assert.equal(resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0.0' }), '1.0.0');
assert.throws(() => resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0' }), /three numeric components/);

const syntheticGradle = 'android { buildTypes { release { minifyEnabled false } } }\n';
const configuredGradle = injectAndroidOverlay(syntheticGradle);
assert.match(configuredGradle, /codemagic-release\.gradle/);
assert.equal(injectAndroidOverlay(configuredGradle), configuredGradle, 'Android overlay injection must be idempotent');

const syntheticProject = `/* Begin PBXBuildFile section */
/* End PBXBuildFile section */
/* Begin PBXFileReference section */
/* End PBXFileReference section */
\t\t504EC3061FED79650016851F /* App */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t);
\t\t};
\t\t504EC3021FED79650016851F /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t};
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = org.memphiszoo.ops;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = org.memphiszoo.ops;
`;
const configuredProject = configureIosProjectSource(syntheticProject, {
  appIdentifier: 'org.memphiszoo.ops',
  buildNumber: '420',
  releaseVersion: '1.0.0',
  includeFirebase: true,
});
assert.equal(
  configureIosProjectSource(configuredProject, {
    appIdentifier: 'org.memphiszoo.ops',
    buildNumber: '420',
    releaseVersion: '1.0.0',
    includeFirebase: true,
  }),
  configuredProject,
  'iOS release configuration must be idempotent',
);
assert.equal((configuredProject.match(/CURRENT_PROJECT_VERSION = 420;/g) || []).length, 2);
assert.equal((configuredProject.match(/VERSIONING_SYSTEM = apple-generic;/g) || []).length, 2);
assert.equal((configuredProject.match(/GoogleService-Info\.plist in Resources/g) || []).length, 2);
console.log('NATIVE_MOBILE_BUILD_CONTRACT_PASS');
