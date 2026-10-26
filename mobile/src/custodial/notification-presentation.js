// Capability selects a preferred presenter, never ownership of an in-flight
// alert. One current-principal/key entry serializes both native and browser
// producers. Only the private bridge accepts authenticated bound arrivals.
export function createNotificationPresenter({ identity, nativeMode, nativePresent,
  save, load, displayed, action, isCurrent = () => true, nativeStatus, requireNativeOwner = false, nativeApplicationSource = null, readSavedNativeData = null, returnedSaveNativeData = null }) {
  if(typeof requireNativeOwner!=='boolean')throw new TypeError('Explicit native presentation ownership mode required.');
  const sourceWriter=(diagnosticSite,operation,asyncResult=false)=>nativeApplicationSource
    ?nativeApplicationSource.wrapNativeWriter(operation,asyncResult,diagnosticSite):operation;
  const entries = new Map();
  // Volatile rejection fences, never saved generation/authority or new identity.
  const entryOwners = new WeakMap();
  // Native-only last returned NORMAL save/readback DATA, never a receipt.
  const lastNativeSaved = new WeakMap();
  const unavailable=()=>new Error('Original native notification presentation owner unavailable.');
  function captureOwner(scope=identity()){
    if(typeof nativeStatus!=='function')throw unavailable();
    const status=nativeStatus(),principal=protectedPrincipal(status?.principal);
    if(!principal||!scope||scope!==identity()||scope!==principalIdentity(principal)
      ||status.ready!==true||status.available!==true||status.quarantined!==false
      ||!Number.isSafeInteger(status.generation)||status.generation<=0||status.deviceId!==principal.device_id)throw unavailable();
    return Object.freeze({scope,generation:status.generation,deviceId:status.deviceId,principal});
  }
  const sameOwner=(a,b)=>Boolean(a&&b&&a.scope===b.scope&&a.generation===b.generation
    &&a.deviceId===b.deviceId&&principalIdentity(a.principal)===principalIdentity(b.principal));
  function ownerCurrent(entry,original=entryOwners.get(entry)){
    if(!requireNativeOwner)return true;
    try{return sameOwner(original,entryOwners.get(entry))&&sameOwner(original,captureOwner(entry.scope));}catch{return false;}
  }
  function requireOwner(original){if(!sameOwner(original,captureOwner(original.scope)))throw unavailable();}
  // Poll cards are untyped and never evidence that a protected event displayed.
  // Their ephemeral lease only excludes simultaneous same-key presentation.
  const pollOwners = new Map();
  let browser = null;
  let draining=false, retryRequested=false;
  const keyFor = (scope, key) => JSON.stringify([scope, key]);
  const current = entry => entry.scope === identity() && isCurrent(entry.event,entry.scope) === true && ownerCurrent(entry);
  function sourceRetireBrowser(entry) {
    if (entry.retireBrowser && !entry.retiring) {
      // Keep the exact callback until the renderer confirms its own card is
      // gone. A failed removal is not a successful schedule application.
      entry.retirementPending=true;
      entry.retiring=true;
      try {
        if (entry.retireBrowser() !== true) throw new Error('Browser notification retirement unconfirmed.');
        entry.retireBrowser = null;
        entry.retirementPending=false;
      } finally { entry.retiring=false; }
    }
  }
  const retireBrowser=sourceWriter('PRESENTER_50',sourceRetireBrowser);
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
  const binding = event => JSON.stringify(canonical(event?.notification || {}));
  function sourcePersist(entry, changes = {}, canWrite = () => true) {
    // Capture before the entry writer queue, not after its predecessor settles.
    const original=requireNativeOwner?captureOwner(entry.scope):null;
    if(requireNativeOwner&&!ownerCurrent(entry,original))throw unavailable();
    const admitted=()=>ownerCurrent(entry,original)&&canWrite()===true;
    // Keep staged action/audio state out of concurrent display/duplicate saves.
    // Each snapshot is made AFTER earlier writes settle, under one entry writer.
    const write=async()=>{
      if(!admitted())throw unavailable();
      const snapshot={scope:entry.scope,key:entry.key,event:entry.event,owner:entry.owner,
        receiptRecorded:entry.receiptRecorded,queueOrdinal:entry.queueOrdinal,
        queueOrderSource:entry.queueOrderSource,visualState:entry.visualState,
        audioState:entry.audioState,...changes};
      const saved=await (requireNativeOwner
        ?save(snapshot,admitted,Object.freeze({expectedGeneration:original.generation}))
        :save(snapshot,admitted));
      // The existing bridge returns void after verified storage readback. No
      // returned JSON/false/null supplies a replacement acceptance signal.
      if(requireNativeOwner&&saved!==undefined&&saved!==true)throw unavailable();
      if(!admitted())throw unavailable();
      Object.assign(entry,changes,{queueOrdinal:snapshot.queueOrdinal});
      if(nativeApplicationSource){
        // Observation failure must not suppress the original ordinary update.
        // The fixed normal bridge reader returns the SAME persisted namespace.
        lastNativeSaved.delete(entry);
        try{const raw=typeof returnedSaveNativeData==='function'?returnedSaveNativeData(snapshot):null;
          if(typeof raw==='string')lastNativeSaved.set(entry,Object.freeze({
            scope:snapshot.scope,key:snapshot.key,generation:original?.generation??null,raw,
            scope_kind:'NORMAL_SAVE_RETURNED_NOT_CURRENT_NATIVE_WORK',receipt_eligible:false}));
        }catch{/* DATA unavailable; original normal body still completes. */}
      }
    };
    const pending=(entry.saving||Promise.resolve()).then(write,write);
    entry.saving=pending.catch(()=>{});
    return pending;
  }
  const persist=sourceWriter('PRESENTER_90',sourcePersist,true);
  async function sourceAttempt(entry) {
    // A recovered authority cannot abandon removal of an already fenced card.
    // Finish that exact callback before considering any presentation shortcut.
    if (entry.retirementPending) retireBrowser(entry);
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
        const boundAction=sourceWriter('PRESENTER_109',async kind=>{
          if (!isCurrent() || actionRunning || entry.visualState !== 'pending'
            || !['opened','dismissed','acknowledged'].includes(kind)) return false;
          actionRunning=true;
          try {
            if (await action(entry.event,kind,entry.scope,isCurrent)!==true || !isCurrent()) return false;
            await persist(entry,{visualState:kind},isCurrent);
            return isCurrent();
          } finally { actionRunning=false; }
        },true);
        boundAction.isCurrent=isCurrent;
        // Closing this visual does not revoke audio that is still finishing.
        // Exact old click handlers are fenced by the renderer and visualState.
        boundAction.retire=()=>{};
        boundAction.detach=sourceWriter('PRESENTER_123',()=>{
          retired=true;entry.rendered=false;entry.retireBrowser=null;
        });
        boundAction.beginAudio=sourceWriter('PRESENTER_126',async()=>{
          if (!isCurrent() || entry.audioState!=='unstarted' || entry.audioAttempted) return false;
          // Claim durably BEFORE any sound. An interrupted/uncertain claim is
          // retained on restart, never retried as a fresh two-cycle episode.
          entry.audioAttempted=true;
          try { await persist(entry,{audioState:'claimed'},isCurrent); } catch { return false; }
          return isCurrent();
        },true);
        boundAction.finishAudio=sourceWriter('PRESENTER_134',async completed=>{
          if (!isCurrent() || entry.audioState!=='claimed') return false;
          try { await persist(entry,{audioState:completed===true?'completed':'incomplete'},isCurrent); } catch { return false; }
          return isCurrent();
        },true);
        boundAction.onRetire=sourceWriter('PRESENTER_139',remove=>{
          if(typeof remove!=='function')throw new Error('Browser notification retirement callback required.');
          entry.retireBrowser=sourceWriter('PRESENTER_141',()=>{retired=true;return remove();});
        });
        const didShow = browser(entry.event,boundAction);
        if (didShow === true) {
          if(!current(entry)){retireBrowser(entry);return false;}
          entry.owner = 'browser'; entry.rendered = true;
        }
      }
      if (!current(entry)) { retireBrowser(entry); return false; }
      if (!entry.owner) return false; // Pending survives missing/busy renderer.
      await persist(entry,{},()=>current(entry));
      if (!current(entry)) { retireBrowser(entry); return false; }
      if (!entry.receiptRecorded) {
        const recorded=await displayed(entry.event, entry.scope, () => current(entry));
        if(!current(entry)){retireBrowser(entry);return false;}
        if(recorded===true)entry.receiptRecorded=true;
      }
      if (!current(entry)) { retireBrowser(entry); return false; }
      await persist(entry,{},()=>current(entry));
      return true;
    } finally { entry.running = false; }
  }
  const attempt=sourceWriter('PRESENTER_163',sourceAttempt,true);
  function sourceRetry() {
    // Retirement cannot wait behind a slow OS/network/protected-store attempt.
    if (draining) {
      retryRequested=true;
      for (const entry of entries.values()) if (entry.retirementPending || !current(entry)) {
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
  const retry=sourceWriter('PRESENTER_189',sourceRetry,true);
  return Object.freeze({
    // Passive DATA from THIS mounted presenter. No retry, write, permission
    // query or interpretation of empty/pending state as settlement.
    observeNativeSourceData() {
      if(entries.size>256||pollOwners.size>256)throw Error('Native presenter DATA bound.');
      return {schema:'custodial.native-presenter-raw-data.v1',receipt_eligible:false,
        draining,retryRequested,browser_present:browser!==null,
        entries:[...entries.entries()],poll_owners:[...pollOwners.keys()]};
    },
    // Fixed typed observation from THIS factory; selector is supplied only by
    // the private Source's actual employee render, not a public registration.
    // Raw snapshot remains unchanged and retains its opaque Promise/functions.
    observeOrdinaryDeliveryData(selector) {
      if(!nativeApplicationSource||!selector||typeof selector.principal!=='string'||typeof selector.service_date!=='string'
        ||entries.size>4096||pollOwners.size>4096)throw unavailable();
      const related=[],unrelated={entries:0,poll_owners:0,opaque_retained_entries:0};
      for(const [mapKey,entry]of entries){
        const copied=nativeApplicationSource.copyOrdinaryOwnerData(entry);
        if(!copied||typeof copied.scope!=='string'||typeof copied.key!=='string')throw unavailable();
        const data=copied.event?.notification?.data;
        if(copied.scope!==selector.principal||typeof data?.kind==='string'&&!['employee_lunch_coverage','employee_location_status'].includes(data.kind)
          ||typeof data?.service_date==='string'&&data.service_date!==selector.service_date){
          unrelated.entries++;if(copied.saving||copied.retireBrowser)unrelated.opaque_retained_entries++;continue;
        }
        if(related.length>=256)throw unavailable();
        let raw=null;try{raw=typeof readSavedNativeData==='function'?readSavedNativeData(copied.scope,copied.key):null;}catch{}
        related.push({map_key:mapKey,scope:copied.scope,key:copied.key,event:copied.event,
          owner:copied.owner??null,running:('running' in copied?copied.running:false),rendered:('rendered' in copied?copied.rendered:false),
          receipt_recorded:('receiptRecorded' in copied?copied.receiptRecorded:false),visual_state:copied.visualState??null,audio_state:copied.audioState??null,
          audio_attempted:('audioAttempted' in copied?copied.audioAttempted:false),retirement_pending:('retirementPending' in copied?copied.retirementPending:false),retiring:('retiring' in copied?copied.retiring:false),
          last_verified_save:lastNativeSaved.get(entry)??null,current_raw:typeof raw==='string'?raw:null,
          opaque_fields:{saving:copied.saving??null,retireBrowser:copied.retireBrowser??null},receipt_eligible:false});
      }
      const relatedPoll=[];
      for(const key of pollOwners.keys()){
        // Exact private map key is retained; unknown relation remains explicit.
        if(typeof key!=='string')throw unavailable();
        let pair;try{pair=JSON.parse(key);}catch{throw unavailable();}
        if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||typeof pair[1]!=='string')throw unavailable();
        if(pair[0]===selector.principal){if(relatedPoll.length>=256)throw unavailable();relatedPoll.push(key);}
        else unrelated.poll_owners++;
      }
      return {schema:'custodial.native-presenter-ordinary-target-data.v1',receipt_eligible:false,
        scope:'FIXED_NORMAL_ENTRY_AND_RETURNED_SAVE_DATA_NOT_EFFECT_SETTLEMENT',selector,
        native_owner_required:requireNativeOwner,draining,retryRequested,entries:related,poll_owners:relatedPoll,unrelated};
    },
    accept:sourceWriter('PRESENTER_236',async function accept(event) {
      const scope = identity(), key = event?.notification?.data?.notification_key;
      if (!scope || !key) return false;
      const original=requireNativeOwner?captureOwner(scope):null;
      const mapKey = keyFor(scope, key);
      let entry = entries.get(mapKey);
      if (!entry) {
        entry = { scope, key, event: JSON.parse(JSON.stringify(event)), owner: null, running: false,
          visualState:'pending', audioState:'unstarted', queueOrderSource:'accepted-local', rendered:false };
        if(requireNativeOwner)entryOwners.set(entry,original);
        entries.set(mapKey, entry);
      } else if(binding(entry.event)!==binding(event))throw new Error('Conflicting notification presentation binding.');
      if(requireNativeOwner&&!ownerCurrent(entry,original))throw unavailable();
      // Keep a durable exact accepted payload independently of the receipt
      // transport outbox: uploading 'received' must not discard pending display.
      await persist(entry);
      if(!ownerCurrent(entry,original))return false;
      const results=await retry();
      if(!ownerCurrent(entry,original))return false;
      return results.some(Boolean);
    },true),
    registerBrowser:sourceWriter('PRESENTER_257',function registerBrowser(presenter) {
      if (typeof presenter !== 'function') return;
      browser = presenter;
      void retry();
    }),
    presentBrowser:sourceWriter('PRESENTER_262',function presentBrowser(key, show) {
      const scope = identity();
      if (!scope || !key || nativeMode()) return false;
      const mapKey = keyFor(scope, key), existing = entries.get(mapKey);
      if (existing || pollOwners.has(mapKey)) return false;
      const lease = {};
      pollOwners.set(mapKey,lease);
      const release = sourceWriter('PRESENTER_269',() => {
        if(pollOwners.get(mapKey)!==lease)return;
        pollOwners.delete(mapKey);
        void retry();
      });
      try {
        if (show(release) !== true) { release(); return false; }
        return true;
      } catch(error) { release(); throw error; }
    }),
    retry,
    restore:sourceWriter('PRESENTER_280',async function restore() {
      const original=requireNativeOwner?captureOwner():null;
      const loaded=await load();
      if(requireNativeOwner)requireOwner(original);
      for (const entry of loaded) {
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
          if(requireNativeOwner)entryOwners.set(restored,original);
          await persist(restored);
          if(requireNativeOwner)requireOwner(original);
          entries.set(mapKey,restored);
        }
      }
      const results=await retry();
      if(requireNativeOwner)requireOwner(original);
      return results;
    },true),
  });
}
import {protectedPrincipal,principalIdentity} from './protected-principal.js';
