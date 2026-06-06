import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const jsPath = path.resolve(scriptDir, '../memphis-device-reminders.js');
const source = fs.readFileSync(jsPath, 'utf8');

assert(source.includes("/device-event-reminders?device_id="), 'Reminder poller must still fetch event reminders');
assert(source.includes("/threads${qs}"), 'Reminder poller must also fetch thread summaries for message notifications');
assert(source.includes("state.currentUserId = safeText(data?.msg_user_id)"), 'Reminder poller must resolve the mapped device user before checking message threads');
assert(source.includes("Number(row?.unread_count || 0) > 0"), 'Reminder poller must alert only on unread message threads');
assert(source.includes("New direct message") || source.includes("Memphis message"), 'Reminder popups must differentiate message alerts from event reminders');
assert(source.includes('window.fully?.textToSpeech'), 'Reminder popups must trigger Fully Kiosk spoken alerts when available');
assert(source.includes('Hey ${first}') || source.includes('Hey ${first}, '), 'Reminder popups must personalize spoken alerts with the employee first name when known');
assert(source.includes('window.fully?.playSound') || source.includes('window.fully?.playAudio'), 'Reminder popups must try Fully Kiosk native sound playback when available');
assert(source.includes('new Audio(ensureRingtoneDataUrl())'), 'Reminder popups must preload a real ringtone asset for kiosk playback');
assert(source.includes('playRingtone();'), 'Reminder popups must play an audible ringtone');
assert(source.includes('navigator.vibrate?.'), 'Reminder popups must vibrate when supported');
assert(source.includes('body.mz-reminder-active #kiosk-lock-screen'), 'Reminder popup styling must hide the kiosk lock screen while the alert is open');
assert(source.includes('setReminderPresentationActive(true);'), 'Reminder popup must activate lock-screen suppression while visible');
assert(source.includes('setReminderPresentationActive(false);'), 'Reminder popup must restore the normal lock-screen state when closed');
assert(source.includes("linkedIds: [`thread:${safeText(row?.thread_id)}:${messageId}`]"), 'Event reminder popups must suppress duplicate thread popups for the same message');

console.log(JSON.stringify({
  ok: true,
  checked: [
    'event_reminders_still_polled',
    'thread_unread_notifications_polled',
    'device_identity_lookup',
    'audible_alerts',
    'fully_kiosk_speech',
    'duplicate_thread_alert_suppression'
  ]
}, null, 2));
