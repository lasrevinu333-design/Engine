package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Map;

/** Unmounted private QUERY metadata only, separate from original frozen work
 * and write-attempt namespaces. Existing shared key, purpose-separated AAD.
 * No create/delete/rotate key, ordinary work, async write or namespace clear. */
final class AndroidRetainedQueryStore implements NativeRetainedQueryJournal.Backend {
    static final String PREFERENCES="MemphisZooCustodialRetainedReadQueryV1";
    static final String AAD="org.memphiszoo.custodial.native-vault.retained-read-query.v1";
    private static final Object LOCK=AndroidProtectedWorkPreferences.retainedCommitLock();
    private final SharedPreferences preferences;
    private final CredentialCipher cipher;
    AndroidRetainedQueryStore(Context context){this(AndroidProtectedWorkPreferences.bindExistingNativeEpoch(context,
        context.getApplicationContext().getSharedPreferences(PREFERENCES,Context.MODE_PRIVATE)),
        new AndroidKeystoreCipher(AAD,2*NativeRetainedQueryJournal.PART_CHARACTERS+1024));}
    AndroidRetainedQueryStore(SharedPreferences preferences,CredentialCipher cipher){
        if(preferences instanceof AndroidProtectedWorkPreferences || preferences==null||cipher==null)throw new IllegalArgumentException("retained_query_store_dependencies_required");this.preferences=preferences;this.cipher=cipher;
    }
    NativeRetainedQueryJournal journal(){return new NativeRetainedQueryJournal(this,cipher,LOCK);}
    @Override public Map<String,?> readAll() {
        synchronized(LOCK) { return java.util.Collections.unmodifiableMap(new java.util.HashMap<>(preferences.getAll())); }
    }
    /** Raw map callers cannot mint original-purpose admission. */
    @Override public boolean compareAndCommit(Map<String,String> expected,Map<String,String> next) throws VaultFailure {
        throw new VaultFailure(NativeRetainedAttempt.FAILURE);
    }
    @Override public NativeRetainedQueryJournal.PendingPrepared pendingPreparedOriginal()throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.pendingPreparedQuery(preferences); }
    }
    @Override public Map<String,String> pendingOriginal(NativeRetainedQueryJournal.OriginalCommit original) throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.retainedCandidate(preferences,original); }
    }
    @Override public boolean commitOriginal(NativeRetainedQueryJournal.OriginalCommit original,Map<String,String> next) throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.commitRetained(preferences,original,next); }
    }
}
