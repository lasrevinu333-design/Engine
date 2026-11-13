/** Read-only, unmounted H04 browser inventory preparation.
 * Observing stable bytes twice is NOT an atomic freeze, native attestation,
 * authenticated employee identity, server ACK, empty-queue or phone-reuse proof.
 * The eventual owner must provide durable admission/quiescence and exact ACKs.
 * Never opens a missing database intentionally, upgrades it, or changes records.
 */
const SCHEMA = 'custodial.browser-protected-observation.v1';
const MAX_RECORDS = 4096;
const MAX_CHARACTERS = 16 * 1024 * 1024;
// Opaque source observations only. No diagnostic JSON contains original values.
// Closing drops references; it cannot guarantee erasure of JavaScript strings.
const capturedValues = new WeakMap(), capturedCandidates = new WeakMap(), capturedCensuses = new WeakMap();
const capturedFeedbacks = new WeakMap();
class InspectionFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new InspectionFailure(code); };
const ordered = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const names = (value) => Array.from(value).sort(ordered);
// Read only native slots, never a saved value's buffer/range/tag properties.
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype), Bytes=Uint8Array,
 typedKind=Object.getOwnPropertyDescriptor(typedPrototype,Symbol.toStringTag).get,
 typedBuffer=Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get,
 typedOffset=Object.getOwnPropertyDescriptor(typedPrototype,'byteOffset').get,
 typedLength=Object.getOwnPropertyDescriptor(typedPrototype,'byteLength').get,
 viewBuffer=Object.getOwnPropertyDescriptor(DataView.prototype,'buffer').get,
 viewOffset=Object.getOwnPropertyDescriptor(DataView.prototype,'byteOffset').get,
 viewLength=Object.getOwnPropertyDescriptor(DataView.prototype,'byteLength').get,
 bufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get,
 bufferResizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get,
 sharedLength=typeof SharedArrayBuffer==='function'?Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype,'byteLength').get:null,
 isView=ArrayBuffer.isView,
 dateTime=Object.getOwnPropertyDescriptor(Date.prototype,'getTime').value,
 mapSize=Function.prototype.call.bind(Object.getOwnPropertyDescriptor(Map.prototype,'size').get),
 setSize=Function.prototype.call.bind(Object.getOwnPropertyDescriptor(Set.prototype,'size').get),
 regexpSource=Object.getOwnPropertyDescriptor(RegExp.prototype,'source').get,
 blobPresent=typeof Blob==='function',
 blobSize=blobPresent?Object.getOwnPropertyDescriptor(Blob.prototype,'size')?.get:null,
 typedKinds=new Set(['Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array','Int32Array','Uint32Array',
  'Float16Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array']);

function binaryValue(value,budget) {
  let kind,backing,offset,length;
  if(isView(value)) {
    kind=typedKind.call(value);
    try {
      if(kind!==undefined) {
        if(!typedKinds.has(kind))fail('unsupported_binary_type');
        backing=typedBuffer.call(value);offset=typedOffset.call(value);length=typedLength.call(value);
      } else {
        kind='DataView';backing=viewBuffer.call(value);offset=viewOffset.call(value);length=viewLength.call(value);
      }
    }catch(error){if(error instanceof InspectionFailure)throw error;fail('unsupported_binary_value');}
  } else {
    try{length=bufferLength.call(value);}catch{
      // Shared backing stays unsupported even with a changed plain prototype.
      let shared=false;try{sharedLength?.call(value);shared=!!sharedLength;}catch{}
      if(shared)fail('unsupported_binary_value');
      return null;
    }
    kind='ArrayBuffer';backing=value;offset=0;
  }
  try {
    const total=bufferLength.call(backing); // Shared backing cannot satisfy this intrinsic brand.
    if(bufferResizable?.call(backing))fail('unsupported_binary_value');
    if(total>MAX_CHARACTERS/2)fail('inventory_size_limit');
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset>total||length>total-offset)
      fail('unsupported_binary_value');
    // Also checks detachment for legitimate empty buffers/views. No borrowed
    // bytes are written; the complete original backing and exact view range
    // are retained, including bytes outside a saved view.
    const bytes=new Bytes(backing),hex=new Array(total),digits='0123456789abcdef';
    for(let i=0;i<total;i++)hex[i]=digits[bytes[i]>>>4]+digits[bytes[i]&15];
    return ['binary','[object '+kind+']',offset,length,total,budgetString(hex.join(''),budget)];
  }catch(error){if(error instanceof InspectionFailure)throw error;fail('unsupported_binary_value');}
}

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
  // Unsupported internal entries must not become a plain empty record when
  // caller-controlled prototypes change. Native size probes inspect only the
  // intrinsic brand, never a saved size getter, tag or iterator.
  let collection=false;
  try{mapSize(value);collection=true;}catch{}
  if(!collection)try{setSize(value);collection=true;}catch{}
  if(collection)fail('unsupported_record_type');
  // These native accessors inspect internal slots even when an original has a
  // plain/null prototype. Never read saved source, flags, bytes, tags or getters.
  let opaque=false;
  try{regexpSource.call(value);opaque=true;}catch{}
  if(!opaque && blobSize)try{blobSize.call(value);opaque=true;}catch{}
  if(opaque)fail('unsupported_record_type');
  let instant;
  try { instant=dateTime.call(value); } catch {}
  if (instant!==undefined) {
    if (!Number.isFinite(instant)) fail('invalid_date_value');
    return ['date', instant];
  }
  if(Object.getPrototypeOf(value)===Date.prototype)fail('invalid_date_value');
  const binary=binaryValue(value,budget);if(binary)return binary;
  // If a host exposes Blob without its native slot getter, plain-looking
  // objects cannot be distinguished from opaque Blob/File values safely.
  if(blobPresent && !blobSize)fail('unsupported_record_type');
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

