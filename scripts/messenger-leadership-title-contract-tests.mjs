import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [messages, app, legacyThread, legacyChatScope] = await Promise.all([
  readFile(new URL('../messages.html', import.meta.url), 'utf8'),
  readFile(new URL('../messages-app.js', import.meta.url), 'utf8'),
  readFile(new URL('../thread.html', import.meta.url), 'utf8'),
  readFile(new URL('../messages-chatscope.html', import.meta.url), 'utf8'),
]);

assert.match(messages, /Memphis AI and team conversations/);
assert.match(messages, /messages-app\.js/);
assert.match(app, /function roleTitle/);
assert.match(app, /user\.role_title \|\| user\.job_title/);
assert.match(app, /identity\.display_name/);
assert.match(app, /SYSTEM_THREAD_KEY = 'ops_manager_shared_chat_v1'/);
assert.match(app, /!isRetiredSystemThread\(thread\)/);
assert.doesNotMatch(messages, /ChatScope parallel client|Operations Leadership Chat/);
assert.match(legacyThread, /messages\.html/);
assert.match(legacyChatScope, /messages\.html/);
assert.doesNotMatch(legacyThread, /function messengerRoleTitle/);
assert.doesNotMatch(legacyChatScope, /chatscope-messenger\.js/);

console.log('MESSENGER_LEADERSHIP_TITLE_CONTRACT_PASS');
