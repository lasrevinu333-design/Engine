package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** New owning semantic cases ONLY. All disk/enrollment/credentials/records and
 * authenticated context are synthetic. Actual Android encrypted adapter,
 * native original HMAC and engine boundaries; zero transport/SQL/phone work. */
public final class NativeRetainedCompletionSemanticsTest {
    interface Action {void run()throws Exception;}
    static void refused(Action a)throws Exception{try{a.run();fail("missing evidence must remain unresolved");}catch(VaultFailure expected){}}
    static final String PREFIX="authenticated_completion_receipt_sha256:";
    static final class Fixture {
        final NativeRetainedOwnerTest.Fixture owner;
        final JSONObject args=NativeCompletionJournalTest.args(),start,end;
        String receiptKey;String cutoff="2026-09-27T08:00:00.123456Z";
        Fixture()throws Exception {this(new NativeRetainedOwnerTest.Fixture(),false);}
        static Fixture activeBeforeSeparation()throws Exception {
            return new Fixture(NativeRetainedOwnerTest.Fixture.activeBeforeSeparation(),true);
        }
        private Fixture(NativeRetainedOwnerTest.Fixture owner,boolean beforeSeparation)throws Exception {
            this.owner=owner;
            if(beforeSeparation){
                assertFalse(owner.workDisk.memory.containsKey(NativeRetainedWorkCapture.FENCE));
                start=new JSONObject();end=new JSONObject();return;
            }
            owner.workDisk.memory.remove(NativeRetainedWorkCapture.FENCE);
            args.put("p_client_started_at","2026-09-26T12:00:00.000Z").put("p_client_ended_at","2026-09-26T12:20:00.000Z");
            start=new JSONObject().put("client_session_id",NativeCompletionJournalTest.SESSION).put("device_id","KIOSK_08").put("location_code","NOCX")
                .put("snapshot_id","a".repeat(64)).put("generated_at","2026-09-26T10:00:00.000Z").put("expires_at","2026-09-27T18:00:00.000Z")
                .put("clock_base_at","2026-09-26T10:00:00.000Z").put("anchor_elapsed_realtime_ms",1000L).put("boot_count",3)
                .put("native_scan_entry_id",NativeSeparationContextTest.id(43)).put("started_at",args.get("p_client_started_at"))
                .put("completed_at",args.get("p_client_ended_at"));
            end=new JSONObject();for(String field:new String[]{"client_session_id","device_id","location_code","started_at","completed_at"})end.put(field,start.get(field));
            end.put("entry_id",NativeCompletionJournalTest.FINISH);sign();
        }
        void sign()throws Exception {
            char[] synthetic=owner.vaultCipher.decrypt(owner.persistence.current().secret);
            try{
                var fields=NativeAttestation.offlineCompletion("KIOSK_08",args.getString("p_location_code"),args.getString("p_client_session_id"),
                    args.getString("p_client_completion_id"),args.getJSONObject("p_response_json").getJSONObject("__custodial_offline_reconciliation_v1").getString("context_id"),
                    args.getString("p_native_finish_scan_entry_id"),args.getString("p_client_started_at"),synthetic,args.getString("p_client_ended_at"));
                for(var field:fields.entrySet())args.put(field.getKey(),field.getValue());
            }finally{VaultValidation.wipe(synthetic);}
        }
        String key(boolean finish)throws Exception{return(finish?"offline_finish_proof_sha256:":"offline_occurrence_sha256:")+NativeProviderPrincipal.hash(NativeCompletionJournalTest.SESSION);}
        void put(String key,JSONObject row)throws Exception{
            char[] clear=row.toString().toCharArray();EncryptedSecret encrypted;
            try{encrypted=owner.workCipher.encryptWithExistingKey(clear);}finally{VaultValidation.wipe(clear);}
            owner.workDisk.memory.put(key,new JSONObject().put("ciphertext",encrypted.ciphertext).put("iv",encrypted.iv).toString());
        }
        void record(boolean legacy)throws Exception {
            put(key(false),start);put(key(true),end);
            var journal=new NativeCompletionJournal(owner.work);journal.captureAuthenticatedResponse("KIOSK_08",
                NativeCompletionJournalTest.request(args),NativeCompletionJournalTest.response(NativeCompletionJournalTest.result()));
            receiptKey=owner.workDisk.memory.keySet().stream().filter(k->k.startsWith(PREFIX)).findFirst().orElseThrow().substring(PREFIX.length());
            if(legacy){JSONObject saved=new JSONObject(owner.work.loadCompletionReceipt(receiptKey));saved.put("schema_version","native-server-completion.v2");
                saved.remove("original_request_body_base64");saved.remove("original_request_body_sha256");owner.work.saveCompletionReceipt(receiptKey,saved.toString());}
        }
        void freeze()throws Exception {
            var principal=NativeProviderPrincipal.fromNativeJournal(owner.principal.readFor(owner.engine.getState()));
            var context=NativeSeparationContext.fromAuthenticatedResponse(NativeSeparationContextTest.request(),NativeSeparationContextTest.response(
                NativeSeparationContextTest.envelope(NativeSeparationContextTest.data().put("credential_id",principal.json().get("credential_id")).put("cutoff_at",cutoff))),principal);
            var raw=owner.work.separationRawSnapshot();var proof=owner.engine.attestNativeSeparationSnapshot(context,NativeProtectedWorkSnapshot.capture(raw),owner.principal,null);
            owner.work.freezeSeparationSnapshot(raw,proof);
        }
        byte[] candidate(){return args.toString().getBytes(StandardCharsets.UTF_8);}
        NativeRetainedCompletionSemantics.Observation inspect()throws Exception {
            var exact=new HashMap<>(owner.workDisk.memory);int commits=owner.workDisk.commits,encrypts=owner.workCipher.delegate.existingKeyEncryptCalls;
            var result=NativeSeparationFreeze.inspectOriginalCompletionSemantics(owner.engine,owner.work,owner.principal,null,receiptKey,candidate());
            assertEquals(exact,owner.workDisk.memory);assertEquals(commits,owner.workDisk.commits);assertEquals(encrypts,owner.workCipher.delegate.existingKeyEncryptCalls);
            assertEquals(0,owner.opened);assertTrue(result.originalCompletionSignatureMatches);assertTrue(result.nativeSessionValuesMatch);
            assertFalse(result.browserSourceAuthenticated);assertFalse(result.historicalSnapshotPrincipalVerified);assertFalse(result.clockProfileQualified);
            assertFalse(result.cutoffEligible);assertFalse(result.currentServerReadback);assertFalse(result.workAccepted);assertFalse(result.inventoryAcknowledged);
            assertFalse(result.keyRemovalAllowed);assertFalse(result.phoneReleased);owner.wiped();return result;
        }
        void refuse()throws Exception{
            var exact=new HashMap<>(owner.workDisk.memory);int commits=owner.workDisk.commits;refused(()->inspect());
            assertEquals(exact,owner.workDisk.memory);assertEquals(commits,owner.workDisk.commits);assertEquals(0,owner.opened);owner.wiped();
        }
    }
    @Test public void originalV3SignatureAndNativePairAreSpecificProofNotAcceptance()throws Exception{
        var f=new Fixture();f.record(false);f.freeze();var result=f.inspect();assertEquals("BEFORE",result.startCutoffRelation);assertEquals("BEFORE",result.finishCutoffRelation);
        assertEquals(NativeProviderPrincipal.hash(f.start.toString()),result.occurrenceSha256);assertEquals(NativeProviderPrincipal.hash(f.end.toString()),result.finishSha256);
        assertEquals(NativeRetainedAttempt.hash(f.candidate()),result.argumentSha256);
    }
    @Test public void legacyV2BindingCanJoinRealCandidateValuesWithoutInventingOriginalWire()throws Exception{
        var f=new Fixture();f.record(true);String exact=f.owner.work.loadCompletionReceipt(f.receiptKey);f.freeze();f.inspect();
        assertEquals(exact,f.owner.work.loadCompletionReceipt(f.receiptKey));assertFalse(new JSONObject(exact).has("original_request_body_base64"));
    }
    @Test public void readableReceiptWithFalseOriginalCompletionSignatureIsRefused()throws Exception{
        for(String field:new String[]{"p_native_completion_attestation","p_native_completion_attestation_version"}){
            var f=new Fixture();f.args.put(field,field.endsWith("version")?"custodial-native-completion.v1":"b".repeat(64));f.record(false);f.freeze();f.refuse();
        }
    }
    @Test public void originalWorkContextIsNotSilentlyReplacedBySeparationContext()throws Exception{
        var f=new Fixture();f.args.getJSONObject("p_response_json").getJSONObject("__custodial_offline_reconciliation_v1").put("context_id",NativeSeparationContextTest.id(7));
        f.record(false);f.freeze();f.refuse();
    }
    @Test public void wrongNativeOccurrenceArgumentFieldsStayUnresolved()throws Exception{
        String[] fields={"device_id","location_code","client_session_id","started_at","completed_at","snapshot_id","boot_count"};
        Object[] values={"OTHER","OTHER",NativeSeparationContextTest.id(99),"2026-09-26T12:00:00.001Z","2026-09-26T12:20:00.001Z","unknown",-1};
        for(int i=0;i<fields.length;i++){var f=new Fixture();f.start.put(fields[i],values[i]);f.record(false);f.freeze();f.refuse();}
    }
    @Test public void wrongFinishIdentityOrFieldsCannotBorrowMatchingReceipt()throws Exception{
        for(String field:new String[]{"entry_id","location_code","completed_at","extra"}){
            var f=new Fixture();f.end.put(field,field.equals("entry_id")?NativeSeparationContextTest.id(99):"wrong");f.record(false);f.freeze();f.refuse();
        }
    }
    @Test public void missingCorruptOrOpenNativeRowsAreNotEmptyOrCompleted()throws Exception{
        for(int mode=0;mode<5;mode++){
            var f=new Fixture();if(mode==4){f.start.put("completed_at","");f.end.put("completed_at","");}f.record(false);
            if(mode<2)f.owner.workDisk.memory.remove(f.key(mode==1));else if(mode<4)f.owner.workDisk.memory.put(f.key(mode==3),"original corrupt ciphertext");
            f.freeze();f.refuse();
        }
    }
    @Test public void missingCorruptUnknownReceiptIsNotSyntheticServerAcceptance()throws Exception{
        for(int mode=0;mode<4;mode++){
            var f=new Fixture();f.record(false);
            if(mode==0)f.owner.workDisk.memory.remove(PREFIX+f.receiptKey);
            if(mode==1)f.owner.workDisk.memory.put(PREFIX+f.receiptKey,"corrupt receipt ciphertext");
            if(mode>=2){JSONObject receipt=new JSONObject(f.owner.work.loadCompletionReceipt(f.receiptKey));receipt.put("schema_version",mode==2?"native-server-completion.v1":"native-server-completion.v99");f.owner.work.saveCompletionReceipt(f.receiptKey,receipt.toString());}
            f.freeze();f.refuse();
        }
    }
    @Test public void exactCutoffBeforeEqualAfterAreObservationsNeverEligibility()throws Exception{
        for(int mode=0;mode<3;mode++){
            var f=new Fixture();String ended=mode==2?"2026-09-27T08:00:00.124Z":"2026-09-27T08:00:00.123Z";
            if(mode==1)f.cutoff="2026-09-27T08:00:00.123000Z";
            f.args.put("p_client_ended_at",ended);f.start.put("completed_at",ended);f.end.put("completed_at",ended);f.sign();f.record(false);f.freeze();
            assertEquals(mode==0?"BEFORE":mode==1?"EQUAL":"AFTER",f.inspect().finishCutoffRelation);
        }
    }
    @Test public void changedCandidateCannotUseOlderMatchingNativeBinding()throws Exception{
        var f=new Fixture();f.record(false);f.freeze();f.args.getJSONObject("p_response_json").put("extra","changed after original receipt");f.refuse();
    }
    @Test public void missingOriginalWorkContextOrTypedTimeRemainsUnresolved()throws Exception{
        var f=new Fixture();f.args.getJSONObject("p_response_json").remove("__custodial_offline_reconciliation_v1");f.record(false);f.freeze();f.refuse();
    }
    static NativeSeparationFreeze.InspectionStore racing(Fixture f,String fault,byte[] caller)throws Exception{
        var independent=fault.equals("principal")?f.owner.independentReader():null;
        return new NativeSeparationFreeze.InspectionStore(){
            public Map<String,?> separationRawSnapshot()throws VaultFailure{return f.owner.work.separationRawSnapshot();}
            public void prepareSeparationProbe(Map<String,?> original){throw new AssertionError("no write");}
            public void freezeSeparationSnapshot(Map<String,?> original,NativeSeparationEvidence p){throw new AssertionError("no freeze");}
            public JSONObject readSeparationSnapshotEvidence(Map<String,?> raw)throws VaultFailure{return f.owner.work.readSeparationSnapshotEvidence(raw);}
            public NativeProtectedWorkInventory inspectSeparationSnapshot(Map<String,?> raw,NativeSeparationEvidence p){throw new AssertionError("not full inventory");}
            public NativeRetainedCompletionSemantics.Observation inspectRetainedCompletionSemantics(Map<String,?> raw,NativeSeparationEvidence p,
                String key,byte[] bytes,char[] credential)throws VaultFailure{
                var result=f.owner.work.inspectRetainedCompletionSemantics(raw,p,key,bytes,credential);
                try{
                    if(fault.equals("vault"))f.owner.bumpVault();
                    if(fault.equals("principal"))independent.value=new JSONObject(independent.value).put("assignment_epoch",8).toString();
                    if(fault.equals("raw"))f.owner.workDisk.memory.put("unknown-original-work","changed during observation");
                    if(fault.equals("candidate"))caller[0]=0;
                    if(fault.equals("decoder-candidate"))bytes[0]=0;
                }catch(Exception error){throw new VaultFailure(NativeRetainedCompletionSemantics.FAILURE,error);}return result;
            }
        };
    }
    @Test public void fullOwnerRevisionPrincipalAndRawRacesInvalidateSpecificProof()throws Exception{
        for(String fault:new String[]{"vault","principal","raw"}){
            var f=new Fixture();f.record(false);f.freeze();byte[] candidate=f.candidate();var store=racing(f,fault,candidate);
            int commits=f.owner.workDisk.commits;refused(()->NativeSeparationFreeze.inspectOriginalCompletionSemantics(f.owner.engine,store,f.owner.principal,null,f.receiptKey,candidate));
            assertEquals(commits,f.owner.workDisk.commits);assertEquals(0,f.owner.opened);f.owner.wiped();
        }
    }
    @Test public void callerOrDecoderArgumentMutationCannotReturnProof()throws Exception{
        for(String fault:new String[]{"candidate","decoder-candidate"}){
            var f=new Fixture();f.record(false);f.freeze();byte[] candidate=f.candidate();var store=racing(f,fault,candidate);
            refused(()->NativeSeparationFreeze.inspectOriginalCompletionSemantics(f.owner.engine,store,f.owner.principal,null,f.receiptKey,candidate));f.owner.wiped();
        }
    }
    @Test public void legacyInspectionAdapterWithoutSemanticDecoderRefusesByDefault()throws Exception{
        var f=new Fixture();f.record(false);f.freeze();NativeSeparationFreeze.InspectionStore old=new NativeSeparationFreeze.InspectionStore(){
            public Map<String,?> separationRawSnapshot()throws VaultFailure{return f.owner.work.separationRawSnapshot();}
            public void prepareSeparationProbe(Map<String,?> raw){throw new AssertionError("no write");}
            public void freezeSeparationSnapshot(Map<String,?> raw,NativeSeparationEvidence p){throw new AssertionError("no freeze");}
            public JSONObject readSeparationSnapshotEvidence(Map<String,?> raw)throws VaultFailure{return f.owner.work.readSeparationSnapshotEvidence(raw);}
            public NativeProtectedWorkInventory inspectSeparationSnapshot(Map<String,?> raw,NativeSeparationEvidence p){throw new AssertionError("no fallback");}
        };
        refused(()->NativeSeparationFreeze.inspectOriginalCompletionSemantics(f.owner.engine,old,f.owner.principal,null,f.receiptKey,f.candidate()));f.owner.wiped();
    }
}
