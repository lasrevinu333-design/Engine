import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {providerDecisionWirePins as pins,validateProviderDecisionWirePins,withoutProviderDecisionWire} from './provider-event-decision-wire-source-boundary.mjs';
import {withoutProviderDecisionCurrent219} from './provider-event-decision-current219-source-boundary.mjs';
import {runProviderDecisionCurrent219ContractTests} from './provider-event-decision-current219-contract-tests.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const rawCurrent=readFileSync(pins.path,'utf8');
check('current219 helper and invoked owning test are exact dependencies',()=>{assert.equal(sha(readFileSync('scripts/provider-event-decision-current219-source-boundary.mjs')),'d09dece33d9c2e17b1b6ab54b33e9fd1f90ca55b7b768028609939580a4fd048');assert.equal(sha(readFileSync('scripts/provider-event-decision-current219-contract-tests.mjs')),'ddcf15771ca413317e21766b8677eac83c3cd796a02ce2ec38fb64b2b1525962');});
check('mandatory owning current219 consumer tests actually execute',()=>{assert.deepEqual(runProviderDecisionCurrent219ContractTests(),{status:'PASS',checks:74,scope:'current219 manifest actual pure consumer and finite reverse source delta only',jvm:false,sql:false,browser:false});});
const current=withoutProviderDecisionCurrent219(pins.path,rawCurrent);
check('exact wire predecessor after separately pinned219 delta and preserved Fa34d source',()=>{assert.equal(pins.base,'a34d1ac609644fb7cf20c24f6b4d31e9e841e759');assert.equal(sha(current),pins.current_sha256);assert.equal(sha(withoutProviderDecisionWire(pins.path,rawCurrent)),'bbbc0947510c17bdc07ea39040e08afd63f0181d590103042541af70320b8764');});
const prior=withoutProviderDecisionWire(pins.path,current);
check('predecessor comparison is idempotent but not current-source acceptance',()=>{assert.equal(withoutProviderDecisionWire(pins.path,prior),prior);assert.notEqual(sha(prior),pins.current_sha256);});
for(const changed of [current+'\n// extra',current.slice(1),prior+' ',current.replace('Xmx256m','Xmx512m'),current.replace('timeout: 120000','timeout: 240000')])
 check('outside/exact-hunk mutation cannot normalize',()=>assert.throws(()=>withoutProviderDecisionWire(pins.path,changed)));
for(const mutate of [x=>x.extra=true,x=>x.base='0'.repeat(40),x=>x.path='../other',x=>x.prior_sha256='0'.repeat(64),x=>x.current_sha256='0'.repeat(64),
 x=>x.hunks.pop(),x=>x.hunks.reverse(),x=>x.hunks.push(x.hunks[0]),x=>x.hunks[0].extra=true,x=>x.hunks[0].old_start++,x=>x.hunks[0].new_start++,
 x=>x.hunks[0].old_count++,x=>x.hunks[0].new_count++,x=>x.hunks[0].after.push(''),x=>x.hunks[0].before.push(''),x=>x.pinned.pop(),x=>x.pinned[0].sha256='0'.repeat(64)])
 check('malformed/extra/reordered full delta or new-test pin rejects',()=>{const bad=structuredClone(pins);mutate(bad);assert.throws(()=>validateProviderDecisionWirePins(bad));});
