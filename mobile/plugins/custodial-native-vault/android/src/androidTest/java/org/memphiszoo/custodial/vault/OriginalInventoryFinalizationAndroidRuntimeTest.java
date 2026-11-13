package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFileAttributes;
import java.time.Instant;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.TreeMap;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Actual Android native/Source/HELD producers with local synthetic HTTP DATA.
 * No socket, genuine manager/SQL, install or physical-readiness claim. Private
 * ACK/finalization handles are constructed only by the normal owning Engine. */
@RunWith(AndroidJUnit4.class)
public final class OriginalInventoryFinalizationAndroidRuntimeTest {
    @Test public void actualTypedAckCommitsOneSuccessorAndColdReadsRetainedOriginal() throws Exception {
        run(Mode.POSITIVE);
    }
    @Test public void actualWrongOriginalDecisionCannotFinalizeOrRevive() throws Exception {
        run(Mode.WRONG_ORIGINAL);
    }

    @Test public void actualCommittedButFalseOutcomeStaysUnknownAndColdReadsWithoutRetry() throws Exception {
        run(Mode.COMMITTED_BUT_FALSE);
    }
    @Test public void actualColdBrowserLastNativeReadMutationCannotReturnStaleSuccess() throws Exception {
        run(Mode.LATE_BROWSER_MUTATION);
    }
    @Test public void actualPreCommitRefusalKeepsOriginalAndColdReadCannotRetry() throws Exception {
        run(Mode.REFUSED_BEFORE_COMMIT);
    }
    private enum Mode { POSITIVE, WRONG_ORIGINAL, COMMITTED_BUT_FALSE, REFUSED_BEFORE_COMMIT, LATE_BROWSER_MUTATION }
    private static void run(Mode mode) throws Exception {
        final InventoryHttp[] inventory={null};final FinalizationFaultContext[] fault={null};
        OriginalInventoryAckAndroidRuntimeTest.InventoryConsumer consumer=
            (application,engine,prepared,original,retained,recoveryHttp,control,liveSource,phase)->{
                if(phase==1){
                    JSONObject saved;
                    synchronized(engine){saved=new JSONObject(retained.originalForOwningDispatch(original).document);}
                    InventoryHttp fixture=new InventoryHttp(engine,saved);inventory[0]=fixture;fixture.control=control;
                    var unknowns=NativeOriginalInventoryAckUnknownJournal.fromNativeNoBackupRoot(application.getNoBackupFilesDir());
                    NativeOriginalInventoryAckUnknownJournal.Unknown reserved;
                    synchronized(engine){reserved=unknowns.reserveOriginalDispatchUnknown(original,retained);}
                    try(var unknown=reserved){
                        var registered=engine.registerOriginalInventoryRequest(original,retained,unknown,fixture.http,control);
                        assertEquals("ORIGINAL_REQUEST_REGISTERED_NOT_INVENTORY_ACK",registered.getString("state"));
                    }
                    var manifest=engine.advanceOriginalInventoryManifest(original,retained,fixture.http,control);
                    assertEquals("ALL_ORIGINAL_CHUNK_RECEIPTS_LOCALLY_OBSERVED_NOT_ACK",manifest.getString("state"));
                    fixture.requireCompleteManifest();
                    assertEquals(fixture.manifestSha,manifest.getString("manifest_sha256"));
                    return null;
                }
                assertEquals(2,phase);InventoryHttp fixture=inventory[0];assertNotNull(fixture);fixture.control=control;
                synchronized(engine){assertEquals(fixture.saved.toString(),retained.originalForOwningDispatch(original).document);}
                Map<String,SharedPreferences> owners=owners(application);
                Map<String,Map<String,?>> before=raw(owners);var aliases=aliases();
                var persistence=new SharedPreferencesVaultPersistence(application,new VaultSnapshotCodec());
                VaultSnapshot originalSnapshot=persistence.load();
                assertEquals(VaultPhase.ACTIVE,originalSnapshot.phase);assertTrue(originalSnapshot.hasCredential());
                var originalFiles=files(application.getNoBackupFilesDir().toPath());
                if(mode==Mode.WRONG_ORIGINAL){
                    fixture.wrongOriginal=true;
                    assertThrows(VaultFailure.class,()->engine.separateHeldOriginalEnrollmentKeepingWork(original,retained,fixture.http,control));
                    assertTrue(sameRaw(before,raw(owners)));assertEquals(originalSnapshot,persistence.load());
                    requireFilesRetained(originalFiles,application.getNoBackupFilesDir().toPath());assertEquals(aliases,aliases());
                    Path intent=application.getNoBackupFilesDir().toPath().resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY)
                        .resolve("inventory_finalization_intent-0.bin");
                    assertFalse(Files.exists(intent,LinkOption.NOFOLLOW_LINKS));
                    fixture.wrongOriginal=false;int reads=fixture.approvalReads;
                    assertThrows("Restoring response DATA cannot revive consumed original status/ACK owner",VaultFailure.class,
                        ()->engine.separateHeldOriginalEnrollmentKeepingWork(original,retained,fixture.http,control));
                    assertEquals(reads,fixture.approvalReads);assertTrue(sameRaw(before,raw(owners)));
                    System.out.println("UNIT_ANDROID_EXACT_ORIGINAL_DECISION_REFUSAL_NO_ACK_NO_SNAPSHOT_EFFECT; SYNTHETIC_HTTP_NOT_SQL");
                    return null;
                }
                VaultSnapshot terminal=originalSnapshot.next(VaultPhase.EMPTY,SecretKind.NONE,null,"",originalSnapshot.deviceId,"",0,null,
                    EnrollmentMetadata.empty(),fixture.target.getString("operation_id"),"",false,"");
                boolean uncertain=mode==Mode.COMMITTED_BUT_FALSE||mode==Mode.REFUSED_BEFORE_COMMIT;
                if(uncertain){
                    assertNotNull(fault[0]);
                    var failure=assertThrows(VaultFailure.class,()->engine.separateHeldOriginalEnrollmentKeepingWork(original,retained,fixture.http,control));
                    assertEquals("custodial_native_vault_commit_failed",failure.code);
                    assertEquals(1,fault[0].vault.finalizationAttempts);assertEquals(1,fault[0].vault.falseOutcomes);
                    assertEquals(mode==Mode.REFUSED_BEFORE_COMMIT?0:1,fault[0].vault.successfulFinalizationCommits);
                    assertEquals("custodial_native_vault_durability_unconfirmed",assertThrows(VaultFailure.class,persistence::load).code);
                }else{
                    JSONObject result=engine.separateHeldOriginalEnrollmentKeepingWork(original,retained,fixture.http,control);
                    assertEquals("ORIGINAL_SUCCESSOR_OBSERVED_ALL_WORK_RETAINED_NOT_RELEASED",result.getString("state"));
                    assertTrue(result.getBoolean("inventory_acknowledged"));
                    for(String key:new String[]{"work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(result.getBoolean(key));
                    assertEquals(fixture.target.getString("operation_id"),result.getString("original_operation_id"));assertEquals(terminal,persistence.load());
                }
                VaultSnapshot observed=mode==Mode.REFUSED_BEFORE_COMMIT?originalSnapshot:terminal;
                requireOnlySnapshotChanged(before,raw(owners),observed);
                requireFilesRetained(originalFiles,application.getNoBackupFilesDir().toPath());assertEquals(aliases,aliases());
                int registrationWrites=fixture.registrationWrites,manifestWrites=fixture.chunkWrites,approvalReads=fixture.approvalReads;
                assertEquals(1,registrationWrites);assertTrue(manifestWrites>=1);assertEquals(1,approvalReads);
                // Settle the consumed predecessor before creating independent
                // Engine/adapter/cipher/HELD readers over the SAME actual data.
                retained.close();original.close();prepared.close();
                var after=raw(owners);var afterFiles=files(application.getNoBackupFilesDir().toPath());
                if(mode==Mode.LATE_BROWSER_MUTATION){
                    try{
                        try(var coldControl=new NativePrivateCustodyFrameReadControl()){
                            assertThrows("Late native-map callback must not return earlier browser ciphertext verdict",VaultFailure.class,
                                ()->AndroidPrivateCustodyOwnerRecovery.inspectOriginalFinalization(application,coldEngine(application),coldControl));
                            assertTrue("Fault must reach actual native raw read AFTER initial browser GCM",fault[0].vault.lateBrowserMutation);
                        }
                    }finally{if(fault[0].vault.originalBrowser!=null)fault[0].vault.restoreBrowserOriginal();}
                }
                requireColdSuccess(application,mode==Mode.REFUSED_BEFORE_COMMIT?
                    "ORIGINAL_SNAPSHOT_RETAINED_NO_REPEAT_WRITE":"EXACT_SUCCESSOR_SNAPSHOT_PRESENT_WORK_STILL_HELD");
                if(mode==Mode.POSITIVE||mode==Mode.LATE_BROWSER_MUTATION)requireBrowserColdCorruptionAndMissing(application);
                assertTrue(sameRaw(after,raw(owners)));assertEquals(afterFiles,files(application.getNoBackupFilesDir().toPath()));
                assertEquals(aliases,aliases());assertEquals(registrationWrites,fixture.registrationWrites);
                assertEquals(manifestWrites,fixture.chunkWrites);assertEquals(approvalReads,fixture.approvalReads);
                assertThrows("Consumed original cannot write a duplicate successor",VaultFailure.class,
                    ()->engine.separateHeldOriginalEnrollmentKeepingWork(original,retained,fixture.http,control));
                assertEquals(registrationWrites,fixture.registrationWrites);assertEquals(manifestWrites,fixture.chunkWrites);assertEquals(approvalReads,fixture.approvalReads);
                if(uncertain){
                    assertEquals(1,fault[0].vault.finalizationAttempts);assertEquals(1,fault[0].vault.falseOutcomes);
                    assertEquals(mode==Mode.REFUSED_BEFORE_COMMIT?0:1,fault[0].vault.successfulFinalizationCommits);
                    assertEquals("Cold DATA must retain exact original uncertainty", "custodial_native_vault_durability_unconfirmed",assertThrows(VaultFailure.class,persistence::load).code);
                    System.out.println(mode==Mode.REFUSED_BEFORE_COMMIT?
                        "UNIT_ANDROID_PRE_COMMIT_REFUSAL_ORIGINAL_SNAPSHOT_COLD_DATA_RETAINED_UNCERTAINTY_NO_RETRY; SYNTHETIC_HTTP_NOT_SQL_OR_POWERLOSS":
                        "UNIT_ANDROID_FALSE_COMMIT_OUTCOME_EXACT_SUCCESSOR_COLD_DATA_RETAINED_UNCERTAINTY_NO_RETRY; SYNTHETIC_HTTP_NOT_SQL_OR_POWERLOSS");
                }else System.out.println("UNIT_ANDROID_TYPED_ACK_ONE_EXACT_SUCCESSOR_AND_NEW_ENGINE_RETAINED_KEY_COLD_DATA_READ; SYNTHETIC_HTTP_NOT_SQL_OR_PHYSICAL");
                return mode==Mode.REFUSED_BEFORE_COMMIT?null:terminal;
            };
        if(mode==Mode.COMMITTED_BUT_FALSE||mode==Mode.REFUSED_BEFORE_COMMIT||mode==Mode.LATE_BROWSER_MUTATION)OriginalInventoryAckAndroidRuntimeTest.withActualHeldOriginalInventoryRequest(consumer,application->{
            assertNull(fault[0]);fault[0]=new FinalizationFaultContext(application,mode);return fault[0];
        });
        else OriginalInventoryAckAndroidRuntimeTest.withActualHeldOriginalInventoryRequest(consumer);
    }

    private static void requireColdSuccess(Context application)throws Exception{
        requireColdSuccess(application,"EXACT_SUCCESSOR_SNAPSHOT_PRESENT_WORK_STILL_HELD");
    }
    private static void requireColdSuccess(Context application,String expectedState)throws Exception{
        try(var control=new NativePrivateCustodyFrameReadControl()){
            var cold=AndroidPrivateCustodyOwnerRecovery.inspectOriginalFinalization(application,coldEngine(application),control);
            assertEquals(expectedState,cold.getString("state"));
            assertTrue(cold.getBoolean("original_rows_compared"));assertTrue(cold.getBoolean("original_credential_readable"));
            assertTrue(cold.getBoolean("original_capsule_ciphertext_compared"));
            for(String key:new String[]{"inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal","phone_released"})assertFalse(cold.getBoolean(key));
        }
    }
    private static void requireBrowserColdCorruptionAndMissing(Context application)throws Exception{
        Path root=application.getNoBackupFilesDir().toPath(),part=root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY).resolve("browser_chunk-0.bin");
        PosixFileAttributes before=Files.readAttributes(part,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        byte[] original=Files.readAllBytes(part),changed=original.clone();changed[changed.length/2]^=1;
        try{
            Files.write(part,changed);Files.setLastModifiedTime(part,before.lastModifiedTime());
            try(var control=new NativePrivateCustodyFrameReadControl()){
                assertThrows("Actual retained browser GCM corruption cannot be hidden by intact native/capsule snapshots",VaultFailure.class,
                    ()->AndroidPrivateCustodyOwnerRecovery.inspectOriginalFinalization(application,coldEngine(application),control));
            }
            assertArrayEquals(changed,Files.readAllBytes(part));
        }finally{Files.write(part,original);Files.setLastModifiedTime(part,before.lastModifiedTime());Arrays.fill(changed,(byte)0);}
        requireColdSuccess(application);
        Path preserved=root.resolve("UNIT-original-browser-chunk-0-preserved");assertFalse(Files.exists(preserved,LinkOption.NOFOLLOW_LINKS));
        Files.move(part,preserved);
        try{
            try(var control=new NativePrivateCustodyFrameReadControl()){
                assertThrows("Missing actual original browser part cannot be classified as empty retained work",VaultFailure.class,
                    ()->AndroidPrivateCustodyOwnerRecovery.inspectOriginalFinalization(application,coldEngine(application),control));
            }
            assertFalse(Files.exists(part,LinkOption.NOFOLLOW_LINKS));assertArrayEquals(original,Files.readAllBytes(preserved));
        }finally{Files.move(preserved,part);}
        var after=Files.readAttributes(part,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        assertEquals(before.fileKey(),after.fileKey());assertEquals(before.lastModifiedTime(),after.lastModifiedTime());assertEquals(before.permissions(),after.permissions());
        assertArrayEquals(original,Files.readAllBytes(part));Arrays.fill(original,(byte)0);requireColdSuccess(application);
        System.out.println("UNIT_ANDROID_ACTUAL_BROWSER_GCM_CORRUPT_AND_MISSING_REFUSED_ORIGINAL_BYTES_INODE_TIME_RESTORED_FRESH_DATA_READER_ONLY");
    }

    private static VaultEngine coldEngine(Context application){
        EnrollmentTransport denied=new EnrollmentTransport(){
            private AssertionError refused(){return new AssertionError("Cold finalization DATA read reached transport");}
            public EnrollmentResult enroll(EnrollmentRequest r,char[] c){throw refused();}
            public TerminalResult confirm(String o,String d,char[] c){throw refused();}
            public TerminalResult cancel(String o,String d,char[] c){throw refused();}
            public TerminalResult remove(String o,String d,char[] c){throw refused();}
            public String verifyLegacyIdentity(String d,char[] c){throw refused();}
            public ActiveCredentialStatus verifyActiveCredential(String d,String i,char[] c){throw refused();}
            public AuthorizedResponse authorized(AuthorizedRequest r,String d,char[] c){throw refused();}
        };
        LegacyVaultSource legacy=new LegacyVaultSource(){
            public LegacyMaterial read(){throw new AssertionError("Cold DATA cannot run legacy recovery");}
            public void cleanup(){throw new AssertionError("Cold DATA cannot clean legacy work");}
            public boolean isClean(){throw new AssertionError("Cold DATA cannot run legacy recovery");}
        };
        return new VaultEngine(new SharedPreferencesVaultPersistence(application,new VaultSnapshotCodec()),new AndroidKeystoreCipher(),denied,legacy,
            ()->{throw new AssertionError("Cold DATA cannot issue installation seal");},System::currentTimeMillis,new AndroidOfflineAuthorityTimeStore(application));
    }
    private static Map<String,SharedPreferences> owners(Context app){
        var result=new TreeMap<String,SharedPreferences>();
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet())result.put(name,app.getSharedPreferences(name,Context.MODE_PRIVATE));
        return result;
    }
    private static Map<String,Map<String,?>> raw(Map<String,SharedPreferences> owners){
        var result=new TreeMap<String,Map<String,?>>();
        for(var namespace:owners.entrySet()){
            var copy=new TreeMap<String,Object>();
            for(var row:namespace.getValue().getAll().entrySet())copy.put(row.getKey(),row.getValue() instanceof java.util.Set<?>?new HashSet<>((java.util.Set<?>)row.getValue()):row.getValue());
            result.put(namespace.getKey(),copy);
        }
        return result;
    }
    private static boolean sameRaw(Map<String,Map<String,?>> a,Map<String,Map<String,?>> b)throws VaultFailure{
        if(!a.keySet().equals(b.keySet()))return false;
        for(String name:a.keySet())if(!NativeProtectedWorkSnapshot.exactRawEquals(a.get(name),b.get(name)))return false;
        return true;
    }
    private static void requireOnlySnapshotChanged(Map<String,Map<String,?>> before,Map<String,Map<String,?>> after,VaultSnapshot terminal)throws Exception{
        var expected=new TreeMap<String,Map<String,?>>(before);String name="MemphisZooCustodialNativeVaultV2";
        var vault=new TreeMap<String,Object>();vault.putAll(before.get(name));
        byte[] encoded=new VaultSnapshotCodec().encode(terminal);
        try{vault.put("authoritative_snapshot",java.util.Base64.getEncoder().encodeToString(encoded));}finally{Arrays.fill(encoded,(byte)0);}
        expected.put(name,vault);assertTrue("One exact authoritative snapshot successor; all unknown rows/type bits retained",sameRaw(expected,after));
    }
    private static java.util.Set<String> aliases()throws Exception{
        var keyStore=java.security.KeyStore.getInstance("AndroidKeyStore");keyStore.load(null);return new java.util.TreeSet<>(java.util.Collections.list(keyStore.aliases()));
    }
    private static Map<String,String> files(Path root)throws Exception{
        var result=new TreeMap<String,String>();long total=0;int count=0;
        try(var paths=Files.walk(root,8)){
            for(Path file:paths.sorted().toArray(Path[]::new)){
                if(++count>4096)throw new AssertionError("Bounded exact original file witness required");
                PosixFileAttributes a=Files.readAttributes(file,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                if(a.isSymbolicLink()||a.fileKey()==null||!a.isRegularFile()&&!a.isDirectory())throw new AssertionError("Unknown original file type");
                if(a.isDirectory())continue;total+=a.size();if(total>160*1024*1024L||a.size()>80*1024*1024L)throw new AssertionError("Bounded original bytes required");
                byte[] bytes=Files.readAllBytes(file);
                try{result.put(root.relativize(file).toString(),a.fileKey()+":"+a.permissions()+":"+a.owner()+":"+a.group()+":"+a.lastModifiedTime()+":"+NativeRetainedAttempt.hash(bytes));}
                finally{Arrays.fill(bytes,(byte)0);}
            }
        }
        return result;
    }
    private static void requireFilesRetained(Map<String,String> before,Path root)throws Exception{
        var after=files(root);for(var row:before.entrySet())assertEquals("Exact original file retained: "+row.getKey(),row.getValue(),after.get(row.getKey()));
        for(String added:after.keySet())if(!before.containsKey(added))assertTrue("Only immutable original decision/finalization records may be added",added.equals(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY+"/inventory_decision-0.bin")
            ||added.equals(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY+"/inventory_finalization_intent-0.bin"));
    }

    /** Selected before enrollment/capture by this NEW selector only. Every
     * owner later sees the SAME wrapper over the SAME real Android namespace.
     * There is no arm/reset method and no capability or source substitution. */
    private static final class FinalizationFaultContext extends android.content.ContextWrapper {
        final FinalizationFaultPreferences vault;
        FinalizationFaultContext(Context application,Mode mode){
            super(application);vault=new FinalizationFaultPreferences(application.getSharedPreferences("MemphisZooCustodialNativeVaultV2",Context.MODE_PRIVATE),application.getNoBackupFilesDir().toPath(),mode);
        }
        @Override public Context getApplicationContext(){return this;}
        @Override public SharedPreferences getSharedPreferences(String name,int mode){
            return "MemphisZooCustodialNativeVaultV2".equals(name)?vault:super.getSharedPreferences(name,mode);
        }
    }
    /** Constructor-fixed existing Android port faults only: either report
     * false after ONE actual exact successor commit, or alter owned synthetic
     * browser ciphertext at the actual late cold native-map callback. Setup,
     * capture/epoch writes and keys remain untouched. No authority is minted. */
    private static final class FinalizationFaultPreferences implements SharedPreferences {
        final SharedPreferences original;final Path root;final Mode mode;int finalizationAttempts,successfulFinalizationCommits,falseOutcomes;
        boolean lateBrowserMutation;byte[] originalBrowser;java.nio.file.attribute.FileTime browserModified;Object browserInode;
        FinalizationFaultPreferences(SharedPreferences original,Path root,Mode mode){this.original=original;this.root=root;this.mode=mode;}
        @Override public Map<String,?> getAll(){
            if(mode==Mode.LATE_BROWSER_MUTATION&&!lateBrowserMutation){
                boolean boundary=Arrays.stream(Thread.currentThread().getStackTrace()).anyMatch(frame->
                    frame.getClassName().equals(NativeProtectedNamespaceObservation.class.getName())&&frame.getMethodName().equals("requireRestoredFinalizationOriginalData"));
                if(boundary)try{
                    Path part=root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY).resolve("browser_chunk-0.bin");
                    var before=Files.readAttributes(part,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                    originalBrowser=Files.readAllBytes(part);browserModified=before.lastModifiedTime();browserInode=before.fileKey();
                    byte[] changed=originalBrowser.clone();changed[changed.length/2]^=1;
                    try{Files.write(part,changed);Files.setLastModifiedTime(part,browserModified);lateBrowserMutation=true;}
                    finally{Arrays.fill(changed,(byte)0);}
                }catch(Exception failure){throw new AssertionError("Constructor-selected late actual browser ciphertext mutation prerequisite",failure);}
            }
            return original.getAll();
        }
        void restoreBrowserOriginal()throws Exception{
            assertNotNull(originalBrowser);
            Path part=root.resolve(VaultEngine.NativePrivateCustodyExchangeJournal.DIRECTORY).resolve("browser_chunk-0.bin");
            Files.write(part,originalBrowser);Files.setLastModifiedTime(part,browserModified);
            assertEquals(browserInode,Files.readAttributes(part,PosixFileAttributes.class,LinkOption.NOFOLLOW_LINKS).fileKey());
            Arrays.fill(originalBrowser,(byte)0);originalBrowser=null;
            // The one-shot fault stays consumed. This is exact restoration of
            // synthetic DATA, never reset/arming or renewal of a refused owner.
        }
        @Override public String getString(String k,String d){return original.getString(k,d);}
        @Override public java.util.Set<String> getStringSet(String k,java.util.Set<String> d){return original.getStringSet(k,d);}
        @Override public int getInt(String k,int d){return original.getInt(k,d);}
        @Override public long getLong(String k,long d){return original.getLong(k,d);}
        @Override public float getFloat(String k,float d){return original.getFloat(k,d);}
        @Override public boolean getBoolean(String k,boolean d){return original.getBoolean(k,d);}
        @Override public boolean contains(String k){return original.contains(k);}
        @Override public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l){original.registerOnSharedPreferenceChangeListener(l);}
        @Override public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l){original.unregisterOnSharedPreferenceChangeListener(l);}
        @Override public Editor edit(){
            Editor delegate=original.edit();
            return new Editor(){
                String candidate;boolean otherMutation;
                @Override public Editor putString(String k,String v){if("authoritative_snapshot".equals(k))candidate=v;else otherMutation=true;delegate.putString(k,v);return this;}
                @Override public Editor putStringSet(String k,java.util.Set<String> v){otherMutation=true;delegate.putStringSet(k,v);return this;}
                @Override public Editor putInt(String k,int v){otherMutation=true;delegate.putInt(k,v);return this;}
                @Override public Editor putLong(String k,long v){otherMutation=true;delegate.putLong(k,v);return this;}
                @Override public Editor putFloat(String k,float v){otherMutation=true;delegate.putFloat(k,v);return this;}
                @Override public Editor putBoolean(String k,boolean v){otherMutation=true;delegate.putBoolean(k,v);return this;}
                @Override public Editor remove(String k){otherMutation=true;delegate.remove(k);return this;}
                @Override public Editor clear(){otherMutation=true;delegate.clear();return this;}
                @Override public boolean commit(){synchronized(FinalizationFaultPreferences.this){
                    boolean finalization=exactSuccessor(candidate);
                    if(finalization){assertFalse(otherMutation);assertEquals(0,finalizationAttempts++);}
                    if(finalization&&mode==Mode.REFUSED_BEFORE_COMMIT){falseOutcomes++;return false;}
                    boolean committed=delegate.commit();
                    if(finalization&&committed)successfulFinalizationCommits++;
                    if(finalization&&mode==Mode.COMMITTED_BUT_FALSE){assertTrue("Real Android successor must actually commit before the injected false result",committed);
                        assertEquals(candidate,original.getString("authoritative_snapshot",null));falseOutcomes++;return false;}
                    return committed;
                }}
                @Override public void apply(){assertFalse("Finalization uses synchronous durable commit only",exactSuccessor(candidate));delegate.apply();}
            };
        }
        private boolean exactSuccessor(String candidate){
            if(candidate==null)return false;String before=original.getString("authoritative_snapshot",null);if(before==null)return false;
            byte[] a=null,b=null;
            try{
                a=java.util.Base64.getDecoder().decode(before);b=java.util.Base64.getDecoder().decode(candidate);
                var codec=new VaultSnapshotCodec();VaultSnapshot old=codec.decode(a),next=codec.decode(b);
                if(old.phase!=VaultPhase.ACTIVE||!old.hasCredential()||next.phase!=VaultPhase.EMPTY||next.hasCredential()
                    ||next.removalOperationId.isEmpty()||old.revision==Long.MAX_VALUE)return false;
                return old.next(VaultPhase.EMPTY,SecretKind.NONE,null,"",old.deviceId,"",0,null,EnrollmentMetadata.empty(),next.removalOperationId,"",false,"").equals(next);
            }catch(VaultFailure|IllegalArgumentException malformed){throw new AssertionError("Actual original Android snapshot codec prerequisite",malformed);}
            finally{if(a!=null)Arrays.fill(a,(byte)0);if(b!=null)Arrays.fill(b,(byte)0);}
        }
    }

