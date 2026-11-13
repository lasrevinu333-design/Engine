package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;

/** NEW wire-only synthetic document cases. No manager/native transport, SQL,
 * key, currentness or permission authority is established by these vectors. */
public final class NativeSameOriginalRecoveryPreparationWireTest {
    private static final String TARGET_JSON="{\"operation_id\":\"95000000-0000-4000-8000-000000000001\",\"separation_id\":\"95000000-0000-4000-8000-000000000001\",\"separation_authority_revision\":\"7\",\"canonical_device_pk\":\"95000000-0000-4000-8000-000000000001\",\"canonical_device_id\":\"KIOSK_08\",\"employee_id\":\"95000000-0000-4000-8000-000000000001\",\"credential_id\":\"95000000-0000-4000-8000-000000000001\",\"assignment_epoch\":\"7\",\"original_generation_id\":\"95000000-0000-4000-8000-000000000001\",\"original_credential_secret_key_id\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"principal_digest\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"engine_revision\":\"0\",\"original_wire_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"original_frozen_work_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"capsule_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"record_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"frame_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"plan_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"aad_binding_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"source_capture_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"values_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"semantic_join_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"layout_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}";
    private static final String REQUEST_JSON="{\"schema\":\"custodial.same-original-recovery-approval-request.v1\",\"request_id\":\"95000000-0000-4000-8000-000000000001\",\"challenge_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_challenge_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"expected_preview_sha256\":\"60885d8c9596412e033ca2666a5b3c2294c0f6e19236d163ecdf76713d0d932e\",\"expected_manager_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_manager_credential_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_manager_device_id\":\"manager-fixture\",\"decision\":\"AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION\",\"manager_confirmation\":\"CONFIRM_THIS_SAME_ORIGINAL_ONLY\"}";
    private static final String RECEIPT_JSON="{\"schema\":\"custodial.same-original-recovery-approval-receipt.v1\",\"state\":\"APPROVAL_RECORDED_ONLY\",\"approval_id\":\"95000000-0000-4000-8000-000000000001\",\"original_request\":{\"schema\":\"custodial.same-original-recovery-approval-request.v1\",\"request_id\":\"95000000-0000-4000-8000-000000000001\",\"challenge_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_challenge_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"expected_preview_sha256\":\"60885d8c9596412e033ca2666a5b3c2294c0f6e19236d163ecdf76713d0d932e\",\"expected_manager_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_manager_credential_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_manager_device_id\":\"manager-fixture\",\"decision\":\"AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION\",\"manager_confirmation\":\"CONFIRM_THIS_SAME_ORIGINAL_ONLY\"},\"original_request_sha256\":\"b57ee5ca5b9a0e681ccee67159d8d92a14b3c3d92ee23e066e3c8322106ccb42\",\"issuer\":{\"manager_id\":\"95000000-0000-4000-8000-000000000001\",\"manager_credential_id\":\"95000000-0000-4000-8000-000000000001\",\"manager_device_id\":\"manager-fixture\"},\"challenge_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"preview_sha256\":\"60885d8c9596412e033ca2666a5b3c2294c0f6e19236d163ecdf76713d0d932e\",\"original_target\":{\"operation_id\":\"95000000-0000-4000-8000-000000000001\",\"separation_id\":\"95000000-0000-4000-8000-000000000001\",\"separation_authority_revision\":\"7\",\"canonical_device_pk\":\"95000000-0000-4000-8000-000000000001\",\"canonical_device_id\":\"KIOSK_08\",\"employee_id\":\"95000000-0000-4000-8000-000000000001\",\"credential_id\":\"95000000-0000-4000-8000-000000000001\",\"assignment_epoch\":\"7\",\"original_generation_id\":\"95000000-0000-4000-8000-000000000001\",\"original_credential_secret_key_id\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"principal_digest\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"engine_revision\":\"0\",\"original_wire_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"original_frozen_work_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"capsule_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"record_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"frame_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"plan_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"aad_binding_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"source_capture_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"values_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"semantic_join_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"layout_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"},\"purpose_admission_id\":\"same-original-preparation.v1\",\"issued_at\":\"2026-10-14T00:00:00.000000Z\",\"expires_at\":\"2026-10-14T00:05:00.000000Z\",\"receipt_sha256\":\"4e18ae30733087720666dc4bb1008a7b1afc1f75ad7f425f33038cceb1da0118\",\"retry_safe\":false,\"limits\":{\"inventory_acknowledged\":false,\"work_accepted\":false,\"replay_allowed\":false,\"finalizer_allowed\":false,\"key_removal\":false,\"phone_released\":false}}";
    private static final String TARGET_BYTES="custodial.same-original-recovery-target.v1\n{\"aad_binding_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"assignment_epoch\":\"7\",\"canonical_device_id\":\"KIOSK_08\",\"canonical_device_pk\":\"95000000-0000-4000-8000-000000000001\",\"capsule_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"credential_id\":\"95000000-0000-4000-8000-000000000001\",\"employee_id\":\"95000000-0000-4000-8000-000000000001\",\"engine_revision\":\"0\",\"frame_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"layout_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"operation_id\":\"95000000-0000-4000-8000-000000000001\",\"original_credential_secret_key_id\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"original_frozen_work_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"original_generation_id\":\"95000000-0000-4000-8000-000000000001\",\"original_wire_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"plan_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"principal_digest\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"record_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"semantic_join_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"separation_authority_revision\":\"7\",\"separation_id\":\"95000000-0000-4000-8000-000000000001\",\"source_capture_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"values_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}";
    private static final String REQUEST_BYTES="custodial.same-original-recovery-request.v1\n{\"challenge_id\":\"95000000-0000-4000-8000-000000000001\",\"decision\":\"AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION\",\"expected_challenge_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"expected_manager_credential_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_manager_device_id\":\"manager-fixture\",\"expected_manager_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_preview_sha256\":\"60885d8c9596412e033ca2666a5b3c2294c0f6e19236d163ecdf76713d0d932e\",\"manager_confirmation\":\"CONFIRM_THIS_SAME_ORIGINAL_ONLY\",\"request_id\":\"95000000-0000-4000-8000-000000000001\",\"schema\":\"custodial.same-original-recovery-approval-request.v1\"}";
    private static final String RECEIPT_BYTES="custodial.same-original-recovery-receipt.v1\n{\"approval_id\":\"95000000-0000-4000-8000-000000000001\",\"challenge_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"expires_at\":\"2026-10-14T00:05:00.000000Z\",\"issued_at\":\"2026-10-14T00:00:00.000000Z\",\"issuer\":{\"manager_credential_id\":\"95000000-0000-4000-8000-000000000001\",\"manager_device_id\":\"manager-fixture\",\"manager_id\":\"95000000-0000-4000-8000-000000000001\"},\"limits\":{\"finalizer_allowed\":false,\"inventory_acknowledged\":false,\"key_removal\":false,\"phone_released\":false,\"replay_allowed\":false,\"work_accepted\":false},\"original_request\":{\"challenge_id\":\"95000000-0000-4000-8000-000000000001\",\"decision\":\"AUTHORIZE_SAME_ORIGINAL_RECOVERY_PREPARATION\",\"expected_challenge_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"expected_manager_credential_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_manager_device_id\":\"manager-fixture\",\"expected_manager_id\":\"95000000-0000-4000-8000-000000000001\",\"expected_preview_sha256\":\"60885d8c9596412e033ca2666a5b3c2294c0f6e19236d163ecdf76713d0d932e\",\"manager_confirmation\":\"CONFIRM_THIS_SAME_ORIGINAL_ONLY\",\"request_id\":\"95000000-0000-4000-8000-000000000001\",\"schema\":\"custodial.same-original-recovery-approval-request.v1\"},\"original_request_sha256\":\"b57ee5ca5b9a0e681ccee67159d8d92a14b3c3d92ee23e066e3c8322106ccb42\",\"original_target\":{\"aad_binding_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"assignment_epoch\":\"7\",\"canonical_device_id\":\"KIOSK_08\",\"canonical_device_pk\":\"95000000-0000-4000-8000-000000000001\",\"capsule_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"credential_id\":\"95000000-0000-4000-8000-000000000001\",\"employee_id\":\"95000000-0000-4000-8000-000000000001\",\"engine_revision\":\"0\",\"frame_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"layout_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"operation_id\":\"95000000-0000-4000-8000-000000000001\",\"original_credential_secret_key_id\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"original_frozen_work_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"original_generation_id\":\"95000000-0000-4000-8000-000000000001\",\"original_wire_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"plan_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"principal_digest\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"record_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"semantic_join_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"separation_authority_revision\":\"7\",\"separation_id\":\"95000000-0000-4000-8000-000000000001\",\"source_capture_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"values_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"},\"preview_sha256\":\"60885d8c9596412e033ca2666a5b3c2294c0f6e19236d163ecdf76713d0d932e\",\"purpose_admission_id\":\"same-original-preparation.v1\",\"retry_safe\":false,\"schema\":\"custodial.same-original-recovery-approval-receipt.v1\",\"state\":\"APPROVAL_RECORDED_ONLY\"}";

    private static byte[] raw(String value){return value.getBytes(StandardCharsets.UTF_8);}
    private static byte[] raw(JSONObject value){return raw(value.toString());}
    private interface Checked {void run()throws Exception;}
    private static void refuses(Checked body)throws Exception {
        try{body.run();fail("invalid wire accepted");}
        catch(VaultFailure failure){assertEquals(NativeSameOriginalRecoveryPreparationWire.FAILURE,failure.code);}
    }
    private static JSONObject target()throws Exception{return new JSONObject(TARGET_JSON);}
    private static JSONObject request()throws Exception{return new JSONObject(REQUEST_JSON);}
    private static JSONObject receipt()throws Exception{return new JSONObject(RECEIPT_JSON);}

    public static void main(String[] args)throws Exception {
        if((args.length==1||args.length==2)&&"--browser-original-frame-held-metadata-only".equals(args[0])){
            String[] selected={"FRAME_HOLD_localRowsObservedAndRetainedParity","FRAME_HOLD_absentPartialAndOtherRealmsStayUnbound",
                "FRAME_HOLD_markerMustBeExactRawOriginalText","FRAME_HOLD_epochAndOversizedMetadataPreserveFrame",
                "FRAME_HOLD_otherRowsUtf16AndDetachedDataRemainOriginal","FRAME_HOLD_terminalDamageCannotPublishMetadata"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_original_frame_hold_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_ORIGINAL_BINARY_HELD_METADATA_DATA_ONLY "+name);
            }
            System.out.println("NO_JOURNAL_AEAD_SOURCE_CURRENT_HOLD_MANAGER_NATIVE_OR_ACK_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-hold-fence-only".equals(args[0])){
            String[] selected={"HOLD_FENCE_exactMarkerTupleAndPositiveEpochData",
                "HOLD_FENCE_closedFieldsPurposesAndFalseRights","HOLD_FENCE_expectedTupleTokensAndObservation",
                "HOLD_FENCE_positiveLongEpochCanonicalOnly","HOLD_FENCE_markerExactOriginalBytes",
                "HOLD_FENCE_strictJsonUtf8AndByteBoundary","HOLD_FENCE_ownedCloseAndNoCallerGetters"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_hold_fence_case");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_UNTRUSTED_HOLD_FENCE_DATA_ONLY "+name);
            }
            System.out.println("NO_PLATFORM_LOCK_SOURCE_MANAGER_NATIVE_AUTHORITY_ACK_OR_EFFECT_PROOF");return;
        }
        if((args.length==1||args.length==2)&&"--browser-original-declared-domains-new".equals(args[0])){
            String[] selected={"BROWSER_DOMAINS_emptyDatabasesStoresAndUnknownSessionAreExplicit",
                "BROWSER_DOMAINS_countsBelongToActualBinaryStoresAndRemainImmutable",
                "BROWSER_DOMAINS_badOriginalFrameCannotPublishCatalog"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown domain case");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_DECLARED_REALM_DATA_ONLY "+name);
            }
            System.out.println("NO_BROWSER_PLATFORM_SOURCE_AUTH_CURRENT_SQL_ACK_OR_FINALIZER");return;
        }
        if(args.length==1&&"--browser-existing-held-command-only".equals(args[0])){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(
                NativeSameOriginalRecoveryPreparationWireTest.class,"BROWSER_EXISTING_HELD_exactCommandAndOriginalRecheckRemainBound"));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());
                throw new AssertionError("existing_held_command_refused");
            }
            System.out.println("PASS_NEW_EXISTING_HELD_COMMAND_WIRE_ONLY_NOT_PLATFORM_OR_ACK");return;
        }
        if((args.length==1||args.length==2)&&"--browser-retained-original-values-only".equals(args[0])){
            String[] selected={"BROWSER_RETAINED_allStreamedUnknownForeignRowsWithoutDiagnosticObservation",
                "BROWSER_RETAINED_emptyUnknownSessionAndOldNullObservationRefusal",
                "BROWSER_RETAINED_completeNativePoolMatchesAndDuplicateOriginalsStayUnresolved",
                "BROWSER_RETAINED_savedBytesHeaderTranscriptAndClosedMetadataRefuse",
                "BROWSER_RETAINED_changedBorrowedReferencesBytesAndMetadataNeverPublish"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_retained_original_value_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_RETAINED_ORIGINAL_BINARY_DATA_ONLY "+name);
            }
            System.out.println("NO_JOURNAL_AEAD_PLATFORM_AUTH_OWNER_MANAGER_CUSTODY_OR_ACK_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-whole-native-pool-only".equals(args[0])){
            String[] selected={"BROWSER_NATIVE_POOL_emptyBrowserCandidatesCannotHideActualMatch",
                "BROWSER_NATIVE_POOL_unselectedMismatchDuplicateSuppressesOriginal",
                "BROWSER_NATIVE_POOL_separatePrimarySessionCompletionOperationCollisions",
                "BROWSER_NATIVE_POOL_duplicateNativeTuplesNeverDeduplicate",
                "BROWSER_NATIVE_POOL_explicitEmptyPoolVersusLegacyFiveArguments",
                "BROWSER_NATIVE_POOL_unsupportedOverflowAndOtherRealmStayRetained",
                "BROWSER_NATIVE_POOL_ownedLoansImmutableRowsAndPrivateConstruction"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_whole_native_pool_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_WHOLE_NATIVE_POOL_BINARY_COMPOSITION_DATA_ONLY "+name);
            }
            System.out.println("NO_BROWSER_SOURCE_AUTH_MANAGER_CURRENT_SQL_CUSTODY_OR_ACK_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-primary-payload-join-only".equals(args[0])){
            String[] selected={"BROWSER_PAYLOAD_JOIN_actualBinaryPayloadMatchesExactArgument",
                "BROWSER_PAYLOAD_JOIN_claimedArgumentDoesNotReplaceBinaryPayload","BROWSER_PAYLOAD_JOIN_ambiguousOriginalRemainsUnresolved",
                "BROWSER_PAYLOAD_JOIN_selectedCanonicalCaptureCapRetainsWholeFrame"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_primary_payload_join_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_BINARY_WIRE_PAYLOAD_JOIN_DATA_ONLY "+name);
            }
            System.out.println("NO_PLATFORM_SOURCE_AUTH_CURRENT_SERVER_ACCEPTANCE_CUSTODY_OR_ACK_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-primary-domain-binding-only".equals(args[0])){
            String[] selected={"BROWSER_PRIMARY_foreignCapturedCandidateRefused",
                "BROWSER_PRIMARY_supportedVersionBoundariesRetainCandidates","BROWSER_PRIMARY_nonIdbForeignAndMissingDomainsRefused",
                "BROWSER_PRIMARY_unsupportedOrdinaryRowsRemainRetained","BROWSER_PRIMARY_duplicateAmbiguousSupportedRowsRemainDistinct",
                "BROWSER_ARGUMENTS_binaryCapturedRowIdentityCorrelationDataOnly"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_primary_domain_binding_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_PRIMARY_DOMAIN_BINDING_DATA_ONLY "+name);
            }
            System.out.println("NO_GENUINE_BROWSER_AUTH_PAYLOAD_DERIVATION_CURRENT_SERVER_OR_EFFECT_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-original-argument-binding-only".equals(args[0])){
            String[] selected={"BROWSER_ARGUMENTS_syntheticExtraRowCannotSupplyArgument",
                "BROWSER_ARGUMENTS_capturedMappingsImmutableAndRecheck","BROWSER_ARGUMENTS_binaryCapturedRowIdentityCorrelationDataOnly",
                "BROWSER_ARGUMENTS_invalidAndSwappedOrdinalsHeld","BROWSER_ARGUMENTS_duplicateKeysAndAmbiguousCandidatesRetained",
                "BROWSER_ARGUMENTS_missingOrMismatchedHashesRefused","BROWSER_ARGUMENTS_ownedLifetimeCopiesAndPrivateConstruction"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_original_argument_binding_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_ORIGINAL_ARGUMENT_SOURCE_ROW_BINDING_DATA_ONLY "+name);
            }
            System.out.println("NO_SOURCE_AUTH_BINARY_CUSTODY_SEMANTIC_ACCEPTANCE_CURRENT_SERVER_OR_ACK_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-original-disposition-entries-only".equals(args[0])){
            String[] selected={"BROWSER_RECORDS_originalBinaryRowsImmutableAndUnresolved",
                "BROWSER_RECORDS_duplicateIdbPrimaryKeysRemainOrdinalRows","BROWSER_RECORDS_emptyAndUnknownSessionRemainDistinct",
                "BROWSER_RECORDS_declaredRowAndFrameMismatchNeverPublishes","BROWSER_RECORDS_changedLoansAndExpectedGraphsNeverPublish",
                "BROWSER_RECORDS_legacyVoidWrapperDelegatesUnchanged"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_original_disposition_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_ORIGINAL_BINARY_RECORD_IDENTITIES_DATA_ONLY "+name);
            }
            System.out.println("NO_SOURCE_AUTH_SEMANTIC_ACCEPTANCE_CUSTODY_ACK_FINALIZER_OR_KEY_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-original-journal-document-only".equals(args[0])){
            String[] selected={"BROWSER_JOURNAL_originalFrameChunksDetachedAndClose",
                "BROWSER_JOURNAL_exactParentPlanBindingAndEntryPins","BROWSER_JOURNAL_closedMetadataFiniteTypesAndEffects",
                "BROWSER_JOURNAL_strictRawJsonCanonicalChunkAndBounds","BROWSER_JOURNAL_changedExpectedGraphsCannotBeAdopted"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_new_journal_document_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failed:result.getFailures())System.err.println(failed.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_BROWSER_JOURNAL_DOCUMENT_DATA_ONLY "+name);
            }
            System.out.println("NO_AEAD_SOURCE_OWNER_CUSTODY_RESTART_ACK_OR_EFFECT_AUTHORITY");return;
        }
        if(args.length==1&&"--browser-original-value-source-fixture-only".equals(args[0])){
            consumeBrowserValueSourceFixture(System.in);
            System.out.println("PASS_ACTUAL_SOURCE_VALUE_FRAME_DATA_ONLY");return;
        }
        if(args.length==2&&"--browser-original-value-parity-new-only".equals(args[0])){
            if(!Arrays.asList("BROWSER_VALUE_rawDepth63TaggedOriginalRemainsComplete",
                "BROWSER_VALUE_sourceFixtureRouteClosedBoundedAndCanonical").contains(args[1]))throw new IllegalArgumentException("unknown_new_parity_member");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failed:result.getFailures())System.err.println(failed.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_VALUE_SOURCE_CONTRACT_ONLY "+args[1]);return;
        }
        if((args.length==1||args.length==2)&&"--browser-original-value-frame-only".equals(args[0])){
            String[] selected={"BROWSER_VALUE_losslessGoldenOpaqueTagsAndSessionDistinction",
                "BROWSER_VALUE_headerBodyTailAndOriginalDigestRefuse","BROWSER_VALUE_orderShapeAndPerRecordCoverageRefuse",
                "BROWSER_VALUE_closedMetadataCountsTypesAndFalseFlags","BROWSER_VALUE_numericComplexityAndTruncatedLengthsRefuse",
                "BROWSER_VALUE_chunkBoundariesDigestOrderAndBorrowedMutation"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_new_value_frame_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failed:result.getFailures())System.err.println(failed.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_UNTRUSTED_BROWSER_VALUE_FRAME_ONLY "+name);
            }
            System.out.println("NO_PLATFORM_SOURCE_NATIVE_CUSTODY_ACK_OR_EFFECT_AUTHORITY");return;
        }
        if(args.length==1&&"--browser-original-data-wire-only".equals(args[0])){
            for(String name:new String[]{"BROWSER_DATA_originalFrameChunksAndDetachedLifetime","BROWSER_DATA_closedOriginalMetadataAndChunkPins",
                "BROWSER_DATA_sizeIndexAndUnknownOutcomesRefuse"}){
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failed:result.getFailures())System.err.println(failed.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_NEW_BROWSER_DATA_WIRE_ONLY "+name);
            }
            System.out.println("NO_ANDROID_CUSTODY_ACK_FINALIZER_OR_SOURCE_AUTHORITY");return;
        }
        if((args.length==1||args.length==2)&&"--browser-original-source-wire-only".equals(args[0])){
            String[] selected={"BROWSER_SOURCE_goldenCaptureRecheckDetachedArguments",
                "BROWSER_SOURCE_closedPinsTypesStatesAndCommands","BROWSER_SOURCE_innerSchemasFalseFlagsAndSessionUnknown",
                "BROWSER_SOURCE_countsOriginalRowsAndArgumentMetadata","BROWSER_SOURCE_canonicalBase64AndExactByteCeilings",
                "BROWSER_SOURCE_rawUtf8ByteLimitNotCharacterLimit","BROWSER_SOURCE_structuralRecheckAndExtraDomainRows",
                "BROWSER_SOURCE_closeWipesOwnedBytesAndRefusesFutureAccess","BROWSER_SOURCE_full4096RecordsNoProviderParserWidening"};
            if(args.length==2&&!Arrays.asList(selected).contains(args[1]))throw new IllegalArgumentException("unknown_new_browser_source_wire_member");
            for(String name:selected){
                if(args.length==2&&!name.equals(args[1]))continue;
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_UNTRUSTED_PRIVATE_BROWSER_SOURCE_WIRE_ONLY "+name);
            }
            System.out.println("NEW_BROWSER_SOURCE_WIRE_SELECTED_ONLY_NO_PLATFORM_SOURCE_AUTH_NATIVE_ACK_OR_EFFECT_AUTHORITY");return;
        }
        if(args.length==1&&"--native-registration-response-only".equals(args[0])){
            for(String name:new String[]{"NATIVE_REGISTRATION_goldenOriginalTranscriptDetachedUntrustedOnly",
                "NATIVE_REGISTRATION_closedWrapperRefusesErrorsAndOtherFields",
                "NATIVE_REGISTRATION_closedReceiptStateIdsAndEffects",
                "NATIVE_REGISTRATION_originalPinsAndTranscriptCannotSubstitute",
                "NATIVE_REGISTRATION_registrationWindowInclusiveMicroBounds",
                "NATIVE_REGISTRATION_bothExpiryCeilingsAndFiniteCivilTimes",
                "NATIVE_REGISTRATION_originalTimestampExactMillisecondsOnly",
                "NATIVE_REGISTRATION_strictDuplicateUtf8AndParserShapes",
                "NATIVE_REGISTRATION_exactReceiptAndWrapperByteCaps",
                "NATIVE_REGISTRATION_rawPreservationOnRefusalAndNoAuthorityAPI"}){
                var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
                if(result.getRunCount()!=1||!result.wasSuccessful()){
                    for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
                }
                System.out.println("PASS_UNTRUSTED_REGISTRATION_REPRESENTATION_ONLY "+name);
            }
            System.out.println("NEW_NATIVE_REGISTRATION_10_ONLY_NO_AUTH_CURRENTNESS_SQL_TRANSPORT_OR_EFFECT_AUTHORITY");return;
        }
        if(args.length!=1||!"--wire-only".equals(args[0]))throw new IllegalArgumentException("new_wire_only_selector_required");
        for(String name:new String[]{"WIRE_nodeGoldenTargetRequestAndReceipt","WIRE_fieldOrderAndEscapedASCIIHaveDigestParity",
            "WIRE_duplicateAndEscapedDuplicateKeysRefuse","WIRE_fatalUtf8BomAndTrailingInputRefuse",
            "WIRE_targetTypesUUIDsHashesAndDecimalPrecision","WIRE_requestPurposeAndClosedFieldsRefuse",
            "WIRE_receiptIssuerAndRequestPinsRefuse","WIRE_expiryMicrosecondsAndCeilingRemainExact",
            "WIRE_falseEffectsAndAdmissionCannotWiden","WIRE_changedDigestAndForeignExpectedOriginalRefuse",
            "WIRE_detachedGraphsAndCallerBytesCannotChangeParsedData","WIRE_boundsAndParserShapesFailClosed"}){
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(NativeSameOriginalRecoveryPreparationWireTest.class,name));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(name);
            }
            System.out.println("PASS_REPRESENTATION_ONLY "+name);
        }
        System.out.println("NEW_WIRE_12_ONLY_NO_AUTH_TRANSPORT_SQL_OR_EFFECT_AUTHORITY");
    }

    @Test public void WIRE_nodeGoldenTargetRequestAndReceipt()throws Exception {
        var t=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(TARGET_JSON));
        var r=NativeSameOriginalRecoveryPreparationWire.decodeRequest(raw(REQUEST_JSON));
        var p=NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(RECEIPT_JSON),t,r);
        assertEquals("19ed562f98c35c7bd9f5e140a891e884ffd8b4a5e14b0f3343b8e1c83273b68a",t.documentSha256());
        assertEquals("b57ee5ca5b9a0e681ccee67159d8d92a14b3c3d92ee23e066e3c8322106ccb42",r.documentSha256());
        assertEquals("4e18ae30733087720666dc4bb1008a7b1afc1f75ad7f425f33038cceb1da0118",p.documentSha256());
        assertArrayEquals(raw(TARGET_BYTES),t.documentBytes());assertArrayEquals(raw(REQUEST_BYTES),r.documentBytes());
        assertArrayEquals(raw(RECEIPT_BYTES),p.documentBytes());
        assertTrue(ProviderWireJson.same(target(),p.originalTarget().json()));
        assertTrue(ProviderWireJson.same(request(),p.originalRequest().json()));
        assertEquals("APPROVAL_RECORDED_ONLY",p.json().getString("state"));
    }
    @Test public void WIRE_fieldOrderAndEscapedASCIIHaveDigestParity()throws Exception {
        JSONObject reversed=new JSONObject();var t=target();var names=new java.util.ArrayList<String>();
        for(var it=t.keys();it.hasNext();)names.add(it.next());java.util.Collections.reverse(names);
        for(String name:names)reversed.put(name,t.get(name));
        var parsed=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(reversed));
        assertArrayEquals(raw(TARGET_BYTES),parsed.documentBytes());
        String escaped=TARGET_JSON.replace("operation_id","\\"+"u006fperation_id").replace("KIOSK_08","KIOSK_"+"\\"+"u00308");
        assertEquals(parsed.documentSha256(),NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(escaped)).documentSha256());
    }
    @Test public void WIRE_duplicateAndEscapedDuplicateKeysRefuse()throws Exception {
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw("{\"operation_id\":\"95000000-0000-4000-8000-000000000001\","+TARGET_JSON.substring(1))));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw("{\""+"\\"+"u006fperation_id\":\"95000000-0000-4000-8000-000000000001\","+TARGET_JSON.substring(1))));
        String nested=RECEIPT_JSON.replace("\"issuer\":{","\"issuer\":{\"manager_id\":\"95000000-0000-4000-8000-000000000001\",");
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(nested)));
    }
    @Test public void WIRE_fatalUtf8BomAndTrailingInputRefuse()throws Exception {
        byte[] original=raw(TARGET_JSON),before=original.clone(),bad=original.clone();bad[10]=(byte)0xff;
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(bad));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw("\ufeff"+TARGET_JSON)));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(TARGET_JSON+" {}")));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeRequest(raw(REQUEST_JSON.replace("manager-fixture","\\"+"ud800"))));
        assertArrayEquals(before,original);
    }
    @Test public void WIRE_targetTypesUUIDsHashesAndDecimalPrecision()throws Exception {
        JSONObject t=target();t.put("assignment_epoch","9007199254740991").put("engine_revision","9007199254740991");
        assertEquals("9007199254740991",NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(t)).json().get("assignment_epoch"));
        for(Object value:new Object[]{7,7L,7.0,true,JSONObject.NULL,"0","01","+7","7.0","9007199254740992"}){
            JSONObject bad=target().put("assignment_epoch",value);refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(bad)));
        }
        for(String value:new String[]{"KIOSK_01","KIOSK_11","kiosk_08"}){
            JSONObject bad=target().put("canonical_device_id",value);refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(bad)));
        }
        for(String value:new String[]{"95000000-0000-0000-8000-000000000001","95000000-0000-4000-7000-000000000001","ABC00000-0000-4000-8000-000000000001"}){
            JSONObject bad=target().put("operation_id",value);refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(bad)));
        }
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(target().put("values_sha256","A".repeat(64)))));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(target().put("extra","original"))));
    }
    @Test public void WIRE_requestPurposeAndClosedFieldsRefuse()throws Exception {
        for(JSONObject bad:new JSONObject[]{request().put("decision","REMOVE"),request().put("manager_confirmation",true),
            request().put("expected_manager_device_id","role/admin"),request().put("schema","foreign.v1"),request().put("retry_safe",true)}){
            refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeRequest(raw(bad)));
        }
        JSONObject missing=request();missing.remove("expected_manager_credential_id");refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeRequest(raw(missing)));
    }
    @Test public void WIRE_receiptIssuerAndRequestPinsRefuse()throws Exception {
        JSONObject r=receipt();r.getJSONObject("issuer").put("manager_device_id","successor");
        final JSONObject changedDevice=r;refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(changedDevice)));
        r=receipt();r.getJSONObject("issuer").put("manager_id","95000000-0000-4000-8000-000000000099");
        final JSONObject changed=r;refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(changed)));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(receipt().put("challenge_sha256","b".repeat(64)))));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(receipt().put("preview_sha256","b".repeat(64)))));
        r=receipt();r.getJSONObject("issuer").put("security_admin",true);
        final JSONObject roleFlag=r;refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(roleFlag)));
    }
    @Test public void WIRE_expiryMicrosecondsAndCeilingRemainExact()throws Exception {
        assertEquals(1L,NativeSameOriginalRecoveryPreparationWire.instantMicros("2024-02-29T00:00:00.000001Z")
            -NativeSameOriginalRecoveryPreparationWire.instantMicros("2024-02-29T00:00:00.000000Z"));
        assertEquals(0L,NativeSameOriginalRecoveryPreparationWire.instantMicros("0001-01-01T00:00:00.000000Z"));
        assertEquals(315537897599999999L,NativeSameOriginalRecoveryPreparationWire.instantMicros("9999-12-31T23:59:59.999999Z"));
        for(String time:new String[]{"0000-01-01T00:00:00.000000Z","2026-02-29T00:00:00.000000Z","2026-10-14T00:00:60.000000Z",
            "2026-10-14T00:00:00.000Z","2026-10-14T00:00:00.000000+00:00","2026-10-14T24:00:00.000000Z"}){
            refuses(()->NativeSameOriginalRecoveryPreparationWire.instantMicros(time));
        }
        for(String time:new String[]{"2026-10-14T00:00:00.000000Z","2026-10-13T23:59:59.999999Z","2026-10-14T00:05:00.000001Z"}){
            refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(receipt().put("expires_at",time))));
        }
        assertEquals("2026-10-14T00:05:00.000000Z",NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(RECEIPT_JSON)).json().get("expires_at"));
        // Representation acceptance is deliberately independent of the local current date.
    }
    @Test public void WIRE_falseEffectsAndAdmissionCannotWiden()throws Exception {
        for(String key:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"}){
            JSONObject r=receipt();r.getJSONObject("limits").put(key,true);refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(r)));
        }
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(receipt().put("retry_safe",true))));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(receipt().put("purpose_admission_id","remove.v1"))));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(receipt().put("state","APPROVED_FOR_EFFECTS"))));
    }
    @Test public void WIRE_changedDigestAndForeignExpectedOriginalRefuse()throws Exception {
        for(String key:new String[]{"receipt_sha256","original_request_sha256"}){
            refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(receipt().put(key,"b".repeat(64)))));
        }
        var foreignTarget=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(target().put("engine_revision","1")));
        var originalRequest=NativeSameOriginalRecoveryPreparationWire.decodeRequest(raw(REQUEST_JSON));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(RECEIPT_JSON),foreignTarget,originalRequest));
        var originalTarget=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(TARGET_JSON));
        var foreignRequest=NativeSameOriginalRecoveryPreparationWire.decodeRequest(raw(request().put("request_id","95000000-0000-4000-8000-000000000099")));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(RECEIPT_JSON),originalTarget,foreignRequest));
    }
    @Test public void WIRE_detachedGraphsAndCallerBytesCannotChangeParsedData()throws Exception {
        byte[] original=raw(RECEIPT_JSON);var parsed=NativeSameOriginalRecoveryPreparationWire.decodeReceipt(original);Arrays.fill(original,(byte)0);
        JSONObject graph=parsed.json();graph.getJSONObject("original_target").put("engine_revision","9");graph.getJSONObject("limits").put("key_removal",true);
        byte[] document=parsed.documentBytes();Arrays.fill(document,(byte)0);
        assertArrayEquals(raw(RECEIPT_BYTES),parsed.documentBytes());
        assertEquals("0",parsed.originalTarget().json().get("engine_revision"));
        assertFalse(parsed.json().getJSONObject("limits").getBoolean("key_removal"));
        assertTrue(ProviderWireJson.same(receipt(),parsed.json()));
    }
    @Test public void WIRE_boundsAndParserShapesFailClosed()throws Exception {
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(null));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(new byte[0]));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(new byte[65537]));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeRequest(new byte[8193]));
        for(String input:new String[]{"[]","null","true","{'operation_id':'x'}","{\"original_target\":[],}"}){
            refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(input)));
        }
        var t=NativeSameOriginalRecoveryPreparationWire.decodeTarget(raw(TARGET_JSON));
        refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeReceipt(raw(RECEIPT_JSON),t,null));
    }

    private static final String NATIVE_INTENT="95000000-0000-4000-8000-000000000021";
    private static final String NATIVE_RECORD="a".repeat(64),NATIVE_BODY="b".repeat(64),NATIVE_ATTESTATION="c".repeat(64),NATIVE_TARGET="d".repeat(64);
    private static final String NATIVE_REQUEST_TIME="2026-10-14T00:00:00.123Z";
    private static final String NATIVE_GOLDEN_SHA="1ae72cf968938c7c753f0a2c87101da912c5c764b45caa99a49b42930d1d83b9";
    private static JSONObject nativeRegistration()throws Exception {
        JSONObject value=new JSONObject().put("schema","custodial.same-original-recovery-native-challenge-receipt.v1")
            .put("state","ORIGINAL_CHALLENGE_RECORDED_PREPARATION_ONLY").put("challenge_id",NATIVE_INTENT)
            .put("challenge_sha256",NATIVE_GOLDEN_SHA).put("original_target_sha256",NATIVE_TARGET)
            .put("native_challenge_intent_id",NATIVE_INTENT).put("native_challenge_intent_record_sha256",NATIVE_RECORD)
            .put("registered_at","2026-10-14T00:00:10.123000Z").put("expires_at","2026-10-14T00:04:00.123000Z")
            .put("retry_safe",false);
        JSONObject limits=new JSONObject();for(String key:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})limits.put(key,false);
        return value.put("limits",limits);
    }
    private static String nativeDigest(JSONObject value)throws Exception {
        // Independent synthetic SQL273 transcript vector, never authentication.
        String transcript="custodial.same-original-native-challenge-binding.v1\n"+NATIVE_INTENT+'\n'+NATIVE_BODY+'\n'
            +NATIVE_ATTESTATION+'\n'+NATIVE_RECORD+'\n'+NATIVE_TARGET+'\n'+value.getString("registered_at")+'\n'+value.getString("expires_at");
        byte[] input=raw(transcript),hash=java.security.MessageDigest.getInstance("SHA-256").digest(input);
        try{var out=new StringBuilder(64);for(byte b:hash){out.append(Character.forDigit((b>>>4)&15,16));out.append(Character.forDigit(b&15,16));}return out.toString();}
        finally{Arrays.fill(input,(byte)0);Arrays.fill(hash,(byte)0);}
    }
    private static JSONObject nativeTimes(String registered,String expires)throws Exception {
        JSONObject value=nativeRegistration().put("registered_at",registered).put("expires_at",expires);
        return value.put("challenge_sha256",nativeDigest(value));
    }
    private static byte[] nativeResponse(JSONObject value)throws Exception{return raw(new JSONObject().put("ok",true).put("data",value));}
    private static NativeSameOriginalRecoveryPreparationWire.UntrustedNativeRegistrationReceipt nativeDecode(byte[] bytes)throws Exception {
        return NativeSameOriginalRecoveryPreparationWire.decodeNativeRegistrationResponse(bytes,NATIVE_INTENT,NATIVE_RECORD,NATIVE_TARGET,NATIVE_BODY,NATIVE_ATTESTATION,NATIVE_REQUEST_TIME);
    }
    private static void nativeRefuses(byte[] bytes)throws Exception{refuses(()->nativeDecode(bytes));}

    @Test public void NATIVE_REGISTRATION_goldenOriginalTranscriptDetachedUntrustedOnly()throws Exception {
        JSONObject value=nativeRegistration();assertEquals(NATIVE_GOLDEN_SHA,nativeDigest(value));
        byte[] bytes=nativeResponse(value),before=bytes.clone();var parsed=nativeDecode(bytes);
        assertArrayEquals(before,bytes);assertTrue(ProviderWireJson.same(value,parsed.json()));
        JSONObject detached=parsed.json();detached.put("state","APPROVED").put("new_authority",true);
        detached.getJSONObject("limits").put("key_removal",true);Arrays.fill(bytes,(byte)0);
        assertTrue(ProviderWireJson.same(value,parsed.json()));assertFalse(parsed.json().getJSONObject("limits").getBoolean("key_removal"));
        assertEquals(11,parsed.json().length());
    }
    @Test public void NATIVE_REGISTRATION_closedWrapperRefusesErrorsAndOtherFields()throws Exception {
        for(Object ok:new Object[]{false,"true",1,JSONObject.NULL})nativeRefuses(raw(new JSONObject().put("ok",ok).put("data",nativeRegistration())));
        for(String key:new String[]{"error","approved","current","schema"})nativeRefuses(raw(new JSONObject().put("ok",true).put("data",nativeRegistration()).put(key,"caller")));
        nativeRefuses(raw(new JSONObject().put("data",nativeRegistration())));
        nativeRefuses(raw(new JSONObject().put("ok",true)));nativeRefuses(raw(new JSONObject().put("ok",true).put("data",JSONObject.NULL)));
        nativeRefuses(raw(nativeRegistration()));
    }
    @Test public void NATIVE_REGISTRATION_closedReceiptStateIdsAndEffects()throws Exception {
        for(String key:new String[]{"schema","state"})nativeRefuses(nativeResponse(nativeRegistration().put(key,"foreign")));
        for(String key:new String[]{"challenge_id","native_challenge_intent_id"}){
            nativeRefuses(nativeResponse(nativeRegistration().put(key,"95000000-0000-4000-8000-000000000022")));
            nativeRefuses(nativeResponse(nativeRegistration().put(key,NATIVE_INTENT.toUpperCase().replace("4000","400A"))));
        }
        for(Object retry:new Object[]{true,"false",0,JSONObject.NULL})nativeRefuses(nativeResponse(nativeRegistration().put("retry_safe",retry)));
        JSONObject v=nativeRegistration();v.remove("registered_at");nativeRefuses(nativeResponse(v));
        nativeRefuses(nativeResponse(nativeRegistration().put("caller_authority",false)));
        for(String key:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"}){
            v=nativeRegistration();v.getJSONObject("limits").put(key,true);nativeRefuses(nativeResponse(v));
            v=nativeRegistration();v.getJSONObject("limits").put(key,"false");nativeRefuses(nativeResponse(v));
            v=nativeRegistration();v.getJSONObject("limits").remove(key);nativeRefuses(nativeResponse(v));
        }
        v=nativeRegistration();v.getJSONObject("limits").put("native_grant",false);nativeRefuses(nativeResponse(v));
    }
    @Test public void NATIVE_REGISTRATION_originalPinsAndTranscriptCannotSubstitute()throws Exception {
        byte[] bytes=nativeResponse(nativeRegistration());String[] pins={NATIVE_INTENT,NATIVE_RECORD,NATIVE_TARGET,NATIVE_BODY,NATIVE_ATTESTATION};
        for(int i=0;i<pins.length;i++){String[] changed=pins.clone();changed[i]=i==0?"95000000-0000-4000-8000-000000000022":"e".repeat(64);
            refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeNativeRegistrationResponse(bytes,changed[0],changed[1],changed[2],changed[3],changed[4],NATIVE_REQUEST_TIME));
            String[] absent=pins.clone();absent[i]=null;
            refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeNativeRegistrationResponse(bytes,absent[0],absent[1],absent[2],absent[3],absent[4],NATIVE_REQUEST_TIME));
        }
        for(String key:new String[]{"challenge_sha256","original_target_sha256","native_challenge_intent_record_sha256"}){
            nativeRefuses(nativeResponse(nativeRegistration().put(key,"e".repeat(64))));
            nativeRefuses(nativeResponse(nativeRegistration().put(key,"A".repeat(64))));
        }
        String withNewline="custodial.same-original-native-challenge-binding.v1\n"+NATIVE_INTENT+'\n'+NATIVE_BODY+'\n'+NATIVE_ATTESTATION+'\n'+NATIVE_RECORD+'\n'+NATIVE_TARGET+"\n2026-10-14T00:00:10.123000Z\n2026-10-14T00:04:00.123000Z\n";
        var wrong=new StringBuilder();for(byte b:java.security.MessageDigest.getInstance("SHA-256").digest(raw(withNewline)))wrong.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        nativeRefuses(nativeResponse(nativeRegistration().put("challenge_sha256",wrong.toString())));
    }
    @Test public void NATIVE_REGISTRATION_registrationWindowInclusiveMicroBounds()throws Exception {
        nativeDecode(nativeResponse(nativeTimes("2026-10-13T23:59:30.123000Z","2026-10-14T00:04:30.123000Z")));
        nativeDecode(nativeResponse(nativeTimes("2026-10-14T00:02:00.123000Z","2026-10-14T00:05:00.123000Z")));
        nativeRefuses(nativeResponse(nativeTimes("2026-10-13T23:59:30.122999Z","2026-10-14T00:04:30.123000Z")));
        nativeRefuses(nativeResponse(nativeTimes("2026-10-14T00:02:00.123001Z","2026-10-14T00:05:00.123000Z")));
    }
    @Test public void NATIVE_REGISTRATION_bothExpiryCeilingsAndFiniteCivilTimes()throws Exception {
        nativeDecode(nativeResponse(nativeTimes("2026-10-14T00:00:00.123000Z","2026-10-14T00:05:00.123000Z")));
        nativeDecode(nativeResponse(nativeTimes("2026-10-14T00:00:10.123000Z","2026-10-14T00:00:10.123001Z")));
        for(JSONObject value:new JSONObject[]{nativeTimes("2026-10-14T00:00:10.123000Z","2026-10-14T00:00:10.123000Z"),
            nativeTimes("2026-10-14T00:00:10.123000Z","2026-10-14T00:00:10.122999Z"),
            nativeTimes("2026-10-13T23:59:30.123000Z","2026-10-14T00:04:30.123001Z"),
            nativeTimes("2026-10-14T00:00:10.123000Z","2026-10-14T00:05:00.123001Z")})nativeRefuses(nativeResponse(value));
        for(String key:new String[]{"registered_at","expires_at"})for(String time:new String[]{"2026-02-29T00:00:00.123000Z","0000-01-01T00:00:00.000000Z","2026-10-14T24:00:00.123000Z","2026-10-14T00:00:60.123000Z","2026-10-14T00:00:10.123Z","2026-10-14T00:00:10.123000+00:00"})
            nativeRefuses(nativeResponse(nativeRegistration().put(key,time)));
    }
    @Test public void NATIVE_REGISTRATION_originalTimestampExactMillisecondsOnly()throws Exception {
        byte[] bytes=nativeResponse(nativeRegistration());
        for(String time:new String[]{null,"","2026-10-14T00:00:00.123000Z","2026-10-14T00:00:00Z","2026-10-14T00:00:00.123+00:00"," 2026-10-14T00:00:00.123Z","2026-02-29T00:00:00.123Z","0000-01-01T00:00:00.000Z","2026-10-14T00:10:00.123Z"})
            refuses(()->NativeSameOriginalRecoveryPreparationWire.decodeNativeRegistrationResponse(bytes,NATIVE_INTENT,NATIVE_RECORD,NATIVE_TARGET,NATIVE_BODY,NATIVE_ATTESTATION,time));
    }
    @Test public void NATIVE_REGISTRATION_strictDuplicateUtf8AndParserShapes()throws Exception {
        String response=new String(nativeResponse(nativeRegistration()),StandardCharsets.UTF_8),duplicate=response.replace("\"data\":{","\"data\":{\"challenge_id\":\""+NATIVE_INTENT+"\",");
        nativeRefuses(raw(duplicate));nativeRefuses(raw(duplicate.replaceFirst("challenge_id","\\\\u0063hallenge_id")));
        nativeRefuses(raw("{\"ok\":true,"+response.substring(1)));
        nativeRefuses(raw(response.replace("\"limits\":{","\"limits\":{\"key_removal\":false,")));
        byte[] invalid=raw(response);invalid[1]=(byte)0xff;nativeRefuses(invalid);
        for(String value:new String[]{"\ufeff"+response,response+"{}","[]","null","{\"ok\":true,\"data\":[]}","{'ok':true}",response.replace(NATIVE_INTENT,"\\ud800")})nativeRefuses(raw(value));
    }
    @Test public void NATIVE_REGISTRATION_exactReceiptAndWrapperByteCaps()throws Exception {
        String data=nativeRegistration().toString();int cap=NativeSameOriginalRecoveryPreparationWire.MAX_NATIVE_REGISTRATION_RECEIPT_BYTES;
        String at="{"+" ".repeat(cap-raw(data).length)+data.substring(1),response="{\"ok\":true,\"data\":"+at+"}";
        assertEquals(cap,raw(at).length);nativeDecode(raw(response));
        nativeRefuses(raw("{\"ok\":true,\"data\":{ "+at.substring(1)+"}"));
        int wrapperCap=NativeSameOriginalRecoveryPreparationWire.MAX_NATIVE_REGISTRATION_RESPONSE_BYTES;
        String full="{"+" ".repeat(wrapperCap-raw(response).length)+response.substring(1);
        assertEquals(wrapperCap,raw(full).length);nativeDecode(raw(full));nativeRefuses(raw(full+" "));
        nativeRefuses(null);nativeRefuses(new byte[0]);nativeRefuses(new byte[wrapperCap+1]);
    }
    @Test public void NATIVE_REGISTRATION_rawPreservationOnRefusalAndNoAuthorityAPI()throws Exception {
        byte[] bytes=nativeResponse(nativeRegistration().put("retry_safe",true)),before=bytes.clone();nativeRefuses(bytes);assertArrayEquals(before,bytes);
        var type=NativeSameOriginalRecoveryPreparationWire.UntrustedNativeRegistrationReceipt.class;
        assertTrue(java.lang.reflect.Modifier.isFinal(type.getModifiers()));
        assertEquals(1,type.getDeclaredMethods().length);assertEquals("json",type.getDeclaredMethods()[0].getName());
        for(var ctor:type.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(ctor.getModifiers()));
        assertEquals(65536,NativeSameOriginalRecoveryPreparationWire.MAX_DOCUMENT_BYTES);assertEquals(8192,NativeSameOriginalRecoveryPreparationWire.MAX_REQUEST_BYTES);
    }

    // Data-only PRIVATE compiled-source vectors, built from the actual
    // protected-browser-inventory.js observation/census fields. NOT a browser,
    // source-stamp, current control, actor, native, SQL or permission fixture.
    private static final String BROWSER_REPLY_TOKEN="a".repeat(64),BROWSER_REQUEST="b".repeat(64),BROWSER_PHASE="c".repeat(64);
    private static JSONObject browserBinding()throws Exception {
        return new JSONObject().put("operation_id","95000000-0000-4000-8000-000000000031")
            .put("frame_sha256","d".repeat(64)).put("original_generation_id","95000000-0000-4000-8000-000000000032")
            .put("native_mutation_stamp","SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY");
    }
    private static JSONObject browserReply(String command,byte[]... arguments)throws Exception {
        var records=new org.json.JSONArray();var censusRows=new org.json.JSONArray();var list=new org.json.JSONArray();
        JSONObject local=new JSONObject().put("store","localStorage").put("key_sha256","1".repeat(64)).put("body_sha256","2".repeat(64));
        records.put(local);censusRows.put(new JSONObject(local.toString()).put("capture_record_ordinal",0)
            .put("kind","LOCAL_ORIGINAL").put("state","LOCAL_ORIGINAL_RETAINED_UNKNOWN").put("source_authenticated",false).put("automatic_acceptance",false));
        for(int i=0;i<arguments.length;i++){
            JSONObject row=new JSONObject().put("store","indexedDB").put("database","mz_scan_queue").put("version",4)
                .put("object_store","actions").put("key_sha256",Integer.toHexString(i%16).repeat(64)).put("body_sha256","4".repeat(64));
            records.put(row);censusRows.put(new JSONObject(row.toString()).put("capture_record_ordinal",i+1).put("kind","PRIMARY_QUEUE_ORIGINAL")
                .put("state","STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED").put("source_authenticated",false).put("automatic_acceptance",false)
                .put("candidate_ordinal",i).put("argument_values_sha256",NativeRetainedAttempt.hash(arguments[i])));
            if("CAPTURE".equals(command))list.put(java.util.Base64.getEncoder().encodeToString(arguments[i]));
        }
        JSONObject observation=new JSONObject().put("schema","custodial.browser-protected-observation.v1").put("browser_inventory_state","UNKNOWN")
            .put("native_authority",false).put("frozen",false).put("acknowledged",false).put("phone_released",false)
            .put("state","OBSERVED_NOT_FROZEN").put("observation_sha256","5".repeat(64)).put("local_record_count",1)
            .put("session_record_count",JSONObject.NULL).put("session_storage_state","NOT_DECLARED_UNKNOWN")
            .put("database_count",arguments.length==0?0:1).put("record_count",records.length()).put("records",records);
        JSONObject census=new JSONObject().put("schema","custodial.browser-whole-capture-completion-census.v1")
            .put("browser_inventory_state","UNKNOWN").put("native_semantic_inventory_state","UNKNOWN");
        for(String key:new String[]{"native_authority","source_authenticated","frozen","complete_namespace_inventory","current_server_readback",
            "cutoff_eligible","acknowledged","work_accepted","key_removal","phone_released"})census.put(key,false);
        census.put("state","WHOLE_CAPTURE_COMPLETION_CENSUS_NOT_AUTHENTICATED").put("observation_sha256","5".repeat(64))
            .put("local_record_count",1).put("session_record_count",JSONObject.NULL).put("session_storage_state","NOT_DECLARED_UNKNOWN")
            .put("database_count",arguments.length==0?0:1).put("record_count",censusRows.length()).put("unresolved_record_count",censusRows.length())
            .put("primary_queue_row_count",arguments.length).put("argument_candidate_count",arguments.length).put("ambiguous_argument_candidate_count",0)
            .put("domains",new org.json.JSONArray().put(new JSONObject().put("store","localStorage").put("record_count",1)
                .put("state","UNAUTHENTICATED_DOMAIN_RETAINED_UNKNOWN")).put(new JSONObject().put("store","sessionStorage").put("record_count",JSONObject.NULL)
                .put("state","NOT_DECLARED_UNKNOWN"))).put("records",censusRows);
        JSONObject reply=browserBinding().put("schema","custodial.native-original-browser-capture-response.v1").put("command",command)
            .put("reply_token",BROWSER_REPLY_TOKEN).put("request_nonce",BROWSER_REQUEST).put("phase_nonce",BROWSER_PHASE)
            .put("state","CAPTURE".equals(command)?"CAPTURED_RETAINED_NOT_AUTHORITY":"RECHECKED_RETAINED_NOT_AUTHORITY")
            .put("reason","").put("observation",observation).put("census",census).put("arguments_base64",list);
        return reply;
    }
    private static NativeOriginalBrowserPreparationWire.OwnedReply browserDecode(JSONObject value,String command)throws Exception {
        return NativeOriginalBrowserPreparationWire.decode(value.toString(),command,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding());
    }
    private static void browserRefuses(Checked operation)throws Exception {
        try{operation.run();fail("invalid private Source reply accepted");}
        catch(VaultFailure failure){assertEquals(NativeOriginalBrowserPreparationWire.FAILURE,failure.code);}
    }
    private static JSONObject primaryDomainReply(String command,String store,String database,Object version,String objectStore,boolean candidate)throws Exception {
        JSONObject value=browserReply(command,raw("{\"domain_vector\":true}"));
        JSONObject o=value.getJSONObject("observation"),census=value.getJSONObject("census");
        JSONObject prior=o.getJSONArray("records").getJSONObject(1),original=new JSONObject().put("store",store)
            .put("key_sha256",prior.get("key_sha256")).put("body_sha256",prior.get("body_sha256"));
        if("indexedDB".equals(store))original.put("database",database).put("version",version).put("object_store",objectStore);
        o.getJSONArray("records").put(1,original);
        if("localStorage".equals(store))o.put("local_record_count",2).put("database_count",0);
        if("sessionStorage".equals(store))o.put("session_record_count",1).put("session_storage_state","CAPTURED_READ_ONLY_NOT_AUTHENTICATED").put("database_count",0);
        JSONObject row=new JSONObject(original.toString()).put("capture_record_ordinal",1).put("source_authenticated",false).put("automatic_acceptance",false)
            .put("kind",candidate?"PRIMARY_QUEUE_ORIGINAL":"indexedDB".equals(store)?"OTHER_IDB_ORIGINAL":"sessionStorage".equals(store)?"SESSION_ORIGINAL":"LOCAL_ORIGINAL")
            .put("state",candidate?"STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED":"indexedDB".equals(store)
                ?"mz_scan_queue".equals(database)?"UNSUPPORTED_PRIMARY_DOMAIN_RETAINED_UNKNOWN":"OTHER_DOMAIN_ROW_RETAINED_UNKNOWN"
                :"sessionStorage".equals(store)?"SESSION_ORIGINAL_RETAINED_UNKNOWN":"LOCAL_ORIGINAL_RETAINED_UNKNOWN");
        if(candidate)row.put("candidate_ordinal",0).put("argument_values_sha256",NativeRetainedAttempt.hash(raw("{\"domain_vector\":true}")));
        else{value.put("arguments_base64",new org.json.JSONArray());census.put("primary_queue_row_count",0).put("argument_candidate_count",0);}
        census.getJSONArray("records").put(1,row);
        for(String key:new String[]{"observation_sha256","local_record_count","session_record_count","session_storage_state","database_count"})census.put(key,o.get(key));
        return value;
    }
    @Test public void BROWSER_PRIMARY_foreignCapturedCandidateRefused()throws Exception {
        // Exact captured source-row identity is present and all effects false;
        // the only changed candidate premise is its unsupported database.
        for(String command:new String[]{"CAPTURE","RECHECK"}){
            JSONObject foreign=primaryDomainReply(command,"indexedDB","foreign_db",4,"actions",true);
            browserRefuses(()->{try(var ignored=browserDecode(foreign,command)){};});
        }
    }
    @Test public void BROWSER_PRIMARY_supportedVersionBoundariesRetainCandidates()throws Exception {
        for(int version=1;version<=6;version++){
            try(var capture=browserDecode(primaryDomainReply("CAPTURE","indexedDB","mz_scan_queue",version,"actions",true),"CAPTURE");
                var recheck=browserDecode(primaryDomainReply("RECHECK","indexedDB","mz_scan_queue",version,"actions",true),"RECHECK")){
                capture.requireSameMetadata(recheck);var record=capture.originalArgumentRecords().get(0);
                assertEquals("indexedDB",record.store);assertEquals("mz_scan_queue",record.database);assertEquals(Long.valueOf(version),record.version);assertEquals("actions",record.objectStore);
                assertEquals(0,record.candidateOrdinal);assertEquals(1,record.captureRecordOrdinal);assertFalse(capture.census().getBoolean("source_authenticated"));
                assertEquals("STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED",record.candidateState);
            }
        }
    }
    @Test public void BROWSER_PRIMARY_nonIdbForeignAndMissingDomainsRefused()throws Exception {
        for(String command:new String[]{"CAPTURE","RECHECK"}){
            for(String store:new String[]{"localStorage","sessionStorage"}){
                JSONObject value=primaryDomainReply(command,store,null,null,null,true);browserRefuses(()->browserDecode(value,command));
            }
            for(String db:new String[]{"foreign_db","MZ_SCAN_QUEUE","mz_scan_queue ",""}){
                JSONObject value=primaryDomainReply(command,"indexedDB",db,4,"actions",true);browserRefuses(()->browserDecode(value,command));
            }
            for(String store:new String[]{"backup","drafts","Actions","actions ",""}){
                JSONObject value=primaryDomainReply(command,"indexedDB","mz_scan_queue",4,store,true);browserRefuses(()->browserDecode(value,command));
            }
            for(Object version:new Object[]{0,-1,7,99,9007199254740991L,"4",4.5d,JSONObject.NULL}){
                JSONObject value=primaryDomainReply(command,"indexedDB","mz_scan_queue",version,"actions",true);browserRefuses(()->browserDecode(value,command));
            }
            for(String key:new String[]{"store","database","version","object_store"}){
                JSONObject value=primaryDomainReply(command,"indexedDB","mz_scan_queue",4,"actions",true);
                value.getJSONObject("observation").getJSONArray("records").getJSONObject(1).remove(key);
                value.getJSONObject("census").getJSONArray("records").getJSONObject(1).remove(key);
                browserRefuses(()->browserDecode(value,command));
            }
        }
    }
    @Test public void BROWSER_PRIMARY_unsupportedOrdinaryRowsRemainRetained()throws Exception {
        for(String command:new String[]{"CAPTURE","RECHECK"}){
            var values=new JSONObject[]{primaryDomainReply(command,"localStorage",null,null,null,false),
                primaryDomainReply(command,"sessionStorage",null,null,null,false),
                primaryDomainReply(command,"indexedDB","foreign_db",4,"actions",false),
                primaryDomainReply(command,"indexedDB","mz_scan_queue",7,"actions",false),
                primaryDomainReply(command,"indexedDB","mz_scan_queue",4,"backup",false)};
            for(JSONObject value:values){
                JSONObject before=new JSONObject(value.toString());try(var owned=browserDecode(value,command)){
                    assertTrue(owned.originalArgumentRecords().isEmpty());assertEquals(0,owned.copyArguments().size());
                    assertEquals(2,owned.observation().getInt("record_count"));assertEquals(2,owned.census().getJSONArray("records").length());
                    assertTrue(ProviderWireJson.same(before.get("observation"),owned.observation()));assertTrue(ProviderWireJson.same(before.get("census"),owned.census()));
                    assertFalse(owned.census().getBoolean("cutoff_eligible"));assertFalse(owned.census().getBoolean("acknowledged"));
                }assertTrue(ProviderWireJson.same(before,value));
            }
        }
    }
    @Test public void BROWSER_PRIMARY_duplicateAmbiguousSupportedRowsRemainDistinct()throws Exception {
        byte[] argument=raw("{\"supported_duplicate\":true}");
        JSONObject capture=browserReply("CAPTURE",argument,argument),recheck=browserReply("RECHECK",argument,argument);
        for(JSONObject value:new JSONObject[]{capture,recheck}){
            var originals=value.getJSONObject("observation").getJSONArray("records");var census=value.getJSONObject("census");var rows=census.getJSONArray("records");
            String key=originals.getJSONObject(1).getString("key_sha256");
            originals.getJSONObject(2).put("key_sha256",key);rows.getJSONObject(2).put("key_sha256",key);
            for(int i=1;i<=2;i++){
                originals.getJSONObject(i).put("version",6);rows.getJSONObject(i).put("version",6).put("state","AMBIGUOUS_COMPLETION_ARGUMENT_ROWS_RETAINED");
            }census.put("ambiguous_argument_candidate_count",2);
        }
        try(var owned=browserDecode(capture,"CAPTURE");var next=browserDecode(recheck,"RECHECK")){
            owned.requireSameMetadata(next);var entries=owned.originalArgumentRecords();assertEquals(2,entries.size());
            assertEquals(0,entries.get(0).candidateOrdinal);assertEquals(1,entries.get(1).candidateOrdinal);
            assertEquals(1,entries.get(0).captureRecordOrdinal);assertEquals(2,entries.get(1).captureRecordOrdinal);
            for(var entry:entries){assertEquals(Long.valueOf(6),entry.version);assertEquals("AMBIGUOUS_COMPLETION_ARGUMENT_ROWS_RETAINED",entry.candidateState);}
            assertEquals(entries.get(0).keySha256,entries.get(1).keySha256);assertEquals(entries.get(0).argumentSha256,entries.get(1).argumentSha256);
            assertFalse(owned.census().getBoolean("current_server_readback"));assertFalse(owned.census().getBoolean("source_authenticated"));
        }
    }

    // Synthetic fixed-format DATA only: independently computed Node
    // JSON.stringify/UTF16BE golden hashes, encoded with the existing vector
    // writer below. These do not supply native/browser/authenticated records.
    private static byte[] primaryPayloadArguments(int value){
        return raw("{\"p_client_completion_id\":\"95000000-0000-4000-8000-000000000041\","
            +"\"p_client_session_id\":\"95000000-0000-4000-8000-000000000042\",\"p_device_id\":\"SYNTHETIC_ONLY\","
            +"\"p_native_finish_scan_entry_id\":\"95000000-0000-4000-8000-000000000043\",\"p_value\":"+value+"}");
    }
    private static Object[] primaryPayloadTree(boolean oversized,boolean ambiguous){
        Object[] payload=va("object",va(
            va("p_client_completion_id",va("string","95000000-0000-4000-8000-000000000041")),
            va("p_client_session_id",va("string","95000000-0000-4000-8000-000000000042")),
            va("p_device_id",va("string","SYNTHETIC_ONLY")),
            va("p_native_finish_scan_entry_id",va("string","95000000-0000-4000-8000-000000000043")),
            va("p_value",va("float64","3ff0000000000000"))));
        var fields=new java.util.ArrayList<Object>();
        fields.add(va("id",va("float64","3ff0000000000000")));
        fields.add(va("operation_id",va("string","95000000-0000-4000-8000-000000000044")));
        if(oversized)fields.add(va("padding",va("string","x".repeat(1048576))));
        fields.add(va("payload",payload));fields.add(va("schema_version",va("float64","4010000000000000")));
        fields.add(va("type",va("string","commit_workflow")));
        Object[] row=va(va("float64","3ff0000000000000"),va("object",fields.toArray()));
        return va(va(),null,valueOne(va(va("mz_scan_queue",4),valueOne(va("actions",ambiguous?va(row,row):valueOne(row))))));
    }
    private static JSONObject primaryPayloadReply(byte[] arguments,boolean ambiguous,boolean oversized)throws Exception {
        JSONObject reply=ambiguous?browserReply("CAPTURE",arguments,arguments):browserReply("CAPTURE",arguments);
        JSONObject o=reply.getJSONObject("observation"),c=reply.getJSONObject("census");int count=ambiguous?2:1;
        JSONObject row=new JSONObject().put("store","indexedDB").put("database","mz_scan_queue").put("version",4).put("object_store","actions")
            .put("key_sha256","a0c5bd6b651313c4562cfaae8671d7c95219bb1d9b17fb25f8e91de2cfa5e7f9")
            .put("body_sha256",oversized?"18544ab63c114e0806b260039ec29bf418c95ae56dbaec0611604daa401f5f0b"
                :"5049795106989b14dd22df727d20ae272c8186b824e3f01b0f10a93befd05926");
        String hash=ambiguous?"0a8ea8081df524513250a7a2df8bce6e4e400e7e6b073ea09acc161e23bf8158"
            :oversized?"d444007d119f50094f118a8b666040e8bc2ba96f1300ba2777e62c5f9e35862a"
            :"310a3109a4b62832b67cbbc82f932328894f478ee1a3101dfdbd5500d6a8badf";
        o.put("observation_sha256",hash).put("local_record_count",0).put("record_count",1).put("records",new org.json.JSONArray().put(row));
        JSONObject candidate=new JSONObject(row.toString()).put("capture_record_ordinal",0).put("candidate_ordinal",0)
            .put("kind","PRIMARY_QUEUE_ORIGINAL").put("state",ambiguous?"AMBIGUOUS_COMPLETION_ARGUMENT_ROWS_RETAINED"
                :"STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED")
            .put("source_authenticated",false).put("automatic_acceptance",false).put("argument_values_sha256",NativeRetainedAttempt.hash(arguments));
        var originals=new org.json.JSONArray().put(row);var candidates=new org.json.JSONArray().put(candidate);
        if(ambiguous){originals.put(new JSONObject(row.toString()));candidates.put(new JSONObject(candidate.toString())
            .put("capture_record_ordinal",1).put("candidate_ordinal",1));}
        o.put("record_count",count).put("records",originals);
        c.put("observation_sha256",hash).put("local_record_count",0).put("record_count",count).put("unresolved_record_count",count)
            .put("ambiguous_argument_candidate_count",ambiguous?count:0).put("records",candidates);
        c.getJSONArray("domains").getJSONObject(0).put("record_count",0);
        c.getJSONArray("domains").put(new JSONObject().put("store","indexedDB").put("database","mz_scan_queue").put("version",4)
            .put("object_store",JSONObject.NULL).put("record_count",count).put("state","UNAUTHENTICATED_DATABASE_RETAINED_UNKNOWN"));
        c.getJSONArray("domains").put(new JSONObject().put("store","indexedDB").put("database","mz_scan_queue").put("version",4)
            .put("object_store","actions").put("record_count",count).put("state","PRIMARY_QUEUE_DOMAIN_NOT_AUTHENTICATED"));return reply;
    }
    private static void requirePrimaryPayloadJoin(int argumentValue,boolean ambiguous,boolean oversized,boolean expectedMatch)throws Exception {
        byte[] originalArgument=primaryPayloadArguments(argumentValue),argumentBefore=originalArgument.clone(),frame=null;
        var chunks=new java.util.ArrayList<byte[]>();var before=new java.util.ArrayList<byte[]>();
        java.util.List<byte[]> arguments=java.util.List.of();
        try{
            JSONObject reply=primaryPayloadReply(originalArgument,ambiguous,oversized),originalReply=new JSONObject(reply.toString());
            try(var owned=browserDecode(reply,"CAPTURE")){
                JSONObject observation=owned.observation(),observationBefore=new JSONObject(observation.toString());
                frame=valueBytes(primaryPayloadTree(oversized,ambiguous),observation);chunks.addAll(valueChunks(frame));
                for(byte[] chunk:chunks)before.add(chunk.clone());arguments=owned.copyArguments();
                int count=ambiguous?2:1;var candidates=owned.originalArgumentRecords();assertEquals(count,candidates.size());
                for(var candidate:candidates)assertEquals(NativeRetainedAttempt.hash(originalArgument),candidate.argumentSha256);
                JSONObject metadata=valueMetadata(chunks,observation),metadataBefore=new JSONObject(metadata.toString());
                var records=NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,observation,chunks,candidates,arguments);
                assertEquals(count,records.recordCount);assertEquals(count,records.originalRecords().size());
                var matches=records.argumentPayloadMatches();assertEquals(count,matches.size());
                for(int i=0;i<count;i++){
                    var record=records.originalRecords().get(i);assertEquals(i,record.ordinal);assertEquals("indexedDB",record.store);
                    assertEquals("mz_scan_queue",record.database);assertEquals(Long.valueOf(4),record.version);assertEquals("actions",record.objectStore);
                    assertEquals("UNRESOLVED_RETAINED",record.semanticDisposition);
                    assertEquals(candidates.get(i).keySha256,record.keySha256);assertEquals(candidates.get(i).bodySha256,record.bodySha256);
                    var match=matches.get(i);assertEquals(i,match.candidateOrdinal);assertEquals(i,match.captureRecordOrdinal);
                    assertEquals(candidates.get(i).argumentSha256,match.argumentSha256);assertEquals(expectedMatch,match.matchesOriginalPayload);
                    assertArrayEquals(argumentBefore,arguments.get(i));
                }
                try{matches.clear();fail("mutable argument DATA match list");}catch(UnsupportedOperationException expected){}
                assertEquals(observation.getString("observation_sha256"),records.observationSha256);
                assertEquals(metadata.getString("frame_sha256"),records.frameSha256);assertTrue(ProviderWireJson.same(metadataBefore,metadata));
                assertTrue(ProviderWireJson.same(observationBefore,observation));assertTrue(ProviderWireJson.same(originalReply,reply));
                for(int i=0;i<chunks.size();i++)assertArrayEquals(before.get(i),chunks.get(i));
                assertArrayEquals(argumentBefore,originalArgument);
                assertFalse(owned.census().getBoolean("source_authenticated"));assertFalse(owned.census().getBoolean("acknowledged"));
                if(oversized){assertTrue(frame.length>2*1048576);assertEquals(3,chunks.size());assertTrue(frame.length<64*1048576);}
            }
        }finally{
            Arrays.fill(originalArgument,(byte)0);Arrays.fill(argumentBefore,(byte)0);if(frame!=null)Arrays.fill(frame,(byte)0);
            for(var list:java.util.List.of(chunks,before,arguments))for(byte[] bytes:list)Arrays.fill(bytes,(byte)0);
        }
    }
    @Test public void BROWSER_PAYLOAD_JOIN_actualBinaryPayloadMatchesExactArgument()throws Exception {
        requirePrimaryPayloadJoin(1,false,false,true);
    }
    @Test public void BROWSER_PAYLOAD_JOIN_claimedArgumentDoesNotReplaceBinaryPayload()throws Exception {
        requirePrimaryPayloadJoin(2,false,false,false);
    }
    @Test public void BROWSER_PAYLOAD_JOIN_ambiguousOriginalRemainsUnresolved()throws Exception {
        requirePrimaryPayloadJoin(1,true,false,false);
    }
    @Test public void BROWSER_PAYLOAD_JOIN_selectedCanonicalCaptureCapRetainsWholeFrame()throws Exception {
        // Encoded body has 1,049,154 UTF16 JSON units, over only the selected
        // row capture cap. The full original frame remains below its 64MiB cap.
        requirePrimaryPayloadJoin(1,false,true,false);
    }

    // NEW six-argument Frame composition fixtures only. Reuse the actual
    // lossless vector writer, private Wire decoder and Frame reader below;
    // these test arrays/rows are DATA, never original native authority.
    private static String nativePoolUuid(int suffix){
        return "95000000-0000-4000-8000-"+String.format(java.util.Locale.ROOT,"%012d",suffix);
    }
    private static byte[] nativePoolArgument(int value,int session,int completion){
        return raw(new String(primaryPayloadArguments(value),StandardCharsets.UTF_8)
            .replace(nativePoolUuid(42),nativePoolUuid(session)).replace(nativePoolUuid(41),nativePoolUuid(completion)));
    }
    private static Object[] nativePoolRow(int primary,int session,int completion,int operation,int value,boolean overflow){
        Object[] tree=primaryPayloadTree(overflow,false),db=(Object[])((Object[])tree[2])[0];
        Object[] store=(Object[])((Object[])db[1])[0],row=(Object[])((Object[])store[1])[0];
        Object[] fields=(Object[])((Object[])row[1])[1];
        Object[] primaryTag=va("float64",String.format(java.util.Locale.ROOT,"%016x",Double.doubleToRawLongBits(primary)));
        row[0]=primaryTag;((Object[])fields[0])[1]=primaryTag;
        ((Object[])fields[1])[1]=va("string",nativePoolUuid(operation));
        Object[] payload=(Object[])((Object[])fields[overflow?3:2])[1],pairs=(Object[])payload[1];
        ((Object[])pairs[0])[1]=va("string",nativePoolUuid(completion));
        ((Object[])pairs[1])[1]=va("string",nativePoolUuid(session));
        ((Object[])pairs[4])[1]=va("float64",String.format(java.util.Locale.ROOT,"%016x",Double.doubleToRawLongBits(value)));
        return row;
    }
    private static Object[] nativePoolTree(Object[]... rows){
        return va(va(),null,valueOne(va(va("mz_scan_queue",4),valueOne(va("actions",rows)))));
    }
    private static String nativePoolJson(Object value)throws Exception {
        if(value==null)return "null";
        return value instanceof String?JSONObject.quote((String)value):new org.json.JSONArray((Object[])value).toString();
    }
    private static String nativePoolTranscriptHash(String text)throws Exception {
        return NativeRetainedAttempt.hash(text.getBytes(StandardCharsets.UTF_16BE));
    }
    /** Plain synthetic observation/census construction, not a replacement
     * parser/brand. Only the shipping Frame consumes the original binary. */
    private static JSONObject nativePoolReply(Object[] tree,int[] selected,byte[]... browserArguments)throws Exception {
        assertEquals(selected.length,browserArguments.length);
        JSONObject reply=browserReply("CAPTURE",browserArguments),o=reply.getJSONObject("observation"),c=reply.getJSONObject("census");
        var records=new org.json.JSONArray();var domains=new org.json.JSONArray();int primary=0;
        Object[] local=(Object[])tree[0],session=(Object[])tree[1],databases=(Object[])tree[2];
        for(int area=0;area<2;area++){
            Object[] values=area==0?local:session;String store=area==0?"localStorage":"sessionStorage";
            domains.put(new JSONObject().put("store",store).put("record_count",values==null?JSONObject.NULL:values.length)
                .put("state",values==null?"NOT_DECLARED_UNKNOWN":"UNAUTHENTICATED_DOMAIN_RETAINED_UNKNOWN"));
            if(values!=null)for(Object entry:values){Object[] row=(Object[])entry;
                records.put(new JSONObject().put("store",store).put("key_sha256",nativePoolTranscriptHash(nativePoolJson(row[0])))
                    .put("body_sha256",nativePoolTranscriptHash(nativePoolJson(row[1]))));
            }
        }
        for(Object entry:databases){
            Object[] db=(Object[])entry,identity=(Object[])db[0],stores=(Object[])db[1];String database=(String)identity[0];int version=((Number)identity[1]).intValue(),dbRows=0;
            for(Object entryStore:stores)dbRows+=((Object[])((Object[])entryStore)[1]).length;
            domains.put(new JSONObject().put("store","indexedDB").put("database",database).put("version",version)
                .put("object_store",JSONObject.NULL).put("record_count",dbRows).put("state","UNAUTHENTICATED_DATABASE_RETAINED_UNKNOWN"));
            for(Object entryStore:stores){Object[] store=(Object[])entryStore,rows=(Object[])store[1];String name=(String)store[0];
                boolean supported="mz_scan_queue".equals(database)&&version>=1&&version<=6&&"actions".equals(name);
                domains.put(new JSONObject().put("store","indexedDB").put("database",database).put("version",version)
                    .put("object_store",name).put("record_count",rows.length).put("state",supported?"PRIMARY_QUEUE_DOMAIN_NOT_AUTHENTICATED":"OTHER_DOMAIN_RETAINED_UNKNOWN"));
                for(Object entryRow:rows){Object[] row=(Object[])entryRow;if(supported)primary++;
                    records.put(new JSONObject().put("store","indexedDB").put("database",database).put("version",version).put("object_store",name)
                        .put("key_sha256",nativePoolTranscriptHash(nativePoolJson(row[0])))
                        .put("body_sha256",nativePoolTranscriptHash(nativePoolJson(row[1]))));
                }
            }
        }
        String transcript="[\"custodial.browser-protected-observation.v1\",{\"local\":"+nativePoolJson(local)
            +",\"session\":"+nativePoolJson(session)+",\"databases\":"+nativePoolJson(databases)+"}]";
        String hash=nativePoolTranscriptHash(transcript);var censusRows=new org.json.JSONArray();
        for(int i=0;i<records.length();i++){
            JSONObject row=new JSONObject(records.getJSONObject(i).toString());String area=row.getString("store");
            boolean supported="indexedDB".equals(area)&&"mz_scan_queue".equals(row.getString("database"))
                &&row.getInt("version")>=1&&row.getInt("version")<=6&&"actions".equals(row.getString("object_store"));
            row.put("capture_record_ordinal",i).put("source_authenticated",false).put("automatic_acceptance",false)
                .put("kind",supported?"PRIMARY_QUEUE_ORIGINAL":"indexedDB".equals(area)?"OTHER_IDB_ORIGINAL":"sessionStorage".equals(area)?"SESSION_ORIGINAL":"LOCAL_ORIGINAL")
                .put("state",supported?"UNINSPECTABLE_PRIMARY_ROW_RETAINED":"indexedDB".equals(area)?"OTHER_DOMAIN_ROW_RETAINED_UNKNOWN"
                    :"sessionStorage".equals(area)?"SESSION_ORIGINAL_RETAINED_UNKNOWN":"LOCAL_ORIGINAL_RETAINED_UNKNOWN");
            for(int j=0;j<selected.length;j++)if(selected[j]==i){
                assertTrue(supported);row.put("candidate_ordinal",j).put("argument_values_sha256",NativeRetainedAttempt.hash(browserArguments[j]))
                    .put("state","STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED");
            }censusRows.put(row);
        }
        for(int index:selected)assertTrue(index>=0&&index<records.length());
        for(JSONObject doc:new JSONObject[]{o,c})doc.put("observation_sha256",hash).put("local_record_count",local.length)
            .put("session_record_count",session==null?JSONObject.NULL:session.length)
            .put("session_storage_state",session==null?"NOT_DECLARED_UNKNOWN":"CAPTURED_READ_ONLY_NOT_AUTHENTICATED")
            .put("database_count",databases.length).put("record_count",records.length());
        o.put("records",records);c.put("records",censusRows).put("domains",domains).put("unresolved_record_count",records.length())
            .put("primary_queue_row_count",primary).put("argument_candidate_count",selected.length).put("ambiguous_argument_candidate_count",0);
        return reply;
    }
    private static void nativePoolWipe(java.util.List<byte[]> bytes){for(byte[] value:bytes)Arrays.fill(value,(byte)0);}
    private static NativeOriginalBrowserValueFrame.OriginalRecords inspectNativePool(Object[] tree,JSONObject reply,
        java.util.List<byte[]> completePool,boolean sixArguments)throws Exception {
        byte[] frame=null;var chunks=new java.util.ArrayList<byte[]>();var before=new java.util.ArrayList<byte[]>();
        var poolBefore=new java.util.ArrayList<byte[]>();var poolIdentities=new java.util.ArrayList<byte[]>(completePool);
        var browserBefore=new java.util.ArrayList<byte[]>();var browserIdentities=new java.util.ArrayList<byte[]>();
        java.util.List<byte[]> arguments=java.util.List.of();
        for(byte[] original:completePool)poolBefore.add(original.clone());
        JSONObject originalReply=new JSONObject(reply.toString());
        try(var owned=browserDecode(reply,"CAPTURE")){
            JSONObject observation=owned.observation(),observationBefore=new JSONObject(observation.toString());
            frame=valueBytes(tree,observation);chunks.addAll(valueChunks(frame));for(byte[] chunk:chunks)before.add(chunk.clone());
            arguments=owned.copyArguments();for(byte[] argument:arguments){browserBefore.add(argument.clone());browserIdentities.add(argument);}
            JSONObject metadata=valueMetadata(chunks,observation),metadataBefore=new JSONObject(metadata.toString());
            var records=sixArguments?NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,observation,chunks,owned.originalArgumentRecords(),arguments,completePool)
                :NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,observation,chunks,owned.originalArgumentRecords(),arguments);
            assertEquals(observation.getInt("record_count"),records.recordCount);assertEquals(records.recordCount,records.originalRecords().size());
            assertTrue(ProviderWireJson.same(observationBefore,observation));assertTrue(ProviderWireJson.same(metadataBefore,metadata));
            assertTrue(ProviderWireJson.same(originalReply,reply));
            for(int i=0;i<chunks.size();i++)assertArrayEquals(before.get(i),chunks.get(i));
            assertEquals(poolBefore.size(),completePool.size());
            for(int i=0;i<completePool.size();i++){assertSame(poolIdentities.get(i),completePool.get(i));assertArrayEquals(poolBefore.get(i),completePool.get(i));}
            assertEquals(browserBefore.size(),arguments.size());
            for(int i=0;i<arguments.size();i++){assertSame(browserIdentities.get(i),arguments.get(i));assertArrayEquals(browserBefore.get(i),arguments.get(i));}
            assertFalse(owned.census().getBoolean("source_authenticated"));assertFalse(owned.census().getBoolean("acknowledged"));return records;
        }finally{
            if(frame!=null)Arrays.fill(frame,(byte)0);nativePoolWipe(chunks);nativePoolWipe(before);nativePoolWipe(poolBefore);
            nativePoolWipe(arguments);nativePoolWipe(browserBefore);
        }
    }
    private static void requireNativePoolMatches(NativeOriginalBrowserValueFrame.OriginalRecords records,int[] expected,
        java.util.List<byte[]> completePool)throws Exception {
        assertEquals(expected.length,records.recordCount);var matches=records.nativeArgumentPayloadMatches();assertEquals(records.recordCount,matches.size());
        for(int i=0;i<expected.length;i++){
            var row=records.originalRecords().get(i);assertEquals(i,row.ordinal);assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
            var match=matches.get(i);assertEquals(i,match.captureRecordOrdinal);assertEquals(expected[i],match.nativeArgumentOrdinal);
            assertEquals(expected[i]>=0,match.matchesOriginalPayload);
            assertEquals(expected[i]<0?"":NativeRetainedAttempt.hash(completePool.get(expected[i])),match.argumentSha256);
        }
        try{matches.clear();fail("mutable native match DATA list");}catch(UnsupportedOperationException expectedImmutable){}
        try{records.originalRecords().clear();fail("mutable original row DATA list");}catch(UnsupportedOperationException expectedImmutable){}
    }
    @Test public void BROWSER_NATIVE_POOL_emptyBrowserCandidatesCannotHideActualMatch()throws Exception {
        Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false));var pool=java.util.List.of(nativePoolArgument(1,42,41));
        try{
            JSONObject reply=nativePoolReply(tree,new int[0]);
            try(var owned=browserDecode(reply,"CAPTURE")){assertTrue(owned.originalArgumentRecords().isEmpty());assertTrue(owned.copyArguments().isEmpty());}
            var result=inspectNativePool(tree,reply,pool,true);assertTrue(result.argumentPayloadMatches().isEmpty());
            requireNativePoolMatches(result,new int[]{0},pool);
            assertEquals("310a3109a4b62832b67cbbc82f932328894f478ee1a3101dfdbd5500d6a8badf",result.observationSha256);
        }finally{nativePoolWipe(pool);}
    }
    @Test public void BROWSER_NATIVE_POOL_unselectedMismatchDuplicateSuppressesOriginal()throws Exception {
        Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false),nativePoolRow(1,42,41,44,2,false));
        byte[] browserArgument=nativePoolArgument(1,42,41);var pool=java.util.List.of(nativePoolArgument(1,42,41));
        try{
            JSONObject reply=nativePoolReply(tree,new int[]{0},browserArgument);var result=inspectNativePool(tree,reply,pool,true);
            assertEquals(1,result.argumentPayloadMatches().size());assertTrue(result.argumentPayloadMatches().get(0).matchesOriginalPayload);
            // The unselected second real row has different payload bytes. It
            // still shares original identities, so the first cannot match via
            // the complete native pool merely because the browser omitted it.
            assertNotEquals(result.originalRecords().get(0).bodySha256,result.originalRecords().get(1).bodySha256);
            requireNativePoolMatches(result,new int[]{-1,-1},pool);
        }finally{Arrays.fill(browserArgument,(byte)0);nativePoolWipe(pool);}
    }
    @Test public void BROWSER_NATIVE_POOL_separatePrimarySessionCompletionOperationCollisions()throws Exception {
        // Primary, session and operation collisions are isolated independently.
        // A duplicate device/session/completion tuple necessarily also shares
        // its session; that fourth case does not pretend otherwise.
        for(String collision:new String[]{"primary","session","completion","operation"}){
            int primary="primary".equals(collision)?1:2,session="session".equals(collision)||"completion".equals(collision)?42:52;
            int completion="completion".equals(collision)?41:51,operation="operation".equals(collision)?44:54;
            Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false),nativePoolRow(primary,session,completion,operation,2,false));
            var pool=new java.util.ArrayList<byte[]>();pool.add(nativePoolArgument(1,42,41));
            if(!"completion".equals(collision))pool.add(nativePoolArgument(2,session,completion));
            try{requireNativePoolMatches(inspectNativePool(tree,nativePoolReply(tree,new int[0]),pool,true),new int[]{-1,-1},pool);}
            finally{nativePoolWipe(pool);}
        }
    }
    @Test public void BROWSER_NATIVE_POOL_duplicateNativeTuplesNeverDeduplicate()throws Exception {
        Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false));
        for(int secondValue:new int[]{1,2}){
            var pool=java.util.List.of(nativePoolArgument(1,42,41),nativePoolArgument(secondValue,42,41));
            try{
                var result=inspectNativePool(tree,nativePoolReply(tree,new int[0]),pool,true);
                requireNativePoolMatches(result,new int[]{-1},pool);assertEquals(2,pool.size());assertNotSame(pool.get(0),pool.get(1));
                // Ambiguous complete-pool tuple refuses the match (false
                // sentinel), not a first/equal-byte winner or a deduped pool.
                if(secondValue==1)assertArrayEquals(pool.get(0),pool.get(1));else assertFalse(Arrays.equals(pool.get(0),pool.get(1)));
            }finally{nativePoolWipe(pool);}
        }
    }
    @Test public void BROWSER_NATIVE_POOL_explicitEmptyPoolVersusLegacyFiveArguments()throws Exception {
        Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false));tree[0]=valueOne(va("local-only","retained unknown"));
        JSONObject reply=nativePoolReply(tree,new int[0]);
        var six=inspectNativePool(tree,reply,java.util.List.of(),true);requireNativePoolMatches(six,new int[]{-1,-1},java.util.List.of());
        var five=inspectNativePool(tree,reply,java.util.List.of(),false);assertEquals(2,five.recordCount);
        assertTrue(five.nativeArgumentPayloadMatches().isEmpty());assertEquals(six.originalRecords().size(),five.originalRecords().size());
        for(int i=0;i<2;i++){assertEquals("UNRESOLVED_RETAINED",five.originalRecords().get(i).semanticDisposition);
            assertEquals(six.originalRecords().get(i).bodySha256,five.originalRecords().get(i).bodySha256);}
    }
    @Test public void BROWSER_NATIVE_POOL_unsupportedOverflowAndOtherRealmStayRetained()throws Exception {
        Object[] unsupported=nativePoolRow(3,62,61,64,3,false),fields=(Object[])((Object[])unsupported[1])[1];
        ((Object[])fields[fields.length-1])[1]=va("string","other_action");
        Object[] tree=va(valueOne(va("local-only","not a completion")),null,va(
            va(va("foreign_db",4),valueOne(va("actions",valueOne(nativePoolRow(1,42,41,44,1,false))))),
            va(va("mz_scan_queue",4),va(
                va("actions",va(nativePoolRow(1,42,41,44,1,false),unsupported,nativePoolRow(2,52,51,54,2,true))),
                va("backup",valueOne(nativePoolRow(1,42,41,44,1,false)))))));
        var pool=java.util.List.of(nativePoolArgument(1,42,41),nativePoolArgument(2,52,51));
        try{
            var result=inspectNativePool(tree,nativePoolReply(tree,new int[0]),pool,true);
            requireNativePoolMatches(result,new int[]{-1,-1,0,-1,-1,-1},pool);
            assertEquals(6,result.recordCount);assertEquals("backup",result.originalRecords().get(5).objectStore);
            // Strict one-database-name framing cannot carry both v4 and v7 of
            // mz_scan_queue simultaneously. Check v7 separately, not by an
            // invalid duplicate-database fixture or a relaxed frame guard.
            Object[] legacy=nativePoolTree(nativePoolRow(1,42,41,44,1,false));
            ((Object[])((Object[])((Object[])legacy[2])[0])[0])[1]=7;
            requireNativePoolMatches(inspectNativePool(legacy,nativePoolReply(legacy,new int[0]),pool,true),new int[]{-1},pool);
        }finally{nativePoolWipe(pool);}
    }
    @Test public void BROWSER_NATIVE_POOL_ownedLoansImmutableRowsAndPrivateConstruction()throws Exception {
        Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false),nativePoolRow(2,52,51,54,2,false));
        var pool=java.util.List.of(nativePoolArgument(2,52,51),nativePoolArgument(1,42,41));
        try{
            var records=inspectNativePool(tree,nativePoolReply(tree,new int[0]),pool,true);
            requireNativePoolMatches(records,new int[]{1,0},pool);String retainedHash=records.nativeArgumentPayloadMatches().get(0).argumentSha256;
            pool.get(1)[0]^=1;assertEquals(retainedHash,records.nativeArgumentPayloadMatches().get(0).argumentSha256);
        }finally{nativePoolWipe(pool);}
        Class<?> type=NativeOriginalBrowserValueFrame.NativeArgumentPayloadMatch.class;
        assertTrue(java.lang.reflect.Modifier.isFinal(type.getModifiers()));
        for(var constructor:type.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(constructor.getModifiers()));
        var names=new java.util.HashSet<String>();for(var field:type.getDeclaredFields()){
            assertTrue(java.lang.reflect.Modifier.isFinal(field.getModifiers()));names.add(field.getName());}
        assertEquals(java.util.Set.of("captureRecordOrdinal","nativeArgumentOrdinal","argumentSha256","matchesOriginalPayload"),names);
        Object[] single=nativePoolTree(nativePoolRow(1,42,41,44,1,false));JSONObject reply=nativePoolReply(single,new int[0]);
        for(int mode=0;mode<3;mode++){
            byte[] original=nativePoolArgument(1,42,41),saved=original.clone();var mutable=new java.util.ArrayList<byte[]>();mutable.add(original);
            String originalHash=NativeRetainedAttempt.hash(saved);
            final int fault=mode;var changing=new java.util.AbstractList<byte[]>(){
                int reads;@Override public int size(){return mutable.size();}
                @Override public byte[] get(int index){
                    if(++reads==2){if(fault==0)mutable.set(0,mutable.get(0).clone());else if(fault==1)mutable.get(0)[0]^=1;else mutable.clear();}
                    return mutable.get(index);
                }
            };
            byte[] frame=null;var chunks=new java.util.ArrayList<byte[]>();var before=new java.util.ArrayList<byte[]>();
            try(var owned=browserDecode(reply,"CAPTURE")){
                JSONObject observation=owned.observation();frame=valueBytes(single,observation);chunks.addAll(valueChunks(frame));
                for(byte[] chunk:chunks)before.add(chunk.clone());JSONObject metadata=valueMetadata(chunks,observation);
                browserRefuses(()->NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,observation,chunks,
                    owned.originalArgumentRecords(),java.util.List.of(),changing));
                for(int i=0;i<chunks.size();i++)assertArrayEquals(before.get(i),chunks.get(i));
                assertEquals(originalHash,NativeRetainedAttempt.hash(saved)); // Saved synthetic original was never replaced.
            }finally{
                Arrays.fill(original,(byte)0);Arrays.fill(saved,(byte)0);nativePoolWipe(mutable);nativePoolWipe(chunks);nativePoolWipe(before);
                if(frame!=null)Arrays.fill(frame,(byte)0);
            }
        }
    }

    @Test public void BROWSER_ARGUMENTS_syntheticExtraRowCannotSupplyArgument()throws Exception {
        byte[] argument=raw("{\"synthetic\":\"retained original\"}");
        for(String command:new String[]{"CAPTURE","RECHECK"}){
            JSONObject value=browserReply(command,argument),census=value.getJSONObject("census");
            var rows=census.getJSONArray("records");JSONObject original=rows.getJSONObject(1);
            JSONObject synthetic=new JSONObject(original.toString());synthetic.remove("capture_record_ordinal");
            original.remove("candidate_ordinal");original.remove("argument_values_sha256");
            rows.put(synthetic);census.put("record_count",3).put("unresolved_record_count",3).put("primary_queue_row_count",2);
            browserRefuses(()->{try(var ignored=browserDecode(value,command)){};});
        }
    }
    @Test public void BROWSER_ARGUMENTS_capturedMappingsImmutableAndRecheck()throws Exception {
        byte[] first=raw("{\"original\":1}"),second=raw("{\"original\":2}");
        JSONObject source=browserReply("CAPTURE",first,second);
        try(var captured=browserDecode(source,"CAPTURE");var recheck=browserDecode(browserReply("RECHECK",first,second),"RECHECK")){
            captured.requireSameMetadata(recheck);var records=captured.originalArgumentRecords();assertEquals(2,records.size());
            for(int i=0;i<2;i++){
                var record=records.get(i);JSONObject original=source.getJSONObject("observation").getJSONArray("records").getJSONObject(i+1);
                assertEquals(i,record.candidateOrdinal);assertEquals(i+1,record.captureRecordOrdinal);assertEquals("indexedDB",record.store);
                assertEquals("mz_scan_queue",record.database);assertEquals(Long.valueOf(4),record.version);assertEquals("actions",record.objectStore);
                assertEquals(original.getString("key_sha256"),record.keySha256);assertEquals(original.getString("body_sha256"),record.bodySha256);
                assertEquals(NativeRetainedAttempt.hash(i==0?first:second),record.argumentSha256);
                assertEquals("STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED",record.candidateState);
                var again=recheck.originalArgumentRecords().get(i);assertEquals(record.captureRecordOrdinal,again.captureRecordOrdinal);
                assertEquals(record.argumentSha256,again.argumentSha256);
            }
            assertEquals(0,recheck.copyArguments().size());
            try{records.clear();fail("mutable argument mappings");}catch(UnsupportedOperationException expected){}
            try{records.add(records.get(0));fail("appendable argument mappings");}catch(UnsupportedOperationException expected){}
            // Detached caller/diagnostic graphs cannot retarget immutable mappings.
            String key=records.get(0).keySha256;source.getJSONObject("observation").getJSONArray("records").getJSONObject(1).put("key_sha256","f".repeat(64));
            captured.census().getJSONArray("records").getJSONObject(1).put("candidate_ordinal",1);
            assertEquals(key,records.get(0).keySha256);assertEquals(0,captured.originalArgumentRecords().get(0).candidateOrdinal);
        }
        try(var empty=browserDecode(browserReply("CAPTURE"),"CAPTURE")){assertTrue(empty.originalArgumentRecords().isEmpty());}
    }
    @Test public void BROWSER_ARGUMENTS_binaryCapturedRowIdentityCorrelationDataOnly()throws Exception {
        // Binary row identity only: these independent argument bytes are NOT
        // claimed to have been natively decoded from the opaque row payload.
        byte[] argument=raw("{\"independent_argument_vector\":true}");
        // New synthetic input: actual lossless IDB frame in the producer's
        // supported realm. The former db/v7/store receipt remains historical.
        JSONObject o=valueObservation(false).put("observation_sha256","7ac1e3d35892eeb1469523c3b95d751a321e376a01f0871a4bbc8130f3a0a504");
        o.getJSONArray("records").getJSONObject(2).put("database","mz_scan_queue").put("version",4).put("object_store","actions");
        Object[] tree=valueTree(false),database=(Object[])((Object[])tree[2])[0];database[0]=va("mz_scan_queue",4);
        ((Object[])((Object[])database[1])[0])[0]="actions";
        var chunks=valueChunks(valueBytes(tree,o));
        var binary=NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(valueMetadata(chunks,o),o,chunks);
        JSONObject reply=browserReply("CAPTURE",argument),census=reply.getJSONObject("census");reply.put("observation",o);
        for(String key:new String[]{"observation_sha256","local_record_count","session_record_count","session_storage_state","database_count"})census.put(key,o.get(key));
        var rows=new org.json.JSONArray();
        for(int i=0;i<3;i++){
            JSONObject row=new JSONObject(o.getJSONArray("records").getJSONObject(i).toString()).put("capture_record_ordinal",i)
                .put("kind",i==2?"PRIMARY_QUEUE_ORIGINAL":"LOCAL_ORIGINAL").put("source_authenticated",false).put("automatic_acceptance",false)
                .put("state",i==2?"STRUCTURAL_COMPLETION_ARGUMENT_CANDIDATE_NOT_AUTHENTICATED":"LOCAL_ORIGINAL_RETAINED_UNKNOWN");
            if(i==2)row.put("candidate_ordinal",0).put("argument_values_sha256",NativeRetainedAttempt.hash(argument));rows.put(row);
        }
        census.put("records",rows).put("record_count",3).put("unresolved_record_count",3);
        try(var owned=browserDecode(reply,"CAPTURE")){
            var candidate=owned.originalArgumentRecords().get(0);var original=binary.originalRecords().get(candidate.captureRecordOrdinal);
            assertEquals(2,candidate.captureRecordOrdinal);assertEquals(original.ordinal,candidate.captureRecordOrdinal);
            assertEquals(original.store,candidate.store);assertEquals(original.database,candidate.database);assertEquals(original.version,candidate.version);
            assertEquals(original.objectStore,candidate.objectStore);assertEquals(original.keySha256,candidate.keySha256);assertEquals(original.bodySha256,candidate.bodySha256);
            assertEquals("UNRESOLVED_RETAINED",original.semanticDisposition);assertFalse(owned.census().getBoolean("source_authenticated"));
        }
    }
    @Test public void BROWSER_ARGUMENTS_invalidAndSwappedOrdinalsHeld()throws Exception {
        byte[] a=raw("a"),b=raw("b");
        for(String command:new String[]{"CAPTURE","RECHECK"})for(Object invalid:new Object[]{JSONObject.NULL,"1",-1,4096,0,2}){
            JSONObject value=browserReply(command,a,b);value.getJSONObject("census").getJSONArray("records").getJSONObject(1).put("capture_record_ordinal",invalid);
            browserRefuses(()->browserDecode(value,command));
        }
        for(String command:new String[]{"CAPTURE","RECHECK"}){
            JSONObject missing=browserReply(command,a);missing.getJSONObject("census").getJSONArray("records").getJSONObject(1).remove("capture_record_ordinal");
            browserRefuses(()->browserDecode(missing,command));
            JSONObject duplicate=browserReply(command,a,b);duplicate.getJSONObject("census").getJSONArray("records").getJSONObject(2).put("candidate_ordinal",0);
            browserRefuses(()->browserDecode(duplicate,command));
        }
        JSONObject swap=browserReply("CAPTURE",a,b);var rows=swap.getJSONObject("census").getJSONArray("records");
        rows.getJSONObject(1).put("candidate_ordinal",1);rows.getJSONObject(2).put("candidate_ordinal",0);
        browserRefuses(()->browserDecode(swap,"CAPTURE"));
        JSONObject swappedRecheck=browserReply("RECHECK",a,b);rows=swappedRecheck.getJSONObject("census").getJSONArray("records");
        rows.getJSONObject(1).put("candidate_ordinal",1);rows.getJSONObject(2).put("candidate_ordinal",0);
        try(var captured=browserDecode(browserReply("CAPTURE",a,b),"CAPTURE");var changed=browserDecode(swappedRecheck,"RECHECK")){
            browserRefuses(()->captured.requireSameMetadata(changed));
        }
    }
    @Test public void BROWSER_ARGUMENTS_duplicateKeysAndAmbiguousCandidatesRetained()throws Exception {
        byte[] argument=raw("{\"duplicate_vector\":true}");
        for(String state:new String[]{"AMBIGUOUS_COMPLETION_ARGUMENT_ROWS_RETAINED","AMBIGUOUS_SESSION_ARGUMENT_ROWS_RETAINED","AMBIGUOUS_QUEUE_OPERATION_ROWS_RETAINED"}){
            JSONObject capture=browserReply("CAPTURE",argument,argument),recheck=browserReply("RECHECK",argument,argument);
            for(JSONObject value:new JSONObject[]{capture,recheck}){
                var original=value.getJSONObject("observation").getJSONArray("records");String duplicateKey=original.getJSONObject(1).getString("key_sha256");
                original.getJSONObject(2).put("key_sha256",duplicateKey);
                JSONObject census=value.getJSONObject("census");var rows=census.getJSONArray("records");
                rows.getJSONObject(1).put("state",state);rows.getJSONObject(2).put("state",state).put("key_sha256",duplicateKey);
                census.put("ambiguous_argument_candidate_count",2);
            }
            try(var owned=browserDecode(capture,"CAPTURE");var next=browserDecode(recheck,"RECHECK")){
                owned.requireSameMetadata(next);var records=owned.originalArgumentRecords();assertEquals(2,records.size());
                assertEquals(0,records.get(0).candidateOrdinal);assertEquals(1,records.get(1).candidateOrdinal);
                assertEquals(1,records.get(0).captureRecordOrdinal);assertEquals(2,records.get(1).captureRecordOrdinal);
                assertEquals(records.get(0).keySha256,records.get(1).keySha256);assertEquals(records.get(0).bodySha256,records.get(1).bodySha256);
                assertEquals(records.get(0).argumentSha256,records.get(1).argumentSha256);assertNotSame(records.get(0),records.get(1));
                for(var record:records)assertEquals(state,record.candidateState);
                assertFalse(owned.census().getBoolean("current_server_readback"));assertFalse(owned.census().getBoolean("cutoff_eligible"));
            }
        }
    }
    @Test public void BROWSER_ARGUMENTS_missingOrMismatchedHashesRefused()throws Exception {
        for(String key:new String[]{"candidate_ordinal","argument_values_sha256"}){
            JSONObject value=browserReply("CAPTURE",raw("{}"));value.getJSONObject("census").getJSONArray("records").getJSONObject(1).remove(key);
            browserRefuses(()->browserDecode(value,"CAPTURE"));
        }
        for(String wrong:new String[]{"0".repeat(64),"A".repeat(64),"not-a-hash"}){
            JSONObject value=browserReply("CAPTURE",raw("{}"));value.getJSONObject("census").getJSONArray("records").getJSONObject(1).put("argument_values_sha256",wrong);
            browserRefuses(()->browserDecode(value,"CAPTURE"));
        }
        JSONObject missing=browserReply("CAPTURE",raw("{}"));missing.put("arguments_base64",new org.json.JSONArray());browserRefuses(()->browserDecode(missing,"CAPTURE"));
        JSONObject next=browserReply("RECHECK",raw("{}"));next.getJSONObject("census").getJSONArray("records").getJSONObject(1).put("argument_values_sha256","0".repeat(64));
        try(var original=browserDecode(browserReply("CAPTURE",raw("{}")),"CAPTURE");var changed=browserDecode(next,"RECHECK")){
            browserRefuses(()->original.requireSameMetadata(changed));
        }
    }
    @Test public void BROWSER_ARGUMENTS_ownedLifetimeCopiesAndPrivateConstruction()throws Exception {
        byte[] argument=raw("{\"owned_vector\":true}");var owned=browserDecode(browserReply("CAPTURE",argument),"CAPTURE");
        var records=owned.originalArgumentRecords();String expected=records.get(0).argumentSha256;
        var copies=owned.copyArguments();assertArrayEquals(argument,copies.get(0));Arrays.fill(copies.get(0),(byte)0);
        assertEquals(expected,owned.originalArgumentRecords().get(0).argumentSha256);
        var field=NativeOriginalBrowserPreparationWire.OwnedReply.class.getDeclaredField("arguments");field.setAccessible(true);
        @SuppressWarnings("unchecked") var buffers=(java.util.List<byte[]>)field.get(owned);byte[] internal=buffers.get(0);
        owned.close();owned.close();for(byte value:internal)assertEquals(0,value);
        browserRefuses(()->owned.originalArgumentRecords());browserRefuses(()->owned.copyArguments());browserRefuses(()->owned.census());
        assertEquals(expected,records.get(0).argumentSha256); // Previously returned data is immutable, never a live capability.
        var type=NativeOriginalBrowserPreparationWire.OriginalArgumentRecord.class;
        assertTrue(java.lang.reflect.Modifier.isFinal(type.getModifiers()));assertEquals(10,type.getDeclaredFields().length);
        for(var ctor:type.getDeclaredConstructors())assertTrue(java.lang.reflect.Modifier.isPrivate(ctor.getModifiers()));
        for(var f:type.getDeclaredFields()){
            assertTrue(java.lang.reflect.Modifier.isFinal(f.getModifiers()));assertFalse(f.getType().isArray());assertNotEquals(JSONObject.class,f.getType());
        }
    }

    @Test public void BROWSER_SOURCE_goldenCaptureRecheckDetachedArguments()throws Exception {
        byte[] original=raw("{\"note\":\"SYNTHETIC retained source — not a native claim\"}"),second=raw("{\"note\":\"second original\"}");
        JSONObject source=browserReply("CAPTURE",original,second),before=new JSONObject(source.toString()),binding=browserBinding();
        try(var captured=NativeOriginalBrowserPreparationWire.decode(source.toString(),"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,binding);
            var recheck=browserDecode(browserReply("RECHECK",original,second),"RECHECK")){
            binding.put("native_mutation_stamp","SYNTHETIC_CHANGED_CALLER_COPY"); // Cannot retarget the owned decoded metadata.
            captured.requireSameMetadata(recheck);assertTrue(ProviderWireJson.same(before,source));
            JSONObject observation=captured.observation(),census=captured.census();
            observation.getJSONArray("records").getJSONObject(0).put("body_sha256","f".repeat(64));
            census.put("native_authority",true);assertFalse(captured.census().getBoolean("native_authority"));
            assertFalse(ProviderWireJson.same(observation,captured.observation()));
            var copies=captured.copyArguments();assertArrayEquals(original,copies.get(0));assertArrayEquals(second,copies.get(1));
            Arrays.fill(copies.get(0),(byte)0);var again=captured.copyArguments();assertArrayEquals(original,again.get(0));
            for(byte[] bytes:copies)Arrays.fill(bytes,(byte)0);for(byte[] bytes:again)Arrays.fill(bytes,(byte)0);
            assertEquals(0,recheck.copyArguments().size());assertEquals(2,recheck.census().getInt("argument_candidate_count"));
        }
    }
    @Test public void BROWSER_EXISTING_HELD_exactCommandAndOriginalRecheckRemainBound()throws Exception {
        final String command="CAPTURE_EXISTING_HELD";byte[] original=raw("{\"original\":\"held DATA only\"}");
        var reply=browserReply("CAPTURE",original).put("command",command);
        try(var captured=browserDecode(reply,command);var recheck=browserDecode(browserReply("RECHECK",original),"RECHECK")){
            captured.requireSameMetadata(recheck);assertFalse(captured.census().getBoolean("native_authority"));
            assertFalse(captured.census().getBoolean("acknowledged"));
            var copies=captured.copyArguments();try{assertEquals(1,copies.size());assertArrayEquals(original,copies.get(0));}
            finally{for(byte[] bytes:copies)Arrays.fill(bytes,(byte)0);}
        }
        browserRefuses(()->browserDecode(browserReply("CAPTURE",original),command));
        browserRefuses(()->browserDecode(reply,"CAPTURE"));
        browserRefuses(()->browserDecode(new JSONObject(reply.toString()).put("state","RECHECKED_RETAINED_NOT_AUTHORITY"),command));
        browserRefuses(()->browserDecode(new JSONObject(reply.toString()).put("existing_hold_verified",true),command));
        try(var captured=browserDecode(reply,command);
            var changed=NativeOriginalBrowserPreparationWire.decode(
                browserReply("RECHECK",original).put("native_mutation_stamp","different original").toString(),
                "RECHECK",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,
                browserBinding().put("native_mutation_stamp","different original"))){
            browserRefuses(()->captured.requireSameMetadata(changed));
        }
        Arrays.fill(original,(byte)0);
    }
    @Test public void BROWSER_SOURCE_closedPinsTypesStatesAndCommands()throws Exception {
        for(String key:new String[]{"schema","command","reply_token","request_nonce","phase_nonce","operation_id","frame_sha256",
            "original_generation_id","native_mutation_stamp","state","reason"}){
            for(Object wrong:new Object[]{JSONObject.NULL,Boolean.FALSE,1,"foreign"}){
                JSONObject value=browserReply("CAPTURE",raw("{}")).put(key,wrong);browserRefuses(()->browserDecode(value,"CAPTURE"));
            }
            JSONObject value=browserReply("CAPTURE",raw("{}"));value.remove(key);browserRefuses(()->browserDecode(value,"CAPTURE"));
        }
        browserRefuses(()->browserDecode(browserReply("CAPTURE"),"CLOSE"));
        browserRefuses(()->browserDecode(browserReply("CAPTURE").put("permission",false),"CAPTURE"));
        JSONObject source=browserReply("CAPTURE");
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(source.toString(),"CAPTURE","a",BROWSER_REQUEST,BROWSER_PHASE,browserBinding()));
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(source.toString(),"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding().put("frame_sha256",true)));
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(source.toString(),"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding().put("extra",false)));
    }
    @Test public void BROWSER_SOURCE_innerSchemasFalseFlagsAndSessionUnknown()throws Exception {
        for(String key:new String[]{"native_authority","frozen","acknowledged","phone_released"}){
            for(Object wrong:new Object[]{true,0,"false",JSONObject.NULL}){
                JSONObject value=browserReply("CAPTURE");value.getJSONObject("observation").put(key,wrong);browserRefuses(()->browserDecode(value,"CAPTURE"));
            }
        }
        for(String key:new String[]{"native_authority","source_authenticated","frozen","complete_namespace_inventory","current_server_readback",
            "cutoff_eligible","acknowledged","work_accepted","key_removal","phone_released"}){
            JSONObject value=browserReply("CAPTURE");value.getJSONObject("census").put(key,true);browserRefuses(()->browserDecode(value,"CAPTURE"));
        }
        for(String parent:new String[]{"observation","census"})for(String key:new String[]{"schema","state","browser_inventory_state"}){
            JSONObject value=browserReply("CAPTURE");value.getJSONObject(parent).put(key,"foreign");browserRefuses(()->browserDecode(value,"CAPTURE"));
        }
        JSONObject missing=browserReply("CAPTURE");missing.getJSONObject("census").remove("native_semantic_inventory_state");browserRefuses(()->browserDecode(missing,"CAPTURE"));
        JSONObject wrong=browserReply("CAPTURE");wrong.getJSONObject("observation").put("session_storage_state","CAPTURED_READ_ONLY_NOT_AUTHENTICATED");
        browserRefuses(()->browserDecode(wrong,"CAPTURE"));
        JSONObject zero=browserReply("CAPTURE");for(String parent:new String[]{"observation","census"})
            zero.getJSONObject(parent).put("session_record_count",0).put("session_storage_state","CAPTURED_READ_ONLY_NOT_AUTHENTICATED");
        try(var accepted=browserDecode(zero,"CAPTURE")){assertEquals(0,accepted.observation().getInt("session_record_count"));}
    }
    @Test public void BROWSER_SOURCE_countsOriginalRowsAndArgumentMetadata()throws Exception {
        for(String parent:new String[]{"observation","census"})for(String key:new String[]{"record_count","local_record_count","database_count"}){
            for(Object wrong:new Object[]{JSONObject.NULL,-1,1.5,"1",4097}){
                JSONObject value=browserReply("CAPTURE",raw("{}"));value.getJSONObject(parent).put(key,wrong);browserRefuses(()->browserDecode(value,"CAPTURE"));
            }
        }
        // JSONObject serializes integral Double 1.0 as wire integer 1. Test the
        // non-integer JSON TYPE directly, without claiming producer parity.
        String decimal=browserReply("CAPTURE",raw("{}")).toString().replaceFirst("\\\"local_record_count\\\":1","\\\"local_record_count\\\":1.0");
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(decimal,"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding()));
        for(String key:new String[]{"observation_sha256","unresolved_record_count","primary_queue_row_count","argument_candidate_count","ambiguous_argument_candidate_count"}){
            JSONObject value=browserReply("CAPTURE",raw("{}"));value.getJSONObject("census").put(key,key.endsWith("sha256")?"f".repeat(64):3);
            browserRefuses(()->browserDecode(value,"CAPTURE"));
        }
        JSONObject changed=browserReply("CAPTURE",raw("{}"));
        changed.getJSONObject("census").getJSONArray("records").getJSONObject(1).put("body_sha256","e".repeat(64));
        browserRefuses(()->browserDecode(changed,"CAPTURE"));
        JSONObject badHash=browserReply("CAPTURE",raw("{}"));
        badHash.getJSONObject("census").getJSONArray("records").getJSONObject(1).put("argument_values_sha256","f".repeat(64));
        browserRefuses(()->browserDecode(badHash,"CAPTURE"));
        JSONObject duplicate=browserReply("CAPTURE",raw("{}"),raw("{}"));
        duplicate.getJSONObject("census").getJSONArray("records").getJSONObject(2).put("candidate_ordinal",0);
        browserRefuses(()->browserDecode(duplicate,"CAPTURE"));
        JSONObject badRecheck=browserReply("RECHECK",raw("{}")).put("arguments_base64",new org.json.JSONArray().put("e30="));
        browserRefuses(()->browserDecode(badRecheck,"RECHECK"));
        JSONObject shortCapture=browserReply("CAPTURE",raw("{}")).put("arguments_base64",new org.json.JSONArray());
        browserRefuses(()->browserDecode(shortCapture,"CAPTURE"));
    }
    @Test public void BROWSER_SOURCE_canonicalBase64AndExactByteCeilings()throws Exception {
        for(Object value:new Object[]{JSONObject.NULL,7,"","Zg","Zh==","Zg==\n","Zg--"}){
            JSONObject wrong=browserReply("CAPTURE",raw("f"));wrong.getJSONArray("arguments_base64").put(0,value);browserRefuses(()->browserDecode(wrong,"CAPTURE"));
        }
        int cap=NativeOriginalBrowserPreparationWire.MAX_ARGUMENT_BYTES;byte[] full=new byte[cap];Arrays.fill(full,(byte)'x');
        try(var exact=browserDecode(browserReply("CAPTURE",full,full),"CAPTURE")){
            var copies=exact.copyArguments();assertEquals(cap,copies.get(0).length);assertEquals(cap,copies.get(1).length);
            for(byte[] bytes:copies)Arrays.fill(bytes,(byte)0);
        }
        browserRefuses(()->browserDecode(browserReply("CAPTURE",new byte[cap+1]),"CAPTURE"));
        browserRefuses(()->browserDecode(browserReply("CAPTURE",full,full,raw("x")),"CAPTURE"));
        Arrays.fill(full,(byte)0);
    }
    @Test public void BROWSER_SOURCE_rawUtf8ByteLimitNotCharacterLimit()throws Exception {
        String source=browserReply("CAPTURE").toString();int cap=NativeOriginalBrowserPreparationWire.MAX_JSON_BYTES;
        String at=source+" ".repeat(cap-raw(source).length);
        try(var accepted=NativeOriginalBrowserPreparationWire.decode(at,"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding())){
            assertEquals(1,accepted.observation().getInt("record_count"));
        }
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(at+" ","CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding()));
        String multibyte=source.replace("SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY","é".repeat(4096));
        // Bind exact non-ASCII stamp; 4096 characters are allowed, but cap is raw UTF-8 bytes, not Java char count.
        JSONObject binding=browserBinding().put("native_mutation_stamp","é".repeat(4096));
        int baseBytes=raw(multibyte).length;String byteExact=multibyte+" ".repeat(cap-baseBytes);
        try(var accepted=NativeOriginalBrowserPreparationWire.decode(byteExact,"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,binding)){assertNotNull(accepted);}
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(byteExact+" ","CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,binding));
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(source+'\ud800',"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding()));
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decode(null,"CAPTURE",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding()));
    }
    @Test public void BROWSER_SOURCE_structuralRecheckAndExtraDomainRows()throws Exception {
        JSONObject original=browserReply("CAPTURE",raw("{}")),next=browserReply("RECHECK",raw("{}"));
        // An extra retained empty-domain diagnostic is allowed, NOT equated to a captured value row.
        for(JSONObject value:new JSONObject[]{original,next}){
            JSONObject census=value.getJSONObject("census");census.getJSONArray("records").put(new JSONObject().put("kind","EMPTY_DOMAIN_RETAINED_UNKNOWN")
                .put("state","UNAUTHENTICATED_DATABASE_RETAINED_UNKNOWN").put("source_authenticated",false).put("automatic_acceptance",false));
            census.put("record_count",3).put("unresolved_record_count",3);
        }
        try(var captured=browserDecode(original,"CAPTURE");var recheck=browserDecode(next,"RECHECK")){captured.requireSameMetadata(recheck);}
        next.getJSONObject("census").getJSONArray("domains").getJSONObject(0).put("record_count",0);
        try(var captured=browserDecode(original,"CAPTURE");var changed=browserDecode(next,"RECHECK")){browserRefuses(()->captured.requireSameMetadata(changed));}
        JSONObject same=browserReply("RECHECK",raw("{}"));same.getJSONObject("observation").put("database_count",2);
        same.getJSONObject("census").put("database_count",2);
        try(var captured=browserDecode(browserReply("CAPTURE",raw("{}")),"CAPTURE");var changed=browserDecode(same,"RECHECK")){browserRefuses(()->captured.requireSameMetadata(changed));}
        JSONObject reordered=browserReply("RECHECK",raw("{}"));var rows=reordered.getJSONObject("census").getJSONArray("records");
        Object first=rows.get(0);rows.put(0,rows.get(1));rows.put(1,first);
        try(var captured=browserDecode(browserReply("CAPTURE",raw("{}")),"CAPTURE");var changed=browserDecode(reordered,"RECHECK")){browserRefuses(()->captured.requireSameMetadata(changed));}
    }
    @Test public void BROWSER_SOURCE_closeWipesOwnedBytesAndRefusesFutureAccess()throws Exception {
        var owned=browserDecode(browserReply("CAPTURE",raw("{}")),"CAPTURE");
        var field=NativeOriginalBrowserPreparationWire.OwnedReply.class.getDeclaredField("arguments");field.setAccessible(true);
        // Inspect data-buffer erasure only. No private capability is constructed.
        @SuppressWarnings("unchecked") var buffers=(java.util.List<byte[]>)field.get(owned);byte[] original=buffers.get(0);
        var detached=owned.copyArguments();owned.close();owned.close();
        for(byte value:original)assertEquals(0,value);assertArrayEquals(raw("{}"),detached.get(0));
        browserRefuses(()->owned.observation());browserRefuses(()->owned.census());browserRefuses(()->owned.copyArguments());
        browserRefuses(()->owned.requireSameMetadata(owned));for(byte[] bytes:detached)Arrays.fill(bytes,(byte)0);
    }
    @Test public void BROWSER_SOURCE_full4096RecordsNoProviderParserWidening()throws Exception {
        JSONObject value=browserReply("CAPTURE"),observation=value.getJSONObject("observation"),census=value.getJSONObject("census");
        var original=observation.getJSONArray("records").getJSONObject(0);var records=new org.json.JSONArray();var retained=new org.json.JSONArray();
        for(int i=0;i<4096;i++){
            records.put(new JSONObject(original.toString()));
            retained.put(new JSONObject(original.toString()).put("capture_record_ordinal",i).put("kind","LOCAL_ORIGINAL")
                .put("state","LOCAL_ORIGINAL_RETAINED_UNKNOWN").put("source_authenticated",false).put("automatic_acceptance",false));
        }
        observation.put("records",records).put("record_count",4096).put("local_record_count",4096);
        census.put("records",retained).put("record_count",4096).put("local_record_count",4096).put("unresolved_record_count",4096);
        try(var accepted=browserDecode(value,"CAPTURE")){assertEquals(4096,accepted.census().getJSONArray("records").length());}
        assertEquals(16*1024*1024,NativeOriginalBrowserPreparationWire.MAX_JSON_BYTES);
        // Existing strict ProviderWireJson remains unchanged/independently bounded.
        browserRefuses(()->browserDecode(value.put("observation",new org.json.JSONArray()),"CAPTURE"));
    }
    private static JSONObject browserDataMetadata(byte[]... chunks)throws Exception {
        java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");
        var hashes=new org.json.JSONArray();int size=0;
        for(byte[] chunk:chunks){size+=chunk.length;digest.update(chunk);hashes.put(NativeRetainedAttempt.hash(chunk));}
        String hash=java.util.HexFormat.of().formatHex(digest.digest());
        JSONObject result=new JSONObject().put("schema","custodial.browser-original-value-frame.v1").put("encoding","MZBRV001")
            .put("observation_sha256","5".repeat(64)).put("frame_sha256",hash).put("byte_count",size).put("chunk_bytes",1048576)
            .put("chunk_count",chunks.length).put("record_count",1).put("session_storage_state","NOT_DECLARED_UNKNOWN").put("chunk_sha256",hashes);
        for(String key:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"})result.put(key,false);
        return result;
    }
    private static JSONObject browserDataReply(String command,JSONObject metadata,Integer index,byte[] bytes)throws Exception {
        return browserBinding().put("schema","custodial.native-original-browser-data-response.v1").put("command",command)
            .put("reply_token",BROWSER_REPLY_TOKEN).put("request_nonce",BROWSER_REQUEST).put("phase_nonce",BROWSER_PHASE)
            .put("state","DATA_FRAME".equals(command)?"VALUE_FRAME_RETAINED_NOT_AUTHORITY":"VALUE_CHUNK_RETAINED_NOT_AUTHORITY")
            .put("data_frame",new JSONObject(metadata.toString())).put("chunk_index",index==null?JSONObject.NULL:index)
            .put("chunk_base64",bytes==null?"":java.util.Base64.getEncoder().encodeToString(bytes)).put("reason","");
    }
    private static NativeOriginalBrowserPreparationWire.OwnedDataReply browserDataDecode(JSONObject reply,String command,int index)throws Exception {
        return NativeOriginalBrowserPreparationWire.decodeData(reply.toString(),command,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,
            browserBinding(),browserReply("CAPTURE").getJSONObject("observation"),index);
    }
    @Test public void BROWSER_DATA_originalFrameChunksAndDetachedLifetime()throws Exception {
        byte[] first=new byte[1048576],last={7,0,-1};Arrays.fill(first,(byte)37);
        JSONObject metadata=browserDataMetadata(first,last);
        var frame=browserDataDecode(browserDataReply("DATA_FRAME",metadata,null,null),"DATA_FRAME",-1);
        try(frame){
            JSONObject detached=frame.metadata();detached.put("durable_retention",true);assertFalse(frame.metadata().getBoolean("durable_retention"));
            browserRefuses(()->frame.copyChunk());
            for(int i=0;i<2;i++){
                byte[] original=i==0?first:last;
                var chunk=browserDataDecode(browserDataReply("DATA_CHUNK",metadata,i,original),"DATA_CHUNK",i);
                try(chunk){byte[] copy=chunk.copyChunk();assertArrayEquals(original,copy);Arrays.fill(copy,(byte)0);
                    byte[] again=chunk.copyChunk();assertArrayEquals(original,again);Arrays.fill(again,(byte)0);}
                browserRefuses(()->chunk.copyChunk());browserRefuses(()->chunk.metadata());
            }
        }
        browserRefuses(()->frame.metadata());Arrays.fill(first,(byte)0);Arrays.fill(last,(byte)0);
    }
    @Test public void BROWSER_DATA_closedOriginalMetadataAndChunkPins()throws Exception {
        byte[] bytes={1,2,3};JSONObject metadata=browserDataMetadata(bytes);
        for(String key:new String[]{"schema","command","reply_token","request_nonce","phase_nonce","operation_id","frame_sha256",
            "original_generation_id","native_mutation_stamp","state","reason"}){
            JSONObject value=browserDataReply("DATA_FRAME",metadata,null,null).put(key,"foreign");
            browserRefuses(()->browserDataDecode(value,"DATA_FRAME",-1));
        }
        for(String key:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"}){
            JSONObject bad=new JSONObject(metadata.toString()).put(key,true);
            browserRefuses(()->browserDataDecode(browserDataReply("DATA_FRAME",bad,null,null),"DATA_FRAME",-1));
        }
        JSONObject bad=new JSONObject(metadata.toString()).put("observation_sha256","f".repeat(64));
        browserRefuses(()->browserDataDecode(browserDataReply("DATA_FRAME",bad,null,null),"DATA_FRAME",-1));
        JSONObject changed=browserDataReply("DATA_CHUNK",metadata,0,new byte[]{1,2,4});
        browserRefuses(()->browserDataDecode(changed,"DATA_CHUNK",0));
        JSONObject extra=browserDataReply("DATA_FRAME",metadata,null,null).put("authority",false);
        browserRefuses(()->browserDataDecode(extra,"DATA_FRAME",-1));
        JSONObject padded=browserDataReply("DATA_CHUNK",metadata,0,bytes).put("chunk_base64","AQID\n");
        browserRefuses(()->browserDataDecode(padded,"DATA_CHUNK",0));
    }
    @Test public void BROWSER_DATA_sizeIndexAndUnknownOutcomesRefuse()throws Exception {
        byte[] bytes={1,2,3};JSONObject metadata=browserDataMetadata(bytes);
        for(String key:new String[]{"byte_count","chunk_bytes","chunk_count","record_count"})for(Object badValue:new Object[]{-1,0,"1",67108865}){
            JSONObject bad=new JSONObject(metadata.toString()).put(key,badValue);
            browserRefuses(()->browserDataDecode(browserDataReply("DATA_FRAME",bad,null,null),"DATA_FRAME",-1));
        }
        browserRefuses(()->browserDataDecode(browserDataReply("DATA_FRAME",metadata,0,null),"DATA_FRAME",-1));
        browserRefuses(()->browserDataDecode(browserDataReply("DATA_CHUNK",metadata,0,bytes),"DATA_CHUNK",1));
        browserRefuses(()->browserDataDecode(browserDataReply("DATA_FRAME",metadata,null,null),"DATA_FRAME",0));
        JSONObject unknown=browserDataReply("DATA_CHUNK",metadata,0,bytes).put("state","UNRESOLVED_RETAINED").put("reason","browser_original_values_unavailable");
        browserRefuses(()->browserDataDecode(unknown,"DATA_CHUNK",0));
    }

    // Fixed-format vectors only. Golden hashes below were independently derived
    // with the frozen Source JSON.stringify/UTF16BE transcript (not this reader).
    private static final String VALUE_UNKNOWN="4cade77ba3f47d386818d84de938dc79f476c482b5498c07940eddbf750baccf";
    private static final String VALUE_KNOWN="42f9cc2a95c14f8b511c4905e088eed8a9036d7902da429e97a831bd1c60db44";
    private static final String VALUE_LONG_HASH="6b993478d3a094964f8b5d4667d5671b451bc4e1c93d3a0e00b03491f2100154";
    private static final String VALUE_LONG_KEY="c812f62d5f79193fd33ee1e0cb38403241caf15ae2f7dc911bcfbd509b01c0ac";
    private static final String VALUE_LONG_BODY="92b8296d5426b112681b7bc0c22aa3061ab1e1f4d9b1b58009dec42fa79a37a7";
    private static Object[] va(Object... values){return values;}
    private static Object[] valueOne(Object value){return new Object[]{value};}
    private static Object[] valueTree(boolean known) {
        Object[] key=va("string","key");
        Object[] value=va("object",va(
            va("bits",va("float64","8000000000000000")),
            va("buffer",va("binary","[object Uint8Array]",1,2,4,"00112233")),
            va("date",va("date",-0.0d)),va("missing",va("undefined")),
            va("pair",va("array",va(va("hole"),va("null"),va("boolean",true),va("float64","7ff8000000000001")))),
            va("text",va("string","\udfff\u2028"))));
        return va(va(va("","quote\"\\\b\f\n\r\t\u0000\u001f/\u2028\u2029\ud800x\udc00\ud83d\ude00"),
            va("unknown\ud800","foreign raw {\"danger\":9007199254740993}")),
            known?va():null,valueOne(va(va("db",7),valueOne(va("store",valueOne(va(key,value)))))));
    }
    private static JSONObject valueObservation(boolean known)throws Exception {
        JSONObject o=browserReply("CAPTURE").getJSONObject("observation");
        var rows=new org.json.JSONArray();
        String[][] hashes={
            {"6cf7546d02477cea8c8848763b80ee427a6ee7a866039bc6c05b9abdc8fd9321","b6661f5d536c1cbf5ee2d2887df84bbcfc757dd6296de2718c923809326e61d7"},
            {"83ed3e04b7f326b598cc71c363d342928b05348e6bbc847b52a3a5922d2d4d91","e02a08cde2ff0beea6389a0742f2ea2c074e112b4cb9e88ba170da1d139d3d66"},
            {"4521cd7846e5352464fe7e9895cab3feb2d00a814a0ebdeb24299b54cde5c677","22a32e0366cec19f5822c90df648653d980a7cbba436ea06b538d4fb077e223d"}};
        for(int i=0;i<3;i++){
            JSONObject r=new JSONObject().put("store",i<2?"localStorage":"indexedDB").put("key_sha256",hashes[i][0]).put("body_sha256",hashes[i][1]);
            if(i==2)r.put("database","db").put("version",7).put("object_store","store");
            rows.put(r);
        }
        return o.put("observation_sha256",known?VALUE_KNOWN:VALUE_UNKNOWN).put("local_record_count",2)
            .put("session_record_count",known?0:JSONObject.NULL)
            .put("session_storage_state",known?"CAPTURED_READ_ONLY_NOT_AUTHENTICATED":"NOT_DECLARED_UNKNOWN")
            .put("database_count",1).put("record_count",3).put("records",rows);
    }
    private static void valueEncode(java.io.DataOutputStream out,Object value)throws Exception {
        if(value==null){out.writeByte(0);return;}
        if(value instanceof Boolean){out.writeByte(Boolean.TRUE.equals(value)?2:1);return;}
        if(value instanceof Number){out.writeByte(3);out.writeDouble(((Number)value).doubleValue());return;}
        if(value instanceof String){String s=(String)value;out.writeByte(4);out.writeInt(s.length());for(int i=0;i<s.length();i++)out.writeChar(s.charAt(i));return;}
        Object[] array=(Object[])value;out.writeByte(5);out.writeInt(array.length);
        for(Object v:array)valueEncode(out,v);
    }
    private static byte[] valueBytes(Object tree,JSONObject observation)throws Exception {
        var bytes=new java.io.ByteArrayOutputStream();var out=new java.io.DataOutputStream(bytes);
        out.write("MZBRV001".getBytes(StandardCharsets.US_ASCII));
        out.write(java.util.HexFormat.of().parseHex(observation.getString("observation_sha256")));
        out.writeInt(observation.getInt("local_record_count"));
        out.writeInt(observation.isNull("session_record_count")?-1:observation.getInt("session_record_count"));
        out.writeInt(observation.getInt("database_count"));out.writeInt(observation.getInt("record_count"));
        valueEncode(out,tree);out.flush();return bytes.toByteArray();
    }
    private static java.util.List<byte[]> valueChunks(byte[] bytes){
        var chunks=new java.util.ArrayList<byte[]>();
        for(int i=0;i<bytes.length;i+=1048576)chunks.add(Arrays.copyOfRange(bytes,i,Math.min(bytes.length,i+1048576)));
        return chunks;
    }
    private static JSONObject valueMetadata(java.util.List<byte[]> chunks,JSONObject o)throws Exception {
        return browserDataMetadata(chunks.toArray(new byte[0][])).put("observation_sha256",o.getString("observation_sha256"))
            .put("record_count",o.getInt("record_count")).put("session_storage_state",o.getString("session_storage_state"));
    }
    private static void valueAccept(byte[] bytes,JSONObject o)throws Exception {
        var chunks=valueChunks(bytes);JSONObject m=valueMetadata(chunks,o);
        var before=new java.util.ArrayList<byte[]>();for(byte[] c:chunks)before.add(c.clone());
        NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(m,o,chunks);
        for(int i=0;i<chunks.size();i++)assertArrayEquals(before.get(i),chunks.get(i));
    }
    private static void valueRefuse(byte[] bytes,JSONObject o)throws Exception {
        var chunks=valueChunks(bytes);JSONObject m=valueMetadata(chunks,o);
        var before=new java.util.ArrayList<byte[]>();for(byte[] c:chunks)before.add(c.clone());
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(m,o,chunks));
        for(int i=0;i<chunks.size();i++)assertArrayEquals(before.get(i),chunks.get(i));
    }
    // Typed results below come only from the real binary reader. These fixed
    // vectors do not authenticate Source, custody, owner, or semantic meaning.
    @Test public void BROWSER_RECORDS_originalBinaryRowsImmutableAndUnresolved()throws Exception {
        JSONObject o=valueObservation(false);var chunks=valueChunks(valueBytes(valueTree(false),o));JSONObject m=valueMetadata(chunks,o);
        var before=new java.util.ArrayList<byte[]>();for(byte[] chunk:chunks)before.add(chunk.clone());
        var held=NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(m,o,chunks);
        assertEquals(VALUE_UNKNOWN,held.observationSha256);assertEquals(m.getString("frame_sha256"),held.frameSha256);
        assertEquals(3,held.recordCount);assertEquals("NOT_DECLARED_UNKNOWN",held.sessionStorageState);
        var entries=held.originalRecords();assertEquals(3,entries.size());
        for(int i=0;i<entries.size();i++){
            var entry=entries.get(i);JSONObject expected=o.getJSONArray("records").getJSONObject(i);
            assertEquals(i,entry.ordinal);assertEquals(expected.getString("store"),entry.store);
            assertEquals(expected.getString("key_sha256"),entry.keySha256);assertEquals(expected.getString("body_sha256"),entry.bodySha256);
            assertEquals("UNRESOLVED_RETAINED",entry.semanticDisposition);
            if(i<2){assertNull(entry.database);assertNull(entry.version);assertNull(entry.objectStore);}
            else{assertEquals("db",entry.database);assertEquals(Long.valueOf(7),entry.version);assertEquals("store",entry.objectStore);}
        }
        try{entries.clear();fail("mutable original record list");}catch(UnsupportedOperationException expected){}
        try{entries.add(entries.get(0));fail("appendable original record list");}catch(UnsupportedOperationException expected){}
        for(int i=0;i<chunks.size();i++)assertArrayEquals(before.get(i),chunks.get(i));
        String frameHash=held.frameSha256,keyHash=entries.get(0).keySha256;
        m.put("frame_sha256","0".repeat(64));o.getJSONArray("records").getJSONObject(0).put("key_sha256","0".repeat(64));
        for(byte[] chunk:chunks)Arrays.fill(chunk,(byte)0);
        assertEquals(frameHash,held.frameSha256);assertEquals(keyHash,entries.get(0).keySha256);assertEquals(3,held.recordCount);
    }
    @Test public void BROWSER_RECORDS_duplicateIdbPrimaryKeysRemainOrdinalRows()throws Exception {
        // Independent Source JSON.stringify/UTF16BE hashes: Node receipt602c6e.
        String key="f508319340a46c1a8d7ef3a8de85d32f19ada710ba2826245901633f863c5dd7";
        String a="e9d7ed59bb6f40736bbfc3e648fdf306bfb8dde66c781aa3a92f2647e4e9fa55";
        String b="0f4baa2385c23a3ebbf690f44729dff5e4f286c79a925762d638c6a22ebafda8";
        var rows=new org.json.JSONArray();
        for(String body:new String[]{a,b,a})rows.put(new JSONObject().put("store","indexedDB").put("database","db")
            .put("version",7).put("object_store","store").put("key_sha256",key).put("body_sha256",body));
        JSONObject o=valueObservation(false).put("local_record_count",0).put("record_count",3).put("records",rows)
            .put("observation_sha256","ca9ba77731fd702acc9c9f466336a596d31c60f5fe7f16b71034f7dab9af1bd2");
        Object[] tree=va(va(),null,valueOne(va(va("db",7),valueOne(va("store",va(
            va(va("string","same"),va("undefined")),va(va("string","same"),va("object",va())),va(va("string","same"),va("undefined"))))))));
        var chunks=valueChunks(valueBytes(tree,o));var held=NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(valueMetadata(chunks,o),o,chunks);
        assertEquals(3,held.recordCount);assertEquals(3,held.originalRecords().size());
        for(int i=0;i<3;i++){
            var entry=held.originalRecords().get(i);assertEquals(i,entry.ordinal);assertEquals(key,entry.keySha256);
            assertEquals(i==1?b:a,entry.bodySha256);assertEquals("UNRESOLVED_RETAINED",entry.semanticDisposition);
        }
        assertNotSame(held.originalRecords().get(0),held.originalRecords().get(2));
    }
    @Test public void BROWSER_RECORDS_emptyAndUnknownSessionRemainDistinct()throws Exception {
        for(boolean known:new boolean[]{false,true}){
            JSONObject o=valueObservation(known).put("local_record_count",0).put("database_count",0).put("record_count",0)
                .put("records",new org.json.JSONArray()).put("observation_sha256",known
                    ?"0f2dac9760eb8fad5a846f39085166ab82ec1c7eb029d52cfdec148fd5c76329"
                    :"f07ff3ef47237ec70ddb98f7a7e3fb08ad2122ccc7b1c3ee8d8c238d3e99f85c");
            var chunks=valueChunks(valueBytes(va(va(),known?va():null,va()),o));
            var held=NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(valueMetadata(chunks,o),o,chunks);
            assertEquals(0,held.recordCount);assertTrue(held.originalRecords().isEmpty());
            assertEquals(known?"CAPTURED_READ_ONLY_NOT_AUTHENTICATED":"NOT_DECLARED_UNKNOWN",held.sessionStorageState);
        }
    }
    @Test public void BROWSER_RECORDS_declaredRowAndFrameMismatchNeverPublishes()throws Exception {
        for(String changed:new String[]{"key_sha256","body_sha256","object_store"}){
            JSONObject o=valueObservation(false);var chunks=valueChunks(valueBytes(valueTree(false),o));JSONObject m=valueMetadata(chunks,o);
            o.getJSONArray("records").getJSONObject(2).put(changed,changed.equals("object_store")?"foreign":"0".repeat(64));
            var published=new java.util.concurrent.atomic.AtomicReference<NativeOriginalBrowserValueFrame.OriginalRecords>();
            browserRefuses(()->published.set(NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(m,o,chunks)));assertNull(published.get());
        }
        JSONObject o=valueObservation(false);var chunks=valueChunks(valueBytes(valueTree(false),o));JSONObject m=valueMetadata(chunks,o);
        var before=chunks.get(0).clone();m.put("frame_sha256","0".repeat(64));
        browserRefuses(()->NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(m,o,chunks));assertArrayEquals(before,chunks.get(0));
        var tail=valueChunks(Arrays.copyOf(before,before.length+1));JSONObject tailMetadata=valueMetadata(tail,o);
        browserRefuses(()->NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(tailMetadata,o,tail));
    }
    @Test public void BROWSER_RECORDS_changedLoansAndExpectedGraphsNeverPublish()throws Exception {
        for(int kind=0;kind<3;kind++){
            final int mode=kind;JSONObject o=valueObservation(false);var chunks=valueChunks(valueBytes(valueTree(false),o));JSONObject m=valueMetadata(chunks,o);
            final byte[] before=chunks.get(0).clone();
            var changing=new java.util.AbstractList<byte[]>(){
                int reads;
                public int size(){return chunks.size();}
                public byte[] get(int i){
                    reads++;
                    if(mode==0&&reads==2)chunks.get(0)[100]^=1;
                    if(mode==1&&reads==1)m.put("native_authority",true);
                    if(mode==2&&reads==1)o.getJSONArray("records").getJSONObject(0).put("body_sha256","0".repeat(64));
                    return chunks.get(i);
                }
            };
            var published=new java.util.concurrent.atomic.AtomicReference<NativeOriginalBrowserValueFrame.OriginalRecords>();
            browserRefuses(()->published.set(NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(m,o,changing)));assertNull(published.get());
            if(mode==0)before[100]^=1;assertArrayEquals(before,chunks.get(0));
        }
    }
    @Test public void BROWSER_RECORDS_legacyVoidWrapperDelegatesUnchanged()throws Exception {
        JSONObject o=valueObservation(false);var chunks=valueChunks(valueBytes(valueTree(false),o));JSONObject m=valueMetadata(chunks,o);
        NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(m,o,chunks);
        assertEquals(3,NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(m,o,chunks).recordCount);
        JSONObject bad=new JSONObject(m.toString()).put("record_count",2);
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(bad,o,chunks));
        browserRefuses(()->NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(bad,o,chunks));
    }

    @Test public void BROWSER_VALUE_losslessGoldenOpaqueTagsAndSessionDistinction()throws Exception {
        for(boolean known:new boolean[]{false,true}){
            JSONObject o=valueObservation(known);byte[] bytes=valueBytes(valueTree(known),o);
            valueAccept(bytes,o);
        }
        JSONObject empty=valueObservation(false).put("local_record_count",0).put("database_count",0).put("record_count",0)
            .put("records",new org.json.JSONArray()).put("observation_sha256","f07ff3ef47237ec70ddb98f7a7e3fb08ad2122ccc7b1c3ee8d8c238d3e99f85c");
        valueAccept(valueBytes(va(va(),null,va()),empty),empty);
        valueRefuse(valueBytes(va(va(),va(),va()),empty),empty);
    }
    @Test public void BROWSER_VALUE_headerBodyTailAndOriginalDigestRefuse()throws Exception {
        JSONObject o=valueObservation(false);byte[] bytes=valueBytes(valueTree(false),o);
        for(int offset:new int[]{0,8,40,44,48,52,56}){
            byte[] bad=bytes.clone();bad[offset]^=1;valueRefuse(bad,o);
        }
        valueRefuse(Arrays.copyOf(bytes,bytes.length-1),o);
        valueRefuse(Arrays.copyOf(bytes,bytes.length+1),o);
        byte[] unknown=bytes.clone();unknown[61]=9;valueRefuse(unknown,o);
        JSONObject changed=new JSONObject(o.toString()).put("observation_sha256","b".repeat(64));
        valueRefuse(valueBytes(valueTree(false),changed),changed);
    }
    @Test public void BROWSER_VALUE_orderShapeAndPerRecordCoverageRefuse()throws Exception {
        JSONObject o=valueObservation(false);
        Object[] tree=valueTree(false),local=(Object[])tree[0];Object first=local[0];local[0]=local[1];local[1]=first;
        valueRefuse(valueBytes(tree,o),o);
        tree=valueTree(false);local=(Object[])tree[0];local[1]=local[0];valueRefuse(valueBytes(tree,o),o);
        tree=valueTree(false);tree[2]=valueOne(va(va("db",7),va(va("store",va()),va("store",va()))));
        valueRefuse(valueBytes(tree,o),o);
        tree=valueTree(false);tree[2]=va(va(va("z",7),va()),va(va("db",7),va()));
        valueRefuse(valueBytes(tree,o),o);
        JSONObject changed=new JSONObject(o.toString());changed.getJSONArray("records").getJSONObject(2).put("body_sha256","a".repeat(64));
        valueRefuse(valueBytes(valueTree(false),changed),changed);
        changed=new JSONObject(o.toString());changed.getJSONArray("records").getJSONObject(2).put("object_store","successor");
        valueRefuse(valueBytes(valueTree(false),changed),changed);
    }
    @Test public void BROWSER_VALUE_closedMetadataCountsTypesAndFalseFlags()throws Exception {
        JSONObject o=valueObservation(false);byte[] bytes=valueBytes(valueTree(false),o);var chunks=valueChunks(bytes);
        JSONObject good=valueMetadata(chunks,o);
        for(String key:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"}){
            JSONObject bad=new JSONObject(good.toString()).put(key,true);
            browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(bad,o,chunks));
        }
        for(String key:new String[]{"byte_count","chunk_count","record_count","chunk_bytes"}){
            JSONObject bad=new JSONObject(good.toString()).put(key,"3");
            browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(bad,o,chunks));
        }
        for(JSONObject bad:new JSONObject[]{new JSONObject(good.toString()).put("extra",false),
            new JSONObject(good.toString()).put("byte_count",67108865),new JSONObject(good.toString()).put("chunk_count",65),
            new JSONObject(good.toString()).put("session_storage_state","CAPTURED_READ_ONLY_NOT_AUTHENTICATED")}){
            browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(bad,o,chunks));
        }
        final JSONObject changed=new JSONObject(o.toString()).put("native_authority",true);
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(good,changed,chunks));
        final JSONObject badSession=new JSONObject(o.toString()).put("session_record_count",-1);
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(good,badSession,chunks));
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(good,o,null));
    }
    @Test public void BROWSER_VALUE_numericComplexityAndTruncatedLengthsRefuse()throws Exception {
        JSONObject o=valueObservation(false);
        for(double n:new double[]{Double.NaN,Double.POSITIVE_INFINITY,1.5d,9007199254740992d}){
            Object[] tree=valueTree(false);tree[2]=valueOne(va(va("db",n),va()));
            valueRefuse(valueBytes(tree,o),o);
        }
        Object deep=va("undefined");for(int i=0;i<194;i++)deep=va(deep);
        Object[] tree=valueTree(false);tree[2]=valueOne(va(va("db",7),valueOne(va("store",valueOne(va(va("string","key"),deep))))));
        valueRefuse(valueBytes(tree,o),o);
        byte[] bytes=valueBytes(valueTree(false),o);
        // First local row key string declares an impossible unsigned length.
        Arrays.fill(bytes,72,76,(byte)0xff);valueRefuse(bytes,o);
    }
    @Test public void BROWSER_VALUE_chunkBoundariesDigestOrderAndBorrowedMutation()throws Exception {
        JSONObject o=valueObservation(false).put("observation_sha256",VALUE_LONG_HASH)
            .put("local_record_count",1).put("database_count",0).put("record_count",1)
            .put("records",new org.json.JSONArray().put(new JSONObject().put("store","localStorage")
                .put("key_sha256",VALUE_LONG_KEY).put("body_sha256",VALUE_LONG_BODY)));
        byte[] bytes=valueBytes(va(valueOne(va("key","x".repeat(600000))),null,va()),o);
        valueAccept(bytes,o);var chunks=valueChunks(bytes);assertEquals(2,chunks.size());JSONObject metadata=valueMetadata(chunks,o);
        byte[] before=chunks.get(0).clone();chunks.get(0)[100]^=1;
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(metadata,o,chunks));
        chunks.set(0,before);java.util.Collections.reverse(chunks);
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(metadata,o,chunks));
        var original=valueChunks(bytes);JSONObject m=valueMetadata(original,o);
        var changing=new java.util.AbstractList<byte[]>(){
            int reads;
            public int size(){return original.size();}
            public byte[] get(int i){if(++reads==3)original.get(0)[100]^=1;return original.get(i);}
        };
        browserRefuses(()->NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(m,o,changing));
    }


    // Test entrypoint only: no Source authentication, file lookup or custody.
    private static void consumeBrowserValueSourceFixture(java.io.InputStream input)throws Exception {
        final int maximum=8*1024*1024;
        byte[] receive=new byte[maximum+1],raw=null;
        var chunks=new java.util.ArrayList<byte[]>(64);
        try {
            int size=0;
            while(size<receive.length){
                int n=input.read(receive,size,receive.length-size);
                if(n==-1)break;if(n<=0)throw new Exception();size+=n;
            }
            if(size<1||size>maximum)throw new Exception();
            raw=Arrays.copyOf(receive,size);
            JSONObject fixture=ProviderWireJson.object(raw,maximum);
            NativeRetainedAttempt.keys(fixture,"schema","source_sha256","observation","metadata","chunks_base64");
            if(!"custodial.browser-original-value-source-fixture.v1".equals(fixture.get("schema"))
                ||!(fixture.get("source_sha256") instanceof String)
                ||!((String)fixture.get("source_sha256")).matches("[0-9a-f]{64}"))throw new Exception();
            // This hash is a fixture provenance label, never Source authentication.
            var encoded=fixture.getJSONArray("chunks_base64");
            if(encoded.length()<1||encoded.length()>64)throw new Exception();
            for(int i=0;i<encoded.length();i++){
                Object v=encoded.get(i);
                if(!(v instanceof String)||((String)v).isEmpty()||((String)v).length()>4*((1048576+2)/3))throw new Exception();
                byte[] bytes=java.util.Base64.getDecoder().decode((String)v);chunks.add(bytes);
                if(bytes.length<1||bytes.length>1048576||!java.util.Base64.getEncoder().encodeToString(bytes).equals(v))throw new Exception();
            }
            NativeOriginalBrowserValueFrame.requireCompleteOriginalValues(fixture.getJSONObject("metadata"),
                fixture.getJSONObject("observation"),chunks);
        }catch(Exception invalid){throw new VaultFailure(NativeOriginalBrowserPreparationWire.FAILURE);}
        finally{
            for(byte[] bytes:chunks)Arrays.fill(bytes,(byte)0);
            Arrays.fill(receive,(byte)0);if(raw!=null)Arrays.fill(raw,(byte)0);
            // Dropping parsed JSON Strings is not a Java String secure-erasure claim.
        }
    }
    @Test public void BROWSER_VALUE_rawDepth63TaggedOriginalRemainsComplete()throws Exception {
        // Raw Source encodedValue depth63 is legal (limit64). Each nested object
        // adds three tagged arrays; DB/row/root wrappers bring this above192.
        Object value=va("string","leaf");
        for(int i=0;i<63;i++)value=va("object",valueOne(va("child",value)));
        Object[] tree=va(va(),null,valueOne(va(va("deep-db",1),
            valueOne(va("deep-store",valueOne(va(va("string","deep-key"),value)))))));
        JSONObject o=valueObservation(false).put("local_record_count",0).put("database_count",1).put("record_count",1)
            .put("observation_sha256","4655f95a1b3bd0fc4623b41fea136a7cb183d1e359db6deb6ce4a1f2f850aa8a")
            .put("records",new org.json.JSONArray().put(new JSONObject().put("store","indexedDB").put("database","deep-db")
                .put("version",1).put("object_store","deep-store")
                .put("key_sha256","ed5141752bb94fd8b1085aa0ad580c7147548805d1257925e5b4673f1dd2716d")
                .put("body_sha256","b85c71a4b765388d9ed1711a6f93eb230d6d958a6a2142949d0dcce705a4c3fe")));
        valueAccept(valueBytes(tree,o),o);
    }
    @Test public void BROWSER_VALUE_sourceFixtureRouteClosedBoundedAndCanonical()throws Exception {
        JSONObject o=valueObservation(false).put("local_record_count",0).put("database_count",0).put("record_count",0)
            .put("records",new org.json.JSONArray()).put("observation_sha256","f07ff3ef47237ec70ddb98f7a7e3fb08ad2122ccc7b1c3ee8d8c238d3e99f85c");
        byte[] bytes=valueBytes(va(va(),null,va()),o);var chunks=valueChunks(bytes);
        JSONObject fixture=new JSONObject().put("schema","custodial.browser-original-value-source-fixture.v1")
            .put("source_sha256","0".repeat(64)).put("observation",o).put("metadata",valueMetadata(chunks,o))
            .put("chunks_base64",new org.json.JSONArray().put(java.util.Base64.getEncoder().encodeToString(bytes)));
        byte[] raw=raw(fixture),before=raw.clone();
        consumeBrowserValueSourceFixture(new java.io.ByteArrayInputStream(raw));assertArrayEquals(before,raw);
        for(JSONObject bad:new JSONObject[]{new JSONObject(fixture.toString()).put("extra",false),
            new JSONObject(fixture.toString()).put("source_sha256","not-auth"),
            new JSONObject(fixture.toString()).put("schema","foreign"),
            new JSONObject(fixture.toString()).put("chunks_base64",new org.json.JSONArray().put("Zg")),
            new JSONObject(fixture.toString()).put("chunks_base64",new org.json.JSONArray().put("Zh==")),
            new JSONObject(fixture.toString()).put("chunks_base64",new org.json.JSONArray().put(1))}){
            browserRefuses(()->consumeBrowserValueSourceFixture(new java.io.ByteArrayInputStream(raw(bad))));
        }
        String duplicate="{\"schema\":\"custodial.browser-original-value-source-fixture.v1\","+fixture.toString().substring(1);
        browserRefuses(()->consumeBrowserValueSourceFixture(new java.io.ByteArrayInputStream(raw(duplicate))));
        byte[] malformed=raw.clone();malformed[0]=(byte)0xff;
        browserRefuses(()->consumeBrowserValueSourceFixture(new java.io.ByteArrayInputStream(malformed)));
        browserRefuses(()->consumeBrowserValueSourceFixture(new java.io.ByteArrayInputStream(new byte[8*1024*1024+1])));
        var tooMany=new org.json.JSONArray();for(int i=0;i<65;i++)tooMany.put("AA==");
        JSONObject over=new JSONObject(fixture.toString()).put("chunks_base64",tooMany);
        browserRefuses(()->consumeBrowserValueSourceFixture(new java.io.ByteArrayInputStream(raw(over))));
        assertArrayEquals(before,raw);
    }


    // Journal DATA documents only; these fixtures do not simulate AEAD, a
    // privately authenticated journal, owner currentness or restart promotion.
    private static final String JOURNAL_PLAN="9".repeat(64);
    private static JSONObject journalDocument(JSONObject metadata,JSONObject binding,int index,byte[] chunk)throws Exception {
        return new JSONObject().put("schema","custodial.native-private-custody-exchange-evidence.v1")
            .put("entry_key",index<0?"browser_frame-0":"browser_chunk-"+index)
            .put("operation_id",binding.get("operation_id")).put("plan_sha256",JOURNAL_PLAN)
            .put("kind",index<0?"BROWSER_FRAME":"BROWSER_CHUNK")
            .put("original_browser_binding",new JSONObject(binding.toString())).put("browser_value_frame",new JSONObject(metadata.toString()))
            .put("chunk_index",index<0?JSONObject.NULL:index)
            .put("chunk_base64",index<0?"":java.util.Base64.getEncoder().encodeToString(chunk))
            .put("local_preservation_only",true).put("inventory_acknowledged",false).put("work_accepted",false)
            .put("finalizer_allowed",false).put("key_removal",false);
    }
    private static NativeOriginalBrowserJournalDocument.Owned journalDecode(JSONObject doc,JSONObject metadata)throws Exception {
        return NativeOriginalBrowserJournalDocument.decode(doc.toString(),doc.getString("entry_key"),
            browserBinding().getString("operation_id"),JOURNAL_PLAN,browserBinding(),metadata);
    }
    private static void journalRefuses(Checked operation)throws Exception {
        try{operation.run();fail("invalid journal DATA document accepted");}
        catch(VaultFailure invalid){assertEquals(NativeOriginalBrowserJournalDocument.FAILURE,invalid.code);}
    }
    private static byte[] journalBytes(){byte[] b=new byte[137];for(int i=0;i<b.length;i++)b[i]=(byte)(i*37);return b;}
    @Test public void BROWSER_JOURNAL_originalFrameChunksDetachedAndClose()throws Exception {
        byte[] first=new byte[1048576];for(int i=0;i<first.length;i++)first[i]=(byte)(i*31);
        byte[] last={0,3,-1,6,9},firstBefore=first.clone(),lastBefore=last.clone();
        JSONObject metadata=browserDataMetadata(first,last),binding=browserBinding();
        JSONObject frameDoc=journalDocument(metadata,binding,-1,null);
        try(var frame=journalDecode(frameDoc,null)){
            assertTrue(frame.isFrame());assertEquals(-1,frame.chunkIndex());assertEquals(0,frame.copyChunk().length);
            JSONObject detached=frame.frameMetadata();detached.put("durable_retention",true);
            assertFalse(frame.frameMetadata().getBoolean("durable_retention"));
        }
        for(int i=0;i<2;i++){
            byte[] original=i==0?first:last;var owned=journalDecode(journalDocument(metadata,binding,i,original),metadata);
            assertFalse(owned.isFrame());assertEquals(i,owned.chunkIndex());assertArrayEquals(original,owned.copyChunk());
            byte[] copy=owned.copyChunk();Arrays.fill(copy,(byte)0);assertArrayEquals(original,owned.copyChunk());
            // Inspect erasure of DATA only; never construct a private capability.
            var f=NativeOriginalBrowserJournalDocument.Owned.class.getDeclaredField("chunk");f.setAccessible(true);
            byte[] internal=(byte[])f.get(owned);owned.close();owned.close();for(byte b:internal)assertEquals(0,b);
            journalRefuses(()->owned.copyChunk());journalRefuses(()->owned.frameMetadata());
            journalRefuses(()->owned.isFrame());journalRefuses(()->owned.chunkIndex());
        }
        assertArrayEquals(firstBefore,first);assertArrayEquals(lastBefore,last);
        try(var frame=journalDecode(frameDoc,metadata)){assertTrue(ProviderWireJson.same(metadata,frame.frameMetadata()));}
        for(String session:new String[]{"NOT_DECLARED_UNKNOWN","CAPTURED_READ_ONLY_NOT_AUTHENTICATED"}){
            JSONObject next=new JSONObject(metadata.toString()).put("session_storage_state",session);
            try(var frame=journalDecode(journalDocument(next,binding,-1,null),next)){assertTrue(frame.isFrame());}
        }
    }
    @Test public void BROWSER_JOURNAL_exactParentPlanBindingAndEntryPins()throws Exception {
        byte[] bytes=journalBytes();JSONObject metadata=browserDataMetadata(bytes),binding=browserBinding();
        JSONObject doc=journalDocument(metadata,binding,0,bytes);String original=doc.toString();
        for(String key:new String[]{"schema","entry_key","operation_id","plan_sha256","kind"}){
            JSONObject bad=new JSONObject(original).put(key,"foreign");
            journalRefuses(()->journalDecode(bad,metadata));
        }
        for(String key:new String[]{"operation_id","frame_sha256","original_generation_id","native_mutation_stamp"}){
            JSONObject bad=new JSONObject(original);bad.getJSONObject("original_browser_binding").put(key,"foreign");
            journalRefuses(()->journalDecode(bad,metadata));
        }
        JSONObject foreign=binding.put("frame_sha256","f".repeat(64));
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(original,"browser_chunk-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,foreign,metadata));
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(original,"browser_chunk-0",
            browserBinding().getString("operation_id"),"a".repeat(64),browserBinding(),metadata));
        for(String entry:new String[]{"browser_chunk-00","browser_chunk-64","browser_frame-1","browser_chunk--1","WRITE-0"}){
            journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(original,entry,
                browserBinding().getString("operation_id"),JOURNAL_PLAN,browserBinding(),metadata));
        }
        for(Object index:new Object[]{JSONObject.NULL,"0",0.0d,-1,1,true}){
            JSONObject bad=new JSONObject(original).put("chunk_index",index);
            // Render 0.0 explicitly: JSONObject strips its trailing decimal.
            String raw=index instanceof Double?original.replace("\"chunk_index\":0","\"chunk_index\":0.0"):bad.toString();
            journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(raw,"browser_chunk-0",
                browserBinding().getString("operation_id"),JOURNAL_PLAN,browserBinding(),metadata));
        }
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(original,"browser_chunk-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,browserBinding(),null));
        JSONObject changed=new JSONObject(metadata.toString()).put("record_count",2);
        journalRefuses(()->journalDecode(new JSONObject(original),changed));
        JSONObject frame=journalDocument(metadata,browserBinding(),-1,null).put("chunk_index",0);
        journalRefuses(()->journalDecode(frame,null));frame.put("chunk_index",JSONObject.NULL).put("chunk_base64","AA==");
        journalRefuses(()->journalDecode(frame,null));
    }
    @Test public void BROWSER_JOURNAL_closedMetadataFiniteTypesAndEffects()throws Exception {
        byte[] bytes=journalBytes();JSONObject good=browserDataMetadata(bytes),binding=browserBinding();
        for(String key:new String[]{"native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"}){
            JSONObject bad=new JSONObject(good.toString()).put(key,true);
            journalRefuses(()->journalDecode(journalDocument(bad,binding,-1,null),null));
        }
        for(String key:new String[]{"byte_count","chunk_bytes","chunk_count","record_count"}){
            for(Object n:new Object[]{"1",JSONObject.NULL,true,-1}){
                JSONObject bad=new JSONObject(good.toString()).put(key,n);
                journalRefuses(()->journalDecode(journalDocument(bad,binding,-1,null),null));
            }
            String raw=journalDocument(good,binding,-1,null).toString().replace("\""+key+"\":"+good.get(key),"\""+key+"\":"+good.get(key)+".0");
            journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(raw,"browser_frame-0",
                browserBinding().getString("operation_id"),JOURNAL_PLAN,binding,null));
        }
        for(JSONObject bad:new JSONObject[]{new JSONObject(good.toString()).put("extra",false),
            new JSONObject(good.toString()).put("schema","foreign"),new JSONObject(good.toString()).put("encoding","future"),
            new JSONObject(good.toString()).put("byte_count",55),new JSONObject(good.toString()).put("byte_count",67108865),
            new JSONObject(good.toString()).put("chunk_bytes",512),new JSONObject(good.toString()).put("chunk_count",0),
            new JSONObject(good.toString()).put("chunk_count",65),new JSONObject(good.toString()).put("record_count",4097),
            new JSONObject(good.toString()).put("session_storage_state","UNKNOWN"),
            new JSONObject(good.toString()).put("chunk_sha256",new org.json.JSONArray()),
            new JSONObject(good.toString()).put("chunk_sha256",new org.json.JSONArray().put("A".repeat(64))),
            new JSONObject(good.toString()).put("frame_sha256","A".repeat(64)),
            new JSONObject(good.toString()).put("observation_sha256",JSONObject.NULL)}){
            journalRefuses(()->journalDecode(journalDocument(bad,binding,-1,null),null));
        }
        JSONObject min=new JSONObject(good.toString()).put("byte_count",56).put("record_count",0);
        try(var accepted=journalDecode(journalDocument(min,binding,-1,null),null)){assertEquals(56,accepted.frameMetadata().getInt("byte_count"));}
        var hashes=new org.json.JSONArray();for(int i=0;i<64;i++)hashes.put("a".repeat(64));
        JSONObject max=new JSONObject(good.toString()).put("byte_count",67108864).put("chunk_count",64).put("chunk_sha256",hashes).put("record_count",4096);
        try(var accepted=journalDecode(journalDocument(max,binding,-1,null),null)){assertEquals(64,accepted.frameMetadata().getInt("chunk_count"));}
        JSONObject doc=journalDocument(good,binding,-1,null);
        for(String key:new String[]{"inventory_acknowledged","work_accepted","finalizer_allowed","key_removal"}){
            JSONObject bad=new JSONObject(doc.toString()).put(key,true);journalRefuses(()->journalDecode(bad,null));
        }
        for(Object v:new Object[]{false,"true",1,JSONObject.NULL}){
            JSONObject bad=new JSONObject(doc.toString()).put("local_preservation_only",v);journalRefuses(()->journalDecode(bad,null));
        }
        journalRefuses(()->journalDecode(new JSONObject(doc.toString()).put("extra",false),null));
        JSONObject extraBinding=new JSONObject(doc.toString());extraBinding.getJSONObject("original_browser_binding").put("extra",false);
        journalRefuses(()->journalDecode(extraBinding,null));
    }
    @Test public void BROWSER_JOURNAL_strictRawJsonCanonicalChunkAndBounds()throws Exception {
        byte[] bytes=journalBytes(),before=bytes.clone();JSONObject metadata=browserDataMetadata(bytes),binding=browserBinding();
        JSONObject chunk=journalDocument(metadata,binding,0,bytes);
        for(String encoded:new String[]{"AA==","Zg","Zh==","AA==\n","____","",java.util.Base64.getEncoder().encodeToString(new byte[138])}){
            JSONObject bad=new JSONObject(chunk.toString()).put("chunk_base64",encoded);journalRefuses(()->journalDecode(bad,metadata));
        }
        byte[] changed=bytes.clone();changed[1]^=1;
        journalRefuses(()->journalDecode(journalDocument(metadata,binding,0,changed),metadata));
        JSONObject wrongHash=new JSONObject(metadata.toString()).put("chunk_sha256",new org.json.JSONArray().put("a".repeat(64)));
        journalRefuses(()->journalDecode(journalDocument(wrongHash,binding,0,bytes),wrongHash));
        String raw=journalDocument(metadata,binding,-1,null).toString();
        for(String bad:new String[]{"[]","null","true",raw+" {}",raw.substring(0,raw.length()-1)+",}",
            "{\"schema\":\"custodial.native-private-custody-exchange-evidence.v1\","+raw.substring(1),
            raw.replace("\"browser_value_frame\":{","\"browser_value_frame\":{\"encoding\":\"MZBRV001\","),
            raw.replace("\"schema\":","\"schema\":\"foreign\",\"\\u0073chema\":"),
            raw+'\ud800',"\ufeff"+raw}){
            journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(bad,"browser_frame-0",
                browserBinding().getString("operation_id"),JOURNAL_PLAN,binding,null));
        }
        String at=raw+" ".repeat(1600000-raw.getBytes(StandardCharsets.UTF_8).length);
        try(var accepted=NativeOriginalBrowserJournalDocument.decode(at,"browser_frame-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,binding,null)){assertTrue(accepted.isFrame());}
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(at+" ","browser_frame-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,binding,null));
        // UTF8 bytes, not characters: the original stamp is bound independently.
        JSONObject unicodeBinding=browserBinding().put("native_mutation_stamp","é".repeat(4096));
        String unicode=journalDocument(metadata,unicodeBinding,-1,null).toString();
        String unicodeAt=unicode+" ".repeat(1600000-unicode.getBytes(StandardCharsets.UTF_8).length);
        try(var accepted=NativeOriginalBrowserJournalDocument.decode(unicodeAt,"browser_frame-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,unicodeBinding,null)){assertTrue(accepted.isFrame());}
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(unicodeAt+" ","browser_frame-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,unicodeBinding,null));
        assertArrayEquals(before,bytes);
    }
    @Test public void BROWSER_JOURNAL_changedExpectedGraphsCannotBeAdopted()throws Exception {
        JSONObject binding=browserBinding(),metadata=browserDataMetadata(journalBytes());
        String raw=journalDocument(metadata,binding,0,journalBytes()).toString();
        JSONObject movingBinding=new JSONObject(binding.toString()){
            @Override public String toString(){String original=super.toString();
                try{put("native_mutation_stamp","successor");}catch(Exception impossible){throw new AssertionError(impossible);}return original;}
        };
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(raw,"browser_chunk-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,movingBinding,metadata));
        JSONObject movingMetadata=new JSONObject(metadata.toString()){
            @Override public String toString(){String original=super.toString();
                try{put("record_count",2);}catch(Exception impossible){throw new AssertionError(impossible);}return original;}
        };
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(raw,"browser_chunk-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,binding,movingMetadata));
        JSONObject noStamp=browserBinding().put("native_mutation_stamp","");
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(raw,"browser_chunk-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,noStamp,metadata));
        JSONObject tooLong=browserBinding().put("native_mutation_stamp","x".repeat(4097));
        journalRefuses(()->NativeOriginalBrowserJournalDocument.decode(raw,"browser_chunk-0",
            browserBinding().getString("operation_id"),JOURNAL_PLAN,tooLong,metadata));
    }

    /** NEW restart DATA vectors. Existing Source capture/journal authentication,
     * live owner and accepted SQL bindings are deliberately not manufactured. */
    private static NativeOriginalBrowserValueFrame.OriginalRecords retainedRows(Object[] tree,JSONObject observation,
        java.util.List<byte[]> pool)throws Exception {
        byte[] binary=valueBytes(tree,observation);var chunks=valueChunks(binary);
        var originals=new java.util.ArrayList<byte[]>();for(byte[] chunk:chunks)originals.add(chunk.clone());
        var nativeBefore=new java.util.ArrayList<byte[]>();for(byte[] argument:pool)nativeBefore.add(argument.clone());
        JSONObject metadata=valueMetadata(chunks,observation),before=new JSONObject(metadata.toString());
        try{
            var result=NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,pool);
            assertTrue(ProviderWireJson.same(before,metadata));assertEquals(chunks.size(),originals.size());
            for(int i=0;i<chunks.size();i++)assertArrayEquals(originals.get(i),chunks.get(i));
            for(int i=0;i<pool.size();i++)assertArrayEquals(nativeBefore.get(i),pool.get(i));
            assertEquals(metadata.getString("observation_sha256"),result.observationSha256);
            assertEquals(metadata.getString("frame_sha256"),result.frameSha256);
            assertTrue(result.argumentPayloadMatches().isEmpty());return result;
        }finally{Arrays.fill(binary,(byte)0);nativePoolWipe(chunks);nativePoolWipe(originals);nativePoolWipe(nativeBefore);}
    }
    @Test public void BROWSER_DOMAINS_emptyDatabasesStoresAndUnknownSessionAreExplicit()throws Exception {
        for(boolean known:new boolean[]{false,true}){
            Object[] tree=va(va(),known?va():null,va(va(va("empty-db",1),va()),
                va(va("stores-db",7),va(va("alpha",va()),va("beta",va())))));
            JSONObject o=nativePoolReply(tree,new int[0]).getJSONObject("observation");
            var result=retainedRows(tree,o,java.util.List.of());var domains=result.declaredDomains();
            assertEquals(0,result.recordCount);assertEquals(5,domains.size());
            assertEquals("localStorage",domains.get(0).store);assertEquals(0,domains.get(0).recordCount);
            assertEquals("sessionStorage",domains.get(1).store);assertEquals(known?0:-1,domains.get(1).recordCount);
            assertEquals(known?"DECLARED_ORIGINAL_ROWS_NOT_AUTHORITY":"UNAVAILABLE_UNRESOLVED_RETAINED",domains.get(1).state);
            assertEquals("empty-db",domains.get(2).database);assertNull(domains.get(2).objectStore);
            assertEquals(Long.valueOf(1),domains.get(2).version);assertEquals(0,domains.get(2).recordCount);
            assertEquals("DECLARED_EMPTY_DATABASE_NOT_AUTHORITY",domains.get(2).state);
            assertEquals("alpha",domains.get(3).objectStore);assertEquals("beta",domains.get(4).objectStore);
            assertEquals(Long.valueOf(7),domains.get(4).version);
        }
    }
    @Test public void BROWSER_DOMAINS_countsBelongToActualBinaryStoresAndRemainImmutable()throws Exception {
        Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false),nativePoolRow(2,52,51,54,2,false));
        JSONObject o=nativePoolReply(tree,new int[0]).getJSONObject("observation");
        var result=retainedRows(tree,o,java.util.List.of());var domains=result.declaredDomains();
        int sum=0;for(var domain:domains)if(domain.recordCount>=0)sum+=domain.recordCount;
        assertEquals(result.recordCount,sum);
        var selected=domains.stream().filter(d->"mz_scan_queue".equals(d.database)&&"actions".equals(d.objectStore)).toList();
        assertEquals(1,selected.size());assertEquals(2,selected.get(0).recordCount);
        assertEquals("indexedDB",selected.get(0).store);
        try{domains.clear();fail("mutable catalog");}catch(UnsupportedOperationException expected){}
        for(var ctor:NativeOriginalBrowserValueFrame.Domain.class.getDeclaredConstructors())
            assertTrue(java.lang.reflect.Modifier.isPrivate(ctor.getModifiers()));
        o.put("record_count",0);assertEquals(2,selected.get(0).recordCount);
    }
    @Test public void BROWSER_DOMAINS_badOriginalFrameCannotPublishCatalog()throws Exception {
        Object[] tree=va(va(),null,valueOne(va(va("empty-db",1),va())));
        JSONObject o=nativePoolReply(tree,new int[0]).getJSONObject("observation");
        var chunks=valueChunks(valueBytes(tree,o));JSONObject metadata=valueMetadata(chunks,o);
        var published=new java.util.concurrent.atomic.AtomicReference<NativeOriginalBrowserValueFrame.OriginalRecords>();
        try{
            chunks.get(0)[chunks.get(0).length-1]^=1;
            browserRefuses(()->published.set(NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,java.util.List.of())));
            assertNull(published.get());
        }finally{nativePoolWipe(chunks);}
    }
    @Test public void BROWSER_RETAINED_allStreamedUnknownForeignRowsWithoutDiagnosticObservation()throws Exception {
        JSONObject expected=valueObservation(false);
        var result=retainedRows(valueTree(false),expected,java.util.List.of());
        assertEquals(3,result.recordCount);assertEquals("NOT_DECLARED_UNKNOWN",result.sessionStorageState);
        for(int i=0;i<result.recordCount;i++){
            var row=result.originalRecords().get(i);JSONObject fact=expected.getJSONArray("records").getJSONObject(i);
            assertEquals(i,row.ordinal);assertEquals(fact.getString("store"),row.store);
            assertEquals(fact.getString("key_sha256"),row.keySha256);assertEquals(fact.getString("body_sha256"),row.bodySha256);
            if(i<2){assertNull(row.database);assertNull(row.version);assertNull(row.objectStore);}
            else{assertEquals("db",row.database);assertEquals(Long.valueOf(7),row.version);assertEquals("store",row.objectStore);}
        }
        requireNativePoolMatches(result,new int[]{-1,-1,-1},java.util.List.of());
        expected.getJSONArray("records").getJSONObject(0).put("body_sha256","0".repeat(64));
        assertNotEquals("0".repeat(64),result.originalRecords().get(0).bodySha256);
        // Constructors remain private; no materialized diagnostic JSON creates DATA handles.
        for(var ctor:NativeOriginalBrowserValueFrame.Record.class.getDeclaredConstructors())
            assertTrue(java.lang.reflect.Modifier.isPrivate(ctor.getModifiers()));
        for(var ctor:NativeOriginalBrowserValueFrame.OriginalRecords.class.getDeclaredConstructors())
            assertTrue(java.lang.reflect.Modifier.isPrivate(ctor.getModifiers()));
    }
    @Test public void BROWSER_RETAINED_emptyUnknownSessionAndOldNullObservationRefusal()throws Exception {
        for(boolean known:new boolean[]{false,true}){
            Object[] tree=va(va(),known?va():null,va());JSONObject o=nativePoolReply(tree,new int[0]).getJSONObject("observation");
            var result=retainedRows(tree,o,java.util.List.of());
            assertEquals(0,result.recordCount);assertTrue(result.originalRecords().isEmpty());
            assertTrue(result.nativeArgumentPayloadMatches().isEmpty());
            assertEquals(known?"CAPTURED_READ_ONLY_NOT_AUTHENTICATED":"NOT_DECLARED_UNKNOWN",result.sessionStorageState);
            var chunks=valueChunks(valueBytes(tree,o));JSONObject metadata=valueMetadata(chunks,o);
            try{
                browserRefuses(()->NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,null,chunks));
                browserRefuses(()->NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,null,chunks,java.util.List.of(),java.util.List.of()));
                browserRefuses(()->NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,null,chunks,java.util.List.of(),java.util.List.of(),java.util.List.of()));
                browserRefuses(()->NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,null));
            }finally{nativePoolWipe(chunks);}
        }
    }
    @Test public void BROWSER_RETAINED_completeNativePoolMatchesAndDuplicateOriginalsStayUnresolved()throws Exception {
        var pool=java.util.List.of(nativePoolArgument(2,52,51),nativePoolArgument(1,42,41));
        try{
            Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false),nativePoolRow(2,52,51,54,2,false));
            requireNativePoolMatches(retainedRows(tree,nativePoolReply(tree,new int[0]).getJSONObject("observation"),pool),new int[]{1,0},pool);
            Object[] duplicate=nativePoolTree(nativePoolRow(1,42,41,44,1,false),nativePoolRow(1,42,41,44,2,false));
            var retained=retainedRows(duplicate,nativePoolReply(duplicate,new int[0]).getJSONObject("observation"),pool);
            requireNativePoolMatches(retained,new int[]{-1,-1},pool);
            assertEquals(retained.originalRecords().get(0).keySha256,retained.originalRecords().get(1).keySha256);
            assertNotEquals(retained.originalRecords().get(0).bodySha256,retained.originalRecords().get(1).bodySha256);
            var duplicatedPool=java.util.List.of(pool.get(1),pool.get(1).clone());
            try{
                Object[] single=nativePoolTree(nativePoolRow(1,42,41,44,1,false));
                requireNativePoolMatches(retainedRows(single,nativePoolReply(single,new int[0]).getJSONObject("observation"),duplicatedPool),new int[]{-1},duplicatedPool);
            }finally{Arrays.fill(duplicatedPool.get(1),(byte)0);}
        }finally{nativePoolWipe(pool);}
    }
    @Test public void BROWSER_RETAINED_savedBytesHeaderTranscriptAndClosedMetadataRefuse()throws Exception {
        JSONObject o=valueObservation(false);byte[] binary=valueBytes(valueTree(false),o);
        try{
            for(String changed:new String[]{"digest","magic","headerHash","localCount","sessionCount","databaseCount","recordCount","body","tail"}){
                byte[] altered="tail".equals(changed)?Arrays.copyOf(binary,binary.length+1):binary.clone();
                if(!"tail".equals(changed)){
                    int offset=switch(changed){case "magic"->0;case "headerHash"->8;case "localCount"->43;
                        case "sessionCount"->47;case "databaseCount"->51;case "recordCount"->55;default->altered.length-1;};
                    altered[offset]^=1;
                }
                var chunks=valueChunks(altered);JSONObject metadata=valueMetadata(chunks,o);
                if("digest".equals(changed))metadata=valueMetadata(valueChunks(binary),o); // original pinned digest versus damaged bytes
                final JSONObject fixed=metadata;byte[] retained=altered.clone();
                try{browserRefuses(()->NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(fixed,chunks,java.util.List.of()));
                    assertArrayEquals(retained,altered);}
                finally{Arrays.fill(altered,(byte)0);Arrays.fill(retained,(byte)0);nativePoolWipe(chunks);}
            }
            for(String changed:new String[]{"extra","record_count","session_storage_state","chunk_count","chunk_bytes","observation_sha256",
                "native_authority","durable_retention","inventory_acknowledged","finalizer_allowed","key_removal"}){
                var chunks=valueChunks(binary);JSONObject metadata=valueMetadata(chunks,o);
                switch(changed){
                    case "extra":metadata.put("extra",false);break;
                    case "record_count":metadata.put(changed,4);break;
                    case "session_storage_state":metadata.put(changed,"CAPTURED_READ_ONLY_NOT_AUTHENTICATED");break;
                    case "chunk_count":metadata.put(changed,0);break;
                    case "chunk_bytes":metadata.put(changed,1048575);break;
                    case "observation_sha256":metadata.put(changed,"0".repeat(64));break;
                    default:metadata.put(changed,true);
                }
                try{browserRefuses(()->NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,java.util.List.of()));}
                finally{nativePoolWipe(chunks);}
            }
            // Valid transcript/digests cannot waive storage ordering or declared row count.
            Object[] unordered=va(va(va("z","one"),va("a","two")),null,va());
            JSONObject unorderedObservation=nativePoolReply(unordered,new int[0]).getJSONObject("observation");
            var chunks=valueChunks(valueBytes(unordered,unorderedObservation));
            try{JSONObject metadata=valueMetadata(chunks,unorderedObservation);
                browserRefuses(()->NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,java.util.List.of()));}
            finally{nativePoolWipe(chunks);}
        }finally{Arrays.fill(binary,(byte)0);}
    }
    @Test public void BROWSER_RETAINED_changedBorrowedReferencesBytesAndMetadataNeverPublish()throws Exception {
        for(int kind=0;kind<5;kind++){
            final int mode=kind;Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false));
            JSONObject o=nativePoolReply(tree,new int[0]).getJSONObject("observation");
            var chunks=valueChunks(valueBytes(tree,o));JSONObject metadata=valueMetadata(chunks,o);
            var pool=java.util.List.of(nativePoolArgument(1,42,41));
            var changing=new java.util.AbstractList<byte[]>(){
                int reads;
                public int size(){return chunks.size();}
                public byte[] get(int index){
                    if(++reads==2){
                        if(mode==0)chunks.set(index,chunks.get(index).clone());
                        if(mode==1)chunks.get(index)[100]^=1;
                        if(mode==2)metadata.put("durable_retention",true);
                        if(mode==3)pool.get(0)[0]^=1;
                        if(mode==4)o.getJSONArray("records").getJSONObject(0).put("body_sha256","0".repeat(64));
                    }return chunks.get(index);
                }
            };
            var published=new java.util.concurrent.atomic.AtomicReference<NativeOriginalBrowserValueFrame.OriginalRecords>();
            try{browserRefuses(()->published.set(mode==4
                    ?NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,o,changing,java.util.List.of(),java.util.List.of(),pool)
                    :NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,changing,pool)));
                assertNull(published.get());}
            finally{nativePoolWipe(chunks);nativePoolWipe(pool);}
        }
        // Equal bytes in a replacement native argument loan are also not the original loan.
        Object[] tree=nativePoolTree(nativePoolRow(1,42,41,44,1,false));
        JSONObject o=nativePoolReply(tree,new int[0]).getJSONObject("observation");
        var chunks=valueChunks(valueBytes(tree,o));JSONObject metadata=valueMetadata(chunks,o);
        byte[] original=nativePoolArgument(1,42,41),replacement=original.clone();
        var changingPool=new java.util.AbstractList<byte[]>(){
            int reads;public int size(){return 1;}public byte[] get(int index){return ++reads==1?original:replacement;}
        };
        try{browserRefuses(()->NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,changingPool));}
        finally{nativePoolWipe(chunks);Arrays.fill(original,(byte)0);Arrays.fill(replacement,(byte)0);}
    }


    // NEW HOLD_FENCE synthetic DATA only. No browser capture, platform lock,
    // live owner, native capability or effect authority is manufactured.
    private static final String HOLD_OBSERVATION="5".repeat(64);
    private static JSONObject holdFenceReply()throws Exception {
        JSONObject value=browserBinding().put("schema","custodial.native-original-browser-hold-fence-response.v1")
            .put("command","HOLD_FENCE").put("reply_token",BROWSER_REPLY_TOKEN).put("request_nonce",BROWSER_REQUEST)
            .put("phase_nonce",BROWSER_PHASE).put("state","SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK")
            .put("hold_marker_sha256","ad3289737a0f7d263b83e4f9818b60ff26fcc64ae543ed0829bd63fe2acedb15")
            .put("mutation_epoch","1").put("observation_sha256",HOLD_OBSERVATION);
        for(String key:new String[]{"native_authority","inventory_acknowledged","work_accepted","replay_allowed",
            "finalizer_allowed","key_removal","phone_released"})value.put(key,false);
        return value;
    }
    private static NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply holdFenceDecode(String value)throws Exception {
        return NativeOriginalBrowserPreparationWire.decodeHoldFence(value,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding(),HOLD_OBSERVATION);
    }
    @Test public void HOLD_FENCE_exactMarkerTupleAndPositiveEpochData()throws Exception {
        for(String epoch:new String[]{"1","9007199254740993","9223372036854775807"}){
            JSONObject original=holdFenceReply().put("mutation_epoch",epoch),before=new JSONObject(original.toString());
            try(var parsed=holdFenceDecode(original.toString())){
                JSONObject data=parsed.json();assertEquals(20,data.length());assertTrue(ProviderWireJson.same(before,data));
                assertEquals(epoch,data.getString("mutation_epoch"));assertEquals(HOLD_OBSERVATION,data.getString("observation_sha256"));
                for(String key:new String[]{"native_authority","inventory_acknowledged","work_accepted","replay_allowed",
                    "finalizer_allowed","key_removal","phone_released"})assertSame(Boolean.FALSE,data.get(key));
            }
            assertTrue(ProviderWireJson.same(before,original));
        }
    }
    @Test public void HOLD_FENCE_closedFieldsPurposesAndFalseRights()throws Exception {
        JSONObject original=holdFenceReply();
        for(String key:original.keySet()){
            JSONObject missing=new JSONObject(original.toString());missing.remove(key);browserRefuses(()->holdFenceDecode(missing.toString()));
            for(Object wrong:new Object[]{JSONObject.NULL,1,new org.json.JSONArray(),new JSONObject()}){
                JSONObject changed=new JSONObject(original.toString()).put(key,wrong);
                browserRefuses(()->holdFenceDecode(changed.toString()));
            }
        }
        for(String key:new String[]{"native_authority","inventory_acknowledged","work_accepted","replay_allowed",
            "finalizer_allowed","key_removal","phone_released"}){
            browserRefuses(()->holdFenceDecode(holdFenceReply().put(key,true).toString()));
            browserRefuses(()->holdFenceDecode(holdFenceReply().put(key,"false").toString()));
        }
        for(String command:new String[]{"CAPTURE","CAPTURE_EXISTING_HELD","RECHECK","DATA_FRAME","CLOSE"})
            browserRefuses(()->holdFenceDecode(holdFenceReply().put("command",command).toString()));
        for(String state:new String[]{"UNKNOWN","PENDING","ACKNOWLEDGED","CAPTURED_RETAINED_NOT_AUTHORITY"})
            browserRefuses(()->holdFenceDecode(holdFenceReply().put("state",state).toString()));
        browserRefuses(()->holdFenceDecode(original.put("reason","").toString()));
        browserRefuses(()->holdFenceDecode(holdFenceReply().put("schema","custodial.native-original-browser-capture-response.v1").toString()));
    }
    @Test public void HOLD_FENCE_expectedTupleTokensAndObservation()throws Exception {
        String good=holdFenceReply().toString();
        for(String key:new String[]{"operation_id","frame_sha256","original_generation_id","native_mutation_stamp"}){
            JSONObject changed=browserBinding().put(key,key.endsWith("_id")?"95000000-0000-4000-8000-000000000099":
                key.equals("frame_sha256")?"e".repeat(64):"foreign_stamp");
            browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(good,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,changed,HOLD_OBSERVATION));
        }
        for(String bad:new String[]{null,"","a".repeat(63),"a".repeat(65),"A".repeat(64),"z".repeat(64)}){
            browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(good,bad,BROWSER_REQUEST,BROWSER_PHASE,browserBinding(),HOLD_OBSERVATION));
            browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(good,BROWSER_REPLY_TOKEN,bad,BROWSER_PHASE,browserBinding(),HOLD_OBSERVATION));
            browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(good,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,bad,browserBinding(),HOLD_OBSERVATION));
            browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(good,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,browserBinding(),bad));
        }
        for(String key:new String[]{"reply_token","request_nonce","phase_nonce","observation_sha256"})
            browserRefuses(()->holdFenceDecode(holdFenceReply().put(key,"f".repeat(64)).toString()));
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(good,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,null,HOLD_OBSERVATION));
        for(String key:new String[]{"operation_id","original_generation_id","frame_sha256","native_mutation_stamp"}){
            for(String bad:key.equals("native_mutation_stamp")?new String[]{"","x".repeat(4097)}:new String[]{"","foreign","A".repeat(64)}){
                JSONObject binding=browserBinding().put(key,bad),same=holdFenceReply().put(key,bad);
                browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(same.toString(),BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,binding,HOLD_OBSERVATION));
            }
        }
        JSONObject extra=browserBinding().put("authority",false);
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(good,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,extra,HOLD_OBSERVATION));
    }
    @Test public void HOLD_FENCE_positiveLongEpochCanonicalOnly()throws Exception {
        for(Object epoch:new Object[]{"","0","00","01","+1","-1","1.0","1e0"," 1","1 ","9223372036854775808",
            "18446744073709551615","1".repeat(20),"\u0661",1,1L,1.0,true,JSONObject.NULL}){
            JSONObject value=holdFenceReply().put("mutation_epoch",epoch);
            browserRefuses(()->holdFenceDecode(value.toString()));
        }
    }
    @Test public void HOLD_FENCE_markerExactOriginalBytes()throws Exception {
        String operation=browserBinding().getString("operation_id");
        String exact="{\"schema\":\"custodial.browser-preservation-hold.v1\",\"operation_id\":\""+operation+"\",\"native_authority\":false}";
        assertEquals(holdFenceReply().getString("hold_marker_sha256"),NativeRetainedAttempt.hash(raw(exact)));
        for(String foreign:new String[]{exact+" ",exact+"\n",exact.replace(operation,"95000000-0000-4000-8000-000000000099"),
            "{\"operation_id\":\""+operation+"\",\"schema\":\"custodial.browser-preservation-hold.v1\",\"native_authority\":false}",
            exact.replace("false","true"),exact.replace("hold.v1","hold.v2")}){
            String digest=NativeRetainedAttempt.hash(raw(foreign));
            browserRefuses(()->holdFenceDecode(holdFenceReply().put("hold_marker_sha256",digest).toString()));
        }
        for(String digest:new String[]{"","f".repeat(64),"ad3289737a0f7d263b83e4f9818b60ff26fcc64ae543ed0829bd63fe2acedb15".toUpperCase(java.util.Locale.ROOT)})
            browserRefuses(()->holdFenceDecode(holdFenceReply().put("hold_marker_sha256",digest).toString()));
    }
    @Test public void HOLD_FENCE_strictJsonUtf8AndByteBoundary()throws Exception {
        String good=holdFenceReply().toString(),prefix=good.substring(0,good.length()-1);
        for(String bad:new String[]{null,"",good+"{}",good+",",prefix+",}",good.replace("\"command\"","command"),
            good.replace("\"HOLD_FENCE\"","'HOLD_FENCE'"),"\ufeff"+good,good+'\ud800',
            prefix+",\"command\":\"HOLD_FENCE\"}",prefix+",\"comm"+"\\"+"u0061nd\":\"HOLD_FENCE\"}",
            good.replace("SYNTHETIC_ORIGINAL_STAMP_NOT_AUTHORITY","\\"+"ud800")}){
            browserRefuses(()->holdFenceDecode(bad));
        }
        String at=good+" ".repeat(32768-raw(good).length);
        try(var parsed=holdFenceDecode(at)){assertEquals("1",parsed.json().getString("mutation_epoch"));}
        browserRefuses(()->holdFenceDecode(at+" "));
        JSONObject binding=browserBinding().put("native_mutation_stamp","é".repeat(4096));
        String unicode=holdFenceReply().put("native_mutation_stamp",binding.get("native_mutation_stamp")).toString();
        String padded=unicode+" ".repeat(32768-raw(unicode).length);
        assertTrue(padded.length()<32768);
        try(var parsed=NativeOriginalBrowserPreparationWire.decodeHoldFence(padded,BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,binding,HOLD_OBSERVATION)){
            assertEquals(binding.get("native_mutation_stamp"),parsed.json().get("native_mutation_stamp"));
        }
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(padded+" ",BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,binding,HOLD_OBSERVATION));
    }
    @Test public void HOLD_FENCE_ownedCloseAndNoCallerGetters()throws Exception {
        JSONObject source=holdFenceReply(),binding=browserBinding();
        var parsed=NativeOriginalBrowserPreparationWire.decodeHoldFence(source.toString(),BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,binding,HOLD_OBSERVATION);
        source.put("work_accepted",true);binding.put("native_mutation_stamp","successor");
        JSONObject detached=parsed.json();detached.put("mutation_epoch","999").put("native_authority",true);
        assertEquals("1",parsed.json().getString("mutation_epoch"));assertSame(Boolean.FALSE,parsed.json().get("native_authority"));
        var field=NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply.class.getDeclaredField("encoded");
        field.setAccessible(true);byte[] owned=(byte[])field.get(parsed);byte[] original=owned.clone();
        parsed.close();parsed.close();for(byte value:owned)assertEquals(0,value);
        browserRefuses(parsed::json);assertFalse(Arrays.equals(original,owned));Arrays.fill(original,(byte)0);
        assertEquals("999",detached.getString("mutation_epoch")); // detached DATA remains caller-owned
        final int[] calls={0};
        JSONObject callback=new JSONObject(){
            @Override public Object get(String key){calls[0]++;throw new AssertionError("caller getter invoked");}
            @Override public String toString(){calls[0]++;throw new AssertionError("caller serialization invoked");}
        };
        browserRefuses(()->NativeOriginalBrowserPreparationWire.decodeHoldFence(holdFenceReply().toString(),BROWSER_REPLY_TOKEN,BROWSER_REQUEST,BROWSER_PHASE,callback,HOLD_OBSERVATION));
        assertEquals(0,calls[0]);
        for(var ctor:NativeOriginalBrowserPreparationWire.OwnedHoldFenceReply.class.getDeclaredConstructors())
            assertTrue(java.lang.reflect.Modifier.isPrivate(ctor.getModifiers()));
    }

    // Fixed actual binary rows, not a second archive or diagnostic authority.
    private static final String FRAME_HOLD_KEY="mz_custodial_protected_browser_hold.v1";
    private static final String FRAME_EPOCH_KEY="mz_custodial_protected_browser_mutation.v1";
    private static final String FRAME_HOLD_OPERATION="95000000-0000-4000-8000-000000000031";
    private static String frameMarker(String operation){
        return "{\"schema\":\"custodial.browser-preservation-hold.v1\",\"operation_id\":\""+operation+"\",\"native_authority\":false}";
    }
    private static Object[] frameHoldTree(String marker,String epoch){
        var rows=new java.util.ArrayList<Object[]>();
        if(marker!=null)rows.add(va(FRAME_HOLD_KEY,marker));
        if(epoch!=null)rows.add(va(FRAME_EPOCH_KEY,epoch));
        rows.sort(java.util.Comparator.comparing(row->(String)row[0]));
        return va(rows.toArray(new Object[0]),null,new Object[0]);
    }
    // Source JSON.stringify escapes unpaired UTF16 units before the binary
    // observation transcript is hashed. Fix only these new fixture vectors;
    // a Charset replacement must not invent a different original transcript.
    private static String frameHeldSourceHash(String json)throws Exception {
        StringBuilder wellFormed=new StringBuilder();
        for(int i=0;i<json.length();i++){
            char c=json.charAt(i);
            if(Character.isHighSurrogate(c)&&i+1<json.length()&&Character.isLowSurrogate(json.charAt(i+1))){
                wellFormed.append(c).append(json.charAt(++i));
            }else if(Character.isSurrogate(c)){
                wellFormed.append("\\u");
                for(int shift=12;shift>=0;shift-=4)wellFormed.append("0123456789abcdef".charAt((c>>>shift)&15));
            }else wellFormed.append(c);
        }
        return nativePoolTranscriptHash(wellFormed.toString());
    }
    private static JSONObject frameHeldObservation(Object[] tree)throws Exception {
        JSONObject o=nativePoolReply(tree,new int[0]).getJSONObject("observation");int ordinal=0;
        for(int area=0;area<2;area++){
            Object[] rows=(Object[])tree[area];if(rows==null)continue;
            for(Object item:rows){Object[] row=(Object[])item;
                o.getJSONArray("records").getJSONObject(ordinal++).put("key_sha256",frameHeldSourceHash(nativePoolJson(row[0])))
                    .put("body_sha256",frameHeldSourceHash(nativePoolJson(row[1])));
            }
        }
        for(Object database:(Object[])tree[2])for(Object store:(Object[])((Object[])database)[1])
            for(Object item:(Object[])((Object[])store)[1]){
                Object[] row=(Object[])item;
                o.getJSONArray("records").getJSONObject(ordinal++).put("key_sha256",frameHeldSourceHash(nativePoolJson(row[0])))
                    .put("body_sha256",frameHeldSourceHash(nativePoolJson(row[1])));
            }
        String transcript="[\"custodial.browser-protected-observation.v1\",{\"local\":"+nativePoolJson(tree[0])
            +",\"session\":"+nativePoolJson(tree[1])+",\"databases\":"+nativePoolJson(tree[2])+"}]";
        return o.put("observation_sha256",frameHeldSourceHash(transcript));
    }
    private static NativeOriginalBrowserValueFrame.OriginalRecords frameHoldReadBoth(Object[] tree,String operation,String epoch)throws Exception {
        JSONObject o=frameHeldObservation(tree);
        JSONObject originalObservation=new JSONObject(o.toString());
        byte[] binary=valueBytes(tree,o);var chunks=valueChunks(binary);JSONObject metadata=valueMetadata(chunks,o);
        JSONObject originalMetadata=new JSONObject(metadata.toString());var originals=new java.util.ArrayList<byte[]>();
        for(byte[] bytes:chunks)originals.add(bytes.clone());
        try{
            var observed=NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,o,chunks,java.util.List.of(),java.util.List.of(),java.util.List.of());
            var retained=NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,java.util.List.of());
            for(var records:java.util.List.of(observed,retained)){
                assertEquals(o.getInt("record_count"),records.recordCount);
                assertEquals(o.getString("observation_sha256"),records.observationSha256);
                assertEquals(metadata.getString("frame_sha256"),records.frameSha256);
                assertEquals(records.recordCount,records.originalRecords().size());
                assertEquals(records.recordCount,records.nativeArgumentPayloadMatches().size());
                for(var match:records.nativeArgumentPayloadMatches())assertFalse(match.matchesOriginalPayload);
                var held=records.originalHeldBrowserMetadata();
                if(operation==null)assertNull(held);
                else{
                    assertNotNull(held);assertEquals(operation,held.operationId);assertEquals(epoch,held.mutationEpoch);
                    assertEquals(NativeRetainedAttempt.hash(raw(frameMarker(operation))),held.holdMarkerSha256);
                }
                for(int i=0;i<records.recordCount;i++){
                    var row=records.originalRecords().get(i);JSONObject original=o.getJSONArray("records").getJSONObject(i);
                    assertEquals(i,row.ordinal);assertEquals(original.get("store"),row.store);
                    assertEquals(original.get("key_sha256"),row.keySha256);assertEquals(original.get("body_sha256"),row.bodySha256);
                    assertEquals("UNRESOLVED_RETAINED",row.semanticDisposition);
                }
            }
            assertEquals(observed.declaredDomains().size(),retained.declaredDomains().size());
            assertTrue(ProviderWireJson.same(originalObservation,o));assertTrue(ProviderWireJson.same(originalMetadata,metadata));
            for(int i=0;i<chunks.size();i++)assertArrayEquals(originals.get(i),chunks.get(i));
            return retained;
        }finally{Arrays.fill(binary,(byte)0);nativePoolWipe(chunks);nativePoolWipe(originals);}
    }
    @Test public void FRAME_HOLD_localRowsObservedAndRetainedParity()throws Exception {
        for(String epoch:new String[]{"1","9007199254740993","9223372036854775807"}){
            Object[] tree=frameHoldTree(frameMarker(FRAME_HOLD_OPERATION),epoch);
            var records=frameHoldReadBoth(tree,FRAME_HOLD_OPERATION,epoch);assertEquals(2,records.recordCount);
            assertEquals("NOT_DECLARED_UNKNOWN",records.sessionStorageState);
            tree[1]=new Object[0];
            assertEquals("CAPTURED_READ_ONLY_NOT_AUTHENTICATED",frameHoldReadBoth(tree,FRAME_HOLD_OPERATION,epoch).sessionStorageState);
        }
        // A different canonical operation is retained as its actual DATA, never
        // rewritten to this fixture's operation or accepted as the same owner.
        String foreign="abcdef00-0000-4000-8000-000000000099";
        var held=frameHoldReadBoth(frameHoldTree(frameMarker(foreign),"2"),foreign,"2").originalHeldBrowserMetadata();
        assertNotEquals(FRAME_HOLD_OPERATION,held.operationId);
    }
    @Test public void FRAME_HOLD_absentPartialAndOtherRealmsStayUnbound()throws Exception {
        frameHoldReadBoth(frameHoldTree(null,null),null,null);
        frameHoldReadBoth(frameHoldTree(frameMarker(FRAME_HOLD_OPERATION),null),null,null);
        frameHoldReadBoth(frameHoldTree(null,"1"),null,null);
        Object[] lookalikes=frameHoldTree(null,null);
        lookalikes[1]=va(va(FRAME_HOLD_KEY,frameMarker(FRAME_HOLD_OPERATION)),va(FRAME_EPOCH_KEY,"1"));
        lookalikes[2]=valueOne(va(va("metadata-db",1),valueOne(va("metadata-store",va(
            va(va("string",FRAME_HOLD_KEY),va("string",frameMarker(FRAME_HOLD_OPERATION))),
            va(va("string",FRAME_EPOCH_KEY),va("string","1")))))));
        assertEquals(4,frameHoldReadBoth(lookalikes,null,null).recordCount);
        Object[] partial=frameHoldTree(frameMarker(FRAME_HOLD_OPERATION),null);
        partial[1]=valueOne(va(FRAME_EPOCH_KEY,"1"));frameHoldReadBoth(partial,null,null);
        Object[] names=va(va(va(FRAME_HOLD_KEY+"x",frameMarker(FRAME_HOLD_OPERATION)),va(FRAME_EPOCH_KEY+"x","1")),null,new Object[0]);
        frameHoldReadBoth(names,null,null);
    }
    @Test public void FRAME_HOLD_markerMustBeExactRawOriginalText()throws Exception {
        String good=frameMarker(FRAME_HOLD_OPERATION);
        for(String marker:new String[]{"",good+" "," "+good,good+"\n",good.replace("false","true"),
            good.replace("hold.v1","hold.v2"),good.replace(FRAME_HOLD_OPERATION,"foreign"),
            good.replace(FRAME_HOLD_OPERATION,"ABCDEF00-0000-4000-8000-000000000031"),
            good.replace("operation_id","operation_"+"\\"+"u0069d"),
            "{\"operation_id\":\""+FRAME_HOLD_OPERATION+"\",\"schema\":\"custodial.browser-preservation-hold.v1\",\"native_authority\":false}",
            good.substring(0,good.length()-1)+",\"native_authority\":false}",
            good.substring(0,good.length()-1)+",\"extra\":false}",good.replace(FRAME_HOLD_OPERATION,"\ud800")}){
            assertEquals(2,frameHoldReadBoth(frameHoldTree(marker,"1"),null,null).recordCount);
        }
    }
    @Test public void FRAME_HOLD_epochAndOversizedMetadataPreserveFrame()throws Exception {
        for(String epoch:new String[]{"","0","00","01","+1","-1","1.0","1e0"," 1","1 ","\u0661",
            "9223372036854775808","18446744073709551615","1".repeat(20),"1".repeat(1000)}){
            frameHoldReadBoth(frameHoldTree(frameMarker(FRAME_HOLD_OPERATION),epoch),null,null);
        }
        for(int size:new int[]{512,513,600000}){
            var records=frameHoldReadBoth(frameHoldTree("x".repeat(size),"1"),null,null);
            assertEquals(2,records.recordCount);
        }
    }
    @Test public void FRAME_HOLD_otherRowsUtf16AndDetachedDataRemainOriginal()throws Exception {
        Object[] tree=frameHoldTree(frameMarker(FRAME_HOLD_OPERATION),"7");
        Object[] selected=(Object[])tree[0];tree[0]=va(va("a\ud800","unrelated\udfff"),selected[0],selected[1],
            va("z","opaque foreign raw {\"n\":9007199254740993}\ud800"));
        var records=frameHoldReadBoth(tree,FRAME_HOLD_OPERATION,"7");assertEquals(4,records.recordCount);
        var held=records.originalHeldBrowserMetadata();
        ((Object[])selected[0])[1]="changed original after detached read";((Object[])selected[1])[1]="99";
        assertEquals(FRAME_HOLD_OPERATION,held.operationId);assertEquals("7",held.mutationEpoch);
        assertEquals("ad3289737a0f7d263b83e4f9818b60ff26fcc64ae543ed0829bd63fe2acedb15",held.holdMarkerSha256);
        for(var ctor:NativeOriginalBrowserValueFrame.OriginalHeldBrowserMetadata.class.getDeclaredConstructors())
            assertTrue(java.lang.reflect.Modifier.isPrivate(ctor.getModifiers()));
        assertEquals(3,NativeOriginalBrowserValueFrame.OriginalHeldBrowserMetadata.class.getDeclaredFields().length);
        for(var field:NativeOriginalBrowserValueFrame.OriginalHeldBrowserMetadata.class.getDeclaredFields())
            assertTrue(java.lang.reflect.Modifier.isFinal(field.getModifiers()));
    }
    @Test public void FRAME_HOLD_terminalDamageCannotPublishMetadata()throws Exception {
        Object[] tree=frameHoldTree(frameMarker(FRAME_HOLD_OPERATION),"1");
        JSONObject o=frameHeldObservation(tree);
        byte[] binary=valueBytes(tree,o);var chunks=valueChunks(binary);JSONObject metadata=valueMetadata(chunks,o);
        var published=new java.util.concurrent.atomic.AtomicReference<NativeOriginalBrowserValueFrame.OriginalRecords>();
        try{
            chunks.get(0)[chunks.get(0).length-1]^=1;
            byte[] failureOriginal=chunks.get(0).clone();
            browserRefuses(()->published.set(NativeOriginalBrowserValueFrame.inspectCompleteOriginalValues(metadata,o,chunks)));
            browserRefuses(()->published.set(NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(metadata,chunks,java.util.List.of())));
            assertNull(published.get());assertArrayEquals(failureOriginal,chunks.get(0));Arrays.fill(failureOriginal,(byte)0);
        }finally{Arrays.fill(binary,(byte)0);nativePoolWipe(chunks);}
        var moving=valueChunks(valueBytes(tree,o));JSONObject valid=valueMetadata(moving,o);
        var replacement=new java.util.AbstractList<byte[]>(){
            int calls;public int size(){return moving.size();}
            public byte[] get(int index){return ++calls==1?moving.get(index):moving.get(index).clone();}
        };
        try{
            browserRefuses(()->published.set(NativeOriginalBrowserValueFrame.inspectRetainedOriginalValues(valid,replacement,java.util.List.of())));
            assertNull(published.get());
        }finally{nativePoolWipe(moving);}
    }
}
