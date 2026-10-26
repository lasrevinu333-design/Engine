import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FRONTEND_DEPLOYMENT_MANIFEST_NAME,
  FRONTEND_MANIFEST_NAME,
  RUNTIME_ASSET_MANIFEST_NAME,
  assertCaseInsensitivePathUniqueness,
  createRuntimeAssetManifest,
  discoverRuntimeFiles,
  inspectBuildSourceState,
  resolveAppEdition,
  resolveBuildIdentity,
  verifyFrontendReleaseManifest,
  writeFrontendReleaseManifest,
  writeRuntimeAssetManifest,
} from './refresh-frontend-release-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Exact isolated TEST catalog binding. This grants no production or release admission.
const schemaCaptureBytes=readFileSync(resolve(root,'scripts/fixtures/current-schema-capture-binding.json'));
assert.equal(createHash('sha256').update(schemaCaptureBytes).digest('hex'),'0092dcd68b2e5bba9f2a09093a07d7a0710ead8caadd82b777332687dbda8205');
const schemaCapture=JSON.parse(schemaCaptureBytes);
assert.equal(schemaCapture.schema,'custodial.isolated-test-canonical-source-binding.v1');
assert.equal(schemaCapture.scope,'SAME_EXCLUSIVE_POST293_DATA_TEST_ONLY');
for(const flag of ['production','production_observation','production_applicability','independent_review','release_admission','frontend_pair_admission'])assert.equal(schemaCapture[flag],false);
assert.equal(schemaCapture.read_only_same_snapshot,true);
assert.equal(schemaCapture.ledger293_observed_by_this_reader,null);
assert.equal(schemaCapture.raw_rowstream.sha256,'937d920067b4c93ba2d702de21c02ba3c8504793c1c73d2c67d0166ed3abd595');
assert.equal(schemaCapture.normalized.sha256,'0684ddbdf2dbc6b850dc2463425fc4cf20764c3970d45bb74d08c8ba438e7560');
assert.equal(schemaCapture.catalog_module.sha256,'2d9a6c581d434630257fdb9c915bf196380af96d15af7185fb3f6d19a6cfafad');
assert.equal(schemaCapture.reader_adapter.sha256,'f3ccba542492ba1d35cfb580172ed23375e0e908e2d0b28ed595913ddfd4394b');
assert.equal(schemaCapture.catalog_sql.sha256,'939c887aa1cf727d6be654e08b187e4fefb40661baa38ee7670bb82d957570f1');
assert.equal(schemaCapture.catalog_summary.sha256,'f632981d6342fb1d5afeb4011b4f038479f0549404e63fef7d320cdbaabeb46d');
assert.equal(schemaCapture.Root_closed_actual_catalog.sha256,'16e16773b00f410d95be1c17afdf418972228b6e9f352fb698c1176534cacb7f');
assert.equal(schemaCapture.schema_fingerprint,'b849658718b36165fba18c67855933b4e131f9cee76cee8d9b3fe91208831548');
assert.equal(schemaCapture.source_query_sections,26);
assert.equal(schemaCapture.counts.tables,274);
assert.equal(schemaCapture.counts.functions,963);
const CANONICAL_SCHEMA_FINGERPRINT = schemaCapture.schema_fingerprint;
const PREVIOUS_SCHEMA_FINGERPRINT = 'b496c72630100da8173006aa34886c7868b3ead5bea43e056135df64cf53b4ce';
const ACTIVE_SCHEMA_TRANSITION = {
  "transition_id": "custodial-post293-test-20261025",
  "from_fingerprint": "b496c72630100da8173006aa34886c7868b3ead5bea43e056135df64cf53b4ce",
  "to_fingerprint": "b849658718b36165fba18c67855933b4e131f9cee76cee8d9b3fe91208831548",
  "expires_at": "2026-11-01T15:12:05Z"
};
assert.deepEqual(schemaCapture.schema_transition,ACTIVE_SCHEMA_TRANSITION);
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function createFrontendGitFixture({
  indexHtml = '<script src="./app.js"></script>\n',
  extraFiles = {},
  afterCommit,
} = {}) {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'memphis-frontend-git-fixture-'));
  writeFileSync(resolve(fixtureRoot, FRONTEND_MANIFEST_NAME), `${JSON.stringify({
    release_id: 'release-test',
    schema_fingerprint: CANONICAL_SCHEMA_FINGERPRINT,
    schema_transition: ACTIVE_SCHEMA_TRANSITION,
    asset_hashes_sha256: {},
  }, null, 2)}\n`);
  writeFileSync(resolve(fixtureRoot, FRONTEND_DEPLOYMENT_MANIFEST_NAME), `${JSON.stringify({
    release_id: 'release-test',
    source_commit: 'template',
  }, null, 2)}\n`);
  writeFileSync(resolve(fixtureRoot, 'index.html'), indexHtml);
  writeFileSync(resolve(fixtureRoot, 'app.js'), 'console.log("fixture");\n');
  for (const [path, content] of Object.entries(extraFiles)) {
    writeFileSync(resolve(fixtureRoot, path), content);
  }
  writeFrontendReleaseManifest(fixtureRoot);
  git(fixtureRoot, ['init', '-q']);
  git(fixtureRoot, ['add', '.']);
  git(fixtureRoot, ['-c', 'user.name=Frontend Runtime Fixture', '-c', 'user.email=frontend-runtime@example.invalid', 'commit', '-qm', 'fixture']);
  afterCommit?.(fixtureRoot);
  return fixtureRoot;
}

