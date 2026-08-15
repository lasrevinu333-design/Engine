#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  compiledXmlResources,
  parseAaptXmlTree,
  resolveAapt2,
} from './verify-android-apk-backup.mjs';

export const CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION = '1.4.1';
export const CUSTODIAL_ANDROID_PACKAGE = 'org.memphiszoo.custodial';
export const CUSTODIAL_NETWORK_SECURITY_RESOURCE = 'memphis_zoo_network_security_config';
export const CUSTODIAL_FILE_PROVIDER_PATHS_RESOURCE = 'file_paths';

export const CUSTODIAL_ANDROID_PERMISSIONS = Object.freeze([
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.INTERNET',
  'android.permission.NFC',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'com.google.android.c2dm.permission.RECEIVE',
  `${CUSTODIAL_ANDROID_PACKAGE}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
]);

const CUSTODIAL_ANDROID_SOURCE_PERMISSIONS = Object.freeze([
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.NFC',
]);

export const CUSTODIAL_ANDROID_COMPONENTS = Object.freeze({
  activities: Object.freeze([
    `${CUSTODIAL_ANDROID_PACKAGE}.MainActivity`,
    'com.google.android.gms.common.api.GoogleApiActivity',
  ]),
  services: Object.freeze([
    'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery',
    'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService',
    'com.google.firebase.components.ComponentDiscoveryService',
    'com.google.firebase.messaging.FirebaseMessagingService',
    'io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService',
  ]),
  providers: Object.freeze([
    'androidx.core.content.FileProvider',
    'androidx.startup.InitializationProvider',
    'com.google.firebase.provider.FirebaseInitProvider',
  ]),
  receivers: Object.freeze([
    'androidx.profileinstaller.ProfileInstallReceiver',
    'com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver',
    'com.capacitorjs.plugins.localnotifications.NotificationDismissReceiver',
    'com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher',
    'com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver',
    'com.google.firebase.iid.FirebaseInstanceIdReceiver',
  ]),
});

// The reviewed Custodial dependency graph no longer packages the optional
// AndroidX Window extension/sidecar declarations that existed in Build 22.
// Keep this exact and empty so a future dependency cannot silently add a
// platform shared-library dependency to the production APK.
export const CUSTODIAL_ANDROID_USES_LIBRARIES = Object.freeze([]);

export const custodialNetworkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

// Capacitor's WebChromeClient uses the app-specific external-files Pictures
// directory for HTML file-input camera capture. The generated template exposes
// all shared external storage and the whole cache; this retains only the exact
// capture directory required by that bridge.
export const custodialFileProviderPaths = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <external-files-path name="custodial_webview_capture" path="Pictures/" />
</paths>
`;

const RESOURCE_REFERENCE = /^@0x[0-9a-f]+$/i;
export const CUSTODIAL_ANDROID_COMPILED_APPLICATION_ATTRIBUTE_POLICY = Object.freeze({
  'android:theme': RESOURCE_REFERENCE,
  'android:label': RESOURCE_REFERENCE,
  'android:icon': RESOURCE_REFERENCE,
  'android:allowBackup': 'false',
  'android:supportsRtl': 'true',
  'android:extractNativeLibs': 'false',
  'android:fullBackupContent': RESOURCE_REFERENCE,
  'android:roundIcon': RESOURCE_REFERENCE,
  'android:appComponentFactory': 'androidx.core.app.CoreComponentFactory',
  'android:dataExtractionRules': RESOURCE_REFERENCE,
  'android:usesCleartextTraffic': 'false',
  'android:networkSecurityConfig': RESOURCE_REFERENCE,
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value || {}).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} attributes differ from policy; expected ${wanted.join(', ') || '(none)'}, received ${actual.join(', ') || '(none)'}`);
  }
}

function assertExactAttributes(node, expected, label) {
  exactKeys(node.attributes, Object.keys(expected), label);
  for (const [name, wanted] of Object.entries(expected)) {
    const actual = node.attributes[name];
    if (wanted instanceof RegExp ? !wanted.test(actual) : actual !== wanted) {
      throw new Error(`${label} ${name} differs from policy; received ${actual ?? '(missing)'}`);
    }
  }
}

function assertEmptyNode(node, label) {
  if (node.children.length || node.text.length) throw new Error(`${label} must not contain child elements or text`);
}

function policyNode(name, attributes = {}, children = []) {
  return { name, attributes, children };
}

function assertPolicyNode(node, expected, label) {
  if (!node || node.name !== expected.name) {
    throw new Error(`${label} must be ${expected.name}; received ${node?.name || '(missing)'}`);
  }
  if (node.text.length) throw new Error(`${label} must not contain text`);
  assertExactAttributes(node, expected.attributes || {}, label);
  if (node.children.length !== (expected.children || []).length) {
    throw new Error(`${label} child graph differs from policy`);
  }
  for (let index = 0; index < node.children.length; index += 1) {
    assertPolicyNode(node.children[index], expected.children[index], `${label}/${expected.children[index].name}[${index}]`);
  }
}

const action = (name) => policyNode('action', { 'android:name': name });
const category = (name) => policyNode('category', { 'android:name': name });
const data = (attributes) => policyNode('data', attributes);
const intentFilter = (children, attributes = {}) => policyNode('intent-filter', attributes, children);
const metadata = (name, valueAttribute, value) => policyNode('meta-data', {
  'android:name': name,
  [valueAttribute]: value,
});

const MAIN_ACTIVITY_INTENT_FILTERS = Object.freeze([
  intentFilter([
    action('android.intent.action.MAIN'),
    category('android.intent.category.LAUNCHER'),
  ]),
  intentFilter([
    action('android.intent.action.VIEW'),
    category('android.intent.category.DEFAULT'),
    category('android.intent.category.BROWSABLE'),
    data({ 'android:scheme': 'memphiszoo-custodial', 'android:host': 'route' }),
    data({ 'android:scheme': 'memphiszoo-custodial', 'android:host': 'event' }),
    data({ 'android:scheme': 'memphiszoo-custodial', 'android:host': 'scan' }),
  ]),
  intentFilter([
    action('android.intent.action.VIEW'),
    category('android.intent.category.DEFAULT'),
    category('android.intent.category.BROWSABLE'),
    data({
      'android:scheme': 'https',
      'android:host': 'lasrevinu333-design.github.io',
      'android:path': '/Engine/',
    }),
    data({
      'android:scheme': 'https',
      'android:host': 'lasrevinu333-design.github.io',
      'android:pathPrefix': '/Engine/index',
    }),
    data({
      'android:scheme': 'https',
      'android:host': 'lasrevinu333-design.github.io',
      'android:pathPrefix': '/Engine/scan',
    }),
  ]),
  intentFilter([
    action('android.nfc.action.NDEF_DISCOVERED'),
    category('android.intent.category.DEFAULT'),
    data({ 'android:scheme': 'memphiszoo', 'android:host': 'scan' }),
  ]),
]);

export const CUSTODIAL_ANDROID_COMPONENT_POLICY = Object.freeze({
  activity: Object.freeze({
    [`${CUSTODIAL_ANDROID_PACKAGE}.MainActivity`]: policyNode('activity', {
      'android:theme': RESOURCE_REFERENCE,
      'android:label': RESOURCE_REFERENCE,
      'android:name': `${CUSTODIAL_ANDROID_PACKAGE}.MainActivity`,
      'android:exported': 'true',
      'android:launchMode': '2',
      'android:configChanges': '0x00001ff4',
    }, MAIN_ACTIVITY_INTENT_FILTERS),
    'com.google.android.gms.common.api.GoogleApiActivity': policyNode('activity', {
      'android:theme': '@0x01030010',
      'android:name': 'com.google.android.gms.common.api.GoogleApiActivity',
      'android:exported': 'false',
    }),
  }),
  service: Object.freeze({
    'io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService': policyNode('service', {
      'android:name': 'io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService',
      'android:exported': 'false',
    }, [intentFilter([action('com.google.firebase.MESSAGING_EVENT')])]),
    'com.google.firebase.messaging.FirebaseMessagingService': policyNode('service', {
      'android:name': 'com.google.firebase.messaging.FirebaseMessagingService',
      'android:exported': 'false',
      'android:directBootAware': 'true',
    }, [intentFilter([action('com.google.firebase.MESSAGING_EVENT')], { 'android:priority': '-500' })]),
    'com.google.firebase.components.ComponentDiscoveryService': policyNode('service', {
      'android:name': 'com.google.firebase.components.ComponentDiscoveryService',
      'android:exported': 'false',
      'android:directBootAware': 'true',
    }, [
      metadata('com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingKtxRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
      metadata('com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
      metadata('com.google.firebase.components:com.google.firebase.installations.FirebaseInstallationsKtxRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
      metadata('com.google.firebase.components:com.google.firebase.installations.FirebaseInstallationsRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
      metadata('com.google.firebase.components:com.google.firebase.FirebaseCommonKtxRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
      metadata('com.google.firebase.components:com.google.firebase.datatransport.TransportRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
    ]),
    'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery': policyNode('service', {
      'android:name': 'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery',
      'android:exported': 'false',
    }, [metadata('backend:com.google.android.datatransport.cct.CctBackendFactory', 'android:value', 'cct')]),
    'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService': policyNode('service', {
      'android:name': 'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService',
      'android:permission': 'android.permission.BIND_JOB_SERVICE',
      'android:exported': 'false',
    }),
  }),
  provider: Object.freeze({
    'androidx.core.content.FileProvider': policyNode('provider', {
      'android:name': 'androidx.core.content.FileProvider',
      'android:exported': 'false',
      'android:authorities': `${CUSTODIAL_ANDROID_PACKAGE}.fileprovider`,
      'android:grantUriPermissions': 'true',
    }, [metadata('android.support.FILE_PROVIDER_PATHS', 'android:resource', RESOURCE_REFERENCE)]),
    'com.google.firebase.provider.FirebaseInitProvider': policyNode('provider', {
      'android:name': 'com.google.firebase.provider.FirebaseInitProvider',
      'android:exported': 'false',
      'android:authorities': `${CUSTODIAL_ANDROID_PACKAGE}.firebaseinitprovider`,
      'android:initOrder': '100',
      'android:directBootAware': 'true',
    }),
    'androidx.startup.InitializationProvider': policyNode('provider', {
      'android:name': 'androidx.startup.InitializationProvider',
      'android:exported': 'false',
      'android:authorities': `${CUSTODIAL_ANDROID_PACKAGE}.androidx-startup`,
    }, [
      metadata('androidx.emoji2.text.EmojiCompatInitializer', 'android:value', 'androidx.startup'),
      metadata('androidx.lifecycle.ProcessLifecycleInitializer', 'android:value', 'androidx.startup'),
      metadata('androidx.profileinstaller.ProfileInstallerInitializer', 'android:value', 'androidx.startup'),
    ]),
  }),
  receiver: Object.freeze({
    'com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher': policyNode('receiver', {
      'android:name': 'com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher',
    }),
    'com.capacitorjs.plugins.localnotifications.NotificationDismissReceiver': policyNode('receiver', {
      'android:name': 'com.capacitorjs.plugins.localnotifications.NotificationDismissReceiver',
    }),
    'com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver': policyNode('receiver', {
      'android:name': 'com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver',
      'android:exported': 'false',
      'android:directBootAware': 'true',
    }, [intentFilter([
      action('android.intent.action.LOCKED_BOOT_COMPLETED'),
      action('android.intent.action.BOOT_COMPLETED'),
      action('android.intent.action.QUICKBOOT_POWERON'),
    ])]),
    'com.google.firebase.iid.FirebaseInstanceIdReceiver': policyNode('receiver', {
      'android:name': 'com.google.firebase.iid.FirebaseInstanceIdReceiver',
      'android:permission': 'com.google.android.c2dm.permission.SEND',
      'android:exported': 'true',
    }, [
      intentFilter([action('com.google.android.c2dm.intent.RECEIVE')]),
      metadata('com.google.android.gms.cloudmessaging.FINISHED_AFTER_HANDLED', 'android:value', 'true'),
    ]),
    'androidx.profileinstaller.ProfileInstallReceiver': policyNode('receiver', {
      'android:name': 'androidx.profileinstaller.ProfileInstallReceiver',
      'android:permission': 'android.permission.DUMP',
      'android:enabled': 'true',
      'android:exported': 'true',
      'android:directBootAware': 'false',
    }, [
      intentFilter([action('androidx.profileinstaller.action.INSTALL_PROFILE')]),
      intentFilter([action('androidx.profileinstaller.action.SKIP_FILE')]),
      intentFilter([action('androidx.profileinstaller.action.SAVE_PROFILE')]),
      intentFilter([action('androidx.profileinstaller.action.BENCHMARK_OPERATION')]),
    ]),
    'com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver': policyNode('receiver', {
      'android:name': 'com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver',
      'android:exported': 'false',
    }),
  }),
});

function applicationTag(source) {
  const matches = [...String(source).matchAll(/<application\b[^>]*>/g)];
  if (matches.length !== 1) {
    throw new Error(`Android manifest must contain exactly one application element; found ${matches.length}`);
  }
  if (matches[0][0].endsWith('/>')) throw new Error('Android application element must not be self-closing');
  return matches[0];
}

function setApplicationAttribute(tag, name, value) {
  const pattern = new RegExp(`\\s+android:${name}\\s*=\\s*(["'])[^"']*\\1`, 'g');
  const matches = [...tag.matchAll(pattern)];
  if (matches.length > 1) throw new Error(`Android application attribute android:${name} occurs more than once`);
  const replacement = `\n        android:${name}="${value}"`;
  return matches.length === 1
    ? tag.replace(pattern, replacement)
    : tag.replace(/>$/, `${replacement}>`);
}

function sourcePermissionTags(source, permission) {
  return [...String(source).matchAll(/<uses-permission\b[^>]*\/?\s*>/g)]
    .map((match) => match[0])
    .filter((tag) => {
      const name = tag.match(/\bandroid:name\s*=\s*(["'])([^"']+)\1/);
      return name?.[2] === permission;
    });
}

function assertExactSourcePermission(source, permission) {
  const tags = sourcePermissionTags(source, permission);
  if (tags.length !== 1) {
    throw new Error(`Custodial Android manifest must declare ${permission} exactly once`);
  }
  const escaped = permission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^<uses-permission\\s+android:name=(["'])${escaped}\\1\\s*/>$`).test(tags[0])) {
    throw new Error(`Custodial Android source permission ${permission} contains unreviewed attributes`);
  }
}

function configureCustodialLocationPermissions(source) {
  let configured = String(source);
  for (const permission of CUSTODIAL_ANDROID_SOURCE_PERMISSIONS) {
    const tags = sourcePermissionTags(configured, permission);
    if (tags.length > 1) {
      throw new Error(`Custodial Android manifest declares ${permission} more than once`);
    }
    if (tags.length === 0) {
      const application = applicationTag(configured);
      const lineStart = configured.lastIndexOf('\n', application.index) + 1;
      const indent = configured.slice(lineStart, application.index);
      const declaration = `${indent}<uses-permission android:name="${permission}" />\n`;
      configured = `${configured.slice(0, lineStart)}${declaration}${configured.slice(lineStart)}`;
    }
  }
  for (const permission of CUSTODIAL_ANDROID_SOURCE_PERMISSIONS) {
    assertExactSourcePermission(configured, permission);
  }
  return configured;
}

export function configureCustodialAndroidManifestSecuritySource(source) {
  const text = configureCustodialLocationPermissions(source);
  if (/<manifest\b[^>]*\bandroid:sharedUserId\s*=/.test(text)) {
    throw new Error('Custodial Android manifest must not declare a shared user ID');
  }
  const match = applicationTag(text);
  if (/\bandroid:(?:requestLegacyExternalStorage|debuggable|testOnly|extractNativeLibs)\s*=/.test(match[0])) {
    throw new Error('Custodial Android application contains a prohibited source manifest attribute');
  }
  let configured = match[0];
  for (const [name, value] of Object.entries({
    usesCleartextTraffic: 'false',
    networkSecurityConfig: `@xml/${CUSTODIAL_NETWORK_SECURITY_RESOURCE}`,
  })) configured = setApplicationAttribute(configured, name, value);
  return `${text.slice(0, match.index)}${configured}${text.slice(match.index + match[0].length)}`;
}

export function assertCustodialAndroidManifestSecuritySource(source) {
  const text = String(source);
  for (const permission of CUSTODIAL_ANDROID_SOURCE_PERMISSIONS) {
    assertExactSourcePermission(text, permission);
  }
  if (/<manifest\b[^>]*\bandroid:sharedUserId\s*=/.test(text)) {
    throw new Error('Custodial Android manifest must not declare a shared user ID');
  }
  const tag = applicationTag(text)[0];
  for (const [name, expected] of Object.entries({
    usesCleartextTraffic: 'false',
    networkSecurityConfig: `@xml/${CUSTODIAL_NETWORK_SECURITY_RESOURCE}`,
  })) {
    const pattern = new RegExp(`\\s+android:${name}\\s*=\\s*(["'])${expected.replaceAll('/', '\\/')}\\1`, 'g');
    if ([...tag.matchAll(pattern)].length !== 1) {
      throw new Error(`Custodial Android application must declare android:${name}="${expected}" exactly once`);
    }
  }
  if (/\bandroid:(?:requestLegacyExternalStorage|debuggable|testOnly|extractNativeLibs)\s*=/.test(tag)) {
    throw new Error('Custodial Android application contains a prohibited source manifest attribute');
  }
  return true;
}

export function assertCustodialAndroidSecurityResourcesSource({ network, fileProviderPaths }) {
  if (String(network).replaceAll('\r\n', '\n') !== custodialNetworkSecurityConfig) {
    throw new Error('Custodial Android network security config differs from the system-trust/no-cleartext policy');
  }
  if (String(fileProviderPaths).replaceAll('\r\n', '\n') !== custodialFileProviderPaths) {
    throw new Error('Custodial FileProvider paths differ from the cache-only policy');
  }
  return true;
}

function oneChild(node, name, label) {
  const matches = node.children.filter((child) => child.name === name);
  if (matches.length !== 1) throw new Error(`${label} must contain exactly one ${name}; found ${matches.length}`);
  return matches[0];
}

function resourceId(value, label) {
  const match = String(value || '').match(/^@(0x[0-9a-f]+)$/i);
  if (!match) throw new Error(`${label} must reference one compiled resource ID`);
  return match[1].toLowerCase();
}

function requiredCompiledXmlResource(resources, logicalName, expectedId) {
  const resource = resources.get(logicalName);
  if (!resource) throw new Error(`Compiled Custodial APK does not define xml/${logicalName}`);
  if (resource.id !== expectedId) {
    throw new Error(`Compiled xml/${logicalName} ${resource.id} does not bind to manifest reference ${expectedId}`);
  }
  if (
    resource.files.length !== 1
    || resource.files[0].configuration !== 'default'
    || !/^res\/[A-Za-z0-9._-]+\.xml$/.test(resource.files[0].path)
  ) {
    throw new Error(`Compiled xml/${logicalName} must have one safe unqualified packaged file`);
  }
  return resource;
}

function assertPermissions(root) {
  const permissionNodes = root.children.filter((child) => child.name === 'uses-permission');
  const permissions = permissionNodes.map((node, index) => {
    assertExactAttributes(node, { 'android:name': node.attributes['android:name'] }, `uses-permission[${index}]`);
    assertEmptyNode(node, `uses-permission[${index}]`);
    const name = String(node.attributes['android:name'] || '');
    if (!name) throw new Error('Compiled Custodial permission name is empty');
    return name;
  });
  const actual = [...new Set(permissions)].sort();
  const expected = [...CUSTODIAL_ANDROID_PERMISSIONS].sort();
  if (permissions.length !== actual.length || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Compiled Custodial permission set differs from the exact policy');
  }

  const declarations = root.children.filter((child) => child.name === 'permission');
  if (declarations.length !== 1) {
    throw new Error(`Compiled Custodial manifest must declare exactly one custom permission; found ${declarations.length}`);
  }
  assertPolicyNode(declarations[0], policyNode('permission', {
    'android:name': `${CUSTODIAL_ANDROID_PACKAGE}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
    'android:protectionLevel': '0x00000002',
  }), 'Custodial custom permission');
  return permissions.sort();
}

function assertComponents(application) {
  const componentTypes = ['activity', 'service', 'provider', 'receiver'];
  const proof = {};
  for (const type of componentTypes) {
    const nodes = application.children.filter((child) => child.name === type);
    const names = nodes.map((node) => String(node.attributes['android:name'] || ''));
    const unique = [...new Set(names)];
    const expectedNames = Object.keys(CUSTODIAL_ANDROID_COMPONENT_POLICY[type]);
    if (
      names.some((name) => !name)
      || names.length !== unique.length
      || JSON.stringify(unique.sort()) !== JSON.stringify([...expectedNames].sort())
    ) {
      throw new Error(`Compiled Custodial ${type} component set differs from the exact policy`);
    }
    for (const node of nodes) {
      assertPolicyNode(node, CUSTODIAL_ANDROID_COMPONENT_POLICY[type][node.attributes['android:name']], `${type} ${node.attributes['android:name']}`);
    }
    proof[`${type === 'activity' ? 'activities' : `${type}s`}`] = names.sort();
  }

  const libraries = application.children.filter((child) => child.name === 'uses-library');
  const libraryNames = libraries.map((node) => {
    assertPolicyNode(node, policyNode('uses-library', {
      'android:name': node.attributes['android:name'],
      'android:required': 'false',
    }), `uses-library ${node.attributes['android:name'] || '(missing)'}`);
    return node.attributes['android:name'];
  });
  if (
    libraryNames.length !== new Set(libraryNames).size
    || JSON.stringify([...libraryNames].sort()) !== JSON.stringify([...CUSTODIAL_ANDROID_USES_LIBRARIES].sort())
  ) {
    throw new Error('Compiled Custodial uses-library set differs from the exact policy');
  }

  const appMetadata = application.children.filter((child) => child.name === 'meta-data');
  if (appMetadata.length !== 1) throw new Error('Compiled Custodial application metadata set differs from policy');
  assertPolicyNode(appMetadata[0], metadata('com.google.android.gms.version', 'android:value', RESOURCE_REFERENCE), 'application Google Play services metadata');

  const allowedChildren = new Set([...componentTypes, 'uses-library', 'meta-data']);
  const unexpected = application.children.filter((child) => !allowedChildren.has(child.name));
  if (unexpected.length) {
    throw new Error(`Compiled Custodial application contains unexpected ${unexpected.map((node) => node.name).join(', ')}`);
  }
  return { ...proof, uses_libraries: libraryNames.sort() };
}

function assertNetworkSecurityConfig(root) {
  assertPolicyNode(root, policyNode('network-security-config', {}, [
    policyNode('base-config', { cleartextTrafficPermitted: 'false' }, [
      policyNode('trust-anchors', {}, [
        policyNode('certificates', { src: 'system' }),
      ]),
    ]),
  ]), 'Custodial network security config');
}

function assertFileProviderPaths(root) {
  assertPolicyNode(root, policyNode('paths', {}, [
    policyNode('external-files-path', {
      name: 'custodial_webview_capture',
      path: 'Pictures/',
    }),
  ]), 'Custodial FileProvider paths');
}

export function assertCompiledCustodialAndroidManifestSecurity({
  manifestDump,
  resourcesDump,
  networkSecurityDump,
  fileProviderPathsDump,
}) {
  const root = parseAaptXmlTree(manifestDump);
  if (root.name !== 'manifest') throw new Error('Compiled Custodial Android manifest has the wrong root element');
  if (root.text.length) throw new Error('Compiled Custodial Android manifest must not contain text');
  const expectedRootAttributes = [
    'android:compileSdkVersion',
    'android:compileSdkVersionCodename',
    'android:versionCode',
    'android:versionName',
    'package',
    'platformBuildVersionCode',
    'platformBuildVersionName',
  ];
  exactKeys(root.attributes, expectedRootAttributes, 'Compiled Custodial manifest');
  if (root.attributes.package !== CUSTODIAL_ANDROID_PACKAGE) {
    throw new Error(`Compiled Custodial manifest package must be ${CUSTODIAL_ANDROID_PACKAGE}`);
  }
  const allowedRootChildren = new Set(['uses-sdk', 'uses-permission', 'permission', 'application']);
  const unexpectedRootChildren = root.children.filter((child) => !allowedRootChildren.has(child.name));
  if (unexpectedRootChildren.length) {
    throw new Error(`Compiled Custodial manifest contains unexpected root ${unexpectedRootChildren.map((node) => node.name).join(', ')}`);
  }
  const usesSdk = oneChild(root, 'uses-sdk', 'Compiled Custodial manifest');
  assertPolicyNode(usesSdk, policyNode('uses-sdk', {
    'android:minSdkVersion': '26',
    'android:targetSdkVersion': '36',
  }), 'Compiled Custodial uses-sdk');
  const application = oneChild(root, 'application', 'Compiled Custodial manifest');
  assertExactAttributes(application, CUSTODIAL_ANDROID_COMPILED_APPLICATION_ATTRIBUTE_POLICY, 'Compiled Custodial application');
  if (application.text.length) throw new Error('Compiled Custodial application must not contain text');

  const permissions = assertPermissions(root);
  const components = assertComponents(application);
  const resources = compiledXmlResources(resourcesDump);

  const networkId = resourceId(application.attributes['android:networkSecurityConfig'], 'Custodial networkSecurityConfig');
  const networkResource = requiredCompiledXmlResource(resources, CUSTODIAL_NETWORK_SECURITY_RESOURCE, networkId);
  const networkRoot = parseAaptXmlTree(networkSecurityDump);
  assertNetworkSecurityConfig(networkRoot);

  const fileProvider = application.children.find((node) => (
    node.name === 'provider' && node.attributes['android:name'] === 'androidx.core.content.FileProvider'
  ));
  const fileProviderMetadata = oneChild(fileProvider, 'meta-data', 'Custodial FileProvider');
  const filePathsId = resourceId(fileProviderMetadata.attributes['android:resource'], 'Custodial FileProvider paths');
  const filePathsResource = requiredCompiledXmlResource(resources, CUSTODIAL_FILE_PROVIDER_PATHS_RESOURCE, filePathsId);
  const filePathsRoot = parseAaptXmlTree(fileProviderPathsDump);
  assertFileProviderPaths(filePathsRoot);

  return {
    verifier_version: CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION,
    policy: 'exact-custodial-android-manifest-v6',
    permissions,
    custom_permission: {
      name: `${CUSTODIAL_ANDROID_PACKAGE}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
      protection_level: 'signature',
    },
    components,
    main_activity_intent_filters_verified: true,
    uses_cleartext_traffic: false,
    extract_native_libs: false,
    shared_user_id_absent: true,
    legacy_external_storage_absent: true,
    network_security: {
      cleartext_permitted: false,
      trust_anchors: ['system'],
      logical_name: `xml/${CUSTODIAL_NETWORK_SECURITY_RESOURCE}`,
      packaged_path: networkResource.files[0].path,
      semantic_sha256: sha256(JSON.stringify(networkRoot)),
    },
    file_provider: {
      authority: `${CUSTODIAL_ANDROID_PACKAGE}.fileprovider`,
      exported: false,
      grant_uri_permissions: true,
      logical_name: `xml/${CUSTODIAL_FILE_PROVIDER_PATHS_RESOURCE}`,
      packaged_path: filePathsResource.files[0].path,
      roots: [{ type: 'external-files-path', name: 'custodial_webview_capture', path: 'Pictures/' }],
      semantic_sha256: sha256(JSON.stringify(filePathsRoot)),
    },
    component_graph_semantic_sha256: sha256(JSON.stringify({
      permissions,
      components,
      application,
    })),
  };
}

export function verifyCustodialAndroidManifestSecurity(apkPath, { aapt2Path } = {}) {
  const apk = resolve(apkPath);
  if (!existsSync(apk)) throw new Error(`APK does not exist: ${apk}`);
  const aapt2 = aapt2Path ? resolve(aapt2Path) : resolveAapt2();
  if (!existsSync(aapt2)) throw new Error(`Unable to execute aapt2: ${aapt2}`);
  const command = (args, maxBuffer = 32 * 1024 * 1024) => execFileSync(aapt2, args, {
    encoding: 'utf8',
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    maxBuffer,
    timeout: 120_000,
  });
  const manifestDump = command(['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml']);
  const resourcesDump = command(['dump', 'resources', apk], 64 * 1024 * 1024);
  const root = parseAaptXmlTree(manifestDump);
  const application = oneChild(root, 'application', 'Compiled Custodial manifest');
  const resources = compiledXmlResources(resourcesDump);
  const networkResource = requiredCompiledXmlResource(
    resources,
    CUSTODIAL_NETWORK_SECURITY_RESOURCE,
    resourceId(application.attributes['android:networkSecurityConfig'], 'Custodial networkSecurityConfig'),
  );
  const fileProvider = application.children.find((node) => (
    node.name === 'provider' && node.attributes['android:name'] === 'androidx.core.content.FileProvider'
  ));
  if (!fileProvider) throw new Error('Compiled Custodial APK is missing its FileProvider');
  const fileProviderMetadata = oneChild(fileProvider, 'meta-data', 'Custodial FileProvider');
  const filePathsResource = requiredCompiledXmlResource(
    resources,
    CUSTODIAL_FILE_PROVIDER_PATHS_RESOURCE,
    resourceId(fileProviderMetadata.attributes['android:resource'], 'Custodial FileProvider paths'),
  );
  const proof = assertCompiledCustodialAndroidManifestSecurity({
    manifestDump,
    resourcesDump,
    networkSecurityDump: command(['dump', 'xmltree', apk, '--file', networkResource.files[0].path]),
    fileProviderPathsDump: command(['dump', 'xmltree', apk, '--file', filePathsResource.files[0].path]),
  });
  return { apk, aapt2, ...proof };
}
