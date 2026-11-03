package org.memphiszoo.custodial.vault;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.file.*;
import java.util.*;
/** Actual source contracts and disk model only. Does not mint an installed
 * Application/HELD/private ACK or claim Android/WebView/hardware acceptance. */
public final class NativeRetainedEnrollmentLifecycleContractTest {
 @Test public void originalEncryptedStorageAndKeysSurviveRestartAndAnotherPartition()throws Exception {
  String base=System.getProperty("custodial.custody.fixture.root");assertNotNull(base);
  Path parent=Path.of(base).getParent().resolve("retained-storage-"+UUID.randomUUID());
  NativeRetainedEnrollmentRealmStoreTest.main(new String[]{parent.toString()});
 }
 @Test public void fixedEightNamespacesAreIsolatedWithoutChangingOtherSdkPreferences(){
  String realm="12345678-1234-4234-8234-123456789abc";
  String[] names={"MemphisZooCustodialNativeProviderV1","MemphisZooCustodialNativeVaultV1","MemphisZooCustodialNativeVaultV2",
   "MemphisZooCustodialOfflineAuthorityTimeV1","MemphisZooCustodialRetainedAttemptV1","MemphisZooCustodialRetainedBatchV1",
   "MemphisZooCustodialRetainedReadQueryV1","WSSecureStorageSharedPreferences"};
  for(String name:names){assertEquals(name,CustodialEnrollmentApplication.preferenceName(name,"legacy"));
   assertEquals(name+".retained-realm-"+realm,CustodialEnrollmentApplication.preferenceName(name,realm));}
  for(String name:new String[]{"FirebaseMessaging","unrelated-sdk","unknown-original-name"})assertEquals(name,CustodialEnrollmentApplication.preferenceName(name,realm));
  assertEquals("custodial_assignment_"+realm,CustodialEnrollmentApplication.browserSuffix(realm));
  for(String value:new String[]{"../legacy","",realm.toUpperCase(),"legacy"})try{CustodialEnrollmentApplication.browserSuffix(value);fail("foreign browser partition accepted");}catch(IllegalArgumentException expected){}
 }
 @Test public void newMaintenanceRequiresAnIdentifiedExternalSenderBeforeTheSeparateOsDumpGate(){
  assertFalse(RetainedEnrollmentMaintenanceReceiver.permitsOriginalSender(35,-1,10020,true));
  assertFalse(RetainedEnrollmentMaintenanceReceiver.permitsOriginalSender(35,10020,10020,true));
  assertFalse(RetainedEnrollmentMaintenanceReceiver.permitsOriginalSender(33,2000,10020,true));
  assertFalse(RetainedEnrollmentMaintenanceReceiver.permitsOriginalSender(35,2000,10020,false));
  assertTrue(RetainedEnrollmentMaintenanceReceiver.permitsOriginalSender(35,2000,10020,true));
 }
 @Test public void durableCommandKeepsTheOriginalSubMillisecondClockObservation()throws Exception {
  long now=java.time.Instant.parse("2026-11-01T00:00:00Z").toEpochMilli();
  assertEquals("2026-11-01T00:00:00.000123Z",NativeOriginalInventorySeparationApprovalWire.originalCommandObservationInstant(now,123999,now));
  assertEquals("2026-11-01T00:00:00.002000Z",NativeOriginalInventorySeparationApprovalWire.originalCommandObservationInstant(now,123999,now+2));
  try{NativeOriginalInventorySeparationApprovalWire.originalCommandObservationInstant(now,-1,now);fail("negative monotonic time accepted");}catch(VaultFailure expected){}
 }
 @Test public void retainedV2DataBoundariesAndV3DurableCommandAttributionRemainClosed()throws Exception {
  for(String name:new String[]{"roundtrip","structure","parser","integrity","bindings","terminal","durable"})
   NativeOriginalInventoryFinalizationIntentDataTest.main(new String[]{"--case="+name});
 }
}
