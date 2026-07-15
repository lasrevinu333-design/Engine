(() => {
  "use strict";

  const SCREEN_OFF_MARKER = "mz_employee_kiosk_screen_off_v2";
  const DEVICE_STORAGE_KEY = "mz_scan_device_id";
  const HUB_PAGE = "employee-hub.html";
  let navigationInProgress = false;
  let redirecting = false;

  function normalize(value) {
    return String(value || "").trim();
  }

  function resolvedDeviceId() {
    try {
      const shared = window.MemphisDeviceIdentity?.resolve?.({ url: new URL(window.location.href) });
      if (shared?.deviceId) return normalize(shared.deviceId).toUpperCase();
    } catch (_error) {
      // Fall through to explicit and stored identity.
    }
    try {
      const url = new URL(window.location.href);
      const explicit = normalize(url.searchParams.get("device") || url.searchParams.get("device_id"));
      if (explicit) return explicit.toUpperCase();
    } catch (_error) {
      // Ignore malformed location state.
    }
    try {
      return normalize(localStorage.getItem(DEVICE_STORAGE_KEY)).toUpperCase();
    } catch (_error) {
      return "";
    }
  }

  function isEmployeeKiosk(deviceId = resolvedDeviceId()) {
    return /^KIOSK_(0[2-9]|10)$/.test(normalize(deviceId).toUpperCase());
  }

  function isEmployeeHub() {
    return /(?:^|\/)employee-hub\.html$/i.test(window.location.pathname);
  }

  function markScreenOff(reason) {
    if (!isEmployeeKiosk()) return;
    try {
      localStorage.setItem(SCREEN_OFF_MARKER, JSON.stringify({
        device_id: resolvedDeviceId(),
        reason: normalize(reason) || "screen_off",
        recorded_at: new Date().toISOString(),
      }));
    } catch (_error) {
      // A blocked storage write must not prevent the lock redirect.
    }
  }

  function hasScreenOffMarker() {
    try {
      return Boolean(localStorage.getItem(SCREEN_OFF_MARKER));
    } catch (_error) {
      return false;
    }
  }

  function lockedHubUrl(reason = "screen_wake") {
    const url = new URL(`./${HUB_PAGE}`, window.location.href);
    const device = resolvedDeviceId();
    if (device) url.searchParams.set("device", device);
    url.searchParams.set("lock", "1");
    url.searchParams.set("screen_event", normalize(reason) || "screen_wake");
    return url.toString();
  }

  function returnToLockedHub(reason) {
    if (redirecting || !isEmployeeKiosk() || isEmployeeHub()) return;
    redirecting = true;
    markScreenOff(reason);
    window.location.replace(lockedHubUrl(reason));
  }

  function noteNavigation(event) {
    const anchor = event?.target?.closest?.("a[href]");
    if (!anchor) return;
    const href = normalize(anchor.getAttribute("href"));
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) return;
    navigationInProgress = true;
  }

  function handleScreenOff() {
    navigationInProgress = false;
    markScreenOff("fully_screen_off");
    returnToLockedHub("fully_screen_off");
  }

  function handleScreenOn() {
    if (hasScreenOffMarker()) returnToLockedHub("fully_screen_on");
  }

  window.MemphisKioskLifecycle = Object.freeze({
    handleScreenOff,
    handleScreenOn,
    markScreenOff,
    returnToLockedHub,
    clearScreenOffMarker() {
      try { localStorage.removeItem(SCREEN_OFF_MARKER); } catch (_error) {}
    },
    screenOffMarkerKey: SCREEN_OFF_MARKER,
  });

  document.addEventListener("click", noteNavigation, true);
  document.addEventListener("submit", () => { navigationInProgress = true; }, true);

  document.addEventListener("visibilitychange", () => {
    if (!isEmployeeKiosk()) return;
    if (document.visibilityState === "hidden") {
      if (!navigationInProgress) markScreenOff("visibility_hidden");
      return;
    }
    if (document.visibilityState === "visible" && hasScreenOffMarker() && !navigationInProgress) {
      returnToLockedHub("visibility_visible");
    }
  });

  window.addEventListener("pagehide", () => {
    if (!navigationInProgress) markScreenOff("pagehide");
  }, { capture: true });

  window.addEventListener("pageshow", () => {
    if (hasScreenOffMarker() && !navigationInProgress) returnToLockedHub("pageshow");
  });

  function bindFullyEvent(name, callbackName, fallback) {
    if (!window.fully || typeof window.fully.bind !== "function") return;
    try {
      window.fully.bind(name, `window.MemphisKioskLifecycle.${callbackName}()`);
      return;
    } catch (_error) {
      // Older Fully versions accept a function callback instead of a script string.
    }
    try { window.fully.bind(name, fallback); } catch (_error) {}
  }

  bindFullyEvent("screenOff", "handleScreenOff", handleScreenOff);
  bindFullyEvent("screenOn", "handleScreenOn", handleScreenOn);

  if (hasScreenOffMarker() && document.visibilityState !== "hidden") {
    returnToLockedHub("startup_after_screen_off");
  }
})();
