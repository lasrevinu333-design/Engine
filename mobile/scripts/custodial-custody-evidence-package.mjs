import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { inspectCustodialOwnerReceipt } from './custodial-owner-receipt-adapter.mjs';

export const CUSTODY_EVIDENCE_SCHEMA = 'custodial.custody-evidence-package.v1';
export const TRUSTED_INPUTS_SCHEMA = 'custodial.custody-trusted-inputs.v1';
export const PHASES = Object.freeze(['PREBUILD_SOURCE', 'ARTIFACT_ADMISSION', 'POSTINSTALL_ACCEPTANCE']);
export const RECEIPT_STATES = Object.freeze(['COMPLETE', 'NOT_RUN', 'DEFERRED', 'FAILED']);
export const RECEIPT_SCOPES = Object.freeze([
  'SOURCE_COMPATIBILITY',
  'ARTIFACT_ADMISSION',
  'POSTINSTALL_ACCEPTANCE',
  'RETAINED_DATA_DRILL',
  'PHYSICAL_QUALIFICATION',
]);

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40,64}$/;
const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{1,254}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const IDENTITY_HASH_FIELDS = Object.freeze([
  'body_sha256',
  'attestation_sha256',
  'chunk_sha256',
  'frame_sha256',
]);
// Only this loader may mint a summary input. Caller-created/spread objects
// and mutable receipt arrays must never manufacture COMPLETE inspection.
const loadedPackages = new WeakSet();

function fail(message) {
  throw new Error(message);
}

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, allowed, label) {
  object(value, label);
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length) fail(`${label} contains unknown field(s): ${unknown.join(', ')}`);
}

function requiredKeys(value, required, label) {
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${label}.${key} is required`);
}

function string(value, label, pattern = null) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  if (pattern && !pattern.test(value)) fail(`${label} has an invalid format`);
  return value;
}

function nullableString(value, label, pattern = null) {
  if (value === null) return null;
  return string(value, label, pattern);
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(`${label} must be an integer >= ${minimum}`);
  return value;
}

function enumValue(value, choices, label) {
  if (!choices.includes(value)) fail(`${label} must be one of ${choices.join(', ')}`);
  return value;
}

function sha(value, label) {
  return string(value, label, SHA256);
}

function commit(value, label) {
  return string(value, label, COMMIT);
}

function timestamp(value, label) {
  string(value, label, UTC_TIMESTAMP);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail(`${label} is not a canonical UTC timestamp`);
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalJson(value) {
  return `${canonical(value)}\n`;
}

function same(left, right, label) {
  if (canonical(left) !== canonical(right)) fail(`${label} does not match independently trusted input`);
}

function regularOwnedFile(path, root, label) {
  const requested = String(path || '');
  if (!requested || isAbsolute(requested) || requested.split(/[\\/]/).includes('..')) {
    fail(`${label} must be a relative path without traversal`);
  }
  const rootReal = realpathSync(root);
  const absolute = resolve(rootReal, requested);
  if (relative(rootReal, absolute).startsWith('..')) fail(`${label} escapes its allowed root`);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be one regular non-symlink file`);
  if (realpathSync(absolute) !== absolute) fail(`${label} may not traverse a symlink`);
  return absolute;
}

function fileRef(value, root, label) {
  if (value === null) return null;
  exactKeys(value, ['path', 'sha256', 'size_bytes'], label);
  requiredKeys(value, ['path', 'sha256', 'size_bytes'], label);
  const path = string(value.path, `${label}.path`);
  const expectedSha = sha(value.sha256, `${label}.sha256`);
  const size = integer(value.size_bytes, `${label}.size_bytes`, 1);
  if (root) {
    const absolute = regularOwnedFile(path, root, `${label}.path`);
    const bytes = readFileSync(absolute);
    const actualSha = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== size || actualSha !== expectedSha) fail(`${label} bytes do not match its declared size/hash`);
  }
  return Object.freeze({ path, sha256: expectedSha, size_bytes: size });
}

