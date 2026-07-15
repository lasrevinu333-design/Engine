import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('memphis-auth.js','utf8');
const full=fs.readFileSync('ops-manager-hub.html','utf8');
const readonly=fs.readFileSync('ops-manager-read-only.html','utf8');
const hub=fs.readFileSync('start_page1.html','utf8');
const gemini=fs.readFileSync('gemini-admin.html','utf8');

assert.match(auth,/requestPublicOpsSession/);
assert.match(auth,/access_level/);
assert.doesNotMatch(auth,/OPS_ACCESS_KEY_STORAGE_KEY|X-Ops-Access-Key/);
assert.match(auth,/requireGeminiAdminSession/);
assert.doesNotMatch(full,/type=["']password|manager key/i);
assert.doesNotMatch(readonly,/type=["']password|manager key/i);
assert.match(full,/accessLevel:'full_access'/);
assert.match(readonly,/accessLevel:'read_only'/);
assert.match(full,/No manager password or key is required/);
assert.match(readonly,/read-only manager view opens directly/i);
assert.match(hub,/requireOpsManagerSession/);
assert.match(gemini,/requireGeminiAdminSession/);
assert.equal((full.match(/memzoo/g)||[]).length,0,'manager entry must not embed the Gemini/Moxie password');
assert.equal((readonly.match(/memzoo/g)||[]).length,0,'read-only manager entry must not embed a password');
console.log('MANAGER_OPEN_AUTH_CONTRACT_PASS');
