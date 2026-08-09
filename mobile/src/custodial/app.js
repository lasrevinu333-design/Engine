const security = window.MemphisCustodialSecurity;
if (!security?.native) throw new Error('The protected Custodial security bridge is unavailable.');

const els = {
  boot: document.getElementById('boot'),
  bootStatus: document.getElementById('boot-status'),
  bootRetry: document.getElementById('boot-retry'),
  enrollment: document.getElementById('enrollment'),
  enrollmentEyebrow: document.getElementById('enrollment-eyebrow'),
  enrollmentTitle: document.getElementById('enrollment-title'),
  enrollmentLead: document.getElementById('enrollment-lead'),
  form: document.getElementById('enroll-form'),
  device: document.getElementById('device-id'),
  code: document.getElementById('code'),
  enrollSubmit: document.getElementById('enroll-submit'),
  cancelEnrollment: document.getElementById('cancel-pending-enrollment'),
  enrollStatus: document.getElementById('enroll-status'),
};

let recoveryStatus = null;
let enrollmentSubmitting = false;
const kioskIds = Array.from({ length: 9 }, (_value, index) => `KIOSK_${String(index + 2).padStart(2, '0')}`);
for (const id of kioskIds) els.device.insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);

function safe(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function setStatus(element, text = '', kind = '') {
  element.textContent = text;
  element.className = `status${kind ? ` ${kind}` : ''}`;
}

function canonicalKiosk(value) {
  const match = String(value || '').trim().match(/^KIOSK[_-]?(\d{1,2})$/i);
  const number = match ? Number(match[1]) : 0;
  return number >= 2 && number <= 10 ? `KIOSK_${String(number).padStart(2, '0')}` : '';
}

function deviceId() {
  return canonicalKiosk(security.getStatus()?.deviceId);
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
    values.push(
      identity?.canonical_device_id,
      identity?.device_id,
      ...(Array.isArray(identity?.original_values) ? identity.original_values : []),
    );
  }
  values.push(...Object.values(recovery.original_device_keys || {}));
  return [...new Set(values.map(canonicalKiosk).filter(Boolean))].sort();
}

function preservedWorkText(status) {
  const counts = status?.recovery?.current_preserved_counts
    || status?.preservedCounts
    || status?.recovery?.preserved_counts
    || {};
  const total = Number(counts.total_pending || 0);
  return total
    ? `${total} saved work item${total === 1 ? '' : 's'} will remain untouched.`
    : 'No saved work will be discarded.';
}

function showBoot(message = 'Checking protected enrollment.', error = false) {
  els.boot.hidden = false;
  els.bootStatus.textContent = message;
  els.bootRetry.hidden = !error;
  els.enrollment.hidden = true;
}

function showEnrollment(message = '', status = null) {
  recoveryStatus = status?.quarantined ? status : null;
  const pending = pendingEnrollmentOperation();
  els.boot.hidden = true;
  els.enrollment.hidden = false;
  els.device.disabled = false;
  els.enrollSubmit.disabled = enrollmentSubmitting;

  if (pending) {
    els.cancelEnrollment.hidden = false;
    els.device.value = pending.device_id;
    els.device.disabled = true;
    els.enrollmentEyebrow.textContent = 'Resume protected setup';
    els.enrollmentTitle.textContent = pending.flow === 'recovery'
      ? 'Finish phone recovery'
      : 'Finish employee phone enrollment';
    els.enrollmentLead.textContent = `Resume the saved ${pending.flow} operation for ${pending.device_id}. Use a current manager code if the earlier code expired.`;
    els.enrollSubmit.textContent = pending.flow === 'recovery' ? 'Resume Recovery' : 'Resume Enrollment';
    setStatus(
      els.enrollStatus,
      message || `Resume the saved ${pending.flow} operation for ${pending.device_id}.`,
      message ? 'error' : 'info',
    );
    return;
  }

  if (!recoveryStatus) {
    els.cancelEnrollment.hidden = true;
    els.device.value = '';
    els.device.disabled = false;
    els.enrollmentEyebrow.textContent = 'One-time setup';
    els.enrollmentTitle.textContent = 'Enroll employee phone';
    els.enrollmentLead.textContent = 'A Custodial Manager selects the assigned phone and enters its current single-use code.';
    els.enrollSubmit.textContent = 'Enroll Phone';
    setStatus(els.enrollStatus, message, message ? 'error' : '');
    return;
  }

  const candidates = recoveryCandidates(recoveryStatus);
  els.cancelEnrollment.hidden = true;
  els.enrollmentEyebrow.textContent = 'Protected recovery';
  els.enrollmentTitle.textContent = 'Manager recovery required';
  els.enrollmentLead.textContent = `${preservedWorkText(recoveryStatus)} Enter a new single-use manager code to reconnect the phone safely.`;
  els.enrollSubmit.textContent = 'Recover Phone';

  if (candidates.length === 1) {
    els.device.value = candidates[0];
    els.device.disabled = true;
    setStatus(
      els.enrollStatus,
      message || `Recovery is locked to ${candidates[0]}.`,
      message ? 'error' : 'info',
    );
    return;
  }

  els.device.value = '';
  els.device.disabled = true;
  els.enrollSubmit.disabled = true;
  setStatus(
    els.enrollStatus,
    'This phone needs manager inspection before recovery can continue.',
    'error',
  );
}

