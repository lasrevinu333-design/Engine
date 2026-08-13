import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CUSTODIAL_ANDROID_COMPILED_APPLICATION_ATTRIBUTE_POLICY,
  CUSTODIAL_ANDROID_COMPONENT_POLICY,
  CUSTODIAL_ANDROID_COMPONENTS,
  CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION,
  CUSTODIAL_ANDROID_PACKAGE,
  CUSTODIAL_ANDROID_PERMISSIONS,
  CUSTODIAL_ANDROID_USES_LIBRARIES,
  assertCompiledCustodialAndroidManifestSecurity,
  assertCustodialAndroidManifestSecuritySource,
  assertCustodialAndroidSecurityResourcesSource,
  configureCustodialAndroidManifestSecuritySource,
  custodialFileProviderPaths,
  custodialNetworkSecurityConfig,
} from '../mobile/scripts/custodial-android-manifest-security.mjs';

const resourceReference = '@0x7f0f0001';
const networkResourceId = '0x7f110001';
const filePathsResourceId = '0x7f110002';
const capacitorWebChromeClientSource = readFileSync(new URL(
  '../node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeWebChromeClient.java',
  import.meta.url,
), 'utf8');
assert.equal(
  [...capacitorWebChromeClientSource.matchAll(/getPackageName\(\) \+ "\.fileprovider"/g)].length,
  1,
  'the pinned Capacitor WebView camera bridge must retain the reviewed FileProvider authority',
);
assert.equal(
  [...capacitorWebChromeClientSource.matchAll(/getExternalFilesDir\(Environment\.DIRECTORY_PICTURES\)/g)].length,
  1,
  'the pinned Capacitor WebView camera bridge must retain the reviewed app-specific Pictures root',
);
assert.match(
  capacitorWebChromeClientSource,
  /Manifest\.permission\.ACCESS_COARSE_LOCATION, Manifest\.permission\.ACCESS_FINE_LOCATION/,
  'the pinned Capacitor WebView bridge must request both Android location permissions for navigator.geolocation',
);
assert.match(
  capacitorWebChromeClientSource,
  /permissionLauncher\.launch\(geoPermissions\)/,
  'the pinned Capacitor WebView bridge must launch the native location permission request',
);

function materialize(value) {
  if (value instanceof RegExp) return resourceReference;
  if (Array.isArray(value)) return value.map(materialize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, materialize(child)]));
}

function node(name, attributes = {}, children = []) {
  return { name, attributes, children, text: [] };
}

function materializedPolicyNode(policy) {
  return node(
    policy.name,
    materialize(policy.attributes),
    (policy.children || []).map(materializedPolicyNode),
  );
}

