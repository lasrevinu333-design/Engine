package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Actual ordinary encrypted WORK/journal readback with explicit synthetic
 * normal enrollment/HTTPS owner DATA. No Runtime/Source/native Current/OS or
 * receipt authority is constructed. Callback mutations are deliberate faults. */
public final class NativeRecurringOrdinaryStoreDataTest {
    private static final class Fixture {
        final NativeRetainedOwnerTest.Fixture normal;
        final NativeRecurringTargetJournal.RetainedTargetData target;
        final NativeRecurringOrdinaryPurposeJournal.PreparedData prepared;
        final AuthorizedResponse actual;
        Fixture(boolean blocked)throws Exception {
            normal=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
            NativeProviderPrincipal principal=NativeProviderPrincipal.fromNativeJournal(normal.principal.readFor(normal.engine.getState()));
            actual=response(principal,blocked,false);
            var request=new AuthorizedRequest("/schedule-api/my-day-summary?device_id=KIOSK_08&service_date=2026-10-21","GET",Map.of(),new byte[0]);
            target=new NativeRecurringTargetJournal(normal.work).captureActualTarget(request,actual,new NativeRecurringTargetJournal.ResponseOwner(){
                public NativeProviderPrincipal requireCurrent(){return principal;}
                public void requireActual(AuthorizedRequest r,AuthorizedResponse s)throws VaultFailure{if(r!=request||s!=actual)throw new VaultFailure("synthetic_original_mismatch");}
            });assertNotNull(target);
            prepared=new NativeRecurringOrdinaryPurposeJournal(normal.work).prepare(target,actual,NativeRetainedAttempt.hash(actual.body),()->{});assertNotNull(prepared);
        }
        void observe(NativeRecurringOrdinaryPurposeJournal.LatestOwner owner)throws Exception {normal.work.requireOrdinaryRecurringDeliveryCurrent(target,prepared,actual.body,owner);}
        String viewKey()throws Exception {return normal.workDisk.memory.keySet().stream().filter(k->k.startsWith(NativeRecurringTargetJournal.VIEW_PREFIX)).findFirst().orElseThrow();}
        void mutate(String key){normal.workDisk.memory.put(key,"preserved changed original");normal.workDisk.durable.put(key,"preserved changed original");}
        void lastCallbackFault(String key)throws Exception {int[] calls={0};assertThrows(VaultFailure.class,()->observe(()->{if(++calls[0]==2)mutate(key);}));
            assertEquals(2,calls[0]);assertEquals("preserved changed original",normal.workDisk.memory.get(key));assertEquals("preserved changed original",normal.workDisk.durable.get(key));}
    }
    private static AuthorizedResponse response(NativeProviderPrincipal principal,boolean blocked,boolean later)throws Exception {
        JSONObject envelope=new JSONObject(NativeRecurringTargetJournalTest.SYNTHETIC_TARGET_RESPONSE),p=principal.json();
        JSONObject data=envelope.getJSONObject("data"),meta=envelope.getJSONObject("meta"),delivery=data.getJSONObject("recurring_delivery"),target=delivery.getJSONObject("target");
        for(String name:new String[]{"employee_id","credential_id","assignment_epoch"}){data.put(name,p.get(name));meta.put(name,p.get(name));}
        data.put("canonical_device_id",p.get("device_id"));meta.put("canonical_device_id",p.get("device_id"));
        target.put("employeeId",p.get("employee_id")).put("credentialId",p.get("credential_id")).put("assignmentEpoch",p.get("assignment_epoch"));
        JSONObject view=new JSONObject().put("schema","static-weekly.recurring-render-view.v1")
            .put("service_date",target.get("serviceDate")).put("employee_id",target.get("employeeId"))
            .put("employee_name","Synthetic ordinary employee").put("publication_id",target.get("publicationId"))
            .put("projection_id",target.get("projectionId")).put("projection_status","current")
            .put("full_day",true).put("shift",JSONObject.NULL).put("raw_items",new JSONArray().put(new JSONObject()
                .put("id","synthetic-original-task").put("title","Synthetic nonempty source task").put("location","Synthetic location")));
        if(blocked){
            data.put("schedule_delivery_mode","RECURRING_TERMINAL");
            target.put("schema","static-weekly.recurring-terminal-target.v1").put("targetType","BLOCKED_RECURRING_AUTHORITY")
                .put("invalidationId","cccccccc-cccc-4ccc-8ccc-cccccccccccc").put("reasonCode","SOURCE_RETIRED");
            for(String key:new String[]{"projectionId","lunchDocumentIdentity","viewDigest"})target.remove(key);
            delivery.put("replacementCoverageReady",false).put("viewJsonText",JSONObject.NULL).put("view",JSONObject.NULL).put("viewDigest",JSONObject.NULL);
        }else{
            String text=view.toString(),digest=NativeProviderPrincipal.hash(text);
            target.put("viewDigest",digest);delivery.put("view",view).put("viewJsonText",text).put("viewDigest",digest);
        }
        var names=new java.util.ArrayList<String>();target.keys().forEachRemaining(names::add);
        names.sort(java.util.Comparator.comparingInt(String::length).thenComparing(java.util.Comparator.naturalOrder()));
        StringBuilder text=new StringBuilder("{");for(String key:names){if(text.length()>1)text.append(", ");Object value=target.get(key);
            text.append(JSONObject.quote(key)).append(": ").append(value instanceof String?JSONObject.quote((String)value):value.toString());}
        delivery.put("targetDigest",NativeProviderPrincipal.hash(text.append('}').toString()));
        return new AuthorizedResponse(200,Map.of("content-type","application/json"),((later?" ":"")+envelope).getBytes(StandardCharsets.UTF_8));
    }

