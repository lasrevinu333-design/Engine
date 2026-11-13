export const NATIVE_NOTIFICATION_RECEIPT_SCHEMA = 'native-notification-outbox.v3';

// Several native, resume and network callbacks may request the same outbox
// drain together. Run one pass at a time, then revisit entries added while a
// pass was in flight. A failed pass leaves durable rows for the next trigger.
export function createNotificationOutboxFlusher(pass) {
  let flight = null;
  let requested = false;
  const flush = () => {
    requested = true;
    if (flight) return flight;
    const current = Promise.resolve().then(async () => {
      do {
        requested = false;
        await pass();
      } while (requested);
    });
    flight = current;
    const settled = () => {
      if (flight !== current) return;
      flight = null;
      // A callback can queue a request between the last loop check and this
      // settlement callback. Do not strand that newly persisted receipt.
      if (requested) void flush().catch(() => {});
    };
    current.then(settled, settled);
    return current;
  };
  return flush;
}

// Origin is an opaque, operation-local witness, not credentials, a saved-row
// claim or a server authentication capability. Only the owning bridge captures
// these trusted readers BEFORE its original HTTP request. Nothing is persisted.
const settlementOrigins = new WeakMap();
const OUTBOX_PREFIX = 'mz_native_notification_outbox:';
const stableReceiptOperation = value => {
  const {attempts, last_attempt_at, ...operation} = value;
  return JSON.stringify(operation);
};

function originalSettlementRow(encoded) {
  try {
    const row = JSON.parse(encoded);
    const fields = ['schema_version','id','kind','notification_key','notification_type',
      'action','device_id','receipt_binding','created_at','attempts'];
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || fields.some(key => !Object.hasOwn(row, key))
      || Object.keys(row).some(key => !fields.includes(key) && key !== 'last_attempt_at')
      || row.schema_version !== NATIVE_NOTIFICATION_RECEIPT_SCHEMA
      || !Number.isSafeInteger(row.attempts) || row.attempts < 0
      || typeof row.created_at !== 'string' || !row.created_at
      || Object.hasOwn(row,'last_attempt_at') && (typeof row.last_attempt_at !== 'string' || !row.last_attempt_at)
      || typeof row.notification_key !== 'string' || !row.notification_key || row.notification_key.length > 500
      || !row.receipt_binding || Object.keys(row.receipt_binding).sort().join('|')
        !== ['job_id','credential_id','assignment_epoch','employee_id','device_id'].sort().join('|')) return null;
    const normalized = normalizeNativeNotificationReceipt(row);
    if (!normalized || normalized.legacy_unbound || JSON.stringify(normalized) !== JSON.stringify(row)) return null;
    const b = row.receipt_binding;
    if (row.id !== `${b.job_id}:${b.credential_id}:${b.assignment_epoch}:${row.kind}:${row.action}:${row.notification_key}`) return null;
    return row;
  } catch { return null; }
}

function settlementOriginCurrent(bound) {
  try {
    const current = protectedPrincipal(bound.getPrincipal());
    const identity = bound.getPrincipalIdentity(), generation = bound.getGeneration();
    return current && principalIdentity(current) === bound.expectedPrincipalIdentity
      && identity === bound.expectedPrincipalIdentity && generation === bound.expectedGeneration
      && receiptMatchesProtectedPrincipal(bound.row, current)
      && bound.getGeneration() === bound.expectedGeneration
      && bound.getPrincipalIdentity() === bound.expectedPrincipalIdentity;
  } catch { return false; }
}

