#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CUSTODIAL_ACCEPTANCE_SCHEMA_ID,
  CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION,
  CUSTODIAL_SIGNER_SHA256,
  CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256,
  parseApksignerVerification,
} from '../mobile/scripts/verify-custodial-android-release.mjs';
import { ANDROID_BACKUP_VERIFIER_VERSION } from '../mobile/scripts/verify-android-apk-backup.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const mobilePackage = JSON.parse(read('mobile/package.json'));
assert.doesNotMatch(
  mobilePackage.scripts['test:contracts'],
  /custodial-linux-admission-host-tools-tests/,
  'host-specific Linux tool hashing must not run on generic CI runners',
);
assert.match(
  mobilePackage.scripts['test:contracts'],
  /custodial-codemagic-admission-bootstrap-tests/,
  'the injected portable admission-bootstrap suite must run in required CI',
);
for (const scriptName of ['test:admission-host:custodial', 'admit:codemagic:custodial']) {
  assert.match(
    mobilePackage.scripts[scriptName],
    /^\/home\/eric\/\.cache\/codex-toolchains\/node-v22\.23\.1\/bin\/node /,
    `${scriptName} must start under the pinned local admission Node`,
  );
}
const custodialReleaseVerifier = read('mobile/scripts/verify-custodial-android-release.mjs');
const custodialAcceptanceSchema = JSON.parse(
  read('mobile/scripts/custodial-android-release-acceptance.schema.json'),
);
assert.equal(custodialAcceptanceSchema.$id, CUSTODIAL_ACCEPTANCE_SCHEMA_ID);
assert.equal(
  custodialAcceptanceSchema.properties.verifier.properties.release_acceptance_version.const,
  CUSTODIAL_ANDROID_RELEASE_VERIFIER_VERSION,
);
assert.equal(
  custodialAcceptanceSchema.properties.verifier.properties.backup_verifier_version.const,
  ANDROID_BACKUP_VERIFIER_VERSION,
);
assert.equal(
  custodialAcceptanceSchema.properties.backup.properties.verifier_version.const,
  ANDROID_BACKUP_VERIFIER_VERSION,
);
assert.ok(custodialAcceptanceSchema.properties.tools.required.includes('apksigner_jar'));
assert.ok(custodialAcceptanceSchema.properties.signing.required.includes('signer_public_key_sha256'));
assert.ok(custodialAcceptanceSchema.properties.verifier.required.includes('release_policy_sha256'));
assert.match(custodialReleaseVerifier, /--build-tools-directory/);
assert.match(custodialReleaseVerifier, /--build-workflow/);
assert.match(custodialReleaseVerifier, /--runtime-directory/);
assert.doesNotMatch(
  custodialReleaseVerifier,
  /sourceDirectory:\s*join\(mobileRoot, ['"]mobile-dist['"]\)/,
  'Custodial acceptance must require the caller-selected clean runtime tree',
);
assert.doesNotMatch(custodialReleaseVerifier, /--expected-signer|--fixture/);
const acceptedSignerReport = `
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
Verified using v3.1 scheme (APK Signature Scheme v3.1): false
Verified using v4 scheme (APK Signature Scheme v4): false
Number of signers: 1
Signer #1 certificate SHA-256 digest: ${CUSTODIAL_SIGNER_SHA256}
Signer #1 public key SHA-256 digest: ${CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256}
`;
assert.deepEqual(parseApksignerVerification(acceptedSignerReport), {
  signer_count: 1,
  signer_sha256: CUSTODIAL_SIGNER_SHA256,
  signer_public_key_sha256: CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256,
  verified_schemes: [2, 3],
  v2_or_newer: true,
});
assert.throws(
  () => parseApksignerVerification(acceptedSignerReport.replace(CUSTODIAL_SIGNER_SHA256, '0'.repeat(64))),
  /does not match the installed fleet identity/,
);
assert.throws(
  () => parseApksignerVerification(
    acceptedSignerReport.replace(CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256, '0'.repeat(64)),
  ),
  /public key does not match the installed fleet identity/,
);
assert.throws(
  () => parseApksignerVerification(
    acceptedSignerReport.replace(
      `Signer #1 public key SHA-256 digest: ${CUSTODIAL_SIGNER_PUBLIC_KEY_SHA256}\n`,
      '',
    ),
  ),
  /exactly one signer public-key digest; found 0/,
);
assert.throws(
  () => parseApksignerVerification(
    acceptedSignerReport
      .replace('Number of signers: 1', 'Number of signers: 2')
      .concat(`Signer #2 certificate SHA-256 digest: ${'1'.repeat(64)}\n`),
  ),
  /exactly one signer; found 2/,
);
assert.throws(
  () => parseApksignerVerification(
    acceptedSignerReport
      .replace('Verified using v2 scheme (APK Signature Scheme v2): true', 'Verified using v2 scheme (APK Signature Scheme v2): false')
      .replace('Verified using v3 scheme (APK Signature Scheme v3): true', 'Verified using v3 scheme (APK Signature Scheme v3): false'),
  ),
  /Signature Scheme v2/,
);
for (const duplicateV2 of [
  'Verified using v2 scheme (APK Signature Scheme v2): true',
  'Verified using v2 scheme (APK Signature Scheme v2): false',
]) {
  assert.throws(
    () => parseApksignerVerification(`${acceptedSignerReport}${duplicateV2}\n`),
    /reports signature scheme v2 more than once/,
  );
}
const runtimeManifestSource = read('scripts/refresh-frontend-release-manifest.mjs');
const runtimeExtensionDeclaration = runtimeManifestSource.match(
  /const RUNTIME_EXTENSIONS = new Set\(\[([\s\S]*?)\]\);/,
);
assert.ok(runtimeExtensionDeclaration, 'The runtime extension policy must remain discoverable by CI contracts');
const supportedRuntimeExtensions = [
  ...runtimeExtensionDeclaration[1].matchAll(/'(\.[a-z0-9]+)'/g),
].map((match) => match[1]);
assert.ok(supportedRuntimeExtensions.length > 0, 'The runtime extension policy must not be empty');
assert.equal(
  new Set(supportedRuntimeExtensions).size,
  supportedRuntimeExtensions.length,
  'The runtime extension policy must not contain duplicates',
);
const workflowDirectory = resolve(root, '.github', 'workflows');
const workflowNames = readdirSync(workflowDirectory)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .sort();
const workflows = Object.fromEntries(
  workflowNames.map((name) => [name, read(`.github/workflows/${name}`)]),
);
const workflowJobs = (source) => {
  const jobsStart = source.indexOf('\njobs:\n');
  if (jobsStart === -1) return [];
  const jobsSource = source.slice(jobsStart + '\njobs:\n'.length);
  return [...jobsSource.matchAll(/^  ([a-zA-Z0-9_-]+):\n([\s\S]*?)(?=^  [a-zA-Z0-9_-]+:\n|(?![\s\S]))/gm)]
    .map((match) => ({ name: match[1], source: match[0] }));
};
const workflowRunSteps = (jobSource) => {
  const lines = jobSource.split(/\r?\n/);
  const runSteps = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^( {8}run:| {6}- run:)\s*(.*)$/);
    if (!match) continue;
    const runIndent = match[1].startsWith('      -') ? 6 : 8;
    const value = match[2].trim();
    if (!/^[>|][+-]?$/.test(value)) {
      runSteps.push(value);
      continue;
    }
    const block = [];
    let next = index + 1;
    while (next < lines.length) {
      const line = lines[next];
      const indentation = line.match(/^ */)[0].length;
      if (line.trim() && indentation <= runIndent) break;
      block.push(line);
      next += 1;
    }
    runSteps.push(block.join('\n'));
    index = next - 1;
  }
  return runSteps;
};
const executableLines = (script) => script
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const MOBILE_CONTRACT_COMMAND = 'npm run --silent test:mobile';
const PLAYWRIGHT_INSTALL_COMMAND = 'npx --no-install playwright install --with-deps chromium';
const assertMobileContractBrowserDependencies = (workflowSources, expectedOwners) => {
  const owners = [];
  let parsedMobileTokens = 0;
  let declaredMobileTokens = 0;
  for (const [workflowName, source] of Object.entries(workflowSources)) {
    declaredMobileTokens += source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('test:mobile'))
      .length;
    for (const job of workflowJobs(source)) {
      const commands = workflowRunSteps(job.source).flatMap((script, stepIndex) =>
        executableLines(script).map((command, lineIndex) => ({ command, stepIndex, lineIndex })),
      );
      const mobileCommands = commands.filter(({ command }) => command.includes('test:mobile'));
      if (mobileCommands.length === 0) continue;
      parsedMobileTokens += mobileCommands.length;
      const owner = `${workflowName}:${job.name}`;
      assert.equal(mobileCommands.length, 1, `${owner} must run mobile contracts exactly once`);
      assert.equal(
        mobileCommands[0].command,
        MOBILE_CONTRACT_COMMAND,
        `${owner} must use the canonical mobile-contract command`,
      );
      const browserInstalls = commands.filter(({ command }) => command === PLAYWRIGHT_INSTALL_COMMAND);
      assert.equal(browserInstalls.length, 1, `${owner} must run exactly one pinned Playwright Chromium install`);
      const [browserInstall] = browserInstalls;
      const [mobileCommand] = mobileCommands;
      assert.equal(
        commands.filter(({ stepIndex }) => stepIndex === browserInstall.stepIndex).length,
        1,
        `${owner} must install Playwright Chromium in a dedicated unconditional run step`,
      );
      assert.ok(
        browserInstall.stepIndex < mobileCommand.stepIndex
          || (browserInstall.stepIndex === mobileCommand.stepIndex
            && browserInstall.lineIndex < mobileCommand.lineIndex),
        `${owner} must install pinned Playwright Chromium before mobile contracts`,
      );
      owners.push(owner);
    }
  }
  assert.equal(
    parsedMobileTokens,
    declaredMobileTokens,
    'every executable test:mobile token must belong to a parsed workflow job run step',
  );
  assert.deepEqual(
    owners.sort(),
    [...expectedOwners].sort(),
    'mobile-contract workflow job owners must remain explicit and non-vacuous',
  );
};
const expectedMobileContractOwners = [
  'android-test-apks.yml:build',
  'mobile-editions-build.yml:web-builds',
  'whole-system-quality-gate.yml:full-system',
];
assertMobileContractBrowserDependencies(workflows, expectedMobileContractOwners);

