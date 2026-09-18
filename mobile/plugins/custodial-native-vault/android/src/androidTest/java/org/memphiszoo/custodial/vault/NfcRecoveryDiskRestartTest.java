package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Process;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import org.junit.Test;
import org.junit.runner.RunWith;
/** Run each method in a separate instrumentation process, in the documented order. */
@RunWith(AndroidJUnit4.class)
public final class NfcRecoveryDiskRestartTest {
    private Context context() {
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(c.getPackageName().endsWith(".test"));
        assertTrue(Build.FINGERPRINT.contains("generic")||Build.MODEL.toLowerCase(java.util.Locale.ROOT).contains("sdk") && "ranchu".equals(Build.HARDWARE));return c;
    }
    @Test public void seedPreservedAndFreshEncryptedState() throws Exception {
        Context c=context();SharedPreferences p=c.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",0);
        SharedPreferences meta=c.getSharedPreferences("NfcRecoveryRestartFixture",0);
        assertTrue(p.edit().clear().commit());assertTrue(meta.edit().clear().commit());new AndroidKeystoreCipher().destroyKey();
        EncryptedSecret credential=new AndroidKeystoreCipher().encrypt("restart-fixture-credential".toCharArray());
        String damaged="{restart-fixture-unreadable";assertTrue(p.edit().putString("native_nfc_handoffs",damaged).commit());
        String id=NativeNfcScanHandoff.recordPhysicalRead(c,"memphiszoo://scan?code=NOCX");assertFalse(id.isEmpty());
        assertTrue(meta.edit().putString("id",id).putInt("pid",Process.myPid()).putString("ciphertext",credential.ciphertext).putString("iv",credential.iv).commit());
        System.out.println("RESTART_SEED_PID="+Process.myPid());
    }
    @Test public void verifyStateInDifferentProcess() throws Exception {
        Context c=context();SharedPreferences p=c.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",0);
        SharedPreferences meta=c.getSharedPreferences("NfcRecoveryRestartFixture",0);
        assertNotEquals(meta.getInt("pid",-1),Process.myPid());String id=meta.getString("id","");assertFalse(id.isEmpty());
        assertTrue(new AndroidOfflineAuthorityTimeStore(c).loadNfcHandoffs().containsKey(id));
        assertEquals(1L,p.getAll().keySet().stream().filter(k->k.startsWith("native_nfc_handoff_quarantine_record:")).count());
        assertTrue(p.getAll().entrySet().stream().anyMatch(e->e.getKey().startsWith("native_nfc_handoff_quarantine_record:")&&"{restart-fixture-unreadable".equals(e.getValue())));
        char[] clear=new AndroidKeystoreCipher().decrypt(new EncryptedSecret(meta.getString("ciphertext",""),meta.getString("iv","")));
        try{assertEquals("restart-fixture-credential",new String(clear));}finally{Arrays.fill(clear,'\0');}
        System.out.println("RESTART_VERIFIED_PID="+Process.myPid()+" PRIOR_PID="+meta.getInt("pid",-1));
    }
    @Test public void cleanupTestFixture() throws Exception {
        Context c=context();assertTrue(c.getSharedPreferences("NfcRecoveryRestartFixture",0).edit().clear().commit());
        assertTrue(c.getSharedPreferences("MemphisZooCustodialOfflineAuthorityTimeV1",0).edit().clear().commit());
        new AndroidKeystoreCipher().destroyKey();
    }
}
