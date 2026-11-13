package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** SOURCE TEST ONLY: all original receipts/credentials/enrollment/prefs/HMAC
 * are synthetic. One packet in memory; no raw files, HTTP, SQL or phone. */
public final class NativeCompletionArgumentStdinProbe {
    public static void main(String[] mode)throws Exception{
        if(mode.length!=1)throw new AssertionError("explicit probe mode");
        if("fixture".equals(mode[0])) {System.out.println(NativeCompletionJournalTest.args());return;}
        if(!"join".equals(mode[0]))throw new AssertionError("unknown probe mode");
        byte[] packet=System.in.readNBytes(RequestPolicy.MAX_REQUEST_BYTES+1);
        JSONObject input=ProviderWireJson.object(packet,RequestPolicy.MAX_REQUEST_BYTES);
        NativeRetainedAttempt.keys(input,"candidate_args_base64","receipt_kind","fault");
        String kind=input.getString("receipt_kind"),fault=input.getString("fault");
        if(!java.util.Set.of("v2","v3").contains(kind)||!java.util.Set.of("none","raw","principal","vault-race","raw-race","candidate-race").contains(fault))throw new AssertionError("unsupported synthetic scope");
        // Test packet is not a retention-write frame; do not reuse that
        // protocol's deliberately smaller Base64 maximum as this input limit.
        String exactBase64=input.getString("candidate_args_base64");byte[] candidate=java.util.Base64.getDecoder().decode(exactBase64);
        if(candidate.length==0||candidate.length>RequestPolicy.MAX_REQUEST_BYTES
            ||!java.util.Base64.getEncoder().encodeToString(candidate).equals(exactBase64))throw new AssertionError("invalid synthetic argument packet");
        var f=new NativeRetainedOwnerTest.Fixture();
        f.workDisk.memory.remove(NativeRetainedWorkCapture.FENCE);f.workDisk.durable=new HashMap<>(f.workDisk.memory);
        var journal=new NativeCompletionJournal(f.work);journal.captureAuthenticatedResponse(NativeCompletionJournalTest.DEVICE,
            NativeCompletionJournalTest.request(NativeCompletionJournalTest.args()),NativeCompletionJournalTest.response(NativeCompletionJournalTest.result()));
        String prefix="authenticated_completion_receipt_sha256:",key=f.workDisk.memory.keySet().stream().filter(k->k.startsWith(prefix)).findFirst().orElseThrow().substring(prefix.length());
        if("v2".equals(kind)){
            JSONObject old=new JSONObject(f.work.loadCompletionReceipt(key));old.put("schema_version","native-server-completion.v2");old.remove("original_request_body_base64");old.remove("original_request_body_sha256");
            f.work.saveCompletionReceipt(key,old.toString());
        }
        var principal=NativeProviderPrincipal.fromNativeJournal(f.principal.readFor(f.engine.getState()));
        var context=NativeSeparationContext.fromAuthenticatedResponse(NativeSeparationContextTest.request(),NativeSeparationContextTest.response(NativeSeparationContextTest.envelope(
            NativeSeparationContextTest.data().put("credential_id",principal.json().get("credential_id")))),principal);
        var raw=f.work.separationRawSnapshot();var proof=f.engine.attestNativeSeparationSnapshot(context,NativeProtectedWorkSnapshot.capture(raw),f.principal,null);f.work.freezeSeparationSnapshot(raw,proof);
        int commits=f.workDisk.commits;var exact=new HashMap<>(f.workDisk.memory);
        if("raw".equals(fault))f.workDisk.memory.put("unknown-original-work","changed before join");
        if("principal".equals(fault)){var reader=f.independentReader();reader.value=new JSONObject(reader.value).put("assignment_epoch",8).toString();}
        NativeSeparationFreeze.InspectionStore store=f.work;
        if(fault.endsWith("-race"))store=new NativeSeparationFreeze.InspectionStore(){
            public Map<String,?> separationRawSnapshot()throws VaultFailure{return f.work.separationRawSnapshot();}
            public void prepareSeparationProbe(Map<String,?> ignored){throw new AssertionError("join cannot prepare");}
            public void freezeSeparationSnapshot(Map<String,?> ignored,NativeSeparationEvidence p){throw new AssertionError("join cannot freeze");}
            public JSONObject readSeparationSnapshotEvidence(Map<String,?> captured)throws VaultFailure{return f.work.readSeparationSnapshotEvidence(captured);}
            public NativeProtectedWorkInventory inspectSeparationSnapshot(Map<String,?> captured,NativeSeparationEvidence p){throw new AssertionError("one join is not a full inventory");}
            public NativeCompletionJournal.RetainedArgumentMatch compareRetainedCompletionArguments(Map<String,?> captured,NativeSeparationEvidence p,String sourceKey,byte[] args)throws VaultFailure{
                var result=f.work.compareRetainedCompletionArguments(captured,p,sourceKey,args);
                try{
                    if("vault-race".equals(fault))f.bumpVault();
                    if("raw-race".equals(fault))f.workDisk.memory.put("unknown-original-work","changed during decode");
                    if("candidate-race".equals(fault))args[0]=0;
                }catch(Exception e){throw new VaultFailure(NativeProtectedWorkSnapshot.FAILURE,e);}
                return result;
            }
        };
        try{
            var result=NativeSeparationFreeze.compareOriginalCompletionArguments(f.engine,store,f.principal,null,key,candidate);
            JSONObject reply=new JSONObject().put("schema","custodial.synthetic-native-completion-argument-join.v1").put("state",result.state)
                .put("semantic_arguments_match",result.semanticArgumentsMatch).put("candidate_arguments_sha256",result.candidateArgumentsSha256)
                .put("browser_source_authenticated",result.browserSourceAuthenticated).put("original_wire_recovered",result.originalWireRecovered)
                .put("cutoff_eligible",result.cutoffEligible).put("work_accepted",result.workAccepted).put("inventory_acknowledged",result.inventoryAcknowledged)
                .put("key_removal",result.keyRemovalAllowed).put("phone_released",result.phoneReleased);
            if(!"none".equals(fault))throw new AssertionError("mutated owner must refuse");
            if(!exact.equals(f.workDisk.memory)||commits!=f.workDisk.commits)throw new AssertionError("read-only join mutated originals");
            System.out.println(reply);
        }catch(VaultFailure failure){System.out.println(new JSONObject().put("refused",true).put("code",failure.code).put("all_authority",false));}
        finally{
            java.util.Arrays.fill(packet,(byte)0);java.util.Arrays.fill(candidate,(byte)0);f.wiped();
            if(commits!=f.workDisk.commits||f.opened!=0)throw new AssertionError("join cannot write or open transport");
        }
    }
}
