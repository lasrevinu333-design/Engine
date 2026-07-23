#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const workflowDirectory = resolve(root, '.github', 'workflows');
const workflowNames = readdirSync(workflowDirectory)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .sort();
const workflows = Object.fromEntries(
  workflowNames.map((name) => [name, read(`.github/workflows/${name}`)]),
);
const temporaryWorkflows = new Set(['batch-0a-source-export.yml']);
const actionPins = new Map([
  ['actions/checkout', ['11d5960a326750d5838078e36cf38b85af677262', 'v4']],
  ['actions/setup-node', ['49933ea5288caeca8642d1e84afbd3f7d6820020', 'v4']],
  ['actions/setup-java', ['c1e323688fd81a25caa38c78aa6df2d33d3e20d9', 'v4']],
  ['actions/upload-artifact', ['ea165f8d65b6e75b540449e92b4886f43607fa02', 'v4']],
  ['android-actions/setup-android', ['9fc6c4e9069bf8d3d10b2204b1fb8f6ef7065407', 'v3']],
]);

for (const [name, source] of Object.entries(workflows)) {
  assert.doesNotMatch(source, /node-version:\s*['"]?22['"]?\s*$/m, `${name} must not float on the Node 22 major`);
  assert.doesNotMatch(source, /mobile\/package-lock\.json/, `${name} must use the root workspace lockfile`);
  assert.doesNotMatch(
    source,
    /working-directory:\s*mobile\s*\n\s*run:\s*npm ci/m,
    `${name} must install the workspace once from the repository root`,
  );

  if (source.includes('actions/setup-node')) {
    const declarations = [...source.matchAll(/node-version:\s*['"]?([^'"\s]+)['"]?/g)].map((match) => match[1]);
    assert.ok(declarations.length > 0, `${name} setup-node step must declare a version`);
    assert.deepEqual(
      [...new Set(declarations)],
      ['22.23.1'],
      `${name} setup-node steps must use Node 22.23.1 exactly`,
    );
    assert.match(
      source,
      /npm install --global npm@11\.17\.0 --ignore-scripts --no-audit --no-fund/,
      `${name} must install the exact project-pinned npm after setup-node`,
    );
    assert.match(
      source,
      /test "\$\(npm --version\)" = ['"]11\.17\.0['"]/,
      `${name} must verify the project-pinned npm 11.17.0`,
    );
  }

  if (!temporaryWorkflows.has(name)) {
    assert.doesNotMatch(source, /runs-on:\s*ubuntu-latest/, `${name} must pin the Ubuntu runner image`);
    if (source.includes('runs-on: ubuntu-')) {
      assert.match(source, /runs-on:\s*ubuntu-24\.04/, `${name} must use Ubuntu 24.04`);
    }
    for (const match of source.matchAll(/uses:\s*([^@\s#]+)@([^\s#]+)(?:\s+#\s*(v\d+))?/g)) {
      const [, action, revision, comment] = match;
      const expected = actionPins.get(action);
      assert.ok(expected, `${name} uses an unapproved unpinned action: ${action}`);
      assert.equal(revision, expected[0], `${name} must pin ${action} to its verified commit`);
      assert.equal(comment, expected[1], `${name} must retain the readable ${expected[1]} action comment`);
    }
  }

}

const codemagic = read('codemagic.yaml');
assert.doesNotMatch(codemagic, /\bnode:\s*['"]?22['"]?\s*$/m, 'Codemagic must not float on the Node 22 major');
const exactNpmBootstrap = 'npm install --global npm@11.17.0 --ignore-scripts --no-audit --no-fund';
const codemagicInstallLines = codemagic
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('npm install'));
assert.deepEqual(
  codemagicInstallLines,
  [exactNpmBootstrap],
  'Codemagic may only bootstrap the exact project-pinned npm before the frozen workspace install',
);
assert.match(codemagic, /test "\$\(npm --version\)" = "11\.17\.0"/, 'Codemagic must verify npm 11.17.0');
assert.equal(
  [...codemagic.matchAll(/^\s+node:\s*['"]22\.23\.1['"]\s*$/gm)].length,
  6,
  'Every Codemagic workflow must use Node 22.23.1 exactly',
);
assert.match(codemagic, /\bnpm ci --no-audit --no-fund\b/, 'Codemagic must use the root frozen workspace install');
assert.equal(
  [...codemagic.matchAll(/^\s+xcode:\s*['"]26\.4['"]\s*$/gm)].length,
  3,
  'Every retained Codemagic iOS workflow must pin Xcode 26.4',
);
assert.doesNotMatch(codemagic, /xcode:\s*latest/, 'Codemagic must not float on the latest Xcode image');
assert.match(codemagic, /git diff --exit-code -- chatscope-messenger\.js chatscope-messenger\.css/, 'Codemagic must reject ChatScope bundle drift');
assert.match(codemagic, /runtime-asset-manifest\.json/, 'Codemagic must verify runtime asset provenance');
assert.match(codemagic, /-native\.sha256/, 'Codemagic must checksum signed native artifacts');
for (const workflow of [
  'manager-ios',
  'custodial-ios',
  'viewer-ios',
  'manager-android',
  'custodial-android',
  'viewer-android',
]) {
  assert.match(codemagic, new RegExp(`^  ${workflow}:$`, 'm'), `Codemagic must retain the ${workflow} signed build`);
}
assert.match(codemagic, /bundle_identifier:\s*org\.memphiszoo\.custodial/, 'Custodial iOS must use its own bundle identifier');
assert.match(codemagic, /-\s+memphis_zoo_custodial_keystore/, 'Custodial Android must use its own signing identity');

for (const name of ['android-test-apks.yml', 'mobile-editions-build.yml']) {
  const source = workflows[name];
  assert.match(source, /push:\s*\n\s*branches:\s*\[main\]/, `${name} must build main`);
  for (const runtimePattern of [
    "'*.html'",
    "'*.js'",
    "'*.css'",
    "'*.svg'",
    "'*.webp'",
    "'*.png'",
    "'*.jpg'",
    "'*.jpeg'",
    "'*.json'",
    "'*.ico'",
    "'*.wav'",
    "'*.txt'",
  ]) {
    assert.ok(source.includes(runtimePattern), `${name} must trigger for ${runtimePattern}`);
  }
  assert.match(source, /cache-dependency-path:\s*package-lock\.json/, `${name} must cache from the root lockfile`);
  assert.match(source, /npm run --silent test:mobile/, `${name} must run mobile contracts`);
  assert.match(source, /npm run --silent test:batch-0a/, `${name} must run the Batch 0A baseline contracts`);
  assert.match(source, /node scripts\/runtime-manifest-contract-tests\.mjs/, `${name} must run runtime-manifest contracts`);
  assert.match(source, /node scripts\/ci-toolchain-contract-tests\.mjs/, `${name} must run CI toolchain contracts`);
  assert.match(source, /npm run --silent release:manifest:check/, `${name} must check release-manifest drift`);
  assert.match(source, /git diff --exit-code -- chatscope-messenger\.js chatscope-messenger\.css/, `${name} must reject ChatScope bundle drift`);
  assert.match(source, /runtime-asset-manifest\.json/, `${name} must verify runtime asset provenance`);
}

assert.match(
  workflows['custodial-production-repair.yml'],
  /npm run --silent test:accessibility:baseline/,
  'A pull-request gate must reject new serious or critical accessibility regressions before merge',
);

const playwrightConfig = read('playwright.config.js');
assert.doesNotMatch(playwrightConfig, /\bchannel:\s*['"]chrome['"]/, 'Playwright must not use the mutable system Chrome channel');
assert.match(playwrightConfig, /browserName:\s*['"]chromium['"]/, 'Playwright must use its exact package-managed Chromium');

const gitignore = read('.gitignore');
for (const generatedPath of [
  '.playwright-browsers/',
  'quality-evidence/',
  'ui-geometry-evidence/',
  'out/',
  '/build/',
  'mobile/mobile-dist/',
  'mobile/android/',
  'mobile/ios/',
]) {
  assert.ok(gitignore.split(/\r?\n/).includes(generatedPath), `.gitignore must exclude ${generatedPath}`);
}

assert.equal(existsSync(resolve(root, 'mobile', 'package-lock.json')), false, 'The stale mobile lockfile must remain removed');

console.log(JSON.stringify({
  ok: true,
  workflows_checked: workflowNames.length,
  node: '22.23.1',
  npm: '11.17.0',
  root_lockfile: 'package-lock.json',
  browser: 'playwright-managed-chromium',
}, null, 2));
