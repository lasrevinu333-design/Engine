import { App } from '@capacitor/app';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerAndroidScanningLibrary,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';

const security = window.MemphisCustodialSecurity;
if (!security?.native) throw new Error('The protected Custodial security bridge is unavailable.');
const els = {
  boot: document.getElementById('boot'), bootStatus: document.getElementById('boot-status'), bootRetry: document.getElementById('boot-retry'),
  enrollment: document.getElementById('enrollment'), enrollmentEyebrow: document.getElementById('enrollment-eyebrow'), enrollmentTitle: document.getElementById('enrollment-title'), enrollmentLead: document.getElementById('enrollment-lead'), form: document.getElementById('enroll-form'), device: document.getElementById('device-id'), code: document.getElementById('code'), enrollSubmit: document.getElementById('enroll-submit'), enrollStatus: document.getElementById('enroll-status'),
  home: document.getElementById('home'), identity: document.getElementById('identity'), name: document.getElementById('employee-name'), phone: document.getElementById('employee-phone'),
  areasStatus: document.getElementById('areas-status'), areas: document.getElementById('areas-list'), scanQr: document.getElementById('scan-location-qr'), scanStatus: document.getElementById('scan-status'), refresh: document.getElementById('refresh-areas'), remove: document.getElementById('remove-enrollment'), homeStatus: document.getElementById('home-status'),
};
let profile = null;
let recoveryStatus = null;
let enrollmentSubmitting = false;
const kioskIds = Array.from({ length: 9 }, (_value, index) => `KIOSK_${String(index + 2).padStart(2, '0')}`);
for (const id of kioskIds) els.device.insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);

