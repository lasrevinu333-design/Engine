const { expect, test } = require('@playwright/test');

const OUTPUT_ROOT = 'build/batch-0b-shell-browser/custodial';
const DEVICE_ID = 'KIOSK_08';

// New platform participation input only: real browser locks/IDB, synthetic
// protected storage and native callbacks. No APK, named-session or native ACK.
const PARTICIPATING_SOURCE_PINS = {
  'credential-store.js': '3df780caf607fe404ce56928c90c9b7558c66d720dedecf1d02fcf3f6293d70f',
  'protected-browser-admission.js': 'c0e06e95b3938fd9e3cf4ff715820b5680b5c3cffc9c85792615ccf0359c859f',
  'security-keys.js': '24883edc7a15e242f6a528990f944204151b56622c60db9b90ac46c41f7fc0b2',
};
const SCAN_DRAFT_SOURCE_PIN = '24153d550dc2e1c43f642cc22fad93266cb064559509050eb71f554299a61c4c';
const SCAN_DRAFT_INPUT = {
  contract_version: 'scan.v4.snapshot-bound-authority',
  session_uuid: '78000000-0000-4000-8000-000000000005',
  client_completion_id: '78000000-0000-4000-8000-000000000006',
  device_id: DEVICE_ID,
  employee_id: '78000000-0000-4000-8000-000000000007',
  location_code: 'NOCX',
  draft: { note: 'Original sandbox draft; not a signed cleaning completion.' },
};

