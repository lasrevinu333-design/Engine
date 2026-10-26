import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  assertCustodialAcceptanceSchema,
  runNormalForwardSourceAdmission,
  createCustodialAndroidReleaseAcceptance,
  parseCustodialArtifactArguments,
  CUSTODIAL_ANDROID_RELEASE_POLICY,
  CUSTODIAL_ANDROID_TOOLCHAIN_POLICY,
} from './verify-custodial-android-release.mjs';
import { loadReviewedForwardBuild, assertReviewedForwardBuild, parseForwardBuildArguments } from './configure-native-release.mjs';
import { custodialNativeVaultSourceDigest } from './custodial-native-vault-source.mjs';

function mergeFixture(left, right) {
  if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map((key) => [
      key,
      Object.hasOwn(left, key) && Object.hasOwn(right, key) ? mergeFixture(left[key], right[key]) : (right[key] ?? left[key]),
    ]));
  }
  return structuredClone(right);
}

function schemaFixture(node, root) {
  if (node.$ref) {
    let referenced = root;
    for (const part of node.$ref.replace(/^#\//, '').split('/')) referenced = referenced[part];
    return schemaFixture(referenced, root);
  }
  if (Array.isArray(node.allOf) && node.type !== 'object') return node.allOf.reduce((value, part) => mergeFixture(value, schemaFixture(part, root)), {});
  if (Array.isArray(node.anyOf) || Array.isArray(node.oneOf)) return schemaFixture((node.anyOf || node.oneOf)[0], root);
  if (Object.hasOwn(node, 'const')) return structuredClone(node.const);
  if (Array.isArray(node.enum)) return structuredClone(node.enum[0]);
  if (node.type === 'object') return Object.fromEntries((node.required || []).map((name) => [name, schemaFixture(node.properties[name], root)]));
  if (node.type === 'array') {
    if (Array.isArray(node.prefixItems)) return node.prefixItems.map((item) => schemaFixture(item, root));
    if (node.contains) return [schemaFixture(node.contains, root)];
    return Array.from({ length: node.minItems || 0 }, () => schemaFixture(node.items, root));
  }
  if (node.type === 'integer' || node.type === 'number') return node.minimum ?? 1;
  if (node.type === 'boolean') return false;
  if (node.type === 'string') {
    if (node.format === 'date-time') return '2026-08-02T01:12:03.000Z';
    const pattern = String(node.pattern || '');
    if (pattern.includes('{64}')) return H;
    if (pattern.includes('{40,64}')) return C;
    if (pattern.includes('classes')) return 'classes.dex';
    if (pattern.startsWith('^0x')) return '0x7f010001';
    if (pattern.startsWith('^xml/')) return 'xml/fixture';
    if (pattern.startsWith('^res/')) return 'res/xml/fixture.xml';
    if (pattern.startsWith('^[A-Za-z0-9]')) return '1234567890abcdef12345678';
    return 'fixture';
  }
  return null;
}

const H='a'.repeat(64); const C='b'.repeat(40); const T='c'.repeat(40); const packageName='org.memphiszoo.custodial';
const source=ref=>({ref,commit:C,tree:T}); const descriptor=(version,ref)=>({version_code:version,package_name:packageName,signer_certificate_sha256:H,signer_public_key_sha256:H,source:source(ref),artifact_sha256:H,schema_sha256:H,native_sha256:H,runtime_sha256:H});
const store=name=>({status:'compatible',schema:`custodial.${name}.v2`,provenance_sha256:H,source:source('refs/heads/retained-source')});
const retained={schema_version:1,source_pair:{frontend_commit:C,frontend_tree:T,backend_commit:C,backend_tree:T},enrollment:store('enrollment'),protected_pending:store('protected-pending'),history:store('history'),crypto:store('crypto'),reset_or_downgrade_forbidden:true};
const trusted={schema_version:1,policy_generation:'post56-v2-reviewed',target_id:'target-installed-56',package_name:packageName,signer_certificate_sha256:H,signer_public_key_sha256:H,installed_target:descriptor(56,'refs/tags/installed-56-source'),candidate:descriptor(57,'refs/heads/candidate-source'),recovery:descriptor(58,'refs/heads/recovery-source'),retained_store_compatibility:retained,evidence_refs:{baseline_receipt_sha256:H,candidate_source_receipt_sha256:H,recovery_source_receipt_sha256:H,retained_data_plan_sha256:H},legacy_policy:{highest_fleet_version_code:29,minimum_next_version_code:30,maximum_candidate_version_code_for_staged_recovery:31}};
const input=()=>({schema_version:1,policy_generation:trusted.policy_generation,purpose:'source_compatibility_diagnostic',fleet_promotion:false,scope:'one_explicit_target_only',target_id:trusted.target_id,installed_target:structuredClone(trusted.installed_target),candidate:structuredClone(trusted.candidate),recovery:structuredClone(trusted.recovery),retained_store_compatibility:structuredClone(retained),evidence_refs:structuredClone(trusted.evidence_refs)});
async function invoke(sourceValue=input(),pinsValue=trusted) { const root=await mkdtemp(join(tmpdir(),'custodial-normal-verifier-')); const sp=join(root,'source.json'); const tp=join(root,'trusted.json'); await writeFile(sp,JSON.stringify({schema_version:1,kind:'custodial.forward-source-admission-input.v1',source_only:true,activation:false,adapter_input:sourceValue})); await writeFile(tp,JSON.stringify({schema_version:1,kind:'custodial.forward-source-trusted-pins.v1',external_trusted_pins:pinsValue})); let output=''; const oldLog=console.log; const oldExit=process.exitCode; process.exitCode=undefined; console.log=(...args)=>{output+=args.join(' ');}; try { await runNormalForwardSourceAdmission(['--source-input',sp,'--trusted-pins',tp]); } finally { console.log=oldLog; process.exitCode=oldExit; await rm(root,{recursive:true,force:true}); } return JSON.parse(output); }

test('normal verifier source-only branch consumes pinned adapter DTO without admission',async()=>{const r=await invoke(); assert.equal(r.source_only,true); assert.equal(r.activation,false); assert.equal(r.result.accepted,true); assert.equal(r.result.source_ready,true); assert.equal(r.result.admitted,false); assert.equal(r.result.install_ready,false);});
test('normal verifier rejects source/trusted binding mismatch and incomplete evidence',async()=>{const bad=structuredClone(input()); bad.candidate.source.commit='d'.repeat(40); const r=await invoke(bad); assert.equal(r.result.accepted,false); assert.match(r.result.reason,/candidate_trusted_binding_mismatch/); const missing=structuredClone(trusted); delete missing.evidence_refs.recovery_source_receipt_sha256; const q=await invoke(input(),missing); assert.equal(q.result.accepted,false);});
test('installed56 cannot ordinary-upgrade to 30 and false promotion is mandatory',async()=>{const bad=structuredClone(input()); bad.candidate.version_code=30; bad.candidate.source=source('refs/heads/candidate-source'); const pins=structuredClone(trusted); pins.candidate.version_code=30; pins.candidate.source=source('refs/heads/candidate-source'); const r=await invoke(bad,pins); assert.equal(r.result.accepted,false); assert.match(r.result.reason,/candidate_not_forward_of_observed_installed/); const promoted=structuredClone(input()); promoted.fleet_promotion=true; const p=await invoke(promoted); assert.equal(p.result.accepted,false); assert.match(p.result.reason,/fleet_promotion/);});
test('missing adapter evidence cannot be masked by accepted or activation fields',async()=>{const bad=structuredClone(input()); bad.activation=true; delete bad.evidence_refs.retained_data_plan_sha256; const r=await invoke(bad); assert.equal(r.result.accepted,false); assert.equal(r.result.admitted,false);});
test('legacy configure tail is unchanged and normal verifier branch is guarded before APK parsing',async()=>{const configure=await readFile(new URL('./configure-native-release.mjs',import.meta.url),'utf8'); const marker="  if (!['android', 'android-version', 'android-wrapper', 'ios'].includes(platform))"; assert.equal(createHash('sha256').update(configure.slice(configure.indexOf(marker))).digest('hex'),'9e5abdd1f10cc1a06c213662cec05446cc451a453def3e1058946c88d31eb552'); const verifier=await readFile(new URL('./verify-custodial-android-release.mjs',import.meta.url),'utf8'); assert.ok(verifier.indexOf("if (process.argv[2] === 'forward-source')") < verifier.indexOf('const args = parseArguments(process.argv.slice(2));'));});
test('source-only verifier result never claims artifact, install, recovery, or physical readiness',async()=>{const r=await invoke(); assert.equal(r.result.qualified_artifact,false); assert.equal(r.result.operationally_qualified,false); assert.equal(r.result.admitted,false); assert.equal(r.result.install_ready,false); assert.equal(r.result.physical_recovery_proven,false);});

test('public synchronous acceptance-schema export uses locked AJV for invalid and valid fixtures',async()=>{
  assert.throws(() => assertCustodialAcceptanceSchema({}), /Custodial acceptance does not satisfy its committed schema/);
  const schema = JSON.parse(await readFile(new URL('./custodial-android-release-acceptance.schema.json', import.meta.url), 'utf8'));
  const fixture = schemaFixture(schema, schema);
  fixture.backup.legacy_resource.logical_name = 'xml/memphis_zoo_backup_rules';
  fixture.backup.data_extraction_resource.logical_name = 'xml/memphis_zoo_data_extraction_rules';
  fixture.native_security.webview_executable_sha256 = { 'assets/public/index.html': H };
  fixture.native_security.dex_sha256 = { 'classes.dex': H };
  fixture.tools.node.version = 'v22.23.1';
  assert.equal(assertCustodialAcceptanceSchema(fixture), true);
});

// Synthetic compiled metadata below exercises the existing creator, not an APK,
// signature, admission, installation or physical-device execution.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const productRoot = new URL('../../', import.meta.url).pathname;
const git = (root, ...args) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
};
async function reviewedFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'custodial-forward-product-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, 'source'); await mkdir(join(repo, 'mobile/scripts'), { recursive: true });
  await cp(new URL('./custodial-android-release-acceptance.schema.json', import.meta.url), join(repo, 'mobile/scripts/custodial-android-release-acceptance.schema.json'));
  await cp(new URL('../plugins/custodial-native-vault', import.meta.url), join(repo, 'mobile/plugins/custodial-native-vault'), { recursive: true });
  git(repo, 'init', '-q', '-b', 'main'); git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Synthetic source fixture', '-c', 'user.email=fixture@invalid', 'commit', '-qm', 'Synthetic source fixture, not reviewed product');
  const sourceIdentity = { ref: 'refs/heads/main', commit: git(repo, 'rev-parse', 'HEAD'), tree: git(repo, 'rev-parse', 'HEAD^{tree}') };
  const pins = structuredClone(trusted);
  pins.signer_certificate_sha256 = CUSTODIAL_ANDROID_RELEASE_POLICY.fleet_signer_sha256;
  pins.signer_public_key_sha256 = CUSTODIAL_ANDROID_RELEASE_POLICY.fleet_signer_public_key_sha256;
  for (const key of ['installed_target', 'candidate', 'recovery']) {
    pins[key].signer_certificate_sha256 = pins.signer_certificate_sha256;
    pins[key].signer_public_key_sha256 = pins.signer_public_key_sha256;
  }
  pins.candidate.source = sourceIdentity;
  pins.recovery.source = { ...sourceIdentity, ref: 'refs/heads/release/synthetic-forward-recovery' };
  for (const key of ['candidate', 'recovery']) {
    pins[key].artifact_sha256 = null; pins[key].runtime_sha256 = null;
    pins[key].schema_sha256 = hash(await readFile(join(repo, 'mobile/scripts/custodial-android-release-acceptance.schema.json')));
    pins[key].native_sha256 = custodialNativeVaultSourceDigest(join(repo, 'mobile/plugins/custodial-native-vault'));
  }
  Object.assign(pins.retained_store_compatibility.source_pair, { frontend_commit: sourceIdentity.commit, frontend_tree: sourceIdentity.tree });
  const evidence_files = {};
  for (const storeName of ['enrollment', 'protected_pending', 'history', 'crypto']) {
    const bytes = Buffer.from(`SYNTHETIC REVIEW RECORD: ${storeName}; not actual retained data\n`);
    const path = join(root, `${storeName}.txt`); await writeFile(path, bytes);
    pins.retained_store_compatibility[storeName].provenance_sha256 = hash(bytes);
    evidence_files[storeName] = path;
  }
  for (const name of Object.keys(pins.evidence_refs)) {
    const bytes = Buffer.from(name === 'retained_data_plan_sha256' ? JSON.stringify(pins.retained_store_compatibility) : `SYNTHETIC REVIEW RECORD: ${name}; not actual execution\n`);
    const path = join(root, `${name}.json`); await writeFile(path, bytes);
    pins.evidence_refs[name] = hash(bytes); evidence_files[name] = path;
  }
  const value = input(); Object.assign(value, { purpose: 'build_preparation', installed_target: pins.installed_target, candidate: pins.candidate, recovery: pins.recovery, retained_store_compatibility: pins.retained_store_compatibility, evidence_refs: pins.evidence_refs });
  const inputPath = join(root, 'input.json'); const pinsPath = join(root, 'reviewed-pins.json');
  const envelope = { schema_version: 1, kind: 'custodial.forward-build-reviewed-pins.v1', external_trusted_pins: pins, evidence_files };
  const flags = { '--forward-source-input': inputPath, '--forward-trusted-pins': pinsPath, '--forward-trusted-pins-sha256': '', '--forward-role': 'candidate' };
  const save = async () => {
    await writeFile(inputPath, JSON.stringify({ schema_version: 1, kind: 'custodial.forward-source-admission-input.v1', source_only: true, activation: false, adapter_input: value }));
    const bytes = Buffer.from(JSON.stringify(envelope)); await writeFile(pinsPath, bytes); flags['--forward-trusted-pins-sha256'] = hash(bytes);
  };
  await save(); return { root, repo, pins, value, flags, envelope, save };
}
async function syntheticCreatorInput(context) {
  const schema = JSON.parse(await readFile(new URL('./custodial-android-release-acceptance.schema.json', import.meta.url), 'utf8'));
  const f = schemaFixture(schema, schema); const d = context.descriptor;
  f.backup.legacy_resource.logical_name = 'xml/memphis_zoo_backup_rules';
  f.backup.data_extraction_resource.logical_name = 'xml/memphis_zoo_data_extraction_rules';
  // Distinct synthetic compiled resources; no real APK/resource proof.
  f.backup.legacy_resource.id = '0x7f010001';
  f.backup.data_extraction_resource.id = '0x7f010002';
  f.artifact.file_name = 'synthetic-not-a-real-build.apk';
  f.native_security.webview_executable_sha256 = { 'assets/public/index.html': H };
  f.native_security.dex_sha256 = { 'classes.dex': H };
  f.tools.node.version = 'v22.23.1'; f.tools.android_build_tools_platform = CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.platform;
  for (const [name, path] of Object.entries({ aapt2: 'aapt2', apksigner: 'apksigner', apksigner_jar: 'lib/apksigner.jar', source_properties: 'source.properties', zipalign: 'zipalign' })) f.tools[name].sha256 = CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.installed_files_sha256[path];
  f.verifier.release_policy_sha256 = CUSTODIAL_ANDROID_RELEASE_POLICY.sha256;
  f.verifier.toolchain_policy_sha256 = CUSTODIAL_ANDROID_TOOLCHAIN_POLICY.sha256;
  f.verifier.acceptance_schema_sha256 = d.schema_sha256;
  Object.assign(f.application, { version_code: d.version_code });
  Object.assign(f.embedded_provenance, { source_commit: d.source.commit, source_tree: d.source.tree, native_build_number: d.version_code, custodial_native_vault_source_sha256: d.native_sha256 });
  return { generatedAt: f.generated_at, artifact: f.artifact, application: f.application, embeddedProvenance: f.embedded_provenance, sourceCommit: d.source.commit, sourceTree: d.source.tree, sourceRef: d.source.ref, buildRun: f.build.run_id, buildWorkflow: f.build.workflow, buildNumber: d.version_code, signing: f.signing, alignment: f.alignment, backup: f.backup, androidManifestSecurity: f.android_manifest_security, nativeSecurity: f.native_security, tools: f.tools, verifier: f.verifier, forwardBuild: context };
}
test('product forward owning creator reaches greater-than56 only with independently loaded context; compiled checks remain', async t => {
  const f = await reviewedFixture(t); const context = await loadReviewedForwardBuild(f.flags, { buildNumber: 57, repositoryDirectory: f.repo });
  const args = await syntheticCreatorInput(context);
  assert.throws(() => createCustodialAndroidReleaseAcceptance({ ...args, forwardBuild: null }), /must not outrun staged recovery/);
  assert.throws(() => createCustodialAndroidReleaseAcceptance({ ...args, forwardBuild: structuredClone(context) }), /not loaded/);
  const acceptance = createCustodialAndroidReleaseAcceptance(args);
  assert.equal(acceptance.application.version_code, 57); assert.equal(acceptance.build.highest_fleet_version_code, 29);
  assert.equal(acceptance.forward_transition.installation_admitted, false); assert.equal(acceptance.forward_transition.physical_verified, false);
  for (const [key, mutate, pattern] of [
    ['signing', v => { v.signer_sha256 = H; }, /signer proof/],
    ['backup', v => { v.allow_backup = true; }, /backup|schema/],
    ['nativeSecurity', v => { v.native_class_closure_verified = false; }, /native security/],
    ['tools', v => { v.aapt2.sha256 = H; }, /reviewed official/],
    ['embeddedProvenance', v => { v.custodial_native_vault_source_sha256 = H; }, /reviewed forward descriptor/],
  ]) { const bad = { ...args, [key]: structuredClone(args[key]) }; mutate(bad[key]); assert.throws(() => createCustodialAndroidReleaseAcceptance(bad), pattern); }
});
test('product forward review rejects null evidence, empty retained stores, contradictory signer and blank generation', async t => {
  const f = await reviewedFixture(t);
  const original = structuredClone(f.envelope); const originalInput = structuredClone(f.value);
  for (const mutate of [
    () => { f.pins.evidence_refs = null; f.value.evidence_refs = null; },
    () => { f.pins.retained_store_compatibility = {}; f.value.retained_store_compatibility = {}; },
    () => { f.pins.candidate.signer_public_key_sha256 = H; },
    () => { f.pins.policy_generation = ' '; f.value.policy_generation = ' '; },
    () => { f.value.accepted = true; },
    () => { f.value.fleet_promotion = 'false'; },
    () => { f.pins.candidate.version_code = 56; },
  ]) {
    Object.assign(f.envelope, structuredClone(original)); f.pins = f.envelope.external_trusted_pins; Object.keys(f.value).forEach(key => delete f.value[key]); Object.assign(f.value, structuredClone(originalInput));
    mutate(); await f.save(); await assert.rejects(loadReviewedForwardBuild(f.flags, { buildNumber: 57, repositoryDirectory: f.repo }), /contract rejected/);
  }
});
test('product forward reader observes original source and retained bytes; stale dirty symlink and wrong external digest fail', async t => {
  const f = await reviewedFixture(t);
  const load = () => loadReviewedForwardBuild(f.flags, { buildNumber: 57, repositoryDirectory: f.repo });
  f.flags['--forward-trusted-pins-sha256'] = H; await assert.rejects(load(), /independent reviewed pin/); await f.save();
  await writeFile(f.envelope.evidence_files.enrollment, 'mutated synthetic bytes'); await assert.rejects(load(), /independent reviewed pin/);
  await writeFile(f.envelope.evidence_files.enrollment, 'SYNTHETIC REVIEW RECORD: enrollment; not actual retained data\n');
  const oldPath = f.envelope.evidence_files.history; f.envelope.evidence_files.history = join(f.root, 'missing'); await f.save(); await assert.rejects(load(), /existing regular/);
  await symlink(oldPath, join(f.root, 'linked')); f.envelope.evidence_files.history = join(f.root, 'linked'); await f.save(); await assert.rejects(load(), /non-symlink/);
  f.envelope.evidence_files.history = oldPath; await f.save();
  await writeFile(join(f.repo, 'untracked'), 'dirty source'); await assert.rejects(load(), /exact clean reviewed source/); await rm(join(f.repo, 'untracked'));
  f.pins.candidate.source.tree = C; await f.save();
  await assert.rejects(load(), /Retained-data compatibility plan is bound to another candidate source/);
});
test('product forward higher recovery is independently source-bound and metadata cannot qualify physical effects', async t => {
  const f = await reviewedFixture(t); f.flags['--forward-role'] = 'recovery';
  await assert.rejects(loadReviewedForwardBuild(f.flags, { buildNumber: 58, repositoryDirectory: f.repo }), /exact clean reviewed source/);
  git(f.repo, 'checkout', '-qb', 'release/synthetic-forward-recovery');
  const context = await loadReviewedForwardBuild(f.flags, { buildNumber: 58, repositoryDirectory: f.repo });
  const accepted = createCustodialAndroidReleaseAcceptance(await syntheticCreatorInput(context));
  assert.equal(accepted.forward_transition.role, 'recovery'); assert.equal(accepted.forward_transition.fleet_promotion, false);
  const bad = structuredClone(accepted); bad.forward_transition.physical_verified = true; assert.throws(() => assertCustodialAcceptanceSchema(bad), /committed schema/);
  bad.forward_transition.physical_verified = false; bad.forward_transition.recovery_version_code = 57; assert.throws(() => assertCustodialAcceptanceSchema(bad), /version order/);
});
test('product forward normal configure and artifact CLI dispatch both refuse unreviewed bytes before write or APK tools', async t => {
  const f = await reviewedFixture(t); const flags = { ...f.flags, '--forward-trusted-pins-sha256': H };
  const cli = ['--apk', join(f.root,'nonexistent.apk'), '--build-number','57','--source-commit',f.pins.candidate.source.commit,'--source-ref','refs/heads/main','--build-run','fixture-run','--build-workflow','custodial-android','--build-tools-directory',join(f.root,'no-tools'),'--runtime-directory',join(f.root,'no-runtime'),'--output',join(f.root,'never-written.json')];
  assert.equal(parseCustodialArtifactArguments([...cli, ...Object.entries(flags).flat()])['--forward-role'], 'candidate');
  assert.throws(() => parseForwardBuildArguments(['--forward-role','candidate']), /requires source input/);
  for (const [script, args, env] of [
    ['configure-native-release.mjs', ['android', ...Object.entries(flags).flat()], { MZ_APP_EDITION:'custodial', BUILD_NUMBER:'57' }],
    ['verify-custodial-android-release.mjs', [...cli, ...Object.entries(flags).flat()], {}],
  ]) {
    const r = spawnSync(process.execPath,[join(productRoot,'mobile/scripts',script),...args],{encoding:'utf8',timeout:10000,env:{...process.env,...env}});
    assert.notEqual(r.status,0); assert.match(r.stderr,/independent reviewed pin/); assert.doesNotMatch(r.stderr,/Unable to locate|keystore|Custodial APK must/);
  }
  await assert.rejects(readFile(join(f.root,'never-written.json')), /ENOENT/);
});
test('product forward legacy schema refs and synchronous validation are preserved without implicitly enabling another target', async t => {
  const f = await reviewedFixture(t); const context = await loadReviewedForwardBuild(f.flags,{buildNumber:57,repositoryDirectory:f.repo});
  const args = await syntheticCreatorInput(context); args.buildNumber=31; args.application.version_code=31; args.embeddedProvenance.native_build_number=31; args.forwardBuild=null;
  const legacy=createCustodialAndroidReleaseAcceptance(args); assert.equal(Object.hasOwn(legacy,'forward_transition'),false); assert.equal(assertCustodialAcceptanceSchema(legacy),true);
  const unknown=structuredClone(legacy); unknown.source.ref='refs/heads/unreviewed'; assert.throws(()=>assertCustodialAcceptanceSchema(unknown),/committed schema/);
  assert.throws(()=>assertCustodialAcceptanceSchema({}),/committed schema/);
  assert.throws(()=>assertReviewedForwardBuild(context,{buildNumber:31}),/reviewed role/);
});

