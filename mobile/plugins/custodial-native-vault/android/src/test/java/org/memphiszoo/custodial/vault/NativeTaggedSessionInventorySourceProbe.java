package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Actual current occurrence/Finish writer and structural reader; memory-only source fixture. */
public final class NativeTaggedSessionInventorySourceProbe {
    private static final String SESSION="11111111-1111-4111-8111-111111111111",START="22222222-2222-4222-8222-222222222222",FINISH="33333333-3333-4333-8333-333333333333",DEVICE="SYNTHETIC_DEVICE";
    private static int cases,mismatches;
    private static final class MemoryPreferences implements SharedPreferences {
        final Map<String,Object> values=new HashMap<>();
        public Map<String,?> getAll(){return new HashMap<>(values);}public boolean contains(String k){return values.containsKey(k);}
        public String getString(String k,String d){return (String)values.getOrDefault(k,d);}
        @SuppressWarnings("unchecked") public Set<String> getStringSet(String k,Set<String>d){return (Set<String>)values.getOrDefault(k,d);}
        public int getInt(String k,int d){return (Integer)values.getOrDefault(k,d);}public long getLong(String k,long d){return (Long)values.getOrDefault(k,d);}
        public float getFloat(String k,float d){return (Float)values.getOrDefault(k,d);}public boolean getBoolean(String k,boolean d){return (Boolean)values.getOrDefault(k,d);}
        public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l){throw new UnsupportedOperationException();}public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l){throw new UnsupportedOperationException();}
        public Editor edit(){return new Editor(){final Map<String,Object>writes=new HashMap<>();final Set<String>removes=new java.util.HashSet<>();boolean clear;
            public Editor putString(String k,String v){writes.put(k,v);return this;}public Editor putStringSet(String k,Set<String>v){writes.put(k,v);return this;}
            public Editor putInt(String k,int v){writes.put(k,v);return this;}public Editor putLong(String k,long v){writes.put(k,v);return this;}public Editor putFloat(String k,float v){writes.put(k,v);return this;}public Editor putBoolean(String k,boolean v){writes.put(k,v);return this;}
            public Editor remove(String k){removes.add(k);return this;}public Editor clear(){clear=true;return this;}
            public boolean commit(){if(clear)values.clear();for(String k:removes)values.remove(k);values.putAll(writes);return true;}public void apply(){throw new UnsupportedOperationException();}
        };}
    }
    private static final class MemoryCipher implements CredentialCipher {
        final Map<String,String> captured=new HashMap<>();int next;
        public EncryptedSecret encrypt(char[] value)throws VaultFailure{String id="synthetic-ciphertext-"+(++next);captured.put(id,new String(value));return new EncryptedSecret(id,"synthetic-iv");}
        public EncryptedSecret encryptWithExistingKey(char[] value)throws VaultFailure{return encrypt(value);}
        public char[] decrypt(EncryptedSecret value)throws VaultFailure{String raw=captured.get(value.ciphertext);if(raw==null)throw new VaultFailure("synthetic_ciphertext_missing");return raw.toCharArray();}
        public void destroyKey()throws VaultFailure{throw new VaultFailure("source_probe_no_key_retirement");}
    }
    private static final class Fixture {
        final JSONObject occurrence,finish;
        final Map<String,Object> originalProtected;
        Fixture(String tag,boolean completed)throws Exception{
            MemoryPreferences preferences=new MemoryPreferences();MemoryCipher cipher=new MemoryCipher();
            AndroidOfflineAuthorityTimeStore store=new AndroidOfflineAuthorityTimeStore(preferences,cipher);
            OfflineAuthorityTime.OfflineOccurrence dto=new OfflineAuthorityTime.OfflineOccurrence(SESSION,DEVICE,"SYNTHETIC_LOCATION","ab".repeat(32),"2026-10-08T16:00:00.000Z","2026-10-08T21:00:00.000Z","2026-10-08T16:00:00.000Z",100L,1,START,"2026-10-08T16:05:00.000Z",completed?"2026-10-08T16:15:00.000Z":"",tag);
            store.saveOccurrence(dto);if(completed)store.saveFinishEntryId(dto,FINISH);
            originalProtected=new HashMap<>(preferences.values);
            occurrence=new JSONObject(cipher.captured.get("synthetic-ciphertext-1"));finish=completed?new JSONObject(cipher.captured.get("synthetic-ciphertext-2")):null;
            require(tag.isEmpty()?!occurrence.has("native_tag_identity"):tag.equals(occurrence.get("native_tag_identity")),"actual_writer_shape_mismatch");
        }
    }
    private static void require(boolean good,String label){if(!good)throw new AssertionError(label);}
    private static JSONObject copy(JSONObject value)throws Exception{return new JSONObject(value.toString());}
    private static void check(String label,Fixture fixture,JSONObject occurrence,JSONObject finish,String principalDevice,String expected)throws Exception{
        String key="offline_occurrence_sha256:"+NativeProviderPrincipal.hash(SESSION),finishKey="offline_finish_proof_sha256:"+NativeProviderPrincipal.hash(SESSION);
        Map<String,NativeProtectedWorkInventory.Decoded> decoded=new HashMap<>();decoded.put(key,new NativeProtectedWorkInventory.Decoded(occurrence,NativeProviderPrincipal.hash(occurrence.toString())));
        if(finish!=null)decoded.put(finishKey,new NativeProtectedWorkInventory.Decoded(finish,NativeProviderPrincipal.hash(finish.toString())));
        String originalOccurrence=occurrence.toString(),originalFinish=finish==null?null:finish.toString();
        JSONArray result=NativeProtectedSessionInventory.inspect(decoded.keySet(),decoded,new JSONObject().put("device_id",principalDevice));
        require(result.length()>=1,"original_occurrence_lost");JSONObject row=result.getJSONObject(0);
        for(int i=0;i<result.length();i++){JSONObject item=result.getJSONObject(i);require(Boolean.FALSE.equals(item.get("automatic_acceptance"))&&Boolean.TRUE.equals(item.get("retained_unresolved"))&&"UNKNOWN".equals(item.get("start_cutoff_proof"))&&"UNKNOWN".equals(item.get("finish_cutoff_proof"))&&"NOT_ESTABLISHED".equals(item.get("server_acceptance")),"false_authority_or_physical_proof");}
        require(originalOccurrence.equals(occurrence.toString())&&(finish==null||originalFinish.equals(finish.toString()))&&!fixture.originalProtected.isEmpty(),"original_record_mutation");
        boolean good=expected.equals(row.getString("state"));cases++;if(!good)mismatches++;System.out.println((good?"PASS ":"MISMATCH ")+label);
    }
    public static void main(String[] args)throws Exception{
        Fixture openA=new Fixture("nfc-a.v1:04112233445566",false),doneA=new Fixture("nfc-a.v1:04112233445566",true),openV=new Fixture("nfc-v.v1:e004112233445566",false),priorTag=new Fixture("ntag21x.v1:04112233445566",false),untagged=new Fixture("",false);
        check("actual_current_writer_tagged_open_occurrence",openA,copy(openA.occurrence),null,DEVICE,"OPEN_RETAINED");
        check("actual_current_writer_tagged_finish_link_unverified",doneA,copy(doneA.occurrence),copy(doneA.finish),DEVICE,"LINKED_UNVERIFIED");
        check("actual_current_writer_fixed_nfc_v_identity",openV,copy(openV.occurrence),null,DEVICE,"OPEN_RETAINED");
        check("prior_supported_tag_identity_without_rewrite",priorTag,copy(priorTag.occurrence),null,DEVICE,"OPEN_RETAINED");
        check("current_untagged_retained_shape_stays_supported",untagged,copy(untagged.occurrence),null,DEVICE,"OPEN_RETAINED");
        JSONObject legacy=copy(untagged.occurrence);legacy.remove("clock_base_at");check("legacy_untagged_retained_shape_stays_supported",untagged,legacy,null,DEVICE,"OPEN_RETAINED");
        check("malformed_tag_identity_stays_unresolved",openA,copy(openA.occurrence).put("native_tag_identity","nfc-a.v1:00000000"),null,DEVICE,"UNRESOLVED_INVALID_OR_MISMATCHED");
        check("nonstring_tag_identity_stays_unresolved",openA,copy(openA.occurrence).put("native_tag_identity",7),null,DEVICE,"UNRESOLVED_INVALID_OR_MISMATCHED");
        check("unknown_extra_field_stays_unresolved",openA,copy(openA.occurrence).put("unexpected_field","must-not-ignore"),null,DEVICE,"UNRESOLVED_INVALID_OR_MISMATCHED");
        JSONObject unsupported=copy(openA.occurrence);unsupported.remove("clock_base_at");check("invented_tagged_legacy_shape_stays_unresolved",openA,unsupported,null,DEVICE,"UNRESOLVED_INVALID_OR_MISMATCHED");
        check("mismatched_finish_binding_stays_unresolved",doneA,copy(doneA.occurrence),copy(doneA.finish).put("completed_at","2026-10-08T16:16:00.000Z"),DEVICE,"UNRESOLVED_INVALID_OR_MISMATCHED");
        check("foreign_original_principal_stays_unresolved",openA,copy(openA.occurrence),null,"FOREIGN_SYNTHETIC_DEVICE","UNRESOLVED_INVALID_OR_MISMATCHED");
        System.out.println("RESULT {\"cases\":"+cases+",\"pass\":"+(cases-mismatches)+",\"mismatches\":"+mismatches+",\"actual_current_writer_and_reader\":true,\"synthetic_memory_only_storage_and_cipher\":true,\"physical_tag_proof\":false,\"server_acceptance_proof\":false}");
    }
}
