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
    private final Context application;
    private NativeProviderRuntimeOwner localProviderOwner;

    static synchronized CustodialNativeRuntime get(Context context) {
        if (context == null || context.getApplicationContext() == null) throw new IllegalArgumentException("custodial_application_context_required");
        if (instance == null) instance = new CustodialNativeRuntime(context.getApplicationContext());
        return instance;
    }
    private CustodialNativeRuntime(Context application) {
        this.application = application;
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
        // Provider is required by the current complete-system scope, but its
        // admitted effect owner remains unfinished. Do not touch its preference/
        // key namespace merely to start the app or register private components.
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
    /** Local preservation only, distinct from admitting ingress/display/network.
     * Empty installations do not create a provider key or namespace while suspended.
     * Retained ciphertext must be fenced before enrollment finalization; unreadable
     * provider key/store fails closed and is never regenerated or cleared. */
    private NativeProviderRuntimeOwner localOwner() {
        if (!Thread.holdsLock(engine) || !Thread.holdsLock(providerCoordinator)) throw new IllegalStateException("provider_lock_owner_required");
        if (localProviderOwner == null && AndroidProviderStore.hasRetainedState(application)) {
            AndroidProviderStore store = new AndroidProviderStore(application);
            NativeProviderJournal journal = new NativeProviderJournal(store.records(), providerCoordinator);
            NativeProviderRuntimeOwner.Delivery delivery = null;
            try {
                AndroidProviderClockReadings readings = new AndroidProviderClockReadings(application);
                delivery = new NativeProviderRuntimeOwner.Delivery(NativeProviderTime.Profiles.NONE, AndroidProviderPlatform.read(), readings,
                    () -> AndroidProviderAppIdentity.read(application), new NativeProviderHttp(readings), new AndroidProviderJobs(application), AndroidProviderTokenSource::refresh);
            } catch (VaultFailure unavailable) {
                // Missing platform identity cannot block the original local removal
                // fence/cancellation owner or become a guessed qualified profile.
                android.util.Log.w("CustodialNativeVault", "provider_platform_unqualified");
            }
            localProviderOwner = new NativeProviderRuntimeOwner(engine, principalJournal, legacyJournal, journal,
                providerCoordinator, new AndroidProviderNotifications(application), delivery);
        }
        return localProviderOwner;
    }
    void reconcileProviderFence() throws VaultFailure {
        synchronized (engine) { synchronized (providerCoordinator) {
            NativeProviderRuntimeOwner owner = localOwner();
            if (owner != null) {
                owner.reconcile(); // This exact durable fence may NEVER be ignored.
                try { owner.reconcileLocalEffects(); }
                catch (VaultFailure pending) {
                    if (!"custodial_provider_os_cancel_failed".equals(pending.code)
                        && !"custodial_provider_os_cancel_unconfirmed".equals(pending.code)) throw pending;
                    // Durable exact intent remains. OS absence is not required to
                    // delete ONLY the enrollment key after its provider fence.
                    android.util.Log.w("CustodialNativeVault", "provider_exact_cancellation_pending");
                }
            }
        } }
    }
    void attachProviderLocal(Object attachment) throws VaultFailure {
        synchronized (engine) { synchronized (providerCoordinator) {
            NativeProviderRuntimeOwner owner = localOwner();
            if (owner != null) { owner.reconcile(); owner.attach(attachment); owner.reconcileLocalEffects(); }
        } }
    }
    void detachProviderLocal(Object attachment) {
        synchronized (engine) { synchronized (providerCoordinator) {
            if (localProviderOwner != null) localProviderOwner.detach(attachment);
        } }
    }
    NativeProviderRemovalCoordinator providerRemoval(RemovalCoordinator removal) {
        return new NativeProviderRemovalCoordinator(engine, removal, this::reconcileProviderFence);
    }
    /** Finite mirror operations only. Retained local state is never created by JS. */
    private NativeProviderRuntimeOwner requireMirrorOwner() throws VaultFailure {
        NativeProviderRuntimeOwner owner=localOwner();if(owner==null)throw new VaultFailure("custodial_provider_suspended");return owner;
    }
    Map<String,Object> providerMirrorAttach(Object plugin,NativeProviderMirrorAttachment.Hint hint)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){return requireMirrorOwner().mirrorAttach(plugin,hint);}}
    }
    void providerMirrorStopped(Object plugin,String attachment)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorStopped(plugin,attachment);}}
    }
    JSONObject providerMirrorClaimNext(Object plugin,String attachment)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){return requireMirrorOwner().mirrorClaimNext(plugin,attachment);}}
    }
    JSONObject providerMirrorClaimState(Object plugin,String attachment,String claim)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){return requireMirrorOwner().mirrorClaimState(plugin,attachment,claim);}}
    }
    void providerMirrorApply(Object plugin,String attachment,String claim,String action)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorApply(plugin,attachment,claim,action);}}
    }
    void providerMirrorRetire(Object plugin,String attachment,String claim)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorRetire(plugin,attachment,claim);}}
    }
    void providerMirrorDetach(Object plugin,String attachment)throws VaultFailure{
        synchronized(engine){synchronized(providerCoordinator){requireMirrorOwner().mirrorDetach(plugin,attachment);}}
    }
    /** Component startup must not instantiate the vault/provider stores before admission.
     * This is deliberately hard suspended, not a JS/env/preference feature flag. Replace only
     * when the qualified clock, removal fence, transport and presentation owners are complete. */
    static NativeProviderComponentRuntime providerComponents(Context context) {
        return NativeProviderComponentRuntime.SUSPENDED;
    }
    static NativeProviderIngressRuntime providerIngress(Context context) {
        return NativeProviderIngressRuntime.SUSPENDED;
    }
}