    @Test public void normalProcessOnlyScheduleAndBlockedNarrowObservationsDoNotNeedRestoreCurrent()throws Exception {new Fixture(false).observe(()->{});new Fixture(true).observe(()->{});}
    @Test public void exactCurrentTargetAndPurposeRowsAreBothRequired()throws Exception {
        Fixture target=new Fixture(false);target.mutate(target.target.key);assertThrows(VaultFailure.class,()->target.observe(()->{}));
        Fixture purpose=new Fixture(false);purpose.mutate(purpose.prepared.key);assertThrows(VaultFailure.class,()->purpose.observe(()->{}));
    }
    @Test public void missingOriginalViewChunkCannotBorrowAuthenticTargetDescriptor()throws Exception {Fixture f=new Fixture(false);String key=f.viewKey();f.normal.workDisk.memory.remove(key);f.normal.workDisk.durable.remove(key);assertThrows(VaultFailure.class,()->f.observe(()->{}));}
    @Test public void changedOriginalViewChunkRefusesWithoutRepairOrOverwrite()throws Exception {Fixture f=new Fixture(false);String key=f.viewKey();f.mutate(key);assertThrows(VaultFailure.class,()->f.observe(()->{}));assertEquals("preserved changed original",f.normal.workDisk.memory.get(key));}
    @Test public void lastOwnerCallbackCannotReplaceTargetAfterItsDecode()throws Exception {Fixture f=new Fixture(false);f.lastCallbackFault(f.target.key);}
    @Test public void lastOwnerCallbackCannotReplacePurposeAfterItsDecode()throws Exception {Fixture f=new Fixture(false);f.lastCallbackFault(f.prepared.key);}
    @Test public void lastOwnerCallbackCannotReplaceViewAfterItsDecode()throws Exception {Fixture f=new Fixture(false);f.lastCallbackFault(f.viewKey());}
    @Test public void unrelatedUnreadableHistoricalNativeMutationIsNotDecodedOrFrozen()throws Exception {
        Fixture f=new Fixture(false);String key=NativeRecurringTargetJournal.MUTATION_PREFIX+"e".repeat(64);f.mutate(key);f.observe(()->{});
        assertEquals("preserved changed original",f.normal.workDisk.memory.get(key));
    }
    @Test public void lastOwnerUnrelatedMutationMayStaleRefuseButNoLeaseBlocksItsWrite()throws Exception {
        Fixture f=new Fixture(false);String key="independent-normal-work";f.lastCallbackFault(key);
        // Exact relevant rows remain valid; a new read, not an effect replay,
        // observes this independent original without imposing a global freeze.
        f.observe(()->{});assertEquals("preserved changed original",f.normal.workDisk.memory.get(key));
    }
}
