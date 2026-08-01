#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import {
  CUSTODIAL_GENERATED_APP_TEST_OVERLAY,
  CUSTODIAL_NATIVE_VAULT_CLASS,
  assertGeneratedCustodialMainActivity,
  assertGeneratedCustodialPluginManifest,
  configureCustodialGeneratedAppGradleSource,
} from './configure-custodial-generated-app-test.mjs';

const [
  configuration,
  overlay,
  appTest,
  pluginRuntimeTest,
  pluginGradle,
  workflow,
  codemagic,
  mobilePackage,
  vaultPackage,
] = await Promise.all([
  readFile(new URL('./configure-custodial-generated-app-test.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./custodial-generated-app-test.gradle', import.meta.url), 'utf8'),
  readFile(
    new URL(
      '../native-tests/custodial-generated-app/src/androidTest/java/org/memphiszoo/custodial/vault/GeneratedCustodialNativeVaultTest.java',
      import.meta.url,
    ),
    'utf8',
  ),
  readFile(
    new URL(
      '../plugins/custodial-native-vault/android/src/androidTest/java/org/memphiszoo/custodial/vault/VaultAndroidRuntimeTest.java',
      import.meta.url,
    ),
    'utf8',
  ),
  readFile(new URL('../plugins/custodial-native-vault/android/build.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../../.github/workflows/android-test-apks.yml', import.meta.url), 'utf8'),
  readFile(new URL('../../codemagic.yaml', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../plugins/custodial-native-vault/package.json', import.meta.url), 'utf8'),
]);

const parsedVaultPackage = JSON.parse(vaultPackage);
assert.equal(parsedVaultPackage.exports['./package.json'], './package.json');
const require = createRequire(import.meta.url);
assert.match(
  require.resolve('@memphis-zoo/custodial-native-vault/package.json', {
    paths: [new URL('..', import.meta.url).pathname],
  }),
  /custodial-native-vault\/package\.json$/,
  'Capacitor CLI must be able to resolve the local plugin package manifest',
);

const generatedAppGradle = `apply plugin: 'com.android.application'

android {
    namespace = "org.memphiszoo.custodial"
    defaultConfig {
        applicationId "org.memphiszoo.custodial"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }
}
`;
const configured = configureCustodialGeneratedAppGradleSource(generatedAppGradle);
assert.equal(configured.split(CUSTODIAL_GENERATED_APP_TEST_OVERLAY).length - 1, 1);
assert.equal(configureCustodialGeneratedAppGradleSource(configured), configured);
assert.throws(
  () => configureCustodialGeneratedAppGradleSource(generatedAppGradle.replaceAll('org.memphiszoo.custodial', 'org.memphiszoo.ops')),
  /not the Custodial application/,
);
assert.throws(
  () => configureCustodialGeneratedAppGradleSource(`${configured}\n${CUSTODIAL_GENERATED_APP_TEST_OVERLAY}\n`),
  /occurs 2 times/,
);

assertGeneratedCustodialMainActivity(`package org.memphiszoo.custodial;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
`);
assert.throws(
  () => assertGeneratedCustodialMainActivity(`package org.memphiszoo.custodial;
public class MainActivity extends BridgeActivity { void x() { addPluginInstance(); } }
`),
  /unmodified Capacitor BridgeActivity|must not manually register/,
);

assertGeneratedCustodialPluginManifest([
  {
    pkg: '@memphis-zoo/custodial-native-vault',
    classpath: CUSTODIAL_NATIVE_VAULT_CLASS,
  },
]);
assert.throws(
  () => assertGeneratedCustodialPluginManifest([]),
  /registration counts are exact=0, package=0, class=0/,
);
assert.throws(
  () => assertGeneratedCustodialPluginManifest([
    {
      pkg: '@memphis-zoo/custodial-native-vault',
      classpath: CUSTODIAL_NATIVE_VAULT_CLASS,
    },
    {
      pkg: '@unexpected/native-vault-alias',
      classpath: CUSTODIAL_NATIVE_VAULT_CLASS,
    },
  ]),
  /class=2/,
);
assert.throws(
  () => assertGeneratedCustodialPluginManifest([
    {
      pkg: '@memphis-zoo/custodial-native-vault',
      classpath: CUSTODIAL_NATIVE_VAULT_CLASS,
    },
    {
      pkg: '@aparajita/capacitor-secure-storage',
      classpath: 'com.aparajita.capacitor.securestorage.SecureStorage',
    },
  ]),
  /retired SecureStorage plugin/,
);

for (const proof of [
  "classLoader.loadClass(\n    'com.android.build.api.dsl.ManagedVirtualDevice'",
  "register('pixel2Api35', managedVirtualDeviceType)",
  "managedDevice.device = 'Pixel 2'",
  'managedDevice.apiLevel = 35',
  "managedDevice.systemImageSource = 'aosp'",
  "managedDevice.setTestedAbi('x86_64')",
  "managedDevice.getTestedAbi() != 'x86_64'",
  'sourceCompatibility JavaVersion.VERSION_21',
  "java.setSrcDirs([new File(generatedAppTestRoot, 'src/androidTest/java')])",
  "candidate.name == 'pixel2Api35Setup'",
  'ManagedDeviceInstrumentationTestSetupTask',
  'setupTask.getTestedAbi()',
  "testedAbiInput.set('x86_64')",
  'testedAbiInput.disallowChanges()',
  'gradle.projectsEvaluated',
  "setupTaskNames.size() != 1",
  "project.tasks.named('pixel2Api35Setup').get()",
  "setupTask.getTestedAbi().getOrNull() != 'x86_64'",
]) assert.ok(overlay.includes(proof), `Managed generated-app overlay is missing ${proof}`);
assert.doesNotMatch(
  overlay,
  /java\.srcDir\s+new File\(generatedAppTestRoot/,
  'Generated app acceptance must replace, not append to, Capacitor Android test sources',
);
assert.doesNotMatch(
  overlay,
  /^import\s+com\.android\.build\.api\.dsl\.ManagedVirtualDevice\s*$/m,
  'Applied Gradle scripts must not rely on the Android plugin compile classpath',
);

for (const proof of [
  'getPlugin(CUSTODIAL_PLUGIN_ID)',
  'MainActivity.class.getDeclaredMethods().length',
  'handle.getInstance()',
  'getDeclaredField(name)',
  'window.Capacitor.Plugins.CustodialNativeVault',
  'authorizedRequest',
  'evaluateJavascript',
  'assertFalse(serialized.contains(CREDENTIAL))',
  'CREDENTIAL.getBytes(StandardCharsets.UTF_8)',
  'assertFalse(state.has("device_credential"))',
]) assert.ok(appTest.includes(proof), `Generated-app instrumentation is missing ${proof}`);
assert.doesNotMatch(appTest, /BridgeSmokeActivity|addPluginInstance/);
assert.match(configuration, /assertGeneratedCustodialPluginManifest/);
assert.match(configuration, /assertGeneratedCustodialMainActivity/);
for (const proof of [
  'actualSharedPreferencesFailBeforeStageCommitCompensatesWithoutOrphan',
  'actualSharedPreferencesWriteThenFailUsesExactReadbackWithoutCompensation',
  'registeredCapacitorBridgeExecutesAuthenticatedPluginWithoutCredentialExposure',
]) assert.ok(pluginRuntimeTest.includes(proof), `Standalone plugin runtime suite is missing ${proof}`);
for (const proof of [
  'pixel2Api35',
  'apiLevel = 35',
  'systemImageSource = "aosp"',
  'setTestedAbi("x86_64")',
  'getTestedAbi() != "x86_64"',
  "candidate.name == 'pixel2Api35Setup'",
  'ManagedDeviceInstrumentationTestSetupTask',
  'setupTask.getTestedAbi()',
  "testedAbiInput.set('x86_64')",
  'testedAbiInput.disallowChanges()',
  'gradle.projectsEvaluated',
  "setupTaskNames.size() != 1",
  "project.tasks.named('pixel2Api35Setup').get()",
  "setupTask.getTestedAbi().getOrNull() != 'x86_64'",
]) assert.ok(pluginGradle.includes(proof), `Standalone plugin managed-device configuration is missing ${proof}`);

for (const proof of [
  'custodial-native-generated-app:',
  "system-images;android-35;default;x86_64",
  'configure-custodial-generated-app-test.mjs',
  'testDebugUnitTest assembleDebugAndroidTest pixel2Api35DebugAndroidTest',
  ':app:assembleDebugAndroidTest :app:pixel2Api35DebugAndroidTest',
  '--dependency-verification strict',
]) assert.ok(workflow.includes(proof), `Android CI is missing generated-app proof ${proof}`);
const connectedDeviceTask = new RegExp(['connected', 'Android', 'Test'].join(''));
assert.doesNotMatch(workflow, connectedDeviceTask);
const ordinaryArtifactJob = workflow.match(/^  build:\n([\s\S]*?)(?=^  custodial-native-generated-app:)/m)?.[0] || '';
assert.doesNotMatch(ordinaryArtifactJob, /custodial-generated-app-test|pixel2Api35/);
assert.doesNotMatch(codemagic, /custodial-generated-app-test|pixel2Api35/);
assert.match(mobilePackage, /custodial-generated-app-test-contracts\.mjs/);

console.log('Custodial generated-app managed-emulator contracts passed.');
