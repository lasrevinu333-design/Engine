import type { CapacitorConfig } from '@capacitor/cli';

const viewer = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase() === 'viewer';

const config: CapacitorConfig = {
  appId: viewer ? 'org.memphiszoo.viewer' : 'org.memphiszoo.ops',
  appName: viewer ? 'Memphis Zoo Viewer' : 'Memphis Zoo Ops',
  webDir: 'mobile-dist',
  backgroundColor: '#0b1320',
  loggingBehavior: 'production',
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
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b1320',
      overlaysWebView: false,
    },
  },
};

export default config;
