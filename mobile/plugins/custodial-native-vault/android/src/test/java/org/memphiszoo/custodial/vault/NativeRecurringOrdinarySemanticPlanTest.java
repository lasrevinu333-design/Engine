package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
/** Pure semantic DATA only, actual guarded target/render/PREPARED factories
 * with declared synthetic owner observations. No native Source or OS grant. */
public final class NativeRecurringOrdinarySemanticPlanTest {
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
    private static final class Plan {
        final Fixture f;final JSONObject issued,plan,scope;Map<String,String> rows=Map.of();
        Plan(boolean blocked)throws Exception {
            f=new Fixture(blocked);JSONObject target=f.record.getJSONObject("target"),p=new JSONObject(f.render().getString("principal_identity"));
            issued=new JSONObject().put("schema","custodial.recurring-current-notification-plan.v1").put("complete",true).put("receipt_eligible",false)
                .put("scope","CURRENT_PRESENTATION_AND_FULL_EFFECTS_REQUIRED_BY_ACCEPTED_TARGET_NOT_FUTURE_ALARM_INVENTORY")
                .put("source",blocked?"AUTHENTICATED_BLOCKED_TARGET":"FULL_ACCEPTED_LUNCH_AND_EXHAUSTIVE_CURRENT_LOCATION_DERIVATION")
                .put("service_date",target.get("serviceDate")).put("intent_id",f.record.get("intent_id")).put("target_digest",f.record.get("target_digest"))
                .put("target",target).put("rendered_digest",blocked?f.record.get("target_digest"):target.get("viewDigest"))
                .put("backend_principal_digest","1".repeat(64)).put("plan_read_id","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee").put("semantic_digest","2".repeat(64))
                .put("device_pk",target.get("deviceId")).put("canonical_device_id",p.get("device_id")).put("employee_id",p.get("employee_id"))
                .put("credential_id",p.get("credential_id")).put("assignment_epoch",Long.toString(((Number)p.get("assignment_epoch")).longValue()))
                .put("observed_at","2026-10-21T12:00:00.000001Z").put("valid_until","2026-10-22T05:00:00.000000Z")
                .put("notification_state",new JSONObject().put("notifications_silent",true).put("silent_reason","fixture-empty-current").put("override_enabled",false))
                .put("accepted_lunch_intents",new JSONArray()).put("required_effects",new JSONArray()).put("required_audio",new JSONArray())
                .put("source_counts",new JSONObject().put("accepted_lunch_intents",0).put("current_assigned_locations",0));
            plan=new JSONObject().put("schema","custodial.normal-expected-notification-plan.v1").put("receipt_eligible",false)
                .put("scope","CURRENT_PRESENTATION_AND_FULL_EFFECTS_REQUIRED_BY_ACCEPTED_TARGET").put("selector",f.document().getJSONObject("selector"))
                .put("coverage","COMPLETE_AUTHENTICATED_CURRENT_PLAN").put("birth","NORMAL_AUTHENTICATED_COMMITTED_TARGET_AND_SERVER_COMPLETE_PLAN")
                .put("acquired_at","2026-10-21T12:00:00Z").put("expires_on_service_date_change",true).put("availability",f.render().getJSONObject("availability"))
                .put("target",target).put("required_effects",new JSONArray()).put("required_audio",new JSONArray())
                .put("retire_superseded_relevant_effects",true).put("complete",true)
                .put("normal_derivation",new JSONObject().put("schema","custodial.normal-complete-notification-derivation.v1")
                    .put("producer","SAME_NORMAL_LOCATION_AND_ACCEPTED_RENDERER_FORMATTERS_NOT_OBSERVED_SUBSET").put("effects",new JSONArray()));
            JSONObject lane=new JSONObject().put("scope","SAME_NORMAL_BROWSER_LANE_NOT_NATIVE_AUDIO_SETTLEMENT").put("detached",false)
                .put("sequence_pending",false).put("speech_pending",false).put("browser_speech_pending",false).put("sequence_tone_pending",false)
                .put("audio_alert_present",false).put("html_audio_present",false).put("html_audio_paused",true).put("active_oscillators",0).put("ring_timeouts",0);
            f.document().getJSONObject("reminder").getJSONObject("raw_owner_state").put("expected_plan",plan).put("browser_audio_lane",lane);
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(p);
            scope=new JSONObject().put("schema","custodial.native-ordinary-empty-current-observation.v1").put("principal_sha256",principal.digest)
                .put("service_date",target.get("serviceDate")).put("generations",new JSONArray()).put("receipt_eligible",false)
                .put("visible",new JSONObject().put("raw",new JSONObject()).put("active",new JSONObject()).put("native_notifications_enabled",true).put("exact_alarm_permission_current",false))
                .put("empty_current_observation",true).put("historical_alarm_inventory_proven",false).put("alarm_delivery_proven",false)
                .put("alarm_scope","CURRENT_OWNED_PUBLISHER_GENERATION_GUARDS_NOT_HISTORICAL_ALARM_INVENTORY")
                .put("legacy_owned_generationless_dispatch","REFUSED_BY_CURRENT_REGISTERED_NATIVE_RUNTIME_PUBLISHER");
            reissue();
        }
        void reissue()throws Exception {
            String wire=issued.toString();JSONObject envelope=new JSONObject().put("schema","custodial.recurring-current-notification-plan-envelope.v1")
                .put("body",new JSONObject(wire)).put("bodyJsonText",wire).put("bodyDigest",NativeProviderPrincipal.hash(wire));
            f.response.getJSONObject("data").put("ordinary_notification_plan",envelope);
            f.render().getJSONObject("original_source").put("ordinary_notification_plan",new JSONObject(envelope.toString()));
            plan.put("source_envelope",new JSONObject(envelope.toString()));
        }
        NativeRecurringOrdinarySemanticPlan.Observation read()throws Exception {
            var browser=NativeRecurringOrdinaryRenderData.requireOriginal(bytes(f.frame),bytes(f.frame),bytes(f.response),f.record.toString(),f.prepared);
            return NativeRecurringOrdinarySemanticPlan.requireOriginal(browser,f.prepared,scope.toString(),rows,bytes(f.response));
        }
        void refuse(){assertThrows(VaultFailure.class,()->read());}
    }
    @Test public void blockedAndNonemptyAcceptedScheduleCanHaveCompleteEmptyCurrentPlan()throws Exception {
        for(boolean blocked:new boolean[]{false,true}){Plan f=new Plan(blocked);var p=f.read();assertEquals(f.issued.get("plan_read_id"),p.planReadId);
            assertEquals(1792584000000001L,p.observedAtEpochMicros);assertTrue(p.validUntilEpochMicros>p.observedAtEpochMicros);assertTrue(p.nativeAudioAbsenceStillRequired);}
    }
    @Test public void browserCopiedTokenCannotReplaceActualNativeEnvelope()throws Exception {Plan f=new Plan(false);f.plan.getJSONObject("source_envelope").getJSONObject("body").put("plan_read_id","dddddddd-dddd-4ddd-8ddd-dddddddddddd");f.refuse();}
    @Test public void changedLatestNativeEnvelopeCannotBorrowBrowserPlan()throws Exception {Plan f=new Plan(false);f.f.response.getJSONObject("data").getJSONObject("ordinary_notification_plan").put("bodyDigest","0".repeat(64));f.refuse();}
    @Test public void incompleteMissingAndWrongPrincipalPlansRefuse()throws Exception {
        for(String field:new String[]{"complete","plan_read_id","semantic_digest","backend_principal_digest"}){Plan f=new Plan(true);f.issued.remove(field);f.reissue();f.refuse();}
        for(String field:new String[]{"device_pk","employee_id","credential_id"}){Plan f=new Plan(false);f.issued.put(field,"dddddddd-dddd-4ddd-8ddd-dddddddddddd");f.reissue();f.refuse();}
    }
    @Test public void requiredAudioIsNotSatisfiedByBrowserCompletedFlags()throws Exception {Plan f=new Plan(false);f.issued.getJSONArray("required_audio").put("required-lunch");f.plan.getJSONArray("required_audio").put("required-lunch");f.reissue();f.refuse();}
    @Test public void serverTimestampPrecisionAndOrderStrictlyPreserved()throws Exception {
        for(String value:new String[]{"2026-02-31T12:00:00.000000Z","2026-10-21T12:00:00Z","2026-10-21T12:00:00.000001Z","2026-10-21T11:59:59.999999Z"}){Plan f=new Plan(false);f.issued.put("valid_until",value);f.reissue();f.refuse();}
    }
    @Test public void quietFlagsDoNotEraseActualBrowserPendingWork()throws Exception {for(String field:new String[]{"sequence_pending","speech_pending","audio_alert_present","detached"}){Plan f=new Plan(false);f.f.document().getJSONObject("reminder").getJSONObject("raw_owner_state").getJSONObject("browser_audio_lane").put(field,true);f.refuse();}}
    @Test public void actualVisibleAndRawNativeEffectsCannotBeClaimedAbsent()throws Exception {for(String field:new String[]{"raw","active"}){Plan f=new Plan(false);f.scope.getJSONObject("visible").getJSONObject(field).put("1","retained-actual");f.refuse();}}
    @Test public void unknownRowsOrHistoricalAlarmClaimNeverProduceEmptyProof()throws Exception {
        Plan f=new Plan(false);f.rows=Map.of("unknown-history","retained");f.refuse();Plan g=new Plan(false);g.scope.put("historical_alarm_inventory_proven",true);g.refuse();
    }
    @Test public void expiryOrTargetMutationRefusesWithoutChangingOriginalPurpose()throws Exception {Plan f=new Plan(true);String original=f.f.prepared.record;f.issued.put("target_digest","f".repeat(64));f.reissue();f.refuse();assertEquals(original,f.f.prepared.record);}
    // Actual journal state transitions, declared synthetic call/visible DATA.
    // This grammar test cannot construct the native ScopeRead capability and
    // is explicitly NOT original PI/OS cancellation or native settlement.
    private static void cancelledJournalModel(Plan f)throws Exception {
        var retainedStore=new NativeRecurringTargetJournalTest.Store();
        var principal=NativeRecurringTargetJournalTest.principal();
        final String expectedServiceDate=f.f.record.getJSONObject("target").getString("serviceDate");
        final int[] effectSnapshotReads={0};
        var effectSnapshot=new java.util.concurrent.atomic.AtomicReference<Map<String,String>>();
        // Explicit synthetic fixture adapter. The SAME retained rows/CAS are
        // kept; ONE immutable whole snapshot supplies mutations AND targets.
        // The shared Store default remains refusing and is not modified.
        NativeRecurringTargetJournal.Store store=new NativeRecurringTargetJournal.Store(){
            public String loadRecurringRecord(String key)throws VaultFailure{return retainedStore.loadRecurringRecord(key);}
            public void compareAndRetainRecurringRecord(String key,String previous,String candidate)throws VaultFailure {
                retainedStore.compareAndRetainRecurringRecord(key,previous,candidate);
            }
            public Map<String,String> recurringRecords()throws VaultFailure{return retainedStore.recurringRecords();}
            public Map<String,String> notificationEffectRecords(NativeProviderPrincipal expected,String serviceDate)throws VaultFailure {
                assertTrue(principal.same(expected));
                assertEquals(expectedServiceDate,serviceDate);
                effectSnapshotReads[0]++;
                Map<String,String> snapshot=Map.copyOf(retainedStore.rows);
                effectSnapshot.set(snapshot);return snapshot;
            }
        };
        var journal=new NativeRecurringTargetJournal(store);
        var request=new AuthorizedRequest("/schedule-api/my-day-summary","GET",Map.of(),new byte[0]);
        var response=new AuthorizedResponse(200,Map.of(),bytes(f.f.response));
        var retained=journal.captureActualTarget(request,response,new NativeRecurringTargetJournal.ResponseOwner(){
            public NativeProviderPrincipal requireCurrent(){return principal;}
            public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure{if(r!=request||s!=response)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);}
        });assertNotNull(retained);
        String raw=new JSONObject().put("id",41).put("title","Synthetic cancelled grammar only").put("body","No OS action")
            .put("group","mz-custodial-owned:44444444-4444-4444-8444-444444444444").put("extra",new JSONObject()
                .put("native_presentation_id","41").put("native_presentation_principal",principal.json().toString())
                .put("service_date",f.f.record.getJSONObject("target").get("serviceDate")).put("schedule_authority_revision",1)).toString();
        String g=journal.beforeSchedule(principal,41,raw);journal.scheduleCalled(g);assertEquals(g,journal.beforeCancel(principal,41,raw));journal.cancelCalled(g);
        var known=journal.readKnownEffect(principal,f.f.record.getJSONObject("target").getString("serviceDate"),g);
        assertEquals(1,effectSnapshotReads[0]);assertNotNull(effectSnapshot.get());
        assertEquals(retainedStore.rows,effectSnapshot.get());
        assertEquals(known.recordText,effectSnapshot.get().get(NativeRecurringTargetJournal.MUTATION_PREFIX+NativeProviderPrincipal.hash(g)));
        assertEquals(known.targetText,effectSnapshot.get().get(known.targetReference));
        assertThrows(UnsupportedOperationException.class,()->effectSnapshot.get().put("SYNTHETIC_IMMUTABLE_SNAPSHOT_PROBE","must not commit"));
        assertEquals(retainedStore.rows,effectSnapshot.get());
        f.rows=Map.of(NativeRecurringTargetJournal.MUTATION_PREFIX+NativeProviderPrincipal.hash(g),known.recordText,known.targetReference,known.targetText);
        f.scope.put("schema","custodial.native-ordinary-effect-call-data.v1");for(String k:new String[]{"empty_current_observation","historical_alarm_inventory_proven","alarm_delivery_proven","legacy_owned_generationless_dispatch"})f.scope.remove(k);
        f.scope.put("alarm_scope","ORIGINAL_REGISTRATION_RETURN_AND_UNMUTATED_KNOWN_GENERATION_NOT_DELIVERY_OR_FULL_ALARM_INVENTORY");
        JSONArray calls=new JSONArray();for(String operation:new String[]{"CANCEL_NOTIFICATION","CANCEL_ALARM"})calls.put(new JSONObject()
            .put("operation",operation).put("returned",true).put("notification",JSONObject.NULL).put("alarm_type",0).put("trigger",0)
            .put("pending_intent_flags",0).put("pending_intent_creator_uid",JSONObject.NULL).put("alarm_delivery_proven",false));
        f.scope.getJSONArray("generations").put(new JSONObject().put("generation",g).put("id",41).put("group",known.group)
            .put("raw_sha256",NativeProviderPrincipal.hash(raw)).put("target_reference",known.targetReference)
            .put("record_sha256",NativeProviderPrincipal.hash(known.recordText)).put("state",known.state).put("calls",calls).put("original_pending_intents",new JSONArray()));
    }
    @Test public void genuineJournalCancelledHistoryGrammarDoesNotRequireDeletingOriginalRows()throws Exception {
        Plan f=new Plan(false);cancelledJournalModel(f);var before=Map.copyOf(f.rows);assertNotNull(f.read());assertEquals(before,f.rows);
    }
    @Test public void unfinishedAlarmOrChangedCancelledOriginalCannotBorrowEmptyPlan()throws Exception {
        Plan f=new Plan(false);cancelledJournalModel(f);f.scope.getJSONArray("generations").getJSONObject(0).getJSONArray("calls").getJSONObject(1).put("operation","ALARM_SET");f.refuse();
        Plan g=new Plan(false);cancelledJournalModel(g);g.scope.getJSONArray("generations").getJSONObject(0).put("record_sha256","f".repeat(64));g.refuse();
    }

}
