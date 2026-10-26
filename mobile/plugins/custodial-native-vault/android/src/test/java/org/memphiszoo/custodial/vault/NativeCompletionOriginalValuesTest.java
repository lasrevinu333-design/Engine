package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** NEW original value/legacy/frozen decoder cases. All HTTP, identities,
 * encryption, prefs/durability and work are synthetic, not live acceptance. */
public final class NativeCompletionOriginalValuesTest {
    static final String DEVICE=NativeCompletionJournalTest.DEVICE;
    interface Hook {void run()throws Exception;}
    static final class Store implements NativeCompletionJournal.Store {
        final Map<String,String> rows=new HashMap<>();int writes,deletes;boolean drop;
        Hook save=()->{};
        public String loadCompletionReceipt(String key){return rows.get(key);}
        public void saveCompletionReceipt(String key,String value)throws VaultFailure{writes++;if(!drop)rows.put(key,value);try{save.run();}catch(Exception e){throw new VaultFailure(NativeCompletionJournal.FAILURE,e);}}
        public void deleteCompletionReceipt(String key){deletes++;rows.remove(key);}
    }
    static final class Fixture {
        final Store store=new Store();final NativeCompletionJournal journal=new NativeCompletionJournal(store);
        final JSONObject args=NativeCompletionJournalTest.args();
        AuthorizedRequest request;
        Fixture()throws Exception{request=NativeCompletionJournalTest.request(args);}
        void capture()throws Exception{journal.captureAuthenticatedResponse(DEVICE,request,NativeCompletionJournalTest.response(NativeCompletionJournalTest.result()));}
        String key(){assertEquals(1,store.rows.size());return store.rows.keySet().iterator().next();}
        JSONObject record()throws Exception{return new JSONObject(store.rows.get(key()));}
        NativeCompletionJournal.RetainedOriginalRequest inspect()throws Exception{return NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,key(),store.rows.get(key()));}
        void replace(JSONObject r){store.rows.put(key(),r.toString());}
    }
    static void refused(NativeCompletionJournalTest.Throwing action)throws Exception{NativeCompletionJournalTest.refused(action);}
    @Test public void exactOriginalBodyValuesAndRepresentationAreRecoveredWithoutAuthority()throws Exception{
        var f=new Fixture();f.args.getJSONObject("p_response_json").put("private_work_note","ñ🙂 original note").put("typed",new JSONArray().put(1.0).put(false).put(JSONObject.NULL));
        byte[] body=(" \n"+new String(NativeCompletionJournalTest.request(f.args).body,StandardCharsets.UTF_8).replace("\"typed\":[1,","\"typed\":[1.0,")+"\t ").getBytes(StandardCharsets.UTF_8);
        f.request=new AuthorizedRequest("/scan-api/rpc","POST",Map.of("Authorization","synthetic-header-not-to-be-retained"),body);f.capture();
        try(var observed=f.inspect()){
            assertArrayEquals(body,observed.originalBody());assertEquals(NativeRetainedAttempt.hash(body),observed.requestBodySha256);
            assertEquals("ñ🙂 original note",observed.originalArgs().getJSONObject("p_response_json").get("private_work_note"));
            assertTrue(observed.originalArgs().getJSONObject("p_response_json").getJSONArray("typed").get(0) instanceof Double);
            assertEquals("ORIGINAL_REQUEST_VALUES_RETAINED_UNVERIFIED",observed.state);assertFalse(observed.workAccepted);assertFalse(observed.inventoryAcknowledged);assertFalse(observed.keyRemovalAllowed);
        }
        assertFalse(f.store.rows.toString().contains("synthetic-header-not-to-be-retained"));assertEquals(1,f.store.writes);assertEquals(0,f.store.deletes);
        f.journal.requireAccepted(DEVICE,f.args); // Existing ordinary workflow semantics, synthetic boundary ONLY.
    }
    @Test public void returnedCopiesCannotMutateOriginalAndCloseWipesOnlyOwnedBodyCopy()throws Exception{
        var f=new Fixture();f.capture();var before=new HashMap<>(f.store.rows);var observed=f.inspect();byte[] expected=f.request.body.clone();
        observed.originalBody()[0]=0;observed.originalArgs().getJSONObject("p_response_json").put("note","changed");assertArrayEquals(expected,observed.originalBody());
        var field=NativeCompletionJournal.RetainedOriginalRequest.class.getDeclaredField("body");field.setAccessible(true);byte[] owned=(byte[])field.get(observed);
        observed.close();observed.close();assertArrayEquals(new byte[owned.length],owned);refused(()->observed.originalBody());refused(()->observed.originalArgs());assertEquals(before,f.store.rows);assertEquals(0,f.store.deletes);
    }
    @Test public void replayPreservesFirstBodyDespiteLegitimateTransportProofRotation()throws Exception{
        var f=new Fixture();f.capture();var first=new HashMap<>(f.store.rows);byte[] original=f.request.body.clone();
        f.args.put("p_native_completion_transport_attestation_version","custodial-native-completion-transport.v1").put("p_native_completion_transport_attestation","b".repeat(64));
        f.request=NativeCompletionJournalTest.request(f.args);f.capture();assertEquals(first,f.store.rows);assertEquals(1,f.store.writes);
        try(var read=f.inspect()){assertArrayEquals(original,read.originalBody());}f.journal.requireAccepted(DEVICE,f.args);
    }
    @Test public void legacyV2KeepsExactReceiptAndDoesNotInventOrBackfillOriginalRequest()throws Exception{
        var f=new Fixture();f.capture();JSONObject old=f.record().put("schema_version","native-server-completion.v2");old.remove("original_request_body_base64");old.remove("original_request_body_sha256");f.replace(old);
        var first=new HashMap<>(f.store.rows);int writes=f.store.writes;
        try(var read=f.inspect()){assertFalse(read.originalValuesAvailable);assertNull(read.requestBodySha256);assertEquals("LEGACY_BINDING_ONLY_ORIGINAL_REQUEST_UNAVAILABLE",read.state);refused(()->read.originalArgs());}
        f.journal.requireAccepted(DEVICE,f.args);f.capture();assertEquals(first,f.store.rows);assertEquals(writes,f.store.writes);assertEquals(0,f.store.deletes);
    }
    @Test public void legacyV1FutureOrUnknownFieldsArePreservedRefusalsNotSchemaUpgrade()throws Exception{
        for(int variant=0;variant<3;variant++){
            var f=new Fixture();f.capture();JSONObject r=f.record();if(variant==0)r.put("schema_version","native-server-completion.v1");else if(variant==1)r.put("schema_version","native-server-completion.v99");else r.put("future",true);f.replace(r);
            var old=new HashMap<>(f.store.rows);refused(()->f.inspect());refused(()->f.journal.requireAccepted(DEVICE,f.args));refused(()->f.capture());assertEquals(old,f.store.rows);assertEquals(0,f.store.deletes);
        }
    }
    @Test public void bodyDigestOrRecomputedForeignAnswersCannotSubstituteOriginalValues()throws Exception{
        for(boolean recompute:new boolean[]{false,true}){
            var f=new Fixture();f.capture();JSONObject r=f.record(),args=NativeCompletionJournalTest.args();args.getJSONObject("p_response_json").put("note","substituted");
            byte[] changed=NativeCompletionJournalTest.request(args).body;r.put("original_request_body_base64",NativeRetainedAttempt.encodeBase64(changed));if(recompute)r.put("original_request_body_sha256",NativeRetainedAttempt.hash(changed));f.replace(r);
            var old=new HashMap<>(f.store.rows);refused(()->f.inspect());refused(()->f.journal.requireAccepted(DEVICE,f.args));assertEquals(old,f.store.rows);
        }
    }
    @Test public void sourceKeyDeviceAndResultIdentityMustMatchExactOriginalRequest()throws Exception{
        var f=new Fixture();f.capture();var old=new HashMap<>(f.store.rows);
        refused(()->NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,"a".repeat(64),f.store.rows.get(f.key())));
        refused(()->NativeCompletionJournal.inspectRetainedOriginalRequest("KIOSK_04",f.key(),f.store.rows.get(f.key())));assertEquals(old,f.store.rows);
        JSONObject r=f.record();r.getJSONObject("result").put("client_completion_id",NativeCompletionJournalTest.FINISH);f.replace(r);var changed=new HashMap<>(f.store.rows);refused(()->f.inspect());assertEquals(changed,f.store.rows);
    }
    @Test public void duplicateTrailingOrNoncanonicalBase64IsNotNormalizedAsStoredAuthority()throws Exception{
        for(int variant=0;variant<4;variant++){
            var f=new Fixture();f.capture();String key=f.key(),text=f.store.rows.get(key);
            if(variant==0)text=text.replaceFirst("\\{","{\"schema_version\":\"native-server-completion.v3\",");else if(variant==1)text+=" trailing";
            else {JSONObject r=f.record();r.put("original_request_body_base64",variant==2?r.getString("original_request_body_base64")+"\n":"AA==");text=r.toString();}
            f.store.rows.put(key,text);var before=new HashMap<>(f.store.rows);refused(()->f.inspect());assertEquals(before,f.store.rows);assertEquals(0,f.store.deletes);
        }
    }
    @Test public void duplicateOrForeignOriginalEnvelopeCannotBeCapturedOrRecovered()throws Exception{
        for(int variant=0;variant<3;variant++){
            var f=new Fixture();JSONObject envelope=new JSONObject(new String(f.request.body,StandardCharsets.UTF_8));String text;
            if(variant==0)text=envelope.toString().replaceFirst("\\{","{\"fn\":\"tool_commit_cleaning_workflow\",");
            else if(variant==1)text=envelope.put("future",true).toString();else text=envelope.put("device_id","KIOSK_04").toString();
            f.request=new AuthorizedRequest("/scan-api/rpc","POST",Map.of(),text.getBytes(StandardCharsets.UTF_8));refused(()->f.capture());assertTrue(f.store.rows.isEmpty());assertEquals(0,f.store.writes);
        }
    }
    @Test public void bodyRetentionCapacityFailurePreservesPayloadWithoutPartialReceipt()throws Exception{
        var f=new Fixture();f.args.getJSONObject("p_response_json").put("historical_large_work_value","x".repeat(60000));f.request=NativeCompletionJournalTest.request(f.args);byte[] original=f.request.body.clone();
        assertTrue(original.length<65536);refused(()->f.capture());assertArrayEquals(original,f.request.body);assertTrue(f.store.rows.isEmpty());assertEquals(0,f.store.writes);assertEquals(0,f.store.deletes);
    }
    @Test public void requestMutationDuringPersistenceCannotReplaceSavedOriginalOrReturnSuccess()throws Exception{
        var f=new Fixture();byte[] original=f.request.body.clone();f.store.save=()->f.request.body[0]=0;refused(()->f.capture());
        assertEquals(1,f.store.writes);try(var retained=f.inspect()){assertArrayEquals(original,retained.originalBody());assertFalse(retained.workAccepted);}assertEquals(0,f.store.deletes);
    }
    @Test public void actualEncryptedFrozenDecoderReportsValuesButNotPayloadOrSemanticAcceptance()throws Exception{
        var f=new NativeRetainedOwnerTest.Fixture();f.workDisk.memory.remove(NativeRetainedWorkCapture.FENCE);f.workDisk.durable=new HashMap<>(f.workDisk.memory);
        var journal=new NativeCompletionJournal(f.work);var args=NativeCompletionJournalTest.args();args.getJSONObject("p_response_json").put("private_work_note","do-not-export-this-work-answer");
        var request=NativeCompletionJournalTest.request(args);journal.captureAuthenticatedResponse(DEVICE,request,NativeCompletionJournalTest.response(NativeCompletionJournalTest.result()));
        var principal=NativeProviderPrincipal.fromNativeJournal(f.principal.readFor(f.engine.getState()));
        var context=NativeSeparationContext.validateRetainedData(NativeSeparationContextTest.data().put("credential_id",principal.json().get("credential_id")),principal);
        var raw=f.work.separationRawSnapshot();var proof=f.engine.attestNativeSeparationSnapshot(context,NativeProtectedWorkSnapshot.capture(raw),f.principal,null);f.work.freezeSeparationSnapshot(raw,proof);
        var before=new HashMap<>(f.workDisk.memory);int commits=f.workDisk.commits;var capture=NativeRetainedWorkCapture.capture(f.work);
        JSONObject discovery=f.work.inspectSeparationSnapshot(capture.original,proof).json();JSONObject item=null;
        JSONArray rows=discovery.getJSONArray("records");for(int i=0;i<rows.length();i++)if("COMPLETION_RECEIPT".equals(rows.getJSONObject(i).get("kind")))item=rows.getJSONObject(i);
        assertNotNull(item);assertEquals("READABLE_UNVERIFIED",item.get("state"));assertTrue(item.getBoolean("original_request_values_available"));assertEquals(NativeRetainedAttempt.hash(request.body),item.get("original_request_body_sha256"));
        assertEquals(NativeCompletionJournalTest.SESSION,item.getJSONArray("identifiers").getJSONObject(0).get("client_session_id"));
        assertEquals("UNKNOWN",discovery.get("native_semantic_inventory_state"));assertEquals("UNKNOWN",discovery.get("browser_inventory_state"));assertFalse(discovery.getBoolean("phone_released"));
        assertFalse(discovery.toString().contains("do-not-export-this-work-answer"));assertEquals(before,f.workDisk.memory);assertEquals(commits,f.workDisk.commits);f.wiped();
    }
    @Test public void largeLegacyV2ExactReplayIsNotRejectedByNewBodyRetentionLimit()throws Exception{
        var f=new Fixture();f.args.getJSONObject("p_response_json").put("large_original_legacy_answer","x".repeat(70000));f.request=NativeCompletionJournalTest.request(f.args);
        assertTrue(f.request.body.length>65536);assertTrue(f.request.body.length<RequestPolicy.MAX_REQUEST_BYTES);
        // Synthetic legacy record using the unchanged historical binding owner,
        // not a real authenticated receipt, credential or migration execution.
        var method=NativeCompletionJournal.class.getDeclaredMethod("binding",String.class,JSONObject.class);method.setAccessible(true);
        String binding=(String)method.invoke(null,DEVICE,f.args),key=NativeProviderPrincipal.hash(DEVICE+"|"+NativeCompletionJournalTest.SESSION+"|"+NativeCompletionJournalTest.COMPLETE);
        JSONObject legacy=new JSONObject().put("schema_version","native-server-completion.v2").put("binding_sha256",binding).put("result",NativeCompletionJournalTest.result());
        f.store.rows.put(key,legacy.toString());var exact=new HashMap<>(f.store.rows);f.journal.requireAccepted(DEVICE,f.args);f.capture();
        assertEquals(exact,f.store.rows);assertEquals(0,f.store.writes);assertEquals(0,f.store.deletes);
        try(var read=f.inspect()){assertFalse(read.originalValuesAvailable);}
    }
    @Test public void copiedLegacyResultCannotBecomeReadableAtAnotherSourceKey()throws Exception{
        var f=new Fixture();f.capture();JSONObject legacy=f.record().put("schema_version","native-server-completion.v2");legacy.remove("original_request_body_base64");legacy.remove("original_request_body_sha256");f.replace(legacy);
        var old=new HashMap<>(f.store.rows);refused(()->NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,"a".repeat(64),f.store.rows.get(f.key())));
        assertEquals(old,f.store.rows);assertEquals(0,f.store.deletes);try(var read=f.inspect()){assertFalse(read.originalValuesAvailable);}
    }
}
