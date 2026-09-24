import { installHomeFacts } from './home-facts-dom.js';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';

const security = window.MemphisCustodialSecurity;
if (!security?.native) throw new Error('The Custodial phone security bridge is unavailable.');

const els = {
  home: document.getElementById('home'),
  name: document.getElementById('employee-name'),
  role: document.getElementById('employee-role'),
  phoneLock: document.getElementById('phone-lock'),
  phoneLockClock: document.getElementById('phone-lock-clock'),
  phoneLockDate: document.getElementById('phone-lock-date'),
  phoneLockName: document.getElementById('phone-lock-name'),
  homeClock: document.getElementById('home-clock'),
  homeDate: document.getElementById('home-date'),
  phoneUnlock: document.getElementById('phone-unlock'),
  boot: document.getElementById('boot'),
  bootTitle: document.getElementById('boot-title'),
  bootStatus: document.getElementById('boot-status'),
  assignment: document.getElementById('assignment'),
  assignmentStatus: document.getElementById('assignment-status'),
  activeCleaning: document.getElementById('active-cleaning'),
  activeCleaningText: document.getElementById('active-cleaning-text'),
};

let profile = null;
let restoreRunning = null;
let restoreAgain = false;
let previousAssignmentState = null;
let phoneLockClockTimer = null;
let restoreRetryTimer = null;
const homeFactsUI=installHomeFacts({getProfile:()=>profile,getDeviceId:deviceId,isVisible:()=>!els.home.hidden,security,
  requestJson:(path,options)=>window.MemphisMobile.requestJson(path,options)});
const PHONE_UNLOCKED_KEY = 'mz_custodial_phone_unlocked_since_wake_v1';

function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function setStatus(element, text = '', kind = '') { element.textContent = text; element.className = `status${kind ? ` ${kind}` : ''}`; }
function deviceId() { return String(security.getStatus().deviceId || '').trim().toUpperCase(); }
function currentProfile(value) { return window.MemphisMobile?.profileMatchesPrincipal?.(value) === true; }
function phoneUnlockedSinceWake() { try { return sessionStorage.getItem(PHONE_UNLOCKED_KEY) === '1'; } catch { return false; } }
function setPhoneUnlocked(value) { try { if (value) sessionStorage.setItem(PHONE_UNLOCKED_KEY, '1'); else sessionStorage.removeItem(PHONE_UNLOCKED_KEY); } catch {} }
function updatePhoneLockClock() {
  const now = new Date();
  els.phoneLockClock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  els.phoneLockDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  els.homeClock.textContent = now.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
  els.homeDate.textContent = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric' });
}
function setEmployeeIdentity(value) {
  if (!currentProfile(value)) return false;
  const name = employeeName(value);
  if (!name) return false;
  els.name.textContent = name;
  els.role.textContent = employeeRole(value);
  els.phoneLockName.textContent = name;
  return true;
}
function showPhoneLock(value = profile) {
  if (!setEmployeeIdentity(value)) return false;
  updatePhoneLockClock();
  if (!phoneLockClockTimer) phoneLockClockTimer = window.setInterval(updatePhoneLockClock, 1000);
  els.phoneLock.hidden = false;
  return true;
}
function hidePhoneLock() { els.phoneLock.hidden = true; }
function unlockPhone() { setPhoneUnlocked(true); hidePhoneLock(); }
function relockPhone() { setPhoneUnlocked(false); if (profile) showPhoneLock(profile); }
function showOnly(element) {
  for (const page of [els.home, els.boot, els.assignment]) page.hidden = page !== element;
  if (element !== els.home) { hidePhoneLock(); homeFactsUI.stop(); }
}
function clearRestoreRetry() {
  if (restoreRetryTimer) window.clearTimeout(restoreRetryTimer);
  restoreRetryTimer = null;
}
function showBoot(title = 'Please wait', message = 'Opening your work phone…') {
  showOnly(els.boot); els.bootTitle.textContent = title; els.bootStatus.textContent = message;
}
function showManagerNeeded() {
  clearRestoreRetry();
  showBoot('This phone needs a manager.', 'Your saved work has not been erased. Ask a manager for help.');
}
function showNoConnection() {
  showBoot('No connection', 'Keep working. This phone will reconnect automatically.');
  clearRestoreRetry();
  restoreRetryTimer = window.setTimeout(() => void restore(), 5000);
}
function resumeProtectedCleaning() {
  const id = deviceId();
  if (!id) return false;
  const resolved = window.MemphisUI?.resolveOpenScanSession?.(id) || { state: 'corrupted', session: null };
  if (resolved.state === 'none') {
    els.activeCleaning.hidden = true;
    return false;
  }
  if (resolved.state !== 'open') {
    showManagerNeeded();
    return true;
  }
  const location = String(resolved.session?.location_name || resolved.session?.location_code || '').trim();
  if (!location) {
    showManagerNeeded();
    return true;
  }
  if (window.MemphisUI?.isUnstartedScanSession?.(resolved.session)) {
    els.activeCleaningText.textContent = `Cleaning did not start at ${location}. Tap the location tag again.`;
  } else {
    els.activeCleaningText.textContent = `You are cleaning ${location}. Tap the same location tag when you are done.`;
  }
  els.activeCleaning.hidden = false;
  return false;
}
function canonicalKiosk(value) {
  const match = String(value || '').trim().match(/^KIOSK[_-]?(\d{1,2})$/i);
  const number = match ? Number(match[1]) : 0;
  return number >= 2 && number <= 10 ? `KIOSK_${String(number).padStart(2, '0')}` : '';
}
function pendingEnrollmentOperation() {
  const operation = security.getPendingEnrollmentOperation?.();
  const selected = canonicalKiosk(operation?.device_id);
  const flow = String(operation?.flow || '').trim();
  const status = String(operation?.status || '').trim();
  if (!selected || !['enrollment', 'recovery'].includes(flow)) return null;
  if (!['pending_server', 'local_committed_pending_server_confirmation'].includes(status)) return null;
  return { ...operation, device_id: selected, flow, status };
}
async function request(path, { method = 'GET', body = null } = {}) {
  const requestJson = window.MemphisMobile?.requestJson;
  if (typeof requestJson !== 'function') throw new Error('The phone connection is unavailable.');
  return requestJson(path, { method, body });
}
async function saveProfile() {
  if (!profile) return false;
  return window.MemphisMobile?.saveCustodialHomeCache?.({ profile }) ?? false;
}
async function reconcileProtectedStartup() {
  const reconcile = window.MemphisScanSync?.reconcileStartupRecovery;
  if(typeof reconcile!=='function') return {state:'manager_required'};
  return reconcile();
}
function cachedProfile() { return window.MemphisMobile?.readCustodialHomeCache?.()?.profile || null; }
function employeeName(value) {
  return String(value?.employee_name || value?.employee?.display_name || value?.employee?.name || '').trim();
}
function employeeRole(value) {
  // The displayed job title is independent of the protected access role.
  void value;
  return 'Custodian';
}

