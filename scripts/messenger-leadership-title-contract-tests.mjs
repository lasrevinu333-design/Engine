import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [messages, chatSource, legacyThread, legacyChatScope] = await Promise.all([
  readFile(new URL('../messages.html', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/chatscope/app.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../thread.html', import.meta.url), 'utf8'),
  readFile(new URL('../messages-chatscope.html', import.meta.url), 'utf8'),
]);

assert.match(messages, /chatscope-messenger\.css/);
assert.doesNotMatch(messages, /messenger-runtime-patch\.js/);
assert.match(messages, /chatscope-messenger\.js/);
assert.doesNotMatch(messages, /messages-app\.js|messenger-app\.css|Operations Leadership Chat/);
assert.match(chatSource, /ops_manager_shared_chat_v1/);
assert.match(chatSource, /Memphis AI/);
assert.match(chatSource, /filter\(\(row\) => !isRetiredThread\(row\)\)/);
assert.doesNotMatch(chatSource, /window\.fetch\s*=|MutationObserver/);
assert.match(chatSource, /function roleTitle/);
assert.match(chatSource, /user\.role_title \|\| user\.job_title/);
assert.match(chatSource, /identity\.display_name/);
assert.match(legacyThread, /messages\.html/);
assert.match(legacyChatScope, /messages\.html/);
assert.doesNotMatch(legacyThread, /function messengerRoleTitle/);
assert.doesNotMatch(legacyChatScope, /chatscope-messenger\.js/);

console.log('MESSENGER_LEADERSHIP_TITLE_CONTRACT_PASS');