const frontendManifest = JSON.parse(readFileSync(resolve(root, FRONTEND_MANIFEST_NAME), 'utf8'));
const frontendDeploymentManifest = JSON.parse(
  readFileSync(resolve(root, FRONTEND_DEPLOYMENT_MANIFEST_NAME), 'utf8')
    .replace(/^---\r?\nlayout: null\r?\n---\r?\n/, ''),
);
const scanPageSource = readFileSync(resolve(root, 'index.html'), 'utf8');
const scanWorkerSource = readFileSync(resolve(root, 'memphis-scan-sync.js'), 'utf8');

assert.equal(
  frontendManifest.schema_fingerprint,
  CANONICAL_SCHEMA_FINGERPRINT,
  'the candidate frontend release must declare the exact source-captured backend schema fingerprint',
);
assert.equal(
  frontendDeploymentManifest.schema_fingerprint,
  CANONICAL_SCHEMA_FINGERPRINT,
  'the candidate deployment manifest must declare the exact source-captured backend schema fingerprint',
);
assert.deepEqual(frontendManifest.schema_transition, ACTIVE_SCHEMA_TRANSITION,
  'the release manifest must declare the exact active backend transition');
assert.deepEqual(frontendDeploymentManifest.schema_transition, ACTIVE_SCHEMA_TRANSITION,
  'the deployment manifest must declare the exact active backend transition');
assert.ok(
  scanPageSource.includes(`REQUIRED_BACKEND_SCHEMA_FINGERPRINT:"${CANONICAL_SCHEMA_FINGERPRINT}"`),
  'the employee scan page must require the exact manifest target schema',
);
assert.ok(
  scanWorkerSource.includes(`REQUIRED_BACKEND_SCHEMA_FINGERPRINT: '${CANONICAL_SCHEMA_FINGERPRINT}'`),
  'the durable scan worker must require the exact manifest target schema',
);
assert.ok(
  !scanPageSource.includes(`REQUIRED_BACKEND_SCHEMA_FINGERPRINT:"${PREVIOUS_SCHEMA_FINGERPRINT}"`)
    && !scanWorkerSource.includes(`REQUIRED_BACKEND_SCHEMA_FINGERPRINT: '${PREVIOUS_SCHEMA_FINGERPRINT}'`),
  'the transition source schema must never remain the runtime target',
);
const runtimeFiles = discoverRuntimeFiles(root);
const runtimeSet = new Set(runtimeFiles);
const requiredRoutesAndAssets = [
  'Background1_optimized.webp',
  'chatscope-messenger.css',
  'chatscope-messenger.js',
  'chatscope-mobile-overrides.css',
  'dashboard-bg_optimized.webp',
  'dashboard_tiger_icon.svg',
  'manager-ux.css',
  'memphis-alert-tone.wav',
  'messages-chatscope.html',
  'ops-viewer.css',
  'ops-viewer.html',
  'ops-viewer.js',
  'phone-assignments.css',
  'phone-assignments.html',
  'phone-assignments.js',
];

