package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** NEW delivery source census only. All original actors, keys, prefs/disk,
 * admissions, payloads, bounds and replies are synthetic model inputs. The
 * synthetic clock profile does NOT qualify either real 0/0 release profile.
 * Fixture transitions build input before inspection, never call OS/audio/SQL.
 */
public final class NativeProviderDeliveryCensusTest {
    static final String NOW="2026-09-24T17:00:00.123457Z";
    static final class Fixture {
        final NativeVaultProviderReferenceCensusTest.Fixture f=new NativeVaultProviderReferenceCensusTest.Fixture();
        final NativeProviderJournal journal=f.old.provider;
        final NativeProviderPrincipal principal=f.old.principal;
        final NativeProviderPayload payload;
        Fixture()throws Exception{
            JSONObject p=f.old.generation.json().getJSONObject("principal");Map<String,String> data=new TreeMap<>();
            data.put("schema",NativeProviderPayload.SCHEMA);data.put("kind","employee_lunch_coverage");data.put("notification_type","lunch_coverage");
            data.put("generation_id",f.old.generation.generationId);data.put("principal_digest",f.old.generation.principalDigest);data.put("token_digest",f.old.generation.tokenDigest);
            data.put("receipt_job_id","77000000-0000-4000-8000-000000000001");
            for(String field:new String[]{"credential_id","employee_id","device_id","assignment_epoch"})data.put("receipt_"+field,String.valueOf(p.get(field)));
            data.put("notification_key","a".repeat(64));data.put("reservation_at","2026-09-24T17:00:00.123456Z");data.put("valid_until","2026-09-24T18:00:00.000000Z");
            data.put("title","Synthetic original lunch start");data.put("body","Synthetic original body, never a live message");
            data.put("channel_id","employee-lunch-coverage");data.put("route","employee-schedule.html?hub=employee");data.put("service_date","2026-09-24");
            data.put("event","start");data.put("loan_id","b".repeat(64));data.put("scheduled_time","12:00");data.put("scheduled_at","2026-09-24T17:00:00.000000Z");
            data.put("coverer_slot_id","staff-slot-2");data.put("projection_id","66000000-0000-4000-8000-000000000001");data.put("document_identity","c".repeat(64));
            data.put("content_sha256",NativeProviderPrincipal.hash(NativeProviderPayload.canonical(data,true)));
            payload=NativeProviderPayload.fromInventory(new JSONObject(data));
        }
        NativeProviderJournal.Observation at(String timestamp)throws Exception{
            return NativeProviderTimeTest.observation(timestamp==null?null:Instant.parse(timestamp),1000,7);
        }
        void arrive(String timestamp)throws Exception{journal.recordArrival(principal,payload,at(timestamp));}
        void admitted()throws Exception{arrive(NOW);}
        NativeProviderJournal.Presentation presentation()throws Exception{return journal.presentation(principal,payload.recordId);}
        void action(String action)throws Exception{journal.applyPresentationAction(principal,presentation(),action,at(NOW));}
        ProviderRecordStore.Key key(ProviderEnvelopeCrypto.Domain domain,String id){return ProviderRecordStore.key(domain,id);}
        ProviderRecordStore.Key inboxKey(){return key(ProviderEnvelopeCrypto.Domain.INBOX,payload.recordId);}
        JSONObject inbox()throws Exception{return f.record(inboxKey());}
        String eventId(String action)throws Exception{return inbox().getString(action+"_event_id");}
        JSONObject event(String action)throws Exception{return f.record(key(ProviderEnvelopeCrypto.Domain.EVENT,eventId(action)));}
        void putInbox(JSONObject value)throws Exception{f.put(inboxKey(),value);}
        void putEvent(String action,JSONObject value)throws Exception{f.put(key(ProviderEnvelopeCrypto.Domain.EVENT,eventId(action)),value);}
        void settle()throws Exception{
            var batch=journal.pendingEvents(principal,16);JSONArray receipts=new JSONArray();
            for(var event:batch.events.values())receipts.put(event.wire().put("schema",NativeProviderEventReceipts.SCHEMA).put("admitted_state","ACCEPTED")
                .put("server_received_at","2026-09-24T19:00:00.987654Z").put("replayed",false));
            var response=new AuthorizedResponse(200,Map.of("Content-Type","application/json"),new JSONObject().put("ok",true)
                .put("data",new JSONObject().put("schema","custodial.native-provider-event-receipts.v2").put("results",receipts)).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            journal.settleEvents(principal,batch,NativeProviderEventReceipts.validateResponse(batch,response));
        }
        NativeVaultProviderReferenceCensus.Observation inspect()throws Exception{
            var before=new NativeVaultProviderReferenceCensusTest.Stable(f);var value=f.inspect();before.check();
            NativeVaultProviderReferenceCensusTest.noAuthority(value);String text=value.json().toString();
            assertFalse(text.contains("Synthetic original body"));assertFalse(text.contains("display_state"));
            assertFalse(text.contains("original_observation"));assertFalse(text.contains("admission_bounds"));return value;
        }
        void terminal()throws Exception{
            admitted();action("displayed");action("audio_started");action("audio_completed");action("dismissed");
            journal.confirmMirrorRetired(principal,presentation());
            journal.confirmOsCanceled(journal.pendingOsCancellations().get(0));settle();
        }
    }
    static long count(NativeVaultProviderReferenceCensus.Observation value,String state)throws Exception{return NativeVaultProviderReferenceCensusTest.stateCount(value,state);}
    static void unresolvedGraph(NativeVaultProviderReferenceCensus.Observation value)throws Exception{
        assertTrue(count(value,"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED")>0);
        assertFalse(value.inventoryAcknowledged);assertFalse(value.keyRemovalAllowed);
    }
    @Test public void pendingInboxAndExactReceivedEventAreLocalFactsWithoutEffectOrSettlement()throws Exception{
        var x=new Fixture();x.admitted();var value=x.inspect();
        assertEquals(6,value.providerClassifiedRows);assertEquals(1,count(value,"ORIGINAL_INBOX_PAYLOAD_ACTION_AND_PENDING_EFFECT_FACTS_LOCAL_ONLY"));
        assertEquals(1,count(value,"ORIGINAL_PENDING_EVENT_GRAPH_LOCAL_ONLY"));assertEquals("PENDING_DISPLAY",x.inbox().get("display_state"));
    }
    @Test public void unknownOriginalArrivalTimeIsPreservedInQuarantineNotInventedFromWallClock()throws Exception{
        var x=new Fixture();x.arrive(null);var original=x.f.record(x.key(ProviderEnvelopeCrypto.Domain.QUARANTINE,x.payload.recordId));
        var value=x.inspect();assertEquals(5,value.providerClassifiedRows);
        assertEquals(1,count(value,"ORIGINAL_QUARANTINE_PAYLOAD_AND_OBSERVATION_LOCAL_ONLY"));
        assertTrue(original.getJSONObject("received_observation").isNull("earliest_at"));
    }
    @Test public void laterAdmissionKeepsOriginalUnknownReceivedObservationDistinctFromAdmissionBounds()throws Exception{
        var x=new Fixture();x.arrive(null);x.journal.drainQuarantine(x.principal,x.payload.recordId,x.at(NOW));
        var value=x.inspect();assertEquals(6,value.providerClassifiedRows);
        assertTrue(x.inbox().getJSONObject("received_observation").isNull("earliest_at"));
        assertTrue(x.event("received").getJSONObject("original_observation").isNull("earliest_at"));
    }
    @Test public void displayUncertaintyRemainsExactLocalIntentNotAConfirmedOsOrMirrorEffect()throws Exception{
        var x=new Fixture();x.admitted();x.journal.prepareOsDisplay(x.principal,x.presentation(),x.at(NOW));var before=x.inbox();
        var value=x.inspect();assertEquals(6,value.providerClassifiedRows);
        assertEquals("DISPLAY_UNCERTAIN",x.inbox().get("display_state"));assertTrue(x.inbox().isNull("displayed_event_id"));
        assertTrue(ProviderWireJson.same(before,x.inbox()));
    }
    @Test public void dismissAudioAndOfflineNavigationFactsCannotReplayEffectsOrCreateAcknowledge()throws Exception{
        var x=new Fixture();x.admitted();x.action("opened");x.action("audio_started");x.action("dismissed");var before=x.inbox();
        var value=x.inspect();assertEquals(7,value.providerClassifiedRows);assertTrue(x.inbox().getBoolean("navigation_pending"));
        assertEquals("IN_PROGRESS",x.inbox().get("audio_state"));assertTrue(x.inbox().isNull("acknowledged_event_id"));
        assertTrue(ProviderWireJson.same(before,x.inbox()));
    }
    @Test public void settledLocalReceiptIsMatchedToOriginalEventButNotFreshServerAcceptance()throws Exception{
        var x=new Fixture();x.admitted();x.action("displayed");x.settle();var value=x.inspect();
        assertEquals(2,count(value,"ORIGINAL_EVENT_AND_STORED_LOCAL_RECEIPT_JOINED_NOT_CURRENT_SERVER"));
        assertEquals(7,value.providerClassifiedRows);assertFalse(value.currentServerReadback);
    }
    @Test public void alteredStoredReceiptCannotBorrowValidInboxOrOtherEventAdmission()throws Exception{
        for(String field:new String[]{"content_sha256","generation_id","receipt_assignment_epoch","original_observation"}){
            var x=new Fixture();x.admitted();x.settle();var event=x.event("received");
            event.getJSONObject("admission").put(field,"wrong original receipt");x.putEvent("received",event);
            var value=x.inspect();unresolvedGraph(value);assertEquals(4,value.providerClassifiedRows);
        }
    }
    @Test public void missingReferencedReceivedEventKeepsInboxUnresolvedWithoutNewEventOrResend()throws Exception{
        var x=new Fixture();x.admitted();var store=x.f.old.providerStore.store();var snapshot=store.loadRetained();
        store.commit(snapshot.revision,Map.of(),Set.of(x.key(ProviderEnvelopeCrypto.Domain.EVENT,x.eventId("received"))));
        var value=x.inspect();unresolvedGraph(value);assertEquals(4,value.providerClassifiedRows);
    }
    @Test public void duplicateActionEventAndOrphanAreNeverSelectedOrSilentlyDeduplicated()throws Exception{
        var x=new Fixture();x.admitted();var duplicate=x.event("received");String id="55000000-0000-4000-8000-000000000001";
        duplicate.put("event_id",id);x.f.put(x.key(ProviderEnvelopeCrypto.Domain.EVENT,id),duplicate);
        var value=x.inspect();assertEquals(3,count(value,"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED"));assertEquals(4,value.providerClassifiedRows);
    }
    @Test public void changedPayloadOrOriginalObservationDoesNotNormalizeOrBorrowArguments()throws Exception{
        for(boolean body:new boolean[]{true,false}){
            var x=new Fixture();x.admitted();
            if(body){var inbox=x.inbox();inbox.getJSONObject("payload").put("body","changed original body");x.putInbox(inbox);}
            else{var event=x.event("received");event.getJSONObject("original_observation").put("elapsed_realtime_ms",1001);x.putEvent("received",event);}
            var value=x.inspect();assertEquals(4,value.providerClassifiedRows);assertTrue(value.unresolvedRows>0);
        }
    }
    @Test public void inboxAndQuarantineSameIdentityRemainConflictingNotAutomaticallyPromoted()throws Exception{
        var x=new Fixture();x.arrive(null);var original=x.f.record(x.key(ProviderEnvelopeCrypto.Domain.QUARANTINE,x.payload.recordId));
        x.journal.drainQuarantine(x.principal,x.payload.recordId,x.at(NOW));
        x.f.put(x.key(ProviderEnvelopeCrypto.Domain.QUARANTINE,x.payload.recordId),original);
        var value=x.inspect();assertEquals(3,count(value,"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED"));assertEquals(4,value.providerClassifiedRows);
    }
    @Test public void extraFieldsBooleanStringsDecimalOrdinalsAndUnknownStatesStayUnresolved()throws Exception{
        for(String field:new String[]{"unknown","navigation_pending","admission_ordinal","audio_state","display_state"}){
            var x=new Fixture();x.admitted();var inbox=x.inbox();inbox.put(field,field.equals("admission_ordinal")?1.5:"true");x.putInbox(inbox);
            var value=x.inspect();assertEquals(4,value.providerClassifiedRows);assertTrue(value.unresolvedRows>0);
        }
    }
    @Test public void savedHistoricalPointOrNullAdmittedBoundsNeverBecomeQualifiedInterval()throws Exception{
        for(int kind=0;kind<3;kind++){
            var x=new Fixture();x.admitted();var inbox=x.inbox();
            if(kind==0)inbox.remove("interval_version");if(kind==1)inbox.put("interval_version","2");
            if(kind==2)inbox.put("admission_bounds",new NativeProviderJournal.Observation(null,1000,7).json());
            x.putInbox(inbox);var value=x.inspect();assertEquals(4,value.providerClassifiedRows);assertTrue(value.unresolvedRows>0);
        }
    }
    @Test public void changedEffectEventEpochActionTargetAndBoundsCannotChangeOriginalGraph()throws Exception{
        for(String field:new String[]{"receipt_assignment_epoch","action","record_id","admission_bounds"}){
            var x=new Fixture();x.admitted();var event=x.event("received");
            event.put(field,field.equals("receipt_assignment_epoch")?7:field.equals("record_id")?"not/a/store/key":"wrong");
            x.putEvent("received",event);var value=x.inspect();assertEquals(4,value.providerClassifiedRows);
        }
    }
    @Test public void reducedTombstoneIsRetainedButDoesNotRecreateMissingPayloadOrCompleteReceiptBodies()throws Exception{
        var x=new Fixture();x.terminal();assertEquals(1,x.journal.compactSettledRecords(x.principal,x.at("2026-09-24T19:00:00.000000Z"),16));
        var value=x.inspect();assertEquals(1,count(value,"ORIGINAL_COMPACTED_DEDUPE_SUMMARY_LOCAL_ONLY_NO_RECEIPT_OR_EFFECT_AUTHORITY"));
        assertEquals(5,value.providerClassifiedRows);assertTrue(value.unresolvedRows>0);assertFalse(value.keyRemovalAllowed);
    }
    @Test public void malformedTombstoneDoesNotShortenDedupeOrDeleteAnyOriginalCapturedRow()throws Exception{
        var x=new Fixture();x.terminal();x.journal.compactSettledRecords(x.principal,x.at("2026-09-24T19:00:00.000000Z"),16);
        var key=x.key(ProviderEnvelopeCrypto.Domain.TOMBSTONE,x.payload.recordId);var tomb=x.f.record(key);tomb.put("dedupe_until",tomb.get("valid_until"));x.f.put(key,tomb);
        var value=x.inspect();assertEquals(1,count(value,"DELIVERY_RECORD_SEMANTICS_UNRESOLVED_RETAINED"));assertEquals(4,value.providerClassifiedRows);
    }
}
