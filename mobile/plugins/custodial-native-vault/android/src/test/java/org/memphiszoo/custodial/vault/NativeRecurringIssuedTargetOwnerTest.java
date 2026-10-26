package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Field;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** Actual Engine+Journal, existing synthetic enrollment/WORK/cipher fixture.
 * Tests only issued/completed DATA ownership and ordinary response behavior.
 * No Android Runtime/Source/WORK lease/effect/receipt authority is qualified.
 * Reflection READ only, no constructor invocation or field writes. */
public final class NativeRecurringIssuedTargetOwnerTest {
    private enum Fault { NONE, OVERLAP_SUCCESS, OVERLAP_ERROR, OVERLAP_CANCELLED, OVERLAP_403, OLDER_MALFORMED, TERMINAL_BODY }
    private static final class Fixture {
        final NativeRetainedOwnerTest.Fixture original;
        final VaultEngine engine;final NativeProviderPrincipal principal;final Fault fault;
        int exchanges,terminalCallbacks;AuthorizedResponse nestedResponse,actualResponse;VaultFailure nestedFailure;
        Object nestedHolder,nestedIssue;AuthorizedRequest actualRequest;
        Fixture(Fault fault)throws Exception {
            this.fault=fault;original=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
            principal=NativeProviderPrincipal.fromNativeJournal(original.principal.readFor(original.engine.getState()));
            VaultPersistence persistence=new VaultPersistence(){
                public VaultSnapshot load()throws VaultFailure {
                    StackTraceElement caller=null;
                    for(var frame:Thread.currentThread().getStackTrace())if(frame.getClassName().startsWith(VaultEngine.class.getName())){caller=frame;break;}
                    if(caller!=null&&caller.getClassName().equals(VaultEngine.class.getName())&&caller.getMethodName().equals("captureRecurringTargetData")){
                        terminalCallbacks++;if(fault==Fault.TERMINAL_BODY)actualResponse.body[0]=' ';
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
                public AuthorizedResponse authorized(AuthorizedRequest request,String device,char[] credential)throws VaultFailure {
                    original.enrollment.authorized(request,device,credential); // Existing explicit TEST credential validator.
                    int ordinal=++exchanges;actualRequest=request;
                    if(ordinal==2&&(fault==Fault.OVERLAP_ERROR||fault==Fault.OVERLAP_CANCELLED))throw new VaultFailure(fault==Fault.OVERLAP_ERROR?"synthetic_network_lost":"synthetic_read_cancelled");
                    try {
                        if(ordinal==1&&fault!=Fault.NONE&&fault!=Fault.TERMINAL_BODY){
                            try{nestedResponse=read();}catch(VaultFailure refused){nestedFailure=refused;}
                            nestedHolder=holder();nestedIssue=issue();
                        }
                        if(ordinal==2&&fault==Fault.OVERLAP_403)actualResponse=new AuthorizedResponse(403,Map.of("content-type","application/json"),"{\"ok\":false}".getBytes(StandardCharsets.UTF_8));
                        else if(ordinal==1&&fault==Fault.OLDER_MALFORMED)actualResponse=new AuthorizedResponse(200,Map.of(),"{broken".getBytes(StandardCharsets.UTF_8));
                        else actualResponse=response(principal,ordinal>1);
                        return actualResponse;
                    }catch(VaultFailure refused){throw refused;}catch(Exception malformed){throw new VaultFailure("synthetic_native_response",malformed);}
                }
            };
            engine=new VaultEngine(persistence,original.vaultCipher,transport,new FakeLegacySource(),new TestSealGenerator(),original.clock,original.work);
        }
        AuthorizedResponse read()throws VaultFailure{return engine.authorizedRequest("KIOSK_08",new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]));}
        Object holder()throws Exception{return data(engine,"recurringAuthenticatedTargetData");}
        Object issue()throws Exception{return data(engine,"recurringIssuedTargetRead");}
        Map<String,String> rows()throws VaultFailure{return Map.copyOf(original.work.recurringRecords());}
    }
    private static Object data(Object owner,String key)throws Exception{Field f=owner.getClass().getDeclaredField(key);f.setAccessible(true);return f.get(owner);}
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

