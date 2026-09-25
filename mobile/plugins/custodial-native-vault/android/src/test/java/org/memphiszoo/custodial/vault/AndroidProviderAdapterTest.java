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
    static final class Preferences {
        Map<String, Object> disk = new HashMap<>(); int commits, applies, clears;
        boolean fail, persistThenFail, corruptAfter;
        SharedPreferences object() {
            return (SharedPreferences) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{SharedPreferences.class}, (proxy, method, args) -> {
                if (method.getName().equals("getAll")) return new HashMap<>(disk);
                if (!method.getName().equals("edit")) throw new AssertionError("Unexpected preferences operation: " + method.getName());
                Map<String, String> puts = new HashMap<>(); Set<String> removes = new HashSet<>();
                return Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{SharedPreferences.Editor.class}, (editor, action, input) -> {
                    switch (action.getName()) {
                        case "putString": puts.put((String) input[0], (String) input[1]); return editor;
                        case "remove": removes.add((String) input[0]); return editor;
                        case "clear": clears++; throw new AssertionError("Namespace clear forbidden");
                        case "apply": applies++; throw new AssertionError("Async persistence forbidden");
                        case "commit":
                            commits++; if (fail) return false;
                            Map<String, Object> next = new HashMap<>(disk);
                            for (String key : removes) next.remove(key); next.putAll(puts); disk = next;
                            if (corruptAfter) disk.put("stray", "synthetic failed readback");
                            return !persistThenFail;
                        default: throw new AssertionError("Unexpected editor operation: " + action.getName());
                    }
                });
            });
        }
    }
    static ProviderEnvelopeCrypto crypto(Preferences p, ProviderRecordStoreTest.Keys keys) {
        return new ProviderEnvelopeCrypto(keys, () -> p.disk.isEmpty(), AndroidProviderCipher.STORE_LOCK);
    }
    static ProviderRecordStore store(Preferences p, ProviderRecordStoreTest.Keys keys) {
        return new AndroidProviderStore(p.object(), crypto(p, keys)).records();
    }
    static ProviderRecordStore.Key key(ProviderEnvelopeCrypto.Domain domain, String id) { return ProviderRecordStore.key(domain, id); }

    @Test public void actualCipherHasSeparateFixedAliasAndNoEnrollmentOrDeletionApi() {
        assertEquals("org.memphiszoo.custodial.native-provider.v1", AndroidProviderCipher.KEY_ALIAS);
        assertNotEquals(AndroidKeystoreCipher.KEY_ALIAS, AndroidProviderCipher.KEY_ALIAS);
        assertFalse(CredentialCipher.class.isAssignableFrom(AndroidProviderCipher.class));
        assertEquals(1, AndroidProviderCipher.class.getDeclaredConstructors().length);
        Constructor<?> constructor = AndroidProviderCipher.class.getDeclaredConstructors()[0];
        assertArrayEquals(new Class<?>[]{ProviderEnvelopeCrypto.Namespace.class}, constructor.getParameterTypes());
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
}
