package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;

/** NEW lossless capture/native owner seam cases only. Reflection sees ONLY
 * synthetic private test bytes to independently decode the binary format;
 * no production raw getter, credential/key/real prefs/network/phone is used.
 * Reused fixture factories do not execute their old JUnit methods. */
public final class NativeRetainedNamespaceValuesTest {
    static final String IDENTITY="a".repeat(64),WORK=NativeRetainedNamespaceCensus.WORK;
    static Map<String,Map<String,?>> empty(){Map<String,Map<String,?>> all=new TreeMap<>();
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())all.put(name,new HashMap<String,Object>());return all;}
    @SuppressWarnings("unchecked") static Map<String,Object> rows(Map<String,Map<String,?>> all,String name){return (Map<String,Object>)all.get(name);}
    static Field bytesField() throws Exception {Field f=NativeRetainedNamespaceValues.class.getDeclaredField("encoded");f.setAccessible(true);return f;}
    static byte[] bytes(NativeRetainedNamespaceValues value)throws Exception{return ((byte[])bytesField().get(value)).clone();}
    static String text(DataInputStream in)throws Exception {int size=in.readInt();assertTrue(size>=0&&size<=524288);StringBuilder value=new StringBuilder(size);
        for(int i=0;i<size;i++)value.append(in.readChar());return value.toString();}
    static Map<String,Map<String,?>> decoded(NativeRetainedNamespaceValues value)throws Exception {
        byte[] original=bytes(value);try(var in=new DataInputStream(new ByteArrayInputStream(original))){
            assertEquals(NativeRetainedNamespaceValues.SCHEMA,text(in));assertEquals(value.sourceCaptureSha256,text(in));assertEquals(8,in.readInt());
            Map<String,Map<String,?>> result=new TreeMap<>();
            for(int n=0;n<8;n++){String namespace=text(in);int count=in.readInt();Map<String,Object> records=new TreeMap<>();
                for(int i=0;i<count;i++){String key=text(in);int type=in.readUnsignedByte();Object raw;
                    switch(type){case 1:raw=text(in);break;case 2:raw=in.readInt();break;case 3:raw=in.readLong();break;case 4:{int flag=in.readUnsignedByte();assertTrue(flag==0||flag==1);raw=flag==1;break;}
                    case 5:raw=Float.intBitsToFloat(in.readInt());break;case 6:{int size=in.readInt();Set<String> set=new HashSet<>();for(int j=0;j<size;j++)assertTrue(set.add(text(in)));raw=set;break;}
                    default:throw new AssertionError("unknown encoded type");}
                    assertNull(records.put(key,raw));}
                assertNull(result.put(namespace,records));}
            assertEquals(-1,in.read());return result;
        }finally{Arrays.fill(original,(byte)0);}
    }
    static void same(Map<String,Map<String,?>> expected,Map<String,Map<String,?>> actual)throws Exception {
        assertEquals(expected.keySet(),actual.keySet());for(String name:expected.keySet())assertTrue(name,NativeProtectedWorkSnapshot.exactRawEquals(expected.get(name),actual.get(name)));
    }
    static void denied(NativeOriginalGenerationObservationTest.Action run)throws Exception {NativeOriginalGenerationObservationTest.denied(run);}
    static void noAuthority(NativeRetainedNamespaceValues value){assertFalse(value.durable);assertFalse(value.semanticInventoryComplete);assertFalse(value.currentServerReadback);
        assertFalse(value.workAccepted);assertFalse(value.inventoryAcknowledged);assertFalse(value.resendAllowed);assertFalse(value.finalizerAllowed);assertFalse(value.keyRemovalAllowed);}
    static VaultEngine.NativeRetainedNamespaceValueObservation capture(NativeVaultProviderReferenceCensusTest.Fixture f,
        VaultEngine.NativeRetainedGenerationObservation generation,NativeProtectedNamespaceObservation namespaces)throws Exception {
        return f.old.nativeOwner.engine.observeOriginalRetainedNamespaceValues(generation,namespaces);
    }
    @Test public void allEightDomainsRoundTripEveryRawTypeWithoutUTF8Normalization()throws Exception {
        var all=empty();for(String name:all.keySet()){var r=rows(all,name);r.put("\ud800-key","\udfff\u0000\uffff");r.put("int",Integer.MIN_VALUE);r.put("long",Long.MAX_VALUE);
            r.put("bool",false);r.put("nan",Float.intBitsToFloat(0x7fc00001));r.put("set",Set.of("","\ud800","\udfff","plain"));}
        try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){same(all,decoded(value));assertEquals(48,value.recordCount);assertEquals(8,value.recordCounts.size());noAuthority(value);}
    }
    @Test public void rawSignedZeroNaNPayloadAndIntLongRemainIndependentIdentities()throws Exception {
        var all=empty();var r=rows(all,WORK);r.put("raw",0.0f);String old;
        try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){old=value.valuesSha256;}
        for(Object changed:new Object[]{-0.0f,Float.intBitsToFloat(0x7fc00001),Float.intBitsToFloat(0x7fc00002),0,0L}){
            r.put("raw",changed);try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){assertNotEquals(old,value.valuesSha256);same(all,decoded(value));}}
    }
    @Test public void orderChangesDoNotChangeBytesOrFollowMutableSets()throws Exception {
        var all=empty();var set=new HashSet<>(Set.of("a","b"));rows(all,WORK).put("z",set);rows(all,WORK).put("a","first");
        try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){var reordered=new LinkedHashMap<String,Object>();reordered.put("a","first");reordered.put("z",new HashSet<>(Set.of("b","a")));
            all.put(WORK,reordered);try(var again=NativeRetainedNamespaceValues.capture(all,IDENTITY)){assertArrayEquals(bytes(value),bytes(again));}
            set.add("foreign");assertTrue(value.matchesOriginal(all,IDENTITY));reordered.put("z",Set.of("a","b","changed"));assertFalse(value.matchesOriginal(all,IDENTITY));}
    }
    @Test public void sameRowsMovedBetweenDeclaredNamespacesChangeFullValuesIdentity()throws Exception {
        var all=empty();rows(all,WORK).put("same","unchanged");try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){
            rows(all,NativeRetainedNamespaceCensus.BATCH).put("same","unchanged");rows(all,WORK).clear();assertFalse(value.matchesOriginal(all,IDENTITY));
            try(var changed=NativeRetainedNamespaceValues.capture(all,IDENTITY)){assertNotEquals(value.valuesSha256,changed.valuesSha256);}}
    }
    @Test public void everyCapturedMarkerUnknownKeyAndOpaqueCiphertextIsRetainedWithoutFilter()throws Exception {
        var all=empty();rows(all,WORK).put(NativeRetainedWorkCapture.FENCE,"corrupt-but-original-marker");rows(all,WORK).put(NativeRetainedWorkCapture.PROBE,false);
        rows(all,"MemphisZooCustodialNativeVaultV2").put("unknown-ciphertext","original-opaque-bytes");rows(all,"WSSecureStorageSharedPreferences").put("not-a-known-alias",Set.of("opaque","old"));
        // Unlike the WORK-only snapshot comparator, this full-value encoder
        // preserves a typed original PROBE rather than requiring it be String.
        // This case has no floats: Map.equals independently checks all exact
        // String/Boolean/Set originals, including the Boolean false marker.
        try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){assertEquals(4,value.recordCount);assertEquals(all,decoded(value));noAuthority(value);}
    }
    @Test public void omittedExtraNullOrForeignNamespaceIsRejectedNotReportedEmpty()throws Exception {
        for(String missing:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){var all=empty();all.remove(missing);denied(()->NativeRetainedNamespaceValues.capture(all,IDENTITY));}
        var extra=empty();extra.put("foreign-plugin-not-approved",Map.of());denied(()->NativeRetainedNamespaceValues.capture(extra,IDENTITY));
        var absent=empty();absent.put(WORK,null);denied(()->NativeRetainedNamespaceValues.capture(absent,IDENTITY));denied(()->NativeRetainedNamespaceValues.capture(null,IDENTITY));
    }
    @Test public void unsupportedValuesInvalidKeysAndSetMembersCannotBeDroppedOrCoerced()throws Exception {
        for(Object value:new Object[]{1d,new Object(),new byte[]{1},Set.of(1),null}){var all=empty();rows(all,WORK).put("unknown",value);denied(()->NativeRetainedNamespaceValues.capture(all,IDENTITY));assertSame(value,rows(all,WORK).get("unknown"));}
        for(String key:new String[]{"","x".repeat(1025),null}){var all=empty();rows(all,WORK).put(key,"opaque");denied(()->NativeRetainedNamespaceValues.capture(all,IDENTITY));}
    }
    @Test public void perStoreAndStringBoundsFailClosedPreservingOriginalRows()throws Exception {
        var all=empty();for(int i=0;i<4097;i++)rows(all,WORK).put("key"+i,i);denied(()->NativeRetainedNamespaceValues.capture(all,IDENTITY));assertEquals(4097,rows(all,WORK).size());
        var oversized=empty();rows(oversized,WORK).put("large","x".repeat(524289));denied(()->NativeRetainedNamespaceValues.capture(oversized,IDENTITY));
    }
    @Test public void aggregateCharacterCapAppliesAcrossAllEightDomains()throws Exception {
        var all=empty();for(String name:all.keySet())for(int i=0;i<3;i++)rows(all,name).put("key"+i,"x".repeat(524288));
        denied(()->NativeRetainedNamespaceValues.capture(all,IDENTITY));assertEquals(3,rows(all,WORK).size());
    }
    @Test public void sourceObservationDigestIsBoundAndMalformedDigestsRefuseCapture()throws Exception {
        var all=empty();try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){assertFalse(value.matchesOriginal(all,"b".repeat(64)));noAuthority(value);}
        for(String digest:new String[]{"A".repeat(64),"missing","",null})denied(()->NativeRetainedNamespaceValues.capture(all,digest));
    }
    @Test public void closedCaptureLogicalByteBufferIsWipedAndNoGenericRawGetterExists()throws Exception {
        var all=empty();rows(all,WORK).put("synthetic","opaque");var value=NativeRetainedNamespaceValues.capture(all,IDENTITY);
        byte[] original=(byte[])bytesField().get(value);assertTrue(original.length>0);value.close();assertArrayEquals(new byte[original.length],original);assertNull(bytesField().get(value));
        denied(value::requireOpen);denied(()->value.matchesOriginal(all,IDENTITY));noAuthority(value);
        for(var method:NativeRetainedNamespaceValues.class.getDeclaredMethods())if(!Modifier.isPrivate(method.getModifiers()))assertNotEquals("no raw byte getter",byte[].class,method.getReturnType());
    }
    @Test public void ownerCaptureIncludesAllDeclaredValuesAndOnlyDiagnosticProjection()throws Exception {
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();var stable=new NativeVaultProviderReferenceCensusTest.Stable(f);
        try(var generation=f.old.observe();var namespaces=f.observe();var value=capture(f,generation,namespaces)){
            var p=value.projection();assertEquals(f.total(),p.getInt("record_count"));assertEquals(8,p.getJSONArray("namespaces").length());
            assertEquals(generation.projection().get("generation_id"),p.get("original_generation_id"));assertEquals(f.old.principal.digest,p.get("original_principal_digest"));
            for(String secret:new String[]{"ciphertext","synthetic-provider-token","installation_seal","opaque historical","manifest_body","body_base64","native_separation_freeze"})assertFalse(secret,p.toString().contains(secret));
            for(String flag:new String[]{"durable_retention","current_server_readback","work_accepted","inventory_acknowledged","resend_allowed","finalizer_allowed","key_removal","phone_released","all_writer_durable_freeze_or_ABA_guard"})assertFalse(flag,p.getBoolean(flag));
            p.put("work_accepted",true);assertFalse(value.projection().getBoolean("work_accepted"));
        }stable.check();f.old.wiped();
    }
    @Test public void closedForeignAndMissingOriginalGenerationCannotProduceAValueHandle()throws Exception {
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();var other=new NativeVaultProviderReferenceCensusTest.Fixture();
        try(var namespaces=f.observe()){var stable=new NativeVaultProviderReferenceCensusTest.Stable(f);denied(()->capture(f,null,namespaces));
            try(var foreign=other.old.observe()){denied(()->capture(f,foreign,namespaces));}
            try(var closed=f.old.observe()){closed.close();denied(()->capture(f,closed,namespaces));}stable.check();}
        f.old.wiped();other.old.wiped();
    }
    @Test public void unknownRowChangeInAnyDomainInvalidatesHandleWithoutRewrite()throws Exception {
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            var f=new NativeVaultProviderReferenceCensusTest.Fixture();try(var generation=f.old.observe();var namespaces=f.observe();var value=capture(f,generation,namespaces)){
                @SuppressWarnings("unchecked") var raw=(Map<String,Object>)f.raw(name);raw.put("post-capture-unknown","original-mutation-kept");
                denied(value::projection);assertEquals("original-mutation-kept",raw.get("post-capture-unknown"));}
            f.old.nativeOwner.wiped();}
    }
    @Test public void sameCountCounterfeitWorkVaultOrProviderReaderIsNeverOwnerBound()throws Exception {
        for(String target:new String[]{WORK,NativeVaultProviderReferenceCensus.VAULT,NativeVaultProviderReferenceCensus.PROVIDER}){
            var f=new NativeVaultProviderReferenceCensusTest.Fixture();Map<String,NativeProtectedNamespaceObservation.Store> readers=new TreeMap<>();
            for(String name:f.other.keySet())readers.put(name,()->{var raw=new HashMap<String,Object>(f.raw(name));if(name.equals(target)){String key=raw.keySet().iterator().next();raw.put(key,"counterfeit");}return raw;});
            try(var generation=f.old.observe();var namespaces=NativeProtectedNamespaceObservation.observe(readers)){
                var stable=new NativeVaultProviderReferenceCensusTest.Stable(f);denied(()->capture(f,generation,namespaces));stable.check();}
            f.old.wiped();}
    }
    @Test public void closedObservationAndClosedValueDoNotCloseSomeoneElsesGenerationOrStore()throws Exception {
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();try(var generation=f.old.observe();var namespaces=f.observe()){
            var value=capture(f,generation,namespaces);value.close();denied(value::projection);assertNotNull(generation.projection());assertTrue(namespaces.stillCurrent());
            namespaces.close();denied(()->capture(f,generation,namespaces));assertNotNull(generation.projection());}
        f.old.wiped();
    }
    @Test public void mutationDuringPostEncodeReadWindowRefusesEntireNewCapture()throws Exception {
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();Map<String,NativeProtectedNamespaceObservation.Store> readers=new TreeMap<>();
        AtomicInteger calls=new AtomicInteger();String last=f.other.keySet().stream().reduce((a,b)->b).get();
        for(String name:f.other.keySet())readers.put(name,()->{if(name.equals(last)&&calls.incrementAndGet()==7)f.other.get(last).put("changed-after-encoding","kept");return f.raw(name);});
        try(var generation=f.old.observe();var namespaces=NativeProtectedNamespaceObservation.observe(readers)){
            denied(()->capture(f,generation,namespaces));assertTrue(calls.get()>=7);assertEquals("kept",f.other.get(last).get("changed-after-encoding"));}
        f.old.wiped();
    }
    @Test public void originalProviderRotationAndVaultRevisionInvalidateExistingValueHandle()throws Exception {
        for(boolean provider:new boolean[]{true,false}){
            var f=new NativeVaultProviderReferenceCensusTest.Fixture();try(var generation=f.old.observe();var namespaces=f.observe();var value=capture(f,generation,namespaces)){
                if(provider)f.old.provider.captureToken("new-synthetic-generation-capture");else f.old.nativeOwner.bumpVault();
                var stable=new NativeVaultProviderReferenceCensusTest.Stable(f);denied(value::projection);stable.check();}
            f.old.wiped();}
    }
    @Test public void emptyEightNativeStoresNeverImplyActorAdmissionOrWorkRetention()throws Exception {
        var all=empty();try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){assertEquals(0,value.recordCount);assertEquals(8,value.recordCounts.size());same(all,decoded(value));noAuthority(value);}
        var f=new NativeVaultProviderReferenceCensusTest.Fixture();try(var generation=f.old.observe()){
            var readers=new TreeMap<String,NativeProtectedNamespaceObservation.Store>();for(String name:all.keySet())readers.put(name,()->all.get(name));
            try(var namespaces=NativeProtectedNamespaceObservation.observe(readers)){denied(()->capture(f,generation,namespaces));}}
        f.old.wiped();
    }
    @Test public void allEightCountsRemainImmutableAndUnknownRowsAreNotSemanticAck()throws Exception {
        var all=empty();rows(all,"MemphisZooCustodialRetainedBatchV1").put("unknown-slot","original");
        try(var value=NativeRetainedNamespaceValues.capture(all,IDENTITY)){assertThrows(UnsupportedOperationException.class,()->value.recordCounts.put(WORK,0));assertEquals(1,value.recordCount);
            same(all,decoded(value));assertEquals(Integer.valueOf(1),value.recordCounts.get("MemphisZooCustodialRetainedBatchV1"));noAuthority(value);}
    }
}
