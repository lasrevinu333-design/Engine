package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.Test;

public final class OfflineSequentialCleaningRequirementTest {
    private static final String D="KIOSK_08", S="a".repeat(64);
    private static OfflineAuthorityTime prepared(Store store, Clock clock) throws Exception {
        OfflineAuthorityTime time=new OfflineAuthorityTime(store,clock);
        time.acceptSnapshot(D,S,"2026-09-18T12:00:00.000Z","2026-09-19T12:00:00.000Z");
        return time;
    }
    @Test public void sixOfflineCleaningsPreserveEveryOccurrenceAndFinishProof() throws Exception {
        Store store=new Store(); Clock clock=new Clock(); OfflineAuthorityTime time=prepared(store,clock);
        for(int i=0;i<6;i++){
            String id=UUID.randomUUID().toString(), entry=UUID.randomUUID().toString();
            time.authorizeNewWork(D,S);
            String start=time.beginOccurrence(D,i%2==0?"NOCX":"TETM",id,S);
            clock.elapsed+=60_000;
            time.completeOccurrenceFromScan(D,i%2==0?"NOCX":"TETM",id,start,entry,true);
            time=new OfflineAuthorityTime(store,clock);
            assertEquals(i+1,store.occurrences.size());
            assertEquals(entry,store.finish.get(id));
        }
        assertTrue(store.hasOccurrences()); assertFalse(store.hasUnfinishedOccurrences());
    }
    @Test public void unfinishedWorkAndUnprovedFinishStillBlockNewWork() throws Exception {
        Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=prepared(store,clock);
        String id=UUID.randomUUID().toString();time.authorizeNewWork(D,S);
        String start=time.beginOccurrence(D,"NOCX",id,S);
        refused("custodial_native_queue_admission_refused",()->time.authorizeNewWork(D,S));
        clock.elapsed+=1000;time.completeOccurrence(D,"NOCX",id,start);
        refused("custodial_native_queue_admission_refused",()->time.authorizeNewWork(D,S));
    }
    @Test public void finishSurvivesExpiredTransientEntryAndRejectsDifferentIdentity() throws Exception {
        Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime first=prepared(store,clock);
        String id=UUID.randomUUID().toString(),entry=UUID.randomUUID().toString();
        first.authorizeNewWork(D,S);String start=first.beginOccurrence(D,"NOCX",id,S);
        clock.elapsed+=1000;String end=first.completeOccurrenceFromScan(D,"NOCX",id,start,entry,true);
        clock.elapsed+=3_600_000;
        OfflineAuthorityTime restarted=new OfflineAuthorityTime(store,clock);
        assertEquals(end,restarted.completeOccurrenceFromScan(D,"NOCX",id,start,entry,false));
        refused("custodial_native_offline_occurrence_mismatch",()->restarted.completeOccurrenceFromScan(D,"TETM",id,start,entry,false));
        refused("custodial_native_offline_occurrence_mismatch",()->restarted.completeOccurrenceFromScan(D,"NOCX",id,start,UUID.randomUUID().toString(),false));
    }
    @Test public void failedFinishProofWritePreservesWorkAndBlocksNewCleaning() throws Exception {
        Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=prepared(store,clock);
        String id=UUID.randomUUID().toString();time.authorizeNewWork(D,S);String start=time.beginOccurrence(D,"NOCX",id,S);
        clock.elapsed+=1000;store.failWrite=true;
        refused("custodial_native_offline_time_persistence_failed",()->time.completeOccurrenceFromScan(D,"NOCX",id,start,UUID.randomUUID().toString(),true));
        assertEquals(1,store.occurrences.size());
        refused("custodial_native_queue_admission_refused",()->time.authorizeNewWork(D,S));
    }
    @Test public void rollbackStillRefusesUnacknowledgedCompletedWork() throws Exception {
        Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=prepared(store,clock);
        String id=UUID.randomUUID().toString();time.authorizeNewWork(D,S);String start=time.beginOccurrence(D,"NOCX",id,S);
        clock.elapsed+=1000;String end=time.completeOccurrenceFromScan(D,"NOCX",id,start,UUID.randomUUID().toString(),true);
        refused("custodial_native_rollback_fence_refused",()->time.beginRollbackFence(D));
        time.acknowledgeCompletedOccurrence(D,"NOCX",id,start,end);
        assertFalse(store.hasOccurrences());assertEquals(0,store.finish.size());
    }
    @Test public void copiedFinishWithoutPhysicalProofIsRejected() throws Exception {
        Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=prepared(store,clock);
        String id=UUID.randomUUID().toString();time.authorizeNewWork(D,S);String start=time.beginOccurrence(D,"NOCX",id,S);
        refused("custodial_native_scan_entry_missing",()->time.completeOccurrenceFromScan(D,"NOCX",id,start,UUID.randomUUID().toString(),false));
        assertTrue(store.occurrences.get(id).completedAt.isEmpty());
    }
    private interface Action {void run() throws Exception;}
    private static void refused(String code,Action action) throws Exception {
        try {action.run();fail("Expected "+code);}catch(VaultFailure e){assertEquals(code,e.code);}
    }
    private static final class Clock implements OfflineAuthorityTime.MonotonicClock {
        long elapsed=1000;
        @Override public long now(){return elapsed;}
        @Override public int bootCount(){return 7;}
    }
    private static final class Store implements OfflineAuthorityTime.OfflineAuthorityTimeStore {
        OfflineAuthorityTime.OfflineAuthorityAnchor anchor;OfflineAuthorityTime.RollbackFence fence;
        final Map<String,OfflineAuthorityTime.OfflineOccurrence> occurrences=new HashMap<>();
        final Map<String,String> finish=new HashMap<>();boolean failWrite;
        @Override public OfflineAuthorityTime.OfflineAuthorityAnchor loadAnchor(){return anchor;}
        @Override public void saveAnchor(OfflineAuthorityTime.OfflineAuthorityAnchor a){anchor=a;}
        @Override public OfflineAuthorityTime.OfflineOccurrence loadOccurrence(String id){return occurrences.get(id);}
        @Override public void saveOccurrence(OfflineAuthorityTime.OfflineOccurrence o){occurrences.put(o.clientSessionId,o);}
        @Override public void deleteOccurrence(String id){occurrences.remove(id);finish.remove(id);}
        @Override public OfflineAuthorityTime.RollbackFence loadRollbackFence(){return fence;}
        @Override public void saveRollbackFence(OfflineAuthorityTime.RollbackFence f){fence=f;}
        @Override public void deleteRollbackFence(){fence=null;}
        @Override public boolean hasOccurrences(){return !occurrences.isEmpty();}
        @Override public boolean hasUnfinishedOccurrences(){
            return occurrences.values().stream().anyMatch(o->o.completedAt.isEmpty()||!finish.containsKey(o.clientSessionId));
        }
        @Override public String loadFinishEntryId(OfflineAuthorityTime.OfflineOccurrence o){return finish.getOrDefault(o.clientSessionId,"");}
        @Override public void saveFinishEntryId(OfflineAuthorityTime.OfflineOccurrence o,String id) throws VaultFailure {
            if(failWrite)throw new VaultFailure("custodial_native_offline_time_persistence_failed");
            finish.put(o.clientSessionId,id);
        }
    }
}
