package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

/** NEW pure source guard only. No Android context/editor/keystore, credential
 * decryption, real alias, migration or phone action occurs. Model maps are
 * synthetic; before/after checks are NOT a durable cross-writer/ABA freeze. */
public final class LegacyCleanupSnapshotGuardTest {
    static final String ALIAS="capacitor-storage_memphis_zoo_custodial_device_credential";
    interface Action{void run()throws Exception;}
    static void denied(Action action)throws Exception{try{action.run();fail("must preserve and refuse");}catch(VaultFailure error){assertEquals("custodial_native_legacy_cleanup_failed",error.code);}}
    static Map<String,Object> first(){return new HashMap<>(Map.of("credential_ciphertext","SYNTHETIC_OPAQUE","credential_iv","SYNTHETIC_IV",
        "installation_active",true,"installation_record","SYNTHETIC_RECORD"));}
    static Map<String,Object> second(){return new HashMap<>(Map.of(ALIAS,"SYNTHETIC_OPAQUE_SEPARATED_VALUE"));}
    @Test public void unknownFirstPartyRowStopsBeforeAnyCleanupAndOriginalMapsAreUnchanged()throws Exception{
        var v1=first();var secure=second();v1.put("unknown-protected-original",23L);var before=new HashMap<>(v1);
        denied(()->LegacyCleanupSnapshotGuard.capture(v1,secure));assertEquals(before,v1);assertEquals(second(),secure);
    }
    @Test public void unknownSecureStorageRowRetainsAllOriginalAliasesAndReferences()throws Exception{
        var v1=first();var secure=second();secure.put("other-plugin-original",true);var before=new HashMap<>(secure);
        denied(()->LegacyCleanupSnapshotGuard.capture(v1,secure));assertEquals(first(),v1);assertEquals(before,secure);
    }
    @Test public void everyKnownFirstPartyStringAndBooleanFieldIsRecognizedWithoutParsingSecrets()throws Exception{
        var v1=first();for(String key:new String[]{"pending_operation_id","pending_device_id","removal_operation_id","blocked_reason","legacy_seal"})v1.put(key,"");
        v1.put("removal_remote_complete",false);var original=LegacyCleanupSnapshotGuard.capture(v1,second());
        original.requireOriginal(v1,second());assertEquals(v1.keySet(),original.originalV1Keys());
    }
    @Test public void wrongKnownTypesAndUnknownCaseVariantsNeverBecomeCleanupEligible()throws Exception{
        for(String fault:new String[]{"boolean_string","cipher_set","wrong_alias_case","null_key"}){
            var v1=first();var secure=second();if(fault.equals("boolean_string"))v1.put("installation_active","true");
            if(fault.equals("cipher_set"))v1.put("credential_ciphertext",java.util.Set.of("SYNTHETIC"));
            if(fault.equals("wrong_alias_case"))secure.put(ALIAS.toUpperCase(java.util.Locale.ROOT),"SYNTHETIC");
            if(fault.equals("null_key"))v1.put(null,"SYNTHETIC");
            denied(()->LegacyCleanupSnapshotGuard.capture(v1,secure));
        }
    }
    @Test public void changedKnownOriginalValueFailsRecheckWithoutNormalizingOrRebinding()throws Exception{
        var v1=first();var secure=second();var original=LegacyCleanupSnapshotGuard.capture(v1,secure);
        v1.put("credential_ciphertext","DIFFERENT_SYNTHETIC_ORIGINAL");denied(()->original.requireOriginal(v1,secure));
        assertEquals("DIFFERENT_SYNTHETIC_ORIGINAL",v1.get("credential_ciphertext"));
    }
    @Test public void originalCaptureDoesNotFollowLaterCallerMapMutation()throws Exception{
        var v1=first();var secure=second();var original=LegacyCleanupSnapshotGuard.capture(v1,secure);v1.clear();secure.clear();
        denied(()->original.requireOriginal(v1,secure));assertFalse(original.originalV1Keys().isEmpty());
    }
    @Test public void lateFirstPartyUnknownRowAfterScopedRemovalStopsBeforeSecureOrKeys()throws Exception{
        var original=LegacyCleanupSnapshotGuard.capture(first(),second());var late=new HashMap<String,Object>();late.put("late-unknown-original",31L);
        denied(()->original.requireAfterV1(late,second()));assertEquals(31L,late.get("late-unknown-original"));
    }
    @Test public void changedSecureOriginalAfterFirstRemovalStopsBeforeSecureCleanup()throws Exception{
        var original=LegacyCleanupSnapshotGuard.capture(first(),second());var changed=second();changed.put(ALIAS,"CHANGED_SYNTHETIC_OPAQUE");
        denied(()->original.requireAfterV1(Map.of(),changed));assertEquals("CHANGED_SYNTHETIC_OPAQUE",changed.get(ALIAS));
    }
    @Test public void readbackRetainedKnownOrUnknownRowsStopBeforeKeyAccess()throws Exception{
        var original=LegacyCleanupSnapshotGuard.capture(first(),second());
        denied(()->original.requireEmpty(first(),Map.of()));denied(()->original.requireEmpty(Map.of(),second()));
        denied(()->original.requireEmpty(Map.of(),Map.of("unknown-other-reference","SYNTHETIC")));
    }
    @Test public void exactKnownRemovalReadbackAndEmptyLayoutDoNotCreateGlobalKeyAuthority()throws Exception{
        var original=LegacyCleanupSnapshotGuard.capture(first(),second());original.requireOriginal(first(),second());
        original.requireAfterV1(Map.of(),second());original.requireEmpty(Map.of(),Map.of());
        var empty=LegacyCleanupSnapshotGuard.capture(Map.of(),Map.of());assertTrue(empty.originalV1Keys().isEmpty());empty.requireEmpty(Map.of(),Map.of());
        // Only structural source checks returned: no capability, key handle,
        // credential, server acceptance or inventory ACK exists in this API.
        for(var method:LegacyCleanupSnapshotGuard.Captured.class.getDeclaredMethods())assertNotEquals("keyRemovalAllowed",method.getName());
    }
}
