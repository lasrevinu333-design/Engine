import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ensurePushRegistration, installNotificationRouting, unregisterPushNotifications } from './notifications-client.js';

const API = 'https://memphis-zoo-mcp.onrender.com';
const CREDENTIAL_KEY = 'memphis_zoo_ops_device_credential';
const SESSION_KEY = 'mz_native_session';
const RUNTIME_CREDENTIAL_KEY = 'mz_native_device_credential_runtime';
const DEVICE_KEY = 'memphisAssignedDeviceId';
const els = {
  enrollment: document.getElementById('enrollment'), hub: document.getElementById('hub'), identity: document.getElementById('identity'),
  name: document.getElementById('manager-name'), title: document.getElementById('manager-title'), form: document.getElementById('enroll-form'),
  code: document.getElementById('code'), label: document.getElementById('device-label'), enrollStatus: document.getElementById('enroll-status'),
  hubStatus: document.getElementById('hub-status'), refresh: document.getElementById('refresh'), logout: document.getElementById('logout'),
  moxie: document.getElementById('moxie-tile'), gemini: document.getElementById('gemini-tile'),
  managerAccess: document.getElementById('manager-access-tile'), deviceSecurity: document.getElementById('device-security-tile'),
};
let manager = null;

function deviceId() {
  let value = localStorage.getItem(DEVICE_KEY) || '';
  if (!value) {
    value = `ops-app-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, value);
    localStorage.setItem('mz_scan_device_id', value);
  }
  return value;
}
async function secureGet() {
  try {
    const value = await SecureStorage.get(CREDENTIAL_KEY);
    return typeof value === 'string' ? value : '';
  } catch { return localStorage.getItem(CREDENTIAL_KEY) || ''; }
}
async function secureSet(value) {
  try { await SecureStorage.set(CREDENTIAL_KEY, value); }
  catch { localStorage.setItem(CREDENTIAL_KEY, value); }
}
async function secureRemove() {
  try { await SecureStorage.remove(CREDENTIAL_KEY); }
  catch { localStorage.removeItem(CREDENTIAL_KEY); }
}
function adopt(payload, credential) {
  const session = payload?.session;
  manager = payload?.manager || manager || {};
  if (!session?.token) throw new Error('The server did not return a manager session.');
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(RUNTIME_CREDENTIAL_KEY, credential);
  if (session.device_id) {
    localStorage.setItem(DEVICE_KEY, session.device_id);
    localStorage.setItem('mz_scan_device_id', session.device_id);
  }
  renderAuthenticated(session, manager);
  return session;
}
function renderAuthenticated(session, person) {
  els.enrollment.hidden = true;
  els.hub.hidden = false;
  els.identity.hidden = false;
  const displayName = person?.display_name || session.manager_display_name || 'Operations Leadership';
  const title = person?.job_title || person?.contact_label || '';
  els.name.textContent = displayName;
  els.title.textContent = title;
  const roles = Array.isArray(session.roles) ? session.roles : [];
  const custodialAdmin = roles.includes('CUSTODIAL_MANAGER');
  const moxieUser = custodialAdmin || displayName === 'Annie Feist' || title === 'Operations Admin';
  if (els.moxie) els.moxie.hidden = !moxieUser;
  for (const tile of [els.gemini, els.managerAccess, els.deviceSecurity]) if (tile) tile.hidden = !custodialAdmin;
}
function renderEnrollment(message = '') {
  manager = null;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(RUNTIME_CREDENTIAL_KEY);
  els.enrollment.hidden = false;
  els.hub.hidden = true;
  els.identity.hidden = true;
  els.enrollStatus.textContent = message;
  els.enrollStatus.className = message ? 'status error' : 'status';
}
async function request(path, { credential = '', body = null } = {}) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST', cache: 'no-store',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(credential ? { 'X-Memphis-Device-Credential': credential } : {}),
      'X-Device-Id': deviceId(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload.data;
}
async function refresh() {
  const credential = await secureGet();
  if (!credential) return renderEnrollment();
  try {
    const data = await request('/mobile-auth-api/session', { credential });
    adopt(data, credential);
    void ensurePushRegistration({ requestPermission: false }).catch(() => {});
    els.hubStatus.textContent = 'Session current.';
    els.hubStatus.className = 'status ok';
  } catch (error) {
    await secureRemove();
    renderEnrollment(error.message || 'This phone must be enrolled again.');
  }
}
async function enroll(event) {
  event.preventDefault();
  const code = String(els.code.value || '').replace(/[\s-]+/g, '');
  if (!/^\d{8}$/.test(code)) return setEnrollStatus('Enter the eight-digit personal manager code.', true);
  setEnrollStatus('Enrolling this phone…');
  try {
    const data = await request('/mobile-auth-api/enroll', {
      body: { code, device_id: deviceId(), device_label: String(els.label.value || '').trim() || `${navigator.platform || 'Phone'} · Memphis Zoo Ops` },
    });
    await secureSet(data.device_credential);
    adopt(data, data.device_credential);
    await installNotificationRouting();
    void ensurePushRegistration({ requestPermission: true }).then((result) => {
      if (result?.receive === 'granted') { els.hubStatus.textContent = 'Phone enrolled. Message notifications are enabled.'; els.hubStatus.className = 'status ok'; }
    }).catch((error) => { els.hubStatus.textContent = `Phone enrolled. Notifications can be enabled later: ${error.message}`; els.hubStatus.className = 'status'; });
    els.code.value = '';
    setEnrollStatus('');
  } catch (error) { setEnrollStatus(error.message, true); }
}
function setEnrollStatus(text, error = false) {
  els.enrollStatus.textContent = text || '';
  els.enrollStatus.className = `status${error ? ' error' : ''}`;
}
async function logout() {
  await unregisterPushNotifications();
  const credential = await secureGet();
  if (credential) {
    try { await request('/mobile-auth-api/logout', { credential }); } catch {}
  }
  await secureRemove();
  renderEnrollment('This phone has been removed. A new personal code is required to enroll it again.');
}

els.form.addEventListener('submit', enroll);
els.refresh.addEventListener('click', () => refresh().catch((error) => { els.hubStatus.textContent = error.message; els.hubStatus.className = 'status error'; }));
els.logout.addEventListener('click', () => { if (confirm('Remove this phone from your Memphis Zoo Ops account?')) logout(); });
void Network.addListener('networkStatusChange', ({ connected }) => {
  document.getElementById('offline-banner')?.remove();
  if (!connected) {
    const banner = document.createElement('div'); banner.id = 'offline-banner'; banner.className = 'offline'; banner.textContent = 'Offline'; document.body.appendChild(banner);
  }
});
void App.addListener('resume', () => { void refresh(); });
void (async () => {
  try { await StatusBar.setStyle({ style: Style.Light }); } catch {}
  await installNotificationRouting();
  await refresh();
})();
