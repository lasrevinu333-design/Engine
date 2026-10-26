package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** Actual cached-observation owner/journal/grammar with synthetic credentials,
 * AES-GCM, preferences, durable-memory model and HTTP replies only. These tests
 * do NOT qualify Android Keystore/fsync, current SQL, TLS, phone or semantic ACK. */
public final class NativeRetainedObservedRecoveryTest {
    static final String[] STATES={"OUTCOME_UNKNOWN","REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION",
        "CHUNK_RETAINED_INCOMPLETE_VALUES","RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION"};
    interface Mutation { void run(JSONObject record,JSONObject evidence)throws Exception; }
    static void denied(NativeRetainedOwnerTest.Action action)throws Exception { NativeRetainedOwnerTest.denied(action); }
    static final class CountingCipher implements CredentialCipher {
        final NativeRetainedQueryTest.QueryCipher delegate;
        int encrypts;
        CountingCipher(NativeRetainedQueryTest.QueryCipher delegate){this.delegate=delegate;}
        public EncryptedSecret encrypt(char[] clear){throw new AssertionError("new key forbidden");}
        public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure {encrypts++;return delegate.encryptWithExistingKey(clear);}
        public char[] decrypt(EncryptedSecret value)throws VaultFailure {return delegate.decrypt(value);}
        public void destroyKey(){throw new AssertionError("key removal forbidden");}
    }
    static final class Fixture {
        final NativeRetainedQueryTest.Fixture f=new NativeRetainedQueryTest.Fixture();
        final CountingCipher cipher=new CountingCipher(f.cipher);
        Fixture()throws Exception {f.reads=new AndroidRetainedQueryStore(f.disk.preferences(),cipher).journal();}
        void observe(String state)throws Exception {f.state=state;try(var op=f.prepare()){f.send(op);}}
        void restart(){f.disk.restart();f.reads=new AndroidRetainedQueryStore(f.disk.preferences(),cipher).journal();
            f.old.engine=new VaultEngine(f.old.persistence,f.old.vaultCipher,f.old.enrollment,new FakeLegacySource(),new TestSealGenerator(),f.old.clock);}
        void repack(Mutation mutation)throws Exception {
            var current=f.reads.observe();JSONObject record=current.record(),evidence=current.evidence();
            mutation.run(record,evidence);record.put("readback_evidence",evidence);
            String text=record.toString();int count=(text.length()+NativeRetainedQueryJournal.PART_CHARACTERS-1)/NativeRetainedQueryJournal.PART_CHARACTERS;
            Map<String,Object> sealed=new HashMap<>();
            for(int i=0;i<count;i++){String key="part:"+i;sealed.put(key,protect(new JSONObject().put("id",key)
                .put("value",text.substring(i*NativeRetainedQueryJournal.PART_CHARACTERS,Math.min(text.length(),(i+1)*NativeRetainedQueryJournal.PART_CHARACTERS)))));}
            sealed.put("index",protect(new JSONObject().put("schema",NativeRetainedQueryJournal.SCHEMA).put("state",NativeRetainedQueryJournal.OBSERVED)
                .put("parts",count).put("characters",text.length()).put("record_sha256",NativeRetainedAttempt.hash(text.getBytes(StandardCharsets.UTF_8)))));
            f.disk.memory=sealed;f.disk.durable=new HashMap<>(sealed);
        }
        String protect(JSONObject value)throws Exception {char[] clear=value.toString().toCharArray();try{var encrypted=cipher.encryptWithExistingKey(clear);
            return new JSONObject().put("ciphertext",encrypted.ciphertext).put("iv",encrypted.iv).toString();}finally{Arrays.fill(clear,'\0');}}
        NativeRetainedQueryJournal.RecoveredObservation recover()throws Exception {try(var op=f.prepare()){return f.old.engine.recoverObservedNativeRetainedQuery(op);}}
        void wiped(){f.old.wiped();assertEquals(0,f.cipher.creates);assertEquals(0,f.cipher.destroys);}
    }
    static void cachedOnly(NativeRetainedQueryJournal.RecoveredObservation value)throws Exception {
        assertFalse(value.currentServerReadback);assertFalse(value.freshQueryPerformed);assertFalse(value.resendAllowed);
        assertFalse(value.workAccepted);assertFalse(value.inventoryAcknowledged);assertFalse(value.keyRemovalAllowed);
        JSONObject m=value.metadata();assertEquals("custodial.native-retained-cached-observation.v1",m.getString("schema"));
        assertEquals("AUTHENTICATED_LOCAL_QUERY_JOURNAL",m.getString("proof_source"));
        for(String field:new String[]{"current_server_readback","fresh_query_performed","request_renewed","write_performed",
            "automatic_acceptance","inventory_acknowledged","work_accepted","new_work_allowed","phone_released","key_removal","resend_allowed","absence_proves_no_late_commit"})assertEquals(false,m.get(field));
        assertEquals("UNKNOWN",m.getString("native_semantic_inventory_state"));assertEquals("UNKNOWN",m.getString("browser_inventory_state"));
        for(String field:new String[]{"body_base64","signed_wire_base64","native_request_attestation","chunk_base64","credential","token"})assertFalse(m.has(field));
    }
    @Test public void fourObservedStatusesRemainCachedAndCannotBeAbsenceWorkOrKeyProof()throws Exception {
        for(String state:STATES){var x=new Fixture();x.observe(state);var writes=new HashMap<>(x.f.old.journalDisk.durable);var work=new HashMap<>(x.f.old.workDisk.durable);
            var query=new HashMap<>(x.f.disk.durable);int encrypted=x.cipher.encrypts,opened=x.f.old.opened,commits=x.f.disk.commits;
            x.f.old.clock.now+=86400000;x.restart();var result=x.recover();cachedOnly(result);assertEquals(state,result.status);
            Object retained=result.metadata().get("record_values_retained");assertEquals(state.equals("OUTCOME_UNKNOWN")?JSONObject.NULL:state.equals(STATES[3]),retained);
            assertEquals(query,x.f.disk.durable);assertEquals(writes,x.f.old.journalDisk.durable);assertEquals(work,x.f.old.workDisk.durable);
            assertEquals(encrypted,x.cipher.encrypts);assertEquals(opened,x.f.old.opened);assertEquals(commits+1,x.f.disk.commits);assertEquals(1,x.f.queryIds);x.wiped();}
    }
    @Test public void restartedOwnerKeepsOriginalQueryAndTargetNonceTimestampBody()throws Exception {
        var x=new Fixture();x.observe(STATES[3]);JSONObject before=x.f.reads.observe().record();x.restart();
        try(var op=x.f.prepare()){var cached=x.f.old.engine.recoverObservedNativeRetainedQuery(op);cachedOnly(cached);
            assertEquals(before.getString("native_request_id"),cached.queryRequestId);assertEquals(op.targetRequestId(),cached.targetRequestId);
            assertTrue(ProviderWireJson.same(before,x.f.reads.observe().record()));denied(()->x.f.send(op));}
        assertEquals(1,x.f.queryIds);assertEquals(2,x.f.old.opened);x.wiped();
    }
    @Test public void ambiguousObservationCommitRequiresTrueExactCiphertextRecommit()throws Exception {
        var x=new Fixture();x.f.state=STATES[2];try(var op=x.f.prepare()){x.f.change=d->x.f.disk.memoryOnly=true;denied(()->x.f.send(op));}
        var memory=new HashMap<>(x.f.disk.memory);var disk=new HashMap<>(x.f.disk.durable);int encrypted=x.cipher.encrypts;
        assertEquals(NativeRetainedQueryJournal.OBSERVED,x.f.reads.observe().state);denied(x::recover);assertEquals(disk,x.f.disk.durable);
        x.f.disk.memoryOnly=false;cachedOnly(x.recover());assertEquals(memory,x.f.disk.durable);assertEquals(encrypted,x.cipher.encrypts);assertEquals(1,x.f.queryIds);x.wiped();
    }
    @Test public void falseCommitOrChangedWholeReadbackCannotReturnCachedResult()throws Exception {
        for(boolean corrupted:new boolean[]{false,true}){var x=new Fixture();x.observe(STATES[1]);var disk=new HashMap<>(x.f.disk.durable);
            if(corrupted)x.f.disk.corruptReadback=true;else x.f.disk.fail=true;denied(x::recover);
            if(!corrupted)assertEquals(disk,x.f.disk.durable);assertEquals(2,x.f.old.opened);x.wiped();}
    }
    @Test public void preparedAndUnknownQueriesDoNotPretendToHaveObservedResults()throws Exception {
        for(boolean unknown:new boolean[]{false,true}){var x=new Fixture();try(var op=x.f.prepare()){if(unknown){x.f.old.loseReply=true;denied(()->x.f.send(op));}
                var before=new HashMap<>(x.f.disk.durable);int commits=x.f.disk.commits;denied(()->x.f.old.engine.recoverObservedNativeRetainedQuery(op));
                assertEquals(before,x.f.disk.durable);assertEquals(commits,x.f.disk.commits);}x.wiped();}
    }
    @Test public void missingQueryKeyAndUnavailableOriginalCredentialRemainPreserved()throws Exception {
        for(boolean queryKey:new boolean[]{false,true}){var x=new Fixture();x.observe(STATES[3]);var before=new HashMap<>(x.f.disk.durable);
            if(queryKey)x.f.cipher.missing=true;else x.f.old.vaultCipher.delegate.failDecrypts=1;
            denied(x::recover);assertEquals(before,x.f.disk.durable);assertEquals(2,x.f.old.opened);x.wiped();}
    }
    @Test public void authenticatedButForgedEvidenceBindingsAreRefused()throws Exception {
        for(String field:new String[]{"schema","query_native_request_id","query_body_sha256","operation_id","generation_id","native_request_id",
            "request_body_sha256","attestation_digest","wire_sha256"}){var x=new Fixture();x.observe(STATES[3]);x.repack((r,e)->e.put(field,field.endsWith("sha256")||field.endsWith("digest")?"f".repeat(64):"wrong-binding"));
            var before=new HashMap<>(x.f.disk.durable);denied(x::recover);assertEquals(before,x.f.disk.durable);x.wiped();}
    }
    @Test public void storedFlagsCannotGrantFreshnessWriterAcceptanceOrRetirement()throws Exception {
        for(String field:new String[]{"inventory_acknowledged","work_accepted","new_work_allowed","phone_released","key_removal","resend_allowed",
            "absence_proves_no_late_commit"}){var x=new Fixture();x.observe(STATES[3]);x.repack((r,e)->e.put(field,true));denied(x::recover);x.wiped();}
        for(String field:new String[]{"fresh_query_performed","credential","unknown"}){var x=new Fixture();x.observe(STATES[3]);x.repack((r,e)->e.put(field,"injected"));denied(x::recover);x.wiped();}
    }
    @Test public void storedStatusFlagsAndNullGrammarAreNotCoerced()throws Exception {
        for(int i=0;i<6;i++){var x=new Fixture();x.observe(i==4?STATES[0]:STATES[3]);final int v=i;x.repack((r,e)->{
                if(v==0)e.put("status","ACCEPTED");if(v==1)e.put("request_readback_confirmed","true");if(v==2)e.put("record_values_retained",false);
                if(v==3)e.put("value_chunk",JSONObject.NULL);if(v==4)e.put("value_chunk",new JSONObject());if(v==5)e.remove("key_removal");});denied(x::recover);x.wiped();}
    }
    @Test public void cachedChunkMetadataCannotChangeOriginalIndexBytesHashOrCompleteness()throws Exception {
        for(String field:new String[]{"value_bytes","chunk_index","chunk_count","value_sha256","chunk_sha256","stored_chunk_count","record_values_retained"}){
            var x=new Fixture();x.observe(STATES[3]);x.repack((r,e)->{var c=e.getJSONObject("value_chunk");c.put(field,field.endsWith("sha256")?"f".repeat(64):field.equals("record_values_retained")?"true":c.getLong(field)+1);});denied(x::recover);x.wiped();}
    }
    @Test public void originalQueryHMACAndTargetRecordCannotBeSubstitutedEvenInsideValidCipher()throws Exception {
        for(String field:new String[]{"native_request_attestation","target_record_sha256","request_body_sha256","attestation_digest","principal_digest"}){
            var x=new Fixture();x.observe(STATES[3]);x.repack((r,e)->r.put(field,"f".repeat(64)));denied(x::recover);assertEquals(1,x.f.queryIds);x.wiped();}
    }
    @Test public void missingCorruptForeignOrWrongAADQueryDataFailsClosed()throws Exception {
        for(int i=0;i<4;i++){var x=new Fixture();x.observe(STATES[1]);if(i==0)x.f.disk.memory.remove("index");if(i==1)x.f.disk.memory.put("part:0","corrupt");
            if(i==2)x.f.disk.memory.put("foreign","original unknown data");if(i==3){var wrong=new AndroidRetainedAttemptStore(x.f.disk.preferences(),x.f.old.journalCipher).journal();denied(wrong::observe);}
            if(i!=3)denied(x::recover);assertEquals(2,x.f.old.opened);x.wiped();}
    }
    @Test public void foreignEngineOrClosedCapabilityCannotRecoverOrMutate()throws Exception {
        var x=new Fixture();x.observe(STATES[3]);var other=new NativeRetainedOwnerTest.Fixture();var before=new HashMap<>(x.f.disk.durable);
        try(var op=x.f.prepare()){denied(()->other.engine.recoverObservedNativeRetainedQuery(op));op.close();denied(()->x.f.old.engine.recoverObservedNativeRetainedQuery(op));}
        assertEquals(before,x.f.disk.durable);x.wiped();other.wiped();
    }
    @Test public void changedPrincipalAtSameRevisionAndChangedVaultRevisionAreRefused()throws Exception {
        for(boolean principal:new boolean[]{false,true}){var x=new Fixture();x.observe(STATES[3]);var p=x.f.old.independentReader();
            try(var op=x.f.prepare()){var before=new HashMap<>(x.f.disk.durable);if(principal)p.value=new JSONObject(p.value).put("assignment_epoch",8).toString();else x.f.old.bumpVault();
                denied(()->x.f.old.engine.recoverObservedNativeRetainedQuery(op));assertEquals(before,x.f.disk.durable);}x.wiped();}
    }
    @Test public void changedFrozenWorkOrOriginalWriteJournalRefusesBeforeRecommit()throws Exception {
        for(boolean work:new boolean[]{false,true}){var x=new Fixture();x.observe(STATES[3]);try(var op=x.f.prepare()){
                int before=x.f.disk.commits;if(work)x.f.old.workDisk.memory.put("unknown-original-work","changed");else x.f.old.journalDisk.memory.put("foreign","changed");
                denied(()->x.f.old.engine.recoverObservedNativeRetainedQuery(op));assertEquals(before,x.f.disk.commits);}x.wiped();}
    }
    @Test public void concurrentOriginalChangeAfterTrueQueryCommitCannotReturnResult()throws Exception {
        for(boolean work:new boolean[]{false,true}){var x=new Fixture();x.observe(STATES[3]);var backing=new AndroidRetainedQueryStore(x.f.disk.preferences(),x.cipher);
            x.f.reads=new NativeRetainedQueryJournal(new NativeRetainedQueryJournal.Backend(){
                public Map<String,?> readAll(){return backing.readAll();}
                public boolean compareAndCommit(Map<String,String> before,Map<String,String> next)throws Exception {
                    boolean committed=backing.compareAndCommit(before,next);if(work)x.f.old.workDisk.memory.put("unknown-original-work","changed during commit");else x.f.old.journalDisk.memory.put("foreign","changed during commit");return committed;}
            },x.cipher,new Object());
            try(var op=x.f.prepare()){denied(()->x.f.old.engine.recoverObservedNativeRetainedQuery(op));}assertEquals(2,x.f.old.opened);x.wiped();}
    }
    @Test public void missingFreezeAndPendingProbeNeverBecomeEmptyAcceptedInventory()throws Exception {
        for(boolean probe:new boolean[]{false,true}){var x=new Fixture();x.observe(STATES[3]);if(probe)x.f.old.workDisk.memory.put(NativeRetainedWorkCapture.PROBE,"pending");else x.f.old.workDisk.memory.remove(NativeRetainedWorkCapture.FENCE);
            var before=new HashMap<>(x.f.disk.durable);denied(x::recover);assertEquals(before,x.f.disk.durable);assertEquals(1,x.f.queryIds);x.wiped();}
    }
}
