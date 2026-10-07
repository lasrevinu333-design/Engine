package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

public final class NativeSeparationTransportTest {
    interface Hook { void run() throws Exception; }
    static final class Store implements NativePrincipalJournal.Store {
        String value; public String loadPrincipal(){return value;} public void savePrincipal(String value){this.value=value;}
    }
    static final class Fixture {
        final MutableClock clock=new MutableClock(1800000000000L);
        final TestCipher cipher=new TestCipher(); final MemoryPersistence persistence=new MemoryPersistence();
        final Store store=new Store();final NativePrincipalJournal principal=new NativePrincipalJournal(store);
        final FakeTransport original=new FakeTransport(clock); final VaultEngine engine;
        int calls;char[] transportedCredential;AuthorizedRequest request;Hook hook=()->{};JSONObject returned;
        Fixture()throws Exception{
            EnrollmentTransport transport=(EnrollmentTransport)Proxy.newProxyInstance(EnrollmentTransport.class.getClassLoader(),new Class<?>[]{EnrollmentTransport.class},(proxy,method,args)->{
                if(method.getName().equals("authorized")){
                    calls++;request=(AuthorizedRequest)args[0];transportedCredential=(char[])args[2];hook.run();
                    return NativeSeparationContextTest.response(NativeSeparationContextTest.envelope(returned));
                }
                try{return method.invoke(original,args);}catch(InvocationTargetException error){throw error.getCause();}
            });
            engine=new VaultEngine(persistence,cipher,transport,new FakeLegacySource(),new TestSealGenerator(),clock);
            String operation=NativeSeparationContextTest.id(4);
            engine.enroll(operation,"KIOSK_08","enrollment","12345678".toCharArray());engine.completeLocalBinding(operation);engine.confirmEnrollment(operation);
            capture(NativeSeparationContextTest.id(2),7);
            returned=NativeSeparationContextTest.data().put("credential_id",engine.getState().get("active_credential_id"));
        }
        void capture(String employee,long epoch)throws Exception{
            Map<String,Object> state=engine.getState();
            JSONObject data=new JSONObject().put("authenticated",true).put("canonical_device_id","KIOSK_08")
                .put("employee_id",employee).put("assignment_epoch",epoch).put("credential_id",state.get("active_credential_id"));
            principal.capture(state,new AuthorizedRequest("/device-auth/status","GET",Map.of(),new byte[0]),
                NativeSeparationContextTest.response(NativeSeparationContextTest.envelope(data)));
        }
        NativeSeparationContext read()throws VaultFailure{return engine.readNativeSeparationContext(principal,null);}
        void wiped(){assertNotNull(transportedCredential);assertTrue(Arrays.equals(new char[transportedCredential.length],transportedCredential));}
    }
    @Test public void typedRequestBindsActualProtectedCredentialAndPreservesState()throws Exception{
        Fixture f=new Fixture();var before=f.engine.getState();String originalPrincipal=f.store.value;
        var value=f.read();assertEquals(1,f.calls);assertEquals(NativeSeparationContext.PATH,f.request.path);assertEquals("GET",f.request.method);
        assertEquals(0,f.request.body.length);assertEquals(Map.of("Accept","application/json"),f.request.headers);
        assertEquals(before,f.engine.getState());assertEquals(originalPrincipal,f.store.value);assertTrue(value.same(f.read()));f.wiped();
        assertFalse(value.json().getBoolean("new_work_allowed"));assertFalse(value.json().getBoolean("phone_released"));
    }
    @Test public void noPrincipalMeansNoTransport()throws Exception{
        Fixture f=new Fixture();f.store.value=null;NativeSeparationContextTest.denied(()->f.read());assertEquals(0,f.calls);
    }
    @Test public void changedPrincipalWhileHttpInFlightCannotBind()throws Exception{
        Fixture f=new Fixture();f.hook=()->f.capture(NativeSeparationContextTest.id(99),8);
        NativeSeparationContextTest.denied(()->f.read());assertEquals(1,f.calls);f.wiped();
        assertEquals(NativeSeparationContextTest.id(99),f.principal.readFor(f.engine.getState()).getString("employee_id"));
    }
    @Test public void changedVaultRevisionWhileHttpInFlightCannotBind()throws Exception{
        Fixture f=new Fixture();f.hook=()->f.engine.removeEnrollment(NativeSeparationContextTest.id(77),"KIOSK_08");
        try{f.read();fail();}catch(VaultFailure expected){assertEquals("custodial_native_vault_concurrent_change",expected.code);}f.wiped();
    }
    @Test public void failedTransportWipesCredentialAndPreservesPrincipal()throws Exception{
        Fixture f=new Fixture();String prior=f.store.value;f.hook=()->{throw new VaultFailure("synthetic_network_failure");};
        try{f.read();fail();}catch(VaultFailure expected){assertEquals("synthetic_network_failure",expected.code);}f.wiped();assertEquals(prior,f.store.value);
    }
    @Test public void actualHttpsAuthoritySeamValidatesOriginalBytesBeforeAnyScrub()throws Exception{
        Fixture f=new Fixture();NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(f.principal.readFor(f.engine.getState()));
        JSONObject statusData=new JSONObject().put("authenticated",true).put("enrollment_required",false).put("recovery_required",false)
            .put("policy_mode","enforce").put("requested_device_id","KIOSK_08").put("canonical_device_id","KIOSK_08")
            .put("device_name","KIOSK_08").put("employee_name","A").put("employee_id",principal.json().getString("employee_id"))
            .put("assignment_epoch",principal.json().getLong("assignment_epoch")).put("employee_role","Custodian")
            .put("credential_id",principal.json().getString("credential_id")).put("credential_expires_at","2027-01-01T00:00:00Z");
        byte[] raw=new JSONObject().put("ok",true).put("data",statusData).toString().getBytes(StandardCharsets.UTF_8);
        AuthorizedRequest statusRequest=new AuthorizedRequest(NativeActivePrincipalStatus.PATH,"GET",Map.of("Accept","application/json"),new byte[0]);
        HttpsEnrollmentTransport.HttpResult ok=new HttpsEnrollmentTransport.HttpResult(200,Map.of("Content-Type",java.util.List.of("application/json")),raw);
        AuthorizedResponse exact=HttpsEnrollmentTransport.authorizedResponse(statusRequest,ok,"not-the-wire-secret".toCharArray());
        assertArrayEquals(raw,exact.body);NativeActivePrincipalStatus.require(statusRequest,exact,principal);

        byte[] malformed=raw.clone();byte[] marker="\"employee_name\":\"A\"".getBytes(StandardCharsets.UTF_8);int at=indexOf(malformed,marker);
        assertTrue(at>=0);malformed[at+marker.length-2]=(byte)0x80;
        try{HttpsEnrollmentTransport.authorizedResponse(statusRequest,
            new HttpsEnrollmentTransport.HttpResult(200,Map.of("Content-Type",java.util.List.of("application/json")),malformed),
            "not-the-wire-secret".toCharArray());fail();}catch(VaultFailure expected){assertEquals("custodial_provider_wire_json_invalid",expected.code);}

        AuthorizedRequest contextRequest=new AuthorizedRequest(NativeSeparationContext.PATH,"GET",Map.of("Accept","application/json"),new byte[0]);
        byte[] contextRaw=NativeSeparationContextTest.envelope(f.returned).toString().getBytes(StandardCharsets.UTF_8);
        AuthorizedResponse context=HttpsEnrollmentTransport.authorizedResponse(contextRequest,
            new HttpsEnrollmentTransport.HttpResult(200,Map.of("Content-Type",java.util.List.of("application/json")),contextRaw),
            "not-the-wire-secret".toCharArray());
        assertArrayEquals(contextRaw,context.body);NativeSeparationContext.fromAuthenticatedResponse(contextRequest,context,principal);
    }
    @Test public void authoritySeamRejectsAmbiguousJsonAndCredentialEcho()throws Exception{
        AuthorizedRequest request=new AuthorizedRequest(NativeActivePrincipalStatus.PATH,"GET",Map.of(),new byte[0]);
        String[] invalid={"{\"ok\":true,\"ok\":true,\"data\":{}}","{'ok':true,'data':{}}","{ok:true,data:{}}","{\"ok\":true,\"data\":{},}"};
        for(String source:invalid)try{
            HttpsEnrollmentTransport.authorizedResponse(request,new HttpsEnrollmentTransport.HttpResult(200,Map.of(),source.getBytes(StandardCharsets.UTF_8)),"secret".toCharArray());fail(source);
        }catch(VaultFailure expected){assertEquals("custodial_provider_wire_json_invalid",expected.code);}
        byte[] leaked="{\"ok\":true,\"data\":{\"credential\":\"secret\"}}".getBytes(StandardCharsets.UTF_8);
        try{HttpsEnrollmentTransport.authorizedResponse(request,new HttpsEnrollmentTransport.HttpResult(200,Map.of(),leaked),"secret".toCharArray());fail();}
        catch(VaultFailure expected){assertEquals("custodial_native_secret_response_refused",expected.code);}
    }
    private static int indexOf(byte[] value,byte[] needle){
        outer:for(int i=0;i<=value.length-needle.length;i++){for(int j=0;j<needle.length;j++)if(value[i+j]!=needle[j])continue outer;return i;}return-1;
    }

