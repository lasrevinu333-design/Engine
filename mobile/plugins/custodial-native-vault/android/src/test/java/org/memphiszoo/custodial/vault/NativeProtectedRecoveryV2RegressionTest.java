package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.lang.reflect.InvocationTargetException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

public final class NativeProtectedRecoveryV2RegressionTest {
    private static String id(int n){return NativeSeparationContextTest.id(n);}

    @Test public void staleNaNPayloadCannotPassProtectedCas()throws Exception{
        float a=Float.intBitsToFloat(0x7fc00001),b=Float.intBitsToFloat(0x7fc00002);
        var p=new AndroidProtectedWorkPreferencesTest.Preferences();p.disk.put("float",a);p.durableDisk=new HashMap<>(p.disk);
        var gate=AndroidProtectedWorkPreferencesTest.adapter(p);Map<String,?> stale=gate.protectedSnapshot();
        p.disk.put("float",b);p.durableDisk=new HashMap<>(p.disk);
        AndroidProtectedWorkPreferencesTest.denied(()->gate.prepareProbe(stale,"pending"));
        assertFalse(p.disk.containsKey(AndroidProtectedWorkPreferences.PROBE_KEY));
    }

    @Test public void volatileVaultCommitCannotBecomeReadableAuthority()throws Exception{
        var p=new AndroidProtectedWorkPreferencesTest.Preferences();
        var storage=new SharedPreferencesVaultPersistence(p.object(),new VaultSnapshotCodec());
        VaultSnapshot current=VaultSnapshot.empty(),next=current.next(VaultPhase.EMPTY,SecretKind.NONE,null,"","","",0,null,EnrollmentMetadata.empty(),"","",false,"");
        p.persistThenFail=true;
        try{storage.commit(0,next);fail();}catch(VaultFailure expected){assertEquals("custodial_native_vault_commit_failed",expected.code);}
        assertTrue(p.durableDisk.isEmpty());
        try{storage.load();fail("volatile snapshot became authoritative");}
        catch(VaultFailure expected){assertEquals("custodial_native_vault_durability_unconfirmed",expected.code);}
    }

    @Test public void malformedUtf8CannotBeRepairedBeforeStatusAuthority()throws Exception{
        var f=new NativeSeparationTransportTest.Fixture();
        NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(f.principal.readFor(f.engine.getState()));
        JSONObject data=new JSONObject().put("authenticated",true).put("enrollment_required",false).put("recovery_required",false)
            .put("policy_mode","enforce").put("requested_device_id","KIOSK_08").put("canonical_device_id","KIOSK_08")
            .put("device_name","KIOSK_08").put("employee_name","A").put("employee_id",principal.json().getString("employee_id"))
            .put("assignment_epoch",principal.json().getLong("assignment_epoch")).put("employee_role","Custodian")
            .put("credential_id",principal.json().getString("credential_id")).put("credential_expires_at","2027-01-01T00:00:00Z");
        byte[] raw=new JSONObject().put("ok",true).put("data",data).toString().getBytes(StandardCharsets.UTF_8);
        byte[] marker="\"employee_name\":\"A\"".getBytes(StandardCharsets.UTF_8);int at=indexOf(raw,marker);assertTrue(at>=0);raw[at+marker.length-2]=(byte)0x80;
        AuthorizedRequest request=new AuthorizedRequest(NativeActivePrincipalStatus.PATH,"GET",Map.of(),new byte[0]);
        HttpsEnrollmentTransport.HttpResult http=new HttpsEnrollmentTransport.HttpResult(200,Map.of("Content-Type",java.util.List.of("application/json")),raw);
        try{
            var method=HttpsEnrollmentTransport.class.getDeclaredMethod("authorizedResponse",AuthorizedRequest.class,HttpsEnrollmentTransport.HttpResult.class,char[].class);
            method.setAccessible(true);
            try{method.invoke(null,request,http,"not-the-wire-secret".toCharArray());fail("malformed authority bytes accepted");}
            catch(InvocationTargetException expected){assertTrue(expected.getCause() instanceof VaultFailure);}
        }catch(NoSuchMethodException oldV1){
            byte[] repaired=HttpsEnrollmentTransport.scrubResponseBody(raw,"application/json","not-the-wire-secret".toCharArray());
            AuthorizedResponse response=new AuthorizedResponse(200,Map.of(),repaired);
            NativeActivePrincipalStatus.require(request,response,principal);
            fail("V1 repaired malformed bytes before authority validation");
        }
    }

