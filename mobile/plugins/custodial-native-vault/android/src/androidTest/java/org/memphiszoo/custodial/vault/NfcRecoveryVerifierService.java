package org.memphiszoo.custodial.vault;

import android.app.Service;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import android.os.RemoteException;
import java.util.Arrays;
import java.util.Map;

/** Test-only secondary process that verifies disk, quarantine, and keystore recovery. */
public final class NfcRecoveryVerifierService extends Service {
    static final int REQUEST_VERIFY = 1;
    static final int RESPONSE_VERIFY = 2;

    private final Messenger endpoint = new Messenger(new Handler(Looper.getMainLooper(), message -> {
        if (message.what != REQUEST_VERIFY || message.replyTo == null) return false;
        Message reply = Message.obtain(null, RESPONSE_VERIFY);
        reply.setData(verify(message.getData()));
        try {
            message.replyTo.send(reply);
        } catch (RemoteException ignored) {
            // The caller owns the timeout and failure assertion.
        }
        stopSelf();
        return true;
    }));

    @Override
    public IBinder onBind(Intent intent) {
        return endpoint.getBinder();
    }

    private Bundle verify(Bundle request) {
        Bundle result = new Bundle();
        try {
            Context context = getApplicationContext();
            if (!context.getPackageName().endsWith(".test")) {
                throw new IllegalStateException("The verifier may run only inside the test application");
            }
            SharedPreferences authority = context.getSharedPreferences(
                "MemphisZooCustodialOfflineAuthorityTimeV1",
                Context.MODE_PRIVATE
            );
            SharedPreferences fixture = context.getSharedPreferences(
                "NfcRecoveryRestartFixture",
                Context.MODE_PRIVATE
            );
            String expectedHandoffId = request.getString("expected_handoff_id", "");
            String handoffId = fixture.getString("id", "");
            int seedPid = fixture.getInt("seed_pid", -1);
            int verifyPid = Process.myPid();
            if (!"seeded".equals(fixture.getString("phase", ""))) {
                throw new IllegalStateException("The persisted restart fixture is not in the seeded phase");
            }
            if (expectedHandoffId.isEmpty() || !expectedHandoffId.equals(handoffId)) {
                throw new IllegalStateException("The secondary process did not receive the exact seeded handoff");
            }
            if (seedPid <= 0 || seedPid == verifyPid) {
                throw new IllegalStateException("The restart verifier did not cross an Android process boundary");
            }

            Map<String, Map<String, Object>> handoffs =
                new AndroidOfflineAuthorityTimeStore(context).loadNfcHandoffs();
            if (!handoffs.containsKey(handoffId)) {
                throw new IllegalStateException("The seeded encrypted handoff did not survive disk recovery");
            }
            long quarantineCount = authority.getAll().keySet().stream()
                .filter(key -> key.startsWith("native_nfc_handoff_quarantine_record:"))
                .count();
            if (quarantineCount != 1L) {
                throw new IllegalStateException("Disk recovery did not preserve exactly one quarantine record");
            }
            boolean damagedValuePreserved = authority.getAll().entrySet().stream().anyMatch(entry ->
                entry.getKey().startsWith("native_nfc_handoff_quarantine_record:")
                    && "{restart-fixture-unreadable".equals(entry.getValue())
            );
            if (!damagedValuePreserved) {
                throw new IllegalStateException("The quarantined disk record lost its exact damaged value");
            }

            char[] clear = new AndroidKeystoreCipher().decrypt(new EncryptedSecret(
                fixture.getString("ciphertext", ""),
                fixture.getString("iv", "")
            ));
            try {
                if (!"restart-fixture-credential".equals(new String(clear))) {
                    throw new IllegalStateException("The secondary process could not decrypt the seeded credential");
                }
            } finally {
                Arrays.fill(clear, '\0');
            }
            if (!fixture.edit()
                .putString("phase", "verified")
                .putInt("verify_pid", verifyPid)
                .commit()) {
                throw new IllegalStateException("The secondary process could not commit its verified phase");
            }

            result.putBoolean("ok", true);
            result.putString("phase", "verified");
            result.putString("handoff_id", handoffId);
            result.putString("process_name", Application.getProcessName());
            result.putInt("verify_pid", verifyPid);
            result.putLong("quarantine_count", quarantineCount);
        } catch (Throwable error) {
            result.putBoolean("ok", false);
            result.putString("error_class", error.getClass().getName());
            result.putString("error_message", String.valueOf(error.getMessage()));
        }
        return result;
    }
}
