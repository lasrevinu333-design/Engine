import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';
import { installManagerWeather } from './home-weather.js';
import { currentMemphisMapAccessToken, isMemphisMapDashboardSession, MEMPHIS_MAP_ORIGIN } from './map-session.js';
import { attendanceFacts } from '../custodial/home-facts.js';
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
  todayOverdue: document.getElementById('today-overdue'), todayDueSoon: document.getElementById('today-due-soon'),
  todayInProgress: document.getElementById('today-in-progress'), todayOpenProblems: document.getElementById('today-open-problems'),
  todayGuestCount: document.getElementById('today-guest-count'), todayGuestMeta: document.getElementById('today-guest-meta'),
  todaySource: document.getElementById('today-source'),
  decisions: document.getElementById('decisions'), more: document.getElementById('more'), mapSignin: document.getElementById('map-signin-link'),
};
let manager = {};
let currentSession = null;
let statusTimer = null;
let refreshGeneration = 0;
let operationalTimer = null;
const managerWeather = installManagerWeather({ isVisible: () => !document.hidden && !els.hub.hidden && Boolean(currentSession?.token) });
function stopHomeFacts() {
  managerWeather.stop();
  if (operationalTimer !== null) clearInterval(operationalTimer);
  operationalTimer = null;
}
function startHomeFacts() {
  void managerWeather.start();
  if (operationalTimer === null) operationalTimer = setInterval(() => {
    if (!document.hidden && !els.hub.hidden && currentSession?.token && Date.parse(currentSession.expires_at || '') > Date.now()) void refreshOperationalTruth(refreshGeneration);
  }, 30000);
}

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
  stopHomeFacts();
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
  const mapDashboard = isMemphisMapDashboardSession(session);
  const custodialAdmin = !mapDashboard && roles.includes('CUSTODIAL_MANAGER');
  const moxieUser = !mapDashboard && (custodialAdmin || displayName === 'Annie Feist' || title === 'Operations Admin');
  if (els.moxie) els.moxie.hidden = !moxieUser;
  if (els.insights) els.insights.hidden = !custodialAdmin;
  for (const tile of [els.gemini, els.managerAccess, els.deviceSecurity]) if (tile) tile.hidden = !custodialAdmin;
  if (els.decisions) els.decisions.hidden = mapDashboard;
  if (els.more) els.more.hidden = mapDashboard;
  for (const link of document.querySelectorAll('.appNav a[href^="./messages"],.appNav a[href^="./schedule"],.appNav a[href="#more"]')) link.hidden = mapDashboard;
  els.logout.textContent = mapDashboard ? 'Close Custodial Dashboard Session' : 'Remove This Phone';
  startHomeFacts();
}

