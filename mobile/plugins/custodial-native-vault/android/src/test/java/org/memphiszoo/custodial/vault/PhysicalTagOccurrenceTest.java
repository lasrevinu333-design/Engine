package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.*;
import org.junit.Test;

/** Actual occurrence and encrypted-journal adapters with synthetic preferences/cipher.
 * Observed tag fixtures are not physical NFC reads or hardware acceptance. */
public final class PhysicalTagOccurrenceTest {
    interface Hook { void run() throws Exception; }
    static final class Preferences {
        Map<String,Object> disk=new HashMap<>(),durableDisk=new HashMap<>();int commits,applies,clears;boolean fail,persistThenFail,corruptReadback;
        private SharedPreferences instance;
        Hook beforeCommit=()->{},afterCommit=()->{};
        SharedPreferences object(){if(instance!=null)return instance;instance=(SharedPreferences)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.class},(proxy,method,args)->{
            switch(method.getName()){
                case "getAll":return new HashMap<>(disk);
                case "contains":return disk.containsKey(args[0]);
                case "getString":case "getStringSet":case "getInt":case "getLong":case "getFloat":case "getBoolean":return disk.getOrDefault(args[0],args[1]);
                case "registerOnSharedPreferenceChangeListener":case "unregisterOnSharedPreferenceChangeListener":return null;
                case "edit":break;
                default:throw new AssertionError(method.getName());
            }
            Map<String,Object> puts=new HashMap<>();Set<String> removes=new HashSet<>();
            return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{SharedPreferences.Editor.class},(editor,action,input)->{
                if(action.getName().startsWith("put")){if(input[1]==null){removes.add((String)input[0]);puts.remove(input[0]);}else{puts.put((String)input[0],input[1]);removes.remove(input[0]);}return editor;}
                switch(action.getName()){
                    case "remove":removes.add((String)input[0]);puts.remove(input[0]);return editor;
                    case "clear":clears++;throw new AssertionError("namespace clear");
                    case "apply":applies++;throw new AssertionError("async persistence");
                    case "commit":
                        commits++;beforeCommit.run();if(fail)return false;
                        Map<String,Object> next=new HashMap<>(disk);for(String key:removes)next.remove(key);next.putAll(puts);disk=next;
                        if(corruptReadback)disk.put("stray","unknown preserved bytes");afterCommit.run();
                        if(!persistThenFail)durableDisk=new HashMap<>(disk);return !persistThenFail;
                    default:throw new AssertionError(action.getName());
                }
            });
        });return instance;}
    }
    static final String D="KIOSK_08", S="a".repeat(64), A="nfc-a.v1:04010203040506", B="nfc-a.v1:04010203040507";
    static final class Fixture {
        final Preferences prefs=new Preferences();
        final TestCipher cipher=new TestCipher();
        long elapsed=1000; int boot=7;
        AndroidOfflineAuthorityTimeStore store;
        OfflineAuthorityTime time;
        final String session=UUID.randomUUID().toString(), startEntry=UUID.randomUUID().toString(), finishEntry=UUID.randomUUID().toString();
        Fixture() throws Exception {
            restart();time.acceptSnapshot(D,S,"2026-09-18T12:00:00.000Z","2026-09-19T12:00:00.000Z");time.authorizeNewWork(D,S);
        }
        void restart(){store=new AndroidOfflineAuthorityTimeStore(prefs.object(),cipher);time=new OfflineAuthorityTime(store,new OfflineAuthorityTime.MonotonicClock(){public long now(){return elapsed;}public int bootCount(){return boot;}});}
        String start()throws Exception{return time.beginOccurrence(D,"NOCX",session,S,startEntry,true,A);}
        String finish(String start,String identity)throws Exception{return time.completeOccurrenceFromScan(D,"NOCX",session,start,finishEntry,true,identity);}
    }
    interface Attempt {void run()throws Exception;}
    static void refused(String code,Attempt attempt)throws Exception{try{attempt.run();fail("Expected "+code);}catch(VaultFailure e){assertEquals(code,e.code);}}
    static final String[] NFC_A={"android.nfc.tech.Ndef","android.nfc.tech.MifareUltralight","android.nfc.tech.NfcA"};
    static final String[] NFC_V={"android.nfc.tech.NfcV","android.nfc.tech.Ndef"};
    @Test public void nfcACompleteUidSizesAndNonNxpTagsAreSupported(){
        assertEquals(A,PhysicalNfcTagIdentity.observe(new byte[]{4,1,2,3,4,5,6},NFC_A));
        assertEquals("nfc-a.v1:12010203",PhysicalNfcTagIdentity.observe(new byte[]{18,1,2,3},NFC_A));
        assertEquals("nfc-a.v1:02010203040506",PhysicalNfcTagIdentity.observe(new byte[]{2,1,2,3,4,5,6},NFC_A));
        assertEquals("nfc-a.v1:02010203040506070809",PhysicalNfcTagIdentity.observe(new byte[]{2,1,2,3,4,5,6,7,8,9},NFC_A));
        assertEquals(A,PhysicalNfcTagIdentity.observe(new byte[]{4,1,2,3,4,5,6},new String[]{"android.nfc.tech.NfcA","android.nfc.tech.IsoDep","android.nfc.tech.Ndef"}));
    }
    @Test public void randomNonUniqueMissingAndMalformedIdsAreRefused(){
        for(int first:new int[]{0x08,0x0f,0x1f,0xff,0x88,0xf8})assertEquals("",PhysicalNfcTagIdentity.observe(new byte[]{(byte)first,1,2,3},NFC_A));
        for(byte[] uid:new byte[][]{new byte[0],new byte[4],new byte[7],new byte[]{4,1,2},new byte[]{4,1,2,3,4,5,6,7}})assertEquals("",PhysicalNfcTagIdentity.observe(uid,NFC_A));
        assertEquals("",PhysicalNfcTagIdentity.observe(null,NFC_A));
        assertEquals("",PhysicalNfcTagIdentity.observe(new byte[]{4,1,2,3,4,5,6},null));
        assertFalse(PhysicalNfcTagIdentity.valid("nfc-a.v1:08010203"));
        assertFalse(PhysicalNfcTagIdentity.valid("nfc-a.v1:0401020304050"));
        assertFalse(PhysicalNfcTagIdentity.valid("nfc-a.v1:0401020304050Z"));
    }
    @Test public void iso15693UsesAllObservedBytesAndTechnologyOrderIsIrrelevant(){
        byte[] uid={1,2,3,4,5,6,2,(byte)0xe0};
        assertEquals("nfc-v.v1:01020304050602e0",PhysicalNfcTagIdentity.observe(uid,NFC_V));
        assertEquals("nfc-v.v1:01020304050602e0",PhysicalNfcTagIdentity.observe(uid,new String[]{"android.nfc.tech.Ndef","android.nfc.tech.NfcV"}));
        assertArrayEquals(new byte[]{1,2,3,4,5,6,2,(byte)0xe0},uid);
        assertEquals("",PhysicalNfcTagIdentity.observe(new byte[8],NFC_V));
        assertEquals("",PhysicalNfcTagIdentity.observe(new byte[]{1,2,3,4},NFC_V));
    }
    @Test public void unclassifiedOrAmbiguousRfIdentityDoesNotFallBackToLocation(){
        byte[] uid={4,1,2,3,4,5,6};
        for(String tech:new String[]{"android.nfc.tech.NfcB","android.nfc.tech.NfcF","android.nfc.tech.NfcBarcode","android.nfc.tech.Ndef","unknown"})assertEquals("",PhysicalNfcTagIdentity.observe(uid,new String[]{tech}));
        assertEquals("",PhysicalNfcTagIdentity.observe(uid,new String[]{"android.nfc.tech.NfcA","android.nfc.tech.NfcV"}));
        assertEquals("",PhysicalNfcTagIdentity.observe(uid,new String[]{"android.nfc.tech.NfcA","android.nfc.tech.NfcB"}));
        assertFalse(PhysicalNfcTagIdentity.sameObservedTag(A,"nfc-v.v1:0401020304050600"));
    }
    @Test public void priorCandidateIdentityAliasPreservesOriginalStoredBytesOnRecovery()throws Exception{
        var f=new Fixture();String original="ntag21x.v1:04010203040506";
        String start=f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true,original);f.restart();
        Map<String,Object> before=new HashMap<>(f.prefs.disk);
        assertEquals(start,f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true,A));
        assertEquals(before,f.prefs.disk);assertEquals(original,f.store.loadOccurrence(f.session).nativeTagIdentity);
        refused("custodial_native_tag_identity_mismatch",()->f.finish(start,B));assertEquals(before,f.prefs.disk);
        f.elapsed+=1000;f.finish(start,A);f.restart();assertEquals(original,f.store.loadOccurrence(f.session).nativeTagIdentity);
        assertTrue(PhysicalNfcTagIdentity.sameObservedTag(A,original));
    }
    @Test public void genericSupportedFamiliesBindAcrossInterruptionAndRejectDifferentTag()throws Exception{
        for(String original:new String[]{"nfc-a.v1:12010203","nfc-a.v1:02010203040506070809","nfc-v.v1:01020304050602e0"}){
            var f=new Fixture();String start=f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true,original);f.restart();
            Map<String,Object> before=new HashMap<>(f.prefs.disk);
            assertEquals(start,f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,false,""));assertEquals(before,f.prefs.disk);
            refused("custodial_native_tag_identity_mismatch",()->f.finish(start,original.substring(0,original.length()-1)+"1"));assertEquals(before,f.prefs.disk);
            f.elapsed+=1000;String end=f.finish(start,original);f.restart();
            assertEquals(original,f.store.loadOccurrence(f.session).nativeTagIdentity);assertEquals(end,f.store.loadOccurrence(f.session).completedAt);
        }
    }
    @Test public void sameObservedTagFinishesAndPersists()throws Exception{
        var f=new Fixture();String start=f.start();f.elapsed+=60000;String end=f.finish(start,A);f.restart();
        assertEquals(A,f.store.loadOccurrence(f.session).nativeTagIdentity);
        assertEquals(end,f.store.loadOccurrence(f.session).completedAt);
        assertEquals(f.finishEntry,f.store.loadFinishEntryId(f.store.loadOccurrence(f.session)));
    }
    @Test public void differentObservedTagAtSameLocationCannotFinishOrChangeAnyBytes()throws Exception{
        var f=new Fixture();String start=f.start();Map<String,Object> before=new HashMap<>(f.prefs.disk);
        refused("custodial_native_tag_identity_mismatch",()->f.finish(start,B));
        assertEquals(before,f.prefs.disk);assertEquals("",f.store.loadOccurrence(f.session).completedAt);
        f.elapsed+=1000;assertFalse(f.finish(start,A).isEmpty());
    }
    @Test public void interruptedStartRecoversOriginalIdentityAndTimer()throws Exception{
        var f=new Fixture();String start=f.start();Map<String,Object> before=new HashMap<>(f.prefs.disk);f.elapsed+=1000;f.restart();
        assertEquals(start,f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,false,""));
        assertEquals(before,f.prefs.disk);
        refused("custodial_native_tag_identity_mismatch",()->f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true,B));
        assertEquals(before,f.prefs.disk);assertFalse(f.finish(start,A).isEmpty());
    }
    @Test public void capturedFinishRecoversExactlyAfterEntryExpiry()throws Exception{
        var f=new Fixture();String start=f.start();f.elapsed+=1000;String end=f.finish(start,A);f.elapsed+=3600000;f.restart();
        assertEquals(end,f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,false,""));
        refused("custodial_native_offline_occurrence_mismatch",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,UUID.randomUUID().toString(),false,""));
    }
    @Test public void missingLiveEntryCannotMintFinish()throws Exception{
        var f=new Fixture();String start=f.start();Map<String,Object> before=new HashMap<>(f.prefs.disk);
        refused("custodial_native_scan_entry_missing",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,false,A));
        assertEquals(before,f.prefs.disk);
    }
    @Test public void expiredUnboundAttemptRecoversOnlyFreshOriginalTag()throws Exception{
        var f=new Fixture();String start=f.start();f.elapsed+=3600000;f.restart();
        Map<String,Object> before=new HashMap<>(f.prefs.disk);
        refused("custodial_native_scan_entry_missing",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,false,""));
        assertEquals(before,f.prefs.disk);
        String fresh=UUID.randomUUID().toString();
        refused("custodial_native_tag_identity_mismatch",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,fresh,true,B));
        assertEquals(before,f.prefs.disk);
        String end=f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,fresh,true,A);f.restart();
        assertEquals(end,f.store.loadOccurrence(f.session).completedAt);
        assertEquals(fresh,f.store.loadFinishEntryId(f.store.loadOccurrence(f.session)));
        assertEquals(A,f.store.loadOccurrence(f.session).nativeTagIdentity);
    }
    @Test public void freshEntryRepairsPartialProofWithoutChangingOriginalEnd()throws Exception{
        var f=new Fixture();String start=f.start();f.elapsed+=1000;
        int failCommit=f.prefs.commits+2;
        f.prefs.beforeCommit=()->{if(f.prefs.commits==failCommit)f.prefs.fail=true;};
        refused("custodial_native_offline_occurrence_mismatch",()->f.finish(start,A));
        f.prefs.fail=false;f.prefs.beforeCommit=()->{};f.elapsed+=3600000;f.restart();
        String originalEnd=f.store.loadOccurrence(f.session).completedAt;
        assertFalse(originalEnd.isEmpty());assertEquals("",f.store.loadFinishEntryId(f.store.loadOccurrence(f.session)));
        Map<String,Object> before=new HashMap<>(f.prefs.disk);
        refused("custodial_native_scan_entry_missing",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,false,""));
        String fresh=UUID.randomUUID().toString();
        refused("custodial_native_tag_identity_mismatch",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,fresh,true,B));
        assertEquals(before,f.prefs.disk);
        assertEquals(originalEnd,f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,fresh,true,A));f.restart();
        assertEquals(originalEnd,f.store.loadOccurrence(f.session).completedAt);
        assertEquals(fresh,f.store.loadFinishEntryId(f.store.loadOccurrence(f.session)));
        refused("custodial_native_offline_occurrence_mismatch",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,false,""));
        assertEquals(originalEnd,f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,fresh,false,""));
    }
    @Test public void unavailableIdentityCannotStartOrConsumeNewWorkAdmission()throws Exception{
        var f=new Fixture();Map<String,Object> before=new HashMap<>(f.prefs.disk);
        refused("custodial_native_tag_identity_unavailable",()->f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true,""));
        assertEquals(before,f.prefs.disk);assertNull(f.store.loadOccurrence(f.session));assertFalse(f.start().isEmpty());
    }
    @Test public void unavailableFinishIdentityPreservesTimer()throws Exception{
        var f=new Fixture();String start=f.start();Map<String,Object> before=new HashMap<>(f.prefs.disk);
        refused("custodial_native_tag_identity_unavailable",()->f.finish(start,""));assertEquals(before,f.prefs.disk);
    }
    @Test public void legacyUnfinishedWorkRetainedWithoutInventedIdentity()throws Exception{
        var f=new Fixture();String start=f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true);
        f.prefs.disk.put("unrelated_pending_draft","original-draft-bytes");Map<String,Object> before=new HashMap<>(f.prefs.disk);f.restart();
        assertEquals(start,f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,false,""));
        refused("custodial_native_tag_identity_legacy_pending",()->f.finish(start,A));
        assertEquals(before,f.prefs.disk);assertTrue(f.store.hasUnfinishedOccurrences());
    }
    @Test public void legacyAlreadyCapturedFinishStillDeliversExactly()throws Exception{
        var f=new Fixture();String start=f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true);f.elapsed+=1000;
        String end=f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,true);f.restart();
        Map<String,Object> before=new HashMap<>(f.prefs.disk);
        f.time.requireFinishTagOrPreservedProof(f.session,f.finishEntry,"");
        assertEquals(end,f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,false,""));assertEquals(before,f.prefs.disk);
    }
    @Test public void failedFinishJournalWriteRetainsIdentityAndRetriesOriginalTime()throws Exception{
        var f=new Fixture();String start=f.start();f.elapsed+=1000;f.prefs.fail=true;
        try{f.finish(start,A);fail();}catch(VaultFailure expected){}
        f.prefs.fail=false;f.restart();assertEquals(A,f.store.loadOccurrence(f.session).nativeTagIdentity);
        refused("custodial_native_tag_identity_mismatch",()->f.finish(start,B));assertFalse(f.finish(start,A).isEmpty());
    }
    @Test public void interruptionBetweenEndTimeAndFinishProofKeepsOriginalEndAndIdentity()throws Exception{
        var f=new Fixture();String start=f.start();f.elapsed+=1000;
        int failCommit=f.prefs.commits+2;
        f.prefs.beforeCommit=()->{if(f.prefs.commits==failCommit)f.prefs.fail=true;};
        // Existing finish-proof adapter wraps persistence failure with its occurrence refusal code.
        refused("custodial_native_offline_occurrence_mismatch",()->f.finish(start,A));
        f.prefs.fail=false;f.prefs.beforeCommit=()->{};f.restart();
        var saved=f.store.loadOccurrence(f.session);String originalEnd=saved.completedAt;
        assertFalse(originalEnd.isEmpty());assertEquals(A,saved.nativeTagIdentity);
        assertEquals("",f.store.loadFinishEntryId(saved));assertTrue(f.store.hasUnfinishedOccurrences());
        f.elapsed+=10000;refused("custodial_native_tag_identity_mismatch",()->f.finish(start,B));
        assertEquals(originalEnd,f.finish(start,A));assertEquals(f.finishEntry,f.store.loadFinishEntryId(f.store.loadOccurrence(f.session)));
    }
    @Test public void oldTimingOverloadCannotFinishIdentityBearingNewWork()throws Exception{
        var f=new Fixture();String start=f.start();Map<String,Object> before=new HashMap<>(f.prefs.disk);
        refused("custodial_native_tag_identity_unavailable",()->f.time.completeOccurrenceFromScan(D,"NOCX",f.session,start,f.finishEntry,true));
        assertEquals(before,f.prefs.disk);
    }
    @Test public void oldestElevenFieldOccurrenceRemainsReadableAndUntouched()throws Exception{
        var f=new Fixture();String start=f.time.beginOccurrence(D,"NOCX",f.session,S,f.startEntry,true);
        String key=f.prefs.disk.keySet().stream().filter(k->k.startsWith("offline_occurrence_sha256:")).findFirst().orElseThrow();
        org.json.JSONObject envelope=new org.json.JSONObject((String)f.prefs.disk.get(key));
        char[] clear=f.cipher.decrypt(new EncryptedSecret(envelope.getString("ciphertext"),envelope.getString("iv")));
        org.json.JSONObject old=new org.json.JSONObject(new String(clear));VaultValidation.wipe(clear);old.remove("clock_base_at");
        EncryptedSecret encoded=f.cipher.encrypt(old.toString().toCharArray());
        f.prefs.disk.put(key,new org.json.JSONObject().put("ciphertext",encoded.ciphertext).put("iv",encoded.iv).toString());
        Map<String,Object> before=new HashMap<>(f.prefs.disk);f.restart();
        assertEquals(start,f.store.loadOccurrence(f.session).startedAt);
        refused("custodial_native_tag_identity_legacy_pending",()->f.finish(start,A));assertEquals(before,f.prefs.disk);
    }
    @Test public void rebootKeepsTagAndPendingWorkButDoesNotInventCompletionTime()throws Exception{
        var f=new Fixture();String start=f.start();Map<String,Object> before=new HashMap<>(f.prefs.disk);
        f.boot++;f.elapsed=500;f.restart();
        refused("custodial_native_completion_recovery_required",()->f.finish(start,A));
        assertEquals(A,f.store.loadOccurrence(f.session).nativeTagIdentity);assertEquals(before,f.prefs.disk);
    }
    @Test public void encryptedHandoffSupportsIdentityAndLegacyRecordsAcrossClaimRestart()throws Exception{
        var f=new Fixture();String id=UUID.randomUUID().toString(),entry=UUID.randomUUID().toString();
        Map<String,Object> record=new LinkedHashMap<>(Map.of("schema_version","native-nfc-handoff.v1","handoff_id",id,"entry_id",entry,"url","memphiszoo://scan?code=NOCX","created_elapsed_ms",1000L,"expires_elapsed_ms",901000L,"boot_count",7,"state","pending"));
        record.put("native_tag_identity",A);f.store.saveNfcHandoffs(Map.of(id,record));f.restart();
        assertEquals(A,PhysicalNfcTagIdentity.fromRecord(NativeNfcScanHandoff.require(f.store,id,1001,7)));
        NativeNfcScanHandoff.markClaimed(f.store,id,entry,1001,7);f.restart();
        assertEquals(A,PhysicalNfcTagIdentity.fromRecord(NativeNfcScanHandoff.require(f.store,id,1002,7)));
        record.remove("native_tag_identity");f.store.saveNfcHandoffs(Map.of(id,record));f.restart();
        assertEquals("",PhysicalNfcTagIdentity.fromRecord(NativeNfcScanHandoff.require(f.store,id,1002,7)));
    }
}