const workflowFixture = (steps, suffix = '') => `name: fixture\njobs:\n  build:\n    steps:\n${steps}${suffix}`;
const fixtureOwner = ['fixture.yml:build'];
assert.doesNotThrow(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(
    `      - run: ${PLAYWRIGHT_INSTALL_COMMAND}\n      - run: ${MOBILE_CONTRACT_COMMAND}\n`,
  ),
}, fixtureOwner));
assert.throws(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(`      - run: ${PLAYWRIGHT_INSTALL_COMMAND}\n`),
}, fixtureOwner), /explicit and non-vacuous/);
assert.throws(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(
    `      - run: ${PLAYWRIGHT_INSTALL_COMMAND}\n      - run: npm run test:mobile\n`,
  ),
}, fixtureOwner), /canonical mobile-contract command/);
assert.throws(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(
    `      - run: ${PLAYWRIGHT_INSTALL_COMMAND}\n      - run: ${MOBILE_CONTRACT_COMMAND}\n`,
    `outside: ${MOBILE_CONTRACT_COMMAND}\n`,
  ),
}, fixtureOwner), /must belong to a parsed workflow job run step/);
assert.throws(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(`      - run: ${MOBILE_CONTRACT_COMMAND}\n`),
}, fixtureOwner), /exactly one pinned Playwright Chromium install/);
assert.throws(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(
    `      - run: ${MOBILE_CONTRACT_COMMAND}\n      - run: ${PLAYWRIGHT_INSTALL_COMMAND}\n`,
  ),
}, fixtureOwner), /before mobile contracts/);
assert.throws(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(
    `      - run: |\n          # ${PLAYWRIGHT_INSTALL_COMMAND}\n          ${MOBILE_CONTRACT_COMMAND}\n`,
  ),
}, fixtureOwner), /exactly one pinned Playwright Chromium install/);
assert.throws(() => assertMobileContractBrowserDependencies({
  'fixture.yml': workflowFixture(
    `      - run: |\n          if false; then\n            ${PLAYWRIGHT_INSTALL_COMMAND}\n          fi\n      - run: ${MOBILE_CONTRACT_COMMAND}\n`,
  ),
}, fixtureOwner), /dedicated unconditional run step/);
const temporaryWorkflows = new Set(['batch-0a-source-export.yml']);
const actionPins = new Map([
  ['actions/checkout', ['3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1']],
  ['actions/setup-node', ['820762786026740c76f36085b0efc47a31fe5020', 'v7.0.0']],
  ['actions/setup-java', ['03ad4de0992f5dab5e18fcb136590ce7c4a0ac95', 'v5.6.0']],
  ['actions/upload-artifact', ['043fb46d1a93c77aae656e7c1c64a875d1fc6a0a', 'v7.0.1']],
  ['android-actions/setup-android', ['40fd30fb8d7440372e1316f5d1809ec01dcd3699', 'v4.0.1']],
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
    for (const match of source.matchAll(/uses:\s*([^@\s#]+)@([^\s#]+)(?:\s+#\s*(v\d+(?:\.\d+){0,2}))?/g)) {
      const [, action, revision, comment] = match;
      const expected = actionPins.get(action);
      assert.ok(expected, `${name} uses an unapproved unpinned action: ${action}`);
      assert.equal(revision, expected[0], `${name} must pin ${action} to its verified commit`);
      assert.equal(comment, expected[1], `${name} must retain the readable ${expected[1]} action comment`);
    }
  }

}

const liveReleaseWorkflow = workflows['foundation-repair-live.yml'];
assert.match(
  liveReleaseWorkflow,
  /frontend_commit_sha/,
  'Live acceptance must derive the published runtime commit from the deployment manifest',
);
assert.doesNotMatch(
  liveReleaseWorkflow,
  /grep -Fq "\$GITHUB_SHA" <<<"\$deployment"/,
  'Workflow-only commits must not be mistaken for published runtime deployments',
);
assert.match(
  liveReleaseWorkflow,
  /published_manifest_digest/,
  'Live acceptance must fingerprint the release manifest served by GitHub Pages',
);
assert.match(
  liveReleaseWorkflow,
  /test "\$published_manifest_digest" = "\$expected_manifest_digest"/,
  'Live acceptance must wait until the published runtime manifest matches the checked-out release',
);

const codemagic = read('codemagic.yaml');
assert.doesNotMatch(codemagic, /\bnode:\s*['"]?22['"]?\s*$/m, 'Codemagic must not float on the Node 22 major');
const exactNpmBootstrap = 'npm install --global npm@11.17.0 --ignore-scripts --no-audit --no-fund';
const CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND = 'npx --no-install playwright install chromium';
const CODEMAGIC_FROZEN_INSTALL_COMMAND = 'npm ci --no-audit --no-fund';
const codemagicScriptDefinitions = (source) => {
  const lines = source.split(/\r?\n/);
  const definitions = [];
  const workflowsStart = lines.findIndex((line) => line === 'workflows:');
  const definitionsEnd = workflowsStart === -1 ? lines.length : workflowsStart;
  for (let index = 0; index < definitionsEnd; index += 1) {
    const header = lines[index].match(/^    ([a-zA-Z0-9_-]+): &([a-zA-Z0-9_-]+)\s*$/);
    if (!header) continue;
    let end = index + 1;
    while (end < definitionsEnd && !/^    [a-zA-Z0-9_-]+: &[a-zA-Z0-9_-]+\s*$/.test(lines[end])) {
      end += 1;
    }
    const block = lines.slice(index + 1, end);
    const scriptMarker = block.findIndex((line) => /^      script: [>|][+-]?\s*$/.test(line));
    assert.notEqual(scriptMarker, -1, `Codemagic script definition ${header[1]} must contain a block script`);
    const scriptStyle = block[scriptMarker].match(/^      script: ([>|])[+-]?\s*$/)[1];
    const scriptLines = [];
    for (let lineIndex = scriptMarker + 1; lineIndex < block.length; lineIndex += 1) {
      const raw = block[lineIndex];
      const indentation = raw.match(/^ */)[0].length;
      if (raw.trim() && indentation <= 6) break;
      scriptLines.push({
        command: raw.trim(),
        indentation,
        lineIndex,
        raw,
      });
    }
    definitions.push({
      name: header[1],
      anchor: header[2],
      scriptStyle,
      scriptLines,
    });
    index = end - 1;
  }
  return definitions;
};
const codemagicWorkflowDefinitions = (source) => {
  const workflowsSource = source.match(/^workflows:\n([\s\S]*)$/m)?.[1] || '';
  return [...workflowsSource.matchAll(/^  ([a-z][a-z0-9-]+):\n([\s\S]*?)(?=^  [a-z][a-z0-9-]+:\n|(?![\s\S]))/gm)]
    .map((match) => {
      const lines = match[2].split(/\r?\n/);
      const scriptsStart = lines.findIndex((line) => line === '    scripts:');
      assert.notEqual(scriptsStart, -1, `Codemagic workflow ${match[1]} must contain a top-level scripts block`);
      let scriptsEnd = scriptsStart + 1;
      while (scriptsEnd < lines.length) {
        const line = lines[scriptsEnd];
        const indentation = line.match(/^ */)[0].length;
        if (line.trim() && indentation <= 4) break;
        scriptsEnd += 1;
      }
      const scriptBlock = lines.slice(scriptsStart + 1, scriptsEnd);
      const scriptEntries = [];
      for (let index = 0; index < scriptBlock.length; index += 1) {
        const anchor = scriptBlock[index].match(/^      - \*([a-zA-Z0-9_-]+)\s*$/)?.[1];
        if (anchor) {
          scriptEntries.push({ kind: 'anchor', anchor });
          continue;
        }
        const name = scriptBlock[index].match(/^      - name:\s*(.+?)\s*$/)?.[1];
        if (!name) continue;
        let end = index + 1;
        while (end < scriptBlock.length && !/^      - /.test(scriptBlock[end])) end += 1;
        const entryLines = scriptBlock.slice(index + 1, end);
        const scriptMarker = entryLines.findIndex((line) => /^        script:\s*/.test(line));
        assert.notEqual(
          scriptMarker,
          -1,
          `Codemagic workflow ${match[1]} step ${name} must contain a script`,
        );
        const marker = entryLines[scriptMarker];
        const blockMarker = marker.match(/^        script: ([>|])[+-]?\s*$/);
        const scriptLines = [];
        if (blockMarker) {
          for (let lineIndex = scriptMarker + 1; lineIndex < entryLines.length; lineIndex += 1) {
            const raw = entryLines[lineIndex];
            const indentation = raw.match(/^ */)[0].length;
            if (raw.trim() && indentation <= 8) break;
            scriptLines.push({
              command: raw.trim(),
              indentation,
              lineIndex,
              raw,
            });
          }
        } else {
          const command = marker.match(/^        script:\s+(.+?)\s*$/)?.[1];
          assert.ok(command, `Codemagic workflow ${match[1]} step ${name} has an invalid script`);
          scriptLines.push({
            command,
            indentation: 8,
            lineIndex: scriptMarker,
            raw: marker,
          });
        }
        scriptEntries.push({
          kind: 'inline',
          name,
          scriptStyle: blockMarker?.[1] || 'scalar',
          scriptLines,
        });
        index = end - 1;
      }
      return {
        name: match[1],
        anchors: scriptEntries
          .filter(({ kind }) => kind === 'anchor')
          .map(({ anchor }) => anchor),
        scriptEntries,
      };
    });
};
const executableCodemagicScriptLines = (scriptLines) => scriptLines
  .filter(({ command }) => command && !command.startsWith('#'));
const assertCodemagicBashEntry = (scriptLines, indentation, label) => {
  const [first] = scriptLines;
  assert.equal(first?.command, '#!/usr/bin/env bash', `${label} must select Bash explicitly`);
  assert.equal(first?.indentation, indentation, `${label} must start at the scalar top level`);
  assert.equal(
    first?.raw,
    `${' '.repeat(indentation)}#!/usr/bin/env bash`,
    `${label} must begin with the exact raw Bash shebang`,
  );
  assert.equal(
    scriptLines.filter(({ command }) => command === '#!/usr/bin/env bash').length,
    1,
    `${label} must contain exactly one leading Bash shebang`,
  );
  assert.deepEqual(
    scriptLines
      .slice(1)
      .filter(({ command }) => !command || command.startsWith('#'))
      .map(({ command, lineIndex }) => ({ command, lineIndex })),
    [],
    `${label} must not contain blank or comment lines that can break shell continuations`,
  );
  assert.deepEqual(
    scriptLines
      .filter(({ raw }) => raw.trimEnd() !== raw)
      .map(({ raw, lineIndex }) => ({ raw, lineIndex })),
    [],
    `${label} must not contain ASCII or Unicode trailing whitespace that changes shell continuations or heredocs`,
  );
  assert.deepEqual(
    scriptLines
      .filter(({ raw, indentation: lineIndentation }) =>
        raw.slice(lineIndentation) !== raw.trimStart())
      .map(({ raw, lineIndex }) => ({ raw, lineIndex })),
    [],
    `${label} must not normalize hidden leading whitespace into executable shell commands`,
  );
};
const CODEMAGIC_ANDROID_WORKFLOWS = [
  'manager-android',
  'custodial-android',
  'viewer-android',
];
const CODEMAGIC_GRADLE_TEMP_ASSIGNMENT =
  'gradle_temp_home="$(mktemp -d "$gradle_temp_root/memphis-zoo-gradle.XXXXXX")"';
const CODEMAGIC_GRADLE_REQUIRED_SEQUENCE = [
  'set -euo pipefail',
  'checkout_root="$(cd "$CM_BUILD_DIR" && pwd -P)"',
  'umask 077',
  'gradle_temp_root="$(cd "${TMPDIR:-/tmp}" && pwd -P)"',
  'readonly gradle_temp_root',
  CODEMAGIC_GRADLE_TEMP_ASSIGNMENT,
  'readonly gradle_temp_home',
  'cleanup_gradle_user_home() {',
  'rm -rf -- "$gradle_temp_home"',
  '}',
  'trap cleanup_gradle_user_home EXIT',
  'gradle_user_home="$(cd "$gradle_temp_home" && pwd -P)"',
  'case "$gradle_user_home/" in',
  '"$checkout_root/"*)',
  'printf \'Refusing Gradle cache inside the source checkout: %s\\n\' "$gradle_user_home" >&2',
  'exit 1',
  ';;',
  'esac',
  'chmod 700 "$gradle_user_home"',
  'test -d "$gradle_user_home"',
  'cd mobile/android',
  'rm -rf .gradle app/build build',
  'GRADLE_USER_HOME="$gradle_user_home" \\',
];
const assertCodemagicAndroidGradleIsolation = (source, expectedWorkflowNames) => {
  const workflows = codemagicWorkflowDefinitions(source);
  const androidWorkflows = workflows.filter(({ name }) => name.endsWith('-android'));
  assert.deepEqual(
    androidWorkflows.map(({ name }) => name).sort(),
    [...expectedWorkflowNames].sort(),
    'Codemagic Android workflow inventory must remain explicit and non-vacuous',
  );
  const declaredGradleCommands = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('gradlew'));
  const parsedGradleSteps = workflows.flatMap((workflow) => workflow.scriptEntries
    .filter(({ kind }) => kind === 'inline')
    .filter(({ scriptLines }) => executableCodemagicScriptLines(scriptLines)
      .some(({ command }) => command.includes('gradlew')))
    .map((entry) => ({ workflow, entry })));
  const parsedGradleCommands = parsedGradleSteps.flatMap(({ entry }) =>
    executableCodemagicScriptLines(entry.scriptLines)
      .filter(({ command }) => command.includes('gradlew')),
  );
  assert.equal(
    parsedGradleCommands.length,
    declaredGradleCommands.length,
    'Every executable Codemagic Gradle invocation must belong to a parsed workflow build step',
  );
  assert.equal(
    parsedGradleCommands.length,
    expectedWorkflowNames.length,
    'Every Codemagic Android workflow must execute exactly one parsed Gradle release build',
  );
  for (const workflowName of expectedWorkflowNames) {
    const workflow = androidWorkflows.find(({ name }) => name === workflowName);
    assert.ok(workflow, `Codemagic must retain the ${workflowName} workflow`);
    const matches = parsedGradleSteps.filter(({ workflow: owner }) => owner === workflow);
    assert.equal(matches.length, 1, `${workflowName} must execute one Gradle release build step`);
    const [{ entry }] = matches;
    const commands = executableCodemagicScriptLines(entry.scriptLines).map(({ command }) => command);
    const label = `Codemagic ${workflowName} Gradle build`;
    assert.equal(entry.scriptStyle, '|', `${label} must use literal YAML shell semantics`);
    assertCodemagicBashEntry(entry.scriptLines, 10, label);
    assert.equal(
      commands.filter((command) => command === CODEMAGIC_GRADLE_TEMP_ASSIGNMENT).length,
      1,
      `${label} must securely create exactly one isolated temporary Gradle home`,
    );
    assert.equal(
      commands.filter((command) => command === 'trap cleanup_gradle_user_home EXIT').length,
      1,
      `${label} must clean its temporary Gradle home whenever the step exits`,
    );
    assert.equal(
      commands.filter((command) => command === 'rm -rf -- "$gradle_temp_home"').length,
      1,
      `${label} cleanup must target only the mktemp-created Gradle home`,
    );
    assert.doesNotMatch(
      commands.join('\n'),
      /CM_BUILD_DIR[^\n]*gradle|gradle_user_home=.*CM_BUILD_DIR/i,
      `${label} must not put Gradle state inside the source checkout`,
    );
    const expectedGradleCommand = workflowName === 'custodial-android'
      ? './gradlew --no-daemon --dependency-verification strict assembleRelease \\'
      : './gradlew --no-daemon --dependency-verification strict assembleRelease bundleRelease \\';
    const expectedPrefix = [
      ...CODEMAGIC_GRADLE_REQUIRED_SEQUENCE,
      expectedGradleCommand,
      '--no-build-cache --rerun-tasks',
      'cmp \\',
      '"../native-locks/android/$MZ_APP_EDITION/verification-metadata.xml" \\',
      'gradle/verification-metadata.xml',
    ];
    assert.deepEqual(
      commands,
      expectedPrefix,
      `${label} must execute only the reachable strict cache-isolation build without wrappers or trap changes`,
    );
    const entryIndex = workflow.scriptEntries.indexOf(entry);
    assert.deepEqual(
      workflow.scriptEntries[entryIndex - 1],
      { kind: 'anchor', anchor: 'add_android' },
      `${label} must run only after the clean Android project is generated`,
    );
    assert.deepEqual(
      workflow.scriptEntries[entryIndex + 1],
      { kind: 'anchor', anchor: 'source_attestation' },
      `${label} must be followed immediately by source attestation`,
    );
  }
};
const CODEMAGIC_SOURCE_STATUS_ASSIGNMENT =
  'source_status="$(git status --porcelain=v1 --untracked-files=all)"';
const CODEMAGIC_SOURCE_ATTESTATION_SEQUENCE = [
  'set -euo pipefail',
  'actual_commit="$(git rev-parse HEAD)"',
  'expected_tree="$(git rev-parse "$CM_COMMIT^{tree}")"',
  'index_tree="$(git write-tree)"',
  CODEMAGIC_SOURCE_STATUS_ASSIGNMENT,
  'if [ "$actual_commit" != "$CM_COMMIT" ] || \\',
  '[ "$expected_tree" != "$index_tree" ] || \\',
  '[ -n "$source_status" ]; then',
  'printf \\',
  '\'Source attestation failed: expected commit %s, actual commit %s.\\n\' \\',
  '"$CM_COMMIT" \\',
  '"$actual_commit" \\',
  '>&2',
  'if [ -n "$source_status" ]; then',
  'printf \'Dirty source paths (status only):\\n%s\\n\' "$source_status" >&2',
  'fi',
  'exit 1',
  'fi',
  'SOURCE_TREE="$expected_tree" node --input-type=module <<\'NODE\'',
];
const CODEMAGIC_SOURCE_EVIDENCE_SEQUENCE = [
  'import { writeFileSync } from \'node:fs\';',
  'writeFileSync(',
  '`build/provenance/${process.env.MZ_APP_EDITION}-source-attestation.json`,',
  '`${JSON.stringify({',
  'schema_version: 1,',
  'source_commit: process.env.CM_COMMIT,',
  'source_tree: process.env.SOURCE_TREE,',
  'source_ref: process.env.CM_BRANCH,',
  'tracked_worktree_clean: true,',
  'untracked_nonignored_files_absent: true,',
  '}, null, 2)}\\n`,',
  '{ flag: \'wx\' },',
  ');',
  'NODE',
];
const VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS = [
  ...CODEMAGIC_SOURCE_ATTESTATION_SEQUENCE,
  ...CODEMAGIC_SOURCE_EVIDENCE_SEQUENCE,
];
const assertCodemagicSourceAttestation = (source) => {
  const definitions = codemagicScriptDefinitions(source);
  const declaredStatusCommands = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      line && !line.startsWith('#') && line.includes(CODEMAGIC_SOURCE_STATUS_ASSIGNMENT));
  const statusOwners = definitions.filter((definition) =>
    executableCodemagicScriptLines(definition.scriptLines)
      .some(({ command }) => command === CODEMAGIC_SOURCE_STATUS_ASSIGNMENT),
  );
  const parsedStatusCommands = definitions.flatMap((definition) =>
    executableCodemagicScriptLines(definition.scriptLines)
      .filter(({ command }) => command === CODEMAGIC_SOURCE_STATUS_ASSIGNMENT),
  );
  assert.equal(
    parsedStatusCommands.length,
    declaredStatusCommands.length,
    'Every exact Codemagic dirty-source check must belong to a parsed shared script',
  );
  assert.deepEqual(
    statusOwners.map(({ anchor }) => anchor),
    ['source_attestation'],
    'The exact dirty-source status check must belong to the source-attestation script',
  );
  const [definition] = statusOwners;
  const commands = executableCodemagicScriptLines(definition.scriptLines)
    .map(({ command }) => command);
  assert.equal(
    definition.scriptStyle,
    '|',
    'Codemagic source attestation must use literal YAML shell semantics',
  );
  assertCodemagicBashEntry(definition.scriptLines, 8, 'Codemagic source attestation');
  assert.equal(
    commands.filter((command) => command === CODEMAGIC_SOURCE_STATUS_ASSIGNMENT).length,
    1,
    'Source attestation must capture nonignored tracked and untracked status exactly once',
  );
  assert.equal(
    commands.filter((command) => command.startsWith('SOURCE_TREE=')).length,
    1,
    'Source attestation must emit commit-exact evidence exactly once after the dirty-source gate',
  );
  assert.deepEqual(
    definition.scriptLines
      .filter(({ command }) => command === 'NODE')
      .map(({ raw }) => raw),
    ['        NODE'],
    'Source attestation heredoc terminator must be the exact raw literal-scalar terminator',
  );
  assert.doesNotMatch(
    commands.join('\n'),
    /git diff(?:\s|$)/,
    'Source-attestation diagnostics must never print tracked file contents',
  );
  assert.deepEqual(
    commands,
    VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS,
    'Source attestation must execute only the reachable fail-closed gate and commit-bound evidence writer',
  );
};
const assertCodemagicMobileBrowserDependencies = (
  source,
  expectedScriptOwners,
  expectedWorkflowOwners,
) => {
  const definitions = codemagicScriptDefinitions(source);
  const executable = (definition) => definition.scriptLines
    .filter(({ command }) => command && !command.startsWith('#'));
  const declaredMobileTokens = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('test:mobile'))
    .length;
  const parsedMobileTokens = definitions
    .flatMap(executable)
    .filter(({ command }) => command.includes('test:mobile'))
    .length;
  assert.equal(
    parsedMobileTokens,
    declaredMobileTokens,
    'Every executable Codemagic test:mobile token must belong to a parsed shared script',
  );
  const mobileOwners = definitions.filter((definition) =>
    executable(definition).some(({ command }) => command.includes('test:mobile')),
  );
  assert.deepEqual(
    mobileOwners.map(({ anchor }) => anchor).sort(),
    [...expectedScriptOwners].sort(),
    'Codemagic mobile contracts must remain in the explicit shared script scope',
  );
  for (const definition of mobileOwners) {
    const commands = executable(definition);
    const mobileCommands = commands.filter(({ command }) => command.includes('test:mobile'));
    assert.equal(mobileCommands.length, 1, `Codemagic *${definition.anchor} must run mobile contracts exactly once`);
    assert.equal(
      mobileCommands[0].command,
      MOBILE_CONTRACT_COMMAND,
      `Codemagic *${definition.anchor} must use the canonical mobile-contract command`,
    );
    const browserCommands = commands.filter(({ command }) => command.includes('playwright install'));
    assert.deepEqual(
      browserCommands.map(({ command }) => command),
      [CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND],
      `Codemagic *${definition.anchor} must run exactly one lockfile-pinned Chromium install`,
    );
    const [browserCommand] = browserCommands;
    assert.equal(
      browserCommand.indentation,
      8,
      `Codemagic *${definition.anchor} must install Chromium as an unconditional top-level command`,
    );
    const frozenInstallIndex = commands.findIndex(({ command }) => command === CODEMAGIC_FROZEN_INSTALL_COMMAND);
    const browserInstallIndex = commands.indexOf(browserCommand);
    const mobileCommandIndex = commands.indexOf(mobileCommands[0]);
    assert.notEqual(
      frozenInstallIndex,
      -1,
      `Codemagic *${definition.anchor} must perform the canonical frozen workspace install`,
    );
    assert.equal(
      commands[frozenInstallIndex].indentation,
      8,
      `Codemagic *${definition.anchor} must run npm ci as an unconditional top-level command`,
    );
    assert.equal(
      commands.slice(0, browserInstallIndex).filter(({ command }) =>
        /^(?:(?:if|for|select|while|until|case)\b|(?:function\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\(\)\s*\{|[({]\s*$)/.test(command),
      ).length,
      0,
      `Codemagic *${definition.anchor} must not conditionally wrap the Chromium install`,
    );
    assert.equal(
      browserInstallIndex,
      frozenInstallIndex + 1,
      `Codemagic *${definition.anchor} must install pinned Chromium immediately after npm ci`,
    );
    assert.ok(
      browserInstallIndex < mobileCommandIndex,
      `Codemagic *${definition.anchor} must install pinned Chromium before mobile contracts`,
    );
  }
  const workflows = codemagicWorkflowDefinitions(source);
  const definitionsByAnchor = new Map(definitions.map((definition) => [definition.anchor, definition]));
  assert.deepEqual(
    workflows.map(({ name }) => name).sort(),
    [...expectedWorkflowOwners].sort(),
    'Codemagic release workflow inventory must remain explicit and non-vacuous',
  );
  for (const workflow of workflows) {
    const ownerReferences = workflow.anchors.filter((anchor) => expectedScriptOwners.includes(anchor));
    assert.equal(
      ownerReferences.length,
      1,
      `Codemagic ${workflow.name} must execute the mobile-contract shared script exactly once`,
    );
    const executedBrowserCommands = workflow.anchors.flatMap((anchor) => {
      const definition = definitionsByAnchor.get(anchor);
      assert.ok(definition, `Codemagic ${workflow.name} references undefined shared script *${anchor}`);
      return executable(definition).filter(({ command }) => command.includes('playwright install'));
    });
    assert.deepEqual(
      executedBrowserCommands.map(({ command }) => command),
      [CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND],
      `Codemagic ${workflow.name} must execute exactly one lockfile-pinned Chromium install`,
    );
  }
};
const codemagicBrowserFixture = ({
  installScript,
  extraDefinitions = '',
  workflowScripts = '      - *install\n',
  workflowSuffix = '',
}) => `definitions:
  scripts:
    install: &install
      name: Install
      script: |
${installScript}${extraDefinitions}workflows:
  release:
    scripts:
${workflowScripts}${workflowSuffix}`;
const validCodemagicInstallScript = `        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        ${CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND}\n        ${MOBILE_CONTRACT_COMMAND}\n`;
assert.doesNotThrow(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({ installScript: validCodemagicInstallScript }),
  ['install'],
  ['release'],
));
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: `        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        ${MOBILE_CONTRACT_COMMAND}\n`,
  }),
  ['install'],
  ['release'],
), /exactly one lockfile-pinned Chromium install/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: `        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        npx playwright install chromium\n        ${MOBILE_CONTRACT_COMMAND}\n`,
  }),
  ['install'],
  ['release'],
), /lockfile-pinned Chromium install/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: `        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        ${MOBILE_CONTRACT_COMMAND}\n        ${CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND}\n`,
  }),
  ['install'],
  ['release'],
), /immediately after npm ci|before mobile contracts/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: `        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        if false; then\n          ${CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND}\n        fi\n        ${MOBILE_CONTRACT_COMMAND}\n`,
  }),
  ['install'],
  ['release'],
), /unconditional top-level command/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: `        if false; then\n        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        ${CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND}\n        fi\n        ${MOBILE_CONTRACT_COMMAND}\n`,
  }),
  ['install'],
  ['release'],
), /must not conditionally wrap/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: `        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        # ${CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND}\n        ${MOBILE_CONTRACT_COMMAND}\n`,
  }),
  ['install'],
  ['release'],
), /exactly one lockfile-pinned Chromium install/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: `        ${CODEMAGIC_FROZEN_INSTALL_COMMAND}\n        ${MOBILE_CONTRACT_COMMAND}\n`,
    extraDefinitions: `    browser: &browser\n      name: Browser\n      script: |\n        ${CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND}\n`,
    workflowScripts: '      - *browser\n      - *install\n',
  }),
  ['install'],
  ['release'],
), /exactly one lockfile-pinned Chromium install/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: validCodemagicInstallScript,
    workflowScripts: '',
  }),
  ['install'],
  ['release'],
), /release must execute/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: validCodemagicInstallScript,
    workflowScripts: `      - *install\n      - script: ${MOBILE_CONTRACT_COMMAND}\n`,
  }),
  ['install'],
  ['release'],
), /must belong to a parsed shared script/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: validCodemagicInstallScript,
    workflowScripts: '',
    workflowSuffix: '    artifacts:\n      - *install\n',
  }),
  ['install'],
  ['release'],
), /release must execute/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: validCodemagicInstallScript,
    workflowScripts: '',
    workflowSuffix: '    publishing:\n      scripts:\n        - *install\n',
  }),
  ['install'],
  ['release'],
), /release must execute/);
assert.throws(() => assertCodemagicMobileBrowserDependencies(
  codemagicBrowserFixture({
    installScript: validCodemagicInstallScript,
    extraDefinitions: `    browser: &browser\n      name: Browser\n      script: |\n        ${CODEMAGIC_PLAYWRIGHT_INSTALL_COMMAND}\n`,
    workflowScripts: '      - *install\n      - *browser\n',
  }),
  ['install'],
  ['release'],
), /execute exactly one lockfile-pinned Chromium install/);
const validCodemagicGradleCommands = (workflow) => [
  ...CODEMAGIC_GRADLE_REQUIRED_SEQUENCE,
  workflow === 'custodial-android'
    ? './gradlew --no-daemon --dependency-verification strict assembleRelease \\'
    : './gradlew --no-daemon --dependency-verification strict assembleRelease bundleRelease \\',
  '--no-build-cache --rerun-tasks',
  'cmp \\',
  '"../native-locks/android/$MZ_APP_EDITION/verification-metadata.xml" \\',
  'gradle/verification-metadata.xml',
];
const indentCodemagicFixtureCommands = (commands) =>
  `          #!/usr/bin/env bash\n${commands.map((command) => `          ${command}`).join('\n')}\n`;
