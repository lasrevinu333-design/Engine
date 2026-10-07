package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.Test;
public final class NativeAssignedActivationJournalTest {
    private static final String OP="00000000-0000-4000-8000-000000000002";
    private static final String ORIGIN="00000000-0000-4000-8000-000000000001";
    private static final class Memory implements NativeAssignedActivationJournal.Store {
        String value,transport;
        public String loadAssignedActivation(){return value;}
        public void saveAssignedActivation(String v){value=v;}
        public String loadAssignedActivationTransport(){return transport;}
        public void saveAssignedActivationTransport(String v){transport=v;}
    }
    private Map<String,Object> state(){
        Map<String,Object> s=new LinkedHashMap<>();s.put("active",true);s.put("active_enrollment_flow","recovery");s.put("active_enrollment_operation_id",OP);
        s.put("active_credential_id",OP);
        s.put("installation",new LinkedHashMap<>(Map.of("device_id","KIOSK_08","installation_seal","original-seal-00000001",
            "enrolled_at","2026-07-01T12:00:00.000Z","enrollment_operation_id",ORIGIN)));
        return s;
    }
    @Test public void noProofIsNotInvented()throws Exception{assertNull(new NativeAssignedActivationJournal(new Memory()).readFor(state()));}
    @Test public void transportStatusRequiresSavedServerResultAndExactState()throws Exception{
        Memory m=new Memory();var j=new NativeAssignedActivationJournal(m);j.captureConfirmed(state());
        assertEquals("delivery_unknown",j.transportResultFor(OP,state()));
        j.captureTransportResult(OP,state(),"native_active");
        assertEquals("native_active",new NativeAssignedActivationJournal(m).transportResultFor(OP,state()));
        var altered=state();altered.put("active_credential_id",ORIGIN);
        assertEquals("delivery_unknown",j.transportResultFor(OP,altered));
    }
    @Test public void healthyNoChangeResultBindsNewTransportButOriginalLineage()throws Exception{
        Memory m=new Memory();var j=new NativeAssignedActivationJournal(m);j.captureConfirmed(state());
        j.captureTransportResult(ORIGIN,state(),"not_required");
        assertEquals("not_required",j.transportResultFor(ORIGIN,state()));
        assertEquals(OP,j.readFor(state()).getString("operation_id"));
        assertFalse(m.transport.contains("original-seal"));
    }
    @Test public void receiptDigestRequiresProtectedReadback()throws Exception{
        Memory m=new Memory();var j=new NativeAssignedActivationJournal(m);
        try{j.digestFor(state());fail();}catch(VaultFailure expected){}
        j.captureConfirmed(state());String digest=j.digestFor(state());assertTrue(digest.matches("[a-f0-9]{64}"));
        assertEquals(digest,new NativeAssignedActivationJournal(m).digestFor(state()));
        m.value=m.value.replace("original-seal-00000001","changed-seal-00000001");
        try{j.digestFor(state());fail();}catch(VaultFailure expected){}
    }
    @Test public void restartReadsExactConfirmedRecovery()throws Exception{
        Memory m=new Memory();new NativeAssignedActivationJournal(m).captureConfirmed(state());
        var p=new NativeAssignedActivationJournal(m).readFor(state());assertEquals(OP,p.getString("operation_id"));assertEquals(ORIGIN,p.getString("lineage_operation_id"));
    }
    @Test public void anotherOperationCannotReuseProof()throws Exception{
        Memory m=new Memory();var j=new NativeAssignedActivationJournal(m);j.captureConfirmed(state());var s=state();s.put("active_enrollment_operation_id",ORIGIN);assertNull(j.readFor(s));
    }
    @Test public void inactiveStateCannotWriteConfirmation()throws Exception{
        Memory m=new Memory();var s=state();s.put("active",false);
        try{new NativeAssignedActivationJournal(m).captureConfirmed(s);fail();}catch(VaultFailure expected){assertEquals(NativeAssignedActivationJournal.FAILURE,expected.code);}
        assertNull(m.value);
    }
    @Test public void changedLineageAndDeviceCannotReuseProof()throws Exception{
        Memory m=new Memory();var j=new NativeAssignedActivationJournal(m);j.captureConfirmed(state());
        for(String key:new String[]{"device_id","installation_seal","enrolled_at","enrollment_operation_id"}){
            var s=state();@SuppressWarnings("unchecked") var installation=(Map<String,Object>)s.get("installation");
            installation.put(key,key.equals("device_id")?"KIOSK_09":"different");assertNull(j.readFor(s));
        }
    }
}
