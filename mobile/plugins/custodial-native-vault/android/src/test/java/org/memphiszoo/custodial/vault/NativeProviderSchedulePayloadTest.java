package org.memphiszoo.custodial.vault;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeMap;
import java.util.List;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Source/content-derived, explicitly modeled receipt; no device qualification. */
public final class NativeProviderSchedulePayloadTest {
    static JSONObject fixture() throws Exception {
        try(java.io.InputStream in=NativeProviderSchedulePayloadTest.class.getResourceAsStream("/native-schedule-wire.json")) {
            assertNotNull(in);JSONObject value=new JSONObject(new String(in.readAllBytes(),StandardCharsets.UTF_8));
            assertTrue(value.getBoolean("synthetic"));assertFalse(value.getBoolean("actual_SQL_receipt"));assertFalse(value.getBoolean("native_qualified"));return value;
        }
    }
    static Map<String,String> map(JSONObject value) throws Exception {Map<String,String> result=new TreeMap<>();for(java.util.Iterator<String> i=value.keys();i.hasNext();) {String k=i.next();result.put(k,value.getString(k));}return result;}
    static void rehash(Map<String,String> value) throws Exception {value.put("content_sha256",NativeProviderPrincipal.hash(NativeProviderPayload.canonical(value,true)));}
    static NativeProviderPayload parse(Map<String,?> value) throws Exception {return NativeProviderPayload.fromFcm("123456789012","123456789012",false,value);}
    static void rejected(Map<String,?> value) throws Exception {try{parse(value);fail("malformed SCHEDULE accepted");}catch(VaultFailure e){
        Object device=value.get("receipt_device_id");
        assertEquals(device instanceof String && !((String)device).matches("KIOSK_(?:0[2-9]|10)")
            ? "custodial_native_invalid_device" : "custodial_provider_payload_invalid",e.code);
    }}
    @Test public void closedSourceFieldsCanonicalHashAndInventoryFcmAgree() throws Exception {
        JSONObject f=fixture();Map<String,String> input=map(f.getJSONObject("payload"));NativeProviderPayload p=parse(input);
        assertEquals(32,p.data().size());assertEquals(f.getString("wire"),NativeProviderPayload.canonical(p.data(),false));
        assertEquals(f.getString("record_id"),p.recordId);assertEquals(p.data(),NativeProviderPayload.fromInventory(p.json()).data());
        input.put("body","late caller mutation");assertNotEquals(input.get("body"),p.get("body"));assertThrows(UnsupportedOperationException.class,()->p.data().put("body","changed"));
        assertEquals("dismissed",NativeProviderNotificationPolicy.action(p));assertEquals("Dismiss",NativeProviderNotificationPolicy.actionLabel(p));
        assertEquals("Assignment updates",NativeProviderNotificationPolicy.channelTitle(p.get("channel_id")));assertNull(p.get("thread_id"));
    }
    @Test public void everyMissingTypedOrUnhashedFieldIsRefused() throws Exception {
        Map<String,String> original=map(fixture().getJSONObject("payload"));
        for(String field:original.keySet()) {
            Map<String,String> missing=new TreeMap<>(original);missing.remove(field);if(!field.equals("content_sha256"))rehash(missing);rejected(missing);
            Map<String,Object> typed=new TreeMap<>(original);typed.put(field,true);rejected(typed);
            Map<String,String> changed=new TreeMap<>(original);changed.put(field,changed.get(field)+"x");rejected(changed);
        }
        Map<String,String> extra=new TreeMap<>(original);extra.put("test_delivery","true");rehash(extra);rejected(extra);
    }
    @Test public void semanticAliasesClockAndSourceBoundsRefusedEvenWithNewHash() throws Exception {
        Map<String,String> original=map(fixture().getJSONObject("payload"));
        for(String[] pair:new String[][]{{"kind","employee_message"},{"schema",NativeProviderPayload.MESSAGE_SCHEMA},{"channel_id","employee-messages"},
            {"notification_type","lunch_coverage"},{"route","https://external.invalid/"},{"boundary_local","09:46"},{"source_revision","0"},
            {"receipt_device_id","KIOSK_01"},{"source_reservation_id","not-a-stable-id"},{"reservation_at",original.get("source_valid_from").replace(":45:",":44:")},
            {"valid_until",original.get("source_valid_until").replace(":00:",":01:")},{"valid_until",original.get("reservation_at")},{"body","bad\ncontent"}}) {
            Map<String,String> changed=new TreeMap<>(original);changed.put(pair[0],pair[1]);rehash(changed);rejected(changed);
        }
    }
    @Test public void sameOriginalSourceCannotAcquireNewNativeRecordByChangingJob() throws Exception {
        Map<String,String> input=map(fixture().getJSONObject("payload"));NativeProviderPayload first=parse(input);
        input.put("receipt_job_id","44444444-4444-4444-8444-444444444444");rehash(input);NativeProviderPayload changed=parse(input);
        assertEquals(first.recordId,changed.recordId);assertNotEquals(first.contentHash,changed.contentHash);
    }
    @Test public void malformedAndUnqualifiedScheduleNeverUseLegacyForwarding() throws Exception {
        int[] legacy={0};Map<String,String> p=map(fixture().getJSONObject("payload"));
        assertTrue(NativeProviderPayload.protectedTraffic(Map.of("kind","employee_schedule_ownership")));
        assertTrue(NativeProviderPayload.protectedTraffic(Map.of("schema","custodial.native-schedule-payload.v2")));
        for(Map<String,?> input:List.of(p,Map.of("kind","employee_schedule_ownership","test_delivery",true))) {
            try{NativeProviderFirebaseDispatch.message(NativeProviderIngressRuntime.SUSPENDED,"123456789012","123456789012",false,input,()->legacy[0]++);fail();}
            catch(VaultFailure expected){assertTrue(List.of("custodial_provider_runtime_not_admitted","custodial_provider_payload_invalid").contains(expected.code));}
        }
        assertEquals(0,legacy[0]);assertNull(NativeProviderTime.Profiles.NONE.select(new NativeProviderTime.Platform("36","synthetic","synthetic")));
    }
}