function compiledFixtureTree() {
  const applicationAttributes = materialize(CUSTODIAL_ANDROID_COMPILED_APPLICATION_ATTRIBUTE_POLICY);
  applicationAttributes['android:networkSecurityConfig'] = `@${networkResourceId}`;
  applicationAttributes['android:fullBackupContent'] = '@0x7f110003';
  applicationAttributes['android:dataExtractionRules'] = '@0x7f110004';
  const components = ['activity', 'provider', 'service', 'receiver']
    .flatMap((type) => Object.values(CUSTODIAL_ANDROID_COMPONENT_POLICY[type]).map(materializedPolicyNode));
  const fileProvider = components.find((entry) => (
    entry.name === 'provider'
    && entry.attributes['android:name'] === 'androidx.core.content.FileProvider'
  ));
  fileProvider.children[0].attributes['android:resource'] = `@${filePathsResourceId}`;
  const application = node('application', applicationAttributes, [
    ...components,
    ...CUSTODIAL_ANDROID_USES_LIBRARIES.map((name) => node('uses-library', {
      'android:name': name,
      'android:required': 'false',
    })),
    node('meta-data', {
      'android:name': 'com.google.android.gms.version',
      'android:value': resourceReference,
    }),
  ]);
  return node('manifest', {
    'android:versionCode': '16',
    'android:versionName': '1.0.0',
    'android:compileSdkVersion': '36',
    'android:compileSdkVersionCodename': '16',
    package: CUSTODIAL_ANDROID_PACKAGE,
    platformBuildVersionCode: '36',
    platformBuildVersionName: '16',
  }, [
    node('uses-sdk', {
      'android:minSdkVersion': '26',
      'android:targetSdkVersion': '36',
    }),
    ...CUSTODIAL_ANDROID_PERMISSIONS.map((name) => node('uses-permission', {
      'android:name': name,
    })),
    node('permission', {
      'android:name': `${CUSTODIAL_ANDROID_PACKAGE}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
      'android:protectionLevel': '0x00000002',
    }),
    application,
  ]);
}

function dumpTree(root, indent = 0) {
  const padding = ' '.repeat(indent);
  const lines = [`${padding}E: ${root.name}`];
  for (const [name, value] of Object.entries(root.attributes)) {
    lines.push(`${padding}  A: ${name}="${value}" (Raw: "${value}")`);
  }
  for (const child of root.children) lines.push(dumpTree(child, indent + 2));
  for (const text of root.text || []) lines.push(`${padding}  T: "${text}"`);
  return lines.join('\n');
}

const compiledResourcesDump = `
resource ${networkResourceId} xml/memphis_zoo_network_security_config
  () (file) res/NS.xml type=XML
resource ${filePathsResourceId} xml/file_paths
  () (file) res/FP.xml type=XML
resource 0x7f110003 xml/memphis_zoo_backup_rules
  () (file) res/BK.xml type=XML
resource 0x7f110004 xml/memphis_zoo_data_extraction_rules
  () (file) res/DE.xml type=XML
`;

const networkTree = node('network-security-config', {}, [
  node('base-config', { cleartextTrafficPermitted: 'false' }, [
    node('trust-anchors', {}, [node('certificates', { src: 'system' })]),
  ]),
]);
const filePathsTree = node('paths', {}, [
  node('external-files-path', {
    name: 'custodial_webview_capture',
    path: 'Pictures/',
  }),
]);

function clone(value) {
  return structuredClone(value);
}

function compiledProof({ manifest = compiledFixtureTree(), resources = compiledResourcesDump, network = networkTree, paths = filePathsTree } = {}) {
  return assertCompiledCustodialAndroidManifestSecurity({
    manifestDump: dumpTree(manifest),
    resourcesDump: resources,
    networkSecurityDump: dumpTree(network),
    fileProviderPathsDump: dumpTree(paths),
  });
}

const generatedManifestInput = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application
      android:usesCleartextTraffic="true"
      android:networkSecurityConfig="@xml/unreviewed_network_security">
    <activity android:name=".MainActivity" />
  </application>
</manifest>
`;
const hardenedManifest = configureCustodialAndroidManifestSecuritySource(generatedManifestInput);
assertCustodialAndroidManifestSecuritySource(hardenedManifest);
assert.equal(
  configureCustodialAndroidManifestSecuritySource(hardenedManifest),
  hardenedManifest,
  'Custodial Android manifest security configuration must be idempotent',
);
assert.match(hardenedManifest, /android:usesCleartextTraffic="false"/);
assert.match(hardenedManifest, /android:networkSecurityConfig="@xml\/memphis_zoo_network_security_config"/);
assert.match(hardenedManifest, /<uses-permission android:name="android\.permission\.ACCESS_COARSE_LOCATION" \/>/);
assert.match(hardenedManifest, /<uses-permission android:name="android\.permission\.ACCESS_FINE_LOCATION" \/>/);
assert.match(hardenedManifest, /<uses-permission android:name="android\.permission\.NFC" \/>/);
assert.match(
  hardenedManifest,
  /\n  <uses-permission android:name="android\.permission\.ACCESS_COARSE_LOCATION" \/>\n  <uses-permission android:name="android\.permission\.ACCESS_FINE_LOCATION" \/>\n  <uses-permission android:name="android\.permission\.NFC" \/>\n  <application/,
);
assert.doesNotMatch(hardenedManifest, /android:extractNativeLibs=/);
assert.doesNotMatch(hardenedManifest, /unreviewed_network_security|usesCleartextTraffic="true"/);
assert.throws(
  () => assertCustodialAndroidManifestSecuritySource(
    hardenedManifest.replace(/\s*<uses-permission android:name="android\.permission\.ACCESS_FINE_LOCATION" \/>/, ''),
  ),
  /ACCESS_FINE_LOCATION exactly once/,
);
assert.throws(
  () => assertCustodialAndroidManifestSecuritySource(
    hardenedManifest.replace(/\s*<uses-permission android:name="android\.permission\.NFC" \/>/, ''),
  ),
  /NFC exactly once/,
);
assert.throws(
  () => configureCustodialAndroidManifestSecuritySource(
    hardenedManifest.replace(
      '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
      '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    ),
  ),
  /ACCESS_COARSE_LOCATION more than once/,
);
assert.throws(
  () => configureCustodialAndroidManifestSecuritySource(
    hardenedManifest.replace(
      '<uses-permission android:name="android.permission.NFC" />',
      '<uses-permission android:name="android.permission.NFC" />\n    <uses-permission android:name="android.permission.NFC" />',
    ),
  ),
  /NFC more than once/,
);
assert.throws(
  () => assertCustodialAndroidManifestSecuritySource(
    hardenedManifest.replace(
      '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
      '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="34" />',
    ),
  ),
  /ACCESS_FINE_LOCATION contains unreviewed attributes/,
);
assert.throws(
  () => assertCustodialAndroidManifestSecuritySource(
    hardenedManifest.replace(
      '<uses-permission android:name="android.permission.NFC" />',
      '<uses-permission android:name="android.permission.NFC" android:maxSdkVersion="35" />',
    ),
  ),
  /NFC contains unreviewed attributes/,
);
assert.throws(
  () => configureCustodialAndroidManifestSecuritySource(
    generatedManifestInput.replace('<manifest ', '<manifest android:sharedUserId="attacker" '),
  ),
  /shared user ID/,
);
assert.throws(
  () => configureCustodialAndroidManifestSecuritySource(
    generatedManifestInput.replace('<application', '<application android:requestLegacyExternalStorage="true"'),
  ),
  /prohibited source manifest attribute/,
);
assert.throws(
  () => configureCustodialAndroidManifestSecuritySource(
    generatedManifestInput.replace('<application', '<application android:extractNativeLibs="false"'),
  ),
  /prohibited source manifest attribute/,
  'AGP packaging must remain the authority for extractNativeLibs',
);
assert.throws(
  () => configureCustodialAndroidManifestSecuritySource(
    generatedManifestInput.replace('</manifest>', '<application></application></manifest>'),
  ),
  /exactly one application/,
);
assertCustodialAndroidSecurityResourcesSource({
  network: custodialNetworkSecurityConfig,
  fileProviderPaths: custodialFileProviderPaths,
});
assert.doesNotMatch(custodialNetworkSecurityConfig, /cleartextTrafficPermitted="true"|src="user"|domain-config/);
assert.doesNotMatch(custodialFileProviderPaths, /<external-path|external-cache-path|<cache-path|root-path|path="\."/);
assert.match(custodialFileProviderPaths, /<external-files-path name="custodial_webview_capture" path="Pictures\/" \/>/);
assert.throws(
  () => assertCustodialAndroidSecurityResourcesSource({
    network: custodialNetworkSecurityConfig.replace('src="system"', 'src="user"'),
    fileProviderPaths: custodialFileProviderPaths,
  }),
  /network security config differs/,
);
assert.throws(
  () => assertCustodialAndroidSecurityResourcesSource({
    network: custodialNetworkSecurityConfig,
    fileProviderPaths: custodialFileProviderPaths.replace(
      '</paths>',
      '  <external-path name="unsafe" path="." />\n</paths>',
    ),
  }),
  /FileProvider paths differ/,
);

export const custodialAndroidManifestSecurityProofFixture = compiledProof();
const proof = custodialAndroidManifestSecurityProofFixture;
assert.equal(proof.verifier_version, CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION);
assert.equal(proof.policy, 'exact-custodial-android-manifest-v4');
assert.deepEqual(proof.permissions, [...CUSTODIAL_ANDROID_PERMISSIONS].sort());
assert.deepEqual(proof.components.activities, [...CUSTODIAL_ANDROID_COMPONENTS.activities].sort());
assert.deepEqual(proof.components.services, [...CUSTODIAL_ANDROID_COMPONENTS.services].sort());
assert.deepEqual(proof.components.providers, [...CUSTODIAL_ANDROID_COMPONENTS.providers].sort());
assert.deepEqual(proof.components.receivers, [...CUSTODIAL_ANDROID_COMPONENTS.receivers].sort());
assert.deepEqual(proof.components.uses_libraries, [...CUSTODIAL_ANDROID_USES_LIBRARIES].sort());
assert.equal(proof.network_security.cleartext_permitted, false);
assert.deepEqual(proof.network_security.trust_anchors, ['system']);
assert.deepEqual(proof.file_provider.roots, [{
  type: 'external-files-path',
  name: 'custodial_webview_capture',
  path: 'Pictures/',
}]);
assert.match(proof.component_graph_semantic_sha256, /^[a-f0-9]{64}$/);

function mutated(mutator) {
  const manifest = compiledFixtureTree();
  mutator(manifest);
  return () => compiledProof({ manifest });
}

const applicationOf = (manifest) => manifest.children.find((entry) => entry.name === 'application');
const componentOf = (manifest, type, name) => applicationOf(manifest).children.find((entry) => (
  entry.name === type && entry.attributes['android:name'] === name
));

assert.throws(mutated((manifest) => {
  manifest.children.splice(1, 0, node('uses-permission', { 'android:name': 'android.permission.READ_SMS' }));
}), /permission set differs/);
assert.throws(mutated((manifest) => {
  const permission = manifest.children.find((entry) => entry.name === 'uses-permission');
  manifest.children.push(clone(permission));
}), /permission set differs/);
assert.throws(mutated((manifest) => {
  manifest.children.find((entry) => entry.name === 'permission').attributes['android:protectionLevel'] = '0x00000000';
}), /custom permission.*differs from policy/);
assert.throws(mutated((manifest) => {
  applicationOf(manifest).attributes['android:usesCleartextTraffic'] = 'true';
}), /usesCleartextTraffic differs from policy/);
assert.throws(mutated((manifest) => {
  applicationOf(manifest).attributes['android:requestLegacyExternalStorage'] = 'true';
}), /application attributes differ from policy/);
assert.throws(mutated((manifest) => {
  manifest.attributes['android:sharedUserId'] = 'org.attacker.shared';
}), /manifest attributes differ from policy/);
assert.throws(mutated((manifest) => {
  const activity = componentOf(manifest, 'activity', `${CUSTODIAL_ANDROID_PACKAGE}.MainActivity`);
  activity.children[1].attributes['android:autoVerify'] = 'true';
}), /intent-filter.*attributes differ from policy/);
assert.throws(mutated((manifest) => {
  const activity = componentOf(manifest, 'activity', `${CUSTODIAL_ANDROID_PACKAGE}.MainActivity`);
  activity.children[2].children.push(node('data', { 'android:scheme': 'http', 'android:host': 'attacker.example' }));
}), /intent-filter.*child graph differs from policy/);
assert.throws(mutated((manifest) => {
  const activity = componentOf(manifest, 'activity', `${CUSTODIAL_ANDROID_PACKAGE}.MainActivity`);
  activity.children[3].children[0].attributes['android:name'] = 'android.nfc.action.TAG_DISCOVERED';
}), /intent-filter\[3\]\/action\[0\].*differs from policy/);
assert.throws(mutated((manifest) => {
  applicationOf(manifest).children.push(node('activity', {
    'android:name': 'org.attacker.ExportedActivity',
    'android:exported': 'true',
  }));
}), /activity component set differs/);
assert.throws(mutated((manifest) => {
  componentOf(manifest, 'receiver', 'com.google.firebase.iid.FirebaseInstanceIdReceiver')
    .attributes['android:permission'] = 'android.permission.INTERNET';
}), /FirebaseInstanceIdReceiver android:permission differs from policy/);
assert.throws(mutated((manifest) => {
  componentOf(manifest, 'provider', 'androidx.core.content.FileProvider')
    .attributes['android:exported'] = 'true';
}), /FileProvider android:exported differs from policy/);
assert.throws(mutated((manifest) => {
  componentOf(manifest, 'provider', 'androidx.core.content.FileProvider')
    .attributes['android:authorities'] = 'org.attacker.files';
}), /FileProvider android:authorities differs from policy/);
assert.throws(mutated((manifest) => {
  componentOf(manifest, 'service', 'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService')
    .attributes['android:permission'] = 'android.permission.INTERNET';
}), /JobInfoSchedulerService android:permission differs from policy/);
assert.throws(mutated((manifest) => {
  const library = applicationOf(manifest).children.find((entry) => entry.name === 'uses-library');
  library.attributes['android:required'] = 'true';
}), /uses-library.*android:required differs from policy/);
assert.throws(mutated((manifest) => {
  applicationOf(manifest).children = applicationOf(manifest).children.filter((entry) => (
    entry.attributes['android:name'] !== 'androidx.window.sidecar'
  ));
}), /uses-library set differs/);
assert.throws(mutated((manifest) => {
  applicationOf(manifest).children.push(node('provider', {
    'android:name': 'org.attacker.CredentialProvider',
    'android:exported': 'false',
  }));
}), /provider component set differs/);
assert.throws(
  () => compiledProof({
    network: node('network-security-config', {}, [
      node('base-config', { cleartextTrafficPermitted: 'true' }, [
        node('trust-anchors', {}, [node('certificates', { src: 'system' })]),
      ]),
    ]),
  }),
  /cleartextTrafficPermitted differs from policy/,
);
assert.throws(
  () => compiledProof({
    network: node('network-security-config', {}, [
      node('base-config', { cleartextTrafficPermitted: 'false' }, [
        node('trust-anchors', {}, [node('certificates', { src: 'user' })]),
      ]),
    ]),
  }),
  /certificates.*src differs from policy/,
);
assert.throws(
  () => compiledProof({
    paths: node('paths', {}, [node('external-path', { name: 'unsafe', path: '.' })]),
  }),
  /FileProvider paths.*must be external-files-path/,
);
assert.throws(
  () => compiledProof({
    resources: compiledResourcesDump.replace(
      `resource ${networkResourceId} xml/memphis_zoo_network_security_config`,
      'resource 0x7f110099 xml/memphis_zoo_network_security_config',
    ),
  }),
  /does not bind to manifest reference/,
);
assert.throws(
  () => compiledProof({
    resources: compiledResourcesDump.replace(
      '  () (file) res/FP.xml type=XML',
      '  () (file) res/FP.xml type=XML\n  (v31) (file) res/FP31.xml type=XML',
    ),
  }),
  /one safe unqualified packaged file/,
);

console.log('CUSTODIAL_ANDROID_MANIFEST_SECURITY_CONTRACT_PASS');
