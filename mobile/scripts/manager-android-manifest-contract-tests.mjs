import assert from 'node:assert/strict';
import {
  MANAGER_PLAY_INTEGRITY_METADATA_NAME,
  MANAGER_PLAY_INTEGRITY_METADATA_PREFIX,
  assertManagerPlayIntegrityManifestSource,
  canonicalManagerPlayIntegrityProjectNumber,
  configureAndroidBackupManifestSource,
  configureManagerPlayIntegrityManifestSource,
} from './configure-android-backup.mjs';
import { parseCompiledAndroidApplicationMetadata } from './verify-android-apk-backup.mjs';

const PROJECT = '123456789012';
const base = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:label="Manager">
    <activity android:name=".MainActivity">
      <meta-data android:name="nested.unrelated" android:value="safe" />
    </activity>
  </application>
</manifest>
`;

const configured = configureManagerPlayIntegrityManifestSource(
  configureAndroidBackupManifestSource(base),
  PROJECT,
);
assert.equal(assertManagerPlayIntegrityManifestSource(configured, PROJECT), true);
assert.equal(configureManagerPlayIntegrityManifestSource(configured, PROJECT), configured);
assert.equal(
  (configured.match(new RegExp(MANAGER_PLAY_INTEGRITY_METADATA_NAME, 'g')) || []).length,
  1,
);
assert.ok(configured.includes(`${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${PROJECT}`));
assert.equal(canonicalManagerPlayIntegrityProjectNumber(` ${PROJECT}\n`), PROJECT);

for (const invalid of ['', '12345', '0123456', '123456.0', '9223372036854775808', 'not-a-project']) {
  assert.throws(() => canonicalManagerPlayIntegrityProjectNumber(invalid), /Cloud project number/);
}

const wrongValue = configured.replace(
  `${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${PROJECT}`,
  `${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}999999`,
);
assert.throws(
  () => assertManagerPlayIntegrityManifestSource(wrongValue, PROJECT),
  /exactly one exact Play Integrity/,
);

const duplicate = configured.replace(
  '</application>',
  `  <meta-data android:name="${MANAGER_PLAY_INTEGRITY_METADATA_NAME}" android:value="${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${PROJECT}" />\n  </application>`,
);
assert.throws(
  () => configureManagerPlayIntegrityManifestSource(duplicate, PROJECT),
  /must occur exactly once/,
);

const nested = base.replace(
  '<meta-data android:name="nested.unrelated" android:value="safe" />',
  `<meta-data android:name="${MANAGER_PLAY_INTEGRITY_METADATA_NAME}" android:value="${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${PROJECT}" />`,
);
assert.throws(
  () => assertManagerPlayIntegrityManifestSource(nested, PROJECT),
  /exactly one exact Play Integrity/,
);

const compiled = parseCompiledAndroidApplicationMetadata(`E: manifest
  A: package="org.memphiszoo.ops" (Raw: "org.memphiszoo.ops")
  A: http://schemas.android.com/apk/res/android:versionCode(0x0101021b)=(type 0x10)0xb
  A: http://schemas.android.com/apk/res/android:versionName(0x0101021c)="2.0.0" (Raw: "2.0.0")
  E: uses-sdk
    A: http://schemas.android.com/apk/res/android:minSdkVersion(0x0101020c)=(type 0x10)0x1f
    A: http://schemas.android.com/apk/res/android:targetSdkVersion(0x01010270)=(type 0x10)0x24
  E: application
    E: meta-data
      A: http://schemas.android.com/apk/res/android:name(0x01010003)="${MANAGER_PLAY_INTEGRITY_METADATA_NAME}" (Raw: "${MANAGER_PLAY_INTEGRITY_METADATA_NAME}")
      A: http://schemas.android.com/apk/res/android:value(0x01010024)="${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${PROJECT}" (Raw: "${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${PROJECT}")
`);
assert.equal(
  compiled[MANAGER_PLAY_INTEGRITY_METADATA_NAME],
  `${MANAGER_PLAY_INTEGRITY_METADATA_PREFIX}${PROJECT}`,
);

console.log('Manager Android manifest configuration contract tests passed.');