function localRows(storage, budget, area='local') {
  if (!storage || typeof storage.key !== 'function' || typeof storage.getItem !== 'function') fail(area+'_storage_unavailable');
  const count = storage.length;
  if (!Number.isInteger(count) || count < 0 || count > MAX_RECORDS) fail(area+'_storage_inventory_limit');
  const keys = new Set();
  for (let i = 0; i < count; i++) {
    const key = storage.key(i);
    if (typeof key !== 'string' || key.length > 1024 || keys.has(key)) fail(area+'_storage_changed');
    keys.add(key);
  }
  const rows = [...keys].sort(ordered).map(key => {
    const value = storage.getItem(key);
    if (typeof value !== 'string') fail(area+'_storage_changed');
    return [budgetString(key, budget), budgetString(value, budget)];
  });
  if (storage.length !== count) fail(area+'_storage_changed');
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
async function observation(storage, sessionStorage, indexedDb, remaining) {
  const budget = {characters:0, nodes:0, records:0};
  // The native owning mount must declare the actual second Storage source.
  // Undefined remains an explicitly unknown area, never an observed empty one.
  if(sessionStorage===storage)fail('storage_area_alias');
  const local = localRows(storage, budget), session=sessionStorage===undefined?null:localRows(sessionStorage,budget,'session');
  if(local.length+(session?.length??0)>MAX_RECORDS)fail('record_inventory_limit');
  budget.records=local.length+(session?.length??0);
  const list = await databaseList(indexedDb, remaining()), databases = [];
  for (const identity of list) databases.push(await databaseRows(indexedDb, identity, budget, remaining()));
  if (JSON.stringify(list) !== JSON.stringify(await databaseList(indexedDb, remaining()))
    || JSON.stringify(local) !== JSON.stringify(localRows(storage, {characters:0}))
    || (session!==null&&JSON.stringify(session)!==JSON.stringify(localRows(sessionStorage,{characters:0},'session')))) fail('storage_changed');
  return {local, session, databases};
}
async function digest(value, cryptoApi) {
  const text = JSON.stringify(value), bytes = new Uint8Array(text.length * 2);
  // Lossless UTF-16, including malformed historical strings. UTF-8 replacement
  // would collapse distinct saved originals into the same inventory identity.
  for (let i=0;i<text.length;i++) { const c=text.charCodeAt(i); bytes[2*i]=c>>>8; bytes[2*i+1]=c&255; }
  const result = await cryptoApi.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map(v => v.toString(16).padStart(2,'0')).join('');
}

async function inspectProtectedBrowserWork({storage, sessionStorage, indexedDb, cryptoApi=globalThis.crypto, timeoutMs=5000, captureOwner}={}, retainValues=false) {
  const base = {schema:SCHEMA, browser_inventory_state:'UNKNOWN', native_authority:false,
    frozen:false, acknowledged:false, phone_released:false};
  try {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || !cryptoApi?.subtle?.digest
      || typeof globalThis.performance?.now !== 'function') fail('inspection_configuration_invalid');
    if(captureOwner!==undefined&&(!retainValues||!captureOwner
      ||!['assertCurrent','withRead','onClose'].every(key=>typeof captureOwner[key]==='function')))
      fail('inspection_configuration_invalid');
    captureOwner?.assertCurrent();
    // One overall inspection budget, not a fresh full timeout for every store.
    // This clock bounds resource lifetime only; it is not cleaning-time proof.
    const deadline = performance.now() + timeoutMs;
    const remaining = () => { const ms=Math.ceil(deadline-performance.now());if(ms<=0)fail('storage_inspection_timeout');return ms; };
    const hash = value => bounded(digest(value,cryptoApi),remaining());
    const first = await observation(storage,sessionStorage,indexedDb,remaining), second = await observation(storage,sessionStorage,indexedDb,remaining);
    if (JSON.stringify(first) !== JSON.stringify(second)) fail('storage_changed');
    const records = [];
    for (const [key,value] of first.local) records.push(Object.freeze({store:'localStorage',key_sha256:await hash(key),body_sha256:await hash(value)}));
    for (const [key,value] of first.session??[]) records.push(Object.freeze({store:'sessionStorage',key_sha256:await hash(key),body_sha256:await hash(value)}));
    for (const [identity,stores] of first.databases) for (const [store,rows] of stores) for (const [key,value] of rows)
      records.push(Object.freeze({store:'indexedDB',database:identity[0],version:identity[1],object_store:store,key_sha256:await hash(key),body_sha256:await hash(value)}));
    // A third observation after asynchronous hashes rejects ordinary changed
    // inputs. Still not a cross-store lock or protection from an ABA mutation.
    if (JSON.stringify(first) !== JSON.stringify(await observation(storage,sessionStorage,indexedDb,remaining))) fail('storage_changed');
    const observationDigest = await hash([SCHEMA,first]);remaining();
    const result=Object.freeze({...base, state:'OBSERVED_NOT_FROZEN', observation_sha256:observationDigest,
      local_record_count:first.local.length,session_record_count:first.session===null?null:first.session.length,
      session_storage_state:first.session===null?'NOT_DECLARED_UNKNOWN':'CAPTURED_READ_ONLY_NOT_AUTHENTICATED',
      database_count:first.databases.length,record_count:records.length,records:Object.freeze(records)});
    captureOwner?.assertCurrent();
    if(retainValues)capturedValues.set(result,{first,storage,sessionStorage,indexedDb,cryptoApi,owner:captureOwner,candidates:new Set(),censuses:new Set(),feedbacks:new Map()});
    return result;
  } catch (error) {
    return Object.freeze({...base,state:'UNINSPECTABLE',reason:error instanceof InspectionFailure?error.code:'storage_read_failed'});
  }
}

