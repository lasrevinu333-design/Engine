package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** Prepared host state-machine tests only. Explicit synthetic Store/principal
 * DATA, not Android alarms, a private OS Frame, browser settlement or a receipt. */
public final class NativeNotificationKnownOriginalTest {
    private static final String GROUP="mz-custodial-owned:44444444-4444-4444-8444-444444444444";
    private static final long AT=java.time.Instant.parse("2026-10-22T00:00:00.000Z").toEpochMilli();
    private static final class Fixture {
        final NativeRecurringTargetJournalTest.Store store=new NativeRecurringTargetJournalTest.Store();
        final NativeRecurringTargetJournal journal=new NativeRecurringTargetJournal(store);
        final NativeProviderPrincipal principal=NativeRecurringTargetJournalTest.principal();
        final String raw,generation;
        Fixture(int id,boolean called)throws Exception {
            raw=new JSONObject().put("id",id).put("title","Synthetic owned original").put("body","No OS effects")
                .put("group",GROUP).put("schedule",new JSONObject().put("at","2026-10-22T00:00:00.000Z"))
                .put("extra",new JSONObject().put("native_presentation_id",String.valueOf(id))
                    .put("native_presentation_principal",principal.json().toString())).toString();
            generation=journal.beforeSchedule(principal,id,raw);if(called)journal.scheduleCalled(generation);
        }
        String state()throws Exception{return new JSONObject(store.rows.values().iterator().next()).getString("state");}
    }
    private static NativeProviderPrincipal other(NativeProviderPrincipal original)throws Exception {
        JSONObject row=original.json();row.put("assignment_epoch",8);return NativeProviderPrincipal.fromNativeJournal(row);
    }
    @Test public void knownFutureRestoreKeepsOriginalGenerationBodyAndMarksAttemptBeforeEffect()throws Exception {
        var f=new Fixture(41,true);f.journal.requireRestoreCandidate(f.principal,41,f.raw,AT-1000);
        assertEquals(f.generation,f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1000));
        assertEquals("RESTORE_ATTEMPTED",f.state());f.journal.requireRestoreCurrent(f.principal,f.generation,41,f.raw,AT,AT-1);
        JSONObject row=new JSONObject(f.store.rows.values().iterator().next());assertEquals(f.raw,row.getString("raw_notification"));
        assertEquals(f.generation,row.getString("generation"));assertFalse(row.getBoolean("receipt_eligible"));
    }
    @Test public void unknownInitialScheduleNeverBecomesRestoreAttempt()throws Exception {
        var f=new Fixture(41,false);Map<String,String> original=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.requireRestoreCandidate(f.principal,41,f.raw,AT-1000));
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1000));assertEquals(original,f.store.rows);
    }
    @Test public void unknownRestoreCommitKeepsAttemptAndCannotRetrySameGeneration()throws Exception {
        var f=new Fixture(41,true);f.store.throwAfterCommit=true;
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1000));
        assertEquals("RESTORE_ATTEMPTED",f.state());Map<String,String> original=Map.copyOf(f.store.rows);f.store.throwAfterCommit=false;
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1000));assertEquals(original,f.store.rows);
    }
    @Test public void historicalCalledRestoreDataAllowsOnlySameGenerationFutureOriginal()throws Exception {
        var f=new Fixture(41,true);
        // Explicit historical DATA model only; this cannot construct the private
        // NativeNotificationOriginalFrame or qualify restoreCalled's OS producer.
        String key=f.store.rows.keySet().iterator().next();JSONObject row=new JSONObject(f.store.rows.get(key));
        f.store.rows.put(key,row.put("state","RESTORE_CALLED").toString());
        assertEquals(f.generation,f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1));assertEquals("RESTORE_ATTEMPTED",f.state());
    }
    @Test public void pastEqualOrChangedOriginalDeadlineNeverRetimesKnownRestore()throws Exception {
        var f=new Fixture(41,true);Map<String,String> original=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT,AT));
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT,AT+1));
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT+1,AT-1000));assertEquals(original,f.store.rows);
    }
    @Test public void changedOrMalformedKnownRawCannotDowngradeToUntracked()throws Exception {
        var f=new Fixture(41,true);Map<String,String> original=Map.copyOf(f.store.rows);
        for(String raw:new String[]{null,"{broken",f.raw.replace("No OS effects","Changed original")}) {
            assertThrows(VaultFailure.class,()->f.journal.beforeCancel(f.principal,41,raw));
            assertThrows(VaultFailure.class,()->f.journal.requireRestoreCandidate(f.principal,41,raw,AT-1000));
            assertThrows(VaultFailure.class,()->f.journal.beforeSchedule(f.principal,41,raw));
        }
        assertEquals(original,f.store.rows);
    }
    @Test public void wrongOrMissingPrincipalCannotAdoptKnownId()throws Exception {
        var f=new Fixture(41,true);var wrong=other(f.principal);Map<String,String> original=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.beforeCancel(wrong,41,f.raw));
        assertThrows(VaultFailure.class,()->f.journal.beforeCancel(null,41,f.raw));
        assertThrows(VaultFailure.class,()->f.journal.beforeDeliveredCancel(wrong,41,GROUP));
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(wrong,41,f.raw,AT,AT-1000));assertEquals(original,f.store.rows);
    }
    @Test public void missingGenerationOrWrongDeliveredGroupNeverDowngradesKnownId()throws Exception {
        var f=new Fixture(41,true);Map<String,String> original=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.beforeDispatch(f.principal,null,41,GROUP));
        assertThrows(VaultFailure.class,()->f.journal.requireDispatchCurrent(f.principal,null,41,GROUP));
        assertThrows(VaultFailure.class,()->f.journal.beforeDeliveredCancel(f.principal,41,"foreign"));assertEquals(original,f.store.rows);
    }
    @Test public void restoredAttemptCannotDispatchUntilActualCalledTraceExists()throws Exception {
        var f=new Fixture(41,true);f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1000);
        Map<String,String> original=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.beforeDispatch(f.principal,f.generation,41,GROUP));assertEquals(original,f.store.rows);
    }
    @Test public void terminalRestoreGuardRefusesLatePrincipalBodyDeadlineAndGenerationChanges()throws Exception {
        var f=new Fixture(41,true);f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1000);var wrong=other(f.principal);
        Map<String,String> original=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.requireRestoreCurrent(wrong,f.generation,41,f.raw,AT,AT-1));
        assertThrows(VaultFailure.class,()->f.journal.requireRestoreCurrent(f.principal,f.generation,41,f.raw,AT,AT));
        assertThrows(VaultFailure.class,()->f.journal.requireRestoreCurrent(f.principal,f.generation,41,"{}",AT,AT-1));
        assertThrows(VaultFailure.class,()->f.journal.requireRestoreCurrent(f.principal,"ffffffff-ffff-4fff-8fff-ffffffffffff",41,f.raw,AT,AT-1));
        assertEquals(original,f.store.rows);
    }
    @Test public void terminalDispatchGuardDoesNotCreateSecondAttemptAndRefusesLateChanges()throws Exception {
        var f=new Fixture(41,true);assertTrue(f.journal.beforeDispatch(f.principal,f.generation,41,GROUP));
        Map<String,String> attempted=Map.copyOf(f.store.rows);f.journal.requireDispatchCurrent(f.principal,f.generation,41,GROUP);
        assertEquals(attempted,f.store.rows);var wrong=other(f.principal);
        assertThrows(VaultFailure.class,()->f.journal.requireDispatchCurrent(wrong,f.generation,41,GROUP));
        assertThrows(VaultFailure.class,()->f.journal.requireDispatchCurrent(f.principal,f.generation,41,"foreign"));
        assertThrows(VaultFailure.class,()->f.journal.beforeDispatch(f.principal,f.generation,41,GROUP));assertEquals(attempted,f.store.rows);
    }
    @Test public void explicitKnownCancellationFencesRestoreAndQueuedDispatch()throws Exception {
        var f=new Fixture(41,true);assertEquals(f.generation,f.journal.beforeDeliveredCancel(f.principal,41,GROUP));
        assertEquals("CANCEL_ATTEMPTED",f.state());Map<String,String> original=Map.copyOf(f.store.rows);
        assertFalse(f.journal.beforeDispatch(f.principal,f.generation,41,GROUP));
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1));assertEquals(original,f.store.rows);
    }
    @Test public void explicitCancelAllJournalSetKeepsEachKnownGenerationFenced()throws Exception {
        var f=new Fixture(41,true);JSONObject second=new JSONObject(f.raw);second.put("id",42);
        second.getJSONObject("extra").put("native_presentation_id","42");String secondRaw=second.toString();
        String other=f.journal.beforeSchedule(f.principal,42,secondRaw);f.journal.scheduleCalled(other);
        assertEquals(f.generation,f.journal.beforeDeliveredCancel(f.principal,41,GROUP));
        assertEquals(other,f.journal.beforeDeliveredCancel(f.principal,42,GROUP));
        Map<String,String> attempted=Map.copyOf(f.store.rows);
        assertFalse(f.journal.beforeDispatch(f.principal,f.generation,41,GROUP));
        assertFalse(f.journal.beforeDispatch(f.principal,other,42,GROUP));assertEquals(attempted,f.store.rows);
    }
    @Test public void olderV1KnownOriginalPreservedWithoutRestoreUpgrade()throws Exception {
        var f=new Fixture(41,true);String key=f.store.rows.keySet().iterator().next();
        JSONObject row=new JSONObject(f.store.rows.get(key));row.put("schema","custodial.native-notification-mutation-data.v1");row.remove("post_effect_frame");
        f.store.rows.put(key,row.toString());Map<String,String> legacy=Map.copyOf(f.store.rows);
        assertThrows(VaultFailure.class,()->f.journal.requireRestoreCandidate(f.principal,41,f.raw,AT-1));
        assertThrows(VaultFailure.class,()->f.journal.beforeRestore(f.principal,41,f.raw,AT,AT-1));assertEquals(legacy,f.store.rows);
    }
    @Test public void genuineUnknownAndRepeatingIdsRetainUntrackedNormalPath()throws Exception {
        var store=new NativeRecurringTargetJournalTest.Store();var journal=new NativeRecurringTargetJournal(store);var p=NativeRecurringTargetJournalTest.principal();
        assertNull(journal.beforeRestore(p,42,"{foreign",Long.MIN_VALUE,AT));
        journal.requireRestoreCandidate(p,42,null,AT);journal.requireUntrackedId(42);
        JSONObject repeating=new JSONObject().put("id",42).put("group",GROUP)
            .put("extra",new JSONObject().put("native_presentation_id","42").put("native_presentation_principal",p.json().toString()))
            .put("schedule",new JSONObject().put("at","2026-10-22T00:00:00.000Z").put("repeats",true));
        assertNull(journal.beforeSchedule(p,42,repeating.toString()));
        assertNull(journal.beforeRestore(p,42,repeating.toString(),AT,AT-1));
        assertNull(journal.beforeCancel(p,42,"{foreign"));assertNull(journal.beforeDeliveredCancel(p,42,"foreign"));
        assertTrue(journal.beforeDispatch(p,null,42,null));journal.requireDispatchCurrent(p,null,42,null);assertTrue(store.rows.isEmpty());
    }
}