function sourcePair(value, label) {
  exactKeys(value, ['frontend', 'backend', 'manifest_sha256'], label);
  requiredKeys(value, ['frontend', 'backend', 'manifest_sha256'], label);
  const part = (partValue, partLabel) => {
    exactKeys(partValue, ['commit', 'tree', 'ref'], partLabel);
    requiredKeys(partValue, ['commit', 'tree', 'ref'], partLabel);
    return Object.freeze({
      commit: commit(partValue.commit, `${partLabel}.commit`),
      tree: commit(partValue.tree, `${partLabel}.tree`),
      ref: string(partValue.ref, `${partLabel}.ref`, /^refs\/heads\/[A-Za-z0-9._/-]+$/),
    });
  };
  return Object.freeze({
    frontend: part(value.frontend, `${label}.frontend`),
    backend: part(value.backend, `${label}.backend`),
    manifest_sha256: sha(value.manifest_sha256, `${label}.manifest_sha256`),
  });
}

function baseline(value, label) {
  exactKeys(value, [
    'package_name', 'version_code', 'version_name', 'artifact_sha256',
    'signer_certificate_sha256', 'signer_public_key_sha256', 'source_commit', 'source_tree',
  ], label);
  requiredKeys(value, [
    'package_name', 'version_code', 'version_name', 'artifact_sha256',
    'signer_certificate_sha256', 'signer_public_key_sha256', 'source_commit', 'source_tree',
  ], label);
  return Object.freeze({
    package_name: string(value.package_name, `${label}.package_name`, PACKAGE_NAME),
    version_code: integer(value.version_code, `${label}.version_code`, 1),
    version_name: string(value.version_name, `${label}.version_name`),
    artifact_sha256: sha(value.artifact_sha256, `${label}.artifact_sha256`),
    signer_certificate_sha256: sha(value.signer_certificate_sha256, `${label}.signer_certificate_sha256`),
    signer_public_key_sha256: sha(value.signer_public_key_sha256, `${label}.signer_public_key_sha256`),
    source_commit: commit(value.source_commit, `${label}.source_commit`),
    source_tree: commit(value.source_tree, `${label}.source_tree`),
  });
}

function signerPins(value, label) {
  exactKeys(value, ['package_name', 'signer_certificate_sha256', 'signer_public_key_sha256'], label);
  requiredKeys(value, ['package_name', 'signer_certificate_sha256', 'signer_public_key_sha256'], label);
  return Object.freeze({
    package_name: string(value.package_name, `${label}.package_name`, PACKAGE_NAME),
    signer_certificate_sha256: sha(value.signer_certificate_sha256, `${label}.signer_certificate_sha256`),
    signer_public_key_sha256: sha(value.signer_public_key_sha256, `${label}.signer_public_key_sha256`),
  });
}

function descriptor(value, root, label) {
  if (value === null) return null;
  exactKeys(value, [
    'package_name', 'version_code', 'version_name', 'source_pair',
    'artifact', 'signer_certificate_sha256', 'signer_public_key_sha256', 'policy_sha256',
  ], label);
  requiredKeys(value, [
    'package_name', 'version_code', 'version_name', 'source_pair',
    'artifact', 'signer_certificate_sha256', 'signer_public_key_sha256', 'policy_sha256',
  ], label);
  exactKeys(value.artifact, ['path', 'sha256', 'size_bytes'], `${label}.artifact`);
  requiredKeys(value.artifact, ['path', 'sha256', 'size_bytes'], `${label}.artifact`);
  return Object.freeze({
    package_name: string(value.package_name, `${label}.package_name`, PACKAGE_NAME),
    version_code: integer(value.version_code, `${label}.version_code`, 1),
    version_name: string(value.version_name, `${label}.version_name`),
    source_pair: sourcePair(value.source_pair, `${label}.source_pair`),
    artifact: fileRef(value.artifact, root, `${label}.artifact`),
    signer_certificate_sha256: sha(value.signer_certificate_sha256, `${label}.signer_certificate_sha256`),
    signer_public_key_sha256: sha(value.signer_public_key_sha256, `${label}.signer_public_key_sha256`),
    policy_sha256: sha(value.policy_sha256, `${label}.policy_sha256`),
  });
}