export async function observeProtectedBrowserWork(options={}) { return inspectProtectedBrowserWork(options,false); }
/** Native-coordinator preparation ONLY. This retains exact tagged originals in
 * this module's private memory, not an exported JSON/digest lookup. Still not a
 * durable hold/freeze, authenticated source/principal, atomic view or ABA proof.
 * All browser realms/backup/draft/foreign rows remain semantically UNKNOWN. */
export async function captureProtectedBrowserWork(options={}) { return inspectProtectedBrowserWork(options,true); }
export function closeCapturedProtectedBrowserWork(capture) {
  const value=capturedValues.get(capture);
  if(value){for(const candidate of value.candidates)capturedCandidates.delete(candidate);value.candidates.clear();
    for(const census of value.censuses)capturedCensuses.delete(census);value.censuses.clear();
    for(const feedback of value.feedbacks.values())capturedFeedbacks.delete(feedback);value.feedbacks.clear();}
  capturedValues.delete(capture);
  value?.owner?.onClose();
}

function requireCapture(capture) {
  const value=capturedValues.get(capture);
  if(!value || capture?.state!=='OBSERVED_NOT_FROZEN')fail('original_browser_capture_required');
  return value;
}
async function currentCapture(capture,timeoutMs) {
  const value=requireCapture(capture);
  value.owner?.assertCurrent();
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)fail('inspection_configuration_invalid');
  const deadline=performance.now()+timeoutMs;
  const remaining=()=>{const n=Math.ceil(deadline-performance.now());if(n<=0)fail('storage_inspection_timeout');return n;};
  const fresh=await observation(value.storage,value.sessionStorage,value.indexedDb,remaining);
  if(requireCapture(capture)!==value || JSON.stringify(fresh)!==JSON.stringify(value.first))fail('original_browser_capture_changed');
  value.owner?.assertCurrent();
  return value;
}
// Held captures retain their owner only in private WeakMap memory. Existing
// fixed readers acquire that SAME owner's origin lock once for the entire
// read, not once per internal observation (which would deadlock/re-enter).
// Standalone unheld source captures remain observation-only, never authority.
async function capturedRead(capture,timeoutMs,work) {
  const value=requireCapture(capture);let result;
  const read=async()=>{
    value.owner?.assertCurrent();result=await work();
    if(requireCapture(capture)!==value)fail('original_browser_capture_required');
    value.owner?.assertCurrent();return result;
  };
  try{return await (value.owner?value.owner.withRead(read,timeoutMs):read());}
  catch(error){
    if(result instanceof Uint8Array)result.fill(0);
    else if(Array.isArray(result))for(const bytes of result)if(bytes instanceof Uint8Array)bytes.fill(0);
    // No stale/repaired marker can revive this original capability after a
    // failed held read. Originals in browser storage remain untouched.
    if(value.owner)closeCapturedProtectedBrowserWork(capture);
    throw error;
  }
}
function wellFormed(value) {
  for(let i=0;i<value.length;i++) {
    const c=value.charCodeAt(i);
    if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))fail('original_argument_unicode_invalid');}
    else if(c>=0xdc00&&c<=0xdfff)fail('original_argument_unicode_invalid');
  }
  return value;
}
function jsonValue(tagged,depth=0) {
  if(!Array.isArray(tagged)||depth>64)fail('original_argument_type_unsupported');
  switch(tagged[0]) {
    case 'null':if(tagged.length!==1)break;return null;
    case 'string':if(tagged.length!==2||typeof tagged[1]!=='string')break;return wellFormed(tagged[1]);
    case 'boolean':if(tagged.length!==2||typeof tagged[1]!=='boolean')break;return tagged[1];
    case 'float64': {
      if(tagged.length!==2||typeof tagged[1]!=='string'||!/^[a-f0-9]{16}$/.test(tagged[1]))break;
      const bytes=Uint8Array.from(tagged[1].match(/../g),v=>Number.parseInt(v,16));
      const number=new DataView(bytes.buffer).getFloat64(0,false);
      if(!Number.isFinite(number)||Object.is(number,-0)||(Number.isInteger(number)&&!Number.isSafeInteger(number)))fail('original_argument_number_unsupported');
      return number;
    }
    case 'array':if(tagged.length!==2||!Array.isArray(tagged[1]))break;return tagged[1].map(v=>jsonValue(v,depth+1));
    case 'object': {
      if(tagged.length!==2||!Array.isArray(tagged[1]))break;
      const result=Object.create(null);
      for(const row of tagged[1]) {
        if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||Object.hasOwn(result,row[0]))fail('original_argument_type_unsupported');
        Object.defineProperty(result,wellFormed(row[0]),{value:jsonValue(row[1],depth+1),enumerable:true});
      }
      return result;
    }
  }
  fail('original_argument_type_unsupported'); // Date/binary/undefined/hole are preserved, NEVER coerced to JSON.
}
const originalUuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
/** Narrow raw primary-queue candidate extraction. No normalizer, session/backup
 * fallback, field completion, timestamp change, deduplication or signing. This
 * selector is structural, NOT original native principal/source authentication. */
