import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import {
  discoverRuntimeFiles,
  resolveAppEdition,
  resolveBuildIdentity,
  verifyFrontendReleaseManifest,
  writeRuntimeAssetManifest,
} from '../../scripts/refresh-frontend-release-manifest.mjs';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const repoRoot = resolve(mobileRoot, '..');
const dist = join(mobileRoot, 'mobile-dist');
const edition = resolveAppEdition(process.env.MZ_APP_EDITION);
const source = join(mobileRoot, 'src', edition);
const buildIdentity = resolveBuildIdentity({ rootDirectory: repoRoot, edition });

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
async function copyFileIfPresent(name) { try { await cp(join(repoRoot, name), join(dist, name)); } catch {} }
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
  for (const runtimePath of discoverRuntimeFiles(repoRoot)) {
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
    if (/memphis-auth\.js/i.test(html) && !new RegExp(bridgeFile.replace('.', '\\.')).test(html)) {
      html = html.replace(/(<script[^>]+src=["'][^"']*memphis-auth\.js[^"']*["'][^>]*><\/script>)/i, `$1\n<script src="./${bridgeFile}"></script>`);
    }
    if (!/memphis-native-layout\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-native-layout.js"></script>\n</body>');
    if (!/memphis-interaction-feedback\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-interaction-feedback.js"></script>\n</body>');
    await writeFile(path, html);
  }
}
async function buildSharedNativeFiles() {
  await build({ entryPoints: [join(mobileRoot, 'src/shared/native-layout.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-native-layout.js'), target: ['es2022'] });
  await build({ entryPoints: [join(mobileRoot, 'src/shared/interaction-feedback.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-interaction-feedback.js'), target: ['es2022'] });
}

if (edition === 'manager') {
  await copyRuntimeGraph();
  await build({ entryPoints: [join(mobileRoot, 'src/shared/mobile-bridge.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-mobile-bridge.js'), target: ['es2022'] });
  await buildSharedNativeFiles();
  await injectNativeScripts('memphis-mobile-bridge.js');
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await cp(join(source, 'index.html'), join(dist, 'start_page1.html'));
  await cp(join(source, 'moxie.html'), join(dist, 'moxie-mobile.html'));
  await cp(join(source, 'manager-access.html'), join(dist, 'manager-access.html'));
  await cp(join(source, 'notifications.html'), join(dist, 'notifications.html'));
  await build({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-manager.js'), target: ['es2022'] });
  await build({ entryPoints: [join(source, 'moxie.js')], bundle: true, format: 'iife', outfile: join(dist, 'moxie-mobile.js'), target: ['es2022'] });
  await build({ entryPoints: [join(source, 'manager-access.js')], bundle: true, format: 'iife', outfile: join(dist, 'manager-access-mobile.js'), target: ['es2022'] });
  await build({ entryPoints: [join(source, 'notifications.js')], bundle: true, format: 'iife', outfile: join(dist, 'notifications-mobile.js'), target: ['es2022'] });
  for (const name of ['index.html', 'start_page1.html', 'moxie-mobile.html', 'manager-access.html', 'notifications.html']) {
    const path = join(dist, name); let html = await readFile(path, 'utf8');
    if (!/memphis-native-layout\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-native-layout.js"></script>\n</body>');
    if (!/memphis-interaction-feedback\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-interaction-feedback.js"></script>\n</body>');
    await writeFile(path, html);
  }
} else if (edition === 'custodial') {
  await copyRuntimeGraph();
  await cp(join(repoRoot, 'index.html'), join(dist, 'scan.html'));
  await build({ entryPoints: [join(source, 'bridge.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-custodial-bridge.js'), target: ['es2022'] });
  await buildSharedNativeFiles();
  await injectNativeScripts('memphis-custodial-bridge.js');
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await cp(join(source, 'index.html'), join(dist, 'start_page1.html'));
  await build({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-custodial.js'), target: ['es2022'] });
  for (const name of ['index.html', 'start_page1.html']) {
    const path = join(dist, name); let html = await readFile(path, 'utf8');
    if (!/memphis-native-layout\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-native-layout.js"></script>\n</body>');
    if (!/memphis-interaction-feedback\.js/i.test(html)) html = html.replace(/<\/body>/i, '<script src="./memphis-interaction-feedback.js"></script>\n</body>');
    await writeFile(path, html);
  }
} else {
  await copyFileIfPresent('Zoo_Logo_ui.webp');
  await copyFileIfPresent('dashboard-bg_optimized.webp');
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await build({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-viewer.js'), target: ['es2022'] });
}

await cp(join(mobileRoot, 'src/shared/mobile.css'), join(dist, 'mobile.css'));
await cp(join(mobileRoot, 'src/shared/field-guide.css'), join(dist, 'field-guide.css'));
await writeFile(join(dist, 'build.json'), `${JSON.stringify({
  edition,
  ...buildIdentity,
  messenger: edition === 'viewer' ? null : 'chatscope',
}, null, 2)}\n`);
const runtimeManifest = writeRuntimeAssetManifest({
  directory: dist,
  edition,
  identity: buildIdentity,
});
console.log(`Built Memphis Zoo ${edition} edition in ${dist}`);
console.log(`Runtime asset manifest contains ${runtimeManifest.asset_count} files for ${runtimeManifest.build_id}`);
