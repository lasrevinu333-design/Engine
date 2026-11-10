package org.memphiszoo.custodial.vault;
import java.util.HashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;
public final class OwnerTestReadinessDiagnosticTest {
    private Map<String,Object> positive(){return new HashMap<>(Map.of("observation","CONFIRMED","reason","current_native_snapshot_observed",
        "native_clock_continuity","CONFIRMED","protected_work_admission","CLEAR","read_only",true,
        "pending_occurrences",false,"unfinished_occurrence",false,"rollback_fence_active",false));}
    @Test public void ordinaryReleaseEmitsNothingAndDoesNotConsumeFirstTestObservation(){
        var d=new OwnerTestReadinessDiagnostic();var p=positive();assertNull(d.changed(false,p));
        assertEquals("native_v1 observation=CONFIRMED reason=current_native_snapshot_observed clock=CONFIRMED admission=CLEAR read_only=true pending=false unfinished=false fence=false",d.changed(true,p));
        assertNull(d.changed(true,p));assertNull(d.changed(false,Map.of()));
    }
    @Test public void onlyFiniteStateChangesEmitWithoutMutatingInput(){
        var d=new OwnerTestReadinessDiagnostic();var p=positive();var before=new HashMap<>(p);assertNotNull(d.changed(true,p));assertEquals(before,p);
        p.put("snapshot_id","sensitive_snapshot");p.put("principal_identity","sensitive_credential_and_employee");p.put("observed_elapsed_realtime_ms",123456789);
        assertNull(d.changed(true,p));p.put("pending_occurrences",true);String next=d.changed(true,p);assertTrue(next.endsWith("pending=true unfinished=false fence=false"));assertFalse(next.contains("sensitive"));assertNull(d.changed(true,p));
    }
    @Test public void unavailableAndInjectedTextNeverBecomeFalseOrArbitraryLogContent(){
        var d=new OwnerTestReadinessDiagnostic();var p=new HashMap<String,Object>();
        for(String key:new String[]{"observation","reason","native_clock_continuity","protected_work_admission","read_only","pending_occurrences","unfinished_occurrence","rollback_fence_active"})p.put(key,"secret\nforged=true");
        assertEquals("native_v1 observation=UNKNOWN reason=UNKNOWN clock=UNKNOWN admission=UNKNOWN read_only=UNKNOWN pending=UNKNOWN unfinished=UNKNOWN fence=UNKNOWN",d.changed(true,p));
        assertNull(d.changed(true,null));
    }
    @Test public void negativeStatesRemainExplicit(){
        for(String state:new String[]{"NEEDS_INTERNET","NEEDS_MANAGER","DO_NOT_USE","UNKNOWN"}){
            var p=positive();p.put("observation",state);p.put("reason","anchor_expired");p.put("native_clock_continuity","EXPIRED");p.put("protected_work_admission","RECOVERY_REQUIRED");p.put("rollback_fence_active",true);
            String line=new OwnerTestReadinessDiagnostic().changed(true,p);assertTrue(line.contains("observation="+state));assertTrue(line.contains("reason=anchor_expired clock=EXPIRED admission=RECOVERY_REQUIRED"));assertTrue(line.endsWith("fence=true"));
        }
    }
}
