import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const repoRoot = resolve(mobileRoot, '..');
const source = join(mobileRoot, 'src', 'chatscope', 'app.jsx');
const outputJs = join(repoRoot, 'chatscope-messenger.js');
const outputCss = join(repoRoot, 'chatscope-messenger.css');

await mkdir(dirname(outputJs), { recursive: true });
await rm(outputJs, { force: true });
await rm(outputCss, { force: true });

await build({
  entryPoints: [source],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  outfile: outputJs,
  jsx: 'automatic',
  loader: {
    '.js': 'jsx',
    '.jsx': 'jsx',
    '.svg': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.ttf': 'dataurl',
  },
  // These images are existing Engine assets copied beside the generated bundle
  // for both GitHub Pages and Capacitor. Keep their runtime-relative URLs.
  external: ['./Background1_optimized.webp', './Zoo_Logo_ui.webp', './memphis_avatar_ui.webp'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
});

console.log(`Built ${outputJs} and ${outputCss}`);
