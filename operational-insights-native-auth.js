(() => {
  'use strict';
  const mobile = window.MemphisMobile;
  if (!mobile?.requestEnvelope || !mobile?.authHeaders || !mobile?.fetch) return;
  const original = mobile.requestEnvelope.bind(mobile);
  const API = 'https://memphis-zoo-mcp.onrender.com';

  async function analyticsEnvelope(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    const auth = await mobile.authHeaders({ force: !retry });
    for (const [name, value] of Object.entries(auth || {})) if (value) headers.set(name, value);
    let body = options.body;
    if (body != null && typeof body !== 'string' && !(body instanceof Blob) && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    const response = await mobile.fetch(`${API}${path}`, {
      method: options.method || 'GET', cache: 'no-store', credentials: 'omit', signal: options.signal, headers, body,
    }, true);
    if (retry && (response.status === 401 || response.status === 403)) {
      await mobile.refresh({ force: true });
      return analyticsEnvelope(path, options, false);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  mobile.requestEnvelope = (path, options = {}) => String(path || '').startsWith('/analytics-api/')
    ? analyticsEnvelope(String(path), options)
    : original(path, options);
})();
