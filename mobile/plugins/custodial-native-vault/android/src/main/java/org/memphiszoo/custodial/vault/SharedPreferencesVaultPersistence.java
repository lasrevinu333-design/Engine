package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

/**
 * Android persistence adapter.  The entire authoritative state is one encoded
 * value, so a process can never observe a credential without its matching
 * phase, operation, device, and installation binding.
 */
final class SharedPreferencesVaultPersistence implements VaultPersistence {
    // Bootstrap/current-source checks already hold this native coordinator
    // before re-entering vault reads. A separate vault -> WORK lock would
    // invert that order. Keep snapshot/UNCERTAIN/admission under ONE monitor.
    private static final Object COMMIT_LOCK = AndroidProtectedWorkPreferences.retainedCommitLock();
    private static final String PREFERENCES = "MemphisZooCustodialNativeVaultV2";
    private static final String SNAPSHOT = "authoritative_snapshot";
    private static final String DURABILITY_UNCONFIRMED = "custodial_native_vault_durability_unconfirmed";
    private static final Map<SharedPreferences, PendingCommit> UNCERTAIN = new IdentityHashMap<>();

    private final SharedPreferences preferences;
    private final VaultSnapshotCodec codec;
    private final AndroidProtectedWorkPreferences workAdmission;

    SharedPreferencesVaultPersistence(Context context, VaultSnapshotCodec codec) {
        this(
            context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE),
            codec,
            AndroidOfflineAuthorityTimeStore.bindOrdinaryAdmission(context)
        );
    }

    /** Package-private fault-injection seam for compiled Android adapter tests. */
    SharedPreferencesVaultPersistence(SharedPreferences preferences, VaultSnapshotCodec codec) {
        this(preferences, codec, null);
    }

    /** Bound admission seam for owning adapter tests. Production context always
     * binds the fixed existing WORK namespace, never caller-selected authority. */
    SharedPreferencesVaultPersistence(SharedPreferences preferences, VaultSnapshotCodec codec,
        AndroidProtectedWorkPreferences workAdmission) {
        this.preferences = preferences;
        this.codec = codec;
        this.workAdmission = workAdmission;
    }

    @Override
    public VaultSnapshot load() throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            return loadLocked();
        }
    }

    /** Inspect ONLY this already-bound namespace. Exact complete raw compare,
     * original deterministic codec bytes and uncertain-commit guard; no load
     * fallback, edit, commit, new key or credential decryption. Extra rows are
     * not declared owned by the snapshot and stay unresolved in the census. */
    @Override public boolean matchesCapturedOriginalSnapshot(Map<String,?> raw,VaultSnapshot original) throws VaultFailure {
        synchronized(COMMIT_LOCK) {
            byte[] encoded=null;
            try {
                if(UNCERTAIN.containsKey(preferences))throw new VaultFailure(DURABILITY_UNCONFIRMED);
                if(raw==null||original==null||!raw.equals(preferences.getAll()))throw new VaultFailure("custodial_native_vault_census_source_changed");
                Object saved=raw.get(SNAPSHOT);
                if(!(saved instanceof String))return false;
                encoded=codec.encode(original);
                // Canonical source comparison only. Ordinary persistence codec,
                // load/commit and Android Base64 behavior remain unchanged.
                boolean matches=java.util.Base64.getEncoder().encodeToString(encoded).equals(saved);
                if(!raw.equals(preferences.getAll())||UNCERTAIN.containsKey(preferences))
                    throw new VaultFailure("custodial_native_vault_census_source_changed");
                return matches;
            } catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure("custodial_native_vault_census_unknown");}
            finally {if(encoded!=null)Arrays.fill(encoded,(byte)0);}
        }
    }

    @Override
    public void commit(long expectedRevision, VaultSnapshot next) throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            if (workAdmission != null) {
                // This is an attempted durable write, not merely encryption.
                // Invalidate shared observations before commit, even when
                // SharedPreferences reports false after changing memory.
                workAdmission.withOrdinaryWriteAdmission(() -> {
                    commitLocked(expectedRevision, next);
                    return null;
                });
            } else {
                // Existing raw-preferences fault/census fixture seam only.
                // All mounted runtime construction uses the Context binding.
                commitLocked(expectedRevision, next);
            }
        }
    }

    private void commitLocked(long expectedRevision, VaultSnapshot next) throws VaultFailure {
            byte[] encoded = codec.encode(next);
            try {
                String value = Base64.encodeToString(encoded, Base64.NO_WRAP);
                PendingCommit pending = UNCERTAIN.get(preferences);
                if (pending != null) {
                    // An UNKNOWN fixed finalization is never an ordinary
                    // idempotent retry, even if its candidate bytes match.
                    if (pending.originalInventoryFinalization) throw new VaultFailure(DURABILITY_UNCONFIRMED);
                    if (pending.expectedRevision != expectedRevision || !pending.encodedValue.equals(value)) {
                        throw new VaultFailure(DURABILITY_UNCONFIRMED);
                    }
                    commitAndVerifyLocked(value, encoded, next);
                    UNCERTAIN.remove(preferences);
                    return;
                }
                VaultSnapshot current = loadLocked();
                if (current.revision != expectedRevision || next.revision != expectedRevision + 1) {
                    throw new VaultFailure("custodial_native_vault_concurrent_change");
                }
                UNCERTAIN.put(preferences, new PendingCommit(expectedRevision, value));
                commitAndVerifyLocked(value, encoded, next);
                UNCERTAIN.remove(preferences);
            } finally {
                Arrays.fill(encoded, (byte) 0);
            }
    }

    /** Private fixed-original successor, not ordinary write admission. The
     * issuing Engine owns its monitor and the durable immutable intent. This
     * method grants no thaw, key removal or whole terminal-graph authority. */
    @Override public void commitOriginalInventoryFinalization(
        VaultEngine.NativeOriginalInventoryFinalizationControl control) throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            if (control == null || workAdmission == null) throw finalizationUnavailable();
            // Only the installed coordinator can retain the original HELD
            // epoch FileLock and issue this adapter's same-thread fixed loan.
            workAdmission.commitOriginalInventoryFinalization(this, control);
        }
    }

    @Override public void commitOriginalInventoryFinalizationUnderHeldEpoch(
        VaultEngine.NativeOriginalInventoryFinalizationControl control,
        NativePrivateMutationEpochStore.OriginalEnrollmentCommit held) throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            if (control == null || held == null || workAdmission == null) throw finalizationUnavailable();
            byte[] originalBytes = null, terminalBytes = null, readbackBytes = null, canonical = null;
            PendingCommit pending = null;
            try {
                // Refuse invalid/closed/foreign issuing lifetime before this
                // adapter reads the namespace. No raw-constructor promotion.
                held.requireForPersistence(this, control);
                control.requireBeforeCommit();
                if (UNCERTAIN.containsKey(preferences)) throw new VaultFailure(DURABILITY_UNCONFIRMED);
                VaultSnapshot original = control.originalSnapshot();
                VaultSnapshot terminal = control.terminalSnapshot();
                if (original == null || terminal == null || original.phase != VaultPhase.ACTIVE
                    || !original.hasCredential() || original.revision < 0 || original.revision == Long.MAX_VALUE
                    || !terminal.removalOperationId.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}"))
                    throw finalizationUnavailable();
                VaultSnapshot fixed = original.next(VaultPhase.EMPTY, SecretKind.NONE, null, "", original.deviceId,
                    "", 0, null, EnrollmentMetadata.empty(), terminal.removalOperationId, "", false, "");
                if (!fixed.equals(terminal)) throw finalizationUnavailable();
                originalBytes = codec.encode(original);
                terminalBytes = codec.encode(terminal);
                if (!codec.decode(originalBytes).equals(original) || !codec.decode(terminalBytes).equals(terminal))
                    throw finalizationUnavailable();
                String originalValue = Base64.encodeToString(originalBytes, Base64.NO_WRAP);
                String terminalValue = Base64.encodeToString(terminalBytes, Base64.NO_WRAP);
                Map<String,Object> before = copyFinalizationRawLocked();
                if (!originalValue.equals(before.get(SNAPSHOT)) || !original.equals(loadLocked())
                    || !NativeProtectedWorkSnapshot.exactRawEquals(before, preferences.getAll()))
                    throw new VaultFailure("custodial_native_vault_concurrent_change");
                Map<String,Object> expected = new HashMap<>(before);
                expected.put(SNAPSHOT, terminalValue);
                control.requireBeforeCommit();
                if (UNCERTAIN.containsKey(preferences)) throw new VaultFailure(DURABILITY_UNCONFIRMED);
                if (!NativeProtectedWorkSnapshot.exactRawEquals(before, preferences.getAll()))
                    throw new VaultFailure("custodial_native_vault_concurrent_change");
                held.requireForPersistence(this, control);
                // begin revalidates persistence.load(), so consume BEFORE
                // installing our marker. No namespace call intervenes between
                // that marker and the ONE existing commit/readback primitive.
                control.beginCommitAttempt();
                pending = new PendingCommit(original.revision, terminalValue, true);
                UNCERTAIN.put(preferences, pending);
                commitAndVerifyLocked(terminalValue, terminalBytes, terminal);
                held.requireForPersistence(this, control);
                Map<String,Object> readback = copyFinalizationRawLocked();
                if (UNCERTAIN.get(preferences) != pending
                    || !NativeProtectedWorkSnapshot.exactRawEquals(expected, readback))
                    throw new VaultFailure("custodial_native_vault_readback_failed");
                Object stored = readback.get(SNAPSHOT);
                if (!(stored instanceof String) || !terminalValue.equals(stored))
                    throw new VaultFailure("custodial_native_vault_readback_failed");
                readbackBytes = Base64.decode((String)stored, Base64.NO_WRAP);
                VaultSnapshot decoded = codec.decode(readbackBytes);
                canonical = codec.encode(decoded);
                if (!Arrays.equals(terminalBytes, readbackBytes) || !Arrays.equals(canonical, readbackBytes)
                    || !terminal.equals(decoded)) throw new VaultFailure("custodial_native_vault_readback_failed");
                held.requireForPersistence(this, control);
                control.observeCommittedSnapshot(decoded);
                held.requireForPersistence(this, control);
                if (UNCERTAIN.get(preferences) != pending
                    || !NativeProtectedWorkSnapshot.exactRawEquals(expected, preferences.getAll()))
                    throw new VaultFailure("custodial_native_vault_readback_failed");
                // Clear only THIS exact successful attempt. Every false,
                // throw, raw contradiction or late control refusal retains it.
                UNCERTAIN.remove(preferences);
            } catch (VaultFailure failure) { throw failure; }
            catch (RuntimeException failure) {
                throw new VaultFailure(pending == null
                    ? "custodial_native_original_inventory_finalization_persistence_unavailable"
                    : DURABILITY_UNCONFIRMED, failure);
            } finally {
                if (originalBytes != null) Arrays.fill(originalBytes, (byte)0);
                if (terminalBytes != null) Arrays.fill(terminalBytes, (byte)0);
                if (readbackBytes != null) Arrays.fill(readbackBytes, (byte)0);
                if (canonical != null) Arrays.fill(canonical, (byte)0);
            }
        }
    }

    /** Existing authenticated finalization DATA only. Never retries a write,
     * clears uncertainty or makes a held namespace ordinary/current again. */
    @Override public VaultEngine.OriginalInventoryFinalizationStoredState readOriginalInventoryFinalizationSnapshot(
        VaultEngine.NativeOriginalInventoryFinalizationRestoredRead original) throws VaultFailure {
        synchronized (COMMIT_LOCK) {
            if (original == null || workAdmission == null) throw finalizationReadbackUnavailable();
            byte[] originalBytes = null, terminalBytes = null, originalCanonical = null, terminalCanonical = null;
            byte[] storedBytes = null, storedCanonical = null;
            try {
                // The issuing monitor, GCM file/root and installed HELD lifetime
                // must be live before ANY adapter namespace/codec access.
                original.requireCurrent();
                VaultSnapshot before = original.originalSnapshotForReadback();
                VaultSnapshot after = original.terminalSnapshotForReadback();
                if (before == null || after == null || before.phase != VaultPhase.ACTIVE
                    || !before.hasCredential() || before.revision < 0 || before.revision == Long.MAX_VALUE
                    || !after.removalOperationId.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}"))
                    throw finalizationReadbackUnavailable();
                VaultSnapshot fixed = before.next(VaultPhase.EMPTY, SecretKind.NONE, null, "", before.deviceId,
                    "", 0, null, EnrollmentMetadata.empty(), after.removalOperationId, "", false, "");
                if (!fixed.equals(after)) throw finalizationReadbackUnavailable();
                originalBytes = codec.encode(before);
                terminalBytes = codec.encode(after);
                VaultSnapshot decodedOriginal = codec.decode(originalBytes);
                VaultSnapshot decodedTerminal = codec.decode(terminalBytes);
                originalCanonical = codec.encode(decodedOriginal);
                terminalCanonical = codec.encode(decodedTerminal);
                if (!before.equals(decodedOriginal) || !after.equals(decodedTerminal)
                    || !Arrays.equals(originalBytes, originalCanonical) || !Arrays.equals(terminalBytes, terminalCanonical))
                    throw finalizationReadbackUnavailable();
                String originalValue = Base64.encodeToString(originalBytes, Base64.NO_WRAP);
                String terminalValue = Base64.encodeToString(terminalBytes, Base64.NO_WRAP);
                PendingCommit pending = UNCERTAIN.get(preferences);
                if (pending != null && (!pending.originalInventoryFinalization
                    || pending.expectedRevision != before.revision || !terminalValue.equals(pending.encodedValue)))
                    throw finalizationReadbackUnavailable();
                original.requireCurrent();
                if (UNCERTAIN.get(preferences) != pending) throw finalizationReadbackUnavailable();
                // Do not loadLocked(): an exact finalization marker may be
                // observed here, but NEVER removed, adopted or replayed.
                Map<String,Object> raw = copyFinalizationRawLocked();
                Object saved = raw.get(SNAPSHOT);
                VaultEngine.OriginalInventoryFinalizationStoredState state;
                VaultSnapshot expected;
                byte[] expectedBytes;
                if (originalValue.equals(saved)) {
                    state = VaultEngine.OriginalInventoryFinalizationStoredState.ORIGINAL_SNAPSHOT_PRESENT;
                    expected = before; expectedBytes = originalBytes;
                } else if (terminalValue.equals(saved)) {
                    state = VaultEngine.OriginalInventoryFinalizationStoredState.FIXED_SUCCESSOR_SNAPSHOT_PRESENT;
                    expected = after; expectedBytes = terminalBytes;
                } else throw finalizationReadbackUnavailable();
                storedBytes = Base64.decode((String)saved, Base64.NO_WRAP);
                VaultSnapshot decodedStored = codec.decode(storedBytes);
                storedCanonical = codec.encode(decodedStored);
                if (!Arrays.equals(expectedBytes, storedBytes) || !Arrays.equals(storedBytes, storedCanonical)
                    || !expected.equals(decodedStored)) throw finalizationReadbackUnavailable();
                // This performs actual native-file/HELD checks. Compare the
                // COMPLETE detached original map and marker identity afterward,
                // including all unrelated rows, string sets and raw float bits.
                original.requireCurrent();
                Map<String,Object> readback = copyFinalizationRawLocked();
                if (UNCERTAIN.get(preferences) != pending
                    || !NativeProtectedWorkSnapshot.exactRawEquals(raw, readback))
                    throw finalizationReadbackUnavailable();
                return state;
            } catch (VaultFailure failure) { throw failure; }
            catch (RuntimeException failure) {
                throw new VaultFailure("custodial_native_original_inventory_finalization_readback_unavailable", failure);
            } finally {
                if (originalBytes != null) Arrays.fill(originalBytes, (byte)0);
                if (terminalBytes != null) Arrays.fill(terminalBytes, (byte)0);
                if (originalCanonical != null) Arrays.fill(originalCanonical, (byte)0);
                if (terminalCanonical != null) Arrays.fill(terminalCanonical, (byte)0);
                if (storedBytes != null) Arrays.fill(storedBytes, (byte)0);
                if (storedCanonical != null) Arrays.fill(storedCanonical, (byte)0);
            }
        }
    }

    private static VaultFailure finalizationReadbackUnavailable() {
        return new VaultFailure("custodial_native_original_inventory_finalization_readback_unavailable");
    }

    private Map<String,Object> copyFinalizationRawLocked() throws VaultFailure {
        Map<String,?> source = preferences.getAll();
        if (source == null) throw finalizationUnavailable();
        Map<String,Object> copy = new HashMap<>();
        for (Map.Entry<String,?> entry : source.entrySet()) {
            String key = entry.getKey();Object value = entry.getValue();
            if (key == null) throw finalizationUnavailable();
            if (value instanceof Set<?>) {
                Set<String> detached = new HashSet<>();
                for (Object item : (Set<?>)value) {
                    if (!(item instanceof String)) throw finalizationUnavailable();
                    detached.add((String)item);
                }
                value = detached;
            } else if (!(value instanceof String || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Boolean)) throw finalizationUnavailable();
            copy.put(key, value);
        }
        // Includes raw float bits and all unrelated/unknown original rows.
        if (!NativeProtectedWorkSnapshot.exactRawEquals(copy, source)) throw finalizationUnavailable();
        return copy;
    }

    private static VaultFailure finalizationUnavailable() {
        return new VaultFailure("custodial_native_original_inventory_finalization_persistence_unavailable");
    }

    private void commitAndVerifyLocked(String value, byte[] encoded, VaultSnapshot next) throws VaultFailure {
        if (!preferences.edit().putString(SNAPSHOT, value).commit()) {
            throw new VaultFailure("custodial_native_vault_commit_failed");
        }
        String stored = preferences.getString(SNAPSHOT, null);
        if (stored == null || !stored.equals(value)) {
            throw new VaultFailure("custodial_native_vault_readback_failed");
        }
        byte[] readback = null;
        try {
            readback = Base64.decode(stored, Base64.NO_WRAP);
            if (!Arrays.equals(encoded, readback) || !codec.decode(readback).equals(next)) {
                throw new VaultFailure("custodial_native_vault_readback_failed");
            }
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("custodial_native_vault_readback_failed", error);
        } finally {
            if (readback != null) Arrays.fill(readback, (byte) 0);
        }
    }

    private VaultSnapshot loadLocked() throws VaultFailure {
        if (UNCERTAIN.containsKey(preferences)) throw new VaultFailure(DURABILITY_UNCONFIRMED);
        String stored = preferences.getString(SNAPSHOT, null);
        if (stored == null) return VaultSnapshot.empty();
        if (stored.trim().isEmpty() || stored.length() > 100_000) {
            throw new VaultFailure("custodial_native_vault_corrupt");
        }
        byte[] encoded;
        try {
            encoded = Base64.decode(stored, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            throw new VaultFailure("custodial_native_vault_corrupt", error);
        }
        try {
            return codec.decode(encoded);
        } finally {
            Arrays.fill(encoded, (byte) 0);
        }
    }

    private static final class PendingCommit {
        final long expectedRevision;
        final String encodedValue;
        final boolean originalInventoryFinalization;
        PendingCommit(long expectedRevision, String encodedValue) {
            this(expectedRevision, encodedValue, false);
        }
        private PendingCommit(long expectedRevision, String encodedValue, boolean originalInventoryFinalization) {
            this.expectedRevision = expectedRevision;
            this.encodedValue = encodedValue;
            this.originalInventoryFinalization = originalInventoryFinalization;
        }
    }
}
