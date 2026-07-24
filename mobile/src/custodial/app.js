import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';

const API = 'https://memphis-zoo-mcp.onrender.com';
const CREDENTIAL_KEY = 'memphis_zoo_custodial_device_credential';
const DEVICE_KEY = 'memphisAssignedDeviceId';
const els = {
  boot: document.getElementById('boot'), bootStatus: document.getElementById('boot-status'), bootRetry: document.getElementById('boot-retry'),
  enrollment: document.getElementById('enrollment'), form: document.getElementById('enroll-form'), device: document.getElementById('device-id'), code: document.getElementById('code'), enrollStatus: document.getElementById('enroll-status'),
  home: document.getElementById('home'), identity: document.getElementById('identity'), name: document.getElementById('employee-name'), phone: document.getElementById('employee-phone'),
  areasStatus: document.getElementById('areas-status'), areas: document.getElementById('areas-list'), refresh: document.getElementById('refresh-areas'), remove: document.getElementById('remove-enrollment'), homeStatus: document.getElementById('home-status'),
  enableNotifications: document.getElementById('enable-notifications'), notificationStatus: document.getElementById('notification-status'),
};
let profile = null;
const kioskIds = Array.from({ length: 9 }, (_value, index) => `KIOSK_${String(index + 2).padStart(2, '0')}`);
for (const id of kioskIds) els.device.insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);

