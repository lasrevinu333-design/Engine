#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');

export const CUSTODIAL_GENERATED_APP_TEST_OVERLAY =
  "apply from: rootProject.file('../scripts/custodial-generated-app-test.gradle')";
export const CUSTODIAL_GENERATED_APP_ID = 'org.memphiszoo.custodial';
export const CUSTODIAL_NATIVE_VAULT_PLUGIN_ID = 'CustodialNativeVault';
export const CUSTODIAL_NATIVE_VAULT_CLASS =
  'org.memphiszoo.custodial.vault.CustodialNativeVaultPlugin';

function occurrences(source, value) {
  return source.split(value).length - 1;
}

export function configureCustodialGeneratedAppGradleSource(source) {
  const text = String(source || '').replaceAll('\r\n', '\n');
  if (occurrences(text, "apply plugin: 'com.android.application'") !== 1) {
    throw new Error('Generated Android app Gradle file must apply the application plugin exactly once');
  }
  if (occurrences(text, `applicationId "${CUSTODIAL_GENERATED_APP_ID}"`) !== 1) {
    throw new Error('Generated Android app Gradle file is not the Custodial application');
  }
  if (occurrences(text, 'testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"') !== 1) {
    throw new Error('Generated Android app must use AndroidJUnitRunner exactly once');
  }
  const overlayCount = occurrences(text, CUSTODIAL_GENERATED_APP_TEST_OVERLAY);
  if (overlayCount > 1) {
    throw new Error(`Custodial generated-app test overlay occurs ${overlayCount} times`);
  }
  if (overlayCount === 1) return text;
  return `${text.replace(/\s*$/, '\n')}\n${CUSTODIAL_GENERATED_APP_TEST_OVERLAY}\n`;
}

export function assertGeneratedCustodialMainActivity(source) {
  const text = String(source || '').replaceAll('\r\n', '\n');
  if (!/^package org\.memphiszoo\.custodial;$/m.test(text)) {
    throw new Error('Generated MainActivity package is not the Custodial application package');
  }
  if (!/public class MainActivity extends BridgeActivity\s*\{\s*\}/s.test(text)) {
    throw new Error('Generated MainActivity must be the unmodified Capacitor BridgeActivity entrypoint');
  }
  if (/addPluginInstance|registerPlugin|CustodialNativeVaultPlugin/.test(text)) {
    throw new Error('Generated MainActivity must not manually register or inject the native vault plugin');
  }
  return true;
}

export function assertGeneratedCustodialPluginManifest(value) {
  if (!Array.isArray(value)) throw new Error('Generated Capacitor plugin manifest must be an array');
  const packageEntries = value.filter((entry) => entry?.pkg === '@memphis-zoo/custodial-native-vault');
  const classEntries = value.filter((entry) => entry?.classpath === CUSTODIAL_NATIVE_VAULT_CLASS);
  const expected = value.filter((entry) => (
    entry?.pkg === '@memphis-zoo/custodial-native-vault'
    && entry?.classpath === CUSTODIAL_NATIVE_VAULT_CLASS
  ));
  if (expected.length !== 1 || packageEntries.length !== 1 || classEntries.length !== 1) {
    throw new Error(
      `Generated Custodial native vault registration counts are exact=${expected.length}, package=${packageEntries.length}, class=${classEntries.length}`,
    );
  }
  if (value.some((entry) => (
    entry?.pkg === '@aparajita/capacitor-secure-storage'
    || entry?.classpath === 'com.aparajita.capacitor.securestorage.SecureStorage'
  ))) {
    throw new Error('Generated Custodial app test still registers the retired SecureStorage plugin');
  }
  return true;
}

async function main() {
  if (String(process.env.MZ_APP_EDITION || '').trim().toLowerCase() !== 'custodial') {
    throw new Error('MZ_APP_EDITION must be custodial for generated-app native-vault acceptance');
  }

  const appGradlePath = join(mobileRoot, 'android', 'app', 'build.gradle');
  const mainActivityPath = join(
    mobileRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    'org',
    'memphiszoo',
    'custodial',
    'MainActivity.java',
  );
  const pluginManifestPath = join(
    mobileRoot,
    'android',
    'app',
    'src',
    'main',
    'assets',
    'capacitor.plugins.json',
  );
  const testSourcePath = join(
    mobileRoot,
    'native-tests',
    'custodial-generated-app',
    'src',
    'androidTest',
    'java',
    'org',
    'memphiszoo',
    'custodial',
    'vault',
    'GeneratedCustodialNativeVaultTest.java',
  );
  const overlayPath = join(mobileRoot, 'scripts', 'custodial-generated-app-test.gradle');

  const [appGradle, mainActivity, pluginManifest, testSource, overlay] = await Promise.all([
    readFile(appGradlePath, 'utf8'),
    readFile(mainActivityPath, 'utf8'),
    readFile(pluginManifestPath, 'utf8'),
    readFile(testSourcePath, 'utf8'),
    readFile(overlayPath, 'utf8'),
  ]);

  assertGeneratedCustodialMainActivity(mainActivity);
  assertGeneratedCustodialPluginManifest(JSON.parse(pluginManifest));
  if (!testSource.includes('getPlugin(CUSTODIAL_PLUGIN_ID)') || !testSource.includes('evaluateJavascript')) {
    throw new Error('Generated-app acceptance must discover the plugin and execute its JavaScript boundary');
  }
  if (/BridgeSmokeActivity|addPluginInstance/.test(testSource)) {
    throw new Error('Generated-app acceptance must not use a manually injected bridge activity');
  }
  for (const proof of [
    "device = 'Pixel 2'",
    'apiLevel = 35',
    "systemImageSource = 'aosp'",
    "setTestedAbi('x86_64')",
    'sourceCompatibility JavaVersion.VERSION_21',
    "java.setSrcDirs([new File(generatedAppTestRoot, 'src/androidTest/java')])",
  ]) {
    if (!overlay.includes(proof)) throw new Error(`Generated-app managed-device configuration is missing: ${proof}`);
  }

  const configured = configureCustodialGeneratedAppGradleSource(appGradle);
  await writeFile(appGradlePath, configured);
  console.log('Configured clean Custodial generated-app managed-emulator acceptance.');
}

if (resolve(process.argv[1] || '') === scriptPath) await main();
