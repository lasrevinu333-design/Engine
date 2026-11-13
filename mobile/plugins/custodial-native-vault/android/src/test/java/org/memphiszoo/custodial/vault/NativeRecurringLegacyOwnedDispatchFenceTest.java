package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import org.junit.Test;
/** Fixed group syntax DATA only; actual receiver/OS behavior is Android-only. */
public final class NativeRecurringLegacyOwnedDispatchFenceTest {
 @Test public void internalOwnedGroupNeverUsesTheLegacyNoGenerationLane(){
  assertTrue(CustodialNativeNotificationWriter.requiresOriginalGeneration("mz-custodial-owned:44444444-4444-4444-8444-444444444444"));
  assertTrue(CustodialNativeNotificationWriter.requiresOriginalGeneration("mz-custodial-owned:"));
  assertTrue(CustodialNativeNotificationWriter.requiresOriginalGeneration("mz-custodial-owned:malformed"));
 }
 @Test public void unrelatedLegacyGroupsRetainTheirOriginalClassification(){
  for(String group:new String[]{null,"","unrelated-legacy","mz-custodial-owned","foreign:mz-custodial-owned:x","MZ-CUSTODIAL-OWNED:x"})
   assertFalse(CustodialNativeNotificationWriter.requiresOriginalGeneration(group));
 }
}
