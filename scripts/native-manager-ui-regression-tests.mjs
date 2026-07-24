import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [eventsAdmin, messages, messengerCss, messengerClient, nativeLayout, notifications, moxie, feedback, phoneAssignments, phoneAssignmentsJs, managerHtml, custodialHtml] = await Promise.all([
  readFile('events-admin.html', 'utf8'),
  readFile('messages.html', 'utf8'),
  readFile('messenger-app.css', 'utf8'),
  readFile('messages-app.js', 'utf8'),
  readFile('mobile/src/shared/native-layout.js', 'utf8'),
  readFile('mobile/src/manager/notifications.js', 'utf8'),
  readFile('mobile/src/manager/moxie.html', 'utf8'),
  readFile('system-feedback.html', 'utf8'),
  readFile('phone-assignments.html', 'utf8'),
  readFile('phone-assignments.js', 'utf8'),
  readFile('mobile/src/manager/index.html', 'utf8'),
  readFile('mobile/src/custodial/index.html', 'utf8'),
]);
assert.match(eventsAdmin, /object-fit:contain/);
assert.match(eventsAdmin, /flex:0 0 76px/);
assert.match(eventsAdmin, /max-width:min\(620px,100%\)/);
assert.match(eventsAdmin, /overflow-wrap:anywhere/);
assert.match(messages, /messenger-app\.css/);
assert.match(messages, /messages-app\.js/);
assert.doesNotMatch(messages, /chatscope/i);
assert.match(messengerCss, /@media\(max-width:720px\)/);
assert.match(messengerCss, /\.threadSwipe\.revealed/);
assert.match(messengerClient, /function startThreadSwipe/);
assert.doesNotMatch(messengerClient, /\bconfirm\s*\(/);
assert.match(nativeLayout, /--mz-native-bottom-guard/);
assert.match(nativeLayout, /--mz-back-width:116px/);
assert.match(nativeLayout, /status-not_cleaned/);
assert.match(nativeLayout, /#advanced-link/);
assert.match(notifications, /Refresh Phone Registration/);
assert.match(notifications, /memphis:notification-received/);
assert.match(moxie, /New Chat/);
assert.match(moxie, /Clear Chat/);
assert.doesNotMatch(feedback, /context-pill|Resolving context/);
assert.match(phoneAssignments, /Phone Assignments/);
assert.match(phoneAssignments, /Add a new employee/);
assert.match(phoneAssignmentsJs, /Generate App Code/);
assert.match(phoneAssignmentsJs, /enrollment-code/);
assert.doesNotMatch(managerHtml, /dashboard\.html#locations/);
for (const label of ['Home','Messages','Schedule','Status','More']) assert.match(managerHtml, new RegExp(`navLabel">${label}<`));
assert.match(custodialHtml, /Assigned Areas/);
assert.match(custodialHtml, /Scan without opening a scanner page/);
assert.doesNotMatch(custodialHtml, />Scanner</);
console.log('NATIVE_MANAGER_UI_REGRESSION_PASS');
