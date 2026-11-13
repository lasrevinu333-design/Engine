package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.HashMap;
import org.junit.Test;

/** Four NEW owning snapshot interfaces, not old journal regression reruns.
 * All auth, ciphertext, storage, reply and clock inputs are synthetic. */
public final class NativeRetainedCapturedReadInterfacesTest {
    static NativeRetainedNamespaceCensusTest.Fixture ready() throws Exception {
        var value=new NativeRetainedNamespaceCensusTest.Fixture();
        value.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");return value;
    }
    @Test public void attemptCapturedReadRequiresExactAllRowsAndNeverCommitsOrEncrypts() throws Exception {
        var x=ready();var stable=new NativeRetainedNamespaceCensusTest.Stable(x);
        var captured=new HashMap<>(x.f.batch.old.journalDisk.memory);
        assertNotNull(x.f.batch.old.journal.observeCaptured(captured));
        captured.remove("part:0");NativeRetainedNamespaceCensusTest.denied(()->x.f.batch.old.journal.observeCaptured(captured));
        captured.put("part:0",17);NativeRetainedNamespaceCensusTest.denied(()->x.f.batch.old.journal.observeCaptured(captured));
        stable.check();x.f.preserved();
    }
    @Test public void queryCapturedObservedReadDoesNotUseCiphertextRecommitRecovery() throws Exception {
        var x=ready();var stable=new NativeRetainedNamespaceCensusTest.Stable(x);
        var captured=new HashMap<>(x.f.batch.queryZeroDisk.memory);
        assertEquals(NativeRetainedQueryJournal.OBSERVED,x.f.batch.queryZero.observeCaptured(captured).state);
        captured.put("unrecognized","never silently discarded");
        NativeRetainedNamespaceCensusTest.denied(()->x.f.batch.queryZero.observeCaptured(captured));
        stable.check();x.f.preserved();
    }
    @Test public void batchCapturedReadRequiresWholeLayoutOriginalCaptureAndExactCiphertext() throws Exception {
        var x=ready();var stable=new NativeRetainedNamespaceCensusTest.Stable(x);
        var raw=new HashMap<>(x.f.batch.root.memory);var capture=NativeRetainedWorkCapture.capture(x.f.batch.old.work);
        var principal=NativeProviderPrincipal.fromNativeJournal(x.f.batch.old.principal.readFor(x.f.batch.old.engine.getState()));
        long revision=x.f.batch.old.persistence.current().revision;
        assertEquals(3,x.f.batch.journal.observeCaptured(raw,capture,principal,revision).count);
        NativeRetainedNamespaceCensusTest.denied(()->x.f.batch.journal.observeCaptured(raw,capture,principal,revision+1));
        raw.put("new-hidden-slot","preserve");
        NativeRetainedNamespaceCensusTest.denied(()->x.f.batch.journal.observeCaptured(raw,capture,principal,revision));
        stable.check();x.f.preserved();
    }
    @Test public void ciphertextChangeDuringDecryptionPreventsSnapshotPublicationWithoutRecommit() throws Exception {
        var x=ready();var raw=new HashMap<>(x.f.batch.queryZeroDisk.memory);int commits=x.f.batch.queryZeroDisk.commits,encrypts=x.queryCipher.encrypts;
        var cipher=new CredentialCipher(){
            boolean changed;
            public EncryptedSecret encrypt(char[] clear){throw new AssertionError("create");}
            public EncryptedSecret encryptWithExistingKey(char[] clear){throw new AssertionError("write");}
            public void destroyKey(){throw new AssertionError("destroy");}
            public char[] decrypt(EncryptedSecret value)throws VaultFailure{
                char[] result=x.queryCipher.decrypt(value);if(!changed){changed=true;x.f.batch.queryZeroDisk.memory.put("part:0","changed original during decode");}return result;
            }
        };
        var reader=new AndroidRetainedQueryStore(x.f.batch.queryZeroDisk.preferences(),cipher).journal();
        NativeRetainedNamespaceCensusTest.denied(()->reader.observeCaptured(raw));
        assertEquals(commits,x.f.batch.queryZeroDisk.commits);assertEquals(encrypts,x.queryCipher.encrypts);x.queryCipher.wiped();x.f.preserved();
    }
}
