import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(name)=>fs.readFileSync(path.resolve(root,name),'utf8');
const auth=read('memphis-auth.js');
const access=read('manager-access.html');
const security=read('device-security.html');
const hub=read('start_page1.html');

for(const symbol of ['consumeSharedEnrollmentPasscode','getSharedEnrollmentStatus','createSharedEnrollmentWindow','disableSharedEnrollmentWindow','renameOpsManagerTrustedDevice','revokeOpsManagerTrustedDevice','revokeAllOpsManagerTrustedDevices'])assert.match(auth,new RegExp(symbol));
assert.match(auth,/DEVICE_SECURITY_URL/);
assert.match(auth,/X-Device-Security-CSRF/);
assert.doesNotMatch(auth,/localStorage\.[gs]etItem\([^)]*deviceSecurity/i);
assert.doesNotMatch(auth,/Fully Kiosk PIN/i);

for(const text of ['MANAGER DEVICE ACCESS','Generate New 48-Hour Passcode','Copy Passcode','Disable Passcode Now','Replace Passcode','View Enrolled Devices','Rename Device','Revoke Device','Revoke All Non-Eric Devices'])assert.match(access,new RegExp(text));
assert.match(access,/shown only now|displayed only now/i);
assert.match(access,/CUSTODIAL_MANAGER/);
assert.doesNotMatch(access,/Add Manager|Select Manager|Select Role|Generate One-Time Code|Generate PC Invite|Generate Phone Invite|Copy Invite Link|Display Invite QR|QRCode|ops_pairing_token|enrollment_url/);
assert.doesNotMatch(access,/type="password"|localStorage\.[gs]etItem\([^)]*(passcode|manager)/i);

assert.match(hub,/OPS MANAGER HUB ACCESS/);
assert.match(hub,/Enrollment passcode/);
assert.match(hub,/consumeSharedEnrollmentPasscode/);
assert.match(hub,/hasRole\('CUSTODIAL_MANAGER'/);
assert.match(hub,/hasRole\('SECURITY_ADMIN'/);
assert.doesNotMatch(hub,/invitation URL|pairing link|one-time manager code/i);

assert.match(security,/Security Admin unlock required/);
assert.match(security,/separate Device Security password/);
assert.match(security,/Unlock for 15 minutes/);
assert.match(security,/window\.MemphisAuth\.unlockDeviceSecurity/);
assert.doesNotMatch(security,/shared.*passcode|ops_pairing_token/i);

console.log('SHARED_MANAGER_PASSWORDLESS_FRONTEND_TESTS_PASS');
