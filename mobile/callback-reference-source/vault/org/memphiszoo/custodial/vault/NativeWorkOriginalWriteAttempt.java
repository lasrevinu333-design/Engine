package org.memphiszoo.custodial.vault;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.json.JSONObject;

/** One existing encrypted WORK row's local save, never server acceptance or
 * separation authority. The exact original and candidate ciphertexts remain
 * recoverable under the existing key and full original WORK observation. */
final class NativeWorkOriginalWriteAttempt {
    static final String SCHEMA="custodial.native-work-original-write-attempt.v1";
    static final String DELETE_SCHEMA="custodial.native-work-original-delete-attempt.v1";
    static final String OCCURRENCE_DELETE_SCHEMA="custodial.native-work-original-occurrence-delete-attempt.v1";
    static final String PRESERVATION_SCHEMA="custodial.native-work-original-preservation-attempt.v1";
    static final String FAILURE="custodial_native_work_original_write_uncertain";
    final String id,key,original,candidate,previousGeneration,originalWorkDigest;
    final String proofKey,originalProof;
    final String preservationPurpose;
    final Map<String,String> preservationOriginals,preservationCandidates;
    private String previousMutationEpoch; // null denotes retained v1 with no durable predecessor authority
    private NativeWorkOriginalWriteAttempt pinEpoch(Map<String,?> raw)throws VaultFailure {
        previousMutationEpoch=AndroidProtectedWorkPreferences.durableEpoch(raw);
        stageEpoch();commitEpoch();return this;
    }
    String stageEpoch()throws VaultFailure{return AndroidProtectedWorkPreferences.attemptEpoch(previousMutationEpoch,1);}
    String commitEpoch()throws VaultFailure{return AndroidProtectedWorkPreferences.attemptEpoch(previousMutationEpoch,2);}
    private NativeWorkOriginalWriteAttempt(String id,String key,String original,String candidate,
        String previousGeneration,String digest)throws VaultFailure {
        this(id,key,original,candidate,previousGeneration,digest,null,null);
    }
    private NativeWorkOriginalWriteAttempt(String id,String key,String original,String candidate,
        String previousGeneration,String digest,String proofKey,String originalProof)throws VaultFailure {
        this.id=NativeNfcOriginalWriteAttempt.uuid(id);
        boolean pair=proofKey!=null;
        if(pair&&(key==null||!key.matches("offline_occurrence_sha256:[a-f0-9]{64}")
            ||!proofKey.equals("offline_finish_proof_sha256:"+key.substring("offline_occurrence_sha256:".length()))
            ||candidate!=null||original==null&&originalProof==null||originalProof!=null&&originalProof.length()>262144))throw invalid();
        int wireLimit=key!=null&&key.matches("authenticated_completion_receipt_sha256:[a-f0-9]{64}")?4*1024*1024:262144;
        if(!allowed(key)||(!pair&&candidate==null?(original==null||!("rollback_fence".equals(key)||key.matches("authenticated_completion_receipt_sha256:[a-f0-9]{64}"))):candidate!=null&&(candidate.isEmpty()||candidate.length()>wireLimit))
            ||original!=null&&original.length()>wireLimit||!digest.matches("[a-f0-9]{64}"))throw invalid();
        this.key=key;this.original=original;this.candidate=candidate;
        this.proofKey=proofKey;this.originalProof=originalProof;
        this.preservationPurpose=null;this.preservationOriginals=null;this.preservationCandidates=null;
        this.previousGeneration=previousGeneration.isEmpty()?"":NativeNfcOriginalWriteAttempt.uuid(previousGeneration);
        this.originalWorkDigest=digest;
    }
    private NativeWorkOriginalWriteAttempt(String id,String generation,String digest,String purpose,
        Map<String,String> originals,Map<String,String> candidates)throws VaultFailure {
        this.id=NativeNfcOriginalWriteAttempt.uuid(id);this.previousGeneration=generation.isEmpty()?"":NativeNfcOriginalWriteAttempt.uuid(generation);
        boolean disposition="SCAN_DISPOSITION".equals(purpose);
        if(digest==null||!digest.matches("[a-f0-9]{64}")||originals==null||candidates==null||candidates.size()!=(disposition?4:2)
            ||!originals.keySet().equals(candidates.keySet()))throw invalid();
        for(String k:candidates.keySet())if(k==null||(candidates.get(k)==null?
            !(disposition&&"offline_scan_journal_quarantine_active".equals(k)):candidates.get(k).isEmpty()||candidates.get(k).length()>262144)
            ||originals.get(k)!=null&&originals.get(k).length()>262144)throw invalid();
        this.key=null;this.original=null;this.candidate=null;this.proofKey=null;this.originalProof=null;
        this.originalWorkDigest=digest;this.preservationPurpose=purpose;
        this.preservationOriginals=java.util.Collections.unmodifiableMap(new HashMap<>(originals));
        this.preservationCandidates=java.util.Collections.unmodifiableMap(new HashMap<>(candidates));
        preservationRecordKey();
    }
    private String preservationRecordKey()throws VaultFailure {
        if("SCAN_DISPOSITION".equals(preservationPurpose)){
            String record=null;for(String k:preservationCandidates.keySet())if(k.startsWith("offline_scan_journal_disposition:")){if(record!=null)throw invalid();record=k;}
            if(record==null||!preservationCandidates.keySet().equals(java.util.Set.of(record,"offline_scan_entries","offline_scan_journal_disposition_latest","offline_scan_journal_quarantine_active"))
                ||preservationCandidates.get("offline_scan_journal_quarantine_active")!=null
                ||!Objects.equals(preservationCandidates.get(record),preservationCandidates.get("offline_scan_journal_disposition_latest")))throw invalid();
            NativeNfcOriginalWriteAttempt.uuid(record.substring("offline_scan_journal_disposition:".length()));return record;
        }
        String prefix,metadata;
        if("ANCHOR".equals(preservationPurpose)){prefix="offline_authority_anchor_quarantine_record:";metadata="offline_authority_anchor_quarantine_metadata:";}
        else if("NFC".equals(preservationPurpose)){prefix="native_nfc_handoff_quarantine_record:";metadata="native_nfc_handoff_quarantine_metadata:";}
        else if("SCAN".equals(preservationPurpose)){prefix="offline_scan_journal_quarantine_record:";metadata="offline_scan_journal_quarantine_active";}
        else throw invalid();
        String record=null;
        for(String k:preservationCandidates.keySet())if(k.startsWith(prefix)){if(record!=null)throw invalid();record=k;}
        if(record==null)throw invalid();String suffix=record.substring(prefix.length());
        if("SCAN".equals(preservationPurpose))NativeNfcOriginalWriteAttempt.uuid(suffix);
        else if(!suffix.matches("[a-f0-9]{64}"))throw invalid();
        String other="SCAN".equals(preservationPurpose)?metadata:metadata+suffix;
        if(!preservationCandidates.containsKey(other))throw invalid();return record;
    }
    private void validatePreservationSource(Map<String,?> prior)throws VaultFailure {
        if("SCAN_DISPOSITION".equals(preservationPurpose)){validateDispositionSource(prior);return;}
        try{String source="ANCHOR".equals(preservationPurpose)?"offline_authority_anchor":"NFC".equals(preservationPurpose)?"native_nfc_handoffs":"offline_scan_entries";
            String record=preservationRecordKey(),wire=preservationCandidates.get(record);
            if(!wire.equals(prior.get(source)))throw invalid();
            byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(wire.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex=new StringBuilder(64);for(byte b:bytes){hex.append(Character.forDigit((b>>>4)&15,16));hex.append(Character.forDigit(b&15,16));}
            String digest=hex.toString();
            for(var row:preservationCandidates.entrySet())if(!row.getKey().equals(record)){
                JSONObject metadata=new JSONObject(row.getValue());
                if(!source.equals(metadata.get("source_key"))||!digest.equals(metadata.get("source_sha256"))||!record.equals(metadata.get("quarantine_key")))throw invalid();
            }
            if(!"SCAN".equals(preservationPurpose)&&!record.endsWith(":"+digest))throw invalid();
            for(String k:preservationCandidates.keySet())if((k.equals(record)||!"SCAN".equals(preservationPurpose))
                &&preservationOriginals.get(k)!=null&&!preservationOriginals.get(k).equals(preservationCandidates.get(k)))throw invalid();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}
    }
    private void validateDispositionSource(Map<String,?> prior)throws VaultFailure {
        try{String record=preservationRecordKey();JSONObject disposition=new JSONObject(preservationCandidates.get(record));
            NativeRetainedAttempt.keys(disposition,"schema_version","state","preserved","manager_recovery_required","recovery_id","source_key","source_sha256","quarantine_key","reason","preserved_at","disposition_key","manager_recovery_operation_id","device_id","manager_recovery_enrolled_at","resolved_at","replacement_journal_sha256");
            if(!"custodial-scan-journal-disposition.v1".equals(disposition.get("schema_version"))||!"RESOLVED".equals(disposition.get("state"))
                ||!Boolean.TRUE.equals(disposition.get("preserved"))||!Boolean.FALSE.equals(disposition.get("manager_recovery_required"))
                ||!"offline_scan_entries".equals(disposition.get("source_key"))||!record.equals(disposition.get("disposition_key")))throw invalid();
            String recoveryId=NativeNfcOriginalWriteAttempt.uuid(disposition.getString("recovery_id")),quarantineKey="offline_scan_journal_quarantine_record:"+recoveryId;
            if(!record.equals("offline_scan_journal_disposition:"+recoveryId)||!quarantineKey.equals(disposition.get("quarantine_key")))throw invalid();
            Object source=prior.get("offline_scan_entries"),saved=prior.get(quarantineKey),active=prior.get("offline_scan_journal_quarantine_active");
            if(!(source instanceof String)||!source.equals(saved)||!(active instanceof String))throw invalid();
            JSONObject original=new JSONObject((String)active);
            for(String field:new String[]{"recovery_id","source_key","source_sha256","quarantine_key","reason","preserved_at"})if(!Objects.equals(original.get(field),disposition.get(field)))throw invalid();
            if(!"custodial-scan-journal-quarantine.v1".equals(original.get("schema_version"))||!"CORRUPTED".equals(original.get("state"))
                ||!Boolean.TRUE.equals(original.get("preserved"))||!Boolean.TRUE.equals(original.get("manager_recovery_required")))throw invalid();
            if(!wireSha256((String)source).equals(disposition.get("source_sha256"))
                ||!wireSha256(preservationCandidates.get("offline_scan_entries")).equals(disposition.get("replacement_journal_sha256")))throw invalid();
            VaultValidation.operationId(disposition.getString("manager_recovery_operation_id"));VaultValidation.deviceId(disposition.getString("device_id"));
            long preserved=VaultTimestamps.epochMillis(disposition.getString("preserved_at"),FAILURE),enrolled=VaultTimestamps.epochMillis(disposition.getString("manager_recovery_enrolled_at"),FAILURE);
            VaultTimestamps.epochMillis(disposition.getString("resolved_at"),FAILURE);if(preserved>=enrolled)throw invalid();
            if(preservationOriginals.get(record)!=null&&!preservationOriginals.get(record).equals(preservationCandidates.get(record)))throw invalid();
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}
    }
    private static String wireSha256(String wire)throws Exception {
        byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(wire.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder hex=new StringBuilder(64);for(byte b:bytes){hex.append(Character.forDigit((b>>>4)&15,16));hex.append(Character.forDigit(b&15,16));}return hex.toString();
    }
    static NativeWorkOriginalWriteAttempt preparePreservation(Map<String,?> raw,String purpose,Map<String,String> candidates)throws VaultFailure {
        if(raw==null||candidates==null)throw invalid();Map<String,String> originals=new HashMap<>();
        for(String k:candidates.keySet()){Object value=raw.get(k);if(value!=null&&!(value instanceof String))throw invalid();originals.put(k,(String)value);}
        Object generation=raw.get(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);if(generation!=null&&!(generation instanceof String))throw invalid();
        var attempt=new NativeWorkOriginalWriteAttempt(UUID.randomUUID().toString(),generation==null?"":(String)generation,
            NativeProtectedWorkSnapshot.capture(raw).digest,purpose,originals,candidates);
        attempt.pinEpoch(raw);attempt.validatePreservationSource(raw);return attempt;
    }
    static NativeWorkOriginalWriteAttempt prepareOccurrenceDelete(Map<String,?> raw,String key,String proofKey)throws VaultFailure {
        if(raw==null)throw invalid();Object old=raw.get(key),proof=raw.get(proofKey),generation=raw.get(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);
        if(old!=null&&!(old instanceof String)||proof!=null&&!(proof instanceof String)||generation!=null&&!(generation instanceof String))throw invalid();
        return new NativeWorkOriginalWriteAttempt(UUID.randomUUID().toString(),key,(String)old,null,
            generation==null?"":(String)generation,NativeProtectedWorkSnapshot.capture(raw).digest,proofKey,(String)proof).pinEpoch(raw);
    }
    private static boolean allowed(String key){
        return key!=null&&(java.util.Set.of("authenticated_principal","assigned_activation_transport",
            "assigned_activation_proof","offline_authority_anchor","rollback_fence","offline_scan_entries").contains(key)
            ||key.matches("(?:authenticated_completion_receipt_sha256:|offline_occurrence_sha256:|offline_finish_proof_sha256:|native_recurring_target_sha256:|native_recurring_view_chunk_sha256:|native_notification_mutation_sha256:|native_recurring_purpose_sha256:)[a-f0-9]{64}")
            ||key.matches("legacy_lineage:(?:principal|(?:binding|activation|terminal|invalidated):[a-f0-9-]{36})"));
    }
    static NativeWorkOriginalWriteAttempt prepare(Map<String,?> raw,String key,String original,String candidate)throws VaultFailure {
        if(raw==null||!Objects.equals(raw.get(key),original))throw invalid();
        Object generation=raw.get(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);
        if(generation!=null&&!(generation instanceof String))throw invalid();
        return new NativeWorkOriginalWriteAttempt(UUID.randomUUID().toString(),key,original,candidate,
            generation==null?"":(String)generation,NativeProtectedWorkSnapshot.capture(raw).digest).pinEpoch(raw);
    }
    JSONObject encode()throws VaultFailure {
        try {
            JSONObject value=encodeLegacy();
            if(previousMutationEpoch!=null){
                value.put("schema",value.getString("schema").replace(".v1",".v2"));
                value.put("previous_mutation_epoch",previousMutationEpoch);
            }
            return value;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}
    }
    private JSONObject encodeLegacy()throws VaultFailure {
        if(preservationPurpose!=null){try{
            org.json.JSONArray rows=new org.json.JSONArray();for(String k:new java.util.TreeSet<>(preservationCandidates.keySet()))
                rows.put(new JSONObject().put("key",k).put("original_absent",preservationOriginals.get(k)==null)
                    .put("original_wire",preservationOriginals.get(k)==null?"":preservationOriginals.get(k)).put("candidate_wire",preservationCandidates.get(k)==null?JSONObject.NULL:preservationCandidates.get(k)));
            return new JSONObject().put("schema",PRESERVATION_SCHEMA).put("operation_id",id).put("purpose",preservationPurpose)
                .put("previous_generation",previousGeneration).put("original_work_sha256",originalWorkDigest).put("rows",rows);
        }catch(Exception e){throw invalid();}}
        try{JSONObject value=new JSONObject().put("schema",proofKey!=null?OCCURRENCE_DELETE_SCHEMA:candidate==null?DELETE_SCHEMA:SCHEMA).put("operation_id",id).put("key",key)
            .put("original_absent",original==null).put("original_wire",original==null?"":original)
            .put("candidate_wire",candidate==null?"":candidate).put("previous_generation",previousGeneration)
            .put("original_work_sha256",originalWorkDigest)
            .put("original_wire_sha256",wireDigest(original)).put("candidate_wire_sha256",wireDigest(candidate));
            if(proofKey!=null)value.put("proof_key",proofKey).put("original_proof_absent",originalProof==null)
                .put("original_proof_wire",originalProof==null?"":originalProof).put("original_proof_wire_sha256",proofDigest());
            return value;
        }catch(Exception e){throw invalid();}
    }
    static NativeWorkOriginalWriteAttempt decode(JSONObject value)throws VaultFailure {
        try{
            if(value==null||!(value.opt("schema") instanceof String))throw invalid();
            String schema=value.getString("schema");
            if(schema.endsWith(".v2")){
                if(!(value.opt("previous_mutation_epoch") instanceof String))throw invalid();
                String previous=value.getString("previous_mutation_epoch");
                AndroidProtectedWorkPreferences.attemptEpoch(previous,2);
                JSONObject legacy=new JSONObject(value.toString());legacy.remove("previous_mutation_epoch");
                legacy.put("schema",schema.substring(0,schema.length()-3)+".v1");
                NativeWorkOriginalWriteAttempt result=decodeLegacy(legacy);result.previousMutationEpoch=previous;return result;
            }
            return decodeLegacy(value);
        }catch(VaultFailure error){throw error;}catch(Exception error){throw invalid();}
    }
    private static NativeWorkOriginalWriteAttempt decodeLegacy(JSONObject value)throws VaultFailure {
        if(PRESERVATION_SCHEMA.equals(value.opt("schema"))){try{
            NativeRetainedAttempt.keys(value,"schema","operation_id","purpose","previous_generation","original_work_sha256","rows");
            for(String field:new String[]{"schema","operation_id","purpose","previous_generation","original_work_sha256"})if(!(value.get(field) instanceof String))throw invalid();
            org.json.JSONArray rows=value.getJSONArray("rows");if(rows.length()!=("SCAN_DISPOSITION".equals(value.get("purpose"))?4:2))throw invalid();
            Map<String,String> originals=new HashMap<>(),candidates=new HashMap<>();
            for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);NativeRetainedAttempt.keys(row,"key","original_absent","original_wire","candidate_wire");
                if(!(row.get("original_absent") instanceof Boolean))throw invalid();
                for(String field:new String[]{"key","original_wire"})if(!(row.get(field) instanceof String))throw invalid();
                if(!(row.get("candidate_wire") instanceof String)&&row.get("candidate_wire")!=JSONObject.NULL)throw invalid();
                String k=row.getString("key"),old=row.getString("original_wire");if(candidates.containsKey(k)||row.getBoolean("original_absent")&&!old.isEmpty())throw invalid();
                originals.put(k,row.getBoolean("original_absent")?null:old);candidates.put(k,row.get("candidate_wire")==JSONObject.NULL?null:row.getString("candidate_wire"));}
            return new NativeWorkOriginalWriteAttempt(value.getString("operation_id"),value.getString("previous_generation"),value.getString("original_work_sha256"),value.getString("purpose"),originals,candidates);
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}}
        try{boolean pair=OCCURRENCE_DELETE_SCHEMA.equals(value.get("schema"));
            if(pair)NativeRetainedAttempt.keys(value,"schema","operation_id","key","original_absent","original_wire",
                "candidate_wire","previous_generation","original_work_sha256","original_wire_sha256","candidate_wire_sha256",
                "proof_key","original_proof_absent","original_proof_wire","original_proof_wire_sha256");
            else NativeRetainedAttempt.keys(value,"schema","operation_id","key","original_absent","original_wire",
            "candidate_wire","previous_generation","original_work_sha256","original_wire_sha256","candidate_wire_sha256");
            boolean deletion=pair||DELETE_SCHEMA.equals(value.get("schema"));
            if((!deletion&&!SCHEMA.equals(value.get("schema")))||!(value.get("original_absent") instanceof Boolean))throw invalid();
            for(String field:new String[]{"operation_id","key","original_wire","candidate_wire","previous_generation",
                "original_work_sha256","original_wire_sha256","candidate_wire_sha256"})if(!(value.get(field) instanceof String))throw invalid();
            boolean absent=value.getBoolean("original_absent");String old=value.getString("original_wire");
            if(absent&&!old.isEmpty())throw invalid();
            if(deletion&&!value.getString("candidate_wire").isEmpty())throw invalid();
            String proofKey=null,proof=null;
            if(pair){if(!(value.get("original_proof_absent") instanceof Boolean))throw invalid();
                for(String field:new String[]{"proof_key","original_proof_wire","original_proof_wire_sha256"})if(!(value.get(field) instanceof String))throw invalid();
                proofKey=value.getString("proof_key");proof=value.getString("original_proof_wire");
                if(value.getBoolean("original_proof_absent")){if(!proof.isEmpty())throw invalid();proof=null;}}
            var result=new NativeWorkOriginalWriteAttempt(value.getString("operation_id"),value.getString("key"),
                absent?null:old,deletion?null:value.getString("candidate_wire"),value.getString("previous_generation"),value.getString("original_work_sha256"),proofKey,proof);
            if(!result.wireDigest(result.original).equals(value.getString("original_wire_sha256"))
                ||!result.wireDigest(result.candidate).equals(value.getString("candidate_wire_sha256")))throw invalid();
            if(pair&&!result.proofDigest().equals(value.getString("original_proof_wire_sha256")))throw invalid();
            return result;
        }catch(VaultFailure e){throw e;}catch(Exception e){throw invalid();}
    }
    Map<String,?> originalFrom(Map<String,?> current)throws VaultFailure {
        if(current==null||current.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY)
            ||current.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY)
            ||current.containsKey(AndroidProtectedWorkPreferences.NFC_WRITE_KEY))throw invalid();
        Object generation=current.get(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);
        if(preservationPurpose==null){Object observed=current.get(key);
        if(!Objects.equals(observed,original)&&!Objects.equals(observed,candidate))throw invalid();
        if(proofKey!=null&&!Objects.equals(current.get(proofKey),originalProof)&&current.get(proofKey)!=null)throw invalid();
        }else for(String k:preservationCandidates.keySet())if(!Objects.equals(current.get(k),preservationOriginals.get(k))&&!Objects.equals(current.get(k),preservationCandidates.get(k)))throw invalid();
        String g=generation==null?"":generation instanceof String?(String)generation:null;
        if(g==null||!g.equals(previousGeneration)&&!g.equals(id))throw invalid();
        Map<String,Object> prior=new HashMap<>(current);
        AndroidProtectedWorkPreferences.reconstructEpoch(prior,previousMutationEpoch,AndroidProtectedWorkPreferences.WORK_WRITE_KEY,g,id);
        prior.remove(AndroidProtectedWorkPreferences.WORK_WRITE_KEY);
        for(var row:writeValues(true).entrySet()){if(row.getValue()==null)prior.remove(row.getKey());else prior.put(row.getKey(),row.getValue());}
        if(previousGeneration.isEmpty())prior.remove(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY);
        else prior.put(AndroidProtectedWorkPreferences.WORK_GENERATION_KEY,previousGeneration);
        if(!NativeProtectedWorkSnapshot.capture(prior).digest.equals(originalWorkDigest))throw invalid();
        if(preservationPurpose!=null)validatePreservationSource(prior);
        return prior;
    }
    Map<String,String> writeValues(boolean rollback){
        if(preservationPurpose!=null)return new HashMap<>(rollback?preservationOriginals:preservationCandidates);
        Map<String,String> values=new HashMap<>();values.put(key,rollback?original:candidate);
        if(proofKey!=null)values.put(proofKey,rollback?originalProof:null);return values;
    }
    private String proofDigest()throws VaultFailure {
        return NativeProtectedWorkSnapshot.capture(originalProof==null?Map.of():Map.of(proofKey,originalProof)).digest;
    }
    private String wireDigest(String value)throws VaultFailure {
        return NativeProtectedWorkSnapshot.capture(value==null?Map.of():Map.of(key,value)).digest;
    }
    static VaultFailure invalid(){return new VaultFailure(FAILURE);}
}
