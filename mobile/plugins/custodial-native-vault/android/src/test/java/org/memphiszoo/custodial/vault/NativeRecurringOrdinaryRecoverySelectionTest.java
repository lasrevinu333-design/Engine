package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Actual encrypted ordinary-purpose selection with explicit synthetic normal
 * enrollment/target/effect DATA. Adapter recreation is not process/Keystore proof.
 * No Runtime/Source/native capability, HTTP send or receipt authority is made. */
public final class NativeRecurringOrdinaryRecoverySelectionTest {
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

    private static java.util.Map<String,Object> snapshot(Fixture f){return new java.util.HashMap<>(f.normal.workDisk.memory);}
    @Test public void preparedExpectationIsNeverAnOriginalRecoveryAttempt()throws Exception {
        Fixture f=new Fixture(false);var before=snapshot(f);int commits=f.normal.workDisk.commits;
        var result=f.normal.work.observeOrdinaryRecoveryOriginals(f.principal);
        assertTrue(result.originalKeys.isEmpty());assertEquals(0,result.unavailable);assertFalse(result.observationUnavailable);
        assertEquals(before,f.normal.workDisk.memory);assertEquals(commits,f.normal.workDisk.commits);
    }
    @Test public void recreatedActualEncryptedAdapterFindsImmutableOriginalWithoutPostOwner()throws Exception {
        Fixture f=new Fixture(false);var original=f.begin();var before=snapshot(f);int commits=f.normal.workDisk.commits;
        var recreated=new AndroidOfflineAuthorityTimeStore(f.normal.workDisk.preferences(),f.normal.workCipher);
        var result=recreated.observeOrdinaryRecoveryOriginals(f.principal);
        assertEquals(java.util.List.of(original.key),result.originalKeys);assertEquals(0,result.unavailable);assertFalse(result.observationUnavailable);
        var recovered=recreated.readOrdinaryRecurringAttempt(result.originalKeys.get(0),f.principal);
        assertArrayEquals(original.originalBody(),recovered.originalBody());assertFalse(recovered.retryAuthorized());assertFalse(recovered.receiptEligible());
        assertEquals(before,f.normal.workDisk.memory);assertEquals(commits,f.normal.workDisk.commits);
    }
    @Test public void originalSelectionSurvivesChangedOrUnreadableCurrentTarget()throws Exception {
        Fixture f=new Fixture(false);var original=f.begin();f.mutate(f.target.key,"changed target deliberately unreadable");
        var before=snapshot(f);var result=f.normal.work.observeOrdinaryRecoveryOriginals(f.principal);
        assertEquals(java.util.List.of(original.key),result.originalKeys);assertEquals(0,result.unavailable);
        var fixedGet=NativeRecurringOrdinaryDeliveryWire.getOutcome(NativeRecurringOrdinaryDeliveryWire.original(original.originalBody()));
        assertEquals("GET",fixedGet.method);assertTrue(fixedGet.path.contains("intent_id="));
        assertFalse(fixedGet.path.contains("applied_at="));assertEquals(before,f.normal.workDisk.memory);
    }
    @Test public void sameDeviceLabelWithDifferentNativeInstallationCannotSelectOriginal()throws Exception {
        Fixture f=new Fixture(false);var original=f.begin();JSONObject json=f.principal.json();
        String other="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";assertNotEquals(json.getString("credential_operation_id"),other);
        json.put("credential_operation_id",other);var foreign=NativeProviderPrincipal.fromNativeJournal(json);assertFalse(f.principal.same(foreign));
        assertEquals(f.principal.json().getString("device_id"),foreign.json().getString("device_id"));
        var result=f.normal.work.observeOrdinaryRecoveryOriginals(foreign);assertTrue(result.originalKeys.isEmpty());
        assertEquals(0,result.unavailable);assertFalse(result.observationUnavailable);
        assertThrows(VaultFailure.class,()->f.normal.work.readOrdinaryRecurringAttempt(original.key,foreign));
    }
    @Test public void malformedOrdinaryHistoryIsExplicitAndOtherUnknownFamiliesAreUntouched()throws Exception {
        Fixture f=new Fixture(false);var original=f.begin();String bad=NativeRecurringOrdinaryPurposeJournal.PREFIX+"f".repeat(64);
        assertNotEquals(original.key,bad);f.mutate(bad,"unreadable original purpose ciphertext");
        f.mutate("TASK7_ORIGINAL_UNKNOWN_NONSTEALABLE","preserved opaque existing submission");
        f.mutate("TASK8_ORIGINAL_UNKNOWN_NONSTEALABLE","preserved opaque existing submission");
        f.mutate("MAIL_ORIGINAL_UNKNOWN_NONSTEALABLE","preserved opaque existing submission");
        var before=snapshot(f);int commits=f.normal.workDisk.commits;var result=f.normal.work.observeOrdinaryRecoveryOriginals(f.principal);
        assertEquals(java.util.List.of(original.key),result.originalKeys);assertEquals(1,result.unavailable);assertFalse(result.observationUnavailable);
        assertEquals(before,f.normal.workDisk.memory);assertEquals(before,f.normal.workDisk.durable);assertEquals(commits,f.normal.workDisk.commits);
    }
    @Test public void missingReceiptRemainsOriginalOutcomeOnlyAndRecordedReceiptIsNotPolled()throws Exception {
        Fixture f=new Fixture(false);var original=f.begin();var missing=f.journal.recordOutcome(original,f.principal,200,f.outcome(original,false));
        assertEquals(java.util.List.of(original.key),f.normal.work.observeOrdinaryRecoveryOriginals(f.principal).originalKeys);
        assertFalse(missing.retryAuthorized());assertArrayEquals(original.originalBody(),missing.originalBody());
        var recorded=f.journal.recordOutcome(missing,f.principal,200,f.outcome(original,true));
        assertTrue(f.normal.work.observeOrdinaryRecoveryOriginals(f.principal).originalKeys.isEmpty());
        assertArrayEquals(original.originalBody(),recorded.originalBody());assertFalse(recorded.retryAuthorized());
    }
    @Test public void unreadableUnrelatedPurposeDoesNotBecomeFreshCurrentTargetPrerequisite()throws Exception {
        Fixture f=new Fixture(false);String bad=NativeRecurringOrdinaryPurposeJournal.PREFIX+"e".repeat(64);
        assertNotEquals(f.prepared.key,bad);f.mutate(bad,"retained unknown other purpose");
        var observed=f.normal.work.observeOrdinaryRecoveryOriginals(f.principal);assertEquals(1,observed.unavailable);
        f.normal.work.requireOrdinaryRecurringDeliveryCurrent(f.target,f.prepared,f.actual.body,()->{});
        assertEquals("retained unknown other purpose",f.normal.workDisk.memory.get(bad));
    }
    @Test public void actualDecryptCallbackMutationCannotPublishOldSelection()throws Exception {
        Fixture f=new Fixture(false);var original=f.begin();boolean[] changed={false};
        CredentialCipher callbackCipher=new CredentialCipher(){
            public EncryptedSecret encrypt(char[] value)throws VaultFailure{return f.normal.workCipher.encrypt(value);}
            public EncryptedSecret encryptWithExistingKey(char[] value)throws VaultFailure{return f.normal.workCipher.encryptWithExistingKey(value);}
            public char[] decrypt(EncryptedSecret value)throws VaultFailure{
                char[] clear=f.normal.workCipher.decrypt(value);
                if(!changed[0]){changed[0]=true;f.mutate(original.key,"callback changed original retained ciphertext");}
                return clear;
            }
            public void destroyKey(){throw new AssertionError("read must never remove a key");}
        };
        var reopened=new AndroidOfflineAuthorityTimeStore(f.normal.workDisk.preferences(),callbackCipher);
        var result=reopened.observeOrdinaryRecoveryOriginals(f.principal);
        assertTrue(changed[0]);assertTrue(result.originalKeys.isEmpty());assertTrue(result.observationUnavailable);
        assertEquals("callback changed original retained ciphertext",f.normal.workDisk.memory.get(original.key));
    }
    @Test public void existingPurposeQuotaRefusesDiscoveryWithoutEvictionOrPromotion()throws Exception {
        Fixture f=new Fixture(false);
        for(int i=0;i<257;i++){String key=NativeRecurringOrdinaryPurposeJournal.PREFIX+String.format("%064x",i);
            assertNotEquals(f.prepared.key,key);f.mutate(key,"preserved original "+i);}
        var before=snapshot(f);var result=f.normal.work.observeOrdinaryRecoveryOriginals(f.principal);
        assertTrue(result.originalKeys.isEmpty());assertTrue(result.observationUnavailable);assertEquals(258,result.unavailable);
        assertEquals(before,f.normal.workDisk.memory);assertEquals(before,f.normal.workDisk.durable);
    }
    @Test public void selectedKeysAreImmutableDataAndNoSubmissionCanBeRetimestamped()throws Exception {
        Fixture f=new Fixture(true);var original=f.begin();var result=f.normal.work.observeOrdinaryRecoveryOriginals(f.principal);
        assertThrows(UnsupportedOperationException.class,()->result.originalKeys.add("forged key"));
        assertEquals(original.record,f.journal.readOriginal(original.key,f.principal).record);
        assertArrayEquals(f.body(APPLIED),original.originalBody());assertFalse(original.retryAuthorized());
        assertEquals(0,f.normal.opened); // Selection never constructs or invokes native HTTP.
    }
}