function witness(value, label, required) {
  if (value === null) {
    if (required) fail(`${label} is required for a complete custody receipt`);
    return null;
  }
  exactKeys(value, [
    'operation_id', 'generation_id', 'request_id', 'body_sha256',
    'attestation_sha256', 'chunk_sha256', 'frame_sha256', 'record_id',
  ], label);
  requiredKeys(value, [
    'operation_id', 'generation_id', 'request_id', 'body_sha256',
    'attestation_sha256', 'chunk_sha256', 'frame_sha256', 'record_id',
  ], label);
  const result = {
    operation_id: string(value.operation_id, `${label}.operation_id`, SAFE_ID),
    generation_id: string(value.generation_id, `${label}.generation_id`, SAFE_ID),
    request_id: string(value.request_id, `${label}.request_id`, SAFE_ID),
    body_sha256: sha(value.body_sha256, `${label}.body_sha256`),
    attestation_sha256: sha(value.attestation_sha256, `${label}.attestation_sha256`),
    chunk_sha256: sha(value.chunk_sha256, `${label}.chunk_sha256`),
    frame_sha256: sha(value.frame_sha256, `${label}.frame_sha256`),
    record_id: string(value.record_id, `${label}.record_id`, SAFE_ID),
  };
  for (const field of IDENTITY_HASH_FIELDS) if (result[field] === null) fail(`${label}.${field} is required`);
  return Object.freeze(result);
}

// Context provenance comes ONLY from the caller's independent trusted receipt
// pin. Receipt JSON cannot select extra files or self-admit a new context.
function fixedG01Context(pin, root, receiptBytes, expectedPair, label) {
  if (!pin || !pin.owner_context_file) fail(`${label} G01 requires independently pinned owner context`);
  if (pin.allowed_scope !== 'SOURCE_COMPATIBILITY'
      || pin.allowed_disposition !== 'COMPONENT_COMPLETE_OVERALL_INCOMPLETE') {
    fail(`${label} G01 context is allowed only for an incomplete SOURCE component`);
  }
  same(pin.source_pair, expectedPair, `${label} owner context source pair`);
  const contextRef = fileRef(pin.owner_context_file, root, `${label}.owner_context_file`);
  const contextPath = regularOwnedFile(contextRef.path, root, `${label}.owner_context_file.path`);
  const contextBytes = readFileSync(contextPath);
  if (contextBytes.length > 1024 * 1024) fail(`${label} owner context exceeds its bounded metadata size`);
  if (contextBytes.length !== contextRef.size_bytes
      || createHash('sha256').update(contextBytes).digest('hex') !== contextRef.sha256) {
    fail(`${label} owner context changed during fixed reading`);
  }
  let declared;
  try { declared = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(contextBytes)); }
  catch { fail(`${label} owner context is not valid UTF8 JSON`); }
  const fields = ['schema', 'receipt', 'source_pair', 'underlying', 'original_tuple', 'source_window', 'scope', 'disposition'];
  exactKeys(declared, fields, `${label} owner context`);
  requiredKeys(declared, fields, `${label} owner context`);
  if (declared.schema !== 'custodial.G01-owner-receipt-trusted-context.v1') fail(`${label} owner context schema is unsupported`);
  exactKeys(declared.receipt, ['bytes', 'sha256'], `${label} context receipt`);
  requiredKeys(declared.receipt, ['bytes', 'sha256'], `${label} context receipt`);
  if (declared.receipt.sha256 !== pin.sha256 || declared.receipt.bytes !== receiptBytes.length) {
    fail(`${label} owner context cannot replace its external receipt pin`);
  }
  const contextPair = {
    frontend: { commit: pin.source_pair.frontend.commit, tree: pin.source_pair.frontend.tree },
    backend: { commit: pin.source_pair.backend.commit, tree: pin.source_pair.backend.tree },
  };
  same(declared.source_pair, contextPair, `${label} context declared source pair`);
  const underlyingNames = ['actual_result', 'result', 'cleanup_finish', 'launch'];
  exactKeys(declared.underlying, underlyingNames, `${label} context underlying`);
  requiredKeys(declared.underlying, underlyingNames, `${label} context underlying`);
  const underlying = {};
  for (const key of underlyingNames) {
    const entry = declared.underlying[key];
    exactKeys(entry, ['path', 'bytes', 'sha256', 'payload_file'], `${label} context.${key}`);
    requiredKeys(entry, ['path', 'bytes', 'sha256', 'payload_file'], `${label} context.${key}`);
    const ref = fileRef(entry.payload_file, root, `${label} context.${key}.payload_file`);
    if (entry.bytes !== ref.size_bytes || entry.sha256 !== ref.sha256) fail(`${label} underlying descriptor pin mismatch`);
    const payloadPath = regularOwnedFile(ref.path, root, `${label} context.${key}.payload_file.path`);
    const payload = readFileSync(payloadPath);
    if (payload.length > 2 * 1024 * 1024 || payload.length !== ref.size_bytes
        || createHash('sha256').update(payload).digest('hex') !== ref.sha256) {
      fail(`${label} underlying bytes changed during fixed reading or exceed bound`);
    }
    // path is provenance only; never read this absolute receipt-supplied path.
    underlying[key] = { path: entry.path, bytes: entry.bytes, sha256: entry.sha256, payload };
  }
  return { ...declared, underlying };
}

