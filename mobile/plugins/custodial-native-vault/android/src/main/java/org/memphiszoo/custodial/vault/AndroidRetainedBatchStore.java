package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Map;

/** Source-only backing for a fixed native batch. Never mounted by this change.
 * Existing chunk-zero prefs/AAD are reused, never moved or rewritten here.
 * AAD is fixed by native slot role/index, not by WebView input. Existing shared
 * key only; no creation, rotation, deletion, clear/apply or exported credential. */
final class AndroidRetainedBatchStore implements NativeRetainedBatchJournal.Backend {
    static final String PREFERENCES="MemphisZooCustodialRetainedBatchV1";
    static final String AAD="org.memphiszoo.custodial.native-vault.retained-batch.v1";
    static final Object LOCK=AndroidProtectedWorkPreferences.retainedCommitLock();
    private final SharedPreferences preferences;
    private final CredentialCipher cipher;private final NativeRetainedBatchJournal.Ciphers ciphers;
    private final NativeRetainedAttemptJournal zeroWrite;private final NativeRetainedQueryJournal zeroQuery;
    AndroidRetainedBatchStore(Context context){
        this(AndroidProtectedWorkPreferences.bindExistingNativeEpoch(context,
            context.getApplicationContext().getSharedPreferences(PREFERENCES,Context.MODE_PRIVATE)),new AndroidKeystoreCipher(AAD,4096),
            fixedSlotCiphers(),
            new AndroidRetainedAttemptStore(context).journal(),new AndroidRetainedQueryStore(context).journal());
    }
    /** Fixed platform adapters only, bounded by the native batch layout.
     * Journal reads/phase/identity checks remain independent. Each adapter's
     * every use still loads the CURRENT existing alias through getEntry;
     * no key, plaintext, original journal or successful verdict is cached. */
    static NativeRetainedBatchJournal.Ciphers fixedSlotCiphers(){return new FixedSlotCiphers();}
    private static final class FixedSlotCiphers implements NativeRetainedBatchJournal.Ciphers {
        private final AndroidKeystoreCipher[][] slots=new AndroidKeystoreCipher[2][NativeRetainedBatchJournal.MAX_CHUNKS];
        @Override public synchronized CredentialCipher slot(boolean query,int index)throws VaultFailure {
            // Index zero retains its existing independent legacy adapters.
            // The journal also validates each actual manifest before this call.
            if(index<1||index>=NativeRetainedBatchJournal.MAX_CHUNKS)throw new VaultFailure(NativeRetainedAttempt.FAILURE);
            var role=slots[query?1:0];var adapter=role[index];
            if(adapter==null)role[index]=adapter=new AndroidKeystoreCipher(
                AAD+":"+(query?"query:":"write:")+index,2*NativeRetainedAttemptJournal.PART_CHARACTERS+1024);
            return adapter;
        }
    }
    AndroidRetainedBatchStore(SharedPreferences preferences,CredentialCipher cipher,NativeRetainedBatchJournal.Ciphers ciphers,
        NativeRetainedAttemptJournal zeroWrite,NativeRetainedQueryJournal zeroQuery){
        if(preferences instanceof AndroidProtectedWorkPreferences || preferences==null||cipher==null||ciphers==null||zeroWrite==null||zeroQuery==null)throw new IllegalArgumentException("native_batch_store_dependencies_required");
        this.preferences=preferences;this.cipher=cipher;this.ciphers=ciphers;this.zeroWrite=zeroWrite;this.zeroQuery=zeroQuery;
    }
    NativeRetainedBatchJournal journal(){return new NativeRetainedBatchJournal(this,cipher,ciphers,LOCK,zeroWrite,zeroQuery);}
    @Override public Map<String,?> readAll() {
        synchronized(LOCK) { return java.util.Collections.unmodifiableMap(new java.util.HashMap<>(preferences.getAll())); }
    }
    /** Raw map callers cannot mint original-purpose admission. */
    @Override public boolean compareAndCommit(Map<String,String> expected,Map<String,String> next) throws VaultFailure {
        throw new VaultFailure(NativeRetainedAttempt.FAILURE);
    }
    @Override public Map<String,String> pendingOriginal(NativeRetainedBatchJournal.OriginalCommit original) throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.retainedCandidate(preferences,original); }
    }
    @Override public boolean commitOriginal(NativeRetainedBatchJournal.OriginalCommit original,Map<String,String> next) throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.commitRetained(preferences,original,next); }
    }
    @Override public NativeRetainedAttemptJournal.PendingPrepared pendingPreparedWrite(
        NativeRetainedBatchJournal.Manifest manifest,int index)throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.pendingPreparedWriteSlot(preferences,manifest,index); }
    }
    @Override public NativeRetainedQueryJournal.PendingPrepared pendingPreparedQuery(
        NativeRetainedBatchJournal.Manifest manifest,int index)throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.pendingPreparedQuerySlot(preferences,manifest,index); }
    }
    @Override public NativeRetainedBatchJournal.OriginalCommit pendingPreparation() throws VaultFailure {
        synchronized(LOCK) { return AndroidProtectedWorkPreferences.pendingRetainedBatch(preferences); }
    }
}