export async function inspectCapturedOriginalCompletion(capture,{deviceId,clientSessionId,clientCompletionId,timeoutMs=5000}={}) {
  return capturedRead(capture,timeoutMs,async()=>{
  const base={schema:'custodial.browser-original-completion-candidate.v1',browser_inventory_state:'UNKNOWN',native_authority:false,
    source_authenticated:false,frozen:false,acknowledged:false,work_accepted:false,key_removal:false,phone_released:false};
  if(typeof deviceId!=='string'||!/^[A-Z0-9_-]{1,64}$/.test(deviceId)||!originalUuid(clientSessionId)||!originalUuid(clientCompletionId))fail('original_completion_selector_invalid');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)fail('inspection_configuration_invalid');
  const deadline=performance.now()+timeoutMs;
  const remaining=()=>{const n=Math.ceil(deadline-performance.now());if(n<=0)fail('storage_inspection_timeout');return n;};
  const value=await currentCapture(capture,remaining()), candidates=[];let uninspectable=0;
  for(const [identity,stores]of value.first.databases) {
    if(identity[0]!=='mz_scan_queue'||identity[1]<1||identity[1]>6)continue;
    for(const [store,rows]of stores)if(store==='actions')for(const [key,body]of rows) {
      remaining();
      let row,primary;
      try {row=jsonValue(body);primary=jsonValue(key);}catch{uninspectable++;continue;}
      if(!row||typeof row!=='object'||Array.isArray(row)) {uninspectable++;continue;}
      const direct=row.type==='commit_workflow', forward=row.type==='forward-replay-fenced:commit_workflow'
        &&row.forward_action_type==='commit_workflow'&&row.forward_replay_contract==='scan.v4.snapshot-bound-authority';
      if(!(direct||forward))continue;
      if(!Number.isSafeInteger(primary)||primary<1||row.id!==primary||!Number.isInteger(row.schema_version)||row.schema_version<1||row.schema_version>6) {uninspectable++;continue;}
      const args=row.payload;
      if(!args||typeof args!=='object'||Array.isArray(args)) {uninspectable++;continue;}
      if(args.p_device_id!==deviceId||args.p_client_session_id!==clientSessionId||args.p_client_completion_id!==clientCompletionId)continue;
      if(!originalUuid(row.operation_id)||!originalUuid(args.p_native_finish_scan_entry_id)
        ||(row.completion_client_id!=null&&row.completion_client_id!==clientCompletionId)) {uninspectable++;continue;}
      const argsJson=JSON.stringify(args);
      if(argsJson.length>4*1024*1024) {uninspectable++;continue;}
      candidates.push({argsJson,identity,store,key,body,operationId:row.operation_id});
    }
  }
  await currentCapture(capture,remaining());
  if(uninspectable) return Object.freeze({...base,state:'UNINSPECTABLE_PRIMARY_ROWS_RETAINED',matching_rows:candidates.length,uninspectable_rows:uninspectable});
  if(candidates.length!==1)return Object.freeze({...base,state:candidates.length?'AMBIGUOUS_ORIGINAL_ROWS_RETAINED':'ORIGINAL_ARGUMENTS_NOT_FOUND_UNKNOWN',matching_rows:candidates.length});
  const row=candidates[0],bytes=new TextEncoder().encode(row.argsJson);
  if(bytes.length>4*1024*1024)fail('original_argument_size_limit');
  let bytesHash;
  try{bytesHash=[...new Uint8Array(await bounded(value.cryptoApi.subtle.digest('SHA-256',bytes),remaining()))].map(v=>v.toString(16).padStart(2,'0')).join('');}
  finally{bytes.fill(0);}
  const result=Object.freeze({...base,state:'ONE_ORIGINAL_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED',matching_rows:1,
    observation_sha256:capture.observation_sha256,database:row.identity[0],version:row.identity[1],object_store:row.store,
    source_key_sha256:await bounded(digest(row.key,value.cryptoApi),remaining()),source_row_sha256:await bounded(digest(row.body,value.cryptoApi),remaining()),candidate_args_sha256:bytesHash,queue_operation_id:row.operationId});
  await currentCapture(capture,remaining());
  capturedCandidates.set(result,{parent:capture,argsJson:row.argsJson});value.candidates.add(result);return result;
  });
}
/** Explicit native-consumer preparation only; bytes are caller-owned/wiped.
 * The native owner MUST reverify its encrypted frozen receipt and full original
 * actor/semantic binding. This cannot recover original HTTP wire/header proof. */
export async function readCapturedOriginalCompletionArguments(capture,candidate,{timeoutMs=5000}={}) {
  return capturedRead(capture,timeoutMs,async()=>{
  const value=capturedCandidates.get(candidate);
  if(!value||value.parent!==capture)fail('original_completion_candidate_required');
  await currentCapture(capture,timeoutMs);return new TextEncoder().encode(value.argsJson);
  });
}

const CENSUS_SCHEMA='custodial.browser-whole-capture-completion-census.v1';
const MAX_CENSUS_ARGUMENT_BYTES=8*1024*1024, MAX_ARGUMENT_BYTES=4*1024*1024;
const MAX_CENSUSES_PER_CAPTURE=1; // One bounded private list, not unbounded repeated retained snapshots.
const censusBase=()=>({schema:CENSUS_SCHEMA,browser_inventory_state:'UNKNOWN',native_semantic_inventory_state:'UNKNOWN',
  native_authority:false,source_authenticated:false,frozen:false,complete_namespace_inventory:false,current_server_readback:false,
  cutoff_eligible:false,acknowledged:false,work_accepted:false,key_removal:false,phone_released:false});
