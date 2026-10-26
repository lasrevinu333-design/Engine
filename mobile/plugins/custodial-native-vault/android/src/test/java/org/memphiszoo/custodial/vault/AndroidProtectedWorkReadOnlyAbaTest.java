package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.Test;
import static org.junit.Assert.*;

/** NEW actual work adapter/source-observation cases. The SDK interface is real;
 * the preferences delegate is an explicit memory-only fault fixture, not disk,
 * an Android process, original inventory ACK or a durable all8/browser fence.
 */
public final class AndroidProtectedWorkReadOnlyAbaTest {
    @Test public void sameBytesAfterAnOrdinaryAbaCannotReuseOriginalObservation() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences first = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original = first.observeReadOnly();
        assertTrue(first.edit().putString("protected", "B").commit());
        assertTrue(first.edit().putString("protected", "A").commit());
        assertEquals(original.values, raw.getAll());
        assertFalse("equal bytes after ABA cannot attest the original observation", first.matchesReadOnly(original));
    }
    @Test public void unchangedOriginalSameSourceObservationStillMatches() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences wrapper = new AndroidProtectedWorkPreferences(raw);
        assertTrue(wrapper.matchesReadOnly(wrapper.observeReadOnly()));
        assertFalse(wrapper.matchesReadOnly(null));
    }
    @Test public void aNoopCommitStillInvalidatesTheOldObservation() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences wrapper = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original = wrapper.observeReadOnly();
        assertTrue(wrapper.edit().putString("protected", "A").commit());
        assertEquals(original.values, raw.getAll());
        assertFalse(wrapper.matchesReadOnly(original));
        assertTrue(wrapper.matchesReadOnly(wrapper.observeReadOnly()));
    }
    @Test public void falseMemoryOnlyCommitAndRestorationRemainAChangedObservation() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences wrapper = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original = wrapper.observeReadOnly();
        raw.failNext = true;
        assertFalse(wrapper.edit().putString("protected", "B").commit());
        assertEquals("B", raw.getString("protected", null));
        assertTrue(wrapper.edit().putString("protected", "A").commit());
        assertEquals(original.values, raw.getAll());
        assertFalse(wrapper.matchesReadOnly(original));
    }
    @Test public void thrownMemoryOnlyCommitAndRestorationRemainAChangedObservation() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences wrapper = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original = wrapper.observeReadOnly();
        raw.throwNext = true;
        try { wrapper.edit().putString("protected", "B").commit(); fail("fault fixture must throw"); }
        catch (IllegalStateException expected) { assertEquals("synthetic-memory-only-commit", expected.getMessage()); }
        assertTrue(wrapper.edit().putString("protected", "A").commit());
        assertEquals(original.values, raw.getAll());
        assertFalse(wrapper.matchesReadOnly(original));
    }
    @Test public void sourceIdentityAndAliasMutationsAreBoundToTheOriginalObservation() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences first = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences alias = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original = first.observeReadOnly();
        assertTrue(alias.matchesReadOnly(original));
        MemoryPreferences otherRaw = new MemoryPreferences();
        otherRaw.values.put("protected", "A");
        AndroidProtectedWorkPreferences other = new AndroidProtectedWorkPreferences(otherRaw);
        assertFalse("equal bytes from another bound store are not the original source", other.matchesReadOnly(original));
        assertTrue(alias.edit().putString("protected", "B").commit());
        assertTrue(alias.edit().putString("protected", "A").commit());
        assertFalse(first.matchesReadOnly(original));
    }
    @Test public void pendingProbeAndExactStorageCancellationCannotRestoreOldObservation() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences wrapper = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original = wrapper.observeReadOnly();
        wrapper.prepareProbe(original.values, "SYNTHETIC-PROTECTED-PROBE-NOT-AUTHORITY");
        assertTrue(wrapper.frozen());
        wrapper.cancelProbe(original.values, "SYNTHETIC-PROTECTED-PROBE-NOT-AUTHORITY");
        assertFalse(wrapper.frozen());
        assertEquals(original.values, raw.getAll());
        assertFalse(wrapper.matchesReadOnly(original));
        // This exercises the storage primitive only, never a native authenticated
        // cancellation, separation decision, current inventory or key release.
    }
    @Test public void refusedReservedKeyEditHasNoMutationAndPreservesAnUnchangedObservation() throws Exception {
        MemoryPreferences raw = new MemoryPreferences();
        raw.values.put("protected", "A");
        AndroidProtectedWorkPreferences wrapper = new AndroidProtectedWorkPreferences(raw);
        AndroidProtectedWorkPreferences.ReadOnlyObservation original = wrapper.observeReadOnly();
        assertFalse(wrapper.edit().putString(AndroidProtectedWorkPreferences.FENCE_KEY, "not-authority").commit());
        assertEquals(0, raw.commits);
        assertEquals(original.values, raw.getAll());
        assertTrue(wrapper.matchesReadOnly(original));
    }

    static final class MemoryPreferences implements SharedPreferences {
        final Map<String,Object> values = new HashMap<>();
        boolean failNext, throwNext; int commits;
        public Map<String,?> getAll() { return new HashMap<>(values); }
        public String getString(String key,String fallback) { return (String)values.getOrDefault(key,fallback); }
        @SuppressWarnings("unchecked") public Set<String> getStringSet(String key,Set<String> fallback) {
            Object value=values.get(key);return value==null?fallback:new HashSet<>((Set<String>)value);
        }
        public int getInt(String key,int fallback) { return (Integer)values.getOrDefault(key,fallback); }
        public long getLong(String key,long fallback) { return (Long)values.getOrDefault(key,fallback); }
        public float getFloat(String key,float fallback) { return (Float)values.getOrDefault(key,fallback); }
        public boolean getBoolean(String key,boolean fallback) { return (Boolean)values.getOrDefault(key,fallback); }
        public boolean contains(String key) { return values.containsKey(key); }
        public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {}
        public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {}
        public Editor edit() { return new MemoryEditor(); }
        final class MemoryEditor implements Editor {
            final Map<String,Object> put=new HashMap<>();final Set<String> removed=new HashSet<>();boolean clear;
            public Editor putString(String key,String value) { put.put(key,value);return this; }
            public Editor putStringSet(String key,Set<String> value) { put.put(key,value==null?null:new HashSet<>(value));return this; }
            public Editor putInt(String key,int value) { put.put(key,value);return this; }
            public Editor putLong(String key,long value) { put.put(key,value);return this; }
            public Editor putFloat(String key,float value) { put.put(key,value);return this; }
            public Editor putBoolean(String key,boolean value) { put.put(key,value);return this; }
            public Editor remove(String key) { removed.add(key);return this; }
            public Editor clear() { clear=true;return this; }
            public boolean commit() {
                commits++;if(clear)values.clear();for(String key:removed)values.remove(key);
                for(var entry:put.entrySet())if(entry.getValue()==null)values.remove(entry.getKey());else values.put(entry.getKey(),entry.getValue());
                if(throwNext){throwNext=false;throw new IllegalStateException("synthetic-memory-only-commit");}
                if(failNext){failNext=false;return false;}return true;
            }
            public void apply() { throw new AssertionError("no synthetic apply"); }
        }
    }
}
