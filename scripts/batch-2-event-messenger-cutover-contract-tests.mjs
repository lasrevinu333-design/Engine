import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const reminderClient = read('memphis-device-reminders.js');
const messengerHtml = read('messages.html');
const chatScope = read('mobile/src/chatscope/app.jsx');

assert.doesNotMatch(reminderClient, /device-event-reminders/);
assert.doesNotMatch(reminderClient, /function fetchReminders\s*\(/);
assert.doesNotMatch(reminderClient, /function reminderAlert\s*\(/);
assert.doesNotMatch(reminderClient, /notificationType:\s*['"]event['"]/);
assert.match(
  reminderClient,
  /Promise\.all\(\[fetchLocationStatusReminders\(\), fetchThreads\(\)\]\)/
);

assert.match(chatScope, /if \(!thread \|\| thread\.shared\) return/);
assert.match(chatScope, /mz_chatscope_delete_outbox:/);
assert.match(chatScope, /setNotice\(EMPLOYEE_CONTEXT \? 'Deleted\.' : 'Conversation removed from your Messenger\.', 'ok'\)/);
assert.match(chatScope, /\{!selectedThread\.shared && <button[^>]+onClick=\{\(\) => void deleteThread\(selectedThread\.id\)\}>Delete<\/button>\}/);
assert.doesNotMatch(chatScope, /Delete [^`]* for everyone/);
assert.match(chatScope, /if \(!EMPLOYEE_CONTEXT && !confirm\(/);
assert.doesNotMatch(chatScope, /!selectedThread\.shared && !isMemphis\(selectedThread\)/);
assert.match(chatScope, /\{ showLoading = false \}/);
assert.match(chatScope, /!EMPLOYEE_CONTEXT \? rows\[0\] : null/);
assert.match(chatScope, /const changed = id !== selectedRef\.current/);
assert.doesNotMatch(chatScope, /\bLoader\b/);
assert.equal((messengerHtml.match(/memphis-device-reminders\.js/g) || []).length, 1,
  'the active Messenger must load exactly one foreground notification owner');
assert.match(messengerHtml, /chatscope-messenger\.js/);
assert.doesNotMatch(messengerHtml, /messages-app\.js/);

console.log('BATCH_2_EVENT_MESSENGER_CUTOVER_FRONTEND_PASS');
