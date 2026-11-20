package org.memphiszoo.custodial.vault;

/** Non-authoritative finite diagnostic vocabulary. It never parses a server body,
 * revokes an identity, settles a receipt or decides a notification's validity.
 * No current transport contract proves an exact remote permanent denial. */
enum NativeProviderFailureDisposition {
    TRANSPORT_UNCERTAIN("RETRY_ORIGINAL"),
    RESPONSE_UNCONFIRMED("RETRY_ORIGINAL"),
    INVOCATION_STOPPED("RETRY_ORIGINAL"),
    QUALIFICATION_UNAVAILABLE("LOCAL_RECHECK_REQUIRED"),
    NATIVE_AUTHORITY_CHANGED("LOCAL_RECHECK_REQUIRED"),
    STORE_PRESERVED("LOCAL_RECHECK_REQUIRED"),
    CAPACITY_PRESERVED("PRESERVE_AND_DRAIN_EXISTING"),
    UNCLASSIFIED_PRESERVED("NO_NEW_AUTHORITY");

    final String handling;
    NativeProviderFailureDisposition(String handling) { this.handling=handling; }
    static NativeProviderFailureDisposition of(Throwable failure) {
        if(!(failure instanceof VaultFailure))return UNCLASSIFIED_PRESERVED;
        String code=((VaultFailure)failure).code;
        if(code==null)return UNCLASSIFIED_PRESERVED;
        switch(code) {
            case "custodial_provider_network_unavailable": return TRANSPORT_UNCERTAIN;
            case "custodial_provider_registration_receipt_invalid":
            case "custodial_provider_inventory_invalid":
            case "custodial_provider_event_receipt_invalid":
            case "custodial_provider_response_headers_invalid":
            case "custodial_provider_clock_context_invalid":
            case "custodial_provider_wire_json_invalid":
            case "custodial_provider_response_too_large": return RESPONSE_UNCONFIRMED;
            case "custodial_provider_network_canceled":
            case "custodial_provider_job_budget_exhausted": return INVOCATION_STOPPED;
            case "custodial_provider_clock_unqualified": return QUALIFICATION_UNAVAILABLE;
            case "custodial_native_vault_concurrent_change":
            case "custodial_provider_waiting_native_principal":
            case "custodial_provider_operation_stale":
            case "custodial_provider_clock_operation_stale": return NATIVE_AUTHORITY_CHANGED;
            case "custodial_provider_corrupt_preserved":
            case "custodial_provider_key_missing_preserved":
            case "custodial_provider_journal_corrupt_preserved":
            case "custodial_provider_commit_failed_preserved":
            case "custodial_provider_readback_failed_preserved": return STORE_PRESERVED;
            case "custodial_provider_capacity_preserved": return CAPACITY_PRESERVED;
            default: return UNCLASSIFIED_PRESERVED;
        }
    }
    /** Public diagnostics are fixed vocabulary only. Never inspect Throwable
     * messages, causes, stacks or arbitrary provider/server strings. */
    static String diagnostic(Throwable failure) {
        String code = failure instanceof VaultFailure ? ((VaultFailure) failure).code : null;
        String fixed = "unclassified_preserved";
        if (code != null) switch (code) {
            case "custodial_provider_network_unavailable":
            case "custodial_provider_network_canceled":
            case "custodial_provider_job_budget_exhausted":
            case "custodial_provider_clock_unqualified":
            case "custodial_provider_clock_context_invalid":
            case "custodial_provider_registration_receipt_invalid":
            case "custodial_provider_inventory_invalid":
            case "custodial_provider_event_receipt_invalid":
            case "custodial_provider_event_decision_invalid":
            case "custodial_provider_response_headers_invalid":
            case "custodial_provider_wire_json_invalid":
            case "custodial_provider_response_too_large":
            case "custodial_provider_os_display_unconfirmed":
            case "custodial_provider_os_display_failed":
            case "custodial_provider_os_item_conflict":
            case "custodial_provider_os_cancel_unconfirmed":
            case "custodial_provider_os_cancel_failed":
            case "custodial_provider_notifications_blocked":
            case "custodial_provider_notification_manager_unavailable":
            case "custodial_provider_os_inventory_unavailable":
            case "custodial_provider_audio_stop_unconfirmed":
            case "custodial_provider_audio_invalid":
            case "custodial_native_vault_concurrent_change":
            case "custodial_native_pending_state_refused":
            case "custodial_provider_waiting_native_principal":
            case "custodial_provider_operation_stale":
            case "custodial_provider_clock_operation_stale":
            case "custodial_provider_corrupt_preserved":
            case "custodial_provider_key_missing_preserved":
            case "custodial_provider_journal_corrupt_preserved":
            case "custodial_provider_commit_failed_preserved":
            case "custodial_provider_readback_failed_preserved":
            case "custodial_provider_capacity_preserved":
                fixed = code; break;
            default: break;
        }
        return "code=" + fixed + " disposition=" + of(failure).name();
    }

}
