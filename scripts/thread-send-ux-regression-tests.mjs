import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const read = (name) => fs.readFileSync(path.resolve(root, name), 'utf8');

const messages = read('messages.html');
const chatScope = read('mobile/src/chatscope/app.jsx');
const runtime = read('messenger-runtime-patch.js');
const legacyThread = read('thread.html');

assert.match(messages, /chatscope-messenger\.css/);
assert.match(messages, /chatscope-messenger\.js/);
assert.match(messages, /messenger-runtime-patch\.js/);
assert.doesNotMatch(messages, /messages-app\.js|messenger-app\.css/, 'the production Messenger must use one ChatScope presentation layer');

assert.match(chatScope, /function clientMessageId\(\)\s*\{\s*return `msg:\$\{crypto\.randomUUID\(\)\}`/);
assert.match(chatScope, /function outboxKey\(id\)\s*\{\s*return `mz_chatscope_outbox:\$\{id\}`/);
assert.match(chatScope, /function isMemphis\(/);
assert.match(chatScope, /String\(user\.id\) !== currentUserId/, 'the picker must exclude the current user');
assert.match(chatScope, /api\('\/thread\/direct'/, 'one recipient must create a direct conversation');
assert.match(chatScope, /api\('\/thread\/group'/, 'multiple recipients must create an ordinary group');
assert.match(chatScope, /client_thread_id:\s*operationId\('thread'\)/, 'group retries must have a stable operation identity');

const optimisticIndex = chatScope.indexOf('setMessages((rows) => [...rows, optimistic])');
const outboxIndex = chatScope.indexOf('localStorage.setItem(outboxKey(id), JSON.stringify(entry))');
const networkIndex = chatScope.indexOf("await api('/memphis/message'", outboxIndex);
assert.ok(optimisticIndex >= 0, 'a sent message must appear immediately');
assert.ok(outboxIndex > optimisticIndex, 'the durable outbox must follow the optimistic local render');
assert.ok(networkIndex > outboxIndex, 'the message must be written to the outbox before network delivery begins');

assert.match(chatScope, /client_message_id:\s*id/);
assert.match(chatScope, /client_message_id:\s*entry\.id/);
assert.match(chatScope, /localStorage\.removeItem\(outboxKey\(id\)\)/);
assert.match(chatScope, /failed:\s*true,\s*optimistic:\s*false/);
assert.match(chatScope, /Message queued for retry:/);
assert.match(chatScope, /key\?\.startsWith\('mz_chatscope_outbox:'\)/);
assert.match(chatScope, /window\.addEventListener\('online', online\)/);
assert.match(chatScope, /AbortController/);
assert.match(chatScope, /controller\.signal\.aborted/);
assert.match(chatScope, /wait_ms=20000/);
assert.match(chatScope, /disabled=\{!selectedThread\.canSend\}/, 'read-only conversations must disable the composer');
assert.match(chatScope, /placeholder=\{selectedThread\.canSend \? 'Type a message' : 'Read-only conversation'\}/);
assert.match(chatScope, /!thread \|\| thread\.shared/, 'the retired shared system room must not be deleted');
assert.doesNotMatch(chatScope, /!thread \|\| thread\.shared \|\| isMemphis\(thread\)/, 'Memphis conversations must be removable by the current user');

assert.match(runtime, /RETIRED_KEY = 'ops_manager_shared_chat_v1'/);
assert.match(runtime, /filter\(\(row\) => !isRetired\(row\)\)/, 'the unrequested Operations Leadership room must never reach the visible list');
assert.match(runtime, /thread_title: 'Memphis AI'/, 'Memphis must be clearly labeled as Memphis AI');
assert.match(runtime, /memphis:messenger-resume/, 'Messenger must wake its retry and sync loops after app resume');

assert.match(legacyThread, /new URL\(['"]\.\/messages\.html['"],location\.href\)/);
assert.match(legacyThread, /searchParams\.set\(key,value\)/);
assert.match(legacyThread, /target\.hash=location\.hash/);

console.log(JSON.stringify({
  ok: true,
  checked: [
    'single_chatscope_client',
    'optimistic_render',
    'durable_outbox_before_network',
    'stable_client_message_id',
    'failed_send_queue_state',
    'online_retry',
    'long_poll_abort_safety',
    'exclude_self_from_picker',
    'direct_and_group_creation',
    'idempotent_group_creation',
    'read_only_composer',
    'retired_leadership_room_hidden',
    'user_scoped_memphis_deletion',
    'memphis_ai_pinned_identity',
    'legacy_thread_redirect',
  ],
}, null, 2));