    @Test public void normalResponseCapturesActualIssuedBirthBeforeAnyNativeHoldExists()throws Exception {
        var f=new Fixture(Fault.NONE);var r=f.read();Object holder=f.holder(),issue=f.issue();assertNotNull(holder);
        assertSame(issue,data(holder,"originalIssue"));assertSame(f.engine,data(issue,"owner"));assertSame(f.actualRequest,data(issue,"originalRequest"));
        assertEquals(Boolean.TRUE,data(issue,"completed"));assertEquals(Boolean.FALSE,data(issue,"failed"));assertEquals(Boolean.FALSE,data(holder,"claimed"));
        assertSame(r,data(holder,"actualResponse"));assertEquals(NativeRetainedAttempt.hash(r.body),data(holder,"actualNativeResponseSha256"));
        assertEquals(200,r.status);assertEquals(1,f.exchanges);f.original.wiped();
    }
    @Test public void overlappingNewerCompletedReadCannotBeReplacedByOlderLateResponse()throws Exception {
        var f=new Fixture(Fault.OVERLAP_SUCCESS);var outer=f.read();
        assertEquals(2,f.exchanges);assertEquals(200,outer.status);assertEquals(200,f.nestedResponse.status);
        assertSame(f.nestedHolder,f.holder());assertSame(f.nestedIssue,f.issue());assertSame(f.nestedResponse,data(f.holder(),"actualResponse"));
        assertNotEquals(NativeRetainedAttempt.hash(outer.body),data(f.holder(),"actualNativeResponseSha256"));
        Object target=data(f.holder(),"originalTarget");assertEquals(NativeRetainedAttempt.hash(f.nestedResponse.body),new JSONObject((String)data(target,"record")).getString("native_authorized_response_sha256"));
        assertEquals(2,f.terminalCallbacks);f.original.wiped();
    }
    @Test public void newerOriginalNetworkErrorLeavesNoEligibilityDespiteOlderSuccessfulBody()throws Exception{assertNewerFailure(Fault.OVERLAP_ERROR,"synthetic_network_lost");}
    @Test public void newerOriginalCancellationLeavesNoEligibilityDespiteOlderSuccessfulBody()throws Exception{assertNewerFailure(Fault.OVERLAP_CANCELLED,"synthetic_read_cancelled");}
    private static void assertNewerFailure(Fault fault,String code)throws Exception {
        var f=new Fixture(fault);var outer=f.read();assertEquals(200,outer.status);assertNotNull(f.nestedFailure);assertEquals(code,f.nestedFailure.code);
        assertNull(f.holder());assertSame(f.nestedIssue,f.issue());assertEquals(Boolean.TRUE,data(f.issue(),"failed"));assertEquals(2,f.exchanges);
        assertEquals(2,f.rows().size());f.original.wiped(); // Old authenticated DATA preserved, never promoted.
    }
    @Test public void newer403BodyAndStatusAreUnchangedAndOlderResponseCannotSupplyTarget()throws Exception {
        var f=new Fixture(Fault.OVERLAP_403);var outer=f.read();assertEquals(200,outer.status);assertEquals(403,f.nestedResponse.status);
        assertEquals("{\"ok\":false}",new String(f.nestedResponse.body,StandardCharsets.UTF_8));assertNull(f.holder());assertSame(f.nestedIssue,f.issue());
        assertEquals(Boolean.TRUE,data(f.issue(),"completed"));assertEquals(Boolean.FALSE,data(f.issue(),"failed"));assertEquals(2,f.exchanges);f.original.wiped();
    }
    @Test public void olderMalformedResponseStillRefusesWithoutClobberingNewerValidHolder()throws Exception {
        var f=new Fixture(Fault.OLDER_MALFORMED);assertThrows(VaultFailure.class,f::read);assertNotNull(f.nestedHolder);assertSame(f.nestedHolder,f.holder());
        assertSame(f.nestedIssue,f.issue());assertEquals(2,f.exchanges);f.original.wiped();
    }
    @Test public void lastActualBodyMutationKeepsOriginalJournalButNoEligibleCompletion()throws Exception {
        var f=new Fixture(Fault.TERMINAL_BODY);assertThrows(VaultFailure.class,f::read);assertNull(f.holder());assertEquals(Boolean.TRUE,data(f.issue(),"failed"));
        assertEquals(2,f.rows().size());assertEquals(1,f.exchanges);f.original.wiped();
    }
    @Test public void missingActualRuntimeAndSourceCannotConsumeActualTargetData()throws Exception {
        var f=new Fixture(Fault.NONE);f.read();Object before=f.holder();
        assertThrows(VaultFailure.class,()->f.engine.claimRecurringCompletionRead(null,null));
        assertSame(before,f.holder());assertEquals(Boolean.FALSE,data(before,"claimed"));assertEquals(1,f.exchanges);f.original.wiped();
    }
    @Test public void genericReceiptStillRefusesBeforeTransportOrOwnershipTransfer()throws Exception {
        var f=new Fixture(Fault.NONE);f.read();Object before=f.holder();
        assertThrows(VaultFailure.class,()->f.engine.authorizedRequest("KIOSK_08",new AuthorizedRequest("/schedule-api/my-day-summary/delivery-receipt","POST",Map.of("Content-Type","application/json"),"{}".getBytes(StandardCharsets.UTF_8))));
        assertEquals(1,f.exchanges);assertSame(before,f.holder());assertEquals(Boolean.FALSE,data(before,"claimed"));f.original.wiped();
    }
}
