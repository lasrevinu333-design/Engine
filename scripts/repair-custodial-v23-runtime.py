from pathlib import Path
import re
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
barcode_pair = """  {
    pkg: '@capacitor/barcode-scanner',
    classpath: 'com.capacitorjs.barcodescanner.CapacitorBarcodeScannerPlugin',
  },
"""
policy = replace_once(policy, barcode_pair, '', 'Custodial barcode plugin policy entry')
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
subprocess.run(['node', 'scripts/custodial-no-qr-contract-tests.mjs'], check=True)
subprocess.run(['node', 'mobile/scripts/custodial-capacitor-runtime-policy-contracts.mjs'], check=True)
subprocess.run(['node', 'scripts/native-mobile-build-contract-tests.mjs'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)
Path(__file__).unlink()
print('Removed QR scanning from the Custodial dependency and compiled plugin graph.')
