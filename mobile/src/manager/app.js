import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';
import { ensurePushRegistration, installNotificationRouting, unregisterPushNotifications } from './notifications-client.js';

const API = 'https://memphis-zoo-mcp.onrender.com';
const DEVICE_KEY = 'memphisAssignedDeviceId';
const els = {
  boot: document.getElementById('boot'), bootStatus: document.getElementById('boot-status'), bootRetry: document.getElementById('boot-retry'),
  enrollment: document.getElementById('enrollment'), hub: document.getElementById('hub'), identity: document.getElementById('identity'),
  name: document.getElementById('manager-name'), title: document.getElementById('manager-title'), form: document.getElementById('enroll-form'),
  code: document.getElementById('code'), label: document.getElementById('device-label'), enrollStatus: document.getElementById('enroll-status'),
  hubStatus: document.getElementById('hub-status'), refresh: document.getElementById('refresh'), logout: document.getElementById('logout'),
  moxie: document.getElementById('moxie-tile'), gemini: document.getElementById('gemini-tile'), insights: document.getElementById('insights-tile'),
  managerAccess: document.getElementById('manager-access-tile'), deviceSecurity: document.getElementById('device-security-tile'),
};
let manager = {};
let currentSession = null;
let statusTimer = null;

async function hideSystemStatusBar() {
  try { await StatusBar.hide(); } catch {}
}

