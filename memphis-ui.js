(function () {
  "use strict";

  const OPS_HUB = "./start_page1.html";
  const EMPLOYEE_HUB = "./employee-hub.html";
  const SAFE_CONTEXTS = new Set(["manager", "employee", "contextual"]);
  const PHONE_SCREEN_OFF_KEY = "mz_phone_screen_off_at";
  const PHONE_NAVIGATION_KEY = "mz_phone_wake_navigation";
  const PHONE_UNLOCKED_KEY = "mz_phone_unlocked_since_wake";
  const PHONE_SCAN_RESUME_PREFIX = "mz_phone_scan_resume:";
  const OPEN_SCAN_STATUSES = new Set(["active", "server-active", "offline-provisional", "pending_submit", "pending_sync"]);
  const SCAN_RESUME_SCHEMA_VERSION = 2;
  const MAX_INDEXED_SCAN_SESSIONS = 4;
  let phoneWakeNavigationAt = 0;
  let phoneWakeEventsBound = false;

  function enforceTopLevelNavigation() {
    if (window.top === window.self) return;
    try {
      window.top.location.replace(window.location.href);
    } catch {
      document.documentElement.hidden = true;
    }
  }

  enforceTopLevelNavigation();

  function explicitContext() {
    const value = String(document.body?.dataset?.memphisContext || "").trim().toLowerCase();
    return SAFE_CONTEXTS.has(value) ? value : "";
  }

  function resolvedContext() {
    const configured = explicitContext();
    if (configured !== "contextual") return configured || "manager";
    const requested = String(new URL(window.location.href).searchParams.get("hub") || "").trim().toLowerCase();
    return requested === "employee" ? "employee" : "manager";
  }

  function isNativeCustodialAuthority() {
    return window.MemphisCustodialSecurity?.native === true
      || window.MemphisMobile?.edition === "custodial"
      || window.MemphisMobileBuildIdentity?.edition === "custodial";
  }

  async function waitForDeviceAuthority() {
    if (!isNativeCustodialAuthority()) return null;
    const pending = window.MemphisMobile?.ready || window.MemphisCustodialSecurity?.ready;
    if (pending && typeof pending.then === "function") await pending;
    return window.MemphisCustodialSecurity?.getStatus?.() || null;
  }

  function safeDeviceId() {
    if (isNativeCustodialAuthority()) return phoneDeviceId();
    const url = new URL(window.location.href);
    const raw = String(url.searchParams.get("device") || url.searchParams.get("deviceId") || "").trim();
    return /^[A-Za-z0-9_.:-]{1,96}$/.test(raw) ? raw : "";
  }

  function normalizePhoneDeviceId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^kiosk[-_]?\d{1,2}$/i.test(raw)) {
      const digits = (raw.match(/\d+/) || [""])[0].padStart(2, "0");
      return `KIOSK_${digits}`;
    }
    return raw.toUpperCase();
  }

  function isFullyKioskRuntime() {
    try { if (window.fully) return true; } catch {}
    return /FullyKiosk/i.test(String(navigator.userAgent || ""));
  }

  function phoneDeviceId() {
    const protectedSecurity = window.MemphisCustodialSecurity;
    if (isNativeCustodialAuthority()) {
      const status = protectedSecurity?.getStatus?.();
      return status?.ready === true && status?.available === true
        ? normalizePhoneDeviceId(status.deviceId)
        : "";
    }
    const url = new URL(window.location.href);
    const candidates = [
      url.searchParams.get("device"),
      url.searchParams.get("deviceId"),
      localStorage.getItem("mz_scan_device_id"),
      localStorage.getItem("mz_employee_hub_device_id"),
      localStorage.getItem("memphisAssignedDeviceId"),
    ];
    try {
      const shared = window.MemphisDeviceIdentity?.resolve?.({ url });
      if (shared?.deviceId) candidates.unshift(shared.deviceId);
    } catch {}
    return candidates.map(normalizePhoneDeviceId).find(Boolean) || "";
  }

  function isManagedKioskPhone(deviceId = phoneDeviceId()) {
    return isFullyKioskRuntime() && /^KIOSK_(?:0[1-9]|10)$/.test(normalizePhoneDeviceId(deviceId));
  }

  function scanResumeKey(deviceId = phoneDeviceId()) {
    return `${PHONE_SCAN_RESUME_PREFIX}${normalizePhoneDeviceId(deviceId)}`;
  }

  function scanSessionId(value) {
    const id = String(value?.session_uuid || value?.client_session_id || "").trim().toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ? id : "";
  }

  function scanIndexEntry(session, view = "timer", context = {}) {
    const sessionUuid = scanSessionId(session) || scanSessionId({ session_uuid: context?.sessionUuid });
    const deviceId = normalizePhoneDeviceId(session?.device_id || context?.deviceId || phoneDeviceId());
    const locationCode = String(session?.location_code || context?.locationCode || "").trim().toUpperCase();
    const locationName = String(session?.location_name || context?.locationName || locationCode).trim();
    const status = String(session?.status || context?.status || "active").trim().toLowerCase();
    if (!sessionUuid || !deviceId || !/^[A-Z0-9._:-]{1,100}$/.test(locationCode) || !OPEN_SCAN_STATUSES.has(status)) return null;
    return {
      session_uuid: sessionUuid,
      client_session_id: String(session?.client_session_id || sessionUuid).trim().toLowerCase(),
      device_id: deviceId,
      location_code: locationCode,
      location_name: locationName || locationCode,
      status,
      view: ["timer", "complete", "completion-form"].includes(view) ? view : "timer",
      updated_at: String(session?.updated_at || new Date().toISOString()),
    };
  }

  function readScanIndex(deviceId = phoneDeviceId()) {
    const normalizedDevice = normalizePhoneDeviceId(deviceId);
    if (!normalizedDevice) return { state: "none", sessions: [] };
    let parsed;
    try {
      const raw = localStorage.getItem(scanResumeKey(normalizedDevice));
      if (!raw) return { state: "none", sessions: [] };
      parsed = JSON.parse(raw);
    } catch {
      return { state: "corrupted", sessions: [] };
    }
    const candidates = parsed?.schema_version === SCAN_RESUME_SCHEMA_VERSION && Array.isArray(parsed?.sessions)
      ? parsed.sessions
      : parsed?.session_uuid ? [parsed] : null;
    if (!candidates || candidates.length > MAX_INDEXED_SCAN_SESSIONS) return { state: "corrupted", sessions: [] };
    const sessions = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const entry = scanIndexEntry(candidate, candidate?.view, candidate);
      if (!entry || entry.device_id !== normalizedDevice || seen.has(entry.session_uuid)) return { state: "corrupted", sessions: [] };
      seen.add(entry.session_uuid);
      sessions.push(entry);
    }
    return { state: sessions.length ? "indexed" : "none", sessions };
  }

  function writeScanIndex(deviceId, sessions) {
    const normalizedDevice = normalizePhoneDeviceId(deviceId);
    if (!normalizedDevice || !Array.isArray(sessions) || sessions.length > MAX_INDEXED_SCAN_SESSIONS) return false;
    localStorage.setItem(scanResumeKey(normalizedDevice), JSON.stringify({
      schema_version: SCAN_RESUME_SCHEMA_VERSION,
      device_id: normalizedDevice,
      sessions,
      updated_at: new Date().toISOString(),
    }));
    return true;
  }

  function recoverUnindexedScanSessions(deviceId) {
    const normalizedDevice = normalizePhoneDeviceId(deviceId);
    if (!normalizedDevice) return { state: "none", sessions: [] };
    const sessions = [];
    const seen = new Set();
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith("session:")) continue;
        let candidate;
        try {
          candidate = JSON.parse(localStorage.getItem(key) || "null");
        } catch {
          return { state: "corrupted", sessions: [] };
        }
        const status = String(candidate?.status || "").trim().toLowerCase();
        if (!OPEN_SCAN_STATUSES.has(status)) continue;
        const entry = scanIndexEntry(
          candidate,
          status.includes("pending") ? "complete" : "timer",
          candidate,
        );
        if (!entry) return { state: "corrupted", sessions: [] };
        if (entry.device_id !== normalizedDevice) continue;
        if (seen.has(entry.session_uuid)) return { state: "corrupted", sessions: [] };
        seen.add(entry.session_uuid);
        sessions.push(entry);
      }
    } catch {
      return { state: "corrupted", sessions: [] };
    }
    if (sessions.length === 0) return { state: "none", sessions: [] };
    if (sessions.length !== 1) return { state: "ambiguous", sessions: [] };
    if (!writeScanIndex(normalizedDevice, sessions)) return { state: "corrupted", sessions: [] };
    return { state: "indexed", sessions };
  }

  function indexScanSession(session, view = "timer", context = {}) {
    const entry = scanIndexEntry(session, view, context);
    if (!entry) return false;
    const current = readScanIndex(entry.device_id);
    if (current.state === "corrupted") return false;
    const sessions = current.sessions.filter((candidate) => candidate.session_uuid !== entry.session_uuid);
    sessions.push(entry);
    return writeScanIndex(entry.device_id, sessions);
  }

  function resolveOpenScanSession(deviceId = phoneDeviceId()) {
    const normalizedDevice = normalizePhoneDeviceId(deviceId);
    let index = readScanIndex(normalizedDevice);
    if (index.state === "none") index = recoverUnindexedScanSessions(normalizedDevice);
    if (index.state === "corrupted") return { state: "corrupted", session: null };
    if (index.state === "ambiguous") return { state: "ambiguous", session: null };
    if (index.sessions.length === 0) return { state: "none", session: null };
    if (index.sessions.length !== 1) return { state: "ambiguous", session: null };
    const entry = index.sessions[0];
    let session;
    try {
      session = JSON.parse(localStorage.getItem(`session:${entry.session_uuid}`) || "null");
    } catch {
      return { state: "corrupted", session: null };
    }
    const verified = scanIndexEntry(session, entry.view, entry);
    if (!verified
      || verified.session_uuid !== entry.session_uuid
      || verified.device_id !== normalizedDevice
      || verified.location_code !== entry.location_code) return { state: "corrupted", session: null };
    return { state: "open", session: { ...session, ...verified, view: entry.view } };
  }

  function openScanSession(deviceId = phoneDeviceId()) {
    const resolved = resolveOpenScanSession(deviceId);
    return resolved.state === "open" ? resolved.session : null;
  }

  function rememberScanView(session, view = "timer", context = {}) {
    const record = scanIndexEntry(session, view, context);
    if (!record) return false;
    const write = () => indexScanSession(record, record.view, record);
    if (window.MemphisCustodialSecurity?.native === true) {
      void window.MemphisCustodialSecurity.mutateProtectedWork(write).catch(() => {});
      return true;
    }
    try { write(); return true; } catch { return false; }
  }

  function scanResumeView(session, deviceId = phoneDeviceId()) {
    const resolved = resolveOpenScanSession(deviceId);
    const sessionUuid = scanSessionId(session);
    if (resolved.state === "open" && resolved.session?.session_uuid === sessionUuid) return resolved.session.view;
    return String(session?.status || "").toLowerCase().includes("pending") ? "complete" : "timer";
  }

  function clearScanView(sessionUuid = "", deviceId = phoneDeviceId()) {
    const key = scanResumeKey(deviceId);
    const remove = () => {
      if (!sessionUuid) return localStorage.removeItem(key);
      const current = readScanIndex(deviceId);
      if (current.state === "corrupted") return;
      const normalizedSession = String(sessionUuid).trim().toLowerCase();
      const remaining = current.sessions.filter((record) => record.session_uuid !== normalizedSession);
      if (remaining.length) writeScanIndex(deviceId, remaining);
      else localStorage.removeItem(key);
    };
    if (window.MemphisCustodialSecurity?.native === true) {
      void window.MemphisCustodialSecurity.mutateProtectedWork(remove).catch(() => {});
      return;
    }
    try { remove(); } catch { try { localStorage.removeItem(key); } catch {} }
  }

  function buildPhoneWakeTarget() {
    const deviceId = phoneDeviceId();
    if (!isManagedKioskPhone(deviceId)) return null;
    const session = openScanSession(deviceId);
    if (session) {
      const target = new URL("./index.html", window.location.href);
      const sessionUuid = String(session.session_uuid || session.client_session_id || "").trim();
      const locationCode = String(session.location_code || "").trim();
      if (locationCode) target.searchParams.set("code", locationCode);
      target.searchParams.set("device", deviceId);
      target.searchParams.set("session_uuid", sessionUuid);
      target.searchParams.set("action", "resume");
      target.searchParams.set("wake", String(Date.now()));
      return target;
    }
    const target = new URL(deviceId === "KIOSK_01" ? OPS_HUB : EMPLOYEE_HUB, window.location.href);
    target.searchParams.set("device", deviceId);
    target.searchParams.set("lock", "1");
    target.searchParams.set("wake", String(Date.now()));
    return target;
  }

  function markPhoneUnlocked() {
    if (!isManagedKioskPhone()) return false;
    try { sessionStorage.setItem(PHONE_UNLOCKED_KEY, "1"); } catch {}
    return true;
  }

  function phoneUnlockedSinceWake() {
    if (!isManagedKioskPhone()) return false;
    try { return sessionStorage.getItem(PHONE_UNLOCKED_KEY) === "1"; } catch { return false; }
  }

  function markPhoneScreenOff() {
    if (!isManagedKioskPhone()) return false;
    try {
      sessionStorage.removeItem(PHONE_UNLOCKED_KEY);
      sessionStorage.setItem(PHONE_SCREEN_OFF_KEY, String(Date.now()));
    } catch {}
    return true;
  }

  function handlePhoneWake(options = {}) {
    if (!isManagedKioskPhone()) return false;
    try {
      if (!options.force && sessionStorage.getItem(PHONE_NAVIGATION_KEY) === "1") {
        sessionStorage.removeItem(PHONE_NAVIGATION_KEY);
        sessionStorage.removeItem(PHONE_SCREEN_OFF_KEY);
        return false;
      }
    } catch {}
    let screenWasOff = false;
    try { screenWasOff = Boolean(sessionStorage.getItem(PHONE_SCREEN_OFF_KEY)); } catch {}
    if (!options.force && !screenWasOff) return false;
    const now = Date.now();
    if (now - phoneWakeNavigationAt < 1200) return true;
    phoneWakeNavigationAt = now;
    try { sessionStorage.removeItem(PHONE_SCREEN_OFF_KEY); } catch {}
    const target = buildPhoneWakeTarget();
    if (target) {
      try { sessionStorage.setItem(PHONE_NAVIGATION_KEY, "1"); } catch {}
      window.location.replace(target.toString());
    }
    return true;
  }

  function handlePhoneVisibilityChange() {
    if (!isManagedKioskPhone()) return false;
    if (document.visibilityState === "visible") return handlePhoneWake();
    return false;
  }

  function bindPhoneWakeEvents() {
    if (!isManagedKioskPhone()) return false;
    if (!phoneWakeEventsBound) {
      phoneWakeEventsBound = true;
      window.addEventListener("pageshow", () => { handlePhoneWake(); });
    }
    try {
      if (window.fully && typeof window.fully.bind === "function") {
        window.fully.bind("screenOff", "window.MemphisUI.markPhoneScreenOff();");
        window.fully.bind("screenOn", "window.MemphisUI.handlePhoneWake({force:true});");
      }
    } catch {}
    return true;
  }

  function canonicalBackTarget(context = resolvedContext()) {
    const nativeCustodialHome = context === "employee" && isNativeCustodialAuthority();
    const target = new URL(
      nativeCustodialHome ? "./index.html" : (context === "employee" ? EMPLOYEE_HUB : OPS_HUB),
      window.location.href,
    );
    if (nativeCustodialHome) return target;
    const device = safeDeviceId();
    if (device && context === "employee") target.searchParams.set("device", device);
    if (context === "employee") {
      target.searchParams.set("hub", "employee");
      if (phoneUnlockedSinceWake()) target.searchParams.set("lock", "0");
    }
    return target;
  }

  function canonicalBackLabel(context = resolvedContext()) {
    return "Back";
  }

  function dirtyForms() {
    return Array.from(document.querySelectorAll("form[data-mz-protect-unsaved='true']"));
  }

  function isDirty() {
    return dirtyForms().some((form) => form.dataset.mzDirty === "true");
  }

  function markSaved(form) {
    if (form instanceof HTMLFormElement) form.dataset.mzDirty = "false";
  }

  function bindDirtyProtection() {
    dirtyForms().forEach((form) => {
      form.dataset.mzDirty = "false";
      form.addEventListener("input", () => { form.dataset.mzDirty = "true"; });
      form.addEventListener("change", () => { form.dataset.mzDirty = "true"; });
      form.addEventListener("reset", () => { form.dataset.mzDirty = "false"; });
      form.addEventListener("submit", () => {
        if (form.dataset.mzSaveOnSubmit === "true") form.dataset.mzDirty = "false";
      });
    });

    document.addEventListener("click", (event) => {
      const control = event.target.closest("[data-mz-back]");
      if (!control) return;
      if (isDirty() && !window.confirm("You have unsaved changes. Leave this page and discard them?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      void waitForDeviceAuthority().then(() => {
        window.location.assign(canonicalBackTarget().toString());
      });
    }, true);

    window.addEventListener("beforeunload", (event) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function configureBackControls() {
    const context = resolvedContext();
    const target = canonicalBackTarget(context);
    const label = canonicalBackLabel(context);
    const controls = Array.from(document.querySelectorAll("[data-mz-back]"));

    controls.forEach((control) => {
      control.classList.add("mz-back-link");
      control.setAttribute("aria-label", label);
      if (!control.dataset.mzBackLabelPreserved) control.textContent = label;
      if (control instanceof HTMLAnchorElement) {
        control.href = target.toString();
      } else {
        control.type = "button";
        control.addEventListener("click", () => { window.location.assign(target.toString()); });
      }
    });

    if (isNativeCustodialAuthority()) {
      void waitForDeviceAuthority().then(() => {
        const readyTarget = canonicalBackTarget(context).toString();
        controls.forEach((control) => {
          if (control instanceof HTMLAnchorElement) control.href = readyTarget;
        });
        bindPhoneWakeEvents();
      });
    }

    if (controls.length > 1) {
      console.error("Memphis UI configuration error: more than one canonical Hub control is present.");
    }

    const current = new URL(window.location.href);
    let fromAnnie = String(current.searchParams.get("origin") || "").trim().toLowerCase() === "annie";
    try {
      fromAnnie = fromAnnie || sessionStorage.getItem("mz_annie_origin_session") === "1";
    } catch {}
    document.querySelectorAll("[data-mz-annie-back]").forEach((control) => {
      control.hidden = !fromAnnie;
      if (fromAnnie && control instanceof HTMLAnchorElement) {
        control.href = "https://memphis-zoo-mcp.onrender.com/moxie/";
      }
    });
  }

  function announce(message, options = {}) {
    const region = options.region instanceof Element
      ? options.region
      : document.querySelector(options.selector || "[data-mz-status]");
    if (!region) return;
    region.textContent = String(message || "");
    region.setAttribute("role", options.error ? "alert" : "status");
    region.setAttribute("aria-live", options.error ? "assertive" : "polite");
  }

  function setBusy(control, busy, label = "") {
    if (!(control instanceof Element)) return;
    if (busy) {
      control.setAttribute("aria-busy", "true");
      control.setAttribute("aria-disabled", "true");
      if ("disabled" in control) control.disabled = true;
      if (label) {
        control.dataset.mzReadyLabel = control.textContent;
        control.textContent = label;
      }
      return;
    }
    control.removeAttribute("aria-busy");
    control.removeAttribute("aria-disabled");
    if ("disabled" in control) control.disabled = false;
    if (control.dataset.mzReadyLabel) {
      control.textContent = control.dataset.mzReadyLabel;
      delete control.dataset.mzReadyLabel;
    }
  }

  function authReady() {
    document.documentElement.classList.remove("mz-auth-pending");
    document.documentElement.classList.add("mz-auth-ready");
  }

  function init() {
    document.documentElement.classList.add("mz-ui-ready");
    configureBackControls();
    bindDirtyProtection();
    bindPhoneWakeEvents();
  }

  window.MemphisUI = {
    announce,
    authReady,
    bindPhoneWakeEvents,
    buildPhoneWakeTarget,
    canonicalBackLabel,
    canonicalBackTarget,
    clearScanView,
    handlePhoneVisibilityChange,
    handlePhoneWake,
    isManagedKioskPhone,
    markSaved,
    markPhoneUnlocked,
    markPhoneScreenOff,
    openScanSession,
    indexScanSession,
    phoneDeviceId,
    phoneUnlockedSinceWake,
    readyForDeviceAuthority: waitForDeviceAuthority,
    resolveOpenScanSession,
    rememberScanView,
    resolvedContext,
    scanResumeView,
    setBusy,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