    @Test public void unknownInventoryKeyCannotBeReversedFromDiscovery()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();String secret="unknown:answer=retained-secret";
        f.preferences.disk.put(secret,"opaque retained bytes");f.preferences.durableDisk=new HashMap<>(f.preferences.disk);
        f.observe();String encoded=NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null).json().toString();
        assertFalse(encoded.contains(secret));assertFalse(encoded.contains(utf16Hex(secret)));
    }

    @Test public void sessionBoundariesUseInclusiveExpiryAndNanosecondDuration()throws Exception{
        var f=new NativeSeparationFreezeTest.Fixture();JSONObject start=occurrence().put("started_at","2026-09-26T18:00:00Z").put("completed_at","2026-09-26T18:00:00Z");
        put(f,false,start);put(f,true,finish(start));assertEquals("LINKED_UNVERIFIED",inspect(f).getString("state"));
        f=new NativeSeparationFreezeTest.Fixture();start=occurrence().put("expires_at","2026-09-28T18:00:00Z")
            .put("started_at","2026-09-26T10:01:00.123456789Z").put("completed_at","2026-09-27T10:01:00.123456790Z");
        put(f,false,start);put(f,true,finish(start));assertEquals("UNRESOLVED_INVALID_OR_MISMATCHED",inspect(f).getString("state"));
    }

    private static JSONObject occurrence()throws Exception{return new JSONObject().put("client_session_id",id(41)).put("device_id","KIOSK_08").put("location_code","RR_TEST")
        .put("snapshot_id","a".repeat(64)).put("generated_at","2026-09-26T10:00:00Z").put("expires_at","2026-09-26T18:00:00Z")
        .put("clock_base_at","2026-09-26T10:00:00Z").put("anchor_elapsed_realtime_ms",1000L).put("boot_count",3)
        .put("native_scan_entry_id",id(43)).put("started_at","2026-09-26T10:01:00Z").put("completed_at","2026-09-26T10:10:00Z");}
    private static JSONObject finish(JSONObject start)throws Exception{return new JSONObject().put("client_session_id",start.get("client_session_id")).put("device_id",start.get("device_id"))
        .put("location_code",start.get("location_code")).put("started_at",start.get("started_at")).put("completed_at",start.get("completed_at")).put("entry_id",id(44));}
    private static void put(NativeSeparationFreezeTest.Fixture f,boolean finish,JSONObject row)throws Exception{EncryptedSecret e=f.workCipher.encryptWithExistingKey(row.toString().toCharArray());
        String key=(finish?"offline_finish_proof_sha256:":"offline_occurrence_sha256:")+NativeProviderPrincipal.hash(id(41));f.preferences.disk.put(key,new JSONObject().put("ciphertext",e.ciphertext).put("iv",e.iv).toString());}
    private static JSONObject inspect(NativeSeparationFreezeTest.Fixture f)throws Exception{f.observe();return NativeSeparationFreeze.inspect(f.transport.engine,f.store,f.principal,null).json().getJSONArray("session_links").getJSONObject(0);}
    private static int indexOf(byte[] v,byte[] n){outer:for(int i=0;i<=v.length-n.length;i++){for(int j=0;j<n.length;j++)if(v[i+j]!=n[j])continue outer;return i;}return-1;}
    private static String utf16Hex(String value){StringBuilder out=new StringBuilder();for(int i=0;i<value.length();i++)for(int s=12;s>=0;s-=4)out.append(Character.forDigit((value.charAt(i)>>>s)&15,16));return out.toString();}
}
