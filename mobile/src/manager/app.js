import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';
import { managerNativeSecurity } from './native-security.js';
import {
  ensurePushRegistration,
  installNotificationRouting,
  refreshManagerSession,
  unregisterPushNotifications,
} from './notifications-client.js';

const els = {
  boot: document.getElementById('boot'), bootStatus: document.getElementById('boot-status'), bootRetry: document.getElementById('boot-retry'),
  enrollment: document.getElementById('enrollment'), hub: document.getElementById('hub'), identity: document.getElementById('identity'),
  name: document.getElementById('manager-name'), title: document.getElementById('manager-title'), form: document.getElementById('enroll-form'),
  code: document.getElementById('code'), label: document.getElementById('device-label'), enrollStatus: document.getElementById('enroll-status'),
  hubStatus: document.getElementById('hub-status'), refresh: document.getElementById('refresh'), logout: document.getElementById('logout'),
  moxie: document.getElementById('moxie-tile'), gemini: document.getElementById('gemini-tile'), insights: document.getElementById('insights-tile'),
  managerAccess: document.getElementById('manager-access-tile'), deviceSecurity: document.getElementById('device-security-tile'),
};
let statusTimer = null;
let enrollmentFlow = 'enroll';

async function hideSystemStatusBar() {
  try { await StatusBar.hide(); } catch {}
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

function showBoot(message = 'Checking this phone’s protected Manager enrollment.', error = false) {
  els.boot.hidden = false;
  els.boot.setAttribute('aria-busy', error ? 'false' : 'true');
  els.bootStatus.textContent = message;
  els.bootStatus.className = error ? 'status error' : 'muted';
  els.bootRetry.hidden = !error;
  els.enrollment.hidden = true;
  els.hub.hidden = true;
  els.identity.hidden = true;
}

function renderAuthenticated(state) {
  els.boot.hidden = true;
  els.enrollment.hidden = true;
  els.hub.hidden = false;
  els.identity.hidden = false;
  els.name.textContent = 'Operations Leadership';
  els.title.textContent = state.access_level === 'full_access' ? 'Full Access · Protected Device' : 'Protected Device';
  const fullAccess = state.access_level === 'full_access';
  for (const tile of [els.moxie, els.gemini, els.insights, els.managerAccess, els.deviceSecurity]) {
    if (tile) tile.hidden = !fullAccess;
  }
}

function renderEnrollment(message = '', flow = 'enroll') {
  enrollmentFlow = ['recover', 'replace'].includes(flow) ? flow : 'enroll';
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

async function refresh({ quiet = false } = {}) {
  if (!quiet) showBoot();
  let state;
  try {
    state = await managerNativeSecurity.inspect();
    if (!state.active && !state.pending_operation_id) {
      const recovery = state.state === 'LEGACY_PENDING' || state.blocked;
      const flow = state.reason === 'manager_native_replacement_required' ? 'replace' : recovery ? 'recover' : 'enroll';
      const message = flow === 'replace'
        ? 'This phone’s protected device keys must be replaced. Use a new personal manager code; existing server access stays in place until the replacement is confirmed.'
        : recovery ? (state.reason || 'Use a new personal manager code to recover this phone.') : '';
      renderEnrollment(message, flow);
      return false;
    }
    const refreshed = await refreshManagerSession();
    state = await managerNativeSecurity.inspect();
    renderAuthenticated(state);
    void ensurePushRegistration({ requestPermission: false }).catch(() => {});
    setHubStatus(refreshed.session?.roles?.length ? 'Protected session current.' : 'Protected access current.', 'ok', 1400);
    return true;
  } catch (error) {
    state = managerNativeSecurity.getStatus() || state;
    if (state?.active && !state?.blocked && !state?.removal_pending) {
      renderAuthenticated(state);
      setHubStatus(`Could not refresh protected access. ${error?.message || ''}`.trim(), 'error');
      return false;
    }
    if (state?.pending_operation_id) {
      showBoot(`Enrollment recovery is pending. ${error?.message || ''}`.trim(), true);
      return false;
    }
    renderEnrollment(error?.message || 'A personal manager code is required.', 'recover');
    return false;
  }
}

async function enroll(event) {
  event.preventDefault();
  const code = String(els.code.value || '').replace(/[\s-]+/g, '');
  if (!/^\d{8}$/.test(code)) return setEnrollStatus('Enter the eight-digit personal manager code.', true);
  setEnrollStatus(enrollmentFlow === 'recover'
    ? 'Recovering this protected phone…'
    : enrollmentFlow === 'replace'
      ? 'Replacing this phone’s protected keys…'
      : 'Enrolling this protected phone…');
  try {
    const mutation = await managerNativeSecurity.enroll({
      code,
      flow: enrollmentFlow,
      deviceLabel: String(els.label.value || '').trim() || `${navigator.platform || 'Phone'} · Memphis Zoo Ops`,
    });
    let state = mutation.vault_state;
    if (state.pending_operation_id) {
      state = (await managerNativeSecurity.confirmEnrollment(state.pending_operation_id)).vault_state;
    }
    if (!state.active) throw new Error(state.reason || 'Protected enrollment did not activate.');
    renderAuthenticated(state);
    await installNotificationRouting();
    void ensurePushRegistration({ requestPermission: true }).then((result) => {
      if (result?.receive === 'granted') setHubStatus('Phone enrolled. Message notifications are enabled.', 'ok');
    }).catch((error) => setHubStatus(`Phone enrolled. Notifications can be enabled later: ${error.message}`));
    els.code.value = '';
    setEnrollStatus('');
  } catch (error) {
    setEnrollStatus(error?.message || 'Protected enrollment failed.', true);
  }
}

async function removePhone() {
  await unregisterPushNotifications();
  const state = managerNativeSecurity.getStatus();
  if (state.active || state.blocked || state.removal_pending) await managerNativeSecurity.remove();
  renderEnrollment('This phone has been removed. A new personal code is required to enroll it again.');
}

els.form.addEventListener('submit', enroll);
els.bootRetry.addEventListener('click', () => { showBoot('Trying again…'); void refresh(); });
els.refresh.addEventListener('click', () => refresh().catch((error) => setHubStatus(error.message, 'error')));
els.logout.addEventListener('click', () => {
  if (confirm('Remove this phone from your Memphis Zoo Ops account?')) {
    void removePhone().catch((error) => setHubStatus(error?.message || 'Removal failed.', 'error'));
  }
});
void Network.addListener('networkStatusChange', ({ connected }) => {
  document.getElementById('offline-banner')?.remove();
  if (!connected) {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline';
    banner.textContent = 'Offline';
    document.body.appendChild(banner);
  } else {
    void refresh({ quiet: managerNativeSecurity.getStatus()?.active === true });
  }
});
void App.addListener('resume', () => {
  void hideSystemStatusBar();
  void refresh({ quiet: managerNativeSecurity.getStatus()?.active === true });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) void hideSystemStatusBar(); });
void (async () => {
  await hideSystemStatusBar();
  showBoot();
  await installNotificationRouting();
  await refresh();
})();
