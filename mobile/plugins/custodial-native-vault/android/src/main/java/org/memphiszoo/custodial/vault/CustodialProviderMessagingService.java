package org.memphiszoo.custodial.vault;

import android.util.Log;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.FirebaseMessagingPlugin;

/** Compiled SDK owner, intentionally NOT registered until full runtime admission and
 * exact removal of both old MESSAGING_EVENT handlers are reviewed together. */
public final class CustodialProviderMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        try {
            NativeProviderFirebaseDispatch.token(CustodialNativeRuntime.providerIngress(getApplicationContext()), token,
                () -> FirebaseMessagingPlugin.onNewToken(token));
        } catch (VaultFailure | RuntimeException rejected) { Log.w("CustodialProvider", "native_token_not_committed"); }
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        if (message == null) return;
        try {
            String project = NativeProviderPayload.protectedTraffic(message.getData())
                ? FirebaseApp.getInstance().getOptions().getGcmSenderId() : null;
            NativeProviderFirebaseDispatch.message(CustodialNativeRuntime.providerIngress(getApplicationContext()),
                message.getFrom(), project, message.getNotification() != null, message.getData(),
                () -> FirebaseMessagingPlugin.onMessageReceived(message));
        } catch (VaultFailure | RuntimeException rejected) { Log.w("CustodialProvider", "protected_ingress_not_admitted"); }
    }
    @Override public void onDeletedMessages() {
        try { NativeProviderFirebaseDispatch.deleted(CustodialNativeRuntime.providerIngress(getApplicationContext())); }
        catch (VaultFailure | RuntimeException rejected) { Log.w("CustodialProvider", "native_recovery_not_committed"); }
    }
}
