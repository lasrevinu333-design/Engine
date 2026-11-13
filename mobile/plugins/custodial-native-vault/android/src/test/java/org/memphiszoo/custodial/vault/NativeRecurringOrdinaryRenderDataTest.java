package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Genuine target + ordinary PREPARED factories, with explicitly synthetic
 * owner/render DATA. No opaque Source frame, native effects or receipt proof. */
public final class NativeRecurringOrdinaryRenderDataTest {
    private static byte[] bytes(JSONObject value){return value.toString().getBytes(StandardCharsets.UTF_8);}
    private static final class Fixture {
        final JSONObject response,record,frame;final NativeRecurringOrdinaryPurposeJournal.PreparedData prepared;
        Fixture(boolean blocked)throws Exception {
            response=new JSONObject(NativeRecurringTargetJournalTest.SYNTHETIC_TARGET_RESPONSE);
            JSONObject data=response.getJSONObject("data"),delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
            JSONObject view=new JSONObject().put("schema","static-weekly.recurring-render-view.v1")
                .put("service_date",target.get("serviceDate")).put("employee_id",target.get("employeeId"))
                .put("employee_name","Synthetic employee").put("publication_id",target.get("publicationId"))
                .put("projection_id",target.get("projectionId")).put("projection_status","current")
                .put("full_day",true).put("shift",JSONObject.NULL).put("raw_items",new JSONArray().put(new JSONObject().put("name","Synthetic normal nonempty area").put("service_date",target.get("serviceDate")).put("location_id","11111111-1111-4111-8111-111111111111").put("load_points",30)));
            if(blocked){
                data.put("schedule_delivery_mode","RECURRING_TERMINAL");
                target.put("schema","static-weekly.recurring-terminal-target.v1").put("targetType","BLOCKED_RECURRING_AUTHORITY")
                    .put("invalidationId","cccccccc-cccc-4ccc-8ccc-cccccccccccc").put("reasonCode","SOURCE_RETIRED");
                for(String key:new String[]{"projectionId","lunchDocumentIdentity","viewDigest"})target.remove(key);
                delivery.put("replacementCoverageReady",false).put("viewJsonText",JSONObject.NULL).put("view",JSONObject.NULL).put("viewDigest",JSONObject.NULL);
            }else{
                String text=view.toString(),digest=NativeProviderPrincipal.hash(text);
                target.put("viewDigest",digest);delivery.put("viewJsonText",text).put("viewDigest",digest);
            }
            var names=new java.util.ArrayList<String>();target.keys().forEachRemaining(names::add);
            names.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
            StringBuilder text=new StringBuilder("{");for(String key:names){if(text.length()>1)text.append(", ");Object value=target.get(key);
                text.append(JSONObject.quote(key)).append(": ").append(value instanceof String?JSONObject.quote((String)value):value.toString());}
            delivery.put("targetDigest",NativeProviderPrincipal.hash(text.append('}').toString()));
            var store=new NativeRecurringTargetJournalTest.Store();var journal=new NativeRecurringTargetJournal(store);
            var principal=NativeRecurringTargetJournalTest.principal();
            var request=new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]);
            var actual=new AuthorizedResponse(200,Map.of("content-type","application/json"),bytes(response));
            var retained=journal.captureActualTarget(request,actual,new NativeRecurringTargetJournal.ResponseOwner(){
                public NativeProviderPrincipal requireCurrent(){return principal;}
                public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure {
                    if(r!=request||s!=actual)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
                }
            });
            assertNotNull(retained);record=new JSONObject(retained.record);
            NativeRecurringOrdinaryPurposeJournal.Store purposes=new NativeRecurringOrdinaryPurposeJournal.Store(){
                public String retainOrdinaryRecurringPrepared(String key,NativeRecurringTargetJournal.RetainedTargetData row,String candidate,NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure {
                    owner.requireLatest();return candidate;
                }
                public void requireOrdinaryRecurringPreparedCurrent(NativeRecurringTargetJournal.RetainedTargetData row,NativeRecurringOrdinaryPurposeJournal.PreparedData prepared,NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws VaultFailure{owner.requireLatest();}
            };
            prepared=new NativeRecurringOrdinaryPurposeJournal(purposes).prepare(retained,actual,NativeRetainedAttempt.hash(actual.body),()->{});
            assertNotNull(prepared);
            JSONObject expected=new JSONObject(data.toString());
            if(blocked)expected.put("projection_status","blocked_recurring_authority").put("raw_items",new JSONArray())
                .put("current_items",new JSONArray()).put("full_day",true).put("shift",JSONObject.NULL);
            else for(var it=view.keys();it.hasNext();){String key=it.next();expected.put(key,view.get(key));}
            String identity=principal.json().toString();
            JSONObject render=new JSONObject().put("schema","custodial.native-recurring-original-render-data.v1").put("receipt_eligible",false)
                .put("scope","ORIGINAL_TYPED_SOURCE_AT_RENDER_COMMIT_NOT_SETTLEMENT").put("principal_identity",identity)
                .put("service_date",target.get("serviceDate")).put("availability",new JSONObject()
                    .put("schema","employee-schedule-availability.v1").put("principal",identity).put("serviceDate",target.get("serviceDate"))
                    .put("state","AVAILABLE").put("stamp","synthetic-fixed-stamp"))
                .put("security_generation",4).put("load_version",6).put("offline",false).put("cache_warning",false).put("original_source",expected);
            JSONObject employee=new JSONObject().put("schema","custodial.native-employee-raw-data.v1").put("receipt_eligible",false)
                .put("loading",false).put("loadVersion",6).put("shownPrincipal",identity).put("queued",false).put("paused",false)
                .put("securityBlocked",false).put("securityGeneration",4).put("lastView",new JSONObject())
                .put("original_typed_render",render).put("elements",new JSONObject());
            JSONObject selector=new JSONObject().put("principal",identity).put("service_date",target.get("serviceDate"))
                .put("intent_id",record.get("intent_id")).put("target_digest",record.get("target_digest"));
            JSONObject reminder=new JSONObject().put("schema","custodial.native-reminder-ordinary-target-data.v1").put("receipt_eligible",false)
                .put("scope","SAME_NORMAL_RENDERER_ORIGIN_AND_LIFETIME_DATA_NOT_AUDIO_SETTLEMENT").put("selector",selector)
                .put("active",new JSONArray()).put("sequence_pending",false).put("speech_pending",false)
                .put("active_oscillators",0).put("ring_timeouts",0).put("raw_owner_state",new JSONObject().put("opaque_context_retained",true));
            JSONObject doc=new JSONObject().put("schema","custodial.native-recurring-ordinary-document-data.v1").put("receipt_eligible",false)
                .put("selector",selector).put("employee",employee).put("reminder",reminder)
                .put("presenter",new JSONObject().put("schema","custodial.native-presenter-ordinary-target-data.v1").put("receipt_eligible",false)
                    .put("scope","FIXED_NORMAL_ENTRY_AND_RETURNED_SAVE_DATA_NOT_EFFECT_SETTLEMENT").put("selector",selector).put("native_owner_required",true)
                    .put("draining",false).put("retryRequested",false).put("entries",new JSONArray()).put("poll_owners",new JSONArray())
                    .put("unrelated",new JSONObject().put("entries",7).put("poll_owners",2).put("opaque_retained_entries",3)))
                .put("scheduler",new JSONObject().put("schema","custodial.native-scheduler-ordinary-target-data.v1").put("receipt_eligible",false)
                    .put("scope","EXACT_NORMAL_RAW_ROWS_AND_GUARDS_NOT_OS_SETTLEMENT").put("selector",selector).put("prefix","mz_native_notification_outbox:schedule:")
                    .put("raw",new JSONArray()).put("last_verified_saves",new JSONArray()).put("unrelated",new JSONObject().put("rows",8)));
            frame=new JSONObject().put("schema","custodial.native-recurring-ordinary-native-data.v1").put("receipt_eligible",false)
                .put("writer_epoch",12).put("failed_callback_terminals",new JSONArray()).put("document_data",doc);
        }
        JSONObject document()throws Exception{return frame.getJSONObject("document_data");}
        JSONObject render()throws Exception{return document().getJSONObject("employee").getJSONObject("original_typed_render");}
        void accept()throws Exception{NativeRecurringOrdinaryRenderData.requireOriginal(bytes(frame),bytes(frame),bytes(response),record.toString(),prepared);}
        void refuse(){assertThrows(VaultFailure.class,()->accept());}
    }
    @Test public void nonemptyScheduleAndBlockedOriginalFactoriesProduceOnlyData()throws Exception {new Fixture(false).accept();new Fixture(true).accept();}
    @Test public void laterAuthenticSameTargetWireRemainsDistinctFromRetainedFirstWire()throws Exception {
        Fixture f=new Fixture(false);byte[] later=(f.response.toString()+" ").getBytes(StandardCharsets.UTF_8);
        var observed=NativeRecurringOrdinaryRenderData.requireOriginal(bytes(f.frame),bytes(f.frame),later,f.record.toString(),f.prepared);
        assertEquals(f.record.get("intent_id"),observed.intentId);assertNotEquals(NativeRetainedAttempt.hash(later),f.record.get("native_authorized_response_sha256"));
    }
    @Test public void coherentChangedSemanticTargetCannotBorrowOriginalRow()throws Exception {
        Fixture f=new Fixture(false);f.response.getJSONObject("data").getJSONObject("recurring_delivery").getJSONObject("target").put("authorityRevision",99);f.refuse();
    }
    @Test public void fullPrincipalSealAndAvailabilityMustMatchGenuineTarget()throws Exception {
        Fixture f=new Fixture(false);JSONObject other=new JSONObject(f.render().getString("principal_identity")).put("installation_seal","synthetic-foreign-seal");
        f.render().put("principal_identity",other.toString());f.document().getJSONObject("employee").put("shownPrincipal",other.toString());f.refuse();
    }
    @Test public void offlineUnconfirmedOrLoadingNeverBecomesOriginalTypedRender()throws Exception {
        for(String field:new String[]{"offline","cache_warning"}){Fixture f=new Fixture(false);f.render().put(field,true);f.refuse();}
        Fixture f=new Fixture(false);f.document().getJSONObject("employee").put("loading",true);f.refuse();
    }
    @Test public void unsupportedEmployeeCellAndLossyEpochRefuseWithoutMutation()throws Exception {
        Fixture f=new Fixture(false);f.document().getJSONObject("employee").getJSONObject("elements").put("opaque",new JSONObject().put("unknown_type","opaque_object"));
        String before=f.frame.toString();f.refuse();assertEquals(before,f.frame.toString());
        Fixture clean=new Fixture(false);byte[] decimal=clean.frame.toString().replace("\"writer_epoch\":12","\"writer_epoch\":12.0").getBytes(StandardCharsets.UTF_8);
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryRenderData.requireOriginal(decimal,bytes(clean.frame),bytes(clean.response),clean.record.toString(),clean.prepared));
    }
    @Test public void historicalKnownCallbackFailuresArePreservedNotGlobalSettlement()throws Exception {
        Fixture f=new Fixture(false);f.frame.getJSONArray("failed_callback_terminals").put(new JSONObject().put("epoch",11).put("kind","PROMISE_REJECTED"));f.accept();
        assertEquals(1,f.frame.getJSONArray("failed_callback_terminals").length());
    }
    @Test public void unsupportedHistoricalFailureKindRefuses()throws Exception {Fixture f=new Fixture(false);f.frame.getJSONArray("failed_callback_terminals").put(new JSONObject().put("epoch",11).put("kind","CALLER_SUCCESS"));f.refuse();}
    @Test public void terminalEpochOrRenderMutationRefuses()throws Exception {
        Fixture f=new Fixture(false);JSONObject changed=new JSONObject(f.frame.toString()).put("writer_epoch",13);
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryRenderData.requireOriginal(bytes(f.frame),bytes(changed),bytes(f.response),f.record.toString(),f.prepared));
    }
    private static JSONObject scheduled(Fixture f,String state)throws Exception {
        String identity=f.render().getString("principal_identity"),group="mz-custodial-owned:44444444-4444-4444-8444-444444444444";
        return new JSONObject().put("schema_version","native-notification-schedule.v1").put("id",41).put("scope",identity)
            .put("notification",new JSONObject().put("id",41).put("group",group).put("extra",new JSONObject()
                .put("native_presentation_principal",identity).put("native_presentation_id","41").put("kind","employee_location_status")
                .put("service_date",f.record.getJSONObject("target").get("serviceDate"))))
            .put("delivery_ownership_group",group).put("state",state);
    }
    private static void row(Fixture f,JSONObject row)throws Exception {
        JSONObject scheduler=f.document().getJSONObject("scheduler");String raw=row.toString();
        scheduler.getJSONArray("raw").put(new JSONArray().put("mz_native_notification_outbox:schedule:41").put(raw));
        scheduler.getJSONArray("last_verified_saves").put(new JSONArray().put("mz_native_notification_outbox:schedule:41").put(raw));
    }
    @Test public void exactScheduledAndCancelledRowsRemainDataNotOSProof()throws Exception {for(String state:new String[]{"scheduled","cancelled"}){Fixture f=new Fixture(false);row(f,scheduled(f,state));f.accept();}}
    @Test public void pendingIntentAndConfirmationGuardRefuseWithoutCancelOrRetry()throws Exception {Fixture f=new Fixture(false);row(f,scheduled(f,"intent"));String raw=f.frame.toString();f.refuse();assertEquals(raw,f.frame.toString());}
    @Test public void changedCurrentRawCannotBorrowLastNormalSave()throws Exception {
        Fixture f=new Fixture(false);row(f,scheduled(f,"scheduled"));f.document().getJSONObject("scheduler").getJSONArray("last_verified_saves").getJSONArray(0).put(1,"different original");f.refuse();
    }
    @Test public void unrelatedHistoricalCountsAndOpaqueAudioContextDoNotRequireGlobalEmptyHistory()throws Exception {
        Fixture f=new Fixture(false);f.document().getJSONObject("presenter").getJSONObject("unrelated").put("entries",18);
        f.document().getJSONObject("reminder").getJSONObject("raw_owner_state").put("audioContext",new JSONObject().put("unknown_type","opaque_object"));f.accept();
    }
    @Test public void selectorCopyCannotReplaceOriginalTypedRenderTarget()throws Exception {Fixture f=new Fixture(false);f.document().getJSONObject("selector").put("intent_id","dddddddd-dddd-4ddd-8ddd-dddddddddddd");f.refuse();}
    @Test public void legacyRowAndDuplicateFrameKeysCannotBePromoted()throws Exception {
        Fixture f=new Fixture(false);f.record.put("schema","custodial.native-recurring-authenticated-target-data.v1");f.refuse();
        Fixture clean=new Fixture(false);byte[] duplicate=clean.frame.toString().replace("\"writer_epoch\":12","\"writer_epoch\":12,\"writer_epoch\":12").getBytes(StandardCharsets.UTF_8);
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryRenderData.requireOriginal(duplicate,bytes(clean.frame),bytes(clean.response),clean.record.toString(),clean.prepared));
    }
    private static JSONObject presentation(Fixture f)throws Exception {
        String identity=f.render().getString("principal_identity"),key="synthetic-location-original";
        JSONObject event=new JSONObject().put("notification",new JSONObject().put("title","Synthetic original").put("body","Retained ordinary effect")
            .put("data",new JSONObject().put("notification_key",key).put("kind","employee_location_status").put("service_date",f.record.getJSONObject("target").get("serviceDate"))));
        JSONObject persisted=new JSONObject().put("schema_version","native-notification-presentation.v2").put("scope",identity).put("key",key)
            .put("event",event).put("owner","browser").put("receiptRecorded",true).put("queueOrdinal",1).put("queueOrderSource","accepted-local")
            .put("visualState","pending").put("audioState","completed");String raw=persisted.toString();
        JSONObject entry=new JSONObject().put("map_key",new JSONArray().put(identity).put(key).toString()).put("scope",identity).put("key",key).put("event",event)
            .put("owner","browser").put("running",false).put("rendered",true).put("receipt_recorded",true).put("visual_state","pending").put("audio_state","completed")
            .put("audio_attempted",true).put("retirement_pending",false).put("retiring",false).put("receipt_eligible",false).put("current_raw",raw)
            .put("last_verified_save",new JSONObject().put("scope",identity).put("key",key).put("generation",4).put("raw",raw)
                .put("scope_kind","NORMAL_SAVE_RETURNED_NOT_CURRENT_NATIVE_WORK").put("receipt_eligible",false))
            .put("opaque_fields",new JSONObject().put("saving",new JSONObject().put("unknown_type","opaque_object"))
                .put("retireBrowser",new JSONObject().put("unknown_type","function")));
        f.document().getJSONObject("presenter").getJSONArray("entries").put(entry);return entry;
    }
    @Test public void historicalSettledSavingPromiseAndRetireCallbackAreLabelsNotGlobalUnknown()throws Exception {Fixture f=new Fixture(false);presentation(f);f.accept();}
    @Test public void changedPresentationCurrentRawCannotBorrowReturnedNormalReadback()throws Exception {Fixture f=new Fixture(false);presentation(f).put("current_raw","later changed original");f.refuse();}
    @Test public void activeRetirementAndAudioClaimRemainPendingWithoutErasure()throws Exception {
        Fixture f=new Fixture(false);presentation(f).put("retirement_pending",true);f.refuse();
        Fixture other=new Fixture(false);presentation(other).put("audio_state","claimed");other.refuse();
    }

}
