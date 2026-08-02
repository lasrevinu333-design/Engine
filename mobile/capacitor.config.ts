import type { CapacitorConfig } from '@capacitor/cli';

const edition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase();
const viewer = edition === 'viewer';
const custodial = edition === 'custodial';
const shellProof = /^(1|true|yes)$/i.test(String(process.env.MZ_SHELL_START || ''));
const appId = viewer ? 'org.memphiszoo.viewer' : custodial ? 'org.memphiszoo.custodial' : 'org.memphiszoo.ops';
const appName = viewer ? 'Memphis Zoo Viewer' : custodial ? 'Memphis Zoo Custodial' : 'Memphis Zoo Ops';
const managerPlugins = ['@aparajita/capacitor-secure-storage', '@capacitor-firebase/messaging', '@capacitor/app', '@capacitor/network', '@capacitor/status-bar'];
const custodialPlugins = ['@memphis-zoo/custodial-native-vault', '@capacitor-firebase/messaging', '@capacitor/app', '@capacitor/barcode-scanner', '@capacitor/local-notifications', '@capacitor/network', '@capacitor/status-bar'];
const viewerPlugins = ['@capacitor/app', '@capacitor/network', '@capacitor/status-bar'];

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'mobile-dist',
  backgroundColor: custodial ? '#04181e' : '#0b1320',
  // Capacitor's "production" setting means log in every build. Native bridge
  // responses can contain SecureStorage values and push tokens, so release
  // binaries must only enable bridge logging when they are debug builds.
  loggingBehavior: 'debug',
  includePlugins: viewer ? viewerPlugins : custodial ? custodialPlugins : managerPlugins,
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    ...(custodial
      ? { cleartext: false, appStartPath: '/app-shell.html' }
      : { iosScheme: 'capacitor', ...(shellProof ? { appStartPath: '/app-shell.html' } : {}) }),
  },
  android: {
    backgroundColor: custodial ? '#04181e' : '#0b1320',
    zoomEnabled: true,
    ...(custodial ? { allowMixedContent: false } : {}),
    webContentsDebuggingEnabled: false,
  },
  ...(custodial ? {} : {
    ios: { backgroundColor: '#0b1320', zoomEnabled: true, contentInset: 'never' },
  }),
  ...(viewer || custodial ? {} : {
    experimental: { ios: { spm: { packageOptions: { '@capacitor-firebase/messaging': { symlink: true } } } } },
  }),
  plugins: {
    StatusBar: { style: 'DARK', backgroundColor: custodial ? '#04181e' : '#0b1320', overlaysWebView: false },
    SystemBars: { insetsHandling: 'css', style: 'DARK', hidden: false, animation: 'NONE' },
    ...(viewer ? {} : { FirebaseMessaging: { presentationOptions: ['alert', 'badge', 'sound'] } }),
  },
};
export default config;
