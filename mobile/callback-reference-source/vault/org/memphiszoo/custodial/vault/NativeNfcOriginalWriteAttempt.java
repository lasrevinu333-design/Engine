package org.memphiszoo.custodial.vault;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.json.JSONObject;

/** Native-only original local NFC persistence attempt, NOT custody acceptance.
 * Preserves the original/candidate ciphertext and full prior WORK digest.
 * The ID is allocated once before the first write and recovered unchanged.
 * No principal, scan acceptance, HTTP, inventory ACK, delete/key or manager
 * authority can be produced by this storage protocol.
 */
final class NativeNfcOriginalWriteAttempt {
    static final String SCHEMA="custodial.native-nfc-original-write-attempt.v1";
    static final String FAILURE="custodial_native_nfc_handoff_persistence_uncertain";
    static final String KEY="native_nfc_handoffs";
    final String id, original, candidate, previousGeneration, originalWorkDigest;
    private String previousMutationEpoch;
    String stageEpoch()throws VaultFailure{return AndroidProtectedWorkPreferences.attemptEpoch(previousMutationEpoch,1);}
    String commitEpoch()throws VaultFailure{return AndroidProtectedWorkPreferences.attemptEpoch(previousMutationEpoch,2);}
    private NativeNfcOriginalWriteAttempt(String id,String original,String candidate,
        String previousGeneration,String originalWorkDigest)throws VaultFailure {
        this.id=uuid(id);this.original=original;this.candidate=candidate;
        this.previousGeneration=previousGeneration.isEmpty()?"":uuid(previousGeneration);
        if(candidate==null||candidate.isEmpty()||candidate.length()>131072
            ||original!=null&&original.length()>262144||!originalWorkDigest.matches("[a-f0-9]{64}"))throw invalid();
        this.originalWorkDigest=originalWorkDigest;
    }
    static NativeNfcOriginalWriteAttempt prepare(Map<String,?> raw,String original,String candidate)throws VaultFailure {
        if(raw==null||!Objects.equals(raw.get(KEY),original))throw invalid();
        Object generation=raw.get(AndroidProtectedWorkPreferences.NFC_GENERATION_KEY);
        if(generation!=null&&!(generation instanceof String))throw invalid();
        var result=new NativeNfcOriginalWriteAttempt(UUID.randomUUID().toString(),original,candidate,
            generation==null?"":(String)generation,NativeProtectedWorkSnapshot.capture(raw).digest);
        result.previousMutationEpoch=AndroidProtectedWorkPreferences.durableEpoch(raw);result.commitEpoch();return result;
    }
    JSONObject encode()throws VaultFailure {
        try{JSONObject value=new JSONObject().put("schema",previousMutationEpoch==null?SCHEMA:"custodial.native-nfc-original-write-attempt.v2").put("operation_id",id)
            .put("original_absent",original==null).put("original_wire",original==null?"":original)
            .put("candidate_wire",candidate).put("previous_generation",previousGeneration)
            .put("original_work_sha256",originalWorkDigest)
            .put("original_wire_sha256",wireDigest(original)).put("candidate_wire_sha256",wireDigest(candidate));
            if(previousMutationEpoch!=null)value.put("previous_mutation_epoch",previousMutationEpoch);return value;}
        catch(Exception e){throw invalid();}
    }
    static NativeNfcOriginalWriteAttempt decode(JSONObject value)throws VaultFailure {
        try{
            if(value!=null&&"custodial.native-nfc-original-write-attempt.v2".equals(value.opt("schema"))){
                if(!(value.opt("previous_mutation_epoch") instanceof String))throw invalid();
                String previous=value.getString("previous_mutation_epoch");AndroidProtectedWorkPreferences.attemptEpoch(previous,2);
                JSONObject legacy=new JSONObject(value.toString());legacy.remove("previous_mutation_epoch");legacy.put("schema",SCHEMA);
                NativeNfcOriginalWriteAttempt result=decodeLegacy(legacy);result.previousMutationEpoch=previous;return result;
            }
            return decodeLegacy(value);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    private static NativeNfcOriginalWriteAttempt decodeLegacy(JSONObject value)throws VaultFailure {
        try{NativeRetainedAttempt.keys(value,"schema","operation_id","original_absent","original_wire","candidate_wire",
                "previous_generation","original_work_sha256","original_wire_sha256","candidate_wire_sha256");
            if(!SCHEMA.equals(value.get("schema"))||!(value.get("original_absent") instanceof Boolean))throw invalid();
            for(String key:new String[]{"operation_id","original_wire","candidate_wire","previous_generation","original_work_sha256","original_wire_sha256","candidate_wire_sha256"})
                if(!(value.get(key) instanceof String))throw invalid();
            boolean absent=value.getBoolean("original_absent");String old=value.getString("original_wire");
            if(absent&&!old.isEmpty())throw invalid();
            var result=new NativeNfcOriginalWriteAttempt(value.getString("operation_id"),absent?null:old,
                value.getString("candidate_wire"),value.getString("previous_generation"),value.getString("original_work_sha256"));
            if(!wireDigest(result.original).equals(value.getString("original_wire_sha256"))
                ||!wireDigest(result.candidate).equals(value.getString("candidate_wire_sha256")))throw invalid();
            return result;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}
    }
    /** Reconstruct only the original fixed row for validation; every other
     * source row must still hash to the exact original WORK observation. */
    Map<String,?> originalFrom(Map<String,?> current)throws VaultFailure {
        if(current==null||current.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY)
            ||current.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY))throw invalid();
        Object observed=current.get(KEY),generation=current.get(AndroidProtectedWorkPreferences.NFC_GENERATION_KEY);
        if(!Objects.equals(observed,original)&&!Objects.equals(observed,candidate))throw invalid();
        String g=generation==null?"":generation instanceof String?(String)generation:null;
        if(g==null||!g.equals(previousGeneration)&&!g.equals(id))throw invalid();
        Map<String,Object> prior=new HashMap<>(current);
        AndroidProtectedWorkPreferences.reconstructEpoch(prior,previousMutationEpoch,AndroidProtectedWorkPreferences.NFC_WRITE_KEY,g,id);
        prior.remove(AndroidProtectedWorkPreferences.NFC_WRITE_KEY);
        if(original==null)prior.remove(KEY);else prior.put(KEY,original);
        if(previousGeneration.isEmpty())prior.remove(AndroidProtectedWorkPreferences.NFC_GENERATION_KEY);
        else prior.put(AndroidProtectedWorkPreferences.NFC_GENERATION_KEY,previousGeneration);
        if(!NativeProtectedWorkSnapshot.capture(prior).digest.equals(originalWorkDigest))throw invalid();
        return prior;
    }
    private static String wireDigest(String value)throws VaultFailure {
        return NativeProtectedWorkSnapshot.capture(value==null?Map.of():Map.of(KEY,value)).digest;
    }
    static String uuid(String text)throws VaultFailure {
        try{UUID id=UUID.fromString(text);if(!id.toString().equals(text)||id.version()!=4||id.variant()!=2)throw invalid();return text;}
        catch(Exception e){throw invalid();}
    }
    static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
