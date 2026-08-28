import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import type {
  AuthSnapshot,
  NotificationSnapshot,
  RuntimePorts,
} from '../core/types';
import { createBrowserRuntimePorts } from './browser';

export function createCapacitorRuntimePorts(
  readAuth: () => Promise<AuthSnapshot> | AuthSnapshot,
  readAuthHeaders: () => Promise<Record<string, string>>,
  notifications: {
    read(): Promise<NotificationSnapshot>;
    install(): Promise<void>;
  },
): RuntimePorts {
  if (!Capacitor.isNativePlatform()) {
    const browser = createBrowserRuntimePorts(readAuth, readAuthHeaders, notifications.read);
    return { ...browser, notifications };
  }

  return {
    platform: 'capacitor',
    auth: { read: readAuth, headers: readAuthHeaders },
    deepLinks: {
      async getLaunchUrl() {
        const launch = await App.getLaunchUrl().catch(() => null);
        return launch?.url || null;
      },
      async addUrlListener(listener) {
        return App.addListener('appUrlOpen', ({ url }) => listener(url));
      },
      async addBackListener(listener) {
        return App.addListener('backButton', listener);
      },
      async handleRootBack(edition) {
        if (edition !== 'custodial') await App.minimizeApp().catch(() => {});
      },
    },
    nfcTransitions: {
      async report() {},
    },
    network: {
      async getStatus() {
        const status = await Network.getStatus();
        return { connected: status.connected, connectionType: status.connectionType };
      },
      async addListener(listener) {
        return Network.addListener('networkStatusChange', (status) => {
          listener({ connected: status.connected, connectionType: status.connectionType });
        });
      },
    },
    notifications,
  };
}
