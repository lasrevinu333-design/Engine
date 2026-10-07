package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Read-only structural links inside an exact, authenticated frozen inventory.
 * A matching stored Finish is NOT physical, signature, cutoff or server proof.
 * No timestamp is rewritten and every orphan/unreadable record is retained.
 * This is native-only and unmounted; it cannot admit work or finalize reuse.
 */
final class NativeProtectedSessionInventory {
    private static final String OCCURRENCE="offline_occurrence_sha256:", FINISH="offline_finish_proof_sha256:";
    private static final String FAILURE=NativeProtectedWorkSnapshot.FAILURE;
    private static final Set<String> OCCURRENCE_FIELDS=Set.of("client_session_id","device_id","location_code","snapshot_id",
        "generated_at","expires_at","anchor_elapsed_realtime_ms","boot_count","native_scan_entry_id","started_at","completed_at");
    private static final Set<String> FINISH_FIELDS=Set.of("client_session_id","device_id","location_code","started_at","completed_at","entry_id");

    static JSONArray inspect(Set<String> rawKeys,Map<String,NativeProtectedWorkInventory.Decoded> decoded,JSONObject principal)throws VaultFailure{
        try{
            JSONArray result=new JSONArray();Set<String> paired=new TreeSet<>();
            for(String key:new TreeSet<>(rawKeys)){
                if(!key.startsWith(OCCURRENCE))continue;
                JSONObject item=retained(key,"OCCURRENCE");
                NativeProtectedWorkInventory.Decoded start=decoded.get(key);
                if(start!=null){
                    item.put("occurrence_sha256",start.plaintextDigest);
                    try{
                        JSONObject occurrence=start.value;
                        String session=validateOccurrence(key,occurrence,principal),finishKey=FINISH+NativeProviderPrincipal.hash(session);
                        item.put("client_session_id",session).put("start_entry_id",text(occurrence,"native_scan_entry_id"));
                        String completed=text(occurrence,"completed_at");
                        if(rawKeys.contains(finishKey)){
                            paired.add(finishKey);item.put("finish_source_key_sha256",NativeProviderPrincipal.hash(finishKey));
                            NativeProtectedWorkInventory.Decoded finish=decoded.get(finishKey);
                            if(finish!=null){
                                item.put("finish_sha256",finish.plaintextDigest);
                                validateFinish(finish.value,occurrence);
                                item.put("finish_entry_id",uuid(finish.value,"entry_id")).put("state","LINKED_UNVERIFIED");
                            }else item.put("state","FINISH_UNREADABLE");
                        }else item.put("state",completed.isEmpty()?"OPEN_RETAINED":"FINISH_RECORD_MISSING");
                    }catch(VaultFailure error){item.put("state","UNRESOLVED_INVALID_OR_MISMATCHED");}
                }
                result.put(item);
            }
            // A Finish without a validated owning occurrence remains an item,
            // even when another corrupt occurrence might contain the same ID.
            for(String key:new TreeSet<>(rawKeys))if(key.startsWith(FINISH)&&!paired.contains(key)){
                JSONObject item=retained(key,"ORPHAN_FINISH");
                NativeProtectedWorkInventory.Decoded finish=decoded.get(key);
                if(finish!=null)item.put("finish_sha256",finish.plaintextDigest);
                result.put(item);
            }
            return result;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }

    private static JSONObject retained(String key,String kind)throws Exception{
        return new JSONObject().put("source_key_sha256",NativeProviderPrincipal.hash(key)).put("kind",kind)
            .put("state","UNKNOWN").put("retained_unresolved",true).put("automatic_acceptance",false)
            .put("start_cutoff_proof","UNKNOWN").put("finish_cutoff_proof","UNKNOWN")
            .put("server_acceptance","NOT_ESTABLISHED");
    }
    private static String validateOccurrence(String key,JSONObject row,JSONObject principal)throws VaultFailure{
        try{
            Set<String> actual=keys(row),current=new TreeSet<>(OCCURRENCE_FIELDS);current.add("clock_base_at");
            if(!actual.equals(OCCURRENCE_FIELDS)&&!actual.equals(current))throw invalid();
            String session=uuid(row,"client_session_id"),device=text(row,"device_id"),location=text(row,"location_code");
            if(!key.equals(OCCURRENCE+NativeProviderPrincipal.hash(session))||!device.equals(principal.get("device_id"))
                ||!location.matches("[A-Z0-9._:-]{1,100}")||!text(row,"snapshot_id").matches("[a-f0-9]{64}"))throw invalid();
            String scan=text(row,"native_scan_entry_id");if(!scan.isEmpty())uuid(row,"native_scan_entry_id");
            integer(row,"anchor_elapsed_realtime_ms",Long.MAX_VALUE);integer(row,"boot_count",Integer.MAX_VALUE);
            String generated=timestamp(row,"generated_at"),expires=timestamp(row,"expires_at"),start=timestamp(row,"started_at");
            String base=row.has("clock_base_at")?timestamp(row,"clock_base_at"):generated;
            if(VaultTimestamps.compareInstants(generated,expires,FAILURE)>=0
                ||VaultTimestamps.compareInstants(base,generated,FAILURE)<0
                ||VaultTimestamps.compareInstants(start,base,FAILURE)<0
                ||VaultTimestamps.compareInstants(start,expires,FAILURE)>0)throw invalid();
            String completed=text(row,"completed_at");
            if(!completed.isEmpty()){
                completed=timestamp(row,"completed_at");
                if(VaultTimestamps.compareInstants(completed,start,FAILURE)<0
                    ||VaultTimestamps.exceedsDuration(start,completed,86400000L,FAILURE))throw invalid();
            }
            return session;
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    private static void validateFinish(JSONObject finish,JSONObject occurrence)throws VaultFailure{
        try{
            if(!keys(finish).equals(FINISH_FIELDS)||text(occurrence,"completed_at").isEmpty())throw invalid();
            for(String field:new String[]{"client_session_id","device_id","location_code","started_at","completed_at"})
                if(!text(finish,field).equals(text(occurrence,field)))throw invalid();
            String entry=uuid(finish,"entry_id");
            if(entry.equals(text(occurrence,"native_scan_entry_id")))throw invalid();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    private static Set<String> keys(JSONObject row){Set<String> keys=new TreeSet<>();row.keys().forEachRemaining(keys::add);return keys;}
    private static String text(JSONObject row,String name)throws VaultFailure{
        try{Object value=row.get(name);if(!(value instanceof String))throw invalid();return(String)value;}
        catch(VaultFailure error){throw error;}catch(Exception error){throw new VaultFailure(FAILURE,error);}
    }
    private static String uuid(JSONObject row,String name)throws VaultFailure{
        String value=text(row,name);if(!value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"))throw invalid();return value;
    }
    private static void integer(JSONObject row,String name,long max)throws Exception{
        Object value=row.get(name);if(!(value instanceof Integer)&&!(value instanceof Long))throw invalid();
        long number=((Number)value).longValue();if(number<0||number>max)throw invalid();
    }
    private static String timestamp(JSONObject row,String name)throws VaultFailure{
        String value=text(row,name);if(!value.equals(value.trim()))throw invalid();return VaultTimestamps.normalize(value,FAILURE);
    }
    private static VaultFailure invalid(){return new VaultFailure(FAILURE);}
    private NativeProtectedSessionInventory(){}
}
