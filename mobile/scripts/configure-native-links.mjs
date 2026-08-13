#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = resolve(dirname(scriptPath), '..');
const androidStart = '            <!-- MEMPHIS_ZOO_NATIVE_LINKS_START -->';
const androidEnd = '            <!-- MEMPHIS_ZOO_NATIVE_LINKS_END -->';
const iosStart = '\t<!-- MEMPHIS_ZOO_NATIVE_LINKS_START -->';
const iosEnd = '\t<!-- MEMPHIS_ZOO_NATIVE_LINKS_END -->';
const custodialMainActivity = `package org.memphiszoo.custodial;

import android.content.Intent;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.Tag;
import android.os.Bundle;
import android.os.Parcelable;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String VERIFIED_NFC_SCAN = "org.memphiszoo.custodial.VERIFIED_NFC_SCAN";

    private static boolean isPhysicalNdefIntent(Intent intent) {
        if (intent == null || !NfcAdapter.ACTION_NDEF_DISCOVERED.equals(intent.getAction())) return false;
        Uri data = intent.getData();
        Parcelable tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        Parcelable[] messages = intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);
        if (data == null || !(tag instanceof Tag) || messages == null || messages.length == 0) return false;
        for (Parcelable value : messages) {
            if (!(value instanceof NdefMessage)) continue;
            for (NdefRecord record : ((NdefMessage) value).getRecords()) {
                if (data.equals(record.toUri())) return true;
            }
        }
        return false;
    }

    private static Intent normalizeExternalIntent(Intent intent) {
        if (intent == null) return null;
        intent.removeExtra(VERIFIED_NFC_SCAN);
        if (isPhysicalNdefIntent(intent)) {
            intent.putExtra(VERIFIED_NFC_SCAN, true);
            intent.setAction(Intent.ACTION_VIEW);
        }
        return intent;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setIntent(normalizeExternalIntent(getIntent()));
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        Intent normalized = normalizeExternalIntent(intent);
        setIntent(normalized);
        super.onNewIntent(normalized);
    }
}
`;

const editions = {
  manager: {
    appIdentifier: 'org.memphiszoo.ops',
    scheme: 'memphiszoo-manager',
    customHosts: ['route', 'event'],
  },
  custodial: {
    appIdentifier: 'org.memphiszoo.custodial',
    scheme: 'memphiszoo-custodial',
    customHosts: ['route', 'event', 'scan'],
  },
  viewer: {
    appIdentifier: 'org.memphiszoo.viewer',
    scheme: 'memphiszoo-viewer',
    customHosts: ['route'],
  },
};

function definitionFor(edition) {
  const definition = editions[edition];
  if (!definition) throw new Error(`Unknown MZ_APP_EDITION "${edition}"`);
  return definition;
}

function replaceMarkedBlock(source, start, end, block) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex < 0 && endIndex < 0) return null;
  if (
    startIndex < 0
    || endIndex < startIndex
    || source.indexOf(start, startIndex + start.length) >= 0
    || source.indexOf(end, endIndex + end.length) >= 0
  ) {
    throw new Error('Native-link configuration markers are malformed');
  }
  return `${source.slice(0, startIndex)}${block}${source.slice(endIndex + end.length)}`;
}

function androidLinksBlock(edition, shellProof) {
  const definition = definitionFor(edition);
  const customData = shellProof ? definition.customHosts
    .map((host) => `                <data android:scheme="${definition.scheme}" android:host="${host}" />`)
    .join('\n')
    : '';
  const shellLinks = customData
    ? `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
${customData}
            </intent-filter>`
    : '';
  const custodialLinks = edition === 'custodial'
    ? `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="lasrevinu333-design.github.io" android:path="/Engine/" />
                <data android:scheme="https" android:host="lasrevinu333-design.github.io" android:pathPrefix="/Engine/index" />
                <data android:scheme="https" android:host="lasrevinu333-design.github.io" android:pathPrefix="/Engine/scan" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.nfc.action.NDEF_DISCOVERED" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="memphiszoo" android:host="scan" />
            </intent-filter>`
    : '';
  return `${androidStart}
${shellLinks}${custodialLinks}
${androidEnd}`;
}

