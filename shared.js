window.MZ = (() => {
  const cfg = window.MZ_CONFIG || {};

  function get(obj, path, fallback) {
    return path.split('.').reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj) ?? fallback;
  }

  function requireValue(path, value) {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing config: ${path}`);
    }
    return value;
  }

  function appVersion() {
    return get(cfg, 'app.frontendVersion', 'unknown');
  }

  function asset(name) {
    return requireValue(`assets.${name}`, get(cfg, `assets.${name}`));
  }

  function storageKey(name) {
    return requireValue(`storage.${name}`, get(cfg, `storage.${name}`));
  }

  function pollMs(name, fallback = 30000) {
    return get(cfg, `polling.${name}`, fallback);
  }

  function deviceConfig(name, fallback = '') {
    return get(cfg, `devices.${name}`, fallback);
  }

  function backendBaseUrl() {
    return requireValue('backend.baseUrl', get(cfg, 'backend.baseUrl'));
  }

  function endpoint(name) {
    const path = requireValue(`endpoints.${name}`, get(cfg, `endpoints.${name}`));
    return `${backendBaseUrl()}${path}`;
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed: ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function fetchEndpoint(name, options = {}) {
    return fetchJson(endpoint(name), options);
  }

  async function getVersion() {
    return fetchEndpoint('version', { cache: 'no-store' });
  }

  async function assertContract(area) {
    const version = await getVersion();
    const required = requireValue(`contracts.${area}`, get(cfg, `contracts.${area}`));
    const actual = version?.contracts?.[area];
    if (actual !== required) {
      throw new Error(`Contract mismatch for ${area}: expected ${required}, got ${actual || 'missing'}`);
    }
    return version;
  }

  function resolveDeviceId({ persist = true, fallbackForGithubPages = true } = {}) {
    const url = new URL(window.location.href);
    const explicit = String(url.searchParams.get('device') || url.searchParams.get('deviceId') || url.searchParams.get('device_id') || '').trim();
    if (explicit) {
      if (persist) localStorage.setItem(storageKey('deviceId'), explicit);
      return explicit;
    }
    const stored = String(localStorage.getItem(storageKey('deviceId')) || '').trim();
    if (stored) return stored;
    if (fallbackForGithubPages && location.hostname.includes('github.io')) {
      const fallback = deviceConfig('devFallbackDeviceId', '');
      if (fallback && persist) localStorage.setItem(storageKey('deviceId'), fallback);
      return fallback;
    }
    return '';
  }

  function persistDeviceId(deviceId) {
    if (!deviceId) return;
    localStorage.setItem(storageKey('deviceId'), String(deviceId));
  }

  function startPolling(task, intervalMs, { immediate = true } = {}) {
    let stopped = false;
    let timer = null;

    async function run() {
      if (stopped) return;
      try {
        await task();
      } catch (error) {
        console.error('Polling task failed', error);
      }
    }

    if (immediate) run();
    timer = window.setInterval(run, intervalMs);
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
    };
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function buildStamp(frontend, backend) {
    return backend ? `${frontend} • ${backend}` : frontend;
  }

  return {
    cfg,
    get,
    appVersion,
    asset,
    storageKey,
    pollMs,
    deviceConfig,
    endpoint,
    fetchJson,
    fetchEndpoint,
    getVersion,
    assertContract,
    resolveDeviceId,
    persistDeviceId,
    startPolling,
    setText,
    buildStamp
  };
})();