assert.deepEqual(runtimeFiles, [...runtimeFiles].sort(), 'runtime discovery must be sorted');
assert.equal(new Set(runtimeFiles).size, runtimeFiles.length, 'runtime discovery must not contain duplicates');
for (const path of requiredRoutesAndAssets) {
  assert.ok(runtimeSet.has(path), `runtime discovery omitted ${path}`);
}
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) {
    assert.ok(runtimeSet.has(entry.name), `top-level runtime route omitted ${entry.name}`);
  }
}
for (const deadOrDevelopmentFile of [
  'Dashboard_Avatar_ui.webp',
  'Guest_Issues_Icon_ui.webp',
  'messages-app.js',
  'messenger-runtime-patch.js',
  'messenger-app.css',
  'package-lock.json',
  'package.json',
  'playwright.config.js',
  'qrcode.LICENSE.txt',
  'qrcode.min.js',
]) {
  assert.ok(!runtimeSet.has(deadOrDevelopmentFile), `non-runtime file leaked into discovery: ${deadOrDevelopmentFile}`);
}
assert.ok(runtimeSet.has(FRONTEND_MANIFEST_NAME), 'the public release manifest must remain a runtime route');
assert.ok(runtimeSet.has(FRONTEND_DEPLOYMENT_MANIFEST_NAME), 'the public deployment manifest must remain a runtime route');

const frontendVerification = verifyFrontendReleaseManifest(root, { requireExactRuntimeTree: false });
assert.equal(frontendVerification.difference.sorted, true, 'frontend manifest asset keys must remain sorted');
assert.deepEqual(
  [...Object.keys(frontendVerification.asset_hashes_sha256)].sort(),
  Object.keys(frontendVerification.asset_hashes_sha256),
  'discovered frontend asset hashes must remain deterministically sorted',
);
if (frontendVerification.ok) {
  assert.deepEqual(
    Object.keys(frontendVerification.manifest.asset_hashes_sha256),
    Object.keys(frontendVerification.asset_hashes_sha256),
    'frontend manifest keys must exactly equal the discovered hash set when the manifest is current',
  );
}

const mismatchedSourceState = inspectBuildSourceState(
  root,
  '0123456789abcdef0123456789abcdef01234567',
);
const realSourceState = inspectBuildSourceState(root);
const failedStatusState = inspectBuildSourceState(root, realSourceState.head, (_file, args) => {
  if (args[0] === 'status') throw new Error('injected git status failure');
  if (args.join(' ') === 'rev-parse HEAD') return `${realSourceState.head}\n`;
  if (args.join(' ') === 'rev-parse HEAD^{tree}') return `${realSourceState.source_tree}\n`;
  throw new Error(`unexpected git command: ${args.join(' ')}`);
});
assert.equal(failedStatusState.source_commit_exact, false, 'git status failure must never label a build commit-exact');
assert.equal(failedStatusState.tracked_and_untracked_source_clean, false, 'git status failure must never label a build clean');
assert.deepEqual(
  resolveBuildIdentity({
    rootDirectory: root,
    edition: 'manager',
    environment: {
      MZ_RELEASE_ID: 'release-test',
      MZ_SOURCE_COMMIT: '0123456789abcdef0123456789abcdef01234567',
    },
  }),
  {
    release_id: 'release-test',
    source_commit: '0123456789abcdef0123456789abcdef01234567',
    source_tree: mismatchedSourceState.source_tree,
    source_commit_exact: false,
    build_id: 'release-test.manager.0123456789ab.dirty',
  },
);
assert.equal(resolveAppEdition(undefined), 'manager');
assert.equal(resolveAppEdition('  '), 'manager');
assert.equal(resolveAppEdition('CUSTODIAL'), 'custodial');
assert.throws(
  () => resolveAppEdition('managr'),
  /Unknown MZ_APP_EDITION "managr"/,
  'an unknown edition must never silently package Manager privileges',
);

