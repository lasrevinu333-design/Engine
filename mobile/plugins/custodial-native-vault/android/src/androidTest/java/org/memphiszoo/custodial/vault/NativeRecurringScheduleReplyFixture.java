package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Fixed synthetic server DATA for the real enrolled/default native transport.
 * Not SQL/TLS, an application owner, native frame, OS result or receipt factory.
 * The device label and database UUID intentionally remain different identities. */
final class NativeRecurringScheduleReplyFixture {
    static final String AREA="Synthetic owned North Loop";
    final String date=LocalDate.now(ZoneId.of("America/Chicago")).toString();
    final String databaseDevice=UUID.randomUUID().toString();
    final String operation=UUID.randomUUID().toString(),publication=UUID.randomUUID().toString();
    final String projection=UUID.randomUUID().toString(),invalidation=UUID.randomUUID().toString();
    final String scheduleIntent=UUID.randomUUID().toString(),blockedIntent=UUID.randomUUID().toString();
    final String location=UUID.randomUUID().toString(),group=UUID.randomUUID().toString(),version=UUID.randomUUID().toString();
    private boolean blocked;
    private byte[] scheduleBody,blockedBody;
    private String label,employee,credential;
    volatile int scheduleReads,blockedReads;
    String scheduleTargetDigest,blockedTargetDigest,viewDigest;

