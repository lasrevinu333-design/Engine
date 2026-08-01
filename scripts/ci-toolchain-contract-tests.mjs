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
assert.match(codemagic, /git diff --exit-code "\$CM_COMMIT" -- \./, 'Codemagic must re-attest the tracked source after building');
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
