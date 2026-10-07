// Capability selects a preferred presenter, never ownership of an in-flight
// alert. One current-principal/key entry serializes both native and browser
// producers. Only the private bridge accepts authenticated bound arrivals.
export function createNotificationPresenter({ identity, nativeMode, nativePresent,
  save, load, displayed, action, isCurrent = () => true }) {
  const entries = new Map();
  // Poll cards are untyped and never evidence that a protected event displayed.
  // Their ephemeral lease only excludes simultaneous same-key presentation.
  const pollOwners = new Map();
  let browser = null;
  let draining=false, retryRequested=false;
  const keyFor = (scope, key) => JSON.stringify([scope, key]);
  const current = entry => entry.scope === identity() && isCurrent(entry.event,entry.scope) === true;
  function retireBrowser(entry) {
    if (entry.retireBrowser && !entry.retiring) {
      // Keep the exact callback until the renderer confirms its own card is
      // gone. A failed removal is not a successful schedule application.
      entry.retiring=true;
      try {
        if (entry.retireBrowser() !== true) throw new Error('Browser notification retirement unconfirmed.');
        entry.retireBrowser = null;
      } finally { entry.retiring=false; }
    }
  }
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
  const binding = event => JSON.stringify(canonical(event?.notification || {}));
  function persist(entry, changes = {}, canWrite = () => true) {
    // Keep staged action/audio state out of concurrent display/duplicate saves.
    // Each snapshot is made AFTER earlier writes settle, under one entry writer.
    const write=async()=>{
      const snapshot={scope:entry.scope,key:entry.key,event:entry.event,owner:entry.owner,
        receiptRecorded:entry.receiptRecorded,queueOrdinal:entry.queueOrdinal,
        queueOrderSource:entry.queueOrderSource,visualState:entry.visualState,
        audioState:entry.audioState,...changes};
      await save(snapshot,canWrite);
      Object.assign(entry,changes,{queueOrdinal:snapshot.queueOrdinal});
    };
    const pending=(entry.saving||Promise.resolve()).then(write,write);
    entry.saving=pending.catch(()=>{});
    return pending;
  }
  async function attempt(entry) {
    if (!current(entry)) { retireBrowser(entry); return false; }
    if (entry.visualState !== 'pending' || (entry.owner === 'native' && entry.receiptRecorded)
      || (entry.rendered && entry.receiptRecorded) || entry.running || !entry.event
      || pollOwners.has(keyFor(entry.scope,entry.key))) return false;
    entry.running = true; // Set before any OS/network/protected-store await.
    try {
      await persist(entry,{},()=>current(entry));
      if (!current(entry)) { retireBrowser(entry); return false; }
      if (!entry.owner && nativeMode() && await nativePresent(entry.event,entry.scope) === true && current(entry)) entry.owner = 'native';
      // Do not hand off while scheduling is unresolved. On an explicit failed
      // attempt, consume the same accepted payload, not an unrelated poll row.
      if (entry.owner !== 'native' && !entry.rendered && current(entry) && browser) {
        let retired=false, actionRunning=false;
        const isCurrent=()=>!retired&&current(entry);
        const boundAction=async kind=>{
          if (!isCurrent() || actionRunning || entry.visualState !== 'pending'
            || !['opened','dismissed','acknowledged'].includes(kind)) return false;
          actionRunning=true;
          try {
            if (await action(entry.event,kind,entry.scope,isCurrent)!==true || !isCurrent()) return false;
            await persist(entry,{visualState:kind},isCurrent);
            return isCurrent();
          } finally { actionRunning=false; }
        };
        boundAction.isCurrent=isCurrent;
        // Closing this visual does not revoke audio that is still finishing.
        // Exact old click handlers are fenced by the renderer and visualState.
        boundAction.retire=()=>{};
        boundAction.detach=()=>{
          retired=true;entry.rendered=false;entry.retireBrowser=null;
        };
        boundAction.beginAudio=async()=>{
          if (!isCurrent() || entry.audioState!=='unstarted' || entry.audioAttempted) return false;
          // Claim durably BEFORE any sound. An interrupted/uncertain claim is
          // retained on restart, never retried as a fresh two-cycle episode.
          entry.audioAttempted=true;
          try { await persist(entry,{audioState:'claimed'},isCurrent); } catch { return false; }
          return isCurrent();
        };
        boundAction.finishAudio=async completed=>{
          if (!isCurrent() || entry.audioState!=='claimed') return false;
          try { await persist(entry,{audioState:completed===true?'completed':'incomplete'},isCurrent); } catch { return false; }
          return isCurrent();
        };
        boundAction.onRetire=remove=>{
          if(typeof remove!=='function')throw new Error('Browser notification retirement callback required.');
          entry.retireBrowser=()=>{retired=true;return remove();};
        };
        const didShow = browser(entry.event,boundAction);
        if (didShow === true) { entry.owner = 'browser'; entry.rendered = true; }
      }
      if (!current(entry)) { retireBrowser(entry); return false; }
      if (!entry.owner) return false; // Pending survives missing/busy renderer.
      await persist(entry,{},()=>current(entry));
      if (!current(entry)) { retireBrowser(entry); return false; }
      if (!entry.receiptRecorded) entry.receiptRecorded = await displayed(entry.event, entry.scope, () => current(entry)) === true;
      if (!current(entry)) { retireBrowser(entry); return false; }
      await persist(entry,{},()=>current(entry));
      return true;
    } finally { entry.running = false; }
  }
  function retry() {
    // Retirement cannot wait behind a slow OS/network/protected-store attempt.
    if (draining) {
      retryRequested=true;
      for (const entry of entries.values()) if (!current(entry)) {
        try { retireBrowser(entry); } catch {} // Exact callback remains retryable.
      }
      // A poll/lifecycle call must not wait on unresolved native scheduling.
      return Promise.resolve([...entries.values()].map(()=>false));
    }
    draining=true;
    const run = async () => {
      try {
        const results=[];
        for (const entry of [...entries.values()].sort((a,b)=>a.queueOrdinal-b.queueOrdinal)) {
          results.push(await attempt(entry).catch(()=>false));
        }
        return results;
      } finally {
        draining=false;
        if(retryRequested){retryRequested=false;void retry();}
      }
    };
    return run();
  }
  return Object.freeze({
    async accept(event) {
      const scope = identity(), key = event?.notification?.data?.notification_key;
      if (!scope || !key) return false;
      const mapKey = keyFor(scope, key);
      let entry = entries.get(mapKey);
      if (!entry) {
        entry = { scope, key, event: JSON.parse(JSON.stringify(event)), owner: null, running: false,
          visualState:'pending', audioState:'unstarted', queueOrderSource:'accepted-local', rendered:false };
        entries.set(mapKey, entry);
      } else if(binding(entry.event)!==binding(event))throw new Error('Conflicting notification presentation binding.');
      // Keep a durable exact accepted payload independently of the receipt
      // transport outbox: uploading 'received' must not discard pending display.
      await persist(entry);
      const results=await retry();
      return results.some(Boolean);
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
        // The accepted payload remains pending when schedule authority is not
        // yet known after restart. It may be retried after authenticated refresh,
        // but must never be adopted by another protected principal.
        if (entry.scope !== identity() || !entry.event || !entry.key) continue;
        const mapKey = keyFor(entry.scope, entry.key);
        if (!entries.has(mapKey)) {
          const restored={...entry,running:false,retireBrowser:null,rendered:false,
            visualState:entry.visualState||'pending',
            queueOrderSource:entry.queueOrderSource||'legacy-recovered',
            // Legacy displayed rows did not record speech completion. Do not
            // invent it, or replay their potentially already-spoken episode.
            audioState:entry.audioState||(entry.owner?'legacy-unknown':'unstarted')};
          await persist(restored);
          entries.set(mapKey,restored);
        }
      }
      return retry();
    },
  });
}