function deviceId() {
  let value = localStorage.getItem(DEVICE_KEY) || '';
  if (!value) {
    value = `ops-app-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, value);
    localStorage.setItem('mz_scan_device_id', value);
  }
  return value;
}

function setHubStatus(text = '', kind = '', clearAfter = 0) {
  clearTimeout(statusTimer);
  els.hubStatus.textContent = text;
  els.hubStatus.className = `status${kind ? ` ${kind}` : ''}`;
  if (text && clearAfter > 0) statusTimer = setTimeout(() => {
    els.hubStatus.textContent = '';
    els.hubStatus.className = 'status';
  }, clearAfter);
}

function showBoot(message = 'Checking this phone’s manager access.', error = false) {
  els.boot.hidden = false;
  els.boot.setAttribute('aria-busy', error ? 'false' : 'true');
  els.bootStatus.textContent = message;
  els.bootStatus.className = error ? 'status error' : 'muted';
  els.bootRetry.hidden = !error;
  els.enrollment.hidden = true;
  els.hub.hidden = true;
  els.identity.hidden = true;
}

function adopt(payload) {
  const session = payload?.session;
  if (!session?.token) throw new Error('The server did not return manager access.');
  currentSession = session;
  manager = payload?.manager && typeof payload.manager === 'object' ? payload.manager : manager;
  window.MemphisMobile?.adoptSession?.(session);
  if (session.device_id) {
    localStorage.setItem(DEVICE_KEY, session.device_id);
    localStorage.setItem('mz_scan_device_id', session.device_id);
  }
  renderAuthenticated(session, manager);
  return session;
}

function renderAuthenticated(session, person = {}) {
  els.boot.hidden = true;
  els.enrollment.hidden = true;
  els.hub.hidden = false;
  els.identity.hidden = false;
  const displayName = person?.display_name || session.manager_display_name || 'Operations Leadership';
  const title = person?.job_title || person?.contact_label || session.manager_job_title || '';
  els.name.textContent = displayName;
  els.title.textContent = title;
  const roles = Array.isArray(session.roles) ? session.roles : [];
  const custodialAdmin = roles.includes('CUSTODIAL_MANAGER');
  const moxieUser = custodialAdmin || displayName === 'Annie Feist' || title === 'Operations Admin';
  if (els.moxie) els.moxie.hidden = !moxieUser;
  if (els.insights) els.insights.hidden = !custodialAdmin;
  for (const tile of [els.gemini, els.managerAccess, els.deviceSecurity]) if (tile) tile.hidden = !custodialAdmin;
}

function renderEnrollment(message = '') {
  manager = {};
  currentSession = null;
  window.MemphisMobile?.adoptSession?.(null);
  els.boot.hidden = true;
  els.enrollment.hidden = false;
  els.hub.hidden = true;
  els.identity.hidden = true;
  els.enrollStatus.textContent = message;
  els.enrollStatus.className = message ? 'status error' : 'status';
}

function keepCurrentAccessDuringFailure(error) {
  if (currentSession?.token && Date.parse(currentSession.expires_at || '') > Date.now()) {
    renderAuthenticated(currentSession, manager);
    setHubStatus(`Could not update right now. Existing phone access was kept. ${error?.message || ''}`.trim(), 'error');
    return;
  }
  showBoot(`Could not reach the Memphis Zoo service. No saved work was removed. ${error?.message || ''}`.trim(), true);
}

async function request(path, { method = 'GET', body = null } = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'X-Device-Id': deviceId(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    const error = new Error('Network connection failed.');
    error.code = 'NETWORK';
    error.cause = cause;
    throw error;
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload.data;
}

async function refresh({ quiet = false } = {}) {
  if (!quiet && !currentSession) showBoot();
  try {
    const data = await request('/auth-api/session?access_level=full_access');
    adopt(data);
    void ensurePushRegistration({ requestPermission: false }).catch(() => {});
    setHubStatus('Page updated.', 'ok', 1400);
    return true;
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      renderEnrollment(error.message || 'This phone must be enrolled again.');
      return false;
    }
    keepCurrentAccessDuringFailure(error);
    return false;
  }
}

async function enroll(event) {
  event.preventDefault();
  const code = String(els.code.value || '').replace(/[\s-]+/g, '');
  if (!/^\d{8}$/.test(code)) return setEnrollStatus('Enter the eight-digit personal manager code.', true);
  setEnrollStatus('Enrolling this phone…');
  try {
    const data = await request('/auth-api/ops/manager-codes/consume', {
      method: 'POST',
      body: {
        manager_code: code,
        device_id: deviceId(),
        device_label: String(els.label.value || '').trim() || `${navigator.platform || 'Phone'} · Memphis Zoo Ops`,
        access_level: 'full_access',
      },
    });
    adopt(data);
    await installNotificationRouting();
    void ensurePushRegistration({ requestPermission: true }).then((result) => {
      if (result?.receive === 'granted') setHubStatus('Phone enrolled. Message notifications are enabled.', 'ok');
    }).catch((error) => setHubStatus(`Phone enrolled. Notifications can be enabled later: ${error.message}`));
    els.code.value = '';
    setEnrollStatus('');
  } catch (error) { setEnrollStatus(error.message, true); }
}

function setEnrollStatus(text, error = false) {
  els.enrollStatus.textContent = text || '';
  els.enrollStatus.className = `status${error ? ' error' : ''}`;
}

async function logout() {
  try {
    await unregisterPushNotifications();
    await request('/auth-api/ops/logout', { method: 'POST' });
  } catch (error) {
    setHubStatus(`Could not remove this phone. Phone access was kept. ${error.message || ''}`.trim(), 'error');
    return false;
  }
  renderEnrollment('This phone has been removed. A new personal code is required to enroll it again.');
  return true;
}

els.form.addEventListener('submit', enroll);
els.bootRetry.addEventListener('click', () => { showBoot('Trying again…'); void refresh(); });
els.refresh.addEventListener('click', () => refresh().catch((error) => setHubStatus(error.message, 'error')));
els.logout.addEventListener('click', () => { if (confirm('Remove this phone from your Memphis Zoo Ops account? You will need a new personal code to use it again.')) void logout(); });
void Network.addListener('networkStatusChange', ({ connected }) => {
  document.getElementById('offline-banner')?.remove();
  if (!connected) {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline';
    banner.textContent = 'No connection. Manager information may be out of date.';
    document.body.appendChild(banner);
  } else {
    void refresh({ quiet: Boolean(currentSession) });
  }
});
void App.addListener('resume', () => {
  void hideSystemStatusBar();
  void refresh({ quiet: Boolean(currentSession) });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) void hideSystemStatusBar(); });
void (async () => {
  await hideSystemStatusBar();
  showBoot();
  await installNotificationRouting();
  await refresh();
})();
