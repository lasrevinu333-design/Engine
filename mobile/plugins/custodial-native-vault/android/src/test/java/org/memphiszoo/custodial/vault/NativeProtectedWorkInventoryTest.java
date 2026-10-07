package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Actual Android encrypted-store/coordinator with synthetic key/disk/HTTP.
 * This proves only read-only discovery, NOT semantic eligibility or phone ACK. */
public final class NativeProtectedWorkInventoryTest {
    private static String id(int n){return NativeSeparationContextTest.id(n);}
    private static String occurrenceKey(String session)throws Exception{return "offline_occurrence_sha256:"+NativeProviderPrincipal.hash(session);}
    private static String protectedRecord(TestCipher cipher,String text)throws Exception{
        EncryptedSecret value=cipher.encryptWithExistingKey(text.toCharArray());
        return new JSONObject().put("ciphertext",value.ciphertext).put("iv",value.iv).toString();
    }
    private static JSONObject kind(JSONObject result,String kind)throws Exception{
        JSONArray rows=result.getJSONArray("records");for(int i=0;i<rows.length();i++)if(kind.equals(rows.getJSONObject(i).getString("kind")))return rows.getJSONObject(i);
        throw new AssertionError("missing kind "+kind);
    }
    @Test public void frozenDiscoveryRetainsEveryRecordWithoutClaimingAcceptance()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();
        var occurrence=new OfflineAuthorityTime.OfflineOccurrence(id(41),"KIOSK_08","RR_TEST",id(42),"2026-09-26T10:00:00Z","2026-09-26T18:00:00Z",
            "2026-09-26T10:00:00Z",1000,3,id(43),"2026-09-26T10:01:00Z","2026-09-26T10:10:00Z");
        f.store.saveOccurrence(occurrence);f.store.saveFinishEntryId(occurrence,id(44));
        f.store.saveScanEntries(Map.of(id(43),Map.of("entry_id",id(43),"synthetic","retained scan")));
        f.store.saveNfcHandoffs(Map.of(id(45),Map.of("handoff_id",id(45),"entry_id",id(43),"synthetic","retained handoff")));
        f.store.saveCompletionReceipt("a".repeat(64),"original receipt requires exact request to validate");
        f.store.saveLegacyRecord("principal","original legacy record");
        var proof=f.observe();var before=new HashMap<>(f.preferences.disk);int commits=f.preferences.commits,encryptions=f.workCipher.existingKeyEncryptCalls;
        JSONObject result=NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null).json();
        assertEquals(proof.rawSnapshotDigest,result.getString("raw_snapshot_sha256"));
        assertEquals(before.size()-1,result.getInt("record_count"));assertEquals(result.getInt("record_count"),result.getJSONArray("records").length());
        assertEquals(1,result.getInt("unknown_record_count"));
        assertEquals(id(41),kind(result,"OCCURRENCE").getJSONArray("identifiers").getJSONObject(0).getString("client_session_id"));
        assertEquals(id(44),kind(result,"FINISH_PROOF").getJSONArray("identifiers").getJSONObject(0).getString("entry_id"));
        assertEquals(id(45),kind(result,"NFC_HANDOFFS").getJSONArray("identifiers").getJSONObject(0).getString("handoff_id"));
        assertEquals("READABLE_UNVERIFIED",kind(result,"COMPLETION_RECEIPT").getString("state"));
        assertEquals("UNKNOWN",kind(result,"UNRECOGNIZED").getString("state"));
        assertFalse(result.getBoolean("new_work_allowed"));assertFalse(result.getBoolean("phone_released"));
        assertEquals("UNKNOWN",result.getString("native_semantic_inventory_state"));assertEquals("UNKNOWN",result.getString("browser_inventory_state"));
        assertEquals(before,f.preferences.disk);assertEquals(commits,f.preferences.commits);assertEquals(encryptions,f.workCipher.existingKeyEncryptCalls);
        assertEquals(1,f.transport.calls);assertEquals(0,f.workCipher.destroyCalls);
        assertFalse(result.toString().contains("original legacy record"));assertFalse(result.toString().contains("retained handoff"));
    }
    @Test public void malformedDuplicateWrongPrincipalAndUnknownRawRowsRemainRepresented()throws Exception{
        for(int variation=0;variation<6;variation++){
            var f=new NativeSeparationFreezeTest.Fixture();String key=occurrenceKey(id(41));
            JSONObject row=new JSONObject().put("client_session_id",id(41)).put("device_id","KIOSK_08").put("native_scan_entry_id",id(43));
            if(variation==0)row.put("device_id","OTHER_PHONE");
            if(variation==1)row.put("client_session_id",id(42));
            if(variation==2)row.put("native_scan_entry_id",7);
            String raw=protectedRecord(f.workCipher,row.toString());
            if(variation==3)raw=protectedRecord(f.workCipher,"{\"client_session_id\":\"old duplicate\",\"client_session_id\":\""+id(41)+"\",\"device_id\":\"KIOSK_08\",\"native_scan_entry_id\":\""+id(43)+"\"}");
            if(variation==4)raw="corrupt retained encrypted bytes";
            f.preferences.disk.put(key,variation==5?7:raw);f.observe();var before=new HashMap<>(f.preferences.disk);
            JSONObject result=NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null).json();
            JSONObject item=kind(result,"OCCURRENCE");assertEquals("UNKNOWN",item.getString("state"));assertFalse(item.has("identifiers"));
            assertEquals(2,result.getInt("unknown_record_count"));assertEquals(before.size()-1,result.getInt("record_count"));assertEquals(before,f.preferences.disk);
        }
    }
    @Test public void arrayDuplicateIdsAreUnknownNotDeduplicatedOrDropped()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();
        JSONObject row=new JSONObject().put("entries",new JSONArray().put(new JSONObject().put("entry_id",id(1))).put(new JSONObject().put("entry_id",id(1))));
        f.preferences.disk.put("offline_scan_entries",protectedRecord(f.workCipher,row.toString()));f.observe();var before=new HashMap<>(f.preferences.disk);
        JSONObject result=NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null).json();
        assertEquals("UNKNOWN",kind(result,"SCAN_ENTRIES").getString("state"));assertEquals(before,f.preferences.disk);
    }
    @Test public void unknownRecordIdentityCannotDiscloseReversiblePreferenceKey()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();String secretKey="unknown:answer=retained-secret";
        f.preferences.disk.put(secretKey,"opaque retained bytes");f.preferences.durableDisk=new HashMap<>(f.preferences.disk);
        f.observe();JSONObject result=NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null).json();
        String encoded=result.toString(),reversibleHex=utf16Hex(secretKey);
        assertFalse(encoded.contains(secretKey));assertFalse(encoded.contains(reversibleHex));assertFalse(encoded.contains("raw_identity\""));
        JSONArray rows=result.getJSONArray("records");
        for(int i=0;i<rows.length();i++)assertTrue(rows.getJSONObject(i).getString("raw_identity_sha256").matches("[a-f0-9]{64}"));
    }
    private static String utf16Hex(String value){
        StringBuilder out=new StringBuilder();
        for(int i=0;i<value.length();i++)for(int shift=12;shift>=0;shift-=4)out.append(Character.forDigit((value.charAt(i)>>>shift)&15,16));
        return out.toString();
    }

    @Test public void emptyAndUnreadableNativeDiscoveryNeverClaimsEmptyBrowserOrFinalization()throws Exception{
        var proof=AndroidProtectedWorkPreferencesTest.proof(Map.of());
        JSONObject empty=NativeProtectedWorkInventory.inspect(Map.of(),proof,(k,v)->{throw new AssertionError();}).json();
        assertEquals(0,empty.getInt("record_count"));assertEquals("UNKNOWN",empty.getString("native_semantic_inventory_state"));assertEquals("UNKNOWN",empty.getString("browser_inventory_state"));
        assertFalse(empty.getBoolean("phone_released"));assertFalse(empty.getBoolean("new_work_allowed"));
        AndroidProtectedWorkPreferencesTest.denied(()->NativeProtectedWorkInventory.inspect(Map.of("other","changed"),proof,(k,v)->{throw new AssertionError();}));
        var f=new NativeSeparationFreezeTest.Fixture();f.observe();String principal=(String)f.preferences.disk.get("authenticated_principal");
        f.workCipher.unreadableCiphertexts.add(new JSONObject(principal).getString("ciphertext"));
        AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null));
    }
    @Test public void inspectionRechecksWholeRawSnapshotAfterExactRecordDecode()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();f.store.saveCompletionReceipt("a".repeat(64),"retained original receipt");f.observe();
        String target=new JSONObject((String)f.preferences.disk.get("authenticated_completion_receipt_sha256:"+"a".repeat(64))).getString("ciphertext");
        final boolean[] changed={false};CredentialCipher racing=new CredentialCipher(){
            public EncryptedSecret encrypt(char[] clear){throw new AssertionError("inspection cannot encrypt");}
            public void destroyKey(){throw new AssertionError("inspection cannot destroy");}
            public char[] decrypt(EncryptedSecret encrypted)throws VaultFailure{
                char[] decoded=f.workCipher.decrypt(encrypted);if(target.equals(encrypted.ciphertext)){changed[0]=true;f.preferences.disk.put("unknown-old-work","fault-injected changed record");}return decoded;
            }
        };
        var reader=new AndroidOfflineAuthorityTimeStore(f.preferences.object(),racing);int commits=f.preferences.commits;
        AndroidProtectedWorkPreferencesTest.denied(()->NativeSeparationFreeze.inspect(f.transport.engine,reader,new NativePrincipalJournal(reader),null));
        assertTrue(changed[0]);assertEquals(commits,f.preferences.commits);assertEquals("fault-injected changed record",f.preferences.disk.get("unknown-old-work"));
    }
}
