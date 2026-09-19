package org.memphiszoo.custodial.vault;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class NativeCompletionJournalTest {
    static final String DEVICE="KIOSK_08", SESSION="10000000-0000-4000-8000-000000000001";
    static final String COMPLETE="20000000-0000-4000-8000-000000000001", FINISH="30000000-0000-4000-8000-000000000001";
    static final String CONTEXT="40000000-0000-4000-8000-000000000001", OTHER_CONTEXT="40000000-0000-4000-8000-000000000002";
    static final class Store implements NativeCompletionJournal.Store {
        final Map<String,String> rows=new HashMap<>(); boolean dropWrite;
        public String loadCompletionReceipt(String key){return rows.get(key);}
        public void saveCompletionReceipt(String key,String value){if(!dropWrite)rows.put(key,value);}
        public void deleteCompletionReceipt(String key){rows.remove(key);}
    }
    static JSONObject args() throws Exception {
        return new JSONObject().put("p_device_id",DEVICE).put("p_location_code","NOCX")
            .put("p_client_session_id",SESSION).put("p_client_completion_id",COMPLETE)
            .put("p_correlation_id","scan-commit:"+SESSION+":"+COMPLETE)
            .put("p_native_finish_scan_entry_id",FINISH)
            .put("p_client_started_at","2026-09-18T12:00:00.000Z").put("p_client_ended_at","2026-09-18T12:20:00.000Z")
            .put("p_response_json",new JSONObject()
                .put("services_performed",new JSONArray().put("Full cleaning services"))
                .put("__custodial_offline_reconciliation_v1",new JSONObject()
                    .put("context_id",CONTEXT).put("submission_proof","c".repeat(64))))
            .put("p_scan_evidence",new JSONArray().put(new JSONObject().put("client_event_id",FINISH)))
            .put("p_native_completion_attestation_version","custodial-native-completion.v2")
            .put("p_native_completion_attestation","a".repeat(64));
    }
    static JSONObject result() throws Exception {return new JSONObject().put("status","closed")
        .put("client_session_id",SESSION).put("client_completion_id",COMPLETE);}
    static AuthorizedRequest request(JSONObject args) throws Exception {return new AuthorizedRequest("/scan-api/rpc","POST",
        Collections.emptyMap(),new JSONObject().put("device_id",DEVICE).put("fn","tool_commit_cleaning_workflow").put("args",args).toString().getBytes(StandardCharsets.UTF_8));}
    static AuthorizedResponse response(JSONObject result) throws Exception {return new AuthorizedResponse(200,Collections.emptyMap(),
        new JSONObject().put("ok",true).put("data",result).toString().getBytes(StandardCharsets.UTF_8));}
    interface Throwing {void run() throws Exception;}
    static void refused(Throwing action) throws Exception {try{action.run();fail("untrusted acceptance allowed");}catch(VaultFailure e){assertEquals(NativeCompletionJournal.FAILURE,e.code);}}
    @Test public void browserReceiptWithRecomputableHashIsNotNativeAuthority() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);
        JSONObject fake=args().put("server_completion_receipt",new JSONObject().put("status","closed").put("integrity_sha256","a".repeat(64)));
        assertNull(j.recover(DEVICE,fake));refused(()->j.requireAccepted(DEVICE,fake));assertTrue(s.rows.isEmpty());
    }
    @Test public void nativeReceiptSurvivesObjectRecreationAndExactRetry() throws Exception {
        Store s=new Store();NativeCompletionJournal first=new NativeCompletionJournal(s);JSONObject a=args();
        first.captureAuthenticatedResponse(DEVICE,request(a),response(result()));assertEquals(1,s.rows.size());
        NativeCompletionJournal next=new NativeCompletionJournal(s);next.requireAccepted(DEVICE,a);
        assertEquals("closed",next.recover(DEVICE,a).getString("status"));
        next.captureAuthenticatedResponse(DEVICE,request(a),response(result()));assertEquals(1,s.rows.size());
    }
    @Test public void changingAnswersDoesNotReuseAnAuthenticReceipt() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);JSONObject a=args();
        j.captureAuthenticatedResponse(DEVICE,request(a),response(result()));
        a.getJSONObject("p_response_json").put("note","altered answers");refused(()->j.requireAccepted(DEVICE,a));assertEquals(1,s.rows.size());
    }
    @Test public void changingEvidenceOrFinishTimeDoesNotReuseReceipt() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
        JSONObject changed=args().put("p_scan_evidence",new JSONArray());refused(()->j.requireAccepted(DEVICE,changed));
        JSONObject later=args().put("p_client_ended_at","2026-09-18T12:21:00.000Z");refused(()->j.requireAccepted(DEVICE,later));
    }
    @Test public void wrongResponseIdentityCannotBeRecorded() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);
        refused(()->j.captureAuthenticatedResponse(DEVICE,request(args()),response(result().put("client_completion_id",FINISH))));assertTrue(s.rows.isEmpty());
    }
    @Test public void otherDeviceOrOperationHasNoReceipt() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
        assertNull(j.recover("KIOSK_04",args()));assertNull(j.recover(DEVICE,args().put("p_client_completion_id",FINISH)));
    }
    @Test public void failedCancelledAndUnrelatedResponsesAreNotAccepted() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);
        j.captureAuthenticatedResponse(DEVICE,request(args()),new AuthorizedResponse(503,Collections.emptyMap(),response(result()).body));
        j.captureAuthenticatedResponse(DEVICE,request(args()),response(result().put("status","cancelled")));
        j.captureAuthenticatedResponse(DEVICE,new AuthorizedRequest("/feedback-api/submit","POST",Collections.emptyMap(),request(args()).body),response(result()));
        assertTrue(s.rows.isEmpty());
    }
    @Test public void failedPersistenceCannotReturnAcceptance() throws Exception {
        Store s=new Store();s.dropWrite=true;NativeCompletionJournal j=new NativeCompletionJournal(s);
        refused(()->j.captureAuthenticatedResponse(DEVICE,request(args()),response(result())));assertNull(j.recover(DEVICE,args()));
    }
    @Test public void changedTransportMacPreservesSameSemanticBinding() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
        JSONObject replay=args().put("p_native_completion_transport_attestation_version","custodial-native-completion-transport.v1")
            .put("p_native_completion_transport_attestation","b".repeat(64));
        j.requireAccepted(DEVICE,replay);assertEquals(1,s.rows.size());
    }
    @Test public void changingReconciliationAuthorityDoesNotReuseReceipt() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
        JSONObject changedContext=args();changedContext.getJSONObject("p_response_json")
            .getJSONObject("__custodial_offline_reconciliation_v1").put("context_id",OTHER_CONTEXT);
        refused(()->j.requireAccepted(DEVICE,changedContext));
        JSONObject changedProof=args();changedProof.getJSONObject("p_response_json")
            .getJSONObject("__custodial_offline_reconciliation_v1").put("submission_proof","d".repeat(64));
        refused(()->j.requireAccepted(DEVICE,changedProof));
    }
    @Test public void changingOriginalCompletionAttestationDoesNotReuseReceipt() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
        JSONObject changedVersion=args().put("p_native_completion_attestation_version","custodial-native-completion.v1");
        refused(()->j.requireAccepted(DEVICE,changedVersion));
        JSONObject changedSignature=args().put("p_native_completion_attestation","e".repeat(64));
        refused(()->j.requireAccepted(DEVICE,changedSignature));
    }
    @Test public void changingCorrelationIdentityDoesNotReuseReceipt() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
        JSONObject changed=args().put("p_correlation_id","scan-commit:"+SESSION+":"+FINISH);
        refused(()->j.requireAccepted(DEVICE,changed));
    }
    @Test public void legacyIncompleteBindingNeverAuthorizesCleanup() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);JSONObject a=args();
        j.captureAuthenticatedResponse(DEVICE,request(a),response(result()));
        String key=s.rows.keySet().iterator().next();JSONObject legacy=new JSONObject(s.rows.get(key));
        legacy.put("schema_version","native-server-completion.v1");s.rows.put(key,legacy.toString());
        refused(()->j.requireAccepted(DEVICE,a));
        refused(()->j.captureAuthenticatedResponse(DEVICE,request(a),response(result())));
        assertEquals("native-server-completion.v1",new JSONObject(s.rows.get(key)).getString("schema_version"));
    }
    @Test public void explicitRetirementRemovesOnlyExactReceipt() throws Exception {
        Store s=new Store();NativeCompletionJournal j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
        j.retireAfterQueueRemoval(DEVICE,args());assertTrue(s.rows.isEmpty());assertNull(j.recover(DEVICE,args()));
    }
    @Test public void incompletePendingPayloadDoesNotBlockItsFirstSubmission() throws Exception {
        NativeCompletionJournal j=new NativeCompletionJournal(new Store());
        JSONObject pending=args();pending.remove("p_native_finish_scan_entry_id");
        assertNull(j.recover(DEVICE,pending));
    }
}
