package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.HashMap;
import org.json.JSONObject;

/** SOURCE COMPOSITION ONLY. Synthetic original records/credentials/prefs.
 * No raw file, actual browser/device, network, writer or acceptance effect. */
public final class NativeBrowserCompletionCompositionProbe {
    public static void main(String[] options)throws Exception {
        if(options.length!=3||!java.util.Set.of("fixture","observe").contains(options[0])
            ||!java.util.Set.of("v2","v3").contains(options[1])
            ||!java.util.Set.of("before","equal","after").contains(options[2]))throw new AssertionError("explicit synthetic case required");
        var f=new NativeRetainedCompletionSemanticsTest.Fixture();
        if(!"before".equals(options[2])){
            String end="equal".equals(options[2])?"2026-09-27T08:00:00.123Z":"2026-09-27T08:00:00.124Z";
            if("equal".equals(options[2]))f.cutoff="2026-09-27T08:00:00.123000Z";
            f.args.put("p_client_ended_at",end);f.start.put("completed_at",end);f.end.put("completed_at",end);f.sign();
        }
        if("fixture".equals(options[0])){System.out.println(f.args);f.owner.wiped();return;}
        byte[] candidate=System.in.readNBytes(RequestPolicy.MAX_REQUEST_BYTES+1);
        try{
            if(candidate.length>RequestPolicy.MAX_REQUEST_BYTES)throw new AssertionError("source packet bound");
            f.record("v2".equals(options[1]));f.freeze();
            var before=new HashMap<>(f.owner.workDisk.memory);int commits=f.owner.workDisk.commits;
            var result=NativeSeparationFreeze.inspectOriginalCompletionSemantics(f.owner.engine,f.owner.work,f.owner.principal,null,f.receiptKey,candidate);
            if(!before.equals(f.owner.workDisk.memory)||commits!=f.owner.workDisk.commits||f.owner.opened!=0)throw new AssertionError("composition must not write/open transport");
            System.out.println(new JSONObject().put("schema","custodial.synthetic-native-browser-semantic-composition.v1")
                .put("state",result.state).put("argument_sha256",result.argumentSha256).put("receipt_binding_sha256",result.receiptBindingSha256)
                .put("occurrence_sha256",result.occurrenceSha256).put("finish_sha256",result.finishSha256)
                .put("original_completion_signature_matches",result.originalCompletionSignatureMatches).put("native_session_values_match",result.nativeSessionValuesMatch)
                .put("start_cutoff_relation",result.startCutoffRelation).put("finish_cutoff_relation",result.finishCutoffRelation)
                .put("browser_source_authenticated",result.browserSourceAuthenticated).put("historical_snapshot_principal_verified",result.historicalSnapshotPrincipalVerified)
                .put("clock_profile_qualified",result.clockProfileQualified).put("cutoff_eligible",result.cutoffEligible)
                .put("current_server_readback",result.currentServerReadback).put("work_accepted",result.workAccepted)
                .put("inventory_acknowledged",result.inventoryAcknowledged).put("key_removal",result.keyRemovalAllowed).put("phone_released",result.phoneReleased));
        }finally{Arrays.fill(candidate,(byte)0);f.owner.wiped();}
    }
}