export function captureNotificationOutboxSettlementOrigin({storage, key, encoded, row,
  expectedPrincipalIdentity, expectedGeneration, getPrincipal, getPrincipalIdentity, getGeneration} = {}) {
  try {
    if (!storage || typeof storage.getItem !== 'function' || typeof key !== 'string'
      || typeof encoded !== 'string' || !expectedPrincipalIdentity
      || typeof expectedPrincipalIdentity !== 'string' || !Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0
      || ![getPrincipal,getPrincipalIdentity,getGeneration].every(reader => typeof reader === 'function')) return null;
    const original = originalSettlementRow(encoded);
    if (!original || key !== OUTBOX_PREFIX + original.id || JSON.stringify(row) !== encoded
      || storage.getItem(key) !== encoded) return null;
    const request = nativeNotificationReceiptRequest(original);
    if (!request) return null;
    const bound = {storage,key,encoded,row:original,request:JSON.stringify(request),
      expectedPrincipalIdentity,expectedGeneration,getPrincipal,getPrincipalIdentity,getGeneration,attempted:false};
    if (!settlementOriginCurrent(bound)) return null;
    const origin = Object.freeze({});
    settlementOrigins.set(origin, bound);
    return origin;
  } catch { return null; }
}

function originalAcknowledgementMatches(response, original) {
  const data = response?.data, b = original.receipt_binding;
  // Actual ack_native_device_notification returns its DB acknowledgement row,
  // not a provider accepted flag. Authenticated transport ownership remains
  // main's bridge responsibility; this module only matches the original tuple.
  return response?.ok === true && data && typeof data === 'object' && !Array.isArray(data)
    && uuid(data.id) && data.device_identifier === original.device_id
    && data.notification_key === original.notification_key && data.notification_type === original.notification_type
    && data.credential_id === b.credential_id && data.employee_id === b.employee_id
    && data.assignment_epoch === b.assignment_epoch && data.notification_job_id === b.job_id
    && typeof data[original.action + '_at'] === 'string' && data[original.action + '_at'].length > 0;
}

export async function settleNotificationOutboxRow({storage, mutate, key, encoded, row, origin,
  request, response, delivered, failure, now = () => new Date().toISOString()} = {}) {
  try {
    const bound = settlementOrigins.get(origin);
    if (!bound || bound.attempted || bound.storage !== storage || bound.key !== key || bound.encoded !== encoded
      || JSON.stringify(row) !== encoded || JSON.stringify(request) !== bound.request
      || typeof mutate !== 'function' || !settlementOriginCurrent(bound)) return false;
    // Generic catch/unknown response is NOT a known failure classification.
    if (delivered === true ? !originalAcknowledgementMatches(response, bound.row)
      : delivered !== false || failure !== 'NOT_DELIVERED' || response != null) return false;
    const check = context => {
      if (typeof context?.assertCurrent !== 'function') return false;
      context.assertCurrent();
      if (context.generation !== bound.expectedGeneration || context.deviceId !== bound.row.device_id
        || !settlementOriginCurrent(bound)) return false;
      context.assertCurrent();
      return true;
    };
    const settled = await mutate(context => {
      if (bound.attempted || !check(context)) return false;
      const current = storage.getItem(key);
      if (current === null || !check(context)) return false;
      if (delivered === true) {
        const saved = originalSettlementRow(current);
        // Keep the established competing-retry behavior, but only for this
        // exact original operation, key, recipient and authenticated ACK.
        if (!saved || stableReceiptOperation(saved) !== stableReceiptOperation(bound.row)) return false;
        if (!check(context)) return false;
        bound.attempted = true; // Unconfirmed effects cannot reuse this proof.
        storage.removeItem(key);
        if (!check(context)) return false;
        const removed = storage.getItem(key) === null;
        return check(context) && removed;
      }
      if (current !== encoded || bound.row.attempts >= Number.MAX_SAFE_INTEGER) return false;
      const lastAttempt = now();
      if (typeof lastAttempt !== 'string' || !lastAttempt) return false;
      const next = JSON.stringify({...bound.row, attempts:bound.row.attempts + 1,last_attempt_at:lastAttempt});
      if (!check(context)) return false;
      bound.attempted = true;
      storage.setItem(key, next);
      if (!check(context)) return false;
      const saved = storage.getItem(key) === next;
      return check(context) && saved;
    }, {requireEnrollment:true, expectedGeneration:bound.expectedGeneration});
    return settled === true && settlementOriginCurrent(bound);
  } catch { return false; } // Pending/denied is never original acceptance.
}
// The installed plugins expose arrival and action callbacks, not swipe dismissal.
// Keep historical dismissed rows readable; never manufacture that native event.
export const NATIVE_NOTIFICATION_LIFECYCLE = Object.freeze({
  produced_actions: Object.freeze(['received', 'displayed', 'opened', 'acknowledged']),
  swipe_dismissal: 'local_only',
});

