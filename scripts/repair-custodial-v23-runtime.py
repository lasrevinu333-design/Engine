from pathlib import Path
import json
import subprocess


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


config_path = Path('mobile/capacitor.config.ts')
config = config_path.read_text()
config = replace_once(
    config,
    "const custodialPlugins = ['@memphis-zoo/custodial-native-vault', '@capacitor-firebase/messaging', '@capacitor/app', '@capacitor/barcode-scanner', '@capacitor/local-notifications', '@capacitor/network', '@capacitor/status-bar'];",
    "const custodialPlugins = ['@memphis-zoo/custodial-native-vault', '@capacitor-firebase/messaging', '@capacitor/app', '@capacitor/local-notifications', '@capacitor/network', '@capacitor/status-bar'];",
    'Custodial Capacitor plugin allowlist',
)
config_path.write_text(config)

policy_path = Path('mobile/scripts/custodial-capacitor-runtime-policy.mjs')
policy = policy_path.read_text()
policy = replace_once(
    policy,
    "export const CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION = '1.0.0';",
    "export const CUSTODIAL_CAPACITOR_RUNTIME_POLICY_VERSION = '1.1.0';",
    'Custodial runtime policy version',
)
policy = replace_once(
    policy,
    """  {
    pkg: '@capacitor/barcode-scanner',
    classpath: 'com.capacitorjs.barcodescanner.CapacitorBarcodeScannerPlugin',
  },
""",
    '',
    'Custodial barcode plugin policy entry',
)
policy_path.write_text(policy)

contracts_path = Path('mobile/scripts/custodial-capacitor-runtime-policy-contracts.mjs')
contracts = contracts_path.read_text()
contracts = contracts.replace('CUSTODIAL_CAPACITOR_PLUGIN_PAIRS.length, 7', 'CUSTODIAL_CAPACITOR_PLUGIN_PAIRS.length, 6')
contracts = contracts.replace('proof.plugin_count, 7', 'proof.plugin_count, 6')
contracts = contracts.replace('exactly 7 entries', 'exactly 6 entries')
if 'exactly 7 entries' in contracts or 'plugin_count, 7' in contracts:
    raise SystemExit('Custodial plugin-count contract still expects seven plugins')
contracts_path.write_text(contracts)

package_path = Path('mobile/package.json')
package_text = package_path.read_text()
package_text = replace_once(
    package_text,
    '    "@capacitor/barcode-scanner": "3.1.0",\n',
    '',
    'unused barcode dependency',
)
package_path.write_text(package_text)
subprocess.run([
    'npm', 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund',
], check=True)

manifest_path = Path('mobile/scripts/custodial-android-manifest-security.mjs')
manifest = manifest_path.read_text()
manifest = replace_once(
    manifest,
    "export const CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION = '1.0.0';",
    "export const CUSTODIAL_ANDROID_MANIFEST_SECURITY_VERIFIER_VERSION = '1.1.0';",
    'Android manifest verifier version',
)
manifest = replace_once(manifest, "  'android.permission.CAMERA',\n", '', 'camera permission policy')
manifest = replace_once(manifest, "    'com.outsystems.plugins.barcode.view.OSBARCScannerActivity',\n", '', 'barcode activity summary')
manifest = replace_once(manifest, "    'androidx.camera.core.impl.MetadataHolderService',\n", '', 'CameraX service summary')
manifest = replace_once(manifest, "    'com.google.mlkit.common.internal.MlKitComponentDiscoveryService',\n", '', 'ML Kit service summary')
manifest = replace_once(manifest, "    'com.google.mlkit.common.internal.MlKitInitProvider',\n", '', 'ML Kit provider summary')
manifest = replace_once(
    manifest,
    """    'com.outsystems.plugins.barcode.view.OSBARCScannerActivity': policyNode('activity', {
      'android:theme': RESOURCE_REFERENCE,
      'android:name': 'com.outsystems.plugins.barcode.view.OSBARCScannerActivity',
      'android:exported': 'false',
    }),
""",
    '',
    'barcode activity policy',
)
manifest = replace_once(
    manifest,
    """    'androidx.camera.core.impl.MetadataHolderService': policyNode('service', {
      'android:name': 'androidx.camera.core.impl.MetadataHolderService',
      'android:enabled': 'false',
      'android:exported': 'false',
    }, [metadata(
      'androidx.camera.core.impl.MetadataHolderService.DEFAULT_CONFIG_PROVIDER',
      'android:value',
      'androidx.camera.camera2.Camera2Config$DefaultProvider',
    )]),
""",
    '',
    'CameraX service policy',
)
manifest = replace_once(
    manifest,
    """    'com.google.mlkit.common.internal.MlKitComponentDiscoveryService': policyNode('service', {
      'android:name': 'com.google.mlkit.common.internal.MlKitComponentDiscoveryService',
      'android:exported': 'false',
      'android:directBootAware': 'true',
    }, [
      metadata('com.google.firebase.components:com.google.mlkit.vision.barcode.internal.BarcodeRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
      metadata('com.google.firebase.components:com.google.mlkit.vision.common.internal.VisionCommonRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
      metadata('com.google.firebase.components:com.google.mlkit.common.internal.CommonComponentRegistrar', 'android:value', 'com.google.firebase.components.ComponentRegistrar'),
    ]),
""",
    '',
    'ML Kit discovery service policy',
)
manifest = replace_once(
    manifest,
    """    'com.google.mlkit.common.internal.MlKitInitProvider': policyNode('provider', {
      'android:name': 'com.google.mlkit.common.internal.MlKitInitProvider',
      'android:exported': 'false',
      'android:authorities': `${CUSTODIAL_ANDROID_PACKAGE}.mlkitinitprovider`,
      'android:initOrder': '99',
    }),
""",
    '',
    'ML Kit provider policy',
)
manifest = manifest.replace("policy: 'exact-custodial-android-manifest-v1'", "policy: 'exact-custodial-android-manifest-v2'")
manifest_path.write_text(manifest)

