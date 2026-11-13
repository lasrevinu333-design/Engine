package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Separate v2 original-job semantic DATA, never an owner or replacement
 * for protected Current/clock/profile, actual retained SDK release or permit. Engine retains actual17/18a/idle/short-CAS lifetime fences.
 * The immutable acquisition identity is read from the latest native HTTP body;
 * browser-copied metadata alone cannot produce this result. */
final class NativeRecurringOrdinaryOriginalJobSemanticPlan {
    private NativeRecurringOrdinaryOriginalJobSemanticPlan(){}
    static final class Observation {
        final String principalIdentity,serviceDate,intentId,targetDigest,planSha256,planReadId,semanticDigest;
        final long observedAtEpochMicros,validUntilEpochMicros;
        final boolean nativeAudioAbsenceStillRequired=true;
        private Observation(NativeRecurringOrdinaryRenderData.Observation browser,JSONObject plan,String wire)throws Exception {
            principalIdentity=browser.principalIdentity;serviceDate=browser.serviceDate;intentId=browser.intentId;
            targetDigest=browser.targetDigest;planSha256=NativeProviderPrincipal.hash(wire);
            planReadId=plan.getString("plan_read_id");semanticDigest=plan.getString("semantic_digest");
            observedAtEpochMicros=micros(plan.get("observed_at"));validUntilEpochMicros=micros(plan.get("valid_until"));
        }
    }
    static Observation requireOriginal(NativeRecurringOrdinaryRenderData.Observation browser,
        NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,String nativeScopeData,
        Map<String,String> originalRows,byte[] actualLatestNativeResponse,
        NativeProviderRuntimeOwner.OrdinaryOriginalJobRead actualJobs)throws VaultFailure {
        try {
            if(browser==null||prepared==null||nativeScopeData==null||originalRows==null||actualLatestNativeResponse==null||actualJobs==null)throw invalid();
            JSONObject purpose=NativeRecurringOrdinaryPurposeJournal.requirePrepared(prepared.key,prepared.record);
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(purpose.getJSONObject("principal"));
            if(!principal.same(NativeProviderPrincipal.fromNativeJournal(object(browser.principalIdentity,16384))))throw invalid();
            JSONObject response=ProviderWireJson.object(actualLatestNativeResponse,8*1024*1024);
            if(!Boolean.TRUE.equals(response.get("ok")))throw invalid();
            JSONObject data=response.getJSONObject("data"),delivery=data.getJSONObject("recurring_delivery"),target=purpose.getJSONObject("target");
            if(!browser.intentId.equals(delivery.get("intentId"))||!browser.targetDigest.equals(delivery.get("targetDigest"))
                ||!ProviderWireJson.same(target,delivery.getJSONObject("target")))throw invalid();
            JSONObject envelope=data.getJSONObject("ordinary_notification_plan");
            NativeRetainedAttempt.keys(envelope,"schema","body","bodyJsonText","bodyDigest");
            if(!"custodial.recurring-current-notification-plan-envelope.v2".equals(envelope.get("schema")))throw invalid();
            String wire=envelope.getString("bodyJsonText");JSONObject issued=object(wire,196608);
            if(!NativeProviderPrincipal.hash(wire).equals(envelope.get("bodyDigest"))||!ProviderWireJson.same(issued,envelope.getJSONObject("body")))throw invalid();
            NativeRetainedAttempt.keys(issued,"schema","complete","receipt_eligible","scope","source","service_date","intent_id",
                "target_digest","target","rendered_digest","backend_principal_digest","plan_read_id","semantic_digest","device_pk",
                "canonical_device_id","employee_id","credential_id","assignment_epoch","observed_at","valid_until","notification_state",
                "accepted_lunch_intents","required_effects","required_audio","source_counts","delivery_bindings");
            JSONObject p=principal.json();
            if(!"custodial.recurring-current-notification-plan.v2".equals(issued.get("schema"))
                ||!Boolean.TRUE.equals(issued.get("complete"))||!Boolean.FALSE.equals(issued.get("receipt_eligible"))
                ||!"CURRENT_PRESENTATION_AND_FULL_EFFECTS_REQUIRED_BY_ACCEPTED_TARGET_NOT_FUTURE_ALARM_INVENTORY".equals(issued.get("scope"))
                ||!browser.serviceDate.equals(issued.get("service_date"))||!browser.intentId.equals(issued.get("intent_id"))
                ||!browser.targetDigest.equals(issued.get("target_digest"))||!browser.renderedDigest.equals(issued.get("rendered_digest"))
                ||!ProviderWireJson.same(target,issued.getJSONObject("target"))||!target.get("deviceId").equals(issued.get("device_pk"))
                ||!data.get("canonical_device_pk").equals(issued.get("device_pk"))||!p.get("device_id").equals(issued.get("canonical_device_id"))
                ||!p.get("employee_id").equals(issued.get("employee_id"))||!p.get("credential_id").equals(issued.get("credential_id"))
                ||!Long.toString(integer(p.get("assignment_epoch"))).equals(issued.get("assignment_epoch")))throw invalid();
            uuid(issued.get("plan_read_id"));digest(issued.get("semantic_digest"));digest(issued.get("backend_principal_digest"));
            long observed=micros(issued.get("observed_at")),until=micros(issued.get("valid_until"));if(observed>=until)throw invalid();
            JSONObject reminder=object(browser.reminder,262144),raw=reminder.getJSONObject("raw_owner_state"),plan=raw.getJSONObject("expected_plan");
            NativeRetainedAttempt.keys(plan,"schema","receipt_eligible","scope","selector","coverage","birth","acquired_at",
                "expires_on_service_date_change","availability","target","source_envelope","required_effects","required_audio",
                "retire_superseded_relevant_effects","complete","normal_derivation","delivery_bindings");
            if(!"custodial.normal-expected-notification-plan.v2".equals(plan.get("schema"))||!Boolean.FALSE.equals(plan.get("receipt_eligible"))
                ||!Boolean.TRUE.equals(plan.get("complete"))||!"COMPLETE_AUTHENTICATED_CURRENT_PLAN".equals(plan.get("coverage"))
                ||!"NORMAL_AUTHENTICATED_COMMITTED_TARGET_AND_SERVER_COMPLETE_PLAN".equals(plan.get("birth"))
                ||!"CURRENT_PRESENTATION_AND_FULL_EFFECTS_REQUIRED_BY_ACCEPTED_TARGET".equals(plan.get("scope"))
                ||!Boolean.TRUE.equals(plan.get("expires_on_service_date_change"))||!Boolean.TRUE.equals(plan.get("retire_superseded_relevant_effects"))
                ||!ProviderWireJson.same(envelope,plan.getJSONObject("source_envelope"))||!ProviderWireJson.same(target,plan.getJSONObject("target"))
                ||!ProviderWireJson.same(issued.getJSONArray("required_effects"),plan.getJSONArray("required_effects"))
                ||!ProviderWireJson.same(issued.getJSONArray("required_audio"),plan.getJSONArray("required_audio"))
                ||!ProviderWireJson.same(issued.getJSONObject("delivery_bindings"),plan.getJSONObject("delivery_bindings")))throw invalid();
            Instant.parse(plan.getString("acquired_at"));JSONObject selector=plan.getJSONObject("selector");
            NativeRetainedAttempt.keys(selector,"principal","service_date","intent_id","target_digest");
            if(!browser.principalIdentity.equals(selector.get("principal"))||!browser.serviceDate.equals(selector.get("service_date"))
                ||!browser.intentId.equals(selector.get("intent_id"))||!browser.targetDigest.equals(selector.get("target_digest")))throw invalid();
            JSONObject fence=plan.getJSONObject("availability");NativeRetainedAttempt.keys(fence,"schema","principal","serviceDate","state","stamp");
            if(!"employee-schedule-availability.v1".equals(fence.get("schema"))||!"AVAILABLE".equals(fence.get("state"))
                ||!browser.principalIdentity.equals(fence.get("principal"))||!browser.serviceDate.equals(fence.get("serviceDate"))
                ||!(fence.get("stamp") instanceof String)||fence.getString("stamp").isEmpty())throw invalid();
            String type=target.getString("targetType"),source=issued.getString("source");
            if("BLOCKED_RECURRING_AUTHORITY".equals(type)){
                if(!"AUTHENTICATED_BLOCKED_TARGET".equals(source)||issued.getJSONArray("accepted_lunch_intents").length()!=0
                    ||integer(issued.getJSONObject("source_counts").get("current_assigned_locations"))!=0)throw invalid();
            }else if(!"SCHEDULE".equals(type)||!"FULL_ACCEPTED_LUNCH_AND_EXHAUSTIVE_CURRENT_LOCATION_DERIVATION".equals(source))throw invalid();
            // Separate v2 branch: normal renderer DATA and ORIGINAL native job
            // facts have deliberately distinct text/transport provenance. No
            // ordinary playback owner or second publisher is constructed.
            if(!"SCHEDULE".equals(type)||reminder.getJSONArray("active").length()!=0)throw invalid();
            JSONObject derived=plan.getJSONObject("normal_derivation");NativeRetainedAttempt.keys(derived,"schema","producer","effects");
            if(!"custodial.normal-complete-notification-derivation.v1".equals(derived.get("schema"))
                ||!"SAME_NORMAL_LOCATION_AND_ACCEPTED_RENDERER_FORMATTERS_NOT_OBSERVED_SUBSET".equals(derived.get("producer"))
                ||derived.getJSONArray("effects").length()!=issued.getJSONArray("required_effects").length())throw invalid();
            NativeRecurringOrdinaryOriginalJobSemanticData.requireOriginal(issued,derived,raw,principal,actualJobs);
            JSONObject notificationState=issued.getJSONObject("notification_state");NativeRetainedAttempt.keys(notificationState,"notifications_silent","silent_reason","override_enabled");
            if(!(notificationState.get("notifications_silent") instanceof Boolean)||!(notificationState.get("silent_reason") instanceof String)||!(notificationState.get("override_enabled") instanceof Boolean))throw invalid();
            JSONObject counts=issued.getJSONObject("source_counts");NativeRetainedAttempt.keys(counts,"accepted_lunch_intents","current_assigned_locations");
            if(integer(counts.get("accepted_lunch_intents"))!=issued.getJSONArray("accepted_lunch_intents").length()
                ||integer(counts.get("accepted_lunch_intents"))>1024||integer(counts.get("current_assigned_locations"))>1024)throw invalid();
            JSONObject lane=raw.getJSONObject("browser_audio_lane");NativeRetainedAttempt.keys(lane,"scope","detached","sequence_pending","speech_pending",
                "browser_speech_pending","sequence_tone_pending","audio_alert_present","html_audio_present","html_audio_paused","active_oscillators","ring_timeouts");
            if(!"SAME_NORMAL_BROWSER_LANE_NOT_NATIVE_AUDIO_SETTLEMENT".equals(lane.get("scope"))||!Boolean.TRUE.equals(lane.get("html_audio_paused"))
                ||!(lane.get("html_audio_present") instanceof Boolean))throw invalid();
            for(String flag:new String[]{"detached","sequence_pending","speech_pending","browser_speech_pending","sequence_tone_pending","audio_alert_present"})
                if(!Boolean.FALSE.equals(lane.get(flag)))throw invalid();
            if(integer(lane.get("active_oscillators"))!=0||integer(lane.get("ring_timeouts"))!=0)throw invalid();
            requireNativeEmptyOrRetired(object(nativeScopeData,1024*1024),originalRows,principal,browser.serviceDate);
            return new Observation(browser,issued,wire);
        }catch(VaultFailure failure){throw failure;}catch(Exception unknown){throw new VaultFailure("custodial_recurring_ordinary_plan_unavailable",unknown);}
    }
    private static void requireNativeEmptyOrRetired(JSONObject scope,Map<String,String> rows,NativeProviderPrincipal principal,String day)throws Exception {
        if(!principal.digest.equals(scope.get("principal_sha256"))||!day.equals(scope.get("service_date"))||!Boolean.FALSE.equals(scope.get("receipt_eligible")))throw invalid();
        JSONObject visible=scope.getJSONObject("visible");NativeRetainedAttempt.keys(visible,"raw","active","native_notifications_enabled","exact_alarm_permission_current");
        if(visible.getJSONObject("raw").length()!=0||visible.getJSONObject("active").length()!=0
            ||!(visible.get("native_notifications_enabled") instanceof Boolean)||!(visible.get("exact_alarm_permission_current") instanceof Boolean))throw invalid();
        JSONArray generations=scope.getJSONArray("generations");if(generations.length()>1024)throw invalid();
        if("custodial.native-ordinary-empty-current-observation.v1".equals(scope.get("schema"))){
            NativeRetainedAttempt.keys(scope,"schema","principal_sha256","service_date","generations","visible","alarm_scope","receipt_eligible",
                "empty_current_observation","historical_alarm_inventory_proven","alarm_delivery_proven","legacy_owned_generationless_dispatch");
            if(!Boolean.TRUE.equals(scope.get("empty_current_observation"))||!Boolean.FALSE.equals(scope.get("historical_alarm_inventory_proven"))
                ||!Boolean.FALSE.equals(scope.get("alarm_delivery_proven"))||generations.length()!=0||!rows.isEmpty()
                ||!"CURRENT_OWNED_PUBLISHER_GENERATION_GUARDS_NOT_HISTORICAL_ALARM_INVENTORY".equals(scope.get("alarm_scope"))
                ||!"REFUSED_BY_CURRENT_REGISTERED_NATIVE_RUNTIME_PUBLISHER".equals(scope.get("legacy_owned_generationless_dispatch")))throw invalid();
        }else{
            NativeRetainedAttempt.keys(scope,"schema","principal_sha256","service_date","generations","visible","alarm_scope","receipt_eligible");
            if(!"custodial.native-ordinary-effect-call-data.v1".equals(scope.get("schema"))||generations.length()==0
                ||!"ORIGINAL_REGISTRATION_RETURN_AND_UNMUTATED_KNOWN_GENERATION_NOT_DELIVERY_OR_FULL_ALARM_INVENTORY".equals(scope.get("alarm_scope")))throw invalid();
            HashSet<String> used=new HashSet<>(),ids=new HashSet<>();
            for(int i=0;i<generations.length();i++){
                JSONObject generation=generations.getJSONObject(i);NativeRetainedAttempt.keys(generation,"generation","id","group","raw_sha256","target_reference","record_sha256","state","calls","original_pending_intents");
                String id=Long.toString(integer(generation.get("id"))),g=generation.getString("generation"),reference=generation.getString("target_reference");
                uuid(g);if(!ids.add(id)||!"CANCEL_CALLED".equals(generation.get("state")))throw invalid();
                String mutation=NativeRecurringTargetJournal.MUTATION_PREFIX+NativeProviderPrincipal.hash(g),record=rows.get(mutation),target=rows.get(reference);
                if(record==null||target==null||!NativeProviderPrincipal.hash(record).equals(generation.get("record_sha256")))throw invalid();
                JSONObject original=object(record,524288);
                if(!g.equals(original.get("generation"))||!"CANCEL_CALLED".equals(original.get("state"))
                    ||!principal.same(NativeProviderPrincipal.fromNativeJournal(original.getJSONObject("principal")))
                    ||!reference.equals(original.get("target_reference"))||integer(original.get("id"))!=integer(generation.get("id"))
                    ||!generation.get("group").equals(original.get("group"))
                    ||!principal.same(NativeProviderPrincipal.fromNativeJournal(object(target,524288).getJSONObject("principal"))))throw invalid();
                used.add(mutation);used.add(reference);String lastVisible=null,lastAlarm=null;
                JSONArray calls=generation.getJSONArray("calls");if(calls.length()==0||calls.length()>32)throw invalid();
                for(int j=0;j<calls.length();j++){
                    JSONObject call=calls.getJSONObject(j);NativeRetainedAttempt.keys(call,"operation","returned","notification","alarm_type","trigger","pending_intent_flags","pending_intent_creator_uid","alarm_delivery_proven");if(!Boolean.TRUE.equals(call.get("returned"))||!Boolean.FALSE.equals(call.get("alarm_delivery_proven")))throw invalid();
                    String operation=call.getString("operation");if(!java.util.Set.of("NOTIFY","ALARM_SET","ALARM_SET_IDLE","ALARM_EXACT","ALARM_EXACT_IDLE","CANCEL_NOTIFICATION","CANCEL_ALARM").contains(operation))throw invalid();
                    if("NOTIFY".equals(operation)||"CANCEL_NOTIFICATION".equals(operation))lastVisible=operation;
                    if(operation.startsWith("ALARM_")||"CANCEL_ALARM".equals(operation))lastAlarm=operation;
                }
                if(lastVisible!=null&&!"CANCEL_NOTIFICATION".equals(lastVisible)||lastAlarm!=null&&!"CANCEL_ALARM".equals(lastAlarm))throw invalid();
            }
            if(!used.equals(rows.keySet()))throw invalid();
        }
    }
    private static long integer(Object value)throws VaultFailure {
        if(!(value instanceof Integer||value instanceof Long))throw invalid();long n=((Number)value).longValue();if(n<0||n>9007199254740991L)throw invalid();return n;
    }
    private static long micros(Object value)throws Exception {
        if(!(value instanceof String)||!((String)value).matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{6}Z"))throw invalid();
        Instant at=Instant.parse((String)value);if(at.getNano()%1000!=0||!new java.time.format.DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(at).equals(value))throw invalid();long n=Math.addExact(Math.multiplyExact(at.getEpochSecond(),1000000L),at.getNano()/1000);if(n<=0||n>9007199254740991L)throw invalid();return n;
    }
    private static void uuid(Object v)throws VaultFailure {if(!(v instanceof String)||!((String)v).matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"))throw invalid();}
    private static void digest(Object v)throws VaultFailure {if(!(v instanceof String)||!((String)v).matches("[a-f0-9]{64}"))throw invalid();}
    private static JSONObject object(String raw,int bound)throws Exception{return ProviderWireJson.object(raw.getBytes(StandardCharsets.UTF_8),bound);}
    private static VaultFailure invalid(){return new VaultFailure("custodial_recurring_ordinary_plan_unavailable");}
}