const codemagicAndroidGradleFixture = ({
  workflowNames = CODEMAGIC_ANDROID_WORKFLOWS,
  mutateCommands = (commands) => commands,
  scriptStyle = '|',
  suffix = '',
} = {}) => `workflows:
${workflowNames.map((workflow) => `  ${workflow}:
    scripts:
      - *add_android
      - name: Build release
        script: ${scriptStyle}
${indentCodemagicFixtureCommands(mutateCommands(validCodemagicGradleCommands(workflow)))}      - *source_attestation
`).join('')}${suffix}`;
assert.doesNotThrow(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture(),
  CODEMAGIC_ANDROID_WORKFLOWS,
));
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.map((command) =>
      command === CODEMAGIC_GRADLE_TEMP_ASSIGNMENT
        ? 'gradle_user_home="$CM_BUILD_DIR/.gradle-strict-$PROJECT_BUILD_NUMBER"'
        : command),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /securely create exactly one isolated temporary Gradle home/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.filter((command) =>
      command !== 'trap cleanup_gradle_user_home EXIT'),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /clean its temporary Gradle home whenever the step exits/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    workflowNames: CODEMAGIC_ANDROID_WORKFLOWS.slice(0, 2),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /workflow inventory must remain explicit and non-vacuous/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => ['exit 0', ...commands],
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /without wrappers or trap changes/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.flatMap((command) =>
      command === 'GRADLE_USER_HOME="$gradle_user_home" \\'
        ? [command, '# continuation breaker']
        : [command]),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /blank or comment lines/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.flatMap((command) =>
      command === 'GRADLE_USER_HOME="$gradle_user_home" \\'
        ? [command, '']
        : [command]),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /blank or comment lines/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.map((command) =>
      command === 'GRADLE_USER_HOME="$gradle_user_home" \\'
        ? `${command} `
        : command),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /trailing whitespace/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.map((command) =>
      command === 'GRADLE_USER_HOME="$gradle_user_home" \\'
        ? `${command}\u00a0`
        : command),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /Unicode trailing whitespace/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.map((command) =>
      command === 'set -euo pipefail'
        ? `\u00a0${command}`
        : command),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /hidden leading whitespace/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => commands.filter((command) => ![
      'case "$gradle_user_home/" in',
      '"$checkout_root/"*)',
      'exit 1',
      ';;',
      'esac',
    ].includes(command)),
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /without wrappers or trap changes/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    suffix: 'artifacts:\n  - ./gradlew --dependency-verification strict assembleRelease\n',
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /must belong to a parsed workflow build step/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => [...commands, 'bash gradlew assembleRelease'],
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /must execute exactly one parsed Gradle release build/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({
    mutateCommands: (commands) => [...commands, 'trap - EXIT'],
  }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /without wrappers or trap changes/);