function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function setStatus(element, text = '', kind = '') { element.textContent = text; element.className = `status${kind ? ` ${kind}` : ''}`; }
function deviceId() { return String(security.getStatus().deviceId || '').trim().toUpperCase(); }
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
  if (typeof requestJson !== 'function') throw new Error('The protected Custodial request bridge is unavailable.');
  return requestJson(path, { method, body });
}
function showBoot(message = 'Checking the protected employee-device enrollment.', error = false) { els.boot.hidden = false; els.bootStatus.textContent = message; els.bootRetry.hidden = !error; els.enrollment.hidden = true; els.home.hidden = true; els.identity.hidden = true; }
function canonicalKiosk(value) {
  const match = String(value || '').trim().match(/^KIOSK[_-]?(\d{1,2})$/i);
  const number = match ? Number(match[1]) : 0;
  return number >= 2 && number <= 10 ? `KIOSK_${String(number).padStart(2, '0')}` : '';
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
function preservedWorkText(status) {
  const counts = status?.recovery?.current_preserved_counts || status?.preservedCounts || status?.recovery?.preserved_counts || {};
  const total = Number(counts.total_pending || 0);
  return total ? `${total} saved work item${total === 1 ? '' : 's'} will remain untouched.` : 'No saved work will be discarded.';
}
function showEnrollment(message = '', status = null) {
  recoveryStatus = status?.quarantined ? status : null;
  const pending = pendingEnrollmentOperation();
  els.boot.hidden = true; els.enrollment.hidden = false; els.home.hidden = true; els.identity.hidden = true;
  els.device.disabled = false; els.enrollSubmit.disabled = enrollmentSubmitting;
  if (pending) {
    els.device.value = pending.device_id;
    els.device.disabled = true;
    els.enrollmentEyebrow.textContent = 'Resume protected setup';
    els.enrollmentTitle.textContent = pending.flow === 'recovery' ? 'Finish phone recovery' : 'Finish employee phone enrollment';
    els.enrollmentLead.textContent = `This phone has one protected ${pending.flow} operation for ${pending.device_id}. Re-enter its original manager code to resume it; a second credential will not be created.`;
    els.enrollSubmit.textContent = pending.flow === 'recovery' ? 'Resume Recovery' : 'Resume Enrollment';
    setStatus(els.enrollStatus, message || `Resume the saved ${pending.flow} operation for ${pending.device_id}.`, message ? 'error' : 'info');
    return;
  }
  if (!recoveryStatus) {
    els.device.value = '';
    els.enrollmentEyebrow.textContent = 'One-time setup';
    els.enrollmentTitle.textContent = 'Enroll employee phone';
    els.enrollmentLead.textContent = 'The Custodial Manager assigns the phone and generates a single-use eight-digit app code.';
    els.enrollSubmit.textContent = 'Enroll Phone';
    setStatus(els.enrollStatus, message, message ? 'error' : '');
    return;
  }
  const candidates = recoveryCandidates(recoveryStatus);
  els.enrollmentEyebrow.textContent = 'Protected phone recovery';
  els.enrollmentTitle.textContent = 'Manager recovery required';
  els.enrollmentLead.textContent = `Android restored or invalidated protected enrollment state. ${preservedWorkText(recoveryStatus)} Enter a new single-use manager code to bind the preserved work back to its proven phone.`;
  els.enrollSubmit.textContent = 'Recover Phone';
  if (candidates.length === 1) {
    els.device.value = candidates[0];
    els.device.disabled = true;
    setStatus(els.enrollStatus, message || `Recovery is locked to ${candidates[0]}.`, message ? 'error' : 'info');
    return;
  }
  els.device.value = '';
  els.device.disabled = true;
  els.enrollSubmit.disabled = true;
  const identityIssue = candidates.length
    ? `Preserved work refers to multiple phones (${candidates.join(', ')}).`
    : 'Preserved work does not prove one KIOSK phone identity.';
  setStatus(els.enrollStatus, `${identityIssue} Recovery remains locked; the Custodial Manager must inspect this phone.`, 'error');
}
function showHome() { recoveryStatus = null; els.boot.hidden = true; els.enrollment.hidden = true; els.home.hidden = false; els.identity.hidden = false; els.name.textContent = profile?.employee_name || profile?.employee?.display_name || 'Custodial Employee'; els.phone.textContent = `${profile?.canonical_device_id || profile?.device_id || deviceId()} · Memphis Zoo Custodial`; }
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
async function ensurePhoneNotifications() {
  const register = window.MemphisMobile?.ensurePushRegistration;
  if (!register) return null;
  const push = await register({ requestPermission: true }).catch(() => null);
  setStatus(
    els.homeStatus,
    push?.registered
      ? 'Phone enrolled and notifications ready.'
      : `Phone enrolled. Notifications are ${push?.receive || 'not registered'}; enable them before production handoff.`,
    push?.registered ? 'ok' : 'error',
  );
  return push;
}
async function restore() {
  showBoot();
  let status;
  try {
    const pending = pendingEnrollmentOperation();
    if (
      security.getStatus().state === 'removing'
      || pending?.status === 'local_committed_pending_server_confirmation'
    ) {
      await window.MemphisMobile?.resumePendingSecurityWorkflow?.();
    }
    status = await security.ensureSecurityState();
  }
  catch (error) {
    status = security.getStatus();
    if (status.quarantined) return showEnrollment('', status);
    return showBoot(safe(error), true);
  }
  if (status.quarantined) return showEnrollment('', status);
  if (status.ready !== true || status.available !== true) return showBoot('Protected phone state is not available. Restart the app and try again.', true);
  if (status.state !== 'enrolled' || !deviceId()) return showEnrollment();
  try { profile = await request(`/device-auth/status?device_id=${encodeURIComponent(deviceId())}`); if (!profile?.authenticated) throw Object.assign(new Error('This phone must be enrolled again.'), { status: 401 }); showHome(); await loadAreas(); await ensurePhoneNotifications(); }
  catch (error) {
    const failed = security.getStatus();
    if (failed.quarantined) return showEnrollment(safe(error), failed);
    showBoot(`Could not refresh right now. This phone remains enrolled. ${safe(error)}`, true);
  }
}
async function enroll(event) {
  event.preventDefault();
  if (enrollmentSubmitting) return;
  const selected = String(els.device.value || '').trim(); const code = String(els.code.value || '').replace(/\D/g, '').slice(0, 8);
  if (!/^KIOSK_(0[2-9]|10)$/.test(selected)) return setStatus(els.enrollStatus, 'Choose the KIOSK phone assigned by the Custodial Manager.', 'error');
  if (!/^\d{8}$/.test(code)) return setStatus(els.enrollStatus, 'Enter the eight-digit app code.', 'error');
  enrollmentSubmitting = true;
  els.enrollSubmit.disabled = true;
  const recovery = security.getStatus().quarantined === true;
  const pending = pendingEnrollmentOperation();
  setStatus(els.enrollStatus, recovery ? 'Recovering protected phone…' : 'Enrolling phone…', 'info');
  try {
    const enrollDevice = window.MemphisMobile?.enrollDevice;
    if (typeof enrollDevice !== 'function') throw new Error('The protected enrollment bridge is unavailable.');
    const enrollment = await enrollDevice({
      deviceId: selected,
      managerCode: code,
      flow: pending?.flow || (recovery ? 'recovery' : 'enrollment'),
    });
    profile = { ...enrollment, authenticated: true, canonical_device_id: enrollment.device_id, employee_name: enrollment.employee?.display_name };
    els.code.value = ''; showHome(); await loadAreas();
    await ensurePhoneNotifications();
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
function scanTarget(value) {
  try {
    const incoming = new URL(String(value || ''));
    const interesting = ['code', 'location', 'loc', 'session_uuid', 'action'];
    const customScan = ['memphiszoo:', 'memphiszoo-custodial:'].includes(incoming.protocol) && incoming.hostname === 'scan';
    const webScan = incoming.protocol === 'https:'
      && incoming.hostname === 'lasrevinu333-design.github.io'
      && /^\/Engine\/(?:$|(?:index|scan)(?:\.html)?$)/.test(incoming.pathname);
    if (!customScan && !webScan) return null;
    if (!interesting.some((key) => incoming.searchParams.has(key)) && !customScan) return null;
    const target = new URL('./scan.html', location.href);
    for (const key of interesting) if (incoming.searchParams.has(key)) target.searchParams.set(key, incoming.searchParams.get(key));
    if (customScan && incoming.pathname.replace(/^\//, '')) target.searchParams.set('code', incoming.pathname.replace(/^\//, ''));
    target.searchParams.set('device', deviceId()); target.searchParams.set('source', 'native-nfc'); return target;
  } catch { return null; }
}
function handleAppUrl(url) { const target = scanTarget(url); if (target) location.assign(target.toString()); }
async function scanLocationQr() {
  els.scanQr.disabled = true;
  setStatus(els.scanStatus, 'Opening the protected location scanner…', 'info');
  try {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: 'Center the Memphis Zoo location QR code in the frame.',
      scanButton: false,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
      scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
      cancelButtonAccessibilityLabel: 'Cancel location scan',
      torchButtonOnAccessibilityLabel: 'Turn flashlight off',
      torchButtonOffAccessibilityLabel: 'Turn flashlight on',
      android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.ZXING },
    });
    const scanned = String(result?.ScanResult || '').trim();
    if (!scanned) {
      setStatus(els.scanStatus, 'Location scan cancelled.', 'info');
      return;
    }
    const target = scanTarget(scanned);
    if (!target) throw new Error('That QR code is not a Memphis Zoo location code.');
    setStatus(els.scanStatus, 'Location recognized. Opening Start Cleaning…', 'ok');
    location.assign(target.toString());
  } catch (error) {
    setStatus(els.scanStatus, `Location QR could not be opened. ${safe(error)}`, 'error');
  } finally {
    els.scanQr.disabled = false;
  }
}
async function removeEnrollment() {
  if (!confirm('Remove the employee enrollment from this phone? A new single-use code will be required.')) return;
  try {
    const remove = window.MemphisMobile?.removeEnrollment;
    if (typeof remove !== 'function') throw new Error('The protected enrollment-removal bridge is unavailable.');
    await remove(); profile = null; showEnrollment('Enrollment removed.');
  }
  catch (error) { setStatus(els.homeStatus, safe(error), 'error'); }
}
els.form.addEventListener('submit', enroll); els.scanQr.addEventListener('click', () => void scanLocationQr()); els.refresh.addEventListener('click', () => void loadAreas()); els.bootRetry.addEventListener('click', () => void restore()); els.remove.addEventListener('click', () => void removeEnrollment());
security.subscribe((status) => {
  if (status.quarantined) showEnrollment('', status);
  else if (status.initialized && status.available === false) showBoot('Protected phone state is unavailable. Offline work remains untouched.', true);
});
void Network.addListener('networkStatusChange', ({ connected }) => { if (connected && !els.home.hidden) void loadAreas(); });
void App.addListener('appUrlOpen', ({ url }) => handleAppUrl(url));
void App.addListener('resume', () => { void StatusBar.hide().catch(() => {}); void restore(); });
void (async () => {
  await StatusBar.hide().catch(() => {});
  await security.ready;
  await window.MemphisMobile?.resumePendingSecurityWorkflow?.().catch(() => {});
  const launch = await App.getLaunchUrl().catch(() => null);
  if (security.getStatus().ready && launch?.url) {
    const target = scanTarget(launch.url);
    if (target) return location.replace(target.toString());
  }
  await restore();
})();