async function participatingBrowserPages(browser, baseURL, { shippingDraftWriter = false, queuedOriginalOwner = false, durableEpochWriter = false } = {}) {
  expect(baseURL, 'Main owns the fixed normal browser route').toBe('http://127.0.0.1:43891');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const pages = [], unexpected = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== baseURL || route.request().method() !== 'GET') {
      unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    if (url.pathname === '/start_page1.html' && url.searchParams.has('participating-removal-fixture')) {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Private participation fixture</title><p>Sandbox only</p>' });
    }
    if (/^\/mobile\/src\/custodial\/[a-z0-9-]+\.js$/.test(url.pathname)) return route.continue();
    if (shippingDraftWriter && url.pathname === '/memphis-scan-sync.js') return route.continue();
    unexpected.push(`${route.request().method()} ${url.pathname}`);
    return route.abort();
  });
  const cleanup = async () => {
    const failures = [];
    try {
      for (const page of pages) if (!page.isClosed()) {
        try { await page.evaluate(() => window.__participatingRemovalBrowser?.close()); }
        catch (error) { failures.push(error); }
      }
      // The shipping worker owns its persistent queue connection, timer and
      // BroadcastChannel. Close that document before deleting owned databases;
      // do not reach into worker internals or pretend its connection is ours.
      if (shippingDraftWriter && pages[1] && !pages[1].isClosed()) await pages[1].close();
      if (pages[0] && !pages[0].isClosed()) {
        await pages[0].evaluate(async () => {
          const f = window.__participatingRemovalBrowser;
          if (!f?.createdSandbox) return;
          for (const name of ['mz_scan_queue', 'mz_scan_completion_drafts']) {
            await new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase(name);
              request.onsuccess = resolve;
              request.onerror = () => reject(request.error);
              request.onblocked = () => reject(Error('Owned sandbox database cleanup blocked'));
            });
          }
        });
      }
    } finally { await context.close(); }
    if (failures.length) throw Error(`Owned page cleanup failed (${failures.length})`);
  };
  try {
    for (const role of ['removal', 'writer']) {
      const page = await context.newPage(); pages.push(page);
      await page.goto(`${baseURL}/start_page1.html?participating-removal-fixture=${role}`);
      await page.evaluate(async ({ role, pins, deviceId, shippingDraftWriter, queuedOriginalOwner, durableEpochWriter }) => {
        if (!isSecureContext || !navigator.locks?.request || !navigator.locks?.query || !indexedDB.databases || !crypto.subtle) {
          throw Error('PARTICIPATING_REMOVAL_BROWSER_NEW normal browser capability missing');
        }
        for (const [file, expected] of Object.entries(pins)) {
          const response = await fetch(`/mobile/src/custodial/${file}`, { cache: 'no-store' });
          if (!response.ok) throw Error(`Actual source unavailable: ${file}`);
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer())))
            .map(byte => byte.toString(16).padStart(2, '0')).join('');
          if (digest !== expected) throw Error(`Actual source changed; rebind required: ${file}`);
        }
        const { createCustodialCredentialStore } = await import('/mobile/src/custodial/credential-store.js');
        const { createProtectedBrowserAdmission, PROTECTED_BROWSER_HOLD_KEY, PROTECTED_BROWSER_LOCK } =
          await import('/mobile/src/custodial/protected-browser-admission.js');
        const keys = await import('/mobile/src/custodial/security-keys.js');
        const connections = new Set(), deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
        const inspectionResume = deferred(), writerResume = deferred();
        const operationId = '78000000-0000-4000-8000-000000000001';
        const installation = { schema_version: 1, credential: 'synthetic-browser-protected-fixture-only', device_id: deviceId,
          installation_seal: 'synthetic-browser-installation-seal-12345678', enrolled_at: '2026-08-01T17:00:00.000Z',
          enrollment_operation_id: '78000000-0000-4000-8000-000000000002', migrated_from_credential_only_state: false };
        if (queuedOriginalOwner) installation.principal = {
          schema_version: 'custodial-protected-principal.v1', device_id: deviceId,
          employee_id: '78000000-0000-4000-8000-000000000007',
          credential_id: '78000000-0000-4000-8000-000000000008',
          credential_operation_id: installation.enrollment_operation_id, assignment_epoch: 1,
          installation_seal: installation.installation_seal, enrolled_at: installation.enrolled_at,
        };
        let protectedRecord = JSON.stringify(installation), closing = false, leaseActive = false, catalogueReads = 0;
        const audit = { admissionAttempted: false, inspectionWaiting: false, writerWaiting: false, removalDecided: false,
          producerCalls: 0, remoteCalls: 0, finalizerCalls: 0, inspectionOpens: 0, result: null, writerResult: null };
        const track = request => {
          request.addEventListener('success', () => connections.add(request.result));
          return request;
        };
        if (role === 'removal') {
          // Deliberate setup only. Both databases exist before any inspection.
          const existing = await indexedDB.databases();
          if (existing.some(db => ['mz_scan_queue', 'mz_scan_completion_drafts'].includes(db.name))) {
            throw Error('Sandbox is not fresh; do not adopt or delete existing databases');
          }
          for (const [name, store] of [['mz_scan_queue', 'actions'], ['mz_scan_completion_drafts', 'drafts']]) {
            await new Promise((resolve, reject) => {
              const request = track(indexedDB.open(name, 1));
              request.onupgradeneeded = () => request.result.createObjectStore(store, {
                keyPath: shippingDraftWriter && store === 'drafts' ? 'session_uuid' : 'id',
                autoIncrement: shippingDraftWriter && store === 'actions',
              });
              request.onsuccess = () => { request.result.close(); resolve(); };
              request.onerror = () => reject(request.error);
            });
          }
          for (const key of keys.CUSTODIAL_DEVICE_KEYS) localStorage.setItem(key, deviceId);
          localStorage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY, installation.installation_seal);
        }
        const readOrWrite = async (write = null) => {
          const existing = await indexedDB.databases();
          if (!existing.some(db => db.name === 'mz_scan_queue')) throw Error('Existing sandbox queue unavailable');
          const db = await new Promise((resolve, reject) => {
            const request = track(indexedDB.open('mz_scan_queue'));
            request.onupgradeneeded = () => { request.transaction.abort(); reject(Error('No absent database creation')); };
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
          });
          try {
            return await new Promise((resolve, reject) => {
              const tx = db.transaction('actions', write ? 'readwrite' : 'readonly');
              const store = tx.objectStore('actions'), request = write ? store.put(write) : store.getAll();
              let value;
              request.onsuccess = () => { value = request.result; };
              tx.oncomplete = () => resolve(value);
              tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('Sandbox transaction aborted'));
            });
          } finally { db.close(); }
        };
        const facade = {
          async databases() {
            const list = await indexedDB.databases();
            if (audit.deferInspection && ++catalogueReads === 2) {
              audit.inspectionWaiting = true; await inspectionResume.promise;
            }
            return list;
          },
          open(name) { audit.inspectionOpens++; return track(indexedDB.open(name)); },
        };
        const gate = createProtectedBrowserAdmission({ storage: localStorage, sessionStorage, indexedDb: facade,
          locks: navigator.locks, cryptoApi: crypto });
        const heldByCallback = async () => {
          const snapshot = await navigator.locks.query();
          if (!leaseActive || !snapshot.held.some(lock => lock.name === PROTECTED_BROWSER_LOCK && lock.mode === 'exclusive')) {
            throw Error('Original callback lost real shared browser lease');
          }
        };
        // Fixed fixture operation at its actual source factory; browser crypto
        // is untouched and the source creates its journal under its own lease.
        const sourceCrypto = { randomUUID: () => operationId, getRandomValues: array => crypto.getRandomValues(array) };
        const owner = createCustodialCredentialStore({ storage: localStorage, indexedDb: facade, cryptoApi: sourceCrypto,
          secureStorage: {
            async get(key) { return key === keys.CUSTODIAL_INSTALLATION_RECORD_KEY ? protectedRecord : null; },
            async set() { throw Error('Unexpected protected fixture write'); },
            async remove() { throw Error('Unexpected protected fixture remove'); },
            async finalizeRemoval(requested, requestedDevice) {
              if (closing) throw Error('Fixture cleanup closed');
              await heldByCallback(); audit.finalizerCalls++;
              if (requested !== operationId || requestedDevice !== deviceId) throw Error('Original finalizer identity changed');
              const journal = JSON.parse(localStorage.getItem(keys.CUSTODIAL_REMOVAL_OPERATION_KEY));
              if (journal.operation_id !== operationId || journal.phase !== 'server_logged_out') throw Error('Original journal changed');
              for (const key of keys.CUSTODIAL_DEVICE_KEYS) if (localStorage.getItem(key) !== null) throw Error('Cleanup not complete');
              protectedRecord = null; await heldByCallback();
            },
          },
          protectedWorkAdmission: operation => {
            audit.admissionAttempted = true;
            return gate.mutate(async () => {
              leaseActive = true;
              try { return await operation(); }
              finally { if (role === 'removal') audit.removalDecided = true; leaseActive = false; }
            });
          },
          protectedWorkCheckpoint: () => gate.requireAdmission(),
        });
        await owner.ensureSecurityState();
        const row = { id: 94, type: 'commit_workflow', operation_id: '78000000-0000-4000-8000-000000000003',
          state: 'pending', payload: { p_device_id: deviceId, p_client_completion_id: '78000000-0000-4000-8000-000000000004' } };
        window.__participatingRemovalBrowser = {
          audit, keys, holdKey: PROTECTED_BROWSER_HOLD_KEY, lockName: PROTECTED_BROWSER_LOCK,
          createdSandbox: role === 'removal', rowWire: JSON.stringify(row),
          async rows() { return readOrWrite(); },
          locks: () => navigator.locks.query(),
          releaseInspection: () => inspectionResume.resolve(), releaseWriter: () => writerResume.resolve(),
          async startRemoval({ defer = false, refuse = false } = {}) {
            audit.deferInspection = defer; catalogueReads = 0;
            this.removal = owner.removeEnrollment({ beforeRemove: async ({ operationId: requested, deviceId: requestedDevice, checkpoint }) => {
              if (closing) throw Error('Fixture cleanup closed');
              await heldByCallback(); audit.remoteCalls++;
              if (requested !== operationId || requestedDevice !== deviceId) throw Error('Original handoff identity changed');
              if (refuse) throw Object.assign(Error('Synthetic native handoff refused'), { code: 'fixture_native_refused' });
              await checkpoint('server_logged_out'); await heldByCallback();
            } }).then(value => { audit.result = { ok: true, removed: value.removed }; }, error => {
              audit.result = { ok: false, code: error.code, counts: error.preservedCounts || null };
            });
          },
          async startWriter({ defer = false } = {}) {
            this.writer = owner.runWhenReady(async context => {
              await heldByCallback(); context.assertCurrent(); audit.writerWaiting = defer;
              if (defer) await writerResume.promise;
              if (closing) throw Error('Fixture cleanup closed');
              context.assertCurrent(); audit.producerCalls++; await readOrWrite(row); context.assertCurrent();
            }, { requireEnrollment: true, expectedGeneration: owner.getGeneration() }).then(() => {
              audit.writerResult = { ok: true };
            }, error => { audit.writerResult = { ok: false, code: error.code }; });
          },
          rawJournal: () => localStorage.getItem(keys.CUSTODIAL_REMOVAL_OPERATION_KEY),
          rawCompletion: () => localStorage.getItem(keys.CUSTODIAL_REMOVAL_COMPLETION_KEY),
          setHold(raw) { localStorage.setItem(PROTECTED_BROWSER_HOLD_KEY, raw); },
          rawHold: () => localStorage.getItem(PROTECTED_BROWSER_HOLD_KEY),
          close() { closing = true; inspectionResume.resolve(); writerResume.resolve(); for (const db of connections) db.close(); },
        };
        if (durableEpochWriter) {
          // Purpose-local controls around the ACTUAL source credential owner
          // and admission. Never invoke the synthetic removal/finalizer path.
          window.__participatingRemovalBrowser.writeOriginalEpochFixture = value => owner.runWhenReady(context => {
            context.assertCurrent();
            localStorage.setItem('session:browser-epoch-fixture', value);
            context.assertCurrent();
          }, { requireEnrollment: true, expectedGeneration: owner.getGeneration() });
        }
        if (queuedOriginalOwner) {
          const fixture = window.__participatingRemovalBrowser;
          // Purpose-specific ephemeral fixture controls, NOT app/native APIs or
          // authority. Both documents hold their own synthetic protected store;
          // update those fixed fixtures explicitly, never a real credential.
          fixture.protectedFixtureWire = () => protectedRecord;
          fixture.compatibilityFixtureWire = () => JSON.stringify(Object.fromEntries([
            ...keys.CUSTODIAL_DEVICE_KEYS.map(key => [key, localStorage.getItem(key)]),
            [keys.CUSTODIAL_INSTALLATION_MARKER_KEY, localStorage.getItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY)],
          ]));
          fixture.replaceWithFixtureSuccessor = () => {
            const successor = { ...installation, device_id: 'KIOSK_09',
              credential: 'synthetic-browser-successor-fixture-only',
              installation_seal: 'synthetic-browser-successor-seal-12345678',
              principal: { ...installation.principal, device_id: 'KIOSK_09',
                employee_id: '78000000-0000-4000-8000-000000000009',
                credential_id: '78000000-0000-4000-8000-000000000010', assignment_epoch: 2,
                installation_seal: 'synthetic-browser-successor-seal-12345678' },
            };
            protectedRecord = JSON.stringify(successor);
            for (const key of keys.CUSTODIAL_DEVICE_KEYS) localStorage.setItem(key, successor.device_id);
            localStorage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY, successor.installation_seal);
            return protectedRecord;
          };
          fixture.startOwnerLease = async () => {
            fixture.writer = owner.runWhenReady(async context => {
              await heldByCallback(); context.assertCurrent(); audit.ownerLeaseWaiting = true;
              await writerResume.promise;
              if (closing) throw Error('Fixture cleanup closed');
              context.assertCurrent(); await heldByCallback();
            }, { requireEnrollment: true, expectedGeneration: owner.getGeneration() }).then(() => {
              audit.ownerLeaseResult = { ok: true };
            }, error => { audit.ownerLeaseResult = { ok: false, code: error.code }; });
          };
        }
        if (shippingDraftWriter) {
          const fixture = window.__participatingRemovalBrowser;
          fixture.draftRows = async () => {
            if (!(await indexedDB.databases()).some(db => db.name === 'mz_scan_completion_drafts')) {
              throw Error('Already-created sandbox drafts unavailable');
            }
            const db = await new Promise((resolve, reject) => {
              const request = track(indexedDB.open('mz_scan_completion_drafts'));
              request.onupgradeneeded = () => { request.transaction.abort(); reject(Error('No absent draft database creation')); };
              request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
            });
            try {
              return await new Promise((resolve, reject) => {
                const tx = db.transaction('drafts', 'readonly'), request = tx.objectStore('drafts').getAll();
                let rows;
                request.onsuccess = () => { rows = request.result; };
                tx.oncomplete = () => resolve(rows);
                tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('Draft observation aborted'));
              });
            } finally { db.close(); }
          };
          if (role === 'writer') {
            audit.workerMutationEntered = 0; audit.draftAttempted = false; audit.draftResult = null; audit.recoveryCalls = 0;
            // Existing supported worker interface delegates to the ACTUAL source
            // owner. No substitute checkpoint, locks, IDB or browser crypto.
            window.MemphisCustodialSecurity = Object.freeze({
              native: true,
              getStatus: owner.getStatus,
              waitForStableState: owner.waitForStableState,
              mutateProtectedWork: (operation, options) => owner.runWhenReady(async context => {
                await heldByCallback(); context.assertCurrent(); audit.workerMutationEntered++;
                const result = await operation(context);
                context.assertCurrent(); await heldByCallback(); return result;
              }, options),
            });
            // Synthetic unresolved startup classifier, NEVER an accepted
            // authority snapshot/START/FINISH or a release of the recovery gate.
            window.MemphisMobile = Object.freeze({ ready: Promise.resolve(),
              reconcileRecoveredPreStart: async () => { audit.recoveryCalls++; return { state: 'manager_required' }; },
            });
            fixture.startDraft = async input => {
              audit.draftAttempted = true;
              fixture.writer = window.MemphisScanSync.saveCompletionDraft(input).then(record => {
                audit.draftResult = { ok: true, record };
              }, error => { audit.draftResult = { ok: false, code: error.code }; });
            };
          }
        }
      }, { role, pins: PARTICIPATING_SOURCE_PINS, deviceId: DEVICE_ID, shippingDraftWriter, queuedOriginalOwner, durableEpochWriter });
    }
    if (shippingDraftWriter) {
      const writer = pages[1];
      await writer.evaluate(async expected => {
        const response = await fetch('/memphis-scan-sync.js', { cache: 'no-store' });
        if (!response.ok) throw Error('Shipping scan worker source unavailable');
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer())))
          .map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (digest !== expected) throw Error('Shipping scan worker changed; exact source rebind required');
      }, SCAN_DRAFT_SOURCE_PIN);
      await writer.addScriptTag({ url: `${baseURL}/memphis-scan-sync.js` });
      await writer.evaluate(async () => {
        if (await window.MemphisScanSync?.ready !== true) throw Error('Shipping scan worker normal initialization refused');
        const recovery = await window.MemphisScanSync.reconcileStartupRecovery();
        if (recovery?.state !== 'manager_required') throw Error('Unresolved startup recovery was not preserved');
        const existingNames = (await indexedDB.databases()).map(db => db.name).sort();
        if (JSON.stringify(existingNames) !== JSON.stringify(['mz_scan_completion_drafts', 'mz_scan_queue'])) {
          throw Error('Normal initialization left an unexpected sandbox database; preserve and diagnose');
        }
        const schemas = [];
        for (const [name, store] of [['mz_scan_queue', 'actions'], ['mz_scan_completion_drafts', 'drafts']]) {
          if (!(await indexedDB.databases()).some(db => db.name === name)) throw Error('Normal initialized sandbox schema missing');
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(name);
            request.onupgradeneeded = () => { request.transaction.abort(); reject(Error('Schema observation cannot create a database')); };
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
          });
          try {
            const objectStore = db.transaction(store, 'readonly').objectStore(store);
            schemas.push({ name, version: db.version, keyPath: objectStore.keyPath,
              autoIncrement: objectStore.autoIncrement, indexes: Array.from(objectStore.indexNames) });
          } finally { db.close(); }
        }
        const fixture = window.__participatingRemovalBrowser;
        fixture.schemas = schemas;
        fixture.audit.workerMutationEntered = 0;
        fixture.audit.admissionAttempted = false;
      });
    }
    return { context, pages, unexpected, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

test('BROWSER_ACTIVE_WRITER_RUNTIME_NEW browser: shipping runtime requires live mutation owner for protected Storage', async ({ browser, baseURL }) => {
  expect(baseURL).toBe('http://127.0.0.1:43891');
  const context=await browser.newContext({serviceWorkers:'block'}),unexpected=[];
  try{
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==baseURL||route.request().method()!=='GET'){unexpected.push(url.href);return route.abort();}
      if(url.pathname==='/start_page1.html'&&url.searchParams.has('active-writer-runtime-fixture'))
        return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Original writer runtime fixture</title>'});
      if(/^\/mobile\/src\/custodial\/[a-z0-9-]+\.js$/.test(url.pathname))return route.continue();
      unexpected.push(url.pathname);return route.abort();
    });
    const page=await context.newPage();await page.goto('/start_page1.html?active-writer-runtime-fixture');
    const result=await page.evaluate(async()=>{
      // Real shipping runtime/credential owner/firewall/Web Locks/Storage.
      // SecureStorage here is a fixed synthetic installation, not Android,
      // a genuine named manager or an admitted removal/finalizer capability.
      const keys=await import('/mobile/src/custodial/security-keys.js');
      const installation={schema_version:1,credential:'synthetic-browser-protected-fixture-only',device_id:'KIOSK_08',
        installation_seal:'synthetic-browser-installation-seal-12345678',enrolled_at:'2026-08-01T17:00:00.000Z',
        enrollment_operation_id:'78000000-0000-4000-8000-000000000002',migrated_from_credential_only_state:false};
      installation.principal={schema_version:'custodial-protected-principal.v1',device_id:installation.device_id,
        employee_id:'78000000-0000-4000-8000-000000000007',credential_id:'78000000-0000-4000-8000-000000000008',
        credential_operation_id:installation.enrollment_operation_id,assignment_epoch:1,
        installation_seal:installation.installation_seal,enrolled_at:installation.enrolled_at};
      for(const key of keys.CUSTODIAL_DEVICE_KEYS)localStorage.setItem(key,installation.device_id);
      localStorage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY,installation.installation_seal);
      localStorage.setItem('session:active-writer-fixture','original');
      let protectedEffects=0;
      const {getCustodialBridgeSecurityRuntime}=await import('/mobile/src/custodial/security-runtime.js');
      const runtime=getCustodialBridgeSecurityRuntime({secureStorage:{
        get:async key=>key===keys.CUSTODIAL_INSTALLATION_RECORD_KEY?JSON.stringify(installation):null,
        set:async()=>{protectedEffects++;throw Error('Unexpected secure write');},
        remove:async()=>{protectedEffects++;throw Error('Unexpected secure remove');}
      }});
      await runtime.security.ready;const status=await runtime.security.waitForStableState({requireEnrollment:true});
      const refused=[];
      const deny=effect=>{try{effect();refused.push(false);}catch(error){refused.push(error.code==='custodial_protected_state_read_only');}};
      deny(()=>localStorage.setItem('session:active-writer-fixture','outside'));
      deny(()=>{localStorage['session:active-writer-fixture']='outside';});
      deny(()=>sessionStorage.setItem('mz_employee_feedback_outbox:active-writer-fixture','outside'));
      let activeLock=false;
      await runtime.security.mutateProtectedWork(async owner=>{
        owner.assertCurrent();
        activeLock=(await navigator.locks.query()).held.some(x=>x.name==='memphis-custodial-protected-browser-work.v1'&&x.mode==='exclusive');
        localStorage.setItem('session:active-writer-fixture','admitted');await Promise.resolve();owner.assertCurrent();
        sessionStorage['mz_employee_feedback_outbox:active-writer-fixture']='original under same owner';
      },{requireEnrollment:true,expectedGeneration:status.generation});
      deny(()=>localStorage.removeItem('session:active-writer-fixture'));
      deny(()=>{delete sessionStorage['mz_employee_feedback_outbox:active-writer-fixture'];});
      return {ready:status.ready,refused,activeLock,epoch:localStorage.getItem('mz_custodial_protected_browser_mutation.v1'),
        original:localStorage.getItem('session:active-writer-fixture'),secondary:sessionStorage.getItem('mz_employee_feedback_outbox:active-writer-fixture'),
        heldAfter:(await navigator.locks.query()).held.length,protectedEffects};
    });
    expect(result).toEqual({ready:true,refused:[true,true,true,true,true],activeLock:true,epoch:'1',original:'admitted',
      secondary:'original under same owner',heldAfter:0,protectedEffects:0});
    expect(unexpected).toEqual([]);
  }finally{await context.close();}
});