function employeeHomeUrl() {
  const target = new URL('./employee-hub.html', location.href);
  target.searchParams.set('hub', 'employee');
  const id = deviceId();
  if (id) target.searchParams.set('device', id);
  return target.toString();
}

function openEmployeeHome() {
  location.replace(employeeHomeUrl());
}

async function prepareNotifications() {
  const register = window.MemphisMobile?.ensurePushRegistration;
  if (typeof register !== 'function') return;
  await register({ requestPermission: true }).catch(() => null);
}

async function restore() {
  showBoot();
  let status;
  try {
    if (security.getStatus().state === 'removing' || pendingEnrollmentOperation()) {
      await window.MemphisMobile?.resumePendingSecurityWorkflow?.();
    }
    status = await security.ensureSecurityState();
  } catch (error) {
    status = security.getStatus();
    if (status.quarantined) return showEnrollment('', status);
    if (pendingEnrollmentOperation()) return showEnrollment(safe(error), status);
    return showBoot('This phone needs manager help.', true);
  }

  if (status.quarantined) return showEnrollment('', status);
  if (status.ready !== true || status.available !== true) {
    return showBoot('This phone needs manager help.', true);
  }
  if (status.state !== 'enrolled' || !deviceId()) return showEnrollment();

  await prepareNotifications();
  openEmployeeHome();
}

async function enroll(event) {
  event.preventDefault();
  if (enrollmentSubmitting) return;

  const selected = canonicalKiosk(els.device.value);
  const code = String(els.code.value || '').replace(/\D/g, '').slice(0, 8);
  if (!selected) return setStatus(els.enrollStatus, 'Choose the assigned employee phone.', 'error');
  if (!/^\d{8}$/.test(code)) return setStatus(els.enrollStatus, 'Enter the eight-digit manager code.', 'error');

  enrollmentSubmitting = true;
  els.enrollSubmit.disabled = true;
  const recovery = security.getStatus().quarantined === true;
  const pending = pendingEnrollmentOperation();
  setStatus(els.enrollStatus, recovery ? 'Recovering phone…' : 'Enrolling phone…', 'info');

  try {
    const enrollDevice = window.MemphisMobile?.enrollDevice;
    if (typeof enrollDevice !== 'function') throw new Error('Protected enrollment is unavailable.');
    await enrollDevice({
      deviceId: selected,
      managerCode: code,
      flow: pending?.flow || (recovery ? 'recovery' : 'enrollment'),
    });
    els.code.value = '';
    await prepareNotifications();
    openEmployeeHome();
  } catch (error) {
    const failed = security.getStatus();
    if (failed.quarantined) showEnrollment(safe(error), failed);
    else setStatus(els.enrollStatus, safe(error), 'error');
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
  setStatus(els.enrollStatus, 'Cancelling saved setup…', 'info');
  try {
    const cancel = window.MemphisMobile?.cancelPendingEnrollment;
    if (typeof cancel !== 'function') throw new Error('Protected setup cancellation is unavailable.');
    await cancel();
    els.code.value = '';
    showEnrollment('Saved setup cancelled. Enter a current manager code to begin again.');
  } catch (error) {
    setStatus(els.enrollStatus, safe(error), 'error');
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
  else if (status.initialized && status.available === false) showBoot('This phone needs manager help.', true);
});

void (async () => {
  await security.ready;
  await window.MemphisMobile?.resumePendingSecurityWorkflow?.().catch(() => {});
  await restore();
})();
