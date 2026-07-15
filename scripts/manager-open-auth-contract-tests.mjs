import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('memphis-auth.js','utf8');
const full=fs.readFileSync('ops-manager-hub.html','utf8');
const readonly=fs.readFileSync('ops-manager-read-only.html','utf8');
const hub=fs.readFileSync('start_page1.html','utf8');
const gemini=fs.readFileSync('gemini-admin.html','utf8');

assert.match(auth,/manager\/enroll/);
assert.match(auth,/manager\/logout/);
assert.match(auth,/credentials:'include'/);
assert.match(auth,/memphisOpsManagerSession\.v3/);
assert.match(auth,/sessionStorage/);
assert.doesNotMatch(auth,/writeJsonLocalStorage\(OPS_SESSION_KEY/);
assert.doesNotMatch(auth,/OPS_ACCESS_KEY_STORAGE_KEY|X-Ops-Access-Key/);
assert.match(auth,/Enter the Ops Manager password once for this device/);
assert.match(auth,/requireGeminiAdminSession/);
assert.match(full,/first visit enrolls this device/i);
assert.match(readonly,/first visit enrolls this device/i);
assert.match(full,/accessLevel:'full_access'/);
assert.match(readonly,/accessLevel:'read_only'/);
assert.match(full,/interactive:true/);
assert.match(readonly,/interactive:true/);
assert.match(hub,/requireOpsManagerSession\(\{interactive:true/);
assert.match(gemini,/requireGeminiAdminSession/);
assert.equal((full.match(/memzoo/g)||[]).length,0,'manager entry must not embed the Gemini/Moxie password');
assert.equal((readonly.match(/memzoo/g)||[]).length,0,'read-only manager entry must not embed a password');
console.log('MANAGER_TRUSTED_DEVICE_AUTH_CONTRACT_PASS');
