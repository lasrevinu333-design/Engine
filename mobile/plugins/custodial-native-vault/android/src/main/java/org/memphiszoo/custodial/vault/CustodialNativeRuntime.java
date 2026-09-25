package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.os.SystemClock;
import android.provider.Settings;
import java.util.Map;
import org.json.JSONObject;

/** One application-context native runtime, available before an Activity or Capacitor.
 * Construction extracts the existing owners, without calling enrollment, recovery,
 * provider registration or notification effects. Activity-backed gates remain in plugin. */
final class CustodialNativeRuntime {
    private static CustodialNativeRuntime instance;
    final VaultEngine engine;
    final AndroidOfflineAuthorityTimeStore offlineStore;
    final OfflineAuthorityTime offlineTime;
    final NativePrincipalJournal principalJournal;
    final NativeLegacyLineageJournal legacyJournal;
    final Object providerCoordinator = new Object();

    static synchronized CustodialNativeRuntime get(Context context) {
        if (context == null || context.getApplicationContext() == null) throw new IllegalArgumentException("custodial_application_context_required");
        if (instance == null) instance = new CustodialNativeRuntime(context.getApplicationContext());
        return instance;
    }
    private CustodialNativeRuntime(Context application) {
        VaultClock clock = System::currentTimeMillis;
        engine = new VaultEngine(
            new SharedPreferencesVaultPersistence(application, new VaultSnapshotCodec()),
            new AndroidKeystoreCipher(), new HttpsEnrollmentTransport(),
            new AndroidLegacyVaultSource(application, clock), new SecureInstallationSealGenerator(), clock);
        offlineStore = new AndroidOfflineAuthorityTimeStore(application);
        offlineTime = new OfflineAuthorityTime(offlineStore, new OfflineAuthorityTime.MonotonicClock() {
            @Override public long now() { return SystemClock.elapsedRealtime(); }
            @Override public int bootCount() {
                try { return Settings.Global.getInt(application.getContentResolver(), "boot_count", -1); }
                catch (RuntimeException unavailable) { return -1; }
            }
        });
        principalJournal = new NativePrincipalJournal(offlineStore);
        legacyJournal = new NativeLegacyLineageJournal(offlineStore);
        // Provider delivery is deferred from the cleaning-first release. Do not
        // touch its preference/key namespace merely to start the cleaning app.
        // Its single journal must be wired only with the reviewed effect owner.
    }

    /** Caller holds engine before providerCoordinator for every provider mutation/effect.
     * Reads the actual native journals; does not manufacture, refresh or repair a principal. */
    NativeProviderPrincipal readProviderPrincipal() throws VaultFailure {
        synchronized (engine) {
            Map<String, Object> state = engine.getState();
            if (!Boolean.TRUE.equals(state.get("active"))) return null;
            JSONObject principal = NativeLegacyLineageJournal.applies(state)
                ? engine.readLegacyPrincipal(legacyJournal) : principalJournal.readFor(state);
            return principal == null ? null : NativeProviderPrincipal.fromNativeJournal(principal);
        }
    }
    // No provider transport/display/removal entrypoints until all effect/fence owners are complete.
}
