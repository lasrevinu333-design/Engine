package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.*;
import org.junit.*;
import org.junit.runner.RunWith;

/** Test-only emulator namespace; never install or execute on an enrolled phone. */
@RunWith(AndroidJUnit4.class)
public final class OfflineBatchAndroidRuntimeTest {
    private Context context; private SharedPreferences prefs;
    private final String device="KIOSK_08", snapshot="a".repeat(64);
    private static final class Clock implements OfflineAuthorityTime.MonotonicClock {
        long elapsed=1000; public long now(){return elapsed;} public int bootCount(){return 7;}
    }
    @Before public void prepare() throws Exception {
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(context.getPackageName().endsWith(".test"));
        assertTrue(Build.FINGERPRINT.contains("generic") || Build.MODEL.toLowerCase(Locale.ROOT).contains("sdk")&&"ranchu".equals(Build.HARDWARE));
        prefs=context.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",Context.MODE_PRIVATE);
        assertTrue(prefs.edit().clear().commit());new AndroidKeystoreCipher().destroyKey();
    }
    @After public void cleanup() throws Exception {
        if(context!=null&&context.getPackageName().endsWith(".test")){
            assertTrue(prefs.edit().clear().commit());new AndroidKeystoreCipher().destroyKey();
        }
    }
    @Test public void encryptedSixJobBatchSurvivesStoreRecreationAndExactAcknowledgements() throws Exception {
        AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(context);
        Clock clock=new Clock();OfflineAuthorityTime time=new OfflineAuthorityTime(store,clock);
        time.acceptSnapshot(device,snapshot,"2026-09-18T12:00:00.000Z","2026-09-19T12:00:00.000Z");
        List<String[]> jobs=new ArrayList<>();
        for(int i=0;i<6;i++){
            String id=UUID.randomUUID().toString(),entry=UUID.randomUUID().toString(),loc=i%2==0?"NOCX":"TETM";
            time.authorizeNewWork(device,snapshot);String start=time.beginOccurrence(device,loc,id,snapshot);
            clock.elapsed+=1000;String end=time.completeOccurrenceFromScan(device,loc,id,start,entry,true);
            jobs.add(new String[]{id,entry,loc,start,end});
            store=new AndroidOfflineAuthorityTimeStore(context);time=new OfflineAuthorityTime(store,clock);
            assertTrue(store.hasOccurrences());assertFalse(store.hasUnfinishedOccurrences());
            assertEquals(entry,store.loadFinishEntryId(store.loadOccurrence(id)));
        }
        assertEquals(6,store.offlineWorkDiagnostics().get("finished_awaiting_upload_count"));
        assertEquals(0,store.offlineWorkDiagnostics().get("unreadable_record_count"));
        for(String[] job:jobs){
            assertEquals(job[4],time.completeOccurrenceFromScan(device,job[2],job[0],job[3],job[1],false));
            time.acknowledgeCompletedOccurrence(device,job[2],job[0],job[3],job[4]);
        }
        assertFalse(store.hasOccurrences());
        assertFalse(prefs.getAll().keySet().stream().anyMatch(k->k.startsWith("offline_finish_proof_sha256:")));
    }
    @Test public void completedButUnsealedRecordStillBlocksAndDiagnosticsRevealOnlyCounts() throws Exception {
        AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(context);
        Clock clock=new Clock();OfflineAuthorityTime time=new OfflineAuthorityTime(store,clock);
        time.acceptSnapshot(device,snapshot,"2026-09-18T12:00:00.000Z","2026-09-19T12:00:00.000Z");
        String id=UUID.randomUUID().toString();time.authorizeNewWork(device,snapshot);
        String start=time.beginOccurrence(device,"NOCX",id,snapshot);clock.elapsed+=1000;
        time.completeOccurrence(device,"NOCX",id,start);assertTrue(store.hasUnfinishedOccurrences());
        String diagnostic=store.offlineWorkDiagnostics().toString();
        assertFalse(diagnostic.contains(id));assertFalse(diagnostic.contains(device));assertFalse(diagnostic.contains("NOCX"));
        assertEquals(1,store.offlineWorkDiagnostics().get("unfinished_or_unsealed_count"));
        try{time.authorizeNewWork(device,snapshot);fail("Unsealed record allowed");}
        catch(VaultFailure expected){assertEquals("custodial_native_queue_admission_refused",expected.code);}
    }
    @Test public void unreadablePreservedOccurrenceCannotBeSilentlySkipped() throws Exception {
        AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(context);
        String key="offline_occurrence_sha256:"+"b".repeat(64),original="damaged-test-only-record";
        assertTrue(prefs.edit().putString(key,original).commit());
        try{store.hasUnfinishedOccurrences();fail("Unreadable record allowed");}catch(VaultFailure expected){}
        assertEquals(original,prefs.getString(key,null));
        assertEquals(1,store.offlineWorkDiagnostics().get("unreadable_record_count"));
    }
}
