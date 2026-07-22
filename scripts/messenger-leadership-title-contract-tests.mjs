import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [messages, thread, chatscope] = await Promise.all([
  readFile(new URL('../messages.html', import.meta.url), 'utf8'),
  readFile(new URL('../thread.html', import.meta.url), 'utf8'),
  readFile(new URL('../mobile/src/chatscope/app.jsx', import.meta.url), 'utf8'),
]);

assert.match(messages, /mapped\.role_title\|\|mapped\.job_title/);
assert.match(messages, /Operations Leadership/);
assert.doesNotMatch(messages, /shared Ops Manager chat/);
assert.doesNotMatch(messages, /All Ops Managers/);

assert.match(thread, /function messengerRoleTitle/);
assert.match(thread, /user\?\.role_title\|\|user\?\.job_title/);
assert.match(thread, /Operations Leadership accounts/);
assert.doesNotMatch(thread, /user\.role==='manager'\?'Ops Manager':'Employee'/);
assert.doesNotMatch(thread, /shared Ops Manager contact/);
assert.match(thread, /Shared by Operations Leadership/);
assert.doesNotMatch(thread, /Shared by all Ops Managers/);

assert.match(chatscope, /function roleTitle/);
assert.match(chatscope, /user\.role_title \|\| user\.job_title/);
assert.match(chatscope, /<span>\{roleTitle\(user\)\}<\/span>/);
assert.match(chatscope, /identity\.display_name} · \$\{roleTitle\(identity\)}/);
assert.doesNotMatch(chatscope, /user\.role === 'manager' \? 'Operations Leadership' : 'Employee'/);

console.log('MESSENGER_LEADERSHIP_TITLE_CONTRACT_PASS');
