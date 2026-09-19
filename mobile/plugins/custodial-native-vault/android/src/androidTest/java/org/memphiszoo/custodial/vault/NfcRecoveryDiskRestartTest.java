package org.memphiszoo.custodial.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Proves committed NFC recovery state through a real secondary Android process. */
@RunWith(AndroidJUnit4.class)
public final class NfcRecoveryDiskRestartTest {
    private Context context() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(context.getPackageName().endsWith(".test"));
        assertTrue(
            Build.FINGERPRINT.contains("generic")
                || Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk")
                    && "ranchu".equals(Build.HARDWARE)
        );
        return context;
    }

    @Test
    public void encryptedStateSurvivesDifferentProcessAndCleansUp() throws Exception {
        Context context = context();
        SharedPreferences authority = context.getSharedPreferences(
            "MemphisZooCustodialOfflineAuthorityTimeV1",
            Context.MODE_PRIVATE
        );
        SharedPreferences fixture = context.getSharedPreferences(
            "NfcRecoveryRestartFixture",
            Context.MODE_PRIVATE
        );
        AtomicReference<Messenger> remote = new AtomicReference<>();
        AtomicReference<Bundle> response = new AtomicReference<>();
        CountDownLatch connected = new CountDownLatch(1);
        CountDownLatch completed = new CountDownLatch(1);
        ServiceConnection connection = new ServiceConnection() {
            @Override
            public void onServiceConnected(ComponentName name, IBinder service) {
                remote.set(new Messenger(service));
                connected.countDown();
            }

            @Override
            public void onServiceDisconnected(ComponentName name) {
                remote.set(null);
            }
        };
        boolean bound = false;
        int seedPid = Process.myPid();
        String handoffId = "";
        try {
            assertTrue(authority.edit().clear().commit());
            assertTrue(fixture.edit().clear().commit());
            new AndroidKeystoreCipher().destroyKey();

            char[] clearCredential = "restart-fixture-credential".toCharArray();
            EncryptedSecret credential;
            try {
                credential = new AndroidKeystoreCipher().encrypt(clearCredential);
            } finally {
                Arrays.fill(clearCredential, '\0');
            }
            assertTrue(
                authority.edit().putString(
                    "native_nfc_handoffs",
                    "{restart-fixture-unreadable"
                ).commit()
            );
            handoffId = NativeNfcScanHandoff.recordPhysicalRead(
                context,
                "memphiszoo://scan?code=NOCX"
            );
            assertFalse(handoffId.isEmpty());
            assertTrue(
                fixture.edit()
                    .putString("phase", "seeded")
                    .putString("id", handoffId)
                    .putInt("seed_pid", seedPid)
                    .putString("ciphertext", credential.ciphertext)
                    .putString("iv", credential.iv)
                    .commit()
            );

            bound = context.bindService(
                new Intent(context, NfcRecoveryVerifierService.class),
                connection,
                Context.BIND_AUTO_CREATE
            );
            assertTrue("The secondary-process verifier service did not bind", bound);
            assertTrue("The secondary-process verifier did not connect", connected.await(10, TimeUnit.SECONDS));
            Messenger verifier = remote.get();
            assertNotNull(verifier);

            Messenger reply = new Messenger(new Handler(Looper.getMainLooper(), message -> {
                if (message.what != NfcRecoveryVerifierService.RESPONSE_VERIFY) return false;
                response.set(new Bundle(message.getData()));
                completed.countDown();
                return true;
            }));
            Message verify = Message.obtain(null, NfcRecoveryVerifierService.REQUEST_VERIFY);
            verify.replyTo = reply;
            Bundle request = new Bundle();
            request.putString("expected_handoff_id", handoffId);
            verify.setData(request);
            verifier.send(verify);

            assertTrue("The secondary-process verifier did not reply", completed.await(15, TimeUnit.SECONDS));
            Bundle outcome = response.get();
            assertNotNull(outcome);
            assertTrue(
                outcome.getString("error_class", "") + ": " + outcome.getString("error_message", ""),
                outcome.getBoolean("ok", false)
            );
            assertEquals(handoffId, outcome.getString("handoff_id"));
            assertEquals("verified", outcome.getString("phase"));
            assertTrue(outcome.getString("process_name", "").endsWith(":nfc-recovery-verifier"));
            assertEquals(1L, outcome.getLong("quarantine_count", -1L));
            assertNotEquals(seedPid, outcome.getInt("verify_pid", seedPid));
            System.out.println(
                "RESTART_CROSS_PROCESS_VERIFIED SEED_PID=" + seedPid
                    + " VERIFY_PID=" + outcome.getInt("verify_pid", -1)
                    + " HANDOFF_ID=" + handoffId
            );
        } finally {
            if (bound) context.unbindService(connection);
            assertTrue(fixture.edit().clear().commit());
            assertTrue(authority.edit().clear().commit());
            new AndroidKeystoreCipher().destroyKey();
        }
    }
}
