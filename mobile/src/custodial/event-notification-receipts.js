import {principalIdentity, protectedPrincipal} from './protected-principal.js';

export const EVENT_OPEN_OUTBOX_SCHEMA = 'custodial.employee-event-open-outbox.v1';
const PREFIX = 'mz_native_notification_outbox:event-open.v1:';
const RECEIPT = 'custodial.employee-event-open-receipt.v1';
const TUPLE = ['instance_id','notification_key','event_id','notification_kind','credential_id','employee_id','device_id','device_identifier','assignment_epoch'];
const LIST = [...TUPLE,'scheduled_for','state','sent_at','opened_at','event_revision','event_validity'];
const KINDS = new Set(['three_days_before','two_days_before','shift_plus_15']);
const STATES = new Set(['pending','leased','failed','sent','opened','cancelled']);
const owners = new WeakMap();
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).sort().join('|') === [...names].sort().join('|');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const keyText = value => typeof value === 'string' && value === value.trim() && value.length > 0
  && !/[\u0000-\u001f\u007f]/.test(value) && new TextEncoder().encode(value).length <= 240;
const integer = value => Number.isSafeInteger(value) && value > 0;
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return false;
  const year=Number(value.slice(0,4)), month=Number(value.slice(5,7)), day=Number(value.slice(8,10));
  const leap=year%4===0&&(year%100!==0||year%400===0), days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return year>0&&month>=1&&month<=12&&day>=1&&day<=days[month-1]&&Number(value.slice(11,13))<24
    &&Number(value.slice(14,16))<60&&Number(value.slice(17,19))<60&&Number.isFinite(Date.parse(value));
}
function tuple(value) {
  return object(value) && ['instance_id','event_id','credential_id','employee_id','device_id'].every(name=>uuid(value[name]))
    && keyText(value.notification_key) && KINDS.has(value.notification_kind)
    && /^KIOSK_(?:0[2-9]|10)$/.test(value.device_identifier) && integer(value.assignment_epoch);
}
function openedReceipt(value) {
  const names=['schema',...TUPLE,'state','opened_at'];if(!keys(value,names))return null;
  const copy=Object.fromEntries(names.map(name=>[name,value[name]]));
  return copy.schema===RECEIPT&&tuple(copy)&&copy.state==='opened'&&instant(copy.opened_at)?Object.freeze(copy):null;
}
function sourceRow(value) {
  const hasReceipt=object(value)&&Object.hasOwn(value,'open_receipt');
  if(!keys(value,hasReceipt?[...LIST,'open_receipt']:LIST))return null;
  value=Object.fromEntries((hasReceipt?[...LIST,'open_receipt']:LIST).map(name=>[name,value[name]]));
  if (!tuple(value) || !STATES.has(value.state) || !instant(value.scheduled_for)
    || ![value.sent_at,value.opened_at].every(time=>time===null||instant(time))
    || !integer(value.event_revision) || value.event_revision>2147483647
    || !['CURRENT','WITHHELD','UNKNOWN'].includes(value.event_validity)
    || (value.state==='sent'&&(!instant(value.sent_at)||value.opened_at!==null))
    || (value.state==='opened'&&(!instant(value.sent_at)||!instant(value.opened_at)||Date.parse(value.opened_at)<Date.parse(value.sent_at)))) return null;
  if(value.event_validity==='CURRENT'&&value.state==='opened'){
    const receipt=openedReceipt(value.open_receipt);
    if(!receipt||!sameTuple(receipt,value)||receipt.opened_at!==value.opened_at)return null;
    value.open_receipt=receipt;
  }else if(hasReceipt)return null;
  return Object.freeze(value);
}
const sameTuple = (a,b) => TUPLE.every(name=>a[name]===b[name]);
const operationId = binding => `employee-event-open:${binding.instance_id}:${binding.credential_id}:${binding.assignment_epoch}:opened`;
function savedRow(encoded) {
  if(typeof encoded!=='string'||encoded.length>8192)return null;
  try {
    const row=JSON.parse(encoded);
    if(!keys(row,['schema_version','id','action','phase','binding','source','principal_sha256','body'])
      ||row.schema_version!==EVENT_OPEN_OUTBOX_SCHEMA||row.action!=='opened'||!['PREPARED','DISPATCH_UNKNOWN'].includes(row.phase)
      ||!keys(row.binding,TUPLE)||!tuple(row.binding)||row.id!==operationId(row.binding)
      ||!keys(row.source,['event_revision','scheduled_for'])||!integer(row.source.event_revision)||row.source.event_revision>2147483647||!instant(row.source.scheduled_for)
      ||typeof row.principal_sha256!=='string'||! /^[a-f0-9]{64}$/.test(row.principal_sha256)
      ||!keys(row.body,['notification_key'])||row.body.notification_key!==row.binding.notification_key||JSON.stringify(row)!==encoded)return null;
    return row;
  }catch{return null;}
}
async function principalHash(scope) {
  if(!globalThis.crypto?.subtle)return null;
  const bytes=new TextEncoder().encode(scope);
  try {return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
  finally{bytes.fill(0);}
}

// Bridge-private event application domain. Only a captured authenticated
// /events read supplies a new action, never an edited notification/card. No
// transport, credential, native claim, replay, thaw or retirement authority is
// supplied by this module. Main mounts the original authenticated transport.
export function createEventNotificationOpenOutbox({storage, mutate, getPrincipal, getGeneration}) {
  if(!storage||!['getItem','setItem','removeItem','key'].every(name=>typeof storage[name]==='function')
    ||![mutate,getPrincipal,getGeneration].every(fn=>typeof fn==='function'))throw new TypeError('Private event outbox interfaces required.');
  let retained=owners.get(storage);if(!retained){retained=new Map();owners.set(storage,retained);}
  const readTokens=new WeakMap(), operations=new WeakMap(), recoveryTokens=new WeakMap();
  let readSequence=0, source=null;
  const pending=()=>Object.freeze({state:'PENDING'});
  function context() {
    try {
      const generation=getGeneration(), principal=protectedPrincipal(getPrincipal()), scope=principalIdentity(principal);
      if(!scope||!Number.isSafeInteger(generation)||generation<0||getGeneration()!==generation
        ||principalIdentity(getPrincipal())!==scope)return null;
      return {generation,principal,scope};
    }catch{return null;}
  }
  const current = capture => {const now=context();return Boolean(now&&now.scope===capture.scope&&now.generation===capture.generation);};
  async function capture() {
    const value=context();if(!value)return null;
    try{value.hash=await principalHash(value.scope);return value.hash&&current(value)?value:null;}catch{return null;}
  }
  const recipient = (binding,capture) => binding.credential_id===capture.principal.credential_id
    &&binding.employee_id===capture.principal.employee_id&&binding.assignment_epoch===capture.principal.assignment_epoch
    &&binding.device_identifier===capture.principal.device_id;
  function admitted(capture, admission) {
    if(!current(capture)||!admission||admission.generation!==capture.generation||typeof admission.assertCurrent!=='function')throw new Error('Event original context unavailable.');
    admission.assertCurrent();if(!current(capture))throw new Error('Event original context changed.');
  }
  const principalMatches=(row,capture)=>current(capture)&&row.principal_sha256===capture.hash&&recipient(row.binding,capture);
  function sourceMatches(row,capture) {
    const original=source?.rows.get(row.binding.notification_key);
    return principalMatches(row,capture)&&source&&source.capture.scope===capture.scope&&source.capture.generation===capture.generation
      &&original?.event_validity==='CURRENT'
      &&original.state!=='cancelled'&&sameTuple(original,row.binding)&&original.event_revision===row.source.event_revision
      &&original.scheduled_for===row.source.scheduled_for;
  }
  const tokenFor = (entry,capture) => {const token=Object.freeze({});operations.set(token,{entry,capture});return token;};
  async function writeExact(entry,capture) {
    if(entry.active||!sourceMatches(entry.row,capture))return false;entry.active=true;
    try {
      const success=await mutate(admission=>{
        admitted(capture,admission);if(!sourceMatches(entry.row,capture))return false;
        const previous=storage.getItem(entry.key);admitted(capture,admission);
        if(!sourceMatches(entry.row,capture))return false;
        if(previous!==null&&previous!==entry.encoded&&previous!==entry.expected)return false;
        storage.setItem(entry.key,entry.encoded);admitted(capture,admission);
        const exact=storage.getItem(entry.key)===entry.encoded;admitted(capture,admission);
        return exact&&sourceMatches(entry.row,capture);
      },{expectedGeneration:capture.generation,requireEnrollment:true});
      if(success!==true||!sourceMatches(entry.row,capture))return false;
      entry.expected=entry.encoded;entry.unconfirmed=false;return true;
    }catch{return false;}finally{entry.active=false;}
  }
  async function beginCurrentEventsRead() {
    const sequence=++readSequence;source=null;
    const original=await capture();if(!original||sequence!==readSequence)return null;
    const token=Object.freeze({});readTokens.set(token,{capture:original,sequence});
    return Object.freeze({token,request:Object.freeze({path:'/employee-notifications-api/events',method:'GET'}),generation:original.generation});
  }
  function acceptCurrentEventsRead(token,rows) {
    const read=readTokens.get(token);readTokens.delete(token);
    if(!read||read.sequence!==readSequence||!current(read.capture))return false;
    source=null;if(!Array.isArray(rows)||rows.length>100)return false;
    const originals=new Map(), instances=new Set();
    for(const candidate of rows) {
      // Historical/unsupported rows are retained by their owner, not adopted.
      if(candidate?.notification_kind==='day_before'&&candidate?.event_validity==='WITHHELD')continue;
      const row=sourceRow(candidate);
      if(!row||!recipient(row,read.capture)||originals.has(row.notification_key)||instances.has(row.instance_id))return false;
      originals.set(row.notification_key,row);instances.add(row.instance_id);
    }
    if(!current(read.capture))return false;source={capture:read.capture,rows:originals};return true;
  }
  function unavailableCurrentEvents(token) {
    const read=readTokens.get(token);readTokens.delete(token);
    if(read&&read.sequence===readSequence){source=null;return true;}return false;
  }
  async function prepareOpen(notificationKey) {
    const original=await capture(), selected=source?.rows.get(notificationKey);
    if(!original||!selected||selected.event_validity!=='CURRENT'||['cancelled','opened'].includes(selected.state)||!recipient(selected,original))return null;
    const binding=Object.fromEntries(TUPLE.map(name=>[name,selected[name]])), id=operationId(binding), key=PREFIX+id;
    let entry=retained.get(key);
    if(!entry) {
      let encoded;try{encoded=storage.getItem(key);}catch{return null;}
      const saved=encoded===null?null:savedRow(encoded);if(encoded!==null&&!saved)return null;
      const row=saved||{schema_version:EVENT_OPEN_OUTBOX_SCHEMA,id,action:'opened',phase:'PREPARED',binding,
        source:{event_revision:selected.event_revision,scheduled_for:selected.scheduled_for},principal_sha256:original.hash,body:{notification_key:selected.notification_key}};
      if(!sameTuple(row.binding,binding)||!sourceMatches(row,original))return null;
      encoded=encoded??JSON.stringify(row);entry={key,row,encoded,expected:encoded,unconfirmed:true,active:false};retained.set(key,entry);
    }
    if(entry.closed||!sameTuple(entry.row.binding,binding)||!sourceMatches(entry.row,original))return null;
    // Same original bytes are recommitted after false/throw/memory-only writes.
    // An unknown attempted dispatch never becomes a fresh PREPARED operation.
    if(entry.row.phase==='PREPARED'&&!(await writeExact(entry,original)))return null;
    return sourceMatches(entry.row,original)?tokenFor(entry,original):null;
  }
  async function pendingOriginals() {
    const original=await capture();if(!original)return [];
    try {
      for(let index=0;index<storage.length;index++) {
        const key=storage.key(index);if(!key?.startsWith(PREFIX)||retained.has(key))continue;
        const encoded=storage.getItem(key),row=savedRow(encoded);
        if(row&&key===PREFIX+row.id&&principalMatches(row,original))retained.set(key,{key,row,encoded,expected:encoded,unconfirmed:true,active:false});
      }
    }catch{return [];}
    return [...retained.values()].filter(entry=>!entry.closed&&principalMatches(entry.row,original)).map(entry=>tokenFor(entry,original));
  }
  async function beginOpenDispatch(token) {
    const operation=operations.get(token);if(!operation)return null;
    const {entry,capture:original}=operation;
    if(entry.closed||entry.active||entry.unconfirmed||entry.row.phase!=='PREPARED'||!sourceMatches(entry.row,original))return null;
    // Persist the attempted-send fence BEFORE returning the fixed original
    // request. Any failure/late response remains UNKNOWN, never automatic POST.
    entry.expected=entry.encoded;entry.row={...entry.row,phase:'DISPATCH_UNKNOWN'};entry.encoded=JSON.stringify(entry.row);entry.unconfirmed=true;
    if(!(await writeExact(entry,original))||!sourceMatches(entry.row,original))return null;
    return Object.freeze({path:'/employee-notifications-api/opened',method:'POST',generation:original.generation,
      headers:Object.freeze({'Idempotency-Key':entry.row.id}),body:Object.freeze({...entry.row.body})});
  }
  async function settle(entry,original,receipt,readOriginal=null) {
    receipt=openedReceipt(receipt);
    const receiptCurrent=()=>{
      const row=readOriginal?.row??source?.rows.get(entry.row.binding.notification_key);
      const bound=readOriginal?readOriginal.sequence===readSequence&&principalMatches(entry.row,original)
        &&row.event_validity==='CURRENT'&&sameTuple(row,entry.row.binding)&&row.event_revision===entry.row.source.event_revision
        &&row.scheduled_for===entry.row.source.scheduled_for:sourceMatches(entry.row,original);
      return bound&&instant(row?.sent_at)&&Date.parse(receipt.opened_at)>=Date.parse(row.sent_at)
        &&(row.state!=='opened'||row.opened_at===receipt.opened_at);
    };
    if(!receipt||entry.closed||entry.active||!sameTuple(receipt,entry.row.binding)||!receiptCurrent())return pending();
    entry.active=true;
    try {
      const settled=await mutate(admission=>{
        admitted(original,admission);if(!receiptCurrent())return false;
        const encoded=storage.getItem(entry.key);admitted(original,admission);
        if(!receiptCurrent()||(encoded!==null&&encoded!==entry.encoded&&encoded!==entry.expected))return false;
        if(encoded!==null)storage.removeItem(entry.key);admitted(original,admission);
        const absent=storage.getItem(entry.key)===null;admitted(original,admission);
        return absent&&receiptCurrent();
      },{expectedGeneration:original.generation,requireEnrollment:true});
      if(settled!==true||!receiptCurrent())return pending();
      // Close old opaque tokens too. An already confirmed original may not
      // resurrect an outbox row or expose a second POST from stale source.
      entry.closed=true;
      return Object.freeze({state:'OPENED',opened_at:receipt.opened_at});
    }catch{return pending();}finally{entry.active=false;}
  }
  async function settleOriginalOpened(token,receipt) {
    const operation=operations.get(token);if(!operation||operation.entry.closed||operation.entry.row.phase!=='DISPATCH_UNKNOWN')return pending();
    return settle(operation.entry,operation.capture,receipt);
  }
  function beginOriginalReadback(token) {
    const operation=operations.get(token);if(!operation||operation.entry.closed||!principalMatches(operation.entry.row,operation.capture))return null;
    // Absence from the capped list does not authorize anything. It also must
    // not prevent a read of the fixed original key under the same principal.
    const read=Object.freeze({});recoveryTokens.set(read,{...operation,sequence:readSequence});
    return Object.freeze({token:read,generation:operation.capture.generation,request:Object.freeze({method:'GET',
      path:`/employee-notifications-api/events?notification_key=${encodeURIComponent(operation.entry.row.binding.notification_key)}`})});
  }
  async function settleOriginalReadback(token,rows) {
    const operation=recoveryTokens.get(token);recoveryTokens.delete(token);
    if(!operation||!Array.isArray(rows)||rows.length!==1)return pending();
    const row=sourceRow(rows[0]),original=operation.entry.row;
    if(!row||row.event_validity!=='CURRENT'||!sameTuple(row,original.binding)||row.event_revision!==original.source.event_revision
      ||row.scheduled_for!==original.source.scheduled_for||row.state!=='opened'||!instant(row.opened_at))return pending();
    // The fixed original GET returns the producer's typed receipt, not one
    // invented here from state strings or a provider-acceptance boolean.
    return settle(operation.entry,operation.capture,row.open_receipt,{row,sequence:operation.sequence});
  }
  return Object.freeze({beginCurrentEventsRead,acceptCurrentEventsRead,unavailableCurrentEvents,prepareOpen,pendingOriginals,
    beginOpenDispatch,settleOriginalOpened,beginOriginalReadback,settleOriginalReadback});
}
