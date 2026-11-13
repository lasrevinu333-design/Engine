package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.json.JSONObject;

/** UNMOUNTED original provider delivery graph ONLY. Structural saved bounds
 * never create a qualified clock/effect capability. Original pending, uncertain,
 * dismissed, settled-local and reduced tombstone facts are kept distinct; no
 * notify, playback, navigation, ACK, resubmit, cleanup or normalization occurs.
 * Results contain fixed role/state codes only, never message/payload/receipt.
 */
final class NativeProviderDeliveryCensus {
    private static final String SCHEMA="custodial.native-provider-journal.v1";
    private static final String[] BASE={"schema","interval_version","record_id","principal","generation_id","content_sha256",
        "payload","authority_state","received_observation","state","quarantine_reason"};
    private static final String[] INBOX={"admission_bounds","admission_ordinal","received_event_id","display_state","os_tag",
        "os_cancel_pending","mirror_retire_pending","os_attempt_id","cancel_sequence","displayed_event_id","opened_event_id",
        "acknowledged_event_id","card_dismissed","mirror_rendered","audio_state","navigation_pending"};
    private static final String[] EVENT={"schema","interval_version","event_id","record_id","state","authority_state","action",
        "principal","generation_id","content_sha256","original_observation","admission_bounds","receipt_job_id","notification_key",
        "receipt_credential_id","receipt_employee_id","receipt_device_id","receipt_assignment_epoch","principal_digest","token_digest"};
    private static final String[] TOMBSTONE={"schema","interval_version","authority_state","state","record_id","generation_id","principal",
        "content_sha256","token_digest","receipt_job_id","notification_key","valid_until","dedupe_until","admissions"};
    private static final String[] ACTIONS={"received","displayed","opened","acknowledged"};
    private static final class Inbox {
        final ProviderRecordStore.Key key;final JSONObject row;final NativeProviderPayload payload;
        final Map<String,String> ids=new TreeMap<>();
        Inbox(ProviderRecordStore.Key key,JSONObject row,NativeProviderPayload payload){this.key=key;this.row=row;this.payload=payload;}
    }
    static Map<String,String> inspect(ProviderRecordStore.Snapshot snapshot,NativeProviderPrincipal original,Map<String,String> originalReferences)
        throws VaultFailure {
        Map<String,String> result=new TreeMap<>();Map<String,Inbox> inboxes=new TreeMap<>();
        Map<ProviderRecordStore.Key,JSONObject> events=new TreeMap<>();Set<String> ambiguous=new HashSet<>();
        Map<ProviderRecordStore.Key,Set<String>> tombstones=new TreeMap<>();
        Map<ProviderRecordStore.Key,String> observedIds=new TreeMap<>();
        long started=System.nanoTime();
        for(ProviderRecordStore.Key key:snapshot.keys()){
            requireTime(started);
            if(!Arrays.asList(ProviderEnvelopeCrypto.Domain.INBOX,ProviderEnvelopeCrypto.Domain.QUARANTINE,
                ProviderEnvelopeCrypto.Domain.EVENT,ProviderEnvelopeCrypto.Domain.TOMBSTONE).contains(key.domain))continue;
            result.put(key.storageName(),"DELIVERY_RECORD_SEMANTICS_UNRESOLVED_RETAINED");
            JSONObject row=null;
            try{
                row=NativeProviderJournal.capturedDeliveryRecord(snapshot,key);
                // Even a historical/malformed row may DENY a compacted graph
                // disposition; its untrusted identity can never grant one.
                if(row.opt("record_id") instanceof String)observedIds.put(key,(String)row.opt("record_id"));
                Object version=row.opt("interval_version");
                if(!(version instanceof Integer||version instanceof Long)||((Number)version).longValue()!=2){
                    result.put(key.storageName(),"HISTORICAL_POINT_DELIVERY_UNRESOLVED_NOT_UPGRADED");continue;
                }
                if(key.domain==ProviderEnvelopeCrypto.Domain.EVENT){eventShape(key,row,original,originalReferences);events.put(key,row);continue;}
                if(key.domain==ProviderEnvelopeCrypto.Domain.TOMBSTONE){
                    exact(row,TOMBSTONE);owner(row,original,originalReferences);NativeProviderJournal.requireCapturedDeliveryTombstone(snapshot,key);
                    JSONObject generation=NativeProviderJournal.capturedDeliveryRecord(snapshot,
                        ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.GENERATION,row.getString("generation_id")));
                    if(!generation.get("token_digest").equals(row.get("token_digest")))throw invalid();
                    NativeLegacyLineageJournal.hex(row.getString("notification_key"));
                    Set<String> compactedIds=new HashSet<>();var admissions=row.getJSONArray("admissions");
                    for(int i=0;i<admissions.length();i++)compactedIds.add(admissions.getJSONObject(i).getString("event_id"));
                    tombstones.put(key,Set.copyOf(compactedIds));continue;
                }
                Inbox inbox=inboxShape(key,row,original,originalReferences,snapshot.revision);
                if(key.domain==ProviderEnvelopeCrypto.Domain.QUARANTINE){
                    if(snapshot.keys().contains(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.INBOX,key.id)))ambiguous.add(key.id);
                    result.put(key.storageName(),"ORIGINAL_QUARANTINE_PAYLOAD_AND_OBSERVATION_LOCAL_ONLY");
                }else{
                    if(snapshot.keys().contains(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.QUARANTINE,key.id)))ambiguous.add(key.id);
                    inboxes.put(key.id,inbox);
                }
            }catch(Exception unresolved){
                // Untrusted row identity can deny a graph join, never grant one.
                if(row!=null&&row.opt("record_id") instanceof String)ambiguous.add((String)row.opt("record_id"));
            }
        }
        Map<String,Map<String,Integer>> actionCounts=new HashMap<>();
        for(var entry:events.entrySet()){
            requireTime(started);JSONObject event=entry.getValue();String id=event.optString("record_id");
            actionCounts.computeIfAbsent(id,unused->new HashMap<>()).merge(event.optString("action"),1,Integer::sum);
            Inbox inbox=inboxes.get(id);
            try{
                if(inbox==null)throw invalid();eventMatchesInbox(entry.getKey(),event,inbox);
                if("SETTLED".equals(event.get("state"))&&!NativeProviderJournal.capturedDeliveryAdmissionMatches(snapshot,entry.getKey(),event))throw invalid();
                result.put(entry.getKey().storageName(),"SETTLED".equals(event.get("state"))?
                    "ORIGINAL_EVENT_AND_STORED_LOCAL_RECEIPT_JOINED_NOT_CURRENT_SERVER":"ORIGINAL_PENDING_EVENT_GRAPH_LOCAL_ONLY");
            }catch(Exception unresolved){ambiguous.add(id);}
        }
        for(var count:actionCounts.entrySet())for(int n:count.getValue().values())if(n>1)ambiguous.add(count.getKey());
        for(var item:inboxes.entrySet()){
            requireTime(started);String recordId=item.getKey();Inbox inbox=item.getValue();
            for(var pointer:inbox.ids.entrySet()){
                ProviderRecordStore.Key eventKey=ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.EVENT,pointer.getValue());
                JSONObject event=events.get(eventKey);
                if(event==null||!recordId.equals(event.opt("record_id"))||!pointer.getKey().equals(event.opt("action"))
                    ||result.get(eventKey.storageName()).contains("UNRESOLVED"))ambiguous.add(recordId);
            }
            if(snapshot.keys().contains(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.TOMBSTONE,recordId)))ambiguous.add(recordId);
            result.put(inbox.key.storageName(),ambiguous.contains(recordId)?"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED":
                "ORIGINAL_INBOX_PAYLOAD_ACTION_AND_PENDING_EFFECT_FACTS_LOCAL_ONLY");
        }
        Map<String,Integer> compactedEventCounts=new HashMap<>();
        for(Set<String> eventIds:tombstones.values()){
            requireTime(started);
            for(String eventId:eventIds)compactedEventCounts.merge(eventId,1,Integer::sum);
        }
        for(var item:tombstones.entrySet()){
            requireTime(started);ProviderRecordStore.Key key=item.getKey();String id=key.id;
            if(snapshot.keys().contains(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.INBOX,id))
                ||snapshot.keys().contains(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.QUARANTINE,id)))ambiguous.add(id);
            for(var other:observedIds.entrySet()){
                requireTime(started);if(!key.equals(other.getKey())&&id.equals(other.getValue()))ambiguous.add(id);
            }
            for(String eventId:item.getValue()){
                if(compactedEventCounts.get(eventId)>1||snapshot.keys().contains(ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.EVENT,eventId)))ambiguous.add(id);
            }
            // This is the complete ORIGINAL STORED SUMMARY, not the deleted
            // pre-compaction payload/full receipts. It cannot authorize effects,
            // fresh server acceptance, inventory ACK, cleanup or key retirement.
            result.put(key.storageName(),ambiguous.contains(id)?"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED":
                "ORIGINAL_COMPACTED_DEDUPE_SUMMARY_LOCAL_ONLY_NO_RECEIPT_OR_EFFECT_AUTHORITY");
        }
        for(var event:events.entrySet())if(ambiguous.contains(event.getValue().optString("record_id")))
            result.put(event.getKey().storageName(),"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED");
        for(String id:ambiguous){
            if(!id.matches("[a-f0-9]{64}"))continue; // Unknown identity can never construct a native store key.
            ProviderRecordStore.Key quarantine=ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.QUARANTINE,id);
            if(result.containsKey(quarantine.storageName()))result.put(quarantine.storageName(),"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED");
            ProviderRecordStore.Key tombstone=ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.TOMBSTONE,id);
            if(result.containsKey(tombstone.storageName()))result.put(tombstone.storageName(),"DELIVERY_GRAPH_REFERENCE_UNRESOLVED_RETAINED");
        }
        requireTime(started);return result;
    }
    private static Inbox inboxShape(ProviderRecordStore.Key key,JSONObject row,NativeProviderPrincipal original,Map<String,String> refs,long revision)throws Exception{
        boolean admitted=key.domain==ProviderEnvelopeCrypto.Domain.INBOX;
        Set<String> fields=new HashSet<>(Arrays.asList(BASE));if(admitted)fields.addAll(Arrays.asList(INBOX));exact(row,fields.toArray(new String[0]));
        owner(row,original,refs);
        NativeProviderPayload payload=NativeProviderPayload.fromInventory(row.getJSONObject("payload"));payload.requirePrincipal(original);
        if(!key.id.equals(payload.recordId)||!payload.recordId.equals(row.get("record_id"))||!payload.generationId.equals(row.get("generation_id"))
            ||!payload.contentHash.equals(row.get("content_sha256"))||!ProviderWireJson.same(payload.json(),row.getJSONObject("payload")))throw invalid();
        NativeProviderObservationWire.validate(row.getJSONObject("received_observation"),false);
        Inbox result=new Inbox(key,row,payload);
        if(!admitted){
            if(!"QUARANTINED".equals(row.get("state"))||!Arrays.asList("GENERATION_UNCONFIRMED","RETIREMENT_UNCONFIRMED","AUTHENTICATED_TIME_UNCERTAIN")
                .contains(row.get("quarantine_reason")))throw invalid();return result;
        }
        if(!"ADMITTED".equals(row.get("state"))||row.get("quarantine_reason")!=JSONObject.NULL
            ||!"mz-provider:".concat(payload.recordId).equals(row.get("os_tag")))throw invalid();
        long ordinal=integer(row,"admission_ordinal",true);if(ordinal>revision)throw invalid();integer(row,"cancel_sequence",false);
        observationLiveShape(row.getJSONObject("admission_bounds"),payload);
        for(String flag:new String[]{"os_cancel_pending","mirror_retire_pending","card_dismissed","mirror_rendered","navigation_pending"})
            if(!(row.get(flag) instanceof Boolean))throw invalid();
        if(!Arrays.asList("PENDING_DISPLAY","DISPLAY_UNCERTAIN","DISPLAYED").contains(row.get("display_state"))
            ||!Arrays.asList("PENDING","IN_PROGRESS","COMPLETED").contains(row.get("audio_state")))throw invalid();
        if(!row.isNull("os_attempt_id"))NativeLegacyLineageJournal.uuid(row.getString("os_attempt_id"));
        for(String action:ACTIONS){
            String field=action+"_event_id";if(row.isNull(field)){if("received".equals(action))throw invalid();continue;}
            String event=NativeLegacyLineageJournal.uuid(row.getString(field));if(result.ids.containsValue(event))throw invalid();result.ids.put(action,event);
        }
        if(Boolean.TRUE.equals(row.get("navigation_pending"))&&!result.ids.containsKey("opened"))throw invalid();
        return result;
    }
    private static void eventShape(ProviderRecordStore.Key key,JSONObject row,NativeProviderPrincipal original,Map<String,String> refs)throws Exception{
        Set<String> fields=new HashSet<>(Arrays.asList(EVENT));if("SETTLED".equals(row.opt("state")))fields.add("admission");exact(row,fields.toArray(new String[0]));
        owner(row,original,refs);
        if(!Arrays.asList("PENDING","SETTLED").contains(row.get("state"))||!Arrays.asList(ACTIONS).contains(row.get("action"))
            ||!key.id.equals(NativeLegacyLineageJournal.uuid(row.getString("event_id"))))throw invalid();
        NativeLegacyLineageJournal.hex(row.getString("record_id"));NativeLegacyLineageJournal.hex(row.getString("content_sha256"));
        NativeProviderObservationWire.validate(row.getJSONObject("original_observation"),false);
        NativeProviderObservationWire.validate(row.getJSONObject("admission_bounds"),true);
    }
    private static void eventMatchesInbox(ProviderRecordStore.Key key,JSONObject event,Inbox inbox)throws Exception{
        NativeProviderPayload payload=inbox.payload;
        if(!key.id.equals(inbox.ids.get(event.getString("action")))||!payload.recordId.equals(event.get("record_id"))
            ||!payload.generationId.equals(event.get("generation_id"))||!payload.contentHash.equals(event.get("content_sha256"))
            ||!ProviderWireJson.same(inbox.row.getJSONObject("admission_bounds"),event.getJSONObject("admission_bounds")))throw invalid();
        for(String field:new String[]{"receipt_job_id","notification_key","receipt_credential_id","receipt_employee_id","receipt_device_id",
            "receipt_assignment_epoch","principal_digest","token_digest"})if(!payload.get(field).equals(event.get(field)))throw invalid();
        if("received".equals(event.get("action"))){
            if(!ProviderWireJson.same(inbox.row.getJSONObject("received_observation"),event.getJSONObject("original_observation")))throw invalid();
        }else observationLiveShape(event.getJSONObject("original_observation"),payload);
    }
    private static void observationLiveShape(JSONObject observation,NativeProviderPayload payload)throws Exception{
        NativeProviderObservationWire.validate(observation,true);
        long start=NativeProviderTime.micros(payload.reservedAt),end=NativeProviderTime.micros(payload.validUntil);
        if(NativeProviderClockExchange.micros(observation.get("earliest_at"))<start
            ||NativeProviderClockExchange.micros(observation.get("latest_at"))>=end)throw invalid();
    }
    private static void owner(JSONObject row,NativeProviderPrincipal original,Map<String,String> refs)throws Exception{
        if(!SCHEMA.equals(row.get("schema"))||!"CURRENT".equals(row.get("authority_state"))
            ||!original.same(NativeProviderPrincipal.fromNativeJournal(row.getJSONObject("principal"))))throw invalid();
        String id=NativeLegacyLineageJournal.uuid(row.getString("generation_id"));
        if(!"ORIGINAL_GENERATION_ADMISSION_AND_EXACT_TOKEN_CAPTURE_REFERENCE_LOCAL_ONLY".equals(refs.get("GENERATION:"+id)))throw invalid();
    }
    private static long integer(JSONObject row,String name,boolean positive)throws Exception{
        Object value=row.get(name);if(!(value instanceof Integer||value instanceof Long))throw invalid();
        long number=((Number)value).longValue();if(number<(positive?1:0)||number>9007199254740991L)throw invalid();return number;
    }
    private static void exact(JSONObject value,String... fields)throws Exception{
        Set<String> actual=new HashSet<>();value.keys().forEachRemaining(actual::add);
        if(!actual.equals(new HashSet<>(Arrays.asList(fields))))throw invalid();
    }
    private static void requireTime(long started)throws VaultFailure{if(System.nanoTime()-started>30_000_000_000L)throw invalid();}
    private static VaultFailure invalid(){return new VaultFailure("custodial_provider_delivery_semantics_unresolved");}
}
