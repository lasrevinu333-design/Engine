import { installHomeFacts } from './home-facts-dom.js';
import { installHourlyForecastKeyboard } from './hourly-forecast-keyboard.js';
import { classifyReadiness, createReadinessObservation, readinessPresentation, readinessSupportCode } from './readiness.js';
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
let savedWorkConnectionOwner = null;
const readinessObservation = createReadinessObservation();
let readinessManagerRequired = false;
let readinessSyncStatus = 'none';
let readinessReadSequence = 0;
let readinessConnected = navigator.onLine === true;
const ownerTestReadinessSupport = typeof __MZ_CUSTODIAL_OWNER_TEST_SUPPORT__ !== 'undefined'
  && __MZ_CUSTODIAL_OWNER_TEST_SUPPORT__ === true;
function readinessPrincipal() { return window.MemphisMobile?.principalIdentity?.() || ''; }
function paintReadiness(input) {
  const result = readinessPresentation(classifyReadiness(input), input);
  for (const id of ['home-readiness', 'lock-readiness', 'boot-readiness', 'assignment-readiness']) {
    const element = document.getElementById(id);
    if (!element) continue;
    element.hidden = result.hidden;
    element.textContent = result.hidden ? '' : `${result.label} — ${result.detail}`;
    element.className = `phoneReadiness ${result.state}`;
  }
  for (const id of ['boot-support', 'assignment-support']) {
    const element = document.getElementById(id);
    if (!element) continue;
    element.hidden = result.hidden;
    element.textContent = result.hidden ? '' : `Support code: ${readinessSupportCode(input)}`;
  }
  for (const id of ['home-support', 'lock-support']) {
    const element = document.getElementById(id);
    if (!element) continue;
    const visible = ownerTestReadinessSupport && result.hidden === false;
    element.hidden = !visible;
    element.textContent = visible ? `Support code: ${readinessSupportCode(input)}` : '';
  }
}
async function refreshReadiness() {
  const sequence = ++readinessReadSequence;
  const principal = readinessPrincipal();
  const token = readinessObservation.token(principal);
  const securityGeneration = security.getStatus().generation;
  let queue = null, nativeState = null, localReadinessUnavailable = false;
  try {
    if (await window.MemphisScanSync?.ready === true && typeof window.MemphisScanSync?.listActions === 'function') queue = await window.MemphisScanSync.listActions();
    nativeState = await window.MemphisMobile?.getReadinessObservation?.(deviceId());
  } catch { localReadinessUnavailable = true; /* Read-only local verification failed; no recovery mutation. */ }
  const currentSecurity = security.getStatus(), currentPrincipal = readinessPrincipal();
  if (sequence !== readinessReadSequence || securityGeneration !== currentSecurity.generation
    || !readinessObservation.current(token, currentPrincipal)) return;
  const currentDevice = String(currentSecurity.deviceId || '').trim().toUpperCase();
  // The resolver's conservative refusal also covers an owner still being
  // verified, before any saved record can be read. Observe that as unknown;
  // only an established protected owner can inspect saved-store integrity.
  const canInspectSession = security.native === true && typeof security.mutateProtectedWork === 'function'
    && currentSecurity.ready === true && currentSecurity.available === true && currentSecurity.quarantined === false
    && Number.isSafeInteger(currentSecurity.generation) && currentSecurity.generation >= 1
    && /^KIOSK_\d{2}$/.test(currentDevice) && currentSecurity.deviceId === currentDevice
    && currentSecurity.principal?.device_id === currentDevice
    && typeof currentPrincipal === 'string' && currentPrincipal.length > 0;
  const sessionState = canInspectSession ? window.MemphisUI?.resolveOpenScanSession?.(currentDevice)?.state : undefined;
  paintReadiness({ ...(readinessObservation.read(token, principal) || {}), security: currentSecurity,
    principalPresent: Boolean(principal), connected: readinessConnected,
    profileMatches: currentProfile(profile), enrollmentPending: Boolean(pendingEnrollmentOperation()),
    managerRequired: readinessManagerRequired, syncStatus: readinessSyncStatus, queue, nativeState, localReadinessUnavailable,
    sessionState });
}
function invalidateReadiness({refresh=true}={}) {
  readinessObservation.invalidate();
  // Remove a positive label synchronously, before any asynchronous native read.
  paintReadiness({ security: security.getStatus(), managerRequired: readinessManagerRequired });
  if(refresh)void refreshReadiness();
}
const homeFactsUI=installHomeFacts({getProfile:()=>profile,getDeviceId:deviceId,isVisible:()=>!els.home.hidden,security,
  requestJson:(path,options)=>window.MemphisMobile.requestJson(path,options)});
