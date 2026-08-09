import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const shell = join(root, 'mobile', 'src', 'shell');
const editions = ['manager', 'custodial', 'viewer'];

const read = (path) => readFile(join(root, path), 'utf8');
const packageJson = JSON.parse(await read('package.json'));
const mobilePackageJson = JSON.parse(await read('mobile/package.json'));
assert.equal(packageJson.dependencies.react, '19.2.8');
assert.equal(packageJson.dependencies['react-dom'], '19.2.8');
assert.equal(packageJson.dependencies['react-router'], '8.3.0');
assert.equal(packageJson.dependencies['react-router-dom'], undefined);
assert.equal(packageJson.dependencies['@tanstack/react-query'], '5.101.4');
assert.equal(packageJson.dependencies.zod, '4.4.3');
assert.equal(packageJson.devDependencies.vite, '8.1.5');
assert.equal(packageJson.devDependencies['@vitejs/plugin-react'], '6.0.4');
assert.equal(packageJson.devDependencies.vitest, '4.1.10');
assert.equal(packageJson.devDependencies['@types/node'], '22.20.1');
assert.equal(mobilePackageJson.dependencies.react, '18.3.1');
assert.equal(mobilePackageJson.dependencies['react-dom'], '18.3.1');
assert.equal(packageJson.allowScripts['fsevents@2.3.3'], false);
const batchBrowserCommand = packageJson.scripts['test:batch-0b:browser'];
assert.match(batchBrowserCommand, /^npm run --silent build:batch-0b:browser-fixtures && playwright test /);
const batchBrowserSpecs = batchBrowserCommand.split('playwright test ')[1].trim().split(/\s+/).sort();
assert.deepEqual(batchBrowserSpecs, [
  'tests/custodial-bridge-readiness.spec.js',
  'tests/custodial-enrollment-terminal.spec.js',
  'tests/mobile-shell-seam.spec.js',
  'tests/native-custodial-navigation.spec.js',
]);

for (const edition of editions) {
  const routes = await read(`mobile/src/shell/roles/${edition}/routes.ts`);
  const entry = await read(`mobile/src/shell/roles/${edition}/entry.ts`);
  assert.match(routes, new RegExp(`edition: '${edition}'`));
  assert.match(entry, new RegExp(`${edition}Definition`));
  for (const prohibited of editions.filter((candidate) => candidate !== edition)) {
    assert.doesNotMatch(entry, new RegExp(`roles/${prohibited}|${prohibited}Definition`));
  }
}

const providers = await readdir(join(shell, 'providers'));
for (const required of [
  'api.tsx', 'auth.tsx', 'deep-links.tsx', 'device.tsx', 'error-boundary.tsx',
  'network.tsx', 'notifications.tsx', 'release.tsx', 'shell-providers.tsx',
]) {
  assert(providers.includes(required), `Missing required shell provider ${required}`);
}
const apiProvider = await read('mobile/src/shell/providers/api.tsx');
assert.match(apiProvider, /method:\s*'GET'/);
assert.doesNotMatch(apiProvider, /RequestInit|mutat/i, 'The shared shell API provider must remain read-only');