export function configureAndroidManifestSource(source, edition, { shellProof = false } = {}) {
  const block = androidLinksBlock(edition, shellProof);
  const replaced = replaceMarkedBlock(source, androidStart, androidEnd, block);
  if (replaced != null) return replaced;
  const closingActivity = source.match(/\s*<\/activity>/g) || [];
  if (closingActivity.length !== 1) {
    throw new Error(`Android manifest must contain exactly one activity; found ${closingActivity.length}`);
  }
  return source.replace(/(\s*<\/activity>)/, `\n${block}$1`);
}

export function configureAndroidMainActivitySource(source, edition) {
  definitionFor(edition);
  const text = String(source || '').replaceAll('\r\n', '\n');
  if (edition !== 'custodial') return text;
  if (text === custodialMainActivity) return text;
  if (!/^package org\.memphiszoo\.custodial;\s+import com\.getcapacitor\.BridgeActivity;\s+public class MainActivity extends BridgeActivity\s*\{\s*\}\s*$/s.test(text)) {
    throw new Error('Custodial MainActivity differs from the reviewed Capacitor entrypoint');
  }
  return custodialMainActivity;
}

function iosLinksBlock(edition, shellProof) {
  const definition = definitionFor(edition);
  if (edition === 'custodial') {
    throw new Error('Custodial is Android-only and cannot configure iOS native links');
  }
  const schemes = shellProof ? [definition.scheme] : [];
  if (schemes.length === 0) return '';
  const schemeEntries = schemes.map((scheme) => `\t\t\t\t<string>${scheme}</string>`).join('\n');
  return `${iosStart}
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>CFBundleURLName</key>
			<string>${definition.appIdentifier}</string>
			<key>CFBundleURLSchemes</key>
			<array>
${schemeEntries}
			</array>
		</dict>
	</array>
${iosEnd}`;
}

export function configureIosInfoPlistSource(source, edition, { shellProof = false } = {}) {
  const block = iosLinksBlock(edition, shellProof);
  const replaced = replaceMarkedBlock(source, iosStart, iosEnd, block);
  if (replaced != null) return replaced;
  if (!block) return source;
  if (source.includes('<key>CFBundleURLTypes</key>')) {
    throw new Error('Generated iOS Info.plist already defines unreviewed URL types');
  }
  const finalDictionary = source.lastIndexOf('</dict>');
  if (finalDictionary < 0 || !/^\s*<\/plist>\s*$/.test(source.slice(finalDictionary + '</dict>'.length))) {
    throw new Error('Generated iOS Info.plist has an unexpected root structure');
  }
  return `${source.slice(0, finalDictionary)}${block}\n${source.slice(finalDictionary)}`;
}

async function main() {
  const platform = String(process.argv[2] || '').trim().toLowerCase();
  const edition = String(process.env.MZ_APP_EDITION || '').trim().toLowerCase();
  const shellProof = /^(1|true|yes)$/i.test(String(process.env.MZ_SHELL_START || ''));
  definitionFor(edition);
  if (platform === 'ios' && edition === 'custodial') {
    throw new Error('Custodial is Android-only and cannot configure iOS native links');
  }
  let path;
  let configure;
  if (platform === 'android') {
    path = join(mobileRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    configure = configureAndroidManifestSource;
  } else if (platform === 'ios') {
    path = join(mobileRoot, 'ios', 'App', 'App', 'Info.plist');
    configure = configureIosInfoPlistSource;
  } else {
    throw new Error('Usage: node scripts/configure-native-links.mjs <android|ios>');
  }
  const source = await readFile(path, 'utf8');
  await writeFile(path, configure(source, edition, { shellProof }));
  if (platform === 'android' && edition === 'custodial') {
    const mainActivityPath = join(
      mobileRoot,
      'android',
      'app',
      'src',
      'main',
      'java',
      ...definitionFor(edition).appIdentifier.split('.'),
      'MainActivity.java',
    );
    const mainActivity = await readFile(mainActivityPath, 'utf8');
    await writeFile(mainActivityPath, configureAndroidMainActivitySource(mainActivity, edition));
  }
  console.log(`Configured ${edition} ${platform} native links.`);
}

if (resolve(process.argv[1] || '') === scriptPath) {
  await main();
}
