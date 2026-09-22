export const NATIVE_NOTIFICATION_RECEIPT_SCHEMA = 'native-notification-outbox.v2';

const RECEIPT_TYPES = Object.freeze({
  employee_location_status: 'location_status',
  employee_lunch_coverage: 'lunch_coverage',
});
const RECEIPT_ACTIONS = new Set(['displayed', 'opened']);

const text = value => String(value || '').trim();

export function createNativeNotificationReceipt({ data, action, deviceId, createdAt } = {}) {
  const kind = text(data?.kind);
  const notificationType = RECEIPT_TYPES[kind] || '';
  const notificationKey = text(data?.notification_key);
  const canonicalAction = text(action).toLowerCase();
  const canonicalDevice = text(deviceId).toUpperCase();
  if (!notificationType || !notificationKey || !RECEIPT_ACTIONS.has(canonicalAction) || !canonicalDevice) return null;
  const id = `${kind}:${canonicalAction}:${notificationKey}`;
  return {
    schema_version: NATIVE_NOTIFICATION_RECEIPT_SCHEMA,
    id,
    kind,
    notification_key: notificationKey,
    notification_type: notificationType,
    action: canonicalAction,
    device_id: canonicalDevice,
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
    if (!notificationType || !RECEIPT_ACTIONS.has(action) || !text(row.notification_key) || !text(row.device_id)) return null;
    return {
      ...row,
      kind,
      action,
      notification_type: notificationType,
      notification_key: text(row.notification_key),
      device_id: text(row.device_id).toUpperCase(),
    };
  }
  // Preserve already-saved location-status opens from the v1 outbox.
  if (row.schema_version === 'native-notification-outbox.v1' && row.kind === 'employee_location_status') {
    return createNativeNotificationReceipt({
      data: { kind: row.kind, notification_key: row.notification_key },
      action: 'opened',
      deviceId: row.device_id,
      createdAt: row.created_at,
    });
  }
  return null;
}

export function nativeNotificationReceiptRequest(row) {
  const receipt = normalizeNativeNotificationReceipt(row);
  if (!receipt) return null;
  return {
    path: '/messaging-api/device-notifications/ack',
    headers: { 'Idempotency-Key': receipt.id },
    body: {
      device_id: receipt.device_id,
      notification_key: receipt.notification_key,
      notification_type: receipt.notification_type,
      action: receipt.action,
      metadata: {
        source: receipt.action === 'displayed' ? 'native_notification_received' : 'native_notification_action',
        kind: receipt.kind,
      },
    },
  };
}
