package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.util.Set;

/** Finite support projection only. No Android, identity, authority or storage. */
final class OwnerTestReadinessDiagnostic {
    private String previous;
    private static final Set<String> REASONS=Set.of("observation_unavailable","request_invalid","native_enrollment_unavailable","principal_changed",
        "protected_work_recovery_required","observation_changed","principal_or_protected_state_changed","scan_journal_recovery_required",
        "rollback_fence_active","anchor_missing","snapshot_binding_unverified","snapshot_principal_changed","clock_observation_changed",
        "original_finish_pending","original_receipt_pending","native_scan_pending","current_native_snapshot_observed","anchor_expired",
        "clock_continuity_changed","clock_unavailable","protected_state_unavailable");
    synchronized String changed(boolean testOnly,Map<String,Object> observed) {
        if(!testOnly)return null;
        Map<String,Object> value=observed==null?Map.of():observed;
        String line="native_v1 observation="+pick(value.get("observation"),Set.of("CONFIRMED","NEEDS_INTERNET","NEEDS_MANAGER","DO_NOT_USE","UNKNOWN"))
            +" reason="+pick(value.get("reason"),REASONS)
            +" clock="+pick(value.get("native_clock_continuity"),Set.of("CONFIRMED","UNVERIFIED","EXPIRED"))
            +" admission="+pick(value.get("protected_work_admission"),Set.of("CLEAR","PENDING","RECOVERY_REQUIRED","UNKNOWN"))
            +" read_only="+flag(value.get("read_only"))
            +" pending="+flag(value.get("pending_occurrences"))
            +" unfinished="+flag(value.get("unfinished_occurrence"))
            +" fence="+flag(value.get("rollback_fence_active"));
        if(line.equals(previous))return null;
        previous=line;return line;
    }
    private static String pick(Object value,Set<String> allowed){return value instanceof String&&allowed.contains(value)?(String)value:"UNKNOWN";}
    private static String flag(Object value){return Boolean.TRUE.equals(value)?"true":Boolean.FALSE.equals(value)?"false":"UNKNOWN";}
}
