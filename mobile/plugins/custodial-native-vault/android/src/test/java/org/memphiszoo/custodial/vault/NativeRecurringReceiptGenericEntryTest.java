package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.Test;

/** Real generic policy/Engine refusals. No notification/receipt factory, SQL,
 * Android platform, credential, acceptance or currentness is synthesized. */
public final class NativeRecurringReceiptGenericEntryTest {
    private static final String PATH="/schedule-api/my-day-summary/delivery-receipt";
    private static final String CODE="custodial_native_schedule_application_path_refused";
    private static final String DEVICE="KIOSK_02";
    private static AuthorizedRequest request(String path,String method,String body) {
        return new AuthorizedRequest(path,method,Map.of("Content-Type","application/json"),body.getBytes(StandardCharsets.UTF_8));
    }
    private static void denied(AuthorizedRequest request) throws Exception {
        VaultFailure failure=assertThrows(VaultFailure.class,()->RequestPolicy.validate(request,DEVICE));
        assertEquals(CODE,failure.code);
    }
    @Test public void exactSixFieldReceiptNeverBecomesGenericSigningAuthority()throws Exception {
        denied(request(PATH,"POST","{\"intent_id\":\"11111111-1111-4111-8111-111111111111\",\"target_type\":\"SCHEDULE\",\"authority_revision\":1,\"target_digest\":\"original-target\",\"rendered_digest\":\"original-view\",\"applied_at\":\"2026-10-21T00:00:00Z\"}"));
    }
    @Test public void everyGenericMethodIsRefused()throws Exception {
        for(String method:new String[]{"GET","HEAD","POST","PUT","PATCH","DELETE"})
            denied(request(PATH,method,method.equals("GET")||method.equals("HEAD")?"":"{}"));
    }
    @Test public void caseQueryAndDescendantAliasesCannotReachTheReceipt()throws Exception {
        for(String path:new String[]{PATH+"?device_id="+DEVICE,PATH.toUpperCase(java.util.Locale.ROOT),
            "/schedule-api/My-Day-Summary/Delivery-Receipt",PATH+"/extra"})denied(request(path,"POST","{}"));
    }
    @Test public void noncanonicalReceiptAliasesFailBeforeAnyVaultAdmission()throws Exception {
        int[] admissions={0};
        VaultEngine engine=new VaultEngine(null,null,null,null,null,null,()->{admissions[0]++;throw new AssertionError("No vault access permitted");});
        for(String path:new String[]{PATH+"/",PATH+"#fragment",PATH.replace("schedule-api","%73chedule-api"),
            PATH.replace("my-day-summary/","my-day-summary//"),PATH.replace("my-day-summary/","my-day-summary/./"),
            "https://example.invalid"+PATH,"/schedule-api/my-day-summary%2fdelivery-receipt"})
            assertThrows(VaultFailure.class,()->engine.authorizedRequest(DEVICE,request(path,"POST","{}")));
        assertEquals(0,admissions[0]);
    }
    @Test public void copiedCallerFlagsAndBodiesCannotCreateAnAlternatePurpose()throws Exception {
        AuthorizedRequest original=request(PATH,"POST","{\"applied\":true,\"accepted\":true,\"native_owned\":true,\"notification_applied\":true}");
        denied(original);denied(new AuthorizedRequest(original.path,original.method,original.headers,original.body));
    }
    @Test public void directEngineReceiptNeverReadsOrRecoversAnyVaultState()throws Exception {
        int[] admissions={0};
        VaultEngine engine=new VaultEngine(null,null,null,null,null,null,()->{admissions[0]++;throw new AssertionError("No vault access permitted");});
        for(String device:new String[]{DEVICE,"","ANOTHER_DEVICE"}){
            VaultFailure failure=assertThrows(VaultFailure.class,()->engine.authorizedRequest(device,request(PATH,"POST","{}")));
            assertEquals(CODE,failure.code);
        }
        assertEquals(0,admissions[0]);
    }
    @Test public void normalScheduleReadAndLegacyReceiptKeepTheirExistingPolicy()throws Exception {
        for(String path:new String[]{"/schedule-api/my-day-summary?device_id="+DEVICE,
            "/schedule-api/my-day-summary/application-receipt"}){
            String method=path.contains("application-receipt")?"POST":"GET";
            AuthorizedRequest checked=RequestPolicy.validate(request(path,method,method.equals("GET")?"":"{}"),DEVICE);
            assertEquals(path,checked.path);assertEquals(method,checked.method);
        }
    }
    @Test public void normalEngineReadStillUsesOrdinaryVaultAdmission()throws Exception {
        int[] admissions={0};VaultFailure expected=new VaultFailure("ordinary_admission_sentinel");
        VaultEngine engine=new VaultEngine(null,null,null,null,null,null,()->{admissions[0]++;throw expected;});
        assertSame(expected,assertThrows(VaultFailure.class,()->engine.authorizedRequest(DEVICE,request("/schedule-api/my-day-summary","GET",""))));
        assertEquals(1,admissions[0]);
    }
}
