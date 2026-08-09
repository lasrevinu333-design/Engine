const QUEUE_KEY = 'mz_employee_alert_queue_v23';
const ACTIVE_KEY = 'mz_employee_alert_active_v23';
const SEEN_PREFIX = 'mz_employee_alert_seen_v23:';
const STYLE_ID = 'mz-native-alert-coordinator-style';
const OVERLAY_ID = 'mz-native-alert-coordinator';

function text(value, fallback = '') {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function firstName(value, fallback = 'Employee') {
  return text(value, fallback).split(/\s+/)[0] || fallback;
}

function objectValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

function readJson(storage, key, fallback) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

function notificationKind(data = {}) {
  return text(
    data.kind
      || data.notification_type
      || data.type
      || data.event_type,
  ).toLowerCase();
}

function statusCode(data = {}) {
  return text(data.status_code || data.status).toLowerCase();
}

function messageSender(notification = {}, data = {}) {
  return text(
    data.sender_name
      || data.last_sender_name
      || data.sender_display_name
      || data.thread_title
      || data.display_name
      || notification.title,
    'Memphis',
  ).replace(/^new\s+(?:direct\s+)?message\s+from\s+/i, '');
}

function locationName(data = {}, notification = {}) {
  return text(
    data.location_name
      || data.group_name
      || data.location
      || data.area_name
      || notification.title,
    'Your assigned area',
  ).replace(/\s+(?:is\s+)?(?:due\s+soon|overdue)$/i, '');
}

function stableKey(notification = {}, data = {}) {
  const explicit = text(
    data.notification_key
      || data.alert_key
      || data.message_id
      || data.last_message_id
      || notification.id,
  );
  if (explicit) return explicit;
  const seed = [
    notificationKind(data),
    statusCode(data),
    text(data.thread_id),
    text(data.location_code || data.location_id),
    text(data.schedule_version),
    text(data.effective_at || data.sent_at || data.created_at),
    text(notification.title),
  ].join('|');
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `native-alert:${(hash >>> 0).toString(16)}`;
}

function defaultRouteFor(kind, data = {}) {
  if (text(data.route)) return text(data.route);
  if (kind.includes('message')) return './messages.html?hub=employee';
  if (kind.includes('event')) return './employee-events.html?hub=employee';
  if (
    kind.includes('schedule')
    || kind.includes('coverage')
    || kind.includes('assignment')
    || kind.includes('inherit')
    || kind.includes('transfer')
    || kind.includes('reassign')
    || kind.includes('location')
    || kind.includes('overdue')
    || kind.includes('due_soon')
  ) return './employee-schedule.html?hub=employee';
  return './employee-hub.html?hub=employee';
}

export function normalizeEmployeeAlert({
  notification = {},
  employeeName = 'Employee',
  routeResolver = (route) => route,
} = {}) {
  const data = objectValue(notification.data || notification.extra || {});
  const kind = notificationKind(data);
  const employee = firstName(data.employee_name || employeeName);
  const status = statusCode(data);
  let title = text(notification.title, 'Memphis Zoo');
  let body = text(notification.body, 'You have a new notification.');
  let speech = '';
  let openLabel = 'Open';

  if (kind === 'employee_message' || kind.includes('message')) {
    const sender = messageSender(notification, data);
    title = 'New message';
    body = `${sender} sent you a message.`;
    speech = `${employee}, you received a message from ${sender}.`;
    openLabel = 'Open Messages';
  } else if (kind === 'employee_location_status' || kind.includes('location_status') || status === 'due_soon' || status === 'overdue') {
    const location = locationName(data, notification);
    const overdue = status === 'overdue' || kind.includes('overdue');
    title = overdue ? 'Area overdue' : 'Area due soon';
    body = overdue ? `${location} needs attention now.` : `${location} is due soon.`;
    speech = overdue
      ? `${employee}, ${location} is overdue. Please handle it now.`
      : `${employee}, ${location} is due soon.`;
    openLabel = 'Open Schedule';
  } else if (kind.includes('lunch') && (kind.includes('end') || status === 'ended')) {
    title = 'Lunch coverage ended';
    body = 'Your temporary lunch coverage has ended.';
    speech = `${employee}, your lunch coverage has ended.`;
    openLabel = 'Open Schedule';
  } else if (kind.includes('lunch')) {
    title = 'Lunch coverage assigned';
    body = 'Temporary lunch coverage was added to your schedule.';
    speech = `${employee}, lunch coverage has been assigned.`;
    openLabel = 'Open Schedule';
  } else if (kind.includes('inherit') || kind.includes('additional_area') || kind.includes('areas_added')) {
    title = 'Areas added';
    body = 'Additional areas were added to your schedule.';
    speech = `${employee}, additional areas have been assigned to you.`;
    openLabel = 'Open Schedule';
  } else if (kind.includes('transfer') || kind.includes('removed')) {
    title = 'Schedule changed';
    body = 'Some areas were removed from your schedule.';
    speech = `${employee}, some areas were removed from your schedule.`;
    openLabel = 'Open Schedule';
  } else if (kind.includes('restroom') || kind.includes('rebalance')) {
    title = 'Restroom assignments changed';
    body = 'Your current restroom assignments have changed.';
    speech = `${employee}, your restroom assignments have changed.`;
    openLabel = 'Open Schedule';
  } else if (kind.includes('schedule') || kind.includes('assignment') || kind.includes('reassign')) {
    title = 'Schedule changed';
    body = 'Your current assignments have changed.';
    speech = `${employee}, your assignments have changed.`;
    openLabel = 'Open Schedule';
  } else if (kind === 'employee_event' || kind.includes('event')) {
    title = text(notification.title, 'Event notice');
    body = text(notification.body, 'An event may affect your assigned areas.');
    speech = `${employee}, you have a new event notice.`;
    openLabel = 'Open Events';
  } else {
    speech = `${employee}, you have a new Memphis Zoo notification.`;
  }

  const route = routeResolver(defaultRouteFor(kind, data));
  return {
    id: stableKey(notification, data),
    kind: kind || 'employee_notification',
    notificationType: text(data.notification_type, kind || 'employee_notification'),
    messageId: text(data.message_id || data.last_message_id),
    title,
    body,
    speech,
    openLabel,
    dismissLabel: 'Dismiss',
    route: route || './employee-hub.html?hub=employee',
    data,
    queuedAt: Date.now(),
    audioStartedAt: 0,
    audioCompletedAt: 0,
    displayedAt: 0,
  };
}

export async function runTwoCycleAudio({
  text: spokenText,
  playChime,
  speak,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  isCancelled = () => false,
  betweenChimeAndSpeechMs = 280,
  betweenCyclesMs = 650,
} = {}) {
  const normalized = text(spokenText);
  if (!normalized) return false;
  for (let cycle = 0; cycle < 2; cycle += 1) {
    if (isCancelled()) return false;
    await playChime();
    if (isCancelled()) return false;
    await wait(betweenChimeAndSpeechMs);
    if (isCancelled()) return false;
    await speak(normalized);
    if (cycle === 0) await wait(betweenCyclesMs);
  }
  return !isCancelled();
}

function ensureStyles(documentObject) {
  if (documentObject.getElementById(STYLE_ID)) return;
  const style = documentObject.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(2,6,12,.94);font-family:Arial,sans-serif}
    #${OVERLAY_ID} .mz-native-alert-card{width:min(620px,100%);border-radius:28px;border:2px solid rgba(255,214,102,.92);background:linear-gradient(180deg,#1f2937,#060c14);color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,.58);padding:26px;text-align:center}
    #${OVERLAY_ID} .mz-native-alert-title{font-size:clamp(1.65rem,7vw,2.35rem);font-weight:950;line-height:1.08;margin:0 0 14px}
    #${OVERLAY_ID} .mz-native-alert-body{font-size:clamp(1.05rem,4.2vw,1.3rem);line-height:1.38;margin:0 auto 22px;max-width:44ch}
    #${OVERLAY_ID} .mz-native-alert-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    #${OVERLAY_ID} button{min-height:58px;border-radius:18px;padding:13px 16px;font-size:1.05rem;font-weight:900;border:1px solid rgba(255,255,255,.22);touch-action:manipulation}
    #${OVERLAY_ID} .mz-native-alert-open{background:linear-gradient(180deg,#fcd34d,#f59e0b);color:#111827;border:0}
    #${OVERLAY_ID} .mz-native-alert-dismiss{background:rgba(255,255,255,.10);color:#f8fafc}
    #${OVERLAY_ID} button:disabled{opacity:.58}
    @media(max-width:460px){#${OVERLAY_ID} .mz-native-alert-actions{grid-template-columns:1fr}}
  `;
  documentObject.head.appendChild(style);
}

function defaultPlayChime(windowObject) {
  return () => new Promise((resolve) => {
    try {
      const audio = new windowObject.Audio(new URL('./memphis-alert-tone.wav', windowObject.location.href).toString());
      audio.preload = 'auto';
      audio.volume = 1;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(true);
      };
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      const started = audio.play();
      if (started?.catch) started.catch(finish);
      windowObject.setTimeout(finish, 3500);
    } catch {
      resolve(false);
    }
  });
}

function estimatedSpeechMilliseconds(value) {
  const words = text(value).split(/\s+/).filter(Boolean).length;
  return Math.max(3500, Math.min(30000, 1600 + words * 520));
}

function defaultSpeak(windowObject) {
  return (value) => new Promise((resolve) => {
    const spoken = text(value);
    if (!spoken) return resolve(false);
    try {
      if (windowObject.fully?.textToSpeech) {
        windowObject.fully.textToSpeech(spoken);
        windowObject.setTimeout(() => resolve(true), estimatedSpeechMilliseconds(spoken));
        return;
      }
    } catch {}
    try {
      if (!windowObject.speechSynthesis || !windowObject.SpeechSynthesisUtterance) return resolve(false);
      const utterance = new windowObject.SpeechSynthesisUtterance(spoken);
      utterance.volume = 1;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      windowObject.speechSynthesis.cancel();
      windowObject.speechSynthesis.speak(utterance);
      windowObject.setTimeout(() => finish(true), estimatedSpeechMilliseconds(spoken) + 6000);
    } catch {
      resolve(false);
    }
  });
}

export function createEmployeeNotificationCoordinator({
  windowObject = window,
  documentObject = document,
  storage = window.localStorage,
  resolveEmployeeName = async () => 'Employee',
  routeResolver = (route) => route,
  acknowledge = async () => null,
  presentSystemNotification = async () => null,
  playChime = defaultPlayChime(windowObject),
  speak = defaultSpeak(windowObject),
} = {}) {
  let activeAudio = null;
  let pendingAction = null;
  let processing = false;

  const seen = (id) => {
    try { return storage.getItem(`${SEEN_PREFIX}${id}`) === '1'; } catch { return false; }
  };
  const markSeen = (id) => {
    try { storage.setItem(`${SEEN_PREFIX}${id}`, '1'); } catch {}
  };
  const queue = () => {
    const rows = readJson(storage, QUEUE_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const saveQueue = (rows) => {
    try { writeJson(storage, QUEUE_KEY, rows); } catch {}
  };
  const active = () => readJson(storage, ACTIVE_KEY, null);
  const saveActive = (alert) => {
    try {
      if (alert) writeJson(storage, ACTIVE_KEY, alert);
      else storage.removeItem(ACTIVE_KEY);
    } catch {}
  };

  function render(alert) {
    ensureStyles(documentObject);
    documentObject.getElementById(OVERLAY_ID)?.remove();
    const overlay = documentObject.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', `${OVERLAY_ID}-title`);
    overlay.innerHTML = `
      <section class="mz-native-alert-card">
        <h2 id="${OVERLAY_ID}-title" class="mz-native-alert-title"></h2>
        <p class="mz-native-alert-body"></p>
        <div class="mz-native-alert-actions">
          <button class="mz-native-alert-open" type="button"></button>
          <button class="mz-native-alert-dismiss" type="button"></button>
        </div>
      </section>`;
    overlay.querySelector('.mz-native-alert-title').textContent = alert.title;
    overlay.querySelector('.mz-native-alert-body').textContent = alert.body;
    overlay.querySelector('.mz-native-alert-open').textContent = alert.openLabel;
    overlay.querySelector('.mz-native-alert-dismiss').textContent = alert.dismissLabel;
    overlay.querySelector('.mz-native-alert-open').addEventListener('click', () => { void act('opened'); });
    overlay.querySelector('.mz-native-alert-dismiss').addEventListener('click', () => { void act('dismissed'); });
    documentObject.body.appendChild(overlay);
  }

  function setButtonsDisabled(disabled) {
    const overlay = documentObject.getElementById(OVERLAY_ID);
    overlay?.querySelectorAll('button').forEach((button) => { button.disabled = disabled; });
  }

  async function act(action) {
    if (pendingAction) return pendingAction;
    const alert = active();
    if (!alert) return null;
    pendingAction = (async () => {
      setButtonsDisabled(true);
      if (activeAudio) await activeAudio.catch(() => null);
      markSeen(alert.id);
      saveActive(null);
      documentObject.getElementById(OVERLAY_ID)?.remove();
      await acknowledge(alert, action).catch(() => null);
      pendingAction = null;
      if (action === 'opened' && alert.route) windowObject.location.assign(alert.route);
      else await process();
      return action;
    })();
    return pendingAction;
  }

  async function announce(alert) {
    if (alert.audioStartedAt) return;
    const started = { ...alert, audioStartedAt: Date.now() };
    saveActive(started);
    activeAudio = runTwoCycleAudio({
      text: started.speech,
      playChime,
      speak,
      isCancelled: () => active()?.id !== started.id,
    }).finally(() => {
      const current = active();
      if (current?.id === started.id) saveActive({ ...current, audioCompletedAt: Date.now() });
      activeAudio = null;
    });
    await activeAudio;
  }

  async function process() {
    if (processing || documentObject.hidden) return;
    processing = true;
    try {
      let alert = active();
      if (!alert) {
        const rows = queue().filter((item) => item?.id && !seen(item.id));
        alert = rows.shift() || null;
        saveQueue(rows);
        if (alert) saveActive(alert);
      }
      if (!alert || seen(alert.id)) {
        if (alert) saveActive(null);
        documentObject.getElementById(OVERLAY_ID)?.remove();
        return;
      }
      render(alert);
      if (!alert.displayedAt) {
        alert = { ...alert, displayedAt: Date.now() };
        saveActive(alert);
        void acknowledge(alert, 'displayed').catch(() => null);
      }
      await announce(alert);
    } finally {
      processing = false;
    }
  }

  async function receive(event, { allowSystemNotification = true } = {}) {
    const notification = event?.notification || event || {};
    const employeeName = await resolveEmployeeName().catch(() => 'Employee');
    const alert = normalizeEmployeeAlert({ notification, employeeName, routeResolver });
    if (!alert.id || seen(alert.id)) return false;
    const current = active();
    const rows = queue();
    if (current?.id === alert.id || rows.some((item) => item?.id === alert.id)) return false;
    rows.push(alert);
    saveQueue(rows);
    if (allowSystemNotification && documentObject.hidden) {
      void presentSystemNotification(notification, alert).catch(() => null);
      return true;
    }
    await process();
    return true;
  }

  function start() {
    documentObject.addEventListener('visibilitychange', () => {
      if (!documentObject.hidden) void process();
    });
    windowObject.addEventListener('focus', () => { void process(); });
    windowObject.addEventListener('online', () => { void process(); });
    void process();
    return api;
  }

  const api = Object.freeze({
    start,
    receive,
    process,
    act,
    getActive: active,
    getQueue: queue,
  });
  return api;
}
