package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** Exact actual journal retention logic; synthetic authenticated-response owner
 * DATA fixture only. No TLS, Android OS, document or receipt qualification. */
public final class NativeRecurringOriginalViewTest {
    private static final String INTENT="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    private static final class Fixture {
        final NativeRecurringTargetJournalTest.Store store=new NativeRecurringTargetJournalTest.Store();
        final NativeRecurringTargetJournal journal=new NativeRecurringTargetJournal(store);
        final NativeProviderPrincipal principal=NativeRecurringTargetJournalTest.principal();
        final AuthorizedRequest request=new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]);
        Fixture()throws Exception{}
        AuthorizedResponse response(String view)throws Exception {
            JSONObject envelope=new JSONObject(NativeRecurringTargetJournalTest.SYNTHETIC_TARGET_RESPONSE);
            JSONObject delivery=envelope.getJSONObject("data").getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
            String digest=NativeProviderPrincipal.hash(view);target.put("viewDigest",digest);
            java.util.List<String> keys=new java.util.ArrayList<>();target.keys().forEachRemaining(keys::add);
            keys.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
            StringBuilder pg=new StringBuilder("{");for(String key:keys){if(pg.length()>1)pg.append(", ");pg.append(JSONObject.quote(key)).append(": ");Object v=target.get(key);pg.append(v instanceof String?JSONObject.quote((String)v):v.toString());}pg.append('}');
            delivery.put("viewJsonText",view).put("viewDigest",digest).put("targetDigest",NativeProviderPrincipal.hash(pg.toString()));
            return new AuthorizedResponse(200,Map.of(),envelope.toString().replace(String.valueOf((char)0xd800),"\\ud800").getBytes(StandardCharsets.UTF_8));
        }
        void capture(AuthorizedResponse response)throws Exception {
            journal.captureActualTarget(request,response,new NativeRecurringTargetJournal.ResponseOwner(){
                public NativeProviderPrincipal requireCurrent(){return principal;}
                public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure {if(r!=request||s!=response)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);}
            });
        }
        String targetKey(){return store.rows.keySet().stream().filter(k->k.startsWith(NativeRecurringTargetJournal.TARGET_PREFIX)).findFirst().orElse(null);}
        JSONObject descriptor()throws Exception{return new JSONObject(store.rows.get(targetKey())).getJSONObject("original_view");}
    }
    @Test public void exactUnicodeOriginalCrossingChunkBoundaryColdReadsAndRemainsNotReceipt()throws Exception {
        var f=new Fixture();String view="{\"text\":\""+"x".repeat(32757)+"🚧"+"y".repeat(32770)+"\"}";
        f.capture(f.response(view));JSONObject descriptor=f.descriptor();assertTrue(descriptor.getInt("chunk_count")>=3);
        byte[] actual=new NativeRecurringTargetJournal(f.store).readOriginalView(f.principal,INTENT,descriptor);
        try{assertArrayEquals(view.getBytes(StandardCharsets.UTF_8),actual);}finally{java.util.Arrays.fill(actual,(byte)0);}
        for(String row:f.store.rows.values()){JSONObject value=new JSONObject(row);assertFalse(value.getBoolean("receipt_eligible"));assertTrue(row.length()<NativeRecurringTargetJournal.MAX_RECORD);}
        Map<String,String> first=Map.copyOf(f.store.rows);f.capture(f.response(view));assertEquals(first,f.store.rows);
    }
    @Test public void missingCorruptReorderedAndWrongPrincipalChunksRefuseWithoutRepair()throws Exception {
        var f=new Fixture();f.capture(f.response("{\"text\":\""+"x".repeat(70000)+"\"}"));JSONObject descriptor=f.descriptor();Map<String,String> original=Map.copyOf(f.store.rows);
        String first=NativeRecurringTargetJournal.viewKey(f.principal,INTENT,0);String value=f.store.rows.remove(first);
        assertThrows(VaultFailure.class,()->f.journal.readOriginalView(f.principal,INTENT,descriptor));assertFalse(f.store.rows.containsKey(first));
        f.store.rows.put(first,new JSONObject(value).put("hex","00").toString());Map<String,String> corrupt=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.readOriginalView(f.principal,INTENT,descriptor));assertEquals(corrupt,f.store.rows);
        f.store.rows.put(first,new JSONObject(value).put("index",1).toString());assertThrows(VaultFailure.class,()->f.journal.readOriginalView(f.principal,INTENT,descriptor));
        f.store.rows.clear();f.store.rows.putAll(original);JSONObject q=f.principal.json();q.put("assignment_epoch",8);var foreign=NativeProviderPrincipal.fromNativeJournal(q);
        assertThrows(VaultFailure.class,()->f.journal.readOriginalView(foreign,INTENT,descriptor));assertEquals(original,f.store.rows);
    }
    @Test public void unknownChunkCommitRetainsPartialBytesNeverPublishesCompleteTarget()throws Exception {
        var f=new Fixture();f.store.throwAfterCommit=true;var response=f.response("{}");
        assertThrows(VaultFailure.class,()->f.capture(response));assertNull(f.targetKey());assertEquals(1,f.store.rows.size());
        String key=f.store.rows.keySet().iterator().next();assertTrue(key.startsWith(NativeRecurringTargetJournal.VIEW_PREFIX));
        JSONObject value=new JSONObject(f.store.rows.get(key));assertFalse(value.getBoolean("receipt_eligible"));assertEquals("7b7d",value.getString("hex"));
    }
    @Test public void partialFirstResponseCannotBeCompletedByLaterDifferentResponseWithSameView()throws Exception {
        var f=new Fixture();AuthorizedResponse first=f.response("{}");f.store.throwAfterCommit=true;
        assertThrows(VaultFailure.class,()->f.capture(first));assertNull(f.targetKey());
        Map<String,String> partial=Map.copyOf(f.store.rows);assertEquals(1,partial.size());
        JSONObject chunk=new JSONObject(partial.values().iterator().next());
        assertEquals(NativeRetainedAttempt.hash(first.body),chunk.getString("native_authorized_response_sha256"));
        // Different actual authenticated wire bytes, identical JSON/target/view.
        AuthorizedResponse later=new AuthorizedResponse(200,Map.of(),
            (" "+new String(first.body,StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8));
        assertNotEquals(NativeRetainedAttempt.hash(first.body),NativeRetainedAttempt.hash(later.body));
        f.store.throwAfterCommit=false;
        assertThrows(VaultFailure.class,()->f.capture(later));
        assertEquals(partial,f.store.rows);assertNull(f.targetKey());
    }
    @Test public void completeDescriptorAndChunksRemainBoundToFirstAuthorizedResponse()throws Exception {
        var f=new Fixture();AuthorizedResponse first=f.response("{}");f.capture(first);
        JSONObject descriptor=f.descriptor();String firstSha=NativeRetainedAttempt.hash(first.body);
        assertEquals(firstSha,descriptor.getString("native_authorized_response_sha256"));
        for(var entry:f.store.rows.entrySet())if(entry.getKey().startsWith(NativeRecurringTargetJournal.VIEW_PREFIX))
            assertEquals(firstSha,new JSONObject(entry.getValue()).getString("native_authorized_response_sha256"));
        Map<String,String> retained=Map.copyOf(f.store.rows);
        JSONObject wrong=new JSONObject(descriptor.toString()).put("native_authorized_response_sha256","0".repeat(64));
        assertThrows(VaultFailure.class,()->f.journal.readOriginalView(f.principal,INTENT,wrong));
        assertEquals(retained,f.store.rows);
        String key=f.targetKey();f.store.rows.put(key,new JSONObject(f.store.rows.get(key))
            .put("native_authorized_response_sha256","0".repeat(64)).toString());
        Map<String,String> corrupt=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.capture(first));assertEquals(corrupt,f.store.rows);
    }
    @Test public void laterResponseNeverUpgradesLegacyOriginalWithoutItsOriginalView()throws Exception {
        var f=new Fixture();f.capture(f.response("{}"));String key=f.targetKey();JSONObject legacy=new JSONObject(f.store.rows.get(key));
        legacy.put("schema","custodial.native-recurring-authenticated-target-data.v1").put("original_view_bytes_retained",false);legacy.remove("original_view");
        f.store.rows.clear();f.store.rows.put(key,legacy.toString());Map<String,String> prior=Map.copyOf(f.store.rows);
        f.capture(f.response("{}"));assertEquals(prior,f.store.rows);assertFalse(new JSONObject(f.store.rows.get(key)).getBoolean("original_view_bytes_retained"));
    }
    @Test public void overboundOrLossyOriginalStringRefusesBeforeAnyChunkWrite()throws Exception {
        var f=new Fixture();var huge=f.response("x".repeat(4*1024*1024+1));
        assertThrows(VaultFailure.class,()->f.capture(huge));assertTrue(f.store.rows.isEmpty());
        // A lone UTF-16 surrogate cannot be claimed as exact retained UTF-8.
        var lossy=f.response("\ud800");assertThrows(VaultFailure.class,()->f.capture(lossy));assertTrue(f.store.rows.isEmpty());
    }
    @Test public void malformedDescriptorBoundsAndHashCannotAllocateOrAdoptForeignData()throws Exception {
        var f=new Fixture();f.capture(f.response("{}"));JSONObject descriptor=f.descriptor();Map<String,String> before=Map.copyOf(f.store.rows);
        for(Object length:new Object[]{-1,9007199254740991L,1.5,"2"}){
            JSONObject wrong=new JSONObject(descriptor.toString()).put("byte_count",length);
            assertThrows(VaultFailure.class,()->f.journal.readOriginalView(f.principal,INTENT,wrong));
        }
        JSONObject wrongHash=new JSONObject(descriptor.toString()).put("sha256","0".repeat(64));
        assertThrows(VaultFailure.class,()->f.journal.readOriginalView(f.principal,INTENT,wrongHash));assertEquals(before,f.store.rows);
    }
    @Test public void snapshotCapacityExtensionIsOnlyBoundedDedicatedViewFamily()throws Exception {
        Map<String,Object> dedicated=new java.util.LinkedHashMap<>();
        for(int i=0;i<100;i++)dedicated.put(NativeRecurringTargetJournal.VIEW_PREFIX+String.format("%064x",i),"x".repeat(100000));
        assertEquals(100,NativeProtectedWorkSnapshot.capture(dedicated).recordCount);
        Map<String,Object> ordinary=new java.util.LinkedHashMap<>();for(int i=0;i<17;i++)ordinary.put("ordinary_"+i,"x".repeat(524288));
        assertThrows(VaultFailure.class,()->NativeProtectedWorkSnapshot.capture(ordinary));
        assertEquals(524288,NativeProtectedWorkSnapshot.retainedStringLimit("ordinary"));
        assertEquals(4*1024*1024,NativeProtectedWorkSnapshot.retainedStringLimit("authenticated_completion_receipt_sha256:"+"a".repeat(64)));
    }
    @Test public void dedicatedSnapshotWrongTypeCellOrCensusOverboundRefusesPreservingRaw()throws Exception {
        String key=NativeRecurringTargetJournal.VIEW_PREFIX+"a".repeat(64);
        Map<String,Object> raw=new java.util.LinkedHashMap<>();raw.put(key,Long.valueOf(3));
        assertThrows(VaultFailure.class,()->NativeProtectedWorkSnapshot.capture(raw));assertEquals(Long.valueOf(3),raw.get(key));
        raw.put(key,"x".repeat(131073));assertThrows(VaultFailure.class,()->NativeProtectedWorkSnapshot.capture(raw));assertEquals(131073,((String)raw.get(key)).length());
        raw.clear();for(int i=0;i<257;i++)raw.put(NativeRecurringTargetJournal.VIEW_PREFIX+String.format("%064x",i),"");
        Map<String,Object> before=Map.copyOf(raw);assertThrows(VaultFailure.class,()->NativeProtectedWorkSnapshot.capture(raw));assertEquals(before,raw);
    }

}
