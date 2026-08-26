import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';

const security = window.MemphisCustodialSecurity;
if (!security?.native) throw new Error('The Custodial phone security bridge is unavailable.');

const els = {
  home: document.getElementById('home'),
  name: document.getElementById('employee-name'),
  phoneLock: document.getElementById('phone-lock'),
  phoneLockClock: document.getElementById('phone-lock-clock'),
  phoneLockDate: document.getElementById('phone-lock-date'),
  phoneLockName: document.getElementById('phone-lock-name'),
  phoneUnlock: document.getElementById('phone-unlock'),
  boot: document.getElementById('boot'),
  bootTitle: document.getElementById('boot-title'),
  bootStatus: document.getElementById('boot-status'),
  enrollment: document.getElementById('enrollment'),
  enrollmentTitle: document.getElementById('enrollment-title'),
  enrollmentLead: document.getElementById('enrollment-lead'),
  form: document.getElementById('enroll-form'),
  device: document.getElementById('device-id'),
  code: document.getElementById('code'),
  enrollSubmit: document.getElementById('enroll-submit'),
  cancelEnrollment: document.getElementById('cancel-pending-enrollment'),
  enrollStatus: document.getElementById('enroll-status'),
  activeCleaning: document.getElementById('active-cleaning'),
  activeCleaningText: document.getElementById('active-cleaning-text'),
};

let profile = null;
let recoveryStatus = null;
let enrollmentSubmitting = false;
let phoneLockClockTimer = null;
let restoreRetryTimer = null;
const PHONE_UNLOCKED_KEY = 'mz_custodial_phone_unlocked_since_wake_v1';
const kioskIds = Array.from({ length: 9 }, (_value, index) => `KIOSK_${String(index + 2).padStart(2, '0')}`);
for (const id of kioskIds) els.device.insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);