installHourlyForecastKeyboard(document.getElementById('home-weather-hours'));
// Presentation permission is document-local, never restored from a prior tab/session.
let phoneUnlockedByTap = false;

function safe(error) { return error instanceof Error ? error.message : String(error || 'Unknown error'); }
function setStatus(element, text = '', kind = '') { element.textContent = text; element.className = `status${kind ? ` ${kind}` : ''}`; }
function deviceId() { return String(security.getStatus().deviceId || '').trim().toUpperCase(); }
function currentProfile(value) { return window.MemphisMobile?.profileMatchesPrincipal?.(value) === true; }
function phoneUnlockedSinceWake() { return phoneUnlockedByTap; }
function setPhoneUnlocked(value) { phoneUnlockedByTap = value === true; }
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
  // Every displayed lock needs a new explicit Unlock tap, including background restore.
  setPhoneUnlocked(false);
  updatePhoneLockClock();
  if (!phoneLockClockTimer) phoneLockClockTimer = window.setInterval(updatePhoneLockClock, 1000);
  els.phoneLock.hidden = false;
  return true;
}
function hidePhoneLock() { els.phoneLock.hidden = true; }
function unlockPhone() { setPhoneUnlocked(true); hidePhoneLock(); }
function relockPhone() { invalidateReadiness(); setPhoneUnlocked(false); if (profile) showPhoneLock(profile); }
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
function showSetupRepairRequired(reason = 'startup_verification', detail = 'no_additional_detail') {
  const report = window.MemphisMobile?.reportProtectedRecoveryDiagnostic;
  if (typeof report === 'function') {
    void Promise.resolve().then(() => report({ reason, outcome: 'preserved', detail })).catch(() => false);
  }
  savedWorkConnectionOwner = null;
  readinessManagerRequired = true; invalidateReadiness();
  clearRestoreRetry();
  showBoot('Phone setup needs repair', 'Custodial could not finish verifying this phone. Your saved work is retained.');
}
function showSavedWorkConnectionRequired() {
  clearRestoreRetry();
  const current = security.getStatus();
  savedWorkConnectionOwner = { deviceId: deviceId(), generation: current.generation, principal: readinessPrincipal() };
  showBoot('Connection unavailable', 'Custodial could not reach its server to verify saved work. Nothing has been cleared. Your original cleaning remains held for verification.');
}
function showNoConnection() {
  showBoot('Phone verification needed', 'Custodial has not verified this phone’s employee identity yet. Verification will retry automatically. Your saved work is retained.');
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
    showSetupRepairRequired();
    return true;
  }
  const location = String(resolved.session?.location_name || resolved.session?.location_code || '').trim();
  if (!location) {
    showSetupRepairRequired();
    return true;
  }
  if (window.MemphisUI?.isUnstartedScanSession?.(resolved.session)) {
    els.activeCleaningText.textContent = `Cleaning did not start at ${location}. Tap the location tag again.`;
  } else {
    els.activeCleaningText.textContent = `You are cleaning ${location}. Tap the same physical tag when you are done.`;
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
async function request(path, { method = 'GET', body = null, expectedGeneration = null } = {}) {
  const requestJson = window.MemphisMobile?.requestJson;
  if (typeof requestJson !== 'function') throw new Error('The phone connection is unavailable.');
  return requestJson(path, { method, body, expectedGeneration });
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
  savedWorkConnectionOwner = null;
  clearRestoreRetry();
  profile = value;
  setEmployeeIdentity(value);
  showOnly(els.home);
  if (phoneUnlockedSinceWake()) hidePhoneLock();
  else showPhoneLock(value);
  // The existing restore coordinator starts optional facts after its last pass.
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
  savedWorkConnectionOwner = null;
  readinessManagerRequired = true; invalidateReadiness();
  clearRestoreRetry();
  reportUnresolvedProtectedRecovery(status);
  showOnly(els.assignment);
  els.assignmentStatus.textContent = status?.quarantined
    ? 'Saved phone setup needs repair. Your work has not been erased.'
    : 'Custodial could not verify this phone’s saved setup. Your work has not been erased.';
}
async function prepareOfflineAuthority() {
  if (!navigator.onLine || !deviceId()) return false;
  try {
    const snapshot=await request('/scan-api/rpc',{method:'POST',body:{device_id:deviceId(),fn:'tool_get_offline_scan_authority_snapshot',args:{p_device_id:deviceId()}}});
    if (snapshot) return await window.MemphisMobile?.saveOfflineScanAuthoritySnapshot?.(snapshot) === true;
  } catch { /* Native bounded diagnostics report genuine storage failures. Existing local authority stays intact. */ }
  return false;
}
async function ensurePhoneNotifications() {
  const register = window.MemphisMobile?.ensurePushRegistration;
  if (register) await register({ requestPermission: true }).catch(() => null);
}
async function restoreNow({ quiet = false } = {}) {
  savedWorkConnectionOwner = null;
  readinessManagerRequired = false; invalidateReadiness();
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
    return showSetupRepairRequired();
  }
  if (status.quarantined) return showAssignmentNeeded('', status);
  if (status.ready !== true || status.available !== true) return showSetupRepairRequired();
  if (status.state !== 'enrolled' || !deviceId()) return showAssignmentNeeded();
  // A receiver-activated phone already has a native credential, but the
  // protected employee principal is captured by the authenticated status read.
  // Recovery needs that principal; requiring recovery first deadlocks initial
  // activation. Existing-principal offline recovery keeps its original path.
  if (!readinessPrincipal()) {
    const bootstrapDevice = deviceId(), bootstrapGeneration = status.generation;
    try {
      if (!Number.isSafeInteger(bootstrapGeneration) || bootstrapGeneration < 1) return showSetupRepairRequired();
      const authenticated = await request(`/device-auth/status?device_id=${encodeURIComponent(bootstrapDevice)}`,
        { expectedGeneration: bootstrapGeneration });
      const captured = security.getStatus();
      if (deviceId() !== bootstrapDevice || captured.state !== 'enrolled' || captured.ready !== true
        || captured.available !== true || captured.quarantined !== false
        || !readinessPrincipal() || authenticated?.authenticated !== true || !currentProfile(authenticated))
        return showSetupRepairRequired();
    } catch (error) {
      const failed = security.getStatus();
      if (deviceId() !== bootstrapDevice || failed.state !== 'enrolled' || failed.quarantined
        || failed.available !== true) return showAssignmentNeeded('', failed);
      if ([401, 403].includes(Number(error?.status || 0))) return showSetupRepairRequired();
      return showNoConnection();
    }
  }
  const cached = showCachedPhoneIdentity();
  try { await window.MemphisScanSync?.recoverLocalCompletionIntents?.(); } catch (error) {
    return error?.code === 'custodial_native_network_unavailable'
      ? showSavedWorkConnectionRequired() : showSetupRepairRequired('completed_work_recovery', error?.code);
  }
  const preStart = await reconcileProtectedStartup();
  if (preStart?.state === 'connection_required') return showSavedWorkConnectionRequired();
  if (preStart?.state === 'manager_required') return showSetupRepairRequired('startup_reconciliation');
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
    // The bridge has already fenced this authenticated response to its request
    // identity. Native status transport may refresh the store before returning,
    // so capture the current principal/generation here, not before the request.
    const authenticatedProfile = profile;
    const authenticatedPrincipal = window.MemphisMobile.principalIdentity();
    const authenticatedGeneration = current.generation;
    if (current.ready !== true || !Number.isSafeInteger(authenticatedGeneration) || authenticatedGeneration < 1
      || typeof authenticatedPrincipal !== 'string' || !authenticatedPrincipal) return;
    try { await saveProfile(); } catch { /* Identity remains authenticated; offline persistence is optional. */ }
    const restored = security.getStatus();
    if (profile !== authenticatedProfile || !currentProfile(authenticatedProfile)
      || restored.state !== 'enrolled' || restored.ready !== true || restored.available !== true || restored.quarantined !== false
      || restored.generation !== authenticatedGeneration || deviceId() !== requestedDevice
      || window.MemphisMobile.principalIdentity() !== authenticatedPrincipal) return;
    if (!homeFactsUI.authenticatedProfileRestored(authenticatedProfile,
      {principal:authenticatedPrincipal,generation:authenticatedGeneration})) return;
    const readinessToken = readinessObservation.token(readinessPrincipal());
    void prepareOfflineAuthority().then(snapshotAnchored => {
      if (readinessObservation.accept(readinessToken, readinessPrincipal(), { serverConfirmed: true, snapshotAnchored,
        startupClear: ['none', 'not_applicable', 'retired_preserved'].includes(preStart?.state) })) void refreshReadiness();
    });
    if (resumeProtectedCleaning()) return;
    showHome(profile);
    void ensurePhoneNotifications();
  } catch (error) {
    const failed = security.getStatus();
    if (deviceId() !== requestedDevice || failed.state !== 'enrolled' || failed.quarantined || failed.available !== true) {
      profile = null;
      return showAssignmentNeeded('', failed);
    }
    if (Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403) return showSetupRepairRequired();
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
    // A startup security notification can queue another authenticated restore.
    // Starting facts in each intermediate pass retires their own queued writes.
    // Only the final current Home starts its optional reads; cleaning is unchanged.
    if (!els.home.hidden && profile && currentProfile(profile)) {
      const currentHome = profile;
      await homeFactsUI.restoreProfileFacts(currentHome);
      if (!els.home.hidden && profile === currentHome && currentProfile(currentHome)) homeFactsUI.update();
    }
  })().finally(() => { restoreRunning = null; });
  return restoreRunning;
}