// G30 normal CI version selection is synthetic Source qualification only.
// Execute the actual maintained shell fragments with the unchanged pinned
// reader; then independently exercise the existing private Git/source loader.
// This does not dispatch Codemagic, build/sign an APK or qualify retained data.
async function reviewedVersionShell(f, { count = 4, flags = f.flags, cmEnv = join(f.root, 'cm-env'), initial = '53', privateGate = false } = {}) {
  const yaml = await readFile(new URL('../../codemagic.yaml', import.meta.url), 'utf8');
  const fragment = name => {
    const start = `          # BEGIN ${name}\n`, end = `          # END ${name}\n`;
    assert.equal(yaml.split(start).length, 2); assert.equal(yaml.split(end).length, 2);
    return yaml.slice(yaml.indexOf(start) + start.length, yaml.indexOf(end)).replace(/^ {8}/gm, '');
  };
  const privateStart = yaml.indexOf('          # Observe genuine named clean source/review/private brand before effects.');
  const privateEnd = yaml.indexOf('          git check-ref-format', privateStart);
  assert.ok(privateStart > 0 && privateEnd > privateStart);
  const actualPrivateGate = yaml.slice(privateStart, privateEnd).replace(/^ {8}/gm, '');
  const script = `set -euo pipefail\ncustodial_forward_args=("$@")\nif [ "$SYNTHETIC_FORWARD_COUNT" -ne 0 ]; then\n${fragment('custodial_reviewed_forward_build_number')}\n${privateGate ? actualPrivateGate : ''}\n${fragment('custodial_reviewed_forward_build_number_export')}\nfi\nprintf '%s' "$PROJECT_BUILD_NUMBER"\n`;
  const env = { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH || ''}`, PROJECT_BUILD_NUMBER: initial, SYNTHETIC_FORWARD_COUNT: String(count) };
  const childNode = spawnSync('node', ['--version'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(childNode.status, 0); assert.equal(childNode.stdout.trim(), process.version);
  delete env.CM_ENV; if (cmEnv !== null) env.CM_ENV = cmEnv;
  return { ...spawnSync('bash', ['-c', script, 'synthetic-reviewed-CI-version', ...Object.entries(flags).flat()],
    { cwd: productRoot, env, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 }), cmEnv };
}
async function reviewedDifferentVersions(t) {
  const f = await reviewedFixture(t);
  // Deliberately distinct synthetic numbers: these select no actual release.
  f.pins.installed_target.version_code = 1300;
  f.pins.candidate.version_code = 1371; f.pins.recovery.version_code = 1409;
  f.value.installed_target = f.pins.installed_target;
  f.value.candidate = f.pins.candidate; f.value.recovery = f.pins.recovery;
  await f.save(); return f;
}
test('G30 normal CI derives both role versions from pinned reader; unchanged private admission still owns the source', async t => {
  const f = await reviewedDifferentVersions(t);
  const candidate = await reviewedVersionShell(f); assert.equal(candidate.status, 0, candidate.stderr);
  assert.equal(candidate.stdout, '1371'); assert.equal(await readFile(candidate.cmEnv, 'utf8'), 'PROJECT_BUILD_NUMBER=1371\n');
  const original = await loadReviewedForwardBuild(f.flags, { buildNumber: Number(candidate.stdout), repositoryDirectory: f.repo });
  assert.equal(assertReviewedForwardBuild(original, { buildNumber: 1371 }).version_code, 1371);
  const recoveryFlags = { ...f.flags, '--forward-role': 'recovery' };
  const recovery = await reviewedVersionShell(f, { flags: recoveryFlags, cmEnv: join(f.root, 'recovery-cm-env') });
  assert.equal(recovery.status, 0, recovery.stderr); assert.equal(recovery.stdout, '1409');
  assert.equal(await readFile(recovery.cmEnv, 'utf8'), 'PROJECT_BUILD_NUMBER=1409\n');
  await assert.rejects(loadReviewedForwardBuild(recoveryFlags, { buildNumber: 1409, repositoryDirectory: f.repo }), /exact clean reviewed source/);
  git(f.repo, 'checkout', '-qb', 'release/synthetic-forward-recovery');
  const higher = await loadReviewedForwardBuild(recoveryFlags, { buildNumber: 1409, repositoryDirectory: f.repo });
  assert.equal(assertReviewedForwardBuild(higher, { buildNumber: 1409 }).version_code, 1409);
  assert.throws(() => assertReviewedForwardBuild(structuredClone(higher), { buildNumber: 1409 }), /not loaded/);
  await assert.rejects(loadReviewedForwardBuild(recoveryFlags, { buildNumber: 53, repositoryDirectory: f.repo }), /build number differs/);
});
test('G30 normal CI wrong hash, unknown role and missing selector cannot export a version', async t => {
  const f = await reviewedDifferentVersions(t);
  const missingRole = { ...f.flags }; delete missingRole['--forward-role'];
  for (const [index, flags] of [
    { ...f.flags, '--forward-trusted-pins-sha256': H },
    { ...f.flags, '--forward-role': 'UNKNOWN' }, missingRole,
  ].entries()) {
    const result = await reviewedVersionShell(f, { flags, cmEnv: join(f.root, `refused-${index}`) });
    assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
    await assert.rejects(readFile(result.cmEnv), { code: 'ENOENT' });
  }
});
test('G30 normal CI missing descriptor and mismatched source DTO fail before propagation', async t => {
  const f = await reviewedDifferentVersions(t);
  const originalPins = structuredClone(f.envelope); const originalValue = structuredClone(f.value);
  delete f.envelope.external_trusted_pins.candidate; await f.save();
  const missing = await reviewedVersionShell(f, { cmEnv: join(f.root, 'missing-descriptor') });
  assert.notEqual(missing.status, 0); await assert.rejects(readFile(missing.cmEnv), { code: 'ENOENT' });
  Object.assign(f.envelope, originalPins); Object.assign(f.value, originalValue); await f.save();
  f.value.candidate.version_code++;
  await writeFile(f.flags['--forward-source-input'], JSON.stringify({ schema_version: 1, kind: 'custodial.forward-source-admission-input.v1', source_only: true, activation: false, adapter_input: f.value }));
  const mismatch = await reviewedVersionShell(f, { cmEnv: join(f.root, 'mismatched-source') });
  assert.notEqual(mismatch.status, 0); await assert.rejects(readFile(mismatch.cmEnv), { code: 'ENOENT' });
});
test('G30 normal CI legacy 53 remains unchanged and missing CM_ENV refuses the reviewed export', async t => {
  const f = await reviewedDifferentVersions(t);
  const legacy = await reviewedVersionShell(f, { count: 0, flags: {}, cmEnv: join(f.root, 'legacy-cm-env') });
  assert.equal(legacy.status, 0, legacy.stderr); assert.equal(legacy.stdout, '53');
  await assert.rejects(readFile(legacy.cmEnv), { code: 'ENOENT' });
  const noExport = await reviewedVersionShell(f, { cmEnv: null });
  assert.notEqual(noExport.status, 0); assert.match(noExport.stderr, /Codemagic environment output path is required/);
});
test('G30 normal CI retains all private source checks before normal CM_ENV propagation and the legacy gate', async () => {
  const yaml = await readFile(new URL('../../codemagic.yaml', import.meta.url), 'utf8');
  const derived = yaml.indexOf('# BEGIN custodial_reviewed_forward_build_number\n');
  const privateAdmission = yaml.indexOf('const context = await loadReviewedForwardBuild(flags, { buildNumber: build.numeric });');
  const remoteHead = yaml.indexOf('test "$(git rev-parse "refs/remotes/origin/$CM_BRANCH")" = "$CM_COMMIT"');
  const propagation = yaml.indexOf('# BEGIN custodial_reviewed_forward_build_number_export\n');
  const legacy = yaml.indexOf("recovery_branch='release/custodial-build29-recovery-v53-implementation-20260918'");
  assert.ok(derived < privateAdmission && privateAdmission < remoteHead && remoteHead < propagation && propagation < legacy);
  assert.match(yaml, /PROJECT_BUILD_NUMBER: '53'/);
  assert.match(yaml, /sourceCommit: process\.env\.CM_COMMIT,\s*sourceRef: 'refs\/heads\/' \+ process\.env\.CM_BRANCH/);
  assert.match(yaml, /--build-number "\$PROJECT_BUILD_NUMBER"/);
  const selection = yaml.slice(derived, yaml.indexOf('# END custodial_reviewed_forward_build_number', derived));
  assert.match(selection, /readReviewedForwardBuildSourceSelection\(parseForwardBuildArguments\(process\.argv\.slice\(2\)\)\)/);
  assert.doesNotMatch(selection, /JSON\.parse|readFile|1371|1409|\b57\b|\b58\b/);
});

// The exact original Node source-admission block is executed, with fetch/build
// deliberately excluded. A number from the public selector grants no brand.
test('G30 normal CI actual unchanged private gate prevents propagation for another clean source', async t => {
  const f = await reviewedDifferentVersions(t);
  const result = await reviewedVersionShell(f, { privateGate: true, cmEnv: join(f.root, 'unbranded-cm-env') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exact clean reviewed source|Unable to inspect forward build source: fatal: ref HEAD is not a symbolic ref/);
  assert.equal(result.stdout, '');
  await assert.rejects(readFile(result.cmEnv), { code: 'ENOENT' });
});
