package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.junit.Test;

/** Actual native owners + Android adapter; synthetic HTTP/preferences/key.
 * No runtime mounting, real AndroidKeyStore/process death or physical proof. */
public final class NativePendingCheckRecoveryTest {
    static JSONObject active(NativeSeparationFreezeTest.Fixture f)throws Exception{
        return new JSONObject().put("authenticated",true).put("enrollment_required",false).put("recovery_required",false)
            .put("policy_mode","required").put("requested_device_id","KIOSK_08").put("canonical_device_id","KIOSK_08")
            .put("device_name","Synthetic kiosk").put("employee_name","Synthetic custodian")
            .put("employee_id",NativeSeparationContextTest.id(2)).put("assignment_epoch",7).put("employee_role","employee")
            .put("credential_id",f.transport.engine.getState().get("active_credential_id")).put("credential_expires_at",JSONObject.NULL);
    }
    static void pending(NativeSeparationFreezeTest.Fixture f)throws Exception{
        f.transport.hook=()->{throw new VaultFailure("synthetic_network_outage");};
        AndroidProtectedWorkPreferencesTest.denied(()->f.observe());
        f.transport.hook=()->{};f.transport.returned=active(f);
        assertTrue(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
    }
    static void recover(NativeSeparationFreezeTest.Fixture f)throws VaultFailure{
        NativeSeparationFreeze.recoverPending(f.transport.engine,f.store,f.principal,null);
    }
    @Test public void freshAuthenticatedSamePrincipalRecoversOnlyPendingAndPreservesAllWork()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();var originals=new HashMap<>(f.preferences.disk);var state=f.transport.engine.getState();
        pending(f);String first=(String)f.preferences.disk.get(AndroidProtectedWorkPreferences.PROBE_KEY);
        recover(f);assertEquals(originals,f.preferences.disk);assertEquals(originals,f.preferences.durableDisk);
        f.store.requireWorkAdmission();assertEquals(state,f.transport.engine.getState());assertEquals(2,f.transport.calls);
        assertEquals(NativeActivePrincipalStatus.PATH,f.transport.request.path);f.transport.wiped();assertEquals(0,f.workCipher.destroyCalls);
        pending(f);String second=(String)f.preferences.disk.get(AndroidProtectedWorkPreferences.PROBE_KEY);
        assertNotEquals(first,second); // New operation cannot adopt a cancelled check, even with deterministic encryption.
        recover(f);assertEquals(originals,f.preferences.disk);
    }
    @Test public void wrongOrUnavailableStatusNeverThawsPending()throws Exception{
        for(int mode=0;mode<12;mode++){
            var f=new NativeSeparationFreezeTest.Fixture();pending(f);var before=new HashMap<>(f.preferences.disk);
            JSONObject data=active(f);
            switch(mode){
                case 0:data.put("authenticated",false);break;
                case 1:data.put("enrollment_required",true);break;
                case 2:data.put("recovery_required",true);break;
                case 3:data.put("employee_id",NativeSeparationContextTest.id(91));break;
                case 4:data.put("credential_id",NativeSeparationContextTest.id(92));break;
                case 5:data.put("canonical_device_id","KIOSK_09");break;
                case 6:data.put("requested_device_id","KIOSK_09");break;
                case 7:data.put("assignment_epoch",8);break;
                case 8:data.put("assignment_epoch","7");break;
                case 9:data.remove("recovery_required");break;
                case 10:data.put("unknown_authority",true);break;
                default:f.transport.hook=()->{throw new VaultFailure("synthetic_unavailable");};
            }
            f.transport.returned=data;AndroidProtectedWorkPreferencesTest.denied(()->recover(f));
            assertEquals(before,f.preferences.disk);assertEquals(before,f.preferences.durableDisk);
            AndroidProtectedWorkPreferencesTest.denied(()->f.store.requireWorkAdmission());f.transport.wiped();
        }
    }
    @Test public void missingCheckAndAuthenticatedSeparationCannotBeCancelled()throws Exception{
        var missing=new NativeSeparationFreezeTest.Fixture();var initial=new HashMap<>(missing.preferences.disk);
        AndroidProtectedWorkPreferencesTest.denied(()->recover(missing));assertEquals(0,missing.transport.calls);assertEquals(initial,missing.preferences.disk);
        var separated=new NativeSeparationFreezeTest.Fixture();separated.observe();var frozen=new HashMap<>(separated.preferences.disk);
        separated.transport.returned=active(separated);
        AndroidProtectedWorkPreferencesTest.denied(()->recover(separated));assertEquals(1,separated.transport.calls);assertEquals(frozen,separated.preferences.disk);
    }
    @Test public void changedRawOrVaultDuringStatusCannotCancel()throws Exception{
        for(boolean vault:new boolean[]{false,true}){
            var f=new NativeSeparationFreezeTest.Fixture();pending(f);
            if(vault)f.transport.hook=()->f.transport.engine.removeEnrollment(NativeSeparationContextTest.id(81),"KIOSK_08");
            else f.transport.hook=()->f.preferences.disk.put("unknown-old-work","changed externally while status in flight");
            AndroidProtectedWorkPreferencesTest.denied(()->recover(f));
            assertTrue(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
            AndroidProtectedWorkPreferencesTest.denied(()->f.store.requireWorkAdmission());
        }
    }
    @Test public void failedRemovalCannotAdmitAcrossAdaptersOrSimulatedRestart()throws Exception{
        for(int mode=0;mode<3;mode++){
            var f=new NativeSeparationFreezeTest.Fixture();var originals=new HashMap<>(f.preferences.disk);pending(f);
            var second=new AndroidOfflineAuthorityTimeStore(f.preferences.object(),f.workCipher);
            var staged=AndroidProtectedWorkPreferencesTest.adapter(f.preferences).edit().putString("new-work","must remain absent");
            final int failure=mode;
            f.transport.hook=()->{if(failure==0)f.preferences.fail=true;else if(failure==1)f.preferences.persistThenFail=true;
                else f.preferences.beforeCommit=()->{throw new IllegalStateException("synthetic removal persistence exception");};};
            AndroidProtectedWorkPreferencesTest.denied(()->recover(f));
            AndroidProtectedWorkPreferencesTest.denied(()->second.requireWorkAdmission());assertFalse(staged.commit());
            assertTrue(f.preferences.durableDisk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
            if(mode==1)assertFalse(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
            for(var e:originals.entrySet())assertEquals(e.getValue(),f.preferences.disk.get(e.getKey()));
            var restart=new AndroidProtectedWorkPreferencesTest.Preferences();restart.disk=new HashMap<>(f.preferences.durableDisk);restart.durableDisk=new HashMap<>(restart.disk);
            AndroidProtectedWorkPreferencesTest.denied(()->new AndroidOfflineAuthorityTimeStore(restart.object(),f.workCipher).requireWorkAdmission());
            f.preferences.fail=false;f.preferences.persistThenFail=false;f.preferences.beforeCommit=()->{};f.transport.hook=()->{};
            recover(f);assertEquals(originals,f.preferences.disk);assertEquals(originals,f.preferences.durableDisk);second.requireWorkAdmission();
        }
    }
    @Test public void lateCancellationCannotAdoptAnotherPendingOperation()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();pending(f);var old=f.store.preparePendingSeparationRecovery();
        recover(f);pending(f);var current=new HashMap<>(f.preferences.disk);
        AndroidProtectedWorkPreferencesTest.denied(()->f.store.cancelPendingSeparationRecovery(old));
        assertEquals(current,f.preferences.disk);AndroidProtectedWorkPreferencesTest.denied(()->f.store.requireWorkAdmission());
    }
    @Test public void separationAndCancellationHaveOneBoundedNativeOwner()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();CountDownLatch inHttp=new CountDownLatch(1),finishHttp=new CountDownLatch(1);
        f.transport.hook=()->{inHttp.countDown();if(!finishHttp.await(3,TimeUnit.SECONDS))throw new VaultFailure("test_timeout");};
        var workers=Executors.newFixedThreadPool(2);
        try{
            var observe=workers.submit(()->f.observe());assertTrue(inHttp.await(2,TimeUnit.SECONDS));
            var cancel=workers.submit(()->{AndroidProtectedWorkPreferencesTest.denied(()->recover(f));return true;});
            finishHttp.countDown();assertNotNull(observe.get(3,TimeUnit.SECONDS));assertTrue(cancel.get(3,TimeUnit.SECONDS));
            assertEquals(1,f.transport.calls);assertTrue(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
            AndroidProtectedWorkPreferencesTest.denied(()->f.store.requireWorkAdmission());
        }finally{finishHttp.countDown();workers.shutdownNow();assertTrue(workers.awaitTermination(3,TimeUnit.SECONDS));}
    }
    @Test public void reentrantNativeCancellationCannotRetireAnInFlightObservation()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();
        f.transport.hook=()->AndroidProtectedWorkPreferencesTest.denied(()->recover(f));
        assertNotNull(f.observe());assertEquals(1,f.transport.calls);
        assertTrue(f.preferences.disk.containsKey(AndroidProtectedWorkPreferences.FENCE_KEY));
        AndroidProtectedWorkPreferencesTest.denied(()->f.store.requireWorkAdmission());
    }
    @Test public void activeValidationRequiresExactSuccessRouteAndUnambiguousWire()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();
        var principal=NativeProviderPrincipal.fromNativeJournal(f.principal.readFor(f.transport.engine.getState()));
        var request=new AuthorizedRequest(NativeActivePrincipalStatus.PATH,"GET",Map.of(),new byte[0]);
        String valid=NativeSeparationContextTest.envelope(active(f));
        var response=NativeSeparationContextTest.response(valid);
        NativeActivePrincipalStatus.require(request,response,principal);
        for(String path:new String[]{"/device-auth/separation-context",NativeActivePrincipalStatus.PATH+"?device_id=KIOSK_08",NativeActivePrincipalStatus.PATH+"/"})
            AndroidProtectedWorkPreferencesTest.denied(()->NativeActivePrincipalStatus.require(new AuthorizedRequest(path,"GET",Map.of(),new byte[0]),response,principal));
        for(String method:new String[]{"POST","HEAD","get"})
            AndroidProtectedWorkPreferencesTest.denied(()->NativeActivePrincipalStatus.require(new AuthorizedRequest(request.path,method,Map.of(),new byte[0]),response,principal));
        AndroidProtectedWorkPreferencesTest.denied(()->NativeActivePrincipalStatus.require(new AuthorizedRequest(request.path,"GET",Map.of(),new byte[]{1}),response,principal));
        for(int status:new int[]{201,204,304,401,403,503})
            AndroidProtectedWorkPreferencesTest.denied(()->NativeActivePrincipalStatus.require(request,new AuthorizedResponse(status,Map.of(),response.body),principal));
        for(String body:new String[]{valid.replace("\"assignment_epoch\":7","\"assignment_epoch\":7.0"),
            valid.replace("\"assignment_epoch\":7","\"assignment_epoch\":7e0"),valid.replace("\"ok\":true","\"ok\":true,\"ok\":true"),valid+" trailing"})
            AndroidProtectedWorkPreferencesTest.denied(()->NativeActivePrincipalStatus.require(request,NativeSeparationContextTest.response(body),principal));
    }
}