function censusRemaining(timeoutMs) {
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)fail('inspection_configuration_invalid');
  const deadline=performance.now()+timeoutMs;
  return()=>{const n=Math.ceil(deadline-performance.now());if(n<=0)fail('storage_inspection_timeout');return n;};
}
function structuralCompletionArguments(key,body) {
  // Decode ONLY the captured tagged originals. Do not run the queue normalizer,
  // fill fields, borrow a backup/draft, deduplicate or generate an attestation.
  let row,primary;
  try {row=jsonValue(body);primary=jsonValue(key);}catch{return{state:'UNINSPECTABLE_PRIMARY_ROW_RETAINED'};}
  if(!row||typeof row!=='object'||Array.isArray(row))return{state:'UNINSPECTABLE_PRIMARY_ROW_RETAINED'};
  const direct=row.type==='commit_workflow',forwardType=row.type==='forward-replay-fenced:commit_workflow';
  if(!direct&&!forwardType)return{state:'OTHER_PRIMARY_ACTION_RETAINED_UNKNOWN'};
  if(forwardType&&(row.forward_action_type!=='commit_workflow'||row.forward_replay_contract!=='scan.v4.snapshot-bound-authority'))
    return{state:'MALFORMED_COMPLETION_ACTION_RETAINED'};
  const args=row.payload;
  if(!Number.isSafeInteger(primary)||primary<1||row.id!==primary||!Number.isInteger(row.schema_version)||row.schema_version<1||row.schema_version>6
    ||!originalUuid(row.operation_id)||!args||typeof args!=='object'||Array.isArray(args)
    ||typeof args.p_device_id!=='string'||!/^[A-Z0-9_-]{1,64}$/.test(args.p_device_id)
    ||!originalUuid(args.p_client_session_id)||!originalUuid(args.p_client_completion_id)||!originalUuid(args.p_native_finish_scan_entry_id)
    ||(row.completion_client_id!=null&&row.completion_client_id!==args.p_client_completion_id))
    return{state:'MALFORMED_COMPLETION_IDENTITY_RETAINED'};
  const argsJson=JSON.stringify(args);
  if(argsJson.length>MAX_ARGUMENT_BYTES)return{state:'OVERSIZE_COMPLETION_ARGUMENTS_RETAINED'};
  return{state:'STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED',argsJson,
    completion:JSON.stringify([args.p_device_id,args.p_client_session_id,args.p_client_completion_id]),
    session:JSON.stringify([args.p_device_id,args.p_client_session_id]),operation:row.operation_id};
}
/** Whole captured-realm census, NOT a complete/atomic/durable semantic inventory.
 * EVERY captured local/IDB row and empty database/store is represented. Only
 * original primary mz_scan_queue v1..6/actions values produce untrusted native
 * argument candidates. Unknown, legacy, foreign, backup and draft domains stay
 * unresolved. Duplicates stay separate; there is NO caller-selected subset.
 * This does not authenticate the browser realm, actor, original HTTP wire,
 * schedule/clock, native signature or current server outcome, or permit ACKs,
 * finalization/key deletion. Durable all-realm admission and ABA remain open.
 */
