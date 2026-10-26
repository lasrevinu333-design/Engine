package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONArray;
import org.json.JSONObject;

/** UNMOUNTED source facts for exact captured provider metadata rows. Clock
 * transport samples remain UNQUALIFIED; saved pagination/completed markers are
 * not authenticated current server inventory or ACK. Digest-only diagnostics
 * do not acquire a full principal witness. No profile/effect/request/writer,
 * observation, scan restart, deletion, key or admission capability is returned.
 * Unknown, stale, future-schema and malformed rows stay retained/unresolved.
 */
final class NativeProviderMetadataCensus {
    private static final String SCHEMA="custodial.native-provider-journal.v1";
    private static final String GENERATION="ORIGINAL_GENERATION_ADMISSION_AND_EXACT_TOKEN_CAPTURE_REFERENCE_LOCAL_ONLY";
    private static final String[] CLOCK={"schema","clock_version","state","authority_state","principal","principal_digest","engine_revision",
        "provider_epoch","binding_id","generation_id","profile_id","profile_fingerprint","sample","last_observed_elapsed_ms","last_observed_boot_count","conflicting_sample"};
    private static final String[] RECOVERY={"schema","authority_state","principal","completed_epoch","scan","completed_scan","last_restarted_scan"};
    private static final String[] SCAN={"scan_id","captured_epoch","generation_ids","cursor","ceiling","server_now","pages"};
    private static final String[] MAINTENANCE={"schema","maintenance_version","scope_kind","principal_digest","binding_id","engine_revision",
        "invalidation_epoch","observed_journal_revision","reason","handling"};
    static Map<String,String> inspect(ProviderRecordStore.Snapshot snapshot,NativeProviderPrincipal original,JSONObject metadata,
        long originalEngineRevision,Map<String,String> originalReferences)throws VaultFailure {
        if(snapshot==null||original==null||metadata==null||originalEngineRevision<0||originalReferences==null)throw invalid();
        long started=System.nanoTime();Map<String,String> states=new TreeMap<>();
        for(ProviderRecordStore.Key key:snapshot.keys()){
            if(System.nanoTime()-started>30_000_000_000L)throw invalid();
            if(key.domain!=ProviderEnvelopeCrypto.Domain.METADATA||"journal".equals(key.id))continue;
            states.put(key.storageName(),"PROVIDER_METADATA_SEMANTICS_UNRESOLVED_RETAINED");
            try{
                JSONObject row=NativeProviderJournal.capturedDeliveryRecord(snapshot,key);
                if(key.equals(ProviderRecordStore.DIAGNOSTIC)){
                    exact(row,"schema","recovery_needed","reason");
                    if(!Boolean.TRUE.equals(row.get("recovery_needed"))||!"CAPACITY_PRESERVED".equals(row.get("reason")))throw invalid();
                    states.put(key.storageName(),"LOCAL_CAPACITY_DIAGNOSTIC_NOT_RECOVERY_SETTLEMENT");
                }else if("last-local-failure".equals(key.id)){
                    exact(row,MAINTENANCE);NativeProviderJournal.requireCapturedMetadataGrammar(snapshot,key,original,row);
                    if(!original.digest.equals(text(row,"principal_digest")))throw invalid();
                    boolean bound=metadata.get("binding_id").equals(text(row,"binding_id"))
                        &&integer(row,"engine_revision")==originalEngineRevision
                        &&integer(row,"invalidation_epoch")==integer(metadata,"invalidation_epoch");
                    states.put(key.storageName(),bound?"LOCAL_INVOCATION_DIAGNOSTIC_DIGEST_REFERENCE_NOT_FULL_PRINCIPAL_WITNESS":
                        "HISTORICAL_LOCAL_INVOCATION_DIAGNOSTIC_NOT_AUTHORITY");
                }else if(key.id.startsWith("clock-")){
                    clock(snapshot,key,row,original,metadata,originalEngineRevision,originalReferences);
                    states.put(key.storageName(),"ORIGINAL_CLOCK_"+text(row,"state")+"_TRANSPORT_FIELDS_UNQUALIFIED_LOCAL_ONLY");
                }else if(key.id.startsWith("recovery-")){
                    recovery(snapshot,key,row,original,metadata,originalReferences);
                    states.put(key.storageName(),"ORIGINAL_RECOVERY_CURSOR_AND_NEED_FIELDS_LOCAL_NOT_SERVER_RECONCILIATION");
                }
            }catch(Exception unresolved){/* No mutation, normalization, choosing a latest row or dropping original values. */}
        }
        if(System.nanoTime()-started>30_000_000_000L)throw invalid();return states;
    }
    private static void clock(ProviderRecordStore.Snapshot snapshot,ProviderRecordStore.Key key,JSONObject row,
        NativeProviderPrincipal original,JSONObject metadata,long revision,Map<String,String> refs)throws Exception {
        exact(row,CLOCK);owner(row,original);if(integer(row,"clock_version")!=1)throw invalid();
        text(row,"profile_id");text(row,"profile_fingerprint");
        NativeProviderJournal.requireCapturedMetadataGrammar(snapshot,key,original,row);
        String generation=NativeLegacyLineageJournal.uuid(text(row,"generation_id"));
        if(!key.id.equals("clock-"+generation)||!GENERATION.equals(refs.get("GENERATION:"+generation))
            ||!metadata.get("binding_id").equals(text(row,"binding_id"))||integer(row,"engine_revision")!=revision
            ||integer(row,"provider_epoch")!=integer(metadata,"invalidation_epoch"))throw invalid();
        // Restore only the owning UNQUALIFIED transport grammar, never Bounds.
        var sample=NativeProviderClockExchange.Unqualified.restore(row.getJSONObject("sample"));
        long boot=integer(row,"last_observed_boot_count"),elapsed=integer(row,"last_observed_elapsed_ms");
        if(boot<sample.after.bootCount||(boot==sample.after.bootCount&&elapsed<sample.after.elapsedMillis))throw invalid();
        if(!row.isNull("conflicting_sample")){
            if(!"FENCED".equals(text(row,"state")))throw invalid();
            NativeProviderClockExchange.Unqualified.restore(row.getJSONObject("conflicting_sample"));
        }
        // A well-shaped stored request hash/profile fingerprint is not a join to
        // its missing original HTTP response or an actual platform qualification.
    }
    private static void recovery(ProviderRecordStore.Snapshot snapshot,ProviderRecordStore.Key key,JSONObject row,
        NativeProviderPrincipal original,JSONObject metadata,Map<String,String> refs)throws Exception {
        exact(row,RECOVERY);owner(row,original);NativeProviderJournal.requireCapturedMetadataGrammar(snapshot,key,original,row);
        String binding=NativeLegacyLineageJournal.uuid(key.id.substring("recovery-".length()));
        if(!binding.equals(metadata.get("binding_id")))throw invalid();
        long completed=integer(row,"completed_epoch"),need=integer(metadata,"recovery_epoch");
        if(completed>need||((completed==0)!=row.isNull("completed_scan")))throw invalid();
        Set<String> identities=new HashSet<>();
        for(String role:new String[]{"scan","completed_scan","last_restarted_scan"}){
            if(row.isNull(role))continue;JSONObject scan=row.getJSONObject(role);exact(scan,SCAN);
            String id=NativeLegacyLineageJournal.uuid(text(scan,"scan_id"));if(!identities.add(id))throw invalid();
            long captured=integer(scan,"captured_epoch");integer(scan,"pages");
            if(captured==0||captured>need||("completed_scan".equals(role)&&captured!=completed)
                ||("scan".equals(role)&&captured<=completed))throw invalid();
            JSONArray generations=scan.getJSONArray("generation_ids");Set<String> unique=new HashSet<>();
            for(int i=0;i<generations.length();i++){
                if(!(generations.get(i) instanceof String))throw invalid();String generation=NativeLegacyLineageJournal.uuid(generations.getString(i));
                if(!unique.add(generation)||!GENERATION.equals(refs.get("GENERATION:"+generation)))throw invalid();
            }
            NativeProviderInventory.validateScanBounds(scan);
            if("completed_scan".equals(role)&&scan.isNull("server_now"))throw invalid();
        }
    }
    private static void owner(JSONObject row,NativeProviderPrincipal original)throws Exception {
        if(!SCHEMA.equals(text(row,"schema"))||!"CURRENT".equals(text(row,"authority_state"))
            ||!original.same(NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"))))throw invalid();
        if(row.has("principal_digest")&&!original.digest.equals(text(row,"principal_digest")))throw invalid();
    }
    private static String text(JSONObject row,String field)throws Exception{Object value=row.get(field);if(!(value instanceof String))throw invalid();return (String)value;}
    private static long integer(JSONObject row,String field)throws Exception{
        Object value=row.get(field);if(!(value instanceof Integer||value instanceof Long))throw invalid();
        long number=((Number)value).longValue();if(number<0||number>9007199254740991L)throw invalid();return number;
    }
    private static void exact(JSONObject row,String... fields)throws Exception{
        Set<String> actual=new HashSet<>();row.keys().forEachRemaining(actual::add);
        if(!actual.equals(new HashSet<>(Arrays.asList(fields))))throw invalid();
    }
    private static VaultFailure invalid(){return new VaultFailure("custodial_provider_metadata_semantics_unresolved");}
}
