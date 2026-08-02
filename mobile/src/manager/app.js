import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';
import { managerNativeSecurity } from './native-security.js';
import { ensurePushRegistration, installNotificationRouting, unregisterPushNotifications } from './notifications-client.js';

const API = 'https://memphis-zoo-mcp.onrender.com';
const RETIRED_WEB_SECRET_KEYS = [
  'memphis_zoo_ops_device_credential',
  'mz_native_device_credential_runtime',
  'mz_native_session',
  'mz_device_security_csrf',
];
const DEVICE_KEYS = ['memphisAssignedDeviceId', 'mz_scan_device_id'];
const els = {
  boot: document.getElementById('boot'), bootStatus: document.getElementById('boot-status'), bootRetry: document.getElementById('boot-retry'),
  enrollment: document.getElementById('enrollment'), hub: document.getElementById('hub'), identity: document.getElementById('identity'),
  name: document.getElementById('manager-name'), title: document.getElementById('manager-title'), form: document.getElementById('enroll-form'),
  code: document.getElementById('code'), enrollStatus: document.getElementById('enroll-status'),
  hubStatus: document.getElementById('hub-status'), refresh: document.getElementById('refresh'), logout: document.getElementById('logout'),
  moxie: document.getElementById('moxie-tile'), gemini: document.getElementById('gemini-tile'), insights: document.getElementById('insights-tile'),
  managerAccess: document.getElementById('manager-access-tile'), deviceSecurity: document.getElementById('device-security-tile'),
};
let manager = null;
let safeSession = null;
let statusTimer = null;

async function hideSystemStatusBar() {
  try { await StatusBar.hide(); } catch {}
}

function purgeRetiredWebSecrets() {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of RETIRED_WEB_SECRET_KEYS) {
      try { storage.removeItem(key); } catch {}
    }
  }
}

function legacyDeviceId() {
  for (const key of DEVICE_KEYS) {
    const value = String(localStorage.getItem(key) || '').trim();
    if (/^ops-app-[0-9a-f-]{36}$/i.test(value)) return value;
  }
  return '';
}