els.phoneUnlock.addEventListener('click', unlockPhone);
security.subscribe((status) => {
  const assignmentState = `${status.state || ''}|${status.deviceId || ''}|${status.quarantined === true}|${status.generation}|${window.MemphisMobile?.principalIdentity?.() || ''}`;
  const changed = assignmentState !== previousAssignmentState;
  previousAssignmentState = assignmentState;
  if (changed) {
    savedWorkConnectionOwner = null;
    invalidateReadiness({refresh:false});
    profile = null;
    els.name.textContent = ''; els.role.textContent = ''; els.phoneLockName.textContent = '';
    els.activeCleaning.hidden = true;
    showBoot();
  }
  if (status.quarantined) showAssignmentNeeded('', status);
  else if (status.initialized && status.available === false) showSetupRepairRequired();
  else if (changed && status.initialized && status.state !== 'enrolled') {
    profile = null;
    showAssignmentNeeded('', status);
  }
  else if (changed && status.state === 'enrolled' && status.ready === true && status.available === true) {
    // Let the original material ready event reach its remaining consumers
    // before starting another private status-check generation. A successor
    // publication retires this queued verification before it can begin.
    queueMicrotask(()=>{
      if(previousAssignmentState!==assignmentState)return;
      void restore({quiet:!els.home.hidden});
    });
  }
});
void Network.addListener('networkStatusChange', ({ connected }) => {
  readinessConnected = connected === true; invalidateReadiness();
  if (connected) void restore({ quiet: !els.home.hidden });
});
void App.addListener('pause', () => { relockPhone(); });
void App.addListener('resume', () => {
  invalidateReadiness();
  relockPhone();
  void StatusBar.hide().catch(() => {});
  void restore({ quiet: !els.home.hidden });
});
window.addEventListener?.('memphis-scan-sync', event => {
  readinessSyncStatus = event.detail?.status;
  if (event.detail?.status === 'startup-recovery-complete' && savedWorkConnectionOwner && !readinessManagerRequired) {
    const owner = savedWorkConnectionOwner, current = security.getStatus();
    // Only the held original owner may request re-entry. restore() coalesces
    // the request and repeats every identity and saved-work admission check.
    savedWorkConnectionOwner = null;
    if (owner.deviceId === deviceId() && owner.generation === current.generation
      && owner.principal === readinessPrincipal() && current.state === 'enrolled'
      && current.ready === true && current.available === true && current.quarantined === false) void restore();
  }
  if (['quarantined', 'recovery-paused', 'compatibility-paused', 'dead-letter'].includes(event.detail?.status)) {
    readinessManagerRequired = true; invalidateReadiness();
  } else if (['connection-paused', 'worker-error', 'retrying', 'queued', 'peer-update'].includes(event.detail?.status)) {
    invalidateReadiness();
  } else {
    // Remove the last positive label immediately while the authoritative queue
    // is reread; this never drains, hides, or clears saved work.
    paintReadiness({ security: security.getStatus(), managerRequired: readinessManagerRequired });
    void refreshReadiness();
  }
});
void (async () => {
  await StatusBar.hide().catch(() => {});
  await security.ready;
  await window.MemphisMobile?.whenReady?.();
  await window.MemphisMobile?.resumePendingSecurityWorkflow?.().catch(() => {});
  await restore();
})();
