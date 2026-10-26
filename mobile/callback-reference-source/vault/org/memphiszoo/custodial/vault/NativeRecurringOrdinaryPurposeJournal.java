package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Ordinary delivery PREPARED expectation only, born at the actual native
 * authenticated target site. Not a private-custody Current or applied receipt. */
final class NativeRecurringOrdinaryPurposeJournal {
    static final String PREFIX="native_recurring_purpose_sha256:";
    private static final String SCHEMA="custodial.native-recurring-ordinary-purpose.v1";
    interface LatestOwner { void requireLatest()throws VaultFailure; }
    interface Store {
        String retainOrdinaryRecurringPrepared(String key,NativeRecurringTargetJournal.RetainedTargetData target,
            String candidate,LatestOwner owner)throws VaultFailure;
        void requireOrdinaryRecurringPreparedCurrent(NativeRecurringTargetJournal.RetainedTargetData target,
            PreparedData prepared,LatestOwner owner)throws VaultFailure;
    }
    static final class PreparedData {
        final String key,record;
        private PreparedData(String key,String record){this.key=key;this.record=record;}
    }
    private final Store store;
    NativeRecurringOrdinaryPurposeJournal(Store store){this.store=java.util.Objects.requireNonNull(store);}
    /** Pure DATA preflight only. Unsupported ordinary target payloads keep
     * their complete original Engine callback topology and HTTP behavior. */
    static boolean hasSupportedOriginalShape(AuthorizedResponse actual){
        if(actual==null||actual.status!=200)return false;byte[] body=actual.body.clone();
        try{
            JSONObject envelope=ProviderWireJson.object(body,8*1024*1024);
            if(!Boolean.TRUE.equals(envelope.opt("ok")))return false;
            JSONObject data=envelope.getJSONObject("data"),delivery=data.getJSONObject("recurring_delivery");
            if("RECURRING_TERMINAL".equals(data.opt("schedule_delivery_mode")))return true;
            if(!"RECURRING_SCHEDULE".equals(data.opt("schedule_delivery_mode")))return false;
            JSONObject shape=ProviderWireJson.object(delivery.getString("viewJsonText").getBytes(StandardCharsets.UTF_8),4*1024*1024);
            NativeRetainedAttempt.keys(shape,"schema","service_date","employee_id","employee_name","publication_id","projection_id","projection_status","full_day","shift","raw_items");
            return "static-weekly.recurring-render-view.v1".equals(shape.opt("schema"));
        }catch(Exception unsupported){return false;}finally{java.util.Arrays.fill(body,(byte)0);}
    }
    PreparedData prepare(NativeRecurringTargetJournal.RetainedTargetData retained,AuthorizedResponse actual,
        String latestWireSha,LatestOwner owner)throws VaultFailure {
        if(retained==null||actual==null||actual.status!=200||owner==null)return null;
        owner.requireLatest();byte[] body=actual.body.clone();
        try{
            if(!NativeRetainedAttempt.hash(body).equals(latestWireSha))throw invalid();
            JSONObject row=ProviderWireJson.object(retained.record.getBytes(StandardCharsets.UTF_8),524288);
            if(!"custodial.native-recurring-authenticated-target-data.v2".equals(row.get("schema"))
                ||!Boolean.FALSE.equals(row.get("receipt_eligible")))return null;
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
            if(!principal.digest.equals(retained.principalSha256))throw invalid();
            JSONObject envelope=ProviderWireJson.object(body,8*1024*1024);
            if(!Boolean.TRUE.equals(envelope.get("ok")))return null;
            JSONObject data=envelope.getJSONObject("data"),delivery=data.getJSONObject("recurring_delivery"),target=row.getJSONObject("target");
            // Device label and database UUID are DISTINCT actual contract fields.
            // The genuine target factory already binds each to this envelope;
            // retain the explicit UUID rather than inventing one from KIOSK.
            String canonicalPk=data.getString("canonical_device_pk");VaultValidation.operationId(canonicalPk);
            if(!canonicalPk.equals(target.get("deviceId"))||!principal.json().get("device_id").equals(data.get("canonical_device_id")))throw invalid();
            if(!row.get("intent_id").equals(delivery.get("intentId"))||!row.get("target_digest").equals(delivery.get("targetDigest"))
                ||!ProviderWireJson.same(target,delivery.getJSONObject("target")))throw invalid();
            boolean blocked="BLOCKED_RECURRING_AUTHORITY".equals(target.get("targetType"));
            if(!(blocked?"RECURRING_TERMINAL":"RECURRING_SCHEDULE").equals(data.get("schedule_delivery_mode")))throw invalid();
            String rendered;
            if(blocked){
                if(!Boolean.FALSE.equals(delivery.get("replacementCoverageReady"))||!delivery.isNull("view")||!delivery.isNull("viewJsonText")
                    ||!row.isNull("original_view"))throw invalid();
                rendered=row.getString("target_digest");
            }else{
                if(!"SCHEDULE".equals(target.get("targetType")))throw invalid();
                String view=delivery.getString("viewJsonText");rendered=target.getString("viewDigest");
                if(!rendered.equals(delivery.get("viewDigest"))||!rendered.equals(NativeProviderPrincipal.hash(view))
                    ||!rendered.equals(row.getJSONObject("original_view").get("sha256")))throw invalid();
                JSONObject shape=ProviderWireJson.object(view.getBytes(StandardCharsets.UTF_8),4*1024*1024);
                NativeRetainedAttempt.keys(shape,"schema","service_date","employee_id","employee_name","publication_id","projection_id","projection_status","full_day","shift","raw_items");
                if(!"static-weekly.recurring-render-view.v1".equals(shape.get("schema"))
                    ||!target.get("serviceDate").equals(shape.get("service_date"))||!target.get("employeeId").equals(shape.get("employee_id"))
                    ||!target.get("publicationId").equals(shape.get("publication_id"))||!target.get("projectionId").equals(shape.get("projection_id"))
                    ||!"current".equals(shape.get("projection_status"))||!Boolean.TRUE.equals(shape.get("full_day"))
                    ||!(shape.get("employee_name") instanceof String)||!(shape.get("raw_items") instanceof org.json.JSONArray)
                    ||!(shape.isNull("shift")||shape.get("shift") instanceof JSONObject))return null;
            }
            String key=PREFIX+NativeProviderPrincipal.hash(principal.digest+":"+row.getString("intent_id"));
            JSONObject prepared=new JSONObject().put("schema",SCHEMA).put("state","PREPARED").put("receipt_eligible",false)
                .put("principal",principal.json()).put("canonical_device_pk",canonicalPk).put("intent_id",row.get("intent_id")).put("target",target)
                .put("target_text",row.get("target_text")).put("target_digest",row.get("target_digest"))
                .put("rendered_digest",rendered).put("target_record_key",retained.key)
                .put("target_record_sha256",NativeProviderPrincipal.hash(retained.record))
                .put("first_target_native_response_sha256",row.get("native_authorized_response_sha256"))
                .put("prepared_native_response_sha256",latestWireSha);
            String candidate=prepared.toString();requirePrepared(key,candidate);owner.requireLatest();
            if(!java.util.Arrays.equals(body,actual.body))throw invalid();
            String saved=store.retainOrdinaryRecurringPrepared(key,retained,candidate,owner);
            if(saved==null)return null;
            requireSamePrepared(key,saved,candidate);owner.requireLatest();
            if(!java.util.Arrays.equals(body,actual.body))throw invalid();
            return new PreparedData(key,saved);
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
        finally{java.util.Arrays.fill(body,(byte)0);}
    }
    static JSONObject requirePrepared(String key,String raw)throws VaultFailure {
        try{
            JSONObject row=ProviderWireJson.object(raw.getBytes(StandardCharsets.UTF_8),16384);
            NativeRetainedAttempt.keys(row,"schema","state","receipt_eligible","principal","canonical_device_pk","intent_id","target","target_text","target_digest",
                "rendered_digest","target_record_key","target_record_sha256","first_target_native_response_sha256","prepared_native_response_sha256");
            if(!SCHEMA.equals(row.get("schema"))||!"PREPARED".equals(row.get("state"))||!Boolean.FALSE.equals(row.get("receipt_eligible")))throw invalid();
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"));
            String intent=row.getString("intent_id");VaultValidation.operationId(intent);
            if(!key.equals(PREFIX+NativeProviderPrincipal.hash(principal.digest+":"+intent))
                ||!row.get("target_record_key").equals(NativeRecurringTargetJournal.TARGET_PREFIX+NativeProviderPrincipal.hash(principal.digest+":"+intent)))throw invalid();
            for(String field:new String[]{"target_digest","rendered_digest","target_record_sha256","first_target_native_response_sha256","prepared_native_response_sha256"})
                if(!row.getString(field).matches("[a-f0-9]{64}"))throw invalid();
            String text=row.getString("target_text");
            if(!NativeProviderPrincipal.hash(text).equals(row.get("target_digest"))
                ||!ProviderWireJson.same(ProviderWireJson.object(text.getBytes(StandardCharsets.UTF_8),8192),row.getJSONObject("target")))throw invalid();
            JSONObject t=row.getJSONObject("target"),p=principal.json();String type=t.getString("targetType");
            String canonicalPk=row.getString("canonical_device_pk");VaultValidation.operationId(canonicalPk);
            Object epoch=t.get("assignmentEpoch");
            if(!(epoch instanceof Integer||epoch instanceof Long)||((Number)epoch).longValue()<=0
                ||((Number)epoch).longValue()>9007199254740991L
                ||((Number)epoch).longValue()!=((Number)p.get("assignment_epoch")).longValue()
                ||!canonicalPk.equals(t.get("deviceId"))||!p.get("employee_id").equals(t.get("employeeId"))
                ||!p.get("credential_id").equals(t.get("credentialId")))throw invalid();
            if(!row.get("rendered_digest").equals("SCHEDULE".equals(type)?t.get("viewDigest"):
                "BLOCKED_RECURRING_AUTHORITY".equals(type)?row.get("target_digest"):null))throw invalid();
            return row;
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    static void requireSamePrepared(String key,String existing,String candidate)throws VaultFailure {
        try{
            JSONObject first=requirePrepared(key,existing),latest=requirePrepared(key,candidate);
            // Same immutable semantic target, two distinct authentic wire
            // provenances. Never overwrite the first purpose's preparation SHA.
            first.remove("prepared_native_response_sha256");latest.remove("prepared_native_response_sha256");
            if(!ProviderWireJson.same(first,latest))throw invalid();
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure(NativeRecurringTargetJournal.FAILURE,malformed);}
    }
    static VaultFailure invalid(){return new VaultFailure("custodial_recurring_ordinary_purpose_pending");}
}
