import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  Sidebar,
  Search,
  ConversationList,
  Conversation,
  Avatar,
  ChatContainer,
  ConversationHeader,
  MessageList,
  Message,
  MessageInput,
} from '@chatscope/chat-ui-kit-react';
import './theme.css';
import './avatar.css';
import { createHomeAssistantEntry } from './home-assistant-entry.mjs';

const API = 'https://memphis-zoo-mcp.onrender.com/messaging-api';
const MEMPHIS_AVATAR = './memphis_avatar_ui.webp';
const ZOO_LOGO = './Zoo_Logo_ui.webp';
const ZERO_TIME = '1970-01-01T00:00:00.000Z';
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_OUTBOX_SCHEMA = 'chatscope-message-outbox.v2';
const DELETE_OUTBOX_SCHEMA = 'chatscope-delete-outbox.v2';
const RETIRED_KEY = 'ops_manager_shared_chat_v1';
const RETIRED_TITLE = /operations leadership(?: chat)?(?: \(retired\))?|ops manager chat/i;
const PAGE_URL = new URL(window.location.href);
const EMPLOYEE_CONTEXT = String(PAGE_URL.searchParams.get('hub') || '').trim().toLowerCase() === 'employee';

function isNativeCustodialAuthority() {
  return custodialNativeWriterRequired();
}

function employeeDeviceId() {
  if (isNativeCustodialAuthority()) {
    try {
      const status = custodialWorkSecurity().getStatus?.();
      return status?.ready === true && status?.available === true && !status?.quarantined ? String(status.deviceId || '').trim() : '';
    } catch { throw custodialWorkUnavailable(); }
  }
  return String(
    PAGE_URL.searchParams.get('device')
    || PAGE_URL.searchParams.get('deviceId')
    || window.MemphisAuth?.getDeviceId?.()
    || localStorage.getItem('mz_scan_device_id')
    || localStorage.getItem('mz_employee_hub_device_id')
    || localStorage.getItem('memphisAssignedDeviceId')
    || '',
  ).trim();
}

async function waitForEmployeeDeviceAuthority() {
  const security = custodialWorkSecurity();
  if (!security) return employeeDeviceId();
  const mobile = window.MemphisMobile;
  const pending = mobile?.ready || security.ready;
  if (pending && typeof pending.then === 'function') await pending;
  if (custodialWorkSecurity() !== security || window.MemphisMobile !== mobile) throw custodialWorkUnavailable();
  if (typeof mobile?.authoritativeDeviceId === 'function') {
    const id = await mobile.authoritativeDeviceId();
    if (custodialWorkSecurity() !== security || window.MemphisMobile !== mobile || id !== employeeDeviceId()) throw custodialWorkUnavailable();
    return id;
  }
  return employeeDeviceId();
}

// Employee Messenger authenticates with the assigned device credential. The
// manager application supplies its own named bearer-session implementation.
if (EMPLOYEE_CONTEXT && !isNativeCustodialAuthority() && !window.MemphisMobile) {
  window.MemphisMobile = {
    ready: Promise.resolve(),
    deviceId: employeeDeviceId,
    authoritativeDeviceId: async () => employeeDeviceId(),
    employeeDeviceAuthority: true,
  };
}

function resolveBackUrl() {
  const nativeApp = document.documentElement.classList.contains('mz-native-app');
  const target = new URL(nativeApp ? './index.html' : (EMPLOYEE_CONTEXT ? './employee-hub.html' : './start_page1.html'), window.location.href);
  if (EMPLOYEE_CONTEXT) {
    target.searchParams.set('hub', 'employee');
    const device = employeeDeviceId();
    if (device) target.searchParams.set('device', device);
  }
  return target.toString();
}

async function navigateBack() {
  await waitForEmployeeDeviceAuthority();
  window.location.href = resolveBackUrl();
}

window.MemphisMessengerRoute = {
  resolveBackUrl,
  navigateBack,
  employeeContext: EMPLOYEE_CONTEXT,
  employeeDeviceId,
  ready: waitForEmployeeDeviceAuthority,
};

function safe(value) { return value instanceof Error ? value.message : String(value || 'Unknown error'); }
function roleTitle(user = {}) {
  const explicit = String(user.role_title || user.job_title || '').trim();
  if (explicit) return explicit;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'manager' ? 'Operations Leadership' : (role === 'bot' ? 'Memphis' : 'Employee');
}
function isMemphisRow(row = {}) {
  return String(row.thread_type || row.type || '').toLowerCase() === 'bot'
    || /^memphis(?: ai)?$/i.test(String(row.thread_title || row.title || '').trim());
}
function isRetiredThread(row = {}) {
  return row.system_key === RETIRED_KEY
    || row.is_ops_manager_shared === true
    || RETIRED_TITLE.test(String(row.thread_title || row.title || ''));
}
function normalizedThread(row = {}) {
  const memphis = isMemphisRow(row);
  return {
    ...row,
    id: String(row.id || row.thread_id || ''),
    title: memphis ? 'Memphis AI' : String(row.thread_title || row.title || 'Conversation'),
    type: String(row.thread_type || 'direct').toLowerCase(),
    participantNames: String(row.participant_names || ''),
    canSend: row.viewer_can_send !== false,
    shared: row.is_ops_manager_shared === true || row.system_key === 'ops_manager_shared_chat_v1',
    unread: Number(row.unread_count || 0),
  };
}
function isMemphis(thread) { return isMemphisRow(thread); }
function compareThreads(left, right) {
  const pin = Number(isMemphis(right)) - Number(isMemphis(left));
  if (pin) return pin;
  const unread = Number(right.unread || right.unread_count || 0) - Number(left.unread || left.unread_count || 0);
  if (unread) return unread;
  return Date.parse(right.last_message_at || right.updated_at || 0) - Date.parse(left.last_message_at || left.updated_at || 0);
}
function initials(value) {
  return String(value || 'M').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'M';
}
function MessengerAvatarVisual({ name, src = '' }) {
  const safeName = String(name || 'User').trim() || 'User';
  const safeSrc = typeof src === 'string' ? src.trim() : '';
  const [imageState, setImageState] = useState(safeSrc ? 'loading' : 'fallback');

  useEffect(() => {
    setImageState(safeSrc ? 'loading' : 'fallback');
  }, [safeSrc]);

  return <span className="mz-avatar-visual" data-avatar-state={imageState}>
    <span className="mz-avatar-initials" aria-hidden="true">{initials(safeName)}</span>
    {safeSrc && imageState !== 'failed' && <img
      className="mz-avatar-image"
      src={safeSrc}
      alt=""
      onLoad={() => setImageState('loaded')}
      onError={() => setImageState('failed')}
    />}
  </span>;
}

// ChatScope accepts only a direct Avatar element in conversations and headers.
// This helper keeps that component identity while centralizing safe rendering.
function messengerAvatar(name, src = '') {
  const safeName = String(name || 'User').trim() || 'User';
  return <Avatar
    className="mz-avatar"
    role="img"
    aria-label={`${safeName} avatar`}
  >
    <MessengerAvatarVisual name={safeName} src={src} />
  </Avatar>;
}
function formatTime(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function clientMessageId() { return `msg:${crypto.randomUUID()}`; }
function operationId(prefix = 'op') { return `${prefix}:${crypto.randomUUID()}`; }
function outboxKey(id) { return `mz_chatscope_outbox:${id}`; }
function custodialNativeWriterRequired() {
  // Private function-local latch is denial evidence only, never admission.
  if (custodialNativeWriterRequired.observed === true) return true;
  try {
    if (window.MemphisCustodialSecurity?.native === true
      || window.MemphisMobile?.edition === 'custodial'
      || window.MemphisMobileBuildIdentity?.edition === 'custodial'
      || window.Capacitor?.isNativePlatform?.() === true
      || ['android', 'ios'].includes(window.Capacitor?.getPlatform?.())) custodialNativeWriterRequired.observed = true;
  } catch { custodialNativeWriterRequired.observed = true; }
  return custodialNativeWriterRequired.observed === true;
}
function custodialWorkUnavailable() {
  return Object.assign(new Error('Custodial security is not available for Messenger work.'), {code:'custodial_security_state_unavailable'});
}
function custodialWorkSecurity() {
  try {
    const required = custodialNativeWriterRequired(), security = window.MemphisCustodialSecurity;
    if (security?.native === true && typeof security.mutateProtectedWork === 'function') return security;
    if (!required) return null;
  } catch { custodialNativeWriterRequired.observed = true; }
  throw custodialWorkUnavailable();
}
function originalCustodialIdentityGuard(expectedDeviceId) {
  const security = custodialWorkSecurity();
  if (!security) return () => { if (custodialWorkSecurity() !== null) throw custodialWorkUnavailable(); };
  try {
    const mobile = window.MemphisMobile, statusMethod = security.getStatus, principalMethod = mobile?.principalIdentity;
    const writerMethod = security.mutateProtectedWork;
    const before = security.getStatus?.(), generation = before?.generation, device = before?.deviceId;
    const principal = mobile?.principalIdentity?.();
    if (typeof statusMethod !== 'function' || typeof principalMethod !== 'function' || typeof writerMethod !== 'function'
      || !Number.isSafeInteger(generation) || generation < 1 || typeof device !== 'string' || !device || device !== expectedDeviceId
      || typeof principal !== 'string' || !principal) throw custodialWorkUnavailable();
    const current = () => {
      try {
        if (custodialWorkSecurity() !== security || window.MemphisMobile !== mobile
          || security.getStatus !== statusMethod || security.mutateProtectedWork !== writerMethod || mobile.principalIdentity !== principalMethod) throw custodialWorkUnavailable();
        const status = security.getStatus();
        if (status?.ready !== true || status.available !== true || status.quarantined
          || status.generation !== generation || status.deviceId !== device || mobile.principalIdentity() !== principal) throw custodialWorkUnavailable();
        // Callbacks above cannot withdraw the captured facade/writer or alter
        // the observed readiness after their first check and still return us.
        if (window.MemphisCustodialSecurity !== security || security.native !== true
          || security.getStatus !== statusMethod || security.mutateProtectedWork !== writerMethod
          || window.MemphisMobile !== mobile || mobile.principalIdentity !== principalMethod
          || status.ready !== true || status.available !== true || status.quarantined
          || status.generation !== generation || status.deviceId !== device) throw custodialWorkUnavailable();
      } catch { throw custodialWorkUnavailable(); }
    };
    current(); return current;
  } catch { throw custodialWorkUnavailable(); }
}
// Named web sessions are read from the existing auth owner, never from an
// outbox/profile. This is a rejection fence, not a new authentication port.
const originalManagerOutboxOwners = new WeakMap();
const originalManagerReaderOwners = new WeakMap();
function originalManagerOutboxOwner(mapped, device, identityRef, accessEpoch, mounted, reader = false) {
  const held = () => Object.assign(new Error('Original manager session changed. Saved requests remain protected.'), {code:'messenger_original_manager_owner_held'});
  try {
    const profile = mapped && originalManagerReaderOwners.get(mapped);
    if (profile) {
      profile.current();
      if (profile.device !== device || profile.user !== mapped.msg_user_id || profile.readOnly !== mapped.read_only) throw held();
    }
    if (reader && mapped) {
      if (!profile) throw held(); // Never first-bind an older profile to today's session.
      const current = context => {
        profile.current(context);
        if (identityRef.current !== mapped || mapped.msg_user_id !== profile.user
          || mapped.canonical_device_id !== device || mapped.read_only !== profile.readOnly) throw held();
      };
      current(); return current;
    }
    const previous = mapped && originalManagerOutboxOwners.get(mapped);
    // A successor session cannot retry through a still-mounted old profile.
    // Only normal identity refresh may supply a new server-mapped object.
    if (previous) { if (previous.device !== device) throw held(); previous.current(); return previous.current; }
    const auth = window.MemphisAuth, read = auth?.readSession;
    const requireSession = auth?.requireOpsManagerSession, getDevice = auth?.getDeviceId;
    const isReadOnly = reader ? auth?.isReadOnlySession : null;
    const epoch = accessEpoch.current, user = mapped?.msg_user_id;
    const nativeOwner = originalCustodialIdentityGuard(device);
    if (typeof read !== 'function' || typeof requireSession !== 'function' || typeof getDevice !== 'function'
      || (reader ? mapped !== null || typeof isReadOnly !== 'function'
        : !isUuid(user) || mapped.read_only === true || mapped.canonical_device_id !== device)) throw held();
    const sessionBinding = () => {
      if (window.MemphisAuth !== auth || auth.readSession !== read || auth.requireOpsManagerSession !== requireSession
        || auth.getDeviceId !== getDevice || getDevice.call(auth) !== device
        || (reader && auth.isReadOnlySession !== isReadOnly)) throw held();
      const session = read.call(auth);
      if (typeof session?.token !== 'string' || !session.token || !isUuid(session.manager_id)
        || (reader ? typeof session.credential_id !== 'string' || (session.credential_id !== '' && !isUuid(session.credential_id)) : !isUuid(session.credential_id))
        || session.role !== 'ops_manager' || (reader
          ? !['read_only','full_access'].includes(session.access_level) || session.read_only !== (session.access_level === 'read_only')
          : session.read_only === true || session.access_level !== 'full_access')
        || session.device_id !== device || session.permissions?.schema !== 'custodial.manager-permissions.v1'
        || session.permissions.read !== true || !(Date.parse(session.expires_at) > Date.now())) throw held();
      return {session, snapshot:JSON.stringify({token:session.token,manager_id:session.manager_id,credential_id:session.credential_id,
        device_id:session.device_id,expires_at:session.expires_at,role:session.role,roles:session.roles,
        access_level:session.access_level,read_only:session.read_only,permissions:session.permissions})};
    };
    const original = sessionBinding();
    const current = context => {
      try {
        const check = () => {
          nativeOwner();
          if (!mounted.current || accessEpoch.current !== epoch || (!reader && (identityRef.current !== mapped || mapped.msg_user_id !== user
            || mapped.read_only === true || mapped.canonical_device_id !== device))) throw held();
          const latest = sessionBinding();
          if (latest.session !== original.session || latest.snapshot !== original.snapshot) throw held();
        };
        check();
        if (context) { if (typeof context.assertCurrent !== 'function') throw held(); context.assertCurrent(); check(); }
      } catch { throw held(); }
    };
    current(); if (!reader) originalManagerOutboxOwners.set(mapped,Object.freeze({device,current})); return current;
  } catch { throw held(); }
}
function custodialEmployeeMessage() {
  return typeof EMPLOYEE_CONTEXT !== 'undefined' && EMPLOYEE_CONTEXT && isNativeCustodialAuthority();
}
function originalMessageHeld() {
  return Object.assign(new Error('Original employee message is held until its protected sender mapping and generation are verified.'), {code:'messenger_original_owner_held'});
}
// The normal server profile must prove the sender relationship. Never build a
// profile from a user cache or stamp current principal fields onto an old row.
const originalEmployeeProfileOwners = new WeakMap();
function readOriginalEmployeeMessageOwner(mapped, deviceId) {
  const security = window.MemphisCustodialSecurity, mobile = window.MemphisMobile;
  const status = security?.getStatus?.(), p = status?.principal;
  const identity = mobile?.principalIdentity?.();
  const selected = mapped && {identity,generation:status?.generation,deviceId,userId:mapped.msg_user_id,
    employeeId:mapped.employee_id,credentialId:mapped.credential_id,assignmentEpoch:String(mapped.assignment_epoch)};
  if (security?.native !== true || status?.ready !== true || status.available !== true || status.quarantined
      || !Number.isSafeInteger(status.generation) || status.generation < 1
      || typeof identity !== 'string' || !identity || !p
      || !/^KIOSK_\d{2}$/.test(deviceId) || p.device_id !== deviceId || status.deviceId !== deviceId
      || !isUuid(p.employee_id) || !isUuid(p.credential_id) || !Number.isSafeInteger(p.assignment_epoch) || p.assignment_epoch < 1
      || !mapped || mapped.read_only === true || (Object.prototype.hasOwnProperty.call(mapped,'authenticated') && mapped.authenticated !== true)
      || !isUuid(mapped.msg_user_id)
      || mapped.employee_id !== p.employee_id || mapped.credential_id !== p.credential_id
      || mapped.assignment_epoch !== p.assignment_epoch || mapped.canonical_device_id !== deviceId
      || mobile?.profileMatchesPrincipal?.(mapped) !== true || mobile.principalIdentity() !== identity) throw originalMessageHeld();
  if (mapped.msg_user_id !== selected.userId || mapped.employee_id !== selected.employeeId
      || mapped.credential_id !== selected.credentialId || String(mapped.assignment_epoch) !== selected.assignmentEpoch
      || mapped.canonical_device_id !== deviceId || mapped.read_only === true) throw originalMessageHeld();
  return Object.freeze(selected);
}
function originalEmployeeProfileMatchesOwner(mapped, owner) {
  return mapped?.msg_user_id === owner.userId && mapped.employee_id === owner.employeeId
    && mapped.credential_id === owner.credentialId && mapped.assignment_epoch === Number(owner.assignmentEpoch)
    && mapped.canonical_device_id === owner.deviceId && mapped.read_only === false
    && (!Object.prototype.hasOwnProperty.call(mapped,'authenticated') || mapped.authenticated === true);
}
// The exact object comes only from this component's normal successful native
// profile request. Recheck its original owner and the full live tuple on every
// use; a public DTO flag or a copied profile never establishes this provenance.
function originalEmployeeMessageOwner(mapped, deviceId) {
  const original = mapped && originalEmployeeProfileOwners.get(mapped);
  if (!original) throw originalMessageHeld();
  original.current();
  const current = readOriginalEmployeeMessageOwner(mapped, deviceId);
  original.current();
  if (Object.keys(current).some(key => current[key] !== original.owner[key])) throw originalMessageHeld();
  return current;
}
function assertOriginalEmployeeMessageOwner(owner, mapped, deviceId, context) {
  if (context) {
    if (typeof context.assertCurrent !== 'function') throw originalMessageHeld();
    context.assertCurrent();
    if (context.generation !== owner.generation || context.deviceId !== owner.deviceId) throw originalMessageHeld();
  }
  const current = originalEmployeeMessageOwner(mapped, deviceId);
  if (Object.keys(owner).some(key => current[key] !== owner[key])) throw originalMessageHeld();
}
function employeeMessagePins(owner) {
  return {expected_employee_id:owner.employeeId,expected_credential_id:owner.credentialId,
    expected_assignment_epoch:owner.assignmentEpoch,security_generation:owner.generation};
}
function originalEmployeeMessageMatches(entry, owner) {
  return entry?.user_id === owner.userId && entry.device_id === owner.deviceId
    && entry.expected_employee_id === owner.employeeId && entry.expected_credential_id === owner.credentialId
    && entry.expected_assignment_epoch === owner.assignmentEpoch && entry.security_generation === owner.generation;
}
function employeeMessageRequestPins(entry) {
  return {expected_employee_id:entry.expected_employee_id,expected_credential_id:entry.expected_credential_id,
    expected_assignment_epoch:entry.expected_assignment_epoch};
}
function originalReadObjectKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.prototype.hasOwnProperty.call(value,key));
}
function originalReadInstant(value) {
  return typeof value === 'string' && value.length <= 64
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}
function validOriginalEmployeeRead(key,row,owner) {
  const keys = ['schema_version','id','thread_id','user_id','device_id','through_message_id',
    'through_at','created_at','expected_employee_id','expected_credential_id','expected_assignment_epoch','security_generation'];
  if (row?.delivery_attempted === true) keys.push('delivery_attempted');
  return originalReadObjectKeys(row,keys) && originalEmployeeMessageMatches(row,owner)
    && row.schema_version === 'chatscope-read-outbox.v2'
    && key === `mz_chatscope_read_outbox:${row.user_id}:${row.thread_id}`
    && row.id === `${row.user_id}:${row.thread_id}`
    && isUuid(row.thread_id) && isUuid(row.through_message_id)
    && Number.isSafeInteger(row.created_at) && row.created_at > 0
    && originalReadInstant(row.through_at);
}
function acceptedOriginalEmployeeRead(row,envelope) {
  const outcome = envelope?.meta?.original_outcome;
  const request = {device_id:row.device_id,...employeeMessageRequestPins(row),user_id:row.user_id,
    thread_id:row.thread_id,through_message_id:row.through_message_id};
  const actor = outcome?.original_actor, result = outcome?.result;
  if (envelope?.ok !== true
    || !originalReadObjectKeys(outcome,['schema','state','request_fingerprint','original_command',
      'original_actor','original_outcome_recorded','original_request','result','recorded_at',
      'inventory_acknowledged','finalizer_allowed','key_removal'])
    || outcome.schema !== 'custodial.employee-original-message-outcome.v1'
    || outcome.state !== 'ORIGINAL_TRANSACTION_OUTCOME_RECORDED'
    || outcome.original_command !== 'employee_message_original_read' || outcome.original_outcome_recorded !== true
    || typeof outcome.request_fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(outcome.request_fingerprint)
    || !originalReadInstant(outcome.recorded_at)
    || outcome.inventory_acknowledged !== false || outcome.finalizer_allowed !== false || outcome.key_removal !== false
    || !originalReadObjectKeys(outcome.original_request,Object.keys(request))
    || Object.keys(request).some(key => outcome.original_request[key] !== request[key])
    || !originalReadObjectKeys(actor,['device_pk','device_id','employee_id','credential_id','assignment_epoch','user_id'])
    || !isUuid(actor.device_pk) || actor.device_id !== row.device_id || actor.employee_id !== row.expected_employee_id
    || actor.credential_id !== row.expected_credential_id || actor.assignment_epoch !== row.expected_assignment_epoch
    || actor.user_id !== row.user_id
    || !originalReadObjectKeys(result,['marked','thread_id','user_id','through_message_id'])
    || !Number.isSafeInteger(result.marked) || result.marked < 0 || result.marked > 2147483647
    || result.thread_id !== row.thread_id || result.user_id !== row.user_id || result.through_message_id !== row.through_message_id
    || !originalMutationEqual(envelope.data,result)) {
    throw originalMessageHeld();
  }
}

