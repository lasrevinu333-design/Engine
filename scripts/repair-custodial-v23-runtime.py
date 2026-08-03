from pathlib import Path
import subprocess


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


bridge_path = Path('mobile/src/custodial/bridge.js')
bridge = bridge_path.read_text()
bridge = replace_once(
    bridge,
    "import { StatusBar } from '@capacitor/status-bar';\n",
    "import { StatusBar } from '@capacitor/status-bar';\nimport { createEmployeeNotificationCoordinator } from './notification-coordinator.js';\n",
    'notification coordinator import',
)

old_channel = '''  function notificationChannel(data = {}) {
    if (data.kind === 'employee_event') return 'employee-events';
    if (data.kind === 'employee_message') return 'employee-messages';
    if (data.kind === 'employee_location_status' && data.status_code === 'overdue') return 'employee-overdue';
    if (data.kind === 'employee_location_status') return 'employee-due-soon';
    return 'employee-messages';
  }
'''
new_channel = '''  function notificationChannel(data = {}) {
    if (data.kind === 'employee_event') return 'employee-events-v23';
    if (data.kind === 'employee_message') return 'employee-messages-v23';
    if (data.kind === 'employee_location_status' && data.status_code === 'overdue') return 'employee-overdue-v23';
    if (data.kind === 'employee_location_status') return 'employee-due-soon-v23';
    return 'employee-messages-v23';
  }
'''
bridge = replace_once(bridge, old_channel, new_channel, 'silent v23 notification channels')

old_present = '''  async function presentForegroundNotification(event) {
    const notification = event?.notification || {};
    const data = notification.data && typeof notification.data === 'object' ? notification.data : {};
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(data),
        title: String(notification.title || 'Memphis Zoo'),
        body: String(notification.body || 'You have a new notification.'),
        channelId: notificationChannel(data),
        extra: data,
        autoCancel: true,
      }],
    });
  }
'''
new_present = '''  async function presentSystemNotification(notification = {}, alert = {}) {
    const data = notification.data && typeof notification.data === 'object' ? notification.data : {};
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId({ ...data, notification_key: alert.id || data.notification_key }),
        title: String(alert.title || notification.title || 'Memphis Zoo'),
        body: String(alert.body || notification.body || 'You have a new notification.'),
        channelId: notificationChannel(data),
        extra: { ...data, route: alert.route || data.route, notification_key: alert.id || data.notification_key },
        autoCancel: true,
      }],
    });
  }
'''
bridge = replace_once(bridge, old_present, new_present, 'system notification fallback')

bridge = replace_once(
    bridge,
    "        ['employee-events', 'Assigned events', 'Event reminders for assigned custodial work'],\n        ['employee-messages', 'Messages', 'New Memphis and team messages'],\n        ['employee-due-soon', 'Due soon', 'Assigned locations approaching their cleaning window'],\n        ['employee-overdue', 'Overdue', 'Assigned locations that need attention now'],",
    "        ['employee-events-v23', 'Assigned events', 'Silent event notices; the app performs the approved alert sequence'],\n        ['employee-messages-v23', 'Messages', 'Silent message notices; the app performs the approved alert sequence'],\n        ['employee-due-soon-v23', 'Due soon', 'Silent due-soon notices; the app performs the approved alert sequence'],\n        ['employee-overdue-v23', 'Overdue', 'Silent overdue notices; the app performs the approved alert sequence'],",
    'v23 channel definitions',
)
bridge = replace_once(
    bridge,
    "await FirebaseMessaging.createChannel({ id, name, description, importance: 5, visibility: 1, vibration: true, sound: 'default' });",
    "await FirebaseMessaging.createChannel({ id, name, description, importance: 5, visibility: 1, vibration: true });",
    'remove extra Android channel sound',
)

install_start = bridge.index('  async function installNotificationRouting() {')
install_end = bridge.index('\n\n  window.fetch = bridgeFetch;', install_start)
new_install = '''  let notificationCoordinator = null;
  let employeeNamePromise = null;

  async function resolveNotificationEmployeeName() {
    if (employeeNamePromise) return employeeNamePromise;
    employeeNamePromise = requestEnvelope(`/messaging-api/me/by-device?device_id=${encodeURIComponent(deviceId())}`)
      .then((payload) => String(payload?.data?.display_name || 'Employee').trim() || 'Employee')
      .catch(() => 'Employee');
    return employeeNamePromise;
  }

  async function acknowledgeEmployeeAlert(alert, action) {
    await requestEnvelope('/messaging-api/device-notifications/ack', {
      method: 'POST',
      body: {
        device_id: deviceId(),
        notification_key: alert.id,
        notification_type: alert.notificationType || alert.kind || 'employee_notification',
        action,
        message_id: alert.messageId || null,
        metadata: {
          source: 'custodial_native_alert_coordinator',
          route: alert.route || null,
          kind: alert.kind || null,
        },
      },
    });
    if (action === 'opened' && alert.kind === 'employee_event') {
      await requestEnvelope('/employee-notifications-api/opened', {
        method: 'POST',
        body: { notification_key: alert.id },
      }).catch(() => null);
    }
  }

  async function installNotificationRouting() {
    notificationCoordinator = createEmployeeNotificationCoordinator({
      resolveEmployeeName: resolveNotificationEmployeeName,
      routeResolver: safeNativeRoute,
      acknowledge: acknowledgeEmployeeAlert,
      presentSystemNotification,
    });
    notificationCoordinator.start();

    const handleAction = async (notification) => {
      await notificationCoordinator.receive({ notification }, { allowSystemNotification: false });
      await notificationCoordinator.process();
    };
    try {
      await FirebaseMessaging.addListener('tokenReceived', (event) => { void registerPushToken(event.token).catch(() => {}); });
      await FirebaseMessaging.addListener('notificationReceived', (event) => {
        window.dispatchEvent(new CustomEvent('memphis:native-notification-received', { detail: event || {} }));
        void notificationCoordinator.receive(event).catch(() => {});
      });
      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        void handleAction(event?.notification || {}).catch(() => {});
      });
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        void handleAction(event?.notification || {}).catch(() => {});
      });
    } catch {}
  }
'''
bridge = bridge[:install_start] + new_install + bridge[install_end:]
bridge = replace_once(
    bridge,
    "    ensurePushRegistration,\n    securityStatus: security.getStatus,",
    "    ensurePushRegistration,\n    enqueueEmployeeNotification: (notification) => notificationCoordinator\n      ? notificationCoordinator.receive({ notification }, { allowSystemNotification: false })\n      : Promise.resolve(false),\n    employeeNotificationState: () => ({\n      active: notificationCoordinator?.getActive?.() || null,\n      queue: notificationCoordinator?.getQueue?.() || [],\n    }),\n    securityStatus: security.getStatus,",
    'notification coordinator bridge API',
)
bridge_path.write_text(bridge)

subprocess.run(['node', 'scripts/custodial-native-notification-coordinator-tests.mjs'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)
Path(__file__).unlink()

print('Installed the authoritative Custodial v23 notification coordinator.')