const frontendContractRoot = mkdtempSync(resolve(tmpdir(), 'memphis-frontend-manifest-'));
try {
  writeFileSync(resolve(frontendContractRoot, FRONTEND_MANIFEST_NAME), `${JSON.stringify({
    release_id: 'release-test',
    asset_hashes_sha256: {},
  }, null, 2)}\n`);
  writeFileSync(resolve(frontendContractRoot, FRONTEND_DEPLOYMENT_MANIFEST_NAME), '{"source_commit":"template"}\n');
  writeFileSync(resolve(frontendContractRoot, 'index.html'), '<script src="./app.js"></script>\n');
  writeFileSync(resolve(frontendContractRoot, 'app.js'), 'console.log("one");\n');

  const written = writeFrontendReleaseManifest(frontendContractRoot);
  assert.equal(written.ok, true);
  assert.deepEqual(Object.keys(written.asset_hashes_sha256), ['app.js', 'index.html']);

  writeFileSync(resolve(frontendContractRoot, 'app.js'), 'console.log("changed");\n');
  const staleHash = verifyFrontendReleaseManifest(frontendContractRoot);
  assert.equal(staleHash.ok, false);
  assert.deepEqual(staleHash.difference.hash_mismatches.map(({ file }) => file), ['app.js']);

  const refreshed = writeFrontendReleaseManifest(frontendContractRoot);
  const withUnexpected = {
    ...refreshed.manifest,
    asset_hashes_sha256: {
      ...refreshed.manifest.asset_hashes_sha256,
      'not-runtime.js': '0'.repeat(64),
    },
  };
  writeFileSync(resolve(frontendContractRoot, FRONTEND_MANIFEST_NAME), `${JSON.stringify(withUnexpected, null, 2)}\n`);
  const unexpected = verifyFrontendReleaseManifest(frontendContractRoot);
  assert.equal(unexpected.ok, false);
  assert.deepEqual(unexpected.difference.unexpected, ['not-runtime.js']);
} finally {
  rmSync(frontendContractRoot, { recursive: true, force: true });
}

const exactRuntimeFixture = createFrontendGitFixture();
try {
  const exactVerification = verifyFrontendReleaseManifest(exactRuntimeFixture);
  assert.equal(exactVerification.ok, true, 'a committed frontend runtime fixture must verify against its exact source tree');
  const exactState = inspectBuildSourceState(exactRuntimeFixture, git(exactRuntimeFixture, ['rev-parse', 'HEAD']));
  assert.equal(exactState.source_commit_exact, true, 'an exact frontend fixture must report exact source identity');
  assert.equal(exactState.tracked_and_untracked_source_clean, true, 'an exact frontend fixture must report a clean source tree');
} finally {
  rmSync(exactRuntimeFixture, { recursive: true, force: true });
}

