import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.resolve(root, name), 'utf8');
const source = read('memphis-device-identity.js');

assert.match(source, /release-2026\.07\.17\.custodial-repair\.1/);
assert.match(source, /credentials:'include'/);
assert.match(source, /X-Device-Id/);
assert.match(source, /device_credential_required/);
assert.match(source, /enrollment\.required&&!enrollment\.retry/);
assert.match(source, /if\(enrollment\.retry\)/);
assert.match(source, /memphis-device-enrolled/);
assert.match(source, /isManagerAuthRequest/);
assert.match(source, /opsManagerAuthHeaders/);
assert.match(source, /did not retain its protected cookie/);
assert.match(source, /refreshCredentialStatus\(\{force:true\}\)/);
assert.match(source, /enrollment code/i);
assert.doesNotMatch(source, /localStorage\.clear\s*\(/);
assert.doesNotMatch(source, /removeItem\([^)]*session:/i);
assert.doesNotMatch(source, /removeItem\([^)]*mz_scan_queue/i);

const calls = [];
const localStorage = {
  values: new Map([['mz_scan_device_id', 'KIOSK_06']]),
  getItem(key) { return this.values.get(key) || ''; },
  setItem(key, value) { this.values.set(key, value); },
};
const fakeFetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(input, init);
  calls.push(request);
  return new Response(JSON.stringify({ ok: true, data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
const context = {
  URL, Request, Headers, Response,
  navigator: { userAgent: 'FullyKiosk' },
  localStorage,
  window: {
    location: { href: 'https://lasrevinu333-design.github.io/Engine/messages.html?device=KIOSK_06' },
    fetch: fakeFetch,
    Request,
    Headers,
    fully: null,
  },
};
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'memphis-device-identity.js' });

await context.window.fetch('https://memphis-zoo-mcp.onrender.com/messaging-api/threads?device_id=KIOSK_06');
assert.equal(calls.length, 1);
assert.equal(calls[0].credentials, 'include');
assert.equal(calls[0].headers.get('x-device-id'), 'KIOSK_06');

// The shared manager scan device remains compatible with the device boundary by
// attaching its silently refreshed Ops session. Auth bootstrap requests themselves
// must bypass this injection to avoid recursive session refresh deadlock.
const managerCalls=[];
let managerHeaderCalls=0;
const managerStorage={
  values:new Map([['mz_scan_device_id','KIOSK_01']]),
  getItem(key){return this.values.get(key)||'';},
  setItem(key,value){this.values.set(key,value);},
};
const managerFetch=async(input,init={})=>{
  const request=input instanceof Request?input:new Request(input,init);
  managerCalls.push(request);
  return new Response(JSON.stringify({ok:true,data:{}}),{status:200,headers:{'Content-Type':'application/json'}});
};
const managerContext={
  URL,Request,Headers,Response,
  navigator:{userAgent:'FullyKiosk'},
  localStorage:managerStorage,
  window:{
    location:{href:'https://lasrevinu333-design.github.io/Engine/index.html?device=KIOSK_01'},
    fetch:managerFetch,Request,Headers,fully:null,
    MemphisAuth:{async opsManagerAuthHeaders(){managerHeaderCalls+=1;return{Authorization:'Bearer manager-token','X-Device-Id':'KIOSK_01'};}},
  },
};
managerContext.window.window=managerContext.window;
vm.runInNewContext(source,managerContext,{filename:'memphis-device-identity-manager.js'});
await managerContext.window.fetch('https://memphis-zoo-mcp.onrender.com/scan-api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(managerCalls.at(-1).headers.get('authorization'),'Bearer manager-token');
assert.equal(managerHeaderCalls,1);
await managerContext.window.fetch('https://memphis-zoo-mcp.onrender.com/auth-api/session');
assert.equal(managerHeaderCalls,1,'auth bootstrap requests must not recursively request manager headers');

// A successful enroll-mode response can carry a nonblocking enrollment hint.
// It must not be replayed: replaying a POST would duplicate scans, messages,
// acknowledgements, or completion submissions.
const hintedCalls = [];
const hintedFetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(input, init);
  hintedCalls.push(request);
  return new Response(JSON.stringify({ ok: true, data: { committed: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Device-Enrollment-Required': 'true' },
  });
};
const hintedContext = {
  URL, Request, Headers, Response,
  navigator: { userAgent: 'FullyKiosk' },
  localStorage,
  window: {
    location: { href: 'https://lasrevinu333-design.github.io/Engine/index.html?device=KIOSK_06' },
    fetch: hintedFetch,
    Request,
    Headers,
    fully: null,
  },
};
hintedContext.window.window = hintedContext.window;
vm.runInNewContext(source, hintedContext, { filename: 'memphis-device-identity-hint.js' });
const hintedResponse = await hintedContext.window.fetch('https://memphis-zoo-mcp.onrender.com/scan-api/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fn: 'tool_record_scan_event', args: { p_device_id: 'KIOSK_06' } }),
});
assert.equal(hintedResponse.status, 200);
assert.equal(hintedCalls.length, 1, 'successful enroll-mode responses must not be replayed after an enrollment hint');

const identity = context.window.MemphisDeviceIdentity.resolve({ url: new URL(context.window.location.href) });
assert.equal(identity.deviceId, 'KIOSK_06');
assert.equal(identity.source, 'storage_canonical');

const protectedPages = [
  'employee-hub.html',
  'employee-schedule.html',
  'events.html',
  'index.html',
  'messages.html',
  'thread.html',
];
for (const page of protectedPages) {
  assert.match(read(page), /memphis-device-identity\.js\?v=release-2026\.07\.17\.custodial-repair\.1/);
}

const securityPage = read('device-security.html');
assert.match(securityPage, /Device Security/);
assert.match(securityPage, /Security Admin unlock required/);
assert.match(securityPage, /separate Device Security password/);
assert.match(securityPage, /Unlock for 15 minutes/);
assert.match(securityPage, /window\.MemphisAuth\.unlockDeviceSecurity/);
assert.match(securityPage, /window\.MemphisAuth\.deviceSecurityAuthHeaders/);
assert.match(securityPage, /\/admin-api\/device-security/);
assert.match(securityPage, /\/admin-api\/device-auth/);
assert.match(securityPage, /Generate Code/);
assert.match(securityPage, /Revoke Code/);
assert.match(securityPage, /Revoke All Security Sessions/);
assert.match(securityPage, /Enforce credentials/);
assert.match(securityPage, /ready_to_enforce/);
assert.match(securityPage, /Registry row missing/);
assert.match(securityPage, /Device inactive/);
assert.match(securityPage, /No employee assigned/);
assert.match(securityPage, /Assigned employee inactive/);
assert.match(securityPage, /Assignment is not custodial/);
assert.match(securityPage, /Credential issued — awaiting phone confirmation/);
assert.match(securityPage, /data-code[^>]+disabled aria-disabled/);
assert.match(securityPage, /Number\(coverage\.ready\|\|0\)/);
assert.match(securityPage, /Codes are generated server-side, stored only as hashes, and displayed once/i);
assert.doesNotMatch(securityPage, /ops_pairing_token/);
assert.doesNotMatch(securityPage, /localStorage\.setItem\([^)]*deviceSecurity/i);

const managerHub = read('start_page1.html');
assert.match(managerHub, /id="device-security-link"/);
assert.match(managerHub, /device-security\.html/);
assert.match(managerHub, /id="manager-access-link"/);
assert.match(managerHub, /manager-access\.html/);
assert.match(managerHub, /readOnlyDisabled/);
assert.match(managerHub, /deviceSecurityLink/);
assert.match(managerHub, /managerAccessLink/);
assert.match(managerHub, /hasRole\('SECURITY_ADMIN'/);

console.log('DEVICE_CREDENTIAL_FRONTEND_FOUNDATION_TESTS_PASS');
