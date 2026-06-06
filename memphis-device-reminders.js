(() => {
  'use strict';

  const CONFIG = {
    API_BASE: 'https://memphis-zoo-mcp.onrender.com/messaging-api',
    DEVICE_STORAGE_KEY: 'mz_scan_device_id',
    DEV_FALLBACK_DEVICE_ID: '1e74fe4c-dc20b3b9',
    POLL_MS: 30000,
    STARTUP_DELAY_MS: 3500,
    SEEN_PREFIX: 'mz_program_alert_seen:',
    ALERT_LOCK_KEY: 'mz_program_alert_lock'
  };

  const state = {
    deviceId: '',
    currentUserId: '',
    currentDisplayName: '',
    currentRole: '',
    poller: null,
    activeAlert: null,
    audioCtx: null,
    audioEl: null,
    ringtoneDataUrl: ''
  };

  function resolveDeviceId() {
    const url = new URL(window.location.href);
    const explicit = String(url.searchParams.get('device') || url.searchParams.get('deviceId') || '').trim();
    if (explicit) {
      localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY, explicit);
      return explicit;
    }
    const stored = String(localStorage.getItem(CONFIG.DEVICE_STORAGE_KEY) || '').trim();
    if (stored) return stored;
    if (location.hostname.includes('github.io')) {
      localStorage.setItem(CONFIG.DEVICE_STORAGE_KEY, CONFIG.DEV_FALLBACK_DEVICE_ID);
      return CONFIG.DEV_FALLBACK_DEVICE_ID;
    }
    return '';
  }

  function safeText(value, fallback = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  function firstName(value, fallback = '') {
    const text = safeText(value, fallback);
    if (!text) return '';
    return text.split(/\s+/)[0] || text;
  }

  function personalizedLead(name) {
    const first = firstName(name);
    return first ? `Hey ${first}, ` : '';
  }

  function alertId(value) {
    return String(value || '').trim();
  }

  function hasSeenId(id) {
    const normalized = alertId(id);
    return !normalized || localStorage.getItem(`${CONFIG.SEEN_PREFIX}${normalized}`) === '1';
  }

  function markSeenId(id) {
    const normalized = alertId(id);
    if (normalized) localStorage.setItem(`${CONFIG.SEEN_PREFIX}${normalized}`, '1');
  }

  function buildMessagesUrl(row) {
    const url = new URL('./messages.html', window.location.href);
    url.searchParams.set('hub', 'employee');
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    if (row?.msg_user_id || state.currentUserId) url.searchParams.set('user_id', String(row?.msg_user_id || state.currentUserId));
    return url.toString();
  }

  function buildThreadUrl(thread) {
    const url = new URL('./thread.html', window.location.href);
    url.searchParams.set('hub', 'employee');
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    if (state.currentUserId) url.searchParams.set('user_id', state.currentUserId);
    if (thread?.thread_id || thread?.id) url.searchParams.set('thread_id', String(thread.thread_id || thread.id));
    return url.toString();
  }

  function injectStyles() {
    if (document.getElementById('memphis-device-reminder-style')) return;
    const style = document.createElement('style');
    style.id = 'memphis-device-reminder-style';
    style.textContent = `
      body.mz-reminder-active #kiosk-lock-screen{opacity:0 !important;pointer-events:none !important;visibility:hidden !important}
      .mz-reminder-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(2,6,12,.94)}
      .mz-reminder-card{width:min(680px,100%);border-radius:28px;border:2px solid rgba(255,214,102,.9);background:linear-gradient(180deg,#1f2937,#060c14);color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:24px;text-align:center;font-family:Arial,sans-serif}
      .mz-reminder-kicker{font-size:.82rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#facc15;margin-bottom:10px}
      .mz-reminder-title{font-size:clamp(1.6rem,6vw,2.35rem);font-weight:950;line-height:1.05;margin-bottom:12px;text-shadow:0 2px 16px rgba(0,0,0,.38)}
      .mz-reminder-body{font-size:clamp(1rem,3.8vw,1.22rem);line-height:1.36;color:rgba(248,250,252,.94);margin:0 auto 20px;max-width:58ch}
      .mz-reminder-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
      .mz-reminder-btn{border:0;border-radius:18px;padding:14px 20px;font-size:1.05rem;font-weight:900;cursor:pointer;min-width:160px;box-shadow:0 10px 24px rgba(0,0,0,.22)}
      .mz-reminder-open{background:linear-gradient(180deg,#fcd34d,#f59e0b);color:#111827}
      .mz-reminder-dismiss{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.20);color:#f8fafc}
    `;
    document.head.appendChild(style);
  }

  async function fetchJson(path) {
    const response = await fetch(`${CONFIG.API_BASE}${path}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload.data;
  }

  async function resolveIdentity() {
    if (!state.deviceId) return null;
    const data = await fetchJson(`/me/by-device?device_id=${encodeURIComponent(state.deviceId)}`);
    state.currentUserId = safeText(data?.msg_user_id);
    state.currentDisplayName = safeText(data?.display_name);
    state.currentRole = safeText(data?.role).toLowerCase();
    return data || null;
  }

  async function fetchReminders() {
    if (!state.deviceId) return [];
    const data = await fetchJson(`/device-event-reminders?device_id=${encodeURIComponent(state.deviceId)}&limit=5`);
    return Array.isArray(data) ? data : [];
  }

  async function fetchThreads() {
    if (!state.currentUserId) return [];
    const qs = `?user_id=${encodeURIComponent(state.currentUserId)}${state.deviceId ? `&device_id=${encodeURIComponent(state.deviceId)}` : ''}`;
    const data = await fetchJson(`/threads${qs}`);
    return Array.isArray(data) ? data : [];
  }

  function setReminderPresentationActive(active) {
    try {
      document.body?.classList.toggle('mz-reminder-active', Boolean(active));
    } catch (_err) {}
  }

  function reminderAlert(row) {
    const messageId = safeText(row?.message_id || row?.id);
    const lead = personalizedLead(state.currentDisplayName || row?.display_name || row?.employee_name);
    return {
      id: `event:${messageId}`,
      linkedIds: [`thread:${safeText(row?.thread_id)}:${messageId}`],
      kicker: 'Memphis event reminder',
      title: 'Check this event location',
      body: safeText(row?.body, 'You have an event reminder from Memphis.'),
      openLabel: 'Open Memphis',
      dismissLabel: 'Dismiss',
      openUrl: buildMessagesUrl(row),
      speechText: `${lead}event reminder from Memphis. Please check this event location reminder.`
    };
  }

  function threadAlert(row) {
    const threadId = safeText(row?.thread_id || row?.id);
    const messageId = safeText(row?.last_message_id);
    const threadTitle = safeText(row?.thread_title, 'Conversation');
    const senderName = safeText(row?.last_sender_name, threadTitle);
    const isMemphis = safeText(row?.thread_type).toLowerCase() === 'bot' || threadTitle.toLowerCase() === 'memphis';
    const preview = safeText(row?.last_message_body, isMemphis ? 'You have a new Memphis message.' : 'You have a new message.');
    const lead = personalizedLead(state.currentDisplayName || row?.display_name || row?.employee_name);
    return {
      id: `thread:${threadId}:${messageId}`,
      linkedIds: [],
      kicker: isMemphis ? 'Memphis message' : 'New direct message',
      title: isMemphis ? 'Memphis sent you a message' : senderName,
      body: isMemphis ? preview : `${threadTitle}: ${preview}`,
      openLabel: 'Open thread',
      dismissLabel: 'Dismiss',
      openUrl: buildThreadUrl(row),
      speechText: isMemphis ? `${lead}Memphis sent you a new message.` : `${lead}${senderName} sent you a new message.`
    };
  }

  function fullyKioskNudge(alert) {
    const text = safeText(alert?.speechText, 'New Memphis notification.');
    try { if (window.fully?.turnScreenOn) window.fully.turnScreenOn(); } catch (_err) {}
    try { if (window.fully?.bringToForeground) window.fully.bringToForeground(); } catch (_err) {}
    try { if (window.fully?.textToSpeech) window.fully.textToSpeech(text); } catch (_err) {}
    try { if (window.fully?.vibrate) window.fully.vibrate(650); } catch (_err) {}
    try { navigator.vibrate?.([350, 150, 350, 150, 650]); } catch (_err) {}
    playRingtone();
  }

  function createRingtoneDataUrl() {
    const sampleRate = 22050;
    const toneSeconds = 0.16;
    const gapSeconds = 0.02;
    const tones = [880, 1175, 880, 1175, 1480, 1175];
    const segmentSamples = Math.max(1, Math.floor(toneSeconds * sampleRate));
    const gapSamples = Math.max(0, Math.floor(gapSeconds * sampleRate));
    const totalSamples = tones.length * segmentSamples + Math.max(0, tones.length - 1) * gapSamples;
    const pcm = new Int16Array(totalSamples);
    let cursor = 0;
    tones.forEach((freq, toneIndex) => {
      for (let i = 0; i < segmentSamples; i += 1) {
        const t = i / sampleRate;
        const fadeIn = Math.min(1, i / Math.max(1, sampleRate * 0.012));
        const fadeOut = Math.min(1, (segmentSamples - i) / Math.max(1, sampleRate * 0.02));
        const env = Math.min(fadeIn, fadeOut);
        const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.45;
        pcm[cursor] = Math.max(-1, Math.min(1, sample)) * 32767;
        cursor += 1;
      }
      if (toneIndex < tones.length - 1) cursor += gapSamples;
    });
    const bytesPerSample = 2;
    const dataSize = pcm.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeAscii = (offset, value) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataSize, true);
    pcm.forEach((sample, index) => view.setInt16(44 + index * bytesPerSample, sample, true));
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  function ensureRingtoneDataUrl() {
    if (!state.ringtoneDataUrl) state.ringtoneDataUrl = createRingtoneDataUrl();
    return state.ringtoneDataUrl;
  }

  function primeAudioOutput() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !state.audioCtx) state.audioCtx = new AudioContextClass();
      if (state.audioCtx?.state === 'suspended') state.audioCtx.resume().catch(() => {});
    } catch (_err) {}
    try {
      if (!state.audioEl) {
        state.audioEl = new Audio(ensureRingtoneDataUrl());
        state.audioEl.preload = 'auto';
      }
      state.audioEl.load?.();
    } catch (_err) {}
  }

  function playViaFullyJs(dataUrl) {
    try {
      if (window.fully?.playSound) {
        window.fully.playSound(dataUrl, false);
        return true;
      }
    } catch (_err) {}
    try {
      if (window.fully?.playAudio) {
        window.fully.playAudio(dataUrl, false, true);
        return true;
      }
    } catch (_err) {}
    return false;
  }

  function playViaHtmlAudio(dataUrl) {
    try {
      const audio = new Audio(dataUrl);
      audio.preload = 'auto';
      audio.volume = 1;
      const maybePromise = audio.play?.();
      if (maybePromise?.catch) maybePromise.catch(() => {});
      return true;
    } catch (_err) {
      return false;
    }
  }

  function playViaWebAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      const ctx = state.audioCtx || new AudioContextClass();
      state.audioCtx = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime + 0.05;
      const tones = [880, 1175, 880, 1175, 1480, 1175];
      tones.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + index * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.28, now + index * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.18 + 0.14);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + index * 0.18);
        osc.stop(now + index * 0.18 + 0.16);
      });
      return true;
    } catch (_err) {
      return false;
    }
  }

  function playRingtone() {
    const dataUrl = ensureRingtoneDataUrl();
    primeAudioOutput();
    const played = [
      playViaFullyJs(dataUrl),
      playViaHtmlAudio(dataUrl),
      playViaWebAudio()
    ].some(Boolean);
    if (!played) {
      window.setTimeout(() => {
        playViaHtmlAudio(dataUrl);
        playViaWebAudio();
      }, 220);
    }
  }

  function closeActiveAlert() {
    document.querySelector('.mz-reminder-backdrop')?.remove();
    setReminderPresentationActive(false);
    state.activeAlert = null;
    sessionStorage.removeItem(CONFIG.ALERT_LOCK_KEY);
  }

  function showAlert(alert) {
    if (!alert?.id || state.activeAlert || document.querySelector('.mz-reminder-backdrop') || hasSeenId(alert.id)) return;
    state.activeAlert = alert;
    injectStyles();
    setReminderPresentationActive(true);
    sessionStorage.setItem(CONFIG.ALERT_LOCK_KEY, alert.id);

    const backdrop = document.createElement('div');
    backdrop.className = 'mz-reminder-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = `
      <div class="mz-reminder-card">
        <div class="mz-reminder-kicker"></div>
        <div class="mz-reminder-title"></div>
        <div class="mz-reminder-body"></div>
        <div class="mz-reminder-actions">
          <button type="button" class="mz-reminder-btn mz-reminder-open"></button>
          <button type="button" class="mz-reminder-btn mz-reminder-dismiss"></button>
        </div>
      </div>
    `;

    backdrop.querySelector('.mz-reminder-kicker').textContent = safeText(alert.kicker, 'Memphis notification');
    backdrop.querySelector('.mz-reminder-title').textContent = safeText(alert.title, 'New notification');
    backdrop.querySelector('.mz-reminder-body').textContent = safeText(alert.body, 'You have a new Memphis notification.');
    backdrop.querySelector('.mz-reminder-open').textContent = safeText(alert.openLabel, 'Open');
    backdrop.querySelector('.mz-reminder-dismiss').textContent = safeText(alert.dismissLabel, 'Dismiss');

    backdrop.querySelector('.mz-reminder-open').addEventListener('click', () => {
      markSeenId(alert.id);
      (Array.isArray(alert.linkedIds) ? alert.linkedIds : []).forEach(markSeenId);
      window.location.href = alert.openUrl || buildMessagesUrl();
    });
    backdrop.querySelector('.mz-reminder-dismiss').addEventListener('click', () => {
      markSeenId(alert.id);
      (Array.isArray(alert.linkedIds) ? alert.linkedIds : []).forEach(markSeenId);
      closeActiveAlert();
    });

    document.body.appendChild(backdrop);
    fullyKioskNudge(alert);
  }

  function pickNextAlert({ reminders = [], threads = [] }) {
    const unseenReminder = reminders
      .map(reminderAlert)
      .find((alert) => !hasSeenId(alert.id));
    if (unseenReminder) return unseenReminder;

    const unseenThread = threads
      .filter((row) => Number(row?.unread_count || 0) > 0)
      .filter((row) => safeText(row?.last_message_id))
      .filter((row) => safeText(row?.last_sender_name).toLowerCase() !== state.currentDisplayName.toLowerCase())
      .map(threadAlert)
      .find((alert) => !hasSeenId(alert.id));
    return unseenThread || null;
  }

  async function poll() {
    try {
      if (!state.currentUserId) await resolveIdentity().catch(() => null);
      const [reminders, threads] = await Promise.all([fetchReminders(), fetchThreads()]);
      const next = pickNextAlert({ reminders, threads });
      if (next) showAlert(next);
    } catch (error) {
      console.warn('Memphis device reminder poll failed', error);
    }
  }

  function init() {
    state.deviceId = resolveDeviceId();
    if (!state.deviceId) return;
    ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
      window.addEventListener(eventName, primeAudioOutput, { once: true, passive: true });
    });
    primeAudioOutput();
    window.MemphisDeviceReminders = { poll, resolveDeviceId: () => state.deviceId };
    setTimeout(poll, CONFIG.STARTUP_DELAY_MS);
    state.poller = setInterval(poll, CONFIG.POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