function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function setStatus(element, text = '', kind = '') { element.textContent = text; element.className = `status${kind ? ` ${kind}` : ''}`; }
function deviceId() { return String(security.getStatus().deviceId || '').trim().toUpperCase(); }
function phoneUnlockedSinceWake() { try { return sessionStorage.getItem(PHONE_UNLOCKED_KEY) === '1'; } catch { return false; } }
function setPhoneUnlocked(value) { try { if (value) sessionStorage.setItem(PHONE_UNLOCKED_KEY, '1'); else sessionStorage.removeItem(PHONE_UNLOCKED_KEY); } catch {} }
function updatePhoneLockClock() {
  const now = new Date();
  els.phoneLockClock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  els.phoneLockDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function setEmployeeIdentity(value) {
  const name = employeeName(value);
  if (!name) return false;
  els.name.textContent = name;
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
  for (const page of [els.home, els.boot, els.enrollment]) page.hidden = page !== element;
  if (element !== els.home) hidePhoneLock();
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
function recoveryCandidates(status) {
  const recovery = status?.recovery || {};
  const values = [];
  for (const identity of Array.isArray(recovery.original_identities) ? recovery.original_identities : []) {
    values.push(identity?.canonical_device_id, identity?.device_id, ...(Array.isArray(identity?.original_values) ? identity.original_values : []));
  }
  values.push(...Object.values(recovery.original_device_keys || {}));
  return [...new Set(values.map(canonicalKiosk).filter(Boolean))].sort();
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
  const reconcile = window.MemphisMobile?.reconcileRecoveredPreStart;
  const releaseQueue = window.MemphisScanSync?.releaseStartupRecoveryGate;
  if (typeof reconcile !== 'function' || typeof releaseQueue !== 'function') {
    return { state: 'manager_required' };
  }
  let recovery;
  try {
    recovery = await reconcile();
  } catch {
    return { state: 'manager_required' };
  }
  if (recovery?.state === 'manager_required') return recovery;
  return releaseQueue(recovery) === true ? recovery : { state: 'manager_required' };
}
function cachedProfile() { return window.MemphisMobile?.readCustodialHomeCache?.()?.profile || null; }
function employeeName(value) {
  return String(value?.employee_name || value?.employee?.display_name || value?.employee?.name || '').trim();
}
function showCachedPhoneIdentity() {
  const cached = cachedProfile();
  if (!cached || !employeeName(cached)) return null;
  profile = cached;
  showPhoneLock(cached);
  return cached;
}
function showHome(value = profile) {
  const name = employeeName(value);
  if (!name) return false;
  clearRestoreRetry();
  profile = value;
  setEmployeeIdentity(value);
  showOnly(els.home);
  if (phoneUnlockedSinceWake()) hidePhoneLock();
  else showPhoneLock(value);
  return true;
}
function simpleSetupError(error) {
  const message = safe(error);
  if (/invalid|used|expired|rejected/i.test(message)) return 'That manager code did not work. Ask for a new code.';
  if (/network|fetch|connect|timeout|offline/i.test(message)) return 'No connection. Try again when the phone reconnects.';
  return 'Setup could not finish. Ask a manager for help.';
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
function showEnrollment(message = '', status = null) {
  clearRestoreRetry();
  recoveryStatus = status?.quarantined ? status : null;
  reportUnresolvedProtectedRecovery(recoveryStatus);
  const pending = pendingEnrollmentOperation();
  showOnly(els.enrollment);
  els.device.disabled = false;
  els.enrollSubmit.disabled = enrollmentSubmitting;
  if (pending) {
    els.cancelEnrollment.hidden = false;
    els.device.value = pending.device_id;
    els.device.disabled = true;
    els.enrollmentTitle.textContent = pending.flow === 'recovery' ? 'Finish phone recovery' : 'Finish phone setup';
    els.enrollmentLead.textContent = 'Setup was interrupted. Tap Resume to safely continue the same setup.';
    els.enrollSubmit.textContent = 'Resume';
    setStatus(els.enrollStatus, message, message ? 'error' : 'info');
    return;
  }
  els.cancelEnrollment.hidden = true;
  if (!recoveryStatus) {
    els.device.value = '';
    els.enrollmentTitle.textContent = 'Set up this phone';
    els.enrollmentLead.textContent = 'A manager chooses the phone number and gives you an eight-digit code.';
    els.enrollSubmit.textContent = 'Set Up Phone';
    setStatus(els.enrollStatus, message, message ? 'error' : '');
    return;
  }
  const candidates = recoveryCandidates(recoveryStatus);
  els.enrollmentTitle.textContent = 'This phone needs a manager.';
  els.enrollmentLead.textContent = 'Saved work is still on this phone. A manager must enter a new code to recover it.';
  els.enrollSubmit.textContent = 'Recover Phone';
  if (candidates.length === 1) {
    els.device.value = candidates[0];
    els.device.disabled = true;
    setStatus(els.enrollStatus, message, message ? 'error' : 'info');
    return;
  }
  els.device.value = '';
  els.device.disabled = true;
  els.enrollSubmit.disabled = true;
  setStatus(els.enrollStatus, 'A manager must inspect this phone.', 'error');
}
async function ensurePhoneNotifications() {
  const register = window.MemphisMobile?.ensurePushRegistration;
  if (register) await register({ requestPermission: true }).catch(() => null);
}
async function restore({ quiet = false } = {}) {
  if (!quiet) showBoot();
  let status;
  try {
    if (security.getStatus().state === 'removing' || pendingEnrollmentOperation()) {
      await window.MemphisMobile?.resumePendingSecurityWorkflow?.();
    }
    status = await security.ensureSecurityState();
  } catch (error) {
    status = security.getStatus();
    if (status.quarantined) return showEnrollment('', status);
    if (pendingEnrollmentOperation()) return showEnrollment(simpleSetupError(error), status);
    return showManagerNeeded();
  }
  if (status.quarantined) return showEnrollment('', status);
  if (status.ready !== true || status.available !== true) return showManagerNeeded();
  if (status.state !== 'enrolled' || !deviceId()) return showEnrollment();
  const cached = showCachedPhoneIdentity();
  const preStart = await reconcileProtectedStartup();
  if (preStart?.state === 'manager_required') return showManagerNeeded();
  try {
    profile = await request(`/device-auth/status?device_id=${encodeURIComponent(deviceId())}`);
    if (!profile?.authenticated || !employeeName(profile)) throw Object.assign(new Error('This phone must be set up again.'), { status: 401 });
    await saveProfile();
    if (resumeProtectedCleaning()) return;
    showHome(profile);
    void ensurePhoneNotifications();
  } catch (error) {
    const failed = security.getStatus();
    if (failed.quarantined) return showEnrollment('', failed);
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) return showManagerNeeded();
    if (cached && employeeName(cached)) {
      profile = cached;
      if (resumeProtectedCleaning()) return;
      showHome(cached);
      return;
    }
    showNoConnection();
  }
}
async function enroll(event) {
  event.preventDefault();
  if (enrollmentSubmitting) return;
  const selected = canonicalKiosk(els.device.value);
  const code = String(els.code.value || '').replace(/\D/g, '').slice(0, 8);
  if (!selected) return setStatus(els.enrollStatus, 'Choose the phone number the manager gave you.', 'error');
  if (!/^\d{8}$/.test(code)) return setStatus(els.enrollStatus, 'Enter the eight-digit manager code.', 'error');
  enrollmentSubmitting = true;
  els.enrollSubmit.disabled = true;
  const recovery = security.getStatus().quarantined === true;
  const pending = pendingEnrollmentOperation();
  setStatus(els.enrollStatus, 'Please wait…', 'info');
  try {
    const enrollDevice = window.MemphisMobile?.enrollDevice;
    if (typeof enrollDevice !== 'function') throw new Error('Setup is unavailable.');
    const enrollment = await enrollDevice({
      deviceId: selected,
      managerCode: code,
      flow: pending?.flow || (recovery ? 'recovery' : 'enrollment'),
    });
    profile = {
      ...enrollment,
      authenticated: true,
      canonical_device_id: enrollment.device_id,
      employee_name: enrollment.employee?.display_name || enrollment.employee?.name,
    };
    if (!employeeName(profile)) profile = await request(`/device-auth/status?device_id=${encodeURIComponent(selected)}`);
    await saveProfile();
    const preStart = await reconcileProtectedStartup();
    if (preStart?.state === 'manager_required') return showManagerNeeded();
    els.code.value = '';
    if (resumeProtectedCleaning()) return;
    showHome(profile);
    void ensurePhoneNotifications();
  } catch (error) {
    const failed = security.getStatus();
    if (failed.quarantined) showEnrollment(simpleSetupError(error), failed);
    else setStatus(els.enrollStatus, simpleSetupError(error), 'error');
  } finally {
    enrollmentSubmitting = false;
    if (!els.enrollment.hidden) {
      els.enrollSubmit.disabled = pendingEnrollmentOperation()
        ? false
        : (recoveryStatus ? recoveryCandidates(recoveryStatus).length !== 1 : false);
    }
  }
}
async function cancelPendingEnrollment() {
  if (enrollmentSubmitting) return;
  const operation = pendingEnrollmentOperation();
  if (!operation || operation.status !== 'pending_server') return;
  enrollmentSubmitting = true;
  els.enrollSubmit.disabled = true;
  els.cancelEnrollment.disabled = true;
  setStatus(els.enrollStatus, 'Please wait…', 'info');
  try {
    const cancel = window.MemphisMobile?.cancelPendingEnrollment;
    if (typeof cancel !== 'function') throw new Error('Setup cancellation is unavailable.');
    await cancel();
    els.code.value = '';
    showEnrollment('Saved setup was cancelled. Ask for a new manager code.');
  } catch (error) {
    setStatus(els.enrollStatus, simpleSetupError(error), 'error');
  } finally {
    enrollmentSubmitting = false;
    els.cancelEnrollment.disabled = false;
    if (!els.enrollment.hidden) els.enrollSubmit.disabled = false;
  }
}

els.form.addEventListener('submit', enroll);
els.cancelEnrollment.addEventListener('click', () => void cancelPendingEnrollment());
els.phoneUnlock.addEventListener('click', unlockPhone);
security.subscribe((status) => {
  if (status.quarantined) showEnrollment('', status);
  else if (status.initialized && status.available === false) showManagerNeeded();
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
