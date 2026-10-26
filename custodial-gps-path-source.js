(function (root) {
  'use strict';
  const API = 'https://memphis-zoo-mcp.onrender.com/dashboard-api/gps-map-context';
  async function read({ headers, fetchImpl = root.fetch?.bind(root) }) {
    if (!headers || typeof fetchImpl !== 'function') throw new Error('Named-manager read adapter required');
    const response = await fetchImpl(API, { method: 'GET', cache: 'no-store', headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true || payload?.meta?.contract !== 'gps-map-context.v1' ||
        !Array.isArray(payload?.data?.work)) throw new Error('Verified GPS map context unavailable');
    return payload.data;
  }
  const api = Object.freeze({ read, API });
  root.MemphisCustodialGpsPathSource = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
