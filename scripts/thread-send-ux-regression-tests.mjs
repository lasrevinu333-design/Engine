import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const read = (name) => fs.readFileSync(path.resolve(root, name), 'utf8');

const messages = read('messages.html');
const messenger = read('messages-app.js');
const legacyThread = read('thread.html');

assert.match(messages, /messenger-app\.css/);
assert.match(messages, /messages-app\.js/);
assert.doesNotMatch(messages, /chatscope/i, 'the production Messenger must use the Memphis custom presentation layer');

assert.match(messenger, /function clientMessageId\(\)\s*\{\s*return `msg:\$\{crypto\.randomUUID\(\)\}`/);
assert.match(messenger, /OUTBOX_PREFIX = 'mz_messenger_v2_outbox:'/);
assert.match(messenger, /function isMemphis\(/);
assert.match(messenger, /String\(user\.id\) !== String\(state\.identity\.msg_user_id\)/, 'the picker must exclude the current user');
assert.match(messenger, /api\('\/thread\/direct'/, 'one recipient must create a direct conversation');
assert.match(messenger, /api\('\/thread\/group'/, 'multiple recipients must create an ordinary group');
assert.match(messenger, /client_thread_id:\s*`thread:\$\{crypto\.randomUUID\(\)\}`/, 'group retries must have a stable operation identity');

const optimisticIndex = messenger.indexOf('state.messages.push(optimistic)');
const outboxIndex = messenger.indexOf('localStorage.setItem(`${OUTBOX_PREFIX}${id}`, JSON.stringify(entry))');
const networkIndex = messenger.indexOf("await api('/memphis/message'", outboxIndex);
assert.ok(optimisticIndex >= 0, 'a sent message must appear immediately');
assert.ok(outboxIndex > optimisticIndex, 'the durable outbox must follow the optimistic local render');
assert.ok(networkIndex > outboxIndex, 'the message must be written to the outbox before network delivery begins');

assert.match(messenger, /client_message_id:\s*entry\.id/);
assert.match(messenger, /localStorage\.removeItem\(`\$\{OUTBOX_PREFIX\}\$\{id\}`\)/);
assert.match(messenger, /failed:\s*true/);
assert.match(messenger, /Saved on this phone\. Will retry when connected\./);
assert.match(messenger, /key\?\.startsWith\(OUTBOX_PREFIX\)/);
assert.match(messenger, /window\.addEventListener\('online'/);
assert.match(messenger, /els\.composer\.hidden = thread\.canSend === false/, 'read-only conversations must hide the composer');
assert.match(messenger, /if \(!thread \|\| isRetiredSystemThread\(thread\)\) return/, 'the retired shared system room must not be deleted');
assert.doesNotMatch(messenger, /isRetiredSystemThread\(thread\) \|\| isMemphis\(thread\)/, 'Memphis conversations must be removable by the current user');
assert.match(messenger, /filter\(\(thread\) => thread\.id && !isRetiredSystemThread\(thread\)\)/, 'the unrequested Operations Leadership room must never reach the visible list');
assert.match(messenger, /type === 'bot' && rawTitle\.trim\(\)\.toLowerCase\(\) === 'memphis'/, 'the canonical bot thread must render as Memphis AI');
assert.match(messenger, /function startThreadSwipe/);
assert.match(messenger, /data-delete-thread-id/);
assert.match(messenger, /window\.addEventListener\('pointermove', moveThreadSwipe/, 'swipe tracking must survive the row translating away from the pointer');
assert.match(messenger, /window\.addEventListener\('pointerup', finishThreadSwipe/, 'swipe completion must be captured outside the translated row');
assert.doesNotMatch(messenger, /\bconfirm\s*\(/);

assert.match(legacyThread, /new URL\(['"]\.\/messages\.html['"],location\.href\)/);
assert.match(legacyThread, /searchParams\.set\(key,value\)/);
assert.match(legacyThread, /target\.hash=location\.hash/);

console.log(JSON.stringify({
  ok: true,
  checked: [
    'single_memphis_custom_client',
    'optimistic_render',
    'durable_outbox_before_network',
    'stable_client_message_id',
    'failed_send_queue_state',
    'online_retry',
    'exclude_self_from_picker',
    'direct_and_group_creation',
    'idempotent_group_creation',
    'read_only_composer',
    'retired_leadership_room_hidden',
    'user_scoped_memphis_deletion',
    'swipe_delete_without_confirmation',
    'legacy_thread_redirect',
  ],
}, null, 2));
