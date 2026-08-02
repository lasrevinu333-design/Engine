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
const hubController=read('ops-hub.js');
const viewer=read('ops-viewer.html');

for(const symbol of ['requestTrustedOpsSession','renameOpsManagerTrustedDevice','revokeOpsManagerTrustedDevice','revokeAllOpsManagerTrustedDevices'])assert.match(auth,new RegExp(symbol));
for(const symbol of ['consumeSharedEnrollmentPasscode','getSharedEnrollmentStatus','createSharedEnrollmentWindow','disableSharedEnrollmentWindow'])assert.match(auth,new RegExp(symbol));
assert.match(auth,/DEVICE_SECURITY_URL/);
assert.match(auth,/X-Device-Security-CSRF/);
assert.match(auth,/ops\/trusted-devices/);
assert.match(auth,/credentials:'include'/);
assert.match(auth,/ops\/shared-enrollment/);
assert.doesNotMatch(auth,/ops\/manager-codes/);
assert.doesNotMatch(auth,/localStorage\.[gs]etItem\([^)]*(passcode|manager.*token|deviceSecurity)/i);
assert.doesNotMatch(auth,/Fully Kiosk PIN/i);

assert.match(entry,/shared enrollment passcode/i);
assert.match(entry,/consumeSharedEnrollmentPasscode/);
assert.doesNotMatch(entry,/manager-codes\/consume|personal enrollment code/i);
assert.match(entry,/read-only Viewer/i);

for(const text of ['OPERATIONS LEADERSHIP ACCESS','Browser Enrollment Window','Generate New 48-Hour Passcode','Native App Enrollment','Generate App Code','Trusted Devices','Rename','Revoke'])assert.match(access,new RegExp(text));
assert.match(access,/personal, single-use 15-minute code/i);
assert.match(access,/getSharedEnrollmentStatus/);
assert.match(access,/createSharedEnrollmentWindow/);
assert.match(access,/disableSharedEnrollmentWindow/);
assert.match(access,/leadership-api\/roster/);
assert.match(access,/leadership-api\/managers\/.*enrollment-code/);
assert.match(access,/listOpsManagerTrustedDevices/);
assert.match(access,/CUSTODIAL_MANAGER/);
assert.match(access,/displayed only now/i);
assert.doesNotMatch(access,/Generate Personal Code|Generate PC Invite|Generate Phone Invite|Copy Invite Link|Display Invite QR|QRCode|ops_pairing_token|enrollment_url/i);
assert.doesNotMatch(access,/type="password"|localStorage\.[gs]etItem\([^)]*(passcode|manager)/i);

assert.match(hub,/ops-hub\.js/);
assert.match(hubController,/Operations Leadership enrollment required/);
assert.match(hubController,/ops-manager-hub\.html/);
assert.match(hubController,/hasRole\('CUSTODIAL_MANAGER'/);
assert.match(hubController,/hasRole\('SECURITY_ADMIN'/);
assert.match(hubController,/Annie Feist/);
assert.doesNotMatch(hub+hubController,/manager-codes\/consume/i);

assert.match(security,/Security Admin unlock required/);
assert.match(security,/separate Device Security password/);
assert.match(security,/Unlock for 15 minutes/);
assert.match(security,/window\.MemphisAuth\.unlockDeviceSecurity/);
assert.doesNotMatch(security,/shared.*passcode|ops_pairing_token/i);

assert.match(viewer,/read-only/i);
assert.doesNotMatch(viewer,/Messenger|Moxie|Scheduler|Device Security|Manager Access/i);

console.log('NAMED_MANAGER_PASSWORDLESS_FRONTEND_TESTS_PASS');
