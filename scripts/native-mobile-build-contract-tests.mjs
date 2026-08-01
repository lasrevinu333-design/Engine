import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CUSTODIAL_ANDROID_RELEASE_POLICY as CONFIGURE_CUSTODIAL_ANDROID_RELEASE_POLICY,
  assertEditionBuildFloor,
  configureGradleWrapperSource,
  configureAndroidVariablesSource,
  configureIosProjectSource,
  injectAndroidOverlay,
  inspectGradleVerificationMetadata,
  resolveBuildNumber,
  resolveReleaseVersion,
  validateGradleVerificationMetadata,
  validateGradleWrapperJar,
  validateSwiftLock,
} from '../mobile/scripts/configure-native-release.mjs';
import {
  configureAndroidManifestSource,
  configureIosInfoPlistSource,
} from '../mobile/scripts/configure-native-links.mjs';
import {
  androidBackupDomains,
  assertAndroidBackupManifestSecurity,
  assertAndroidBackupRulesSecurity,
  configureAndroidBackupManifestSource,
  dataExtractionRules,
  legacyBackupRules,
} from '../mobile/scripts/configure-android-backup.mjs';
import { assertCompiledAndroidBackupSecurity } from '../mobile/scripts/verify-android-apk-backup.mjs';
import {
  CUSTODIAL_ACCEPTANCE_SCHEMA_ID,
  CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION,
  CUSTODIAL_ANDROID_RELEASE_POLICY,
  CUSTODIAL_ANDROID_TOOLCHAIN_POLICY,
  CUSTODIAL_CODEMAGIC_WORKFLOW,
  CUSTODIAL_NODE_VERSION,
  CUSTODIAL_PACKAGE_NAME,
  CUSTODIAL_RELEASE_BACKUP_DOMAINS,
  CUSTODIAL_SIGNER_SHA256,
  CUSTODIAL_TARGET_SDK_VERSION,
  assertCustodialReleaseManifest,
  assertEmbeddedCustodialProvenance,
  assertEmbeddedRuntimeAssets,
  assertZipalignVerification,
  createCustodialAndroidReleaseAcceptance,
  normalizeCustodialSourceRef,
  parseEmbeddedBuildIdentity,
} from '../mobile/scripts/verify-custodial-android-release.mjs';

