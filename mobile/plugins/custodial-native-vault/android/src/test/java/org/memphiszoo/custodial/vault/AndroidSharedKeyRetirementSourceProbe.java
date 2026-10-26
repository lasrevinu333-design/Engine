package org.memphiszoo.custodial.vault;

import java.io.InputStream;
import java.io.OutputStream;
import java.security.Key;
import java.security.KeyStore;
import java.security.KeyStoreSpi;
import java.security.Provider;
import java.security.Security;
import java.security.cert.Certificate;
import java.util.Collections;
import java.util.Date;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.KeyGenerator;

/** Explicit host-only source regression; never device qualification or an app build. */
public final class AndroidSharedKeyRetirementSourceProbe {
    public static final class MemoryKeyStore extends KeyStoreSpi {
        static final Map<String, Key> keys = new HashMap<>();
        static int loads, deletions;
        public Key engineGetKey(String alias, char[] password) { return keys.get(alias); }
        public Certificate[] engineGetCertificateChain(String alias) { return null; }
        public Certificate engineGetCertificate(String alias) { return null; }
        public Date engineGetCreationDate(String alias) { return null; }
        public void engineSetKeyEntry(String alias, Key key, char[] password, Certificate[] chain) { keys.put(alias, key); }
        public void engineSetKeyEntry(String alias, byte[] key, Certificate[] chain) { throw new UnsupportedOperationException(); }
        public void engineSetCertificateEntry(String alias, Certificate cert) { throw new UnsupportedOperationException(); }
        public void engineDeleteEntry(String alias) { deletions++; keys.remove(alias); }
        public Enumeration<String> engineAliases() { return Collections.enumeration(keys.keySet()); }
        public boolean engineContainsAlias(String alias) { return keys.containsKey(alias); }
        public int engineSize() { return keys.size(); }
        public boolean engineIsKeyEntry(String alias) { return keys.containsKey(alias); }
        public boolean engineIsCertificateEntry(String alias) { return false; }
        public String engineGetCertificateAlias(Certificate cert) { return null; }
        public void engineStore(OutputStream output, char[] password) { throw new UnsupportedOperationException(); }
        public void engineLoad(InputStream input, char[] password) {
            if (input != null || password != null) throw new UnsupportedOperationException();
            loads++;
        }
        public KeyStore.Entry engineGetEntry(String alias, KeyStore.ProtectionParameter protection) {
            Key key = keys.get(alias);
            return key == null ? null : new KeyStore.SecretKeyEntry((javax.crypto.SecretKey) key);
        }
    }
    private interface Checked { void run() throws Exception; }
    private static int cases;
    private static void require(boolean condition, String label) {
        if (!condition) throw new AssertionError(label);
    }
    private static void refused(Checked operation, String code) throws Exception {
        try { operation.run(); throw new AssertionError("expected_refusal"); }
        catch (VaultFailure failure) { require(code.equals(failure.code), "wrong_refusal"); }
    }
    private static void passed(String label) {
        cases++;
        System.out.println("PASS " + label);
    }
    private static void readable(AndroidKeystoreCipher work, EncryptedSecret secret, char[] expected) throws Exception {
        char[] value = work.decrypt(secret);
        try { require(java.util.Arrays.equals(value, expected), "retained_work_unreadable"); }
        finally { java.util.Arrays.fill(value, '\0'); }
    }
    private static final String RECREATION_REFUSED="custodial_native_shared_key_recreation_refused";
    private static Map<String,byte[]> creationEpochFiles(java.nio.file.Path directory)throws Exception {
        var result=new java.util.TreeMap<String,byte[]>();
        try(var files=java.nio.file.Files.newDirectoryStream(directory)){
            for(var file:files)result.put(file.getFileName().toString(),java.nio.file.Files.readAllBytes(file));
        }
        return result;
    }
    private static Map<String,Object> creationEpochKeys(java.nio.file.Path directory)throws Exception {
        var result=new java.util.TreeMap<String,Object>();
        try(var files=java.nio.file.Files.newDirectoryStream(directory)){
            for(var file:files)result.put(file.getFileName().toString(),
                java.nio.file.Files.readAttributes(file,java.nio.file.attribute.BasicFileAttributes.class,
                    java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey());
        }
        return result;
    }
    private static void creationEpochSame(Map<String,byte[]> expected,Map<String,Object> identities,
        java.nio.file.Path directory)throws Exception {
        var actual=creationEpochFiles(directory);
        require(expected.keySet().equals(actual.keySet()),"creation_epoch_members_changed");
        for(String name:expected.keySet())
            require(java.util.Arrays.equals(expected.get(name),actual.get(name)),"creation_epoch_bytes_changed_"+name);
        require(identities.equals(creationEpochKeys(directory)),"creation_epoch_inodes_changed");
    }
    private static void creationRefused(Checked attempt,String code)throws Exception {
        try{attempt.run();throw new AssertionError("expected_creation_refusal_"+code);}
        catch(VaultFailure failure){
            if(!code.equals(failure.code))
                throw new AssertionError("expected "+code+" but actual "+failure.code,failure);
        }
    }
    private static Key syntheticExistingSharedKey()throws Exception {
        KeyGenerator generator=KeyGenerator.getInstance("AES");generator.init(128);return generator.generateKey();
    }
    private static void creationExistingKeyReadOnly()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();Key key=syntheticExistingSharedKey();MemoryKeyStore.keys.put(AndroidKeystoreCipher.KEY_ALIAS,key);
            var cipher=new AndroidKeystoreCipher();char[] clear="synthetic original shared-key data".toCharArray();
            var files=creationEpochFiles(x.dir);var identities=creationEpochKeys(x.dir);var raw=x.raw();long count=x.counter();
            try{
                EncryptedSecret saved=cipher.encrypt(clear);readable(cipher,saved,clear);
                EncryptedSecret retained=cipher.encryptWithExistingKey(clear);readable(cipher,retained,clear);
                require(count==x.counter(),"existing_shared_key_advanced_epoch");
                creationEpochSame(files,identities,x.dir);
                require(raw.equals(x.raw()),"existing_shared_key_changed_original_rows");
                require(MemoryKeyStore.keys.get(AndroidKeystoreCipher.KEY_ALIAS)==key&&MemoryKeyStore.deletions==0,
                    "existing_shared_key_identity_changed");
            }finally{java.util.Arrays.fill(clear,'\0');}
        }
    }
    private static void creationInstalledMissingKeyRefuses()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();Key key=syntheticExistingSharedKey();MemoryKeyStore.keys.put(AndroidKeystoreCipher.KEY_ALIAS,key);
            var cipher=new AndroidKeystoreCipher();char[] clear="synthetic retained original ciphertext".toCharArray();
            try{
                EncryptedSecret saved=cipher.encryptWithExistingKey(clear);readable(cipher,saved,clear);
                // Simulated external alias loss in this EXISTING memory-only
                // KeyStore fixture, never a platform key deletion or new authority.
                MemoryKeyStore.keys.remove(AndroidKeystoreCipher.KEY_ALIAS);
                MemoryKeyStore.keys.put("synthetic-unrelated-preserved-alias",key);
                var aliases=new HashMap<>(MemoryKeyStore.keys);
                var files=creationEpochFiles(x.dir);var identities=creationEpochKeys(x.dir);var raw=x.raw();
                creationRefused(()->cipher.encrypt(clear),RECREATION_REFUSED);
                creationRefused(()->new AndroidKeystoreCipher().encrypt(clear),RECREATION_REFUSED);
                require(aliases.equals(MemoryKeyStore.keys)&&MemoryKeyStore.deletions==0,"missing_alias_regenerated_or_deleted");
                creationEpochSame(files,identities,x.dir);require(raw.equals(x.raw()),"missing_alias_changed_original_rows");
                creationRefused(()->cipher.decrypt(saved),"custodial_native_vault_key_missing");
            }finally{java.util.Arrays.fill(clear,'\0');}
        }
    }
    private static void creationFailedRecoveryRefuses()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.bootstrap();var current=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);
            java.nio.file.Files.copy(current,x.root.resolve("preserved-original-shared-key-epoch"));
            byte[] damaged=java.nio.file.Files.readAllBytes(current);damaged[damaged.length-1]^=1;
            java.nio.file.Files.write(current,damaged);
            var files=creationEpochFiles(x.dir);var identities=creationEpochKeys(x.dir);var raw=x.raw();
            creationRefused(()->AndroidProtectedWorkPreferences.recoverExistingMutationEpochJournalFromNativeNoBackupRoot(x.root.toFile()),
                AndroidProtectedWorkPreferences.FAILURE);
            char[] clear="synthetic uncreated shared alias".toCharArray();
            try{
                creationRefused(()->new AndroidKeystoreCipher().encrypt(clear),RECREATION_REFUSED);
                require(MemoryKeyStore.keys.isEmpty()&&MemoryKeyStore.deletions==0,"failed_recovery_generated_shared_alias");
                creationEpochSame(files,identities,x.dir);require(raw.equals(x.raw()),"failed_recovery_changed_original_rows");
            }finally{java.util.Arrays.fill(clear,'\0');java.util.Arrays.fill(damaged,(byte)0);}
        }
    }
    private static void creationUnjournaledGuardPrerequisite()throws Exception {
        creationRefused(AndroidProtectedWorkPreferences::requireUnjournaledInitialSharedKeyCreation,RECREATION_REFUSED);
        synchronized(AndroidProtectedWorkPreferences.retainedCommitLock()){
            AndroidProtectedWorkPreferences.requireUnjournaledInitialSharedKeyCreation();
        }
        require(MemoryKeyStore.keys.isEmpty()&&MemoryKeyStore.loads==0&&MemoryKeyStore.deletions==0,
            "initial_guard_touched_keystore");
        System.out.println("UNJOURNALED_GUARD_PREREQUISITE_DATA_ONLY; INITIAL_ANDROID_KEY_GENERATION_NOT_RUN");
    }
    private static void creationCoordinatorBeforeCipher()throws Exception {
        Key key=syntheticExistingSharedKey();MemoryKeyStore.keys.put(AndroidKeystoreCipher.KEY_ALIAS,key);
        var cipher=new AndroidKeystoreCipher();char[] clear="synthetic lock-order original".toCharArray();
        EncryptedSecret retained=cipher.encryptWithExistingKey(clear);
        var entered=new java.util.concurrent.CountDownLatch(1);
        var thread=new java.util.concurrent.atomic.AtomicReference<Thread>();
        var executor=java.util.concurrent.Executors.newSingleThreadExecutor();
        java.util.concurrent.Future<EncryptedSecret> pending=null;
        Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
        try{
            synchronized(coordinator){
                pending=executor.submit(()->{thread.set(Thread.currentThread());entered.countDown();return cipher.encrypt(clear);});
                require(entered.await(3,java.util.concurrent.TimeUnit.SECONDS),"creation_writer_not_scheduled");
                long until=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
                while(thread.get().getState()!=Thread.State.BLOCKED&&!pending.isDone()&&System.nanoTime()<until)Thread.yield();
                require(!pending.isDone()&&thread.get().getState()==Thread.State.BLOCKED,"creation_writer_did_not_wait_for_coordinator");
                var info=java.lang.management.ManagementFactory.getThreadMXBean().getThreadInfo(
                    new long[]{thread.get().threadId()},true,true)[0];
                require(info!=null&&info.getLockInfo()!=null
                    &&info.getLockInfo().getIdentityHashCode()==System.identityHashCode(coordinator),
                    "creation_writer_waited_on_wrong_lock");
                for(var monitor:info.getLockedMonitors())
                    require(monitor.getIdentityHashCode()!=System.identityHashCode(cipher),"creation_writer_took_cipher_before_coordinator");
                // Safe after the public monitor observation: a reversed-order
                // implementation fails above, never recreates a deadlocked JVM.
                synchronized(cipher){readable(cipher,retained,clear);}
            }
            EncryptedSecret created=pending.get(3,java.util.concurrent.TimeUnit.SECONDS);readable(cipher,created,clear);
            require(MemoryKeyStore.keys.get(AndroidKeystoreCipher.KEY_ALIAS)==key&&MemoryKeyStore.deletions==0,
                "lock_order_changed_shared_key");
        }finally{
            executor.shutdownNow();
            require(executor.awaitTermination(3,java.util.concurrent.TimeUnit.SECONDS),"creation_writer_executor_not_closed");
            java.util.Arrays.fill(clear,'\0');
        }
    }
    private static void runCreationGuardMember(String member)throws Exception {
        require(java.util.Set.of("KEY_CREATION_existingAliasReadOnly",
            "KEY_CREATION_installedOriginalMissingAliasRefuses",
            "KEY_CREATION_failedMetadataRecoveryRefuses",
            "KEY_CREATION_unjournaledGuardPrerequisite",
            "KEY_CREATION_coordinatorBeforeCipher").contains(member),"new_creation_guard_member_required");
        String providerName="CustodialSyntheticSharedKeyRegression";
        require(Security.getProviders("KeyStore.AndroidKeyStore")==null,"host_android_keystore_forbidden");
        Provider provider=new Provider(providerName,"1.0","Memory-only isolated source regression"){};
        provider.put("KeyStore.AndroidKeyStore",MemoryKeyStore.class.getName());Security.addProvider(provider);
        try{
            switch(member){
                case "KEY_CREATION_existingAliasReadOnly":creationExistingKeyReadOnly();break;
                case "KEY_CREATION_installedOriginalMissingAliasRefuses":creationInstalledMissingKeyRefuses();break;
                case "KEY_CREATION_failedMetadataRecoveryRefuses":creationFailedRecoveryRefuses();break;
                case "KEY_CREATION_unjournaledGuardPrerequisite":creationUnjournaledGuardPrerequisite();break;
                case "KEY_CREATION_coordinatorBeforeCipher":creationCoordinatorBeforeCipher();break;
                default:throw new AssertionError("unreachable_creation_member");
            }
            passed("NEW_"+member);
            System.out.println("SOURCE_HOST_MEMORY_KEYSTORE_ONLY; ANDROID_INITIAL_GENERATION_HELD_ACK_FINALIZATION_G04_NOT_RUN");
        }finally{MemoryKeyStore.keys.clear();Security.removeProvider(providerName);}
    }
    public static void main(String[] args) throws Exception {
        if(args.length==2&&"--shared-key-creation-guard-only".equals(args[0])){
            runCreationGuardMember(args[1]);return;
        }
        String providerName = "CustodialSyntheticSharedKeyRegression";
        require(Security.getProviders("KeyStore.AndroidKeyStore") == null, "host_android_keystore_forbidden");
        Provider provider = new Provider(providerName, "1.0", "Memory-only isolated source regression") {};
        provider.put("KeyStore.AndroidKeyStore", MemoryKeyStore.class.getName());
        Security.addProvider(provider);
        char[] original = "synthetic retained cleaning work".toCharArray();
        try {
            KeyGenerator generator = KeyGenerator.getInstance("AES"); generator.init(128);
            Key key = generator.generateKey(); MemoryKeyStore.keys.put(AndroidKeystoreCipher.KEY_ALIAS, key);
            AndroidKeystoreCipher enrollment = new AndroidKeystoreCipher();
            AndroidKeystoreCipher work = new AndroidKeystoreCipher(
                "org.memphiszoo.custodial.native-vault.offline-authority-time.v1", 131_072);
            EncryptedSecret retained = work.encryptWithExistingKey(original);
            readable(work, retained, original);
            refused(() -> enrollment.decrypt(retained), "custodial_native_vault_decrypt_failed");
            passed("distinct_authenticated_domain_retained");
            int loads = MemoryKeyStore.loads;
            refused(() -> enrollment.destroyKey(), "custodial_native_shared_key_retirement_refused");
            require(MemoryKeyStore.loads == loads && MemoryKeyStore.deletions == 0, "retirement_touched_keystore");
            require(MemoryKeyStore.keys.get(AndroidKeystoreCipher.KEY_ALIAS) == key, "key_identity_changed");
            readable(work, retained, original); passed("enrollment_retirement_preserves_exact_key_and_work");
            refused(() -> work.destroyKey(), "custodial_native_shared_key_retirement_refused");
            readable(work, retained, original); passed("other_AAD_caller_cannot_retire_shared_alias");
            readable(new AndroidKeystoreCipher("org.memphiszoo.custodial.native-vault.offline-authority-time.v1", 131_072), retained, original);
            passed("new_adapter_reads_retained_ciphertext_after_refusal");

            String operation = "44444444-4444-4444-8444-444444444444";
            VaultSnapshot tombstone = new VaultSnapshot(11, VaultPhase.REMOVAL_TOMBSTONE,
                SecretKind.NONE, null, "22222222-2222-4222-8222-222222222222", "KIOSK_08", "", 0,
                null, EnrollmentMetadata.empty(), operation, "", false, "");
            class RetainedPersistence implements VaultPersistence {
                VaultSnapshot state = tombstone; int commits;
                public VaultSnapshot load() { return state; }
                public void commit(long revision, VaultSnapshot next) throws VaultFailure {
                    commits++; throw new VaultFailure("unexpected_test_commit");
                }
            }
            RetainedPersistence persistence = new RetainedPersistence();
            VaultEngine engine = new VaultEngine(persistence, enrollment, null, null, null, null);
            refused(() -> engine.finalizeRemoval(operation), "custodial_native_shared_key_retirement_refused");
            Map<String,Object> state = engine.observeStateReadOnly();
            require(persistence.state == tombstone && persistence.commits == 0, "tombstone_not_retained");
            require("REMOVAL_TOMBSTONE".equals(state.get("state")) && Boolean.TRUE.equals(state.get("removal_pending"))
                && Boolean.FALSE.equals(state.get("removal_finalized")) && Boolean.FALSE.equals(state.get("credential_present")), "false_finalization_or_authority");
            require(operation.equals(state.get("removal_operation_id")) && "KIOSK_08".equals(state.get("removal_device_id")), "original_identity_lost");
            readable(work, retained, original); passed("actual_finalizer_preserves_pending_tombstone_without_success");
            refused(() -> engine.finalizeRemoval(operation), "custodial_native_shared_key_retirement_refused");
            require(persistence.state == tombstone && persistence.commits == 0, "replay_changed_tombstone");
            readable(work, retained, original); passed("same_operation_replay_cannot_delete_or_finalize");
            refused(() -> engine.finalizeRemoval("55555555-5555-4555-8555-555555555555"), "custodial_native_removal_not_complete");
            require(persistence.state == tombstone && persistence.commits == 0 && MemoryKeyStore.deletions == 0, "foreign_operation_changed_state");
            passed("foreign_operation_still_refused_before_key_retirement");
            MemoryKeyStore.keys.clear(); loads = MemoryKeyStore.loads;
            refused(() -> new AndroidKeystoreCipher().destroyKey(), "custodial_native_shared_key_retirement_refused");
            require(MemoryKeyStore.keys.isEmpty() && MemoryKeyStore.loads == loads && MemoryKeyStore.deletions == 0, "absent_alias_created_or_inspected");
            passed("missing_key_does_not_authorize_finalization_or_key_creation");
            System.out.println("RESULT {\"cases\":"+cases+",\"pass\":"+cases+",\"fail\":0,\"skip\":0,\"actual_finalizer_executed\":true,\"synthetic_memory_only_keystore\":true,\"phone_proof\":false}");
        } finally {
            java.util.Arrays.fill(original, '\0'); MemoryKeyStore.keys.clear(); Security.removeProvider(providerName);
        }
    }
}