function receipt(value, root, label, independentlyPinnedReceipts) {
  exactKeys(value, ['kind', 'scope', 'state', 'observed_at', 'source_pair', 'receipt_file', 'witness'], label);
  requiredKeys(value, ['kind', 'scope', 'state', 'observed_at', 'source_pair', 'receipt_file', 'witness'], label);
  const kind = string(value.kind, `${label}.kind`, /^[A-Z][A-Z0-9_]{2,63}$/);
  const scope = enumValue(value.scope, RECEIPT_SCOPES, `${label}.scope`);
  const state = enumValue(value.state, RECEIPT_STATES, `${label}.state`);
  const witnessRequired = state === 'COMPLETE' && (scope === 'RETAINED_DATA_DRILL' || scope === 'POSTINSTALL_ACCEPTANCE');
  if (state === 'COMPLETE' && value.receipt_file === null) fail(`${label}.receipt_file is required for COMPLETE state`);
  if (state !== 'COMPLETE' && value.witness !== null) fail(`${label}.witness must be null unless state is COMPLETE`);
  const receiptFile = fileRef(value.receipt_file, root, `${label}.receipt_file`);
  let inspection = null;
  if (state === 'COMPLETE') {
    const receiptPath = regularOwnedFile(receiptFile.path, root, `${label}.receipt_file.path`);
    const bytes = readFileSync(receiptPath);
    if (bytes.length !== receiptFile.size_bytes
        || createHash('sha256').update(bytes).digest('hex') !== receiptFile.sha256) {
      fail(`${label} receipt changed during fixed reading`);
    }
    let schema;
    try { schema = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).schema; }
    catch { fail(`${label} receipt is not valid UTF8 JSON`); }
    let context;
    if (schema === 'custodial.G01-current-owning-complete-frame-source-proof.v1') {
      const pin = independentlyPinnedReceipts.find((entry) => entry.path === receiptFile.path && entry.sha256 === receiptFile.sha256);
      context = fixedG01Context(pin, root, bytes, value.source_pair, label);
    }
    inspection = inspectCustodialOwnerReceipt(bytes, value.source_pair, context);
  }
  return Object.freeze({
    kind,
    scope,
    state,
    observed_at: timestamp(value.observed_at, `${label}.observed_at`),
    source_pair: sourcePair(value.source_pair, `${label}.source_pair`),
    receipt_file: receiptFile,
    witness: witness(value.witness, `${label}.witness`, witnessRequired),
    inspection,
  });
}

function physicalAcceptance(value, label) {
  exactKeys(value, ['status', 'reason'], label);
  requiredKeys(value, ['status', 'reason'], label);
  return Object.freeze({
    status: enumValue(value.status, ['NOT_RUN', 'PASS', 'FAIL', 'DEFERRED'], `${label}.status`),
    reason: string(value.reason, `${label}.reason`),
  });
}

function validatePackage(value, receiptRoot, independentlyPinnedReceipts) {
  exactKeys(value, [
    'schema', 'phase', 'generated_at', 'source_pair', 'installed_baseline',
    'candidate', 'recovery', 'receipts', 'physical_acceptance',
  ], 'package');
  requiredKeys(value, [
    'schema', 'phase', 'generated_at', 'source_pair', 'installed_baseline',
    'candidate', 'recovery', 'receipts', 'physical_acceptance',
  ], 'package');
  if (value.schema !== CUSTODY_EVIDENCE_SCHEMA) fail(`package.schema must be ${CUSTODY_EVIDENCE_SCHEMA}`);
  const receipts = value.receipts;
  if (!Array.isArray(receipts) || receipts.length > 64) fail('package.receipts must be an array of at most 64 entries');
  const dto = {
    schema: value.schema,
    phase: enumValue(value.phase, PHASES, 'package.phase'),
    generated_at: timestamp(value.generated_at, 'package.generated_at'),
    source_pair: sourcePair(value.source_pair, 'package.source_pair'),
    installed_baseline: baseline(value.installed_baseline, 'package.installed_baseline'),
    candidate: descriptor(value.candidate, receiptRoot, 'package.candidate'),
    recovery: descriptor(value.recovery, receiptRoot, 'package.recovery'),
    receipts: Object.freeze(receipts.map((entry, index) => receipt(entry, receiptRoot, `package.receipts[${index}]`, independentlyPinnedReceipts))),
    physical_acceptance: physicalAcceptance(value.physical_acceptance, 'package.physical_acceptance'),
  };
  validateInternalBindings(dto);
  return Object.freeze(dto);
}

