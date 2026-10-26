package org.memphiszoo.custodial.vault;

import org.junit.Test;
import static org.junit.Assert.*;

public final class NativeProviderFailureDispositionTest {
    @Test public void finiteClassificationNeverCopiesRawMessagesOrGuessesRemoteRevocation() {
        for(Throwable failure:new Throwable[]{new RuntimeException("credential=synthetic-secret"),new VaultFailure("HTTP401"),
            new VaultFailure("HTTP403"),new VaultFailure("REVOKED"),new VaultFailure("<html>expired token</html>"),null})
            assertEquals(NativeProviderFailureDisposition.UNCLASSIFIED_PRESERVED,NativeProviderFailureDisposition.of(failure));
        assertEquals(NativeProviderFailureDisposition.TRANSPORT_UNCERTAIN,NativeProviderFailureDisposition.of(new VaultFailure("custodial_provider_network_unavailable")));
        for(String code:new String[]{"custodial_provider_registration_receipt_invalid","custodial_provider_event_receipt_invalid",
            "custodial_provider_inventory_invalid","custodial_provider_clock_context_invalid"}){
            assertEquals(NativeProviderFailureDisposition.RESPONSE_UNCONFIRMED,NativeProviderFailureDisposition.of(new VaultFailure(code)));
            assertEquals("RETRY_ORIGINAL",NativeProviderFailureDisposition.of(new VaultFailure(code)).handling);
        }
    }
    @Test public void localPreservationStatesAreNotServerAcceptanceOrARevokeTransition() {
        assertEquals(NativeProviderFailureDisposition.STORE_PRESERVED,NativeProviderFailureDisposition.of(new VaultFailure("custodial_provider_key_missing_preserved")));
        assertEquals(NativeProviderFailureDisposition.QUALIFICATION_UNAVAILABLE,NativeProviderFailureDisposition.of(new VaultFailure("custodial_provider_clock_unqualified")));
        assertEquals(NativeProviderFailureDisposition.NATIVE_AUTHORITY_CHANGED,NativeProviderFailureDisposition.of(new VaultFailure("custodial_native_vault_concurrent_change")));
        assertEquals("PRESERVE_AND_DRAIN_EXISTING",NativeProviderFailureDisposition.of(new VaultFailure("custodial_provider_capacity_preserved")).handling);
        for(NativeProviderFailureDisposition value:NativeProviderFailureDisposition.values()){
            assertFalse(value.name().contains("REVOKED"));assertFalse(value.name().contains("ACCEPTED"));assertFalse(value.name().contains("SETTLED"));
        }
    }
}
