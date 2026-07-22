import {
  ensurePushRegistration,
  installNotificationRouting,
  managerNotificationRequest,
  notificationPermission,
  refreshManagerSession,
} from './notifications-client.js';

const form = document.getElementById('notification-form');
const messages = document.getElementById('messages-enabled');
const events = document.getElementById('events-enabled');
const eventOptions = document.getElementById('event-options');
const eventTime = document.getElementById('event-time');
const lookahead = document.getElementById('lookahead-days');
const dueSoon = document.getElementById('due-soon-enabled');
const overdue = document.getElementById('overdue-enabled');
const repeat = document.getElementById('repeat-minutes');
const permissionStatus = document.getElementById('permission-status');
const saveStatus = document.getElementById('save-status');
const testStatus = document.getElementById('test-status');
const enableDevice = document.getElementById('enable-device');
const testButton = document.getElementById('test-notification');

function setStatus(element, text, kind = '') {
  element.textContent = text || '';
  element.className = `status${kind ? ` ${kind}` : ''}`;
}
function selectedWeekdays() {
  return [...document.querySelectorAll('input[name="weekday"]:checked')].map((input) => Number(input.value));
}
function setWeekdays(days) {
  const selected = new Set(Array.isArray(days) ? days.map(Number) : []);
  document.querySelectorAll('input[name="weekday"]').forEach((input) => { input.checked = selected.has(Number(input.value)); });
}
function updateEventOptions() { eventOptions.disabled = !events.checked; }
async function updatePermissionLabel() {
  const state = await notificationPermission();
  const label = {
    granted: 'Enabled and registered on this phone.', denied: 'Blocked in the phone’s system settings.', prompt: 'Not enabled yet.',
    'prompt-with-rationale': 'Permission is needed before alerts can be delivered.', unsupported: 'Not supported in this build.', unavailable: 'Firebase setup is not available in this build.',
  }[state.receive] || `Status: ${state.receive}`;
  setStatus(permissionStatus, label, state.receive === 'granted' ? 'ok' : (state.receive === 'denied' ? 'error' : ''));
  enableDevice.textContent = state.receive === 'granted' ? 'Refresh Registration' : 'Enable This Phone';
  return state;
}
function applyPreferences(prefs = {}) {
  messages.checked = prefs.messages_enabled !== false;
  events.checked = prefs.event_reminders_enabled === true;
  setWeekdays(prefs.event_reminder_weekdays || [0,1,2,3,4,5,6]);
  eventTime.value = String(prefs.event_reminder_time || '08:00').slice(0, 5);
  lookahead.value = String(prefs.event_lookahead_days || 7);
  dueSoon.checked = prefs.due_soon_enabled === true;
  overdue.checked = prefs.overdue_enabled === true;
  repeat.value = String(prefs.location_repeat_minutes || 240);
  updateEventOptions();
}
async function load() {
  setStatus(saveStatus, 'Loading choices…');
  await refreshManagerSession();
  await installNotificationRouting();
  const data = await managerNotificationRequest('/manager-notifications-api/preferences');
  applyPreferences(data.preferences || {});
  await updatePermissionLabel();
  setStatus(saveStatus, data.provider_configured ? '' : 'Choices can be saved, but Firebase delivery is not configured.', data.provider_configured ? '' : 'error');
  setStatus(testStatus, 'Ready to test this phone.');
}
async function enable() {
  enableDevice.disabled = true;
  setStatus(permissionStatus, 'Registering this phone…');
  try {
    const result = await ensurePushRegistration({ requestPermission: true });
    if (result.receive !== 'granted') throw new Error(result.receive === 'denied' ? 'Notifications are blocked in system settings.' : 'Notification permission was not granted.');
    setStatus(permissionStatus, 'Enabled and registered on this phone.', 'ok');
    setStatus(testStatus, 'Registration refreshed.');
  } catch (error) { setStatus(permissionStatus, error.message, 'error'); }
  finally { enableDevice.disabled = false; }
}
async function save(event) {
  event.preventDefault();
  const weekdays = selectedWeekdays();
  if (events.checked && !weekdays.length) return setStatus(saveStatus, 'Choose at least one event reminder day.', 'error');
  const needsPush = messages.checked || events.checked || dueSoon.checked || overdue.checked;
  setStatus(saveStatus, 'Saving…');
  try {
    if (needsPush) {
      const registration = await ensurePushRegistration({ requestPermission: true });
      if (registration.receive !== 'granted') throw new Error('Phone notification permission is required for enabled alerts.');
    }
    const data = await managerNotificationRequest('/manager-notifications-api/preferences', {
      method: 'PUT',
      body: {
        messages_enabled: messages.checked,
        event_reminders_enabled: events.checked,
        event_reminder_weekdays: weekdays.length ? weekdays : [0,1,2,3,4,5,6],
        event_reminder_time: eventTime.value || '08:00',
        event_lookahead_days: Number(lookahead.value || 7),
        due_soon_enabled: dueSoon.checked,
        overdue_enabled: overdue.checked,
        location_repeat_minutes: Number(repeat.value || 240),
      },
    });
    applyPreferences(data.preferences || {});
    await updatePermissionLabel();
    setStatus(saveStatus, 'Notification choices saved for this phone.', 'ok');
  } catch (error) { setStatus(saveStatus, error.message, 'error'); }
}
async function sendTest() {
  testButton.disabled = true;
  setStatus(testStatus, 'Sending test…');
  try {
    const registration = await ensurePushRegistration({ requestPermission: true });
    if (registration.receive !== 'granted') throw new Error('Notification permission is required.');
    const data = await managerNotificationRequest('/manager-notifications-api/test', { method: 'POST', body: {} });
    const sent = Number(data?.delivery?.sent || 0);
    const failed = Array.isArray(data?.delivery?.results) ? data.delivery.results.find((row) => row?.succeeded === false) : null;
    if (!sent) throw new Error(failed?.error || 'Firebase did not confirm test delivery.');
    setStatus(testStatus, 'Test delivered. While the app is open it appears as an in-app banner; in the background it appears as a normal phone notification.', 'ok');
  } catch (error) { setStatus(testStatus, error.message, 'error'); }
  finally { testButton.disabled = false; }
}

window.addEventListener('memphis:notification-received', (event) => {
  const notification = event.detail || {};
  const kind = String(notification?.data?.kind || notification?.kind || '');
  if (kind === 'test' || /notifications are working/i.test(String(notification?.body || ''))) {
    setStatus(testStatus, 'Test received on this phone.', 'ok');
  }
});
events.addEventListener('change', updateEventOptions);
enableDevice.addEventListener('click', () => { void enable(); });
testButton.addEventListener('click', () => { void sendTest(); });
form.addEventListener('submit', (event) => { void save(event); });
void load().catch((error) => setStatus(saveStatus, error.message, 'error'));
