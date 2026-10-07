package org.memphiszoo.custodial.vault;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Endpoint predicates applied to real encrypted journal/claim/compaction paths. */
public final class NativeProviderIntervalLifecycleTest {
    static NativeProviderJournal.Observation at(Instant earliest)throws Exception {
        return NativeProviderTimeTest.observation(earliest,1000,7); // Synthetic width two microseconds.
    }
    @Test public void reservationAndExpiryStraddlesRemainQuarantinedNotAdmittedOrDeleted()throws Exception {
        for(boolean expiry:new boolean[]{false,true}){
            NativeProviderIngressTest.Fixture f=new NativeProviderIngressTest.Fixture(true,false);
            Instant cutoff=expiry?f.payload.validUntil:f.payload.reservedAt;
            NativeProviderJournal.Observation straddle=at(cutoff.minusNanos(1000));
            assertEquals("QUARANTINED",f.r.f.journal().recordArrival(f.r.principal,f.payload,straddle).state);
            assertEquals(0,f.count(ProviderEnvelopeCrypto.Domain.INBOX));assertEquals(0,f.count(ProviderEnvelopeCrypto.Domain.EVENT));
            assertEquals(1,f.count(ProviderEnvelopeCrypto.Domain.QUARANTINE));
        }
    }
    @Test public void arrivalUnknownBoundsRemainNullAfterLaterQualifiedAdmission()throws Exception {
        NativeProviderIngressTest.Fixture f=new NativeProviderIngressTest.Fixture(true,false);
        f.r.f.journal().recordArrival(f.r.principal,f.payload,new NativeProviderJournal.Observation(null,5,6));
        JSONObject original=f.read(ProviderEnvelopeCrypto.Domain.QUARANTINE).getJSONObject("received_observation");
        assertEquals(5,original.length());assertFalse(original.has("authenticated_at"));assertTrue(original.isNull("earliest_at"));assertTrue(original.isNull("latest_at"));
        assertTrue(f.r.f.journal().drainQuarantine(f.r.principal,f.payload.recordId,at(f.payload.reservedAt)).newlyAdmitted);
        JSONObject record=f.read(ProviderEnvelopeCrypto.Domain.INBOX);assertTrue(ProviderWireJson.same(original,record.getJSONObject("received_observation")));
        assertFalse(record.has("accepted_at"));assertFalse(record.getJSONObject("admission_bounds").isNull("earliest_at"));
        JSONObject event=f.r.f.journal().pendingEvents(f.r.principal,16).events.values().iterator().next().wire();
        assertFalse(event.has("admitted_at"));assertTrue(ProviderWireJson.same(original,event.getJSONObject("original_observation")));
    }
    @Test public void expiryStraddleGrantsNeitherNewDisplayNorDestructiveCompaction()throws Exception {
        NativeProviderPresentationTest.Fixture active=new NativeProviderPresentationTest.Fixture();
        NativeProviderJournal.Observation straddle=at(active.f.payload.validUntil.minusNanos(1000));
        Map<String,Object> before=new HashMap<>(active.f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_display_time_unavailable",()->active.journal().prepareOsDisplay(active.principal,active.presentation,straddle));
        NativeProviderClaims claims=new NativeProviderClaims(active.journal());Object owner=new Object();claims.attach(owner);
        assertNull(claims.claimNext(owner,active.principal,straddle));assertEquals(before,active.f.r.f.storage.memory.raw);
        NativeProviderPresentationTest.Fixture terminal=NativeProviderCompactionTest.ready();before=new HashMap<>(terminal.f.r.f.storage.memory.raw);
        assertEquals(0,terminal.journal().compactSettledRecords(terminal.principal,straddle,16));assertEquals(before,terminal.f.r.f.storage.memory.raw);
        assertEquals(1,terminal.journal().compactSettledRecords(terminal.principal,at(terminal.f.payload.validUntil),16));
    }
    @Test public void dedupeBoundaryUsesEarliestNotLatestAndUnknownCannotClean()throws Exception {
        NativeProviderPresentationTest.Fixture f=NativeProviderCompactionTest.ready();NativeProviderCompactionTest.compact(f,NativeProviderCompactionTest.EXPIRED);
        Instant cutoff=Instant.parse(NativeProviderCompactionTest.DEDUPE_END);Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
        assertEquals(0,f.journal().compactSettledRecords(f.principal,at(cutoff.minusNanos(1000)),16));assertEquals(before,f.f.r.f.storage.memory.raw);
        ProviderRecordStoreTest.failure("custodial_provider_compaction_unavailable",()->f.journal().compactSettledRecords(f.principal,new NativeProviderJournal.Observation(null,1000,7),16));
        assertEquals(before,f.f.r.f.storage.memory.raw);assertEquals(1,f.journal().compactSettledRecords(f.principal,at(cutoff),16));
    }
    @Test public void historicalPointInboxAndEventsAreRetainedWithoutConversionOrNewAuthority()throws Exception {
        NativeProviderPresentationTest.Fixture f=NativeProviderCompactionTest.ready();JSONObject record=f.record();record.remove("interval_version");
        record.remove("admission_bounds");record.put("accepted_at",NativeProviderIngressTest.NOW);
        NativeProviderCompactionTest.mutate(f,ProviderEnvelopeCrypto.Domain.INBOX,f.f.payload.recordId,record);
        for(ProviderRecordStore.Key key:f.f.r.f.storage.store().load().keys())if(key.domain==ProviderEnvelopeCrypto.Domain.EVENT){
            JSONObject event=f.f.r.f.read(key.domain,key.id);event.remove("interval_version");event.remove("admission_bounds");event.put("admitted_at",NativeProviderIngressTest.NOW);
            NativeProviderCompactionTest.mutate(f,key.domain,key.id,event);
        }
        Map<String,Object> before=new HashMap<>(f.f.r.f.storage.memory.raw);
        assertTrue(f.journal().pendingEvents(f.principal,16).events.isEmpty());assertTrue(f.journal().admittedRecordIds(f.principal).isEmpty());
        ProviderRecordStoreTest.failure("custodial_provider_historical_time_unqualified",()->f.journal().presentation(f.principal,f.f.payload.recordId));
        assertEquals("HISTORICAL_TIME_UNQUALIFIED",f.journal().recordArrival(f.principal,f.f.payload,at(f.f.payload.reservedAt)).state);
        assertEquals(0,NativeProviderCompactionTest.compact(f,NativeProviderCompactionTest.EXPIRED));assertEquals(before,f.f.r.f.storage.memory.raw);
    }
}
