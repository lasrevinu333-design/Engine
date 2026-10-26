package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Field;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** Actual Engine/journal/normal WORK adapter under the existing synthetic
 * enrolled-native fixture. Transport, cipher and principals are explicit TEST
 * DATA; this does not authenticate HTTPS, Android OS or a receipt purpose.
 * Reflection below READS private DATA only. No field/constructor is written or
 * invoked and no production accessor/admission flag is added. */
public final class NativeRecurringTargetEngineDataTest {
    private enum Fault { NONE, LATER_WIRE, TERMINAL_BODY, TERMINAL_VAULT, SECOND_NETWORK }
    private static final class Fixture {
        final Fault fault;
        final NativeRetainedOwnerTest.Fixture original;
        final VaultEngine engine;
        final NativeProviderPrincipal principal;
        AuthorizedResponse actualResponse;
        int exchanges,terminalCallbacks;
        Fixture(Fault fault)throws Exception {
            this.fault=fault; // Select fault BEFORE this fresh synthetic original.
            original=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
            principal=NativeProviderPrincipal.fromNativeJournal(original.principal.readFor(original.engine.getState()));
            VaultPersistence persistence=new VaultPersistence(){
                public VaultSnapshot load()throws VaultFailure {
                    // Test-only causal hook at the actual LAST direct Engine
                    // capture load, not an invented currentness callback/API.
                    StackTraceElement caller=null;
                    for(var frame:Thread.currentThread().getStackTrace())if(frame.getClassName().startsWith(VaultEngine.class.getName())){caller=frame;break;}
                    if(caller!=null&&caller.getClassName().equals(VaultEngine.class.getName())
                        &&caller.getMethodName().equals("captureRecurringTargetData")){
                        terminalCallbacks++;
                        if(fault==Fault.TERMINAL_BODY)actualResponse.body[0]=' ';
                        if(fault==Fault.TERMINAL_VAULT)try{original.bumpVault();}catch(Exception failure){throw new VaultFailure("synthetic_terminal_vault_change",failure);}
                    }
                    return original.persistence.load();
                }
                public void commit(long revision,VaultSnapshot next)throws VaultFailure{original.persistence.commit(revision,next);}
            };
            EnrollmentTransport transport=new EnrollmentTransport(){
                public EnrollmentResult enroll(EnrollmentRequest r,char[] c)throws VaultFailure{return original.enrollment.enroll(r,c);}
                public TerminalResult confirm(String o,String d,char[] c)throws VaultFailure{return original.enrollment.confirm(o,d,c);}
                public TerminalResult cancel(String o,String d,char[] c)throws VaultFailure{return original.enrollment.cancel(o,d,c);}
                public TerminalResult remove(String o,String d,char[] c)throws VaultFailure{return original.enrollment.remove(o,d,c);}
                public String verifyLegacyIdentity(String d,char[] c)throws VaultFailure{return original.enrollment.verifyLegacyIdentity(d,c);}
                public ActiveCredentialStatus verifyActiveCredential(String d,String id,char[] c)throws VaultFailure{return original.enrollment.verifyActiveCredential(d,id,c);}
                public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] c)throws VaultFailure{
                    original.enrollment.authorized(r,d,c); // Existing synthetic credential validator.
                    exchanges++;
                    if(fault==Fault.SECOND_NETWORK&&exchanges==2)throw new VaultFailure("synthetic_target_read_lost");
                    try {actualResponse=response(principal,fault==Fault.LATER_WIRE&&exchanges>1);return actualResponse;}
                    catch(Exception malformed){throw new VaultFailure("synthetic_target_response",malformed);}
                }
            };
            engine=new VaultEngine(persistence,original.vaultCipher,transport,new FakeLegacySource(),new TestSealGenerator(),original.clock,original.work);
        }
        AuthorizedResponse read()throws VaultFailure {
            return engine.authorizedRequest("KIOSK_08",new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]));
        }
        Object holder()throws Exception{return privateData(engine,"recurringAuthenticatedTargetData");}
        Map<String,String> rows()throws VaultFailure{return Map.copyOf(original.work.recurringRecords());}
        void wiped(){original.wiped();}
    }
    private static Object privateData(Object original,String name)throws Exception {
        Field field=original.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(original);
    }
    private static AuthorizedResponse response(NativeProviderPrincipal principal,boolean laterWire)throws Exception {
        JSONObject envelope=new JSONObject(NativeRecurringTargetJournalTest.SYNTHETIC_TARGET_RESPONSE),p=principal.json();
        JSONObject data=envelope.getJSONObject("data"),meta=envelope.getJSONObject("meta"),delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
        for(String name:new String[]{"employee_id","credential_id","assignment_epoch"}){data.put(name,p.get(name));meta.put(name,p.get(name));}
        data.put("canonical_device_id",p.getString("device_id"));meta.put("canonical_device_id",p.getString("device_id"));
        target.put("employeeId",p.get("employee_id")).put("credentialId",p.get("credential_id")).put("assignmentEpoch",p.get("assignment_epoch"));
        // Existing exact flat PG jsonb serializer recipe, not a target verifier.
        java.util.List<String> keys=new java.util.ArrayList<>();target.keys().forEachRemaining(keys::add);
        keys.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
        StringBuilder text=new StringBuilder("{");for(String key:keys){if(text.length()>1)text.append(", ");text.append(JSONObject.quote(key)).append(": ");Object value=target.get(key);text.append(value instanceof String?JSONObject.quote((String)value):value.toString());}text.append('}');
        delivery.put("targetDigest",NativeProviderPrincipal.hash(text.toString()));
        return new AuthorizedResponse(200,Map.of("content-type","application/json"),((laterWire?" ":"")+envelope).getBytes(StandardCharsets.UTF_8));
    }
    @Test public void actualEngineBirthKeepsOriginalRecordAndNeverGrantsGenericReceipt()throws Exception {
        var f=new Fixture(Fault.NONE);assertNull(f.holder());var response=f.read();Object holder=f.holder();assertNotNull(holder);
        assertSame(f.engine,privateData(holder,"owner"));assertEquals(NativeRetainedAttempt.hash(response.body),privateData(holder,"actualNativeResponseSha256"));
        Object retained=privateData(holder,"originalTarget");String key=(String)privateData(retained,"key"),record=(String)privateData(retained,"record");
        assertTrue("Original retained DATA differs",record.equals(f.rows().get(key)));assertFalse(new JSONObject(record).getBoolean("receipt_eligible"));
        assertEquals(1,f.terminalCallbacks);int before=f.exchanges;
        assertThrows(VaultFailure.class,()->f.engine.authorizedRequest("KIOSK_08",new AuthorizedRequest("/schedule-api/my-day-summary/delivery-receipt","POST",Map.of("Content-Type","application/json"),"{}".getBytes(StandardCharsets.UTF_8))));
        assertEquals(before,f.exchanges);f.wiped();
    }
    @Test public void laterActualNativeBodyAndFirstDurableBodyStayDistinct()throws Exception {
        var f=new Fixture(Fault.LATER_WIRE);var first=f.read();String firstSha=NativeRetainedAttempt.hash(first.body);var before=f.rows();
        var later=f.read();Object holder=f.holder(),retained=privateData(holder,"originalTarget");String record=(String)privateData(retained,"record");
        assertNotEquals(firstSha,NativeRetainedAttempt.hash(later.body));assertEquals(NativeRetainedAttempt.hash(later.body),privateData(holder,"actualNativeResponseSha256"));
        assertEquals(firstSha,new JSONObject(record).getString("native_authorized_response_sha256"));assertTrue(before.equals(f.rows()));assertEquals(2,f.terminalCallbacks);f.wiped();
    }
    @Test public void lastActualPersistenceCallbackBodyMutationRefusesBirthAndRetainsOriginals()throws Exception {
        var f=new Fixture(Fault.TERMINAL_BODY);assertThrows(VaultFailure.class,f::read);assertEquals(1,f.terminalCallbacks);assertNull(f.holder());
        assertEquals(2,f.rows().size());for(String row:f.rows().values())assertFalse(new JSONObject(row).getBoolean("receipt_eligible"));f.wiped();
    }
    @Test public void lastActualPersistenceCallbackVaultRevisionWithdrawalRefusesBirth()throws Exception {
        var f=new Fixture(Fault.TERMINAL_VAULT);assertThrows(VaultFailure.class,f::read);assertEquals(1,f.terminalCallbacks);assertNull(f.holder());assertEquals(2,f.rows().size());f.wiped();
    }
    @Test public void newFailedTargetReadCannotBorrowEarlierHolderOrResendReceipt()throws Exception {
        var f=new Fixture(Fault.SECOND_NETWORK);f.read();assertNotNull(f.holder());var before=f.rows();assertThrows(VaultFailure.class,f::read);
        assertNull(f.holder());assertTrue(before.equals(f.rows()));assertEquals(2,f.exchanges);f.wiped();
    }
}
