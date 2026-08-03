package org.memphiszoo.manager.vault;

import android.content.Context;
import com.google.android.gms.tasks.Tasks;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.StandardIntegrityManager;
import java.util.concurrent.TimeUnit;

/**
 * Production Play Integrity Standard-request adapter. A stale/invalid provider
 * is discarded and warmed exactly once after a bounded backoff; there is no
 * Classic-request, software-attestation, or unverified fallback.
 */
final class PlayIntegrityAttestation implements ManagerAppAttestation {
    static final long RETRY_BACKOFF_MILLIS = 500L;
    private static final long PREPARE_TIMEOUT_SECONDS = 60;
    private static final long REQUEST_TIMEOUT_SECONDS = 60;

    interface ProviderHandle { String request(String requestHash) throws Exception; }
    interface StandardClient { ProviderHandle prepare(long cloudProjectNumber) throws Exception; }
    interface Sleeper { void sleep(long millis) throws InterruptedException; }

    private final Context context;
    private final Sleeper sleeper;
    private StandardClient client;
    private long cloudProjectNumber;
    private volatile ProviderHandle provider;

    PlayIntegrityAttestation(Context context) {
        this.context = context.getApplicationContext();
        this.sleeper = Thread::sleep;
    }

    PlayIntegrityAttestation(StandardClient client, long cloudProjectNumber, Sleeper sleeper) throws VaultFailure {
        this.context = null;
        if (client == null || sleeper == null) throw new VaultFailure("manager_play_integrity_unavailable");
        this.client = client;
        this.sleeper = sleeper;
        this.cloudProjectNumber = new PlayIntegrityConfiguration(cloudProjectNumber).cloudProjectNumber;
    }

    @Override public String provider() { return "play_integrity"; }

    @Override
    public String token(String challengeValue) throws VaultFailure {
        String challenge = PlayIntegrityConfiguration.challenge(challengeValue);
        VaultFailure last = null;
        for (int attempt = 0; attempt < 2; attempt += 1) {
            try {
                initialize();
                String token = warmedProvider().request(challenge);
                if (token == null || token.length() < 32 || token.length() > 32_768
                    || token.indexOf('\r') >= 0 || token.indexOf('\n') >= 0) {
                    throw new VaultFailure("manager_play_integrity_invalid_token");
                }
                return token;
            } catch (VaultFailure error) {
                last = error;
            } catch (Exception error) {
                last = new VaultFailure("manager_play_integrity_unavailable", error);
            }
            provider = null;
            if (attempt == 0) boundedBackoff();
        }
        throw last == null ? new VaultFailure("manager_play_integrity_unavailable") : last;
    }

    private ProviderHandle warmedProvider() throws Exception {
        ProviderHandle current = provider;
        if (current != null) return current;
        synchronized (this) {
            current = provider;
            if (current == null) {
                current = client.prepare(cloudProjectNumber);
                if (current == null) throw new VaultFailure("manager_play_integrity_unavailable");
                provider = current;
            }
        }
        return current;
    }

    private void boundedBackoff() throws VaultFailure {
        try {
            sleeper.sleep(RETRY_BACKOFF_MILLIS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new VaultFailure("manager_play_integrity_unavailable", error);
        }
    }

    private synchronized void initialize() throws VaultFailure {
        if (client != null && cloudProjectNumber > 0) return;
        if (context == null) throw new VaultFailure("manager_play_integrity_configuration_required");
        cloudProjectNumber = PlayIntegrityConfiguration.fromApplication(context).cloudProjectNumber;
        StandardIntegrityManager manager = IntegrityManagerFactory.createStandard(context);
        if (manager == null) throw new VaultFailure("manager_play_integrity_unavailable");
        client = project -> {
            StandardIntegrityManager.StandardIntegrityTokenProvider warmed = Tasks.await(
                manager.prepareIntegrityToken(
                    StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
                        .setCloudProjectNumber(project)
                        .build()
                ),
                PREPARE_TIMEOUT_SECONDS,
                TimeUnit.SECONDS
            );
            if (warmed == null) throw new VaultFailure("manager_play_integrity_unavailable");
            return requestHash -> {
                StandardIntegrityManager.StandardIntegrityToken result = Tasks.await(
                    warmed.request(
                        StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
                            .setRequestHash(requestHash)
                            .build()
                    ),
                    REQUEST_TIMEOUT_SECONDS,
                    TimeUnit.SECONDS
                );
                return result == null ? null : result.token();
            };
        };
    }
}
