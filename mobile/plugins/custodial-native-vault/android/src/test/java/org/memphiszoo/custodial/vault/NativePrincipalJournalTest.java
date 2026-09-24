package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;
public final class NativePrincipalJournalTest {
    static final String C="00000000-0000-4000-8000-000000000001",OP="00000000-0000-4000-8000-000000000002";
    static final String E="00000000-0000-4000-8000-000000000003",NEW="00000000-0000-4000-8000-000000000004";
    static final class Memory implements NativePrincipalJournal.Store {
        String value;public String loadPrincipal(){return value;}public void savePrincipal(String s){value=s;}
    }
    Map<String,Object> state(){return new LinkedHashMap<>(Map.of("active",true,"active_credential_id",C,
        "active_enrollment_operation_id",OP,"installation",new LinkedHashMap<>(Map.of("device_id","KIOSK_08",
        "installation_seal","original-seal-00000001","enrolled_at","2026-07-01T12:00:00.000Z"))));}
    JSONObject data()throws Exception{return new JSONObject().put("canonical_device_id","KIOSK_08").put("authenticated",true)
        .put("credential_id",C).put("employee_id",E).put("assignment_epoch",4);}
    AuthorizedRequest request(String path,String method){return new AuthorizedRequest(path,method,Map.of(),new byte[0]);}
    AuthorizedResponse response(JSONObject d)throws Exception{return new AuthorizedResponse(200,Map.of(),
        new JSONObject().put("ok",true).put("data",d).toString().getBytes(StandardCharsets.UTF_8));}
    void capture(NativePrincipalJournal j,Map<String,Object>s,JSONObject d)throws Exception{
        j.capture(s,request("/device-auth/status?device_id=KIOSK_08","GET"),response(d));
    }
    @Test public void noBrowserOrLegacyIdentityInvented()throws Exception{assertNull(new NativePrincipalJournal(new Memory()).readFor(state()));}
    @Test public void authenticatedExactPrincipalSurvivesRestart()throws Exception{
        Memory m=new Memory();capture(new NativePrincipalJournal(m),state(),data());
        var p=new NativePrincipalJournal(m).readFor(state());assertEquals(E,p.getString("employee_id"));assertEquals(4,p.getLong("assignment_epoch"));
    }
    @Test public void wrongRouteOrMethodCannotCapture()throws Exception{
        for(var r:new AuthorizedRequest[]{request("/schedule-api/my-day-summary","GET"),request("/device-auth/status","POST")}){
            Memory m=new Memory();new NativePrincipalJournal(m).capture(state(),r,response(data()));assertNull(m.value);
        }
    }
    @Test public void badAuthenticatedInputsPreservePriorRecord()throws Exception{
        Memory m=new Memory();var j=new NativePrincipalJournal(m);capture(j,state(),data());String before=m.value;
        JSONObject[] cases={data().put("authenticated",false),data().put("canonical_device_id","KIOSK_09"),
            data().put("credential_id",NEW),data().put("employee_id",""),data().put("assignment_epoch",0),
            data().put("assignment_epoch",1.5),data().put("assignment_epoch","5"),data().put("assignment_epoch",-1)};
        for(var d:cases){try{capture(j,state(),d);fail();}catch(VaultFailure e){assertEquals(NativePrincipalJournal.FAILURE,e.code);}assertEquals(before,m.value);}
    }
    @Test public void newerReassignmentHidesOldAndRejectsLateOlderResponse()throws Exception{
        Memory m=new Memory();var j=new NativePrincipalJournal(m);capture(j,state(),data());
        capture(j,state(),data().put("employee_id",NEW).put("assignment_epoch",5));String latest=m.value;
        try{capture(new NativePrincipalJournal(m),state(),data());fail();}catch(VaultFailure expected){}
        assertEquals(latest,m.value);assertEquals(NEW,j.readFor(state()).getString("employee_id"));
    }
    @Test public void sameEpochCannotChangeEmployee()throws Exception{
        Memory m=new Memory();var j=new NativePrincipalJournal(m);capture(j,state(),data());
        try{capture(j,state(),data().put("employee_id",NEW));fail();}catch(VaultFailure expected){}
        assertEquals(E,j.readFor(state()).getString("employee_id"));
    }
    @Test public void recoveryMustAuthenticateNewCredentialBeforeUsingCache()throws Exception{
        Memory m=new Memory();var j=new NativePrincipalJournal(m);capture(j,state(),data());String original=m.value;
        var s=state();s.put("active_credential_id",NEW);s.put("active_enrollment_operation_id",NEW);
        assertNull(j.readFor(s));assertEquals(original,m.value);
        capture(j,s,data().put("credential_id",NEW));assertEquals(NEW,j.readFor(s).getString("credential_id"));
        assertEquals("original-seal-00000001",j.readFor(s).getString("installation_seal"));
    }
    @Test public void changedInstallationOrDeviceCannotShowOldPrincipal()throws Exception{
        Memory m=new Memory();var j=new NativePrincipalJournal(m);capture(j,state(),data());
        for(String key:new String[]{"device_id","installation_seal","enrolled_at"}){
            var s=state();@SuppressWarnings("unchecked") var i=(Map<String,Object>)s.get("installation");
            i.put(key,key.equals("device_id")?"KIOSK_09":"different");assertNull(j.readFor(s));
        }
        var inactive=state();inactive.put("active",false);assertNull(j.readFor(inactive));
    }
}
