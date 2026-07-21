import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(name)=>fs.readFileSync(path.resolve(root,name),'utf8');
const auth=read('memphis-auth.js');
const entry=read('ops-manager-hub.html');
const access=read('manager-access.html');
const security=read('device-security.html');
const hub=read('start_page1.html');
const viewer=read('ops-viewer.html');

for(const symbol of ['requestTrustedOpsSession','renameOpsManagerTrustedDevice','revokeOpsManagerTrustedDevice','revokeAllOpsManagerTrustedDevices'])assert.match(auth,new RegExp(symbol));
assert.match(auth,/DEVICE_SECURITY_URL/);
assert.match(auth,/X-Device-Security-CSRF/);
assert.match(auth,/ops\/trusted-devices/);
assert.match(auth,/credentials:'include'/);
assert.doesNotMatch(auth,/consumeSharedEnrollmentPasscode|createSharedEnrollmentWindow|disableSharedEnrollmentWindow|ops\/shared-enrollment/);
assert.doesNotMatch(auth,/localStorage\.[gs]etItem\([^)]*(passcode|manager.*token|deviceSecurity)/i);
assert.doesNotMatch(auth,/Fully Kiosk PIN/i);

assert.match(entry,/personal enrollment code/i);
assert.match(entry,/auth-api\/ops\/manager-codes\/consume/);
assert.match(entry,/read-only Viewer/i);
assert.doesNotMatch(entry,/shared enrollment|48-hour passcode/i);

for(const text of ['OPERATIONS LEADERSHIP ACCESS','Leadership Accounts','Generate Personal Code','Trusted Devices','Rename','Revoke'])assert.match(access,new RegExp(text));
assert.match(access,/single-use, 15-minute code/i);
assert.match(access,/leadership-api\/roster/);
assert.match(access,/leadership-api\/managers\/.*enrollment-code/);
assert.match(access,/auth-api\/ops\/trusted-devices/);
assert.match(access,/CUSTODIAL_MANAGER/);
assert.match(access,/displayed only now/i);
assert.doesNotMatch(access,/48-Hour|shared enrollment|Generate PC Invite|Generate Phone Invite|Copy Invite Link|Display Invite QR|QRCode|ops_pairing_token|enrollment_url/i);
assert.doesNotMatch(access,/type="password"|localStorage\.[gs]etItem\([^)]*(passcode|manager)/i);

assert.match(hub,/Named manager enrollment required/);
assert.match(hub,/ops-manager-hub\.html/);
assert.match(hub,/hasRole\('CUSTODIAL_MANAGER'/);
assert.match(hub,/hasRole\('SECURITY_ADMIN'/);
assert.match(hub,/Annie Feist/);
assert.doesNotMatch(hub,/consumeSharedEnrollmentPasscode|shared enrollment passcode/i);

assert.match(security,/Security Admin unlock required/);
assert.match(security,/separate Device Security password/);
assert.match(security,/Unlock for 15 minutes/);
assert.match(security,/window\.MemphisAuth\.unlockDeviceSecurity/);
assert.doesNotMatch(security,/shared.*passcode|ops_pairing_token/i);

assert.match(viewer,/read-only/i);
assert.doesNotMatch(viewer,/Messenger|Moxie|Scheduler|Device Security|Manager Access/i);

console.log('NAMED_MANAGER_PASSWORDLESS_FRONTEND_TESTS_PASS');
