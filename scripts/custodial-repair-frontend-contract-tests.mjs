import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.resolve(root, name), 'utf8');
const manifest = JSON.parse(read('frontend-release-manifest.json'));
const scan = read('index.html');
const sharedSync = read('memphis-scan-sync.js');
const messages = read('messages.html');
const chatScope = read('mobile/src/chatscope/app.jsx');
const legacyThread = read('thread.html');

function extractFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} function must exist`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} function body did not close`);
}

assert.equal(manifest.release_id, 'release-2026.07.19.custodial-v3.12');
// The current compatibility declaration is bound to actual isolated304
// schema evidence. This does not grant production, review or pair admission.
const declaredSchemaCaptureBytes = fs.readFileSync(path.resolve(root, 'scripts/fixtures/current304-schema-source-binding.json'));
assert.equal(createHash('sha256').update(declaredSchemaCaptureBytes).digest('hex'), '7dff142e97c38f786b733f95a600838d72637da2d407b44f49e59043c55dd928');
const declaredSchemaCapture = JSON.parse(declaredSchemaCaptureBytes);
assert.equal(declaredSchemaCapture.schema, 'custodial.frontend-retained-source304-binding.v1');
assert.equal(declaredSchemaCapture.canonical_source_count, 304);
assert.equal(declaredSchemaCapture.actual_isolated_fresh_schema_observed, true);
assert.equal(declaredSchemaCapture.retained_source304_successor.expected_fingerprint_authority, null);
for (const field of ['production', 'independent_review', 'release_admission', 'frontend_pair_admission']) {
  assert.equal(declaredSchemaCapture[field], false);
}
assert.equal(manifest.schema_fingerprint, declaredSchemaCapture.schema_fingerprint);
assert.equal(manifest.api_contract_versions.scan, 'scan.v4.snapshot-bound-authority');
assert.equal(manifest.api_contract_versions.messaging, 'messaging.v5');
assert.deepEqual(manifest.queue_compatibility_versions.messaging, ['local-storage-outbox-v1']);
assert.deepEqual(manifest.queue_compatibility_versions.gemini_console, ['indexeddb-outbox-v1']);
assert.equal(manifest.api_contract_versions.gemini_console, 'gemini-console.v2');
assert.equal(manifest.api_contract_versions.guest_reports, 'guest-reports.v2.approval-gated');
assert.equal(manifest.api_contract_versions.feedback, 'feedback.v3.enrolled-authority');

for (const [file, expected] of Object.entries(manifest.asset_hashes_sha256)) {
  const actual = createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
  assert.equal(actual, expected, `${file} hash must match frontend-release-manifest.json`);
}

