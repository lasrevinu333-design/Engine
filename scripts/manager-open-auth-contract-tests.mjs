import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('memphis-auth.js','utf8');
const full=fs.readFileSync('ops-manager-hub.html','utf8');
const hub=fs.readFileSync('start_page1.html','utf8');
const access=fs.readFileSync('manager-access.html','utf8');

assert.equal(fs.existsSync('ops-manager-read-only.html'),false);
assert.match(auth,/requestTrustedOpsSession/);
assert.match(auth,/consumeSharedEnrollmentPasscode/);
assert.match(auth,/createSharedEnrollmentWindow/);
assert.match(auth,/disableSharedEnrollmentWindow/);
assert.match(auth,/ops\/shared-enrollment/);
assert.match(auth,/ops\/trusted-devices/);
assert.match(auth,/credentials:'include'/);
assert.doesNotMatch(auth,/ops\/manager-codes|ops\/pairing|ops_pairing_token|OPS_MANAGERS_URL/);
assert.doesNotMatch(auth,/Ops Manager password|Manager password|promptForOneTimeEnrollment|enrollOpsManagerDevice/);
assert.doesNotMatch(auth,/READ_ONLY_MANAGER_ENTRY|ops-manager-read-only\.html/);
assert.doesNotMatch(auth,/localStorage\.[gs]etItem\([^)]*(passcode|manager.*token)/i);

assert.doesNotMatch(full,/type=["']password|manager key/i);
assert.match(full,/shared enrollment passcode/i);
assert.match(hub,/OPS MANAGER HUB ACCESS/);
assert.match(hub,/consumeSharedEnrollmentPasscode/);
assert.match(hub,/hasRole\('CUSTODIAL_MANAGER'/);
assert.doesNotMatch(hub,/Generate PC Invite|Generate Phone Invite|Copy Invite Link|ops_pairing_token/i);

assert.match(access,/MANAGER DEVICE ACCESS/);
assert.match(access,/Generate New 48-Hour Passcode/);
assert.match(access,/Revoke All Non-Eric Devices/);
assert.match(access,/hasRole\('CUSTODIAL_MANAGER'/);
assert.doesNotMatch(access,/Add Manager|Generate PC Invite|Generate Phone Invite|Copy Invite Link|Display Invite QR|ops_pairing_token|enrollment_url/);

console.log('SHARED_48_HOUR_MANAGER_ACCESS_CONTRACT_PASS');