test('BROWSER_MUTATION_EPOCH_NEW browser: original writer attempt survives restored bytes and reload', async ({ browser, baseURL }) => {
  const f = await participatingBrowserPages(browser, baseURL, { queuedOriginalOwner: true, durableEpochWriter: true });
  const [first, second] = f.pages;
  try {
    await first.evaluate(() => window.__participatingRemovalBrowser.writeOriginalEpochFixture('original bytes'));
    const before = await first.evaluate(async () => {
      const { observeProtectedBrowserWork } = await import('/mobile/src/custodial/protected-browser-inventory.js');
      return observeProtectedBrowserWork({ storage: localStorage, sessionStorage, indexedDb: indexedDB, cryptoApi: crypto });
    });
    expect(before.state).toBe('OBSERVED_NOT_FROZEN');
    await second.evaluate(() => window.__participatingRemovalBrowser.writeOriginalEpochFixture('intervening bytes'));
    await first.evaluate(() => window.__participatingRemovalBrowser.writeOriginalEpochFixture('original bytes'));
    const after = await first.evaluate(async () => {
      const { observeProtectedBrowserWork } = await import('/mobile/src/custodial/protected-browser-inventory.js');
      const { PROTECTED_BROWSER_MUTATION_KEY } = await import('/mobile/src/custodial/protected-browser-admission.js');
      return { observation: await observeProtectedBrowserWork({ storage: localStorage, sessionStorage, indexedDb: indexedDB, cryptoApi: crypto }),
        epoch: localStorage.getItem(PROTECTED_BROWSER_MUTATION_KEY), original: localStorage.getItem('session:browser-epoch-fixture') };
    });
    expect(after.original).toBe('original bytes');expect(after.epoch).toBe('3');
    expect(after.observation.state).toBe('OBSERVED_NOT_FROZEN');
    expect(after.observation.observation_sha256).not.toBe(before.observation_sha256);
    for (const page of f.pages) {
      const audit = await page.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.remoteCalls).toBe(0);expect(audit.finalizerCalls).toBe(0);
    }
    // Close this fixture's source owner before document replacement. The
    // browser's actual Storage, not a Map or substituted transaction, survives.
    await second.evaluate(() => window.__participatingRemovalBrowser.close());
    await second.reload({ waitUntil: 'load' });
    const restarted = await second.evaluate(async () => {
      const { createProtectedBrowserAdmission, PROTECTED_BROWSER_MUTATION_KEY } =
        await import('/mobile/src/custodial/protected-browser-admission.js');
      const before = localStorage.getItem(PROTECTED_BROWSER_MUTATION_KEY);
      const gate = createProtectedBrowserAdmission({ storage: localStorage, sessionStorage, indexedDb: indexedDB,
        locks: navigator.locks, cryptoApi: crypto });
      const original = await gate.mutate(() => localStorage.getItem('session:browser-epoch-fixture'));
      return { before, after: localStorage.getItem(PROTECTED_BROWSER_MUTATION_KEY), original };
    });
    expect(restarted).toEqual({ before: '3', after: '4', original: 'original bytes' });
    expect(f.unexpected).toEqual([]);
  } finally { await f.cleanup(); }
});

// Newly affected queued-removal original witness on real browser ownership;
// synthetic protected identities/native callbacks, never native removal proof.
test.describe('QUEUED_ORIGINAL_REMOVAL_BROWSER_NEW', () => {
  test('changed original owner while queued refuses before inspection and retains successor bytes', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL, { queuedOriginalOwner: true });
    const [removal, writer] = f.pages;
    try {
      await writer.evaluate(() => window.__participatingRemovalBrowser.startOwnerLease());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.ownerLeaseWaiting)).toBe(true);
      const before = await removal.evaluate(() => window.__participatingRemovalBrowser.audit.inspectionOpens);
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval());
      await expect.poll(() => removal.evaluate(async () => {
        const f = window.__participatingRemovalBrowser, locks = await f.locks();
        return locks.pending.filter(lock => lock.name === f.lockName).length;
      })).toBe(1);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.audit.inspectionOpens)).toBe(before);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawJournal())).toBeNull();
      const successor = await writer.evaluate(() => window.__participatingRemovalBrowser.replaceWithFixtureSuccessor());
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.replaceWithFixtureSuccessor())).toBe(successor);
      const compatibility = await removal.evaluate(() => window.__participatingRemovalBrowser.compatibilityFixtureWire());
      await writer.evaluate(() => window.__participatingRemovalBrowser.releaseWriter());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.ownerLeaseResult)).toEqual({ ok: false, code: 'custodial_security_state_unavailable' });
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result?.code)).toBe('custodial_security_generation_changed');
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.removalDecided).toBe(true); expect(audit.inspectionOpens).toBe(before);
      expect(audit.remoteCalls).toBe(0); expect(audit.finalizerCalls).toBe(0);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.protectedFixtureWire())).toBe(successor);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.protectedFixtureWire())).toBe(successor);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.compatibilityFixtureWire())).toBe(compatibility);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawJournal())).toBeNull();
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawCompletion())).toBeNull();
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rows())).toEqual([]);
      await expect.poll(() => removal.evaluate(async () => {
        const locks = await navigator.locks.query(); return locks.held.length + locks.pending.length;
      })).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });

  test('unchanged original queued owner completes only its own journal under the held lease', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL, { queuedOriginalOwner: true });
    const [removal, writer] = f.pages;
    try {
      await writer.evaluate(() => window.__participatingRemovalBrowser.startOwnerLease());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.ownerLeaseWaiting)).toBe(true);
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval());
      await expect.poll(() => removal.evaluate(async () => {
        const f = window.__participatingRemovalBrowser, locks = await f.locks();
        return locks.pending.filter(lock => lock.name === f.lockName).length;
      })).toBe(1);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.audit.remoteCalls)).toBe(0);
      await writer.evaluate(() => window.__participatingRemovalBrowser.releaseWriter());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.ownerLeaseResult)).toEqual({ ok: true });
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result)).toEqual({ ok: true, removed: true });
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.remoteCalls).toBe(1); expect(audit.finalizerCalls).toBe(1);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.protectedFixtureWire())).toBeNull();
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawJournal())).toBeNull();
      const completion = JSON.parse(await removal.evaluate(() => window.__participatingRemovalBrowser.rawCompletion()));
      expect(completion.operation_id).toBe('78000000-0000-4000-8000-000000000001');
      expect(completion.device_id).toBe(DEVICE_ID); expect(completion.status).toBe('local_cleanup_complete');
      await expect.poll(() => removal.evaluate(async () => {
        const locks = await navigator.locks.query(); return locks.held.length + locks.pending.length;
      })).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });

  test('queued original handoff refusal retains actor bytes and exact pending journal without finalization', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL, { queuedOriginalOwner: true });
    const [removal, writer] = f.pages;
    try {
      const original = await removal.evaluate(() => window.__participatingRemovalBrowser.protectedFixtureWire());
      const compatibility = await removal.evaluate(() => window.__participatingRemovalBrowser.compatibilityFixtureWire());
      await writer.evaluate(() => window.__participatingRemovalBrowser.startOwnerLease());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.ownerLeaseWaiting)).toBe(true);
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval({ refuse: true }));
      await expect.poll(() => removal.evaluate(async () => {
        const f = window.__participatingRemovalBrowser, locks = await f.locks();
        return locks.pending.filter(lock => lock.name === f.lockName).length;
      })).toBe(1);
      await writer.evaluate(() => window.__participatingRemovalBrowser.releaseWriter());
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result?.code)).toBe('fixture_native_refused');
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.remoteCalls).toBe(1); expect(audit.finalizerCalls).toBe(0);
      const pending = JSON.parse(await removal.evaluate(() => window.__participatingRemovalBrowser.rawJournal()));
      expect(pending.operation_id).toBe('78000000-0000-4000-8000-000000000001');
      expect(pending.device_id).toBe(DEVICE_ID); expect(pending.phase).toBe('pending_server_removal');
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.protectedFixtureWire())).toBe(original);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.compatibilityFixtureWire())).toBe(compatibility);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawCompletion())).toBeNull();
      await expect.poll(() => removal.evaluate(async () => {
        const locks = await navigator.locks.query(); return locks.held.length + locks.pending.length;
      })).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });
});

