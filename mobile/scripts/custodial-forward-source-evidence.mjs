/** Bounded read-only source/receipt BYTE observer, not an authority validator.
 * A digest and a claimed reviewed status never qualify compatibility or source.
 * The normal release/artifact policy and original owner review gates remain.
 */
import { createHash } from 'node:crypto';
import { constants, closeSync, existsSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { normalize, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const STORES = ['enrollment', 'protected_pending', 'history', 'crypto'];

function obj(v, label) { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label} must be an object`); return v; }
function exact(v, names, label) { if (JSON.stringify(Object.keys(v).sort()) !== JSON.stringify([...names].sort())) throw new Error(`${label} has unknown or missing fields`); }
function sha(v, label) { if (typeof v !== 'string' || !SHA.test(v)) throw new Error(`${label} must be lowercase SHA-256`); return v; }
function commit(v, label) { if (typeof v !== 'string' || !COMMIT.test(v)) throw new Error(`${label} must be an exact commit/tree`); return v; }
function canonical(v, label) { if (typeof v !== 'string' || !v.startsWith('/') || v.includes('\0') || normalize(v) !== v || v.includes('/../') || v.endsWith('/..')) throw new Error(`${label} must be a canonical absolute path`); }
function regular(v, label) { canonical(v, label); if (!existsSync(v) || !lstatSync(v).isFile() || lstatSync(v).isSymbolicLink() || realpathSync(v) !== v) throw new Error(`${label} must be an existing non-symlink regular file`); }
function boundFile(path, label) {
  regular(path, label);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > 8388608) throw new Error(label + ' exceeds the bounded observation');
    const bytes = readFileSync(fd), after = fstatSync(fd), named = lstatSync(path);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
      || after.dev !== named.dev || after.ino !== named.ino || realpathSync(path) !== path)
      throw new Error(label + ' changed during observation');
    return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'),
      identity: { dev: before.dev, ino: before.ino, size: before.size, mtimeMs: before.mtimeMs, ctimeMs: before.ctimeMs } };
  } finally { closeSync(fd); }
}
function digest(path) { return boundFile(path, 'Bound source/evidence file').sha256; }
function objectDigest(v) { return createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function git(repo, args, label) {
  const r = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-C', repo, ...args],
    { encoding: 'utf8', timeout: 15000, maxBuffer: 2097152 });
  if (r.status !== 0 || r.error || r.signal) throw new Error(label + ' failed');
  return r.stdout.trim();
}

function sourceRecord(v, label) {
  obj(v, label); exact(v, ['repository_path', 'commit', 'tree', 'ref', 'files'], label); canonical(v.repository_path, `${label}.repository_path`); if (!existsSync(v.repository_path) || !lstatSync(v.repository_path).isDirectory() || lstatSync(v.repository_path).isSymbolicLink() || realpathSync(v.repository_path) !== v.repository_path || git(v.repository_path, ['rev-parse', '--show-toplevel'], `${label} root`) !== v.repository_path) throw new Error(`${label}.repository_path must be an existing directory`); commit(v.commit, `${label}.commit`); commit(v.tree, `${label}.tree`); if (typeof v.ref !== 'string' || !/^refs\/(heads|tags)\/[A-Za-z0-9._/-]+$/.test(v.ref)) throw new Error(`${label}.ref is invalid`); if (!Array.isArray(v.files) || !v.files.length) throw new Error(`${label}.files is empty`); for (const f of v.files) { obj(f, `${label}.file`); exact(f, ['path', 'sha256'], `${label}.file`); regular(f.path, `${label}.file.path`); sha(f.sha256, `${label}.file.sha256`); const rel = relative(v.repository_path, f.path); if (!rel || rel === '..' || rel.startsWith('../') || rel.includes('\0')) throw new Error(`${label}.file is outside repository`); }
}

export function observeForwardSourceEvidence(input, externallyPinnedContext) {
  try {
    obj(input, 'source evidence input'); exact(input, ['schema_version', 'purpose', 'declarations'], 'source evidence input');
    obj(externallyPinnedContext, 'external review context'); exact(externallyPinnedContext, ['schema_version', 'authority', 'review_context_file', 'review_context_sha256', 'source_pair', 'retained_receipts'], 'external review context');
    if (input.schema_version !== 1 || input.purpose !== 'forward_source_evidence_observation' || externallyPinnedContext.schema_version !== 1) throw new Error('unsupported source evidence schema or purpose');
    if (externallyPinnedContext.authority !== 'main-normal-verifier-review') throw new Error('review authority is not the normal verifier owner');
    regular(externallyPinnedContext.review_context_file, 'review context file'); sha(externallyPinnedContext.review_context_sha256, 'review context hash'); if (digest(externallyPinnedContext.review_context_file) !== externallyPinnedContext.review_context_sha256) throw new Error('review context bytes do not match external pin');
    const reviewBytes = boundFile(externallyPinnedContext.review_context_file, 'review context');
    if (reviewBytes.sha256 !== externallyPinnedContext.review_context_sha256) throw new Error('review context changed');
    const review = JSON.parse(reviewBytes.bytes.toString('utf8')); obj(review, 'review context'); exact(review, ['schema_version', 'authority', 'status', 'source_pair_digest', 'retained_receipts_digest'], 'review context'); if (review.schema_version !== 1 || review.authority !== externallyPinnedContext.authority || !['preparation_only', 'partial', 'qualified_source'].includes(review.status)) throw new Error('review context has an unsupported declared status'); sha(review.source_pair_digest, 'review source pair digest'); sha(review.retained_receipts_digest, 'review retained digest');
    obj(externallyPinnedContext.source_pair, 'external source pair'); exact(externallyPinnedContext.source_pair, ['frontend', 'backend'], 'external source pair'); sourceRecord(externallyPinnedContext.source_pair.frontend, 'external frontend'); sourceRecord(externallyPinnedContext.source_pair.backend, 'external backend');
    if (review.source_pair_digest !== objectDigest(externallyPinnedContext.source_pair)) throw new Error('review context does not bind the pinned source pair');
    obj(input.declarations, 'source declarations'); exact(input.declarations, ['frontend', 'backend', 'retained_receipts'], 'source declarations'); if (JSON.stringify(input.declarations.frontend) !== JSON.stringify(externallyPinnedContext.source_pair.frontend) || JSON.stringify(input.declarations.backend) !== JSON.stringify(externallyPinnedContext.source_pair.backend)) throw new Error('declarations do not exactly match external source pins');
    if (JSON.stringify(input.declarations.retained_receipts) !== JSON.stringify(externallyPinnedContext.retained_receipts)) throw new Error('retained declarations do not exactly match the byte pins');
    const observed = [];
    for (const [name, record] of Object.entries(externallyPinnedContext.source_pair)) { const actualCommit = git(record.repository_path, ['rev-parse', 'HEAD'], `${name} commit`); const actualTree = git(record.repository_path, ['rev-parse', 'HEAD^{tree}'], `${name} tree`); const actualRef = git(record.repository_path, ['symbolic-ref', '-q', 'HEAD'], `${name} ref`); const dirty = git(record.repository_path, ['status', '--porcelain=v1', '--untracked-files=all'], `${name} status`); if (actualCommit !== record.commit || actualTree !== record.tree || actualRef !== record.ref || dirty) throw new Error(`${name} Git identity is stale or dirty`); for (const file of record.files) if (digest(file.path) !== file.sha256) throw new Error(`${name} source byte hash mismatch`); observed.push({ name, commit: actualCommit, tree: actualTree }); }
    if (!Array.isArray(externallyPinnedContext.retained_receipts) || externallyPinnedContext.retained_receipts.length !== STORES.length) throw new Error('retained receipt set is incomplete');
    if (review.retained_receipts_digest !== objectDigest(externallyPinnedContext.retained_receipts)) throw new Error('review context does not bind retained receipts');
    const seen = new Set(); for (const receipt of externallyPinnedContext.retained_receipts) { obj(receipt, 'retained receipt'); exact(receipt, ['store', 'path', 'sha256'], 'retained receipt'); if (!STORES.includes(receipt.store) || seen.has(receipt.store)) throw new Error('retained receipt store set is invalid'); seen.add(receipt.store); regular(receipt.path, `retained ${receipt.store}`); sha(receipt.sha256, `retained ${receipt.store} hash`); if (digest(receipt.path) !== receipt.sha256) throw new Error(`retained ${receipt.store} bytes do not match external pin`); }
    if (seen.size !== STORES.length) throw new Error('retained receipt set is incomplete');
    // A second bounded read/Git sample detects ordinary identity/byte changes
    // during this observation. It is not an all-writer atomic lease.
    for (const [name, record] of Object.entries(externallyPinnedContext.source_pair)) {
      if (git(record.repository_path, ['rev-parse', 'HEAD'], name + ' final commit') !== record.commit
        || git(record.repository_path, ['rev-parse', 'HEAD^{tree}'], name + ' final tree') !== record.tree
        || git(record.repository_path, ['symbolic-ref', '-q', 'HEAD'], name + ' final ref') !== record.ref
        || git(record.repository_path, ['status', '--porcelain=v1', '--untracked-files=all'], name + ' final status'))
        throw new Error(name + ' source changed during observation');
      for (const file of record.files) if (digest(file.path) !== file.sha256) throw new Error(name + ' final source hash changed');
    }
    if (digest(externallyPinnedContext.review_context_file) !== externallyPinnedContext.review_context_sha256)
      throw new Error('review context changed after observation');
    for (const receipt of externallyPinnedContext.retained_receipts)
      if (digest(receipt.path) !== receipt.sha256) throw new Error('retained receipt changed after observation');
    return { structural_valid: true, source_observed: true, retained_observed: true,
      review_declaration_observed: true, declared_review_status: review.status,
      source_qualified: false, source_ready: false, retained_qualified: false,
      disposition: 'BYTES_OBSERVED_NOT_COMPATIBILITY_OR_REVIEW_AUTHORITY',
      acceptance: false, artifact_authorized: false, install_ready: false,
      physical_qualification: false, version_selected: false, fleet_promotion: false,
      observed_repositories: observed, atomic_generation_qualified: false,
      missing_preartifact_evidence: ['normal authority-reviewed exact candidate/recovery source compatibility receipt',
        'schema-specific retained enrollment/pending/history/crypto compatibility qualification',
        'normal signer/provenance and original review/admission binding'],
      required_later_evidence: ['immutable candidate APK and same-signer compiled evidence',
        'normal artifact acceptance', 'postinstall retained-data and recovery proof'] };

  } catch (error) { return { structural_valid: false, source_observed: false, retained_observed: false, source_qualified: false, source_ready: false, retained_qualified: false, acceptance: false, artifact_authorized: false, install_ready: false, physical_qualification: false, version_selected: false, fleet_promotion: false, reason: error.message }; }
}
