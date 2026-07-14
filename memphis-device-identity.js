(() => {
  'use strict';

  const STORAGE_KEYS = ['mz_scan_device_id', 'mz_employee_hub_device_id', 'memphisAssignedDeviceId'];

  function normalize(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^kiosk[-_ ]?\d{1,2}$/i.test(raw)) {
      const digits = (raw.match(/\d+/) || [''])[0].padStart(2, '0');
      return `KIOSK_${digits}`;
    }
    return raw;
  }

  function isPlausible(value) {
    const normalized = normalize(value);
    if (!normalized) return false;
    if (/^(visitor|device)-/i.test(normalized)) return false;
    if (/^KIOSK_\d{2}$/i.test(normalized)) return true;
    if (/^[a-z0-9]{6,}-[a-z0-9]{6,}$/i.test(normalized)) return true;
    return false;
  }

  function isCanonicalKiosk(value) {
    return /^KIOSK_(0[1-9]|10)$/i.test(normalize(value));
  }

  function isFullyKiosk() {
    try { if (window.fully) return true; } catch (_err) {}
    return /FullyKiosk/i.test(String(navigator.userAgent || ''));
  }

  function callFully(method) {
    try {
      const fn = window.fully && window.fully[method];
      if (typeof fn !== 'function') return '';
      return normalize(fn.call(window.fully));
    } catch (_err) {
      return '';
    }
  }

  function fullyCandidates() {
    if (!isFullyKiosk()) return [];
    return [
      { value: callFully('getDeviceName'), source: 'fully_device_name' },
      { value: callFully('getDeviceId'), source: 'fully_device_id' },
      { value: callFully('getSerialNumber'), source: 'fully_serial' },
      { value: callFully('getMacAddress'), source: 'fully_mac' },
    ].filter((candidate) => isPlausible(candidate.value));
  }

  function resolveFullyIdentifier() {
    const candidates = fullyCandidates();
    const canonical = candidates.find((candidate) => isCanonicalKiosk(candidate.value));
    return canonical?.value || candidates[0]?.value || '';
  }

  function persist(value) {
    const normalized = normalize(value);
    if (!isPlausible(normalized)) return '';
    for (const key of STORAGE_KEYS) {
      try { localStorage.setItem(key, normalized); } catch (_err) {}
    }
    return normalized;
  }

  function storedCandidates() {
    const values = [];
    for (const key of STORAGE_KEYS) {
      try {
        const value = normalize(localStorage.getItem(key) || '');
        if (isPlausible(value) && !values.includes(value)) values.push(value);
      } catch (_err) {}
    }
    return values;
  }

  function readStored() {
    const values = storedCandidates();
    return values.find(isCanonicalKiosk) || values[0] || '';
  }

  function resolve(options = {}) {
    const url = options.url instanceof URL ? options.url : new URL(window.location.href);
    const explicit = normalize(url.searchParams.get('device') || url.searchParams.get('deviceId') || '');
    const stored = storedCandidates();
    const fully = fullyCandidates();

    // A configured Fully Kiosk name is the strongest device-local signal. This
    // prevents a stale URL or hardware serial from replacing KIOSK_02-KIOSK_10.
    const fullyCanonical = fully.find((candidate) => isCanonicalKiosk(candidate.value));
    if (fullyCanonical) return { deviceId: persist(fullyCanonical.value), source: fullyCanonical.source };

    // Keep a previously configured canonical kiosk identity ahead of raw
    // hardware identifiers. KIOSK_06 and KIOSK_07 currently have no hardware
    // alias rows, so choosing their serial first would blank their apps.
    const storedCanonical = stored.find(isCanonicalKiosk);
    if (storedCanonical) return { deviceId: persist(storedCanonical), source: 'storage_canonical' };

    if (isPlausible(explicit)) return { deviceId: persist(explicit), source: 'url' };

    const fullyHardware = fully.find((candidate) => !isCanonicalKiosk(candidate.value));
    if (fullyHardware) return { deviceId: persist(fullyHardware.value), source: fullyHardware.source };

    const storedFallback = stored[0] || '';
    if (storedFallback) return { deviceId: persist(storedFallback), source: 'storage' };

    return { deviceId: '', source: 'unconfigured' };
  }

  window.MemphisDeviceIdentity = {
    normalize,
    isPlausible,
    isCanonicalKiosk,
    isFullyKiosk,
    resolveFullyIdentifier,
    readStored,
    persist,
    resolve,
  };
})();
