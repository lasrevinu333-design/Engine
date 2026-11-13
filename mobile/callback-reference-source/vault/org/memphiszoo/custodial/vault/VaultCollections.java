package org.memphiszoo.custodial.vault;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Immutable collection factories implemented only with API-24 runtime calls. */
final class VaultCollections {
    private VaultCollections() {}

    @SafeVarargs
    static <T> List<T> listOf(T... values) {
        List<T> result = new ArrayList<>(values.length);
        for (T value : values) result.add(Objects.requireNonNull(value));
        return Collections.unmodifiableList(result);
    }

    @SafeVarargs
    static <T> Set<T> setOf(T... values) {
        Set<T> result = new LinkedHashSet<>();
        for (T value : values) {
            if (!result.add(Objects.requireNonNull(value))) throw new IllegalArgumentException("duplicate value");
        }
        return Collections.unmodifiableSet(result);
    }

    static <K, V> Map<K, V> copyMap(Map<? extends K, ? extends V> source) {
        Map<K, V> result = new LinkedHashMap<>();
        for (Map.Entry<? extends K, ? extends V> entry : source.entrySet()) {
            putUnique(result, entry.getKey(), entry.getValue());
        }
        return Collections.unmodifiableMap(result);
    }

    static <K, V> Map<K, V> mapOf() {
        return Collections.emptyMap();
    }

    static <K, V> Map<K, V> mapOf(K key1, V value1) {
        Map<K, V> result = new LinkedHashMap<>();
        putUnique(result, key1, value1);
        return Collections.unmodifiableMap(result);
    }

    static <K, V> Map<K, V> mapOf(K key1, V value1, K key2, V value2) {
        Map<K, V> result = new LinkedHashMap<>();
        putUnique(result, key1, value1);
        putUnique(result, key2, value2);
        return Collections.unmodifiableMap(result);
    }

    static <K, V> Map<K, V> mapOf(
        K key1, V value1,
        K key2, V value2,
        K key3, V value3,
        K key4, V value4
    ) {
        Map<K, V> result = new LinkedHashMap<>();
        putUnique(result, key1, value1);
        putUnique(result, key2, value2);
        putUnique(result, key3, value3);
        putUnique(result, key4, value4);
        return Collections.unmodifiableMap(result);
    }

    private static <K, V> void putUnique(Map<K, V> target, K key, V value) {
        Objects.requireNonNull(key);
        Objects.requireNonNull(value);
        if (target.containsKey(key)) throw new IllegalArgumentException("duplicate key");
        target.put(key, value);
    }
}
