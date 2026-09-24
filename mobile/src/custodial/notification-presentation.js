// Capability selects a preferred presenter, never ownership of an in-flight
// alert. One current-principal/key entry serializes both native and browser
// producers. Only the private bridge accepts authenticated bound arrivals.
export function createNotificationPresenter({ identity, nativeMode, nativePresent,
  save, load, displayed, action }) {
  const entries = new Map();
  // Poll cards are untyped and never evidence that a protected event displayed.
  // Their ephemeral lease only excludes simultaneous same-key presentation.
  const pollOwners = new Map();
  let browser = null;
  const keyFor = (scope, key) => JSON.stringify([scope, key]);
  const current = entry => entry.scope === identity();
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
  const binding = event => JSON.stringify(canonical(event?.notification || {}));
  async function attempt(entry) {
    if (!current(entry) || (entry.owner && entry.receiptRecorded) || entry.running || !entry.event
      || pollOwners.has(keyFor(entry.scope,entry.key))) return false;
    entry.running = true; // Set before any OS/network/protected-store await.
    try {
      if (!entry.owner && nativeMode() && await nativePresent(entry.event,entry.scope) === true && current(entry)) entry.owner = 'native';
      // Do not hand off while scheduling is unresolved. On an explicit failed
      // attempt, consume the same accepted payload, not an unrelated poll row.
      if (!entry.owner && current(entry) && browser) {
        let retired=false;
        const isCurrent=()=>!retired&&current(entry);
        const boundAction=kind=>isCurrent()?action(entry.event,kind,entry.scope,isCurrent):false;
        boundAction.isCurrent=isCurrent;
        boundAction.retire=()=>{retired=true;};
        const didShow = browser(entry.event,boundAction);
        if (didShow === true) entry.owner = 'browser';
      }
      if (!entry.owner) return false; // Pending survives missing/busy renderer.
      await save(entry);
      entry.receiptRecorded = await displayed(entry.event, entry.scope) === true;
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
      } else if(binding(entry.event)!==binding(event))throw new Error('Conflicting notification presentation binding.');
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
      if (existing || pollOwners.has(mapKey)) return false;
      const lease = {};
      pollOwners.set(mapKey,lease);
      const release = () => {
        if(pollOwners.get(mapKey)!==lease)return;
        pollOwners.delete(mapKey);
        void retry();
      };
      try {
        if (show(release) !== true) { release(); return false; }
        return true;
      } catch(error) { release(); throw error; }
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