for(const bad of [null,{},[],{hunks:[]},'other'])check('unknown pin object rejects',()=>assert.throws(()=>validateProviderDecisionWirePins(bad)));
check('new Java test is an exact pinned input, not an untracked dependency',()=>{assert.equal(pins.pinned.length,1);assert.equal(sha(readFileSync(pins.pinned[0].path)),pins.pinned[0].sha256);});
check('all previous F6 pins remain verbatim',()=>assert.equal(sha(readFileSync('scripts/fixtures/provider-event-decisions-byte-deltas.json')),'904a8e1caf413dc7b22189bc3772599b6d394faf4763fe7e726cdd149694e3f8'));
check('exact owning portable helper with finite219 predecessor layer',()=>assert.equal(sha(readFileSync('scripts/provider-event-decision-wire-source-boundary.mjs')),'c0cfce6400bededdb018b8b807ef1abc5cd99d18a20da65c1a47ea03abd1925f'));
check('prepare is a single finite class and never default suite skipping',()=>{assert.ok(current.includes("process.argv[2] === '--prepare-event-decision-fixture'"));assert.ok(current.includes('assert.ok(!(prepareDecision && decisionFixture)'));assert.ok(current.includes("...(prepareDecision ? [`org.memphiszoo.custodial.vault.${wireClass}`, preparationDirectory] : ['org.junit.runner.JUnitCore'"));assert.equal((current.match(/tests.push\(wireClass\)/g)||[]).length,1);assert.equal((prior.match(/tests.push\('NativeProviderEventDecisionsTest'\)/g)||[]).length,1);});
check('query preparation and consumer require same clean source and all four JAR hashes',()=>{for(const text of ["git('status', '--porcelain')","frontendBinding.files","frontendBinding.jars","value.native_input.frontend, frontendBinding","NATIVE_PROVIDER_EVENT_DECISION_FIXTURE_SHA256","sha(JSON.stringify(value.native_input,null,2)+'\\n')"])assert.ok(current.includes(text),text);});
check('private new output, no network/install, and exact cleanup remain',()=>{for(const text of ['st.mode & 0o077','readdirSync(preparationDirectory).length, 0',"flag:'wx', mode:0o600",'process.umask(priorMask)',"rmSync(owned, { recursive: true, force: true })"])assert.ok(current.includes(text),text);assert.doesNotMatch(current,/https?:\/\/|npm install|curl |wget /);});
const java=readFileSync(pins.pinned[0].path,'utf8');
const methods=[...java.matchAll(/@Test public void ([A-Za-z0-9]+)\(/g)].map(x=>x[1]);
check('six exact mandatory methods in selected bridge with no skipped test',()=>{assert.deepEqual(methods,[
 'actualSqlCurrentHmacResponseSettlesOnlyFourExactJavaOriginals','actualFreshHttpRetryAfterLostResponsePreservesOriginalIdentity',
 'actualUnresolvedOriginalRemainsPendingByteExactWhileAcceptedSettle','actualResponseCannotBeReboundToAnotherNonceBodyOrRequester',
 'currentRemovalOrRotationFencesLateActualResponseWithoutWrites','actualReceiptAmbiguousCommitReadbackDoesNotAppendOrReplayEffects']);assert.doesNotMatch(java,/@Ignore|Assume\.|assumeTrue|@Disabled/);});
check('actual Query bytes are reconstructed and raw HTTP nonce/hash are never substituted',()=>{for(const text of ['f.journal().prepareEventDecisions','query.request().body','assertArrayEquals(Base64.getDecoder()','row.getString("request_id")','row.getString("request_body_sha256")','NativeProviderEventDecisions.validate(query, exchange(which))'])assert.ok(java.includes(text),text);});
check('synthetic seed records stay private test stores; no product reflection or external invocation',()=>{assert.ok(java.includes('NativeProviderJournalTest.v1()'));assert.ok(java.includes('synthetic-F6-Java-query-token-not-production'));assert.ok(java.includes('StandardOpenOption.CREATE_NEW'));assert.doesNotMatch(java,/setAccessible|Class\.forName|Runtime\.getRuntime|ProcessBuilder|java\.net\./);});
check('actual SQL full manifest and successful cleanup are mandatory consumption conditions',()=>{for(const text of ["'actual_sql','actual_http_hmac','cleanup_verified'",'24503cfe852d7668ac94744b2f9ed21d8d2556906b917c7016e0f6c2d3b8d7a1','automatic_grants_absent_before_and_after_each','20261004000000_native_provider_event_decision_lookup.sql'])assert.ok(current.includes(text));});
console.log(JSON.stringify({status:'NATIVE_EVENT_DECISION_WIRE_PREPARATION_SOURCE_PASS',checks,scope:'finite test-only runner/source guard; JVM and SQL not executed',methods}));
