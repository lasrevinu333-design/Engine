import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import {configureGradleWrapperSource,validateGradleWrapperJar,validateGradleVerificationMetadata} from '../mobile/scripts/configure-native-release.mjs';

// Reuse the parser from the already pinned Capacitor CLI toolchain; no new
// package/install/runtime dependency is introduced for this CI-only reader.
const require = createRequire(import.meta.url);
const getCliRequire = () => createRequire(require.resolve('@capacitor/cli/package.json'));
export const REQUIRED_ACTUAL_SQL_TEST_METHODS = Object.freeze(Object.fromEntries(Object.entries({
  NativeProviderSqlWireTest: ['actualSqlReservationWireHasIdenticalNativeMeaningAndDigest'],
  NativeProviderInventorySqlWireTest: ['actualSqlFrozenPagesAndRestartBindFullNativePrincipalWithoutRelabelling'],
  NativeProviderEventSqlWireTest: ['exactSqlAdmissionAndLostResponseReplaySettleWithoutRewritingOriginalObservation', 'actualSqlMixedReplyAndMissingItemsLeaveOtherEventsPending', 'sqlReceiptCannotSettleAlteredObservationForeignGenerationOrRetiredCallback'],
  NativeProviderIntervalSqlWireTest: ['actualSqlClockAndFrozenPageAreSeparateAcrossPaginationAndLoss', 'sqlEnvelopeCannotBeReboundToWrongNonceBodyFrozenTimeOrExtraAuthority', 'actualRawHmacHttpSqlEnvelopeUsesSameStrictNativeValidator'],
  NativeProviderLunchSqlWireTest: ['actualStartAndEndSqlStringsHaveExactNativeMeaningAndDigest', 'fcmAndInventoryFactoriesAgreeWithoutGrantingAuthority', 'missingWrongTypedAndExtraFieldsFailOnActualSqlPayloads', 'everyActualSqlContentFieldIsDigestBound', 'resignedMalformedRouteEventAndTimeCannotBecomeLunch', 'independentlyCapturedSourceAndRecipientCannotBeCrossed', 'missingGrantOrChangedOwningMigrationProvenanceIsNotCredited'],
  NativeProviderEventDecisionSqlWireTest: ['actualSqlCurrentHmacResponseSettlesOnlyFourExactJavaOriginals', 'actualFreshHttpRetryAfterLostResponsePreservesOriginalIdentity', 'actualUnresolvedOriginalRemainsPendingByteExactWhileAcceptedSettle', 'actualResponseCannotBeReboundToAnotherNonceBodyOrRequester', 'currentRemovalOrRotationFencesLateActualResponseWithoutWrites', 'actualReceiptAmbiguousCommitReadbackDoesNotAppendOrReplayEffects'],
}).map(([name, methods]) => [name, Object.freeze(methods)])));

