import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';

const security = window.MemphisCustodialSecurity;
if (!security?.native) throw new Error('The Custodial phone security bridge is unavailable.');

const els = {
  home: document.getElementById('home'),
  name: document.getElementById('employee-name'),
  boot: document.getElementById('boot'),
  bootTitle: document.getElementById('boot-title'),
  bootStatus: document.getElementById('boot-status'),
  bootRetry: document.getElementById('boot-retry'),
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
const kioskIds = Array.from({ length: 9 }, (_value, index) => `KIOSK_${String(index + 2).padStart(2, '0')}`);
for (const id of kioskIds) els.device.insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);

function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function setStatus(element, text = '', kind = '') { element.textContent = text; element.className = `status${kind ? ` ${kind}` : ''}`; }
function deviceId() { return String(security.getStatus().deviceId || '').trim().toUpperCase(); }
function showOnly(element) { for (const page of [els.home, els.boot, els.enrollment]) page.hidden = page !== element; }
function showBoot(title = 'Please wait', message = 'Opening your work phone…', retry = false) {
  showOnly(els.boot); els.bootTitle.textContent = title; els.bootStatus.textContent = message; els.bootRetry.hidden = !retry;
}
function showManagerNeeded() { showBoot('This phone needs a manager.', 'Your saved work has not been erased.', true); }
function showNoConnection() { showBoot('No connection', 'Tap Try Again, or scan a location tag to keep working.', true); }
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
  els.activeCleaningText.textContent = `You are cleaning ${location}. Tap the same location tag when you are done.`;
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
function cachedProfile() { return window.MemphisMobile?.readCustodialHomeCache?.()?.profile || null; }
function employeeName(value) {
  return String(value?.employee_name || value?.employee?.display_name || value?.employee?.name || '').trim();
}
function showHome(value = profile) {
  const name = employeeName(value);
  if (!name) return false;
  profile = value;
  els.name.textContent = name;
  showOnly(els.home);
  return true;
}
function simpleSetupError(error) {
  const message = safe(error);
  if (/invalid|used|expired|rejected/i.test(message)) return 'That manager code did not work. Ask for a new code.';
  if (/network|fetch|connect|timeout|offline/i.test(message)) return 'No connection. Try again when the phone reconnects.';
  return 'Setup could not finish. Ask a manager for help.';
}
function showEnrollment(message = '', status = null) {
  recoveryStatus = status?.quarantined ? status : null;
  const reportRecovery = window.MemphisMobile?.reportProtectedRecoveryDiagnostic;
  if (recoveryStatus && typeof reportRecovery === 'function') {
    void reportRecovery({
      reason: recoveryStatus.reason,
      outcome: 'not_attempted',
      detail: 'no_additional_detail',
    }).catch(() => false);
  }
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
    const cached = cachedProfile();
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
els.bootRetry.addEventListener('click', () => void restore());
security.subscribe((status) => {
  if (status.quarantined) showEnrollment('', status);
  else if (status.initialized && status.available === false) showManagerNeeded();
});
void Network.addListener('networkStatusChange', ({ connected }) => {
  if (connected) void restore({ quiet: !els.home.hidden });
});
void App.addListener('resume', () => {
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
