import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('memphis-auth.js','utf8');
const entry=fs.readFileSync('ops-manager-hub.html','utf8');
const hub=fs.readFileSync('start_page1.html','utf8');
const access=fs.readFileSync('manager-access.html','utf8');
const viewer=fs.readFileSync('ops-viewer.html','utf8');
const messenger=fs.readFileSync('messages.html','utf8');
const messengerPatch=fs.readFileSync('messenger-runtime-patch.js','utf8');
const legacyChatScope=fs.readFileSync('messages-chatscope.html','utf8');
const phoneAssignments=fs.readFileSync('phone-assignments.html','utf8');
const phoneAssignmentsJs=fs.readFileSync('phone-assignments.js','utf8');
const managerMobile=fs.readFileSync('mobile/src/manager/index.html','utf8');
const custodialMobile=fs.readFileSync('mobile/src/custodial/index.html','utf8');
const liveWorkflow=fs.readFileSync('.github/workflows/foundation-repair-live.yml','utf8');
const releaseManifest=JSON.parse(fs.readFileSync('frontend-release-manifest.json','utf8'));

assert.equal(fs.existsSync('ops-manager-read-only.html'),false);
assert.equal(fs.existsSync('ops-viewer.html'),true);
assert.match(auth,/requestTrustedOpsSession/);
assert.match(auth,/ops\/trusted-devices/);
assert.match(auth,/credentials:'include'/);
assert.doesNotMatch(auth,/consumeSharedEnrollmentPasscode|createSharedEnrollmentWindow|ops\/shared-enrollment/);
assert.doesNotMatch(auth,/Ops Manager password|Manager password|promptForOneTimeEnrollment|enrollOpsManagerDevice/);
assert.doesNotMatch(auth,/READ_ONLY_MANAGER_ENTRY|ops-manager-read-only\.html/);
assert.doesNotMatch(auth,/localStorage\.[gs]etItem\([^)]*(passcode|manager.*token)/i);

assert.doesNotMatch(entry,/type=["']password|manager key/i);
assert.match(entry,/personal enrollment code/i);
assert.match(entry,/auth-api\/ops\/manager-codes\/consume/);
assert.match(entry,/read-only Viewer/i);

assert.match(hub,/Named manager enrollment required/);
assert.match(hub,/ops-manager-hub\.html/);
assert.match(hub,/hasRole\('CUSTODIAL_MANAGER'/);
assert.match(hub,/Annie Feist/);
assert.match(hub,/messages\.html/);
assert.doesNotMatch(hub,/consumeSharedEnrollmentPasscode|shared enrollment passcode/i);

assert.match(messenger,/chatscope-messenger\.css/);
assert.match(messenger,/messenger-runtime-patch\.js/);
assert.match(messenger,/chatscope-messenger\.js/);
assert.match(messengerPatch,/ops_manager_shared_chat_v1/);
assert.match(messengerPatch,/Memphis AI/);
assert.match(legacyChatScope,/messages\.html/);
assert.match(phoneAssignments,/Phone Assignments/);
assert.match(phoneAssignmentsJs,/Generate App Code/);
assert.match(phoneAssignmentsJs,/enrollment-code/);

assert.match(managerMobile,/Phone Assignments/);
assert.doesNotMatch(managerMobile,/dashboard\.html#locations/);
assert.match(managerMobile,/navLabel">Status</);
assert.match(custodialMobile,/Assigned Areas/);
assert.doesNotMatch(custodialMobile,/>Scanner</);

assert.match(access,/OPERATIONS LEADERSHIP ACCESS/);
assert.match(access,/Generate Personal Code/);
assert.match(access,/leadership-api\/roster/);
assert.match(access,/leadership-api\/managers\/.*enrollment-code/);
assert.match(access,/auth-api\/ops\/trusted-devices/);
assert.match(access,/hasRole\('CUSTODIAL_MANAGER'/);
assert.doesNotMatch(access,/48-Hour|shared enrollment|Generate PC Invite|Generate Phone Invite|ops_pairing_token/i);

assert.match(viewer,/read-only/i);
assert.doesNotMatch(viewer,/Messenger|Moxie|Scheduler|Device Security|Manager Access/i);

assert.match(liveWorkflow,/Named Leadership Browser Live Acceptance/);
assert.match(liveWorkflow,/manager-codes\/consume/);
assert.match(liveWorkflow,/Generate Personal Code/);
assert.match(liveWorkflow,/ops-manager-auth\.v5\.named-leadership/);
assert.doesNotMatch(liveWorkflow,/Verify published shared manager-enrollment release/);
assert.doesNotMatch(liveWorkflow,/grep -Fq ['"]ops\/shared-enrollment/);
assert.equal(releaseManifest.api_contract_versions.ops_manager_auth,'ops-manager-auth.v5.named-leadership');

console.log('NAMED_OPERATIONS_LEADERSHIP_ACCESS_CONTRACT_PASS');
