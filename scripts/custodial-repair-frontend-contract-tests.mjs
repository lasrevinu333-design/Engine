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
const thread = read('thread.html');

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

assert.equal(manifest.release_id, 'release-2026.07.18.gemini-console.1');
assert.equal(manifest.schema_fingerprint, '51a9624c504f9a7da97ed0af4869cd62d5f67bacacde421c8969d726bb4c09f1');
assert.equal(manifest.api_contract_versions.scan, 'scan.v2');
assert.equal(manifest.api_contract_versions.messaging, 'messaging.v2');
assert.deepEqual(manifest.queue_compatibility_versions.messaging, ['local-storage-outbox-v1']);
assert.deepEqual(manifest.queue_compatibility_versions.gemini_console, ['indexeddb-outbox-v1']);
assert.equal(manifest.api_contract_versions.gemini_console, 'gemini-console.v2');

for (const [file, expected] of Object.entries(manifest.asset_hashes_sha256)) {
  const actual = createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
  assert.equal(actual, expected, `${file} hash must match frontend-release-manifest.json`);
}

assert.match(scan, /tool_start_session_v2/);
assert.match(scan, /offline-provisional/);
assert.match(scan, /server-active/);
assert.match(scan, /dead-letter/);
assert.match(scan, /shouldCreateOfflineProvisional/);
assert.match(scan, /httpStatus/);
assert.doesNotMatch(extractFunctionSource(scan, 'finishSessionMaybeQueued'), /rpcOne\("tool_finish_session"/);
assert.match(extractFunctionSource(scan, 'processQueuedAction'), /tool_finish_session/);

assert.match(sharedSync, /tool_start_session_v2/);
assert.match(sharedSync, /dead_letter/);
assert.match(sharedSync, /httpStatus/);
assert.match(sharedSync, /Retry-After/i);

assert.match(thread, /mz_msg_outbox:/);
assert.match(thread, /persistDraft/);
assert.match(thread, /flushOutbox/);
assert.match(thread, /client_message_id:clientMessageId/);
assert.match(thread, /sender_user_id:state\.currentUserId/);
assert.match(thread, /window\.addEventListener\('online'/);

console.log('CUSTODIAL_REPAIR_FRONTEND_CONTRACT_TESTS_PASS');
