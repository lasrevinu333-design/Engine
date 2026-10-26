package org.memphiszoo.custodial.vault;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual enrollment/principal/encrypted provider owners; synthetic storage, transport
 * and OS surface. These tests grant no clock profile or provider effect admission. */
public final class NativeProviderRuntimeOwnerTest {
    /** Compose ONLY the new overload with existing original Composition owners
     * and its SYNTHETIC clock/profile. No new admission/profile or network is
     * supplied: any attempted transport, nonce or refresh fails this case. */
    private static NativeProviderRuntimeOwner mirrorEpochOwner(NativeProviderCompositionTest.Composition x,
        NativeProviderClaims.AttachmentFence fence)throws Exception {
        NativeProviderClockExchange.Readings readings=()->new NativeProviderClockExchange.Point(x.elapsed,7);
        NativeProviderAppIdentity app=NativeProviderJournalTest.app();
        NativeProviderHttp http=new NativeProviderHttp(url->{throw new AssertionError("mirror lifecycle opened HTTP");},
            ()->NativeProviderHttpTest.NOW,()->{throw new AssertionError("mirror lifecycle allocated transport request ID");},readings);
        return new NativeProviderRuntimeOwner(x.f.engine,x.f.principalJournal,x.f.legacyJournal,x.journal,x.f.provider.storage.lock,x.surface,
            new NativeProviderRuntimeOwner.Delivery(actual->x.profile,NativeProviderTimeTest.platform(),readings,()->app,http,x.jobs,
                (registration,attempt)->{throw new AssertionError("mirror lifecycle refreshed a token");}),fence);
    }
    private static String mirrorEpochAttachmentId(Map<String,Object> snapshot){
        assertEquals(java.util.Set.of("schema","attachment_id","runtime_incarnation","revision","state","audio_ready"),snapshot.keySet());
        assertEquals("custodial.provider-mirror-attachment.v1",snapshot.get("schema"));assertEquals("ATTACHED",snapshot.get("state"));
        assertEquals(Boolean.FALSE,snapshot.get("audio_ready"));assertTrue(snapshot.get("attachment_id") instanceof String);
        return (String)snapshot.get("attachment_id");
    }
    @Test public void mirrorEpochAliasTracksPluginAndRejectsOldSameOwnerCallbacks()throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderPayload payload=NativeProviderIngressTest.payload(x.f.prepared);
        x.inventoryRows=new NativeProviderPayload[]{payload};x.sync(); // Existing UNIT arrangement, not an old @Test.
        Object plugin=new Object(),firstEpoch=new Object(),nextEpoch=new Object();
        var epoch=new java.util.concurrent.atomic.AtomicReference<Object>(firstEpoch);
        var fenceReads=new java.util.concurrent.atomic.AtomicInteger();
        NativeProviderRuntimeOwner owner=mirrorEpochOwner(x,actual->{
            assertSame("private mirror alias must resolve to the actual plugin",plugin,actual);
            assertTrue(Thread.holdsLock(x.f.engine));assertTrue(Thread.holdsLock(x.f.provider.storage.lock));
            fenceReads.incrementAndGet();return epoch.get();
        });
        Map<String,Object> raw=new HashMap<>(x.f.provider.storage.memory.raw);JSONObject inbox=x.inbox(payload.recordId);
        int commits=x.f.provider.storage.memory.commits,keys=x.f.provider.storage.keys.creations;
        int paths=x.paths.size(),tokens=x.tokens,shows=x.surface.shows,cancels=x.surface.cancels;
        Map<String,String> active=new HashMap<>(x.surface.active);
        int scheduled=x.jobs.scheduled,inspected=x.jobs.inspected,vaultCommits=x.f.persistence.commitAttempts.get();
        var vault=x.f.persistence.current();Object key=x.f.provider.storage.keys.value;
        int[] firstHints={0},nextHints={0};
        owner.attach(plugin,firstEpoch);
        Map<String,Object> first=owner.mirrorAttach(plugin,(incarnation,revision)->{
            assertTrue(Thread.holdsLock(x.f.engine));assertTrue(Thread.holdsLock(x.f.provider.storage.lock));firstHints[0]++;
        });
        String firstId=mirrorEpochAttachmentId(first);
        ProviderRecordStoreTest.failure("custodial_provider_audio_stop_unconfirmed",()->owner.mirrorClaimNext(plugin,firstId));
        owner.mirrorStopped(plugin,firstId);int reads=fenceReads.get();
        JSONObject firstClaim=owner.mirrorClaimNext(plugin,firstId);assertNotNull(firstClaim);assertTrue(fenceReads.get()>reads);
        assertEquals(5,firstClaim.length());assertTrue(ProviderWireJson.same(payload.json(),firstClaim.getJSONObject("payload")));
        String firstClaimId=firstClaim.getString("claim_id");
        assertTrue(owner.mirrorClaimState(plugin,firstId,firstClaimId).getBoolean("current"));
        epoch.set(nextEpoch); // Withdrawal DATA only: same Java plugin, different native resume observation.
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorClaimState(plugin,firstId,firstClaimId));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorApply(plugin,firstId,firstClaimId,"acknowledged"));
        owner.attach(plugin,nextEpoch);
        Map<String,Object> next=owner.mirrorAttach(plugin,(incarnation,revision)->{
            assertTrue(Thread.holdsLock(x.f.engine));assertTrue(Thread.holdsLock(x.f.provider.storage.lock));nextHints[0]++;
        });
        String nextId=mirrorEpochAttachmentId(next);assertNotEquals(firstId,nextId);
        assertEquals(first.get("runtime_incarnation"),next.get("runtime_incarnation"));int retiredHints=firstHints[0];
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorStopped(plugin,firstId));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorDetach(plugin,firstId));
        ProviderRecordStoreTest.failure("custodial_provider_audio_stop_unconfirmed",()->owner.mirrorClaimNext(plugin,nextId));
        owner.mirrorStopped(plugin,nextId);JSONObject nextClaim=owner.mirrorClaimNext(plugin,nextId);assertNotNull(nextClaim);
        String nextClaimId=nextClaim.getString("claim_id");assertNotEquals(firstClaimId,nextClaimId);
        assertTrue(ProviderWireJson.same(firstClaim.getJSONObject("payload"),nextClaim.getJSONObject("payload")));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->owner.mirrorClaimState(plugin,nextId,firstClaimId));
        ProviderRecordStoreTest.failure("custodial_provider_claim_invalid",()->owner.mirrorApply(plugin,nextId,firstClaimId,"acknowledged"));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorRetire(plugin,firstId,firstClaimId));
        assertTrue(owner.mirrorClaimState(plugin,nextId,nextClaimId).getBoolean("current"));
        assertEquals(retiredHints,firstHints[0]);assertEquals(1,nextHints[0]);
        assertEquals(raw,x.f.provider.storage.memory.raw);assertEquals(commits,x.f.provider.storage.memory.commits);
        assertTrue(ProviderWireJson.same(inbox,x.inbox(payload.recordId)));assertEquals(keys,x.f.provider.storage.keys.creations);
        assertSame(key,x.f.provider.storage.keys.value);assertSame(vault,x.f.persistence.current());
        assertEquals(vaultCommits,x.f.persistence.commitAttempts.get());assertEquals(0,x.f.cipher.destroyCalls);
        assertEquals(paths,x.paths.size());assertEquals(tokens,x.tokens);assertEquals(shows,x.surface.shows);assertEquals(cancels,x.surface.cancels);
        assertEquals(active,x.surface.active);
        assertEquals(scheduled,x.jobs.scheduled);assertEquals(inspected,x.jobs.inspected);
    }
    @Test public void mirrorEpochStaleAttachAndLateDetachLeaveCurrentAttachmentIntact()throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderPayload payload=NativeProviderIngressTest.payload(x.f.prepared);x.inventoryRows=new NativeProviderPayload[]{payload};x.sync();
        Object plugin=new Object(),firstEpoch=new Object(),nextEpoch=new Object();
        var epoch=new java.util.concurrent.atomic.AtomicReference<Object>(firstEpoch);
        NativeProviderRuntimeOwner owner=mirrorEpochOwner(x,actual->{
            assertSame("fence never admits the mirror's private owner as a new plugin",plugin,actual);
            assertTrue(Thread.holdsLock(x.f.engine));assertTrue(Thread.holdsLock(x.f.provider.storage.lock));return epoch.get();
        });
        Map<String,Object> raw=new HashMap<>(x.f.provider.storage.memory.raw);JSONObject inbox=x.inbox(payload.recordId);
        int commits=x.f.provider.storage.memory.commits,keys=x.f.provider.storage.keys.creations;
        int paths=x.paths.size(),tokens=x.tokens,shows=x.surface.shows,cancels=x.surface.cancels;
        Map<String,String> active=new HashMap<>(x.surface.active);
        int scheduled=x.jobs.scheduled,inspected=x.jobs.inspected,vaultCommits=x.f.persistence.commitAttempts.get();
        var vault=x.f.persistence.current();Object key=x.f.provider.storage.keys.value;int[] hints={0};
        owner.attach(plugin,firstEpoch);String oldId=mirrorEpochAttachmentId(owner.mirrorAttach(plugin,(incarnation,revision)->{}));
        owner.mirrorStopped(plugin,oldId);JSONObject oldClaim=owner.mirrorClaimNext(plugin,oldId);assertNotNull(oldClaim);
        epoch.set(nextEpoch);owner.attach(plugin,nextEpoch);
        String currentId=mirrorEpochAttachmentId(owner.mirrorAttach(plugin,(incarnation,revision)->{
            assertTrue(Thread.holdsLock(x.f.engine));assertTrue(Thread.holdsLock(x.f.provider.storage.lock));hints[0]++;
        }));
        owner.mirrorStopped(plugin,currentId);JSONObject currentClaim=owner.mirrorClaimNext(plugin,currentId);assertNotNull(currentClaim);
        String currentClaimId=currentClaim.getString("claim_id");assertNotEquals(oldClaim.getString("claim_id"),currentClaimId);
        int currentHints=hints[0];
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.attach(plugin,firstEpoch));
        assertTrue(owner.mirrorClaimState(plugin,currentId,currentClaimId).getBoolean("current"));assertEquals(currentHints,hints[0]);
        owner.detach(plugin,firstEpoch); // Exact stale cleanup must not touch the successor mirror or alias-bound claims.
        assertTrue(owner.mirrorClaimState(plugin,currentId,currentClaimId).getBoolean("current"));assertEquals(currentHints,hints[0]);
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorStopped(plugin,oldId));
        epoch.set(null);owner.detach(plugin,nextEpoch); // Cleanup binds the captured epoch, not today's revoked fence result.
        assertEquals(currentHints+1,hints[0]);
        epoch.set(nextEpoch); // UNIT probe only: restoring a value cannot restore a retired mirror/callback.
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorStopped(plugin,currentId));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorClaimNext(plugin,currentId));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorClaimState(plugin,currentId,currentClaimId));
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->owner.mirrorApply(plugin,currentId,currentClaimId,"acknowledged"));
        assertEquals(raw,x.f.provider.storage.memory.raw);assertEquals(commits,x.f.provider.storage.memory.commits);
        assertTrue(ProviderWireJson.same(inbox,x.inbox(payload.recordId)));assertEquals(keys,x.f.provider.storage.keys.creations);
        assertSame(key,x.f.provider.storage.keys.value);assertSame(vault,x.f.persistence.current());
        assertEquals(vaultCommits,x.f.persistence.commitAttempts.get());assertEquals(0,x.f.cipher.destroyCalls);
        assertEquals(paths,x.paths.size());assertEquals(tokens,x.tokens);assertEquals(shows,x.surface.shows);assertEquals(cancels,x.surface.cancels);
        assertEquals(active,x.surface.active);
        assertEquals(scheduled,x.jobs.scheduled);assertEquals(inspected,x.jobs.inspected);
    }
    static final String OP = NativeProviderHttpTest.OP, RID = NativeProviderHttpTest.RID, DEVICE = NativeProviderHttpTest.DEVICE;
    @Test public void boundedOwnerLooksUpOriginalDecisionsBeforeRetryingExactlyThoseEvents() throws Exception {
        for(boolean legacy:new boolean[]{false,true}) {
            NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(legacy);
            NativeProviderHttpTest.admittedEvent(x.f);x.paths.clear();x.requests.clear();
            x.sync();
            int decision=x.paths.indexOf(NativeProviderEventDecisions.PATH),events=x.paths.indexOf("/employee-notifications-api/native-provider/events");
            assertTrue(decision>=0);assertEquals(decision+1,events);
            assertTrue(ProviderWireJson.same(x.requests.get(decision).getJSONArray("events"),x.requests.get(events).getJSONArray("events")));
            assertTrue(x.requests.get(decision).getJSONArray("events").length()<=16);
        }
    }
    @Test public void ambiguousDecisionNeverFallsBackToAdmissionAndSingleflightReleases() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderJournal.EventBatch original=NativeProviderHttpTest.admittedEvent(x.f);
        x.duringHttp=()->{if(x.paths.get(x.paths.size()-1).equals(NativeProviderEventDecisions.PATH))throw new java.io.IOException("synthetic loss");};
        ProviderRecordStoreTest.failure("custodial_provider_network_unavailable",x::sync);
        assertFalse(x.paths.contains("/employee-notifications-api/native-provider/events"));assertEquals(0,x.surface.shows);
        assertArrayEquals(original.body(),x.journal.pendingEvents(x.f.principal,16).body());
        x.duringHttp=null;x.sync();assertTrue(x.paths.contains("/employee-notifications-api/native-provider/events"));
    }
    @Test public void qualifiedProfileLossAfterLookupCannotAuthorizeOriginalRetryOrNewEffect() throws Exception {
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderJournal.EventBatch original=NativeProviderHttpTest.admittedEvent(x.f);
        x.duringHttp=()->{if(x.paths.get(x.paths.size()-1).equals(NativeProviderEventDecisions.PATH))x.profile=null;};
        ProviderRecordStoreTest.failure("custodial_provider_clock_unqualified",x::sync);
        assertFalse(x.paths.contains("/employee-notifications-api/native-provider/events"));assertEquals(0,x.surface.shows);
        assertArrayEquals(original.body(),x.journal.pendingEvents(x.f.principal,16).body());
    }
    static final class Fixture {
        final NativeProviderHttpTest.Fixture f;
        final VaultEngine engine;
        final NativeProviderDisplayDriverTest.Surface surface = new NativeProviderDisplayDriverTest.Surface();
        NativeProviderRuntimeOwner owner;
        NativeProviderPayload payload;
        int gateCalls;
        boolean allowed = true;
        Fixture(boolean legacy) throws Exception {
            f = new NativeProviderHttpTest.Fixture(legacy); f.send(false, f.http());
            if (legacy) {
                // The old lineage fixture's FakeTransport has no enrollment row
                // for a migrated credential. Supply an exact synthetic removal
                // receipt while retaining the ACTUAL engine and protected snapshot.
                EnrollmentTransport transport = (EnrollmentTransport) Proxy.newProxyInstance(EnrollmentTransport.class.getClassLoader(), new Class<?>[]{EnrollmentTransport.class}, (proxy, method, args) -> {
                    if (method.getName().equals("remove")) {
                        assertEquals(DEVICE, args[1]); assertEquals(NativeLegacyLineageJournalTest.OLD, new String((char[]) args[2]));
                        return new TerminalResult((String) args[0], false);
                    }
                    try { return method.invoke(f.legacy, args); } catch (InvocationTargetException failure) { throw failure.getCause(); }
                });
                engine = new VaultEngine(f.persistence, f.cipher, transport, f.legacy.legacy, f.legacy.seal, f.legacy.clock);
            } else engine = f.engine;
            payload = NativeProviderIngressTest.payload(f.prepared);
            f.provider.journal().recordArrival(f.principal, payload, NativeProviderIngressTest.observation(NativeProviderIngressTest.NOW, 101, 7));
            owner = reconstruct();
        }
        NativeProviderRuntimeOwner reconstruct() {
            return new NativeProviderRuntimeOwner(engine, f.principalJournal, f.legacyJournal,
                f.provider.journal(), f.provider.storage.lock, surface);
        }
        NativeProviderRemovalCoordinator removal() {
            return new NativeProviderRemovalCoordinator(engine, new RemovalCoordinator(engine, (op, device) -> {
                assertFalse(Thread.holdsLock(engine)); assertFalse(Thread.holdsLock(f.provider.storage.lock));
                gateCalls++; return allowed;
            }), owner);
        }
        JSONObject meta() throws Exception { return f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA, "journal"); }
        JSONObject inbox() throws Exception { return f.provider.read(ProviderEnvelopeCrypto.Domain.INBOX, payload.recordId); }
        long events() throws Exception { return f.provider.storage.store().load().keys().stream().filter(k -> k.domain == ProviderEnvelopeCrypto.Domain.EVENT).count(); }
    }
    /** Real Android provider WORK gates/retained store on recording preferences;
     * existing encrypted journal constructors and an owned OS surface only.
     * The fixture hold is synthetic, not authenticated manager/physical proof. */
    static final class FencedCancellationFixture {
        final NativeProviderPresentationTest.Fixture original=new NativeProviderPresentationTest.Fixture();
        final AndroidProviderAdapterTest.Preferences preferences=new AndroidProviderAdapterTest.Preferences();
        final AndroidProviderAdapterTest.Preferences work=new AndroidProviderAdapterTest.Preferences();
        final AndroidProtectedWorkPreferences gate=new AndroidProtectedWorkPreferences(work.object());
        final ProviderRecordStoreTest.Keys keys=original.f.r.f.storage.keys;
        final NativeProviderDisplayDriverTest.Surface surface=new NativeProviderDisplayDriverTest.Surface();
        final MemoryPersistence persistence=new MemoryPersistence();
        final TestCipher cipher=new TestCipher();
        final VaultEngine engine;
        final NativeProviderJournal journal;
        final NativeProviderRuntimeOwner owner;
        FencedCancellationFixture(boolean pending)throws Exception{
            if(pending)original.journal().requestOsCancellation(original.principal,original.presentation);
            preferences.disk.putAll(original.f.r.f.storage.memory.raw);
            journal=newJournal();
            MutableClock clock=new MutableClock(NativeProviderHttpTest.NOW);
            engine=new VaultEngine(persistence,cipher,new FakeTransport(clock),new FakeLegacySource(),new TestSealGenerator(),clock,
                ()->gate.withOrdinaryWorkAdmission(()->null));
            owner=new NativeProviderRuntimeOwner(engine,new NativePrincipalJournal(new NativePrincipalJournalTest.Memory()),
                new NativeLegacyLineageJournal(new NativeLegacyLineageJournalTest.Store()),journal,AndroidProviderCipher.STORE_LOCK,surface);
        }
        NativeProviderJournal newJournal(){
            ProviderRecordStore store=new AndroidProviderStore(preferences.object(),gate,
                AndroidProviderAdapterTest.crypto(preferences,keys)).records();
            return new NativeProviderJournal(store,AndroidProviderCipher.STORE_LOCK);
        }
        void hold()throws Exception{gate.freeze(gate.protectedSnapshot(),"SYNTHETIC_SOURCE_ONLY_WORK_HOLD");}
        String providerHash()throws VaultFailure{return NativeProviderPrincipal.hash(new java.util.TreeMap<>(preferences.disk).toString());}
        String workHash()throws VaultFailure{return NativeProviderPrincipal.hash(new java.util.TreeMap<>(work.disk).toString());}
        String tag(){return "mz-provider:"+original.f.payload.recordId;}
    }
    @Test public void retainedFenceCancelsOnlyOriginalTagWithoutProfilePrincipalOrFrozenWrites()throws Exception{
        FencedCancellationFixture f=new FencedCancellationFixture(true);f.hold();
        String provider=f.providerHash(),work=f.workHash();int creates=f.keys.creations;
        f.surface.active=NativeProviderDisplayDriver.Active.MATCH;
        assertFalse("OS absence does not confirm the frozen durable intent",f.owner.reconcileLocalEffects());
        assertEquals(java.util.List.of(f.tag()),f.surface.tags);assertEquals(1,f.surface.cancellations);assertEquals(0,f.surface.shows);
        assertEquals(provider,f.providerHash());assertEquals(work,f.workHash());assertEquals(0,f.preferences.commits);
        assertEquals(creates,f.keys.creations);assertEquals(0,f.cipher.destroyCalls);
        assertEquals(1,f.journal.retainedPendingOsCancellations().size());
        ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE,()->f.engine.getState());
    }
    @Test public void retainedFenceFailedOsReadbackPreservesOriginalUntilNormalSuccessorCleanup()throws Exception{
        FencedCancellationFixture f=new FencedCancellationFixture(true);f.hold();String before=f.providerHash();
        f.surface.active=NativeProviderDisplayDriver.Active.MATCH;f.surface.cancelWorks=false;
        ProviderRecordStoreTest.failure("custodial_provider_os_cancel_unconfirmed",()->f.owner.reconcileLocalEffects());
        assertEquals(before,f.providerHash());assertEquals(0,f.preferences.commits);assertEquals(1,f.journal.retainedPendingOsCancellations().size());
        f.surface.cancelWorks=true;assertFalse(f.owner.reconcileLocalEffects());assertEquals(before,f.providerHash());
        // Fixture-only end of hold. No production freeze cancellation authority
        // is obtained from this test or from the local OS absence observation.
        f.work.disk.remove(AndroidProtectedWorkPreferences.FENCE_KEY);
        assertTrue(f.owner.reconcileLocalEffects());assertEquals(0,f.journal.pendingOsCancellations().size());
        assertEquals(3,f.surface.cancellations);assertEquals(0,f.surface.shows);
        for(String tag:f.surface.tags)assertEquals(f.tag(),tag);
    }
    @Test public void retainedFenceNeverInventsPendingIntentFromLiveOrMissingRecords()throws Exception{
        FencedCancellationFixture f=new FencedCancellationFixture(false);f.hold();String before=f.providerHash();
        assertFalse(f.owner.reconcileLocalEffects());assertEquals(0,f.surface.cancellations);assertEquals(before,f.providerHash());
        f.preferences.disk.clear();
        ProviderRecordStoreTest.failure("custodial_provider_retained_namespace_missing",()->f.owner.reconcileLocalEffects());
        assertEquals(0,f.surface.cancellations);assertEquals(0,f.preferences.commits);
    }
    @Test public void unknownEngineReadCannotBeMaskedAsCancellationPermission()throws Exception{
        FencedCancellationFixture f=new FencedCancellationFixture(true);String before=f.providerHash();f.persistence.failLoads=1;
        ProviderRecordStoreTest.failure("test_load_failure",()->f.owner.reconcileLocalEffects());
        assertEquals(0,f.surface.cancellations);assertEquals(before,f.providerHash());assertEquals(0,f.preferences.commits);
    }
    /** Existing actual runtime composition and synthetic clock/OS callbacks.
     * No genuine profile, Android effect or real transport qualification. */
    @Test public void normalCancellationFailureStillReconcilesAlreadyOwnedStaleAudio()throws Exception{
        normalCancellationAudioCleanup(true,true);
    }
    @Test public void normalCancellationFailureSuppressesUnknownAudioQuietAndRetainsOwnership()throws Exception{
        normalCancellationAudioCleanup(false,true);
    }
    @Test public void normalCancellationFailureSuppressesUnknownAudioReleaseAndRetainsOwnership()throws Exception{
        normalCancellationAudioCleanup(true,false);
    }
    private void normalCancellationAudioCleanup(boolean quiet,boolean release)throws Exception{
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderAudioSequenceTest.Fixture sdk=new NativeProviderAudioSequenceTest.Fixture();
        x.audioSurface=sdk;x.audioScheduler=sdk;x.owner=x.reconstruct();
        NativeProviderPayload original=NativeProviderIngressTest.payload(x.f.prepared);
        x.inventoryRows=new NativeProviderPayload[]{original};x.sync();
        assertEquals(java.util.List.of("tone"),sdk.effects);
        assertEquals("IN_PROGRESS",x.inbox(original.recordId).getString("audio_state"));
        NativeProviderAudioSequence.Result oldTone=sdk.tone;
        NativeProviderJournal.Presentation presentation=x.journal.presentation(x.f.principal,original.recordId);
        x.journal.requestOsCancellation(x.f.principal,presentation);
        // Existing journal currentness invalidates only this captured episode;
        // the protected actor is still the original, normally admitted actor.
        x.journal.observeUnavailable();x.journal.observeActivePrincipal(x.f.principal);
        int paths=x.paths.size(),shows=x.surface.shows,cancels=x.surface.cancels;
        java.util.Map<String,Object> ciphertext=new java.util.HashMap<>(x.f.provider.storage.memory.raw);
        sdk.quiet=quiet;sdk.release=release;x.f.provider.storage.memory.reject=true;
        try{x.owner.reconcileLocalEffects();fail("failed cancellation cannot report settled");}
        catch(VaultFailure originalFailure){
            assertEquals("custodial_provider_commit_failed_preserved",originalFailure.code);
            assertTrue("owned stale audio cleanup was skipped",sdk.effects.contains("stop"));
            assertEquals(quiet&&release?0:1,originalFailure.getSuppressed().length);
            if(!quiet||!release)assertEquals("custodial_provider_audio_stop_unconfirmed",
                ((VaultFailure)originalFailure.getSuppressed()[0]).code);
        }
        assertEquals(cancels+1,x.surface.cancels);assertEquals(shows,x.surface.shows);
        assertEquals(paths,x.paths.size());assertEquals(ciphertext,x.f.provider.storage.memory.raw);
        assertTrue(x.inbox(original.recordId).getBoolean("os_cancel_pending"));
        assertEquals("IN_PROGRESS",x.inbox(original.recordId).getString("audio_state"));
        assertTrue("stale timer must be cancelled",sdk.timers.isEmpty());
        int effects=sdk.effects.size();oldTone.done(true);assertEquals(effects,sdk.effects.size());
        assertEquals(1,sdk.effects.stream().filter("tone"::equals).count());assertTrue(sdk.texts.isEmpty());
        if(quiet&&release)assertEquals(java.util.List.of("tone","stop","release"),sdk.effects);
        else assertNotNull("unknown quiet/release keeps an owned stop callback",sdk.stop);
        // Exact existing callback/normal cancellation successor only. No new
        // audio start, generated identity, replay or manufactured completion.
        sdk.quiet=true;sdk.release=true;if(!quiet||!release)sdk.stop.done(true);
        x.f.provider.storage.memory.reject=false;
        assertTrue(x.owner.reconcileLocalEffects());
        assertFalse(x.inbox(original.recordId).getBoolean("os_cancel_pending"));
        assertEquals("IN_PROGRESS",x.inbox(original.recordId).getString("audio_state"));
        assertEquals(paths,x.paths.size());assertEquals(shows,x.surface.shows);
    }
    /** Direct ordinary owner entrypoint; real owner/currentness/journal, existing
     * synthetic audio/clock/transport fixtures only. No platform qualification. */
    @Test public void directReconcileAuthorityFailureStillCleansOwnedStaleAudio()throws Exception{
        directReconcileAudioCleanup(true,true);
    }
    @Test public void directReconcileAuthorityFailureKeepsUnknownQuietOwnedAndSuppressed()throws Exception{
        directReconcileAudioCleanup(false,true);
    }
    @Test public void directReconcileAuthorityFailureKeepsUnknownReleaseOwnedAndSuppressed()throws Exception{
        directReconcileAudioCleanup(true,false);
    }
    private void directReconcileAudioCleanup(boolean quiet,boolean release)throws Exception{
        NativeProviderCompositionTest.Composition x=new NativeProviderCompositionTest.Composition(false);
        NativeProviderAudioSequenceTest.Fixture sdk=new NativeProviderAudioSequenceTest.Fixture();
        x.audioSurface=sdk;x.audioScheduler=sdk;x.owner=x.reconstruct();
        NativeProviderPayload original=NativeProviderIngressTest.payload(x.f.prepared);
        x.inventoryRows=new NativeProviderPayload[]{original};x.sync();
        assertEquals(java.util.List.of("tone"),sdk.effects);
        JSONObject record=x.inbox(original.recordId);assertEquals("IN_PROGRESS",record.getString("audio_state"));
        NativeProviderAudioSequence.Result oldTone=sdk.tone;
        Object plugin=new Object();int[] hints={0};
        java.util.Map<String,Object> attached=x.owner.mirrorAttach(plugin,(incarnation,revision)->{
            assertTrue(Thread.holdsLock(x.f.engine));assertTrue(Thread.holdsLock(x.f.provider.storage.lock));hints[0]++;
        });
        String attachment=(String)attached.get("attachment_id");
        int paths=x.paths.size(),shows=x.surface.shows,cancels=x.surface.cancels,creates=x.f.provider.storage.keys.creations;
        sdk.quiet=quiet;sdk.release=release;
        // Existing normal persistence failure is consumed by authority's FIRST
        // read; its observeUnavailable invalidates this original audio episode.
        x.f.persistence.failLoads=1;
        try{x.owner.reconcile();fail("authority failure cannot be accepted");}
        catch(VaultFailure primary){
            assertEquals("test_load_failure",primary.code);
            assertTrue("direct reconcile skipped owned stale audio cleanup",sdk.effects.contains("stop"));
            assertEquals(quiet&&release?0:1,primary.getSuppressed().length);
            if(!quiet||!release)assertEquals("custodial_provider_audio_stop_unconfirmed",
                ((VaultFailure)primary.getSuppressed()[0]).code);
        }
        assertTrue("the old mirror was invalidated under its original locks",hints[0]>1);
        ProviderRecordStoreTest.failure("custodial_provider_attachment_invalid",()->x.owner.mirrorStopped(plugin,attachment));
        assertTrue("original full inbox row stays unchanged",ProviderWireJson.same(record,x.inbox(original.recordId)));
        assertEquals(paths,x.paths.size());assertEquals(shows,x.surface.shows);assertEquals(cancels,x.surface.cancels);
        assertEquals(creates,x.f.provider.storage.keys.creations);assertEquals(0,x.f.cipher.destroyCalls);
        assertTrue(sdk.timers.isEmpty());int effects=sdk.effects.size();oldTone.done(true);assertEquals(effects,sdk.effects.size());
        assertEquals(1,sdk.effects.stream().filter("tone"::equals).count());assertTrue(sdk.texts.isEmpty());
        if(quiet&&release)assertEquals(java.util.List.of("tone","stop","release"),sdk.effects);
        else assertNotNull("UNKNOWN retains this exact stop callback",sdk.stop);
        // Settle only this already-owned synthetic callback. No new lane,
        // completed fact, retry transport, identity or profile is introduced.
        sdk.quiet=true;sdk.release=true;if(!quiet||!release)sdk.stop.done(true);
        x.owner.reconcile();assertTrue(ProviderWireJson.same(record,x.inbox(original.recordId)));
        assertEquals(java.util.List.of("tone","stop","release"),sdk.effects);
        assertEquals(paths,x.paths.size());assertTrue(sdk.timers.isEmpty());
    }
    /** Existing JUnit method-selection facility; fixed NEW owning members only,
     * no old tests, platform/controller, sockets or reusable test framework. */
    public static void main(String[] requested){
        java.util.Map<String,Class<?>> cases=new java.util.LinkedHashMap<>();
        for(String name:new String[]{"mirrorEpochAliasTracksPluginAndRejectsOldSameOwnerCallbacks",
            "mirrorEpochStaleAttachAndLateDetachLeaveCurrentAttachmentIntact"})cases.put(name,NativeProviderRuntimeOwnerTest.class);
        for(String name:new String[]{"directReconcileAuthorityFailureStillCleansOwnedStaleAudio",
            "directReconcileAuthorityFailureKeepsUnknownQuietOwnedAndSuppressed",
            "directReconcileAuthorityFailureKeepsUnknownReleaseOwnedAndSuppressed"})
            cases.put(name,NativeProviderRuntimeOwnerTest.class);
        for(String name:new String[]{"normalCancellationFailureStillReconcilesAlreadyOwnedStaleAudio",
            "normalCancellationFailureSuppressesUnknownAudioQuietAndRetainsOwnership",
            "normalCancellationFailureSuppressesUnknownAudioReleaseAndRetainsOwnership"})
            cases.put(name,NativeProviderRuntimeOwnerTest.class);
        for(String name:new String[]{"retainedFenceCancelsOnlyOriginalTagWithoutProfilePrincipalOrFrozenWrites",
            "retainedFenceFailedOsReadbackPreservesOriginalUntilNormalSuccessorCleanup",
            "retainedFenceNeverInventsPendingIntentFromLiveOrMissingRecords","unknownEngineReadCannotBeMaskedAsCancellationPermission"})
            cases.put(name,NativeProviderRuntimeOwnerTest.class);
        for(String name:new String[]{"retainedCancellationRejectsUnconfirmedCandidateAcrossAdapters",
            "retainedCancellationBatchRejectsWrongOwnerAndWholeCiphertextAba","retainedCancellationRejectsMalformedOriginalBeforeAnyTag"})
            cases.put(name,NativeProviderJournalTest.class);
        for(String name:new String[]{"retainedCancellationRechecksSourceAroundExactOsEffects",
            "retainedCancellationBoundsOnlyExistingIntentsAndKeepsThemPending"})cases.put(name,NativeProviderDisplayDriverTest.class);
        if(requested.length==0)throw new IllegalArgumentException("new owning selector required");
        for(String name:requested){
            Class<?> type=cases.get(name);if(type==null)throw new IllegalArgumentException("unknown owning selector");
            org.junit.runner.Result result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(type,name));
            System.out.println("SOURCE_CASE "+name+" tests="+result.getRunCount()+" failures="+result.getFailureCount());
            if(!result.wasSuccessful()){
                for(org.junit.runner.notification.Failure failure:result.getFailures())failure.getException().printStackTrace(System.err);
                System.exit(1);
            }
        }
    }
    @Test public void bothLineagesShareExactNativeAuthorityWithoutClockOrEffects() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture x = new Fixture(legacy); int commits = x.f.provider.storage.memory.commits;
            x.owner.attach(this); x.owner.detach(this); x.owner.reconcile();
            Map<String,Object> status = x.owner.localStatus();
            assertEquals("SUSPENDED", status.get("state")); assertEquals(true, status.get("native_principal_available"));
            assertEquals("qualified_interval_effect_owner_required", status.get("reason"));
            assertEquals(commits, x.f.provider.storage.memory.commits); assertEquals(0, x.surface.shows);
            assertEquals(1, x.events()); assertFalse(status.toString().contains(x.f.principal.digest));
        }
    }
    @Test public void canceledNativePresenceDoesNotRetireActiveRecordsOrDestroyAnyKey() throws Exception {
        Fixture x = new Fixture(false); x.allowed = false;
        Map<String,Object> before = new HashMap<>(x.f.provider.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_native_removal_cancelled", () -> x.removal().remove(RID, DEVICE));
        assertEquals(1, x.gateCalls); assertEquals(before, x.f.provider.storage.memory.raw);
        assertEquals("AVAILABLE", x.meta().getString("availability")); assertEquals(0, x.f.cipher.destroyCalls);
        assertEquals(true, x.f.engine.getState().get("active"));
    }
    @Test public void originalRecordsFenceBeforeEnrollmentKeyDeletionAndSurviveReconstruction() throws Exception {
        for (boolean legacy : new boolean[]{false, true}) {
            Fixture x = new Fixture(legacy); Object providerKey = x.f.provider.storage.keys.value;
            String originalPrincipal = NativeProviderPrincipal.fromNativeJournal(x.inbox().getJSONObject("principal")).digest;
            x.removal().remove(RID, DEVICE);
            assertEquals("REMOVED", x.meta().getString("availability"));
            assertEquals("REVOKED_OR_FOREIGN", x.inbox().getString("authority_state"));
            assertTrue(x.inbox().getBoolean("os_cancel_pending")); assertEquals(0, x.f.cipher.destroyCalls);
            x.owner = x.reconstruct(); x.removal().finalizeRemoval(RID);
            assertEquals(1, x.f.cipher.destroyCalls); assertSame(providerKey, x.f.provider.storage.keys.value);
            assertEquals(originalPrincipal, NativeProviderPrincipal.fromNativeJournal(x.inbox().getJSONObject("principal")).digest); assertEquals(1, x.events());
            assertEquals("EMPTY", x.f.engine.getState().get("state"));
            assertTrue(x.owner.reconcileLocalEffects()); assertEquals(0, x.surface.shows);
            assertEquals(java.util.List.of("mz-provider:" + x.payload.recordId), x.surface.tags);
        }
    }
    @Test public void durableFenceReadbackFailureBlocksFinalizationAndPreservesRetry() throws Exception {
        for (String failure : new String[]{"reject", "ambiguous", "read"}) {
            Fixture x = new Fixture(false); x.f.engine.removeEnrollment(RID, DEVICE);
            if (failure.equals("read")) x.f.provider.storage.memory.throwRead = true;
            else if (failure.equals("ambiguous")) x.f.provider.storage.memory.persistThenReject = true;
            else x.f.provider.storage.memory.reject = true;
            try { x.removal().finalizeRemoval(RID); fail(failure); }
            catch (VaultFailure expected) { assertTrue(expected.code.startsWith("custodial_provider_")); }
            assertEquals(0, x.f.cipher.destroyCalls); assertEquals("REMOVAL_TOMBSTONE", x.f.engine.getState().get("state"));
            x.f.provider.storage.memory.throwRead = false; x.f.provider.storage.memory.persistThenReject = false; x.f.provider.storage.memory.reject = false;
            x.owner = x.reconstruct(); x.removal().finalizeRemoval(RID); assertEquals(1, x.f.cipher.destroyCalls);
            assertEquals("REMOVED", x.meta().getString("availability")); assertEquals(1, x.events());
        }
    }
    @Test public void failedRemovalKeepsItsOriginalErrorAndAddsFenceFailureWithoutPretendingSuccess() throws Exception {
        Fixture x = new Fixture(false); x.allowed = false; x.f.provider.storage.memory.throwRead = true;
        try { x.removal().remove(RID, DEVICE); fail(); }
        catch (VaultFailure expected) {
            assertEquals("custodial_native_removal_cancelled", expected.code); assertEquals(1, expected.getSuppressed().length);
        }
        assertEquals(0, x.f.cipher.destroyCalls); assertEquals(true, x.f.engine.getState().get("active"));
    }
    @Test public void nativeUnavailabilityPreservesOriginalRecordsRatherThanDeclaringRemoval() throws Exception {
        Fixture x = new Fixture(false); x.f.persistence.failLoads = 1;
        try { x.owner.reconcile(); fail(); } catch (VaultFailure expected) { assertEquals("test_load_failure", expected.code); }
        assertEquals("UNAVAILABLE", x.meta().getString("availability"));
        assertNotEquals("REVOKED_OR_FOREIGN", x.inbox().getString("authority_state"));
        x.owner.reconcile(); assertEquals("AVAILABLE", x.meta().getString("availability"));
        assertEquals(1, x.events()); assertEquals(0, x.surface.shows);
    }
    @Test public void assignmentChangeWithoutVaultRevisionRetiresOriginalRecipient() throws Exception {
        Fixture x = new Fixture(false); long revision = x.f.persistence.current().revision;
        new NativePrincipalJournalTest().capture(x.f.principalJournal, x.f.engine.getState(), new NativePrincipalJournalTest().data()
            .put("credential_id", x.f.principal.json().get("credential_id")).put("assignment_epoch", 5));
        x.owner.reconcile(); assertEquals(revision, x.f.persistence.current().revision);
        assertEquals("REVOKED_OR_FOREIGN", x.inbox().getString("authority_state"));
        assertEquals(x.f.principal.digest, NativeProviderPrincipal.fromNativeJournal(x.inbox().getJSONObject("principal")).digest); assertEquals(1, x.events());
    }
    @Test public void failedExactCancellationSurvivesRestartAndNeverShowsOrCancelsUnrelatedTags() throws Exception {
        Fixture x = new Fixture(false); x.removal().remove(RID, DEVICE); x.removal().finalizeRemoval(RID);
        x.surface.active = NativeProviderDisplayDriver.Active.MATCH; x.surface.cancelWorks = false;
        ProviderRecordStoreTest.failure("custodial_provider_os_cancel_unconfirmed", () -> x.owner.reconcileLocalEffects());
        assertTrue(x.inbox().getBoolean("os_cancel_pending")); x.owner = x.reconstruct(); x.surface.cancelWorks = true;
        assertTrue(x.owner.reconcileLocalEffects()); assertFalse(x.inbox().getBoolean("os_cancel_pending"));
        assertEquals(2, x.surface.cancellations); assertEquals(0, x.surface.shows); assertEquals(1, x.events());
        for (String tag : x.surface.tags) assertEquals("mz-provider:" + x.payload.recordId, tag);
    }
    @Test public void authorityRejectsWrongLockOwnershipBeforeAnyJournalMutation() throws Exception {
        Fixture x = new Fixture(false);
        NativeProviderAuthority authority = new NativeProviderAuthority(x.f.engine, x.f.principalJournal, x.f.legacyJournal, x.f.provider.journal(), x.f.provider.storage.lock);
        int commits = x.f.provider.storage.memory.commits;
        ProviderRecordStoreTest.failure("custodial_provider_lock_owner_required", authority::reconcile);
        synchronized (x.f.engine) { ProviderRecordStoreTest.failure("custodial_provider_lock_owner_required", authority::reconcile); }
        assertEquals(commits, x.f.provider.storage.memory.commits);
    }
    @Test public void lostRemovalResponseFencesDurableIntentAndRetriesOriginalOperationWithoutReprompt() throws Exception {
        MutableClock clock = new MutableClock(NativeProviderHttpTest.NOW); FakeTransport transport = new FakeTransport(clock);
        MemoryPersistence persistence = new MemoryPersistence(); TestCipher cipher = new TestCipher();
        NativeProviderJournalTest.Fixture provider = new NativeProviderJournalTest.Fixture();
        VaultEngine[] engineRef = new VaultEngine[1];
        EnrollmentTransport guarded = (EnrollmentTransport) Proxy.newProxyInstance(EnrollmentTransport.class.getClassLoader(), new Class<?>[]{EnrollmentTransport.class}, (proxy, method, args) -> {
            if (method.getName().equals("remove")) {
                // Capture/send/settle removes the inherited engine network lock;
                // the provider wrapper must not introduce a second one.
                assertFalse(Thread.holdsLock(engineRef[0])); assertFalse(Thread.holdsLock(provider.storage.lock));
            }
            try { return method.invoke(transport, args); } catch (InvocationTargetException failure) { throw failure.getCause(); }
        });
        VaultEngine engine = new VaultEngine(persistence, cipher, guarded, new FakeLegacySource(), new TestSealGenerator(), clock); engineRef[0] = engine;
        engine.enroll(OP, DEVICE, "enrollment", "12345678".toCharArray()); engine.completeLocalBinding(OP); engine.confirmEnrollment(OP);
        NativePrincipalJournal principals = new NativePrincipalJournal(new NativePrincipalJournalTest.Memory());
        new NativePrincipalJournalTest().capture(principals, engine.getState(), new NativePrincipalJournalTest().data().put("credential_id", engine.getState().get("active_credential_id")));
        NativeLegacyLineageJournal legacy = new NativeLegacyLineageJournal(new NativeLegacyLineageJournalTest.Store());
        NativeProviderRuntimeOwner owner = new NativeProviderRuntimeOwner(engine, principals, legacy, provider.journal(), provider.storage.lock, new NativeProviderDisplayDriverTest.Surface());
        owner.reconcile(); provider.journal().captureToken("synthetic-only");
        int[] gates = {0}; RemovalCoordinator original = new RemovalCoordinator(engine, (op, device) -> { gates[0]++; return true; });
        NativeProviderRemovalCoordinator removal = new NativeProviderRemovalCoordinator(engine, original, owner);
        transport.loseRemoveAfterSuccess = 1;
        ProviderRecordStoreTest.failure("custodial_native_network_unavailable", () -> removal.remove(RID, DEVICE));
        assertEquals("REMOVAL_REQUESTED", engine.getState().get("state"));
        assertEquals("REMOVED", provider.read(ProviderEnvelopeCrypto.Domain.METADATA, "journal").getString("availability"));
        ProviderRecordStoreTest.failure("custodial_native_removal_conflict", () -> removal.remove(OP, DEVICE));
        removal.remove(RID, DEVICE); removal.finalizeRemoval(RID);
        assertEquals(1, gates[0]); assertEquals(2, transport.removeCalls.get()); assertEquals(1, cipher.destroyCalls);
    }
}