function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function setStatus(element, text = '', kind = '') { element.textContent = text; element.className = `status${kind ? ` ${kind}` : ''}`; }
async function secureGet() { try { return String(await SecureStorage.get(CREDENTIAL_KEY) || '').trim(); } catch { return String(localStorage.getItem(CREDENTIAL_KEY) || '').trim(); } }
async function secureSet(value) { try { await SecureStorage.set(CREDENTIAL_KEY, value); localStorage.removeItem(CREDENTIAL_KEY); } catch { localStorage.setItem(CREDENTIAL_KEY, value); } }
async function secureRemove() { try { await SecureStorage.remove(CREDENTIAL_KEY); } catch {} localStorage.removeItem(CREDENTIAL_KEY); }
function deviceId() { return String(localStorage.getItem(DEVICE_KEY) || localStorage.getItem('mz_scan_device_id') || '').trim().toUpperCase(); }
function storeDevice(value) { const id = String(value || '').trim().toUpperCase(); localStorage.setItem(DEVICE_KEY, id); localStorage.setItem('mz_scan_device_id', id); return id; }
async function headers() {
  const credential = await secureGet();
  if (!credential) throw new Error('This phone is not enrolled.');
  return { 'X-Device-Credential': credential, 'X-Memphis-Device-Credential': credential, 'X-Device-Id': deviceId(), 'X-Memphis-App-Edition': 'custodial' };
}
async function request(path, { method = 'GET', body = null } = {}) {
  const h = await headers();
  if (body != null) h['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, { method, cache: 'no-store', credentials: 'omit', headers: h, body: body == null ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) { const error = new Error(payload?.error || `HTTP ${response.status}`); error.status = response.status; throw error; }
  return payload.data;
}
function showBoot(message = 'Checking the protected employee-device enrollment.', error = false) { els.boot.hidden = false; els.bootStatus.textContent = message; els.bootRetry.hidden = !error; els.enrollment.hidden = true; els.home.hidden = true; els.identity.hidden = true; }
function showEnrollment(message = '', kind = 'error') { els.boot.hidden = true; els.enrollment.hidden = false; els.home.hidden = true; els.identity.hidden = true; setStatus(els.enrollStatus, message, message ? kind : ''); }
function showHome() { els.boot.hidden = true; els.enrollment.hidden = true; els.home.hidden = false; els.identity.hidden = false; els.name.textContent = profile?.employee_name || profile?.employee?.display_name || 'Custodial Employee'; els.phone.textContent = `${profile?.canonical_device_id || profile?.device_id || deviceId()} · Memphis Zoo Custodial`; }
function locationRows(data) {
  const rows = [];
  const seen = new Set();
  const add = (name, meta = '') => { const value = String(name || '').trim(); if (!value || seen.has(value.toLowerCase())) return; seen.add(value.toLowerCase()); rows.push({ name: value, meta }); };
  const groups = Array.isArray(data?.groups) ? data.groups : Array.isArray(data?.assignments) ? data.assignments : [];
  for (const group of groups) {
    const segments = Array.isArray(group?.segments) ? group.segments : [group];
    for (const segment of segments) {
      const purpose = String(segment?.purpose || group?.purpose || '').replaceAll('_', ' ');
      const locations = segment?.locations || segment?.location_names || segment?.assigned_locations || group?.locations || group?.location_names || [];
      if (Array.isArray(locations)) for (const location of locations) add(typeof location === 'string' ? location : location?.location_name || location?.name, purpose);
      else if (typeof locations === 'string') for (const location of locations.split(/[,;|]/)) add(location, purpose);
    }
  }
  if (!rows.length) {
    const simple = data?.locations || data?.assigned_locations || data?.current_locations || [];
    if (Array.isArray(simple)) for (const location of simple) add(typeof location === 'string' ? location : location?.location_name || location?.name);
  }
  const restroom = (row) => /restroom|bathroom|men's|women's|family/i.test(row.name);
  return rows.sort((a, b) => Number(restroom(b)) - Number(restroom(a)) || a.name.localeCompare(b.name));
}
function renderAreas(data) {
  const rows = locationRows(data);
  if (!rows.length) { els.areas.innerHTML = '<div class="emptyAreas">No active assigned areas were returned. Refresh after the daily schedule is published or contact the Custodial Manager.</div>'; return; }
  els.areas.innerHTML = rows.map((row) => { const rr = /restroom|bathroom|men's|women's|family/i.test(row.name); return `<div class="areaRow${rr ? ' restroom' : ''}"><span class="areaType"></span><div><div class="areaName">${escapeHtml(row.name)}</div><div class="areaMeta">${rr ? 'Restroom priority' : escapeHtml(row.meta || 'Assigned area')}</div></div></div>`; }).join('');
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
async function loadAreas() { setStatus(els.areasStatus, 'Refreshing assigned areas…', 'info'); try { const data = await request(`/schedule-api/my-day-summary?device_id=${encodeURIComponent(deviceId())}`); renderAreas(data); setStatus(els.areasStatus, 'Current areas loaded.', 'ok'); } catch (error) { setStatus(els.areasStatus, `Assigned areas could not refresh. ${safe(error)}`, 'error'); } }
async function enableNotifications({ requestPermission = true } = {}) {
  if (!window.MemphisMobile?.ensurePushRegistration) {
    setStatus(els.notificationStatus, 'Native notification support is unavailable.', 'error');
    return false;
  }
  setStatus(els.notificationStatus, requestPermission ? 'Requesting notification permission…' : 'Checking notification permission…', 'info');
  try {
    const result = await window.MemphisMobile.ensurePushRegistration({ requestPermission });
    if (result?.receive === 'granted' && result?.registered) {
      setStatus(els.notificationStatus, 'Assigned event notifications are enabled.', 'ok');
      return true;
    }
    const denied = result?.receive === 'denied';
    setStatus(els.notificationStatus, denied
      ? 'Notifications are blocked. Enable them for Memphis Zoo Custodial in Android Settings, then try again.'
      : 'Notification permission is required for assigned event reminders.', 'error');
    return false;
  } catch (error) {
    setStatus(els.notificationStatus, `Notifications could not be enabled. ${safe(error)}`, 'error');
    return false;
  }
}
async function restore() {
  const credential = await secureGet(); if (!credential || !deviceId()) return showEnrollment();
  showBoot();
  try { profile = await request(`/device-auth/status?device_id=${encodeURIComponent(deviceId())}`); if (!profile?.authenticated) throw Object.assign(new Error('This phone must be enrolled again.'), { status: 401 }); showHome(); await Promise.all([loadAreas(), enableNotifications({ requestPermission: false })]); }
  catch (error) { if (error?.status === 401 || error?.status === 403) { window.MemphisMobile?.clearCredentialCache?.(); await secureRemove(); showEnrollment(safe(error)); } else showBoot(`Could not refresh right now. This phone remains enrolled. ${safe(error)}`, true); }
}
async function enroll(event) {
  event.preventDefault(); const selected = String(els.device.value || '').trim(); const code = String(els.code.value || '').replace(/\D/g, '').slice(0, 8);
  if (!/^KIOSK_(0[2-9]|10)$/.test(selected)) return setStatus(els.enrollStatus, 'Choose the KIOSK phone assigned by the Custodial Manager.', 'error');
  if (!/^\d{8}$/.test(code)) return setStatus(els.enrollStatus, 'Enter the eight-digit app code.', 'error');
  setStatus(els.enrollStatus, 'Enrolling phone…', 'info');
  try {
    const response = await fetch(`${API}/custodial-device-auth/enroll`, { method: 'POST', cache: 'no-store', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-Device-Id': selected, 'X-Memphis-App-Edition': 'custodial' }, body: JSON.stringify({ device_id: selected, enrollment_code: code, device_label: `${selected} Memphis Zoo Custodial` }) });
    const payload = await response.json().catch(() => null); if (!response.ok || !payload?.ok) throw Object.assign(new Error(payload?.error || `HTTP ${response.status}`), { status: response.status });
    storeDevice(payload.data.device_id || selected); await secureSet(payload.data.device_credential); window.MemphisMobile?.adoptCredential?.(payload.data.device_credential); profile = { ...payload.data, authenticated: true, canonical_device_id: payload.data.device_id, employee_name: payload.data.employee?.display_name };
    els.code.value = ''; showHome(); await loadAreas(); const notificationsEnabled = await enableNotifications({ requestPermission: true }); setStatus(els.homeStatus, notificationsEnabled ? 'Phone enrolled and ready.' : 'Phone enrolled. Enable notifications to receive assigned event reminders.', notificationsEnabled ? 'ok' : 'info');
  } catch (error) { setStatus(els.enrollStatus, safe(error), 'error'); }
}
function scanTarget(value) {
  try {
    const incoming = new URL(String(value || ''));
    const interesting = ['code', 'location', 'loc', 'session_uuid', 'action'];
    const customScan = ['memphiszoo:', 'memphiszoo-custodial:'].includes(incoming.protocol) && incoming.hostname === 'scan';
    if (!interesting.some((key) => incoming.searchParams.has(key)) && !customScan) return null;
    const target = new URL('./scan.html', location.href);
    for (const key of interesting) if (incoming.searchParams.has(key)) target.searchParams.set(key, incoming.searchParams.get(key));
    if (customScan && incoming.pathname.replace(/^\//, '')) target.searchParams.set('code', incoming.pathname.replace(/^\//, ''));
    target.searchParams.set('device', deviceId()); target.searchParams.set('source', 'native-nfc'); return target;
  } catch { return null; }
}
function handleAppUrl(url) { const target = scanTarget(url); if (target) location.assign(target.toString()); }
async function removeEnrollment() {
  if (!confirm('Remove the employee enrollment from this phone? A new single-use code will be required.')) return;
  setStatus(els.homeStatus, 'Revoking this phone enrollment…', 'info');
  try {
    await window.MemphisMobile?.endEnrollment?.();
    await secureRemove();
    window.MemphisMobile?.clearCredentialCache?.();
    localStorage.removeItem(DEVICE_KEY);
    localStorage.removeItem('mz_scan_device_id');
    profile = null;
    showEnrollment('Enrollment removed. A new single-use code is required before this phone can reconnect.', 'ok');
  } catch (error) {
    setStatus(els.homeStatus, `Enrollment was not removed. Connect this phone and try again. ${safe(error)}`, 'error');
  }
}
els.form.addEventListener('submit', enroll); els.refresh.addEventListener('click', () => void loadAreas()); els.bootRetry.addEventListener('click', () => void restore()); els.remove.addEventListener('click', () => void removeEnrollment()); els.enableNotifications.addEventListener('click', () => void enableNotifications({ requestPermission: true }));
void Network.addListener('networkStatusChange', ({ connected }) => { if (connected && !els.home.hidden) void loadAreas(); });
void App.addListener('appUrlOpen', ({ url }) => handleAppUrl(url));
void App.addListener('resume', () => { void StatusBar.hide().catch(() => {}); void restore(); });
void (async () => { await StatusBar.hide().catch(() => {}); const launch = await App.getLaunchUrl().catch(() => null); if (launch?.url) { const target = scanTarget(launch.url); if (target) return location.replace(target.toString()); } await restore(); })();