export const ACTUAL_SQL_FIXTURE_JOBS = Object.freeze([
  { env: 'NATIVE_LOCATION_WIRE_FIXTURE', file: 'native-location-wire.json', script: 'scripts/native-location-reservation-database-tests.mjs', migration: '20261002180000_native_provider_location_reservation.sql' },
  { env: 'NATIVE_LOCATION_INVENTORY_FIXTURE', file: 'native-location-inventory.json', script: 'scripts/native-location-lifecycle-database-tests.mjs', migration: '20261003010000_native_location_lifecycle.sql' },
  { env: 'NATIVE_PROVIDER_EVENTS_FIXTURE', file: 'native-provider-events.json', script: 'scripts/native-provider-events-database-tests.mjs', migration: '20261003050000_native_provider_events.sql' },
  { env: 'NATIVE_LUNCH_WIRE_FIXTURE', file: 'native-lunch-wire.json', script: 'scripts/native-target-source-database-tests.mjs', migration: '20261003194000_native_lunch_delivery.sql' },
  { env: 'NATIVE_PROVIDER_EVENT_DECISION_FIXTURE', file: 'native-provider-event-decisions.json', script: 'scripts/native-provider-event-decisions-database-tests.mjs', migration: '20261004000000_native_provider_event_decision_lookup.sql', mode: 'java-query-sql-http-java' },
]);
const jobs = ACTUAL_SQL_FIXTURE_JOBS;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const command = (program, args, options = {}) => {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 900_000, maxBuffer: 64 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, `${program} ${args.join(' ')} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return Buffer.isBuffer(result.stdout) ? result.stdout : result.stdout.trim();
};
const git = (backend, args) => command('git', ['-C', backend, ...args]);
const privateDirectory = directory => {
  assert.ok(isAbsolute(directory) && resolve(directory) === directory, 'absolute private output directory required');
  const stat = lstatSync(directory);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
  assert.equal(realpathSync(directory), directory, 'symlink traversal refused');
  assert.equal(stat.uid, process.getuid());
  assert.equal(stat.mode & 0o077, 0);
};

// Finite checkout relocation only. The workflow supplies the tree immediately
// after its existing signature/evidence verification; no signature is inferred
// from this filesystem lease. Injectable I/O is for explicit fake-only tests.
const backendIO = {
  stat: path => lstatSync(path, {throwIfNoEntry:false}), real: realpathSync,
  git, read: path => readFileSync(path,'utf8'),
  write: (path,value) => writeFileSync(path,value,{flag:'wx',mode:0o600}),
  move: renameSync, chmod: chmodSync, remove: path => rmSync(path,{recursive:true}), uid: () => process.getuid(),
};
export function backendRetentionPaths({workspace,temp}, io=backendIO) {
  for(const path of [workspace,temp]) {
    assert.ok(isAbsolute(path||'') && resolve(path)===path && !/[\r\n]/.test(path));
    const st=io.stat(path);assert.ok(st?.isDirectory() && !st.isSymbolicLink());
    assert.equal(st.uid,io.uid());assert.equal(io.real(path),path);
  }
  assert.ok(temp!==workspace && !temp.startsWith(workspace+'/') && !workspace.startsWith(temp+'/'));
  return {source:join(workspace,'.custodial-backend-status-source'),target:join(temp,'custodial-native-backend-source'),lease:join(temp,'custodial-native-backend-retention.json')};
}
function ownedCheckout(path,io) {
  const st=io.stat(path);assert.ok(st?.isDirectory()&&!st.isSymbolicLink(),'regular owned checkout directory required');
  assert.equal(st.uid,io.uid());assert.equal(io.real(path),path);
  const meta=io.stat(join(path,'.git'));assert.ok(meta?.isDirectory()&&!meta.isSymbolicLink(),'standalone action checkout required');
  assert.equal(meta.uid,io.uid());assert.equal(io.real(join(path,'.git')),join(path,'.git'));
  return {dev:st.dev,ino:st.ino};
}
export function retainBackendCheckout(options,io=backendIO) {
  const paths=backendRetentionPaths(options,io);
  for(const id of [options.commit,options.tree])assert.match(id||'',/^[0-9a-f]{40}$/);
  assert.equal(io.stat(paths.target),undefined,'retention destination must not exist, even as a dangling symlink');
  assert.equal(io.stat(paths.lease),undefined,'retention lease must not already exist');
  const identity=ownedCheckout(paths.source,io);
  assert.equal(io.git(paths.source,['rev-parse','HEAD']),options.commit);
  assert.equal(io.git(paths.source,['rev-parse','HEAD^{tree}']),options.tree);
  assert.equal(io.git(paths.source,['status','--porcelain']),'','backend clean before move');
  const receipt={schema:'custodial.native-backend-retention.v1',...paths,commit:options.commit,tree:options.tree,uid:io.uid(),...identity};
  io.write(paths.lease,JSON.stringify(receipt)+'\n');
  // Receipt is durable before move: cleanup handles failure on either side.
  io.move(paths.source,paths.target);
  io.chmod(paths.target,0o700);
  assert.equal(io.stat(paths.source),undefined);
  assert.deepEqual(ownedCheckout(paths.target,io),identity);
  assert.equal(io.git(paths.target,['rev-parse','HEAD']),options.commit);
  assert.equal(io.git(paths.target,['rev-parse','HEAD^{tree}']),options.tree);
  assert.equal(io.git(paths.target,['status','--porcelain']),'','backend clean after move');
  return receipt;
}
export function cleanupBackendCheckout(options,io=backendIO) {
  const paths=backendRetentionPaths(options,io),st=io.stat(paths.lease);
  if(!st) {
    // Before relocation, only the action's exact local checkout is owned. Never
    // delete a pre-existing destination that caused relocation admission to fail.
    if(io.stat(paths.source)){ownedCheckout(paths.source,io);io.remove(paths.source);}
    return {removed:paths.source,retained_target_not_owned:true};
  }
  assert.ok(st.isFile()&&!st.isSymbolicLink());assert.equal(st.uid,io.uid());assert.equal(st.mode&0o077,0);
  const receipt=JSON.parse(io.read(paths.lease));
  assert.deepEqual(Object.keys(receipt).sort(),['schema','source','target','lease','commit','tree','uid','dev','ino'].sort());
  assert.equal(receipt.schema,'custodial.native-backend-retention.v1');
  for(const [key,value] of Object.entries(paths))assert.equal(receipt[key],value);
  for(const id of [receipt.commit,receipt.tree])assert.match(id,/^[0-9a-f]{40}$/);
  assert.equal(receipt.uid,io.uid());
  const present=[paths.source,paths.target].filter(path=>io.stat(path));
  assert.ok(present.length<=1,'cannot clean competing source and retained checkout');
  for(const path of present){assert.deepEqual(ownedCheckout(path,io),{dev:receipt.dev,ino:receipt.ino},'only original checkout inode may be removed');io.remove(path);assert.equal(io.stat(path),undefined);}
  io.remove(paths.lease);return {removed:present};
}

// Three Maven JARs are the exact existing strict verification-metadata entries.
// android.jar is the retained reviewed API36 fixture (not a cache discovery).
export const NATIVE_WIRE_JARS = Object.freeze([
  {name:'JUNIT_JAR',file:'junit-4.13.2.jar',coordinate:'junit:junit:4.13.2',sha256:'8e495b634469d64fb8acfa3495a065cbacc8a0fff55ce1e31007be4c16dc57d3'},
  {name:'HAMCREST_JAR',file:'hamcrest-core-1.3.jar',coordinate:'org.hamcrest:hamcrest-core:1.3',sha256:'66fdef91e9739348df7a096aa384a5685f4e875584cce89386a7a47251c4d8e9'},
  {name:'JSON_JAR',file:'json-20250517.jar',coordinate:'org.json:json:20250517',sha256:'3ea61b2a06e31edf1c91134fe9106b0ebb16628be169f3db75bc7a2b06b45796'},
  {name:'ANDROID_API_JAR',file:'android.jar',coordinate:'sdk:platforms;android-36',sha256:'d9eb9da824d9e247a352f570f01e1169e725b2954bca9e283a71786c59b59f9a'},
].map(Object.freeze));
const wireJob=jobs.at(-1);
export const NATIVE_WIRE_RESOLVER_BUILD = `repositories { mavenCentral() }
configurations { nativeWire }
dependencies {
  nativeWire 'junit:junit:4.13.2'
  nativeWire 'org.hamcrest:hamcrest-core:1.3'
  nativeWire 'org.json:json:20250517'
}
tasks.register('resolveNativeWireJars') {
  doLast {
    def expected = ['junit:junit:4.13.2','org.hamcrest:hamcrest-core:1.3','org.json:json:20250517'] as Set
    def artifacts = configurations.nativeWire.resolvedConfiguration.resolvedArtifacts
    if (artifacts.size() != 3 || artifacts.collect { it.moduleVersion.id.toString() }.toSet() != expected) throw new GradleException('Exact three native wire dependencies required')
    artifacts.each { artifact ->
      if (artifact.extension != 'jar' || artifact.classifier != null) throw new GradleException('Only exact unclassified JARs allowed')
      copy { from artifact.file; into file('verified-jars') }
    }
  }
}
`;
export function assertNativeWireJarRows(rows) {
  assert.deepEqual(rows,NATIVE_WIRE_JARS.map(({name,file,coordinate,sha256})=>({name,file,coordinate,sha256})), 'all four independently pinned JAR identities required');
  return true;
}
export function nativeWireCommands({resolver,preparation,engine,backend,jarEnvironment,env}) {
  for(const path of [resolver,preparation,engine,backend])assert.ok(isAbsolute(path)&&resolve(path)===path&&!/[\r\n]/.test(path));
  for(const row of NATIVE_WIRE_JARS)assert.equal(jarEnvironment[row.name],join(resolver,'verified-jars',row.file));
  // Ignore inherited optional fixture selectors: this phase must have one exact
  // source/JAR binding, not incidental files from another job or local shell.
  const cleanEnv={...env};for(const job of jobs)delete cleanEnv[job.env];
  for(const name of ['NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256','NATIVE_PROVIDER_EVENT_DECISION_INPUT','NATIVE_PROVIDER_EVENT_DECISION_INPUT_SHA256'])delete cleanEnv[name];
  return {
    prepare:{program:process.execPath,args:['mobile/scripts/custodial-provider-storage-tests.mjs','--prepare-event-decision-fixture',preparation],env:{...cleanEnv,...jarEnvironment}},
    sql:{program:process.execPath,args:[wireJob.script,'--execute-integrated',engine],cwd:backend,env:{...cleanEnv,NATIVE_SQL_FIXTURE_OUTPUT_DIR:engine,[wireJob.env]:join(engine,wireJob.file),NATIVE_PROVIDER_EVENT_DECISION_INPUT:join(preparation,'native-provider-event-decision-prepared.json')}},
    consume:{program:process.execPath,args:['mobile/scripts/custodial-provider-storage-tests.mjs'],env:{...cleanEnv,...jarEnvironment,[wireJob.env]:join(engine,wireJob.file)}},
  };
}
function resolveNativeWireJars(directory,env) {
  const cliRequire=getCliRequire();
  const resolver=join(directory,'native-wire-resolver');mkdirSync(resolver,{mode:0o700});
  mkdirSync(join(resolver,'gradle/wrapper'),{recursive:true});
  const cliPackage=cliRequire.resolve('@capacitor/cli/package.json');
  assert.equal(JSON.parse(readFileSync(cliPackage)).version,'8.4.3');
  const archive=resolve(cliPackage,'../assets/android-template.tar.gz');
  const jar=command('tar',['-xOf',archive,'gradle/wrapper/gradle-wrapper.jar'],{encoding:null,maxBuffer:1048576});
  validateGradleWrapperJar(jar);
  const properties=configureGradleWrapperSource(command('tar',['-xOf',archive,'gradle/wrapper/gradle-wrapper.properties']));
  const verification=readFileSync('mobile/native-locks/android/custodial/verification-metadata.xml');validateGradleVerificationMetadata(verification,'custodial');
  for(const row of NATIVE_WIRE_JARS.slice(0,3))assert.ok(verification.toString().includes(`<sha256 value="${row.sha256}"`),'existing strict metadata pin required');
  const put=(file,bytes)=>writeFileSync(join(resolver,file),bytes,{flag:'wx',mode:0o600});
  put('gradle/wrapper/gradle-wrapper.jar',jar);put('gradle/wrapper/gradle-wrapper.properties',properties);put('gradle/verification-metadata.xml',verification);
  put('settings.gradle',"rootProject.name = 'custodial-native-wire-resolver'\n");put('build.gradle',NATIVE_WIRE_RESOLVER_BUILD);
  // Existing Gradle wrapper + strict metadata are the resolver. No application
  // generation, arbitrary URL downloads, new dependency, cache glob or install.
  command('java',['-Xmx256m','-cp',join(resolver,'gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain',
    '--project-dir',resolver,'--gradle-user-home',join(resolver,'gradle-user-home'),'--no-daemon','-Dorg.gradle.jvmargs=-Xmx256m','--max-workers','1','--dependency-verification','strict','--no-build-cache','resolveNativeWireJars'],
    {cwd:resolver,env,timeout:900000});
  assert.equal(sha(readFileSync(join(resolver,'gradle/verification-metadata.xml'))),sha(verification),'resolver cannot rewrite dependency authority');
  const sdk=env.ANDROID_SDK_ROOT;assert.ok(isAbsolute(sdk||''));
  const platform=join(sdk,'platforms/android-36');const sdkProperties=readFileSync(join(platform,'source.properties'),'utf8');
  assert.match(sdkProperties,/^AndroidVersion\.ApiLevel\s*=\s*36\s*$/m);
  const api=readFileSync(join(platform,'android.jar'));assert.equal(sha(api),NATIVE_WIRE_JARS[3].sha256,'unapproved SDK API bytes fail, no local cache fallback');
  put('verified-jars/android.jar',api);
  const rows=NATIVE_WIRE_JARS.map(row=>{const path=join(resolver,'verified-jars',row.file);assert.ok(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink());chmodSync(path,0o600);return {...row,sha256:sha(readFileSync(path))};});
  assertNativeWireJarRows(rows);
  const jarEnvironment=Object.fromEntries(rows.map(row=>[row.name,join(resolver,'verified-jars',row.file)]));
  put('resolver-receipt.json',JSON.stringify({schema:'custodial.native-wire-jars.v1',rows,wrapper_sha256:sha(jar),properties_sha256:sha(properties),verification_metadata_sha256:sha(verification),build_sha256:sha(NATIVE_WIRE_RESOLVER_BUILD),sdk_properties_sha256:sha(sdkProperties)},null,2)+'\n');
  return {resolver,jarEnvironment};
}
export function verifyNativeDecisionPreparation({fixture,prepared,frontendCommit,frontendTree,jars,readSource}) {
  assert.equal(fixture.schema,'custodial.native-provider-event-decision-wire-fixture.v1');
  for(const flag of ['synthetic','actual_sql','actual_http_hmac','cleanup_verified'])assert.equal(fixture[flag],true);
  assert.equal(fixture.production,false);assert.equal(fixture.native_input_sha256,sha(prepared));
  const input=JSON.parse(prepared);assert.deepEqual(fixture.native_input,input);
  assert.equal(input.schema,'custodial.native-provider-event-decision-native-input.v1');assert.equal(input.synthetic,true);assert.equal(input.production,false);
  assert.equal(input.frontend.commit,frontendCommit);assert.equal(input.frontend.tree,frontendTree);
  assert.deepEqual(input.frontend.jars,jars.map(({name,sha256})=>({name,sha256})));
  assert.ok(Array.isArray(input.frontend.files)&&input.frontend.files.length>0);
  assert.deepEqual(input.frontend.files.map(x=>x.path),[...new Set(input.frontend.files.map(x=>x.path))].sort());
  for(const row of input.frontend.files){assert.match(row.path,/^mobile\/(?:scripts\/custodial-provider-storage-tests\.mjs|plugins\/custodial-native-vault\/android\/src\/(?:main|test)\/java\/org\/memphiszoo\/custodial\/vault\/[A-Za-z0-9]+\.java)$/);assert.equal(sha(readSource(row.path)),row.sha256);}
  for(const name of ['NativeProviderEventDecisions.java','NativeProviderJournal.java','NativeProviderEventDecisionSqlWireTest.java'])assert.equal(input.frontend.files.filter(x=>x.path.endsWith('/'+name)).length,1);
  for(const [name,query] of [['first',input.query],['retry',input.query],['unresolved',input.unresolved.query]]){
    const response=fixture[name],raw=Buffer.from(response.body_base64,'base64');assert.equal(raw.toString('base64'),response.body_base64);assert.equal(sha(raw),response.body_sha256);
    const queryRaw=Buffer.from(query.body_base64,'base64');assert.equal(queryRaw.toString('base64'),query.body_base64);assert.equal(sha(queryRaw),query.body_sha256);
    assert.equal(response.status,200);assert.match(response.content_type,/^application\/json(?:;|$)/);assert.equal(response.request_body_sha256,query.body_sha256);
    const body=JSON.parse(raw);assert.equal(body.data.native_request_id,response.request_id);assert.equal(body.data.request_body_sha256,query.body_sha256);
    assert.deepEqual(body.data.requester,JSON.parse(queryRaw).requester);
  }
  assert.notEqual(fixture.first.request_id,fixture.retry.request_id);
  return {prepared_sha256:sha(prepared),frontend_commit:frontendCommit,frontend_tree:frontendTree,jars:input.frontend.jars};
}
function prepareNativeDecisionQuery(directory,backend,env) {
  const {resolver,jarEnvironment}=resolveNativeWireJars(directory,env);
  const preparation=join(directory,'native-query'),engine=join(directory,'native-decision-engine');for(const path of [preparation,engine])mkdirSync(path,{mode:0o700});
  const commands=nativeWireCommands({resolver,preparation,engine,backend,jarEnvironment,env});
  command(commands.prepare.program,commands.prepare.args,{env:commands.prepare.env,timeout:900000});
  const inputFile=commands.sql.env.NATIVE_PROVIDER_EVENT_DECISION_INPUT,prepared=readFileSync(inputFile);
  return {commands,prepared,resolver,engine};
}
function prepareNativeDecisionFixture(directory,backend,{commands,prepared,resolver,engine}) {
  command(commands.sql.program,commands.sql.args,{cwd:backend,env:{...commands.sql.env,NATIVE_PROVIDER_EVENT_DECISION_INPUT_SHA256:sha(prepared)},timeout:1200000});
  const path=join(engine,wireJob.file),bytes=readFileSync(path),fixture=JSON.parse(bytes),receipt=JSON.parse(readFileSync(join(engine,'receipt.json'))),cleanup=JSON.parse(readFileSync(join(engine,'cleanup.json')));
  assert.equal(receipt.status,'PASS');assert.equal(receipt.cleanup_verified,true);assert.equal(cleanup.no_owned_container,true);
  assert.equal(fixture.engine_receipt_sha256,sha(readFileSync(join(engine,'receipt.json'))));assert.equal(receipt.cleanup_sha256,sha(readFileSync(join(engine,'cleanup.json'))));
  const binding=verifyNativeDecisionPreparation({fixture,prepared,frontendCommit:command('git',['rev-parse','HEAD']),frontendTree:command('git',['rev-parse','HEAD^{tree}']),jars:NATIVE_WIRE_JARS,readSource:readFileSync});
  // Same compiled input scope as preparation, NOT the later all-fixture Gradle
  // scope. The storage runner independently checks exact source/JAR equality.
  const stdout=command(commands.consume.program,commands.consume.args,{env:{...commands.consume.env,NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256:sha(bytes)},timeout:900000});
  assert.match(stdout,/(?:^|\n)OK \(396 tests\)(?:\r?\n|$)/,'390 source-declared default methods and six real wire methods required');
  writeFileSync(join(engine,'native-consumption.log'),stdout+'\n',{flag:'wx',mode:0o600});
  writeFileSync(join(directory,wireJob.file),bytes,{flag:'wx',mode:0o600});
  return {...binding,resolver_receipt_sha256:sha(readFileSync(join(resolver,'resolver-receipt.json'))),engine_receipt_sha256:sha(readFileSync(join(engine,'receipt.json'))),cleanup_sha256:sha(readFileSync(join(engine,'cleanup.json'))),native_consumption_sha256:sha(readFileSync(join(engine,'native-consumption.log'))),native_consumption_tests:396};
}

export function verifyFixtureBundle({ directory, backend, expectedCommit, expectedTree, checkSource = true }) {
  privateDirectory(directory);
  assert.match(expectedCommit, /^[0-9a-f]{40}$/);
  assert.match(expectedTree, /^[0-9a-f]{40}$/);
  if (checkSource) {
    assert.equal(git(backend, ['rev-parse', 'HEAD']), expectedCommit);
    assert.equal(git(backend, ['rev-parse', 'HEAD^{tree}']), expectedTree);
    assert.equal(git(backend, ['status', '--porcelain']), '', 'backend source must remain clean');
  }
  let manifestSha;
  const receipts = [];
  for (const job of jobs) {
    const path = join(directory, job.file);
    const stat = lstatSync(path);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `regular fixture required: ${job.file}`);
    assert.equal(stat.mode & 0o777, 0o600, `private fixture required: ${job.file}`);
    const bytes = readFileSync(path), fixture = JSON.parse(bytes);
    const p = fixture.sql_fixture_provenance;
    assert.equal(p.schema, 'custodial.native-actual-sql-fixture-provenance.v1');
    assert.equal(p.synthetic, true);
    assert.equal(p.production, false);
    assert.equal(p.automatic_grants_absent_before_and_after_each, true);
    assert.equal(p.backend_commit, expectedCommit);
    assert.equal(p.backend_tree, expectedTree);
    assert.deepEqual(p.source_script, { path: job.script, sha256: sha(readFileSync(join(backend, job.script))) });
    const own = p.migration_manifest.find(item => item.file === job.migration);
    assert.deepEqual(p.owning_migration, own);
    assert.equal(own.sha256, sha(readFileSync(join(backend, 'supabase/migrations', job.migration))));
    assert.equal(p.migration_manifest_sha256, sha(Buffer.from(`${JSON.stringify(p.migration_manifest)}\n`)));
    const current = sha(Buffer.from(`${JSON.stringify(p.migration_manifest)}\n`));
    if (manifestSha) assert.equal(current, manifestSha, 'all fixtures must replay identical complete migrations');
    manifestSha = current;
    const files = readdirSync(join(backend, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort();
    const declared=JSON.parse(readFileSync(join(backend,'supabase/canonical/migration-replay-order.json'),'utf8'));
    const ordered=declared.phases.flatMap(phase=>phase.files.map(row=>row.name));
    assert.deepEqual([...new Set(ordered)].sort(),files,'every exact source member, no omitted or invented migrations');
    assert.equal(ordered.length,files.length,'no duplicate source members');
    assert.deepEqual(p.migration_manifest.map(item => item.file), ordered, 'fixture must execute the byte-bound source phases, not date-sort previously installed work');
    for (const item of p.migration_manifest) assert.equal(item.sha256, sha(readFileSync(join(backend, 'supabase/migrations', item.file))));
    receipts.push({ env: job.env, file: job.file, sha256: sha(bytes), source_script_sha256: p.source_script.sha256, owning_migration_sha256: own.sha256 });
  }
  return { schema: 'custodial.native-actual-sql-fixture-bundle.v1', synthetic: true, actual_postgres: true, backend_commit: expectedCommit, backend_tree: expectedTree, migration_manifest_sha256: manifestSha, migration_count: readdirSync(join(backend, 'supabase/migrations')).filter(file => file.endsWith('.sql')).length, fixtures: receipts };
}

export function verifyUnitXml(directory) {
  const { DOMParser } = createRequire(getCliRequire().resolve('plist/package.json'))('@xmldom/xmldom');
  let count = 0;
  for (const [name, methods] of Object.entries(REQUIRED_ACTUAL_SQL_TEST_METHODS)) {
    const expected = methods.length;
    const path = join(directory, `TEST-org.memphiszoo.custodial.vault.${name}.xml`);
    const xml = readFileSync(path, 'utf8');
    assert.ok(Buffer.byteLength(xml) <= 1_048_576, `bounded JUnit report required: ${name}`);
    assert.ok(!/<!DOCTYPE|<!ENTITY/i.test(xml), `JUnit declarations refused: ${name}`);
    const document = new DOMParser({ onError: (level, message) => { throw new Error(`JUnit XML ${level}: ${message}`); } }).parseFromString(xml, 'application/xml');
    const elements = node => Array.from(node.childNodes).filter(child => child.nodeType === 1);
    const roots = elements(document);
    assert.equal(roots.length, 1, `one JUnit suite required: ${name}`);
    const suite = roots[0];
    assert.equal(suite.tagName, 'testsuite', `JUnit suite required: ${name}`);
    assert.ok(!suite.namespaceURI, `unqualified JUnit suite required: ${name}`);
    const number = attribute => {
      const value = suite.getAttribute(attribute);
      assert.match(value || '', /^(0|[1-9][0-9]*)$/, `integer JUnit ${attribute}: ${name}`);
      return Number(value);
    };
    assert.equal(number('tests'), expected, `exact fixture tests required: ${name}`);
    for (const attr of ['skipped', 'failures', 'errors']) assert.equal(number(attr), 0, `${name} ${attr}`);
    const classname = `org.memphiszoo.custodial.vault.${name}`;
    assert.equal(suite.getAttribute('name'), classname, `JUnit suite identity: ${name}`);
    const children = elements(suite);
    assert.ok(children.every(child => !child.namespaceURI && ['testcase', 'properties', 'system-out', 'system-err'].includes(child.tagName)), `unexpected JUnit suite element: ${name}`);
    const cases = children.filter(child => child.tagName === 'testcase');
    assert.equal(cases.length, expected, `exact named testcase entries required: ${name}`);
    const observed = [];
    for (const testcase of cases) {
      assert.equal(testcase.getAttribute('classname'), classname, `JUnit testcase class identity: ${name}`);
      assert.ok(elements(testcase).every(child => !child.namespaceURI && ['system-out', 'system-err'].includes(child.tagName)), `${name} testcase may not be skipped, fail or contain unrecognized elements`);
      observed.push(testcase.getAttribute('name'));
    }
    assert.deepEqual(observed.sort(), [...methods].sort(), `exact unique named testcases required: ${name}`);
    count += expected;
  }
  return count;
}

function prepare(env) {
  const backend = resolve(env.NATIVE_SQL_BACKEND_CHECKOUT || '');
  const root = resolve(env.RUNNER_TEMP || '');
  const expectedCommit = env.NATIVE_SQL_EXPECTED_BACKEND_COMMIT;
  assert.ok(isAbsolute(env.RUNNER_TEMP || '') && isAbsolute(env.NATIVE_SQL_BACKEND_CHECKOUT || ''));
  assert.match(expectedCommit || '', /^[0-9a-f]{40}$/);
  assert.equal(git(backend, ['rev-parse', 'HEAD']), expectedCommit);
  const tree = git(backend, ['rev-parse', 'HEAD^{tree}']);
  assert.match(tree, /^[0-9a-f]{40}$/);
  assert.equal(tree,env.NATIVE_SQL_EXPECTED_BACKEND_TREE,'exact previously signature-verified backend tree');
  assert.equal(git(backend, ['status', '--porcelain']), '', 'signed backend checkout must be clean before fixtures');
  assert.equal(command('git',['status','--porcelain']),'','frontend remains strictly clean; signed backend must be retained outside it');
  assert.equal(realpathSync(root), root, 'temporary output root may not traverse a symlink');
  const directory = mkdtempSync(join(root, 'native-actual-sql-'));
  chmodSync(directory, 0o700);
  try {
    // Fail dependency/source preparation before starting ANY SQL fixture job.
    const nativeQuery=prepareNativeDecisionQuery(directory,backend,env);
    let nativeDecisionBinding;
    for (const job of jobs) {
      if(job.mode==='java-query-sql-http-java'){
        nativeDecisionBinding=prepareNativeDecisionFixture(directory,backend,nativeQuery);
        continue;
      }
      const child = spawnSync(process.execPath, [job.script], { cwd: backend, stdio: 'inherit', timeout: 1_200_000,
        env: { ...env, NATIVE_SQL_FIXTURE_OUTPUT_DIR: directory, [job.env]: join(directory, job.file) } });
      assert.equal(child.status, 0, `${job.script} failed: ${child.error?.message || child.signal || child.status}`);
    }
    const receipt = verifyFixtureBundle({ directory, backend, expectedCommit, expectedTree: tree });
    assert.ok(nativeDecisionBinding,'mandatory native query/HTTP/SQL chain may not be skipped');
    receipt.native_decision_binding=nativeDecisionBinding;
    receipt.frontend_commit = command('git', ['rev-parse', 'HEAD']);
    receipt.frontend_tree = command('git', ['rev-parse', 'HEAD^{tree}']);
    receipt.frontend_runner_sha256 = sha(readFileSync('scripts/native-actual-sql-fixtures.mjs'));
    receipt.frontend_workflow_sha256 = sha(readFileSync('.github/workflows/android-test-apks.yml'));
    const manifest = join(directory, 'native-sql-fixture-bundle.json');
    writeFileSync(manifest, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    assert.ok(env.GITHUB_ENV, 'GitHub environment file required for native fixture wiring');
    for (const job of jobs) appendFileSync(env.GITHUB_ENV, `${job.env}=${join(directory, job.file)}\n`);
    appendFileSync(env.GITHUB_ENV, `NATIVE_SQL_FIXTURE_OUTPUT_DIR=${directory}\nNATIVE_SQL_FIXTURE_MANIFEST=${manifest}\nNATIVE_SQL_EXPECTED_BACKEND_COMMIT=${expectedCommit}\nNATIVE_SQL_EXPECTED_BACKEND_TREE=${tree}\n`);
    console.log(JSON.stringify(receipt));
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function verify(env) {
  const directory = env.NATIVE_SQL_FIXTURE_OUTPUT_DIR;
  const backend = env.NATIVE_SQL_BACKEND_CHECKOUT;
  // The exact backend checkout is intentionally gone at this stage. Compare
  // the sealed bundle and fixture bytes without reconstructing that source.
  privateDirectory(directory);
  const stored = JSON.parse(readFileSync(env.NATIVE_SQL_FIXTURE_MANIFEST));
  assert.equal(stored.backend_commit, env.NATIVE_SQL_EXPECTED_BACKEND_COMMIT);
  assert.equal(stored.backend_tree, env.NATIVE_SQL_EXPECTED_BACKEND_TREE);
  assert.equal(stored.frontend_commit, command('git', ['rev-parse', 'HEAD']));
  assert.equal(stored.frontend_tree, command('git', ['rev-parse', 'HEAD^{tree}']));
  assert.equal(stored.frontend_runner_sha256, sha(readFileSync('scripts/native-actual-sql-fixtures.mjs')));
  assert.equal(stored.frontend_workflow_sha256, sha(readFileSync('.github/workflows/android-test-apks.yml')));
  assert.equal(stored.fixtures.length, jobs.length);
  for (const job of jobs) {
    assert.equal(env[job.env], join(directory, job.file));
    const entry = stored.fixtures.find(item => item.env === job.env);
    assert.equal(entry?.sha256, sha(readFileSync(env[job.env])));
  }
  const resolver=join(directory,'native-wire-resolver'),engine=join(directory,'native-decision-engine');
  for(const row of NATIVE_WIRE_JARS)assert.equal(sha(readFileSync(join(resolver,'verified-jars',row.file))),row.sha256,'retained strict dependency bytes');
  const fixture=JSON.parse(readFileSync(env.NATIVE_PROVIDER_EVENT_DECISION_FIXTURE)),prepared=readFileSync(join(directory,'native-query/native-provider-event-decision-prepared.json'));
  const binding=verifyNativeDecisionPreparation({fixture,prepared,frontendCommit:stored.frontend_commit,frontendTree:stored.frontend_tree,jars:NATIVE_WIRE_JARS,readSource:readFileSync});
  assert.deepEqual(stored.native_decision_binding,{...binding,resolver_receipt_sha256:sha(readFileSync(join(resolver,'resolver-receipt.json'))),engine_receipt_sha256:sha(readFileSync(join(engine,'receipt.json'))),cleanup_sha256:sha(readFileSync(join(engine,'cleanup.json'))),native_consumption_sha256:sha(readFileSync(join(engine,'native-consumption.log'))),native_consumption_tests:396});
  assert.ok(!existsSync(backend), 'signed backend checkout must be removed before Gradle/build phase');
  const count = verifyUnitXml(env.NATIVE_SQL_JUNIT_RESULTS);
  console.log(JSON.stringify({ status: 'PASS', exact_sql_native_fixture_tests: count, skipped: 0, bundle_sha256: sha(readFileSync(env.NATIVE_SQL_FIXTURE_MANIFEST)), backend_commit: stored.backend_commit, backend_tree: stored.backend_tree }));
}

function cleanup(env) {
  const directory = env.NATIVE_SQL_FIXTURE_OUTPUT_DIR;
  if (!directory) return;
  assert.ok(basename(directory).startsWith('native-actual-sql-'));
  assert.equal(resolve(directory, '..'), resolve(env.RUNNER_TEMP));
  privateDirectory(directory);
  assert.ok(existsSync(join(directory, 'native-sql-fixture-bundle.json')));
  rmSync(directory, { recursive: true });
  assert.ok(!existsSync(directory));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const mode = process.argv[2];
  if (mode === '--prepare') prepare(process.env);
  else if (mode === '--verify') verify(process.env);
  else if (mode === '--cleanup') cleanup(process.env);
  else if (mode === '--retain-backend') retainBackendCheckout({workspace:process.cwd(),temp:process.env.RUNNER_TEMP,commit:process.env.NATIVE_SQL_EXPECTED_BACKEND_COMMIT,tree:process.env.NATIVE_SQL_EXPECTED_BACKEND_TREE});
  else if (mode === '--cleanup-backend') cleanupBackendCheckout({workspace:process.cwd(),temp:process.env.RUNNER_TEMP});
  else throw new Error('Expected --prepare, --verify, --cleanup, --retain-backend, or --cleanup-backend');
}
