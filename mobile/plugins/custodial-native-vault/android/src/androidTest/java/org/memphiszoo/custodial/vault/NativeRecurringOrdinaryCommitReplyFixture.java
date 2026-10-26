package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Map;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Synthetic HTTPS DATA/response recorder only. The actual default native
 * credential/request-id checks run before this opt-in fixture. It cannot mint
 * Source frames, holds, native permits, receipt owners or SQL acceptance. */
final class NativeRecurringOrdinaryCommitReplyFixture {
    enum Mode { ORIGINAL_LOST_RESPONSE, STALE_TARGET_PLAN, MISMATCHED_WIRE, RETIRE_AFTER_ATTEMPT, V2_NONEMPTY_MISSING_ORIGINAL }
    final Mode mode;
    final String receiptId=UUID.randomUUID().toString();
    private final Map<String,JSONObject> issuedByRead=new java.util.LinkedHashMap<>();
    volatile int posts,outcomes,issues;
    private byte[] lastResponse,originalPost;
    private JSONObject actualDelivery,issuedPlan,originalIssuedPlan,originalDelivery;
    private String originalHeader;
    NativeRecurringOrdinaryCommitReplyFixture(Mode mode){this.mode=mode;}
    synchronized byte[] issue(byte[] original)throws Exception {
        JSONObject root=ProviderWireJson.object(original,8*1024*1024),data=root.getJSONObject("data");
        JSONObject delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
        actualDelivery=new JSONObject(delivery.toString());issues++;
        if(issues>32)throw new AssertionError("Bounded synthetic issued-read table full");
        String planReadId=UUID.randomUUID().toString();
        var formatter=new DateTimeFormatterBuilder().appendInstant(6).toFormatter();Instant now=Instant.now();
        JSONObject plan=new JSONObject().put("schema","custodial.recurring-current-notification-plan.v1")
            .put("complete",true).put("receipt_eligible",false)
            .put("scope","CURRENT_PRESENTATION_AND_FULL_EFFECTS_REQUIRED_BY_ACCEPTED_TARGET_NOT_FUTURE_ALARM_INVENTORY")
            .put("source","FULL_ACCEPTED_LUNCH_AND_EXHAUSTIVE_CURRENT_LOCATION_DERIVATION")
            .put("service_date",target.get("serviceDate")).put("intent_id",delivery.get("intentId"))
            .put("target_digest",delivery.get("targetDigest")).put("target",new JSONObject(target.toString()))
            .put("rendered_digest",target.get("viewDigest")).put("backend_principal_digest","1".repeat(64))
            .put("plan_read_id",planReadId).put("semantic_digest","2".repeat(64))
            .put("device_pk",data.get("canonical_device_pk")).put("canonical_device_id",data.get("canonical_device_id"))
            .put("employee_id",data.get("employee_id")).put("credential_id",data.get("credential_id"))
            .put("assignment_epoch",String.valueOf(data.get("assignment_epoch")))
            .put("observed_at",formatter.format(now)).put("valid_until",formatter.format(now.plusSeconds(120)))
            .put("notification_state",new JSONObject().put("notifications_silent",true)
                .put("silent_reason","EXPLICIT_SYNTHETIC_CURRENT_EMPTY_REQUIRED_PLAN").put("override_enabled",false))
            .put("accepted_lunch_intents",new JSONArray()).put("required_effects",new JSONArray()).put("required_audio",new JSONArray())
            .put("source_counts",new JSONObject().put("accepted_lunch_intents",0).put("current_assigned_locations",0));
        if(mode==Mode.V2_NONEMPTY_MISSING_ORIGINAL){
            String notificationKey="location:normal:due";
            JSONObject detail=new JSONObject().put("kind","employee_location_status").put("notification_type","location_status")
                .put("notification_key",notificationKey).put("service_date",target.get("serviceDate"))
                .put("receipt_employee_id",data.get("employee_id")).put("receipt_credential_id",data.get("credential_id"))
                .put("receipt_device_id",data.get("canonical_device_id")).put("receipt_assignment_epoch",String.valueOf(data.get("assignment_epoch")))
                .put("location_id","77777777-7777-4777-8777-777777777777").put("location_name","Synthetic accepted location")
                .put("status_code","due_soon");
            // Explicit SYNTHETIC requirements metadata only. There is no actual
            // native reservation/Current/release fact behind these UUIDs.
            JSONObject binding=new JSONObject().put("notification_key",notificationKey)
                .put("receipt_job_id",UUID.randomUUID().toString()).put("generation_id",UUID.randomUUID().toString())
                .put("registration_id",UUID.randomUUID().toString()).put("principal_digest","3".repeat(64))
                .put("token_digest","4".repeat(64)).put("reservation_at",formatter.format(now.minusSeconds(1)))
                .put("valid_until",formatter.format(now.plusSeconds(120))).put("content_sha256","5".repeat(64))
                .put("native_kind","employee_location_status").put("audio_origin","ORIGINAL_NATIVE_JOB")
                .put("speech_sha256",NativeProviderPrincipal.hash("Synthetic ORIGINAL native job wording, independently retained."));
            plan.put("schema","custodial.recurring-current-notification-plan.v2")
                .put("notification_state",new JSONObject().put("notifications_silent",false).put("silent_reason","on_shift").put("override_enabled",false))
                .put("required_effects",new JSONArray().put(new JSONObject().put("origin","EXHAUSTIVE_NORMAL_CURRENT_LOCATION_CYCLES")
                    .put("notification_key",notificationKey).put("required_audio",true).put("data",detail)))
                .put("required_audio",new JSONArray().put(notificationKey))
                .put("source_counts",new JSONObject().put("accepted_lunch_intents",0).put("current_assigned_locations",1))
                .put("delivery_bindings",new JSONObject().put("schema","custodial.recurring-original-native-delivery-bindings.v1")
                    .put("state","ORIGINAL_NATIVE_RESERVATIONS").put("entries",new JSONArray().put(binding)));
        }
        if(mode==Mode.STALE_TARGET_PLAN){
            JSONObject oldTarget=new JSONObject(target.toString()).put("operationId",UUID.randomUUID().toString());
            plan.put("target",oldTarget).put("target_digest",NativeProviderPrincipal.hash(jsonb(oldTarget)))
                .put("intent_id",UUID.randomUUID().toString());
        }
        issuedPlan=new JSONObject(plan.toString());
        if(issuedByRead.put(planReadId,new JSONObject(plan.toString()))!=null)throw new AssertionError("Read UUID reused");
        String wire=plan.toString();
        data.put("ordinary_notification_plan",new JSONObject()
            .put("schema",mode==Mode.V2_NONEMPTY_MISSING_ORIGINAL?"custodial.recurring-current-notification-plan-envelope.v2":"custodial.recurring-current-notification-plan-envelope.v1")
            .put("body",new JSONObject(wire)).put("bodyJsonText",wire)
            .put("bodyDigest",mode==Mode.MISMATCHED_WIRE?"0".repeat(64):NativeProviderPrincipal.hash(wire)));
        return root.toString().getBytes(StandardCharsets.UTF_8);
    }
    synchronized int exchange(String method,String query,Map<String,String> headers,byte[] body)throws Exception {
        if(actualDelivery==null)throw new AssertionError("No actual original GET precedes transport");
        if("POST".equals(method)){
            posts++; // Observe attempted transport even when its mode forbids it.
            if(mode!=Mode.ORIGINAL_LOST_RESPONSE)throw new AssertionError("Refused flow reached POST");
            if(posts!=1||query!=null)throw new AssertionError("Original POST duplicated or retargeted");
            JSONObject six=ProviderWireJson.object(body,16384);NativeRetainedAttempt.keys(six,
                "intent_id","target_type","authority_revision","target_digest","rendered_digest","applied_at");
            NativeRecurringOrdinaryDeliveryWire.original(body);
            JSONObject target=actualDelivery.getJSONObject("target");
            if(!actualDelivery.get("intentId").equals(six.get("intent_id"))
                ||!actualDelivery.get("targetDigest").equals(six.get("target_digest"))
                ||!target.get("targetType").equals(six.get("target_type"))
                ||((Number)target.get("authorityRevision")).longValue()!=((Number)six.get("authority_revision")).longValue()
                ||!target.get("viewDigest").equals(six.get("rendered_digest")))throw new AssertionError("Original six fields changed");
            originalHeader=headers.get("x-custodial-plan-read-id");
            JSONObject originalPlan=issuedByRead.get(originalHeader);
            if(originalPlan==null||!originalPlan.get("intent_id").equals(six.get("intent_id"))
                ||!originalPlan.get("target_digest").equals(six.get("target_digest"))
                ||!originalPlan.get("rendered_digest").equals(six.get("rendered_digest"))
                ||!issuedPlan.get("plan_read_id").equals(originalHeader))throw new AssertionError("Fixed actual latest issued read header missing or changed");
            originalIssuedPlan=new JSONObject(originalPlan.toString());originalDelivery=new JSONObject(actualDelivery.toString());
            originalPost=body.clone();
            // The server recorder has the original body, but this exchange
            // provides no successful outcome. Native code must never resend it.
            lastResponse="{\"ok\":false,\"error\":\"synthetic_original_response_unavailable\"}".getBytes(StandardCharsets.UTF_8);
            return 503;
        }
        if(!"GET".equals(method)||body.length!=0||query==null)throw new AssertionError("Only fixed original outcome GET allowed");
        JSONObject lookupOriginal=originalDelivery==null?actualDelivery:originalDelivery;
        JSONObject target=lookupOriginal.getJSONObject("target");
        String expected="intent_id="+lookupOriginal.getString("intentId")+"&target_type="+target.getString("targetType");
        if(!expected.equals(query))throw new AssertionError("Outcome lookup changed original intent or inferred winner");
        outcomes++;boolean recorded=mode==Mode.ORIGINAL_LOST_RESPONSE&&outcomes>=2;
        JSONObject data=new JSONObject().put("schema",NativeRecurringOrdinaryDeliveryWire.SCHEMA)
            .put("intentId",lookupOriginal.get("intentId")).put("targetType",target.get("targetType"))
            .put("authorityRevision",target.get("authorityRevision")).put("targetDigest",lookupOriginal.get("targetDigest"))
            .put("renderedDigest",target.get("viewDigest")).put("status",recorded?"RECEIPT_RECORDED":"NO_RECORDED_RECEIPT")
            .put("receiptId",recorded?receiptId:JSONObject.NULL)
            .put("appliedAt",recorded?ProviderWireJson.object(originalPost,16384).get("applied_at"):JSONObject.NULL)
            .put("receivedAt",recorded?new DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(Instant.now()):JSONObject.NULL)
            .put("retryAuthorized",false).put("currentAuthorityNotInferred",true);
        lastResponse=new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8);return 200;
    }
    synchronized byte[] response(){return lastResponse.clone();}
    synchronized byte[] originalPost(){if(originalPost==null)throw new AssertionError("No original POST captured");return originalPost.clone();}
    synchronized String originalHeader(){return originalHeader;}
    synchronized JSONObject latestDelivery()throws Exception{return new JSONObject(actualDelivery.toString());}
    synchronized JSONObject latestIssuedPlan()throws Exception{return new JSONObject(issuedPlan.toString());}
    synchronized JSONObject originalIssuedPlan()throws Exception{if(originalIssuedPlan==null)throw new AssertionError("No original POST plan");return new JSONObject(originalIssuedPlan.toString());}
    private static String jsonb(JSONObject value)throws Exception {
        var keys=new java.util.ArrayList<String>();value.keys().forEachRemaining(keys::add);
        keys.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
        StringBuilder out=new StringBuilder("{");for(String key:keys){if(out.length()>1)out.append(", ");Object v=value.get(key);
            out.append(JSONObject.quote(key)).append(": ").append(v instanceof String?JSONObject.quote((String)v):v.toString());}
        return out.append('}').toString();
    }
}
