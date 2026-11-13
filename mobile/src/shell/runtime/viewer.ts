import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import type { RuntimePorts } from '../core/types';
import { createBrowserRuntimePorts } from './browser';

export function createViewerRuntimePorts(): RuntimePorts {
  const anonymous = () => ({
    state: 'anonymous' as const,
    displayName: '',
    role: 'viewer',
  });
  const browser = createBrowserRuntimePorts(anonymous);
  if (!Capacitor.isNativePlatform()) return browser;

  return {
    ...browser,
    platform: 'capacitor',
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
      async handleRootBack() {
        await App.minimizeApp().catch(() => {});
      },
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
  };
}
