package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.concurrent.atomic.AtomicInteger;

/** Entry refusal only. This never constructs a finalization control, current
 * manager/browser/HELD owner, cipher or authenticated terminal successor. */
public final class NativeOriginalInventoryFinalizationPersistenceTest {
    public static void main(String[] args) throws Exception {
        if (args.length == 1 && "--null-held-epoch-only".equals(args[0])) {
            nullHeldEpochOnly();
            return;
        }
        if (args.length == 1 && "--null-restored-read-only".equals(args[0])) {
            nullRestoredReadOnly();
            return;
        }
        if (args.length != 1 || !"--null-finalization-control-only".equals(args[0]))
            throw new IllegalArgumentException("Only the NEW null-control no-I/O member");
        AtomicInteger calls = new AtomicInteger();
        // A recording preferences interface, NOT reflection into any private
        // control or capability. Any namespace call is an immediate failure.
        SharedPreferences preferences = (SharedPreferences)Proxy.newProxyInstance(
            NativeOriginalInventoryFinalizationPersistenceTest.class.getClassLoader(),
            new Class<?>[]{SharedPreferences.class}, (proxy, method, arguments) -> {
                calls.incrementAndGet();
                throw new AssertionError("Refused owner reached namespace: " + method.getName());
            });
        VaultSnapshotCodec codec = new VaultSnapshotCodec();
        SharedPreferencesVaultPersistence[] adapters = {
            new SharedPreferencesVaultPersistence(preferences, codec),
            new SharedPreferencesVaultPersistence(preferences, codec,
                new AndroidProtectedWorkPreferences(preferences))
        };
        for (SharedPreferencesVaultPersistence adapter : adapters) {
            try {
                adapter.commitOriginalInventoryFinalization(null);
                throw new AssertionError("Null finalization control was accepted");
            } catch (VaultFailure failure) {
                if (!"custodial_native_original_inventory_finalization_persistence_unavailable".equals(failure.code))
                    throw failure;
            }
        }
        if (calls.get() != 0) throw new AssertionError("Refusal touched private preferences");
        System.out.println("PASS_NEW_NULL_FINALIZATION_CONTROL raw fixture and bound adapter refuse before namespace I/O");
        System.out.println("ENTRY_REFUSAL_ONLY; VALID_CONTROL_COMMIT_UNKNOWN_RESTART_HELD_WEBVIEW_ACK_NOT_RUN");
    }
    private static void nullRestoredReadOnly() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        // Recording storage interface only, not a fabricated private restored
        // issuer. Both constructors must refuse before touching the namespace.
        SharedPreferences preferences = (SharedPreferences)Proxy.newProxyInstance(
            NativeOriginalInventoryFinalizationPersistenceTest.class.getClassLoader(),
            new Class<?>[]{SharedPreferences.class}, (proxy, method, arguments) -> {
                calls.incrementAndGet();
                throw new AssertionError("Refused restored read reached namespace: " + method.getName());
            });
        VaultSnapshotCodec codec = new VaultSnapshotCodec();
        SharedPreferencesVaultPersistence[] adapters = {
            new SharedPreferencesVaultPersistence(preferences, codec),
            new SharedPreferencesVaultPersistence(preferences, codec,
                new AndroidProtectedWorkPreferences(preferences))
        };
        for (SharedPreferencesVaultPersistence adapter : adapters) {
            try {
                adapter.readOriginalInventoryFinalizationSnapshot(null);
                throw new AssertionError("Null restored read was accepted");
            } catch (VaultFailure failure) {
                if (!"custodial_native_original_inventory_finalization_readback_unavailable".equals(failure.code))
                    throw failure;
            }
        }
        if (calls.get() != 0) throw new AssertionError("Restored-read refusal touched private preferences");
        System.out.println("PASS_NEW_NULL_RESTORED_READ raw fixture and bound adapter refuse before namespace I/O");
        System.out.println("ENTRY_REFUSAL_ONLY; VALID_RESTORED_READ_MAP_UNCERTAINTY_HELD_RESTART_NOT_RUN");
    }
    private static void nullHeldEpochOnly() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        // Recording namespace only; no private control/epoch loan construction.
        SharedPreferences preferences = (SharedPreferences)Proxy.newProxyInstance(
            NativeOriginalInventoryFinalizationPersistenceTest.class.getClassLoader(),
            new Class<?>[]{SharedPreferences.class}, (proxy, method, arguments) -> {
                calls.incrementAndGet();
                throw new AssertionError("Absent held-epoch owner reached namespace: " + method.getName());
            });
        VaultSnapshotCodec codec = new VaultSnapshotCodec();
        SharedPreferencesVaultPersistence[] adapters = {
            new SharedPreferencesVaultPersistence(preferences, codec),
            new SharedPreferencesVaultPersistence(preferences, codec,
                new AndroidProtectedWorkPreferences(preferences))
        };
        for (SharedPreferencesVaultPersistence adapter : adapters) {
            try {
                adapter.commitOriginalInventoryFinalizationUnderHeldEpoch(null, null);
                throw new AssertionError("Absent control/held-epoch loan was accepted");
            } catch (VaultFailure failure) {
                if (!"custodial_native_original_inventory_finalization_persistence_unavailable".equals(failure.code))
                    throw failure;
            }
        }
        if (calls.get() != 0) throw new AssertionError("Absent-loan refusal touched private preferences");
        System.out.println("PASS_NEW_NULL_HELD_EPOCH raw fixture and bound adapter refuse before namespace I/O");
        System.out.println("ENTRY_REFUSAL_ONLY; VALID_LOAN_COMMIT_AMBIGUITY_OVERLAP_HELD_FINALIZATION_NOT_RUN");
    }
}
