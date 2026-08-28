import type {
  AuthSnapshot,
  NotificationSnapshot,
  RemovableListener,
  RuntimePorts,
} from '../core/types';

const removable = (remove: () => void): RemovableListener => ({ remove });

export function createBrowserRuntimePorts(
  readAuth: () => Promise<AuthSnapshot> | AuthSnapshot,
  readAuthHeaders: () => Promise<Record<string, string>> = async () => ({}),
  readNotifications: () => Promise<NotificationSnapshot> = async () => ({
    supported: 'Notification' in window,
    permission: 'Notification' in window
      ? (Notification.permission as NotificationSnapshot['permission'])
      : 'unavailable',
  }),
): RuntimePorts {
  return {
    platform: 'browser',
    auth: { read: readAuth, headers: readAuthHeaders },
    deepLinks: {
      async getLaunchUrl() {
        return null;
      },
      async addUrlListener() {
        return removable(() => {});
      },
      async addBackListener() {
        return removable(() => {});
      },
      async handleRootBack() {
        if (window.history.length > 1) window.history.back();
      },
    },
    nfcTransitions: {
      async report() {},
    },
    network: {
      async getStatus() {
        return { connected: navigator.onLine, connectionType: navigator.onLine ? 'unknown' : 'none' };
      },
      async addListener(listener) {
        const online = () => listener({ connected: true, connectionType: 'unknown' });
        const offline = () => listener({ connected: false, connectionType: 'none' });
        window.addEventListener('online', online);
        window.addEventListener('offline', offline);
        return removable(() => {
          window.removeEventListener('online', online);
          window.removeEventListener('offline', offline);
        });
      },
    },
    notifications: {
      read: readNotifications,
      async install() {},
    },
  };
}