assert.match(scan, /enqueueAction\(\{type:"start_session"/);
assert.match(scan, /p_snapshot_id:[^,}]+,p_snapshot_employee_id:[^,}]+,p_snapshot_assignment_epoch:/);
assert.match(scan, /__custodial_offline_reconciliation_v1/);
assert.match(scan, /p_scan_evidence:Array\.isArray/);
assert.doesNotMatch(scan, /rpcOne\("tool_record_scan_event"/);
assert.match(scan, /offline-provisional/);
assert.match(scan, /server-active/);
assert.match(scan, /shouldCreateOfflineProvisional/);
assert.match(scan, /httpStatus/);
assert.doesNotMatch(extractFunctionSource(scan, 'finishSessionMaybeQueued'), /rpcOne\("tool_finish_session"/);

assert.match(sharedSync, /tool_start_offline_occurrence/);
assert.match(sharedSync, /case 'start_session':[\s\S]*rpc\('tool_start_offline_occurrence', payload\)/);
// Actual shipping replay binding: absent optional epoch stays lossless null;
// supplied/retained/payload precedence and malformed non-null values are preserved.
const bindingStart=sharedSync.indexOf('  function replayBindingFor('),bindingEnd=sharedSync.indexOf('\n  function ',bindingStart+5);
assert.ok(bindingStart>0&&bindingEnd>bindingStart);
const bindingSource=sharedSync.slice(bindingStart,bindingEnd);
let retained=null;
const binding=Function('exactSessionForPayload','safeText','return ('+bindingSource+');')(()=>retained,v=>String(v??'').trim());
assert.equal(binding({}).assignment_epoch,null);
assert.equal(binding({replay_binding:{assignment_epoch:null}}).assignment_epoch,null);
assert.equal(binding({payload:{p_snapshot_assignment_epoch:5}}).assignment_epoch,5);
retained={offline_authority_assignment_epoch:7};
assert.equal(binding({payload:{p_snapshot_assignment_epoch:5}}).assignment_epoch,7);
assert.equal(binding({replay_binding:{assignment_epoch:'9'},payload:{p_snapshot_assignment_epoch:5}}).assignment_epoch,9);
assert.equal(Number.isNaN(binding({replay_binding:{assignment_epoch:'unknown'}}).assignment_epoch),true,'Malformed supplied data must not silently use another epoch');
assert.equal(binding({replay_binding:{assignment_epoch:Infinity}}).assignment_epoch,Infinity,'Do not silently replace malformed non-null originals');
retained=null;

assert.match(sharedSync, /Number\(result\.assignment_epoch\) !== expected\.assignment_epoch/);
assert.match(sharedSync, /__custodial_offline_reconciliation_v1/);
assert.doesNotMatch(sharedSync, /rpc\('tool_record_scan_event'/);
assert.match(sharedSync, /dead_letter/);
assert.match(sharedSync, /tool_finish_session/);
assert.match(sharedSync, /httpStatus/);
assert.match(sharedSync, /Retry-After/i);
assert.match(sharedSync, /canonical_fenced_rows/);
assert.match(sharedSync, /downgradeTransition\('fenced-v4-verified'\)/);
assert.match(sharedSync, /async function drainForNewWork\(/);
assert.match(sharedSync, /async function rollbackReadiness\(/);
assert.match(sharedSync, /tool_get_device_rollback_readiness/);
assert.match(sharedSync, /native_occurrence_count/);
assert.match(sharedSync, /return withQueueLock\(async \(lockContext\) => \{/);
assert.match(sharedSync, /return withQueueLock\(\(\) => enqueueUnlocked\(action\)\)/);
// Current shared owner uses the real exclusive Web Lock. The retired TTL
// fallback must not write/delete original lease bytes before a later refusal.
const queueLockStart = sharedSync.indexOf('  async function withQueueLock(');
const queueLockEnd = sharedSync.indexOf('\n  async function enqueue(', queueLockStart);
assert.ok(queueLockStart >= 0 && queueLockEnd > queueLockStart);
const queueLockSource = sharedSync.slice(queueLockStart, queueLockEnd);
assert.match(queueLockSource, /typeof navigator\.locks\?\.request === 'function'/);
assert.match(queueLockSource, /const options = \{ mode: 'exclusive' \}/);
assert.match(queueLockSource, /if \(ifAvailable\) options\.ifAvailable = true/);
assert.match(queueLockSource, /return navigator\.locks\.request\(CONFIG\.WEB_LOCK_NAME, options, \(lock\) => lock \? operation\(\{ recoverClaimsImmediately: true \}\) : false\)/);
assert.match(queueLockSource, /throw Object\.assign\(queueSecurityUnavailable\(\), \{ reason: 'browser_shared_lock_unavailable' \}\)/);
assert.doesNotMatch(queueLockSource, /\b(?:localStorage|sessionStorage)\s*\.|\b(?:setItem|removeItem|setTimeout|setInterval)\s*\(/);
assert.match(sharedSync, /Number\(item\.lease_until \|\| 0\) > now\(\)/);
assert.match(sharedSync, /recoverOrphanedClaims\(lockContext\.recoverClaimsImmediately === true\)/);
assert.match(sharedSync, /ADMISSION_MAX_BATCHES/);
assert.match(sharedSync, /if \(nextClaimableAction\(remaining, currentTime\)\) scheduleSync\(50\)/,
  'A bounded background batch must continue only when the ordered claim selector finds eligible work');
assert.match(sharedSync, /result\.started_at\) !== safeText\(item\?\.payload\?\.p_client_started_at\)/);
assert.match(sharedSync, /started_at: safeText\(payload\.p_client_started_at\)/);
assert.match(scan, /async function admitNewScanWork\(/);
assert.match(scan, /admit\(async\(\)=>\{/);
assert.match(scan, /loadOfflineAuthoritySnapshot/);
assert.match(scan, /authorizeOfflineNewWork/);
assert.doesNotMatch(extractFunctionSource(scan, 'start'), /refreshScanAuthoritySnapshot/);

assert.match(messages, /chatscope-messenger\.js/);
assert.doesNotMatch(messages, /messenger-runtime-patch\.js/);
assert.match(chatScope, /mz_chatscope_outbox:/);
assert.match(chatScope, /retryOutbox/);
assert.match(chatScope, /client_message_id:\s*entry\.id/);
assert.match(chatScope, /sender_user_id:\s*entry\.user_id/);
assert.match(chatScope, /window\.addEventListener\('online'/);
assert.match(chatScope, /member_user_ids/);
assert.match(chatScope, /client_thread_id:\s*operationId\('thread'\)/);
assert.match(chatScope, /\/thread\/\$\{encodeURIComponent\(thread\.id\)\}\/delete/);
assert.match(chatScope, /Conversation removed from your Messenger\./);
assert.match(chatScope, /RETIRED_KEY = 'ops_manager_shared_chat_v1'/);
assert.match(chatScope, /title: memphis \? 'Memphis AI'/);
assert.doesNotMatch(chatScope, /window\.fetch\s*=|MutationObserver/);
assert.match(legacyThread, /new URL\(['"]\.\/messages\.html['"],location\.href\)/);
assert.match(legacyThread, /searchParams\.set\(key,value\)/);

console.log('CUSTODIAL_REPAIR_FRONTEND_CONTRACT_TESTS_PASS');
