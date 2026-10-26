import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const repoRoot = resolve(mobileRoot, '..');
const source = join(mobileRoot, 'src', 'chatscope', 'app.jsx');
const outputJs = join(repoRoot, 'chatscope-messenger.js');
const outputCss = join(repoRoot, 'chatscope-messenger.css');
const mobileRequire = createRequire(join(mobileRoot, 'package.json'));
const mobileReactRoot = dirname(mobileRequire.resolve('react/package.json'));
const mobileReactDomRoot = dirname(mobileRequire.resolve('react-dom/package.json'));

const result = await build({
  entryPoints: [source],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  outfile: outputJs,
  // Do not remove the working assets when compilation/dependency validation
  // fails. Generate in memory and admit the complete normal graph first.
  write: false,
  metafile: true,
  jsx: 'automatic',
  alias: {
    react: mobileReactRoot,
    'react-dom': mobileReactDomRoot,
  },
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

const normalizedMobileRoot = `${mobileRoot.replaceAll('\\', '/')}/node_modules/`;
const reactInputs = Object.keys(result.metafile.inputs)
  .map((path) => resolve(path).replaceAll('\\', '/'))
  .filter((path) => /(?:^|\/)node_modules\/(?:react|react-dom)\//.test(path));
if (!reactInputs.length || reactInputs.some((path) => !path.includes(normalizedMobileRoot))) {
  throw new Error(`ChatScope must bundle only the mobile React 18 graph: ${reactInputs.join(', ')}`);
}

const expectedOutputs = new Set([outputJs, outputCss]);
if (result.outputFiles.length !== expectedOutputs.size
    || result.outputFiles.some((file) => !expectedOutputs.has(resolve(file.path)))) {
  throw new Error('ChatScope must generate both fixed JS and CSS assets before replacement.');
}
await mkdir(dirname(outputJs), { recursive: true });
for (const file of result.outputFiles) await writeFile(file.path, file.contents);

console.log(`Built ${outputJs} and ${outputCss}`);
