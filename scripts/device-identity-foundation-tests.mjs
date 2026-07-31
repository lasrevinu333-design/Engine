import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scan = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const identity = readFileSync(new URL('../memphis-device-identity.js', import.meta.url), 'utf8');

const resolverDefinitions = scan.match(/function\s+getFullyDeviceId\s*\(/g) || [];
assert.equal(resolverDefinitions.length, 1, 'index.html must define getFullyDeviceId exactly once');
assert.match(scan, /MemphisDeviceIdentity\?\.resolveFullyIdentifier/);

const resolver = scan.match(/function\s+getFullyDeviceId\s*\([^)]*\)\s*\{[\s\S]*?return'';\}/)?.[0] || '';
assert.ok(resolver, 'canonical getFullyDeviceId implementation must be present');
assert.ok(resolver.indexOf("'getDeviceId'") < resolver.indexOf("'getDeviceName'"), 'hardware ID must be checked before friendly device name');
assert.match(identity, /const fullyCanonical=fully\.find\(\(candidate\)=>isCanonicalKiosk\(candidate\.value\)\)/);
assert.match(identity, /if\(!enrollmentNeeded&&overlay\)/);
assert.match(identity, /enrollment_required:false[\s\S]*status_unavailable:true/);
assert.doesNotMatch(scan, /if\(typeof fully\.getDeviceName==="function"\)[\s\S]{0,500}if\(typeof fully\.getDeviceId==="function"\)/);

console.log('DEVICE_IDENTITY_FOUNDATION_TESTS_PASS');