const ORIGINAL_SEND_OUTBOX_SCHEMA = 'chatscope-message-outbox.v3';
const ORIGINAL_DELETE_OUTBOX_SCHEMA = 'chatscope-delete-outbox.v3';
function originalMutationInstant(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/);
  if(!m)return null;
  const [,y,mo,d,h,mi,s,f='',zone,zh='0',zm='0']=m,year=Number(y),month=Number(mo),day=Number(d);
  const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1]||Number(h)>23||Number(mi)>59||Number(s)>59||Number(zh)>23||Number(zm)>59)return null;
  const ms=Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}${zone}`);
  return Number.isFinite(ms)?BigInt(ms)*1000n+BigInt(f.padEnd(6,'0')):null;
}
function originalMutationEqual(value,expected) {
  return originalReadObjectKeys(value,Object.keys(expected)) && Object.keys(expected).every(key=>{
    const wanted=expected[key];
    return wanted!==null&&typeof wanted==='object' ? originalMutationEqual(value[key],wanted) : value[key]===wanted;
  });
}
function validOriginalEmployeeAction(row,kind) {
  const keys=['schema_version','id','thread_id','user_id','device_id','created_at','security_generation',
    'expected_employee_id','expected_credential_id','expected_assignment_epoch'];
  if(kind==='send')keys.push('body','memphis','message_type','metadata_json');
  if(row?.delivery_attempted===true)keys.push('delivery_attempted');
  return originalReadObjectKeys(row,keys)&&isUuid(row.thread_id)&&isUuid(row.user_id)
    &&isUuid(row.expected_employee_id)&&isUuid(row.expected_credential_id)
    &&typeof row.expected_assignment_epoch==='string'&&/^[1-9][0-9]{0,15}$/.test(row.expected_assignment_epoch)
    &&BigInt(row.expected_assignment_epoch)<=9007199254740991n
    &&Number.isSafeInteger(row.created_at)&&row.created_at>0&&Number.isSafeInteger(row.security_generation)&&row.security_generation>0
    &&(kind==='send' ? row.schema_version===ORIGINAL_SEND_OUTBOX_SCHEMA&&/^msg:/.test(row.id)&&isUuid(row.id.slice(4))
      &&row.memphis===false&&row.message_type==='text'&&originalReadObjectKeys(row.metadata_json,[])
      &&typeof row.body==='string'&&row.body.trim().length>0&&Array.from(row.body).length<=2000
      : [ORIGINAL_DELETE_OUTBOX_SCHEMA,'chatscope-delete-outbox.v2'].includes(row.schema_version)&&isUuid(row.id));
}
function acceptedOriginalEmployeeAction(row,envelope,kind) {
  const o=envelope?.meta?.original_outcome,r=o?.result;
  const request={device_id:row.device_id,...employeeMessageRequestPins(row),user_id:row.user_id,thread_id:row.thread_id,
    ...(kind==='send'?{body:row.body,message_type:'text',metadata_json:{},client_message_id:row.id}:{operation_id:row.id})};
  if(envelope?.ok!==true||!originalReadObjectKeys(o,['schema','state','request_fingerprint','original_command','original_actor',
      'original_outcome_recorded','original_request','result','recorded_at','inventory_acknowledged','finalizer_allowed','key_removal'])
      ||o.schema!=='custodial.employee-original-message-outcome.v1'||o.state!=='ORIGINAL_TRANSACTION_OUTCOME_RECORDED'
      ||o.original_command!==`employee_message_original_${kind}`||o.original_outcome_recorded!==true
      ||typeof o.request_fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(o.request_fingerprint)||originalMutationInstant(o.recorded_at)===null
      ||o.inventory_acknowledged!==false||o.finalizer_allowed!==false||o.key_removal!==false
      ||!originalMutationEqual(o.original_request,request)
      ||!originalReadObjectKeys(o.original_actor,['device_pk','device_id','employee_id','credential_id','assignment_epoch','user_id'])
      ||!isUuid(o.original_actor.device_pk)||!originalMutationEqual(o.original_actor,{device_pk:o.original_actor.device_pk,
        device_id:row.device_id,employee_id:row.expected_employee_id,credential_id:row.expected_credential_id,
        assignment_epoch:row.expected_assignment_epoch,user_id:row.user_id}))throw originalMessageHeld();
  if(kind==='send') {
    if(!originalReadObjectKeys(r,['id','thread_id','sender_user_id','message_type','body','metadata_json','sent_at','created_at',
        'is_deleted','client_message_id','updated_at','deleted_at','deleted_by_user_id','purge_after'])
        ||!isUuid(r.id)||r.thread_id!==row.thread_id||r.sender_user_id!==row.user_id||r.message_type!=='text'
        ||r.body!==row.body.replace(/^ +| +$/g,'')||r.client_message_id!==row.id||r.is_deleted!==false
        ||r.deleted_at!==null||r.deleted_by_user_id!==null||r.purge_after!==null
        ||!originalMutationEqual(r.metadata_json,{client_message_id:row.id})
        ||['sent_at','created_at','updated_at'].some(key=>originalMutationInstant(r[key])===null))throw originalMessageHeld();
  }else{
    const keys=['ok','deleted','thread_id','operation_id','deletion_scope','deleted_at','deleted_through','replayed'];
    if(Object.prototype.hasOwnProperty.call(r||{},'user_id'))keys.push('user_id');
    if(Object.prototype.hasOwnProperty.call(r||{},'memphis_generation_ended'))keys.push('memphis_generation_ended');
    const at=originalMutationInstant(r?.deleted_at),through=originalMutationInstant(r?.deleted_through);
    if(!originalReadObjectKeys(r,keys)||r.ok!==true||r.deleted!==true||r.thread_id!==row.thread_id||r.operation_id!==row.id
        ||r.deletion_scope!=='user'||typeof r.replayed!=='boolean'||at===null||through===null||through<at
        ||(keys.includes('user_id')&&r.user_id!==row.user_id)
        ||(keys.includes('memphis_generation_ended')&&typeof r.memphis_generation_ended!=='boolean'))throw originalMessageHeld();
  }
  if(!originalMutationEqual(envelope.data,r))throw originalMessageHeld();
}
async function deliverOriginalEmployeeAction(row,raw,owner,getMapped,deviceId,key,kind) {
  const expectedKeys=kind==='delete'?[`mz_chatscope_delete_outbox:${row.id}`]
    :[`mz_chatscope_outbox:${row.id}`,`mz_messenger_v2_outbox:${row.id}`];
  if(!validOriginalEmployeeAction(row,kind)||!originalEmployeeMessageMatches(row,owner)
      ||!expectedKeys.includes(key))throw originalMessageHeld();
  const queryOnly=row.delivery_attempted===true||(kind==='delete'&&row.schema_version!=='chatscope-delete-outbox.v3');
  const attempted=queryOnly?raw:JSON.stringify({...row,delivery_attempted:true});
  const assert=(expected,context)=>{
    assertOriginalEmployeeMessageOwner(owner,getMapped(),deviceId,context);
    if(localStorage.getItem(key)!==expected)throw originalMessageHeld();
  };
  await mutateCustodialWork(context=>{
    assert(raw,context);if(!queryOnly)localStorage.setItem(key,attempted);
    assert(attempted,context);
  },{requireEnrollment:true,expectedGeneration:owner.generation});
  assert(attempted);
  const body={...(kind==='send'?{sender_user_id:row.user_id,body:row.body,message_type:'text',metadata_json:{},client_message_id:row.id}
    :{user_id:row.user_id,operation_id:row.id}),device_id:row.device_id,...employeeMessageRequestPins(row)};
  const response=await api(`/thread/${encodeURIComponent(row.thread_id)}/${kind==='send'?'message':'delete'}${queryOnly?'/original-outcome':''}`,
    {method:'POST',expectedGeneration:owner.generation,body});
  assert(attempted);acceptedOriginalEmployeeAction(row,response,kind);
  await mutateCustodialWork(context=>{
    assert(attempted,context);localStorage.removeItem(key);
    assertOriginalEmployeeMessageOwner(owner,getMapped(),deviceId,context);
    if(localStorage.getItem(key)!==null)throw originalMessageHeld();
  },{requireEnrollment:true,expectedGeneration:owner.generation});
  assertOriginalEmployeeMessageOwner(owner,getMapped(),deviceId);
  return response.meta.original_outcome.result;
}

function hasEmployeeMessagePins(entry) {
  return ['expected_employee_id','expected_credential_id','expected_assignment_epoch'].some(key => hasOwn(entry,key));
}
function deleteOutboxKey(id) { return `mz_chatscope_delete_outbox:${id}`; }
function readOutboxKey(userId, threadId) { return `mz_chatscope_read_outbox:${userId}:${threadId}`; }
function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function hasOwn(row, key) { return Object.prototype.hasOwnProperty.call(row || {}, key); }
function hasNonemptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function isSecurityGeneration(value) { return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1); }
function matchingIdentity(row, userId, currentDeviceId) {
  return hasNonemptyString(userId) && hasNonemptyString(currentDeviceId)
    && String(row?.user_id || '') === String(userId)
    && String(row?.device_id || '') === String(currentDeviceId);
}
function expectedGenerationOptions(securityGeneration) {
  return { requireEnrollment: true, expectedGeneration: isSecurityGeneration(securityGeneration) ? securityGeneration : null };
}
// Match JavaScript API and PostgreSQL Unicode code-point limits, not UTF-16 units.
function messageLength(value) { return Array.from(String(value || '')).length; }
function plainMessageBody(value) { return String(value || '').trim(); }
function composerHtml(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>'); }
const EMOJI_CHOICES = [['👍','Thumbs up'],['✅','Check mark'],['🙂','Smile'],['🙏','Thanks'],['👀','Looking'],['💬','Message'],['⚠️','Warning'],['🛠️','Tools'],['🧹','Broom'],['🗑️','Wastebasket'],['💧','Water'],['🚻','Restroom'],['🦁','Lion'],['🐘','Elephant'],['❤️','Heart'],['🎉','Celebration']];
function mergePendingMessages(rows, threadId, userId, currentDeviceId) {
  const known = new Set(rows.flatMap(row => [row.id, row.client_message_id, row.metadata_json?.client_message_id].filter(Boolean)));
  const pending = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('mz_chatscope_outbox:')) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key) || 'null');
      if (!matchingIdentity(entry, userId, currentDeviceId) || entry.thread_id !== threadId || known.has(entry.id)
          || !isValidMessageOutboxEntry(entry.schema_version===ORIGINAL_SEND_OUTBOX_SCHEMA?entry:{...entry, recovery_state: undefined}, key)) continue;
      pending.push({id:entry.id, thread_id:threadId, sender_user_id:userId, body:entry.body,
        sent_at:new Date(Math.floor(Number(entry.created_at) > 1e14 ? Number(entry.created_at) / 1000 : Number(entry.created_at))).toISOString(),
        optimistic:!entry.last_error, failed:Boolean(entry.last_error), locallyQueued:true,
        recovery_state:entry.recovery_state, queue_order:Number(entry.created_at)});
    } catch { /* Invalid entries remain available to the existing recovery panel. */ }
  }
  return [...rows, ...pending.sort((a,b)=>a.queue_order-b.queue_order)];
}
const activeMessengerRequests = new Set();
function htmlMessageBody(value) { return String(value || '').replace(/<[^>]*>/g, '').trim(); }
function messageBodyFromChatScopeArgs(args = []) {
  const plainText = [args[2], args[1]]
    .filter((value) => typeof value === 'string')
    .map(plainMessageBody)
    .find(Boolean);
  return plainText || htmlMessageBody(args[0]);
}
function isValidMessageOutboxEntry(row, key = '') {
  const body = plainMessageBody(row?.body);
  return row && typeof row === 'object' && !Array.isArray(row)
    && (row.schema_version === MESSAGE_OUTBOX_SCHEMA || (row.schema_version === ORIGINAL_SEND_OUTBOX_SCHEMA && validOriginalEmployeeAction(row,'send')))
    && typeof row.id === 'string' && /^msg:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)
    && (!key || key === outboxKey(row.id))
    && isUuid(row.thread_id)
    && isUuid(row.user_id)
    && hasNonemptyString(row.device_id)
    && typeof row.body === 'string'
    && messageLength(body) > 0 && messageLength(body) <= MAX_MESSAGE_LENGTH
    && typeof row.memphis === 'boolean'
    && hasOwn(row, 'security_generation') && isSecurityGeneration(row.security_generation)
    && row.recovery_state !== 'permanent'
    && Number.isFinite(Number(row.created_at));
}
function acceptedMessageSendReceipt(entry, envelope) {
  const message = entry.memphis ? envelope?.data?.user_message : envelope?.data;
  const uuidMatches = (actual, expected) => isUuid(actual) && isUuid(expected)
    && actual.toLowerCase() === expected.toLowerCase();
  // The ordinary RPC applies PostgreSQL btrim's ASCII edge-space rule; the
  // Memphis adapter additionally applies the existing plain-text trim.
  const expectedBody = entry.memphis ? plainMessageBody(entry.body) : String(entry.body).replace(/^ +| +$/g, '');
  if (envelope?.ok !== true || !message || typeof message !== 'object' || Array.isArray(message)
      || !isUuid(message.id)
      || !uuidMatches(message.thread_id, entry.thread_id)
      || !uuidMatches(message.sender_user_id, entry.user_id)
      || message.client_message_id !== entry.id
      || message.message_type !== 'text'
      || message.body !== expectedBody) {
    throw Object.assign(new Error('Server confirmation did not match the saved message. The original message remains saved.'), {
      code: 'messenger_unbound_send_receipt', retryable: true,
    });
  }
  return message;
}
function isValidDeleteOutboxEntry(row, key = '') {
  return row && typeof row === 'object' && !Array.isArray(row)
    && (row.schema_version === DELETE_OUTBOX_SCHEMA || row.schema_version === ORIGINAL_DELETE_OUTBOX_SCHEMA)
    && isUuid(row.id)
    && (!key || key === deleteOutboxKey(row.id))
    && isUuid(row.thread_id)
    && isUuid(row.user_id)
    && hasNonemptyString(row.device_id)
    && hasOwn(row, 'security_generation') && isSecurityGeneration(row.security_generation)
    && row.recovery_state !== 'permanent'
    && Number.isFinite(Number(row.created_at));
}
async function retireAcceptedDeletion(entry, envelope, key, expectedBytes, assertOriginal) {
  assertOriginal?.();
  const receipt = envelope?.data;
  const matches = (actual, expected) => isUuid(actual) && isUuid(expected)
    && actual.toLowerCase() === expected.toLowerCase();
  const instant = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? Date.parse(value) : NaN;
  const deletedAt = instant(receipt?.deleted_at), through = instant(receipt?.deleted_through);
  if (envelope?.ok !== true || receipt?.ok !== true || receipt.deleted !== true
    || receipt.deletion_scope !== 'user' || !matches(receipt.thread_id, entry.thread_id)
    || !matches(receipt.user_id, entry.user_id) || !matches(receipt.operation_id, entry.id)
    || !Number.isFinite(deletedAt) || !Number.isFinite(through) || through < deletedAt) {
    throw new Error('Conversation removal confirmation did not match the saved request. It remains saved.');
  }
  await mutateCustodialWork((context) => {
    assertOriginal?.(context);
    if (localStorage.getItem(key) !== expectedBytes) throw new Error('Saved conversation removal changed during delivery.');
    localStorage.removeItem(key);
    assertOriginal?.(context);
    if (localStorage.getItem(key) !== null) throw new Error('Accepted conversation removal remains saved until cleanup is confirmed.');
  }, expectedGenerationOptions(entry.security_generation));
  assertOriginal?.();
}
function originalMutationAssertion(owner, getMapped, deviceId, key, raw) {
  return (context) => {
    assertOriginalEmployeeMessageOwner(owner,getMapped(),deviceId,context);
    if (localStorage.getItem(key) !== raw) throw originalMessageHeld();
  };
}
async function deliverOriginalEmployeeDeletion(entry, raw, owner, getMapped, deviceId) {
  return deliverOriginalEmployeeAction(entry,raw,owner,getMapped,deviceId,deleteOutboxKey(entry.id),'delete');
}
async function attemptOriginalEmployeeRead(key, row, raw, owner, getMapped, deviceId) {
  if (!validOriginalEmployeeRead(key,row,owner)) return;
  const assert = originalMutationAssertion(owner,getMapped,deviceId,key,raw);
  const queryOnly = row.delivery_attempted === true;
  const attempted = queryOnly ? raw : JSON.stringify({...row,delivery_attempted:true});
  await mutateCustodialWork(context => {
    assert(context);
    if (!queryOnly) localStorage.setItem(key,attempted);
    assertOriginalEmployeeMessageOwner(owner,getMapped(),deviceId,context);
    if (localStorage.getItem(key) !== attempted) throw originalMessageHeld();
  },expectedGenerationOptions(owner.generation));
  const current = originalMutationAssertion(owner,getMapped,deviceId,key,attempted);
  current();
  // Recovery reads only this saved action's immutable outcome, never repeats it.
  const receipt = await api(`/thread/${encodeURIComponent(row.thread_id)}/read${queryOnly ? '/original-outcome' : ''}`,{method:'POST',expectedGeneration:owner.generation,
    body:{user_id:row.user_id,device_id:row.device_id,through_message_id:row.through_message_id,...employeeMessageRequestPins(row)}});
  current();
  acceptedOriginalEmployeeRead(row,receipt);
  await mutateCustodialWork(context => {
    current(context);
    localStorage.removeItem(key);
    assertOriginalEmployeeMessageOwner(owner,getMapped(),deviceId,context);
    if (localStorage.getItem(key) !== null) throw originalMessageHeld();
  },expectedGenerationOptions(owner.generation));
  assertOriginalEmployeeMessageOwner(owner,getMapped(),deviceId);
}
let outboxOrderCounter = 0;
function nextOutboxOrder() {
  outboxOrderCounter = (outboxOrderCounter + 1) % 1000;
  return (Date.now() * 1000) + outboxOrderCounter;
}
function compareReadHorizon(left, right) {
  const leftAt = Date.parse(String(left?.through_at || '')) || 0;
  const rightAt = Date.parse(String(right?.through_at || '')) || 0;
  if (leftAt !== rightAt) return leftAt - rightAt;
  return String(left?.through_message_id || '').localeCompare(String(right?.through_message_id || ''));
}
function employeeSafeError() { return navigator.onLine === false ? 'No connection. Your change is saved.' : 'Something went wrong. Try again.'; }
function pendingDeletedThreadIds(userId, currentDeviceId, mapped) {
  const ids = new Set();
  let owner;
  if (custodialEmployeeMessage()) {
    try { owner = originalEmployeeMessageOwner(mapped,currentDeviceId); } catch { return ids; }
  }
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('mz_chatscope_delete_outbox:')) continue;
    try {
      const row = JSON.parse(localStorage.getItem(key) || 'null');
      if (isValidDeleteOutboxEntry(row, key) && matchingIdentity(row, userId, currentDeviceId)
          && (owner ? originalEmployeeMessageMatches(row,owner) : !hasEmployeeMessagePins(row))) ids.add(String(row.thread_id));
    } catch {}
  }
  return ids;
}
async function custodialSecurityPaused() {
  try {
    const security = custodialWorkSecurity();
    if (!security) return false;
    if (typeof security.waitForStableState === 'function') await security.waitForStableState({ requireEnrollment: true });
    if (custodialWorkSecurity() !== security) return true;
    const status = typeof security.getStatus === 'function' ? security.getStatus() : null;
    return status?.ready !== true || status?.quarantined === true || status?.available === false;
  } catch { return true; }
}
function securityPauseError(error) {
  return ['custodial_restore_quarantine', 'custodial_secure_storage_unavailable', 'custodial_security_state_unavailable', 'custodial_security_generation_changed', 'custodial_device_not_enrolled', 'custodial_enrollment_confirmation_pending', 'custodial_enrollment_removal_pending'].includes(String(error?.code || ''));
}
async function mutateCustodialWork(operation, options = { requireEnrollment: true }) {
  const security = custodialWorkSecurity();
  if (!security) return operation();
  let generation, device, principal, mutate, originalIdentity;
  try {
    const status = security.getStatus();
    generation = status?.generation; device = status?.deviceId;
    if (!status?.principal || typeof status.principal !== 'object' || Array.isArray(status.principal)
      || !Number.isSafeInteger(generation) || generation < 1 || typeof device !== 'string' || !device
      || typeof operation !== 'function' || !options || typeof options !== 'object' || Array.isArray(options)) throw custodialWorkUnavailable();
    // Exact full original principal snapshot, including installation/activation
    // fields. This is a rejection fence, not authentication of caller JSON.
    principal = JSON.stringify(status.principal);
    mutate = security.mutateProtectedWork;
    originalIdentity = originalCustodialIdentityGuard(device);
    if (options.expectedGeneration != null && options.expectedGeneration !== generation) throw custodialWorkUnavailable();
  } catch { throw custodialWorkUnavailable(); }
  const bounded = Object.freeze({...options, requireEnrollment:true, expectedGeneration:generation});
  const current = () => {
    try {
      originalIdentity();
      if (custodialWorkSecurity() !== security || security.mutateProtectedWork !== mutate) throw custodialWorkUnavailable();
      const status = security.getStatus();
      if (status?.generation !== generation || status?.deviceId !== device || JSON.stringify(status?.principal) !== principal) throw custodialWorkUnavailable();
    } catch { throw custodialWorkUnavailable(); }
  };
  current();
  try {
    return await mutate.call(security, async context => {
      const owned = () => {
        current();
        if (typeof context?.assertCurrent !== 'function' || context.generation !== generation || context.deviceId !== device) throw custodialWorkUnavailable();
        context.assertCurrent(); current();
      };
      owned();
      try { return await operation(context); } finally { owned(); }
    }, bounded);
  } finally {
    // The runtime closes its context before settling. Never call it here.
    current();
  }
}
async function retainOutboxFailure(entry, error, expectedBytes, assertOriginal) {
  assertOriginal?.();
  if (securityPauseError(error)) return;
  await mutateCustodialWork((context) => {
    assertOriginal?.(context);
    if (localStorage.getItem(outboxKey(entry.id)) !== expectedBytes) return;
    localStorage.setItem(outboxKey(entry.id), JSON.stringify({
      ...entry,
      retry_count: Number(entry.retry_count || 0) + 1,
      last_attempt_at: Date.now(),
      last_error: safe(error).slice(0, 500),
    }));
    assertOriginal?.(context);
  }, expectedGenerationOptions(entry.security_generation));
  assertOriginal?.();
}
function isPermanentOutboxError(error) {
  const status = Number(error?.status || error?.httpStatus || 0);
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 408 && status !== 429;
}
async function retainPermanentOutboxFailure(entry, error, expectedBytes, assertOriginal) {
  assertOriginal?.();
  if (securityPauseError(error)) return false;
  const key = outboxKey(entry.id);
  const retained = await mutateCustodialWork((context) => {
    assertOriginal?.(context);
    if (localStorage.getItem(key) !== expectedBytes) return false;
    let latest = null;
    try { latest = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
    if (!latest || latest.id !== entry.id) return false;
    localStorage.setItem(key, JSON.stringify({
      ...latest,
      recovery_state: 'permanent',
      last_attempt_at: Date.now(),
      last_error: safe(error).slice(0, 500),
    }));
    assertOriginal?.(context); return true;
  }, expectedGenerationOptions(entry.security_generation));
  assertOriginal?.(); return retained;
}
async function retainPermanentDeleteFailure(entry, error, key, expectedBytes, assertOriginal) {
  assertOriginal?.();
  if (securityPauseError(error)) return false;
  const retained = await mutateCustodialWork((context) => {
    assertOriginal?.(context);
    if (localStorage.getItem(key) !== expectedBytes) return false;
    let latest = null;
    try { latest = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
    if (!latest || latest.id !== entry.id) return false;
    localStorage.setItem(key, JSON.stringify({
      ...latest,
      recovery_state: 'permanent',
      last_attempt_at: Date.now(),
      last_error: safe(error).slice(0, 500),
    }));
    assertOriginal?.(context); return true;
  }, expectedGenerationOptions(entry.security_generation));
  assertOriginal?.(); return retained;
}

async function resolveAuthHeaders() {
  if (EMPLOYEE_CONTEXT && !window.MemphisCustodialSecurity?.native) return { 'X-Device-Id': employeeDeviceId() };
  const session = await window.MemphisAuth?.requireOpsManagerSession?.({
    accessLevel: 'full_access', interactive: true, redirect: false, throwOnFailure: true,
  });
  if (!session?.token) throw new Error('Named Operations Leadership access is required.');
  return { Authorization: `Bearer ${session.token}`, 'X-Device-Id': session.device_id || window.MemphisAuth?.getDeviceId?.() || '' };
}
function deviceId() {
  if (EMPLOYEE_CONTEXT || isNativeCustodialAuthority()) return employeeDeviceId();
  return window.MemphisAuth?.getDeviceId?.()
    || localStorage.getItem('mz_scan_device_id')
    || localStorage.getItem('memphisAssignedDeviceId')
    || '';
}
async function api(path, { method = 'GET', body, signal, expectedGeneration, assertCurrent } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, {once:true});
  // A stalled response never holds the message/read delivery queue indefinitely.
  const timer = setTimeout(() => controller.abort(new DOMException('Messenger request timed out', 'TimeoutError')),
    path.includes('/updates?') ? 25000 : 15000);
  activeMessengerRequests.add(controller);
  try {
    assertCurrent?.();
    if (window.MemphisMobile?.requestEnvelope) {
      const envelope = await window.MemphisMobile.requestEnvelope(`/messaging-api${path}`, { method, body, signal:controller.signal, ...(expectedGeneration === undefined ? {} : {expectedGeneration}) });
      assertCurrent?.();
      return envelope;
    }
    if (custodialEmployeeMessage()) throw originalMessageHeld();
    const auth = await resolveAuthHeaders();
    assertCurrent?.();
    if (controller.signal.aborted) throw controller.signal.reason;
    const response = await fetch(`${API}${path}`, {
      method, cache:'no-store', signal:controller.signal,
      headers:{...auth,...(body ? {'Content-Type':'application/json'} : {})},
      body:body ? JSON.stringify(body) : undefined,
    });
    assertCurrent?.();
    const payload = await response.json().catch(() => null);
    assertCurrent?.();
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status; error.code = payload?.code || payload?.error_code || '';
      throw error;
    }
    return payload;
  } catch (error) {
    if ([401,403].includes(Number(error?.status || error?.httpStatus))) {
      window.dispatchEvent(new CustomEvent('memphis:messenger-access-denied'));
    }
    throw error;
  } finally {
    clearTimeout(timer); activeMessengerRequests.delete(controller); signal?.removeEventListener('abort', abort);
  }
}

function readOriginalGroupIntent(userId, ownerDeviceId) {
  let raw = null, legacyRaw = null;
  try {
    const key = `mz_chatscope_group_pending:${userId}`;
    raw = localStorage.getItem(key); legacyRaw = sessionStorage.getItem(key);
    if (raw === null && legacyRaw === null) return {row:null, raw, legacyRaw, held:false};
    if (raw !== null && legacyRaw !== null && raw !== legacyRaw) throw new Error('conflicting group');
    const row = JSON.parse(raw ?? legacyRaw);
    if (!originalReadObjectKeys(row,['created_by_user_id','member_user_ids','title','device_id','client_thread_id'])
        || row.created_by_user_id !== userId || !isUuid(userId) || row.device_id !== ownerDeviceId || !ownerDeviceId
        || typeof row.client_thread_id !== 'string' || !row.client_thread_id.startsWith('thread:') || !isUuid(row.client_thread_id.slice(7))
        || !Array.isArray(row.member_user_ids) || row.member_user_ids.length < 2 || row.member_user_ids.length > 100
        || row.member_user_ids.some(id => !isUuid(id) || id === userId)
        || new Set(row.member_user_ids).size !== row.member_user_ids.length
        || !(row.title === null || (typeof row.title === 'string' && row.title.length > 0 && row.title.length <= 120 && row.title.trim() === row.title))) {
      throw new Error('held group');
    }
    return {row:Object.freeze({...row,member_user_ids:Object.freeze([...row.member_user_ids])}),raw,legacyRaw,held:false};
  } catch { return {row:null,raw,legacyRaw,held:true}; }
}

function NewConversation({ currentUserId, currentDeviceId, getCurrentIdentity, onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const groupKey = `mz_chatscope_group_pending:${currentUserId}`;
  const [pendingGroup, setPendingGroup] = useState(() => readOriginalGroupIntent(currentUserId,currentDeviceId));
  const hasPendingGroup = pendingGroup.held || pendingGroup.raw !== null || pendingGroup.legacyRaw !== null;
  const [selected, setSelected] = useState(new Set(pendingGroup.row?.member_user_ids || []));
  const [title, setTitle] = useState(pendingGroup.row?.title || '');
  const creating = useRef(false);
  const alive = useRef(true);
  const current = useRef(null);
  current.current = {currentUserId,currentDeviceId,getCurrentIdentity};
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function captureOwner() {
    const mapped = getCurrentIdentity?.();
    const auth = window.MemphisAuth;
    const sessionBinding = () => {
      if (EMPLOYEE_CONTEXT) return null;
      if (window.MemphisAuth !== auth) throw new Error('conversation owner changed');
      const session = auth?.readSession?.();
      if (!session?.token || session.role !== 'ops_manager' || session.read_only === true
          || session.access_level !== 'full_access' || session.device_id !== currentDeviceId
          || session.permissions?.schema !== 'custodial.manager-permissions.v1' || session.permissions.read !== true
          || !(Date.parse(session.expires_at) > Date.now())) throw new Error('conversation owner changed');
      return JSON.stringify({token:session.token,manager_id:session.manager_id,credential_id:session.credential_id,
        device_id:session.device_id,expires_at:session.expires_at,role:session.role,roles:session.roles,
        access_level:session.access_level,read_only:session.read_only,permissions:session.permissions});
    };
    if (!alive.current || !isUuid(currentUserId) || mapped?.msg_user_id !== currentUserId || mapped.read_only === true
        || mapped.canonical_device_id !== currentDeviceId || deviceId() !== currentDeviceId) {
      throw new Error('conversation owner changed');
    }
    const session = sessionBinding();
    const employeeOwner = custodialEmployeeMessage() ? originalEmployeeMessageOwner(mapped,currentDeviceId) : null;
    return context => {
      if (!alive.current || current.current.currentUserId !== currentUserId || current.current.currentDeviceId !== currentDeviceId
          || current.current.getCurrentIdentity?.() !== mapped || mapped.msg_user_id !== currentUserId || mapped.read_only === true
          || mapped.canonical_device_id !== currentDeviceId || deviceId() !== currentDeviceId || sessionBinding() !== session) throw new Error('conversation owner changed');
      if (employeeOwner) assertOriginalEmployeeMessageOwner(employeeOwner,mapped,currentDeviceId,context);
      else context?.assertCurrent?.();
    };
  }
  const dialogRef = useRef(null);
  const dialogClose = useRef(onClose);
  dialogClose.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.focus();
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!creating.current) dialogClose.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault(); first.focus();
      }
    };
    dialog?.addEventListener('keydown', keydown);
    return () => { dialog?.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  const [status, setStatus] = useState('Loading people…');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pendingGroup.row || pendingGroup.raw !== null || pendingGroup.legacyRaw === null) return undefined;
    let active = true;
    const saved = pendingGroup;
    (async () => {
      const owner = captureOwner();
      const assertCurrent = context => { if (!active) throw new Error('group dialog retired'); owner(context); };
      await mutateCustodialWork(context => {
        assertCurrent(context);
        if (localStorage.getItem(groupKey) !== null || sessionStorage.getItem(groupKey) !== saved.legacyRaw) throw new Error('group original changed');
        localStorage.setItem(groupKey,saved.legacyRaw);
        assertCurrent(context);
        if (localStorage.getItem(groupKey) !== saved.legacyRaw || sessionStorage.getItem(groupKey) !== saved.legacyRaw) throw new Error('group save not confirmed');
      });
      assertCurrent();
      setPendingGroup({...saved,raw:saved.legacyRaw});
    })().catch(() => { if (active) setStatus('Saved group is held. Its durable copy could not be confirmed.'); });
    return () => { active = false; };
  }, [currentUserId,currentDeviceId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setUsers([]);
    setStatus('Loading people…');
    let assertCurrent;
    try { assertCurrent = captureOwner(); } catch { setStatus('Conversation owner changed. Reopen Messages.'); return () => { active = false; clearTimeout(timeout); controller.abort(); }; }
    api(`/users?user_id=${encodeURIComponent(currentUserId)}&device_id=${encodeURIComponent(currentDeviceId)}`, { signal: controller.signal, assertCurrent })
      .then((envelope) => {
        if (!active) return;
        assertCurrent();
        const rows = (envelope.data || []).filter((user) => user.is_active !== false && user.role !== 'bot' && String(user.id) !== currentUserId);
        setUsers(rows);
        setStatus(pendingGroup.held ? 'Saved group is held. Its original request could not be verified.' : '');
      })
      .catch(() => active && setStatus('People could not load.'))
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [currentUserId, currentDeviceId, loadAttempt]);

  function toggle(id) {
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function create(otherUserId = '') {
    const memberIds = EMPLOYEE_CONTEXT ? [otherUserId] : [...selected];
    if (!memberIds[0] || busy || creating.current) return;
    creating.current = true;
    setBusy(true);
    setStatus(EMPLOYEE_CONTEXT ? 'Opening…' : 'Creating conversation…');
    let groupRaw = null;
    try {
      const assertCurrent = captureOwner();
      let groupBody = null, legacyRaw = null;
      const assertGroup = (expectedLegacy, context) => {
        assertCurrent(context);
        if (localStorage.getItem(groupKey) !== groupRaw || sessionStorage.getItem(groupKey) !== expectedLegacy) throw new Error('group original changed');
      };
      if (memberIds.length > 1) {
        const saved = readOriginalGroupIntent(currentUserId,currentDeviceId);
        if (saved.held || pendingGroup.held || saved.raw !== pendingGroup.raw || saved.legacyRaw !== pendingGroup.legacyRaw) throw new Error('group original held');
        if (memberIds.length > 100 || memberIds.some(id => !isUuid(id) || id === currentUserId)
            || new Set(memberIds).size !== memberIds.length || title.trim().length > 120) throw new Error('invalid group');
        groupBody = saved.row;
        groupRaw = saved.raw ?? saved.legacyRaw;
        legacyRaw = saved.legacyRaw;
        // Copy the original bytes into protected durable storage before any
        // request. A session original remains intact until its exact result.
        await mutateCustodialWork(context => {
          assertCurrent(context);
          if (localStorage.getItem(groupKey) !== saved.raw || sessionStorage.getItem(groupKey) !== legacyRaw) throw new Error('group original changed');
          if (!groupBody) {
            groupBody = Object.freeze({created_by_user_id:currentUserId,member_user_ids:Object.freeze([...memberIds]),
              title:title.trim() || null,device_id:currentDeviceId,client_thread_id:operationId('thread')});
            groupRaw = JSON.stringify(groupBody);
          }
          if (saved.raw === null) localStorage.setItem(groupKey,groupRaw);
          assertGroup(legacyRaw,context);
        });
        assertGroup(legacyRaw);
        setPendingGroup({row:groupBody,raw:groupRaw,legacyRaw,held:false});
      }
      assertCurrent();
      const envelope = memberIds.length === 1
        ? (await api('/thread/direct', { method: 'POST', body: {
          created_by_user_id: currentUserId,
          other_user_id: memberIds[0],
          device_id: currentDeviceId,
        }, assertCurrent }))
        : (await api('/thread/group', { method:'POST', body:groupBody, assertCurrent }));
      assertCurrent();
      if (envelope?.ok !== true) throw new Error('conversation result not confirmed');
      const thread = envelope.data;
      const result = Array.isArray(thread) && thread.length === 1 ? thread[0] : thread;
      const id = result?.id || result?.thread_id;
      if (!isUuid(id)) throw new Error('conversation');
      let retireOriginal = null;
      if (groupBody) {
        assertGroup(legacyRaw);
        // Only the immutable original tuple returned by the normal group RPC
        // can match this operation. Current title/members can legitimately
        // change later and are neither its original body nor its acceptance.
        const original = result?.original_group_creation;
        if (!isUuid(result?.id) || result.thread_type !== 'group' || result.created_by_user_id !== groupBody.created_by_user_id
            || result.client_thread_id !== groupBody.client_thread_id || result.is_active !== true || result.deleted_at != null
            || !originalReadObjectKeys(original,['schema','created_by_user_id','client_thread_id','title','member_user_ids'])
            || original.schema !== 'custodial.group-original-creation.v1'
            || original.created_by_user_id !== groupBody.created_by_user_id || original.client_thread_id !== groupBody.client_thread_id
            || original.title !== groupBody.title || !Array.isArray(original.member_user_ids)
            || original.member_user_ids.length !== groupBody.member_user_ids.length
            || original.member_user_ids.some((member,index) => member !== groupBody.member_user_ids[index])) {
          setPendingGroup({row:groupBody,raw:groupRaw,legacyRaw,held:true});
          setStatus('Group identity was returned. The original request remains held until its original creation tuple is confirmed.');
          setBusy(false);
          return;
        }
        // The mounted callback loads this actual current group first. It then
        // invokes the local effect while the same dialog/owner is still live.
        // List absence alone can never retire an original.
        retireOriginal = async () => {
          await mutateCustodialWork(context => {
            assertGroup(legacyRaw,context);
            // Remove the exact legacy copy FIRST, keeping durable bytes if
            // that removal fails. Never remove a newer/foreign original.
            if (legacyRaw !== null) {
              if (legacyRaw !== groupRaw) throw new Error('conflicting group original');
              sessionStorage.removeItem(groupKey);
            }
            assertGroup(null,context);
            localStorage.removeItem(groupKey);
            assertCurrent(context);
            if (localStorage.getItem(groupKey) !== null || sessionStorage.getItem(groupKey) !== null) throw new Error('group cleanup not confirmed');
          });
          assertCurrent();
          setPendingGroup({row:null,raw:null,legacyRaw:null,held:false});
        };
      }
      await onCreated(id,assertCurrent,retireOriginal);
    } catch {
      if (alive.current) {
        let durableSaved = false;
        try { durableSaved = groupRaw !== null && localStorage.getItem(groupKey) === groupRaw; } catch {}
        setStatus(memberIds.length > 1
          ? (durableSaved
            ? 'Group result not confirmed. The original group is saved.'
            : 'Group save could not be confirmed. Original requests remain held.')
          : 'Could not open that person. Try again.');
        setBusy(false);
      }
    } finally { creating.current = false; }
  }

  return <div ref={dialogRef} tabIndex={-1} className="mz-chat-new-overlay" role="dialog" aria-modal="true" aria-label="Start conversation">
    <section className="mz-chat-new-card">
      <header className="mz-chat-new-head">
        <h2>{EMPLOYEE_CONTEXT ? 'New Message' : 'Start Conversation'}</h2>
        <p>{EMPLOYEE_CONTEXT ? 'Tap the person you want to message.' : 'Choose one person for a direct message or several people for a Memphis Zoo group.'}</p>
        {!EMPLOYEE_CONTEXT && selected.size > 1 && <input className="mz-chat-input" disabled={busy || hasPendingGroup} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Group name (optional)" />}
      </header>
      <div className="mz-chat-new-list">
        {users.map((user) => EMPLOYEE_CONTEXT
          ? <button className="mz-chat-user" type="button" key={user.id} disabled={busy} onClick={() => void create(String(user.id))}>
            {messengerAvatar(user.display_name || 'User')}
            <div className="mz-chat-user-copy"><strong>{user.display_name}</strong><span>{roleTitle(user)}</span></div>
          </button>
          : <label className="mz-chat-user" key={user.id}>
            <input type="checkbox" disabled={busy || hasPendingGroup} checked={selected.has(String(user.id))} onChange={() => toggle(String(user.id))} />
            {messengerAvatar(user.display_name || 'User')}
            <div className="mz-chat-user-copy"><strong>{user.display_name}</strong><span>{roleTitle(user)}</span></div>
          </label>)}
        {!users.length && !status && <div className="mz-chat-empty">No available recipients.</div>}
      </div>
      {status && <div className={`mz-chat-status ${status.includes('Loading') || status.includes('Creating') ? '' : 'error'}`}>{status}</div>}
      <footer className="mz-chat-new-actions">
        <button className="mz-button" type="button" onClick={onClose} disabled={busy}>{EMPLOYEE_CONTEXT ? 'Back' : 'Cancel'}</button>
        {status === 'People could not load.' && <button className="mz-button primary" type="button" onClick={() => setLoadAttempt((value) => value + 1)}>Try Again</button>}
        {!EMPLOYEE_CONTEXT && <button className="mz-button primary" type="button" onClick={() => void create()} disabled={busy || pendingGroup.held || (pendingGroup.legacyRaw !== null && pendingGroup.raw === null) || !selected.size}>Create</button>}
      </footer>
    </section>
  </div>;
}

function SwipeConversation({ thread, active, onOpen, onDelete }) {
  const [open, setOpen] = useState(false);
  const touch = useRef(null);
  return <div className={`mz-chat-swipe-row${open ? ' delete-open' : ''}`}>
    <button className="mz-chat-swipe-delete" type="button" onClick={() => onDelete(thread.id)}>Delete</button>
    <div className="mz-chat-swipe-content"
      onTouchStart={(event) => { touch.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX ?? touch.current; if (touch.current != null && end != null) { const delta = end - touch.current; if (delta < -45) setOpen(true); else if (delta > 35) setOpen(false); } touch.current = null; }}>
      <Conversation
        name={thread.title}
        info={thread.last_message_body || 'No messages yet'}
        lastSenderName={thread.last_sender_name || ''}
        lastActivityTime={formatTime(thread.last_message_at || thread.updated_at)}
        unreadCnt={thread.unread || undefined}
        active={active}
        onClick={() => { if (open) setOpen(false); else onOpen(thread.id); }}
      >{messengerAvatar(thread.title, isMemphis(thread) ? MEMPHIS_AVATAR : '')}</Conversation>
    </div>
  </div>;
}

function MessengerApp() {
  const [identity, setIdentity] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(EMPLOYEE_CONTEXT ? 'Opening Messages…' : 'Opening Messenger…');
  const [statusKind, setStatusKind] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newConversation, setNewConversation] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [composerTooLong, setComposerTooLong] = useState(false);
  const [drafts, setDrafts] = useState({});
  const draftsRef = useRef({});
  const savingDrafts = useRef(new Set());
  const composerRef = useRef(null);
  const emojiRange = useRef(null);
  const emojiButton = useRef(null);
  const emojiPanel = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const accessEpoch = useRef(0);
  const messageLoadSequence = useRef(0);
  const draftKey = `${identity?.msg_user_id || ''}:${selectedId}`;
  const updateDraft = useCallback((key, html, assertOriginal) => {
    assertOriginal?.();
    draftsRef.current = {...draftsRef.current, [key]:html};
    const originalDrafts = draftsRef.current;
    setDrafts(assertOriginal ? (previous) => {
      try { assertOriginal(); } catch { return previous; }
      return originalDrafts;
    } : originalDrafts);
  }, []);
  const [messageRecoveries, setMessageRecoveries] = useState([]);
  const [deleteRecoveries, setDeleteRecoveries] = useState([]);
  const [heldReadOriginals, setHeldReadOriginals] = useState(false);
  const selectedRef = useRef('');
  const identityRef = useRef(null);
  const threadsRef = useRef([]);
  const bootstrapStarted = useRef(false);
  const outboxRetryInFlight = useRef(null);
  const deliveryTail = useRef(Promise.resolve());
  const mobileThreadRef = useRef(false);
  const threadCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });
  const messageCursor = useRef({ after: ZERO_TIME, id: ZERO_ID });
  const mounted = useRef(true);
  const homeAssistantEntry = useRef(null);
  if (!homeAssistantEntry.current) homeAssistantEntry.current = createHomeAssistantEntry(
    EMPLOYEE_CONTEXT && PAGE_URL.searchParams.get('assistant') === 'memphis',
  );

  const [deviceIdentity, setDeviceIdentity] = useState(() => {
    const nativeAuthority = isNativeCustodialAuthority();
    return { ready: !nativeAuthority, deviceId: nativeAuthority ? '' : deviceId(), generation:null };
  });
  const currentDeviceId = deviceIdentity.deviceId;
  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedId) || null, [threads, selectedId]);
  const visibleThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => `${thread.title} ${thread.participantNames} ${thread.last_message_body || ''}`.toLowerCase().includes(needle));
  }, [threads, search]);

  const setNotice = useCallback((text, kind = '') => {
    const raw = String(text || '');
    const originalMessageNotice = [
      'Original employee identity is unavailable. Your draft has not been sent.',
      'Message save could not be confirmed. Your draft remains.',
      'Your message is saved. Server confirmation is still pending.',
      'Server confirmation is still pending.',
      'Conversation removal is saved. Server confirmation is still pending.',
      'Original employee identity is unavailable. Conversation removal has not been sent.',
      'Conversation removal save could not be confirmed. Original requests remain protected.',
    ].includes(raw);
    const employeeText = EMPLOYEE_CONTEXT && kind === 'error' && raw
      && !originalMessageNotice
      && !/^(No connection|This phone needs a manager|Something went wrong|People could not|Could not|Messenger could not|A saved message belongs)/i.test(raw)
      ? 'Something went wrong. Try again.'
      : raw;
    setStatus(employeeText);
    setStatusKind(kind);
    if (text && kind === 'ok') setTimeout(() => mounted.current && setStatus(''), 1600);
  }, []);

  const serializeDelivery = useCallback((operation) => {
    const scheduled = deliveryTail.current.catch(() => null).then(operation);
    deliveryTail.current = scheduled.catch(() => null);
    return scheduled;
  }, []);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      const security = window.MemphisCustodialSecurity?.getStatus?.();
      setDeviceIdentity({ ready:true, deviceId:deviceId(), generation:security?.generation ?? null });
    };
    void waitForEmployeeDeviceAuthority().then(update).catch((error) => {
      if (!active) return;
      setDeviceIdentity({ ready: true, deviceId: '' });
      setNotice(safe(error), 'error');
    });
    window.addEventListener('memphis:mobile-ready', update);
    window.addEventListener('memphis:custodial-security-state', update);
    return () => {
      active = false;
      window.removeEventListener('memphis:mobile-ready', update);
      window.removeEventListener('memphis:custodial-security-state', update);
    };
  }, [setNotice]);

  const loadIdentity = useCallback(async () => {
    const assertOriginalSecurity = originalCustodialIdentityGuard(currentDeviceId);
    const profileMobile = EMPLOYEE_CONTEXT && isNativeCustodialAuthority() ? window.MemphisMobile : null;
    const profileMatchMethod = profileMobile?.profileMatchesPrincipal;
    const originalMapped = identityRef.current, epoch = accessEpoch.current;
    let assertManager = () => {};
    if (!EMPLOYEE_CONTEXT) {
      const auth = window.MemphisAuth, read = auth?.readSession, requireSession = auth?.requireOpsManagerSession, getDevice = auth?.getDeviceId;
      if (typeof read !== 'function' || typeof requireSession !== 'function' || typeof getDevice !== 'function') throw custodialWorkUnavailable();
      if (!read.call(auth)) {
        // Normal trusted-session bootstrap, not adoption of a completed identity
        // response. No profile request/effect exists before this session settles.
        const session = await requireSession.call(auth,{accessLevel:'full_access',interactive:true,redirect:false,throwOnFailure:true});
        assertOriginalSecurity();
        if (!mounted.current || epoch !== accessEpoch.current || identityRef.current !== originalMapped || window.MemphisAuth !== auth
          || auth.readSession !== read || auth.requireOpsManagerSession !== requireSession || auth.getDeviceId !== getDevice
          || read.call(auth) !== session) throw custodialWorkUnavailable();
      }
      assertManager = originalManagerOutboxOwner(null,currentDeviceId,identityRef,accessEpoch,mounted,true);
    }
    const assertCurrent = () => {
      assertOriginalSecurity(); assertManager();
      if (!mounted.current || epoch !== accessEpoch.current || identityRef.current !== originalMapped) throw new Error('Messenger identity changed. Reopen Messages.');
    };
    const identityPath = EMPLOYEE_CONTEXT && currentDeviceId
      ? `/me/by-device?device_id=${encodeURIComponent(currentDeviceId)}`
      : '/me/by-device';
    const envelope = await api(identityPath,!EMPLOYEE_CONTEXT ? {assertCurrent} : undefined);
    if (!EMPLOYEE_CONTEXT) assertCurrent();
    assertOriginalSecurity();
    if (!mounted.current || epoch !== accessEpoch.current) throw new Error('Messenger identity changed. Reopen Messages.');
    const mapped = {...envelope.data, read_only:envelope.data?.read_only === true
      || (!EMPLOYEE_CONTEXT && window.MemphisAuth?.isReadOnlySession?.() === true)};
    if (!mapped?.msg_user_id) throw new Error(EMPLOYEE_CONTEXT ? 'Messenger could not open for this employee.' : 'Messenger identity could not be resolved.');
    if (!EMPLOYEE_CONTEXT) {
      if (!isUuid(mapped.msg_user_id) || mapped.canonical_device_id !== currentDeviceId) throw custodialWorkUnavailable();
      assertCurrent();
      originalManagerReaderOwners.set(mapped,Object.freeze({device:currentDeviceId,user:mapped.msg_user_id,readOnly:mapped.read_only,current:assertManager}));
    }
    assertOriginalSecurity();
    if (!isNativeCustodialAuthority()) {
      assertOriginalSecurity();
      localStorage.setItem('mz_messenger_user_id', String(mapped.msg_user_id));
      if (!EMPLOYEE_CONTEXT) assertCurrent();
      assertOriginalSecurity();
    }
    if (profileMobile) {
      assertOriginalSecurity();
      if (envelope?.ok !== true || typeof profileMatchMethod !== 'function'
        || window.MemphisMobile !== profileMobile || profileMobile.profileMatchesPrincipal !== profileMatchMethod
        || !mounted.current || epoch !== accessEpoch.current || identityRef.current !== originalMapped) throw originalMessageHeld();
      const owner = readOriginalEmployeeMessageOwner(mapped,currentDeviceId);
      assertOriginalSecurity();
      if (window.MemphisMobile !== profileMobile || profileMobile.profileMatchesPrincipal !== profileMatchMethod
        || !mounted.current || epoch !== accessEpoch.current || identityRef.current !== originalMapped
        || !originalEmployeeProfileMatchesOwner(mapped,owner)) throw originalMessageHeld();
      originalEmployeeProfileOwners.set(mapped,Object.freeze({owner,current:() => {
        assertOriginalSecurity();
        if (window.MemphisMobile !== profileMobile || profileMobile.profileMatchesPrincipal !== profileMatchMethod
          || !mounted.current || epoch !== accessEpoch.current || identityRef.current !== mapped
          || !originalEmployeeProfileMatchesOwner(mapped,owner)) throw originalMessageHeld();
      }}));
    }
    identityRef.current = mapped;
    if (!EMPLOYEE_CONTEXT) assertManager();
    setIdentity(mapped);
    return mapped;
  }, [currentDeviceId]);

  const loadThreads = useCallback(async ({ preferId = '', assertCurrent } = {}) => {
    assertCurrent?.();
    const originalMapped = identityRef.current, originalEpoch = accessEpoch.current;
    const assertManager = !EMPLOYEE_CONTEXT ? originalManagerOutboxOwner(originalMapped,currentDeviceId,identityRef,accessEpoch,mounted,true) : () => {};
    const mapped = identityRef.current || await loadIdentity();
    assertCurrent?.();
    assertManager();
    const assertProfile = !EMPLOYEE_CONTEXT ? originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted,true) : () => {};
    const assertReadCurrent = !EMPLOYEE_CONTEXT ? () => {
      assertManager(); assertProfile(); assertCurrent?.();
      if (!mounted.current || accessEpoch.current !== originalEpoch || identityRef.current !== mapped) throw custodialWorkUnavailable();
    } : assertCurrent;
    assertReadCurrent?.();
    const userId = String(mapped.msg_user_id);
    const epoch = accessEpoch.current;
    const envelope = await api(`/threads?user_id=${encodeURIComponent(userId)}&device_id=${encodeURIComponent(currentDeviceId)}`, {assertCurrent:assertReadCurrent});
    assertReadCurrent?.();
    if (!mounted.current || epoch !== accessEpoch.current || identityRef.current !== mapped) return [];
    const rows = (envelope.data || [])
      .filter((row) => !isRetiredThread(row))
      .map(normalizedThread).map(row => ({...row,canSend:row.canSend && !mapped.read_only}))
      .filter((row) => !pendingDeletedThreadIds(mapped.msg_user_id, currentDeviceId, mapped).has(row.id))
      .sort(compareThreads);
    if (!mounted.current) return rows;
    assertReadCurrent?.();
    threadsRef.current = rows;
    setThreads(rows);
    const desired = preferId || selectedRef.current || new URL(location.href).searchParams.get('thread_id') || '';
    const next = rows.find((thread) => thread.id === desired)
      || (!desired && !EMPLOYEE_CONTEXT ? rows[0] : null)
      || null;
    if (next && next.id !== selectedRef.current) {
      selectedRef.current = next.id;
      setSelectedId(next.id);
      setLoadingMessages(true);
      if (desired) {
        mobileThreadRef.current = true;
        setMobileThread(true);
      }
    } else if (!next && selectedRef.current) {
      selectedRef.current = '';
      setSelectedId('');
      setMessages([]);
      mobileThreadRef.current = false;
      setMobileThread(false);
    }
    setNotice('');
    return rows;
  }, [currentDeviceId, loadIdentity, setNotice]);

  const flushReadOutbox = useCallback(async () => {
    const mapped = identityRef.current;
    if (!mapped?.msg_user_id || !currentDeviceId) return;
    const epoch = accessEpoch.current;
    const employee = custodialEmployeeMessage();
    let owner;
    if (employee) { try { owner = originalEmployeeMessageOwner(mapped,currentDeviceId); } catch { return; } }
    let assertManager = () => {};
    try { if (!EMPLOYEE_CONTEXT) assertManager = originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted); }
    catch { return; }
    const reads = [];
    let heldUnknownRead = false;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('mz_chatscope_read_outbox:')) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        const row = JSON.parse(raw);
        reads.push({ key, row, raw });
      } catch { heldUnknownRead = true; }
    }
    for (const { key, row, raw } of reads.sort((left, right) => Number(left.row?.created_at) - Number(right.row?.created_at))) {
      try {
        assertManager();
        if (employee) {
          if (!validOriginalEmployeeRead(key,row,owner)) { heldUnknownRead = true; continue; }
          await attemptOriginalEmployeeRead(key,row,raw,owner,()=>identityRef.current,currentDeviceId);
          continue;
        }
        if (hasEmployeeMessagePins(row)) { heldUnknownRead = true; continue; }
        if (row?.schema_version !== 'chatscope-read-outbox.v2' || !row.thread_id || !row.through_message_id) {
          heldUnknownRead = true;
          continue;
        }
        if (String(row.user_id || '') !== String(mapped?.msg_user_id || '')
          || String(row.device_id || '') !== String(currentDeviceId || '')) {
          continue; // Never erase another identity's pending acknowledgement.
        }
        await api(`/thread/${encodeURIComponent(row.thread_id)}/read`, { method: 'POST', ...(!EMPLOYEE_CONTEXT ? {assertCurrent:assertManager} : {}), body: {
          user_id: row.user_id,
          device_id: row.device_id,
          through_message_id: row.through_message_id,
        } });
        assertManager();
        if (identityRef.current !== mapped || accessEpoch.current !== epoch) continue;
        // Another page or queued mutation may have saved a newer horizon
        // while this acknowledgement was pending. Retire only these bytes.
        await mutateCustodialWork((context) => {
          assertManager(context);
          if (identityRef.current === mapped && accessEpoch.current === epoch
            && localStorage.getItem(key) === raw) localStorage.removeItem(key);
          assertManager(context);
        });
        assertManager();
      } catch {
        try { assertManager(); } catch { return; }
        // A bounded read acknowledgement remains queued for reconnect. An
        // uncertain response is never permission to rewrite the original.
      }
    }
    try { assertManager(); } catch { return; }
    if (mounted.current && identityRef.current === mapped && accessEpoch.current === epoch) {
      setHeldReadOriginals(heldUnknownRead);
    }
  }, [currentDeviceId]);

  const markRead = useCallback(async (thread, throughMessage) => {
    const mapped = identityRef.current;
    if (!thread?.id || !mapped?.msg_user_id || mapped.read_only || !throughMessage?.id) return;
    const key = readOutboxKey(mapped.msg_user_id, thread.id);
    const employee = custodialEmployeeMessage();
    let owner;
    if (employee) {
      try { owner = originalEmployeeMessageOwner(mapped,currentDeviceId); }
      catch { return; }
      if (!isUuid(thread.id) || !isUuid(throughMessage.id) || throughMessage.thread_id !== thread.id) return;
    }
    let assertManager = () => {}, originalRaw, managerOriginalChanged = false;
    try {
      if (!EMPLOYEE_CONTEXT) {
        assertManager = originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted);
        originalRaw = localStorage.getItem(key); assertManager();
      }
    } catch { return; }
    let entry = {
      schema_version: 'chatscope-read-outbox.v2',
      id: key.slice('mz_chatscope_read_outbox:'.length),
      thread_id: thread.id,
      user_id: mapped.msg_user_id,
      device_id: currentDeviceId,
      through_message_id: String(throughMessage.id),
      through_at: String(throughMessage.sent_at || throughMessage.created_at || ''),
      created_at: nextOutboxOrder(),
    };
    try {
      await serializeDelivery(async () => {
        assertManager();
        await mutateCustodialWork((context) => {
          assertManager(context);
          if (employee) {
            assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId,context);
            // A pending original horizon, including malformed/legacy bytes,
            // cannot be replaced by a newer callback/current credential.
            if (localStorage.getItem(key) !== null) return;
            entry = {...entry,...employeeMessagePins(owner)};
            const raw = JSON.stringify(entry);localStorage.setItem(key,raw);
            assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId,context);
            if (localStorage.getItem(key) !== raw) throw originalMessageHeld();
            return;
          }
          // Capture was before the delivery FIFO. Never replace a row that
          // arrived while waiting, or flush it as this invocation's original.
          if (!EMPLOYEE_CONTEXT && localStorage.getItem(key) !== originalRaw) { managerOriginalChanged = true; return; }
          const generation = Number(context?.generation);
          entry = {
            ...entry,
            security_generation: Number.isSafeInteger(generation) && generation >= 1 ? generation : null,
          };
          const existingRaw = localStorage.getItem(key);
          if (existingRaw !== null) {
            let existing;
            try { existing = JSON.parse(existingRaw); } catch { return; }
            if (existing?.schema_version !== 'chatscope-read-outbox.v2'
              || existing.thread_id !== entry.thread_id || !existing.through_message_id
              || !matchingIdentity(existing,mapped.msg_user_id,currentDeviceId)
              || compareReadHorizon(existing,entry) >= 0) return;
          }
          const encoded = JSON.stringify(entry);
          assertManager(context); localStorage.setItem(key, encoded); assertManager(context);
          if (!EMPLOYEE_CONTEXT && localStorage.getItem(key) !== encoded) throw new Error('Original read horizon save could not be confirmed.');
        },employee ? expectedGenerationOptions(owner.generation) : undefined);
        assertManager();
        if (managerOriginalChanged) return;
        if (employee) assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId);
        await flushReadOutbox();
        assertManager();
      });
    } catch { /* A durable read acknowledgement remains queued for reconnect. */ }
  }, [currentDeviceId, flushReadOutbox, serializeDelivery]);

  const loadMessages = useCallback(async (threadId = selectedRef.current, { showLoading = false } = {}) => {
    const originalMapped = identityRef.current, originalEpoch = accessEpoch.current;
    const assertManager = !EMPLOYEE_CONTEXT ? originalManagerOutboxOwner(originalMapped,currentDeviceId,identityRef,accessEpoch,mounted,true) : () => {};
    const mapped = identityRef.current || await loadIdentity();
    assertManager();
    const assertProfile = !EMPLOYEE_CONTEXT ? originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted,true) : () => {};
    const assertReadCurrent = () => {
      assertManager(); assertProfile();
      if (!EMPLOYEE_CONTEXT && (!mounted.current || accessEpoch.current !== originalEpoch || identityRef.current !== mapped)) throw custodialWorkUnavailable();
    };
    assertReadCurrent();
    if (!threadId) return [];
    if (showLoading) setLoadingMessages(true);
    const epoch = accessEpoch.current;
    const sequence = ++messageLoadSequence.current;
    const isCurrentMessageLoad = () => {
      try { assertReadCurrent(); } catch { return false; }
      return mounted.current && selectedRef.current === threadId
        && epoch === accessEpoch.current && identityRef.current === mapped
        && sequence === messageLoadSequence.current;
    };
    try {
      const envelope = await api(`/thread/${encodeURIComponent(threadId)}/messages?user_id=${encodeURIComponent(mapped.msg_user_id)}&device_id=${encodeURIComponent(currentDeviceId)}&limit=200`,!EMPLOYEE_CONTEXT ? {assertCurrent:assertReadCurrent} : undefined);
      assertReadCurrent();
      const rows = (envelope.data || []).filter((row) => row.is_deleted !== true);
      if (!isCurrentMessageLoad()) return rows;
      const merged = mergePendingMessages(rows, threadId, mapped.msg_user_id, currentDeviceId);
      assertReadCurrent(); setMessages(merged);
      const thread = threadsRef.current.find((item) => item.id === threadId);
      const mobileLayout = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches;
      const conversationVisible = document.visibilityState === 'visible' && (!mobileLayout || mobileThreadRef.current);
      assertReadCurrent();
      if (conversationVisible && (EMPLOYEE_CONTEXT || !mapped.read_only)) void markRead(thread, rows[rows.length - 1]).catch(() => {});
      return rows;
    } catch (error) {
      if (!isCurrentMessageLoad()) return [];
      throw error;
    } finally {
      if (showLoading && isCurrentMessageLoad()) setLoadingMessages(false);
    }
  }, [currentDeviceId, loadIdentity, markRead]);

  const selectThread = useCallback((id) => {
    homeAssistantEntry.current.cancel();
    const changed = id !== selectedRef.current;
    selectedRef.current = id;
    setEmojiOpen(false); emojiRange.current = null;
    const savedDraft = draftsRef.current[`${identityRef.current?.msg_user_id || ''}:${id}`] || '';
    setComposerTooLong(messageLength(htmlMessageBody(savedDraft)) > MAX_MESSAGE_LENGTH);
    if (changed) {
      messageCursor.current = { after: ZERO_TIME, id: ZERO_ID };
      setMessages([]);
      setLoadingMessages(true);
      setSelectedId(id);
    }
    mobileThreadRef.current = true;
    setMobileThread(true);
    const url = new URL(location.href);
    url.searchParams.set('thread_id', id);
    history.replaceState(null, '', url);
    if (!changed) void loadMessages(id, { showLoading: true }).catch((error) => setNotice(safe(error), 'error'));
  }, [loadMessages, setNotice]);

  const resolveHomeAssistant = useCallback(() => {
    const epoch = accessEpoch.current;
    const selection = selectedRef.current;
    const generation = deviceIdentity.generation;
    return homeAssistantEntry.current.run({
      resolveIdentity: async () => identityRef.current || await loadIdentity(),
      deviceId: currentDeviceId,
      isCurrent: (mapped) => mounted.current && accessEpoch.current === epoch
        && identityRef.current === mapped && mapped?.read_only !== true
        && selectedRef.current === selection && deviceId() === currentDeviceId
        && (!isNativeCustodialAuthority() || window.MemphisCustodialSecurity?.getStatus?.()?.generation === generation),
      hasPendingDeletion: (mapped) => pendingDeletedThreadIds(mapped.msg_user_id, currentDeviceId).size > 0,
      request: api,
      readThreads: () => loadThreads({ preferId: selectedRef.current }),
      select: selectThread,
    });
  }, [currentDeviceId, deviceIdentity.generation, loadIdentity, loadThreads, selectThread]);

  const flushMessageOutbox = useCallback(async () => {
    const mapped = identityRef.current;
    const employee = custodialEmployeeMessage();
    let owner;
    if (employee) {
      try { owner = originalEmployeeMessageOwner(mapped, currentDeviceId); }
      catch { return {delivered:new Set(),foreignCount:0,permanentIds:new Set(),held:true}; }
    }
    let assertManager = () => {};
    try { if (!EMPLOYEE_CONTEXT) assertManager = originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted); }
    catch { return {delivered:new Set(),foreignCount:0,permanentIds:new Set(),held:true}; }
    const entries = [];
    const recoveries = [];
    let foreignCount = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('mz_chatscope_outbox:')) continue;
      try {
        const raw = localStorage.getItem(key);
        const entry = JSON.parse(raw || 'null');
        const belongsToCurrentIdentity = matchingIdentity(entry, mapped?.msg_user_id, currentDeviceId);
        if (!isValidMessageOutboxEntry(entry, key)) {
          recoveries.push({
            key,
            raw,
            securityGeneration: entry?.security_generation,
            discardable: !employee && belongsToCurrentIdentity,
          });
          continue;
        }
        if (!belongsToCurrentIdentity) {
          foreignCount += 1;
          continue;
        }
        // Legacy rows remain exact originals; matching user/device cannot adopt
        // an employee, credential, epoch or successor local generation.
        if ((employee && (!originalEmployeeMessageMatches(entry, owner)
            || (entry.memphis===false&&!validOriginalEmployeeAction(entry,'send'))))
            || (!employee && hasEmployeeMessagePins(entry))) {
          recoveries.push({key,raw,securityGeneration:entry.security_generation,discardable:false});
          continue;
        }
        entries.push({ entry, raw });
      } catch {
        recoveries.push({ key, raw: localStorage.getItem(key), securityGeneration: null, discardable: false });
      }
    }
    const delivered = new Set();
    const blockedThreadIds = new Set();
    const permanentIds = new Set();
    let managerHeld = false;
    for (const saved of entries.sort((left, right) => Number(left.entry.created_at) - Number(right.entry.created_at) || String(left.entry.id).localeCompare(String(right.entry.id)))) {
      let entry = saved.entry;
      let expectedBytes = saved.raw;
      if (blockedThreadIds.has(String(entry.thread_id))) continue;
      try {
        assertManager();
        if (identityRef.current !== mapped) break;
        if(employee&&entry.memphis===false){
          await deliverOriginalEmployeeAction(entry,expectedBytes,owner,()=>identityRef.current,currentDeviceId,outboxKey(entry.id),'send');
          delivered.add(String(entry.id));continue;
        }
        await mutateCustodialWork((context) => {
          assertManager(context);
          if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId, context);
          if (localStorage.getItem(outboxKey(entry.id)) !== expectedBytes)
            throw new Error('Saved message changed before delivery. Review the current saved message.');
          const generation = Number(context?.generation);
          if (!employee && Number.isSafeInteger(generation) && generation >= 1 && generation !== Number(entry.security_generation)) {
            entry = { ...entry, security_generation: generation };
            expectedBytes = JSON.stringify(entry);
            localStorage.setItem(outboxKey(entry.id), expectedBytes);
            if (localStorage.getItem(outboxKey(entry.id)) !== expectedBytes)
              throw new Error('Message could not retain its saved delivery identity.');
          }
          assertManager(context);
        }, employee ? expectedGenerationOptions(owner.generation) : undefined);
        assertManager();
        if (identityRef.current !== mapped) break;
        if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId);
        let receipt;
        if (entry.memphis) {
          receipt = await api('/memphis/message', { method: 'POST', ...(!EMPLOYEE_CONTEXT ? {assertCurrent:assertManager} : {}), ...(employee ? {expectedGeneration:owner.generation} : {}), body: {
            user_id: entry.user_id, body: entry.body, device_id: entry.device_id,
            thread_id: entry.thread_id, client_message_id: entry.id,
            ...(employee ? employeeMessageRequestPins(entry) : {}),
          } });
        } else {
          receipt = await api(`/thread/${encodeURIComponent(entry.thread_id)}/message`, { method: 'POST', ...(!EMPLOYEE_CONTEXT ? {assertCurrent:assertManager} : {}), ...(employee ? {expectedGeneration:owner.generation} : {}), body: {
            sender_user_id: entry.user_id, body: entry.body, device_id: entry.device_id,
            client_message_id: entry.id,
            ...(employee ? employeeMessageRequestPins(entry) : {}),
          } });
        }
        assertManager();
        if (identityRef.current !== mapped) break;
        if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId);
        acceptedMessageSendReceipt(entry, receipt);
        await mutateCustodialWork((context) => {
          assertManager(context);
          if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId, context);
          if (localStorage.getItem(outboxKey(entry.id)) !== expectedBytes)
            throw new Error('Saved message changed during delivery. Its current text remains saved.');
          localStorage.removeItem(outboxKey(entry.id));
          assertManager(context);
          if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId, context);
          if (localStorage.getItem(outboxKey(entry.id)) !== null)
            throw new Error('Accepted message remains saved until cleanup is confirmed.');
        }, expectedGenerationOptions(entry.security_generation));
        assertManager();
        if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId);
        delivered.add(String(entry.id));
      } catch (error) {
        try { assertManager(); } catch { managerHeld = true; break; }
        if (identityRef.current !== mapped) break;
        // Ambiguous/denied employee delivery retains the exact request. No
        // permanent classification or retry metadata may adopt another actor.
        if (employee) { blockedThreadIds.add(String(entry.thread_id)); continue; }
        if (isPermanentOutboxError(error)) {
          const retained = await retainPermanentOutboxFailure(entry, error, expectedBytes, assertManager).catch(() => false);
          try { assertManager(); } catch { managerHeld = true; break; }
          if (!retained) {
            blockedThreadIds.add(String(entry.thread_id));
            continue;
          }
          recoveries.push({
            key: outboxKey(entry.id),
            raw: localStorage.getItem(outboxKey(entry.id)),
            securityGeneration: entry.security_generation,
            discardable: matchingIdentity(entry, mapped?.msg_user_id, currentDeviceId),
          });
          permanentIds.add(String(entry.id));
          continue;
        }
        await retainOutboxFailure(entry, error, expectedBytes, assertManager).catch(() => {});
        try { assertManager(); } catch { managerHeld = true; break; }
        blockedThreadIds.add(String(entry.thread_id));
      }
    }
    if (!managerHeld) setMessageRecoveries(recoveries);
    return { delivered, foreignCount, permanentIds, ...(managerHeld ? {held:true} : {}) };
  }, [currentDeviceId]);

  const handleComposerChange = useCallback((...args) => {
    let assertManager = () => {};
    try {
      if (!EMPLOYEE_CONTEXT) assertManager = originalManagerOutboxOwner(identityRef.current,currentDeviceId,identityRef,accessEpoch,mounted);
      assertManager();
    } catch { return; }
    const body = messageBodyFromChatScopeArgs(args);
    updateDraft(`${identityRef.current?.msg_user_id || ''}:${selectedRef.current}`, String(args[0] || ''),!EMPLOYEE_CONTEXT ? assertManager : undefined);
    try { assertManager(); } catch { return; }
    const tooLong = messageLength(body) > MAX_MESSAGE_LENGTH;
    setComposerTooLong(!EMPLOYEE_CONTEXT ? (previous) => {
      try { assertManager(); } catch { return previous; }
      return tooLong;
    } : tooLong);
    if (tooLong) setNotice('Messages can be up to 2,000 characters.', 'error');
  }, [currentDeviceId, setNotice, updateDraft]);

  const sendMessage = useCallback(async (...args) => {
    const body = messageBodyFromChatScopeArgs(args);
    const thread = threadsRef.current.find((item) => item.id === selectedRef.current);
    const mapped = identityRef.current;
    if (!body || !thread?.id || !mapped?.msg_user_id || thread.canSend === false) return;
    let assertManager = () => {};
    try {
      if (!EMPLOYEE_CONTEXT) {
        const current = originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted);
        const threadId = thread.id, memphis = isMemphis(thread);
        assertManager = (context) => {
          current(context);
          if (thread.id !== threadId || thread.canSend === false || isMemphis(thread) !== memphis) throw custodialWorkUnavailable();
        };
        assertManager();
      }
    } catch { return; }
    if (messageLength(body) > MAX_MESSAGE_LENGTH) {
      setNotice('Messages can be up to 2,000 characters.', 'error');
      return;
    }
    const key = `${mapped.msg_user_id}:${thread.id}`;
    const originalDraft = !EMPLOYEE_CONTEXT ? draftsRef.current[key] || composerHtml(body) : undefined;
    if (savingDrafts.current.has(key)) return;
    savingDrafts.current.add(key);
    const employee = custodialEmployeeMessage();
    let owner, originalSendEpoch;
    try { if (employee) { owner = originalEmployeeMessageOwner(mapped, currentDeviceId); originalSendEpoch = accessEpoch.current; } }
    catch { savingDrafts.current.delete(key); setNotice('Original employee identity is unavailable. Your draft has not been sent.', 'error'); return; }
    let paused;
    try {
      assertManager();
      paused = await custodialSecurityPaused();
      assertManager();
    } catch { savingDrafts.current.delete(key); return; }
    if (paused) {
      savingDrafts.current.delete(key);
      setNotice('This phone needs a manager before a message can be sent.', 'error');
      return;
    }
    if (identityRef.current !== mapped) { savingDrafts.current.delete(key); return; }
    const submittedHtml = !EMPLOYEE_CONTEXT ? originalDraft : draftsRef.current[key] || composerHtml(body);
    const id = clientMessageId();
    const optimistic = {
      id,
      sender_user_id: mapped.msg_user_id,
      sender_display_name: mapped.display_name,
      body,
      message_type: 'text',
      sent_at: new Date().toISOString(),
      optimistic: true, thread_id:thread.id, locallyQueued:true,
    };
    let entry = { schema_version: MESSAGE_OUTBOX_SCHEMA, id, thread_id: thread.id, user_id: mapped.msg_user_id, device_id: currentDeviceId, body, memphis: isMemphis(thread), created_at: nextOutboxOrder() };
    if(employee&&!entry.memphis)entry={...entry,schema_version:ORIGINAL_SEND_OUTBOX_SCHEMA,message_type:'text',metadata_json:{}};
    let expectedBytes;
    try {
      assertManager();
      if (!EMPLOYEE_CONTEXT && localStorage.getItem(outboxKey(id)) !== null) throw originalMessageHeld();
      if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId);
      await mutateCustodialWork((context) => {
        assertManager(context);
        if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId, context);
        const generation = Number(context?.generation);
        entry = {
          ...entry,
          security_generation: Number.isSafeInteger(generation) && generation >= 1 ? generation : null,
          ...(employee ? employeeMessagePins(owner) : {}),
        };
        const encoded = JSON.stringify(entry);
        expectedBytes = encoded;
        if ((employee || !EMPLOYEE_CONTEXT) && localStorage.getItem(outboxKey(id)) !== null) throw originalMessageHeld();
        localStorage.setItem(outboxKey(id), encoded);
        assertManager(context);
        if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId, context);
        if ((employee || !EMPLOYEE_CONTEXT) && localStorage.getItem(outboxKey(id)) !== encoded) throw new Error('Message save could not be confirmed. Your draft remains.');
      }, employee ? expectedGenerationOptions(owner.generation) : undefined);
      assertManager();
      if (!EMPLOYEE_CONTEXT && localStorage.getItem(outboxKey(id)) !== expectedBytes) throw originalMessageHeld();
      if (employee) assertOriginalEmployeeMessageOwner(owner, identityRef.current, currentDeviceId);
    } catch (error) {
      savingDrafts.current.delete(key);
      try { assertManager(); } catch { return; }
      setNotice(employee || !EMPLOYEE_CONTEXT ? 'Message save could not be confirmed. Your draft remains.'
        : securityPauseError(error) ? 'This phone needs a manager before a message can be sent.' : 'Message was not saved. Try again.', 'error');
      return;
    }
    savingDrafts.current.delete(key);
    const assertSendOwner = () => {
      assertManager();
      if (employee) {
        if (!mounted.current || accessEpoch.current !== originalSendEpoch || identityRef.current !== mapped) throw originalMessageHeld();
        assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId);
      }
    };
    const publishMessages = (update) => {
      if (EMPLOYEE_CONTEXT && !employee) { setMessages(update); return; }
      setMessages((rows) => {
        try { assertSendOwner(); } catch { return rows; }
        return update(rows);
      });
    };
    if (draftsRef.current[key] === submittedHtml) updateDraft(key, '',!EMPLOYEE_CONTEXT || employee ? assertSendOwner : undefined);
    setComposerTooLong(!EMPLOYEE_CONTEXT || employee ? (previous) => {
      try { assertSendOwner(); } catch { return previous; }
      return false;
    } : false);
    if (selectedRef.current === thread.id && identityRef.current === mapped) publishMessages((rows) => [...rows, optimistic]);
    let outboxResult;
    try {
      outboxResult = await serializeDelivery(() => { assertManager(); return flushMessageOutbox(); });
      assertManager();
    } catch (error) {
      if (EMPLOYEE_CONTEXT) throw error;
      return; // Unknown outcome: retain the saved original; never remint/retry.
    }
    try { assertSendOwner(); } catch { return; }
    if (!EMPLOYEE_CONTEXT && outboxResult?.held) return;
    if (identityRef.current !== mapped) return;
    if (outboxResult?.permanentIds?.has(id)) {
      publishMessages((rows) => rows.map((row) => row.id === id ? { ...row, failed: true, optimistic: false } : row));
      setNotice('Saved message needs manager recovery. It was not sent automatically.', 'error');
      return;
    }
    const pendingOriginal = localStorage.getItem(outboxKey(id));
    // Absence can follow another writer or an interrupted callback. Only the
    // owning flush's accepted receipt for this exact id may announce Sent.
    if (pendingOriginal || outboxResult?.delivered?.has(id) !== true) {
      publishMessages((rows) => rows.map((row) => row.id === id ? { ...row, failed: Boolean(pendingOriginal), optimistic: false, confirmationPending: !pendingOriginal } : row));
      setNotice(pendingOriginal ? 'Your message is saved. Server confirmation is still pending.'
        : 'Server confirmation is still pending.', 'error');
      return;
    }
    if (selectedRef.current === thread.id) publishMessages(rows => rows.map(row => row.id === id ? {...row,locallyQueued:false,optimistic:false,failed:false,confirmationPending:false} : row));
    await Promise.all([selectedRef.current === thread.id ? loadMessages(thread.id) : Promise.resolve(), loadThreads()]).catch(() => null);
    try { assertSendOwner(); } catch { return; }
    setNotice('Sent.', 'ok');
  }, [currentDeviceId, flushMessageOutbox, loadMessages, loadThreads, serializeDelivery, setNotice, updateDraft]);

  const retryOutbox = useCallback(() => {
    if (identityRef.current?.read_only) return Promise.resolve();
    // Resume events can fire while the first identity request is still in
    // flight. Never classify or discard queued work until identity is ready;
    // bootstrap's post-loadIdentity retry owns the initial flush.
    if (!identityRef.current?.msg_user_id || !currentDeviceId) return Promise.resolve();
    if (outboxRetryInFlight.current) return outboxRetryInFlight.current;
    const mapped = identityRef.current, employee = custodialEmployeeMessage(), originalRetryEpoch = accessEpoch.current;
    let owner, assertRetryOwner = () => {};
    try {
      if (!EMPLOYEE_CONTEXT) assertRetryOwner = originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted);
      if (employee) {
        owner = originalEmployeeMessageOwner(mapped,currentDeviceId);
        assertRetryOwner = (context) => {
          if (!mounted.current || accessEpoch.current !== originalRetryEpoch || identityRef.current !== mapped) throw originalMessageHeld();
          assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId,context);
        };
      }
    }
    catch { return Promise.resolve(); }
    const retry = serializeDelivery(async () => {
      try { assertRetryOwner(); } catch { return; }
      const deletions = [];
      const deletionRecoveries = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith('mz_chatscope_delete_outbox:')) continue;
        try {
          const raw = localStorage.getItem(key);
          const row = JSON.parse(localStorage.getItem(key) || 'null');
          if ((employee && !originalEmployeeMessageMatches(row,owner)) || (!employee && hasEmployeeMessagePins(row))) {
            deletionRecoveries.push({key,raw,securityGeneration:row?.security_generation,originalOwnerHeld:true});continue;
          }
          if (!isValidDeleteOutboxEntry(row, key)
            || !matchingIdentity(row, identityRef.current?.msg_user_id, currentDeviceId)) {
            deletionRecoveries.push({ key, raw, securityGeneration: row?.security_generation });
            continue;
          }
          deletions.push({ key, row, raw });
        } catch { deletionRecoveries.push({ key, raw: localStorage.getItem(key), securityGeneration: null }); }
      }
      const publishDeletionRecoveries = () => {
        assertRetryOwner();
        setDeleteRecoveries(employee ? previous => {
          try { assertRetryOwner(); } catch { return previous; }
          return deletionRecoveries;
        } : deletionRecoveries);
      };
      const paused = await custodialSecurityPaused();
      try { assertRetryOwner(); } catch { return; }
      if (paused) {
        publishDeletionRecoveries();
        return;
      }
      try { assertRetryOwner(); } catch { return; }
      for (const { key, row, raw } of deletions.sort((a, b) => Number(a.row.created_at) - Number(b.row.created_at))) {
        let entry = row;
        let expectedBytes = raw;
        try {
          assertRetryOwner();
          if (identityRef.current !== mapped) break;
          if (employee) {
            await deliverOriginalEmployeeDeletion(entry,expectedBytes,owner,()=>identityRef.current,currentDeviceId);
            assertRetryOwner();
            continue;
          }
          await mutateCustodialWork((context) => {
            assertRetryOwner(context);
            if (localStorage.getItem(key) !== expectedBytes) throw new Error('Saved conversation removal changed before delivery.');
            const generation = Number(context?.generation);
            if (Number.isSafeInteger(generation) && generation >= 1 && generation !== Number(entry.security_generation)) {
              entry = { ...entry, security_generation: generation };
              expectedBytes = JSON.stringify(entry);
              localStorage.setItem(key, expectedBytes);
              if (localStorage.getItem(key) !== expectedBytes) throw new Error('Conversation removal could not retain its saved identity.');
            }
            assertRetryOwner(context);
          });
          assertRetryOwner();
          if (identityRef.current !== mapped) break;
          const receipt = await api(`/thread/${encodeURIComponent(entry.thread_id)}/delete`, { method: 'POST', ...(!EMPLOYEE_CONTEXT ? {assertCurrent:assertRetryOwner} : {}), body: {
            user_id: entry.user_id,
            device_id: entry.device_id,
            operation_id: entry.id,
          } });
          assertRetryOwner();
          if (identityRef.current !== mapped) break;
          await retireAcceptedDeletion(entry, receipt, key, expectedBytes, assertRetryOwner);
        } catch (error) {
          try { assertRetryOwner(); } catch { return; }
          if (identityRef.current !== mapped) break;
          if (employee) continue; // Keep exact original, never reclassify or mint another operation.
          if (isPermanentOutboxError(error)) {
            const retained = await retainPermanentDeleteFailure(entry, error, key, expectedBytes, assertRetryOwner).catch(() => false);
            try { assertRetryOwner(); } catch { return; }
            if (retained) deletionRecoveries.push({
              key,
              raw: localStorage.getItem(key),
              securityGeneration: entry.security_generation,
            });
          }
        }
      }
      try { assertRetryOwner(); } catch { return; }
      publishDeletionRecoveries();
      await flushReadOutbox();
      try { assertRetryOwner(); } catch { return; }
      const outboxResult = await flushMessageOutbox();
      try { assertRetryOwner(); } catch { return; }
      if (selectedRef.current) await loadMessages(selectedRef.current);
      try { assertRetryOwner(); } catch { return; }
      await loadThreads({ preferId: selectedRef.current });
      try { assertRetryOwner(); } catch { return; }
      if (outboxResult.foreignCount > 0) {
        setNotice('A saved message belongs to another signed-in user. Sign in as that user to send it.', 'error');
      }
    });
    const tracked = retry.finally(() => {
      if (outboxRetryInFlight.current === tracked) outboxRetryInFlight.current = null;
    });
    outboxRetryInFlight.current = tracked;
    return tracked;
  }, [currentDeviceId, flushMessageOutbox, flushReadOutbox, loadMessages, loadThreads, serializeDelivery, setNotice]);

  const discardMessageRecovery = useCallback(async (recovery) => {
    if (!recovery?.discardable || !recovery.key) return;
    let assertManager = () => {};
    try {
      if (!EMPLOYEE_CONTEXT) assertManager = originalManagerOutboxOwner(identityRef.current,currentDeviceId,identityRef,accessEpoch,mounted);
    } catch { return; }
    const { key, raw, securityGeneration } = recovery;
    if (typeof key !== 'string' || typeof raw !== 'string') return;
    try {
      await mutateCustodialWork((context) => {
        assertManager(context);
        if (localStorage.getItem(key) !== raw) throw new Error('Saved message changed before it could be discarded.');
        localStorage.removeItem(key);
        assertManager(context);
      }, expectedGenerationOptions(securityGeneration));
      assertManager();
      setMessageRecoveries((rows) => {
        try { assertManager(); } catch { return rows; }
        return rows.filter((row) => row.key !== key || row.raw !== raw);
      });
      setNotice('Saved message discarded.', 'ok');
    } catch {
      try { assertManager(); } catch { return; }
      setNotice('Saved message could not be discarded. Ask a manager for help.', 'error');
    }
  }, [currentDeviceId, setNotice]);

  const discardDeleteRecovery = useCallback(async (recovery) => {
    if (EMPLOYEE_CONTEXT || !recovery?.key) return;
    let assertManager;
    try { assertManager = originalManagerOutboxOwner(identityRef.current,currentDeviceId,identityRef,accessEpoch,mounted); } catch { return; }
    const { key, raw, securityGeneration } = recovery;
    if (typeof key !== 'string' || typeof raw !== 'string') return;
    try { if (hasEmployeeMessagePins(JSON.parse(raw))) return; } catch { if (isNativeCustodialAuthority()) return; }
    if (!confirm('Discard this saved deletion? It will not be applied.')) return;
    try {
      assertManager();
      await mutateCustodialWork((context) => {
        assertManager(context);
        if (localStorage.getItem(key) !== raw) throw new Error('Saved deletion changed before it could be discarded.');
        localStorage.removeItem(key);
        assertManager(context);
      }, expectedGenerationOptions(securityGeneration));
      assertManager();
      setDeleteRecoveries((rows) => {
        try { assertManager(); } catch { return rows; }
        return rows.filter((row) => row.key !== key || row.raw !== raw);
      });
      setNotice('Saved deletion discarded.', 'ok');
    } catch {
      try { assertManager(); } catch { return; }
      setNotice('Saved deletion could not be discarded. Ask a manager for help.', 'error');
    }
  }, [currentDeviceId, setNotice]);

  const deleteThread = useCallback(async (threadId = selectedRef.current) => {
    const thread = threadsRef.current.find((item) => item.id === threadId);
    if (!thread || thread.shared) return;
    const mapped = identityRef.current;
    let assertManager = () => {};
    let requireNoSavedDeletion = () => {};
    try {
      if (!EMPLOYEE_CONTEXT) {
        const current = originalManagerOutboxOwner(mapped,currentDeviceId,identityRef,accessEpoch,mounted);
        const id = thread.id, title = thread.title;
        assertManager = (context) => {
          current(context);
          if (thread.id !== id || thread.title !== title || thread.shared) throw originalMessageHeld();
        };
        assertManager();
        if (!confirm(`Delete “${title}” from your Messenger? Other participants keep their copy.`)) return;
        assertManager();
        // An uncertain original is not permission to mint a replacement id.
        requireNoSavedDeletion = () => {
          assertManager();
          for (let index=0;index<localStorage.length;index++) {
            const savedKey=localStorage.key(index);
            if (!savedKey?.startsWith('mz_chatscope_delete_outbox:')) continue;
            const existing=JSON.parse(localStorage.getItem(savedKey));
            if (existing.thread_id===id && existing.user_id===mapped.msg_user_id && existing.device_id===currentDeviceId) throw originalMessageHeld();
          }
        };
        requireNoSavedDeletion();
      }
    } catch { return; }
    if (!mapped?.msg_user_id || !currentDeviceId) {
      setNotice('Messenger identity could not be resolved.', 'error');
      return;
    }
    const employee = custodialEmployeeMessage();
    const originalDeleteEpoch = accessEpoch.current, originalThreadId = thread.id;
    let owner, assertDeleteOwner = assertManager;
    if (employee) {
      try { owner = originalEmployeeMessageOwner(mapped,currentDeviceId); } catch {
        setNotice('Original employee identity is unavailable. Conversation removal has not been sent.', 'error');return;
      }
      if (!isUuid(thread.id)) return;
      assertDeleteOwner = (context) => {
        if (!mounted.current || accessEpoch.current !== originalDeleteEpoch || identityRef.current !== mapped
          || thread.id !== originalThreadId || thread.shared) throw originalMessageHeld();
        assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId,context);
      };
      // The same source actor/thread may gain an uncertain original while
      // waiting for mutation admission. Recheck under that existing writer
      // boundary before saving or dispatching another deletion id.
      requireNoSavedDeletion = () => {
        assertDeleteOwner();
        for (let index=0;index<localStorage.length;index++) {
          const savedKey=localStorage.key(index);
          if (!savedKey?.startsWith('mz_chatscope_delete_outbox:')) continue;
          const existing=JSON.parse(localStorage.getItem(savedKey));
          if (existing.thread_id===originalThreadId && existing.user_id===mapped.msg_user_id && existing.device_id===currentDeviceId) throw originalMessageHeld();
        }
      };
      try { requireNoSavedDeletion(); }
      catch { setNotice('Conversation removal is saved. Server confirmation is still pending.', 'error');return; }
    }
    const publishDelete = (setter,value) => {
      assertDeleteOwner();
      setter(employee ? previous => {
        try { assertDeleteOwner(); } catch { return previous; }
        return value;
      } : value);
    };
    const deletionId = crypto.randomUUID();
    const key = deleteOutboxKey(deletionId);
    let entry = {
      schema_version: employee ? ORIGINAL_DELETE_OUTBOX_SCHEMA : DELETE_OUTBOX_SCHEMA,
      id: deletionId,
      thread_id: thread.id,
      user_id: mapped.msg_user_id,
      device_id: currentDeviceId,
      security_generation: null,
      created_at: Date.now(),
    };
    let expectedBytes;
    try {
      await mutateCustodialWork((context) => {
        assertManager(context);
        requireNoSavedDeletion();
        if (employee) assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId,context);
        const generation = Number(context?.generation);
        entry = {
          ...entry,
          security_generation: Number.isSafeInteger(generation) && generation >= 1 ? generation : null,
          ...(employee ? employeeMessagePins(owner) : {}),
        };
        expectedBytes = JSON.stringify(entry);
        if ((employee || !EMPLOYEE_CONTEXT) && localStorage.getItem(key) !== null) throw originalMessageHeld();
        localStorage.setItem(key, expectedBytes);
        assertManager(context);
        if (employee) assertOriginalEmployeeMessageOwner(owner,identityRef.current,currentDeviceId,context);
        if (localStorage.getItem(key) !== expectedBytes) throw new Error('Conversation removal could not be saved.');
      },employee ? expectedGenerationOptions(owner.generation) : undefined);
      assertDeleteOwner();
    } catch (error) {
      try { assertDeleteOwner(); } catch { return; }
      setNotice(employee ? 'Conversation removal save could not be confirmed. Original requests remain protected.'
        : securityPauseError(error) ? 'This phone needs a manager before a conversation can be deleted.' : 'Conversation could not be saved for deletion. Try again.', 'error');
      return;
    }
    try {
      assertDeleteOwner();
      if (identityRef.current !== mapped) return;
      const remaining = threadsRef.current.filter((item) => item.id !== thread.id);
      threadsRef.current = remaining;
      publishDelete(setThreads,remaining);
      if (selectedRef.current === thread.id) {
        selectedRef.current = '';
        publishDelete(setSelectedId,'');
        publishDelete(setMessages,[]);
        mobileThreadRef.current = false;
        publishDelete(setMobileThread,false);
      }
      assertDeleteOwner();
      setNotice(employee ? 'Conversation removal is saved. Server confirmation is still pending.' : EMPLOYEE_CONTEXT ? 'Deleted.' : 'Conversation removed from your Messenger.', employee ? 'error' : 'ok');
    } catch { return; }
    try {
      assertManager();
      if (identityRef.current !== mapped || localStorage.getItem(key) !== expectedBytes) return;
      if (employee) {
        await deliverOriginalEmployeeDeletion(entry,expectedBytes,owner,()=>identityRef.current,currentDeviceId);
        assertDeleteOwner();
        setNotice('Conversation removed from your Messenger.', 'ok');return;
      }
      const receipt = await api(`/thread/${encodeURIComponent(thread.id)}/delete`, { method: 'POST', ...(!EMPLOYEE_CONTEXT ? { assertCurrent: assertManager } : {}), body: {
        user_id: entry.user_id,
        device_id: entry.device_id,
        operation_id: entry.id,
      } });
      assertManager();
      if (identityRef.current !== mapped) return;
      await retireAcceptedDeletion(entry, receipt, key, expectedBytes, assertManager);
      assertManager();
    } catch (error) {
      try { assertManager(); } catch { return; }
      if (identityRef.current !== mapped) return;
      if (employee) return;
      if (!isPermanentOutboxError(error)) return; // Immediate user-scoped hide remains queued for exact-once retry.
      const retained = await retainPermanentDeleteFailure(entry, error, key, expectedBytes, assertManager).catch(() => false);
      try { assertManager(); } catch { return; }
      if (!retained) return;
      const recoveryRaw = localStorage.getItem(key);
      setDeleteRecoveries((rows) => {
        try { assertManager(); } catch { return rows; }
        return [
          ...rows.filter((row) => row.key !== key),
          { key, raw: recoveryRaw, securityGeneration: entry.security_generation },
        ];
      });
      await loadThreads().catch(() => null);
      try { assertManager(); } catch { return; }
      setNotice('Saved deletion needs manager recovery. It was not applied automatically.', 'error');
    }
  }, [currentDeviceId, loadThreads, setNotice]);

  useEffect(() => {
    if (!deviceIdentity.ready) return undefined;
    if (isNativeCustodialAuthority() && !currentDeviceId) {
      setNotice('This phone needs a manager.', 'error');
      return undefined;
    }
    if (bootstrapStarted.current) return undefined;
    bootstrapStarted.current = true;
    mounted.current = true;
    setAccessBlocked(false);
    identityRef.current = null; setIdentity(null);
    threadsRef.current = []; setThreads([]);
    selectedRef.current = ''; setSelectedId(''); setMessages([]);
    (async () => {
      try {
        await loadIdentity();
        await loadThreads();
        await resolveHomeAssistant();
        await retryOutbox();
      } catch (error) {
        console.error('Messenger bootstrap failed:', error);
        setNotice(safe(error), 'error');
      }
    })();
    const online = () => {
      void resolveHomeAssistant().catch(error => setNotice(safe(error), 'error'));
      void retryOutbox().catch(error => setNotice(safe(error), 'error'));
    };
    const resumeMessenger = () => {
      if (document.visibilityState !== 'visible') return;
      void resolveHomeAssistant().catch(error => setNotice(safe(error), 'error'));
      void retryOutbox().catch(error => setNotice(safe(error), 'error'));
      void loadThreads({ preferId: selectedRef.current }).catch((error) => setNotice(safe(error), 'error'));
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', resumeMessenger);
    window.addEventListener('pageshow', resumeMessenger);
    window.addEventListener('memphis:messenger-resume', resumeMessenger);
    return () => {
      mounted.current = false; bootstrapStarted.current = false; accessEpoch.current += 1;
      homeAssistantEntry.current.cancel();
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', resumeMessenger);
      window.removeEventListener('pageshow', resumeMessenger);
      window.removeEventListener('memphis:messenger-resume', resumeMessenger);
    };
  }, [currentDeviceId, deviceIdentity.ready, deviceIdentity.generation, loadIdentity, loadThreads, retryOutbox, resolveHomeAssistant, setNotice]);

  useEffect(() => {
    if (!selectedId) return;
    selectedRef.current = selectedId;
    void loadMessages(selectedId, { showLoading: true }).catch((error) => setNotice(safe(error), 'error'));
  }, [selectedId, loadMessages, setNotice]);

  useEffect(() => {
    if (!identity?.msg_user_id) return undefined;
    let stopped = false;
    let controller = null;
    let assertCurrent;
    if (!EMPLOYEE_CONTEXT) {
      const epoch = accessEpoch.current;
      try {
        const assertManager = originalManagerOutboxOwner(identity,currentDeviceId,identityRef,accessEpoch,mounted,true);
        assertCurrent = () => {
          if (stopped || identityRef.current !== identity || accessEpoch.current !== epoch) {
            stopped = true; controller?.abort(); throw custodialWorkUnavailable();
          }
          try {
            assertManager();
          } catch (error) {
            // Retire the original profile epoch, not merely this request. A
            // later effect cannot first-adopt a restored/successor session.
            if (accessEpoch.current === epoch) accessEpoch.current += 1;
            stopped = true; controller?.abort(); throw error;
          }
        };
        assertCurrent();
      } catch {
        if (identityRef.current === identity && accessEpoch.current === epoch) accessEpoch.current += 1;
        return undefined;
      }
    }
    const loop = async () => {
      while (!stopped) {
        controller = new AbortController();
        const cursor = threadCursor.current;
        try {
          assertCurrent?.();
          const envelope = await api(`/threads/updates?user_id=${encodeURIComponent(identity.msg_user_id)}&device_id=${encodeURIComponent(currentDeviceId)}&after=${encodeURIComponent(cursor.after)}&after_id=${encodeURIComponent(cursor.id)}&wait_ms=20000&limit=100`, { signal: controller.signal, ...(!EMPLOYEE_CONTEXT ? {assertCurrent} : {}) });
          if (stopped || controller.signal.aborted) break;
          assertCurrent?.();
          const next = envelope.meta?.next_cursor;
          if (next?.after && next?.after_id) threadCursor.current = { after: next.after, id: next.after_id };
          if (envelope.data?.length) await loadThreads({ preferId: selectedRef.current, ...(!EMPLOYEE_CONTEXT ? {assertCurrent} : {}) });
          assertCurrent?.();
        } catch (error) {
          if (stopped || controller.signal.aborted) break;
          try { assertCurrent?.(); } catch { break; }
          if (securityPauseError(error)) break;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    };
    void loop();
    return () => { stopped = true; controller?.abort(); };
  }, [currentDeviceId, identity, loadThreads]);

  useEffect(() => {
    if (!identity?.msg_user_id || !selectedId) return undefined;
    let stopped = false;
    let controller = null;
    let assertCurrent;
    if (!EMPLOYEE_CONTEXT) {
      const epoch = accessEpoch.current;
      try {
        const assertManager = originalManagerOutboxOwner(identity,currentDeviceId,identityRef,accessEpoch,mounted,true);
        assertCurrent = () => {
          if (stopped || identityRef.current !== identity || accessEpoch.current !== epoch || selectedRef.current !== selectedId) {
            stopped = true; controller?.abort(); throw custodialWorkUnavailable();
          }
          try {
            assertManager();
          } catch (error) {
            if (accessEpoch.current === epoch) accessEpoch.current += 1;
            stopped = true; controller?.abort(); throw error;
          }
        };
        assertCurrent();
      } catch {
        if (identityRef.current === identity && accessEpoch.current === epoch) accessEpoch.current += 1;
        return undefined;
      }
    }
    messageCursor.current = { after: ZERO_TIME, id: ZERO_ID };
    const loop = async () => {
      while (!stopped && selectedRef.current === selectedId) {
        controller = new AbortController();
        const cursor = messageCursor.current;
        try {
          assertCurrent?.();
          const envelope = await api(`/thread/${encodeURIComponent(selectedId)}/updates?user_id=${encodeURIComponent(identity.msg_user_id)}&device_id=${encodeURIComponent(currentDeviceId)}&after=${encodeURIComponent(cursor.after)}&after_id=${encodeURIComponent(cursor.id)}&wait_ms=20000&limit=100`, { signal: controller.signal, ...(!EMPLOYEE_CONTEXT ? {assertCurrent} : {}) });
          if (stopped || controller.signal.aborted || selectedRef.current !== selectedId) break;
          assertCurrent?.();
          const next = envelope.meta?.next_cursor;
          if (next?.after && next?.after_id) messageCursor.current = { after: next.after, id: next.after_id };
          if (envelope.data?.length) await loadMessages(selectedId);
          assertCurrent?.();
        } catch (error) {
          if (stopped || controller.signal.aborted) break;
          try { assertCurrent?.(); } catch { break; }
          if (securityPauseError(error)) break;
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    };
    void loop();
    return () => { stopped = true; controller?.abort(); };
  }, [currentDeviceId, identity, loadMessages, selectedId]);

  useEffect(() => {
    const withdraw = () => {
      homeAssistantEntry.current.cancel();
      accessEpoch.current += 1;
      identityRef.current = null; threadsRef.current = []; selectedRef.current = '';
      setIdentity(null); setThreads([]); setMessages([]); setSelectedId('');
      setNewConversation(false); setEmojiOpen(false); setAccessBlocked(true);
      for (const controller of activeMessengerRequests) controller.abort();
      setNotice('This phone needs a manager. Access changed; saved messages are protected.', 'error');
    };
    const securityChanged = () => {
      const state = window.MemphisCustodialSecurity?.getStatus?.();
      if (state && (state.ready !== true || state.available === false || state.quarantined)) withdraw();
    };
    window.addEventListener('memphis:messenger-access-denied', withdraw);
    window.addEventListener('memphis:custodial-security-state', securityChanged);
    return () => {
      window.removeEventListener('memphis:messenger-access-denied', withdraw);
      window.removeEventListener('memphis:custodial-security-state', securityChanged);
    };
  }, [setNotice]);

  useEffect(() => {
    if (!identity?.msg_user_id || accessBlocked) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false
          && Object.keys(localStorage).some(key => key.startsWith('mz_chatscope_outbox:') || key.startsWith('mz_chatscope_read_outbox:') || key.startsWith('mz_chatscope_delete_outbox:'))) {
        void retryOutbox().catch(() => {});
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [identity, accessBlocked, retryOutbox]);

  useEffect(() => {
    if (!emojiOpen) return undefined;
    emojiPanel.current?.querySelector('button')?.focus();
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && (emojiPanel.current?.contains(event.target) || emojiButton.current?.contains(event.target))) return;
      setEmojiOpen(false);
      if (event.type === 'keydown') { event.preventDefault(); emojiButton.current?.focus(); }
    };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [emojiOpen]);

  const captureEmojiCaret = () => {
    const editor = document.querySelector('.cs-message-input__content-editor');
    const selection = window.getSelection();
    emojiRange.current = selection?.rangeCount && editor?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  };
  const insertEmoji = emoji => {
    if (!selectedThread?.canSend || accessBlocked) return;
    const editor = document.querySelector('.cs-message-input__content-editor');
    if (!editor) return;
    const range = emojiRange.current && editor.contains(emojiRange.current.commonAncestorContainer) ? emojiRange.current : document.createRange();
    if (range !== emojiRange.current) { range.selectNodeContents(editor); range.collapse(false); }
    range.deleteContents(); const text = document.createTextNode(emoji); range.insertNode(text); range.setStartAfter(text); range.collapse(true);
    editor.focus(); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    editor.dispatchEvent(new Event('input', {bubbles:true}));
    setEmojiOpen(false); emojiRange.current = null;
  };

  useEffect(() => {
    // The installed ChatScope API exposes the composer wrapper, not the
    // editable node or send-button properties. Name these existing controls.
    const editor = document.querySelector('.cs-message-input__content-editor');
    editor?.setAttribute('role', 'textbox');
    editor?.setAttribute('aria-label', 'Type a message');
    editor?.setAttribute('aria-multiline', 'true');
    document.querySelector('.cs-button--send')?.setAttribute('aria-label', 'Send message');
  }, [draftKey]);

  const renderedMessages = messages.map((row, index) => {
    const mine = String(row.sender_user_id) === String(identity?.msg_user_id);
    return <Message type="text" key={row.id || `${row.sent_at}-${index}`} model={{
      message: row.failed ? `${row.body}  (saved)` : String(row.body || ''),
      sentTime: formatTime(row.sent_at),
      sender: row.sender_display_name || 'Unknown',
      direction: mine ? 'outgoing' : 'incoming',
      position: 'single',
    }}><Message.Header sender={row.sender_display_name || (mine ? identity?.display_name : 'Unknown')} sentTime={formatTime(row.sent_at)} />{mine && <Message.Footer>{row.recovery_state === 'permanent' ? 'Needs recovery — not sent' : row.confirmationPending ? 'Server confirmation pending' : row.locallyQueued || row.optimistic || row.failed ? (row.failed || navigator.onLine === false ? 'Saved on this device' : 'Sending…') : 'Sent to server'}</Message.Footer>}</Message>;
  });

  const appClass = `mz-chat-shell${mobileThread ? ' mobile-thread' : ''}`;
  const managerCanResolveDeleteRecoveries = !EMPLOYEE_CONTEXT && /manager/i.test(`${identity?.role || ''} ${identity?.role_title || ''}`);
  return <div className={appClass}>
    <header className={`mz-chat-toolbar${mobileThread ? ' thread-toolbar' : ''}`}>
      <button className="mz-button" type="button" aria-label={mobileThread ? 'Back to conversations' : 'Back'} title={mobileThread ? 'Back to conversations' : 'Back to Home'} data-mz-global-back={!mobileThread || undefined} onClick={() => { if (mobileThread) { mobileThreadRef.current = false; setMobileThread(false); } else void navigateBack(); }}>{mobileThread ? 'Chats' : 'Back'}</button>
      <div className="mz-chat-brand"><img src={ZOO_LOGO} alt="Memphis Zoo" /><div className="mz-chat-brand-text"><strong>{EMPLOYEE_CONTEXT ? 'Messages' : 'Memphis Messenger'}</strong><span>{identity?.display_name ? (EMPLOYEE_CONTEXT ? identity.display_name : `${identity.display_name} · ${roleTitle(identity)}`) : 'Memphis Zoo'}</span></div></div>
      {!mobileThread && <button className="mz-button primary" type="button" disabled={!identity?.msg_user_id || identity.read_only || accessBlocked} onClick={() => setNewConversation(true)}>New</button>}
    </header>
    <section className="mz-chat-stage">
      <MainContainer>
        <Sidebar position="left" scrollable>
          <Search placeholder="Search conversations" value={search} onChange={setSearch} />
          <ConversationList loading={false}>
            {visibleThreads.map((thread) => EMPLOYEE_CONTEXT
              ? <SwipeConversation key={thread.id} thread={thread} active={thread.id === selectedId} onOpen={selectThread} onDelete={(id) => void deleteThread(id)} />
              : <Conversation
                key={thread.id}
                name={thread.title}
                info={thread.last_message_body || 'No messages yet'}
                lastSenderName={thread.last_sender_name || ''}
                lastActivityTime={formatTime(thread.last_message_at || thread.updated_at)}
                unreadCnt={thread.unread || undefined}
                active={thread.id === selectedId}
                onClick={() => selectThread(thread.id)}
              >{messengerAvatar(thread.title, isMemphis(thread) ? MEMPHIS_AVATAR : '')}</Conversation>)}
            {!visibleThreads.length && <div className="mz-chat-list-empty"><strong>No messages yet</strong><span>Tap New to message someone.</span></div>}
          </ConversationList>
        </Sidebar>
        {selectedThread ? <ChatContainer>
          <ConversationHeader>
            {!EMPLOYEE_CONTEXT && <ConversationHeader.Back onClick={() => { mobileThreadRef.current = false; setMobileThread(false); }} />}
            {messengerAvatar(selectedThread.title, isMemphis(selectedThread) ? MEMPHIS_AVATAR : '')}
            <ConversationHeader.Content userName={selectedThread.title} info={EMPLOYEE_CONTEXT ? '' : (selectedThread.shared ? 'Leadership' : selectedThread.participantNames || '')} />
            <ConversationHeader.Actions><div className="mz-chat-thread-actions"><button ref={emojiButton} className="mz-button mz-emoji-toggle" type="button" aria-label="Insert emoji" aria-expanded={emojiOpen} aria-controls="messenger-emoji-picker" disabled={!selectedThread.canSend || accessBlocked} onPointerDown={captureEmojiCaret} onClick={() => setEmojiOpen(open => !open)}>Emoji</button>{!EMPLOYEE_CONTEXT && <button className="mz-button mz-chat-mobile-back" type="button" onClick={() => { mobileThreadRef.current = false; setMobileThread(false); }}>Chats</button>}{!selectedThread.shared && <button className="mz-button danger" type="button" disabled={identity?.read_only || accessBlocked} onClick={() => void deleteThread(selectedThread.id)}>Delete</button>}</div></ConversationHeader.Actions>
          </ConversationHeader>
          <MessageList loading={loadingMessages} loadingMore={false}>
            {renderedMessages}
            {!loadingMessages && !messages.length && <Message model={{ message: 'No messages yet.', direction: 'incoming', position: 'single' }} />}
          </MessageList>
          <MessageInput
            key={draftKey}
            ref={composerRef}
            value={drafts[draftKey] || ''}
            aria-label="Message composer"
            onKeyPressCapture={event => { if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) event.stopPropagation(); }}
            placeholder={selectedThread.canSend ? 'Type a message' : 'Read-only conversation'}
            attachButton={false}
            disabled={!selectedThread.canSend || accessBlocked}
            sendDisabled={composerTooLong || !plainMessageBody(htmlMessageBody(drafts[draftKey] || ''))}
            sendOnReturnDisabled={composerTooLong}
            onChange={handleComposerChange}
            onSend={sendMessage}
          />
        </ChatContainer> : <div className="mz-chat-empty"><div><strong>Choose a message</strong>Tap a person, or tap New.</div></div>}
      </MainContainer>
    </section>
    {accessBlocked && <button className="mz-button mz-reconnect" type="button" onClick={() => window.location.reload()}>Reopen Messages</button>}
    {emojiOpen && <section ref={emojiPanel} className="mz-emoji-picker" id="messenger-emoji-picker" role="group" aria-label="Emoji picker">{EMOJI_CHOICES.map(([emoji,label]) => <button className="mz-button" key={label} type="button" aria-label={label} title={label} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</section>}
    {composerTooLong && <div className="mz-chat-status error" role="alert">Messages can be up to 2,000 characters.</div>}
    {deleteRecoveries.length > 0 && <section className="mz-chat-status error" role="alert" aria-label="Saved deletion recovery">
      <strong>Saved deletion needs manager recovery.</strong><span> It was not applied automatically.</span>
      {managerCanResolveDeleteRecoveries && deleteRecoveries.filter(recovery => !recovery.originalOwnerHeld).map((recovery, index) => <button
        className="mz-button danger"
        type="button"
        key={`${recovery.key}:${recovery.raw}`}
        aria-label={`Discard saved deletion ${index + 1}`}
        onClick={() => void discardDeleteRecovery(recovery)}
      >Discard saved deletion</button>)}
    </section>}
    {messageRecoveries.length > 0 && <section className="mz-chat-status error" role="alert" aria-label="Saved message recovery">
      <strong>Saved message needs manager recovery.</strong><span> It was not sent automatically.</span>
      {messageRecoveries.filter((recovery) => recovery.discardable).map((recovery, index) => <button
        className="mz-button danger"
        type="button"
        key={`${recovery.key}:${recovery.raw}`}
        aria-label={`Discard saved message ${index + 1}`}
        onClick={() => void discardMessageRecovery(recovery)}
      >Discard saved message</button>)}
    </section>}
    {heldReadOriginals && <div className="mz-chat-status error" role="status">A saved read acknowledgement cannot be verified. Its original data remains held; no read was sent or cleared for that record.</div>}
    {status && <div className={`mz-chat-status ${statusKind}`} role="status" aria-live="polite">{status}</div>}
    {newConversation && identity?.msg_user_id && <NewConversation key={`${identity.msg_user_id}:${currentDeviceId}`} currentUserId={String(identity.msg_user_id)} currentDeviceId={currentDeviceId} getCurrentIdentity={() => mounted.current && !accessBlocked ? identityRef.current : null} onClose={() => setNewConversation(false)} onCreated={async (id,assertCurrent,retireOriginal) => { assertCurrent(); const rows = await loadThreads({ preferId:id, assertCurrent }); assertCurrent(); if (retireOriginal) { if (!rows.some(row => row.id === id && row.type === 'group')) throw new Error('confirmed group is not currently available'); await retireOriginal(); assertCurrent(); } selectThread(id); setNewConversation(false); }} />}
  </div>;
}

createRoot(document.getElementById('chatscope-root')).render(<MessengerApp />);
