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
assert.equal(manifest.schema_fingerprint, '544d11f47f1f4a960fcf49d13bba53c736d78fe4fe9d225c996c84311d442ad0');
assert.equal(manifest.api_contract_versions.scan, 'scan.v2');
assert.equal(manifest.api_contract_versions.messaging, 'messaging.v5');
assert.deepEqual(manifest.queue_compatibility_versions.messaging, ['local-storage-outbox-v1']);
assert.deepEqual(manifest.queue_compatibility_versions.gemini_console, ['indexeddb-outbox-v1']);
assert.equal(manifest.api_contract_versions.gemini_console, 'gemini-console.v2');
assert.equal(manifest.api_contract_versions.guest_reports, 'guest-reports.v2.approval-gated');
assert.equal(manifest.api_contract_versions.feedback, 'feedback.v2.json-triage');

for (const [file, expected] of Object.entries(manifest.asset_hashes_sha256)) {
  const actual = createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
  assert.equal(actual, expected, `${file} hash must match frontend-release-manifest.json`);
}

assert.match(scan, /tool_start_session_v2/);
assert.match(scan, /offline-provisional/);
assert.match(scan, /server-active/);
assert.match(scan, /shouldCreateOfflineProvisional/);
assert.match(scan, /httpStatus/);
assert.doesNotMatch(extractFunctionSource(scan, 'finishSessionMaybeQueued'), /rpcOne\("tool_finish_session"/);

assert.match(sharedSync, /tool_start_session_v2/);
assert.match(sharedSync, /dead_letter/);
assert.match(sharedSync, /tool_finish_session/);
assert.match(sharedSync, /httpStatus/);
assert.match(sharedSync, /Retry-After/i);

assert.match(messages, /chatscope-messenger\.js/);
assert.doesNotMatch(messages, /messenger-runtime-patch\.js/);
assert.match(chatScope, /mz_chatscope_outbox:/);
assert.match(chatScope, /retryOutbox/);
assert.match(chatScope, /client_message_id:\s*id/);
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
