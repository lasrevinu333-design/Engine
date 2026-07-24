import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const reminderClient = read('memphis-device-reminders.js');
const messenger = read('messages-app.js');
const messengerHtml = read('messages.html');

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
assert.match(messenger, /Memphis conversation deleted\. The next one starts clean\./);
assert.match(messenger, /Conversation deleted from your Messenger\./);
assert.match(messenger, /data-delete-thread-id/);
assert.match(messenger, /function startThreadSwipe/);
assert.doesNotMatch(messenger, /\bconfirm\s*\(/);
assert.doesNotMatch(messenger, /if \(!thread \|\| isMemphis\(thread\)\) return/);
assert.match(messengerHtml, /messages-app\.js/);
assert.match(messengerHtml, /messenger-app\.css/);
assert.doesNotMatch(messengerHtml, /chatscope/i);

console.log('BATCH_2_EVENT_MESSENGER_CUTOVER_FRONTEND_PASS');
