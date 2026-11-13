package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** NEW source-only metadata census. AES, actor/admission, disk, transport and
 * clock profile inputs are synthetic. Existing journal transitions build the
 * original fixture before inspection; no OS/network/database or real profile.
 * Inspection cannot write, restart/replay, ACK, create Bounds, or remove keys.
 */
public final class NativeProviderMetadataCensusTest {
    static final class Fixture {
        final NativeVaultProviderReferenceCensusTest.Fixture f=new NativeVaultProviderReferenceCensusTest.Fixture();
        final NativeProviderJournal journal=f.old.provider;
        final NativeProviderPrincipal principal=f.old.principal;
        final long revision=f.old.nativeOwner.persistence.current().revision;
        Fixture()throws Exception{}
        ProviderRecordStore.Key key(String name){return ProviderRecordStore.key(ProviderEnvelopeCrypto.Domain.METADATA,name);}
        JSONObject meta()throws Exception{return f.record(key("journal"));}
        ProviderRecordStore.Key clockKey(){return key("clock-"+f.old.generation.generationId);}
        JSONObject clock()throws Exception{return f.record(clockKey());}
        void put(ProviderRecordStore.Key key,JSONObject value)throws Exception{f.put(key,value);}
        void raw(ProviderRecordStore.Key key,String text)throws Exception{
            char[] clear=text.toCharArray();var store=f.old.providerStore.store();
            try{store.commit(store.loadRetained().revision,Map.of(key,clear),java.util.Set.of());}finally{Arrays.fill(clear,'\0');}
        }
        void savedClock()throws Exception{
            long server=NativeProviderClockExchange.micros("2026-09-24T17:00:00.123456Z");
            assertTrue(journal.acceptClock(principal,revision,f.old.generation,meta().getLong("invalidation_epoch"),
                NativeProviderTimeTest.sample(100,101,7,server,900_000_000L),NativeProviderTimeTest.profile(1_000_000,100,900_000_000_000L),
                NativeProviderTimeTest.platform(),new NativeProviderClockExchange.Point(101,7)));
        }
        NativeProviderInventory.Request scan()throws Exception{journal.requestRecovery();return journal.prepareInventory(principal);}
        JSONObject recovery(NativeProviderInventory.Request request)throws Exception{return f.record(key(request.recoveryId));}
        void completeEmpty(NativeProviderInventory.Request request)throws Exception{
            JSONObject p=principal.json(),scan=request.scan();JSONObject data=new JSONObject().put("schema","custodial.native-provider-inventory.v1")
                .put("scan_id",scan.get("scan_id")).put("principal_digest",principal.digest).put("generation_ids",scan.get("generation_ids"))
                .put("cursor",JSONObject.NULL).put("ceiling",JSONObject.NULL).put("server_now","2026-09-24T17:00:00.123456Z")
                .put("has_more",false).put("rows",new JSONArray());
            for(String field:new String[]{"device_id","employee_id","credential_id","assignment_epoch"})data.put(field,p.get(field));
            var response=new AuthorizedResponse(200,Map.of("Content-Type","application/json"),new JSONObject().put("ok",true)
                .put("data",data).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            journal.consumeInventory(principal,request,NativeProviderInventory.validateResponse(request,response),
                new NativeProviderJournal.Observation(null,-1,-1));
        }
        void diagnostic()throws Exception{
            assertTrue(journal.recordMaintenanceFailure(principal,revision,journal.maintenanceScope(principal,revision),
                NativeProviderFailureDisposition.RESPONSE_UNCONFIRMED));
        }
        NativeVaultProviderReferenceCensus.Observation inspect()throws Exception{
            var before=new NativeVaultProviderReferenceCensusTest.Stable(f);var value=f.inspect();before.check();
            NativeVaultProviderReferenceCensusTest.noAuthority(value);String json=value.json().toString();
            for(String forbidden:new String[]{"server_now","body_sha256","profile_fingerprint","sample\":","cursor\":","scan_id","binding_id",
                "RESPONSE_UNCONFIRMED","handling\":","CAPACITY_PRESERVED"})assertFalse(forbidden,json.contains(forbidden));return value;
        }
    }
    static long count(NativeVaultProviderReferenceCensus.Observation result,String code)throws Exception{
        return NativeVaultProviderReferenceCensusTest.stateCount(result,code);
    }
    static void unresolved(NativeVaultProviderReferenceCensus.Observation result)throws Exception{
        assertEquals(1,count(result,"PROVIDER_METADATA_SEMANTICS_UNRESOLVED_RETAINED"));
        assertFalse(result.inventoryAcknowledged);assertFalse(result.keyRemovalAllowed);
    }
    static String clockCode(String state){return "ORIGINAL_CLOCK_"+state+"_TRANSPORT_FIELDS_UNQUALIFIED_LOCAL_ONLY";}
    static final String RECOVERY="ORIGINAL_RECOVERY_CURSOR_AND_NEED_FIELDS_LOCAL_NOT_SERVER_RECONCILIATION";
    @Test public void exactSavedClockFactsRemainUnqualifiedAndNoClockObservationWrites()throws Exception{
        var x=new Fixture();x.savedClock();var original=x.clock();var result=x.inspect();
        assertEquals(1,count(result,clockCode("CURRENT")));assertEquals(5,result.providerClassifiedRows);
        assertTrue(ProviderWireJson.same(original,x.clock()));assertFalse(result.json().getBoolean("clock_profile_qualified"));
    }
    @Test public void storedRefreshRequiredAndFencedWithConflictAreNotRevivedOrSelected()throws Exception{
        for(String state:new String[]{"REFRESH_REQUIRED","FENCED"}){
            var x=new Fixture();x.savedClock();JSONObject row=x.clock();row.put("state",state).put("last_observed_boot_count",8).put("last_observed_elapsed_ms",1);
            if(state.equals("FENCED")){
                var conflicting=new JSONObject(row.getJSONObject("sample").toString());conflicting.put("request_id","44000000-0000-4000-8000-000000000004");
                row.put("conflicting_sample",conflicting);
            }
            x.put(x.clockKey(),row);var result=x.inspect();assertEquals(1,count(result,clockCode(state)));assertTrue(ProviderWireJson.same(row,x.clock()));
        }
    }
    @Test public void clockVersionUnknownExtraAndTypedProfileFieldsRemainUnresolved()throws Exception{
        for(String fault:new String[]{"version","extra","numeric_profile","numeric_counter"}){
            var x=new Fixture();x.savedClock();JSONObject row=x.clock();
            switch(fault){case "version":row.put("clock_version",2);break;case "extra":row.put("future_permission",true);break;
                case "numeric_profile":row.put("profile_id",123);break;case "numeric_counter":row.put("last_observed_elapsed_ms","101");break;}
            x.put(x.clockKey(),row);unresolved(x.inspect());
        }
    }
    @Test public void clockForeignFullActorOrMismatchedDigestIsNotDigestOnlyAdmission()throws Exception{
        for(String fault:new String[]{"seal","digest","authority"}){
            var x=new Fixture();x.savedClock();JSONObject row=x.clock();
            if(fault.equals("seal"))row.getJSONObject("principal").put("installation_seal","different-original-seal");
            if(fault.equals("digest"))row.put("principal_digest","f".repeat(64));if(fault.equals("authority"))row.put("authority_state","REVOKED_OR_FOREIGN");
            x.put(x.clockKey(),row);unresolved(x.inspect());
        }
    }
    @Test public void clockRevisionBindingEpochAndUnknownGenerationReferencesAreNotBackfilled()throws Exception{
        for(String fault:new String[]{"revision","binding","epoch","generation"}){
            var x=new Fixture();x.savedClock();JSONObject row=x.clock();
            if(fault.equals("revision"))row.put("engine_revision",x.revision+1);
            if(fault.equals("binding"))row.put("binding_id","44000000-0000-4000-8000-000000000005");
            if(fault.equals("epoch"))row.put("provider_epoch",x.meta().getLong("invalidation_epoch")+1);
            if(fault.equals("generation"))row.put("generation_id","44000000-0000-4000-8000-000000000006");
            x.put(x.clockKey(),row);unresolved(x.inspect());
        }
    }
    @Test public void invalidSampleBoundsRollbackAndConflictOutsideFenceAreNotQualified()throws Exception{
        for(String fault:new String[]{"sample_bounds","rollback","conflict","sample_fields"}){
            var x=new Fixture();x.savedClock();JSONObject row=x.clock();
            if(fault.equals("sample_bounds"))row.getJSONObject("sample").put("after_elapsed_ms",45099);
            if(fault.equals("rollback"))row.put("last_observed_elapsed_ms",100);
            if(fault.equals("conflict"))row.put("conflicting_sample",row.getJSONObject("sample"));
            if(fault.equals("sample_fields"))row.getJSONObject("sample").put("authenticated",true);
            x.put(x.clockKey(),row);unresolved(x.inspect());
        }
    }
    @Test public void identicalDuplicateClockJsonFieldAndDecimalVersionCannotNormalizeThroughOwningParser()throws Exception{
        for(String spelling:new String[]{"duplicate","decimal","exponent"}){
            var x=new Fixture();x.savedClock();String raw=x.clock().toString();
            if(spelling.equals("duplicate"))raw=raw.substring(0,raw.length()-1)+",\"clock_version\":1}";
            else raw=raw.replace("\"clock_version\":1","\"clock_version\":"+(spelling.equals("decimal")?"1.0":"1e0"));
            x.raw(x.clockKey(),raw);unresolved(x.inspect());
        }
    }
    @Test public void exactPendingRecoveryNeedAndOriginalGenerationSetAreLocalOnly()throws Exception{
        var x=new Fixture();var request=x.scan();var before=x.recovery(request);var result=x.inspect();
        assertEquals(1,count(result,RECOVERY));assertEquals(5,result.providerClassifiedRows);
        assertTrue(before.getJSONObject("scan").isNull("server_now"));assertTrue(ProviderWireJson.same(before,x.recovery(request)));
    }
    @Test public void completedEmptyPageAndNewCoalescedNeedAreDistinctNoServerOrInventoryAcknowledgment()throws Exception{
        var x=new Fixture();var request=x.scan();long originalEpoch=request.scan().getLong("captured_epoch");
        x.journal.requestRecovery();x.completeEmpty(request);
        var original=x.recovery(request);assertTrue(original.isNull("scan"));assertEquals(originalEpoch,original.getLong("completed_epoch"));
        assertEquals(originalEpoch+1,x.meta().getLong("recovery_epoch"));assertEquals(1,count(x.inspect(),RECOVERY));
        assertTrue(ProviderWireJson.same(original,x.recovery(request)));
    }
    @Test public void restartedHistoricalScanIsKeptAfterLaterCompletionNotClearedOrReplayed()throws Exception{
        var x=new Fixture();var first=x.scan();var row=x.recovery(first);JSONObject prior=row.getJSONObject("scan");
        row.put("last_restarted_scan",prior).put("scan",JSONObject.NULL);x.put(x.key(first.recoveryId),row);
        var second=x.journal.prepareInventory(x.principal);assertNotEquals(first.scan().get("scan_id"),second.scan().get("scan_id"));x.completeEmpty(second);
        var original=x.recovery(first);assertEquals(1,count(x.inspect(),RECOVERY));
        assertTrue(ProviderWireJson.same(prior,original.getJSONObject("last_restarted_scan")));
    }
    @Test public void recoveryFullActorForeignAuthorityAndWrongBindingRemainUnresolved()throws Exception{
        for(String fault:new String[]{"seal","authority","binding"}){
            var x=new Fixture();var request=x.scan();var row=x.recovery(request);var key=x.key(request.recoveryId);
            if(fault.equals("seal"))row.getJSONObject("principal").put("installation_seal","foreign-seal");
            if(fault.equals("authority"))row.put("authority_state","REVOKED_OR_FOREIGN");
            if(fault.equals("binding")){
                var store=x.f.old.providerStore.store();store.commit(store.loadRetained().revision,Map.of(),java.util.Set.of(key));
                key=x.key("recovery-44000000-0000-4000-8000-000000000007");
            }
            x.put(key,row);unresolved(x.inspect());
        }
    }
    @Test public void malformedUnknownRecoveryAndNestedFieldsNeverBecomeCompletion()throws Exception{
        for(String fault:new String[]{"extra","scan_extra","pages_type","epoch_future","completed_without_scan","invalid_cursor"}){
            var x=new Fixture();var request=x.scan();var row=x.recovery(request);var scan=row.getJSONObject("scan");
            switch(fault){case "extra":row.put("may_clear",true);break;case "scan_extra":scan.put("receipt",true);break;
                case "pages_type":scan.put("pages","0");break;case "epoch_future":scan.put("captured_epoch",x.meta().getLong("recovery_epoch")+1);break;
                case "completed_without_scan":row.put("completed_epoch",1);break;case "invalid_cursor":scan.put("cursor",new JSONObject());break;}
            x.put(x.key(request.recoveryId),row);unresolved(x.inspect());
        }
    }
    @Test public void duplicateMissingGenerationAndDuplicateScanIdentityAreNotSelected()throws Exception{
        for(String fault:new String[]{"duplicate_generation","missing_generation","duplicate_scan"}){
            var x=new Fixture();var request=x.scan();var row=x.recovery(request);var scan=row.getJSONObject("scan");
            if(fault.equals("duplicate_generation"))scan.getJSONArray("generation_ids").put(x.f.old.generation.generationId);
            if(fault.equals("missing_generation"))scan.put("generation_ids",new JSONArray().put("44000000-0000-4000-8000-000000000008"));
            if(fault.equals("duplicate_scan"))row.put("last_restarted_scan",new JSONObject(scan.toString()));
            x.put(x.key(request.recoveryId),row);unresolved(x.inspect());
        }
    }
    @Test public void currentMaintenanceDiagnosticIsDigestReferenceNotFullPrincipalProof()throws Exception{
        var x=new Fixture();x.diagnostic();assertEquals(1,count(x.inspect(),"LOCAL_INVOCATION_DIAGNOSTIC_DIGEST_REFERENCE_NOT_FULL_PRINCIPAL_WITNESS"));
    }
    @Test public void staleKnownDiagnosticIsHistoricalNotCurrentFailureAuthority()throws Exception{
        var x=new Fixture();x.diagnostic();var row=x.f.record(x.key("last-local-failure"));row.put("engine_revision",x.revision+1);
        x.put(x.key("last-local-failure"),row);assertEquals(1,count(x.inspect(),"HISTORICAL_LOCAL_INVOCATION_DIAGNOSTIC_NOT_AUTHORITY"));
    }
    @Test public void unknownDiagnosticHandlingRevisionDigestAndShapeRemainUnresolved()throws Exception{
        for(String fault:new String[]{"reason","handling","future_revision","digest","extra"}){
            var x=new Fixture();x.diagnostic();var row=x.f.record(x.key("last-local-failure"));
            switch(fault){case "reason":row.put("reason","NEW_UNKNOWN_REASON");break;case "handling":row.put("handling","DELETE_ALL");break;
                case "future_revision":row.put("observed_journal_revision",Long.MAX_VALUE);break;case "digest":row.put("principal_digest","a".repeat(64));break;
                case "extra":row.put("permission",true);break;}
            x.put(x.key("last-local-failure"),row);unresolved(x.inspect());
        }
    }
    @Test public void reservedCapacityDiagnosticIsNotBoundRecoveryReceiptOrActorAuthority()throws Exception{
        var x=new Fixture();x.put(ProviderRecordStore.DIAGNOSTIC,new JSONObject().put("schema","custodial.native-provider-journal.v1")
            .put("recovery_needed",true).put("reason","CAPACITY_PRESERVED"));
        assertEquals(1,count(x.inspect(),"LOCAL_CAPACITY_DIAGNOSTIC_NOT_RECOVERY_SETTLEMENT"));
    }
    @Test public void malformedCapacityAndUnknownMetadataStayCapturedNotIgnored()throws Exception{
        var x=new Fixture();x.put(ProviderRecordStore.DIAGNOSTIC,new JSONObject().put("schema","custodial.native-provider-journal.v1")
            .put("recovery_needed",false).put("reason","CAPACITY_PRESERVED"));
        x.put(x.key("future-local-row"),new JSONObject().put("schema","custodial.native-provider-journal.v1").put("value","unknown original"));
        var result=x.inspect();assertEquals(2,count(result,"PROVIDER_METADATA_SEMANTICS_UNRESOLVED_RETAINED"));assertEquals(x.f.total(),result.recordCount);
    }
}
