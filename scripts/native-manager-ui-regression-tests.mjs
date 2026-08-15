import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

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

const notificationRoutes = [];
globalThis.window = {
  location: {
    href: 'https://lasrevinu333-design.github.io/index.html',
    origin: 'https://lasrevinu333-design.github.io',
    assign(route) { notificationRoutes.push(route); },
  },
};
const { routeNotificationAction } = await import('../mobile/src/manager/notifications-client.js');
assert.equal(routeNotificationAction({ notification: { data: { route: './messages-chatscope.html?thread_id=thread-42' } } }), true);
assert.equal(notificationRoutes[0], 'https://lasrevinu333-design.github.io/messages-chatscope.html?thread_id=thread-42');
assert.equal(routeNotificationAction({ notification: { data: { route: 'https://example.invalid/messages-chatscope.html?thread_id=thread-42' } } }), false);
assert.equal(notificationRoutes.length, 1, 'notification actions must reject off-origin routes');

async function exercisePhoneAssignment({ initialAssignment, actualAssignment, includeAssignmentField = true }) {
  const calls = [];
  const listeners = new Map();
  const nextEmployee = '00000000-0000-4000-8000-000000000202';
  const employees = [
    { id: '00000000-0000-4000-8000-000000000201', display_name: 'Current Employee', employee_code: 'EMP201', assigned_device_id: initialAssignment ? 'KIOSK_02' : null },
    { id: nextEmployee, display_name: 'Next Employee', employee_code: 'EMP202', assigned_device_id: null },
  ];
  const device = {
    device_id: 'KIOSK_02', device_name: 'Employee Phone', employee_name: initialAssignment ? 'Current Employee' : null,
  };
  if (includeAssignmentField) device.assigned_employee_id = initialAssignment;
  const data = { employees, devices: [device] };
  const makeElement = (id) => ({
    id, value: '', textContent: '', innerHTML: '', className: '', disabled: false, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, listener) { listeners.set(`${id}:${type}`, listener); },
  });
  const list = makeElement('phone-list');
  const status = makeElement('assignment-status');
  const search = makeElement('phone-search');
  const refresh = makeElement('refresh-assignments');
  const toast = makeElement('assignment-toast');
  const employeeSelect = { value: nextEmployee };
  const rowStatus = makeElement('row-status');
  const row = {
    dataset: { device: 'KIOSK_02', current: initialAssignment || '' },
    querySelector(selector) {
      return selector === '[data-employee]' ? employeeSelect
        : selector === '[data-row-status]' ? rowStatus
          : null;
    },
    closest(selector) { return selector === '[data-device]' ? row : null; },
  };
  const saveButton = {
    disabled: false,
    closest(selector) { return selector === '[data-device]' ? row : null; },
  };
  row.querySelector = (selector) => selector === '[data-employee]' ? employeeSelect
    : selector === '[data-save]' ? saveButton
      : selector === '[data-row-status]' ? rowStatus
        : null;
  const sandbox = {
    console,
    Date,
    URL,
    setTimeout,
    clearTimeout,
    confirm: () => true,
    crypto: { randomUUID: () => '90000000-0000-4000-8000-000000000001' },
    document: {
      getElementById(id) {
        return { 'phone-list': list, 'assignment-status': status, 'phone-search': search, 'refresh-assignments': refresh, 'assignment-toast': toast }[id];
      },
    },
    window: {
      MemphisMobile: {
        requestEnvelope: async (path, options = {}) => {
          if (options.method === 'GET') return data;
          calls.push({ path, options });
          const body = options.body || {};
          if (!Object.prototype.hasOwnProperty.call(body, 'expected_current_employee_id')) throw new Error('expected assignment is required');
          if (body.expected_current_employee_id !== actualAssignment) throw new Error('This phone assignment changed. Refresh and try again.');
          return { employee: employees.find((employee) => employee.id === body.employee_id) || null };
        },
      },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(phoneAssignmentsJs, sandbox, { filename: 'phone-assignments.js' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const click = listeners.get('phone-list:click');
  click({ target: { closest(selector) { return selector === '[data-save]' ? saveButton : null; } } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { post: calls.find((call) => call.options.method === 'POST'), rowStatus, toast };
}

const staleUnassigned = await exercisePhoneAssignment({ initialAssignment: null, actualAssignment: '00000000-0000-4000-8000-000000000203' });
assert.equal(Object.prototype.hasOwnProperty.call(staleUnassigned.post.options.body, 'expected_current_employee_id'), true, 'known unassigned state must send an explicit expected field');
assert.equal(staleUnassigned.post.options.body.expected_current_employee_id, null, 'known unassigned state must send expected null');
assert.match(staleUnassigned.rowStatus.textContent, /assignment changed/i);

const staleAssigned = await exercisePhoneAssignment({ initialAssignment: '00000000-0000-4000-8000-000000000201', actualAssignment: '00000000-0000-4000-8000-000000000203' });
assert.equal(staleAssigned.post.options.body.expected_current_employee_id, '00000000-0000-4000-8000-000000000201', 'assigned state must send the observed employee ID');
assert.match(staleAssigned.rowStatus.textContent, /assignment changed/i);

const unknownAssignment = await exercisePhoneAssignment({ initialAssignment: null, actualAssignment: null, includeAssignmentField: false });
assert.equal(unknownAssignment.post, undefined, 'omitted assignment state must not be converted into expected null');
assert.match(unknownAssignment.toast.textContent, /unavailable.*refresh/i);
console.log('NATIVE_MANAGER_UI_REGRESSION_PASS');
