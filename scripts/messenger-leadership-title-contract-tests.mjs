import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [messages, messengerClient, legacyThread, legacyChatScope] = await Promise.all([
  readFile(new URL('../messages.html', import.meta.url), 'utf8'),
  readFile(new URL('../messages-app.js', import.meta.url), 'utf8'),
  readFile(new URL('../thread.html', import.meta.url), 'utf8'),
  readFile(new URL('../messages-chatscope.html', import.meta.url), 'utf8'),
]);

assert.match(messages, /messages-app\.js/);
assert.match(messages, /messenger-app\.css/);
assert.doesNotMatch(messages, /chatscope|Operations Leadership Chat/i);
assert.match(messengerClient, /ops_manager_shared_chat_v1/);
assert.match(messengerClient, /Memphis AI/);
assert.match(messengerClient, /function roleTitle/);
assert.match(messengerClient, /user\.role_title \|\| user\.job_title/);
assert.match(messengerClient, /identity\.display_name/);
assert.match(legacyThread, /messages\.html/);
assert.match(legacyChatScope, /messages\.html/);
assert.doesNotMatch(legacyThread, /function messengerRoleTitle/);
assert.doesNotMatch(legacyChatScope, /chatscope-messenger\.js/);

console.log('MESSENGER_LEADERSHIP_TITLE_CONTRACT_PASS');