// NEW shipping producer coverage, not a replay of the four source-owner tests.
// Real Web Locks/IDB/crypto only when Main runs this selector. Protected storage
// and startup/native callbacks remain synthetic; a draft is NOT accepted work.
test.describe('SCAN_DRAFT_PARTICIPATION_BROWSER_NEW', () => {
  test('shipping saved original draft is counted and refuses removal before handoff', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL, { shippingDraftWriter: true });
    const [removal, writer] = f.pages;
    try {
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.schemas)).toEqual([
        { name: 'mz_scan_queue', version: 4, keyPath: 'id', autoIncrement: true, indexes: ['logical_key', 'next_attempt_at', 'state'] },
        { name: 'mz_scan_completion_drafts', version: 1, keyPath: 'session_uuid', autoIncrement: false, indexes: [] },
      ]);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.audit.recoveryCalls)).toBeGreaterThan(0);
      await writer.evaluate(input => window.__participatingRemovalBrowser.startDraft(input), SCAN_DRAFT_INPUT);
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.draftResult?.ok)).toBe(true);
      const record = await writer.evaluate(() => window.__participatingRemovalBrowser.audit.draftResult.record);
      expect(Object.keys(record).sort()).toEqual(['client_completion_id', 'contract_version', 'device_id', 'draft',
        'employee_id', 'integrity_sha256', 'location_code', 'saved_at', 'schema_version', 'session_uuid']);
      expect(record).toMatchObject({ ...SCAN_DRAFT_INPUT, schema_version: 1 });
      expect(record.saved_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      const expectedDigest = await writer.evaluate(async input => {
        // Fixed closed draft DTO, lexicographically ordered as its source codec;
        // real browser SHA, no invented server receipt or snapshot fields.
        const encoded = JSON.stringify({ client_completion_id: input.client_completion_id,
          contract_version: input.contract_version, device_id: input.device_id, draft: input.draft,
          employee_id: input.employee_id, location_code: input.location_code,
          schema_version: 1, session_uuid: input.session_uuid });
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encoded))))
          .map(byte => byte.toString(16).padStart(2, '0')).join('');
      }, SCAN_DRAFT_INPUT);
      expect(record.integrity_sha256).toBe(expectedDigest);
      expect(await writer.evaluate(input => window.MemphisScanSync.loadCompletionDraft(input), SCAN_DRAFT_INPUT)).toEqual(record);
      const original = await writer.evaluate(async () => JSON.stringify(await window.__participatingRemovalBrowser.draftRows()));
      expect(JSON.parse(original)).toEqual([record]);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.audit.workerMutationEntered)).toBe(2);
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval());
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result?.code)).toBe('custodial_pending_work');
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.result.counts.scan_queue).toBe(0);
      expect(audit.result.counts.scan_completion_drafts).toBe(1);
      expect(audit.result.counts.total_pending).toBe(1);
      expect(audit.remoteCalls).toBe(0); expect(audit.finalizerCalls).toBe(0);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawJournal())).toBeNull();
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawCompletion())).toBeNull();
      expect(await writer.evaluate(async () => JSON.stringify(await window.__participatingRemovalBrowser.draftRows()))).toBe(original);
      await expect.poll(() => removal.evaluate(async () => {
        const locks = await navigator.locks.query(); return locks.held.length + locks.pending.length;
      })).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });

  test('shipping other-document draft producer waits and refuses after original binding removal', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL, { shippingDraftWriter: true });
    const [removal, writer] = f.pages;
    try {
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval({ defer: true }));
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.inspectionWaiting)).toBe(true);
      await writer.evaluate(input => window.__participatingRemovalBrowser.startDraft(input), SCAN_DRAFT_INPUT);
      await expect.poll(() => writer.evaluate(async () => {
        const f = window.__participatingRemovalBrowser, locks = await f.locks();
        return locks.pending.some(lock => lock.name === f.lockName);
      })).toBe(true);
      const before = await writer.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(before.draftAttempted).toBe(true); expect(before.draftResult).toBeNull();
      expect(before.workerMutationEntered).toBe(0);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.draftRows())).toEqual([]);
      const held = await removal.evaluate(async () => {
        const f = window.__participatingRemovalBrowser, locks = await f.locks();
        return locks.held.filter(lock => lock.name === f.lockName && lock.mode === 'exclusive').length;
      });
      expect(held).toBe(1);
      await removal.evaluate(() => window.__participatingRemovalBrowser.releaseInspection());
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result)).toEqual({ ok: true, removed: true });
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.draftResult)).toEqual({ ok: false, code: 'custodial_security_state_unavailable' });
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.removalDecided).toBe(true); expect(audit.remoteCalls).toBe(1); expect(audit.finalizerCalls).toBe(1);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.audit.workerMutationEntered)).toBe(0);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.draftRows())).toEqual([]);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.rows())).toEqual([]);
      await expect.poll(() => removal.evaluate(async () => {
        const locks = await navigator.locks.query(); return locks.held.length + locks.pending.length;
      })).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });
});

test.describe('PARTICIPATING_REMOVAL_BROWSER_NEW', () => {
  test('real other-document writer waits through inspection and refuses changed binding', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL), [removal, writer] = f.pages;
    try {
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval({ defer: true }));
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.inspectionWaiting)).toBe(true);
      await writer.evaluate(() => window.__participatingRemovalBrowser.startWriter());
      await expect.poll(() => writer.evaluate(async () => {
        const f = window.__participatingRemovalBrowser, snapshot = await f.locks();
        return snapshot.pending.some(lock => lock.name === f.lockName);
      })).toBe(true);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.audit.producerCalls)).toBe(0);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rows())).toEqual([]);
      await removal.evaluate(() => window.__participatingRemovalBrowser.releaseInspection());
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result)).toEqual({ ok: true, removed: true });
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.writerResult)).toEqual({ ok: false, code: 'custodial_security_state_unavailable' });
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.remoteCalls).toBe(1); expect(audit.finalizerCalls).toBe(1); expect(audit.removalDecided).toBe(true);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.audit.producerCalls)).toBe(0);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.rows())).toEqual([]);
      await expect.poll(() => removal.evaluate(async () => (await navigator.locks.query()).held.length)).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });

  test('prior real admitted queue write remains original and stops removal', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL), [removal, writer] = f.pages;
    try {
      await writer.evaluate(() => window.__participatingRemovalBrowser.startWriter({ defer: true }));
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.writerWaiting)).toBe(true);
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval());
      await expect.poll(() => removal.evaluate(async () => (await navigator.locks.query()).pending.length)).toBe(1);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.audit.remoteCalls)).toBe(0);
      await writer.evaluate(() => window.__participatingRemovalBrowser.releaseWriter());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.writerResult)).toEqual({ ok: true });
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result?.code)).toBe('custodial_pending_work');
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.audit.result.counts.scan_queue)).toBe(1);
      expect(await writer.evaluate(async () => JSON.stringify((await window.__participatingRemovalBrowser.rows())[0])))
        .toBe(await writer.evaluate(() => window.__participatingRemovalBrowser.rowWire));
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.remoteCalls).toBe(0); expect(audit.finalizerCalls).toBe(0);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawCompletion())).toBeNull();
      await expect.poll(() => removal.evaluate(async () => (await navigator.locks.query()).held.length)).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });

  test('rejected synthetic native handoff releases real lease without losing journal or writer work', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL), [removal, writer] = f.pages;
    try {
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval({ refuse: true }));
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result?.code)).toBe('fixture_native_refused');
      const original = await removal.evaluate(() => window.__participatingRemovalBrowser.rawJournal());
      expect(JSON.parse(original).phase).toBe('pending_server_removal');
      await writer.evaluate(() => window.__participatingRemovalBrowser.startWriter());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.writerResult)).toEqual({ ok: true });
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawJournal())).toBe(original);
      expect(await writer.evaluate(async () => JSON.stringify((await window.__participatingRemovalBrowser.rows())[0])))
        .toBe(await writer.evaluate(() => window.__participatingRemovalBrowser.rowWire));
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.audit.finalizerCalls)).toBe(0);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawCompletion())).toBeNull();
      await expect.poll(() => removal.evaluate(async () => (await navigator.locks.query()).held.length)).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });

  test('closed original browser admission performs no inspection or callback and releases requests', async ({ browser, baseURL }) => {
    const f = await participatingBrowserPages(browser, baseURL), [removal, writer] = f.pages;
    try {
      const raw = '{retained original unknown browser preservation marker';
      await removal.evaluate(raw => window.__participatingRemovalBrowser.setHold(raw), raw);
      const before = await removal.evaluate(() => window.__participatingRemovalBrowser.audit.inspectionOpens);
      await removal.evaluate(() => window.__participatingRemovalBrowser.startRemoval());
      await expect.poll(() => removal.evaluate(() => window.__participatingRemovalBrowser.audit.result?.code)).toBe('custodial_browser_preservation_pending');
      await writer.evaluate(() => window.__participatingRemovalBrowser.startWriter());
      await expect.poll(() => writer.evaluate(() => window.__participatingRemovalBrowser.audit.writerResult?.code)).toBe('custodial_browser_preservation_pending');
      const audit = await removal.evaluate(() => window.__participatingRemovalBrowser.audit);
      expect(audit.inspectionOpens).toBe(before); expect(audit.remoteCalls).toBe(0); expect(audit.finalizerCalls).toBe(0);
      expect(await writer.evaluate(() => window.__participatingRemovalBrowser.audit.producerCalls)).toBe(0);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawHold())).toBe(raw);
      expect(await removal.evaluate(() => window.__participatingRemovalBrowser.rawCompletion())).toBeNull();
      await expect.poll(() => removal.evaluate(async () => {
        const locks = await navigator.locks.query(); return locks.held.length + locks.pending.length;
      })).toBe(0);
      expect(f.unexpected).toEqual([]);
    } finally { await f.cleanup(); }
  });
});

test('terminal bad code retires its native tombstone and corrected code succeeds with a fresh operation', async ({ page }) => {
  await page.addInitScript(({ deviceId }) => {
    const audit = { enrollmentOperations: [], confirmedOperations: [] };
    let state = {
      schema_version: 2,
      state: 'EMPTY',
      active: false,
      blocked: false,
      credential_present: false,
      enrollment_terminal: false,
      pending_operation_id: '',
      pending_device_id: '',
      pending_flow: '',
      removal_pending: false,
    };
    const installationFor = (operationId) => ({
      schema_version: 1,
      device_id: deviceId,
      installation_seal: `native-seal-${operationId}`,
      enrolled_at: '2026-08-01T17:00:00.000Z',
      migrated_from_credential_only_state: false,
      enrollment_operation_id: operationId,
    });
    const pendingState = (phase, operationId) => ({
      schema_version: 2,
      state: phase,
      active: false,
      blocked: false,
      credential_present: true,
      enrollment_terminal: false,
      pending_operation_id: operationId,
      pending_device_id: deviceId,
      pending_flow: 'enrollment',
      pending_server_confirmation: phase === 'PENDING_SERVER_CONFIRMATION',
      pending_enrollment: {
        operation_id: operationId,
        device_id: deviceId,
        flow: 'enrollment',
        credential_id: 'credential-row-safe-id',
        resume_expires_at: '2026-08-01T17:30:00.000Z',
      },
      installation: installationFor(operationId),
      removal_pending: false,
    });
    const activeState = (operationId) => ({
      schema_version: 2,
      state: 'ACTIVE',
      active: true,
      blocked: false,
      credential_present: true,
      enrollment_terminal: false,
      pending_operation_id: '',
      pending_device_id: '',
      pending_flow: '',
      pending_server_confirmation: false,
      active_enrollment_flow: 'enrollment',
      installation: installationFor(operationId),
      removal_pending: false,
    });
    const encode = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));

    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: [
          'getState',
          'enroll',
          'resumeEnrollment',
          'completeLocalBinding',
          'confirmEnrollment',
          'cancelEnrollment',
          'anchorOfflineAuthoritySnapshot',
          'authorizedRequest',
          'removeEnrollment',
          'finalizeRemoval',
        ].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options = {}) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') return Promise.resolve(structuredClone(state));
        if (method === 'enroll') {
          audit.enrollmentOperations.push(options.operation_id);
          if (audit.enrollmentOperations.length === 1) {
            state = {
              schema_version: 2,
              state: 'CANCELLED',
              active: false,
              blocked: false,
              credential_present: false,
              enrollment_terminal: true,
              cancelled_operation_id: options.operation_id,
              cancelled_device_id: deviceId,
              cancelled_enrollment: {
                operation_id: options.operation_id,
                device_id: deviceId,
                flow: 'enrollment',
                status: 'cancelled',
              },
              pending_operation_id: '',
              pending_device_id: '',
              pending_flow: '',
              removal_pending: false,
            };
            return Promise.reject(Object.assign(new Error('terminal enrollment rejection'), {
              code: 'custodial_native_enrollment_terminal',
              data: { status: 401, reason: 'invalid_enrollment_code' },
            }));
          }
          state = pendingState('CREDENTIAL_STAGED', options.operation_id);
          return Promise.resolve({
            status: 200,
            payload: {
              ok: true,
              data: {
                operation_id: options.operation_id,
                device_id: deviceId,
                flow: 'enrollment',
                credential_id: 'credential-row-safe-id',
                resume_expires_at: '2026-08-01T17:30:00.000Z',
                employee: { id: 'employee-safe-id', name: 'Karen Robinson' },
              },
            },
          });
        }
        if (method === 'completeLocalBinding') {
          state = pendingState('PENDING_SERVER_CONFIRMATION', options.operation_id);
          return Promise.resolve(structuredClone(state));
        }
        if (method === 'confirmEnrollment') {
          audit.confirmedOperations.push(options.operation_id);
          state = activeState(options.operation_id);
          return Promise.resolve(structuredClone(state));
        }
        if (method === 'anchorOfflineAuthoritySnapshot') {
          return Promise.resolve({ anchored: true });
        }
        if (method === 'authorizedRequest') {
          const path = String(options.path || '');
          const payload = path.startsWith('/schedule-api/my-day-summary')
            ? { ok: true, data: { groups: [] } }
            : path.startsWith('/scan-api/rpc')
              ? {
                  ok: true,
                  data: {
                    schema_version: 'offline-scan-snapshot.v2',
                    contract_version: 'scan.v4.snapshot-bound-authority',
                    snapshot_id: '8888888888888888888888888888888888888888888888888888888888888888',
                    canonical_device_id: deviceId,
                    employee_id: '00000000-0000-4000-8000-000000000808',
                    credential_id: '80000000-0000-4000-8000-000000000008',
                    employee_name: 'Karen Robinson',
                    assignment_epoch: 1,
                    generated_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
                    locations: [],
                  },
                }
              : { ok: true, data: {} };
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body_base64: encode(payload),
          });
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    window.__terminalEnrollmentAudit = audit;
  }, { deviceId: DEVICE_ID });

  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await expect(page.locator('#enrollment')).toBeVisible();
  await page.locator('#device-id').selectOption(DEVICE_ID);
  await page.locator('#code').fill('11111111');
  await page.locator('#enroll-submit').click();
  await expect(page.locator('#enroll-status')).toContainText('That manager code did not work');
  await expect.poll(() => page.evaluate(() => window.MemphisCustodialSecurity.getPendingEnrollmentOperation())).toBeNull();

  await page.locator('#code').fill('22222222');
  await page.locator('#enroll-submit').click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect(page.locator('.homeButton')).toHaveText(['Schedule', 'Messages', 'Events', 'Feedback']);
  const audit = await page.evaluate(() => window.__terminalEnrollmentAudit);
  expect(audit.enrollmentOperations).toHaveLength(2);
  expect(audit.enrollmentOperations[1]).not.toBe(audit.enrollmentOperations[0]);
  expect(audit.confirmedOperations).toEqual([audit.enrollmentOperations[1]]);
});