function hasEmployeeRole(value) {
  return Boolean(String(value?.employee_role || value?.employee?.role || '').trim());
}
function showCachedPhoneIdentity() {
  const cached = cachedProfile();
  if (!cached || !employeeName(cached) || !currentProfile(cached)) return null;
  profile = cached;
  showPhoneLock(cached);
  return cached;
}
function showHome(value = profile) {
  const name = employeeName(value);
  if (!name || !currentProfile(value)) return false;
  clearRestoreRetry();
  profile = value;
  setEmployeeIdentity(value);
  showOnly(els.home);
  if (phoneUnlockedSinceWake()) hidePhoneLock();
  else showPhoneLock(value);
  homeFactsUI.update();
  return true;
}
function reportUnresolvedProtectedRecovery(status) {
  const reportRecovery = window.MemphisMobile?.reportProtectedRecoveryDiagnostic;
  if (!status?.quarantined || typeof reportRecovery !== 'function') return;
  const recoveryId = String(status.recovery?.recovery_id || '');
  // The bridge owns the current native revalidation attempt and its exact
  // bounded diagnostic. Wait for that attempt to finish before emitting the
  // UI fallback so a generic "not attempted" record cannot mask the actual
  // recovery outcome in logcat.
  void Promise.resolve(window.MemphisMobile?.whenReady?.())
    .catch(() => null)
    .then(() => {
      const current = security.getStatus();
      if (
        current.quarantined !== true
        || current.reason !== status.reason
        || String(current.recovery?.recovery_id || '') !== recoveryId
      ) return false;
      return reportRecovery({
        reason: current.reason,
        outcome: 'not_attempted',
        detail: 'no_additional_detail',
      });
    })
    .catch(() => false);
}
function showAssignmentNeeded(_message = '', status = null) {
  clearRestoreRetry();
  reportUnresolvedProtectedRecovery(status);
  showOnly(els.assignment);
  els.assignmentStatus.textContent = status?.quarantined
    ? 'A manager must restore this phone’s assignment.'
    : 'Your manager assigns this phone. No employee sign-in is needed.';
}
async function prepareOfflineAuthority() {
  if (!navigator.onLine || !deviceId()) return;
  try {
    const snapshot=await request('/scan-api/rpc',{method:'POST',body:{device_id:deviceId(),fn:'tool_get_offline_scan_authority_snapshot',args:{p_device_id:deviceId()}}});
    if (snapshot) await window.MemphisMobile?.saveOfflineScanAuthoritySnapshot?.(snapshot);
  } catch { /* Native bounded diagnostics report genuine storage failures. Existing local authority stays intact. */ }
}
async function ensurePhoneNotifications() {
  const register = window.MemphisMobile?.ensurePushRegistration;
  if (register) await register({ requestPermission: true }).catch(() => null);
}
async function restoreNow({ quiet = false } = {}) {
  if (!quiet) showBoot();
  let status;
  try {
    if (security.getStatus().state === 'removing' || pendingEnrollmentOperation()) {
      await window.MemphisMobile?.resumePendingSecurityWorkflow?.();
    }
    status = await security.ensureSecurityState();
  } catch (error) {
    status = security.getStatus();
    if (status.quarantined) return showAssignmentNeeded('', status);
    if (pendingEnrollmentOperation()) return showAssignmentNeeded('', status);
    return showManagerNeeded();
  }
  if (status.quarantined) return showAssignmentNeeded('', status);
  if (status.ready !== true || status.available !== true) return showManagerNeeded();
  if (status.state !== 'enrolled' || !deviceId()) return showAssignmentNeeded();
  const cached = showCachedPhoneIdentity();
  try { await window.MemphisScanSync?.recoverLocalCompletionIntents?.(); } catch { return showManagerNeeded(); }
  const preStart = await reconcileProtectedStartup();
  if (preStart?.state === 'manager_required') return showManagerNeeded();
  const requestedDevice = deviceId();
  if (!requestedDevice) return showAssignmentNeeded();
  try {
    profile = await request(`/device-auth/status?device_id=${encodeURIComponent(requestedDevice)}`);
    const current = security.getStatus();
    if (deviceId() !== requestedDevice || current.state !== 'enrolled' || current.quarantined || current.available !== true) {
      profile = null;
      return showAssignmentNeeded('', current);
    }
    if (!profile?.authenticated || !employeeName(profile) || !currentProfile(profile)) throw Object.assign(new Error('This phone must be set up again.'), { status: 401 });
    try { await saveProfile(); } catch { /* Identity remains authenticated; offline persistence is optional. */ }
    if (!currentProfile(profile)) return;
    void prepareOfflineAuthority();
    if (resumeProtectedCleaning()) return;
    showHome(profile);
    void ensurePhoneNotifications();
  } catch (error) {
    const failed = security.getStatus();
    if (deviceId() !== requestedDevice || failed.state !== 'enrolled' || failed.quarantined || failed.available !== true) {
      profile = null;
      return showAssignmentNeeded('', failed);
    }
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) return showManagerNeeded();
    if (cached && employeeName(cached) && currentProfile(cached)) {
      profile = cached;
      if (resumeProtectedCleaning()) return;
      showHome(cached);
      return;
    }
    showNoConnection();
  }
}
function restore(options = {}) {
  if (restoreRunning) { restoreAgain = true; return restoreRunning; }
  restoreRunning = (async () => {
    do { restoreAgain = false; await restoreNow(options); } while (restoreAgain);
  })().finally(() => { restoreRunning = null; });
  return restoreRunning;
}

