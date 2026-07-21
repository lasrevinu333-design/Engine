import type { CapacitorConfig } from '@capacitor/cli';

const viewer = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase() === 'viewer';
const managerPlugins = [
  '@aparajita/capacitor-secure-storage',
  '@capacitor-firebase/messaging',
  '@capacitor/app',
  '@capacitor/network',
  '@capacitor/status-bar',
];
const viewerPlugins = ['@capacitor/network', '@capacitor/status-bar'];

const config: CapacitorConfig = {
  appId: viewer ? 'org.memphiszoo.viewer' : 'org.memphiszoo.ops',
  appName: viewer ? 'Memphis Zoo Viewer' : 'Memphis Zoo Ops',
  webDir: 'mobile-dist',
  backgroundColor: '#0b1320',
  loggingBehavior: 'production',
  includePlugins: viewer ? viewerPlugins : managerPlugins,
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  android: {
    backgroundColor: '#0b1320',
    zoomEnabled: false,
  },
  ios: {
    backgroundColor: '#0b1320',
    zoomEnabled: false,
    contentInset: 'never',
  },
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b1320',
      overlaysWebView: false,
    },
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;
