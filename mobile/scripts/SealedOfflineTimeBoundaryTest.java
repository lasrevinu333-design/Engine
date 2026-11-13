package org.memphiszoo.custodial.vault;

import java.util.HashMap;
import java.util.Map;

public final class SealedOfflineTimeBoundaryTest {
    static final String DEVICE="KIOSK_08", SNAPSHOT="a".repeat(64), SESSION="ac290000-0000-4000-8000-000000000001";
    static int passed=0,failed=0;
    interface Action { void run() throws Exception; }
    static void check(String name,Action action){try{action.run();passed++;System.out.println("PASS "+name);}catch(Exception|AssertionError e){failed++;System.out.println("FAIL "+name+": "+e);}}
    static void equal(Object a,Object b){if(!java.util.Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    static void refuses(String code,Action action)throws Exception{try{action.run();throw new AssertionError("expected "+code);}catch(VaultFailure e){equal(e.code,code);}}
    static class Clock implements OfflineAuthorityTime.MonotonicClock {long elapsed=1000;int boot=7;public long now(){return elapsed;}public int bootCount(){return boot;}}
    static class Store implements OfflineAuthorityTime.OfflineAuthorityTimeStore {
        OfflineAuthorityTime.OfflineAuthorityAnchor anchor;
        Map<String,OfflineAuthorityTime.OfflineOccurrence> rows=new HashMap<>();
        Map<String,String> finishes=new HashMap<>();
        public OfflineAuthorityTime.OfflineAuthorityAnchor loadAnchor(){return anchor;}
        public void saveAnchor(OfflineAuthorityTime.OfflineAuthorityAnchor value){anchor=value;}
        public OfflineAuthorityTime.OfflineOccurrence loadOccurrence(String id){return rows.get(id);}
        public void saveOccurrence(OfflineAuthorityTime.OfflineOccurrence value){rows.put(value.clientSessionId,value);}
        public void deleteOccurrence(String id){rows.remove(id);}
        public boolean hasOccurrences(){return !rows.isEmpty();}
        public String loadFinishEntryId(OfflineAuthorityTime.OfflineOccurrence row){return finishes.getOrDefault(row.clientSessionId,"");}
        public void saveFinishEntryId(OfflineAuthorityTime.OfflineOccurrence row,String id){finishes.put(row.clientSessionId,id);}
    }
    static OfflineAuthorityTime time(Store store,Clock clock)throws Exception{
        OfflineAuthorityTime time=new OfflineAuthorityTime(store,clock);
        time.acceptSnapshot(DEVICE,SNAPSHOT,"2026-10-31T12:00:00.000Z","2026-10-31T12:00:02.000Z");
        time.authorizeNewWork(DEVICE,SNAPSHOT);return time;
    }
    public static void main(String[] args)throws Exception{
        for(long elapsed:new long[]{2999,3000,3001})check("new Start at E"+(elapsed-3000)+"ms",()->{
            Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=time(store,clock);clock.elapsed=elapsed;
            if(elapsed<3000)equal(time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT),"2026-10-31T12:00:01.999Z");
            else{refuses("custodial_native_offline_anchor_expired",()->time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT));equal(store.rows.size(),0);}
        });
        check("authorization at exact E is refused",()->{
            Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=time(store,clock);clock.elapsed=3000;
            refuses("custodial_native_offline_anchor_expired",()->time.authorizeNewWork(DEVICE,SNAPSHOT));
        });
        check("original completion after expiry stays frozen across reboot",()->{
            Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=time(store,clock);clock.elapsed=2000;
            String start=time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT);clock.elapsed=62000;
            String end=time.completeOccurrence(DEVICE,"TETM",SESSION,start);equal(end,"2026-10-31T12:01:01.000Z");
            clock.boot=8;clock.elapsed=10;equal(time.completeOccurrence(DEVICE,"TETM",SESSION,start),end);
        });
        check("unfinished reboot preserves exact occurrence and refuses clock invention",()->{
            Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=time(store,clock);
            String start=time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT);Object original=store.rows.get(SESSION),anchor=store.anchor;
            clock.boot=8;clock.elapsed=10;
            refuses("custodial_native_completion_recovery_required",()->time.completeOccurrence(DEVICE,"TETM",SESSION,start));
            refuses("custodial_native_offline_anchor_refused",()->time.acceptSnapshot(DEVICE,"b".repeat(64),"2026-10-31T13:00:00.000Z","2026-10-31T13:10:00.000Z"));
            if(original!=store.rows.get(SESSION)||anchor!=store.anchor)throw new AssertionError("original replaced");
        });
        for(long sinceStart:new long[]{0,58000,59999,60000,60001})check("physical scan at original Start+"+sinceStart+"ms",()->{
            Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=time(store,clock);
            String started=time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT);Object original=store.rows.get(SESSION);
            clock.elapsed=120000; // Delayed processing never changes the captured observation.
            equal(time.ignoresFinishScan(DEVICE,"TETM",SESSION,started,1000+sinceStart,7),sinceStart<60000);
            equal(OfflineAuthorityTime.ignoresPhysicalScan(store.rows.get(SESSION),1000+sinceStart,7),sinceStart<60000);
            if(original!=store.rows.get(SESSION)||!store.finishes.isEmpty())throw new AssertionError("ignored scan changed original work");
            OfflineAuthorityTime recreated=new OfflineAuthorityTime(store,clock);
            equal(recreated.ignoresFinishScan(DEVICE,"TETM",SESSION,started,1000+sinceStart,7),sinceStart<60000);
        });
        check("retry cannot move original minute and new boot cannot manufacture elapsed duration",()->{
            Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=time(store,clock);
            String started=time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT);Object original=store.rows.get(SESSION);
            clock.elapsed=59000;equal(time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT),started);
            if(original!=store.rows.get(SESSION))throw new AssertionError("retry replaced original Start");
            equal(time.ignoresFinishScan(DEVICE,"TETM",SESSION,started,61000,7),false);
            refuses("custodial_native_completion_recovery_required",()->time.ignoresFinishScan(DEVICE,"TETM",SESSION,started,1000,8));
        });
        check("physical ingress ignores duplicates without journal, queue or later replay; fresh 60s read persists",()->{
            Store store=new Store();Clock clock=new Clock();OfflineAuthorityTime time=time(store,clock);
            time.beginOccurrence(DEVICE,"TETM",SESSION,SNAPSHOT);
            AndroidOfflineAuthorityTimeStore handoffs=new AndroidOfflineAuthorityTimeStore();handoffs.occurrence=store.rows.get(SESSION);
            for(long offset:new long[]{0,58000,59999,59999}){
                NativeNfcScanHandoff.ReadResult result=NativeNfcScanHandoff.recordResult(handoffs,"https://fixture.invalid/index.html?code=TETM",1000+offset,7,"");
                equal(result.handoffId,"");equal(result.durable,false);equal(result.ignored,true);equal(handoffs.loads,0);equal(handoffs.writes,0);equal(handoffs.records.size(),0);
            }
            clock.elapsed=61000;equal(handoffs.records.size(),0); // advancing alone cannot replay a discarded observation
            NativeNfcScanHandoff.ReadResult fresh=NativeNfcScanHandoff.recordResult(handoffs,"https://fixture.invalid/index.html?code=TETM",61000,7,"");
            equal(fresh.durable,true);equal(fresh.ignored,false);equal(handoffs.loads,1);equal(handoffs.writes,1);equal(handoffs.records.size(),1);
            equal(handoffs.records.get(fresh.handoffId).get("created_elapsed_ms"),61000L);
            equal(handoffs.occurrence,store.rows.get(SESSION));
        });
        System.out.println("RESULT passed="+passed+" failed="+failed+"; actual pure Java time owner, synthetic store/clock; no Android/phone proof");
        if(failed>0)System.exit(1);
    }
}