export async function inspectCapturedOriginalCompletionCensus(capture,{timeoutMs=5000}={}) {
  return capturedRead(capture,timeoutMs,async()=>{
  const remaining=censusRemaining(timeoutMs),value=await currentCapture(capture,remaining());
  if(value.censuses.size>=MAX_CENSUSES_PER_CAPTURE)fail('completion_census_already_retained');
  const records=[],domains=[],argumentsList=[],completionCounts=new Map(),sessionCounts=new Map(),operationCounts=new Map();
  let position=0,totalBytes=0,primaryRows=0;
  const count=(map,key)=>map.set(key,(map.get(key)??0)+1);
  const record=(kind,state)=>{
    const source=capture.records[position];if(!source)fail('original_browser_capture_invalid');
    const row={...source,capture_record_ordinal:position++,kind,state,source_authenticated:false,automatic_acceptance:false};
    records.push(row);return row;
  };
  domains.push(Object.freeze({store:'localStorage',record_count:value.first.local.length,state:'UNAUTHENTICATED_DOMAIN_RETAINED_UNKNOWN'}));
  for(const ignored of value.first.local){remaining();record('LOCAL_ORIGINAL','LOCAL_ORIGINAL_RETAINED_UNKNOWN');}
  domains.push(Object.freeze({store:'sessionStorage',record_count:value.first.session===null?null:value.first.session.length,
    state:value.first.session===null?'NOT_DECLARED_UNKNOWN':'UNAUTHENTICATED_DOMAIN_RETAINED_UNKNOWN'}));
  for(const ignored of value.first.session??[]){remaining();record('SESSION_ORIGINAL','SESSION_ORIGINAL_RETAINED_UNKNOWN');}
  for(const [identity,stores]of value.first.databases) {
    const known=identity[0]==='mz_scan_queue'&&identity[1]>=1&&identity[1]<=6;
    domains.push(Object.freeze({store:'indexedDB',database:identity[0],version:identity[1],object_store:null,
      record_count:stores.reduce((n,row)=>n+row[1].length,0),state:'UNAUTHENTICATED_DATABASE_RETAINED_UNKNOWN'}));
    for(const [store,rows]of stores) {
      const primary=known&&store==='actions';
      domains.push(Object.freeze({store:'indexedDB',database:identity[0],version:identity[1],object_store:store,
        record_count:rows.length,state:primary?'PRIMARY_QUEUE_DOMAIN_NOT_AUTHENTICATED':'OTHER_DOMAIN_RETAINED_UNKNOWN'}));
      for(const [key,body]of rows) {
        remaining();
        if(!primary){record('OTHER_IDB_ORIGINAL',identity[0]==='mz_scan_queue'?'UNSUPPORTED_PRIMARY_DOMAIN_RETAINED_UNKNOWN':'OTHER_DOMAIN_ROW_RETAINED_UNKNOWN');continue;}
        primaryRows++;const structural=structuralCompletionArguments(key,body),row=record('PRIMARY_QUEUE_ORIGINAL',structural.state);
        if(!Object.hasOwn(structural,'argsJson'))continue;
        const bytes=new TextEncoder().encode(structural.argsJson);
        try {
          if(bytes.length>MAX_ARGUMENT_BYTES){row.state='OVERSIZE_COMPLETION_ARGUMENTS_RETAINED';continue;}
          if(argumentsList.length>=MAX_RECORDS||(totalBytes+=bytes.length)>MAX_CENSUS_ARGUMENT_BYTES)fail('completion_census_argument_limit');
          const hash=await bounded(value.cryptoApi.subtle.digest('SHA-256',bytes),remaining());
          row.argument_values_sha256=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
          row.candidate_ordinal=argumentsList.length;
          argumentsList.push({argsJson:structural.argsJson,completion:structural.completion,session:structural.session,operation:structural.operation,row});
          count(completionCounts,structural.completion);count(sessionCounts,structural.session);count(operationCounts,structural.operation);
        }finally{bytes.fill(0);}
      }
    }
  }
  if(position!==capture.record_count||position!==capture.records.length)fail('original_browser_capture_invalid');
  let ambiguous=0;
  for(const candidate of argumentsList) {
    if(completionCounts.get(candidate.completion)>1)candidate.row.state='AMBIGUOUS_COMPLETION_ARGUMENT_ROWS_RETAINED';
    else if(sessionCounts.get(candidate.session)>1)candidate.row.state='AMBIGUOUS_SESSION_ARGUMENT_ROWS_RETAINED';
    else if(operationCounts.get(candidate.operation)>1)candidate.row.state='AMBIGUOUS_QUEUE_OPERATION_ROWS_RETAINED';
    if(candidate.row.state!=='STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED')ambiguous++;
  }
  const result=Object.freeze({...censusBase(),state:'WHOLE_CAPTURE_COMPLETION_CENSUS_NOT_AUTHENTICATED',
    observation_sha256:capture.observation_sha256,record_count:position,local_record_count:value.first.local.length,
    session_record_count:value.first.session===null?null:value.first.session.length,session_storage_state:capture.session_storage_state,
    database_count:value.first.databases.length,primary_queue_row_count:primaryRows,argument_candidate_count:argumentsList.length,
    ambiguous_argument_candidate_count:ambiguous,unresolved_record_count:position,
    domains:Object.freeze(domains),records:Object.freeze(records.map(Object.freeze))});
  if(JSON.stringify(result).length>4*1024*1024)fail('completion_census_diagnostic_limit');
  await currentCapture(capture,remaining());remaining();
  if(value.censuses.size>=MAX_CENSUSES_PER_CAPTURE)fail('completion_census_already_retained'); // Includes concurrent inspections.
  capturedCensuses.set(result,{parent:capture,argumentsList:argumentsList.map(row=>row.argsJson),totalBytes});value.censuses.add(result);return result;
  });
}
/** Emit the ENTIRE private argument list in original source order, including
 * duplicates/foreign candidates; no selector/filter/fallback or authority.
 * Caller owns and must wipe every returned byte array. Native must retain the
 * accompanying whole-capture census and reverify its own exact original fence,
 * principal/HMAC/receipt/session/server evidence. Strings are NOT secure-erased.
 */
export async function readCapturedOriginalCompletionCensusArguments(capture,census,{timeoutMs=5000}={}) {
  return capturedRead(capture,timeoutMs,async()=>{
  const retained=capturedCensuses.get(census);
  if(!retained||retained.parent!==capture)fail('original_completion_census_required');
  const remaining=censusRemaining(timeoutMs);await currentCapture(capture,remaining());
  const result=[];let complete=false,total=0;
  try {
    if(retained.argumentsList.length>MAX_RECORDS)fail('completion_census_argument_limit');
    for(const argsJson of retained.argumentsList) {
      remaining();const bytes=new TextEncoder().encode(argsJson);result.push(bytes);
      if(bytes.length>MAX_ARGUMENT_BYTES||(total+=bytes.length)>MAX_CENSUS_ARGUMENT_BYTES)fail('completion_census_argument_limit');
    }
    if(total!==retained.totalBytes)fail('original_completion_census_changed');
    await currentCapture(capture,remaining());
    if(capturedCensuses.get(census)!==retained)fail('original_completion_census_required');
    remaining();complete=true;return result;
  }finally{if(!complete)for(const bytes of result)bytes.fill(0);}
  });
}

const FEEDBACK_PREFIX='mz_employee_feedback_outbox:';
const FEEDBACK_BACKUP_PREFIX='mz_employee_feedback_retirement_backup:';
const feedbackUuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
// Mail's current factory accepts only positive safe integer epochs and saves
// their ORIGINAL decimal text. Never coerce arrays/numbers or stamp a successor.
const feedbackEpoch=value=>typeof value==='string'&&/^[1-9][0-9]{0,15}$/.test(value)&&BigInt(value)<=9007199254740991n;
const feedbackDevice=value=>typeof value==='string'&&/^[A-Z0-9_-]{1,64}$/.test(value);
const feedbackFields=new Set(['operation_id','device_id','hub_context','expected_employee_id','expected_credential_id','expected_assignment_epoch',
  'category','priority','message','body','page_url','url','page_title','submitted_by','image_attachment','image']);
const feedbackBase=()=>({schema:'custodial.browser-original-employee-feedback-candidate.v1',browser_inventory_state:'UNKNOWN',
  native_authority:false,source_authenticated:false,complete_namespace_inventory:false,current_server_readback:false,
  frozen:false,acknowledged:false,work_accepted:false,key_removal:false,phone_released:false,
  automatic_acceptance:false,inventory_acknowledged:false,removal_allowed:false,finalizer_allowed:false,resend_allowed:false});
