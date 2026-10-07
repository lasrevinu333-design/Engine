/** Read-only, unmounted H04 browser inventory preparation.
 * Observing stable bytes twice is NOT an atomic freeze, native attestation,
 * authenticated employee identity, server ACK, empty-queue or phone-reuse proof.
 * The eventual owner must provide durable admission/quiescence and exact ACKs.
 * Never opens a missing database intentionally, upgrades it, or changes records.
 */
const SCHEMA = 'custodial.browser-protected-observation.v1';
const MAX_RECORDS = 4096;
const MAX_CHARACTERS = 16 * 1024 * 1024;
class InspectionFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new InspectionFailure(code); };
const ordered = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const names = (value) => Array.from(value).sort(ordered);

function budgetString(value, budget) {
  if (typeof value !== 'string' || value.length > 4 * 1024 * 1024) fail('unsupported_or_oversize_value');
  budget.characters += value.length;
  if (budget.characters > MAX_CHARACTERS) fail('inventory_size_limit');
  return value;
}
function encodedValue(value, budget, ancestors = new Set(), depth = 0) {
  if (++budget.nodes > 100000 || depth > 64) fail('inventory_complexity_limit');
  if (value === null) return ['null'];
  if (typeof value === 'string') return ['string', budgetString(value, budget)];
  if (typeof value === 'boolean') return ['boolean', value];
  if (typeof value === 'undefined') return ['undefined'];
  if (typeof value === 'number') {
    const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value, false);
    return ['float64', [...new Uint8Array(data.buffer)].map(v => v.toString(16).padStart(2, '0')).join('')];
  }
  if (typeof value !== 'object' || ancestors.has(value)) fail('unsupported_or_cyclic_value');
  if (value instanceof Date) {
    const instant = Date.prototype.getTime.call(value);
    if (!Number.isFinite(instant)) fail('invalid_date_value');
    return ['date', instant];
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (bytes.byteLength > MAX_CHARACTERS / 2) fail('inventory_size_limit');
    const hex = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
    return ['binary', Object.prototype.toString.call(value), budgetString(hex, budget)];
  }
  ancestors.add(value);
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_RECORDS || keys.some(key => typeof key !== 'string')) fail('unsupported_object_keys');
    if (Array.isArray(value)) {
      if (value.length > MAX_RECORDS || keys.some(key => key !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) fail('unsupported_array_shape');
      return ['array', Array.from({length:value.length}, (_, i) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor) return ['hole'];
        if (!Object.hasOwn(descriptor, 'value')) fail('accessor_value');
        return encodedValue(descriptor.value, budget, ancestors, depth + 1);
      })];
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail('unsupported_record_type');
    return ['object', keys.sort(ordered).map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('accessor_value');
      return [budgetString(key, budget), encodedValue(descriptor.value, budget, ancestors, depth + 1)];
    })];
  } finally { ancestors.delete(value); }
}

function localRows(storage, budget) {
  if (!storage || typeof storage.key !== 'function' || typeof storage.getItem !== 'function') fail('local_storage_unavailable');
  const count = storage.length;
  if (!Number.isInteger(count) || count < 0 || count > MAX_RECORDS) fail('local_storage_inventory_limit');
  const keys = new Set();
  for (let i = 0; i < count; i++) {
    const key = storage.key(i);
    if (typeof key !== 'string' || key.length > 1024 || keys.has(key)) fail('local_storage_changed');
    keys.add(key);
  }
  const rows = [...keys].sort(ordered).map(key => {
    const value = storage.getItem(key);
    if (typeof value !== 'string') fail('local_storage_changed');
    return [budgetString(key, budget), budgetString(value, budget)];
  });
  if (storage.length !== count) fail('local_storage_changed');
  return rows;
}

