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
        var context=NativeSeparationContextTest.read(NativeSeparationContextTest.data());String originalRows=snapshot.recordRows().toString();var detached=snapshot.recordRows();
        detached.getJSONArray(0).put("forged");detached.put("forged-row");var first=snapshot.manifest(context);
        first.getJSONArray("records").getJSONArray(0).put("forged");first.getJSONArray("records").put("forged");first.put("phone_released",true);
        assertEquals(originalRows,snapshot.recordRows().toString());
        assertEquals(1,snapshot.manifest(context).getJSONArray("records").length());assertEquals(digest,snapshot.digest);
        assertFalse(snapshot.manifest(context).getBoolean("phone_released"));
    }
    @Test public void detachedRowsPreserveSortedOddUnicodeSerializationAndDigest()throws Exception{
        var source=new HashMap<String,Object>();source.put("z","v\ud800");source.put("\ud800",7);source.put("a",Set.of("b","a"));
        var snapshot=capture(source);
        String expected="[[\"0061\",\"string-set\",\"738875f5d9549caf11931cbf3c35e1555aded074aebd724c359d0f26d02b237c\"],[\"007a\",\"string\",\"22666c19e4b2e78af215c6f3758ff8bf94c6da4c02d2436a65d4dd6d714bf24b\"],[\"d800\",\"int32\",\"8db79514a2fab87015a31a8504ad13bfd6a1257bf253bdad6e05076420bacdf8\"]]";
        assertEquals(expected,snapshot.recordRows().toString());
        assertEquals("d2b08e4f89083a375e1f1a807a8f79c3e4197e0b072e84937da6b0c7fe056d46",snapshot.digest);
        var changed=new HashMap<>(source);changed.put("z","v\ud801");assertNotEquals(snapshot.digest,capture(changed).digest);
    }
    @Test public void largeDetachedRowListRemainsWithinOriginalCountAndEncodedSizeBounds()throws Exception{
        var source=new HashMap<String,Object>();for(int i=0;i<1024;i++)source.put(String.format(java.util.Locale.ROOT,"row-%04d",i),"retained-"+i);
        var snapshot=capture(source);String encoded=snapshot.recordRows().toString();
        assertEquals(1024,snapshot.recordCount);assertEquals(1024,snapshot.recordRows().length());assertTrue(encoded.length()<=196608);
        var manifest=snapshot.manifest(NativeSeparationContextTest.read(NativeSeparationContextTest.data()));
        assertEquals(encoded,manifest.getJSONArray("records").toString());assertEquals(1024,manifest.getInt("record_count"));
    }
    @Test public void invalidOrOverCapacityIsFailureNeverTruncatedEmpty()throws Exception{
        var tooMany=new HashMap<String,Object>();for(int i=0;i<4097;i++)tooMany.put("k"+i,"x");
        var nullValue=new HashMap<String,Object>();nullValue.put("k",null);
        for(Map<String,?> source:java.util.Arrays.<Map<String,?>>asList(null,tooMany,nullValue,Map.of("k",new Object()),Map.of("k",Set.of(7)),Map.of("k",1d),Map.of("k","x".repeat(524289)),Map.of("native_separation_freeze.v1","old fence"))){
            try{capture(source);fail();}catch(VaultFailure expected){assertEquals(NativeProtectedWorkSnapshot.FAILURE,expected.code);}
        }
    }
}
