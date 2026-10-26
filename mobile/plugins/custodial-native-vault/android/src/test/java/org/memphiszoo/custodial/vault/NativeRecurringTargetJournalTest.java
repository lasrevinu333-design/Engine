package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;

/** Actual journal state machine, explicit synthetic native principal/Store.
 * These fixtures do NOT authenticate TLS, native OS effects or a receipt. */
public final class NativeRecurringTargetJournalTest {
    static final class Store implements NativeRecurringTargetJournal.Store {
        final Map<String,String> rows=new LinkedHashMap<>();boolean throwAfterCommit;
        public String loadRecurringRecord(String key){return rows.get(key);}
        public Map<String,String> recurringRecords(){return Map.copyOf(rows);}
        public void compareAndRetainRecurringRecord(String key,String previous,String next)throws VaultFailure {
            if(!Objects.equals(rows.get(key),previous))throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            rows.put(key,next);if(throwAfterCommit)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
        }
    }
    static NativeProviderPrincipal principal()throws Exception {
        return NativeProviderPrincipal.fromNativeJournal(new JSONObject()
            .put("schema_version","custodial-protected-principal.v1").put("device_id","KIOSK_08")
            .put("employee_id","11111111-1111-4111-8111-111111111111").put("credential_id","22222222-2222-4222-8222-222222222222")
            .put("credential_operation_id","33333333-3333-4333-8333-333333333333").put("assignment_epoch",7)
            .put("installation_seal","synthetic-installation-seal-01").put("enrolled_at","2026-10-21T00:00:00Z"));
    }
    private static String notification(NativeProviderPrincipal principal,boolean scheduled)throws Exception {
        JSONObject row=new JSONObject().put("id",41).put("title","Synthetic fixture").put("body","No real notification")
            .put("group","mz-custodial-owned:44444444-4444-4444-8444-444444444444")
            .put("extra",new JSONObject().put("native_presentation_id","41").put("native_presentation_principal",principal.json().toString()));
        if(scheduled)row.put("schedule",new JSONObject().put("at","2026-10-22T00:00:00Z"));return row.toString();
    }
    @Test public void immediateActualProducerTraceCannotBecomeReceiptAndNeverReplaysGeneration()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();
        String generation=journal.beforeSchedule(p,41,notification(p,false));assertNotNull(generation);
        assertTrue(journal.beforeDispatch(p,generation,41,"mz-custodial-owned:44444444-4444-4444-8444-444444444444"));
        journal.dispatchCalled(generation);journal.scheduleCalled(generation);
        JSONObject retained=new JSONObject(store.rows.values().iterator().next());
        assertEquals("DISPATCH_CALLED",retained.getString("state"));assertFalse(retained.getBoolean("receipt_eligible"));
        assertThrows(VaultFailure.class,()->journal.beforeDispatch(p,generation,41,retained.getString("group")));
        assertThrows(VaultFailure.class,()->journal.beforeSchedule(p,41,notification(p,false)));
    }
    @Test public void exactDurableCancellationDeniesQueuedOneShotReceiverWithoutReschedule()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();String raw=notification(p,true);
        String generation=journal.beforeSchedule(p,41,raw);journal.scheduleCalled(generation);
        assertEquals(generation,journal.beforeCancel(p,41,raw));journal.cancelCalled(generation);
        Map<String,String> terminal=Map.copyOf(store.rows);
        assertFalse(journal.beforeDispatch(p,generation,41,"mz-custodial-owned:44444444-4444-4444-8444-444444444444"));
        assertEquals(terminal,store.rows);assertThrows(VaultFailure.class,()->journal.beforeSchedule(p,41,raw));
    }
    @Test public void unknownCommitRetainsOriginalAttemptAndCannotMintNewGeneration()throws Exception {
        var store=new Store();store.throwAfterCommit=true;var journal=new NativeRecurringTargetJournal(store);var p=principal();String raw=notification(p,false);
        assertThrows(VaultFailure.class,()->journal.beforeSchedule(p,41,raw));assertEquals(1,store.rows.size());
        Map<String,String> retained=Map.copyOf(store.rows);store.throwAfterCommit=false;
        assertThrows(VaultFailure.class,()->journal.beforeSchedule(p,41,raw));assertEquals(retained,store.rows);
        assertEquals("SCHEDULE_ATTEMPTED",new JSONObject(store.rows.values().iterator().next()).getString("state"));
    }
    @Test public void unknownForeignMalformedAndRepeatingOriginalsAreNotAdoptedOrMutated()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();
        assertNull(journal.beforeSchedule(p,41,"{broken"));
        assertNull(journal.beforeSchedule(p,42,notification(p,false)));
        JSONObject repeating=new JSONObject(notification(p,true));repeating.getJSONObject("schedule").put("repeats",true);
        assertNull(journal.beforeSchedule(p,41,repeating.toString()));
        JSONObject foreign=new JSONObject(notification(p,false));foreign.getJSONObject("extra").put("native_presentation_principal","{}");
        assertNull(journal.beforeSchedule(p,41,foreign.toString()));assertTrue(store.rows.isEmpty());
        assertTrue(journal.beforeDispatch(p,null,41,null));assertTrue(store.rows.isEmpty());
    }
    @Test public void wrongGroupPrincipalOrCorruptRetainedRowRefusesBeforeDispatch()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();String generation=journal.beforeSchedule(p,41,notification(p,true));
        assertThrows(VaultFailure.class,()->journal.beforeDispatch(p,generation,41,"foreign"));
        JSONObject q=p.json();q.put("assignment_epoch",8);NativeProviderPrincipal foreign=NativeProviderPrincipal.fromNativeJournal(q);
        assertThrows(VaultFailure.class,()->journal.beforeDispatch(foreign,generation,41,"mz-custodial-owned:44444444-4444-4444-8444-444444444444"));
        String key=store.rows.keySet().iterator().next();String old=store.rows.get(key);store.rows.put(key,old.replace("custodial.native-notification-mutation-data.v2","unknown.future.schema"));
        assertThrows(VaultFailure.class,()->journal.beforeDispatch(p,generation,41,"mz-custodial-owned:44444444-4444-4444-8444-444444444444"));
        assertEquals(old.replace("custodial.native-notification-mutation-data.v2","unknown.future.schema"),store.rows.get(key));
    }
    static final String SYNTHETIC_TARGET_RESPONSE="{\"ok\":true,\"data\":{\"employee_id\":\"11111111-1111-4111-8111-111111111111\",\"credential_id\":\"22222222-2222-4222-8222-222222222222\",\"canonical_device_id\":\"KIOSK_08\",\"assignment_epoch\":7,\"canonical_device_pk\":\"99999999-9999-4999-8999-999999999999\",\"service_date\":\"2026-10-21\",\"schedule_delivery_mode\":\"RECURRING_SCHEDULE\",\"recurring_delivery\":{\"intentId\":\"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\",\"target\":{\"schema\":\"static-weekly.recurring-application-target.v1\",\"targetType\":\"SCHEDULE\",\"operationId\":\"77777777-7777-4777-8777-777777777777\",\"publicationId\":\"88888888-8888-4888-8888-888888888888\",\"serviceDate\":\"2026-10-21\",\"authorityRevision\":1,\"employeeId\":\"11111111-1111-4111-8111-111111111111\",\"deviceId\":\"99999999-9999-4999-8999-999999999999\",\"credentialId\":\"22222222-2222-4222-8222-222222222222\",\"assignmentEpoch\":7,\"projectionId\":\"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\",\"lunchDocumentIdentity\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"viewDigest\":\"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a\"},\"targetDigest\":\"0d86677fe7344a98788991d100cd62ce9f95ec1274442b302d1039294de1940e\",\"viewJsonText\":\"{}\",\"viewDigest\":\"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a\",\"applicationStatus\":\"PENDING\"}},\"meta\":{\"employee_id\":\"11111111-1111-4111-8111-111111111111\",\"credential_id\":\"22222222-2222-4222-8222-222222222222\",\"canonical_device_id\":\"KIOSK_08\",\"assignment_epoch\":7}}";
    @Test public void actualTargetFactoryChecksOwnedResponseAndRetainsFirstNativeDataOnly()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();
        var request=new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]);
        var response=new AuthorizedResponse(200,Map.of("content-type","application/json"),SYNTHETIC_TARGET_RESPONSE.getBytes(StandardCharsets.UTF_8));
        int[] checks={0};var owner=new NativeRecurringTargetJournal.ResponseOwner(){
            public NativeProviderPrincipal requireCurrent(){return p;}
            public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure {
                if(r!=request||s!=response)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);checks[0]++;
            }
        };
        journal.captureActualTarget(request,response,owner);assertEquals(3,checks[0]);assertEquals(2,store.rows.size());
        JSONObject retained=new JSONObject(store.rows.entrySet().stream().filter(e->e.getKey().startsWith(NativeRecurringTargetJournal.TARGET_PREFIX)).findFirst().get().getValue());
        assertEquals("0d86677fe7344a98788991d100cd62ce9f95ec1274442b302d1039294de1940e",retained.getString("target_digest"));
        assertFalse(retained.getBoolean("receipt_eligible"));assertTrue(retained.getBoolean("original_view_bytes_retained"));
        assertEquals("AUTHENTICATED_TARGET_DATA_NOT_APPLIED",retained.getString("state"));
        Map<String,String> first=Map.copyOf(store.rows);journal.captureActualTarget(request,response,owner);assertEquals(first,store.rows);
    }
    @Test public void wrongOriginalOrResponseOwnerCannotPrepareTargetData()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();
        var request=new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]);
        var response=new AuthorizedResponse(200,Map.of(),SYNTHETIC_TARGET_RESPONSE.replace("\"assignment_epoch\":7","\"assignment_epoch\":8").getBytes(StandardCharsets.UTF_8));
        var owner=new NativeRecurringTargetJournal.ResponseOwner(){
            public NativeProviderPrincipal requireCurrent(){return p;}
            public void requireActual(AuthorizedRequest r,AuthorizedResponse s){}
        };
        assertThrows(VaultFailure.class,()->journal.captureActualTarget(request,response,owner));assertTrue(store.rows.isEmpty());
        var original=new AuthorizedResponse(200,Map.of(),SYNTHETIC_TARGET_RESPONSE.getBytes(StandardCharsets.UTF_8));
        var denied=new NativeRecurringTargetJournal.ResponseOwner(){
            public NativeProviderPrincipal requireCurrent(){return p;}
            public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure{throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);}
        };
        assertThrows(VaultFailure.class,()->journal.captureActualTarget(request,original,denied));assertTrue(store.rows.isEmpty());
    }
    private static NativeRecurringTargetJournal.ResponseOwner actualFixtureOwner(
        NativeProviderPrincipal p,AuthorizedRequest request,AuthorizedResponse response){
        // Synthetic native response owner only; not production TLS authority.
        return new NativeRecurringTargetJournal.ResponseOwner(){
            public NativeProviderPrincipal requireCurrent(){return p;}
            public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure{
                if(r!=request||s!=response)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            }
        };
    }
    @Test public void retainedDataReturnKeepsExactFirstRecordAcrossLaterWireBody()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();
        var request=new AuthorizedRequest("/schedule-api/my-day-summary","GET",Map.of(),new byte[0]);
        var first=new AuthorizedResponse(200,Map.of(),SYNTHETIC_TARGET_RESPONSE.getBytes(StandardCharsets.UTF_8));
        var original=journal.captureActualTarget(request,first,actualFixtureOwner(p,request,first));assertNotNull(original);
        assertEquals(p.digest,original.principalSha256);assertTrue(original.record.equals(store.rows.get(original.key)));
        String firstRecord=original.record;var before=Map.copyOf(store.rows);
        var later=new AuthorizedResponse(200,Map.of(),(" "+SYNTHETIC_TARGET_RESPONSE).getBytes(StandardCharsets.UTF_8));
        var returned=journal.captureActualTarget(request,later,actualFixtureOwner(p,request,later));
        assertNotNull(returned);assertTrue(firstRecord.equals(returned.record));assertTrue(before.equals(store.rows));
        assertEquals(NativeRetainedAttempt.hash(first.body),new JSONObject(returned.record).getString("native_authorized_response_sha256"));
        assertFalse(new JSONObject(returned.record).getBoolean("receipt_eligible"));
    }
    @Test public void terminalOwnerFailureReturnsNoDataAndPreservesCommittedOriginal()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();
        var request=new AuthorizedRequest("/schedule-api/my-day-summary","GET",Map.of(),new byte[0]);
        var response=new AuthorizedResponse(200,Map.of(),SYNTHETIC_TARGET_RESPONSE.getBytes(StandardCharsets.UTF_8));int[] checks={0};
        var owner=new NativeRecurringTargetJournal.ResponseOwner(){
            public NativeProviderPrincipal requireCurrent(){return p;}
            public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure{
                if(r!=request||s!=response||++checks[0]==3)throw new VaultFailure(NativeRecurringTargetJournal.FAILURE);
            }
        };
        assertThrows(VaultFailure.class,()->journal.captureActualTarget(request,response,owner));
        assertEquals(2,store.rows.size());
        assertTrue(store.rows.values().stream().allMatch(row->{try{return !new JSONObject(row).getBoolean("receipt_eligible");}catch(Exception e){return false;}}));
    }
    @Test public void preservedLegacyTargetCannotReturnCompleteViewDataBirth()throws Exception {
        var store=new Store();var journal=new NativeRecurringTargetJournal(store);var p=principal();
        var request=new AuthorizedRequest("/schedule-api/my-day-summary","GET",Map.of(),new byte[0]);
        var response=new AuthorizedResponse(200,Map.of(),SYNTHETIC_TARGET_RESPONSE.getBytes(StandardCharsets.UTF_8));
        var actual=journal.captureActualTarget(request,response,actualFixtureOwner(p,request,response));
        JSONObject legacy=new JSONObject(actual.record);legacy.put("schema","custodial.native-recurring-authenticated-target-data.v1")
            .put("original_view_bytes_retained",false).remove("original_view");store.rows.put(actual.key,legacy.toString());
        var before=Map.copyOf(store.rows);
        assertNull(journal.captureActualTarget(request,response,actualFixtureOwner(p,request,response)));
        assertTrue(before.equals(store.rows));
    }

}