function bounded(promise, timeoutMs) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new InspectionFailure('storage_inspection_timeout')), timeoutMs);
  })]).finally(() => clearTimeout(timer));
}
async function databaseList(indexedDb, timeoutMs) {
  if (!indexedDb || typeof indexedDb.databases !== 'function' || typeof indexedDb.open !== 'function') fail('database_inventory_unavailable');
  const list = await bounded(indexedDb.databases(), timeoutMs);
  if (!Array.isArray(list) || list.length > 32) fail('database_inventory_limit');
  const seen = new Set();
  return list.map(item => {
    if (!item || typeof item.name !== 'string' || item.name.length > 1024 || seen.has(item.name)
      || !Number.isSafeInteger(item.version) || item.version < 1) fail('database_inventory_invalid');
    seen.add(item.name); return [item.name, item.version];
  }).sort((a,b) => ordered(a[0],b[0]));
}
function databaseRows(indexedDb, identity, budget, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false, database, transaction, request;
    const timer = setTimeout(() => finish(new InspectionFailure('storage_inspection_timeout')), timeoutMs);
    function finish(error, value) {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) try { transaction?.abort(); } catch {}
      try { database?.close(); } catch {}
      if (error) reject(error); else resolve(value);
    }
    try { request = indexedDb.open(identity[0]); } catch { finish(new InspectionFailure('database_open_failed')); return; }
    request.onblocked = () => finish(new InspectionFailure('database_blocked'));
    request.onerror = () => finish(new InspectionFailure('database_open_failed'));
    request.onupgradeneeded = () => {
      // The enumerated database disappeared/raced. Abort creation, never leave
      // an empty replacement behind or label it an empty successful inventory.
      database = request.result;
      try { request.transaction.abort(); } catch {}
      finish(new InspectionFailure('database_changed'));
    };
    request.onsuccess = () => {
      database = request.result;
      if (settled) { try { database?.close(); } catch {} return; }
      try {
        if (database.version !== identity[1]) fail('database_changed');
        database.onversionchange = () => finish(new InspectionFailure('database_changed'));
        const stores = names(database.objectStoreNames);
        if (stores.length > 128) fail('store_inventory_limit');
        if (!stores.length) { finish(null, [identity, []]); return; }
        const rows = stores.map(name => [budgetString(name, budget), []]);
        transaction = database.transaction(stores, 'readonly');
        transaction.onerror = transaction.onabort = () => finish(new InspectionFailure('database_read_failed'));
        transaction.oncomplete = () => finish(null, [identity, rows]);
        for (const [index, storeName] of stores.entries()) {
          const cursor = transaction.objectStore(storeName).openCursor();
          cursor.onerror = () => finish(new InspectionFailure('database_read_failed'));
          cursor.onsuccess = () => {
            if (settled) return;
            try {
              const current = cursor.result; if (!current) return;
              if (++budget.records > MAX_RECORDS) fail('record_inventory_limit');
              rows[index][1].push([encodedValue(current.primaryKey, budget), encodedValue(current.value, budget)]);
              current.continue();
            } catch (error) { finish(error); }
          };
        }
      } catch (error) { finish(error); }
    };
  });
}
async function observation(storage, indexedDb, remaining) {
  const budget = {characters:0, nodes:0, records:0};
  const local = localRows(storage, budget), list = await databaseList(indexedDb, remaining()), databases = [];
  for (const identity of list) databases.push(await databaseRows(indexedDb, identity, budget, remaining()));
  if (JSON.stringify(list) !== JSON.stringify(await databaseList(indexedDb, remaining()))
    || JSON.stringify(local) !== JSON.stringify(localRows(storage, {characters:0}))) fail('storage_changed');
  return {local, databases};
}
async function digest(value, cryptoApi) {
  const text = JSON.stringify(value), bytes = new Uint8Array(text.length * 2);
  // Lossless UTF-16, including malformed historical strings. UTF-8 replacement
  // would collapse distinct saved originals into the same inventory identity.
  for (let i=0;i<text.length;i++) { const c=text.charCodeAt(i); bytes[2*i]=c>>>8; bytes[2*i+1]=c&255; }
  const result = await cryptoApi.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map(v => v.toString(16).padStart(2,'0')).join('');
}

export async function observeProtectedBrowserWork({storage, indexedDb, cryptoApi=globalThis.crypto, timeoutMs=5000}={}) {
  const base = {schema:SCHEMA, browser_inventory_state:'UNKNOWN', native_authority:false,
    frozen:false, acknowledged:false, phone_released:false};
  try {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || !cryptoApi?.subtle?.digest
      || typeof globalThis.performance?.now !== 'function') fail('inspection_configuration_invalid');
    // One overall inspection budget, not a fresh full timeout for every store.
    // This clock bounds resource lifetime only; it is not cleaning-time proof.
    const deadline = performance.now() + timeoutMs;
    const remaining = () => { const ms=Math.ceil(deadline-performance.now());if(ms<=0)fail('storage_inspection_timeout');return ms; };
    const hash = value => bounded(digest(value,cryptoApi),remaining());
    const first = await observation(storage,indexedDb,remaining), second = await observation(storage,indexedDb,remaining);
    if (JSON.stringify(first) !== JSON.stringify(second)) fail('storage_changed');
    const records = [];
    for (const [key,value] of first.local) records.push(Object.freeze({store:'localStorage',key_sha256:await hash(key),body_sha256:await hash(value)}));
    for (const [identity,stores] of first.databases) for (const [store,rows] of stores) for (const [key,value] of rows)
      records.push(Object.freeze({store:'indexedDB',database:identity[0],version:identity[1],object_store:store,key_sha256:await hash(key),body_sha256:await hash(value)}));
    // A third observation after asynchronous hashes rejects ordinary changed
    // inputs. Still not a cross-store lock or protection from an ABA mutation.
    if (JSON.stringify(first) !== JSON.stringify(await observation(storage,indexedDb,remaining))) fail('storage_changed');
    const observationDigest = await hash([SCHEMA,first]);remaining();
    return Object.freeze({...base, state:'OBSERVED_NOT_FROZEN', observation_sha256:observationDigest,
      local_record_count:first.local.length,database_count:first.databases.length,record_count:records.length,records:Object.freeze(records)});
  } catch (error) {
    return Object.freeze({...base,state:'UNINSPECTABLE',reason:error instanceof InspectionFailure?error.code:'storage_read_failed'});
  }
}
