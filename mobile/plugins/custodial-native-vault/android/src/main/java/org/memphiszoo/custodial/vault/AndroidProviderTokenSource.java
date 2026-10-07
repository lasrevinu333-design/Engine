package org.memphiszoo.custodial.vault;

import android.os.Looper;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.concurrent.TimeUnit;

/** Native SDK token read only on the already-owned bounded worker, no permission UI,
 * Activity, detached callback, token from JavaScript or persistent extra executor. */
final class AndroidProviderTokenSource {
    static void refresh(NativeProviderRegistrationCoordinator owner, NativeProviderHttp.Attempt attempt) throws VaultFailure {
        if (owner == null || attempt == null || Looper.myLooper() == Looper.getMainLooper())
            throw new VaultFailure("custodial_provider_token_worker_required");
        attempt.check(); NativeProviderRegistrationCoordinator.TokenRead read = owner.beginTokenRead();
        try {
            String token = Tasks.await(FirebaseMessaging.getInstance().getToken(), attempt.timeout(10000), TimeUnit.MILLISECONDS);
            attempt.check(); owner.completeTokenRead(read, token);
        } catch (VaultFailure rejected) { throw rejected; }
        catch (InterruptedException canceled) {
            Thread.currentThread().interrupt(); throw new VaultFailure("custodial_provider_network_canceled");
        } catch (Exception unavailable) { throw new VaultFailure("custodial_provider_native_token_unavailable"); }
        finally { owner.abandonTokenRead(read); }
    }
    private AndroidProviderTokenSource() {}
}
