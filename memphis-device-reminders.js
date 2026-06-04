(() => {
  'use strict';

  const CONFIG = {
    API_BASE: 'https://memphis-zoo-mcp.onrender.com/messaging-api',
    DEVICE_STORAGE_KEY: 'mz_scan_device_id',
    DEV_FALLBACK_DEVICE_ID: '1e74fe4c-dc20b3b9',
    POLL_MS: 30000,
    STARTUP_DELAY_MS: 3500,
    SEEN_PREFIX: 'mz_event_reminder_seen:',
    ALERT_LOCK_KEY: 'mz_event_reminder_alert_lock'
  };

  const state = {
    deviceId: '',
    poller: null,
    activeReminder: null,
    audioCtx: null
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

  function reminderId(row) {
    return String(row?.message_id || row?.id || '').trim();
  }

  function hasSeen(row) {
    const id = reminderId(row);
    return !id || localStorage.getItem(`${CONFIG.SEEN_PREFIX}${id}`) === '1';
  }

  function markSeen(row) {
    const id = reminderId(row);
    if (id) localStorage.setItem(`${CONFIG.SEEN_PREFIX}${id}`, '1');
  }

  function buildMessagesUrl(row) {
    const url = new URL('./messages.html', window.location.href);
    url.searchParams.set('hub', 'employee');
    if (state.deviceId) url.searchParams.set('device', state.deviceId);
    if (row?.msg_user_id) url.searchParams.set('user_id', String(row.msg_user_id));
    return url.toString();
  }

  function injectStyles() {
    if (document.getElementById('memphis-device-reminder-style')) return;
    const style = document.createElement('style');
    style.id = 'memphis-device-reminder-style';
    style.textContent = `
      .mz-reminder-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.58);backdrop-filter:blur(5px)}
      .mz-reminder-card{width:min(680px,100%);border-radius:28px;border:2px solid rgba(255,214,102,.9);background:linear-gradient(180deg,rgba(17,24,39,.98),rgba(6,12,20,.98));color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:24px;text-align:center;font-family:Arial,sans-serif}
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

  function safeText(value, fallback = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  async function fetchReminders() {
    if (!state.deviceId || document.hidden) return [];
    const response = await fetch(`${CONFIG.API_BASE}/device-event-reminders?device_id=${encodeURIComponent(state.deviceId)}&limit=5`, { cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return Array.isArray(payload.data) ? payload.data : [];
  }

  function fullyKioskNudge(row) {
    const text = 'Event reminder from Memphis. Please check this event location reminder.';
    try { if (window.fully?.turnScreenOn) window.fully.turnScreenOn(); } catch (_err) {}
    try { if (window.fully?.bringToForeground) window.fully.bringToForeground(); } catch (_err) {}
    try { if (window.fully?.textToSpeech) window.fully.textToSpeech(text); } catch (_err) {}
    try { if (window.fully?.vibrate) window.fully.vibrate(650); } catch (_err) {}
    try { navigator.vibrate?.([350, 150, 350, 150, 650]); } catch (_err) {}
    playRingtone(row);
  }

  function playRingtone() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
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
    } catch (_err) {
      // Browser audio can be blocked until first user interaction; Fully Kiosk TTS/vibration above are fallbacks.
    }
  }

  function showReminder(row) {
    if (state.activeReminder || document.querySelector('.mz-reminder-backdrop') || hasSeen(row)) return;
    state.activeReminder = row;
    injectStyles();
    sessionStorage.setItem(CONFIG.ALERT_LOCK_KEY, reminderId(row));

    const backdrop = document.createElement('div');
    backdrop.className = 'mz-reminder-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = `
      <div class="mz-reminder-card">
        <div class="mz-reminder-kicker">Memphis event reminder</div>
        <div class="mz-reminder-title">Check this event location</div>
        <div class="mz-reminder-body"></div>
        <div class="mz-reminder-actions">
          <button type="button" class="mz-reminder-btn mz-reminder-open">Open Memphis</button>
          <button type="button" class="mz-reminder-btn mz-reminder-dismiss">Dismiss</button>
        </div>
      </div>
    `;
    backdrop.querySelector('.mz-reminder-body').textContent = safeText(row.body, 'You have an event reminder from Memphis.');
    backdrop.querySelector('.mz-reminder-open').addEventListener('click', () => {
      markSeen(row);
      window.location.href = buildMessagesUrl(row);
    });
    backdrop.querySelector('.mz-reminder-dismiss').addEventListener('click', () => {
      markSeen(row);
      backdrop.remove();
      state.activeReminder = null;
      sessionStorage.removeItem(CONFIG.ALERT_LOCK_KEY);
    });
    document.body.appendChild(backdrop);
    fullyKioskNudge(row);
  }

  async function poll() {
    try {
      const rows = await fetchReminders();
      const next = rows.find((row) => !hasSeen(row));
      if (next) showReminder(next);
    } catch (error) {
      console.warn('Memphis device reminder poll failed', error);
    }
  }

  function init() {
    state.deviceId = resolveDeviceId();
    if (!state.deviceId) return;
    window.MemphisDeviceReminders = { poll, resolveDeviceId: () => state.deviceId };
    setTimeout(poll, CONFIG.STARTUP_DELAY_MS);
    state.poller = setInterval(poll, CONFIG.POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