    @Test public void ordinaryWebViewPolicyCannotInvokeTypedRoute()throws Exception{
        try{RequestPolicy.validate(new AuthorizedRequest(NativeSeparationContext.PATH,"GET",Map.of(),new byte[0]),"KIOSK_08");fail();}
        catch(VaultFailure expected){assertEquals("custodial_native_path_refused",expected.code);}
    }
    @Test public void originalLegacyInstallationReadsWithoutReenrollmentOrWorkChanges()throws Exception{
        NativeLegacyLineageJournalTest.Fixture f=new NativeLegacyLineageJournalTest.Fixture(true);
        f.activate(NativeLegacyLineageJournalTest.OP);f.finish(NativeLegacyLineageJournalTest.OP);
        byte[] before=new VaultSnapshotCodec().encode(f.persistence.current());
        var journalBefore=new java.util.HashMap<>(f.store.records);
        EncryptedSecret saved=f.cipher.encryptWithExistingKey("protected original cleaning draft".toCharArray());
        final char[][] transported={null};final int[] calls={0};
        EnrollmentTransport transport=(EnrollmentTransport)Proxy.newProxyInstance(EnrollmentTransport.class.getClassLoader(),new Class<?>[]{EnrollmentTransport.class},(proxy,method,args)->{
            if(method.getName().equals("authorized")){
                calls[0]++;transported[0]=(char[])args[2];
                assertEquals(NativeLegacyLineageJournalTest.OLD,new String(transported[0]));
                JSONObject data=NativeSeparationContextTest.data().put("credential_id",NativeLegacyLineageJournalTest.id(1))
                    .put("employee_id",NativeLegacyLineageJournalTest.id(3));
                return NativeSeparationContextTest.response(NativeSeparationContextTest.envelope(data));
            }
            try{return method.invoke(f,args);}catch(InvocationTargetException error){throw error.getCause();}
        });
        VaultEngine engine=new VaultEngine(f.persistence,f.cipher,transport,f.legacy,f.seal,f.clock);
        NativeSeparationContext context=engine.readNativeSeparationContext(new NativePrincipalJournal(new Store()),f.journal());
        assertEquals(NativeLegacyLineageJournalTest.id(3),context.json().getString("employee_id"));
        assertEquals(1,calls[0]);assertArrayEquals(new char[transported[0].length],transported[0]);
        assertArrayEquals(before,new VaultSnapshotCodec().encode(f.persistence.current()));assertEquals(journalBefore,f.store.records);
        assertArrayEquals("protected original cleaning draft".toCharArray(),f.cipher.decrypt(saved));
        assertEquals(0,f.delegate.enrollCalls.get());assertEquals(0,f.cipher.destroyCalls);
        // Losing terminal lineage cannot fall back to the old token or create an identity.
        f.store.records.remove("principal");
        NativeSeparationContextTest.denied(()->engine.readNativeSeparationContext(new NativePrincipalJournal(new Store()),f.journal()));
        assertEquals(1,calls[0]);
    }
}