const skipWorktreeFixture = createFrontendGitFixture();
try {
  git(skipWorktreeFixture, ['update-index', '--skip-worktree', 'app.js']);
  assert.throws(
    () => verifyFrontendReleaseManifest(skipWorktreeFixture),
    /skip-worktree index flag is forbidden: app\.js/,
    'frontend manifest verification must reject hidden skip-worktree runtime bytes',
  );
  const state = inspectBuildSourceState(skipWorktreeFixture, git(skipWorktreeFixture, ['rev-parse', 'HEAD']));
  assert.equal(state.source_commit_exact, false, 'skip-worktree runtime bytes must never report exact source identity');
  assert.equal(state.tracked_and_untracked_source_clean, false, 'skip-worktree runtime bytes must never report clean source identity');
} finally {
  rmSync(skipWorktreeFixture, { recursive: true, force: true });
}

const viewerBuildFixtureParent = mkdtempSync(resolve(tmpdir(), 'memphis-viewer-build-skip-worktree-'));
const viewerBuildFixture = resolve(viewerBuildFixtureParent, 'source');
try {
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', root, viewerBuildFixture], { encoding: 'utf8' });
  copyFileSync(
    resolve(root, 'mobile', 'scripts', 'build.mjs'),
    resolve(viewerBuildFixture, 'mobile', 'scripts', 'build.mjs'),
  );
  git(viewerBuildFixture, ['add', 'mobile/scripts/build.mjs']);
  const stagedBuild = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: viewerBuildFixture });
  assert.ok([0, 1].includes(stagedBuild.status), 'the viewer fixture must inspect its staged build source');
  if (stagedBuild.status === 1) {
    git(viewerBuildFixture, [
      '-c', 'user.name=Frontend Runtime Fixture',
      '-c', 'user.email=frontend-runtime@example.invalid',
      'commit', '-qm',
      'exercise current viewer provenance gate',
    ]);
  }
  writeFileSync(resolve(viewerBuildFixture, '.git', 'info', 'exclude'), '\nnode_modules\nmobile/node_modules\n', { flag: 'a' });
  symlinkSync(resolve(root, 'node_modules'), resolve(viewerBuildFixture, 'node_modules'), 'dir');
  symlinkSync(resolve(root, 'mobile', 'node_modules'), resolve(viewerBuildFixture, 'mobile', 'node_modules'), 'dir');
  assert.equal(
    git(viewerBuildFixture, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored=no', '--', '.']),
    '',
    'the viewer provenance fixture must be clean before the hidden mutation is applied',
  );
  git(viewerBuildFixture, ['update-index', '--skip-worktree', 'mobile/src/viewer/app.js']);
  writeFileSync(
    resolve(viewerBuildFixture, 'mobile', 'src', 'viewer', 'app.js'),
    '// hidden viewer mutation\n',
  );
  const sourceCommit = git(viewerBuildFixture, ['rev-parse', 'HEAD']);
  const build = spawnSync(process.execPath, ['mobile/scripts/build.mjs'], {
    cwd: viewerBuildFixture,
    encoding: 'utf8',
    env: {
      ...process.env,
      MZ_APP_EDITION: 'viewer',
      MZ_CUSTODIAL_BROWSER_TEST: '1',
      MZ_MOBILE_DIST: 'build/batch-0b-shell-browser/viewer',
      MZ_SOURCE_COMMIT: sourceCommit,
    },
    timeout: 180_000,
  });
  assert.notEqual(build.status, 0, 'a hidden viewer source mutation must fail before packaging');
  assert.match(
    `${build.stdout}\n${build.stderr}`,
    /Refusing viewer build without exact source commit, tree, runtime bytes, modes, and index flags/,
    'viewer must fail closed instead of emitting a dirty build identity',
  );
  assert.equal(
    existsSync(resolve(viewerBuildFixture, 'build', 'batch-0b-shell-browser', 'viewer')),
    false,
    'viewer provenance rejection must happen before distribution output is created',
  );
} finally {
  rmSync(viewerBuildFixtureParent, { recursive: true, force: true });
}

