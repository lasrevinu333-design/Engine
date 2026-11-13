package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.HashMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Actual encrypted adapter and authenticated frozen raw chain, synthetic disk,
 * key and HTTP. Structural inventory only, never physical or server acceptance. */
public final class NativeProtectedSessionInventoryTest {
    private static String id(int n){return NativeSeparationContextTest.id(n);}
    private static String key(boolean finish)throws Exception{return(finish?"offline_finish_proof_sha256:":"offline_occurrence_sha256:")+NativeProviderPrincipal.hash(id(41));}
    private static JSONObject occurrence()throws Exception{
        return new JSONObject().put("client_session_id",id(41)).put("device_id","KIOSK_08").put("location_code","RR_TEST")
            .put("snapshot_id","a".repeat(64)).put("generated_at","2026-09-26T10:00:00Z").put("expires_at","2026-09-26T18:00:00Z")
            .put("clock_base_at","2026-09-26T10:00:00Z").put("anchor_elapsed_realtime_ms",1000L).put("boot_count",3)
            .put("native_scan_entry_id",id(43)).put("started_at","2026-09-26T10:01:00.123Z").put("completed_at","2026-09-26T10:10:00.456Z");
    }
    private static JSONObject finish(JSONObject occurrence)throws Exception{
        JSONObject row=new JSONObject();for(String field:new String[]{"client_session_id","device_id","location_code","started_at","completed_at"})row.put(field,occurrence.get(field));
        return row.put("entry_id",id(44));
    }
    private static void put(NativeSeparationFreezeTest.Fixture f,boolean finish,JSONObject row)throws Exception{
        EncryptedSecret encrypted=f.workCipher.encryptWithExistingKey(row.toString().toCharArray());
        f.preferences.disk.put(key(finish),new JSONObject().put("ciphertext",encrypted.ciphertext).put("iv",encrypted.iv).toString());
    }
    private static JSONObject inspect(NativeSeparationFreezeTest.Fixture f)throws Exception{
        f.observe();var before=new HashMap<>(f.preferences.disk);int commits=f.preferences.commits,encrypts=f.workCipher.existingKeyEncryptCalls;
        JSONObject result=NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null).json();
        assertEquals(before,f.preferences.disk);assertEquals(before,f.preferences.durableDisk);assertEquals(commits,f.preferences.commits);
        assertEquals(encrypts,f.workCipher.existingKeyEncryptCalls);assertEquals(1,f.transport.calls);assertEquals(0,f.workCipher.destroyCalls);
        assertEquals(before.size()-1,result.getInt("record_count"));assertEquals("UNKNOWN",result.getString("native_semantic_inventory_state"));
        assertEquals("UNKNOWN",result.getString("browser_inventory_state"));assertFalse(result.getBoolean("phone_released"));
        JSONArray rows=result.getJSONArray("session_links");for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);assertTrue(row.getBoolean("retained_unresolved"));assertFalse(row.getBoolean("automatic_acceptance"));
            assertEquals("UNKNOWN",row.getString("start_cutoff_proof"));assertEquals("UNKNOWN",row.getString("finish_cutoff_proof"));
            assertEquals("NOT_ESTABLISHED",row.getString("server_acceptance"));
        }
        return result;
    }
    @Test public void exactPairRetainsOriginalHashesAndDoesNotBecomeCompletionProof()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence(),end=finish(start);put(f,false,start);put(f,true,end);
        JSONObject result=inspect(f),row=result.getJSONArray("session_links").getJSONObject(0);
        assertEquals(1,result.getJSONArray("session_links").length());assertEquals("LINKED_UNVERIFIED",row.getString("state"));
        assertEquals(id(41),row.getString("client_session_id"));assertEquals(id(43),row.getString("start_entry_id"));assertEquals(id(44),row.getString("finish_entry_id"));
        assertEquals(NativeProviderPrincipal.hash(start.toString()),row.getString("occurrence_sha256"));
        assertEquals(NativeProviderPrincipal.hash(end.toString()),row.getString("finish_sha256"));
        assertEquals(NativeProviderPrincipal.hash(key(false)),row.getString("source_key_sha256"));
        assertFalse(result.toString().contains("10:10:00.456"));assertFalse(result.toString().contains("RR_TEST"));
    }
    @Test public void openMissingFinishAndOrphanFinishRemainDistinct()throws Exception{
        for(int mode=0;mode<3;mode++){
            var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence();if(mode==0)start.put("completed_at","");
            if(mode!=2)put(f,false,start);else put(f,true,finish(start));
            JSONObject row=inspect(f).getJSONArray("session_links").getJSONObject(0);
            assertEquals(mode==0?"OPEN_RETAINED":mode==1?"FINISH_RECORD_MISSING":"UNKNOWN",row.getString("state"));
            assertEquals(mode==2?"ORPHAN_FINISH":"OCCURRENCE",row.getString("kind"));
        }
    }
    @Test public void everyFinishBindingAndTypeMustMatchExactOriginal()throws Exception{
        String[] fields={"client_session_id","device_id","location_code","started_at","completed_at","entry_id","entry_id","extra","completed_at"};
        Object[] values={id(42),"OTHER","RR_OTHER","2026-09-26T10:01:00.124Z","2026-09-26T10:10:00.457Z",id(43),7,"unknown",JSONObject.NULL};
        for(int i=0;i<fields.length;i++){
            var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence(),end=finish(start).put(fields[i],values[i]);put(f,false,start);put(f,true,end);
            JSONObject row=inspect(f).getJSONArray("session_links").getJSONObject(0);
            assertEquals(fields[i],"UNRESOLVED_INVALID_OR_MISMATCHED",row.getString("state"));
            assertFalse(row.has("finish_entry_id"));assertTrue(row.has("finish_sha256"));
        }
    }
    @Test public void invalidOccurrenceNeverHidesItsFinishOrClaimsAResolvedSession()throws Exception{
        String[] fields={"client_session_id","device_id","location_code","snapshot_id","generated_at","expires_at","clock_base_at",
            "anchor_elapsed_realtime_ms","anchor_elapsed_realtime_ms","boot_count","boot_count","native_scan_entry_id","started_at","completed_at","extra"};
        Object[] values={id(42),"OTHER","invalid area","not-a-snapshot","2026-02-30T10:00:00Z","2026-09-26T10:00:00Z","2026-09-26T11:00:00Z",
            "1000",1000.5,-1,2147483648L,7,"2026-09-26T10:01:00Z ","2026-09-28T10:10:00Z","unsupported"};
        for(int i=0;i<fields.length;i++){
            var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence(),end=finish(start);start.put(fields[i],values[i]);put(f,false,start);put(f,true,end);
            JSONArray rows=inspect(f).getJSONArray("session_links");assertEquals(fields[i],2,rows.length());
            assertEquals("UNRESOLVED_INVALID_OR_MISMATCHED",rows.getJSONObject(0).getString("state"));
            assertEquals("ORPHAN_FINISH",rows.getJSONObject(1).getString("kind"));
        }
    }
    @Test public void unreadableRecordsAreItemsNotEmptyInventory()throws Exception{
        for(boolean corruptedFinish:new boolean[]{false,true}){
            var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence();put(f,false,start);put(f,true,finish(start));
            f.preferences.disk.put(key(corruptedFinish),"unreadable original ciphertext");
            JSONArray rows=inspect(f).getJSONArray("session_links");
            assertEquals(corruptedFinish?1:2,rows.length());
            assertEquals(corruptedFinish?"FINISH_UNREADABLE":"UNKNOWN",rows.getJSONObject(0).getString("state"));
            assertEquals("unreadable original ciphertext",f.preferences.disk.get(key(corruptedFinish)));
        }
    }
    @Test public void openSessionWithFinishAndFractionalReversalCannotBecomeLinked()throws Exception{
        for(int mode=0;mode<3;mode++){
            var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence();
            if(mode==0)start.put("completed_at","");
            if(mode==1)start.put("started_at","2026-09-26T10:01:00.123456789Z").put("completed_at","2026-09-26T10:01:00.123456788Z");
            JSONObject end=finish(start);if(mode==2)end.put("started_at","2026-09-26T10:01:00.1230Z");
            put(f,false,start);put(f,true,end);JSONObject row=inspect(f).getJSONArray("session_links").getJSONObject(0);
            assertEquals("UNRESOLVED_INVALID_OR_MISMATCHED",row.getString("state"));
        }
    }
    @Test public void exactExpiryAndNanosecondDurationBoundariesMatchOccurrenceOwner()throws Exception{
        {
            var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence()
                .put("started_at","2026-09-26T18:00:00Z").put("completed_at","2026-09-26T18:00:00Z");
            put(f,false,start);put(f,true,finish(start));
            assertEquals("LINKED_UNVERIFIED",inspect(f).getJSONArray("session_links").getJSONObject(0).getString("state"));
        }
        for(boolean over:new boolean[]{false,true}){
            var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence()
                .put("expires_at","2026-09-28T18:00:00Z")
                .put("started_at","2026-09-26T10:01:00.123456789Z")
                .put("completed_at",over?"2026-09-27T10:01:00.123456790Z":"2026-09-27T10:01:00.123456789Z");
            put(f,false,start);put(f,true,finish(start));
            JSONObject row=inspect(f).getJSONArray("session_links").getJSONObject(0);
            assertEquals(over?"UNRESOLVED_INVALID_OR_MISMATCHED":"LINKED_UNVERIFIED",row.getString("state"));
        }
    }

    @Test public void legacyNoClockBaseOrStartEntryRemainsUnverifiedWithoutRewrite()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence();start.remove("clock_base_at");start.put("native_scan_entry_id","");
        put(f,false,start);put(f,true,finish(start));JSONObject row=inspect(f).getJSONArray("session_links").getJSONObject(0);
        assertEquals("LINKED_UNVERIFIED",row.getString("state"));assertEquals("",row.getString("start_entry_id"));
    }
    @Test public void zeroOccurrenceRecordsNeverProveEmptyBrowserOrReusablePhone()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();JSONObject result=inspect(f);assertEquals(0,result.getJSONArray("session_links").length());
        assertEquals(1,result.getInt("unknown_record_count"));assertEquals("UNKNOWN",result.getString("native_semantic_inventory_state"));
    }
}