test('prepared recovery resumes an old active native binding only after manager code and native proof', async ({ page }) => {
  await page.addInitScript(({ deviceId }) => {
    const oldOperation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const recoveryOperation = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const recoveryId = 'server-rejected-recovery-proof';
    const seal = 'prepared-recovery-native-seal';
    const createdAt = '2026-08-25T18:00:00.000Z';
    const identity = {
      device_id: deviceId,
      canonical_device_id: deviceId,
      original_values: [deviceId],
    };
    localStorage.setItem('memphisAssignedDeviceId', deviceId);
    localStorage.setItem('mz_scan_device_id', deviceId);
    localStorage.setItem('mz_employee_hub_device_id', deviceId);
    localStorage.setItem('memphisZooCustodialInstallationSeal', seal);
    localStorage.setItem('memphisZooCustodialRecoveryRecord', JSON.stringify({
      schema_version: 1,
      recovery_id: recoveryId,
      status: 'pending_manager_recovery',
      reason: 'server_credential_rejected',
      created_at: createdAt,
      original_device_keys: { mz_scan_device_id: deviceId },
      original_identities: [identity],
      preserved_counts: { total_pending: 1 },
      details: { requested_by: 'protected_enrollment_runtime' },
    }));
    localStorage.setItem('memphisZooCustodialRestoreQuarantine', JSON.stringify({
      schema_version: 1,
      recovery_id: recoveryId,
      active: true,
      reason: 'server_credential_rejected',
      created_at: createdAt,
      original_device_keys: { mz_scan_device_id: deviceId },
      original_identities: [identity],
      preserved_counts: { total_pending: 1 },
    }));
    localStorage.setItem('memphisZooCustodialEnrollmentOperationV1', JSON.stringify({
      schema_version: 1,
      operation_id: recoveryOperation,
      flow: 'recovery',
      device_id: deviceId,
      recovery_id: recoveryId,
      status: 'pending_server',
      created_at: '2026-08-25T18:05:00.000Z',
    }));
    const installation = (operationId) => ({
      schema_version: 1,
      device_id: deviceId,
      installation_seal: seal,
      enrolled_at: createdAt,
      enrollment_operation_id: operationId,
      migrated_from_credential_only_state: false,
    });
    const activeState = (operationId, flow) => ({
      schema_version: 2,
      state: 'ACTIVE',
      revision: 10,
      active: true,
      blocked: false,
      credential_present: true,
      credential_usable: true,
      recovery_required: false,
      active_enrollment_flow: flow,
      installation: installation(operationId),
      removal_pending: false,
      removal_finalized: false,
    });
    const pendingState = (phase) => ({
      schema_version: 2,
      state: phase,
      revision: phase === 'CREDENTIAL_STAGED' ? 11 : 12,
      active: false,
      blocked: false,
      credential_present: true,
      pending_operation_id: recoveryOperation,
      pending_device_id: deviceId,
      pending_flow: 'recovery',
      pending_server_confirmation: phase === 'PENDING_SERVER_CONFIRMATION',
      pending_enrollment: {
        operation_id: recoveryOperation,
        device_id: deviceId,
        flow: 'recovery',
        credential_id: '80000000-0000-4000-8000-000000000008',
        recovery_id: recoveryId,
        resume_expires_at: '2026-08-25T18:30:00.000Z',
      },
      installation: installation(recoveryOperation),
      removal_pending: false,
    });
    let state = activeState(oldOperation, 'enrollment');
    const audit = { resumeCalls: 0, enrollCalls: 0, statusCalls: 0, confirmCalls: 0 };
    const encode = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: [
          'getState', 'reportRecoveryDiagnostic', 'authorizedRequest', 'resumeEnrollment',
          'enroll', 'completeLocalBinding', 'confirmEnrollment',
        ].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options = {}) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') return Promise.resolve(structuredClone(state));
        if (method === 'reportRecoveryDiagnostic') return Promise.resolve({ reported: true });
        if (method === 'authorizedRequest') {
          audit.statusCalls += 1;
          return Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body_base64: encode({ ok: true, data: {
              authenticated: false,
              enrollment_required: true,
              policy_mode: 'enforce',
              canonical_device_id: deviceId,
              credential_id: null,
            } }),
          });
        }
        if (method === 'resumeEnrollment') {
          audit.resumeCalls += 1;
          return Promise.reject(Object.assign(new Error('different active native operation'), {
            code: 'custodial_native_enrollment_conflict',
          }));
        }
        if (method === 'enroll') {
          audit.enrollCalls += 1;
          if (options.operation_id !== recoveryOperation || options.flow !== 'recovery' || options.enrollment_code !== '12345678') {
            return Promise.reject(new Error('recovery request mismatch'));
          }
          state = pendingState('CREDENTIAL_STAGED');
          return Promise.resolve({ status: 200, payload: { ok: true, data: {
            operation_id: recoveryOperation,
            device_id: deviceId,
            flow: 'recovery',
            credential_id: '80000000-0000-4000-8000-000000000008',
            resume_expires_at: '2026-08-25T18:30:00.000Z',
            employee: { id: 'employee-karen', name: 'Karen Robinson' },
          } } });
        }
        if (method === 'completeLocalBinding') {
          state = pendingState('PENDING_SERVER_CONFIRMATION');
          return Promise.resolve(structuredClone(state));
        }
        if (method === 'confirmEnrollment') {
          audit.confirmCalls += 1;
          state = activeState(recoveryOperation, 'recovery');
          return Promise.resolve(structuredClone(state));
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    window.__preparedRecoveryAudit = audit;
  }, { deviceId: DEVICE_ID });

  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await expect(page.getByRole('heading', { name: 'Finish phone recovery' })).toBeVisible();
  await expect(page.locator('#device-id')).toHaveValue(DEVICE_ID);
  await page.locator('#code').fill('12345678');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#employee-name')).toHaveText('Karen Robinson');
  await expect.poll(() => page.evaluate(() => window.MemphisCustodialSecurity.getPendingEnrollmentOperation())).toBeNull();
  const audit = await page.evaluate(() => window.__preparedRecoveryAudit);
  expect(audit.statusCalls).toBeGreaterThanOrEqual(1);
  expect(audit.resumeCalls).toBeGreaterThanOrEqual(1);
  expect(audit.enrollCalls).toBe(1);
  expect(audit.confirmCalls).toBe(1);
});

test('cancel response loss retires the exact pending journal in the first restored boot', async ({ page }) => {
  await page.addInitScript(({ deviceId }) => {
    const operationId = '12345678-1234-4123-8123-123456789abc';
    localStorage.setItem('memphisZooCustodialEnrollmentOperationV1', JSON.stringify({
      schema_version: 1,
      operation_id: operationId,
      flow: 'enrollment',
      device_id: deviceId,
      recovery_id: null,
      status: 'pending_server',
      created_at: '2026-08-01T18:00:00.000Z',
    }));
    let state = {
      schema_version: 2,
      state: 'CANCEL_REQUESTED',
      active: false,
      blocked: false,
      credential_present: true,
      enrollment_terminal: false,
      pending_operation_id: operationId,
      pending_device_id: deviceId,
      pending_flow: 'enrollment',
      pending_server_confirmation: false,
      pending_enrollment: {
        operation_id: operationId,
        device_id: deviceId,
        flow: 'enrollment',
      },
      installation: {
        schema_version: 1,
        device_id: deviceId,
        installation_seal: 'cancel-response-loss-native-seal',
        enrolled_at: '2026-08-01T18:00:01.000Z',
        enrollment_operation_id: operationId,
        migrated_from_credential_only_state: false,
      },
      removal_pending: false,
    };
    const audit = { resumeCalls: 0 };
    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [{
        name: 'CustodialNativeVault',
        methods: ['getState', 'resumeEnrollment'].map((name) => ({ name, rtype: 'promise' })),
      }],
      nativePromise(plugin, method, options = {}) {
        if (plugin !== 'CustodialNativeVault') return Promise.reject(new Error(`Unexpected native plugin ${plugin}`));
        if (method === 'getState') return Promise.resolve(structuredClone(state));
        if (method === 'resumeEnrollment') {
          audit.resumeCalls += 1;
          if (options.operation_id !== operationId) return Promise.reject(new Error('wrong cancellation operation'));
          state = {
            schema_version: 2,
            state: 'CANCELLED',
            active: false,
            blocked: false,
            credential_present: false,
            enrollment_terminal: true,
            cancelled_operation_id: operationId,
            cancelled_device_id: deviceId,
            cancelled_enrollment: {
              operation_id: operationId,
              device_id: deviceId,
              flow: 'enrollment',
              status: 'cancelled',
            },
            pending_operation_id: '',
            pending_device_id: '',
            pending_flow: '',
            removal_pending: false,
          };
          return Promise.reject(Object.assign(new Error('native cancellation completed'), {
            code: 'custodial_native_enrollment_cancelled',
          }));
        }
        return Promise.reject(new Error(`Unexpected CustodialNativeVault method ${method}`));
      },
    };
    window.__cancelResponseLossAudit = audit;
  }, { deviceId: DEVICE_ID });

  await page.goto(`/${OUTPUT_ROOT}/index.html`);
  await expect(page.locator('#enrollment')).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    pending: window.MemphisCustodialSecurity.getPendingEnrollmentOperation(),
    stored: localStorage.getItem('memphisZooCustodialEnrollmentOperationV1'),
    resumes: window.__cancelResponseLossAudit.resumeCalls,
  }))).toEqual({ pending: null, stored: null, resumes: 1 });
  await expect(page.locator('#enroll-submit')).toBeEnabled();
});

