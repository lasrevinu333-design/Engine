package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** NEW whole-map census scope. Existing factories are compiled/reused only;
 * enrollment, credentials, cipher, preferences/disk and source context are
 * synthetic. No browser, SQL, network, APK, key creation/removal or phone test. */
public final class NativeRetainedCompletionCensusTest {
    static final String FIXED_PROVENANCE="CAPTURED_NATIVE_FIXED_READ_VALUES_ORIGINAL_WRITE_UNKNOWN";
    public static void main(String[] args)throws Exception {
        if(args.length==2&&"--native-read-groups-only".equals(args[0])&&java.util.Set.of(
            "GROUP_v3ExactKeysDetachedBytesAndClose","GROUP_fixedReadPrincipalAndExactCutoff",
            "GROUP_legacyDuplicateAndMalformedRetained","GROUP_sourceCredentialAndCandidateWithdrawalRefuse",
            "GROUP_partialSelectionFailureRetainsOriginals","GROUP_legacyArgumentsApiOwnsCopiesOnly").contains(args[1])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeRetainedCompletionCensusTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_NATIVE_READ_GROUP_ONLY "+args[1]);return;
        }
        if(args.length==2&&"--native-read-arguments-only".equals(args[0])&&java.util.Set.of(
            "SELECT_v3OwnedArgumentsOrderedWithoutWrites","SELECT_fixedReadOriginalPrincipalOnly",
            "SELECT_legacyMalformedDuplicateStayInCensus","SELECT_unreadableSubsetRetainsCensus",
            "SELECT_rawAndDecoderWithdrawalRefuse","SELECT_noReceiptListIsNotEmptyWorkProof").contains(args[1])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeRetainedCompletionCensusTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_NATIVE_READ_VALUE_SELECTION_ONLY "+args[1]);return;
        }
        var names=java.util.Set.of("FIXED_READ_originalPrincipalCapturedBeforeFreezeJoinsWithoutCandidates",
            "FIXED_READ_foreignReadPrincipalsCannotBorrowFrozenOwner", "FIXED_READ_malformedResponseAndUnavailableRetainedRemainUnresolved",
            "FIXED_READ_conflictingBrowserArgsRemainUnresolved", "FIXED_READ_sourceWithdrawalRefusesWithoutInspectionWrites");
        if(args.length!=2||!"--fixed-read-census-only".equals(args[0])||!names.contains(args[1]))throw new IllegalArgumentException("new fixed-read member required");
        try{NativeRetainedCompletionCensusTest.class.getMethod(args[1]).invoke(new NativeRetainedCompletionCensusTest());}
        catch(java.lang.reflect.InvocationTargetException error){throw new AssertionError(args[1],error.getCause());}
        System.out.println("PASS_SOURCE_MOCK "+args[1]);
    }
    /** Actual journal capture, with synthetic authenticated-read owner only.
     * No v3 record is created, changed or borrowed into this recipe. */
    static void captureFixedOriginal(NativeRetainedCompletionSemanticsTest.Fixture f,String changedPrincipal,boolean corruptReply)throws Exception {
        f.put(f.key(false),f.start);f.put(f.key(true),f.end);
        var original=NativeProviderPrincipal.fromNativeJournal(f.owner.principal.readFor(f.owner.engine.getState()));
        JSONObject principal=original.json();
        if(changedPrincipal!=null){
            Object changed=changedPrincipal.equals("assignment_epoch")?principal.getLong(changedPrincipal)+1:
                changedPrincipal.equals("installation_seal")?"synthetic-other-installation":
                changedPrincipal.equals("enrolled_at")?"2026-09-16T00:00:00.000Z":NativeSeparationContextTest.id(92);
            principal.put(changedPrincipal,changed);
        }
        var readPrincipal=NativeProviderPrincipal.fromNativeJournal(principal);
        var result=NativeCompletionJournalTest.fullResult().put("started_at",f.args.get("p_client_started_at"))
            .put("ended_at",f.args.get("p_client_ended_at")).put("original_employee_id",principal.get("employee_id"));
        var rb=NativeCompletionJournalTest.readback().put("original_employee_id",principal.get("employee_id"))
            .put("original_credential_id",principal.get("credential_id")).put("assignment_epoch",principal.get("assignment_epoch"))
            .put("submitted_at","2026-09-26T12:20:07.123456+00:00");
        var q=NativeCompletionJournalTest.fixedRequest(f.args);var r=NativeCompletionJournalTest.fixedResponse(result,rb);
        try{
            if(corruptReply)r.body[0]=0;
            var readOwner=new NativeCompletionJournalTest.Owner(q,r);readOwner.principal=readPrincipal;
            new NativeCompletionJournal(f.owner.work).captureAuthenticatedResponse("KIOSK_08",q,r,readOwner);
            assertTrue(readOwner.authCalls>0);
            f.receiptKey=f.owner.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX))
                .findFirst().orElseThrow().substring(NativeRetainedCompletionSemanticsTest.PREFIX.length());
            try(var captured=NativeCompletionJournal.inspectRetainedOriginalRequest("KIOSK_08",f.receiptKey,f.owner.work.loadCompletionReceipt(f.receiptKey))){
                assertTrue(captured.fixedReadValuesAvailable);assertFalse(captured.originalValuesAvailable);assertNull(captured.requestBodySha256);
                assertEquals(changedPrincipal==null,captured.fixedReadMatchesOriginalPrincipal(original));
                byte[] request=captured.fixedReadBody(),response=captured.fixedReadResponseBody();
                try{assertArrayEquals(q.body,request);assertArrayEquals(r.body,response);}
                finally{Arrays.fill(request,(byte)0);Arrays.fill(response,(byte)0);}
                NativeRetainedCompletionSemanticsTest.refused(captured::originalBody);
                NativeRetainedCompletionSemanticsTest.refused(captured::originalArgs);
                assertFalse(captured.workAccepted);assertFalse(captured.inventoryAcknowledged);assertFalse(captured.keyRemovalAllowed);
            }
        }finally{Arrays.fill(q.body,(byte)0);Arrays.fill(r.body,(byte)0);}
    }
    static NativeRetainedCompletionSemanticsTest.Fixture fixedFrozen(String changedPrincipal)throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();captureFixedOriginal(f,changedPrincipal,false);f.freeze();return f;
    }
    @Test public void FIXED_READ_originalPrincipalCapturedBeforeFreezeJoinsWithoutCandidates()throws Exception {
        var f=fixedFrozen(null);String exact=f.owner.work.loadCompletionReceipt(f.receiptKey);
        var observed=inspect(f,List.of());assertEquals(1,observed.matchedCompletionCount);assertEquals(3,observed.completionJoinedRecordCount);
        assertEquals(0,observed.json().getJSONArray("argument_candidates").length());assertEquals(FIXED_PROVENANCE,receiptRow(observed).get("argument_provenance"));
        assertEquals(exact,f.owner.work.loadCompletionReceipt(f.receiptKey));
        JSONObject record=new JSONObject(exact);assertEquals("UNKNOWN",record.getJSONObject("provenance").get("original_write_wire_state"));
        assertFalse(record.has("original_request_body_base64"));assertFalse(record.has("original_request_body_sha256"));
    }
    @Test public void FIXED_READ_foreignReadPrincipalsCannotBorrowFrozenOwner()throws Exception {
        for(String field:new String[]{"employee_id","credential_id","assignment_epoch","credential_operation_id","installation_seal","enrolled_at"}){
            var f=fixedFrozen(field);String exact=f.owner.work.loadCompletionReceipt(f.receiptKey);var observed=inspect(f,List.of());
            assertEquals(field,0,observed.matchedCompletionCount);assertEquals(0,observed.completionJoinedRecordCount);
            assertEquals("INVALID_OR_UNREADABLE_COMPLETION_RETAINED",receiptRow(observed).get("state"));assertEquals(exact,f.owner.work.loadCompletionReceipt(f.receiptKey));
        }
    }
    @Test public void FIXED_READ_malformedResponseAndUnavailableRetainedRemainUnresolved()throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();
        NativeRetainedCompletionSemanticsTest.refused(()->captureFixedOriginal(f,null,true));
        assertFalse(f.owner.workDisk.memory.keySet().stream().anyMatch(k->k.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)));
        assertEquals(0,f.owner.opened);f.owner.wiped();
        var retained=new NativeRetainedCompletionSemanticsTest.Fixture();captureFixedOriginal(retained,null,false);
        String exact=retained.owner.work.loadCompletionReceipt(retained.receiptKey);retained.freeze();
        String key=NativeRetainedCompletionSemanticsTest.PREFIX+retained.receiptKey;
        String encrypted=(String)retained.owner.workDisk.memory.get(key);
        String ciphertext=new JSONObject(encrypted).getString("ciphertext");
        // Existing cipher fault seam: make this exact retained ciphertext
        // unavailable, without changing a receipt, ciphertext, IV or journal.
        // This is NOT retained response-byte-corruption or ABA qualification.
        assertTrue(retained.owner.workCipher.delegate.unreadableCiphertexts.add(ciphertext));
        try{
            NativeRetainedCompletionSemanticsTest.refused(()->retained.owner.work.loadCompletionReceipt(retained.receiptKey));
            var observed=inspect(retained,List.of());assertEquals(0,observed.matchedCompletionCount);
            assertEquals("INVALID_OR_UNREADABLE_COMPLETION_RETAINED",receiptRow(observed).get("state"));
            assertEquals(encrypted,retained.owner.workDisk.memory.get(key));
        }finally{assertTrue(retained.owner.workCipher.delegate.unreadableCiphertexts.remove(ciphertext));}
        assertEquals(exact,retained.owner.work.loadCompletionReceipt(retained.receiptKey));
    }
    @Test public void FIXED_READ_conflictingBrowserArgsRemainUnresolved()throws Exception {
        var f=fixedFrozen(null);String exact=f.owner.work.loadCompletionReceipt(f.receiptKey);
        JSONObject other=new JSONObject(f.args.toString());other.getJSONObject("p_response_json").put("changed","browser-only-value");
        byte[] candidate=other.toString().getBytes(StandardCharsets.UTF_8);
        try{var observed=inspect(f,List.of(candidate));assertEquals(0,observed.matchedCompletionCount);assertEquals(1,observed.unresolvedCandidateCount);
            assertEquals("BROWSER_ARGUMENT_VALUES_MISMATCH_RETAINED",receiptRow(observed).get("state"));assertEquals(exact,f.owner.work.loadCompletionReceipt(f.receiptKey));}
        finally{Arrays.fill(candidate,(byte)0);}
    }
    @Test public void FIXED_READ_sourceWithdrawalRefusesWithoutInspectionWrites()throws Exception {
        for(String fault:new String[]{"vault","principal","raw"}){
            var f=fixedFrozen(null);String exact=f.owner.work.loadCompletionReceipt(f.receiptKey);int commits=f.owner.workDisk.commits;
            var store=racing(f,fault,new ArrayList<>());
            NativeRetainedCompletionSemanticsTest.refused(()->NativeSeparationFreeze.inspectOriginalCompletionCensus(f.owner.engine,store,f.owner.principal,null,List.of()));
            assertEquals(commits,f.owner.workDisk.commits);assertEquals(exact,f.owner.work.loadCompletionReceipt(f.receiptKey));assertEquals(0,f.owner.opened);f.owner.wiped();
        }
    }
    static NativeRetainedCompletionSemanticsTest.Fixture prepared(boolean legacy)throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(legacy);f.freeze();return f;
    }
    static NativeRetainedCompletionCensus.Observation inspect(NativeRetainedCompletionSemanticsTest.Fixture f,List<byte[]> candidates)throws Exception {
        var memory=new HashMap<>(f.owner.workDisk.memory);var durable=new HashMap<>(f.owner.workDisk.durable);var vault=f.owner.engine.getState();
        int commits=f.owner.workDisk.commits,encrypts=f.owner.workCipher.delegate.existingKeyEncryptCalls;
        var result=NativeSeparationFreeze.inspectOriginalCompletionCensus(f.owner.engine,f.owner.work,f.owner.principal,null,candidates);
        assertEquals(memory,f.owner.workDisk.memory);assertEquals(durable,f.owner.workDisk.durable);assertEquals(vault,f.owner.engine.getState());
        assertEquals(commits,f.owner.workDisk.commits);assertEquals(encrypts,f.owner.workCipher.delegate.existingKeyEncryptCalls);assertEquals(0,f.owner.opened);
        assertFalse(result.browserSourceAuthenticated);assertFalse(result.completeNamespaceInventory);assertFalse(result.currentServerReadback);assertFalse(result.cutoffEligible);
        assertFalse(result.workAccepted);assertFalse(result.inventoryAcknowledged);assertFalse(result.keyRemovalAllowed);assertFalse(result.phoneReleased);
        JSONObject json=result.json();assertEquals("UNKNOWN",json.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",json.get("browser_inventory_state"));
        assertEquals(f.owner.workDisk.memory.size()-1,result.recordCount);assertEquals(result.recordCount,json.getJSONArray("records").length());
        assertEquals(result.recordCount-result.completionJoinedRecordCount,result.unresolvedRecordCount);
        assertFalse(json.toString().contains("services_performed"));assertFalse(json.toString().contains("enrollment"));
        f.owner.wiped();return result;
    }
    static void denied(NativeRetainedCompletionSemanticsTest.Fixture f,List<byte[]> candidates)throws Exception {
        var before=new HashMap<>(f.owner.workDisk.memory);int commits=f.owner.workDisk.commits;
        NativeRetainedCompletionSemanticsTest.refused(()->NativeSeparationFreeze.inspectOriginalCompletionCensus(f.owner.engine,f.owner.work,f.owner.principal,null,candidates));
        assertEquals(before,f.owner.workDisk.memory);assertEquals(commits,f.owner.workDisk.commits);assertEquals(0,f.owner.opened);f.owner.wiped();
    }
    static JSONObject receiptRow(NativeRetainedCompletionCensus.Observation result)throws Exception {
        var rows=result.json().getJSONArray("records");for(int i=0;i<rows.length();i++)if("COMPLETION_RECEIPT".equals(rows.getJSONObject(i).get("kind")))return rows.getJSONObject(i);
        throw new AssertionError("retained receipt must be represented");
    }
    static void sign(NativeRetainedCompletionSemanticsTest.Fixture f,JSONObject args)throws Exception {
        char[] token=f.owner.vaultCipher.decrypt(f.owner.persistence.current().secret);
        try{var fields=NativeAttestation.offlineCompletion("KIOSK_08",args.getString("p_location_code"),args.getString("p_client_session_id"),
            args.getString("p_client_completion_id"),args.getJSONObject("p_response_json").getJSONObject("__custodial_offline_reconciliation_v1").getString("context_id"),
            args.getString("p_native_finish_scan_entry_id"),args.getString("p_client_started_at"),token,args.getString("p_client_ended_at"));
            for(var field:fields.entrySet())args.put(field.getKey(),field.getValue());
        }finally{VaultValidation.wipe(token);}
    }
    static void anotherReceipt(NativeRetainedCompletionSemanticsTest.Fixture f,boolean sameSession)throws Exception {
        JSONObject args=new JSONObject(f.args.toString());String session=sameSession?args.getString("p_client_session_id"):NativeSeparationContextTest.id(70);
        args.put("p_client_session_id",session).put("p_client_completion_id",NativeSeparationContextTest.id(71));
        if(!sameSession){args.put("p_native_finish_scan_entry_id",NativeSeparationContextTest.id(72));
            JSONObject start=new JSONObject(f.start.toString()).put("client_session_id",session).put("native_scan_entry_id",NativeSeparationContextTest.id(73));
            JSONObject end=new JSONObject(f.end.toString()).put("client_session_id",session).put("entry_id",args.get("p_native_finish_scan_entry_id"));
            f.put("offline_occurrence_sha256:"+NativeProviderPrincipal.hash(session),start);f.put("offline_finish_proof_sha256:"+NativeProviderPrincipal.hash(session),end);
        }
        sign(f,args);var result=new JSONObject(NativeCompletionJournalTest.result().toString()).put("client_session_id",session).put("client_completion_id",args.get("p_client_completion_id"));
        new NativeCompletionJournal(f.owner.work).captureAuthenticatedResponse("KIOSK_08",NativeCompletionJournalTest.request(args),NativeCompletionJournalTest.response(result));
    }
    @Test public void nativeV3UsesCapturedOriginalValuesWithoutBrowserReconstruction()throws Exception {
        var f=prepared(false);String raw=f.owner.work.loadCompletionReceipt(f.receiptKey);var result=inspect(f,List.of());
        assertEquals(1,result.matchedCompletionCount);assertEquals(3,result.completionJoinedRecordCount);assertTrue(result.unresolvedRecordCount>0);
        assertEquals("CAPTURED_NATIVE_ORIGINAL_V3_VALUES",receiptRow(result).get("argument_provenance"));assertEquals(raw,f.owner.work.loadCompletionReceipt(f.receiptKey));
    }
    @Test public void v2MissingValuesRemainExplicitlyUnresolvedNotEmptyOrBackfilled()throws Exception {
        var f=prepared(true);String raw=f.owner.work.loadCompletionReceipt(f.receiptKey);var result=inspect(f,List.of());
        assertEquals(0,result.matchedCompletionCount);assertEquals(0,result.completionJoinedRecordCount);assertEquals("LEGACY_ORIGINAL_VALUES_UNAVAILABLE_RETAINED",receiptRow(result).get("state"));
        assertEquals(raw,f.owner.work.loadCompletionReceipt(f.receiptKey));assertFalse(new JSONObject(raw).has("original_request_body_base64"));
    }
    @Test public void v2ExactCandidateJoinsOriginalNativeSignatureNotBrowserAuthority()throws Exception {
        var f=prepared(true);var result=inspect(f,List.of(f.candidate()));assertEquals(1,result.matchedCompletionCount);assertEquals(0,result.unresolvedCandidateCount);
        assertEquals("BROWSER_ARGUMENTS_MATCH_LEGACY_V2_BINDING_UNAUTHENTICATED_SOURCE",receiptRow(result).get("argument_provenance"));
    }
    @Test public void v3AlsoChecksSuppliedBrowserValuesWithoutIgnoringMismatch()throws Exception {
        var f=prepared(false);f.args.getJSONObject("p_response_json").put("changed","after original receipt");var result=inspect(f,List.of(f.candidate()));
        assertEquals(0,result.matchedCompletionCount);assertEquals(1,result.unresolvedCandidateCount);assertEquals("BROWSER_ARGUMENT_VALUES_MISMATCH_RETAINED",receiptRow(result).get("state"));
    }
    @Test public void identicalDuplicateCandidatesAreNotSilentlyDeduplicated()throws Exception {
        var f=prepared(false);byte[] candidate=f.candidate();var result=inspect(f,List.of(candidate,candidate.clone()));
        assertEquals(0,result.matchedCompletionCount);assertEquals(2,result.unresolvedCandidateCount);assertEquals("AMBIGUOUS_BROWSER_ARGUMENT_ROWS_RETAINED",receiptRow(result).get("state"));
    }
    @Test public void orphanForeignAndMalformedCandidatesStayRepresented()throws Exception {
        var f=prepared(false);byte[] other=new JSONObject(f.args.toString()).put("p_device_id","OTHER").toString().getBytes(StandardCharsets.UTF_8);
        byte[] orphan=new JSONObject(f.args.toString()).put("p_client_completion_id",NativeSeparationContextTest.id(79)).toString().getBytes(StandardCharsets.UTF_8);
        var result=inspect(f,List.of(other,orphan,new byte[]{0}));assertEquals(1,result.matchedCompletionCount);assertEquals(3,result.unresolvedCandidateCount);
        assertEquals(3,result.json().getJSONArray("argument_candidates").length());
    }
    @Test public void everyUnknownTypedRawRowAndMalformedReceiptKeyRemainsInCensus()throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);
        f.owner.workDisk.memory.put("authenticated_completion_receipt_sha256:not-a-valid-key","original unreadable ciphertext");
        f.owner.workDisk.memory.put("original-float",Float.intBitsToFloat(0x7fc00001));f.owner.workDisk.memory.put("original-long",17L);f.freeze();
        var result=inspect(f,List.of());assertEquals(1,result.matchedCompletionCount);assertTrue(result.unresolvedRecordCount>=5);
    }
    @Test public void allDistinctNativeCompletionsAreEnumeratedNotCallerSelected()throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);anotherReceipt(f,false);f.freeze();var result=inspect(f,List.of());
        assertEquals(2,result.matchedCompletionCount);assertEquals(6,result.completionJoinedRecordCount);assertTrue(result.unresolvedRecordCount>0);
    }
    @Test public void multipleCompletionsBorrowingOneSessionRemainAmbiguous()throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);anotherReceipt(f,true);f.freeze();var result=inspect(f,List.of());
        assertEquals(0,result.matchedCompletionCount);assertEquals(0,result.completionJoinedRecordCount);
        var rows=result.json().getJSONArray("records");int ambiguous=0;for(int i=0;i<rows.length();i++)if("AMBIGUOUS_SESSION_COMPLETIONS_RETAINED".equals(rows.getJSONObject(i).get("state")))ambiguous++;
        assertEquals(2,ambiguous);
    }
    @Test public void badSignatureCorruptReceiptAndMissingFinishNeverCountAsMatched()throws Exception {
        for(int mode=0;mode<3;mode++){var f=new NativeRetainedCompletionSemanticsTest.Fixture();if(mode==0)f.args.put("p_native_completion_attestation","b".repeat(64));f.record(false);
            if(mode==1)f.owner.workDisk.memory.put(NativeRetainedCompletionSemanticsTest.PREFIX+f.receiptKey,"corrupt native ciphertext");if(mode==2)f.owner.workDisk.memory.remove(f.key(true));
            f.freeze();assertEquals(0,inspect(f,List.of()).matchedCompletionCount);
        }
    }
    @Test public void partialCompletionDoesNotHideAnotherCorruptNativeReceipt()throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);anotherReceipt(f,false);
        String corrupt=f.owner.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)&&!k.endsWith(f.receiptKey)).findFirst().orElseThrow();
        f.owner.workDisk.memory.put(corrupt,"original corrupt record");f.freeze();var result=inspect(f,List.of());assertEquals(1,result.matchedCompletionCount);assertEquals(3,result.completionJoinedRecordCount);
        assertTrue(result.unresolvedRecordCount>=4);
    }
    @Test public void malformedAndUnknownReceiptSchemasRemainUnknownWithoutFallback()throws Exception {
        for(String version:new String[]{"native-server-completion.v1","native-server-completion.v99"}){
            var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);JSONObject receipt=new JSONObject(f.owner.work.loadCompletionReceipt(f.receiptKey));receipt.put("schema_version",version);
            f.owner.work.saveCompletionReceipt(f.receiptKey,receipt.toString());f.freeze();assertEquals(0,inspect(f,List.of(f.candidate())).matchedCompletionCount);
        }
    }
    @Test public void exactTimeRelationsNeverTurnIntoCutoffEligibility()throws Exception {
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.cutoff="2026-09-26T12:20:00.000000Z";f.record(false);f.freeze();var result=inspect(f,List.of());
        assertEquals("BEFORE",receiptRow(result).get("start_cutoff_relation"));assertEquals("EQUAL",receiptRow(result).get("finish_cutoff_relation"));assertFalse(result.cutoffEligible);
    }
    @Test public void missingFreezeAndTamperedOriginalPrincipalRefuseWholeObservation()throws Exception {
        var f=prepared(false);f.owner.workDisk.memory.remove(NativeRetainedWorkCapture.FENCE);denied(f,List.of());
        var other=prepared(false);other.owner.independentReader().value=new JSONObject(other.owner.work.loadPrincipal()).put("assignment_epoch",8).toString();denied(other,List.of());
    }
    @Test public void unboundedNullOrOversizeCandidateCollectionRefusesBeforeDecrypt()throws Exception {
        var f=prepared(false);int reads=f.owner.vaultCipher.reads.size();denied(f,null);
        List<byte[]> missing=new ArrayList<>();missing.add(null);denied(f,missing);
        denied(f,List.of(new byte[RequestPolicy.MAX_REQUEST_BYTES+1]));
        denied(f,java.util.Collections.nCopies(NativeRetainedCompletionCensus.MAX_CANDIDATES+1,new byte[0]));
        int length=RequestPolicy.MAX_REQUEST_BYTES;denied(f,java.util.Collections.nCopies(NativeRetainedCompletionCensus.MAX_TOTAL_BYTES/length+1,new byte[length]));
        assertEquals(reads,f.owner.vaultCipher.reads.size());
    }
    @Test public void modifiedReturnedJsonCannotAlterPrivateResultOrCreateAuthority()throws Exception {
        var f=prepared(false);var result=inspect(f,List.of());JSONObject changed=result.json();changed.put("inventory_acknowledged",true);changed.getJSONArray("records").getJSONObject(0).put("state","accepted");
        assertFalse(result.json().getBoolean("inventory_acknowledged"));assertNotEquals("accepted",result.json().getJSONArray("records").getJSONObject(0).get("state"));
    }
    @Test public void candidateCardinalityIsCapturedOnceAndGrowthStaysBounded()throws Exception {
        int[] sizes={0},gets={0};List<byte[]> changing=new java.util.AbstractList<>(){
            public int size(){return ++sizes[0]==1?1:NativeRetainedCompletionCensus.MAX_CANDIDATES+1;}
            public byte[] get(int index){gets[0]++;return new byte[]{1};}
        };
        NativeRetainedCompletionSemanticsTest.refused(()->NativeRetainedCompletionCensus.copyCandidates(changing));assertEquals(1,gets[0]);
        List<byte[]> negative=new java.util.AbstractList<>(){public int size(){return-1;}public byte[] get(int index){throw new AssertionError("no read");}};
        NativeRetainedCompletionSemanticsTest.refused(()->NativeRetainedCompletionCensus.copyCandidates(negative));
    }
    @Test public void candidateListGrowthDuringFinalValueReadIsDetected()throws Exception {
        byte[] bytes={1,2};boolean[] changed={false};List<byte[]> growing=new java.util.AbstractList<>(){
            public int size(){return changed[0]?2:1;}public byte[] get(int index){changed[0]=true;return bytes;}
        };
        assertFalse(NativeRetainedCompletionCensus.sameCandidates(List.of(bytes.clone()),growing));
    }
    /** Actual existing private store decoder; test-only reflection avoids a
     * new production raw getter or a copied/decryption implementation. */
    static NativeRetainedCompletionSemantics.Decoder selectionDecoder(NativeRetainedCompletionSemanticsTest.Fixture f)throws Exception{
        var method=AndroidOfflineAuthorityTimeStore.class.getDeclaredMethod("decodeRetainedCompletionValue",String.class,Object.class);
        method.setAccessible(true);
        return (key,raw)->{
            try{return (NativeProtectedWorkInventory.Decoded)method.invoke(f.owner.work,key,raw);}
            catch(java.lang.reflect.InvocationTargetException error){
                if(error.getCause() instanceof VaultFailure)throw (VaultFailure)error.getCause();
                throw new VaultFailure(NativeRetainedCompletionCensus.FAILURE,error.getCause());
            }catch(Exception error){throw new VaultFailure(NativeRetainedCompletionCensus.FAILURE,error);}
        };
    }
    interface SelectionHook {void afterDecode(Map<String,Object> raw)throws VaultFailure;}
    static List<byte[]> collectSelection(NativeRetainedCompletionSemanticsTest.Fixture f,SelectionHook hook)throws Exception{
        var before=new HashMap<>(f.owner.workDisk.memory);var durable=new HashMap<>(f.owner.workDisk.durable);
        int commits=f.owner.workDisk.commits,encrypts=f.owner.workCipher.delegate.existingKeyEncryptCalls;
        var proof=NativeSeparationFreeze.restore(f.owner.engine,f.owner.work,f.owner.principal,null);
        Map<String,Object> raw=new HashMap<>(f.owner.work.separationRawSnapshot());raw.remove(NativeRetainedWorkCapture.FENCE);
        char[] secret=f.owner.vaultCipher.decrypt(f.owner.persistence.current().secret);
        var decoder=selectionDecoder(f);
        try{return NativeRetainedCompletionCensus.collectNativeReadArguments(raw,proof,secret,(key,value)->{
            var decoded=decoder.decode(key,value);if(hook!=null)hook.afterDecode(raw);return decoded;
        });}finally{
            VaultValidation.wipe(secret);assertEquals(before,f.owner.workDisk.memory);assertEquals(durable,f.owner.workDisk.durable);
            assertEquals(commits,f.owner.workDisk.commits);assertEquals(encrypts,f.owner.workCipher.delegate.existingKeyEncryptCalls);assertEquals(0,f.owner.opened);f.owner.wiped();
        }
    }
    @Test public void SELECT_v3OwnedArgumentsOrderedWithoutWrites()throws Exception{
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);anotherReceipt(f,false);f.freeze();
        var observation=inspect(f,List.of());var values=collectSelection(f,null);
        try{
            assertEquals(2,values.size());assertEquals(2,observation.matchedCompletionCount);
            var expected=new java.util.TreeMap<String,byte[]>();
            for(String key:new java.util.TreeSet<>(f.owner.workDisk.memory.keySet()))if(key.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)){
                String suffix=key.substring(NativeRetainedCompletionSemanticsTest.PREFIX.length());
                try(var receipt=NativeCompletionJournal.inspectRetainedOriginalRequest("KIOSK_08",suffix,f.owner.work.loadCompletionReceipt(suffix))){
                    expected.put(suffix,receipt.originalArgs().toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int at=0;for(byte[] original:expected.values()){assertArrayEquals(original,values.get(at++));Arrays.fill(original,(byte)0);}
            assertFalse(observation.currentServerReadback);assertFalse(observation.inventoryAcknowledged);assertFalse(observation.keyRemovalAllowed);
        }finally{NativeRetainedCompletionCensus.wipe(values);for(byte[] b:values)for(byte v:b)assertEquals(0,v);}
    }
    @Test public void SELECT_fixedReadOriginalPrincipalOnly()throws Exception{
        var f=fixedFrozen(null);String original=f.owner.work.loadCompletionReceipt(f.receiptKey);var values=collectSelection(f,null);
        try{assertEquals(1,values.size());assertTrue(ProviderWireJson.same(f.args,ProviderWireJson.object(values.get(0),RequestPolicy.MAX_REQUEST_BYTES)));
            assertEquals(original,f.owner.work.loadCompletionReceipt(f.receiptKey));
        }finally{NativeRetainedCompletionCensus.wipe(values);}
        var foreign=fixedFrozen("installation_seal");assertTrue(collectSelection(foreign,null).isEmpty());
    }
    @Test public void SELECT_legacyMalformedDuplicateStayInCensus()throws Exception{
        var legacy=prepared(true);assertTrue(collectSelection(legacy,null).isEmpty());
        var malformed=new NativeRetainedCompletionSemanticsTest.Fixture();malformed.record(false);
        malformed.owner.workDisk.memory.put(NativeRetainedCompletionSemanticsTest.PREFIX+"bad-key","original undecodable ciphertext");malformed.freeze();
        var complete=inspect(malformed,List.of());var known=collectSelection(malformed,null);
        try{assertEquals(1,known.size());assertEquals(1,complete.matchedCompletionCount);assertTrue(complete.unresolvedRecordCount>0);}
        finally{NativeRetainedCompletionCensus.wipe(known);}
        var duplicate=new NativeRetainedCompletionSemanticsTest.Fixture();duplicate.record(false);anotherReceipt(duplicate,true);duplicate.freeze();
        assertTrue(collectSelection(duplicate,null).isEmpty());
    }
    @Test public void SELECT_unreadableSubsetRetainsCensus()throws Exception{
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);anotherReceipt(f,false);
        String key=f.owner.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)).findFirst().orElseThrow();
        f.owner.workDisk.memory.put(key,"original corrupt ciphertext");f.freeze();var observation=inspect(f,List.of());var remaining=collectSelection(f,null);
        try{assertEquals(1,remaining.size());assertEquals(1,observation.matchedCompletionCount);assertTrue(observation.unresolvedRecordCount>0);}
        finally{NativeRetainedCompletionCensus.wipe(remaining);}
        var good=prepared(false);boolean[] changed={false};
        assertTrue(collectSelection(good,raw->{if(!changed[0]){changed[0]=true;throw new VaultFailure("original_decoder_unavailable");}}).isEmpty());
    }
    @Test public void SELECT_rawAndDecoderWithdrawalRefuse()throws Exception{
        var f=prepared(false);NativeRetainedCompletionSemanticsTest.refused(()->collectSelection(f,raw->raw.put("changed-original-row","retained changed bytes")));
        var g=prepared(false);int[] calls={0};NativeRetainedCompletionSemanticsTest.refused(()->collectSelection(g,raw->{
            if(++calls[0]>=5)throw new VaultFailure("decoder_withdrawn_after_census");}));assertTrue(calls[0]>=5);
    }
    @Test public void SELECT_noReceiptListIsNotEmptyWorkProof()throws Exception{
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.owner.workDisk.memory.put("unknown-original-row","unresolved original work");f.freeze();
        var observed=inspect(f,List.of());var values=collectSelection(f,null);
        try{assertTrue(values.isEmpty());assertTrue(observed.unresolvedRecordCount>0);assertFalse(observed.completeNamespaceInventory);
            assertFalse(observed.currentServerReadback);assertFalse(observed.inventoryAcknowledged);assertFalse(observed.keyRemovalAllowed);
        }finally{NativeRetainedCompletionCensus.wipe(values);}
    }
    static NativeSeparationFreeze.InspectionStore racing(NativeRetainedCompletionSemanticsTest.Fixture f,String fault,List<byte[]> caller)throws Exception {
        var principal=fault.equals("principal")?f.owner.independentReader():null;
        return new NativeSeparationFreeze.InspectionStore(){
            public Map<String,?> separationRawSnapshot()throws VaultFailure{return f.owner.work.separationRawSnapshot();}
            public void prepareSeparationProbe(Map<String,?> raw){throw new AssertionError("no write");}
            public void freezeSeparationSnapshot(Map<String,?> raw,NativeSeparationEvidence proof){throw new AssertionError("no freeze");}
            public JSONObject readSeparationSnapshotEvidence(Map<String,?> raw)throws VaultFailure{return f.owner.work.readSeparationSnapshotEvidence(raw);}
            public NativeProtectedWorkInventory inspectSeparationSnapshot(Map<String,?> raw,NativeSeparationEvidence proof){throw new AssertionError("not discovery-only getter");}
            public NativeRetainedCompletionCensus.Observation inspectRetainedCompletionCensus(Map<String,?> raw,NativeSeparationEvidence proof,List<byte[]> bytes,char[] credential)throws VaultFailure{
                var result=f.owner.work.inspectRetainedCompletionCensus(raw,proof,bytes,credential);
                try{if(fault.equals("vault"))f.owner.bumpVault();if(fault.equals("principal"))principal.value=new JSONObject(principal.value).put("assignment_epoch",8).toString();
                    if(fault.equals("raw"))f.owner.workDisk.memory.put("unknown-original-work","changed during census");
                    if(fault.equals("caller"))caller.get(0)[0]=0;if(fault.equals("copy"))bytes.get(0)[0]=0;
                    if(fault.equals("list"))caller.add(f.candidate());
                }catch(Exception error){throw new VaultFailure(NativeRetainedCompletionCensus.FAILURE,error);}return result;
            }
        };
    }
    @Test public void originalVaultPrincipalAndRawRacesRefuseWholeCensus()throws Exception {
        for(String fault:new String[]{"vault","principal","raw"}){var f=prepared(false);List<byte[]> values=new ArrayList<>(List.of(f.candidate()));var store=racing(f,fault,values);int commits=f.owner.workDisk.commits;
            NativeRetainedCompletionSemanticsTest.refused(()->NativeSeparationFreeze.inspectOriginalCompletionCensus(f.owner.engine,store,f.owner.principal,null,values));
            assertEquals(commits,f.owner.workDisk.commits);assertEquals(0,f.owner.opened);f.owner.wiped();
        }
    }
    @Test public void originalAndDecoderCandidateMutationOrListChangeRefusesWholeCensus()throws Exception {
        for(String fault:new String[]{"caller","copy","list"}){var f=prepared(false);List<byte[]> values=new ArrayList<>(List.of(f.candidate()));var store=racing(f,fault,values);int commits=f.owner.workDisk.commits;
            NativeRetainedCompletionSemanticsTest.refused(()->NativeSeparationFreeze.inspectOriginalCompletionCensus(f.owner.engine,store,f.owner.principal,null,values));
            assertEquals(commits,f.owner.workDisk.commits);assertEquals(0,f.owner.opened);f.owner.wiped();
        }
    }

    interface GroupHook {void afterDecode(Map<String,Object> raw,char[] credential,String key)throws VaultFailure;}
    static List<NativeRetainedCompletionCensus.NativeReadGroup> groups(
        NativeRetainedCompletionSemanticsTest.Fixture f,GroupHook hook)throws Exception{
        var before=new HashMap<>(f.owner.workDisk.memory);var durable=new HashMap<>(f.owner.workDisk.durable);
        int commits=f.owner.workDisk.commits,encrypts=f.owner.workCipher.delegate.existingKeyEncryptCalls;
        var proof=NativeSeparationFreeze.restore(f.owner.engine,f.owner.work,f.owner.principal,null);
        Map<String,Object> raw=new HashMap<>(f.owner.work.separationRawSnapshot());raw.remove(NativeRetainedWorkCapture.FENCE);
        char[] secret=f.owner.vaultCipher.decrypt(f.owner.persistence.current().secret);var decoder=selectionDecoder(f);
        try{return NativeRetainedCompletionCensus.collectNativeReadGroups(raw,proof,secret,(key,value)->{
            var decoded=decoder.decode(key,value);if(hook!=null)hook.afterDecode(raw,secret,key);return decoded;
        });}finally{
            VaultValidation.wipe(secret);assertEquals(before,f.owner.workDisk.memory);assertEquals(durable,f.owner.workDisk.durable);
            assertEquals(commits,f.owner.workDisk.commits);assertEquals(encrypts,f.owner.workCipher.delegate.existingKeyEncryptCalls);
            assertEquals(0,f.owner.opened);f.owner.wiped();
        }
    }
    static String groupRawIdentity(NativeRetainedCompletionSemanticsTest.Fixture f,String key)throws Exception{
        Map<String,Object> raw=new HashMap<>(f.owner.work.separationRawSnapshot());raw.remove(NativeRetainedWorkCapture.FENCE);
        var rows=NativeProtectedWorkSnapshot.capture(raw).recordRows();int index=0;
        for(String current:new java.util.TreeSet<>(raw.keySet())){
            var row=rows.getJSONArray(index++);if(current.equals(key))return NativeProviderPrincipal.hash(row.toString());
        }
        throw new AssertionError("original raw row missing");
    }
    static void closeGroups(List<NativeRetainedCompletionCensus.NativeReadGroup> groups){for(var group:groups)group.close();}
    @Test public void GROUP_v3ExactKeysDetachedBytesAndClose()throws Exception{
        var f=prepared(false);var before=new HashMap<>(f.owner.workDisk.memory);var selected=groups(f,null);byte[] first=null,second=null,owned=null;
        try{
            assertEquals(1,selected.size());var group=selected.get(0);
            assertEquals(NativeRetainedCompletionSemanticsTest.PREFIX+f.receiptKey,group.receiptKey);
            assertEquals(f.key(false),group.startKey);assertEquals(f.key(true),group.finishKey);
            assertEquals(groupRawIdentity(f,group.receiptKey),group.receiptRawIdentitySha256);
            assertEquals(groupRawIdentity(f,group.startKey),group.startRawIdentitySha256);
            assertEquals(groupRawIdentity(f,group.finishKey),group.finishRawIdentitySha256);
            var proof=NativeSeparationFreeze.restore(f.owner.engine,f.owner.work,f.owner.principal,null);
            assertEquals(proof.rawSnapshotDigest,group.rawSnapshotSha256);assertEquals(proof.bodySha256,group.signedManifestSha256);
            assertEquals("CAPTURED_NATIVE_ORIGINAL_V3_VALUES",group.argumentProvenance);
            first=group.argumentsCopy();second=group.argumentsCopy();assertNotSame(first,second);assertArrayEquals(first,second);
            assertEquals(NativeRetainedAttempt.hash(first),group.argumentSha256);
            var exact=f.inspect();assertEquals(exact.receiptBindingSha256,group.receiptBindingSha256);
            assertEquals(exact.occurrenceSha256,group.occurrenceSha256);assertEquals(exact.finishSha256,group.finishSha256);
            first[0]^=1;byte[] third=group.argumentsCopy();try{assertArrayEquals(second,third);}finally{Arrays.fill(third,(byte)0);}
            // Test-only inspection of owned memory for wipe, not construction
            // of a group, proof, principal or native capability.
            var field=NativeRetainedCompletionCensus.NativeReadGroup.class.getDeclaredField("arguments");field.setAccessible(true);
            owned=(byte[])field.get(group);assertNotSame(owned,second);group.close();group.close();
            for(byte value:owned)assertEquals(0,value);
            NativeRetainedCompletionSemanticsTest.refused(group::argumentsCopy);
            assertEquals(before,f.owner.workDisk.memory);
        }finally{if(first!=null)Arrays.fill(first,(byte)0);if(second!=null)Arrays.fill(second,(byte)0);closeGroups(selected);}
    }
    @Test public void GROUP_fixedReadPrincipalAndExactCutoff()throws Exception{
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.cutoff="2026-09-26T12:20:00.000000Z";
        captureFixedOriginal(f,null,false);f.freeze();var selected=groups(f,null);
        try{
            assertEquals(1,selected.size());var group=selected.get(0);assertEquals(FIXED_PROVENANCE,group.argumentProvenance);
            assertEquals("BEFORE",group.startCutoffRelation);assertEquals("EQUAL",group.finishCutoffRelation);
            byte[] bytes=group.argumentsCopy();try{assertTrue(ProviderWireJson.same(f.args,ProviderWireJson.object(bytes,RequestPolicy.MAX_REQUEST_BYTES)));}
            finally{Arrays.fill(bytes,(byte)0);}
            var observation=inspect(f,List.of());assertFalse(observation.cutoffEligible);assertFalse(observation.currentServerReadback);
            assertFalse(observation.inventoryAcknowledged);assertFalse(observation.workAccepted);assertFalse(observation.keyRemovalAllowed);assertFalse(observation.phoneReleased);
            JSONObject record=new JSONObject(f.owner.work.loadCompletionReceipt(f.receiptKey));
            assertEquals("UNKNOWN",record.getJSONObject("provenance").get("original_write_wire_state"));assertFalse(record.has("original_request_body_base64"));
        }finally{closeGroups(selected);}
        for(String foreign:new String[]{"employee_id","credential_id","assignment_epoch","installation_seal"}){
            var other=fixedFrozen(foreign);var unresolved=groups(other,null);try{assertTrue(unresolved.isEmpty());assertTrue(inspect(other,List.of()).unresolvedRecordCount>0);}
            finally{closeGroups(unresolved);}
        }
    }
    @Test public void GROUP_legacyDuplicateAndMalformedRetained()throws Exception{
        var legacy=prepared(true);var none=groups(legacy,null);try{assertTrue(none.isEmpty());assertEquals(0,inspect(legacy,List.of()).matchedCompletionCount);}
        finally{closeGroups(none);}
        var duplicate=new NativeRetainedCompletionSemanticsTest.Fixture();duplicate.record(false);anotherReceipt(duplicate,true);duplicate.freeze();
        var ambiguous=groups(duplicate,null);try{assertTrue(ambiguous.isEmpty());assertEquals(0,inspect(duplicate,List.of()).matchedCompletionCount);}
        finally{closeGroups(ambiguous);}
        var partial=new NativeRetainedCompletionSemanticsTest.Fixture();partial.record(false);
        partial.owner.workDisk.memory.put(NativeRetainedCompletionSemanticsTest.PREFIX+"bad-key","retained unreadable original");
        partial.freeze();var retained=groups(partial,null);
        try{assertEquals(1,retained.size());var census=inspect(partial,List.of());assertEquals(1,census.matchedCompletionCount);assertTrue(census.unresolvedRecordCount>0);}
        finally{closeGroups(retained);}
    }
    @Test public void GROUP_sourceCredentialAndCandidateWithdrawalRefuse()throws Exception{
        var changed=prepared(false);
        NativeRetainedCompletionSemanticsTest.refused(()->groups(changed,(raw,credential,key)->raw.put("changed-original","different source")));
        var credentialChanged=prepared(false);boolean[] changedSecret={false};
        NativeRetainedCompletionSemanticsTest.refused(()->groups(credentialChanged,(raw,credential,key)->{
            if(!changedSecret[0]){changedSecret[0]=true;credential[credential.length-1]^=1;}
        }));
        var valueChanged=prepared(false);int[] receiptReads={0};var decoder=selectionDecoder(valueChanged);
        var proof=NativeSeparationFreeze.restore(valueChanged.owner.engine,valueChanged.owner.work,valueChanged.owner.principal,null);
        Map<String,Object> raw=new HashMap<>(valueChanged.owner.work.separationRawSnapshot());raw.remove(NativeRetainedWorkCapture.FENCE);
        char[] secret=valueChanged.owner.vaultCipher.decrypt(valueChanged.owner.persistence.current().secret);
        var before=new HashMap<>(valueChanged.owner.workDisk.memory);
        try{NativeRetainedCompletionSemanticsTest.refused(()->NativeRetainedCompletionCensus.collectNativeReadGroups(raw,proof,secret,(key,value)->{
            var decoded=decoder.decode(key,value);
            if(key.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX)&&++receiptReads[0]>=5)
                return new NativeProtectedWorkInventory.Decoded(new JSONObject().put("receipt","changed decoded original"),decoded.plaintextDigest);
            return decoded;
        }));assertTrue(receiptReads[0]>=5);assertEquals(before,valueChanged.owner.workDisk.memory);}
        finally{VaultValidation.wipe(secret);valueChanged.owner.wiped();}
    }
    @Test public void GROUP_partialSelectionFailureRetainsOriginals()throws Exception{
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();f.record(false);anotherReceipt(f,false);f.freeze();
        var keys=new java.util.TreeSet<String>();for(String key:f.owner.workDisk.memory.keySet())if(key.startsWith(NativeRetainedCompletionSemanticsTest.PREFIX))keys.add(key);
        assertEquals(2,keys.size());String second=keys.last();int[] decoded={0};
        NativeRetainedCompletionSemanticsTest.refused(()->groups(f,(raw,credential,key)->{
            if(key.equals(second)&&++decoded[0]>=3)throw new VaultFailure("group_source_unavailable_after_first_selection");
        }));assertTrue(decoded[0]>=3);
    }
    @Test public void GROUP_legacyArgumentsApiOwnsCopiesOnly()throws Exception{
        var f=prepared(false);var selected=groups(f,null);var copies=collectSelection(f,null);byte[] exact=selected.get(0).argumentsCopy();
        try{
            assertEquals(1,copies.size());assertArrayEquals(exact,copies.get(0));selected.get(0).close();assertArrayEquals(exact,copies.get(0));
            copies.get(0)[0]^=1;assertFalse(Arrays.equals(exact,copies.get(0)));
        }finally{Arrays.fill(exact,(byte)0);NativeRetainedCompletionCensus.wipe(copies);closeGroups(selected);}
    }
}
