package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual compiled Android adapter with synthetic preferences/JCE keys.
 * Does NOT claim AndroidKeyStore, process death or device storage instrumentation. */
public final class AndroidProviderAdapterTest {
    /** New lock-order member only; synthetic preferences, no Android IO. */
    public static void main(String[] args)throws Exception {
        if(args.length==2&&"--provider-key-writer-only".equals(args[0])){
            if(!Set.of("KEY_WRITER_existingKeyInitializationIsReadOnly",
                "KEY_WRITER_absentKeyCreatesUnderActualInstalledLockOnce",
                "KEY_WRITER_concurrentlyPresentKeyIsNeverReplaced",
                "KEY_WRITER_changedEpochBeforeCreateRefuses",
                "KEY_WRITER_unknownMarkerBeforeCreateRefuses",
                "KEY_WRITER_existingWorkHoldRefusesBeforeKeys",
                "KEY_WRITER_populatedInsideWriterRefusesWithoutCreation",
                "KEY_WRITER_nullCreateRetainsUnknownWithoutReplay",
                "KEY_WRITER_throwingReadbackRetainsUnknownWithoutReplay").contains(args[1]))
                throw new IllegalArgumentException("new_provider_key_writer_member_required");
            var result=new org.junit.runner.JUnitCore().run(org.junit.runner.Request.method(AndroidProviderAdapterTest.class,args[1]));
            if(result.getRunCount()!=1||!result.wasSuccessful()){
                for(var failure:result.getFailures())System.err.println(failure.getTrace());throw new AssertionError(args[1]);
            }
            System.out.println("PASS_NEW_PROVIDER_KEY_WRITER "+args[1]+"; synthetic Keys/WORK and actual host epoch lock only; not AndroidKeyStore/durable HELD/ACK/G04 proof");return;
        }
        if(args.length==1&&"--vault-durable-fence-lock-order-empty-only".equals(args[0])){
            new AndroidProviderAdapterTest().emptyVaultCoordinatorFreezeSettlesQueuedWriter();
            System.out.println("PASS_NEW_EMPTY_VAULT_COORDINATOR_LOCK_ORDER synthetic preferences only; nonempty vault/bootstrap/Android NOT_QUALIFIED");return;
        }
        if(args.length!=1||!"--vault-durable-fence-lock-order-only".equals(args[0]))
            throw new IllegalArgumentException("focused lock-order selector required");
        new AndroidProviderAdapterTest().vaultCoordinatorReadAndFreezeDoNotDeadlockQueuedVaultWriter();
        System.out.println("PASS_NEW_VAULT_COORDINATOR_LOCK_ORDER synthetic preferences only; not Android/bootstrap/ACK proof");
    }
    private interface KeyWriterCheck { void run() throws Exception; }
    private interface KeyReadCheck { void run(int read) throws Exception; }
    private static final class KeyWriterProbe implements ProviderEnvelopeCrypto.Keys {
        final ProviderRecordStoreTest.Keys synthetic = new ProviderRecordStoreTest.Keys();
        javax.crypto.SecretKey value;
        int reads, creations;
        KeyWriterCheck beforeCreate = () -> {};
        KeyReadCheck beforeRead = read -> {};
        String outcome = "success";
        @Override public javax.crypto.SecretKey existing() throws Exception {
            beforeRead.run(++reads);
            if ("throw-readback".equals(outcome) && creations != 0)
                throw new java.io.IOException("synthetic key readback uncertainty");
            return value;
        }
        @Override public javax.crypto.SecretKey createInEmptyNamespace() throws Exception {
            creations++;beforeCreate.run();value = synthetic.createInEmptyNamespace();
            return "null-create".equals(outcome) ? null : value;
        }
    }
    private static Map<String,byte[]> keyEpochFiles(java.nio.file.Path directory)throws Exception {
        var result = new java.util.TreeMap<String,byte[]>();
        try(var paths = java.nio.file.Files.newDirectoryStream(directory)){
            for(var path:paths)result.put(path.getFileName().toString(),java.nio.file.Files.readAllBytes(path));
        }
        return result;
    }
    private static void keyEpochSame(Map<String,byte[]> expected,java.nio.file.Path directory)throws Exception {
        var actual=keyEpochFiles(directory);assertEquals(expected.keySet(),actual.keySet());
        for(String name:expected.keySet())assertArrayEquals(name,expected.get(name),actual.get(name));
    }
    private static void keyWriterRefused(ProviderRecordStoreTest.Attempt attempt)throws Exception {
        try{attempt.run();fail("provider key writer should refuse");}catch(VaultFailure expected){}
    }
    private static void keyWriterLockHeld(NativePrivateCustodyOperationTest.DurableJoinFixture x)throws Exception {
        assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
        try(var channel=java.nio.channels.FileChannel.open(x.dir.resolve(NativePrivateMutationEpochStore.LOCK),
            java.nio.file.StandardOpenOption.WRITE)){
            boolean blocked=false;
            try(var competing=channel.tryLock()){blocked=competing==null;}
            catch(java.nio.channels.OverlappingFileLockException expected){blocked=true;}
            assertTrue("actual installed epoch FileLock must cover synthetic key creation/readback",blocked);
        }
    }
    @Test public void KEY_WRITER_existingKeyInitializationIsReadOnly()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();work.disk.put("retained_work","unchanged");
            var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
            var keys=new KeyWriterProbe();keys.value=new javax.crypto.spec.SecretKeySpec(new byte[32],"AES");
            int[]namespace={0};
            var cipher=new AndroidProviderCipher(keys,()->{namespace[0]++;return provider.disk.isEmpty();},gate);
            var records=new AndroidProviderStore(provider.object(),gate,cipher).records();
            var files=keyEpochFiles(x.dir);long counter=x.counter();var raw=x.raw();var workBefore=new HashMap<>(work.disk);
            assertEquals(0,records.load().revision);assertEquals(0,records.load().revision);
            assertEquals(0,keys.creations);assertEquals(0,namespace[0]);assertEquals(counter,x.counter());
            keyEpochSame(files,x.dir);assertEquals(raw,x.raw());assertEquals(workBefore,work.disk);
            assertTrue(provider.disk.isEmpty());assertEquals(0,provider.commits);assertEquals(0,work.commits);
        }
    }
    @Test public void KEY_WRITER_absentKeyCreatesUnderActualInstalledLockOnce()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();work.disk.put("retained_work","unchanged");
            var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());var keys=new KeyWriterProbe();
            keys.beforeCreate=()->keyWriterLockHeld(x);
            keys.beforeRead=read->{if(keys.creations!=0)keyWriterLockHeldOrFinished(x);};
            var cipher=new AndroidProviderCipher(keys,()->provider.disk.isEmpty(),gate);
            var records=new AndroidProviderStore(provider.object(),gate,cipher).records();
            long counter=x.counter();var raw=x.raw();var workBefore=new HashMap<>(work.disk);
            assertEquals(0,records.load().revision);assertEquals(counter+1,x.counter());assertEquals(1,keys.creations);
            assertEquals(0,records.load().revision);assertEquals(counter+1,x.counter());assertEquals(1,keys.creations);
            assertFalse(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
            assertTrue(provider.disk.isEmpty());assertEquals(0,provider.commits);assertEquals(1,work.commits);
            // The actual bound writer intentionally retains its existing WORK
            // mutation stamp; original rows are not replaced or normalized.
            assertTrue(work.disk.get(AndroidProtectedWorkPreferences.MUTATION_KEY) instanceof String);
            var stamped=new HashMap<>(workBefore);
            stamped.put(AndroidProtectedWorkPreferences.MUTATION_KEY,work.disk.get(AndroidProtectedWorkPreferences.MUTATION_KEY));
            assertEquals(stamped,work.disk);assertEquals(raw,x.raw());
        }
    }
    private static void keyWriterLockHeldOrFinished(NativePrivateCustodyOperationTest.DurableJoinFixture x)throws Exception {
        // initialize performs a further read-only existing-key check after
        // its guarded create returns; only the readback INSIDE UNKNOWN is an effect boundary.
        if(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)))keyWriterLockHeld(x);
    }
    @Test public void KEY_WRITER_concurrentlyPresentKeyIsNeverReplaced()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
            var keys=new KeyWriterProbe();var supplied=new javax.crypto.spec.SecretKeySpec(new byte[32],"AES");
            keys.beforeRead=read->{if(read==2){keyWriterLockHeld(x);keys.value=supplied;}};
            var cipher=new AndroidProviderCipher(keys,()->provider.disk.isEmpty(),gate);
            assertEquals(0,new AndroidProviderStore(provider.object(),gate,cipher).records().load().revision);
            assertSame(supplied,keys.value);assertEquals(0,keys.creations);assertEquals(0,provider.commits);
        }
    }
    @Test public void KEY_WRITER_changedEpochBeforeCreateRefuses()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
            var keys=new KeyWriterProbe();
            keys.beforeRead=read->{if(read==1){
                var file=x.dir.resolve(NativePrivateMutationEpochStore.CURRENT);byte[] bytes=java.nio.file.Files.readAllBytes(file);
                java.nio.file.Files.move(file,x.root.resolve("preserved-original-key-writer-current"));
                java.nio.file.Files.write(file,bytes,java.nio.file.StandardOpenOption.CREATE_NEW);
                java.nio.file.Files.setPosixFilePermissions(file,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            }};
            var cipher=new AndroidProviderCipher(keys,()->provider.disk.isEmpty(),gate);
            var records=new AndroidProviderStore(provider.object(),gate,cipher).records();
            keyWriterRefused(records::load);var files=keyEpochFiles(x.dir);keyWriterRefused(records::load);
            keyEpochSame(files,x.dir);assertEquals(0,keys.creations);assertEquals(0,provider.commits);assertTrue(work.disk.isEmpty());
        }
    }
    @Test public void KEY_WRITER_unknownMarkerBeforeCreateRefuses()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
            var keys=new KeyWriterProbe();
            keys.beforeRead=read->{if(read==1){
                var file=x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN);
                java.nio.file.Files.write(file,new byte[]{4,3,2,1},java.nio.file.StandardOpenOption.CREATE_NEW);
                java.nio.file.Files.setPosixFilePermissions(file,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            }};
            var cipher=new AndroidProviderCipher(keys,()->provider.disk.isEmpty(),gate);
            var records=new AndroidProviderStore(provider.object(),gate,cipher).records();
            keyWriterRefused(records::load);var files=keyEpochFiles(x.dir);keyWriterRefused(records::load);
            keyEpochSame(files,x.dir);assertEquals(0,keys.creations);assertEquals(0,provider.commits);assertTrue(work.disk.isEmpty());
        }
    }
    @Test public void KEY_WRITER_existingWorkHoldRefusesBeforeKeys()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
            gate.freeze(gate.protectedSnapshot(),"synthetic existing WORK preservation fence");
            var keys=new KeyWriterProbe();var cipher=new AndroidProviderCipher(keys,()->provider.disk.isEmpty(),gate);
            var files=keyEpochFiles(x.dir);var raw=new HashMap<>(work.disk);
            keyWriterRefused(new AndroidProviderStore(provider.object(),gate,cipher).records()::load);
            keyEpochSame(files,x.dir);assertEquals(raw,work.disk);assertEquals(0,keys.creations);assertEquals(0,keys.reads);
            assertTrue(provider.disk.isEmpty());assertEquals(0,provider.commits);
        }
    }
    @Test public void KEY_WRITER_populatedInsideWriterRefusesWithoutCreation()throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
            var keys=new KeyWriterProbe();int[]checks={0};
            var cipher=new AndroidProviderCipher(keys,()->{
                if(++checks[0]==2){keyWriterLockHeld(x);provider.disk.put("unknown_original","retained bytes");}
                return provider.disk.isEmpty();
            },gate);
            var records=new AndroidProviderStore(provider.object(),gate,cipher).records();
            keyWriterRefused(records::load);var files=keyEpochFiles(x.dir);keyWriterRefused(records::load);
            keyEpochSame(files,x.dir);assertEquals(0,keys.creations);assertEquals(Map.of("unknown_original","retained bytes"),provider.disk);
            assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
            assertEquals(0,provider.commits);assertEquals(1,work.commits);
            assertEquals(Set.of(AndroidProtectedWorkPreferences.MUTATION_KEY),work.disk.keySet());
        }
    }
    @Test public void KEY_WRITER_nullCreateRetainsUnknownWithoutReplay()throws Exception { keyWriterUnknown("null-create"); }
    @Test public void KEY_WRITER_throwingReadbackRetainsUnknownWithoutReplay()throws Exception { keyWriterUnknown("throw-readback"); }
    private static void keyWriterUnknown(String outcome)throws Exception {
        try(var x=new NativePrivateCustodyOperationTest.DurableJoinFixture()){
            x.install();var work=new Preferences();var provider=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
            var keys=new KeyWriterProbe();keys.outcome=outcome;keys.beforeCreate=()->keyWriterLockHeld(x);
            var cipher=new AndroidProviderCipher(keys,()->provider.disk.isEmpty(),gate);
            var records=new AndroidProviderStore(provider.object(),gate,cipher).records();
            var before=keyEpochFiles(x.dir);keyWriterRefused(records::load);
            assertEquals(1,keys.creations);assertNotNull(keys.value);
            assertArrayEquals(before.get(NativePrivateMutationEpochStore.CURRENT),
                java.nio.file.Files.readAllBytes(x.dir.resolve(NativePrivateMutationEpochStore.CURRENT)));
            assertTrue(java.nio.file.Files.exists(x.dir.resolve(NativePrivateMutationEpochStore.EXTERNAL_UNKNOWN)));
            var files=keyEpochFiles(x.dir);keyWriterRefused(records::load);keyWriterRefused(cipher::initialize);
            // New cipher/store cannot replay after the installed epoch has refused UNKNOWN.
            var recreated=new AndroidProviderCipher(keys,()->provider.disk.isEmpty(),gate);
            keyWriterRefused(new AndroidProviderStore(provider.object(),gate,recreated).records()::load);
            keyEpochSame(files,x.dir);assertEquals(1,keys.creations);assertTrue(provider.disk.isEmpty());
            assertEquals(0,provider.commits);assertEquals(1,work.commits);
            assertEquals(Set.of(AndroidProtectedWorkPreferences.MUTATION_KEY),work.disk.keySet());
            keyWriterRefused(x.journal::recoverCurrentMetadata);
        }
    }
    static final class Preferences {
        Map<String, Object> disk = new HashMap<>(); int commits, applies, clears;
        boolean fail, persistThenFail, corruptAfter;
        Runnable beforeCommit = () -> {};
        private SharedPreferences instance;
        SharedPreferences object() {
            if (instance != null) return instance;
            instance = (SharedPreferences) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{SharedPreferences.class}, (proxy, method, args) -> {
                if (method.getName().equals("getAll")) return new HashMap<>(disk);
                if (method.getName().equals("getString")) return disk.containsKey(args[0]) ? (String) disk.get(args[0]) : args[1];
                if (method.getName().equals("contains")) return disk.containsKey(args[0]);
                if (!method.getName().equals("edit")) throw new AssertionError("Unexpected preferences operation: " + method.getName());
                Map<String, String> puts = new HashMap<>(); Set<String> removes = new HashSet<>();
                return Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{SharedPreferences.Editor.class}, (editor, action, input) -> {
                    switch (action.getName()) {
                        case "putString": puts.put((String) input[0], (String) input[1]); return editor;
                        case "remove": removes.add((String) input[0]); return editor;
                        case "clear": clears++; throw new AssertionError("Namespace clear forbidden");
                        case "apply": applies++; throw new AssertionError("Async persistence forbidden");
                        case "commit":
                            commits++; beforeCommit.run(); if (fail) return false;
                            Map<String, Object> next = new HashMap<>(disk);
                            for (String key : removes) next.remove(key); next.putAll(puts); disk = next;
                            if (corruptAfter) disk.put("stray", "synthetic failed readback");
                            return !persistThenFail;
                        default: throw new AssertionError("Unexpected editor operation: " + action.getName());
                    }
                });
            });
            return instance;
        }
    }
    static ProviderEnvelopeCrypto crypto(Preferences p, ProviderRecordStoreTest.Keys keys) {
        return new ProviderEnvelopeCrypto(keys, () -> p.disk.isEmpty(), AndroidProviderCipher.STORE_LOCK);
    }
    static ProviderRecordStore store(Preferences p, ProviderRecordStoreTest.Keys keys) {
        return guardedStore(p, keys, new Preferences());
    }
    static ProviderRecordStore guardedStore(Preferences p, ProviderRecordStoreTest.Keys keys,
        Preferences work) {
        return new AndroidProviderStore(p.object(), new AndroidProtectedWorkPreferences(work.object()), crypto(p, keys)).records();
    }
    static ProviderRecordStore.Key key(ProviderEnvelopeCrypto.Domain domain, String id) { return ProviderRecordStore.key(domain, id); }

    @Test public void actualCipherHasSeparateFixedAliasAndNoEnrollmentOrDeletionApi() {
        assertEquals("org.memphiszoo.custodial.native-provider.v1", AndroidProviderCipher.KEY_ALIAS);
        assertNotEquals(AndroidKeystoreCipher.KEY_ALIAS, AndroidProviderCipher.KEY_ALIAS);
        assertFalse(CredentialCipher.class.isAssignableFrom(AndroidProviderCipher.class));
        assertEquals(2, AndroidProviderCipher.class.getDeclaredConstructors().length);
        Set<java.util.List<Class<?>>> signatures = new HashSet<>();
        for (Constructor<?> constructor : AndroidProviderCipher.class.getDeclaredConstructors())
            signatures.add(java.util.Arrays.asList(constructor.getParameterTypes()));
        assertEquals(Set.of(java.util.Arrays.<Class<?>>asList(ProviderEnvelopeCrypto.Namespace.class, AndroidProtectedWorkPreferences.class),
            java.util.Arrays.<Class<?>>asList(ProviderEnvelopeCrypto.Keys.class, ProviderEnvelopeCrypto.Namespace.class,
                AndroidProtectedWorkPreferences.class)), signatures);
        Set<String> names = new HashSet<>(); for (Method method : AndroidProviderCipher.class.getDeclaredMethods()) names.add(method.getName());
        assertEquals(new HashSet<>(java.util.Arrays.asList("initialize", "encrypt", "decrypt")), names);
        assertEquals("MemphisZooCustodialNativeProviderV1", AndroidProviderStore.PREFERENCES);
    }
    @Test public void actualAdapterUsesOneCommitAndNoClearApplyAcrossRestart() throws Exception {
        Preferences p = new Preferences(); ProviderRecordStoreTest.Keys keys = new ProviderRecordStoreTest.Keys();
        Map<ProviderRecordStore.Key, char[]> writes = ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.INBOX, "n"), "synthetic record");
        writes.put(key(ProviderEnvelopeCrypto.Domain.EVENT, "e"), "synthetic event".toCharArray());
        store(p, keys).commit(0, writes, Collections.emptySet());
        assertEquals(1, p.commits); assertEquals(0, p.clears); assertEquals(0, p.applies);
        ProviderRecordStore.Snapshot restarted = store(p, keys).load();
        assertEquals(1, restarted.revision); assertEquals(2, restarted.keys().size());
        assertEquals(1, keys.creations); assertFalse(p.disk.toString().contains("synthetic"));
    }
    @Test public void removalDeletesOnlyRequestedRecordAndRetainsIndexAndUnchangedCiphertext() throws Exception {
        Preferences p = new Preferences(); ProviderRecordStoreTest.Keys keys = new ProviderRecordStoreTest.Keys();
        ProviderRecordStore.Key a = key(ProviderEnvelopeCrypto.Domain.TOMBSTONE, "a"), b = key(ProviderEnvelopeCrypto.Domain.TOKEN, "b");
        Map<ProviderRecordStore.Key, char[]> writes = ProviderRecordStoreTest.values(a, "settled expired"); writes.put(b, "keep".toCharArray());
        store(p, keys).commit(0, writes, Collections.emptySet()); Object unchanged = p.disk.get(b.storageName());
        store(p, keys).commit(1, Collections.emptyMap(), Collections.singleton(a));
        assertFalse(p.disk.containsKey(a.storageName())); assertEquals(unchanged, p.disk.get(b.storageName()));
        assertTrue(p.disk.containsKey("index")); assertEquals(2, p.commits); assertEquals(0, p.clears);
    }
    @Test public void actualFailedCommitDoesNotExposeAnAcceptedSnapshot() throws Exception {
        Preferences p = new Preferences(); ProviderRecordStoreTest.Keys keys = new ProviderRecordStoreTest.Keys(); p.fail = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> store(p, keys).commit(0,
            ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "e"), "pending"), Collections.emptySet()));
        assertTrue(p.disk.isEmpty()); assertEquals(1, p.commits);
    }
    @Test public void actualAmbiguousCommitIsPreservedAndRecoveredAfterAdapterRecreation() throws Exception {
        Preferences p = new Preferences(); ProviderRecordStoreTest.Keys keys = new ProviderRecordStoreTest.Keys(); p.persistThenFail = true;
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () -> store(p, keys).commit(0,
            ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "e"), "pending"), Collections.emptySet()));
        p.persistThenFail = false; assertEquals(1, store(p, keys).load().revision); assertEquals(1, store(p, keys).load().keys().size());
    }
    @Test public void actualReadbackFailurePreservesCiphertextInsteadOfRollingBackOverUnknownState() throws Exception {
        Preferences p = new Preferences(); ProviderRecordStoreTest.Keys keys = new ProviderRecordStoreTest.Keys(); p.corruptAfter = true;
        ProviderRecordStoreTest.failure("custodial_provider_readback_failed_preserved", () -> store(p, keys).commit(0,
            ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "e"), "pending"), Collections.emptySet()));
        assertTrue(p.disk.containsKey("EVENT:e")); assertTrue(p.disk.containsKey("index")); assertEquals(0, p.clears);
    }
    @Test public void sharedLockAndRevisionProtectDifferentAdapterInstances() throws Exception {
        Preferences p = new Preferences(); ProviderRecordStoreTest.Keys keys = new ProviderRecordStoreTest.Keys();
        ProviderRecordStore a = store(p, keys), b = store(p, keys);
        a.load(); b.load();
        a.commit(0, ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.TOKEN, "a"), "a"), Collections.emptySet());
        ProviderRecordStoreTest.failure("custodial_provider_concurrent_change", () -> b.commit(0,
            ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.TOKEN, "b"), "b"), Collections.emptySet()));
        assertEquals(1, p.commits); assertEquals(1, b.load().keys().size());
    }

    @Test public void providerFenceBlocksWritesAndKeyInitializationButRetainedReadStillWorks() throws Exception {
        for (String marker : new String[]{AndroidProtectedWorkPreferences.FENCE_KEY,
            AndroidProtectedWorkPreferences.PROBE_KEY, AndroidProtectedWorkPreferences.NFC_WRITE_KEY,
            AndroidProtectedWorkPreferences.NFC_GENERATION_KEY}) {
            Preferences p = new Preferences(); var keys = new ProviderRecordStoreTest.Keys();
            var work = new Preferences();
            var store = guardedStore(p, keys, work); var originalKey = key(ProviderEnvelopeCrypto.Domain.EVENT, "original");
            store.commit(0, ProviderRecordStoreTest.values(originalKey, "retained original"), Collections.emptySet());
            Map<String,Object> original = new HashMap<>(p.disk); int commits = p.commits, creations = keys.creations;
            work.disk.put(marker, 7); // Unknown/malformed bytes still deny ordinary admission.
            ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE, () -> store.commit(1,
                ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "new"), "replacement"), Collections.emptySet()));
            ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE, store::load);
            assertEquals(original, p.disk); assertEquals(commits, p.commits); assertEquals(creations, keys.creations);
            var retained = guardedStore(p, keys, work).loadRetained();
            assertEquals(1, retained.revision); assertArrayEquals("retained original".toCharArray(), retained.read(originalKey));
        }
    }

    @Test public void emptyFrozenProviderDoesNotCreateItsSeparateKeyOrNamespace() throws Exception {
        Preferences p = new Preferences(); var keys = new ProviderRecordStoreTest.Keys();
        var work = new Preferences(); work.disk.put(AndroidProtectedWorkPreferences.PROBE_KEY, "pending");
        var store = guardedStore(p, keys, work);
        ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE, store::load);
        ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE, () -> store.commit(0,
            ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "new"), "not admitted"), Collections.emptySet()));
        assertEquals(0, keys.creations); assertEquals(0, p.commits); assertTrue(p.disk.isEmpty());
    }

    @Test public void freezeBetweenProviderEncryptionAndReplacementCannotPersistNewBytes() throws Exception {
        Preferences p = new Preferences(); var keys = new ProviderRecordStoreTest.Keys();
        var work = new Preferences();
        var gate = new AndroidProtectedWorkPreferences(work.object()); var delegate = crypto(p, keys);
        ProviderRecordStore.Crypto raced = new ProviderRecordStore.Crypto() {
            public void initialize() throws VaultFailure { delegate.initialize(); }
            public char[] decrypt(ProviderEnvelopeCrypto.Domain domain, String id, ProviderEnvelopeCrypto.Envelope envelope) throws VaultFailure {
                return delegate.decrypt(domain, id, envelope);
            }
            public ProviderEnvelopeCrypto.Envelope encrypt(ProviderEnvelopeCrypto.Domain domain, String id, char[] value) throws VaultFailure {
                var encrypted = delegate.encrypt(domain, id, value);
                if (domain == ProviderEnvelopeCrypto.Domain.METADATA) gate.freeze(gate.protectedSnapshot(), "original protected fence");
                return encrypted;
            }
        };
        var store = new AndroidProviderStore(p.object(), gate, raced).records();
        ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE, () -> store.commit(0,
            ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "new"), "not persisted"), Collections.emptySet()));
        assertTrue(p.disk.isEmpty()); assertEquals(0, p.commits); assertTrue(gate.frozen());
    }

    @Test public void providerReplacementAndWorkFreezeShareOneCommitBoundary() throws Exception {
        Preferences p = new Preferences(); var keys = new ProviderRecordStoreTest.Keys();
        var work = new Preferences(); var gate = new AndroidProtectedWorkPreferences(work.object());
        var store = guardedStore(p, keys, work);
        var entered = new java.util.concurrent.CountDownLatch(1); var release = new java.util.concurrent.CountDownLatch(1);
        var freezing = new java.util.concurrent.CountDownLatch(1); var frozen = new java.util.concurrent.CountDownLatch(1);
        p.beforeCommit = () -> { entered.countDown(); try { if (!release.await(3, java.util.concurrent.TimeUnit.SECONDS)) throw new AssertionError("release timeout"); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); } };
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var writer = pool.submit(() -> store.commit(0, ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "original"), "accepted before fence"), Collections.emptySet()));
            assertTrue(entered.await(3, java.util.concurrent.TimeUnit.SECONDS));
            var freezer = pool.submit(() -> { freezing.countDown(); gate.freeze(gate.protectedSnapshot(), "protected fence"); frozen.countDown(); return true; });
            assertTrue(freezing.await(3, java.util.concurrent.TimeUnit.SECONDS));
            assertFalse(frozen.await(100, java.util.concurrent.TimeUnit.MILLISECONDS));
            release.countDown(); assertEquals(1, writer.get(3, java.util.concurrent.TimeUnit.SECONDS).revision);
            assertTrue(freezer.get(3, java.util.concurrent.TimeUnit.SECONDS));
            ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE, () -> store.commit(1, Collections.emptyMap(), Collections.singleton(key(ProviderEnvelopeCrypto.Domain.EVENT, "original"))));
            assertEquals(1, p.commits); assertEquals(1, store.loadRetained().keys().size());
        } finally { release.countDown(); pool.shutdownNow(); assertTrue(pool.awaitTermination(3, java.util.concurrent.TimeUnit.SECONDS)); }
    }

    @Test public void authoritativeVaultReplacementHonorsSameWorkFenceAndRetainsOriginalSnapshot() throws Exception {
        for (String marker : new String[]{AndroidProtectedWorkPreferences.FENCE_KEY,
            AndroidProtectedWorkPreferences.PROBE_KEY, AndroidProtectedWorkPreferences.NFC_WRITE_KEY,
            AndroidProtectedWorkPreferences.NFC_GENERATION_KEY}) {
            var work = new Preferences(); work.disk.put(marker, Boolean.FALSE);
            var vault = new Preferences(); var codec = new VaultSnapshotCodec(); var original = VaultSnapshot.empty();
            byte[] encoded = codec.encode(original);
            try { vault.disk.put("authoritative_snapshot", java.util.Base64.getEncoder().encodeToString(encoded)); }
            finally { java.util.Arrays.fill(encoded, (byte)0); }
            Map<String,Object> retained = new HashMap<>(vault.disk);
            var persistence = new SharedPreferencesVaultPersistence(vault.object(), codec,
                new AndroidProtectedWorkPreferences(work.object()));
            ProviderRecordStoreTest.failure(AndroidProtectedWorkPreferences.FAILURE,
                () -> persistence.commit(0, original));
            assertEquals(retained, vault.disk); assertEquals(0, vault.commits);
            assertTrue(persistence.matchesCapturedOriginalSnapshot(retained, original));
        }
    }

    @Test public void providerWriteInvalidatesSharedObservationWithoutChangingWorkBytes() throws Exception {
        var work = new Preferences(); var gate = new AndroidProtectedWorkPreferences(work.object());
        var original = gate.observeReadOnly();
        var provider = new Preferences(); var keys = new ProviderRecordStoreTest.Keys();
        guardedStore(provider, keys, work).commit(0,
            ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "epoch-success"), "original"),
            Collections.emptySet());
        assertEquals(original.values, work.disk);
        assertFalse("a provider write is part of the captured native store lifetime", gate.matchesReadOnly(original));
        assertTrue(gate.matchesReadOnly(gate.observeReadOnly()));
    }

    @Test public void failedProviderWriteInvalidatesSharedObservationBeforeAnyMemoryChange() throws Exception {
        var work = new Preferences(); var gate = new AndroidProtectedWorkPreferences(work.object());
        var original = gate.observeReadOnly(); var provider = new Preferences();
        provider.fail = true; var keys = new ProviderRecordStoreTest.Keys();
        ProviderRecordStoreTest.failure("custodial_provider_commit_failed_preserved", () ->
            guardedStore(provider, keys, work).commit(0,
                ProviderRecordStoreTest.values(key(ProviderEnvelopeCrypto.Domain.EVENT, "epoch-failure"), "pending"),
                Collections.emptySet()));
        assertEquals(1, provider.commits); assertTrue(provider.disk.isEmpty());
        assertEquals(original.values, work.disk);
        assertFalse("a false commit cannot preserve a prior all-store observation", gate.matchesReadOnly(original));
    }

    @Test public void vaultWriteInvalidatesSharedObservationAcrossSuccessAndFailedCommit() throws Exception {
        for (boolean failure : new boolean[]{false, true}) {
            var work = new Preferences(); var gate = new AndroidProtectedWorkPreferences(work.object());
            var original = gate.observeReadOnly(); var vault = new Preferences(); vault.fail = failure;
            var persistence = new SharedPreferencesVaultPersistence(vault.object(), new VaultSnapshotCodec(), gate);
            var empty = VaultSnapshot.empty();
            var next = empty.next(VaultPhase.EMPTY, SecretKind.NONE, null, "", "", "", 0, null,
                EnrollmentMetadata.empty(), "", "", false, "");
            if (failure) ProviderRecordStoreTest.failure("custodial_native_vault_commit_failed", () -> persistence.commit(0, next));
            else { persistence.commit(0, next); assertEquals(next, persistence.load()); }
            assertEquals(1, vault.commits); assertEquals(original.values, work.disk);
            assertFalse("vault attempts invalidate prior observations even on false", gate.matchesReadOnly(original));
        }
    }

    /** Exercise the actual reverse-order adapter entry while the native
     * coordinator is held, then freeze before the queued writer can enter.
     * No bootstrap token, credentials or native capability is manufactured. */
    @Test public void vaultCoordinatorReadAndFreezeDoNotDeadlockQueuedVaultWriter() throws Exception {
        var work=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
        var vault=new Preferences();var codec=new VaultSnapshotCodec();var original=VaultSnapshot.empty();
        byte[] bytes=codec.encode(original);
        try{vault.disk.put("authoritative_snapshot",java.util.Base64.getEncoder().encodeToString(bytes));}
        finally{java.util.Arrays.fill(bytes,(byte)0);}
        Map<String,Object> retained=new HashMap<>(vault.disk);
        var persistence=new SharedPreferencesVaultPersistence(vault.object(),codec,gate);
        var next=original.next(VaultPhase.EMPTY,SecretKind.NONE,null,"","","",0,null,EnrollmentMetadata.empty(),"","",false,"");
        Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
        var entered=new java.util.concurrent.CountDownLatch(1);
        var writerThread=new java.util.concurrent.atomic.AtomicReference<Thread>();
        var pool=java.util.concurrent.Executors.newSingleThreadExecutor();
        java.util.concurrent.Future<Void> writer=null;
        try {
            synchronized(coordinator){
                writer=pool.submit(()->{
                    writerThread.set(Thread.currentThread());entered.countDown();
                    persistence.commit(0,next);return null;
                });
                assertTrue("writer was not scheduled",entered.await(3,java.util.concurrent.TimeUnit.SECONDS));
                long until=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
                while(writerThread.get().getState()!=Thread.State.BLOCKED&&System.nanoTime()<until&&!writer.isDone())Thread.yield();
                assertEquals("writer must wait for the owning coordinator",Thread.State.BLOCKED,writerThread.get().getState());
                // Fail safely on the old distinct monitor, before attempting
                // a read that would recreate an uninterruptible JVM deadlock.
                // Reflection inspects only a monitor, never an owner/token.
                var lock=SharedPreferencesVaultPersistence.class.getDeclaredField("COMMIT_LOCK");lock.setAccessible(true);
                assertSame("vault must use the existing native coordinator",coordinator,lock.get(null));
                assertFalse(writer.isDone());assertEquals(0,vault.commits);
                // This is the real adapter read/match path used under owning
                // source checks, not a proxy implementation of vault locking.
                assertEquals(original,persistence.load());
                assertTrue(persistence.matchesCapturedOriginalSnapshot(retained,original));
                gate.freeze(gate.protectedSnapshot(),"synthetic original protected fence");
                assertTrue(gate.frozen());assertEquals(retained,vault.disk);assertEquals(0,vault.commits);
            }
            try{writer.get(3,java.util.concurrent.TimeUnit.SECONDS);fail("queued writer crossed original freeze");}
            catch(java.util.concurrent.ExecutionException refused){
                assertTrue(refused.getCause() instanceof VaultFailure);
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,((VaultFailure)refused.getCause()).code);
            }
            assertEquals(retained,vault.disk);assertEquals(0,vault.commits);
            assertEquals(original,persistence.load());assertTrue(persistence.matchesCapturedOriginalSnapshot(retained,original));
            assertEquals(0,vault.applies);assertEquals(0,vault.clears);assertEquals(0,work.applies);assertEquals(0,work.clears);

            // The SAME monitor still protects unknown memory-vs-disk commit
            // state and exact revision retry; locking does not waive either.
            var uncertainVault=new Preferences();var liveWork=new Preferences();
            var uncertain=new SharedPreferencesVaultPersistence(uncertainVault.object(),codec,new AndroidProtectedWorkPreferences(liveWork.object()));
            uncertainVault.persistThenFail=true;
            ProviderRecordStoreTest.failure("custodial_native_vault_commit_failed",()->uncertain.commit(0,next));
            Map<String,Object> uncertainBytes=new HashMap<>(uncertainVault.disk);
            ProviderRecordStoreTest.failure("custodial_native_vault_durability_unconfirmed",uncertain::load);
            ProviderRecordStoreTest.failure("custodial_native_vault_durability_unconfirmed",
                ()->uncertain.matchesCapturedOriginalSnapshot(uncertainBytes,next));
            uncertainVault.persistThenFail=false;uncertain.commit(0,next);
            assertEquals(uncertainBytes,uncertainVault.disk);assertEquals(next,uncertain.load());
            assertTrue(uncertain.matchesCapturedOriginalSnapshot(uncertainBytes,next));
            ProviderRecordStoreTest.failure("custodial_native_vault_concurrent_change",()->uncertain.commit(0,next));
            assertEquals(uncertainBytes,uncertainVault.disk);
        } finally {
            pool.shutdownNow();assertTrue("owned writer did not settle",pool.awaitTermination(3,java.util.concurrent.TimeUnit.SECONDS));
        }
    }

    /** Empty authoritative vault is a legitimate adapter state. This isolates
     * the SAME monitor acquisition from the unavailable SDK Base64 runtime.
     * It does not qualify a nonempty vault, uncertainty recovery or bootstrap. */
    @Test public void emptyVaultCoordinatorFreezeSettlesQueuedWriter() throws Exception {
        var work=new Preferences();var gate=new AndroidProtectedWorkPreferences(work.object());
        var vault=new Preferences();var original=VaultSnapshot.empty();
        var persistence=new SharedPreferencesVaultPersistence(vault.object(),new VaultSnapshotCodec(),gate);
        var next=original.next(VaultPhase.EMPTY,SecretKind.NONE,null,"","","",0,null,EnrollmentMetadata.empty(),"","",false,"");
        Map<String,Object> originalVault=new HashMap<>(vault.disk),originalWork=new HashMap<>(work.disk),frozenWork;
        Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
        var entered=new java.util.concurrent.CountDownLatch(1);
        var writerThread=new java.util.concurrent.atomic.AtomicReference<Thread>();
        var pool=java.util.concurrent.Executors.newSingleThreadExecutor();
        java.util.concurrent.Future<Void> writer=null;int frozenWorkCommits;
        try {
            synchronized(coordinator){
                writer=pool.submit(()->{
                    writerThread.set(Thread.currentThread());entered.countDown();
                    persistence.commit(0,next);return null;
                });
                assertTrue("writer was not scheduled",entered.await(3,java.util.concurrent.TimeUnit.SECONDS));
                long until=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
                while(writerThread.get().getState()!=Thread.State.BLOCKED&&System.nanoTime()<until&&!writer.isDone())Thread.yield();
                assertEquals("writer must wait for the owning coordinator",Thread.State.BLOCKED,writerThread.get().getState());
                // Fail safely on the predecessor distinct monitor, never
                // manufacture a native token or leave an old JVM deadlocked.
                var lock=SharedPreferencesVaultPersistence.class.getDeclaredField("COMMIT_LOCK");lock.setAccessible(true);
                assertSame("vault must use existing native coordinator",coordinator,lock.get(null));
                assertFalse(writer.isDone());assertEquals(0,vault.commits);assertEquals(originalVault,vault.disk);
                assertEquals(original,persistence.load());
                assertFalse("absent authoritative snapshot is not a matching saved snapshot",
                    persistence.matchesCapturedOriginalSnapshot(originalVault,original));
                assertEquals(originalVault,vault.disk);assertEquals(originalWork,work.disk);
                gate.freeze(gate.protectedSnapshot(),"synthetic original protected fence");
                assertTrue(gate.frozen());assertEquals(originalVault,vault.disk);assertEquals(0,vault.commits);
                for(var row:originalWork.entrySet())assertEquals(row.getValue(),work.disk.get(row.getKey()));
                frozenWork=new HashMap<>(work.disk);frozenWorkCommits=work.commits;
            }
            try{writer.get(3,java.util.concurrent.TimeUnit.SECONDS);fail("queued writer crossed original freeze");}
            catch(java.util.concurrent.ExecutionException refused){
                assertTrue(refused.getCause() instanceof VaultFailure);
                assertEquals(AndroidProtectedWorkPreferences.FAILURE,((VaultFailure)refused.getCause()).code);
            }
            assertEquals(originalVault,vault.disk);assertEquals(0,vault.commits);
            assertEquals(frozenWork,work.disk);assertEquals(frozenWorkCommits,work.commits);
            assertEquals(original,persistence.load());
            assertFalse(persistence.matchesCapturedOriginalSnapshot(originalVault,original));
            assertEquals(0,vault.applies);assertEquals(0,vault.clears);assertEquals(0,work.applies);assertEquals(0,work.clears);
        } finally {
            pool.shutdownNow();assertTrue("owned writer did not settle",pool.awaitTermination(3,java.util.concurrent.TimeUnit.SECONDS));
        }
    }
}
