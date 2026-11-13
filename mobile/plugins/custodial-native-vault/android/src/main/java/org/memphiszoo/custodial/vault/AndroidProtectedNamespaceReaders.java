package org.memphiszoo.custodial.vault;

import android.content.SharedPreferences;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Adapters for already-opened, main-owned native preference stores.
 * No Context, namespace discovery/open/create, editor, decrypt or key access.
 * getAll() is only an observation, not disk durability or semantic acceptance.
 */
final class AndroidProtectedNamespaceReaders {
    static Map<String,NativeProtectedNamespaceObservation.Store> bind(Map<String,SharedPreferences> existing) throws VaultFailure {
        if(existing==null||!existing.keySet().equals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()))
            throw new VaultFailure(NativeProtectedNamespaceObservation.FAILURE);
        Map<String,NativeProtectedNamespaceObservation.Store> readers=new TreeMap<>();
        FixedFamily family=new FixedFamily();
        Set<SharedPreferences> unique=Collections.newSetFromMap(new IdentityHashMap<>());
        for(var entry:existing.entrySet()){
            SharedPreferences preferences=entry.getValue();
            if(preferences==null||!unique.add(preferences))throw new VaultFailure(NativeProtectedNamespaceObservation.FAILURE);
            readers.put(entry.getKey(),new BoundStore(entry.getKey(),preferences,family));
        }
        return Collections.unmodifiableMap(readers);
    }
    /** Only this fixed factory can create a family. This identity says that
     * the eight adapters read ONE global native owner, not that it is current
     * or permits any effect. No successful stamp is stored in the family. */
    private static final class FixedFamily {
        private final Object coordinator=AndroidProtectedWorkPreferences.retainedCommitLock();
    }
    static String readFixedOwnerDurableStamp(Map<String,NativeProtectedNamespaceObservation.Store> stores,
        Object coordinator)throws VaultFailure {
        if(!isFixedOwnerFamily(stores,coordinator))return null;
        // No cache: each invocation still reopens and validates the SAME real
        // global journal/current. Generic/mixed readers use eight-way checks.
        return AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture();
    }
    /** Fixed adapter identity only, never a caller claim or live stamp. The
     * typed HELD observer uses this same predicate without ordinary admission. */
    static boolean isFixedOwnerFamily(Map<String,NativeProtectedNamespaceObservation.Store> stores,
        Object coordinator)throws VaultFailure {
        if(stores==null||coordinator!=AndroidProtectedWorkPreferences.retainedCommitLock()
            ||!stores.keySet().equals(NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()))return false;
        FixedFamily family=null;
        Set<BoundStore> adapters=Collections.newSetFromMap(new IdentityHashMap<>());
        Set<SharedPreferences> preferences=Collections.newSetFromMap(new IdentityHashMap<>());
        for(String name:NativeProtectedNamespaceObservation.KEY_FAMILIES.keySet()){
            var reader=stores.get(name);
            if(!(reader instanceof BoundStore))return false; // private final exact type, never caller interface claims
            BoundStore bound=(BoundStore)reader;
            if(!name.equals(bound.namespace)||bound.coordinator!=coordinator||bound.family.coordinator!=coordinator
                ||family!=null&&family!=bound.family||!adapters.add(bound)||!preferences.add(bound.preferences))return false;
            family=bound.family;
        }
        if(!Thread.holdsLock(coordinator))throw new VaultFailure(NativeProtectedNamespaceObservation.FAILURE);
        return true;
    }
    private static final class BoundStore implements NativeProtectedNamespaceObservation.GuardedStore {
        private final SharedPreferences preferences;
        private final String namespace;
        private final FixedFamily family;
        private final Object coordinator;
        private BoundStore(String namespace,SharedPreferences preferences,FixedFamily family){
            this.namespace=namespace;this.preferences=preferences;this.family=family;coordinator=family.coordinator;
        }
        @Override public Object commitCoordinator(){return coordinator;}
        @Override public long mutationEpochForReadOnlyCapture(){
            return AndroidProtectedWorkPreferences.retainedMutationEpochForReadOnlyCapture();
        }
        @Override public String durableMutationStampForReadOnlyCapture()throws VaultFailure{
            return AndroidProtectedWorkPreferences.retainedMutationStampForReadOnlyCapture();
        }
        @Override public Map<String,?> readAll(){synchronized(coordinator){return preferences.getAll();}}
    }
    private AndroidProtectedNamespaceReaders(){}
}
