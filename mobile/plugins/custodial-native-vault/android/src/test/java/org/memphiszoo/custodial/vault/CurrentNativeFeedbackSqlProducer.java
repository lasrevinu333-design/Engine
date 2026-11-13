package org.memphiszoo.custodial.vault;

import java.io.*;
import java.net.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.security.cert.Certificate;
import java.util.*;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

/** NEW child-owned source bridge. Real Engine + HTTPS signer; synthetic
 * enrolled principal/cipher/preferences and file-loan HTTPS peer. Not TLS,
 * Android persistence, a real enrollment or a private inventory ACK. */
public final class CurrentNativeFeedbackSqlProducer {
    private static final String[] HEADERS={"X-Memphis-Native-Attestation-Version","X-Memphis-Native-Request-Id",
        "X-Memphis-Native-Request-Timestamp","X-Memphis-Native-Request-Attestation"};
    private final Path root;
    private String path,stem,method;
    private byte[] original,rawHttpBody;
    private boolean forwarded;
    private CurrentNativeFeedbackSqlProducer(Path root){this.root=root;}
    private static void require(boolean b,String why){if(!b)throw new AssertionError(why);}
    private static byte[] read(Path p,int max)throws Exception {
        var a=Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        require(a.isRegularFile()&&!a.isSymbolicLink()&&a.size()>0&&a.size()<=max,"fixed file unavailable");
        byte[] bytes=Files.readAllBytes(p);var b=Files.readAttributes(p,BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        require(Objects.equals(a.fileKey(),b.fileKey())&&a.size()==bytes.length&&b.size()==bytes.length&&a.lastModifiedTime().equals(b.lastModifiedTime()),"fixed file changed");return bytes;
    }
    private byte[] await(String name)throws Exception {
        Path p=root.resolve(name);long start=System.nanoTime();
        while(Files.notExists(p,LinkOption.NOFOLLOW_LINKS)){
            if(System.nanoTime()-start>40_000_000_000L)throw new IOException("original exchange UNKNOWN; no retry");Thread.sleep(5);
        }return read(p,1_500_000);
    }
    private void publish(String name,JSONObject value)throws Exception {
        byte[] bytes=value.toString().getBytes(StandardCharsets.UTF_8);Path pending=root.resolve(name+".part"),result=root.resolve(name);
        byte[] reread=null;
        try {
            try(FileChannel channel=FileChannel.open(pending,StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
                Files.setPosixFilePermissions(pending,PosixFilePermissions.fromString("rw-------"));ByteBuffer b=ByteBuffer.wrap(bytes);while(b.hasRemaining())channel.write(b);channel.force(true);
            }Files.createLink(result,pending);reread=read(result,1_500_000);require(Arrays.equals(bytes,reread),"publication changed");
        }finally{Arrays.fill(bytes,(byte)0);if(reread!=null)Arrays.fill(reread,(byte)0);}
    }
    private final class Connection extends HttpsURLConnection {
        final Map<String,String> headers=new TreeMap<>(String.CASE_INSENSITIVE_ORDER);final ByteArrayOutputStream output=new ByteArrayOutputStream();
        boolean ended,responded,disconnected;byte[] response;int status;String contentType;
        Connection(URL url){super(url);}
        public void setRequestProperty(String k,String v){headers.put(k,v);}
        public OutputStream getOutputStream(){return new OutputStream(){
            public void write(int x){throw new AssertionError("exact native byte array required");}
            public void write(byte[] b,int o,int n){require(!ended&&o==0&&n==b.length,"exact original array");output.write(b,o,n);}
            public void close(){ended=true;}
        };}
        public int getResponseCode()throws IOException {try{
            require(!responded&&!disconnected&&(ended||"GET".equals(method))&&!forwarded,"one forward per native action");responded=true;forwarded=true;
            require(method.equals(getRequestMethod())&&path.equals(url.getFile()),"fixed native feedback path");
            byte[] raw=output.toByteArray();try {require(Arrays.equals(raw,original),"shipping native body changed");
            String expected="95000000-0000-4000-8000-000000000004.SYNTHETIC_LONG_DEVICE_SECRET_SOURCE_OWNER_KIOSK_08";
            require(("Device "+expected).equals(headers.get("Authorization"))&&expected.equals(headers.get("X-Device-Credential"))
                &&expected.equals(headers.get("X-Memphis-Device-Credential")),"exact normal private credential headers required");
            require("KIOSK_08".equals(headers.get("X-Device-Id"))&&"custodial".equals(headers.get("X-Memphis-App-Edition"))
                &&"https://localhost".equals(headers.get("Origin"))&&"application/json".equals(headers.get("Accept"))
                &&("GET".equals(method)?!headers.containsKey("Content-Type"):"application/json".equals(headers.get("Content-Type"))),"exact native transport headers required");
            require(ProviderWireJson.object(raw,30000).getString("operation_id").equals(headers.get("Idempotency-Key")),"actual header must bind original operation");
            JSONObject h=new JSONObject();for(String key:HEADERS){String v=headers.get(key);require(v!=null&&!v.isBlank(),"native header missing");h.put(key,v);}
            publish(stem+"_LOAN.json",new JSONObject().put("schema","custodial.native-feedback-request-loan.v1").put("method",method).put("path",path)
                .put("exactRequestBytesBase64",Base64.getEncoder().encodeToString(raw)).put("nativeHeaders",h).put("idempotencyKey",headers.get("Idempotency-Key")));}finally{Arrays.fill(raw,(byte)0);}
            byte[] envelope=await(stem+"_HTTP.json");try {JSONObject received=ProviderWireJson.object(envelope,1_500_000);
            require(received.keySet().equals(Set.of("status","body_base64","headers")),"closed HTTP result");status=received.getInt("status");JSONObject responseHeaders=received.getJSONObject("headers");
            require(responseHeaders.keySet().equals(Set.of("Content-Type")),"fixed actual HTTP header projection");contentType=responseHeaders.getString("Content-Type");
            require(contentType.length()<=256&&contentType.toLowerCase(Locale.ROOT).matches("application/json(;.*)?"),"actual JSON response type required");
            require(status>=200&&status<=599,"bounded HTTP status");response=Base64.getDecoder().decode(received.getString("body_base64"));
            require(response.length<=1_048_576&&rawHttpBody==null,"bounded one-use raw response");rawHttpBody=response.clone();return status;}finally{Arrays.fill(envelope,(byte)0);}
        }catch(Exception error){throw new IOException("original native FEEDBACK remains UNKNOWN",error);}}
        public Map<String,List<String>> getHeaderFields(){return Map.of("Content-Type",List.of(contentType));}
        public InputStream getInputStream(){return new ByteArrayInputStream(response);}
        public InputStream getErrorStream(){return getInputStream();}
        public void disconnect(){disconnected=true;headers.clear();if(response!=null)Arrays.fill(response,(byte)0);output.reset();}
        public boolean usingProxy(){return false;}public void connect(){}
        public String getCipherSuite(){return "SOURCE_FIXED_FILE_PEER_NOT_TLS";}
        public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
    }
    private void run()throws Exception {
        require(Boolean.getBoolean("custodial.fixture.backend-admissible-credential"),"existing synthetic enrolled credential recipe required before capture");
        var f=NativeRetainedOwnerTest.Fixture.activeBeforeSeparation();
        try{
            require("95000000-0000-4000-8000-000000000004".equals(f.engine.getState().get("active_credential_id")),"normal enrolled fixture differs");
            f.engine=new VaultEngine(f.persistence,f.vaultCipher,new HttpsEnrollmentTransport(System::currentTimeMillis,()->UUID.randomUUID().toString()),
                new FakeLegacySource(),new TestSealGenerator(),System::currentTimeMillis,f.work);
            URL.setURLStreamHandlerFactory(protocol->"https".equals(protocol)?new URLStreamHandler(){
                protected URLConnection openConnection(URL url){require("memphis-zoo-mcp.onrender.com".equals(url.getHost()),"normal host only");return new Connection(url);}
            }:null);
            publish("READY.json",new JSONObject().put("schema","custodial.native-feedback-source-ready.v1"));
            for(int index=1;index<=128;index++){
                stem=String.format(Locale.ROOT,"%03d",index);byte[] instruction=await(stem+"_REQUEST.json");
                JSONObject request;try{request=ProviderWireJson.object(instruction,100_000);}finally{Arrays.fill(instruction,(byte)0);}
                if(request.keySet().equals(Set.of("finish"))){require(request.getBoolean("finish"),"fixed finish only");
                    publish("COMPLETE.json",new JSONObject().put("exchanges",index-1).put("scope","SOURCE_ENGINE_SIGNER_NOT_ANDROID_OR_TLS"));return;}
                if(request.keySet().equals(Set.of("state"))){require(request.getBoolean("state"),"fixed normal state read only");
                    Map<String,Object> state=new LinkedHashMap<>(f.engine.getState());
                    // Same normal plugin branch: actual produced journal read,
                    // not a supplied principal or a reflected authority.
                    JSONObject principal=f.principal.readFor(state);if(principal!=null)state.put("principal",principal);
                    JSONObject activation=new NativeAssignedActivationJournal(f.work).readFor(state);if(activation!=null)state.put("assigned_activation",activation);
                    publish(stem+"_STATE.json",new JSONObject(state));continue;
                }
                require(request.keySet().equals(Set.of("method","path","body_base64","headers")),"closed original request input");
                method=request.getString("method");path=request.getString("path");boolean profile=false;require("POST".equals(method)&&"/feedback-api/submit".equals(path),"only normal FEEDBACK submit path");
                original=Base64.getDecoder().decode(request.getString("body_base64"));require((profile?original.length==0:original.length>0)&&original.length<=30000,"bounded original body");
                JSONObject supplied=request.getJSONObject("headers");require(supplied.keySet().equals(Set.of("content-type","idempotency-key")),"exact shipping request header set");
                Map<String,String> suppliedHeaders=new LinkedHashMap<>();for(String key:supplied.keySet()){require("content-type".equals(key)?"application/json".equals(supplied.getString(key)):ProviderWireJson.object(original,30000).getString("operation_id").equals(supplied.getString(key)),"exact shipping content type/idempotency operation");suppliedHeaders.put(key,supplied.getString(key));}
                forwarded=false;AuthorizedRequest authorized=new AuthorizedRequest(path,method,suppliedHeaders,original);
                AuthorizedResponse response=null;try{response=f.engine.authorizedRequest("KIOSK_08",authorized);require(forwarded,"normal HTTPS path unused");
                    publish(stem+"_NATIVE.json",new JSONObject().put("status",response.status).put("body_base64",Base64.getEncoder().encodeToString(response.body))
                        .put("body_sha256",NativeRetainedAttempt.hash(response.body)).put("headers",new JSONObject(response.headers))
                        .put("raw_http_body_base64",Base64.getEncoder().encodeToString(rawHttpBody)).put("raw_http_body_sha256",NativeRetainedAttempt.hash(rawHttpBody)));
                }finally{if(response!=null)Arrays.fill(response.body,(byte)0);if(rawHttpBody!=null)Arrays.fill(rawHttpBody,(byte)0);rawHttpBody=null;Arrays.fill(original,(byte)0);Arrays.fill(authorized.body,(byte)0);original=null;path=null;}
            }throw new AssertionError("bounded exchange count exceeded");
        }finally{if(original!=null)Arrays.fill(original,(byte)0);if(rawHttpBody!=null)Arrays.fill(rawHttpBody,(byte)0);f.wiped();}
    }
    public static void main(String[] args)throws Exception {
        require(args.length==1,"one private NEW IPC directory");Path p=Path.of(args[0]).toAbsolutePath();
        require(Files.isDirectory(p,LinkOption.NOFOLLOW_LINKS)&&!Files.isSymbolicLink(p),"owned IPC directory required");
        require(Files.getPosixFilePermissions(p).equals(PosixFilePermissions.fromString("rwx------")),"IPC0700 required");
        require(p.equals(p.toRealPath(LinkOption.NOFOLLOW_LINKS)),"canonical NEW IPC path required");
        require(Files.getOwner(p,LinkOption.NOFOLLOW_LINKS).equals(p.getFileSystem().getUserPrincipalLookupService().lookupPrincipalByName(System.getProperty("user.name"))),"current UID must own IPC");
        try(var entries=Files.list(p)){require(entries.findAny().isEmpty(),"fresh empty IPC required; old instructions never replay");}
        new CurrentNativeFeedbackSqlProducer(p).run();
    }
}
