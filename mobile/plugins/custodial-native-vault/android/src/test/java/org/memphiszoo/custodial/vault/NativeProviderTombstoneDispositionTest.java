package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;

/** NEW synthetic source semantics only. Owning compaction constructs test
 * inputs before inspection, not real persisted/OS/server evidence. No removed
 * payload or full receipt is reconstructed; all authority stays false. */
public final class NativeProviderTombstoneDispositionTest {
    static final String SUMMARY="ORIGINAL_COMPACTED_DEDUPE_SUMMARY_LOCAL_ONLY_NO_RECEIPT_OR_EFFECT_AUTHORITY";
    static final class Fixture {
        final NativeProviderDeliveryCensusTest.Fixture x=new NativeProviderDeliveryCensusTest.Fixture();
        final JSONObject inbox,event;
        final ProviderRecordStore.Key key;
        Fixture()throws Exception{
            x.terminal();inbox=x.inbox();event=x.event("received");
            assertEquals(1,x.journal.compactSettledRecords(x.principal,x.at("2026-09-24T19:00:00.000000Z"),16));
            key=x.key(ProviderEnvelopeCrypto.Domain.TOMBSTONE,x.payload.recordId);
        }
        JSONObject tomb()throws Exception{return x.f.record(key);}
        void put(JSONObject row)throws Exception{x.f.put(key,row);}
        void replaceIdentity(JSONObject row)throws Exception{
            String id=NativeProviderPrincipal.hash(row.getString("generation_id")+"\n"+row.getString("receipt_job_id")+"\n"+row.getString("notification_key"));
            row.put("record_id",id);char[] clear=row.toString().toCharArray();var store=x.f.old.providerStore.store();
            try{store.commit(store.loadRetained().revision,Map.of(x.key(ProviderEnvelopeCrypto.Domain.TOMBSTONE,id),clear),Set.of(key));}
            finally{java.util.Arrays.fill(clear,'\0');}
        }
        NativeVaultProviderReferenceCensus.Observation inspect()throws Exception{
            var value=x.inspect();String json=value.json().toString();
            assertFalse(json.contains("Synthetic original body"));assertFalse(json.contains("server_received_at"));
            assertFalse(value.completeNamespaceInventory);assertFalse(value.currentServerReadback);
            assertFalse(value.inventoryAcknowledged);assertFalse(value.workAccepted);assertFalse(value.keyRemovalAllowed);assertFalse(value.phoneReleased);
            assertFalse(value.json().getBoolean("clock_profile_qualified"));assertFalse(value.json().getBoolean("resend_allowed"));
            assertFalse(value.json().getBoolean("finalizer_allowed"));return value;
        }
        void unresolved()throws Exception{assertEquals(0,NativeProviderDeliveryCensusTest.count(inspect(),SUMMARY));}
    }
    @Test public void exactOwningTwoAdmissionSummaryIsKnownLocalDispositionWithoutInventedDeletedValues()throws Exception{
        var f=new Fixture();var original=f.tomb();assertEquals(14,original.length());assertEquals(2,original.getJSONArray("admissions").length());
        assertFalse(original.has("payload"));assertFalse(original.has("admission"));
        assertEquals(1,NativeProviderDeliveryCensusTest.count(f.inspect(),SUMMARY));
        assertTrue(ProviderWireJson.same(original,f.tomb()));
    }
    @Test public void threeAndFourAdmissionSummariesPreserveOptionalActionsNotFreshAcknowledgment()throws Exception{
        for(boolean acknowledged:new boolean[]{false,true}){
            var x=new NativeProviderDeliveryCensusTest.Fixture();x.admitted();x.action("displayed");x.action("audio_started");x.action("audio_completed");
            x.action("opened");x.action("navigation_completed");if(acknowledged)x.action("acknowledged");x.action("dismissed");
            x.journal.confirmMirrorRetired(x.principal,x.presentation());x.journal.confirmOsCanceled(x.journal.pendingOsCancellations().get(0));x.settle();
            assertEquals(1,x.journal.compactSettledRecords(x.principal,x.at("2026-09-24T19:00:00.000000Z"),16));
            var tomb=x.f.record(x.key(ProviderEnvelopeCrypto.Domain.TOMBSTONE,x.payload.recordId));
            assertEquals(acknowledged?4:3,tomb.getJSONArray("admissions").length());
            var value=x.inspect();assertEquals(1,NativeProviderDeliveryCensusTest.count(value,SUMMARY));
            assertFalse(value.currentServerReadback);assertFalse(value.inventoryAcknowledged);assertFalse(value.keyRemovalAllowed);
        }
    }
    @Test public void foreignTokenDigestCannotBorrowAnOtherwiseVerifiedOriginalGeneration()throws Exception{
        var f=new Fixture();var row=f.tomb();row.put("token_digest","d".repeat(64));f.put(row);f.unresolved();
    }
    @Test public void missingGenerationRemainsUnknownRatherThanUsingAnotherCaptureOrCurrentActor()throws Exception{
        var f=new Fixture();var row=f.tomb();row.put("generation_id","77000000-0000-4000-8000-000000000099");f.replaceIdentity(row);f.unresolved();
    }
    @Test public void foreignFullPrincipalAndNoncanonicalNotificationIdentityStayUnknown()throws Exception{
        for(boolean principal:new boolean[]{true,false}){
            var f=new Fixture();var row=f.tomb();
            if(principal){row.getJSONObject("principal").put("assignment_epoch",8);f.put(row);}
            else{row.put("notification_key","not a native notification digest");f.replaceIdentity(row);}f.unresolved();
        }
    }
    @Test public void extraPayloadOrFullAdmissionFieldCannotTurnSummaryIntoOriginalCompleteReceipt()throws Exception{
        for(String field:new String[]{"payload","admission","unknown"}){
            var f=new Fixture();var row=f.tomb();row.put(field,new JSONObject().put("body","SYNTHETIC_NOT_ORIGINAL"));f.put(row);f.unresolved();
        }
    }
    @Test public void malformedDuplicateAdmissionActionOrIdCannotGrantSummaryDisposition()throws Exception{
        for(String field:new String[]{"action","event_id","server_received_at","extra"}){
            var f=new Fixture();var row=f.tomb();var a=row.getJSONArray("admissions");
            a.getJSONObject(1).put(field,field.equals("extra")?"unsupported":field.equals("server_received_at")?"unknown":a.getJSONObject(0).get(field));
            f.put(row);f.unresolved();
        }
    }
    @Test public void historicalMissingOrStringIntervalNeverUpgradesToAcceptedSummary()throws Exception{
        for(boolean missing:new boolean[]{true,false}){
            var f=new Fixture();var row=f.tomb();if(missing)row.remove("interval_version");else row.put("interval_version","2");f.put(row);f.unresolved();
        }
    }
    @Test public void survivingValidOrMalformedInboxDeniesTheCompactedIdentity()throws Exception{
        for(boolean malformed:new boolean[]{false,true}){
            var f=new Fixture();var row=new JSONObject(f.inbox.toString());if(malformed)row.remove("record_id");
            f.x.f.put(f.x.inboxKey(),row);f.unresolved();
        }
    }
    @Test public void survivingQuarantineEvenWithBrokenPayloadDeniesCompactedIdentity()throws Exception{
        var f=new Fixture();f.x.f.put(f.x.key(ProviderEnvelopeCrypto.Domain.QUARANTINE,f.x.payload.recordId),new JSONObject().put("interval_version",2));f.unresolved();
    }
    @Test public void orphanHistoricalEventForSameRecordDeniesSummaryWithoutRecreatingInbox()throws Exception{
        var f=new Fixture();var row=new JSONObject(f.event.toString());row.remove("interval_version");
        row.put("event_id","55000000-0000-4000-8000-000000000019");
        f.x.f.put(f.x.key(ProviderEnvelopeCrypto.Domain.EVENT,row.getString("event_id")),row);f.unresolved();
    }
    @Test public void survivingAdmissionEventKeyDeniesSummaryEvenWhenRowClaimsAnotherRecord()throws Exception{
        var f=new Fixture();String id=f.tomb().getJSONArray("admissions").getJSONObject(0).getString("event_id");
        f.x.f.put(f.x.key(ProviderEnvelopeCrypto.Domain.EVENT,id),new JSONObject().put("record_id","e".repeat(64)));f.unresolved();
    }
    @Test public void duplicateReducedEventIdentityAcrossTwoSummariesDeniesBothNotJustLatest()throws Exception{
        var f=new Fixture();var second=f.tomb();String job="77000000-0000-4000-8000-000000000002";
        String id=NativeProviderPrincipal.hash(f.x.payload.generationId+"\n"+job+"\n"+second.getString("notification_key"));
        second.put("receipt_job_id",job).put("record_id",id);f.x.f.put(f.x.key(ProviderEnvelopeCrypto.Domain.TOMBSTONE,id),second);f.unresolved();
    }
    @Test public void summaryDispositionDoesNotEvaluateOrShortenStoredFutureDedupeDeadline()throws Exception{
        var f=new Fixture();var row=f.tomb();row.put("valid_until","2036-09-24T18:00:00.000000Z").put("dedupe_until","2036-09-26T18:00:00.000000Z");f.put(row);
        assertEquals(1,NativeProviderDeliveryCensusTest.count(f.inspect(),SUMMARY));assertTrue(ProviderWireJson.same(row,f.tomb()));
    }
}
