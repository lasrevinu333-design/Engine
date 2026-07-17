import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.resolve(root, name), 'utf8');

const auth = read('memphis-auth.js');
const managerAccess = read('manager-access.html');
const deviceSecurity = read('device-security.html');
const startPage = read('start_page1.html');
const qr = read('qrcode.min.js');

assert.match(auth, /OPS_MANAGERS_URL/);
assert.match(auth, /DEVICE_SECURITY_URL/);
assert.match(auth, /listOpsManagers/);
assert.match(auth, /createOpsManager/);
assert.match(auth, /createOpsManagerInvitation/);
assert.match(auth, /revokeOpsManagerSessions/);
assert.match(auth, /deviceSecuritySession/);
assert.match(auth, /unlockDeviceSecurity/);
assert.match(auth, /lockDeviceSecurity/);
assert.match(auth, /deviceSecurityAuthHeaders/);
assert.match(auth, /X-Device-Security-CSRF/);
assert.doesNotMatch(auth, /localStorage\.[gs]etItem\([^)]*deviceSecurity/i);
assert.doesNotMatch(auth, /Fully Kiosk PIN/i);

assert.match(managerAccess, /MANAGER ACCESS/);
assert.match(managerAccess, /Add Manager/);
assert.match(managerAccess, /Generate PC Invite/);
assert.match(managerAccess, /Generate Phone Invite/);
assert.match(managerAccess, /Additional Device Invite/);
assert.match(managerAccess, /Copy Invite Link/);
assert.match(managerAccess, /Display Invite QR/);
assert.match(managerAccess, /QRCode\.toCanvas/);
assert.match(managerAccess, /createOpsManagerInvitation/);
assert.match(managerAccess, /revokeOpsManagerTrustedDevice/);
assert.match(managerAccess, /revokeOpsManagerSessions/);
assert.match(managerAccess, /revokeOpsManager/);
assert.match(managerAccess, /DIRECTOR/);
assert.match(managerAccess, /SECURITY_ADMIN/);
assert.match(managerAccess, /ttl_seconds:86400/);
assert.match(managerAccess, /max_uses:1/);
assert.doesNotMatch(managerAccess, /type="password"/i);
assert.doesNotMatch(managerAccess, /unlockDeviceSecurity/);
assert.doesNotMatch(managerAccess, /localStorage\.[gs]etItem\([^)]*manager/i);
assert.doesNotMatch(managerAccess, /api\.qrserver|chart\.googleapis|quickchart/i);

assert.match(qr, /QRCode/);
assert.doesNotMatch(managerAccess, /https?:\/\/(?:api\.qrserver|chart\.googleapis|quickchart)/i);

assert.match(startPage, /manager-access\.html/);
assert.match(startPage, /device-security\.html/);
assert.match(startPage, /Manager device enrollment required/);
assert.match(startPage, /opens normally without a password/);
assert.match(startPage, /hasRole\('DIRECTOR'/);
assert.match(startPage, /hasRole\('SECURITY_ADMIN'/);

assert.match(deviceSecurity, /Security Admin unlock required/);
assert.match(deviceSecurity, /separate Device Security password/);
assert.match(deviceSecurity, /Unlock for 15 minutes/);
assert.match(deviceSecurity, /window\.MemphisAuth\.unlockDeviceSecurity/);
assert.match(deviceSecurity, /window\.MemphisAuth\.deviceSecurityAuthHeaders/);
assert.match(deviceSecurity, /Revoke All Security Sessions/);
assert.match(deviceSecurity, /Copy Code/);
assert.match(deviceSecurity, /Revoke Code/);
assert.doesNotMatch(deviceSecurity, /ops_pairing_token/);
assert.doesNotMatch(deviceSecurity, /localStorage\.[gs]etItem\([^)]*security/i);

console.log('MANAGER_PASSWORDLESS_ACCESS_FRONTEND_TESTS_PASS');
