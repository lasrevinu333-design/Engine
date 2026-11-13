(() => {
  'use strict';

  const API = 'https://memphis-zoo-mcp.onrender.com/messaging-api';
  const MEMPHIS_AVATAR = './memphis_avatar_ui.webp';
  const DEVICE_KEYS = ['memphisAssignedDeviceId', 'mz_scan_device_id', 'mz_employee_hub_device_id'];
  const SYSTEM_THREAD_KEY = 'ops_manager_shared_chat_v1';
  const OUTBOX_PREFIX = 'mz_messenger_v2_outbox:';
  const DRAFT_PREFIX = 'mz_messenger_v2_draft:';

  const state = {
    identity: null,
    session: null,
    deviceId: '',
    hub: 'manager',
    threads: [],
    selectedId: '',
    messages: [],
    users: [],
    pollTimer: 0,
    toastTimer: 0,
    busy: false,
  };

  const els = {
    app: document.getElementById('messenger-app'),
    back: document.getElementById('messenger-back'),
    identity: document.getElementById('identity-line'),
    search: document.getElementById('conversation-search'),
    threads: document.getElementById('thread-list'),
    threadEmpty: document.getElementById('thread-empty'),
    chatTitle: document.getElementById('chat-title'),
    chatMeta: document.getElementById('chat-meta'),
    messages: document.getElementById('chat-messages'),
    composer: document.getElementById('composer'),
    input: document.getElementById('compose-input'),
    send: document.getElementById('send-message'),
    mobileChats: document.getElementById('mobile-chats'),
    deleteThread: document.getElementById('delete-thread'),
    memphis: document.getElementById('open-memphis'),
    newChat: document.getElementById('new-chat'),
    overlay: document.getElementById('new-overlay'),
    people: document.getElementById('people-list'),
    groupTitleWrap: document.getElementById('group-title-wrap'),
    groupTitle: document.getElementById('group-title'),
    newStatus: document.getElementById('new-status'),
    create: document.getElementById('create-conversation'),
    cancel: document.getElementById('cancel-conversation'),
    toast: document.getElementById('messenger-toast'),
  };

  function safe(error) {
    return error instanceof Error ? error.message : String(error || 'Unknown error');
  }

  async function custodialSecurityPaused() {
    const required = custodialNativeWriterRequired();
    const security = window.MemphisCustodialSecurity;
    if (!security) return required;
    try {
      if (typeof security.waitForStableState === 'function') await security.waitForStableState({ requireEnrollment: true });
      const status = typeof security.getStatus === 'function' ? security.getStatus() : null;
      return status?.ready !== true || status?.quarantined === true || status?.available === false;
    } catch (_error) { return true; }
  }

  function securityPauseError(error) {
    return ['custodial_restore_quarantine', 'custodial_secure_storage_unavailable', 'custodial_security_state_unavailable', 'custodial_security_generation_changed', 'custodial_device_not_enrolled', 'custodial_enrollment_confirmation_pending', 'custodial_enrollment_removal_pending'].includes(String(error?.code || ''));
  }

  let custodialNativeWriterObserved = false;
  function custodialNativeWriterRequired() {
    // Bootstrap hints only DENY a web fallback; none is a work capability.
    // Once observed, missing/replaced hints cannot thaw this page to web mode.
    if (custodialNativeWriterObserved) return true;
    try {
      if (window.MemphisCustodialSecurity?.native === true
        || window.MemphisMobile?.edition === 'custodial'
        || window.MemphisMobileBuildIdentity?.edition === 'custodial'
        || window.Capacitor?.isNativePlatform?.() === true
        || ['android', 'ios'].includes(window.Capacitor?.getPlatform?.())) custodialNativeWriterObserved = true;
    } catch (_error) { custodialNativeWriterObserved = true; }
    return custodialNativeWriterObserved;
  }

  function custodialWorkSecurity() {
    try {
      const required = custodialNativeWriterRequired();
      const security = window.MemphisCustodialSecurity;
      if (security?.native === true) {
        custodialNativeWriterObserved = true;
        if (typeof security.mutateProtectedWork === 'function') return security;
      }
      if (!required && !custodialNativeWriterObserved) return null;
    } catch (_error) { custodialNativeWriterObserved = true; }
    throw Object.assign(new Error('Custodial security is not available for Messenger work.'), {
      code: 'custodial_security_state_unavailable',
    });
  }

  async function mutateCustodialWork(operation, options = { requireEnrollment: true }) {
    const security = custodialWorkSecurity();
    if (security) return security.mutateProtectedWork(operation, options);
    return operation();
  }

  async function retainOutboxFailure(entry, error) {
    if (securityPauseError(error)) return;
    await mutateCustodialWork(() => localStorage.setItem(`${OUTBOX_PREFIX}${entry.id}`, JSON.stringify({
      ...entry,
      retry_count: Number(entry.retry_count || 0) + 1,
      last_attempt_at: Date.now(),
      last_error: safe(error).slice(0, 500),
    })));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function hubContext() {
    const requested = String(new URL(location.href).searchParams.get('hub') || '').trim().toLowerCase();
    return requested === 'employee' ? 'employee' : 'manager';
  }

  function resolveDeviceId() {
    const security = custodialWorkSecurity();
    if (security) {
      const status = security.getStatus?.();
      return status?.ready === true && status?.available === true ? String(status.deviceId || '').trim() : '';
    }
    const url = new URL(location.href);
    const explicit = String(url.searchParams.get('device') || url.searchParams.get('deviceId') || '').trim();
    if (explicit) {
      try {
        localStorage.setItem('memphisAssignedDeviceId', explicit);
        localStorage.setItem('mz_scan_device_id', explicit);
      } catch {}
      return explicit;
    }
    const fromAuth = String(window.MemphisAuth?.getDeviceId?.() || '').trim();
    if (fromAuth) return fromAuth;
    for (const key of DEVICE_KEYS) {
      const value = String(localStorage.getItem(key) || '').trim();
      if (value) return value;
    }
    return '';
  }

  function roleTitle(user = {}) {
    const explicit = String(user.role_title || user.job_title || '').trim();
    if (explicit) return explicit;
    const role = String(user.role || '').trim().toLowerCase();
    if (role === 'bot') return 'Memphis AI';
    if (role === 'manager') return 'Operations Leadership';
    return 'Custodial Team';
  }

  async function managerHeaders() {
    if (state.hub !== 'manager') return {};
    const session = state.session || await window.MemphisAuth?.requireOpsManagerSession?.({
      accessLevel: 'full_access',
      interactive: true,
      redirect: false,
      throwOnFailure: true,
    });
    if (!session?.token) throw new Error('Manager access is required.');
    state.session = session;
    return {
      Authorization: `Bearer ${session.token}`,
      'X-Device-Id': session.device_id || state.deviceId,
    };
  }

  function custodialEmployeeMessage() {
    return state.hub === 'employee' && custodialNativeWriterRequired();
  }
  function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
  function originalMessageHeld() {
    return Object.assign(new Error('Original employee message is held until its protected sender mapping and generation are verified.'), {code:'messenger_original_owner_held'});
  }
  const originalEmployeeProfileOwners = new WeakMap();
  function readOriginalEmployeeMessageOwner(mapped, deviceId) {
    custodialNativeWriterRequired();
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

  function acceptedEmployeeMessageReceipt(entry, envelope) {
    const message = entry.memphis ? envelope?.data?.user_message : envelope?.data;
    const matches = (a,b) => isUuid(a) && isUuid(b) && a.toLowerCase() === b.toLowerCase();
    const body = entry.memphis ? entry.body.trim() : entry.body.replace(/^ +| +$/g, '');
    if (envelope?.ok !== true || !isUuid(message?.id) || !matches(message.thread_id,entry.thread_id)
        || !matches(message.sender_user_id,entry.user_id) || message.client_message_id !== entry.id
        || message.message_type !== 'text' || message.body !== body) throw originalMessageHeld();
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

  async function api(path, { method = 'GET', body = null, expectedGeneration } = {}) {
    if (window.MemphisMobile?.requestEnvelope) {
      return window.MemphisMobile.requestEnvelope(`/messaging-api${path}`, { method, body, ...(expectedGeneration === undefined ? {} : {expectedGeneration}) });
    }
    if (custodialEmployeeMessage()) throw originalMessageHeld();
    const headers = new Headers(await managerHeaders());
    if (body != null) headers.set('Content-Type', 'application/json');
    if (state.deviceId && !headers.has('X-Device-Id')) headers.set('X-Device-Id', state.deviceId);
    const response = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      credentials: state.hub === 'manager' ? 'include' : 'omit',
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function query(path, parameters = {}) {
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== '' && value != null) search.set(key, String(value));
    }
    const suffix = search.toString();
    return `${normalizedPath}${suffix ? `?${suffix}` : ''}`;
  }

  function normalizeThread(row = {}) {
    return {
      ...row,
      id: String(row.thread_id || row.id || ''),
      title: String(row.thread_title || row.title || 'Conversation'),
      type: String(row.thread_type || 'direct').toLowerCase(),
      systemKey: String(row.system_key || ''),
      canSend: row.viewer_can_send !== false,
      unread: Number(row.unread_count || 0),
      participantNames: String(row.participant_names || ''),
    };
  }

  function isRetiredSystemThread(thread) {
    return thread.systemKey === SYSTEM_THREAD_KEY || thread.is_ops_manager_shared === true;
  }

  function isMemphis(thread) {
    return thread?.type === 'bot' || String(thread?.title || '').trim().toLowerCase() === 'memphis';
  }

  function initials(value) {
    return String(value || 'M').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'M';
  }

  function formatTime(value) {
    const date = new Date(value || 0);
    if (!Number.isFinite(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function showToast(message, kind = '') {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.className = `uxToast show ${kind}`.trim();
    state.toastTimer = setTimeout(() => { els.toast.className = 'uxToast'; }, 2600);
  }

  // Native profile DATA may be retained only by the exact ordinary request's
  // original runtime, principal and page state. This closure is a live fence,
  // not a reusable authentication result or a public profile-flag factory.
  function originalEmployeeProfileRequestGuard(device) {
    const security = custodialWorkSecurity(), mobile = window.MemphisMobile;
    const statusMethod = security?.getStatus, principalMethod = mobile?.principalIdentity;
    const writerMethod = security?.mutateProtectedWork;
    const matchMethod = mobile?.profileMatchesPrincipal;
    const status = statusMethod?.call(security), principal = status?.principal;
    const identity = principalMethod?.call(mobile), generation = status?.generation;
    if (security?.native !== true || typeof statusMethod !== 'function' || typeof principalMethod !== 'function'
      || typeof matchMethod !== 'function' || typeof writerMethod !== 'function' || status?.ready !== true || status.available !== true || status.quarantined
      || !Number.isSafeInteger(generation) || generation < 1 || status.deviceId !== device
      || typeof identity !== 'string' || !identity || principal?.device_id !== device
      || !isUuid(principal?.employee_id) || !isUuid(principal?.credential_id)
      || !Number.isSafeInteger(principal?.assignment_epoch) || principal.assignment_epoch < 1) throw originalMessageHeld();
    const before = {employee:principal.employee_id,credential:principal.credential_id,epoch:principal.assignment_epoch};
    const current = mapped => {
      if (custodialWorkSecurity() !== security || window.MemphisMobile !== mobile
        || security.getStatus !== statusMethod || security.mutateProtectedWork !== writerMethod || mobile.principalIdentity !== principalMethod || mobile.profileMatchesPrincipal !== matchMethod
        || state.hub !== 'employee' || state.deviceId !== device || state.identity !== mapped) throw originalMessageHeld();
      const observed = statusMethod.call(security), p = observed?.principal;
      if (observed?.ready !== true || observed.available !== true || observed.quarantined || observed.generation !== generation
        || observed.deviceId !== device || principalMethod.call(mobile) !== identity || p?.device_id !== device
        || p?.employee_id !== before.employee || p?.credential_id !== before.credential || p?.assignment_epoch !== before.epoch
        || state.hub !== 'employee' || state.deviceId !== device || state.identity !== mapped
        || window.MemphisCustodialSecurity !== security || security.native !== true
        || security.mutateProtectedWork !== writerMethod || window.MemphisMobile !== mobile || security.getStatus !== statusMethod
        || mobile.principalIdentity !== principalMethod || mobile.profileMatchesPrincipal !== matchMethod
        || observed.principal !== p || observed.ready !== true || observed.available !== true || observed.quarantined
        || observed.generation !== generation || observed.deviceId !== device) throw originalMessageHeld();
    };
    return current;
  }

  async function loadIdentity() {
    const originalMapped = state.identity, device = state.deviceId, hub = state.hub;
    const security = hub === 'employee' ? custodialWorkSecurity() : null;
    const assertOriginal = security ? originalEmployeeProfileRequestGuard(device) : null;
    assertOriginal?.(originalMapped);
    const path = hub === 'manager' ? '/me/by-device' : query('/me/by-device', { device_id: device });
    const envelope = await api(path);
    assertOriginal?.(originalMapped);
    let profileOwner = null;
    const identity = assertOriginal ? {...envelope.data,read_only:envelope.data?.read_only === true} : envelope.data || {};
    if (!identity.msg_user_id) throw new Error('This phone does not have a Messenger identity.');
    if (assertOriginal) {
      if (envelope?.ok !== true) throw originalMessageHeld();
      const owner = readOriginalEmployeeMessageOwner(identity,device);profileOwner = owner;
      assertOriginal(originalMapped);
      if (!originalEmployeeProfileMatchesOwner(identity,owner)) throw originalMessageHeld();
      originalEmployeeProfileOwners.set(identity,Object.freeze({owner,current:() => {
        assertOriginal(identity);
        if (!originalEmployeeProfileMatchesOwner(identity,owner)) throw originalMessageHeld();
      }}));
    }
    if (!custodialWorkSecurity()) localStorage.setItem('mz_messenger_user_id', String(identity.msg_user_id));
    assertOriginal?.(originalMapped);
    if (assertOriginal && !originalEmployeeProfileMatchesOwner(identity,profileOwner)) throw originalMessageHeld();
    state.identity = identity;
    if (assertOriginal) originalEmployeeMessageOwner(identity,device);
    const title = roleTitle(identity);
    els.identity.textContent = `${identity.display_name || 'Memphis Zoo'}${title ? ` · ${title}` : ''}`;
    return identity;
  }

  async function loadThreads({ keepSelection = true } = {}) {
    const identity = state.identity || await loadIdentity();
    const envelope = await api(query('/threads', {
      user_id: identity.msg_user_id,
      device_id: state.deviceId,
    }));
    const rows = (Array.isArray(envelope.data) ? envelope.data : [])
      .map(normalizeThread)
      .filter((thread) => thread.id && !isRetiredSystemThread(thread));
    state.threads = rows;
    renderThreads();
    const requested = new URL(location.href).searchParams.get('thread_id') || '';
    const desired = keepSelection ? (state.selectedId || requested) : requested;
    if (desired && rows.some((thread) => thread.id === desired)) {
      await selectThread(desired, { updateUrl: false });
    } else if (state.selectedId && !rows.some((thread) => thread.id === state.selectedId)) {
      closeThread();
    }
    return rows;
  }

  function filteredThreads() {
    const needle = String(els.search.value || '').trim().toLowerCase();
    if (!needle) return state.threads;
    return state.threads.filter((thread) =>
      `${thread.title} ${thread.participantNames} ${thread.last_message_body || ''}`
        .toLowerCase().includes(needle));
  }

  function renderThreads() {
    const rows = filteredThreads();
    els.threadEmpty.hidden = rows.length > 0;
    els.threads.innerHTML = rows.map((thread) => {
      const memphis = isMemphis(thread);
      const avatar = memphis
        ? `<img src="${MEMPHIS_AVATAR}" alt="">`
        : escapeHtml(initials(thread.title));
      const preview = thread.last_message_body || (memphis ? 'Ask Memphis about schedules, locations, events, or coverage.' : 'No messages yet.');
      return `<button class="threadRow${thread.id === state.selectedId ? ' active' : ''}" type="button" data-thread-id="${escapeHtml(thread.id)}">
        <span class="threadAvatar" aria-hidden="true">${avatar}</span>
        <span class="threadCopy">
          <span class="threadTitle">${escapeHtml(thread.title)}</span>
          <span class="threadPreview">${escapeHtml(preview)}</span>
        </span>
        <span class="threadMeta">
          <span>${escapeHtml(formatTime(thread.last_message_at || thread.updated_at))}</span>
          ${thread.unread ? `<span class="unreadBadge">${thread.unread > 99 ? '99+' : thread.unread}</span>` : ''}
        </span>
      </button>`;
    }).join('');
  }

  async function loadMessages(threadId) {
    const employee = custodialEmployeeMessage(), mapped = state.identity;
    let owner;
    if (employee) { try { owner = originalEmployeeMessageOwner(mapped,state.deviceId); } catch {} }
    const envelope = await api(query(`/thread/${encodeURIComponent(threadId)}/messages`, {
      user_id: state.identity.msg_user_id,
      device_id: state.deviceId,
      limit: 200,
    }), owner ? {expectedGeneration:owner.generation} : undefined);
    if (employee && state.identity !== mapped) return;
    if (owner) { try { assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId); } catch { return; } }
    state.messages = (Array.isArray(envelope.data) ? envelope.data : []).filter((message) => message.is_deleted !== true);
    renderMessages();
    const thread = state.threads.find((item) => item.id === threadId);
    if (thread?.canSend !== false) {
      if (employee) {
        const through = state.messages[state.messages.length-1];
        if (owner && isUuid(through?.id) && through.thread_id === threadId)
          await saveOriginalEmployeeRead(threadId,through,owner,mapped).catch(() => {});
        return;
      }
      void api(`/thread/${encodeURIComponent(threadId)}/read`, {
        method: 'POST',
        body: { user_id: state.identity.msg_user_id, device_id: state.deviceId },
      }).catch(() => {});
    }
  }

  function renderMessages() {
    const thread = state.threads.find((item) => item.id === state.selectedId);
    if (!thread) return;
    if (!state.messages.length) {
      els.messages.innerHTML = '<div class="chatEmpty">No messages yet.<br>Start the conversation when you are ready.</div>';
      return;
    }
    els.messages.innerHTML = state.messages.map((message) => {
      const mine = String(message.sender_user_id) === String(state.identity.msg_user_id);
      const bot = String(message.sender_display_name || '').trim().toLowerCase() === 'memphis';
      const classes = `messageRow${mine ? ' mine' : ''}${bot ? ' bot' : ''}`;
      return `<div class="${classes}">
        <div class="messageBubble">
          ${!mine ? `<div class="messageSender">${escapeHtml(message.sender_display_name || 'Unknown')}</div>` : ''}
          <div>${escapeHtml(message.body || '')}</div>
          <div class="messageTime">${escapeHtml(formatTime(message.sent_at || message.created_at))}${message.failed ? ' · queued' : ''}</div>
        </div>
      </div>`;
    }).join('');
    requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
  }

  async function selectThread(threadId, { updateUrl = true } = {}) {
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) return;
    state.selectedId = threadId;
    els.app.classList.add('threadOpen');
    els.chatTitle.textContent = thread.title;
    els.chatMeta.textContent = isMemphis(thread)
      ? 'Memphis Zoo operations assistant'
      : (thread.participantNames || (thread.type === 'group' ? 'Group conversation' : 'Direct message'));
    els.deleteThread.hidden = isRetiredSystemThread(thread);
    els.composer.hidden = thread.canSend === false;
    els.input.value = sessionStorage.getItem(`${DRAFT_PREFIX}${threadId}`) || '';
    renderThreads();
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('thread_id', threadId);
      history.replaceState(null, '', url);
    }
    els.messages.innerHTML = '<div class="chatEmpty">Loading conversation…</div>';
    await loadMessages(threadId);
  }

  function closeThread() {
    state.selectedId = '';
    state.messages = [];
    els.app.classList.remove('threadOpen');
    els.messages.innerHTML = '<div class="chatEmpty">Choose a conversation.</div>';
    const url = new URL(location.href);
    url.searchParams.delete('thread_id');
    history.replaceState(null, '', url);
    renderThreads();
  }

  function clientMessageId() {
    return `msg:${crypto.randomUUID()}`;
  }

  async function deliverOriginalEmployeeMessage(entry, raw, owner, mapped) {
    if(entry.memphis===false)return deliverOriginalEmployeeAction(entry,raw,owner,()=>state.identity,state.deviceId,`${OUTBOX_PREFIX}${entry.id}`,'send');
    const key = `${OUTBOX_PREFIX}${entry.id}`;
    const assert = (context) => {
      if (state.identity !== mapped) throw originalMessageHeld();
      assertOriginalEmployeeMessageOwner(owner, state.identity, state.deviceId, context);
      if (localStorage.getItem(key) !== raw) throw originalMessageHeld();
    };
    const options = {requireEnrollment:true,expectedGeneration:owner.generation};
    await mutateCustodialWork(context => assert(context), options);
    assert();
    const receipt = await api(entry.memphis ? '/memphis/message' : `/thread/${encodeURIComponent(entry.thread_id)}/message`, {
      method:'POST',expectedGeneration:owner.generation,body:{
        ...(entry.memphis ? {user_id:entry.user_id,thread_id:entry.thread_id} : {sender_user_id:entry.user_id}),
        device_id:entry.device_id,body:entry.body,client_message_id:entry.id,...employeeMessageRequestPins(entry),
      },
    });
    assert();
    acceptedEmployeeMessageReceipt(entry, receipt);
    await mutateCustodialWork(context => {
      assert(context);
      localStorage.removeItem(key);
      assertOriginalEmployeeMessageOwner(owner, state.identity, state.deviceId, context);
      if (localStorage.getItem(key) !== null) throw originalMessageHeld();
    }, options);
    assertOriginalEmployeeMessageOwner(owner, state.identity, state.deviceId);
  }

  async function sendOriginalEmployeeMessage(thread, text) {
    if (!isUuid(thread?.id) || thread.canSend === false || Array.from(text).length > 2000) {
      showToast('This original message cannot be sent. Your draft remains.', 'error'); return;
    }
    const mapped = state.identity;
    let owner;
    try { owner = originalEmployeeMessageOwner(mapped, state.deviceId); }
    catch { showToast('Original employee identity is unavailable. Your draft has not been sent.', 'error'); return; }
    state.busy = true; els.send.disabled = true;
    let entry, saved = false, accepted = false;
    try {
      if (await custodialSecurityPaused()) throw originalMessageHeld();
      if (state.identity !== mapped) throw originalMessageHeld();
      assertOriginalEmployeeMessageOwner(owner, state.identity, state.deviceId);
      const id = clientMessageId();
      entry = {id,thread_id:thread.id,user_id:owner.userId,device_id:owner.deviceId,body:text,
        memphis:isMemphis(thread),created_at:Date.now(),...employeeMessagePins(owner)};
      if(!entry.memphis)entry={...entry,schema_version:ORIGINAL_SEND_OUTBOX_SCHEMA,message_type:'text',metadata_json:{}};
      const raw = JSON.stringify(entry), key = `${OUTBOX_PREFIX}${id}`;
      await mutateCustodialWork(context => {
        if (state.identity !== mapped) throw originalMessageHeld();
        assertOriginalEmployeeMessageOwner(owner, state.identity, state.deviceId, context);
        if (localStorage.getItem(key) !== null) throw originalMessageHeld();
        localStorage.setItem(key,raw);
        assertOriginalEmployeeMessageOwner(owner, state.identity, state.deviceId, context);
        if (localStorage.getItem(key) !== raw) throw originalMessageHeld();
      }, {requireEnrollment:true,expectedGeneration:owner.generation});
      assertOriginalEmployeeMessageOwner(owner, state.identity, state.deviceId);
      saved = true;
      if (els.input.value.trim() === text) els.input.value = '';
      if (sessionStorage.getItem(`${DRAFT_PREFIX}${thread.id}`)?.trim() === text) sessionStorage.removeItem(`${DRAFT_PREFIX}${thread.id}`);
      state.messages.push({id,sender_user_id:owner.userId,sender_display_name:mapped.display_name,
        body:text,sent_at:new Date().toISOString(),optimistic:true});
      renderMessages();
      await deliverOriginalEmployeeMessage(entry,raw,owner,mapped);
      accepted = true;
      await Promise.all([loadMessages(thread.id),loadThreads()]);
    } catch {
      // A later conversation read is separate from the exact accepted send.
      // Never report accepted/retired bytes as still queued or resend them.
      if (accepted) {
        try {
          if (state.identity !== mapped) throw originalMessageHeld();
          assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId);
        } catch { return; }
        showToast('Message sent. Conversation refresh is pending.', 'ok');
        return;
      }
      if (saved) {
        state.messages = state.messages.map(message => message.id === entry.id ? {...message,failed:true} : message);
        renderMessages();
      }
      showToast(saved ? 'Your original message is saved. Server confirmation is still pending.' : 'Message save could not be confirmed. Your draft remains.', 'error');
    } finally { state.busy = false; els.send.disabled = false; els.input.focus(); }
  }

  async function retryOriginalEmployeeOutbox() {
    const mapped = state.identity;
    let owner;
    try { owner = originalEmployeeMessageOwner(mapped,state.deviceId); } catch { return; }
    const entries = [];
    for (let index=0; index<localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(OUTBOX_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      try {
        const entry = JSON.parse(raw);
        if(entry.memphis===false&&!validOriginalEmployeeAction(entry,'send'))continue;
        if (originalEmployeeMessageMatches(entry,owner) && key === `${OUTBOX_PREFIX}${entry.id}`
            && /^msg:[0-9a-f-]{36}$/i.test(entry.id) && isUuid(entry.id.slice(4)) && isUuid(entry.thread_id)
            && typeof entry.body === 'string' && entry.body.trim() && Array.from(entry.body).length <= 2000
            && typeof entry.memphis === 'boolean' && Number.isFinite(entry.created_at)) entries.push({entry,raw});
      } catch { /* Whole unknown/legacy originals remain untouched. */ }
    }
    for (const {entry,raw} of entries.sort((a,b)=>a.entry.created_at-b.entry.created_at)) {
      try { await deliverOriginalEmployeeMessage(entry,raw,owner,mapped); }
      catch { return; } // Unknown original delivery is not retry-metadata authority.
    }
  }

  async function deliverOriginalEmployeeDeletion(entry,raw,owner,mapped) {
    return deliverOriginalEmployeeAction(entry,raw,owner,()=>state.identity,state.deviceId,`mz_chatscope_delete_outbox:${entry.id}`,'delete');
  }
  async function attemptOriginalEmployeeRead(key,row,raw,owner,mapped) {
    if (!validOriginalEmployeeRead(key,row,owner)) return;
    const assert=(expected,context)=>{
      if(state.identity!==mapped)throw originalMessageHeld();
      assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId,context);
      if(localStorage.getItem(key)!==expected)throw originalMessageHeld();
    };
    const queryOnly=row.delivery_attempted===true;
    const attempted=queryOnly?raw:JSON.stringify({...row,delivery_attempted:true});
    await mutateCustodialWork(context=>{
      assert(raw,context);if(!queryOnly)localStorage.setItem(key,attempted);
      assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId,context);
      if(localStorage.getItem(key)!==attempted)throw originalMessageHeld();
    },{requireEnrollment:true,expectedGeneration:owner.generation});
    assert(attempted);
    // Recover only the saved action's immutable outcome; never resend it.
    const receipt=await api(`/thread/${encodeURIComponent(row.thread_id)}/read${queryOnly?'/original-outcome':''}`,{method:'POST',expectedGeneration:owner.generation,
      body:{user_id:row.user_id,device_id:row.device_id,through_message_id:row.through_message_id,...employeeMessageRequestPins(row)}});
    assert(attempted);
    acceptedOriginalEmployeeRead(row,receipt);
    await mutateCustodialWork(context=>{
      assert(attempted,context);localStorage.removeItem(key);
      assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId,context);
      if(localStorage.getItem(key)!==null)throw originalMessageHeld();
    },{requireEnrollment:true,expectedGeneration:owner.generation});
    assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId);
  }
  async function saveOriginalEmployeeRead(threadId,through,owner,mapped) {
    const key=`mz_chatscope_read_outbox:${owner.userId}:${threadId}`;
    await mutateCustodialWork(context=>{
      if(state.identity!==mapped)throw originalMessageHeld();
      assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId,context);
      if(localStorage.getItem(key)!==null)return;
      const row={schema_version:'chatscope-read-outbox.v2',id:`${owner.userId}:${threadId}`,thread_id:threadId,
        user_id:owner.userId,device_id:owner.deviceId,through_message_id:through.id,
        through_at:String(through.sent_at||through.created_at||''),created_at:Date.now(),...employeeMessagePins(owner)};
      const raw=JSON.stringify(row);localStorage.setItem(key,raw);
      assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId,context);
      if(localStorage.getItem(key)!==raw)throw originalMessageHeld();
    },{requireEnrollment:true,expectedGeneration:owner.generation});
    assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId);
    const raw=localStorage.getItem(key);
    try { await attemptOriginalEmployeeRead(key,JSON.parse(raw),raw,owner,mapped); } catch { /* Held original retained. */ }
  }
  async function flushOriginalEmployeeMutations() {
    const mapped=state.identity;let owner;
    try { owner=originalEmployeeMessageOwner(mapped,state.deviceId); } catch { return; }
    const saved=[];
    for(let index=0;index<localStorage.length;index++) {
      const key=localStorage.key(index);
      if(!key?.startsWith('mz_chatscope_delete_outbox:')&&!key?.startsWith('mz_chatscope_read_outbox:'))continue;
      const raw=localStorage.getItem(key);try{saved.push({key,raw,row:JSON.parse(raw)});}catch{}
    }
    for(const {key,raw,row}of saved) {
      if(!originalEmployeeMessageMatches(row,owner))continue;
      try {
        if(key.startsWith('mz_chatscope_read_outbox:'))await attemptOriginalEmployeeRead(key,row,raw,owner,mapped);
        else if([ORIGINAL_DELETE_OUTBOX_SCHEMA,'chatscope-delete-outbox.v2'].includes(row.schema_version)&&isUuid(row.id)&&isUuid(row.thread_id)
            &&key===`mz_chatscope_delete_outbox:${row.id}`)
          await deliverOriginalEmployeeDeletion(row,raw,owner,mapped);
      }catch{ /* Exact original remains pending, no metadata/generation adoption. */ }
    }
  }
  async function deleteOriginalEmployeeThread(thread) {
    const mapped=state.identity;let owner;
    try{owner=originalEmployeeMessageOwner(mapped,state.deviceId);}catch{showToast('Original employee identity is unavailable. Conversation removal has not been sent.','error');return;}
    if(!isUuid(thread.id))return;
    for(let index=0;index<localStorage.length;index++) {
      const oldKey=localStorage.key(index);if(!oldKey?.startsWith('mz_chatscope_delete_outbox:'))continue;
      try{
        const old=JSON.parse(localStorage.getItem(oldKey));
        if(old.thread_id===thread.id&&old.user_id===owner.userId&&old.device_id===owner.deviceId){showToast('Conversation removal is saved. Server confirmation is still pending.','error');return;}
      }catch{showToast('Conversation removal is saved. Server confirmation is still pending.','error');return;}
    }
    const id=crypto.randomUUID(),key=`mz_chatscope_delete_outbox:${id}`;
    const row={schema_version:ORIGINAL_DELETE_OUTBOX_SCHEMA,id,thread_id:thread.id,user_id:owner.userId,
      device_id:owner.deviceId,created_at:Date.now(),...employeeMessagePins(owner)},raw=JSON.stringify(row);
    try{
      await mutateCustodialWork(context=>{
        if(state.identity!==mapped)throw originalMessageHeld();
        assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId,context);
        if(localStorage.getItem(key)!==null)throw originalMessageHeld();
        localStorage.setItem(key,raw);
        assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId,context);
        if(localStorage.getItem(key)!==raw)throw originalMessageHeld();
      },{requireEnrollment:true,expectedGeneration:owner.generation});
      assertOriginalEmployeeMessageOwner(owner,state.identity,state.deviceId);
      await deliverOriginalEmployeeDeletion(row,raw,owner,mapped);
      closeThread();await loadThreads({keepSelection:false});showToast('Conversation removed from your Messenger.','ok');
    }catch{showToast('Conversation removal is saved or unconfirmed. Original requests remain protected.','error');}
  }

  async function sendCurrentMessage(event) {
    event.preventDefault();
    if (state.busy || !state.selectedId) return;
    const text = String(els.input.value || '').trim();
    if (!text) return;
    const thread = state.threads.find((item) => item.id === state.selectedId);
    if (!thread) return;
    if (custodialEmployeeMessage()) return sendOriginalEmployeeMessage(thread,text);
    if (await custodialSecurityPaused()) {
      showToast('Protected phone recovery must finish before messages can be sent.', 'error');
      return;
    }
    state.busy = true;
    els.send.disabled = true;
    els.input.value = '';
    sessionStorage.removeItem(`${DRAFT_PREFIX}${thread.id}`);
    const id = clientMessageId();
    const optimistic = {
      id,
      sender_user_id: state.identity.msg_user_id,
      sender_display_name: state.identity.display_name,
      body: text,
      sent_at: new Date().toISOString(),
      optimistic: true,
    };
    state.messages.push(optimistic);
    renderMessages();
    const entry = {
      id,
      thread_id: thread.id,
      user_id: state.identity.msg_user_id,
      device_id: state.deviceId,
      body: text,
      memphis: isMemphis(thread),
      created_at: Date.now(),
    };
    const writeContext = await mutateCustodialWork((context) => {
      localStorage.setItem(`${OUTBOX_PREFIX}${id}`, JSON.stringify(entry));
      return context;
    });
    try {
      if (entry.memphis) {
        await api('/memphis/message', {
          method: 'POST',
          body: {
            user_id: entry.user_id,
            device_id: entry.device_id,
            thread_id: entry.thread_id,
            body: entry.body,
            client_message_id: entry.id,
          },
        });
      } else {
        await api(`/thread/${encodeURIComponent(entry.thread_id)}/message`, {
          method: 'POST',
          body: {
            sender_user_id: entry.user_id,
            device_id: entry.device_id,
            body: entry.body,
            client_message_id: entry.id,
          },
        });
      }
      await mutateCustodialWork(
        () => localStorage.removeItem(`${OUTBOX_PREFIX}${id}`),
        { requireEnrollment: true, expectedGeneration: writeContext?.generation ?? null },
      );
      await Promise.all([loadMessages(thread.id), loadThreads()]);
    } catch (error) {
      await retainOutboxFailure(entry, error).catch(() => {});
      state.messages = state.messages.map((message) => message.id === id ? { ...message, failed: true } : message);
      renderMessages();
      showToast(`Saved on this phone. Will retry when connected. ${safe(error)}`, 'error');
    } finally {
      state.busy = false;
      els.send.disabled = false;
      els.input.focus();
    }
  }

  async function retryOutbox() {
    if (custodialEmployeeMessage()) { await flushOriginalEmployeeMutations();return retryOriginalEmployeeOutbox(); }
    if (await custodialSecurityPaused()) return;
    const entries = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(OUTBOX_PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key));
        if (!['expected_employee_id','expected_credential_id','expected_assignment_epoch'].some(field => Object.prototype.hasOwnProperty.call(entry || {},field))) entries.push(entry);
      } catch {}
    }
    for (const entry of entries.sort((a, b) => Number(a.created_at) - Number(b.created_at))) {
      try {
        if (entry.memphis) {
          await api('/memphis/message', {
            method: 'POST',
            body: {
              user_id: entry.user_id,
              device_id: entry.device_id,
              thread_id: entry.thread_id,
              body: entry.body,
              client_message_id: entry.id,
            },
          });
        } else {
          await api(`/thread/${encodeURIComponent(entry.thread_id)}/message`, {
            method: 'POST',
            body: {
              sender_user_id: entry.user_id,
              device_id: entry.device_id,
              body: entry.body,
              client_message_id: entry.id,
            },
          });
        }
        await mutateCustodialWork(() => localStorage.removeItem(`${OUTBOX_PREFIX}${entry.id}`));
      } catch (error) {
        await retainOutboxFailure(entry, error).catch(() => {});
      }
    }
  }

  async function openMemphis() {
    let thread = state.threads.find(isMemphis);
    if (!thread) {
      const envelope = await api('/memphis/thread', {
        method: 'POST',
        body: { user_id: state.identity.msg_user_id, device_id: state.deviceId },
      });
      const id = String(envelope.data?.id || envelope.data?.thread_id || '');
      await loadThreads();
      thread = state.threads.find((item) => item.id === id) || state.threads.find(isMemphis);
    }
    if (thread) await selectThread(thread.id);
  }

  async function openNewConversation() {
    els.overlay.hidden = false;
    els.newStatus.textContent = 'Loading people…';
    els.people.innerHTML = '';
    try {
      const envelope = await api(query('/users', {
        user_id: state.identity.msg_user_id,
        device_id: state.deviceId,
      }));
      state.users = (Array.isArray(envelope.data) ? envelope.data : [])
        .filter((user) => user.is_active !== false && user.role !== 'bot' && String(user.id) !== String(state.identity.msg_user_id));
      els.people.innerHTML = state.users.map((user) => `<label class="personRow">
        <input type="checkbox" value="${escapeHtml(user.id)}">
        <span><span class="personName">${escapeHtml(user.display_name || 'User')}</span><span class="personRole">${escapeHtml(roleTitle(user))}</span></span>
      </label>`).join('') || '<div class="threadEmpty">No available recipients.</div>';
      els.newStatus.textContent = '';
      updateNewConversationState();
    } catch (error) {
      els.newStatus.textContent = safe(error);
      els.newStatus.className = 'uxStatus error';
    }
  }

  function selectedPeople() {
    return Array.from(els.people.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
  }

  function updateNewConversationState() {
    const count = selectedPeople().length;
    els.groupTitleWrap.hidden = count < 2;
    els.create.disabled = count === 0;
  }

  async function createConversation() {
    const members = selectedPeople();
    if (!members.length) return;
    els.create.disabled = true;
    els.newStatus.className = 'uxStatus info';
    els.newStatus.textContent = 'Creating conversation…';
    try {
      let envelope;
      if (members.length === 1) {
        envelope = await api('/thread/direct', {
          method: 'POST',
          body: {
            created_by_user_id: state.identity.msg_user_id,
            other_user_id: members[0],
            device_id: state.deviceId,
          },
        });
      } else {
        envelope = await api('/thread/group', {
          method: 'POST',
          body: {
            created_by_user_id: state.identity.msg_user_id,
            member_user_ids: members,
            title: String(els.groupTitle.value || '').trim() || null,
            device_id: state.deviceId,
            client_thread_id: `thread:${crypto.randomUUID()}`,
          },
        });
      }
      const id = String(envelope.data?.id || envelope.data?.thread_id || '');
      closeNewConversation();
      await loadThreads();
      if (id) await selectThread(id);
    } catch (error) {
      els.newStatus.className = 'uxStatus error';
      els.newStatus.textContent = safe(error);
      els.create.disabled = false;
    }
  }

  function closeNewConversation() {
    els.overlay.hidden = true;
    els.people.innerHTML = '';
    els.groupTitle.value = '';
    els.newStatus.textContent = '';
    els.newStatus.className = 'uxStatus';
  }

  async function deleteCurrentThread() {
    const thread = state.threads.find((item) => item.id === state.selectedId);
    if (!thread || isRetiredSystemThread(thread)) return;
    const prompt = isMemphis(thread)
      ? 'Delete this Memphis conversation from your Messenger? Your next Memphis message will start a clean conversation.'
      : `Delete “${thread.title}” from your Messenger? Other participants keep their copy.`;
    if (!confirm(prompt)) return;
    if(custodialEmployeeMessage())return deleteOriginalEmployeeThread(thread);
    try {
      await api(`/thread/${encodeURIComponent(thread.id)}/delete`, {
        method: 'POST',
        body: { device_id: state.deviceId, operation_id: `delete:${crypto.randomUUID()}` },
      });
      closeThread();
      await loadThreads({ keepSelection: false });
      showToast('Conversation removed from your Messenger.', 'ok');
    } catch (error) {
      showToast(safe(error), 'error');
    }
  }

  async function refresh() {
    try {
      await retryOutbox();
      await loadThreads();
      if (state.selectedId) await loadMessages(state.selectedId);
    } catch (error) {
      if (securityPauseError(error)) {
        if (state.pollTimer) window.clearInterval(state.pollTimer);
        state.pollTimer = 0;
        return;
      }
      if (navigator.onLine) showToast(safe(error), 'error');
    }
  }

  function bindEvents() {
    els.back.addEventListener('click', (event) => {
      if (els.app.classList.contains('threadOpen') && matchMedia('(max-width:720px)').matches) {
        event.preventDefault();
        closeThread();
      }
    });
    els.mobileChats.addEventListener('click', closeThread);
    els.search.addEventListener('input', renderThreads);
    els.threads.addEventListener('click', (event) => {
      const row = event.target.closest('[data-thread-id]');
      if (row) void selectThread(row.dataset.threadId);
    });
    els.composer.addEventListener('submit', sendCurrentMessage);
    els.input.addEventListener('input', () => {
      if (state.selectedId) sessionStorage.setItem(`${DRAFT_PREFIX}${state.selectedId}`, els.input.value);
    });
    els.memphis.addEventListener('click', () => void openMemphis());
    els.newChat.addEventListener('click', () => void openNewConversation());
    els.cancel.addEventListener('click', closeNewConversation);
    els.overlay.addEventListener('click', (event) => { if (event.target === els.overlay) closeNewConversation(); });
    els.people.addEventListener('change', updateNewConversationState);
    els.create.addEventListener('click', () => void createConversation());
    els.deleteThread.addEventListener('click', () => void deleteCurrentThread());
    window.addEventListener('online', () => void refresh());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
    window.addEventListener('memphis:custodial-security-state', (event) => {
      const status = event.detail || {};
      if (status.ready === true && status.available === true && !status.quarantined) return;
      if (state.pollTimer) window.clearInterval(state.pollTimer);
      state.pollTimer = 0;
    });
  }

  async function init() {
    state.hub = hubContext();
    state.deviceId = resolveDeviceId();
    els.back.href = state.hub === 'employee' ? './employee-hub.html?hub=employee' : './start_page1.html';
    bindEvents();
    await loadIdentity();
    await loadThreads();
    const mode = new URL(location.href).searchParams.get('mode');
    if (mode === 'memphis') await openMemphis();
    if (mode === 'new') await openNewConversation();
    await retryOutbox();
    state.pollTimer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
  }

  init().catch((error) => {
    els.identity.textContent = safe(error);
    els.identity.style.borderColor = 'rgba(255,107,114,.5)';
    showToast(safe(error), 'error');
  });
})();
