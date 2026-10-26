package org.memphiszoo.custodial.vault;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/** Migration cleanup SOURCE guard only. Never reads/decrypts/creates/deletes a
 * key, validates a credential, or grants inventory/finalizer/removal authority.
 * Unknown rows in either historical namespace stop cleanup before any edit.
 * Readback rechecks do NOT provide a cross-process durable/ABA writer fence.
 */
final class LegacyCleanupSnapshotGuard {
    private static final Set<String> V1_STRINGS=Set.of("credential_ciphertext","credential_iv","installation_record",
        "pending_operation_id","pending_device_id","removal_operation_id","blocked_reason","legacy_seal");
    private static final Set<String> V1_BOOLEANS=Set.of("installation_active","removal_remote_complete");
    private static final Set<String> SECURE=Set.of("capacitor-storage_memphis_zoo_custodial_installation_record_v1",
        "capacitor-storage_memphis_zoo_custodial_device_credential","capacitor-storage_memphis_zoo_custodial_installation_seal");
    static final class Captured {
        private final Map<String,Object> v1,secure;
        private Captured(Map<String,?> first,Map<String,?> second)throws VaultFailure{
            v1=copyKnown(first,false);secure=copyKnown(second,true);
        }
        Set<String> originalV1Keys(){return v1.keySet();}
        void requireOriginal(Map<String,?> first,Map<String,?> second)throws VaultFailure{
            if(!v1.equals(copyKnown(first,false))||!secure.equals(copyKnown(second,true)))throw invalid();
        }
        void requireAfterV1(Map<String,?> first,Map<String,?> second)throws VaultFailure{
            if(!copyKnown(first,false).isEmpty()||!secure.equals(copyKnown(second,true)))throw invalid();
        }
        void requireEmpty(Map<String,?> first,Map<String,?> second)throws VaultFailure{
            if(!copyKnown(first,false).isEmpty()||!copyKnown(second,true).isEmpty())throw invalid();
        }
    }
    static Captured capture(Map<String,?> first,Map<String,?> second)throws VaultFailure{return new Captured(first,second);}
    private static Map<String,Object> copyKnown(Map<String,?> source,boolean second)throws VaultFailure{
        if(source==null||source.size()>(second?SECURE.size():V1_STRINGS.size()+V1_BOOLEANS.size()))throw invalid();
        Map<String,Object> result=new HashMap<>();
        for(var row:source.entrySet()){
            String key=row.getKey();Object value=row.getValue();
            if(key==null)throw invalid();
            boolean string=second?SECURE.contains(key):V1_STRINGS.contains(key),bool=!second&&V1_BOOLEANS.contains(key);
            if((!string&&!bool)||(string&&!(value instanceof String))||(bool&&!(value instanceof Boolean)))throw invalid();
            result.put(key,value);
        }
        return Collections.unmodifiableMap(result);
    }
    private static VaultFailure invalid(){return new VaultFailure("custodial_native_legacy_cleanup_failed");}
}
