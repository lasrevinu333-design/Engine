import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCustodialCustodyEvidencePackage, summarizeCustodialCustodyReadiness } from './custodial-custody-evidence-package.mjs';

const snapshotRoot = '/home/eric/Documents/Codex/2026-10-07/task/parallel-ready-release-consumer-20261011-v1';
const tempRoot = mkdtempSync(join(tmpdir(), 'custody-receipt-semantics-'));
const receiptRoot = join(tempRoot, 'receipts');
mkdirSync(receiptRoot);
const piecePath = join(receiptRoot, 'SQL_FIRST_PIECE_PARTIAL_CHECKPOINT.json');
const componentsPath = join(receiptRoot, 'SQL_BOUNDED_PIECE_COMPONENTS_CHECKPOINT.json');
copyFileSync(join(snapshotRoot, 'SQL_FIRST_PIECE_PARTIAL_CHECKPOINT.json'), piecePath);
copyFileSync(join(snapshotRoot, 'SQL_BOUNDED_PIECE_COMPONENTS_CHECKPOINT.json'), componentsPath);

const sourcePair = {
  frontend: { commit: '22075c1650e288501b1ae6ec5d182b5c885f330c', tree: 'dd356fc1f7338534f8841da6f5a84e22651bd19d', ref: 'refs/heads/main' },
  backend: { commit: '1129f80ea71a3efbd57b6cd513d6795560cb5f94', tree: 'ac4e42b20ff1d7006d144b822cd78be38238fef5', ref: 'refs/heads/main' },
  manifest_sha256: '9c73d73ee9900af3046c8798c249d1c6da6868035c0ea336d18a37e4b162a76f',
};
const baseline = {
  package_name: 'org.memphiszoo.custodial', version_code: 29, version_name: '1.0.0', artifact_sha256: 'a'.repeat(64),
  signer_certificate_sha256: 'b'.repeat(64), signer_public_key_sha256: 'c'.repeat(64),
  source_commit: sourcePair.frontend.commit, source_tree: sourcePair.frontend.tree,
};
const pins = { package_name: baseline.package_name, signer_certificate_sha256: baseline.signer_certificate_sha256, signer_public_key_sha256: baseline.signer_public_key_sha256 };
const fileRef = (path) => { const bytes = readFileSync(path); return { path: path.split('/').pop(), sha256: createHash('sha256').update(bytes).digest('hex'), size_bytes: bytes.length }; };
const pieceFile = fileRef(piecePath);
const componentsFile = fileRef(componentsPath);

function trustedReceipt(file, disposition, scope = 'SOURCE_COMPATIBILITY') {
  return { path: file.path, sha256: file.sha256, source_pair: sourcePair, allowed_scope: scope, allowed_disposition: disposition };
}

function trusted(receiptBindings) {
  return { schema: 'custodial.custody-trusted-inputs.v1', source_pair: sourcePair, installed_baseline: baseline, signer_pins: pins, required_receipt_scopes: ['SOURCE_COMPATIBILITY'], trusted_receipts: receiptBindings };
}

function packageValue(receiptFile, kind = 'OWNER_PARTIAL') {
  return {
    schema: 'custodial.custody-evidence-package.v1', phase: 'PREBUILD_SOURCE', generated_at: '2026-10-11T01:05:58.138Z', source_pair: sourcePair, installed_baseline: baseline, candidate: null, recovery: null,
    receipts: [{ kind, scope: 'SOURCE_COMPATIBILITY', state: 'COMPLETE', observed_at: '2026-10-11T01:05:59.000Z', source_pair: sourcePair, receipt_file: receiptFile, witness: null }],
    physical_acceptance: { status: 'NOT_RUN', reason: 'No artifact, installation, or physical proof is supplied.' },
  };
}

function runCase(name, value, trustedValue, expected = /./) {
  const packagePath = join(tempRoot, `${name}.json`);
  writeFileSync(packagePath, JSON.stringify(value));
  return assert.throws(() => loadCustodialCustodyEvidencePackage({ packagePath, allowedReceiptRoot: receiptRoot, trustedSourcePair: sourcePair, trustedBaseline: baseline, trustedSignerPins: pins, trustedReceipts: trustedValue.trusted_receipts }), expected, name);
}

const pieceTrusted = trusted([trustedReceipt(pieceFile, 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE')]);
const piecePackage = packageValue(pieceFile);
const piecePackagePath = join(tempRoot, 'piece-package.json');
writeFileSync(piecePackagePath, JSON.stringify(piecePackage));
const loadedPiece = loadCustodialCustodyEvidencePackage({ packagePath: piecePackagePath, allowedReceiptRoot: receiptRoot, trustedSourcePair: sourcePair, trustedBaseline: baseline, trustedSignerPins: pins, trustedReceipts: pieceTrusted.trusted_receipts });
const pieceSummary = summarizeCustodialCustodyReadiness(loadedPiece, pieceTrusted);
assert.equal(pieceSummary.evidencePackageValid, true);
assert.equal(pieceSummary.sourceEvidenceStatus, 'INCOMPLETE');
assert.equal(pieceSummary.readiness.source, 'INCOMPLETE');
assert.match(pieceSummary.missingInputs.join('\n'), /SOURCE_COMPATIBILITY/);

const componentsTrusted = trusted([trustedReceipt(componentsFile, 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE')]);
const componentsPackagePath = join(tempRoot, 'components-package.json');
writeFileSync(componentsPackagePath, JSON.stringify(packageValue(componentsFile, 'OWNER_COMPONENTS')));
const loadedComponents = loadCustodialCustodyEvidencePackage({ packagePath: componentsPackagePath, allowedReceiptRoot: receiptRoot, trustedSourcePair: sourcePair, trustedBaseline: baseline, trustedSignerPins: pins, trustedReceipts: componentsTrusted.trusted_receipts });
assert.equal(summarizeCustodialCustodyReadiness(loadedComponents, componentsTrusted).sourceEvidenceStatus, 'INCOMPLETE');

const unknownPath = join(receiptRoot, 'unknown.json');
writeFileSync(unknownPath, JSON.stringify({ schema: 'owner.unknown.v1', status: 'COMPLETE' }));
const unknownFile = fileRef(unknownPath);
runCase('unknown-schema', packageValue(unknownFile, 'UNKNOWN'), trusted([trustedReceipt(unknownFile, 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE')]), /receipt schema is not/);

const forgedPath = join(receiptRoot, 'forged.json');
const forged = JSON.parse(readFileSync(piecePath));
forged.frontend.commit = '1'.repeat(40);
writeFileSync(forgedPath, JSON.stringify(forged));
const forgedFile = fileRef(forgedPath);
runCase('forged-source', packageValue(forgedFile, 'FORGED'), trusted([trustedReceipt(forgedFile, 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE')]), /source commit\/tree/);

runCase('contradictory-scope', piecePackage, trusted([trustedReceipt(pieceFile, 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE', 'ARTIFACT_ADMISSION')]), /scope is not independently allowed/);

console.log(JSON.stringify({ result: 'PASS', scope: 'new receipt-state adapter boundaries only', cases: 5, actual_owner_schemas: 2, wrapper_complete_promoted: false, artifact_install_physical_qualified: false }, null, 2));
