export const NATIVE_NOTIFICATION_RECEIPT_SCHEMA = 'native-notification-outbox.v3';
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