function originalFeedbackRow(raw) {
  try {
    if(typeof raw!=='string'||raw.length>3500000)return null;
    wellFormed(raw);const row=JSON.parse(raw),body=row?.body;
    // Exact normal JSON.stringify output preserves original order/escapes.
    // Duplicate-key/alternative-encoding rows remain UNKNOWN, not normalized.
    if(JSON.stringify(row)!==raw||!row||typeof row!=='object'||Array.isArray(row)
      ||Object.keys(row).sort().join(',')!=='body,created_at,schema_version'
      ||row.schema_version!=='employee-feedback-outbox.v2'
      ||typeof row.created_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.created_at)
      ||!Number.isFinite(Date.parse(row.created_at))||new Date(row.created_at).toISOString()!==row.created_at
      ||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!feedbackFields.has(key))
      ||!feedbackUuid(body.operation_id)||!feedbackDevice(body.device_id)||body.hub_context!=='employee'
      ||!feedbackUuid(body.expected_employee_id)||!feedbackUuid(body.expected_credential_id)||!feedbackEpoch(body.expected_assignment_epoch))return null;
    for(const key of ['category','priority','message','body','page_url','url','page_title','submitted_by']){
      if(Object.hasOwn(body,key)){if(typeof body[key]!=='string')return null;wellFormed(body[key]);}
    }
    if((Object.hasOwn(body,'message')&&Object.hasOwn(body,'body'))||(Object.hasOwn(body,'page_url')&&Object.hasOwn(body,'url'))
      ||(Object.hasOwn(body,'image_attachment')&&Object.hasOwn(body,'image')))return null;
    const hasImage=Object.hasOwn(body,'image_attachment')||Object.hasOwn(body,'image');
    const image=Object.hasOwn(body,'image_attachment')?body.image_attachment:body.image;
    if(hasImage){
      if(!image||typeof image!=='object'||Array.isArray(image)
        ||Object.keys(image).some(key=>!['name','type','data_url','size'].includes(key))
        ||!['name','type','data_url'].every(key=>typeof image[key]==='string'))return null;
      for(const key of ['name','type','data_url'])wellFormed(image[key]);
      const match=/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(image.data_url);
      if(!match||image.type!==match[1]||(Object.hasOwn(image,'size')&&(!Number.isSafeInteger(image.size)||image.size<0)))return null;
    }
    return row;
  }catch{return null;}
}
function originalFeedbackBackup(raw,key) {
  try {
    if(typeof raw!=='string'||raw.length>4*1024*1024)return null;
    wellFormed(raw);const backup=JSON.parse(raw);
    if(!backup||typeof backup!=='object'||Array.isArray(backup)||JSON.stringify(backup)!==raw
      ||Object.keys(backup).sort().join(',')!=='original_encoded,original_key,schema_version'
      ||backup.schema_version!=='employee-feedback-retirement-backup.v1'
      ||typeof backup.original_key!=='string'||typeof backup.original_encoded!=='string')return null;
    const row=originalFeedbackRow(backup.original_encoded),body=row?.body;
    if(!row||backup.original_key!==FEEDBACK_PREFIX+body.device_id+':'+body.operation_id
      ||key!==FEEDBACK_BACKUP_PREFIX+body.device_id+':'+body.operation_id)return null;
    return {row,originalRaw:backup.original_encoded};
  }catch{return null;}
}
/** Fixed ORIGINAL employee Feedback source only, not arbitrary local JSON.
 * Current producer: employee-feedback-outbox.v2 or its closed retirement
 * backup wrapper, with original employee/credential/decimal epoch pins.
 * Explicit sourceKind chooses only ACTIVE_OUTBOX or RETIREMENT_BACKUP; both
 * domains' conflicting copies still invalidate this purpose. No fallback.
 * Historic/unpinned/Messenger/foreign rows remain
 * intact and UNKNOWN. The selector is a private native-owner input in the
 * eventual mount, but a matching selector is NOT authentication here.
 */
