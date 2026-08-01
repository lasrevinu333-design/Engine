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

  function safeDeviceId() {
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
    if (protectedSecurity?.native === true) {
      const status = protectedSecurity.getStatus?.();
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

  function scanSessionRows() {
    const rows = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith("session:")) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key));
          if (value && typeof value === "object") rows.push(value);
        } catch {}
      }
    } catch {}
    return rows;
  }

  function openScanSession(deviceId = phoneDeviceId()) {
    const normalizedDevice = normalizePhoneDeviceId(deviceId);
    return scanSessionRows()
      .filter((row) => OPEN_SCAN_STATUSES.has(String(row?.status || "").trim().toLowerCase()))
      .filter((row) => !normalizedDevice || normalizePhoneDeviceId(row?.device_id) === normalizedDevice)
      .sort((a, b) => new Date(b?.updated_at || b?.ended_at || b?.started_at || 0) - new Date(a?.updated_at || a?.ended_at || a?.started_at || 0))[0] || null;
  }

  function scanResumeKey(deviceId = phoneDeviceId()) {
    return `${PHONE_SCAN_RESUME_PREFIX}${normalizePhoneDeviceId(deviceId)}`;
  }

  function rememberScanView(session, view = "timer", context = {}) {
    const sessionUuid = String(session?.session_uuid || session?.client_session_id || context?.sessionUuid || "").trim();
    const deviceId = normalizePhoneDeviceId(session?.device_id || context?.deviceId || phoneDeviceId());
    if (!sessionUuid || !deviceId) return false;
    const record = {
      session_uuid: sessionUuid,
      client_session_id: String(session?.client_session_id || sessionUuid),
      device_id: deviceId,
      location_code: String(session?.location_code || context?.locationCode || "").trim(),
      view: ["timer", "complete", "completion-form"].includes(view) ? view : "timer",
      saved_at: new Date().toISOString(),
    };
    const write = () => localStorage.setItem(scanResumeKey(deviceId), JSON.stringify(record));
    if (window.MemphisCustodialSecurity?.native === true) {
      void window.MemphisCustodialSecurity.mutateProtectedWork(write).catch(() => {});
      return true;
    }
    try { write(); return true; } catch { return false; }
  }

  function scanResumeView(session, deviceId = phoneDeviceId()) {
    try {
      const record = JSON.parse(localStorage.getItem(scanResumeKey(deviceId)) || "null");
      const sessionUuid = String(session?.session_uuid || session?.client_session_id || "").trim();
      if (record?.session_uuid === sessionUuid && ["timer", "complete", "completion-form"].includes(record?.view)) return record.view;
    } catch {}
    return String(session?.status || "").toLowerCase().includes("pending") ? "complete" : "timer";
  }

  function clearScanView(sessionUuid = "", deviceId = phoneDeviceId()) {
    const key = scanResumeKey(deviceId);
    const remove = () => {
      const record = JSON.parse(localStorage.getItem(key) || "null");
      if (!sessionUuid || record?.session_uuid === String(sessionUuid)) localStorage.removeItem(key);
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
    const target = new URL(context === "employee" ? EMPLOYEE_HUB : OPS_HUB, window.location.href);
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
      const target = control instanceof HTMLAnchorElement && control.href
        ? control.href
        : canonicalBackTarget().toString();
      window.location.assign(target);
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
    phoneDeviceId,
    phoneUnlockedSinceWake,
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
