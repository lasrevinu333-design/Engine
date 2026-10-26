package org.memphiszoo.custodial.vault;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Encrypted durable owner with synthetic profile inputs and actual typed HTTP
 * machinery. No fixture is qualification evidence or production construction. */
public final class NativeProviderClockOwnerTest {
    static final class Fixture {
        final NativeProviderHttpTest.Fixture f;
        final NativeProviderJournal journal;
        final NativeProviderClockExchange.Settlement settlement;
        NativeProviderTime.Profile profile=NativeProviderTimeTest.profile(1_000_000,10_000,900_000_000_000L);
        long elapsed=100;int boot=7;
        Fixture(boolean legacy)throws Exception {
            f=new NativeProviderHttpTest.Fixture(legacy);journal=f.provider.journal();
            settlement=f.engine.registerNativeProvider(f.prepared,f.principalJournal,f.legacyJournal,journal,f.http(),f.attempt,false);
        }
        NativeProviderClockOwner owner()throws Exception {
            return new NativeProviderClockOwner(f.engine,f.provider.storage.lock,journal,f.principalJournal,f.legacyJournal,
                actual->profile,NativeProviderTimeTest.platform(),()->new NativeProviderClockExchange.Point(elapsed,boot));
        }
        JSONObject saved()throws Exception{return f.provider.read(ProviderEnvelopeCrypto.Domain.METADATA,"clock-"+settlement.registration.generationId);}
        NativeProviderClockExchange.Settlement refresh(long a,long b,long server,boolean newNonce)throws Exception {
            JSONObject raw=NativeProviderTimeTest.sample(a,b,boot,server,900_000_000L).json();
            raw.put("request_id",newNonce?UUID.randomUUID().toString():settlement.unqualifiedClock.requestId);
            return new NativeProviderClockExchange.Settlement(settlement.registration,NativeProviderClockExchange.Unqualified.restore(raw),
                settlement.principalDigest,settlement.engineRevision,settlement.providerEpoch);
        }
    }
    @Test public void noPinMeansUnknownAndNoDurableSampleDespiteActualAuthenticatedExchange()throws Exception {
        Fixture x=new Fixture(false);Map<String,Object> original=new HashMap<>(x.f.provider.storage.memory.raw);x.profile=null;
        assertFalse(x.owner().accept(x.settlement));assertNull(x.owner().observe().bounds);assertEquals(original,x.f.provider.storage.memory.raw);
    }
    @Test public void bothPrincipalShapesPersistOriginalFactsRestartAndNeverConsultCleaning()throws Exception {
        for(boolean legacy:new boolean[]{false,true}){
            Fixture x=new Fixture(legacy);assertTrue(x.owner().accept(x.settlement));JSONObject record=x.saved();
            assertTrue(ProviderWireJson.same(x.settlement.unqualifiedClock.json(),record.getJSONObject("sample")));
            assertTrue(ProviderWireJson.same(x.f.principal.json(),record.getJSONObject("principal")));
            assertEquals(x.settlement.engineRevision,record.getLong("engine_revision"));assertEquals(x.settlement.providerEpoch,record.getLong("provider_epoch"));
            assertEquals(x.profile.fingerprint(),record.getString("profile_fingerprint"));
            x.elapsed=200;assertNotNull(x.owner().observe().bounds);assertEquals(200,x.saved().getLong("last_observed_elapsed_ms"));
            assertEquals(100,x.saved().getJSONObject("sample").getLong("before_elapsed_ms"));
        }
    }
    @Test public void lostCommitResponseReconcilesExactSampleWithoutSecondWrite()throws Exception {
        Fixture x=new Fixture(false);x.f.provider.storage.memory.persistThenReject=true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved",()->x.owner().accept(x.settlement));
        x.f.provider.storage.memory.persistThenReject=false;int commits=x.f.provider.storage.memory.commits;
        assertTrue(x.owner().accept(x.settlement));assertEquals(commits,x.f.provider.storage.memory.commits);
        assertNotNull(x.owner().observe().bounds);
    }
    @Test public void sameNonceDifferentSampleRejectedAndOriginalPreserved()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));Map<String,Object> before=new HashMap<>(x.f.provider.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_journal_corrupt_preserved",()->x.owner().accept(x.refresh(100,100,x.settlement.unqualifiedClock.serverMicros+1,false)));
        assertEquals(before,x.f.provider.storage.memory.raw);
    }
    @Test public void missingChangedOrMismatchedProfileRequiresFreshSampleAndNeverUpgradesSavedBytes()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));Map<String,Object> before=new HashMap<>(x.f.provider.storage.memory.raw);
        x.profile=null;assertNull(x.owner().observe().bounds);assertEquals(before,x.f.provider.storage.memory.raw);
        x.profile=NativeProviderTimeTest.profile(2_000_000,10_000,900_000_000_000L);assertNull(x.owner().observe().bounds);
        assertFalse(x.owner().accept(x.settlement));assertEquals(before,x.f.provider.storage.memory.raw);
        x.elapsed=200;assertTrue(x.owner().accept(x.refresh(200,200,x.settlement.unqualifiedClock.serverMicros+100000,true)));
        assertNotNull(x.owner().observe().bounds);
    }
    @Test public void rebootExpiryAndRevisionChangeAreUnknownWithoutDeletingSample()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));Map<String,Object> before=new HashMap<>(x.f.provider.storage.memory.raw);
        assertNull(x.journal.clockObservation(x.f.principal,x.settlement.engineRevision+1,x.profile,NativeProviderTimeTest.platform(),new NativeProviderClockExchange.Point(100,7)).bounds);
        assertEquals(before,x.f.provider.storage.memory.raw);
        x.boot=8;assertNull(x.owner().observe().bounds);assertEquals("REFRESH_REQUIRED",x.saved().getString("state"));
        assertTrue(ProviderWireJson.same(x.settlement.unqualifiedClock.json(),x.saved().getJSONObject("sample")));
        x.boot=7;assertNull(x.owner().observe().bounds);assertFalse(x.owner().accept(x.settlement));
        Fixture y=new Fixture(false);assertTrue(y.owner().accept(y.settlement));y.elapsed=900101;assertNull(y.owner().observe().bounds);
        assertEquals("REFRESH_REQUIRED",y.saved().getString("state"));
        assertTrue(ProviderWireJson.same(y.settlement.unqualifiedClock.json(),y.saved().getJSONObject("sample")));
        y.elapsed=100;assertNull(y.owner().observe().bounds);assertFalse(y.owner().accept(y.settlement));
    }
    @Test public void expiryRefreshRequiresNewNonceAndHighWaterButNoPermanentLossOfBackgroundRecovery()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));x.elapsed=900101;assertNull(x.owner().observe().bounds);
        assertFalse(x.owner().accept(x.settlement));
        x.elapsed=900102;assertTrue(x.owner().accept(x.refresh(x.elapsed,x.elapsed,x.settlement.unqualifiedClock.serverMicros+900002000L,true)));
        assertNotNull(x.owner().observe().bounds);
        Fixture y=new Fixture(false);assertTrue(y.owner().accept(y.settlement));y.boot=8;y.elapsed=1;assertNull(y.owner().observe().bounds);
        y.elapsed=2;assertTrue(y.owner().accept(y.refresh(2,2,y.settlement.unqualifiedClock.serverMicros+1000000,true)));
        assertNotNull(y.owner().observe().bounds);
    }
    @Test public void oldBootCannotReturnAsFreshSampleAfterObservedReboot()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));x.boot=8;x.elapsed=1;assertNull(x.owner().observe().bounds);
        x.boot=7;x.elapsed=200;assertFalse(x.owner().accept(x.refresh(200,200,x.settlement.unqualifiedClock.serverMicros+100000,true)));
        assertEquals("FENCED",x.saved().getString("state"));assertNull(x.owner().observe().bounds);
    }
    @Test public void observedElapsedRollbackCreatesDurableFenceAndPreservesOriginalSample()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));x.elapsed=300;assertNotNull(x.owner().observe().bounds);
        x.elapsed=200;assertNull(x.owner().observe().bounds);assertEquals("FENCED",x.saved().getString("state"));
        x.elapsed=400;assertNull(x.owner().observe().bounds);assertFalse(x.owner().accept(x.refresh(400,400,x.settlement.unqualifiedClock.serverMicros+300000,true)));
        assertTrue(ProviderWireJson.same(x.settlement.unqualifiedClock.json(),x.saved().getJSONObject("sample")));
    }
    @Test public void nonoverlappingFreshSampleFencesBothNotFalselySelectingOne()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));x.elapsed=200;
        NativeProviderClockExchange.Settlement conflict=x.refresh(200,200,x.settlement.unqualifiedClock.serverMicros+5_000_000,true);
        assertFalse(x.owner().accept(conflict));assertNull(x.owner().observe().bounds);JSONObject saved=x.saved();
        assertEquals("FENCED",saved.getString("state"));assertTrue(ProviderWireJson.same(conflict.unqualifiedClock.json(),saved.getJSONObject("conflicting_sample")));
        assertTrue(ProviderWireJson.same(x.settlement.unqualifiedClock.json(),saved.getJSONObject("sample")));
    }
    @Test public void providerEpochCurrentGenerationAndRemovalFenceEveryOldClock()throws Exception {
        Fixture x=new Fixture(false);assertTrue(x.owner().accept(x.settlement));
        x.journal.observeUnavailable();x.journal.observeActivePrincipal(x.f.principal);assertNull(x.owner().observe().bounds);
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale",()->x.owner().accept(x.settlement));
        x.journal.observeRemoved();JSONObject saved=x.saved();assertEquals("REVOKED_OR_FOREIGN",saved.getString("authority_state"));
        assertTrue(ProviderWireJson.same(x.settlement.unqualifiedClock.json(),saved.getJSONObject("sample")));
        Fixture y=new Fixture(false);assertTrue(y.owner().accept(y.settlement));y.journal.captureToken("synthetic-new-token");
        y.journal.prepareRegistration(y.f.principal,NativeProviderJournalTest.app());assertNull(y.owner().observe().bounds);
        ProviderRecordStoreTest.failure("custodial_provider_operation_stale",()->y.owner().accept(y.settlement));
    }
}