els.phoneUnlock.addEventListener('click', unlockPhone);
security.subscribe((status) => {
  const assignmentState = `${status.state || ''}|${status.deviceId || ''}|${status.quarantined === true}|${window.MemphisMobile?.principalIdentity?.() || ''}`;
  const changed = assignmentState !== previousAssignmentState;
  previousAssignmentState = assignmentState;
  if (changed) {
    profile = null;
    els.name.textContent = ''; els.role.textContent = ''; els.phoneLockName.textContent = '';
    els.activeCleaning.hidden = true;
    showBoot();
  }
  if (status.quarantined) showAssignmentNeeded('', status);
  else if (status.initialized && status.available === false) showManagerNeeded();
  else if (changed && status.initialized && status.state !== 'enrolled') {
    profile = null;
    showAssignmentNeeded('', status);
  }
  else if (changed && status.state === 'enrolled' && status.ready === true && status.available === true) {
    void restore({ quiet: !els.home.hidden });
  }
});
void Network.addListener('networkStatusChange', ({ connected }) => {
  if (connected) void restore({ quiet: !els.home.hidden });
});
void App.addListener('pause', () => { relockPhone(); });
void App.addListener('resume', () => {
  relockPhone();
  void StatusBar.hide().catch(() => {});
  void restore({ quiet: !els.home.hidden });
});
void (async () => {
  await StatusBar.hide().catch(() => {});
  await security.ready;
  await window.MemphisMobile?.whenReady?.();
  await window.MemphisMobile?.resumePendingSecurityWorkflow?.().catch(() => {});
  await restore();
})();
