package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Map;

/** Unmounted Android backing. Separate native-private attempt namespace so the
 * original frozen work inventory is not rewritten or silently filtered. Uses
 * only the EXISTING shared native-vault key under a distinct AAD; no key API,
 * namespace clear/delete, async write, WebView/plugin route or network effects. */
final class AndroidRetainedAttemptStore implements NativeRetainedAttemptJournal.Backend {
    static final String PREFERENCES="MemphisZooCustodialRetainedAttemptV1";
    static final String AAD="org.memphiszoo.custodial.native-vault.retained-attempt.v1";
    private static final Object LOCK=AndroidProtectedWorkPreferences.retainedCommitLock();
    private final SharedPreferences preferences;
    private final CredentialCipher cipher;
    AndroidRetainedAttemptStore(Context context) {
        this(AndroidProtectedWorkPreferences.bindExistingNativeEpoch(context,
            context.getApplicationContext().getSharedPreferences(PREFERENCES,Context.MODE_PRIVATE)),
            new AndroidKeystoreCipher(AAD,2*NativeRetainedAttemptJournal.PART_CHARACTERS+1024));
    }
    AndroidRetainedAttemptStore(SharedPreferences preferences,CredentialCipher cipher) {
        if(preferences instanceof AndroidProtectedWorkPreferences || preferences==null || cipher==null) throw new IllegalArgumentException("retained_store_dependencies_required");
        this.preferences=preferences;this.cipher=cipher;
    }
    NativeRetainedAttemptJournal journal() { return new NativeRetainedAttemptJournal(this,cipher,LOCK); }
    @Override public Map<String,?> readAll() {
        synchronized(LOCK) { return java.util.Collections.unmodifiableMap(new java.util.HashMap<>(preferences.getAll())); }
    }
    /** Raw map callers cannot mint original-purpose admission. */
    @Override public boolean compareAndCommit(Map<String,String> expected,Map<String,String> next) throws VaultFailure {
        throw new VaultFailure(NativeRetainedAttempt.FAILURE);
    }
    @Override public NativeRetainedAttemptJournal.PendingPrepared pendingPreparedOriginal()throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.pendingPreparedWrite(preferences); }
    }
    @Override public Map<String,String> pendingOriginal(NativeRetainedAttemptJournal.OriginalCommit original) throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.retainedCandidate(preferences,original); }
    }
    @Override public boolean commitOriginal(NativeRetainedAttemptJournal.OriginalCommit original,Map<String,String> next) throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.commitRetained(preferences,original,next); }
    }
}
