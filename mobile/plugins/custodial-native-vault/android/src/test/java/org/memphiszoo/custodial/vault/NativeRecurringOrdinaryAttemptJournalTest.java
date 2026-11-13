package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Actual ordinary encrypted WORK/CAS with explicit synthetic normal enrollment,
 * target response and effect-observation DATA. No native Source/18a capability,
 * OS effect, Engine receipt entry, send, Current or dispatch is constructed. */
public final class NativeRecurringOrdinaryAttemptJournalTest {
    private static final String EFFECT_SHA="e".repeat(64); // Explicit synthetic DATA, never a native18a capability.
    private static final String APPLIED="2026-10-21T12:00:00.000Z";
    private static final class Fixture {
        final NativeRetainedOwnerTest.Fixture normal;
        final NativeProviderPrincipal principal;
        final NativeRecurringTargetJournal.RetainedTargetData target;
        final NativeRecurringOrdinaryPurposeJournal.PreparedData prepared;
        final AuthorizedResponse actual;
        final NativeRecurringOrdinaryAttemptJournal journal;
        final String originalPurposeCipher;
        Fixture(boolean blocked)throws Exception {
            normal=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
            principal=NativeProviderPrincipal.fromNativeJournal(normal.principal.readFor(normal.engine.getState()));
            actual=response(principal,blocked,false);
            var request=new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]);
            target=new NativeRecurringTargetJournal(normal.work).captureActualTarget(request,actual,new NativeRecurringTargetJournal.ResponseOwner(){
                public NativeProviderPrincipal requireCurrent(){return principal;}
                public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure{if(r!=request||s!=actual)throw new VaultFailure("synthetic_original_mismatch");}
            });assertNotNull(target);
            prepared=new NativeRecurringOrdinaryPurposeJournal(normal.work).prepare(target,actual,NativeRetainedAttempt.hash(actual.body),()->{});assertNotNull(prepared);
            originalPurposeCipher=(String)normal.workDisk.memory.get(prepared.key);
            journal=new NativeRecurringOrdinaryAttemptJournal(normal.work);
        }
        byte[] body(String applied)throws Exception {
            JSONObject p=NativeRecurringOrdinaryPurposeJournal.requirePrepared(prepared.key,prepared.record),t=p.getJSONObject("target");
            return new JSONObject().put("applied_at",applied).put("authority_revision",t.get("authorityRevision"))
                .put("intent_id",p.get("intent_id")).put("rendered_digest",p.get("rendered_digest"))
                .put("target_digest",p.get("target_digest")).put("target_type",t.get("targetType")).toString().getBytes(StandardCharsets.UTF_8);
        }
        NativeRecurringOrdinaryAttemptJournal.Data begin()throws Exception {return begin(()->{});}
        NativeRecurringOrdinaryAttemptJournal.Data begin(NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws Exception {
            return journal.retainAttempt(target,prepared,actual.body,body(APPLIED),EFFECT_SHA,owner);
        }
        void mutate(String key,String raw){normal.workDisk.memory.put(key,raw);normal.workDisk.durable.put(key,raw);}
        byte[] outcome(NativeRecurringOrdinaryAttemptJournal.Data original,boolean recorded)throws Exception {
            JSONObject b=ProviderWireJson.object(original.originalBody(),16384);
            JSONObject d=new JSONObject().put("schema",NativeRecurringOrdinaryDeliveryWire.SCHEMA)
                .put("intentId",b.get("intent_id")).put("targetType",b.get("target_type")).put("authorityRevision",b.get("authority_revision"))
                .put("targetDigest",b.get("target_digest")).put("renderedDigest",b.get("rendered_digest"))
                .put("status",recorded?"RECEIPT_RECORDED":"NO_RECORDED_RECEIPT")
                .put("receiptId",recorded?"dddddddd-dddd-4ddd-8ddd-dddddddddddd":JSONObject.NULL)
                .put("appliedAt",recorded?APPLIED:JSONObject.NULL).put("receivedAt",recorded?"2026-10-21T12:00:01Z":JSONObject.NULL)
                .put("retryAuthorized",false).put("currentAuthorityNotInferred",true);
            return new JSONObject().put("ok",true).put("data",d).toString().getBytes(StandardCharsets.UTF_8);
        }
        void preparedUnchanged(){assertEquals(originalPurposeCipher,normal.workDisk.memory.get(prepared.key));assertEquals(originalPurposeCipher,normal.workDisk.durable.get(prepared.key));}
    }
    private static AuthorizedResponse response(NativeProviderPrincipal principal,boolean blocked,boolean later)throws Exception {
        JSONObject envelope=new JSONObject(NativeRecurringTargetJournalTest.SYNTHETIC_TARGET_RESPONSE),p=principal.json();
        JSONObject data=envelope.getJSONObject("data"),meta=envelope.getJSONObject("meta"),delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
        for(String name:new String[]{"employee_id","credential_id","assignment_epoch"}){data.put(name,p.get(name));meta.put(name,p.get(name));}
        data.put("canonical_device_id",p.get("device_id"));meta.put("canonical_device_id",p.get("device_id"));
        target.put("employeeId",p.get("employee_id")).put("credentialId",p.get("credential_id")).put("assignmentEpoch",p.get("assignment_epoch"));
        JSONObject view=new JSONObject().put("schema","static-weekly.recurring-render-view.v1")
            .put("service_date",target.get("serviceDate")).put("employee_id",target.get("employeeId"))
            .put("employee_name","Synthetic ordinary employee").put("publication_id",target.get("publicationId"))
            .put("projection_id",target.get("projectionId")).put("projection_status","current")
            .put("full_day",true).put("shift",JSONObject.NULL).put("raw_items",new JSONArray().put(new JSONObject()
                .put("id","synthetic-original-task").put("title","Synthetic nonempty source task").put("location","Synthetic location")));
        if(blocked){
            data.put("schedule_delivery_mode","RECURRING_TERMINAL");
            target.put("schema","static-weekly.recurring-terminal-target.v1").put("targetType","BLOCKED_RECURRING_AUTHORITY")
                .put("invalidationId","cccccccc-cccc-4ccc-8ccc-cccccccccccc").put("reasonCode","SOURCE_RETIRED");
            for(String key:new String[]{"projectionId","lunchDocumentIdentity","viewDigest"})target.remove(key);
            delivery.put("replacementCoverageReady",false).put("viewJsonText",JSONObject.NULL).put("view",JSONObject.NULL).put("viewDigest",JSONObject.NULL);
        }else{
            String text=view.toString(),digest=NativeProviderPrincipal.hash(text);
            target.put("viewDigest",digest);delivery.put("view",view).put("viewJsonText",text).put("viewDigest",digest);
        }
        var names=new java.util.ArrayList<String>();target.keys().forEachRemaining(names::add);
        names.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
        StringBuilder text=new StringBuilder("{");for(String key:names){if(text.length()>1)text.append(", ");Object value=target.get(key);
            text.append(JSONObject.quote(key)).append(": ").append(value instanceof String?JSONObject.quote((String)value):value.toString());}
        delivery.put("targetDigest",NativeProviderPrincipal.hash(text.append('}').toString()));
        return new AuthorizedResponse(200,Map.of("content-type","application/json"),((later?" ":"")+envelope).getBytes(StandardCharsets.UTF_8));
    }

    @Test public void scheduleAndBlockedPersistExactOriginalBodyBeforeAnyTransport()throws Exception {
        for(boolean blocked:new boolean[]{false,true}){Fixture f=new Fixture(blocked);var data=f.begin();
            assertArrayEquals(f.body(APPLIED),data.originalBody());assertFalse(data.retryAuthorized());assertFalse(data.receiptEligible());
            assertEquals(data.record,f.journal.readOriginal(data.key,f.principal).record);
            assertEquals(f.prepared.record,NativeRecurringOrdinaryAttemptJournal.requireData(data.key,data.record).get("prepared_record"));
            assertEquals("UNKNOWN",NativeRecurringOrdinaryAttemptJournal.requireData(data.key,data.record).getJSONObject("outcome").get("kind"));}
    }
    @Test public void laterActualWireIsRetainedSeparatelyFromFirstTargetAndPreparation()throws Exception {
        Fixture f=new Fixture(false);AuthorizedResponse later=response(f.principal,false,true);
        assertFalse(java.util.Arrays.equals(later.body,f.actual.body));
        var d=f.journal.retainAttempt(f.target,f.prepared,later.body,f.body(APPLIED),EFFECT_SHA,()->{});
        JSONObject record=NativeRecurringOrdinaryAttemptJournal.requireData(d.key,d.record),original=new JSONObject(record.getString("prepared_record"));
        assertEquals(NativeRetainedAttempt.hash(later.body),record.get("latest_native_response_sha256"));
        assertEquals(NativeRetainedAttempt.hash(f.actual.body),original.get("first_target_native_response_sha256"));
        assertEquals(NativeRetainedAttempt.hash(f.actual.body),original.get("prepared_native_response_sha256"));
        assertNotEquals(original.get("prepared_native_response_sha256"),record.get("latest_native_response_sha256"));
        assertArrayEquals(f.body(APPLIED),d.originalBody());assertEquals(d.record,f.journal.readOriginal(d.key,f.principal).record);
    }
    @Test public void bodyCopyCannotChangeTheFrozenOriginal()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();byte[] exposed=d.originalBody();exposed[0]=' ';assertArrayEquals(f.body(APPLIED),d.originalBody());
    }
    @Test public void secondBeginCannotRetrySameOrRetimestampedAttempt()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();String raw=(String)f.normal.workDisk.memory.get(d.key);
        assertThrows(VaultFailure.class,f::begin);
        assertThrows(VaultFailure.class,()->f.journal.retainAttempt(f.target,f.prepared,f.actual.body,f.body("2026-10-21T12:00:02Z"),EFFECT_SHA,()->{}));
        assertEquals(raw,f.normal.workDisk.memory.get(d.key));assertArrayEquals(f.body(APPLIED),f.journal.readOriginal(d.key,f.principal).originalBody());
    }
    @Test public void laterPollingCannotUpgradeAttemptBackToPrepared()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();assertThrows(VaultFailure.class,()->new NativeRecurringOrdinaryPurposeJournal(f.normal.work)
            .prepare(f.target,f.actual,NativeRetainedAttempt.hash(f.actual.body),()->{}));assertEquals(d.record,f.journal.readOriginal(d.key,f.principal).record);
    }
    @Test public void unrelatedOpaqueWorkIsNotDecodedDiscardedOrFrozen()throws Exception {
        Fixture f=new Fixture(false);String key="foreign-history-opaque";f.mutate(key,"UNKNOWN original bytes");var d=f.begin();
        assertEquals("UNKNOWN original bytes",f.normal.workDisk.memory.get(key));assertEquals(d.record,new NativeRecurringOrdinaryAttemptJournal(f.normal.work).readOriginal(d.key,f.principal).record);
    }
    @Test public void lostReplyAndMalformedOutcomeStayOutcomeOnlyWithoutAnotherWrite()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();String raw=(String)f.normal.workDisk.memory.get(d.key);
        assertSame(d,f.journal.recordOutcome(d,f.principal,503,new byte[0]));assertSame(d,f.journal.recordOutcome(d,f.principal,200,"{}".getBytes(StandardCharsets.UTF_8)));
        assertEquals(raw,f.normal.workDisk.memory.get(d.key));assertFalse(d.retryAuthorized());
    }
    @Test public void noRecordedReceiptNeverReauthorizesPostOrChangesAppliedAt()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();var missing=f.journal.recordOutcome(d,f.principal,200,f.outcome(d,false));
        assertEquals("NO_RECORDED_RECEIPT",NativeRecurringOrdinaryAttemptJournal.requireData(missing.key,missing.record).getJSONObject("outcome").get("kind"));
        assertArrayEquals(d.originalBody(),missing.originalBody());assertFalse(missing.retryAuthorized());assertThrows(VaultFailure.class,f::begin);
    }
    @Test public void eventualOriginalReceiptCanFollowNoRecordedWithoutNewOriginal()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();var missing=f.journal.recordOutcome(d,f.principal,200,f.outcome(d,false));
        var saved=f.journal.recordOutcome(missing,f.principal,200,f.outcome(d,true));
        assertEquals("RECEIPT_RECORDED",NativeRecurringOrdinaryAttemptJournal.requireData(saved.key,saved.record).getJSONObject("outcome").get("kind"));
        assertArrayEquals(d.originalBody(),saved.originalBody());assertFalse(saved.receiptEligible());assertFalse(saved.retryAuthorized());
    }
    @Test public void originalOutcomeDoesNotBorrowCurrentWinnerAfterTargetChanges()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();f.mutate(f.target.key,"preserved changed current target");
        var saved=f.journal.recordOutcome(d,f.principal,200,f.outcome(d,true));assertEquals(saved.record,f.journal.readOriginal(d.key,f.principal).record);
        assertEquals("preserved changed current target",f.normal.workDisk.memory.get(f.target.key));
    }
    @Test public void recordedReceiptCannotDowngradeToMissingOrChangeReceiptIdentity()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();var saved=f.journal.recordOutcome(d,f.principal,200,f.outcome(d,true));String raw=(String)f.normal.workDisk.memory.get(d.key);
        assertThrows(VaultFailure.class,()->f.journal.recordOutcome(saved,f.principal,200,f.outcome(d,false)));
        JSONObject changed=new JSONObject(new String(f.outcome(d,true),StandardCharsets.UTF_8));changed.getJSONObject("data").put("receiptId","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
        assertThrows(VaultFailure.class,()->f.journal.recordOutcome(saved,f.principal,200,changed.toString().getBytes(StandardCharsets.UTF_8)));assertEquals(raw,f.normal.workDisk.memory.get(d.key));
    }
    @Test public void mismatchingOutcomeRecordsConflictWithoutBodyChangeOrRetry()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();JSONObject wrong=new JSONObject(new String(f.outcome(d,true),StandardCharsets.UTF_8));wrong.getJSONObject("data").put("targetDigest","e".repeat(64));
        var conflict=f.journal.recordOutcome(d,f.principal,200,wrong.toString().getBytes(StandardCharsets.UTF_8));
        assertEquals("CONFLICT",NativeRecurringOrdinaryAttemptJournal.requireData(d.key,conflict.record).getJSONObject("outcome").get("kind"));assertArrayEquals(d.originalBody(),conflict.originalBody());assertFalse(conflict.retryAuthorized());
        assertSame(conflict,f.journal.recordOutcome(conflict,f.principal,200,f.outcome(d,true)));
    }
    @Test public void wrongPrincipalCannotReadOrRecordEvenUnavailableOutcome()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();JSONObject p=f.principal.json();p.put("device_id","KIOSK_09");var foreign=NativeProviderPrincipal.fromNativeJournal(p);assertFalse(f.principal.same(foreign));
        assertThrows(VaultFailure.class,()->f.journal.readOriginal(d.key,foreign));assertThrows(VaultFailure.class,()->f.journal.recordOutcome(d,foreign,503,new byte[0]));
    }
    @Test public void wrongBodyTargetAndSubmillisecondTimestampRefuseBeforeWrite()throws Exception {
        Fixture f=new Fixture(false);JSONObject wrong=new JSONObject(new String(f.body(APPLIED),StandardCharsets.UTF_8));wrong.put("target_digest","f".repeat(64));
        assertThrows(VaultFailure.class,()->f.journal.retainAttempt(f.target,f.prepared,f.actual.body,wrong.toString().getBytes(StandardCharsets.UTF_8),EFFECT_SHA,()->{}));
        assertThrows(VaultFailure.class,()->f.journal.retainAttempt(f.target,f.prepared,f.actual.body,f.body("2026-10-21T12:00:00.000001Z"),EFFECT_SHA,()->{}));f.preparedUnchanged();
    }
    @Test public void ownerRefusalBeforeSavePreservesPreparedAndUnrelatedRows()throws Exception {
        Fixture f=new Fixture(false);f.mutate("independent-work","retained");assertThrows(VaultFailure.class,()->f.begin(()->{throw new VaultFailure("synthetic owner retired");}));f.preparedUnchanged();assertEquals("retained",f.normal.workDisk.memory.get("independent-work"));
    }
    @Test public void terminalTargetMutationRefusesButSavedAttemptIsNeverRetried()throws Exception {
        Fixture f=new Fixture(false);boolean[] changed={false};
        assertThrows(VaultFailure.class,()->f.begin(()->{if(!changed[0]&&!f.originalPurposeCipher.equals(f.normal.workDisk.memory.get(f.prepared.key))){changed[0]=true;f.mutate(f.target.key,"terminal target changed");}}));
        assertTrue(changed[0]);var d=f.journal.readOriginal(f.prepared.key,f.principal);assertNotNull(d);assertArrayEquals(f.body(APPLIED),d.originalBody());assertThrows(VaultFailure.class,f::begin);
    }
    @Test public void terminalPurposeMutationPreservesUnknownRatherThanRepairing()throws Exception {
        Fixture f=new Fixture(false);boolean[] changed={false};assertThrows(VaultFailure.class,()->f.begin(()->{if(!changed[0]&&!f.originalPurposeCipher.equals(f.normal.workDisk.memory.get(f.prepared.key))){changed[0]=true;f.mutate(f.prepared.key,"terminal unknown original");}}));
        assertTrue(changed[0]);assertEquals("terminal unknown original",f.normal.workDisk.memory.get(f.prepared.key));assertThrows(VaultFailure.class,()->f.journal.readOriginal(f.prepared.key,f.principal));
    }
    @Test public void unrelatedTerminalWriteMayStaleRefuseButIsAllowedAndAttemptRetained()throws Exception {
        Fixture f=new Fixture(false);boolean[] changed={false};assertThrows(VaultFailure.class,()->f.begin(()->{if(!changed[0]&&!f.originalPurposeCipher.equals(f.normal.workDisk.memory.get(f.prepared.key))){changed[0]=true;f.mutate("independent-normal-write","not blocked");}}));
        assertTrue(changed[0]);assertEquals("not blocked",f.normal.workDisk.memory.get("independent-normal-write"));assertNotNull(f.journal.readOriginal(f.prepared.key,f.principal));
    }
    @Test public void copiedRetryFlagOrBodyCannotAlterOriginalAttemptData()throws Exception {
        Fixture f=new Fixture(false);var d=f.begin();JSONObject changed=NativeRecurringOrdinaryAttemptJournal.requireData(d.key,d.record);changed.getJSONObject("outcome").put("retry_authorized",true);
        final String invalidRetry=changed.toString();assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryAttemptJournal.restoredData(d.key,invalidRetry));
        changed=NativeRecurringOrdinaryAttemptJournal.requireData(d.key,d.record);changed.put("original_body_sha256","0".repeat(64));final String invalid=changed.toString();
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryAttemptJournal.restoredData(d.key,invalid));assertEquals(d.record,f.journal.readOriginal(d.key,f.principal).record);
    }
}
