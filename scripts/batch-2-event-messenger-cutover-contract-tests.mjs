import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const reminderClient = read('memphis-device-reminders.js');
const messenger = read('messages-app.js');
const chatScope = read('mobile/src/chatscope/app.jsx');

assert.doesNotMatch(reminderClient, /device-event-reminders/);
assert.doesNotMatch(reminderClient, /function fetchReminders\s*\(/);
assert.doesNotMatch(reminderClient, /function reminderAlert\s*\(/);
assert.doesNotMatch(reminderClient, /notificationType:\s*['"]event['"]/);
assert.match(
  reminderClient,
  /Promise\.all\(\[fetchLocationStatusReminders\(\), fetchThreads\(\)\]\)/
);

assert.match(messenger, /els\.deleteThread\.hidden = isRetiredSystemThread\(thread\)/);
assert.match(messenger, /if \(!thread \|\| isRetiredSystemThread\(thread\)\) return/);
assert.match(messenger, /Your next Memphis message will start a clean conversation/);
assert.match(messenger, /Other participants keep their copy/);
assert.doesNotMatch(messenger, /if \(!thread \|\| isMemphis\(thread\)\) return/);
const legacyRetryStart = messenger.indexOf('async function retryOutbox()');
const legacyRetryEnd = messenger.indexOf('async function openMemphis()', legacyRetryStart);
const legacyRetrySource = messenger.slice(legacyRetryStart, legacyRetryEnd);
assert.doesNotMatch(legacyRetrySource, /catch\s*(?:\([^)]*\))?\s*\{\s*break;/, 'legacy outbox retries must continue after a poison entry');
assert.match(legacyRetrySource, /retainOutboxFailure\(entry, error\)/);

assert.match(chatScope, /if \(!thread \|\| thread\.shared\) return/);
assert.match(chatScope, /Your next Memphis message will start a clean conversation/);
assert.match(chatScope, /Other participants keep their copy/);
assert.match(chatScope, /\{!selectedThread\.shared && <button[^>]+onClick=\{deleteThread\}>Delete<\/button>\}/);
assert.doesNotMatch(chatScope, /Delete [^`]* for everyone/);
assert.doesNotMatch(chatScope, /!selectedThread\.shared && !isMemphis\(selectedThread\)/);

console.log('BATCH_2_EVENT_MESSENGER_CUTOVER_FRONTEND_PASS');
