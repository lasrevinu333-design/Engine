package org.memphiszoo.custodial.vault;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class NativeCompletionJournalTest {
    public static void main(String[] args)throws Exception{
        if(args.length==1&&"--current-sql-readback-stdin-only".equals(args[0])){
            currentSqlReadbackFromStdin();return;
        }
        if(args.length==1&&"--audit-capacity-only".equals(args[0])){
            var t=new NativeCompletionJournalTest();t.auditLargeNotesRemainLossless();t.auditLargeFixedReadRecoversLostWriteReply();
            t.auditCapacityRefusesBeforeDispatchWithoutDiscard();
            System.out.println("NEW3 audit receipt capacity cases PASS; journal/synthetic owner/store, not server or phone proof");return;
        }
        if(args.length==1&&"--fixed-read-dispatch-regression-only".equals(args[0])){
            assertTrue("normal native dispatcher must recognize actual fixed original READ purpose",
                NativeCompletionJournal.isCompletionRequest(fixedRequest(args())));return;
        }
        if(args.length==1&&"--fixed-read-owner-only".equals(args[0])){
            var t=new NativeCompletionJournalTest();t.fixedReadRetainsActualReadWireAndFirstResult();t.fixedReadRequiresPrivateOwnerAndCurrentness();
            t.fixedReadRejectsMismatchedOriginalTuple();t.fixedReadClosedGrammarAndFoundFalse();t.fixedReadRejectsMutableActualBuffers();
            t.fixedReadPreservesExistingWriteReceipts();t.fixedReadCannotReplaceUnknownOrDifferentPrior();t.fixedReadRecoveryRequiresFreshPrincipal();
            t.fixedReadRecordCannotMasqueradeAsWrite();t.fixedReadPersistenceAndCapacityFailuresStayUnknown();
            System.out.println("NEW10 fixed original completion READ journal cases PASS; synthetic owner/HTTPS/store only, not actual TLS/SQL/native authority");return;
        }
        throw new IllegalArgumentException("focused case selector required");
    }
    // Existing owning test consumes the exact isolated SQL readback supplied
    // on stdin. Owner/transport are deliberately synthetic: this checks the
    // journal/ACK interface, not TLS, an Android device or manager identity.
    static void currentSqlReadbackFromStdin()throws Exception{
        byte[] input=System.in.readNBytes(512*1024+1);
        if(input.length>512*1024)throw new IllegalArgumentException("bounded SQL fixture input required");
        try{
            JSONObject fixture=ProviderWireJson.object(input,512*1024),body=fixture.getJSONObject("request_body"),data=fixture.getJSONObject("readback");
            JSONObject a=body.getJSONObject("completion_payload"),rb=data.getJSONObject("readback"),result=data.getJSONObject("result");
            String device=a.getString("p_device_id");
            boolean rawHttp=fixture.has("request_body_base64")&&fixture.has("response_body_base64");
            byte[] requestBytes=rawHttp?boundedFixtureBase64(fixture.getString("request_body_base64"),NativeCompletionJournal.MAX_BODY_BYTES):body.toString().getBytes(StandardCharsets.UTF_8);
            assertTrue(ProviderWireJson.same(body,ProviderWireJson.object(requestBytes,NativeCompletionJournal.MAX_BODY_BYTES)));
            var q=new AuthorizedRequest(NativeCompletionJournal.FIXED_READ_PATH,"POST",Collections.emptyMap(),requestBytes);
            var r=rawHttp?new AuthorizedResponse(200,Collections.emptyMap(),boundedFixtureBase64(fixture.getString("response_body_base64"),NativeCompletionJournal.MAX_BODY_BYTES)):fixedResponse(result,rb);
            if(rawHttp)assertTrue(ProviderWireJson.same(data,ProviderWireJson.object(r.body,NativeCompletionJournal.MAX_BODY_BYTES).getJSONObject("data")));
            var principal=NativeProviderPrincipal.fromNativeJournal(new JSONObject()
                .put("schema_version","custodial-protected-principal.v1").put("device_id",device)
                .put("employee_id",rb.getString("original_employee_id")).put("assignment_epoch",rb.getInt("assignment_epoch"))
                .put("credential_id",rb.getString("original_credential_id")).put("credential_operation_id",UUID.randomUUID().toString())
                .put("installation_seal","synthetic-sql-journal-seal").put("enrolled_at",a.getString("p_client_started_at")));
            var owner=new NativeCompletionJournal.FixedReadOwner(){
                public NativeProviderPrincipal requireCurrent(){return principal;}
                public void requireAuthenticatedRead(AuthorizedRequest request,AuthorizedResponse response)throws VaultFailure{
                    if(request!=q||response!=r)throw new VaultFailure(NativeCompletionJournal.FAILURE);
                }
            };
            Store store=new Store();var journal=new NativeCompletionJournal(store);
            assertNull(journal.recover(device,a,owner));journal.preflight(device,q);
            journal.captureAuthenticatedResponse(device,q,r,owner);
            var restarted=new NativeCompletionJournal(store);restarted.requireAccepted(device,a,owner);
            assertTrue(ProviderWireJson.same(result,restarted.recover(device,a,owner)));
            assertEquals(1,store.rows.size());
            try(var saved=NativeCompletionJournal.inspectRetainedOriginalRequest(device,store.rows.keySet().iterator().next(),store.rows.values().iterator().next())){
                assertArrayEquals(q.body,saved.fixedReadBody());assertArrayEquals(r.body,saved.fixedReadResponseBody());
                assertFalse(saved.originalValuesAvailable);assertFalse(saved.keyRemovalAllowed);
            }
            // ACK retirement happens only after the caller's original queue
            // removal. This test does not perform a browser queue mutation.
            restarted.retireAfterQueueRemoval(device,a,owner);assertTrue(store.rows.isEmpty());
            System.out.println("CURRENT SQL original readback -> native journal recreation/ACK-interface PASS; exact raw HTTP bytes="+rawHttp+"; synthetic owner, NOT TLS/device/browser queue proof");
        }finally{Arrays.fill(input,(byte)0);}
    }
    private static byte[] boundedFixtureBase64(String encoded,int maxBytes){
        if(encoded.length()>4*((maxBytes+2)/3))throw new IllegalArgumentException("fixture wire exceeds bound");
        byte[] decoded=Base64.getDecoder().decode(encoded);
        if(decoded.length>maxBytes||!Base64.getEncoder().encodeToString(decoded).equals(encoded)){
            Arrays.fill(decoded,(byte)0);throw new IllegalArgumentException("canonical bounded fixture wire required");
        }
        return decoded;
    }
    static AuthorizedRequest fixedRequest(JSONObject args)throws Exception{return new AuthorizedRequest("/scan-api/original-completion","POST",
        Collections.emptyMap(),new JSONObject().put("completion_payload",args).toString().getBytes(StandardCharsets.UTF_8));}
    static final String DEVICE="KIOSK_08", SESSION="10000000-0000-4000-8000-000000000001";
    static final String COMPLETE="20000000-0000-4000-8000-000000000001", FINISH="30000000-0000-4000-8000-000000000001";
    static final String CONTEXT="40000000-0000-4000-8000-000000000001", OTHER_CONTEXT="40000000-0000-4000-8000-000000000002";
    static final String EMPLOYEE="50000000-0000-4000-8000-000000000001",CREDENTIAL="60000000-0000-4000-8000-000000000001";
    static final String DEVICE_PK="70000000-0000-4000-8000-000000000001",OCCURRENCE="80000000-0000-4000-8000-000000000001";
    static NativeProviderPrincipal principal(String employee)throws Exception{return NativeProviderPrincipal.fromNativeJournal(new JSONObject()
        .put("schema_version","custodial-protected-principal.v1").put("device_id",DEVICE).put("employee_id",employee).put("assignment_epoch",4)
        .put("credential_id",CREDENTIAL).put("credential_operation_id","e0000000-0000-4000-8000-000000000001")
        .put("installation_seal","native-installation-seal-0001").put("enrolled_at","2026-09-17T12:00:00.000Z"));}
    /** SYNTHETIC source owner, not an authentication implementation. Main alone
     * mounts actual private engine/HTTPS/principal/admission closures. */
    static final class Owner implements NativeCompletionJournal.FixedReadOwner{
        NativeProviderPrincipal principal;final AuthorizedRequest request;final AuthorizedResponse response;
        boolean active=true,tls=true;int calls,authCalls,changeAt;Runnable onAuth=()->{};
        Owner(AuthorizedRequest q,AuthorizedResponse r)throws Exception{request=q;response=r;principal=principal(EMPLOYEE);}
        public NativeProviderPrincipal requireCurrent()throws VaultFailure{calls++;if(!active||calls==changeAt)throw new VaultFailure(NativeCompletionJournal.FAILURE);return principal;}
        public void requireAuthenticatedRead(AuthorizedRequest q,AuthorizedResponse r)throws VaultFailure{authCalls++;
            if(!tls||q!=request||r!=response)throw new VaultFailure(NativeCompletionJournal.FAILURE);onAuth.run();}
    }
    static JSONObject readback()throws Exception{return new JSONObject().put("reconciliation_id","90000000-0000-4000-8000-000000000001")
        .put("context_id",CONTEXT).put("occurrence_id",OCCURRENCE).put("original_employee_id",EMPLOYEE).put("original_credential_id",CREDENTIAL)
        .put("device_id",DEVICE_PK).put("location_id","a0000000-0000-4000-8000-000000000001").put("client_session_id",SESSION)
        .put("client_completion_id",COMPLETE).put("assignment_epoch",4).put("payload_fingerprint","f".repeat(64))
        .put("submitted_at","2026-09-18T12:20:07.123456+00:00");}
    static JSONObject fullResult()throws Exception{return result().put("occurrence_id",OCCURRENCE).put("original_employee_id",EMPLOYEE)
        .put("session_uuid","b0000000-0000-4000-8000-000000000001").put("completion_response_id","c0000000-0000-4000-8000-000000000001")
        .put("started_at","2026-09-18T12:00:00+00:00").put("ended_at","2026-09-18T12:20:00+00:00")
        .put("correlation_id","scan-commit:"+SESSION+":"+COMPLETE);}
    static AuthorizedResponse fixedResponse(JSONObject original,JSONObject rb)throws Exception{return response(new JSONObject()
        .put("schema","custodial.original-completion-readback.v1").put("found",true).put("result",original).put("readback",rb));}
    static void captureFixed(NativeCompletionJournal j,AuthorizedRequest q,AuthorizedResponse r,Owner owner)throws Exception{j.captureAuthenticatedResponse(DEVICE,q,r,owner);}
    @Test public void fixedReadRetainsActualReadWireAndFirstResult()throws Exception{
        Store s=new Store();var j=new NativeCompletionJournal(s);JSONObject a=args();var q=fixedRequest(a);var r=fixedResponse(fullResult(),readback());var o=new Owner(q,r);
        assertTrue(NativeCompletionJournal.isCompletionRequest(q));assertEquals(NativeCompletionJournal.FIXED_READ_CAPTURE_PROTOCOL,NativeCompletionJournal.fixedReadCaptureProtocol(o));
        captureFixed(j,q,r,o);String key=s.rows.keySet().iterator().next(),first=s.rows.get(key);JSONObject record=new JSONObject(first);
        assertFalse(record.has("original_request_body_base64"));assertEquals("UNKNOWN",record.getJSONObject("provenance").getString("original_write_wire_state"));
        j.requireAccepted(DEVICE,a,o);assertEquals(fullResult().getString("ended_at"),j.recover(DEVICE,a,o).getString("ended_at"));
        try(var observed=NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,key,first)){
            assertFalse(observed.originalValuesAvailable);assertNull(observed.requestBodySha256);assertTrue(observed.fixedReadValuesAvailable);
            assertArrayEquals(q.body,observed.fixedReadBody());assertArrayEquals(r.body,observed.fixedReadResponseBody());
            assertTrue(ProviderWireJson.same(a,observed.fixedReadArgs()));refused(observed::originalBody);refused(observed::originalArgs);
            assertFalse(observed.workAccepted);assertFalse(observed.inventoryAcknowledged);assertFalse(observed.keyRemovalAllowed);
            observed.close();refused(observed::fixedReadBody);refused(observed::fixedReadResponseBody);
        }
        captureFixed(new NativeCompletionJournal(s),q,r,o);assertEquals(first,s.rows.get(key));
        assertEquals("2026-09-18T12:20:07.123456+00:00",record.getJSONObject("readback").get("submitted_at"));
    }
    @Test public void fixedReadRequiresPrivateOwnerAndCurrentness()throws Exception{
        for(String failure:new String[]{"absent","null-principal","frozen","not-tls","changed-before-save"}){
            Store s=new Store();var j=new NativeCompletionJournal(s);var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());var o=new Owner(q,r);
            if(failure.equals("null-principal"))o.principal=null;if(failure.equals("frozen"))o.active=false;if(failure.equals("not-tls"))o.tls=false;
            if(failure.equals("changed-before-save"))o.changeAt=2;
            refused(()->captureFixed(j,q,r,failure.equals("absent")?null:o));assertTrue(s.rows.isEmpty());
        }
        Store s=new Store();var j=new NativeCompletionJournal(s);refused(()->j.captureAuthenticatedResponse(DEVICE,fixedRequest(args()),fixedResponse(fullResult(),readback())));
        assertTrue(s.rows.isEmpty());assertNull(NativeCompletionJournal.fixedReadCaptureProtocol(null));var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());
        var unavailable=new Owner(q,r);unavailable.active=false;assertNull(NativeCompletionJournal.fixedReadCaptureProtocol(unavailable));
    }
    @Test public void fixedReadRejectsMismatchedOriginalTuple()throws Exception{
        for(String field:new String[]{"original_employee_id","original_credential_id","context_id","occurrence_id","client_session_id","client_completion_id","device_id","assignment_epoch","payload_fingerprint","submitted_at"}){
            JSONObject rb=readback();rb.put(field,field.equals("assignment_epoch")?5:field.equals("device_id")?DEVICE:field.equals("payload_fingerprint")?"bad":field.equals("submitted_at")?"not finite":"d0000000-0000-4000-8000-000000000001");
            Store s=new Store();var j=new NativeCompletionJournal(s);var q=fixedRequest(args());var r=fixedResponse(fullResult(),rb);refused(()->captureFixed(j,q,r,new Owner(q,r)));assertTrue(s.rows.isEmpty());
        }
        for(Object epoch:new Object[]{"4",4.5,JSONObject.NULL}){
            Store s=new Store();var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback().put("assignment_epoch",epoch));refused(()->captureFixed(new NativeCompletionJournal(s),q,r,new Owner(q,r)));assertTrue(s.rows.isEmpty());
        }
        Store s=new Store();var q=fixedRequest(args());var r=fixedResponse(fullResult().put("ended_at","2026-09-18T12:21:00+00:00"),readback());refused(()->captureFixed(new NativeCompletionJournal(s),q,r,new Owner(q,r)));assertTrue(s.rows.isEmpty());
    }
    @Test public void fixedReadClosedGrammarAndFoundFalse()throws Exception{
        Store s=new Store();var j=new NativeCompletionJournal(s);var q=fixedRequest(args());var notFound=response(new JSONObject().put("found",false));captureFixed(j,q,notFound,new Owner(q,notFound));assertTrue(s.rows.isEmpty());
        var unknown=fixedResponse(fullResult(),readback().put("caller_accepted",true));refused(()->captureFixed(j,q,unknown,new Owner(q,unknown)));
        var badBody=new AuthorizedRequest(q.path,q.method,q.headers,new JSONObject().put("completion_payload",args()).put("accepted",true).toString().getBytes(StandardCharsets.UTF_8));
        var good=fixedResponse(fullResult(),readback());refused(()->captureFixed(j,badBody,good,new Owner(badBody,good)));
        var wrongSchema=response(new JSONObject().put("schema","foreign.v1").put("found",true).put("result",fullResult()).put("readback",readback()));
        refused(()->captureFixed(j,q,wrongSchema,new Owner(q,wrongSchema)));assertTrue(s.rows.isEmpty());
    }
    @Test public void fixedReadRejectsMutableActualBuffers()throws Exception{
        for(boolean reply:new boolean[]{false,true}){
            Store s=new Store();var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());var o=new Owner(q,r);
            o.onAuth=()->{if(o.authCalls==2){if(reply)r.body[0]='!';else q.body[0]='!';}};
            refused(()->captureFixed(new NativeCompletionJournal(s),q,r,o));assertTrue(s.rows.isEmpty());
        }
    }
    @Test public void fixedReadPreservesExistingWriteReceipts()throws Exception{
        for(boolean legacy:new boolean[]{false,true}){
            Store s=new Store();var j=new NativeCompletionJournal(s);j.captureAuthenticatedResponse(DEVICE,request(args()),response(result()));
            String key=s.rows.keySet().iterator().next();if(legacy){JSONObject v2=new JSONObject(s.rows.get(key));v2.put("schema_version","native-server-completion.v2");
                v2.remove("original_request_body_base64");v2.remove("original_request_body_sha256");s.rows.put(key,v2.toString());}
            String original=s.rows.get(key);var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());captureFixed(j,q,r,new Owner(q,r));
            assertEquals(original,s.rows.get(key));j.requireAccepted(DEVICE,args());
        }
    }
    @Test public void fixedReadCannotReplaceUnknownOrDifferentPrior()throws Exception{
        Store s=new Store();var j=new NativeCompletionJournal(s);var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());captureFixed(j,q,r,new Owner(q,r));
        String key=s.rows.keySet().iterator().next(),first=s.rows.get(key);JSONObject changed=args();changed.getJSONObject("p_response_json").put("note","foreign answers");
        var foreign=fixedRequest(changed);refused(()->captureFixed(j,foreign,r,new Owner(foreign,r)));assertEquals(first,s.rows.get(key));
        JSONObject unknown=new JSONObject(first).put("schema_version","native-server-completion.v1");s.rows.put(key,unknown.toString());String retained=s.rows.get(key);
        refused(()->captureFixed(j,q,r,new Owner(q,r)));assertEquals(retained,s.rows.get(key));
    }
    @Test public void fixedReadRecoveryRequiresFreshPrincipal()throws Exception{
        Store s=new Store();var j=new NativeCompletionJournal(s);var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());var o=new Owner(q,r);captureFixed(j,q,r,o);
        refused(()->j.requireAccepted(DEVICE,args()));refused(()->j.recover(DEVICE,args()));refused(()->j.retireAfterQueueRemoval(DEVICE,args()));
        o.principal=principal("d0000000-0000-4000-8000-000000000001");refused(()->j.requireAccepted(DEVICE,args(),o));
        o.principal=principal(EMPLOYEE);o.active=false;refused(()->j.requireAccepted(DEVICE,args(),o));assertEquals(1,s.rows.size());
    }
    @Test public void fixedReadRecordCannotMasqueradeAsWrite()throws Exception{
        Store s=new Store();var j=new NativeCompletionJournal(s);var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());captureFixed(j,q,r,new Owner(q,r));
        String key=s.rows.keySet().iterator().next(),encoded=s.rows.get(key);
        JSONObject wrong=new JSONObject(encoded).put("original_request_body_base64",NativeRetainedAttempt.encodeBase64(q.body));
        refused(()->NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,key,wrong.toString()));
        JSONObject label=new JSONObject(encoded);label.getJSONObject("provenance").put("original_write_wire_state","KNOWN");
        refused(()->NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,key,label.toString()));
        JSONObject poisoned=new JSONObject(encoded).put("read_request_body_sha256","a".repeat(64));refused(()->NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,key,poisoned.toString()));
        assertEquals(encoded,s.rows.get(key));
    }
    @Test public void fixedReadPersistenceAndCapacityFailuresStayUnknown()throws Exception{
        Store s=new Store();s.dropWrite=true;var j=new NativeCompletionJournal(s);var q=fixedRequest(args());var r=fixedResponse(fullResult(),readback());var o=new Owner(q,r);
        refused(()->captureFixed(j,q,r,o));assertNull(j.recover(DEVICE,args(),o));
        s.dropWrite=false;var huge=fixedResponse(fullResult().put("large_retained_result","x".repeat(65536)),readback());
        refused(()->captureFixed(j,q,huge,new Owner(q,huge)));assertTrue(s.rows.isEmpty());
    }
    static final class Store implements NativeCompletionJournal.Store {
        final Map<String,String> rows=new HashMap<>(); boolean dropWrite;int preflights;
        public void requireCompletionCapacity(String key,int maximum){preflights++;assertTrue(maximum<=NativeCompletionJournal.MAX_RECORD);}
        public String loadCompletionReceipt(String key){return rows.get(key);}
        public void saveCompletionReceipt(String key,String value){if(!dropWrite)rows.put(key,value);}
        public void deleteCompletionReceipt(String key){rows.remove(key);}
    }
    @Test public void auditLargeNotesRemainLossless()throws Exception{
        for(String note:new String[]{"n".repeat(50000),"漢".repeat(50000),"\"\\\n".repeat(16000)}){
            Store s=new Store();var j=new NativeCompletionJournal(s);JSONObject a=args();a.getJSONObject("p_response_json").put("notes",note);
            var q=request(a);byte[] original=q.body.clone();j.preflight(DEVICE,q);assertEquals(1,s.preflights);assertTrue(s.rows.isEmpty());
            j.captureAuthenticatedResponse(DEVICE,q,response(result()));assertNotNull(new NativeCompletionJournal(s).recover(DEVICE,a));
            try(var receipt=NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,s.rows.keySet().iterator().next(),s.rows.values().iterator().next())){
                assertArrayEquals(original,receipt.originalBody());assertEquals(note,receipt.originalArgs().getJSONObject("p_response_json").getString("notes"));
            }
            assertTrue(s.rows.values().iterator().next().length()>65536);
        }
    }
    @Test public void auditLargeFixedReadRecoversLostWriteReply()throws Exception{
        Store s=new Store();var j=new NativeCompletionJournal(s);JSONObject a=args();a.getJSONObject("p_response_json").put("notes","漢".repeat(50000));
        var q=fixedRequest(a);var r=fixedResponse(fullResult(),readback());var owner=new Owner(q,r);
        j.preflight(DEVICE,q);captureFixed(j,q,r,owner);assertNotNull(new NativeCompletionJournal(s).recover(DEVICE,a,owner));
        try(var receipt=NativeCompletionJournal.inspectRetainedOriginalRequest(DEVICE,s.rows.keySet().iterator().next(),s.rows.values().iterator().next())){
            assertArrayEquals(q.body,receipt.fixedReadBody());assertArrayEquals(r.body,receipt.fixedReadResponseBody());
            assertEquals("漢".repeat(50000),receipt.fixedReadArgs().getJSONObject("p_response_json").getString("notes"));assertFalse(receipt.originalValuesAvailable);
        }
    }
    @Test public void auditCapacityRefusesBeforeDispatchWithoutDiscard()throws Exception{
        Store s=new Store();var j=new NativeCompletionJournal(s);JSONObject a=args();a.getJSONObject("p_response_json").put("notes","n".repeat(NativeCompletionJournal.MAX_BODY_BYTES));
        var q=request(a);byte[] original=q.body.clone();try{j.preflight(DEVICE,q);fail("oversized body sent");}
        catch(VaultFailure e){assertEquals(NativeCompletionJournal.CAPACITY,e.code);}
        assertEquals(0,s.preflights);assertTrue(s.rows.isEmpty());assertArrayEquals(original,q.body);
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
