package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public final class CustodialRecoveryDiagnosticTest {
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
