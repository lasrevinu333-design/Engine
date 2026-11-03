package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** One process-wide commit boundary across Activity/plugin/NFC store instances.
 * This is a storage primitive, NOT separation authentication or an inventory
 * acknowledgement. No runtime currently invokes freeze(): the native owner
 * must bind/authenticate/encrypt its exact snapshot before that is mounted.
 * Unknown/corrupt fence bytes still prohibit mutation; there is no thaw API.
 */
final class AndroidProtectedWorkPreferences implements SharedPreferences {
    static final String FENCE_KEY = "native_separation_freeze.v1";
    // Durable CHECK PENDING, not authenticated separation or inventory proof.
    // Established before HTTP so a crash/write failure after a genuine native
    // observation cannot resurrect ordinary cached admission on restart.
    static final String PROBE_KEY = "native_separation_probe.v1";
    static final String FAILURE = "custodial_native_protected_work_frozen";
    private static final Object COMMIT_LOCK = new Object();
    // SharedPreferences.commit(false) can already have removed the guard in
    // memory. Every adapter of the same Android private-preferences object must
    // remain denied until the identical pending bytes are durably restored or
    // an authenticated exact cancellation completes. Process restart reads the
    // disk guard; this is not a substitute for that durable marker.
    private static final Map<SharedPreferences,String> UNCERTAIN_CANCELLATIONS = new java.util.IdentityHashMap<>();
    private final SharedPreferences delegate;

    AndroidProtectedWorkPreferences(SharedPreferences delegate) {
        if (delegate == null || delegate instanceof AndroidProtectedWorkPreferences)
            throw new IllegalArgumentException("raw private preferences required");
        this.delegate = delegate;
    }

    /** Immutable raw snapshot, including unreadable encrypted records. A caller
     * may classify a COPY but must never interpret decode failure as absence. */
    Map<String, ?> protectedSnapshot() {
        synchronized (COMMIT_LOCK) { return copy(delegate.getAll()); }
    }

    static final class ReadOnlyObservation {
        final Map<String,?> values; final boolean frozen;
        ReadOnlyObservation(Map<String,?> values,boolean frozen) { this.values=values; this.frozen=frozen; }
    }
    ReadOnlyObservation observeReadOnly() {
        synchronized(COMMIT_LOCK) { return new ReadOnlyObservation(copy(delegate.getAll()), frozen()); }
    }
    boolean matchesReadOnly(ReadOnlyObservation original) throws VaultFailure {
        synchronized(COMMIT_LOCK) { return original != null && original.frozen == frozen() && NativeProtectedWorkSnapshot.exactRawEquals(original.values,delegate.getAll()); }
    }