const [
  configScript,
  brandingScript,
  nativeLinksScript,
  androidBackupScript,
  apkBackupVerifier,
  custodialReleaseVerifier,
  custodialAcceptanceSchema,
  nativeReleaseScript,
  androidVersionOverlay,
  androidReleaseOverlay,
  custodialReleasePolicy,
  custodialToolchainPolicy,
  workflow,
  codemagic,
  capacitorConfig,
  mobilePackage,
  managerLockBytes,
  custodialLockBytes,
  viewerLockBytes,
  managerAndroidFirebaseDigest,
  managerIosFirebaseDigest,
  custodialAndroidFirebaseDigest,
  managerAndroidVerificationBytes,
  custodialAndroidVerificationBytes,
  viewerAndroidVerificationBytes,
] = await Promise.all([
  readFile(new URL('../mobile/scripts/configure-firebase.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-branding.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-native-links.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-android-backup.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/verify-android-apk-backup.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/verify-custodial-android-release.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/custodial-android-release-acceptance.schema.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-native-release.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/native-version.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/codemagic-release.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-android.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/release-policies/custodial-android-build-tools-35.0.1-macos.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/android-test-apks.yml', import.meta.url), 'utf8'),
  readFile(new URL('../codemagic.yaml', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/package.json', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/manager/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/custodial/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/ios/viewer/Package.resolved', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/manager-android.sha256', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/manager-ios.sha256', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/firebase/custodial-android.sha256', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/native-locks/android/manager/verification-metadata.xml', import.meta.url)),
  readFile(new URL('../mobile/native-locks/android/custodial/verification-metadata.xml', import.meta.url)),
  readFile(new URL('../mobile/native-locks/android/viewer/verification-metadata.xml', import.meta.url)),
]);
assert.match(configScript, /manager-notifications-api\/client-config/);
assert.match(configScript, /manager: 'org\.memphiszoo\.ops'/);
assert.match(configScript, /custodial: 'org\.memphiszoo\.custodial'/);
assert.match(configScript, /if \(!appIdentifier\)/);
assert.doesNotMatch(configScript, /FIREBASE_SERVICE_ACCOUNT_JSON|private_key|client_email/);
assert.match(configScript, /MZ_REQUIRE_PINNED_FIREBASE_CONFIG/);
assert.match(configScript, /createHash\('sha256'\)/);
assert.match(configScript, /\$\{edition\}-firebase-\$\{platform\}\.json/);
assert.match(configScript, /client configuration digest mismatch/);
assert.match(managerAndroidFirebaseDigest.trim(), /^[a-f0-9]{64}\s+google-services\.json$/);
assert.match(managerIosFirebaseDigest.trim(), /^[a-f0-9]{64}\s+GoogleService-Info\.plist$/);
assert.match(custodialAndroidFirebaseDigest.trim(), /^[a-f0-9]{64}\s+google-services\.json$/);
for (const text of ['manager','custodial','viewer','org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer','assembleDebug']) assert.ok(workflow.includes(text), `Android APK workflow missing ${text}`);
assert.match(
  workflow,
  /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a\s+#\s+v7\.0\.1/,
  'Android APK workflow must use the verified upload-artifact v7.0.1 commit',
);
for (const artifact of ['memphis-zoo-ops-debug','memphis-zoo-custodial-debug','memphis-zoo-viewer-debug']) assert.match(workflow, new RegExp(artifact));
assert.match(workflow, /configure-branding\.mjs/);
assert.match(workflow, /configure-native-links\.mjs android/);
assert.match(workflow, /configure-android-backup\.mjs/);
assert.match(workflow, /verify-android-apk-backup\.mjs/);
assert.match(workflow, /native-mobile-build-contract-tests\.mjs/);
assert.match(workflow, /configure-native-release\.mjs android/);
assert.match(workflow, /configure-native-release\.mjs android-version/);
assert.match(workflow, /compiled-debug\.json/);
assert.match(workflow, /Debug APK compiled versionCode mismatch/);
assert.match(workflow, /assembleRelease bundleRelease/);
assert.match(workflow, /--dependency-verification strict assembleDebug/);
assert.match(workflow, /--dependency-verification strict assembleRelease bundleRelease/);
assert.match(workflow, /gradle-strict-debug-\$MZ_APP_EDITION/);
assert.match(workflow, /gradle-strict-release-\$MZ_APP_EDITION/);
assert.equal(
  [...workflow.matchAll(/--no-build-cache --rerun-tasks/g)].length,
  2,
  'debug and release Android proofs must bypass task and build caches',
);
assert.doesNotMatch(
  workflow,
  /--write-verification-metadata|--dependency-verification (?:lenient|off)/,
  'release workflows must never generate or weaken reviewed dependency trust metadata',
);
assert.match(workflow, /native-locks\/android\/\$MZ_APP_EDITION\/verification-metadata\.xml/);
assert.match(workflow, /7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172/);
assert.match(workflow, /apksigner.*verify --verbose --print-certs/s);
assert.match(workflow, /jarsigner -verify/);
assert.match(workflow, /test-signed-release-path\.json/);
assert.match(workflow, /EPHEMERAL-TEST-ONLY-compiled-proof\.json/);
assert.match(workflow, /production_signer_accepted: false/);
assert.match(workflow, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(workflow, /MZ_SHELL_START:\s*'1'/);
assert.match(workflow, /config\.server\?\.appStartPath !== '\/app-shell\.html'/);
assert.match(workflow, /graph\.shell_proof !== true/);
assert.match(workflow, /assets\/public\/app-shell\.html/);
assert.match(workflow, /retention-days: 30/);
assert.doesNotMatch(workflow, /FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_SERVICES_JSON_B64|private_key/);
assert.match(brandingScript, /ic_launcher_foreground/);
assert.doesNotMatch(brandingScript, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(nativeLinksScript, /memphiszoo\.custodial\.NFC_SCAN/);
assert.match(nativeLinksScript, /android:path="\/Engine\/"/);
assert.match(nativeLinksScript, /CFBundleURLTypes/);
assert.doesNotMatch(nativeLinksScript, /android:autoVerify="true"/);
assert.match(androidBackupScript, /deny-cloud-backup-and-device-transfer/);
assert.match(apkBackupVerifier, /dump', 'xmltree'/);
assert.match(apkBackupVerifier, /dump', 'resources'/);
assert.match(apkBackupVerifier, /semantic_sha256/);
assert.match(custodialReleaseVerifier, /--build-tools-directory/);
assert.doesNotMatch(custodialReleaseVerifier, /--expected-signer|--fixture/);
assert.equal(JSON.parse(custodialAcceptanceSchema).$id, CUSTODIAL_ACCEPTANCE_SCHEMA_ID);
assert.equal(CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION, '35.0.1', 'Custodial acceptance must use the reviewed Codemagic Build Tools version');
assert.equal(CUSTODIAL_ANDROID_RELEASE_POLICY.highest_fleet_version_code, 10);
assert.equal(CUSTODIAL_ANDROID_RELEASE_POLICY.minimum_next_version_code, 11);
assert.equal(
  CONFIGURE_CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
  CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
  'native configuration and compiled acceptance must consume the same protected release policy',
);
assert.equal(CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.archive.sha1, 'f4dda6855ddf1ea1a51ee3ab6587104bd0c1d727');
assert.equal(JSON.parse(custodialReleasePolicy).minimum_next_version_code, 11);
assert.equal(JSON.parse(custodialToolchainPolicy).archive.size_bytes, 76857925);
assert.equal(CUSTODIAL_NODE_VERSION, 'v22.23.1', 'Custodial acceptance must use the repository-pinned Node runtime');
assert.equal(CUSTODIAL_CODEMAGIC_WORKFLOW, 'custodial-android', 'Custodial acceptance must bind the literal Codemagic workflow key');
assert.equal(CUSTODIAL_TARGET_SDK_VERSION, 36, 'Custodial acceptance must pin the reviewed target SDK');
assert.match(codemagic, /MZ_API_BASE: https:\/\/memphis-zoo-mcp\.onrender\.com/);
assert.doesNotMatch(codemagic, /firebase_credentials/);
assert.match(codemagic, /firebase_client_config/);
assert.match(codemagic, /MZ_REQUIRE_PINNED_FIREBASE_CONFIG: '1'/);
assert.match(
  codemagic,
  /case "\$MZ_APP_EDITION" in[\s\S]*manager\)[\s\S]*expected_firebase_package='org\.memphiszoo\.ops'[\s\S]*configure-firebase\.mjs android[\s\S]*custodial\)[\s\S]*expected_firebase_package='org\.memphiszoo\.custodial'[\s\S]*configure-firebase\.mjs android[\s\S]*viewer\)[\s\S]*expected_firebase_package=''/,
  'production Android builds must configure Firebase for manager and custodial, but not viewer',
);
assert.match(codemagic, /test -s android\/app\/google-services\.json/);
assert.match(codemagic, /packages\.includes\(process\.env\.EXPECTED_FIREBASE_PACKAGE\)/);
assert.match(codemagic, /test ! -e android\/app\/google-services\.json/);
assert.match(codemagic, /cap add ios --packagemanager SPM/);
assert.doesNotMatch(codemagic, /App\.xcworkspace/, 'Capacitor 8 SPM builds must use the generated Xcode project');
assert.doesNotMatch(codemagic, /\bgem install\b|require ['"]xcodeproj['"]/, 'native release configuration must not install unpinned Ruby tooling');
assert.equal(
  [...codemagic.matchAll(/xcode-project build-ipa \\\n\s+--project "\$CM_BUILD_DIR\/mobile\/ios\/App\/App\.xcodeproj"/g)].length,
  2,
  'the two store-distributed iOS editions must archive the generated SPM Xcode project',
);
assert.match(codemagic, /-disableAutomaticPackageResolution/);
assert.match(codemagic, /-onlyUsePackageVersionsFromResolvedFile/);
assert.match(codemagic, /cmp "\$lock" "\$resolved"/);
assert.match(codemagic, /PROJECT_BUILD_NUMBER/);
assert.doesNotMatch(codemagic, /CM_BUILD_NUMBER/, 'Codemagic exports PROJECT_BUILD_NUMBER and BUILD_NUMBER, not CM_BUILD_NUMBER');
assert.equal(
  [...codemagic.matchAll(/MZ_RELEASE_VERSION: 1\.0\.0/g)].length,
  5,
  'every native release workflow must declare the same user-facing version',
);
for (const verification of ['apksigner','jarsigner','codesign --verify']) {
  assert.ok(codemagic.includes(verification), `signed artifact verification missing ${verification}`);
}
assert.match(codemagic, /configure-native-release\.mjs android/);
assert.match(codemagic, /configure-native-release\.mjs ios/);
assert.match(codemagic, /configure-native-links\.mjs android/);
assert.match(codemagic, /configure-native-links\.mjs ios/);
assert.match(codemagic, /configure-android-backup\.mjs/);
assert.match(codemagic, /verify-android-apk-backup\.mjs/);
assert.match(codemagic, /verify-custodial-android-release\.mjs/);
assert.match(codemagic, /--build-workflow custodial-android/);
assert.match(codemagic, /--build-tools-directory "\$ANDROID_SDK_ROOT\/build-tools\/35\.0\.1"/);
assert.match(codemagic, /custodial-android-release-acceptance\.json/);
assert.match(codemagic, /custodial-android-toolchain\.json/);
assert.match(codemagic, /codemagic_xcode_image: '26\.2'/);
assert.equal(
  [...codemagic.matchAll(/xcode: '26\.2'/g)].length,
  3,
  'every Android workflow must pin the reviewed Codemagic image',
);
assert.match(codemagic, /git diff --exit-code "\$CM_COMMIT" -- \./);
assert.match(codemagic, /untracked_nonignored_files_absent: true/);
assert.match(codemagic, /walkEvidence\('build\/provenance'\)/);
assert.match(codemagic, /test "\$custodial_apk_count" -eq 1/);
assert.match(codemagic, /native-mobile-build-contract-tests\.mjs/);
assert.match(custodialReleaseVerifier, new RegExp(CUSTODIAL_SIGNER_SHA256));
assert.doesNotMatch(codemagic, /Signer #1 certificate SHA-256 digest|grep[^\n]+Number of signers/);
assert.equal(
  [...codemagic.matchAll(/#!\/usr\/bin\/env bash/g)].length,
  [...codemagic.matchAll(/set -euo pipefail/g)].length,
  'every strict Codemagic script must explicitly select Bash',
);
assert.doesNotMatch(
  codemagic,
  /script: \|\n\s+set -euo pipefail/,
  'Codemagic must not run Bash strict mode through the default sh interpreter',
);
assert.match(
  codemagic,
  /distributionSha256Sum=ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c/,
);
assert.equal(
  [...codemagic.matchAll(/--dependency-verification strict assembleRelease bundleRelease/g)].length,
  2,
  'both store-distributed Android workflows must build an app bundle with strict dependency verification',
);
assert.match(codemagic, /custodial-android:[\s\S]*--dependency-verification strict assembleRelease\s+\\\n/, 'the private Custodial workflow must build a strictly verified APK');
assert.doesNotMatch(codemagic, /^  custodial-ios:$/m, 'Custodial must not be distributed through Apple');
const custodialAndroid = codemagic.match(/^  custodial-android:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n|\Z)/m)?.[0] || '';
assert.doesNotMatch(custodialAndroid, /google_play_credentials|bundleRelease|\.aab|publishing:|google_play:/, 'Custodial must remain a private signed APK, never a store bundle');
assert.equal(
  [...codemagic.matchAll(/\.gradle-strict-\$MZ_APP_EDITION-\$PROJECT_BUILD_NUMBER/g)].length,
  3,
  'every signed Android workflow must use an isolated per-build Gradle home',
);
assert.equal(
  [...codemagic.matchAll(/--no-build-cache --rerun-tasks/g)].length,
  3,
  'every signed Android workflow must bypass task and build caches',
);
assert.doesNotMatch(
  codemagic,
  /--write-verification-metadata|--dependency-verification (?:lenient|off)/,
  'Codemagic must never generate or weaken reviewed dependency trust metadata',
);
assert.equal(
  [...codemagic.matchAll(/\.\.\/native-locks\/android\/\$MZ_APP_EDITION\/verification-metadata\.xml/g)].length,
  3,
  'every signed Android workflow must compare the restored dependency lock after building',
);
for (const variable of ['CM_KEYSTORE_PATH','CM_KEYSTORE_PASSWORD','CM_KEY_ALIAS','CM_KEY_PASSWORD']) {
  assert.ok(androidReleaseOverlay.includes(variable), `Android release overlay missing ${variable}`);
}
assert.doesNotMatch(androidReleaseOverlay, /versionCode|versionName/);
assert.match(androidVersionOverlay, /versionCode buildNumber\.intValue\(\)/);
assert.match(androidVersionOverlay, /versionName releaseVersion/);
assert.match(androidVersionOverlay, /buildToolsVersion '35\.0\.1'/);
assert.match(androidReleaseOverlay, /signingConfig signingConfigs\.release/);
assert.match(nativeReleaseScript, /signing_keystore_sha256/);
assert.match(nativeReleaseScript, /swift_package_lock_sha256/);
assert.match(nativeReleaseScript, /gradle_wrapper_jar_sha256/);
assert.match(nativeReleaseScript, /gradle_verification_metadata_sha256/);
assert.match(nativeReleaseScript, /generated_variables_gradle_sha256/);
assert.match(nativeReleaseScript, /VERSIONING_SYSTEM = apple-generic/);
assert.match(
  nativeReleaseScript,
  /ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c/,
);
for (const id of ['org.memphiszoo.ops','org.memphiszoo.custodial','org.memphiszoo.viewer']) assert.match(capacitorConfig, new RegExp(id.replaceAll('.', '\\.')));
assert.match(capacitorConfig, /const custodialPlugins = \[[^\]]*'@capacitor\/barcode-scanner'/);
assert.match(capacitorConfig, /loggingBehavior: 'debug'/, 'signed release apps must suppress native bridge payload logging');
assert.doesNotMatch(capacitorConfig, /loggingBehavior: 'production'/, 'signed apps must never log SecureStorage and push-token payloads');
assert.match(capacitorConfig, /webContentsDebuggingEnabled: false/, 'signed Android apps must disable WebView debugging');
assert.match(mobilePackage, /build:custodial/);
assert.match(mobilePackage, /"@capacitor\/android": "8\.4\.2"/);
assert.match(mobilePackage, /"@capacitor\/barcode-scanner": "3\.1\.0"/);
const variablesFixture = 'ext {\n    minSdkVersion = 24\n}\n';
assert.equal(
  configureAndroidVariablesSource(variablesFixture, 'custodial'),
  'ext {\n    minSdkVersion = 26\n}\n',
);
assert.equal(configureAndroidVariablesSource(variablesFixture, 'manager'), variablesFixture);
assert.throws(
  () => configureAndroidVariablesSource('ext {}\n', 'custodial'),
  /minimum SDK declaration must occur exactly 1 time/,
);

for (const [edition, bytes] of [
  ['manager', managerLockBytes],
  ['custodial', custodialLockBytes],
  ['viewer', viewerLockBytes],
]) {
  validateSwiftLock(JSON.parse(bytes), edition);
}
const androidGraphs = new Map();
for (const [edition, bytes] of [
  ['manager', managerAndroidVerificationBytes],
  ['custodial', custodialAndroidVerificationBytes],
  ['viewer', viewerAndroidVerificationBytes],
]) {
  validateGradleVerificationMetadata(bytes, edition);
  androidGraphs.set(edition, inspectGradleVerificationMetadata(bytes, edition));
}
const sharedAndroidArtifacts = new Map();
for (const [edition, graph] of androidGraphs) {
  for (const [artifact, checksum] of graph.artifacts) {
    if (sharedAndroidArtifacts.has(artifact)) {
      assert.equal(
        checksum,
        sharedAndroidArtifacts.get(artifact),
        `${artifact} checksum drifted across Android editions`,
      );
    } else {
      sharedAndroidArtifacts.set(artifact, checksum);
    }
  }
}
const macosAapt2Artifact = 'com.android.tools.build:aapt2:8.13.0-13719691/aapt2-8.13.0-13719691-osx.jar';
assert.equal(
  sharedAndroidArtifacts.get(macosAapt2Artifact),
  '29213e18381a5d8c72932f8bbd06349f99131ec3b13c14e8c0ec90738b865ca1',
  'Every Android edition must trust the Google-published macOS AAPT2 artifact used by the free M2 builder',
);
assert.throws(
  () => inspectGradleVerificationMetadata(
    custodialAndroidVerificationBytes.toString('utf8').replace('origin="Google Maven SHA-256"', 'origin="Unreviewed source"'),
    'custodial',
  ),
  /invalid SHA-256 record/,
  'Gradle trust metadata must reject checksum origins outside the reviewed allowlist',
);
assert.throws(
  () => inspectGradleVerificationMetadata(
    viewerAndroidVerificationBytes.toString('utf8').replace(
      /      <component group="com\.google\.guava" name="guava-parent" version="33\.3\.1-jre">[\s\S]*?      <\/component>\n/,
      '',
    ),
    'viewer',
  ),
  /missing required artifact com\.google\.guava:guava-parent:33\.3\.1-jre/,
);
assert.throws(() => validateGradleWrapperJar(Buffer.from('not the approved wrapper')), /does not match/);
assert.deepEqual(resolveBuildNumber({ PROJECT_BUILD_NUMBER: '420' }), {
  value: '420',
  numeric: 420,
  source: 'PROJECT_BUILD_NUMBER',
});
assert.throws(() => resolveBuildNumber({ PROJECT_BUILD_NUMBER: '0' }), /positive integer/);
assert.throws(() => resolveBuildNumber({ PROJECT_BUILD_NUMBER: '2100000001' }), /no greater than/);
assert.equal(assertEditionBuildFloor('custodial', 11), 11);
assert.throws(() => assertEditionBuildFloor('custodial', 10), /protected release floor 11/);
assert.equal(assertEditionBuildFloor('manager', 1), 1);
assert.equal(resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0.0' }), '1.0.0');
assert.throws(() => resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0' }), /three numeric components/);

const syntheticGradle = 'android { buildTypes { release { minifyEnabled false } } }\n';
const configuredGradle = injectAndroidOverlay(syntheticGradle);
assert.match(configuredGradle, /native-version\.gradle/);
assert.match(configuredGradle, /codemagic-release\.gradle/);
assert.equal(injectAndroidOverlay(configuredGradle), configuredGradle, 'Android overlay injection must be idempotent');
const configuredUnsignedGradle = injectAndroidOverlay(syntheticGradle, { includeSigning: false });
assert.match(configuredUnsignedGradle, /native-version\.gradle/);
assert.doesNotMatch(configuredUnsignedGradle, /codemagic-release\.gradle/);

const syntheticWrapper = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
const configuredWrapper = configureGradleWrapperSource(syntheticWrapper);
assert.match(
  configuredWrapper,
  /^distributionSha256Sum=ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c$/m,
);
assert.equal(
  configureGradleWrapperSource(configuredWrapper),
  configuredWrapper,
  'Gradle wrapper checksum configuration must be idempotent',
);
assert.throws(
  () => configureGradleWrapperSource(
    syntheticWrapper.replace(
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip',
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.2-all.zip',
    ),
  ),
  /approved Gradle wrapper distribution URL/,
);
assert.throws(
  () => configureGradleWrapperSource(
    syntheticWrapper.replace(
      'distributionUrl=',
      `distributionSha256Sum=${'0'.repeat(64)}\ndistributionUrl=`,
    ),
  ),
  /checksum does not match/,
);

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

const syntheticManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <activity android:name=".MainActivity">
    </activity>
  </application>
</manifest>
`;
for (const [edition, requiredHosts, prohibitedHosts] of [
  ['manager', ['route', 'event'], ['scan']],
  ['custodial', ['route', 'event', 'scan'], []],
  ['viewer', ['route'], ['event', 'scan']],
]) {
  const configuredManifest = configureAndroidManifestSource(
    syntheticManifest,
    edition,
    { shellProof: true },
  );
  assert.equal(
    configureAndroidManifestSource(configuredManifest, edition, { shellProof: true }),
    configuredManifest,
    `${edition} Android native links must be idempotent`,
  );
  for (const host of requiredHosts) {
    assert.match(
      configuredManifest,
      new RegExp(`android:scheme="memphiszoo-${edition}" android:host="${host}"`),
    );
  }
  for (const host of prohibitedHosts) {
    assert.doesNotMatch(
      configuredManifest,
      new RegExp(`android:scheme="memphiszoo-${edition}" android:host="${host}"`),
    );
  }
  assert.equal(
    configuredManifest.includes('memphiszoo.custodial.NFC_SCAN'),
    edition === 'custodial',
  );
  for (const other of ['manager', 'custodial', 'viewer'].filter((name) => name !== edition)) {
    assert.doesNotMatch(configuredManifest, new RegExp(`android:scheme="memphiszoo-${other}"`));
  }
  assert.doesNotMatch(configuredManifest, /android:autoVerify="true"/);
}
for (const edition of ['manager', 'viewer']) {
  assert.doesNotMatch(
    configureAndroidManifestSource(syntheticManifest, edition),
    /android:scheme="memphiszoo/,
  );
}
const productionCustodialManifest = configureAndroidManifestSource(syntheticManifest, 'custodial');
assert.match(productionCustodialManifest, /android:scheme="memphiszoo" android:host="scan"/);
assert.doesNotMatch(productionCustodialManifest, /android:scheme="memphiszoo-custodial"/);

const insecureBackupManifest = syntheticManifest.replace(
  '<application>',
  '<application android:allowBackup="true" android:fullBackupContent="@xml/legacy_default">',
);
const secureBackupManifest = configureAndroidBackupManifestSource(insecureBackupManifest);
assertAndroidBackupManifestSecurity(secureBackupManifest);
assert.equal(
  configureAndroidBackupManifestSource(secureBackupManifest),
  secureBackupManifest,
  'Android backup hardening must be idempotent',
);
assert.match(secureBackupManifest, /android:allowBackup="false"/);
assert.match(secureBackupManifest, /android:fullBackupContent="@xml\/memphis_zoo_backup_rules"/);
assert.match(secureBackupManifest, /android:dataExtractionRules="@xml\/memphis_zoo_data_extraction_rules"/);
assert.doesNotMatch(secureBackupManifest, /legacy_default|android:allowBackup="true"/);
assertAndroidBackupRulesSecurity({ legacy: legacyBackupRules, extraction: dataExtractionRules });
assert.match(dataExtractionRules, /<cloud-backup>/);
assert.match(dataExtractionRules, /<device-transfer>/);
assert.doesNotMatch(`${legacyBackupRules}\n${dataExtractionRules}`, /<include\b/);
const immutableAndroidBackupDomains = Object.freeze([
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
]);
assert.deepEqual(androidBackupDomains, immutableAndroidBackupDomains, 'backup generator domains must match the immutable literal policy');
assert.deepEqual(CUSTODIAL_RELEASE_BACKUP_DOMAINS, immutableAndroidBackupDomains, 'release acceptance domains must match the immutable literal policy');
for (const domain of immutableAndroidBackupDomains) {
  const pattern = new RegExp(`<exclude domain="${domain}" path="\\." \\/>`, 'g');
  assert.equal([...legacyBackupRules.matchAll(pattern)].length, 1, `${domain} must be excluded from legacy backup`);
  assert.equal([...dataExtractionRules.matchAll(pattern)].length, 2, `${domain} must be excluded from cloud and D2D transfer`);
}
assert.throws(
  () => configureAndroidBackupManifestSource('<manifest><application></application><application></application></manifest>'),
  /exactly one application element/,
);
const compiledManifestProof = `
E: manifest (line=2)
  A: package="org.memphiszoo.custodial" (Raw: "org.memphiszoo.custodial")
  A: android:versionCode(0x0101021b)=(type 0x10)0x0000000b
  A: android:versionName(0x0101021c)="1.0.0" (Raw: "1.0.0")
  E: uses-sdk (line=7)
    A: android:minSdkVersion(0x0101020c)=(type 0x10)0x0000001a
    A: android:targetSdkVersion(0x01010270)=(type 0x10)0x00000024
  E: application (line=10)
    A: android:allowBackup(0x01010280)=false
    A: android:fullBackupContent(0x010103f1)=@0x7f110001
    A: android:dataExtractionRules(0x01010650)=@0x7f110002
`;
const compiledBadgingProof = `package: name='org.memphiszoo.custodial' versionCode='11' versionName='1.0.0' compileSdkVersion='36'
sdkVersion:'26'
targetSdkVersion:'36'
`;
const compiledResourcesProof = `
resource 0x7f110001 xml/memphis_zoo_backup_rules
  () (file) res/8K.xml type=XML
resource 0x7f0d0001 layout/activity_main
  () (file) res/7A.xml type=XML
resource 0x7f110002 xml/memphis_zoo_data_extraction_rules
  () (file) res/8L.xml type=XML
`;
const compiledExclusions = (domains, indentation) => domains.map((domain) => `${indentation}E: exclude (line=1)
${indentation}  A: domain="${domain}" (Raw: "${domain}")
${indentation}  A: path="." (Raw: ".")`).join('\n');
const compiledLegacyRulesProof = `E: full-backup-content (line=1)
${compiledExclusions(immutableAndroidBackupDomains, '  ')}
`;
const compiledExtractionRulesProof = `E: data-extraction-rules (line=1)
  E: cloud-backup (line=2)
${compiledExclusions(immutableAndroidBackupDomains, '    ')}
  E: device-transfer (line=13)
${compiledExclusions(immutableAndroidBackupDomains, '    ')}
`;
const compiledBackupProof = assertCompiledAndroidBackupSecurity({
  manifestDump: compiledManifestProof,
  resourcesDump: compiledResourcesProof,
  legacyRulesDump: compiledLegacyRulesProof,
  extractionRulesDump: compiledExtractionRulesProof,
});
assert.equal(compiledBackupProof.legacy_resource.packaged_path, 'res/8K.xml');
assert.equal(compiledBackupProof.data_extraction_resource.packaged_path, 'res/8L.xml');
assert.match(compiledBackupProof.legacy_resource.semantic_sha256, /^[a-f0-9]{64}$/);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof.replace('=false', '=true'),
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /allowBackup=false/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof.replace('android:allowBackup', 'lookalike:allowBackup'),
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /allowBackup=false/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof.replace('@0x7f110001', '@0x7f110099'),
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /does not bind/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof.replace(
      '  () (file) res/8K.xml type=XML',
      '  () (file) res/8K.xml type=XML\n  (v31) (file) res/8M.xml type=XML',
    ),
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /exactly one default file/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: `E: full-backup-content\n${compiledExclusions(immutableAndroidBackupDomains.slice(1), '  ')}\n`,
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /exactly 9 exclusions/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof.replace('E: exclude', 'E: include'),
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /only empty exclude elements/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof,
    extractionRulesDump: compiledExtractionRulesProof
      .replace('  E: cloud-backup', '  E: temporary')
      .replace('  E: device-transfer', '  E: cloud-backup')
      .replace('  E: temporary', '  E: device-transfer'),
  }),
  /exactly cloud-backup then device-transfer/,
);
assert.throws(
  () => assertCompiledAndroidBackupSecurity({
    manifestDump: compiledManifestProof,
    resourcesDump: compiledResourcesProof,
    legacyRulesDump: compiledLegacyRulesProof.replace(
      '    A: path="." (Raw: ".")',
      '    A: path="." (Raw: ".")\n    T: "unexpected"',
    ),
    extractionRulesDump: compiledExtractionRulesProof,
  }),
  /only empty exclude elements/,
);

const compiledCustodialApplication = assertCustodialReleaseManifest({
  manifestDump: compiledManifestProof,
  badgingDump: compiledBadgingProof,
  expectedBuildNumber: 11,
});
assert.deepEqual(compiledCustodialApplication, {
  package_name: CUSTODIAL_PACKAGE_NAME,
  version_code: 11,
  version_name: '1.0.0',
  min_sdk_version: 26,
  target_sdk_version: 36,
  debuggable: false,
  test_only: false,
});
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replaceAll('org.memphiszoo.custodial', 'org.memphiszoo.attacker'),
    badgingDump: compiledBadgingProof.replaceAll('org.memphiszoo.custodial', 'org.memphiszoo.attacker'),
    expectedBuildNumber: 11,
  }),
  /package must be org\.memphiszoo\.custodial/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof,
    badgingDump: compiledBadgingProof,
    expectedBuildNumber: 10,
  }),
  /protected release floor 11/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replace('0x0000000b', '0x0000000a'),
    badgingDump: compiledBadgingProof.replace("versionCode='11'", "versionCode='10'"),
    expectedBuildNumber: 11,
  }),
  /Compiled Custodial versionCode must be at least protected release floor 11/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof,
    badgingDump: compiledBadgingProof,
    expectedBuildNumber: 12,
  }),
  /does not match build 12/,
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: compiledManifestProof.replace('0x00000024', '0x00000023'),
    badgingDump: compiledBadgingProof.replace("targetSdkVersion:'36'", "targetSdkVersion:'35'"),
    expectedBuildNumber: 11,
  }),
  /targetSdkVersion must be 36/,
);
const debuggableManifest = compiledManifestProof.replace(
  '    A: android:allowBackup',
  '    A: android:debuggable(0x0101000f)=true\n    A: android:allowBackup',
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: debuggableManifest,
    badgingDump: `${compiledBadgingProof}application-debuggable\n`,
    expectedBuildNumber: 11,
  }),
  /must not be debuggable/,
);
const testOnlyManifest = compiledManifestProof.replace(
  '    A: android:allowBackup',
  '    A: android:testOnly(0x01010272)=true\n    A: android:allowBackup',
);
assert.throws(
  () => assertCustodialReleaseManifest({
    manifestDump: testOnlyManifest,
    badgingDump: compiledBadgingProof.replace("versionName='1.0.0'", "versionName='1.0.0' testOnly='true'"),
    expectedBuildNumber: 11,
  }),
  /must not be testOnly/,
);

const acceptedSourceCommit = '0123456789abcdef0123456789abcdef01234567';
const embeddedBuildIdentity = {
  edition: 'custodial',
  release_id: '2026-08-01',
  source_commit: acceptedSourceCommit,
  build_id: `2026-08-01.custodial.${acceptedSourceCommit.slice(0, 12)}`,
  native_build_number: 11,
};
const embeddedBuildIdentitySource = `globalThis.MemphisMobileBuild="11";globalThis.MemphisMobileBuildIdentity=${JSON.stringify(embeddedBuildIdentity)};\n`;
assert.deepEqual(parseEmbeddedBuildIdentity(embeddedBuildIdentitySource), embeddedBuildIdentity);
assert.throws(
  () => parseEmbeddedBuildIdentity(`${embeddedBuildIdentitySource}globalThis.injected=true;`),
  /unexpected or trailing content/,
);
const embeddedProvenance = assertEmbeddedCustodialProvenance({
  buildJson: embeddedBuildIdentity,
  runtimeAssetManifest: embeddedBuildIdentity,
  buildIdentity: embeddedBuildIdentity,
  expectedBuildNumber: 11,
  expectedSourceCommit: acceptedSourceCommit,
});
const runtimeBytes = new Map([
  ['assets/public/app.js', Buffer.from('console.log("custodial");\n')],
  ['assets/public/nested/app.css', Buffer.from('body{color:#fff}\n')],
  ['assets/public/cordova.js', Buffer.from('generated-cordova\n')],
  ['assets/public/cordova_plugins.js', Buffer.from('generated-plugins\n')],
]);
const fixtureSha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runtimeAssetFixture = {
  ...embeddedBuildIdentity,
  schema_version: 1,
  asset_count: 2,
  asset_hashes_sha256: {
    'app.js': fixtureSha256(runtimeBytes.get('assets/public/app.js')),
    'nested/app.css': fixtureSha256(runtimeBytes.get('assets/public/nested/app.css')),
  },
};
const runtimeZipEntries = [
  'assets/public/app.js',
  'assets/public/nested/app.css',
  'assets/public/runtime-asset-manifest.json',
  'assets/public/cordova.js',
  'assets/public/cordova_plugins.js',
];
const runtimeProof = assertEmbeddedRuntimeAssets({
  runtimeAssetManifest: runtimeAssetFixture,
  zipEntries: runtimeZipEntries,
  readEntry: (entry) => runtimeBytes.get(entry) || Buffer.from('manifest-bytes'),
});
assert.equal(runtimeProof.runtime_asset_count, 2);
assert.equal(runtimeProof.runtime_assets_verified, true);
assert.match(runtimeProof.capacitor_generated_assets_sha256['cordova.js'], /^[a-f0-9]{64}$/);
assert.throws(
  () => assertEmbeddedRuntimeAssets({
    runtimeAssetManifest: runtimeAssetFixture,
    zipEntries: runtimeZipEntries,
    readEntry: (entry) => entry === 'assets/public/app.js' ? Buffer.from('changed') : runtimeBytes.get(entry) || Buffer.from('manifest-bytes'),
  }),
  /runtime asset hash differs/,
);
assert.throws(
  () => assertEmbeddedRuntimeAssets({
    runtimeAssetManifest: runtimeAssetFixture,
    zipEntries: [...runtimeZipEntries, 'assets/public/unmanifested.js'],
    readEntry: (entry) => runtimeBytes.get(entry) || Buffer.from('manifest-bytes'),
  }),
  /runtime graph differs/,
);
Object.assign(embeddedProvenance, {
  ...runtimeProof,
  build_json_sha256: '1'.repeat(64),
  runtime_asset_manifest_sha256: '2'.repeat(64),
  build_identity_js_sha256: '3'.repeat(64),
});
assert.throws(
  () => assertEmbeddedCustodialProvenance({
    buildJson: { ...embeddedBuildIdentity, native_build_number: null },
    runtimeAssetManifest: embeddedBuildIdentity,
    buildIdentity: embeddedBuildIdentity,
    expectedBuildNumber: 11,
    expectedSourceCommit: acceptedSourceCommit,
  }),
  /native build number/,
);
assert.equal(normalizeCustodialSourceRef('main'), 'refs/heads/main');
assert.throws(() => normalizeCustodialSourceRef('feature/unreviewed'), /protected main/);
const alignmentProof = assertZipalignVerification({ status: 0 });
assert.throws(() => assertZipalignVerification({ status: 1, output: 'Verification FAILED' }), /alignment verification failed/);
const toolProof = (path, version, sha256 = '4'.repeat(64)) => ({ path, version, sha256 });
const releaseAcceptanceInput = {
  generatedAt: '2026-08-01T12:00:00.000Z',
  artifact: { file_name: 'app-release.apk', apk_sha256: '5'.repeat(64), size_bytes: 123456 },
  application: compiledCustodialApplication,
  embeddedProvenance,
  sourceCommit: acceptedSourceCommit,
  sourceRef: 'main',
  buildRun: 'cm-build-123',
  buildWorkflow: CUSTODIAL_CODEMAGIC_WORKFLOW,
  buildNumber: 11,
  signing: {
    signer_count: 1,
    signer_sha256: CUSTODIAL_SIGNER_SHA256,
    verified_schemes: [2, 3],
    v2_or_newer: true,
  },
  alignment: alignmentProof,
  backup: compiledBackupProof,
  tools: {
    android_build_tools_version: CUSTODIAL_ANDROID_BUILD_TOOLS_VERSION,
    aapt2: toolProof('/reviewed/35.0.1/aapt2', 'aapt2 35.0.1', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256.aapt2),
    apksigner: toolProof('/reviewed/35.0.1/apksigner', '0.9', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256.apksigner),
    apksigner_jar: toolProof('/reviewed/35.0.1/lib/apksigner.jar', '0.9', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256['lib/apksigner.jar']),
    source_properties: toolProof('/reviewed/35.0.1/source.properties', 'Pkg.Revision=35.0.1', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256['source.properties']),
    zipalign: toolProof('/reviewed/35.0.1/zipalign', 'Android Build Tools 35.0.1', CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256.zipalign),
    unzip: toolProof('/usr/bin/unzip', 'UnZip 6.00'),
    node: toolProof('/reviewed/node', CUSTODIAL_NODE_VERSION),
  },
  verifier: {
    release_acceptance_version: '2.0.0',
    release_acceptance_source_sha256: '6'.repeat(64),
    backup_verifier_version: '2.0.0',
    backup_verifier_source_sha256: '7'.repeat(64),
    acceptance_schema_sha256: '8'.repeat(64),
    release_policy_sha256: CUSTODIAL_ANDROID_RELEASE_POLICY.sha256,
    toolchain_policy_sha256: CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.sha256,
  },
};
const releaseAcceptance = createCustodialAndroidReleaseAcceptance(releaseAcceptanceInput);
assert.equal(releaseAcceptance.schema_id, CUSTODIAL_ACCEPTANCE_SCHEMA_ID);
assert.equal(releaseAcceptance.accepted, true);
assert.equal(releaseAcceptance.artifact.apk_sha256, '5'.repeat(64));
assert.equal(releaseAcceptance.source.commit, acceptedSourceCommit);
assert.equal(releaseAcceptance.build.run_id, 'cm-build-123');
assert.equal(releaseAcceptance.build.highest_fleet_version_code, 10);
assert.equal(releaseAcceptance.build.minimum_next_version_code, 11);
assert.deepEqual(releaseAcceptance.backup.excluded_domains, immutableAndroidBackupDomains);
assert.throws(
  () => createCustodialAndroidReleaseAcceptance({
    ...releaseAcceptanceInput,
    tools: {
      ...releaseAcceptanceInput.tools,
      aapt2: { ...releaseAcceptanceInput.tools.aapt2, sha256: '0'.repeat(64) },
    },
  }),
  /reviewed official macOS Build Tools package/,
);

const syntheticPlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Memphis Zoo</string>
</dict>
</plist>
`;
for (const [edition, identifier] of [
  ['manager', 'org.memphiszoo.ops'],
  ['custodial', 'org.memphiszoo.custodial'],
  ['viewer', 'org.memphiszoo.viewer'],
]) {
  const configuredPlist = configureIosInfoPlistSource(
    syntheticPlist,
    edition,
    { shellProof: true },
  );
  assert.equal(
    configureIosInfoPlistSource(configuredPlist, edition, { shellProof: true }),
    configuredPlist,
    `${edition} iOS native links must be idempotent`,
  );
  assert.match(configuredPlist, /<key>CFBundleURLTypes<\/key>/);
  assert.match(configuredPlist, new RegExp(`<string>memphiszoo-${edition}</string>`));
  assert.match(configuredPlist, new RegExp(`<string>${identifier.replaceAll('.', '\\.')}</string>`));
  for (const other of ['manager', 'custodial', 'viewer'].filter((name) => name !== edition)) {
    assert.doesNotMatch(configuredPlist, new RegExp(`<string>memphiszoo-${other}</string>`));
  }
  const productionPlist = configureIosInfoPlistSource(configuredPlist, edition);
  assert.doesNotMatch(
    productionPlist,
    new RegExp(`<string>memphiszoo-${edition}</string>`),
    `${edition} iOS proof scheme must be removed from a production reconfiguration`,
  );
  assert.equal(
    productionPlist.includes('<string>memphiszoo</string>'),
    edition === 'custodial',
    `${edition} iOS production legacy-scheme isolation mismatch`,
  );
}
assert.equal(configureIosInfoPlistSource(syntheticPlist, 'manager'), syntheticPlist);
assert.equal(configureIosInfoPlistSource(syntheticPlist, 'viewer'), syntheticPlist);
const productionCustodialPlist = configureIosInfoPlistSource(syntheticPlist, 'custodial');
assert.match(productionCustodialPlist, /<string>memphiszoo<\/string>/);
assert.doesNotMatch(productionCustodialPlist, /<string>memphiszoo-custodial<\/string>/);
console.log('NATIVE_MOBILE_BUILD_CONTRACT_PASS');
