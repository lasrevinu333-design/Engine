package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Private immutable view for existing native decoders. Never a JS snapshot or
 * authority writer. Even editor/listener acquisition is rejected. */
final class AndroidReadOnlyPreferences implements SharedPreferences {
    private final Map<String,Object> values;
    AndroidReadOnlyPreferences(Map<String,?> source) {
        Map<String,Object> copy = new HashMap<>();
        for (Map.Entry<String,?> entry : source.entrySet()) copy.put(entry.getKey(),
            entry.getValue() instanceof Set<?> ? Collections.unmodifiableSet(new HashSet<>((Set<?>) entry.getValue())) : entry.getValue());
        values = Collections.unmodifiableMap(copy);
    }
    @Override public Map<String,?> getAll() { return values; }
    @Override public boolean contains(String key) { return values.containsKey(key); }
    @Override public String getString(String key,String fallback) { return values.containsKey(key) ? (String) values.get(key) : fallback; }
    @SuppressWarnings("unchecked")
    @Override public Set<String> getStringSet(String key,Set<String> fallback) { return values.containsKey(key) ? (Set<String>) values.get(key) : fallback; }
    @Override public int getInt(String key,int fallback) { return values.containsKey(key) ? (Integer) values.get(key) : fallback; }
    @Override public long getLong(String key,long fallback) { return values.containsKey(key) ? (Long) values.get(key) : fallback; }
    @Override public float getFloat(String key,float fallback) { return values.containsKey(key) ? (Float) values.get(key) : fallback; }
    @Override public boolean getBoolean(String key,boolean fallback) { return values.containsKey(key) ? (Boolean) values.get(key) : fallback; }
    @Override public Editor edit() { throw new UnsupportedOperationException("custodial_read_only_observation"); }
    @Override public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) { throw new UnsupportedOperationException("custodial_read_only_observation"); }
    @Override public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) { throw new UnsupportedOperationException("custodial_read_only_observation"); }
}
