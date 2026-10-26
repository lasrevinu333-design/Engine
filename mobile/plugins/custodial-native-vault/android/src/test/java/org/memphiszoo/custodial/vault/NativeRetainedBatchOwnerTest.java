package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;
import org.junit.Test;

/** NEW actual batch owner/Android backing/attempt/query cases only. All keys,
 * prefs/durability, credentials and HTTPS replies are synthetic. Not fsync,
 * Android Keystore/process death, SQL/TLS, phone, semantics or a final audit. */
public final class NativeRetainedBatchOwnerTest {
    static String id(int n){return NativeRetainedOwnerTest.id(n);}
    static void denied(NativeRetainedOwnerTest.Action work)throws Exception{NativeRetainedOwnerTest.denied(work);}
    static final class DomainCipher implements CredentialCipher {
        final String aad;final SecretKeySpec key=new SecretKeySpec(new byte[32],"AES");
        final java.util.List<char[]> clearReads=new java.util.ArrayList<>();int encrypts;boolean missing;
        private int wipeCursor;
        DomainCipher(String aad){this.aad=aad;}
        public EncryptedSecret encrypt(char[] clear){throw new AssertionError("new shared key forbidden");}
        public void destroyKey(){throw new AssertionError("shared key retirement forbidden");}
        public EncryptedSecret encryptWithExistingKey(char[] clear)throws VaultFailure{
            if(missing)throw new VaultFailure("synthetic_key_unavailable");byte[] bytes=new String(clear).getBytes(StandardCharsets.UTF_8);
            try{encrypts++;Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key);c.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
                return new EncryptedSecret(Base64.getEncoder().encodeToString(c.doFinal(bytes)),Base64.getEncoder().encodeToString(c.getIV()));}
            catch(Exception e){throw new VaultFailure("synthetic_cipher_failure",e);}finally{Arrays.fill(bytes,(byte)0);}
        }
        public char[] decrypt(EncryptedSecret encrypted)throws VaultFailure{
            if(missing)throw new VaultFailure("synthetic_key_unavailable");byte[] bytes=null;
            try{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Base64.getDecoder().decode(encrypted.iv)));c.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
                bytes=c.doFinal(Base64.getDecoder().decode(encrypted.ciphertext));char[] clear=new String(bytes,StandardCharsets.UTF_8).toCharArray();clearReads.add(clear);
                wipeCursor=NativeRetainedOwnerTest.retireVerifiedZeroReads(clearReads,wipeCursor);return clear;}
            catch(Exception e){throw new VaultFailure("synthetic_cipher_failure",e);}finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);}
        }
        void wiped(){NativeRetainedOwnerTest.assertOutstandingReadsWiped(clearReads);}
    }
    static final class Fixture {
        final NativeRetainedOwnerTest.Fixture old;
        final NativeRetainedAttemptTest.Disk root=new NativeRetainedAttemptTest.Disk(),queryZeroDisk=new NativeRetainedAttemptTest.Disk();
        final NativeRetainedQueryTest.QueryCipher queryZeroCipher=new NativeRetainedQueryTest.QueryCipher();
        final DomainCipher indexCipher=new DomainCipher(AndroidRetainedBatchStore.AAD);
        final Map<String,DomainCipher> domains=new HashMap<>();NativeRetainedQueryJournal queryZero;
        NativeRetainedBatchJournal journal;int ids;Map<String,Object> frozen;
        Fixture()throws Exception{
            old=new NativeRetainedOwnerTest.Fixture();
            old.workDisk.memory.remove(NativeRetainedWorkCapture.FENCE);old.workDisk.memory.put("large-original-opaque","x".repeat(15000));
            var principal=NativeProviderPrincipal.fromNativeJournal(old.principal.readFor(old.engine.getState()));
            var context=NativeSeparationContext.fromAuthenticatedResponse(NativeSeparationContextTest.request(),NativeSeparationContextTest.response(
                NativeSeparationContextTest.envelope(NativeSeparationContextTest.data().put("credential_id",old.engine.getState().get("active_credential_id")))),principal);
            var raw=old.work.separationRawSnapshot();var proof=old.engine.attestNativeSeparationSnapshot(context,NativeProtectedWorkSnapshot.capture(raw),old.principal,null);
            old.work.freezeSeparationSnapshot(raw,proof);frozen=new HashMap<>(old.workDisk.durable);bind();
        }
        /** SAME active UNIT owner, before its first separation/capture. No
         * fence removal, row transplant or re-signing of an original. */
        Fixture(NativeRetainedOwnerTest.Fixture active)throws Exception{
            old=java.util.Objects.requireNonNull(active);
            assertFalse(old.workDisk.memory.containsKey(NativeRetainedWorkCapture.FENCE));
            old.work.requireWorkAdmission();
            var principal=NativeProviderPrincipal.fromNativeJournal(old.principal.readFor(old.engine.getState()));
            var context=NativeSeparationContext.fromAuthenticatedResponse(NativeSeparationContextTest.request(),NativeSeparationContextTest.response(
                NativeSeparationContextTest.envelope(NativeSeparationContextTest.data().put("credential_id",old.engine.getState().get("active_credential_id")))),principal);
            var raw=old.work.separationRawSnapshot();var proof=old.engine.attestNativeSeparationSnapshot(context,NativeProtectedWorkSnapshot.capture(raw),old.principal,null);
            old.work.freezeSeparationSnapshot(raw,proof);frozen=new HashMap<>(old.workDisk.durable);bind();
        }
        /** NEW Source/SQL join only: retain the SAME active native owner and
         * the typed result of its normal authenticated current-context read.
         * No supplied JSON, restored fence or synthetic context substitutes
         * for that owner. Existing fixture constructors stay unchanged. */
        Fixture(NativeRetainedOwnerTest.Fixture active,NativeSeparationContext actual)throws Exception{
            old=java.util.Objects.requireNonNull(active);java.util.Objects.requireNonNull(actual);
            assertFalse(old.workDisk.memory.containsKey(NativeRetainedWorkCapture.FENCE));
            old.work.requireWorkAdmission();
            var raw=old.work.separationRawSnapshot();
            var proof=old.engine.attestNativeSeparationSnapshot(actual,NativeProtectedWorkSnapshot.capture(raw),old.principal,null);
            old.work.freezeSeparationSnapshot(raw,proof);frozen=new HashMap<>(old.workDisk.durable);bind();
        }
        void bind(){queryZero=new AndroidRetainedQueryStore(queryZeroDisk.preferences(),queryZeroCipher).journal();
            journal=new AndroidRetainedBatchStore(root.preferences(),indexCipher,(query,index)->{
                String domain=AndroidRetainedBatchStore.AAD+":"+(query?"query:":"write:")+index;
                return domains.computeIfAbsent(domain,DomainCipher::new);},old.journal,queryZero).journal();}
        String nextId(){return id(1000+(++ids));}
        VaultEngine.NativeRetainedBatchOperation prepare()throws VaultFailure{return old.engine.prepareNativeRetainedBatch(old.work,old.principal,null,journal,this::nextId);}
        NativeRetainedAttemptJournal write(int index)throws Exception{return journal.writes(journal.observe(),index);}
        NativeRetainedQueryJournal read(int index)throws Exception{return journal.reads(journal.observe(),index);}
        VaultEngine.NativeRetainedOperation next(VaultEngine.NativeRetainedBatchOperation batch)throws VaultFailure{return old.engine.prepareNextNativeRetainedBatchChunk(batch,this::nextId);}
        void sendWrite(VaultEngine.NativeRetainedBatchOperation batch,int index)throws Exception{try(var operation=next(batch);var result=old.send(operation)){
            assertEquals(index,Integer.parseInt(body(write(index).observe().record()).getString("chunk_index")));assertFalse(result.workAccepted);}}
        static JSONObject body(JSONObject record)throws Exception{return ProviderWireJson.object(NativeRetainedAttempt.base64(record.getString("body_base64"),NativeRetainedAttempt.MAX_BODY),NativeRetainedAttempt.MAX_BODY);}
        JSONObject reply(int index,String queryId,String state)throws Exception{
            JSONObject query=body(read(index).observe().record()),target=body(write(index).observe().record());
            byte[] exactWire=NativeRetainedAttempt.base64(target.getString("signed_wire_base64"),262144);
            JSONObject wire=ProviderWireJson.object(exactWire,262144),manifest=ProviderWireJson.object(wire.getString("manifest_body").getBytes(StandardCharsets.UTF_8),131072),context=manifest.getJSONObject("separation_context");
            boolean unknown="OUTCOME_UNKNOWN".equals(state),digest="REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION".equals(state),complete="RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION".equals(state);
            JSONObject data=new JSONObject().put("schema","custodial.original-native-evidence-readback-result.v1").put("operation_id",query.getString("operation_id"))
                .put("query_native_request_id",queryId).put("native_request_id",query.getString("native_request_id")).put("request_body_sha256",query.getString("request_body_sha256"))
                .put("query_completed",true).put("write_performed",false).put("resend_allowed",false).put("absence_proves_no_late_commit",false)
                .put("native_semantic_inventory_state","UNKNOWN").put("browser_inventory_state","UNKNOWN").put("inventory_acknowledged",false)
                .put("automatic_acceptance",false).put("work_accepted",false).put("new_work_allowed",false).put("phone_released",false).put("key_removal",false)
                .put("status",state).put("requested_attempt_retained",unknown?JSONObject.NULL:true).put("request_readback_confirmed",!unknown).put("record_values_retained",unknown?JSONObject.NULL:complete);
            if(!unknown){JSONObject receipt=new JSONObject().put("schema","custodial.retained-original-native-evidence-receipt.v1").put("status","RETAINED_ONLY_PENDING_RECONCILIATION")
                .put("operation_id",query.getString("operation_id")).put("generation_id",query.getString("generation_id"))
                .put("wire_sha256",write(index).observe().record().getString("wire_sha256")).put("wire_bytes",exactWire.length)
                .put("manifest_sha256",wire.getString("manifest_sha256")).put("raw_snapshot_sha256",manifest.getString("raw_snapshot_sha256")).put("record_count",manifest.get("record_count"))
                .put("payload_coverage","MANIFEST_AND_RECORD_DIGESTS_ONLY").put("record_values_retained",false).put("native_semantic_inventory_state","UNKNOWN")
                .put("browser_inventory_state","UNKNOWN").put("inventory_acknowledged",false).put("automatic_acceptance",false).put("work_accepted",false)
                .put("new_work_allowed",false).put("phone_released",false).put("receipt_sha256","a".repeat(64)).put("retained_at","2026-09-27T08:00:01.123456Z");
                for(String field:new String[]{"separation_id","device_id","canonical_device_id","credential_id","employee_id","assignment_epoch","authority_revision","cutoff_at"})receipt.put(field,context.get(field));
                data.put("receipt",receipt).put("chunk_bytes_readback_confirmed",!digest);
                if(!digest){int count=Integer.parseInt(target.getString("chunk_count"));data.put("value_chunk",new JSONObject()
                    .put("value_bytes",Integer.parseInt(target.getString("value_bytes"))).put("value_sha256",target.getString("value_sha256"))
                    .put("chunk_index",index).put("chunk_count",count).put("chunk_sha256",target.getString("chunk_sha256"))
                    .put("stored_chunk_count",complete?count:index+1).put("record_values_retained",complete));}
            }
            Arrays.fill(exactWire,(byte)0);return new JSONObject().put("ok",true).put("data",data);
        }
        void observe(VaultEngine.NativeRetainedBatchOperation batch,int index,String state)throws Exception{
            try(var operation=old.engine.prepareNativeRetainedBatchQuery(batch,index,this::nextId)){
                old.onReply=()->old.connection.response=reply(index,operation.requestId(),state).toString().getBytes(StandardCharsets.UTF_8);
                old.engine.readNativeRetainedQuery(operation,old.http(),new NativeRetainedHttp.Attempt());
            }finally{old.onReply=()->{};}
        }
        void completeZero(VaultEngine.NativeRetainedBatchOperation batch)throws Exception{sendWrite(batch,0);observe(batch,0,"CHUNK_RETAINED_INCOMPLETE_VALUES");}
        void restart(){root.restart();queryZeroDisk.restart();old.journalDisk.restart();old.workDisk.memory=new HashMap<>(old.workDisk.durable);
            old.engine=new VaultEngine(old.persistence,old.vaultCipher,old.enrollment,new FakeLegacySource(),new TestSealGenerator(),old.clock);
            old.journal=new AndroidRetainedAttemptStore(old.journalDisk.preferences(),old.journalCipher).journal();bind();}
        void inject(int index,String operation,String generation)throws Exception{
            char[] credential=old.vaultCipher.decrypt(old.persistence.current().secret);
            try{var capture=NativeRetainedWorkCapture.capture(old.work);byte[] wire=capture.wire().toString().getBytes(StandardCharsets.UTF_8);
                try(var attempt=NativeRetainedAttempt.prepareChunk(wire,capture.values,NativeProviderPrincipal.fromNativeJournal(old.principal.readFor(old.engine.getState())),old.persistence.current().revision,credential,operation,generation,index,id(9000+index),old.clock.now)){
                    write(index).prepare(attempt);
                }finally{Arrays.fill(wire,(byte)0);}
            }finally{Arrays.fill(credential,'\0');}
        }
        JSONObject index()throws Exception{var envelope=new JSONObject((String)root.memory.get(NativeRetainedBatchJournal.INDEX));char[] clear=indexCipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
            try{return new JSONObject(new String(clear));}finally{Arrays.fill(clear,'\0');}}
        void replaceIndex(JSONObject value)throws Exception{char[] clear=value.toString().toCharArray();try{var sealed=indexCipher.encryptWithExistingKey(clear);root.memory.put(NativeRetainedBatchJournal.INDEX,new JSONObject().put("ciphertext",sealed.ciphertext).put("iv",sealed.iv).toString());}finally{Arrays.fill(clear,'\0');}}
        void preserved(){assertEquals(frozen,old.workDisk.durable);old.wiped();indexCipher.wiped();for(var cipher:domains.values())cipher.wiped();assertEquals(0,queryZeroCipher.creates);assertEquals(0,queryZeroCipher.destroys);}
    }
    static void diagnostic(VaultEngine.NativeRetainedBatchProgress result){assertFalse(result.currentServerReadback);assertFalse(result.resendAllowed);assertFalse(result.workAccepted);assertFalse(result.inventoryAcknowledged);assertFalse(result.keyRemovalAllowed);}

    @Test public void threeChunksShareSealedOperationGenerationButEveryWriteAndQueryHasItsOwnOriginalNonce()throws Exception{
        var f=new Fixture();var vault=f.old.persistence.current();java.util.Set<String> nonces=new java.util.HashSet<>();
        try(var batch=f.prepare()){assertEquals(3,batch.chunkCount());assertEquals(2,f.ids);var zeroBefore=(Map<String,Object>)null;
            for(int index=0;index<batch.chunkCount();index++){
                f.sendWrite(batch,index);var write=f.write(index).observe().record();assertEquals(batch.operationId(),write.getString("operation_id"));assertEquals(batch.generationId(),write.getString("generation_id"));assertTrue(nonces.add(write.getString("native_request_id")));
                f.observe(batch,index,index+1==batch.chunkCount()?"RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION":"CHUNK_RETAINED_INCOMPLETE_VALUES");assertTrue(nonces.add(f.read(index).observe().record().getString("native_request_id")));
                if(index==0)zeroBefore=new HashMap<>(f.old.journalDisk.durable);else assertEquals(zeroBefore,f.old.journalDisk.durable);
            }
            var progress=f.old.engine.inspectNativeRetainedBatch(batch);diagnostic(progress);assertEquals("CACHED_ALL_CHUNKS_OBSERVED",progress.state);assertEquals(3,progress.observedPrefix);assertEquals(6,nonces.size());assertEquals(8,f.ids);denied(()->f.next(batch));assertEquals(6,f.old.opened);
        }assertEquals(vault,f.old.persistence.current());f.preserved();
    }
    @Test public void existingChunkZeroIsAdoptedExactlyWithoutRemintingOriginalIdentity()throws Exception{
        var f=new Fixture();try(var original=f.old.prepare()){try(var reply=f.old.send(original)){} }
        var before=new HashMap<>(f.old.journalDisk.durable);var record=f.old.journal.observe().record();try(var batch=f.prepare()){
            assertEquals(record.getString("operation_id"),batch.operationId());assertEquals(record.getString("generation_id"),batch.generationId());assertEquals(0,f.ids);
            f.observe(batch,0,"CHUNK_RETAINED_INCOMPLETE_VALUES");try(var next=f.next(batch)){assertEquals(2,f.ids);assertEquals(batch.operationId(),f.write(1).observe().record().getString("operation_id"));}
        }assertEquals(before,f.old.journalDisk.durable);f.preserved();
    }
    @Test public void restartedCompleteBatchIsCachedOnlyAndDoesNotMintNonceEncryptOrOpenHTTP()throws Exception{
        var f=new Fixture();try(var batch=f.prepare()){for(int i=0;i<3;i++){f.sendWrite(batch,i);f.observe(batch,i,i==2?"RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION":"CHUNK_RETAINED_INCOMPLETE_VALUES");}}
        var root=new HashMap<>(f.root.durable);var zero=new HashMap<>(f.old.journalDisk.durable);var queries=new HashMap<>(f.queryZeroDisk.durable);int ids=f.ids,opened=f.old.opened,encrypts=f.indexCipher.encrypts;
        f.old.clock.now+=86400000;f.restart();try(var batch=f.prepare()){diagnostic(f.old.engine.inspectNativeRetainedBatch(batch));denied(()->f.next(batch));}
        assertEquals(root,f.root.durable);assertEquals(zero,f.old.journalDisk.durable);assertEquals(queries,f.queryZeroDisk.durable);assertEquals(ids,f.ids);assertEquals(opened,f.old.opened);assertEquals(encrypts,f.indexCipher.encrypts);f.preserved();
    }
    @Test public void falseBatchIndexCommitRequiresTrueExactCiphertextRecommitNotNewIdentity()throws Exception{
        var f=new Fixture();f.root.memoryOnly=true;denied(f::prepare);assertTrue(f.root.durable.isEmpty());var volatileCipher=new HashMap<>(f.root.memory);assertEquals(2,f.ids);
        f.root.memoryOnly=false;try(var batch=f.prepare()){assertEquals(volatileCipher,f.root.durable);assertEquals(2,f.ids);assertEquals("NEW_CHUNK_SLOT",f.old.engine.inspectNativeRetainedBatch(batch).state);}assertEquals(0,f.old.opened);f.preserved();
    }
    @Test public void falseLaterPreparationReusesOriginalCipherBodyAndNonce()throws Exception{
        var f=new Fixture();try(var batch=f.prepare()){f.completeZero(batch);f.root.memoryOnly=true;denied(()->f.next(batch));var volatileCipher=new HashMap<>(f.root.memory);var record=f.write(1).observe().record();int ids=f.ids;
            f.root.memoryOnly=false;try(var restored=f.next(batch)){assertEquals(record.getString("native_request_id"),restored.requestId());assertEquals(ids,f.ids);assertEquals(volatileCipher,f.root.durable);}
        }f.preserved();
    }
    @Test public void unknownLaterDispatchNeverResendsEvenIfQueryOrServerResultIsMissing()throws Exception{
        var f=new Fixture();try(var batch=f.prepare()){f.completeZero(batch);try(var write=f.next(batch)){f.old.loseReply=true;denied(()->f.old.send(write));f.old.loseReply=false;}
            int opened=f.old.opened,ids=f.ids;var before=new HashMap<>(f.root.durable);denied(()->f.next(batch));assertEquals(before,f.root.durable);assertEquals(opened,f.old.opened);assertEquals(ids,f.ids);
            f.observe(batch,1,"OUTCOME_UNKNOWN");var progress=f.old.engine.inspectNativeRetainedBatch(batch);diagnostic(progress);assertEquals("CACHED_READBACK_DOES_NOT_CONFIRM_CHUNK",progress.state);denied(()->f.next(batch));assertEquals(1,progress.observedPrefix);
        }f.preserved();
    }
    @Test public void digestOnlyChunkOrUnknownQueryCannotAuthorizeTheNextSlot()throws Exception{
        for(boolean lost:new boolean[]{false,true}){var f=new Fixture();try(var batch=f.prepare()){f.sendWrite(batch,0);
            if(lost)try(var query=f.old.engine.prepareNativeRetainedBatchQuery(batch,0,f::nextId)){f.old.loseReply=true;denied(()->f.old.engine.readNativeRetainedQuery(query,f.old.http(),new NativeRetainedHttp.Attempt()));f.old.loseReply=false;}
            else f.observe(batch,0,"REQUEST_RETAINED_ONLY_PENDING_RECONCILIATION");
            int before=f.ids,opened=f.old.opened;var progress=f.old.engine.inspectNativeRetainedBatch(batch);diagnostic(progress);assertEquals(0,progress.observedPrefix);denied(()->f.next(batch));assertEquals(before,f.ids);assertEquals(opened,f.old.opened);assertNull(f.write(1).observe());
        }f.preserved();}
    }
    @Test public void falseObservedQueryCommitCannotAdvanceWithoutARealRecommit()throws Exception{
        var f=new Fixture();try(var batch=f.prepare()){f.sendWrite(batch,0);
            try(var query=f.old.engine.prepareNativeRetainedBatchQuery(batch,0,f::nextId)){
                f.old.onReply=()->{f.old.connection.response=f.reply(0,query.requestId(),"CHUNK_RETAINED_INCOMPLETE_VALUES").toString().getBytes(StandardCharsets.UTF_8);f.queryZeroDisk.memoryOnly=true;};
                denied(()->f.old.engine.readNativeRetainedQuery(query,f.old.http(),new NativeRetainedHttp.Attempt()));
            }finally{f.old.onReply=()->{};}
            var memory=new HashMap<>(f.queryZeroDisk.memory);denied(()->f.next(batch));assertNull(f.write(1).observe());
            f.queryZeroDisk.memoryOnly=false;assertEquals("NEW_CHUNK_SLOT",f.old.engine.inspectNativeRetainedBatch(batch).state);assertEquals(memory,f.queryZeroDisk.durable);try(var next=f.next(batch)){assertNotNull(next.requestId());}
        }f.preserved();
    }
    @Test public void gapsAndMixedValidHMACGenerationCannotBeSilentlySkipped()throws Exception{
        for(boolean mixed:new boolean[]{false,true}){var f=new Fixture();try(var batch=f.prepare()){if(mixed)f.completeZero(batch);
            f.inject(1,mixed?id(8000):batch.operationId(),mixed?id(8001):batch.generationId());var before=new HashMap<>(f.root.durable);int ids=f.ids,opened=f.old.opened;
            denied(()->f.old.engine.inspectNativeRetainedBatch(batch));denied(()->f.next(batch));assertEquals(before,f.root.durable);assertEquals(ids,f.ids);assertEquals(opened,f.old.opened);
        }f.preserved();}
    }
    @Test public void nonceReuseAcrossAnyEarlierWriteOrQueryIsRefusedBeforeLaterPreparation()throws Exception{
        for(boolean query:new boolean[]{false,true}){var f=new Fixture();try(var batch=f.prepare()){f.completeZero(batch);String collision=(query?f.read(0).observe().record():f.write(0).observe().record()).getString("native_request_id");
            var before=new HashMap<>(f.root.durable);denied(()->f.old.engine.prepareNextNativeRetainedBatchChunk(batch,()->collision));assertNull(f.write(1).observe());assertEquals(before,f.root.durable);
        }f.preserved();}
    }
    @Test public void changedPrincipalRevisionOrFrozenWorkRefusesBeforeAnyNewSlotOrID()throws Exception{
        for(int variant=0;variant<3;variant++){var f=new Fixture();var principal=f.old.independentReader();try(var batch=f.prepare()){var before=new HashMap<>(f.root.durable);int ids=f.ids;
            if(variant==0)principal.value=new JSONObject(principal.value).put("assignment_epoch",8).toString();else if(variant==1)f.old.bumpVault();else f.old.workDisk.memory.put("unknown-original-work","changed synthetic bytes");
            denied(()->f.next(batch));assertEquals(before,f.root.durable);assertEquals(ids,f.ids);assertEquals(0,f.old.opened);
        }f.preserved();}
    }
    @Test public void closedForeignBatchOrChangedSealBlocksAlreadyPreparedTransport()throws Exception{
        for(int variant=0;variant<3;variant++){var f=new Fixture();var other=new Fixture();try(var batch=f.prepare();var write=f.next(batch)){
            if(variant==0)batch.close();else if(variant==1){denied(()->other.old.engine.prepareNextNativeRetainedBatchChunk(batch,other::nextId));write.close();}else f.replaceIndex(f.index().put("generation_id",id(8500)));
            denied(()->f.old.send(write));assertEquals(0,f.old.opened);assertEquals(NativeRetainedAttemptJournal.PREPARED,f.old.journal.observe().state);
        }f.preserved();other.preserved();}
    }
    @Test public void unknownOrMalformedBatchDataIsPreservedNotClearedOrTreatedEmpty()throws Exception{
        for(int variant=0;variant<5;variant++){var f=new Fixture();try(var batch=f.prepare()){if(variant==0)f.root.memory.put("foreign","original unknown data");else if(variant==1)f.root.memory.put("write:0:index","forbidden legacy alias");
            else if(variant==2)f.root.memory.put("query:1707:part:0","outside fixed batch");else if(variant==3)f.replaceIndex(f.index().put("chunk_count",1.5));else f.replaceIndex(f.index().put("unknown",true));
            var before=new HashMap<>(f.root.memory);denied(()->f.old.engine.inspectNativeRetainedBatch(batch));assertEquals(before,f.root.memory);assertEquals(0,f.old.opened);
        }f.preserved();}
    }
    @Test public void missingSharedKeyAndWrongSlotAADCannotBecomeAnotherChunkCapability()throws Exception{
        var f=new Fixture();try(var batch=f.prepare()){f.completeZero(batch);try(var write=f.next(batch)){}
            var before=new HashMap<>(f.root.memory);f.indexCipher.missing=true;denied(()->f.next(batch));assertEquals(before,f.root.memory);f.indexCipher.missing=false;
            var writeCipher=f.domains.get(AndroidRetainedBatchStore.AAD+":write:1");writeCipher.missing=true;denied(()->f.old.engine.inspectNativeRetainedBatch(batch));writeCipher.missing=false;
            try(var write=f.next(batch);var reply=f.old.send(write)){}
            try(var query=f.old.engine.prepareNativeRetainedBatchQuery(batch,1,f::nextId)){}
            String sealed=(String)f.root.memory.get("write:1:index");f.root.memory.put("query:1:index",sealed);denied(()->f.old.engine.inspectNativeRetainedBatch(batch));assertEquals(3,f.old.opened);
        }f.preserved();
    }
    @Test public void queryCannotSelectAbsentFutureSlotAndPreparedWriteCannotPretendDispatched()throws Exception{
        var f=new Fixture();try(var batch=f.prepare();var write=f.next(batch)){int ids=f.ids;denied(()->f.old.engine.prepareNativeRetainedBatchQuery(batch,0,f::nextId));denied(()->f.old.engine.prepareNativeRetainedBatchQuery(batch,2,f::nextId));assertEquals(ids,f.ids);assertNull(f.read(0).observe());assertEquals(0,f.old.opened);}f.preserved();
    }
    @Test public void originalChangeDuringTrueBatchCommitCannotReturnACapability()throws Exception{
        for(boolean work:new boolean[]{false,true}){var f=new Fixture();var backing=new AndroidRetainedBatchStore(f.root.preferences(),f.indexCipher,
            (query,index)->new DomainCipher(AndroidRetainedBatchStore.AAD+":"+(query?"query:":"write:")+index),f.old.journal,f.queryZero);
            var journal=new NativeRetainedBatchJournal(new NativeRetainedBatchJournal.Backend(){
                public Map<String,?> readAll(){return backing.readAll();}
                public boolean compareAndCommit(Map<String,String> before,Map<String,String> next)throws Exception{
                    boolean committed=backing.compareAndCommit(before,next);if(work)f.old.workDisk.memory.put("unknown-original-work","changed during true commit");else f.old.bumpVault();return committed;}
            },f.indexCipher,(query,index)->new DomainCipher(AndroidRetainedBatchStore.AAD+":"+(query?"query:":"write:")+index),new Object(),f.old.journal,f.queryZero);
            denied(()->f.old.engine.prepareNativeRetainedBatch(f.old.work,f.old.principal,null,journal,f::nextId));assertNull(f.old.journal.observe());assertEquals(0,f.old.opened);f.preserved();
        }
    }
    @Test public void aLaterQueryCannotReuseAnEarlierQueryNonceOrOverwriteAnyWitness()throws Exception{
        var f=new Fixture();try(var batch=f.prepare()){f.completeZero(batch);f.sendWrite(batch,1);String old=f.read(0).observe().record().getString("native_request_id");var before=new HashMap<>(f.root.durable);
            denied(()->f.old.engine.prepareNativeRetainedBatchQuery(batch,1,()->old));assertNull(f.read(1).observe());assertEquals(before,f.root.durable);assertEquals(3,f.old.opened);
        }f.preserved();
    }
}
