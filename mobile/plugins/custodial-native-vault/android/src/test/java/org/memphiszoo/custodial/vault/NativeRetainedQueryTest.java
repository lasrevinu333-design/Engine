package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;
import org.junit.Test;

/** Actual new engine/query/strict reader/Android store/HTTPS source with ONLY
 * synthetic auth/key/durable disk/HttpsURLConnection and ledger-result fixtures.
 * Not live native storage, server RPC/SQL, collector, TLS or phone proof. */
public final class NativeRetainedQueryTest {
    interface Change {void apply(JSONObject data)throws Exception;}
    interface Wire {String apply(String data)throws Exception;}
    static void denied(NativeRetainedOwnerTest.Action action)throws Exception{NativeRetainedOwnerTest.denied(action);}
    static final class QueryCipher implements CredentialCipher {
        final SecretKeySpec key=new SecretKeySpec(new byte[32],"AES");boolean missing;int creates,destroys;
        public EncryptedSecret encrypt(char[] clear){creates++;throw new AssertionError("new key forbidden");}
        public void destroyKey(){destroys++;throw new AssertionError("key retirement forbidden");}
        public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure{
            if(missing)throw new VaultFailure("synthetic_missing_key");byte[] bytes=new String(clear).getBytes(StandardCharsets.UTF_8);
            try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key);c.updateAAD(AndroidRetainedQueryStore.AAD.getBytes(StandardCharsets.UTF_8));return new EncryptedSecret(Base64.getEncoder().encodeToString(c.doFinal(bytes)),Base64.getEncoder().encodeToString(c.getIV()));}
            catch(Exception error){throw new VaultFailure("synthetic_cipher_failure",error);}finally{Arrays.fill(bytes,(byte)0);}
        }
        public char[] decrypt(EncryptedSecret value)throws VaultFailure{
            if(missing)throw new VaultFailure("synthetic_missing_key");byte[] clear=null;
            try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Base64.getDecoder().decode(value.iv)));c.updateAAD(AndroidRetainedQueryStore.AAD.getBytes(StandardCharsets.UTF_8));clear=c.doFinal(Base64.getDecoder().decode(value.ciphertext));return new String(clear,StandardCharsets.UTF_8).toCharArray();}
            catch(Exception error){throw new VaultFailure("synthetic_cipher_failure",error);}finally{if(clear!=null)Arrays.fill(clear,(byte)0);}
        }
    }
    static final class Fixture {
        final NativeRetainedOwnerTest.Fixture old=new NativeRetainedOwnerTest.Fixture();
        final NativeRetainedAttemptTest.Disk disk=new NativeRetainedAttemptTest.Disk();final QueryCipher cipher=new QueryCipher();
        NativeRetainedQueryJournal reads=new AndroidRetainedQueryStore(disk.preferences(),cipher).journal();
        int queryIds;String state="OUTCOME_UNKNOWN";Change change=data->{};Wire wire=data->data;
        Fixture()throws Exception{try(var operation=old.prepare()){old.loseReply=true;denied(()->old.send(operation));}old.loseReply=false;}
        VaultEngine.NativeRetainedQueryOperation prepare()throws VaultFailure{return old.engine.prepareNativeRetainedQuery(old.work,old.principal,null,old.journal,reads,()->NativeRetainedOwnerTest.id(500+(++queryIds)));}
        JSONObject queryEnvelope()throws Exception{return ProviderWireJson.object(NativeRetainedAttempt.base64(reads.observe().record().getString("body_base64"),393216),393216);}
        JSONObject targetEnvelope()throws Exception{return ProviderWireJson.object(NativeRetainedAttempt.base64(old.journal.observe().record().getString("body_base64"),393216),393216);}
        JSONObject reply(String queryId)throws Exception{
            JSONObject q=queryEnvelope(),oldBody=targetEnvelope(),wire=ProviderWireJson.object(NativeRetainedAttempt.base64(oldBody.getString("signed_wire_base64"),262144),262144);
            JSONObject m=ProviderWireJson.object(wire.getString("manifest_body").getBytes(StandardCharsets.UTF_8),131072),c=m.getJSONObject("separation_context");
            JSONObject d=new JSONObject().put("schema","custodial.original-native-evidence-readback-result.v1").put("operation_id",q.getString("operation_id"))
                .put("query_native_request_id",queryId).put("native_request_id",q.getString("native_request_id")).put("request_body_sha256",q.getString("request_body_sha256"))
                .put("query_completed",true).put("write_performed",false).put("resend_allowed",false).put("absence_proves_no_late_commit",false)
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN").put("inventory_acknowledged",false)
                .put("automatic_acceptance",false).put("work_accepted",false).put("new_work_allowed",false).put("phone_released",false).put("key_removal",false)
                .put("status",state).put("requested_attempt_retained",state.equals("OUTCOME_UNKNOWN")?JSONObject.NULL:true)
                .put("request_readback_confirmed",!state.equals("OUTCOME_UNKNOWN")).put("record_values_retained",state.equals("OUTCOME_UNKNOWN")?JSONObject.NULL:false);
            if(!state.equals("OUTCOME_UNKNOWN")){
                JSONObject receipt=new JSONObject().put("schema","custodial.retained-original-native-evidence-receipt.v1").put("status","RETAINED_ONLY_PENDING_RECONCILIATION")
                    .put("operation_id",q.getString("operation_id")).put("generation_id",q.getString("generation_id"))
                    .put("wire_sha256",old.journal.observe().record().getString("wire_sha256"))
                    .put("wire_bytes",NativeRetainedAttempt.base64(oldBody.getString("signed_wire_base64"),262144).length)
                    .put("manifest_sha256",wire.getString("manifest_sha256")).put("raw_snapshot_sha256",m.getString("raw_snapshot_sha256"))
                    .put("record_count",m.get("record_count")).put("payload_coverage","MANIFEST_AND_RECORD_DIGESTS_ONLY").put("record_values_retained",false)
                    .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN").put("inventory_acknowledged",false)
                    .put("automatic_acceptance",false).put("work_accepted",false).put("new_work_allowed",false).put("phone_released",false)
                    .put("receipt_sha256","a".repeat(64)).put("retained_at","2026-09-27T08:00:01.123456Z");
                for(String field:new String[]{"separation_id","device_id","canonical_device_id","credential_id","employee_id","assignment_epoch","authority_revision","cutoff_at"})receipt.put(field,c.get(field));
                d.put("receipt",receipt).put("chunk_bytes_readback_confirmed",false);
                if(!state.equals("REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION")){
                    boolean complete=state.equals("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
                    int count=Integer.parseInt(oldBody.getString("chunk_count"));
                    // This fixture has one value chunk. Partial remains false
                    // even when all count slots exist, matching the source API.
                    JSONObject chunk=new JSONObject().put("value_bytes",Integer.parseInt(oldBody.getString("value_bytes")))
                        .put("value_sha256",oldBody.getString("value_sha256")).put("chunk_index",Integer.parseInt(oldBody.getString("chunk_index")))
                        .put("chunk_count",count).put("chunk_sha256",oldBody.getString("chunk_sha256"))
                        .put("stored_chunk_count",count).put("record_values_retained",complete);
                    d.put("value_chunk",chunk).put("chunk_bytes_readback_confirmed",true).put("record_values_retained",complete);
                }
            }
            change.apply(d);return new JSONObject().put("ok",true).put("data",d);
        }
        NativeRetainedReadbackEvidence send(VaultEngine.NativeRetainedQueryOperation operation)throws VaultFailure{
            old.onReply=()->old.connection.response=wire.apply(reply(operation.requestId()).toString()).getBytes(StandardCharsets.UTF_8);
            return old.engine.readNativeRetainedQuery(operation,old.http(),new NativeRetainedHttp.Attempt());
        }
        void preserved(Map<String,Object> writes,Map<String,Object> work){assertEquals(writes,old.journalDisk.durable);assertEquals(work,old.workDisk.durable);assertEquals(0,cipher.creates);assertEquals(0,cipher.destroys);old.wiped();}
    }
    @Test public void freshQueryAndMissingResultKeepOldAttemptImmutableAndUnknown()throws Exception{
        var f=new Fixture();var old=new HashMap<>(f.old.journalDisk.durable);var work=new HashMap<>(f.old.workDisk.durable);
        try(var op=f.prepare()){JSONObject q=f.queryEnvelope();assertEquals(7,q.length());assertNotEquals(op.requestId(),op.targetRequestId());assertEquals(op.targetRequestId(),q.getString("native_request_id"));
            var evidence=f.send(op);assertEquals("OUTCOME_UNKNOWN",evidence.status);assertFalse(evidence.requestReadbackConfirmed);assertFalse(evidence.resendAllowed);assertFalse(evidence.absenceProvesNoLateCommit);
            assertEquals(NativeRetainedQueryJournal.OBSERVED,f.reads.observe().state);assertEquals("OUTCOME_UNKNOWN",f.reads.observe().evidence().getString("status"));assertEquals(1,f.queryIds);
        }f.preserved(old,work);
    }
    @Test public void digestOnlyReadbackDoesNotClaimRawValuesOrWork()throws Exception{
        var f=new Fixture();f.state="REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION";try(var op=f.prepare()){var e=f.send(op);assertTrue(e.requestReadbackConfirmed);assertFalse(e.rawValuesRetained);assertFalse(e.workAccepted);assertFalse(e.keyRemovalAllowed);}f.old.wiped();
    }
    @Test public void incompleteChunkReadbackStaysDistinctFromCompleteArchive()throws Exception{
        var f=new Fixture();f.state="CHUNK_RETAINED_INCOMPLETE_VALUES";try(var op=f.prepare()){var e=f.send(op);assertTrue(e.requestReadbackConfirmed);assertFalse(e.rawValuesRetained);assertFalse(e.inventoryAcknowledged);assertEquals(NativeRetainedQueryJournal.OBSERVED,f.reads.observe().state);}f.old.wiped();
    }
    @Test public void completeRawArchiveStillCannotAcknowledgeSemanticsOrRemoveKey()throws Exception{
        var f=new Fixture();f.state="RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION";try(var op=f.prepare()){var e=f.send(op);assertTrue(e.rawValuesRetained);assertFalse(e.workAccepted);assertFalse(e.inventoryAcknowledged);assertFalse(e.keyRemovalAllowed);assertFalse(e.resendAllowed);}f.old.wiped();
    }
    @Test public void sameOldNonceIsRefusedBeforeAnyQueryWrite()throws Exception{
        var f=new Fixture();String target=f.old.journal.observe().record().getString("native_request_id");denied(()->f.old.engine.prepareNativeRetainedQuery(f.old.work,f.old.principal,null,f.old.journal,f.reads,()->target));assertTrue(f.disk.memory.isEmpty());assertEquals(1,f.old.opened);f.old.wiped();
    }
    @Test public void falsePreparationRecommitsExactQueryCipherWithoutFreshNonce()throws Exception{
        var f=new Fixture();f.disk.memoryOnly=true;denied(()->f.prepare());var volatileBytes=new HashMap<>(f.disk.memory);String nonce=f.reads.observe().record().getString("native_request_id");f.disk.memoryOnly=false;
        try(var op=f.prepare()){assertEquals(nonce,op.requestId());assertEquals(1,f.queryIds);assertEquals(volatileBytes,f.disk.durable);}f.old.wiped();
    }
    @Test public void missingOriginalWriteIsNotCallerSelectedTargetAuthority()throws Exception{
        var f=new Fixture();var empty=new NativeRetainedAttemptTest.Disk();var writes=new AndroidRetainedAttemptStore(empty.preferences(),f.old.journalCipher).journal();denied(()->f.old.engine.prepareNativeRetainedQuery(f.old.work,f.old.principal,null,writes,f.reads,()->NativeRetainedOwnerTest.id(700)));assertTrue(f.disk.memory.isEmpty());f.old.wiped();
    }
    @Test public void lostQueryReplyCannotBeAutomaticallyRetriedOrReNonceOldWrite()throws Exception{
        var f=new Fixture();try(var op=f.prepare()){f.old.loseReply=true;denied(()->f.send(op));assertEquals(NativeRetainedQueryJournal.UNKNOWN,f.reads.observe().state);}
        var data=new HashMap<>(f.disk.durable);f.old.loseReply=false;try(var restored=f.prepare()){denied(()->f.send(restored));assertEquals(1,f.queryIds);assertEquals(data,f.disk.durable);assertEquals(2,f.old.opened);}f.old.wiped();
    }
    @Test public void completedObservationCannotTriggerAnotherNetworkQuery()throws Exception{
        var f=new Fixture();try(var op=f.prepare()){f.send(op);}var observed=new HashMap<>(f.disk.durable);
        try(var same=f.prepare()){denied(()->f.send(same));assertEquals(1,f.queryIds);assertEquals(2,f.old.opened);assertEquals(observed,f.disk.durable);}f.old.wiped();
    }
    @Test public void staleFreshQueryAndFutureTimestampDoNotRenewThePreparedQuery()throws Exception{
        for(long age:new long[]{120001,-15001}){var f=new Fixture();try(var op=f.prepare()){f.old.clock.now+=age;denied(()->f.send(op));assertEquals(1,f.old.opened);assertEquals(1,f.queryIds);assertEquals(NativeRetainedQueryJournal.PREPARED,f.reads.observe().state);}f.old.wiped();}
    }
    @Test public void oldWriteMayBeOldWhileNewQueryMustBeFresh()throws Exception{
        var f=new Fixture();f.old.clock.now+=180000;try(var op=f.prepare()){var e=f.send(op);assertEquals("OUTCOME_UNKNOWN",e.status);assertEquals(2,f.old.opened);}f.old.wiped();
    }
    @Test public void wrongQueryTargetBodyOperationOrQueryIdIsRefused()throws Exception{
        for(String key:new String[]{"operation_id","query_native_request_id","native_request_id","request_body_sha256"}){var f=new Fixture();f.change=d->d.put(key,key.endsWith("sha256")?"f".repeat(64):NativeRetainedOwnerTest.id(799));try(var op=f.prepare()){denied(()->f.send(op));assertEquals(NativeRetainedQueryJournal.UNKNOWN,f.reads.observe().state);}f.old.wiped();}
    }
    @Test public void flagsCannotTurnReadbackIntoWriterWorkKeyOrResendAuthority()throws Exception{
        for(String field:new String[]{"write_performed","resend_allowed","absence_proves_no_late_commit","inventory_acknowledged","automatic_acceptance","work_accepted","new_work_allowed","phone_released","key_removal"}){var f=new Fixture();f.change=d->d.put(field,true);try(var op=f.prepare()){denied(()->f.send(op));}f.old.wiped();}
    }
    @Test public void missingResultCannotCarryTruthyOrFalseAbsenceProof()throws Exception{
        for(String field:new String[]{"requested_attempt_retained","record_values_retained","request_readback_confirmed"}){var f=new Fixture();f.change=d->d.put(field,true);try(var op=f.prepare()){denied(()->f.send(op));}f.old.wiped();}
    }
    @Test public void duplicateUnknownKeysWrongTypesOrBOMAreNotAccepted()throws Exception{
        for(int variant=0;variant<4;variant++){var f=new Fixture();final int v=variant;try(var op=f.prepare()){
            f.old.onReply=()->{String body=f.reply(op.requestId()).toString();if(v==0)body=body.replace("\"ok\":true","\"ok\":true,\"ok\":true");if(v==1)body=body.substring(0,body.length()-1)+",\"unknown\":true}";if(v==2)body=body.replace("\"query_completed\":true","\"query_completed\":\"true\"");if(v==3)body="\ufeff"+body;f.old.connection.response=body.getBytes(StandardCharsets.UTF_8);};
            denied(()->f.old.engine.readNativeRetainedQuery(op,f.old.http(),new NativeRetainedHttp.Attempt()));}f.old.wiped();}
    }
    @Test public void parentReceiptAlwaysRemainsDigestOnlyAndBoundToOriginalContext()throws Exception{
        for(String field:new String[]{"record_values_retained","credential_id","wire_sha256","manifest_sha256","raw_snapshot_sha256","assignment_epoch","cutoff_at"}){var f=new Fixture();f.state="REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION";f.change=d->{var p=d.getJSONObject("receipt");p.put(field,field.equals("record_values_retained")?true:field.equals("assignment_epoch")?8:field.equals("cutoff_at")?"2026-09-27T08:00:00.123457Z":field.endsWith("sha256")?"f".repeat(64):NativeRetainedOwnerTest.id(999));};try(var op=f.prepare()){denied(()->f.send(op));}f.old.wiped();}
    }
    @Test public void chunkMetadataMustMatchOriginalValueAndExactChunk()throws Exception{
        for(String field:new String[]{"value_bytes","chunk_index","chunk_count","value_sha256","chunk_sha256","stored_chunk_count"}){var f=new Fixture();f.state="RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION";f.change=d->{var c=d.getJSONObject("value_chunk");c.put(field,field.endsWith("sha256")?"f".repeat(64):c.getLong(field)+1);};try(var op=f.prepare()){denied(()->f.send(op));}f.old.wiped();}
    }
    @Test public void archiveFlagStatusAndIntegerTypesCannotBeCoerced()throws Exception{
        for(int v=0;v<3;v++){var f=new Fixture();f.state="RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION";final int variant=v;f.change=d->{if(variant==0)d.put("record_values_retained",false);else if(variant==2)d.getJSONObject("value_chunk").put("record_values_retained","true");};
            if(v==1)f.wire=body->body.replaceFirst("\\\"value_bytes\\\":([0-9]+)","\"value_bytes\":$1.0");
            try(var op=f.prepare()){denied(()->f.send(op));}f.old.wiped();}
    }
    @Test public void noRawChunkOrPrivateHeadersCanBeInjectedIntoPublicMetadataGrammar()throws Exception{
        var f=new Fixture();f.state="RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION";f.change=d->d.getJSONObject("value_chunk").put("chunk_base64","eA==");try(var op=f.prepare()){denied(()->f.send(op));}f.old.wiped();
    }
    @Test public void settlementCommitFailureReturnsNoAcceptedEvidence()throws Exception{
        var f=new Fixture();try(var op=f.prepare()){f.change=d->f.disk.memoryOnly=true;denied(()->f.send(op));assertEquals(NativeRetainedQueryJournal.OBSERVED,f.reads.observe().state);f.disk.restart();assertEquals(NativeRetainedQueryJournal.UNKNOWN,f.reads.observe().state);}f.old.wiped();
    }
    @Test public void originalWorkAndWriteJournalChangesDuringQueryRefuseReadback()throws Exception{
        for(boolean work:new boolean[]{true,false}){var f=new Fixture();try(var op=f.prepare()){f.change=d->{if(work)f.old.workDisk.memory.put("unknown-original-work","changed");else f.old.journalDisk.memory.put("foreign","changed");};denied(()->f.send(op));assertEquals(NativeRetainedQueryJournal.UNKNOWN,f.reads.observe().state);}f.old.wiped();}
    }
    @Test public void foreignOwnerAndClosedReadCapabilityCannotOpenNetwork()throws Exception{
        var f=new Fixture();var other=new NativeRetainedOwnerTest.Fixture();try(var op=f.prepare()){denied(()->other.engine.readNativeRetainedQuery(op,f.old.http(),new NativeRetainedHttp.Attempt()));op.close();denied(()->f.send(op));assertEquals(1,f.old.opened);}f.old.wiped();other.wiped();
    }
    @Test public void separateAADAndTypeCannotTurnQueryIntoWriteJournalData()throws Exception{
        var f=new Fixture();try(var op=f.prepare()){var wrong=new AndroidRetainedAttemptStore(f.disk.preferences(),f.old.journalCipher).journal();denied(()->wrong.observe());
            assertNotEquals(AndroidRetainedAttemptStore.PREFERENCES,AndroidRetainedQueryStore.PREFERENCES);assertNotEquals(AndroidRetainedAttemptStore.AAD,AndroidRetainedQueryStore.AAD);assertEquals(NativeRetainedQueryJournal.PREPARED,f.reads.observe().state);}f.old.wiped();
    }
    @Test public void dateBoundsAndUnknownReceiptFieldsDoNotAcquireAuthority()throws Exception{
        for(String time:new String[]{"2026-02-30T08:00:00.123456Z","2026-09-27T07:59:59.123456Z","2026-09-27T08:00:01.123Z"}){var f=new Fixture();f.state="REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION";f.change=d->d.getJSONObject("receipt").put("retained_at",time);try(var op=f.prepare()){denied(()->f.send(op));}f.old.wiped();}
    }
}
