package org.memphiszoo.custodial.vault;

import org.json.JSONArray;
import org.json.JSONObject;

/** Passive bounded ordinary target/render/effect DATA. Only an Engine owner
 * joined to Source-born opaque frames may consume this helper. This type or
 * its JSON never proves OS settlement or permits a receipt. */
final class NativeRecurringOrdinaryRenderData {
    private NativeRecurringOrdinaryRenderData(){}
    static final class Observation {
        final String principalIdentity,serviceDate,intentId,targetDigest,renderedDigest;
        final String presenter,scheduler,reminder,failedCallbackTerminals,originalSource;
        private Observation(String principal,String day,String intent,String digest,String rendered,JSONObject doc,JSONArray failures)throws Exception {
            principalIdentity=principal;serviceDate=day;intentId=intent;targetDigest=digest;renderedDigest=rendered;failedCallbackTerminals=failures.toString();
            originalSource=doc.getJSONObject("employee").getJSONObject("original_typed_render").getJSONObject("original_source").toString();
            presenter=doc.getJSONObject("presenter").toString();scheduler=doc.getJSONObject("scheduler").toString();reminder=doc.getJSONObject("reminder").toString();
        }
    }
    static Observation requireOriginal(byte[] first,byte[] last,byte[] nativeResponse,String retainedTarget,
        NativeRecurringOrdinaryPurposeJournal.PreparedData prepared)throws VaultFailure {
        try {
            JSONObject a=frame(first),b=frame(last);
            if(integer(a.get("writer_epoch"))!=integer(b.get("writer_epoch"))
                ||!ProviderWireJson.same(a.getJSONObject("document_data"),b.getJSONObject("document_data"))
                ||!ProviderWireJson.same(a.getJSONArray("failed_callback_terminals"),b.getJSONArray("failed_callback_terminals")))throw invalid();
            JSONObject document=a.getJSONObject("document_data");
            JSONObject row=ProviderWireJson.object(retainedTarget.getBytes(java.nio.charset.StandardCharsets.UTF_8),524288);
            if(!"custodial.native-recurring-authenticated-target-data.v2".equals(row.get("schema"))
                ||!Boolean.FALSE.equals(row.get("receipt_eligible")))throw invalid();
            // First retained wire, first PREPARED wire and latest actual wire
            // remain distinct. Compare the immutable target/view semantics.
            JSONObject response=ProviderWireJson.object(nativeResponse,8*1024*1024);
            if(!Boolean.TRUE.equals(response.get("ok")))throw invalid();
            JSONObject data=response.getJSONObject("data"),delivery=data.getJSONObject("recurring_delivery");
            JSONObject target=row.getJSONObject("target");
            JSONObject purpose=NativeRecurringOrdinaryPurposeJournal.requirePrepared(prepared.key,prepared.record);
            if(!purpose.get("target_record_sha256").equals(NativeProviderPrincipal.hash(retainedTarget))
                ||!ProviderWireJson.same(purpose.getJSONObject("target"),target)
                ||!purpose.get("first_target_native_response_sha256").equals(row.get("native_authorized_response_sha256")))throw invalid();
            if(!row.get("intent_id").equals(delivery.get("intentId"))
                ||!row.get("target_digest").equals(delivery.get("targetDigest"))
                ||!ProviderWireJson.same(target,delivery.getJSONObject("target")))throw invalid();
            if(!java.util.Set.of("SCHEDULE","BLOCKED_RECURRING_AUTHORITY").contains(target.get("targetType")))throw invalid();
            boolean blocked="BLOCKED_RECURRING_AUTHORITY".equals(target.get("targetType"));
            if(!(blocked?"RECURRING_TERMINAL":"RECURRING_SCHEDULE").equals(data.get("schedule_delivery_mode")))throw invalid();
            JSONObject expected=new JSONObject(data.toString());
            if(blocked){
                if(!Boolean.FALSE.equals(delivery.get("replacementCoverageReady"))
                    ||!delivery.isNull("view")||!delivery.isNull("viewJsonText"))throw invalid();
                expected.put("projection_status","blocked_recurring_authority").put("raw_items",new JSONArray())
                    .put("current_items",new JSONArray()).put("full_day",true).put("shift",JSONObject.NULL);
            }else{
                String viewText=delivery.getString("viewJsonText");
                if(!target.get("viewDigest").equals(delivery.get("viewDigest"))
                    ||!NativeProviderPrincipal.hash(viewText).equals(target.get("viewDigest")))throw invalid();
                JSONObject view=ProviderWireJson.object(viewText.getBytes(java.nio.charset.StandardCharsets.UTF_8),4*1024*1024);
                NativeRetainedAttempt.keys(view,"schema","service_date","employee_id","employee_name","publication_id",
                    "projection_id","projection_status","full_day","shift","raw_items");
                if(!"static-weekly.recurring-render-view.v1".equals(view.get("schema"))
                    ||!target.get("serviceDate").equals(view.get("service_date"))
                    ||!target.get("employeeId").equals(view.get("employee_id"))
                    ||!target.get("publicationId").equals(view.get("publication_id"))
                    ||!target.get("projectionId").equals(view.get("projection_id"))
                    ||!"current".equals(view.get("projection_status"))||!Boolean.TRUE.equals(view.get("full_day"))
                    ||!(view.get("employee_name") instanceof String)||!(view.get("raw_items") instanceof JSONArray)
                    ||!(view.isNull("shift")||view.get("shift") instanceof JSONObject))throw invalid();
                for(var it=view.keys();it.hasNext();){String key=it.next();expected.put(key,view.get(key));}
            }
            JSONObject employee=document.getJSONObject("employee");
            NativeRetainedAttempt.keys(employee,"schema","receipt_eligible","loading","loadVersion","shownPrincipal","queued",
                "paused","securityBlocked","securityGeneration","lastView","original_typed_render","elements");
            for(String key:new String[]{"loading","queued","paused","securityBlocked"})if(!Boolean.FALSE.equals(employee.get(key)))throw invalid();
            JSONObject render=employee.getJSONObject("original_typed_render");
            NativeRetainedAttempt.keys(render,"schema","receipt_eligible","scope","principal_identity","service_date","availability",
                "security_generation","load_version","offline","cache_warning","original_source");
            if(!"custodial.native-recurring-original-render-data.v1".equals(render.get("schema"))
                ||!Boolean.FALSE.equals(render.get("receipt_eligible"))
                ||!"ORIGINAL_TYPED_SOURCE_AT_RENDER_COMMIT_NOT_SETTLEMENT".equals(render.get("scope"))
                ||!Boolean.FALSE.equals(render.get("offline"))||!Boolean.FALSE.equals(render.get("cache_warning"))
                ||integer(render.get("security_generation"))!=integer(employee.get("securityGeneration"))
                ||integer(render.get("load_version"))!=integer(employee.get("loadVersion"))
                ||!target.get("serviceDate").equals(render.get("service_date"))
                ||!render.get("principal_identity").equals(employee.get("shownPrincipal"))
                ||!ProviderWireJson.same(expected,render.getJSONObject("original_source")))throw invalid();
            String principal=render.getString("principal_identity");
            if(!NativeProviderPrincipal.fromNativeJournal(ProviderWireJson.object(principal.getBytes(java.nio.charset.StandardCharsets.UTF_8),16384))
                .same(NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"))))throw invalid();
            JSONObject fence=render.getJSONObject("availability");
            NativeRetainedAttempt.keys(fence,"schema","principal","serviceDate","state","stamp");
            if(!"employee-schedule-availability.v1".equals(fence.get("schema"))||!principal.equals(fence.get("principal"))
                ||!target.get("serviceDate").equals(fence.get("serviceDate"))||!"AVAILABLE".equals(fence.get("state"))
                ||!(fence.get("stamp") instanceof String)||fence.getString("stamp").isEmpty())throw invalid();

            supported(employee,0);
            JSONObject selector=document.getJSONObject("selector");
            NativeRetainedAttempt.keys(selector,"principal","service_date","intent_id","target_digest");
            if(!principal.equals(selector.get("principal"))||!target.get("serviceDate").equals(selector.get("service_date"))
                ||!row.get("intent_id").equals(selector.get("intent_id"))||!row.get("target_digest").equals(selector.get("target_digest")))throw invalid();
            JSONObject presenter=document.getJSONObject("presenter");
            NativeRetainedAttempt.keys(presenter,"schema","receipt_eligible","scope","selector","native_owner_required","draining","retryRequested","entries","poll_owners","unrelated");
            if(!Boolean.TRUE.equals(presenter.get("native_owner_required"))||!Boolean.FALSE.equals(presenter.get("draining"))
                ||!Boolean.FALSE.equals(presenter.get("retryRequested"))||!ProviderWireJson.same(selector,presenter.getJSONObject("selector")))throw invalid();
            JSONArray entries=presenter.getJSONArray("entries");if(entries.length()>256)throw invalid();
            java.util.HashSet<String> seen=new java.util.HashSet<>();
            for(int i=0;i<entries.length();i++){
                JSONObject entry=entries.getJSONObject(i);
                NativeRetainedAttempt.keys(entry,"map_key","scope","key","event","owner","running","rendered","receipt_recorded","visual_state","audio_state","audio_attempted","retirement_pending","retiring","last_verified_save","current_raw","opaque_fields","receipt_eligible");
                String key=entry.getString("key");JSONArray pair=(JSONArray)ProviderWireJson.parse(entry.getString("map_key").getBytes(java.nio.charset.StandardCharsets.UTF_8),16384);
                if(pair.length()!=2||!principal.equals(entry.get("scope"))||!principal.equals(pair.get(0))||!key.equals(pair.get(1))||!seen.add(key)
                    ||!Boolean.FALSE.equals(entry.get("receipt_eligible")))throw invalid();
                for(String flag:new String[]{"running","rendered","receipt_recorded","audio_attempted","retirement_pending","retiring"})
                    if(!(entry.get(flag) instanceof Boolean))throw invalid();
                if(!Boolean.FALSE.equals(entry.get("running"))||!Boolean.FALSE.equals(entry.get("retirement_pending"))||!Boolean.FALSE.equals(entry.get("retiring")))throw invalid();
                if(!entry.isNull("owner")&&!java.util.Set.of("native","browser").contains(entry.get("owner"))
                    ||!java.util.Set.of("pending","opened","dismissed","acknowledged").contains(entry.get("visual_state"))
                    ||!java.util.Set.of("unstarted","completed","incomplete").contains(entry.get("audio_state")))throw invalid();
                JSONObject event=entry.getJSONObject("event"),extra=event.getJSONObject("notification").getJSONObject("data");
                if(!key.equals(extra.get("notification_key"))||!target.get("serviceDate").equals(extra.get("service_date")))throw invalid();
                // A historical settled Promise/callback is opaque lifetime DATA,
                // not pending work or an accepted OS outcome. Preserve its label.
                JSONObject opaque=entry.getJSONObject("opaque_fields");NativeRetainedAttempt.keys(opaque,"saving","retireBrowser");
                for(String name:new String[]{"saving","retireBrowser"})if(!opaque.isNull(name)){
                    JSONObject marker=opaque.getJSONObject(name);NativeRetainedAttempt.keys(marker,"unknown_type");
                    if(!java.util.Set.of("opaque_object","function","undefined").contains(marker.get("unknown_type")))throw invalid();
                }
                JSONObject saved=entry.getJSONObject("last_verified_save");
                NativeRetainedAttempt.keys(saved,"scope","key","generation","raw","scope_kind","receipt_eligible");
                if(!principal.equals(saved.get("scope"))||!key.equals(saved.get("key"))||integer(saved.get("generation"))<1
                    ||!Boolean.FALSE.equals(saved.get("receipt_eligible"))||!"NORMAL_SAVE_RETURNED_NOT_CURRENT_NATIVE_WORK".equals(saved.get("scope_kind"))
                    ||!saved.get("raw").equals(entry.get("current_raw")))throw invalid();
                JSONObject persisted=ProviderWireJson.object(saved.getString("raw").getBytes(java.nio.charset.StandardCharsets.UTF_8),131072);
                if(!"native-notification-presentation.v2".equals(persisted.get("schema_version"))||!principal.equals(persisted.get("scope"))
                    ||!key.equals(persisted.get("key"))||!ProviderWireJson.same(event,persisted.getJSONObject("event"))
                    ||!java.util.Objects.equals(entry.get("owner"),persisted.get("owner"))
                    ||!java.util.Objects.equals(entry.get("visual_state"),persisted.get("visualState"))
                    ||!java.util.Objects.equals(entry.get("audio_state"),persisted.get("audioState"))
                    ||!java.util.Objects.equals(entry.get("receipt_recorded"),persisted.get("receiptRecorded")))throw invalid();
                supported(event,0);supported(persisted,0);
            }
            JSONObject scheduler=document.getJSONObject("scheduler");
            NativeRetainedAttempt.keys(scheduler,"schema","receipt_eligible","scope","selector","prefix","raw","last_verified_saves","unrelated");
            if(!ProviderWireJson.same(selector,scheduler.getJSONObject("selector"))||!"mz_native_notification_outbox:schedule:".equals(scheduler.get("prefix")))throw invalid();
            JSONArray rows=scheduler.getJSONArray("raw"),savedRows=scheduler.getJSONArray("last_verified_saves");if(rows.length()>256||savedRows.length()!=rows.length())throw invalid();
            java.util.HashSet<String> rawKeys=new java.util.HashSet<>();
            for(int i=0;i<rows.length();i++){
                JSONArray pair=rows.getJSONArray(i);if(pair.length()!=2||!(pair.get(0) instanceof String)||!(pair.get(1) instanceof String)
                    ||!pair.getString(0).startsWith(scheduler.getString("prefix"))||!rawKeys.add(pair.getString(0)))throw invalid();
                JSONArray verified=savedRows.getJSONArray(i);
                if(verified.length()!=2||!pair.get(0).equals(verified.get(0))
                    ||!verified.isNull(1)&&!pair.get(1).equals(verified.get(1)))throw invalid();
                JSONObject saved=ProviderWireJson.object(pair.getString(1).getBytes(java.nio.charset.StandardCharsets.UTF_8),131072);
                if(!"native-notification-schedule.v1".equals(saved.get("schema_version"))||!principal.equals(saved.get("scope"))
                    ||!java.util.Set.of("scheduled","cancelled").contains(saved.get("state")))throw invalid();
                long id=integer(saved.get("id"));JSONObject notification=saved.getJSONObject("notification"),extra=notification.getJSONObject("extra");
                if(id<1||id>2147483647L||!pair.getString(0).equals(scheduler.getString("prefix")+id)
                    ||integer(notification.get("id"))!=id||!principal.equals(extra.get("native_presentation_principal"))
                    ||!Long.toString(id).equals(extra.get("native_presentation_id"))||!target.get("serviceDate").equals(extra.get("service_date"))
                    ||!java.util.Set.of("employee_lunch_coverage","employee_location_status").contains(extra.get("kind"))
                    ||!saved.getString("delivery_ownership_group").matches("mz-custodial-owned:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")
                    ||!saved.get("delivery_ownership_group").equals(notification.get("group")))throw invalid();
                supported(saved,0);
                // A missing volatile last-save token remains explicit null:
                // only actual durable native-generation/body/OS joins may
                // later support that restart case. No OS proof is lent here.
            }
            JSONObject reminder=document.getJSONObject("reminder");
            NativeRetainedAttempt.keys(reminder,"schema","receipt_eligible","scope","selector","active","sequence_pending","speech_pending","active_oscillators","ring_timeouts","raw_owner_state");
            if(!ProviderWireJson.same(selector,reminder.getJSONObject("selector"))||!(reminder.get("sequence_pending") instanceof Boolean)
                ||!(reminder.get("speech_pending") instanceof Boolean)||integer(reminder.get("active_oscillators"))<0||integer(reminder.get("ring_timeouts"))<0)throw invalid();
            JSONArray active=reminder.getJSONArray("active");if(active.length()>2)throw invalid();
            for(int i=0;i<active.length();i++){
                JSONObject item=active.getJSONObject(i);NativeRetainedAttempt.keys(item,"role","origin","notification_key","notification_type","native_origin_present","receipt_eligible");
                if(!java.util.Set.of("visual","audio").contains(item.get("role"))||!(item.get("native_origin_present") instanceof Boolean)
                    ||!Boolean.FALSE.equals(item.get("receipt_eligible")))throw invalid();
                // Unmatched active ordinary cards are explicit opaque DATA,
                // never erased or adopted as settled for the relevant target.
            }
            return new Observation(principal,target.getString("serviceDate"),row.getString("intent_id"),row.getString("target_digest"),purpose.getString("rendered_digest"),document,a.getJSONArray("failed_callback_terminals"));
        }catch(VaultFailure unavailable){throw unavailable;}
        catch(Exception malformed){throw new VaultFailure("custodial_recurring_ordinary_render_pending",malformed);}
    }
    private static JSONObject frame(byte[] raw)throws Exception {
        JSONObject value=ProviderWireJson.object(raw,1048576);
        NativeRetainedAttempt.keys(value,"schema","receipt_eligible","writer_epoch","failed_callback_terminals","document_data");
        if(!"custodial.native-recurring-ordinary-native-data.v1".equals(value.get("schema"))||!Boolean.FALSE.equals(value.get("receipt_eligible")))throw invalid();
        long epoch=integer(value.get("writer_epoch")),previous=-1;JSONArray failures=value.getJSONArray("failed_callback_terminals");
        if(failures.length()>128)throw invalid();for(int i=0;i<failures.length();i++){
            JSONObject item=failures.getJSONObject(i);NativeRetainedAttempt.keys(item,"epoch","kind");long n=integer(item.get("epoch"));
            if(n<=previous||n>epoch||!java.util.Set.of("SYNC_THROW","PROMISE_REJECTED","HELD_PRE_EFFECT_REFUSAL").contains(item.get("kind")))throw invalid();previous=n;
        }
        JSONObject doc=value.getJSONObject("document_data");
        NativeRetainedAttempt.keys(doc,"schema","receipt_eligible","selector","employee","presenter","scheduler","reminder");
        if(!"custodial.native-recurring-ordinary-document-data.v1".equals(doc.get("schema"))||!Boolean.FALSE.equals(doc.get("receipt_eligible")))throw invalid();
        String[] names={"employee","presenter","scheduler","reminder"};String[] schemas={"custodial.native-employee-raw-data.v1","custodial.native-presenter-ordinary-target-data.v1","custodial.native-scheduler-ordinary-target-data.v1","custodial.native-reminder-ordinary-target-data.v1"};
        for(int i=0;i<names.length;i++){JSONObject owner=doc.getJSONObject(names[i]);if(!schemas[i].equals(owner.get("schema"))||!Boolean.FALSE.equals(owner.get("receipt_eligible")))throw invalid();}
        return value;
    }
    private static long integer(Object value)throws VaultFailure {
        if(!(value instanceof Long||value instanceof Integer))throw invalid();long n=((Number)value).longValue();
        if(n<0||n>9007199254740991L)throw invalid();return n;
    }
    private static void supported(Object value,int depth)throws Exception {
        if(depth>16)throw invalid();
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;
            if(object.has("unknown_type"))throw invalid();
            for(var it=object.keys();it.hasNext();)supported(object.get(it.next()),depth+1);
        }else if(value instanceof JSONArray){JSONArray array=(JSONArray)value;for(int i=0;i<array.length();i++)supported(array.get(i),depth+1);}
        else if(value instanceof Number){if(!(value instanceof Integer||value instanceof Long)
            ||((Number)value).longValue() < -9007199254740991L||((Number)value).longValue()>9007199254740991L)throw invalid();}
        else if(value!=JSONObject.NULL&&!(value instanceof String)&&!(value instanceof Boolean))throw invalid();
    }
    private static VaultFailure invalid(){return new VaultFailure("custodial_recurring_ordinary_render_pending");}
}
