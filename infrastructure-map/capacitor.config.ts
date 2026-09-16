import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.memphiszoo.infrastructure',
  appName: 'Memphis Zoo Infrastructure',
  webDir: 'dist',
  backgroundColor: '#F4F7F9',
  loggingBehavior: 'debug',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor'
  },
  android: {
    backgroundColor: '#F4F7F9',
    zoomEnabled: true,
    allowMixedContent: false,
    useLegacyBridge: false,
    webContentsDebuggingEnabled: false
  },
  ios: {
    backgroundColor: '#F4F7F9',
    zoomEnabled: true,
    contentInset: 'never'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F4F7F9',
      overlaysWebView: false
    }
  }
};

export default config;
