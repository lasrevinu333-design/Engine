package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** Actual new Journal/encrypted WORK adapter + bounded sequence DATA.
 * Enrollment/keys/preferences/HTTPS are the maintained synthetic host fixture.
 * No Runtime, Source/frame, Notification, native-call token or semantic OS
 * positive is fabricated here. Genuine withdrawal/OS checks require Android. */
public final class NativeRecurringOrdinaryEffectProducerDataTest {
    private static final String DAY="2026-10-21";
    private static final class Fixture {
        final NativeRetainedOwnerTest.Fixture normal;
        final NativeProviderPrincipal principal;
        final AndroidOfflineAuthorityTimeStore work;
        final NativeRecurringTargetJournal journal;
        final NativeRecurringTargetJournal.RetainedTargetData target;
        java.util.function.Consumer<String> onDecrypt=value->{};
        Fixture()throws Exception {
            normal=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
            principal=NativeProviderPrincipal.fromNativeJournal(normal.principal.readFor(normal.engine.getState()));
            CredentialCipher cipher=new CredentialCipher(){
                public EncryptedSecret encrypt(char[] value)throws VaultFailure{return normal.workCipher.encrypt(value);}
                public EncryptedSecret encryptWithExistingKey(char[] value)throws VaultFailure{return normal.workCipher.encryptWithExistingKey(value);}
                public char[] decrypt(EncryptedSecret value)throws VaultFailure {
                    char[] clear=normal.workCipher.decrypt(value);
                    try{onDecrypt.accept(new String(clear));return clear;}
                    catch(RuntimeException failure){VaultValidation.wipe(clear);throw failure;}
                }
                public void destroyKey(){throw new AssertionError("No key lifecycle change in this DATA test");}
            };
            work=new AndroidOfflineAuthorityTimeStore(normal.workDisk.preferences(),cipher);journal=new NativeRecurringTargetJournal(work);
            JSONObject envelope=new JSONObject(NativeRecurringTargetJournalTest.SYNTHETIC_TARGET_RESPONSE),p=principal.json();
            JSONObject data=envelope.getJSONObject("data"),meta=envelope.getJSONObject("meta"),delivery=data.getJSONObject("recurring_delivery"),t=delivery.getJSONObject("target");
            for(String key:new String[]{"employee_id","credential_id","assignment_epoch"}){data.put(key,p.get(key));meta.put(key,p.get(key));}
            data.put("canonical_device_id",p.get("device_id"));meta.put("canonical_device_id",p.get("device_id"));
            t.put("employeeId",p.get("employee_id")).put("credentialId",p.get("credential_id")).put("assignmentEpoch",p.get("assignment_epoch"));
            var names=new java.util.ArrayList<String>();t.keys().forEachRemaining(names::add);names.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
            StringBuilder text=new StringBuilder("{");for(String key:names){if(text.length()>1)text.append(", ");Object value=t.get(key);text.append(JSONObject.quote(key)).append(": ").append(value instanceof String?JSONObject.quote((String)value):value.toString());}
            delivery.put("targetDigest",NativeProviderPrincipal.hash(text.append('}').toString()));
            AuthorizedRequest request=new AuthorizedRequest("/schedule-api/my-day-summary","GET",Map.of(),new byte[0]);
            AuthorizedResponse response=new AuthorizedResponse(200,Map.of(),envelope.toString().getBytes(StandardCharsets.UTF_8));
            target=journal.captureActualTarget(request,response,new NativeRecurringTargetJournal.ResponseOwner(){
                public NativeProviderPrincipal requireCurrent(){return principal;}
                public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure{if(r!=request||s!=response)throw new VaultFailure("synthetic_response_owner_mismatch");}
            });assertNotNull(target);
        }
        String raw(int id,String day)throws Exception {
            return new JSONObject().put("id",id).put("title","Synthetic DATA only").put("body","No OS action")
                .put("group","mz-custodial-owned:44444444-4444-4444-8444-444444444444")
                .put("extra",new JSONObject().put("native_presentation_id",String.valueOf(id)).put("native_presentation_principal",principal.json().toString())
                    .put("service_date",day).put("schedule_authority_revision",1)).toString();
        }
        String generation(int id)throws Exception {return journal.beforeSchedule(principal,id,raw(id,DAY));}
        String key(String generation)throws Exception {return NativeRecurringTargetJournal.MUTATION_PREFIX+NativeProviderPrincipal.hash(generation);}
        void change(String key){normal.workDisk.memory.put(key,"preserved_callback_change");normal.workDisk.durable.put(key,"preserved_callback_change");}
    }
    @Test public void actualEncryptedScopeBindsExactGenerationTargetAndNoReceipt()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41);int commits=f.normal.workDisk.commits;
        var row=f.journal.readKnownEffect(f.principal,DAY,generation);
        assertEquals(41,row.id);assertEquals(generation,row.generation);assertEquals(f.target.key,row.targetReference);
        assertEquals(f.target.record,row.targetText);assertEquals(f.raw(41,DAY),row.rawNotification);
        assertEquals("SCHEDULE_ATTEMPTED",row.state);assertFalse(new JSONObject(row.recordText).getBoolean("receipt_eligible"));
        assertEquals(commits,f.normal.workDisk.commits);f.normal.workCipher.wiped();
    }
    @Test public void birthCanBeTakenOnceOnlyUnderActualWriterMonitor()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41);
        assertThrows(IllegalStateException.class,()->f.journal.takeOriginalEffectBirth(generation));
        synchronized(CustodialNativeNotificationWriter.class){var born=f.journal.takeOriginalEffectBirth(generation);assertNotNull(born);
            assertTrue(born.sameOriginal(f.journal.readKnownEffect(f.principal,DAY,generation)));assertNull(f.journal.takeOriginalEffectBirth(generation));}
    }
    @Test public void reloadedJournalDoesNotReconstructNativeBirthFromRetainedData()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41);var restarted=new NativeRecurringTargetJournal(f.work);
        assertNotNull(restarted.readKnownEffect(f.principal,DAY,generation));
        synchronized(CustodialNativeNotificationWriter.class){assertNull(restarted.takeOriginalEffectBirth(generation));}
    }
    @Test public void committedButThrownBirthDoesNotPublishAHandoff()throws Exception {
        var store=new NativeRecurringTargetJournalTest.Store();store.throwAfterCommit=true;var journal=new NativeRecurringTargetJournal(store);
        NativeProviderPrincipal p=NativeRecurringTargetJournalTest.principal();
        // No target reference => no ordinary handoff, regardless of known raw row.
        String raw=new JSONObject().put("id",41).put("group","mz-custodial-owned:44444444-4444-4444-8444-444444444444")
            .put("extra",new JSONObject().put("native_presentation_id","41").put("native_presentation_principal",p.json().toString())).toString();
        assertThrows(VaultFailure.class,()->journal.beforeSchedule(p,41,raw));assertEquals(1,store.rows.size());
        String generation=new JSONObject(store.rows.values().iterator().next()).getString("generation");
        synchronized(CustodialNativeNotificationWriter.class){assertNull(journal.takeOriginalEffectBirth(generation));}
    }
    @Test public void exactRelevantRawMutationRefusesAndIsNeverRestored()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41),key=f.key(generation);f.change(key);
        assertThrows(VaultFailure.class,()->f.journal.readOrdinaryEffectScope(f.principal,DAY));assertEquals("preserved_callback_change",f.normal.workDisk.memory.get(key));
    }
    @Test public void missingOrChangedLinkedTargetCannotBorrowMutationIdentity()throws Exception {
        Fixture f=new Fixture();f.generation(41);f.change(f.target.key);
        assertThrows(VaultFailure.class,()->f.journal.readOrdinaryEffectScope(f.principal,DAY));assertEquals("preserved_callback_change",f.normal.workDisk.memory.get(f.target.key));
    }
    @Test public void oldOwnerAndOtherDayDoNotJoinRequestedRelevantSet()throws Exception {
        Fixture f=new Fixture();f.generation(41);JSONObject foreign=f.principal.json();foreign.put("assignment_epoch",8);
        assertTrue(f.journal.readOrdinaryEffectScope(NativeProviderPrincipal.fromNativeJournal(foreign),DAY).isEmpty());
        assertTrue(f.journal.readOrdinaryEffectScope(f.principal,"2026-10-22").isEmpty());
    }
    @Test public void unrelatedUnreadableWorkAndViewAreNotDecodedOrFrozen()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41);String view=NativeRecurringTargetJournal.VIEW_PREFIX+"f".repeat(64);
        f.change("unrelated-nfc-original");f.change(view);var before=new HashMap<>(f.normal.workDisk.memory);
        assertNotNull(f.journal.readKnownEffect(f.principal,DAY,generation));assertEquals(before,f.normal.workDisk.memory);
    }
    @Test public void finalTargetDecryptCallbackCannotReplaceEarlierDecodedMutation()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41),key=f.key(generation);int[] calls={0};
        f.onDecrypt=text->{if(text.contains("custodial.native-recurring-authenticated-target-data.v2")&&++calls[0]==1)f.change(key);};
        assertThrows(VaultFailure.class,()->f.journal.readKnownEffect(f.principal,DAY,generation));assertEquals(1,calls[0]);
        assertEquals("preserved_callback_change",f.normal.workDisk.memory.get(key));f.normal.workCipher.wiped();
    }
    @Test public void finalCallbackUnrelatedWriteMayStaleReadButIsNotBlocked()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41);int[] calls={0};
        f.onDecrypt=text->{if(text.contains("custodial.native-recurring-authenticated-target-data.v2")&&++calls[0]==1)f.change("unrelated-nfc-original");};
        assertThrows(VaultFailure.class,()->f.journal.readKnownEffect(f.principal,DAY,generation));f.onDecrypt=text->{};
        assertNotNull(f.journal.readKnownEffect(f.principal,DAY,generation));assertEquals("preserved_callback_change",f.normal.workDisk.memory.get("unrelated-nfc-original"));
    }
    @Test public void storeWithoutAtomicAdapterCannotPretendSequentialReadsAreEnough()throws Exception {
        var store=new NativeRecurringTargetJournalTest.Store();var journal=new NativeRecurringTargetJournal(store);
        assertThrows(VaultFailure.class,()->journal.readOrdinaryEffectScope(NativeRecurringTargetJournalTest.principal(),DAY));
    }
    @Test public void actualChangedOriginalCannotReuseEarlierBornBinding()throws Exception {
        Fixture f=new Fixture();String generation=f.generation(41);NativeRecurringTargetJournal.BornEffect born;
        synchronized(CustodialNativeNotificationWriter.class){born=f.journal.takeOriginalEffectBirth(generation);}
        assertNotNull(born);var original=f.journal.readKnownEffect(f.principal,DAY,generation);assertTrue(born.sameOriginal(original));
        assertThrows(VaultFailure.class,()->f.journal.beforeSchedule(f.principal,41,f.raw(41,DAY)));
    }
    @Test public void successfulCallReturnIsNotTerminalUntilAllNormalCallbacksFinish()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();var call=sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY);
        assertThrows(VaultFailure.class,()->sequence.requireSettled(sequence.revision()));sequence.returned(call);
        assertThrows(VaultFailure.class,()->sequence.requireSettled(sequence.revision()));sequence.terminal();sequence.requireSettled(sequence.revision());
    }
    @Test public void duplicateReturnPoisonsGenerationWithoutStartingAnotherCall()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();var call=sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY);sequence.returned(call);
        assertThrows(VaultFailure.class,()->sequence.returned(call));assertThrows(VaultFailure.class,sequence::terminal);
    }
    @Test public void foreignSequenceStepCannotSettleAnOriginal()throws Exception {
        var a=new NativeRecurringOrdinaryEffectProducer.Sequence();var b=new NativeRecurringOrdinaryEffectProducer.Sequence();var call=a.before(NativeRecurringOrdinaryEffectProducer.Operation.ALARM_EXACT);
        assertThrows(VaultFailure.class,()->b.returned(call));assertThrows(VaultFailure.class,()->a.requireSettled(a.revision()));
    }
    @Test public void callbackMutationInvalidatesEarlierTerminalRead()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();var call=sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.ALARM_SET);
        sequence.returned(call);sequence.terminal();long before=sequence.revision();sequence.changed();
        assertThrows(VaultFailure.class,()->sequence.requireSettled(before));
    }
    @Test public void thrownOrUnresolvedCallRemainsUnknownAfterLaterCallbacks()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_ALARM);
        assertThrows(VaultFailure.class,sequence::terminal);assertThrows(VaultFailure.class,()->sequence.requireSettled(sequence.revision()));
    }
    @Test public void unrelatedSequenceCanProceedWithoutFreezingOriginal()throws Exception {
        var a=new NativeRecurringOrdinaryEffectProducer.Sequence();var call=a.before(NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY);a.returned(call);a.terminal();long original=a.revision();
        var unrelated=new NativeRecurringOrdinaryEffectProducer.Sequence();var other=unrelated.before(NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_NOTIFICATION);unrelated.returned(other);unrelated.terminal();a.requireSettled(original);
    }
    @Test public void unknownCannotBeResetByAPostedOrLaterReturn()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();var call=sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY);sequence.unknown();
        assertThrows(VaultFailure.class,()->sequence.returned(call));assertThrows(VaultFailure.class,sequence::terminal);
    }
    @Test public void boundedCallHistoryNeverEvictsAnUnknownOriginal()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();for(int n=0;n<32;n++){var call=sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_NOTIFICATION);sequence.returned(call);}
        assertThrows(VaultFailure.class,()->sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY));assertThrows(VaultFailure.class,sequence::terminal);
    }
    @Test public void calledScheduleWithoutActualAlarmCannotBorrowEarlierCancellation()throws Exception {
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryEffectProducer.requireCallCoverage("SCHEDULE_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_ALARM));
        NativeRecurringOrdinaryEffectProducer.requireCallCoverage("SCHEDULE_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.ALARM_EXACT);
    }
    @Test public void dispatchNeedsNotifyAndRestoreNeedsOriginalAlarmReturn()throws Exception {
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryEffectProducer.requireCallCoverage("DISPATCH_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.ALARM_SET));
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryEffectProducer.requireCallCoverage("RESTORE_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY));
        NativeRecurringOrdinaryEffectProducer.requireCallCoverage("DISPATCH_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY);
        NativeRecurringOrdinaryEffectProducer.requireCallCoverage("RESTORE_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.ALARM_SET_IDLE);
    }
    @Test public void attemptedOrUnknownStateNeverUpgradesARealCallReturn()throws Exception {
        for(String state:new String[]{"SCHEDULE_ATTEMPTED","DISPATCH_ATTEMPTED","CANCEL_ATTEMPTED","UNKNOWN"})
            assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryEffectProducer.requireCallCoverage(state,NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY));
        assertThrows(VaultFailure.class,()->NativeRecurringOrdinaryEffectProducer.requireCallCoverage("CANCEL_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY));
        NativeRecurringOrdinaryEffectProducer.requireCallCoverage("CANCEL_CALLED",NativeRecurringOrdinaryEffectProducer.Operation.CANCEL_NOTIFICATION);
    }

    @Test public void failedPendingIntentFactoryCannotReuseAnEarlierTerminalRevision()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();var notify=sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.NOTIFY);
        sequence.returned(notify);sequence.terminal();long old=sequence.revision();sequence.requireSettled(old);
        sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.PENDING_INTENT_FACTORY);
        // Actual getActivity/getBroadcast throws or no matching record returns.
        assertThrows(VaultFailure.class,()->sequence.requireSettled(sequence.revision()));
        assertThrows(VaultFailure.class,sequence::terminal);assertThrows(VaultFailure.class,()->sequence.requireReadOnly(old));
    }
    @Test public void matchingFactoryReturnStillRequiresNewNormalTerminalCallbacks()throws Exception {
        var sequence=new NativeRecurringOrdinaryEffectProducer.Sequence();var factory=sequence.before(NativeRecurringOrdinaryEffectProducer.Operation.PENDING_INTENT_FACTORY);
        sequence.returned(factory);assertThrows(VaultFailure.class,()->sequence.requireSettled(sequence.revision()));
        sequence.terminal();sequence.requireSettled(sequence.revision());
        assertThrows(VaultFailure.class,()->sequence.returned(factory));
    }
    @Test public void pendingFactoryTokenHasNoPublicOrPackageConstructor()throws Exception {
        var constructors=NativeRecurringOrdinaryEffectProducer.PendingCreation.class.getDeclaredConstructors();assertEquals(1,constructors.length);
        assertTrue(java.lang.reflect.Modifier.isPrivate(constructors[0].getModifiers()));
        assertTrue(java.lang.reflect.Modifier.isPrivate(CustodialNativeNotificationWriter.SemanticIntent.class.getDeclaredConstructors()[0].getModifiers()));
    }

}