const RECEIPT_TYPES = Object.freeze({
  employee_location_status: 'location_status',
  employee_lunch_coverage: 'lunch_coverage',
});
const RECEIPT_ACTIONS = new Set(['received', 'displayed', 'opened', 'dismissed', 'acknowledged']);
const PRODUCED_ACTIONS = new Set(NATIVE_NOTIFICATION_LIFECYCLE.produced_actions);

const text = value => String(value || '').trim();
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
function bindingFor(data,deviceId){
  const epoch=text(data?.receipt_assignment_epoch);
  if(!/^[1-9][0-9]*$/.test(epoch)||!Number.isSafeInteger(Number(epoch)))return null;
  const binding={job_id:data?.receipt_job_id,credential_id:data?.receipt_credential_id,
    assignment_epoch:Number(epoch),employee_id:data?.receipt_employee_id,device_id:text(data?.receipt_device_id)};
  return uuid(binding.job_id)&&uuid(binding.credential_id)&&uuid(binding.employee_id)&&binding.device_id===deviceId?binding:null;
}

export function createNativeNotificationReceipt({ data, action, deviceId, createdAt } = {}) {
  const kind = text(data?.kind);
  const notificationType = RECEIPT_TYPES[kind] || '';
  const notificationKey = text(data?.notification_key);
  const canonicalAction = text(action).toLowerCase();
  const canonicalDevice = text(deviceId).toUpperCase();
  const binding=bindingFor(data,canonicalDevice);
  if (!notificationType || !notificationKey || !PRODUCED_ACTIONS.has(canonicalAction) || !canonicalDevice || !binding) return null;
  const id = `${binding.job_id}:${binding.credential_id}:${binding.assignment_epoch}:${kind}:${canonicalAction}:${notificationKey}`;
  return {
    schema_version: NATIVE_NOTIFICATION_RECEIPT_SCHEMA,
    id,
    kind,
    notification_key: notificationKey,
    notification_type: notificationType,
    action: canonicalAction,
    device_id: canonicalDevice,
    receipt_binding:binding,
    created_at: text(createdAt) || new Date().toISOString(),
    attempts: 0,
  };
}

export function normalizeNativeNotificationReceipt(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.schema_version === NATIVE_NOTIFICATION_RECEIPT_SCHEMA) {
    const kind = text(row.kind);
    const action = text(row.action).toLowerCase();
    const notificationType = RECEIPT_TYPES[kind] || '';
    const b=row.receipt_binding;
    if (!notificationType || !RECEIPT_ACTIONS.has(action) || !text(row.notification_key) || !text(row.device_id)
      ||!b||!bindingFor({receipt_job_id:b.job_id,receipt_credential_id:b.credential_id,receipt_employee_id:b.employee_id,
        receipt_assignment_epoch:String(b.assignment_epoch),receipt_device_id:b.device_id},text(row.device_id).toUpperCase())) return null;
    return {
      ...row,
      kind,
      action,
      notification_type: notificationType,
      notification_key: text(row.notification_key),
      device_id: text(row.device_id).toUpperCase(),
    };
  }
  // Old outbox entries remain saved, but cannot be upgraded by attaching the
  // next occupant's credential. Unbound history is not native delivery proof.
  if (['native-notification-outbox.v1','native-notification-outbox.v2'].includes(row.schema_version)) {
    return {...row,legacy_unbound:true};
  }
  return null;
}

