import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('memphis-auth.js','utf8');
const full=fs.readFileSync('ops-manager-hub.html','utf8');
const hub=fs.readFileSync('start_page1.html','utf8');
const gemini=fs.readFileSync('gemini-admin.html','utf8');

assert.equal(fs.existsSync('ops-manager-read-only.html'),false,'read-only Ops Manager entry must be retired from GitHub Pages');
assert.match(auth,/requestTrustedOpsSession/);
assert.match(auth,/enrollOpsManagerDevice/);
assert.match(auth,/credentials:'include'/);
assert.match(auth,/ops\/enroll/);
assert.match(auth,/remain trusted|only need to do this once/i);
assert.doesNotMatch(auth,/READ_ONLY_MANAGER_ENTRY|ops-manager-read-only\.html/);
assert.match(auth,/function redirectToManagerHub\(\)/);
assert.match(auth,/target\.searchParams\.set\('manager_access','full_access'\)/);
assert.doesNotMatch(auth,/localStorage\.setItem\([^\n]*OPS_SESSION|memphisOpsManagerSession\.v2[^']*';\s*$/m);
assert.doesNotMatch(auth,/OPS_ACCESS_KEY_STORAGE_KEY|X-Ops-Access-Key/);
assert.match(auth,/requireGeminiAdminSession/);

assert.doesNotMatch(full,/type=["']password|manager key/i);
assert.match(full,/accessLevel:'full_access'/);
assert.match(full,/only active manager entry/i);
assert.doesNotMatch(full,/read-only Ops Manager|ops-manager-read-only/i);
assert.match(full,/password once|one time|once on this device/i);

assert.match(hub,/requireOpsManagerSession\(\{accessLevel:'full_access',interactive:true/);
assert.match(hub,/Full-access Ops Manager authorization is required/);
assert.doesNotMatch(hub,/Read-only manager link/);

assert.match(gemini,/id="authGate"/);
assert.match(gemini,/id="consoleApp" class="page" hidden/);
assert.match(gemini,/requireOpsManagerSession\(\{[\s\S]*accessLevel: 'full_access'/);
assert.match(gemini,/requireGeminiAdminSession\(\{ interactive: true \}\)/);
assert.match(gemini,/function lockConsole\(error\)/);
assert.match(gemini,/els\.consoleApp\.hidden = true/);
assert.match(gemini,/Gemini password authentication was not completed/);
assert.match(gemini,/new URL\('\.\/ops-manager-hub\.html'/);
assert.doesNotMatch(gemini,/state\.hub === 'employee'/);

assert.equal((full.match(/memzoo/g)||[]).length,0,'manager entry must not embed the Gemini/Moxie password');
assert.equal((gemini.match(/memzoo/g)||[]).length,0,'Gemini console must not embed a password');
assert.match(full,/release-2026\.07\.17\.custodial-repair\.1/);

console.log('MANAGER_ACCESS_RETIREMENT_CONTRACT_PASS');
