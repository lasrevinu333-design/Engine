package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import org.json.JSONObject;
import org.junit.Test;

/** Descriptor DATA validation/refusal only. No synthetic value below can
 * construct the private native Frame or qualify an Android OS observation. */
public final class NativeNotificationOriginalFrameTest {
    private static final String GENERATION="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    private static JSONObject descriptor(NativeProviderPrincipal principal)throws Exception {
        return new JSONObject().put("schema","custodial.native-notification-original-frame-data.v1")
            .put("scope","RAW_VENDOR_AND_ACTIVE_IDENTITIES_NOT_SETTLEMENT").put("principal_sha256",principal.digest)
            .put("generation",GENERATION).put("raw_vendor_sha256","a".repeat(64)).put("active_identity_sha256","b".repeat(64))
            .put("raw_record_count",0).put("active_count",0).put("receipt_eligible",false);
    }
    @Test public void validDescriptorIsOnlyDataAndDoesNotConstructPrivateProducer()throws Exception {
        var principal=NativeRecurringTargetJournalTest.principal();JSONObject value=descriptor(principal);
        NativeNotificationOriginalFrame.requireDescriptor(value,principal,GENERATION);
        assertFalse(value.getBoolean("receipt_eligible"));assertEquals(1,NativeNotificationOriginalFrame.class.getDeclaredConstructors().length);
        assertTrue(java.lang.reflect.Modifier.isPrivate(NativeNotificationOriginalFrame.class.getDeclaredConstructors()[0].getModifiers()));
        assertThrows(VaultFailure.class,()->NativeNotificationOriginalFrame.capture(null,GENERATION)); // No actual held writer monitor.
    }
    @Test public void descriptorCannotUpgradeScopePrincipalCountsOrEligibility()throws Exception {
        var principal=NativeRecurringTargetJournalTest.principal();JSONObject base=descriptor(principal);
        for(String key:new String[]{"receipt_eligible","scope","principal_sha256","generation","raw_vendor_sha256","active_identity_sha256"}) {
            JSONObject changed=new JSONObject(base.toString()).put(key,key.equals("receipt_eligible")?true:"foreign");
            assertThrows(VaultFailure.class,()->NativeNotificationOriginalFrame.requireDescriptor(changed,principal,GENERATION));
        }
        for(Object count:new Object[]{-1,257,1.5,"0",Long.MAX_VALUE}) {
            JSONObject changed=new JSONObject(base.toString()).put("active_count",count);
            assertThrows(VaultFailure.class,()->NativeNotificationOriginalFrame.requireDescriptor(changed,principal,GENERATION));
        }
        JSONObject extra=new JSONObject(base.toString()).put("ready",true);
        assertThrows(VaultFailure.class,()->NativeNotificationOriginalFrame.requireDescriptor(extra,principal,GENERATION));
    }
}