    /** Local fixed HTTP fixture; every receipt is derived from the ACTUAL
     * normally signed request. Its JSON is untrusted DATA until the normal
     * native readers/Source/HELD/disposition graph independently admit it. */
    private static final class InventoryHttp {
        final VaultEngine engine;final JSONObject saved,target;final byte[] registrationBody;final JSONObject registration;
        final NativePrivateCustodyHttp http;final Map<Integer,byte[]> chunks=new TreeMap<>();
        NativePrivateCustodyFrameReadControl control;String manifestSha;int manifestCount,registrationWrites,chunkWrites,approvalReads,statusReads;
        boolean wrongOriginal;JSONObject approval,completeManifest;
        InventoryHttp(VaultEngine engine,JSONObject saved)throws Exception{
            this.engine=engine;this.saved=saved;registrationBody=NativeRetainedAttempt.base64(saved.getString("request_body_base64"),65536);
            JSONObject body=ProviderWireJson.object(registrationBody,65536);target=new JSONObject(body.getString("original_intent_utf8")).getJSONObject("original_target");
            String at=micros(VaultTimestamps.epochMillis(saved.getString("native_request_timestamp"),"UNIT_inventory_timestamp"));
            registration=new JSONObject().put("schema","custodial.native-original-inventory-request-registration.v1")
                .put("state","REGISTERED_REQUEST_ONLY_NOT_ACK").put("native_request_id",saved.get("native_request_id"))
                .put("operation_id",target.get("operation_id")).put("original_generation_id",target.get("original_generation_id"))
                .put("request_body_sha256",saved.get("request_body_sha256")).put("intent_document_sha256",saved.get("intent_document_sha256"))
                .put("intent_disk_sha256",saved.get("intent_disk_sha256")).put("registered_at",at).put("limits",limits(false));
            registration.put("receipt_sha256",transcript("custodial.native-original-inventory-request-registration-digest.v1",
                saved.getString("native_request_id"),target.getString("operation_id"),target.getString("original_generation_id"),
                saved.getString("request_body_sha256"),saved.getString("intent_document_sha256"),saved.getString("intent_disk_sha256"),at));
            http=new NativePrivateCustodyHttp(this::connection,System::currentTimeMillis);
        }
        HttpsURLConnection connection(URL url){
            assertEquals(NativePrivateCustodyHttp.ORIGIN+url.getPath(),url.toString());
            return new HttpsURLConnection(url){
                final Map<String,String> headers=new HashMap<>();final ByteArrayOutputStream sent=new ByteArrayOutputStream();byte[] reply;boolean outputClosed;
                @Override public void setRequestProperty(String key,String value){headers.put(key,value);}
                @Override public OutputStream getOutputStream(){return new OutputStream(){
                    @Override public void write(int value){sent.write(value);}
                    @Override public void write(byte[] value,int off,int size){sent.write(value,off,size);}
                    @Override public void close(){outputClosed=true;}
                };}
                @Override public int getResponseCode()throws java.io.IOException{
                    byte[] body=sent.toByteArray();
                    try{assertFalse(Thread.holdsLock(engine));assertTrue(outputClosed);control.check();
                        assertEquals("POST",getRequestMethod());assertFalse(getUseCaches());assertFalse(getInstanceFollowRedirects());
                        assertEquals(target.getString("canonical_device_id"),headers.get("X-Device-Id"));
                        assertEquals("https://localhost",headers.get("Origin"));assertEquals("custodial",headers.get("X-Memphis-App-Edition"));
                        assertTrue(headers.get("X-Memphis-Native-Request-Attestation").matches("[a-f0-9]{64}"));
                        reply=wire(response(url.getPath(),body,headers));return 200;
                    }catch(Exception failure){throw new java.io.IOException("UNIT_fixed_inventory_HTTP_DATA",failure);}
                    finally{Arrays.fill(body,(byte)0);}
                }
                @Override public InputStream getInputStream(){return new ByteArrayInputStream(reply);}
                @Override public InputStream getErrorStream(){throw new AssertionError("No error response fixture");}
                @Override public Map<String,java.util.List<String>> getHeaderFields(){return Map.of("Content-Type",java.util.List.of("application/json"));}
                @Override public void disconnect(){if(reply!=null)Arrays.fill(reply,(byte)0);sent.reset();headers.clear();}
                @Override public boolean usingProxy(){return false;}
                @Override public void connect(){throw new AssertionError("No socket in local inventory fixture");}
                @Override public String getCipherSuite(){throw new AssertionError("No TLS proof");}
                @Override public java.security.cert.Certificate[] getLocalCertificates(){return null;}
                @Override public java.security.cert.Certificate[] getServerCertificates(){return null;}
            };
        }
        JSONObject response(String path,byte[] body,Map<String,String> headers)throws Exception{
            if(path.equals(VaultEngine.NativeOriginalInventoryAckRequestControl.PATH)){
                assertEquals(1,++registrationWrites);assertArrayEquals(registrationBody,body);
                assertEquals(saved.getString("native_request_id"),headers.get("X-Memphis-Native-Request-Id"));return registration;
            }
            if(path.equals(VaultEngine.NativeOriginalInventoryManifestPublication.PATH)){
                assertEquals(1,registrationWrites);chunkWrites++;
                JSONObject value=NativeOriginalInventoryManifestChunkWire.validateOriginal(body,headers.get("X-Memphis-Native-Request-Id"),headers.get("X-Memphis-Native-Request-Timestamp"));
                assertTrue(ProviderWireJson.same(target,value.getJSONObject("original_target")));
                if(manifestSha==null){manifestSha=value.getString("manifest_sha256");manifestCount=Integer.parseInt(value.getString("manifest_chunk_count"));}
                assertEquals(manifestSha,value.getString("manifest_sha256"));assertEquals(manifestCount,Integer.parseInt(value.getString("manifest_chunk_count")));
                int index=Integer.parseInt(value.getString("manifest_chunk_index"));assertFalse(chunks.containsKey(index));
                chunks.put(index,NativeRetainedAttempt.base64(value.getString("chunk_base64"),32768));
                String id=headers.get("X-Memphis-Native-Request-Id"),at=micros(VaultTimestamps.epochMillis(headers.get("X-Memphis-Native-Request-Timestamp"),"UNIT_manifest_timestamp"));
                JSONObject result=new JSONObject().put("schema","custodial.native-original-inventory-manifest-chunk-registration.v1").put("state","CHUNK_RETAINED_NOT_ACK")
                    .put("inventory_native_request_id",saved.get("native_request_id")).put("manifest_sha256",manifestSha).put("manifest_chunk_index",String.valueOf(index))
                    .put("chunk_sha256",value.get("chunk_sha256")).put("native_request_id",id).put("request_body_sha256",NativeRetainedAttempt.hash(body))
                    .put("registered_at",at).put("limits",limits(false));
                result.put("receipt_sha256",transcript("custodial.native-original-inventory-manifest-chunk-receipt.v1",saved.getString("native_request_id"),manifestSha,
                    String.valueOf(index),value.getString("chunk_sha256"),id,NativeRetainedAttempt.hash(body),at));return result;
            }
            if(path.equals(NativeOriginalInventoryAckStatusEnvelope.PATH)||path.equals(NativeOriginalInventoryAckStatusEnvelope.APPROVAL_PATH)){
                byte[] expected=path.equals(NativeOriginalInventoryAckStatusEnvelope.PATH)?NativeOriginalInventoryAckStatusEnvelope.encode(saved.toString().getBytes(StandardCharsets.UTF_8)):
                    NativeOriginalInventoryAckStatusEnvelope.encodeApprovalStatus(saved.toString().getBytes(StandardCharsets.UTF_8));
                try{assertArrayEquals(expected,body);}finally{Arrays.fill(expected,(byte)0);}
                if(path.equals(NativeOriginalInventoryAckStatusEnvelope.PATH)){assertEquals(1,++statusReads);return registration;}
                assertEquals(1,++approvalReads);requireCompleteManifest();
                if(approval==null)approval=approval();JSONObject result=new JSONObject(approval.toString());
                if(wrongOriginal){
                    result.getJSONObject("original_target").put("credential_id","97000000-0000-4000-8000-000000000099");
                    // Internally consistent synthetic receipt for a FOREIGN
                    // original: the owning exact-target guard must refuse it.
                    result.remove("receipt_sha256");
                    result.put("receipt_sha256",NativeRetainedAttempt.hash(("custodial.original-inventory-separation-receipt.v1\n"+canonicalReceipt(result)).getBytes(StandardCharsets.UTF_8)));
                }
                return result;
            }
            throw new AssertionError("Unexpected inventory endpoint: "+path);
        }
        void requireCompleteManifest()throws Exception{
            assertNotNull(manifestSha);assertEquals(manifestCount,chunks.size());var joined=new ByteArrayOutputStream();
            for(int i=0;i<manifestCount;i++){assertNotNull(chunks.get(i));joined.write(chunks.get(i));}
            byte[] bytes=joined.toByteArray();try{assertEquals(manifestSha,NativeRetainedAttempt.hash(bytes));
                JSONObject manifest=ProviderWireJson.object(bytes,16777216);assertTrue(ProviderWireJson.same(target,manifest.getJSONObject("original_target")));
                assertTrue(manifest.getJSONArray("native_records").length()>0);assertTrue(manifest.getJSONArray("browser_records").length()>0);
                completeManifest=manifest;
            }finally{Arrays.fill(bytes,(byte)0);}
        }
        JSONObject approval()throws Exception{
            long now=System.currentTimeMillis();
            JSONObject issuer=new JSONObject().put("manager_id","97000000-0000-4000-8000-000000000091")
                .put("manager_credential_id","97000000-0000-4000-8000-000000000092").put("manager_device_id","UNIT_MANAGER_02");
            assertNotNull(completeManifest);
            JSONObject summary=new JSONObject().put("declared_domains",completeManifest.getJSONArray("browser_domains").length())
                .put("record_count",completeManifest.getJSONArray("browser_records").length())
                .put("accepted_exact_original_count",completeManifest.get("browser_accepted_exact_original_count"))
                .put("unresolved_retained_count",completeManifest.get("browser_unresolved_retained_count"))
                .put("frame_sha256",completeManifest.getJSONObject("browser_value_frame").get("frame_sha256"))
                .put("part_set_sha256",completeManifest.get("browser_part_set_sha256"));
            JSONObject review=new JSONObject().put("schema","custodial.original-inventory-separation-review.v1")
                .put("state","COMPLETE_ORIGINAL_INVENTORY_REVIEW_ONLY").put("purpose","AUTHORIZE_EXACT_ORIGINAL_RETAINED_INVENTORY_SEPARATION")
                .put("native_request_id",saved.get("native_request_id")).put("original_target",new JSONObject(target.toString()))
                .put("original_employee_label","UNIT synthetic original employee").put("original_device_label",target.get("canonical_device_id"))
                .put("registration_receipt_sha256",registration.get("receipt_sha256")).put("inventory_manifest_sha256",manifestSha)
                .put("issuer",issuer).put("native_namespaces",completeManifest.getJSONArray("native_namespaces"))
                .put("browser_summary",summary).put("retained_key_family_count",completeManifest.getJSONArray("retained_key_families").length())
                .put("limits",limits(false));
            // SQL's review identity excludes observation times and hashes its
            // jsonb text representation. This is still synthetic server DATA,
            // never a SQL/session/manager capability or semantic approval.
            String reviewSha=NativeRetainedAttempt.hash(("custodial.original-inventory-separation-review.v1\n"+pgJsonb(review)).getBytes(StandardCharsets.UTF_8));
            JSONObject request=new JSONObject().put("schema","custodial.original-inventory-separation-request.v1")
                .put("request_id","97000000-0000-4000-8000-000000000093").put("native_request_id",saved.get("native_request_id"))
                .put("expected_review_sha256",reviewSha).put("expected_inventory_manifest_sha256",manifestSha)
                .put("expected_registration_receipt_sha256",registration.get("receipt_sha256"))
                .put("expected_separation_authority_revision",target.get("separation_authority_revision"))
                .put("expected_manager_id",issuer.get("manager_id")).put("expected_manager_credential_id",issuer.get("manager_credential_id"))
                .put("expected_manager_device_id",issuer.get("manager_device_id"))
                .put("decision","AUTHORIZE_EXACT_ORIGINAL_RETAINED_INVENTORY_SEPARATION")
                .put("manager_confirmation","CONFIRM_LOGICAL_SEPARATION_KEEP_ALL_ORIGINAL_WORK_AND_KEYS");
            // Own these exact originally generated command bytes before any
            // receipt encoding; never recompute a digest from imported JSON.
            byte[] originalCommand=request.toString().getBytes(StandardCharsets.UTF_8);
            String commandSha;try{commandSha=NativeRetainedAttempt.hash(originalCommand);}finally{Arrays.fill(originalCommand,(byte)0);}
            JSONObject receipt=new JSONObject().put("schema","custodial.original-inventory-separation-receipt.v1").put("state","INVENTORY_ACK_RECORDED_LOGICAL_SEPARATION_ONLY")
                .put("approval_id","97000000-0000-4000-8000-000000000094").put("original_request",request)
                .put("original_request_sha256",commandSha)
                .put("original_target",new JSONObject(target.toString())).put("issuer",issuer).put("inventory_manifest_sha256",manifestSha)
                .put("registration_receipt_sha256",registration.get("receipt_sha256")).put("approved_at",micros(now)).put("expires_at",micros(now+30_000L))
                .put("limits",limits(true)).put("purpose_admission_id","exact-original-retained-inventory-separation.v1").put("retry_safe",false);
            receipt.put("receipt_sha256",NativeRetainedAttempt.hash(("custodial.original-inventory-separation-receipt.v1\n"+canonicalReceipt(receipt)).getBytes(StandardCharsets.UTF_8)));
            return receipt;
        }
    }
    /** Matches the fixed SQL canonical_document receipt encoding, which
     * contains only objects, strings and booleans. No authority is inferred. */
    private static String canonicalReceipt(Object value)throws Exception{
        if(value instanceof JSONObject){
            var object=(JSONObject)value;var keys=new java.util.TreeSet<String>();for(var it=object.keys();it.hasNext();)keys.add(it.next());
            var out=new StringBuilder("{");boolean comma=false;
            for(String key:keys){if(comma)out.append(',');comma=true;out.append(JSONObject.quote(key)).append(':').append(canonicalReceipt(object.get(key)));}
            return out.append('}').toString();
        }
        if(value instanceof String)return JSONObject.quote((String)value);
        if(value instanceof Boolean)return value.toString();throw new AssertionError("Closed receipt primitive required");
    }
    /** PostgreSQL jsonb::text orders ASCII object keys by byte length then
     * byte value and separates entries with spaces. Review keys are fixed
     * ASCII; counts are exact integers. Mirrors SQL DATA digest format only. */
    private static String pgJsonb(Object value)throws Exception{
        if(value instanceof JSONObject){
            var object=(JSONObject)value;var keys=new java.util.ArrayList<String>();for(var it=object.keys();it.hasNext();)keys.add(it.next());
            keys.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
            var out=new StringBuilder("{");boolean comma=false;
            for(String key:keys){if(comma)out.append(", ");comma=true;out.append(JSONObject.quote(key)).append(": ").append(pgJsonb(object.get(key)));}
            return out.append('}').toString();
        }
        if(value instanceof org.json.JSONArray){var array=(org.json.JSONArray)value;var out=new StringBuilder("[");
            for(int i=0;i<array.length();i++){if(i>0)out.append(", ");out.append(pgJsonb(array.get(i)));}return out.append(']').toString();}
        if(value instanceof String)return JSONObject.quote((String)value);
        if(value instanceof Boolean||value instanceof Integer||value instanceof Long)return value.toString();
        throw new AssertionError("Closed review primitive required");
    }
    private static JSONObject limits(boolean approved)throws Exception{
        JSONObject result=new JSONObject();for(String key:new String[]{"inventory_acknowledged","work_accepted","replay_allowed","finalizer_allowed","key_removal","phone_released"})
            result.put(key,approved&&(key.equals("inventory_acknowledged")||key.equals("finalizer_allowed")));return result;
    }
    private static String transcript(String... values)throws Exception{return NativeRetainedAttempt.hash(String.join("\n",values).getBytes(StandardCharsets.UTF_8));}
    private static byte[] wire(JSONObject value)throws Exception{return new JSONObject().put("ok",true).put("data",value).toString().getBytes(StandardCharsets.UTF_8);}
    private static String micros(long millis){return new DateTimeFormatterBuilder().appendInstant(6).toFormatter().format(Instant.ofEpochMilli(millis));}
}
