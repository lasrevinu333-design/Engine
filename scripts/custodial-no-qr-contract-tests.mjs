import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = {
  config: fs.readFileSync(new URL('../mobile/capacitor.config.ts', import.meta.url), 'utf8'),
  policy: fs.readFileSync(new URL('../mobile/scripts/custodial-capacitor-runtime-policy.mjs', import.meta.url), 'utf8'),
  package: fs.readFileSync(new URL('../mobile/package.json', import.meta.url), 'utf8'),
  setup: fs.readFileSync(new URL('../mobile/src/custodial/app.js', import.meta.url), 'utf8'),
  setupHtml: fs.readFileSync(new URL('../mobile/src/custodial/index.html', import.meta.url), 'utf8'),
  home: fs.readFileSync(new URL('../employee-hub.html', import.meta.url), 'utf8'),
};

for (const [name, source] of Object.entries(files)) {
  assert.doesNotMatch(source, /barcode-scanner|CapacitorBarcodeScanner|Scan Location QR|location QR code/i, `${name} must not retain employee QR capability`);
}

assert.doesNotMatch(files.config, /custodialPlugins[^\n]*barcode/i, 'Custodial includePlugins must exclude barcode scanning');
assert.doesNotMatch(files.policy, /CapacitorBarcodeScannerPlugin/, 'compiled Custodial plugin policy must reject barcode scanner DEX');

console.log('Custodial employee no-QR contracts: PASS');