test('NATIVE_ORIGINAL_BROWSER_DATA_NEW browser: private CJS retains full original values before recheck', async ({ browser, baseURL }, testInfo) => {
  expect(baseURL, 'Main owns the unchanged normal browser/server route').toBe('http://127.0.0.1:43891');
  // Main explicitly permits route fulfillment at the genuine fixed app origin.
  // No TLS-error override, Location spoof, certificate or HTTPS server is used.
  const fixtureOrigin = 'https://localhost';
  const fs = require('node:fs'), path = require('node:path'), nodeCrypto = require('node:crypto');
  const mobileRoot = path.join(__dirname, '..', 'mobile');
  // Main seals the shipping source before execution. No build, import,
  // alternate source or fallback is performed during Source preparation.
  const sourcePath = path.join(mobileRoot, 'src/custodial/native-original-browser-preparation.js');
  const sourcePins = {
    'native-original-browser-preparation.js': '92ae738db024a84c63240f5433551a3bf436acaa0b368c7fc5931c6440c40d0c',
    'protected-browser-admission.js': 'c0e06e95b3938fd9e3cf4ff715820b5680b5c3cffc9c85792615ccf0359c859f',
    'protected-browser-inventory.js': '56d4917ee6e04b96dcf891f7c4d1c42d3cbeed17d060ac31471af35984fde826',
    'security-runtime.js': 'eee04da5d5ba282781e862f082bd224ef5c5502fd7ddff5dd6c167ddff41cbcf',
    'security-keys.js': '24883edc7a15e242f6a528990f944204151b56622c60db9b90ac46c41f7fc0b2',
    'credential-store.js': '3df780caf607fe404ce56928c90c9b7558c66d720dedecf1d02fcf3f6293d70f',
    'storage-firewall.js': '961a4b0750906c19974c44d2ce395ad25f5920002c55044c190860be46436b2c',
    'protected-principal.js': 'bf17128f92a9104d4febe8e2431c60f93dcdcc57b5e788dc7fdbd3905e0a6d37',
  };
  expect(sourcePins['native-original-browser-preparation.js'], 'Main must release the sealed DATA consumer before execution').toMatch(/^[a-f0-9]{64}$/);
  const sourceBytes = Object.fromEntries(Object.entries(sourcePins).map(([file, sha]) => {
    const bytes = fs.readFileSync(path.join(mobileRoot, 'src/custodial', file));
    expect(nodeCrypto.createHash('sha256').update(bytes).digest('hex'), 'Main Source binding: ' + file).toBe(sha);
    return [file, bytes];
  }));
  const { build } = require(require.resolve('esbuild', { paths: [mobileRoot] }));
  const bundled = await build({
    absWorkingDir: mobileRoot, entryPoints: [sourcePath], bundle: true,
    format: 'cjs', platform: 'browser', target: ['es2022'], write: false, minify: false,
  });
  expect(bundled.outputFiles).toHaveLength(1);
  for (const [file, bytes] of Object.entries(sourceBytes)) {
    expect(fs.readFileSync(path.join(mobileRoot, 'src/custodial', file)).equals(bytes), 'Source unchanged across normal bundling: ' + file).toBe(true);
  }
  const asset = bundled.outputFiles[0].text;
  expect(Buffer.byteLength(asset, 'utf8')).toBeLessThanOrEqual(2 * 1024 * 1024); // Native MAX_SCRIPT
  await testInfo.attach('actual-private-bootstrap-source-binding', {
    body: Buffer.from(JSON.stringify({
      source_sha256: nodeCrypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
      cjs_sha256: nodeCrypto.createHash('sha256').update(asset).digest('hex'),
      source_pins: sourcePins,
      scope: 'Normal shipping CJS source; native port/stamps below are SYNTHETIC, not Android authentication.',
    })), contentType: 'application/json',
  });
  const lockName = 'memphis-custodial-protected-browser-work.v1';
  const holdKey = 'mz_custodial_protected_browser_hold.v1', epochKey = 'mz_custodial_protected_browser_mutation.v1';
  const replyKeys = ['schema','command','reply_token','request_nonce','phase_nonce','operation_id','frame_sha256',
    'original_generation_id','native_mutation_stamp','state','observation','census','arguments_base64','reason'].sort();
  const dataReplyKeys = ['schema','command','reply_token','request_nonce','phase_nonce','operation_id','frame_sha256',
    'original_generation_id','native_mutation_stamp','state','data_frame','chunk_index','chunk_base64','reason'].sort();
  const frameKeys = ['schema','encoding','observation_sha256','frame_sha256','byte_count','chunk_bytes','chunk_count','record_count',
    'session_storage_state','chunk_sha256','native_authority','durable_retention','inventory_acknowledged','finalizer_allowed','key_removal'].sort();
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  // Independent, test-local reference for the complete known SYN fixture,
  // not a shipping parser, capture factory or caller-selected value subset.
  const taggedOriginal = value => {
    if (value === null) return ['null'];
    if (typeof value === 'string') return ['string', value];
    if (typeof value === 'boolean') return ['boolean', value];
    if (typeof value === 'number') { const b = Buffer.alloc(8); b.writeDoubleBE(value); return ['float64', b.toString('hex')]; }
    if (Array.isArray(value)) return ['array', value.map(taggedOriginal)];
    return ['object', Object.keys(value).sort().map(key => [key, taggedOriginal(value[key])])];
  };
  const expectedCompleteFrame = (observation, snapshot) => {
    const counts = Buffer.alloc(16);
    [snapshot.local.length, snapshot.session.length, 1, snapshot.local.length + snapshot.session.length + snapshot.rows.length]
      .forEach((count, index) => counts.writeInt32BE(count, 4 * index));
    const pieces = [Buffer.from('MZBRV001'), Buffer.from(observation.observation_sha256, 'hex'), counts];
    const u32 = n => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(n); return bytes; };
    const encode = value => {
      if (value === null) return pieces.push(Buffer.from([0]));
      if (typeof value === 'boolean') return pieces.push(Buffer.from([value ? 2 : 1]));
      if (typeof value === 'number') { const bytes = Buffer.alloc(9); bytes[0] = 3; bytes.writeDoubleBE(value, 1); return pieces.push(bytes); }
      if (typeof value === 'string') return pieces.push(Buffer.from([4]), u32(value.length), Buffer.from(value, 'utf16le').swap16());
      expect(Array.isArray(value)).toBe(true); pieces.push(Buffer.from([5]), u32(value.length)); value.forEach(encode);
    };
    encode([snapshot.local, snapshot.session,
      [[['mz_scan_queue', 4], [['actions', snapshot.rows.map(row => [taggedOriginal(row.id), taggedOriginal(row)])]]]]]);
    return Buffer.concat(pieces);
  };
  for (const scenario of ['healthy', 'epoch-withdrawal']) {
    const context = await browser.newContext({ serviceWorkers: 'block' }), unexpected = [], messages = [], accepted = [];
    const setupDiagnostics = [];
    let page, foreign, pending = null, phase = 'setup', originalDataFrame = null;
    const stamp = () => nodeCrypto.randomBytes(32).toString('hex');
    const grantToken = stamp(), replyToken = stamp(), requestNonce = stamp();
    const binding = {
      operation_id: scenario === 'healthy' ? '79000000-0000-4000-8000-000000000001' : '79000000-0000-4000-8000-000000000002',
      frame_sha256: 'c'.repeat(64), original_generation_id: '79000000-0000-4000-8000-000000000003',
      native_mutation_stamp: 'SYNTHETIC_ORIGINAL_NATIVE_FRAME_ONLY',
    };
    try {
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== fixtureOrigin || route.request().method() !== 'GET') { unexpected.push(url.href); return route.abort(); }
        if (url.pathname === '/start_page1.html' && ['owner', 'foreign', 'after-pagehide'].some(value => url.search === '?original-bootstrap-fixture=' + value)) {
          return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated original bootstrap fixture</title>' });
        }
        const file = url.pathname.startsWith('/mobile/src/custodial/') ? url.pathname.slice('/mobile/src/custodial/'.length) : '';
        if (!url.search && Object.hasOwn(sourceBytes, file)) {
          return route.fulfill({ contentType: 'application/javascript', body: sourceBytes[file] });
        }
        unexpected.push(url.pathname); return route.abort();
      });
      page = await context.newPage();
      page.on('console', message => {
        const text = message.text(), prefix = 'NATIVE_ORIGINAL_BOOTSTRAP_SETUP_STATUS ';
        if (text.startsWith(prefix) && text.length <= 32768) {
          try { setupDiagnostics.push(JSON.parse(text.slice(prefix.length))); } catch {}
        }
      });
      await page.exposeBinding('__recordOriginalBrowserNativeFixture', (_source, raw) => {
        // Recording model of the Native class's fixed source-stamp/phase checks.
        // Never a genuine Java/native acceptance result, signing or authorization.
        if (typeof raw !== 'string' || raw.length > 16 * 1024 * 1024) throw Error('Synthetic port message bound exceeded');
        let value; try { value = JSON.parse(raw); } catch { messages.push({ invalid: true }); return; }
        const entry = { value, accepted: false }; messages.push(entry);
        if (value?.schema === 'custodial.native-original-browser-bootstrap.v1') return;
        if (!pending || !value || Array.isArray(value)) return;
        const isData = ['DATA_FRAME','DATA_CHUNK'].includes(pending.command);
        if (Object.keys(value).sort().join('|') !== (isData ? dataReplyKeys : replyKeys).join('|')) return;
        if (value.schema !== (isData ? 'custodial.native-original-browser-data-response.v1' : 'custodial.native-original-browser-capture-response.v1') || value.reply_token !== replyToken
          || value.command !== pending.command || value.request_nonce !== requestNonce || value.phase_nonce !== pending.phaseNonce
          || Object.keys(binding).some(key => value[key] !== binding[key]) || value.reason !== '') return;
        const state = { CAPTURE: 'CAPTURED_RETAINED_NOT_AUTHORITY', RECHECK: 'RECHECKED_RETAINED_NOT_AUTHORITY',
          DATA_FRAME: 'VALUE_FRAME_RETAINED_NOT_AUTHORITY', DATA_CHUNK: 'VALUE_CHUNK_RETAINED_NOT_AUTHORITY' }[pending.command];
        if (value.state !== state) return;
        if (pending.command === 'DATA_FRAME' && (!value.data_frame || value.chunk_index !== null || value.chunk_base64 !== '')) return;
        if (pending.command === 'DATA_CHUNK' && (value.chunk_index !== pending.expectedIndex || typeof value.chunk_base64 !== 'string'
          || JSON.stringify(value.data_frame) !== JSON.stringify(originalDataFrame))) return;
        entry.accepted = true; accepted.push(entry); pending = null; // one source reply per actual Native phase
      });
      const injectedPort = function () {
        // Explicit SYNTHETIC native-injected object. Native event delivery is
        // simulated via a fixture-only DOM event, NOT window.postMessage.
        const target = new EventTarget(), record = globalThis.__recordOriginalBrowserNativeFixture;
        globalThis.custodialOriginalBrowserPreparation = {
          postMessage: raw => record(raw),
          addEventListener: target.addEventListener.bind(target),
          removeEventListener: target.removeEventListener.bind(target),
        };
        globalThis.addEventListener('__originalNativeFixtureDelivery', event =>
          target.dispatchEvent(new MessageEvent('message', { data: event.detail })));
      };
      // Byte-equivalent private module/exports scope from NativeOriginalBrowserPreparation.java.
      // It does NOT publish an installer, CJS module, tokens or capture getter.
      const nativeWrapper = "(()=>{'use strict';const module={exports:{}};const exports=module.exports;\n" + asset
        + "\nif(typeof module.exports.installNativeOriginalBrowserPreparation!=='function')throw Error('Original source unavailable');"
        + 'module.exports.installNativeOriginalBrowserPreparation({grantToken:' + JSON.stringify(grantToken)
        + ',replyToken:' + JSON.stringify(replyToken) + '});})();';
      await page.addInitScript({ content: '(' + injectedPort.toString() + ')();\n' + nativeWrapper });
      await page.goto(fixtureOrigin + '/start_page1.html?original-bootstrap-fixture=owner');
      expect(await page.evaluate(() => ({ origin: location.origin, secure: isSecureContext, mainFrame: top === globalThis })))
        .toEqual({ origin: fixtureOrigin, secure: true, mainFrame: true });
      // Source sends immediately and on pageshow; each HELLO must remain the
      // exact source-stamped DTO, not an invented exactly-once notification.
      await expect.poll(() => messages.filter(entry => entry.value?.schema === 'custodial.native-original-browser-bootstrap.v1').length).toBeGreaterThan(0);
      for (const { value: hello } of messages.filter(entry => entry.value?.schema === 'custodial.native-original-browser-bootstrap.v1')) {
        expect(Object.keys(hello).sort()).toEqual(['reply_token','schema']);
        expect(hello.reply_token).toBe(replyToken);
      }
      const privacy = await page.evaluate(({ grantToken, replyToken }) => ({
        installer: typeof globalThis.installNativeOriginalBrowserPreparation,
        module: typeof globalThis.module, exports: typeof globalThis.exports,
        tokenGlobal: Object.getOwnPropertyNames(globalThis).some(key => {
          const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
          return descriptor && Object.hasOwn(descriptor, 'value') && [grantToken, replyToken].includes(descriptor.value);
        }),
      }), { grantToken, replyToken });
      expect(privacy).toEqual({ installer: 'undefined', module: 'undefined', exports: 'undefined', tokenGlobal: false });

      const originalRows = await page.evaluate(async () => {
        if (!isSecureContext || !navigator.locks?.request || !indexedDB.databases) throw Error('Normal browser facilities unavailable');
        const keys = await import('/mobile/src/custodial/security-keys.js');
        const installation = { schema_version: 1, credential: 'synthetic-browser-protected-fixture-only', device_id: 'KIOSK_08',
          installation_seal: 'synthetic-browser-installation-seal-12345678', enrolled_at: '2026-08-01T17:00:00.000Z',
          enrollment_operation_id: '78000000-0000-4000-8000-000000000002', migrated_from_credential_only_state: false };
        installation.principal = { schema_version: 'custodial-protected-principal.v1', device_id: installation.device_id,
          employee_id: '78000000-0000-4000-8000-000000000007', credential_id: '78000000-0000-4000-8000-000000000008',
          credential_operation_id: installation.enrollment_operation_id, assignment_epoch: 1,
          installation_seal: installation.installation_seal, enrolled_at: installation.enrolled_at };
        for (const key of keys.CUSTODIAL_DEVICE_KEYS) localStorage.setItem(key, installation.device_id);
        localStorage.setItem(keys.CUSTODIAL_INSTALLATION_MARKER_KEY, installation.installation_seal);
        localStorage.setItem('session:original-bootstrap-fixture', 'before original live writer');
        sessionStorage.setItem('mz_phone_scan_resume:original-bootstrap-fixture', 'original secondary value');
        if ((await indexedDB.databases()).length !== 0) throw Error('Fresh fixture must not adopt existing databases');
        const args = suffix => ({
          p_device_id: suffix === '1' ? 'KIOSK_08' : 'KIOSK_09',
          p_client_session_id: '79000000-0000-4000-8000-00000000001' + suffix,
          p_client_completion_id: '79000000-0000-4000-8000-00000000002' + suffix,
          p_native_finish_scan_entry_id: '79000000-0000-4000-8000-00000000003' + suffix,
          p_client_started_at: '2026-08-01T17:00:00.000Z', p_client_ended_at: '2026-08-01T17:01:00.000Z',
          p_response_json: { note: suffix === '1' ? 'before writer' : 'foreign retained source-only value' },
        });
        let deepOriginal = 'original deep leaf\ud800';
        for (let i = 0; i < 63; i++) deepOriginal = { child: deepOriginal };
        const rows = [
          { id: 1, schema_version: 6, type: 'commit_workflow', operation_id: '79000000-0000-4000-8000-000000000021', payload: args('1') },
          { id: 2, schema_version: 6, type: 'commit_workflow', operation_id: '79000000-0000-4000-8000-000000000022', payload: args('2') },
          { id: 3, type: 'ping_device', opaque_original: ['retain', 'unknown'], whole_unselected_original: 'L'.repeat(600000) + '\udfff' },
          { id: 4, type: 'unknown_original_source', deep_original: deepOriginal },
        ];
        const open = () => new Promise((resolve, reject) => {
          const request = indexedDB.open('mz_scan_queue', 4);
          request.onupgradeneeded = () => request.result.createObjectStore('actions', { keyPath: 'id' });
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        const write = async values => {
          const db = await open();
          try { await new Promise((resolve, reject) => {
            const tx = db.transaction('actions', 'readwrite'); for (const row of values) tx.objectStore('actions').put(row);
            tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('Fixture write aborted'));
          }); } finally { db.close(); }
        };
        const { getCustodialBridgeSecurityRuntime } = await import('/mobile/src/custodial/security-runtime.js');
        let protectedEffects = 0;
        const runtime = getCustodialBridgeSecurityRuntime({ secureStorage: {
          get: async key => key === keys.CUSTODIAL_INSTALLATION_RECORD_KEY ? JSON.stringify(installation) : null,
          set: async () => { protectedEffects++; throw Error('Unexpected synthetic secure write'); },
          remove: async () => { protectedEffects++; throw Error('Unexpected synthetic secure remove'); },
        } });
        let status, setupPhase = 'original-enrollment-startup';
        try {
          // Startup inspects pending identities before it activates enrollment.
          // Retained foreign/unknown rows are a later synthetic census input,
          // not evidence permitting startup to adopt a mixed preserved owner.
          await runtime.security.ready;
          status = await runtime.security.waitForStableState({ requireEnrollment: true });
          setupPhase = 'original-owner-retained-row-seed';
          await runtime.security.mutateProtectedWork(async owner => {
            owner.assertCurrent();
            await write(rows); // includes foreign, unknown, and valid raw-depth64 originals
            owner.assertCurrent();
          }, { requireEnrollment: true, expectedGeneration: status.generation });
        } catch (error) {
          // Exact shipping status, SYNTHETIC installation only. Preserve the
          // original exception, never log a credential or replace its cause.
          try { console.error('NATIVE_ORIGINAL_BOOTSTRAP_SETUP_STATUS ' + JSON.stringify({
            phase: setupPhase, status: runtime.security.getStatus(),
          })); } catch {}
          throw error;
        }
        let release; const waiting = new Promise(resolve => { release = resolve; });
        const audit = { waiting: false, done: false, producerCalls: 0, blockedProducerCalls: 0 };
        let flight;
        globalThis.__originalBootstrapWriterFixture = Object.freeze({
          start() {
            if (flight) throw Error('Original writer already started');
            flight = runtime.security.mutateProtectedWork(async owner => {
              owner.assertCurrent(); audit.producerCalls++;
              rows[0].payload.p_response_json.note = 'same actual live original writer';
              await write([rows[0]]); owner.assertCurrent(); audit.waiting = true;
              await waiting; owner.assertCurrent();
              localStorage.setItem('session:original-bootstrap-fixture', 'same actual live original writer');
              owner.assertCurrent(); audit.done = true;
            }, { requireEnrollment: true, expectedGeneration: status.generation });
            flight.catch(() => {}); // assertion below awaits the original result, not suppressed PASS
          },
          release: () => release(),
          finish: () => flight,
          audit: () => ({ ...audit, protectedEffects }),
          async deniedWrite() {
            try {
              await runtime.security.mutateProtectedWork(owner => {
                owner.assertCurrent(); audit.blockedProducerCalls++;
                localStorage.setItem('session:original-bootstrap-fixture', 'must not replace held original');
              }, { requireEnrollment: true, expectedGeneration: status.generation });
              return { ok: true };
            } catch (error) { return { ok: false, code: error.code }; }
          },
          close: () => release(),
        });
        return rows;
      });
      const snapshot = () => page.evaluate(async () => {
        const entries = storage => Array.from({ length: storage.length }, (_, i) => storage.key(i))
          .sort().map(key => [key, storage.getItem(key)]);
        const rows = await new Promise((resolve, reject) => {
          const request = indexedDB.open('mz_scan_queue');
          request.onupgradeneeded = () => { request.transaction.abort(); reject(Error('No original database creation')); };
          request.onsuccess = () => {
            const db = request.result, tx = db.transaction('actions', 'readonly'), read = tx.objectStore('actions').getAll();
            let result; read.onsuccess = () => { result = read.result; };
            tx.oncomplete = () => { db.close(); resolve(result); };
            tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || Error('Original read failed')); };
          };
          request.onerror = () => reject(request.error);
        });
        return { local: entries(localStorage), session: entries(sessionStorage), rows };
      });
      const deliver = async raw => page.evaluate(message =>
        globalThis.dispatchEvent(new CustomEvent('__originalNativeFixtureDelivery', { detail: message })), JSON.stringify(raw));
      const send = async (command, expectedIndex) => {
        const phaseNonce = stamp();
        pending = command === 'CLOSE' ? null : { command, phaseNonce, expectedIndex };
        const raw = { schema: 'custodial.native-original-browser-capture-request.v1', command, grant_token: grantToken,
          request_nonce: requestNonce, phase_nonce: phaseNonce, ...binding };
        expect(Object.keys(raw).sort()).toEqual(['schema','command','grant_token','request_nonce','phase_nonce',
          'operation_id','frame_sha256','original_generation_id','native_mutation_stamp'].sort()); // no caller chunk index
        await deliver(raw); return raw;
      };
      const phaseReply = async request => {
        await expect.poll(() => messages.filter(entry => entry.value?.command === request.command
          && entry.value.request_nonce === requestNonce && entry.value.phase_nonce === request.phase_nonce).length).toBeGreaterThan(0);
        return messages.find(entry => entry.value?.command === request.command
          && entry.value.request_nonce === requestNonce && entry.value.phase_nonce === request.phase_nonce);
      };
      phase = 'live-original-writer';
      await page.evaluate(() => globalThis.__originalBootstrapWriterFixture.start());
      await expect.poll(() => page.evaluate(() => globalThis.__originalBootstrapWriterFixture.audit().waiting)).toBe(true);
      phase = 'capture-drains-writer';
      const captureRequest = await send('CAPTURE');
      await expect.poll(() => page.evaluate(async name => (await navigator.locks.query()).pending
        .filter(lock => lock.name === name).length, lockName)).toBeGreaterThan(0);
      expect(messages.filter(entry => entry.value?.command === 'CAPTURE')).toEqual([]);
      await page.evaluate(() => globalThis.__originalBootstrapWriterFixture.release());
      await page.evaluate(() => globalThis.__originalBootstrapWriterFixture.finish());
      const capture = await phaseReply(captureRequest);
      expect(capture.accepted).toBe(true);
      expect(capture.value.observation).toMatchObject({ state: 'OBSERVED_NOT_FROZEN', native_authority: false, frozen: false, acknowledged: false, phone_released: false });
      expect(capture.value.census).toMatchObject({
        state: 'WHOLE_CAPTURE_COMPLETION_CENSUS_NOT_AUTHENTICATED', argument_candidate_count: 2,
        primary_queue_row_count: 4, browser_inventory_state: 'UNKNOWN', native_semantic_inventory_state: 'UNKNOWN',
        native_authority: false, source_authenticated: false, frozen: false, complete_namespace_inventory: false,
        current_server_readback: false, cutoff_eligible: false, acknowledged: false, work_accepted: false, key_removal: false, phone_released: false,
      });
      expect(capture.value.arguments_base64).toHaveLength(2);
      originalRows[0].payload.p_response_json.note = 'same actual live original writer';
      capture.value.arguments_base64.forEach((encoded, index) => {
        const bytes = Buffer.from(encoded, 'base64'); expect(bytes.toString('base64')).toBe(encoded);
        expect(bytes.toString('utf8')).toBe(JSON.stringify(canonical(originalRows[index].payload)));
        expect(nodeCrypto.createHash('sha256').update(bytes).digest('hex')).toBe(capture.value.census.records
          .find(record => record.candidate_ordinal === index).argument_values_sha256);
        bytes.fill(0);
      });
      const capturedStorage = await snapshot();
      expect(capturedStorage.rows).toEqual(originalRows);
      expect(capturedStorage.local.find(([key]) => key === holdKey)[1]).toContain(binding.operation_id);
      expect(capturedStorage.local.find(([key]) => key === 'session:original-bootstrap-fixture')[1]).toBe('same actual live original writer');
      const denied = await page.evaluate(() => globalThis.__originalBootstrapWriterFixture.deniedWrite());
      expect(denied.ok).toBe(false);
      expect(await snapshot()).toEqual(capturedStorage);
      await page.evaluate(async frame => {
        const port = globalThis.custodialOriginalBrowserPreparation, lateOriginal = port.postMessage;
        await lateOriginal(JSON.stringify(frame)); // caller response has no private source reply stamp
        globalThis.__lateOriginalPortIntercepts = 0;
        port.postMessage = () => { globalThis.__lateOriginalPortIntercepts++; };
      }, { ...capture.value, reply_token: '0'.repeat(64) });
      phase = 'whole-original-data-frame';
      const frameRequest = await send('DATA_FRAME'), frameReply = await phaseReply(frameRequest);
      expect(Object.keys(frameReply.value).sort()).toEqual(dataReplyKeys);
      expect(frameReply.accepted).toBe(true);
      originalDataFrame = frameReply.value.data_frame;
      expect(Object.keys(originalDataFrame).sort()).toEqual(frameKeys);
      expect(originalDataFrame).toMatchObject({ schema: 'custodial.browser-original-value-frame.v1', encoding: 'MZBRV001',
        observation_sha256: capture.value.observation.observation_sha256, chunk_bytes: 1048576,
        record_count: capturedStorage.local.length + capturedStorage.session.length + originalRows.length,
        session_storage_state: 'CAPTURED_READ_ONLY_NOT_AUTHENTICATED', native_authority: false, durable_retention: false,
        inventory_acknowledged: false, finalizer_allowed: false, key_removal: false });
      expect(frameReply.value.chunk_index).toBeNull(); expect(frameReply.value.chunk_base64).toBe('');
      expect(Number.isSafeInteger(originalDataFrame.byte_count)).toBe(true);
      expect(originalDataFrame.byte_count).toBeGreaterThan(1048576);
      expect(originalDataFrame.byte_count).toBeLessThanOrEqual(64 * 1048576);
      expect(originalDataFrame.chunk_count).toBe(Math.ceil(originalDataFrame.byte_count / 1048576));
      expect(originalDataFrame.chunk_sha256).toHaveLength(originalDataFrame.chunk_count);
      expect(originalDataFrame.frame_sha256).toMatch(/^[a-f0-9]{64}$/);
      originalDataFrame.chunk_sha256.forEach(hash => expect(hash).toMatch(/^[a-f0-9]{64}$/));
      const chunksBase64 = [], ownedChunks = [];
      let lastRequest = frameRequest;
      phase = scenario === 'healthy' ? 'full-sequential-data-chunks' : 'original-epoch-withdrawal-before-chunk';
      if (scenario === 'epoch-withdrawal') {
        // A real second same-origin realm with no mounted cooperative firewall.
        // Foreign forward epoch mutation is a rejection input, NOT native authority.
        foreign = await context.newPage();
        await foreign.goto(fixtureOrigin + '/start_page1.html?original-bootstrap-fixture=foreign');
        await foreign.evaluate(key => localStorage.setItem(key, String(BigInt(localStorage.getItem(key)) + 1n)), epochKey);
      }
      const beforeTransfer = await snapshot();
      if (scenario === 'healthy') {
        let actual, expected;
        try {
          for (let index = 0; index < originalDataFrame.chunk_count; index++) {
            lastRequest = await send('DATA_CHUNK', index); // index stays in Node's SYN receiver, never request DTO
            const part = await phaseReply(lastRequest);
            expect(Object.keys(part.value).sort()).toEqual(dataReplyKeys);
            expect(part.accepted).toBe(true);
            expect(part.value.state).toBe('VALUE_CHUNK_RETAINED_NOT_AUTHORITY');
            expect(part.value.reason).toBe(''); expect(part.value.chunk_index).toBe(index);
            expect(JSON.stringify(part.value.data_frame)).toBe(JSON.stringify(originalDataFrame));
            const bytes = Buffer.from(part.value.chunk_base64, 'base64'); ownedChunks.push(bytes);
            expect(bytes.toString('base64')).toBe(part.value.chunk_base64);
            expect(bytes.length).toBe(Math.min(1048576, originalDataFrame.byte_count - index * 1048576));
            expect(nodeCrypto.createHash('sha256').update(bytes).digest('hex')).toBe(originalDataFrame.chunk_sha256[index]);
            chunksBase64.push(part.value.chunk_base64);
          }
          actual = Buffer.concat(ownedChunks);
          expect(actual.length).toBe(originalDataFrame.byte_count);
          expect(nodeCrypto.createHash('sha256').update(actual).digest('hex')).toBe(originalDataFrame.frame_sha256);
          expect(actual.subarray(0, 8).toString('ascii')).toBe('MZBRV001');
          expect(actual.subarray(8, 40).toString('hex')).toBe(capture.value.observation.observation_sha256);
          expect([40, 44, 48, 52].map(offset => actual.readInt32BE(offset))).toEqual([
            beforeTransfer.local.length, beforeTransfer.session.length, 1,
            beforeTransfer.local.length + beforeTransfer.session.length + beforeTransfer.rows.length,
          ]);
          expected = expectedCompleteFrame(capture.value.observation, beforeTransfer);
          expect(actual.equals(expected)).toBe(true); // every local/session value and ALL primary rows, not the census subset
          expect(beforeTransfer.rows.map(row => row.id)).toEqual([1, 2, 3, 4]);
          expect(beforeTransfer.rows[1].payload.p_device_id).toBe('KIOSK_09');
          expect(beforeTransfer.rows[2].whole_unselected_original).toBe('L'.repeat(600000) + '\udfff');
          let deep = beforeTransfer.rows[3].deep_original;
          for (let i = 0; i < 63; i++) deep = deep.child;
          expect(deep).toBe('original deep leaf\ud800');
          // Actual emitted Source bytes for Main's later Native-reader check.
          // This attachment does NOT authenticate the SYNTHETIC native port.
          await testInfo.attach('browser-original-value-source-fixture', {
            body: Buffer.from(JSON.stringify({ schema: 'custodial.browser-original-value-source-fixture.v1',
              source_sha256: sourcePins['native-original-browser-preparation.js'],
              observation: capture.value.observation, metadata: originalDataFrame, chunks_base64: chunksBase64 })),
            contentType: 'application/json',
          });
        } finally {
          ownedChunks.forEach(bytes => bytes.fill(0)); actual?.fill(0); expected?.fill(0);
        }
        phase = 'fresh-native-recheck-after-complete-data';
        lastRequest = await send('RECHECK'); const recheck = await phaseReply(lastRequest);
        expect(Object.keys(recheck.value).sort()).toEqual(replyKeys);
        expect(recheck.accepted).toBe(true);
        expect(JSON.stringify(recheck.value.observation)).toBe(JSON.stringify(capture.value.observation));
        expect(JSON.stringify(recheck.value.census)).toBe(JSON.stringify(capture.value.census));
        expect(recheck.value.arguments_base64).toEqual([]); // same retained census, no second inspect/retained list
        expect(accepted).toHaveLength(3 + originalDataFrame.chunk_count);
      } else {
        lastRequest = await send('DATA_CHUNK', 0); const refused = await phaseReply(lastRequest);
        expect(Object.keys(refused.value).sort()).toEqual(dataReplyKeys);
        expect(refused.accepted).toBe(false);
        expect(refused.value).toMatchObject({ schema: 'custodial.native-original-browser-data-response.v1',
          command: 'DATA_CHUNK', state: 'UNRESOLVED_RETAINED', data_frame: null, chunk_index: null,
          chunk_base64: '', reason: 'browser_original_values_unavailable' });
        expect(accepted).toHaveLength(2); // CAPTURE + manifest only, never partial DATA or a repaired/reissued capture
        await send('RECHECK'); // closed Source must NOT manufacture a later positive from its old census
        pending = null;
      }
      expect(await snapshot()).toEqual(beforeTransfer);
      expect(await page.evaluate(() => globalThis.__lateOriginalPortIntercepts)).toBe(0); // DATA/RECHECK used the document-start bound sender
      phase = 'caller-replay-and-close';
      pending = null;
      await deliver(lastRequest); // repeated old phase is not a new actual Native command
      await deliver({ ...lastRequest, grant_token: '0'.repeat(64), phase_nonce: stamp() });
      await send('CLOSE');
      await deliver({ ...lastRequest, command: 'DATA_CHUNK', phase_nonce: stamp() });
      await deliver({ ...lastRequest, command: 'RECHECK', phase_nonce: stamp() });
      expect(await page.evaluate(() => globalThis.__originalBootstrapWriterFixture.audit())).toMatchObject({
        done: true, producerCalls: 1, blockedProducerCalls: 0, protectedEffects: 0,
      });
      // Native.finish sends CLOSE without awaiting an ACK. Do not invent a
      // post-close command/response contract. Real pagehide/navigation revokes
      // the old document; durable hold and original Storage/IDB must survive.
      await page.goto(fixtureOrigin + '/start_page1.html?original-bootstrap-fixture=after-pagehide');
      expect(await snapshot()).toEqual(beforeTransfer);
      expect(accepted).toHaveLength(scenario === 'healthy' ? 3 + originalDataFrame.chunk_count : 2);
      for (const { value: hello } of messages.filter(entry => entry.value?.schema === 'custodial.native-original-browser-bootstrap.v1')) {
        expect(Object.keys(hello).sort()).toEqual(['reply_token','schema']);
        expect(hello.reply_token).toBe(replyToken);
      }
      for (const command of ['CAPTURE', 'DATA_FRAME']) {
        expect(messages.filter(entry => entry.value?.command === command && entry.value.reply_token === replyToken)).toHaveLength(1);
      }
      expect(messages.filter(entry => entry.value?.command === 'DATA_CHUNK' && entry.value.reply_token === replyToken))
        .toHaveLength(scenario === 'healthy' ? originalDataFrame.chunk_count : 1);
      expect(messages.filter(entry => entry.value?.command === 'RECHECK' && entry.value.reply_token === replyToken))
        .toHaveLength(scenario === 'healthy' ? 1 : 0);
      expect(unexpected).toEqual([]);
    } catch (error) {
      await testInfo.attach('native-original-bootstrap-failure-' + scenario, {
        body: Buffer.from(JSON.stringify({ phase, setupDiagnostics, messages, unexpected, originalFailure: String(error?.message || error).slice(0, 4000) }, null, 2)),
        contentType: 'application/json',
      }).catch(() => {});
      throw error;
    } finally {
      if (page && !page.isClosed()) await page.evaluate(() => globalThis.__originalBootstrapWriterFixture?.close()).catch(() => {});
      await context.close(); // closes all actual connections/documents/timers; no original record deletion or thaw
    }
  }
});
