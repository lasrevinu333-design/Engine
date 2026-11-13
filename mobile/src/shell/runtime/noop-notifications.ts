import type { NotificationSnapshot } from '../core/types';

export const noopNotifications = {
  async read(): Promise<NotificationSnapshot> {
    return { supported: false, permission: 'unavailable' };
  },
  async install(): Promise<void> {},
};
