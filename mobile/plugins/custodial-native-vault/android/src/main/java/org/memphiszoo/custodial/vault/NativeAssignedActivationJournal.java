package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONObject;

/** Protected maintenance-receiver provenance, never writable through Capacitor. */
final class NativeAssignedActivationJournal {
    static final String FAILURE = "custodial_assigned_activation_proof_invalid";
    interface Store {
        String loadAssignedActivation() throws VaultFailure;
        void saveAssignedActivation(String record) throws VaultFailure;
        default String loadAssignedActivationTransport() throws VaultFailure { return null; }
        default void saveAssignedActivationTransport(String record) throws VaultFailure { throw new VaultFailure(FAILURE); }
    }
    private final Store store;
    NativeAssignedActivationJournal(Store store) { this.store=store; }
    // Called only by the DUMP-protected receiver after exact native confirmation.
    synchronized void captureConfirmed(Map<String,Object> state) throws VaultFailure {
        try {
            JSONObject proof=binding(state);
            String encoded=proof.toString();
            store.saveAssignedActivation(encoded);
            if (!encoded.equals(store.loadAssignedActivation())) throw new VaultFailure(FAILURE);
        } catch(VaultFailure e) { throw e; }
        catch(Exception e) { throw new VaultFailure(FAILURE,e); }
    }
    synchronized JSONObject readFor(Map<String,Object> state) throws VaultFailure {
        if (!Boolean.TRUE.equals(state.get("active"))) return null;
        String stored=store.loadAssignedActivation();
        if (stored==null) return null;
        try {
            JSONObject expected=binding(state),proof=new JSONObject(stored);
            if (proof.length()!=expected.length()) throw new VaultFailure(FAILURE);
            for(java.util.Iterator<String> keys=expected.keys();keys.hasNext();){
                String key=keys.next();if(!expected.get(key).equals(proof.opt(key)))return null;
            }
            return proof;
        } catch(VaultFailure e) { throw e; }
        catch(Exception e) { throw new VaultFailure(FAILURE,e); }
    }
    synchronized String digestFor(Map<String,Object> state) throws VaultFailure {
        try {
            JSONObject p=readFor(state); if(p==null)throw new VaultFailure(FAILURE);
            // Fixed order, independent of JSONObject serialization iteration.
            org.json.JSONArray fields=new org.json.JSONArray();
            for(String key:new String[]{"schema_version","operation_id","device_id","flow","installation_seal","enrolled_at","lineage_operation_id"})
                fields.put(p.getString(key));
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(fields.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex=new StringBuilder();for(byte b:digest)hex.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return hex.toString();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }
    synchronized void captureTransportResult(String operation,Map<String,Object> state,String result) throws VaultFailure {
        try {
            JSONObject expected=transportBinding(operation,state,result);
            String encoded=expected.toString();store.saveAssignedActivationTransport(encoded);
            if(!encoded.equals(store.loadAssignedActivationTransport()))throw new VaultFailure(FAILURE);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }
    synchronized String transportResultFor(String operation,Map<String,Object> state) throws VaultFailure {
        String stored=store.loadAssignedActivationTransport();if(stored==null)return "delivery_unknown";
        try {
            JSONObject value=new JSONObject(stored),expected=transportBinding(operation,state,value.getString("result"));
            if(value.length()!=expected.length())throw new VaultFailure(FAILURE);
            for(java.util.Iterator<String> keys=expected.keys();keys.hasNext();){
                String k=keys.next();if(!expected.get(k).equals(value.opt(k)))return "delivery_unknown";
            }
            return value.getString("result");
        }catch(VaultFailure e){throw e;}catch(Exception e){throw new VaultFailure(FAILURE,e);}
    }
    private JSONObject transportBinding(String operation,Map<String,Object> state,String result) throws Exception {
        operation=VaultValidation.operationId(operation);
        boolean changed=operation.equals(state.get("active_enrollment_operation_id"));
        if(!(changed?"native_active":"not_required").equals(result))throw new VaultFailure(FAILURE);
        return new JSONObject().put("schema_version","native-assigned-activation-transport.v1").put("operation_id",operation)
            .put("credential_id",VaultValidation.operationId(String.valueOf(state.get("active_credential_id"))))
            .put("journal_digest",digestFor(state)).put("result",result);
    }
    private JSONObject binding(Map<String,Object> state) throws Exception {
        JSONObject s=new JSONObject(state),installation=s.getJSONObject("installation");
        String flow=s.optString("active_enrollment_flow");
        if(!Boolean.TRUE.equals(s.opt("active"))||!("enrollment".equals(flow)||"recovery".equals(flow))) throw new VaultFailure(FAILURE);
        return new JSONObject().put("schema_version","native-assigned-activation.v1")
            .put("operation_id",VaultValidation.operationId(s.getString("active_enrollment_operation_id")))
            .put("device_id",VaultValidation.deviceId(installation.getString("device_id")))
            .put("flow",flow).put("installation_seal",installation.getString("installation_seal"))
            .put("enrolled_at",installation.getString("enrolled_at"))
            .put("lineage_operation_id",installation.getString("enrollment_operation_id"));
    }
}
