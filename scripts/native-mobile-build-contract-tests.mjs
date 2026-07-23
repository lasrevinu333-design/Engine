import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  configureGradleWrapperSource,
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

const [
  configScript,
  brandingScript,
  nativeLinksScript,
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
  managerAndroidVerificationBytes,
  custodialAndroidVerificationBytes,
  viewerAndroidVerificationBytes,
] = await Promise.all([
  readFile(new URL('../mobile/scripts/configure-firebase.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-branding.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/scripts/configure-native-links.mjs', import.meta.url), 'utf8'),
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
  readFile(new URL('../mobile/native-locks/android/manager/verification-metadata.xml', import.meta.url)),
  readFile(new URL('../mobile/native-locks/android/custodial/verification-metadata.xml', import.meta.url)),
  readFile(new URL('../mobile/native-locks/android/viewer/verification-metadata.xml', import.meta.url)),
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
assert.match(workflow, /configure-native-links\.mjs android/);
assert.match(workflow, /configure-native-release\.mjs android/);
assert.match(workflow, /configure-native-release\.mjs android-wrapper/);
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
assert.match(codemagic, /configure-native-links\.mjs android/);
assert.match(codemagic, /configure-native-links\.mjs ios/);
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
  3,
  'every signed Android workflow must enforce strict dependency verification',
);
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
assert.match(androidReleaseOverlay, /versionCode buildNumber\.intValue\(\)/);
assert.match(androidReleaseOverlay, /versionName releaseVersion/);
assert.match(androidReleaseOverlay, /signingConfig signingConfigs\.release/);
assert.match(nativeReleaseScript, /signing_keystore_sha256/);
assert.match(nativeReleaseScript, /swift_package_lock_sha256/);
assert.match(nativeReleaseScript, /gradle_wrapper_jar_sha256/);
assert.match(nativeReleaseScript, /gradle_verification_metadata_sha256/);
assert.match(nativeReleaseScript, /VERSIONING_SYSTEM = apple-generic/);
assert.match(
  nativeReleaseScript,
  /ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c/,
);
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
assert.equal(resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0.0' }), '1.0.0');
assert.throws(() => resolveReleaseVersion({ MZ_RELEASE_VERSION: '1.0' }), /three numeric components/);

const syntheticGradle = 'android { buildTypes { release { minifyEnabled false } } }\n';
const configuredGradle = injectAndroidOverlay(syntheticGradle);
assert.match(configuredGradle, /codemagic-release\.gradle/);
assert.equal(injectAndroidOverlay(configuredGradle), configuredGradle, 'Android overlay injection must be idempotent');

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
}
assert.equal(configureIosInfoPlistSource(syntheticPlist, 'manager'), syntheticPlist);
assert.equal(configureIosInfoPlistSource(syntheticPlist, 'viewer'), syntheticPlist);
const productionCustodialPlist = configureIosInfoPlistSource(syntheticPlist, 'custodial');
assert.match(productionCustodialPlist, /<string>memphiszoo<\/string>/);
assert.doesNotMatch(productionCustodialPlist, /<string>memphiszoo-custodial<\/string>/);
console.log('NATIVE_MOBILE_BUILD_CONTRACT_PASS');
