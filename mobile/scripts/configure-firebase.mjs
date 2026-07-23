import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = resolve(mobileRoot, '..');
const edition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase();
const platform = String(process.argv[2] || '').toLowerCase();
const apiBase = String(process.env.MZ_API_BASE || 'https://memphis-zoo-mcp.onrender.com').replace(/\/+$/, '');
if (edition !== 'manager') {
  console.log(`Firebase Messaging is intentionally omitted from the ${edition} edition.`);
  process.exit(0);
}

function environmentConfig(targetPlatform) {
  const raw = targetPlatform === 'android'
    ? process.env.GOOGLE_SERVICES_JSON
    : process.env.GOOGLE_SERVICE_INFO_PLIST;
  const base64 = targetPlatform === 'android'
    ? process.env.GOOGLE_SERVICES_JSON_B64
    : process.env.GOOGLE_SERVICE_INFO_PLIST_B64;
  if (String(raw || '').trim()) return { bytes: Buffer.from(raw, 'utf8'), source: 'environment-raw' };
  if (String(base64 || '').trim()) return { bytes: Buffer.from(base64, 'base64'), source: 'environment-base64' };
  return null;
}
async function remoteConfig(targetPlatform) {
  const response = await fetch(`${apiBase}/manager-notifications-api/client-config/${encodeURIComponent(targetPlatform)}`, {
    headers: { Accept: targetPlatform === 'android' ? 'application/json' : 'application/x-plist' },
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    const content = bytes.toString('utf8');
    let error = content;
    try { error = JSON.parse(content)?.error || content; } catch {}
    throw new Error(`Firebase ${targetPlatform} client configuration download failed: ${error || `HTTP ${response.status}`}`);
  }
  return { bytes, source: 'client-config-endpoint' };
}
async function resolveContent(targetPlatform) {
  const local = environmentConfig(targetPlatform);
  if (local) return local;
  if (/^(1|true|yes)$/i.test(String(process.env.MZ_REQUIRE_PINNED_FIREBASE_CONFIG || ''))) {
    throw new Error(`Release builds require an environment-supplied Firebase ${targetPlatform} client configuration.`);
  }
  return remoteConfig(targetPlatform);
}
async function expectedDigest(targetPlatform) {
  const lockPath = join(mobileRoot, 'native-locks', 'firebase', `manager-${targetPlatform}.sha256`);
  const value = (await readFile(lockPath, 'utf8')).trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`Invalid Firebase configuration digest lock: ${lockPath}`);
  return value;
}
async function write(path, bytes, source) {
  if (!bytes.length) throw new Error(`Missing Firebase configuration for ${platform}.`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const expected = await expectedDigest(platform);
  if (digest !== expected) {
    throw new Error(`Firebase ${platform} client configuration digest mismatch: expected ${expected}, received ${digest}.`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  const provenanceDirectory = join(repositoryRoot, 'build', 'provenance');
  await mkdir(provenanceDirectory, { recursive: true });
  await writeFile(
    join(provenanceDirectory, `manager-firebase-${platform}.json`),
    `${JSON.stringify({
      schema_version: 1,
      edition,
      platform,
      app_identifier: 'org.memphiszoo.ops',
      sha256: digest,
      bytes: bytes.length,
      source,
    }, null, 2)}\n`,
  );
  console.log(`Verified and wrote Firebase ${platform} client configuration (${digest}).`);
}

if (platform === 'android') {
  const { bytes, source } = await resolveContent('android');
  const content = bytes.toString('utf8');
  const parsed = JSON.parse(content);
  const packages = (parsed.client || []).map((client) => client?.client_info?.android_client_info?.package_name).filter(Boolean);
  if (!packages.includes('org.memphiszoo.ops')) throw new Error('google-services.json does not contain org.memphiszoo.ops.');
  await write(join(mobileRoot, 'android/app/google-services.json'), bytes, source);
} else if (platform === 'ios') {
  const { bytes, source } = await resolveContent('ios');
  const content = bytes.toString('utf8');
  if (!/<plist[\s>]/.test(content) || !/<key>GOOGLE_APP_ID<\/key>/.test(content) || !/<key>BUNDLE_ID<\/key>/.test(content) || !/<string>org\.memphiszoo\.ops<\/string>/.test(content)) {
    throw new Error('Invalid GoogleService-Info.plist for org.memphiszoo.ops.');
  }
  await write(join(mobileRoot, 'ios/App/App/GoogleService-Info.plist'), bytes, source);
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