const build = await read('mobile/scripts/build.mjs');
const browserFixtureBuild = await read('scripts/build-batch-0b-browser-fixtures.mjs');
assert.match(build, /viteBuild/);
assert.match(build, /vite\.config\.ts/);
assert.match(build, /legacyHashes/);
assert.match(build, /changed legacy runtime bytes/);
assert.match(build, /shell-edition-module-graph\.json/);
assert.match(build, /prohibited module/);
assert.match(build, /MZ_MOBILE_DIST may only target/);
assert.match(build, /\.pending-\[a-f0-9\]\{24\}-\[A-Za-z0-9\]\{6\}/);
assert.match(build, /browserTestFlag === '1'/);
assert.match(browserFixtureBuild, /MZ_CUSTODIAL_BROWSER_TEST:\s*'1'/);
assert.match(build, /custodialCompatibilityFiles/);
assert.match(build, /Custodial distribution contains prohibited manager file/);
assert.match(build, /verifyDistributionReferences/);
assert.match(build, /references a missing distribution asset/);
assert.match(build, /async function buildJavascript\(options\)/);
assert.match(
  build,
  /esbuildBuild\(\{\s*\.\.\.options,\s*absWorkingDir:\s*mobileRoot,\s*\}\)/,
  'The fixed esbuild working directory must override every caller option',
);
assert.equal(
  [...build.matchAll(/\besbuildBuild\s*\(/g)].length,
  1,
  'Every esbuild invocation must pass through the mobile-root working-directory wrapper',
);
assert.doesNotMatch(build, /copyFileIfPresent|catch\s*\{\s*\}/, 'Required shell assets must fail the build when absent');
const appShell = await read('mobile/app-shell.html');
assert.match(appShell, /src\/shell\/main\.tsx/);
assert(!/<iframe\b/i.test(appShell), 'Shell compatibility must not use iframes');
assert(!/maximum-scale/i.test(appShell), 'Shell must preserve pinch and text scaling');

const viteConfig = await read('mobile/vite.config.ts');
for (const contract of [
  /publicDir:\s*false/,
  /copyPublicDir:\s*false/,
  /emptyOutDir:\s*false/,
  /rolldownOptions/,
  /shell-edition-module-graph\.json/,
  /package_json_sha256/,
  /__MZ_SHELL_PROOF__/,
]) assert.match(viteConfig, contract);
assert.match(viteConfig, /browserTestFlag === '1'/);
assert.match(viteConfig, /const ROLLDOWN_RUNTIME_MODULE_ID = '\\0rolldown\/runtime\.js'/);
assert.match(viteConfig, /'\\0vite\/modulepreload-polyfill\.js', 'virtual:vite\/modulepreload-polyfill\.js'/);
assert.match(viteConfig, /'\\0vite\/preload-helper\.js', 'virtual:vite\/preload-helper\.js'/);
assert.match(viteConfig, /Unreviewed virtual shell module/);
assert.match(
  viteConfig,
  /\.flatMap\(\(item\) => Object\.keys\(item\.modules \?\? \{\}\)\)\s*\.filter\(\(id\) => id !== ROLLDOWN_RUNTIME_MODULE_ID\)\s*\.map\(normalizeModuleId\)/,
  'The exact platform-only Rolldown helper must be filtered before module ID normalization',
);
assert.doesNotMatch(
  viteConfig,
  /Boolean\(process\.env\.MZ_MOBILE_DIST\)/,
  'a private runtime output path must not enable browser-test behavior',
);
assert.doesNotMatch(viteConfig, /rollupOptions/);

const chatScopeBuild = await read('mobile/scripts/build-chatscope.mjs');
assert.match(chatScopeBuild, /createRequire/);
assert.match(chatScopeBuild, /mobileReactRoot/);
assert.match(chatScopeBuild, /metafile:\s*true/);
assert.match(chatScopeBuild, /must bundle only the mobile React 18 graph/);

const capacitor = await read('mobile/capacitor.config.ts');
assert.match(capacitor, /MZ_SHELL_START/);
assert.match(capacitor, /appStartPath:\s*'\/app-shell\.html'/);
assert.match(capacitor, /zoomEnabled:\s*true/);
assert.match(capacitor, /SystemBars:\s*\{\s*insetsHandling:\s*'css'/);
assert.match(
  capacitor.match(/const viewerPlugins = \[[^\]]+\]/)?.[0] ?? '',
  /@capacitor\/app/,
  'Viewer must receive native deep-link and hardware-Back events',
);
const viewerRuntime = await read('mobile/src/shell/runtime/viewer.ts');
assert.match(viewerRuntime, /App\.getLaunchUrl/);
assert.match(viewerRuntime, /App\.addListener\('appUrlOpen'/);
assert.match(viewerRuntime, /App\.addListener\('backButton'/);
const routeNormalization = await read('mobile/src/shell/core/route-normalization.ts');
const deepLinkProvider = await read('mobile/src/shell/providers/deep-links.tsx');
const customSchemeUrl = await read('mobile/src/shared/custom-scheme-url.ts');
for (const edition of editions) {
  assert.match(routeNormalization, new RegExp(`${edition}: 'memphiszoo-${edition}:'`));
}
assert.match(routeNormalization, /protocol === 'memphiszoo:'[\s\S]*definition\.edition === 'custodial'/);
assert.match(routeNormalization, /parseUrlWithHierarchicalCustomSchemes\(source, CUSTOM_SCHEMES\)/);
assert.match(customSchemeUrl, /new URL\(`https:\$\{source\.slice\(separator \+ 1\)\}`\)/);
assert.doesNotMatch(
  deepLinkProvider,
  /lastUrl|url\s*===\s*[^)]*\.current/,
  'Each native NFC event must remain observable when the same location is scanned again',
);

const shellCss = await read('mobile/src/shell/shell.css');
for (const inset of ['top', 'right', 'bottom', 'left']) {
  assert.match(shellCss, new RegExp(`--safe-area-inset-${inset}`));
}
assert.match(shellCss, /--mz-visual-viewport-height/);
assert.match(shellCss, /--mz-visual-viewport-offset-top/);
assert.doesNotMatch(shellCss, /(?:72|78|108)px/, 'Shell must not use guessed system inset layers');

const routeFiles = await Promise.all(editions.map((edition) =>
  read(`mobile/src/shell/roles/${edition}/routes.ts`)));
assert(routeFiles.every((source) => /legacyTarget/.test(source)));
console.log('Batch 0B shell contracts passed.');
