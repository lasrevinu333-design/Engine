import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('memphis-auth.js','utf8');
const entry=fs.readFileSync('ops-manager-hub.html','utf8');
const hub=fs.readFileSync('start_page1.html','utf8');
const hubClient=fs.readFileSync('ops-hub.js','utf8');
const access=fs.readFileSync('manager-access.html','utf8');
const viewer=fs.readFileSync('ops-viewer.html','utf8');
const messenger=fs.readFileSync('messages.html','utf8');
const messengerApp=fs.readFileSync('mobile/src/chatscope/app.jsx','utf8');
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

assert.match(hub,/Memphis Zoo Ops/);
assert.match(hub,/ops-hub\.js/);
assert.match(hub,/messages\.html/);
assert.match(hub,/Insights &amp; Inspections/);
assert.match(hubClient,/Named manager enrollment required/);
assert.match(hubClient,/ops-manager-hub\.html/);
assert.match(hubClient,/hasRole\('CUSTODIAL_MANAGER'/);
assert.match(hubClient,/Annie Feist/);
assert.match(hubClient,/accessLevel:'full_access'/);
assert.doesNotMatch(hub+hubClient,/consumeSharedEnrollmentPasscode|shared enrollment passcode/i);

assert.match(messenger,/chatscope-messenger\.css/);
assert.doesNotMatch(messenger,/messenger-runtime-patch\.js/);
assert.match(messenger,/chatscope-messenger\.js/);
assert.equal(fs.existsSync('messenger-runtime-patch.js'),false);
assert.match(messengerApp,/ops_manager_shared_chat_v1/);
assert.match(messengerApp,/Memphis AI/);
assert.doesNotMatch(messengerApp,/window\.fetch\s*=|MutationObserver/);
assert.match(legacyChatScope,/messages\.html/);
assert.match(phoneAssignments,/Phone Assignments/);
assert.match(phoneAssignmentsJs,/Generate App Code/);
assert.match(phoneAssignmentsJs,/enrollment-code/);

assert.match(managerMobile,/Phone Assignments/);
assert.match(managerMobile,/Insights &amp; Inspections/);
assert.doesNotMatch(managerMobile,/dashboard\.html#locations/);
assert.match(managerMobile,/navLabel">Status</);
assert.match(custodialMobile,/Memphis Zoo Custodial/);
for (const label of ['Schedule', 'Messages', 'Events', 'Feedback']) assert.match(custodialMobile,new RegExp(`>${label}<`));
assert.doesNotMatch(custodialMobile,/Assigned Areas|bottomNav|navLabel/);
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
assert.match(liveWorkflow,/! grep -Fq 'messenger-runtime-patch\.js'/);
assert.match(liveWorkflow,/grep -Fq 'employeeDeviceAuthority'/);
assert.match(liveWorkflow,/grep -Fq 'ops_manager_shared_chat_v1'/);
assert.doesNotMatch(liveWorkflow,/Verify published shared manager-enrollment release/);
assert.doesNotMatch(liveWorkflow,/grep -Fq ['"]ops\/shared-enrollment/);
assert.equal(releaseManifest.api_contract_versions.ops_manager_auth,'ops-manager-auth.v5.named-leadership');
assert.equal(releaseManifest.api_contract_versions.operational_analytics,'operational-analytics.v1');

console.log('NAMED_OPERATIONS_LEADERSHIP_ACCESS_CONTRACT_PASS');
