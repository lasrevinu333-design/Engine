import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const edition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase();
const platform = String(process.argv[2] || '').toLowerCase();
const apiBase = String(process.env.MZ_API_BASE || 'https://memphis-zoo-mcp.onrender.com').replace(/\/+$/, '');
if (edition !== 'manager') {
  console.log('Firebase Messaging is intentionally omitted from the Viewer edition.');
  process.exit(0);
}

function decode(raw, base64) {
  if (raw) return raw;
  if (!base64) return '';
  return Buffer.from(base64, 'base64').toString('utf8');
}
async function remoteConfig(targetPlatform) {
  const response = await fetch(`${apiBase}/manager-notifications-api/client-config/${encodeURIComponent(targetPlatform)}`, {
    headers: { Accept: targetPlatform === 'android' ? 'application/json' : 'application/x-plist' },
  });
  const content = await response.text();
  if (!response.ok) {
    let error = content;
    try { error = JSON.parse(content)?.error || content; } catch {}
    throw new Error(`Firebase ${targetPlatform} client configuration download failed: ${error || `HTTP ${response.status}`}`);
  }
  return content;
}
async function resolveContent(targetPlatform) {
  const local = targetPlatform === 'android'
    ? decode(process.env.GOOGLE_SERVICES_JSON, process.env.GOOGLE_SERVICES_JSON_B64)
    : decode(process.env.GOOGLE_SERVICE_INFO_PLIST, process.env.GOOGLE_SERVICE_INFO_PLIST_B64);
  return local.trim() ? local : remoteConfig(targetPlatform);
}
async function write(path, content) {
  if (!content.trim()) throw new Error(`Missing Firebase configuration for ${platform}.`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  console.log(`Wrote ${path}`);
}

if (platform === 'android') {
  const content = await resolveContent('android');
  const parsed = JSON.parse(content);
  const packages = (parsed.client || []).map((client) => client?.client_info?.android_client_info?.package_name).filter(Boolean);
  if (!packages.includes('org.memphiszoo.ops')) throw new Error('google-services.json does not contain org.memphiszoo.ops.');
  await write(join(mobileRoot, 'android/app/google-services.json'), content);
} else if (platform === 'ios') {
  const content = await resolveContent('ios');
  if (!/<plist[\s>]/.test(content) || !/<key>GOOGLE_APP_ID<\/key>/.test(content) || !/<key>BUNDLE_ID<\/key>/.test(content) || !/<string>org\.memphiszoo\.ops<\/string>/.test(content)) {
    throw new Error('Invalid GoogleService-Info.plist for org.memphiszoo.ops.');
  }
  await write(join(mobileRoot, 'ios/App/App/GoogleService-Info.plist'), content);
  const appDelegatePath = join(mobileRoot, 'ios/App/App/AppDelegate.swift');
  let appDelegate = await readFile(appDelegatePath, 'utf8');
  if (!appDelegate.includes('capacitorDidRegisterForRemoteNotifications')) {
    const methods = `
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }
`;
    const closing = appDelegate.lastIndexOf('}');
    if (closing < 0) throw new Error('AppDelegate.swift does not have a closing brace.');
    appDelegate = `${appDelegate.slice(0, closing)}${methods}${appDelegate.slice(closing)}`;
    await writeFile(appDelegatePath, appDelegate);
  }
} else {
  throw new Error('Usage: node scripts/configure-firebase.mjs <ios|android>');
}
