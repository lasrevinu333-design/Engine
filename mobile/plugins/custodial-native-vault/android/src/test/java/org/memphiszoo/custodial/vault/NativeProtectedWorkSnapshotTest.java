package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

public final class NativeProtectedWorkSnapshotTest {
    static NativeProtectedWorkSnapshot capture(Map<String,?> source)throws Exception{return NativeProtectedWorkSnapshot.capture(source);}
    @Test public void orderIndependentCompleteTypedIdentity()throws Exception{
        var a=new LinkedHashMap<String,Object>();a.put("draft","original ciphertext");a.put("unknown",7);a.put("set",new HashSet<>(Set.of("a","b")));
        var b=new LinkedHashMap<String,Object>();b.put("set",Set.of("b","a"));b.put("unknown",7);b.put("draft","original ciphertext");
        assertEquals(capture(a).digest,capture(b).digest);assertEquals(3,capture(a).recordCount);
        for(String key:a.keySet()){var changed=new HashMap<>(a);changed.remove(key);assertNotEquals(capture(a).digest,capture(changed).digest);}
        b.put("unknown",7L);assertNotEquals(capture(a).digest,capture(b).digest);
        b.put("unknown","7");assertNotEquals(capture(a).digest,capture(b).digest);
    }
    @Test public void unknownCorruptRecordsAreIncludedAndNotCalledEmpty()throws Exception{
        var source=Map.of("offline_occurrence_sha256:unknown","unreadable encrypted work","new_unknown_namespace","preserved");
        var snapshot=capture(source);var manifest=snapshot.manifest(NativeSeparationContextTest.read(NativeSeparationContextTest.data()));
        assertEquals(2,manifest.getInt("record_count"));assertEquals(2,manifest.getJSONArray("records").length());
        assertEquals("UNKNOWN",manifest.getString("native_semantic_inventory_state"));assertEquals("UNKNOWN",manifest.getString("browser_inventory_state"));
        assertFalse(manifest.getBoolean("phone_released"));assertFalse(manifest.getBoolean("new_work_allowed"));
        assertFalse(manifest.toString().contains("unreadable encrypted work"));
        var empty=capture(Map.of()).manifest(NativeSeparationContextTest.read(NativeSeparationContextTest.data()));
        assertEquals("UNKNOWN",empty.getString("native_semantic_inventory_state"));assertEquals("UNKNOWN",empty.getString("browser_inventory_state"));
    }
    @Test public void everySupportedTypeAndExactUnicodeRemainDistinct()throws Exception{
        Object[] values={"7",7,7L,true,false,7f,0f,-0f,Float.intBitsToFloat(0x7fc00001),Float.intBitsToFloat(0x7fc00002),Set.of("7"),Set.of("a","bc"),Set.of("ab","c"),"\ud800","\ud801","?",""};
        Set<String> digests=new HashSet<>();for(Object value:values)assertTrue(digests.add(capture(Map.of("key",value)).digest));
        assertNotEquals(capture(Map.of("\ud800","x")).digest,capture(Map.of("\ud801","x")).digest);
    }
    @Test public void callerMutationDoesNotChangeCapturedSnapshotOrManifest()throws Exception{
        var source=new HashMap<String,Object>();var set=new HashSet<>(Set.of("a"));source.put("set",set);
        var snapshot=capture(source);String digest=snapshot.digest;set.add("b");source.clear();
        var context=NativeSeparationContextTest.read(NativeSeparationContextTest.data());var first=snapshot.manifest(context);
        first.getJSONArray("records").put("forged");first.put("phone_released",true);
        assertEquals(1,snapshot.manifest(context).getJSONArray("records").length());assertEquals(digest,snapshot.digest);
        assertFalse(snapshot.manifest(context).getBoolean("phone_released"));
    }
    @Test public void invalidOrOverCapacityIsFailureNeverTruncatedEmpty()throws Exception{
        var tooMany=new HashMap<String,Object>();for(int i=0;i<4097;i++)tooMany.put("k"+i,"x");
        var nullValue=new HashMap<String,Object>();nullValue.put("k",null);
        for(Map<String,?> source:java.util.Arrays.<Map<String,?>>asList(null,tooMany,nullValue,Map.of("k",new Object()),Map.of("k",Set.of(7)),Map.of("k",1d),Map.of("k","x".repeat(524289)),Map.of("native_separation_freeze.v1","old fence"))){
            try{capture(source);fail();}catch(VaultFailure expected){assertEquals(NativeProtectedWorkSnapshot.FAILURE,expected.code);}
        }
    }
}