manifest_contract_path = Path('scripts/custodial-android-manifest-security-contract-tests.mjs')
manifest_contract = manifest_contract_path.read_text().replace(
    "assert.equal(proof.policy, 'exact-custodial-android-manifest-v1');",
    "assert.equal(proof.policy, 'exact-custodial-android-manifest-v2');",
)
manifest_contract_path.write_text(manifest_contract)

verifier_path = Path('mobile/scripts/verify-custodial-android-release.mjs')
verifier = verifier_path.read_text()
verifier = replace_once(
    verifier,
    "export const CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION = '5.0.0';",
    "export const CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION = '5.0.1';",
    'Custodial release verifier patch version',
)
verifier_path.write_text(verifier)

native_contract_path = Path('scripts/native-mobile-build-contract-tests.mjs')
native_contract = native_contract_path.read_text().replace(
    "assert.equal(CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION, '5.0.0');",
    "assert.equal(CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION, '5.0.1');",
)
native_contract_path.write_text(native_contract)

# Read the newly reviewed dynamic policy digests directly from the JS policy.
digest_result = subprocess.run([
    'node', '--input-type=module', '-e',
    "import {CUSTODIAL_CAPACITOR_PLUGIN_GRAPH_SHA256 as graph,CUSTODIAL_CAPACITOR_CONFIG_POLICY_SHA256 as config} from './mobile/scripts/custodial-capacitor-runtime-policy.mjs'; console.log(JSON.stringify({graph,config}));",
], check=True, capture_output=True, text=True)
digests = json.loads(digest_result.stdout.strip())

schema_path = Path('mobile/scripts/custodial-android-release-acceptance.schema.json')
schema = json.loads(schema_path.read_text())
manifest_schema = schema['properties']['android_manifest_security']['properties']
manifest_schema['verifier_version']['const'] = '1.1.0'
manifest_schema['policy']['const'] = 'exact-custodial-android-manifest-v2'
permissions = [
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.INTERNET',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.WAKE_LOCK',
    'com.google.android.c2dm.permission.RECEIVE',
    'org.memphiszoo.custodial.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
]
permission_schema = manifest_schema['permissions']
permission_schema['minItems'] = len(permissions)
permission_schema['maxItems'] = len(permissions)
permission_schema['prefixItems'] = [{'const': value} for value in permissions]
components_schema = manifest_schema['components']['properties']
component_values = {
    'activities': [
        'com.google.android.gms.common.api.GoogleApiActivity',
        'org.memphiszoo.custodial.MainActivity',
    ],
    'services': [
        'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery',
        'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService',
        'com.google.firebase.components.ComponentDiscoveryService',
        'com.google.firebase.messaging.FirebaseMessagingService',
        'io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService',
    ],
    'providers': [
        'androidx.core.content.FileProvider',
        'androidx.startup.InitializationProvider',
        'com.google.firebase.provider.FirebaseInitProvider',
    ],
}
for key, values in component_values.items():
    target = components_schema[key]
    target['minItems'] = len(values)
    target['maxItems'] = len(values)
    target['prefixItems'] = [{'const': value} for value in values]
native_schema = schema['properties']['native_security']['properties']
native_schema['plugin_count']['const'] = 6
native_schema['plugin_graph_sha256']['const'] = digests['graph']
native_schema['capacitor_config_policy_sha256']['const'] = digests['config']
schema_path.write_text(json.dumps(schema, indent=2) + '\n')

subprocess.run(['node', 'scripts/custodial-no-qr-contract-tests.mjs'], check=True)
subprocess.run(['node', 'mobile/scripts/custodial-capacitor-runtime-policy-contracts.mjs'], check=True)
subprocess.run(['node', 'scripts/custodial-android-manifest-security-contract-tests.mjs'], check=True)
subprocess.run(['node', 'scripts/native-mobile-build-contract-tests.mjs'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)
Path(__file__).unlink()
print('Removed QR scanning and its Android camera/ML Kit graph from Custodial.')
