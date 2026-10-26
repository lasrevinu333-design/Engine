package org.memphiszoo.custodial.vault;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.nio.channels.FileChannel;
import java.security.cert.Certificate;
import java.util.*;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

/** NEW disposable Source owner. Normal native enrollment, monotonic occurrence,
 * same observed NFC identity, purpose attestation, HTTPS request signing and
 * completion journal consume an actual restricted SQL response across fixed
 * CREATE_NEW files. RF bytes, enrollment, AES/prefs and HTTPS peer are explicit
 * source fixtures: this is not physical NFC, Android storage or genuine TLS.
 * No old Task7 original/exporter, private capability or reflected field is used.
 */
public final class CurrentNativeVisitSqlProducer {
    private static final String PREFIX="custodial.test-current-native-";
    private static final Set<String> RESULTS=Set.of("full","details","checked_no_cleaning_needed");
    private static final String[] NATIVE_HEADERS={"X-Memphis-Native-Attestation-Version","X-Memphis-Native-Request-Id",
        "X-Memphis-Native-Request-Timestamp","X-Memphis-Native-Request-Attestation"};
    private static final long RESPONSE_WAIT_NANOS=40_000_000_000L;
    private final Path root;
    private final String session=UUID.randomUUID().toString(),completion=UUID.randomUUID().toString();
    private int exchanges,forwards;
    private byte[] received;
    private String expectedFn;
    private JSONObject expectedArgs;
    private boolean contextPhase;
    private byte[] challengeBody;
    private JSONObject challengeHeaders;
    private CurrentNativeVisitSqlProducer(Path root){this.root=root;}
    private static void require(boolean value,String why){if(!value)throw new AssertionError(why);}
    private static String sha(byte[] bytes)throws VaultFailure{return NativeRetainedAttempt.hash(bytes);}
    private static byte[] bounded(Path path,int maximum)throws Exception {
        BasicFileAttributes before=Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        require(before.isRegularFile()&&!before.isSymbolicLink()&&before.size()>0&&before.size()<=maximum,"fixed input unavailable");
        byte[] bytes=Files.readAllBytes(path);BasicFileAttributes after=Files.readAttributes(path,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        require(Objects.equals(before.fileKey(),after.fileKey())&&before.size()==bytes.length&&after.size()==bytes.length
            &&before.lastModifiedTime().equals(after.lastModifiedTime()),"fixed input changed");return bytes;
    }
    private static JSONObject object(byte[] bytes)throws Exception{return ProviderWireJson.object(bytes,2_000_000);}
    private void publish(String name,JSONObject value)throws Exception {
        Path file=root.resolve(name),pending=root.resolve(name+".part");byte[] bytes=value.toString().getBytes(StandardCharsets.UTF_8);
        try(FileChannel channel=FileChannel.open(pending,StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
            Files.setPosixFilePermissions(pending,PosixFilePermissions.fromString("rw-------"));
            var buffer=java.nio.ByteBuffer.wrap(bytes);while(buffer.hasRemaining())channel.write(buffer);channel.force(true);
        }
        Files.createLink(file,pending); // Atomic complete publication, fails if final already exists; original .part retained.
        byte[] reopened=bounded(file,2_000_000);try{require(Arrays.equals(bytes,reopened),"fixed output readback changed");}
        finally{Arrays.fill(bytes,(byte)0);Arrays.fill(reopened,(byte)0);}
        System.out.println("CURRENT_NATIVE_VISIT_STAGE "+name);System.out.flush();
    }
    private byte[] awaitResponse(String name)throws Exception {
        Path file=root.resolve(name);long started=System.nanoTime();
        while(Files.notExists(file,LinkOption.NOFOLLOW_LINKS)){
            if(System.nanoTime()-started>=RESPONSE_WAIT_NANOS)throw new IOException("current native fixture response timeout; original remains UNKNOWN");
            Thread.sleep(5);
        }
        return bounded(file,1_048_576);
    }
    private final class Connection extends HttpsURLConnection {
        private final Map<String,String> headers=new LinkedHashMap<>();
        private final ByteArrayOutputStream output=new ByteArrayOutputStream();
        private boolean outputClosed,responded,disconnected;
        private byte[] response;
        Connection(URL url){super(url);}
        @Override public void setRequestProperty(String key,String value){headers.put(key,value);}
        @Override public OutputStream getOutputStream(){return new OutputStream(){
            public void write(int value){throw new AssertionError("normal original request array required");}
            public void write(byte[] bytes,int offset,int length){require(!outputClosed&&offset==0&&length==bytes.length,"original output loan changed");output.write(bytes,offset,length);}
            public void close(){outputClosed=true;}
        };}
        @Override public int getResponseCode()throws IOException {
            try{
                require(!responded&&!disconnected&&(contextPhase||outputClosed),"one normal response only");responded=true;
                if(contextPhase){
                    require("GET".equals(getRequestMethod())&&NativeSeparationContext.PATH.equals(url.getPath())&&output.size()==0,"fixed normal context route");
                    require(++exchanges==3,"one context read after ordinary capture");
                    publish("CONTEXT_LOAN.json",new JSONObject().put("schema",PREFIX+"context-loan.v1").put("method","GET")
                        .put("path",NativeSeparationContext.PATH).put("exactRequestBytesBase64","").put("nativeHeaders",nativeHeaders(headers)));
                    response=awaitResponse("EXACT_CONTEXT_RESPONSE.bin");received=response.clone();return 200;
                }
                require("POST".equals(getRequestMethod())&&"/scan-api/rpc".equals(url.getPath()),"closed native route");
                require(++exchanges<=2,"no third native write or retry");
                byte[] raw=output.toByteArray();JSONObject body=object(raw);require(expectedFn.equals(body.getString("fn")),"wrong native stage");
                require(ProviderWireJson.same(expectedArgs,body.getJSONObject("args")),"native arguments changed");
                require(headers.containsKey("Authorization")&&headers.containsKey("X-Device-Credential"),"normal private credential transport missing");
                JSONObject nativeHeaders=nativeHeaders(headers);
                byte[] args=body.getJSONObject("args").toString().getBytes(StandardCharsets.UTF_8);
                String phase=exchanges==1?"START":"COMPLETION";
                try{publish(phase+"_LOAN.json",new JSONObject().put("schema",PREFIX+"visit-loan.v1")
                    .put("client_session_id",session).put("client_completion_id",completion)
                    .put("exactRequestBytesBase64",Base64.getEncoder().encodeToString(raw))
                    .put("exactArgumentBytesBase64",Base64.getEncoder().encodeToString(args)).put("nativeHeaders",nativeHeaders));}
                finally{Arrays.fill(raw,(byte)0);Arrays.fill(args,(byte)0);}
                response=awaitResponse("EXACT_"+phase+"_RESPONSE.bin");received=response.clone();return 200;
            }catch(Exception failure){throw new IOException("current native stage remained original/UNKNOWN",failure);}
        }
        @Override public Map<String,List<String>> getHeaderFields(){return Map.of("Content-Type",List.of("application/json; charset=utf-8"));}
        @Override public InputStream getInputStream(){return new ByteArrayInputStream(response);}
        @Override public InputStream getErrorStream(){return getInputStream();}
        @Override public void disconnect(){disconnected=true;headers.clear();if(response!=null)Arrays.fill(response,(byte)0);output.reset();}
        @Override public boolean usingProxy(){return false;}@Override public void connect(){}
        @Override public String getCipherSuite(){return "SOURCE_SQL_FILE_LOAN_NOT_TLS";}
        @Override public Certificate[] getLocalCertificates(){return null;}@Override public Certificate[] getServerCertificates(){return null;}
    }
    private AuthorizedResponse send(VaultEngine engine,String fn,JSONObject args)throws Exception {
        expectedFn=fn;expectedArgs=args;byte[] body=new JSONObject().put("fn",fn).put("args",args).toString().getBytes(StandardCharsets.UTF_8);
        try{return engine.authorizedRequest("KIOSK_08",new AuthorizedRequest("/scan-api/rpc","POST",Map.of("Content-Type","application/json"),body));}
        finally{Arrays.fill(body,(byte)0);expectedFn=null;expectedArgs=null;}
    }
    private String scan(AndroidOfflineAuthorityTimeStore store,String location,OfflineAuthorityTime.MonotonicClock monotonic,byte[] uid)throws Exception {
        String identity=PhysicalNfcTagIdentity.observe(uid,new String[]{"android.nfc.tech.NfcA","android.nfc.tech.Ndef"});
        require(!identity.isEmpty(),"first valid source NFC input required");
        String handoff=NativeNfcScanHandoff.record(store,"memphiszoo://scan?code="+location,monotonic.now(),monotonic.bootCount(),identity);
        Map<String,Object> row=NativeNfcScanHandoff.require(store,handoff,monotonic.now(),monotonic.bootCount());
        require(identity.equals(row.get("native_tag_identity")),"same original observed source tag");
        String entry=(String)row.get("entry_id");NativeNfcScanHandoff.markClaimed(store,handoff,entry,monotonic.now(),monotonic.bootCount());return entry;
    }
    private static JSONObject event(String type,String at,String entry){return new JSONObject().put("client_event_id",entry)
        .put("event_type",type).put("result","ok").put("notes",JSONObject.NULL).put("scanned_at",at)
        .put("payload_json",new JSONObject().put("entry_source","native-nfc"));}
    private void run(JSONObject prepared,String result)throws Exception {
        require(RESULTS.contains(result),"closed ordinary result required");require(prepared.getInt("assignment_epoch")==7,"actual assigned epoch7 required");
        require("KIOSK_08".equals(prepared.getString("device_identifier")),"fixed existing synthetic device");
        require(!prepared.getBoolean("separation_cutoff_created")&&prepared.isNull("context"),"ordinary first native owner before separation");
        var f=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
        try{
        require(f.persistence.current().metadata.credentialId.equals(prepared.getString("credential_id")),"actual fresh enrolled credential must match SQL fixture");
        f.engine=new VaultEngine(f.persistence,f.vaultCipher,new HttpsEnrollmentTransport(System::currentTimeMillis,()->UUID.randomUUID().toString()),
            new FakeLegacySource(),new TestSealGenerator(),System::currentTimeMillis,f.work);
        URL.setURLStreamHandlerFactory(protocol->"https".equals(protocol)?new URLStreamHandler(){
            @Override protected URLConnection openConnection(URL url){require("memphis-zoo-mcp.onrender.com".equals(url.getHost()),"closed normal HTTPS fixture peer");return new Connection(url);}
        }:null);
        var monotonic=new OfflineAuthorityTime.MonotonicClock(){public long now(){return System.nanoTime()/1_000_000L;}public int bootCount(){return 1;}};
        var time=new OfflineAuthorityTime(f.work,monotonic);JSONObject snapshot=prepared.getJSONObject("snapshot");
        require(snapshot.getString("employee_id").equals(prepared.getString("employee_id"))&&snapshot.getString("credential_id").equals(prepared.getString("credential_id"))
            &&snapshot.getInt("assignment_epoch")==7,"actual SQL snapshot owner tuple");
        time.acceptSnapshot("KIOSK_08",snapshot.getString("snapshot_id"),snapshot.getString("generated_at"),snapshot.getString("expires_at"),snapshot.toString());
        time.authorizeNewWork("KIOSK_08",snapshot.getString("snapshot_id"));
        byte[] uid={4,1,2,3,4,5,6};String identity=PhysicalNfcTagIdentity.observe(uid,new String[]{"android.nfc.tech.NfcA"});
        String location=prepared.getString("location_code"),startEntry=scan(f.work,location,monotonic,uid);
        String started=time.beginOccurrence("KIOSK_08",location,session,snapshot.getString("snapshot_id"),startEntry,true,identity);
        JSONObject startArgs=new JSONObject().put("p_device_id","KIOSK_08").put("p_location_code",location).put("p_client_session_id",session)
            .put("p_client_started_at",started).put("p_snapshot_id",snapshot.getString("snapshot_id")).put("p_snapshot_employee_id",prepared.getString("employee_id"))
            .put("p_snapshot_assignment_epoch",7).put("p_snapshot_credential_id",prepared.getString("credential_id"));
        var startAttestation=f.engine.attestOfflineStart("KIOSK_08",location,session,snapshot.getString("snapshot_id"),prepared.getString("employee_id"),7,
            prepared.getString("credential_id"),startEntry,started,"","");for(var entry:startAttestation.entrySet())startArgs.put(entry.getKey(),entry.getValue());
        AuthorizedResponse start=send(f.engine,"tool_start_offline_occurrence",startArgs);JSONObject startWire=object(start.body);
        require(start.status==200&&startWire.getBoolean("ok"),"actual SQL start response required");JSONObject control=startWire.getJSONObject("data");
        require(session.equals(control.getString("client_session_id"))&&control.getBoolean("native_start_attested"),"same native original accepted START");
        String context=control.getString("context_id"),proof=control.getString("submission_proof");require(proof.matches("[a-f0-9]{64}"),"actual normal SQL submission proof");
        publish("START_CAPTURED.json",new JSONObject().put("schema",PREFIX+"start-captured.v1").put("client_session_id",session)
            .put("exact_received_response_sha256",sha(received)).put("native_authorized_response_sha256",sha(start.body))
            .put("capture_source","NORMAL_HTTPS_TRANSPORT_AND_CURRENT_ACTIVE_ENGINE_RESPONSE")
            .put("journal_state","NATIVE_OCCURRENCE_START_RETAINED_NO_SERVER_START_JOURNAL"));Arrays.fill(received,(byte)0);received=null;
        String finishEntry=scan(f.work,location,monotonic,uid);require(!startEntry.equals(finishEntry),"distinct finish scan entry");
        String ended=time.completeOccurrenceFromScan("KIOSK_08",location,session,started,finishEntry,true,identity);
        JSONObject answers=new JSONObject().put("work_result",result).put("services_performed",new JSONArray(result.equals("full")?List.of("Full cleaning services"):
            result.equals("details")?List.of("Restock toilet paper"):List.of())).put("form_type","restroom")
            .put("maintenance_issues_found",new JSONArray().put("Sink leaking")).put("note","Fresh Source fixture independent issue")
            .put("out_of_order_signed","Yes").put("out_of_order_details","Sink one")
            .put("__custodial_offline_reconciliation_v1",new JSONObject().put("context_id",context).put("submission_proof",proof));
        JSONObject completionArgs=new JSONObject().put("p_device_id","KIOSK_08").put("p_client_session_id",session).put("p_client_completion_id",completion)
            .put("p_location_code",location).put("p_client_started_at",started).put("p_client_ended_at",ended).put("p_response_json",answers)
            .put("p_scan_evidence",new JSONArray().put(event("scan_start",started,startEntry)).put(event("scan_finish",ended,finishEntry))).put("p_correlation_id","scan-commit:"+session+":"+completion);
        var completionAttestation=f.engine.attestOfflineCompletion("KIOSK_08",location,session,completion,context,finishEntry,started,ended,"","");
        for(var entry:completionAttestation.entrySet())completionArgs.put(entry.getKey(),entry.getValue());
        byte[] completionBody=new JSONObject().put("fn","tool_commit_cleaning_workflow").put("args",completionArgs).toString().getBytes(StandardCharsets.UTF_8);
        var request=new AuthorizedRequest("/scan-api/rpc","POST",Map.of("Content-Type","application/json"),completionBody);Arrays.fill(completionBody,(byte)0);
        var journal=new NativeCompletionJournal(f.work);journal.preflight("KIOSK_08",request);
        expectedFn="tool_commit_cleaning_workflow";expectedArgs=completionArgs;
        AuthorizedResponse completed=f.engine.authorizedRequest("KIOSK_08",request);expectedFn=null;expectedArgs=null;
        journal.captureAuthenticatedResponse("KIOSK_08",request,completed);
        JSONObject recovered=new NativeCompletionJournal(f.work).recover("KIOSK_08",completionArgs);
        require(recovered!=null&&"closed".equals(recovered.getString("status")),"actual same normal native completion receipt recovered");
        publish("COMPLETION_CAPTURED.json",new JSONObject().put("schema",PREFIX+"completion-captured.v1")
            .put("client_session_id",session).put("client_completion_id",completion).put("exact_received_response_sha256",sha(received))
            .put("native_authorized_response_sha256",sha(completed.body)).put("capture_source","NORMAL_HTTPS_CURRENT_ENGINE_AND_NATIVE_COMPLETION_JOURNAL")
            .put("journal_state","NORMAL_CAPTURE_AND_SAME_ORIGINAL_RECOVERED_CLOSED").put("original_completion_arguments_sha256",sha(completionArgs.toString().getBytes(StandardCharsets.UTF_8))));
        Arrays.fill(received,(byte)0);received=null;Arrays.fill(request.body,(byte)0);Arrays.fill(start.body,(byte)0);Arrays.fill(completed.body,(byte)0);
        require(exchanges==2,"exactly one START and one completion; no replay");
        System.out.println("CURRENT_NATIVE_VISIT_ORDINARY_CAPTURE_COMPLETE_SOURCE_ONLY");
        continueInventory(f);
        }finally{if(received!=null)Arrays.fill(received,(byte)0);received=null;f.wiped();}
    }
    private static JSONObject nativeHeaders(Map<String,String> values)throws Exception {
        JSONObject result=new JSONObject();for(String key:NATIVE_HEADERS){String value=values.get(key);require(value!=null&&!value.isEmpty(),"normal native header missing");result.put(key,value);}return result;
    }
    /** Deliberate loss AFTER normal private request output. Native durable
     * UNKNOWN remains intact; SQL owner later admits this exact first packet
     * once. No fake successful reply or retry is supplied. */
    private static final class OriginalLoanConnection extends HttpsURLConnection {
        final Map<String,String> headers=new LinkedHashMap<>();final ByteArrayOutputStream output=new ByteArrayOutputStream();
        final JSONArray writes;boolean attempted;
        OriginalLoanConnection(URL url,JSONArray writes){super(url);this.writes=writes;}
        public void setRequestProperty(String key,String value){headers.put(key,value);}
        public OutputStream getOutputStream(){return output;}
        public int getResponseCode()throws IOException {
            try{require(!attempted,"one original private output");attempted=true;
                require("POST".equals(getRequestMethod())&&VaultEngine.NativePrivateCustodyPreparedExchange.PATH.equals(url.getPath()),"closed original private path");
                byte[] raw=output.toByteArray();try{JSONObject body=object(raw);
                    if("custodial.original-native-private-custody-write.v1".equals(body.getString("schema")))
                        writes.put(new JSONObject().put("exactRequestBytesBase64",Base64.getEncoder().encodeToString(raw)).put("nativeHeaders",nativeHeaders(headers)));
                    else require("custodial.original-native-private-custody-query.v1".equals(body.getString("schema")),"normal archived QUERY required");
                }finally{Arrays.fill(raw,(byte)0);}
            }catch(Exception failure){throw new IOException("normal original loan failed",failure);}
            throw new SocketTimeoutException("new owned source fixture lost original response; no retry");
        }
        public void disconnect(){headers.clear();output.reset();}public boolean usingProxy(){return false;}public void connect(){}
        public String getCipherSuite(){return "SOURCE_LOST_RESPONSE_NOT_TLS";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
    }
    /** Actual loopback shipping HTTP fixture. Original private credentials stay
     * only in these in-memory request headers and never enter IPC/export data. */
    private final class ForwardConnection extends HttpsURLConnection {
        final String origin;final Map<String,String> headers=new LinkedHashMap<>();final ByteArrayOutputStream output=new ByteArrayOutputStream();
        java.net.http.HttpClient actual;byte[] response;int status;boolean attempted;
        ForwardConnection(URL url,String origin){super(url);this.origin=origin;}
        public void setRequestProperty(String key,String value){headers.put(key,value);}
        public OutputStream getOutputStream(){return output;}
        public int getResponseCode()throws IOException {
            try{require(!attempted,"no loopback HTTP resend");attempted=true;
                require(url.getQuery()==null&&url.getRef()==null,"exact original path only");
                // HttpURLConnection silently suppresses Origin. Use the normal
                // JDK HTTP/1 peer client; no global restricted-header option.
                int connect=Math.max(1,Math.min(5000,getConnectTimeout()>0?getConnectTimeout():5000));
                int timeout=Math.max(1,Math.min(15000,getReadTimeout()>0?getReadTimeout():15000));
                actual=java.net.http.HttpClient.newBuilder().version(java.net.http.HttpClient.Version.HTTP_1_1)
                    .followRedirects(java.net.http.HttpClient.Redirect.NEVER).connectTimeout(java.time.Duration.ofMillis(connect)).build();
                byte[] raw=output.toByteArray();try{
                    var builder=java.net.http.HttpRequest.newBuilder(URI.create(origin+url.getPath())).timeout(java.time.Duration.ofMillis(timeout))
                        .method(getRequestMethod(),java.net.http.HttpRequest.BodyPublishers.ofByteArray(raw));
                    for(var entry:headers.entrySet())builder.header(entry.getKey(),entry.getValue());
                    var sent=builder.build();var pending=actual.sendAsync(sent,java.net.http.HttpResponse.BodyHandlers.ofByteArray());
                    java.net.http.HttpResponse<byte[]> reply;
                    try{reply=pending.get(timeout,java.util.concurrent.TimeUnit.MILLISECONDS);}
                    catch(Exception failure){pending.cancel(true);throw failure;}
                    status=reply.statusCode();response=reply.body();require(response.length<=1_048_576,"bounded loopback response");
                    // Actual non-2xx bytes return to the normal native decoder.
                    // This retained DATA receipt cannot mint an auth/ACK owner.
                    String publicCode="";try{Object code=object(response).opt("error");if(code instanceof String&&((String)code).matches("native_private_custody_[a-z0-9_]{1,96}"))publicCode=(String)code;}catch(Exception ignored){}
                    publish(String.format(java.util.Locale.ROOT,"G05_FORWARD_%04d.json",++forwards),new JSONObject()
                        .put("schema",PREFIX+"forward-observation-data.v1").put("method",getRequestMethod()).put("path",url.getPath())
                        .put("exactRequestBytesBase64",Base64.getEncoder().encodeToString(raw)).put("nativeHeaders",nativeHeaders(headers))
                        .put("request_origin",sent.headers().firstValue("Origin").orElse(""))
                        .put("http_status",status).put("response_sha256",sha(response)).put("public_error_code",publicCode)
                        .put("observation_only",true).put("inventory_acknowledged",false));
                    if(status>=200&&status<300&&NativeSameOriginalRecoveryChallengeEnvelope.PATH.equals(url.getPath())){
                        require(challengeBody==null,"one original challenge only");challengeBody=raw.clone();challengeHeaders=nativeHeaders(headers);
                    }
                }finally{Arrays.fill(raw,(byte)0);}return status;
            }catch(Exception failure){throw new IOException("shipping loopback original remained UNKNOWN",failure);}
        }
        public Map<String,List<String>> getHeaderFields(){return Map.of("Content-Type",List.of("application/json; charset=utf-8"));}
        public InputStream getInputStream(){return new ByteArrayInputStream(response);}public InputStream getErrorStream(){return getInputStream();}
        public void disconnect(){if(actual!=null)actual.close();headers.clear();output.reset();if(response!=null)Arrays.fill(response,(byte)0);}
        public boolean usingProxy(){return false;}public void connect(){}public String getCipherSuite(){return "SOURCE_LOOPBACK_SHIPPING_HTTP_NOT_TLS";}
        public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
    }
    private void continueInventory(NativeRetainedOwnerTest.Fixture f)throws Exception {
        byte[] contextData=awaitResponse("SEPARATION_CONTEXT.json");JSONObject separated;
        try{separated=object(contextData);}finally{Arrays.fill(contextData,(byte)0);}
        contextPhase=true;NativeSeparationContext context;
        try{context=f.engine.readNativeSeparationContext(f.principal,null);}finally{contextPhase=false;}
        require(ProviderWireJson.same(separated.getJSONObject("context"),context.json()),"actual authenticated context must equal fixed SQL read");
        publish("CONTEXT_CAPTURED.json",new JSONObject().put("schema",PREFIX+"context-captured.v1")
            .put("exact_received_response_sha256",sha(received)).put("capture_source","NORMAL_ENGINE_AUTHENTICATED_CONTEXT_AND_ACTUAL_SQL"));
        Arrays.fill(received,(byte)0);received=null;
        // The ordinary state reader is valid only BEFORE the actual freeze.
        // Keep the typed native principal DATA; later retained-generation APIs
        // independently authenticate the frozen snapshot/principal/provider.
        var retainedPrincipal=NativeProviderPrincipal.fromNativeJournal(f.principal.readFor(f.engine.getState()));
        var batch=new NativeRetainedBatchOwnerTest.Fixture(f,context);
        var generation=new NativeGenerationBoundBatchTest.Fixture(batch,retainedPrincipal);
        var census=new NativeRetainedNamespaceCensusTest.Fixture(generation);
        var semantic=new NativeRetainedNamespaceSemanticJoinTest.Fixture(census);
        // Select a current wall-clock transport before the first capture. No
        // original timestamp, interval, expiry or saved owner is ever renewed.
        f.engine=new VaultEngine(semantic.adapter,f.vaultCipher,f.enrollment,new FakeLegacySource(),new TestSealGenerator(),System::currentTimeMillis,f.work);
        var layout=new NativeRetainedNamespaceCustodyLayoutTest.Fixture(semantic);
        var capsule=new NativePrivateCustodyOwnerTest.Fixture(layout);
        try(var original=new NativePrivateCustodyExchangeTest.GuardedIdentityFixture(capsule)){
            JSONObject originalGeneration;try(var observed=generation.generation()){originalGeneration=observed.projection();}
            JSONArray writes=new JSONArray();var captureHttp=new NativePrivateCustodyHttp(url->new OriginalLoanConnection(url,writes),System::currentTimeMillis);
            int count=original.plan.projection().getInt("chunk_count");
            for(int i=0;i<count;i++)for(boolean query:new boolean[]{false,true}){
                try(var prepared=query?original.query(i):original.write(i)){
                    var attempt=new NativeRetainedHttp.Attempt();boolean refused=false;
                    try{original.engine.sendOriginalPrivateCustodyExchange(prepared,captureHttp,attempt);}
                    catch(VaultFailure expected){refused=true;}finally{attempt.cancel();}
                    require(refused,"lost original cannot gain successful observation");
                    require(Files.isRegularFile(original.dir.resolve((query?"query_unknown-":"write_unknown-")+i+".bin"),LinkOption.NOFOLLOW_LINKS),"normal durable UNKNOWN required");
                }
            }
            require(writes.length()==count,"complete bounded first original WRITE set");
            JSONObject facts=new JSONObject().put("separationContext",context.json()).put("originalGeneration",originalGeneration)
                .put("source_recipe",new JSONObject().put("key_id","86dbf23b4ae9a54d3d032f7b4b2cceb98395add7dc811476257b6bba1ce27778")
                    .put("sha256","167626f8f68c6fb5c3a4f5e3b1c52c02c704199479749b8bc05508a7c817d618"));
            publish("G05_ORIGINAL_WRITES.json",new JSONObject().put("schema",PREFIX+"original-writes.v1").put("originals",writes).put("sourceFacts",facts));
            byte[] gatewayData=awaitResponse("G05_GATEWAY.json");String origin;
            try{origin=object(gatewayData).getString("origin");require(origin.matches("http://127\\.0\\.0\\.1:[1-9][0-9]{0,4}"),"owned loopback only");}finally{Arrays.fill(gatewayData,(byte)0);}
            var http=new NativePrivateCustodyHttp(url->new ForwardConnection(url,origin),System::currentTimeMillis);
            var control=new NativePrivateCustodyFrameReadControl();
            try(var frame=original.engine.readCurrentOriginalPrivateCustodyFrame(original.plan,original.journal,http,control);
                var target=frame.takeOriginalRecoveryTarget(http);var prepared=target.takeFirstOriginalChallengeRequest()){
                original.engine.sendOriginalRecoveryChallenge(prepared,http,control);
                require(challengeBody!=null&&challengeHeaders!=null,"normal first challenge HTTP loan required");
                publish("G05_CHALLENGE_CAPTURED.json",new JSONObject().put("schema",PREFIX+"challenge-captured.v1")
                    .put("exactRequestBytesBase64",Base64.getEncoder().encodeToString(challengeBody)).put("nativeHeaders",challengeHeaders)
                    .put("journal_state","NORMAL_FIRST_CHALLENGE_RESPONSE_CAPTURED_ORIGINAL_UNKNOWN_RETAINED"));
                byte[] result=awaitResponse("G05_RESULT.json");try{JSONObject done=object(result);require(done.getBoolean("actual_SQL")&&done.getBoolean("actual_loopback_HTTP"),"actual SQL/HTTP owner result required");}
                finally{Arrays.fill(result,(byte)0);}
            }finally{control.cancel();if(challengeBody!=null)Arrays.fill(challengeBody,(byte)0);challengeBody=null;challengeHeaders=null;}
        }
        System.out.println("CURRENT_NATIVE_VISIT_G05_SHIPPING_MANAGER_SQL_SOURCE_COMPLETE_NOT_ANDROID_ACK");
    }
    public static void main(String[] args)throws Exception {
        require(args.length==4&&"--current-native-visit-sql".equals(args[0]),"exact new owner selector required");
        require(Boolean.getBoolean("custodial.fixture.original-batch-before-capture")
            &&"original-bound-prefs-host-model".equals(System.getProperty("custodial.fixture.semantic-join-persistence")),"original bounded same-owner host preferences recipe required");
        require(Boolean.getBoolean("custodial.fixture.backend-admissible-credential")&&"fresh-host-before-originals".equals(System.getProperty("custodial.fixture.original-clock-source")),"fresh normal Source construction settings required before originals");
        Path prepared=Path.of(args[1]).toAbsolutePath(),root=Path.of(args[2]).toAbsolutePath();
        require(Files.isDirectory(root,LinkOption.NOFOLLOW_LINKS)&&!Files.isSymbolicLink(root)&&root.toRealPath().equals(root),"fresh canonical owned IPC directory");
        require(Files.getPosixFilePermissions(root,LinkOption.NOFOLLOW_LINKS).equals(PosixFilePermissions.fromString("rwx------")),"private IPC directory mode0700");
        require(prepared.getParent().equals(root)&&prepared.getFileName().toString().equals("PREPARED.json"),"exact prepared fixture file");
        byte[] input=bounded(prepared,1_048_576);try{new CurrentNativeVisitSqlProducer(root).run(object(input),args[3]);}finally{Arrays.fill(input,(byte)0);}
    }
}