function validateInternalBindings(dto) {
  for (const [label, candidate] of [['candidate', dto.candidate], ['recovery', dto.recovery]]) {
    if (candidate) {
      same(candidate.source_pair, dto.source_pair, `package.${label}.source_pair`);
      if (candidate.package_name !== dto.installed_baseline.package_name) fail(`package.${label}.package_name differs from installed baseline`);
    }
  }
  if (dto.candidate && dto.candidate.version_code <= dto.installed_baseline.version_code) {
    fail('candidate.version_code must be strictly greater than installed_baseline.version_code');
  }
  if (dto.recovery && (!dto.candidate || dto.recovery.version_code <= dto.candidate.version_code)) {
    fail('recovery.version_code must be strictly greater than candidate.version_code');
  }
  for (const entry of dto.receipts) {
    if (canonical(entry.source_pair) === canonical(dto.source_pair)) continue;
    // Preserve historical component provenance, never pretend its old pair
    // is the current candidate. The loader still requires independent exact
    // file hash/source/scope/disposition pins before returning this package.
    if (entry.state !== 'COMPLETE' || entry.inspection?.scope_complete !== false) {
      fail(`receipt ${entry.kind} historical source_pair is allowed only for an inspected incomplete component`);
    }
  }
  if (dto.phase === 'PREBUILD_SOURCE' && dto.physical_acceptance.status === 'PASS') {
    fail('PREBUILD_SOURCE cannot claim physical acceptance PASS');
  }
  if (dto.physical_acceptance.status === 'PASS'
      && (dto.phase !== 'POSTINSTALL_ACCEPTANCE'
        || !dto.receipts.some((entry) => entry.scope === 'PHYSICAL_QUALIFICATION'
          && entry.state === 'COMPLETE' && entry.inspection?.scope_complete === true))) {
    fail('physical acceptance PASS requires a current independently inspected complete physical receipt');
  }
}

function trustedReceipt(value, index) {
  const label = `trusted inputs.trusted_receipts[${index}]`;
  exactKeys(value, ['path', 'sha256', 'source_pair', 'allowed_scope', 'allowed_disposition', 'owner_context_file'], label);
  requiredKeys(value, ['path', 'sha256', 'source_pair', 'allowed_scope', 'allowed_disposition'], label);
  if (isAbsolute(value.path) || value.path.split(/[\\/]/).includes('..')) fail(`${label}.path must be relative without traversal`);
  return Object.freeze({
    path: string(value.path, `${label}.path`),
    sha256: sha(value.sha256, `${label}.sha256`),
    source_pair: sourcePair(value.source_pair, `${label}.source_pair`),
    allowed_scope: enumValue(value.allowed_scope, RECEIPT_SCOPES, `${label}.allowed_scope`),
    allowed_disposition: string(value.allowed_disposition, `${label}.allowed_disposition`, /^[A-Z][A-Z0-9_]{2,63}$/),
    owner_context_file: value.owner_context_file == null ? null : fileRef(value.owner_context_file, null, `${label}.owner_context_file`),
  });
}

