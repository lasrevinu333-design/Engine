#!/usr/bin/env node
import { resolve } from 'node:path';
import {
  loadCustodialCustodyEvidencePackage,
  loadTrustedInputsFile,
  summarizeCustodialCustodyReadiness,
} from './custodial-custody-evidence-package.mjs';

function usage() {
  console.error('Usage: check-custodial-custody-readiness.mjs --package <json> --receipt-root <owned-root> --trusted-inputs <json> --trusted-inputs-sha256 <sha256>');
}

const allowed = ['--package', '--receipt-root', '--trusted-inputs', '--trusted-inputs-sha256'];
const values = Object.create(null), args = process.argv.slice(2);
let valid = args.length === allowed.length * 2;
for (let i = 0; valid && i < args.length; i += 2) {
  const name = args[i], value = args[i + 1];
  if (!allowed.includes(name) || Object.hasOwn(values, name)
      || typeof value !== 'string' || !value.trim() || value.startsWith('--')) valid = false;
  else values[name] = value;
}
if (!valid || !allowed.every((name) => Object.hasOwn(values, name))) {
  usage();
  process.exitCode = 2;
} else {
  try {
    const trusted = loadTrustedInputsFile(values['--trusted-inputs'], values['--trusted-inputs-sha256']);
    const loaded = loadCustodialCustodyEvidencePackage({
      packagePath: resolve(values['--package']),
      allowedReceiptRoot: resolve(values['--receipt-root']),
      trustedSourcePair: trusted.source_pair,
      trustedBaseline: trusted.installed_baseline,
      trustedSignerPins: trusted.signer_pins,
      trustedReceipts: trusted.trusted_receipts,
    });
    const summary = summarizeCustodialCustodyReadiness(loaded, trusted);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exitCode = summary.missingInputs.length ? 1 : 0;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ evidencePackageValid: false, exactBindingsVerified: false, error: String(error?.message || error) }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