    /** Compare-and-freeze exact bytes in one durable commit. Caller provides an
     * already protected context record; no credential/browser input accepted by
     * any mounted route. On ambiguous failure preserve bytes and retry exact.
     * Browser-only drafts remain UNKNOWN; this method cannot mark them empty.
     */
    void freeze(Map<String, ?> expected, String protectedContext) throws VaultFailure {
        freeze(expected,protectedContext,null);
    }
    void freeze(Map<String, ?> expected, String protectedContext,String expectedProbe) throws VaultFailure {
        if (expected == null || expected.containsKey(FENCE_KEY) || expected.containsKey(PROBE_KEY) || protectedContext == null
            || protectedContext.isEmpty() || protectedContext.length() > 262144)
            throw new VaultFailure(FAILURE);
        try { synchronized (COMMIT_LOCK) {
            if(UNCERTAIN_CANCELLATIONS.containsKey(delegate))throw new VaultFailure(FAILURE);
            Map<String, ?> original = copy(expected);
            Map<String, ?> observed = copy(delegate.getAll());
            Map<String,Object> withoutProbe=new HashMap<>(observed);
            Object probe=withoutProbe.remove(PROBE_KEY);
            if((observed.containsKey(PROBE_KEY)&&!(probe instanceof String))
                ||!java.util.Objects.equals(probe,expectedProbe))throw new VaultFailure(FAILURE);
            if (observed.containsKey(FENCE_KEY)) {
                Map<String, Object> withoutFence = new HashMap<>(withoutProbe);
                Object fence = withoutFence.remove(FENCE_KEY);
                if (!protectedContext.equals(fence) || !NativeProtectedWorkSnapshot.exactRawEquals(original,withoutFence)) throw new VaultFailure(FAILURE);
                // A failed SharedPreferences commit may update MEMORY only.
                // Exact bytes must be recommitted before retry reports success.
            } else {
                if (!NativeProtectedWorkSnapshot.exactRawEquals(original,withoutProbe)) throw new VaultFailure("custodial_native_protected_work_changed");
            }
            Map<String, Object> after = new HashMap<>(original); after.put(FENCE_KEY, protectedContext);
            try {
                if (!delegate.edit().putString(FENCE_KEY, protectedContext).remove(PROBE_KEY).commit()
                    || !NativeProtectedWorkSnapshot.exactRawEquals(after,delegate.getAll())) throw new VaultFailure(FAILURE);
            } catch (VaultFailure error) { throw error; }
            catch (Exception error) { throw new VaultFailure(FAILURE, error); }
        }} catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure(FAILURE,error); }
    }

    /** Before transport, persist an exact pending check. No authenticated
     * conclusion exists yet, and this class exposes no cancel/thaw operation.
     * Lost connectivity leaves pending work protected, never erased/accepted. */
    void prepareProbe(Map<String,?> expected,String protectedProbe)throws VaultFailure{
        if(expected==null||expected.containsKey(FENCE_KEY)||expected.containsKey(PROBE_KEY)
            ||protectedProbe==null||protectedProbe.isEmpty()||protectedProbe.length()>262144)throw new VaultFailure(FAILURE);
        try{synchronized(COMMIT_LOCK){
            String uncertain=UNCERTAIN_CANCELLATIONS.get(delegate);
            if(uncertain!=null&&!uncertain.equals(protectedProbe))throw new VaultFailure(FAILURE);
            Map<String,Object> observed=new HashMap<>(copy(delegate.getAll()));
            if(observed.containsKey(FENCE_KEY))throw new VaultFailure(FAILURE);
            boolean hasProbe=observed.containsKey(PROBE_KEY);
            Object prior=observed.remove(PROBE_KEY);
            if(hasProbe&&!protectedProbe.equals(prior))throw new VaultFailure(FAILURE);
            if(!NativeProtectedWorkSnapshot.exactRawEquals(copy(expected),observed))throw new VaultFailure("custodial_native_protected_work_changed");
            observed.put(PROBE_KEY,protectedProbe);
            // A same-byte retry must establish disk commit, not memory visibility.
            if(!delegate.edit().putString(PROBE_KEY,protectedProbe).commit()||!NativeProtectedWorkSnapshot.exactRawEquals(observed,delegate.getAll()))throw new VaultFailure(FAILURE);
            UNCERTAIN_CANCELLATIONS.remove(delegate);
        }}catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    /** Native recovery may recover the exact marker hidden by an unsuccessful
     * memory-only removal. This value is not authority to cancel anything. */
    Object recoverableProbe(){synchronized(COMMIT_LOCK){
        if(delegate.contains(PROBE_KEY))return delegate.getAll().get(PROBE_KEY);
        return UNCERTAIN_CANCELLATIONS.get(delegate);
    }}

    /** Storage half only; caller must hold the native check owner and freshly
     * authenticate the unchanged original full principal. Cannot thaw FENCE,
     * alter work, accept missing/malformed markers, or adopt a different check. */
    void cancelProbe(Map<String,?> expected,String protectedProbe)throws VaultFailure{
        if(expected==null||expected.containsKey(FENCE_KEY)||expected.containsKey(PROBE_KEY)
            ||protectedProbe==null||protectedProbe.isEmpty())throw new VaultFailure(FAILURE);
        try{synchronized(COMMIT_LOCK){
            Map<String,Object> current=new HashMap<>(copy(delegate.getAll()));
            if(current.containsKey(FENCE_KEY)||!protectedProbe.equals(current.remove(PROBE_KEY))
                ||!NativeProtectedWorkSnapshot.exactRawEquals(copy(expected),current))throw new VaultFailure(FAILURE);
            String uncertain=UNCERTAIN_CANCELLATIONS.get(delegate);
            if(uncertain!=null&&!uncertain.equals(protectedProbe))throw new VaultFailure(FAILURE);
            UNCERTAIN_CANCELLATIONS.put(delegate,protectedProbe);
            if(!delegate.edit().remove(PROBE_KEY).commit()||!NativeProtectedWorkSnapshot.exactRawEquals(current,delegate.getAll()))throw new VaultFailure(FAILURE);
            UNCERTAIN_CANCELLATIONS.remove(delegate);
        }}catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    boolean frozen() { synchronized (COMMIT_LOCK) { return UNCERTAIN_CANCELLATIONS.containsKey(delegate)||delegate.contains(FENCE_KEY)||delegate.contains(PROBE_KEY); } }
    private static Map<String, ?> copy(Map<String, ?> source) {
        if (source == null) throw new IllegalStateException("protected inventory unavailable");
        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, ?> entry : source.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof Set<?>) value = Collections.unmodifiableSet(new HashSet<>((Set<?>) value));
            result.put(entry.getKey(), value);
        }
        return Collections.unmodifiableMap(result);
    }
    @Override public Map<String, ?> getAll() { return protectedSnapshot(); }
    @Override public String getString(String key, String fallback) { synchronized(COMMIT_LOCK){return delegate.getString(key,fallback);} }
    @Override public Set<String> getStringSet(String key, Set<String> fallback) {
        synchronized(COMMIT_LOCK){Set<String> value=delegate.getStringSet(key,fallback);return value==null?null:new HashSet<>(value);}
    }
    @Override public int getInt(String key,int fallback){synchronized(COMMIT_LOCK){return delegate.getInt(key,fallback);}}
    @Override public long getLong(String key,long fallback){synchronized(COMMIT_LOCK){return delegate.getLong(key,fallback);}}
    @Override public float getFloat(String key,float fallback){synchronized(COMMIT_LOCK){return delegate.getFloat(key,fallback);}}
    @Override public boolean getBoolean(String key,boolean fallback){synchronized(COMMIT_LOCK){return delegate.getBoolean(key,fallback);}}
    @Override public boolean contains(String key){synchronized(COMMIT_LOCK){return delegate.contains(key);}}
    @Override public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener){delegate.registerOnSharedPreferenceChangeListener(listener);}
    @Override public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener){delegate.unregisterOnSharedPreferenceChangeListener(listener);}
    @Override public Editor edit(){return new GuardedEditor(delegate.edit());}
    private final class GuardedEditor implements Editor {
        private final Editor editor;
        private boolean refused;
        GuardedEditor(Editor editor){this.editor=editor;}
        private void key(String key){if(FENCE_KEY.equals(key)||PROBE_KEY.equals(key))refused=true;}
        @Override public Editor putString(String key,String value){key(key);editor.putString(key,value);return this;}
        @Override public Editor putStringSet(String key,Set<String> value){key(key);editor.putStringSet(key,value==null?null:new HashSet<>(value));return this;}
        @Override public Editor putInt(String key,int value){key(key);editor.putInt(key,value);return this;}
        @Override public Editor putLong(String key,long value){key(key);editor.putLong(key,value);return this;}
        @Override public Editor putFloat(String key,float value){key(key);editor.putFloat(key,value);return this;}
        @Override public Editor putBoolean(String key,boolean value){key(key);editor.putBoolean(key,value);return this;}
        @Override public Editor remove(String key){key(key);editor.remove(key);return this;}
        @Override public Editor clear(){refused=true;return this;}
        @Override public boolean commit(){synchronized(COMMIT_LOCK){
            if(refused||UNCERTAIN_CANCELLATIONS.containsKey(delegate)||delegate.contains(FENCE_KEY)||delegate.contains(PROBE_KEY))return false;
            return editor.commit();
        }}
        @Override public void apply(){throw new IllegalStateException("protected work requires synchronous verified commit");}
    }
}
