import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [eventsAdmin, messages, messengerCss, notifications, moxie, feedback, phoneAssignments] = await Promise.all([
  readFile('events-admin.html', 'utf8'),
  readFile('messages.html', 'utf8'),
  readFile('messenger-app.css', 'utf8'),
  readFile('mobile/src/manager/notifications.js', 'utf8'),
  readFile('mobile/src/manager/moxie.html', 'utf8'),
  readFile('system-feedback.html', 'utf8'),
  readFile('phone-assignments.html', 'utf8'),
]);
assert.match(eventsAdmin, /object-fit:contain/);
assert.match(eventsAdmin, /flex:0 0 76px/);
assert.match(eventsAdmin, /max-width:min\(620px,100%\)/);
assert.match(eventsAdmin, /overflow-wrap:anywhere/);
assert.match(messages, /messenger-app\.css/);
assert.match(messages, /messages-app\.js/);
assert.match(messengerCss, /@media\(max-width:720px\)/);
assert.match(messengerCss, /\.messengerApp\.threadOpen \.chatPane\{display:grid\}/);
assert.match(messengerCss, /white-space:nowrap;overflow:hidden;text-overflow:ellipsis/);
assert.match(notifications, /Refresh Phone Registration/);
assert.match(notifications, /memphis:notification-received/);
assert.match(moxie, /New Chat/);
assert.match(moxie, /Clear Chat/);
assert.doesNotMatch(feedback, /context-pill|Resolving context/);
assert.match(phoneAssignments, /Phone Assignments/);
assert.match(phoneAssignments, /Add a new employee/);
console.log('NATIVE_MANAGER_UI_REGRESSION_PASS');