const ignoredRuntimeFixture = createFrontendGitFixture({
  indexHtml: '<script src="./ignored-runtime.js"></script>\n',
  extraFiles: {
    'ignored-runtime.js': 'console.log("ignored");\n',
  },
  afterCommit(fixtureRoot) {
    writeFileSync(resolve(fixtureRoot, '.gitignore'), 'ignored-runtime.js\n');
    git(fixtureRoot, ['rm', '--cached', 'ignored-runtime.js']);
    git(fixtureRoot, ['add', '.gitignore']);
    git(fixtureRoot, ['-c', 'user.name=Frontend Runtime Fixture', '-c', 'user.email=frontend-runtime@example.invalid', 'commit', '-qm', 'track gitignore']);
  },
});
try {
  assert.throws(
    () => verifyFrontendReleaseManifest(ignoredRuntimeFixture),
    /Discovered frontend runtime path is not a tracked regular file in the exact source tree: ignored-runtime\.js/,
    'frontend manifest verification must reject ignored runtime bytes referenced by committed source',
  );
  const state = inspectBuildSourceState(ignoredRuntimeFixture, git(ignoredRuntimeFixture, ['rev-parse', 'HEAD']));
  assert.equal(state.source_commit_exact, false, 'ignored referenced runtime bytes must never report exact source identity');
  assert.equal(state.tracked_and_untracked_source_clean, false, 'ignored referenced runtime bytes must never report clean source identity');
} finally {
  rmSync(ignoredRuntimeFixture, { recursive: true, force: true });
}

const missingReferenceRoot = mkdtempSync(resolve(tmpdir(), 'memphis-missing-runtime-reference-'));
try {
  writeFileSync(resolve(missingReferenceRoot, FRONTEND_MANIFEST_NAME), `${JSON.stringify({
    release_id: 'release-test',
    asset_hashes_sha256: {},
  }, null, 2)}\n`);
  writeFileSync(resolve(missingReferenceRoot, FRONTEND_DEPLOYMENT_MANIFEST_NAME), '{"source_commit":"template"}\n');
  writeFileSync(resolve(missingReferenceRoot, 'index.html'), [
    '<a href="#local-anchor">Anchor</a>',
    '<img src="data:image/png;base64,AAAA">',
    '<script src="https://example.test/external.js"></script>',
    '<script src="./missing-runtime.js"></script>',
  ].join('\n'));
  assert.throws(
    () => discoverRuntimeFiles(missingReferenceRoot),
    /Missing local runtime reference "missing-runtime\.js" from "index\.html"/,
    'a missing local supported runtime reference must fail discovery',
  );
  assert.throws(
    () => verifyFrontendReleaseManifest(missingReferenceRoot),
    /Missing local runtime reference "missing-runtime\.js" from "index\.html"/,
    'a missing local supported runtime reference must fail manifest verification',
  );
} finally {
  rmSync(missingReferenceRoot, { recursive: true, force: true });
}

const rootRelativeReferenceRoot = mkdtempSync(resolve(tmpdir(), 'memphis-root-relative-runtime-reference-'));
try {
  mkdirSync(resolve(rootRelativeReferenceRoot, 'nested'));
  writeFileSync(resolve(rootRelativeReferenceRoot, FRONTEND_MANIFEST_NAME), `${JSON.stringify({
    release_id: 'release-test',
    asset_hashes_sha256: {},
  }, null, 2)}\n`);
  writeFileSync(resolve(rootRelativeReferenceRoot, FRONTEND_DEPLOYMENT_MANIFEST_NAME), '{"source_commit":"template"}\n');
  writeFileSync(resolve(rootRelativeReferenceRoot, 'index.html'), '<iframe src="./nested/page.html"></iframe>\n');
  writeFileSync(resolve(rootRelativeReferenceRoot, 'nested/page.html'), '<script src="/root.js"></script>\n');
  writeFileSync(resolve(rootRelativeReferenceRoot, 'root.js'), 'console.log("root");\n');
  assert.deepEqual(
    discoverRuntimeFiles(rootRelativeReferenceRoot),
    [
      FRONTEND_DEPLOYMENT_MANIFEST_NAME,
      FRONTEND_MANIFEST_NAME,
      'index.html',
      'nested/page.html',
      'root.js',
    ].sort(),
    'a browser root-relative URL from a nested page must resolve from the runtime root',
  );
} finally {
  rmSync(rootRelativeReferenceRoot, { recursive: true, force: true });
}