function renderEnrollment(message = '') {
  stopHomeFacts();
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
        ...(currentSession?.token ? { Authorization: `Bearer ${currentSession.token}` } : {}),
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

function nonNegativeInteger(value) {
  if (value == null || value === '') return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  if (typeof raw === 'string' && !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function sourceTime(value) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toLocaleString([], { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function setTodayValue(element, value, state = 'current') {
  const count = nonNegativeInteger(value);
  element.textContent = count == null ? 'Unavailable' : String(count);
  element.dataset.state = count == null ? 'unavailable' : state;
}

function renderOperationalSummary(data) {
  const snapshot = data?.snapshot && typeof data.snapshot === 'object' ? data.snapshot : {};
  setTodayValue(els.todayOverdue, snapshot.overdue_locations);
  setTodayValue(els.todayDueSoon, snapshot.due_soon_locations);
  setTodayValue(els.todayInProgress, snapshot.in_progress_locations);
  setTodayValue(els.todayOpenProblems, snapshot.open_ticket_count);
  const at = sourceTime(snapshot.snapshot_at);
  els.todaySource.textContent = at ? `Operational snapshot ${at}` : 'Operational snapshot time unavailable.';
}

function renderOperationalSummaryUnavailable() {
  for (const element of [els.todayOverdue, els.todayDueSoon, els.todayInProgress, els.todayOpenProblems]) {
    setTodayValue(element, null);
  }
  els.todaySource.textContent = 'Operational summary unavailable.';
}

function renderGuestAttendance(data) {
  const facts = attendanceFacts(data);
  const unavailable = data?.available === false || facts.value === 'Unavailable';
  els.todayGuestCount.textContent = facts.value;
  els.todayGuestCount.dataset.state = unavailable ? 'unavailable' : facts.stale ? 'stale' : 'current';
  const planned = nonNegativeInteger(data?.planned);
  els.todayGuestMeta.textContent = [facts.detail, planned == null ? '' : `Planned ${planned}`].filter(Boolean).join(' · ');
}

function renderGuestAttendanceUnavailable() {
  setTodayValue(els.todayGuestCount, null);
  els.todayGuestMeta.textContent = 'Gate feed unavailable.';
}

async function refreshOperationalTruth(generation) {
  if (generation !== refreshGeneration) return;
  for (const element of [els.todayOverdue, els.todayDueSoon, els.todayInProgress, els.todayOpenProblems, els.todayGuestCount]) {
    element.textContent = '—';
    element.dataset.state = 'loading';
  }
  els.todaySource.textContent = 'Loading operational status…';
  els.todayGuestMeta.textContent = 'Loading gate feed…';
  const summary = request('/dashboard-api/summary')
    .then((data) => { if (generation === refreshGeneration) renderOperationalSummary(data); })
    .catch(() => { if (generation === refreshGeneration) renderOperationalSummaryUnavailable(); });
  const attendance = request('/dashboard-api/current-attendance')
    .then((data) => { if (generation === refreshGeneration) renderGuestAttendance(data); })
    .catch(() => { if (generation === refreshGeneration) renderGuestAttendanceUnavailable(); });
  await Promise.allSettled([summary, attendance, managerWeather.refresh()]);
}

async function currentMapDashboardIdentity() {
  const accessToken = currentMemphisMapAccessToken();
  if (!accessToken) return null;
  const data = await request('/auth-api/map-session', {
    method: 'POST',
    body: { access_token: accessToken },
  });
  if (!isMemphisMapDashboardSession(data?.session)) throw new Error('Memphis Map did not return dashboard-only Custodial access.');
  return data;
}

async function refresh({ quiet = false } = {}) {
  const generation = ++refreshGeneration;
  if (!quiet && !currentSession) showBoot();
  try {
    const data = await request('/auth-api/session?access_level=full_access');
    if (generation !== refreshGeneration) return false;
    adopt(data);
    await refreshOperationalTruth(generation);
    if (generation !== refreshGeneration) return false;
    void ensurePushRegistration({ requestPermission: false }).catch(() => {});
    setHubStatus('Page updated.', 'ok', 1400);
    return true;
  } catch (error) {
    if (generation !== refreshGeneration) return false;
    if (error?.status === 401 || error?.status === 403) {
      try {
        const mapData = await currentMapDashboardIdentity();
        if (mapData && generation === refreshGeneration) {
          adopt(mapData);
          await refreshOperationalTruth(generation);
          if (generation !== refreshGeneration) return false;
          setHubStatus('Dashboard access restored from your current Memphis Map sign-in.', 'ok', 1800);
          return true;
        }
      } catch { /* A Map account never widens or replaces the separate full-control path. */ }
      renderEnrollment(error.message || 'This browser needs manager access.');
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
    const generation = ++refreshGeneration;
    await refreshOperationalTruth(generation);
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
  if (isMemphisMapDashboardSession(currentSession)) {
    stopHomeFacts();
    currentSession = null;
    window.MemphisMobile?.adoptSession?.(null);
    renderEnrollment('Custodial dashboard access was closed. Your Memphis Map sign-in was not changed.');
    return true;
  }
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopHomeFacts();
  else { void hideSystemStatusBar(); if (currentSession?.token && !els.hub.hidden) startHomeFacts(); }
});
window.addEventListener('pagehide', stopHomeFacts);
window.addEventListener('pageshow', () => { if (currentSession?.token && !els.hub.hidden) startHomeFacts(); });
void (async () => {
  if (els.mapSignin) els.mapSignin.href = `${MEMPHIS_MAP_ORIGIN}/editor/`;
  await hideSystemStatusBar();
  showBoot();
  await installNotificationRouting();
  await refresh();
})();
