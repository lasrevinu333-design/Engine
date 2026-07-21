import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { build } from 'esbuild';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const repoRoot = resolve(mobileRoot, '..');
const dist = join(mobileRoot, 'mobile-dist');
const edition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase() === 'viewer' ? 'viewer' : 'manager';
const source = join(mobileRoot, 'src', edition);

if (edition === 'manager') await import('./build-chatscope.mjs');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
async function copyFileIfPresent(name) { try { await cp(join(repoRoot, name), join(dist, name)); } catch {} }

if (edition === 'manager') {
  const allowed = new Set(['.html', '.js', '.css', '.svg', '.webp', '.png', '.jpg', '.jpeg', '.json', '.ico']);
  for (const entry of await readdir(repoRoot, { withFileTypes: true })) {
    if (entry.isFile() && allowed.has(extname(entry.name).toLowerCase())) await cp(join(repoRoot, entry.name), join(dist, entry.name));
  }
  for (const entry of await readdir(dist, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.html') continue;
    const path = join(dist, entry.name);
    let html = await readFile(path, 'utf8');
    if (/memphis-auth\.js/i.test(html) && !/memphis-mobile-bridge\.js/i.test(html)) {
      html = html.replace(/(<script[^>]+src=["'][^"']*memphis-auth\.js[^"']*["'][^>]*><\/script>)/i, '$1\n<script src="./memphis-mobile-bridge.js"></script>');
      await writeFile(path, html);
    }
  }
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await cp(join(source, 'index.html'), join(dist, 'start_page1.html'));
  await cp(join(source, 'moxie.html'), join(dist, 'moxie-mobile.html'));
  await cp(join(source, 'manager-access.html'), join(dist, 'manager-access.html'));
  await cp(join(source, 'notifications.html'), join(dist, 'notifications.html'));
  await build({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-manager.js'), target: ['es2022'] });
  await build({ entryPoints: [join(source, 'moxie.js')], bundle: true, format: 'iife', outfile: join(dist, 'moxie-mobile.js'), target: ['es2022'] });
  await build({ entryPoints: [join(source, 'manager-access.js')], bundle: true, format: 'iife', outfile: join(dist, 'manager-access-mobile.js'), target: ['es2022'] });
  await build({ entryPoints: [join(source, 'notifications.js')], bundle: true, format: 'iife', outfile: join(dist, 'notifications-mobile.js'), target: ['es2022'] });
  await build({ entryPoints: [join(mobileRoot, 'src/shared/mobile-bridge.js')], bundle: true, format: 'iife', outfile: join(dist, 'memphis-mobile-bridge.js'), target: ['es2022'] });
} else {
  await copyFileIfPresent('Zoo_Logo_ui.webp');
  await copyFileIfPresent('dashboard-bg_optimized.webp');
  await cp(join(source, 'index.html'), join(dist, 'index.html'));
  await build({ entryPoints: [join(source, 'app.js')], bundle: true, format: 'iife', outfile: join(dist, 'mobile-viewer.js'), target: ['es2022'] });
}
await cp(join(mobileRoot, 'src/shared/mobile.css'), join(dist, 'mobile.css'));
await writeFile(join(dist, 'build.json'), JSON.stringify({ edition, built_at: new Date().toISOString(), chatscope: edition === 'manager' }, null, 2));
console.log(`Built Memphis Zoo ${edition} edition in ${dist}`);
