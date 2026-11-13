package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONObject;

/** Point-in-time CLEANING observation. No grant, setter, provider clock, recovery,
 * transport, scan consumer or protected-work mutation. */
final class NativeReadinessObservation {
    interface Stable { boolean unchanged() throws VaultFailure; }
    interface Source { Snapshot capture() throws VaultFailure; }
    static final class Snapshot {
        final OfflineAuthorityTime time; final NativePrincipalJournal principal; final NativeLegacyLineageJournal legacy;
        final Stable stable; final boolean admissionBlocked;
        Snapshot(OfflineAuthorityTime time,NativePrincipalJournal principal,NativeLegacyLineageJournal legacy,boolean admissionBlocked,Stable stable) {
            this.time=time; this.principal=principal; this.legacy=legacy; this.admissionBlocked=admissionBlocked; this.stable=stable;
        }
    }
    private final VaultEngine engine; private final Source source;
    NativeReadinessObservation(VaultEngine engine,Source source) { this.engine=engine; this.source=source; }
    Map<String,Object> observe(String requestedDevice,String expectedIdentity) {
        Map<String,Object> result = unknown("observation_unavailable");
        try {
            String device=VaultValidation.deviceId(requestedDevice);
            if (!device.equals(requestedDevice) || expectedIdentity == null || expectedIdentity.length() > 8192) return unknown("request_invalid");
            JSONObject expected=ProviderWireJson.object(expectedIdentity.getBytes(StandardCharsets.UTF_8),8192);
            NativeProviderPrincipal expectedPrincipal=NativeProviderPrincipal.fromNativeJournal(expected);
            if (!device.equals(expected.getString("device_id"))) return unknown("request_invalid");
            synchronized(engine) {
                Map<String,Object> before=engine.observeStateReadOnly();
                if (!Boolean.TRUE.equals(before.get("active"))) { result.put("observation","NEEDS_MANAGER"); result.put("reason","native_enrollment_unavailable"); return result; }
                Snapshot snapshot=source.capture();
                JSONObject actual=principal(before,snapshot);
                if (actual==null || !expectedPrincipal.same(NativeProviderPrincipal.fromNativeJournal(actual))) return unknown("principal_changed");
                result.put("canonical_device_id",device); result.put("principal_identity",expectedIdentity);
                if (snapshot.admissionBlocked) {
                    result.put("observation","NEEDS_MANAGER"); result.put("reason","protected_work_recovery_required"); result.put("protected_work_admission","RECOVERY_REQUIRED");
                } else result.putAll(snapshot.time.observeReadiness(device,actual));
                Map<String,Object> after=engine.observeStateReadOnly();
                if (!before.equals(after) || !snapshot.stable.unchanged()) return unknown("observation_changed");
                // Re-read actual current principal/generation from a NEW atomic
                // capture. A same-vault-revision reassignment is not invisible.
                Snapshot latest=source.capture(); JSONObject current=principal(after,latest);
                if (current==null || !expectedPrincipal.same(NativeProviderPrincipal.fromNativeJournal(current))
                    || !latest.stable.unchanged() || !snapshot.stable.unchanged()
                    || snapshot.admissionBlocked != latest.admissionBlocked) return unknown("principal_or_protected_state_changed");
                return result;
            }
        } catch(Exception unavailable) { return unknown("observation_unavailable"); }
    }
    private JSONObject principal(Map<String,Object> state,Snapshot snapshot) throws VaultFailure {
        return NativeLegacyLineageJournal.applies(state) ? engine.readLegacyPrincipal(snapshot.legacy) : snapshot.principal.readFor(state);
    }
    private static Map<String,Object> unknown(String reason) {
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("schema","custodial.phone-readiness-observation.v1");
        for(String key:new String[]{"canonical_device_id","principal_identity","snapshot_id","observed_boot_count","observed_elapsed_realtime_ms",
            "pending_occurrences","unfinished_occurrence","rollback_fence_active"}) result.put(key,null);
        result.put("observation","UNKNOWN"); result.put("reason",reason); result.put("native_clock_continuity","UNVERIFIED");
        result.put("protected_work_admission","UNKNOWN"); result.put("read_only",true); return result;
    }
}
