package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONObject;
import org.junit.Test;

/** NEW journal census and captured-read interfaces only. Reused old factories
 * are not old suite reruns. Enrollment, AES, admission, preferences, disk,
 * clock and query responses are synthetic. No real HTTP/SQL/browser/phone. */
public final class NativeRetainedNamespaceCensusTest {
    static final class Fixture {
        final NativeGenerationBoundBatchTest.Fixture f;
        final Map<String,Map<String,Object>> unknown=new TreeMap<>();
        final CountingCipher queryCipher;
        Fixture() throws Exception {this(new NativeGenerationBoundBatchTest.Fixture());}
        Fixture(NativeGenerationBoundBatchTest.Fixture original) throws Exception {
            f=java.util.Objects.requireNonNull(original);queryCipher=new CountingCipher(f.batch.queryZeroCipher);
            f.batch.queryZero=new AndroidRetainedQueryStore(f.batch.queryZeroDisk.preferences(),queryCipher).journal();
            f.batch.journal=new AndroidRetainedBatchStore(f.batch.root.preferences(),f.batch.indexCipher,(query,index)->{
                String domain=AndroidRetainedBatchStore.AAD+":"+(query?"query:":"write:")+index;
                return f.batch.domains.computeIfAbsent(domain,NativeRetainedBatchOwnerTest.DomainCipher::new);
            },f.batch.old.journal,f.batch.queryZero).journal();
            for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())unknown.put(name,new HashMap<>());
            unknown.get("MemphisZooCustodialNativeVaultV2").put("vault","opaque original vault ciphertext");
            unknown.get("MemphisZooCustodialNativeVaultV1").put("legacy","opaque original legacy ciphertext");
            unknown.get("WSSecureStorageSharedPreferences").put("legacy-set",Set.of("opaque","original"));
        }
        void complete(String last) throws Exception {
            try(var generation=f.generation();var batch=f.prepare(generation)){
                for(int i=0;i<batch.chunkCount();i++){
                    f.batch.sendWrite(batch,i);f.batch.observe(batch,i,i==batch.chunkCount()-1?last:"CHUNK_RETAINED_INCOMPLETE_VALUES");
                }
            }
        }
        Map<String,?> raw(String name) {
            if(NativeRetainedNamespaceCensus.WORK.equals(name))return f.batch.old.workDisk.memory;
            if(NativeRetainedNamespaceCensus.WRITE.equals(name))return f.batch.old.journalDisk.memory;
            if(NativeRetainedNamespaceCensus.QUERY.equals(name))return f.batch.queryZeroDisk.memory;
            if(NativeRetainedNamespaceCensus.BATCH.equals(name))return f.batch.root.memory;
            if("MemphisZooCustodialNativeProviderV1".equals(name))return f.store.memory.raw;
            return unknown.get(name);
        }
        NativeProtectedNamespaceObservation observe() throws Exception {
            Map<String,NativeProtectedNamespaceObservation.Store> readers=new TreeMap<>();
            for(String name:unknown.keySet())readers.put(name,()->raw(name));
            return NativeProtectedNamespaceObservation.observe(readers);
        }
        NativeRetainedNamespaceCensus.Observation inspect() throws Exception {
            var stable=new Stable(this);
            try(var generation=f.generation();var namespaces=observe()){
                var result=f.batch.old.engine.inspectRetainedCapturedJournalCensus(generation,namespaces,f.batch.journal);
                stable.check();assertEquals(total(),result.recordCount);noAuthority(result);return result;
            }finally{f.preserved();}
        }
        int total(){return unknown.keySet().stream().mapToInt(n->raw(n).size()).sum();}
        void removeSlot(boolean query,int index){
            f.batch.root.memory.keySet().removeIf(k->k.startsWith((query?"query:":"write:")+index+":"));
        }
        void repackQueryZero(Change change) throws Exception {
            var observed=f.batch.queryZero.observe();var record=observed.record();var evidence=observed.evidence();
            change.run(record,evidence);record.put("readback_evidence",evidence);
            f.batch.queryZeroDisk.memory=pack(record,NativeRetainedQueryJournal.SCHEMA,NativeRetainedQueryJournal.OBSERVED,queryCipher);
        }
    }
    static final class CountingCipher implements CredentialCipher {
        final CredentialCipher delegate;final List<char[]> clearReads=new ArrayList<>();int encrypts;
        private int wipeCursor;
        CountingCipher(CredentialCipher delegate){this.delegate=delegate;}
        public EncryptedSecret encrypt(char[] clear){throw new AssertionError("new key forbidden");}
        public void destroyKey(){throw new AssertionError("key removal forbidden");}
        public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure{encrypts++;return delegate.encryptWithExistingKey(clear);}
        public char[] decrypt(EncryptedSecret value)throws VaultFailure{char[] clear=delegate.decrypt(value);clearReads.add(clear);wipeCursor=NativeRetainedOwnerTest.retireVerifiedZeroReads(clearReads,wipeCursor);return clear;}
        void wiped(){NativeRetainedOwnerTest.assertOutstandingReadsWiped(clearReads);}
    }
    interface Change {void run(JSONObject record,JSONObject evidence) throws Exception;}
    static Map<String,Object> pack(JSONObject record,String schema,String state,CredentialCipher cipher) throws Exception {
        String text=record.toString();int pieces=(text.length()+4095)/4096;Map<String,Object> result=new HashMap<>();
        for(int i=0;i<pieces;i++)result.put("part:"+i,protect(new JSONObject().put("id","part:"+i)
            .put("value",text.substring(i*4096,Math.min(text.length(),(i+1)*4096))),cipher));
        result.put("index",protect(new JSONObject().put("schema",schema).put("state",state).put("parts",pieces)
            .put("characters",text.length()).put("record_sha256",NativeRetainedAttempt.hash(text.getBytes(java.nio.charset.StandardCharsets.UTF_8))),cipher));
        return result;
    }
    static String protect(JSONObject value,CredentialCipher cipher) throws Exception {
        char[] clear=value.toString().toCharArray();
        try{var encrypted=cipher.encryptWithExistingKey(clear);return new JSONObject().put("ciphertext",encrypted.ciphertext).put("iv",encrypted.iv).toString();}
        finally{Arrays.fill(clear,'\0');}
    }
    static final class Stable {
        final Fixture owner;final Map<String,Map<String,?>> raw=new TreeMap<>();
        final int ids,opened,workCommits,writeCommits,queryCommits,batchCommits,providerCommits,indexEncrypts,queryEncrypts,writeEncrypts;
        final Map<String,Integer> domainEncrypts=new TreeMap<>();
        Stable(Fixture owner) {
            this.owner=owner;var f=owner.f;for(String name:owner.unknown.keySet())raw.put(name,new HashMap<>(owner.raw(name)));
            ids=f.batch.ids;opened=f.batch.old.opened;workCommits=f.batch.old.workDisk.commits;
            writeCommits=f.batch.old.journalDisk.commits;queryCommits=f.batch.queryZeroDisk.commits;batchCommits=f.batch.root.commits;
            providerCommits=f.store.memory.commits;indexEncrypts=f.batch.indexCipher.encrypts;queryEncrypts=owner.queryCipher.encrypts;
            writeEncrypts=f.batch.old.journalCipher.existing;for(var row:f.batch.domains.entrySet())domainEncrypts.put(row.getKey(),row.getValue().encrypts);
        }
        void check(){
            var f=owner.f;for(String name:raw.keySet())assertEquals(name,raw.get(name),owner.raw(name));
            assertEquals(ids,f.batch.ids);assertEquals(opened,f.batch.old.opened);assertEquals(workCommits,f.batch.old.workDisk.commits);
            assertEquals(writeCommits,f.batch.old.journalDisk.commits);assertEquals(queryCommits,f.batch.queryZeroDisk.commits);
            assertEquals(batchCommits,f.batch.root.commits);assertEquals(providerCommits,f.store.memory.commits);
            assertEquals(indexEncrypts,f.batch.indexCipher.encrypts);assertEquals(queryEncrypts,owner.queryCipher.encrypts);owner.queryCipher.wiped();
            assertEquals(writeEncrypts,f.batch.old.journalCipher.existing);
            for(var row:f.batch.domains.entrySet())assertEquals((int)domainEncrypts.getOrDefault(row.getKey(),0),row.getValue().encrypts);
        }
    }
    static void noAuthority(NativeRetainedNamespaceCensus.Observation value) throws Exception {
        assertFalse(value.completeNamespaceInventory);assertFalse(value.currentServerReadback);assertFalse(value.resendAllowed);
        assertFalse(value.workAccepted);assertFalse(value.inventoryAcknowledged);assertFalse(value.keyRemovalAllowed);assertFalse(value.phoneReleased);
        var json=value.json();assertEquals("UNKNOWN",json.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",json.get("browser_inventory_state"));
        assertEquals(8,json.getJSONArray("namespaces").length());assertEquals(value.recordCount,json.getJSONArray("records").length());
        for(String flag:new String[]{"all_writer_durable_freeze_or_ABA_guard","current_server_readback","clock_profile_qualified",
            "inventory_acknowledged","work_accepted","new_work_allowed","resend_allowed","absence_proves_no_late_commit","finalizer_allowed","key_removal","phone_released"})
            assertEquals(flag,false,json.get(flag));
        String text=json.toString();for(String forbidden:new String[]{"body_base64","signature","ciphertext","iv\":","opaque original","native_token","manifest_body"})
            assertFalse(forbidden,text.contains(forbidden));
    }
    static JSONObject chunk(NativeRetainedNamespaceCensus.Observation value,int index) throws Exception {return value.json().getJSONArray("chunks").getJSONObject(index);}
    static void denied(NativeOriginalGenerationObservationTest.Action action) throws Exception {NativeOriginalGenerationObservationTest.denied(action);}

    @Test public void allThreeOriginalChunksAndEightAllRowDomainsJoinReadOnlyWithoutRecommit() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");var value=x.inspect();
        assertEquals(3,value.chunkCount);assertEquals(3,value.originalWriteCount);assertEquals(3,value.originalQueryCount);
        assertEquals(3,value.cachedObservationCount);assertEquals(0,value.unresolvedChunkCount);
        for(int i=0;i<3;i++){assertTrue(chunk(value,i).getBoolean("original_write_hmac_validated"));assertTrue(chunk(value,i).getBoolean("original_target_query_hmac_validated"));}
    }
    @Test public void emptyRetainedStoresAndOpaqueOtherDomainsDoNotInventABatchOrAnACK() throws Exception {
        var x=new Fixture();var value=x.inspect();assertEquals(0,value.chunkCount);assertEquals(0,value.originalWriteCount);
        assertEquals("EMPTY_NO_BATCH_OWNER",value.json().get("batch_owner_state"));assertTrue(value.recordCount>0);
        assertFalse(value.json().getBoolean("all_fixed_chunks_have_original_cached_observations"));
    }
    @Test public void missingMiddleSlotsDoNotHideValidLaterOriginalChunkOrBackfillTheGap() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.removeSlot(false,1);x.removeSlot(true,1);
        var value=x.inspect();assertEquals(3,value.chunkCount);assertEquals(2,value.originalWriteCount);assertEquals(2,value.cachedObservationCount);
        assertEquals(1,value.unresolvedChunkCount);assertEquals("ORIGINAL_WRITE_MISSING_CACHED_OUTCOME_UNKNOWN",chunk(value,1).get("state"));
        assertTrue(chunk(value,2).getBoolean("cached_original_observation_validated"));
    }
    @Test public void corruptMiddleWriteIsUnresolvedButAllRawRowsAndLaterChunkRemainRepresented() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.f.batch.root.memory.put("write:1:part:0","original corrupt ciphertext");
        var value=x.inspect();assertEquals(3,value.chunkCount);assertEquals(2,value.originalWriteCount);assertEquals(1,value.unresolvedChunkCount);
        assertTrue(chunk(value,2).getBoolean("cached_original_observation_validated"));
    }
    @Test public void orphanQueryCannotBorrowTheAdjacentWriteOrCreateResendAuthority() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.removeSlot(false,1);
        var value=x.inspect();assertEquals("ORPHAN_QUERY_WITHOUT_ORIGINAL_WRITE_RETAINED",chunk(value,1).get("state"));
        assertFalse(chunk(value,1).getBoolean("original_target_query_hmac_validated"));assertEquals(1,value.unresolvedChunkCount);
    }
    @Test public void foreignAndFutureLayoutRowsRemainInAllRowCensusAndInvalidateOwnerJoin() throws Exception {
        for(String key:new String[]{"unknown-owner","write:3:index","query:0:index","write:01:index"}){
            var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.f.batch.root.memory.put(key,"preserved unknown");
            var value=x.inspect();assertEquals(0,value.chunkCount);assertEquals("BATCH_OWNER_UNRESOLVED_RETAINED",value.json().get("batch_owner_state"));
        }
    }
    @Test public void closedUnknownManifestFieldsAndWrongOriginalBindingCannotEnterTheJoin() throws Exception {
        for(String field:new String[]{"engine_revision","principal_digest","value_sha256","wire_sha256","unknown"}){
            var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");var manifest=x.f.batch.index();
            manifest.put(field,field.equals("engine_revision")?manifest.getLong(field)+1:"f".repeat(64));x.f.batch.replaceIndex(manifest);
            var value=x.inspect();assertEquals(0,value.chunkCount);assertEquals("BATCH_OWNER_UNRESOLVED_RETAINED",value.json().get("batch_owner_state"));
        }
    }
    @Test public void acceptedDifferentGenerationDoesNotRetargetTheOldManifestOrOriginalWrites() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.f.rotate();
        var value=x.inspect();assertEquals(0,value.chunkCount);assertEquals("BATCH_OWNER_UNRESOLVED_RETAINED",value.json().get("batch_owner_state"));
    }
    @Test public void invalidCachedTargetWitnessCannotEraseAValidOriginalWriteOrQuery() throws Exception {
        for(String field:new String[]{"query_body_sha256","request_body_sha256","wire_sha256","generation_id","work_accepted"}){
            var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
            x.repackQueryZero((record,evidence)->evidence.put(field,field.equals("work_accepted")?true:"f".repeat(64)));
            var value=x.inspect();assertEquals(3,value.originalWriteCount);assertEquals(3,value.originalQueryCount);
            assertEquals(2,value.cachedObservationCount);assertEquals(1,value.unresolvedChunkCount);
        }
    }
    @Test public void invalidOriginalQueryHmacIsNotBorrowedFromCachedReadbackMetadata() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.repackQueryZero((record,evidence)->record.put("body_sha256","f".repeat(64)));
        var value=x.inspect();assertTrue(chunk(value,0).getBoolean("original_write_hmac_validated"));
        assertFalse(chunk(value,0).getBoolean("original_target_query_hmac_validated"));assertEquals(1,value.unresolvedChunkCount);
    }
    @Test public void outcomeUnknownAndDigestOnlyCachedWitnessesNeverBecomeCurrentServerOrValueSemantics() throws Exception {
        for(String state:new String[]{"OUTCOME_UNKNOWN","REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION"}){
            var x=new Fixture();x.complete(state);var value=x.inspect();assertEquals(3,value.cachedObservationCount);
            assertEquals(state,chunk(value,2).get("cached_status"));assertEquals(state.equals("OUTCOME_UNKNOWN")?1:0,value.unresolvedChunkCount);
            assertFalse(chunk(value,2).getBoolean("current_server_readback"));assertEquals("UNKNOWN",value.json().get("native_semantic_inventory_state"));
        }
    }
    @Test public void originalStoredNonceTimestampAndBodyAreRetainedAcrossOldLocalClockAge() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.f.batch.old.clock.now+=86400000L;
        var value=x.inspect();assertEquals(3,value.cachedObservationCount);assertFalse(value.json().getBoolean("clock_profile_qualified"));
    }
    @Test public void missingExistingKeyLeavesRowsAndIdentitiesUnresolvedWithoutCreatingAnyKey() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");x.f.batch.old.journalCipher.missing=true;
        var value=x.inspect();assertEquals(2,value.originalWriteCount);assertEquals(1,value.unresolvedChunkCount);
        assertEquals(0,x.f.batch.old.journalCipher.creates);assertEquals(0,x.f.batch.old.journalCipher.destroys);
    }
    @Test public void exactPrivateWorkCaptureRefusesDifferentReaderEvenWhenCountsMatch() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        Map<String,NativeProtectedNamespaceObservation.Store> readers=new TreeMap<>();
        for(String name:x.unknown.keySet())readers.put(name,()->{
            Map<String,Object> copy=new HashMap<>(x.raw(name));if(NativeRetainedNamespaceCensus.WORK.equals(name))copy.put("unknown-original-work","changed same-sized row");return copy;});
        try(var generation=x.f.generation();var namespaces=NativeProtectedNamespaceObservation.observe(readers)){
            var stable=new Stable(x);denied(()->x.f.batch.old.engine.inspectRetainedCapturedJournalCensus(generation,namespaces,x.f.batch.journal));stable.check();
        }x.f.preserved();
    }
    @Test public void staleClosedForeignAndChangedOriginalOwnerCapabilitiesFailBeforePublishing() throws Exception {
        for(int kind=0;kind<4;kind++){
            var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
            try(var generation=x.f.generation();var namespaces=x.observe()){
                if(kind==0)generation.close();if(kind==1)namespaces.close();if(kind==2)x.f.batch.old.bumpVault();
                if(kind==3)x.f.provider.captureToken("synthetic unrelated provider change");
                var stable=new Stable(x);denied(()->x.f.batch.old.engine.inspectRetainedCapturedJournalCensus(generation,namespaces,x.f.batch.journal));stable.check();
            }x.f.preserved();
        }
        var x=new Fixture();var other=new Fixture();
        try(var generation=other.f.generation();var namespaces=x.observe()){
            var stable=new Stable(x);denied(()->x.f.batch.old.engine.inspectRetainedCapturedJournalCensus(generation,namespaces,x.f.batch.journal));stable.check();
        }x.f.preserved();other.f.preserved();
    }
    @Test public void changedUnknownNamespaceAfterObservationIsNotFilteredOrSilentlyRecaptured() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        try(var generation=x.f.generation();var namespaces=x.observe()){
            x.unknown.get("WSSecureStorageSharedPreferences").put("unknown-new-row",17L);var stable=new Stable(x);
            denied(()->x.f.batch.old.engine.inspectRetainedCapturedJournalCensus(generation,namespaces,x.f.batch.journal));stable.check();
        }x.f.preserved();
    }
    @Test public void returnedDiagnosticCopiesCannotChangePrivateOriginalCensusOrGrantAuthority() throws Exception {
        var x=new Fixture();x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");var value=x.inspect();var json=value.json();
        json.put("key_removal",true);json.getJSONArray("records").remove(0);assertFalse(value.json().getBoolean("key_removal"));
        assertEquals(value.recordCount,value.json().getJSONArray("records").length());
    }
}
