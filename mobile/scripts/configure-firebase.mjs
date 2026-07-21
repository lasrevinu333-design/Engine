import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const edition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase();
const platform = String(process.argv[2] || '').toLowerCase();
if (edition !== 'manager') {
  console.log('Firebase Messaging is intentionally omitted from the Viewer edition.');
  process.exit(0);
}

function decode(raw, base64) {
  if (raw) return raw;
  if (!base64) return '';
  return Buffer.from(base64, 'base64').toString('utf8');
}
async function write(path, content) {
  if (!content.trim()) throw new Error(`Missing Firebase configuration for ${platform}.`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  console.log(`Wrote ${path}`);
}

if (platform === 'android') {
  const content = decode(process.env.GOOGLE_SERVICES_JSON, process.env.GOOGLE_SERVICES_JSON_B64);
  JSON.parse(content);
  await write(join(mobileRoot, 'android/app/google-services.json'), content);
} else if (platform === 'ios') {
  const content = decode(process.env.GOOGLE_SERVICE_INFO_PLIST, process.env.GOOGLE_SERVICE_INFO_PLIST_B64);
  if (!/<plist[\s>]/.test(content) || !/<key>GOOGLE_APP_ID<\/key>/.test(content) || !/<key>BUNDLE_ID<\/key>/.test(content)) throw new Error('Invalid GoogleService-Info.plist content.');
  await write(join(mobileRoot, 'ios/App/App/GoogleService-Info.plist'), content);
  const appDelegatePath = join(mobileRoot, 'ios/App/App/AppDelegate.swift');
  let appDelegate = await readFile(appDelegatePath, 'utf8');
  if (!appDelegate.includes('capacitorDidRegisterForRemoteNotifications')) {
    const methods = `\n    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)\n    }\n\n    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)\n    }\n\n    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {\n        NotificationCenter.default.post(name: Notification.Name(\"didReceiveRemoteNotification\"), object: completionHandler, userInfo: userInfo)\n    }\n`;
    const closing = appDelegate.lastIndexOf('}');
    if (closing < 0) throw new Error('AppDelegate.swift does not have a closing brace.');
    appDelegate = `${appDelegate.slice(0, closing)}${methods}${appDelegate.slice(closing)}`;
    await writeFile(appDelegatePath, appDelegate);
  }
} else {
  throw new Error('Usage: node scripts/configure-firebase.mjs <ios|android>');
}
