package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.junit.Test;

/** Actual protected Android adapter with synthetic preferences/cipher doubles.
 * This checks persistence/key-use contracts, not Android Keystore runtime proof.
 */
public final class ProtectedIdentityStoreTest {
    static final class Preferences {
        final Map<String,String> values=new HashMap<>(Map.of(
            "offline_scan_entries","retained-native-record",
            "offline_occurrence:fixture","retained-work-record"));
        boolean failCommit,corruptReadback;
        SharedPreferences instance(){
            return (SharedPreferences)Proxy.newProxyInstance(SharedPreferences.class.getClassLoader(),
                new Class<?>[]{SharedPreferences.class},(p,m,a)->{
                    switch(m.getName()){
                        case "getString": return values.getOrDefault((String)a[0],(String)a[1]);
                        case "contains": return values.containsKey(a[0]);
                        case "getAll": return new HashMap<>(values);
                        case "edit":
                            Map<String,String> pending=new HashMap<>();
                            return Proxy.newProxyInstance(SharedPreferences.Editor.class.getClassLoader(),
                                new Class<?>[]{SharedPreferences.Editor.class},(e,em,ea)->{
                                    if(em.getName().equals("putString")){pending.put((String)ea[0],(String)ea[1]);return e;}
                                    if(em.getName().equals("commit")){
                                        if(failCommit)return false;
                                        pending.forEach((k,v)->values.put(k,corruptReadback?"damaged":v));return true;
                                    }
                                    throw new AssertionError("Unexpected preference mutation: "+em.getName());
                                });
                        default: throw new AssertionError("Unexpected preference method: "+m.getName());
                    }
                });
        }
        void retained(){assertEquals("retained-native-record",values.get("offline_scan_entries"));
            assertEquals("retained-work-record",values.get("offline_occurrence:fixture"));}
    }
    final NativePrincipalJournalTest fixture=new NativePrincipalJournalTest();
    Map<String,Object> state(){var s=fixture.state();s.put("active_enrollment_flow","recovery");
        @SuppressWarnings("unchecked") var i=(Map<String,Object>)s.get("installation");
        i.put("enrollment_operation_id",NativePrincipalJournalTest.OP);return s;}
    @Test public void bothJournalsPersistAndRestartUsingOnlyExistingWorkKey()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();
        var store=new AndroidOfflineAuthorityTimeStore(p.instance(),cipher);
        fixture.capture(new NativePrincipalJournal(store),state(),fixture.data());
        new NativeAssignedActivationJournal(store).captureConfirmed(state());
        assertEquals(2,cipher.existingKeyEncryptCalls);assertEquals(0,cipher.destroyCalls);
        assertEquals(4,p.values.size());
        for(String key:new String[]{"authenticated_principal","assigned_activation_proof"}){
            JSONObject envelope=new JSONObject(p.values.get(key));
            assertEquals(2,envelope.length());assertTrue(envelope.has("ciphertext"));assertTrue(envelope.has("iv"));
        }
        var restarted=new AndroidOfflineAuthorityTimeStore(p.instance(),cipher);
        assertEquals(NativePrincipalJournalTest.E,new NativePrincipalJournal(restarted).readFor(state()).getString("employee_id"));
        assertEquals(NativePrincipalJournalTest.OP,new NativeAssignedActivationJournal(restarted).readFor(state()).getString("operation_id"));p.retained();
    }
    @Test public void missingExistingKeyDoesNotReplaceItOrWriteAReceipt()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();cipher.existingKeyUnavailable=true;
        var store=new AndroidOfflineAuthorityTimeStore(p.instance(),cipher);
        for(boolean principal:new boolean[]{true,false}){
            try{if(principal)fixture.capture(new NativePrincipalJournal(store),state(),fixture.data());
                else new NativeAssignedActivationJournal(store).captureConfirmed(state());fail();}
            catch(VaultFailure expected){assertEquals("test_existing_key_unavailable",expected.code);}
        }
        assertEquals(2,p.values.size());assertEquals(0,cipher.destroyCalls);p.retained();
    }
    @Test public void commitFailureNeverBecomesNativeAcceptance()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.instance(),cipher);
        fixture.capture(new NativePrincipalJournal(store),state(),fixture.data());String old=p.values.get("authenticated_principal");
        p.failCommit=true;
        try{fixture.capture(new NativePrincipalJournal(store),state(),fixture.data().put("assignment_epoch",5));fail();}
        catch(VaultFailure expected){assertEquals("custodial_native_offline_time_persistence_failed",expected.code);}
        try{new NativeAssignedActivationJournal(store).captureConfirmed(state());fail();}
        catch(VaultFailure expected){assertEquals("custodial_native_offline_time_persistence_failed",expected.code);}
        assertEquals(old,p.values.get("authenticated_principal"));assertFalse(p.values.containsKey("assigned_activation_proof"));p.retained();
    }
    @Test public void readbackMismatchNeverReportsAProtectedIdentity()throws Exception{
        var p=new Preferences();p.corruptReadback=true;var store=new AndroidOfflineAuthorityTimeStore(p.instance(),new TestCipher());
        try{fixture.capture(new NativePrincipalJournal(store),state(),fixture.data());fail();}
        catch(VaultFailure expected){assertEquals("custodial_native_offline_time_persistence_failed",expected.code);}
        try{new NativePrincipalJournal(store).readFor(state());fail();}catch(VaultFailure expected){}
        assertEquals("damaged",p.values.get("authenticated_principal"));p.retained();
    }
    @Test public void unreadableCiphertextIsPreservedAndNeverInventsIdentity()throws Exception{
        var p=new Preferences();var cipher=new TestCipher();var store=new AndroidOfflineAuthorityTimeStore(p.instance(),cipher);
        fixture.capture(new NativePrincipalJournal(store),state(),fixture.data());
        new NativeAssignedActivationJournal(store).captureConfirmed(state());var original=new HashMap<>(p.values);
        cipher.failDecrypts=2;
        try{new NativePrincipalJournal(store).readFor(state());fail();}catch(VaultFailure expected){}
        try{new NativeAssignedActivationJournal(store).readFor(state());fail();}catch(VaultFailure expected){}
        assertEquals(original,p.values);assertEquals(0,cipher.destroyCalls);p.retained();
    }
    @Test public void legacyTerminalAndPrincipalUseActualEncryptedAdapterAcrossRestart()throws Exception{
        var f=new NativeLegacyLineageJournalTest.Fixture(true);f.activate(NativeLegacyLineageJournalTest.OP);
        var p=new Preferences();var store=new AndroidOfflineAuthorityTimeStore(p.instance(),f.cipher);
        assertEquals("not_required",f.engine().completeLegacyAssignedActivation(NativeLegacyLineageJournalTest.OP,
            NativeLegacyLineageJournalTest.DEVICE,new NativeLegacyLineageJournal(store)));
        assertEquals(6,p.values.size());
        for(String key:p.values.keySet())if(key.startsWith("legacy_lineage:")){
            JSONObject envelope=new JSONObject(p.values.get(key));assertEquals(2,envelope.length());
            assertTrue(envelope.has("iv"));assertTrue(envelope.has("ciphertext"));
        }
        var restarted=new NativeLegacyLineageJournal(new AndroidOfflineAuthorityTimeStore(p.instance(),f.cipher));
        assertEquals(NativeLegacyLineageJournal.PRINCIPAL,f.engine().readLegacyPrincipal(restarted).getString("schema_version"));
        assertEquals(NativeLegacyLineageJournalTest.OP,f.engine().readLegacyActivation(restarted).getString("operation_id"));
        assertEquals(0,f.cipher.destroyCalls);assertEquals(0,f.delegate.enrollCalls.get());p.retained();
        // Ciphertext is record-key-bound; it cannot be relabelled under another operation.
        p.values.put("legacy_lineage:binding:"+NativeLegacyLineageJournalTest.id(99),p.values.get("legacy_lineage:binding:"+NativeLegacyLineageJournalTest.OP));
        try{store.loadLegacyRecord("binding:"+NativeLegacyLineageJournalTest.id(99));fail();}catch(VaultFailure expected){}
        assertNotNull(f.engine().readLegacyPrincipal(restarted));p.retained();
    }
    @Test public void legacyAdapterFailuresNeverReplaceKeyOrDiscardExistingWork()throws Exception{
        for(String failure:new String[]{"key","commit","readback"}){
            var p=new Preferences();var cipher=new TestCipher();
            var store=new AndroidOfflineAuthorityTimeStore(p.instance(),cipher);
            if(failure.equals("key"))cipher.existingKeyUnavailable=true;
            if(failure.equals("commit"))p.failCommit=true;
            if(failure.equals("readback"))p.corruptReadback=true;
            try{store.saveLegacyRecord("binding:"+NativeLegacyLineageJournalTest.OP,"{\"synthetic\":true}");fail();}catch(VaultFailure expected){}
            assertEquals(0,cipher.destroyCalls);p.retained();
        }
        var p=new Preferences();var store=new AndroidOfflineAuthorityTimeStore(p.instance(),new TestCipher());
        for(int i=0;i<1024;i++)p.values.put("legacy_lineage:binding:"+NativeLegacyLineageJournalTest.id(i+1000),"retained opaque old record");
        var before=new HashMap<>(p.values);
        try{store.saveLegacyRecord("binding:"+NativeLegacyLineageJournalTest.OP,"{}");fail();}
        catch(VaultFailure expected){assertEquals("custodial_legacy_lineage_capacity",expected.code);}
        assertEquals(before,p.values);p.retained();
    }
}
