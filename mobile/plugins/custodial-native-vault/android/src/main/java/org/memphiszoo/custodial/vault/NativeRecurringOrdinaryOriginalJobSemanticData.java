package org.memphiszoo.custodial.vault;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Pure dual-source semantic DATA. Normal visual/wording is checked against
 * the complete normal formatter contract. ORIGINAL_NATIVE_JOB words are checked
 * separately against the actual native payload and backend-bound speech hash.
 * Neither parsed metadata nor this helper can construct the opaque native read,
 * replay a job, start SDK audio, replace protected Current or grant a receipt. */
final class NativeRecurringOrdinaryOriginalJobSemanticData {
    private NativeRecurringOrdinaryOriginalJobSemanticData(){}
    static void requireOriginal(JSONObject issued,JSONObject derivation,JSONObject reminderRaw,
        NativeProviderPrincipal principal,NativeProviderRuntimeOwner.OrdinaryOriginalJobRead actual)throws VaultFailure {
        try{
            if(issued==null||derivation==null||reminderRaw==null||principal==null||actual==null)throw invalid();
            actual.requireNativeCurrentReadOnly();
            if(!actual.planReadId.equals(issued.get("plan_read_id"))||!actual.semanticDigest.equals(issued.get("semantic_digest"))
                ||!actual.targetDigest.equals(issued.get("target_digest")))throw invalid();
            JSONObject bindings=issued.getJSONObject("delivery_bindings");
            NativeRetainedAttempt.keys(bindings,"schema","state","entries");
            if(!"custodial.recurring-original-native-delivery-bindings.v1".equals(bindings.get("schema"))
                ||!"ORIGINAL_NATIVE_RESERVATIONS".equals(bindings.get("state")))throw invalid();
            JSONArray effects=issued.getJSONArray("required_effects"),audio=issued.getJSONArray("required_audio"),
                derived=derivation.getJSONArray("effects"),entries=bindings.getJSONArray("entries");
            if(effects.length()<1||effects.length()>1024||actual.size()!=effects.length()||entries.length()!=effects.length()
                ||derived.length()!=effects.length()||audio.length()!=effects.length())throw invalid();
            HashSet<String> keys=new HashSet<>(),jobs=new HashSet<>(),audioKeys=new HashSet<>();
            java.util.Map<String,Integer> nativeIndexes=new java.util.HashMap<>();
            for(int i=0;i<audio.length();i++)if(!(audio.get(i) instanceof String)||!audioKeys.add(audio.getString(i)))throw invalid();
            for(int i=0;i<entries.length();i++){
                JSONObject binding=entries.getJSONObject(i);
                String key=binding.getString("notification_key");
                if(nativeIndexes.put(key,i)!=null)throw invalid();
                JSONObject actualBinding=ProviderWireJson.object(actual.originalBindingJson(i).getBytes(StandardCharsets.UTF_8),16384);
                if(!ProviderWireJson.same(binding,actualBinding))throw invalid();
            }
            // Audio is a complete DISTINCT key obligation set. Canonical JSON
            // array order stays byte-bound, never a cross-job playback claim.
            JSONObject target=issued.getJSONObject("target");
            String speaker=text(reminderRaw.getJSONObject("properties").opt("currentDisplayName"),"");
            String device=principal.json().getString("device_id");
            if(!device.equals(reminderRaw.getJSONObject("properties").get("deviceId")))throw invalid();
            for(int i=0;i<effects.length();i++){
                JSONObject effect=effects.getJSONObject(i),normal=derived.getJSONObject(i);
                String key=effect.getString("notification_key");Integer nativeIndex=nativeIndexes.get(key);
                if(!keys.add(key)||!audioKeys.contains(key)||nativeIndex==null||!Boolean.TRUE.equals(effect.get("required_audio")))throw invalid();
                JSONObject binding=entries.getJSONObject(nativeIndex);
                NativeProviderPayload payload=actual.originalPayload(nativeIndex);payload.requirePrincipal(principal);
                if(!key.equals(payload.notificationKey)||!jobs.add(payload.jobId)||!issued.get("service_date").equals(payload.get("service_date"))
                    ||!target.get("projectionId").equals(payload.get("projection_id")))throw invalid();
                // Metadata contains no original payload/token/lease. Its native
                // content and speech digests bind what THIS original owner ran.
                if(!"ORIGINAL_NATIVE_JOB".equals(binding.get("audio_origin"))||!payload.get("kind").equals(binding.get("native_kind"))
                    ||!payload.contentHash.equals(binding.get("content_sha256"))
                    ||!payload.get("body").equals(actual.originalSpeechText(nativeIndex))
                    ||!NativeProviderPrincipal.hash(actual.originalSpeechText(nativeIndex)).equals(binding.get("speech_sha256")))throw invalid();
                requireDigest(actual.originalAttemptSha256(nativeIndex));requireDigest(actual.originalCompletedSha256(nativeIndex));
                requireDigest(actual.originalAudioPolicyDigest(nativeIndex));requireDigest(actual.originalProfileFingerprint(nativeIndex));
                if(actual.originalAdmissionOrdinal(nativeIndex)<1)throw invalid();
                JSONObject expectedNormal;
                switch(effect.getString("origin")){
                    case "FULL_ACCEPTED_LUNCH_DOCUMENT":
                        NativeRetainedAttempt.keys(effect,"origin","notification_key","notification","required_audio");
                        expectedNormal=lunch(effect,target,payload,speaker,device);break;
                    case "EXHAUSTIVE_NORMAL_CURRENT_LOCATION_CYCLES":
                        NativeRetainedAttempt.keys(effect,"origin","notification_key","data","required_audio");
                        expectedNormal=location(effect,target,payload,speaker,device);break;
                    default:throw invalid();
                }
                if(!ProviderWireJson.same(expectedNormal,normal))throw invalid();
            }
            if(!keys.equals(audioKeys)||!keys.equals(nativeIndexes.keySet()))throw invalid();
            // Callback-free check after every DATA access. Real current/profile/
            // journal/OS observations and exact Engine/Source/Store fences remain
            // the fixed caller's obligations, not a supplied JSON verdict.
            actual.requireNativeCurrentReadOnly();
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception unavailable){throw new VaultFailure("custodial_recurring_original_job_semantics_unavailable",unavailable);}
    }
    /** Immutable audit digest only; serialized facts can never reconstruct an
     * owner after restart. Native read/final lifetime must still be present. */
    static String originalFactsSha256(NativeProviderRuntimeOwner.OrdinaryOriginalJobRead actual)throws VaultFailure {
        try{
            if(actual==null||actual.size()<1||actual.size()>1024)throw invalid();actual.requireNativeCurrentReadOnly();
            JSONArray facts=new JSONArray();
            for(int i=0;i<actual.size();i++)facts.put(new JSONObject()
                .put("binding",ProviderWireJson.object(actual.originalBindingJson(i).getBytes(StandardCharsets.UTF_8),16384))
                .put("original_attempt_sha256",actual.originalAttemptSha256(i)).put("original_completed_sha256",actual.originalCompletedSha256(i))
                .put("original_admission_ordinal",actual.originalAdmissionOrdinal(i)).put("audio_policy_sha256",actual.originalAudioPolicyDigest(i))
                .put("profile_fingerprint",actual.originalProfileFingerprint(i))
                .put("original_speech_sha256",NativeProviderPrincipal.hash(actual.originalSpeechText(i))));
            String digest=NativeProviderPrincipal.hash(new JSONObject().put("schema","custodial.ordinary-original-native-job-facts.v1")
                .put("plan_read_id",actual.planReadId).put("semantic_digest",actual.semanticDigest).put("target_digest",actual.targetDigest)
                .put("facts",facts).toString());
            actual.requireNativeCurrentReadOnly();return digest;
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception unavailable){throw new VaultFailure("custodial_recurring_original_job_semantics_unavailable",unavailable);}
    }
    /** Package-only pure transform seam for meaningful DATA tests. No read or
     * authority can be minted from these parsed arguments. */
    static JSONObject lunch(JSONObject effect,JSONObject target,NativeProviderPayload nativePayload,String speaker,String device)throws Exception {
        JSONObject notification=effect.getJSONObject("notification"),data=notification.getJSONObject("data");
        NativeRetainedAttempt.keys(notification,"title","body","data");
        NativeRetainedAttempt.keys(data,"kind","notification_type","notification_key","service_date","loan_id","event","scheduled_time",
            "scheduled_at","valid_until","coverer_slot_id","projection_id","document_identity","receipt_employee_id","receipt_credential_id",
            "receipt_device_id","receipt_assignment_epoch","route");
        if(!"employee_lunch_coverage".equals(nativePayload.get("kind"))||!"employee_lunch_coverage".equals(data.get("kind"))
            ||!"lunch_coverage".equals(data.get("notification_type"))||!target.get("lunchDocumentIdentity").equals(data.get("document_identity")))throw invalid();
        equalNative(data,nativePayload,"kind","notification_type","notification_key","service_date","loan_id","event","scheduled_time","scheduled_at",
            "valid_until","coverer_slot_id","projection_id","document_identity","receipt_employee_id","receipt_credential_id","receipt_device_id",
            "receipt_assignment_epoch","route");
        String title=text(notification.get("title"),"Memphis Zoo"),body=text(notification.get("body"),"Please check your schedule.");
        if(!title.equals(nativePayload.get("title"))||!body.equals(text(nativePayload.get("body"),"Please check your schedule.")))throw invalid();
        return normal(effect.getString("notification_key"),"lunch_coverage","Lunch coverage",title,body,scheduleUrl(device,null),speaker,body);
    }
    static JSONObject location(JSONObject effect,JSONObject target,NativeProviderPayload nativePayload,String speaker,String device)throws Exception {
        JSONObject data=effect.getJSONObject("data");
        NativeRetainedAttempt.keys(data,"kind","notification_type","notification_key","service_date","device_id","employee_id","employee_name",
            "projection_id","publication_id","schedule_authority_revision","location_id","location_code","location_name","group_code","group_name",
            "form_type","status_code","receipt_employee_id","receipt_credential_id","receipt_device_id","receipt_assignment_epoch");
        if(!"employee_location_status".equals(data.get("kind"))||!"employee_location_status".equals(nativePayload.get("kind"))
            ||!"location_status".equals(data.get("notification_type"))||!device.equals(data.get("device_id"))
            ||!target.get("employeeId").equals(data.get("employee_id"))||!target.get("publicationId").equals(data.get("publication_id"))
            ||!positiveText(target.get("authorityRevision")).equals(data.get("schedule_authority_revision")))throw invalid();
        equalNative(data,nativePayload,"kind","notification_type","notification_key","service_date","projection_id","publication_id","location_id",
            "location_code","location_name","group_code","group_name","form_type","status_code","receipt_employee_id","receipt_credential_id",
            "receipt_device_id","receipt_assignment_epoch");
        String status=text(data.get("status_code"),"").toLowerCase(java.util.Locale.ROOT);
        if(!java.util.Set.of("due_soon","overdue").contains(status))throw invalid();
        String location=text(data.get("location_name"),text(data.opt("group_name"),"Assigned location")),
            group=text(data.opt("group_name"),""),name=speaker.isEmpty()?text(data.opt("employee_name"),""):speaker;
        boolean overdue="overdue".equals(status);String title=location+(overdue?" is overdue":" is due soon");
        if(!title.equals(nativePayload.get("title")))throw invalid();
        String normalBody=location+(!group.isEmpty()&&!group.equals(location)?" on "+group:"")+" in your current areas "
            +(overdue?"needs attention now.":"is getting close to its next cleaning time.");
        String first=name.isEmpty()?"":name.split(" ",2)[0],lead=first.isEmpty()?"":"Hey "+first+", ";
        String normalSpeech=lead+location+(overdue?" is overdue and needs attention now.":" is due soon. Please check it soon.");
        // No equality assertion against original native body/speech: that lane
        // legitimately says "on your assigned route" and is separately digest-
        // bound by the actual native job + backend immutable binding metadata.
        return normal(effect.getString("notification_key"),"location_status",overdue?"Assigned location overdue":"Assigned location due soon",
            title,normalBody,scheduleUrl(device,text(data.get("location_code"),"")),name,normalSpeech);
    }
    private static JSONObject normal(String key,String type,String kicker,String title,String body,String url,String speaker,String speech)throws Exception {
        return new JSONObject().put("notification_key",key).put("notification_type",type).put("kicker",kicker).put("title",title).put("body",body)
            .put("open_label","Open schedule").put("dismiss_label","Dismiss").put("open_url",url).put("speech_text",speech)
            .put("speaker_name",speaker).put("required_audio",true);
    }
    private static void equalNative(JSONObject data,NativeProviderPayload nativePayload,String... fields)throws Exception {
        for(String field:fields)if(!(data.get(field) instanceof String)||!data.get(field).equals(nativePayload.get(field)))throw invalid();
    }
    private static String positiveText(Object value)throws VaultFailure {
        if(!(value instanceof Integer||value instanceof Long)||((Number)value).longValue()<1||((Number)value).longValue()>9007199254740991L)throw invalid();
        return Long.toString(((Number)value).longValue());
    }
    private static String text(Object value,String fallback)throws VaultFailure {
        if(value==null||value==JSONObject.NULL)return fallback;
        if(!(value instanceof String))throw invalid();
        String result=((String)value).replaceAll("[\\s\\p{Z}\\uFEFF]+"," ").trim();return result.isEmpty()?fallback:result;
    }
    private static String scheduleUrl(String device,String location)throws java.io.UnsupportedEncodingException{
        String url="https://localhost/employee-schedule.html?hub=employee&device="+URLEncoder.encode(device,StandardCharsets.UTF_8.name());
        return location==null||location.isEmpty()?url:url+"&highlight="+URLEncoder.encode(location,StandardCharsets.UTF_8.name());
    }
    private static void requireDigest(String value)throws VaultFailure {if(value==null||!value.matches("[a-f0-9]{64}"))throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure("custodial_recurring_original_job_semantics_unavailable");}
}
