import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACTUAL_SQL_FIXTURE_JOBS, REQUIRED_ACTUAL_SQL_TEST_METHODS, verifyUnitXml, NATIVE_WIRE_JARS, NATIVE_WIRE_RESOLVER_BUILD, assertNativeWireJarRows, nativeWireCommands, verifyNativeDecisionPreparation, retainBackendCheckout, cleanupBackendCheckout } from './native-actual-sql-fixtures.mjs';

const root = mkdtempSync(join(tmpdir(), 'native-actual-sql-contract-'));
let checks = 0;
const check = (label, run) => { run(); checks++; console.log('PASS', label); };
const names = [['NativeProviderSqlWireTest', 1], ['NativeProviderInventorySqlWireTest', 1], ['NativeProviderEventSqlWireTest', 3], ['NativeProviderIntervalSqlWireTest', 3], ['NativeProviderLunchSqlWireTest', 7], ['NativeProviderEventDecisionSqlWireTest', 6]];
const methods = {
  NativeProviderSqlWireTest: ['actualSqlReservationWireHasIdenticalNativeMeaningAndDigest'],
  NativeProviderInventorySqlWireTest: ['actualSqlFrozenPagesAndRestartBindFullNativePrincipalWithoutRelabelling'],
  NativeProviderEventSqlWireTest: ['exactSqlAdmissionAndLostResponseReplaySettleWithoutRewritingOriginalObservation', 'actualSqlMixedReplyAndMissingItemsLeaveOtherEventsPending', 'sqlReceiptCannotSettleAlteredObservationForeignGenerationOrRetiredCallback'],
  NativeProviderIntervalSqlWireTest: ['actualSqlClockAndFrozenPageAreSeparateAcrossPaginationAndLoss', 'sqlEnvelopeCannotBeReboundToWrongNonceBodyFrozenTimeOrExtraAuthority', 'actualRawHmacHttpSqlEnvelopeUsesSameStrictNativeValidator'],
  NativeProviderLunchSqlWireTest: ['actualStartAndEndSqlStringsHaveExactNativeMeaningAndDigest', 'fcmAndInventoryFactoriesAgreeWithoutGrantingAuthority', 'missingWrongTypedAndExtraFieldsFailOnActualSqlPayloads', 'everyActualSqlContentFieldIsDigestBound', 'resignedMalformedRouteEventAndTimeCannotBecomeLunch', 'independentlyCapturedSourceAndRecipientCannotBeCrossed', 'missingGrantOrChangedOwningMigrationProvenanceIsNotCredited'],
  NativeProviderEventDecisionSqlWireTest: ['actualSqlCurrentHmacResponseSettlesOnlyFourExactJavaOriginals', 'actualFreshHttpRetryAfterLostResponsePreservesOriginalIdentity', 'actualUnresolvedOriginalRemainsPendingByteExactWhileAcceptedSettle', 'actualResponseCannotBeReboundToAnotherNonceBodyOrRequester', 'currentRemovalOrRotationFencesLateActualResponseWithoutWrites', 'actualReceiptAmbiguousCommitReadbackDoesNotAppendOrReplayEffects'],
};
const xmlFor = name => `<testsuite name="org.memphiszoo.custodial.vault.${name}" tests="${methods[name].length}" skipped="0" failures="0" errors="0">${methods[name].map(method => `<testcase classname="org.memphiszoo.custodial.vault.${name}" name="${method}" time="0.001"/>`).join('')}</testsuite>\n`;
try {
  for (const [name] of names) writeFileSync(join(root, `TEST-org.memphiszoo.custodial.vault.${name}.xml`), xmlFor(name));
  check('exact four original SQL producers and mandatory Java-query218 bridge', () => assert.deepEqual(ACTUAL_SQL_FIXTURE_JOBS, [
    { env: 'NATIVE_LOCATION_WIRE_FIXTURE', file: 'native-location-wire.json', script: 'scripts/native-location-reservation-database-tests.mjs', migration: '20261002180000_native_provider_location_reservation.sql' },
    { env: 'NATIVE_LOCATION_INVENTORY_FIXTURE', file: 'native-location-inventory.json', script: 'scripts/native-location-lifecycle-database-tests.mjs', migration: '20261003010000_native_location_lifecycle.sql' },
    { env: 'NATIVE_PROVIDER_EVENTS_FIXTURE', file: 'native-provider-events.json', script: 'scripts/native-provider-events-database-tests.mjs', migration: '20261003050000_native_provider_events.sql' },
    { env: 'NATIVE_LUNCH_WIRE_FIXTURE', file: 'native-lunch-wire.json', script: 'scripts/native-target-source-database-tests.mjs', migration: '20261003194000_native_lunch_delivery.sql' },
    { env: 'NATIVE_PROVIDER_EVENT_DECISION_FIXTURE', file: 'native-provider-event-decisions.json', script: 'scripts/native-provider-event-decisions-database-tests.mjs', migration: '20261004000000_native_provider_event_decision_lookup.sql', mode: 'java-query-sql-http-java' },
  ]));
  check('all original fifteen plus six actual-SQL native tests required', () => assert.equal(verifyUnitXml(root), 21));
  const lunch = join(root, 'TEST-org.memphiszoo.custodial.vault.NativeProviderLunchSqlWireTest.xml');
  const validLunch = readFileSync(lunch, 'utf8');
  writeFileSync(lunch, validLunch.replace(/<testcase\b[^>]*\/>/g, ''));
  check('claimed totals without actual named testcases are refused', () => assert.throws(() => verifyUnitXml(root), /testcase|test cases/));
  const firstCase = validLunch.match(/<testcase\b[^>]*\/>/)[0];
  const secondCase = validLunch.match(/<testcase\b[^>]*\/>/g)[1];
  const spoofCases = validLunch.match(/<testcase\b[^>]*\/>/g).join('');
  const noCases = validLunch.replace(/<testcase\b[^>]*\/>/g, '');
  for (const [label, body, pattern] of [
    ['duplicate method with unchanged total', validLunch.replace(secondCase, firstCase), /unique named testcases/],
    ['wrong method with unchanged total', validLunch.replace(`name="${methods.NativeProviderLunchSqlWireTest[0]}"`, 'name="unrelatedTest"'), /unique named testcases/],
    ['wrong suite under expected filename', validLunch.replace('name="org.memphiszoo.custodial.vault.NativeProviderLunchSqlWireTest"', 'name="org.memphiszoo.custodial.vault.UnrelatedTest"'), /suite identity/],
    ['wrong testcase class', validLunch.replace(firstCase, firstCase.replace('classname="org.memphiszoo.custodial.vault.NativeProviderLunchSqlWireTest"', 'classname="org.memphiszoo.custodial.vault.UnrelatedTest"')), /class identity/],
    ['skipped testcase with zero skipped summary', validLunch.replace(firstCase, firstCase.replace('/>', '><skipped/></testcase>')), /testcase may not/],
    ['failed testcase with zero failures summary', validLunch.replace(firstCase, firstCase.replace('/>', '><failure message="failed"/></testcase>')), /testcase may not/],
    ['errored testcase with zero errors summary', validLunch.replace(firstCase, firstCase.replace('/>', '><error/></testcase>')), /testcase may not/],
    ['commented fake testcases', noCases.replace('</testsuite>', `<!--${spoofCases}--></testsuite>`), /testcase entries/],
    ['CDATA fake testcases', noCases.replace('</testsuite>', `<system-out><![CDATA[${spoofCases}]]></system-out></testsuite>`), /testcase entries/],
    ['nested fake testcases', noCases.replace('</testsuite>', `<properties>${spoofCases}</properties></testsuite>`), /testcase entries/],
    ['missing method despite correct summary', validLunch.replace(firstCase, ''), /testcase entries/],
    ['extra method despite correct summary', validLunch.replace('</testsuite>', `${firstCase}</testsuite>`), /testcase entries/],
    ['duplicate XML attribute', validLunch.replace('tests="7"', 'tests="7" tests="0"'), /XML/],
    ['malformed XML', validLunch.replace('</testsuite>', ''), /XML/],
    ['external entity declaration', '<!DOCTYPE testsuite [<!ENTITY leak SYSTEM "file:///not-read">]>' + validLunch, /declarations refused/],
    ['oversized report', validLunch + ' '.repeat(1_048_576), /bounded JUnit/],
  ]) {
    writeFileSync(lunch, body);
    check(label + ' refused', () => assert.throws(() => verifyUnitXml(root), pattern));
  }
  writeFileSync(lunch, validLunch);
  check('named methods exactly match owning Java Test annotations', () => {
    assert.deepEqual(REQUIRED_ACTUAL_SQL_TEST_METHODS, methods);
    for (const [name, expected] of Object.entries(methods)) {
      const source = readFileSync(`mobile/plugins/custodial-native-vault/android/src/test/java/org/memphiszoo/custodial/vault/${name}.java`, 'utf8');
      const actual = [...source.matchAll(/@Test\s+public\s+void\s+(\w+)\s*\(/g)].map(match => match[1]);
      assert.deepEqual(actual.sort(), [...expected].sort(), name);
    }
  });
  check('standard Gradle metadata and testcase ordering accepted', () => {
    const reversed = [...validLunch.matchAll(/<testcase\b[^>]*\/>/g)].map(match => match[0]).reverse().join('');
    writeFileSync(lunch, '<?xml version="1.0" encoding="UTF-8"?>' + noCases.replace('</testsuite>', `${reversed}<system-out><![CDATA[<failure>not a testcase failure</failure>]]></system-out><system-err/></testsuite>`));
    assert.equal(verifyUnitXml(root), 21);
    writeFileSync(lunch, validLunch);
  });
  rmSync(lunch);
  check('omitted LUNCH JUnit proof refused', () => assert.throws(() => verifyUnitXml(root), /ENOENT/));
  for (const [label, body, pattern] of [
    ['skipped LUNCH', '<testsuite tests="7" skipped="1" failures="0" errors="0"><skipped/></testsuite>', /skipped/],
    ['zero LUNCH', '<testsuite tests="0" skipped="0" failures="0" errors="0"></testsuite>', /exact fixture tests/],
    ['partial LUNCH', '<testsuite tests="6" skipped="0" failures="0" errors="0"></testsuite>', /exact fixture tests/],
    ['failed LUNCH', '<testsuite tests="7" skipped="0" failures="1" errors="0"><failure/></testsuite>', /failures/],
    ['errored LUNCH', '<testsuite tests="7" skipped="0" failures="0" errors="1"><error/></testsuite>', /errors/],
  ]) {
    writeFileSync(lunch, body);
    check(label + ' proof refused', () => assert.throws(() => verifyUnitXml(root), pattern));
  }
  writeFileSync(lunch, validLunch);
  check('complete non-skipped LUNCH proof restores twenty-one-test admission', () => assert.equal(verifyUnitXml(root), 21));
  const interval = join(root, 'TEST-org.memphiszoo.custodial.vault.NativeProviderIntervalSqlWireTest.xml');
  const validInterval = readFileSync(interval, 'utf8');
  rmSync(interval);
  check('existing actual-SQL interval consumer may not be omitted', () => assert.throws(() => verifyUnitXml(root), /ENOENT/));
  writeFileSync(interval, '<testsuite tests="3" skipped="1" failures="0" errors="0"><skipped/></testsuite>');
  check('existing actual-SQL interval consumer may not be skipped', () => assert.throws(() => verifyUnitXml(root), /skipped/));
  writeFileSync(interval, validInterval);
  const wire = join(root, 'TEST-org.memphiszoo.custodial.vault.NativeProviderSqlWireTest.xml');
  writeFileSync(wire, '<testsuite tests="1" skipped="1" failures="0" errors="0"><skipped/></testsuite>\n');
  check('skipped assumed wire test refused', () => assert.throws(() => verifyUnitXml(root), /skipped/));
  writeFileSync(wire, '<testsuite tests="0" skipped="0" failures="0" errors="0"></testsuite>\n');
  check('zero executed wire tests refused', () => assert.throws(() => verifyUnitXml(root), /exact fixture tests/));
  const workflow = readFileSync('.github/workflows/android-test-apks.yml', 'utf8');
  const ordered = ['Verify exact signed backend tree and evidence', 'Generate exact backend status matrix', 'Retain verified backend outside clean native source checkout', 'Generate actual-SQL native wire fixtures from signed backend',
    'Remove task-owned backend status checkout before exact build', 'Run standalone native-vault unit and managed instrumentation tests',
    'Verify actual-SQL fixture hashes and non-skipped native JUnit results', 'Remove task-owned actual-SQL native fixtures'];
  check('signed checkout, fixture, removal, JUnit, and cleanup ordering', () => {
    let previous = -1;
    for (const label of ordered) { const at = workflow.indexOf(`- name: ${label}`); assert.ok(at > previous, label); previous = at; }
  });
  check('wire, inventory, event and LUNCH fixture env remain assertions', () => {
    assert.match(workflow, /native-actual-sql-fixtures\.mjs --prepare/);
    assert.match(workflow, /native-actual-sql-fixtures\.mjs --verify/);
    for (const [name] of names) assert.match(readFileSync(`mobile/plugins/custodial-native-vault/android/src/test/java/org/memphiszoo/custodial/vault/${name}.java`, 'utf8'),
      /NATIVE_(?:LOCATION_(?:WIRE|INVENTORY)|PROVIDER_EVENTS|PROVIDER_EVENT_DECISION|LUNCH_WIRE)_FIXTURE/);
  });
  for(const [name] of names)writeFileSync(join(root,`TEST-org.memphiszoo.custodial.vault.${name}.xml`),xmlFor(name));
  const decisionXml=join(root,'TEST-org.memphiszoo.custodial.vault.NativeProviderEventDecisionSqlWireTest.xml');
  const validDecision=xmlFor('NativeProviderEventDecisionSqlWireTest');
  rmSync(decisionXml);check('six-method bridge cannot be omitted',()=>assert.throws(()=>verifyUnitXml(root),/ENOENT/));
  for(const [label,body] of [
    ['skip',validDecision.replace('skipped="0"','skipped="1"')],
    ['partial',validDecision.replace('tests="6"','tests="5"')],
    ['failure',validDecision.replace('failures="0"','failures="1"')],
    ['duplicate',validDecision.replace(methods.NativeProviderEventDecisionSqlWireTest[1],methods.NativeProviderEventDecisionSqlWireTest[0])],
    ['renamed',validDecision.replace(methods.NativeProviderEventDecisionSqlWireTest[0],'unrelated')],
  ]){writeFileSync(decisionXml,body);check('new bridge '+label+' refuses all-class admission',()=>assert.throws(()=>verifyUnitXml(root)));}
  writeFileSync(decisionXml,validDecision);check('six classes and twenty-one exact methods restored',()=>assert.equal(verifyUnitXml(root),21));
  const sha=value=>createHash('sha256').update(value).digest('hex');
  check('strict resolver contains only three existing Maven artifacts',()=>{
    assert.equal((NATIVE_WIRE_RESOLVER_BUILD.match(/nativeWire '/g)||[]).length,3);
    assert.ok(NATIVE_WIRE_RESOLVER_BUILD.includes('artifacts.size() != 3'));
    const metadata=readFileSync('mobile/native-locks/android/custodial/verification-metadata.xml','utf8');
    for(const row of NATIVE_WIRE_JARS.slice(0,3))assert.ok(metadata.includes(`<sha256 value="${row.sha256}"`));
    assertNativeWireJarRows(structuredClone(NATIVE_WIRE_JARS));
  });
  for(const mutate of [x=>x.pop(),x=>x.push(x[0]),x=>x.reverse(),x=>x[0].sha256='0'.repeat(64),x=>x[3].coordinate='sdk:platforms;android-35',x=>x[0].file='../junit.jar',x=>x[1].extra=true])
    check('missing altered or extra JAR authority fails',()=>{const rows=structuredClone(NATIVE_WIRE_JARS);mutate(rows);assert.throws(()=>assertNativeWireJarRows(rows));});
  const commandOptions={resolver:'/private/resolver',preparation:'/private/query',engine:'/private/engine',backend:'/private/backend',
    jarEnvironment:Object.fromEntries(NATIVE_WIRE_JARS.map(x=>[x.name,'/private/resolver/verified-jars/'+x.file])),
    env:Object.fromEntries([...ACTUAL_SQL_FIXTURE_JOBS.map(x=>[x.env,'/contamination']),['NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256','old'],['NATIVE_PROVIDER_EVENT_DECISION_INPUT','old'],['NATIVE_PROVIDER_EVENT_DECISION_INPUT_SHA256','old']])};
  const plans=nativeWireCommands(commandOptions);
  check('real finite command plan prepares Query then executes private218 then consumes',()=>{
    assert.deepEqual(plans.prepare.args,['mobile/scripts/custodial-provider-storage-tests.mjs','--prepare-event-decision-fixture','/private/query']);
    assert.deepEqual(plans.sql.args,['scripts/native-provider-event-decisions-database-tests.mjs','--execute','/private/engine']);
    assert.equal(plans.sql.cwd,'/private/backend');assert.equal(plans.sql.env.NATIVE_PROVIDER_EVENT_DECISION_INPUT,'/private/query/native-provider-event-decision-prepared.json');
    assert.equal(plans.sql.env.NATIVE_SQL_FIXTURE_OUTPUT_DIR,'/private/engine');
    assert.deepEqual(plans.consume.args,['mobile/scripts/custodial-provider-storage-tests.mjs']);
    for(const plan of Object.values(plans))assert.equal(plan.program,process.execPath);
  });
  check('preparation and consumption have identical selector and JAR/source scope',()=>{
    for(const job of ACTUAL_SQL_FIXTURE_JOBS.slice(0,4)){assert.equal(plans.prepare.env[job.env],undefined);assert.equal(plans.consume.env[job.env],undefined);assert.equal(plans.sql.env[job.env],undefined);}
    const consumption={...plans.consume.env};delete consumption.NATIVE_PROVIDER_EVENT_DECISION_FIXTURE;assert.deepEqual(consumption,plans.prepare.env);
    assert.equal(plans.prepare.env.NATIVE_PROVIDER_EVENT_DECISION_FIXTURE,undefined);
    for(const name of ['NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256','NATIVE_PROVIDER_EVENT_DECISION_INPUT','NATIVE_PROVIDER_EVENT_DECISION_INPUT_SHA256'])assert.equal(plans.consume.env[name],undefined);
  });
  for(const mutate of [x=>x.engine='../engine',x=>x.backend='/private/../backend',x=>x.jarEnvironment.JSON_JAR='/cache/json.jar'])check('command path or JAR substitution refused',()=>{const bad=structuredClone(commandOptions);mutate(bad);assert.throws(()=>nativeWireCommands(bad));});
  // Explicit fake transport/source values only: this is NOT SQL/JVM evidence.
  function fakeWire(){
    const files=['NativeProviderEventDecisions.java','NativeProviderJournal.java','NativeProviderEventDecisionSqlWireTest.java'].map(name=>({path:'mobile/plugins/custodial-native-vault/android/src/'+(name.endsWith('Test.java')?'test':'main')+'/java/org/memphiszoo/custodial/vault/'+name,sha256:sha(name)})).sort((a,b)=>a.path.localeCompare(b.path));
    const query=which=>{const raw=Buffer.from(JSON.stringify({requester:{employee_id:'synthetic',generation_id:'original'},observations:[which]}));return {body_base64:raw.toString('base64'),body_sha256:sha(raw)};};
    const input={schema:'custodial.native-provider-event-decision-native-input.v1',synthetic:true,production:false,frontend:{commit:'a'.repeat(40),tree:'b'.repeat(40),files,jars:NATIVE_WIRE_JARS.map(({name,sha256})=>({name,sha256}))},query:query('four'),unresolved:{query:query('five')}};
    const prepared=Buffer.from(JSON.stringify(input));
    const response=(q,nonce)=>{const raw=Buffer.from(JSON.stringify({data:{native_request_id:nonce,request_body_sha256:q.body_sha256,requester:JSON.parse(Buffer.from(q.body_base64,'base64')).requester}}));return {status:200,content_type:'application/json; charset=utf-8',request_id:nonce,request_body_sha256:q.body_sha256,body_base64:raw.toString('base64'),body_sha256:sha(raw)};};
    return {fixture:{schema:'custodial.native-provider-event-decision-wire-fixture.v1',synthetic:true,production:false,actual_sql:true,actual_http_hmac:true,cleanup_verified:true,native_input_sha256:sha(prepared),native_input:input,first:response(input.query,'nonce1'),retry:response(input.query,'nonce2'),unresolved:response(input.unresolved.query,'nonce3')},prepared,frontendCommit:input.frontend.commit,frontendTree:input.frontend.tree,jars:NATIVE_WIRE_JARS,readSource:path=>path.split('/').at(-1)};
  }
  check('pure binder accepts coherent fake shape without claiming engine evidence',()=>assert.equal(verifyNativeDecisionPreparation(fakeWire()).frontend_commit,'a'.repeat(40)));
  for(const [label,mutate] of [
    ['SQL flag',x=>x.fixture.actual_sql=false],['HMAC flag',x=>x.fixture.actual_http_hmac=false],['cleanup',x=>x.fixture.cleanup_verified=false],['production',x=>x.fixture.production=true],
    ['prepared byte identity',x=>x.prepared=Buffer.concat([x.prepared,Buffer.from(' ')])],['included input',x=>x.fixture.native_input.query.body_sha256='0'.repeat(64)],
    ['source commit',x=>x.frontendCommit='c'.repeat(40)],['source tree',x=>x.frontendTree='c'.repeat(40)],['source bytes',x=>x.readSource=()=>'' ],
    ['JARs',x=>x.jars=[]],['raw response',x=>x.fixture.first.body_base64='e30='],['response hash',x=>x.fixture.first.body_sha256='0'.repeat(64)],
    ['HTTP status',x=>x.fixture.first.status=500],['content type',x=>x.fixture.first.content_type='text/html'],['body binding',x=>x.fixture.first.request_body_sha256='0'.repeat(64)],
    ['nonce binding',x=>x.fixture.first.request_id='other'],['missing unresolved',x=>delete x.fixture.unresolved],['replayed fresh nonce',x=>x.fixture.retry=structuredClone(x.fixture.first)],
    ['requester rebind despite valid response hash',x=>{const body=JSON.parse(Buffer.from(x.fixture.first.body_base64,'base64'));body.data.requester.generation_id='foreign';const raw=Buffer.from(JSON.stringify(body));x.fixture.first.body_base64=raw.toString('base64');x.fixture.first.body_sha256=sha(raw);}],
    ['response query rebind despite valid response hash',x=>{const body=JSON.parse(Buffer.from(x.fixture.first.body_base64,'base64'));body.data.request_body_sha256=x.fixture.unresolved.request_body_sha256;const raw=Buffer.from(JSON.stringify(body));x.fixture.first.body_base64=raw.toString('base64');x.fixture.first.body_sha256=sha(raw);}],
  ])check('wire binder rejects '+label,()=>{const bad=fakeWire();mutate(bad);assert.throws(()=>verifyNativeDecisionPreparation(bad));});
  // Fake filesystem/process seam exercises the real retention functions. No
  // repository checkout or real directory is moved by these tests.
  function retention(){
    const options={workspace:'/work',temp:'/temp',commit:'a'.repeat(40),tree:'b'.repeat(40)};
    const source='/work/.custodial-backend-status-source',target='/temp/custodial-native-backend-source',lease='/temp/custodial-native-backend-retention.json';
    const dir=(ino=1)=>({uid:42,mode:0o700,dev:1,ino,isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false});
    const files=new Map([['/work',dir()],['/temp',dir()], [source,dir(7)],[source+'/.git',dir(8)]]),texts=new Map(),actions=[];
    const io={stat:path=>files.get(path),real:path=>path,uid:()=>42,git:(_path,args)=>args[0]==='status'?'':args[1]==='HEAD'?options.commit:options.tree,
      read:path=>texts.get(path),write:(path,text)=>{assert.ok(!files.has(path));texts.set(path,text);files.set(path,{...dir(),isDirectory:()=>false,isFile:()=>true,mode:0o600});actions.push('write');},
      move:(a,b)=>{actions.push('move');files.set(b,files.get(a));files.set(b+'/.git',files.get(a+'/.git'));files.delete(a);files.delete(a+'/.git');},
      chmod:()=>actions.push('chmod'),remove:path=>{actions.push('remove:'+path);files.delete(path);files.delete(path+'/.git');texts.delete(path);}};
    return {options,io,files,texts,actions,dir,source,target,lease};
  }
  check('exact clean owned source identity precedes move and exact inode cleanup',()=>{
    const f=retention(),receipt=retainBackendCheckout(f.options,f.io);assert.deepEqual(f.actions,['write','move','chmod']);assert.equal(receipt.ino,7);
    cleanupBackendCheckout(f.options,f.io);assert.equal(f.files.has(f.target),false);assert.equal(f.files.has(f.lease),false);
  });
  for(const [label,mutate] of [
    ['nested temp',f=>f.options.temp='/work/temp'],['relative temp',f=>f.options.temp='temp'],['symlink parent',f=>f.io.real=()=>'/elsewhere'],
    ['foreign owner',f=>f.files.get(f.source).uid=9],['symlink checkout',f=>f.files.get(f.source).isSymbolicLink=()=>true],['worktree gitfile',f=>f.files.get(f.source+'/.git').isDirectory=()=>false],
    ['existing target',f=>f.files.set(f.target,f.dir())],['dangling target symlink',f=>f.files.set(f.target,{isSymbolicLink:()=>true})],['existing lease',f=>f.files.set(f.lease,f.dir())],
    ['wrong commit',f=>f.io.git=()=> 'c'.repeat(40)],['wrong tree',f=>f.io.git=(_p,args)=>args[1]==='HEAD'?f.options.commit:'c'.repeat(40)],['dirty source',f=>f.io.git=(_p,args)=>args[0]==='status'?' M owned':args[1]==='HEAD'?f.options.commit:f.options.tree],
  ])check('relocation admission rejects '+label+' before mutation',()=>{const f=retention();mutate(f);assert.throws(()=>retainBackendCheckout(f.options,f.io));assert.deepEqual(f.actions,[]);});
  check('failed rename cleans exact original through prewritten lease',()=>{const f=retention();f.io.move=()=>{throw Error('rename failed');};assert.throws(()=>retainBackendCheckout(f.options,f.io));cleanupBackendCheckout(f.options,f.io);assert.ok(!f.files.has(f.source)&&!f.files.has(f.lease));});
  check('postmove identity mismatch does not delete substituted target',()=>{const f=retention(),move=f.io.move;f.io.move=(a,b)=>{move(a,b);f.files.get(b).ino=99;};assert.throws(()=>retainBackendCheckout(f.options,f.io));assert.throws(()=>cleanupBackendCheckout(f.options,f.io));assert.ok(f.files.has(f.target));assert.ok(!f.actions.some(x=>x.startsWith('remove:')));});
  check('postmove source check failure still cleans original inode',()=>{const f=retention(),git=f.io.git;f.io.git=(path,args)=>path===f.target?'changed':git(path,args);assert.throws(()=>retainBackendCheckout(f.options,f.io));cleanupBackendCheckout(f.options,f.io);assert.ok(!f.files.has(f.target));});
  check('early failure cleanup never removes pre-existing unowned destination',()=>{const f=retention();f.files.set(f.target,f.dir(99));assert.throws(()=>retainBackendCheckout(f.options,f.io));cleanupBackendCheckout(f.options,f.io);assert.ok(f.files.has(f.target));assert.ok(!f.files.has(f.source));});
  for(const mutate of [f=>f.files.get(f.lease).uid=8,f=>f.files.get(f.lease).mode=0o644,f=>f.texts.set(f.lease,f.texts.get(f.lease).replace(f.target,'/outside')),f=>f.files.set(f.source,f.dir(99)),f=>f.files.get(f.target).isSymbolicLink=()=>true])
    check('cleanup rejects changed lease or redirected ownership',()=>{const f=retention();retainBackendCheckout(f.options,f.io);mutate(f);assert.throws(()=>cleanupBackendCheckout(f.options,f.io));assert.ok(!f.actions.some(x=>x.startsWith('remove:')));});
  const helper=readFileSync('scripts/native-actual-sql-fixtures.mjs','utf8');
  check('hosted phases require strict resolver, matching standalone consumption and sealed cleanup',()=>{
    for(const token of ["'--dependency-verification','strict'","validateGradleWrapperJar(jar)","validateGradleVerificationMetadata(verification,'custodial')","assertNativeWireJarRows(rows)","'frontend remains strictly clean; signed backend must be retained outside it'","assert.equal(tree,env.NATIVE_SQL_EXPECTED_BACKEND_TREE","NATIVE_PROVIDER_EVENT_DECISION_INPUT_SHA256:sha(prepared)","NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256:sha(bytes)","native_consumption_tests:390"])assert.ok(helper.includes(token),token);
    const queryAt=helper.indexOf('const nativeQuery=prepareNativeDecisionQuery');assert.ok(queryAt<helper.indexOf('for (const job of jobs)',queryAt));
    assert.ok(helper.indexOf('command(commands.sql.program')<helper.indexOf('command(commands.consume.program'));
    assert.ok(helper.indexOf('command(commands.consume.program')<helper.indexOf('writeFileSync(join(directory,wireJob.file)'));
    assert.match(workflow,/--verify-checkout[^\n]*\n[^\n]*\n\s*printf 'NATIVE_SQL_EXPECTED_BACKEND_TREE/);
    assert.match(workflow,/native-actual-sql-fixtures\.mjs --retain-backend/);assert.match(workflow,/native-actual-sql-fixtures\.mjs --cleanup-backend/);
    assert.equal((workflow.match(/NATIVE_SQL_BACKEND_CHECKOUT: \$\{\{ runner.temp \}\}\/custodial-native-backend-source/g)||[]).length,3);
  });
  const invalid = spawnSync(process.execPath, ['scripts/native-actual-sql-fixtures.mjs', '--prepare'], {
    encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: root, NATIVE_SQL_BACKEND_CHECKOUT: root, NATIVE_SQL_EXPECTED_BACKEND_COMMIT: '0'.repeat(40) },
  });
  check('wrong signed source cannot start SQL fixture generation', () => { assert.notEqual(invalid.status, 0); assert.match(invalid.stderr, /failed|commit|git/); });
  console.log(JSON.stringify({ status: 'PASS', checks, synthetic: true, sql_runner_invoked: false }));
} finally {
  rmSync(root, { recursive: true, force: true });
}
