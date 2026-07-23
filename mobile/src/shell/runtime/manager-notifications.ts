import {
  currentDeviceId,
  currentSession,
  installNotificationRouting,
  notificationPermission,
  refreshManagerSession,
} from '../../manager/notifications-client.js';
import { Capacitor } from '@capacitor/core';
import type { AuthSnapshot, NotificationSnapshot } from '../core/types';

function mapPermission(value: unknown): NotificationSnapshot['permission'] {
  if (value === 'granted' || value === 'denied' || value === 'prompt') return value;
  if (value === 'prompt-with-rationale') return 'prompt';
  return 'unavailable';
}

function validManagerSession(session: any): boolean {
  return Boolean(
    session?.token
    && session.role === 'ops_manager'
    && Date.parse(session.expires_at || '') > Date.now(),
  );
}

async function refreshManagerSessionWithTimeout(): Promise<any> {
  let timeout = 0;
  try {
    return await Promise.race([
      refreshManagerSession(),
      new Promise((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error('Manager authentication timed out.')),
          3_000,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function readManagerShellAuth(): Promise<AuthSnapshot> {
  let session = currentSession();
  if (!validManagerSession(session) || Date.parse(session.expires_at || '') <= Date.now() + 5_000) {
    try {
      session = (await refreshManagerSessionWithTimeout()).session;
    } catch {
      session = null;
    }
  }
  if (!validManagerSession(session)) {
    return { state: 'unknown', displayName: '', role: 'manager' };
  }
  return {
    state: 'authenticated',
    displayName: String(session.manager_display_name || ''),
    role: 'manager',
    deviceId: String(session.device_id || currentDeviceId()),
  };
}

export async function managerAuthHeaders(): Promise<Record<string, string>> {
  const auth = await readManagerShellAuth();
  const session = currentSession();
  if (auth.state !== 'authenticated' || !validManagerSession(session)) return {};
  return {
    Authorization: `Bearer ${session.token}`,
    ...(auth.deviceId ? { 'X-Device-Id': auth.deviceId } : {}),
  };
}

export const managerNotifications = {
  async read(): Promise<NotificationSnapshot> {
    if (Capacitor.isNativePlatform()) {
      const status = await notificationPermission();
      return {
        supported: status.supported,
        permission: mapPermission(status.receive),
      };
    }
    if (!('Notification' in window)) {
      return { supported: false, permission: 'unavailable' };
    }
    return {
      supported: true,
      permission: Notification.permission as NotificationSnapshot['permission'],
    };
  },
  async install(): Promise<void> {
    if (Capacitor.isNativePlatform()) await installNotificationRouting();
  },
};
