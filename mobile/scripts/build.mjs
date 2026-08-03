import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { build as esbuildBuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import {
  discoverRuntimeFiles,
  resolveAppEdition,
  resolveBuildIdentity,
  verifyFrontendReleaseManifest,
  writeRuntimeAssetManifest,
} from '../../scripts/refresh-frontend-release-manifest.mjs';
import { custodialNativeVaultSourceDigest } from './custodial-native-vault-source.mjs';
import { managerNativeVaultSourceDigest } from './manager-native-vault-source.mjs';
import { canonicalManagerPlayIntegrityProjectNumber } from './configure-android-backup.mjs';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const repoRoot = resolve(mobileRoot, '..');
async function buildJavascript(options) {
  return esbuildBuild({
    ...options,
    absWorkingDir: mobileRoot,
  });
}
const edition = resolveAppEdition(process.env.MZ_APP_EDITION);
const proofDist = `build/batch-0b-shell-browser/${edition}`;
const configuredDist = process.env.MZ_MOBILE_DIST?.replaceAll('\\', '/');
const browserTestFlag = process.env.MZ_CUSTODIAL_BROWSER_TEST;
if (browserTestFlag !== undefined && browserTestFlag !== '1') {
  throw new Error('MZ_CUSTODIAL_BROWSER_TEST, when set, must be exactly 1');
}
const custodialBrowserTestBuild = browserTestFlag === '1';
const admissionDistPattern = /^build\/custodial-codemagic-admission\/\.pending-[a-f0-9]{24}-[A-Za-z0-9]{6}\/mobile-dist$/;

async function assertPrivateAdmissionDist(relativePath) {
  const admissionParent = resolve(repoRoot, 'build', 'custodial-codemagic-admission');
  const pendingDirectory = dirname(resolve(repoRoot, relativePath));
  if (dirname(pendingDirectory) !== admissionParent) {
    throw new Error('Custodial admission runtime must be a direct pending admission child');
  }
  for (const [path, label] of [
    [admissionParent, 'admission parent'],
    [pendingDirectory, 'pending admission directory'],
  ]) {
    let stat;
    try {
      stat = await lstat(path);
    } catch {
      throw new Error(`Custodial ${label} must already exist as a real directory`);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(path) !== path) {
      throw new Error(`Custodial ${label} must be a real non-symlink directory`);
    }
    if ((stat.mode & 0o077) !== 0) {
      throw new Error(`Custodial ${label} must be private to its owner`);
    }
  }
  try {
    const outputStat = await lstat(resolve(repoRoot, relativePath));
    if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) {
      throw new Error('Custodial admission runtime output must be absent or a real directory');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

let dist;
if (!configuredDist) {
  if (custodialBrowserTestBuild) {
    throw new Error('MZ_CUSTODIAL_BROWSER_TEST=1 requires the edition browser-fixture output path');
  }
  dist = join(mobileRoot, 'mobile-dist');
} else if (configuredDist === proofDist) {
  if (!custodialBrowserTestBuild) {
    throw new Error('The edition browser-fixture output path requires MZ_CUSTODIAL_BROWSER_TEST=1');
  }
  dist = resolve(repoRoot, configuredDist);
} else if (admissionDistPattern.test(configuredDist)) {
  if (edition !== 'custodial' || custodialBrowserTestBuild) {
    throw new Error('The private Codemagic admission runtime is allowed only for a non-test Custodial build');
  }
  await assertPrivateAdmissionDist(configuredDist);
  dist = resolve(repoRoot, configuredDist);
} else {
  throw new Error(`MZ_MOBILE_DIST may only target ${proofDist} or a private Custodial Codemagic admission runtime`);
}
const source = join(mobileRoot, 'src', edition);
const sourceBuildIdentity = resolveBuildIdentity({ rootDirectory: repoRoot, edition });
const managerPlayIntegrityProjectNumber = edition === 'manager'
  && String(process.env.MZ_MANAGER_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER || '').trim()
  ? canonicalManagerPlayIntegrityProjectNumber(
    process.env.MZ_MANAGER_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER,
  )
  : null;
const buildIdentity = {
  ...sourceBuildIdentity,
  custodial_native_vault_source_sha256: edition === 'custodial'
    ? custodialNativeVaultSourceDigest(join(mobileRoot, 'plugins', 'custodial-native-vault'))
    : null,
  manager_native_vault_source_sha256: edition === 'manager'
    ? managerNativeVaultSourceDigest(join(mobileRoot, 'plugins', 'manager-native-vault'))
    : null,
  manager_native_auth_contract: edition === 'manager' ? 'manager-device-auth.v2' : null,
  manager_play_integrity_cloud_project_number: edition === 'manager'
    ? managerPlayIntegrityProjectNumber
    : null,
  manager_play_integrity_configuration_embedded: edition === 'manager'
    ? managerPlayIntegrityProjectNumber !== null
    : null,
};
const nativeBuildNumber = (() => {
  const raw = process.env.PROJECT_BUILD_NUMBER || process.env.BUILD_NUMBER || process.env.MZ_BUILD_NUMBER || '';
  const value = String(raw).trim();
  if (!value) return null;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2_100_000_000) {
    throw new Error('Native build number must be a positive safe integer no greater than 2100000000');
  }
  return value;
})();
const rootPackage = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
const custodialCompatibilityFiles = new Set([
  'Background1_optimized.webp',
  'Event_Icon_Pink_ui.webp',
  'Event_Icon_ui.webp',
  'Header_ui.webp',
  'Zoo_Logo_ui.webp',
  'chatscope-messenger.css',
  'chatscope-messenger.js',
  'chatscope-mobile-overrides.css',
  'dashboard-bg_optimized.webp',
  'dashboard_tiger_icon.svg',
  'employee-hub.html',
  'employee-schedule.html',
  'events.html',
  'manager-ux.css',
  'memphis-alert-tone.wav',
  'memphis-device-identity.js',
  'memphis-device-reminders.js',
  'memphis-gps.js',
  'memphis-scan-sync.js',
  'memphis-ui.css',
  'memphis-ui.js',
  'memphis_avatar_ui.webp',
  'messages-chatscope.html',
  'messages.html',
  'scheduler_icon_ui.webp',
  'system-feedback.html',
  'thread.html',
]);
const custodialProhibitedFiles = [
  'admin.html',
  'device-security.html',
  'events-admin.html',
  'gemini-admin.html',
  'guest-issues.html',
  'manager-access.html',
  'memphis-auth.js',
  'notifications.html',
  'operational-insights.html',
  'ops-manager-hub.html',
  'phone-assignments.html',
  'schedule-simple.html',
  'schedule.html',
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
async function copyRuntimeGraph() {
  const verification = verifyFrontendReleaseManifest(repoRoot);
  if (!verification.ok) {
    const { missing, unexpected, hash_mismatches: hashMismatches, sorted } = verification.difference;
    const details = [
      missing.length ? `missing ${missing.join(', ')}` : '',
      unexpected.length ? `unexpected ${unexpected.join(', ')}` : '',
      hashMismatches.length ? `hash mismatches ${hashMismatches.map(({ file }) => file).join(', ')}` : '',
      sorted ? '' : 'asset keys are not sorted',
    ].filter(Boolean).join('; ');
    throw new Error(`frontend-release-manifest.json is stale: ${details}`);
  }
  const runtimeFiles = discoverRuntimeFiles(repoRoot);
  const selectedFiles = edition === 'custodial'
    ? runtimeFiles.filter((runtimePath) => custodialCompatibilityFiles.has(runtimePath))
    : runtimeFiles;
  if (edition === 'custodial') {
    const missingCompatibilityFiles = [...custodialCompatibilityFiles]
      .filter((runtimePath) => !runtimeFiles.includes(runtimePath));
    if (missingCompatibilityFiles.length) {
      throw new Error(`Custodial compatibility assets are missing: ${missingCompatibilityFiles.join(', ')}`);
    }
  }
  for (const runtimePath of selectedFiles) {
    const target = join(dist, runtimePath);
    await mkdir(dirname(target), { recursive: true });
    await cp(join(repoRoot, runtimePath), target);
  }
}
async function injectNativeScripts(bridgeFile) {
  for (const entry of await readdir(dist, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.html') continue;
    const path = join(dist, entry.name);
    let html = await readFile(path, 'utf8');
    const authScript = /<script[^>]+src=["'][^"']*memphis-auth\.js[^"']*["'][^>]*><\/script>/i;
    if (bridgeFile === 'memphis-custodial-bridge.js' && authScript.test(html)) {
      html = html.replace(authScript, `<script src="./${bridgeFile}"></script>`);
    } else if (authScript.test(html) && !new RegExp(bridgeFile.replace('.', '\\.')).test(html)) {
      html = html.replace(authScript, `$&\n<script src="./${bridgeFile}"></script>`);
    }
    if (!/memphis-native-layout\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-native-layout.js"></script>\n</body>');
    if (!/memphis-interaction-feedback\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-interaction-feedback.js"></script>\n</body>');
    await writeFile(path, html);
  }
}
async function buildSharedNativeFiles() {
  await buildJavascript({ entryPoints: [join(mobileRoot, 'src/shared/native-layout.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-native-layout.js'), target: ['es2022'] });
  await buildJavascript({ entryPoints: [join(mobileRoot, 'src/shared/interaction-feedback.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-interaction-feedback.js'), target: ['es2022'] });
}
async function distributionHashes(directory) {
  const hashes = new Map();
  async function walk(current, prefix = '') {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) await walk(absolutePath, relativePath);
      else if (entry.isFile()) {
        hashes.set(
          relativePath,
          createHash('sha256').update(await readFile(absolutePath)).digest('hex'),
        );
      }
    }
  }
  await walk(directory);
  return hashes;
}

async function verifyManagerWebViewBoundary(directory) {
  if (edition !== 'manager') return;
  const runtime = [];
  async function walk(current, prefix = '') {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path, name);
      else if (entry.isFile() && /[.](?:html|js|mjs)$/i.test(entry.name)) {
        runtime.push({ name, source: await readFile(path, 'utf8') });
      }
    }
  }
  await walk(directory);
  const globalProhibited = [
    ['retired SecureStorage package', /@aparajita\/capacitor-secure-storage/],
    ['JavaScript-readable SecureStorage call', /SecureStorage[.](?:get|set|remove)\s*\(/],
    ['v1 Manager mobile-auth route', /\/mobile-auth-api\//],
    ['retired plaintext Manager credential key', /memphis_zoo_ops_device_credential/],
    ['retired WebView Manager session key', /mz_native_(?:session|device_credential_runtime)/],
    ['plaintext auth storage', /(?:localStorage|sessionStorage)[.](?:getItem|setItem)\s*\([^)]*(?:credential|csrf|session_token|access_token)/i],
  ];
  const managerOwned = /^(?:memphis-mobile-bridge|mobile-manager|notifications-mobile|manager-access-mobile|moxie-mobile)[.]js$|^shell-assets\/manager-/;
  for (const entry of runtime) {
    for (const [label, pattern] of globalProhibited) {
      if (pattern.test(entry.source)) throw new Error(`Manager WebView boundary contains ${label} in ${entry.name}`);
    }
    if (managerOwned.test(entry.name)
        && (/Authorization\s*:\s*[`"']Bearer/.test(entry.source) || /session[.]token/.test(entry.source))) {
      throw new Error(`Manager-owned WebView runtime constructs a bearer token in ${entry.name}`);
    }
  }
  const managerRuntime = runtime.filter((entry) => managerOwned.test(entry.name)).map((entry) => entry.source).join('\n');
  for (const marker of ['ManagerNativeVault', 'authorizedRequest', 'manager-device-auth.v2']) {
    if (!managerRuntime.includes(marker)) throw new Error(`Manager WebView native boundary marker is missing: ${marker}`);
  }
}
async function verifyDistributionReferences(directory) {
  const files = await distributionHashes(directory);
  const cssUrlPattern = /url\(\s*["']?([^"'()]+)["']?\s*\)/gi;
  const htmlReferences = (source) => {
    const references = [];
    const structuralSource = source.replace(
      /(<script\b[^>]*>)[\s\S]*?<\/script>/gi,
      '$1</script>',
    );
    for (const tag of structuralSource.matchAll(/<[^>]+>/g)) {
      for (const attribute of tag[0].matchAll(/(?:src|href)\s*=\s*["']([^"'<>]+)["']/gi)) {
        references.push(attribute[1]);
      }
    }
    for (const style of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      for (const match of style[1].matchAll(cssUrlPattern)) references.push(match[1]);
    }
    for (const tag of source.matchAll(/<[^>]+\sstyle\s*=\s*["']([^"'<>]+)["'][^>]*>/gi)) {
      for (const match of tag[1].matchAll(cssUrlPattern)) references.push(match[1]);
    }
    return references;
  };
  for (const path of files.keys()) {
    const extension = extname(path).toLowerCase();
    if (extension !== '.html' && extension !== '.css') continue;
    const sourceBytes = await readFile(join(directory, path), 'utf8');
    const references = extension === '.html'
      ? htmlReferences(sourceBytes)
      : Array.from(sourceBytes.matchAll(cssUrlPattern), (match) => match[1]);
    for (const candidate of references) {
        const reference = String(candidate || '').trim();
        if (
          !reference
          || reference.startsWith('#')
          || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(reference)
        ) continue;
        const encodedPath = reference.split(/[?#]/, 1)[0];
        let decodedPath;
        try {
          decodedPath = decodeURIComponent(encodedPath);
        } catch {
          throw new Error(`${path} contains an invalid encoded local reference: ${reference}`);
        }
        const target = decodedPath.startsWith('/Engine/')
          ? resolve(directory, decodedPath.slice('/Engine/'.length))
          : decodedPath.startsWith('/')
            ? resolve(directory, decodedPath.slice(1))
            : resolve(dirname(join(directory, path)), decodedPath);
        const targetPath = relative(directory, target).replaceAll('\\', '/');
        if (isAbsolute(targetPath) || targetPath === '..' || targetPath.startsWith('../')) {
          throw new Error(`${path} contains an escaping local reference: ${reference}`);
        }
        if (!files.has(targetPath)) {
          throw new Error(`${path} references a missing distribution asset: ${targetPath}`);
        }
    }
  }
}
async function buildRoleShell() {
  const legacyHashes = await distributionHashes(dist);
  await viteBuild({
    configFile: join(mobileRoot, 'vite.config.ts'),
    mode: 'production',
    build: {
      outDir: dist,
      emptyOutDir: false,
    },
  });
  const after = await distributionHashes(dist);
  for (const [path, digest] of legacyHashes) {
    if (after.get(path) !== digest) {
      throw new Error(`Vite shell build changed legacy runtime bytes: ${path}`);
    }
  }
  if (edition === 'custodial') {
    for (const path of custodialProhibitedFiles) {
      if (after.has(path)) throw new Error(`Custodial distribution contains prohibited manager file: ${path}`);
    }
  }
  const graph = JSON.parse(await readFile(join(dist, 'shell-edition-module-graph.json'), 'utf8'));
  if (graph.edition !== edition || !Array.isArray(graph.modules)) {
    throw new Error(`Invalid ${edition} shell module graph`);
  }
  const expectedShellProof = /^(1|true|yes)$/i.test(String(process.env.MZ_SHELL_START || ''));
  if (graph.shell_proof !== expectedShellProof) {
    throw new Error(`${edition} shell proof identity does not match MZ_SHELL_START`);
  }
  if (
    graph.runtime?.react?.version !== rootPackage.dependencies.react
    || graph.runtime?.react_dom?.version !== rootPackage.dependencies['react-dom']
    || graph.runtime?.react?.package_root !== 'node_modules/react'
    || graph.runtime?.react_dom?.package_root !== 'node_modules/react-dom'
  ) {
    throw new Error(`${edition} shell did not resolve the pinned root React runtime`);
  }
  if (graph.modules.some((module) => /^mobile\/node_modules\/react(?:-dom)?\//.test(module))) {
    throw new Error(`${edition} shell contains the legacy React 18 runtime`);
  }
  const forbidden = {
    manager: ['mobile/src/shell/roles/custodial/', 'mobile/src/shell/roles/viewer/'],
    custodial: [
      'mobile/src/shell/roles/manager/',
      'mobile/src/shell/roles/viewer/',
      'mobile/src/shell/runtime/manager-notifications',
      'node_modules/@capacitor-firebase/messaging/',
      'node_modules/firebase/',
    ],
    viewer: [
      'mobile/src/shell/roles/manager/',
      'mobile/src/shell/roles/custodial/',
      'mobile/src/shell/runtime/capacitor',
      'node_modules/@aparajita/capacitor-secure-storage/',
      'node_modules/@capacitor-firebase/messaging/',
      'node_modules/firebase/',
    ],
  }[edition];
  for (const needle of forbidden) {
    if (graph.modules.some((module) => module.includes(needle))) {
      throw new Error(`${edition} shell contains prohibited module: ${needle}`);
    }
  }
  const javascript = (await Promise.all(
    [...after.keys()]
      .filter((path) => /^shell-assets\/.*\.js$/.test(path))
      .map((path) => readFile(join(dist, path), 'utf8')),
  )).join('\n');
  const expectedMarker = `MZ_ROLE_${edition.toUpperCase()}_ONLY`;
  if (!javascript.includes(expectedMarker)) throw new Error(`${edition} shell marker is missing`);
  for (const other of ['MANAGER', 'CUSTODIAL', 'VIEWER'].filter((name) => name !== edition.toUpperCase())) {
    if (javascript.includes(`MZ_ROLE_${other}_ONLY`)) {
      throw new Error(`${edition} shell contains prohibited ${other.toLowerCase()} code`);
    }
  }
  await verifyDistributionReferences(dist);
}

if (edition === 'manager') {
  await copyRuntimeGraph();
  await buildJavascript({ entryPoints: [join(mobileRoot, 'src/shared/mobile-bridge.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-mobile-bridge.js'), target: ['es2022'] });
  await buildSharedNativeFiles();
  await injectNativeScripts('memphis-mobile-bridge.js');
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await cp(join(source, 'index.html'), join(dist, 'start_page1.html'));
  await cp(join(source, 'moxie.html'), join(dist, 'moxie-mobile.html'));
  await cp(join(source, 'manager-access.html'), join(dist, 'manager-access.html'));
  await cp(join(source, 'notifications.html'), join(dist, 'notifications.html'));
  await buildJavascript({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-manager.js'), target: ['es2022'] });
  await buildJavascript({ entryPoints: [join(source, 'moxie.js')], bundle: true, format: 'iife', outfile: join(dist, 'moxie-mobile.js'), target: ['es2022'] });
  await buildJavascript({ entryPoints: [join(source, 'manager-access.js')], bundle: true, format: 'iife', outfile: join(dist, 'manager-access-mobile.js'), target: ['es2022'] });
  await buildJavascript({ entryPoints: [join(source, 'notifications.js')], bundle: true, format: 'iife', outfile: join(dist, 'notifications-mobile.js'), target: ['es2022'] });
  for (const name of ['index.html', 'start_page1.html', 'moxie-mobile.html', 'manager-access.html', 'notifications.html']) {
    const path = join(dist, name); let html = await readFile(path, 'utf8');
    if (!/memphis-native-layout\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-native-layout.js"></script>\n</body>');
    if (!/memphis-interaction-feedback\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-interaction-feedback.js"></script>\n</body>');
    await writeFile(path, html);
  }
} else if (edition === 'custodial') {
  await copyRuntimeGraph();
  await cp(join(repoRoot, 'index.html'), join(dist, 'scan.html'));
  await buildJavascript({
    entryPoints: [join(source, 'bridge.js')],
    bundle: true,
    format: 'iife',
    outfile: join(dist, 'memphis-custodial-bridge.js'),
    target: ['es2022'],
    minify: !custodialBrowserTestBuild,
    define: {
      __MZ_CUSTODIAL_BROWSER_TEST__: JSON.stringify(custodialBrowserTestBuild),
    },
    dropLabels: custodialBrowserTestBuild ? [] : ['MZ_CUSTODIAL_BROWSER_TEST'],
  });
  await buildSharedNativeFiles();
  await injectNativeScripts('memphis-custodial-bridge.js');
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await cp(join(source, 'index.html'), join(dist, 'start_page1.html'));
  await buildJavascript({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-custodial.js'), target: ['es2022'] });
  for (const name of ['index.html', 'start_page1.html']) {
    const path = join(dist, name); let html = await readFile(path, 'utf8');
    if (!/memphis-native-layout\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-native-layout.js"></script>\n</body>');
    if (!/memphis-interaction-feedback\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-interaction-feedback.js"></script>\n</body>');
    await writeFile(path, html);
  }
} else {
  await cp(join(repoRoot, 'Zoo_Logo_ui.webp'), join(dist, 'Zoo_Logo_ui.webp'));
  await cp(join(repoRoot, 'dashboard-bg_optimized.webp'), join(dist, 'dashboard-bg_optimized.webp'));
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await buildJavascript({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-viewer.js'), target: ['es2022'] });
}

await writeFile(join(dist, 'memphis-build-identity.js'), `globalThis.MemphisMobileBuild=${JSON.stringify(nativeBuildNumber || '')};globalThis.MemphisMobileBuildIdentity=${JSON.stringify({
  edition,
  ...buildIdentity,
  native_build_number: nativeBuildNumber ? Number(nativeBuildNumber) : null,
})};\n`);
for (const entry of await readdir(dist, { withFileTypes: true })) {
  if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.html') continue;
  const path = join(dist, entry.name);
  let html = await readFile(path, 'utf8');
  if (!/memphis-build-identity\.js/i.test(html)) {
    html = html.replace(/<\/head>/i, '  <script src="./memphis-build-identity.js"></script>\n</head>');
    await writeFile(path, html);
  }
}

await cp(join(mobileRoot, 'src/shared/mobile.css'), join(dist, 'mobile.css'));
await cp(join(mobileRoot, 'src/shared/field-guide.css'), join(dist, 'field-guide.css'));
await buildRoleShell();
await verifyManagerWebViewBoundary(dist);
await writeFile(join(dist, 'build.json'), `${JSON.stringify({
  edition,
  ...buildIdentity,
  native_build_number: nativeBuildNumber ? Number(nativeBuildNumber) : null,
  messenger: edition === 'viewer' ? null : 'chatscope',
}, null, 2)}\n`);
const runtimeManifest = writeRuntimeAssetManifest({
  directory: dist,
  edition,
  identity: buildIdentity,
});
console.log(`Built Memphis Zoo ${edition} edition in ${dist}`);
console.log(`Runtime asset manifest contains ${runtimeManifest.asset_count} files for ${runtimeManifest.build_id}`);