function trustedInputs(value) {
  exactKeys(value, ['schema', 'source_pair', 'installed_baseline', 'signer_pins', 'required_receipt_scopes', 'trusted_receipts'], 'trusted inputs');
  requiredKeys(value, ['schema', 'source_pair', 'installed_baseline', 'signer_pins', 'required_receipt_scopes', 'trusted_receipts'], 'trusted inputs');
  if (value.schema !== TRUSTED_INPUTS_SCHEMA) fail(`trusted inputs schema must be ${TRUSTED_INPUTS_SCHEMA}`);
  if (!Array.isArray(value.required_receipt_scopes) || value.required_receipt_scopes.length === 0) fail('trusted inputs require receipt scopes');
  if (!Array.isArray(value.trusted_receipts) || value.trusted_receipts.length === 0) fail('trusted inputs require independently pinned receipts');
  const scopes = value.required_receipt_scopes.map((entry, index) => enumValue(entry, RECEIPT_SCOPES, `trusted inputs.required_receipt_scopes[${index}]`));
  if (new Set(scopes).size !== scopes.length) fail('trusted inputs receipt scopes must be unique');
  return Object.freeze({
    schema: value.schema,
    source_pair: sourcePair(value.source_pair, 'trusted inputs.source_pair'),
    installed_baseline: baseline(value.installed_baseline, 'trusted inputs.installed_baseline'),
    signer_pins: signerPins(value.signer_pins, 'trusted inputs.signer_pins'),
    required_receipt_scopes: Object.freeze(scopes),
    trusted_receipts: Object.freeze(value.trusted_receipts.map(trustedReceipt)),
  });
}

export function assertTrustedInputs(value) {
  return trustedInputs(value);
}

export function loadCustodialCustodyEvidencePackage({
  packagePath,
  allowedReceiptRoot,
  trustedSourcePair,
  trustedBaseline,
  trustedSignerPins,
  trustedReceipts = null,
  expectedPackageSha256 = null,
}) {
  if (!packagePath || !allowedReceiptRoot) fail('packagePath and allowedReceiptRoot are required');
  const packageAbsolute = resolve(String(packagePath));
  const packageStat = lstatSync(packageAbsolute);
  if (!packageStat.isFile() || packageStat.isSymbolicLink() || realpathSync(packageAbsolute) !== packageAbsolute) {
    fail('packagePath must be one regular non-symlink file');
  }
  const receiptRoot = realpathSync(resolve(String(allowedReceiptRoot)));
  const rawBytes = readFileSync(packageAbsolute);
  if (expectedPackageSha256 !== null
      && createHash('sha256').update(rawBytes).digest('hex') !== sha(expectedPackageSha256, 'expected package hash')) {
    fail('package changed after its source-phase inspection');
  }
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('package JSON is malformed'); }
  const independentlyPinnedReceipts = Object.freeze((trustedReceipts || []).map(trustedReceipt));
  const dto = validatePackage(parsed, receiptRoot, independentlyPinnedReceipts);
  const source = sourcePair(trustedSourcePair, 'trusted source pair');
  const base = baseline(trustedBaseline, 'trusted baseline');
  const pins = signerPins(trustedSignerPins, 'trusted signer pins');
  same(dto.source_pair, source, 'package.source_pair');
  same(dto.installed_baseline, base, 'package.installed_baseline');
  if (dto.installed_baseline.package_name !== pins.package_name) fail('installed baseline package does not match trusted signer pins');
  if (dto.installed_baseline.signer_certificate_sha256 !== pins.signer_certificate_sha256
      || dto.installed_baseline.signer_public_key_sha256 !== pins.signer_public_key_sha256) {
    fail('installed baseline signer pins do not match independently trusted pins');
  }
  for (const [label, candidate] of [['candidate', dto.candidate], ['recovery', dto.recovery]]) {
    if (!candidate) continue;
    if (candidate.signer_certificate_sha256 !== pins.signer_certificate_sha256
        || candidate.signer_public_key_sha256 !== pins.signer_public_key_sha256) {
      fail(`${label} signer pins do not match independently trusted pins`);
    }
    if (candidate.package_name !== pins.package_name) fail(`${label} package does not match independently trusted pins`);
  }
  for (const entry of dto.receipts) {
    if (entry.state !== 'COMPLETE') continue;
    const pinned = independentlyPinnedReceipts.find((candidate) => candidate.path === entry.receipt_file.path && candidate.sha256 === entry.receipt_file.sha256);
    if (!pinned) fail(`receipt ${entry.kind} is COMPLETE without an independently pinned receipt`);
    same(pinned.source_pair, entry.source_pair, `receipt ${entry.kind} trusted source pair`);
    if (pinned.allowed_scope !== entry.scope) fail(`receipt ${entry.kind} scope is not independently allowed`);
    if (entry.inspection?.disposition !== pinned.allowed_disposition) fail(`receipt ${entry.kind} disposition is not independently allowed`);
  }
  const loaded = Object.freeze({
    package: dto,
    trusted: Object.freeze({ source_pair: source, installed_baseline: base, signer_pins: pins, trusted_receipts: independentlyPinnedReceipts }),
    package_path: packageAbsolute,
    receipt_root: receiptRoot,
  });
  loadedPackages.add(loaded);
  return loaded;
}