export async function inspectCapturedOriginalEmployeeFeedback(capture,{deviceId,employeeId,credentialId,assignmentEpoch,operationId,
  sourceKind='ACTIVE_OUTBOX',timeoutMs=5000}={}) {
  return capturedRead(capture,timeoutMs,async()=>{
    if(!feedbackDevice(deviceId)||!feedbackUuid(employeeId)||!feedbackUuid(credentialId)||!feedbackUuid(operationId)||!feedbackEpoch(assignmentEpoch)
      ||!['ACTIVE_OUTBOX','RETIREMENT_BACKUP'].includes(sourceKind))
      fail('original_feedback_selector_invalid');
    const remaining=censusRemaining(timeoutMs),value=await currentCapture(capture,remaining());
    if(!value.owner)fail('held_browser_capture_required');
    const expectedKey=FEEDBACK_PREFIX+deviceId+':'+operationId,expectedBackupKey=FEEDBACK_BACKUP_PREFIX+deviceId+':'+operationId,candidates=[];
    let unknown=0,invalidTarget=0,feedbackRows=0,backupRows=0;
    const sameUuid=(a,b)=>feedbackUuid(a)&&a.toLowerCase()===b.toLowerCase();
    for(const [ordinal,[key,raw]]of value.first.local.entries()){
      remaining();const isBackup=key.startsWith(FEEDBACK_BACKUP_PREFIX);
      if(!isBackup&&!key.startsWith(FEEDBACK_PREFIX))continue;feedbackRows++;if(isBackup)backupRows++;
      let possible;
      try{const parsed=JSON.parse(raw);possible=isBackup?JSON.parse(parsed?.original_encoded)?.body:parsed?.body;}catch{}
      const target=key===expectedKey||key===expectedBackupKey||(possible?.device_id===deviceId&&sameUuid(possible?.operation_id,operationId));
      const backup=isBackup?originalFeedbackBackup(raw,key):null,row=isBackup?backup?.row:originalFeedbackRow(raw),body=row?.body;
      if(!row||(!isBackup&&key!==FEEDBACK_PREFIX+body.device_id+':'+body.operation_id)){unknown++;if(target)invalidTarget++;continue;}
      if(body.device_id!==deviceId||!sameUuid(body.operation_id,operationId))continue;
      if(!sameUuid(body.expected_employee_id,employeeId)||!sameUuid(body.expected_credential_id,credentialId)||body.expected_assignment_epoch!==assignmentEpoch){
        unknown++;invalidTarget++;continue;
      }
      candidates.push({key,raw:isBackup?backup.originalRaw:raw,row,ordinal,sourceKind:isBackup?'RETIREMENT_BACKUP':'ACTIVE_OUTBOX'});
    }
    await currentCapture(capture,remaining());
    const selectedCopies=candidates.filter(row=>row.sourceKind===sourceKind);
    const base={...feedbackBase(),source_kind:sourceKind,feedback_row_count:feedbackRows,retirement_backup_row_count:backupRows,
      unresolved_feedback_rows:feedbackRows,uninspectable_or_foreign_feedback_rows:unknown,
      matching_rows:selectedCopies.length,matching_original_copy_count:candidates.length};
    if(invalidTarget)return Object.freeze({...base,state:'UNINSPECTABLE_OR_FOREIGN_FEEDBACK_TARGET_RETAINED_UNKNOWN'});
    // Each physical copy remains represented and untouched. Equal bytes are
    // not two accepted items, an ACK or a deduplicated/removable source. Any
    // different bytes for this same original purpose make BOTH uninspectable.
    if(candidates.some(row=>row.raw!==candidates[0].raw))
      return Object.freeze({...base,state:'CONFLICTING_ORIGINAL_FEEDBACK_COPIES_RETAINED_UNKNOWN'});
    if(selectedCopies.length!==1)return Object.freeze({...base,state:selectedCopies.length?'AMBIGUOUS_FEEDBACK_TARGETS_RETAINED_UNKNOWN':'ORIGINAL_FEEDBACK_NOT_FOUND_UNKNOWN'});
    const selected=selectedCopies[0],cached=value.feedbacks.get(selected.key);
    if(cached)return cached;
    if(value.feedbacks.size>=MAX_RECORDS)fail('original_feedback_candidate_limit');
    const rawBytes=new TextEncoder().encode(selected.raw),bodyBytes=new TextEncoder().encode(JSON.stringify(selected.row.body));
    let rawHash,bodyHash;
    try{
      if(rawBytes.length>MAX_CHARACTERS||bodyBytes.length>MAX_CHARACTERS)fail('original_feedback_size_limit');
      const hash=async bytes=>[...new Uint8Array(await bounded(value.cryptoApi.subtle.digest('SHA-256',bytes),remaining()))].map(v=>v.toString(16).padStart(2,'0')).join('');
      rawHash=await hash(rawBytes);bodyHash=await hash(bodyBytes);
    }finally{rawBytes.fill(0);bodyBytes.fill(0);}
    await currentCapture(capture,remaining());
    const source=capture.records[selected.ordinal];
    if(!source||source.store!=='localStorage')fail('original_browser_capture_invalid');
    const result=Object.freeze({...base,state:'ONE_ORIGINAL_FEEDBACK_CANDIDATE_NOT_AUTHENTICATED',
      observation_sha256:capture.observation_sha256,capture_record_ordinal:selected.ordinal,
      source_key_sha256:source.key_sha256,source_row_sha256:source.body_sha256,
      raw_original_utf8_sha256:rawHash,original_body_utf8_sha256:bodyHash,
      device_id:selected.row.body.device_id,original_employee_id:selected.row.body.expected_employee_id,
      original_credential_id:selected.row.body.expected_credential_id,original_assignment_epoch:selected.row.body.expected_assignment_epoch,
      operation_id:selected.row.body.operation_id,original_created_at:selected.row.created_at});
    capturedFeedbacks.set(result,{parent:capture,raw:selected.raw});value.feedbacks.set(selected.key,result);return result;
  });
}
/** Emit only this structurally pinned employee Feedback's EXACT saved row in
 * UTF-8 (schema/body/created_at included), never reconstructed HTTP wire/auth.
 * RETIREMENT_BACKUP emits only its exact original_encoded, not wrapper bytes
 * or a restored active row. The wrapper/key/full capture remain privately
 * pinned and rechecked under the same origin owner; no storage write occurs.
 * Caller owns/wipes bytes. Main must attest SAME capture and original native
 * tuple/currentness before decoding the body, and independently bind receipts.
 */
export async function readCapturedOriginalEmployeeFeedbackRow(capture,candidate,{timeoutMs=5000}={}) {
  return capturedRead(capture,timeoutMs,async()=>{
    const value=capturedFeedbacks.get(candidate);
    if(!value||value.parent!==capture)fail('original_feedback_candidate_required');
    const remaining=censusRemaining(timeoutMs);await currentCapture(capture,remaining());
    const bytes=new TextEncoder().encode(value.raw);let complete=false;
    try{
      if(bytes.length>MAX_CHARACTERS)fail('original_feedback_size_limit');
      await currentCapture(capture,remaining());
      if(capturedFeedbacks.get(candidate)!==value)fail('original_feedback_candidate_required');
      remaining();complete=true;return bytes;
    }finally{if(!complete)bytes.fill(0);}
  });
}