    synchronized void changeToBlocked(){
        if(blocked||scheduleReads<1)throw new AssertionError("One observed original schedule must precede blocked transition");
        blocked=true;
    }
    synchronized byte[] response(String actualLabel,String actualEmployee,String actualCredential)throws Exception {
        if(label==null){label=actualLabel;employee=actualEmployee;credential=actualCredential;}
        if(!label.equals(actualLabel)||!employee.equals(actualEmployee)||!credential.equals(actualCredential)
            ||databaseDevice.equals(label))throw new AssertionError("Synthetic original native identity changed");
        if(blocked){blockedReads++;if(blockedBody==null)blockedBody=build(true);return blockedBody.clone();}
        scheduleReads++;if(scheduleBody==null)scheduleBody=build(false);return scheduleBody.clone();
    }
    private byte[] build(boolean terminal)throws Exception {
        // Current dated consumer's segment + employee-reader overlay, rather
        // than an invented title-only row. Its accepted service minutes are
        // integral; owner-config half-unit package weights are not this field.
        JSONObject item=new JSONObject().put("id",location).put("occurrence_id",location).put("segment_id",location)
            .put("projection_id",projection).put("publication_id",publication).put("version_id",version)
            .put("service_date",date).put("segment_number",1).put("location_group_id",group)
            .put("assigned_employee_id",employee).put("assigned_employee_name","Synthetic owned employee")
            .put("name",AREA).put("group_code","SYNTHETIC_NORTH_LOOP")
            .put("group_name",AREA).put("location_group_code","SYNTHETIC_NORTH_LOOP").put("location_group_name",AREA)
            .put("coverage_start","00:00").put("coverage_end","23:59")
            .put("start_time","00:00").put("end_time","23:59").put("coverage_purpose","area_owner")
            .put("source_type","static_weekly_projection").put("owner_type","EMPLOYEE").put("status","ASSIGNED")
            .put("service_mode","scan_tracked").put("governed",true).put("projection_status","current")
            .put("load_points",30).put("notes",JSONObject.NULL)
            .put("included_locations",new JSONArray().put(AREA)).put("included_location_ids",new JSONArray().put(location))
            .put("included_location_snapshots",new JSONArray().put(new JSONObject().put("locationId",location).put("locationNameSnapshot",AREA)));
        JSONObject view=new JSONObject().put("schema","static-weekly.recurring-render-view.v1")
            .put("service_date",date).put("employee_id",employee).put("employee_name","Synthetic owned employee")
            .put("publication_id",publication).put("projection_id",projection).put("projection_status","current")
            .put("full_day",true).put("shift",new JSONObject().put("active",true).put("start","00:00").put("end","23:59"))
            .put("raw_items",new JSONArray().put(item));
        String originalView=jsonb(view);viewDigest=NativeProviderPrincipal.hash(originalView);
        JSONObject target=new JSONObject().put("schema",terminal?"static-weekly.recurring-terminal-target.v1":"static-weekly.recurring-application-target.v1")
            .put("targetType",terminal?"BLOCKED_RECURRING_AUTHORITY":"SCHEDULE").put("operationId",operation)
            .put("publicationId",publication).put("serviceDate",date).put("authorityRevision",terminal?2:1)
            .put("employeeId",employee).put("deviceId",databaseDevice).put("credentialId",credential).put("assignmentEpoch",7);
        if(terminal)target.put("invalidationId",invalidation).put("reasonCode","SOURCE_RETIRED");
        else target.put("projectionId",projection).put("lunchDocumentIdentity","a".repeat(64)).put("viewDigest",viewDigest);
        String targetDigest=NativeProviderPrincipal.hash(jsonb(target));
        if(terminal)blockedTargetDigest=targetDigest;else scheduleTargetDigest=targetDigest;
        JSONObject delivery=new JSONObject().put("intentId",terminal?blockedIntent:scheduleIntent).put("target",target)
            .put("targetDigest",targetDigest).put("applicationStatus","PENDING")
            .put("appliedAt",JSONObject.NULL).put("receivedAt",JSONObject.NULL);
        if(terminal)delivery.put("replacementCoverageReady",false);
        else delivery.put("view",view).put("viewJsonText",originalView).put("viewDigest",viewDigest).put("receiptId",JSONObject.NULL);
        JSONObject data=terminal?new JSONObject().put("service_date",date).put("employee_id",employee)
            .put("employee_name","Synthetic owned employee").put("projection_status","blocked_recurring_authority")
            .put("full_day",true).put("raw_items",new JSONArray()).put("shift",JSONObject.NULL)
            .put("notice","Your schedule needs a manager's updated plan. Your saved cleaning work is preserved.")
            :new JSONObject(view.toString()).put("projection_authority_revision",1);
        data.put("governed",true).put("source","static_weekly_projection").put("requested_device_id",label)
            .put("device_id",label).put("canonical_device_id",label).put("canonical_device_pk",databaseDevice)
            .put("credential_id",credential).put("assignment_epoch",7).put("schedule_application",JSONObject.NULL)
            .put("schedule_delivery_mode",terminal?"RECURRING_TERMINAL":"RECURRING_SCHEDULE").put("recurring_delivery",delivery);
        JSONObject meta=new JSONObject().put("canonical_device_id",label).put("employee_id",employee)
            .put("credential_id",credential).put("assignment_epoch",7);
        return new JSONObject().put("ok",true).put("data",data).put("meta",meta).toString().getBytes(StandardCharsets.UTF_8);
    }
    /** Exact bounded fixture JSONB text spelling: fixed ASCII object keys,
     * strings, safe integers, arrays and null. No advertised general encoder. */
    private static String jsonb(Object value)throws Exception {
        if(value==JSONObject.NULL)return "null";
        if(value instanceof String)return JSONObject.quote((String)value);
        if(value instanceof Boolean||value instanceof Integer||value instanceof Long)return value.toString();
        if(value instanceof JSONArray array){var out=new ArrayList<String>();for(int i=0;i<array.length();i++)out.add(jsonb(array.get(i)));return "["+String.join(", ",out)+"]";}
        if(value instanceof JSONObject object){var keys=new ArrayList<String>();object.keys().forEachRemaining(keys::add);
            for(String key:keys)if(!key.matches("[A-Za-z_]+"))throw new AssertionError("Fixed ASCII key family only");
            keys.sort(Comparator.comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
            var out=new ArrayList<String>();for(String key:keys)out.add(JSONObject.quote(key)+": "+jsonb(object.get(key)));
            return "{"+String.join(", ",out)+"}";
        }
        throw new AssertionError("Unsupported synthetic wire value");
    }
}