const frontendCaseCollisionRoot = mkdtempSync(resolve(tmpdir(), 'memphis-frontend-case-collision-'));
try {
  writeFileSync(resolve(frontendCaseCollisionRoot, FRONTEND_MANIFEST_NAME), `${JSON.stringify({
    release_id: 'release-test',
    asset_hashes_sha256: {},
  }, null, 2)}\n`);
  writeFileSync(resolve(frontendCaseCollisionRoot, FRONTEND_DEPLOYMENT_MANIFEST_NAME), '{"source_commit":"template"}\n');
  writeFileSync(
    resolve(frontendCaseCollisionRoot, 'index.html'),
    '<script src="./Runtime.js"></script><script src="./runtime.js"></script>\n',
  );
  writeFileSync(resolve(frontendCaseCollisionRoot, 'Runtime.js'), 'console.log("upper");\n');
  writeFileSync(resolve(frontendCaseCollisionRoot, 'runtime.js'), 'console.log("lower");\n');
  assert.throws(
    () => discoverRuntimeFiles(frontendCaseCollisionRoot),
    /case-insensitive path collisions: Runtime\.js <> runtime\.js/,
    'frontend discovery must reject case-insensitive path collisions',
  );
} finally {
  rmSync(frontendCaseCollisionRoot, { recursive: true, force: true });
}

const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'memphis-runtime-manifest-'));
try {
  mkdirSync(resolve(temporaryRoot, 'nested'));
  writeFileSync(resolve(temporaryRoot, 'a.txt'), 'alpha\n');
  writeFileSync(resolve(temporaryRoot, 'nested/b.js'), 'console.log("beta");\n');
  const identity = {
    release_id: 'release-test',
    source_commit: '0123456789abcdef0123456789abcdef01234567',
    source_tree: '89abcdef0123456789abcdef0123456789abcdef',
    source_commit_exact: true,
    build_id: 'release-test.manager.0123456789ab',
  };
  const options = { directory: temporaryRoot, edition: 'manager', identity };
  const first = writeRuntimeAssetManifest(options);
  const firstBytes = readFileSync(resolve(temporaryRoot, RUNTIME_ASSET_MANIFEST_NAME), 'utf8');
  const second = writeRuntimeAssetManifest(options);
  const secondBytes = readFileSync(resolve(temporaryRoot, RUNTIME_ASSET_MANIFEST_NAME), 'utf8');

  assert.deepEqual(first, second, 'runtime manifest generation must be deterministic');
  assert.equal(firstBytes, secondBytes, 'runtime manifest bytes must be deterministic');
  assert.equal(first.asset_count, 2);
  assert.deepEqual(Object.keys(first.asset_hashes_sha256), ['a.txt', 'nested/b.js']);
  assert.ok(!Object.hasOwn(first.asset_hashes_sha256, RUNTIME_ASSET_MANIFEST_NAME));
  assert.deepEqual(createRuntimeAssetManifest(options), first);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

assert.throws(
  () => assertCaseInsensitivePathUniqueness(['Asset.js', 'asset.js'], 'Built distribution paths'),
  /case-insensitive path collisions: Asset\.js <> asset\.js/,
  'built distributions must reject case-insensitive path collisions independent of host filesystem semantics',
);

console.log(JSON.stringify({
  ok: true,
  runtime_file_count: runtimeFiles.length,
  frontend_asset_count: Object.keys(frontendVerification.asset_hashes_sha256).length,
  required_route_and_asset_count: requiredRoutesAndAssets.length,
}, null, 2));
