import type { CapacitorConfig } from '@capacitor/cli';

const edition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase();
const viewer = edition === 'viewer';
const custodial = edition === 'custodial';
const shellProof = /^(1|true|yes)$/i.test(String(process.env.MZ_SHELL_START || ''));
const appId = viewer ? 'org.memphiszoo.viewer' : custodial ? 'org.memphiszoo.custodial' : 'org.memphiszoo.ops';
const appName = viewer ? 'Memphis Zoo Viewer' : custodial ? 'Memphis Zoo Custodial' : 'Memphis Zoo Ops';
const managerPlugins = ['@aparajita/capacitor-secure-storage', '@capacitor-firebase/messaging', '@capacitor/app', '@capacitor/network', '@capacitor/status-bar'];
const custodialPlugins = ['@aparajita/capacitor-secure-storage', '@capacitor/app', '@capacitor/network', '@capacitor/status-bar'];
const viewerPlugins = ['@capacitor/app', '@capacitor/network', '@capacitor/status-bar'];

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'mobile-dist',
  backgroundColor: custodial ? '#04181e' : '#0b1320',
  loggingBehavior: 'production',
  includePlugins: viewer ? viewerPlugins : custodial ? custodialPlugins : managerPlugins,
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor',
    ...(shellProof ? { appStartPath: '/app-shell.html' } : {}),
  },
  android: { backgroundColor: custodial ? '#04181e' : '#0b1320', zoomEnabled: true },
  ios: { backgroundColor: custodial ? '#04181e' : '#0b1320', zoomEnabled: true, contentInset: 'never' },
  experimental: viewer || custodial ? undefined : { ios: { spm: { packageOptions: { '@capacitor-firebase/messaging': { symlink: true } } } } },
  plugins: {
    StatusBar: { style: 'DARK', backgroundColor: custodial ? '#04181e' : '#0b1320', overlaysWebView: false },
    SystemBars: { insetsHandling: 'css', style: 'DARK', hidden: false, animation: 'NONE' },
    ...(viewer || custodial ? {} : { FirebaseMessaging: { presentationOptions: ['alert', 'badge', 'sound'] } }),
  },
};
export default config;
