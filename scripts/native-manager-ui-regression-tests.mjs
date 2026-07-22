import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [eventsAdmin, messages, chatTheme, notifications] = await Promise.all([
  readFile('events-admin.html', 'utf8'),
  readFile('messages.html', 'utf8'),
  readFile('mobile/src/chatscope/theme.css', 'utf8'),
  readFile('mobile/src/manager/notifications.js', 'utf8'),
]);
assert.match(eventsAdmin, /object-fit:contain/);
assert.match(eventsAdmin, /flex:0 0 76px/);
assert.match(eventsAdmin, /max-width:min\(620px,100%\)/);
assert.match(eventsAdmin, /overflow-wrap:anywhere/);
assert.match(messages, /overflow-wrap:anywhere;white-space:normal;line-height:1\.2/);
assert.match(chatTheme, /@media\(max-width:480px\)/);
assert.match(chatTheme, /grid-template-areas:'back brand new' 'memphis memphis memphis'/);
assert.match(chatTheme, /height:calc\(100% - 124px\)/);
assert.match(notifications, /Refresh Phone Registration/);
console.log('NATIVE_MANAGER_UI_REGRESSION_PASS');
