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
public final class CurrentNativeCheckOnlyAfterCleaningSqlProducer {
    private static final String PREFIX="custodial.test-current-native-";
        private static final String[] NATIVE_HEADERS={"X-Memphis-Native-Attestation-Version","X-Memphis-Native-Request-Id",
        "X-Memphis-Native-Request-Timestamp","X-Memphis-Native-Request-Attestation"};
    private static final long RESPONSE_WAIT_NANOS=40_000_000_000L;
    private final Path root;
    private String session,completion;
    private Path visitRoot;
    private int exchanges,forwards;
    private byte[] received;
    private String expectedFn;
    private JSONObject expectedArgs;
    private CurrentNativeCheckOnlyAfterCleaningSqlProducer(Path root){this.root=root;}
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
        Path file=(visitRoot==null?root:visitRoot).resolve(name),pending=(visitRoot==null?root:visitRoot).resolve(name+".part");byte[] bytes=value.toString().getBytes(StandardCharsets.UTF_8);
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
        Path file=(visitRoot==null?root:visitRoot).resolve(name);long started=System.nanoTime();
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
                require(!responded&&!disconnected&&outputClosed,"one normal response only");responded=true;
                require("POST".equals(getRequestMethod())&&"/scan-api/rpc".equals(url.getPath()),"closed native route");
                require(++exchanges<=4,"exact two distinct visits only; no retry");
                byte[] raw=output.toByteArray();JSONObject body=object(raw);require(expectedFn.equals(body.getString("fn")),"wrong native stage");
                require(ProviderWireJson.same(expectedArgs,body.getJSONObject("args")),"native arguments changed");
                require(headers.containsKey("Authorization")&&headers.containsKey("X-Device-Credential"),"normal private credential transport missing");
                JSONObject nativeHeaders=nativeHeaders(headers);
                byte[] args=body.getJSONObject("args").toString().getBytes(StandardCharsets.UTF_8);
                String phase=exchanges%2==1?"START":"COMPLETION";
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
    private static JSONObject event(String type,String at,String entry)throws org.json.JSONException{return new JSONObject().put("client_event_id",entry)
        .put("event_type",type).put("result","ok").put("notes",JSONObject.NULL).put("scanned_at",at)
        .put("payload_json",new JSONObject().put("entry_source","native-nfc"));}
    private void run(JSONObject prepared)throws Exception {require(prepared.getInt("assignment_epoch")==7,"actual assigned epoch7 required");
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
        var originalCompletions=new ArrayList<JSONObject>();
        for(int visit=1;visit<=2;visit++){
        String result=visit==1?"full":"checked_no_cleaning_needed";
        session=UUID.randomUUID().toString();completion=UUID.randomUUID().toString();
        visitRoot=root.resolve(visit==1?"prior-cleaning":"check-only");
        Files.createDirectory(visitRoot,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        // Same original unexpired snapshot/clock and actual enrolled owner.
        // This is the normal next-job admission, not a renewed clock/lease.
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
        require(exchanges==2*visit,"exactly one new START and completion per visit; no replay");
        originalCompletions.add(new JSONObject(completionArgs.toString()));
        // The owner must observe exact native capture and current fixed SQL/
        // Dashboard proof before this NEW, distinct ordinary visit begins.
        // The marker is serialization DATA, never native admission authority.
        byte[] verified=awaitResponse("VISIT_VERIFIED.json");
        try{JSONObject observed=object(verified);require(observed.getInt("visit")==visit
            &&session.equals(observed.getString("client_session_id"))&&completion.equals(observed.getString("client_completion_id"))
            &&observed.getBoolean("actual_SQL")&&observed.getBoolean("native_capture_observed"),"same visit owner verification DATA required");}
        finally{Arrays.fill(verified,(byte)0);}
        for(JSONObject original:originalCompletions){JSONObject retained=new NativeCompletionJournal(f.work).recover("KIOSK_08",original);
            require(retained!=null&&"closed".equals(retained.getString("status")),"both exact normal native completion receipts retained");}
        }
        visitRoot=null;
        publish("PAIR_NATIVE_CAPTURED.json",new JSONObject().put("schema",PREFIX+"two-visit-pair-captured.v1")
            .put("visits",2).put("normal_native_receipts_retained",2).put("original_snapshot_id",snapshot.getString("snapshot_id"))
            .put("separation_read",false).put("private_ACK",false).put("physical_NFC",false));
        System.out.println("CURRENT_NATIVE_FULL_THEN_CHECK_ONLY_PAIR_CAPTURED_SOURCE_ONLY");
        }finally{if(received!=null)Arrays.fill(received,(byte)0);received=null;f.wiped();}
    }
    private static JSONObject nativeHeaders(Map<String,String> values)throws Exception {
        JSONObject result=new JSONObject();for(String key:NATIVE_HEADERS){String value=values.get(key);require(value!=null&&!value.isEmpty(),"normal native header missing");result.put(key,value);}return result;
    }
    public static void main(String[] args)throws Exception {
        require(args.length==2&&"--current-native-cleaning-check-pair-sql".equals(args[0]),"exact NEW pair owner selector required");
        require(Boolean.getBoolean("custodial.fixture.backend-admissible-credential")
            &&"fresh-host-before-originals".equals(System.getProperty("custodial.fixture.original-clock-source")),"normal fresh Source enrollment recipe required");
        Path root=Path.of(args[1]).toAbsolutePath();
        require(Files.isDirectory(root,LinkOption.NOFOLLOW_LINKS)&&!Files.isSymbolicLink(root)&&root.toRealPath().equals(root),"fresh canonical owned IPC directory");
        require(Files.getPosixFilePermissions(root,LinkOption.NOFOLLOW_LINKS).equals(PosixFilePermissions.fromString("rwx------")),"private IPC directory mode0700");
        try(var entries=Files.newDirectoryStream(root)){require(!entries.iterator().hasNext(),"NEW original owner requires empty IPC root");}
        var owner=new CurrentNativeCheckOnlyAfterCleaningSqlProducer(root);
        owner.publish("PAIR_NATIVE_READY.json",new JSONObject().put("schema",PREFIX+"two-visit-pair-ready.v1")
            .put("pid",ProcessHandle.current().pid()).put("class_name",CurrentNativeCheckOnlyAfterCleaningSqlProducer.class.getName())
            .put("native_engine_created",false).put("visits",2));
        byte[] input=owner.awaitResponse("PREPARED.json");try{owner.run(object(input));}finally{Arrays.fill(input,(byte)0);}
    }
}