assert.throws(() => assertCodemagicAndroidGradleIsolation(
  codemagicAndroidGradleFixture({ scriptStyle: '>' }),
  CODEMAGIC_ANDROID_WORKFLOWS,
), /literal YAML shell semantics/);
const indentCodemagicSourceFixture = (commands) =>
  `        #!/usr/bin/env bash\n${commands.map((command) => `        ${command}`).join('\n')}\n`;
const codemagicSourceAttestationFixture = ({
  commands = VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS,
  extraDefinitions = '',
  scriptStyle = '|',
} = {}) => `definitions:
  scripts:
    source_attestation: &source_attestation
      name: Attest source
      script: ${scriptStyle}
${indentCodemagicSourceFixture(commands)}${extraDefinitions}workflows:
  release-android:
    scripts:
      - *source_attestation
`;
assert.doesNotThrow(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture(),
));
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({ scriptStyle: '>' }),
), /literal YAML shell semantics/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture().replace('\n        NODE\n', '\n          NODE\n'),
), /heredoc terminator must be the exact raw literal-scalar terminator/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture().replace('\n        NODE\n', '\n        \tNODE\n'),
), /hidden leading whitespace/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture().replace('\n        NODE\n', '\n        NODE \n'),
), /trailing whitespace/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({
    commands: VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS.map((command) =>
      command === CODEMAGIC_SOURCE_STATUS_ASSIGNMENT
        ? 'test -z "$(git status --porcelain=v1 --untracked-files=all)"'
        : command),
  }),
), /dirty-source status check must belong to the source-attestation script/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({
    commands: VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS.filter((command) => command !== 'exit 1'),
  }),
), /commit-bound evidence writer/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({
    commands: ['exit 0', ...VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS],
  }),
), /commit-bound evidence writer/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({
    commands: VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS.flatMap((command) =>
      command === CODEMAGIC_SOURCE_STATUS_ASSIGNMENT
        ? ['git diff --exit-code "$CM_COMMIT" -- .', command]
        : [command]),
  }),
), /must never print tracked file contents/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({
    commands: VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS.filter((command) =>
      command !== CODEMAGIC_SOURCE_STATUS_ASSIGNMENT),
    extraDefinitions: `    decoy: &decoy
      name: Decoy
      script: |
        ${CODEMAGIC_SOURCE_STATUS_ASSIGNMENT}
`,
  }),
), /dirty-source status check must belong to the source-attestation script/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({
    commands: VALID_CODEMAGIC_SOURCE_ATTESTATION_COMMANDS.flatMap((command) =>
      command === CODEMAGIC_SOURCE_STATUS_ASSIGNMENT
        ? ['SOURCE_TREE="$expected_tree" node --input-type=module <<\'EARLY\'', 'EARLY', command]
        : [command]),
  }),
), /must emit commit-exact evidence exactly once/);
assert.throws(() => assertCodemagicSourceAttestation(
  codemagicSourceAttestationFixture({
    commands: [...CODEMAGIC_SOURCE_ATTESTATION_SEQUENCE, 'NODE'],
  }),
), /commit-bound evidence writer/);
assertCodemagicAndroidGradleIsolation(codemagic, CODEMAGIC_ANDROID_WORKFLOWS);
assertCodemagicSourceAttestation(codemagic);
assertCodemagicMobileBrowserDependencies(
  codemagic,
  ['install'],
  ['manager-ios', 'viewer-ios', 'manager-android', 'custodial-android', 'viewer-android'],
);
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
  5,
  'Every Codemagic workflow must use Node 22.23.1 exactly',
);
assert.equal(
  [...codemagic.matchAll(/^\s+instance_type:\s*mac_mini_m2\s*$/gm)].length,
  5,
  'Every release workflow must remain on the personal-plan machine with free monthly minutes',
);
assert.doesNotMatch(
  codemagic,
  /^\s+instance_type:\s*(?:linux_x2|linux_x4|mac_mini_m4|windows_x2)\s*$/m,
  'Release workflows must not silently require a billing-enabled Codemagic instance',
);
assert.match(codemagic, /\bnpm ci --no-audit --no-fund\b/, 'Codemagic must use the root frozen workspace install');
assert.equal(
  [...codemagic.matchAll(/^\s+xcode:\s*['"]26\.4['"]\s*$/gm)].length,
  2,
  'Every retained Codemagic iOS workflow must pin Xcode 26.4',
);
assert.equal(
  [...codemagic.matchAll(/^\s+xcode:\s*['"]26\.2['"]\s*$/gm)].length,
  3,
  'Every Android workflow must pin the documented Xcode 26.2 image containing Build Tools 35.0.1',
);
assert.doesNotMatch(codemagic, /xcode:\s*latest/, 'Codemagic must not float on the latest Xcode image');
assert.match(codemagic, /git diff --exit-code -- chatscope-messenger\.js chatscope-messenger\.css/, 'Codemagic must reject ChatScope bundle drift');
assert.match(codemagic, /runtime-asset-manifest\.json/, 'Codemagic must verify runtime asset provenance');
assert.match(codemagic, /-native\.sha256/, 'Codemagic must checksum signed native artifacts');
assert.match(codemagic, /configure-android-backup\.mjs/, 'Codemagic must configure deny-all Android backup rules');
assert.match(codemagic, /verify-android-apk-backup\.mjs/, 'Codemagic must inspect backup controls in compiled APKs');
assert.match(codemagic, /verify-custodial-android-release\.mjs/, 'Codemagic must run structured Custodial APK acceptance');
assert.match(codemagic, /--build-tools-directory "\$ANDROID_SDK_ROOT\/build-tools\/35\.0\.1"/, 'Custodial acceptance must use the reviewed Build Tools directory');
assert.match(codemagic, /--runtime-directory mobile\/mobile-dist/, 'Codemagic must bind acceptance to its clean producer runtime tree');
assert.match(codemagic, /--build-workflow custodial-android/, 'Custodial acceptance must bind the literal production workflow');
assert.match(codemagic, /custodial-android-release-acceptance\.json/, 'Codemagic must preserve the Custodial acceptance record');
assert.match(codemagic, /custodial-android-toolchain\.json/, 'Codemagic must fail early on a substituted Android toolchain');
for (const digest of [
  '2ed636477a40fbc88670837c3ead484ce68b5da410eb408036416fd3ef2517d6',
  'b47549e373b895ce6ca620d0c7887e674d9615ffa837a86ac601dcfd04adb0f0',
  '00ef9948f843fe395d2440ae3ef41405b8040a6d5d46493bd1902ac0ee6deae7',
  '0c04fa35895adb7ed7af332918e82f9da3d6969b68ffcca1762a5640d7f1524e',
]) {
  assert.match(read('mobile/release-policies/custodial-android-build-tools-35.0.1-macos.json'), new RegExp(digest));
}
assert.match(
  codemagic,
  /source_status="\$\(git status --porcelain=v1 --untracked-files=all\)"/,
  'Codemagic must re-attest tracked and nonignored untracked source after building',
);
assert.match(codemagic, /walkEvidence\('build\/provenance'\)/, 'The final ledger must include every provenance file');
assert.doesNotMatch(codemagic, /^\s+triggering:\s*$/m, 'Codemagic release builds must remain manual-only');
assert.match(codemagic, /native-mobile-build-contract-tests\.mjs/, 'Codemagic must execute native source contracts');
assert.match(
  custodialReleaseVerifier,
  new RegExp(CUSTODIAL_SIGNER_SHA256),
  'Custodial release signing must remain pinned to the fleet update identity',
);
assert.doesNotMatch(codemagic, /Signer #1 certificate SHA-256 digest|grep[^\n]+Number of signers/, 'Codemagic must not replace structured signer acceptance with output grep');
assert.match(codemagic, /cap add ios --packagemanager SPM/, 'Codemagic must explicitly generate Capacitor iOS with SwiftPM');
assert.doesNotMatch(codemagic, /App\.xcworkspace/, 'Codemagic must not target the nonexistent Capacitor 8 workspace');
assert.equal(
  [...codemagic.matchAll(/xcode-project build-ipa \\\n\s+--project "\$CM_BUILD_DIR\/mobile\/ios\/App\/App\.xcodeproj"/g)].length,
  2,
  'the two store-distributed iOS workflows must archive the generated Xcode project',
);
for (const workflow of ['manager-ios', 'viewer-ios']) {
  const workflowSource = codemagic.match(new RegExp(`  ${workflow}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z-]+:\\n|$)`))?.[0] || '';
  assert.match(
    workflowSource,
    /instance_type: mac_mini_m2\n\s+integrations:\n\s+app_store_connect: memphis_zoo_app_store_connect\n\s+environment:/,
    `${workflow} must declare the App Store Connect integration required by integration publishing auth`,
  );
  assert.match(
    workflowSource,
    /publishing:\n\s+app_store_connect:\n\s+auth: integration/,
    `${workflow} must publish through the declared App Store Connect integration`,
  );
}
assert.match(codemagic, /PROJECT_BUILD_NUMBER/, 'Codemagic must apply a project-wide native build number');
assert.doesNotMatch(codemagic, /CM_BUILD_NUMBER/, 'Codemagic must not rely on a nonexistent CM_BUILD_NUMBER variable');
assert.match(codemagic, /signingConfig signingConfigs\.release|codemagic-release\.gradle/, 'Android release builds must wire the selected keystore into Gradle');
assert.equal(
  [...codemagic.matchAll(/--dependency-verification strict assembleRelease bundleRelease/g)].length,
  2,
  'Both store-distributed Android releases must enforce the reviewed dependency checksums',
);
assert.match(
  codemagic,
  /custodial-android:[\s\S]*--dependency-verification strict assembleRelease\s+\\\n[\s\S]*artifacts:\n\s+- mobile\/android\/app\/build\/outputs\/\*\*\/\*\.apk/,
  'Custodial must produce a private signed APK with strict dependency verification',
);
assert.match(
  codemagic,
  /7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172/,
  'Codemagic must verify the generated Gradle 8.14.3 wrapper JAR',
);
assert.match(
  codemagic,
  /native-locks\/android\/\$MZ_APP_EDITION\/verification-metadata\.xml/,
  'Codemagic must restore and compare the edition-specific Gradle verification metadata',
);
for (const verifier of ['apksigner', 'jarsigner', 'codesign --verify']) {
  assert.ok(codemagic.includes(verifier), `Codemagic must verify native signatures with ${verifier}`);
}
assert.match(
  codemagic,
  /verification_root="\$\(mktemp -d\)"[\s\S]*mktemp -d "\$verification_root\/ipa\.XXXXXX"/,
  'native verification must use a Bash 3.2-compatible scoped temporary root',
);
assert.doesNotMatch(
  codemagic,
  /verification_directories=\(\)|verification_directories\[@\]/,
  'native verification must not expand an empty Bash array under nounset on macOS',
);
assert.match(codemagic, /-onlyUsePackageVersionsFromResolvedFile/, 'Codemagic must enforce committed Swift package locks');
assert.match(codemagic, /MZ_REQUIRE_PINNED_FIREBASE_CONFIG: '1'/, 'release builds must reject mutable remote Firebase bytes');
assert.match(
  codemagic,
  /case "\$MZ_APP_EDITION" in[\s\S]*manager\)[\s\S]*expected_firebase_package='org\.memphiszoo\.ops'[\s\S]*configure-firebase\.mjs android[\s\S]*custodial\)[\s\S]*expected_firebase_package='org\.memphiszoo\.custodial'[\s\S]*configure-firebase\.mjs android[\s\S]*viewer\)[\s\S]*expected_firebase_package=''/,
  'Codemagic must inject the correct Firebase client into both notification-capable Android editions',
);
assert.match(
  codemagic,
  /packages\.includes\(process\.env\.EXPECTED_FIREBASE_PACKAGE\)/,
  'Codemagic must verify the Firebase package identifier before building',
);
assert.match(codemagic, /test ! -e android\/app\/google-services\.json/, 'Viewer builds must remain Firebase-free');
for (const workflow of [
  'manager-ios',
  'viewer-ios',
  'manager-android',
  'custodial-android',
  'viewer-android',
]) {
  assert.match(codemagic, new RegExp(`^  ${workflow}:$`, 'm'), `Codemagic must retain the ${workflow} signed build`);
}
assert.doesNotMatch(codemagic, /^  custodial-ios:$/m, 'Custodial must not have an Apple store workflow');
assert.match(codemagic, /-\s+memphis_zoo_custodial_keystore/, 'Custodial Android must use its own signing identity');
const custodialAndroid = codemagic.match(
  /^  custodial-android:\n([\s\S]*?)(?=^  [a-z][a-z-]+:\n|(?![\s\S]))/m,
)?.[0] || '';
assert.doesNotMatch(custodialAndroid, /google_play_credentials|bundleRelease|\.aab|publishing:|google_play:/, 'Custodial must remain an APK-only private deployment');
assert.match(
  custodialAndroid,
  /scripts:\n\s+- \*protected_main\n\s+- \*install\n\s+- \*custodial_android_toolchain/,
  'a clean Custodial checkout must install verifier dependencies before loading the pinned toolchain verifier',
);

for (const name of ['android-test-apks.yml', 'mobile-editions-build.yml']) {
  const source = workflows[name];
  assert.match(source, /push:\s*\n\s*branches:\s*\[main\]/, `${name} must build main`);
  for (const extension of supportedRuntimeExtensions) {
    const recursivePattern = `'**${extension}'`;
    const rootOnlyPattern = `'*${extension}'`;
    assert.equal(
      source.split(recursivePattern).length - 1,
      2,
      `${name} must trigger for root and nested ${extension} assets on pull requests and main pushes`,
    );
    assert.ok(
      !source.includes(rootOnlyPattern),
      `${name} must not use the root-only ${rootOnlyPattern} filter for runtime assets`,
    );
  }
  assert.equal(
    source.split("'**.txt'").length - 1,
    2,
    `${name} must trigger for root and nested text assets on pull requests and main pushes`,
  );
  assert.match(source, /cache-dependency-path:\s*package-lock\.json/, `${name} must cache from the root lockfile`);
  assert.match(source, /npm run --silent test:mobile/, `${name} must run mobile contracts`);
  assert.match(source, /npm run --silent test:batch-0a/, `${name} must run the Batch 0A baseline contracts`);
  assert.match(source, /node scripts\/runtime-manifest-contract-tests\.mjs/, `${name} must run runtime-manifest contracts`);
  assert.match(source, /node scripts\/ci-toolchain-contract-tests\.mjs/, `${name} must run CI toolchain contracts`);
  assert.match(source, /npm run --silent release:manifest:check/, `${name} must check release-manifest drift`);
  assert.match(source, /git diff --exit-code -- chatscope-messenger\.js chatscope-messenger\.css/, `${name} must reject ChatScope bundle drift`);
  assert.match(source, /runtime-asset-manifest\.json/, `${name} must verify runtime asset provenance`);
  if (name === 'android-test-apks.yml') {
    for (const nativeContractDependency of [
      'scripts/canonical-temporary-fixture.mjs',
      'scripts/test-support/canonical-temporary-fixture-fd-inner.mjs',
      'scripts/test-support/canonical-temporary-fixture-umask-inner.mjs',
      'scripts/canonical-temporary-fixture-tests.mjs',
      'scripts/custodial-android-manifest-security-contract-tests.mjs',
      'scripts/custodial-dex-semantic-verifier-tests.mjs',
      'scripts/custodial-runtime-source-verifier-tests.mjs',
      'scripts/immutable-file-snapshot-tests.mjs',
      'scripts/native-mobile-build-contract-tests.mjs',
    ]) {
      assert.equal(
        source.split(`'${nativeContractDependency}'`).length - 1,
        2,
        `${name} must trigger for ${nativeContractDependency} changes on pull requests and main pushes`,
      );
    }
    assert.match(source, /configure-android-backup\.mjs/, `${name} must configure deny-all Android backup rules`);
    assert.match(source, /verify-android-apk-backup\.mjs/, `${name} must inspect compiled APK backup controls`);
    assert.match(source, /native-mobile-build-contract-tests\.mjs/, `${name} must execute native source contracts`);
    assert.match(source, /--dependency-verification strict assembleDebug/, `${name} must checksum-verify debug dependencies`);
    assert.match(source, /--dependency-verification strict assembleRelease bundleRelease/, `${name} must checksum-verify release dependencies`);
    assert.match(source, /native-locks\/android\/\$MZ_APP_EDITION\/verification-metadata\.xml/, `${name} must restore the edition dependency lock`);
    assert.match(source, /configure-native-release\.mjs android-version/, `${name} must compile debug APKs with the embedded build number`);
    assert.match(source, /Debug APK compiled versionCode mismatch/, `${name} must inspect the compiled debug versionCode`);
    assert.match(source, /compiled-debug\.json/, `${name} must preserve compiled debug evidence`);
    assert.match(source, /sdkmanager --install 'build-tools;35\.0\.1' 'platforms;android-36'/, `${name} must install the exact compilation SDK`);
  }
}
assert.match(
  workflows['mobile-editions-build.yml'],
  /npm run --silent test:batch-0b:browser/,
  'The Batch 0B browser seam must block pull-request merges',
);
assert.match(
  workflows['whole-system-quality-gate.yml'],
  /npm run --silent build:batch-0b:browser-fixtures[\s\S]*playwright test/,
  'The whole-system browser matrix must build immutable Batch 0B fixtures first',
);

assert.match(
  workflows['custodial-production-repair.yml'],
  /npm run --silent test:accessibility:baseline/,
  'A pull-request gate must reject new serious or critical accessibility regressions before merge',
);

const playwrightConfig = read('playwright.config.js');
assert.doesNotMatch(playwrightConfig, /\bchannel:\s*['"]chrome['"]/, 'Playwright must not use the mutable system Chrome channel');
assert.match(playwrightConfig, /browserName:\s*['"]chromium['"]/, 'Playwright must use its exact package-managed Chromium');
assert.doesNotMatch(
  playwrightConfig,
  /executablePath|PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH/,
  'Committed Playwright gates must not bypass the package-managed Chromium binary',
);

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