function completeScopes(packageDTO) {
  return new Set(packageDTO.receipts
    .filter((entry) => entry.state === 'COMPLETE' && entry.inspection?.scope_complete === true)
    .map((entry) => entry.scope));
}

export function summarizeCustodialCustodyReadiness(loaded, trustedInputsValue) {
  if (!loadedPackages.has(loaded)) fail('an original loader-minted evidence package is required');
  const trusted = trustedInputs(trustedInputsValue);
  same(loaded.package.source_pair, trusted.source_pair, 'package.source_pair');
  same(loaded.package.installed_baseline, trusted.installed_baseline, 'package.installed_baseline');
  same(loaded.trusted.signer_pins, trusted.signer_pins, 'loaded trusted signer pins');
  same(loaded.trusted.trusted_receipts, trusted.trusted_receipts, 'loaded independently pinned receipts');
  if (loaded.package.installed_baseline.signer_certificate_sha256 !== trusted.signer_pins.signer_certificate_sha256
      || loaded.package.installed_baseline.signer_public_key_sha256 !== trusted.signer_pins.signer_public_key_sha256) {
    fail('loaded package signer pins do not match trusted inputs');
  }
  for (const entry of loaded.package.receipts) {
    if (entry.state !== 'COMPLETE') continue;
    const pinned = trusted.trusted_receipts.find((candidate) => candidate.path === entry.receipt_file.path && candidate.sha256 === entry.receipt_file.sha256);
    if (!pinned || entry.inspection?.disposition !== pinned.allowed_disposition) fail(`receipt ${entry.kind} lacks trusted disposition`);
  }
  const complete = completeScopes(loaded.package);
  const missingInputs = trusted.required_receipt_scopes
    .filter((scope) => !complete.has(scope))
    .map((scope) => `required receipt scope ${scope} is not COMPLETE`);
  if (loaded.package.phase !== 'PREBUILD_SOURCE' && !loaded.package.candidate) missingInputs.push('candidate descriptor/artifact is not supplied');
  if (loaded.package.phase === 'POSTINSTALL_ACCEPTANCE' && !loaded.package.recovery) missingInputs.push('recovery descriptor/artifact is not supplied');
  const physicalStatus = loaded.package.physical_acceptance.status;
  const deferred = [];
  if (physicalStatus === 'NOT_RUN' || physicalStatus === 'DEFERRED') deferred.push('post-install physical retained-data and forward-recovery drill');
  if (!loaded.package.candidate) deferred.push('candidate artifact admission');
  if (!loaded.package.recovery) deferred.push('higher recovery artifact admission');
  return Object.freeze({
    evidencePackageValid: true,
    exactBindingsVerified: true,
    sourceEvidenceStatus: complete.has('SOURCE_COMPATIBILITY') ? 'READY' : 'INCOMPLETE',
    readiness: Object.freeze({
      source: complete.has('SOURCE_COMPATIBILITY') ? 'READY' : 'INCOMPLETE',
      artifact: complete.has('ARTIFACT_ADMISSION') ? 'RECEIPT_PRESENT' : 'NOT_READY',
      installation: complete.has('POSTINSTALL_ACCEPTANCE') ? 'RECEIPT_PRESENT' : 'NOT_READY',
      physical: physicalStatus,
    }),
    missingInputs: Object.freeze(missingInputs),
    deferredPostinstallChecks: Object.freeze(deferred),
    phase: loaded.package.phase,
    candidateVersionCode: loaded.package.candidate?.version_code ?? null,
    recoveryVersionCode: loaded.package.recovery?.version_code ?? null,
  });
}

export function loadTrustedInputsFile(path, expectedSha256) {
  const absolute = resolve(String(path || ''));
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(absolute) !== absolute) fail('trusted inputs must be one regular non-symlink file');
  const bytes = readFileSync(absolute);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha(expectedSha256, 'trusted-inputs-sha256')) fail('trusted inputs hash does not match independently supplied expected hash');
  let parsed;
  try { parsed = JSON.parse(bytes); } catch { fail('trusted inputs JSON is malformed'); }
  return trustedInputs(parsed);
}
