package org.memphiszoo.custodial.vault;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;

/** Native-only immutable view of the EXISTING frozen work namespace. Removes
 * ONLY its authenticated freeze marker from original record encoding; never
 * broadens collection, decrypts work values, hides unknown records or ACKs them. */
final class NativeRetainedWorkCapture {
    static final String FENCE="native_separation_freeze.v1", PROBE="native_separation_probe.v1";
    final Map<String,?> frozen,original;
    final NativeRetainedRecordValues values;
    private final String wire;
    private final String[] wireScalars;
    private NativeRetainedWorkCapture(Map<String,?> frozen,Map<String,?> original,NativeRetainedRecordValues values,String wire) {
        this.frozen=frozen;this.original=original;this.values=values;this.wire=wire;this.wireScalars=copyWireScalars(wire);
    }
    static NativeRetainedWorkCapture capture(NativeSeparationFreeze.Store store) throws VaultFailure {
        if(store==null) throw invalid();
        try {
            Map<String,?> raw=store.separationRawSnapshot();
            if(raw==null || raw.size()>4097 || !raw.containsKey(FENCE) || raw.containsKey(PROBE)) throw invalid();
            Map<String,Object> frozen=new HashMap<>();int entries=0;
            for(Map.Entry<String,?> entry:raw.entrySet()) {
                if(++entries>4097 || entry.getKey()==null) throw invalid();Object value=entry.getValue();
                if(value instanceof Set<?>) {
                    if(((Set<?>)value).size()>4096) throw invalid();Set<String> copy=new HashSet<>();int count=0;
                    for(Object item:(Set<?>)value) {if(++count>4096 || !(item instanceof String) || !copy.add((String)item)) throw invalid();}
                    value=Collections.unmodifiableSet(copy);
                }
                frozen.put(entry.getKey(),value);
            }
            Map<String,Object> original=new HashMap<>(frozen);Object marker=original.remove(FENCE);
            if(!(marker instanceof String) || ((String)marker).isEmpty()) throw invalid();
            NativeRetainedRecordValues values=NativeRetainedRecordValues.capture(original);
            JSONObject proof=store.readSeparationSnapshotEvidence(Collections.unmodifiableMap(frozen));
            if(proof==null || !NativeProtectedWorkSnapshot.exactRawEquals(frozen,store.separationRawSnapshot())) throw invalid();
            return new NativeRetainedWorkCapture(Collections.unmodifiableMap(frozen),Collections.unmodifiableMap(original),values,proof.toString());
        } catch(VaultFailure error) {throw error;}
        catch(Exception error) {throw new VaultFailure(NativeRetainedAttempt.FAILURE,error);}
    }
    JSONObject wire() throws VaultFailure {
        try {
            if(wireScalars==null)return new JSONObject(wire);
            JSONObject copy=new JSONObject();for(int i=0;i<wireScalars.length;i+=2)copy.put(wireScalars[i],wireScalars[i+1]);return copy;
        }catch(Exception error){throw new VaultFailure(NativeRetainedAttempt.FAILURE,error);}
    }
    /** Shape-only copy of the serialized snapshot, never authentication. Keep
     * parsed field order/scalars, and preserve the opaque fallback unchanged
     * for unknown/non-string/malformed proofs. Every caller gets its own object. */
    private static String[] copyWireScalars(String wire) {
        try {
            JSONObject parsed=new JSONObject(wire);if(parsed.length()!=4)return null;
            for(String key:new String[]{"attestation_version","manifest_body","manifest_sha256","attestation"})if(!(parsed.opt(key) instanceof String))return null;
            String[] scalars=new String[8];int index=0;
            for(var keys=parsed.keys();keys.hasNext();){String key=keys.next();scalars[index++]=key;scalars[index++]=(String)parsed.get(key);}
            return scalars;
        }catch(Exception error){return null;}
    }
    void requireUnchanged(NativeSeparationFreeze.Store store) throws VaultFailure {
        if(!NativeProtectedWorkSnapshot.exactRawEquals(frozen,store.separationRawSnapshot())) throw invalid();
    }
    private static VaultFailure invalid(){return new VaultFailure(NativeRetainedAttempt.FAILURE);}
}
