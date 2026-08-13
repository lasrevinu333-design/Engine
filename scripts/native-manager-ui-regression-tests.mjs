import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [eventsAdmin, messages, chatCss, mobileOverrides, nativeLayout, notifications, moxie, feedback, phoneAssignments, phoneAssignmentsJs, managerHtml, custodialHtml] = await Promise.all([
  readFile('events-admin.html', 'utf8'),
  readFile('messages.html', 'utf8'),
  readFile('chatscope-messenger.css', 'utf8'),
  readFile('chatscope-mobile-overrides.css', 'utf8'),
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
assert.match(messages, /chatscope-messenger\.css/);
assert.doesNotMatch(messages, /messenger-runtime-patch\.js/);
assert.match(messages, /chatscope-messenger\.js/);
assert.doesNotMatch(messages, /messenger-app\.css|messages-app\.js/);
assert.match(chatCss, /@media\(max-width:480px\)/);
assert.match(mobileOverrides, /mz-chat-system-guard/);
assert.match(mobileOverrides, /cs-message-input__content-editor-wrapper:focus-within/);
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
assert.match(phoneAssignments, /schedule-weekly\.html/);
assert.doesNotMatch(phoneAssignments, /Add a new employee|new-employee-form/);
assert.doesNotMatch(phoneAssignmentsJs, /new_employee_name|deactivate_previous/);
assert.match(phoneAssignmentsJs, /Generate App Code/);
assert.match(phoneAssignmentsJs, /enrollment-code/);
assert.doesNotMatch(managerHtml, /dashboard\.html#locations/);
for (const label of ['Home','Messages','Schedule','Status','More']) assert.match(managerHtml, new RegExp(`navLabel">${label}<`));
assert.match(custodialHtml, /Assigned Areas/);
assert.doesNotMatch(custodialHtml, /scan-location-qr|NFC Tag Unavailable|QR fallback/i);
assert.doesNotMatch(custodialHtml, /id="scan-status"/);
assert.match(custodialHtml, /NFC is always ready/);
assert.doesNotMatch(custodialHtml, />Scanner</);
console.log('NATIVE_MANAGER_UI_REGRESSION_PASS');
