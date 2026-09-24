// Capability selects a preferred presenter, never ownership of an in-flight
// alert. One current-principal/key entry serializes both native and browser
// producers. Only the private bridge accepts authenticated bound arrivals.
export function createNotificationPresenter({ identity, nativeMode, nativePresent,
  save, load, displayed, action }) {
  const entries = new Map();
  let browser = null;
  const keyFor = (scope, key) => JSON.stringify([scope, key]);
  const current = entry => entry.scope === identity();
  const binding = event => {
    const d=event?.notification?.data||{};
    return JSON.stringify([d.kind,d.notification_key,d.receipt_job_id,d.receipt_credential_id,
      d.receipt_employee_id,String(d.receipt_assignment_epoch),d.receipt_device_id]);
  };
  async function attempt(entry) {
    if (!current(entry) || (entry.owner && entry.receiptRecorded) || entry.running || !entry.event) return false;
    entry.running = true; // Set before any OS/network/protected-store await.
    try {
      if (!entry.owner && nativeMode() && await nativePresent(entry.event) === true) entry.owner = 'native';
      // Do not hand off while scheduling is unresolved. On an explicit failed
      // attempt, consume the same accepted payload, not an unrelated poll row.
      if (!entry.owner && current(entry) && browser) {
        const didShow = browser(entry.event, kind => action(entry.event, kind));
        if (didShow === true) entry.owner = 'browser';
      }
      if (!entry.owner) return false; // Pending survives missing/busy renderer.
      await save(entry);
      entry.receiptRecorded = await displayed(entry.event) === true;
      await save(entry);
      return true;
    } finally { entry.running = false; }
  }
  function retry() {
    return Promise.all([...entries.values()].map(entry => attempt(entry).catch(() => false)));
  }
  return Object.freeze({
    async accept(event) {
      const scope = identity(), key = event?.notification?.data?.notification_key;
      if (!scope || !key) return false;
      const mapKey = keyFor(scope, key);
      let entry = entries.get(mapKey);
      if (!entry) {
        entry = { scope, key, event: JSON.parse(JSON.stringify(event)), owner: null, running: false };
        entries.set(mapKey, entry);
      } else if (!entry.event) entry.event = JSON.parse(JSON.stringify(event));
      else if(binding(entry.event)!==binding(event))throw new Error('Conflicting notification presentation binding.');
      // Keep a durable exact accepted payload independently of the receipt
      // transport outbox: uploading 'received' must not discard pending display.
      await save(entry);
      return attempt(entry);
    },
    registerBrowser(presenter) {
      if (typeof presenter !== 'function') return;
      browser = presenter;
      void retry();
    },
    presentBrowser(key, show) {
      const scope = identity();
      if (!scope || !key || nativeMode()) return false;
      const mapKey = keyFor(scope, key), existing = entries.get(mapKey);
      if (existing?.event || existing?.owner || existing?.running) return false;
      const entry = existing || { scope, key, event: null, owner: null, running: false };
      entries.set(mapKey, entry);
      entry.running = true;
      try {
        if (show() !== true) return false;
        entry.owner = 'browser';
        return true;
      } finally { entry.running = false; }
    },
    retry,
    async restore() {
      for (const entry of await load()) {
        if (!current(entry) || !entry.event || !entry.key) continue;
        const mapKey = keyFor(entry.scope, entry.key);
        if (!entries.has(mapKey)) entries.set(mapKey, { ...entry, running: false });
      }
      return retry();
    },
  });
}
