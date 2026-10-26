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
  let nativeCustodialObserved = false;

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
    // A bootstrap observation can require a writer, never grant one. Missing
    // or unreadable successors cannot thaw this page to raw web mutation.
    if (nativeCustodialObserved) return true;
    try {
      if (window.MemphisCustodialSecurity?.native === true
        || window.MemphisMobile?.edition === "custodial"
        || window.MemphisMobileBuildIdentity?.edition === "custodial"
        || window.Capacitor?.isNativePlatform?.() === true
        || ["android", "ios"].includes(window.Capacitor?.getPlatform?.())) nativeCustodialObserved = true;
    } catch { nativeCustodialObserved = true; }
    return nativeCustodialObserved;
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

  function isUnstartedScanSession(session) {
    return String(session?.status || "").trim().toLowerCase() === "offline-provisional"
      && session?.server_acknowledged !== true
      && String(session?.sync_status || "").trim() === "activation_queued"
      && String(session?.entry_attestation || "").trim() === "native-entry-pending.v1"
      && String(session?.started_at || "").trim() === ""
      && !String(session?.native_start_attestation || "").trim();
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

  function scanWriterUnavailable() {
    return Object.assign(new Error("The original protected scan view is unavailable."), { code: "custodial_security_state_unavailable" });
  }

  function scanWriterOwner(deviceId) {
    if (!isNativeCustodialAuthority()) return null;
    const security = window.MemphisCustodialSecurity, mobile = window.MemphisMobile;
    if (security?.native !== true || typeof security.mutateProtectedWork !== "function"
      || typeof security.getStatus !== "function" || typeof mobile?.principalIdentity !== "function") throw scanWriterUnavailable();
    const status = security.getStatus(), identity = mobile.principalIdentity();
    if (status?.ready !== true || status.available !== true || status.quarantined !== false
      || !Number.isSafeInteger(status.generation) || status.generation < 1
      || !/^KIOSK_\d{2}$/.test(deviceId) || status.deviceId !== deviceId || status.principal?.device_id !== deviceId
      || typeof identity !== "string" || !identity) throw scanWriterUnavailable();
    return Object.freeze({ security, mobile, writer: security.mutateProtectedWork, reader: security.getStatus,
      principalReader: mobile.principalIdentity, identity, generation: status.generation, deviceId });
  }

  function requireScanWriterOwner(original, context) {
    if (!original) {
      if (isNativeCustodialAuthority()) throw scanWriterUnavailable();
      return;
    }
    const current = scanWriterOwner(original.deviceId);
    if (!current || Object.keys(original).some(key => original[key] !== current[key])) throw scanWriterUnavailable();
    if (context !== undefined) {
      if (typeof context?.assertCurrent !== "function" || context.generation !== original.generation || context.deviceId !== original.deviceId) throw scanWriterUnavailable();
      context.assertCurrent();
    }
  }

  // Only scan-index metadata is written here. Capture the original owner and
  // participating raw rows BEFORE enqueueing; never reread/adopt a successor
  // as the intended write. No callback context is inferred from a sync caller.
  function mutateScanIndex(deviceId, sessionIds, change, expectedRaw = undefined, asynchronous = false, confirmation = null) {
    try {
      const device = normalizePhoneDeviceId(deviceId);
      if (!device) return false;
      const owner = scanWriterOwner(device), key = scanResumeKey(device), raw = localStorage.getItem(key);
      // The legacy checkpoint cannot acquire admission. Synchronous callers
      // must already be inside this exact queue's private mutation callback.
      const queue = owner ? null : window.MemphisScanSync;
      const legacy = owner ? null : Object.freeze({ queue, writer: queue?.mutateProtectedWork,
        checkpoint: queue?.requireLegacyBrowserMutation, storage: window.localStorage });
      const requireLegacy = (context, active = true) => {
        if (!legacy) return;
        if (isNativeCustodialAuthority() || window.MemphisScanSync !== legacy.queue
          || typeof legacy.writer !== "function" || typeof legacy.checkpoint !== "function"
          || legacy.queue.mutateProtectedWork !== legacy.writer
          || legacy.queue.requireLegacyBrowserMutation !== legacy.checkpoint
          || window.localStorage !== legacy.storage || phoneDeviceId() !== device) throw scanWriterUnavailable();
        if (active) {
          legacy.checkpoint.call(legacy.queue);
          if (context !== undefined) {
            if (typeof context?.assertCurrent !== "function") throw scanWriterUnavailable();
            context.assertCurrent();
          }
        }
        if (isNativeCustodialAuthority() || window.MemphisScanSync !== legacy.queue
          || legacy.queue.mutateProtectedWork !== legacy.writer
          || legacy.queue.requireLegacyBrowserMutation !== legacy.checkpoint) throw scanWriterUnavailable();
      };
      requireLegacy(undefined, false);
      // Sync native callers may already hold the protected FIFO. Never enter
      // another admission on their behalf or call a caller-supplied checkpoint.
      if (owner && !asynchronous) return false;
      if (owner && confirmation && (confirmation.deviceId !== owner.deviceId || confirmation.generation !== owner.generation
        || confirmation.principalIdentity !== owner.identity
        || localStorage.getItem(`session:${confirmation.sessionId}`) !== confirmation.sessionRaw)) return false;
      if (expectedRaw !== undefined && raw !== expectedRaw) return false;
      if (raw !== null && (typeof raw !== "string" || !raw)) return false;
      const current = readScanIndex(device);
      if (current.state === "corrupted" || localStorage.getItem(key) !== raw) return false;
      const sessions = Object.freeze(current.sessions.map(entry => Object.freeze({ ...entry })));
      const originals = new Map([[key, raw]]);
      if (legacy) for (const deviceKey of ["mz_scan_device_id", "mz_employee_hub_device_id", "memphisAssignedDeviceId"])
        originals.set(deviceKey, localStorage.getItem(deviceKey));
      for (const id of new Set([...sessions.map(entry => entry.session_uuid), ...sessionIds])) {
        if (!scanSessionId({ session_uuid: id })) return false;
        const sessionKey = `session:${id}`;originals.set(sessionKey, localStorage.getItem(sessionKey));
      }
      const assertOriginal = (context) => {
        requireScanWriterOwner(owner, context);
        requireLegacy(context);
        for (const [originalKey, value] of originals) if (localStorage.getItem(originalKey) !== value) throw scanWriterUnavailable();
        requireScanWriterOwner(owner, context);
        requireLegacy(context);
      };
      let callbackConfirmed = false, writtenRaw;
      const write = (context) => {
        assertOriginal(context);
        const next = change(sessions, originals);
        if (next !== null && (!Array.isArray(next) || next.length > MAX_INDEXED_SCAN_SESSIONS)) throw scanWriterUnavailable();
        const intended = next === null ? null : JSON.stringify({ schema_version: SCAN_RESUME_SCHEMA_VERSION,
          device_id: device, sessions: next, updated_at: new Date().toISOString() });
        assertOriginal(context);
        // One Storage effect only. Failure/ambiguous readback NEVER triggers
        // a blanket delete, retry or compensating write over foreign bytes.
        if (intended !== raw) {
          if (intended === null) localStorage.removeItem(key);else localStorage.setItem(key, intended);
        }
        requireScanWriterOwner(owner, context);
        requireLegacy(context);
        for (const [originalKey, value] of originals) if (originalKey !== key && localStorage.getItem(originalKey) !== value) throw scanWriterUnavailable();
        if (localStorage.getItem(key) !== intended) throw scanWriterUnavailable();
        requireScanWriterOwner(owner, context);
        requireLegacy(context);
        writtenRaw = intended;callbackConfirmed = true;return true;
      };
      if (owner) {
        const pending = owner.writer.call(owner.security, write, { requireEnrollment: true, expectedGeneration: owner.generation });
        // true only after the actual owner settles this original callback.
        // false is UNKNOWN/unconfirmed, never no-write or retry authority.
        return Promise.resolve(pending).then(result => {
          try {
            if (result !== true || !callbackConfirmed) return false;
            requireScanWriterOwner(owner);
            for (const [originalKey, value] of originals) if (originalKey !== key && localStorage.getItem(originalKey) !== value) return false;
            return localStorage.getItem(key) === writtenRaw;
          } catch { return false; }
        }, () => false);
      }
      if (asynchronous) {
        const pending = legacy.writer.call(legacy.queue, write);
        return Promise.resolve(pending).then(result => {
          try {
            if (result !== true || !callbackConfirmed) return false;
            // The owner has settled: never reuse its now-closed checkpoint.
            requireLegacy(undefined, false);
            for (const [originalKey, value] of originals)
              if (originalKey !== key && localStorage.getItem(originalKey) !== value) return false;
            if (localStorage.getItem(key) !== writtenRaw) return false;
            requireLegacy(undefined, false);
            return true;
          } catch { return false; }
        }, () => false);
      }
      return write();
    } catch { return false; }
  }

  function recoverUnindexedScanSessions(deviceId) {
    const normalizedDevice = normalizePhoneDeviceId(deviceId);
    if (!normalizedDevice) return { state: "none", sessions: [] };
    const originalIndex = localStorage.getItem(scanResumeKey(normalizedDevice));
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
    // Native synchronous recovery is a provisional read, not an admitted
    // protected write or durable-index acknowledgement.
    if (isNativeCustodialAuthority()) return { state: "provisional", sessions };
    if (!mutateScanIndex(normalizedDevice, sessions.map(entry => entry.session_uuid), () => sessions, originalIndex)) return { state: "provisional", sessions };
    return { state: "indexed", sessions };
  }

  function indexScanSession(session, view = "timer", context = {}) {
    const entry = scanIndexEntry(session, view, context);
    if (!entry) return false;
    const original = Object.freeze(entry);
    return mutateScanIndex(original.device_id, [original.session_uuid], current => [
      ...current.filter(candidate => candidate.session_uuid !== original.session_uuid), original,
    ]);
  }

  function scanViewConfirmation(session, original) {
    // These four primitive comparisons carry NO authority. The current native
    // runtime and its own fresh context still admit every write. Main captures
    // them INSIDE the original session writer, before/with its exact raw write.
    if (!original || Object.keys(original).sort().join("|") !== "deviceId|generation|principalIdentity|sessionRaw") throw scanWriterUnavailable();
    const { deviceId, generation, principalIdentity, sessionRaw } = original;
    const id = scanSessionId(session);
    if (!id || !/^KIOSK_\d{2}$/.test(deviceId) || !Number.isSafeInteger(generation) || generation < 1
      || typeof principalIdentity !== "string" || !principalIdentity || typeof sessionRaw !== "string" || !sessionRaw) throw scanWriterUnavailable();
    const saved = JSON.parse(sessionRaw);
    if (scanSessionId(saved) !== id || normalizePhoneDeviceId(saved?.device_id) !== deviceId
      || normalizePhoneDeviceId(session?.device_id) !== deviceId) throw scanWriterUnavailable();
    return Object.freeze({ deviceId, generation, principalIdentity, sessionRaw, sessionId: id, saved });
  }

  async function indexScanSessionConfirmed(session, view = "timer", original) {
    try {
      const confirmation = scanViewConfirmation(session, original);
      const entry = scanIndexEntry(confirmation.saved, view, confirmation.saved);
      if (!entry) return false;
      const record = Object.freeze(entry);
      return await mutateScanIndex(record.device_id, [record.session_uuid], current => [
        ...current.filter(candidate => candidate.session_uuid !== record.session_uuid), record,
      ], undefined, true, confirmation);
    } catch { return false; }
  }

  function retireCompletedScanView(session) {
    if (window.MemphisScanSync?.isLocallyCompleted?.(session) !== true) return false;
    const device = normalizePhoneDeviceId(session.device_id);
    const id = scanSessionId(session), sync = window.MemphisScanSync, completion = sync?.isLocallyCompleted;
    if (!id || typeof completion !== "function") return false;
    return mutateScanIndex(device, [id], (sessions, originals) => {
      if (window.MemphisScanSync !== sync || sync.isLocallyCompleted !== completion
        || completion.call(sync, JSON.parse(originals.get(`session:${id}`) || "null")) !== true) throw scanWriterUnavailable();
      return sessions.filter(entry => entry.session_uuid !== id);
    });
  }

  async function retireCompletedScanViewConfirmed(session, original) {
    try {
      const confirmation = scanViewConfirmation(session, original), sync = window.MemphisScanSync, completion = sync?.isLocallyCompleted;
      if (typeof completion !== "function" || completion.call(sync, confirmation.saved) !== true) return false;
      return await mutateScanIndex(confirmation.deviceId, [confirmation.sessionId], (sessions, originals) => {
        if (window.MemphisScanSync !== sync || sync.isLocallyCompleted !== completion
          || completion.call(sync, JSON.parse(originals.get(`session:${confirmation.sessionId}`) || "null")) !== true) throw scanWriterUnavailable();
        return sessions.filter(entry => entry.session_uuid !== confirmation.sessionId);
      }, undefined, true, confirmation);
    } catch { return false; }
  }

  function resolveOpenScanSession(deviceId = phoneDeviceId()) {
    const normalizedDevice = normalizePhoneDeviceId(deviceId);
    try {
    const owner = scanWriterOwner(normalizedDevice);
    let index = readScanIndex(normalizedDevice);
    if (index.state === "indexed") {
      for (const entry of index.sessions) {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(`session:${entry.session_uuid}`) || "null"); }
        catch { return {state:"corrupted",session:null}; }
        if (!owner && window.MemphisScanSync?.isLocallyCompleted?.(saved) === true && !retireCompletedScanView(saved))
          return {state:"corrupted",session:null};
      }
      if (owner) {
        const sessions = index.sessions.filter(entry =>
          window.MemphisScanSync?.isLocallyCompleted?.(JSON.parse(localStorage.getItem(`session:${entry.session_uuid}`) || "null")) !== true);
        index = { state: sessions.length ? "indexed" : "none", sessions };
      }
      else index = readScanIndex(normalizedDevice);
    }
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
    requireScanWriterOwner(owner);
    return { state: "open", session: { ...session, ...verified, view: entry.view } };
    } catch { return { state: "corrupted", session: null }; }
  }

  function openScanSession(deviceId = phoneDeviceId()) {
    const resolved = resolveOpenScanSession(deviceId);
    return resolved.state === "open" ? resolved.session : null;
  }

  function rememberScanView(session, view = "timer", context = {}) {
    const record = scanIndexEntry(session, view, context);
    if (!record) return false;
    return indexScanSession(record, record.view, record);
  }

  function scanResumeView(session, deviceId = phoneDeviceId()) {
    const resolved = resolveOpenScanSession(deviceId);
    const sessionUuid = scanSessionId(session);
    if (resolved.state === "open" && resolved.session?.session_uuid === sessionUuid) return resolved.session.view;
    return String(session?.status || "").toLowerCase().includes("pending") ? "complete" : "timer";
  }

  function clearScanView(sessionUuid = "", deviceId = phoneDeviceId()) {
    const id = String(sessionUuid || "").trim().toLowerCase();
    if (id && !scanSessionId({ session_uuid: id })) return false;
    const pending = mutateScanIndex(deviceId, id ? [id] : [], current => {
      if (!id) return null;
      const remaining = current.filter(record => record.session_uuid !== id);
      return remaining.length ? remaining : null;
    }, undefined, true);
    return Promise.resolve(pending).catch(() => false);
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

  const PHONE_METADATA_KEYS = [PHONE_UNLOCKED_KEY, PHONE_SCREEN_OFF_KEY, PHONE_NAVIGATION_KEY];
  let phoneMetadataUnconfirmed = false;
  let phoneMetadataTail = Promise.resolve();
  // Fixed session DATA only, never actor/clock/unlock authority. The existing
  // owner serializes these ordinary lifecycle events with preservation. Read
  // each event's rows under its admission so our preceding accepted event is
  // not mistaken for a foreign baseline. Unknown strings are never replaced.
  async function mutatePhoneMetadata(operation) {
    const previous = phoneMetadataTail;let release;
    phoneMetadataTail = new Promise(resolve => { release = resolve; });
    try {
      if (phoneMetadataUnconfirmed) return false;
      const device = phoneDeviceId();
      if (!isManagedKioskPhone(device)) return false;
      const owner = scanWriterOwner(device), queue = owner ? null : window.MemphisScanSync;
      const writer = owner ? owner.writer : queue?.mutateProtectedWork;
      const checkpoint = owner ? null : queue?.requireLegacyBrowserMutation;
      const storage = window.sessionStorage, local = window.localStorage;
      const get = storage?.getItem, set = storage?.setItem, remove = storage?.removeItem;
      if (typeof writer !== "function" || !owner && typeof checkpoint !== "function"
        || typeof get !== "function" || typeof set !== "function" || typeof remove !== "function") throw scanWriterUnavailable();
      const current = context => {
        if (phoneMetadataUnconfirmed || window.sessionStorage !== storage || window.localStorage !== local
          || storage.getItem !== get || storage.setItem !== set || storage.removeItem !== remove
          || phoneDeviceId() !== device) throw scanWriterUnavailable();
        requireScanWriterOwner(owner, context);
        if (!owner) {
          if (window.MemphisScanSync !== queue || queue.mutateProtectedWork !== writer
            || queue.requireLegacyBrowserMutation !== checkpoint) throw scanWriterUnavailable();
          if (context !== undefined) {
            if (context?.deviceId !== device || typeof context.assertCurrent !== "function") throw scanWriterUnavailable();
            checkpoint.call(queue);context.assertCurrent();
          }
        }
      };
      // Serialize settlement as well as effects. A subsequent legitimate
      // lifecycle event must not overtake this event's terminal readback.
      // Resource/principal capture still occurs BEFORE this asynchronous wait.
      current();await previous;current();let entered = false, expected;
      const result = await writer.call(owner ? owner.security : queue, context => {
        if (entered) throw scanWriterUnavailable();entered = true;current(context);
        expected = [];
        for (let i = 0; i < PHONE_METADATA_KEYS.length; i++) expected[i] = get.call(storage, PHONE_METADATA_KEYS[i]);
        current(context);
        if (![null, "1"].includes(expected[0]) || ![null, "1"].includes(expected[2])
          || expected[1] !== null && (typeof expected[1] !== "string" || !/^[1-9][0-9]{0,15}$/.test(expected[1])
            || !Number.isSafeInteger(Number(expected[1])))) throw scanWriterUnavailable();
        const same = () => {
          current(context);
          for (let i = 0; i < PHONE_METADATA_KEYS.length; i++)
            if (get.call(storage, PHONE_METADATA_KEYS[i]) !== expected[i]) throw scanWriterUnavailable();
          current(context);
        };
        const write = (index, value) => {
          same();if (expected[index] === value) return;
          if (value === null) remove.call(storage, PHONE_METADATA_KEYS[index]);else set.call(storage, PHONE_METADATA_KEYS[index], value);
          expected[index] = value;same();
        };
        same();const value = operation(write, expected, same);same();return value;
      }, { requireEnrollment: true, ...(owner ? { expectedGeneration: owner.generation } : {}) });
      current();if (!entered || !expected) throw scanWriterUnavailable();
      for (let i = 0; i < PHONE_METADATA_KEYS.length; i++)
        if (get.call(storage, PHONE_METADATA_KEYS[i]) !== expected[i]) throw scanWriterUnavailable();
      current();return result;
    } catch {
      // A refusal/ambiguous effect is not permission to replay, compensate,
      // adopt changed metadata or navigate with a successor owner.
      phoneMetadataUnconfirmed = true;return false;
    } finally { release(); }
  }

  function markPhoneUnlocked() {
    if (!isManagedKioskPhone()) return false;
    // Preserve the synchronous UI DATA return; it was never a durable receipt.
    void mutatePhoneMetadata(write => { write(0, "1");return true; });
    return true;
  }

  function phoneUnlockedSinceWake() {
    if (!isManagedKioskPhone()) return false;
    try { return sessionStorage.getItem(PHONE_UNLOCKED_KEY) === "1"; } catch { return false; }
  }

  function markPhoneScreenOff() {
    if (!isManagedKioskPhone()) return false;
    const originalTime = String(Date.now());
    void mutatePhoneMetadata(write => { write(0, null);write(1, originalTime);return true; });
    return true;
  }

  async function handlePhoneWake(options = {}) {
    if (!isManagedKioskPhone()) return false;
    const force = Boolean(options.force);
    return mutatePhoneMetadata((write, original, same) => {
      if (!force && original[2] === "1") {
        write(2, null);write(1, null);
        return false;
      }
      if (!force && !original[1]) return false;
      const now = Date.now();
      if (now - phoneWakeNavigationAt < 1200) return true;
      const target = buildPhoneWakeTarget();same();write(1, null);
      if (target) {
        write(2, "1");same();window.location.replace(target.toString());
      }
      phoneWakeNavigationAt = now;return true;
    });
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
    indexScanSessionConfirmed,
    phoneDeviceId,
    phoneUnlockedSinceWake,
    readyForDeviceAuthority: waitForDeviceAuthority,
    resolveOpenScanSession,
    retireCompletedScanView,
    retireCompletedScanViewConfirmed,
    isUnstartedScanSession,
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