function publishSafeDeviceId(value) {
  const deviceId = String(value || '').trim();
  if (!/^ops-app-[0-9a-f-]{36}$/i.test(deviceId)) return;
  for (const key of DEVICE_KEYS) localStorage.setItem(key, deviceId);
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

function showBoot(message = 'Checking this phone’s protected enrollment.', error = false) {
  els.boot.hidden = false;
  els.boot.setAttribute('aria-busy', error ? 'false' : 'true');
  els.bootStatus.textContent = message;
  els.bootStatus.className = error ? 'status error' : 'muted';
  els.bootRetry.hidden = !error;
  els.enrollment.hidden = true;
  els.hub.hidden = true;
  els.identity.hidden = true;
}

function renderAuthenticated(session, person = {}) {
  safeSession = session;
  manager = person && typeof person === 'object' ? person : {};
  els.boot.hidden = true;
  els.enrollment.hidden = true;
  els.hub.hidden = false;
  els.identity.hidden = false;
  const displayName = manager.display_name || session.manager_display_name || 'Operations Leadership';
  const title = manager.job_title || manager.contact_label || session.manager_job_title || '';
  els.name.textContent = displayName;
  els.title.textContent = title;
  const roles = Array.isArray(session.roles) ? session.roles.map((role) => String(role).toUpperCase()) : [];
  const custodialAdmin = roles.includes('CUSTODIAL_MANAGER');
  const moxieUser = custodialAdmin || displayName === 'Annie Feist' || title === 'Operations Admin';
  if (els.moxie) els.moxie.hidden = !moxieUser;
  if (els.insights) els.insights.hidden = !custodialAdmin;
  for (const tile of [els.gemini, els.managerAccess, els.deviceSecurity]) if (tile) tile.hidden = !custodialAdmin;
}

function renderEnrollment(message = '') {
  manager = null;
  safeSession = null;
  els.boot.hidden = true;
  els.enrollment.hidden = false;
  els.hub.hidden = true;
  els.identity.hidden = true;
  els.enrollStatus.textContent = message;
  els.enrollStatus.className = message ? 'status error' : 'status';
}

function setEnrollStatus(text, error = false) {
  els.enrollStatus.textContent = text || '';
  els.enrollStatus.className = `status${error ? ' error' : ''}`;
}

async function safeManagerSnapshot() {
  const response = await managerNativeSecurity.authorizedFetch(`${API}/mobile-auth-api/session`, {
    method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
  });
  const payload = await response.json().catch(() => null);
  const session = payload?.data?.session;
  if (!response.ok || !payload?.ok || session?.role !== 'ops_manager') {
    const error = new Error(payload?.error || `Manager session refresh failed: HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if ('token' in session || 'device_credential' in (payload?.data || {})) {
    throw new Error('The protected Manager boundary returned secret material.');
  }
  return { session, manager: payload.data.manager || {} };
}

async function reconcileNativeState() {
  let state = await managerNativeSecurity.inspect();
  if (state.blocked) throw new Error(`This phone is safely quarantined: ${state.reason || 'protected state requires repair'}.`);
  if (state.legacy_pending) state = await managerNativeSecurity.migrateLegacyEnrollment(legacyDeviceId());
  if (state.pending_operation_id) state = await managerNativeSecurity.resumePendingEnrollment();
  return state;
}

async function refresh({ quiet = false } = {}) {
  if (!quiet) showBoot();
  try {
    const state = await reconcileNativeState();
    if (!state.active) {
      renderEnrollment();
      return false;
    }
    publishSafeDeviceId(state.device_id);
    const snapshot = await safeManagerSnapshot();
    renderAuthenticated(snapshot.session, snapshot.manager);
    void ensurePushRegistration({ requestPermission: false }).catch(() => {});
    setHubStatus('Manager access is current.', 'ok', 1400);
    return true;
  } catch (error) {
    showBoot(`Protected Manager access could not be restored. ${error?.message || ''}`.trim(), true);
    return false;
  }
}

async function enroll(event) {
  event.preventDefault();
  const code = String(els.code.value || '').replace(/[\s-]+/g, '');
  if (!/^\d{8}$/.test(code)) return setEnrollStatus('Enter the eight-digit personal manager code.', true);
  setEnrollStatus('Enrolling this phone…');
  try {
    await managerNativeSecurity.enroll({ code });
    els.code.value = '';
    setEnrollStatus('');
    await refresh();
    await installNotificationRouting();
    void ensurePushRegistration({ requestPermission: true }).then((result) => {
      if (result?.receive === 'granted') setHubStatus('Phone enrolled. Manager notifications are enabled.', 'ok');
    }).catch((error) => setHubStatus(`Phone enrolled. Notifications can be enabled later: ${error.message}`));
  } catch (error) {
    setEnrollStatus(error?.message || 'Enrollment could not be completed.', true);
  }
}

async function logout() {
  await unregisterPushNotifications();
  await managerNativeSecurity.remove();
  renderEnrollment('This phone has been removed. A new personal code is required to enroll it again.');
}

purgeRetiredWebSecrets();
globalThis.MemphisManagerSession = Object.freeze({
  read: () => safeSession,
  profile: () => manager,
});
els.form.addEventListener('submit', enroll);
els.bootRetry.addEventListener('click', () => { showBoot('Trying again…'); void refresh(); });
els.refresh.addEventListener('click', () => void refresh({ quiet: true }));
els.logout.addEventListener('click', () => {
  if (confirm('Remove this phone from your Memphis Zoo Ops account?')) void logout().catch((error) => setHubStatus(error.message, 'error'));
});
void Network.addListener('networkStatusChange', ({ connected }) => {
  document.getElementById('offline-banner')?.remove();
  if (!connected) {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline';
    banner.textContent = 'Offline';
    document.body.appendChild(banner);
  } else void refresh({ quiet: Boolean(safeSession) });
});
void App.addListener('resume', () => {
  void hideSystemStatusBar();
  void refresh({ quiet: Boolean(safeSession) });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) void hideSystemStatusBar(); });
void (async () => {
  await hideSystemStatusBar();
  showBoot();
  await installNotificationRouting();
  await refresh();
})();
