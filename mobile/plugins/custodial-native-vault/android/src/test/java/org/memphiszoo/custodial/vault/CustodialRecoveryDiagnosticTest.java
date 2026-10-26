package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertNotSame;

import org.junit.Test;

public final class CustodialRecoveryDiagnosticTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !"--startup-refusal-code-only".equals(args[0]))
            throw new IllegalArgumentException("new pure startup-code cases required");
        CustodialRecoveryDiagnosticTest test = new CustodialRecoveryDiagnosticTest();
        test.STARTUP_CODE_nestedMetadataRetainsOriginalSafeCode();
        test.STARTUP_CODE_workWrapperRetainsOriginalSafeCode();
        test.STARTUP_CODE_unknownCauseExposesNoPrivateData();
        test.STARTUP_CODE_cycleAndDepthRemainBoundedUnknown();
        System.out.println("PASS 4 NEW pure startup-code cases; actual private sanitizer, no Plugin instance/Context/Log/callback/runtime proof");
    }

    private static VaultFailure startupCode(RuntimeException error) throws Exception {
        java.lang.reflect.Method method = CustodialNativeVaultPlugin.class.getDeclaredMethod(
            "boundedStartupRefusal", RuntimeException.class);
        method.setAccessible(true);
        return (VaultFailure) method.invoke(null, error);
    }

    private static void onlyCode(VaultFailure value, String code) {
        assertEquals(code, value.code);
        assertEquals(code, value.getMessage());
        assertEquals(0, value.httpStatus);
        assertEquals("", value.remoteReason);
        assertNull(value.getCause());
        assertEquals(0, value.getSuppressed().length);
    }

    @Test public void STARTUP_CODE_nestedMetadataRetainsOriginalSafeCode() throws Exception {
        VaultFailure original = new VaultFailure(NativePrivateMutationEpochStore.FAILURE,
            new IllegalStateException("synthetic private details must not be retained"));
        RuntimeException thrown = new IllegalStateException(AndroidProtectedWorkPreferences.FAILURE,
            new VaultFailure(AndroidProtectedWorkPreferences.FAILURE, original));
        VaultFailure retained = startupCode(thrown);
        onlyCode(retained, NativePrivateMutationEpochStore.FAILURE);
        assertNotSame(original, retained);
        assertEquals(original, thrown.getCause().getCause());
    }

    @Test public void STARTUP_CODE_workWrapperRetainsOriginalSafeCode() throws Exception {
        VaultFailure original = new VaultFailure(AndroidProtectedWorkPreferences.FAILURE);
        onlyCode(startupCode(new IllegalStateException("unavailable", original)), AndroidProtectedWorkPreferences.FAILURE);
        assertEquals(AndroidProtectedWorkPreferences.FAILURE, original.code);
    }

    @Test public void STARTUP_CODE_unknownCauseExposesNoPrivateData() throws Exception {
        for (RuntimeException error : new RuntimeException[] {
            new IllegalStateException("synthetic private details"),
            new IllegalStateException("unknown", new VaultFailure("not_allowlisted", 409, "private remote reason")),
            new IllegalStateException(NativePrivateMutationEpochStore.FAILURE),
            new IllegalStateException("unknown", new Exception(NativePrivateMutationEpochStore.FAILURE))
        }) onlyCode(startupCode(error), "custodial_native_security_unavailable");
        onlyCode(startupCode(null), "custodial_native_security_unavailable");
    }

    @Test public void STARTUP_CODE_cycleAndDepthRemainBoundedUnknown() throws Exception {
        final class Cyclic extends RuntimeException {
            int reads;
            @Override public synchronized Throwable getCause() { reads++; return this; }
        }
        Cyclic cyclic = new Cyclic();
        onlyCode(startupCode(cyclic), "custodial_native_security_unavailable");
        assertEquals(8, cyclic.reads);
        Throwable deep = new VaultFailure(NativePrivateMutationEpochStore.FAILURE);
        for (int index=0; index<9; index++) deep=new IllegalStateException("synthetic deep cause", deep);
        onlyCode(startupCode((RuntimeException) deep), "custodial_native_security_unavailable");
    }

    @Test
    public void acceptsOnlyKnownRecoveryCodes() {
        assertEquals(
            "device_not_eligible",
            CustodialNativeVaultPlugin.boundedRecoveryReason(" DEVICE_NOT_ELIGIBLE ")
        );
        assertEquals(
            "quarantine_provenance_not_revalidatable",
            CustodialNativeVaultPlugin.boundedRecoveryOutcome("quarantine_provenance_not_revalidatable")
        );
        assertEquals(
            "recovery_details_shape_unrecognized",
            CustodialNativeVaultPlugin.boundedRecoveryDetail("recovery_details_shape_unrecognized")
        );
        assertEquals(
            "http_401_device_credential_required",
            CustodialNativeVaultPlugin.boundedRecoveryDetail("HTTP_401_DEVICE_CREDENTIAL_REQUIRED")
        );
        assertEquals(
            "interrupted_start_recovery",
            CustodialNativeVaultPlugin.boundedRecoveryReason("INTERRUPTED_START_RECOVERY")
        );
        assertEquals(
            "retired_preserved",
            CustodialNativeVaultPlugin.boundedRecoveryOutcome("retired_preserved")
        );
        for (String detail : new String[] {
            "browser_completion_draft_present",
            "durable_completion_draft_present",
            "durable_draft_check_failed",
            "durable_draft_reader_unavailable",
            "local_session_changed",
            "local_session_corrupted",
            "local_session_missing",
            "local_shape_not_eligible",
            "location_code_invalid",
            "native_started_server_unaccepted",
            "never_started",
            "queue_archive_failed",
            "queue_chain_attestation",
            "queue_chain_attestation_version",
            "queue_chain_binding_employee",
            "queue_chain_binding_epoch",
            "queue_chain_binding_session",
            "queue_chain_binding_snapshot",
            "queue_chain_client_id",
            "queue_chain_credential",
            "queue_chain_device",
            "queue_chain_employee",
            "queue_chain_entry",
            "queue_chain_epoch",
            "queue_chain_forward_type",
            "queue_chain_id",
            "queue_chain_live_lease",
            "queue_chain_location",
            "queue_chain_logical_identity",
            "queue_chain_logical_key",
            "queue_chain_operation_id",
            "queue_chain_payload_session",
            "queue_chain_recoverable",
            "queue_chain_replay_contract",
            "queue_chain_schema",
            "queue_chain_snapshot",
            "queue_chain_started_at",
            "queue_chain_type",
            "queue_not_ready",
            "queue_reader_unavailable",
            "queue_references_session",
            "queue_retirement_failed",
            "queue_retirement_unavailable",
            "queue_retirement_unverified",
            "queue_result_invalid",
            "queue_session_chain_ambiguous",
            "queue_session_chain_changed",
            "queue_session_chain_invalid",
            "server_authority_mismatch",
            "server_does_not_allow_retirement"
        }) {
            assertEquals(detail, CustodialNativeVaultPlugin.boundedRecoveryDetail(detail));
        }
    }

    @Test
    public void refusesArbitraryWebViewTextAndMissingValues() {
        assertEquals(
            "unclassified_recovery_state",
            CustodialNativeVaultPlugin.boundedRecoveryReason("credential=do-not-log")
        );
        assertEquals(
            "unclassified_recovery_state",
            CustodialNativeVaultPlugin.boundedRecoveryOutcome(null)
        );
        assertEquals(
            "unclassified_recovery_state",
            CustodialNativeVaultPlugin.boundedRecoveryDetail("device_id=KIOSK_08")
        );
    }
}