export function nativeNotificationReceiptRequest(row) {
  const receipt = normalizeNativeNotificationReceipt(row);
  if (!receipt || receipt.legacy_unbound) return null;
  return {
    path: '/messaging-api/device-notifications/ack',
    headers: { 'Idempotency-Key': receipt.id },
    body: {
      device_id: receipt.device_id,
      notification_key: receipt.notification_key,
      notification_type: receipt.notification_type,
      action: receipt.action,
      receipt_binding:receipt.receipt_binding,
      metadata: {
        source: `native_notification_${receipt.action}`,
        kind: receipt.kind,
      },
    },
  };
}

export function requiresBoundNotificationReceipt(data) {
  return Boolean(RECEIPT_TYPES[text(data?.kind)] || Object.keys(data || {}).some(key => key.startsWith('receipt_')));
}

export function receiptMatchesProtectedPrincipal(row, principal) {
  const binding = row?.receipt_binding;
  return Boolean(binding && principal && row.device_id === principal.device_id
    && binding.device_id === principal.device_id && binding.credential_id === principal.credential_id
    && binding.employee_id === principal.employee_id && binding.assignment_epoch === principal.assignment_epoch);
}

// Called only inside the bridge's protected-work capability. Recheck the
// protected native principal under its serialization lock, not an editable
// profile or the notification's claim about its recipient.
export async function persistBoundNativeNotificationReceipt({data, action, deviceId, getPrincipal, mutate, storage, prefix}) {
  const row = createNativeNotificationReceipt({data, action, deviceId});
  if (!row) return false;
  return mutate(() => {
    if (!receiptMatchesProtectedPrincipal(row, getPrincipal())) return false;
    const key = `${prefix}${row.id}`, previous = storage.getItem(key);
    if (previous !== null) {
      const saved = normalizeNativeNotificationReceipt(JSON.parse(previous));
      if (!saved || saved.id !== row.id || JSON.stringify(nativeNotificationReceiptRequest(saved)) !== JSON.stringify(nativeNotificationReceiptRequest(row))) {
        throw new Error('Conflicting protected notification receipt.');
      }
      return true; // Preserve the first observed timestamp and retry history.
    }
    const encoded = JSON.stringify(row);
    storage.setItem(key, encoded);
    if (storage.getItem(key) !== encoded) throw new Error('Protected notification receipt readback failed.');
    return true;
  });
}

// Persist arrival before presentation. If presentation fails, arrival remains
// durable; a display or acknowledgment is never manufactured to fill the gap.
export async function receiveNativeNotification({event,persist,dispatch,present,shouldPresent,flush}){
  const data=event?.notification?.data||{};
  const bound = requiresBoundNotificationReceipt(data);
  if (bound && await persist(data,'received') !== true) return false;
  dispatch(event);
  if (bound) void flush();
  if(typeof shouldPresent === 'function' ? shouldPresent() : shouldPresent){
    const presented = await present(event);
    if (presented !== false && bound && await persist(data,'displayed') === true) void flush();
  }
  return true;
}

export async function handleNativeNotificationAction({notification,actionId,persist,persistEventOpened,flush,navigate}) {
  // Both installed Android plugins emit 'tap' for open. Unknown/cancel/swipe
  // actions are not evidence of open, acknowledgment, or a durable dismissal.
  const action = actionId === 'tap' ? 'opened' : actionId === 'acknowledge' ? 'acknowledged' : '';
  if (!action) return false;
  const data = notification?.data || notification?.extra || {};
  if (requiresBoundNotificationReceipt(data)) {
    if (await persist(data, action) !== true) return false;
    void flush();
  } else if (action === 'opened') {
    if (data.kind === 'employee_event') { await persistEventOpened(data); void flush(); }
  } else return false;
  navigate(data);
  return true;
}
import {protectedPrincipal, principalIdentity} from './protected-principal.js';
